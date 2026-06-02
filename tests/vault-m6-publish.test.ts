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
import { hybridMessagingKeyFields } from './helpers/vault-hybrid-key';

const GENESIS_HASH = 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefn;
const MANIFEST_HASH = 0x777788889999aaaabbbbccccddddeeeeffff0000111122223333444455556666n;
const KIND_PRIVATE = 1n;
const KIND_PUBLIC = 2n;
const SIZE_STANDARD = 1n;
const PRIVATE_SIZE_CLASSES = [1n, 2n, 4n, 8n, 16n, 32n] as const;
const SUITE_PUBLIC_NONE = 0n;
const SUITE_HYBRID = 2n;
const PLATO_PRIVATE_HYBRID_FEE_TON = 10_000_000n;
const PLATO_PUBLIC_POST_FEE_TON = 10_000_000n;
const ATH_FULL_DISCOUNT_AMOUNT = 10_000_000_000_000n;
const AIRDROP_TOTAL = 15_000_000_000_000_000n;
const AIRDROP_DISCOUNT_UNLOCK_REMAINING = 0n;
const AIRDROP_REWARD_PER_MESSAGE = 10_000_000_000n;
const VAULT_SUCCESSFUL_PUBLISH_REFUND = 25_800_000n;
const CAPSULEHUB_FEE_FLUSH_CALLER_RESERVE = 4_000_000n;
const VAULT_PUBLISH_PUBLIC_LOCAL_EXEC_RESERVE = 8_700_000n;
const VAULT_PUBLISH_SIGNING_DOMAIN = 0x56504231n;

const BODY_CELL = finalPrivateBodyCell();
const HEADER0_CELL = finalPrivateHeader0Cell();
const HEADER1_CELL = finalPrivateHeader1Cell();
const BODY_HASH = cellHash(BODY_CELL);
const HEADER0 = cellHash(HEADER0_CELL);
const HEADER1 = cellHash(HEADER1_CELL);
const PUBLIC_HEADER_CELL = beginCell().storeBuffer(Buffer.from('PPH1:post')).endCell();
const PUBLIC_BODY_CELL = beginCell().storeBuffer(Buffer.from('public capsule body')).endCell();
const PUBLIC_HEADER_HASH = cellHash(PUBLIC_HEADER_CELL);
const PUBLIC_BODY_HASH = cellHash(PUBLIC_BODY_CELL);

function cellHash(cell: Cell): bigint {
  return BigInt('0x' + cell.hash().toString('hex'));
}

function addressHash(address: Address): bigint {
  return BigInt('0x' + address.hash.toString('hex'));
}

function addressCellHash(address: Address): bigint {
  return BigInt('0x' + beginCell().storeAddress(address).endCell().hash().toString('hex'));
}

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
}

async function deriveAthWallet(owner: Address, athMasterAddress: Address): Promise<Address> {
  const walletInit = await ATHWallet.init(0n, owner, athMasterAddress);
  return contractAddress(owner.workChain, walletInit);
}

async function contractBalance(blockchain: Blockchain, address: Address): Promise<bigint> {
  return (await blockchain.getContract(address)).balance;
}

async function vaultTonBackingMargin(blockchain: Blockchain, vault: any, owner: Address): Promise<bigint> {
  const user = await vault.getGetUser(owner);
  return (await contractBalance(blockchain, vault.address)) - user.ton_balance;
}

async function capsuleFeeBackingMargin(blockchain: Blockchain, capsule: any): Promise<bigint> {
  const state = await capsule.getGetState();
  return (await contractBalance(blockchain, capsule.address)) - state.accrued_plato_fee_ton;
}

async function deployBoundPair(options: { airdropRemaining?: bigint } = {}) {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const deployer = await blockchain.treasury('m6-deployer');
  const user = await blockchain.treasury('m6-user');
  const feeTreasury = await blockchain.treasury('m6-fee-treasury');
  const buybackReceiver = fixtureAddress('M6_BUYBACK_RECEIVER');

  const vaultInit = await Vault.init(deployer.address, deployer.address, fixtureAddress('M6_UNBOUND_CAPSULE_PLACEHOLDER'), addressCellHash(deployer.address), false, false, 0n);
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
    $$type: 'BindProfileRegistry',
    deployment_manifest_hash: MANIFEST_HASH,
    profile_registry_address: fixtureAddress('M6_PROFILE_REGISTRY'),
  } as VaultBindProfile);
  await vault.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindUsernameRegistry',
    deployment_manifest_hash: MANIFEST_HASH,
    username_registry_address: fixtureAddress('M6_USERNAME_REGISTRY'),
  } as VaultBindUsername);
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
      profile_registry_address: fixtureAddress('M6_PROFILE_REGISTRY'),
      username_registry_address: fixtureAddress('M6_USERNAME_REGISTRY'),
      binding_flags: 7n,
      sealed: true,
      deployment_manifest_hash: MANIFEST_HASH,
      genesis_config_hash: options.airdropRemaining,
      users: Dictionary.empty(),
      key_records: Dictionary.empty(),
      receive_intents: Dictionary.empty(),
      processed_ath_deposits: Dictionary.empty(),
      pending_ath_withdrawals: Dictionary.empty(),
      pending_publishes: Dictionary.empty(),
      pending_profile_avatar_payments: Dictionary.empty(),
      pending_username_mint_payments: Dictionary.empty(),
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
  await vault.send(user.getSender(), { value: toNano('0.05') }, {
    $$type: 'RegisterMessagingKeys',
    ...hybridMessagingKeyFields(1n, BigInt('0x' + keyPair.publicKey.toString('hex'))),
  } as RegisterMessagingKeys);
  return keyPair;
}

async function topUpVaultTon(vault: any, user: any, amount: bigint) {
  await vault.send(user.getSender(), { value: amount + 12_000_000n }, {
    $$type: 'DepositTon',
    amount,
  });
}

type SignedPrivatePublishOverrides = {
  signature?: Buffer;
  payload?: Cell;
  manifestHash?: bigint;
  vaultAddress?: Address;
  publishKind?: bigint;
  sizeClass?: bigint;
  header0?: Cell;
  header1?: Cell;
  body?: Cell;
};

async function publishPrivate(blockchain: Blockchain, vault: any, user: any, maxCharge: bigint, overrides: SignedPrivatePublishOverrides = {}) {
  let userState = await vault.getGetUser(user.address);
  if (userState.ton_balance < maxCharge) {
    await topUpVaultTon(vault, user, maxCharge * 2n);
    userState = await vault.getGetUser(user.address);
  }
  const keyPair = keyPairFromSeed(Buffer.alloc(32, 7));
  await blockchain.sendMessage(external({
    to: vault.address,
    body: signedPrivatePublishBody(user.address, userState.publish_nonce, maxCharge, keyPair.secretKey, {
      vaultAddress: vault.address,
      ...overrides,
    }),
  }));
}

async function publishPublic(blockchain: Blockchain, vault: any, user: any, maxCharge: bigint) {
  let userState = await vault.getGetUser(user.address);
  if (userState.ton_balance < maxCharge) {
    await topUpVaultTon(vault, user, maxCharge * 2n);
    userState = await vault.getGetUser(user.address);
  }
  const keyPair = keyPairFromSeed(Buffer.alloc(32, 7));
  await blockchain.sendMessage(external({
    to: vault.address,
    body: signedPublicPublishBody(user.address, userState.publish_nonce, maxCharge, keyPair.secretKey, {
      vaultAddress: vault.address,
    }),
  }));
}

function signedPrivatePublishBody(owner: Address, nonce: bigint, maxCharge: bigint, secretKey: Buffer, overrides: SignedPrivatePublishOverrides = {}): Cell {
  if (!overrides.vaultAddress) {
    throw new Error('vaultAddress is required for signed publish test body');
  }
  const sizeClass = overrides.sizeClass ?? SIZE_STANDARD;
  const header0 = overrides.header0 ?? HEADER0_CELL;
  const header1 = overrides.header1 ?? HEADER1_CELL;
  const body = overrides.body ?? BODY_CELL;
  const payload = overrides.payload ?? beginCell()
    .storeUint(sizeClass, 8)
    .storeUint(SUITE_HYBRID, 8)
    .storeUint(cellHash(header0), 256)
    .storeUint(cellHash(header1), 256)
    .storeUint(cellHash(body), 256)
    .storeRef(header0)
    .storeRef(header1)
    .storeRef(body)
    .endCell();
  const signedDataCell = beginCell()
    .storeUint(VAULT_PUBLISH_SIGNING_DOMAIN, 32)
    .storeUint(overrides.manifestHash ?? MANIFEST_HASH, 256)
    .storeUint(addressHash(overrides.vaultAddress), 256)
    .storeUint(overrides.publishKind ?? KIND_PRIVATE, 8)
    .storeUint(addressHash(owner), 256)
    .storeUint(nonce, 64)
    .storeUint(maxCharge, 128)
    .storeUint(sizeClass, 8)
    .storeUint(SUITE_HYBRID, 8)
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

function signedPublicPublishBody(
  owner: Address,
  nonce: bigint,
  maxCharge: bigint,
  secretKey: Buffer,
  overrides: { signature?: Buffer; header?: Cell; body?: Cell; payload?: Cell; manifestHash?: bigint; vaultAddress?: Address; publishKind?: bigint } = {},
): Cell {
  if (!overrides.vaultAddress) {
    throw new Error('vaultAddress is required for signed publish test body');
  }
  const header = overrides.header ?? PUBLIC_HEADER_CELL;
  const body = overrides.body ?? PUBLIC_BODY_CELL;
  const payload = overrides.payload ?? beginCell()
    .storeUint(cellHash(header), 256)
    .storeUint(cellHash(body), 256)
    .storeRef(header)
    .storeRef(body)
    .endCell();
  const signedDataCell = beginCell()
    .storeUint(VAULT_PUBLISH_SIGNING_DOMAIN, 32)
    .storeUint(overrides.manifestHash ?? MANIFEST_HASH, 256)
    .storeAddress(overrides.vaultAddress)
    .storeUint(overrides.publishKind ?? KIND_PUBLIC, 8)
    .storeAddress(owner)
    .storeUint(nonce, 64)
    .storeUint(maxCharge, 128)
    .storeRef(payload)
    .endCell();
  const signature = overrides.signature ?? sign(signedDataCell.hash(), secretKey);
  return beginCell()
    .storeUint(0x7E1F5032, 32)
    .storeAddress(owner)
    .storeBuffer(signature)
    .storeRef(signedDataCell)
    .endCell();
}

function publicBodyCellChain(cells: number): Cell {
  if (cells <= 1) {
    return beginCell().storeUint(1, 8).endCell();
  }
  return beginCell().storeUint(1, 8).storeRef(publicBodyCellChain(cells - 1)).endCell();
}

describe('Vault milestone 6: Vault-balance publish orchestration', () => {
  it('VAULT-M6-01: signed Vault-balance publish reaches CapsuleHub, receives ACK, and clears PendingPublish', async () => {
    const { blockchain, vault, capsule, user } = await deployBoundPair();
    await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_HYBRID);
    const beforeUser = await vault.getGetUser(user.address);
    const beforeGlobal = await vault.getGetGlobal();

    await publishPrivate(blockchain, vault, user, maxCharge);

    const afterUser = await vault.getGetUser(user.address);
    const vg = await vault.getGetGlobal();
    const cs = await capsule.getGetState();

    expect(vg.pending_publish_count).toBe(0n);
    expect(cs.private_latest_id).toBe(1n);
    expect(cs.accrued_plato_fee_ton).toBe(PLATO_PRIVATE_HYBRID_FEE_TON);
    const stored = await capsule.getGetPrivateEntry(0n);
    expect(stored.exists).toBe(true);
    expect(stored.body_hash).toBe(BODY_HASH);
    expect(stored.header_0.hash().toString('hex')).toBe(HEADER0_CELL.hash().toString('hex'));
    expect(stored.header_1.hash().toString('hex')).toBe(HEADER1_CELL.hash().toString('hex'));
    expect(stored.page_id).toBe(0n);
    expect(stored.page_offset).toBe(0n);
    expect((await capsule.getGetPrivatePage(0n)).entry_count).toBe(1n);
    expect(beforeGlobal.airdrop_remaining_ath).toBe(AIRDROP_TOTAL);
    expect(afterUser.ath_balance).toBe(beforeUser.ath_balance + AIRDROP_REWARD_PER_MESSAGE);
    expect(vg.airdrop_remaining_ath).toBe(AIRDROP_TOTAL - AIRDROP_REWARD_PER_MESSAGE);
    expect(vg.airdrop_distributed_ath).toBe(AIRDROP_REWARD_PER_MESSAGE);
  });

  it('VAULT-M6-01B: signed Vault-balance publish may include a PWA fee surcharge above canonical maxCharge', async () => {
    const { blockchain, vault, capsule, user } = await deployBoundPair();
    await registerKeys(vault, user);
    const canonicalMaxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_HYBRID);
    const surcharge = 2_000_000n;
    await topUpVaultTon(vault, user, (canonicalMaxCharge + surcharge) * 2n);
    const beforeUser = await vault.getGetUser(user.address);

    await publishPrivate(blockchain, vault, user, canonicalMaxCharge + surcharge);

    const afterUser = await vault.getGetUser(user.address);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
    expect((await capsule.getGetState()).private_latest_id).toBe(1n);
    expect((await capsule.getGetState()).accrued_plato_fee_ton).toBe(PLATO_PRIVATE_HYBRID_FEE_TON);
    expect(afterUser.ton_balance).toBe(beforeUser.ton_balance - canonicalMaxCharge - surcharge + VAULT_SUCCESSFUL_PUBLISH_REFUND);
  });

  it('VAULT-M6-01C: canonical private publish charges scale by final 1-32 KiB size classes', async () => {
    const { vault, user } = await deployBoundPair();
    await registerKeys(vault, user);

    const expected = new Map<bigint, bigint>([
      [1n, 60_500_000n],
      [2n, 62_400_000n],
      [4n, 66_100_000n],
      [8n, 73_700_000n],
      [16n, 89_000_000n],
      [32n, 119_500_000n],
    ]);

    for (const [sizeClass, maxCharge] of expected.entries()) {
      await expect(vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, sizeClass, SUITE_HYBRID))
        .resolves.toBe(maxCharge);
    }
  });

  it('VAULT-M6-01D: successful 1-32 KiB private publishes preserve raw Vault and CapsuleHub backing margins', async () => {
    const { blockchain, vault, capsule, user } = await deployBoundPair();
    await registerKeys(vault, user);

    for (const [index, sizeClass] of PRIVATE_SIZE_CLASSES.entries()) {
      const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, sizeClass, SUITE_HYBRID);
      await topUpVaultTon(vault, user, maxCharge);

      const body = finalPrivateBodyCell(sizeClass, 0x62 + index);
      const beforeVaultMargin = await vaultTonBackingMargin(blockchain, vault, user.address);
      const beforeCapsuleMargin = await capsuleFeeBackingMargin(blockchain, capsule);
      const beforeUser = await vault.getGetUser(user.address);
      const beforeGlobal = await vault.getGetGlobal();

      await publishPrivate(blockchain, vault, user, maxCharge, {
        sizeClass,
        body,
      });

      const afterVaultMargin = await vaultTonBackingMargin(blockchain, vault, user.address);
      const afterCapsuleMargin = await capsuleFeeBackingMargin(blockchain, capsule);
      const afterUser = await vault.getGetUser(user.address);
      const afterGlobal = await vault.getGetGlobal();
      const stored = await capsule.getGetPrivateEntry(BigInt(index));

      expect(afterGlobal.pending_publish_count).toBe(0n);
      expect(afterUser.ath_balance, `size ${sizeClass} ATH reward`).toBe(beforeUser.ath_balance + AIRDROP_REWARD_PER_MESSAGE);
      expect(afterGlobal.airdrop_distributed_ath, `size ${sizeClass} distributed`).toBe(beforeGlobal.airdrop_distributed_ath + AIRDROP_REWARD_PER_MESSAGE);
      expect(afterGlobal.airdrop_remaining_ath, `size ${sizeClass} remaining`).toBe(beforeGlobal.airdrop_remaining_ath - AIRDROP_REWARD_PER_MESSAGE);
      expect(stored.exists).toBe(true);
      expect(stored.body_hash).toBe(cellHash(body));
      expect(afterVaultMargin).toBeGreaterThanOrEqual(beforeVaultMargin);
      expect(afterCapsuleMargin).toBeGreaterThanOrEqual(beforeCapsuleMargin);
    }
  });

  it('VAULT-CAPSULE-PUBLIC-01: signed public Vault-balance publish stores header index and clears pending after ACK', async () => {
    const { blockchain, vault, capsule, user } = await deployBoundPair();
    await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PUBLIC, SIZE_STANDARD, SUITE_PUBLIC_NONE);
    const beforeUser = await vault.getGetUser(user.address);

    await publishPublic(blockchain, vault, user, maxCharge);

    const afterUser = await vault.getGetUser(user.address);
    const vg = await vault.getGetGlobal();
    const cs = await capsule.getGetState();
    const stored = await capsule.getGetPublicEntry(0n);

    expect(vg.pending_publish_count).toBe(0n);
    expect(cs.public_latest_id).toBe(1n);
    expect(cs.private_latest_id).toBe(0n);
    expect(cs.accrued_plato_fee_ton).toBe(PLATO_PUBLIC_POST_FEE_TON);
    expect(stored.exists).toBe(true);
    expect(stored.author_wallet.toString()).toBe(user.address.toString());
    expect(stored.header_hash).toBe(PUBLIC_HEADER_HASH);
    expect(stored.body_hash).toBe(PUBLIC_BODY_HASH);
    expect(stored.header.hash().toString('hex')).toBe(PUBLIC_HEADER_CELL.hash().toString('hex'));
    expect(stored.page_id).toBe(0n);
    expect(stored.page_offset).toBe(0n);
    expect((await capsule.getGetPublicPage(0n)).entry_count).toBe(1n);
    expect(afterUser.ath_balance).toBe(beforeUser.ath_balance + AIRDROP_REWARD_PER_MESSAGE);
  });

  it('VAULT-CAPSULE-PUBLIC-01B: public publish surcharge is retained as CapsuleHub reserve overage', async () => {
    const { blockchain, vault, capsule, user } = await deployBoundPair();
    await registerKeys(vault, user);
    const canonicalMaxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PUBLIC, SIZE_STANDARD, SUITE_PUBLIC_NONE);
    const surcharge = 2_000_000n;
    await topUpVaultTon(vault, user, (canonicalMaxCharge + surcharge) * 2n);
    const beforeUser = await vault.getGetUser(user.address);

    await publishPublic(blockchain, vault, user, canonicalMaxCharge + surcharge);

    const afterUser = await vault.getGetUser(user.address);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
    expect((await capsule.getGetState()).public_latest_id).toBe(1n);
    expect((await capsule.getGetState()).accrued_plato_fee_ton).toBe(PLATO_PUBLIC_POST_FEE_TON);
    expect(afterUser.ton_balance).toBe(beforeUser.ton_balance - canonicalMaxCharge - surcharge + VAULT_SUCCESSFUL_PUBLISH_REFUND);
  });

  it('VAULT-CAPSULE-PUBLIC-02: malformed public header is rejected inside Vault before CapsuleHub mutation', async () => {
    const { blockchain, vault, capsule, user } = await deployBoundPair();
    const keyPair = await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PUBLIC, SIZE_STANDARD, SUITE_PUBLIC_NONE);
    await topUpVaultTon(vault, user, maxCharge * 2n);
    const beforeUser = await vault.getGetUser(user.address);
    const beforeGlobal = await vault.getGetGlobal();
    const invalidHeader = beginCell()
      .storeBuffer(Buffer.from('PPH1'))
      .storeRef(beginCell().storeUint(1, 1).endCell())
      .endCell();

    await blockchain.sendMessage(external({
      to: vault.address,
      body: signedPublicPublishBody(user.address, beforeUser.publish_nonce, maxCharge, keyPair.secretKey, {
        vaultAddress: vault.address,
        header: invalidHeader,
        body: PUBLIC_BODY_CELL,
      }),
    }));

    const afterUser = await vault.getGetUser(user.address);
    const afterGlobal = await vault.getGetGlobal();
    const capsuleState = await capsule.getGetState();

    expect(afterUser.publish_nonce).toBe(beforeUser.publish_nonce + 1n);
    expect(afterUser.ton_balance).toBe(beforeUser.ton_balance - VAULT_PUBLISH_PUBLIC_LOCAL_EXEC_RESERVE);
    expect(afterUser.ath_balance).toBe(beforeUser.ath_balance);
    expect(afterGlobal.pending_publish_count).toBe(beforeGlobal.pending_publish_count);
    expect(afterGlobal.airdrop_distributed_ath).toBe(beforeGlobal.airdrop_distributed_ath);
    expect(capsuleState.public_latest_id).toBe(0n);
    expect(capsuleState.accrued_plato_fee_ton).toBe(0n);
  });

  it('VAULT-CAPSULE-PUBLIC-03: malformed public body is rejected inside Vault before CapsuleHub mutation', async () => {
    const { blockchain, vault, capsule, user } = await deployBoundPair();
    const keyPair = await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PUBLIC, SIZE_STANDARD, SUITE_PUBLIC_NONE);
    await topUpVaultTon(vault, user, maxCharge * 2n);
    const beforeUser = await vault.getGetUser(user.address);
    const invalidBody = publicBodyCellChain(10);
    const unalignedBody = beginCell().storeUint(1, 1).endCell();

    await blockchain.sendMessage(external({
      to: vault.address,
      body: signedPublicPublishBody(user.address, beforeUser.publish_nonce, maxCharge, keyPair.secretKey, {
        vaultAddress: vault.address,
        header: PUBLIC_HEADER_CELL,
        body: invalidBody,
      }),
    }));
    await blockchain.sendMessage(external({
      to: vault.address,
      body: signedPublicPublishBody(user.address, beforeUser.publish_nonce + 1n, maxCharge, keyPair.secretKey, {
        vaultAddress: vault.address,
        header: PUBLIC_HEADER_CELL,
        body: unalignedBody,
      }),
    }));

    const afterUser = await vault.getGetUser(user.address);
    const capsuleState = await capsule.getGetState();

    expect(afterUser.publish_nonce).toBe(beforeUser.publish_nonce + 2n);
    expect(afterUser.ton_balance).toBe(beforeUser.ton_balance - (VAULT_PUBLISH_PUBLIC_LOCAL_EXEC_RESERVE * 2n));
    expect(afterUser.ath_balance).toBe(beforeUser.ath_balance);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
    expect(capsuleState.public_latest_id).toBe(0n);
    expect(capsuleState.accrued_plato_fee_ton).toBe(0n);
  });

  it('VAULT-CAPSULE-DUST-01: after discount unlock, one atomic ATH below full threshold leaves one nanotON fee and flushes', async () => {
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

    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_HYBRID);
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
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_HYBRID);
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
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_HYBRID);
    const deposit = maxCharge * 3n;
    await vault.send(user.getSender(), { value: deposit + 12_000_000n }, {
      $$type: 'DepositTon',
      amount: deposit,
    });

    const before = await vault.getGetUser(user.address);
    await blockchain.sendMessage(external({
      to: vault.address,
      body: signedPrivatePublishBody(user.address, before.publish_nonce, maxCharge, keyPair.secretKey, {
        vaultAddress: vault.address,
      }),
    }));

    const after = await vault.getGetUser(user.address);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
    expect((await capsule.getGetState()).private_latest_id).toBe(1n);
    expect(after.publish_nonce).toBe(before.publish_nonce + 1n);
    expect(after.ath_balance).toBe(before.ath_balance + AIRDROP_REWARD_PER_MESSAGE);
    expect(after.ton_balance).toBe(before.ton_balance - maxCharge + VAULT_SUCCESSFUL_PUBLISH_REFUND);
  });

  it('VAULT-M6-04: signed Vault-balance publish rejects replay without debiting internal TON', async () => {
    const { blockchain, vault, user } = await deployBoundPair();
    const keyPair = await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_HYBRID);
    const deposit = maxCharge * 2n;
    await vault.send(user.getSender(), { value: deposit + 12_000_000n }, {
      $$type: 'DepositTon',
      amount: deposit,
    });
    const message = signedPrivatePublishBody(user.address, 0n, maxCharge, keyPair.secretKey, {
      vaultAddress: vault.address,
    });

    await blockchain.sendMessage(external({ to: vault.address, body: message }));
    const afterFirst = await vault.getGetUser(user.address);
    const rawAfterFirst = await contractBalance(blockchain, vault.address);
    await expect(blockchain.sendMessage(external({ to: vault.address, body: message })))
      .rejects.toMatchObject({ exitCode: 16453 });
    const afterReplay = await vault.getGetUser(user.address);
    const rawAfterReplay = await contractBalance(blockchain, vault.address);

    expect(afterReplay.publish_nonce).toBe(afterFirst.publish_nonce);
    expect(afterReplay.ton_balance).toBe(afterFirst.ton_balance);
    expect(rawAfterReplay).toBe(rawAfterFirst);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });

  it('VAULT-M6-04B: signed public publish replay does not burn raw Vault balance', async () => {
    const { blockchain, vault, user } = await deployBoundPair();
    const keyPair = await registerKeys(vault, user);
    const maxCharge = await vault.getGetCanonicalPublishCharge(user.address, KIND_PUBLIC, SIZE_STANDARD, SUITE_PUBLIC_NONE);
    const deposit = maxCharge * 2n;
    await vault.send(user.getSender(), { value: deposit + 12_000_000n }, {
      $$type: 'DepositTon',
      amount: deposit,
    });
    const message = signedPublicPublishBody(user.address, 0n, maxCharge, keyPair.secretKey, {
      vaultAddress: vault.address,
    });

    await blockchain.sendMessage(external({ to: vault.address, body: message }));
    const afterFirst = await vault.getGetUser(user.address);
    const rawAfterFirst = await contractBalance(blockchain, vault.address);
    await expect(blockchain.sendMessage(external({ to: vault.address, body: message })))
      .rejects.toMatchObject({ exitCode: 16483 });
    const afterReplay = await vault.getGetUser(user.address);
    const rawAfterReplay = await contractBalance(blockchain, vault.address);

    expect(afterReplay.publish_nonce).toBe(afterFirst.publish_nonce);
    expect(afterReplay.ton_balance).toBe(afterFirst.ton_balance);
    expect(rawAfterReplay).toBe(rawAfterFirst);
    expect((await vault.getGetGlobal()).pending_publish_count).toBe(0n);
  });

  it('VAULT-M20X-01: before 15% distribution, activity rewards do not reduce the next message fee', async () => {
    const { blockchain, vault, user } = await deployBoundPair();
    await registerKeys(vault, user);

    const maxCharge1 = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_HYBRID);
    await publishPrivate(blockchain, vault, user, maxCharge1);
    let userAfter = await vault.getGetUser(user.address);
    let globalAfter = await vault.getGetGlobal();
    expect(userAfter.ath_balance).toBe(AIRDROP_REWARD_PER_MESSAGE);
    expect(globalAfter.airdrop_distributed_ath).toBe(AIRDROP_REWARD_PER_MESSAGE);

    const maxCharge2 = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_HYBRID);
    expect(maxCharge2).toBe(maxCharge1);
    await publishPrivate(blockchain, vault, user, maxCharge2);
    userAfter = await vault.getGetUser(user.address);
    globalAfter = await vault.getGetGlobal();
    expect(userAfter.ath_balance).toBe(AIRDROP_REWARD_PER_MESSAGE * 2n);
    expect(globalAfter.airdrop_distributed_ath).toBe(AIRDROP_REWARD_PER_MESSAGE * 2n);
  });

  it('VAULT-M20X-02: after 15% distribution, held ATH reduces the canonical message fee', async () => {
    const { blockchain, vault, user, officialAthWallet } = await deployBoundPair({
      airdropRemaining: AIRDROP_DISCOUNT_UNLOCK_REMAINING,
    });
    await registerKeys(vault, user);

    const maxCharge1 = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_HYBRID);
    await vault.send(blockchain.sender(officialAthWallet), { value: toNano('0.03') }, {
      $$type: 'AthTransferNotification',
      query_id: 9002n,
      amount: AIRDROP_REWARD_PER_MESSAGE,
      sender_key: 1n,
      sender_wallet: user.address,
    } as AthTransferNotification);

    const maxCharge2 = await vault.getGetCanonicalPublishCharge(user.address, KIND_PRIVATE, SIZE_STANDARD, SUITE_HYBRID);
    expect(maxCharge2).toBeLessThan(maxCharge1);
  });
});
