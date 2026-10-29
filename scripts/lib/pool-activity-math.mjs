export const ACTIVITY_WINDOW_S = 30 * 86_400;
export const ACTIVITY_SAMPLE = 50;
export const ACTIVITY_MONTH_SAMPLE = 1000;

export function tradesInMonth({ times: utimes, returned, oldest }, nowS, sample = ACTIVITY_SAMPLE) {
  const times = utimes.filter((at) => Number.isFinite(at) && at > 0);
  const inMonth = times.filter((at) => at > nowS - ACTIVITY_WINDOW_S).length;
  if (returned < sample || !(oldest > nowS - ACTIVITY_WINDOW_S)) return inMonth;
  return Math.round((times.length * ACTIVITY_WINDOW_S) / Math.max(nowS - oldest, 1));
}

export function gramPrices(pools) {
  const best = new Map();
  for (const pool of pools) {
    const side = pool.tokens.indexOf('gram');
    if (side < 0 || !pool.reserves) continue;
    const gram = pool.reserves[side];
    const other = pool.reserves[1 - side];
    const token = pool.tokens[1 - side];
    if (gram <= 0n || other <= 0n) continue;
    if (!best.has(token) || gram > best.get(token).gram) best.set(token, { gram, price: Number(gram) / Number(other) });
  }
  return new Map([...best].map(([token, { price }]) => [token, price]));
}

export function newSinceProduction({ ston, dedust, prodSton, prodDedust }) {
  const known = new Set([...prodSton, ...(prodDedust ?? dedust)]);
  return [...new Set([...ston, ...dedust])].filter((id) => !known.has(id));
}

export const NEW_TOKEN_MAX_AGE_S = 30 * 86_400;
export function newToPlathoAndChain(id, { shipped, firstAt, nowS, maxAgeS = NEW_TOKEN_MAX_AGE_S }) {
  if (Object.hasOwn(shipped ?? {}, id)) return false;
  return Number.isFinite(firstAt) && firstAt > 0 && firstAt <= nowS && nowS - firstAt <= maxAgeS;
}

export function poolDepthGram(pool, prices) {
  if (!pool.reserves) return null;
  const side = pool.tokens.indexOf('gram');
  if (side >= 0) return Math.floor(Number(pool.reserves[side]) / 1e9);
  const worth = pool.tokens.map((token, index) => (prices.has(token) ? (Number(pool.reserves[index]) * prices.get(token)) / 1e9 : null)).filter((one) => one !== null);
  return worth.length ? Math.floor(Math.max(...worth)) : null;
}
