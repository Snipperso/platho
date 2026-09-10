import { describe, expect, it } from 'vitest';
import {
  targetKeyOf, unpackTargetKey, reportRowKeyOf, reportBucketOf, reportEraOf, walletHashOf, walletHashHex, sanctionBucketOf,
  buildReportMessage, buildVerdictMessage, buildProposeMessage, buildApproveMessage, buildSetLedgerMessage,
  decodeSanctionMany, decodeReportPage, decodeLedgerView, decodeGateLedger, createSanctionCache, createReportQueueReader,
  createLocalMuteStore, REPORT_REASONS, REPORT_REASON_COUNT, REPORT_BUCKET_COUNT, REPORT_ERA_SECONDS, REPORT_DEPLOY_VALUE,
  VERDICT_ACTION, COUNCIL_KIND, WARNINGS_TO_RESTRICT, SANCTION_MANY_CAP, REPORT_ROW_BITS, decodeReportShardView, reportAttachValue,
  walletListCell, buildPruneWalletsMessage,
} from '../web/moderation.mjs';
import { decodeHiddenIds } from '../web/public-shard-ton-rpc-provider.mjs';
import { beginCell, serializeBoc, bytesToBase64, parseBocBase64 } from '../web/pwa-contract-transactions.mjs';
import { cellReader } from '../web/public-shard-ton-rpc-provider.mjs';
import { __setLaneGenerationCodeForTests, __resetLaneGenerationCodeOverridesForTests } from '../web/shard-address.mjs';
import { RECORDSHARD_CODE_BOC } from '../web/shard-code.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// MODERATION, THE PURE HALF [rebuilt 2026-09-04]: the keys (target and row), the messages, the decoders against
// synthetic cells in the contracts' layouts, the sanction cache (batching per bucket, the TTL, the "no shard"
// answer), the queue order, and the device-local mute. The seam with the compiled contracts is
// contracts18/tests/moderation-client.test.ts.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const GATE = '0:' + '11'.repeat(32);
const WALLET_A = '0:' + 'aa'.repeat(32);
const cellArg = (cell: any) => ({ type: 'cell', value: bytesToBase64(serializeBoc(cell)) });
const numItem = (v: bigint | number) => ({ type: 'num', value: `0x${BigInt(v).toString(16)}` });
const addressCell = (raw: string) => beginCell().address(raw, 'a').endCell();

describe('MODERATION — keys and messages', () => {
  it('MOD-01: the target key packs and unpacks, refuses out-of-range fields and a kind that is not the tag\'s', () => {
    const t = { generation: 18, kind: 1, epochTag: (1n << 32n) | 700n, shardSeq: 2, entryId: 9 };
    const key = targetKeyOf(t);
    expect(unpackTargetKey(key)).toEqual({ entryId: 9, shardSeq: 2, epochTag: (1n << 32n) | 700n, kind: 1, generation: 18 });
    expect(() => targetKeyOf({ ...t, kind: 0 })).toThrow(/kind 0 is not the kind/);
    expect(() => targetKeyOf({ ...t, entryId: 1n << 32n })).toThrow(/entryId/);
    expect(() => targetKeyOf({ ...t, generation: 256 })).toThrow(/generation/);
    expect(REPORT_REASONS.length).toBe(REPORT_REASON_COUNT);
    expect(reportEraOf(1_800_000_000)).toBe(Math.floor(1_800_000_000 / REPORT_ERA_SECONDS));
  });

  it('MOD-02: the row key is the hash of (target ‖ partition key), so a false key is another row and the bucket follows the row', async () => {
    const t = { generation: 18, kind: 0, epochTag: 700n, shardSeq: 0, entryId: 0 };
    const a = await reportRowKeyOf(t, 0xABCDn);
    const b = await reportRowKeyOf(t, 0xABCEn);
    expect(a).not.toBe(b);
    expect(a).toBe(await reportRowKeyOf(targetKeyOf(t), 0xABCDn));
    expect(reportBucketOf(a)).toBe(Number(a % BigInt(REPORT_BUCKET_COUNT)));
    await expect(reportRowKeyOf(t, 0n)).rejects.toThrow(/partitionKey/);
    // the same coordinates in two channels are two rows: the first channel's report cannot pin the second's
    const buckets = new Set<number>();
    for (let pk = 1n; pk < 200n; pk += 1n) buckets.add(reportBucketOf(await reportRowKeyOf(t, pk)));
    expect(buckets.size, 'the hash spreads the same coordinates over the buckets').toBeGreaterThan(40);
  });

  it('MOD-03: the report message carries every field the shard reads, the StateInit, and the value it was given', async () => {
    __setLaneGenerationCodeForTests('report', 18, RECORDSHARD_CODE_BOC);
    try {
      const target = { generation: 18, kind: 0, epochTag: 700n, shardSeq: 0, entryId: 3, partitionKey: 0xABCDn };
      const built = await buildReportMessage({ target, reason: 2, nowUnix: 1_800_000_000, value: 12_345_678n });
      expect(built.value).toBe(12_345_678n);
      expect(built.message.amount).toBe(12_345_678n);
      expect(built.era).toBe(reportEraOf(1_800_000_000));
      expect(built.bucket).toBe(reportBucketOf(built.rowKey));
      expect(built.message.stateInit).toBeTruthy();
      const body = parseBocBase64(built.message.payload);
      const r = (body as any).beginParse ? (body as any).beginParse() : null;
      void r;
      const plain = await buildReportMessage({ target, reason: 2, nowUnix: 1_800_000_000 });
      expect(plain.value, 'no value given: the empty-shard deploy figure').toBe(REPORT_DEPLOY_VALUE);
      await expect(buildReportMessage({ target, reason: 8, nowUnix: 1_800_000_000 })).rejects.toThrow(/reason 8/);
    } finally {
      __resetLaneGenerationCodeOverridesForTests();
    }
  });

  it('MOD-04: verdict shapes — an entry names a shard, a wallet a hash, a review both; the value is never guessed', () => {
    const ledger = '0:' + '22'.repeat(32);
    const shard = '0:' + '33'.repeat(32);
    expect(buildVerdictMessage(ledger, { action: VERDICT_ACTION.HIDE_ENTRY, shard, entryId: 5, value: 1n }).amount).toBe(1n);
    expect(() => buildVerdictMessage(ledger, { action: VERDICT_ACTION.HIDE_ENTRY, entryId: 5, value: 1n })).toThrow(/names a shard/);
    expect(() => buildVerdictMessage(ledger, { action: VERDICT_ACTION.WARN_WALLET, shard, key: 5n, value: 1n })).toThrow(/wallet hash and no shard/);
    expect(buildVerdictMessage(ledger, { action: VERDICT_ACTION.RESTRICT_WALLET, key: walletHashOf(WALLET_A), value: 1n }).address).toBe(ledger);
    expect(() => buildVerdictMessage(ledger, { action: VERDICT_ACTION.REVIEW_REPORT, key: 5n, value: 1n })).toThrow(/report shard and a row key/);
    expect(() => buildVerdictMessage(ledger, { action: VERDICT_ACTION.REVIEW_REPORT, shard, key: 5n })).toThrow(/value the ledger published/);
    expect(() => buildVerdictMessage(ledger, { action: 8, shard, entryId: 1, value: 1n })).toThrow(/unknown verdict action/);
    expect(buildVerdictMessage(ledger, { action: VERDICT_ACTION.UNWARN_WALLET, key: 5n, value: 1n }).address, 'UNWARN is a wallet action').toBe(ledger);
    expect(() => buildVerdictMessage(ledger, { action: VERDICT_ACTION.UNWARN_WALLET, shard, key: 5n, value: 1n })).toThrow(/wallet hash and no shard/);
    // council: the approval names what it seconds
    expect(buildProposeMessage(ledger, { kind: COUNCIL_KIND.ADD_MODERATOR, a: WALLET_A }).amount).toBe(3_000_000n);
    expect(buildApproveMessage(ledger, { proposer: WALLET_A, kind: COUNCIL_KIND.SET_LEDGER, a: shard }).payload.length).toBeGreaterThan(40);
    expect(() => buildApproveMessage(ledger, { proposer: WALLET_A, kind: 9, a: shard })).toThrow(/unknown council kind/);
    expect(buildSetLedgerMessage(GATE, { ledger }).address).toBe(GATE);
    expect(walletHashHex(WALLET_A)).toBe('aa'.repeat(32));
    expect(sanctionBucketOf(WALLET_A)).toBe(Number(walletHashOf(WALLET_A) % 64n));
  });
});

describe('MODERATION — decoders against the contracts\' layouts', () => {
  it('MOD-05b: the hidden INDEX decodes across cells and says when it stopped short, the report view names the premium, the attach value follows the fill and the repeat, the prune list is the getter\'s shape', () => {
    // 31 ids per cell, tail first: the head carries the first 31, the ref the rest
    const tail = beginCell().uint(100n, 32, 'id').uint(101n, 32, 'id').endCell();
    let head = beginCell();
    for (let i = 0; i < 31; i += 1) head = head.uint(BigInt(i * 3), 32, 'id');
    const map = decodeHiddenIds({ stack: [numItem(33), numItem(33), cellArg(head.ref(tail).endCell())] });
    expect([map.count, map.returned, map.complete]).toEqual([33, 33, true]);
    expect([...map.hidden].sort((a, b) => a - b)).toEqual([...Array.from({ length: 31 }, (_, i) => i * 3), 100, 101]);
    //...and an answer that named fewer than the shard holds says so, so a reader only ADDS from it
    const short = decodeHiddenIds({ stack: [numItem(900), numItem(2), cellArg(beginCell().uint(7n, 32, 'id').uint(9n, 32, 'id').endCell())] });
    expect([short.count, short.returned, [...short.hidden], short.complete]).toEqual([900, 2, [7, 9], false]);
    // the report view: twelve items, the premium among them
    const view = decodeReportShardView({ stack: [numItem(700), numItem(3), numItem(2048), numItem(8192), numItem(5_000_000), numItem(8_100_000), numItem(250_000),
      numItem(7_600_000), numItem(10_350_000), numItem(1_900_000_000), cellArg(addressCell(GATE)), cellArg(addressCell(GATE))] });
    expect(view.ladder_premium).toBe(250_000n);
    expect(reportAttachValue({ live: true, targetCount: 2048, minValue: 8_100_000n, deployMinValue: 10_350_000n })).toBe(8_100_000n);
    expect(reportAttachValue({ live: true, targetCount: 0, minValue: 7_850_000n, deployMinValue: 10_350_000n }), 'a live shard with no row still demands the deploy figure').toBe(10_350_000n);
    expect(reportAttachValue({ live: false, targetCount: 0, minValue: 10_350_000n, deployMinValue: 10_350_000n })).toBe(10_350_000n);
    // A REPEAT PAYS THE FLAT FIGURE [round 3]: the shard charges repeat_value for a row already there, so asking
    // the fresh-row price would hand the ladder's premium (x2 every 512 rows past 2,048) to the second reporter.
    expect(reportAttachValue({ live: true, targetCount: 4096, minValue: 65_000_000n, deployMinValue: 10_350_000n, repeatValue: 7_600_000n }, true)).toBe(7_600_000n);
    expect(reportAttachValue({ live: false, targetCount: 0, minValue: 10_350_000n, deployMinValue: 10_350_000n }, true), 'a shard that is not there still takes the deploy figure').toBe(10_350_000n);
    // the prune list: three per cell, chained by the first ref, tail first — what the shard walks
    const list = walletListCell([1n, 2n, 3n, 4n]);
    const r = cellReader(list);
    expect([r.loadUint(256), r.loadUint(256), r.loadUint(256)]).toEqual([1n, 2n, 3n]);
    expect(r.refs()).toBe(1);
    expect(cellReader(r.loadRef()).loadUint(256)).toBe(4n);
    expect(buildPruneWalletsMessage(GATE, [1n, 2n]).address).toBe(GATE);
    expect(() => buildPruneWalletsMessage(GATE, [])).toThrow(/1\.\.32/);
  });

  it('MOD-05: get_many, a report page, the ledger view and the gate\'s ledger decode from synthetic cells', () => {
    // get_many: count 8 | (restricted 1 | warnings 8) x n
    const many = beginCell().uint(3n, 8, 'n').uint(1n, 1, 'r').uint(0n, 8, 'w').uint(0n, 1, 'r').uint(2n, 8, 'w').uint(0n, 1, 'r').uint(0n, 8, 'w').endCell();
    expect(decodeSanctionMany({ stack: [cellArg(many)] })).toEqual([{ restricted: true, warnings: 0 }, { restricted: false, warnings: 2 }, { restricted: false, warnings: 0 }]);
    // a report page: one 656-bit row per cell, tail first
    const key = targetKeyOf({ generation: 18, kind: 1, epochTag: (1n << 32n) | 700n, shardSeq: 0, entryId: 4 });
    const row = (k: bigint, pk: bigint, count: bigint, reviewed: bigint) => beginCell().uint(k, 256, 't').uint(pk, 256, 'p').uint(count, 32, 'c').uint(reviewed, 32, 'r').uint(5n, 16, 'm').uint(10n, 32, 'f').uint(20n, 32, 'l');
    const tail = row(key, 2n, 3n, 3n).endCell();
    const head = row(key, 1n, 7n, 2n).ref(tail).endCell();
    expect(REPORT_ROW_BITS).toBe(656);
    const page = decodeReportPage({ stack: [numItem(0), numItem(2), numItem(2), cellArg(head)] });
    expect(page.rows.length).toBe(2);
    expect(page.rows[0]).toMatchObject({ partitionKey: 1n, count: 7, reviewedCount: 2, reasons: 5, firstAt: 10, lastAt: 20 });
    expect(page.rows[0].target).toEqual(unpackTargetKey(key));
    expect(page.rows[1]).toMatchObject({ partitionKey: 2n, count: 3, reviewedCount: 3 });
    // the ledger view: nine ints then the gate address
    const view = decodeLedgerView({ stack: [numItem(3), numItem(2), numItem(2), numItem(2_592_000), numItem(500), numItem(6_000_000), numItem(16_000_000),
      numItem(6_000_000), numItem(3_000_000), cellArg(addressCell(GATE))] });
    expect(view.moderator_count).toBe(2n);
    expect(view.wallet_min_value).toBe(16_000_000n);
    expect(view.gate).toBe(GATE);
    // the gate's ledger: an address, or addr_none while nothing is seated
    expect(decodeGateLedger({ stack: [cellArg(addressCell(WALLET_A))] })).toBe(WALLET_A);
    expect(decodeGateLedger({ stack: [cellArg(beginCell().uint(0n, 2, 'none').endCell())] })).toBeNull();
    expect(decodeGateLedger({ stack: [{ type: 'null', value: null }] })).toBeNull();
  });
});

describe('MODERATION — the sanction cache and the queue', () => {
  it('MOD-06: lookups batch per bucket in one call, cache for the TTL, and a shard that is not there answers clear', async () => {
    __setLaneGenerationCodeForTests('sanction', 18, RECORDSHARD_CODE_BOC);
    try {
      let clock = 1_000;
      const calls: any[] = [];
      const wallets = Array.from({ length: 10 }, (_, i) => '0:' + (i + 1).toString(16).padStart(64, '0'));
      const restricted = new Set([wallets[3], wallets[7]]);
      const runGetMethod = async (call: any) => {
        calls.push(call);
        if (call.method !== 'get_many') throw new Error('unexpected ' + call.method);
        // a bucket shard whose address ends the same way as wallet 5's bucket is "not deployed"
        const hashes: bigint[] = [];
        let cell: any = parseBocBase64(call.stack[0].value);
        while (cell) {
          const r = cellReader(cell);
          while (r.remaining() >= 256) hashes.push(r.loadUint(256));
          cell = r.refs() > 0 ? r.loadRef() : null;
        }
        if (hashes.some((h) => h === walletHashOf(wallets[5]))) return { exit_code: -13, stack: [] };
        let b = beginCell().uint(BigInt(hashes.length), 8, 'n');
        for (const h of hashes) {
          const w = wallets.find((x) => walletHashOf(x) === h)!;
          b = b.uint(restricted.has(w) ? 1n : 0n, 1, 'r').uint(BigInt(w === wallets[1] ? 2 : 0), 8, 'w');
        }
        return { exit_code: 0, stack: [cellArg(b.endCell())] };
      };
      const cache = createSanctionCache({ runGetMethod, gateAddress: GATE, ttlMs: 600, now: () => clock });
      expect(cache.get(wallets[0])).toBeNull();
      await cache.lookup(wallets);
      const bucketsAsked = new Set(calls.map((c) => c.address));
      expect(calls.length, 'one call per bucket shard').toBe(bucketsAsked.size);
      expect(cache.isRestricted(wallets[3])).toBe(true);
      expect(cache.isRestricted(wallets[0])).toBe(false);
      expect(cache.warningsOf(wallets[1])).toBe(2);
      expect(cache.get(wallets[5]), 'a bucket with no shard: clear, cached').toMatchObject({ restricted: false, warnings: 0 });
      const before = calls.length;
      await cache.lookup(wallets);
      expect(calls.length, 'inside the TTL nothing is re-read').toBe(before);
      clock += 601;
      await cache.lookup([wallets[3]]);
      expect(calls.length).toBe(before + 1);
      cache.invalidate(wallets[0]);
      expect(cache.get(wallets[0])).toBeNull();
      // a short answer is a broken read: the wallets asked keep their last answers, nothing is read as "clear"
      const short = createSanctionCache({ runGetMethod: async () => ({ exit_code: 0, stack: [cellArg(beginCell().uint(1n, 8, 'n').uint(1n, 1, 'r').uint(0n, 8, 'w').endCell())] }), gateAddress: GATE, ttlMs: 600, now: () => clock });
      const sameBucket = ['0:' + (1).toString(16).padStart(64, '0'), '0:' + (65).toString(16).padStart(64, '0')];   // one bucket, one chunk of two
      await short.lookup(sameBucket);
      expect(short.get(sameBucket[0]), 'not answered: not cached').toBeNull();
      expect(SANCTION_MANY_CAP).toBe(96);
      expect(WARNINGS_TO_RESTRICT).toBe(3);
    } finally {
      __resetLaneGenerationCodeOverridesForTests();
    }
  });

  it('MOD-07: the queue sweeps the live shards of an era and sorts by what arrived since the last look', async () => {
    __setLaneGenerationCodeForTests('report', 18, RECORDSHARD_CODE_BOC);
    try {
      const key = targetKeyOf({ generation: 18, kind: 0, epochTag: 700n, shardSeq: 0, entryId: 1 });
      const row = (pk: bigint, count: bigint, reviewed: bigint, lastAt: bigint) => beginCell().uint(key, 256, 't').uint(pk, 256, 'p').uint(count, 32, 'c').uint(reviewed, 32, 'r').uint(1n, 16, 'm').uint(1n, 32, 'f').uint(lastAt, 32, 'l');
      const pages = new Map<string, any>();
      const readStates = async (addresses: string[]) => {
        const states = new Map();
        // buckets 0 and 1 live, the rest untouched
        states.set(addresses[0].toLowerCase(), { status: 'active' }); states.set(addresses[1].toLowerCase(), { status: 'active' });
        pages.set(addresses[0], row(1n, 9n, 9n, 5n).ref(row(2n, 4n, 0n, 6n).endCell()).endCell());   // 0 new, 4 new
        pages.set(addresses[1], row(3n, 2n, 0n, 7n).endCell());                                   // 2 new
        return { get: (k: string) => states.get(k.toLowerCase()) };
      };
      const runGetMethod = async (call: any) => {
        const cell = pages.get(call.address) ?? pages.get(Object.keys(Object.fromEntries(pages)).find((k) => k.toLowerCase() === String(call.address).toLowerCase())!);
        const n = call.address === [...pages.keys()][0] || String(call.address).toLowerCase() === [...pages.keys()][0].toLowerCase() ? 2 : 1;
        return { exit_code: 0, stack: [numItem(0), numItem(n), numItem(n), cellArg(cell)] };
      };
      const sweep = createReportQueueReader({ readStates: readStates as any, runGetMethod });
      const queue = await sweep(700);
      expect(queue.map((r) => [Number(r.partitionKey), r.unreviewed])).toEqual([[2, 4], [3, 2], [1, 0]]);
      expect(queue[0].bucket).toBe(0);
      expect(queue[1].bucket).toBe(1);
    } finally {
      __resetLaneGenerationCodeOverridesForTests();
    }
  });

  it('MOD-08: the device-local mute survives a reload and never throws on a broken store', () => {
    const backing = new Map<string, string>();
    const storage = { getItem: (k: string) => backing.get(k) ?? null, setItem: (k: string, v: string) => { backing.set(k, v); } };
    const a = createLocalMuteStore(storage as any);
    a.add('0:' + 'ab'.repeat(32));
    expect(a.has('0:' + 'AB'.repeat(32))).toBe(true);
    const b = createLocalMuteStore(storage as any);
    expect(b.list().length).toBe(1);
    b.remove('0:' + 'ab'.repeat(32));
    expect(createLocalMuteStore(storage as any).has('0:' + 'ab'.repeat(32))).toBe(false);
    const broken = createLocalMuteStore({ getItem: () => { throw new Error('nope'); }, setItem: () => { throw new Error('nope'); } } as any);
    expect(broken.has('0:' + 'ab'.repeat(32))).toBe(false);
    expect(() => broken.add('0:' + 'ab'.repeat(32))).not.toThrow();
  });
});
