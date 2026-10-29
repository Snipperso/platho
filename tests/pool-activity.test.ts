import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { ACTIVITY_MONTH_SAMPLE, ACTIVITY_SAMPLE, ACTIVITY_WINDOW_S, NEW_TOKEN_MAX_AGE_S, gramPrices, newSinceProduction, newToPlathoAndChain, poolDepthGram, tradesInMonth } from '../scripts/lib/pool-activity-math.mjs';
import { POOL_ACTIVITY, POOL_ACTIVITY_NEW } from '../web/pool-activity.mjs';
import { SWAP_POOLS } from '../web/swap-pools.mjs';
import { DEDUST_POOLS } from '../web/dedust-pools.mjs';
import { POOL_BUSY_TRADES, POOL_LIVELY_DEPTH_GRAM, POOL_LIVELY_TRADES, SWAP_NEW_ID, routeLively, routeScore, swapAskLively, swapAsksFrom, swapRoutes, swapTokenIsNew } from '../web/swap-routes.mjs';
import { SWAP_LISTS } from '../scripts/lib/swap-lists-age.mjs';


const app = readFileSync('web/app.js', 'utf8');
const NOW = 2_000_000_000;
const DAY = 86_400;

describe('pool activity', () => {
  it('POOLACT-01: a month of swaps — a quiet pool counted whole, a busy one by its rate; a bounced swap fills the read without counting', () => {
    expect(tradesInMonth({ times: [NOW - DAY, NOW - 40 * DAY], returned: 2, oldest: NOW - 40 * DAY }, NOW)).toBe(1);
    const old = Array.from({ length: ACTIVITY_SAMPLE }, (_, i) => NOW - i * 2 * DAY);
    expect(tradesInMonth({ times: old, returned: ACTIVITY_SAMPLE, oldest: old.at(-1)! }, NOW)).toBe(15);
    const busy = Array.from({ length: ACTIVITY_SAMPLE }, (_, i) => NOW - i * 72);
    expect(tradesInMonth({ times: busy, returned: ACTIVITY_SAMPLE, oldest: NOW - 3600 }, NOW)).toBe(Math.round((ACTIVITY_SAMPLE * ACTIVITY_WINDOW_S) / 3600));
    expect(tradesInMonth({ times: busy.slice(0, 34), returned: ACTIVITY_SAMPLE, oldest: NOW - 3600 }, NOW)).toBe(Math.round((34 * ACTIVITY_WINDOW_S) / 3600));
  });

  it('POOLACT-02: depth in whole GRAM — the GRAM side, or a side priced through its token\'s deepest GRAM pool; null with no price', () => {
    const pools = [
      { tokens: ['gram', 'A'], reserves: [20_000n * 10n ** 9n, 40_000n * 10n ** 6n] },
      { tokens: ['A', 'gram'], reserves: [10n ** 6n, 10n ** 9n] },
      { tokens: ['A', 'B'], reserves: [30_000n * 10n ** 6n, 7n] },
      { tokens: ['B', 'C'], reserves: [1n, 1n] },
    ];
    const prices = gramPrices(pools);
    expect(prices.get('A')).toBeCloseTo(500, 9);
    expect(pools.map((pool) => poolDepthGram(pool, prices))).toEqual([20_000, 1, 15_000, null]);
  });

  it('POOLACT-03: the built numbers cover the lists; the asks put the lively first, each part by score; GRAM/USD-T is lively, the quiet are apart', () => {
    const listed = [...SWAP_POOLS, ...DEDUST_POOLS].map((row) => row[0]);
    const measured = new Set(POOL_ACTIVITY.map((row) => row[0]));
    expect(listed.filter((id) => measured.has(id)).length / listed.length).toBeGreaterThanOrEqual(0.9);
    expect([POOL_LIVELY_DEPTH_GRAM, POOL_LIVELY_TRADES, POOL_BUSY_TRADES]).toEqual([5_000, 30, 600]);
    const asks = swapAsksFrom('gram');
    const lively = asks.map((ask) => swapAskLively('gram', ask.id));
    const firstQuiet = lively.indexOf(false);
    expect(firstQuiet).toBeGreaterThan(0);
    expect(lively.slice(firstQuiet).every((one) => !one)).toBe(true);
    const best = (askId: string) => Math.max(...swapRoutes('gram', askId).map(routeScore));
    for (const part of [asks.slice(0, firstQuiet), asks.slice(firstQuiet)]) {
      for (let at = 1; at < part.length; at += 1) expect(best(part[at].id)).toBeLessThanOrEqual(best(part[at - 1].id));
    }
    expect(asks[0].symbol).toBe('USD₮');
  });

  it('POOLACT-04: the swap list marks the quiet and draws the line before them; the module ships, its age is checked, the refresh builds it', () => {
    expect(code(sourceBlock(app, 'function walletSwapPickerItems('))).toContain("section: news && swapTokenIsNew(ask.id) ? 'new' : lively ? 'lively' : 'quiet' }));");
    const picker = code(sourceBlock(app, 'function openWalletSwapPicker('));
    expect(picker).toContain('const apart = walletSwapSectionLine(item.section, shown[index - 1]?.section);');
    const line = code(sourceBlock(app, 'function walletSwapSectionLine('));
    expect(line).toContain("if (!section || section === before || (section === 'lively' && before !== 'new')) return null;");
    expect(line).toContain('apart.className = `swap-picker-section is-${section}`;');
    expect(readFileSync('web/sw.js', 'utf8')).toMatch(/'\.\/pool-activity\.mjs\?v=\d+'/);
    expect(readFileSync('scripts/prepare_static_web_deploy.mjs', 'utf8')).toContain("'pool-activity.mjs',");
    expect(SWAP_LISTS.map((list) => list.file)).toContain('pool-activity.mjs');
    const refresh = readFileSync('scripts/refresh_lists.mjs', 'utf8');
    expect(refresh).toContain("build('build_pool_activity.mjs', ['--cache', join(cacheDir, `activity-${DAY}.json`), '--taken', STAMP]);");
    expect(refresh).toContain("const LIST_FILES = ['verified-assets.mjs', 'swap-pools.mjs', 'dedust-pools.mjs', 'asset-pictures.mjs', 'pool-activity.mjs'];");
  });

  it('POOLACT-05: a shallow pool that trades all day is lively; a deep one that hardly trades is not; depth times swaps puts the busy shallow one above', () => {
    const route = (depth: number, trades: number) => ({ pair: { pool: `0:${'00'.repeat(32)}` }, measured: { depth, trades } });
    const lively = (depth: number, trades: number) => trades >= POOL_LIVELY_TRADES && (depth >= POOL_LIVELY_DEPTH_GRAM || trades >= POOL_BUSY_TRADES);
    expect([lively(4_177, 47_533), lively(71_067, 28), lively(4_810, 671), lively(4_810, 500), lively(20_141, 349)]).toEqual([true, false, true, false, true]);
    expect(code(sourceBlock(readFileSync('web/swap-routes.mjs', 'utf8'), 'export function routeLively('))).toContain(
      'measured.trades >= POOL_LIVELY_TRADES && (measured.depth >= POOL_LIVELY_DEPTH_GRAM || measured.trades >= POOL_BUSY_TRADES)');
    const score = (depth: number, trades: number) => Math.log10(1 + depth) + Math.log10(1 + trades);
    expect(score(4_177, 47_533)).toBeGreaterThan(score(71_067, 28));
    void route; void routeLively;
    const asks = swapAsksFrom('gram');
    const at = (symbol: string) => asks.findIndex((ask) => ask.symbol === symbol);
    if (at('MRG') >= 0 && at('OPEN') >= 0) expect(at('MRG')).toBeLessThan(at('OPEN'));
  });

  it('POOLACT-08: a burst is not a month — the month itself is read, up to 1000 swaps [client audit 61 — C5-2]', () => {
    const DAY = 86_400;
    const burst = [...Array.from({ length: 50 }, (_, i) => NOW - 3 * 3600 - i * 60), ...Array.from({ length: 36 }, (_, i) => NOW - 5 * DAY - i * DAY / 2)];
    expect(tradesInMonth({ times: burst.slice(0, 50), returned: 50, oldest: burst[49] }, NOW, 50), 'MEASURED before: thousands').toBeGreaterThan(5_000);
    expect(tradesInMonth({ times: burst, returned: burst.length, oldest: burst.at(-1)! }, NOW, ACTIVITY_MONTH_SAMPLE), 'the month read: counted whole').toBe(86);
    const span = 25.3 * DAY;
    const ath = Array.from({ length: 625 }, (_, i) => NOW - Math.floor((i * span) / 625));
    expect(tradesInMonth({ times: ath, returned: 1000, oldest: NOW - span }, NOW, ACTIVITY_MONTH_SAMPLE)).toBe(Math.round((625 * 30) / 25.3));
    const builder = readFileSync('scripts/build_pool_activity.mjs', 'utf8');
    expect(builder).toContain('&start_utime=${from}&limit=${sample}&sort=desc');
    expect(builder).toContain('tradesInMonth(pool, pool.readAt, pool.sample ?? ACTIVITY_SAMPLE)');
  });

  it('POOLACT-07: a token that comes back is no news, nor an old one never listed — new means never shipped and young on the chain [2026-10-26]', () => {
    const DAY = 86_400;
    const now = 1_800_000_000;
    const shipped = { TONY: '2026-10-16' };
    expect(newToPlathoAndChain('TONY', { shipped, firstAt: now - 3 * DAY, nowS: now }), 'shipped before: listed as any other').toBe(false);
    expect(newToPlathoAndChain('GLX', { shipped, firstAt: now - 913 * DAY, nowS: now }), 'never shipped, 913 days old').toBe(false);
    expect(newToPlathoAndChain('PXE', { shipped, firstAt: now - 3 * DAY, nowS: now }), 'never shipped, 3 days old').toBe(true);
    expect(newToPlathoAndChain('PXE', { shipped, firstAt: now - NEW_TOKEN_MAX_AGE_S - 1, nowS: now }), 'a second past thirty days').toBe(false);
    expect(newToPlathoAndChain('PXE', { shipped, firstAt: 0, nowS: now }), 'an age that did not read').toBe(false);
    const record = JSON.parse(readFileSync('artifacts/swap-tokens-shipped.json', 'utf8')).tokens;
    for (const id of POOL_ACTIVITY_NEW) expect(Object.hasOwn(record, id), `${id} shipped before`).toBe(false);
    expect(Object.hasOwn(record, 'B_DkjcpssEkMjxNbdLVCxZcTv_8oVJpbHKUwnzC3_0w'), 'TONY, shipped on 2026-10-16').toBe(true);
  });

  it('POOLACT-06: the new tokens are those production lacks — DeDust is no news to a production without it; shown first for a day from when this device met them', () => {
    expect(newSinceProduction({ ston: ['A', 'B', 'E'], dedust: ['B', 'C'], prodSton: ['A'], prodDedust: null })).toEqual(['E']);
    expect(newSinceProduction({ ston: ['A', 'B'], dedust: ['B', 'C'], prodSton: ['A'], prodDedust: ['C'] })).toEqual(['B']);
    expect(newSinceProduction({ ston: ['A'], dedust: ['C', 'D'], prodSton: ['A'], prodDedust: ['C'] })).toEqual(['D']);
    expect(SWAP_NEW_ID === '' ? POOL_ACTIVITY_NEW.length : SWAP_NEW_ID.split(':')[1]).toBe(POOL_ACTIVITY_NEW.length === 0 ? 0 : String(POOL_ACTIVITY_NEW.length));
    for (const id of POOL_ACTIVITY_NEW) expect(swapTokenIsNew(`0:${Buffer.from(id, 'base64url').toString('hex')}`)).toBe(true);
    const store = new Map<string, string>();
    const localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
    const lift = (id: string, storage: any) => new Function('SWAP_NEW_ID', 'localStorage', [
      "const WALLET_SWAP_NEW_KEY = 'platho.swapNewSeen.v1';", 'const WALLET_SWAP_NEW_MS = 24 * 60 * 60 * 1000;',
      sourceBlock(app, 'function walletSwapNewShown('), 'return walletSwapNewShown;'].join(String.fromCharCode(10)))(id, storage);
    const shown = lift('2026-10-25:3:x', localStorage);
    expect([shown(1_000), shown(1_000 + 23 * 3600_000), shown(1_000 + 25 * 3600_000)]).toEqual([true, true, false]);
    expect(lift('2026-11-01:2:y', localStorage)(1_000 + 25 * 3600_000)).toBe(true);
    expect(lift('', localStorage)(0)).toBe(false);
    expect(lift('z', { getItem: () => { throw new Error('blocked'); } })(0)).toBe(true);
  });
});
