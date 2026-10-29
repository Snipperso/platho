import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { I18N_LOCALES, I18N_STRINGS } from '../web/i18n-strings.mjs';
import { code, sourceBlock } from './helpers/source';


const app = readFileSync('web/app.js', 'utf8');
const lift = (env: Record<string, any>, sources: string[], exported: string) => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, `${sources.join('\n')}\nreturn ${exported};`)(...names.map((n) => env[n]));
};

describe('the pool a chart is drawn from, chosen by the person [2026-10-27]', () => {
  it('POOLCHOICE-01: one pool\'s depth is the reserve of the side the price is in, kept a minute; none where it is locked or does not answer', async () => {
    const answers: Record<string, any> = {
      'dedust:B': { reserves: [5n, 10_642n * 10n ** 9n] },
      'stonfi:A': { reserves: [5_485n * 10n ** 9n, 9n] },
      'stonfi:L': { reserves: [10n ** 30n, 1n], locked: true },
      'dedust:X': new Error('down'),
    };
    const asked: string[] = [];
    const depths = new Map();
    const depthOf = lift({
      readRoutePool: async ({ route }: any) => { asked.push(route.key); const one = answers[route.key]; if (one instanceof Error) throw one; return one; },
      routeLocked: (_route: any, pool: any) => pool.locked === true, isTonRpcRateLimitError: () => true, console,
      WALLET_PRICE_FRESH_MS: 60_000, walletPriceDepths: depths,
    }, [sourceBlock(app, 'async function walletPriceDepthOf(')], 'walletPriceDepthOf');
    const route = (key: string, offerSide: number) => ({ key, pair: { offer: { id: 'DOGS' }, ask: { id: 'GRAM' }, offerSide } });
    expect((await depthOf(route('dedust:B', 0), { id: 'GRAM' })).depth, 'GRAM at side 1').toBe(10_642n * 10n ** 9n);
    expect((await depthOf(route('stonfi:A', 1), { id: 'GRAM' })).depth, 'GRAM at side 0').toBe(5_485n * 10n ** 9n);
    expect((await depthOf(route('stonfi:L', 1), { id: 'GRAM' })).depth, 'a locked pool: no depth').toBeNull();
    expect((await depthOf(route('dedust:X', 0), { id: 'GRAM' })).depth, 'no answer: no depth').toBeNull();
    await depthOf(route('dedust:B', 0), { id: 'GRAM' });
    expect(asked.filter((key) => key === 'dedust:B'), 'a minute later, not asked again').toHaveLength(1);
    expect((await depthOf(route('dedust:B', 0), { id: 'DOGS' })).depth, 'the other side, from the same reserves').toBe(5n);
    expect(asked.filter((key) => key === 'dedust:B')).toHaveLength(1);
  });

  it('POOLCHOICE-02: the exchange is a choice where the pair has more than one listed pool; a chosen pool ends the reads of the one before', () => {
    const chart = code(sourceBlock(app, 'function walletPriceChart('));
    expect(chart).toContain('const pools = compact ? [] : [...candidates, ...swapRoutes(base, quote).filter((one) => !candidates.some((known) => known.pair.pool === one.pair.pool))];');
    expect(chart).toContain("if (pools.length < 2) return fact(t('wallet.priceExchangeLabel'), exchange);");
    expect(chart, 'MEASURED before: a plain "Exchange DeDust", nothing to press').toContain('exchange ? exchangeFact() : null,');
    expect(chart).toContain("row.setAttribute('aria-checked', String(one.pair.pool === route.pair.pool));");
    expect(chart).toContain('void walletPriceDepthOf(one, ask, undefined, () => box.isConnected && !poolMenu.hidden).then(');
    expect(chart).toContain('void walletPriceRoute(first ? [first] : candidates, ask, first && first.pair.pool !== candidates[0].pair.pool ? null : givenPool, undefined, () => box.isConnected)'); expect(chart).toContain('.then((read) => { if (firstEra === readEra) adopt(read); });');
    expect(chart).toContain('void walletPriceRoute([one], ask, null, undefined, () => box.isConnected).then((read) => { if (era === readEra) adopt(read); });');
    expect(chart).toContain('const readKey = key;');
    expect(chart).toContain('walletPriceReads.set(readKey, { at: Date.now(), points: fresh });');
    const press = chart.slice(chart.indexOf('const choosePool = (one, { follow = false } = {}) => {'));
    expect(press.indexOf('route = one;'), 'the pool taken at the press').toBeLessThan(press.indexOf('void walletPriceRoute([one]'));
    expect(press).toContain('walletPricePoolChoices.set(choiceKey, one.pair.pool);');
    expect(press).toContain('onPoints?.([]);');
    expect(chart).not.toContain("poolMenu.addEventListener('focusout'");
    expect(chart).toContain("if (event.key === 'Tab') { setTimeout(() => { if (!poolMenu.hidden && !poolMenu.contains(document.activeElement)) closePools(); }, 0); return; }");
    expect(chart).toContain('const first = chosenBefore;');
    expect(code(sourceBlock(app, 'function walletCardSend('))).toContain("button.addEventListener('click', doorPress(() => { closeWalletGroup(); return onPress(); }, { money }));");
    expect(code(sourceBlock(app, 'function walletCardSideButton('))).toContain("button.addEventListener('click', doorPress(() => { closeWalletGroup(); return onPress(); }, { money }));");
    expect(code(sourceBlock(app, 'function walletMarketTrades('))).toContain("box.style.minHeight = rows.length || !box.childElementCount ? '' : `${Math.round(box.getBoundingClientRect().height)}px`;");
    expect(chart).toContain('if (!box.isConnected || !parts || parts.dots.firstChild !== circles[0]) return;');
    const choose = chart.slice(chart.indexOf('const choosePool = (one, { follow = false } = {}) => {'));
    expect(choose).toContain('readEra += 1;');
    expect(chart).toContain('if (!box.isConnected || era !== readEra) return;');
    expect(chart).toMatch(/if \(era !== readEra\) return;\s+if \(box\.isConnected && shown < 0\) draw\(fresh, intro && !chart\);/);
    expect(chart).toContain("depthShown = depth === null ? '' : depthText(depth);");
  });

  it('POOLCHOICE-03: the words in every language, and the list drawn on the chart', () => {
    for (const { code: locale } of I18N_LOCALES as any[]) {
      for (const key of ['wallet.pricePools', 'wallet.pricePoolChoose', 'wallet.pricePoolStable']) expect(I18N_STRINGS[locale][key], `${locale} ${key}`).toBeTruthy();
    }
    const css = readFileSync('web/styles.css', 'utf8');
    expect(css).toMatch(/\.wallet-price-pools \{\s*position: absolute;/);
    expect(css).toContain('.wallet-price-pools[hidden] { display: none; }');
    expect(css).toContain('.wallet-price-pool[aria-expanded="true"] > .icon { transform: rotate(180deg); }');
  });

  it('POOLCHOICE-04: a change that rounds to nothing is said as nothing; a click on the pool\'s button after one on the chart is not lost; the head keeps its place while a pool is read [round 78 — C5-2..C5-4]', () => {
    const fmt = lift({}, [sourceBlock(app, 'function walletPriceChange(change) {'), sourceBlock(app, 'function walletPriceTone(change) {')], '{ change: walletPriceChange, tone: walletPriceTone }');
    expect([fmt.change(-0.00001), fmt.tone(-0.00001)], 'MEASURED before: "\u22120.00%" in the danger colour').toEqual(['0.00%', 'up']);
    expect([fmt.change(0.0123), fmt.tone(0.0123), fmt.change(-0.0123), fmt.tone(-0.0123)]).toEqual(['+1.23%', 'up', '\u22121.23%', 'down']);
    const chart = code(sourceBlock(app, 'function walletPriceChart('));
    expect(chart, 'MEASURED before: the first click on "Exchange" after a click on the chart was lost').toContain("plot.addEventListener('blur', () => { if (shown >= 0) release(); });");
    const press = chart.slice(chart.indexOf('const choosePool = (one, { follow = false } = {}) => {'));
    expect(press, 'MEASURED before: Buy/Sell rose 83 px at 320 px while a pool was read').toContain('stat.style.minWidth = `${Math.ceil(stat.getBoundingClientRect().width)}px`;');
    expect(press).toContain("for (const node of [...detail.childNodes]) if (node.nodeType === Node.TEXT_NODE) node.remove();");
    expect(press).toContain('pressure.style.minHeight = `${Math.round(pressure.getBoundingClientRect().height)}px`;');
    expect(press).toContain("pressure.style.visibility = 'hidden';");
    expect(press).not.toContain('pressure.replaceChildren();');
    expect(chart).toContain("pressure.style.minHeight = '';");
    expect(chart).toContain("pressure.style.visibility = '';");
  });

  it('POOLCHOICE-05: a swap sent makes its pool the pair\'s chart for the session — drawn after it, and the chart on the page now; the swap keeps its best rate [2026-10-28]', () => {
    const choices = new Map();
    const charts = new Set<any>();
    const followed: string[] = [];
    const chart = (key: string, alive: boolean) => ({ key, at: 0, alive: () => alive, follow: (pool: string) => followed.push(`${key}>${pool}`) });
    const live = chart('NOT|GRAM', true);
    const gone = chart('NOT|GRAM', false);
    const other = chart('DOGS|GRAM', true);
    for (const one of [live, gone, other]) charts.add(one);
    const follow = lift({ walletPricePoolChoices: choices, walletPriceCharts: charts }, [sourceBlock(app, 'function walletPriceFollowTrade(route) {')], 'walletPriceFollowTrade');
    follow({ pair: { pool: 'dedust-not', offer: { id: 'GRAM' }, ask: { id: 'NOT' } } });
    expect(choices.get('NOT|GRAM'), 'MEASURED before: the chart stayed on STON.fi, the purchase nowhere in its trades').toBe('dedust-not');
    expect(choices.get('GRAM|NOT')).toBe('dedust-not');
    expect(followed, 'the chart of the pair on the page follows; another pair\'s does not').toEqual(['NOT|GRAM>dedust-not']);
    expect(charts.has(gone), 'a chart gone is let go').toBe(false);
    const swap = code(sourceBlock(app, 'async function openWalletSwapDialog('));
    expect(swap.indexOf('walletPriceFollowTrade(route);'), 'after the send, never before').toBeGreaterThan(swap.indexOf('await sendWalletAssetMessage(signer, message);'));
    expect(swap, 'its own try: a throw there would call a sent swap refused [round 80 — C5-2]').toContain('try { walletPriceFollowTrade(route); } catch (error) { console.error(error); }');
    const forget = code(sourceBlock(app, 'function walletMarketForget() {'));
    expect(forget).toContain('walletPricePoolChoices.clear();');
    expect(forget).toContain('walletPriceCharts.clear();');
    expect(app.indexOf('const walletPricePoolChoices = new Map();'), 'declared at the top (TDZ)').toBeLessThan(app.indexOf('function walletMarketForget() {'));
    expect(app.indexOf('const walletPriceCharts = new Set();')).toBeLessThan(app.indexOf('function walletMarketForget() {'));
    expect(code(sourceBlock(app, 'function walletPriceChart('))).toMatch(/if \(box\.getClientRects\(\)\.length\) read\(attempt \+ 1\);\s+else setTimeout\(retry, WALLET_PRICE_RETRY_MS\[0\]\);/);
    const chartCode = code(sourceBlock(app, 'function walletPriceChart('));
    expect(chartCode).toContain('if (!follow) poolButton.focus({ preventScroll: true });');
    expect(chartCode).toContain('follow: (pool) => { const one = pools.find((each) => each.pair.pool === pool); if (one) choosePool(one, { follow: true }); } });');
  });
});
