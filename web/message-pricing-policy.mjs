export const NANOTONS_PER_TON = 1_000_000_000n;
export const MESSAGE_PRICE_STEP_NANOTONS = 1_000_000n;
export const INCLUDED_NETWORK_FEE_NANOTONS = 5_000_000n;
export const MAX_NETWORK_FEE_SURCHARGE_NANOTONS = 50_000_000n;
export const HIGH_NETWORK_FEE_SURCHARGE_CONFIRM_NANOTONS = 10_000_000n;
export const MANUAL_NETWORK_FEE_SURCHARGE_OVERRIDE_NANOTONS = 50_000_000n;
export const PUBLIC_MESSAGE_BASE_PRICE_NANOTONS = 33_700_000n;
export const HYBRID_MESSAGE_BASE_PRICE_NANOTONS = 34_700_000n;
export const SUCCESSFUL_PUBLISH_ACK_REFUND_NANOTONS = 25_800_000n;
export const PUBLIC_CAPSULE_HOLD_NANOTONS = 59_500_000n;
export const PRIVATE_CAPSULE_HOLD_NANOTONS_BY_SIZE_CLASS = Object.freeze({
  1: 60_500_000n,
  2: 62_400_000n,
  4: 66_100_000n,
  8: 73_700_000n,
  16: 89_000_000n,
  32: 119_500_000n,
});
export const PRIVATE_CAPSULE_NET_PRICE_NANOTONS_BY_SIZE_CLASS = Object.freeze({
  1: 34_700_000n,
  2: 36_600_000n,
  4: 40_300_000n,
  8: 47_900_000n,
  16: 63_200_000n,
  32: 93_700_000n,
});

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

export function messageBasePriceNanotons(suite) {
  if (suite === MESSAGE_PRICE_SUITES.HYBRID_V1) return HYBRID_MESSAGE_BASE_PRICE_NANOTONS;
  if (suite === MESSAGE_PRICE_SUITES.PUBLIC_V1) return PUBLIC_MESSAGE_BASE_PRICE_NANOTONS;
  throw new RangeError(`Unsupported message price suite: ${String(suite)}`);
}

export function normalizePrivateCapsuleSizeClass(sizeClass) {
  const normalized = Number(integerLikeToBigInt(sizeClass, 1n));
  if ([1, 2, 4, 8, 16, 32].includes(normalized)) return normalized;
  throw new RangeError(`Unsupported private capsule size class: ${String(sizeClass)}`);
}

export function publicCapsuleBaseHoldNanotons() {
  return PUBLIC_CAPSULE_HOLD_NANOTONS;
}

export function publicCapsuleBaseNetPriceNanotons() {
  return PUBLIC_CAPSULE_HOLD_NANOTONS - SUCCESSFUL_PUBLISH_ACK_REFUND_NANOTONS;
}

export function privateCapsuleBaseHoldNanotons(sizeClass) {
  return PRIVATE_CAPSULE_HOLD_NANOTONS_BY_SIZE_CLASS[normalizePrivateCapsuleSizeClass(sizeClass)];
}

export function privateCapsuleBaseNetPriceNanotons(sizeClass) {
  return PRIVATE_CAPSULE_NET_PRICE_NANOTONS_BY_SIZE_CLASS[normalizePrivateCapsuleSizeClass(sizeClass)];
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

export function formatTonAmount(nanotons, decimals = 4) {
  const value = integerLikeToBigInt(nanotons);
  const whole = value / NANOTONS_PER_TON;
  const frac = value % NANOTONS_PER_TON;
  const scale = 10n ** BigInt(decimals);
  const roundedFrac = (frac * scale) / NANOTONS_PER_TON;
  const decimalText = roundedFrac.toString().padStart(decimals, '0').replace(/0+$/, '');
  return decimalText ? `${whole}.${decimalText}` : whole.toString();
}

export function messagePriceLabel(suite, options = {}) {
  return `${formatTonAmount(messagePriceNanotons(suite, options))} TON`;
}
