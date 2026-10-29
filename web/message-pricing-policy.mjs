export const NANOTONS_PER_TON = 1_000_000_000n;
export const MESSAGE_PRICE_STEP_NANOTONS = 1_000_000n;
export const INCLUDED_NETWORK_FEE_NANOTONS = 5_000_000n;
export const MAX_NETWORK_FEE_SURCHARGE_NANOTONS = 50_000_000n;
export const HIGH_NETWORK_FEE_SURCHARGE_CONFIRM_NANOTONS = 10_000_000n;
export const MANUAL_NETWORK_FEE_SURCHARGE_OVERRIDE_NANOTONS = 50_000_000n;
export const MESSAGE_PRICE_SUITES = Object.freeze({
  PUBLIC_V1: 'public-v1',
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

function optionalIntegerLikeToBigInt(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  return integerLikeToBigInt(value, fallback ?? 0n);
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
  const maxSurcharge = optionalIntegerLikeToBigInt(
    options.maxNetworkFeeSurchargeNanotons,
    MAX_NETWORK_FEE_SURCHARGE_NANOTONS,
  );
  const estimate = integerLikeToBigInt(estimatedNetworkFeeNanotons, included);
  if (estimate <= included) return 0n;
  const surcharge = roundUpNanotons(estimate - included, options.roundingStepNanotons ?? MESSAGE_PRICE_STEP_NANOTONS);
  if (maxSurcharge === null) return surcharge;
  if (maxSurcharge <= 0n) return 0n;
  return surcharge > maxSurcharge ? maxSurcharge : surcharge;
}

export function rawNetworkFeeSurchargeNanotons(estimatedNetworkFeeNanotons, options = {}) {
  const included = integerLikeToBigInt(options.includedNetworkFeeNanotons, INCLUDED_NETWORK_FEE_NANOTONS);
  const estimate = integerLikeToBigInt(estimatedNetworkFeeNanotons, included);
  if (estimate <= included) return 0n;
  return roundUpNanotons(estimate - included, options.roundingStepNanotons ?? MESSAGE_PRICE_STEP_NANOTONS);
}

export function maxNetworkFeeSurchargeNanotons(options = {}) {
  return optionalIntegerLikeToBigInt(
    options.maxNetworkFeeSurchargeNanotons,
    MAX_NETWORK_FEE_SURCHARGE_NANOTONS,
  );
}

export function networkFeeSurchargeExceedsMax(estimatedNetworkFeeNanotons, options = {}) {
  const maxSurcharge = maxNetworkFeeSurchargeNanotons(options);
  if (maxSurcharge === null || maxSurcharge <= 0n) return false;
  return rawNetworkFeeSurchargeNanotons(estimatedNetworkFeeNanotons, options) > maxSurcharge;
}

function networkFeeSurchargeThresholdNanotons(value, fallback) {
  return optionalIntegerLikeToBigInt(value, fallback);
}

export function highNetworkFeeSurchargeConfirmThresholdNanotons(options = {}) {
  return networkFeeSurchargeThresholdNanotons(
    options.highNetworkFeeSurchargeConfirmNanotons,
    HIGH_NETWORK_FEE_SURCHARGE_CONFIRM_NANOTONS,
  );
}

export function manualNetworkFeeSurchargeOverrideThresholdNanotons(options = {}) {
  return networkFeeSurchargeThresholdNanotons(
    options.manualNetworkFeeSurchargeOverrideNanotons,
    MANUAL_NETWORK_FEE_SURCHARGE_OVERRIDE_NANOTONS,
  );
}

export function requiresHighNetworkFeeSurchargeConfirmation(surchargeNanotons, options = {}) {
  const threshold = highNetworkFeeSurchargeConfirmThresholdNanotons(options);
  if (threshold === null || threshold <= 0n) return false;
  return integerLikeToBigInt(surchargeNanotons) > threshold;
}

export function requiresManualNetworkFeeSurchargeOverride(surchargeNanotons, options = {}) {
  const threshold = manualNetworkFeeSurchargeOverrideThresholdNanotons(options);
  if (threshold === null || threshold <= 0n) return false;
  return integerLikeToBigInt(surchargeNanotons) > threshold;
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
