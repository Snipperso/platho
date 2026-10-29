
import { ed25519 } from '../vendor/@noble/curves/ed25519.js';

export const GROUP_ROOT_SALT_DOMAIN = 'PLATHO.GROUP.ROOT.SALT.V1';
export const GROUP_ROOT_INFO_DOMAIN = 'PLATHO.GROUP.ROOT.V1';
export const GROUP_RATCHET_SALT_DOMAIN = 'PLATHO.GROUP.RATCHET.SALT.V1';
export const GROUP_RATCHET_INFO_DOMAIN = 'PLATHO.GROUP.RATCHET.V1';
export const GROUP_MEMBER_SALT_DOMAIN = 'PLATHO.GROUP.MEMBER.SALT.V1';
export const GROUP_MEMBER_INFO_DOMAIN = 'PLATHO.GROUP.MEMBER.V1';
export const GROUP_BLIND_SALT_DOMAIN = 'PLATHO.GROUP.BLIND.SALT.V1';
export const GROUP_BLIND_INFO_DOMAIN = 'PLATHO.GROUP.BLIND.V1';
export const GROUP_NONCE_SALT_DOMAIN = 'PLATHO.GROUP.NONCE.SALT.V1';
export const GROUP_NONCE_INFO_DOMAIN = 'PLATHO.GROUP.NONCE.V1';
export const GROUP_CONTENT_SALT_DOMAIN = 'PLATHO.GROUP.CONTENT.SALT.V1';
export const GROUP_CONTENT_INFO_DOMAIN = 'PLATHO.GROUP.CONTENT.V1';
export const GROUP_ROSTER_KEY_SALT_DOMAIN = 'PLATHO.GROUP.ROSTER.KEY.SALT.V1';
export const GROUP_ROSTER_KEY_INFO_DOMAIN = 'PLATHO.GROUP.ROSTER.KEY.V1';
export const GROUP_AVATAR_KEY_SALT_DOMAIN = 'PLATHO.GROUP.AVATAR.KEY.SALT.V1';
export const GROUP_AVATAR_KEY_INFO_DOMAIN = 'PLATHO.GROUP.AVATAR.KEY.V1';
export const GROUP_AVATAR_LANE_SALT_DOMAIN = 'PLATHO.GROUP.AVATAR.LANE.SALT.V1';
export const GROUP_AVATAR_LANE_INFO_DOMAIN = 'PLATHO.GROUP.AVATAR.LANE.V1';
export const GROUP_AVATAR_KEY_SALT_DOMAIN_V2 = 'PLATHO.GROUP.AVATAR.KEY.SALT.V2';
export const GROUP_AVATAR_KEY_INFO_DOMAIN_V2 = 'PLATHO.GROUP.AVATAR.KEY.V2';
export const GROUP_AVATAR_LANE_SALT_DOMAIN_V2 = 'PLATHO.GROUP.AVATAR.LANE.SALT.V2';
export const GROUP_AVATAR_LANE_INFO_DOMAIN_V2 = 'PLATHO.GROUP.AVATAR.LANE.V2';
export const GROUP_AVATAR_SECRET_BYTES = 32;

export const GROUP_EPOCH_SECONDS = 86400;
export const GROUP_KEY_BYTES = 32;
export const GROUP_ID_BYTES = 32;
export const GROUP_SIGNATURE_BYTES = 64;
export const GROUP_MAX_RATCHET_STEPS = 400;

const encoder = new TextEncoder();
const L = ed25519.Point.Fn.ORDER;

function getSubtle() {
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto is required for group lanes');
  return globalThis.crypto.subtle;
}

function utf8(value) {
  return encoder.encode(String(value));
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
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function u32be(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 0xFFFFFFFF) throw new RangeError(`u32 out of range: ${value}`);
  return new Uint8Array([(n >>> 24) & 0xFF, (n >>> 16) & 0xFF, (n >>> 8) & 0xFF, n & 0xFF]);
}

async function hkdf256(ikm, salt, info, byteLen) {
  const subtle = getSubtle();
  const key = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, byteLen * 8);
  return new Uint8Array(bits);
}

async function hkdfScalar(ikm, salt, info) {
  const wide = await hkdf256(ikm, salt, info, 64);
  let x = 0n;
  for (const byte of wide) x = (x << 8n) | BigInt(byte);
  return x % L;
}

function scalarToBytesLE(scalar) {
  const out = new Uint8Array(32);
  let x = scalar;
  for (let i = 0; i < 32; i += 1) {
    out[i] = Number(x & 0xFFn);
    x >>= 8n;
  }
  return out;
}

function bytesLEToScalar(bytes) {
  let x = 0n;
  for (let i = bytes.length - 1; i >= 0; i -= 1) x = (x << 8n) | BigInt(bytes[i]);
  return x;
}

async function sha512(...parts) {
  const digest = await getSubtle().digest('SHA-512', concatBytes(...parts));
  return new Uint8Array(digest);
}

export function groupEpochFromSeconds(createdAtSec) {
  const seconds = Number(createdAtSec);
  if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError(`createdAtSec out of range: ${createdAtSec}`);
  return Math.floor(seconds / GROUP_EPOCH_SECONDS);
}

export async function createGroupFounding({ entropy, createdAtSec, generation = 0 }) {
  assertBytes('entropy', entropy, GROUP_KEY_BYTES);
  const epoch = groupEpochFromSeconds(createdAtSec);
  const groupId = await hkdf256(entropy, utf8(GROUP_ROOT_SALT_DOMAIN), utf8(GROUP_ROOT_INFO_DOMAIN), GROUP_ID_BYTES);
  const key = await hkdf256(
    entropy,
    utf8(GROUP_RATCHET_SALT_DOMAIN),
    concatBytes(utf8(GROUP_RATCHET_INFO_DOMAIN), groupId, u32be(epoch), u32be(generation)),
    GROUP_KEY_BYTES,
  );
  return { groupId, key, epoch, generation, rosterKey: await groupRosterKey({ key, groupId, generation }) };
}

export async function groupRosterKey({ key, groupId, generation }) {
  assertBytes('key', key, GROUP_KEY_BYTES);
  assertBytes('groupId', groupId, GROUP_ID_BYTES);
  return hkdf256(
    key,
    utf8(GROUP_ROSTER_KEY_SALT_DOMAIN),
    concatBytes(utf8(GROUP_ROSTER_KEY_INFO_DOMAIN), groupId, u32be(generation)),
    GROUP_KEY_BYTES,
  );
}

export async function rekeyGroup({ groupId, entropy, createdAtSec, generation }) {
  assertBytes('groupId', groupId, GROUP_ID_BYTES);
  assertBytes('entropy', entropy, GROUP_KEY_BYTES);
  const epoch = groupEpochFromSeconds(createdAtSec);
  const next = Number(generation);
  if (!Number.isInteger(next) || next < 1) throw new RangeError(`generation must be >= 1, got ${generation}`);
  const key = await hkdf256(
    entropy,
    utf8(GROUP_RATCHET_SALT_DOMAIN),
    concatBytes(utf8(GROUP_RATCHET_INFO_DOMAIN), groupId, u32be(epoch), u32be(next)),
    GROUP_KEY_BYTES,
  );
  return { groupId, key, epoch, generation: next, rosterKey: await groupRosterKey({ key, groupId, generation: next }) };
}

export async function advanceGroupEpoch({ groupId, key, epoch, generation }) {
  assertBytes('groupId', groupId, GROUP_ID_BYTES);
  assertBytes('key', key, GROUP_KEY_BYTES);
  const next = Number(epoch) + 1;
  const stepped = await hkdf256(
    key,
    utf8(GROUP_RATCHET_SALT_DOMAIN),
    concatBytes(utf8(GROUP_RATCHET_INFO_DOMAIN), groupId, u32be(next), u32be(generation)),
    GROUP_KEY_BYTES,
  );
  return { groupId, key: stepped, epoch: next, generation };
}

export async function groupEpochAt(state, targetEpoch) {
  const target = Number(targetEpoch);
  if (!Number.isInteger(target)) throw new RangeError(`targetEpoch must be an integer, got ${targetEpoch}`);
  if (target < state.epoch) {
    throw new RangeError(`the group ratchet is forward-only: holding epoch ${state.epoch}, asked for ${target}`);
  }
  if (target - state.epoch > GROUP_MAX_RATCHET_STEPS) {
    throw new RangeError(`epoch ${target} is ${target - state.epoch} steps away, over the ${GROUP_MAX_RATCHET_STEPS} guard`);
  }
  let current = state;
  while (current.epoch < target) current = await advanceGroupEpoch(current);
  return current;
}

export async function groupMemberSeed({ vaultSeed, groupId }) {
  assertBytes('vaultSeed', vaultSeed);
  assertBytes('groupId', groupId, GROUP_ID_BYTES);
  if (vaultSeed.length < 16) throw new RangeError('vaultSeed is too short to derive a group identity');
  return hkdf256(
    vaultSeed,
    utf8(GROUP_MEMBER_SALT_DOMAIN),
    concatBytes(utf8(GROUP_MEMBER_INFO_DOMAIN), groupId),
    GROUP_KEY_BYTES,
  );
}

export function groupMemberPublicKey(memberSeed) {
  return ed25519.getPublicKey(assertBytes('memberSeed', memberSeed, GROUP_KEY_BYTES));
}

export function isValidGroupKey(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== 32) return false;
  try { ed25519.Point.fromBytes(bytes); return true; } catch { return false; }
}

export async function groupLaneBlind({ key, groupId, memberPublicKey, epoch, generation }) {
  assertBytes('key', key, GROUP_KEY_BYTES);
  assertBytes('groupId', groupId, GROUP_ID_BYTES);
  assertBytes('memberPublicKey', memberPublicKey, 32);
  return hkdfScalar(
    key,
    utf8(GROUP_BLIND_SALT_DOMAIN),
    concatBytes(utf8(GROUP_BLIND_INFO_DOMAIN), groupId, memberPublicKey, u32be(epoch), u32be(generation)),
  );
}

export async function groupLanePublicKey({ key, groupId, memberPublicKey, epoch, generation }) {
  const blind = await groupLaneBlind({ key, groupId, memberPublicKey, epoch, generation });
  const point = ed25519.Point.fromBytes(memberPublicKey).add(ed25519.Point.BASE.multiply(blind));
  return point.toBytes();
}

export async function groupLaneSigner({ key, groupId, memberSeed, epoch, generation }) {
  assertBytes('memberSeed', memberSeed, GROUP_KEY_BYTES);
  const extended = ed25519.utils.getExtendedPublicKey(memberSeed);
  const memberPublicKey = extended.pointBytes;
  const blind = await groupLaneBlind({ key, groupId, memberPublicKey, epoch, generation });
  const scalar = (extended.scalar + blind) % L;
  const point = ed25519.Point.BASE.multiply(scalar);
  const publicKey = point.toBytes();
  const noncePrefix = await hkdf256(
    concatBytes(extended.prefix, scalarToBytesLE(blind)),
    utf8(GROUP_NONCE_SALT_DOMAIN),
    concatBytes(utf8(GROUP_NONCE_INFO_DOMAIN), groupId, u32be(epoch), u32be(generation)),
    GROUP_KEY_BYTES,
  );
  return {
    memberPublicKey,
    publicKey,
    async sign(message) {
      assertBytes('message', message);
      const r = bytesLEToScalar(await sha512(noncePrefix, message)) % L;
      const R = ed25519.Point.BASE.multiply(r).toBytes();
      const k = bytesLEToScalar(await sha512(R, publicKey, message)) % L;
      const s = (r + k * scalar) % L;
      return concatBytes(R, scalarToBytesLE(s));
    },
  };
}

export function verifyGroupLaneSignature({ signature, message, publicKey }) {
  assertBytes('signature', signature, GROUP_SIGNATURE_BYTES);
  assertBytes('publicKey', publicKey, 32);
  return ed25519.verify(signature, assertBytes('message', message), publicKey);
}

export async function groupContentKey({ key, groupId, epoch, generation }) {
  assertBytes('key', key, GROUP_KEY_BYTES);
  assertBytes('groupId', groupId, GROUP_ID_BYTES);
  return hkdf256(
    key,
    utf8(GROUP_CONTENT_SALT_DOMAIN),
    concatBytes(utf8(GROUP_CONTENT_INFO_DOMAIN), groupId, u32be(epoch), u32be(generation)),
    GROUP_KEY_BYTES,
  );
}

export async function groupAvatarKey(groupId, secret = null) {
  assertBytes('groupId', groupId, GROUP_ID_BYTES);
  if (secret) {
    assertBytes('secret', secret, GROUP_AVATAR_SECRET_BYTES);
    return hkdf256(secret, utf8(GROUP_AVATAR_KEY_SALT_DOMAIN_V2), concatBytes(utf8(GROUP_AVATAR_KEY_INFO_DOMAIN_V2), groupId), GROUP_KEY_BYTES);
  }
  return hkdf256(
    groupId,
    utf8(GROUP_AVATAR_KEY_SALT_DOMAIN),
    utf8(GROUP_AVATAR_KEY_INFO_DOMAIN),
    GROUP_KEY_BYTES,
  );
}

export async function groupAvatarLaneSecret({ groupId, epoch, secret = null }) {
  assertBytes('groupId', groupId, GROUP_ID_BYTES);
  if (secret) {
    assertBytes('secret', secret, GROUP_AVATAR_SECRET_BYTES);
    return hkdf256(secret, utf8(GROUP_AVATAR_LANE_SALT_DOMAIN_V2),
      concatBytes(utf8(GROUP_AVATAR_LANE_INFO_DOMAIN_V2), groupId, u32be(epoch)), GROUP_KEY_BYTES);
  }
  return hkdf256(
    groupId,
    utf8(GROUP_AVATAR_LANE_SALT_DOMAIN),
    concatBytes(utf8(GROUP_AVATAR_LANE_INFO_DOMAIN), u32be(epoch)),
    GROUP_KEY_BYTES,
  );
}

export async function groupAvatarLanePublicKey(args) {
  return ed25519.getPublicKey(await groupAvatarLaneSecret(args));
}

export async function groupAvatarLaneSigner({ groupId, epoch, secret: pictureSecret = null }) {
  const secret = await groupAvatarLaneSecret({ groupId, epoch, secret: pictureSecret });
  const publicKey = ed25519.getPublicKey(secret);
  return {
    publicKey,
    async sign(message) {
      return ed25519.sign(assertBytes('message', message), secret);
    },
  };
}

export async function groupLaneSet({ key, groupId, epoch, generation, memberPublicKeys }) {
  const lanes = [];
  for (const memberPublicKey of memberPublicKeys) {
    lanes.push({
      memberPublicKey,
      writePublicKey: await groupLanePublicKey({ key, groupId, memberPublicKey, epoch, generation }),
      epoch,
      generation,
    });
  }
  return { lanes };
}
