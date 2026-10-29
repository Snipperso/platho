import { SWAP_POOLS, SWAP_ROUTERS, SWAP_TOKENS } from './swap-pools.mjs?v=5';
import { parseTonAddress } from './crypto/platho-crypto.mjs?v=31';
import { beginCell } from './pwa-contract-transactions.mjs?v=59';
import { buildJettonTransferBody, getMethodStack, stackAddress, stackInteger } from './wallet-transfers.mjs?v=15';

export const STONFI_SWAP_OPCODE = 0x6664DE2An;
export const PTON_TON_TRANSFER_OPCODE = 0x01F3835Dn;
export const SWAP_GRAM_FORWARD_NANOTONS = 300_000_000n;
export const SWAP_PTON_GAS_NANOTONS = 10_000_000n;
export const SWAP_JETTON_VALUE_NANOTONS = 300_000_000n;
export const SWAP_JETTON_FORWARD_NANOTONS = 240_000_000n;
export const SWAP_DEADLINE_SECONDS = 15 * 60;
export const SWAP_SLIPPAGE_CHOICES_BPS = Object.freeze([50, 100, 300]);
export const SWAP_DEFAULT_SLIPPAGE_BPS = 100;
export const SWAP_FEE_DIVIDER = 10_000n;
export const SWAP_REFERRAL_MAX_BPS = 100;
export const GRAM = 'gram';

function rawOf(base64url) {
  const text = atob(String(base64url).replace(/-/g, '+').replace(/_/g, '/'));
  if (text.length !== 32) throw new Error('swap pools: an account id is not 32 bytes');
  let hex = '';
  for (let at = 0; at < text.length; at += 1) hex += text.charCodeAt(at).toString(16).padStart(2, '0');
  return `0:${hex}`;
}
let catalogue = null;
function swapCatalogue() {
  if (catalogue) return catalogue;
  const routers = SWAP_ROUTERS.map(rawOf);
  const tokens = [{ id: GRAM, symbol: 'GRAM', decimals: 9 }, ...SWAP_TOKENS.map(([id, symbol, decimals]) => ({ id: rawOf(id), symbol, decimals }))];
  const pools = SWAP_POOLS.map(([pool, router, token0, token1, wallet0, wallet1], rank) => ({
    pool: rawOf(pool), router: routers[router], tokens: [tokens[token0], tokens[token1]], wallets: [rawOf(wallet0), rawOf(wallet1)], rank,
  }));
  catalogue = { tokens, byId: new Map(tokens.map((token) => [token.id, token])), pools };
  return catalogue;
}
export function swapToken(id) {
  return swapCatalogue().byId.get(normalId(id)) ?? null;
}
function normalId(id) {
  if (id === GRAM) return GRAM;
  try { return parseTonAddress(id).raw; } catch { return ''; }
}
function pairOf(pool, offerSide) {
  return {
    pool: pool.pool, router: pool.router, offerSide, offer: pool.tokens[offerSide], ask: pool.tokens[1 - offerSide],
    offerWallet: pool.wallets[offerSide], askWallet: pool.wallets[1 - offerSide], rank: pool.rank,
  };
}
export function swapPairsFrom(id) {
  const offer = normalId(id);
  if (!offer) return [];
  return swapCatalogue().pools.flatMap((pool) => {
    const side = pool.tokens.findIndex((token) => token.id === offer);
    return side < 0 ? [] : [pairOf(pool, side)];
  });
}
export function swapPair(offer, ask) {
  const wanted = normalId(ask);
  return swapPairsFrom(offer).find((pair) => pair.ask.id === wanted) ?? null;
}

export async function readSwapPool({ transport, pair, callOptions = {} }) {
  if (!transport?.runGetMethod) throw new Error('swap pool: no transport');
  const result = await transport.runGetMethod({ address: pair.pool, method: 'get_pool_data', stack: [], cacheTtlMs: 0, ...callOptions });
  const stack = getMethodStack(result);
  if (stack.length < 9) throw new Error('get_pool_data did not return its values');
  const named = [stackAddress(stack[1], 'the router'), stackAddress(stack[5], 'token0 wallet'), stackAddress(stack[6], 'token1 wallet')];
  const wallets = pair.offerSide === 0 ? [pair.offerWallet, pair.askWallet] : [pair.askWallet, pair.offerWallet];
  if (named[0] !== pair.router || named[1] !== wallets[0] || named[2] !== wallets[1]) {
    throw Object.assign(new Error('the pool named another router or other wallets'), { code: 'SWAP_POOL_DISAGREES' });
  }
  return {
    locked: stackInteger(stack[0], 'is_locked') !== 0n,
    reserves: [stackInteger(stack[3], 'reserve0'), stackInteger(stack[4], 'reserve1')],
    lpFee: stackInteger(stack[7], 'lp_fee'),
    protocolFee: stackInteger(stack[8], 'protocol_fee'),
  };
}

function referralBpsOf(referral) {
  const bps = Number(referral?.bps ?? 0);
  if (!referral?.address || bps === 0) return 0n;
  if (!Number.isInteger(bps) || bps < 0 || bps > SWAP_REFERRAL_MAX_BPS) throw new Error(`swap: a referral share of ${bps} bps is outside 0..${SWAP_REFERRAL_MAX_BPS}`);
  return BigInt(bps);
}
export function quoteSwap({ pair, pool, amountIn, referral = null }) {
  const amount = BigInt(amountIn ?? 0n);
  const reserveIn = BigInt(pool.reserves[pair.offerSide]);
  const reserveOut = BigInt(pool.reserves[1 - pair.offerSide]);
  const none = { out: 0n, referralFee: 0n, impactBps: 0, reserveIn, reserveOut };
  if (amount <= 0n || reserveIn <= 0n || reserveOut <= 0n || pool.locked) return none;
  const lp = BigInt(pool.lpFee);
  const protocol = BigInt(pool.protocolFee);
  if (lp < 0n || protocol < 0n || lp + protocol >= SWAP_FEE_DIVIDER) return none;
  const inWithFee = amount * (SWAP_FEE_DIVIDER - lp);
  const base = (inWithFee * reserveOut) / (reserveIn * SWAP_FEE_DIVIDER + inWithFee);
  const share = (bps) => (bps > 0n ? (base * bps + SWAP_FEE_DIVIDER - 1n) / SWAP_FEE_DIVIDER : 0n);
  const protocolShare = share(protocol);
  const referralFee = share(referralBpsOf(referral));
  const out = base > protocolShare + referralFee ? base - protocolShare - referralFee : 0n;
  return { out, referralFee: out > 0n ? referralFee : 0n, impactBps: Number((amount * 10_000n) / (reserveIn + amount)), reserveIn, reserveOut };
}
export function amountInFor({ pair, pool, amountOut, referral = null }) {
  const want = BigInt(amountOut ?? 0n);
  const reserveOut = BigInt(pool.reserves[1 - pair.offerSide]);
  if (want <= 0n || want >= reserveOut || pool.locked) return null;
  const reaches = (amount) => quoteSwap({ pair, pool, amountIn: amount, referral }).out >= want;
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
export function minimumOut(out, slippageBps = SWAP_DEFAULT_SLIPPAGE_BPS) {
  const bps = SWAP_SLIPPAGE_CHOICES_BPS.includes(Number(slippageBps)) ? BigInt(slippageBps) : BigInt(SWAP_DEFAULT_SLIPPAGE_BPS);
  const kept = (BigInt(out) * (10_000n - bps)) / 10_000n;
  return kept > 0n ? kept : 1n;
}

function basechain(address, name) {
  const parsed = parseTonAddress(address);
  if (parsed.workchain !== 0) throw Object.assign(new Error(`${name} must be a basechain address`), { code: 'NOT_BASECHAIN' });
  return parsed.raw;
}
export function buildSwapPayload({ askWallet, recipient, minOut, deadline, referral = null }) {
  const self = basechain(recipient, 'the recipient');
  const least = BigInt(minOut);
  if (least <= 0n) throw new Error('swap: the least accepted must be above zero');
  const bps = referralBpsOf(referral);
  const additional = beginCell()
    .coins(least, 'min_out')
    .address(self, 'receiver')
    .coins(0n, 'fwd_gas')
    .uint(0n, 1, 'custom_payload.none')
    .coins(0n, 'refund_fwd_gas')
    .uint(0n, 1, 'refund_payload.none')
    .uint(bps, 16, 'ref_fee');
  if (bps > 0n) additional.address(basechain(referral.address, 'the referrer'), 'ref_address');
  else additional.uint(0n, 2, 'ref_address.none');
  const additionalCell = additional.endCell();
  return beginCell()
    .uint(STONFI_SWAP_OPCODE, 32, 'op')
    .address(basechain(askWallet, 'the ask wallet'), 'other_token_wallet')
    .address(self, 'refund_address')
    .address(self, 'excesses_address')
    .uint(BigInt(deadline), 64, 'deadline')
    .ref(additionalCell, 'additional_data')
    .endCell();
}
export function swapDeadline(nowMs = Date.now()) {
  return BigInt(Math.floor(Number(nowMs) / 1000) + SWAP_DEADLINE_SECONDS);
}
export function buildSwapMessage({ pair, amountIn, minOut, recipient, deadline, queryId = 0n, jettonWallet = '', referral = null }) {
  const amount = BigInt(amountIn);
  if (amount <= 0n) throw new Error('swap: the amount must be above zero');
  const self = basechain(recipient, 'the recipient');
  const payload = buildSwapPayload({ askWallet: pair.askWallet, recipient: self, minOut, deadline, referral });
  if (pair.offer.id === GRAM) {
    const body = beginCell()
      .uint(PTON_TON_TRANSFER_OPCODE, 32, 'op')
      .uint(BigInt(queryId), 64, 'query_id')
      .coins(amount, 'ton_amount')
      .address(self, 'refund_address')
      .uint(1n, 1, 'forward_payload.ref')
      .ref(payload, 'forward_payload')
      .endCell();
    return { address: pair.offerWallet, value: amount + SWAP_GRAM_FORWARD_NANOTONS + SWAP_PTON_GAS_NANOTONS, body };
  }
  if (!jettonWallet) throw new Error('swap: the jetton wallet is required');
  const body = buildJettonTransferBody({
    queryId, amount, destination: pair.router, responseDestination: self, forwardTonAmount: SWAP_JETTON_FORWARD_NANOTONS, forwardPayload: payload,
  });
  return { address: basechain(jettonWallet, 'the jetton wallet'), value: SWAP_JETTON_VALUE_NANOTONS, body };
}
export function swapAttachedNanotons(pair) {
  return pair?.offer?.id === GRAM ? SWAP_GRAM_FORWARD_NANOTONS + SWAP_PTON_GAS_NANOTONS : SWAP_JETTON_VALUE_NANOTONS;
}
