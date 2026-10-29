import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { amountInFor } from '../web/wallet-swap.mjs';
import { ATH_ATOMIC_PER_UNIT, quoteNanotonsForAth } from '../web/market-stability-read.mjs';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';


const app = readFileSync('web/app.js', 'utf8');
const css = readFileSync('web/styles.css', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const lift = (env: Record<string, any>, sources: string[], exported: string) => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [...sources, `return ${exported};`].join(String.fromCharCode(10)))(...names.map((n) => env[n]));
};
const compare = lift({
  t: (key: string, params: any = {}) => `${key}${Object.keys(params).length ? ' ' + JSON.stringify(params) : ''}`,
  amountInFor, quoteNanotonsForAth, ATH_ATOMIC_PER_UNIT, formatGramNanotons: (nano: bigint) => String(nano),
}, [fn('function athMarketComparisonText(market, amountAtomic, multiplier) {')], 'athMarketComparisonText');
const pair = { offerSide: 0 };
const poolOf = (gramUnits: bigint, athUnits: bigint) => ({ locked: false, reserves: [gramUnits * 10n ** 9n, athUnits * 10n ** 9n], lpFee: 20n, protocolFee: 10n });
const MULT = 1n;
const reserveUnit = quoteNanotonsForAth(ATH_ATOMIC_PER_UNIT, MULT);

describe('buy ATH from the reserve', () => {
  it('BUYRES-01: the market beside the reserve — dearer, cheaper, the same, more than the pool holds, checking, unavailable', () => {
    const parse = (text: string) => { const at = text.indexOf(' '); return [text.slice(0, at < 0 ? undefined : at), at < 0 ? {} : JSON.parse(text.slice(at + 1))]; };
    const halfPrice = poolOf(reserveUnit / 2n * 1_000_000n / 10n ** 9n, 1_000_000n);
    const [key, params] = parse(compare({ pair, pool: halfPrice, failed: false }, 0n, MULT));
    expect(key).toBe('profile.buyAthMarketDearer');
    expect(params.percent).toBeGreaterThanOrEqual(98);
    expect(params.percent).toBeLessThanOrEqual(100);
    const [cheaperKey, cheaper] = parse(compare({ pair, pool: poolOf(reserveUnit * 2n * 1_000_000n / 10n ** 9n, 1_000_000n), failed: false }, 0n, MULT));
    expect([cheaperKey, cheaper.percent >= 49 && cheaper.percent <= 50]).toEqual(['profile.buyAthMarketCheaper', true]);
    const [, small] = parse(compare({ pair, pool: halfPrice, failed: false }, ATH_ATOMIC_PER_UNIT, MULT));
    const [, large] = parse(compare({ pair, pool: halfPrice, failed: false }, 100_000n * ATH_ATOMIC_PER_UNIT, MULT));
    expect(BigInt(large.price) > BigInt(small.price)).toBe(true);
    expect(large.percent).toBeLessThan(small.percent);
    expect(compare({ pair, pool: halfPrice, failed: false }, 2_000_000n * ATH_ATOMIC_PER_UNIT, MULT)).toBe('profile.buyAthMarketShort');
    expect(compare({ pair, pool: null, failed: false }, 0n, MULT), 'the pool not read yet').toBe('profile.statusChecking');
    expect(compare({ pair, pool: null, failed: true }, 0n, MULT), 'the read failed').toBe('profile.buyAthUnavailable');
    expect(compare({ pair: null, pool: null, failed: false }, 0n, MULT), 'no pool for ATH').toBe('profile.buyAthUnavailable');
  });

  it('BUYRES-02: the window opens with the warning, the market in its summary, the pool read as it opens', () => {
    const dialog = code(fn('async function openBuyAthDialog() {'));
    expect(dialog).toContain("hint: t('profile.buyAthNotMarket'),");
    expect(dialog).toContain("tone: 'warn',");
    expect(dialog).toContain("{ label: t('profile.buyAthMarketLabel'), value: athMarketComparisonText(market, amountAtomic, state.currentMultiplier) },");
    expect(dialog).toContain('const market = { pair: swapPair(GRAM, walletAthMaster()), pool: null, failed: false };');
    expect(dialog).toContain('void readSwapPool({ transport: globalThis.plathoTonRpcTransport, pair: market.pair');
    expect(css).toMatch(/\.action-dialog p\[data-tone="warn"\] \{\s*color: var\(--amber\);/);
  });

  it('BUYRES-03: every language says "from the reserve" and has the warning and the market lines', () => {
    for (const [language, words] of Object.entries(I18N_STRINGS as Record<string, Record<string, string>>)) {
      for (const key of ['profile.buyAthNotMarket', 'profile.buyAthMarketLabel', 'profile.buyAthMarketShort']) expect(words[key], `${language} ${key}`).toBeTruthy();
      for (const key of ['profile.buyAthMarketDearer', 'profile.buyAthMarketCheaper']) expect(words[key], `${language} ${key}`).toMatch(/\{price\}[\s\S]*\{percent\}|\{percent\}[\s\S]*\{price\}/);
      expect(words['profile.buyAthMarketSame'], language).toContain('{price}');
      expect(words['profile.buyAthTitle'], language).toContain('ATH');
      expect(words['profile.buyAth'], `${language}: not the bare "Buy ATH" any more`).not.toBe(words['profile.buyAthSubmit'] + ' ATH');
    }
    expect((I18N_STRINGS as any).ru['profile.buyAth']).toBe('\u041a\u0443\u043f\u0438\u0442\u044c \u0438\u0437 \u0440\u0435\u0437\u0435\u0440\u0432\u0430');
  });
});
