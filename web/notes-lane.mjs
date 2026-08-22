// notes-lane — "My notes" on the SELF lane.
//
// WHY THIS EXISTS. A note to yourself is not a conversation. The CONV lane derives a per-direction bucket from the
// pair (selfKeyId, peerKeyId), and for self==self there is no direction to derive — conversationOrder refuses it by
// construction and names this lane in the error. So notes go where the crypto layer already reserved room for
// self-data: NAMED RecoveryShard slots, deterministic from the seed alone. That choice also buys the two properties
// a notepad actually needs — the notes follow the user to a new device, and they survive a lost device with only
// the mnemonic.
//
// SHAPE. A snapshot per CHUNK, not an append log. Each named slot holds one sealed blob; the notes list is packed
// oldest-first into consecutive chunks, and a write republishes only the chunks whose content changed (each slot
// carries its own anti-rollback seq). Restore reads every chunk in the range and concatenates in slot order.
//
// CAPACITY IS MEASURED, NOT ASSUMED. One slot holds ~7.4 KB of plaintext: the contract caps the blob at 79 cells
// (RS_MAX_BLOB_CELLS) and the blob is base64-in-JSON around AES-GCM ciphertext, so the on-chain cost runs well above
// the plaintext byte count. packNotes measures every candidate chunk by SEALING it and counting cells — the same
// number the contract's gate 13560 counts — instead of estimating from string length.
import { selfRecoveryShard } from './conv-discovery.mjs?v=19';
import { sealNotesBlob, openNotesBlob } from './recovery-blob.mjs?v=6';
import { buildRecoveryPublishBrowser } from './recovery-publish-browser.mjs?v=19';
import { NOTES_NAMED_SLOT_BASE, NOTES_NAMED_SLOT_COUNT, addrKey } from './shard-discovery.mjs?v=20';
import { probeActiveAddresses } from './shard-reader.mjs?v=21';

// MUST equal RecoveryShard.tact RS_MAX_BLOB_CELLS (gate 13560). Mirrored, not imported, for the same reason the
// recovery lane mirrors it: an over-cap blob BOUNCES on chain, and a fire-and-forget caller would record the bounce
// as success. Refuse client-side instead.
const RS_MAX_BLOB_CELLS = 79;

const utf8 = (s) => new TextEncoder().encode(s);
const fromUtf8 = (b) => new TextDecoder().decode(b);

/** Cells in a snake blob (a linear chain linked by refs[0]) — what computeDataSize(body).cells counts on chain. */
function countCells(cell) {
  let n = 0;
  let cur = cell;
  while (cur) {
    n += 1;
    cur = Array.isArray(cur.refs) && cur.refs.length > 0 ? cur.refs[0] : null;
    if (n > 4096) break;   // malformed/branching tree — stop rather than loop; the cap check refuses it anyway
  }
  return n;
}

/** The slot address for notes chunk `chunkIndex`. Deterministic from the seed — no enumeration, never orphaned. */
export async function notesChunkSlot(seed, chunkIndex) {
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= NOTES_NAMED_SLOT_COUNT) {
    throw new RangeError(`notesChunkSlot: chunkIndex must be in [0, ${NOTES_NAMED_SLOT_COUNT}), got ${chunkIndex}`);
  }
  return selfRecoveryShard(seed, NOTES_NAMED_SLOT_BASE + chunkIndex);
}

/** One note on the wire: `at` (ms since epoch) + `t` (text). Kept terse — every byte is on-chain capacity. */
export function serializeNotes(notes) {
  return utf8(JSON.stringify((notes ?? []).map((note) => ({
    at: Number(note?.at ?? 0) || 0,
    t: String(note?.text ?? ''),
  }))));
}

/** Parse a chunk's plaintext back to notes. A malformed chunk yields [] rather than throwing into the restore path. */
export function deserializeNotes(bytes) {
  try {
    const parsed = JSON.parse(fromUtf8(bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes ?? [])));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.t === 'string')
      .map((item) => ({ at: Number(item.at) || 0, text: String(item.t) }));
  } catch {
    return [];
  }
}

/**
 * Pack notes (oldest first) into chunks that each FIT the on-chain cap, measured by sealing.
 *
 * Returns { chunks, overflow } — `chunks[i]` is the note array for slot i; `overflow` lists the notes that did not
 * fit the whole range. A caller must treat a non-empty overflow as a hard refusal, never as a silent drop: the notes
 * in it are the user's, and losing them quietly is the failure this lane exists to prevent.
 *
 * A SINGLE note too large for an empty chunk overflows on its own — it can never fit, so retrying with fewer
 * neighbours would loop forever.
 */
export async function packNotes(seed, notes) {
  const chunks = [];
  const overflow = [];
  let current = [];
  let chunkIndex = 0;

  const fits = async (candidate, index) => {
    const { body } = await sealNotesBlob(seed, serializeNotes(candidate), index);
    return countCells(body) <= RS_MAX_BLOB_CELLS;
  };

  for (const note of notes ?? []) {
    if (chunkIndex >= NOTES_NAMED_SLOT_COUNT) { overflow.push(note); continue; }
    const candidate = [...current, note];
    if (await fits(candidate, chunkIndex)) { current = candidate; continue; }
    // The note does not fit alongside what is already in this chunk. If the chunk is empty it never will.
    if (current.length === 0) { overflow.push(note); continue; }
    chunks.push(current);
    chunkIndex += 1;
    current = [];
    if (chunkIndex >= NOTES_NAMED_SLOT_COUNT) { overflow.push(note); continue; }
    if (await fits([note], chunkIndex)) current = [note];
    else overflow.push(note);
  }
  if (current.length > 0) chunks.push(current);
  return { chunks, overflow };
}

/**
 * Build the publishes for a notes snapshot. Reads each chunk slot's current seq through `readView` and emits an
 * owner-signed publish per chunk whose CONTENT differs from what is already stored (compared by the sealed content
 * hash h1 the contract also stores) — an unchanged chunk costs nothing.
 *
 * A read that THROWS propagates: publishing at seq 0 against a bound slot would bounce on the anti-rollback gate,
 * and silently skipping the chunk would drop notes.
 */
export async function prepareNotesBackup({ seed, notes, readView, value, readStates = null }) {
  if (typeof readView !== 'function') throw new Error('prepareNotesBackup requires readView');
  const { chunks, overflow } = await packNotes(seed, notes);
  if (overflow.length > 0) {
    const error = new Error(`notes do not fit the ${NOTES_NAMED_SLOT_COUNT} on-chain slots — delete older notes (${overflow.length} did not fit)`);
    error.code = 'PLATHO_NOTES_FULL';
    error.overflow = overflow;
    throw error;
  }
  const slots = [];
  for (let index = 0; index < NOTES_NAMED_SLOT_COUNT; index += 1) slots.push(await notesChunkSlot(seed, index));
  // THE PREFILTER IS ALLOWED TO SKIP A READ, NEVER A WRITE. Most saves touch one chunk and leave the other seven
  // empty and unbound, so a batch pass lets the empty tail cost nothing instead of a get_view each. But a chunk we
  // are about to WRITE is always read for real: its seq is the anti-rollback floor, and publishing at seq 1 into a
  // slot that turned out to be bound BOUNCES — the caller fires and forgets, so that lands as a recorded success
  // with the notes silently dropped. Cheaper reads are worth having; a cheaper write is not.
  const active = await probeActiveAddresses(slots.map((slot) => slot.address), readStates);
  const publishes = [];
  for (let index = 0; index < NOTES_NAMED_SLOT_COUNT; index += 1) {
    const chunkNotes = chunks[index] ?? [];
    const slot = slots[index];
    // Nothing to write here and no live account to clear: there is no question a get_view could answer.
    if (chunkNotes.length === 0 && active && !active.has(addrKey(slot.address))) continue;
    const view = await readView(slot.address);
    const bound = view?.bound === true;
    // A trailing chunk that is empty AND was never bound needs no write at all.
    if (chunkNotes.length === 0 && !bound) continue;
    const { body, bodyBytes, h0, h1 } = await sealNotesBlob(seed, serializeNotes(chunkNotes), index);
    // Unchanged content: the stored h1 already commits to exactly these bytes. Skip the write and its gas.
    if (bound && view?.h1 !== undefined && view?.h1 !== null && BigInt(view.h1) === BigInt(h1)) continue;
    const nextSeq = Number(bound ? BigInt(view.seq) : 0n) + 1;
    const built = await buildRecoveryPublishBrowser({
      seed, slotIndex: NOTES_NAMED_SLOT_BASE + index, seq: nextSeq, h0, h1, body, value,
    });
    // `built.body` is the MESSAGE body; the sealed blob travels alongside it as `blob` so a caller (and the tests'
    // slot store) can hold exactly what the contract will store without re-sealing it under a fresh nonce.
    publishes.push({
      ...built, chunkIndex: index, seq: nextSeq, count: chunkNotes.length,
      // `blobBytes` is the SEALED size, which is what the send costs — `blob` is a cell and cannot report it.
      slotAddress: slot.address, h1, blob: body, blobBytes: bodyBytes,
    });
  }
  return { publishes, chunks };
}

/**
 * Restore notes on a fresh device from the seed: read every chunk slot by its fixed address (no scan), open each
 * under the seed, concatenate in slot order.
 *
 * Returns { notes, clean }. `clean` is FALSE when any read THREW or a bound slot yielded no body — the caller must
 * NOT treat that as "no notes" and must NOT publish a snapshot built from it, which would overwrite the chunks this
 * pass could not see. An unbound slot is a clean empty (nothing was ever written there).
 */
export async function restoreNotes({ seed, readView, readBody, readStates = null }) {
  if (typeof readView !== 'function' || typeof readBody !== 'function') {
    throw new Error('restoreNotes requires readView/readBody');
  }
  const notes = [];
  let clean = true;
  const slots = [];
  for (let index = 0; index < NOTES_NAMED_SLOT_COUNT; index += 1) slots.push(await notesChunkSlot(seed, index));
  // One batched state read replaces up to eight get_views. A chunk with no live account was never written, which
  // is what get_view would report anyway — a CLEAN empty, so `clean` stays true. An untrusted batch yields null
  // and every chunk is probed as before: the shortcut can change the cost, never the notes.
  const active = await probeActiveAddresses(slots.map((slot) => slot.address), readStates);
  for (let index = 0; index < NOTES_NAMED_SLOT_COUNT; index += 1) {
    const slot = slots[index];
    if (active && !active.has(addrKey(slot.address))) continue;
    let view;
    try { view = await readView(slot.address); } catch { clean = false; continue; }
    if (!view?.bound) continue;                       // never written — keep probing, later chunks may exist
    let body;
    try { body = await readBody(slot.address); } catch { clean = false; continue; }
    if (!body) { clean = false; continue; }           // bound but no body = incomplete read, not empty
    const plaintext = await openNotesBlob(seed, body, index);
    if (!plaintext) continue;                          // foreign / wrong seed / wrong chunk — not our data
    notes.push(...deserializeNotes(plaintext));
  }
  return { notes, clean };
}

/** Merge two note lists (local + restored) by (at, text), newest last. Idempotent — a re-restore adds nothing. */
export function mergeNotes(a, b) {
  const seen = new Map();
  for (const note of [...(a ?? []), ...(b ?? [])]) {
    if (!note || typeof note.text !== 'string') continue;
    seen.set(`${Number(note.at) || 0}:${note.text}`, { at: Number(note.at) || 0, text: note.text });
  }
  return [...seen.values()].sort((x, y) => x.at - y.at);
}
