
import { outgoingBucketKey, incomingBucketKeys, outgoingBucketKeys, recoveryOwnerPublicKey } from './crypto/conv-routing.mjs?v=9';
import {
  addrKey, recordShardAddress, recoveryShardAddress, recoveryOwnerSlotKey, RECOVERY_MAX_SLOTS, epochIsDerivable,
} from './shard-discovery.mjs?v=104';
import { generationForEpoch } from './cutover-epoch.mjs?v=7';

const bytesToInt = (b) => { let x = 0n; for (const byte of b) x = (x << 8n) | BigInt(byte & 0xff); return x; };

export function createRecordShardPlanner({ limit = 512, ceiling = limit } = {}) {
  const cache = new Map();
  const baseLimit = limit;
  const withAddrKey = (shard) => {
    if (!shard || typeof shard !== 'object') return shard;
    const { bucketKey: _unread, ...kept } = shard;
    if (!kept.address || kept.addrKey) return kept;
    try { return { ...kept, addrKey: addrKey(kept.address) }; } catch { return kept; }
  };
  const stats = { hits: 0, misses: 0, evictions: 0, inserts: 0, bypassed: 0, shifted: 0, derivedDays: 0 };
  let pass = 0;
  const hex = (bytes) => Array.from(bytes ?? [], (b) => (b & 0xff).toString(16).padStart(2, '0')).join('');
  const keyOf = (group, { kRoot, selfKeyId, peerKeyId, epochNow, windowW, forwardEpochs = 0 }) =>
    `${group}|${hex(kRoot)}|${hex(selfKeyId)}|${hex(peerKeyId)}|${Number(epochNow)}|${Number(windowW)}|${Number(forwardEpochs) || 0}`;
  const deriveShifted = async (group, derive, args) => {
    const epochNow = Number(args.epochNow);
    const windowW = Number(args.windowW);
    if (!Number.isSafeInteger(epochNow) || epochNow < 1 || !Number.isSafeInteger(windowW) || windowW < 0) return derive(args);
    const forward = Math.max(0, Number(args.forwardEpochs) || 0);
    const from = Math.max(0, epochNow - windowW);
    const newest = epochNow + forward;
    const whole = () => { stats.derivedDays += newest - from + 1; return derive(args); };
    let lent = null;
    for (const day of [epochNow, epochNow - 1]) {
      for (const edge of [0, 1]) {
        if (day === epochNow && edge === forward) continue;
        const held = cache.get(keyOf(group, { ...args, epochNow: day, forwardEpochs: edge }));
        if (!held) continue;
        const byEpoch = new Map();
        for (const shard of held.shards) {
          const epoch = Number(shard?.epoch);
          if (epoch >= from && epoch <= newest && !byEpoch.has(epoch)) byEpoch.set(epoch, shard);
        }
        if (!lent || byEpoch.size > lent.size) lent = byEpoch;
      }
    }
    if (!lent || lent.size === 0) return whole();
    const shards = [];
    for (let epoch = from; epoch <= newest; epoch += 1) {
      if (lent.has(epoch)) { shards.push(lent.get(epoch)); continue; }
      stats.derivedDays += 1;
      // eslint-disable-next-line no-await-in-loop
      shards.push(...await derive({ ...args, epochNow: epoch, windowW: 0, forwardEpochs: 0 }));
    }
    stats.shifted += 1;
    return shards;
  };
  const plan = async (group, derive, args) => {
    const key = keyOf(group, args);
    const held = cache.get(key);
    if (held) {
      stats.hits += 1;
      cache.delete(key);
      held.pass = pass;
      cache.set(key, held);
      return held.shards;
    }
    stats.misses += 1;
    const shards = (await deriveShifted(group, derive, args)).map(withAddrKey);
    if (cache.size >= limit && pass > 0) {
      const oldest = cache.entries().next();
      if (!oldest.done && oldest.value[1].pass === pass) { stats.bypassed += 1; return shards; }
    }
    cache.set(key, { shards, pass });
    stats.inserts += 1;
    while (cache.size > limit) {
      const oldest = cache.keys().next();
      if (oldest.done) break;
      cache.delete(oldest.value);
      stats.evictions += 1;
    }
    return shards;
  };
  const encodeValue = (value) => {
    if (value instanceof Uint8Array) return { hex: hex(value) };
    if (typeof value === 'bigint') return { big: value.toString() };
    return value;
  };
  const decodeValue = (value) => {
    if (value && typeof value === 'object' && typeof value.hex === 'string') {
      const pairs = value.hex.match(/../g) ?? [];
      return Uint8Array.from(pairs, (pair) => Number.parseInt(pair, 16));
    }
    if (value && typeof value === 'object' && typeof value.big === 'string') return BigInt(value.big);
    return value;
  };
  const mapShard = (shard, each) => Object.fromEntries(Object.entries(shard ?? {}).map(([field, value]) => [field, each(value)]));
  return {
    incoming: (args) => plan('in', incomingRecordShards, args),
    outgoing: (args) => plan('out', outgoingRecordShards, args),
    stats,
    get size() { return cache.size; },
    clear() { cache.clear(); },
    beginPass({ expected = 0 } = {}) {
      pass += 1;
      limit = Math.min(ceiling, Math.max(baseLimit, Number(expected) || 0));
    },
    get limit() { return limit; },
    exportEntries({ epochNow, maxWindow, maxEntries = Infinity } = {}) {
      const out = [];
      for (const [key, held] of cache) {
        const fields = key.split('|');
        if (Number(fields[4]) !== Number(epochNow) || Number(fields[5]) > Number(maxWindow)) continue;
        out.push([key, held.shards.map((shard) => { const { addrKey: _derived, ...kept } = shard ?? {}; return mapShard(kept, encodeValue); })]);
      }
      return out.length > maxEntries ? out.slice(out.length - maxEntries) : out;
    },
    importEntries(entries, { grow = false } = {}) {
      if (grow && Array.isArray(entries)) limit = Math.min(ceiling, Math.max(limit, cache.size + entries.length));
      let taken = 0;
      for (const entry of Array.isArray(entries) ? entries : []) {
        const [key, shards] = Array.isArray(entry) ? entry : [];
        if (typeof key !== 'string' || !Array.isArray(shards) || cache.has(key)) continue;
        cache.set(key, { shards: shards.map((shard) => withAddrKey(mapShard(shard, decodeValue))), pass: 0 });
        taken += 1;
      }
      while (cache.size > limit) {
        const oldest = cache.keys().next();
        if (oldest.done) break;
        cache.delete(oldest.value);
        stats.evictions += 1;
      }
      return taken;
    },
  };
}

export async function incomingRecordShards({ kRoot, selfKeyId, peerKeyId, epochNow, windowW, forwardEpochs = 0 }) {
  const buckets = await incomingBucketKeys({ kRoot, selfKeyId, peerKeyId, epochNow, windowW, forwardEpochs });
  const out = [];
  for (const { epoch, dir, bucketKey, writePublicKey } of buckets) {
    if (!epochIsDerivable('record', epoch)) continue;
    out.push({
      epoch, dir, bucketKey, writePublicKey,
      laneGeneration: generationForEpoch(Number(epoch)),
      address: await recordShardAddress(bytesToInt(writePublicKey), epoch),
    });
  }
  return out;
}

export async function outgoingRecordShards({ kRoot, selfKeyId, peerKeyId, epochNow, windowW }) {
  const buckets = await outgoingBucketKeys({ kRoot, selfKeyId, peerKeyId, epochNow, windowW });
  const out = [];
  for (const { epoch, dir, bucketKey, writePublicKey } of buckets) {
    if (!epochIsDerivable('record', epoch)) continue;
    out.push({
      epoch, dir, bucketKey, writePublicKey,
      laneGeneration: generationForEpoch(Number(epoch)),
      address: await recordShardAddress(bytesToInt(writePublicKey), epoch),
    });
  }
  return out;
}

export async function outgoingRecordShard({ kRoot, selfKeyId, peerKeyId, createdAtSec }) {
  const { bucketKey, writePublicKey, writeSecret, epoch, dir } = await outgoingBucketKey({ kRoot, selfKeyId, peerKeyId, createdAtSec });
  return { epoch, dir, bucketKey, writePublicKey, writeSecret, address: await recordShardAddress(bytesToInt(writePublicKey), epoch) };
}

export async function selfRecoveryShard(seed, slotIndex) {
  const ownerPublicKey = await recoveryOwnerPublicKey(seed, slotIndex);
  const slotKey = await recoveryOwnerSlotKey(ownerPublicKey, slotIndex);
  return { ownerPublicKey, slotKey, slotIndex, address: await recoveryShardAddress(slotKey) };
}

const shardSpaceBySeed = new WeakMap();
export async function selfRecoveryShardSpace(seed) {
  if (seed instanceof Uint8Array) {
    const held = shardSpaceBySeed.get(seed);
    if (held) return held;
    const deriving = deriveSelfRecoveryShardSpace(seed);
    shardSpaceBySeed.set(seed, deriving);
    deriving.catch(() => shardSpaceBySeed.delete(seed));
    return deriving;
  }
  return deriveSelfRecoveryShardSpace(seed);
}

async function deriveSelfRecoveryShardSpace(seed) {
  const slots = [];
  for (let slotIndex = 0; slotIndex < RECOVERY_MAX_SLOTS; slotIndex += 1) {
    const ownerPublicKey = await recoveryOwnerPublicKey(seed, slotIndex);
    const slotKey = await recoveryOwnerSlotKey(ownerPublicKey, slotIndex);
    slots.push({ slotIndex, ownerPublicKey, slotKey, address: await recoveryShardAddress(slotKey) });
  }
  return { slots };
}
