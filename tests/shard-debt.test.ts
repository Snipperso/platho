import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  applyShardSurcharge, createShardDebtResolver, emptyShardRentPerYear, estimateShardDebt, squatCushionNanotons,
  storageFeeNanotons, surchargeExtraNanotons, EMPTY_SHARD_STORAGE, LANE_CONV, LANE_INTRO, LANE_PUBLIC, SECONDS_PER_YEAR,
  STORAGE_PRICE,
} from '../web/shard-debt.mjs';
import { createShardLastTransactionReader } from '../web/shard-rpc.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// SHARD-DEBT — the client half of the squat repair. The contract half (gates 13712/13660/13688 + the debt-aware
// reserve) is pinned in contracts18/tests/squat-debt.test.ts against the real shards; this file pins the client's
// arithmetic to the figures measured there, the resolver's read discipline (no read for an absent account, one
// for an existing one, cached), the funnel behaviour (every message raised, the debt asserted, the cushion not),
// and the wiring: every publish funnel applies it and every affordability sum in app.js budgets the cushion.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const YEAR = SECONDS_PER_YEAR;
const A = `0:${'11'.repeat(32)}`;
const B = `0:${'22'.repeat(32)}`;
const VAULT = `0:${'33'.repeat(32)}`;

describe('SHARD-DEBT — the rent a pre-created shard owes, as the client computes it', () => {
  it('SD-01: the fee formula rounds up like the node, and the cushions are the measured year figures', () => {
    // MEASURED 2026-09-03, PUBLIC re-measured 2026-09-05 after the reactions receiver grew the shard 60 -> 68 cells
    // PUBLIC / INTRO / CONV account, read as the due a second refused publish books — one above the floor, every
    // lane (a first probe read 3,053,221 because its 1-nanoton poke had paid one nanoton of it).
    expect(emptyShardRentPerYear(LANE_PUBLIC)).toBe(4_417_427n);
    expect(emptyShardRentPerYear(LANE_INTRO)).toBe(1_559_092n);
    expect(emptyShardRentPerYear(LANE_CONV)).toBe(1_299_244n);
    expect(squatCushionNanotons(LANE_PUBLIC)).toBe(4_417_427n);
    expect(emptyShardRentPerYear('report' as any), 'the report lane: 51 cells').toBe(3313071n);
    expect(STORAGE_PRICE.bitPricePs).toBe(0n);
    expect(STORAGE_PRICE.cellPricePs).toBe(135n);
    expect(EMPTY_SHARD_STORAGE.public.cells).toBe(68n);
    // the formula, not just its outputs: a cell-second is 135/65536 nanotons, and the division rounds UP
    expect(storageFeeNanotons({ cells: 1n, bits: 0n }, 65_536)).toBe(135n);
    expect(storageFeeNanotons({ cells: 1n, bits: 0n }, 65_535)).toBe(135n);
    expect(storageFeeNanotons({ cells: 1n, bits: 0n }, 1)).toBe(1n);
    expect(storageFeeNanotons({ cells: 0n, bits: 1_000_000n }, YEAR), 'bits are free at this price').toBe(0n);
    expect(storageFeeNanotons(EMPTY_SHARD_STORAGE.public, -5), 'a clock behind the last transaction owes nothing').toBe(0n);
    expect(() => squatCushionNanotons('avatar' as any)).toThrow(/unknown lane/);
  });

  it('SD-02: the estimate is the empty rent since the last transaction, less the balance, never negative', () => {
    const t0 = 1_800_000_000;
    expect(estimateShardDebt({ lane: LANE_PUBLIC, lastTransactionUnix: t0, nowUnix: t0 + YEAR, balance: 0n })).toBe(4_417_427n);
    expect(estimateShardDebt({ lane: LANE_PUBLIC, lastTransactionUnix: t0, nowUnix: t0 + 3 * YEAR, balance: 0n })).toBe(13_252_281n);
    expect(estimateShardDebt({ lane: LANE_PUBLIC, lastTransactionUnix: t0, nowUnix: t0 + 86_400, balance: 0n })).toBe(12_103n);
    // a solvent shard: the balance covers the interval, so nothing is owed
    expect(estimateShardDebt({ lane: LANE_PUBLIC, lastTransactionUnix: t0, nowUnix: t0 + YEAR, balance: 5_800_000n })).toBe(0n);
    expect(estimateShardDebt({ lane: LANE_PUBLIC, lastTransactionUnix: t0, nowUnix: t0 + YEAR, balance: 4_417_426n })).toBe(1n);
    expect(estimateShardDebt({ lane: LANE_INTRO, lastTransactionUnix: t0, nowUnix: t0 - 10, balance: 0n })).toBe(0n);
    // the carried due: what the newest transaction booked as storage_fees_due rides on top of the interval
    expect(estimateShardDebt({ lane: LANE_PUBLIC, lastTransactionUnix: t0, nowUnix: t0 + 60, balance: 0n, dueCarried: 19_471_106n })).toBe(19_471_106n + 9n);
    expect(estimateShardDebt({ lane: LANE_PUBLIC, lastTransactionUnix: t0, nowUnix: t0 + 60, balance: 30_000_000n, dueCarried: 19_471_106n })).toBe(0n);
  });

  it('SD-03: the resolver reads nothing for an absent account, the transaction time only for a live one, and caches', async () => {
    const t0 = 1_800_000_000;
    const rows: Record<string, any> = {
      [A]: { status: 'active', balance: 0n },
      [B]: { status: 'uninit', balance: 1_000n },
    };
    const readStates = vi.fn(async (address: string) => rows[address] ?? null);
    const readLast = vi.fn(async (_address: string) => ({ now: t0, storageFeesDue: 0n }));
    let clock = 1_000_000;
    const resolve = createShardDebtResolver({ readStates, readLastTransaction: readLast, cacheTtlMs: 600_000, now: () => clock });

    const absent = await resolve(`0:${'44'.repeat(32)}`, LANE_PUBLIC, t0 + YEAR);
    expect(absent).toEqual({ cushion: 4_417_427n, debt: 0n, status: 'nonexist' });
    expect(readLast, 'no transaction read for an account that does not exist').not.toHaveBeenCalled();

    const dust = await resolve(B, LANE_PUBLIC, t0 + YEAR);
    expect(dust.debt, 'an uninit account has no code to pay rent on').toBe(0n);
    expect(readLast).not.toHaveBeenCalled();

    const squatted = await resolve(A, LANE_PUBLIC, t0 + 2 * YEAR);
    expect(squatted).toEqual({ cushion: 4_417_427n, debt: 8_834_854n, status: 'active' });
    expect(readLast).toHaveBeenCalledTimes(1);
    expect(readStates).toHaveBeenCalledTimes(3);

    // cached: the same address a minute later costs no read, and the debt moves with the clock it is asked for
    clock += 60_000;
    const again = await resolve(A, LANE_PUBLIC, t0 + 2 * YEAR + 86_400);
    expect(again.debt).toBe(8_834_854n + 12_103n);
    expect(readStates).toHaveBeenCalledTimes(3);
    expect(readLast).toHaveBeenCalledTimes(1);
    //...and re-read once the verdict has aged out
    clock += 600_001;
    await resolve(A, LANE_PUBLIC, t0 + 2 * YEAR);
    expect(readStates).toHaveBeenCalledTimes(4);
    expect(readLast).toHaveBeenCalledTimes(2);

    // the carried due: a squatter who pokes monthly leaves a fresh timestamp and an old arrear — both are read
    const carried = createShardDebtResolver({
      readStates: async () => ({ status: 'active', balance: 0n }),
      readLastTransaction: async () => ({ now: t0 + 2 * YEAR, storageFeesDue: 8_834_854n }),
    });
    expect((await carried(A, LANE_PUBLIC, t0 + 2 * YEAR + 86_400)).debt).toBe(8_834_854n + 12_103n);
  });

  it('SD-04: every message rises by cushion + debt, each shard resolves once, and the funnel extra is everything above the budget', async () => {
    const resolver = vi.fn(async (address: string, lane: string) => ({
      cushion: squatCushionNanotons(lane), debt: address === A ? 7_000_000n : 0n, status: 'active',
    }));
    const prepared: any[] = [
      { to: A, value: 20_700_000n, message: { address: A, amount: 20_700_000n } },
      { to: A, value: 20_700_000n, message: { address: A, amount: '20700000' } },        // a second part, same shard
      { to: VAULT, shard: B, value: 25_000_000n, message: { address: VAULT, amount: 25_000_000n } },   // routed: the vault forwards to B
    ];
    const { cushion, debtTotal } = await applyShardSurcharge(LANE_PUBLIC, prepared, { resolver });
    expect(resolver).toHaveBeenCalledTimes(2);
    expect(resolver.mock.calls[0][0]).toBe(A);
    expect(resolver.mock.calls[1][0], 'the routed message resolves the SHARD, not the vault').toBe(B);
    expect(prepared[0].message.amount).toBe(20_700_000n + 4_417_427n + 7_000_000n);
    expect(prepared[0].value).toBe(prepared[0].message.amount);
    expect(prepared[1].message.amount, 'a string amount stays a string').toBe(String(20_700_000n + 4_417_427n + 7_000_000n));
    expect(prepared[2].message.amount).toBe(25_000_000n + 4_417_427n);
    expect(prepared[0].surcharge).toEqual({ cushion: 4_417_427n, debt: 7_000_000n });
    expect(debtTotal, 'the two parts to A carry the debt twice').toBe(14_000_000n);
    expect(cushion).toBe(4_417_427n);
    // WHAT THE FUNNEL ASKS ITS CALLER TO AFFORD: everything above `value + cushion` per part — the debts, plus the
    // vault door's overhead on the routed message (built 5,000,000 above the direct figure it was budgeted at), plus
    // a vault deploy when one rides the transfer. The cushion itself is never asked for twice.
    expect(surchargeExtraNanotons({ prepared, budgeted: [20_700_000n, 20_700_000n, 20_000_000n], cushion })).toBe(14_000_000n + 5_000_000n);
    expect(surchargeExtraNanotons({ prepared, budgeted: [20_700_000n, 20_700_000n, 20_000_000n], cushion, deploy: { amount: 50_000_000n } })).toBe(19_000_000n + 50_000_000n);
    expect(surchargeExtraNanotons({ prepared: [], budgeted: [], cushion })).toBe(0n);

    // no debt anywhere, direct door: nothing above the budget
    const quiet: any[] = [{ to: B, value: 1n, message: { address: B, amount: 1n } }];
    const q = await applyShardSurcharge(LANE_CONV, quiet, { resolver: async () => ({ cushion: 1_299_244n, debt: 0n, status: 'nonexist' }) });
    expect(q.debtTotal).toBe(0n);
    expect(surchargeExtraNanotons({ prepared: quiet, budgeted: [1n], cushion: q.cushion })).toBe(0n);
    expect(quiet[0].message.amount).toBe(1n + 1_299_244n);

    // a resolver that fails: the cushion alone, never a failed publish
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const blind: any[] = [{ to: A, value: 5n, message: { address: A, amount: 5n } }];
    await applyShardSurcharge(LANE_INTRO, blind, { resolver: async () => { throw new Error('endpoint down'); } });
    expect(blind[0].message.amount).toBe(5n + 1_559_092n);
    expect(blind[0].surcharge.debt).toBe(0n);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('SD-05: the last-transaction reader parses the measured v3 shape and never answers null for a request that did not run', async () => {
    // MEASURED 2026-09-03 against https://toncenter.com/api/v3/transactions?account=…&limit=1&sort=desc: rows carry
    // `now` (unix seconds), `lt`, `account`, `hash`, …; the top level is { address_book, transactions }.
    const previous = (globalThis as any).plathoTonRpcEndpoint;
    (globalThis as any).plathoTonRpcEndpoint = 'https://rpc.example/api/v3/jsonRPC';
    try {
      const urls: string[] = [];
      const fetchOk = async (url: string) => {
        urls.push(url);
        return { ok: true, status: 200, json: async () => ({ address_book: {}, transactions: [{ account: A, hash: 'h', lt: '101036348000003', now: 1788433074 }] }) };
      };
      const read = createShardLastTransactionReader({ fetch: fetchOk as any });
      expect(await read(A)).toEqual({ now: 1788433074, storageFeesDue: 0n });
      expect(urls[0]).toContain('/api/v3/transactions?');
      expect(urls[0]).toContain(`account=${encodeURIComponent(A)}`);
      expect(urls[0]).toContain('limit=1');
      expect(urls[0]).toContain('sort=desc');

      const empty = createShardLastTransactionReader({ fetch: (async () => ({ ok: true, status: 200, json: async () => ({ transactions: [] }) })) as any });
      expect(await empty(A), 'an account with no transactions has no age').toBeNull();

      // the Maybe field: present only when the storage phase left a debt (measured: absent on a solvent account)
      const inDebt = createShardLastTransactionReader({ fetch: (async () => ({ ok: true, status: 200, json: async () => ({ transactions: [{ now: 1788433074,
        description: { storage_ph: { storage_fees_collected: '0', storage_fees_due: '19471106', status_change: 'unchanged' } } }] }) })) as any });
      expect(await inDebt(A)).toEqual({ now: 1788433074, storageFeesDue: 19_471_106n });

      const failing = createShardLastTransactionReader({ fetch: (async () => ({ ok: false, status: 503, json: async () => ({}) })) as any });
      await expect(failing(A)).rejects.toThrow(/HTTP 503/);
    } finally {
      (globalThis as any).plathoTonRpcEndpoint = previous;
    }
  });

  it('SD-06: every publish funnel applies the surcharge before signing, and app.js budgets the cushion in every sum', () => {
    const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
    for (const [file, lane, sender] of [
      ['web/public-lane-send.mjs', 'LANE_PUBLIC', 'publishPublicLaneParts'],
      ['web/conv-lane-send.mjs', 'LANE_CONV', 'publishConvLaneParts'],
      ['web/intro-lane-send.mjs', 'LANE_INTRO', 'publishIntroLane'],
    ] as const) {
      const text = src(file);
      const fn = text.indexOf(`export async function ${sender}(`);
      expect(fn, `${file}: ${sender} exists`).toBeGreaterThan(-1);
      const body = text.slice(fn);
      const apply = body.indexOf(`applyShardSurcharge(${lane}, `);
      const send = body.indexOf('sendPlathoWalletTransaction(');
      expect(apply, `${file}: the funnel applies the surcharge`).toBeGreaterThan(-1);
      expect(send, `${file}: the funnel signs`).toBeGreaterThan(-1);
      expect(apply < send, `${file}: the surcharge is applied BEFORE the wallet signs`).toBe(true);
      expect(body.slice(0, apply)).toContain('assertAffordable');
      // and between the surcharge and the signature the funnel asks for EVERYTHING above the caller's budget
      const between = body.slice(apply, send);
      expect(between, `${file}: the extra above the budget is computed`).toContain('surchargeExtraNanotons(');
      expect(between, `${file}: and asserted before signing`).toContain("if (aboveBudget > 0n && typeof assertAffordable === 'function') await assertAffordable(aboveBudget);");
    }
    const app = src('web/app.js');
    // Every funnel call passes the affordability hook, and the sum asserted right before it budgets the cushion.
    const calls = [...app.matchAll(/\b(publishPublicLaneParts|publishConvLaneParts|publishIntroLane)\(\{ wallet: plathoWallet/g)];
    expect(calls.length, 'the app\'s funnel calls').toBe(6);
    for (const call of calls) {
      const window = app.slice(call.index!, call.index! + 400);
      expect(window, `funnel call at ${call.index} passes assertAffordable`).toMatch(/assertAffordable: \(extra\) => assertWalletGramAtLeast\(\w+ \+ extra/);
      const before = app.slice(Math.max(0, call.index! - 1500), call.index!);
      expect(before, `the sum asserted before the call at ${call.index} carries the cushion`).toContain('squatCushionNanotons(');
    }
    expect(src('web/sw.js')).toContain("'./shard-debt.mjs?v=");
    expect(src('scripts/prepare_static_web_deploy.mjs')).toContain("'shard-debt.mjs',");
  });
});
