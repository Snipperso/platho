import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Cell } from '@ton/core';
import { sourceBlock } from './helpers/source';
import { swapWorld } from './helpers/swap-window';
import { bytesToBase64, serializeBoc } from '../web/pwa-contract-transactions.mjs';
import { formatUnits } from '../web/wallet-assets.mjs';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';
import { PLATHO_APP_CONFIG } from '../web/platho-config.mjs';
import { DEDUST_GRAM_VAULT } from '../web/dedust-pools.mjs';
import { GRAM, PTON_TON_TRANSFER_OPCODE, minimumOut, quoteSwap, swapAttachedNanotons, swapDeadline, swapPairsFrom, swapToken } from '../web/wallet-swap.mjs';
import { DEDUST_GRAM_GAS_NANOTONS, DEDUST_NATIVE_SWAP_OPCODE, dedustAssetCell, dedustPairsFrom, dedustToken, quoteDedustSwap } from '../web/wallet-swap-dedust.mjs';
import {
  DEDUST, STONFI, SWAP_EXCHANGE_NAMES, buildRouteMessage, estimateRoute, quoteRoute, readRoutePool, routeAmountInFor, routeAttachedNanotons, routeLocked,
  routePoolFeeBps, routeRate, swapAsksFrom, swapListedToken, swapRoutes, swapRoutesFrom,
} from '../web/swap-routes.mjs';


const app = readFileSync('web/app.js', 'utf8');
const css = readFileSync('web/styles.css', 'utf8');
const USDT = '0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe';
const SELF = `0:${'44'.repeat(32)}`;
const NANO = 1_000_000_000n;
const USD = 1_000_000n;
const RESERVE = 50_000n * NANO;
const GRAM_VAULT = `0:${Buffer.from(DEDUST_GRAM_VAULT, 'base64url').toString('hex')}`;
const constant = (name: string) => Number(new RegExp(`const ${name} = (\\d+);`).exec(app)![1]);
// eslint-disable-next-line no-new-func
const walletSwapRate = new Function('formatUnits', 'routeRate', `${sourceBlock(app, 'function walletSwapRate(route, pool) {')}\nreturn walletSwapRate;`)(formatUnits, routeRate);
const num = (value: bigint | number) => ({ type: 'num', value: `0x${BigInt(value).toString(16)}` });
const slice = (cell: any) => Cell.fromBoc(Buffer.from(serializeBoc(cell)))[0].beginParse();
const opcodeOf = (cell: any) => BigInt(slice(cell).loadUint(32));
const shown = (units: bigint, decimals: number) => formatUnits(units, decimals, { shown: Math.min(decimals, 6) }).replace(/\s/g, '');
const stableOut = (amount: bigint, reserve = RESERVE) => (amount * 9_990n) / 10_000n - (amount * amount) / (reserve * 10n);

const routeByPool = new Map(swapRoutesFrom(GRAM).map((route: any) => [route.pair.pool, route]));
function poolsWorld(reserves: Record<string, [bigint, bigint]>, { answerAsset = '' } = {}) {
  const calls: any[] = [];
  const failing = new Set<string>();
  let held: Array<() => void> | null = null;
  const transport = {
    runGetMethod: async (call: any) => {
      calls.push(call);
      if (held && call.priority === 'critical') await new Promise<void>((resolve) => { held!.push(resolve); });
      const route: any = routeByPool.get(call.address);
      const given = reserves[call.address];
      if (!route || !given || failing.has(call.address)) throw Object.assign(new Error('the pool did not answer'), { status: 429 });
      const [gram, other] = given;
      const ordered = route.pair.offerSide === 0 ? [gram, other] : [other, gram];
      if (call.method === 'get_pool_data') {
        const wallets = route.pair.offerSide === 0 ? [route.pair.offerWallet, route.pair.askWallet] : [route.pair.askWallet, route.pair.offerWallet];
        return { stack: [num(0), { address: route.pair.router }, num(0), num(ordered[0]), num(ordered[1]), { address: wallets[0] }, { address: wallets[1] }, num(20), num(10)] };
      }
      if (call.method === 'get_reserves') return { stack: [num(ordered[0]), num(ordered[1])] };
      if (call.method === 'get_trade_fee') return { stack: [num(route.pair.stable ? 5 : 10), num(10_000)] };
      if (call.method === 'estimate_swap_out') {
        const amount = BigInt(call.stack[1].value);
        const asset = { type: 'cell', value: bytesToBase64(serializeBoc(dedustAssetCell(answerAsset || route.pair.ask.id))) };
        return { stack: [asset, num(stableOut(amount, gram)), num((amount * 5n) / 10_000n)] };
      }
      throw new Error(`no getter ${call.method}`);
    },
  };
  return { transport, calls, failing, hold: () => { held = []; }, release: () => { const waiting = held ?? []; held = null; for (const go of waiting) go(); } };
}

function swapWindow(world: any, { ask = USDT }: { ask?: string } = {}) {
  const sent: any[] = [];
  const submitEnabled: boolean[] = [];
  const w = swapWorld({
    offers: [{ id: GRAM, symbol: 'GRAM', decimals: 9, balance: null }], gramBalance: 100n * NANO,
    env: {
      GRAM, swapRoutes, swapAsksFrom, readRoutePool, quoteRoute, estimateRoute, routeAmountInFor, routeLocked, routeAttachedNanotons, buildRouteMessage,
      routePoolFeeBps, STONFI, DEDUST, SWAP_EXCHANGE_NAMES, minimumOut, swapDeadline, walletSwapRate, serializeBoc,
      walletChainNowMs: () => 1_800_000_000_000, walletAthMaster: () => ask,
      plathoWallet: { address: SELF }, requirePlathoWallet: () => ({ address: SELF }), noteTonRpcRateLimit: () => true,
      globalThis: { plathoTonRpcTransport: world.transport },
      setActiveActionSubmitEnabled: (on: boolean) => { submitEnabled.push(on); }, activeActionDialog: null, balanceNeededText: (units: bigint) => `${units}`,
      WALLET_SWAP_IMPACT_MAX_BPS: constant('WALLET_SWAP_IMPACT_MAX_BPS'), WALLET_SWAP_IMPACT_WARN_BPS: constant('WALLET_SWAP_IMPACT_WARN_BPS'),
      requireNoPendingServiceWorkerAppShellReload: () => {}, criticalChainReadOptions: () => ({ priority: 'critical' }),
      loadConnectedAthWalletAddress: async () => '', readJettonWalletAddress: async () => '', nextTransferQueryId: () => 7n,
      sendWalletAssetMessage: async (_signer: any, message: any) => { sent.push(message); }, walletAssetSendRefusal: (error: any) => String(error?.message ?? error),
      walletAssetsSent: () => {},
    },
  });
  return Object.assign(w, { sent, submitEnabled });
}
const exchanges = (w: any) => {
  const box = w.tiles().dex;
  return {
    shown: !box.hidden,
    options: box.children[1].children.map((row: any) => {
      const [input, name] = row.children;
      return { dex: input.value, shown: !row.hidden, checked: input.checked, disabled: input.disabled, best: !name.children[1].hidden };
    }),
  };
};
const pickExchange = (w: any, dex: string) => {
  const input = w.tiles().dex.children[1].children.map((row: any) => row.children[0]).find((one: any) => one.value === dex);
  input.checked = true;
  input.listeners.change();
};
const typeGive = (w: any, text: string) => { const { input } = w.tiles(); input.value = text; input.listeners.input(); };
const summary = (w: any) => Object.fromEntries(w.dialog().summary({ slippage: '100' }).map((line: any) => [line.label, line.value]));
const leastIn = (message: any) => { const body = slice(message.body); body.skip(32 + 64); body.loadCoins(); body.loadAddress(); body.loadBit(); return body.loadCoins(); };

const [STON_USDT, DD_USDT] = swapRoutes(GRAM, USDT);
const USDT_POOLS: Record<string, [bigint, bigint]> = {
  [STON_USDT.pair.pool]: [1_000_000n * NANO, 1_245_000n * USD],
  [DD_USDT.pair.pool]: [211_040n * NANO, 262_842n * USD],
};
afterEach(() => { vi.useRealTimers(); });

describe('the routes, over both lists', () => {
  it('SWAPDEX-01: a pair both list has a route on each; what a token swaps for, each once, from either; a token only DeDust lists is named and swapped back', () => {
    expect([STON_USDT.dex, DD_USDT.dex, swapRoutes(GRAM, USDT).length]).toEqual([STONFI, DEDUST, 2]);
    expect(STON_USDT.key).not.toBe(DD_USDT.key);
    for (const route of [STON_USDT, DD_USDT]) expect([route.pair.offer.id, route.pair.ask.id]).toEqual([GRAM, USDT]);
    expect(swapRoutes(USDT, GRAM).map((route: any) => route.dex), 'and back').toEqual([STONFI, DEDUST]);
    const asks = swapAsksFrom(GRAM).map((ask: any) => ask.id);
    expect(new Set(asks).size, 'each token once').toBe(asks.length);
    expect(new Set(asks)).toEqual(new Set([...swapPairsFrom(GRAM), ...dedustPairsFrom(GRAM)].map((pair: any) => pair.ask.id)));
    expect(swapListedToken(USDT), 'a token both list: as STON.fi lists it').toEqual(swapToken(USDT));
    const only = dedustPairsFrom(GRAM).find((pair: any) => !swapToken(pair.ask.id))!.ask;
    expect(swapListedToken(only.id)).toEqual(dedustToken(only.id));
    expect(swapRoutes(only.id, GRAM).map((route: any) => route.dex)).toEqual([DEDUST]);
    expect(swapAsksFrom(only.id).map((ask: any) => ask.id)).toContain(GRAM);
    expect(swapRoutes(GRAM, `0:${'00'.repeat(32)}`), 'a token neither lists: no route').toEqual([]);
    expect(SWAP_EXCHANGE_NAMES).toEqual({ [STONFI]: 'STON.fi', [DEDUST]: 'DeDust' });
  });

  it('SWAPDEX-02: no Platho share on either exchange; each exchange\'s own fee, quote, message and work attached', () => {
    expect(PLATHO_APP_CONFIG.swapReferral).toBeUndefined();
    expect(routePoolFeeBps(STON_USDT, { lpFee: 20n, protocolFee: 10n })).toBe(30);
    expect(routePoolFeeBps(DD_USDT, { feeNumerator: 25n, feeDenominator: 10_000n })).toBe(25);
    const amountIn = 10n * NANO;
    const stonPool = { locked: false, reserves: STON_USDT.pair.offerSide === 0 ? [1_000_000n * NANO, 1_245_000n * USD] : [1_245_000n * USD, 1_000_000n * NANO], lpFee: 20n, protocolFee: 10n };
    const ston = quoteSwap({ pair: STON_USDT.pair, pool: stonPool, amountIn });
    expect(quoteRoute({ route: STON_USDT, pool: stonPool, amountIn })).toEqual({ out: ston.out, impactBps: ston.impactBps });
    expect(ston.referralFee).toBe(0n);
    const ddPool = { reserves: DD_USDT.pair.offerSide === 0 ? [211_040n * NANO, 262_842n * USD] : [262_842n * USD, 211_040n * NANO], feeNumerator: 10n, feeDenominator: 10_000n };
    const dd = quoteDedustSwap({ pair: DD_USDT.pair, pool: ddPool, amountIn });
    expect(quoteRoute({ route: DD_USDT, pool: ddPool, amountIn })).toEqual({ out: dd.out, impactBps: dd.impactBps });
    expect(routeLocked(STON_USDT, { ...stonPool, locked: true })).toBe(true);
    expect(routeLocked(DD_USDT, { ...ddPool, locked: true }), 'DeDust names no such state').toBe(false);
    const deadline = swapDeadline(1_800_000_000_000);
    const viaDedust = buildRouteMessage({ route: DD_USDT, amountIn: 5n * NANO, minOut: 3n, recipient: SELF, deadline, queryId: 3n });
    expect([viaDedust.address, viaDedust.value, opcodeOf(viaDedust.body), leastIn(viaDedust)]).toEqual([GRAM_VAULT, 5n * NANO + DEDUST_GRAM_GAS_NANOTONS, DEDUST_NATIVE_SWAP_OPCODE, 3n]);
    const viaSton = buildRouteMessage({ route: STON_USDT, amountIn: 5n * NANO, minOut: 3n, recipient: SELF, deadline, queryId: 3n });
    expect([viaSton.address, opcodeOf(viaSton.body)]).toEqual([STON_USDT.pair.offerWallet, PTON_TON_TRANSFER_OPCODE]);
    const swap = slice(viaSton.body);
    swap.skip(32 + 64);
    swap.loadCoins();
    swap.loadAddress();
    const tail = swap.loadRef().beginParse();
    tail.skip(32);
    tail.loadAddress(); tail.loadAddress(); tail.loadAddress(); tail.skip(64);
    const more = tail.loadRef().beginParse();
    more.loadCoins(); more.loadAddress(); more.loadCoins(); more.loadMaybeRef(); more.loadCoins(); more.loadMaybeRef();
    expect([more.loadUint(16), more.loadMaybeAddress()]).toEqual([0, null]);
    expect([routeAttachedNanotons(DD_USDT), routeAttachedNanotons(STON_USDT)]).toEqual([DEDUST_GRAM_GAS_NANOTONS, swapAttachedNanotons(STON_USDT.pair)]);
  });

  it('SWAPDEX-03: a stable pool is asked — its one unit with the pool, an amount when wanted; the depth against that unit; another asset named is refused', async () => {
    const [stable, ...more] = swapRoutesFrom(GRAM).filter((route: any) => route.pair.stable);
    expect(more.length + 1, 'the lists carry stable pools').toBeGreaterThan(0);
    const world = poolsWorld({ [stable.pair.pool]: [RESERVE, RESERVE] });
    const pool = await readRoutePool({ transport: world.transport, route: stable });
    expect(world.calls.map((call) => call.method).sort()).toEqual(['estimate_swap_out', 'get_reserves', 'get_trade_fee']);
    const unit = 10n ** BigInt(stable.pair.offer.decimals);
    expect([pool.unitIn, pool.unitOut, pool.feeNumerator, pool.feeDenominator]).toEqual([unit, stableOut(unit), 5n, 10_000n]);
    expect(routeRate(stable, pool)).toEqual({ unitIn: unit, unitOut: stableOut(unit) });
    expect(walletSwapRate(stable, pool)).toMatch(/^1 GRAM ≈ 0\.99/);
    expect(quoteRoute({ route: stable, pool, amountIn: unit }), 'not worked out here').toBeNull();
    const amount = 1_000n * unit;
    const ideal = (amount * pool.unitOut) / unit;
    expect(await estimateRoute({ transport: world.transport, route: stable, pool, amountIn: amount }))
      .toEqual({ out: stableOut(amount), impactBps: Number(((ideal - stableOut(amount)) * 10_000n) / ideal) });
    const want = 123_456_789n;
    const give = routeAmountInFor({ route: stable, pool, amountOut: want })!;
    expect(give, 'the one-unit price, rounded up').toBe((want * unit + pool.unitOut - 1n) / pool.unitOut);
    expect((give * pool.unitOut) / unit).toBeGreaterThanOrEqual(want);
    expect(routeAmountInFor({ route: stable, pool: { ...pool, unitOut: 0n }, amountOut: want })).toBeNull();
    const liar = poolsWorld({ [stable.pair.pool]: [RESERVE, RESERVE] }, { answerAsset: USDT });
    await expect(estimateRoute({ transport: liar.transport, route: stable, pool, amountIn: amount })).rejects.toMatchObject({ code: 'SWAP_POOL_DISAGREES' });
  });
});

describe('the swap window, with both', () => {
  it('SWAPDEX-04: the exchange under the amounts — the better rate for the amount taken and marked; the person\'s pick kept; the summary names it and its fees', async () => {
    const world = poolsWorld(USDT_POOLS);
    const w = swapWindow(world);
    void w.open(GRAM);
    await w.settle();
    const pools = { ston: await readRoutePool({ transport: poolsWorld(USDT_POOLS).transport, route: STON_USDT }), dd: await readRoutePool({ transport: poolsWorld(USDT_POOLS).transport, route: DD_USDT }) };
    const out = (route: any, amountIn: bigint) => quoteRoute({ route, pool: route === STON_USDT ? pools.ston : pools.dd, amountIn })!.out;
    expect(out(DD_USDT, NANO), 'DeDust gives more for one GRAM').toBeGreaterThan(out(STON_USDT, NANO));
    let look = exchanges(w);
    expect(look.shown).toBe(true);
    expect(look.options).toEqual([
      { dex: STONFI, shown: true, checked: false, disabled: false, best: false },
      { dex: DEDUST, shown: true, checked: true, disabled: false, best: true },
    ]);
    typeGive(w, '10');
    expect(w.tiles().getInput.value).toBe(shown(out(DD_USDT, 10n * NANO), 6));
    let lines = summary(w);
    expect(lines['wallet.swapExchange']).toBe('DeDust');
    expect(lines['wallet.swapPoolFee']).toBe('0.1%');
    expect(Object.keys(lines).some((label) => /platho/i.test(label)), 'no Platho fee line').toBe(false);
    expect(lines['wallet.swapMinimum']).toBe(`${formatUnits(minimumOut(out(DD_USDT, 10n * NANO), 100), 6, { shown: 6 })} USD₮`);
    expect(lines['common.balanceNeeded']).toBe(`${10n * NANO + DEDUST_GRAM_GAS_NANOTONS + 10_000_000n}`);
    pickExchange(w, STONFI);
    look = exchanges(w);
    expect(look.options.map((option: any) => [option.dex, option.checked, option.best])).toEqual([[STONFI, true, false], [DEDUST, false, true]]);
    expect(w.tiles().getInput.value).toBe(shown(out(STON_USDT, 10n * NANO), 6));
    lines = summary(w);
    expect([lines['wallet.swapExchange'], lines['wallet.swapPoolFee']]).toEqual(['STON.fi', '0.3%']);
    expect(Object.keys(lines).some((label) => /platho/i.test(label)), 'nor on STON.fi [decided 2026-10-24]').toBe(false);
    typeGive(w, '20');
    expect(out(DD_USDT, 20n * NANO)).toBeGreaterThan(out(STON_USDT, 20n * NANO));
    expect(exchanges(w).options.map((option: any) => [option.checked, option.best])).toEqual([[true, false], [false, true]]);
    expect(summary(w)['wallet.swapExchange']).toBe('STON.fi');
    const ath = swapPairsFrom(GRAM).find((pair: any) => pair.ask.symbol === 'ATH')!;
    expect(swapRoutes(GRAM, ath.ask.id).map((route: any) => route.dex)).toEqual([STONFI]);
    const lone = swapWindow(poolsWorld({ [ath.pool]: [1_000n * NANO, 1_000_000n * NANO] }), { ask: ath.ask.id });
    void lone.open(GRAM);
    await lone.settle();
    expect(exchanges(lone).shown).toBe(false);
    expect(summary(lone)['wallet.swapExchange']).toBe('STON.fi');
    for (const [locale, strings] of Object.entries(I18N_STRINGS as any)) {
      for (const key of ['wallet.swapExchange', 'wallet.swapBestRate']) expect((strings as any)[key], `${locale} ${key}`).toBeTruthy();
      expect((strings as any)['wallet.swapHint'], locale).toMatch(/STON\.fi[^.]*DeDust/);
    }
    expect(css).toMatch(/\.action-field\[hidden\],\s*\.swap-dex \.action-radio-option\[hidden\] \{\s*display: none;\s*\}/);
  });

  it('SWAPDEX-05: the press signs the exchange on screen — another picked during its check signs nothing; each exchange\'s own message', async () => {
    const world = poolsWorld(USDT_POOLS);
    const w = swapWindow(world);
    void w.open(GRAM);
    await w.settle();
    typeGive(w, '10');
    expect(summary(w)['wallet.swapExchange']).toBe('DeDust');
    world.hold();
    const pressing = w.dialog().validateSubmit({ slippage: '100' });
    await w.settle();
    pickExchange(w, STONFI);
    world.release();
    expect(await pressing).toEqual({ ok: false, error: 'wallet.swapPriceMoved' });
    expect(w.sent, 'nothing signed').toEqual([]);
    expect(await w.dialog().validateSubmit({ slippage: '100' })).toEqual({ ok: true, result: { sent: '1' } });
    expect([w.sent[0].address, opcodeOf(w.sent[0].body)], 'STON.fi on screen: its proxy-GRAM wallet').toEqual([STON_USDT.pair.offerWallet, PTON_TON_TRANSFER_OPCODE]);
    pickExchange(w, DEDUST);
    expect(await w.dialog().validateSubmit({ slippage: '100' })).toEqual({ ok: true, result: { sent: '1' } });
    const ddPool = await readRoutePool({ transport: poolsWorld(USDT_POOLS).transport, route: DD_USDT });
    const least = minimumOut(quoteRoute({ route: DD_USDT, pool: ddPool, amountIn: 10n * NANO })!.out, 100);
    expect([w.sent[1].address, w.sent[1].value, opcodeOf(w.sent[1].body), leastIn(w.sent[1])], 'DeDust: its GRAM vault, the least from the quote on screen')
      .toEqual([GRAM_VAULT, 10n * NANO + DEDUST_GRAM_GAS_NANOTONS, DEDUST_NATIVE_SWAP_OPCODE, least]);
    expect(world.calls.filter((call) => call.priority === 'critical').length).toBeGreaterThan(0);
    typeGive(w, '60000');
    expect(summary(w)['wallet.swapImpact']).toMatch(/^wallet\.swapImpactRefused/);
    expect(await w.dialog().validateSubmit({ slippage: '100' })).toEqual({ ok: false, error: 'wallet.swapTooShallow' });
    expect(w.sent.length).toBe(2);
  });

  it('SWAPDEX-06: a pool that does not answer — the other exchange offered meanwhile, the miss asked again until it answers; all missing said so', async () => {
    vi.useFakeTimers();
    const world = poolsWorld(USDT_POOLS);
    world.failing.add(DD_USDT.pair.pool);
    const w = swapWindow(world);
    void w.open(GRAM);
    await vi.advanceTimersByTimeAsync(0);
    expect(exchanges(w).options.map((option: any) => [option.dex, option.shown, option.disabled, option.checked]))
      .toEqual([[STONFI, true, false, true], [DEDUST, true, true, false]]);
    expect(summary(w)['wallet.swapExchange']).toBe('STON.fi');
    const asked = () => world.calls.filter((call) => call.address === DD_USDT.pair.pool && call.method === 'get_reserves').length;
    expect(asked()).toBe(1);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(asked(), 'asked again').toBe(2);
    world.failing.clear();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(asked()).toBe(3);
    expect(exchanges(w).options.map((option: any) => [option.dex, option.disabled, option.checked, option.best]))
      .toEqual([[STONFI, false, false, false], [DEDUST, false, true, true]]);
    const stonReads = world.calls.filter((call) => call.address === STON_USDT.pair.pool).length;
    await vi.advanceTimersByTimeAsync(20_000);
    expect([asked(), world.calls.filter((call) => call.address === STON_USDT.pair.pool).length], 'answered: neither asked again').toEqual([3, stonReads]);
    const none = poolsWorld(USDT_POOLS);
    none.failing.add(DD_USDT.pair.pool);
    none.failing.add(STON_USDT.pair.pool);
    const blind = swapWindow(none);
    void blind.open(GRAM);
    await vi.advanceTimersByTimeAsync(0);
    expect(summary(blind)['wallet.swapRate']).toBe('wallet.assetsRetry');
    none.failing.clear();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(summary(blind)['wallet.swapExchange']).toBe('DeDust');
  });

  it('SWAPDEX-07: a stable pool on screen — asked once the typing pauses, once an amount; the press asks it itself when the answer has not come', async () => {
    vi.useFakeTimers();
    const stable = swapRoutesFrom(GRAM).find((route: any) => route.pair.stable && swapRoutes(GRAM, route.pair.ask.id).length === 1)!;
    const held: Record<string, [bigint, bigint]> = { [stable.pair.pool]: [RESERVE, RESERVE] };
    const world = poolsWorld(held);
    const w = swapWindow(world, { ask: stable.pair.ask.id });
    void w.open(GRAM);
    await vi.advanceTimersByTimeAsync(0);
    const asks = (priority = '') => world.calls.filter((call) => call.method === 'estimate_swap_out' && (!priority || call.priority === priority)).map((call) => BigInt(call.stack[1].value));
    expect(exchanges(w).shown, 'one exchange offers it').toBe(false);
    expect(asks(), 'with the pool: one unit').toEqual([NANO]);
    expect(summary(w)['wallet.swapRate']).toMatch(/^1 GRAM ≈ 0\.99/);
    typeGive(w, '5');
    expect([w.tiles().getInput.value, summary(w)['wallet.swapMinimum']], 'asked, not answered yet').toEqual(['', 'wallet.swapReading']);
    await vi.advanceTimersByTimeAsync(299);
    expect(asks()).toEqual([NANO]);
    await vi.advanceTimersByTimeAsync(1);
    expect(asks()).toEqual([NANO, 5n * NANO]);
    expect(w.tiles().getInput.value).toBe(shown(stableOut(5n * NANO), stable.pair.ask.decimals));
    typeGive(w, '5.0');
    typeGive(w, '6');
    await vi.advanceTimersByTimeAsync(100);
    typeGive(w, '7');
    await vi.advanceTimersByTimeAsync(300);
    expect(asks(), 'the same amount answered already; one paused on').toEqual([NANO, 5n * NANO, 7n * NANO]);
    typeGive(w, '8');
    summary(w);
    expect(w.submitEnabled.at(-1), 'the button waits for the figure').toBe(false);
    expect(await w.dialog().validateSubmit({ slippage: '100' })).toEqual({ ok: false, error: 'wallet.swapReading' });
    await vi.advanceTimersByTimeAsync(300);
    summary(w);
    expect(w.submitEnabled.at(-1)).toBe(true);
    expect(await w.dialog().validateSubmit({ slippage: '100' })).toEqual({ ok: true, result: { sent: '1' } });
    expect(asks('critical'), 'the pool read again at the press, its one unit with it').toEqual([NANO, 8n * NANO]);
    expect([w.sent[0].address, opcodeOf(w.sent[0].body), leastIn(w.sent[0])]).toEqual([GRAM_VAULT, DEDUST_NATIVE_SWAP_OPCODE, minimumOut(stableOut(8n * NANO), 100)]);
    held[stable.pair.pool] = [RESERVE / 10_000n, RESERVE / 10_000n];
    expect((await w.dialog().validateSubmit({ slippage: '100' })).error).toBe('wallet.swapPriceMoved');
    expect(await w.dialog().validateSubmit({ slippage: '100' }), 'the screen took the answer the press met: the next press goes, not refused again').toEqual({ ok: true, result: { sent: '1' } });
    expect(w.sent.length).toBe(2);
    held[stable.pair.pool] = [RESERVE, RESERVE];
    const app = readFileSync('web/app.js', 'utf8');
    expect(app).toContain("if (state.typed === 'get' && route.pair.stable) {");
    expect(app).toMatch(/for \(let pass = 0; route && pass < 2; pass \+= 1\) \{[\s\S]{0,700}const settled = current\(\);\s*if \(!settled \|\| settled\.key === route\.key\) break;\s*route = settled;/);
  });
});
