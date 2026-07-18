import { describe, expect, it, beforeEach } from 'vitest';
import { beginCell, Cell, contractAddress, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { x25519 } from '@noble/curves/ed25519.js';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { buildIntroPublish } from '../web/publish-builder.mjs';
import { scanIntros, scanIntroIndices } from '../web/intro-scan.mjs';
import { computePrivateScanViewTag } from '../web/crypto/platho-crypto.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// INTRO SCAN PAGE — the primitive that decides whether a leak-free first-contact scan is affordable at all.
//
// A recipient cannot ask "which of these is mine" — that is the entire point of the stealth lane — so it must look
// at EVERY live intro in the network. The only question is how many bytes that costs. Measured on the account
// state: 85 B/intro, i.e. ~229 MB/day for every user at 2.7M first contacts/day network-wide. Untenable on a phone.
//
// THE PAGE USED TO CARRY BARE 16-BIT TAGS AND WAS UNUSABLE. The recipient's filter is
// computePrivateScanViewTag(scan_secret, r): the tag is derived from the intro's OWN ephemeral point, so it is
// unique per intro and there is no single "my tag" to match a list against. `r` is therefore required for every
// live intro, and a page without it could not drive a scan at all — while measuring beautifully at 2.03 B/intro
// and passing every test, because every test only ever unpacked tags and weighed the response.
//
// SCAN-01 is the test that could not have passed then: it runs the REAL client scan (web/intro-scan.mjs) over the
// REAL getter output and requires it to find the intro addressed to a real X25519 scan key. A page that cannot
// serve the scan now fails, whatever it weighs.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const cellOf = (fill: number) => beginCell().storeBuffer(Buffer.alloc(64, fill)).endCell();

/** Unpack the ref-chained page: (uint256 r, uint16 view_tag) pairs, 3 per cell, in ascending id order. */
function unpackPairs(pairs: Cell, count: number): Array<{ r: bigint; view_tag: number }> {
  const out: Array<{ r: bigint; view_tag: number }> = [];
  let cur: Cell | null = pairs;
  while (cur && out.length < count) {
    const sl = cur.beginParse();
    while (sl.remainingBits >= 272 && out.length < count) {
      out.push({ r: sl.loadUintBig(256), view_tag: sl.loadUint(16) });
    }
    cur = cur.refs.length > 0 ? cur.refs[0] : null;
  }
  return out;
}

describe('INTRO SCAN PAGE — the scan input, and what it actually costs', () => {
  let blockchain: Blockchain;
  let payer: SandboxContract<TreasuryContract>;
  let epoch: number;
  let shard: SandboxContract<IntroShard>;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    // Clock set AFTER the Apr-2026 config-18 switch, deliberately. The rate is a SCHEDULE: before the switch a
    // cell-year costs 240631 plus 481 per bit-year, after it 64962 with bits free — measured 486975 vs 64962 per
    // full 64-byte cell in this very sandbox, differing by nothing but this line. These shards deploy after the
    // switch, so a test clock in 2023 would price their rent ~7.5x high and quietly justify wrong endowments.
    blockchain.now = 1_790_000_000;
    epoch = Math.floor(blockchain.now / 86400);
    payer = await blockchain.treasury('tag-payer');
    const init = await IntroShard.init(BigInt(epoch), 3n);
    shard = blockchain.openContract(new IntroShard(contractAddress(0, init), init));
  });

  async function publish(n: number, at: (i: number) => { r: bigint; tag: number }) {
    for (let i = 0; i < n; i += 1) {
      const { r, tag } = at(i);
      const built = await buildIntroPublish({
        epoch, bucket: 3n, r, viewTag: BigInt(tag),
        header0: cellOf(1), body: cellOf(2), value: toNano('0.02'),
      });
      await payer.send({ to: built.to, value: built.value, body: built.body, init: built.init, bounce: true } as any);
    }
  }

  it('SCAN-01: the REAL client scan finds its intro using only what the page carries', async () => {
    // A genuine recipient scan key, and a genuine ephemeral per intro. X25519 is symmetric, so the tag the sender
    // publishes and the tag the recipient recomputes are the same value derived from the same shared secret.
    const scanSecret = x25519.utils.randomSecretKey();
    const decoySecret = x25519.utils.randomSecretKey();

    const mineAt = 17;
    const entries: Array<{ r: bigint; tag: number }> = [];
    for (let i = 0; i < 32; i += 1) {
      const ephemeralSecret = x25519.utils.randomSecretKey();
      const R = x25519.getPublicKey(ephemeralSecret);
      // addressed to the real recipient only at `mineAt`; every other intro is addressed to somebody else
      const owner = i === mineAt ? scanSecret : decoySecret;
      const tag = await computePrivateScanViewTag(owner, R);
      entries.push({ r: BigInt('0x' + Buffer.from(R).toString('hex')), tag });
    }
    await publish(32, (i) => entries[i]);

    const page = await shard.getGetScanPage(0n, 256n);
    expect(page.count).toBe(32n);
    const unpacked = unpackPairs(page.pairs, Number(page.count));
    expect(unpacked.length).toBe(32);

    // THE POINT: hand the page straight to the client scan module. Nothing else is fetched.
    const hits = await scanIntroIndices(scanSecret, unpacked);
    expect(hits, 'the scan must find the intro addressed to this key, from the page alone').toContain(mineAt);
    const matched = await scanIntros(scanSecret, unpacked);
    expect(matched.length).toBeGreaterThan(0);
    expect(matched.some((m: any) => m.r === unpacked[mineAt].r), 'the matched entry is the right one').toBe(true);
  }, 180_000);

  it('SCAN-02: the page returns exactly the pairs that were published, in id order', async () => {
    const at = (i: number) => ({ r: BigInt(i + 1) * 0x0101010101010101n, tag: (i * 7919) & 0xffff });
    await publish(40, at);

    const page = await shard.getGetScanPage(0n, 256n);
    expect(page.count).toBe(40n);
    expect(page.from_id).toBe(0n);
    expect(page.next_id).toBe(40n);

    const pairs = unpackPairs(page.pairs, Number(page.count));
    expect(pairs.length).toBe(40);
    for (let i = 0; i < 40; i += 1) {
      expect(pairs[i].r, `r at position ${i}`).toBe(at(i).r);
      expect(pairs[i].view_tag, `tag at position ${i}`).toBe(at(i).tag);
    }
  }, 120_000);

  it('SCAN-03: MEASURED bytes per intro — the honest number, not the flattering one', async () => {
    const n = 256;
    await publish(n, (i) => ({ r: BigInt(i + 1) * 0x0101010101010101n, tag: (i * 7919) & 0xffff }));

    const page = await shard.getGetScanPage(0n, 256n);
    expect(page.count).toBe(BigInt(n));
    const perIntro = page.pairs.toBoc().length / Number(page.count);

    // 34 B/intro is the floor: 32 of them are `r`, without which the scan cannot run. An earlier revision claimed
    // ~2 B/intro by shipping a page that omitted `r` — cheap, and useless. Allow a little for cell descriptors.
    expect(perIntro, `page is ${perIntro.toFixed(2)} B/intro`).toBeGreaterThan(33);
    expect(perIntro, `page is ${perIntro.toFixed(2)} B/intro`).toBeLessThan(40);

    // the contrast against reading account state is real but MODEST — say so rather than overstate it
    const acc: any = await blockchain.getContract(shard.address);
    const stateBytes: number = acc?.accountState?.state?.data?.toBoc().length ?? 0;
    expect(stateBytes, 'the account state is readable, so the comparison is real').toBeGreaterThan(0);
    const ratio = stateBytes / n / perIntro;
    expect(ratio, 'the page is cheaper than raw state, but only by a small factor').toBeGreaterThan(1.5);
    console.log(`      MEASURED: page ${perIntro.toFixed(2)} B/intro vs raw state ${(stateBytes / n).toFixed(1)} B/intro -> ${ratio.toFixed(2)}x`);
  }, 180_000);

  it('SCAN-04: the page is clamped to the LIVE range — evicted ids can never be handed out', async () => {
    await publish(10, (i) => ({ r: BigInt(i + 1), tag: 0x1000 + i }));
    blockchain.now = blockchain.now! + 604800 + 86400;
    const keeper = await blockchain.treasury('tag-keeper');
    await shard.send(keeper.getSender(), { value: toNano('0.1') }, { $$type: 'EvictIntros', max_count: 32n } as any);
    expect((await shard.getGetView()).live_count).toBe(0n);

    const page = await shard.getGetScanPage(0n, 256n);
    expect(page.evict_cursor).toBe(10n);
    expect(page.from_id, 'clamped up to the live floor').toBe(10n);
    expect(page.count, 'nothing live remains').toBe(0n);
  }, 120_000);

  it('SCAN-05: paging covers a range larger than one page, with no gaps or repeats', async () => {
    const at = (i: number) => ({ r: BigInt(i + 1) * 7n, tag: (i * 104729) & 0xffff });
    await publish(120, at);

    const seen: Array<{ r: bigint; view_tag: number }> = [];
    let cursor = 0n;
    for (let guard = 0; guard < 20 && seen.length < 120; guard += 1) {
      const page = await shard.getGetScanPage(cursor, 25n);
      if (page.count === 0n) break;
      seen.push(...unpackPairs(page.pairs, Number(page.count)));
      cursor = page.from_id + page.count;
    }
    expect(seen.length).toBe(120);
    for (let i = 0; i < 120; i += 1) {
      expect(seen[i].r, `paged r ${i}`).toBe(at(i).r);
      expect(seen[i].view_tag, `paged tag ${i}`).toBe(at(i).tag);
    }
  }, 180_000);

  it('SCAN-06: a page is capped, so a caller cannot make the get-method run out of gas', async () => {
    await publish(300, (i) => ({ r: BigInt(i + 1), tag: i & 0xffff }));
    const page = await shard.getGetScanPage(0n, 100000n);   // ask for far more than the cap
    expect(page.count, 'capped at IS_SCAN_PAGE_CAP').toBe(256n);
    expect(page.next_id).toBe(300n);
  }, 240_000);
});
