import { describe, expect, it } from 'vitest';
import {
  createHybridKeyPair, exportPublicKeyBundle, encryptCompactPayloadBytes,
} from '../web/crypto/platho-crypto.mjs';


const PLAINTEXT = new TextEncoder().encode('the same message, addressed differently');

const HASHES = {
  header0Hash: `0x${'11'.repeat(32)}`,
  header1Hash: `0x${'22'.repeat(32)}`,
};

async function recipient() {
  const kp = await createHybridKeyPair();
  return { kp, bundle: exportPublicKeyBundle(kp) };
}

const FIXED_HEADER_BYTES = 8;

describe('a sealed body does not say who it is for', () => {
  it('ANON-01: no public key material of the recipient appears anywhere in the sealed body', async () => {
    const r = await recipient();
    const body = await encryptCompactPayloadBytes(PLAINTEXT, r.bundle, { hashes: HASHES });

    const hay = Buffer.from(body).toString('hex');
    const probes: Array<[string, Uint8Array]> = [
      ['x25519PublicKey', r.kp.x25519PublicKey],
      ['mlKem768PublicKey', r.kp.mlKem768PublicKey],
      ['mlKem768PublicKeyHash', r.kp.mlKem768PublicKeyHash],
    ];
    const leaked: string[] = [];
    for (const [name, bytes] of probes) {
      for (let i = 0; i + 8 <= bytes.length; i += 8) {
        const needle = Buffer.from(bytes.slice(i, i + 8)).toString('hex');
        if (hay.includes(needle)) { leaked.push(`${name} bytes ${i}..${i + 8}`); break; }
      }
    }
    expect(leaked, `recipient key material is echoed into the sealed body, so anyone holding the candidate's PUBLIC `
      + `bundle can test whether a message is addressed to them:\n${leaked.join('\n')}`).toEqual([]);

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

    let same = 0;
    for (let i = FIXED_HEADER_BYTES; i < first.length; i++) if (first[i] === second[i]) same += 1;
    const tail = first.length - FIXED_HEADER_BYTES;
    expect(same / tail, `${same}/${tail} bytes are identical across two seals to the same recipient — that constant `
      + 'links every message addressed to them').toBeLessThan(0.05);

    const slice = (b: Uint8Array, from: number, to: number) => Buffer.from(b.slice(from, to)).toString('hex');
    expect(slice(first, 8, 24), 'messageId must be fresh per seal').not.toBe(slice(second, 8, 24));
    expect(slice(first, 24, 36), 'AES-GCM nonce must be fresh per seal').not.toBe(slice(second, 24, 36));
    expect(slice(first, 36, 68), 'the X25519 ephemeral must be fresh per seal').not.toBe(slice(second, 36, 68));
    expect(slice(first, 68, 1156), 'the ML-KEM ciphertext must be fresh per seal').not.toBe(slice(second, 68, 1156));
  });
});
