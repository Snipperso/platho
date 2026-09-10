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

import { beginCell, computeCellHashAndDepth } from './pwa-contract-transactions.mjs?v=47';
import { parseTonAddress } from './crypto/platho-crypto.mjs?v=21';
import { formatTonUserFriendlyAddress } from './platho-wallet.mjs?v=57';
import {
  recordShardStateInit,
  introShardStateInit,
  recoveryShardStateInit,
  recordShardAddressBytes,
  introShardAddressBytes,
  recoveryShardAddressBytes,
  publicShardAddressBytesFor,
  hasLaneCode,
  canDeriveForEpoch,
  rawAddress,
} from './shard-address.mjs?v=29';
import { generationsForEra } from './cutover-epoch.mjs?v=4';

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
// Async because the browser cell hasher is. [CORRECTED 2026-08-28 — this line used to end "…because there is no
// synchronous sha256 in the platform's crypto API", which is true and was the wrong conclusion. We do not need
// the PLATFORM's: a synchronous sha256 already ships in this client (vendor/@noble/hashes), and the cell hasher
// now uses it — crypto.subtle's per-call overhead was the entire cost of the derivation on small inputs, 16x
// MEASURED. The signature stays async only so ~40 call sites keep working; nothing here waits on the platform.]
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

// THE ADDRESS-ONLY PATH SKIPS THE STATEINIT [2026-08-28, owner's standing speed directive]. These three used to
// go through their *State() sibling, which builds the StateInit cell AND derives the address — and the address
// derivation builds the very same cell again internally. The init was then thrown away. That is pure waste on
// the hottest loop the client has: an intro sweep derives INTRO_READ_SPACE x epochs addresses and needs the
// StateInit for NONE of them (only a publish attaches one). MEASURED old-vs-new over a real 1024 x 8 =
// 8,192-address sweep, best of three: 493 ms -> 419 ms, a saving of 73 ms per sweep (14.9%), on top of the hash
// memo in shard-address.mjs (which took the same sweep from ~3.1 s). Per address: 0.0601 ms -> 0.0512 ms.
// Callers that genuinely need the init still call *State() and pay for it once, deliberately.

/** Address of the CONV record shard for a conversation-direction bucket on a given day-epoch. */
export async function recordShardAddress(bucketKey, epoch) {
  return friendly(recordShardAddressBytes(BigInt(bucketKey), BigInt(epoch)));
}

/** Address of the INTRO shard for a sender-chosen bucket on a given day-epoch (the recipient scans these). */
export async function introShardAddress(epoch, bucket) {
  return friendly(introShardAddressBytes(BigInt(epoch), BigInt(bucket)));
}

/** Can THIS build address that lane's shards for that day-epoch — the per-epoch sweep filter [round 5]. See
 *  canDeriveForEpoch in shard-address.mjs: a scan must skip an epoch whose generation it carries no cell for,
 *  rather than reject the whole pass on it. Re-exported here so the lane sweeps keep one import home. */
export const epochIsDerivable = canDeriveForEpoch;

/** Address of the RECOVERY shard for a user's epoch-independent self-recovery key. */
export async function recoveryShardAddress(selfBucketKey) {
  return friendly(recoveryShardAddressBytes(BigInt(selfBucketKey)));
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
 *   BEACON:  H(PS_BEACON_DOMAIN  ‖ bucket:32)          <- NO shard_seq on the LIVE contract; see the note below
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
  // 🔴 DO NOT FOLD shard_seq HERE. It is the one PublicShard kind whose LIVE partition key does not carry it
  // (contracts/PublicShard.tact:301), and a client that folds it derives an address the live contract refuses at
  // gate 13702 — silently, for every channel announcement in the network. That is not hypothetical: this function
  // was changed to fold it on 2026-08-29 and reverted within the hour, caught only because tests/public-lane
  // drives the live build. The comment block that claimed the fold had landed survived the revert for a while
  // longer, which is exactly how the mistake would have come back.
  // The fold is RIGHT, and it is a CUTOVER change: clean-18 folds it (contracts18/contracts/PublicShard.tact).
  // It ships together with the successor probe, when that contract is the one on chain, and not one line before.
  //
  // 🟢 THE DENIAL ITSELF IS NO LONGER WAITING FOR IT [2026-08-29]. A full bucket-era refuses every announcement in
  // it for up to a year (gate 13705, MEASURED at 57.2 GRAM to fill one), and that used to be permanent because the
  // victim's bucket was walletHash % PUBLIC_BEACON_READ_SPACE and nothing else. But the LIVE contract never pinned
  // it: the BEACON preimage is H(domain, bucket) with no sender in it, and `publisher` is stamped from sender(),
  // so an announcement is found and attributed from ANY bucket the sweep reads — which is all of them. So the
  // WRITER'S ROLL shipped on clean-17, without the fold: app.js chooseChannelBeaconBucket probes the home bucket
  // and, only if it is full, announces in a RANDOM one (chooseBeaconBucket in public-lane-send, gates BEACONROLL).
  // Random rather than the next index, because a predictable roll can be pre-filled at the same 57.2 GRAM: denying
  // one channel now means denying all 1024 buckets. The fold remains the better fix and stays a cutover item.
  return hashCell(beginCell()
    .uint(PS_BEACON_DOMAIN, 32, 'PS_BEACON_DOMAIN')
    .uint(bigToBucket(bucket), 32, 'bucket')
    .endCell());
}
/**
 * THE CLEAN-18 BEACON PARTITION KEY — H(domain ‖ bucket ‖ shard_seq) — beside the live one, NOT replacing it.
 *
 * Same discipline as web/fee-vault.mjs: the clean-18 client machinery lives in web/, is proven against the BUILT
 * clean-18 contract (contracts18/tests/beacon-fold-client.test.ts drives this function into a real PublicShard's
 * gate 13702), and is not wired into the live path until that contract is the one on chain. The cutover then
 * swaps ONE derivation instead of writing it under deadline — and this function's agreement with the contract is
 * already a gate, not a hope.
 *
 * WHY THE FOLD IS THE REAL FIX where the writer's roll (chooseChannelBeaconBucket) is the interim one: the roll
 * makes a full bucket ESCAPABLE — an attacker must fill all 1024 buckets to deny one channel — but every escape
 * still spends a probe and lands somewhere a reader only finds because the sweep reads everything. With shard_seq
 * folded, a full bucket-era overflows to its successor account exactly like CHANNEL and THREAD have all along,
 * readers probe seq 0..PUBLIC_SEQ_PROBE-1 as they already do for those kinds, and the denial ceases to exist as
 * a concept. clean-18's PublicShard.tact:308 carries the contract half.
 *
 * 🔴 DO NOT call this against the LIVE deployment: the sealed clean-17 PublicShard folds no shard_seq into
 * BEACON, so an address derived here does not exist there and gate 13702 refuses the publish that deploys it —
 * silently, for every announcement. That is not a guess; it was tried on 2026-08-29 and reverted within the hour.
 */
export async function publicBeaconPartitionKey18(bucket, shardSeq = 0) {
  return hashCell(beginCell()
    .uint(PS_BEACON_DOMAIN, 32, 'PS_BEACON_DOMAIN')
    .uint(bigToBucket(bucket), 32, 'bucket')
    .uint(BigInt(shardSeq), 32, 'shard_seq')
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
export async function publicPostUid(channelPartitionKey, epochTag, entryId, generation = 17) {
  // THE GENERATION IS PART OF THE POST'S IDENTITY [audit 2026-08-31, round 5]. This folds the tuple
  // (channel_pk, epoch_tag, entry_id) — which stopped naming ONE entry the moment the flip gave a shard address
  // a generation dimension. In the era that straddles the boundary the gen-17 and gen-18 CHANNEL shards share an
  // epoch_tag and a seq, and BOTH number their entries from 0, so post #0 of each folded to the SAME post_uid:
  // one thread shard, and every comment on either post appearing under both.
  //
  // GENERATION 17 IS UNCHANGED, FOREVER — the field is appended only above it, so every thread that exists today
  // keeps its exact address and its comments. Only generation 18 gets the extra field, and its posts are born
  // after the flip with no thread to orphan.
  const builder = beginCell()
    .uint(PS_POST_UID_DOMAIN, 32, 'PS_POST_UID_DOMAIN')
    .uint(BigInt(channelPartitionKey), 256, 'channel_partition_key')
    .uint(BigInt(epochTag), 64, 'epoch_tag')
    .uint(BigInt(entryId), 64, 'entry_id');
  if (Number(generation) !== 17) builder.uint(BigInt(Number(generation)), 8, 'generation');
  return hashCell(builder.endCell());
}

/** The 256-bit account hash of a basechain address, the value the contract folds via senderHash(). */
export function publicWalletHash(address) {
  const { hash } = parseTonAddress(String(address));
  return bytesToBig(hash);
}

/** The era length of one PublicShard kind — the single home of the kind -> cadence rule the era math uses. */
export const publicEraLengthOf = (kind) => (kind < PS_KIND.BEACON ? PS_ERA_SHORT : PS_ERA_LONG);

/**
 * Which generations one (kind, era) must be READ in [CUTOVER.md item 3]. Almost always one; the single era that
 * straddles the baked boundary answers [17, 18] and costs the sweep one extra address for one era length —
 * after which the window slides past it and every era is single-generation again. Dormant (boundary null) this
 * is always [17], so every sweep below is byte-identical to its pre-cutover self.
 *
 * FILTERED BY WHAT THIS BUILD CAN ACTUALLY DERIVE [audit 2026-08-31, round 5]. The era arithmetic is the truth
 * about the CHAIN; whether this bundle carries a generation's code cell is a truth about the BUILD, and a read
 * that expands past it throws instead of reading. See hasLaneCode in shard-address.mjs for the measured
 * boundary-release blackout this closes. An era that resolves to a generation this build cannot address yields
 * NO addresses — honest: those shards are unreadable here, and before the flip they do not exist at all.
 */
export const publicEraGenerations = (kind, era) => generationsForEra(publicEraLengthOf(kind), era)
  .filter((generation) => hasLaneCode('public', generation));

/** The per-generation twin of publicShardFriendly — what the era-expanded sweeps ask. */
async function publicShardFriendlyFor(generation, partitionKey, epochTag) {
  return friendly(publicShardAddressBytesFor(generation, partitionKey, epochTag));
}

/**
 * The BEACON sweep set: every directory bucket across a window of eras, newest era first. A fresh client reads
 * these with ONE batched accountStates call per era (1024 < the 1149-address URL budget) and orders live buckets
 * by last_transaction_lt from that same free batch. Pure local computation.
 *
 * 🔴 CUTOVER OBLIGATION, NOT A TODO [2026-08-29]. A bucket-era is capped at PS_SAFE_CAP, and MEASURED 57.2 GRAM
 * fills one and refuses every announcement in it for the rest of the year. clean-18 fixes it properly by folding
 * shard_seq into the BEACON partition key, exactly as CHANNEL and THREAD already do, which puts the beacon inside
 * the PUBLIC_SEQ_PROBE overflow mechanism the lane already has.
 * The denial is no longer PERMANENT in the meantime: the writer rolls to a random free bucket on clean-17, because
 * the live BEACON key folds no sender and the sweep below reads every bucket — see publicBeaconPartitionKey.
 * WHAT THE CUTOVER STILL OWES, by name, so this line shrinks instead of rotting. Neither item may land while the
 * sealed clean-17 PublicShard is the one on chain.
 *
 * ⚠️ (1) SAYS "MOVE", AND MOVING IS THE WRONG VERB — the key must be chosen BY GENERATION, not swapped
 *     [audit 2026-09-01, round 11]. BEACON is the ONE PublicShard kind whose partition-key PREIMAGE changes
 *     across the boundary: CHANNEL, THREAD and AVATAR key the same way in both generations, which is why their
 *     sweeps are correct as written and why this exception is easy to miss. All three sites below already thread
 *     the GENERATION into the address (publicShardAddressBytesFor / generationForUnixSeconds) while hard-coding
 *     the clean-17 KEY — so following (1) literally would derive gen-17 BEACON addresses at the FOLDED key.
 *     MEASURED, bucket 7: live key 3d455095c5ca7764…, folded key cffb2771252d73da… — different accounts. A
 *     BEACON era is a YEAR, so the era straddling E stays in the read window for up to a year, and every
 *     pre-E directory row in it would silently vanish from Discover. The shape to write is the one the code
 *     cell already uses: pick the key inside the per-generation loop, gen 17 -> publicBeaconPartitionKey,
 *     gen 18 -> publicBeaconPartitionKey18. The writer picks by its WRITE generation, the same instant it picks
 *     the address; the room probe follows the writer.
 *
 * (1) the derivation is ALREADY WRITTEN below and
 *     proven against the built clean-18 contract (contracts18/tests/beacon-fold-client.test.ts: gate 13702
 *     accepts its keys and refuses the live derivation's). The three, enumerated because naming two of them is
 *     how the third gets forgotten: the WRITER (app.js publishChannelProfileDirect), this SWEEP
 *     (publicBeaconScanAddresses), and the ROOM PROBE (public-lane readBeaconBucketRoom) that the writer's roll
 *     asks before it chooses. A room probe left on the un-folded key measures a bucket-era nobody writes to any
 *     more, so the roll would be choosing from fiction.
 *
 * (2) PROBE seq 0..PUBLIC_SEQ_PROBE-1 per bucket here, exactly as readers already do for CHANNEL and THREAD.
 *     🔴 AND THIS COSTS THE PROPERTY THE NOTE ABOVE ADVERTISES: the sweep is one batched read per era only while
 *     it asks 1024 addresses. Four seqs is 4,096 against the MEASURED 1,149-address URL budget (see the note on
 *     that ceiling above) — four requests per era, twelve across the default eraWindow of 3. That is a real cost
 *     increase on the coldest screen in the app and it must be budgeted, not discovered.
 *
 * (3) 🔴 THE FOLD IS ADDITIVE, NOT A REPLACEMENT. An earlier version of this note said "swap the writer" and that
 *     reading is a large regression: the two defences are not equivalent, and the arithmetic says so. The writer's
 *     random-bucket roll (app.js chooseChannelBeaconBucket) forces an attacker to fill ALL 1024 buckets to deny
 *     one channel; a seq roll that readers probe only PUBLIC_SEQ_PROBE deep forces them to fill FOUR shards. At
 *     the MEASURED per-entry cost that is 57,754 GRAM against 225.6 — the seq roll alone is 256x CHEAPER to
 *     defeat, and cheaper still at the M21C discount (16,753 against 65.5). Keep the bucket roll; the fold adds
 *     unbounded overflow WITHIN a bucket on top of it.
 * THIS DERIVATION MUST NOT FOLD IT UNTIL THAT CODE IS THE ONE ON CHAIN. It was changed here on 2026-08-29 and
 * reverted within the hour: the live clean-17 PublicShard does not fold shard_seq, so a client that does derives
 * an address the live contract refuses at gate 13702 — every channel announcement in the network, silently.
 * The fold, the on-demand successor probe and the writer's roll all belong to the cutover change, together.
 */
export async function publicBeaconScanAddresses(nowUnix, eraWindow = 3, bucketCount = PUBLIC_BEACON_READ_SPACE) {
  const era = publicEraOf(PS_KIND.BEACON, nowUnix);
  const out = [];
  for (let e = era; e > era - eraWindow && e >= 0; e -= 1) {
    const tag = publicEpochTag(PS_KIND.BEACON, e);
    // Era-expanded across the flip [CUTOVER.md item 3]: the one straddling era is read in BOTH generations.
    for (const generation of publicEraGenerations(PS_KIND.BEACON, e)) {
      for (let b = 0; b < bucketCount; b += 1) {
        out.push(await publicShardFriendlyFor(generation, await publicBeaconPartitionKey(b), tag));
      }
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
    for (const generation of publicEraGenerations(PS_KIND.CHANNEL, e)) {
      for (let seq = 0; seq < seqProbe; seq += 1) {
        out.push(await publicShardFriendlyFor(generation, await publicChannelPartitionKey(ownerWalletHash, seq), tag));
      }
    }
  }
  return out;
}

/** A wallet's avatar shard for the current era and the two before it; the stream lives in whichever is live. */
/**
 * FIVE ERAS, NOT THREE [audit 2026-08-31, round 6; owner approved]. A shard of era `e` is read while
 * `era_now <= e + W - 1`, i.e. until `(e+W)·PS_ERA_LONG`, while the contract keeps it alive until
 * `(e+2)·L + PS_RETENTION_AVATAR + PS_RETIRE_SLACK` = `(e+5)·L + 86,400`. At W=3 the reader therefore stopped
 * asking a FULL 731 DAYS before the bytes died — MEASURED. The user's side of that: an avatar bought for 100 ATH
 * silently became initials between 2.00 and 3.00 years after upload (the spread is only where in the year it was
 * published), while its pointer in the KeyShard — which never expires — kept asserting the avatar exists, so the
 * app looked for bytes at an address it no longer derives and rendered the fallback with no error. 47.2% of the
 * rent that avatar paid bought storage nobody read.
 * W=5 reads the shard for exactly as long as it is GUARANTEED alive; the remaining 86,400 s is PS_RETIRE_SLACK,
 * during which any caller may destroy it. Cost: two extra addresses per avatar read.
 */
export const PUBLIC_AVATAR_ERA_WINDOW = 5;

export async function publicAvatarScanAddresses(ownerWalletHash, nowUnix, eraWindow = PUBLIC_AVATAR_ERA_WINDOW) {
  const era = publicEraOf(PS_KIND.AVATAR, nowUnix);
  const pk = await publicAvatarPartitionKey(ownerWalletHash);
  const out = [];
  for (let e = era; e > era - eraWindow && e >= 0; e -= 1) {
    // The avatar is the flip's sharpest read [CUTOVER.md item 3]: the pointer survives in the KeyShard, the
    // BYTES sit in the era-shard of whichever generation held the write, and the retention is three YEAR-long
    // eras — so the straddling era stays in this window for up to a year and must be probed in both.
    for (const generation of publicEraGenerations(PS_KIND.AVATAR, e)) {
      out.push(await publicShardFriendlyFor(generation, pk, publicEpochTag(PS_KIND.AVATAR, e)));
    }
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
