import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';


const app = readFileSync('web/app.js', 'utf8');
const NL = String.fromCharCode(10);
const lift = (env: Record<string, any>, blocks: string[], name: string) => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [...blocks, `return ${name};`].join(NL))(...names.map((n) => env[n]));
};
const GRAM = 'gram';
const TOKEN = '0:' + 'ab'.repeat(32);

describe('money audit round 53', () => {
  it('MONEY53-01: the chart takes the pair\'s deepest pool by the reserve of the side the price is in; a pool that fails or is locked is passed over', async () => {
    const reserves: Record<string, any> = {
      'stonfi:A': { reserves: [486n * 10n ** 9n, 9n] },
      'dedust:B': { reserves: [5n, 26_000n * 10n ** 9n] },
      'dedust:C': new Error('down'),
      'stonfi:D': { reserves: [10n ** 30n, 1n], locked: true },
    };
    const reads: string[] = [];
    const env = {
      readRoutePool: async ({ route }: any) => { reads.push(route.key); const pool = reserves[route.key]; if (pool instanceof Error) throw pool; return pool; },
      routeLocked: (_route: any, pool: any) => pool.locked === true, noteTonRpcRateLimit: () => true, isTonRpcRateLimitError: () => true, console,
      WALLET_PRICE_FRESH_MS: 60_000, walletPriceDepths: new Map(),
    };
    const pick = lift(env, [sourceBlock(app, 'async function walletPriceDepthOf('), sourceBlock(app, 'async function walletPriceRoute(')], 'walletPriceRoute');
    const route = (key: string, offerSide: number) => ({ key, pair: { offer: { id: TOKEN }, ask: { id: GRAM }, offerSide } });
    const candidates = [route('stonfi:A', 1), route('dedust:B', 0), route('dedust:C', 0), route('stonfi:D', 0)];
    const chosen = await pick(candidates, { id: GRAM });
    expect([chosen.route.key, chosen.depth]).toEqual(['dedust:B', 26_000n * 10n ** 9n]);
    await pick(candidates, { id: GRAM });
    expect(reads.filter((key) => key === 'dedust:B')).toHaveLength(1);
    const given = await pick([route('stonfi:A', 1)], { id: GRAM }, { reserves: [7n, 8n] });
    expect(given.depth).toBe(7n);
    const none = await pick([route('dedust:C', 0)], { id: GRAM });
    expect([none.route.key, none.depth]).toEqual(['dedust:C', null]);
  });

  it('MONEY53-02: the depth is said under the price, in the danger colour below the shallow depth (1 000 GRAM); the swap window hands the chart the pool it read', () => {
    const chart = code(sourceBlock(app, 'function walletPriceChart('));
    expect(chart).toContain('void walletPriceRoute(first ? [first] : candidates, ask, first && first.pair.pool !== candidates[0].pair.pool ? null : givenPool, undefined, () => box.isConnected)'); expect(chart).toContain('.then((read) => { if (firstEra === readEra) adopt(read); });');
    expect(chart).toContain('const thin = depth !== null && ask.id === GRAM && depth < WALLET_PRICE_THIN_GRAM;');
    expect(app).toContain('const WALLET_PRICE_THIN_GRAM = BigInt(POOL_SHALLOW_DEPTH_GRAM) * 10n ** 9n;');
    expect(readFileSync('web/styles.css', 'utf8')).toMatch(/\.wallet-price-depth\.is-thin \{\s*color: var\(--danger-ink, var\(--danger\)\);/);
  });

  it('MONEY53-03: a stranger\'s token received is titled so and its amount is not drawn as money received', () => {
    expect(app).toContain("const stranger = incoming && row.kind === 'jetton' && row.verified === false;");
    expect(app).toContain("t(stranger ? 'wallet.historyUnverifiedIn' : incoming ? 'wallet.historyIn' : 'wallet.historyOut')");
    expect(app).toContain("${stranger ? ' is-unverified' : ''}");
    expect(readFileSync('web/styles.css', 'utf8')).toMatch(/\.wallet-history-row\.is-unverified \.wallet-asset-amount \{\s*color: var\(--text-muted\);/);
  });

  it('MONEY53-04: a ticker another token bears (case aside) gets the token\'s short address — in the picker and on the tile; GRAM and a lone ticker none', () => {
    const tag = lift({ GRAM, shortAddress: (a: string) => `short(${a})`, formatTonUserFriendlyAddress: (raw: string) => `F${raw}` },
      [sourceBlock(app, 'function walletSwapTwinTag(')], 'walletSwapTwinTag');
    const items = [{ id: GRAM, symbol: 'GRAM' }, { id: 'A', symbol: 'NEDO' }, { id: 'B', symbol: 'Nedo' }, { id: 'C', symbol: 'ATH' }];
    expect(items.map((item) => tag(items, item))).toEqual(['', 'short(FA)', 'short(FB)', '']);
    expect(code(sourceBlock(app, 'function walletSwapPickerItems('))).toContain("subtitle: [name, walletSwapTwinTag(items, item)].filter(Boolean).join(', ') };");
    expect(code(sourceBlock(app, 'async function openWalletSwapDialog(start, hold, asked = null) {'))).toContain('tile.tag.textContent = item ? walletSwapTwinTag(among, item) : \'\';');
  });

  it('MONEY53-05: the chart\'s headline is the pool\'s price, as the Market\'s row says it — a stable pool\'s its trades\'; read again with the trades', () => {
    const chart = code(sourceBlock(app, 'function walletPriceChart('));
    expect(chart).toContain('if (!reserves || route.pair.stable) return null;');
    expect(chart).toContain('const now = spot ?? summary.last;');
    expect(chart).toContain('const moved = summary.first > 0 ? now / summary.first - 1 : summary.change;');
    expect(chart).toContain('void walletPriceRoute([route], ask, null, refreshMs - 5_000, () => box.isConnected).then(({ reserves }) => {');
    expect(chart).toContain('spot = spotOf(reserves) ?? spot;');
    expect(code(sourceBlock(app, 'async function walletPriceRoute('))).toContain('return { route: candidates[best], depth: depths[best], reserves: reads[best].reserves };');
  });
});
