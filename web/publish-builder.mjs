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

import { beginCell } from '@ton/core';
import { ed25519 } from './vendor/@noble/curves/ed25519.js';
import { storeCapsulePublish } from '../build/RecordShard/RecordShard_RecordShard';
import { storeIntroPublish } from '../build/IntroShard/IntroShard_IntroShard';
import { storeRecoveryStore } from '../build/RecoveryShard/RecoveryShard_RecoveryShard';
import { recordShardAddress, introShardAddress, recoveryShardAddress, recoveryOwnerSlotKey } from './shard-discovery.mjs';
import { recoveryOwnerSecret, recoveryOwnerPublicKey } from './crypto/conv-routing.mjs';

// Commitment domains — MUST mirror the contracts byte-for-byte (RecordShard.RS_FRAME_DOMAIN, IntroShard.IS_BODY_DOMAIN,
// RecoveryShard.RS_RECOVERY_DOMAIN). The CONTRACT defines each commitment; these mirrors exist so a reader can
// re-derive it locally to match a stored record against a body recovered from transaction history.
const RS_FRAME_DOMAIN = 0x52534643n;   // "RSFC"
const RS_WRITE_DOMAIN = 0x52535744n;   // "RSWD"
const IS_BODY_DOMAIN = 0x49534243n;    // "ISBC"
const RECOVERY_DOMAIN = 0x42525331n;   // "BRS1"

const bytesToBig = (b) => { let x = 0n; for (const byte of b) x = (x << 8n) | BigInt(byte & 0xff); return x; };
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
 * replayed to burn SAFE_CAP slots. Fund at or above get_view().min_value — the shard returns the change.
 */
export async function buildConvPublish({ writePublicKey, writeSecret, seq, epoch, header0, header1, body, value }) {
  const commit = frameCommit(header0, header1, body);
  const digest = beginCell()
    .storeUint(RS_WRITE_DOMAIN, 32).storeUint(BigInt(seq), 64).storeUint(commit, 256)
    .endCell().hash();
  return {
    to: await recordShardAddress(bytesToBig(writePublicKey), epoch),
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
export async function buildIntroPublish({ epoch, bucket, r, viewTag, header0, body, value }) {
  return {
    to: await introShardAddress(epoch, bucket),
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
 * slot is 0. The blob is capped at the contract's max_blob_cells (gate 13560).
 */
export async function buildRecoveryPublish({ seed, seq, h0, h1, bh, body, value }) {
  const ownerSecret = await recoveryOwnerSecret(seed);
  const ownerPub = await recoveryOwnerPublicKey(seed);
  const slotKey = recoveryOwnerSlotKey(ownerPub);

  // digest = H(RECOVERY_DOMAIN ‖ self_bucket_key ‖ seq ‖ ref(h0 ‖ h1 ‖ bh)), mirroring RecoveryShard.recoveryDigest
  const digest = beginCell()
    .storeUint(RECOVERY_DOMAIN, 32).storeUint(slotKey, 256).storeUint(BigInt(seq), 64)
    .storeRef(beginCell().storeUint(h0, 256).storeUint(h1, 256).storeUint(bh, 256).endCell())
    .endCell().hash();

  return {
    to: await recoveryShardAddress(slotKey),
    value,
    body: beginCell().store(storeRecoveryStore({
      $$type: 'RecoveryStore',
      owner_pubkey: bytesToBig(ownerPub), seq: BigInt(seq), h0, h1, bh, body,
      owner_sig: sigCell(ed25519.sign(digest, ownerSecret)),
    })).endCell(),
    slotKey,
    ownerPublicKey: ownerPub,
  };
}
