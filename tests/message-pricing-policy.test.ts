import { describe, expect, it } from 'vitest';
import {
  INCLUDED_NETWORK_FEE_NANOTONS,
  MESSAGE_PRICE_SUITES,
  PUBLIC_MESSAGE_BASE_PRICE_NANOTONS,
  formatTonAmount,
  messagePriceLabel,
  messagePriceNanotons,
  networkFeeSurchargeNanotons,
  resolveNetworkFeeEstimateNanotons,
  valueWithNetworkFeeSurchargeNanotons,
} from '../web/message-pricing-policy.mjs';

describe('PWA message pricing policy', () => {
  it('PWA-MSG-PRICE-01: keeps beautiful base prices while the fee estimate fits the included allowance', () => {
    expect(INCLUDED_NETWORK_FEE_NANOTONS).toBe(5_000_000n);
    expect(PUBLIC_MESSAGE_BASE_PRICE_NANOTONS).toBe(10_000_000n);
    expect(messagePriceNanotons(MESSAGE_PRICE_SUITES.PUBLIC_V1)).toBe(10_000_000n);
    expect(messagePriceNanotons(MESSAGE_PRICE_SUITES.CLASSICAL_V1)).toBe(10_000_000n);
    expect(messagePriceNanotons(MESSAGE_PRICE_SUITES.HYBRID_V1)).toBe(20_000_000n);
    expect(messagePriceNanotons(MESSAGE_PRICE_SUITES.CLASSICAL_V1, {
      estimatedNetworkFeeNanotons: 5_000_000n,
    })).toBe(10_000_000n);
  });

  it('PWA-MSG-PRICE-02: rounds fee overage upward to clean 0.001 TON steps', () => {
    expect(networkFeeSurchargeNanotons(5_000_001n)).toBe(1_000_000n);
    expect(networkFeeSurchargeNanotons(6_500_000n)).toBe(2_000_000n);
    expect(messagePriceNanotons(MESSAGE_PRICE_SUITES.CLASSICAL_V1, {
      estimatedNetworkFeeNanotons: 6_500_000n,
    })).toBe(12_000_000n);
    expect(messagePriceNanotons(MESSAGE_PRICE_SUITES.HYBRID_V1, {
      estimatedNetworkFeeNanotons: 6_500_000n,
    })).toBe(22_000_000n);
  });

  it('PWA-MSG-PRICE-03: covers severe fee growth without operating below cost', () => {
    expect(networkFeeSurchargeNanotons(65_000_000n)).toBe(60_000_000n);
    expect(messagePriceNanotons(MESSAGE_PRICE_SUITES.CLASSICAL_V1, {
      estimatedNetworkFeeNanotons: 65_000_000n,
    })).toBe(70_000_000n);
    expect(messagePriceNanotons(MESSAGE_PRICE_SUITES.HYBRID_V1, {
      estimatedNetworkFeeNanotons: 65_000_000n,
    })).toBe(80_000_000n);
  });

  it('PWA-MSG-PRICE-04: resolves config-shaped estimates and formats TON labels', () => {
    const config = {
      estimatedNetworkFeeNanotons: '6500000',
      includedNetworkFeeNanotons: '5000000',
      roundingStepNanotons: '1000000',
    };

    expect(resolveNetworkFeeEstimateNanotons(config)).toBe(6_500_000n);
    expect(formatTonAmount(messagePriceNanotons(MESSAGE_PRICE_SUITES.CLASSICAL_V1, config))).toBe('0.012');
    expect(messagePriceLabel(MESSAGE_PRICE_SUITES.HYBRID_V1, config)).toBe('0.022 TON');
  });

  it('PWA-MSG-PRICE-05: applies the same surcharge to canonical contract values', () => {
    expect(valueWithNetworkFeeSurchargeNanotons(49_000_000n, {
      estimatedNetworkFeeNanotons: 6_500_000n,
    })).toBe(51_000_000n);
    expect(valueWithNetworkFeeSurchargeNanotons('13000000', {
      estimatedNetworkFeeNanotons: 5_000_000n,
    })).toBe(13_000_000n);
  });
});
