// clean-17 client — the publish builder (the SEND path). Given a capsule's cells and where it belongs, it builds the
// exact message + the shard address to send it to. Output is transport-agnostic: { to, value, body } is the standard
// internal-message shape the client's existing TON send path already consumes.
//
// DIRECT-PAID. [OWNER 2026-07-18: all external infrastructure is forbidden in this project and always has been.]
// There is no token, no blind issuance, no issuer service and no relay: the client pays the record's rent straight to
// the shard that stores it. Authorization to write a CONV bucket is a SIGNATURE under the bucket's write key (derived
// from the conversation's shared K_root) plus a monotonic seq — NOT merely knowing where to send, because the shard's
// address is public the moment anything is published there. Anti-spam beyond that is the rent.
//
// The client publishes DIRECTLY to the terminal shard, which is also what makes the message deliverable at all: the
// capsule cells ride in this transaction, so the ciphertext lives in the destination shard's transaction history,
// authenticated by the commitment the contract computes and stores. (The earlier two-hop design forwarded only a
// commitment, so the ciphertext existed nowhere and the recipient had nothing to decrypt.)
//
// The shard state stays thin — it keeps only (commitment, created_at) — so reading is: derive the address, list the
// records, then fetch the matching bodies from that account's transaction history by commitment.

// NODE-ONLY REFERENCE. This builder speaks @ton/core and the compiled Tact wrappers, so it does not load in a
// browser — web/intro-publish-browser.mjs is the shipping INTRO path. It is kept because it derives addresses
// and StateInit INDEPENDENTLY of web/shard-discovery.mjs (which hand-rolls the same encoding for the browser),
// and two independent implementations that must agree is the only real evidence for address derivation: a wrong
// shard address cannot be caught at send time, because a message to an uninitialised account has its compute
// phase skipped and vanishes with the wallet reporting success. Do NOT make this import shard-discovery.
import { Address, beginCell, contractAddress } from '@ton/core';
import { ed25519 } from './vendor/@noble/curves/ed25519.js';
import { storeCapsulePublish, RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import { storeIntroPublish, IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { storeRecoveryStore, RecoveryShard } from '../build/RecoveryShard/RecoveryShard_RecoveryShard';
import { storePublicPublish, PublicShard } from '../build/PublicShard/PublicShard_PublicShard';
import { recoveryOwnerSecret, recoveryOwnerPublicKey } from './crypto/conv-routing.mjs';

const bytesToBig = (b) => { let x = 0n; for (const byte of b) x = (x << 8n) | BigInt(byte & 0xff); return x; };

// MUST equal RS_SLOT_DOMAIN in RecoveryShard.tact ("RSLK"); mirrored here rather than imported, for the
// independence reason above.
const RECOVERY_SLOT_DOMAIN = 0x52534C4Bn;

// MUST equal RS_MAX_SLOTS in RecoveryShard.tact; mirrored here for the same independence reason as the domain.
const RECOVERY_MAX_SLOTS = 256;
// MUST equal RS_NAMED_SLOTS in RecoveryShard.tact — the named durable slots above the scan range (prefs at 256). This
// reference builder cross-checks the browser derivation over the WHOLE range the contract accepts (gate 13576), so its
// bound must track the contract's, not the old scan-only ceiling.
const RECOVERY_NAMED_SLOTS = 16;

const recoveryOwnerSlotKey = (ownerPublicKey, slotIndex) => {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= RECOVERY_MAX_SLOTS + RECOVERY_NAMED_SLOTS) {
    throw new Error(`buildRecoveryPublish: slotIndex must be an integer in [0, ${RECOVERY_MAX_SLOTS + RECOVERY_NAMED_SLOTS}), got ${slotIndex}`);
  }
  return BigInt('0x' + beginCell()
    .storeUint(RECOVERY_SLOT_DOMAIN, 32)
    .storeUint(typeof ownerPublicKey === 'bigint' ? ownerPublicKey : bytesToBig(ownerPublicKey), 256)
    .storeUint(slotIndex, 32)
    .endCell().hash().toString('hex'));
};

async function recordShardState(bucketKey, epoch) {
  const init = await RecordShard.init(BigInt(bucketKey), BigInt(epoch));
  return { init, address: contractAddress(0, init) };
}

async function introShardState(epoch, bucket) {
  const init = await IntroShard.init(BigInt(epoch), BigInt(bucket));
  return { init, address: contractAddress(0, init) };
}

async function recoveryShardState(selfBucketKey) {
  const init = await RecoveryShard.init(BigInt(selfBucketKey));
  return { init, address: contractAddress(0, init) };
}

async function publicShardState(partitionKey, epochTag) {
  const init = await PublicShard.init(BigInt(partitionKey), BigInt(epochTag));
  return { init, address: contractAddress(0, init) };
}

// Commitment domains — MUST mirror the contracts byte-for-byte (RecordShard.RS_FRAME_DOMAIN, IntroShard.IS_BODY_DOMAIN,
// RecoveryShard.RS_RECOVERY_DOMAIN). The CONTRACT defines each commitment; these mirrors exist so a reader can
// re-derive it locally to match a stored record against a body recovered from transaction history.
const RS_FRAME_DOMAIN = 0x52534643n;   // "RSFC"
const RS_WRITE_DOMAIN = 0x52535744n;   // "RSWD"
const IS_BODY_DOMAIN = 0x49534243n;    // "ISBC"
const RECOVERY_DOMAIN = 0x42525331n;   // "BRS1"

const bufBig = (h) => BigInt('0x' + Buffer.from(h).toString('hex'));
const sigCell = (sig) => beginCell().storeBuffer(Buffer.from(sig)).endCell();
const cellBig = (c) => bufBig(c.hash());

/** The CONV record commitment, mirroring RecordShard.frameCommit — use it to match a stored record to its body. */
export function frameCommit(header0, header1, body) {
  return bufBig(beginCell()
    .storeUint(RS_FRAME_DOMAIN, 32)
    .storeUint(cellBig(header0), 256).storeUint(cellBig(header1), 256).storeUint(cellBig(body), 256)
    .endCell().hash());
}

/** The INTRO body commitment, mirroring IntroShard.bodyCommit. */
export function introBodyCommit(header0, body) {
  return bufBig(beginCell()
    .storeUint(IS_BODY_DOMAIN, 32)
    .storeUint(cellBig(header0), 256).storeUint(cellBig(body), 256)
    .endCell().hash());
}

/**
 * CONV publish. The shard's identity is the conversation-direction's WRITE PUBLIC KEY (conv-routing.convWritePublicKey),
 * not a bare bucket hash: the address is public once anything is published there, so authorization has to be a
 * signature, not knowledge of where to send. `writeSecret` signs (seq ‖ commitment); `seq` MUST strictly exceed the
 * shard's last_seq (read get_view().last_seq; a fresh shard is 0), which is what stops a captured publish from being
 * replayed to burn SAFE_CAP slots.
 *
 * FUNDING: attach CONV_PUBLISH_VALUE from web/publish-price.mjs — the DEPLOY figure — for every publish, not
 * only the first. The gate is state-dependent (13652 demands the deploy figure while record_count == 0), and
 * measurement shows that overpaying an existing shard simply comes back: a later publish attached at the deploy
 * figure returned 3_137_794 of it. The alternative rules all read or infer state, and the obvious one — "pay
 * more only when the account is absent" — is forgeable, because anyone can create a shard with a bare value
 * message and leave it with zero entries. This used to read "fund at or above get_view().min_value", which is
 * now wrong for the publish that matters most: the first one.
 */
export async function buildConvPublish({ writePublicKey, writeSecret, seq, epoch, header0, header1, body, value }) {
  const commit = frameCommit(header0, header1, body);
  const digest = beginCell()
    .storeUint(RS_WRITE_DOMAIN, 32).storeUint(BigInt(seq), 64).storeUint(commit, 256)
    .endCell().hash();
  const target = await recordShardState(bytesToBig(writePublicKey), epoch);
  return {
    to: target.address,
    init: target.init,   // the shard is new every epoch; without this the first publish lands on an uninit account
    value,
    body: beginCell().store(storeCapsulePublish({
      $$type: 'CapsulePublish', seq: BigInt(seq), header_0: header0, header_1: header1, body,
      sig: sigCell(ed25519.sign(digest, writeSecret)),
    })).endCell(),
    commit,
  };
}

/**
 * INTRO publish: a stealth first contact into a SENDER-chosen (epoch, bucket). `r` and `viewTag` come from the
 * existing intro handshake (crypto/intro-handshake.mjs → {ephemeralR, viewTag}); the recipient finds it by scanning
 * view_tags, so nothing here reveals who it is addressed to.
 */
// Mirrors INTRO_READ_SPACE in web/shard-discovery.mjs, held BY HAND on purpose: this file is the INDEPENDENT
// reference the browser derivation is pinned against, so importing from it would make their agreement prove
// nothing. tests/intro-bucket.test.ts pins the two mirrors against each other.
const INTRO_READ_SPACE_MIRROR = 1024;

export async function buildIntroPublish({ epoch, bucket, r, viewTag, header0, body, value }) {
  // A bucket outside the read space is ACCEPTED by the contract — IntroShard.init takes any uint32 and no gate
  // looks at it — charged for, and then read by nobody, for ever. Refuse rather than clamp: silently rewriting
  // the caller's bucket sends their message somewhere they did not ask for, which is the same surprise moved.
  if (!(BigInt(bucket) >= 0n && BigInt(bucket) < BigInt(INTRO_READ_SPACE_MIRROR))) {
    throw new Error(`INTRO bucket ${bucket} is outside the read space of ${INTRO_READ_SPACE_MIRROR}`);
  }
  const target = await introShardState(epoch, bucket);
  return {
    to: target.address,
    init: target.init,
    value,
    body: beginCell().store(storeIntroPublish({
      $$type: 'IntroPublish', r: BigInt(r), view_tag: BigInt(viewTag), header_0: header0, body,
    })).endCell(),
    commit: introBodyCommit(header0, body),
  };
}

/**
 * RECOVERY publish: the owner-signed K_root blob, stored ON CHAIN (this lane alone) so it survives even archive
 * pruning. The slot commits to the recovery owner key derived from the seed, so only the seed-holder can bind it
 * (gate 13575). `seq` MUST be strictly greater than the slot's current seq — read get_view().seq first; a fresh
 * slot is 0 (after an eviction it is the retained high-water mark). The blob is capped at max_blob_cells (13560),
 * and `bh` is derived from `body` — do not pass it.
 *
 * `slotIndex` selects which of the owner's RS_MAX_SLOTS books this is, and is REQUIRED — see recoveryOwnerSlotKey
 * for why it must not default. Each slot carries its own independent `seq`; they are separate accounts, so reading
 * one slot's get_view().seq says nothing about another's.
 */
export async function buildRecoveryPublish({ seed, slotIndex, seq, h0, h1, body, value }) {
  const ownerSecret = await recoveryOwnerSecret(seed, slotIndex);   // W1-015: per-slot key
  const ownerPub = await recoveryOwnerPublicKey(seed, slotIndex);
  const slotKey = recoveryOwnerSlotKey(ownerPub, slotIndex);
  const target = await recoveryShardState(slotKey);
  // bh is DERIVED from the body, never supplied: the contract requires body.hash() == bh (gate 13557), so letting a
  // caller pass it separately only creates a way to get it wrong and have the publish bounce.
  const bh = cellBig(body);

  // digest = H(RECOVERY_DOMAIN ‖ shard_address ‖ self_bucket_key ‖ seq ‖ ref(h0 ‖ h1 ‖ bh)), mirroring
  // RecoveryShard.recoveryDigest. The address is in the preimage so a signed publish cannot be replayed into the
  // same slot of a future code generation.
  const digest = beginCell()
    .storeUint(RECOVERY_DOMAIN, 32).storeAddress(target.address).storeUint(slotKey, 256).storeUint(BigInt(seq), 64)
    .storeRef(beginCell().storeUint(h0, 256).storeUint(h1, 256).storeUint(bh, 256).endCell())
    .endCell().hash();

  return {
    to: target.address,
    init: target.init,
    value,
    body: beginCell().store(storeRecoveryStore({
      $$type: 'RecoveryStore',
      owner_pubkey: bytesToBig(ownerPub), slot_index: BigInt(slotIndex), seq: BigInt(seq), h0, h1, bh, body,
      owner_sig: sigCell(ed25519.sign(digest, ownerSecret)),
    })).endCell(),
    slotKey,
    slotIndex,
    ownerPublicKey: ownerPub,
  };
}

/**
 * PUBLIC publish: a post, comment, beacon announcement or avatar part into a PublicShard partition. Unlike CONV
 * there is NO signature — authorization is the preimage gate (13702): for CHANNEL/AVATAR the contract folds
 * sender() and only the owner wallet matches, so the message carries no proof of its own. The caller supplies the
 * already-derived `partitionKey` and `epochTag` (web/shard-discovery computes and pins them); this builder's job
 * is the message and the address, kept narrow so the two derivations cannot drift.
 *
 * StateInit is ALWAYS attached — a shard is deployed lazily, so without it the first publish lands on an uninit
 * account, runs with its compute phase skipped, and is lost while the wallet reports success.
 *
 * `value` must be >= the shard's deploy_min_value on the first publish (entry_count == 0), else min_value; the
 * caller reads those from get_view. `keyArg` is post_uid for THREAD, the bucket for BEACON, and unused (0) for
 * CHANNEL/AVATAR — the same positional contract as the PublicPublish message.
 */
export async function buildPublicPublish({ kind, keyArg = 0n, shardSeq = 0, header, body, value, partitionKey, epochTag }) {
  if (!(BigInt(kind) >= 0n && BigInt(kind) <= 3n)) throw new Error(`buildPublicPublish: kind ${kind} out of range 0..3`);
  const target = await publicShardState(partitionKey, epochTag);
  return {
    to: target.address,
    init: target.init,   // lazy deploy: the first publish into a partition creates the account
    value,
    body: beginCell().store(storePublicPublish({
      $$type: 'PublicPublish',
      kind: BigInt(kind), key_arg: BigInt(keyArg), shard_seq: BigInt(shardSeq), header, body,
    })).endCell(),
    commit: publicBodyCommit(header, body),
  };
}

// H(PS_BODY_DOMAIN ‖ header.hash ‖ body.hash), mirroring PublicShard.bodyCommit — the reader re-derives this to
// match a body recovered from transaction history against the commit the contract stored.
const PS_BODY_DOMAIN = 0x50534644n;   // "PSFD"
function publicBodyCommit(header, body) {
  return BigInt('0x' + beginCell()
    .storeUint(PS_BODY_DOMAIN, 32)
    .storeUint(cellBig(header), 256)
    .storeUint(cellBig(body), 256)
    .endCell().hash().toString('hex'));
}
