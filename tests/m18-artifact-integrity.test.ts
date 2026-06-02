import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { runM18ArtifactIntegrity } from '../scripts/artifact_integrity_m18';

describe('M18 artifact integrity and reproducibility lock', () => {
  it('M18-ARTIFACT-01: generated artifacts, vectors, code hashes, and implemented-subset manifest match the current build', async () => {
    const report = await runM18ArtifactIntegrity(false);
    const storedReport = JSON.parse(readFileSync('artifacts/m18_artifact_integrity_report.json', 'utf8'));

    expect(report.status).toBe('PASS');
    expect(report.contract_code_changed).toBe(true);
    expect(report.functional_surface_added).toBe(true);
    expect(Object.values(report.checks).every(Boolean)).toBe(true);
    expect(Object.values(report.vector_checks).every(Boolean)).toBe(true);
    expect(report.code_hashes.MARKET_STABILITY_SELLER_CODE_HASH.match).toBe(true);
    expect(report.manifest.match).toBe(true);
    expect(['FINAL_GENESIS', 'IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS']).toContain(report.manifest.status);
    if (report.manifest.status === 'FINAL_GENESIS') {
      expect(readFileSync('artifacts/MAINNET_GENESIS_VERIFIED.txt', 'utf8').trim().toLowerCase()).toBe('true');
      expect(report.manifest.blockers_before_final_genesis).toEqual([]);
    } else {
      expect(report.manifest.blockers_before_final_genesis).toContain('ATH_TREASURY_SUPPLY_MUST_BE_DEPLOYED_WITH_ONE_SHOT_GENESIS_CREDIT');
      expect(report.manifest.blockers_before_final_genesis).toContain('VAULT_ACTIVITY_AIRDROP_ALLOCATION_MUST_BE_FUNDED_IN_OFFICIAL_VAULT_ATH_WALLET_BEFORE_FINAL_GENESIS');
      expect(report.manifest.blockers_before_final_genesis.join('\n')).not.toMatch(/STONFI/);
    }

    expect(storedReport.status).toBe(report.status);
    expect(storedReport.manifest.stored_hash).toBe(report.manifest.stored_hash);
    expect(storedReport.manifest.rebuilt_hash).toBe(report.manifest.rebuilt_hash);
    expect(storedReport.manifest.match).toBe(report.manifest.match);
    for (const key of Object.keys(report.code_hashes)) {
      expect(storedReport.code_hashes[key].built, `${key} stored M18 built hash must not be stale`).toBe(report.code_hashes[key].built);
      expect(storedReport.code_hashes[key].pinned, `${key} stored M18 pinned hash must not be stale`).toBe(report.code_hashes[key].pinned);
      expect(storedReport.code_hashes[key].current_file, `${key} stored M18 current_file hash must not be stale`).toBe(report.code_hashes[key].current_file);
      expect(storedReport.code_hashes[key].match, `${key} stored M18 match flag must not be stale`).toBe(report.code_hashes[key].match);
    }
  }, 30000);
});
