import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  UsernameRegistry,
  BindOfficialAthWallet,
  SealGenesis,
  AthTransferNotificationMintUsername,
  FlushAthRefundDue,
  FlushTreasuryAthDue,
  FlushBurnAthDue,
} from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import { UsernameNFTItem } from '../build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';
import { ATHMaster } from '../build/ATHMaster/ATHMaster_ATHMaster';
import { MockAthWalletNoAck } from '../build/MockAthWalletNoAck/MockAthWalletNoAck_MockAthWalletNoAck';

const MANIFEST_HASH = 0x9999888877776666555544443333222211110000ffffeeeeddddccccbbbbaaaan;
const NAME_HASH_DOMAIN = 0xC5CC7CD6n;
const ATH_TOTAL_SUPPLY_ATOMIC = 100_000_000_000_000_000n;
const PRICE_6_PLUS = 100_000_000_000n;
const HALF_PRICE = 50_000_000_000n;

const REFUND_DUE_STORAGE = 4_000_000n;
const PENDING_MINT_STORAGE = 6_000_000n;
const NFT_ITEM_DEPLOY_RESERVE = 20_000_000n;
const ATH_NOTIFICATION_ACK_VALUE = 1_000_000n;
const STATE_GROWTH_EXEC_RESERVE = 2_000_000n;
const ATH_TRANSFER_EXEC_RESERVE = 5_000_000n;
const ATH_BURN_EXEC_RESERVE = 5_000_000n;
const DUE_FLUSH_LOCAL_EXEC_RESERVE = 2_000_000n;
const ITEM_ACK_FORWARD_RESERVE = 3_000_000n;
const ITEM_ACK_EXEC_RESERVE = 1_000_000n;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.USERNAME.BOUNDARY.${label}`).digest());
}

function usernameSlice(name: string) {
  return beginCell().storeBuffer(Buffer.from(name, 'ascii')).endCell().beginParse();
}

function nameHash(name: string): bigint {
  return BigInt('0x' + beginCell()
    .storeUint(NAME_HASH_DOMAIN, 32)
    .storeBuffer(Buffer.from(name, 'ascii'))
    .endCell()
    .hash()
    .toString('hex'));
}

function senderForAddress(blockchain: Blockchain, address: Address) {
  return { address, getSender: () => blockchain.sender(address) };
}

async function deploySealedRegistryWithTreasuryOfficial() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const deployer = await blockchain.treasury('username-boundary-deployer');
  const caller = await blockchain.treasury('username-boundary-caller');
  const placeholderAthWallet = fixtureAddress('PLACEHOLDER_ATH_WALLET');
  const athMasterAddress = fixtureAddress('ATH_MASTER');
  const treasuryAthReceiver = fixtureAddress('TREASURY_ATH_RECEIVER');

  const registryInit = await UsernameRegistry.init(placeholderAthWallet, athMasterAddress, treasuryAthReceiver, false, 0n, 0n, deployer.address);
  const registryAddress = contractAddress(0, registryInit);
  await blockchain.setShardAccount(registryAddress, createShardAccount({
    address: registryAddress,
    code: registryInit.code,
    data: registryInit.data,
    balance: toNano('3'),
    workchain: registryAddress.workChain,
  }));
  const registry = blockchain.openContract(new UsernameRegistry(registryAddress, registryInit));
  const officialAthWalletAddress = await registry.getGetAthWalletAddress(registryAddress);
  const officialAthWallet = senderForAddress(blockchain, officialAthWalletAddress);

  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: officialAthWalletAddress,
  } as BindOfficialAthWallet);
  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);

  return { blockchain, registry, officialAthWallet, caller };
}

async function deployUnsealedRegistryWithTreasuryReceiver(workchain: number) {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const deployer = await blockchain.treasury('username-boundary-treasury-workchain-deployer');
  const placeholderAthWallet = fixtureAddress('WORKCHAIN_PLACEHOLDER_ATH_WALLET');
  const athMasterAddress = fixtureAddress('WORKCHAIN_ATH_MASTER');
  const treasuryAthReceiver = fixtureAddress('WORKCHAIN_TREASURY_ATH_RECEIVER', workchain);

  const registryInit = await UsernameRegistry.init(placeholderAthWallet, athMasterAddress, treasuryAthReceiver, false, 0n, 0n, deployer.address);
  const registryAddress = contractAddress(0, registryInit);
  await blockchain.setShardAccount(registryAddress, createShardAccount({
    address: registryAddress,
    code: registryInit.code,
    data: registryInit.data,
    balance: toNano('3'),
    workchain: registryAddress.workChain,
  }));
  const registry = blockchain.openContract(new UsernameRegistry(registryAddress, registryInit));
  const officialAthWalletAddress = await registry.getGetAthWalletAddress(registryAddress);

  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: officialAthWalletAddress,
  } as BindOfficialAthWallet);

  return { registry, deployer };
}

async function deployRegistryWithAthSystem(officialWalletBalance: bigint) {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const deployer = await blockchain.treasury('username-boundary-ath-deployer');
  const flusher = await blockchain.treasury('username-boundary-flusher');
  const placeholderAthWallet = fixtureAddress('ATH_PLACEHOLDER');
  const treasuryAthReceiver = fixtureAddress('ATH_TREASURY_RECEIVER');
  const masterTreasuryOwner = fixtureAddress('ATH_MASTER_TREASURY');
  const content = beginCell().storeBuffer(Buffer.from('ATH')).endCell();

  const masterInit = await ATHMaster.init(masterTreasuryOwner, content);
  const athMasterAddress = contractAddress(0, masterInit);
  const registryInit = await UsernameRegistry.init(placeholderAthWallet, athMasterAddress, treasuryAthReceiver, false, 0n, 0n, deployer.address);
  const registryAddress = contractAddress(0, registryInit);
  const officialZeroInit = await ATHWallet.init(0n, registryAddress, athMasterAddress);
  const officialBalanceInit = await ATHWallet.init(officialWalletBalance, registryAddress, athMasterAddress);
  const officialAthWalletAddress = contractAddress(registryAddress.workChain, officialZeroInit);

  await blockchain.setShardAccount(athMasterAddress, createShardAccount({
    address: athMasterAddress,
    code: masterInit.code,
    data: masterInit.data,
    balance: toNano('3'),
    workchain: athMasterAddress.workChain,
  }));
  await blockchain.setShardAccount(registryAddress, createShardAccount({
    address: registryAddress,
    code: registryInit.code,
    data: registryInit.data,
    balance: toNano('3'),
    workchain: registryAddress.workChain,
  }));
  await blockchain.setShardAccount(officialAthWalletAddress, createShardAccount({
    address: officialAthWalletAddress,
    code: officialZeroInit.code,
    data: officialBalanceInit.data,
    balance: toNano('3'),
    workchain: officialAthWalletAddress.workChain,
  }));

  const registry = blockchain.openContract(new UsernameRegistry(registryAddress, registryInit));
  const officialAthWallet = blockchain.openContract(new ATHWallet(officialAthWalletAddress, officialZeroInit));
  const master = blockchain.openContract(new ATHMaster(athMasterAddress, masterInit));

  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: officialAthWalletAddress,
  } as BindOfficialAthWallet);
  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);

  return { blockchain, registry, officialAthWalletAddress, officialAthWallet, athMasterAddress, master, treasuryAthReceiver, flusher };
}

async function deployRegistryWithNoAckOfficial() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const deployer = await blockchain.treasury('username-boundary-noack-deployer');
  const flusher = await blockchain.treasury('username-boundary-noack-flusher');
  const placeholderAthWallet = fixtureAddress('NOACK_PLACEHOLDER');
  const athMasterAddress = fixtureAddress('NOACK_ATH_MASTER');
  const treasuryAthReceiver = fixtureAddress('NOACK_TREASURY_RECEIVER');

  const registryInit = await UsernameRegistry.init(placeholderAthWallet, athMasterAddress, treasuryAthReceiver, false, 0n, 0n, deployer.address);
  const registryAddress = contractAddress(0, registryInit);
  await blockchain.setShardAccount(registryAddress, createShardAccount({
    address: registryAddress,
    code: registryInit.code,
    data: registryInit.data,
    balance: toNano('3'),
    workchain: registryAddress.workChain,
  }));

  const registry = blockchain.openContract(new UsernameRegistry(registryAddress, registryInit));
  const officialAthWalletAddress = await registry.getGetAthWalletAddress(registryAddress);
  const noAckInit = await MockAthWalletNoAck.init();
  await blockchain.setShardAccount(officialAthWalletAddress, createShardAccount({
    address: officialAthWalletAddress,
    code: noAckInit.code,
    data: noAckInit.data,
    balance: toNano('3'),
    workchain: officialAthWalletAddress.workChain,
  }));

  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'BindOfficialAthWallet',
    deployment_manifest_hash: MANIFEST_HASH,
    official_ath_wallet_address: officialAthWalletAddress,
  } as BindOfficialAthWallet);
  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);

  return { blockchain, registry, officialAthWalletAddress, flusher };
}

async function sendMint(registry: any, officialSender: any, ownerWallet: Address, name: string, amount: bigint, value: bigint) {
  await registry.send(officialSender.getSender(), { value }, {
    $$type: 'AthTransferNotificationMintUsername',
    query_id: 77n,
    amount,
    sender_key: 0n,
    owner_wallet: ownerWallet,
    username_len: BigInt(Buffer.from(name, 'ascii').length),
    username: usernameSlice(name),
  } as AthTransferNotificationMintUsername);
}

async function sendMintFromAddress(blockchain: Blockchain, registry: any, officialAddress: Address, ownerWallet: Address, name: string, amount: bigint, value = toNano('0.15')) {
  await registry.send(blockchain.sender(officialAddress), { value }, {
    $$type: 'AthTransferNotificationMintUsername',
    query_id: 88n,
    amount,
    sender_key: 0n,
    owner_wallet: ownerWallet,
    username_len: BigInt(Buffer.from(name, 'ascii').length),
    username: usernameSlice(name),
  } as AthTransferNotificationMintUsername);
}

describe('UsernameRegistry value/storage boundary negative matrix', () => {
  it('USERNAME-REG-BND-01: paid mint notification rejects min-1 and accepts exact ACK/storage reserves', async () => {
    const { registry, officialAthWallet } = await deploySealedRegistryWithTreasuryOfficial();
    const invalidOwner = fixtureAddress('INVALID_OWNER');
    const validOwner = fixtureAddress('VALID_OWNER');
    const validHash = nameHash('exact1');

    await sendMint(
      registry,
      officialAthWallet,
      invalidOwner,
      'Larisa',
      PRICE_6_PLUS,
      REFUND_DUE_STORAGE + ATH_NOTIFICATION_ACK_VALUE + STATE_GROWTH_EXEC_RESERVE - 1n,
    );
    expect(await registry.getGetRefundDue(invalidOwner)).toBe(0n);

    await sendMint(
      registry,
      officialAthWallet,
      invalidOwner,
      'Larisa',
      PRICE_6_PLUS,
      REFUND_DUE_STORAGE + ATH_NOTIFICATION_ACK_VALUE + STATE_GROWTH_EXEC_RESERVE,
    );
    expect(await registry.getGetRefundDue(invalidOwner)).toBe(PRICE_6_PLUS);

    await sendMint(
      registry,
      officialAthWallet,
      validOwner,
      'exact1',
      PRICE_6_PLUS,
      PENDING_MINT_STORAGE + NFT_ITEM_DEPLOY_RESERVE + ATH_NOTIFICATION_ACK_VALUE + STATE_GROWTH_EXEC_RESERVE - 1n,
    );
    expect((await registry.getGetNameRecord(validHash)).exists).toBe(false);
    expect((await registry.getGetPendingMint(validHash)).exists).toBe(false);

    await sendMint(
      registry,
      officialAthWallet,
      validOwner,
      'exact1',
      PRICE_6_PLUS,
      PENDING_MINT_STORAGE + NFT_ITEM_DEPLOY_RESERVE + ATH_NOTIFICATION_ACK_VALUE + STATE_GROWTH_EXEC_RESERVE,
    );
    expect((await registry.getGetNameRecord(validHash)).exists).toBe(true);
  });

  it('USERNAME-REG-BND-02: UsernameNFTItem resend ACK rejects min-1 and accepts exact reserve', async () => {
    const { blockchain, registry, caller } = await deploySealedRegistryWithTreasuryOfficial();
    const ownerWallet = fixtureAddress('ITEM_OWNER');
    const hash = nameHash('itemok');
    const itemInit = await UsernameNFTItem.init(ownerWallet, registry.address, hash);
    const itemAddress = contractAddress(0, itemInit);
    await blockchain.setShardAccount(itemAddress, createShardAccount({
      address: itemAddress,
      code: itemInit.code,
      data: itemInit.data,
      balance: toNano('0.05'),
      workchain: itemAddress.workChain,
    }));
    const item = blockchain.openContract(new UsernameNFTItem(itemAddress, itemInit));

    const itemAckResendReserve = ITEM_ACK_FORWARD_RESERVE + ITEM_ACK_EXEC_RESERVE;
    await item.send(caller.getSender(), { value: itemAckResendReserve - 1n }, { $$type: 'ResendDeployedAck' });
    expect((await registry.getGetNameRecord(hash)).exists).toBe(false);

    const beforeItemBalance = (await blockchain.getContract(itemAddress)).balance;
    await item.send(caller.getSender(), { value: itemAckResendReserve }, { $$type: 'ResendDeployedAck' });
    const afterItemBalance = (await blockchain.getContract(itemAddress)).balance;
    expect((await registry.getGetNameRecord(hash)).exists).toBe(false);
    expect(afterItemBalance).toBeGreaterThanOrEqual(beforeItemBalance);
  });

  it('USERNAME-REG-BND-03: refund flush rejects min-1 and exact reserve completes transfer', async () => {
    const ctx = await deployRegistryWithAthSystem(PRICE_6_PLUS);
    const ownerWallet = fixtureAddress('REFUND_OWNER');
    await sendMintFromAddress(ctx.blockchain, ctx.registry, ctx.officialAthWalletAddress, ownerWallet, 'Larisa', PRICE_6_PLUS);
    expect(await ctx.registry.getGetRefundDue(ownerWallet)).toBe(PRICE_6_PLUS);

    const refundFlushReserve = ATH_TRANSFER_EXEC_RESERVE + DUE_FLUSH_LOCAL_EXEC_RESERVE;
    await ctx.registry.send(ctx.flusher.getSender(), { value: refundFlushReserve - 1n }, {
      $$type: 'FlushAthRefundDue',
      query_id: 301n,
      owner_wallet: ownerWallet,
    } as FlushAthRefundDue);
    expect(await ctx.registry.getGetRefundDue(ownerWallet)).toBe(PRICE_6_PLUS);
    expect((await ctx.registry.getGetPendingRefundFlushFor(ownerWallet, 301n)).exists).toBe(false);

    const beforeRegistryRefundBalance = (await ctx.blockchain.getContract(ctx.registry.address)).balance;
    await ctx.registry.send(ctx.flusher.getSender(), { value: refundFlushReserve }, {
      $$type: 'FlushAthRefundDue',
      query_id: 302n,
      owner_wallet: ownerWallet,
    } as FlushAthRefundDue);
    const afterRegistryRefundBalance = (await ctx.blockchain.getContract(ctx.registry.address)).balance;
    const recipientAthWalletAddress = await ctx.registry.getGetAthWalletAddress(ownerWallet);
    const recipientWallet = ctx.blockchain.openContract(new ATHWallet(recipientAthWalletAddress));
    expect(await ctx.registry.getGetRefundDue(ownerWallet)).toBe(0n);
    expect((await ctx.registry.getGetPendingRefundFlushFor(ownerWallet, 302n)).exists).toBe(false);
    expect((await recipientWallet.getGetWalletData()).balance).toBe(PRICE_6_PLUS);
    expect(afterRegistryRefundBalance).toBeGreaterThanOrEqual(beforeRegistryRefundBalance);
  });

  it('USERNAME-REG-BND-04: treasury and burn flush reject min-1 and accept exact reserves', async () => {
    const ctx = await deployRegistryWithAthSystem(PRICE_6_PLUS);
    const ownerWallet = fixtureAddress('DUE_OWNER');
    await sendMintFromAddress(ctx.blockchain, ctx.registry, ctx.officialAthWalletAddress, ownerWallet, 'duetest', PRICE_6_PLUS);
    expect((await ctx.registry.getGetGlobal()).treasury_due_ath).toBe(HALF_PRICE);
    expect((await ctx.registry.getGetGlobal()).burn_due_ath).toBe(HALF_PRICE);

    const transferFlushReserve = ATH_TRANSFER_EXEC_RESERVE + DUE_FLUSH_LOCAL_EXEC_RESERVE;
    const burnFlushReserve = ATH_BURN_EXEC_RESERVE + DUE_FLUSH_LOCAL_EXEC_RESERVE;
    await ctx.registry.send(ctx.flusher.getSender(), { value: transferFlushReserve - 1n }, {
      $$type: 'FlushTreasuryAthDue',
      query_id: 401n,
    } as FlushTreasuryAthDue);
    expect((await ctx.registry.getGetGlobal()).treasury_due_ath).toBe(HALF_PRICE);

    const beforeRegistryTreasuryBalance = (await ctx.blockchain.getContract(ctx.registry.address)).balance;
    await ctx.registry.send(ctx.flusher.getSender(), { value: transferFlushReserve }, {
      $$type: 'FlushTreasuryAthDue',
      query_id: 402n,
    } as FlushTreasuryAthDue);
    const afterRegistryTreasuryBalance = (await ctx.blockchain.getContract(ctx.registry.address)).balance;
    const treasuryAthWalletAddress = await ctx.registry.getGetAthWalletAddress(ctx.treasuryAthReceiver);
    const treasuryWallet = ctx.blockchain.openContract(new ATHWallet(treasuryAthWalletAddress));
    expect((await ctx.registry.getGetGlobal()).treasury_due_ath).toBe(0n);
    expect((await treasuryWallet.getGetWalletData()).balance).toBe(HALF_PRICE);
    expect(afterRegistryTreasuryBalance).toBeGreaterThanOrEqual(beforeRegistryTreasuryBalance);

    await ctx.registry.send(ctx.flusher.getSender(), { value: burnFlushReserve - 1n }, {
      $$type: 'FlushBurnAthDue',
      query_id: 501n,
    } as FlushBurnAthDue);
    expect((await ctx.registry.getGetGlobal()).burn_due_ath).toBe(HALF_PRICE);

    await ctx.registry.send(ctx.flusher.getSender(), { value: burnFlushReserve }, {
      $$type: 'FlushBurnAthDue',
      query_id: 502n,
    } as FlushBurnAthDue);
    expect((await ctx.registry.getGetGlobal()).burn_due_ath).toBe(0n);
    expect((await ctx.master.getGetJettonData()).total_supply).toBe(ATH_TOTAL_SUPPLY_ATOMIC - HALF_PRICE);
  });

  it('USERNAME-REG-BND-05: refund flush ids are scoped by owner wallet', async () => {
    const ctx = await deployRegistryWithNoAckOfficial();
    const owner1 = fixtureAddress('REFUND_SCOPE_OWNER_1');
    const owner2 = fixtureAddress('REFUND_SCOPE_OWNER_2');
    const queryId = 777n;
    const reserve = ATH_TRANSFER_EXEC_RESERVE + DUE_FLUSH_LOCAL_EXEC_RESERVE;

    await sendMintFromAddress(ctx.blockchain, ctx.registry, ctx.officialAthWalletAddress, owner1, 'Larisa', PRICE_6_PLUS);
    await sendMintFromAddress(ctx.blockchain, ctx.registry, ctx.officialAthWalletAddress, owner2, 'Larisa', PRICE_6_PLUS);

    await ctx.registry.send(ctx.flusher.getSender(), { value: reserve }, {
      $$type: 'FlushAthRefundDue',
      query_id: queryId,
      owner_wallet: owner1,
    } as FlushAthRefundDue);
    await ctx.registry.send(ctx.flusher.getSender(), { value: reserve }, {
      $$type: 'FlushAthRefundDue',
      query_id: queryId,
      owner_wallet: owner2,
    } as FlushAthRefundDue);

    expect((await ctx.registry.getGetPendingRefundFlushFor(owner1, queryId)).exists).toBe(true);
    expect((await ctx.registry.getGetPendingRefundFlushFor(owner2, queryId)).exists).toBe(true);
    expect((await ctx.registry.getGetGlobal()).pending_refund_flush_count).toBe(2n);
  });

  it('USERNAME-REG-BND-06: masterchain treasury receiver cannot seal the registry runtime profile', async () => {
    const { registry, deployer } = await deployUnsealedRegistryWithTreasuryReceiver(-1);

    await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as SealGenesis);

    expect((await registry.getGetGlobal()).sealed).toBe(false);
  });
});
