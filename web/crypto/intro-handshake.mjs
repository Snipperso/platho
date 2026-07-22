// PLATHO clean-16 — INTRO handshake core (AUDIT-CRITICAL, immutable genesis).
//
// The INTRO lane carries a FIRST contact from a stranger. The sender A publishes a stealth capsule (header0 = ephemeral
// R + view_tag); its ENCRYPTED body carries this handshake, which lets the recipient B (a) authenticate A and (b)
// establish the pairwise CONV K_root (via conv-routing) so all further traffic rides the O(1) opaque CONV lane.
//
// This module is the handshake CORE at the byte level: it builds/parses the intro payload struct, binds and verifies
// the full transcript (anti-UKS / anti-misbinding), and drives K_root establishment. It deliberately does NOT do the
// AES-GCM body seal, the compact-payload size-class encoding, or the header0 layout — those are the capsule-assembly
// wiring that composes this core with encryptCompactPayloadBytes and the INTRO header0. Keeping the crypto
// core here, auditable in isolation, mirrors conv-routing.mjs.
//
// verify-after-decrypt: openIntroHandshake runs on the ALREADY-DECRYPTED intro payload (the caller decrypts the body
// first) and verifies A's ed25519 signature over the reconstructed transcript BEFORE trusting any field. The transcript
// commits to both keyIds, A's STATIC enc pubkey (the classical X25519 half of K_root), A's ML-KEM pubkey HASH, both KEM
// ciphertexts (body_KEM_ct and ct_root), R, view_tag and the intro nonce — so an active attacker cannot graft A's
// signature onto different key material (UKS/misbinding).
//
// FIRST-CONTACT AUTHENTICITY IS CRYPTOGRAPHIC, NOT A CHAIN LOOKUP (clean-17, format V2). Earlier this module told the
// CALLER to bind keyId_A to A's LIVE *Vault* KeyRecord — but clean-17 deleted the Vault's keyId→keys index (KeyShard is
// wallet-keyed, with no proof-of-possession), so that anchor no longer exists and a stranger could publish a
// self-consistent INTRO claiming keyId_A = victim, reading the victim's would-be replies. openIntroHandshake now closes
// this in the handshake itself, with TWO bindings that need no on-chain read:
//   (1) keyId_A == H(senderEncPublicKey, senderMlKemPublicKeyHash) — the frozen hybrid keyId formula. To claim a
//       victim's keyId a forger must use the victim's enc key.
//   (2) a K_root CONFIRM TAG (HMAC over the transcript under a key derived from K_root) proves the sender DERIVED the
//       same K_root — which requires the enc SECRET behind senderEncPublicKey. Forced by (1) to use the victim's enc
//       key, the forger cannot derive K_root, the tag mismatches, and the open is REJECTED. Present even for a
//       first-message-less pure handshake, so the pure case is covered too.
// SCOPE the caller STILL owns: dedup by introNonce (a per-sender seen-set) — the nonce is the replay-detection KEY, it
// does not by itself PREVENT a byte-identical replay.

import { ed25519, x25519 } from '../vendor/@noble/curves/ed25519.js';
import {
  establishConvKRootInitiator,
  establishConvKRootResponder,
  MLKEM768_CIPHERTEXT_BYTES,
  MLKEM768_PUBLIC_KEY_BYTES,
  KEY_ID_BYTES,
  X25519_PUBLIC_KEY_BYTES,
} from './conv-routing.mjs';

// ---- FROZEN pins (audit-critical, clean-17 genesis) ----
// V2/PIH2 vs the clean-16 V1/PIH1: the payload + transcript gained senderMlKemPublicKeyHash and the payload gained the
// K_root confirm tag (see the header). The version bump is deliberate — a client on the old layout fails CLOSED on the
// magic rather than silently interoperating with a mismatched field order. No clean-16 INTRO is deployed to be broken.
export const INTRO_TRANSCRIPT_DOMAIN = 'PLATHO.INTRO.TRANSCRIPT.V2';
export const INTRO_PAYLOAD_MAGIC = new Uint8Array([0x50, 0x49, 0x48, 0x32]); // 'PIH2'
export const INTRO_NONCE_BYTES = 16;
export const ED25519_SIGNATURE_BYTES = 64;
export const ED25519_PUBLIC_KEY_BYTES = 32;
export const ED25519_SECRET_KEY_BYTES = 32;
export const INTRO_FIRST_MESSAGE_MAX_BYTES = 0xffff;
// The frozen hybrid keyId formula, replicated here (importing platho-crypto would be circular): the recipient recomputes
// keyId_A from the sender's enc pubkey + ML-KEM pubkey HASH and requires it to equal the claimed keyId_A.
export const KEY_ID_HYBRID_DOMAIN = 'PLATHO.KEYID.HYBRID.V1';
export const MLKEM768_PUBKEY_HASH_BYTES = 32;
export const INTRO_CONFIRM_TAG_BYTES = 32;
export const INTRO_CONFIRM_SALT_DOMAIN = 'PLATHO.INTRO.CONFIRM.SALT.V1';
export const INTRO_CONFIRM_INFO_DOMAIN = 'PLATHO.INTRO.CONFIRM.V1';

const encoder = new TextEncoder();

function getSubtle() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error('WebCrypto is required for the INTRO handshake');
  }
  return globalThis.crypto.subtle;
}

function randomBytes(length) {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
}

function utf8(value) {
  return encoder.encode(value);
}

function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new TypeError('Expected byte array');
}

function assertBytes(name, value, length) {
  const bytes = toBytes(value);
  if (typeof length === 'number' && bytes.length !== length) {
    throw new Error(`${name} must be ${length} bytes, got ${bytes.length}`);
  }
  return bytes;
}

function concatBytes(...parts) {
  const arrays = parts.map(toBytes);
  const size = arrays.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of arrays) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function u16be(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 0xffff) throw new RangeError(`value out of uint16 range: ${value}`);
  return new Uint8Array([(n >>> 8) & 0xff, n & 0xff]);
}

function readU16be(bytes, offset) {
  return ((bytes[offset] << 8) | bytes[offset + 1]) & 0xffff;
}

function base64urlDecode(value) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(value, 'base64url'));
  const padded = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function normalizeKeyId(keyId) {
  const raw = typeof keyId === 'string' ? base64urlDecode(keyId) : toBytes(keyId);
  return assertBytes('keyId', raw, KEY_ID_BYTES);
}

async function sha256(bytes) {
  return new Uint8Array(await getSubtle().digest('SHA-256', toBytes(bytes)));
}

function bytesEqual(a, b) {
  const x = toBytes(a);
  const y = toBytes(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= x[i] ^ y[i];
  return diff === 0;
}

// ---- K_root confirm-tag + keyId binding helpers (clean-17 first-contact authenticity) ----

async function hkdf256(ikm, salt, info, byteLen) {
  const key = await getSubtle().importKey('raw', toBytes(ikm), 'HKDF', false, ['deriveBits']);
  const bits = await getSubtle().deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: toBytes(salt), info: toBytes(info) }, key, byteLen * 8);
  return new Uint8Array(bits);
}

async function hmacSha256(key, data) {
  const k = await getSubtle().importKey('raw', toBytes(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await getSubtle().sign('HMAC', k, toBytes(data)));
}

// Recompute keyId_A the frozen way — H(DOMAIN || encPub(32) || sha256(mlKemPub)(32) || "1184") — from the enc pubkey and
// the ML-KEM pubkey HASH the payload carries. Returns the RAW 32-byte digest (== normalizeKeyId of the base64url keyId).
async function deriveHybridKeyIdRaw(encPublicKey, mlKemPublicKeyHash) {
  return sha256(concatBytes(
    utf8(KEY_ID_HYBRID_DOMAIN),
    assertBytes('senderEncPublicKey', encPublicKey, X25519_PUBLIC_KEY_BYTES),
    assertBytes('senderMlKemPublicKeyHash', mlKemPublicKeyHash, MLKEM768_PUBKEY_HASH_BYTES),
    utf8(String(MLKEM768_PUBLIC_KEY_BYTES)),
  ));
}

// The K_root possession proof: HMAC(HKDF(K_root), transcript). Both sides build the same transcript and derive the same
// K_root for a genuine handshake, so the tags match; a forger who could not derive K_root (forced by the keyId binding
// to use the victim's enc key, whose secret they lack) produces a mismatching tag and is rejected.
async function deriveIntroConfirmTag(kRoot, transcriptBytes) {
  const confirmKey = await hkdf256(
    assertBytes('kRoot', kRoot, 32), utf8(INTRO_CONFIRM_SALT_DOMAIN), utf8(INTRO_CONFIRM_INFO_DOMAIN), 32);
  return assertBytes('introConfirmTag', await hmacSha256(confirmKey, transcriptBytes), INTRO_CONFIRM_TAG_BYTES);
}

// ---- transcript ----
// FROZEN order (V2): DOMAIN || keyId_A(32) || keyId_B(32) || senderEncPublicKey(32) || senderMlKemPublicKeyHash(32)
//               || R(32) || sha256(body_KEM_ct)(32) || sha256(ct_root)(32) || u16be(view_tag) || introNonce(16).
// senderEncPublicKey (A's static X25519 messaging key) is committed because it is the classical half of K_root
// (dhShared = X25519(a, B)); without it the signature would not bind that key material. senderMlKemPublicKeyHash is
// committed so the keyId_A == H(enc, mlKemHash) binding cannot be bypassed by swapping the hash under a valid signature.
export async function buildIntroTranscript({ keyIdA, keyIdB, senderEncPublicKey, senderMlKemPublicKeyHash, ephemeralR, bodyKemCiphertext, ctRoot, viewTag, introNonce }) {
  return concatBytes(
    utf8(INTRO_TRANSCRIPT_DOMAIN),
    normalizeKeyId(keyIdA),
    normalizeKeyId(keyIdB),
    assertBytes('senderEncPublicKey', senderEncPublicKey, X25519_PUBLIC_KEY_BYTES),
    assertBytes('senderMlKemPublicKeyHash', senderMlKemPublicKeyHash, MLKEM768_PUBKEY_HASH_BYTES),
    assertBytes('ephemeralR', ephemeralR, X25519_PUBLIC_KEY_BYTES),
    await sha256(assertBytes('bodyKemCiphertext', bodyKemCiphertext, MLKEM768_CIPHERTEXT_BYTES)),
    await sha256(assertBytes('ctRoot', ctRoot, MLKEM768_CIPHERTEXT_BYTES)),
    u16be(viewTag),
    assertBytes('introNonce', introNonce, INTRO_NONCE_BYTES),
  );
}

export function signIntroTranscript(transcriptBytes, signingSecretKey) {
  return assertBytes(
    'introTranscriptSignature',
    ed25519.sign(toBytes(transcriptBytes), assertBytes('signingSecretKey', signingSecretKey, ED25519_SECRET_KEY_BYTES)),
    ED25519_SIGNATURE_BYTES,
  );
}

export function verifyIntroTranscript(transcriptBytes, signature, signingPublicKey) {
  return ed25519.verify(
    assertBytes('signature', signature, ED25519_SIGNATURE_BYTES),
    toBytes(transcriptBytes),
    assertBytes('signingPublicKey', signingPublicKey, ED25519_PUBLIC_KEY_BYTES),
    { zip215: false },
  );
}

// ---- intro payload struct (the plaintext content sealed inside the INTRO capsule body, after the 68B identity section) ----
// FROZEN (V2): MAGIC(4) || keyId_A(32) || senderEncPublicKey(32) || senderMlKemPublicKeyHash(32) || ct_root(1088)
//              || introNonce(16) || sig(64) || introConfirmTag(32) || u16be(msgLen) || msg
export function serializeIntroPayload({ keyIdA, senderEncPublicKey, senderMlKemPublicKeyHash, ctRoot, introNonce, transcriptSignature, introConfirmTag, firstMessageBytes }) {
  const msg = firstMessageBytes ? toBytes(firstMessageBytes) : new Uint8Array(0);
  if (msg.length > INTRO_FIRST_MESSAGE_MAX_BYTES) throw new Error('INTRO first message too large');
  return concatBytes(
    INTRO_PAYLOAD_MAGIC,
    normalizeKeyId(keyIdA),
    assertBytes('senderEncPublicKey', senderEncPublicKey, X25519_PUBLIC_KEY_BYTES),
    assertBytes('senderMlKemPublicKeyHash', senderMlKemPublicKeyHash, MLKEM768_PUBKEY_HASH_BYTES),
    assertBytes('ctRoot', ctRoot, MLKEM768_CIPHERTEXT_BYTES),
    assertBytes('introNonce', introNonce, INTRO_NONCE_BYTES),
    assertBytes('transcriptSignature', transcriptSignature, ED25519_SIGNATURE_BYTES),
    assertBytes('introConfirmTag', introConfirmTag, INTRO_CONFIRM_TAG_BYTES),
    u16be(msg.length),
    msg,
  );
}

export function parseIntroPayload(bytesLike) {
  const bytes = toBytes(bytesLike);
  const fixed = 4 + KEY_ID_BYTES + X25519_PUBLIC_KEY_BYTES + MLKEM768_PUBKEY_HASH_BYTES + MLKEM768_CIPHERTEXT_BYTES
    + INTRO_NONCE_BYTES + ED25519_SIGNATURE_BYTES + INTRO_CONFIRM_TAG_BYTES + 2;
  if (bytes.length < fixed) throw new Error('INTRO payload is truncated');
  if (!bytesEqual(bytes.subarray(0, 4), INTRO_PAYLOAD_MAGIC)) throw new Error('INTRO payload magic mismatch');
  let o = 4;
  const keyIdA = bytes.slice(o, o + KEY_ID_BYTES); o += KEY_ID_BYTES;
  const senderEncPublicKey = bytes.slice(o, o + X25519_PUBLIC_KEY_BYTES); o += X25519_PUBLIC_KEY_BYTES;
  const senderMlKemPublicKeyHash = bytes.slice(o, o + MLKEM768_PUBKEY_HASH_BYTES); o += MLKEM768_PUBKEY_HASH_BYTES;
  const ctRoot = bytes.slice(o, o + MLKEM768_CIPHERTEXT_BYTES); o += MLKEM768_CIPHERTEXT_BYTES;
  const introNonce = bytes.slice(o, o + INTRO_NONCE_BYTES); o += INTRO_NONCE_BYTES;
  const transcriptSignature = bytes.slice(o, o + ED25519_SIGNATURE_BYTES); o += ED25519_SIGNATURE_BYTES;
  const introConfirmTag = bytes.slice(o, o + INTRO_CONFIRM_TAG_BYTES); o += INTRO_CONFIRM_TAG_BYTES;
  const msgLen = readU16be(bytes, o); o += 2;
  if (bytes.length !== fixed + msgLen) throw new Error('INTRO payload length mismatch');
  const firstMessageBytes = bytes.slice(o, o + msgLen);
  return { keyIdA, senderEncPublicKey, senderMlKemPublicKeyHash, ctRoot, introNonce, transcriptSignature, introConfirmTag, firstMessageBytes };
}

// ---- high-level: initiator (A) ----
// senderIdentity: { encryptionKeyPair: { keyId, x25519SecretKey, x25519PublicKey }, signingSecretKey }
// recipientBundle: { keyId, x25519PublicKey, mlKem768PublicKey }
// bodyKemCiphertext: the body-KEM ciphertext the AES-GCM seal layer will carry (pre-computed by that layer so the
//   transcript can commit to it). ephemeralSecretKey `r` is the stealth ephemeral (R = r·G, published in header0).
export async function buildIntroHandshake({
  senderIdentity,
  recipientBundle,
  ephemeralSecretKey,
  viewTag,
  bodyKemCiphertext,
  introNonce,
  firstMessageBytes,
}) {
  const a = senderIdentity.encryptionKeyPair;
  const ephemeralR = x25519.getPublicKey(assertBytes('ephemeralSecretKey', ephemeralSecretKey, 32));
  // The keyId binding needs A's ML-KEM pubkey HASH; the hash (not the 1184-byte key) is what keyId_A commits to, so
  // carrying it costs 32 bytes and lets the recipient recompute keyId_A == H(enc, mlKemHash) without the full key.
  const senderMlKemPublicKeyHash = await sha256(
    assertBytes('senderMlKem768PublicKey', a.mlKem768PublicKey, MLKEM768_PUBLIC_KEY_BYTES));
  const { kRoot, ctRoot } = await establishConvKRootInitiator({
    selfEncSecretKey: a.x25519SecretKey,
    peerEncPublicKey: recipientBundle.x25519PublicKey,
    peerMlKem768PublicKey: recipientBundle.mlKem768PublicKey,
    selfKeyId: a.keyId,
    peerKeyId: recipientBundle.keyId,
  });
  const nonce = introNonce ? assertBytes('introNonce', introNonce, INTRO_NONCE_BYTES) : randomBytes(INTRO_NONCE_BYTES);
  const transcript = await buildIntroTranscript({
    keyIdA: a.keyId,
    keyIdB: recipientBundle.keyId,
    senderEncPublicKey: a.x25519PublicKey,
    senderMlKemPublicKeyHash,
    ephemeralR,
    bodyKemCiphertext,
    ctRoot,
    viewTag,
    introNonce: nonce,
  });
  const transcriptSignature = signIntroTranscript(transcript, senderIdentity.signingSecretKey);
  // K_root possession proof — bound to the same transcript the signature covers, so it authenticates the sender as the
  // holder of the enc secret behind senderEncPublicKey (and thus of keyId_A) even for a first-message-less handshake.
  const introConfirmTag = await deriveIntroConfirmTag(kRoot, transcript);
  const introPayloadBytes = serializeIntroPayload({
    keyIdA: a.keyId,
    senderEncPublicKey: a.x25519PublicKey,
    senderMlKemPublicKeyHash,
    ctRoot,
    introNonce: nonce,
    transcriptSignature,
    introConfirmTag,
    firstMessageBytes,
  });
  return { introPayloadBytes, kRoot, ctRoot, ephemeralR, introNonce: nonce };
}

// ---- high-level: responder (B) — runs on the ALREADY-DECRYPTED intro payload (verify-after-decrypt) ----
// recipientIdentity: { encryptionKeyPair: { keyId, x25519SecretKey, mlKem768SecretKey } }
// senderSigningPublicKey: A's ed25519 sign pubkey read from the decrypted identity section.
// ephemeralR/bodyKemCiphertext/viewTag: read from the capsule (header0 R, body prefix body_KEM_ct, header0 view_tag).
// The caller MUST additionally bind {keyIdA, senderEncPublicKey, senderSigningPublicKey} to A's LIVE Vault KeyRecord
// (keyId_A -> registered enc/mlkem/sign keys) — that authenticity anchor is app-layer and NOT done here.
export async function openIntroHandshake({
  introPayloadBytes,
  recipientIdentity,
  senderSigningPublicKey,
  ephemeralR,
  bodyKemCiphertext,
  viewTag,
}) {
  const b = recipientIdentity.encryptionKeyPair;
  const parsed = parseIntroPayload(introPayloadBytes);
  const transcript = await buildIntroTranscript({
    keyIdA: parsed.keyIdA,
    keyIdB: b.keyId,
    senderEncPublicKey: parsed.senderEncPublicKey,
    senderMlKemPublicKeyHash: parsed.senderMlKemPublicKeyHash,
    ephemeralR,
    bodyKemCiphertext,
    ctRoot: parsed.ctRoot,
    viewTag,
    introNonce: parsed.introNonce,
  });
  if (!verifyIntroTranscript(transcript, parsed.transcriptSignature, senderSigningPublicKey)) {
    throw new Error('INTRO transcript signature verification failed (UKS/tamper/replay guard)');
  }
  // BINDING 1 — keyId_A must be the frozen hybrid keyId of the enc pubkey + ML-KEM pubkey hash the sender signed. This is
  // what stops a stranger from pairing a VICTIM's keyId with their OWN enc key: to claim the victim's keyId they must
  // present the victim's enc key here, which they do not hold the secret for (see binding 2). [intro-first-contact-auth]
  const expectedKeyId = await deriveHybridKeyIdRaw(parsed.senderEncPublicKey, parsed.senderMlKemPublicKeyHash);
  if (!bytesEqual(expectedKeyId, normalizeKeyId(parsed.keyIdA))) {
    throw new Error('INTRO keyId_A does not bind to the sender enc + ML-KEM keys (impersonation)');
  }
  const { kRoot } = await establishConvKRootResponder({
    selfEncSecretKey: b.x25519SecretKey,
    selfMlKem768SecretKey: b.mlKem768SecretKey,
    peerEncPublicKey: parsed.senderEncPublicKey,
    ctRoot: parsed.ctRoot,
    selfKeyId: b.keyId,
    peerKeyId: parsed.keyIdA,
  });
  // BINDING 2 — the K_root confirm tag proves the sender derived the SAME K_root, i.e. holds the enc secret behind
  // senderEncPublicKey. Forced by binding 1 to use the victim's enc key, a forger cannot reach this K_root and the tag
  // mismatches. Constant-time compare; failure is an authenticity failure, not a decrypt error.
  const expectedConfirmTag = await deriveIntroConfirmTag(kRoot, transcript);
  if (!bytesEqual(expectedConfirmTag, parsed.introConfirmTag)) {
    throw new Error('INTRO K_root confirmation failed (sender does not hold the enc secret behind keyId_A — impersonation)');
  }
  return {
    kRoot,
    senderKeyId: parsed.keyIdA,
    senderEncPublicKey: parsed.senderEncPublicKey,
    introNonce: parsed.introNonce,
    firstMessageBytes: parsed.firstMessageBytes,
  };
}
