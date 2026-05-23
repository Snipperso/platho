import { describe, expect, it } from 'vitest';
import { Address, beginCell, Cell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  Vault,
  BindDeploymentManifest as VaultBind,
  BindOfficialAthWallet as VaultBindAth,
  SealGenesis as VaultSeal,
  AthTransferNotification,
  RegisterMessagingKeys,
  PublishPrivateFromWallet,
} from '../build/Vault/Vault_Vault';
import {
  CapsuleHub,
  BindDeploymentManifest as CapsuleBind,
  SealGenesis as CapsuleSeal,
  FlushFees,
} from '../build/CapsuleHub/CapsuleHub_CapsuleHub';
import { FeeAccumulator } from '../build/FeeAccumulator/FeeAccumulator_FeeAccumulator';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';
import {
  finalPrivateBodyCell,
  finalPrivateHeader0Cell,
  finalPrivateHeader1Cell,
} from './helpers/capsule-cells';

const GENESIS_HASH = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
const MANIFEST_HASH = 0x777788889999aaaabbbbccccddddeeeeffff0000111122223333444455556666n;
const KIND_PRIVATE = 1n;
const SIZE_STANDARD = 1n;
const SUITE_CLASSICAL = 1n;
const PLATO_PRIVATE_STANDARD_FEE_TON = 5_000_000n;
const ATH_FULL_DISCOUNT_AMOUNT = 10_000_000_000_000n;
const AIRDROP_TOTAL = 30_000_000_000_000_000n;
const AIRDROP_REWARD_PER_MESSAGE = 10_000_000_000n;
const CAPSULEHUB_FEE_FLUSH_CALLER_RESERVE = 4_000_000n;

const BODY_CELL = finalPrivateBodyCell();
const HEADER0_CELL = finalPrivateHeader0Cell();
const HEADER1_CELL = finalPrivateHeader1Cell();
const BODY_HASH = cellHash(BODY_CELL);
const HEADER0 = cellHash(HEADER0_CELL);
const HEADER1 = cellHash(HEADER1_CELL);

function cellHash(cell: Cell): bigint {
  return BigInt('0x' + cell.hash().toString('hex'));
}

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

async function deployBoundPair() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const deployer = await blockchain.treasury('m6-deployer');
  const user = await blockchain.treasury('m6-user');
  const feeTreasury = await blockchain.treasury('m6-fee-treasury');
  const buybackReceiver = fixtureAddress('M6_BUYBACK_RECEIVER');

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

  const feeAccumulatorInit = await FeeAccumulator.init(feeTreasury.address, buybackReceiver);
  const feeAccumulatorAddress = contractAddress(0, feeAccumulatorInit);
  await blockchain.setShardAccount(feeAccumulatorAddress, createShardAccount({
    address: feeAccumulatorAddress,
    code: feeAccumulatorInit.code,
    data: feeAccumulatorInit.data,
    balance: toNano('2'),
    workchain: feeAccumulatorAddress.workChain,
  }));
  const feeAccumulator = blockchain.openContract(new FeeAccumulator(feeAccumulatorAddress, feeAccumulatorInit));

  const capsuleInit = await CapsuleHub.init(feeAccumulatorAddress, fixtureAddress('M6_UNBOUND_VAULT_PLACEHOLDER'), false, false, 0n, deployer.address);
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

  return { blockchain, deployer, vault, capsule, feeAccumulator, officialAthWallet, user };
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

async function registerKeys(vault: any, user: any) {
  await vault.send(user.getSender(), { value: toNano('0.03') }, {
    $$type: 'RegisterMessagingKeys',
    enc_pubkey: 1n,
    sign_pubkey: 2n,
    pq_kem_pubkey_hash: 0n,
    pq_kem_pubkey_len: 0n,
    pq_kem_pubkey: beginCell().endCell(),
    crypto_suite_mask: 1n,
  } as RegisterMessagingKeys);
}

async function publishPrivate(vault: any, user: any, nonce: bigint, maxCharge: bigint) {
  await vault.send(user.getSender(), { value: maxCharge }, {
    $$type: 'PublishPrivateFromWallet',
    client_nonce: nonce,
    max_charge: maxCharge,
    size_class: SIZE_STANDARD,
    crypto_suite: SUITE_CLASSICAL,
    header_0_hash: HEADER0,
    header_1_hash: HEADER1,
    body_hash: BODY_HASH,
    header_0: HEADER0_CELL,
    header_1: HEADER1_CELL,
    body: BODY_CELL,
  } as PublishPrivateFromWallet);
}

describe('Vault milestone 6: wallet-funded publish orchestration', () => {
  it('VAULT-M6-01: wallet publish reaches CapsuleHub, receives ACK, and clears PendingPublish', async () => {
    const { vault, capsule, user } = await deployBoundPair();
    await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
    const beforeUser = await vault.getGetUser(user.address);
    const beforeGlobal = await vault.getGetGlobal();

    await publishPrivate(vault, user, 0n, maxCharge);

    const afterUser = await vault.getGetUser(user.address);
    const vg = await vault.getGetGlobal();
    const cs = await capsule.getGetState();

    expect(vg.pending_publish_count).toBe(0n);
    expect(cs.private_latest_id).toBe(1n);
    expect(cs.accrued_plato_fee_ton).toBe(PLATO_PRIVATE_STANDARD_FEE_TON);
    const stored = await capsule.getGetPrivateEntry(0n);
    expect(stored.exists).toBe(true);
    expect(stored.body_hash).toBe(BODY_HASH);
    expect(stored.body.hash().toString('hex')).toBe(BODY_CELL.hash().toString('hex'));
    expect(beforeGlobal.airdrop_remaining_ath).toBe(AIRDROP_TOTAL);
    expect(afterUser.ath_balance).toBe(beforeUser.ath_balance + AIRDROP_REWARD_PER_MESSAGE);
    expect(vg.airdrop_remaining_ath).toBe(AIRDROP_TOTAL - AIRDROP_REWARD_PER_MESSAGE);
    expect(vg.airdrop_distributed_ath).toBe(AIRDROP_REWARD_PER_MESSAGE);
  });

  it('VAULT-M6-01B: wallet publish may include a PWA fee surcharge above canonical maxCharge', async () => {
    const { vault, capsule, user } = await deployBoundPair();
    await registerKeys(vault, user);
    const canonicalMaxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);

    await publishPrivate(vault, user, 0n, canonicalMaxCharge + 2_000_000n);

    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
    expect((await capsule.getGetState()).private_latest_id).toBe(1n);
    expect((await capsule.getGetState()).accrued_plato_fee_ton).toBe(PLATO_PRIVATE_STANDARD_FEE_TON);
  });

  it('VAULT-CAPSULE-DUST-01: discounted Vault fee dust flushes from CapsuleHub into real FeeAccumulator', async () => {
    const { blockchain, deployer, vault, capsule, feeAccumulator, officialAthWallet, user } = await deployBoundPair();
    await registerKeys(vault, user);
    await vault.send(blockchain.sender(officialAthWallet), { value: toNano('0.03') }, {
      $$type: 'AthTransferNotification',
      query_id: 9001n,
      amount: ATH_FULL_DISCOUNT_AMOUNT - 1n,
      sender_key: 1n,
      sender_wallet: user.address,
    } as AthTransferNotification);

    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
    await publishPrivate(vault, user, 0n, maxCharge);
    expect((await capsule.getGetState()).accrued_plato_fee_ton).toBe(1n);

    await capsule.send(deployer.getSender(), { value: CAPSULEHUB_FEE_FLUSH_CALLER_RESERVE }, {
      $$type: 'FlushFees',
      amount: 1n,
    } as FlushFees);

    expect((await capsule.getGetState()).accrued_plato_fee_ton).toBe(0n);
    expect((await feeAccumulator.getGetState()).accumulated_ton).toBe(1n);
  });

  it('VAULT-M6-02: bounced CapsuleHub publish clears PendingPublish without activity airdrop', async () => {
    const { vault, user } = await deployBounceVault();
    await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
    const beforeUser = await vault.getGetUser(user.address);
    const beforeGlobal = await vault.getGetGlobal();

    await publishPrivate(vault, user, 0n, maxCharge);

    const afterUser = await vault.getGetUser(user.address);
    const vg = await vault.getGetGlobal();
    expect(vg.pending_publish_count).toBe(0n);
    expect(afterUser.ath_balance).toBe(beforeUser.ath_balance);
    expect(vg.airdrop_remaining_ath).toBe(beforeGlobal.airdrop_remaining_ath);
    expect(vg.airdrop_distributed_ath).toBe(beforeGlobal.airdrop_distributed_ath);
  });

  it('VAULT-M20X-01: activity airdrop accumulates per successful finalized paid publish without a per-wallet cap gate', async () => {
    const { vault, user } = await deployBoundPair();
    await registerKeys(vault, user);

    const maxCharge1 = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
    await publishPrivate(vault, user, 0n, maxCharge1);
    let userAfter = await vault.getGetUser(user.address);
    let globalAfter = await vault.getGetGlobal();
    expect(userAfter.ath_balance).toBe(AIRDROP_REWARD_PER_MESSAGE);
    expect(globalAfter.airdrop_distributed_ath).toBe(AIRDROP_REWARD_PER_MESSAGE);

    const maxCharge2 = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
    expect(maxCharge2).toBeLessThan(maxCharge1);
    await publishPrivate(vault, user, 1n, maxCharge2);
    userAfter = await vault.getGetUser(user.address);
    globalAfter = await vault.getGetGlobal();
    expect(userAfter.ath_balance).toBe(AIRDROP_REWARD_PER_MESSAGE * 2n);
    expect(globalAfter.airdrop_distributed_ath).toBe(AIRDROP_REWARD_PER_MESSAGE * 2n);
  });
});
