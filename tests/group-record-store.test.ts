import { describe, expect, it } from 'vitest';
import {
  createGroupRecordSealKey, createMemoryGroupRecordStore, createSealedGroupRecordStore, openGroupRecord, sealGroupRecord,
} from '../web/group-record-store.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE GROUP RECORD STORE SEALS AT REST [audit 2026-09-05, round 2]. A record holds the epoch keys of every day this
// device can read and the roster of the room; the CONV key store seals its K_roots under a device key, and this
// store wrote the same class of secret in the clear. These gates hold the seal: a round trip, ciphertext that says
// nothing, a foreign key that opens nothing, and a blob that cannot be re-filed under another room.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const RECORD = {
  groupId: 'ab'.repeat(32), name: 'the room', self: 'cd'.repeat(32), admins: ['cd'.repeat(32)],
  epochs: [{ epoch: 20716, generation: 0, key: 'ef'.repeat(32), read: true }],
  members: [{ groupKey: 'cd'.repeat(32), wallet: '0:' + '11'.repeat(32), keyId: 'k', name: 'me' }],
};

function mapBackend() {
  const rows = new Map<string, any>();
  return {
    rows,
    list: async () => [...rows.entries()].map(([id, blob]) => ({ id, blob })),
    get: async (id: string) => rows.get(id) ?? null,
    put: async (id: string, blob: any) => { rows.set(id, blob); },
    remove: async (id: string) => { rows.delete(id); },
    clear: async () => { rows.clear(); },
  };
}

describe('GROUP RECORD STORE — sealed at rest', () => {
  it('GRS-01: a record round-trips through the sealed store, and what the backend holds is ciphertext that names nothing', async () => {
    const key = await createGroupRecordSealKey();
    const backend = mapBackend();
    const store = createSealedGroupRecordStore({ key, backend });
    expect(store.type).toBe('sealed');
    await store.put(RECORD.groupId, RECORD);
    expect(await store.get(RECORD.groupId)).toEqual(RECORD);
    expect(await store.list()).toEqual([RECORD]);
    const blob = backend.rows.get(RECORD.groupId);
    expect(blob.alg).toBe('AES-256-GCM');
    expect(blob.nonce.length).toBe(12);
    const stored = new TextDecoder().decode(blob.ciphertext) + JSON.stringify({ ...blob, ciphertext: null, nonce: null });
    for (const secret of ['ef'.repeat(32), 'cd'.repeat(32), 'epochs', 'members', 'the room']) {
      expect(stored.includes(secret), `the blob must not carry ${secret} in the clear`).toBe(false);
    }
    // every write draws a fresh nonce, so two seals of one record never share bytes
    await store.put(RECORD.groupId, RECORD);
    const again = backend.rows.get(RECORD.groupId);
    expect(Buffer.from(again.nonce).equals(Buffer.from(blob.nonce))).toBe(false);
    expect(Buffer.from(again.ciphertext).equals(Buffer.from(blob.ciphertext))).toBe(false);
    await store.remove(RECORD.groupId);
    expect(await store.get(RECORD.groupId)).toBeNull();
  });

  it('GRS-02: a blob sealed under another device\'s key opens to nothing; the store skips it and says so', async () => {
    const mine = await createGroupRecordSealKey();
    const theirs = await createGroupRecordSealKey();
    const backend = mapBackend();
    backend.rows.set(RECORD.groupId, await sealGroupRecord(theirs, RECORD.groupId, RECORD));
    backend.rows.set('other', await sealGroupRecord(mine, 'other', { ...RECORD, groupId: 'other' }));
    const unreadable: string[] = [];
    const store = createSealedGroupRecordStore({ key: mine, backend, onUnreadable: (id: string) => unreadable.push(id) });
    expect(await openGroupRecord(mine, RECORD.groupId, backend.rows.get(RECORD.groupId))).toBeNull();
    expect(await store.get(RECORD.groupId)).toBeNull();
    expect((await store.list()).map((r: any) => r.groupId)).toEqual(['other']);
    expect(unreadable).toEqual([RECORD.groupId, RECORD.groupId]);
    // a blob of another shape (a plaintext row from before the seal) is not a record either
    expect(await openGroupRecord(mine, 'x', RECORD as any)).toBeNull();
    expect(await openGroupRecord(mine, 'x', null)).toBeNull();
  });

  it('GRS-03: the group id is bound into the seal — a blob moved under another id does not open', async () => {
    const key = await createGroupRecordSealKey();
    const blob = await sealGroupRecord(key, RECORD.groupId, RECORD);
    expect(await openGroupRecord(key, RECORD.groupId, blob)).toEqual(RECORD);
    expect(await openGroupRecord(key, 'ff'.repeat(32), blob)).toBeNull();
    // and the memory store — the tests' and the no-IndexedDB fallback — is untouched by any of this
    const memory = createMemoryGroupRecordStore();
    await memory.put(RECORD.groupId, RECORD);
    expect(memory.type).toBe('memory');
    expect(await memory.get(RECORD.groupId)).toEqual(RECORD);
  });
});
