import { describe, expect, it } from 'vitest';
import { Address, beginCell, contractAddress, toNano } from '@ton/core';
import { Blockchain, createShardAccount } from '@ton/sandbox';
import { createHash } from 'crypto';
import { UsernameNFTItem } from '../build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE ITEM IS THE RECORD — the facts that decide whether UsernameRegistry.name_records may be deleted.
//
// name_records is the registry's LAST unbounded map: 3.00 cells per name, never evicted, which is the whole of
// the measured ~21 500-name ceiling. Everything else in that contract is fixed-size or self-clearing.
//
// The claim under test is that the map is a WEAKER COPY of something the chain already holds authoritatively:
//   NameRecord { minter_wallet, item_address, registered_at }
//     * item_address  — recomputable: deriveItemAddress(name_hash) = initOf UsernameNFTItem(registry, name_hash)
//     * minter_wallet — NOT the owner. The struct's own comment says so: "TEP-62 transfer updates the item's
//                       owner_wallet but not this record. Resolve live ownership from the item state."
//     * registered_at — a timestamp
// and that uniqueness ("this name is taken") is enforced by the ITEM, not the map.
//
// These tests exist because the map cannot be deleted on that reasoning alone. Each one measures a fact the
// deletion depends on; if any goes red, the map is load-bearing after all and must stay.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const ITEM_ACK_RESERVE = 5_000_000n;   // ITEM_ACK_FORWARD_RESERVE + ITEM_ACK_EXEC_RESERVE, gate 18015 (exec reserve raised 1M->2M in wave-8)

const fixtureAddress = (label: string) =>
  new Address(0, createHash('sha256').update(`PLATHO.V1.TEST.${label}`).digest());

const nameHash = (name: string) => BigInt('0x' + beginCell()
  .storeUint(0xC5CC7CD6, 32)
  .storeBuffer(Buffer.from(name, 'ascii'))
  .endCell().hash().toString('hex'));

const usernameSlice = (name: string) => beginCell().storeBuffer(Buffer.from(name, 'ascii')).endCell().beginParse();

const initMsg = (owner: Address, name: string) => ({
  $$type: 'InitializeUsernameItem' as const,
  owner_wallet: owner,
  mint_nonce: 1n,
  username_len: BigInt(Buffer.from(name, 'ascii').length),
  username: usernameSlice(name),
});

async function liveItem(bc: Blockchain, registry: Address, name: string, owner: Address) {
  const init = await UsernameNFTItem.init(registry, nameHash(name));
  const addr = contractAddress(0, init);
  await bc.setShardAccount(addr, createShardAccount({
    address: addr, code: init.code, data: init.data, balance: toNano('1'), workchain: 0,
  }));
  return { item: bc.openContract(new UsernameNFTItem(addr, init)), addr };
}

describe('THE ITEM IS THE RECORD — what name_records duplicates', () => {
  it('UNI-01: a second mint of a live name is refused BY THE ITEM, in COMPUTE, and it bounces', async () => {
    // THE LOAD-BEARING FACT. Without name_records the registry can no longer refuse a duplicate synchronously
    // at gate 19172 — it would deploy to the item address and let the item answer. That is only safe if the
    // item genuinely refuses AND bounces, because the registry funds the mint from the buyer's ATH and its
    // refund path (bounced<InitializeUsernameItem>) is what returns the money.
    //
    // The subtlety being measured: the registry attaches StateInit to every deploy. On an account that is
    // already active the StateInit is ignored and the BODY is still delivered — so the item's own gate runs.
    // If instead the message were silently swallowed, a duplicate mint would take payment and deliver nothing.
    const bc = await Blockchain.create();
    bc.now = 1_790_000_000;
    const registry = fixtureAddress('UNI_REGISTRY');
    const first = fixtureAddress('UNI_FIRST_OWNER');
    const second = fixtureAddress('UNI_SECOND_OWNER');

    const { item, addr } = await liveItem(bc, registry, 'taken', first);
    await item.send(bc.sender(registry), { value: ITEM_ACK_RESERVE }, initMsg(first, 'taken') as any);
    expect((await item.getGetState()).initialized, 'the name is now live').toBe(true);

    // A second buyer's mint, arriving exactly as the registry would send it: same address, StateInit attached,
    // bounce enabled.
    const init = await UsernameNFTItem.init(registry, nameHash('taken'));
    const r = await bc.sendMessage({
      info: {
        type: 'internal', ihrDisabled: true, bounce: true, bounced: false,
        src: registry, dest: addr, value: { coins: toNano('0.05') },
        ihrFee: 0n, forwardFee: 0n, createdLt: 0n, createdAt: 0,
      },
      init: { code: init.code, data: init.data },
      body: beginCell()
        .storeUint(0x554E494E, 32)
        .storeAddress(second)
        .storeUint(2, 64)   // mint_nonce — hand-mirrored wire layout; omitting it made this exit 9, not 18011
        .storeUint(5, 8)
        .storeSlice(usernameSlice('taken'))
        .endCell(),
    } as any);

    const itemTx = (r.transactions as any[]).find((t) => t.inMessage?.info?.dest?.equals?.(addr) && !t.inMessage?.info?.bounced);
    expect(itemTx?.description?.computePhase?.exitCode, 'the item refuses re-initialisation at gate 18011').toBe(18011);
    expect((r.transactions as any[]).some((t) => t.inMessage?.info?.bounced === true),
      'and it BOUNCES — which is what pays the second buyer back').toBe(true);

    const st = await item.getGetState();
    expect(st.owner_wallet.equals(first), 'the first owner is untouched').toBe(true);
  }, 120_000);

  it('UNI-02: the item address is a pure function of (registry, name) — nothing needs to index it', async () => {
    // NameRecord.item_address stores what this computes. A client, the registry, and any third party all reach
    // the same address from the name alone, which is why storing it costs a cell and buys nothing.
    const bc = await Blockchain.create();
    const registry = fixtureAddress('UNI_REGISTRY');
    const a = contractAddress(0, await UsernameNFTItem.init(registry, nameHash('alice')));
    const b = contractAddress(0, await UsernameNFTItem.init(registry, nameHash('alice')));
    const c = contractAddress(0, await UsernameNFTItem.init(registry, nameHash('bob')));
    expect(a.equals(b), 'deterministic').toBe(true);
    expect(a.equals(c), 'and distinct per name').toBe(false);

    // "Is this name free?" is answerable without any map: the account either exists or it does not.
    expect((await bc.getContract(a)).accountState?.type, 'an unminted name has no account').not.toBe('active');
  }, 120_000);

  it('UNI-03: name_records CANNOT answer "who owns this name" — a transfer moves the item, not the record', async () => {
    // This is why the map is not merely redundant but misleading. minter_wallet is frozen at mint; the live
    // owner lives in the item and moves with TEP-62 transfers. Any consumer resolving ownership through the
    // registry map is reading a stale answer, so deleting the map removes a wrong source rather than a right one.
    const bc = await Blockchain.create();
    bc.now = 1_790_000_000;
    const registry = fixtureAddress('UNI_REGISTRY');
    const minter = await bc.treasury('uni-minter');
    const buyer = fixtureAddress('UNI_BUYER');

    const { item } = await liveItem(bc, registry, 'movable', minter.address);
    await item.send(bc.sender(registry), { value: ITEM_ACK_RESERVE }, initMsg(minter.address, 'movable') as any);
    expect((await item.getGetState()).owner_wallet.equals(minter.address)).toBe(true);

    // TEP-62 transfer body, built exactly as tests/username-nft-item.test.ts builds it.
    const transferPayload = beginCell()
      .storeAddress(buyer)
      .storeAddress(minter.address)
      .storeMaybeRef(null)
      .storeCoins(0n)
      .storeSlice(beginCell().endCell().beginParse())
      .endCell().beginParse();
    await item.send(minter.getSender(), { value: toNano('0.2') }, {
      $$type: 'NftTransfer', query_id: 1n, payload: transferPayload,
    } as any);

    const after = await item.getGetState();
    expect(after.owner_wallet.equals(buyer), 'the ITEM knows the new owner').toBe(true);
    // The registry's record would still name the minter here — which is exactly what its own comment warns.
  }, 120_000);
});
