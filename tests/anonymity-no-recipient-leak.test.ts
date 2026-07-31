import { describe, expect, it } from 'vitest';
import {
  createHybridKeyPair, exportPublicKeyBundle, encryptCompactPayloadBytes,
} from '../web/crypto/platho-crypto.mjs';

// ANONYMITY OF THE SEALED BODY — the property an external ANO-CCA review would be asked to confirm, reduced to the
// part that can be MEASURED rather than argued.
//
// The theory is in good shape and is not what this file tests. ML-KEM ciphertexts are pseudorandom, so they do not
// name a public key; the hybrid KDF is HKDF over concat(X25519_ss, MLKEM_ss) with the transcript — which covers BOTH
// the ephemeral point and the KEM ciphertext — in salt and info, so the seal stands while either half stands; the
// contract accepts only the hybrid suite (KeyShard gate 22107), so the plaintext suite byte is constant across all
// real traffic and cannot partition the anonymity set; and INTRO robustness does not rest on AES-GCM being
// key-committing (it is not) but on the signed transcript binding keyId_B, which the recipient rebuilds with THEIR
// OWN keyId, so a transcript signed for someone else fails to verify.
//
// What theory cannot protect against is somebody later adding a recipient HINT to the body — a key id, a truncated
// hash of the recipient's public key, a bucket index — for perfectly good reasons of scan efficiency. That is the
// single most likely way this property dies, it looks harmless in review, and it hands an observer exactly the test
// the design exists to deny: "is this message for Alice?" answerable from public data alone.
//
// So these tests hold the observable form of the property: the sealed bytes must be uncorrelated with the recipient,
// and repeated seals to the SAME recipient must share nothing beyond the fixed header.

const PLAINTEXT = new TextEncoder().encode('the same message, addressed differently');

// The AAD needs the two chain-header hashes. Held CONSTANT across every seal below on purpose: it removes a source
// of difference, so anything that still varies varies because of the KEM and the ephemeral — and anything that does
// NOT vary is a genuine per-recipient constant rather than an artefact of the fixture.
const HASHES = {
  header0Hash: `0x${'11'.repeat(32)}`,
  header1Hash: `0x${'22'.repeat(32)}`,
};

async function recipient() {
  const kp = await createHybridKeyPair();
  return { kp, bundle: exportPublicKeyBundle(kp) };
}

/** The header bytes that are the same for every hybrid seal by construction: magic, version, suite, flags, pad. */
const FIXED_HEADER_BYTES = 8;

describe('a sealed body does not say who it is for', () => {
  it('ANON-01: no public key material of the recipient appears anywhere in the sealed body', async () => {
    const r = await recipient();
    const body = await encryptCompactPayloadBytes(PLAINTEXT, r.bundle, { hashes: HASHES });

    // An observer holds candidate PUBLIC bundles. If any run of recipient public key bytes were echoed into the
    // body — even a short prefix used as a "hint" — that run is a membership test against every candidate.
    const hay = Buffer.from(body).toString('hex');
    const probes: Array<[string, Uint8Array]> = [
      ['x25519PublicKey', r.kp.x25519PublicKey],
      ['mlKem768PublicKey', r.kp.mlKem768PublicKey],
      ['mlKem768PublicKeyHash', r.kp.mlKem768PublicKeyHash],
    ];
    const leaked: string[] = [];
    for (const [name, bytes] of probes) {
      // 8 bytes is far below anything useful as a key and far above coincidence in a body of this size.
      for (let i = 0; i + 8 <= bytes.length; i += 8) {
        const needle = Buffer.from(bytes.slice(i, i + 8)).toString('hex');
        if (hay.includes(needle)) { leaked.push(`${name} bytes ${i}..${i + 8}`); break; }
      }
    }
    expect(leaked, `recipient key material is echoed into the sealed body, so anyone holding the candidate's PUBLIC `
      + `bundle can test whether a message is addressed to them:\n${leaked.join('\n')}`).toEqual([]);

    // The keyId is a string derived from those keys; check it too, in both of its encodings.
    expect(hay.includes(Buffer.from(r.kp.keyId, 'utf8').toString('hex')),
      'the recipient keyId appears verbatim in the sealed body').toBe(false);
  });

  it('ANON-02: two seals of the same plaintext to DIFFERENT recipients share nothing but the fixed header', async () => {
    const a = await recipient();
    const b = await recipient();
    const bodyA = await encryptCompactPayloadBytes(PLAINTEXT, a.bundle, { hashes: HASHES });
    const bodyB = await encryptCompactPayloadBytes(PLAINTEXT, b.bundle, { hashes: HASHES });

    expect(bodyA.length, 'equal plaintexts must seal to equal lengths, or length alone identifies the recipient')
      .toBe(bodyB.length);

    // Byte-for-byte agreement past the fixed header would mean some field is a function of the recipient (or worse,
    // a constant). Freshness makes genuine agreement astronomically unlikely; a handful of coincidental matches in
    // ~1.1 KB is expected, so this bounds them rather than demanding zero.
    let same = 0;
    for (let i = FIXED_HEADER_BYTES; i < bodyA.length; i++) if (bodyA[i] === bodyB[i]) same += 1;
    const tail = bodyA.length - FIXED_HEADER_BYTES;
    expect(same / tail, `${same}/${tail} bytes agree between seals to different recipients — at 1/256 expected, this `
      + 'means a field is derived from something the two seals share').toBeLessThan(0.05);
  });

  it('ANON-03: two seals to the SAME recipient are unlinkable — no per-recipient constant', async () => {
    const r = await recipient();
    const first = await encryptCompactPayloadBytes(PLAINTEXT, r.bundle, { hashes: HASHES });
    const second = await encryptCompactPayloadBytes(PLAINTEXT, r.bundle, { hashes: HASHES });

    // This is the sharper half of ANON-01: a hint need not be the recipient's key, only a stable function of it.
    // Anything constant across two seals to one recipient links every message that person ever receives.
    let same = 0;
    for (let i = FIXED_HEADER_BYTES; i < first.length; i++) if (first[i] === second[i]) same += 1;
    const tail = first.length - FIXED_HEADER_BYTES;
    expect(same / tail, `${same}/${tail} bytes are identical across two seals to the same recipient — that constant `
      + 'links every message addressed to them').toBeLessThan(0.05);

    // And the freshness that guarantees it: ephemeral point, KEM ciphertext, nonce and message id must all move.
    const slice = (b: Uint8Array, from: number, to: number) => Buffer.from(b.slice(from, to)).toString('hex');
    expect(slice(first, 8, 24), 'messageId must be fresh per seal').not.toBe(slice(second, 8, 24));
    expect(slice(first, 24, 36), 'AES-GCM nonce must be fresh per seal').not.toBe(slice(second, 24, 36));
    expect(slice(first, 36, 68), 'the X25519 ephemeral must be fresh per seal').not.toBe(slice(second, 36, 68));
    expect(slice(first, 68, 1156), 'the ML-KEM ciphertext must be fresh per seal').not.toBe(slice(second, 68, 1156));
  });
});
