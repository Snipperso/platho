import { describe, expect, it } from 'vitest';
import {
  BUYBACK_FLUSH_CALLER_RESERVE_NANOTONS,
  BUYBACK_FLUSH_ENVELOPE_NANOTONS,
  BuybackFlushPreflightInput,
  createBuybackFlushPreflight,
} from '../scripts/buyback_flush_preflight';

const FEE_ACCUMULATOR = 'EQFeeAccumulatorM40';
const BUYBACK_BURN = 'EQBuybackBurnM40';

function completeInput(overrides: Partial<BuybackFlushPreflightInput> = {}): BuybackFlushPreflightInput {
  const base: BuybackFlushPreflightInput = {
    amount: BUYBACK_FLUSH_ENVELOPE_NANOTONS.toString(),
    feeAccumulatorAddress: FEE_ACCUMULATOR,
    buybackBurnAddress: BUYBACK_BURN,
    feeAccumulatorState: {
      buyback_due_ton: BUYBACK_FLUSH_ENVELOPE_NANOTONS.toString(),
      buyback_burn_address: BUYBACK_BURN,
    },
    buybackBurnConfig: {
      sealed: true,
      route_frozen: true,
      fee_bound: true,
      fee_accumulator_address: FEE_ACCUMULATOR,
    },
  };

  return {
    ...base,
    ...overrides,
    feeAccumulatorState: {
      ...base.feeAccumulatorState,
      ...(overrides.feeAccumulatorState ?? {}),
    },
    buybackBurnConfig: {
      ...base.buybackBurnConfig,
      ...(overrides.buybackBurnConfig ?? {}),
    },
  };
}

describe('BuybackBurn flush preflight guard', () => {
  it('M40-01: passes only when FeeAccumulator due and BuybackBurn readiness match the exact reserve flush path', () => {
    const report = createBuybackFlushPreflight(completeInput());

    expect(report.ok).toBe(true);
    expect(report.status).toBe('BUYBACK_FLUSH_PREFLIGHT_PASS');
    expect(report.amountNanotons).toBe(BUYBACK_FLUSH_ENVELOPE_NANOTONS.toString());
    expect(report.requiredCallerReserveNanotons).toBe(BUYBACK_FLUSH_CALLER_RESERVE_NANOTONS.toString());
    expect(report.blockers).toEqual([]);
  });

  it('M40-02: blocks the premature undeployed/not-sealed BuybackBurn flush scenario without changing contract state', () => {
    const report = createBuybackFlushPreflight(completeInput({
      buybackBurnConfig: {
        sealed: false,
        route_frozen: true,
        fee_bound: true,
        fee_accumulator_address: FEE_ACCUMULATOR,
      },
    }));

    expect(report.ok).toBe(false);
    expect(report.blockers).toContain('BUYBACKBURN_NOT_SEALED');
  });

  it('M40-03: blocks reserve flush before the STON.fi route is frozen', () => {
    const report = createBuybackFlushPreflight(completeInput({
      buybackBurnConfig: {
        sealed: true,
        route_frozen: false,
        fee_bound: true,
        fee_accumulator_address: FEE_ACCUMULATOR,
      },
    }));

    expect(report.ok).toBe(false);
    expect(report.blockers).toContain('BUYBACKBURN_ROUTE_NOT_FROZEN');
  });

  it('M40-04: blocks mismatched FeeAccumulator binding in both contracts', () => {
    const report = createBuybackFlushPreflight(completeInput({
      feeAccumulatorState: {
        buyback_due_ton: BUYBACK_FLUSH_ENVELOPE_NANOTONS.toString(),
        buyback_burn_address: 'EQWrongBuybackBurnM40',
      },
      buybackBurnConfig: {
        sealed: true,
        route_frozen: true,
        fee_bound: true,
        fee_accumulator_address: 'EQWrongFeeAccumulatorM40',
      },
    }));

    expect(report.ok).toBe(false);
    expect(report.blockers).toContain('FEE_ACCUMULATOR_BUYBACK_ADDRESS_MISMATCH');
    expect(report.blockers).toContain('BUYBACKBURN_FEE_ACCUMULATOR_MISMATCH');
  });

  it('M40-05: blocks non-envelope amounts and insufficient buyback due', () => {
    const report = createBuybackFlushPreflight(completeInput({
      amount: '50000000000',
      feeAccumulatorState: {
        buyback_due_ton: '50000000000',
        buyback_burn_address: BUYBACK_BURN,
      },
    }));

    expect(report.ok).toBe(false);
    expect(report.blockers).toContain('WRONG_FLUSH_AMOUNT');
  });

  it('M40-06: blocks exact envelope flush when FeeAccumulator has less than one envelope due', () => {
    const report = createBuybackFlushPreflight(completeInput({
      feeAccumulatorState: {
        buyback_due_ton: (BUYBACK_FLUSH_ENVELOPE_NANOTONS - 1n).toString(),
        buyback_burn_address: BUYBACK_BURN,
      },
    }));

    expect(report.ok).toBe(false);
    expect(report.blockers).toContain('INSUFFICIENT_BUYBACK_DUE');
  });
});
