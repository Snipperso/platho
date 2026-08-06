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
// THIS MODULE MUST LOAD IN THE BROWSER. It used to derive addresses from `@ton/core` and the compiled Tact
// wrappers under build/, which do not load there — and because intro-receive, intro-scan-runner, shard-reader
// and conv-discovery all import it, that single dependency kept the ENTIRE receive path out of the browser.
// It now derives everything through web/shard-address.mjs, which hand-rolls the same StateInit encoding and is
// pinned address-for-address against @ton/core in tests/shard-browser-address.test.ts.
//
// The reference implementation still exists: web/publish-builder.mjs derives its own StateInit straight from
// the compiled wrappers. That is deliberate — two independent implementations that must agree is the only
// evidence worth having for address derivation, because a wrong address cannot be detected at send time (a
// message to an uninitialised account has its compute phase skipped and simply vanishes).
//
// Addresses are returned as url-safe friendly STRINGS, which is the wire form toncenter packs 35% tighter than
// raw hex (measured 2026-07-18) and what every consumer here ultimately needs.

import { beginCell, computeCellHashAndDepth } from './pwa-contract-transactions.mjs?v=35';
import { parseTonAddress } from './crypto/platho-crypto.mjs?v=13';
import { formatTonUserFriendlyAddress } from './platho-wallet.mjs?v=29';
import {
  recordShardStateInit,
  introShardStateInit,
  recoveryShardStateInit,
  recordShardAddressBytes,
  introShardAddressBytes,
  recoveryShardAddressBytes,
  publicShardAddressBytes,
  rawAddress,
} from './shard-address.mjs?v=5';

export const EPOCH_SECONDS = 86400;

export const epochOf = (unixSeconds) => Math.floor(unixSeconds / EPOCH_SECONDS);

// MUST equal RS_SLOT_DOMAIN in RecoveryShard.tact ("RSLK"). The recovery slot IS the owner key plus its index.
const RECOVERY_SLOT_DOMAIN = 0x52534C4Bn;
const bytesToBig = (b) => { let x = 0n; for (const byte of b) x = (x << 8n) | BigInt(byte & 0xff); return x; };

/**
 * RECOVERY_MAX_SLOTS — MUST equal RS_MAX_SLOTS in RecoveryShard.tact.
 *
 * A restoring client probes [0, this) in ONE batched accountStates read, because nothing on chain enumerates a
 * user's slots. That makes this number the recovery horizon: a blob outside it is written, paid for, and never read
 * again. The contract gates the same bound (13576) so an out-of-range write is refused loudly instead of vanishing
 * quietly — but a client that probed a SHORTER range than it writes would reintroduce the same silent loss on its
 * own, which is why this is one named constant rather than a literal at each site.
 */
export const RECOVERY_MAX_SLOTS = 256;

/**
 * RECOVERY_NAMED_SLOTS — MUST equal RS_NAMED_SLOTS in RecoveryShard.tact. The block [RECOVERY_MAX_SLOTS,
 * RECOVERY_MAX_SLOTS + RECOVERY_NAMED_SLOTS) is NOT scanned: each named slot holds a single KNOWN self-data blob (prefs
 * first) that the client reads by its FIXED deterministic address, so it is reachable without enumeration and never
 * orphaned. Conversations still hash into [0, RECOVERY_MAX_SLOTS) only; named slots are addressed by their constant.
 */
export const RECOVERY_NAMED_SLOTS = 16;
/** The named slot that carries the seed-durable prefs (public-channel subscriptions) blob. */
export const PREFS_NAMED_SLOT_INDEX = RECOVERY_MAX_SLOTS;

/**
 * The named-slot RANGE that carries self-notes ("My notes").
 *
 * Notes cannot ride the CONV lane at all: a conversation with yourself has no direction to derive
 * (conversationOrder refuses self==self by construction and points here), which is why they get the self lane the
 * crypto layer already reserved for self-data. They need a RANGE rather than one slot because a slot holds a
 * MEASURED ~7.4 KB of plaintext (RS_MAX_BLOB_CELLS=79 cells of base64-in-JSON around AES-GCM ciphertext) — about
 * two dozen tweet-length notes, which is not a notepad. Eight slots give ~59 KB.
 *
 * The range stops at 8 on purpose: [265, 272) stays free for the next durable-self type (block lists, settings),
 * exactly as prefs left room for notes.
 */
export const NOTES_NAMED_SLOT_BASE = RECOVERY_MAX_SLOTS + 1;
export const NOTES_NAMED_SLOT_COUNT = 8;

/**
 * The RecoveryShard self_bucket_key for one of an owner's slots: H(RS_SLOT_DOMAIN ‖ owner_pubkey ‖ slot_index) as a
 * uint256, mirroring RecoveryShard.slotKeyForOwner. Binding the slot to the key is what closes the post-eviction
 * squat (gate 13575) — only the seed-holder who derived owner_pubkey can name any of these addresses.
 *
 * `slotIndex` is REQUIRED and deliberately has no default. It decides which address this is, and a caller who
 * silently got 0 when they meant 3 would overwrite the blob in slot 0 — a valid signature and a higher seq, so the
 * contract accepts it and the real slot-0 conversations are gone. An explicit argument makes that unmissable. Valid
 * range is the union of the scanned conversation partition and the named block, exactly the contract's gate 13576.
 */
// Async because the browser cell hasher is: there is no synchronous sha256 in the platform's crypto API.
export async function recoveryOwnerSlotKey(ownerPublicKey, slotIndex) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= RECOVERY_MAX_SLOTS + RECOVERY_NAMED_SLOTS) {
    throw new Error(`recoveryOwnerSlotKey: slotIndex must be an integer in [0, ${RECOVERY_MAX_SLOTS + RECOVERY_NAMED_SLOTS}), got ${slotIndex}`);
  }
  const pub = typeof ownerPublicKey === 'bigint' ? ownerPublicKey : bytesToBig(ownerPublicKey);
  const cell = beginCell()
    .uint(RECOVERY_SLOT_DOMAIN, 32, 'RS_SLOT_DOMAIN')
    .uint(pub, 256, 'owner_pubkey')
    .uint(BigInt(slotIndex), 32, 'slot_index')
    .endCell();
  const { hash } = await computeCellHashAndDepth(cell);
  return bytesToBig(hash);
}

// Every shard is LAZILY DEPLOYED, and CONV/INTRO shards are new EVERY DAY (the epoch is part of their identity).
// So a publisher must be able to CREATE the account, not just address it: a message sent to an uninitialised account
// has its compute phase skipped entirely — nothing is stored, no error is raised, and the sender's wallet reports a
// perfectly successful transaction. That is why these return the StateInit alongside the address, and why the
// publish path must attach it (an extra init on an already-deployed account is harmless).

/** StateInit + address of the CONV record shard for a conversation-direction bucket on a given day-epoch. */
export async function recordShardState(bucketKey, epoch) {
  return {
    init: recordShardStateInit(BigInt(bucketKey), BigInt(epoch)),
    address: await friendly(recordShardAddressBytes(BigInt(bucketKey), BigInt(epoch))),
  };
}

/** StateInit + address of the INTRO shard for a sender-chosen bucket on a given day-epoch. */
export async function introShardState(epoch, bucket) {
  return {
    init: introShardStateInit(BigInt(epoch), BigInt(bucket)),
    address: await friendly(introShardAddressBytes(BigInt(epoch), BigInt(bucket))),
  };
}

/** StateInit + address of the RECOVERY shard for a user's epoch-independent self-recovery key. */
export async function recoveryShardState(selfBucketKey) {
  return {
    init: recoveryShardStateInit(BigInt(selfBucketKey)),
    address: await friendly(recoveryShardAddressBytes(BigInt(selfBucketKey))),
  };
}

/** The wire form: url-safe friendly, bounceable — 35% tighter in a toncenter query than raw hex. */
async function friendly(addressBytesPromise) {
  const { workchain, hash } = await addressBytesPromise;
  return formatTonUserFriendlyAddress(rawAddress({ workchain, hash }), { bounceable: true });
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
 * INTRO_READ_SPACE — how many buckets a recipient reads. [OWNER DECISION 2026-07-18: 1024.]
 *
 * This is a CLIENT convention, not a contract constant: IntroShard.init takes an arbitrary bucket, so this number
 * lives here and nowhere on chain. Two consequences shape everything below.
 *
 * FIRST, the read space and the write space are separate, and only the read space needs agreement. A sender that
 * mis-estimates how wide to write still writes INSIDE the read space, so its message is found — the failure mode
 * is uneven bucket fill, not a lost first contact. That is what makes it safe to let the write space float with
 * load while this stays fixed, and it removes the entire class of sender/scanner divergence bugs.
 *
 * SECOND, cost is per REQUEST, not per bucket, so this number should sit just under a request boundary. MEASURED
 * against live toncenter v3 on 2026-07-18, using real IntroShard addresses:
 *   - accountStates is capped by URL LENGTH at 64 KiB, not by any address count: 1149 addresses fit (65_553 B),
 *     1150+ is refused with HTTP 414.
 *   - The wire form matters. A url-safe friendly address encodes to 48 chars with NO percent-escaping (url-safe
 *     base64 uses - and _), i.e. 57.1 B per address including "address=" and "&". Raw hex costs 77.1 B and only
 *     850 fit — 35% worse. ALWAYS send the url-safe friendly form.
 *   - Uninitialised accounts are OMITTED from the response entirely, so empty buckets cost nothing in bytes; a
 *     live bucket costs ~439 B. Requests therefore track this constant, bytes track actual traffic.
 * So 1024 buckets = ONE request per scan pass, with headroom. Minute-fresh first contact costs ~3 minutes of
 * connection per day; a scan on app-open costs one request and about a second.
 *
 * CEILING AND HOW TO RAISE IT. 1024 x IS_SAFE_CAP (8000) = 8.2M first contacts per day network-wide, roughly
 * three billion a year. If that is ever reached, this number CAN be raised without redeploying anything: widening
 * the read side is backward-compatible, because scanners reading a wider range still find everything written in
 * the narrower one. Ship the wider reader first, let it propagate, and only then let senders use the new range.
 * Never narrow it — a sender still using the old width would be writing where nobody looks.
 */
export const INTRO_READ_SPACE = 1024;

/**
 * The INTRO catch-up scan set: every (epoch, bucket) IntroShard a recipient must read to cover a time window.
 * The recipient does not know which bucket a sender used, so it reads all `bucketCount` buckets for each epoch in
 * [fromEpoch, toEpoch]. Returns a flat list of addresses. Kept a pure local computation (no I/O).
 *
 * `bucketCount` defaults to INTRO_READ_SPACE. Pass a larger value to over-read (always safe, costs only requests);
 * passing a smaller one risks missing first contacts and should only ever be done in tests.
 */
export async function introScanAddresses(fromEpoch, toEpoch, bucketCount = INTRO_READ_SPACE) {
  const out = [];
  for (let e = fromEpoch; e <= toEpoch; e += 1) {
    for (let b = 0; b < bucketCount; b += 1) {
      out.push(await introShardAddress(e, b));
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// PUBLIC LANE — channel posts, comment threads, the beacon directory, and avatar image bytes (PublicShard).
//
// A PublicShard address is publicShardAddress(partition_key, epoch_tag), where epoch_tag = (kind<<32)|era and
// partition_key is a domain-separated hash the CONTRACT recomputes and checks against its own partition_key
// (contracts/PublicShard.tact). These derivations MUST match the contract's preimages byte for byte — a wrong
// one is a live, well-formed address nobody reads, the silent-loss failure the whole shard-address module guards.
// Pinned against the contract in tests/public-lane-discovery.test.ts.

// MUST equal the constants in contracts/PublicShard.tact.
const PS_KIND = Object.freeze({ CHANNEL: 0, THREAD: 1, BEACON: 2, AVATAR: 3 });
const PS_ERA_SHORT = 2592000;   // 30 days — CHANNEL, THREAD
const PS_ERA_LONG = 31536000;   // 1 year  — BEACON, AVATAR
const PS_CHANNEL_DOMAIN = 0x50534348n;   // "PSCH"
const PS_THREAD_DOMAIN = 0x50535448n;    // "PSTH"
const PS_BEACON_DOMAIN = 0x50534243n;    // "PSBC"
const PS_AVATAR_DOMAIN = 0x50534156n;    // "PSAV"
const PS_POST_UID_DOMAIN = 0x50535544n;  // "PSUD"

/**
 * The BEACON directory width — how many buckets a client sweeps to discover channels. A CLIENT constant, in NO
 * contract gate, so it is widen-only with no redeploy, exactly like INTRO_READ_SPACE. [OWNER 2026-07-21: 1024.]
 * 1024 url-safe friendly addresses fit ONE 64 KiB accountStates request (measured 2026-07-18), so a full-directory
 * sweep of one era is a single request. NEVER narrow it — an announcer on the old width would land where nobody
 * looks. Widen by shipping the reader first, letting it propagate, then letting announcers use the new range.
 */
export const PUBLIC_BEACON_READ_SPACE = 1024;

/** How many overflow shards a reader probes per (channel/thread, era) before giving up. Client-side, widen-only. */
export const PUBLIC_SEQ_PROBE = 4;

export const publicEraOf = (kind, unixSeconds) =>
  Math.floor(unixSeconds / (kind < PS_KIND.BEACON ? PS_ERA_SHORT : PS_ERA_LONG));

export const publicEpochTag = (kind, era) => (BigInt(kind) << 32n) | BigInt(era);

const bigToBucket = (n) => BigInt(n) & 0xFFFFFFFFn;

/** H over a builder, as a uint256 — the browser's async sha256 cell hasher (no sync sha256 in the platform API). */
async function hashCell(cell) {
  const { hash } = await computeCellHashAndDepth(cell);
  return bytesToBig(hash);
}

/**
 * partition_key for each kind, reproducing contracts/PublicShard.tact.claimedPartitionKey EXACTLY.
 *   CHANNEL: H(PS_CHANNEL_DOMAIN ‖ ownerHash:256 ‖ shard_seq:32)   ownerHash = the channel wallet's account hash
 *   THREAD:  H(PS_THREAD_DOMAIN  ‖ post_uid:256  ‖ shard_seq:32)
 *   BEACON:  H(PS_BEACON_DOMAIN  ‖ bucket:32)
 *   AVATAR:  H(PS_AVATAR_DOMAIN  ‖ ownerHash:256)
 */
export async function publicChannelPartitionKey(ownerWalletHash, shardSeq = 0) {
  return hashCell(beginCell()
    .uint(PS_CHANNEL_DOMAIN, 32, 'PS_CHANNEL_DOMAIN')
    .uint(BigInt(ownerWalletHash), 256, 'owner_hash')
    .uint(BigInt(shardSeq), 32, 'shard_seq')
    .endCell());
}
export async function publicThreadPartitionKey(postUid, shardSeq = 0) {
  return hashCell(beginCell()
    .uint(PS_THREAD_DOMAIN, 32, 'PS_THREAD_DOMAIN')
    .uint(BigInt(postUid), 256, 'post_uid')
    .uint(BigInt(shardSeq), 32, 'shard_seq')
    .endCell());
}
export async function publicBeaconPartitionKey(bucket) {
  return hashCell(beginCell()
    .uint(PS_BEACON_DOMAIN, 32, 'PS_BEACON_DOMAIN')
    .uint(bigToBucket(bucket), 32, 'bucket')
    .endCell());
}
export async function publicAvatarPartitionKey(ownerWalletHash) {
  return hashCell(beginCell()
    .uint(PS_AVATAR_DOMAIN, 32, 'PS_AVATAR_DOMAIN')
    .uint(BigInt(ownerWalletHash), 256, 'owner_hash')
    .endCell());
}

/**
 * post_uid = H(PS_POST_UID_DOMAIN ‖ channel_partition_key ‖ epoch_tag ‖ entry_id). A reader that rendered a post
 * holds all three, so a comment thread's address is O(1) derivable and never needs an index. Mirrors
 * contracts/PublicShard.tact's PS_POST_UID_DOMAIN preimage.
 */
export async function publicPostUid(channelPartitionKey, epochTag, entryId) {
  return hashCell(beginCell()
    .uint(PS_POST_UID_DOMAIN, 32, 'PS_POST_UID_DOMAIN')
    .uint(BigInt(channelPartitionKey), 256, 'channel_partition_key')
    .uint(BigInt(epochTag), 64, 'epoch_tag')
    .uint(BigInt(entryId), 64, 'entry_id')
    .endCell());
}

/** The 256-bit account hash of a basechain address, the value the contract folds via senderHash(). */
export function publicWalletHash(address) {
  const { hash } = parseTonAddress(String(address));
  return bytesToBig(hash);
}

/** friendly address of a PublicShard partition, for the toncenter query. */
async function publicShardFriendly(partitionKey, epochTag) {
  return friendly(publicShardAddressBytes(partitionKey, epochTag));
}

/**
 * The BEACON sweep set: every directory bucket across a window of eras, newest era first. A fresh client reads
 * these with ONE batched accountStates call per era (1024 < the 1149-address URL budget) and ranks live buckets
 * by entry_count — NOT last_transaction_lt, which an attacker moves for a forward fee. Pure local computation.
 */
export async function publicBeaconScanAddresses(nowUnix, eraWindow = 3, bucketCount = PUBLIC_BEACON_READ_SPACE) {
  const era = publicEraOf(PS_KIND.BEACON, nowUnix);
  const out = [];
  for (let e = era; e > era - eraWindow && e >= 0; e -= 1) {
    const tag = publicEpochTag(PS_KIND.BEACON, e);
    for (let b = 0; b < bucketCount; b += 1) {
      out.push(await publicShardFriendly(await publicBeaconPartitionKey(b), tag));
    }
  }
  return out;
}

/** A channel's post shards for an era window, probing overflow seqs — the addresses a subscriber reads. */
export async function publicChannelScanAddresses(ownerWalletHash, nowUnix, eraWindow = 3, seqProbe = PUBLIC_SEQ_PROBE) {
  const era = publicEraOf(PS_KIND.CHANNEL, nowUnix);
  const out = [];
  for (let e = era; e > era - eraWindow && e >= 0; e -= 1) {
    const tag = publicEpochTag(PS_KIND.CHANNEL, e);
    for (let seq = 0; seq < seqProbe; seq += 1) {
      out.push(await publicShardFriendly(await publicChannelPartitionKey(ownerWalletHash, seq), tag));
    }
  }
  return out;
}

/** A wallet's avatar shard for the current era and the two before it; the stream lives in whichever is live. */
export async function publicAvatarScanAddresses(ownerWalletHash, nowUnix, eraWindow = 3) {
  const era = publicEraOf(PS_KIND.AVATAR, nowUnix);
  const pk = await publicAvatarPartitionKey(ownerWalletHash);
  const out = [];
  for (let e = era; e > era - eraWindow && e >= 0; e -= 1) {
    out.push(await publicShardFriendly(pk, publicEpochTag(PS_KIND.AVATAR, e)));
  }
  return out;
}

/**
 * Normalize any address-ish input to one comparable key, so a derived address matches what an endpoint returned.
 * Both forms occur in practice: we send url-safe friendly, toncenter answers in raw `0:HEX`. The canonical form
 * is raw lowercase because it is unambiguous — friendly encodes bounceable/testnet flags that do not change
 * which account is meant, so two friendly strings for the same account can differ.
 */
export function addrKey(a) {
  const { workchain, hash } = parseTonAddress(String(a));
  const hex = Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${workchain}:${hex}`;
}
