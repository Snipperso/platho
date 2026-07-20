import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import {
  UsernameRegistry,
  BindOfficialAthWallet,
  SealGenesis,
  AthTransferNotificationRegistryMintUsername,
  FlushTreasuryAthDue,
  FlushBurnAthDue,
} from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import { InitializeUsernameItem, UsernameNFTItem } from '../build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem';
import { ATHWallet } from '../build/ATHWallet/ATHWallet_ATHWallet';
import { ATHMaster } from '../build/ATHMaster/ATHMaster_ATHMaster';

const MANIFEST_HASH = 0x9999888877776666555544443333222211110000ffffeeeeddddccccbbbbaaaan;
const NAME_HASH_DOMAIN = 0xC5CC7CD6n;
const ATH_TOTAL_SUPPLY_ATOMIC = 100_000_000_000_000_000n;
const PRICE_6_PLUS = 100_000_000_000n;
const HALF_PRICE = 50_000_000_000n;

const PENDING_MINT_STORAGE = 6_000_000n;
const NFT_ITEM_DEPLOY_RESERVE = 829_000_000n; // clean-16 L2/#14 (owner: mint = exactly 1 TON); ~412 yr at the real 64962/cell/yr rate
const ATH_NOTIFICATION_ACK_VALUE = 1_000_000n;
const STATE_GROWTH_EXEC_RESERVE = 4_000_000n;
// 2026-07-20: name_records was deleted, so this no longer funds a per-name entry — it is
// USERNAME_REGISTRY_SELF_RENT_CONTRIBUTION, the mint's contribution to the REGISTRY'S own rent (501 code cells,
// ~32.5M/yr at 64962/cell-yr). The number is deliberately unchanged: the mint price is pinned client-side at
// exactly 1 TON, so lowering the floor would return nothing to the buyer. Gate 19122 still sums to the same total.
const REGISTRY_SELF_RENT_CONTRIBUTION = 100_000_000n;
const ATH_TRANSFER_EXEC_RESERVE = 48_000_000n;
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

// ── THE ITEM IS THE RECORD (2026-07-20) ────────────────────────────────────────────────────────────────────
// UsernameRegistry.name_records is gone, and with it get_name_record. "Is this name minted?" is now answered by
// the chain itself: the item's address is a pure function of (registry, name_hash), so anyone can derive it, and
// the item's own get_state() is authoritative — its owner_wallet tracks TEP-62 transfers, which the deleted
// record never did. See tests/username-item-is-the-record.test.ts (UNI-01..03).
async function itemForName(blockchain: Blockchain, registryAddress: Address, name: string) {
  const init = await UsernameNFTItem.init(registryAddress, nameHash(name));
  const address = contractAddress(0, init);
  return { address, item: blockchain.openContract(new UsernameNFTItem(address, init)) };
}

// The replacement for `get_name_record(h).exists`: the item account must exist AND declare itself initialized.
// An unminted name has no account at all, so the account check has to come first — get_state() on a
// non-existent contract is not a "false", it is an error.
async function nameIsMinted(blockchain: Blockchain, registryAddress: Address, name: string): Promise<boolean> {
  const { address, item } = await itemForName(blockchain, registryAddress, name);
  if ((await blockchain.getContract(address)).accountState?.type !== 'active') return false;
  return (await item.getGetState()).initialized;
}

async function deploySealedRegistryWithTreasuryOfficial() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const deployer = await blockchain.treasury('username-boundary-deployer');
  const caller = await blockchain.treasury('username-boundary-caller');
  const placeholderAthWallet = fixtureAddress('PLACEHOLDER_ATH_WALLET');
  const athMasterAddress = fixtureAddress('ATH_MASTER');
  const treasuryAthReceiver = fixtureAddress('TREASURY_ATH_RECEIVER');
  const vaultAddress = fixtureAddress('USERNAME_BOUNDARY_VAULT');

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

  return { blockchain, registry, officialAthWallet, caller, vaultAddress };
}

async function deployUnsealedRegistryWithTreasuryReceiver(workchain: number) {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;
  const deployer = await blockchain.treasury('username-boundary-treasury-workchain-deployer');
  const placeholderAthWallet = fixtureAddress('WORKCHAIN_PLACEHOLDER_ATH_WALLET');
  const athMasterAddress = fixtureAddress('WORKCHAIN_ATH_MASTER');
  const treasuryAthReceiver = fixtureAddress('WORKCHAIN_TREASURY_ATH_RECEIVER', workchain);
  const vaultAddress = fixtureAddress('WORKCHAIN_VAULT');

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
  const vaultAddress = fixtureAddress('ATH_VAULT');
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

  return { blockchain, registry, officialAthWalletAddress, officialAthWallet, athMasterAddress, master, treasuryAthReceiver, flusher, vaultAddress };
}

async function sendMint(registry: any, officialSender: any, ownerWallet: Address, name: string, amount: bigint, value: bigint, payerWallet: Address) {
  await registry.send(officialSender.getSender(), { value }, {
    $$type: 'AthTransferNotificationRegistryMintUsername',
    query_id: 77n,
    amount,
    sender_key: 0n,
    payer_wallet: payerWallet,
    owner_wallet: ownerWallet,
    username_len: BigInt(Buffer.from(name, 'ascii').length),
    username: usernameSlice(name),
  } as AthTransferNotificationRegistryMintUsername);
}

async function sendMintFromAddress(blockchain: Blockchain, registry: any, officialAddress: Address, ownerWallet: Address, name: string, amount: bigint, payerWallet: Address, value = toNano('1.2')) {
  await registry.send(blockchain.sender(officialAddress), { value }, {
    $$type: 'AthTransferNotificationRegistryMintUsername',
    query_id: 88n,
    amount,
    sender_key: 0n,
    payer_wallet: payerWallet,
    owner_wallet: ownerWallet,
    username_len: BigInt(Buffer.from(name, 'ascii').length),
    username: usernameSlice(name),
  } as AthTransferNotificationRegistryMintUsername);
}

describe('UsernameRegistry value/storage boundary negative matrix', () => {
  it('USERNAME-REG-BND-01: paid mint notification rejects min-1 and accepts exact ACK/storage reserves', async () => {
    const { blockchain, registry, officialAthWallet, vaultAddress } = await deploySealedRegistryWithTreasuryOfficial();
    const invalidOwner = fixtureAddress('INVALID_OWNER');
    const validOwner = fixtureAddress('VALID_OWNER');
    const validHash = nameHash('exact1');

    await sendMint(
      registry,
      officialAthWallet,
      invalidOwner,
      'Larisa',
      PRICE_6_PLUS,
      ATH_NOTIFICATION_ACK_VALUE + STATE_GROWTH_EXEC_RESERVE - 1n,
      vaultAddress,
    );
    expect(await nameIsMinted(blockchain, registry.address, 'Larisa')).toBe(false);

    await sendMint(
      registry,
      officialAthWallet,
      invalidOwner,
      'Larisa',
      PRICE_6_PLUS,
      ATH_NOTIFICATION_ACK_VALUE + STATE_GROWTH_EXEC_RESERVE,
      vaultAddress,
    );
    expect(await nameIsMinted(blockchain, registry.address, 'Larisa')).toBe(false);

    await sendMint(
      registry,
      officialAthWallet,
      validOwner,
      'exact1',
      PRICE_6_PLUS,
      PENDING_MINT_STORAGE + NFT_ITEM_DEPLOY_RESERVE + ATH_NOTIFICATION_ACK_VALUE + STATE_GROWTH_EXEC_RESERVE + REGISTRY_SELF_RENT_CONTRIBUTION - 1n,
      vaultAddress,
    );
    // One nanoton under gate 19122 the whole receiver reverts, so the item deploy is never sent: the name's
    // account does not exist at all. (Formerly read off name_records; the absent account is the stronger fact.)
    expect(await nameIsMinted(blockchain, registry.address, 'exact1')).toBe(false);
    expect((await registry.getGetPendingMint(validHash)).exists).toBe(false);

    await sendMint(
      registry,
      officialAthWallet,
      validOwner,
      'exact1',
      PRICE_6_PLUS,
      PENDING_MINT_STORAGE + NFT_ITEM_DEPLOY_RESERVE + ATH_NOTIFICATION_ACK_VALUE + STATE_GROWTH_EXEC_RESERVE + REGISTRY_SELF_RENT_CONTRIBUTION,
      vaultAddress,
    );
    // At exactly the reserve the mint completes end to end. Finalisation is now witnessed on the ITEM — it was
    // deployed and initialized itself — rather than by a registry map entry appearing.
    expect(await nameIsMinted(blockchain, registry.address, 'exact1')).toBe(true);

    // Replaces the old NameRecord.minter_wallet assertion. owner_wallet is identical right after a mint and,
    // unlike the record, stays correct across a later TEP-62 transfer.
    const { item } = await itemForName(blockchain, registry.address, 'exact1');
    expect((await item.getGetState()).owner_wallet.equals(validOwner)).toBe(true);
    // NameRecord.registered_at had no replacement — nothing on chain holds the registration timestamp any more,
    // so there is no assertion to migrate. It was measured in username-item-is-the-record.test.ts as unused.

    // The pending mint cleared on the item's ACK, which is what finalised the mint.
    expect((await registry.getGetPendingMint(validHash)).exists).toBe(false);
  });

  it('USERNAME-REG-BND-02: UsernameNFTItem resend ACK rejects min-1 and accepts exact reserve', async () => {
    const { blockchain, registry, caller } = await deploySealedRegistryWithTreasuryOfficial();
    const ownerWallet = fixtureAddress('ITEM_OWNER');
    const hash = nameHash('itemok');
    const itemInit = await UsernameNFTItem.init(registry.address, hash);
    const itemAddress = contractAddress(registry.address.workChain, itemInit);
    await blockchain.setShardAccount(itemAddress, createShardAccount({
      address: itemAddress,
      code: itemInit.code,
      data: itemInit.data,
      balance: toNano('0.05'),
      workchain: itemAddress.workChain,
    }));
    const item = blockchain.openContract(new UsernameNFTItem(itemAddress, itemInit));
    await item.send(blockchain.sender(registry.address), { value: ITEM_ACK_FORWARD_RESERVE + ITEM_ACK_EXEC_RESERVE }, {
      $$type: 'InitializeUsernameItem',
      owner_wallet: ownerWallet,
      username_len: 6n,
      username: usernameSlice('itemok'),
    } as InitializeUsernameItem);

    // This item was initialized directly, so no pending mint exists at the registry for it. The property under
    // test is that a resent ACK still finalises NOTHING there.
    //
    // The old proxy for that was "no name_record appeared". With the map deleted, `item.initialized` cannot
    // stand in for it — the setup above made it true on purpose. So the claim is made against the state
    // finalisation actually writes, which is the same code path the record was written from: the ACK receiver
    // clears the pending mint and accrues the treasury/burn dues. If a spurious ACK ever finalised, the dues
    // would move. That is the identical event, measured one field over.
    const itemAckResendReserve = ITEM_ACK_FORWARD_RESERVE + ITEM_ACK_EXEC_RESERVE;
    const underfunded = await item.send(caller.getSender(), { value: itemAckResendReserve - 1n }, { $$type: 'ResendDeployedAck' });
    // Below the reserve the item refuses at its own gate 18021, so no ACK is emitted at all.
    expect((underfunded.transactions as any[]).some((t) => t.description?.computePhase?.exitCode === 18021)).toBe(true);
    expect((await registry.getGetGlobal()).treasury_due_ath).toBe(0n);
    expect((await registry.getGetGlobal()).burn_due_ath).toBe(0n);
    expect((await registry.getGetPendingMint(hash)).exists).toBe(false);

    const beforeItemBalance = (await blockchain.getContract(itemAddress)).balance;
    const funded = await item.send(caller.getSender(), { value: itemAckResendReserve }, { $$type: 'ResendDeployedAck' });
    const afterItemBalance = (await blockchain.getContract(itemAddress)).balance;
    // At exactly the reserve the ACK IS emitted — and the registry refuses it at 19130, because the sender is
    // not an item it has an in-flight mint for.
    const registryTx = (funded.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(registry.address) && !t.inMessage?.info?.bounced);
    expect(registryTx?.description?.computePhase?.exitCode).toBe(19130);
    expect((await registry.getGetGlobal()).treasury_due_ath).toBe(0n);
    expect((await registry.getGetGlobal()).burn_due_ath).toBe(0n);
    expect((await registry.getGetPendingMint(hash)).exists).toBe(false);
    expect(afterItemBalance).toBeGreaterThanOrEqual(beforeItemBalance);
  });

  it('USERNAME-REG-BND-04: treasury and burn flush reject min-1 and accept exact reserves', async () => {
    const ctx = await deployRegistryWithAthSystem(PRICE_6_PLUS);
    const ownerWallet = fixtureAddress('DUE_OWNER');
    await sendMintFromAddress(ctx.blockchain, ctx.registry, ctx.officialAthWalletAddress, ownerWallet, 'duetest', PRICE_6_PLUS, ctx.vaultAddress);
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

  it('USERNAME-REG-BND-06: masterchain treasury receiver cannot seal the registry runtime profile', async () => {
    const { registry, deployer } = await deployUnsealedRegistryWithTreasuryReceiver(-1);

    await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
      $$type: 'SealGenesis',
      deployment_manifest_hash: MANIFEST_HASH,
    } as SealGenesis);

    expect((await registry.getGetGlobal()).sealed).toBe(false);
  });
});
