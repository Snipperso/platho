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
      'VAULT_FIRST_AVATAR',
      'VAULT_REPEAT_AVATAR',
      'VAULT_MANY_OWNERS_12',
      'VAULT_MANY_UPDATES_ONE_OWNER_10',
    ]);
    for (const item of report.cases) {
      expect(BigInt(item.raw_balance_delta_nanotons), item.label)
        .toBeGreaterThanOrEqual(BigInt(item.expected_permanent_endowment_nanotons));
      expect(BigInt(item.retained_margin_vs_permanent_endowment_nanotons), item.label)
        .toBeGreaterThanOrEqual(BigInt(report.constants.minimum_storage_margin_nanotons));
      expect(BigInt(item.avatar_record_count), item.label).toBeGreaterThanOrEqual(BigInt(item.updates));
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
