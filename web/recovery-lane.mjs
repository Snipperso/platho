// recovery-lane — the RECOVERY orchestration: back up the conversation K_root map on chain, and restore it on a fresh
// device from the seed. Ties recovery-blob (seal/open under the seed) + recovery-publish-browser (the owner-signed
// message) + recovery-transport (get_view seq / get_body) + conv-discovery (the slot addresses). app.js supplies the
// wallet send and the get-method transport; this stays a testable seam against stub readers, like the other lanes.

import { selfRecoveryShardSpace } from './conv-discovery.mjs?v=1';
import { sealRecoveryBlob, openRecoveryBlob } from './recovery-blob.mjs?v=1';
import { buildRecoveryPublishBrowser } from './recovery-publish-browser.mjs?v=1';

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
  for (const slot of slots) {
    let view;
    try { view = await readView(slot.address); } catch { continue; }
    if (!view?.bound) continue;                    // fresh / never-written slot — nothing to restore, keep probing
    let body;
    try { body = await readBody(slot.address); } catch { continue; }
    if (!body) continue;
    let map;
    try { map = await openRecoveryBlob(seed, body); } catch { continue; }   // foreign/corrupt blob → skip, never throw
    for (const [convId, rec] of map) merged.set(convId, rec);
    found.push({ slotIndex: slot.slotIndex, seq: Number(view.seq), count: map.size });
  }
  return { map: merged, found };
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
  let currentSeq = 0n;
  try {
    const view = await readView(slot.address);
    if (view?.bound) currentSeq = BigInt(view.seq);
  } catch { /* a fresh slot has no view — seq starts at 0, so the first backup is seq 1 */ }
  const nextSeq = Number(currentSeq) + 1;
  const { body, h0, h1 } = await sealRecoveryBlob(seed, map);
  const built = await buildRecoveryPublishBrowser({ seed, slotIndex, seq: nextSeq, h0, h1, body, value });
  return { ...built, seq: nextSeq };
}
