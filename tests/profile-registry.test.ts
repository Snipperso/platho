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
  AthTransferNotificationProfileAvatar,
  BindProfileOfficialAthWallet,
  FlushProfileBurnAthDue,
  FlushProfileTreasuryAthDue,
  ProfileRegistry,
  SealGenesis,
} from '../build/ProfileRegistry/ProfileRegistry_ProfileRegistry';
import { MockAthWalletNoAck } from '../build/MockAthWalletNoAck/MockAthWalletNoAck_MockAthWalletNoAck';
import { ATHMaster } from '../build/ATHMaster/ATHMaster_ATHMaster';
import {
  ATHTransferRequestProfileAvatar,
  ATHWallet,
} from '../build/ATHWallet/ATHWallet_ATHWallet';

const MANIFEST_HASH = 0x50524f46494c45524547495354525900000000000000000000000000000001n;
const PROFILE_AVATAR_PRICE_ATH = 100_000_000_000n;
const HALF_AVATAR_PRICE_ATH = 50_000_000_000n;
const ATH_TOTAL_SUPPLY_ATOMIC = 100_000_000_000_000_000n;
const ATH_TRANSFER_NOTIFY_ID_DOMAIN = 0x41544E49n;
const PROFILE_AVATAR_NOTIFY_VALUE = 30_000_000n;
const OP_PROFILE_AVATAR_NOTIFICATION = 0xA11A7001;
const OP_ATH_TRANSFER_NOTIFICATION_ACK = 0x472D9D7E;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.PROFILE.${label}`).digest());
}

function senderKey(senderOwner: Address): bigint {
  return BigInt('0x' + beginCell()
    .storeUint(ATH_TRANSFER_NOTIFY_ID_DOMAIN, 32)
    .storeAddress(senderOwner)
    .endCell()
    .hash()
    .toString('hex')) % 4_294_967_296n;
}

async function deployAthWallet(
  blockchain: Blockchain,
  owner: Address,
  athMaster: Address,
  athBalance: bigint,
  tonBalance = toNano('1'),
) {
  const zeroInit = await ATHWallet.init(0n, owner, athMaster);
  const dataInit = await ATHWallet.init(athBalance, owner, athMaster);
  const address = contractAddress(owner.workChain, zeroInit);
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: zeroInit.code,
    data: dataInit.data,
    balance: tonBalance,
    workchain: address.workChain,
  }));
  return blockchain.openContract(new ATHWallet(address, zeroInit));
}

async function deploySealedProfileRegistry() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const deployer = await blockchain.treasury('profile-registry-deployer');
  const placeholderAthWallet = fixtureAddress('PLACEHOLDER_PROFILE_ATH_WALLET');
  const athMasterAddress = fixtureAddress('PROFILE_ATH_MASTER');
  const treasuryAthReceiver = fixtureAddress('PROFILE_TREASURY_ATH_RECEIVER');

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

  return { blockchain, registry, officialAthWalletAddress, athMasterAddress };
}

async function deployProfileRegistryWithAthSystem(options: { officialWalletBalance: bigint; deployMaster: boolean; mockOfficial?: boolean }) {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const deployer = await blockchain.treasury('profile-registry-ath-deployer');
  const flusher = await blockchain.treasury('profile-registry-ath-flusher');
  const attacker = await blockchain.treasury('profile-registry-ath-attacker');
  const placeholderAthWallet = fixtureAddress('ATH_PROFILE_PLACEHOLDER');
  const treasuryAthReceiver = fixtureAddress('ATH_PROFILE_TREASURY_RECEIVER');
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
    flusher,
    attacker,
  };
}

function avatarNotification(owner: Address, overrides: Partial<AthTransferNotificationProfileAvatar> = {}): AthTransferNotificationProfileAvatar {
  return {
    $$type: 'AthTransferNotificationProfileAvatar',
    query_id: overrides.query_id ?? 1n,
    amount: overrides.amount ?? PROFILE_AVATAR_PRICE_ATH,
    sender_key: overrides.sender_key ?? 77n,
    owner_wallet: overrides.owner_wallet ?? owner,
    avatar_hash: overrides.avatar_hash ?? 0xabc123n,
    avatar_entry_id: overrides.avatar_entry_id ?? 0n,
    avatar_stream_id: overrides.avatar_stream_id ?? 0x11223344556677889900aabbccddeeffn,
    avatar_part_count: overrides.avatar_part_count ?? 8n,
    media_format: overrides.media_format ?? 1n,
  };
}

async function sendAcceptedAvatar(
  ctx: Awaited<ReturnType<typeof deployProfileRegistryWithAthSystem>>,
  owner: Address,
  queryId = 1n,
) {
  await ctx.registry.send(ctx.blockchain.sender(ctx.officialAthWalletAddress), { value: toNano('0.05') }, avatarNotification(owner, {
    query_id: queryId,
  }));
}

async function deployProfilePaymentProductionFixture(initialUserAth = PROFILE_AVATAR_PRICE_ATH * 2n) {
  const ctx = await deployProfileRegistryWithAthSystem({
    officialWalletBalance: 0n,
    deployMaster: true,
  });
  const user = await ctx.blockchain.treasury('profile-avatar-prod-user');
  const userAthWallet = await deployAthWallet(
    ctx.blockchain,
    user.address,
    ctx.athMasterAddress,
    initialUserAth,
    toNano('2'),
  );
  return { ...ctx, user, userAthWallet };
}

async function sendProfileAvatarViaProductionWallet(params: {
  user: any;
  userAthWallet: any;
  registry: any;
  queryId: bigint;
  amount?: bigint;
  requestValue?: bigint;
  overrides?: Partial<ATHTransferRequestProfileAvatar>;
}) {
  return await params.userAthWallet.send(params.user.getSender(), {
    value: params.requestValue ?? toNano('0.25'),
  }, {
    $$type: 'ATHTransferRequestProfileAvatar',
    query_id: params.queryId,
    amount: params.amount ?? PROFILE_AVATAR_PRICE_ATH,
    recipient: params.registry.address,
    response_destination: params.user.address,
    notify_value: PROFILE_AVATAR_NOTIFY_VALUE,
    avatar_hash: params.overrides?.avatar_hash ?? 0xabc123n,
    avatar_entry_id: params.overrides?.avatar_entry_id ?? 0n,
    avatar_stream_id: params.overrides?.avatar_stream_id ?? 0x11223344556677889900aabbccddeeffn,
    avatar_part_count: params.overrides?.avatar_part_count ?? 8n,
    media_format: params.overrides?.media_format ?? 1n,
  } as ATHTransferRequestProfileAvatar);
}

describe('ProfileRegistry wallet avatar pointers', () => {
  it('PROFILE-01: accepts paid official avatar notification, stores version, and splits ATH due', async () => {
    const { blockchain, registry, officialAthWalletAddress } = await deploySealedProfileRegistry();
    const owner = fixtureAddress('OWNER_ONE');

    const result = await registry.send(blockchain.sender(officialAthWalletAddress), { value: toNano('0.05') }, avatarNotification(owner));

    const avatar = await registry.getGetAvatar(owner);
    const global = await registry.getGetGlobal();
    expect(avatar.exists).toBe(true);
    expect(avatar.owner_wallet.equals(owner)).toBe(true);
    expect(avatar.version).toBe(1n);
    expect(avatar.avatar_hash).toBe(0xabc123n);
    expect(avatar.avatar_part_count).toBe(8n);
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

    await registry.send(blockchain.sender(officialAthWalletAddress), { value: toNano('0.05') }, avatarNotification(owner, {
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
      { avatar_part_count: 17n },
      { media_format: 2n },
      { owner_wallet: fixtureAddress('INVALID_POINTER_MASTERCHAIN_OWNER', -1) },
    ] satisfies Array<Partial<AthTransferNotificationProfileAvatar>>) {
      await registry.send(blockchain.sender(officialAthWalletAddress), { value: toNano('0.05') }, avatarNotification(owner, overrides));
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

    await registry.send(blockchain.sender(officialAthWalletAddress), { value: toNano('0.05') }, avatarNotification(owner, {
      query_id: 11n,
      avatar_hash: 0x11n,
    }));
    await registry.send(blockchain.sender(officialAthWalletAddress), { value: toNano('0.05') }, avatarNotification(owner, {
      query_id: 12n,
      avatar_hash: 0x22n,
      avatar_stream_id: 0x22223333444455556666777788889999n,
    }));

    const current = await registry.getGetAvatar(owner);
    const first = await registry.getGetAvatarVersion(owner, 1n);
    const global = await registry.getGetGlobal();
    expect(current.version).toBe(2n);
    expect(current.avatar_hash).toBe(0x22n);
    expect(first.exists).toBe(true);
    expect(first.avatar_hash).toBe(0x11n);
    expect(global.profile_count).toBe(1n);
    expect(global.avatar_record_count).toBe(2n);
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

    await registry.send(blockchain.sender(officialAthWalletAddress), { value: toNano('0.05') }, avatarNotification(owner));
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

    await ctx.registry.send(ctx.flusher.getSender(), { value: toNano('0.2') }, {
      $$type: 'FlushProfileBurnAthDue',
      query_id: 802n,
    } as FlushProfileBurnAthDue);

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

  it('PROFILE-09: production ATHWallet profile payment accepts only through the official notification hop', async () => {
    const ctx = await deployProfilePaymentProductionFixture();

    await ctx.registry.send(ctx.user.getSender(), { value: toNano('0.05') }, avatarNotification(ctx.user.address, {
      query_id: 900n,
    }));

    expect((await ctx.registry.getGetAvatar(ctx.user.address)).exists).toBe(false);
    expect((await ctx.registry.getGetGlobal()).profile_count).toBe(0n);

    const result = await sendProfileAvatarViaProductionWallet({
      user: ctx.user,
      userAthWallet: ctx.userAthWallet,
      registry: ctx.registry,
      queryId: 901n,
    });

    const avatar = await ctx.registry.getGetAvatar(ctx.user.address);
    const global = await ctx.registry.getGetGlobal();
    const sourceWallet = await ctx.userAthWallet.getGetWalletData();
    const officialWallet = await ctx.officialAthWallet.getGetWalletData();
    const key = senderKey(ctx.user.address);

    expect(avatar.exists).toBe(true);
    expect(avatar.owner_wallet.equals(ctx.user.address)).toBe(true);
    expect(avatar.version).toBe(1n);
    expect(global.profile_count).toBe(1n);
    expect(global.avatar_record_count).toBe(1n);
    expect(global.treasury_due_ath).toBe(HALF_AVATAR_PRICE_ATH);
    expect(global.burn_due_ath).toBe(HALF_AVATAR_PRICE_ATH);
    expect(sourceWallet.balance).toBe(PROFILE_AVATAR_PRICE_ATH);
    expect(officialWallet.balance).toBe(PROFILE_AVATAR_PRICE_ATH);
    expect((await ctx.officialAthWallet.getGetPendingNotification(901n, key)).exists).toBe(false);
    expect(findTransaction(result.transactions, {
      from: ctx.officialAthWallet.address,
      to: ctx.registry.address,
      op: OP_PROFILE_AVATAR_NOTIFICATION,
      success: true,
    })).toBeDefined();
    expect(findTransaction(result.transactions, {
      from: ctx.registry.address,
      to: ctx.officialAthWallet.address,
      op: OP_ATH_TRANSFER_NOTIFICATION_ACK,
      success: true,
    })).toBeDefined();
  });

  it('PROFILE-10: rejected production avatar notifications refund the source ATH wallet through bounce', async () => {
    const rejectedCases = [
      { label: 'wrong-amount', amount: PROFILE_AVATAR_PRICE_ATH - 1n },
      { label: 'zero-hash', overrides: { avatar_hash: 0n } },
      { label: 'zero-stream', overrides: { avatar_stream_id: 0n } },
      { label: 'zero-part-count', overrides: { avatar_part_count: 0n } },
      { label: 'too-many-parts', overrides: { avatar_part_count: 17n } },
      { label: 'wrong-format', overrides: { media_format: 2n } },
    ] satisfies Array<{
      label: string;
      amount?: bigint;
      overrides?: Partial<ATHTransferRequestProfileAvatar>;
    }>;

    for (const [index, rejected] of rejectedCases.entries()) {
      const ctx = await deployProfilePaymentProductionFixture(PROFILE_AVATAR_PRICE_ATH);
      const queryId = 1_000n + BigInt(index);
      const key = senderKey(ctx.user.address);

      await sendProfileAvatarViaProductionWallet({
        user: ctx.user,
        userAthWallet: ctx.userAthWallet,
        registry: ctx.registry,
        queryId,
        amount: rejected.amount,
        overrides: rejected.overrides,
      });

      const avatar = await ctx.registry.getGetAvatar(ctx.user.address);
      const global = await ctx.registry.getGetGlobal();
      const sourceWallet = await ctx.userAthWallet.getGetWalletData();
      const officialWallet = await ctx.officialAthWallet.getGetWalletData();

      expect(avatar.exists, rejected.label).toBe(false);
      expect(global.profile_count, rejected.label).toBe(0n);
      expect(global.avatar_record_count, rejected.label).toBe(0n);
      expect(global.treasury_due_ath, rejected.label).toBe(0n);
      expect(global.burn_due_ath, rejected.label).toBe(0n);
      expect(sourceWallet.balance, rejected.label).toBe(PROFILE_AVATAR_PRICE_ATH);
      expect(officialWallet.balance, rejected.label).toBe(0n);
      expect((await ctx.officialAthWallet.getGetPendingNotification(queryId, key)).exists, rejected.label).toBe(false);
    }
  });

  it('PROFILE-11: duplicate production profile query cannot reprocess an already ACKed notification slot', async () => {
    const ctx = await deployProfilePaymentProductionFixture(PROFILE_AVATAR_PRICE_ATH * 2n);
    const queryId = 1_100n;

    await sendProfileAvatarViaProductionWallet({
      user: ctx.user,
      userAthWallet: ctx.userAthWallet,
      registry: ctx.registry,
      queryId,
      overrides: { avatar_hash: 0x111n },
    });
    await sendProfileAvatarViaProductionWallet({
      user: ctx.user,
      userAthWallet: ctx.userAthWallet,
      registry: ctx.registry,
      queryId,
      overrides: { avatar_hash: 0x222n },
    });

    const avatar = await ctx.registry.getGetAvatar(ctx.user.address);
    const global = await ctx.registry.getGetGlobal();
    const sourceWallet = await ctx.userAthWallet.getGetWalletData();
    const officialWallet = await ctx.officialAthWallet.getGetWalletData();

    expect(avatar.exists).toBe(true);
    expect(avatar.version).toBe(1n);
    expect(avatar.avatar_hash).toBe(0x111n);
    expect(global.profile_count).toBe(1n);
    expect(global.avatar_record_count).toBe(1n);
    expect(global.treasury_due_ath).toBe(HALF_AVATAR_PRICE_ATH);
    expect(global.burn_due_ath).toBe(HALF_AVATAR_PRICE_ATH);
    expect(sourceWallet.balance).toBe(PROFILE_AVATAR_PRICE_ATH);
    expect(officialWallet.balance).toBe(PROFILE_AVATAR_PRICE_ATH);
  });
});
