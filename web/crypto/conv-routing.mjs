
import { x25519, ed25519 } from '../vendor/@noble/curves/ed25519.js';
import { ml_kem768 } from '../vendor/@noble/post-quantum/ml-kem.js';

export const CONV_ROOT_SALT_DOMAIN = 'PLATHO.CONV.ROOT.SALT.V1';
export const CONV_ROOT_INFO_DOMAIN = 'PLATHO.CONV.ROOT.V1';
export const CONV_ROOT_SELF_SALT_DOMAIN = 'PLATHO.CONV.ROOT.SELF.SALT.V1';
export const CONV_ROOT_SELF_INFO_DOMAIN = 'PLATHO.CONV.ROOT.SELF.V1';
export const RECOVERY_OWNER_SALT_DOMAIN = 'PLATHO.RECOVERY.OWNER.SALT.V1';
export const RECOVERY_OWNER_INFO_DOMAIN = 'PLATHO.RECOVERY.OWNER.V1';
export const CONV_RATCHET_SALT_DOMAIN = 'PLATHO.CONV.RATCHET.SALT.V1';
export const CONV_RATCHET_INFO_DOMAIN = 'PLATHO.CONV.RATCHET.V1';
export const CONV_BUCKET_SALT_DOMAIN = 'PLATHO.CONV.BUCKET.SALT.V1';
export const CONV_BUCKET_INFO_DOMAIN = 'PLATHO.CONV.BUCKET.V1';
export const CONV_WRITE_SALT_DOMAIN = 'PLATHO.CONV.WRITE.SALT.V1';
export const CONV_WRITE_INFO_DOMAIN = 'PLATHO.CONV.WRITE.V1';

export const CONV_EPOCH_SECONDS = 86400;
export const CONV_DIR_LO_TO_HI = 0x00;
export const CONV_DIR_HI_TO_LO = 0x01;
export const CONV_SELF_EPOCH_SENTINEL = 0;
export const CONV_RECV_WINDOW_W = 2;

export const CONV_FORWARD_EPOCH_GRACE_SEC = 3600;

export function convForwardEpochs(nowSec) {
  const seconds = Number(nowSec);
  if (!Number.isFinite(seconds)) return 0;
  const intoEpoch = ((seconds % CONV_EPOCH_SECONDS) + CONV_EPOCH_SECONDS) % CONV_EPOCH_SECONDS;
  return (CONV_EPOCH_SECONDS - intoEpoch) <= CONV_FORWARD_EPOCH_GRACE_SEC ? 1 : 0;
}

export const CONV_KEY_BYTES = 32;
export const KEY_ID_BYTES = 32;
export const X25519_SECRET_KEY_BYTES = 32;
export const X25519_PUBLIC_KEY_BYTES = 32;
export const MLKEM768_CIPHERTEXT_BYTES = 1088;
export const MLKEM768_PUBLIC_KEY_BYTES = 1184;
export const MLKEM768_SECRET_KEY_BYTES = 2400;

const encoder = new TextEncoder();

function getSubtle() {
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto is required for CONV routing');
  return globalThis.crypto.subtle;
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

function u32be(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw new RangeError(`epoch out of uint32 range: ${value}`);
  return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}

export function base64urlDecode(value) {
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

function compareBytes(a, b) {
  const x = toBytes(a);
  const y = toBytes(b);
  const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i += 1) {
    if (x[i] < y[i]) return -1;
    if (x[i] > y[i]) return 1;
  }
  if (x.length < y.length) return -1;
  if (x.length > y.length) return 1;
  return 0;
}

async function hkdf256(ikm, salt, info, byteLen) {
  const key = await getSubtle().importKey('raw', assertBytes('hkdf.ikm', ikm), 'HKDF', false, ['deriveBits']);
  const bits = await getSubtle().deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: toBytes(salt), info: toBytes(info) },
    key,
    byteLen * 8,
  );
  return new Uint8Array(bits);
}

function x25519Shared(secretKey, publicKey) {
  const ss = x25519.getSharedSecret(
    assertBytes('x25519SecretKey', secretKey, X25519_SECRET_KEY_BYTES),
    assertBytes('x25519PublicKey', publicKey, X25519_PUBLIC_KEY_BYTES),
  );
  const bytes = assertBytes('x25519SharedSecret', ss, X25519_PUBLIC_KEY_BYTES);
  let diff = 0;
  for (let i = 0; i < bytes.length; i += 1) diff |= bytes[i];
  if (diff === 0) throw new Error('x25519 shared secret must not be all-zero');
  return bytes;
}


export function conversationOrder(selfKeyId, peerKeyId) {
  const self = normalizeKeyId(selfKeyId);
  const peer = normalizeKeyId(peerKeyId);
  const cmp = compareBytes(self, peer);
  if (cmp === 0) throw new Error('conversationOrder: self keyId equals peer keyId (use the self-recovery lane)');
  const selfIsLo = cmp < 0;
  return {
    lo: selfIsLo ? self : peer,
    hi: selfIsLo ? peer : self,
    selfIsLo,
    outgoingDir: selfIsLo ? CONV_DIR_LO_TO_HI : CONV_DIR_HI_TO_LO,
    incomingDir: selfIsLo ? CONV_DIR_HI_TO_LO : CONV_DIR_LO_TO_HI,
  };
}

export function epochFromCreatedAtSeconds(createdAtSec) {
  const s = Number(createdAtSec);
  if (!Number.isFinite(s) || s < 0) throw new RangeError(`createdAtSec out of range: ${createdAtSec}`);
  return Math.floor(s / CONV_EPOCH_SECONDS);
}


async function deriveKRoot(dhShared, mlKemShared, loKeyId, hiKeyId) {
  const ikm = concatBytes(
    assertBytes('K_root.dhShared', dhShared, 32),
    assertBytes('K_root.mlKemShared', mlKemShared, 32),
  );
  const info = concatBytes(utf8(CONV_ROOT_INFO_DOMAIN), loKeyId, hiKeyId);
  return hkdf256(ikm, utf8(CONV_ROOT_SALT_DOMAIN), info, CONV_KEY_BYTES);
}

export async function establishConvKRootInitiator({
  selfEncSecretKey,
  peerEncPublicKey,
  peerMlKem768PublicKey,
  selfKeyId,
  peerKeyId,
}) {
  const { lo, hi } = conversationOrder(selfKeyId, peerKeyId);
  const dhShared = x25519Shared(selfEncSecretKey, peerEncPublicKey);
  const encapsulated = ml_kem768.encapsulate(assertBytes('peerMlKem768PublicKey', peerMlKem768PublicKey, MLKEM768_PUBLIC_KEY_BYTES));
  const ctRoot = assertBytes('ctRoot', encapsulated.cipherText, MLKEM768_CIPHERTEXT_BYTES);
  const mlKemShared = assertBytes('mlKemShared', encapsulated.sharedSecret, 32);
  const kRoot = await deriveKRoot(dhShared, mlKemShared, lo, hi);
  return { kRoot, ctRoot };
}

export async function establishConvKRootResponder({
  selfEncSecretKey,
  selfMlKem768SecretKey,
  peerEncPublicKey,
  ctRoot,
  selfKeyId,
  peerKeyId,
}) {
  const { lo, hi } = conversationOrder(selfKeyId, peerKeyId);
  const dhShared = x25519Shared(selfEncSecretKey, peerEncPublicKey);
  const mlKemShared = assertBytes(
    'mlKemShared',
    ml_kem768.decapsulate(
      assertBytes('ctRoot', ctRoot, MLKEM768_CIPHERTEXT_BYTES),
      assertBytes('selfMlKem768SecretKey', selfMlKem768SecretKey, MLKEM768_SECRET_KEY_BYTES),
    ),
    32,
  );
  const kRoot = await deriveKRoot(dhShared, mlKemShared, lo, hi);
  return { kRoot };
}


export async function computeKEpoch(kRoot, epoch) {
  const info = concatBytes(utf8(CONV_RATCHET_INFO_DOMAIN), u32be(epoch));
  return hkdf256(assertBytes('kRoot', kRoot, CONV_KEY_BYTES), utf8(CONV_RATCHET_SALT_DOMAIN), info, CONV_KEY_BYTES);
}

export async function computeBucketKey(kEpoch, dirByte, epoch) {
  if (dirByte !== CONV_DIR_LO_TO_HI && dirByte !== CONV_DIR_HI_TO_LO) {
    throw new RangeError(`dirByte must be 0x00 or 0x01, got ${dirByte}`);
  }
  const info = concatBytes(utf8(CONV_BUCKET_INFO_DOMAIN), new Uint8Array([dirByte]), u32be(epoch));
  return hkdf256(assertBytes('kEpoch', kEpoch, CONV_KEY_BYTES), utf8(CONV_BUCKET_SALT_DOMAIN), info, CONV_KEY_BYTES);
}

export async function convWriteSecret(kEpoch, dirByte, epoch) {
  if (dirByte !== CONV_DIR_LO_TO_HI && dirByte !== CONV_DIR_HI_TO_LO) {
    throw new RangeError(`dirByte must be 0x00 or 0x01, got ${dirByte}`);
  }
  const info = concatBytes(utf8(CONV_WRITE_INFO_DOMAIN), new Uint8Array([dirByte]), u32be(epoch));
  return hkdf256(assertBytes('kEpoch', kEpoch, CONV_KEY_BYTES), utf8(CONV_WRITE_SALT_DOMAIN), info, CONV_KEY_BYTES);
}

export async function convWritePublicKey(kEpoch, dirByte, epoch) {
  return ed25519.getPublicKey(await convWriteSecret(kEpoch, dirByte, epoch));
}

export async function outgoingBucketKey({ kRoot, selfKeyId, peerKeyId, createdAtSec }) {
  const { outgoingDir } = conversationOrder(selfKeyId, peerKeyId);
  const epoch = epochFromCreatedAtSeconds(createdAtSec);
  const kEpoch = await computeKEpoch(kRoot, epoch);
  return {
    bucketKey: await computeBucketKey(kEpoch, outgoingDir, epoch),
    writeSecret: await convWriteSecret(kEpoch, outgoingDir, epoch),
    writePublicKey: await convWritePublicKey(kEpoch, outgoingDir, epoch),
    epoch, dir: outgoingDir,
  };
}

export async function incomingBucketKeys({ kRoot, selfKeyId, peerKeyId, epochNow, windowW = CONV_RECV_WINDOW_W, forwardEpochs = 0 }) {
  const { incomingDir } = conversationOrder(selfKeyId, peerKeyId);
  const now = Number(epochNow);
  const forward = Math.max(0, Number(forwardEpochs) || 0);
  const out = [];
  for (let e = Math.max(0, now - windowW); e <= now + forward; e += 1) {
    const kEpoch = await computeKEpoch(kRoot, e);
    out.push({
      epoch: e, dir: incomingDir,
      bucketKey: await computeBucketKey(kEpoch, incomingDir, e),
      writePublicKey: await convWritePublicKey(kEpoch, incomingDir, e),
    });
  }
  return out;
}

export async function outgoingBucketKeys({ kRoot, selfKeyId, peerKeyId, epochNow, windowW = CONV_RECV_WINDOW_W }) {
  const { outgoingDir } = conversationOrder(selfKeyId, peerKeyId);
  const now = Number(epochNow);
  const out = [];
  for (let e = Math.max(0, now - windowW); e <= now; e += 1) {
    const kEpoch = await computeKEpoch(kRoot, e);
    out.push({
      epoch: e, dir: outgoingDir,
      bucketKey: await computeBucketKey(kEpoch, outgoingDir, e),
      writePublicKey: await convWritePublicKey(kEpoch, outgoingDir, e),
    });
  }
  return out;
}


export async function computeConvKRootSelf(seed) {
  return hkdf256(
    assertBytes('seed', seed),
    utf8(CONV_ROOT_SELF_SALT_DOMAIN),
    utf8(CONV_ROOT_SELF_INFO_DOMAIN),
    CONV_KEY_BYTES,
  );
}

export async function selfRecoveryBucketKey(seed) {
  const kRootSelf = await computeConvKRootSelf(seed);
  const kEpochSelf0 = await computeKEpoch(kRootSelf, CONV_SELF_EPOCH_SENTINEL);
  return computeBucketKey(kEpochSelf0, CONV_DIR_LO_TO_HI, CONV_SELF_EPOCH_SENTINEL);
}

export async function recoveryOwnerSecret(seed, slotIndex) {
  const idx = Number(slotIndex);
  if (!Number.isInteger(idx) || idx < 0) {
    throw new Error(`recoveryOwnerSecret: slotIndex must be a non-negative integer, got ${slotIndex}`);
  }
  return hkdf256(assertBytes('seed', seed), utf8(RECOVERY_OWNER_SALT_DOMAIN),
    utf8(`${RECOVERY_OWNER_INFO_DOMAIN}:${idx}`), 32);
}

export async function recoveryOwnerPublicKey(seed, slotIndex) {
  return ed25519.getPublicKey(await recoveryOwnerSecret(seed, slotIndex));
}
