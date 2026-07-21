import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { runProfileRegistryStorageEconomics } from '../scripts/profile_registry_storage_economics';

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function currentCodeHashes(): Record<string, string> {
  return Object.fromEntries(readFileSync('artifacts/CURRENT_CODE_HASHES.txt', 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line.includes('='))
    .map((line) => {
      const [key, value] = line.split('=', 2);
      return [key, value];
    }));
}

describe('ProfileRegistry storage economics', () => {
  it('PROFILE-STORAGE-01: avatar update paths retain permanent pointer storage endowment', async () => {
    const report = await runProfileRegistryStorageEconomics(false);

    expect(report.status).toBe('PASS');
    expect(report.code_hashes.profile_registry).toBe(currentCodeHashes().PROFILE_REGISTRY_CODE_HASH);
    expect(report.cases.map((item) => item.label)).toEqual([
      // Renamed from VAULT_*: the payer-auth freeze made avatars DIRECT-PAY (owner_wallet == payer_wallet, gate
      // 21163). No Vault stands in the middle any more — that is what makes the registry durable across redeploys.
      'DIRECT_FIRST_AVATAR',
      'DIRECT_REPEAT_AVATAR',
      'DIRECT_MANY_OWNERS_12',
      'DIRECT_MANY_UPDATES_ONE_OWNER_10',
    ]);
    for (const item of report.cases) {
      expect(BigInt(item.raw_balance_delta_nanotons), item.label)
        .toBeGreaterThanOrEqual(BigInt(item.expected_permanent_endowment_nanotons));
      expect(BigInt(item.retained_margin_vs_permanent_endowment_nanotons), item.label)
        .toBeGreaterThanOrEqual(BigInt(report.constants.minimum_storage_margin_nanotons));
      // THE CEILING. Per-profile state is what capped this contract at 13,076 profiles, in the ACTION phase,
      // with COMPUTE reporting exit 0 — so nothing would have gone red. This is the assertion that now would.
      expect(Number(item.data_cells_per_owner), `${item.label}: the registry must not grow with profiles`).toBe(0);
      // In-flight writes settle within the same message chain; a residue here would be a permanent 3-cell leak
      // per PAYMENT, which is a second, independent consumer of the same 65536-cell budget.
      expect(BigInt(item.pending_avatar_write_count), item.label).toBe(0n);
    }
  }, 30000);

  it('PROFILE-STORAGE-02: checked artifact is tied to the current ProfileRegistry code hash', () => {
    const report = readJson('artifacts/profile_registry_storage_economics_report.json');

    expect(report.status).toBe('PASS');
    expect(report.code_hashes.profile_registry).toBe(currentCodeHashes().PROFILE_REGISTRY_CODE_HASH);
    expect(BigInt(report.constants.minimum_storage_margin_nanotons)).toBe(1_000_000n);
    expect(BigInt(report.worst_margin_vs_permanent_endowment_nanotons))
      .toBeGreaterThanOrEqual(BigInt(report.constants.minimum_storage_margin_nanotons));
  });
});
