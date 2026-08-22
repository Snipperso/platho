// PLATHO clean-16 — CONV-lane key schedule & opaque directional routing (AUDIT-CRITICAL, immutable genesis).
//
// This module derives the CONV (established-conversation) routing material that breaks the on-chain "who-to-whom"
// index: instead of a recipient-keyed index, each direction of a conversation publishes into an OPAQUE bucketKey
// that only the two parties can compute (needs the shared K_root). A passive index-scraper without K_root sees
// uniformly-random 32-byte keys.
//
// Design (frozen — see PLATHO_CLEAN16_HYBRID_CLOSED_SPEC.md §9/§12):
//   K_root  = HKDF( X25519(a,B) || ML-KEM768-ss ,  salt=ROOT.SALT , info=ROOT || lo_keyId || hi_keyId )   [per-pair]
//   K_epoch = HKDF( K_root ,  salt=RATCHET.SALT , info=RATCHET || u32be(epoch) )                           [O(1)/epoch]
//   bucket  = HKDF( K_epoch, salt=BUCKET.SALT  , info=BUCKET  || dir_byte || u32be(epoch) )[:32]           [directional]
//
// PQ-graph-privacy of CONV rests on a GENUINE (randomized) ML-KEM-768 encapsulation whose ss enters K_root — NOT a
// derandomized coin=HKDF(DH) construction (which would collapse the ML-KEM contribution to X25519 strength and lose
// PQ). The K_root KEM ciphertext (ct_root) is a SEPARATE fresh encapsulation, never the body_KEM_ct — domain-separated.
//
// Directionality is a CLIENT invariant (the contract treats bucketKey opaquely and stores no sender label — D7 dropped
// per owner sign-off 2026-07-14). lo/hi ordering by big-endian compare of the raw 32-byte keyIds guarantees each
// directional bucket has exactly one visible publisher; both sides derive the SAME keyId ordering from the same Vault
// bundle, so a lo/hi disagreement is a hard audit-invariant failure (would silently lose messages).

import { x25519, ed25519 } from '../vendor/@noble/curves/ed25519.js';
import { ml_kem768 } from '../vendor/@noble/post-quantum/ml-kem.js';

// ---- FROZEN domain-separation strings (audit-critical: changing any orphans all previously routed messages) ----
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

// ---- FROZEN scalar pins ----
export const CONV_EPOCH_SECONDS = 86400;            // 1 UTC day
export const CONV_DIR_LO_TO_HI = 0x00;
export const CONV_DIR_HI_TO_LO = 0x01;
export const CONV_SELF_EPOCH_SENTINEL = 0;          // self-recovery bucket is epoch-independent (§12.2)
export const CONV_RECV_WINDOW_W = 2;                // recipient scans [epoch_now-W .. epoch_now] (client-only, tunable)

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

// Exported because conv-key-store.mjs needs the SAME decoder. It used to hex-decode keyId strings while this module
// base64url-decoded them, so the one identifier the two modules pass to each other had two incompatible string forms.
export function base64urlDecode(value) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(value, 'base64url'));
  const padded = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

// keyId may arrive as the base64url string (computeHybridKeyId output) or as raw 32 bytes.
function normalizeKeyId(keyId) {
  const raw = typeof keyId === 'string' ? base64urlDecode(keyId) : toBytes(keyId);
  return assertBytes('keyId', raw, KEY_ID_BYTES);
}

// big-endian lexicographic compare of two equal-length byte arrays: -1 | 0 | 1
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

// X25519 shared secret with an explicit all-zero guard (a low-order peer key that forces the all-zero secret is a
// well-known small-subgroup pitfall; RFC 7748 §6.1 recommends rejecting it — mirrors platho-crypto.mjs).
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

// ---- pair ordering & direction ----

// Returns the canonical lo/hi keyIds (raw 32B) and this party's role. Throws on self==peer (self-pair uses the
// dedicated self-recovery lane, never a pairwise bucket).
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
    // my outgoing messages travel self->peer: if I am lo that is lo->hi (0x00), else hi->lo (0x01).
    outgoingDir: selfIsLo ? CONV_DIR_LO_TO_HI : CONV_DIR_HI_TO_LO,
    // the peer's messages travel peer->self: the mirror direction.
    incomingDir: selfIsLo ? CONV_DIR_HI_TO_LO : CONV_DIR_LO_TO_HI,
  };
}

export function epochFromCreatedAtSeconds(createdAtSec) {
  const s = Number(createdAtSec);
  if (!Number.isFinite(s) || s < 0) throw new RangeError(`createdAtSec out of range: ${createdAtSec}`);
  return Math.floor(s / CONV_EPOCH_SECONDS);
}

// ---- K_root establishment (genuine hybrid: X25519 static-static + fresh ML-KEM-768 encapsulation) ----

async function deriveKRoot(dhShared, mlKemShared, loKeyId, hiKeyId) {
  const ikm = concatBytes(
    assertBytes('K_root.dhShared', dhShared, 32),
    assertBytes('K_root.mlKemShared', mlKemShared, 32),
  );
  const info = concatBytes(utf8(CONV_ROOT_INFO_DOMAIN), loKeyId, hiKeyId);
  return hkdf256(ikm, utf8(CONV_ROOT_SALT_DOMAIN), info, CONV_KEY_BYTES);
}

// Initiator (the party sending the INTRO capsule) establishes K_root and emits ct_root to embed in the INTRO body.
// selfEncSecretKey/peerEncPublicKey are the X25519 messaging keys; peerMlKem768PublicKey is the recipient's ML-KEM pub.
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

// Responder (the party who received the INTRO capsule and decrypted ct_root from its body) re-derives the same K_root.
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

// ---- ratchet & bucket ----

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

// ---- the bucket's WRITE KEY: address privacy is not authorization ----
// A shard's bucket_key ends up in its ADDRESS, and the address is public the moment anyone publishes (it is the
// destination of that transaction). So "only participants can compute where the conversation lives" does NOT keep
// outsiders from WRITING there — measured: a stranger who merely observed one publish appended junk to a private
// conversation, and filling SAFE_CAP to deny a conversation-day cost ~11 TON.
//
// The fix needs no infrastructure: the shard's identity is a PUBLIC KEY derived from the same K_epoch, and a publish
// must carry a signature under it. Knowing the address (a hash) does not let anyone sign. Both participants derive
// the same key from the shared K_root, so both can write and nobody else can. Domain-separated from the bucketKey so
// the identifier and the signing secret are never the same bytes.
export async function convWriteSecret(kEpoch, dirByte, epoch) {
  if (dirByte !== CONV_DIR_LO_TO_HI && dirByte !== CONV_DIR_HI_TO_LO) {
    throw new RangeError(`dirByte must be 0x00 or 0x01, got ${dirByte}`);
  }
  const info = concatBytes(utf8(CONV_WRITE_INFO_DOMAIN), new Uint8Array([dirByte]), u32be(epoch));
  return hkdf256(assertBytes('kEpoch', kEpoch, CONV_KEY_BYTES), utf8(CONV_WRITE_SALT_DOMAIN), info, CONV_KEY_BYTES);
}

/** The shard identity for a conversation-direction: the ed25519 public key a publish must be signed under. */
export async function convWritePublicKey(kEpoch, dirByte, epoch) {
  return ed25519.getPublicKey(await convWriteSecret(kEpoch, dirByte, epoch));
}

// Convenience: the bucketKey THIS party publishes its outgoing message into, for a capsule stamped createdAtSec.
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

// Convenience: the set of INCOMING bucketKeys this party must scan for the window [epochNow-W .. epochNow].
export async function incomingBucketKeys({ kRoot, selfKeyId, peerKeyId, epochNow, windowW = CONV_RECV_WINDOW_W }) {
  const { incomingDir } = conversationOrder(selfKeyId, peerKeyId);
  const now = Number(epochNow);
  const out = [];
  for (let e = Math.max(0, now - windowW); e <= now; e += 1) {
    const kEpoch = await computeKEpoch(kRoot, e);
    out.push({
      epoch: e, dir: incomingDir,
      bucketKey: await computeBucketKey(kEpoch, incomingDir, e),
      writePublicKey: await convWritePublicKey(kEpoch, incomingDir, e),
    });
  }
  return out;
}

// Convenience: the set of OUTGOING bucketKeys this party PUBLISHED into over the window [epochNow-W .. epochNow] —
// the mirror of incomingBucketKeys, for reading one's OWN sent messages back off the chain. [OWNER 2026-08-22, on a
// freshly restored device: "only the peer's replies synced, not mine".] The capsules there carry a sender-recovery
// section the publisher can open (openedAs 'sender'), so this is the set a restore reads to get its own side back.
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

// ---- self-recovery lane (§12): deterministic from the seed, epoch-independent, bypasses genuine KEM ----
// self==self creates no inter-user graph, so there is no PQ-privacy to lose; determinism from the seed is exactly what
// lets a reinstalled client re-find its PREFS/recovery capsule with only the mnemonic.

export async function computeConvKRootSelf(seed) {
  return hkdf256(
    assertBytes('seed', seed),
    utf8(CONV_ROOT_SELF_SALT_DOMAIN),
    utf8(CONV_ROOT_SELF_INFO_DOMAIN),
    CONV_KEY_BYTES,
  );
}

// The single, fixed bucketKey under which a party publishes (and later re-scans) its own recovery snapshot. Uses the
// epoch-0 sentinel so it is found in ONE lookup regardless of how long ago the last keep-alive re-publish happened.
export async function selfRecoveryBucketKey(seed) {
  const kRootSelf = await computeConvKRootSelf(seed);
  const kEpochSelf0 = await computeKEpoch(kRootSelf, CONV_SELF_EPOCH_SENTINEL);
  return computeBucketKey(kEpochSelf0, CONV_DIR_LO_TO_HI, CONV_SELF_EPOCH_SENTINEL);
}

// ---- recovery-lane owner key (§12 durability): the RecoveryShard slot address COMMITS to this pubkey ----
// The RecoveryShard is a distinct lane from the CONV self-capsule above. Its slot key is NOT the CONV bucketKey — it
// is self_bucket_key = H(RS_SLOT_DOMAIN ‖ owner_pubkey ‖ slot_index) (see shard-discovery.recoveryOwnerSlotKey).
// That binding is the squat-close gate 13575: only the holder of the seed that derives owner_pubkey can name — hence
// bind — any of the slots, even after a 3-year eviction frees one. Deterministic from the seed so a reinstalled
// client re-derives the same signing key; the recovery publish signs owner_sig with recoveryOwnerSecret.
//
// PER-SLOT OWNER KEY [W1-015 fix, owner re-approved 2026-07-24 — reverses "ONE OWNER KEY [owner decision 2026-07-19]"].
// The slotIndex is folded into the HKDF info, so every slot gets an INDEPENDENT owner key. WHY: the old shared key was
// public (RecoveryStore body + get_view), so from ONE observed slot an attacker computed H(RS_SLOT_DOMAIN ‖ owner_pubkey
// ‖ i) for every i and enumerated the user's WHOLE recovery trail — slot count and per-slot write timing — and the key
// was seed-stable, a permanent alias across reinstalls and wallet changes. With a per-slot key, observing slot i's
// owner_pubkey reveals nothing about slot j (HKDF is one-way), so the trail cannot be enumerated. The owner still finds
// every slot: they hold the seed and re-derive each key. The contract is agnostic — it only checks the address commits
// to whatever owner_pubkey is bound and verifies that slot's signature against it (13575/13563/13574).
//
// slotIndex is REQUIRED: a missing index would derive the wrong key and bind a slot no restoring client re-derives.
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
