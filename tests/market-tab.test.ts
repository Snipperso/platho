import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { POOL_STATES_MAX, bocRootCell, poolReservesFromData, readPoolReserves } from '../web/pool-state.mjs';


const app = readFileSync('web/app.js', 'utf8');
const html = readFileSync('web/index.html', 'utf8');
const fixtures = JSON.parse(readFileSync('tests/fixtures/pool-states.json', 'utf8')) as { dex: string; address: string; dataBoc: string; reserves: string[] }[];

describe('the Market', () => {
  it('MARKET-SCREEN-FIRST-01: on a window taller than a batch, every row on screen is priced — the screen first, the batch never smaller', async () => {
    const ids = Array.from({ length: 46 }, (_, i) => `t${i}`);
    const top = 0;
    const rowAt = (i: number) => ({ dataset: { marketId: ids[i] }, getBoundingClientRect: () => ({ top: top + (i - 2) * 54, bottom: top + (i - 1) * 54 }) });
    const rows = ids.map((_, i) => rowAt(i));
    const asked: string[][] = [];
    const walletMarket: any = {
      reading: false, again: false, seen: new Set(ids), rows: new Map(ids.map((id, i) => [id, rows[i]])), reserves: new Map(),
      list: { querySelectorAll: () => rows }, scroller: { getBoundingClientRect: () => ({ top: 0, bottom: 34 * 54 }) },
    };
    const env: Record<string, any> = {
      walletMarket, WALLET_MARKET_BATCH: 32, PRICE_USDT: 'usdt', walletMarketRouteOf: (id: string) => ({ pair: { pool: id, stable: false }, dex: 'ston' }),
      readPoolReserves: async ({ pools }: any) => { asked.push(pools.map((pool: any) => pool.address)); return new Map(); },
      createToncenterRestFetch: () => null, toncenterRestOrigin: () => '', walletMarketPaint: () => {}, isTonRpcRateLimitError: () => false, console,
    };
    const names = Object.keys(env);
    // eslint-disable-next-line no-new-func
    const read = new Function(...names, `${sourceBlock(app, 'async function walletMarketRead(')}\nreturn walletMarketRead;`)(...names.map((n) => env[n]));
    await read();
    const onScreen = ids.slice(2, 36);
    expect(onScreen.filter((id) => !asked[0].includes(id)), 'MEASURED before: ["t34", "t35"]').toEqual([]);
    expect(asked[0].length, 'the 34 on screen and the USD pool').toBe(35);
    walletMarket.seen = new Set(ids.slice(0, 20));
    await read();
    expect(asked[1]).toEqual([...ids.slice(0, 20), 'usdt']);
  });

  it('MARKET-01: a pool\'s reserves read from its data equal its get-method\'s — STON.fi (code libraries among its cells) and DeDust', () => {
    expect(fixtures.map((one) => one.dex)).toEqual(['stonfi', 'dedust']);
    for (const one of fixtures) expect(poolReservesFromData(one.dex, one.dataBoc).map(String), one.dex).toEqual(one.reserves);
    expect(bocRootCell(fixtures[1].dataBoc).bitLength).toBe(516);
    expect(() => poolReservesFromData('other', fixtures[0].dataBoc)).toThrow(/no layout/);
    expect(() => bocRootCell(Buffer.from('not a boc').toString('base64'))).toThrow(/not a BoC/);
  });

  it('MARKET-02: many pools in one call, a hundred at most; an account not active or not readable is left out', async () => {
    const asked: string[] = [];
    const pools = [...fixtures.map((one) => ({ address: one.address, dex: one.dex })), ...Array.from({ length: 120 }, (_, i) => ({ address: `0:${String(i).padStart(64, '0')}`, dex: 'stonfi' }))];
    const fetchImpl = async (url: string) => {
      asked.push(url);
      const accounts = fixtures.filter((one) => url.includes(encodeURIComponent(one.address))).map((one) => ({ address: one.address.toUpperCase(), status: 'active', data_boc: one.dataBoc }));
      accounts.push({ address: `0:${'0'.repeat(64)}`, status: 'active', data_boc: 'AAAA' });
      return { ok: true, json: async () => ({ accounts }) };
    };
    const read = await readPoolReserves({ fetchImpl, origin: 'https://o', pools });
    expect(asked).toHaveLength(Math.ceil(pools.length / POOL_STATES_MAX));
    expect(asked[0]).toMatch(/^https:\/\/o\/api\/v3\/accountStates\?address=.*&include_boc=true$/);
    expect([...read.keys()]).toEqual(fixtures.map((one) => one.address.toLowerCase()));
    await expect(readPoolReserves({ fetchImpl: async () => ({ ok: false, status: 429 }), origin: 'https://o', pools })).rejects.toMatchObject({ status: 429 });
  });

  it('MARKET-03: the fourth tab — its state declared before the boot switches tabs, read only while seen, every 30 s, one read at a time with none lost', () => {
    expect(html).toMatch(/id="walletTabMarket" data-wallet-tab="market" aria-controls="walletMarketPanel"/);
    expect(html).toContain('id="walletMarketPanel" role="tabpanel"');
    expect(app.indexOf('const walletMarket = {')).toBeLessThan(app.indexOf('function showWalletAssetsTab('));
    expect(app).toContain('const WALLET_MARKET_REFRESH_MS = 30_000;');
    const show = code(sourceBlock(app, 'function showWalletAssetsTab('));
    expect(show).toContain("['tokens', 'nft', 'history', 'market'].includes(tab)");
    expect(show).toContain("if (unlocked && walletAssetsState.tab === 'market') { if (!walletMarket.timer) walletMarketTick(); }");
    expect(code(sourceBlock(app, 'async function loadWalletAssets('))).toContain("if (tab === 'market') return;");
    const tick = code(sourceBlock(app, 'function walletMarketTick('));
    expect(tick).toContain('if (!panel || panel.hidden || !plathoWallet) return;');
    expect(tick).toContain('if (isVaultViewActive() && pageOnScreen()) {');
    expect(tick).toContain('void walletMarketRead({ beat: true });');
    const read = code(sourceBlock(app, 'async function walletMarketRead('));
    expect(read).toContain('if (walletMarket.reading) { walletMarket.again = true; return; }');
    expect(read).toContain('if (walletMarket.again) { walletMarket.again = false; void walletMarketRead(); }');
    expect(read).toContain("createToncenterRestFetch({ requestOptions: { priority: 'focus' } })");
    expect(readFileSync('web/sw.js', 'utf8')).toMatch(/'\.\/pool-state\.mjs\?v=\d+'/);
    expect(readFileSync('scripts/prepare_static_web_deploy.mjs', 'utf8')).toContain("'pool-state.mjs',");
  });

  it('MARKET-04: a token\'s page — its chart read again while seen, its trades under it, Buy opening the swap on that token; on a desktop, the pane beside the list', async () => {
    const parts = code(sourceBlock(app, 'function walletMarketTokenParts('));
    expect(parts).toContain('walletPriceChart(item.id, GRAM, { route, pool, wide, refreshMs: WALLET_MARKET_REFRESH_MS,');
    expect(parts).toContain('const pool = held && Date.now() - held.at < 2 * WALLET_MARKET_REFRESH_MS ? { reserves: held.reserves } : null;');
    expect(parts).toContain('onPoints: (points) => walletMarketTrades(trades, points, item.symbol, tradesShown) });');
    expect(code(sourceBlock(app, 'function openWalletMarketToken('))).toContain('void runWalletSwap(GRAM, item.id);');
    expect(code(sourceBlock(app, 'function openWalletMarketToken('))).toContain('void runWalletSwap(item.id, GRAM);');
    const buttons = code(sourceBlock(app, 'function walletMarketTradeButtons('));
    expect(buttons).toContain('const settle = () => { sell.disabled = !walletSwapOffers().some((offer) => offer.id === item.id); };');
    expect(buttons).toContain('row.settleSell = settle;');
    expect(buttons).toContain("if (!walletAssetsState.tokens) void loadWalletAssets('tokens').then(settle, settle);");
    expect(app).not.toContain('function walletHeldOf(');
    expect(code(sourceBlock(app, 'async function loadWalletAssets('))).toContain('walletMarketSettleTrades();');
    expect(code(sourceBlock(app, 'function walletMarketSettleTrades('))).toContain("for (const buttons of document.querySelectorAll('.wallet-market-trade-buttons')) buttons.settleSell?.();");
    const dialog = code(sourceBlock(app, 'async function openWalletSwapDialog('));
    expect(dialog).toContain('const offer = start ? offers.find((one) => one.id === start) : offers[0];');
    expect(dialog).toContain("if (!offer) { showAppNotice(t('wallet.swapNotHeld')); return null; }");
    expect(dialog).not.toContain('?? offers[0]');
    const asked: string[] = [];
    const refresh = new Function('plathoWallet', 'isVaultViewActive', 'walletAssetsState', 'loadWalletAssets',
      `${sourceBlock(app, 'async function refreshWalletAssets(')}; return refreshWalletAssets;`)({}, () => true, { tab: 'market' },
      async (tab: string) => { asked.push(tab); });
    await refresh({ force: true });
    expect(asked).toEqual(['tokens']);
    expect(html).not.toMatch(/data-wallet-tab="[a-z]+"[^>]*tabindex="-1"/);
    expect(code(sourceBlock(app, 'function showWalletAssetsTab('))).not.toContain('tabIndex');
    expect(code(sourceBlock(app, 'function resetWalletAssets('))).toContain('walletMarketForget();');
    const market = { timer: 7, soon: 8, observer: null, pageObserver: null, moreObserver: null, fitObserver: { disconnect() { this.off = true; } }, box: {}, list: {},
      head: {}, detail: {}, selected: '0:AA', items: [{ id: '0:AA', balance: 5n }], rows: new Map([['0:AA', {}]]), seen: new Set(['0:AA']),
      routes: new Map([['0:AA', {}]]), reserves: new Map([['pool', [1n, 2n]]]) } as Record<string, unknown> & { fitObserver: { off?: boolean } };
    const fitWatcher = market.fitObserver;
    const choices = new Map([['DOGS|GRAM', 'ston-dogs']]);
    const charts = new Set([{ key: 'DOGS|GRAM' }]);
    new Function('walletMarket', 'clearTimeout', 'walletPricePoolChoices', 'walletPriceCharts',
      `${sourceBlock(app, 'function walletMarketForget(')}; walletMarketForget();`)(market, () => {}, choices, charts);
    expect([choices.size, charts.size], 'the pools this wallet chose and traded through go with it [round 80 — C5-3]').toEqual([0, 0]);
    market.fitObserver = Object.assign(fitWatcher, { kept: market.fitObserver });
    expect([market.box, market.detail, market.selected, (market.items as unknown[]).length, (market.rows as Map<string, unknown>).size,
      (market.seen as Set<string>).size, (market.routes as Map<string, unknown>).size, market.fitObserver.off, (market.reserves as Map<string, unknown>).size])
      .toEqual([null, null, null, 0, 0, 0, 0, true, 1]);
    const shortOf = new Function(`${sourceBlock(app, 'function walletShortAmount(')}; return walletShortAmount;`)();
    expect(['0.9999', '999.9999', '999999.9999', '0.29', '725.2432', '701074.1433', '1500000', '0', '1999999.9999', '2099999.9999', '12999999.9999', '1.13',
      '99999999.9999', '1999999999.9999', '1000', '1 234,5', '.5', '1160900000', '10014924659800000'].map(shortOf))
      .toEqual(['0.99', '999.99', '999.9K', '0.29', '725.24', '701K', '1.5M', '0', '1.9M', '2M', '12.9M', '1.13', '99.9M', '1.9B', '1K', '1.2K', '0.5',
        '1.1B', '10014.9T']);
    expect(code(sourceBlock(app, 'function openWalletTokenCard('))).toContain('...(walletSwapOffers().some((offer) => offer.id === token.master)');
    expect(readFileSync('web/styles.css', 'utf8')).toMatch(/\.buy-ath-card \.swap-card-tag \{[^}]*text-transform: none;[^}]*color: var\(--text-muted\);/);
    expect(code(sourceBlock(app, 'function walletPriceChart('))).toContain('box.dataset.tone = change.dataset.tone;');
    const pane = code(sourceBlock(app, 'function walletMarketShow('));
    expect(pane).toContain('walletMarketTokenParts(item, route, { wide: true, tradesShown: 40, onBuy: () => void runWalletSwap(GRAM, item.id),');
    expect(pane).toContain('onSell: () => void runWalletSwap(item.id, GRAM) }));');
    expect(code(sourceBlock(app, 'function renderWalletMarket('))).toContain('onOpen: () => (isDesktopLayout() ? walletMarketShow(item, route) : openWalletMarketToken(item, route))');
    expect(readFileSync('web/styles.css', 'utf8')).toMatch(/@media \(min-width: 901px\) \{\s*\.wallet-market \{ grid-template-columns: minmax\(340px, 420px\) minmax\(0, 1fr\);/);
    expect(code(sourceBlock(app, 'async function openWalletSwapDialog('))).toContain('choose((startAsks.find((ask) => ask.id === asked) ?? startAsks.find((ask) => ask.id === walletAthMaster()) ?? startAsks[0])?.id ?? \'\');');
    const chart = code(sourceBlock(app, 'function walletPriceChart('));
    expect(chart).toMatch(/if \(box\.getClientRects\(\)\.length && pageOnScreen\(\)\) \{\s+read\(0, true\);/);
    expect(chart).toMatch(/const read = \(attempt = 0, force = false\) => \{\s+if \(!box\.isConnected\) return;\s+const era = readEra;\s+const readKey = key;\s+const kept = walletPriceReads\.get\(readKey\);/);
    expect(chart).toContain('const wanted = () => box.isConnected && era === readEra;');
    expect(code(sourceBlock(app, 'function walletMarketPrice('))).toContain('if (!route || route.pair.stable) return null;');
    expect(app).toContain('const WALLET_MARKET_BATCH = 32;');
    expect(code(sourceBlock(app, 'async function walletMarketRead('))).toContain('order.slice(0, batch).map(walletMarketRouteOf)');
    expect(code(sourceBlock(app, 'function walletMarketPaint('))).toContain('for (const id of walletMarket.seen) {');
    const cssText = readFileSync('web/styles.css', 'utf8');
    expect(cssText).toMatch(/\.wallet-market-side \{\s*grid-template-rows: auto minmax\(0, 1fr\);\s*grid-auto-rows: auto;\s*height: var\(--market-room, calc\(100vh - 110px\)\);\s*\}/);
    expect(cssText).toMatch(/\.wallet-market-detail \{[^}]*min-height: var\(--market-room, calc\(100vh - 110px\)\);\s*max-height: var\(--market-room, calc\(100vh - 110px\)\);\s*align-content: start;\s*overflow: auto;/);
    expect(cssText).toMatch(/\.wallet-market-list \{ overflow-y: auto; align-content: start; \}/);
    expect(cssText).not.toMatch(/\.wallet-market-(side|detail) \{[^}]*position: sticky/);
    expect(cssText).not.toMatch(/is-docked/);
    expect(cssText).toMatch(/\.wallet-market-list,\s*\.wallet-market-detail \{ scrollbar-width: none; \}/);
    const fit = code(sourceBlock(app, 'function walletMarketFit('));
    expect(fit).toContain('const still = page.clientHeight - sideAt - under;');
    expect(fit).toContain('const room = still >= WALLET_MARKET_ROOM_MIN ? still');
    expect(fit).toContain(': Math.max(WALLET_MARKET_ROOM_MIN, still + (card.getBoundingClientRect().bottom - origin));');
    const render = code(sourceBlock(app, 'function renderWalletMarket('));
    expect(render).toContain("walletMarket.fitObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {");
    expect(render).toContain('if (walletMarket.drawnDesktop !== null && walletMarket.drawnDesktop !== isDesktopLayout()) walletMarket.redraw?.();');
    expect(render).toContain('walletMarket.redraw = draw;');
    expect(render).toContain("const scroller = walletMarket.drawnDesktop ? list : panel.closest('.wallet-scroll-content');");
    expect(render).toContain("page.addEventListener('wheel', walletMarketWheel, { passive: false });");
    const wheelOn = (scrollTop: number, max: number, columnTop = 0) => {
      const page = { scrollTop, scrollHeight: 1000 + max, clientHeight: 1000, to: null as number | null, scrollTo(o: { top: number }) { this.to = o.top; } };
      const column = { scrollTop: columnTop };
      const state = { box: { isConnected: true, contains: () => true }, wheelTo: 0, wheelAt: -1e9, columnRun: false };
      const handler = new Function('walletMarket', 'walletNftMarket', 'walletAssetsState', 'isDesktopLayout', 'performance',
        `${sourceBlock(app, 'function walletMarketHeading(')}\n${sourceBlock(app, 'function walletMarketWheel(')}\nreturn walletMarketWheel;`)(
        state, { mode: 'tokens', box: null }, { tab: 'market' }, () => true, { now: () => 0 });
      const send = (deltaY: number, cancelable = true, over: unknown = column) => {
        let kept = false;
        handler({ currentTarget: page, deltaY, deltaMode: 0, ctrlKey: false, cancelable, target: { closest: () => over }, preventDefault: () => { kept = true; } });
        return { kept, to: page.to };
      };
      return Object.assign(send, { column });
    };
    let send = wheelOn(0, 281);
    expect(send(100)).toEqual({ kept: true, to: 100 });
    expect(send(300)).toEqual({ kept: true, to: 281 });
    expect(send(100)).toEqual({ kept: false, to: 281 });
    send = wheelOn(0, 0);
    expect(send(100)).toEqual({ kept: false, to: null });
    expect(send(-100)).toEqual({ kept: false, to: null });
    send = wheelOn(281, 281, 500);
    expect(send(-100)).toEqual({ kept: false, to: null });
    send.column.scrollTop = 0;
    expect(send(-100, false)).toEqual({ kept: false, to: 181 });
    send = wheelOn(281, 281, 500);
    expect(send(-100, false)).toEqual({ kept: false, to: null });
    send = wheelOn(0, 281);
    expect(send(100, true, null)).toEqual({ kept: false, to: null });
    expect(send(100, false)).toEqual({ kept: false, to: null });
    expect(code(sourceBlock(app, 'function walletMarketPaint('))).not.toMatch(/offsetWidth|offsetHeight|getBoundingClientRect/);
    expect(code(sourceBlock(app, 'async function walletMarketRead('))).not.toMatch(/offsetWidth|offsetHeight/);
    expect(code(sourceBlock(app, 'function renderWalletAssets('))).toContain("if (tab === 'market') { renderWalletMarket(panel); return; }");
    expect(chart).toContain('if (!force && kept && Date.now() - kept.at < WALLET_PRICE_FRESH_MS) { again(); return; }');
    expect(code(sourceBlock(app, 'function walletMarketTrades('))).toContain('points.slice(-count).reverse()');
    expect(render).toContain('if (watching) slice(WALLET_MARKET_PAGE);');
    expect(render).toContain('if (next < shown.length) { more = sentinel(); list.append(more); walletMarket.moreObserver?.observe(more); }');
    expect(render).toContain('for (const entry of entries) (entry.isIntersecting ? fill : vacate)(entry.target);');
    expect(render).toContain("page.style.height = `${page.getBoundingClientRect().height}px`;");
    const css = readFileSync('web/styles.css', 'utf8');
    const scrollerAt = css.indexOf('.wallet-pane > .wallet-scroll-content {');
    expect(css.slice(scrollerAt, css.indexOf('}', scrollerAt))).not.toMatch(/mask-image/);
    expect(css).not.toMatch(/\.wallet-pane::after/);
    expect(app).toContain('const WALLET_MARKET_PAGE = 40;');
    expect(code(sourceBlock(app, 'function walletSwapPickerItems('))).toContain('swapAskEntries(offerId).map(({ ask, lively, best })');
    expect(chart).toContain('if (!animate && parts?.svg.isConnected && fromChart && points.some((point) => fromPoints.some((one) => tradeKey(one) === tradeKey(point)))) {');
    expect(chart).toContain('const k = Math.min(1, (now - started) / 700);');
    const styles = readFileSync('web/styles.css', 'utf8');
    expect(styles).toMatch(/@property --price-tone \{\s*syntax: '<color>';/);
    expect(styles).toContain('transition: --price-tone 0.8s ease;');
    expect(code(sourceBlock(app, 'function renderWalletMarket('))).toContain("stat(t('wallet.marketPoolLabel'), `${walletCompact(measured.depth)} GRAM`, measured.depth < POOL_SHALLOW_DEPTH_GRAM)");
    expect(app).toContain('const WALLET_PRICE_THIN_GRAM = BigInt(POOL_SHALLOW_DEPTH_GRAM) * 10n ** 9n;');
    expect(readFileSync('web/swap-routes.mjs', 'utf8')).toContain('export const POOL_SHALLOW_DEPTH_GRAM = 1_000;');
  });
});
