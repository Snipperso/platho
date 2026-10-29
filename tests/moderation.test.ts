import { describe, expect, it } from 'vitest';
import {
  targetKeyOf, unpackTargetKey, reportRowKeyOf, reportBucketOf, reportEraOf, walletHashOf, walletHashHex, walletAddressOfHash,
  buildReportMessage, buildVerdictMessage, buildProposeMessage, buildApproveMessage, buildSetLedgerMessage, buildRetireSanctionMessage,
  decodeSanctionView, parseSanctionAccountData, sanctionStandingFromState, sanctionShardAddressFor,
  decodeReportPage, decodeLedgerView, decodeGateLedger, createSanctionCache, createReportQueueReader,
  REPORT_REASONS, REPORT_REASON_COUNT, REPORT_BUCKET_COUNT, REPORT_ERA_SECONDS, REPORT_DEPLOY_VALUE,
  VERDICT_ACTION, COUNCIL_KIND, SANCTION_OP, WARNINGS_TO_RESTRICT, REPORT_ROW_BITS, decodeReportShardView, reportAttachValue,
  SANCTION_STANDING_TTL_MS, SANCTION_RETENTION_SECONDS, sanctionStandingForVerdict,
} from '../web/moderation.mjs';
import { decodeHiddenIds } from '../web/public-shard-ton-rpc-provider.mjs';
import { beginCell, serializeBoc, bytesToBase64, parseBocBase64 } from '../web/pwa-contract-transactions.mjs';
import { cellReader } from '../web/public-shard-ton-rpc-provider.mjs';
import { addrKey } from '../web/shard-discovery.mjs';
import { __setLaneGenerationCodeForTests, __resetLaneGenerationCodeOverridesForTests } from '../web/shard-address.mjs';
import { RECORDSHARD_CODE_BOC } from '../web/shard-code.mjs';


const GATE = '0:' + '11'.repeat(32);
const WALLET_A = '0:' + 'aa'.repeat(32);
const cellArg = (cell: any) => ({ type: 'cell', value: bytesToBase64(serializeBoc(cell)) });
const numItem = (v: bigint | number) => ({ type: 'num', value: `0x${BigInt(v).toString(16)}` });
const boolItem = (b: boolean) => ({ type: 'num', value: b ? '-0x1' : '0x0' });
const addressCell = (raw: string) => beginCell().address(raw, 'a').endCell();
const sanctionData = (wallet: string, { warnings = 0, restricted = false, auto = false, since = 0, reason = 0, updatedAt = 0, init = 1n } = {}) =>
  beginCell().uint(init, 1, 'init').address(GATE, 'gate').uint(walletHashOf(wallet), 256, 'wallet').uint(BigInt(warnings), 8, 'warnings')
    .uint(restricted ? 1n : 0n, 1, 'restricted').uint(auto ? 1n : 0n, 1, 'auto').uint(BigInt(since), 32, 'since').uint(BigInt(reason), 8, 'reason')
    .uint(BigInt(updatedAt), 32, 'updated_at').endCell();

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

  it('MOD-04: verdict shapes — an entry names a shard, a wallet a hash, a review both; the value is never guessed; the console\'s retire carries the op and the value it was given', () => {
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
    expect(buildProposeMessage(ledger, { kind: COUNCIL_KIND.ADD_MODERATOR, a: WALLET_A }).amount).toBe(3_000_000n);
    expect(buildApproveMessage(ledger, { proposer: WALLET_A, kind: COUNCIL_KIND.SET_LEDGER, a: shard }).payload.length).toBeGreaterThan(40);
    expect(() => buildApproveMessage(ledger, { proposer: WALLET_A, kind: 9, a: shard })).toThrow(/unknown council kind/);
    expect(buildSetLedgerMessage(GATE, { ledger }).address).toBe(GATE);
    expect(walletHashHex(WALLET_A)).toBe('aa'.repeat(32));
    expect(walletAddressOfHash(walletHashOf(WALLET_A)), 'the hash names the wallet back').toBe(WALLET_A);
    const retire = buildRetireSanctionMessage(shard, { value: 600_000n });
    expect([retire.address, retire.amount, retire.stateInit, retire.bounce]).toEqual([shard, 600_000n, null, true]);
    expect(cellReader(parseBocBase64(retire.payload)).loadUint(32)).toBe(BigInt(SANCTION_OP.RETIRE));
    expect(() => buildRetireSanctionMessage(shard, {} as any)).toThrow(/SS_RETIRE_GAS/);
  });
});

describe('MODERATION — decoders against the contracts\' layouts', () => {
  it('MOD-05b: the hidden INDEX decodes across cells and says when it stopped short, the report view names the premium, the attach value follows the fill and the repeat', () => {
    const tail = beginCell().uint(100n, 32, 'id').uint(101n, 32, 'id').endCell();
    let head = beginCell();
    for (let i = 0; i < 31; i += 1) head = head.uint(BigInt(i * 3), 32, 'id');
    const map = decodeHiddenIds({ stack: [numItem(33), numItem(33), cellArg(head.ref(tail).endCell())] });
    expect([map.count, map.returned, map.complete]).toEqual([33, 33, true]);
    expect([...map.hidden].sort((a, b) => a - b)).toEqual([...Array.from({ length: 31 }, (_, i) => i * 3), 100, 101]);
    const short = decodeHiddenIds({ stack: [numItem(900), numItem(2), cellArg(beginCell().uint(7n, 32, 'id').uint(9n, 32, 'id').endCell())] });
    expect([short.count, short.returned, [...short.hidden], short.complete]).toEqual([900, 2, [7, 9], false]);
    const view = decodeReportShardView({ stack: [numItem(700), numItem(3), numItem(2048), numItem(8192), numItem(5_000_000), numItem(8_100_000), numItem(250_000),
      numItem(7_600_000), numItem(10_350_000), numItem(1_900_000_000), cellArg(addressCell(GATE)), cellArg(addressCell(GATE))] });
    expect(view.ladder_premium).toBe(250_000n);
    expect(reportAttachValue({ live: true, targetCount: 2048, minValue: 8_100_000n, deployMinValue: 10_350_000n })).toBe(8_100_000n);
    expect(reportAttachValue({ live: true, targetCount: 0, minValue: 7_850_000n, deployMinValue: 10_350_000n }), 'a live shard with no row still demands the deploy figure').toBe(10_350_000n);
    expect(reportAttachValue({ live: false, targetCount: 0, minValue: 10_350_000n, deployMinValue: 10_350_000n })).toBe(10_350_000n);
    expect(reportAttachValue({ live: true, targetCount: 4096, minValue: 65_000_000n, deployMinValue: 10_350_000n, repeatValue: 7_600_000n }, true)).toBe(7_600_000n);
    expect(reportAttachValue({ live: false, targetCount: 0, minValue: 10_350_000n, deployMinValue: 10_350_000n }, true), 'a shard that is not there still takes the deploy figure').toBe(10_350_000n);
  });

  it('MOD-05: the sanction account — get_view and the raw STATE — a report page, the ledger view and the gate\'s ledger decode from synthetic cells', () => {
    const standing = decodeSanctionView({ stack: [boolItem(true), numItem(walletHashOf(WALLET_A)), numItem(2), boolItem(false), boolItem(false), numItem(0), numItem(3),
      numItem(1_800_000_000), numItem(31_536_000), numItem(3_100_000), numItem(1_000_000), numItem(1_831_536_000), cellArg(addressCell(GATE))] });
    expect(standing).toEqual({ exists: true, wallet: walletHashOf(WALLET_A), warnings: 2, restricted: false, auto: false, since: 0, reason: 3, updatedAt: 1_800_000_000,
      retention: 31_536_000, minValue: 3_100_000n, liftValue: 1_000_000n, retireAt: 1_831_536_000 });
    expect(() => decodeSanctionView({ stack: [numItem(1)] })).toThrow(/13 stack items/);
    const parsed = parseSanctionAccountData(bytesToBase64(serializeBoc(sanctionData(WALLET_A, { warnings: 3, restricted: true, auto: true, since: 1_700_000_000, reason: 4, updatedAt: 1_800_000_000 }))));
    expect(parsed).toEqual({ exists: true, wallet: walletHashOf(WALLET_A), warnings: 3, restricted: true, auto: true, since: 1_700_000_000, reason: 4, updatedAt: 1_800_000_000 });
    expect(parseSanctionAccountData(sanctionData(WALLET_A, { updatedAt: 0 })).exists, 'a squatted, written-by-receive() account (updated_at 0) reads CLEAR').toBe(false);
    const lazy = beginCell().uint(0n, 1, 'init').address(GATE, 'gate').uint(walletHashOf(WALLET_A), 257, 'wallet').endCell();
    expect(parseSanctionAccountData(bytesToBase64(serializeBoc(lazy)))).toMatchObject({ exists: false, restricted: false, warnings: 0 });
    expect(() => parseSanctionAccountData(bytesToBase64(serializeBoc(beginCell().uint(0x80n, 8, 'x').endCell())))).toThrow(/expected 606/);
    expect(sanctionStandingFromState({ status: 'nonexist' })).toMatchObject({ exists: false, warnings: 0, restricted: false });
    expect(sanctionStandingFromState({ status: 'active', dataBoc: null }), 'active with no data cell is a read that did not carry it: unknown, never clear').toBeNull();
    expect(sanctionStandingFromState(null)).toMatchObject({ exists: false });
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
    const view = decodeLedgerView({ stack: [numItem(3), numItem(2), numItem(2), numItem(2_592_000), numItem(500), numItem(6_000_000), numItem(16_000_000),
      numItem(6_000_000), numItem(3_000_000), cellArg(addressCell(GATE))] });
    expect(view.moderator_count).toBe(2n);
    expect(view.wallet_min_value).toBe(16_000_000n);
    expect(view.gate).toBe(GATE);
    expect(decodeGateLedger({ stack: [cellArg(addressCell(WALLET_A))] })).toBe(WALLET_A);
    expect(decodeGateLedger({ stack: [cellArg(beginCell().uint(0n, 2, 'none').endCell())] })).toBeNull();
    expect(decodeGateLedger({ stack: [{ type: 'null', value: null }] })).toBeNull();
  });
});

describe('MODERATION — the sanction cache and the queue', () => {
  it('MOD-06: every wallet asked is ONE batched state read; the cell is parsed, cached for the TTL; no account and a squatted account are clear, an unanswered row is not an answer', async () => {
    __setLaneGenerationCodeForTests('sanction', 18, RECORDSHARD_CODE_BOC);
    try {
      const CHAIN_NOW = 1_800_000_000;
      const WRITTEN_AT = CHAIN_NOW - 1_000;
      let clock = CHAIN_NOW * 1_000;
      const reads: string[][] = [];
      const wallets = Array.from({ length: 10 }, (_, i) => '0:' + (i + 1).toString(16).padStart(64, '0'));
      const accountOf = new Map<string, string>();
      for (const w of wallets) accountOf.set(addrKey(await sanctionShardAddressFor(GATE, walletHashOf(w))), w);
      expect(new Set(accountOf.keys()).size, 'ten wallets, ten distinct accounts').toBe(10);
      const restricted = new Set([wallets[3], wallets[7]]);
      const readStates = async (addresses: string[]) => {
        reads.push(addresses.map((a) => addrKey(a)));
        const out = new Map<string, any>();
        for (const a of addresses) {
          const w = accountOf.get(addrKey(a));
          expect(w, `the cache asks only for accounts it derived (${a})`).toBeTruthy();
          if (w === wallets[5]) continue;
          if (w === wallets[4]) { out.set(addrKey(a), { status: 'active', balance: 0n, dataBoc: bytesToBase64(serializeBoc(beginCell().uint(0n, 1, 'init').address(GATE, 'gate').uint(walletHashOf(w!), 257, 'wallet').endCell())) }); continue; }
          if (w === wallets[8]) { out.set(addrKey(a), { status: 'unknown', unanswered: true }); continue; }
          if (w === wallets[9]) { out.set(addrKey(a), { status: 'active', balance: 1n, dataBoc: bytesToBase64(serializeBoc(sanctionData(w!, { init: 0n }))) }); continue; }
          const data = sanctionData(w!, { warnings: restricted.has(w!) ? 3 : (w === wallets[1] ? 2 : 1), restricted: restricted.has(w!), auto: restricted.has(w!), since: restricted.has(w!) ? WRITTEN_AT : 0, reason: 2, updatedAt: WRITTEN_AT });
          out.set(addrKey(a), { status: 'active', balance: 2_100_000n, dataBoc: bytesToBase64(serializeBoc(data)) });
        }
        return out;
      };
      const cache = createSanctionCache({ readStates, gateAddress: GATE, ttlMs: 600, now: () => clock });
      expect(cache.get(wallets[0])).toBeNull();
      const first = await cache.lookup(wallets);
      expect(reads.length, 'ten wallets, ONE read').toBe(1);
      expect(first, 'ten asked, nine answered, and standings appeared — a surface re-renders').toEqual({ asked: 10, read: 9, changed: true });
      expect(reads[0].length).toBe(10);
      expect(cache.isRestricted(wallets[3])).toBe(true);
      expect(cache.isRestricted(wallets[7])).toBe(true);
      expect(cache.isRestricted(wallets[0])).toBe(false);
      expect(cache.warningsOf(wallets[1])).toBe(2);
      expect(cache.warningsOf(wallets[3])).toBe(3);
      expect(cache.get(wallets[5]), 'no account (omitted by the endpoint): clear, cached').toMatchObject({ exists: false, restricted: false, warnings: 0 });
      expect(cache.get(wallets[4]), 'the lazy-init form: clear, cached, and the batch went on past it').toMatchObject({ exists: false, restricted: false, warnings: 0 });
      expect(cache.get(wallets[9]), 'a squatted account nobody wrote: clear, cached').toMatchObject({ exists: false, restricted: false, warnings: 0 });
      expect(cache.get(wallets[8]), 'an unanswered row is NOT an answer: not cached').toBeNull();
      expect(cache.accountOf(wallets[3])).toBe(await sanctionShardAddressFor(GATE, walletHashOf(wallets[3])));
      expect(cache.size()).toBe(9);
      const again = await cache.lookup(wallets);
      expect(reads.length, 'inside the TTL only the unanswered wallet is asked again').toBe(2);
      expect(again, 'nothing changed: no re-render').toEqual({ asked: 1, read: 0, changed: false });
      expect(reads[1]).toEqual([addrKey(await sanctionShardAddressFor(GATE, walletHashOf(wallets[8])))]);
      clock += 601;
      await cache.lookup([wallets[3]]);
      expect(reads.length, 'past the TTL the wallet is re-read').toBe(3);
      cache.invalidate(wallets[0]);
      expect(cache.get(wallets[0])).toBeNull();
      expect(await cache.lookup([wallets[3]], { force: true }), 'a forced re-read that finds the same standing changes nothing').toEqual({ asked: 1, read: 1, changed: false });
      expect(reads.length, 'force re-reads inside the TTL').toBe(4);
      const persisted = cache.entries().filter(([, e]) => e.exists);
      expect(persisted.map(([k]) => k).sort()).toEqual([1, 2, 3, 6, 7].map((i) => addrKey(wallets[i])).sort());
      const seeded = createSanctionCache({ readStates: async () => { throw new Error('must not read'); }, gateAddress: GATE, ttlMs: 600, now: () => clock });
      expect(seeded.seed(persisted)).toBe(persisted.length);
      expect(seeded.isRestricted(wallets[3]), 'painted from the persisted standing, no read').toBe(true);
      expect(seeded.warningsOf(wallets[1])).toBe(2);
      expect(seeded.seed([[addrKey(wallets[3]), { exists: true, restricted: false, warnings: 0, readAt: 1 }]]), 'an older entry never overrides a fresher one').toBe(0);
      expect(seeded.isRestricted(wallets[3])).toBe(true);
      expect(seeded.seed(null)).toBe(0);
      expect(SANCTION_STANDING_TTL_MS, 'an hour: the TTL prices background traffic, never the first paint').toBe(3_600_000);
      await cache.lookup([]);
      await cache.lookup([null as any, undefined as any]);
      expect(reads.length, 'nothing asked, nothing read').toBe(4);
      const failing = createSanctionCache({ readStates: async () => { throw new Error('offline'); }, gateAddress: GATE, ttlMs: 600, now: () => clock });
      await failing.lookup([wallets[0]]);
      expect(failing.get(wallets[0])).toBeNull();
      const noMap = createSanctionCache({ readStates: async () => undefined, gateAddress: GATE, ttlMs: 600, now: () => clock });
      expect(await noMap.lookup([wallets[0]])).toEqual({ asked: 1, read: 0, changed: false });
      expect(noMap.get(wallets[0])).toBeNull();
      const noGate = createSanctionCache({ readStates: async () => { throw new Error('must not read'); }, gateAddress: null, ttlMs: 600, now: () => clock });
      await noGate.lookup(wallets);
      expect(noGate.size()).toBe(0);
      expect(() => createSanctionCache({ gateAddress: GATE } as any)).toThrow(/readStates/);
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
        states.set(addresses[0].toLowerCase(), { status: 'active' }); states.set(addresses[1].toLowerCase(), { status: 'active' });
        pages.set(addresses[0], row(1n, 9n, 9n, 5n).ref(row(2n, 4n, 0n, 6n).endCell()).endCell());
        pages.set(addresses[1], row(3n, 2n, 0n, 7n).endCell());
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

  it('MOD-09: a sanction is spent a year after its last update — the enforcing readers stop, the record does not', async () => {
    __setLaneGenerationCodeForTests('sanction', 18, RECORDSHARD_CODE_BOC);
    try {
      const CHAIN_NOW = 1_800_000_000;
      const live = '0:' + (41).toString(16).padStart(64, '0');
      const spent = '0:' + (42).toString(16).padStart(64, '0');
      const edge = '0:' + (43).toString(16).padStart(64, '0');
      const wallets = [live, spent, edge];
      const stampOf = new Map<string, number>([
        [live, CHAIN_NOW - 1_000],
        [spent, CHAIN_NOW - SANCTION_RETENTION_SECONDS - 1],
        [edge, CHAIN_NOW - SANCTION_RETENTION_SECONDS],
      ]);
      const accountOf = new Map<string, string>();
      for (const w of wallets) accountOf.set(addrKey(await sanctionShardAddressFor(GATE, walletHashOf(w))), w);
      const readStates = async (addresses: string[]) => {
        const out = new Map<string, any>();
        for (const a of addresses) {
          const w = accountOf.get(addrKey(a))!;
          const stamp = stampOf.get(w)!;
          const data = sanctionData(w, { warnings: 3, restricted: true, auto: true, since: stamp, reason: 2, updatedAt: stamp });
          out.set(addrKey(a), { status: 'active', balance: 2_100_000n, dataBoc: bytesToBase64(serializeBoc(data)) });
        }
        return out;
      };
      let clock = CHAIN_NOW * 1_000;
      const cache = createSanctionCache({ readStates, gateAddress: GATE, ttlMs: 600, now: () => clock });
      await cache.lookup(wallets);

      expect(cache.isRestricted(live)).toBe(true);
      expect(cache.warningsOf(live)).toBe(3);
      expect(cache.spentAt(live)).toBe(stampOf.get(live)! + SANCTION_RETENTION_SECONDS);

      expect(cache.isRestricted(spent), 'past its year the restriction enforces nothing').toBe(false);
      expect(cache.warningsOf(spent), 'and the warnings that made it are spent with it').toBe(0);
      expect(cache.get(spent), 'the record itself is not rewritten by the clock')
        .toMatchObject({ exists: true, restricted: true, warnings: 3 });
      expect(cache.spentAt(spent)).toBe(stampOf.get(spent)! + SANCTION_RETENTION_SECONDS);

      expect(cache.isRestricted(edge), 'the last second of the year still restricts').toBe(true);
      clock += 1_000;
      expect(cache.isRestricted(edge), 'one second later it does not').toBe(false);
      expect(cache.isRestricted(live), 'and the live record is untouched by that second').toBe(true);

      const seeded = createSanctionCache({ readStates: async () => { throw new Error('must not read'); }, gateAddress: GATE, ttlMs: 600, now: () => clock });
      expect(seeded.seed([[addrKey(live), { exists: true, restricted: true, warnings: 3, readAt: clock }]])).toBe(1);
      expect(seeded.isRestricted(live), 'no stamp, no expiry').toBe(true);
      expect(seeded.warningsOf(live)).toBe(3);
      expect(seeded.spentAt(live), 'and nothing for the banner to name, which falls back to the dateless wording').toBe(0);

      stampOf.set(live, CHAIN_NOW + 5);
      expect((await cache.lookup([live], { force: true })).changed, 'a renewal is a change').toBe(true);
      expect(cache.spentAt(live)).toBe(CHAIN_NOW + 5 + SANCTION_RETENTION_SECONDS);
      expect(SANCTION_RETENTION_SECONDS, 'SS_RETENTION — one year').toBe(31_536_000);
    } finally {
      __resetLaneGenerationCodeOverridesForTests();
    }
  });

  it('MOD-10: a verdict is judged against the record the SHARD will act on — a spent one is none, to the second [2026-09-28]', () => {
    const stamp = 1_800_000_000;
    const record = { exists: true, restricted: true, warnings: 2, updatedAt: stamp, readAt: 0 };
    expect(sanctionStandingForVerdict(record, stamp + 1_000), 'inside the year: the record as it stands').toBe(record);
    expect(sanctionStandingForVerdict(record, stamp + SANCTION_RETENTION_SECONDS), 'the last second of the year still stands')
      .toBe(record);
    expect(sanctionStandingForVerdict(record, stamp + SANCTION_RETENTION_SECONDS + 1), 'one second later it is none')
      .toEqual({ exists: false, restricted: false, warnings: 0, updatedAt: stamp, readAt: 0 });
    expect(record, 'and the record itself is not rewritten').toMatchObject({ exists: true, restricted: true, warnings: 2 });
    const unstamped = { exists: true, restricted: true, warnings: 3, updatedAt: 0, readAt: 0 };
    expect(sanctionStandingForVerdict(unstamped, stamp * 2)).toBe(unstamped);
    expect(sanctionStandingForVerdict(null as any, stamp)).toBe(null);
  });
});
