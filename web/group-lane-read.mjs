// PLATHO — reading a private group's lanes. Like the send side, an ADAPTER: the CONV read lane does the whole
// walk (the change-marker gate that makes a quiet lane free, the /messages paging, the gap report, and the write
// signature check the shard itself enforces), and this file only says WHICH lanes and what the bodies mean.
// Design: contracts18/docs/DESIGN-private-groups.md.
//
// THE CALLER OWNS THE RATCHET. `epochs` is the list of (epoch, generation, key) states this device holds and
// wants read — never a single "current" state, because the epoch key is FORWARD-ONLY: yesterday's lanes cannot be
// derived from today's key, so a device keeps the window it still wants to read and prunes the rest. A device
// that was away walks the ratchet forward itself, keeping the keys of the days it missed, and hands them here.
//
// THE READER REBUILDS WHAT THE WIRE NO LONGER SAYS [2026-09-05]. A group capsule on chain is byte for byte a
// private message; nothing in it names the group, the day, the generation, the writer or the kind. The reader
// knows all of that from the lane it is reading, rebuilds the additional data from it, and the AEAD tag is what
// says whether this capsule was sealed for exactly this lane, day, generation, writer and seq. A payload larger
// than one size class arrives as PARTS in consecutive seqs; they are put back together here, and a payload whose
// parts are not all in yet is simply not there until the next pass.
//
// A group of 1024 is 1024 addresses for ONE epoch — inside the measured 1149-address accountStates wall, so a
// whole room's day costs one batched request between all its lanes. There is no lobby lane: joining happens in the
// private conversation the invite came in (group-protocol.mjs, the join token).

import { createConvReadLane } from './conv-lane.mjs?v=79';
import { groupAvatarKey, groupAvatarLanePublicKey, groupContentKey, groupLanePublicKey } from './crypto/group-lane.mjs?v=5';
import {
  assembleGroupParts, decodeGroupPayload, groupAvatarHash, openGroupCapsule, GROUP_AVATAR_SENDER, GROUP_KIND,
} from './group-protocol.mjs?v=9';
import { parseBocBase64, readSnakeCellBytes } from './pwa-contract-transactions.mjs?v=47';
import { recordShardAddressBytesFor, rawAddress } from './shard-address.mjs?v=29';
import { generationForEpochAt } from './cutover-epoch.mjs?v=4';

const bytesToBig = (bytes) => [...bytes].reduce((acc, byte) => (acc << 8n) | BigInt(byte), 0n);

/**
 * Every lane of one (epoch, generation): one per member. The shape is the CONV reader's bucket —
 * { address, writePublicKey, epoch } — so it can be handed straight to readIncoming as `shards`.
 */
// ── THE DERIVATIONS ARE REMEMBERED [audit 2026-09-06, round 3] ────────────────────────────────────────────────
// A lane key is one scalar multiplication (~0.4 ms measured on a desktop; phones are slower by an unmeasured factor)
// and a pass derived every lane of every held day THREE times — the read set, the read itself, and the held-lanes
// prune — on the main thread, every 12-second tick: a room of 1,024 over a three-day window is 9,216 derivations,
// ~4 s a pass, and a device holding 30 unread days ~14 s before a single RPC. The inputs are pure, so each lane is
// derived once per session and read from here after. Bounded: past the cap the whole map is dropped (the next pass
// re-derives what it needs), so the memory can never outgrow a room-year.
const LANE_KEY_CACHE_MAX = 60_000;
const laneKeyCache = new Map();     // `${hex(key)}|${hex(groupId)}|${hex(member)}|${epoch}|${generation}` -> writePublicKey
const laneAddressCache = new Map(); // `${laneGeneration}|${hex(writePublicKey)}|${epoch}` -> raw address
const hexOf = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
function remember(cache, key, value) {
  if (cache.size >= LANE_KEY_CACHE_MAX) cache.clear();
  cache.set(key, value);
  return value;
}
/** The blinded lane key of (key, groupId, member, epoch, generation), derived once; throws exactly as the primitive does. */
export async function cachedGroupLanePublicKey({ key, groupId, memberPublicKey, epoch, generation }) {
  const id = `${hexOf(key)}|${hexOf(groupId)}|${hexOf(memberPublicKey)}|${Number(epoch)}|${Number(generation)}`;
  const held = laneKeyCache.get(id);
  if (held) return held;
  return remember(laneKeyCache, id, await groupLanePublicKey({ key, groupId, memberPublicKey, epoch, generation }));
}
/** The RecordShard address of a lane, derived once per (generation, write key, epoch). */
async function cachedLaneAddress(laneGeneration, writePublicKey, epoch) {
  const id = `${Number(laneGeneration)}|${hexOf(writePublicKey)}|${Number(epoch)}`;
  const held = laneAddressCache.get(id);
  if (held) return held;
  return remember(laneAddressCache, id, rawAddress(await recordShardAddressBytesFor(laneGeneration, bytesToBig(writePublicKey), epoch)));
}
/** For tests: how many lane keys are held, and a way to start cold. */
export function __groupLaneCacheStats() { return { keys: laneKeyCache.size, addresses: laneAddressCache.size }; }
export function __resetGroupLaneCacheForTests() { laneKeyCache.clear(); laneAddressCache.clear(); }

export async function groupLaneBuckets({ state, memberPublicKeys, boundary }) {
  const out = [];
  const laneGeneration = generationForEpochAt(Number(state.epoch), boundary);
  for (const memberPublicKey of memberPublicKeys) {
    // A KEY THAT IS NOT A POINT HAS NO LANE — skipped, not thrown [audit 2026-09-05, round 1]: one such key in a
    // roster used to abort the whole group's pass on every device before any roster lane was read (the admin's
    // corrective removal included). The admit and the token refuse such keys; this is the belt to that suspender.
    let writePublicKey;
    try { writePublicKey = await cachedGroupLanePublicKey({ ...state, memberPublicKey }); } catch { continue; }
    const address = await cachedLaneAddress(laneGeneration, writePublicKey, state.epoch);
    out.push({
      address,
      writePublicKey,
      epoch: state.epoch,
      generation: state.generation,
      // the LANE generation's seam, not the group's: the write digest has two shapes and the epoch names which
      ...(boundary === undefined ? {} : { boundary }),
      member: memberPublicKey,
    });
  }
  return out;
}

/**
 * The one lane a member can address without holding the day's key: the group's picture, keyed by the group id and
 * the epoch it was published in. It is deliberately NOT part of a pass — a picture changes about never, and
 * putting it in the batch would cost every group an extra address every day to learn nothing.
 */
export async function groupAvatarBucket({ groupId, epoch, boundary }) {
  const writePublicKey = await groupAvatarLanePublicKey({ groupId, epoch });
  const laneGeneration = generationForEpochAt(Number(epoch), boundary);
  const address = await recordShardAddressBytesFor(laneGeneration, bytesToBig(writePublicKey), epoch);
  return {
    address: rawAddress(address),
    writePublicKey,
    epoch,
    generation: 0,
    ...(boundary === undefined ? {} : { boundary }),
    member: null,
  };
}

/**
 * An admin's ROSTER lane for each (generation, epoch): the daily lane's own construction with the generation's
 * roster key in place of the day key. Everyone in the generation derives it for any day; only the admin signs.
 * Membership travels here — snapshots, admissions, removals, admin changes, the room's profile — so a newcomer
 * holding only the roster key and today's day key still learns who is in the room and where their lanes are.
 */
export async function groupRosterBuckets({ rosterKey, groupId, generation, epochs, adminPublicKeys, boundary }) {
  const out = [];
  for (const epoch of epochs) {
    const laneGeneration = generationForEpochAt(Number(epoch), boundary);
    for (const admin of adminPublicKeys) {
      // AN ADMIN KEY THAT IS NOT A POINT HAS NO LANE — skipped, not thrown [audit 2026-09-06, round 3]: the member
      // lanes learned this in round 1; an ADMIN/ROSTER row naming such a key still took every device's pass down here,
      // before a single roster lane was read, for good. The fold refuses such keys now, and this is its belt.
      let writePublicKey;
      try { writePublicKey = await cachedGroupLanePublicKey({ key: rosterKey, groupId, memberPublicKey: admin, epoch, generation }); } catch { continue; }
      const address = await cachedLaneAddress(laneGeneration, writePublicKey, epoch);
      out.push({
        address,
        writePublicKey,
        epoch,
        generation,
        ...(boundary === undefined ? {} : { boundary }),
        member: admin,
        roster: true,
      });
    }
  }
  return out;
}

/** The three cells back out of a chain entry the CONV reader returned. */
function cellsFromEntry(entry) {
  return {
    header0: readSnakeCellBytes(parseBocBase64(entry.header_0_boc)),
    header1: readSnakeCellBytes(parseBocBase64(entry.header_1_boc)),
    body: readSnakeCellBytes(parseBocBase64(entry.body_boc)),
  };
}

/**
 * Open every capsule in `rows` under the context the lane gives it, group the parts by message, and answer with
 * whole payloads only. `contextFor(row)` names the lane the row was found in, or null for an address this pass
 * did not ask about. A capsule that does not open is not ours (or not a group capsule at all — a lane is a public
 * address and anyone may pay to send it bytes; the shard refuses to STORE what it cannot verify, but a refused
 * message is still in the account's history, which is what this reader walks).
 */
async function collectWhole({ rows, contentKey, contextFor, onUnreadable }) {
  const byMessage = new Map();   // `${address}|${msgTag}` -> { address, context, parts }
  for (const row of rows) {
    const context = contextFor(row);
    if (!context) continue;
    let opened;
    try {
      const { header0, header1, body } = cellsFromEntry(row.entry);
      opened = await openGroupCapsule({ contentKey, context, seq: row.seq, header0, header1, body });
    } catch (error) {
      try { onUnreadable?.(row.address, error); } catch { /* a listener must not break the walk */ }
      continue;
    }
    const key = `${String(row.address).toLowerCase()}|${opened.msgTag}`;
    if (!byMessage.has(key)) byMessage.set(key, { address: row.address, context, parts: [] });
    // the chain's stamp of THIS part rides with it; a whole message is stamped by its last part to land
    byMessage.get(key).parts.push({ ...opened, createdAt: Number.isFinite(Number(row.createdAt)) && Number(row.createdAt) > 0 ? Number(row.createdAt) : null });
  }
  const out = [];
  for (const message of byMessage.values()) {
    // ASSEMBLY INSIDE THE GUARD [audit 2026-09-05, round 1]: a member-written part header decides sizes here, and a
    // throw used to escape the per-row try above and drop every other lane's rows of the pass.
    let bytes = null;
    try { bytes = assembleGroupParts(message.parts); } catch (error) {
      try { onUnreadable?.(message.address, error); } catch { /* as above */ }
      continue;
    }
    if (!bytes) continue;   // a part is still missing: the next pass reads the lane again, whole
    const first = message.parts.reduce((a, b) => (a.part < b.part ? a : b));
    const stamps = message.parts.map((p) => p.createdAt).filter((t) => Number.isFinite(t) && t > 0);
    out.push({
      address: message.address, context: message.context, kind: first.kind, seq: first.seq,
      sentAt: first.sentAt, parts: message.parts.length, bytes,
      createdAt: stamps.length === message.parts.length ? Math.max(...stamps) : null,
    });
  }
  return out;
}

/**
 * Build the group read lane over the CONV one.
 *
 * `readMessagesWithSource` is the same reader every lane uses. `verifyWriteSig` stays TRUE: the write signature is
 * what proves a capsule was written by the member whose lane it sits in — a group's whole authorship story — and
 * the shard enforces the identical check.
 */
export function createGroupReadLane({ readMessagesWithSource, verifyWriteSig = true } = {}) {
  const conv = createConvReadLane({ readMessagesWithSource, verifyWriteSig });
  return {
    shardReadStats: conv.shardReadStats,

    /** The addresses one pass will ask about — for the caller's batched accountStates read. */
    async buckets({ epochs, memberPublicKeys, boundary }) {
      const all = [];
      for (const state of epochs) all.push(...await groupLaneBuckets({ state, memberPublicKeys, boundary }));
      return all;
    },

    /** The roster-lane addresses a pass will ask about — for the caller's batched accountStates read. */
    async rosterBuckets(args) { return groupRosterBuckets(args); },

    /**
     * Every whole control payload in the admins' ROSTER lanes for `epochs` of one generation. The content key is
     * the roster key's — groupContentKey with the roster key in place of the day key — so a member who joined this
     * morning opens a snapshot published a month ago, and a member removed by a rekey opens nothing after it.
     */
    async readRoster({ rosterKey, groupId, generation, epochs, adminPublicKeys, states = null, knownSeqOf = null, onShardFailed = null, onShardGap = null, onUnreadable = null, boundary }) {
      const out = [];
      for (const epoch of epochs) {
        const shards = await groupRosterBuckets({ rosterKey, groupId, generation, epochs: [epoch], adminPublicKeys, boundary });
        if (shards.length === 0) continue;
        const contentKey = await groupContentKey({ key: rosterKey, groupId, epoch, generation });
        const byAddress = new Map(shards.map((b) => [String(b.address).toLowerCase(), b]));
        const rows = await conv.readIncoming({ shards, epochNow: epoch, windowW: 0, states, knownSeqOf, onShardFailed, onShardGap });
        const whole = await collectWhole({
          rows, contentKey, onUnreadable,
          contextFor: (row) => {
            const bucket = byAddress.get(String(row.address).toLowerCase());
            if (!bucket?.member) return null;
            return { groupId, epoch, generation, senderGroupKey: bucket.member };
          },
        });
        for (const message of whole) {
          let payload = null;
          try { payload = decodeGroupPayload(message.kind, message.bytes); } catch (error) {
            try { onUnreadable?.(message.address, error); } catch { /* a listener must not break the walk */ }
            continue;
          }
          out.push({
            address: message.address, epoch, generation, seq: message.seq, kind: message.kind,
            senderGroupKey: message.context.senderGroupKey, sentAt: message.sentAt, createdAt: message.createdAt ?? null,
            parts: message.parts, payload, roster: true,
          });
        }
      }
      return out;
    },

    /**
     * THE SNAPSHOT an invite points at: the ROSTER payload at (epoch, admin, seq) in that admin's roster lane, or
     * null. A newcomer's first read of a group, and the only one that needs a pointer.
     */
    async readSnapshot({ rosterKey, groupId, pointer, states = null, onShardFailed = null, onUnreadable = null, boundary }) {
      if (!pointer?.admin) return null;
      // THE WHOLE LANE, NOT ITS NEWEST PAGE [audit 2026-09-06, round 3]: the roster row an invite points at can sit
      // under a day's worth of later rows — or under refused junk anyone may send the lane for a GRAM — and a newest-
      // window read then found no ROSTER, left the cursor pinned and the newcomer at deltas only, for good.
      const rows = await this.readRoster({
        rosterKey, groupId, generation: Number(pointer.generation), epochs: [Number(pointer.epoch)],
        adminPublicKeys: [pointer.admin], states, knownSeqOf: () => 0, onShardFailed, onUnreadable, boundary,
      });
      const want = Number(pointer.seq) || 0;
      const snapshot = rows.find((row) => row.kind === GROUP_KIND.ROSTER && (want === 0 || Number(row.seq) === want))
        ?? rows.filter((row) => row.kind === GROUP_KIND.ROSTER).sort((a, b) => Number(b.seq) - Number(a.seq))[0]
        ?? null;
      return snapshot ? { ...snapshot } : null;
    },

    /**
     * HOW FAR THE AVATAR LANE ALREADY GOES. One address, asked once before a picture is published: the lane's
     * write key is shared between every member, so this device cannot assume it is the only one that wrote there
     * today, and a seq the shard has already stored is simply refused (13653).
     */
    async avatarTip({ groupId, epoch, boundary, onShardFailed = null }) {
      const bucket = await groupAvatarBucket({ groupId, epoch, boundary });
      const rows = await conv.readIncoming({
        shards: [bucket], epochNow: epoch, windowW: 0, states: null, onShardFailed,
      });
      return rows.reduce((top, row) => Math.max(top, Number(row.seq) || 0), 0);
    },

    /**
     * THE ROOM'S PICTURE, from the pointer the roster carries. The seq window is a shortcut, not a security
     * boundary: the lane's write key is shared, so anyone who ever held the group id can add bytes there. What
     * settles which bytes ARE the picture is the sha-256 the admin published — checked here, and a mismatch
     * answers null rather than a wrong image.
     */
    async readAvatar({ groupId, pointer, boundary, states = null, onShardFailed = null, onUnreadable = null }) {
      if (!pointer) return null;
      const bucket = await groupAvatarBucket({ groupId, epoch: pointer.epoch, boundary });
      const contentKey = await groupAvatarKey(groupId);
      const rows = await conv.readIncoming({
        shards: [bucket], epochNow: pointer.epoch, windowW: 0, states, onShardFailed,
      });
      const first = Number(pointer.seq) || 0;
      const last = first + (Number(pointer.parts) || 1) - 1;
      const inWindow = rows.filter((row) => {
        const seq = Number(row.seq);
        return first <= 0 || (seq >= first && seq <= last);
      });
      const whole = await collectWhole({
        rows: inWindow, contentKey, onUnreadable,
        contextFor: () => ({ groupId, epoch: pointer.epoch, generation: 0, senderGroupKey: GROUP_AVATAR_SENDER }),
      });
      for (const message of whole) {
        if (message.kind !== GROUP_KIND.AVATAR) continue;
        let picture;
        try { picture = decodeGroupPayload(GROUP_KIND.AVATAR, message.bytes); } catch { continue; }
        const hash = await groupAvatarHash(picture.bytes);
        if (pointer.hash && hash !== String(pointer.hash).toLowerCase()) continue;
        return { ...picture, hash };
      }
      return null;
    },

    /**
     * Every whole group payload this device can open, across the (epoch, generation) states it handed in. A row's
     * `senderGroupKey` is the OWNER OF THE LANE it was found in — the lane's blinded key proved who wrote it, and
     * the AEAD tag proved the capsule was sealed for exactly that writer; nothing on the wire says so, and nothing
     * needs to.
     */
    async read({ epochs, memberPublicKeys, states = null, knownSeqOf = null, onShardFailed = null, onShardGap = null, boundary, onUnreadable = null }) {
      const out = [];
      for (const state of epochs) {
        const shards = await groupLaneBuckets({ state, memberPublicKeys, boundary });
        const contentKey = await groupContentKey(state);
        const byAddress = new Map(shards.map((b) => [String(b.address).toLowerCase(), b]));
        const rows = await conv.readIncoming({
          shards, epochNow: state.epoch, windowW: 0, states, knownSeqOf, onShardFailed, onShardGap,
        });
        const whole = await collectWhole({
          rows, contentKey, onUnreadable,
          contextFor: (row) => {
            const bucket = byAddress.get(String(row.address).toLowerCase());
            if (!bucket?.member) return null;
            return { groupId: state.groupId, epoch: state.epoch, generation: state.generation, senderGroupKey: bucket.member };
          },
        });
        for (const message of whole) {
          let payload = null;
          try { payload = decodeGroupPayload(message.kind, message.bytes); } catch (error) {
            try { onUnreadable?.(message.address, error); } catch { /* as above */ }
            continue;
          }
          out.push({
            address: message.address,
            epoch: state.epoch,
            generation: state.generation,
            seq: message.seq,
            kind: message.kind,
            senderGroupKey: message.context.senderGroupKey,
            sentAt: message.sentAt,
            createdAt: message.createdAt ?? null,
            parts: message.parts,
            payload,
          });
        }
      }
      return out;
    },
  };
}
