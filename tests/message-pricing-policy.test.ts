import { describe, expect, it } from 'vitest';
import {
  HIGH_NETWORK_FEE_SURCHARGE_CONFIRM_NANOTONS,
  INCLUDED_NETWORK_FEE_NANOTONS,
  MANUAL_NETWORK_FEE_SURCHARGE_OVERRIDE_NANOTONS,
  MAX_NETWORK_FEE_SURCHARGE_NANOTONS,
  highNetworkFeeSurchargeConfirmThresholdNanotons,
  maxNetworkFeeSurchargeNanotons,
  networkFeeSurchargeNanotons,
  networkFeeSurchargeExceedsMax,
  rawNetworkFeeSurchargeNanotons,
  requiresHighNetworkFeeSurchargeConfirmation,
  requiresManualNetworkFeeSurchargeOverride,
  resolveNetworkFeeEstimateNanotons,
} from '../web/message-pricing-policy.mjs';

// The NETWORK-FEE SURCHARGE policy — what survives of this module. The other half it used to carry (the VPB2
// batch-hold model, the per-size-class hold and settled-price tables, messagePriceNanotons and its labels) priced
// the DELETED Vault's batch path and was removed with the rest of that freight on 2026-08-29; every quote the app
// shows now reads web/publish-price.mjs, pinned by tests/publish-price.test.ts and composer-price-is-direct-pay.
describe('PWA message pricing policy', () => {
  it('PWA-MSG-PRICE-01: the surcharge thresholds are the shipped constants', () => {
    expect(INCLUDED_NETWORK_FEE_NANOTONS).toBe(5_000_000n);
    expect(MAX_NETWORK_FEE_SURCHARGE_NANOTONS).toBe(50_000_000n);
    expect(HIGH_NETWORK_FEE_SURCHARGE_CONFIRM_NANOTONS).toBe(10_000_000n);
    expect(MANUAL_NETWORK_FEE_SURCHARGE_OVERRIDE_NANOTONS).toBe(50_000_000n);
  });

  it('PWA-MSG-PRICE-02: rounds fee overage upward to clean 0.001 TON steps', () => {
    expect(networkFeeSurchargeNanotons(5_000_001n)).toBe(1_000_000n);
    expect(networkFeeSurchargeNanotons(6_500_000n)).toBe(2_000_000n);
  });

  it('PWA-MSG-PRICE-03: caps severe fee growth and exposes hard-cap overflow separately', () => {
    expect(rawNetworkFeeSurchargeNanotons(65_000_000n)).toBe(60_000_000n);
    expect(networkFeeSurchargeNanotons(65_000_000n)).toBe(50_000_000n);
    expect(rawNetworkFeeSurchargeNanotons(5_000_000_000n)).toBe(4_995_000_000n);
    expect(networkFeeSurchargeNanotons(5_000_000_000n)).toBe(50_000_000n);
    expect(networkFeeSurchargeNanotons(5_000_000_000n, {
      maxNetworkFeeSurchargeNanotons: 60_000_000n,
    })).toBe(60_000_000n);
    expect(maxNetworkFeeSurchargeNanotons()).toBe(50_000_000n);
    expect(networkFeeSurchargeExceedsMax(55_000_000n)).toBe(false);
    expect(networkFeeSurchargeExceedsMax(56_000_000n)).toBe(true);
    expect(requiresHighNetworkFeeSurchargeConfirmation(11_000_000n)).toBe(true);
    expect(requiresHighNetworkFeeSurchargeConfirmation(10_000_000n)).toBe(false);
    expect(requiresManualNetworkFeeSurchargeOverride(51_000_000n)).toBe(true);
    expect(requiresManualNetworkFeeSurchargeOverride(50_000_000n)).toBe(false);
    expect(highNetworkFeeSurchargeConfirmThresholdNanotons({
      highNetworkFeeSurchargeConfirmNanotons: '12000000',
    })).toBe(12_000_000n);
  });

  it('PWA-MSG-PRICE-04: resolves config-shaped estimates', () => {
    expect(resolveNetworkFeeEstimateNanotons({
      estimatedNetworkFeeNanotons: '6500000',
      includedNetworkFeeNanotons: '5000000',
      roundingStepNanotons: '1000000',
    })).toBe(6_500_000n);
    expect(resolveNetworkFeeEstimateNanotons(undefined)).toBe(INCLUDED_NETWORK_FEE_NANOTONS);
  });
});
