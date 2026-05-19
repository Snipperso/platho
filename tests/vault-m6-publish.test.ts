import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { keyPairFromSeed, sign } from '@ton/crypto';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  Vault,
  BindDeploymentManifest as VaultBind,
  BindOfficialAthWallet as VaultBindAth,
  SealGenesis as VaultSeal,
  DepositTon,
  SetSession,
  TopUpMessageBudget,
} from '../build/Vault/Vault_Vault';
import {
  CapsuleHub,
  BindDeploymentManifest as CapsuleBind,
  SealGenesis as CapsuleSeal,
} from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';

const GENESIS_HASH = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
const MANIFEST_HASH = 0x777788889999aaaabbbbccccddddeeeeffff0000111122223333444455556666n;
const MAGIC = 0x504c5352n;
const VERSION = 1n;
const OP_PRIVATE = 0x686694C6n;
const KIND_PRIVATE = 1n;
const SIZE_STANDARD = 1n;
const SUITE_CLASSICAL = 1n;
const BODY_HASH = 0x1111000000000000000000000000000000000000000000000000000000000001n;
const HEADER0 = 0x2222000000000000000000000000000000000000000000000000000000000002n;
const HEADER1 = 0x3333000000000000000000000000000000000000000000000000000000000003n;
const PLATO_PRIVATE_STANDARD_FEE_TON = 5_000_000n;
const AIRDROP_TOTAL = 30_000_000_000_000_000n;
const AIRDROP_REWARD_PER_MESSAGE = 10_000_000_000n;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}


function addressHash(address: Address): bigint {
  return BigInt('0x' + beginCell().storeAddress(address).endCell().hash().toString('hex'));
}

async function deriveAthWallet(owner: Address, athMasterAddress: Address): Promise<Address> {
  const walletInit = await ATHWallet.init(0n, owner, athMasterAddress);
  return contractAddress(owner.workChain, walletInit);
}

function bufToBigInt(buf: Buffer): bigint {
  return BigInt('0x' + buf.toString('hex'));
}

function bigintToBuffer(v: bigint, bytes = 32): Buffer {
  return Buffer.from(v.toString(16).padStart(bytes * 2, '0'), 'hex');
}

async function buildExternalRequest(params: {
  vault: any;
  op: bigint;
  owner: Address;
  sessionId: bigint;
  nonce: bigint;
  validUntil: bigint;
  publishKind: bigint;
  sizeClass: bigint;
  cryptoSuite: bigint;
  maxCharge: bigint;
  secretKey: Buffer;
}) {
  const sigHash = await params.vault.getGetSessionPublishHash(
    params.op,
    params.owner,
    params.sessionId,
    params.nonce,
    params.validUntil,
    params.publishKind,
    params.sizeClass,
    params.cryptoSuite,
    params.maxCharge,
    BODY_HASH,
    HEADER0,
    HEADER1,
  );

  const signature = sign(bigintToBuffer(sigHash), params.secretKey);
  const hashesRef = beginCell().storeUint(BODY_HASH, 256).storeUint(HEADER0, 256).storeUint(HEADER1, 256).endCell();
  const signatureRef = beginCell().storeBuffer(signature).endCell();

  return beginCell()
    .storeUint(MAGIC, 32)
    .storeUint(VERSION, 8)
    .storeUint(params.op, 32)
    .storeAddress(params.owner)
    .storeUint(params.sessionId, 256)
    .storeUint(params.nonce, 64)
    .storeUint(params.validUntil, 32)
    .storeUint(params.publishKind, 8)
    .storeUint(params.sizeClass, 8)
    .storeUint(params.cryptoSuite, 8)
    .storeUint(params.maxCharge, 128)
    .storeRef(hashesRef)
    .storeRef(signatureRef)
    .endCell()
    .beginParse();
}

async function deployBoundPair() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const deployer = await blockchain.treasury('m6-deployer');
  const user = await blockchain.treasury('m6-user');
  const feeAccumulator = await blockchain.treasury('m6-fee-accumulator');

  const vaultInit = await Vault.init(deployer.address, deployer.address, fixtureAddress('M6_UNBOUND_CAPSULE_PLACEHOLDER'), addressHash(deployer.address), false, false, 0n);
  const vaultAddress = contractAddress(0, vaultInit);
  const officialAthWallet = await deriveAthWallet(vaultAddress, deployer.address);
  await blockchain.setShardAccount(vaultAddress, createShardAccount({
    address: vaultAddress,
    code: vaultInit.code,
    data: vaultInit.data,
    balance: toNano('2'),
    workchain: vaultAddress.workChain,
  }));
  const vault = blockchain.openContract(new Vault(vaultAddress, vaultInit));

  const capsuleInit = await CapsuleHub.init(feeAccumulator.address, fixtureAddress('M6_UNBOUND_VAULT_PLACEHOLDER'), false, false, 0n, deployer.address);
  const capsuleAddress = contractAddress(0, capsuleInit);
  await blockchain.setShardAccount(capsuleAddress, createShardAccount({
    address: capsuleAddress,
    code: capsuleInit.code,
    data: capsuleInit.data,
    balance: toNano('2'),
    workchain: capsuleAddress.workChain,
  }));
  const capsule = blockchain.openContract(new CapsuleHub(capsuleAddress, capsuleInit));

  await vault.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindDeploymentManifest',
    deployment_manifest_hash: MANIFEST_HASH,
    counterpart_address: capsuleAddress,
  } as VaultBind);
  await capsule.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindDeploymentManifest',
    deployment_manifest_hash: MANIFEST_HASH,
    counterpart_address: vaultAddress,
  } as CapsuleBind);
  await vault.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: officialAthWallet,
  } as VaultBindAth);
  await vault.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as VaultSeal);
  await capsule.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as CapsuleSeal);

  return { blockchain, vault, capsule, user };
}

async function deployBounceVault() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const user = await blockchain.treasury('m6-bounce-user');
  const athWallet = await blockchain.treasury('m6-bounce-ath-wallet');
  const missingCapsule = fixtureAddress('M6_MISSING_CAPSULEHUB');

  const vaultInit = await Vault.init(athWallet.address, athWallet.address, missingCapsule, GENESIS_HASH, true, true, MANIFEST_HASH);
  const vaultAddress = contractAddress(0, vaultInit);
  await blockchain.setShardAccount(vaultAddress, createShardAccount({
    address: vaultAddress,
    code: vaultInit.code,
    data: vaultInit.data,
    balance: toNano('2'),
    workchain: vaultAddress.workChain,
  }));
  const vault = blockchain.openContract(new Vault(vaultAddress, vaultInit));

  return { blockchain, vault, user };
}

async function fundSession(vault: any, user: any, sessionPubkey: bigint, expiresAt: number, budget = toNano('0.2')) {
  await vault.send(user.getSender(), { value: toNano('1.1') }, {
    $$type: 'DepositTon',
    amount: toNano('1'),
  } as DepositTon);
  await vault.send(user.getSender(), { value: toNano('0.1') }, {
    $$type: 'SetSession',
    session_pubkey: sessionPubkey,
    expires_at: BigInt(expiresAt),
  } as SetSession);
  await vault.send(user.getSender(), { value: toNano('0.1') }, {
    $$type: 'TopUpMessageBudget',
    amount: budget,
  } as TopUpMessageBudget);
}

describe('Vault milestone 6: external publish orchestration', () => {
  it('VAULT-M6-01: valid external private publish reaches CapsuleHub, receives ACK, and clears PendingPublish', async () => {
    const { blockchain, vault, capsule, user } = await deployBoundPair();
    const kp = keyPairFromSeed(Buffer.alloc(32, 66));
    const now = blockchain.now ?? 0;

    await fundSession(vault, user, bufToBigInt(kp.publicKey), now + 1000);
    const session = await vault.getGetSession(user.address);
    const maxCharge = await vault.getGetCanonicalSessionMaxCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
    const beforeUser = await vault.getGetUser(user.address);
    const beforeGlobal = await vault.getGetGlobal();
    const beforeVaultBalance = (await blockchain.getContract(vault.address)).balance;

    const external = await buildExternalRequest({
      vault,
      op: OP_PRIVATE,
      owner: user.address,
      sessionId: session.session_id,
      nonce: 0n,
      validUntil: BigInt(now + 100),
      publishKind: KIND_PRIVATE,
      sizeClass: SIZE_STANDARD,
      cryptoSuite: SUITE_CLASSICAL,
      maxCharge,
      secretKey: kp.secretKey,
    });

    await vault.sendExternal(external);

    const afterUser = await vault.getGetUser(user.address);
    const afterSession = await vault.getGetSession(user.address);
    const afterVaultBalance = (await blockchain.getContract(vault.address)).balance;
    const vg = await vault.getGetGlobal();
    const cs = await capsule.getGetState();
    const budgetSpent = beforeUser.message_budget_ton - afterUser.message_budget_ton;

    expect(afterSession.nonce).toBe(1n);
    expect(vg.pending_publish_count).toBe(0n);
    expect(cs.private_entry_count).toBe(1n);
    expect(cs.private_latest_id).toBe(1n);
    expect(cs.accrued_plato_fee_ton).toBe(PLATO_PRIVATE_STANDARD_FEE_TON);
    expect(budgetSpent > 0n).toBe(true);
    expect(budgetSpent <= maxCharge).toBe(true);
    expect(beforeUser.ton_balance + beforeUser.message_budget_ton - afterUser.ton_balance - afterUser.message_budget_ton)
      .toBeGreaterThanOrEqual(beforeVaultBalance - afterVaultBalance);
    expect(beforeGlobal.airdrop_remaining_ath).toBe(AIRDROP_TOTAL);
    expect(beforeGlobal.airdrop_distributed_ath).toBe(0n);
    expect(afterUser.ath_balance).toBe(beforeUser.ath_balance + AIRDROP_REWARD_PER_MESSAGE);
    expect(vg.airdrop_remaining_ath).toBe(AIRDROP_TOTAL - AIRDROP_REWARD_PER_MESSAGE);
    expect(vg.airdrop_distributed_ath).toBe(AIRDROP_REWARD_PER_MESSAGE);
    expect(vg.airdrop_reward_per_message_ath).toBe(AIRDROP_REWARD_PER_MESSAGE);
    expect(vg.airdrop_total_allocation_ath).toBe(AIRDROP_TOTAL);
  });

  it('VAULT-M6-02: bounced CapsuleHub publish clears PendingPublish and refunds through active message budget', async () => {
    const { blockchain, vault, user } = await deployBounceVault();
    const kp = keyPairFromSeed(Buffer.alloc(32, 67));
    const now = blockchain.now ?? 0;

    await fundSession(vault, user, bufToBigInt(kp.publicKey), now + 1000);
    const session = await vault.getGetSession(user.address);
    const maxCharge = await vault.getGetCanonicalSessionMaxCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
    const beforeUser = await vault.getGetUser(user.address);
    const beforeGlobal = await vault.getGetGlobal();
    const beforeVaultBalance = (await blockchain.getContract(vault.address)).balance;

    const external = await buildExternalRequest({
      vault,
      op: OP_PRIVATE,
      owner: user.address,
      sessionId: session.session_id,
      nonce: 0n,
      validUntil: BigInt(now + 100),
      publishKind: KIND_PRIVATE,
      sizeClass: SIZE_STANDARD,
      cryptoSuite: SUITE_CLASSICAL,
      maxCharge,
      secretKey: kp.secretKey,
    });

    await vault.sendExternal(external);

    const afterUser = await vault.getGetUser(user.address);
    const afterSession = await vault.getGetSession(user.address);
    const afterVaultBalance = (await blockchain.getContract(vault.address)).balance;
    const vg = await vault.getGetGlobal();
    const budgetSpent = beforeUser.message_budget_ton - afterUser.message_budget_ton;

    expect(afterSession.nonce).toBe(1n);
    expect(vg.pending_publish_count).toBe(0n);
    expect(budgetSpent > 0n).toBe(true);
    expect(budgetSpent < maxCharge).toBe(true);
    expect(beforeUser.ton_balance + beforeUser.message_budget_ton - afterUser.ton_balance - afterUser.message_budget_ton)
      .toBeGreaterThanOrEqual(beforeVaultBalance - afterVaultBalance);
    expect(afterUser.ath_balance).toBe(beforeUser.ath_balance);
    expect(vg.airdrop_remaining_ath).toBe(beforeGlobal.airdrop_remaining_ath);
    expect(vg.airdrop_distributed_ath).toBe(beforeGlobal.airdrop_distributed_ath);
  });

  it('VAULT-M20X-01: activity airdrop accumulates per successful finalized paid publish without a per-wallet cap gate', async () => {
    const { blockchain, vault, user } = await deployBoundPair();
    const kp = keyPairFromSeed(Buffer.alloc(32, 68));
    const now = blockchain.now ?? 0;

    await fundSession(vault, user, bufToBigInt(kp.publicKey), now + 1000);
    let session = await vault.getGetSession(user.address);

    const maxCharge1 = await vault.getGetCanonicalSessionMaxCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
    const external1 = await buildExternalRequest({
      vault,
      op: OP_PRIVATE,
      owner: user.address,
      sessionId: session.session_id,
      nonce: 0n,
      validUntil: BigInt(now + 100),
      publishKind: KIND_PRIVATE,
      sizeClass: SIZE_STANDARD,
      cryptoSuite: SUITE_CLASSICAL,
      maxCharge: maxCharge1,
      secretKey: kp.secretKey,
    });
    await vault.sendExternal(external1);

    let userAfter = await vault.getGetUser(user.address);
    let globalAfter = await vault.getGetGlobal();
    expect(userAfter.ath_balance).toBe(AIRDROP_REWARD_PER_MESSAGE);
    expect(globalAfter.airdrop_distributed_ath).toBe(AIRDROP_REWARD_PER_MESSAGE);
    expect(globalAfter.airdrop_remaining_ath).toBe(AIRDROP_TOTAL - AIRDROP_REWARD_PER_MESSAGE);

    session = await vault.getGetSession(user.address);
    const maxCharge2 = await vault.getGetCanonicalSessionMaxCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
    expect(maxCharge2).toBeLessThan(maxCharge1);
    const external2 = await buildExternalRequest({
      vault,
      op: OP_PRIVATE,
      owner: user.address,
      sessionId: session.session_id,
      nonce: 1n,
      validUntil: BigInt(now + 100),
      publishKind: KIND_PRIVATE,
      sizeClass: SIZE_STANDARD,
      cryptoSuite: SUITE_CLASSICAL,
      maxCharge: maxCharge2,
      secretKey: kp.secretKey,
    });
    await vault.sendExternal(external2);

    userAfter = await vault.getGetUser(user.address);
    globalAfter = await vault.getGetGlobal();
    expect(userAfter.ath_balance).toBe(AIRDROP_REWARD_PER_MESSAGE * 2n);
    expect(globalAfter.airdrop_distributed_ath).toBe(AIRDROP_REWARD_PER_MESSAGE * 2n);
    expect(globalAfter.airdrop_remaining_ath).toBe(AIRDROP_TOTAL - AIRDROP_REWARD_PER_MESSAGE * 2n);
  });

});
