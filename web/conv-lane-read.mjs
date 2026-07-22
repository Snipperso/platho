// conv-lane-read — the READ half of the clean-17 private CONV lane. Turns a RecordShard's published CapsulePublish
// message bodies back into openable capsule chain-entries.
//
// WHY MESSAGE BODIES, NOT SHARD STATE. A RecordShard stores only RecordEntry{ frame_commit, created_at } — a HASH
// COMMITMENT, never the capsule cells. So the header0/header1/body a recipient must decrypt live in the shard's
// inbound CapsulePublish transaction bodies (read from message history), exactly as the public lane reads posts from
// message history. This module parses one such body — the exact inverse of conv-publish-browser.buildConvPublishBody —
// into the three snake cells + seq + write signature, then shapes the chain-entry privateCapsuleFromChainEntry opens.
//
// AUTHENTICATION IS THE CRYPTO, NOT THE SHARD. A parsed capsule is authenticated downstream: openPrivateCapsuleChainEntry
// decrypts to the recipient's keys and verifies the sender's in-body signature, so a junk message sent to the shard
// address that is not encrypted to the recipient (or not signed by the sender) simply fails to open and is dropped.
// verifyConvWriteSignature ADDITIONALLY re-checks the ed25519 signature over (seq ‖ frameCommit) under the
// conversation-direction WRITE public key — the same gate RecordShard enforces (gate 13653) — so a client can reject
// forged/replayed bodies BEFORE spending a decrypt attempt on them. The write key is public knowledge to both parties
// (derived from the shared K_root), so this authenticates the transport, not the message content.

import { parseBocBase64, serializeBoc, tonCell, computeCellHashAndDepth } from './pwa-contract-transactions.mjs?v=33';
import { ed25519 } from './vendor/@noble/curves/ed25519.js';

// MUST equal conv-publish-browser + RecordShard.tact — mirrored (not imported) so a drift is caught by the round-trip
// pin in tests/conv-lane-read.test.ts rather than silently accepting a body from a different opcode.
const CAPSULE_PUBLISH_OPCODE = 0x52535031n; // "RSP1"
const RS_FRAME_DOMAIN = 0x52534643n;        // "RSFC"
const RS_WRITE_DOMAIN = 0x52535744n;        // "RSWD"

const bytesToBig = (b) => { let x = 0n; for (const byte of b) x = (x << 8n) | BigInt(byte & 0xff); return x; };

// Dual-mode cell reader — reads an @ton/core cell (beginParse, e.g. from a sandbox tx) OR a client cell (data/
// bitLength/refs, e.g. from parseBocBase64 in production). Faithful mirror of public-shard-ton-rpc-provider.cellReader;
// the CapsulePublish round-trip test pins that this reads back exactly what buildConvPublishBody wrote.
function cellReader(cell) {
  if (cell && typeof cell.beginParse === 'function') {
    const slice = cell.beginParse();
    return {
      remaining: () => slice.remainingBits,
      refs: () => slice.remainingRefs,
      loadUint: (w) => slice.loadUintBig(w),
      loadRef: () => slice.loadRef(),
    };
  }
  const bytes = cell?.data ?? new Uint8Array(0);
  const bitLength = Number(cell?.bitLength ?? bytes.length * 8);
  const refs = (cell && Array.isArray(cell.refs)) ? cell.refs : [];
  let bit = 0;
  let refIndex = 0;
  return {
    remaining: () => bitLength - bit,
    refs: () => refs.length - refIndex,
    loadUint: (w) => {
      let value = 0n;
      for (let i = 0; i < w; i += 1, bit += 1) {
        value = (value << 1n) | BigInt(((bytes[bit >> 3] ?? 0) >> (7 - (bit & 7))) & 1);
      }
      return value;
    },
    loadRef: () => refs[refIndex++] ?? null,
  };
}

/** The first 64 bytes of a sig sub-cell (buildConvPublishBody stored the 64-byte ed25519 sig as the cell's data). */
function sigBytesFromCell(cell) {
  const bytes = cell?.data ?? null;
  if (!bytes || bytes.length < 64) return null;
  return Uint8Array.from(bytes.subarray(0, 64));
}

const cellToBocBase64 = (cell) => tonCell.bytesToBase64(serializeBoc(cell));

/**
 * Parse a CapsulePublish message body — op(32) | seq(64) | ^header_0 | ^header_1 | ^(^body | ^sig) — into its parts.
 * Returns null (never throws) for anything that is not a CapsulePublish, so a scan over a shard's mixed message
 * history skips foreign/malformed bodies cleanly. `bodyCell` is an @ton/core or client cell.
 */
export function parseCapsulePublishBody(bodyCell) {
  if (!bodyCell) return null;
  try {
    const r = cellReader(bodyCell);
    if (r.remaining() < 32 + 64) return null;
    if (r.loadUint(32) !== CAPSULE_PUBLISH_OPCODE) return null;
    const seq = r.loadUint(64);
    if (r.refs() < 3) return null;
    const header0 = r.loadRef();
    const header1 = r.loadRef();
    const bodySig = r.loadRef();
    const rb = cellReader(bodySig);
    if (rb.refs() < 2) return null;
    const body = rb.loadRef();
    const sig = sigBytesFromCell(rb.loadRef());
    if (!header0 || !header1 || !body || !sig) return null;
    return { seq, header0, header1, body, sig };
  } catch {
    return null;
  }
}

/**
 * Shape a parsed CapsulePublish as the chain-entry privateCapsuleFromChainEntry / openPrivateCapsuleChainEntry consume:
 * the three snake cells serialised back to base64 BoCs (that opener re-derives the header objects and hashes from the
 * bytes, so no on-chain hashes are needed — the crypto is the authority). `createdAtSec` (from the tx / the shard's
 * get_record) is carried through for ordering/ageing.
 */
export function convChainEntryFromParsed(parsed, { createdAtSec = null } = {}) {
  if (!parsed?.header0 || !parsed?.header1 || !parsed?.body) throw new Error('convChainEntryFromParsed requires header0/header1/body cells');
  return {
    exists: true,
    header_0_boc: cellToBocBase64(parsed.header0),
    header_1_boc: cellToBocBase64(parsed.header1),
    body_boc: cellToBocBase64(parsed.body),
    seq: parsed.seq === undefined ? null : String(parsed.seq),
    created_at: createdAtSec === null ? undefined : String(createdAtSec),
  };
}

async function cellHashBig(cell) {
  const { hash } = await computeCellHashAndDepth(cell);
  return bytesToBig(hash);
}

/** H(RS_FRAME_DOMAIN ‖ header0.hash ‖ header1.hash ‖ body.hash) — mirrors RecordShard.frameCommit (and the browser builder). */
async function convFrameCommit(header0, header1, body) {
  const cell = tonCell.beginCell()
    .uint(RS_FRAME_DOMAIN, 32, 'RS_FRAME_DOMAIN')
    .uint(await cellHashBig(header0), 256, 'header0 hash')
    .uint(await cellHashBig(header1), 256, 'header1 hash')
    .uint(await cellHashBig(body), 256, 'body hash')
    .endCell();
  return cellHashBig(cell);
}

/**
 * Verify the transport-level write signature of a parsed CapsulePublish: ed25519 over H(RS_WRITE_DOMAIN ‖ seq ‖
 * frameCommit) under the conversation-direction write public key (the value incomingRecordShards returns per bucket).
 * Same computation RecordShard verifies before storing. Returns true/false; safe to call on any parsed body.
 */
export async function verifyConvWriteSignature(parsed, writePublicKey) {
  if (!parsed?.sig || !writePublicKey) return false;
  try {
    const commit = await convFrameCommit(parsed.header0, parsed.header1, parsed.body);
    const digestCell = tonCell.beginCell()
      .uint(RS_WRITE_DOMAIN, 32, 'RS_WRITE_DOMAIN')
      .uint(BigInt(parsed.seq), 64, 'seq')
      .uint(commit, 256, 'frameCommit')
      .endCell();
    const { hash: digest } = await computeCellHashAndDepth(digestCell);
    const pub = writePublicKey instanceof Uint8Array ? writePublicKey : Uint8Array.from(writePublicKey);
    return ed25519.verify(parsed.sig, digest, pub);
  } catch {
    return false;
  }
}
