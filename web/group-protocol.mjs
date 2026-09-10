// PLATHO — PRIVATE GROUP PROTOCOL: what a group's capsules SAY, on top of the lanes crypto/group-lane.mjs
// derives. Wire only — no chain, no storage, no UI, and no key schedule (that lives next door).
// The design and the owner's rulings: contracts18/docs/DESIGN-private-groups.md.
//
// ── ON CHAIN A GROUP CAPSULE IS A PRIVATE MESSAGE, BYTE FOR BYTE ──────────────────────────────────────────
//
// [OWNER 2026-09-05] The first draft put a 61-byte cleartext FRAME in header0 — magic, kind, epoch, generation,
// the sender's group key, seq, nonce — because the frame was the AEAD's additional data. Every field was a leak to
// an observer holding nothing: the magic said "group", the kind said "this writer is an admin", the sender key
// linked one member's daily lanes across days, the generation announced every removal, the exact body length told
// the message's size, and the empty header1 was a fifth tell. None of it was needed. A reader already KNOWS the lane
// it is reading (group, day, generation, owner) and the seq the shard stored, so the additional data is REBUILT
// from that context and never written down. The only thing that must travel is the nonce, and it travels in the
// slot a private capsule keeps its own:
//
//   header0 (40)  PH0C ‖ version ‖ publishKind=CONV ‖ sizeClass ‖ suite=HYBRID ‖ 32 random    = convCapsuleHeader0Bytes
//   header1 (30)  PH1B ‖ version ‖ flags=0 ‖ createdAt ‖ createdAt+24h ‖ 16 random           = privateCapsuleHeader1Bytes
//   body          PLB1 ‖ version ‖ suite ‖ flags=1 ‖ 0 ‖ 16 random ‖ NONCE(12) ‖ 32 random ‖ 1088 random ‖ 64 random
//                 ‖ AES-256-GCM( part header(32) ‖ chunk ‖ zero padding to the size class ) ‖ tag(16)
//
// The body is padded to the private lane's own size classes (1/2/4/8/16/32 KiB useful), so length hides to the
// same degree, and a payload larger than one class travels as PARTS in consecutive capsules of the same lane, each
// a whole private-shaped capsule. The contract hashes the three cells and reads nothing inside (RecordShard.
// frameCommit); the CONV reader does not look at header0 either. So the shape is the client's choice, and this one
// costs what a private message costs: the 1,220-byte hybrid prefix and the padding are the price of being
// indistinguishable, and every private message already pays it.
//
//   aad = 'PGA2' ‖ groupId ‖ epoch ‖ generation ‖ senderGroupKey ‖ seq ‖ header0 ‖ header1 ‖ body prefix
//
// A capsule sealed for another lane, day, generation, writer or seq does not open; one whose cleartext was edited
// does not open. The same guarantee the frame gave, without the frame. The kind is under the seal.
//
// ── THE REKEY ENVELOPE ─────────────────────────────────────────────────────────────────────────────────────
//
// A removal starts a new GENERATION from fresh entropy, and every remaining member must receive it. The wrap is
// to each member's PUBLISHED KeyShard keys (hybrid: ML-KEM-768 + X25519), never to any secret the group has
// seen — a per-member secret the group once knew is worthless here, because the member being removed knew it
// too. That is what makes a removal cost bytes: 1,148 per remaining member (measured shape below), one message
// at 50 members and ~19 at 1024, which is the price the design states and the dialog shows.
//
// One ephemeral X25519 key serves the whole envelope (standard multi-recipient ECIES); the ML-KEM ciphertext is
// necessarily per member. Each entry leads with an 8-byte tag derived from the member's own group key, so a
// member finds their entry in one step instead of trying every decapsulation. The tag tells an outsider nothing
// (it needs the group key to compute) and tells a member nothing they do not already hold — the roster.

import { x25519 } from './vendor/@noble/curves/ed25519.js';
import { ml_kem768 } from './vendor/@noble/post-quantum/ml-kem.js';
import { GROUP_ID_BYTES, GROUP_KEY_BYTES } from './crypto/group-lane.mjs?v=5';
// THE PRIVATE LANE'S OWN FIGURES, imported rather than copied: if the private capsule ever changes shape, a group
// capsule must change with it, or it becomes the one thing on the lane that looks different.
import {
  CAPSULE_PUBLISH_KIND, CONTRACT_CRYPTO_SUITE, PLATHO_BINARY_HEADER0_BYTES_CONV, PLATHO_BINARY_HEADER1_BYTES,
  PLATHO_CAPSULE_USEFUL_SIZE_CLASSES, PLATHO_COMPACT_PAYLOAD_PREFIX_BYTES, PLATHO_COMPACT_SENDER_RECOVERY_BYTES,
  PLATHO_COMPACT_TEXT_BLOCK_BYTES,
} from './crypto/platho-crypto.mjs?v=21';

export const GROUP_NONCE_BYTES = 12;
export const GROUP_TAG_BYTES = 16;                              // AES-GCM
export const GROUP_ENTRY_TAG_BYTES = 8;                         // the rekey envelope's per-member hint
export const MLKEM768_CIPHERTEXT_BYTES = 1088;

// ---- the wire: a private message's shape ----
export const GROUP_WIRE_HEADER0_BYTES = PLATHO_BINARY_HEADER0_BYTES_CONV;               // 40
export const GROUP_WIRE_HEADER1_BYTES = PLATHO_BINARY_HEADER1_BYTES;                    // 30
/**
 * 'PLB1' ‖ version ‖ suite ‖ flags=1 ‖ 0 ‖ messageId(16) ‖ nonce(12) ‖ ephemeral(32) ‖ ML-KEM ct(1088) ‖ sender
 * recovery(64): the hybrid prefix WITH the sender-recovery section every private message carries (flags bit 1) —
 * GP-07 caught the first draft without it: a flags byte of 0 and a body 64 bytes short were two tells.
 */
export const GROUP_WIRE_BODY_FLAGS = 1;                                                  // COMPACT_BODY_FLAG_SENDER_RECOVERY
export const GROUP_WIRE_BODY_PREFIX_BYTES = 68 + MLKEM768_CIPHERTEXT_BYTES + PLATHO_COMPACT_SENDER_RECOVERY_BYTES;   // 1220
export const GROUP_WIRE_NONCE_OFFSET = 24;                                               // where a private body keeps its nonce
export const GROUP_PART_MAGIC = 'PGP2';
export const GROUP_PART_HEADER_BYTES = PLATHO_COMPACT_PAYLOAD_PREFIX_BYTES;             // 32, under the seal
export const GROUP_SIZE_CLASSES = PLATHO_CAPSULE_USEFUL_SIZE_CLASSES;                   // useful bytes, 1024 … 32768
/**
 * What one capsule of `sizeClass` carries of OUR payload: the class's useful bytes less the 64 the private lane
 * gives its sender-recovery section. The section is carved out of the useful area, not added to the body — so a
 * group body of class N is exactly as long as a private body of class N (GP-07 pins it against a real one).
 */
export function groupPartCapacity(sizeClass) {
  return Number(sizeClass) * PLATHO_COMPACT_TEXT_BLOCK_BYTES - PLATHO_COMPACT_SENDER_RECOVERY_BYTES;
}
export const GROUP_PART_MAX_BYTES = groupPartCapacity(GROUP_SIZE_CLASSES[GROUP_SIZE_CLASSES.length - 1] / PLATHO_COMPACT_TEXT_BLOCK_BYTES);   // 32,704
/**
 * A room's rekey envelope is ~1.18 MB (GROUP_REKEY_ENTRY_BYTES × 1023): 37 parts. The private lane caps a message
 * at 8 because a person is waiting at a slow terminal; a removal in a room is a deliberate act with its price on
 * the screen, so the bound here is the envelope's, not the typist's.
 */
export const GROUP_MAX_PARTS = 64;
/** What a private capsule's header1 says its life is (DEFAULT_CAPSULE_TTL_MS); GP-07 pins it against a real one. */
export const GROUP_CAPSULE_TTL_SECONDS = 86400;

/** The picture's own header, ahead of the WebP: magic, version, format, size, when it was taken. */
export const GROUP_AVATAR_MAGIC = 'PGA1';
export const GROUP_AVATAR_HEADER_BYTES = 4 + 1 + 1 + 2 + 2 + 4 + 2;   // 16
export const GROUP_AVATAR_FORMAT_WEBP = 1;
/** The writer the avatar lane's additional data names: nobody. The picture is "the group's", not a member's. */
export const GROUP_AVATAR_SENDER = new Uint8Array(32);

/** kem ct + nonce + wrapped key and tag + the entry hint — the per-member cost of a removal. */
export const GROUP_REKEY_ENTRY_BYTES = MLKEM768_CIPHERTEXT_BYTES + GROUP_NONCE_BYTES
  + GROUP_KEY_BYTES + GROUP_TAG_BYTES + GROUP_ENTRY_TAG_BYTES;   // 1156

/** What a capsule is. TEXT is an ordinary message; everything else is the group talking about itself. */
export const GROUP_KIND = Object.freeze({
  TEXT: 1,
  ROSTER: 3,      // the whole membership, as an admin sees it; a newcomer's starting point
  LEAVE: 4,       // "I am gone" — no rekey, and the interface must not pretend otherwise
  REMOVE: 5,      // an admin's removal; carries the rekey envelope when the group chose to cut reading too
  ADMIN: 6,       // the admin set, replaced wholesale, with the old key REVOKED rather than merely superseded
  AVATAR: 7,      // the room's picture — the one capsule sealed OUTSIDE the ratchet, so a newcomer can see it
  ADMIT: 8,       // an admin's delta: these people are in — one small capsule, whatever the room's size
  PROFILE: 9,     // an admin's delta: the room's name, size hint or picture pointer changed
});
/** Kinds that travel in an admin's ROSTER lane (readable by the whole generation, newcomers included). */
export const GROUP_ROSTER_LANE_KINDS = Object.freeze([GROUP_KIND.ROSTER, GROUP_KIND.ADMIT, GROUP_KIND.PROFILE, GROUP_KIND.REMOVE, GROUP_KIND.ADMIN]);
const KIND_VALUES = new Set(Object.values(GROUP_KIND));

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getSubtle() {
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto is required for the group protocol');
  return globalThis.crypto.subtle;
}

function randomBytes(length) {
  const out = new Uint8Array(length);
  if (!globalThis.crypto?.getRandomValues) throw new Error('a CSPRNG is required for the group protocol');
  globalThis.crypto.getRandomValues(out);
  return out;
}

function assertBytes(name, value, length) {
  if (!(value instanceof Uint8Array)) throw new TypeError(`${name} must be a Uint8Array`);
  if (length !== undefined && value.length !== length) {
    throw new RangeError(`${name} must be ${length} bytes, got ${value.length}`);
  }
  return value;
}

function concatBytes(...parts) {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

function u32be(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 0xFFFFFFFF) throw new RangeError(`u32 out of range: ${value}`);
  return new Uint8Array([(n >>> 24) & 0xFF, (n >>> 16) & 0xFF, (n >>> 8) & 0xFF, n & 0xFF]);
}

function readU32be(bytes, offset) {
  return ((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
}

async function hkdf(ikm, salt, info, byteLen) {
  const key = await getSubtle().importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await getSubtle().deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, byteLen * 8);
  return new Uint8Array(bits);
}

async function aesKey(keyBytes, usage) {
  return getSubtle().importKey('raw', assertBytes('key', keyBytes, 32), { name: 'AES-GCM', length: 256 }, false, usage);
}

async function seal(keyBytes, nonce, aad, plaintext) {
  const out = await getSubtle().encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: aad, tagLength: 128 },
    await aesKey(keyBytes, ['encrypt']),
    plaintext,
  );
  return new Uint8Array(out);
}

async function open(keyBytes, nonce, aad, ciphertext) {
  const out = await getSubtle().decrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: aad, tagLength: 128 },
    await aesKey(keyBytes, ['decrypt']),
    ciphertext,
  );
  return new Uint8Array(out);
}

// ── the capsule ────────────────────────────────────────────────────────────────────────────────────────────

/** Which of the private lane's size classes carries `chunkBytes` of payload. */
export function groupSizeClassFor(chunkBytes) {
  for (const useful of GROUP_SIZE_CLASSES) {
    const sizeClass = useful / PLATHO_COMPACT_TEXT_BLOCK_BYTES;
    if (chunkBytes <= groupPartCapacity(sizeClass)) return sizeClass;
  }
  throw new RangeError(`a group part of ${chunkBytes} bytes exceeds the largest capsule (${GROUP_PART_MAX_BYTES})`);
}

/** Bytes on the wire for one capsule of `sizeClass`: both headers and a body the length of a private one. */
export function groupCapsuleWireBytes(sizeClass) {
  return GROUP_WIRE_HEADER0_BYTES + GROUP_WIRE_HEADER1_BYTES + GROUP_WIRE_BODY_PREFIX_BYTES
    + GROUP_PART_HEADER_BYTES + groupPartCapacity(sizeClass) + GROUP_TAG_BYTES;
}

/**
 * How a payload of `totalBytes` travels: how many capsules, which class each, and their weight together. This is
 * what a dialog prices BEFORE anything is signed, from the same arithmetic the sealer then follows.
 */
export function groupCapsulePlan(totalBytes) {
  const total = Number(totalBytes);
  if (!Number.isInteger(total) || total < 0) throw new RangeError(`bad payload length ${totalBytes}`);
  const count = Math.max(1, Math.ceil(total / GROUP_PART_MAX_BYTES));
  if (count > GROUP_MAX_PARTS) throw new RangeError(`a payload of ${total} bytes needs ${count} parts, over ${GROUP_MAX_PARTS}`);
  const parts = [];
  for (let index = 0; index < count; index += 1) {
    const chunkBytes = Math.min(GROUP_PART_MAX_BYTES, total - index * GROUP_PART_MAX_BYTES);
    const sizeClass = groupSizeClassFor(chunkBytes);
    parts.push({ index, chunkBytes, sizeClass, wireBytes: groupCapsuleWireBytes(sizeClass) });
  }
  return { count, parts, wireBytes: parts.reduce((sum, part) => sum + part.wireBytes, 0) };
}

/** The additional data: the lane's whole context, which the reader rebuilds, plus every cleartext byte on the wire. */
function groupAad({ groupId, epoch, generation, senderGroupKey, seq }, header0, header1, bodyPrefix) {
  return concatBytes(
    encoder.encode('PGA2'), assertBytes('groupId', groupId, GROUP_ID_BYTES), u32be(epoch), u32be(generation),
    assertBytes('senderGroupKey', senderGroupKey, 32), u32be(seq), header0, header1, bodyPrefix,
  );
}

// The three cleartext pieces, each the private lane's own layout with random where a private capsule has
// something an observer cannot read anyway (the bucket key, the client nonce, the message id, the ephemeral, the
// KEM ciphertext). GP-07 lays a real private capsule beside one of these and compares field by field.
function privateShapedHeader0(sizeClass, random) {
  return concatBytes(
    encoder.encode('PH0C'),
    new Uint8Array([1, CAPSULE_PUBLISH_KIND.CONV, Number(sizeClass), CONTRACT_CRYPTO_SUITE.HYBRID]),
    random(32),
  );
}

function privateShapedHeader1(createdAtSec, random) {
  return concatBytes(
    encoder.encode('PH1B'), new Uint8Array([1, 0]),
    u32be(createdAtSec), u32be(createdAtSec + GROUP_CAPSULE_TTL_SECONDS), random(16),
  );
}

// THE PRIVATE SENDER-RECOVERY SECTION OPENS WITH A CONSTANT, in cleartext: "PSR1" ‖ nonce(12) ‖ wrapped key(48).
const PRIVATE_SENDER_RECOVERY_MAGIC = encoder.encode('PSR1');

/**
 * THE CLEARTEXT FIELDS ARE SHAPED, NOT RANDOM [audit 2026-09-05, round 1 — three tells, each verified against the
 * private builder]. Random bytes are NOT what a private body carries in three places, and each was a distinguisher:
 *   * bytes 1156..1160 are the constant "PSR1" in every private hybrid capsule (the sender-recovery section's magic,
 *     written in cleartext by encryptSenderRecoverySection) — a 4-byte marker that 64 random bytes fail with
 *     probability 1 - 2^-32, i.e. a single-capsule, deterministic tell;
 *   * bytes 36..68 are an X25519 public key, whose top bit is always 0 (u < 2^255 - 19) — random bytes set it half the
 *     time;
 *   * bytes 68..1156 are an ML-KEM-768 ciphertext, whose 10-bit compressed coefficients are not uniform (257 of the
 *     1,024 values have four preimages mod 3329, the rest three) — separable from random bytes at ~3.6 sigma per
 *     capsule, near-certain over three.
 * So the group writes what a private message writes: a genuine X25519 public key of a throwaway secret, a genuine
 * ML-KEM-768 encapsulation to a throwaway public key, and the magic ahead of 60 bytes that are, in the private
 * capsule, a random nonce and an AES-GCM ciphertext — both indistinguishable from random. The draws come from
 * `random` in this order, so a gate with a seeded stream can rebuild every field: message id 16, X25519 seed 32,
 * ML-KEM keygen seed 64, ML-KEM encapsulation coins 32, recovery tail 60 (the nonce was drawn by the caller).
 */
function privateShapedBodyPrefix(nonce, random) {
  const messageId = random(16);
  const ephemeral = x25519.getPublicKey(random(32));
  const kem = ml_kem768.keygen(random(64));
  const kemCiphertext = ml_kem768.encapsulate(kem.publicKey, random(32)).cipherText;
  return concatBytes(
    encoder.encode('PLB1'), new Uint8Array([1, CONTRACT_CRYPTO_SUITE.HYBRID, GROUP_WIRE_BODY_FLAGS, 0]), messageId,
    assertBytes('nonce', nonce, GROUP_NONCE_BYTES), assertBytes('ephemeral', ephemeral, 32),
    assertBytes('kem ciphertext', kemCiphertext, MLKEM768_CIPHERTEXT_BYTES),
    PRIVATE_SENDER_RECOVERY_MAGIC, random(PLATHO_COMPACT_SENDER_RECOVERY_BYTES - PRIVATE_SENDER_RECOVERY_MAGIC.length),
  );
}

/**
 * Seal one payload into one or more capsules, each shaped as a private message of its size class.
 *
 * `context` is the lane — { groupId, epoch, generation, senderGroupKey } — and the reader rebuilds it from where
 * it found the capsule, which is why none of it is written down. `firstSeq` is part 0's seq; parts take
 * consecutive seqs in the same lane. `random` is injectable so a test can lay the bytes out deterministically.
 */
export async function sealGroupCapsules({ contentKey, kind, payload, context, firstSeq, sentAt, createdAtSec = sentAt, random = randomBytes }) {
  assertBytes('contentKey', contentKey, GROUP_KEY_BYTES);
  assertBytes('payload', payload);
  if (!KIND_VALUES.has(Number(kind))) throw new RangeError(`unknown group capsule kind ${kind}`);
  const plan = groupCapsulePlan(payload.length);
  const msgTag = random(4);
  const out = [];
  for (const part of plan.parts) {
    const seq = Number(firstSeq) + part.index;
    const header0 = privateShapedHeader0(part.sizeClass, random);
    const header1 = privateShapedHeader1(Number(createdAtSec), random);
    const nonce = random(GROUP_NONCE_BYTES);
    const prefix = privateShapedBodyPrefix(nonce, random);
    const plain = new Uint8Array(GROUP_PART_HEADER_BYTES + groupPartCapacity(part.sizeClass));   // the zero padding IS the class
    plain.set(encoder.encode(GROUP_PART_MAGIC), 0);
    const view = new DataView(plain.buffer);
    view.setUint8(4, Number(kind));
    view.setUint8(5, part.index);
    view.setUint8(6, plan.count);
    view.setUint8(7, 0);
    plain.set(msgTag, 8);
    view.setUint32(12, payload.length);
    view.setUint32(16, part.chunkBytes);
    view.setUint32(20, Number(sentAt) >>> 0);
    const from = part.index * GROUP_PART_MAX_BYTES;
    plain.set(payload.subarray(from, from + part.chunkBytes), GROUP_PART_HEADER_BYTES);
    const sealed = await seal(contentKey, nonce, groupAad({ ...context, seq }, header0, header1, prefix), plain);
    out.push({ seq, sizeClass: part.sizeClass, header0, header1, body: concatBytes(prefix, sealed), wireBytes: part.wireBytes });
  }
  return out;
}

/**
 * Open one capsule found in a lane. `context` is where it was found and `seq` what the shard stored it under; a
 * capsule from another lane, day, generation or writer — or one whose cleartext was edited — fails the tag.
 */
export async function openGroupCapsule({ contentKey, context, seq, header0, header1, body }) {
  assertBytes('contentKey', contentKey, GROUP_KEY_BYTES);
  assertBytes('header0', header0, GROUP_WIRE_HEADER0_BYTES);
  assertBytes('header1', header1, GROUP_WIRE_HEADER1_BYTES);
  assertBytes('body', body);
  if (body.length < GROUP_WIRE_BODY_PREFIX_BYTES + GROUP_PART_HEADER_BYTES + GROUP_TAG_BYTES) throw new RangeError('group body too short');
  const prefix = body.subarray(0, GROUP_WIRE_BODY_PREFIX_BYTES);
  const nonce = body.subarray(GROUP_WIRE_NONCE_OFFSET, GROUP_WIRE_NONCE_OFFSET + GROUP_NONCE_BYTES);
  const aad = groupAad({ ...context, seq: Number(seq) }, header0, header1, prefix);
  const plain = await open(contentKey, nonce, aad, body.subarray(GROUP_WIRE_BODY_PREFIX_BYTES));
  if (decoder.decode(plain.subarray(0, 4)) !== GROUP_PART_MAGIC) throw new Error('not a group part');
  const view = new DataView(plain.buffer, plain.byteOffset, plain.byteLength);
  const kind = view.getUint8(4);
  if (!KIND_VALUES.has(kind)) throw new RangeError(`unknown group capsule kind ${kind}`);
  const chunkBytes = view.getUint32(16);
  if (GROUP_PART_HEADER_BYTES + chunkBytes > plain.length) throw new RangeError('a part chunk overruns its capsule');
  return {
    kind,
    part: view.getUint8(5),
    parts: view.getUint8(6),
    msgTag: hex(plain.subarray(8, 12)),
    totalBytes: view.getUint32(12),
    chunkBytes,
    sentAt: view.getUint32(20),
    seq: Number(seq),
    chunk: plain.slice(GROUP_PART_HEADER_BYTES, GROUP_PART_HEADER_BYTES + chunkBytes),
  };
}

/**
 * A payload back out of its parts. Null while any part is missing: the caller simply reads the lane again on its
 * next pass, and nothing half-built is ever stored or shown.
 */
export function assembleGroupParts(parts) {
  const ordered = [...parts].sort((a, b) => a.part - b.part);
  if (ordered.length === 0) return null;
  const { parts: count, totalBytes: total, msgTag } = ordered[0];
  if (ordered.length !== count) return null;
  // BOUNDED BY WHAT THE LANE CAN CARRY, before anything is allocated [audit 2026-09-05, round 1]. `totalBytes` is a
  // member-written header field; a hostile 0xFFFFFFFF allocated four gigabytes here, outside the reader's try,
  // and took every other lane's rows of the pass down with it. No honest payload exceeds GROUP_MAX_PARTS capsules
  // of the largest class.
  if (!Number.isInteger(total) || total < 0 || total > GROUP_MAX_PARTS * GROUP_SIZE_CLASSES[GROUP_SIZE_CLASSES.length - 1]) return null;
  const out = new Uint8Array(total);
  let at = 0;
  for (let index = 0; index < count; index += 1) {
    const piece = ordered[index];
    if (piece.part !== index || piece.parts !== count || piece.totalBytes !== total || piece.msgTag !== msgTag) return null;
    if (at + piece.chunk.length > total) return null;
    out.set(piece.chunk, at);
    at += piece.chunk.length;
  }
  return at === total ? out : null;
}

// ── payloads ───────────────────────────────────────────────────────────────────────────────────────────────
//
// Every payload is JSON under the seal. It is the one place in this lane where a few bytes of shape are worth
// more than a few bytes of size: a group's control messages have to survive being read by a client older or
// newer than the one that wrote them, and an unknown field must be ignorable rather than fatal.

function encodeJson(value) {
  return encoder.encode(JSON.stringify(value));
}

function decodeJson(payload) {
  return JSON.parse(decoder.decode(payload));
}

const hex = (bytes) => [...assertBytes('bytes', bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (text) => {
  if (typeof text !== 'string' || text.length % 2 !== 0 || /[^0-9a-f]/i.test(text)) throw new TypeError('bad hex');
  const out = new Uint8Array(text.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(text.slice(i * 2, i * 2 + 2), 16);
  return out;
};

export function encodeGroupText({ text, replyTo = null, sentAt }) {
  if (typeof text !== 'string') throw new TypeError('group text must be a string');
  return encodeJson({ v: 1, text, ...(replyTo ? { replyTo } : {}), sentAt: Number(sentAt) });
}

// ── members, in a compact record ────────────────────────────────────────────────────────────────────────────
//
// groupKey(32) ‖ flags(1: bit0 x25519, bit1 ML-KEM) ‖ [x25519 32] ‖ [ML-KEM 1184] ‖ wallet(u8 len ‖ bytes)
// ‖ keyId(u8 len ‖ bytes) ‖ name(u16 len ‖ bytes). About 1,340 bytes with both keys — 1,024 members are ~1.4 MB,
// 42 capsules, under GROUP_MAX_PARTS; as hex-in-JSON they were 2.7 MB and did not fit.
export const GROUP_MEMBER_X25519_BYTES = 32;
export const GROUP_MEMBER_MLKEM_BYTES = 1184;

function lenPrefixed(bytes, width) {
  if (width === 1 && bytes.length > 255) throw new RangeError('field longer than 255 bytes');
  if (width === 2 && bytes.length > 65535) throw new RangeError('field longer than 65535 bytes');
  const head = width === 1 ? new Uint8Array([bytes.length]) : new Uint8Array([(bytes.length >>> 8) & 0xff, bytes.length & 0xff]);
  return concatBytes(head, bytes);
}

export function encodeGroupMembers(members) {
  const out = [new Uint8Array([(members.length >>> 8) & 0xff, members.length & 0xff])];
  for (const m of members) {
    const flags = (m.x25519PublicKey ? 1 : 0) | (m.mlKem768PublicKey ? 2 : 0);
    out.push(assertBytes('groupKey', m.groupKey, 32), new Uint8Array([flags]));
    if (m.x25519PublicKey) out.push(assertBytes('x25519PublicKey', m.x25519PublicKey, GROUP_MEMBER_X25519_BYTES));
    if (m.mlKem768PublicKey) out.push(assertBytes('mlKem768PublicKey', m.mlKem768PublicKey, GROUP_MEMBER_MLKEM_BYTES));
    out.push(lenPrefixed(encoder.encode(String(m.wallet ?? '')), 1));
    out.push(lenPrefixed(encoder.encode(String(m.keyId ?? '')), 1));
    out.push(lenPrefixed(encoder.encode(String(m.name ?? '')), 2));
  }
  return concatBytes(...out);
}

export function decodeGroupMembers(bytes, offset = 0) {
  assertBytes('bytes', bytes);
  let at = offset;
  const need = (n) => { if (at + n > bytes.length) throw new RangeError('member record overruns the payload'); };
  need(2);
  const count = (bytes[at] << 8) | bytes[at + 1]; at += 2;
  const members = [];
  const field = (width) => {
    need(width);
    const len = width === 1 ? bytes[at] : (bytes[at] << 8) | bytes[at + 1]; at += width;
    need(len);
    const text = decoder.decode(bytes.subarray(at, at + len)); at += len;
    return text;
  };
  for (let i = 0; i < count; i += 1) {
    need(33);
    const groupKey = bytes.slice(at, at + 32); at += 32;
    const flags = bytes[at]; at += 1;
    let x25519PublicKey = null; let mlKem768PublicKey = null;
    if (flags & 1) { need(GROUP_MEMBER_X25519_BYTES); x25519PublicKey = bytes.slice(at, at + GROUP_MEMBER_X25519_BYTES); at += GROUP_MEMBER_X25519_BYTES; }
    if (flags & 2) { need(GROUP_MEMBER_MLKEM_BYTES); mlKem768PublicKey = bytes.slice(at, at + GROUP_MEMBER_MLKEM_BYTES); at += GROUP_MEMBER_MLKEM_BYTES; }
    const wallet = field(1); const keyId = field(1); const name = field(2);
    members.push({ groupKey, wallet: wallet || null, keyId: keyId || null, name: name || null, x25519PublicKey, mlKem768PublicKey });
  }
  return { members, offset: at };
}

/** How many bytes `members` weigh in the record above — what a snapshot or an admission will cost, before sealing. */
export function groupMembersBytes(members) {
  return 2 + members.reduce((sum, m) => sum + 33 + (m.x25519PublicKey ? GROUP_MEMBER_X25519_BYTES : 0)
    + (m.mlKem768PublicKey ? GROUP_MEMBER_MLKEM_BYTES : 0)
    + 1 + encoder.encode(String(m.wallet ?? '')).length + 1 + encoder.encode(String(m.keyId ?? '')).length
    + 2 + encoder.encode(String(m.name ?? '')).length, 0);
}

/**
 * THE SNAPSHOT: the roster whole, as an admin sees it — the room's name, size hint, picture pointer, admins, and
 * every member with the KeyShard keys a REKEY must wrap to. Published into the admin's ROSTER lane every so often;
 * a newcomer starts from the one the invite points at and reads the deltas after it.
 *   u32 headLen ‖ head JSON ‖ members
 */
export function encodeGroupRoster({ members, admins, name = null, sizeHint = null, avatar = null, sentAt = 0, asOf = null }) {
  const head = encodeJson({
    v: 1,
    ...(name ? { name } : {}),
    ...(sizeHint ? { sizeHint: Number(sizeHint) } : {}),
    // WHAT THIS SNAPSHOT HAD SEEN when it was taken [audit 2026-09-06, round 3]: per admin (hex), the highest
    // (epoch, seq) of that admin's roster rows the publisher had folded. A roster is published WHOLE, and its chain
    // stamp is later than any delta it did not see — so a fold that applied the wholesale roster after those deltas
    // un-admitted or re-admitted them. With `asOf` the reader replays every delta beyond it after the roster.
    ...(asOf && typeof asOf === 'object' && Object.keys(asOf).length > 0
      ? { asOf: Object.fromEntries(Object.entries(asOf).map(([admin, at]) => [String(admin), { epoch: Number(at.epoch), seq: Number(at.seq) }])) }
      : {}),
    // WHERE THE ROOM'S PICTURE IS, and which bytes are really it. The lane is derivable from the group id alone,
    // so this pointer is enough for a member who joined this morning to fetch a picture published a year ago.
    ...(avatar ? {
      avatar: {
        epoch: Number(avatar.epoch), seq: Number(avatar.seq), parts: Number(avatar.parts),
        hash: String(avatar.hash), w: Number(avatar.width) || 0, h: Number(avatar.height) || 0,
      },
    } : {}),
    admins: admins.map((a) => hex(a)),
    sentAt: Number(sentAt),
  });
  return concatBytes(u32be(head.length), head, encodeGroupMembers(members));
}

function decodeAvatarPointer(value) {
  return value
    ? {
      epoch: Number(value.epoch), seq: Number(value.seq), parts: Number(value.parts),
      hash: String(value.hash), width: Number(value.w) || 0, height: Number(value.h) || 0,
    }
    : null;
}

function decodeGroupRoster(payload) {
  assertBytes('payload', payload);
  if (payload.length < 4) throw new RangeError('roster payload too short');
  const headLen = readU32be(payload, 0);
  const value = decodeJson(payload.subarray(4, 4 + headLen));
  if (Number(value?.v) !== 1) throw new RangeError(`unsupported group payload version ${value?.v}`);
  const { members } = decodeGroupMembers(payload, 4 + headLen);
  const asOf = {};
  for (const [admin, at] of Object.entries(value.asOf ?? {})) {
    if (typeof admin !== 'string' || !/^[0-9a-f]{64}$/i.test(admin)) continue;
    const epoch = Number(at?.epoch); const seq = Number(at?.seq);
    if (Number.isFinite(epoch) && Number.isFinite(seq)) asOf[admin.toLowerCase()] = { epoch, seq };
  }
  return {
    name: value.name ?? null,
    sizeHint: value.sizeHint ?? null,
    avatar: decodeAvatarPointer(value.avatar),
    admins: (value.admins ?? []).map(unhex),
    members,
    sentAt: Number(value.sentAt ?? 0),
    asOf,
  };
}

/** An admission: the new members, and nothing else — one small capsule whatever the room's size. */
export function encodeGroupAdmit({ members, sentAt }) {
  return concatBytes(u32be(Number(sentAt) >>> 0), encodeGroupMembers(members));
}

function decodeGroupAdmit(payload) {
  assertBytes('payload', payload);
  if (payload.length < 6) throw new RangeError('admit payload too short');
  return { sentAt: readU32be(payload, 0), members: decodeGroupMembers(payload, 4).members };
}

/** The room's name, size hint or picture pointer, changed — a small delta where a whole roster used to go. */
export function encodeGroupProfile({ name = undefined, sizeHint = undefined, avatar = undefined, sentAt }) {
  return encodeJson({
    v: 1,
    ...(name === undefined ? {} : { name }),
    ...(sizeHint === undefined ? {} : { sizeHint: sizeHint === null ? null : Number(sizeHint) }),
    ...(avatar === undefined ? {} : {
      avatar: avatar ? {
        epoch: Number(avatar.epoch), seq: Number(avatar.seq), parts: Number(avatar.parts),
        hash: String(avatar.hash), w: Number(avatar.width) || 0, h: Number(avatar.height) || 0,
      } : null,
    }),
    sentAt: Number(sentAt),
  });
}

export function encodeGroupLeave({ groupKey, sentAt }) {
  return encodeJson({ v: 1, groupKey: hex(groupKey), sentAt: Number(sentAt) });
}

/**
 * A removal. `envelope` is present only when the group also cut the removed member's READING — the expensive
 * half, which the dialog prices and the user chooses (in a room of a thousand it buys little: the key is already
 * held by a thousand people).
 */
export function encodeGroupRemove({ groupKey, generation, envelope = null, sentAt }) {
  // The envelope rides as RAW BYTES after a JSON head, not as hex inside the JSON: at 50 members it is 56,688
  // bytes, and hex would have doubled it — past what any capsule can carry. `u32 headLen ‖ head ‖ envelope`.
  const head = encodeJson({
    v: 1, groupKey: hex(groupKey), generation: Number(generation), sentAt: Number(sentAt),
    envelope: envelope ? assertBytes('envelope', envelope).length : 0,
  });
  return concatBytes(u32be(head.length), head, envelope ?? new Uint8Array(0));
}

function decodeGroupRemove(payload) {
  assertBytes('payload', payload);
  if (payload.length < 4) throw new RangeError('remove payload too short');
  const headLen = readU32be(payload, 0);
  const value = decodeJson(payload.subarray(4, 4 + headLen));
  if (Number(value?.v) !== 1) throw new RangeError(`unsupported group payload version ${value?.v}`);
  const envelopeBytes = Number(value.envelope ?? 0);
  if (4 + headLen + envelopeBytes > payload.length) throw new RangeError('remove envelope overruns the payload');
  return {
    groupKey: unhex(value.groupKey),
    generation: Number(value.generation),
    envelope: envelopeBytes > 0 ? payload.slice(4 + headLen, 4 + headLen + envelopeBytes) : null,
    sentAt: Number(value.sentAt ?? 0),
  };
}

/** The admin set, replaced wholesale — never "added to", so a revoked key cannot survive by being forgotten. */
export function encodeGroupAdmins({ admins, sentAt }) {
  return encodeJson({ v: 1, admins: admins.map((a) => hex(a)), sentAt: Number(sentAt) });
}

/**
 * The room's picture as ONE payload: a 16-byte header and the WebP itself. Not JSON — an image is the one payload
 * where the bytes are the point and this lane charges by the byte; base64 inside JSON would add a third. Splitting
 * into capsules is the capsule layer's job (sealGroupCapsules), the same as for any payload.
 */
export function encodeGroupAvatar({ bytes, width, height, sentAt, format = GROUP_AVATAR_FORMAT_WEBP }) {
  assertBytes('bytes', bytes);
  if (bytes.length === 0) throw new RangeError('an avatar cannot be empty');
  const out = new Uint8Array(GROUP_AVATAR_HEADER_BYTES + bytes.length);
  out.set(encoder.encode(GROUP_AVATAR_MAGIC), 0);
  const view = new DataView(out.buffer);
  view.setUint8(4, 1);                       // version
  view.setUint8(5, Number(format));
  view.setUint16(6, Number(width) & 0xffff);
  view.setUint16(8, Number(height) & 0xffff);
  view.setUint32(10, Number(sentAt) >>> 0);
  out.set(bytes, GROUP_AVATAR_HEADER_BYTES);
  return out;
}

function decodeGroupAvatar(payload) {
  assertBytes('payload', payload);
  if (payload.length < GROUP_AVATAR_HEADER_BYTES) throw new RangeError('avatar payload is shorter than its header');
  if (decoder.decode(payload.subarray(0, 4)) !== GROUP_AVATAR_MAGIC) throw new RangeError('not a group avatar');
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const version = view.getUint8(4);
  if (version !== 1) throw new RangeError(`unsupported avatar version ${version}`);
  return {
    format: view.getUint8(5),
    width: view.getUint16(6),
    height: view.getUint16(8),
    sentAt: view.getUint32(10),
    bytes: payload.slice(GROUP_AVATAR_HEADER_BYTES),
  };
}

/** The sha-256 a roster names and a reader checks — the only thing that decides which bytes ARE the picture. */
export async function groupAvatarHash(bytes) {
  return hex(new Uint8Array(await getSubtle().digest('SHA-256', assertBytes('bytes', bytes))));
}

export function decodeGroupPayload(kind, payload) {
  // The two binary payloads first; everything else is JSON under the seal.
  if (Number(kind) === GROUP_KIND.AVATAR) return decodeGroupAvatar(payload);
  if (Number(kind) === GROUP_KIND.REMOVE) return decodeGroupRemove(payload);
  if (Number(kind) === GROUP_KIND.ROSTER) return decodeGroupRoster(payload);
  if (Number(kind) === GROUP_KIND.ADMIT) return decodeGroupAdmit(payload);
  const value = decodeJson(payload);
  if (Number(value?.v) !== 1) throw new RangeError(`unsupported group payload version ${value?.v}`);
  switch (Number(kind)) {
    case GROUP_KIND.TEXT:
      return { text: String(value.text ?? ''), replyTo: value.replyTo ?? null, sentAt: Number(value.sentAt ?? 0) };
    case GROUP_KIND.PROFILE:
      return {
        ...('name' in value ? { name: value.name ?? null } : {}),
        ...('sizeHint' in value ? { sizeHint: value.sizeHint ?? null } : {}),
        ...('avatar' in value ? { avatar: decodeAvatarPointer(value.avatar) } : {}),
        sentAt: Number(value.sentAt ?? 0),
      };
    case GROUP_KIND.LEAVE:
      return { groupKey: unhex(value.groupKey), sentAt: Number(value.sentAt ?? 0) };
    case GROUP_KIND.ADMIN:
      return { admins: (value.admins ?? []).map(unhex), sentAt: Number(value.sentAt ?? 0) };
    default:
      throw new RangeError(`unknown group capsule kind ${kind}`);
  }
}

// ── the rekey envelope ─────────────────────────────────────────────────────────────────────────────────────

const REKEY_SALT = 'PLATHO.GROUP.REKEY.SALT.V1';
const REKEY_INFO = 'PLATHO.GROUP.REKEY.V1';
const REKEY_TAG_SALT = 'PLATHO.GROUP.REKEY.TAG.SALT.V1';
const REKEY_TAG_INFO = 'PLATHO.GROUP.REKEY.TAG.V1';

async function rekeyEntryTag({ groupId, memberGroupKey, generation }) {
  return hkdf(
    memberGroupKey,
    encoder.encode(REKEY_TAG_SALT),
    concatBytes(encoder.encode(REKEY_TAG_INFO), groupId, u32be(generation)),
    GROUP_ENTRY_TAG_BYTES,
  );
}

async function rekeyWrapKey({ groupId, generation, kemShared, dhShared, memberGroupKey }) {
  return hkdf(
    concatBytes(kemShared, dhShared),
    encoder.encode(REKEY_SALT),
    concatBytes(encoder.encode(REKEY_INFO), groupId, u32be(generation), memberGroupKey),
    GROUP_KEY_BYTES,
  );
}

/**
 * Wrap `newKey` for every member. `members` need their PUBLISHED KeyShard keys — nothing derived from the group,
 * because the member being removed holds everything the group ever knew.
 *
 * Layout: 'PGR1' ‖ generation u32 ‖ count u32 ‖ ephemeral X25519 pub 32 ‖ count × entry,
 * entry = tag 8 ‖ kem_ct 1088 ‖ nonce 12 ‖ wrapped 48.
 */
/**
 * ARE THESE KEYS ONES A REKEY CAN WRAP TO? [audit 2026-09-05, round 2] A member announces their KeyShard keys in the
 * join token and the admin writes them into the roster unchecked. An ML-KEM-768 public key that fails the modulus
 * check, or an X25519 key that is a low-order point, THROWS in the vendored primitives — and it threw inside
 * `sealGroupRekeyEnvelope`, so one malformed member blocked every later removal-with-rekey of anyone else, with
 * nothing telling the admin why. Checked where the keys enter (the token, the admit) by doing what the rekey will do.
 */
export function isValidMemberKeys({ x25519PublicKey = null, mlKem768PublicKey = null } = {}) {
  // Keys are OPTIONAL — a member without them simply cannot be wrapped to (groupRemovalPlan counts them as
  // `missingKeys`); what is refused is a key that is PRESENT and malformed, or one half without the other.
  if (!x25519PublicKey && !mlKem768PublicKey) return true;
  if (!(x25519PublicKey instanceof Uint8Array) || x25519PublicKey.length !== 32) return false;
  if (!(mlKem768PublicKey instanceof Uint8Array) || mlKem768PublicKey.length !== 1184) return false;
  try {
    x25519.getSharedSecret(x25519.utils.randomSecretKey(), x25519PublicKey);
    ml_kem768.encapsulate(mlKem768PublicKey);
    return true;
  } catch { return false; }
}

export async function sealGroupRekeyEnvelope({ groupId, generation, newKey, members, ephemeralSecret, onSkipped = null }) {
  assertBytes('groupId', groupId, GROUP_ID_BYTES);
  assertBytes('newKey', newKey, GROUP_KEY_BYTES);
  if (!Array.isArray(members) || members.length === 0) throw new RangeError('a rekey needs at least one recipient');
  const eph = ephemeralSecret === undefined ? x25519.utils.randomSecretKey() : assertBytes('ephemeralSecret', ephemeralSecret, 32);
  const ephPublic = x25519.getPublicKey(eph);
  const entries = [];
  for (const member of members) {
    // A MEMBER WHOSE KEYS CANNOT BE WRAPPED TO IS SKIPPED, NOT FATAL [audit 2026-09-05, round 2]: they will not read
    // the new generation (as if removed), the rest of the room goes on. The caller is told who.
    try {
      const memberGroupKey = assertBytes('member.groupKey', member.groupKey, 32);
      const kem = ml_kem768.encapsulate(assertBytes('member.mlKem768PublicKey', member.mlKem768PublicKey, 1184));
      const dhShared = x25519.getSharedSecret(eph, assertBytes('member.x25519PublicKey', member.x25519PublicKey, 32));
      const wrapKey = await rekeyWrapKey({ groupId, generation, kemShared: kem.sharedSecret, dhShared, memberGroupKey });
      const nonce = randomBytes(GROUP_NONCE_BYTES);
      const tag = await rekeyEntryTag({ groupId, memberGroupKey, generation });
      const wrapped = await seal(wrapKey, nonce, concatBytes(groupId, u32be(generation), tag), newKey);
      entries.push(concatBytes(tag, kem.cipherText, nonce, wrapped));
    } catch (error) {
      try { onSkipped?.(member, error); } catch { /* a listener must not break the seal */ }
    }
  }
  if (entries.length === 0) throw new RangeError('a rekey could wrap to no recipient');
  return concatBytes(
    encoder.encode('PGR1'), u32be(generation), u32be(entries.length), ephPublic, ...entries,
  );
}

/**
 * Find this member's entry and unwrap the new generation key. Returns null when the envelope simply is not for
 * this member — which is the ordinary case for anyone reading a removal they were not part of, and must not be
 * an error.
 */
export async function openGroupRekeyEnvelope({ groupId, envelope, memberGroupKey, x25519SecretKey, mlKem768SecretKey }) {
  assertBytes('envelope', envelope);
  assertBytes('memberGroupKey', memberGroupKey, 32);
  if (envelope.length < 12 + 32) throw new RangeError('rekey envelope is truncated');
  if (decoder.decode(envelope.subarray(0, 4)) !== 'PGR1') throw new Error('not a rekey envelope');
  const generation = readU32be(envelope, 4);
  const count = readU32be(envelope, 8);
  const ephPublic = envelope.slice(12, 44);
  const entrySize = GROUP_REKEY_ENTRY_BYTES;
  if (envelope.length !== 44 + count * entrySize) throw new RangeError('rekey envelope length does not match its count');
  const tag = await rekeyEntryTag({ groupId, memberGroupKey, generation });
  for (let i = 0; i < count; i += 1) {
    const at = 44 + i * entrySize;
    let mine = true;
    for (let b = 0; b < GROUP_ENTRY_TAG_BYTES; b += 1) if (envelope[at + b] !== tag[b]) { mine = false; break; }
    if (!mine) continue;
    const kemCipherText = envelope.slice(at + GROUP_ENTRY_TAG_BYTES, at + GROUP_ENTRY_TAG_BYTES + MLKEM768_CIPHERTEXT_BYTES);
    const nonceAt = at + GROUP_ENTRY_TAG_BYTES + MLKEM768_CIPHERTEXT_BYTES;
    const nonce = envelope.slice(nonceAt, nonceAt + GROUP_NONCE_BYTES);
    const wrapped = envelope.slice(nonceAt + GROUP_NONCE_BYTES, at + entrySize);
    const kemShared = ml_kem768.decapsulate(kemCipherText, assertBytes('mlKem768SecretKey', mlKem768SecretKey, 2400));
    const dhShared = x25519.getSharedSecret(assertBytes('x25519SecretKey', x25519SecretKey, 32), ephPublic);
    const wrapKey = await rekeyWrapKey({ groupId, generation, kemShared, dhShared, memberGroupKey });
    const key = await open(wrapKey, nonce, concatBytes(groupId, u32be(generation), tag), wrapped);
    return { generation, key: assertBytes('unwrapped key', key, GROUP_KEY_BYTES) };
  }
  return null;
}

// ── the invite token ───────────────────────────────────────────────────────────────────────────────────────

/** The prefix a receiving client recognises. Deliberately unmistakable: it must never be shown as words. */
export const GROUP_INVITE_PREFIX = 'platho.group.invite.v1:';

const B64URL = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const UNB64URL = (text) => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

/**
 * The secret an invite carries, as one token: the group id and TODAY'S key, where the inviter's lane is, and the
 * name to show. Not the roster — an invite must not grow with the room; the newcomer reads the roster from the
 * group itself once the key lets them.
 */
export function encodeGroupInviteToken(secret) {
  const payload = encodeJson({
    v: 1,
    g: String(secret.groupId),
    k: String(secret.key),
    e: Number(secret.epoch),
    n: Number(secret.generation),
    ...(secret.name ? { t: String(secret.name) } : {}),
    ...(secret.sizeHint ? { s: Number(secret.sizeHint) } : {}),
    ...(secret.inviter ? { i: String(secret.inviter) } : {}),
    // THE ROSTER KEY of the generation and WHERE THE LAST SNAPSHOT IS: with these a newcomer reads the whole
    // membership — the snapshot, then every admission after it — without holding a single earlier day key.
    ...(secret.rosterKey ? { r: String(secret.rosterKey) } : {}),
    ...(secret.snapshot ? {
      p: {
        e: Number(secret.snapshot.epoch), g: Number(secret.snapshot.generation),
        a: String(secret.snapshot.admin), s: Number(secret.snapshot.seq), n: Number(secret.snapshot.parts),
      },
    } : {}),
  });
  return `${GROUP_INVITE_PREFIX}${B64URL(payload)}`;
}

/** Null when the text is an ordinary message, which is every message but these. */
/**
 * THE ANSWER TO AN INVITE, and the whole of joining. The newcomer's group key comes from their own vault seed, so
 * only they can say it — and they say it back in the SAME private conversation the invite came in. No lobby lane
 * on the chain: a shared-key lobby was a lane any member could jam (4,096 writes a day) and one whose payers were
 * visibly the same day's joiners. The admin's device reads this token as a private message and admits.
 *
 * It carries the KeyShard public keys too (x, m): without them the rekey envelope of a later removal would have
 * nobody to wrap to, and "cut their reading" would silently do nothing.
 */
export const GROUP_JOIN_PREFIX = 'platho.group.join.v1:';
export function encodeGroupJoinToken({ groupId, groupKey, wallet, keyId, name = null, x25519PublicKey = null, mlKem768PublicKey = null }) {
  const payload = encodeJson({
    v: 1,
    g: typeof groupId === 'string' ? groupId : hex(groupId),
    k: hex(groupKey),
    w: String(wallet ?? ''),
    i: String(keyId ?? ''),
    ...(name ? { t: String(name) } : {}),
    ...(x25519PublicKey ? { x: hex(x25519PublicKey) } : {}),
    ...(mlKem768PublicKey ? { m: hex(mlKem768PublicKey) } : {}),
  });
  return `${GROUP_JOIN_PREFIX}${B64URL(payload)}`;
}
export function parseGroupJoinToken(text) {
  const value = String(text ?? '').trim();
  if (!value.startsWith(GROUP_JOIN_PREFIX)) return null;
  try {
    const decoded = decodeJson(UNB64URL(value.slice(GROUP_JOIN_PREFIX.length)));
    if (Number(decoded?.v) !== 1) return null;
    if (typeof decoded.g !== 'string' || typeof decoded.k !== 'string') return null;
    return {
      groupId: decoded.g,
      groupKey: unhex(decoded.k),
      wallet: decoded.w ? String(decoded.w) : null,
      keyId: decoded.i ? String(decoded.i) : null,
      name: decoded.t ?? null,
      x25519PublicKey: decoded.x ? unhex(decoded.x) : null,
      mlKem768PublicKey: decoded.m ? unhex(decoded.m) : null,
    };
  } catch {
    return null;
  }
}

export function parseGroupInviteToken(text) {
  const value = String(text ?? '').trim();
  if (!value.startsWith(GROUP_INVITE_PREFIX)) return null;
  try {
    const decoded = decodeJson(UNB64URL(value.slice(GROUP_INVITE_PREFIX.length)));
    if (Number(decoded?.v) !== 1) return null;
    if (typeof decoded.g !== 'string' || typeof decoded.k !== 'string') return null;
    return {
      groupId: decoded.g,
      key: decoded.k,
      epoch: Number(decoded.e),
      generation: Number(decoded.n),
      name: decoded.t ?? null,
      sizeHint: decoded.s ?? null,
      inviter: decoded.i ?? null,
      rosterKey: typeof decoded.r === 'string' ? decoded.r : null,
      snapshot: decoded.p && typeof decoded.p === 'object'
        ? {
          epoch: Number(decoded.p.e), generation: Number(decoded.p.g), admin: String(decoded.p.a),
          seq: Number(decoded.p.s), parts: Number(decoded.p.n),
        }
        : null,
    };
  } catch {
    return null;
  }
}

/** What a removal will COST in bytes at this size — what the dialog shows before anyone presses anything. */
export function groupRekeyEnvelopeBytes(memberCount) {
  const n = Number(memberCount);
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`memberCount out of range: ${memberCount}`);
  return 44 + n * GROUP_REKEY_ENTRY_BYTES;
}
