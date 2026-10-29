import { readFileSync } from 'node:fs';
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
    expect(NOTES_NAMED_SLOT_BASE).toBe(PREFS_NAMED_SLOT_INDEX + 1);
    expect(NOTES_NAMED_SLOT_BASE).toBeGreaterThanOrEqual(RECOVERY_MAX_SLOTS);
    expect(NOTES_NAMED_SLOT_BASE + NOTES_NAMED_SLOT_COUNT).toBeLessThanOrEqual(RECOVERY_MAX_SLOTS + 16);
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
    expect((await notesChunkSlot(SEED, 3)).address).toBe((await notesChunkSlot(SEED, 3)).address);
    expect((await notesChunkSlot(OTHER_SEED, 3)).address).not.toBe((await notesChunkSlot(SEED, 3)).address);
    await expect(notesChunkSlot(SEED, NOTES_NAMED_SLOT_COUNT)).rejects.toThrow(/chunkIndex must be in/);
  });

  it('NOTES-03: a chunk sealed for slot k cannot be opened as slot j (the AAD binds the chunk index)', async () => {
    const bytes = serializeNotes([note(1_790_000_000_000, 'lifted from another slot')]);
    const { body } = await sealNotesBlob(SEED, bytes, 2);
    expect(await openNotesBlob(SEED, body, 2)).not.toBeNull();
    expect(await openNotesBlob(SEED, body, 3)).toBeNull();
    expect(await openNotesBlob(OTHER_SEED, body, 2)).toBeNull();
  });

  it('NOTES-04: a notes blob and a prefs blob are never cross-decryptable, even under the same seed', async () => {
    const notesBody = (await sealNotesBlob(SEED, serializeNotes([note(1, 'note')]), 0)).body;
    const prefsBody = (await sealPrefsBlob(SEED, new TextEncoder().encode('{"prefs":true}'))).body;
    expect(await openPrefsBlob(SEED, notesBody)).toBeNull();
    expect(await openNotesBlob(SEED, prefsBody, 0)).toBeNull();
  });

  it('NOTES-05: packing MEASURES each chunk against the on-chain cell cap, and never silently drops a note', async () => {
    const many = Array.from({ length: 300 }, (_, i) => note(1_790_000_000_000 + i, `note ${i} ${'x'.repeat(200)}`));
    const { chunks, overflow } = await packNotes(SEED, many);

    expect(chunks.length).toBeLessThanOrEqual(NOTES_NAMED_SLOT_COUNT);
    for (const [index, chunk] of chunks.entries()) {
      const { body } = await sealNotesBlob(SEED, serializeNotes(chunk), index);
      expect(countCells(body), `chunk ${index} must fit the contract cap`).toBeLessThanOrEqual(RS_MAX_BLOB_CELLS);
    }
    expect(chunks.flat().length + overflow.length).toBe(many.length);
    expect(overflow.length).toBeGreaterThan(0);
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
    expect(publishes.length).toBeGreaterThan(1);
    store.apply(publishes);

    const restored = await restoreNotes({ seed: SEED, readView: store.readView, readBody: store.readBody });
    expect(restored.clean).toBe(true);
    expect(restored.notes.map((n) => n.text)).toEqual(notes.map((n) => n.text));

    const foreign = await restoreNotes({ seed: OTHER_SEED, readView: store.readView, readBody: store.readBody });
    expect(foreign.notes).toEqual([]);
  });

  it('NOTES-09: an unchanged chunk is not republished; a changed one bumps its own seq', async () => {
    const store = slotStore();
    const notes = Array.from({ length: 40 }, (_, i) => note(1_790_000_000_000 + i, `note ${i} ${'b'.repeat(120)}`));

    const first = await prepareNotesBackup({ seed: SEED, notes, readView: store.readView, value: 1n });
    store.apply(first.publishes);
    expect(first.publishes.every((p) => p.seq === 1)).toBe(true);

    const idempotent = await prepareNotesBackup({ seed: SEED, notes, readView: store.readView, value: 1n });
    expect(idempotent.publishes).toEqual([]);

    const appended = [...notes, note(1_790_000_099_999, 'a new note')];
    const second = await prepareNotesBackup({ seed: SEED, notes: appended, readView: store.readView, value: 1n });
    expect(second.publishes).toHaveLength(1);
    expect(second.publishes[0].chunkIndex).toBe(first.publishes.length - 1);
    expect(second.publishes[0].seq).toBe(2);
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

  it('NOTES-13: the client routes a Saved-thread send to this lane and never to the CONV lane', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const dispatcher = app.slice(
      app.indexOf('async function attemptPrivateComposerMessagePublish'),
      app.indexOf('async function publishSelfNoteSnapshot'),
    );
    const divertIdx = dispatcher.indexOf('if (isRealSavedThread(context?.thread)) return publishSelfNoteSnapshot(context);');
    const convIdx = dispatcher.indexOf('return attemptConvMessagePublishDirect(context);');
    expect(divertIdx).toBeGreaterThan(-1);
    expect(convIdx).toBeGreaterThan(-1);
    expect(divertIdx).toBeLessThan(convIdx);

    expect(app).toMatch(/let selfNotesRestoreIncomplete = true;/);
    expect(app).toMatch(/if \(selfNotesRestoreIncomplete\) \{[\s\S]{0,240}?code = 'PLATHO_NOTES_RESTORE_INCOMPLETE'/);
    expect(app).toMatch(/selfNotesRestoreIncomplete = !clean;/);

    const fatal = app.slice(app.indexOf('function isFatalPrivateSendError'), app.indexOf('function isRecoverablePrivateSendError'));
    expect(fatal).toMatch(/code === 'PLATHO_NOTES_FULL'/);
    expect(fatal).toMatch(/code === 'PLATHO_NOTES_RESTORE_INCOMPLETE'/);

    expect(app).toMatch(/RECOVERY_PUBLISH_VALUE \* BigInt\(built\.publishes\.length\) \+ arrearTotal/);
    expect(app).toMatch(/\.\.\.arrears\.filter\(\(value\) => value > 0n\)\.map\(\(\) => 1\),\s*\n\s*\.\.\.built\.publishes\.map\(\(publish\) => capsuleSizeClassForUsefulBytes\(/);
    expect(app).toMatch(/if \(built\.publishes\.length === 0\) return \{ wrote: 0, readView, writes: \[\] \};/);
    expect(app).toMatch(/const outcome = await publishSelfNotesSnapshotForThread\(thread, owner\);[\s\S]{0,700}?markDirectSendBroadcast\(thread, message\);[^\n]*\n\s*armSelfNoteReceipt\(context, outcome\);/);
    expect(app).toMatch(/function armSelfNoteReceipt\(context, outcome\) \{[\s\S]{0,900}?markSelfNotePublished\(thread, message\)/);
    for (const key of ['notes.walletLocked', 'notes.rpcUnavailable', 'notes.full', 'notes.restoreIncomplete']) {
      expect(app.includes(`t('${key}')`), `${key} must be surfaced through the localizer`).toBe(true);
    }
  });

  it('NOTES-14: deleting a note removes it from BOTH copies, and puts it back if the chain write fails', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const store = readFileSync('web/encrypted-message-store.mjs', 'utf8');
    const del = app.slice(app.indexOf('async function deleteSelfNoteFromUi'), app.indexOf('async function retryPrivateMessageFromUi'));

    expect(app).toMatch(/if \(isRealSavedThread\(thread\)\) \{[\s\S]{0,600}?remove\.className = 'row-reply-button row-note-delete-button'/);
    expect(app).toMatch(/remove\.setAttribute\('aria-label', t\('notes\.delete'\)\)/);

    expect(del).toMatch(/if \(selfNotesRestoreIncomplete\) \{[\s\S]{0,120}?return; \}/);
    expect(del).toMatch(/const confirmed = await openActionDialog\([\s\S]{0,340}?if \(!confirmed\) return;/);

    expect(del).toMatch(/await publishSelfNotesSnapshotForThread\(thread, owner\);/);
    expect(del).toMatch(/await encryptedMessageStore\?\.deleteMessage\?\.\(deletedHistoryId\);/);
    expect(store).toMatch(/async deleteMessage\(id\) \{[\s\S]{0,160}?await backend\.remove\(String\(id\)\);/);
    expect(store).toMatch(/async remove\(id\) \{[\s\S]{0,120}?tx\.objectStore\(MESSAGE_STORE_NAME\)\.delete\(id\);/);
    expect(store).toMatch(/remove: async \(id\) => \{ records\.delete\(id\); \}/);

    expect(del).toMatch(/catch \(error\) \{[\s\S]{0,400}?insertThreadMessage\(thread, message\);/);

    expect(app).toMatch(/async function publishSelfNotesSnapshotForThread\(thread, owner = undefined\)/);
    expect((app.match(/await publishSelfNotesSnapshotForThread\(thread, owner\)/g) ?? []).length).toBe(3);
    expect((app.match(/publishSelfNotesSnapshotForThread\(thread\)/g) ?? []).length, 'none takes the wallet unlocked by its turn').toBe(0);
  });
});
