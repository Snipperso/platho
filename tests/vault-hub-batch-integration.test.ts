import { describe, expect, it } from 'vitest';
import { Address, beginCell, Cell, contractAddress, Dictionary, external, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { keyPairFromSeed, sign } from '@ton/crypto';
import {
  Vault,
  BindDeploymentManifest as VaultBind,
  BindOfficialAthWallet as VaultBindAth,
  BindProfileRegistry as VaultBindProfile,
  BindUsernameRegistry as VaultBindUsername,
  SealGenesis as VaultSeal,
  RegisterMessagingKeys,
} from '../build/Vault/Vault_Vault';
import {
  CapsuleHub,
  BindDeploymentManifest as CapsuleBind,
  SealGenesis as CapsuleSeal,
} from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import { FeeAccumulator } from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';
import {
  finalPrivateBodyCell,
  finalPrivateHeader0Cell,
  finalPrivateHeader1Cell,
} from './helpers/capsule-cells';

// End-to-end VPB2: a signed batch external through the REAL bound+sealed Vault + CapsuleHub. One sandbox
// sendMessage chains Vault(accept) -> PublishBatchToHub -> Hub(ingest+store) -> CapsuleHubBatchAck ->
// Vault(settle): the Hub entry, the Vault receipt (CONFIRMED), and the per-capsule airdrop are all asserted.

const MANIFEST_HASH = 0x777788889999aaaabbbbccccddddeeeeffff0000111122223333444455556666n;
const AUTH_KEY_PAIR = keyPairFromSeed(Buffer.alloc(32, 0x66));
const AUTH_0 = BigInt('0x' + AUTH_KEY_PAIR.publicKey.toString('hex'));

const OP_PUBLISH_BATCH = 0x7e1f5041n;
const VAULT_BATCH_PUBLISH_SIGNING_DOMAIN = 0x56504232n;
const VAULT_BATCH_PUBLISH_ID_DOMAIN = 0x42504931n; // BPI1
const CAPSULE_ENTRY_PUBLISH_ID_DOMAIN = 0x45504931n; // EPI1
const KIND_PRIVATE = 1n;
const VPB2_VERSION = 1n;
const SUITE_HYBRID = 2n;
const SIZE_1K = 1n;
const ACT_PUBLISH_BATCH = 7n;
const RES_CONFIRMED = 0x01n;
const AIRDROP_REWARD_PER_CAPSULE = 10_000_000_000n;
const UINT64_MOD = 1n << 64n;

const ENC_0 = 0x1000000000000000000000000000000000000000000000000000000000000001n;
const SIG_0 = 0x2000000000000000000000000000000000000000000000000000000000000002n;
const PQ_HASH = 0x5000000000000000000000000000000000000000000000000000000000000005n;

function snakeCell(byteLength: number, fill = 0x5a): Cell {
  let tail: Cell | null = null;
  for (let offset = byteLength; offset > 0;) {
    const start = Math.max(0, offset - 127);
    const b = beginCell().storeBuffer(Buffer.alloc(offset - start, fill));
    if (tail) b.storeRef(tail);
    tail = b.endCell();
    offset = start;
  }
  return tail ?? beginCell().endCell();
}
const PQ_CELL = snakeCell(1184);

function cellHash(cell: Cell): bigint { return BigInt('0x' + cell.hash().toString('hex')); }
function addressHash(a: Address): bigint { return BigInt('0x' + a.hash.toString('hex')); }
function addressCellHash(a: Address): bigint { return cellHash(beginCell().storeAddress(a).endCell()); }
function fixtureAddress(label: string): Address {
  return new Address(0, createHash('sha256').update(`PLATHO.VPB2.E2E.${label}`).digest());
}
async function deriveAthWallet(owner: Address, athMaster: Address): Promise<Address> {
  return contractAddress(owner.workChain, await ATHWallet.init(0n, owner, athMaster));
}

function validPrivatePart(): Cell {
  const h0 = finalPrivateHeader0Cell();
  const h1 = finalPrivateHeader1Cell();
  const body = finalPrivateBodyCell(SIZE_1K);
  return beginCell()
    .storeUint(SIZE_1K, 8).storeUint(SUITE_HYBRID, 8)
    .storeUint(cellHash(h0), 256).storeUint(cellHash(h1), 256).storeUint(cellHash(body), 256)
    .storeRef(h0).storeRef(h1).storeRef(body).endCell();
}

function batchExternalBody(vaultAddr: Address, owner: Address, nonce: bigint, maxCharge: bigint, partsRoot: Cell): Cell {
  const root = beginCell()
    .storeUint(VAULT_BATCH_PUBLISH_SIGNING_DOMAIN, 32)
    .storeUint(MANIFEST_HASH, 256)
    .storeUint(addressHash(vaultAddr), 256)
    .storeUint(KIND_PRIVATE, 8)
    .storeUint(addressHash(owner), 256)
    .storeUint(nonce, 64)
    .storeUint(maxCharge, 128)
    .storeUint(1n, 8)
    .storeUint(VPB2_VERSION, 8)
    .storeRef(partsRoot)
    .endCell();
  const sig = sign(root.hash(), AUTH_KEY_PAIR.secretKey);
  return beginCell().storeUint(OP_PUBLISH_BATCH, 32).storeAddress(owner).storeBuffer(sig).storeRef(root).endCell();
}

function computeBatchPublishId(owner: Address, nonce: bigint, partsRoot: Cell): bigint {
  return cellHash(beginCell()
    .storeUint(VAULT_BATCH_PUBLISH_ID_DOMAIN, 32)
    .storeUint(MANIFEST_HASH, 256)
    .storeAddress(owner)
    .storeUint(nonce, 64)
    .storeUint(cellHash(partsRoot), 256)
    .storeUint(KIND_PRIVATE, 8)
    .storeUint(1n, 8)
    .endCell());
}
function computeEntryPublishId(batchPublishId: bigint, partIndex: number): bigint {
  return cellHash(beginCell()
    .storeUint(CAPSULE_ENTRY_PUBLISH_ID_DOMAIN, 32)
    .storeUint(batchPublishId, 256)
    .storeUint(BigInt(partIndex), 16)
    .endCell());
}

async function deployBoundSealedPair() {
  const bc = await Blockchain.create();
  bc.now = 1_700_000_000;
  const deployer = await bc.treasury('e2e-deployer');
  const user = await bc.treasury('e2e-user');
  const feeTreasury = await bc.treasury('e2e-fee-treasury');

  const vaultInit = await Vault.init(deployer.address, deployer.address, fixtureAddress('UNBOUND_HUB'), addressCellHash(deployer.address), false, false, 0n);
  const vaultAddress = contractAddress(0, vaultInit);
  const officialAthWallet = await deriveAthWallet(vaultAddress, deployer.address);
  await bc.setShardAccount(vaultAddress, createShardAccount({ address: vaultAddress, code: vaultInit.code, data: vaultInit.data, balance: toNano('5'), workchain: 0 }));
  const vault = bc.openContract(new Vault(vaultAddress, vaultInit));

  const feeInit = await FeeAccumulator.init(feeTreasury.address, fixtureAddress('BUYBACK'));
  const feeAddress = contractAddress(0, feeInit);
  await bc.setShardAccount(feeAddress, createShardAccount({ address: feeAddress, code: feeInit.code, data: feeInit.data, balance: toNano('2'), workchain: 0 }));

  const hubInit = await CapsuleHub.init(feeAddress, fixtureAddress('UNBOUND_VAULT'), false, false, 0n, deployer.address);
  const hubAddress = contractAddress(0, hubInit);
  await bc.setShardAccount(hubAddress, createShardAccount({ address: hubAddress, code: hubInit.code, data: hubInit.data, balance: toNano('200'), workchain: 0 }));
  const hub = bc.openContract(new CapsuleHub(hubAddress, hubInit));

  const send = (to: any, body: any) => to.send(deployer.getSender(), { value: toNano('0.05') }, body);
  await send(vault, { $$type: 'BindDeploymentManifest', deployment_manifest_hash: MANIFEST_HASH, counterpart_address: hubAddress } as VaultBind);
  await send(hub, { $$type: 'BindDeploymentManifest', deployment_manifest_hash: MANIFEST_HASH, counterpart_address: vaultAddress } as CapsuleBind);
  await send(vault, { $$type: 'BindOfficialAthWallet', deployment_manifest_hash: MANIFEST_HASH, official_ath_wallet_address: officialAthWallet } as VaultBindAth);
  await send(vault, { $$type: 'BindProfileRegistry', deployment_manifest_hash: MANIFEST_HASH, profile_registry_address: fixtureAddress('PROFILE_REG') } as VaultBindProfile);
  await send(vault, { $$type: 'BindUsernameRegistry', deployment_manifest_hash: MANIFEST_HASH, username_registry_address: fixtureAddress('USERNAME_REG') } as VaultBindUsername);
  await send(vault, { $$type: 'SealGenesis', deployment_manifest_hash: MANIFEST_HASH } as VaultSeal);
  await send(hub, { $$type: 'SealGenesis', deployment_manifest_hash: MANIFEST_HASH } as CapsuleSeal);

  return { bc, vault, hub, user, vaultAddress };
}

describe('VPB2 end-to-end: Vault batch publish -> CapsuleHub ingest -> ACK settle', () => {
  it('E2E-BATCH-01: a signed 1-part private batch stores a Hub entry, settles the Vault receipt CONFIRMED, and credits the airdrop', async () => {
    const { bc, vault, hub, user, vaultAddress } = await deployBoundSealedPair();
    expect((await vault.getGetGlobal()).sealed).toBe(true);
    expect((await hub.getGetState()).sealed).toBe(true);

    await vault.send(user.getSender(), { value: toNano('0.1') }, {
      $$type: 'RegisterMessagingKeys',
      enc_pubkey: ENC_0, sign_pubkey: SIG_0, auth_pubkey: AUTH_0,
      pq_kem_pubkey_hash: PQ_HASH, pq_kem_pubkey_len: 1184n, pq_kem_pubkey: PQ_CELL, crypto_suite_mask: 2n,
    } as RegisterMessagingKeys);
    await vault.send(user.getSender(), { value: toNano('2') + 2_000_000n }, { $$type: 'DepositTon', amount: toNano('2') } as any);

    const nonce = (await vault.getGetUser(user.address)).publish_nonce;
    const partsRoot = validPrivatePart();
    const batchPublishId = computeBatchPublishId(user.address, nonce, partsRoot);

    // ONE send drives the full chain: Vault accept -> Hub ingest -> ACK -> Vault settle.
    await bc.sendMessage(external({ to: vaultAddress, body: batchExternalBody(vaultAddress, user.address, nonce, toNano('1'), partsRoot) }));

    // Hub stored the capsule as entry 0 with its derived EPI1 publish_id.
    const entry = await hub.getGetPrivateEntry(0n);
    expect(entry.exists).toBe(true);
    expect(entry.publish_id).toBe(computeEntryPublishId(batchPublishId, 0));
    expect((await hub.getGetState()).private_latest_id).toBe(1n);

    // Vault settled: receipt CONFIRMED (aux = first_entry_id 0), pending cleared, per-capsule airdrop credited.
    const afterUser = await vault.getGetUser(user.address);
    expect(afterUser.publish_nonce).toBe(nonce + 1n);
    expect(afterUser.ath_balance).toBe(AIRDROP_REWARD_PER_CAPSULE);
    const slot = (await vault.getGetUserReceipts(user.address)).receipts.get(Number(nonce % 20n));
    expect(slot).toBeDefined();
    expect(slot!.action).toBe(ACT_PUBLISH_BATCH);
    expect(slot!.result).toBe(RES_CONFIRMED);
    expect(slot!.aux).toBe(0n);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });
});
