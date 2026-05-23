import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const SPEC_FILES = [
  'artifacts/platho_v1_spec_v0_3_3_deployment_ath_binding.md',
  'artifacts/PLATHO_CAPSULE_V1_FINAL_SPEC.md',
  'artifacts/M27_INTERFACE_DECISIONS.md',
  'artifacts/capsulehub_threat_model_checklist.md',
  'web/CRYPTO_PROTOCOL.md',
  'web/NO_BACKEND_ARCHITECTURE.md',
];

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('v1 on-chain message source of truth', () => {
  it('SPEC-MSG-SOURCE-01: v1 requires retrievable encrypted payload cells, not hash-only delivery', () => {
    for (const path of SPEC_FILES) {
      const text = read(path);
      expect(text, path).toMatch(/retrievable (encrypted )?(binary )?(on-chain )?payload cells|encrypted payload cells (stored by `CapsuleHub`|on-chain)|body_cell/i);
      expect(text, path).not.toMatch(/intentionally stores counter\/anchor metadata only/i);
    }
  });

  it('SPEC-MSG-SOURCE-02: v1 pins the binary capsule byte layout and useful capacity', () => {
    for (const path of SPEC_FILES) {
      const text = read(path);
      expect(text, path).toMatch(/PH0B/);
      expect(text, path).toMatch(/PH1B/);
      expect(text, path).toMatch(/140 bytes|140-byte/);
      expect(text, path).toMatch(/30 bytes|30-byte/);
      expect(text, path).toMatch(/1024[- ]byte|1024 useful (text )?bytes|1024-byte user payload slot/);
      expect(text, path).toMatch(/one encrypted 1024-byte|exactly one encrypted 1024-byte|exactly one 1024-byte|one 1024-byte useful payload slot/i);
      expect(text, path).not.toMatch(/14,336|14336|14 blocks|14 content blocks/i);
    }
  });
});
