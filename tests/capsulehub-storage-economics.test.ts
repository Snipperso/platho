import { describe, expect, it } from 'vitest';
import { runCapsuleHubStorageEconomics } from '../scripts/capsulehub_storage_economics';

describe('CapsuleHub canonical storage economics', () => {
  it('CAPHUB-ECON-01: canonical final cells retain non-fee storage reserve after publish fees', async () => {
    const report = await runCapsuleHubStorageEconomics(false);

    expect(report.status).toBe('PASS');
    expect(report.canonical_capsule_cells.header0_bytes).toBe(140);
    expect(report.canonical_capsule_cells.header1_bytes).toBe(30);
    expect(report.canonical_capsule_cells.standard_body_bytes).toBe(1140);
    expect(report.canonical_capsule_cells.hybrid_body_bytes).toBe(2228);
    expect(report.canonical_capsule_cells.public_header_max_bytes).toBe(72);
    expect(report.canonical_capsule_cells.public_body_max_bytes).toBe(1024);
    expect(report.cases.length).toBeGreaterThanOrEqual(3);
    for (const item of report.cases) {
      expect(BigInt(item.retained_margin_nanotons), item.label).toBeGreaterThanOrEqual(0n);
      expect(item.aborted_count, item.label).toBe(0);
    }
  }, 30000);
});
