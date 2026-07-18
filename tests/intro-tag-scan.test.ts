import { describe, expect, it, beforeEach } from 'vitest';
import { beginCell, Cell, contractAddress, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { buildIntroPublish } from '../web/publish-builder.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// INTRO TAG SCAN — the primitive that decides whether a leak-free first-contact scan is affordable at all.
//
// A recipient cannot ask "which of these is mine" — that is the entire point of the stealth lane — so it must look
// at EVERY live intro in the network. The only question is how many bytes that costs. Measured on the account state:
// 85 B/intro, i.e. ~229 MB/day for every user at 2.7M first contacts/day network-wide. Untenable on a phone.
//
// get_view_tags returns ONLY the 16-bit tags, with ids implicit by position (sound because eviction is FIFO from the
// bottom while intros append at the top, so the live range is always contiguous). These tests do not trust that
// reasoning — they unpack real tags and MEASURE the real response size.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const cellOf = (fill: number) => beginCell().storeBuffer(Buffer.alloc(64, fill)).endCell();

/** Unpack the ref-chained page: 16-bit tags, each cell holding as many as its bits allow, in ascending id order. */
function unpackTags(tags: Cell, count: number): number[] {
  const out: number[] = [];
  let cur: Cell | null = tags;
  while (cur && out.length < count) {
    const sl = cur.beginParse();
    while (sl.remainingBits >= 16 && out.length < count) out.push(sl.loadUint(16));
    cur = cur.refs.length > 0 ? cur.refs[0] : null;
  }
  return out;
}

describe('INTRO TAG SCAN — the scan filter, and what it actually costs', () => {
  let blockchain: Blockchain;
  let payer: SandboxContract<TreasuryContract>;
  let epoch: number;
  let shard: SandboxContract<IntroShard>;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    blockchain.now = 1_700_000_000;
    epoch = Math.floor(blockchain.now / 86400);
    payer = await blockchain.treasury('tag-payer');
    const init = await IntroShard.init(BigInt(epoch), 3n);
    shard = blockchain.openContract(new IntroShard(contractAddress(0, init), init));
  });

  /** Publish `n` intros whose view_tags are a known, non-trivial sequence. */
  async function publish(n: number, tagOf: (i: number) => number) {
    for (let i = 0; i < n; i += 1) {
      const built = await buildIntroPublish({
        epoch, bucket: 3n, r: BigInt(i + 1), viewTag: BigInt(tagOf(i)),
        header0: cellOf(1), body: cellOf(2), value: toNano('0.02'),
      });
      await payer.send({ to: built.to, value: built.value, body: built.body, init: built.init, bounce: true } as any);
    }
  }

  it('TAG-01: the page returns exactly the tags that were published, in id order', async () => {
    const tagOf = (i: number) => (i * 7919) & 0xffff;   // spread across the 16-bit space, not 0..n
    await publish(40, tagOf);

    const page = await shard.getGetViewTags(0n, 256n);
    expect(page.count).toBe(40n);
    expect(page.from_id).toBe(0n);
    expect(page.next_id).toBe(40n);

    const tags = unpackTags(page.tags, Number(page.count));
    expect(tags.length).toBe(40);
    for (let i = 0; i < 40; i += 1) expect(tags[i], `tag at position ${i}`).toBe(tagOf(i));
  }, 120_000);

  it('TAG-02: MEASURED bytes per intro — the whole reason this getter exists', async () => {
    await publish(200, (i) => (i * 7919) & 0xffff);

    const page = await shard.getGetViewTags(0n, 256n);
    expect(page.count).toBe(200n);
    const pageBytes = page.tags.toBoc().length;
    const perIntro = pageBytes / Number(page.count);

    // the packed page must be at or under ~2.5 B/intro (16 bits + cell descriptors), NOT the 85 B of raw state
    expect(perIntro, `packed page is ${perIntro.toFixed(2)} B/intro`).toBeLessThan(2.5);

    // and prove the contrast against reading the account state, which is what a client would otherwise have to do
    const acc: any = await blockchain.getContract(shard.address);
    const stateBytes: number = acc?.accountState?.state?.data?.toBoc().length ?? 0;
    expect(stateBytes, 'the account state is readable, so the comparison is real').toBeGreaterThan(0);
    expect(stateBytes / 200, 'raw state really is an order of magnitude worse').toBeGreaterThan(perIntro * 10);
    console.log(`      MEASURED: packed page ${perIntro.toFixed(2)} B/intro vs raw state ${(stateBytes / 200).toFixed(1)} B/intro`);
  }, 120_000);

  it('TAG-03: the page is clamped to the LIVE range — evicted ids can never be handed out', async () => {
    await publish(10, (i) => 0x1000 + i);
    // age past the one-week retention and evict the lot
    blockchain.now = blockchain.now! + 604800 + 86400;
    const keeper = await blockchain.treasury('tag-keeper');
    await shard.send(keeper.getSender(), { value: toNano('0.1') }, { $$type: 'EvictIntros', max_count: 32n } as any);
    expect((await shard.getGetView()).live_count).toBe(0n);

    // asking from 0 must not resurrect evicted entries
    const page = await shard.getGetViewTags(0n, 256n);
    expect(page.evict_cursor).toBe(10n);
    expect(page.from_id, 'clamped up to the live floor').toBe(10n);
    expect(page.count, 'nothing live remains').toBe(0n);
  }, 120_000);

  it('TAG-04: paging covers a range larger than one page, with no gaps or repeats', async () => {
    const tagOf = (i: number) => (i * 104729) & 0xffff;
    await publish(120, tagOf);

    // walk it in deliberately small pages, as a bandwidth-constrained client would
    const seen: number[] = [];
    let cursor = 0n;
    for (let guard = 0; guard < 20 && seen.length < 120; guard += 1) {
      const page = await shard.getGetViewTags(cursor, 25n);
      if (page.count === 0n) break;
      seen.push(...unpackTags(page.tags, Number(page.count)));
      cursor = page.from_id + page.count;
    }
    expect(seen.length).toBe(120);
    for (let i = 0; i < 120; i += 1) expect(seen[i], `paged tag ${i}`).toBe(tagOf(i));
  }, 120_000);

  it('TAG-05: a page is capped, so a caller cannot make the get-method run out of gas', async () => {
    await publish(300, (i) => i & 0xffff);
    const page = await shard.getGetViewTags(0n, 100000n);   // ask for far more than the cap
    expect(page.count, 'capped at IS_TAG_PAGE_CAP').toBe(256n);
    expect(page.next_id).toBe(300n);
  }, 180_000);
});
