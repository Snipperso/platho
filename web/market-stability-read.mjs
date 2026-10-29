import { stackNumOr0 } from './ton-stack-num.mjs?v=2';

export const MARKET_STABILITY_BASE_TRANCHE_PRICE = 3_000_000_000_000n;
export const MARKET_STABILITY_TRANCHE_ATH = 3_000_000_000_000_000n;
export const MARKET_STABILITY_ATH_TRANSFER_REQUEST_VALUE = 58_000_000n;
export const MARKET_STABILITY_BUY_EXEC_RESERVE = 2_000_000n;
export const MARKET_STABILITY_BUY_OVERHEAD =
  MARKET_STABILITY_ATH_TRANSFER_REQUEST_VALUE + MARKET_STABILITY_BUY_EXEC_RESERVE;
export const ATH_ATOMIC_PER_UNIT = 1_000_000_000n;

export const MARKET_STABILITY_PHASE_IDLE = 0;

function ceilDiv(numerator, denominator) {
  if (denominator <= 0n) throw new Error('ceilDiv: denominator must be positive');
  if (numerator === 0n) return 0n;
  return ((numerator - 1n) / denominator) + 1n;
}

export function quoteNanotonsForAth(amountAtomic, multiplier) {
  const amount = BigInt(amountAtomic);
  const mult = BigInt(multiplier);
  if (amount <= 0n) return 0n;
  if (mult <= 0n) throw new Error('quoteNanotonsForAth: multiplier must be positive');
  return ceilDiv(MARKET_STABILITY_BASE_TRANCHE_PRICE * mult * amount, MARKET_STABILITY_TRANCHE_ATH);
}

export function athForNanotons(nanotons, multiplier) {
  const budget = BigInt(nanotons);
  const mult = BigInt(multiplier);
  if (budget <= 0n) return 0n;
  if (mult <= 0n) throw new Error('athForNanotons: multiplier must be positive');
  return (budget * MARKET_STABILITY_TRANCHE_ATH) / (MARKET_STABILITY_BASE_TRANCHE_PRICE * mult);
}

export function buyValueNanotons(amountAtomic, multiplier) {
  return quoteNanotonsForAth(amountAtomic, multiplier) + MARKET_STABILITY_BUY_OVERHEAD;
}

export const MSS_STATE_VIEW_ARITY = 14;

export function decodeMarketStabilityStateStack(stack) {
  if (!Array.isArray(stack) || stack.length !== MSS_STATE_VIEW_ARITY) {
    throw new Error(`get_market_stability_seller_state returned ${stack?.length ?? 0} stack items, expected ${MSS_STATE_VIEW_ARITY}`);
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

export function maxBuyableAtomic(state) {
  const tranche = BigInt(state?.currentTrancheRemainingAth ?? 0n);
  const reserve = BigInt(state?.reserveDueAth ?? 0n);
  return tranche < reserve ? tranche : reserve;
}

export function marketStabilityCanSell(state) {
  return Boolean(state?.exists) && state.phase === MARKET_STABILITY_PHASE_IDLE && maxBuyableAtomic(state) > 0n;
}

export function createMarketStabilityReader(runGetMethod) {
  if (typeof runGetMethod !== 'function') throw new Error('createMarketStabilityReader requires runGetMethod');
  return async (sellerAddress) => {
    if (!sellerAddress) return { exists: false };
    const raw = await runGetMethod({ address: sellerAddress, method: 'get_market_stability_seller_state', stack: [] });
    if (!raw || raw.exit_code !== 0) return { exists: false };
    return { exists: true, ...decodeMarketStabilityStateStack(raw.stack) };
  };
}
