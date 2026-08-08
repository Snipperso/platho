// market-stability-read — what the ATH reserve sells for right now, and how much is left at that price.
//
// The reserve is 60,000,000 ATH (60% of supply) sold in 20 tranches of 3,000,000 at RISING prices: multiplier x2 on the
// first tranche through x21 on the last, against a base of 3000 GRAM per tranche at x1. So the opening price is
// 0.002 GRAM per ATH and it only ever goes up — the contract is a stabiliser that stands ABOVE the pool, not a presale
// under it. The pool itself will open at 0.001 (15,000,000 ATH against 15,000 GRAM), and saying so plainly is the
// owner's call: what you buy here is time, not a discount, and the four-letter usernames will be gone before the pool
// opens.
//
// THE PRICE IS A COMPILE-TIME CONSTANT, not genesis state, so mirroring it here cannot drift with a ceremony — only
// with a contract edit, and the contract is sealed. tests/market-stability-price.test.ts pins every constant below
// against contracts/MarketStabilitySeller.tact so a mirror that falls behind a rebuild is loud rather than a refused
// buy in production. [the same discipline as publish-price.mjs, and for the same reason it exists]
import { stackNumOr0 } from './ton-stack-num.mjs?v=1';

/** MARKET_STABILITY_BASE_TRANCHE_PRICE — nanotons for a WHOLE tranche at multiplier x1. */
export const MARKET_STABILITY_BASE_TRANCHE_PRICE = 3_000_000_000_000n;
/** MARKET_STABILITY_TRANCHE_ATH — atomic ATH in one tranche (3,000,000 ATH at 9 decimals). */
export const MARKET_STABILITY_TRANCHE_ATH = 3_000_000_000_000_000n;
/** MARKET_STABILITY_ATH_TRANSFER_REQUEST_VALUE — what the seller forwards to its ATH wallet to deliver the buy. */
export const MARKET_STABILITY_ATH_TRANSFER_REQUEST_VALUE = 58_000_000n;
/** MARKET_STABILITY_BUY_EXEC_RESERVE — the seller's own execution reserve for the buy. */
export const MARKET_STABILITY_BUY_EXEC_RESERVE = 2_000_000n;
/** Everything above the price itself that gate 23218 requires the buyer to bring. Surplus is refunded. */
export const MARKET_STABILITY_BUY_OVERHEAD =
  MARKET_STABILITY_ATH_TRANSFER_REQUEST_VALUE + MARKET_STABILITY_BUY_EXEC_RESERVE;
/** ATH decimals, so a whole-ATH figure can be turned into the atomic amount the message carries. */
export const ATH_ATOMIC_PER_UNIT = 1_000_000_000n;

export const MARKET_STABILITY_PHASE_IDLE = 0;

function ceilDiv(numerator, denominator) {
  if (denominator <= 0n) throw new Error('ceilDiv: denominator must be positive');
  if (numerator === 0n) return 0n;
  return ((numerator - 1n) / denominator) + 1n;
}

/**
 * What the contract will charge for `amountAtomic` ATH at `multiplier`, to the nanoton.
 *
 * MIRRORS quoteTonForAmount EXACTLY, ceiling included. Rounding DOWN here would quote a price the contract refuses at
 * gate 23218 (value >= price + overhead) — the buy bounces and the user is told nothing useful, for one nanoton.
 */
export function quoteNanotonsForAth(amountAtomic, multiplier) {
  const amount = BigInt(amountAtomic);
  const mult = BigInt(multiplier);
  if (amount <= 0n) return 0n;
  if (mult <= 0n) throw new Error('quoteNanotonsForAth: multiplier must be positive');
  return ceilDiv(MARKET_STABILITY_BASE_TRANCHE_PRICE * mult * amount, MARKET_STABILITY_TRANCHE_ATH);
}

/**
 * The inverse: the most ATH a given nanoton budget can buy at `multiplier`.
 *
 * FLOOR, and deliberately not the algebraic inverse of the ceiling above. The pair only has to satisfy one property —
 * `quoteNanotonsForAth(athForNanotons(b)) <= b` — so that the amount a user reaches by typing a GRAM figure is one they
 * can actually afford. Inverting the ceiling exactly would sometimes hand back an amount costing one nanoton more than
 * they have. Asserted in both directions by tests/market-stability-price.test.ts across the whole ladder.
 */
export function athForNanotons(nanotons, multiplier) {
  const budget = BigInt(nanotons);
  const mult = BigInt(multiplier);
  if (budget <= 0n) return 0n;
  if (mult <= 0n) throw new Error('athForNanotons: multiplier must be positive');
  return (budget * MARKET_STABILITY_TRANCHE_ATH) / (MARKET_STABILITY_BASE_TRANCHE_PRICE * mult);
}

/** Total the wallet must attach for this amount: the price plus the delivery overhead gate 23218 checks. */
export function buyValueNanotons(amountAtomic, multiplier) {
  return quoteNanotonsForAth(amountAtomic, multiplier) + MARKET_STABILITY_BUY_OVERHEAD;
}

/**
 * Decode a MarketStabilitySellerStateView getter stack: 14 fields in declaration order, indices 6..8 addresses.
 *
 * Positional by necessity — a raw stack carries no names — and the arity check is what makes that survivable. The
 * addresses are skipped: nothing on this screen needs them, and decoding a slice would drag the BOC parser in for
 * nothing (the same call the airdrop reader makes, for the same reason).
 */
export function decodeMarketStabilityStateStack(stack) {
  if (!Array.isArray(stack) || stack.length < 14) {
    throw new Error(`get_market_stability_seller_state returned ${stack?.length ?? 0} stack items, expected 14`);
  }
  const num = (i, name) => stackNumOr0(stack[i]?.value, `market stability state: ${name}`);
  return {
    phase: Number(num(0, 'phase')),
    reserveDueAth: num(1, 'reserve_due_ath'),
    completedTrancheCount: Number(num(9, 'completed_tranche_count')),
    currentTrancheSoldAth: num(10, 'current_tranche_sold_ath'),
    currentMultiplier: Number(num(11, 'current_multiplier')),
    currentTrancheRemainingAth: num(12, 'current_tranche_remaining_ath'),
    lastTerminalQueryId: num(13, 'last_terminal_query_id'),
  };
}

/**
 * The most ATH a buy may ask for right now: bounded by BOTH the tranche remainder (gate 23215) and the undelivered
 * reserve (23216). Asking for more is refused outright, so the UI must clamp rather than let the user compose a
 * doomed transaction.
 */
export function maxBuyableAtomic(state) {
  const tranche = BigInt(state?.currentTrancheRemainingAth ?? 0n);
  const reserve = BigInt(state?.reserveDueAth ?? 0n);
  return tranche < reserve ? tranche : reserve;
}

/** True when the seller can take a buy at all: sealed-and-idle, with something left to sell. */
export function marketStabilityCanSell(state) {
  return Boolean(state?.exists) && state.phase === MARKET_STABILITY_PHASE_IDLE && maxBuyableAtomic(state) > 0n;
}

/**
 * Read the seller. Returns `{ exists: false }` when the account cannot be read, so a transient RPC failure or a client
 * pointed at a pre-genesis config degrades to "unknown" rather than to a confident "sold out".
 */
export function createMarketStabilityReader(runGetMethod) {
  if (typeof runGetMethod !== 'function') throw new Error('createMarketStabilityReader requires runGetMethod');
  return async (sellerAddress) => {
    if (!sellerAddress) return { exists: false };
    const raw = await runGetMethod({ address: sellerAddress, method: 'get_market_stability_seller_state', stack: [] });
    if (!raw || raw.exit_code !== 0) return { exists: false };
    return { exists: true, ...decodeMarketStabilityStateStack(raw.stack) };
  };
}
