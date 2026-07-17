// clean-17 client — the publish builder (the SEND path). The mirror of the discovery/scan RECEIVE path: given a
// pre-issued spend token (blind-signed by the issuer subkey, certified by the CAC roots) and a frame, it builds the
// exact NullifierSpend message + the NullifierShard address to send it to. The client signs the spend_sig ITSELF —
// it holds the spend key committed inside the serial — which is the RT1-BLOCKER-1 frame binding (gate 13605). For the
// RECOVERY lane it builds the owner-signed RecoveryStore + the owner-bound RecoveryShard address (gate 13575).
//
// Output is transport-agnostic: { to, value, body } is the standard internal-message shape the client's existing TON
// send path already consumes (see web/capsulehub-ton-rpc-provider.mjs). CARRY returns the relay's change, so sending
// the value floor + a small margin is safe — the shard keeps only its endowment and hands the rest back.

import { beginCell } from '@ton/core';
import { ed25519 } from './vendor/@noble/curves/ed25519.js';
import { storeNullifierSpend } from '../build/NullifierShard/NullifierShard_NullifierShard';
import { storeRecoveryStore } from '../build/RecoveryShard/RecoveryShard_RecoveryShard';
import { nullifierShardAddress, recoveryShardAddress, recoveryOwnerSlotKey } from './shard-discovery.mjs';
import { recoveryOwnerSecret, recoveryOwnerPublicKey } from './crypto/conv-routing.mjs';

// Domains — MUST mirror the contracts byte-for-byte.
const ISSUER_SIG_DOMAIN = 0x42534931n; // "BSI1"  serial preimage
const SPEND_DOMAIN = 0x42535031n;      // "BSP1"  spend digest
const FRAME_DOMAIN = 0x4E534652n;      // "NSFR"  frame-routing commitment
const RECOVERY_DOMAIN = 0x42525331n;   // "BRS1"  recovery digest

export const KIND_CONV = 1n;
export const KIND_INTRO = 2n;

// Value floors — MUST mirror NullifierShard.NS_FORWARD_VALUE and RecoveryShard.RS_MIN_VALUE. A single source here so
// a client cannot under-fund a send (the shard refuses in COMPUTE: 13624 / 13572).
export const SPEND_MIN_VALUE = 7_710_000n;     // 200000 + 2_500_000 + 10_000 + 5_000_000 (record+gas+nullifier+path)
export const RECOVERY_MIN_VALUE = 31_200_000n; // 23_200_000 + 8_000_000 (endowment + path gas)
const SEND_MARGIN = 5_000_000n;                // the relay's own send fee; excess comes back via CARRY

const bytesToBig = (b) => { let x = 0n; for (const byte of b) x = (x << 8n) | BigInt(byte & 0xff); return x; };
const asBig = (v) => (typeof v === 'bigint' ? v : bytesToBig(v));
const bufBig = (h) => BigInt('0x' + Buffer.from(h).toString('hex'));
const sigCell = (sig) => beginCell().storeBuffer(Buffer.from(sig)).endCell();

function computeSerial(spendPub, epoch, nonce) {
  return bufBig(beginCell()
    .storeUint(ISSUER_SIG_DOMAIN, 32).storeUint(spendPub, 256)
    .storeUint(BigInt(epoch), 32).storeUint(BigInt(nonce), 64)
    .endCell().hash());
}

// The RT1-BLOCKER-1 frame-binding digest, mirroring NullifierShard.frameBindingDigest: inner commit over EVERY
// routing/content field, then an outer hash tying it to the serial. Returns the 32-byte digest to sign.
function frameBindingDigest(serial, kind, bucketKey, frameCommit, introBucket, introR, introViewTag) {
  const fc = bufBig(beginCell()
    .storeUint(FRAME_DOMAIN, 32).storeUint(kind, 8).storeUint(bucketKey, 256).storeUint(frameCommit, 256)
    .storeUint(introBucket, 32).storeUint(introR, 256).storeUint(introViewTag, 16)
    .endCell().hash());
  return beginCell().storeUint(SPEND_DOMAIN, 32).storeUint(serial, 256).storeUint(fc, 256).endCell().hash();
}

// Build a NullifierSpend for either lane. `cert` = the CAC certificate the client received with its token:
//   { subkeyPublicKey, validFrom, validTo, rootIdxA, rootIdxB, certSigA, certSigB }
// `issuerSig` = the subkey's blind signature over the serial. `spendSecretKey` = the 32-byte spend key (the client's;
// its pubkey is committed in the serial), used HERE to sign the frame. Keys/sigs may be bytes or bigint as noted.
async function buildSpend({
  kind, spendSecretKey, epoch, nonce, cert, issuerSig,
  bucketKey = 0n, frameCommit = 0n, introBucket = 0n, introR = 0n, introViewTag = 0n, value,
}) {
  const spendPub = bytesToBig(ed25519.getPublicKey(spendSecretKey));
  const serial = computeSerial(spendPub, epoch, nonce);
  const spendSig = ed25519.sign(frameBindingDigest(serial, kind, bucketKey, frameCommit, introBucket, introR, introViewTag), spendSecretKey);

  const msg = {
    $$type: 'NullifierSpend',
    spend_pubkey: spendPub,
    epoch: BigInt(epoch),
    nonce: BigInt(nonce),
    subkey_pubkey: asBig(cert.subkeyPublicKey),
    valid_from: BigInt(cert.validFrom),
    valid_to: BigInt(cert.validTo),
    root_idx_a: BigInt(cert.rootIdxA),
    root_idx_b: BigInt(cert.rootIdxB),
    kind,
    bucket_key: bucketKey,
    frame_commit: frameCommit,
    intro_bucket: introBucket,
    intro_r: introR,
    intro_view_tag: introViewTag,
    issuer_sig: sigCell(issuerSig),
    cert_sig_a: sigCell(cert.certSigA),
    cert_sig_b: sigCell(cert.certSigB),
    spend_sig: sigCell(spendSig),
  };
  return {
    to: await nullifierShardAddress(epoch, serial),
    value: value ?? SPEND_MIN_VALUE + SEND_MARGIN,
    body: beginCell().store(storeNullifierSpend(msg)).endCell(),
    serial,
  };
}

/** CONV publish: routes to RecordShard(bucket_key, epoch). frameCommit is the record's frame commitment. */
export async function buildConvSpend(opts) {
  return buildSpend({ ...opts, kind: KIND_CONV });
}

/** INTRO publish: routes to IntroShard(epoch, introBucket). bodyCommit is stored as the intro body commitment. */
export async function buildIntroSpend({ bodyCommit, ...opts }) {
  return buildSpend({ ...opts, kind: KIND_INTRO, frameCommit: bodyCommit });
}

/**
 * RECOVERY publish: builds the owner-signed RecoveryStore + the owner-bound RecoveryShard address. The owner key is
 * derived from the seed (deterministic, so a reinstalled client re-signs), and the slot commits to it (gate 13575).
 * `body` is the on-chain recovery blob Cell; h0/h1/bh are its frame hashes; seq is the monotonic anti-rollback counter.
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
  const ownerSig = ed25519.sign(digest, ownerSecret);

  const msg = {
    $$type: 'RecoveryStore',
    owner_pubkey: bytesToBig(ownerPub),
    seq: BigInt(seq),
    h0, h1, bh, body,
    owner_sig: sigCell(ownerSig),
  };
  return {
    to: await recoveryShardAddress(slotKey),
    value: value ?? RECOVERY_MIN_VALUE + SEND_MARGIN,
    body: beginCell().store(storeRecoveryStore(msg)).endCell(),
    slotKey,
    ownerPublicKey: ownerPub,
  };
}
