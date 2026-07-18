import { describe, expect, it } from 'vitest';
import { Blockchain } from '@ton/sandbox';
import { beginCell, toNano, Cell } from '@ton/core';
import { loadIntroPublish } from '../build/IntroShard/IntroShard_IntroShard';
import { buildIntroPublish } from '../web/publish-builder.mjs';
import { parseIntroPublish, isIntroPublish, parseIntroEntryStack, INTRO_PUBLISH_OPCODE } from '../web/intro-codec.mjs';
import { parseBocBase64, computeCellHashAndDepth } from '../web/pwa-contract-transactions.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// INTRO-CODEC — the browser reads what the reference reader reads, or it reads nothing.
//
// The live client had no cell READER at all: it only ever built outgoing messages. The receive path needs the
// other direction, and it needs it to be exact, because what it is parsing is a message body handed over by an
// endpoint nobody trusts. A lenient parser there does not degrade gracefully — it produces a plausible capsule.
//
// So these tests hold the browser parser against the compiled Tact reader on real published messages, and require
// it to REFUSE everything that is not an IntroPublish rather than return something partial.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const cellOf = (fill: number, len = 64) => {
  const buf = Buffer.alloc(len, fill);
  const chunks: Buffer[] = [];
  for (let i = 0; i < Math.max(len, 1); i += 127) chunks.push(buf.subarray(i, Math.min(i + 127, len)));
  let cell = beginCell().storeBuffer(chunks[chunks.length - 1]).endCell();
  for (let i = chunks.length - 2; i >= 0; i -= 1) cell = beginCell().storeBuffer(chunks[i]).storeRef(cell).endCell();
  return cell;
};

/**
 * The REAL browser path: serialise to a BOC exactly as it travels, then parse it with the CLIENT's own parser —
 * not @ton/core's. That distinction is the point of the test. The client's cells are plain
 * `{ data, bitLength, refs }` records, a different shape from @ton/core's Cell, and a codec written against the
 * wrong one fails only in the browser, where nothing here runs.
 */
const overTheWire = (cell: Cell) => parseBocBase64(cell.toBoc().toString('base64'));
/**
 * Compare a client cell with a reference cell BY HASH. Comparing serialised BOCs would be wrong — the two
 * implementations may pick different BOC flags for the same cell — while the representation hash is defined by
 * TON itself, covers the refs too, and exercises the client's own hasher as a bonus.
 */
const sameCell = async (clientCell: any, reference: Cell) =>
  Buffer.from((await computeCellHashAndDepth(clientCell)).hash).equals(reference.hash());

describe('INTRO-CODEC — the browser parser matches the reference, exactly', () => {
  it('CODEC-01: a real published IntroPublish parses identically to the Tact reader', async () => {
    const epoch = Math.floor(1_790_000_000 / 86400);
    const cases = [
      { r: 1n, viewTag: 0, header0: cellOf(0x11), body: cellOf(0x12, 32) },
      { r: (1n << 255n) + 7n, viewTag: 0xffff, header0: cellOf(0x21), body: cellOf(0x22, 512) },
      { r: (1n << 256n) - 1n, viewTag: 0x1234, header0: cellOf(0x31, 1), body: cellOf(0x32, 1024) },
    ];
    for (const c of cases) {
      const built = await buildIntroPublish({ epoch, bucket: 3n, r: c.r, viewTag: BigInt(c.viewTag), header0: c.header0, body: c.body, value: toNano('0.05') });
      // reference reader gets an @ton/core Cell; the browser reader gets the SAME bytes through the client parser
      const reference = loadIntroPublish(Cell.fromBase64(built.body.toBoc().toString("base64")).beginParse());
      const browser = parseIntroPublish(overTheWire(built.body));

      expect(browser.r, 'ephemeral point').toBe(reference.r);
      expect(browser.viewTag, 'scan tag').toBe(Number(reference.view_tag));
      expect(await sameCell(browser.header0, reference.header_0), 'header cell').toBe(true);
      expect(await sameCell(browser.body, reference.body), 'body cell').toBe(true);
      // and it really is the values that were published, not just self-consistent
      expect(browser.r).toBe(c.r);
      expect(await sameCell(browser.body, c.body)).toBe(true);
    }
  }, 120_000);

  it('CODEC-02: anything that is not an IntroPublish is REFUSED, not partially read', async () => {
    // A shard's history carries evictions and plain top-ups too. Mistaking one for a capsule would hand the user
    // whatever cells happened to follow the opcode.
    const wrongOpcode = beginCell().storeUint(0x49535032, 32).storeUint(1, 256).storeUint(2, 16)
      .storeRef(cellOf(1)).storeRef(cellOf(2)).endCell();
    expect(() => parseIntroPublish(overTheWire(wrongOpcode))).toThrow(/not an IntroPublish/);
    expect(isIntroPublish(overTheWire(wrongOpcode))).toBe(false);

    const empty = beginCell().endCell();
    expect(() => parseIntroPublish(overTheWire(empty))).toThrow();
    expect(isIntroPublish(overTheWire(empty))).toBe(false);

    // right opcode, truncated payload: the bits simply are not there
    const truncated = beginCell().storeUint(INTRO_PUBLISH_OPCODE, 32).storeUint(5, 64).endCell();
    expect(() => parseIntroPublish(overTheWire(truncated))).toThrow();

    // right opcode and bits, but the refs are missing
    const noRefs = beginCell().storeUint(INTRO_PUBLISH_OPCODE, 32).storeUint(9n, 256).storeUint(3, 16).endCell();
    expect(() => parseIntroPublish(overTheWire(noRefs))).toThrow(/header_0/);
  }, 60_000);

  it('CODEC-03: get_entry stack parses, including the full-width commitment', () => {
    const stack = [
      { type: 'num', value: '-1' },
      { type: 'num', value: '0x' + 'ab'.repeat(32) },
      { type: 'num', value: '0x1234' },
      { type: 'num', value: '0x' + 'cd'.repeat(32) },
      { type: 'num', value: '0x6a9f1c00' },
    ];
    const parsed = parseIntroEntryStack(stack);
    expect(parsed.exists).toBe(true);
    expect(parsed.r).toBe(BigInt('0x' + 'ab'.repeat(32)));
    expect(parsed.view_tag).toBe(0x1234);
    expect(parsed.body_commit, 'the commitment the whole delivery check rests on').toBe(BigInt('0x' + 'cd'.repeat(32)));
    expect(parsed.created_at).toBe(0x6a9f1c00);

    expect(parseIntroEntryStack([{ value: '0' }, { value: '0' }, { value: '0' }, { value: '0' }, { value: '0' }]).exists).toBe(false);
    expect(() => parseIntroEntryStack([{ value: '1' }])).toThrow(/expected 5/);
  });

  it('CODEC-04: the parser walks a real shard history and picks out only the capsules', async () => {
    // The end-to-end shape of the delivery step: given everything a shard received, find the IntroPublishes.
    const blockchain = await Blockchain.create();
    blockchain.now = 1_790_000_000;
    const epoch = Math.floor(blockchain.now / 86400);
    const payer = await blockchain.treasury('codec-payer');

    const published: Cell[] = [];
    for (let i = 0; i < 3; i += 1) {
      const built = await buildIntroPublish({ epoch, bucket: 9n, r: BigInt(i + 1), viewTag: BigInt(i), header0: cellOf(i + 1), body: cellOf(i + 2, 128), value: toNano('0.05') });
      await payer.send({ to: built.to, value: built.value, body: built.body, init: built.init, bounce: true } as any);
      published.push(built.body);
      // a plain top-up between publishes — the shard accepts it and it is NOT a capsule
      await payer.send({ to: built.to, value: toNano('0.01'), bounce: false } as any);
    }

    const history = [...published, beginCell().endCell(), beginCell().storeUint(0, 32).endCell()].map(overTheWire);
    const capsules = history.filter((cell) => isIntroPublish(cell)).map((cell) => parseIntroPublish(cell));
    expect(capsules.length, 'exactly the three capsules, and nothing else').toBe(3);
    for (let i = 0; i < 3; i += 1) expect(capsules[i].r).toBe(BigInt(i + 1));
  }, 180_000);
});
