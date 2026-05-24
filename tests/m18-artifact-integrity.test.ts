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
    expect(report.manifest.blockers_before_final_genesis).toContain('ATH_TREASURY_SUPPLY_MUST_BE_DEPLOYED_WITH_ONE_SHOT_GENESIS_CREDIT');
    expect(report.manifest.blockers_before_final_genesis).toContain('VAULT_ACTIVITY_AIRDROP_ALLOCATION_MUST_BE_FUNDED_IN_OFFICIAL_VAULT_ATH_WALLET_BEFORE_FINAL_GENESIS');
    expect(report.manifest.blockers_before_final_genesis.join('\n')).not.toMatch(/STONFI/);
  }, 30000);
});
