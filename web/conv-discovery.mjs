// clean-17 client — CONV conversation discovery. Ties the bucketKey derivation (conv-routing) to the shard address
// (shard-discovery), so a client can go from "a conversation's K_root" to "the RecordShard addresses to read/write"
// with zero on-chain lookups.
//
// The load-bearing correctness property: A writes its outgoing message into exactly the RecordShard that B reads as
// incoming, for the same (epoch, direction). Both derive the same bucketKey from the shared K_root and the pair's
// key-ids (outgoingDir for A == incomingDir for B), and the RecordShard address is a pure function of (bucketKey,
// epoch). So delivery works with no directory — proven in tests/conv-discovery.test.ts.

import { outgoingBucketKey, incomingBucketKeys, outgoingBucketKeys, recoveryOwnerPublicKey } from './crypto/conv-routing.mjs?v=5';
import {
  recordShardAddress, recoveryShardAddress, recoveryOwnerSlotKey, RECOVERY_MAX_SLOTS, epochIsDerivable,
} from './shard-discovery.mjs?v=58';

// Portable big-endian bytes -> bigint (the on-chain bucket_key is a uint256 = the 32 HKDF bytes, big-endian).
const bytesToInt = (b) => { let x = 0n; for (const byte of b) x = (x << 8n) | BigInt(byte & 0xff); return x; };

/**
 * A PLANNER THAT DERIVES EACH CONVERSATION'S SHARD ADDRESSES ONCE, NOT ONCE PER PASS.
 *
 * MEASURED 2026-08-29 (node 22, desktop, 50 conversations): 2.662 ms per conversation per pass, 0.4437 ms per
 * address, six addresses each — HKDF per epoch per direction, an ed25519 keygen, then a StateInit hash. The receive
 * pass runs every 12 s at its idle tier and re-derived all of it every time, so the cost scaled with how many
 * conversations a person HAS rather than with what arrived: 500 conversations is 1.33 s of CPU every 12 s on this
 * desktop (11.1% duty) and several times that on a phone — the freeze class this project has already been bitten by.
 *
 * The derivation is a pure function of (kRoot, selfKeyId, peerKeyId, epoch, window), and in the steady state all
 * five hold still for a whole day: the epoch is a day, the window is CONV_RECV_WINDOW_W, the keys do not move. So
 * a warm pass derives NOTHING and the term disappears. Anything that legitimately changes the answer — a new epoch,
 * a re-INTRO adopting a new K_root, a manual full rescan widening the window — changes the key and derives afresh,
 * which is why the whole tuple is in the key rather than a subset of it.
 *
 * BOUNDED, and cleared by the caller on teardown: the addresses are derived FROM this identity's keys, so a cache
 * that outlived a wallet switch would be one wallet's routing held open for the next one.
 * `stats` counts hits/misses/evictions so a test can prove the second pass really costs nothing.
 */
export function createRecordShardPlanner({ limit = 512 } = {}) {
  const cache = new Map();
  const stats = { hits: 0, misses: 0, evictions: 0 };
  const hex = (bytes) => Array.from(bytes ?? [], (b) => (b & 0xff).toString(16).padStart(2, '0')).join('');
  const keyOf = (group, { kRoot, selfKeyId, peerKeyId, epochNow, windowW }) =>
    `${group}|${hex(kRoot)}|${hex(selfKeyId)}|${hex(peerKeyId)}|${Number(epochNow)}|${Number(windowW)}`;
  const plan = async (group, derive, args) => {
    const key = keyOf(group, args);
    const held = cache.get(key);
    if (held) {
      stats.hits += 1;
      cache.delete(key);              // reinsert: insertion order doubles as the LRU list
      cache.set(key, held);
      return held;
    }
    stats.misses += 1;
    const shards = await derive(args);
    cache.set(key, shards);
    while (cache.size > limit) {
      const oldest = cache.keys().next();
      if (oldest.done) break;
      cache.delete(oldest.value);
      stats.evictions += 1;
    }
    return shards;
  };
  return {
    incoming: (args) => plan('in', incomingRecordShards, args),
    outgoing: (args) => plan('out', outgoingRecordShards, args),
    stats,
    get size() { return cache.size; },
    clear() { cache.clear(); },
  };
}

/**
 * The RecordShard addresses a client must READ to receive on a conversation this epoch: the peer's incoming buckets
 * across the acceptance window [epochNow-W .. epochNow]. Each entry is ready to read via the client's RPC transport.
 */
export async function incomingRecordShards({ kRoot, selfKeyId, peerKeyId, epochNow, windowW }) {
  const buckets = await incomingBucketKeys({ kRoot, selfKeyId, peerKeyId, epochNow, windowW });
  const out = [];
  for (const { epoch, dir, bucketKey, writePublicKey } of buckets) {
    // SKIP AN EPOCH THIS BUILD CANNOT ADDRESS, never reject the whole window on it [audit 2026-08-31, round 7;
    // CORRECTED round 8]. Round 7 added this as the twin of CUTEPOCH-09's INTRO fix and claimed it keeps
    // delivering epochs E-1 and E-2 on day E. IT DOES NOT, and the difference between the two lanes is worth
    // stating rather than papering over: the INTRO window looks one epoch AHEAD (C+1, for clock skew), so on
    // day E-1 it reaches E while cutoverUpdateRequired() is still false — its skip is genuinely load-bearing.
    // The CONV window does not (incomingBucketKeys / outgoingBucketKeys loop `e <= now`), so its top epoch is
    // epochNow, and the only day this guard could fire is a day syncConvCapsulesFromShards has ALREADY left
    // through its own 'update_required' return before reaching the planner. Verified: one caller, past that
    // guard.
    //
    // It stays because it costs one comparison and removes a whole failure mode from the future: laneCodeBoc
    // throws CUTOVER_UPDATE_REQUIRED from inside the derivation, OUTSIDE any per-epoch guard, so a read path
    // that ever reaches an unaddressable epoch rejects the entire pass rather than that one epoch. Skipping is
    // also the honest answer on its own terms — before the flip there is no generation-18 RecordShard to read.
    if (!epochIsDerivable('record', epoch)) continue;
    out.push({ epoch, dir, bucketKey, writePublicKey, address: await recordShardAddress(bytesToInt(writePublicKey), epoch) });
  }
  return out;
}

/**
 * The RecordShard addresses a client must READ to get its OWN sent messages back: its outgoing buckets across the
 * window [epochNow-W .. epochNow] — the exact shards outgoingRecordShard wrote into, one per epoch. The mirror of
 * incomingRecordShards; a restored device reads both sides of every conversation (gate CONV-DISC-05).
 */
export async function outgoingRecordShards({ kRoot, selfKeyId, peerKeyId, epochNow, windowW }) {
  const buckets = await outgoingBucketKeys({ kRoot, selfKeyId, peerKeyId, epochNow, windowW });
  const out = [];
  for (const { epoch, dir, bucketKey, writePublicKey } of buckets) {
    // SKIP AN EPOCH THIS BUILD CANNOT ADDRESS, never reject the whole window on it [audit 2026-08-31, round 7;
    // CORRECTED round 8]. Round 7 added this as the twin of CUTEPOCH-09's INTRO fix and claimed it keeps
    // delivering epochs E-1 and E-2 on day E. IT DOES NOT, and the difference between the two lanes is worth
    // stating rather than papering over: the INTRO window looks one epoch AHEAD (C+1, for clock skew), so on
    // day E-1 it reaches E while cutoverUpdateRequired() is still false — its skip is genuinely load-bearing.
    // The CONV window does not (incomingBucketKeys / outgoingBucketKeys loop `e <= now`), so its top epoch is
    // epochNow, and the only day this guard could fire is a day syncConvCapsulesFromShards has ALREADY left
    // through its own 'update_required' return before reaching the planner. Verified: one caller, past that
    // guard.
    //
    // It stays because it costs one comparison and removes a whole failure mode from the future: laneCodeBoc
    // throws CUTOVER_UPDATE_REQUIRED from inside the derivation, OUTSIDE any per-epoch guard, so a read path
    // that ever reaches an unaddressable epoch rejects the entire pass rather than that one epoch. Skipping is
    // also the honest answer on its own terms — before the flip there is no generation-18 RecordShard to read.
    if (!epochIsDerivable('record', epoch)) continue;
    out.push({ epoch, dir, bucketKey, writePublicKey, address: await recordShardAddress(bytesToInt(writePublicKey), epoch) });
  }
  return out;
}

/** The RecordShard address a client WRITES its outgoing message into for a capsule stamped createdAtSec. */
export async function outgoingRecordShard({ kRoot, selfKeyId, peerKeyId, createdAtSec }) {
  const { bucketKey, writePublicKey, writeSecret, epoch, dir } = await outgoingBucketKey({ kRoot, selfKeyId, peerKeyId, createdAtSec });
  return { epoch, dir, bucketKey, writePublicKey, writeSecret, address: await recordShardAddress(bytesToInt(writePublicKey), epoch) };
}

/**
 * The RecoveryShard address for ONE of a user's self-recovery slots, derived from the mnemonic seed. The slot COMMITS
 * to the recovery owner key (self_bucket_key = H(RS_SLOT_DOMAIN ‖ owner_pubkey ‖ slot_index)), so only the seed-holder
 * can bind any of them — the squat-close (gate 13575). Returns the owner pubkey (needed to sign the recovery publish)
 * alongside the slot.
 *
 * `slotIndex` is required; recoveryOwnerSlotKey explains why it must not default.
 */
export async function selfRecoveryShard(seed, slotIndex) {
  const ownerPublicKey = await recoveryOwnerPublicKey(seed, slotIndex);   // W1-015: per-slot key
  const slotKey = await recoveryOwnerSlotKey(ownerPublicKey, slotIndex);
  return { ownerPublicKey, slotKey, slotIndex, address: await recoveryShardAddress(slotKey) };
}

/**
 * EVERY slot address a restoring client must look at, in index order.
 *
 * This is the whole recovery-discovery mechanism: nothing on chain enumerates a user's slots, so the client asks
 * about all RECOVERY_MAX_SLOTS of them in one batched accountStates read and keeps whichever exist. Never-written
 * slots simply have no row (toncenter omits addresses it has never seen), so the unused tail is free.
 *
 * PROBE THE WHOLE RANGE — never stop at the first gap. Slots are filled densely from 0, but a slot can be EVICTED
 * after 3 years of inactivity while later ones stay live, which puts a hole in the middle. Stopping at the first
 * miss would silently drop every conversation above the hole, and silent loss at restore time is the one failure
 * this lane exists to prevent.
 */
export async function selfRecoveryShardSpace(seed) {
  // W1-015: each slot now has its OWN owner key (per-slot HKDF), so the pubkey is derived INSIDE the loop and each slot
  // carries its own. There is no single user-wide recovery pubkey any more — that shared key was the enumeration handle.
  const slots = [];
  for (let slotIndex = 0; slotIndex < RECOVERY_MAX_SLOTS; slotIndex += 1) {
    const ownerPublicKey = await recoveryOwnerPublicKey(seed, slotIndex);
    const slotKey = await recoveryOwnerSlotKey(ownerPublicKey, slotIndex);
    slots.push({ slotIndex, ownerPublicKey, slotKey, address: await recoveryShardAddress(slotKey) });
  }
  return { slots };
}
