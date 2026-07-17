// clean-17 client — CONV conversation discovery. Ties the bucketKey derivation (conv-routing) to the shard address
// (shard-discovery), so a client can go from "a conversation's K_root" to "the RecordShard addresses to read/write"
// with zero on-chain lookups.
//
// The load-bearing correctness property: A writes its outgoing message into exactly the RecordShard that B reads as
// incoming, for the same (epoch, direction). Both derive the same bucketKey from the shared K_root and the pair's
// key-ids (outgoingDir for A == incomingDir for B), and the RecordShard address is a pure function of (bucketKey,
// epoch). So delivery works with no directory — proven in tests/conv-discovery.test.ts.

import { outgoingBucketKey, incomingBucketKeys, selfRecoveryBucketKey } from './crypto/conv-routing.mjs';
import { recordShardAddress, recoveryShardAddress } from './shard-discovery.mjs';

// Portable big-endian bytes -> bigint (the on-chain bucket_key is a uint256 = the 32 HKDF bytes, big-endian).
const bytesToInt = (b) => { let x = 0n; for (const byte of b) x = (x << 8n) | BigInt(byte & 0xff); return x; };

/**
 * The RecordShard addresses a client must READ to receive on a conversation this epoch: the peer's incoming buckets
 * across the acceptance window [epochNow-W .. epochNow]. Each entry is ready to read via the client's RPC transport.
 */
export async function incomingRecordShards({ kRoot, selfKeyId, peerKeyId, epochNow, windowW }) {
  const buckets = await incomingBucketKeys({ kRoot, selfKeyId, peerKeyId, epochNow, windowW });
  const out = [];
  for (const { epoch, dir, bucketKey } of buckets) {
    out.push({ epoch, dir, bucketKey, address: await recordShardAddress(bytesToInt(bucketKey), epoch) });
  }
  return out;
}

/** The RecordShard address a client WRITES its outgoing message into for a capsule stamped createdAtSec. */
export async function outgoingRecordShard({ kRoot, selfKeyId, peerKeyId, createdAtSec }) {
  const { bucketKey, epoch, dir } = await outgoingBucketKey({ kRoot, selfKeyId, peerKeyId, createdAtSec });
  return { epoch, dir, bucketKey, address: await recordShardAddress(bytesToInt(bucketKey), epoch) };
}

/** The RecoveryShard address for a user's own self-recovery snapshot, derived from the mnemonic seed (epoch-0 sentinel). */
export async function selfRecoveryShard(seed) {
  const bucketKey = await selfRecoveryBucketKey(seed);
  return { bucketKey, address: await recoveryShardAddress(bytesToInt(bucketKey)) };
}
