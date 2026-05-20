import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

describe('code hash artifact hygiene', () => {
  it('marks milestone-specific CURRENT_CODE_HASHES artifacts as deprecated historical evidence', () => {
    for (const path of [
      'artifacts/CURRENT_CODE_HASHES_M19G.txt',
      'artifacts/CURRENT_CODE_HASHES_M19H.txt',
    ]) {
      const text = readFileSync(path, 'utf8');

      expect(text).toContain('DEPRECATED_HISTORICAL_ARTIFACT=DO_NOT_USE_AS_CURRENT_RELEASE_EVIDENCE');
      expect(text).toContain('CANONICAL_CURRENT_CODE_HASHES_ARTIFACT=artifacts/CURRENT_CODE_HASHES.txt');
    }
  });
});
