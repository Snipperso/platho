import { describe, expect, it } from 'vitest';
import { Address } from '@ton/core';
import { createHash } from 'crypto';
import {
  BUYBACK_SPLIT_ENABLE_CALLER_RESERVE_NANOTONS,
  EnableBuybackSplitPreflightInput,
  VAULT_ACTIVITY_AIRDROP_DISCOUNT_UNLOCK_REMAINING_ATH,
  createEnableBuybackSplitPreflight,
} from '../scripts/enable_buyback_split_preflight';

function fixtureAddress(label: string, workchain = 0): string {
  return new Address(workchain, createHash('sha256').update(`PLATHO.V1.BUYBACK.ENABLE.${label}`).digest()).toString();
}

const FEE_ACCUMULATOR = fixtureAddress('FEE_ACCUMULATOR');
const BUYBACK_BURN = fixtureAddress('BUYBACK_BURN');

function completeInput(overrides: Partial<EnableBuybackSplitPreflightInput> = {}): EnableBuybackSplitPreflightInput {
  const base: EnableBuybackSplitPreflightInput = {
    feeAccumulatorAddress: FEE_ACCUMULATOR,
    buybackBurnAddress: BUYBACK_BURN,
    vaultState: {
      airdrop_remaining_ath: VAULT_ACTIVITY_AIRDROP_DISCOUNT_UNLOCK_REMAINING_ATH.toString(),
    },
    feeAccumulatorState: {
      accumulated_ton: '123456789',
      buyback_due_ton: '0',
      buyback_split_enabled: false,
      buyback_burn_address: BUYBACK_BURN,
    },
    buybackBurnConfig: {
      sealed: true,
      route_frozen: true,
      genesis_config_hash: '0',
      fee_bound: true,
      fee_accumulator_address: FEE_ACCUMULATOR,
    },
    buybackBurnState: {
      phase: '0',
      reserve_due_ton: '0',
      pending_query_id: '0',
      route_refund_due_ton: '0',
      ath_burn_retry_due_atomic: '0',
    },
    buybackBurnTotals: {
      accepted_reserve_count: '0',
      executed_buyback_count: '0',
      burned_ath_total_atomic: '0',
    },
    routeEvidence: {
      m20f_route_freeze_ready: true,
    },
  };

  return {
    ...base,
    ...overrides,
    vaultState: {
      ...base.vaultState,
      ...(overrides.vaultState ?? {}),
    },
    feeAccumulatorState: {
      ...base.feeAccumulatorState,
      ...(overrides.feeAccumulatorState ?? {}),
    },
    buybackBurnConfig: {
      ...base.buybackBurnConfig,
      ...(overrides.buybackBurnConfig ?? {}),
    },
    buybackBurnState: {
      ...base.buybackBurnState,
      ...(overrides.buybackBurnState ?? {}),
    },
    buybackBurnTotals: {
      ...base.buybackBurnTotals,
      ...(overrides.buybackBurnTotals ?? {}),
    },
    routeEvidence: {
      ...base.routeEvidence,
      ...(overrides.routeEvidence ?? {}),
    },
  };
}

describe('EnableBuybackSplit preflight guard', () => {
  it('M40E-01: passes only after airdrop threshold, route freeze, launch-controller burn, and route evidence', () => {
    const report = createEnableBuybackSplitPreflight(completeInput());

    expect(report.ok).toBe(true);
    expect(report.status).toBe('ENABLE_BUYBACK_SPLIT_PREFLIGHT_PASS');
    expect(report.requiredCallerReserveNanotons).toBe(BUYBACK_SPLIT_ENABLE_CALLER_RESERVE_NANOTONS.toString());
    expect(report.activityAirdropRemainingAth).toBe(VAULT_ACTIVITY_AIRDROP_DISCOUNT_UNLOCK_REMAINING_ATH.toString());
    expect(report.accumulatedTonSweptToTreasuryNanotons).toBe('123456789');
    expect(report.blockers).toEqual([]);
  });

  it('M40E-02: blocks enable while the Vault activity airdrop remains above the 15M ATH threshold', () => {
    const report = createEnableBuybackSplitPreflight(completeInput({
      vaultState: {
        airdrop_remaining_ath: (VAULT_ACTIVITY_AIRDROP_DISCOUNT_UNLOCK_REMAINING_ATH + 1n).toString(),
      },
    }));

    expect(report.ok).toBe(false);
    expect(report.blockers).toContain('VAULT_AIRDROP_DISTRIBUTION_THRESHOLD_NOT_REACHED');
  });

  it('M40E-03: blocks enable before BuybackBurn route freeze and M20F evidence', () => {
    const report = createEnableBuybackSplitPreflight(completeInput({
      buybackBurnConfig: {
        sealed: true,
        route_frozen: false,
        genesis_config_hash: '1234',
        fee_bound: true,
        fee_accumulator_address: FEE_ACCUMULATOR,
      },
      routeEvidence: {
        m20f_route_freeze_ready: false,
      },
    }));

    expect(report.ok).toBe(false);
    expect(report.blockers).toContain('BUYBACKBURN_ROUTE_NOT_FROZEN');
    expect(report.blockers).toContain('BUYBACKBURN_LAUNCH_CONTROLLER_NOT_BURNED');
    expect(report.blockers).toContain('M20F_ROUTE_FREEZE_EVIDENCE_NOT_READY');
  });

  it('M40E-04: blocks repeated enable or impossible pre-enable buyback due', () => {
    const report = createEnableBuybackSplitPreflight(completeInput({
      feeAccumulatorState: {
        accumulated_ton: '0',
        buyback_due_ton: '51050000000',
        buyback_split_enabled: true,
        buyback_burn_address: BUYBACK_BURN,
      },
    }));

    expect(report.ok).toBe(false);
    expect(report.blockers).toContain('FEE_ACCUMULATOR_BUYBACK_SPLIT_ALREADY_ENABLED');
    expect(report.blockers).toContain('FEE_ACCUMULATOR_BUYBACK_DUE_NOT_ZERO');
  });

  it('M40E-05: blocks mismatched FeeAccumulator and BuybackBurn bindings', () => {
    const report = createEnableBuybackSplitPreflight(completeInput({
      feeAccumulatorState: {
        accumulated_ton: '0',
        buyback_due_ton: '0',
        buyback_split_enabled: false,
        buyback_burn_address: fixtureAddress('WRONG_BUYBACK_BURN'),
      },
      buybackBurnConfig: {
        sealed: true,
        route_frozen: true,
        genesis_config_hash: '0',
        fee_bound: true,
        fee_accumulator_address: fixtureAddress('WRONG_FEE_ACCUMULATOR'),
      },
    }));

    expect(report.ok).toBe(false);
    expect(report.blockers).toContain('FEE_ACCUMULATOR_BUYBACK_ADDRESS_MISMATCH');
    expect(report.blockers).toContain('BUYBACKBURN_FEE_ACCUMULATOR_MISMATCH');
  });

  it('M40E-06: blocks cross-workchain FeeAccumulator and BuybackBurn enable endpoints', () => {
    const masterchainFeeAccumulator = fixtureAddress('MASTERCHAIN_FEE_ACCUMULATOR', -1);
    const masterchainBuybackBurn = fixtureAddress('MASTERCHAIN_BUYBACK_BURN', -1);
    const report = createEnableBuybackSplitPreflight(completeInput({
      feeAccumulatorAddress: masterchainFeeAccumulator,
      buybackBurnAddress: masterchainBuybackBurn,
      feeAccumulatorState: {
        accumulated_ton: '0',
        buyback_due_ton: '0',
        buyback_split_enabled: false,
        buyback_burn_address: masterchainBuybackBurn,
      },
      buybackBurnConfig: {
        sealed: true,
        route_frozen: true,
        genesis_config_hash: '0',
        fee_bound: true,
        fee_accumulator_address: masterchainFeeAccumulator,
      },
    }));

    expect(report.ok).toBe(false);
    expect(report.blockers).toContain('FEEACCUMULATORADDRESS_NOT_BASECHAIN');
    expect(report.blockers).toContain('BUYBACKBURNADDRESS_NOT_BASECHAIN');
    expect(report.blockers).toContain('FEEACCUMULATORSTATE_BUYBACK_BURN_ADDRESS_NOT_BASECHAIN');
    expect(report.blockers).toContain('BUYBACKBURNCONFIG_FEE_ACCUMULATOR_ADDRESS_NOT_BASECHAIN');
  });

  it('M40E-07: blocks dirty pending BuybackBurn state before one-way split enable', () => {
    const report = createEnableBuybackSplitPreflight(completeInput({
      buybackBurnState: {
        phase: '1',
        reserve_due_ton: '0',
        pending_query_id: '1',
        route_refund_due_ton: '0',
        ath_burn_retry_due_atomic: '0',
      },
    }));

    expect(report.ok).toBe(false);
    expect(report.blockers).toContain('BUYBACKBURN_PHASE_NOT_IDLE');
    expect(report.blockers).toContain('BUYBACKBURN_PENDING_QUERY_NOT_ZERO');
  });

  it('M40E-08: blocks pre-enable reserve, refund, and burn-retry dirt in BuybackBurn', () => {
    const report = createEnableBuybackSplitPreflight(completeInput({
      buybackBurnState: {
        phase: '0',
        reserve_due_ton: '51050000000',
        pending_query_id: '0',
        route_refund_due_ton: '49000000000',
        ath_burn_retry_due_atomic: '1',
      },
    }));

    expect(report.ok).toBe(false);
    expect(report.blockers).toContain('BUYBACKBURN_RESERVE_DUE_NOT_ZERO');
    expect(report.blockers).toContain('BUYBACKBURN_ROUTE_REFUND_DUE_NOT_ZERO');
    expect(report.blockers).toContain('BUYBACKBURN_ATH_BURN_RETRY_DUE_NOT_ZERO');
  });

  it('M40E-09: blocks any previous BuybackBurn activity before split enable', () => {
    const report = createEnableBuybackSplitPreflight(completeInput({
      buybackBurnTotals: {
        accepted_reserve_count: '1',
        executed_buyback_count: '1',
        burned_ath_total_atomic: '1',
      },
    }));

    expect(report.ok).toBe(false);
    expect(report.blockers).toContain('BUYBACKBURN_ACCEPTED_RESERVE_COUNT_NOT_ZERO');
    expect(report.blockers).toContain('BUYBACKBURN_EXECUTED_BUYBACK_COUNT_NOT_ZERO');
    expect(report.blockers).toContain('BUYBACKBURN_BURNED_TOTAL_NOT_ZERO');
  });
});
