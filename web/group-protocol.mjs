
import { x25519 } from './vendor/@noble/curves/ed25519.js';
import { ml_kem768 } from './vendor/@noble/post-quantum/ml-kem.js';
import { GROUP_ID_BYTES, GROUP_KEY_BYTES } from './crypto/group-lane.mjs?v=8';
import {
  CAPSULE_PUBLISH_KIND, CONTRACT_CRYPTO_SUITE, PLATHO_BINARY_HEADER0_BYTES_CONV, PLATHO_BINARY_HEADER1_BYTES,
  PLATHO_CAPSULE_USEFUL_SIZE_CLASSES, PLATHO_COMPACT_PAYLOAD_PREFIX_BYTES, PLATHO_COMPACT_SENDER_RECOVERY_BYTES,
  PLATHO_COMPACT_TEXT_BLOCK_BYTES,
} from './crypto/platho-crypto.mjs?v=31';

export const GROUP_NONCE_BYTES = 12;
export const GROUP_TAG_BYTES = 16;
export const GROUP_ENTRY_TAG_BYTES = 8;
export const MLKEM768_CIPHERTEXT_BYTES = 1088;

export const GROUP_WIRE_HEADER0_BYTES = PLATHO_BINARY_HEADER0_BYTES_CONV;
export const GROUP_WIRE_HEADER1_BYTES = PLATHO_BINARY_HEADER1_BYTES;
export const GROUP_WIRE_BODY_FLAGS = 1;
export const GROUP_WIRE_BODY_PREFIX_BYTES = 68 + MLKEM768_CIPHERTEXT_BYTES + PLATHO_COMPACT_SENDER_RECOVERY_BYTES;
export const GROUP_WIRE_NONCE_OFFSET = 24;
export const GROUP_PART_MAGIC = 'PGP2';
export const GROUP_PART_HEADER_BYTES = PLATHO_COMPACT_PAYLOAD_PREFIX_BYTES;
export const GROUP_SIZE_CLASSES = PLATHO_CAPSULE_USEFUL_SIZE_CLASSES;
export function groupPartCapacity(sizeClass) {
  return Number(sizeClass) * PLATHO_COMPACT_TEXT_BLOCK_BYTES - PLATHO_COMPACT_SENDER_RECOVERY_BYTES;
}
export const GROUP_PART_MAX_BYTES = groupPartCapacity(GROUP_SIZE_CLASSES[GROUP_SIZE_CLASSES.length - 1] / PLATHO_COMPACT_TEXT_BLOCK_BYTES);
export const GROUP_MAX_PARTS = 64;
export const GROUP_TEXT_MAX_CHARS = 65_536;
export const GROUP_CAPSULE_TTL_SECONDS = 86400;

export const GROUP_AVATAR_MAGIC = 'PGA1';
export const GROUP_AVATAR_HEADER_BYTES = 4 + 1 + 1 + 2 + 2 + 4 + 2;
export const GROUP_AVATAR_FORMAT_WEBP = 1;
export const GROUP_AVATAR_SENDER = new Uint8Array(32);

export const GROUP_REKEY_ENTRY_BYTES = MLKEM768_CIPHERTEXT_BYTES + GROUP_NONCE_BYTES
  + GROUP_KEY_BYTES + GROUP_TAG_BYTES + GROUP_ENTRY_TAG_BYTES;

export const GROUP_KIND = Object.freeze({
  TEXT: 1,
  ROSTER: 3,
  LEAVE: 4,
  REMOVE: 5,
  ADMIN: 6,
  AVATAR: 7,
  ADMIT: 8,
  PROFILE: 9,
  MUTE: 10,
  HIDE: 11,
});
export const GROUP_ROSTER_LANE_KINDS = Object.freeze([GROUP_KIND.ROSTER, GROUP_KIND.ADMIT, GROUP_KIND.PROFILE, GROUP_KIND.REMOVE, GROUP_KIND.ADMIN, GROUP_KIND.MUTE, GROUP_KIND.HIDE]);

export const GROUP_HIDE_EXCERPT_MAX = 80;
const GROUP_ROW_KEY_RE = /^\d{1,9}\.\d{1,9}\.[0-9a-f]{64}\.\d{1,12}$/;
export function isGroupRowKey(value) { return typeof value === 'string' && GROUP_ROW_KEY_RE.test(value); }
export const GROUP_NAME_MAX_BYTES = 96;
export const BIDI_CONTROLS_RE = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
export function groupNameIn(value) {
  if (value === null || value === undefined) return null;
  let out = '';
  let bytes = 0;
  for (const ch of String(value).replace(BIDI_CONTROLS_RE, '')) {
    const cp = ch.codePointAt(0);
    const n = cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
    if (bytes + n > GROUP_NAME_MAX_BYTES) break;
    out += ch;
    bytes += n;
  }
  return out === '' ? null : out;
}

export function groupExcerptIn(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  let out = '';
  let count = 0;
  for (const ch of text) { if (count >= GROUP_HIDE_EXCERPT_MAX) break; out += ch; count += 1; }
  return out;
}
export function groupHiddenIn(value) {
  const out = {};
  if (!value || typeof value !== 'object') return out;
  for (const [key, entry] of Object.entries(value)) {
    if (!isGroupRowKey(key)) continue;
    out[key] = { at: Number(entry?.at ?? 0) || 0, excerpt: groupExcerptIn(entry?.excerpt ?? '') };
  }
  return out;
}
export const GROUP_ENTRY_FEE_MAX = 18446744073709551615n;
export function groupEntryFeeIn(value) {
  if (value === null || value === undefined) return null;
  const text = String(typeof value === 'bigint' ? value : value).trim();
  if (!/^[0-9]{1,20}$/.test(text)) return null;
  const fee = BigInt(text);
  if (fee <= 0n || fee > GROUP_ENTRY_FEE_MAX) return null;
  return fee.toString();
}

export function groupRemovalsIn(value) {
  const out = {};
  if (!value || typeof value !== 'object') return out;
  for (const [key, at] of Object.entries(value)) {
    if (!/^[0-9a-f]{64}$/i.test(String(key))) continue;
    const when = Number(at);
    if (!Number.isFinite(when) || when <= 0) continue;
    out[String(key).toLowerCase()] = Math.floor(when);
  }
  return out;
}
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


export function groupSizeClassFor(chunkBytes) {
  for (const useful of GROUP_SIZE_CLASSES) {
    const sizeClass = useful / PLATHO_COMPACT_TEXT_BLOCK_BYTES;
    if (chunkBytes <= groupPartCapacity(sizeClass)) return sizeClass;
  }
  throw new RangeError(`a group part of ${chunkBytes} bytes exceeds the largest capsule (${GROUP_PART_MAX_BYTES})`);
}

export function groupCapsuleWireBytes(sizeClass) {
  return GROUP_WIRE_HEADER0_BYTES + GROUP_WIRE_HEADER1_BYTES + GROUP_WIRE_BODY_PREFIX_BYTES
    + GROUP_PART_HEADER_BYTES + groupPartCapacity(sizeClass) + GROUP_TAG_BYTES;
}

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

function groupAad({ groupId, epoch, generation, senderGroupKey, seq }, header0, header1, bodyPrefix) {
  return concatBytes(
    encoder.encode('PGA2'), assertBytes('groupId', groupId, GROUP_ID_BYTES), u32be(epoch), u32be(generation),
    assertBytes('senderGroupKey', senderGroupKey, 32), u32be(seq), header0, header1, bodyPrefix,
  );
}

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

const PRIVATE_SENDER_RECOVERY_MAGIC = encoder.encode('PSR1');

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
    const plain = new Uint8Array(GROUP_PART_HEADER_BYTES + groupPartCapacity(part.sizeClass));
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

export function assembleGroupParts(parts) {
  const ordered = [...parts].sort((a, b) => a.part - b.part);
  if (ordered.length === 0) return null;
  const { parts: count, totalBytes: total, msgTag } = ordered[0];
  if (ordered.length !== count) return null;
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
    members.push({ groupKey, wallet: wallet || null, keyId: keyId || null, name: groupNameIn(name), x25519PublicKey, mlKem768PublicKey });
  }
  return { members, offset: at };
}

export function groupMembersBytes(members) {
  return 2 + members.reduce((sum, m) => sum + 33 + (m.x25519PublicKey ? GROUP_MEMBER_X25519_BYTES : 0)
    + (m.mlKem768PublicKey ? GROUP_MEMBER_MLKEM_BYTES : 0)
    + 1 + encoder.encode(String(m.wallet ?? '')).length + 1 + encoder.encode(String(m.keyId ?? '')).length
    + 2 + encoder.encode(String(m.name ?? '')).length, 0);
}

export function encodeGroupRoster({ members, admins, name = null, owner = null, avatar = null, sentAt = 0, asOf = null, muted = null, hidden = null, entryFee = undefined, removals = null }) {
  const head = encodeJson({
    v: 1,
    ...(name ? { name } : {}),
    ...(owner ? { owner: hex(owner) } : {}),
    ...(asOf && typeof asOf === 'object' && Object.keys(asOf).length > 0
      ? { asOf: Object.fromEntries(Object.entries(asOf).map(([admin, at]) => [String(admin), { epoch: Number(at.epoch), seq: Number(at.seq), ...(at.g === undefined || at.g === null ? {} : { g: Number(at.g) }) }])) }
      : {}),
    ...(avatar ? { avatar: avatarPointerOut(avatar) } : {}),
    ...(Array.isArray(muted) ? { muted: muted.map((k) => hex(k)) } : {}),
    ...(hidden && typeof hidden === 'object' ? { hidden: groupHiddenIn(hidden) } : {}),
    ...(entryFee === undefined ? {} : { entryFee: groupEntryFeeIn(entryFee) }),
    ...(removals && typeof removals === 'object' ? { removals: groupRemovalsIn(removals) } : {}),
    admins: admins.map((a) => hex(a)),
    sentAt: Number(sentAt),
  });
  return concatBytes(u32be(head.length), head, encodeGroupMembers(members));
}

export function groupAvatarSecretIn(value) {
  const text = String(value ?? '').trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(text) && !/^0{64}$/.test(text) ? text : null;
}

function avatarPointerOut(avatar) {
  const key = groupAvatarSecretIn(avatar.key);
  return {
    epoch: Number(avatar.epoch), seq: Number(avatar.seq), parts: Number(avatar.parts),
    hash: String(avatar.hash), w: Number(avatar.width) || 0, h: Number(avatar.height) || 0,
    ...(key ? { k: key } : {}),
  };
}

function decodeAvatarPointer(value) {
  if (!value) return null;
  const key = groupAvatarSecretIn(value.k);
  return {
    epoch: Number(value.epoch), seq: Number(value.seq), parts: Number(value.parts),
    hash: String(value.hash), width: Number(value.w) || 0, height: Number(value.h) || 0,
    ...(key ? { key } : {}),
  };
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
    const g = at?.g === undefined || at?.g === null ? null : Number(at.g);
    if (Number.isFinite(epoch) && Number.isFinite(seq)) asOf[admin.toLowerCase()] = { epoch, seq, ...(Number.isFinite(g) ? { g } : {}) };
  }
  return {
    name: groupNameIn(value.name),
    owner: value.owner ? unhex(value.owner) : null,
    avatar: decodeAvatarPointer(value.avatar),
    admins: (value.admins ?? []).map(unhex),
    members,
    sentAt: Number(value.sentAt ?? 0),
    asOf,
    muted: Array.isArray(value.muted) ? value.muted.filter((k) => /^[0-9a-f]{64}$/i.test(String(k))).map(unhex) : null,
    hidden: value.hidden && typeof value.hidden === 'object' ? groupHiddenIn(value.hidden) : null,
    entryFee: 'entryFee' in value ? groupEntryFeeIn(value.entryFee) : undefined,
    removals: value.removals && typeof value.removals === 'object' ? groupRemovalsIn(value.removals) : null,
  };
}

export function encodeGroupAdmit({ members, sentAt }) {
  return concatBytes(u32be(Number(sentAt) >>> 0), encodeGroupMembers(members));
}

function decodeGroupAdmit(payload) {
  assertBytes('payload', payload);
  if (payload.length < 6) throw new RangeError('admit payload too short');
  return { sentAt: readU32be(payload, 0), members: decodeGroupMembers(payload, 4).members };
}

export function encodeGroupProfile({ name = undefined, avatar = undefined, entryFee = undefined, sentAt }) {
  return encodeJson({
    v: 1,
    ...(name === undefined ? {} : { name }),
    ...(entryFee === undefined ? {} : { entryFee: groupEntryFeeIn(entryFee) }),
    ...(avatar === undefined ? {} : { avatar: avatar ? avatarPointerOut(avatar) : null }),
    sentAt: Number(sentAt),
  });
}

export function encodeGroupLeave({ groupKey, sentAt }) {
  return encodeJson({ v: 1, groupKey: hex(groupKey), sentAt: Number(sentAt) });
}

export function encodeGroupMute({ groupKey, lift = false, sentAt }) {
  return encodeJson({ v: 1, groupKey: hex(groupKey), ...(lift ? { lift: true } : {}), sentAt: Number(sentAt) });
}

export function encodeGroupHide({ key, lift = false, excerpt = '', sentAt }) {
  if (!isGroupRowKey(key)) throw new RangeError('a hidden row is named by its key');
  return encodeJson({ v: 1, key, ...(lift ? { lift: true } : { excerpt: groupExcerptIn(excerpt) }), sentAt: Number(sentAt) });
}

export function encodeGroupRemove({ groupKey, generation, envelope = null, sentAt }) {
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

export function encodeGroupAdmins({ admins, owner = null, sentAt }) {
  return encodeJson({
    v: 1,
    admins: admins.map((a) => hex(a)),
    ...(owner ? { owner: hex(owner) } : {}),
    sentAt: Number(sentAt),
  });
}

export function encodeGroupAvatar({ bytes, width, height, sentAt, format = GROUP_AVATAR_FORMAT_WEBP }) {
  assertBytes('bytes', bytes);
  if (bytes.length === 0) throw new RangeError('an avatar cannot be empty');
  const out = new Uint8Array(GROUP_AVATAR_HEADER_BYTES + bytes.length);
  out.set(encoder.encode(GROUP_AVATAR_MAGIC), 0);
  const view = new DataView(out.buffer);
  view.setUint8(4, 1);
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

export async function groupAvatarHash(bytes) {
  return hex(new Uint8Array(await getSubtle().digest('SHA-256', assertBytes('bytes', bytes))));
}

export function decodeGroupPayload(kind, payload) {
  if (Number(kind) === GROUP_KIND.AVATAR) return decodeGroupAvatar(payload);
  if (Number(kind) === GROUP_KIND.REMOVE) return decodeGroupRemove(payload);
  if (Number(kind) === GROUP_KIND.ROSTER) return decodeGroupRoster(payload);
  if (Number(kind) === GROUP_KIND.ADMIT) return decodeGroupAdmit(payload);
  const value = decodeJson(payload);
  if (Number(value?.v) !== 1) throw new RangeError(`unsupported group payload version ${value?.v}`);
  switch (Number(kind)) {
    case GROUP_KIND.TEXT:
      return { text: String(value.text ?? '').slice(0, GROUP_TEXT_MAX_CHARS), replyTo: value.replyTo ?? null, sentAt: Number(value.sentAt ?? 0) };
    case GROUP_KIND.PROFILE:
      return {
        ...('name' in value ? { name: groupNameIn(value.name) } : {}),
        ...('avatar' in value ? { avatar: decodeAvatarPointer(value.avatar) } : {}),
        ...('entryFee' in value ? { entryFee: groupEntryFeeIn(value.entryFee) } : {}),
        sentAt: Number(value.sentAt ?? 0),
      };
    case GROUP_KIND.LEAVE:
      return { groupKey: unhex(value.groupKey), sentAt: Number(value.sentAt ?? 0) };
    case GROUP_KIND.MUTE:
      return { groupKey: unhex(value.groupKey), lift: value.lift === true, sentAt: Number(value.sentAt ?? 0) };
    case GROUP_KIND.HIDE:
      if (!isGroupRowKey(value.key)) throw new RangeError('a hidden row is named by its key');
      return { key: value.key, lift: value.lift === true, excerpt: groupExcerptIn(value.excerpt), sentAt: Number(value.sentAt ?? 0) };
    case GROUP_KIND.ADMIN:
      return {
        admins: (value.admins ?? []).map(unhex),
        owner: value.owner ? unhex(value.owner) : null,
        sentAt: Number(value.sentAt ?? 0),
      };
    default:
      throw new RangeError(`unknown group capsule kind ${kind}`);
  }
}


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

export function isValidMemberKeys({ x25519PublicKey = null, mlKem768PublicKey = null } = {}) {
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
      try { onSkipped?.(member, error); } catch { }
    }
  }
  if (entries.length === 0) throw new RangeError('a rekey could wrap to no recipient');
  return concatBytes(
    encoder.encode('PGR1'), u32be(generation), u32be(entries.length), ephPublic, ...entries,
  );
}

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


export const GROUP_INVITE_PREFIX = 'platho.group.invite.v1:';

const B64URL = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const UNB64URL = (text) => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

export function encodeGroupInviteToken(secret) {
  const payload = encodeJson({
    v: 1,
    g: String(secret.groupId),
    k: String(secret.key),
    e: Number(secret.epoch),
    n: Number(secret.generation),
    ...(secret.name ? { t: String(secret.name) } : {}),
    ...(secret.inviter ? { i: String(secret.inviter) } : {}),
    ...(secret.rosterKey ? { r: String(secret.rosterKey) } : {}),
    ...(secret.snapshot ? {
      p: {
        e: Number(secret.snapshot.epoch), g: Number(secret.snapshot.generation),
        a: String(secret.snapshot.admin), s: Number(secret.snapshot.seq), n: Number(secret.snapshot.parts),
      },
    } : {}),
    ...(secret.admitted === true ? { a: 1 } : {}),
  });
  return `${GROUP_INVITE_PREFIX}${B64URL(payload)}`;
}

export const GROUP_ASK_PREFIX = 'platho.group.ask.v1:';

const ASK_ID_BYTES = 32;
const ASK_WALLET_BYTES = 36;
const ASK_HEAD_BYTES = 1 + ASK_ID_BYTES + ASK_WALLET_BYTES + 1;
const ASK_FEE_BYTES = 8;
const ASK_HEAD2_BYTES = 1 + ASK_ID_BYTES + ASK_WALLET_BYTES + ASK_WALLET_BYTES + ASK_FEE_BYTES + 1;
const ASK_MAX_NAME_BYTES = 255;

const askWalletBytes = (wallet) => {
  const text = String(wallet ?? '').trim().replace(/\+/g, '-').replace(/\//g, '_');
  if (!text) throw new RangeError('a request pointer needs an admin to reach');
  if (!/^[A-Za-z0-9_-]{48}$/.test(text)) {
    throw new RangeError('a request pointer needs the user-friendly address (UQ…), not the raw one');
  }
  const bytes = UNB64URL(text);
  if (bytes.length !== ASK_WALLET_BYTES) throw new RangeError(`an admin address is ${ASK_WALLET_BYTES} bytes, not ${bytes.length}`);
  return bytes;
};

export function encodeGroupAskToken({ groupId, wallet, name = null, ownerWallet = null, entryFee = null }) {
  const id = typeof groupId === 'string' ? unhex(groupId) : assertBytes('groupId', groupId);
  if (id.length !== ASK_ID_BYTES) throw new RangeError('a request pointer needs a group id');
  const walletBytes = askWalletBytes(wallet);
  const nameBytes = name ? encoder.encode(String(name)) : new Uint8Array(0);
  if (nameBytes.length > ASK_MAX_NAME_BYTES) throw new RangeError(`a room name of ${nameBytes.length} bytes does not fit a pointer`);
  const fee = groupEntryFeeIn(entryFee);
  if (fee === null) {
    const out = new Uint8Array(ASK_HEAD_BYTES + nameBytes.length);
    out[0] = 1;
    out.set(id, 1);
    out.set(walletBytes, 1 + ASK_ID_BYTES);
    out[ASK_HEAD_BYTES - 1] = nameBytes.length;
    out.set(nameBytes, ASK_HEAD_BYTES);
    return `${GROUP_ASK_PREFIX}${B64URL(out)}`;
  }
  if (!ownerWallet) throw new RangeError('a priced request pointer needs the owner\'s wallet');
  const ownerBytes = askWalletBytes(ownerWallet);
  const out = new Uint8Array(ASK_HEAD2_BYTES + nameBytes.length);
  out[0] = 2;
  out.set(id, 1);
  out.set(walletBytes, 1 + ASK_ID_BYTES);
  out.set(ownerBytes, 1 + ASK_ID_BYTES + ASK_WALLET_BYTES);
  let feeLeft = BigInt(fee);
  for (let i = ASK_FEE_BYTES - 1; i >= 0; i -= 1) { out[1 + ASK_ID_BYTES + ASK_WALLET_BYTES + ASK_WALLET_BYTES + i] = Number(feeLeft & 0xffn); feeLeft >>= 8n; }
  out[ASK_HEAD2_BYTES - 1] = nameBytes.length;
  out.set(nameBytes, ASK_HEAD2_BYTES);
  return `${GROUP_ASK_PREFIX}${B64URL(out)}`;
}

function crc16Xmodem(bytes) {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

function isFriendlyAddressBytes(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== ASK_WALLET_BYTES) return false;
  if (![0x11, 0x51, 0x91, 0xd1].includes(bytes[0])) return false;
  if (bytes[1] !== 0x00 && bytes[1] !== 0xff) return false;
  return crc16Xmodem(bytes.subarray(0, 34)) === ((bytes[34] << 8) | bytes[35]);
}

export function parseGroupAskToken(text) {
  const value = String(text ?? '').trim();
  if (!value.startsWith(GROUP_ASK_PREFIX)) return null;
  try {
    const bytes = UNB64URL(value.slice(GROUP_ASK_PREFIX.length));
    if (bytes.length < ASK_HEAD_BYTES) return null;
    if (bytes[0] === 1) {
      const nameLength = bytes[ASK_HEAD_BYTES - 1];
      if (bytes.length !== ASK_HEAD_BYTES + nameLength) return null;
      const walletBytes = bytes.subarray(1 + ASK_ID_BYTES, 1 + ASK_ID_BYTES + ASK_WALLET_BYTES);
      return {
        groupId: hex(bytes.subarray(1, 1 + ASK_ID_BYTES)),
        wallet: B64URL(walletBytes),
        name: nameLength > 0 ? groupNameIn(decoder.decode(bytes.subarray(ASK_HEAD_BYTES))) : null,
      };
    }
    if (bytes[0] !== 2 || bytes.length < ASK_HEAD2_BYTES) return null;
    const nameLength = bytes[ASK_HEAD2_BYTES - 1];
    if (bytes.length !== ASK_HEAD2_BYTES + nameLength) return null;
    const feeAt = 1 + ASK_ID_BYTES + ASK_WALLET_BYTES + ASK_WALLET_BYTES;
    let fee = 0n;
    for (let i = 0; i < ASK_FEE_BYTES; i += 1) fee = (fee << 8n) | BigInt(bytes[feeAt + i]);
    const entryFee = groupEntryFeeIn(fee);
    if (entryFee === null) return null;
    const walletBytes = bytes.subarray(1 + ASK_ID_BYTES, 1 + ASK_ID_BYTES + ASK_WALLET_BYTES);
    const ownerBytes = bytes.subarray(1 + ASK_ID_BYTES + ASK_WALLET_BYTES, feeAt);
    if (!isFriendlyAddressBytes(walletBytes) || !isFriendlyAddressBytes(ownerBytes)) return null;
    return {
      groupId: hex(bytes.subarray(1, 1 + ASK_ID_BYTES)),
      wallet: B64URL(bytes.subarray(1 + ASK_ID_BYTES, 1 + ASK_ID_BYTES + ASK_WALLET_BYTES)),
      name: nameLength > 0 ? groupNameIn(decoder.decode(bytes.subarray(ASK_HEAD2_BYTES))) : null,
      ownerWallet: B64URL(bytes.subarray(1 + ASK_ID_BYTES + ASK_WALLET_BYTES, feeAt)),
      entryFee,
    };
  } catch {
    return null;
  }
}

export const GROUP_ASK_LINK_PATH = 'join';
export function groupAskLink(origin, token) {
  const value = String(token ?? '');
  if (!value.startsWith(GROUP_ASK_PREFIX)) throw new RangeError('not a request pointer');
  return `${String(origin ?? '').replace(/\/+$/, '')}/${GROUP_ASK_LINK_PATH}/${value.slice(GROUP_ASK_PREFIX.length)}`;
}

export function parseGroupAskLink(url) {
  const text = String(url ?? '');
  const path = text.includes('://') ? text.slice(text.indexOf('://') + 3).replace(/^[^/]*/, '') : text;
  const match = new RegExp(`^/${GROUP_ASK_LINK_PATH}/([A-Za-z0-9_-]{8,4096})/?$`).exec(path.split('?')[0].split('#')[0]);
  if (!match) return null;
  return parseGroupAskToken(`${GROUP_ASK_PREFIX}${match[1]}`);
}

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
      name: groupNameIn(decoded.t),
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
      name: groupNameIn(decoded.t),
      inviter: decoded.i ?? null,
      rosterKey: typeof decoded.r === 'string' ? decoded.r : null,
      snapshot: decoded.p && typeof decoded.p === 'object'
        ? {
          epoch: Number(decoded.p.e), generation: Number(decoded.p.g), admin: String(decoded.p.a),
          seq: Number(decoded.p.s), parts: Number(decoded.p.n),
        }
        : null,
      admitted: decoded.a === 1,
    };
  } catch {
    return null;
  }
}

export function groupRekeyEnvelopeBytes(memberCount) {
  const n = Number(memberCount);
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`memberCount out of range: ${memberCount}`);
  return 44 + n * GROUP_REKEY_ENTRY_BYTES;
}
