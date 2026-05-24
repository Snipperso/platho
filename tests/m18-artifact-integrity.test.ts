import { describe, expect, it } from 'vitest';
import { runM18ArtifactIntegrity } from '../scripts/artifact_integrity_m18';

describe('M18 artifact integrity and reproducibility lock', () => {
  it('M18-ARTIFACT-01: generated artifacts, vectors, code hashes, and implemented-subset manifest match the current build', async () => {
    const report = await runM18ArtifactIntegrity(false);
    expect(report.status).toBe('PASS');
    expect(report.contract_code_changed).toBe(true);
    expect(report.functional_surface_added).toBe(true);
    expect(Object.values(report.checks).every(Boolean)).toBe(true);
    expect(Object.values(report.vector_checks).every(Boolean)).toBe(true);
    expect(report.code_hashes.MARKET_STABILITY_SELLER_CODE_HASH.match).toBe(true);
    expect(report.manifest.match).toBe(true);
    expect(report.manifest.status).toBe('IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS');
    expect(report.manifest.blockers_before_final_genesis.join('\n')).toMatch(/STONFI/);
  }, 30000);
});
