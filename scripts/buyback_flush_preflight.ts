import { readFileSync } from 'fs';
import { Address } from '@ton/core';

export const BUYBACK_FLUSH_ENVELOPE_NANOTONS = 51_050_000_000n;
export const BUYBACK_FLUSH_CALLER_RESERVE_NANOTONS = 7_000_000n;

export type BigintLike = bigint | number | string;

export interface BuybackFlushPreflightInput {
  amount: BigintLike;
  feeAccumulatorAddress: string;
  buybackBurnAddress: string;
  feeAccumulatorState: {
    buyback_due_ton: BigintLike;
    buyback_burn_address?: string | null;
  };
  buybackBurnConfig: {
    sealed: boolean;
    route_frozen: boolean;
    fee_bound?: boolean;
    fee_accumulator_address: string;
  };
  routeEvidence: {
    m20f_route_freeze_ready: boolean;
  };
}

export interface BuybackFlushPreflightFailure {
  id: string;
  message: string;
}

export interface BuybackFlushPreflightResult {
  document: 'PLATHO.V1.BUYBACK_FLUSH_PREFLIGHT';
  ok: boolean;
  status: 'BUYBACK_FLUSH_PREFLIGHT_PASS' | 'BUYBACK_FLUSH_PREFLIGHT_BLOCKED';
  amountNanotons: string;
  requiredCallerReserveNanotons: string;
  blockers: string[];
  failures: BuybackFlushPreflightFailure[];
}

function asBigInt(value: BigintLike, field: string): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${field} must be a non-negative safe integer`);
    }
    return BigInt(value);
  }
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${field} must be a non-negative integer string`);
  }
  return BigInt(normalized);
}

function normalizeAddress(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function sameAddress(left: string | null | undefined, right: string | null | undefined): boolean {
  return normalizeAddress(left) === normalizeAddress(right);
}

function addFailure(failures: BuybackFlushPreflightFailure[], id: string, message: string) {
  failures.push({ id, message });
}

function addressWorkchain(value: string | null | undefined): number | null {
  const normalized = normalizeAddress(value);
  if (!normalized) return null;
  try {
    return Address.parse(normalized).workChain;
  } catch {
    return null;
  }
}

function requireBasechainAddress(
  failures: BuybackFlushPreflightFailure[],
  field: string,
  value: string | null | undefined,
) {
  const workchain = addressWorkchain(value);
  if (workchain !== 0) {
    const idPrefix = field.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase();
    addFailure(
      failures,
      `${idPrefix}_NOT_BASECHAIN`,
      `${field} must be a basechain workchain 0 address for the current buyback flush envelope.`,
    );
  }
}

export function createBuybackFlushPreflight(input: BuybackFlushPreflightInput): BuybackFlushPreflightResult {
  const failures: BuybackFlushPreflightFailure[] = [];
  let amount = -1n;
  let buybackDue = -1n;

  try {
    amount = asBigInt(input.amount, 'amount');
  } catch (error) {
    addFailure(failures, 'INVALID_FLUSH_AMOUNT', (error as Error).message);
  }

  try {
    buybackDue = asBigInt(input.feeAccumulatorState.buyback_due_ton, 'feeAccumulatorState.buyback_due_ton');
  } catch (error) {
    addFailure(failures, 'INVALID_BUYBACK_DUE', (error as Error).message);
  }

  if (amount !== -1n && amount !== BUYBACK_FLUSH_ENVELOPE_NANOTONS) {
    addFailure(
      failures,
      'WRONG_FLUSH_AMOUNT',
      `FlushBuybackDue.amount must be exactly ${BUYBACK_FLUSH_ENVELOPE_NANOTONS.toString()} nanotons.`,
    );
  }

  if (amount !== -1n && buybackDue !== -1n && buybackDue < amount) {
    addFailure(
      failures,
      'INSUFFICIENT_BUYBACK_DUE',
      'FeeAccumulator.buyback_due_ton must cover the exact buyback funding envelope before flush.',
    );
  }

  if (!sameAddress(input.feeAccumulatorState.buyback_burn_address, input.buybackBurnAddress)) {
    addFailure(
      failures,
      'FEE_ACCUMULATOR_BUYBACK_ADDRESS_MISMATCH',
      'FeeAccumulator.buyback_burn_address must equal the BuybackBurn target address.',
    );
  }

  if (!input.buybackBurnConfig.sealed) {
    addFailure(failures, 'BUYBACKBURN_NOT_SEALED', 'BuybackBurn must be sealed before FlushBuybackDue is attempted.');
  }

  if (!input.buybackBurnConfig.route_frozen) {
    addFailure(failures, 'BUYBACKBURN_ROUTE_NOT_FROZEN', 'BuybackBurn route_frozen must be true before accepting buyback reserve.');
  }

  if (!input.routeEvidence?.m20f_route_freeze_ready) {
    addFailure(
      failures,
      'M20F_ROUTE_FREEZE_EVIDENCE_NOT_READY',
      'M20F final route-freeze evidence must be accepted before any production buyback reserve flush.',
    );
  }

  if (input.buybackBurnConfig.fee_bound === false) {
    addFailure(failures, 'BUYBACKBURN_FEE_NOT_BOUND', 'BuybackBurn fee binding must be complete before reserve flush.');
  }

  if (!sameAddress(input.buybackBurnConfig.fee_accumulator_address, input.feeAccumulatorAddress)) {
    addFailure(
      failures,
      'BUYBACKBURN_FEE_ACCUMULATOR_MISMATCH',
      'BuybackBurn.fee_accumulator_address must equal the source FeeAccumulator address.',
    );
  }

  requireBasechainAddress(failures, 'feeAccumulatorAddress', input.feeAccumulatorAddress);
  requireBasechainAddress(failures, 'buybackBurnAddress', input.buybackBurnAddress);
  requireBasechainAddress(failures, 'feeAccumulatorState.buyback_burn_address', input.feeAccumulatorState.buyback_burn_address);
  requireBasechainAddress(failures, 'buybackBurnConfig.fee_accumulator_address', input.buybackBurnConfig.fee_accumulator_address);

  const blockers = failures.map((failure) => failure.id);
  return {
    document: 'PLATHO.V1.BUYBACK_FLUSH_PREFLIGHT',
    ok: failures.length === 0,
    status: failures.length === 0 ? 'BUYBACK_FLUSH_PREFLIGHT_PASS' : 'BUYBACK_FLUSH_PREFLIGHT_BLOCKED',
    amountNanotons: amount === -1n ? String(input.amount) : amount.toString(),
    requiredCallerReserveNanotons: BUYBACK_FLUSH_CALLER_RESERVE_NANOTONS.toString(),
    blockers,
    failures,
  };
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: npm run buyback:flush-preflight -- <snapshot.json>');
    process.exit(2);
  }
  const input = JSON.parse(readFileSync(inputPath, 'utf8')) as BuybackFlushPreflightInput;
  const report = createBuybackFlushPreflight(input);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

if (require.main === module) main();
