import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ml_kem768 } from '../web/vendor/@noble/post-quantum/ml-kem.js';

// KNOWN ANSWER TESTS against NIST's own vectors — the piece the earlier crypto review could not do, because the
// vectors were present neither in the npm package nor in this repository.
//
// Everything checked before this was a PROPERTY: sizes are right, the round trip closes, a tampered ciphertext is
// rejected implicitly and deterministically. All necessary, none sufficient — an implementation can satisfy every
// one of them and still compute a different function than FIPS-203 defines, at which point Platho's messages are
// encrypted with something that merely resembles ML-KEM and interoperates with nothing.
//
// These vectors close that. artifacts/mlkem768_acvp_vectors.json is the ML-KEM-768 subset of the official ACVP
// files, carrying the source URL and the sha256 of each ORIGINAL download so the extract is auditable back to NIST.
//
// ON THE SUPPLY-CHAIN QUESTION the vectors themselves raise: they are DATA and are never executed, so the worst a
// corrupted file can do is make this test fail. The dangerous direction — a doctored vector that makes a WRONG
// implementation pass — would have to be internally consistent with some other correct-looking KEM across 60 cases
// including the modified-ciphertext ones, which is not something that happens by accident and gains nothing
// deliberately. The recorded hashes make either case checkable rather than trusted.
//
// The 5 "modified ciphertext" decapsulation cases are the ones worth naming: they pin the IMPLICIT REJECTION output
// against the standard's expected value, and that path is what the whole anonymity argument rests on (an
// implementation that threw there would hand an observer a decryption oracle).

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
      // FIPS-203 seeds keygen with d || z. The other order is not merely wrong output, it is a different function —
      // recorded in the artefact because getting it backwards silently produces valid-looking keys.
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
    // A vector file with no provenance is indistinguishable from one somebody wrote to make this suite pass.
    const sources = Object.values(V.source ?? {});
    expect(sources.length, 'the artefact must record its sources').toBeGreaterThan(1);
    for (const s of sources) {
      expect(s.url, 'each source must name the NIST repository it was fetched from').toMatch(/usnistgov\/ACVP-Server/);
      expect(s.sha256, 'each source must carry the sha256 of the original download').toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
