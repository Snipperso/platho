
import { createConvReadLane } from './conv-lane.mjs?v=133';
import { groupAvatarKey, groupAvatarLanePublicKey, groupContentKey, groupLanePublicKey } from './crypto/group-lane.mjs?v=8';
import {
  assembleGroupParts, decodeGroupPayload, groupAvatarHash, groupAvatarSecretIn, openGroupCapsule, GROUP_AVATAR_SENDER, GROUP_KIND,
} from './group-protocol.mjs?v=31';
import { parseBocBase64, readSnakeCellBytes } from './pwa-contract-transactions.mjs?v=59';
import { recordShardAddressBytesFor, rawAddress } from './shard-address.mjs?v=47';
import { generationForEpochAt } from './cutover-epoch.mjs?v=7';

const bytesToBig = (bytes) => [...bytes].reduce((acc, byte) => (acc << 8n) | BigInt(byte), 0n);

const LANE_KEY_CACHE_MAX = 60_000;
const laneKeyCache = new Map();
const laneAddressCache = new Map();
const HEX_TABLE = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));
const hexMemo = new WeakMap();
const hexOf = (bytes) => {
  let s = hexMemo.get(bytes);
  if (s === undefined) { s = ''; for (let i = 0; i < bytes.length; i += 1) s += HEX_TABLE[bytes[i]]; hexMemo.set(bytes, s); }
  return s;
};
function remember(cache, key, value) {
  if (cache.size >= LANE_KEY_CACHE_MAX) { let n = LANE_KEY_CACHE_MAX >> 2; for (const held of cache.keys()) { cache.delete(held); if (--n <= 0) break; } }
  cache.set(key, value);
  return value;
}
export async function cachedGroupLanePublicKey({ key, groupId, memberPublicKey, epoch, generation }) {
  const id = `${hexOf(key)}|${hexOf(groupId)}|${hexOf(memberPublicKey)}|${Number(epoch)}|${Number(generation)}`;
  const held = laneKeyCache.get(id);
  if (held) return held;
  return remember(laneKeyCache, id, await groupLanePublicKey({ key, groupId, memberPublicKey, epoch, generation }));
}
async function cachedLaneAddress(laneGeneration, writePublicKey, epoch) {
  const id = `${Number(laneGeneration)}|${hexOf(writePublicKey)}|${Number(epoch)}`;
  const held = laneAddressCache.get(id);
  if (held) return held;
  return remember(laneAddressCache, id, rawAddress(await recordShardAddressBytesFor(laneGeneration, bytesToBig(writePublicKey), epoch)));
}
export function forgetGroupLaneKeys() { laneKeyCache.clear(); }
export function __groupLaneCacheStats() { return { keys: laneKeyCache.size, addresses: laneAddressCache.size }; }
export function __resetGroupLaneCacheForTests() { laneKeyCache.clear(); laneAddressCache.clear(); }

export async function groupLaneBuckets({ state, memberPublicKeys, boundary }) {
  const out = [];
  const laneGeneration = generationForEpochAt(Number(state.epoch), boundary);
  for (const memberPublicKey of memberPublicKeys) {
    let writePublicKey;
    try { writePublicKey = await cachedGroupLanePublicKey({ ...state, memberPublicKey }); } catch { continue; }
    const address = await cachedLaneAddress(laneGeneration, writePublicKey, state.epoch);
    out.push({
      address,
      writePublicKey,
      epoch: state.epoch,
      generation: state.generation,
      laneGeneration,
      ...(boundary === undefined ? {} : { boundary }),
      member: memberPublicKey,
    });
  }
  return out;
}

export async function groupAvatarBucket({ groupId, epoch, boundary, secret = null }) {
  const writePublicKey = await groupAvatarLanePublicKey({ groupId, epoch, secret });
  const laneGeneration = generationForEpochAt(Number(epoch), boundary);
  const address = await recordShardAddressBytesFor(laneGeneration, bytesToBig(writePublicKey), epoch);
  return {
    address: rawAddress(address),
    writePublicKey,
    epoch,
    generation: 0,
    laneGeneration,
    ...(boundary === undefined ? {} : { boundary }),
    member: null,
  };
}

export async function groupRosterBuckets({ rosterKey, groupId, generation, epochs, adminPublicKeys, boundary }) {
  const out = [];
  for (const epoch of epochs) {
    const laneGeneration = generationForEpochAt(Number(epoch), boundary);
    for (const admin of adminPublicKeys) {
      let writePublicKey;
      try { writePublicKey = await cachedGroupLanePublicKey({ key: rosterKey, groupId, memberPublicKey: admin, epoch, generation }); } catch { continue; }
      const address = await cachedLaneAddress(laneGeneration, writePublicKey, epoch);
      out.push({
        address,
        writePublicKey,
        epoch,
        generation,
        laneGeneration,
        ...(boundary === undefined ? {} : { boundary }),
        member: admin,
        roster: true,
      });
    }
  }
  return out;
}

function cellsFromEntry(entry) {
  return {
    header0: readSnakeCellBytes(parseBocBase64(entry.header_0_boc)),
    header1: readSnakeCellBytes(parseBocBase64(entry.header_1_boc)),
    body: readSnakeCellBytes(parseBocBase64(entry.body_boc)),
  };
}

async function collectWhole({ rows, contentKey, contextFor, onUnreadable }) {
  const byMessage = new Map();
  for (const row of rows) {
    const context = contextFor(row);
    if (!context) continue;
    let opened;
    try {
      const { header0, header1, body } = cellsFromEntry(row.entry);
      opened = await openGroupCapsule({ contentKey, context, seq: row.seq, header0, header1, body });
    } catch (error) {
      try { onUnreadable?.(row.address, error); } catch { }
      continue;
    }
    const key = `${String(row.address).toLowerCase()}|${opened.msgTag}`;
    if (!byMessage.has(key)) byMessage.set(key, { address: row.address, context, parts: [] });
    byMessage.get(key).parts.push({ ...opened, createdAt: Number.isFinite(Number(row.createdAt)) && Number(row.createdAt) > 0 ? Number(row.createdAt) : null });
  }
  const out = [];
  for (const message of byMessage.values()) {
    let bytes = null;
    try { bytes = assembleGroupParts(message.parts); } catch (error) {
      try { onUnreadable?.(message.address, error); } catch { }
      continue;
    }
    if (!bytes) continue;
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

export function createGroupReadLane({ readMessagesWithSource, verifyWriteSig = true } = {}) {
  const conv = createConvReadLane({ readMessagesWithSource, verifyWriteSig, markLimit: 65536 });
  return {
    shardReadStats: conv.shardReadStats,
    exportMarks: () => conv.exportMarks(),
    importMarks: (entries) => conv.importMarks(entries),
    forgetShards(addresses) { for (const address of addresses ?? []) conv.forgetShard(address); },

    async buckets({ epochs, memberPublicKeys, boundary }) {
      const all = [];
      for (const state of epochs) all.push(...await groupLaneBuckets({ state, memberPublicKeys, boundary }));
      return all;
    },

    async rosterBuckets(args) { return groupRosterBuckets(args); },

    async readRoster({ rosterKey, groupId, generation, epochs, adminPublicKeys, states = null, knownSeqOf = null, onShardFailed = null, onShardGap = null, onShardRead = null, fullWalk = false, onUnreadable = null, boundary }) {
      const out = [];
      for (const epoch of epochs) {
        const shards = await groupRosterBuckets({ rosterKey, groupId, generation, epochs: [epoch], adminPublicKeys, boundary });
        if (shards.length === 0) continue;
        const contentKey = await groupContentKey({ key: rosterKey, groupId, epoch, generation });
        const byAddress = new Map(shards.map((b) => [String(b.address).toLowerCase(), b]));
        const rows = await conv.readIncoming({ shards, epochNow: epoch, windowW: 0, states, knownSeqOf, onShardFailed, onShardGap, onShardRead, fullWalk });
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
            try { onUnreadable?.(message.address, error); } catch { }
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

    async readSnapshot({ rosterKey, groupId, pointer, states = null, onShardFailed = null, onUnreadable = null, boundary }) {
      if (!pointer?.admin) return null;
      const rows = await this.readRoster({
        rosterKey, groupId, generation: Number(pointer.generation), epochs: [Number(pointer.epoch)],
        adminPublicKeys: [pointer.admin], states, knownSeqOf: () => 0, fullWalk: true, onShardFailed, onUnreadable, boundary,
      });
      const want = Number(pointer.seq) || 0;
      const snapshot = rows.find((row) => row.kind === GROUP_KIND.ROSTER && (want === 0 || Number(row.seq) === want))
        ?? rows.filter((row) => row.kind === GROUP_KIND.ROSTER).sort((a, b) => Number(b.seq) - Number(a.seq))[0]
        ?? null;
      return snapshot ? { ...snapshot } : null;
    },

    async avatarTip({ groupId, epoch, boundary, onShardFailed = null, secret = null }) {
      const bucket = await groupAvatarBucket({ groupId, epoch, boundary, secret });
      const rows = await conv.readIncoming({
        shards: [bucket], epochNow: epoch, windowW: 0, states: null, onShardFailed,
      });
      return rows.reduce((top, row) => Math.max(top, Number(row.seq) || 0), 0);
    },

    async readAvatar({ groupId, pointer, boundary, states = null, onShardFailed = null, onUnreadable = null }) {
      if (!pointer) return null;
      const secretHex = groupAvatarSecretIn(pointer.key);
      const secret = secretHex ? Uint8Array.from(secretHex.match(/../g).map((h) => parseInt(h, 16))) : null;
      const bucket = await groupAvatarBucket({ groupId, epoch: pointer.epoch, boundary, secret });
      const contentKey = await groupAvatarKey(groupId, secret);
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

    async read({ epochs, memberPublicKeys, states = null, knownSeqOf = null, onShardFailed = null, onShardGap = null, onShardRead = null, fullWalk = false, boundary, onUnreadable = null }) {
      const out = [];
      for (const state of epochs) {
        const shards = await groupLaneBuckets({ state, memberPublicKeys, boundary });
        const contentKey = await groupContentKey(state);
        const byAddress = new Map(shards.map((b) => [String(b.address).toLowerCase(), b]));
        const rows = await conv.readIncoming({
          shards, epochNow: state.epoch, windowW: 0, states, knownSeqOf, onShardFailed, onShardGap, onShardRead, fullWalk,
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
            try { onUnreadable?.(message.address, error); } catch { }
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
