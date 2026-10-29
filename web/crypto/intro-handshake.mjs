
import { ed25519, x25519 } from '../vendor/@noble/curves/ed25519.js';
import {
  establishConvKRootInitiator,
  establishConvKRootResponder,
  MLKEM768_CIPHERTEXT_BYTES,
  MLKEM768_PUBLIC_KEY_BYTES,
  KEY_ID_BYTES,
  X25519_PUBLIC_KEY_BYTES,
} from './conv-routing.mjs?v=9';

export const INTRO_TRANSCRIPT_DOMAIN = 'PLATHO.INTRO.TRANSCRIPT.V2';
export const INTRO_PAYLOAD_MAGIC = new Uint8Array([0x50, 0x49, 0x48, 0x32]);
export const INTRO_NONCE_BYTES = 16;
export const ED25519_SIGNATURE_BYTES = 64;
export const ED25519_PUBLIC_KEY_BYTES = 32;
export const ED25519_SECRET_KEY_BYTES = 32;
export const INTRO_FIRST_MESSAGE_MAX_BYTES = 0xffff;
export const KEY_ID_HYBRID_DOMAIN = 'PLATHO.KEYID.HYBRID.V1';
export const MLKEM768_PUBKEY_HASH_BYTES = 32;
export const INTRO_CONFIRM_TAG_BYTES = 32;
export const INTRO_CONFIRM_SALT_DOMAIN = 'PLATHO.INTRO.CONFIRM.SALT.V1';
export const INTRO_CONFIRM_INFO_DOMAIN = 'PLATHO.INTRO.CONFIRM.V1';

export const INTRO_TRANSCRIPT_DOMAIN_V3 = 'PLATHO.INTRO.TRANSCRIPT.V3';
export const INTRO_PAYLOAD_MAGIC_V3 = new Uint8Array([0x50, 0x49, 0x48, 0x33]);
export const INTRO_EPOCH_SIGNED_FROM = 20744;
export const INTRO_UNSIGNED_REFUSED_FROM = 20760;
const U32_MAX = 0xffffffff;
const u32be = (value) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > U32_MAX) throw new Error('introEpoch must be a uint32');
  return new Uint8Array([(number >>> 24) & 0xff, (number >>> 16) & 0xff, (number >>> 8) & 0xff, number & 0xff]);
};
const readU32be = (bytes, offset) => ((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
const signsEpoch = (introEpoch) => introEpoch !== null && introEpoch !== undefined;

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

async function deriveHybridKeyIdRaw(encPublicKey, mlKemPublicKeyHash) {
  return sha256(concatBytes(
    utf8(KEY_ID_HYBRID_DOMAIN),
    assertBytes('senderEncPublicKey', encPublicKey, X25519_PUBLIC_KEY_BYTES),
    assertBytes('senderMlKemPublicKeyHash', mlKemPublicKeyHash, MLKEM768_PUBKEY_HASH_BYTES),
    utf8(String(MLKEM768_PUBLIC_KEY_BYTES)),
  ));
}

async function deriveIntroConfirmTag(kRoot, transcriptBytes) {
  const confirmKey = await hkdf256(
    assertBytes('kRoot', kRoot, 32), utf8(INTRO_CONFIRM_SALT_DOMAIN), utf8(INTRO_CONFIRM_INFO_DOMAIN), 32);
  return assertBytes('introConfirmTag', await hmacSha256(confirmKey, transcriptBytes), INTRO_CONFIRM_TAG_BYTES);
}

export async function buildIntroTranscript({ keyIdA, keyIdB, senderEncPublicKey, senderMlKemPublicKeyHash, ephemeralR, bodyKemCiphertext, ctRoot, viewTag, introNonce, introEpoch = null }) {
  const v3 = signsEpoch(introEpoch);
  return concatBytes(
    utf8(v3 ? INTRO_TRANSCRIPT_DOMAIN_V3 : INTRO_TRANSCRIPT_DOMAIN),
    normalizeKeyId(keyIdA),
    normalizeKeyId(keyIdB),
    assertBytes('senderEncPublicKey', senderEncPublicKey, X25519_PUBLIC_KEY_BYTES),
    assertBytes('senderMlKemPublicKeyHash', senderMlKemPublicKeyHash, MLKEM768_PUBKEY_HASH_BYTES),
    assertBytes('ephemeralR', ephemeralR, X25519_PUBLIC_KEY_BYTES),
    await sha256(assertBytes('bodyKemCiphertext', bodyKemCiphertext, MLKEM768_CIPHERTEXT_BYTES)),
    await sha256(assertBytes('ctRoot', ctRoot, MLKEM768_CIPHERTEXT_BYTES)),
    u16be(viewTag),
    assertBytes('introNonce', introNonce, INTRO_NONCE_BYTES),
    ...(v3 ? [u32be(introEpoch)] : []),
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

export function serializeIntroPayload({ keyIdA, senderEncPublicKey, senderMlKemPublicKeyHash, ctRoot, introNonce, transcriptSignature, introConfirmTag, firstMessageBytes, introEpoch = null }) {
  const msg = firstMessageBytes ? toBytes(firstMessageBytes) : new Uint8Array(0);
  if (msg.length > INTRO_FIRST_MESSAGE_MAX_BYTES) throw new Error('INTRO first message too large');
  const v3 = signsEpoch(introEpoch);
  return concatBytes(
    v3 ? INTRO_PAYLOAD_MAGIC_V3 : INTRO_PAYLOAD_MAGIC,
    normalizeKeyId(keyIdA),
    assertBytes('senderEncPublicKey', senderEncPublicKey, X25519_PUBLIC_KEY_BYTES),
    assertBytes('senderMlKemPublicKeyHash', senderMlKemPublicKeyHash, MLKEM768_PUBKEY_HASH_BYTES),
    assertBytes('ctRoot', ctRoot, MLKEM768_CIPHERTEXT_BYTES),
    assertBytes('introNonce', introNonce, INTRO_NONCE_BYTES),
    ...(v3 ? [u32be(introEpoch)] : []),
    assertBytes('transcriptSignature', transcriptSignature, ED25519_SIGNATURE_BYTES),
    assertBytes('introConfirmTag', introConfirmTag, INTRO_CONFIRM_TAG_BYTES),
    u16be(msg.length),
    msg,
  );
}

export function parseIntroPayload(bytesLike) {
  const bytes = toBytes(bytesLike);
  const v3 = bytes.length >= 4 && bytesEqual(bytes.subarray(0, 4), INTRO_PAYLOAD_MAGIC_V3);
  const fixed = 4 + KEY_ID_BYTES + X25519_PUBLIC_KEY_BYTES + MLKEM768_PUBKEY_HASH_BYTES + MLKEM768_CIPHERTEXT_BYTES
    + INTRO_NONCE_BYTES + (v3 ? 4 : 0) + ED25519_SIGNATURE_BYTES + INTRO_CONFIRM_TAG_BYTES + 2;
  if (bytes.length < fixed) throw new Error('INTRO payload is truncated');
  if (!v3 && !bytesEqual(bytes.subarray(0, 4), INTRO_PAYLOAD_MAGIC)) throw new Error('INTRO payload magic mismatch');
  let o = 4;
  const keyIdA = bytes.slice(o, o + KEY_ID_BYTES); o += KEY_ID_BYTES;
  const senderEncPublicKey = bytes.slice(o, o + X25519_PUBLIC_KEY_BYTES); o += X25519_PUBLIC_KEY_BYTES;
  const senderMlKemPublicKeyHash = bytes.slice(o, o + MLKEM768_PUBKEY_HASH_BYTES); o += MLKEM768_PUBKEY_HASH_BYTES;
  const ctRoot = bytes.slice(o, o + MLKEM768_CIPHERTEXT_BYTES); o += MLKEM768_CIPHERTEXT_BYTES;
  const introNonce = bytes.slice(o, o + INTRO_NONCE_BYTES); o += INTRO_NONCE_BYTES;
  let introEpoch = null;
  if (v3) { introEpoch = readU32be(bytes, o); o += 4; }
  const transcriptSignature = bytes.slice(o, o + ED25519_SIGNATURE_BYTES); o += ED25519_SIGNATURE_BYTES;
  const introConfirmTag = bytes.slice(o, o + INTRO_CONFIRM_TAG_BYTES); o += INTRO_CONFIRM_TAG_BYTES;
  const msgLen = readU16be(bytes, o); o += 2;
  if (bytes.length !== fixed + msgLen) throw new Error('INTRO payload length mismatch');
  const firstMessageBytes = bytes.slice(o, o + msgLen);
  return { keyIdA, senderEncPublicKey, senderMlKemPublicKeyHash, ctRoot, introNonce, transcriptSignature, introConfirmTag, firstMessageBytes, introEpoch };
}

export async function buildIntroHandshake({
  senderIdentity,
  recipientBundle,
  ephemeralSecretKey,
  viewTag,
  bodyKemCiphertext,
  introNonce,
  firstMessageBytes,
  introEpoch = null,
}) {
  const a = senderIdentity.encryptionKeyPair;
  const ephemeralR = x25519.getPublicKey(assertBytes('ephemeralSecretKey', ephemeralSecretKey, 32));
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
    introEpoch,
  });
  const transcriptSignature = signIntroTranscript(transcript, senderIdentity.signingSecretKey);
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
    introEpoch,
  });
  return { introPayloadBytes, kRoot, ctRoot, ephemeralR, introNonce: nonce, introEpoch: signsEpoch(introEpoch) ? Number(introEpoch) : null };
}

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
    introEpoch: parsed.introEpoch,
  });
  if (!verifyIntroTranscript(transcript, parsed.transcriptSignature, senderSigningPublicKey)) {
    throw new Error('INTRO transcript signature verification failed (UKS/tamper/replay guard)');
  }
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
    introEpoch: parsed.introEpoch,
  };
}
