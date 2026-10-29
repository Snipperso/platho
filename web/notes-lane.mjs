import { selfRecoveryShard } from './conv-discovery.mjs?v=104';
import { sealNotesBlob, openNotesBlob } from './recovery-blob.mjs?v=31';
import { buildRecoveryPublishBrowser } from './recovery-publish-browser.mjs?v=102';
import { NOTES_NAMED_SLOT_BASE, NOTES_NAMED_SLOT_COUNT, addrKey } from './shard-discovery.mjs?v=103';
import { probeActiveAddresses } from './shard-reader.mjs?v=108';

const RS_MAX_BLOB_CELLS = 79;

export const NOTES_SLOT_MAX_BLOB_BYTES = RS_MAX_BLOB_CELLS * 127;

const utf8 = (s) => new TextEncoder().encode(s);
const fromUtf8 = (b) => new TextDecoder().decode(b);

function countCells(cell) {
  let n = 0;
  let cur = cell;
  while (cur) {
    n += 1;
    cur = Array.isArray(cur.refs) && cur.refs.length > 0 ? cur.refs[0] : null;
    if (n > 4096) break;
  }
  return n;
}

export async function notesChunkSlot(seed, chunkIndex) {
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= NOTES_NAMED_SLOT_COUNT) {
    throw new RangeError(`notesChunkSlot: chunkIndex must be in [0, ${NOTES_NAMED_SLOT_COUNT}), got ${chunkIndex}`);
  }
  return selfRecoveryShard(seed, NOTES_NAMED_SLOT_BASE + chunkIndex);
}

export function serializeNotes(notes) {
  return utf8(JSON.stringify((notes ?? []).map((note) => ({
    at: Number(note?.at ?? 0) || 0,
    t: String(note?.text ?? ''),
  }))));
}

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
  const active = await probeActiveAddresses(slots.map((slot) => slot.address), readStates);
  const publishes = [];
  for (let index = 0; index < NOTES_NAMED_SLOT_COUNT; index += 1) {
    const chunkNotes = chunks[index] ?? [];
    const slot = slots[index];
    if (chunkNotes.length === 0 && active && !active.has(addrKey(slot.address))) continue;
    const view = await readView(slot.address);
    const bound = view?.bound === true;
    if (chunkNotes.length === 0 && !bound) continue;
    const { body, bodyBytes, h0, h1 } = await sealNotesBlob(seed, serializeNotes(chunkNotes), index);
    if (bound && view?.h1 !== undefined && view?.h1 !== null && BigInt(view.h1) === BigInt(h1)) continue;
    const nextSeq = Number(bound ? BigInt(view.seq) : 0n) + 1;
    const built = await buildRecoveryPublishBrowser({
      seed, slotIndex: NOTES_NAMED_SLOT_BASE + index, seq: nextSeq, h0, h1, body, value,
    });
    publishes.push({
      ...built, chunkIndex: index, seq: nextSeq, count: chunkNotes.length,
      slotAddress: slot.address, h1, blob: body, blobBytes: bodyBytes,
    });
  }
  return { publishes, chunks };
}

export async function restoreNotes({ seed, readView, readBody, readStates = null }) {
  if (typeof readView !== 'function' || typeof readBody !== 'function') {
    throw new Error('restoreNotes requires readView/readBody');
  }
  const notes = [];
  let clean = true;
  const slots = [];
  for (let index = 0; index < NOTES_NAMED_SLOT_COUNT; index += 1) slots.push(await notesChunkSlot(seed, index));
  const active = await probeActiveAddresses(slots.map((slot) => slot.address), readStates);
  for (let index = 0; index < NOTES_NAMED_SLOT_COUNT; index += 1) {
    const slot = slots[index];
    if (active && !active.has(addrKey(slot.address))) continue;
    let view;
    try { view = await readView(slot.address); } catch { clean = false; continue; }
    if (!view?.bound) continue;
    let body;
    try { body = await readBody(slot.address); } catch { clean = false; continue; }
    if (!body) { clean = false; continue; }
    const plaintext = await openNotesBlob(seed, body, index);
    if (!plaintext) { clean = false; continue; }
    notes.push(...deserializeNotes(plaintext));
  }
  return { notes, clean };
}

export function mergeNotes(a, b) {
  const seen = new Map();
  for (const note of [...(a ?? []), ...(b ?? [])]) {
    if (!note || typeof note.text !== 'string') continue;
    seen.set(`${Number(note.at) || 0}:${note.text}`, { at: Number(note.at) || 0, text: note.text });
  }
  return [...seen.values()].sort((x, y) => x.at - y.at);
}
