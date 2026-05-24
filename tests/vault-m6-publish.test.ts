import { describe, expect, it } from 'vitest';
import { Address, beginCell, Cell, contractAddress, Dictionary, external, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { keyPairFromSeed, sign } from '@ton/crypto';
import {
  Vault,
  BindDeploymentManifest as VaultBind,
  BindOfficialAthWallet as VaultBindAth,
  SealGenesis as VaultSeal,
  AthTransferNotification,
  RegisterMessagingKeys,
  storeVault$Data as storeVaultData,
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
const AIRDROP_DISCOUNT_UNLOCK_REMAINING = 15_000_000_000_000_000n;
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

async function deployBoundPair(options: { airdropRemaining?: bigint } = {}) {
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

  if (options.airdropRemaining !== undefined) {
    const balance = (await blockchain.getContract(vaultAddress)).balance;
    const data = beginCell().storeBit(true).store(storeVaultData({
      $$type: 'Vault$Data',
      vault_ath_wallet_address: officialAthWallet,
      ath_master_address: deployer.address,
      capsule_hub_address: capsuleAddress,
      capsule_hub_bound: true,
      sealed: true,
      deployment_manifest_hash: MANIFEST_HASH,
      genesis_config_hash: options.airdropRemaining,
      users: Dictionary.empty(),
      key_records: Dictionary.empty(),
      receive_intents: Dictionary.empty(),
      processed_ath_deposits: Dictionary.empty(),
      pending_ath_withdrawals: Dictionary.empty(),
      pending_publishes: Dictionary.empty(),
      user_count: 0n,
      key_record_count: 0n,
      receive_intent_count: 0n,
      processed_ath_deposit_count: 0n,
      pending_ath_withdrawal_count: 0n,
      pending_publish_count: 0n,
    })).endCell();
    await blockchain.setShardAccount(vaultAddress, createShardAccount({
      address: vaultAddress,
      code: vaultInit.code,
      data,
      balance,
      workchain: vaultAddress.workChain,
    }));
  }

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
  const keyPair = keyPairFromSeed(Buffer.alloc(32, 7));
  await vault.send(user.getSender(), { value: toNano('0.03') }, {
    $$type: 'RegisterMessagingKeys',
    enc_pubkey: 1n,
    sign_pubkey: BigInt('0x' + keyPair.publicKey.toString('hex')),
    pq_kem_pubkey_hash: 0n,
    pq_kem_pubkey_len: 0n,
    pq_kem_pubkey: beginCell().endCell(),
    crypto_suite_mask: 1n,
  } as RegisterMessagingKeys);
  return keyPair;
}

async function topUpVaultTon(vault: any, user: any, amount: bigint) {
  await vault.send(user.getSender(), { value: amount + 12_000_000n }, {
    $$type: 'DepositTon',
    amount,
  });
}

async function publishPrivate(blockchain: Blockchain, vault: any, user: any, maxCharge: bigint) {
  let userState = await vault.getGetUser(user.address);
  if (userState.ton_balance < maxCharge) {
    await topUpVaultTon(vault, user, maxCharge * 2n);
    userState = await vault.getGetUser(user.address);
  }
  const keyPair = keyPairFromSeed(Buffer.alloc(32, 7));
  await blockchain.sendMessage(external({
    to: vault.address,
    body: signedPrivatePublishBody(user.address, userState.publish_nonce, maxCharge, keyPair.secretKey),
  }));
}

function signedPrivatePublishBody(owner: Address, nonce: bigint, maxCharge: bigint, secretKey: Buffer, overrides: { signature?: Buffer; payload?: Cell } = {}): Cell {
  const payload = beginCell()
    .storeUint(SIZE_STANDARD, 8)
    .storeUint(SUITE_CLASSICAL, 8)
    .storeUint(HEADER0, 256)
    .storeUint(HEADER1, 256)
    .storeUint(BODY_HASH, 256)
    .storeRef(HEADER0_CELL)
    .storeRef(HEADER1_CELL)
    .storeRef(BODY_CELL)
    .endCell();
  const signedDataCell = beginCell()
    .storeAddress(owner)
    .storeUint(nonce, 64)
    .storeUint(maxCharge, 128)
    .storeRef(payload)
    .endCell();
  const signature = overrides.signature ?? sign(signedDataCell.hash(), secretKey);
  return beginCell()
    .storeUint(0x7E1F5031, 32)
    .storeAddress(owner)
    .storeBuffer(signature)
    .storeRef(signedDataCell)
    .endCell();
}

describe('Vault milestone 6: Vault-balance publish orchestration', () => {
  it('VAULT-M6-01: signed Vault-balance publish reaches CapsuleHub, receives ACK, and clears PendingPublish', async () => {
    const { blockchain, vault, capsule, user } = await deployBoundPair();
    await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
    const beforeUser = await vault.getGetUser(user.address);
    const beforeGlobal = await vault.getGetGlobal();

    await publishPrivate(blockchain, vault, user, maxCharge);

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

  it('VAULT-M6-01B: signed Vault-balance publish may include a PWA fee surcharge above canonical maxCharge', async () => {
    const { blockchain, vault, capsule, user } = await deployBoundPair();
    await registerKeys(vault, user);
    const canonicalMaxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);

    await publishPrivate(blockchain, vault, user, canonicalMaxCharge + 2_000_000n);

    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
    expect((await capsule.getGetState()).private_latest_id).toBe(1n);
    expect((await capsule.getGetState()).accrued_plato_fee_ton).toBe(PLATO_PRIVATE_STANDARD_FEE_TON);
  });

  it('VAULT-CAPSULE-DUST-01: after 15% distribution, discounted Vault fee dust flushes from CapsuleHub into real FeeAccumulator', async () => {
    const { blockchain, deployer, vault, capsule, feeAccumulator, officialAthWallet, user } = await deployBoundPair({
      airdropRemaining: AIRDROP_DISCOUNT_UNLOCK_REMAINING,
    });
    await registerKeys(vault, user);
    await vault.send(blockchain.sender(officialAthWallet), { value: toNano('0.03') }, {
      $$type: 'AthTransferNotification',
      query_id: 9001n,
      amount: ATH_FULL_DISCOUNT_AMOUNT - 1n,
      sender_key: 1n,
      sender_wallet: user.address,
    } as AthTransferNotification);

    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
    await publishPrivate(blockchain, vault, user, maxCharge);
    expect((await capsule.getGetState()).accrued_plato_fee_ton).toBe(1n);

    await capsule.send(deployer.getSender(), { value: CAPSULEHUB_FEE_FLUSH_CALLER_RESERVE }, {
      $$type: 'FlushFees',
      amount: 1n,
    } as FlushFees);

    expect((await capsule.getGetState()).accrued_plato_fee_ton).toBe(0n);
    expect((await feeAccumulator.getGetState()).accumulated_ton).toBe(1n);
  });

  it('VAULT-M6-02: bounced CapsuleHub publish clears PendingPublish without activity airdrop', async () => {
    const { blockchain, vault, user } = await deployBounceVault();
    await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
    const beforeUser = await vault.getGetUser(user.address);
    const beforeGlobal = await vault.getGetGlobal();

    await publishPrivate(blockchain, vault, user, maxCharge);

    const afterUser = await vault.getGetUser(user.address);
    const vg = await vault.getGetGlobal();
    expect(vg.pending_publish_count).toBe(0n);
    expect(afterUser.ath_balance).toBe(beforeUser.ath_balance);
    expect(vg.airdrop_remaining_ath).toBe(beforeGlobal.airdrop_remaining_ath);
    expect(vg.airdrop_distributed_ath).toBe(beforeGlobal.airdrop_distributed_ath);
  });

  it('VAULT-M6-03: signed Vault-balance publish spends internal TON and refunds ACK value back into Vault balance', async () => {
    const { blockchain, vault, capsule, user } = await deployBoundPair();
    const keyPair = await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
    const deposit = maxCharge * 3n;
    await vault.send(user.getSender(), { value: deposit + 12_000_000n }, {
      $$type: 'DepositTon',
      amount: deposit,
    });

    const before = await vault.getGetUser(user.address);
    await blockchain.sendMessage(external({
      to: vault.address,
      body: signedPrivatePublishBody(user.address, before.publish_nonce, maxCharge, keyPair.secretKey),
    }));

    const after = await vault.getGetUser(user.address);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
    expect((await capsule.getGetState()).private_latest_id).toBe(1n);
    expect(after.publish_nonce).toBe(before.publish_nonce + 1n);
    expect(after.ath_balance).toBe(before.ath_balance + AIRDROP_REWARD_PER_MESSAGE);
    expect(after.ton_balance).toBe(before.ton_balance - maxCharge + 28_000_000n);
  });

  it('VAULT-M6-04: signed Vault-balance publish rejects replay without debiting internal TON', async () => {
    const { blockchain, vault, user } = await deployBoundPair();
    const keyPair = await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
    const deposit = maxCharge * 2n;
    await vault.send(user.getSender(), { value: deposit + 12_000_000n }, {
      $$type: 'DepositTon',
      amount: deposit,
    });
    const message = signedPrivatePublishBody(user.address, 0n, maxCharge, keyPair.secretKey);

    await blockchain.sendMessage(external({ to: vault.address, body: message }));
    const afterFirst = await vault.getGetUser(user.address);
    await expect(blockchain.sendMessage(external({ to: vault.address, body: message }))).rejects.toMatchObject({
      exitCode: 16453,
    });
    const afterReplay = await vault.getGetUser(user.address);

    expect(afterReplay.publish_nonce).toBe(afterFirst.publish_nonce);
    expect(afterReplay.ton_balance).toBe(afterFirst.ton_balance);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });

  it('VAULT-M20X-01: before 15% distribution, activity rewards do not reduce the next message fee', async () => {
    const { blockchain, vault, user } = await deployBoundPair();
    await registerKeys(vault, user);

    const maxCharge1 = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
    await publishPrivate(blockchain, vault, user, maxCharge1);
    let userAfter = await vault.getGetUser(user.address);
    let globalAfter = await vault.getGetGlobal();
    expect(userAfter.ath_balance).toBe(AIRDROP_REWARD_PER_MESSAGE);
    expect(globalAfter.airdrop_distributed_ath).toBe(AIRDROP_REWARD_PER_MESSAGE);

    const maxCharge2 = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
    expect(maxCharge2).toBe(maxCharge1);
    await publishPrivate(blockchain, vault, user, maxCharge2);
    userAfter = await vault.getGetUser(user.address);
    globalAfter = await vault.getGetGlobal();
    expect(userAfter.ath_balance).toBe(AIRDROP_REWARD_PER_MESSAGE * 2n);
    expect(globalAfter.airdrop_distributed_ath).toBe(AIRDROP_REWARD_PER_MESSAGE * 2n);
  });

  it('VAULT-M20X-02: after 15% distribution, activity ATH reduces the canonical message fee', async () => {
    const { blockchain, vault, user } = await deployBoundPair({
      airdropRemaining: AIRDROP_DISCOUNT_UNLOCK_REMAINING,
    });
    await registerKeys(vault, user);

    const maxCharge1 = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
    await publishPrivate(blockchain, vault, user, maxCharge1);

    const maxCharge2 = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_CLASSICAL);
    expect(maxCharge2).toBeLessThan(maxCharge1);
  });
});
