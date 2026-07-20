import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
import { createHash } from 'crypto';
import {
  ATHBurnFinalized,
  ATHBurnFailed,
  ATHTransferAck,
  ATHTransferFailed,
  AthTransferNotificationRegistryProfileAvatar,
  BindProfileOfficialAthWallet,
  FlushProfileBurnAthDue,
  FlushProfileTreasuryAthDue,
  ProfileRegistry,
  SealGenesis,
} from '../build/ProfileRegistry/ProfileRegistry_ProfileRegistry';
import { MockAthWalletNoAck } from '../build/MockAthWalletNoAck/MockAthWalletNoAck_MockAthWalletNoAck';
import { ATHMaster } from '../build/ATHMaster/ATHMaster_ATHMaster';
import {
  ATHWallet,
  ATHTransferRequestRegistryProfileAvatar,
} from '../build/ATHWallet/ATHWallet_ATHWallet';

const MANIFEST_HASH = 0x50524f46494c45524547495354525900000000000000000000000000000001n;
const PROFILE_AVATAR_PRICE_ATH = 100_000_000_000n;
const HALF_AVATAR_PRICE_ATH = 50_000_000_000n;
const ATH_TOTAL_SUPPLY_ATOMIC = 100_000_000_000_000_000n;
const ATH_TRANSFER_NOTIFY_ID_DOMAIN = 0x41544E49n;
const ATH_SENDER_KEY_MOD = 1n << 160n;
const OP_ATH_TRANSFER_NOTIFICATION_ACK = 0x472D9D7E;
const OP_ATH_INTERNAL_TRANSFER = 0x41544812;
const OP_PROFILE_AVATAR_VAULT_NOTIFICATION = 0xA11A7002;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.PROFILE.${label}`).digest());
}

function senderKey(senderOwner: Address, queryId: bigint): bigint {
  return BigInt('0x' + beginCell()
    .storeUint(ATH_TRANSFER_NOTIFY_ID_DOMAIN, 32)
    .storeUint(queryId, 64)
    .storeAddress(senderOwner)
    .endCell()
    .hash()
    .toString('hex')) % ATH_SENDER_KEY_MOD;
}

async function deploySealedProfileRegistry() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const deployer = await blockchain.treasury('profile-registry-deployer');
  const placeholderAthWallet = fixtureAddress('PLACEHOLDER_PROFILE_ATH_WALLET');
  const athMasterAddress = fixtureAddress('PROFILE_ATH_MASTER');
  const treasuryAthReceiver = fixtureAddress('PROFILE_TREASURY_ATH_RECEIVER');
  const vaultAddress = fixtureAddress('PROFILE_VAULT');

  const init = await ProfileRegistry.init(
    placeholderAthWallet,
    athMasterAddress,
    treasuryAthReceiver,
    false,
    0n,
    0n,
    deployer.address,
  );
  const address = contractAddress(0, init);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: init.code,
    data: init.data,
    balance: toNano('2'),
    workchain: address.workChain,
  }));
  const registry = blockchain.openContract(new ProfileRegistry(address, init));
  const officialAthWalletAddress = await registry.getGetAthWalletAddress(address);

  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindProfileOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: officialAthWalletAddress,
  } as BindProfileOfficialAthWallet);
  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);

  return { blockchain, registry, officialAthWalletAddress, athMasterAddress, vaultAddress };
}

async function deployProfileRegistryReadyToSeal(options: {
  treasuryAthReceiver: Address;
  vaultAddress?: Address;
  athMasterAddress?: Address;
  forcedRegistryAddress?: Address;
}) {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const deployer = await blockchain.treasury('profile-registry-seal-deployer');
  const placeholderAthWallet = fixtureAddress('SEAL_TREASURY_PLACEHOLDER');
  const athMasterAddress = options.athMasterAddress ?? fixtureAddress('SEAL_TREASURY_ATH_MASTER');
  const vaultAddress = options.vaultAddress ?? fixtureAddress('SEAL_TREASURY_VAULT');

  const init = await ProfileRegistry.init(
    placeholderAthWallet,
    athMasterAddress,
    options.treasuryAthReceiver,
    false,
    0n,
    0n,
    deployer.address,
  );
  const address = options.forcedRegistryAddress ?? contractAddress(0, init);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: init.code,
    data: init.data,
    balance: toNano('2'),
    workchain: address.workChain,
  }));
  const registry = blockchain.openContract(new ProfileRegistry(address, init));
  const officialAthWalletAddress = await registry.getGetAthWalletAddress(address);

  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindProfileOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: officialAthWalletAddress,
  } as BindProfileOfficialAthWallet);

  return { registry, deployer, address, officialAthWalletAddress, athMasterAddress, vaultAddress };
}

async function deployProfileRegistryWithAthSystem(options: { officialWalletBalance: bigint; deployMaster: boolean; mockOfficial?: boolean }) {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const deployer = await blockchain.treasury('profile-registry-ath-deployer');
  const flusher = await blockchain.treasury('profile-registry-ath-flusher');
  const attacker = await blockchain.treasury('profile-registry-ath-attacker');
  const placeholderAthWallet = fixtureAddress('ATH_PROFILE_PLACEHOLDER');
  const treasuryAthReceiver = fixtureAddress('ATH_PROFILE_TREASURY_RECEIVER');
  const vaultAddress = fixtureAddress('ATH_PROFILE_VAULT');
  const masterTreasuryOwner = fixtureAddress('ATH_PROFILE_MASTER_TREASURY');
  const content = beginCell().storeBuffer(Buffer.from('ATH')).endCell();

  const masterInit = await ATHMaster.init(masterTreasuryOwner, content);
  const athMasterAddress = contractAddress(0, masterInit);
  const registryInit = await ProfileRegistry.init(
    placeholderAthWallet,
    athMasterAddress,
    treasuryAthReceiver,
    false,
    0n,
    0n,
    deployer.address,
  );
  const registryAddress = contractAddress(0, registryInit);
  const officialZeroInit = await ATHWallet.init(0n, registryAddress, athMasterAddress);
  const officialBalanceInit = await ATHWallet.init(options.officialWalletBalance, registryAddress, athMasterAddress);
  const officialAthWalletAddress = contractAddress(registryAddress.workChain, officialZeroInit);

  if (options.deployMaster) {
    await blockchain.setShardAccount(athMasterAddress, createShardAccount({
      address: athMasterAddress,
      code: masterInit.code,
      data: masterInit.data,
      balance: toNano('3'),
      workchain: athMasterAddress.workChain,
    }));
  }

  await blockchain.setShardAccount(registryAddress, createShardAccount({
    address: registryAddress,
    code: registryInit.code,
    data: registryInit.data,
    balance: toNano('3'),
    workchain: registryAddress.workChain,
  }));

  if (options.mockOfficial) {
    const mockAthWalletInit = await MockAthWalletNoAck.init();
    await blockchain.setShardAccount(officialAthWalletAddress, createShardAccount({
      address: officialAthWalletAddress,
      code: mockAthWalletInit.code,
      data: mockAthWalletInit.data,
      balance: toNano('3'),
      workchain: officialAthWalletAddress.workChain,
    }));
  } else {
    await blockchain.setShardAccount(officialAthWalletAddress, createShardAccount({
      address: officialAthWalletAddress,
      code: officialZeroInit.code,
      data: officialBalanceInit.data,
      balance: toNano('3'),
      workchain: officialAthWalletAddress.workChain,
    }));
  }

  const registry = blockchain.openContract(new ProfileRegistry(registryAddress, registryInit));
  const officialAthWallet = blockchain.openContract(new ATHWallet(officialAthWalletAddress, officialZeroInit));
  const master = blockchain.openContract(new ATHMaster(athMasterAddress, masterInit));

  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindProfileOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: officialAthWalletAddress,
  } as BindProfileOfficialAthWallet);
  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);

  return {
    blockchain,
    registry,
    officialAthWallet,
    officialAthWalletAddress,
    athMasterAddress,
    master,
    treasuryAthReceiver,
    vaultAddress,
    flusher,
    attacker,
  };
}

function avatarNotification(owner: Address, overrides: Partial<AthTransferNotificationRegistryProfileAvatar> = {}): AthTransferNotificationRegistryProfileAvatar {
  return {
    $$type: 'AthTransferNotificationRegistryProfileAvatar',
    query_id: overrides.query_id ?? 1n,
    amount: overrides.amount ?? PROFILE_AVATAR_PRICE_ATH,
    sender_key: overrides.sender_key ?? 77n,
    payer_wallet: overrides.payer_wallet ?? owner, // clean-16 direct-pay: payer == owner (you pay for your OWN avatar)
    owner_wallet: overrides.owner_wallet ?? owner,
    avatar_hash: overrides.avatar_hash ?? 0xabc123n,
    avatar_entry_id: overrides.avatar_entry_id ?? 0n,
    avatar_stream_id: overrides.avatar_stream_id ?? 0x11223344556677889900aabbccddeeffn,
    avatar_part_count: overrides.avatar_part_count ?? 2n,
    media_format: overrides.media_format ?? 1n,
  };
}

function vaultAvatarNotification(
  payerWallet: Address,
  owner: Address,
  overrides: Partial<AthTransferNotificationRegistryProfileAvatar> = {},
): AthTransferNotificationRegistryProfileAvatar {
  return {
    $$type: 'AthTransferNotificationRegistryProfileAvatar',
    query_id: overrides.query_id ?? 1n,
    amount: overrides.amount ?? PROFILE_AVATAR_PRICE_ATH,
    sender_key: overrides.sender_key ?? senderKey(payerWallet, overrides.query_id ?? 1n),
    payer_wallet: overrides.payer_wallet ?? payerWallet,
    owner_wallet: overrides.owner_wallet ?? owner,
    avatar_hash: overrides.avatar_hash ?? 0xabc123n,
    avatar_entry_id: overrides.avatar_entry_id ?? 0n,
    avatar_stream_id: overrides.avatar_stream_id ?? 0x11223344556677889900aabbccddeeffn,
    avatar_part_count: overrides.avatar_part_count ?? 2n,
    media_format: overrides.media_format ?? 1n,
  };
}

async function sendAcceptedAvatar(
  ctx: Awaited<ReturnType<typeof deployProfileRegistryWithAthSystem>>,
  owner: Address,
  queryId = 1n,
) {
  await ctx.registry.send(ctx.blockchain.sender(ctx.officialAthWalletAddress), { value: toNano('0.08') }, vaultAvatarNotification(owner, owner, {
    query_id: queryId,
  }));
}

async function deployAthWallet(blockchain: Blockchain, owner: Address, athMaster: Address, tokenBalance: bigint) {
  const zeroInit = await ATHWallet.init(0n, owner, athMaster);
  const dataInit = await ATHWallet.init(tokenBalance, owner, athMaster);
  const address = contractAddress(owner.workChain, zeroInit);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: zeroInit.code,
    data: dataInit.data,
    balance: toNano('3'),
    workchain: address.workChain,
  }));
  return blockchain.openContract(new ATHWallet(address, zeroInit));
}

describe('ProfileRegistry wallet avatar pointers', () => {
  it('PROFILE-00: SealGenesis requires the bound official ATH wallet', async () => {
    const blockchain = await Blockchain.create();
    blockchain.now = 1_700_000_000;
    const deployer = await blockchain.treasury('profile-seal-vault-deployer');
    const placeholderAthWallet = fixtureAddress('SEAL_VAULT_PLACEHOLDER');
    const athMasterAddress = fixtureAddress('SEAL_VAULT_ATH_MASTER');
    const treasuryAthReceiver = fixtureAddress('SEAL_VAULT_TREASURY');
    const vaultAddress = fixtureAddress('SEAL_VAULT_BOUND');

    const init = await ProfileRegistry.init(
      placeholderAthWallet,
      athMasterAddress,
      treasuryAthReceiver,
      false,
      0n,
      0n,
      deployer.address,
    );
    const address = contractAddress(0, init);
    await blockchain.setShardAccount(address, createShardAccount({
      address,
      code: init.code,
      data: init.data,
      balance: toNano('2'),
      workchain: address.workChain,
    }));
    const registry = blockchain.openContract(new ProfileRegistry(address, init));
    const officialAthWalletAddress = await registry.getGetAthWalletAddress(address);

    // The seal must refuse while the official ATH wallet is unbound. That wallet is the ONLY thing that
    // authenticates a paying avatar notification, so sealing without it would freeze a registry that can
    // never accept a payment — and after the seal there is no second chance to bind it.
    await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as SealGenesis);

    let global = await registry.getGetGlobal();
    expect(global.sealed, 'unbound official ATH wallet must block the seal').toBe(false);
    expect(global.official_ath_wallet_bound).toBe(false);

    await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'BindProfileOfficialAthWallet',
      deployment_manifest_hash: MANIFEST_HASH,
      official_ath_wallet_address: officialAthWalletAddress,
    } as BindProfileOfficialAthWallet);
    await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as SealGenesis);

    global = await registry.getGetGlobal();
    expect(global.sealed).toBe(true);
  });

  it('PROFILE-00B: SealGenesis rejects protocol-owned treasury ATH receivers', async () => {
    const forcedSelfAddress = fixtureAddress('SEAL_TREASURY_SELF_REGISTRY');
    const selfTreasury = await deployProfileRegistryReadyToSeal({
      treasuryAthReceiver: forcedSelfAddress,
      forcedRegistryAddress: forcedSelfAddress,
    });
    await selfTreasury.registry.send(selfTreasury.deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as SealGenesis);
    expect((await selfTreasury.registry.getGetGlobal()).sealed).toBe(false);

    const forcedOfficialOwner = fixtureAddress('SEAL_TREASURY_OFFICIAL_OWNER');
    const officialWalletInit = await ATHWallet.init(0n, forcedOfficialOwner, fixtureAddress('SEAL_TREASURY_OFFICIAL_MASTER'));
    const officialTreasuryReceiver = contractAddress(forcedOfficialOwner.workChain, officialWalletInit);
    const officialTreasury = await deployProfileRegistryReadyToSeal({
      treasuryAthReceiver: officialTreasuryReceiver,
      athMasterAddress: fixtureAddress('SEAL_TREASURY_OFFICIAL_MASTER'),
      forcedRegistryAddress: forcedOfficialOwner,
    });
    await officialTreasury.registry.send(officialTreasury.deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as SealGenesis);
    expect((await officialTreasury.registry.getGetGlobal()).sealed).toBe(false);

    const athMasterAddress = fixtureAddress('SEAL_TREASURY_AS_ATH_MASTER');
    const masterTreasury = await deployProfileRegistryReadyToSeal({
      treasuryAthReceiver: athMasterAddress,
      athMasterAddress,
    });
    await masterTreasury.registry.send(masterTreasury.deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as SealGenesis);
    expect((await masterTreasury.registry.getGetGlobal()).sealed).toBe(false);
  });

  it('PROFILE-01: accepts paid official avatar notification, stores version, and splits ATH due', async () => {
    const { blockchain, registry, officialAthWalletAddress } = await deploySealedProfileRegistry();
    const owner = fixtureAddress('OWNER_ONE');

    const result = await registry.send(blockchain.sender(officialAthWalletAddress), { value: toNano('0.08') }, avatarNotification(owner));

    const avatar = await registry.getGetAvatar(owner);
    const global = await registry.getGetGlobal();
    expect(avatar.exists).toBe(true);
    expect(avatar.owner_wallet.equals(owner)).toBe(true);
    expect(avatar.version).toBe(1n);
    expect(avatar.avatar_hash).toBe(0xabc123n);
    expect(avatar.avatar_part_count).toBe(2n);
    expect(global.profile_count).toBe(1n);
    expect(global.avatar_record_count).toBe(1n);
    expect(global.treasury_due_ath).toBe(50_000_000_000n);
    expect(global.burn_due_ath).toBe(50_000_000_000n);
    expect(findTransaction(result.transactions, {
      from: registry.address,
      to: officialAthWalletAddress,
      op: OP_ATH_TRANSFER_NOTIFICATION_ACK,
    })).toBeDefined();
  });

  it('PROFILE-02: rejects wrong ATH amount before mutating avatar state', async () => {
    const { blockchain, registry, officialAthWalletAddress } = await deploySealedProfileRegistry();
    const owner = fixtureAddress('WRONG_AMOUNT_OWNER');

    await registry.send(blockchain.sender(officialAthWalletAddress), { value: toNano('0.08') }, avatarNotification(owner, {
      amount: PROFILE_AVATAR_PRICE_ATH - 1n,
    }));

    const avatar = await registry.getGetAvatar(owner);
    const global = await registry.getGetGlobal();
    expect(avatar.exists).toBe(false);
    expect(global.profile_count).toBe(0n);
    expect(global.treasury_due_ath).toBe(0n);
    expect(global.burn_due_ath).toBe(0n);
  });

  it('PROFILE-02B: malformed avatar pointers reject before mutating avatar or due state', async () => {
    const { blockchain, registry, officialAthWalletAddress } = await deploySealedProfileRegistry();
    const owner = fixtureAddress('INVALID_POINTER_OWNER');

    for (const overrides of [
      { avatar_hash: 0n },
      { avatar_stream_id: 0n },
      { avatar_part_count: 0n },
      { avatar_part_count: 3n },
      { media_format: 2n },
      { owner_wallet: fixtureAddress('INVALID_POINTER_MASTERCHAIN_OWNER', -1) },
    ] satisfies Array<Partial<AthTransferNotificationRegistryProfileAvatar>>) {
      await registry.send(blockchain.sender(officialAthWalletAddress), { value: toNano('0.08') }, avatarNotification(owner, overrides));
    }

    const avatar = await registry.getGetAvatar(owner);
    const global = await registry.getGetGlobal();
    expect(avatar.exists).toBe(false);
    expect(global.profile_count).toBe(0n);
    expect(global.avatar_record_count).toBe(0n);
    expect(global.treasury_due_ath).toBe(0n);
    expect(global.burn_due_ath).toBe(0n);
  });

  it('PROFILE-03: increments avatar versions without increasing profile count', async () => {
    const { blockchain, registry, officialAthWalletAddress } = await deploySealedProfileRegistry();
    const owner = fixtureAddress('VERSION_OWNER');

    await registry.send(blockchain.sender(officialAthWalletAddress), { value: toNano('0.08') }, avatarNotification(owner, {
      query_id: 11n,
      avatar_hash: 0x11n,
    }));
    await registry.send(blockchain.sender(officialAthWalletAddress), { value: toNano('0.08') }, avatarNotification(owner, {
      query_id: 12n,
      avatar_hash: 0x22n,
      avatar_stream_id: 0x22223333444455556666777788889999n,
    }));

    const current = await registry.getGetAvatar(owner);
    const first = await registry.getGetAvatarVersion(owner, 1n);
    const global = await registry.getGetGlobal();
    expect(current.version).toBe(2n);
    expect(current.avatar_hash).toBe(0x22n);
    // clean-16 L2/#13: the previous version's record is DELETED on update (only `current` is ever read). Old
    // versions were dead, unbounded state. avatar_records is now O(profiles), net-flat on an update.
    expect(first.exists).toBe(false);
    expect(global.profile_count).toBe(1n);
    expect(global.avatar_record_count).toBe(1n);
  });

  it('PROFILE-04: burn finalization must be for the ProfileRegistry owner address', async () => {
    const { blockchain, registry, officialAthWalletAddress, athMasterAddress } = await deploySealedProfileRegistry();
    const owner = fixtureAddress('BURN_OWNER_CHECK');
    const flusher = await blockchain.treasury('profile-burn-flusher');
    const burnDue = 50_000_000_000n;
    const queryId = 91n;
    const mockAthWalletInit = await MockAthWalletNoAck.init();
    await blockchain.setShardAccount(officialAthWalletAddress, createShardAccount({
      address: officialAthWalletAddress,
      code: mockAthWalletInit.code,
      data: mockAthWalletInit.data,
      balance: toNano('1'),
      workchain: officialAthWalletAddress.workChain,
    }));

    await registry.send(blockchain.sender(officialAthWalletAddress), { value: toNano('0.08') }, avatarNotification(owner));
    await registry.send(flusher.getSender(), { value: toNano('0.05') }, {
      $$type: 'FlushProfileBurnAthDue',
      query_id: queryId,
    } as FlushProfileBurnAthDue);

    let global = await registry.getGetGlobal();
    expect(global.burn_due_ath).toBe(0n);
    expect(global.pending_burn_flush_count).toBe(1n);

    await registry.send(blockchain.sender(athMasterAddress), { value: toNano('0.01') }, {
      $$type: 'ATHBurnFinalized',
      query_id: queryId,
      amount: burnDue,
      owner_address: fixtureAddress('WRONG_BURN_OWNER'),
    } as ATHBurnFinalized);

    global = await registry.getGetGlobal();
    expect(global.burn_due_ath).toBe(0n);
    expect(global.pending_burn_flush_count).toBe(1n);

    await registry.send(blockchain.sender(athMasterAddress), { value: toNano('0.01') }, {
      $$type: 'ATHBurnFinalized',
      query_id: queryId,
      amount: burnDue,
      owner_address: registry.address,
    } as ATHBurnFinalized);

    global = await registry.getGetGlobal();
    expect(global.burn_due_ath).toBe(0n);
    expect(global.pending_burn_flush_count).toBe(0n);
  });

  it('PROFILE-05: treasury flush transfers ATH to the immutable treasury receiver wallet and clears pending on ACK', async () => {
    const ctx = await deployProfileRegistryWithAthSystem({
      officialWalletBalance: PROFILE_AVATAR_PRICE_ATH,
      deployMaster: true,
    });
    const owner = fixtureAddress('TREASURY_FLUSH_OWNER');

    await sendAcceptedAvatar(ctx, owner);
    expect((await ctx.registry.getGetGlobal()).treasury_due_ath).toBe(HALF_AVATAR_PRICE_ATH);

    const treasuryAthWalletAddress = await ctx.registry.getGetAthWalletAddress(ctx.treasuryAthReceiver);
    await ctx.registry.send(ctx.flusher.getSender(), { value: toNano('0.2') }, {
      $$type: 'FlushProfileTreasuryAthDue',
      query_id: 501n,
    } as FlushProfileTreasuryAthDue);

    const treasuryWallet = ctx.blockchain.openContract(new ATHWallet(treasuryAthWalletAddress));
    const global = await ctx.registry.getGetGlobal();
    expect(global.treasury_due_ath).toBe(0n);
    expect(global.pending_treasury_flush_count).toBe(0n);
    expect((await treasuryWallet.getGetWalletData()).balance).toBe(HALF_AVATAR_PRICE_ATH);
    expect((await ctx.officialAthWallet.getGetWalletData()).balance).toBe(HALF_AVATAR_PRICE_ATH);
  });

  it('PROFILE-06: burn flush finalizes through ATHMaster and decreases total supply exactly', async () => {
    const ctx = await deployProfileRegistryWithAthSystem({
      officialWalletBalance: PROFILE_AVATAR_PRICE_ATH,
      deployMaster: true,
    });
    const owner = fixtureAddress('BURN_FLUSH_OWNER');

    await sendAcceptedAvatar(ctx, owner);
    expect((await ctx.registry.getGetGlobal()).burn_due_ath).toBe(HALF_AVATAR_PRICE_ATH);
    expect((await ctx.master.getGetJettonData()).total_supply).toBe(ATH_TOTAL_SUPPLY_ATOMIC);

    await ctx.registry.send(ctx.flusher.getSender(), { value: toNano('0.2') }, {
      $$type: 'FlushProfileBurnAthDue',
      query_id: 601n,
    } as FlushProfileBurnAthDue);

    const global = await ctx.registry.getGetGlobal();
    expect((await ctx.master.getGetJettonData()).total_supply).toBe(ATH_TOTAL_SUPPLY_ATOMIC - HALF_AVATAR_PRICE_ATH);
    expect(global.burn_due_ath).toBe(0n);
    expect(global.pending_burn_flush_count).toBe(0n);
    expect((await ctx.officialAthWallet.getGetWalletData()).balance).toBe(HALF_AVATAR_PRICE_ATH);
  });

  it('PROFILE-07: treasury and burn failures restore due and clear pending state', async () => {
    const treasuryCtx = await deployProfileRegistryWithAthSystem({
      officialWalletBalance: 0n,
      deployMaster: true,
    });
    const treasuryOwner = fixtureAddress('TREASURY_FAIL_OWNER');

    await sendAcceptedAvatar(treasuryCtx, treasuryOwner);
    await treasuryCtx.registry.send(treasuryCtx.flusher.getSender(), { value: toNano('0.2') }, {
      $$type: 'FlushProfileTreasuryAthDue',
      query_id: 701n,
    } as FlushProfileTreasuryAthDue);

    let global = await treasuryCtx.registry.getGetGlobal();
    expect(global.treasury_due_ath).toBe(HALF_AVATAR_PRICE_ATH);
    expect(global.pending_treasury_flush_count).toBe(0n);

    const burnCtx = await deployProfileRegistryWithAthSystem({
      officialWalletBalance: PROFILE_AVATAR_PRICE_ATH,
      deployMaster: false,
    });
    const burnOwner = fixtureAddress('BURN_FAIL_OWNER');

    await sendAcceptedAvatar(burnCtx, burnOwner);
    await burnCtx.registry.send(burnCtx.flusher.getSender(), { value: toNano('0.2') }, {
      $$type: 'FlushProfileBurnAthDue',
      query_id: 702n,
    } as FlushProfileBurnAthDue);

    global = await burnCtx.registry.getGetGlobal();
    expect(global.burn_due_ath).toBe(HALF_AVATAR_PRICE_ATH);
    expect(global.pending_burn_flush_count).toBe(0n);
    expect((await burnCtx.officialAthWallet.getGetWalletData()).balance).toBe(PROFILE_AVATAR_PRICE_ATH);
  });

  it('PROFILE-08: pending treasury query blocks burn reuse and forged callbacks cannot clear pending flushes', async () => {
    const ctx = await deployProfileRegistryWithAthSystem({
      officialWalletBalance: 0n,
      deployMaster: false,
      mockOfficial: true,
    });
    const owner = fixtureAddress('PENDING_AUTH_OWNER');

    await sendAcceptedAvatar(ctx, owner);
    await ctx.registry.send(ctx.flusher.getSender(), { value: toNano('0.2') }, {
      $$type: 'FlushProfileTreasuryAthDue',
      query_id: 801n,
    } as FlushProfileTreasuryAthDue);
    await ctx.registry.send(ctx.flusher.getSender(), { value: toNano('0.2') }, {
      $$type: 'FlushProfileBurnAthDue',
      query_id: 801n,
    } as FlushProfileBurnAthDue);

    let global = await ctx.registry.getGetGlobal();
    expect(global.pending_treasury_flush_count).toBe(1n);
    expect(global.pending_burn_flush_count).toBe(0n);
    expect(global.burn_due_ath).toBe(HALF_AVATAR_PRICE_ATH);
    const treasuryPending = await ctx.registry.getGetPendingTreasuryFlush(801n);
    expect(treasuryPending.exists).toBe(true);
    expect(treasuryPending.amount).toBe(HALF_AVATAR_PRICE_ATH);
    expect(treasuryPending.created_at).toBeGreaterThan(0n);

    await ctx.registry.send(ctx.flusher.getSender(), { value: toNano('0.2') }, {
      $$type: 'FlushProfileBurnAthDue',
      query_id: 802n,
    } as FlushProfileBurnAthDue);
    const burnPending = await ctx.registry.getGetPendingBurnFlush(802n);
    expect(burnPending.exists).toBe(true);
    expect(burnPending.amount).toBe(HALF_AVATAR_PRICE_ATH);
    expect(burnPending.created_at).toBeGreaterThan(0n);

    await ctx.registry.send(ctx.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'ATHTransferAck',
      query_id: 801n,
      amount: HALF_AVATAR_PRICE_ATH,
    } as ATHTransferAck);
    await ctx.registry.send(ctx.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'ATHTransferFailed',
      query_id: 801n,
      amount: HALF_AVATAR_PRICE_ATH,
    } as ATHTransferFailed);
    await ctx.registry.send(ctx.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'ATHBurnFinalized',
      query_id: 802n,
      amount: HALF_AVATAR_PRICE_ATH,
      owner_address: ctx.registry.address,
    } as ATHBurnFinalized);
    await ctx.registry.send(ctx.attacker.getSender(), { value: toNano('0.05') }, {
      $$type: 'ATHBurnFailed',
      query_id: 802n,
      amount: HALF_AVATAR_PRICE_ATH,
    } as ATHBurnFailed);

    global = await ctx.registry.getGetGlobal();
    expect(global.pending_treasury_flush_count).toBe(1n);
    expect(global.pending_burn_flush_count).toBe(1n);
    expect(global.treasury_due_ath).toBe(0n);
    expect(global.burn_due_ath).toBe(0n);
  });

  it('PROFILE-09: treasury due flushes can overlap with new avatar payments without losing due', async () => {
    const ctx = await deployProfileRegistryWithAthSystem({
      officialWalletBalance: 0n,
      deployMaster: false,
      mockOfficial: true,
    });
    const ownerA = fixtureAddress('OVERLAP_FLUSH_OWNER_A');
    const ownerB = fixtureAddress('OVERLAP_FLUSH_OWNER_B');
    const treasuryAthWalletAddress = await ctx.registry.getGetAthWalletAddress(ctx.treasuryAthReceiver);

    await sendAcceptedAvatar(ctx, ownerA, 901n);
    await ctx.registry.send(ctx.flusher.getSender(), { value: toNano('0.2') }, {
      $$type: 'FlushProfileTreasuryAthDue',
      query_id: 902n,
    } as FlushProfileTreasuryAthDue);

    let global = await ctx.registry.getGetGlobal();
    expect(global.treasury_due_ath).toBe(0n);
    expect(global.pending_treasury_flush_count).toBe(1n);

    await sendAcceptedAvatar(ctx, ownerB, 903n);
    await ctx.registry.send(ctx.flusher.getSender(), { value: toNano('0.2') }, {
      $$type: 'FlushProfileTreasuryAthDue',
      query_id: 904n,
    } as FlushProfileTreasuryAthDue);

    global = await ctx.registry.getGetGlobal();
    expect(global.profile_count).toBe(2n);
    expect(global.treasury_due_ath).toBe(0n);
    expect(global.burn_due_ath).toBe(PROFILE_AVATAR_PRICE_ATH);
    expect(global.pending_treasury_flush_count).toBe(2n);

    await ctx.registry.send(ctx.blockchain.sender(treasuryAthWalletAddress), { value: toNano('0.05') }, {
      $$type: 'ATHTransferAck',
      query_id: 902n,
      amount: HALF_AVATAR_PRICE_ATH,
    } as ATHTransferAck);
    await ctx.registry.send(ctx.blockchain.sender(treasuryAthWalletAddress), { value: toNano('0.05') }, {
      $$type: 'ATHTransferAck',
      query_id: 904n,
      amount: HALF_AVATAR_PRICE_ATH,
    } as ATHTransferAck);

    global = await ctx.registry.getGetGlobal();
    expect(global.treasury_due_ath).toBe(0n);
    expect(global.pending_treasury_flush_count).toBe(0n);
    expect((await ctx.registry.getGetPendingTreasuryFlush(902n)).exists).toBe(false);
    expect((await ctx.registry.getGetPendingTreasuryFlush(904n)).exists).toBe(false);
  });

  it('PROFILE-12: clean-16 direct-pay — a payer sets ONLY their own avatar (payer==owner); a mismatched payer (hijack) is rejected', async () => {
    const ctx = await deployProfileRegistryWithAthSystem({
      officialWalletBalance: 0n,
      deployMaster: true,
    });
    const owner = fixtureAddress('VAULT_FUNDED_AVATAR_OWNER');
    const attacker = fixtureAddress('VAULT_FUNDED_ATTACKER');

    // valid: the owner pays for their OWN avatar (payer == owner)
    await ctx.registry.send(ctx.blockchain.sender(ctx.officialAthWalletAddress), { value: toNano('0.08') }, vaultAvatarNotification(owner, owner, {
      query_id: 1_201n,
      avatar_hash: 0x1201n,
    }));

    // hijack attempt: a DIFFERENT payer tries to set the owner's avatar (payer != owner) -> rejected (21163), no overwrite
    await ctx.registry.send(ctx.blockchain.sender(ctx.officialAthWalletAddress), { value: toNano('0.08') }, vaultAvatarNotification(attacker, owner, {
      query_id: 1_202n,
      avatar_hash: 0x1202n,
    }));

    const avatar = await ctx.registry.getGetAvatar(owner);
    const global = await ctx.registry.getGetGlobal();

    expect(avatar.exists).toBe(true);
    expect(avatar.owner_wallet.equals(owner)).toBe(true);
    expect(avatar.avatar_hash).toBe(0x1201n); // the owner's OWN update, NOT the hijack attempt (0x1202)
    expect(global.profile_count).toBe(1n);
    expect(global.avatar_record_count).toBe(1n);
    expect(global.treasury_due_ath).toBe(HALF_AVATAR_PRICE_ATH);
    expect(global.burn_due_ath).toBe(HALF_AVATAR_PRICE_ATH);
  });

  it('PROFILE-12B: clean-16 direct-pay — a payer!=owner avatar via a real ATHWallet is rejected (21163) and the ATH is refunded to the source wallet', async () => {
    const ctx = await deployProfileRegistryWithAthSystem({
      officialWalletBalance: 0n,
      deployMaster: true,
    });
    const wrongPayer = await ctx.blockchain.treasury('profile-wrong-payer-source');
    const owner = fixtureAddress('VAULT_FUNDED_WRONG_PAYER_OWNER');
    const queryId = 1_203n;
    const sourceWallet = await deployAthWallet(
      ctx.blockchain,
      wrongPayer.address,
      ctx.athMasterAddress,
      PROFILE_AVATAR_PRICE_ATH,
    );

    const result = await sourceWallet.send(wrongPayer.getSender(), { value: toNano('0.3') }, {
      $$type: 'ATHTransferRequestRegistryProfileAvatar',
      query_id: queryId,
      amount: PROFILE_AVATAR_PRICE_ATH,
      recipient: ctx.registry.address,
      response_destination: wrongPayer.address,
      // Use the production avatar notify value (raised 30M->66M with the ProfileRegistry endowment raises)
      // so the wrong-payer notification still reaches the registry's payer check before any value floor.
      notify_value: toNano('0.066'),
      owner_wallet: owner,
      avatar_hash: 0x1203n,
      avatar_entry_id: 0n,
      avatar_stream_id: 0x11223344556677889900aabbccddeeffn,
      avatar_part_count: 2n,
      media_format: 1n,
    } as ATHTransferRequestRegistryProfileAvatar);

    const avatar = await ctx.registry.getGetAvatar(owner);
    const global = await ctx.registry.getGetGlobal();
    const pendingKey = senderKey(wrongPayer.address, queryId);

    expect(findTransaction(result.transactions, {
      from: ctx.officialAthWalletAddress,
      to: ctx.registry.address,
      op: OP_PROFILE_AVATAR_VAULT_NOTIFICATION,
      success: false,
      exitCode: 21163,
    })).toBeDefined();
    expect(findTransaction(result.transactions, {
      from: ctx.officialAthWalletAddress,
      to: sourceWallet.address,
      op: OP_ATH_INTERNAL_TRANSFER,
      success: true,
    })).toBeDefined();
    expect(avatar.exists).toBe(false);
    expect(global.profile_count).toBe(0n);
    expect(global.avatar_record_count).toBe(0n);
    expect(global.treasury_due_ath).toBe(0n);
    expect(global.burn_due_ath).toBe(0n);
    expect((await sourceWallet.getGetWalletData()).balance).toBe(PROFILE_AVATAR_PRICE_ATH);
    expect((await ctx.officialAthWallet.getGetWalletData()).balance).toBe(0n);
    expect((await ctx.officialAthWallet.getGetPendingNotification(queryId, pendingKey)).exists).toBe(false);
  });
});
