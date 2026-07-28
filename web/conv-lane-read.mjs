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
import { toWireAddress } from './shard-reader.mjs?v=1';
import { ed25519 } from './vendor/@noble/curves/ed25519.js';

// MUST equal conv-publish-browser + RecordShard.tact — mirrored (not imported) so a drift is caught by the round-trip
// pin in tests/conv-lane-read.test.ts rather than silently accepting a body from a different opcode.
export const CAPSULE_PUBLISH_OPCODE = 0x52535031n; // "RSP1"
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

/** The first 64 bytes of a sig sub-cell (buildConvPublishBody stored the 64-byte ed25519 sig as the cell's data).
 *  Dual-mode like cellReader: reads an @ton/core cell (loadBuffer) or a client cell (.data), so the whole parse is
 *  genuinely usable on either input, not just the client cell production feeds it. */
function sigBytesFromCell(cell) {
  if (cell && typeof cell.beginParse === 'function') {
    try {
      const slice = cell.beginParse();
      if (slice.remainingBits < 512) return null;
      return Uint8Array.from(slice.loadBuffer(64));
    } catch {
      return null;
    }
  }
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

/** Decode a RecordShardView getter stack to its last_seq (index 2: [write_pubkey, epoch, last_seq, record_count, …]).
 *  An arity check guards the same silent field-shift drift the other lanes learned the hard way. */
export function decodeRecordShardLastSeq(stack) {
  if (!Array.isArray(stack) || stack.length < 3) {
    throw new Error(`RecordShard get_view returned ${stack?.length ?? 0} stack items, expected >= 3`);
  }
  return Number(BigInt(stack[2]?.value ?? 0));
}

/** Decode a RecordShardView getter stack to { lastSeq, recordCount } — record_count is index 3, the number of records
 *  stored (each publish appends exactly one). Arity check guards the same silent field-shift drift. */
export function decodeRecordShardView(stack) {
  if (!Array.isArray(stack) || stack.length < 4) {
    throw new Error(`RecordShard get_view returned ${stack?.length ?? 0} stack items, expected >= 4`);
  }
  return { lastSeq: Number(BigInt(stack[2]?.value ?? 0)), recordCount: Number(BigInt(stack[3]?.value ?? 0)) };
}

/** Decode a CapsuleRecordView getter stack — get_record returns { exists: Bool, frame_commit: Int, created_at: Int }.
 *  The Bool comes back as an int (0/1) on the stack; frame_commit is the per-record commitment the confirm matches. */
export function decodeCapsuleRecordView(stack) {
  if (!Array.isArray(stack) || stack.length < 3) {
    throw new Error(`RecordShard get_record returned ${stack?.length ?? 0} stack items, expected >= 3`);
  }
  return {
    exists: BigInt(stack[0]?.value ?? 0) !== 0n,
    frameCommit: BigInt(stack[1]?.value ?? 0),
    createdAt: Number(BigInt(stack[2]?.value ?? 0)),
  };
}

// Absence must come from the NON-SPOOFABLE TVM abort code a get-method run yields against a code-less account, which
// toncenter returns IN THE BODY (HTTP 200) and the transport rethrows as error.exitCode. THROUGH THIS TRANSPORT that
// code is -13 in production (TON_GET_METHOD_UNINITIALIZED_EXIT_CODE — the same code isAthWalletNotDeployedError matches;
// a first assumption of -256 was wrong and re-opened a silent green, so it is verified against the transport here); the
// @ton/sandbox emulator surfaces it as -256, so BOTH count. A bare HTTP 404 does NOT: the transport 404s on any
// endpoint/proxy/gateway/misroute failure, and mis-reading a transient 404 as "not landed" would false-red a landed
// payment and, past the re-broadcast window, drive a double-publish. [confirm review: uninit code -13, 404 false-absence]
const RS_UNINIT_EXIT_CODES = new Set([-13, -256]);
function isUninitExit(code) { return RS_UNINIT_EXIT_CODES.has(Number(code)); }
function isStructurallyAbsent(error) {
  return isUninitExit(error?.exit_code ?? error?.exitCode ?? error?.body?.exit_code);
}

/**
 * Read a RecordShard's get_view as { exists, lastSeq, recordCount }. A structurally-absent account (never deployed) is
 * reported exists:false / recordCount:0 — NOT an error. Any OTHER failure (429, non-(-256) exit, network) throws, so the
 * caller never mistakes "I could not read it" for "the shard has no records". Used by the CONV delivery confirm.
 */
export function createRecordShardViewReader(runGetMethod) {
  if (typeof runGetMethod !== 'function') throw new Error('createRecordShardViewReader requires runGetMethod');
  return async (address) => {
    let raw;
    try {
      raw = await runGetMethod({ address: toWireAddress(address), method: 'get_view', stack: [] });
    } catch (error) {
      if (isStructurallyAbsent(error)) return { exists: false, lastSeq: 0, recordCount: 0 };
      throw error;
    }
    if (!raw) throw new Error('RecordShard get_view returned no response');
    if (isUninitExit(raw.exit_code)) return { exists: false, lastSeq: 0, recordCount: 0 };
    if (raw.exit_code !== 0) throw new Error(`RecordShard get_view failed with exit_code ${raw.exit_code}`);
    return { exists: true, ...decodeRecordShardView(raw.stack) };
  };
}

/**
 * Read one RecordShard record by entry_id via get_record → { exists, frameCommit, createdAt }. Structural absence (the
 * whole shard is not deployed) reports exists:false; other failures throw (transient — the confirm retries, it does NOT
 * conclude "not stored" from a read it could not complete).
 */
export function createRecordShardRecordReader(runGetMethod) {
  if (typeof runGetMethod !== 'function') throw new Error('createRecordShardRecordReader requires runGetMethod');
  return async (address, entryId) => {
    let raw;
    try {
      raw = await runGetMethod({ address: toWireAddress(address), method: 'get_record', stack: [{ type: 'num', value: String(entryId) }] });
    } catch (error) {
      if (isStructurallyAbsent(error)) return { exists: false, frameCommit: 0n, createdAt: 0 };
      throw error;
    }
    if (!raw) throw new Error('RecordShard get_record returned no response');
    if (isUninitExit(raw.exit_code)) return { exists: false, frameCommit: 0n, createdAt: 0 };
    if (raw.exit_code !== 0) throw new Error(`RecordShard get_record failed with exit_code ${raw.exit_code}`);
    return decodeCapsuleRecordView(raw.stack);
  };
}

/**
 * Confirm a CONV message LANDED by matching MY frame_commit(s) against the records the shard actually stored — NOT the
 * global last_seq high-water (the flaw that sank the first confirm driver: a LATER message reaching that seq while mine
 * bounced false-confirmed the bounced one → silent loss). frame_commit is per-record and unique to my capsule, so a
 * different write can never satisfy it. My outgoing conversation-direction shard is written ONLY by me (the write key is
 * mine), so my parts are the MOST RECENT records — the scan walks down from record_count and normally hits them at once.
 *
 * `commits` is the array of my parts' frame_commits (all must be present — a middle part can bounce while a later one
 * lands, gate 13653 being strictly-increasing not contiguous). `minSeq` is my highest part's seq (a cheap authoritative
 * floor, below). Returns { landed, complete, seqShort, recordCount, lastSeq, scanned }:
 *   - landed=true   → every commit is stored (verified delivery).
 *   - seqShort=true → the shard has NOT accepted a publish up to my seq (last_seq < minSeq). Since my direction is
 *     mine-only and strictly-increasing, NONE of my parts is stored and (SAFE_CAP reached / seq collision / underfunding
 *     — the dominant bounce causes) none can be now. No record scan is done; the caller decides FINALITY from age.
 *   - complete=true → the record scan is AUTHORITATIVE: it found them all, or reached record 0 (nothing left to find).
 *     maxScan DEFAULTS to the full record_count, so a bounced commit's ABSENCE is always provable — a fixed 512 window
 *     left every bounce in a >512-record shard PERMANENTLY not-complete → never reddened → false green. [confirm review]
 *   - landed=false & complete=false & !seqShort → an explicit maxScan window was exhausted with records still below —
 *     INCONCLUSIVE, not a failure. (Does not arise with the default full scan.)
 * THROWS on a transient read (propagated from the readers) — the caller treats a throw as "retry", never "not landed".
 */
export async function confirmConvRecordsLanded({ readView, readRecord, address, commits, minSeq = null, maxScan = null }) {
  if (typeof readView !== 'function' || typeof readRecord !== 'function') {
    throw new Error('confirmConvRecordsLanded requires readView/readRecord');
  }
  const want = new Set((commits ?? []).map((c) => BigInt(c)));
  if (want.size === 0) return { landed: true, complete: true, seqShort: false, recordCount: 0, lastSeq: 0, scanned: 0 };
  const view = await readView(address);
  // Absent shard: my publish (which carries StateInit) would have DEPLOYED it, so absence is authoritative non-landing.
  if (!view?.exists) return { landed: false, complete: true, seqShort: false, recordCount: 0, lastSeq: 0, scanned: 0 };
  const recordCount = Number(view.recordCount);
  const lastSeq = Number(view.lastSeq);
  // CHEAP SEQ FLOOR — no record reads. If the shard has not reached my seq, none of my parts is stored. Handles the
  // >512-record shard bounce at zero scan cost (at SAFE_CAP the bounce leaves last_seq below my seq).
  if (minSeq != null && lastSeq < Number(minSeq)) {
    return { landed: false, complete: false, seqShort: true, recordCount, lastSeq, scanned: 0 };
  }
  // The shard has passed my seq (or no floor given): my parts have had their FINAL accept/bounce. Scan for my commits;
  // the default limit is the WHOLE shard so absence is provable. The common landed case short-circuits at the top.
  const limit = maxScan == null ? recordCount : Math.min(Number(maxScan), recordCount);
  const found = new Set();
  let scanned = 0;
  for (let id = recordCount - 1; id >= 0 && scanned < limit && found.size < want.size; id -= 1) {
    const rec = await readRecord(address, id);
    scanned += 1;
    if (rec?.exists && want.has(BigInt(rec.frameCommit))) found.add(BigInt(rec.frameCommit));
  }
  const landed = found.size === want.size;
  const complete = landed || scanned >= recordCount;   // found them all, or walked to the bottom with nothing left
  return { landed, complete, seqShort: false, recordCount, lastSeq, scanned, foundCount: found.size };
}

/**
 * Read a RecordShard's on-chain last_seq (the publish anti-rollback floor, gate 13653) via get_view. Used as the CONV
 * outgoing-seq COLD-START floor when the local monotonic counter has no value for a (conversation, epoch) — e.g. after
 * a reinstall that restored the K_root but not the per-epoch seq: without it the first sends of the day would reuse
 * seqs already committed on chain and bounce. An absent/uninitialised shard means nothing was published → floor 0.
 * [recovery-wiring review #0]
 */
export function createRecordShardLastSeqReader(runGetMethod) {
  if (typeof runGetMethod !== 'function') throw new Error('createRecordShardLastSeqReader requires runGetMethod');
  return async (address) => {
    const raw = await runGetMethod({ address: toWireAddress(address), method: 'get_view', stack: [] });
    if (!raw || isUninitExit(raw.exit_code)) return 0;                   // shard not deployed → nothing published (-13 prod / -256 sandbox)
    if (raw.exit_code !== 0) throw new Error(`RecordShard get_view failed with exit_code ${raw.exit_code}`);
    return decodeRecordShardLastSeq(raw.stack);
  };
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
