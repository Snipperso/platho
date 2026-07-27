import { describe, expect, it } from 'vitest';
import {
  deserializeNotes,
  mergeNotes,
  notesChunkSlot,
  packNotes,
  prepareNotesBackup,
  restoreNotes,
  serializeNotes,
} from '../web/notes-lane.mjs';
import { sealNotesBlob, openNotesBlob, sealPrefsBlob, openPrefsBlob } from '../web/recovery-blob.mjs';
import { NOTES_NAMED_SLOT_BASE, NOTES_NAMED_SLOT_COUNT, PREFS_NAMED_SLOT_INDEX, RECOVERY_MAX_SLOTS } from '../web/shard-discovery.mjs';

const SEED = new Uint8Array(32).fill(7);
const OTHER_SEED = new Uint8Array(32).fill(9);
const RS_MAX_BLOB_CELLS = 79;

function countCells(cell: any): number {
  let n = 0;
  let cur: any = cell;
  while (cur) { n += 1; cur = Array.isArray(cur.refs) && cur.refs.length > 0 ? cur.refs[0] : null; if (n > 4096) break; }
  return n;
}

const note = (at: number, text: string) => ({ at, text });

/** A stub RecoveryShard slot store: address -> { bound, seq, h1, body }. Mirrors what the real get_view/get_body give. */
function slotStore() {
  const rows = new Map<string, { bound: boolean; seq: number; h1: bigint; body: any }>();
  return {
    rows,
    readView: async (address: string) => rows.get(address) ?? { bound: false },
    readBody: async (address: string) => rows.get(address)?.body ?? null,
    apply: (publishes: any[]) => {
      for (const p of publishes) rows.set(p.slotAddress, { bound: true, seq: p.seq, h1: BigInt(p.h1), body: p.blob });
    },
  };
}

describe('self-notes lane (named RecoveryShard slots)', () => {
  it('NOTES-01: the notes range is disjoint from prefs and from every conversation slot', () => {
    // Conversations hash into [0, RECOVERY_MAX_SLOTS); prefs took the first named slot; notes take the next eight.
    // An overlap would make two different self-data types share an address and silently overwrite each other.
    expect(NOTES_NAMED_SLOT_BASE).toBe(PREFS_NAMED_SLOT_INDEX + 1);
    expect(NOTES_NAMED_SLOT_BASE).toBeGreaterThanOrEqual(RECOVERY_MAX_SLOTS);
    expect(NOTES_NAMED_SLOT_BASE + NOTES_NAMED_SLOT_COUNT).toBeLessThanOrEqual(RECOVERY_MAX_SLOTS + 16);
    // Room is deliberately left for the next durable-self type.
    expect(NOTES_NAMED_SLOT_BASE + NOTES_NAMED_SLOT_COUNT).toBeLessThan(RECOVERY_MAX_SLOTS + 16);
  });

  it('NOTES-02: every chunk gets a distinct deterministic address from the seed alone', async () => {
    const seen = new Set<string>();
    for (let i = 0; i < NOTES_NAMED_SLOT_COUNT; i += 1) {
      const slot = await notesChunkSlot(SEED, i);
      expect(slot.slotIndex).toBe(NOTES_NAMED_SLOT_BASE + i);
      seen.add(slot.address);
    }
    expect(seen.size).toBe(NOTES_NAMED_SLOT_COUNT);
    // Same seed, same address — this is what makes a fresh device find its notes with no enumeration.
    expect((await notesChunkSlot(SEED, 3)).address).toBe((await notesChunkSlot(SEED, 3)).address);
    // A different seed lands somewhere else entirely.
    expect((await notesChunkSlot(OTHER_SEED, 3)).address).not.toBe((await notesChunkSlot(SEED, 3)).address);
    await expect(notesChunkSlot(SEED, NOTES_NAMED_SLOT_COUNT)).rejects.toThrow(/chunkIndex must be in/);
  });

  it('NOTES-03: a chunk sealed for slot k cannot be opened as slot j (the AAD binds the chunk index)', async () => {
    const bytes = serializeNotes([note(1_790_000_000_000, 'lifted from another slot')]);
    const { body } = await sealNotesBlob(SEED, bytes, 2);
    expect(await openNotesBlob(SEED, body, 2)).not.toBeNull();
    // Replayed into a different slot of the same range: refused, so the note history cannot be silently permuted.
    expect(await openNotesBlob(SEED, body, 3)).toBeNull();
    // Wrong seed: refused on the GCM tag.
    expect(await openNotesBlob(OTHER_SEED, body, 2)).toBeNull();
  });

  it('NOTES-04: a notes blob and a prefs blob are never cross-decryptable, even under the same seed', async () => {
    const notesBody = (await sealNotesBlob(SEED, serializeNotes([note(1, 'note')]), 0)).body;
    const prefsBody = (await sealPrefsBlob(SEED, new TextEncoder().encode('{"prefs":true}'))).body;
    expect(await openPrefsBlob(SEED, notesBody)).toBeNull();
    expect(await openNotesBlob(SEED, prefsBody, 0)).toBeNull();
  });

  it('NOTES-05: packing MEASURES each chunk against the on-chain cell cap, and never silently drops a note', async () => {
    // 300 tweet-length notes is far past one slot and past the whole range — the point is that the excess surfaces
    // as `overflow` rather than vanishing, and that every emitted chunk really fits gate 13560.
    const many = Array.from({ length: 300 }, (_, i) => note(1_790_000_000_000 + i, `note ${i} ${'x'.repeat(200)}`));
    const { chunks, overflow } = await packNotes(SEED, many);

    expect(chunks.length).toBeLessThanOrEqual(NOTES_NAMED_SLOT_COUNT);
    for (const [index, chunk] of chunks.entries()) {
      const { body } = await sealNotesBlob(SEED, serializeNotes(chunk), index);
      expect(countCells(body), `chunk ${index} must fit the contract cap`).toBeLessThanOrEqual(RS_MAX_BLOB_CELLS);
    }
    // Nothing invented, nothing lost: packed + overflowed accounts for every note exactly once.
    expect(chunks.flat().length + overflow.length).toBe(many.length);
    expect(overflow.length).toBeGreaterThan(0);
    // Order is preserved oldest-first across chunk boundaries.
    const packed = chunks.flat();
    expect(packed.map((n) => n.text)).toEqual(many.slice(0, packed.length).map((n) => n.text));
  });

  it('NOTES-06: a single note too large for an empty chunk overflows instead of looping forever', async () => {
    const huge = note(1_790_000_000_000, 'y'.repeat(20_000));
    const { chunks, overflow } = await packNotes(SEED, [note(1, 'small'), huge, note(3, 'also small')]);
    expect(overflow).toHaveLength(1);
    expect(overflow[0].text).toBe(huge.text);
    expect(chunks.flat().map((n) => n.text)).toEqual(['small', 'also small']);
  });

  it('NOTES-07: a full notepad REFUSES the write (a silent drop is the failure this lane exists to prevent)', async () => {
    const many = Array.from({ length: 400 }, (_, i) => note(1_790_000_000_000 + i, `note ${i} ${'z'.repeat(200)}`));
    const store = slotStore();
    await expect(prepareNotesBackup({ seed: SEED, notes: many, readView: store.readView, value: 1n }))
      .rejects.toMatchObject({ code: 'PLATHO_NOTES_FULL' });
  });

  it('NOTES-08: notes written on one device restore on another that has only the seed', async () => {
    const store = slotStore();
    const notes = Array.from({ length: 60 }, (_, i) => note(1_790_000_000_000 + i, `note ${i} ${'a'.repeat(120)}`));

    const { publishes } = await prepareNotesBackup({ seed: SEED, notes, readView: store.readView, value: 1n });
    expect(publishes.length).toBeGreaterThan(1);   // 60 x ~140 chars does not fit one slot — the range is doing work
    store.apply(publishes);

    const restored = await restoreNotes({ seed: SEED, readView: store.readView, readBody: store.readBody });
    expect(restored.clean).toBe(true);
    expect(restored.notes.map((n) => n.text)).toEqual(notes.map((n) => n.text));

    // A different seed sees the same addresses as unbound (they are derived from ITS seed) — no cross-user leak.
    const foreign = await restoreNotes({ seed: OTHER_SEED, readView: store.readView, readBody: store.readBody });
    expect(foreign.notes).toEqual([]);
  });

  it('NOTES-09: an unchanged chunk is not republished; a changed one bumps its own seq', async () => {
    const store = slotStore();
    const notes = Array.from({ length: 40 }, (_, i) => note(1_790_000_000_000 + i, `note ${i} ${'b'.repeat(120)}`));

    const first = await prepareNotesBackup({ seed: SEED, notes, readView: store.readView, value: 1n });
    store.apply(first.publishes);
    expect(first.publishes.every((p) => p.seq === 1)).toBe(true);

    // Re-backing-up the SAME notes must cost nothing.
    const idempotent = await prepareNotesBackup({ seed: SEED, notes, readView: store.readView, value: 1n });
    expect(idempotent.publishes).toEqual([]);

    // Appending one note rewrites only the LAST chunk (the earlier ones are byte-identical).
    const appended = [...notes, note(1_790_000_099_999, 'a new note')];
    const second = await prepareNotesBackup({ seed: SEED, notes: appended, readView: store.readView, value: 1n });
    expect(second.publishes).toHaveLength(1);
    expect(second.publishes[0].chunkIndex).toBe(first.publishes.length - 1);
    expect(second.publishes[0].seq).toBe(2);   // anti-rollback: strictly above what the slot already stores
  });

  it('NOTES-10: a read that fails marks the restore UNCLEAN rather than reporting an empty notepad', async () => {
    const store = slotStore();
    const notes = Array.from({ length: 40 }, (_, i) => note(1_790_000_000_000 + i, `note ${i} ${'c'.repeat(120)}`));
    store.apply((await prepareNotesBackup({ seed: SEED, notes, readView: store.readView, value: 1n })).publishes);

    const failingBody = async (address: string) => {
      if (address === (await notesChunkSlot(SEED, 0)).address) throw new Error('rpc down');
      return store.readBody(address);
    };
    const restored = await restoreNotes({ seed: SEED, readView: store.readView, readBody: failingBody });
    expect(restored.clean).toBe(false);
    // The caller is told the picture is partial, so it must not publish a snapshot built from it — that would
    // overwrite the chunk this pass could not see.
    expect(restored.notes.length).toBeLessThan(notes.length);
  });

  it('NOTES-11: serialize/deserialize round-trips, and a corrupt chunk degrades to empty instead of throwing', () => {
    const notes = [note(1_790_000_000_000, 'hello'), note(1_790_000_000_001, 'ключ 🔑 unicode')];
    expect(deserializeNotes(serializeNotes(notes))).toEqual(notes);
    expect(deserializeNotes(new TextEncoder().encode('not json at all'))).toEqual([]);
    expect(deserializeNotes(new TextEncoder().encode('{"not":"an array"}'))).toEqual([]);
  });

  it('NOTES-12: merging local and restored notes is idempotent and keeps chronological order', () => {
    const local = [note(3, 'third'), note(1, 'first')];
    const restored = [note(1, 'first'), note(2, 'second')];
    const merged = mergeNotes(local, restored);
    expect(merged.map((n) => n.text)).toEqual(['first', 'second', 'third']);
    expect(mergeNotes(merged, restored)).toEqual(merged);
  });
});
