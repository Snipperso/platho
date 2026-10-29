import { amountInFor, buildSwapMessage, quoteSwap, readSwapPool, swapAttachedNanotons, swapPairsFrom, swapToken } from './wallet-swap.mjs?v=20';
import {
  DEDUST, buildDedustSwapMessage, dedustAmountInFor, dedustPairsFrom, dedustSwapAttachedNanotons, dedustToken, estimateDedustSwap, quoteDedustSwap,
  readDedustPool,
} from './wallet-swap-dedust.mjs?v=13';
import { POOL_ACTIVITY, POOL_ACTIVITY_NEW, POOL_ACTIVITY_TAKEN } from './pool-activity.mjs?v=5';

export const STONFI = 'stonfi';
export { DEDUST };
export const SWAP_EXCHANGE_NAMES = Object.freeze({ [STONFI]: 'STON.fi', [DEDUST]: 'DeDust' });

export function swapListedToken(id) {
  return swapToken(id) ?? dedustToken(id);
}
export function swapRoutesFrom(offerId) {
  return [
    ...swapPairsFrom(offerId).map((pair) => ({ key: `${STONFI}:${pair.pool}`, dex: STONFI, pair })),
    ...dedustPairsFrom(offerId).map((pair) => ({ key: `${DEDUST}:${pair.pool}`, dex: DEDUST, pair })),
  ];
}
export const POOL_LIVELY_DEPTH_GRAM = 5_000;
export const POOL_LIVELY_TRADES = 30;
export const POOL_BUSY_TRADES = 600;
export const POOL_SHALLOW_DEPTH_GRAM = 1_000;
let activity = null;
export function routeActivity(route) {
  if (!activity) {
    activity = new Map(POOL_ACTIVITY.map(([id, depth, trades]) => {
      const text = atob(String(id).replace(/-/g, '+').replace(/_/g, '/'));
      let hex = '';
      for (let at = 0; at < text.length; at += 1) hex += text.charCodeAt(at).toString(16).padStart(2, '0');
      return [`0:${hex}`, { depth, trades }];
    }));
  }
  return activity.get(route.pair.pool) ?? null;
}
export function routeLively(route) {
  const measured = routeActivity(route);
  return Boolean(measured && measured.trades >= POOL_LIVELY_TRADES && (measured.depth >= POOL_LIVELY_DEPTH_GRAM || measured.trades >= POOL_BUSY_TRADES));
}
export function routeScore(route) {
  const measured = routeActivity(route);
  return measured ? Math.log10(1 + measured.depth) + Math.log10(1 + measured.trades) : -1;
}
export function swapAskEntries(offerId) {
  const seen = new Map();
  for (const route of swapRoutesFrom(offerId)) {
    const id = route.pair.ask.id;
    if (!seen.has(id)) seen.set(id, { ask: route.pair.ask, lively: false, score: -Infinity, best: null, rank: -Infinity });
    const known = seen.get(id);
    const score = routeScore(route);
    known.lively ||= routeLively(route);
    known.score = Math.max(known.score, score);
    const rank = score - (route.pair.stable ? 1000 : 0);
    if (rank > known.rank) { known.best = route; known.rank = rank; }
  }
  return [...seen.values()].sort((a, b) => Number(b.lively) - Number(a.lively) || b.score - a.score);
}
export function swapAsksFrom(offerId) {
  return swapAskEntries(offerId).map((one) => one.ask);
}
export const SWAP_NEW_ID = POOL_ACTIVITY_NEW.length ? `${POOL_ACTIVITY_TAKEN}:${POOL_ACTIVITY_NEW.length}:${POOL_ACTIVITY_NEW[0]}` : '';
let fresh = null;
export function swapTokenIsNew(id) {
  if (!fresh) {
    fresh = new Set(POOL_ACTIVITY_NEW.map((one) => {
      const text = atob(String(one).replace(/-/g, '+').replace(/_/g, '/'));
      let hex = '';
      for (let at = 0; at < text.length; at += 1) hex += text.charCodeAt(at).toString(16).padStart(2, '0');
      return `0:${hex}`;
    }));
  }
  return fresh.has(String(id));
}
export function swapAskLively(offerId, askId) {
  return swapRoutes(offerId, askId).some(routeLively);
}
export function swapRoutes(offerId, askId) {
  const ask = swapListedToken(askId)?.id ?? '';
  return ask ? swapRoutesFrom(offerId).filter((route) => route.pair.ask.id === ask) : [];
}

export async function readRoutePool({ transport, route, callOptions = {} }) {
  if (route.dex === STONFI) return readSwapPool({ transport, pair: route.pair, callOptions });
  if (!route.pair.stable) return readDedustPool({ transport, pair: route.pair, callOptions });
  const unitIn = 10n ** BigInt(route.pair.offer.decimals);
  const [pool, { out }] = await Promise.all([
    readDedustPool({ transport, pair: route.pair, callOptions }),
    estimateDedustSwap({ transport, pair: route.pair, amountIn: unitIn, callOptions }),
  ]);
  return { ...pool, unitIn, unitOut: out };
}
export function routeLocked(route, pool) {
  return route.dex === STONFI && pool?.locked === true;
}
export function quoteRoute({ route, pool, amountIn }) {
  if (route.dex === STONFI) {
    const quote = quoteSwap({ pair: route.pair, pool, amountIn });
    return { out: quote.out, impactBps: quote.impactBps };
  }
  if (route.pair.stable) return null;
  const quote = quoteDedustSwap({ pair: route.pair, pool, amountIn });
  return { out: quote.out, impactBps: quote.impactBps };
}
export async function estimateRoute({ transport, route, pool, amountIn, callOptions = {} }) {
  const local = quoteRoute({ route, pool, amountIn });
  if (local) return local;
  const { out } = await estimateDedustSwap({ transport, pair: route.pair, amountIn, callOptions });
  return { out, impactBps: stableImpactBps(pool, amountIn, out) };
}
function stableImpactBps(pool, amountIn, out) {
  const unitIn = BigInt(pool?.unitIn ?? 0n);
  const unitOut = BigInt(pool?.unitOut ?? 0n);
  if (unitIn <= 0n || unitOut <= 0n) return 0;
  const ideal = (BigInt(amountIn) * unitOut) / unitIn;
  if (ideal <= 0n || out >= ideal) return 0;
  return Number(((ideal - out) * 10_000n) / ideal);
}
export function routeAmountInFor({ route, pool, amountOut }) {
  if (route.dex === STONFI) return amountInFor({ pair: route.pair, pool, amountOut });
  if (!route.pair.stable) return dedustAmountInFor({ pair: route.pair, pool, amountOut });
  const want = BigInt(amountOut ?? 0n);
  const unitIn = BigInt(pool?.unitIn ?? 0n);
  const unitOut = BigInt(pool?.unitOut ?? 0n);
  if (want <= 0n || unitIn <= 0n || unitOut <= 0n) return null;
  return (want * unitIn + unitOut - 1n) / unitOut;
}
export function routeRate(route, pool) {
  if (route.pair.stable) return pool?.unitOut > 0n ? { unitIn: pool.unitIn, unitOut: pool.unitOut } : null;
  const reserveIn = BigInt(pool.reserves[route.pair.offerSide]);
  const reserveOut = BigInt(pool.reserves[1 - route.pair.offerSide]);
  if (reserveIn <= 0n || reserveOut <= 0n) return null;
  const unitIn = 10n ** BigInt(route.pair.offer.decimals);
  return { unitIn, unitOut: (unitIn * reserveOut) / reserveIn };
}
export function routePoolFeeBps(route, pool) {
  if (route.dex === STONFI) return Number(BigInt(pool.lpFee) + BigInt(pool.protocolFee));
  return Number((BigInt(pool.feeNumerator) * 10_000n) / BigInt(pool.feeDenominator));
}
export function buildRouteMessage({ route, amountIn, minOut, recipient, deadline, queryId = 0n, jettonWallet = '' }) {
  return route.dex === STONFI
    ? buildSwapMessage({ pair: route.pair, amountIn, minOut, recipient, deadline, queryId, jettonWallet })
    : buildDedustSwapMessage({ pair: route.pair, amountIn, minOut, recipient, deadline, queryId, jettonWallet });
}
export function routeAttachedNanotons(route) {
  return route.dex === STONFI ? swapAttachedNanotons(route.pair) : dedustSwapAttachedNanotons(route.pair);
}
