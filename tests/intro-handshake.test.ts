import { describe, it, expect } from 'vitest';
import { createMessagingIdentity, randomBytes } from '../web/crypto/platho-crypto.mjs';
import { ml_kem768 } from '../web/vendor/@noble/post-quantum/ml-kem.js';
import {
  buildIntroHandshake,
  openIntroHandshake,
  serializeIntroPayload,
  parseIntroPayload,
  buildIntroTranscript,
  signIntroTranscript,
  verifyIntroTranscript,
  INTRO_TRANSCRIPT_DOMAIN,
  INTRO_PAYLOAD_MAGIC,
  INTRO_NONCE_BYTES,
  ED25519_SIGNATURE_BYTES,
} from '../web/crypto/intro-handshake.mjs';

const hex = (b: Uint8Array): string => Buffer.from(b).toString('hex');
const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
const fromUtf8 = (b: Uint8Array): string => new TextDecoder().decode(b);

async function pair() {
  const A: any = await createMessagingIdentity();
  const B: any = await createMessagingIdentity();
  const r = randomBytes(32);
  const viewTag = 0x1234;
  const bodyKemCiphertext = ml_kem768.encapsulate(B.encryptionKeyPair.mlKem768PublicKey).cipherText as Uint8Array;
  const recipientBundle = {
    keyId: B.encryptionKeyPair.keyId,
    x25519PublicKey: B.encryptionKeyPair.x25519PublicKey,
    mlKem768PublicKey: B.encryptionKeyPair.mlKem768PublicKey,
  };
  return { A, B, r, viewTag, bodyKemCiphertext, recipientBundle };
}

describe('intro-handshake (INTRO lane first-contact — clean-16 hybrid)', () => {
  it('INTRO-HS-00: FROZEN pins', () => {
    expect(INTRO_TRANSCRIPT_DOMAIN).toBe('PLATHO.INTRO.TRANSCRIPT.V1');
    expect(hex(INTRO_PAYLOAD_MAGIC)).toBe('50494831'); // 'PIH1'
    expect(INTRO_NONCE_BYTES).toBe(16);
    expect(ED25519_SIGNATURE_BYTES).toBe(64);
  });

  it('INTRO-HS-01: A→B round-trip yields identical K_root, valid signature, recovered nonce + first message', async () => {
    const { A, B, r, viewTag, bodyKemCiphertext, recipientBundle } = await pair();
    const built = await buildIntroHandshake({
      senderIdentity: A, recipientBundle, ephemeralSecretKey: r, viewTag, bodyKemCiphertext,
      firstMessageBytes: utf8('привет'),
    });
    const opened = await openIntroHandshake({
      introPayloadBytes: built.introPayloadBytes, recipientIdentity: B,
      senderSigningPublicKey: A.signingPublicKey, ephemeralR: built.ephemeralR, bodyKemCiphertext, viewTag,
    });
    expect(built.kRoot.length).toBe(32);
    expect(hex(opened.kRoot)).toBe(hex(built.kRoot));
    expect(hex(opened.introNonce)).toBe(hex(built.introNonce));
    expect(fromUtf8(opened.firstMessageBytes)).toBe('привет');
    // senderKeyId is surfaced as raw 32 bytes; it matches A's advertised (base64url) keyId decoded.
    expect(hex(opened.senderKeyId)).toBe(Buffer.from(A.encryptionKeyPair.keyId, 'base64url').toString('hex'));
    expect(hex(opened.senderEncPublicKey)).toBe(hex(A.encryptionKeyPair.x25519PublicKey));
  });

  it('INTRO-HS-02: tampered R at open → verification fails (transcript binds R)', async () => {
    const { A, B, r, viewTag, bodyKemCiphertext, recipientBundle } = await pair();
    const built = await buildIntroHandshake({ senderIdentity: A, recipientBundle, ephemeralSecretKey: r, viewTag, bodyKemCiphertext });
    const badR = new Uint8Array(built.ephemeralR); badR[0] ^= 0xff;
    await expect(openIntroHandshake({
      introPayloadBytes: built.introPayloadBytes, recipientIdentity: B,
      senderSigningPublicKey: A.signingPublicKey, ephemeralR: badR, bodyKemCiphertext, viewTag,
    })).rejects.toThrow(/verification failed/i);
  });

  it('INTRO-HS-03: tampered view_tag at open → verification fails', async () => {
    const { A, B, r, viewTag, bodyKemCiphertext, recipientBundle } = await pair();
    const built = await buildIntroHandshake({ senderIdentity: A, recipientBundle, ephemeralSecretKey: r, viewTag, bodyKemCiphertext });
    await expect(openIntroHandshake({
      introPayloadBytes: built.introPayloadBytes, recipientIdentity: B,
      senderSigningPublicKey: A.signingPublicKey, ephemeralR: built.ephemeralR, bodyKemCiphertext, viewTag: viewTag ^ 0x1,
    })).rejects.toThrow(/verification failed/i);
  });

  it('INTRO-HS-04: tampered ct_root in payload → verification fails (transcript binds sha256(ct_root))', async () => {
    const { A, B, r, viewTag, bodyKemCiphertext, recipientBundle } = await pair();
    const built = await buildIntroHandshake({ senderIdentity: A, recipientBundle, ephemeralSecretKey: r, viewTag, bodyKemCiphertext });
    const tampered = new Uint8Array(built.introPayloadBytes);
    const ctRootOffset = 4 + 32 + 32; // magic + keyIdA + senderEncPub
    tampered[ctRootOffset] ^= 0xff;
    await expect(openIntroHandshake({
      introPayloadBytes: tampered, recipientIdentity: B,
      senderSigningPublicKey: A.signingPublicKey, ephemeralR: built.ephemeralR, bodyKemCiphertext, viewTag,
    })).rejects.toThrow(/verification failed/i);
  });

  it('INTRO-HS-05: tampered body_KEM_ct at open → verification fails (transcript binds sha256(body_KEM_ct))', async () => {
    const { A, B, r, viewTag, bodyKemCiphertext, recipientBundle } = await pair();
    const built = await buildIntroHandshake({ senderIdentity: A, recipientBundle, ephemeralSecretKey: r, viewTag, bodyKemCiphertext });
    const badBody = new Uint8Array(bodyKemCiphertext); badBody[0] ^= 0xff;
    await expect(openIntroHandshake({
      introPayloadBytes: built.introPayloadBytes, recipientIdentity: B,
      senderSigningPublicKey: A.signingPublicKey, ephemeralR: built.ephemeralR, bodyKemCiphertext: badBody, viewTag,
    })).rejects.toThrow(/verification failed/i);
  });

  it('INTRO-HS-06: a different signing key → verification fails (identity binding)', async () => {
    const { A, B, r, viewTag, bodyKemCiphertext, recipientBundle } = await pair();
    const impostor: any = await createMessagingIdentity();
    const built = await buildIntroHandshake({ senderIdentity: A, recipientBundle, ephemeralSecretKey: r, viewTag, bodyKemCiphertext });
    await expect(openIntroHandshake({
      introPayloadBytes: built.introPayloadBytes, recipientIdentity: B,
      senderSigningPublicKey: impostor.signingPublicKey, ephemeralR: built.ephemeralR, bodyKemCiphertext, viewTag,
    })).rejects.toThrow(/verification failed/i);
  });

  it('INTRO-HS-07: anti-replay nonce is random by default and surfaced for dedup; explicit nonce honoured', async () => {
    const { A, r, viewTag, bodyKemCiphertext, recipientBundle } = await pair();
    const b1 = await buildIntroHandshake({ senderIdentity: A, recipientBundle, ephemeralSecretKey: r, viewTag, bodyKemCiphertext });
    const b2 = await buildIntroHandshake({ senderIdentity: A, recipientBundle, ephemeralSecretKey: randomBytes(32), viewTag, bodyKemCiphertext });
    expect(b1.introNonce.length).toBe(16);
    expect(hex(b1.introNonce)).not.toBe(hex(b2.introNonce));
    const fixed = new Uint8Array(16).fill(0xab);
    const b3 = await buildIntroHandshake({ senderIdentity: A, recipientBundle, ephemeralSecretKey: r, viewTag, bodyKemCiphertext, introNonce: fixed });
    expect(hex(b3.introNonce)).toBe(hex(fixed));
  });

  it('INTRO-HS-08: serialize/parse round-trips (with and without a first message)', () => {
    const keyIdA = randomBytes(32);
    const senderEncPublicKey = randomBytes(32);
    const ctRoot = randomBytes(1088);
    const introNonce = randomBytes(16);
    const transcriptSignature = randomBytes(64);
    for (const msg of [new Uint8Array(0), utf8('first message body')]) {
      const bytes = serializeIntroPayload({ keyIdA, senderEncPublicKey, ctRoot, introNonce, transcriptSignature, firstMessageBytes: msg });
      const parsed = parseIntroPayload(bytes);
      expect(hex(parsed.keyIdA)).toBe(hex(keyIdA));
      expect(hex(parsed.senderEncPublicKey)).toBe(hex(senderEncPublicKey));
      expect(hex(parsed.ctRoot)).toBe(hex(ctRoot));
      expect(hex(parsed.introNonce)).toBe(hex(introNonce));
      expect(hex(parsed.transcriptSignature)).toBe(hex(transcriptSignature));
      expect(hex(parsed.firstMessageBytes)).toBe(hex(msg));
    }
  });

  it('INTRO-HS-09: parse rejects wrong magic and truncation', () => {
    const good = serializeIntroPayload({
      keyIdA: randomBytes(32), senderEncPublicKey: randomBytes(32), ctRoot: randomBytes(1088),
      introNonce: randomBytes(16), transcriptSignature: randomBytes(64), firstMessageBytes: new Uint8Array(0),
    });
    const badMagic = new Uint8Array(good); badMagic[0] ^= 0xff;
    expect(() => parseIntroPayload(badMagic)).toThrow(/magic/i);
    expect(() => parseIntroPayload(good.subarray(0, good.length - 1))).toThrow(/length mismatch|truncated/i);
  });

  it('INTRO-HS-10: standalone transcript sign/verify', async () => {
    const A: any = await createMessagingIdentity();
    const t = await buildIntroTranscript({
      keyIdA: A.encryptionKeyPair.keyId, keyIdB: A.encryptionKeyPair.keyId,
      senderEncPublicKey: A.encryptionKeyPair.x25519PublicKey,
      ephemeralR: randomBytes(32), bodyKemCiphertext: randomBytes(1088), ctRoot: randomBytes(1088),
      viewTag: 0xbeef, introNonce: randomBytes(16),
    });
    const sig = signIntroTranscript(t, A.signingSecretKey);
    expect(verifyIntroTranscript(t, sig, A.signingPublicKey)).toBe(true);
    const t2 = new Uint8Array(t); t2[t2.length - 1] ^= 0xff;
    expect(verifyIntroTranscript(t2, sig, A.signingPublicKey)).toBe(false);
  });
});
