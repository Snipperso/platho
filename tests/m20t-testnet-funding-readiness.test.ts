import { describe, expect, it } from 'vitest';
import { toNano } from '@ton/core';
import { createM20TFundingReadiness, M20TLocalEnvPublic } from '../scripts/m20t_testnet_funding_readiness';

const env: M20TLocalEnvPublic = {
  network: 'testnet',
  rpcEndpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
  deployerAddress: '0QCTestDisposableAddress',
  deployerWalletVersion: 'v4r2',
  minBalanceNanotons: toNano('55').toString(),
  allowMainnet: 'false',
  setStonfiRouteFreezeReady: 'false',
  setBuybackBurnImplementationReady: 'false',
};

describe('M20T testnet funding readiness', () => {
  it('M20T-FUND-01: zero balance reports NEED_TESTNET_TON without exposing secrets', () => {
    const report = createM20TFundingReadiness({ observedBalanceNanotons: 0n, env });

    expect(report.status).toBe('NEED_TESTNET_TON');
    expect(report.deployer.secretMaterialPrinted).toBe(false);
    expect(report.funding.remainingForScaledHarnessNanotons).toBe(toNano('1').toString());
    expect(report.productionReadiness.productionBuybackBurnImplementationReady).toBe(false);
    expect(report.allGuardrailsPass).toBe(true);
  });

  it('M20T-FUND-02: 2 testnet TON is enough only for scaled harness, not full-size M20T', () => {
    const report = createM20TFundingReadiness({ observedBalanceNanotons: toNano('2'), env });

    expect(report.status).toBe('READY_FOR_SCALED_HARNESS_ONLY');
    expect(report.scaledHarness.scaledTotalFundingEnvelopeNanotons).toBe(toNano('0.5105').toString());
    expect(report.fullSizeM20T.allowedNow).toBe(false);
    expect(report.funding.remainingForFullSizeM20TNanotons).toBe(toNano('53').toString());
    expect(report.productionReadiness.canImplementProductionContractNow).toBe(false);
  });

  it('M20T-FUND-03: 55 testnet TON is enough for full-size M20T but still not production unlock', () => {
    const report = createM20TFundingReadiness({ observedBalanceNanotons: toNano('55'), env });

    expect(report.status).toBe('READY_FOR_FULL_SIZE_M20T');
    expect(report.fullSizeM20T.allowedNow).toBe(true);
    expect(report.productionReadiness.productionBuybackBurnImplementationReady).toBe(false);
    expect(report.productionReadiness.blockedBy).toContain('M20F_MAINNET_STONFI_ROUTE_FREEZE_NOT_READY');
  });

  it('M20T-FUND-04: guardrails fail if any production flag is enabled', () => {
    const report = createM20TFundingReadiness({
      observedBalanceNanotons: toNano('55'),
      env: { ...env, setBuybackBurnImplementationReady: 'true' },
    });

    expect(report.status).toBe('READY_FOR_FULL_SIZE_M20T');
    expect(report.guardrails.buybackBurnImplementationFlagRemainsFalse).toBe(false);
    expect(report.allGuardrailsPass).toBe(false);
  });
});
