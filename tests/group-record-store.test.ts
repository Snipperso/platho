import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  createGroupRecordStore, createLegacyGroupRecordSealKey, createMemoryGroupRecordStore, createSealedGroupRecordStore, groupRowTag,
  openGroupRecord, sealGroupRecord, sealLegacyGroupRecord,
} from '../web/group-record-store.mjs';
import { generateRandomAtRestKeys } from '../web/at-rest-seal.mjs';


const keysOf = async () => (await generateRandomAtRestKeys()).groups;

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
  it('GRS-01: a record round-trips through the sealed store, and what the backend holds names nothing — not even the room', async () => {
    const keys = await keysOf();
    const backend = mapBackend();
    await expect(Promise.resolve().then(() => createSealedGroupRecordStore({ key: 'x', backend } as any)), 'no store without the wallet\'s keys').rejects.toThrow(/at-rest keys/);
    const store = createSealedGroupRecordStore({ keys, backend });
    expect(store.type).toBe('sealed');
    await store.put(RECORD.groupId, RECORD);
    expect(await store.get(RECORD.groupId)).toEqual(RECORD);
    expect(await store.list()).toEqual([RECORD]);
    const tag = await groupRowTag(keys, RECORD.groupId);
    expect([...backend.rows.keys()], 'filed under the tag, not the room\'s id').toEqual([tag]);
    const blob = backend.rows.get(tag);
    expect(Object.keys(blob).sort()).toEqual(['n', 'v', 'x']);
    const stored = JSON.stringify([...backend.rows.entries()]);
    for (const secret of ['ef'.repeat(32), 'cd'.repeat(32), 'ab'.repeat(32), 'epochs', 'members', 'the room']) {
      expect(stored.includes(secret), `the store must not carry ${secret} in the clear`).toBe(false);
    }
    await store.put(RECORD.groupId, RECORD);
    const again = backend.rows.get(tag);
    expect(again.n).not.toBe(blob.n);
    expect(again.x).not.toBe(blob.x);
    await store.remove(RECORD.groupId);
    expect(await store.get(RECORD.groupId)).toBeNull();
  });

  it('GRS-02: a blob sealed under another wallet\'s keys opens to nothing; the store skips it and says so', async () => {
    const mine = await keysOf();
    const theirs = await keysOf();
    const backend = mapBackend();
    const theirTag = await groupRowTag(mine, RECORD.groupId);
    const otherTag = await groupRowTag(mine, 'other');
    backend.rows.set(theirTag, await sealGroupRecord(theirs, theirTag, RECORD));
    backend.rows.set(otherTag, await sealGroupRecord(mine, otherTag, { ...RECORD, groupId: 'other' }));
    const unreadable: string[] = [];
    const store = createSealedGroupRecordStore({ keys: mine, backend, onUnreadable: (id: string) => unreadable.push(id) });
    expect(await openGroupRecord(mine, theirTag, backend.rows.get(theirTag))).toBeNull();
    expect(await store.get(RECORD.groupId)).toBeNull();
    expect((await store.list()).map((r: any) => r.groupId)).toEqual(['other']);
    expect(unreadable).toEqual([theirTag, theirTag]);
    expect(await openGroupRecord(mine, 'x', RECORD as any)).toBeNull();
    expect(await openGroupRecord(mine, 'x', null)).toBeNull();
    backend.rows.set(RECORD.groupId, await sealLegacyGroupRecord(await createLegacyGroupRecordSealKey(), RECORD.groupId, RECORD));
    unreadable.length = 0;
    expect((await store.list()).map((r: any) => r.groupId)).toEqual(['other']);
    expect(unreadable).toEqual([theirTag]);
  });

  it('GRS-03: the tag is bound into the seal — a blob moved under another row does not open', async () => {
    const keys = await keysOf();
    const tag = await groupRowTag(keys, RECORD.groupId);
    const blob = await sealGroupRecord(keys, tag, RECORD);
    expect(await openGroupRecord(keys, tag, blob)).toEqual(RECORD);
    expect(await openGroupRecord(keys, await groupRowTag(keys, 'ff'.repeat(32)), blob)).toBeNull();
    const memory = createMemoryGroupRecordStore();
    await memory.put(RECORD.groupId, RECORD);
    expect(memory.type).toBe('memory');
    expect(await memory.get(RECORD.groupId)).toEqual(RECORD);
  });

  it('GRS-R6-01: a write that fails is heard, and what fell back is read back in the same session [audit 2026-09-23, round 6]', async () => {
    let fail = false;
    const stores = new Map<string, Map<string, any>>();
    const storeFor = (name: string) => { if (!stores.has(name)) stores.set(name, new Map()); return stores.get(name)!; };
    const request = (compute: () => any, transaction: any = null) => { const req: any = { onsuccess: null, onerror: null, result: undefined, error: null }; queueMicrotask(() => { try { req.result = compute(); req.onsuccess?.(); queueMicrotask(() => transaction?.oncomplete?.()); } catch (error) { req.error = error; req.onerror?.(); if (transaction) { transaction.error = error; queueMicrotask(() => transaction.onabort?.()); } } }); return req; };
    const objectStore = (name: string, transaction: any = null) => {
      const rows = storeFor(name);
      return {
        get: (id: string) => request(() => rows.get(id)),
        getAllKeys: () => request(() => [...rows.keys()]),
        getAll: () => request(() => [...rows.values()]),
        put: (blob: any, id?: string) => request(() => { if (fail && name === 'groups') throw new Error('QuotaExceededError'); const key = id === undefined ? blob.id : id; rows.set(key, blob); return key; }, transaction),
        delete: (id: string) => request(() => { rows.delete(id); }, transaction),
        clear: () => request(() => { rows.clear(); }, transaction),
      };
    };
    const indexedDB: any = {
      open() {
        const req: any = { onsuccess: null, onerror: null, onupgradeneeded: null, result: undefined };
        queueMicrotask(() => {
          req.result = { objectStoreNames: { contains: () => true }, createObjectStore: () => ({}), transaction: (name: string) => { const t: any = { oncomplete: null, onabort: null, onerror: null, error: null }; t.objectStore = () => objectStore(name, t); return t; } };
          req.onupgradeneeded?.();
          req.onsuccess?.();
        });
        return req;
      },
    };
    const keys = await keysOf();
    const store: any = await createGroupRecordStore({ dbName: 'grs-r6', indexedDB, keys });
    expect(store.type, 'the persistent, sealed form — not the memory fallback').toBe('sealed');
    await store.put('g1', { name: 'one' });
    fail = true;
    await expect(store.put('g2', { name: 'two' }), 'the failure reaches the caller').rejects.toThrow(/Quota/);
    const listed = await store.list();
    expect(listed.map((r: any) => r.name).sort(), 'and the room that could not be written is still read this session').toEqual(['one', 'two']);
    expect((await store.get('g2'))?.name).toBe('two');
    fail = false;
    await store.put('g2', { name: 'two again' });
    expect((await store.list()).map((r: any) => r.name).sort()).toEqual(['one', 'two again']);
    expect(storeFor('groups').has(await groupRowTag(keys, 'g2')), 'written through once the disk answers').toBe(true);
  });

  it('GRS-04: the rows of an older build move to the wallet\'s keys at the first open — filed under tags, the device key kept for its grace; a row this build wrote wins; one the device key cannot open goes', async () => {
    const factory = new IDBFactory();
    const legacyKey = await createLegacyGroupRecordSealKey();
    const open = (version: number) => new Promise<any>((resolve, reject) => {
      const request = factory.open('grs-move', version);
      request.onupgradeneeded = () => { const db = request.result; db.createObjectStore('groups'); db.createObjectStore('deviceKey', { keyPath: 'id' }); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const db = await open(2);
    const keys = await keysOf();
    const one = { ...RECORD, groupId: '01'.repeat(32), name: 'one' };
    const two = { ...RECORD, groupId: '02'.repeat(32), name: 'two (old)' };
    const lost = { ...RECORD, groupId: '03'.repeat(32), name: 'lost' };
    const twoTag = await groupRowTag(keys, two.groupId);
    const rows: Array<[string, any]> = [
      [one.groupId, await sealLegacyGroupRecord(legacyKey, one.groupId, one)],
      [two.groupId, await sealLegacyGroupRecord(legacyKey, two.groupId, two)],
      [twoTag, await sealGroupRecord(keys, twoTag, { ...two, name: 'two (this build)' })],
      [lost.groupId, await sealLegacyGroupRecord(await createLegacyGroupRecordSealKey(), lost.groupId, lost)],
    ];
    await new Promise<void>((resolve) => {
      const tx = db.transaction(['groups', 'deviceKey'], 'readwrite');
      for (const [id, blob] of rows) tx.objectStore('groups').put(blob, id);
      tx.objectStore('deviceKey').put({ id: 'device-group-key-v1', key: legacyKey });
      tx.oncomplete = () => resolve();
    });
    db.close();
    const store = await createGroupRecordStore({ dbName: 'grs-move', indexedDB: factory, keys });
    expect((await store.list()).map((r: any) => r.name).sort()).toEqual(['one', 'two (this build)']);
    const after = await open(2);
    const [ids, deviceRows] = await Promise.all([
      new Promise<any[]>((resolve) => { const r = after.transaction('groups').objectStore('groups').getAllKeys(); r.onsuccess = () => resolve(r.result); }),
      new Promise<any[]>((resolve) => { const r = after.transaction('deviceKey').objectStore('deviceKey').getAll(); r.onsuccess = () => resolve(r.result); }),
    ]);
    expect(ids.sort()).toEqual([await groupRowTag(keys, one.groupId), twoTag].sort());
    expect(ids, 'no room\'s id is a row key any more').not.toContain(lost.groupId);
    expect(deviceRows.map((r: any) => r.id).sort(), 'the device key stays for its grace').toEqual(['device-group-key-v1', 'legacy-key-retire-after']);
    after.close();
  });

});
