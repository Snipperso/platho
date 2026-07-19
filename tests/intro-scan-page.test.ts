import { describe, expect, it, beforeEach } from 'vitest';
import { beginCell, Cell, contractAddress, toNano } from '@ton/core';
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { x25519 } from '@noble/curves/ed25519.js';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { buildIntroPublish } from '../web/publish-builder.mjs';
import { scanIntros, scanIntroIndices } from '../web/intro-scan.mjs';
import { computePrivateScanViewTag } from '../web/crypto/platho-crypto.mjs';
import { parseScanPageStack } from '../web/intro-transport.mjs';
import { unpackScanPage } from '../web/intro-receive.mjs';
import { computeCellHashAndDepth } from '../web/pwa-contract-transactions.mjs';

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

  it('SCAN-04: the page decodes through the PRODUCTION parser, against a real getter stack', async () => {
    // THIS TEST REPLACES a clamp-to-live-range guard that eviction made necessary, and it exists because of what
    // that deletion nearly did. IntroScanPage lost its `evict_cursor` field when nothing could remove an entry any
    // more, which shifted `pairs` from stack index 4 to index 3 — and web/intro-transport.mjs parseScanPageStack,
    // the DEFAULT decoder on the production scan path, reads by index. A stale index there throws on every bucket
    // and stops all first contacts, and NOTHING in this suite would have noticed: every other test calls the Tact
    // wrapper or stubs readScanPage a level above the parser.
    //
    // So this drives the real parser against a real getter stack from the compiled contract. It is the only test
    // in the repo that touches parseScanPageStack at all.
    await publish(7, (i) => ({ r: BigInt(i + 1) * 1001n, tag: 0x2000 + i }));

    const stack = await blockchain.runGetMethod(shard.address, 'get_scan_page', [
      { type: 'int', value: 0n },
      { type: 'int', value: 256n },
    ] as any);
    expect(stack.exitCode, 'the getter itself must succeed').toBe(0);

    // Shape it the way an RPC endpoint hands it over, so the parser sees what it will see in production.
    const wire = (stack.stack as any[]).map((item: any) =>
      item.type === 'cell' || item.type === 'slice'
        ? { type: 'cell', value: item.cell.toBoc().toString('base64') }
        : { type: 'int', value: String(item.value) });

    const page = parseScanPageStack(wire);
    expect(page.from_id, 'from_id survives the wire').toBe(0n);
    expect(page.count, 'count survives the wire').toBe(7n);
    expect(page.next_id, 'next_id survives the wire').toBe(7n);

    // `pairs` must be the CELL, not an integer read out of the wrong slot — which is exactly what an index shift
    // produces and what a length-only guard would have missed. The parser is a BROWSER module, so its cells are
    // the hand-rolled kind rather than @ton/core's; comparing hashes is the way to check them against the
    // reference wrapper without dragging one implementation into the other.
    const reference = await shard.getGetScanPage(0n, 256n);
    const parsedHash = Buffer.from((await computeCellHashAndDepth(page.pairs as any)).hash).toString('hex');
    expect(parsedHash, "the parsed pairs cell IS the getter's own pairs cell")
      .toBe(reference.pairs.hash().toString('hex'));
    expect(unpackPairs(reference.pairs, Number(reference.count)).map((d) => d.r),
      'and it holds what was published').toEqual([1001n, 2002n, 3003n, 4004n, 5005n, 6006n, 7007n]);

    // The wire really is four items now; pin it so a future struct change is loud here rather than silent there.
    expect(wire.length, 'IntroScanPage is four stack items').toBe(4);
  }, 120_000);

  it('INTRO-SEAM-01: the production decoder feeds the production unpacker — this seam was BROKEN', async () => {
    // THE BUG THIS PINS, found by audit on 2026-07-19 and reproduced before fixing: parseScanPageStack builds
    // the CLIENT's own cell ({ data, bitLength, refs }), because it has to run in a browser where @ton/core does
    // not load. unpackScanPage called `cur.beginParse()`, which exists only on an @ton/core Cell. So the real
    // wiring — transport -> parseScanPageStack -> unpackScanPage — threw on every page with anything in it.
    // NO FIRST CONTACT COULD HAVE BEEN RECEIVED BY ANYBODY.
    //
    // Nothing caught it because every other test stubs readScanPage a level ABOVE the parser and hands back a
    // Tact-wrapper cell, so the two halves were never run against each other; and the browser-loadability guard
    // checks imports, not runtime types. This test is the only place the two real implementations meet.
    await publish(4, (i) => ({ r: BigInt(i + 1) * 555n, tag: 0x300 + i }));

    const stack = await blockchain.runGetMethod(shard.address, 'get_scan_page', [
      { type: 'int', value: 0n },
      { type: 'int', value: 256n },
    ] as any);
    const wire = (stack.stack as any[]).map((item: any) =>
      item.type === 'cell' || item.type === 'slice'
        ? { type: 'cell', value: item.cell.toBoc().toString('base64') }
        : { type: 'int', value: String(item.value) });

    const page = parseScanPageStack(wire);                 // browser cell out
    const pairs = unpackScanPage(page.pairs as any, Number(page.count));   // must be readable by the unpacker

    expect(pairs.map((p) => p.r), 'the pairs survive the whole production path')
      .toEqual([555n, 1110n, 1665n, 2220n]);
    expect(pairs.map((p) => p.view_tag), 'and so do the tags').toEqual([0x300, 0x301, 0x302, 0x303]);

    // Multi-cell too: 4 pairs is more than the 3 that fit one cell, so the ref chain was exercised above. Assert
    // it explicitly rather than relying on the packing constant staying what it is.
    expect(Number(page.count), 'the page really did span more than one cell').toBeGreaterThan(3);
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
