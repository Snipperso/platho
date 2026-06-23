import { describe, expect, it } from 'vitest';
import {
  HIGH_NETWORK_FEE_SURCHARGE_CONFIRM_NANOTONS,
  INCLUDED_NETWORK_FEE_NANOTONS,
  MANUAL_NETWORK_FEE_SURCHARGE_OVERRIDE_NANOTONS,
  MAX_NETWORK_FEE_SURCHARGE_NANOTONS,
  MESSAGE_PRICE_SUITES,
  BATCH_SHARED_BASE_HOLD_NANOTONS,
  PRIVATE_CAPSULE_HOLD_NANOTONS_BY_SIZE_CLASS,
  PRIVATE_CAPSULE_NET_PRICE_NANOTONS_BY_SIZE_CLASS,
  PRIVATE_CAPSULE_PER_PART_HOLD_NANOTONS_BY_SIZE_CLASS,
  PUBLIC_CAPSULE_PER_PART_HOLD_NANOTONS_BY_SIZE_CLASS,
  PUBLIC_MESSAGE_BASE_PRICE_NANOTONS,
  batchHoldNanotons,
  capsulePerPartHoldNanotons,
  formatTonAmount,
  highNetworkFeeSurchargeConfirmThresholdNanotons,
  maxNetworkFeeSurchargeNanotons,
  messagePriceLabel,
  messagePriceNanotons,
  networkFeeSurchargeNanotons,
  networkFeeSurchargeExceedsMax,
  privateCapsuleBaseHoldNanotons,
  privateCapsuleBaseNetPriceNanotons,
  publicCapsuleBaseHoldNanotons,
  publicCapsuleBaseNetPriceNanotons,
  rawNetworkFeeSurchargeNanotons,
  requiresHighNetworkFeeSurchargeConfirmation,
  requiresManualNetworkFeeSurchargeOverride,
  resolveNetworkFeeEstimateNanotons,
  valueWithNetworkFeeSurchargeNanotons,
} from '../web/message-pricing-policy.mjs';

describe('PWA message pricing policy', () => {
  it('PWA-MSG-PRICE-01: exposes current net base prices while the fee estimate fits the included allowance', () => {
    expect(INCLUDED_NETWORK_FEE_NANOTONS).toBe(5_000_000n);
    expect(MAX_NETWORK_FEE_SURCHARGE_NANOTONS).toBe(50_000_000n);
    expect(HIGH_NETWORK_FEE_SURCHARGE_CONFIRM_NANOTONS).toBe(10_000_000n);
    expect(MANUAL_NETWORK_FEE_SURCHARGE_OVERRIDE_NANOTONS).toBe(50_000_000n);
    expect(PUBLIC_MESSAGE_BASE_PRICE_NANOTONS).toBe(33_700_000n);
    expect(messagePriceNanotons(MESSAGE_PRICE_SUITES.PUBLIC_V1)).toBe(33_700_000n);
    expect(messagePriceNanotons(MESSAGE_PRICE_SUITES.HYBRID_V1)).toBe(34_700_000n);
    expect(messagePriceNanotons(MESSAGE_PRICE_SUITES.HYBRID_V1, {
      estimatedNetworkFeeNanotons: 5_000_000n,
    })).toBe(34_700_000n);
    expect(() => messagePriceNanotons('classical-v1')).toThrow(/Unsupported message price suite/);
  });

  it('PWA-MSG-PRICE-02: rounds fee overage upward to clean 0.001 TON steps', () => {
    expect(networkFeeSurchargeNanotons(5_000_001n)).toBe(1_000_000n);
    expect(networkFeeSurchargeNanotons(6_500_000n)).toBe(2_000_000n);
    expect(messagePriceNanotons(MESSAGE_PRICE_SUITES.HYBRID_V1, {
      estimatedNetworkFeeNanotons: 6_500_000n,
    })).toBe(36_700_000n);
  });

  it('PWA-MSG-PRICE-03: caps severe fee growth and exposes hard-cap overflow separately', () => {
    expect(rawNetworkFeeSurchargeNanotons(65_000_000n)).toBe(60_000_000n);
    expect(networkFeeSurchargeNanotons(65_000_000n)).toBe(50_000_000n);
    expect(messagePriceNanotons(MESSAGE_PRICE_SUITES.HYBRID_V1, {
      estimatedNetworkFeeNanotons: 65_000_000n,
    })).toBe(84_700_000n);
    expect(rawNetworkFeeSurchargeNanotons(5_000_000_000n)).toBe(4_995_000_000n);
    expect(networkFeeSurchargeNanotons(5_000_000_000n)).toBe(50_000_000n);
    expect(messagePriceNanotons(MESSAGE_PRICE_SUITES.PUBLIC_V1, {
      estimatedNetworkFeeNanotons: 5_000_000_000n,
    })).toBe(83_700_000n);
    expect(networkFeeSurchargeNanotons(5_000_000_000n, {
      maxNetworkFeeSurchargeNanotons: 60_000_000n,
    })).toBe(60_000_000n);
    expect(maxNetworkFeeSurchargeNanotons()).toBe(50_000_000n);
    expect(networkFeeSurchargeExceedsMax(55_000_000n)).toBe(false);
    expect(networkFeeSurchargeExceedsMax(56_000_000n)).toBe(true);
    expect(networkFeeSurchargeExceedsMax(5_000_000_000n)).toBe(true);
    expect(requiresHighNetworkFeeSurchargeConfirmation(11_000_000n)).toBe(true);
    expect(requiresHighNetworkFeeSurchargeConfirmation(10_000_000n)).toBe(false);
    expect(requiresManualNetworkFeeSurchargeOverride(51_000_000n)).toBe(true);
    expect(requiresManualNetworkFeeSurchargeOverride(50_000_000n)).toBe(false);
    expect(highNetworkFeeSurchargeConfirmThresholdNanotons({
      highNetworkFeeSurchargeConfirmNanotons: '12000000',
    })).toBe(12_000_000n);
  });

  it('PWA-MSG-PRICE-04: resolves config-shaped estimates and formats TON labels', () => {
    const config = {
      estimatedNetworkFeeNanotons: '6500000',
      includedNetworkFeeNanotons: '5000000',
      roundingStepNanotons: '1000000',
    };

    expect(resolveNetworkFeeEstimateNanotons(config)).toBe(6_500_000n);
    expect(formatTonAmount(messagePriceNanotons(MESSAGE_PRICE_SUITES.PUBLIC_V1))).toBe('0.0337');
    expect(messagePriceLabel(MESSAGE_PRICE_SUITES.HYBRID_V1)).toBe('0.0347 TON');
    expect(formatTonAmount(messagePriceNanotons(MESSAGE_PRICE_SUITES.PUBLIC_V1, config))).toBe('0.0357');
    expect(messagePriceLabel(MESSAGE_PRICE_SUITES.HYBRID_V1, config)).toBe('0.0367 TON');
  });

  it('PWA-MSG-PRICE-05: applies the same surcharge to canonical contract values', () => {
    expect(valueWithNetworkFeeSurchargeNanotons(49_000_000n, {
      estimatedNetworkFeeNanotons: 6_500_000n,
    })).toBe(51_000_000n);
    expect(valueWithNetworkFeeSurchargeNanotons('13000000', {
      estimatedNetworkFeeNanotons: 5_000_000n,
    })).toBe(13_000_000n);
  });

  it('PWA-MSG-PRICE-06: exposes the VPB2 batch hold model (SHARED_BASE + per-part marginal)', () => {
    // Single-capsule total hold == SHARED_BASE + per-part marginal (the canonical_total of a 1-part batch).
    expect(BATCH_SHARED_BASE_HOLD_NANOTONS).toBe(127_800_000n);
    expect(publicCapsuleBaseHoldNanotons()).toBe(BATCH_SHARED_BASE_HOLD_NANOTONS + 42_000_000n);
    expect(publicCapsuleBaseNetPriceNanotons()).toBe(39_000_000n);
    expect(PRIVATE_CAPSULE_PER_PART_HOLD_NANOTONS_BY_SIZE_CLASS).toEqual({
      1: 34_800_000n,
      2: 35_400_000n,
      4: 35_800_000n,
      8: 36_200_000n,
      16: 40_500_000n,
      32: 50_000_000n,
    });
    expect(PUBLIC_CAPSULE_PER_PART_HOLD_NANOTONS_BY_SIZE_CLASS).toEqual({
      1: 42_000_000n,
      2: 43_000_000n,
      4: 44_000_000n,
      8: 45_000_000n,
      16: 48_000_000n,
      32: 57_500_000n,
    });
    expect(PRIVATE_CAPSULE_HOLD_NANOTONS_BY_SIZE_CLASS).toEqual({
      1: 162_600_000n,
      2: 163_200_000n,
      4: 163_600_000n,
      8: 164_000_000n,
      16: 168_300_000n,
      32: 177_800_000n,
    });
    expect(PRIVATE_CAPSULE_NET_PRICE_NANOTONS_BY_SIZE_CLASS).toEqual({
      1: 33_900_000n,
      2: 35_200_000n,
      4: 37_700_000n,
      8: 42_700_000n,
      16: 52_700_000n,
      32: 72_800_000n,
    });
    for (const [sizeClass, hold] of Object.entries(PRIVATE_CAPSULE_HOLD_NANOTONS_BY_SIZE_CLASS)) {
      expect(privateCapsuleBaseHoldNanotons(sizeClass)).toBe(hold);
      expect(privateCapsuleBaseHoldNanotons(sizeClass)).toBe(
        BATCH_SHARED_BASE_HOLD_NANOTONS + PRIVATE_CAPSULE_PER_PART_HOLD_NANOTONS_BY_SIZE_CLASS[sizeClass],
      );
      expect(privateCapsuleBaseNetPriceNanotons(sizeClass)).toBe(PRIVATE_CAPSULE_NET_PRICE_NANOTONS_BY_SIZE_CLASS[sizeClass]);
    }
    expect(() => privateCapsuleBaseHoldNanotons(3)).toThrow(/Unsupported private capsule size class/);
  });

  it('PWA-MSG-PRICE-07: batchHoldNanotons amortizes the shared base over the batch', () => {
    expect(capsulePerPartHoldNanotons('private', 1)).toBe(34_800_000n);
    expect(capsulePerPartHoldNanotons('public', 1)).toBe(42_000_000n);
    // One part: SHARED_BASE + one marginal.
    expect(batchHoldNanotons([{ kindLabel: 'private', sizeClass: 1 }]))
      .toBe(BATCH_SHARED_BASE_HOLD_NANOTONS + 34_800_000n);
    // Eight parts: SHARED_BASE charged ONCE + eight marginals (NOT 8x the single-capsule hold).
    const eight = batchHoldNanotons(Array.from({ length: 8 }, () => ({ kindLabel: 'private', sizeClass: 1 })));
    expect(eight).toBe(BATCH_SHARED_BASE_HOLD_NANOTONS + 8n * 34_800_000n);
    // Amortization: an 8-part batch's per-capsule hold is well below a 1-part hold.
    const one = batchHoldNanotons([{ kindLabel: 'private', sizeClass: 1 }]);
    expect(eight / 8n).toBeLessThan(one);
    // Empty -> just the base.
    expect(batchHoldNanotons([])).toBe(BATCH_SHARED_BASE_HOLD_NANOTONS);
  });
});
