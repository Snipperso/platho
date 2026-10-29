
import { selfRecoveryShardSpace, selfRecoveryShard } from './conv-discovery.mjs?v=104';
import {
  sealRecoveryBlob, openRecoveryBlob, sealPrefsBlob, openPrefsBlob, sealGroupsBlob, openGroupsBlob, PREFS_SEAL_OVERHEAD_BYTES,
} from './recovery-blob.mjs?v=31';
import { buildRecoveryPublishBrowser } from './recovery-publish-browser.mjs?v=102';
import {
  RECOVERY_MAX_SLOTS, GROUPS_NAMED_SLOT_BASE, GROUPS_NAMED_SLOT_COUNT, PREFS_CHUNK_COUNT, prefsChunkSlotIndex, addrKey,
} from './shard-discovery.mjs?v=103';
import { groupsRecoveryBytes, parseGroupsRecovery } from './group-store.mjs?v=42';
import { probeActiveAddresses } from './shard-reader.mjs?v=108';

const RS_MAX_BLOB_CELLS = 79;
const SNAKE_CELL_BYTES = 127;
export const PREFS_CHUNK_PLAINTEXT_MAX = RS_MAX_BLOB_CELLS * SNAKE_CELL_BYTES - PREFS_SEAL_OVERHEAD_BYTES;

export function recoverySlotForConversation(convId) {
  let h = 0;
  for (let i = 0; i < convId.length; i += 1) h = (Math.imul(h, 31) + convId.charCodeAt(i)) >>> 0;
  return h % RECOVERY_MAX_SLOTS;
}

export function partitionRecoveryMap(map) {
  const bySlot = new Map();
  for (const [convId, rec] of map) {
    const slot = recoverySlotForConversation(convId);
    if (!bySlot.has(slot)) bySlot.set(slot, new Map());
    bySlot.get(slot).set(convId, rec);
  }
  return bySlot;
}

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

export async function restoreConvKeysFromRecovery({ seed, readView, readBody, readStates = null, onlySlots = null }) {
  if (typeof readView !== 'function' || typeof readBody !== 'function') {
    throw new Error('restoreConvKeysFromRecovery requires readView/readBody');
  }
  const { slots } = await selfRecoveryShardSpace(seed);
  const merged = new Map();
  const found = [];
  let clean = true;
  const active = await probeActiveAddresses(slots.map((s) => s.address), readStates);
  let probe = active ? slots.filter((slot) => active.has(addrKey(slot.address))) : slots;
  if (onlySlots) probe = probe.filter((slot) => onlySlots.has(addrKey(slot.address)));
  for (const slot of probe) {
    let view;
    try { view = await readView(slot.address); } catch { clean = false; continue; }
    if (!view?.bound) continue;
    let body;
    try { body = await readBody(slot.address); } catch { clean = false; continue; }
    if (!body) { clean = false; continue; }
    let map;
    try { map = await openRecoveryBlob(seed, body); } catch (error) {
      clean = false;
      console.warn('[recovery] slot', slot.slotIndex, 'holds a blob this build cannot read — backups stay locked', error);
      continue;
    }
    for (const [convId, rec] of map) merged.set(convId, rec);
    found.push({ slotIndex: slot.slotIndex, seq: Number(view.seq), count: map.size });
  }
  return { map: merged, found, clean };
}

export async function staleRecoverySlots({ seed, readView, localSlotIndices, nowS, refreshAfterS, readStates = null }) {
  if (typeof readView !== 'function') throw new Error('staleRecoverySlots requires readView');
  const { slots } = await selfRecoveryShardSpace(seed);
  const stale = [];
  const mine = slots.filter((slot) => localSlotIndices.has(slot.slotIndex));
  const active = await probeActiveAddresses(mine.map((slot) => slot.address), readStates);
  const probe = active ? mine.filter((slot) => active.has(addrKey(slot.address))) : mine;
  for (const slot of probe) {
    let view;
    try { view = await readView(slot.address); } catch { continue; }
    if (!view?.bound) continue;
    if (nowS - Number(view.updated_at) >= refreshAfterS) stale.push(slot.slotIndex);
  }
  return stale;
}

export async function prepareRecoveryBackup({ seed, slotIndex, map, readView, value }) {
  if (typeof readView !== 'function') throw new Error('prepareRecoveryBackup requires readView');
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= RECOVERY_MAX_SLOTS) {
    throw new Error(`prepareRecoveryBackup: slotIndex ${slotIndex} out of the conversation range [0, ${RECOVERY_MAX_SLOTS})`);
  }
  const slot = await selfRecoveryShard(seed, slotIndex);
  const view = await readView(slot.address);
  const currentSeq = view?.bound ? BigInt(view.seq) : 0n;
  const nextSeq = Number(currentSeq) + 1;
  const { body, h0, h1 } = await sealRecoveryBlob(seed, map);
  const cells = countCells(body);
  if (cells > RS_MAX_BLOB_CELLS) {
    const error = new Error(`recovery blob is ${cells} cells, over the on-chain cap of ${RS_MAX_BLOB_CELLS} — the conversation set does not fit one slot (multi-slot sharding is the follow-up)`);
    error.code = 'RECOVERY_BLOB_OVERFLOW';
    throw error;
  }
  const built = await buildRecoveryPublishBrowser({ seed, slotIndex, seq: nextSeq, h0, h1, body, value });
  return { ...built, seq: nextSeq, cells, h1 };
}

export async function prefsChunkSlot(seed, chunkIndex) {
  return selfRecoveryShard(seed, prefsChunkSlotIndex(chunkIndex));
}

export async function preparePrefsBackup({ seed, prefsBytes, chunkIndex = 0, readView, value }) {
  if (typeof readView !== 'function') throw new Error('preparePrefsBackup requires readView');
  const slotIndex = prefsChunkSlotIndex(chunkIndex);
  const slot = await selfRecoveryShard(seed, slotIndex);
  const view = await readView(slot.address);
  const currentSeq = view?.bound ? BigInt(view.seq) : 0n;
  const nextSeq = Number(currentSeq) + 1;
  const { body, h0, h1 } = await sealPrefsBlob(seed, prefsBytes, chunkIndex);
  const cells = countCells(body);
  if (cells > RS_MAX_BLOB_CELLS) {
    const error = new Error(`prefs chunk ${chunkIndex} is ${cells} cells, over the on-chain cap of ${RS_MAX_BLOB_CELLS}`);
    error.code = 'RECOVERY_BLOB_OVERFLOW';
    throw error;
  }
  const built = await buildRecoveryPublishBrowser({ seed, slotIndex, seq: nextSeq, h0, h1, body, value });
  return { ...built, seq: nextSeq, cells, h1, chunkIndex };
}

export async function restorePrefsChunks({ seed, readView, readBody, readStates = null }) {
  if (typeof readView !== 'function' || typeof readBody !== 'function') {
    throw new Error('restorePrefsChunks requires readView/readBody');
  }
  const slots = [];
  // eslint-disable-next-line no-await-in-loop
  for (let chunkIndex = 0; chunkIndex < PREFS_CHUNK_COUNT; chunkIndex += 1) slots.push(await prefsChunkSlot(seed, chunkIndex));
  const active = await probeActiveAddresses(slots.map((slot) => slot.address), readStates);
  const chunks = [];
  let clean = true;
  for (let chunkIndex = 0; chunkIndex < PREFS_CHUNK_COUNT; chunkIndex += 1) {
    const slot = slots[chunkIndex];
    if (active && !active.has(addrKey(slot.address))) continue;
    let view;
    // eslint-disable-next-line no-await-in-loop
    try { view = await readView(slot.address); } catch { clean = false; continue; }
    if (!view?.bound) continue;
    let body;
    // eslint-disable-next-line no-await-in-loop
    try { body = await readBody(slot.address); } catch { clean = false; continue; }
    if (!body) { clean = false; continue; }
    // eslint-disable-next-line no-await-in-loop
    const bytes = await openPrefsBlob(seed, body, chunkIndex);
    if (!bytes) { clean = false; continue; }
    chunks.push({ chunkIndex, bytes });
  }
  return { chunks, clean };
}

export const RECOVERY_CONFIRM_DELAYS_MS = Object.freeze([8_000, 12_000, 15_000, 20_000, 25_000, 30_000]);
const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function confirmRecoverySlotWrites({ readView, writes, delaysMs = RECOVERY_CONFIRM_DELAYS_MS, sleep = defaultSleep }) {
  if (typeof readView !== 'function') throw new Error('confirmRecoverySlotWrites requires readView');
  let pending = (writes ?? []).map((w) => ({ address: w.address, seq: BigInt(w.seq), ...(w.h1 === undefined || w.h1 === null ? {} : { h1: BigInt(w.h1) }) }));
  for (const delay of delaysMs) {
    if (pending.length === 0) break;
    await sleep(delay);
    const still = [];
    for (const write of pending) {
      let shown = false;
      try {
        const view = await readView(write.address);
        const seqShown = Boolean(view?.bound) && BigInt(view.seq) >= write.seq;
        shown = write.h1 === undefined
          ? seqShown
          : seqShown && view.h1 !== undefined && view.h1 !== null && BigInt(view.h1) === write.h1;
      } catch { }
      if (!shown) still.push(write);
    }
    pending = still;
  }
  return { landed: pending.length === 0, pending };
}

export async function confirmRecoverySlotWrite({ readView, address, seq, h1 = null, delaysMs, sleep }) {
  const receipt = await confirmRecoverySlotWrites({ readView, writes: [{ address, seq, h1 }], ...(delaysMs ? { delaysMs } : {}), ...(sleep ? { sleep } : {}) });
  return receipt.landed;
}


export async function groupsChunkSlot(seed, chunkIndex) {
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= GROUPS_NAMED_SLOT_COUNT) {
    throw new RangeError(`groupsChunkSlot: chunkIndex must be in [0, ${GROUPS_NAMED_SLOT_COUNT}), got ${chunkIndex}`);
  }
  return selfRecoveryShard(seed, GROUPS_NAMED_SLOT_BASE + chunkIndex);
}

export async function packGroupsForRecovery(seed, entries) {
  const chunks = [];
  const overflow = [];
  let current = [];
  let chunkIndex = 0;
  const fits = async (candidate, index) => {
    const { body } = await sealGroupsBlob(seed, groupsRecoveryBytes(candidate), index);
    return countCells(body) <= RS_MAX_BLOB_CELLS;
  };
  for (const entry of entries ?? []) {
    if (chunkIndex >= GROUPS_NAMED_SLOT_COUNT) { overflow.push(entry); continue; }
    const candidate = [...current, entry];
    // eslint-disable-next-line no-await-in-loop
    if (await fits(candidate, chunkIndex)) { current = candidate; continue; }
    if (current.length === 0) { overflow.push(entry); continue; }
    chunks.push(current);
    current = [];
    chunkIndex += 1;
    if (chunkIndex >= GROUPS_NAMED_SLOT_COUNT) { overflow.push(entry); continue; }
    // eslint-disable-next-line no-await-in-loop
    if (await fits([entry], chunkIndex)) current = [entry];
    else overflow.push(entry);
  }
  if (current.length > 0) chunks.push(current);
  return { chunks, overflow };
}

export async function prepareGroupsBackup({ seed, entries, chunkIndex, readView, value }) {
  if (typeof readView !== 'function') throw new Error('prepareGroupsBackup requires readView');
  const slot = await groupsChunkSlot(seed, chunkIndex);
  const view = await readView(slot.address);
  if ((entries ?? []).length === 0 && !view?.bound) return null;
  const currentSeq = view?.bound ? BigInt(view.seq) : 0n;
  const nextSeq = Number(currentSeq) + 1;
  const { body, h0, h1 } = await sealGroupsBlob(seed, groupsRecoveryBytes(entries ?? []), chunkIndex);
  const cells = countCells(body);
  if (cells > RS_MAX_BLOB_CELLS) {
    const error = new Error(`groups blob is ${cells} cells, over the on-chain cap of ${RS_MAX_BLOB_CELLS}`);
    error.code = 'RECOVERY_BLOB_OVERFLOW';
    throw error;
  }
  const built = await buildRecoveryPublishBrowser({
    seed, slotIndex: GROUPS_NAMED_SLOT_BASE + chunkIndex, seq: nextSeq, h0, h1, body, value,
  });
  return { ...built, seq: nextSeq, cells, h1, chunkIndex };
}

export async function restoreGroupsEntries({ seed, readView, readBody, readStates = null }) {
  if (typeof readView !== 'function' || typeof readBody !== 'function') {
    throw new Error('restoreGroupsEntries requires readView/readBody');
  }
  const entries = [];
  let clean = true;
  const slots = [];
  // eslint-disable-next-line no-await-in-loop
  for (let chunkIndex = 0; chunkIndex < GROUPS_NAMED_SLOT_COUNT; chunkIndex += 1) slots.push(await groupsChunkSlot(seed, chunkIndex));
  const active = await probeActiveAddresses(slots.map((slot) => slot.address), readStates);
  for (let chunkIndex = 0; chunkIndex < GROUPS_NAMED_SLOT_COUNT; chunkIndex += 1) {
    const slot = slots[chunkIndex];
    if (active && !active.has(addrKey(slot.address))) continue;
    let view;
    // eslint-disable-next-line no-await-in-loop
    try { view = await readView(slot.address); } catch { clean = false; continue; }
    if (!view?.bound) continue;
    let body;
    // eslint-disable-next-line no-await-in-loop
    try { body = await readBody(slot.address); } catch { clean = false; continue; }
    if (!body) { clean = false; continue; }
    // eslint-disable-next-line no-await-in-loop
    const bytes = await openGroupsBlob(seed, body, chunkIndex);
    if (!bytes) { clean = false; continue; }
    entries.push(...parseGroupsRecovery(bytes));
  }
  return { entries, clean };
}
