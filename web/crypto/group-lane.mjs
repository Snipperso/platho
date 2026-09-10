// PLATHO — PRIVATE GROUP LANES (client-only; the chain never learns that a group exists).
//
// A group rides the SEALED CONV lane with no contract surface at all. `RecordShard.init(write_pubkey, epoch)`
// stores no party, no count and no roster — the direction of a conversation is a CLIENT invariant the contract
// never sees — so a group is nothing but a different value of that same derivation. Everything here is therefore
// changeable in any later client release: the chain is one shot, the client is not.
// See contracts18/docs/DESIGN-private-groups.md for the whole design and the owner's rulings.
//
// ── THE KEY SCHEDULE ───────────────────────────────────────────────────────────────────────────────────────
//
//   K_epoch(e+1) = HKDF(K_epoch(e), info = RATCHET ‖ groupId ‖ u32be(e+1))     forward only, one step a day
//
// FORWARD ONLY IS THE POINT [OWNER 2026-09-05]: a member who joins today is handed today's key and CANNOT derive
// any earlier one, so the past is closed to them. The same one-way step is why a REMOVAL cannot be a ratchet step
// — the removed member would walk forward with everyone else — and must instead start a new GENERATION from fresh
// entropy, delivered to each remaining member in an envelope (web/group-protocol.mjs). A generation is therefore
// `{ generation, epoch, key }`, and a rekey bumps `generation` at the current epoch: both lanes are readable for
// the rest of that day, which is what makes a removal take effect at once rather than at midnight.
//
// ── THE LANE OF A MEMBER, AND WHY IT IS BLINDED ────────────────────────────────────────────────────────────
//
//   b_i      = HKDF(K_epoch, info = BLIND ‖ groupId ‖ Q_i ‖ u32be(epoch) ‖ u32be(generation))  mod L
//   Q_i'     = Q_i + b_i·G                    every member derives this — it is the shard's write_pubkey
//   q_i'     = q_i + b_i  (mod L)             only member i can compute this — it is what signs
//
// Every member can derive the ADDRESS of every other member's lane (they must, to read it); only the owner can
// SIGN for it. Without the blinding a lane key derived from the group secret alone would be shared, and then:
//
//   * any member could write into any other member's lane — impersonation at the transport level, and a reader
//     would have to fetch every junk body before an in-capsule signature could reject it. In a room of 1024 that
//     is a read amplification against EVERY member, bought once;
//   * the seq-jump grief the two-party lane already suffered (gate 13659, measured at 17,714,872 nanoton before
//     it was bounded) would become available from every member against every other.
//
// The blinding is the standard Tor-v3 shape and costs nothing on chain: the contract sees an ordinary ed25519
// public key and verifies an ordinary ed25519 signature. What it buys beyond authorship is per-epoch
// UNLINKABILITY: a fixed per-member key would be visible in `get_view.write_pubkey`, and one account read would
// then hand an observer that member's lane for every past and future day.
//
// ── WHAT LIVES HERE AND WHAT DOES NOT ──────────────────────────────────────────────────────────────────────
//
// Here: the key schedule, the blinded lane keys, the per-epoch content key. NOT here: the wire
// format of control messages, the roster, the rekey envelope (web/group-protocol.mjs), and anything that talks to
// the chain (the lane send/read paths).
//
// The small byte helpers below are DELIBERATELY not imported from crypto/conv-routing.mjs: that module is the
// frozen CONV genesis, and this file must not become a reason to edit it.

import { ed25519 } from '../vendor/@noble/curves/ed25519.js';

// ---- FROZEN domain-separation strings (changing any of them orphans every group derived under it) ----
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

// ---- FROZEN scalar pins ----
export const GROUP_EPOCH_SECONDS = 86400;      // one UTC day, the same grain the CONV lane and the shard use
export const GROUP_KEY_BYTES = 32;
export const GROUP_ID_BYTES = 32;
export const GROUP_SIGNATURE_BYTES = 64;
/** How far the ratchet may be walked in one call. A device offline longer re-joins from an envelope, not by
 *  walking a year of keys: 400 steps is the guard against an unbounded loop on a bad `epoch`, not a policy. */
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

/** 64 bytes of HKDF reduced mod L — the standard wide-reduction, so the scalar is not biased. */
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

/** The UTC day a capsule stamped `createdAtSec` belongs to — the shard's own `epoch` argument. */
export function groupEpochFromSeconds(createdAtSec) {
  const seconds = Number(createdAtSec);
  if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError(`createdAtSec out of range: ${createdAtSec}`);
  return Math.floor(seconds / GROUP_EPOCH_SECONDS);
}

/**
 * A group's founding state from 32 bytes of entropy: the id every derivation is domain-separated by, and the
 * epoch key of the day it was founded. There is NO long-lived root key kept anywhere — the ratchet IS the
 * schedule, which is what makes the past unreadable to whoever joins later.
 */
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

/**
 * THE ROSTER KEY OF A GENERATION, from the generation's FIRST day key. Membership must be readable by everyone in
 * the generation — including the member who joined this morning — and by nobody the generation has removed. The
 * day key cannot do it (forward only: a newcomer cannot derive the day an admission was published); the group id
 * cannot do it (a removed member keeps the id). This can: every member either held the first day key or is handed
 * this key in the invite, and a rekey replaces it. One-way — holding it gives no day key back, so a newcomer still
 * reads no message from before their day.
 *
 * The roster LANE is the daily lane's own construction with this key in place of the day key —
 * `groupLanePublicKey({ key: rosterKey, ... })`: an admin's blinded key that everyone in the generation derives for
 * any day of the generation, and only the admin can sign for. No shared write key anywhere.
 */
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

/**
 * A new GENERATION of an existing group from fresh entropy — what a removal starts. The group id is unchanged
 * (it is the group's name to its own members), the key is unrelated to the old one, and the generation counter is
 * what tells a reader which of two same-day lanes it is looking at.
 */
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
  // the new generation's roster key follows from its first day key — the one the rekey envelope carries, so a
  // remaining member derives it the moment the envelope opens, and the removed member never can
  return { groupId, key, epoch, generation: next, rosterKey: await groupRosterKey({ key, groupId, generation: next }) };
}

/** One day forward. There is no inverse: this is what closes the past to a newcomer. */
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

/** Walk the ratchet to `targetEpoch`. Refuses to go backwards, by construction and loudly. */
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

/**
 * A member's group signing key: derived from THEIR OWN vault seed and the group id, so nobody else — inviter
 * included — can ever sign as them, and no extra secret has to be backed up. The public half is what the roster
 * carries and what every member blinds to reach that member's lane.
 */
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

/**
 * IS THIS A GROUP KEY AT ALL — 32 bytes that decode to a point of the curve? [audit 2026-09-05, round 1] A candidate
 * announces its key in a join token and an admin writes it into the roster; every device then derives that member's
 * lane by adding a blind to the point, and `Point.fromBytes` THROWS on a byte string that is not a point (about half
 * of all random 32-byte strings). One such key in a roster took the whole group's pass down on every device,
 * permanently, before the roster lanes were even read. So a key is checked where it enters — the token, the admit —
 * and skipped where lanes are derived.
 */
export function isValidGroupKey(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== 32) return false;
  try { ed25519.Point.fromBytes(bytes); return true; } catch { return false; }
}

/** The blinding scalar for (group, member, epoch, generation). Everyone who holds the epoch key computes it. */
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

/**
 * The shard identity of a member's lane for a day: `Q_i + b·G`. This is the `write_pubkey` the account address
 * commits to, and every member derives it for every member — that is how a group is read at all.
 */
export async function groupLanePublicKey({ key, groupId, memberPublicKey, epoch, generation }) {
  const blind = await groupLaneBlind({ key, groupId, memberPublicKey, epoch, generation });
  const point = ed25519.Point.fromBytes(memberPublicKey).add(ed25519.Point.BASE.multiply(blind));
  return point.toBytes();
}

/**
 * The signer for THIS device's own lane. Returns the same public key everyone else derives, plus `sign` — the
 * RFC 8032 equation over the blinded scalar, which no other member can reproduce.
 *
 * The nonce prefix is derived from the member's own expanded prefix AND the blinding, so it is secret, unique per
 * (member, group, epoch, generation), and — because `r` also folds the message — never repeats across different
 * messages. Signing the same bytes twice returns the same signature, exactly as deterministic EdDSA does.
 */
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

/** Verify a lane signature — the same check the shard performs, available to the client for its own tests. */
export function verifyGroupLaneSignature({ signature, message, publicKey }) {
  assertBytes('signature', signature, GROUP_SIGNATURE_BYTES);
  assertBytes('publicKey', publicKey, 32);
  return ed25519.verify(signature, assertBytes('message', message), publicKey);
}

/** The symmetric key every capsule of this (group, epoch, generation) is sealed under. */
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

/**
 * THE AVATAR'S KEY, from the group id and nothing else. Not the epoch key, on purpose: a member who joined today
 * cannot derive yesterday's epoch key, and a room whose picture only some members can see is worse than a room
 * with no picture. The trade is stated rather than hidden — whoever ever held the id keeps seeing the logo.
 */
export async function groupAvatarKey(groupId) {
  assertBytes('groupId', groupId, GROUP_ID_BYTES);
  return hkdf256(
    groupId,
    utf8(GROUP_AVATAR_KEY_SALT_DOMAIN),
    utf8(GROUP_AVATAR_KEY_INFO_DOMAIN),
    GROUP_KEY_BYTES,
  );
}

/**
 * The lane the picture is published into, one per (group, epoch). Its write key comes from the group id too, so
 * every member can ADDRESS it — which is the whole point — and therefore anyone holding the id can also write
 * there. What is displayed is settled by the sha-256 the roster names, not by who wrote last.
 */
export async function groupAvatarLaneSecret({ groupId, epoch }) {
  assertBytes('groupId', groupId, GROUP_ID_BYTES);
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

/**
 * Signing for the avatar lane. No blinding: there is nobody to hide here — the writer is "the group", and every
 * member holds the same seed. The shard still checks the signature, so the lane cannot be written by a stranger
 * who never held the id.
 */
export async function groupAvatarLaneSigner({ groupId, epoch }) {
  const secret = await groupAvatarLaneSecret({ groupId, epoch });
  const publicKey = ed25519.getPublicKey(secret);
  return {
    publicKey,
    async sign(message) {
      return ed25519.sign(assertBytes('message', message), secret);
    },
  };
}

/**
 * Every lane a reader must ask about for one (epoch, generation): one per member. This is the set that goes into
 * ONE batched accountStates call — 1024 members sit inside the measured 1149-address URL wall. There is no lobby
 * lane [2026-09-05]: a newcomer answers an invite in the private conversation it came in, not on a shared key.
 */
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
