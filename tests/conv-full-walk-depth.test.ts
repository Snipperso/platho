import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createConvReadLane } from '../web/conv-lane.mjs';
import { beginCell, serializeBoc, parseBocBase64 } from '../web/pwa-contract-transactions.mjs';
import { CAPSULE_PUBLISH_OPCODE } from '../web/conv-lane-read.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// CONV FULL-WALK DEPTH — "rescan everything" must be able to actually finish.
//
// The routine incoming pass bounds how far back it pages: 128 in the newest window plus at most four older
// pages, so 640 bodies per shard-day. That bound is right for a pass the user did not ask for — it is what stops
// a flooded shard turning one sync into a thousand requests, and the lane's own note MEASURED the case it was
// written for: 3,968 records written into one direction-epoch in ten minutes.
//
// It was the WRONG bound for the walk the user DID ask for. app.js lends `knownSeqOf: => 0` on a manual
// rescan — "hold nothing, but DO descend" — and its comment says the lane then pages every full shard down to
// its first record "within its per-pass page cap". At four pages that sentence was false: 640 against the
// RS_SAFE_CAP = 4096 a shard-day can hold. On the measured 3,968-record shard a full rescan reached 640, came
// back clean, and the UI said up to date. The user asked to walk everything and was told it had been done.
//
// A SOURCE gate on purpose: what it guards is a relationship between three numbers in two files (the deep cap,
// the page size, and the contract's own SAFE_CAP), and the regression arrives by editing one of them. A
// behavioural test would need a 4,096-record fixture to see the difference at all.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const LANE = readFileSync('web/conv-lane.mjs', 'utf8');
const APP = readFileSync('web/app.js', 'utf8');
const SHARD = readFileSync('contracts/RecordShard.tact', 'utf8');

// ── the behavioural fixture for CFW-04 ────────────────────────────────────────────────────────────────────
const PAGE = 128;                                  // CONV_SHARD_MESSAGE_PAGE_LIMIT
const SHARD_ADDRESS = `0:${'ab'.repeat(32)}`;
const KROOT = new Uint8Array(32).fill(0x5a);
const SELF = new Uint8Array(32).fill(0x11);
const PEER = new Uint8Array(32).fill(0x22);
const EPOCH = Math.floor(1_790_000_000 / 86400);
const onWire = (cell: any) => parseBocBase64(Buffer.from(serializeBoc(cell)).toString('base64'));

/**
 * The smallest cell parseCapsulePublishBody accepts, carrying one seq. Deliberately NOT a real sealed capsule:
 * this test needs 900 bodies to reach the page cap at all, and 900 real ML-KEM seals would cost minutes to prove
 * a paging property that never looks inside the body. The lane is built with verifyWriteSig: false for the same
 * reason — CONV-LANE-01 already proves the signature gate against real capsules.
 */
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

    // The newest window plus the deep backfill must cover what one shard-day can hold.
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
    // Lending knownSeqOf = => 0 makes the lane descend; on its own it never made it descend far enough, and
    // the lane cannot tell that call from a device that genuinely holds seq 0.
    expect(LANE, 'readIncoming must accept the intent explicitly').toMatch(/fullWalk\s*=\s*false/);
    expect(LANE, 'and choose the cap from it').toMatch(/fullWalk \? CONV_MAX_OLDER_BODY_PAGES_FULL/);
    // THREE WALKS ARE DEEP, not one [audit 2026-09-01, round 9]. The manual rescan was the only caller that
    // descended; a COLD record (fresh, restored, history cleared) widened its epoch range to birth and then read
    // the newest 128 bodies of each shard-day and marked the day fully read, and a conversation a routine pass
    // came back SHORT on repeated that short read forever. Both now take the same depth the manual Sync takes.
    expect(APP, 'the depth decision must name all three').toMatch(
      /const deepWalk = forceFull \|\| plan\.cold === true \|\| convDeepWalkPending\.has\(convKey\);/,
    );
    expect(APP, 'and both depth knobs must key off it').toMatch(/knownSeqOf: deepWalk \? \(\) => 0 : convBucketSeqHighWater,/);
    expect(APP, 'and both depth knobs must key off it').toMatch(/fullWalk: deepWalk,/);
    // `cold` has to REACH the read loop — it is computed per conversation in the planning pass, and only the
    // epoch range used it before, so the plan object had no reason to carry it.
    // The plan also carries the peer's wallet since F-23 (a restored conversation follows the contact's channel).
    expect(APP, 'the plan must carry cold to the read loop').toMatch(/plans\.push\(\{ peerKeyId, peerWallet: record\.peerWallet \?\? null, windowW, rootShards, cold \}\);/);
  });

  it('CFW-04: a shard that outruns the reader is REPORTED short, on every pass, not warned about once', async () => {
    // THE DEFECT [audit 2026-09-01, round 9], driven rather than read. A routine pass reads the newest
    // CONV_SHARD_MESSAGE_PAGE_LIMIT bodies and pages back at most CONV_MAX_OLDER_BODY_PAGES more to reach the
    // device's mark. Past that it warned once per shard and returned what it had — and because nothing had
    // FAILED, the caller advanced the shard's seq high-water to the top of the window and its scan cursor past
    // the epoch. The bodies in between are on chain, paid for, and never read again: the pre-decrypt gate skips
    // everything at or below the mark, and the mark is rebuilt at boot as the MAX of stored messages, so a reload
    // re-derives it above the same hole. Permanent, silent loss of private messages.
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
        // Newest-first, one page at a time — the shape toncenter returns.
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

    // A device holding seq 5 against a shard that has run to 900: the routine cap cannot reach it.
    const first = await read(5, false);
    expect(failures.map((f: any) => String(f.error?.message ?? f.error)), 'nothing FAILED — that is exactly why this was invisible').toEqual([]);
    expect(gaps, 'the short read must be reported').toHaveLength(1);
    expect(gaps[0].info.known).toBe(5);
    // What it did return: the newest page plus the four it could page back, and nothing below.
    const seqs = first.map((entry: any) => Number(entry.seq)).sort((a: number, b: number) => a - b);
    expect(seqs[seqs.length - 1], 'the newest body is there').toBe(total);
    expect(seqs[0], 'and everything below the cap is not').toBeGreaterThan(6);
    expect(gaps[0].info.oldest, 'the gap names where it stopped').toBe(seqs[0]);

    // EVERY PASS, not once. The console line is throttled per shard; throttling the callback would restore the
    // loss from the second pass onward — the caller would advance its mark over the same hole.
    const second = await read(5, false);
    expect(gaps, 'the second pass must report it too').toHaveLength(1);
    expect(second.length, 'and return the same short window').toBe(first.length);

    // The deep walk the escalation queues reaches bottom, and then there is no gap to report.
    const deep = await read(0, true);
    expect(gaps, 'a full walk that reached the first record has no gap').toHaveLength(0);
    const deepSeqs = deep.map((entry: any) => Number(entry.seq));
    expect(Math.min(...deepSeqs), 'it descended to the first record').toBe(1);
    expect(deep.length).toBe(total);
  });
});
