import { readFileSync } from 'fs';
import { Address } from '@ton/core';

export const BUYBACK_SPLIT_ENABLE_CALLER_RESERVE_NANOTONS = 2_000_000n;
export const VAULT_ACTIVITY_AIRDROP_DISCOUNT_UNLOCK_REMAINING_ATH = 15_000_000_000_000_000n;

export type BigintLike = bigint | number | string;

export interface EnableBuybackSplitPreflightInput {
  feeAccumulatorAddress: string;
  buybackBurnAddress: string;
  vaultState: {
    airdrop_remaining_ath: BigintLike;
  };
  feeAccumulatorState: {
    accumulated_ton: BigintLike;
    buyback_due_ton: BigintLike;
    buyback_split_enabled: boolean;
    buyback_burn_address?: string | null;
  };
  buybackBurnConfig: {
    sealed: boolean;
    route_frozen: boolean;
    genesis_config_hash: BigintLike;
    fee_bound?: boolean;
    fee_accumulator_address: string;
  };
  routeEvidence: {
    m20f_route_freeze_ready: boolean;
  };
}

export interface EnableBuybackSplitPreflightFailure {
  id: string;
  message: string;
}

export interface EnableBuybackSplitPreflightResult {
  document: 'PLATHO.V1.ENABLE_BUYBACK_SPLIT_PREFLIGHT';
  ok: boolean;
  status: 'ENABLE_BUYBACK_SPLIT_PREFLIGHT_PASS' | 'ENABLE_BUYBACK_SPLIT_PREFLIGHT_BLOCKED';
  requiredCallerReserveNanotons: string;
  activityAirdropRemainingAth: string;
  activityAirdropUnlockRemainingAth: string;
  accumulatedTonSweptToTreasuryNanotons: string;
  blockers: string[];
  failures: EnableBuybackSplitPreflightFailure[];
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

function addFailure(failures: EnableBuybackSplitPreflightFailure[], id: string, message: string) {
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
  failures: EnableBuybackSplitPreflightFailure[],
  field: string,
  value: string | null | undefined,
) {
  const workchain = addressWorkchain(value);
  if (workchain !== 0) {
    const idPrefix = field.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase();
    addFailure(
      failures,
      `${idPrefix}_NOT_BASECHAIN`,
      `${field} must be a basechain workchain 0 address before enabling buyback split.`,
    );
  }
}

export function createEnableBuybackSplitPreflight(input: EnableBuybackSplitPreflightInput): EnableBuybackSplitPreflightResult {
  const failures: EnableBuybackSplitPreflightFailure[] = [];
  let airdropRemaining = -1n;
  let accumulatedTon = -1n;
  let buybackDue = -1n;
  let genesisConfigHash = -1n;

  try {
    airdropRemaining = asBigInt(input.vaultState.airdrop_remaining_ath, 'vaultState.airdrop_remaining_ath');
  } catch (error) {
    addFailure(failures, 'INVALID_VAULT_AIRDROP_REMAINING', (error as Error).message);
  }

  try {
    accumulatedTon = asBigInt(input.feeAccumulatorState.accumulated_ton, 'feeAccumulatorState.accumulated_ton');
  } catch (error) {
    addFailure(failures, 'INVALID_ACCUMULATED_TON', (error as Error).message);
  }

  try {
    buybackDue = asBigInt(input.feeAccumulatorState.buyback_due_ton, 'feeAccumulatorState.buyback_due_ton');
  } catch (error) {
    addFailure(failures, 'INVALID_BUYBACK_DUE', (error as Error).message);
  }

  try {
    genesisConfigHash = asBigInt(input.buybackBurnConfig.genesis_config_hash, 'buybackBurnConfig.genesis_config_hash');
  } catch (error) {
    addFailure(failures, 'INVALID_BUYBACKBURN_GENESIS_CONFIG_HASH', (error as Error).message);
  }

  if (airdropRemaining !== -1n && airdropRemaining > VAULT_ACTIVITY_AIRDROP_DISCOUNT_UNLOCK_REMAINING_ATH) {
    addFailure(
      failures,
      'VAULT_AIRDROP_DISTRIBUTION_THRESHOLD_NOT_REACHED',
      'Vault activity airdrop remaining must be at or below the 15M ATH unlock threshold before buyback split is enabled.',
    );
  }

  if (input.feeAccumulatorState.buyback_split_enabled) {
    addFailure(failures, 'FEE_ACCUMULATOR_BUYBACK_SPLIT_ALREADY_ENABLED', 'FeeAccumulator.buyback_split_enabled must be false before the one-time enable action.');
  }

  if (buybackDue !== -1n && buybackDue !== 0n) {
    addFailure(failures, 'FEE_ACCUMULATOR_BUYBACK_DUE_NOT_ZERO', 'FeeAccumulator.buyback_due_ton must be zero before enabling the split.');
  }

  if (!sameAddress(input.feeAccumulatorState.buyback_burn_address, input.buybackBurnAddress)) {
    addFailure(
      failures,
      'FEE_ACCUMULATOR_BUYBACK_ADDRESS_MISMATCH',
      'FeeAccumulator.buyback_burn_address must equal the BuybackBurn target address.',
    );
  }

  if (!input.buybackBurnConfig.sealed) {
    addFailure(failures, 'BUYBACKBURN_NOT_SEALED', 'BuybackBurn must be sealed before buyback split is enabled.');
  }

  if (!input.buybackBurnConfig.route_frozen) {
    addFailure(failures, 'BUYBACKBURN_ROUTE_NOT_FROZEN', 'BuybackBurn route must be frozen before buyback split is enabled.');
  }

  if (genesisConfigHash !== -1n && genesisConfigHash !== 0n) {
    addFailure(
      failures,
      'BUYBACKBURN_LAUNCH_CONTROLLER_NOT_BURNED',
      'BuybackBurn.genesis_config_hash must be zero after the one-time route freeze before enabling buyback split.',
    );
  }

  if (input.buybackBurnConfig.fee_bound === false) {
    addFailure(failures, 'BUYBACKBURN_FEE_NOT_BOUND', 'BuybackBurn fee binding must be complete before enabling buyback split.');
  }

  if (!sameAddress(input.buybackBurnConfig.fee_accumulator_address, input.feeAccumulatorAddress)) {
    addFailure(
      failures,
      'BUYBACKBURN_FEE_ACCUMULATOR_MISMATCH',
      'BuybackBurn.fee_accumulator_address must equal the source FeeAccumulator address.',
    );
  }

  if (!input.routeEvidence.m20f_route_freeze_ready) {
    addFailure(
      failures,
      'M20F_ROUTE_FREEZE_EVIDENCE_NOT_READY',
      'M20F final route-freeze evidence must be accepted before enabling buyback split.',
    );
  }

  requireBasechainAddress(failures, 'feeAccumulatorAddress', input.feeAccumulatorAddress);
  requireBasechainAddress(failures, 'buybackBurnAddress', input.buybackBurnAddress);
  requireBasechainAddress(failures, 'feeAccumulatorState.buyback_burn_address', input.feeAccumulatorState.buyback_burn_address);
  requireBasechainAddress(failures, 'buybackBurnConfig.fee_accumulator_address', input.buybackBurnConfig.fee_accumulator_address);

  const blockers = failures.map((failure) => failure.id);
  return {
    document: 'PLATHO.V1.ENABLE_BUYBACK_SPLIT_PREFLIGHT',
    ok: failures.length === 0,
    status: failures.length === 0 ? 'ENABLE_BUYBACK_SPLIT_PREFLIGHT_PASS' : 'ENABLE_BUYBACK_SPLIT_PREFLIGHT_BLOCKED',
    requiredCallerReserveNanotons: BUYBACK_SPLIT_ENABLE_CALLER_RESERVE_NANOTONS.toString(),
    activityAirdropRemainingAth: airdropRemaining === -1n ? String(input.vaultState.airdrop_remaining_ath) : airdropRemaining.toString(),
    activityAirdropUnlockRemainingAth: VAULT_ACTIVITY_AIRDROP_DISCOUNT_UNLOCK_REMAINING_ATH.toString(),
    accumulatedTonSweptToTreasuryNanotons: accumulatedTon === -1n ? String(input.feeAccumulatorState.accumulated_ton) : accumulatedTon.toString(),
    blockers,
    failures,
  };
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: npm run buyback:enable-preflight -- <snapshot.json>');
    process.exit(2);
  }
  const input = JSON.parse(readFileSync(inputPath, 'utf8')) as EnableBuybackSplitPreflightInput;
  const report = createEnableBuybackSplitPreflight(input);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

if (require.main === module) main();
