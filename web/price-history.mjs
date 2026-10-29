export const PRICE_TRADES = 100;
export const PRICE_SCAN = 200;
export const PRICE_PAGES = 3;
export const PRICE_REFRESH_SCAN = 50;
export const PRICE_USDT = '0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe';

export function priceTradesUrl(origin, pool, limit = PRICE_SCAN, offset = 0) {
  return `${origin}/api/v3/actions?account=${encodeURIComponent(pool)}&action_type=jetton_swap&limit=${limit}&offset=${offset}&sort=desc`;
}

const assetOf = (asset) => (asset === null || asset === undefined ? 'gram' : String(asset).toLowerCase());
const unitsOf = (value) => { try { return BigInt(String(value ?? '')); } catch { return 0n; } };
const traderOf = (value) => (/^-?\d+:[0-9a-f]{64}$/i.test(String(value ?? '')) ? String(value).toLowerCase() : null);

export function pricePoints(body, { base, quote, baseDecimals, quoteDecimals }) {
  const points = [];
  for (const action of Array.isArray(body?.actions) ? body.actions : []) {
    if (action?.type !== 'jetton_swap' || action.success === false) continue;
    const details = action.details ?? {};
    const assetIn = assetOf(details.asset_in);
    const assetOut = assetOf(details.asset_out);
    const amountIn = unitsOf(details.dex_incoming_transfer?.amount);
    const amountOut = unitsOf(details.dex_outgoing_transfer?.amount);
    if (amountIn <= 0n || amountOut <= 0n) continue;
    let baseUnits;
    let quoteUnits;
    let side;
    if (assetIn === base && assetOut === quote) { baseUnits = amountIn; quoteUnits = amountOut; side = 'sell'; }
    else if (assetIn === quote && assetOut === base) { baseUnits = amountOut; quoteUnits = amountIn; side = 'buy'; }
    else continue;
    const amount = Number(baseUnits) / 10 ** baseDecimals;
    const volume = Number(quoteUnits) / 10 ** quoteDecimals;
    const price = volume / amount;
    const at = Number(action.end_utime ?? action.start_utime ?? 0) * 1000;
    if (Number.isFinite(price) && price > 0 && at > 0) {
      points.push({ id: String(action.action_id ?? action.trace_id ?? ''), at, price, side, amount, volume, trader: traderOf(details.sender) });
    }
  }
  return points.sort((a, b) => a.at - b.at);
}

export function joinPricePoints(...lists) {
  const byTrade = new Map();
  for (const list of lists) for (const point of list) byTrade.set(point.id || `${point.at}|${point.price}|${point.amount}`, point);
  return [...byTrade.values()].sort((a, b) => a.at - b.at).slice(-PRICE_TRADES);
}
export async function readPriceHistory({ fetchImpl, origin, pool, known = null, wanted = null, ...pair }) {
  const page = async (limit, offset) => {
    const response = await fetchImpl(priceTradesUrl(origin, pool, limit, offset));
    if (!response?.ok) throw Object.assign(new Error(`price history: HTTP ${response?.status}`), { status: response?.status });
    const body = await response.json();
    const actions = Array.isArray(body?.actions) ? body.actions : [];
    const oldest = Math.min(...actions.map((action) => Number(action.end_utime ?? action.start_utime ?? 0) * 1000).filter((at) => at > 0), Number.POSITIVE_INFINITY);
    return { points: pricePoints(body, pair), count: actions.length, oldest };
  };
  if (known?.length) {
    const fresh = await page(PRICE_REFRESH_SCAN, 0);
    if (fresh.count < PRICE_REFRESH_SCAN || fresh.oldest <= known.at(-1).at) return joinPricePoints(known, fresh.points);
  }
  let points = [];
  for (let at = 0; at < PRICE_PAGES; at += 1) {
    if (at > 0 && wanted && !wanted()) throw Object.assign(new Error('price history: no longer wanted'), { code: 'NOT_WANTED' });
    const read = await page(PRICE_SCAN, at * PRICE_SCAN);
    points = joinPricePoints(points, read.points);
    if (points.length >= PRICE_TRADES || read.count < PRICE_SCAN) break;
  }
  return points;
}

export function priceMids(points, ease = 0.35) {
  const at = points.findIndex((point, i) => i > 0 && (point.side === 'buy') !== (points[i - 1].side === 'buy'));
  let half = 1;
  if (at > 0) {
    const [before, after] = [points[at - 1], points[at]];
    const [bought, sold] = before.side === 'buy' ? [before.price, after.price] : [after.price, before.price];
    if (bought > 0 && sold > 0) half = Math.max(0.99, Math.min(1, Math.sqrt(sold / bought)));
  }
  let buy = 0;
  let sell = 0;
  let eased = 0;
  return points.map((point) => {
    if (point.side === 'buy') buy = point.price; else sell = point.price;
    const mid = buy && sell ? Math.sqrt(buy * sell) : (point.side === 'buy' ? point.price * half : point.price / half);
    eased = eased ? eased + ease * (mid - eased) : mid;
    return eased;
  });
}

export function priceSummary(points) {
  const prices = points.map((point) => point.price);
  const mids = priceMids(points);
  const bought = points.reduce((sum, point) => sum + (point.side === 'buy' ? point.volume : 0), 0);
  const traded = points.reduce((sum, point) => sum + point.volume, 0);
  const first = mids[0] ?? 0;
  const last = mids.at(-1) ?? 0;
  return {
    first, last, change: first > 0 ? last / first - 1 : 0, high: Math.max(...prices), low: Math.min(...prices),
    buyShare: traded > 0 ? bought / traded : 0.5, span: points.length > 1 ? points.at(-1).at - points[0].at : 0,
  };
}

const fixed = (value) => Number(value.toFixed(2));
function monotonePath(xy) {
  const n = xy.length;
  const slope = [];
  for (let i = 0; i < n - 1; i += 1) slope.push((xy[i + 1][1] - xy[i][1]) / ((xy[i + 1][0] - xy[i][0]) || 1));
  const tangent = [slope[0]];
  for (let i = 1; i < n - 1; i += 1) tangent.push(slope[i - 1] * slope[i] <= 0 ? 0 : (2 * slope[i - 1] * slope[i]) / (slope[i - 1] + slope[i]));
  tangent.push(slope[n - 2]);
  let path = `M${fixed(xy[0][0])},${fixed(xy[0][1])}`;
  for (let i = 0; i < n - 1; i += 1) {
    const third = (xy[i + 1][0] - xy[i][0]) / 3;
    path += `C${fixed(xy[i][0] + third)},${fixed(xy[i][1] + tangent[i] * third)} ${fixed(xy[i + 1][0] - third)},${fixed(xy[i + 1][1] - tangent[i + 1] * third)} ${fixed(xy[i + 1][0])},${fixed(xy[i + 1][1])}`;
  }
  return path;
}

export function priceChart(points, { width, height, pad = 10, minRadius = 1.6, maxRadius = 6 }) {
  if (points.length < 2) return null;
  const { high, low } = priceSummary(points);
  const range = high - low || high || 1;
  const largest = Math.max(...points.map((point) => point.volume)) || 1;
  const step = (width - 2 * pad) / (points.length - 1);
  const yOf = (price) => fixed(height - pad - ((price - low) / range) * (height - 2 * pad));
  const dots = points.map((point, index) => ({
    x: fixed(pad + index * step), y: yOf(point.price), r: fixed(minRadius + (maxRadius - minRadius) * Math.sqrt(point.volume / largest)), side: point.side,
  }));
  const mids = priceMids(points).map((price, index) => ({ x: dots[index].x, y: yOf(price) }));
  return { ...priceLinePaths(mids.map((mid) => [mid.x, mid.y]), height), dots, mids, step };
}

export function priceLinePaths(xy, height) {
  const line = monotonePath(xy);
  return { line, area: `${line}L${fixed(xy.at(-1)[0])},${height}L${fixed(xy[0][0])},${height}Z` };
}

const SUBSCRIPT_DIGITS = '\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089';
export function formatPrice(price) {
  if (!(price > 0)) return '0';
  if (price >= 1000) return Math.round(price).toLocaleString('en').replace(/,/g, ' ');
  if (price >= 100) return String(Number(price.toFixed(2)));
  if (price >= 1) return String(Number(price.toFixed(4)));
  if (price >= 1e-4) return String(Number(price.toPrecision(4)));
  let exponent = Math.floor(Math.log10(price));
  let digits = Math.round((price / 10 ** exponent) * 1000);
  if (digits >= 10_000) { digits = 1000; exponent += 1; }
  const zeros = -exponent - 1;
  const counted = [...String(zeros)].map((digit) => SUBSCRIPT_DIGITS[Number(digit)]).join('');
  return `0.0${counted}${String(digits).replace(/0+$/, '')}`;
}
