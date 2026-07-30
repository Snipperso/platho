import { describe, expect, it } from 'vitest';
import { sealArtAndCollectionMeta } from './helpers/username-registry-genesis';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { findTransaction } from '@ton/test-utils';
import { createHash } from 'crypto';
import {
  UsernameRegistry,
  BindOfficialAthWallet,
  SealGenesis,
  AthTransferNotificationRegistryMintUsername,
  PrunePendingUsernameMint,
  UsernameItemDeployedAck,
} from '../build/UsernameRegistry/UsernameRegistry_UsernameRegistry';
import { UsernameNFTItem } from '../build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem';
import { MockUsernameNFTItemNoAck } from '../build/MockUsernameNFTItemNoAck/MockUsernameNFTItemNoAck_MockUsernameNFTItemNoAck';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// 2026-07-20 — migrated off UsernameRegistry.name_records, which no longer exists. THE ITEM IS THE RECORD.
//
// What that costs this file specifically: these tests deliberately install MockUsernameNFTItemNoAck at the item
// address, because a mock that accepts the deploy and never ACKs is the ONLY way to manufacture the stuck pending
// mint they exist to test. So the item here can never become `initialized` — that is the fixture, not a gap. The
// registry-side observables that used to be read off name_records are therefore read from:
//   * "which contract holds this name"  -> deriveItemAddress(name_hash), a pure function of (registry, name) (UNI-02)
//   * "did this mint FINALISE?"         -> the pending entry cleared AND the ATH dues accrued. UsernameItemDeployedAck
//                                          is the only path that accrues treasury_due_ath/burn_due_ath, so the dues
//                                          are the registry's finalisation ledger now that no counter exists.
//   * "did the RIGHT owner finalise it?"-> gate 19136 (msg.owner_wallet == pending.owner_wallet), asserted as a
//                                          COMPUTE-phase refusal. That names the enforcer, which the old
//                                          `record.minter_wallet` comparison never did.
//   * `registered_at`                   -> DROPPED. Nothing on chain holds a per-name registration timestamp any
//                                          more, and no consumer read it. No item-based equivalent exists.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const MANIFEST_HASH = 0x9999888877776666555544443333222211110000ffffeeeeddddccccbbbbaaaan;
const NAME_HASH_DOMAIN = 0xC5CC7CD6n;
const PRICE_6_PLUS = 100_000_000_000n;
const STALE_TTL = 86_400;
const PRUNE_EXEC_RESERVE = 2_000_000n;
const OP_ITEM_DEPLOYED_ACK = 0xBBA3EC19;

function fixtureAddress(label: string, workchain = 0): Address {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());
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

// Replaces NameRecord.item_address. The address is a pure function of (registry, name_hash), so a client derives
// it without asking the registry anything — which is why storing it in a map bought nothing (UNI-02).
async function deriveItemAddress(registryAddress: Address, hash: bigint): Promise<Address> {
  return contractAddress(0, await UsernameNFTItem.init(registryAddress, hash));
}

async function deploySealedRegistry() {
  const blockchain = await Blockchain.create();
  blockchain.now = 1_700_000_000;

  const deployer = await blockchain.treasury('username-registry-m13-deployer');
  const pruner = await blockchain.treasury('username-registry-m13-pruner');
  const placeholderAthWallet = fixtureAddress('USERNAME_REGISTRY_PLACEHOLDER_ATH_WALLET_M13');
  const athMasterAddress = fixtureAddress('USERNAME_REGISTRY_ATH_MASTER_M13');
  const treasuryAthReceiver = fixtureAddress('USERNAME_REGISTRY_TREASURY_ATH_RECEIVER_M13');
  const vaultAddress = fixtureAddress('USERNAME_REGISTRY_VAULT_M13');

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

  await sealArtAndCollectionMeta(registry, deployer);
  await registry.send(deployer.getSender(), { value: toNano('0.05') }, {
    $$type: 'SealGenesis',
    deployment_manifest_hash: MANIFEST_HASH,
  } as SealGenesis);

  return { blockchain, registry, registryAddress, officialAthWallet, pruner, vaultAddress };
}

async function installNoAckAt(blockchain: Blockchain, address: Address) {
  const noAckInit = await MockUsernameNFTItemNoAck.init();
  await blockchain.setShardAccount(address, createShardAccount({
    address,
    code: noAckInit.code,
    data: noAckInit.data,
    balance: toNano('0.05'),
    workchain: address.workChain,
  }));
  return blockchain.openContract(new MockUsernameNFTItemNoAck(address, noAckInit));
}

async function createStuckPendingMint(ctx: Awaited<ReturnType<typeof deploySealedRegistry>>, ownerWallet: Address, name: string) {
  const hash = nameHash(name);
  const itemAddress = await ctx.registry.getGetUsernameItemAddress(hash);
  // The registry's own answer and the client-side derivation must be the same address, because that derivation is
  // now the ONLY thing standing where NameRecord.item_address used to stand.
  expect(itemAddress.equals(await deriveItemAddress(ctx.registryAddress, hash))).toBe(true);
  const noAckItem = await installNoAckAt(ctx.blockchain, itemAddress);

  // Registry now retains 511M (6M + 500M item deploy reserve + 1M + 4M), so the mint notification must carry >= that.
  await ctx.registry.send(ctx.officialAthWallet.getSender(), { value: toNano('1.2') }, {
    $$type: 'AthTransferNotificationRegistryMintUsername',
    query_id: 13001n,
    amount: PRICE_6_PLUS,
    sender_key: 0n,
    payer_wallet: ctx.vaultAddress,
    owner_wallet: ownerWallet,
    username_len: BigInt(Buffer.from(name, 'ascii').length),
    username: usernameSlice(name).asCell(),
  } as AthTransferNotificationRegistryMintUsername);

  return { hash, itemAddress, noAckItem };
}

describe('UsernameRegistry stale pending mint prune milestone', () => {
  it('USERNAME-REG-M13-01: stale PendingUsernameMint prune is non-destructive and preserves late ACK recovery', async () => {
    const ctx = await deploySealedRegistry();
    const ownerWallet = fixtureAddress('USERNAME_M13_STUCK_OWNER');
    const { hash, itemAddress, noAckItem } = await createStuckPendingMint(ctx, ownerWallet, 'stuck1');

    expect((await noAckItem.getGetAcceptedCount())).toBe(1n);
    expect((await ctx.registry.getGetPendingMint(hash)).exists).toBe(true);
    expect((await ctx.registry.getGetGlobal()).pending_mint_count).toBe(1n);
    // NOT FINALISED. Was `get_name_record(hash).exists === false`; the mint is unfinished, so no ATH due has
    // accrued — UsernameItemDeployedAck is the only thing that accrues them.
    let global = await ctx.registry.getGetGlobal();
    expect(global.treasury_due_ath).toBe(0n);
    expect(global.burn_due_ath).toBe(0n);

    ctx.blockchain.now = 1_700_000_000 + STALE_TTL + 1;
    await ctx.registry.send(ctx.pruner.getSender(), { value: toNano('0.03') }, {
      $$type: 'PrunePendingUsernameMint',
      name_hash: hash,
    } as PrunePendingUsernameMint);

    // The prune is non-destructive: it neither clears the pending entry nor finalises anything behind its back.
    expect((await ctx.registry.getGetPendingMint(hash)).exists).toBe(true);
    global = await ctx.registry.getGetGlobal();
    expect(global.treasury_due_ath).toBe(0n);
    expect(global.burn_due_ath).toBe(0n);

    await ctx.registry.send(ctx.blockchain.sender(itemAddress), { value: toNano('0.03') }, {
      $$type: 'UsernameItemDeployedAck',
      name_hash: hash,
      owner_wallet: ownerWallet,
      mint_nonce: 1n,
    } as UsernameItemDeployedAck);

    // FINALISED. Was `get_name_record(hash).exists === true` plus a counter; the pending entry cleared and the
    // price split into the two dues is what finalisation now consists of.
    expect((await ctx.registry.getGetPendingMint(hash)).exists).toBe(false);
    global = await ctx.registry.getGetGlobal();
    expect(global.pending_mint_count).toBe(0n);
    expect(global.treasury_due_ath).toBe(PRICE_6_PLUS / 2n);
    expect(global.burn_due_ath).toBe(PRICE_6_PLUS / 2n);
  });

  it('USERNAME-REG-M13-01B: item ACK owner must match the pending mint owner before finalization', async () => {
    const ctx = await deploySealedRegistry();
    const ownerWallet = fixtureAddress('USERNAME_M13_ACK_OWNER');
    const wrongOwner = fixtureAddress('USERNAME_M13_ACK_WRONG_OWNER');
    const { hash, itemAddress } = await createStuckPendingMint(ctx, ownerWallet, 'ackown');

    // The pending entry is what names the owner the ACK must match — it always was; name_records only recorded
    // the outcome afterwards.
    expect((await ctx.registry.getGetPendingMint(hash)).owner_wallet.equals(ownerWallet)).toBe(true);

    const wrongAck = await ctx.registry.send(ctx.blockchain.sender(itemAddress), { value: toNano('0.03') }, {
      $$type: 'UsernameItemDeployedAck',
      name_hash: hash,
      owner_wallet: wrongOwner,
      mint_nonce: 1n,
    } as UsernameItemDeployedAck);

    // Was: assert no name record appeared for the wrong owner. Now assert the GATE that stops it — the ACK is
    // refused in COMPUTE at 19136 (msg.owner_wallet == pending.owner_wallet), which is a stronger statement than
    // observing an absent record, because it says why nothing appeared.
    expect(findTransaction(wrongAck.transactions, {
      from: itemAddress,
      to: ctx.registryAddress,
      op: OP_ITEM_DEPLOYED_ACK,
      success: false,
      exitCode: 19136,
    })).toBeDefined();

    let global = await ctx.registry.getGetGlobal();
    expect((await ctx.registry.getGetPendingMint(hash)).exists).toBe(true);
    expect(global.treasury_due_ath).toBe(0n);
    expect(global.burn_due_ath).toBe(0n);

    const rightAck = await ctx.registry.send(ctx.blockchain.sender(itemAddress), { value: toNano('0.03') }, {
      $$type: 'UsernameItemDeployedAck',
      name_hash: hash,
      owner_wallet: ownerWallet,
      mint_nonce: 1n,
    } as UsernameItemDeployedAck);

    expect(findTransaction(rightAck.transactions, {
      from: itemAddress,
      to: ctx.registryAddress,
      op: OP_ITEM_DEPLOYED_ACK,
      success: true,
    })).toBeDefined();

    global = await ctx.registry.getGetGlobal();
    expect((await ctx.registry.getGetPendingMint(hash)).exists).toBe(false);
    expect(global.treasury_due_ath).toBe(PRICE_6_PLUS / 2n);
    expect(global.burn_due_ath).toBe(PRICE_6_PLUS / 2n);
    // `record.minter_wallet` is gone. The live owner lives on the item and moves with TEP-62 transfers, which the
    // old record never tracked (UNI-03); here the item is the no-ACK mock, so ownership itself is out of scope and
    // what this test measures is the registry refusing to finalise for anyone but pending.owner_wallet.
  });

  it('USERNAME-REG-M13-02: non-stale PendingUsernameMint cannot be pruned and remains pending', async () => {
    const ctx = await deploySealedRegistry();
    const ownerWallet = fixtureAddress('USERNAME_M13_EARLY_OWNER');
    const { hash } = await createStuckPendingMint(ctx, ownerWallet, 'early1');

    ctx.blockchain.now = 1_700_000_000 + STALE_TTL - 1;
    await ctx.registry.send(ctx.pruner.getSender(), { value: toNano('0.03') }, {
      $$type: 'PrunePendingUsernameMint',
      name_hash: hash,
    } as PrunePendingUsernameMint);

    expect((await ctx.registry.getGetPendingMint(hash)).exists).toBe(true);
  });

  it('USERNAME-REG-M13-03: stale prune cannot erase pending state or accept duplicate remint state', async () => {
    const ctx = await deploySealedRegistry();
    const ownerWallet = fixtureAddress('USERNAME_M13_REMINT_OWNER');
    const { hash, itemAddress } = await createStuckPendingMint(ctx, ownerWallet, 'remint');

    ctx.blockchain.now = 1_700_000_000 + STALE_TTL + 1;
    await ctx.registry.send(ctx.pruner.getSender(), { value: toNano('0.03') }, {
      $$type: 'PrunePendingUsernameMint',
      name_hash: hash,
    } as PrunePendingUsernameMint);

    expect((await ctx.registry.getGetPendingMint(hash)).exists).toBe(true);
    let global = await ctx.registry.getGetGlobal();
    expect(global.treasury_due_ath).toBe(0n);
    expect(global.burn_due_ath).toBe(0n);

    // The duplicate remint. Note WHICH gate refuses it: 19173, the in-flight pending duplicate, and that gate is
    // unaffected by the name_records deletion because pending_mints is the map that clears itself. The retired
    // 19172 ("name already taken") only ever applied to a name that had FINALISED, which this one has not.
    const remint = await ctx.registry.send(ctx.officialAthWallet.getSender(), { value: toNano('1.2') }, {
      $$type: 'AthTransferNotificationRegistryMintUsername',
      query_id: 13002n,
      amount: PRICE_6_PLUS,
      sender_key: 0n,
      payer_wallet: ctx.vaultAddress,
      owner_wallet: ownerWallet,
      username_len: 6n,
      username: usernameSlice('remint').asCell(),
    } as AthTransferNotificationRegistryMintUsername);

    expect(findTransaction(remint.transactions, {
      to: ctx.registryAddress,
      success: false,
      exitCode: 19173,
    })).toBeDefined();

    // The duplicate changed nothing: the original pending mint survives intact, still pointing at the same item.
    const pendingAfterRemint = await ctx.registry.getGetPendingMint(hash);
    expect(pendingAfterRemint.exists).toBe(true);
    expect(pendingAfterRemint.query_id).toBe(13001n);
    expect(pendingAfterRemint.owner_wallet.equals(ownerWallet)).toBe(true);
    // Was `record.item_address` — recomputed from the name instead of read out of a map.
    expect(pendingAfterRemint.item_address.equals(await deriveItemAddress(ctx.registryAddress, hash))).toBe(true);
    global = await ctx.registry.getGetGlobal();
    expect(global.pending_mint_count).toBe(1n);
    expect(global.treasury_due_ath).toBe(0n);
    expect(global.burn_due_ath).toBe(0n);

    await ctx.registry.send(ctx.blockchain.sender(itemAddress), { value: toNano('0.03') }, {
      $$type: 'UsernameItemDeployedAck',
      name_hash: hash,
      owner_wallet: ownerWallet,
      mint_nonce: 1n,
    } as UsernameItemDeployedAck);

    global = await ctx.registry.getGetGlobal();
    expect((await ctx.registry.getGetPendingMint(hash)).exists).toBe(false);
    expect(global.pending_mint_count).toBe(0n);
    // Finalisation charged exactly ONE price, not two — the duplicate was refused before it could accrue anything.
    expect(global.treasury_due_ath).toBe(PRICE_6_PLUS / 2n);
    expect(global.burn_due_ath).toBe(PRICE_6_PLUS / 2n);
    // The name now resolves to the item at the derived address; nothing in the registry indexes it any more.
    expect(itemAddress.equals(await deriveItemAddress(ctx.registryAddress, hash))).toBe(true);
  });
});
