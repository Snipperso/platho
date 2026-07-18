// clean-17 client — sharded discovery primitive.
//
// The load-bearing client property of the sharded design: a client that knows its own keys computes every shard
// address LOCALLY, with zero on-chain requests. There is no directory, no index to walk — a shard's address is a
// pure function of its identity (its StateInit), exactly like a jetton wallet address is a function of its owner.
// The client then reads that account's state (or transaction history) directly via its RPC transport.
//
//   CONV record   -> RecordShard(bucket_key, epoch)       — the conversation-direction for a day
//   INTRO         -> IntroShard(epoch, bucket)            — a sender-chosen bucket the recipient scans
//   RECOVERY      -> RecoveryShard(self_bucket_key)       — epoch-independent, the user's own slot
//
// Publishing is DIRECT-PAID straight to these addresses — there is no nullifier/token hop, no issuer and no relay
// (all external infrastructure is forbidden in this project). Writing a CONV bucket is authorized by KNOWING its
// bucket_key, which only the conversation's two participants can derive.
//
// This module derives addresses from the compiled contract StateInit (via the build wrappers). It is transport-
// agnostic: it returns Addresses; the caller reads them with whatever toncenter/indexer transport it already uses
// (see web/capsulehub-ton-rpc-provider.mjs). Browser bundling transpiles the imported wrappers.

import { Address, beginCell, contractAddress } from '@ton/core';
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { RecoveryShard } from '../build/RecoveryShard/RecoveryShard_RecoveryShard';

export const EPOCH_SECONDS = 86400;

export const epochOf = (unixSeconds) => Math.floor(unixSeconds / EPOCH_SECONDS);

// MUST equal RS_SLOT_DOMAIN in RecoveryShard.tact ("RSLK"). The recovery slot IS the owner key.
const RECOVERY_SLOT_DOMAIN = 0x52534C4Bn;
const bytesToBig = (b) => { let x = 0n; for (const byte of b) x = (x << 8n) | BigInt(byte & 0xff); return x; };

/**
 * The RecoveryShard self_bucket_key that commits to an owner pubkey: H(RS_SLOT_DOMAIN ‖ owner_pubkey) as a uint256,
 * mirroring RecoveryShard.slotKeyForOwner. Binding the slot to the key is what closes the post-eviction squat
 * (gate 13575) — only the seed-holder who derived owner_pubkey can name this address.
 */
export function recoveryOwnerSlotKey(ownerPublicKey) {
  const pub = typeof ownerPublicKey === 'bigint' ? ownerPublicKey : bytesToBig(ownerPublicKey);
  return BigInt('0x' + beginCell().storeUint(RECOVERY_SLOT_DOMAIN, 32).storeUint(pub, 256).endCell().hash().toString('hex'));
}

// Every shard is LAZILY DEPLOYED, and CONV/INTRO shards are new EVERY DAY (the epoch is part of their identity).
// So a publisher must be able to CREATE the account, not just address it: a message sent to an uninitialised account
// has its compute phase skipped entirely — nothing is stored, no error is raised, and the sender's wallet reports a
// perfectly successful transaction. That is why these return the StateInit alongside the address, and why the
// publish path must attach it (an extra init on an already-deployed account is harmless).

/** StateInit + address of the CONV record shard for a conversation-direction bucket on a given day-epoch. */
export async function recordShardState(bucketKey, epoch) {
  const init = await RecordShard.init(BigInt(bucketKey), BigInt(epoch));
  return { init, address: contractAddress(0, init) };
}

/** StateInit + address of the INTRO shard for a sender-chosen bucket on a given day-epoch. */
export async function introShardState(epoch, bucket) {
  const init = await IntroShard.init(BigInt(epoch), BigInt(bucket));
  return { init, address: contractAddress(0, init) };
}

/** StateInit + address of the RECOVERY shard for a user's epoch-independent self-recovery key. */
export async function recoveryShardState(selfBucketKey) {
  const init = await RecoveryShard.init(BigInt(selfBucketKey));
  return { init, address: contractAddress(0, init) };
}

/** Address of the CONV record shard for a conversation-direction bucket on a given day-epoch. */
export async function recordShardAddress(bucketKey, epoch) {
  return (await recordShardState(bucketKey, epoch)).address;
}

/** Address of the INTRO shard for a sender-chosen bucket on a given day-epoch (the recipient scans these). */
export async function introShardAddress(epoch, bucket) {
  return (await introShardState(epoch, bucket)).address;
}

/** Address of the RECOVERY shard for a user's epoch-independent self-recovery key. */
export async function recoveryShardAddress(selfBucketKey) {
  return (await recoveryShardState(selfBucketKey)).address;
}

/**
 * The INTRO catch-up scan set: every (epoch, bucket) IntroShard a recipient must read to cover a time window.
 * The recipient does not know which bucket a sender used, so it reads all `bucketCount` buckets for each epoch in
 * [fromEpoch, toEpoch]. Returns a flat list of addresses. Kept a pure local computation (no I/O).
 */
export async function introScanAddresses(fromEpoch, toEpoch, bucketCount) {
  const out = [];
  for (let e = fromEpoch; e <= toEpoch; e += 1) {
    for (let b = 0; b < bucketCount; b += 1) {
      out.push(await introShardAddress(e, b));
    }
  }
  return out;
}

/** Normalize any address-ish input to a comparable string (for matching a read account against a derived address). */
export const addrKey = (a) => (a instanceof Address ? a : Address.parse(String(a))).toString();
