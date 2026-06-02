import { readdirSync, readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

function walkArtifactFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      out.push(...walkArtifactFiles(path));
    } else if (entry.isFile()) {
      out.push(path);
    }
  }
  return out;
}

describe('code hash artifact hygiene', () => {
  it('marks milestone-specific CURRENT_CODE_HASHES artifacts as deprecated historical evidence', () => {
    for (const path of [
      'artifacts/CURRENT_CODE_HASHES_M19G.txt',
      'artifacts/CURRENT_CODE_HASHES_M19H.txt',
      'artifacts/HASH_CODES_M14_OUTPUT.txt',
      'artifacts/HASH_CODES_M15_OUTPUT.txt',
      'artifacts/HASH_CODES_M16_OUTPUT.txt',
      'artifacts/HASH_CODES_M18_OUTPUT.txt',
      'artifacts/HASH_CODES_M20Y_OUTPUT.txt',
      'artifacts/HASH_CODES_M21A_OUTPUT.txt',
    ]) {
      const text = readFileSync(path, 'utf8');

      expect(text).toContain('DEPRECATED_HISTORICAL_ARTIFACT=DO_NOT_USE_AS_CURRENT_RELEASE_EVIDENCE');
      expect(text).toContain('CANONICAL_CURRENT_CODE_HASHES_ARTIFACT=artifacts/CURRENT_CODE_HASHES.txt');
    }

    expect(readFileSync('artifacts/M21A_CHUNKED_FULL_MATRIX_SUMMARY.txt', 'utf8')).toContain(
      'HISTORICAL ONLY. SUPERSEDED. DO NOT USE AS CURRENT FULL-SUITE RELEASE EVIDENCE.',
    );
  });

  it('marks accepted non-blocking findings explicitly instead of leaving live open findings', () => {
    const matrix = JSON.parse(readFileSync('artifacts/audit_findings_matrix.json', 'utf8'));
    const acceptedRisks = new Set(
      matrix.acceptedNonBlockingReleaseRisks.map((risk: { id: string }) => risk.id),
    );
    const openFindings = matrix.findings.filter((finding: { status: string }) => finding.status === 'ACKNOWLEDGED_OPEN');
    const unft = matrix.findings.find((finding: { id: string }) => finding.id === 'UNFT-01');
    const markdown = readFileSync('artifacts/AUDIT_FINDINGS_MATRIX.md', 'utf8');

    expect(openFindings).toEqual([]);
    expect(acceptedRisks.has('UNFT-01')).toBe(true);
    expect(unft.status).toBe('ACCEPTED_NON_BLOCKING_DIRECT_CALLER_FUNDED_FOOTGUN');
    expect(unft.productionBlocker).toBe(false);
    expect(markdown).not.toMatch(/Acknowledged \/ open/);
    expect(markdown).toContain('Accepted non-blocking / production_blocker=false');
  });

  it('marks stale failure-like EXIT artifacts as deprecated historical evidence', () => {
    const marker = 'DEPRECATED_HISTORICAL_ARTIFACT=DO_NOT_USE_AS_CURRENT_RELEASE_EVIDENCE';
    const exitFiles = walkArtifactFiles('artifacts').filter((path) => path.endsWith('EXIT.txt'));
    const failureLike = exitFiles.filter((path) => {
      const text = readFileSync(path, 'utf8');
      return /^\s*1\s*$/m.test(text)
        || /HISTORICAL_EXIT_CODE=1|FAIL|ERROR|TIMEOUT|PASS_REPORTED_.*TIMEOUT/i.test(text);
    });

    expect(failureLike).toEqual(
      expect.arrayContaining([
        'artifacts/M20Y_CHUNK_05_EXIT.txt',
        'artifacts/NPM_TEST_FULL_SUITE_M15_EXIT.txt',
        'artifacts/NPM_TEST_FULL_SUITE_M16_EXIT.txt',
      ]),
    );

    for (const path of failureLike) {
      const text = readFileSync(path, 'utf8');
      expect(text, path).toContain(marker);
      expect(text, path).toContain('SUPERSEDED_BY=artifacts/CURRENT_FULL_TEST_SUMMARY.json');
    }
  });
});
