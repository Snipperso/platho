import { describe, expect, it } from 'vitest';
import { toNano } from '@ton/core';
import { createBuybackBurnImplementationReadinessM20U } from '../scripts/buybackburn_contract_readiness_m20u';

describe('M20U BuybackBurn implementation readiness gate', () => {
  it('keeps production BuybackBurn blocked while testnet probe and mainnet route freeze are missing', () => {
    const report = createBuybackBurnImplementationReadinessM20U({
      testnetProbeComplete: false,
      stonfiRouteFreezeReady: false,
    });

    expect(report.productionBuybackBurnImplementationReady).toBe(false);
    expect(report.canImplementProductionContractNow).toBe(false);
    expect(report.stonfiRouteFreezeReady).toBe(false);
    expect(report.testnetProbeComplete).toBe(false);
    expect(report.blockedBy).toContain('M20T_TESTNET_DEPLOYMENT_PROBE_NOT_COMPLETE');
    expect(report.blockedBy).toContain('M20F_MAINNET_STONFI_ROUTE_FREEZE_NOT_READY');
  });

  it('recognizes the committed M20T live evidence but keeps production blocked by M20F', () => {
    const report = createBuybackBurnImplementationReadinessM20U({ stonfiRouteFreezeReady: false });

    expect(report.testnetProbeComplete).toBe(true);
    expect(report.productionBuybackBurnImplementationReady).toBe(false);
    expect(report.addressCircularityResolution.m20fNeedsFinalBuybackBurnAddress).toBe(true);
    expect(report.addressCircularityResolution.productionStateInitCanBePreparedBeforeM20FRouteFreeze).toBe(true);
    expect(report.addressCircularityResolution.productionRouteSealStillRequiresM20F).toBe(true);
    expect(report.blockedBy).toEqual(['M20F_MAINNET_STONFI_ROUTE_FREEZE_NOT_READY']);
  });

  it('does not treat testnet completion alone as mainnet route freeze or production readiness', () => {
    const report = createBuybackBurnImplementationReadinessM20U({ testnetProbeComplete: true, stonfiRouteFreezeReady: false });

    expect(report.productionBuybackBurnImplementationReady).toBe(false);
    expect(report.status).toBe('BLOCKED_PENDING_TESTNET_AND_MAINNET_ROUTE_FREEZE');
    expect(report.blockedBy).toEqual(['M20F_MAINNET_STONFI_ROUTE_FREEZE_NOT_READY']);
  });

  it('requires both testnet evidence and mainnet route freeze before readiness can flip', () => {
    const report = createBuybackBurnImplementationReadinessM20U({ testnetProbeComplete: true, stonfiRouteFreezeReady: true });

    expect(report.productionBuybackBurnImplementationReady).toBe(true);
    expect(report.canImplementProductionContractNow).toBe(true);
    expect(report.status).toBe('READY_FOR_IMPLEMENTATION_AFTER_M20F');
    expect(report.blockedBy).toEqual([]);
  });

  it('preserves the M19H funding split: 50 TON offer plus 1.05 TON route funding equals 51.05 TON envelope', () => {
    const report = createBuybackBurnImplementationReadinessM20U();

    expect(report.pinnedRouteIndependentValues.buybackOfferAmountNanotons).toBe(toNano('50').toString());
    expect(report.pinnedRouteIndependentValues.routeTotalFundingEnvelopeNanotons).toBe(toNano('51.05').toString());
    expect(report.pinnedRouteIndependentValues.feeAccumulatorFlushAmountNanotons).toBe(toNano('51.05').toString());
  });

  it('carries explicit Codex guardrails against secret leaks and testnet/mainnet mixing', () => {
    const report = createBuybackBurnImplementationReadinessM20U();

    expect(report.codexGuardrails.some((line) => line.includes('NEED_TESTNET_TON'))).toBe(true);
    expect(report.codexGuardrails.some((line) => line.includes('Never commit seed phrases'))).toBe(true);
    expect(report.codexGuardrails.some((line) => line.includes('address-stable BuybackBurn StateInit'))).toBe(true);
    expect(report.codexGuardrails.some((line) => line.includes('testnet manifests and mainnet route-freeze manifests separate'))).toBe(true);
    expect(report.forbidden).toContain('turning testnet proof into mainnet route freeze');
  });
});
