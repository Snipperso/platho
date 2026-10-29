import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createConvReadLane } from '../web/conv-lane.mjs';
import { beginCell, serializeBoc, parseBocBase64 } from '../web/pwa-contract-transactions.mjs';
import { CAPSULE_PUBLISH_OPCODE } from '../web/conv-lane-read.mjs';


const LANE = readFileSync('web/conv-lane.mjs', 'utf8');
const APP = readFileSync('web/app.js', 'utf8');
const SHARD = readFileSync('contracts/RecordShard.tact', 'utf8');

const PAGE = 128;
const SHARD_ADDRESS = `0:${'ab'.repeat(32)}`;
const KROOT = new Uint8Array(32).fill(0x5a);
const SELF = new Uint8Array(32).fill(0x11);
const PEER = new Uint8Array(32).fill(0x22);
const EPOCH = Math.floor(1_790_000_000 / 86400);
const onWire = (cell: any) => parseBocBase64(Buffer.from(serializeBoc(cell)).toString('base64'));

function bodyForSeq(seq: number) {
  const sig = beginCell().bytesValue(new Uint8Array(64), 64, 'sig').endCell();
  const bodySig = beginCell().ref(beginCell().endCell()).ref(sig).endCell();
  return onWire(beginCell()
    .uint(CAPSULE_PUBLISH_OPCODE, 32)
    .uint(BigInt(seq), 64)
    .ref(beginCell().endCell())
    .ref(beginCell().endCell())
    .ref(bodySig)
    .endCell());
}

const num = (src: string, re: RegExp): number => {
  const m = src.match(re);
  expect(m, `could not read ${re}`).not.toBeNull();
  return Number(m![1]);
};

describe('CONV-FULL-WALK-DEPTH', () => {
  it('CFW-01: a full rescan can reach every record the contract will store in one shard-day', () => {
    const pageSize = num(LANE, /const CONV_SHARD_MESSAGE_PAGE_LIMIT = (\d+);/);
    const deepCap = num(LANE, /const CONV_MAX_OLDER_BODY_PAGES_FULL = (\d+);/);
    const safeCap = num(SHARD, /const RS_SAFE_CAP: Int = (\d+);/);

    const reachable = pageSize + deepCap * pageSize;
    expect(reachable,
      `a full rescan reaches ${reachable} bodies against a contract cap of ${safeCap} — it cannot finish, and the `
      + 'UI reports success anyway').toBeGreaterThanOrEqual(safeCap);
  });

  it('CFW-02: the ROUTINE pass keeps its own, smaller bound — the spam defence is not what changed', () => {
    const routine = num(LANE, /const CONV_MAX_OLDER_BODY_PAGES = (\d+);/);
    const deep = num(LANE, /const CONV_MAX_OLDER_BODY_PAGES_FULL = (\d+);/);
    expect(routine, 'the routine cap must stay small — it is what stops a flooded shard costing a thousand requests')
      .toBeLessThanOrEqual(8);
    expect(deep, 'and the deep cap must be the deeper of the two, or the distinction does nothing')
      .toBeGreaterThan(routine);
  });

  it('CFW-03: the lane is TOLD which walk it is on, and the app tells it', () => {
    expect(LANE, 'readIncoming must accept the intent explicitly').toMatch(/fullWalk\s*=\s*false/);
    expect(LANE, 'and choose the cap from it').toMatch(/const walkFull = typeof fullWalk === 'function' \? fullWalk\(bucket\.address\) === true : fullWalk === true;/);
    expect(LANE).toMatch(/walkFull \? CONV_MAX_OLDER_BODY_PAGES_FULL/);
    expect(APP, 'the depth decision must name all three').toMatch(
      /const deepWalk = forceFull\s*\|\| \(\(plan\.cold === true \|\| convDeepWalkPending\.has\(convKey\)\) && !convDeepWalkHeldBack\(convKey\)\);/,
    );
    expect(APP, 'and both depth knobs must key off it').toMatch(/knownSeqOf: deepWalk \? \(\) => 0 : convBucketSeqHighWater,/);
    expect(APP, 'and both depth knobs must key off it').toMatch(/fullWalk: deepWalk,/);
    expect(APP, 'the plan must carry cold to the read loop').toMatch(/allPlans\.push\(\{ peerKeyId, peerWallet: record\.peerWallet \?\? null, windowW, rootShards, cold \}\);/);
  });

  it('CFW-04: a shard that outruns the reader is REPORTED short, on every pass, not warned about once', async () => {
    const total = 900;
    const rows: any[] = [];
    for (let seq = 1; seq <= total; seq += 1) rows.push({ seq, createdLt: BigInt(seq) });

    const calls: any[] = [];
    const lane = createConvReadLane({
      verifyWriteSig: false,
      readMessagesWithSource: async (_address: string, options: any = {}) => {
        calls.push(options?.endLt ?? null);
        const endLt = options?.endLt == null ? null : BigInt(options.endLt);
        const visible = endLt === null ? rows : rows.filter((r) => r.createdLt <= endLt);
        return visible.slice(-PAGE).reverse().map((r) => ({
          bodyCell: bodyForSeq(r.seq), createdLt: String(r.createdLt),
        }));
      },
    });

    const gaps: any[] = [];
    const failures: any[] = [];
    const read = async (knownMark: number, fullWalk: boolean) => {
      gaps.length = 0; failures.length = 0; calls.length = 0;
      lane.forgetShard(SHARD_ADDRESS);
      return lane.readIncoming({
        kRoot: KROOT, selfKeyId: SELF, peerKeyId: PEER, epochNow: EPOCH, windowW: 0,
        shards: [{ epoch: EPOCH, dir: 0, bucketKey: 1n, writePublicKey: new Uint8Array(32), address: SHARD_ADDRESS }],
        knownSeqOf: () => knownMark,
        onShardFailed: (address: string, error: any) => failures.push({ address, error }),
        onShardGap: (address: string, info: any) => gaps.push({ address, info }),
        fullWalk,
      });
    };

    const first = await read(5, false);
    expect(failures.map((f: any) => String(f.error?.message ?? f.error)), 'nothing FAILED — that is exactly why this was invisible').toEqual([]);
    expect(gaps, 'the short read must be reported').toHaveLength(1);
    expect(gaps[0].info.known).toBe(5);
    const seqs = first.map((entry: any) => Number(entry.seq)).sort((a: number, b: number) => a - b);
    expect(seqs[seqs.length - 1], 'the newest body is there').toBe(total);
    expect(seqs[0], 'and everything below the cap is not').toBeGreaterThan(6);
    expect(gaps[0].info.oldest, 'the gap names where it stopped').toBe(seqs[0]);

    const second = await read(5, false);
    expect(gaps, 'the second pass must report it too').toHaveLength(1);
    expect(second.length, 'and return the same short window').toBe(first.length);

    const deep = await read(0, true);
    expect(gaps, 'a full walk that reached the first record has no gap').toHaveLength(0);
    const deepSeqs = deep.map((entry: any) => Number(entry.seq));
    expect(Math.min(...deepSeqs), 'it descended to the first record').toBe(1);
    expect(deep.length).toBe(total);
  });
});
