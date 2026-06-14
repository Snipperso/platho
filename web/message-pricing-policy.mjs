export const NANOTONS_PER_TON = 1_000_000_000n;
export const MESSAGE_PRICE_STEP_NANOTONS = 1_000_000n;
export const INCLUDED_NETWORK_FEE_NANOTONS = 5_000_000n;
export const MAX_NETWORK_FEE_SURCHARGE_NANOTONS = 50_000_000n;
export const HIGH_NETWORK_FEE_SURCHARGE_CONFIRM_NANOTONS = 10_000_000n;
export const MANUAL_NETWORK_FEE_SURCHARGE_OVERRIDE_NANOTONS = 50_000_000n;
export const PUBLIC_MESSAGE_BASE_PRICE_NANOTONS = 33_700_000n;
export const HYBRID_MESSAGE_BASE_PRICE_NANOTONS = 34_700_000n;
export const SUCCESSFUL_PUBLISH_ACK_REFUND_NANOTONS = 25_800_000n;

// ---------------------------------------------------------------------------
// VPB2 batch publish hold model (re-derived 2026-06-14 against the recalibrated Vault.tact contract).
//
// A signed batch external carries ONE kind and 1..MAX_BATCH_PARTS parts. Its max_charge must clear the
// contract's post-accept canonical_total, or the batch is post-accept-rejected RJ_UNDERPRICED (0x16,
// refundable). canonical_total is AFFINE in part_count:
//
//     canonical_total(kind, sizes, n)  ==  SHARED_BASE  +  Σ perPartHold(kind, size_i)
//
// SHARED_BASE is the amortizable FIXED cost (worst-case EXT_HARD import ~89.6M + the 0.03 TON ACK floor +
// the Hub/Vault per-batch base compute) — paid ONCE per batch regardless of part_count. perPartHold is the
// per-capsule marginal (10M protocol fee + per-part Hub/Vault compute + storage endowment ×1.25), which
// grows with size_class. Sandbox-measured exactly (the contract slope is linear); the pins below add ~3%
// headroom (and round up to 0.0001 TON), matching how the contract pins itself are rounded up for config
// drift. Over-reserving is refunded via the mode-128 ACK, so erring slightly HIGH is free; the hold must
// never fall BELOW canonical_total. A batch amortizes SHARED_BASE over its parts, so the per-capsule hold of
// an 8-part batch is far below a 1-part hold — this is what makes batching cheap.
//
// Measured boundary == max(canonical_total, batchChargeFloor(n)); canonical_total >= floor for every honest
// shape, so the boundary IS canonical_total. See tests/web-publish-pricing.test.ts for the proof.
// ---------------------------------------------------------------------------

// Amortizable fixed base of a batch's canonical_total (added once per signed root, NOT per part).
export const BATCH_SHARED_BASE_HOLD_NANOTONS = 127_800_000n;

// Per-part marginal hold by size class (the amount each additional capsule adds to canonical_total).
export const PRIVATE_CAPSULE_PER_PART_HOLD_NANOTONS_BY_SIZE_CLASS = Object.freeze({
  1: 28_700_000n,
  2: 29_400_000n,
  4: 30_600_000n,
  8: 33_100_000n,
  16: 38_000_000n,
  32: 47_900_000n,
});
export const PUBLIC_CAPSULE_PER_PART_HOLD_NANOTONS_BY_SIZE_CLASS = Object.freeze({
  1: 33_200_000n,
  2: 33_800_000n,
  4: 35_000_000n,
  8: 37_500_000n,
  16: 42_400_000n,
  32: 52_300_000n,
});

// SINGLE-capsule total hold = SHARED_BASE + perPartHold(size). This is the canonical_total (and thus the
// signed max_charge) of a 1-part batch — the worst per-capsule price, since nothing amortizes the base.
// Kept as the headline per-size hold table (artifact + affordability fallbacks); the batch path uses
// batchHoldNanotons() so a multi-part batch pays SHARED_BASE only once.
export const PRIVATE_CAPSULE_HOLD_NANOTONS_BY_SIZE_CLASS = Object.freeze(Object.fromEntries(
  Object.entries(PRIVATE_CAPSULE_PER_PART_HOLD_NANOTONS_BY_SIZE_CLASS).map(([sizeClass, perPart]) => [
    sizeClass,
    BATCH_SHARED_BASE_HOLD_NANOTONS + perPart,
  ]),
));
export const PUBLIC_CAPSULE_HOLD_NANOTONS_BY_SIZE_CLASS = Object.freeze(Object.fromEntries(
  Object.entries(PUBLIC_CAPSULE_PER_PART_HOLD_NANOTONS_BY_SIZE_CLASS).map(([sizeClass, perPart]) => [
    sizeClass,
    BATCH_SHARED_BASE_HOLD_NANOTONS + perPart,
  ]),
));

// Net price = the OBSERVED SETTLED charge (real user debit AFTER the over-hold is refunded), per single
// capsule. Sandbox-measured at the current build (1-part batch, ample max_charge), rounded up to 0.0001 TON.
// This is what the user actually pays — NOT the hold (which is reserved then mostly returned).
export const PRIVATE_CAPSULE_NET_PRICE_NANOTONS_BY_SIZE_CLASS = Object.freeze({
  1: 32_300_000n,
  2: 33_600_000n,
  4: 36_100_000n,
  8: 41_100_000n,
  16: 51_200_000n,
  32: 71_200_000n,
});
export const PUBLIC_CAPSULE_NET_PRICE_NANOTONS_BY_SIZE_CLASS = Object.freeze({
  1: 34_700_000n,
  2: 36_000_000n,
  4: 38_500_000n,
  8: 43_500_000n,
  16: 53_600_000n,
  32: 73_600_000n,
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

export function normalizePublicCapsuleSizeClass(sizeClass) {
  const normalized = Number(integerLikeToBigInt(sizeClass, 1n));
  if ([1, 2, 4, 8, 16, 32].includes(normalized)) return normalized;
  throw new RangeError(`Unsupported public capsule size class: ${String(sizeClass)}`);
}

export function publicCapsuleBaseHoldNanotons(sizeClass = 1) {
  return PUBLIC_CAPSULE_HOLD_NANOTONS_BY_SIZE_CLASS[normalizePublicCapsuleSizeClass(sizeClass)];
}

export function publicCapsuleBaseNetPriceNanotons(sizeClass = 1) {
  return PUBLIC_CAPSULE_NET_PRICE_NANOTONS_BY_SIZE_CLASS[normalizePublicCapsuleSizeClass(sizeClass)];
}

export function privateCapsuleBaseHoldNanotons(sizeClass) {
  return PRIVATE_CAPSULE_HOLD_NANOTONS_BY_SIZE_CLASS[normalizePrivateCapsuleSizeClass(sizeClass)];
}

export function privateCapsuleBaseNetPriceNanotons(sizeClass) {
  return PRIVATE_CAPSULE_NET_PRICE_NANOTONS_BY_SIZE_CLASS[normalizePrivateCapsuleSizeClass(sizeClass)];
}

// Per-part marginal hold a single capsule of this kind/size adds to a batch's canonical_total.
export function publicCapsulePerPartHoldNanotons(sizeClass = 1) {
  return PUBLIC_CAPSULE_PER_PART_HOLD_NANOTONS_BY_SIZE_CLASS[normalizePublicCapsuleSizeClass(sizeClass)];
}
export function privateCapsulePerPartHoldNanotons(sizeClass = 1) {
  return PRIVATE_CAPSULE_PER_PART_HOLD_NANOTONS_BY_SIZE_CLASS[normalizePrivateCapsuleSizeClass(sizeClass)];
}

// Per-part hold for a 'public' | 'private' kind label (the orchestrator keys batches on this label).
export function capsulePerPartHoldNanotons(kindLabel, sizeClass = 1) {
  return kindLabel === 'public'
    ? publicCapsulePerPartHoldNanotons(sizeClass)
    : privateCapsulePerPartHoldNanotons(sizeClass);
}

// The signed max_charge a VPB2 batch must carry to clear the contract's canonical_total:
//   SHARED_BASE  +  Σ perPartHold(kind, size_i)
// `parts` is an array of { kindLabel?, kind?, sizeClass } (sizeClass may be a number or bigint). All parts in
// one batch share a kind; the amortizable SHARED_BASE is added exactly ONCE. The result is >= canonical_total
// by construction (each per-part pin >= the measured marginal + ~3% headroom, base >= measured base + headroom),
// so a batch signed at this hold is NEVER post-accept-rejected RJ_UNDERPRICED. Over-hold is refunded on ACK.
export function batchHoldNanotons(parts) {
  const list = Array.isArray(parts) ? parts.filter(Boolean) : [];
  if (list.length === 0) return BATCH_SHARED_BASE_HOLD_NANOTONS;
  let total = BATCH_SHARED_BASE_HOLD_NANOTONS;
  for (const part of list) {
    const kindLabel = part.kindLabel
      ?? (part.kind === 'public' || BigInt(part.kind ?? part.publishKind ?? 1n) === 2n ? 'public' : 'private');
    total += capsulePerPartHoldNanotons(kindLabel, part.sizeClass ?? part.size_class ?? 1);
  }
  return total;
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
