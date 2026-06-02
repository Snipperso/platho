import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { runCapsuleHubStorageEconomics } from '../scripts/capsulehub_storage_economics';

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

describe('CapsuleHub canonical storage economics', () => {
  it('CAPHUB-ECON-01: canonical final cells retain non-fee storage reserve after publish fees', async () => {
    const report = await runCapsuleHubStorageEconomics(false);

    expect(report.status).toBe('PASS');
    expect(report.canonical_capsule_cells.header0_bytes).toBe(140);
    expect(report.canonical_capsule_cells.header1_bytes).toBe(30);
    expect(report.canonical_capsule_cells.hybrid_body_bytes).toBe(2228);
    expect(report.canonical_capsule_cells.hybrid_body_bytes_by_size_class).toEqual({
      '1K': 2228,
      '2K': 3252,
      '4K': 5300,
      '8K': 9396,
      '16K': 17588,
      '32K': 33972,
    });
    expect(report.canonical_capsule_cells.public_header_max_bytes).toBe(72);
    expect(report.canonical_capsule_cells.public_body_max_bytes).toBe(1024);
    expect(report.code_hashes.capsulehub).toBe(currentCodeHashes().CAPSULEHUB_CODE_HASH);
    expect(BigInt(report.minimum_retained_margin_nanotons)).toBe(1_000_000n);
    expect(BigInt(report.worst_margin_nanotons)).toBeGreaterThanOrEqual(BigInt(report.minimum_retained_margin_nanotons));
    expect(report.cases.map((item) => item.label)).toEqual([
      'VAULT_PRIVATE_HYBRID_1K',
      'VAULT_PRIVATE_HYBRID_2K',
      'VAULT_PRIVATE_HYBRID_4K',
      'VAULT_PRIVATE_HYBRID_8K',
      'VAULT_PRIVATE_HYBRID_16K',
      'VAULT_PRIVATE_HYBRID_32K',
      'VAULT_PUBLIC_POST',
    ]);
    for (const item of report.cases) {
      expect(BigInt(item.retained_margin_nanotons), item.label).toBeGreaterThanOrEqual(BigInt(report.minimum_retained_margin_nanotons));
      expect(item.aborted_count, item.label).toBe(0);
    }
  }, 30000);
});
