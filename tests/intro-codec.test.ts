import { describe, expect, it } from 'vitest';
import { Blockchain } from '@ton/sandbox';
import { beginCell, toNano, Cell } from '@ton/core';
import { loadIntroPublish } from '../build/IntroShard/IntroShard_IntroShard';
import { buildIntroPublish } from '../web/publish-builder.mjs';
import { parseIntroPublish, isIntroPublish, parseIntroEntryStack, INTRO_PUBLISH_OPCODE } from '../web/intro-codec.mjs';
import { parseBocBase64, computeCellHashAndDepth } from '../web/pwa-contract-transactions.mjs';


const cellOf = (fill: number, len = 64) => {
  const buf = Buffer.alloc(len, fill);
  const chunks: Buffer[] = [];
  for (let i = 0; i < Math.max(len, 1); i += 127) chunks.push(buf.subarray(i, Math.min(i + 127, len)));
  let cell = beginCell().storeBuffer(chunks[chunks.length - 1]).endCell();
  for (let i = chunks.length - 2; i >= 0; i -= 1) cell = beginCell().storeBuffer(chunks[i]).storeRef(cell).endCell();
  return cell;
};

const overTheWire = (cell: Cell) => parseBocBase64(cell.toBoc().toString('base64'));
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
      const reference = loadIntroPublish(Cell.fromBase64(built.body.toBoc().toString("base64")).beginParse());
      const browser = parseIntroPublish(overTheWire(built.body));

      expect(browser.r, 'ephemeral point').toBe(reference.r);
      expect(browser.viewTag, 'scan tag').toBe(Number(reference.view_tag));
      expect(await sameCell(browser.header0, reference.header_0), 'header cell').toBe(true);
      expect(await sameCell(browser.body, reference.body), 'body cell').toBe(true);
      expect(browser.r).toBe(c.r);
      expect(await sameCell(browser.body, c.body)).toBe(true);
    }
  }, 120_000);

  it('CODEC-02: anything that is not an IntroPublish is REFUSED, not partially read', async () => {
    const wrongOpcode = beginCell().storeUint(0x49535032, 32).storeUint(1, 256).storeUint(2, 16)
      .storeRef(cellOf(1)).storeRef(cellOf(2)).endCell();
    expect(() => parseIntroPublish(overTheWire(wrongOpcode))).toThrow(/not an IntroPublish/);
    expect(isIntroPublish(overTheWire(wrongOpcode))).toBe(false);

    const empty = beginCell().endCell();
    expect(() => parseIntroPublish(overTheWire(empty))).toThrow();
    expect(isIntroPublish(overTheWire(empty))).toBe(false);

    const truncated = beginCell().storeUint(INTRO_PUBLISH_OPCODE, 32).storeUint(5, 64).endCell();
    expect(() => parseIntroPublish(overTheWire(truncated))).toThrow();

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
    const blockchain = await Blockchain.create();
    blockchain.now = 1_790_000_000;
    const epoch = Math.floor(blockchain.now / 86400);
    const payer = await blockchain.treasury('codec-payer');

    const published: Cell[] = [];
    for (let i = 0; i < 3; i += 1) {
      const built = await buildIntroPublish({ epoch, bucket: 9n, r: BigInt(i + 1), viewTag: BigInt(i), header0: cellOf(i + 1), body: cellOf(i + 2, 128), value: toNano('0.05') });
      await payer.send({ to: built.to, value: built.value, body: built.body, init: built.init, bounce: true } as any);
      published.push(built.body);
      await payer.send({ to: built.to, value: toNano('0.01'), bounce: false } as any);
    }

    const history = [...published, beginCell().endCell(), beginCell().storeUint(0, 32).endCell()].map(overTheWire);
    const capsules = history.filter((cell) => isIntroPublish(cell)).map((cell) => parseIntroPublish(cell));
    expect(capsules.length, 'exactly the three capsules, and nothing else').toBe(3);
    for (let i = 0; i < 3; i += 1) expect(capsules[i].r).toBe(BigInt(i + 1));
  }, 180_000);
});
