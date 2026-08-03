// clean-17 client — CONV conversation discovery. Ties the bucketKey derivation (conv-routing) to the shard address
// (shard-discovery), so a client can go from "a conversation's K_root" to "the RecordShard addresses to read/write"
// with zero on-chain lookups.
//
// The load-bearing correctness property: A writes its outgoing message into exactly the RecordShard that B reads as
// incoming, for the same (epoch, direction). Both derive the same bucketKey from the shared K_root and the pair's
// key-ids (outgoingDir for A == incomingDir for B), and the RecordShard address is a pure function of (bucketKey,
// epoch). So delivery works with no directory — proven in tests/conv-discovery.test.ts.

import { outgoingBucketKey, incomingBucketKeys, recoveryOwnerPublicKey } from './crypto/conv-routing.mjs?v=2';
import {
  recordShardAddress, recoveryShardAddress, recoveryOwnerSlotKey, RECOVERY_MAX_SLOTS,
} from './shard-discovery.mjs?v=4';

// Portable big-endian bytes -> bigint (the on-chain bucket_key is a uint256 = the 32 HKDF bytes, big-endian).
const bytesToInt = (b) => { let x = 0n; for (const byte of b) x = (x << 8n) | BigInt(byte & 0xff); return x; };

/**
 * The RecordShard addresses a client must READ to receive on a conversation this epoch: the peer's incoming buckets
 * across the acceptance window [epochNow-W .. epochNow]. Each entry is ready to read via the client's RPC transport.
 */
export async function incomingRecordShards({ kRoot, selfKeyId, peerKeyId, epochNow, windowW }) {
  const buckets = await incomingBucketKeys({ kRoot, selfKeyId, peerKeyId, epochNow, windowW });
  const out = [];
  for (const { epoch, dir, bucketKey, writePublicKey } of buckets) {
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
