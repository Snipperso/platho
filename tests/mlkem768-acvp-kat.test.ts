import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ml_kem768 } from '../web/vendor/@noble/post-quantum/ml-kem.js';


type Vectors = {
  keyGen: Array<{ tcId: number; d: string; z: string; ek: string; dk: string }>;
  encapsulation: Array<{ tcId: number; ek: string; m: string; c: string; k: string }>;
  decapsulation: Array<{ tcId: number; dk: string; c: string; k: string; reason: string }>;
  source: Record<string, { url: string; sha256: string }>;
};

const V: Vectors = JSON.parse(readFileSync('artifacts/mlkem768_acvp_vectors.json', 'utf8'));
const bytes = (hex: string) => Uint8Array.from(Buffer.from(hex, 'hex'));
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex').toLowerCase();

describe('vendored ML-KEM-768 against the official NIST ACVP vectors', () => {
  it('KAT-01: key generation reproduces every expected key pair from its seed', () => {
    expect(V.keyGen.length, 'the artefact must carry the ACVP keyGen cases').toBe(25);
    const wrong: string[] = [];
    for (const t of V.keyGen) {
      const kp = ml_kem768.keygen(bytes(t.d + t.z));
      if (hex(kp.publicKey) !== t.ek.toLowerCase()) wrong.push(`tc${t.tcId}: encapsulation key`);
      if (hex(kp.secretKey) !== t.dk.toLowerCase()) wrong.push(`tc${t.tcId}: decapsulation key`);
    }
    expect(wrong, `the vendored ML-KEM computes different keys than FIPS-203:\n${wrong.join('\n')}`).toEqual([]);
  });

  it('KAT-02: encapsulation reproduces every expected ciphertext and shared secret', () => {
    expect(V.encapsulation.length).toBe(25);
    const wrong: string[] = [];
    for (const t of V.encapsulation) {
      const r = ml_kem768.encapsulate(bytes(t.ek), bytes(t.m));
      if (hex(r.cipherText) !== t.c.toLowerCase()) wrong.push(`tc${t.tcId}: ciphertext`);
      if (hex(r.sharedSecret) !== t.k.toLowerCase()) wrong.push(`tc${t.tcId}: shared secret`);
    }
    expect(wrong, `the vendored ML-KEM encapsulates differently than FIPS-203:\n${wrong.join('\n')}`).toEqual([]);
  });

  it('KAT-03: decapsulation matches NIST for valid AND deliberately modified ciphertexts', () => {
    expect(V.decapsulation.length).toBe(10);
    const modified = V.decapsulation.filter((t) => /modified/i.test(t.reason));
    expect(modified.length, 'the implicit-rejection cases are the point of this one — the artefact must keep them')
      .toBeGreaterThan(0);

    const wrong: string[] = [];
    for (const t of V.decapsulation) {
      const k = hex(ml_kem768.decapsulate(bytes(t.c), bytes(t.dk)));
      if (k !== t.k.toLowerCase()) wrong.push(`tc${t.tcId} (${t.reason}): expected ${t.k.toLowerCase()}, got ${k}`);
    }
    expect(wrong, `the vendored ML-KEM decapsulates differently than FIPS-203. A mismatch on a "modified ciphertext" `
      + `case means the implicit-rejection path is wrong, and that path is what keeps decapsulation from being a `
      + `decryption oracle:\n${wrong.join('\n')}`).toEqual([]);
  });

  it('KAT-04: the vectors still declare where they came from', () => {
    const sources = Object.values(V.source ?? {});
    expect(sources.length, 'the artefact must record its sources').toBeGreaterThan(1);
    for (const s of sources) {
      expect(s.url, 'each source must name the NIST repository it was fetched from').toMatch(/usnistgov\/ACVP-Server/);
      expect(s.sha256, 'each source must carry the sha256 of the original download').toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
