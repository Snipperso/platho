// recovery-lane — the RECOVERY orchestration: back up the conversation K_root map on chain, and restore it on a fresh
// device from the seed. Ties recovery-blob (seal/open under the seed) + recovery-publish-browser (the owner-signed
// message) + recovery-transport (get_view seq / get_body) + conv-discovery (the slot addresses). app.js supplies the
// wallet send and the get-method transport; this stays a testable seam against stub readers, like the other lanes.

import { selfRecoveryShardSpace, selfRecoveryShard } from './conv-discovery.mjs?v=1';
import { sealRecoveryBlob, openRecoveryBlob, sealPrefsBlob, openPrefsBlob } from './recovery-blob.mjs?v=1';
import { buildRecoveryPublishBrowser } from './recovery-publish-browser.mjs?v=1';
import { RECOVERY_MAX_SLOTS, PREFS_NAMED_SLOT_INDEX } from './shard-discovery.mjs?v=1';

// MUST equal RecoveryShard.tact RS_MAX_BLOB_CELLS — the immutable on-chain cap on the blob's cell tree (gate 13560).
// Mirrored (not imported) so an over-cap backup is refused CLIENT-SIDE before it bounces on chain and is mis-recorded.
const RS_MAX_BLOB_CELLS = 79;

/**
 * The recovery SLOT a conversation is backed up into. A DETERMINISTIC, STABLE hash of the convId over [0, MAX_SLOTS):
 * a conversation always lands in the same slot (so its backups overwrite one another rather than scattering), the load
 * spreads roughly evenly across the 256 slots, and — since restore probes ALL slots and merges — the mapping never has
 * to be agreed cross-device. convId is already `${hex(lo)}:${hex(hi)}` (hash-derived, uniform), so a cheap sync string
 * hash distributes it well without WebCrypto. Multi-slot lifts the single-slot cap (~30 conversations) to ~256×that.
 */
export function recoverySlotForConversation(convId) {
  let h = 0;
  for (let i = 0; i < convId.length; i += 1) h = (Math.imul(h, 31) + convId.charCodeAt(i)) >>> 0;
  return h % RECOVERY_MAX_SLOTS;
}

/** Group a conversation map by recovery slot: Map<slotIndex, Map<convId, record>>. Each slot is backed up independently. */
export function partitionRecoveryMap(map) {
  const bySlot = new Map();
  for (const [convId, rec] of map) {
    const slot = recoverySlotForConversation(convId);
    if (!bySlot.has(slot)) bySlot.set(slot, new Map());
    bySlot.get(slot).set(convId, rec);
  }
  return bySlot;
}

/** Cells in a snake blob (a linear chain linked by refs[0]) — what the contract's computeDataSize(body).cells counts. */
function countCells(cell) {
  let n = 0;
  let cur = cell;
  while (cur) {
    n += 1;
    cur = Array.isArray(cur.refs) && cur.refs.length > 0 ? cur.refs[0] : null;
    if (n > 4096) break;   // a malformed/branching tree — stop rather than loop; the cap check will refuse it anyway
  }
  return n;
}

/**
 * Restore the conversation key map from chain on a fresh device that has only the seed. Probes EVERY slot in
 * [0, RECOVERY_MAX_SLOTS) — never stops at the first gap, because a slot can be evicted after 3 years leaving a hole
 * while later slots stay live, and stopping early would silently drop every conversation above the hole (the one loss
 * this lane exists to prevent). A slot that is unbound / unreadable / sealed under a different seed is skipped.
 * Returns { map, found } — `map` is the merged conversation key store map, `found` lists the slots that yielded records.
 */
export async function restoreConvKeysFromRecovery({ seed, readView, readBody }) {
  if (typeof readView !== 'function' || typeof readBody !== 'function') {
    throw new Error('restoreConvKeysFromRecovery requires readView/readBody');
  }
  const { slots } = await selfRecoveryShardSpace(seed);
  const merged = new Map();
  const found = [];
  let clean = true;   // FALSE if ANY read threw — an unclean restore may be MISSING on-chain conversations
  for (const slot of slots) {
    let view;
    try { view = await readView(slot.address); } catch { clean = false; continue; }
    if (!view?.bound) continue;                    // fresh / never-written slot — nothing to restore, keep probing
    let body;
    try { body = await readBody(slot.address); } catch { clean = false; continue; }
    if (!body) { clean = false; continue; }        // a bound slot with no body = failed/incomplete read, not empty
    let map;
    try { map = await openRecoveryBlob(seed, body); } catch { continue; }   // foreign/corrupt blob -> skip (not our loss)
    for (const [convId, rec] of map) merged.set(convId, rec);
    found.push({ slotIndex: slot.slotIndex, seq: Number(view.seq), count: map.size });
  }
  // clean=false means a transient failure hid part of the backup: the caller MUST retry and MUST NOT overwrite the
  // on-chain blob with this partial map (it would destroy the conversations this scan missed). [recovery-wiring review #1]
  return { map: merged, found, clean };
}

/**
 * Prepare the next recovery backup for one slot: read the slot's current seq (anti-rollback floor), seal the map under
 * the seed, and build the owner-signed wallet message at seq+1. The caller sends it and, like the CONV/INTRO sends,
 * must NOT re-sign a fresh seq on an ambiguous retry (the shard rejects a non-advancing seq, so a naive re-sign at the
 * SAME seq bounces — a fixed-seq re-broadcast is the idempotent retry; the send-retry hardening covers it). Returns the
 * built message plus the chosen seq.
 */
export async function prepareRecoveryBackup({ seed, slotIndex, map, readView, value }) {
  if (typeof readView !== 'function') throw new Error('prepareRecoveryBackup requires readView');
  const { slots } = await selfRecoveryShardSpace(seed);
  const slot = slots[slotIndex];
  if (!slot) throw new Error(`prepareRecoveryBackup: slotIndex ${slotIndex} out of range`);
  // Read the slot's current seq. A read that THROWS must NOT be swallowed as "fresh slot, seq 0" — that would publish
  // at seq 1 and either bounce gate 13564 (bound at a higher seq) or pick below the retained high-water. Let a transient
  // failure propagate so the caller retries; the reader returns null (not a throw) ONLY for a genuinely absent slot.
  const view = await readView(slot.address);
  const currentSeq = view?.bound ? BigInt(view.seq) : 0n;
  const nextSeq = Number(currentSeq) + 1;
  const { body, h0, h1 } = await sealRecoveryBlob(seed, map);
  // OVERFLOW GUARD: the immutable contract caps the blob at RS_MAX_BLOB_CELLS (gate 13560); a bigger blob BOUNCES. The
  // caller fire-and-forgets, so without this an over-cap backup would be recorded as success while nothing landed — a
  // reinstall would then silently lose every conversation past the cap. Fail loudly. [recovery-wiring review #3/#4]
  const cells = countCells(body);
  if (cells > RS_MAX_BLOB_CELLS) {
    const error = new Error(`recovery blob is ${cells} cells, over the on-chain cap of ${RS_MAX_BLOB_CELLS} — the conversation set does not fit one slot (multi-slot sharding is the follow-up)`);
    error.code = 'RECOVERY_BLOB_OVERFLOW';
    throw error;
  }
  const built = await buildRecoveryPublishBrowser({ seed, slotIndex, seq: nextSeq, h0, h1, body, value });
  return { ...built, seq: nextSeq, cells };
}

/**
 * Prepare the next PREFS backup: seal the prefs snapshot bytes and build the owner-signed publish for the NAMED prefs
 * slot (PREFS_NAMED_SLOT_INDEX — a separate blob at a separate address from every conversation slot). Same anti-rollback
 * seq+1 discipline and same overflow guard as prepareRecoveryBackup; the prefs blob is a single small snapshot, so the
 * cap is never the constraint, but the guard stays a fail-loud floor. A read that THROWS propagates (never a silent seq 0).
 */
export async function preparePrefsBackup({ seed, prefsBytes, readView, value }) {
  if (typeof readView !== 'function') throw new Error('preparePrefsBackup requires readView');
  const slot = await selfRecoveryShard(seed, PREFS_NAMED_SLOT_INDEX);
  const view = await readView(slot.address);
  const currentSeq = view?.bound ? BigInt(view.seq) : 0n;
  const nextSeq = Number(currentSeq) + 1;
  const { body, h0, h1 } = await sealPrefsBlob(seed, prefsBytes);
  const cells = countCells(body);
  if (cells > RS_MAX_BLOB_CELLS) {
    const error = new Error(`prefs blob is ${cells} cells, over the on-chain cap of ${RS_MAX_BLOB_CELLS}`);
    error.code = 'RECOVERY_BLOB_OVERFLOW';
    throw error;
  }
  const built = await buildRecoveryPublishBrowser({ seed, slotIndex: PREFS_NAMED_SLOT_INDEX, seq: nextSeq, h0, h1, body, value });
  return { ...built, seq: nextSeq, cells };
}

/**
 * Restore the prefs snapshot bytes on a fresh device from the seed: read the NAMED prefs slot by its fixed address (no
 * scan), open it under the seed. Returns { prefsBytes, clean } — prefsBytes is null for an unbound slot (nothing saved),
 * a foreign/wrong-seed blob, or a read that could not complete; clean=false ONLY when a read THREW (the caller must not
 * treat an unclean result as "no prefs" and must retry). A clean unbound slot is clean=true, prefsBytes=null.
 */
export async function restorePrefsSnapshot({ seed, readView, readBody }) {
  if (typeof readView !== 'function' || typeof readBody !== 'function') {
    throw new Error('restorePrefsSnapshot requires readView/readBody');
  }
  const slot = await selfRecoveryShard(seed, PREFS_NAMED_SLOT_INDEX);
  let view;
  try { view = await readView(slot.address); } catch { return { prefsBytes: null, clean: false }; }
  if (!view?.bound) return { prefsBytes: null, clean: true };     // never written — no prefs to restore, cleanly
  let body;
  try { body = await readBody(slot.address); } catch { return { prefsBytes: null, clean: false }; }
  if (!body) return { prefsBytes: null, clean: false };           // bound but no body = incomplete read, not empty
  return { prefsBytes: await openPrefsBlob(seed, body), clean: true };   // null if foreign/wrong-seed (not our loss)
}
