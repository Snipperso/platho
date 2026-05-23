export const NANOTONS_PER_TON = 1_000_000_000n;
export const MESSAGE_PRICE_STEP_NANOTONS = 1_000_000n;
export const INCLUDED_NETWORK_FEE_NANOTONS = 5_000_000n;
export const PUBLIC_MESSAGE_BASE_PRICE_NANOTONS = 10_000_000n;
export const STANDARD_MESSAGE_BASE_PRICE_NANOTONS = 10_000_000n;
export const HYBRID_MESSAGE_BASE_PRICE_NANOTONS = 20_000_000n;

export const MESSAGE_PRICE_SUITES = Object.freeze({
  PUBLIC_V1: 'public-v1',
  CLASSICAL_V1: 'classical-v1',
  HYBRID_V1: 'hybrid-v1',
});

function integerLikeToBigInt(value, fallback = 0n) {
  if (typeof value === 'bigint') return value >= 0n ? value : fallback;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 0 ? BigInt(Math.ceil(value)) : fallback;
  }
  if (typeof value === 'string' && /^[0-9]+$/.test(value)) return BigInt(value);
  if (value && typeof value.toString === 'function') {
    const text = value.toString();
    if (/^[0-9]+$/.test(text)) return BigInt(text);
  }
  return fallback;
}

export function roundUpNanotons(value, step = MESSAGE_PRICE_STEP_NANOTONS) {
  const amount = integerLikeToBigInt(value);
  const quantum = integerLikeToBigInt(step, MESSAGE_PRICE_STEP_NANOTONS);
  if (amount <= 0n) return 0n;
  if (quantum <= 1n) return amount;
  return ((amount + quantum - 1n) / quantum) * quantum;
}

export function networkFeeSurchargeNanotons(estimatedNetworkFeeNanotons, options = {}) {
  const included = integerLikeToBigInt(options.includedNetworkFeeNanotons, INCLUDED_NETWORK_FEE_NANOTONS);
  const estimate = integerLikeToBigInt(estimatedNetworkFeeNanotons, included);
  if (estimate <= included) return 0n;
  return roundUpNanotons(estimate - included, options.roundingStepNanotons ?? MESSAGE_PRICE_STEP_NANOTONS);
}

export function messageBasePriceNanotons(suite) {
  return suite === MESSAGE_PRICE_SUITES.HYBRID_V1
    ? HYBRID_MESSAGE_BASE_PRICE_NANOTONS
    : STANDARD_MESSAGE_BASE_PRICE_NANOTONS;
}

export function messagePriceNanotons(suite, options = {}) {
  return messageBasePriceNanotons(suite) + networkFeeSurchargeNanotons(
    options.estimatedNetworkFeeNanotons,
    options,
  );
}

export function valueWithNetworkFeeSurchargeNanotons(canonicalValueNanotons, options = {}) {
  return integerLikeToBigInt(canonicalValueNanotons) + networkFeeSurchargeNanotons(
    options.estimatedNetworkFeeNanotons,
    options,
  );
}

export function resolveNetworkFeeEstimateNanotons(source, fallback = INCLUDED_NETWORK_FEE_NANOTONS) {
  if (source == null) return fallback;
  if (typeof source === 'bigint' || typeof source === 'number' || typeof source === 'string') {
    return integerLikeToBigInt(source, fallback);
  }
  if (typeof source !== 'object') return fallback;
  return integerLikeToBigInt(
    source.estimatedNetworkFeeNanotons
      ?? source.networkFeeEstimateNanotons
      ?? source.network_fee_estimate_nanotons
      ?? source.feeNanotons
      ?? source.fee,
    fallback,
  );
}

export function formatTonAmount(nanotons, decimals = 3) {
  const value = integerLikeToBigInt(nanotons);
  const whole = value / NANOTONS_PER_TON;
  const frac = value % NANOTONS_PER_TON;
  const scale = 10n ** BigInt(decimals);
  const roundedFrac = (frac * scale) / NANOTONS_PER_TON;
  return `${whole}.${roundedFrac.toString().padStart(decimals, '0')}`;
}

export function messagePriceLabel(suite, options = {}) {
  return `${formatTonAmount(messagePriceNanotons(suite, options))} TON`;
}
