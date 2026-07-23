import { describe, expect, it } from 'vitest';
import { runM17GasReserveSanity } from '../scripts/gas_reserve_m17';

describe('M17 gas/reserve sanity pass', () => {
  it('GAS-M17-01: implemented-subset money/publish flows stay below broad gas/fee sanity thresholds', async () => {
    const report = await runM17GasReserveSanity(false);
    expect(report.status).toBe('PASS');
    // 4 money/publish scenarios in clean-17: ATH transfer, ATH burn, FeeAccumulator, UsernameRegistry. The former
    // vaultScenario + capsuleHubScenario were removed with their contracts (Vault/CapsuleHub deleted 2026-07-21),
    // so the floor is 4, not the pre-clean-17 6.
    expect(report.scenarios.length).toBeGreaterThanOrEqual(4);
    for (const scenario of report.scenarios) {
      expect(scenario.status).toBe('ok');
      for (const op of scenario.operations) {
        expect(BigInt(op.total_fees_nanotons)).toBeLessThanOrEqual(100_000_000n);
        expect(BigInt(op.max_gas_used)).toBeLessThanOrEqual(100_000n);
      }
    }
  }, 30000);
});
