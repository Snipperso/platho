import { DEDUST_POOLS, DEDUST_TOKENS, DEDUST_GRAM_VAULT } from './dedust-pools.mjs?v=6';
import { parseTonAddress } from './crypto/platho-crypto.mjs?v=31';
import { beginCell, bytesToBase64, parseBocBase64, serializeBoc } from './pwa-contract-transactions.mjs?v=59';
import { buildJettonTransferBody, getMethodStack, stackInteger } from './wallet-transfers.mjs?v=15';
import { GRAM } from './wallet-swap.mjs?v=20';

export const DEDUST_NATIVE_SWAP_OPCODE = 0xEA06185Dn;
export const DEDUST_JETTON_SWAP_OPCODE = 0xE3A0D482n;
export const DEDUST_GRAM_GAS_NANOTONS = 250_000_000n;
export const DEDUST_JETTON_VALUE_NANOTONS = 300_000_000n;
export const DEDUST_JETTON_FORWARD_NANOTONS = 250_000_000n;
export const DEDUST = 'dedust';

function rawOf(base64url) {
  const text = atob(String(base64url).replace(/-/g, '+').replace(/_/g, '/'));
  if (text.length !== 32) throw new Error('DeDust pools: an account id is not 32 bytes');
  let hex = '';
  for (let at = 0; at < text.length; at += 1) hex += text.charCodeAt(at).toString(16).padStart(2, '0');
  return `0:${hex}`;
}
let catalogue = null;
function dedustCatalogue() {
  if (catalogue) return catalogue;
  const tokens = [
    { id: GRAM, symbol: 'GRAM', decimals: 9, vault: rawOf(DEDUST_GRAM_VAULT) },
    ...DEDUST_TOKENS.map(([id, symbol, decimals, vault]) => ({ id: rawOf(id), symbol, decimals, vault: rawOf(vault) })),
  ];
  const pools = DEDUST_POOLS.map(([pool, stable, token0, token1], rank) => ({ pool: rawOf(pool), stable: stable === 1, tokens: [tokens[token0], tokens[token1]], rank }));
  catalogue = { tokens, byId: new Map(tokens.map((token) => [token.id, token])), pools };
  return catalogue;
}
function normalId(id) {
  if (id === GRAM) return GRAM;
  try { return parseTonAddress(id).raw; } catch { return ''; }
}
export function dedustToken(id) {
  return dedustCatalogue().byId.get(normalId(id)) ?? null;
}
function pairOf(pool, offerSide) {
  return {
    dex: DEDUST, pool: pool.pool, stable: pool.stable, offerSide, offer: pool.tokens[offerSide], ask: pool.tokens[1 - offerSide],
    offerVault: pool.tokens[offerSide].vault, rank: pool.rank,
  };
}
export function dedustPairsFrom(id) {
  const offer = normalId(id);
  if (!offer) return [];
  return dedustCatalogue().pools.flatMap((pool) => {
    const side = pool.tokens.findIndex((token) => token.id === offer);
    return side < 0 ? [] : [pairOf(pool, side)];
  });
}
export function dedustPairs(offer, ask) {
  const wanted = normalId(ask);
  return dedustPairsFrom(offer).filter((pair) => pair.ask.id === wanted);
}

export function dedustAssetCell(id) {
  if (id === GRAM) return beginCell().uint(0n, 4, 'asset.native').endCell();
  const parsed = parseTonAddress(id);
  if (parsed.workchain !== 0) throw Object.assign(new Error('a DeDust jetton must be on the basechain'), { code: 'NOT_BASECHAIN' });
  return beginCell().uint(1n, 4, 'asset.jetton').uint(0n, 8, 'asset.workchain').bytesValue(parsed.hash, 32, 'asset.address').endCell();
}
export function dedustAssetFromStack(item) {
  const value = Array.isArray(item) ? item[1] : item?.value ?? item?.cell ?? item?.boc;
  if (typeof value !== 'string') return '';
  let cell;
  try { cell = parseBocBase64(value); } catch { return ''; }
  const bit = (at) => (cell.data[at >> 3] >> (7 - (at & 7))) & 1;
  const bits = (from, count) => { let out = 0n; for (let at = from; at < from + count; at += 1) out = (out << 1n) | BigInt(bit(at)); return out; };
  if (cell.bitLength < 4) return '';
  const type = bits(0, 4);
  if (type === 0n) return GRAM;
  if (type !== 1n || cell.bitLength < 4 + 8 + 256) return '';
  if (bits(4, 8) !== 0n) return '';
  return `0:${bits(12, 256).toString(16).padStart(64, '0')}`;
}

export async function readDedustPool({ transport, pair, callOptions = {} }) {
  if (!transport?.runGetMethod) throw new Error('DeDust pool: no transport');
  const read = (method) => transport.runGetMethod({ address: pair.pool, method, stack: [], cacheTtlMs: 0, ...callOptions });
  const [reserves, fee] = (await Promise.all([read('get_reserves'), read('get_trade_fee')])).map((result) => getMethodStack(result));
  if (reserves.length < 2 || fee.length < 2) throw new Error('the DeDust pool did not return its values');
  const pool = {
    reserves: [stackInteger(reserves[0], 'reserve0'), stackInteger(reserves[1], 'reserve1')],
    feeNumerator: stackInteger(fee[0], 'trade_fee_numerator'),
    feeDenominator: stackInteger(fee[1], 'trade_fee_denominator'),
  };
  if (pool.feeDenominator <= 0n || pool.feeNumerator < 0n || pool.feeNumerator >= pool.feeDenominator) {
    throw Object.assign(new Error('the DeDust pool named no trade fee below one'), { code: 'SWAP_POOL_DISAGREES' });
  }
  return pool;
}

export function quoteDedustSwap({ pair, pool, amountIn }) {
  if (pair.stable) throw new Error('a stable DeDust pool is asked, not worked out (estimateDedustSwap)');
  const amount = BigInt(amountIn ?? 0n);
  const reserveIn = BigInt(pool.reserves[pair.offerSide]);
  const reserveOut = BigInt(pool.reserves[1 - pair.offerSide]);
  const none = { out: 0n, fee: 0n, impactBps: 0, reserveIn, reserveOut };
  if (amount <= 0n || reserveIn <= 0n || reserveOut <= 0n) return none;
  const fee = (amount * BigInt(pool.feeNumerator)) / BigInt(pool.feeDenominator);
  const net = amount - fee;
  const out = (net * reserveOut) / (reserveIn + net);
  return { out, fee, impactBps: Number((amount * 10_000n) / (reserveIn + amount)), reserveIn, reserveOut };
}
export async function estimateDedustSwap({ transport, pair, amountIn, callOptions = {} }) {
  if (!transport?.runGetMethod) throw new Error('DeDust pool: no transport');
  const amount = BigInt(amountIn ?? 0n);
  if (amount <= 0n) return { out: 0n, fee: 0n };
  const stack = getMethodStack(await transport.runGetMethod({
    address: pair.pool, method: 'estimate_swap_out', cacheTtlMs: 0, ...callOptions,
    stack: [{ type: 'slice', value: bytesToBase64(serializeBoc(dedustAssetCell(pair.offer.id))) }, { type: 'num', value: `0x${amount.toString(16)}` }],
  }));
  if (stack.length < 3) throw new Error('estimate_swap_out did not return its values');
  if (dedustAssetFromStack(stack[0]) !== pair.ask.id) throw Object.assign(new Error('the DeDust pool named another asset'), { code: 'SWAP_POOL_DISAGREES' });
  return { out: stackInteger(stack[1], 'amount_out'), fee: stackInteger(stack[2], 'trade_fee') };
}
export function dedustAmountInFor({ pair, pool, amountOut }) {
  const want = BigInt(amountOut ?? 0n);
  const reserveOut = BigInt(pool.reserves[1 - pair.offerSide]);
  if (pair.stable || want <= 0n || want >= reserveOut) return null;
  const reaches = (amount) => quoteDedustSwap({ pair, pool, amountIn: amount }).out >= want;
  let high = 1n;
  while (!reaches(high)) {
    high *= 2n;
    if (high > (1n << 120n)) return null;
  }
  let low = high / 2n;
  while (high - low > 1n) {
    const middle = (low + high) / 2n;
    if (reaches(middle)) high = middle; else low = middle;
  }
  return high;
}

function basechain(address, name) {
  const parsed = parseTonAddress(address);
  if (parsed.workchain !== 0) throw Object.assign(new Error(`${name} must be a basechain address`), { code: 'NOT_BASECHAIN' });
  return parsed.raw;
}
function swapParamsCell({ deadline, recipient }) {
  return beginCell()
    .uint(BigInt(deadline), 32, 'deadline')
    .address(basechain(recipient, 'the recipient'), 'recipient_addr')
    .uint(0n, 2, 'referral_addr.none')
    .uint(0n, 1, 'fulfill_payload.none')
    .uint(0n, 1, 'reject_payload.none')
    .endCell();
}
function appendStep(builder, { pool, minOut }) {
  const least = BigInt(minOut);
  if (least <= 0n) throw new Error('swap: the least accepted must be above zero');
  return builder
    .address(basechain(pool, 'the pool'), 'pool_addr')
    .uint(0n, 1, 'kind.given_in')
    .coins(least, 'limit')
    .uint(0n, 1, 'next.none');
}
export function buildDedustJettonSwapPayload({ pool, minOut, recipient, deadline }) {
  return appendStep(beginCell().uint(DEDUST_JETTON_SWAP_OPCODE, 32, 'op'), { pool, minOut })
    .ref(swapParamsCell({ deadline, recipient }), 'swap_params')
    .endCell();
}
export function buildDedustSwapMessage({ pair, amountIn, minOut, recipient, deadline, queryId = 0n, jettonWallet = '' }) {
  const amount = BigInt(amountIn);
  if (amount <= 0n) throw new Error('swap: the amount must be above zero');
  const self = basechain(recipient, 'the recipient');
  if (pair.offer.id === GRAM) {
    const body = appendStep(beginCell()
      .uint(DEDUST_NATIVE_SWAP_OPCODE, 32, 'op')
      .uint(BigInt(queryId), 64, 'query_id')
      .coins(amount, 'amount'), { pool: pair.pool, minOut })
      .ref(swapParamsCell({ deadline, recipient: self }), 'swap_params')
      .endCell();
    return { address: basechain(pair.offerVault, 'the GRAM vault'), value: amount + DEDUST_GRAM_GAS_NANOTONS, body };
  }
  if (!jettonWallet) throw new Error('swap: the jetton wallet is required');
  const body = buildJettonTransferBody({
    queryId, amount, destination: pair.offerVault, responseDestination: self, forwardTonAmount: DEDUST_JETTON_FORWARD_NANOTONS,
    forwardPayload: buildDedustJettonSwapPayload({ pool: pair.pool, minOut, recipient: self, deadline }),
  });
  return { address: basechain(jettonWallet, 'the jetton wallet'), value: DEDUST_JETTON_VALUE_NANOTONS, body };
}
export function dedustSwapAttachedNanotons(pair) {
  return pair?.offer?.id === GRAM ? DEDUST_GRAM_GAS_NANOTONS : DEDUST_JETTON_VALUE_NANOTONS;
}
