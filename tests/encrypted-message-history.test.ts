import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDBCursor, IDBDatabase, IDBFactory, IDBIndex, IDBKeyRange, IDBObjectStore } from 'fake-indexeddb';
import {
  DEFAULT_MESSAGE_HISTORY_MAX_PER_THREAD,
  MESSAGE_HISTORY_DB_VERSION,
  createIndexedDbEncryptedMessageHistoryStore,
  createMemoryEncryptedMessageHistoryStore,
  openMessageHistoryRecord,
  sealLegacyMessageHistoryRecord,
  sealMessageHistoryRecord,
} from '../web/encrypted-message-store.mjs';
import { deriveAtRestKeys, generateRandomAtRestKeys } from '../web/at-rest-seal.mjs';

const NOW = Date.UTC(2026, 0, 2, 9, 30, 0);
const PEER = 'dm:wallet_address:UQAAexampleAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEXMP';

async function historyKeys() {
  return (await generateRandomAtRestKeys()).history;
}
async function deviceKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

describe('encrypted local message history', () => {
  it('HISTORY-01: stores message plaintext only inside encrypted records — and no record names its conversation, its moment, its capsule or its direction', async () => {
    const store = await createMemoryEncryptedMessageHistoryStore();
    await store.putMessage({
      threadId: PEER,
      createdAt: NOW,
      thread: {
        id: PEER,
        name: 'Alice',
        subtitle: 'Wallet address',
        identityVariants: [{ type: 'wallet_address', value: '0:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', label: 'Alice wallet' }],
      },
      message: {
        type: 'out',
        text: 'local history secret',
        meta: 'hybrid-v1 capsule export',
        capsule: { id: 'capsule-alpha' },
      },
    });

    const rows = store.dumpEncryptedRecords();
    const raw = JSON.stringify(rows);
    const restored = await store.listMessages({ threadId: PEER });

    for (const clear of ['local history secret', 'hybrid-v1 capsule export', 'Alice', PEER, 'UQAAexample', 'capsule-alpha', String(NOW), '"out"', '"in"', 'threadId', 'createdAt', 'capsuleId']) {
      expect(raw, `a stored row carries ${clear}`).not.toContain(clear);
    }
    expect(Object.keys(rows[0]).sort()).toEqual(['c', 'id', 'n', 'o', 't', 'v', 'x']);
    expect(Buffer.from(rows[0].x, 'base64url').length % 256, 'the plaintext is padded to a multiple of 256 (+16 tag)').toBe(16);
    expect(restored).toHaveLength(1);
    expect(restored[0].message.text).toBe('local history secret');
    expect(restored[0].threadId).toBe(PEER);
    expect(restored[0].type).toBe('out');
    expect(restored[0].capsuleId).toBe('capsule-alpha');
    expect(restored[0].thread.name).toBe('Alice');
  });

  it('HISTORY-02: the conversation and capsule tags are bound — a row moved to another conversation or capsule does not open', async () => {
    const keys = await historyKeys();
    const record = await sealMessageHistoryRecord(keys, {
      id: 'record-alpha', threadId: 'thread-alpha', createdAt: NOW,
      message: { type: 'in', text: 'tamper sensitive', capsule: { id: 'cap-1' } },
    });
    const other = await sealMessageHistoryRecord(keys, { id: 'record-beta', threadId: 'thread-beta', createdAt: NOW, message: { type: 'in', text: 'x', capsule: { id: 'cap-2' } } });
    expect((await openMessageHistoryRecord(keys, record)).message.text).toBe('tamper sensitive');
    await expect(openMessageHistoryRecord(keys, { ...record, t: other.t }), 'refiled under another conversation').rejects.toThrow();
    await expect(openMessageHistoryRecord(keys, { ...record, c: other.c }), 'refiled under another capsule').rejects.toThrow();
    await expect(openMessageHistoryRecord(keys, { ...record, id: 'record-gamma' }), 'renamed').rejects.toThrow();
    expect((await openMessageHistoryRecord(keys, { ...record, o: 42 })).message.text).toBe('tamper sensitive');
  });

  it('HISTORY-03: authenticated ciphertext detects encrypted body tampering, and another wallet\'s keys open nothing', async () => {
    const keys = await historyKeys();
    const record = await sealMessageHistoryRecord(keys, { id: 'record-beta', threadId: 'thread-alpha', createdAt: NOW, message: { type: 'out', text: 'ciphertext sensitive' } });
    const tamperedCiphertext = Buffer.from(record.x, 'base64url');
    tamperedCiphertext[tamperedCiphertext.length - 1] ^= 0x01;
    await expect(openMessageHistoryRecord(keys, { ...record, x: tamperedCiphertext.toString('base64url') })).rejects.toThrow();
    await expect(openMessageHistoryRecord(await historyKeys(), record)).rejects.toThrow();
  });

  it('HISTORY-04: prunes old encrypted records per CONVERSATION, not across the app', async () => {
    const store = await createMemoryEncryptedMessageHistoryStore({ maxPerThread: 2 });
    await store.putMessage({ threadId: 'thread-alpha', createdAt: NOW, message: { type: 'out', text: 'oldest', meta: 'sealed' } });
    await store.putMessage({ threadId: 'thread-alpha', createdAt: NOW + 1, message: { type: 'out', text: 'middle', meta: 'sealed' } });
    await store.putMessage({ threadId: 'thread-alpha', createdAt: NOW + 2, message: { type: 'out', text: 'newest', meta: 'sealed' } });

    const restored = await store.listMessages({ threadId: 'thread-alpha' });

    expect(restored.map((record) => record.message.text)).toEqual(['middle', 'newest']);
    expect(store.dumpEncryptedRecords()).toHaveLength(2);
    expect(store.maxPerThread).toBe(2);
    expect(store.persistent).toBe(false);
  });

  it('HISTORY-04B: a busy conversation cannot evict a quiet one', async () => {
    const store = await createMemoryEncryptedMessageHistoryStore({ maxPerThread: 2 });
    await store.putMessage({ threadId: 'quiet', createdAt: NOW, message: { type: 'in', text: 'the only quiet one' } });
    for (let i = 0; i < 10; i += 1) {
      await store.putMessage({ threadId: 'busy', createdAt: NOW + 10 + i, message: { type: 'out', text: `busy ${i}` } });
    }

    const quiet = await store.listMessages({ threadId: 'quiet' });
    expect(quiet.map((r) => r.message.text), 'ten messages elsewhere must not touch this thread')
      .toEqual(['the only quiet one']);
    expect((await store.listMessages({ threadId: 'busy' })).map((r) => r.message.text)).toEqual(['busy 8', 'busy 9']);
  });

  it('HISTORY-04C: a window reads the NEWEST n and pages back from there — by the page\'s cursor, or by a time', async () => {
    const store = await createMemoryEncryptedMessageHistoryStore({ maxPerThread: 50 });
    for (let i = 0; i < 20; i += 1) {
      await store.putMessage({ threadId: 't', createdAt: NOW + i, message: { type: 'in', text: `m${i}` } });
    }

    const newest = await store.listMessagesDetailed({ threadId: 't', limit: 5 });
    expect(newest.messages.map((r: any) => r.message.text)).toEqual(['m15', 'm16', 'm17', 'm18', 'm19']);

    const byCursor = await store.listMessagesDetailed({ threadId: 't', limit: 5, beforeId: newest.cursor });
    expect(byCursor.messages.map((r: any) => r.message.text)).toEqual(['m10', 'm11', 'm12', 'm13', 'm14']);
    const byTime = await store.listMessages({ threadId: 't', limit: 5, before: newest.messages[0].createdAt });
    expect(byTime.map((r) => r.message.text)).toEqual(['m10', 'm11', 'm12', 'm13', 'm14']);
    await store.deleteMessage(newest.cursor);
    const gone = await store.listMessages({ threadId: 't', limit: 5, beforeId: newest.cursor, before: newest.messages[0].createdAt });
    expect(gone.map((r) => r.message.text)).toEqual(['m10', 'm11', 'm12', 'm13', 'm14']);
  });

  it('HISTORY-04D: headers carry every capsule id and no message body — opened, never stored that way', async () => {
    const store = await createMemoryEncryptedMessageHistoryStore();
    await store.putMessage({
      threadId: 't', createdAt: NOW, message: { type: 'in', text: 'secret body', capsule: { id: 'capsule-7' } },
    });

    const headers = await store.listMessageHeaders();
    expect(headers).toHaveLength(1);
    expect(headers[0].capsuleId).toBe('capsule-7');
    expect(headers[0].threadId).toBe('t');
    expect(JSON.stringify(headers), 'a header must never carry the message body').not.toContain('secret body');
    expect(await store.hasCapsule('capsule-7')).toBe(true);
  });

  it('HISTORY-05: exposes the default local history retention envelope', async () => {
    const store = await createMemoryEncryptedMessageHistoryStore();

    expect(DEFAULT_MESSAGE_HISTORY_MAX_PER_THREAD).toBe(2000);
    expect(store.maxPerThread).toBe(2000);
    expect(store.persistent).toBe(false);
  });

  it('HISTORY-06: one corrupt encrypted record is quarantined without blocking valid history', async () => {
    const keys = await historyKeys();
    const store = await createMemoryEncryptedMessageHistoryStore({ keys });
    const records = [];
    for (const [index, text] of ['one', 'two', 'three'].entries()) {
      records.push(await sealMessageHistoryRecord(keys, { id: `record-${text}`, threadId: 'thread-alpha', createdAt: NOW + index, message: { type: 'in', text } }, { order: index }));
    }
    const firstCiphertextChar = records[1].x[0] === 'A' ? 'B' : 'A';
    const corrupt = { ...records[1], x: `${firstCiphertextChar}${records[1].x.slice(1)}` };
    store.replaceEncryptedRecords([records[0], corrupt, records[2]]);

    const detailed = await store.listMessagesDetailed({ threadId: 'thread-alpha' });
    const restored = await store.listMessages({ threadId: 'thread-alpha' });

    expect(detailed.messages.map((record: any) => record.message.text)).toEqual(['one', 'three']);
    expect(detailed.failed).toHaveLength(1);
    expect(detailed.failed[0]).toMatchObject({ id: 'record-two', threadId: null });
    expect(restored.map((record) => record.message.text)).toEqual(['one', 'three']);
  });


  const idb = () => ({ indexedDB: new IDBFactory(), IDBKeyRange });
  const openRaw = (factory: IDBFactory, name: string, version?: number, upgrade?: (db: IDBDatabase, tx: IDBTransaction) => void) => new Promise<IDBDatabase>((resolve, reject) => {
    const request = version === undefined ? factory.open(name) : factory.open(name, version);
    request.onupgradeneeded = () => upgrade?.(request.result, request.transaction!);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const done = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
  const rawRows = async (factory: IDBFactory, name: string, store = 'encryptedMessages') => {
    const db = await openRaw(factory, name);
    const rows = await new Promise<any[]>((resolve) => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => resolve(r.result); });
    db.close();
    return rows;
  };
  const fill = async (store: any, threadId: string, n: number, { from = NOW, step = 1000, outEvery = 3 }: { from?: number; step?: number; outEvery?: number } = {}) => {
    for (let i = 0; i < n; i += 1) {
      const type = i % outEvery === 0 ? 'out' : 'in';
      await store.putMessage({ threadId, createdAt: from + i * step, message: { type, text: `${threadId} #${i}`, ...(type === 'in' ? { capsule: { id: `cap-${threadId}-${i}` } } : {}) } });
    }
  };
  afterEach(() => { vi.restoreAllMocks(); });

  it('HISTORY-07: the persistent store opens at version 4 — the sealed pair of indexes, and the v3 pair the move reads by', async () => {
    const env = idb();
    await expect(createIndexedDbEncryptedMessageHistoryStore({ dbName: 'h07x', ...env }), 'no store without the wallet\'s keys').rejects.toThrow(/at-rest keys/);
    const store = await createIndexedDbEncryptedMessageHistoryStore({ dbName: 'h07', keys: await historyKeys(), ...env });
    expect(store.type).toBe('indexeddb');
    expect(store.persistent).toBe(true);
    const db = await openRaw(env.indexedDB, 'h07');
    expect(db.version).toBe(MESSAGE_HISTORY_DB_VERSION);
    expect(MESSAGE_HISTORY_DB_VERSION).toBe(4);
    const messages = db.transaction('encryptedMessages').objectStore('encryptedMessages');
    expect([...messages.indexNames].sort()).toEqual(['capTag', 'capsuleId', 'convOrder', 'threadCreated']);
    expect(messages.index('convOrder').keyPath).toEqual(['t', 'o']);
    expect(messages.index('capTag').keyPath).toBe('c');
    db.close();
  });

  it('HISTORY-08: a v3 database — legacy records under a device key — moves to the wallet\'s keys at the first open: nothing lost, every read served, the device key gone, nothing in clear', async () => {
    const env = idb();
    const legacyKey = await deviceKey();
    const v3 = await openRaw(env.indexedDB, 'h08', 3, (db) => {
      db.createObjectStore('historyKeys', { keyPath: 'id' });
      const s = db.createObjectStore('encryptedMessages', { keyPath: 'id' });
      s.createIndex('threadCreated', ['threadId', 'createdAt']);
      s.createIndex('capsuleId', 'capsuleId');
    });
    const sealed = [];
    for (const thread of ['dm:wallet_address:alpha', 'dm:platho_nft:beta.ath', 'group:gamma']) {
      for (let i = 39; i >= 0; i -= 1) {
        const type = i % 4 === 0 ? 'out' : 'in';
        sealed.push(await sealLegacyMessageHistoryRecord(legacyKey, { id: crypto.randomUUID(), threadId: thread, createdAt: NOW + i * 60_000, message: { type, text: `${thread} ${i}`, ...(type === 'in' ? { capsule: { id: `cap-${thread}-${i}` } } : {}) } }));
      }
    }
    {
      const tx = v3.transaction(['historyKeys', 'encryptedMessages'], 'readwrite');
      tx.objectStore('historyKeys').put({ id: 'device-history-key-v1', key: legacyKey, createdAt: NOW });
      const s = tx.objectStore('encryptedMessages');
      for (const record of sealed) s.put(record);
      await done(tx);
    }
    v3.close();
    const keys = await historyKeys();
    const progress: any[] = [];
    const store = await createIndexedDbEncryptedMessageHistoryStore({ dbName: 'h08', keys, ...env, onMigrationProgress: (p: any) => progress.push(p) });
    expect((store as any).migration).toMatchObject({ conversations: 3, moved: 120, unreadable: 0, failed: 0, keyRetired: true });
    expect(progress.map((p) => p.moved)).toEqual([40, 80, 120]);
    const rows = await rawRows(env.indexedDB, 'h08');
    expect(rows, 'not a record lost, none doubled').toHaveLength(120);
    expect(new Set(rows.map((r) => r.id))).toEqual(new Set(sealed.map((r) => r.id)));
    const text = JSON.stringify(rows);
    for (const clear of ['alpha', 'beta.ath', 'gamma', 'cap-', String(NOW).slice(0, 7), 'threadId', 'createdAt']) expect(text, `the moved rows carry ${clear}`).not.toContain(clear);
    const keyRows = await rawRows(env.indexedDB, 'h08', 'historyKeys');
    expect(keyRows.filter((row: any) => !String(row.id).startsWith('headers-rewritten')), 'the device key is gone with the last record it opened').toEqual([]);
    expect(keyRows.map((row: any) => row.id)).toEqual(['headers-rewritten-v1']);
    for (const thread of ['dm:wallet_address:alpha', 'dm:platho_nft:beta.ath', 'group:gamma']) {
      const all = await store.listMessagesDetailed({ threadId: thread });
      expect(all.failed).toEqual([]);
      expect(all.messages.map((m: any) => m.message.text)).toEqual(Array.from({ length: 40 }, (_, i) => `${thread} ${i}`));
    }
    const summaries = await store.listThreadSummaries();
    expect(summaries.map((s: any) => [s.threadId, s.count, s.newestCreatedAt]).sort()).toEqual([
      ['dm:platho_nft:beta.ath', 40, NOW + 39 * 60_000], ['dm:wallet_address:alpha', 40, NOW + 39 * 60_000], ['group:gamma', 40, NOW + 39 * 60_000],
    ]);
    expect(await store.hasCapsule('cap-dm:platho_nft:beta.ath-7'), 'a capsule stored the old way is found through the tag').toBe(true);
    expect(await store.hasOwnSendNear('group:gamma', NOW + 8 * 60_000 + 2_000, 5_000), 'and an own record by its moment').toBe(true);
    const window = await store.listMessagesDetailed({ threadId: 'dm:wallet_address:alpha', limit: 5 });
    expect(window.messages.map((m: any) => m.message.text)).toEqual([35, 36, 37, 38, 39].map((i) => `dm:wallet_address:alpha ${i}`));
    const again = await createIndexedDbEncryptedMessageHistoryStore({ dbName: 'h08', keys, ...env });
    expect((again as any).migration).toMatchObject({ conversations: 0, moved: 0, keyRetired: false });
    expect((await again.listMessages({ threadId: 'group:gamma', limit: 1 }))[0].message.text).toBe('group:gamma 39');
  });

  it('HISTORY-08B: a legacy record the device key cannot open goes — it never will open, and its header named the peer, the moment and the capsule — and the key with it; so does a legacy record with no key at all [round 13 — atrest-5]', async () => {
    const env = idb();
    const legacyKey = await deviceKey();
    const v3 = await openRaw(env.indexedDB, 'h08b', 3, (db) => {
      db.createObjectStore('historyKeys', { keyPath: 'id' });
      const s = db.createObjectStore('encryptedMessages', { keyPath: 'id' });
      s.createIndex('threadCreated', ['threadId', 'createdAt']);
      s.createIndex('capsuleId', 'capsuleId');
    });
    const good = await sealLegacyMessageHistoryRecord(legacyKey, { id: 'good', threadId: 't', createdAt: NOW, message: { type: 'in', text: 'kept' } });
    const bad = await sealLegacyMessageHistoryRecord(await deviceKey(), { id: 'bad', threadId: 't', createdAt: NOW + 1, message: { type: 'in', text: 'lost long ago' } });
    {
      const tx = v3.transaction(['historyKeys', 'encryptedMessages'], 'readwrite');
      tx.objectStore('historyKeys').put({ id: 'device-history-key-v1', key: legacyKey, createdAt: NOW });
      tx.objectStore('encryptedMessages').put(good);
      tx.objectStore('encryptedMessages').put(bad);
      await done(tx);
    }
    v3.close();
    const keys = await historyKeys();
    const store = await createIndexedDbEncryptedMessageHistoryStore({ dbName: 'h08b', keys, ...env });
    expect((store as any).migration).toMatchObject({ moved: 1, unreadable: 1, keyRetired: true });
    expect((await store.listMessages({ threadId: 't' })).map((m) => m.message.text)).toEqual(['kept']);
    expect((await rawRows(env.indexedDB, 'h08b', 'historyKeys')).map((r) => r.id)).toEqual(['headers-rewritten-v1']);
    const rows = await rawRows(env.indexedDB, 'h08b');
    expect(rows.find((r) => r.id === 'bad'), 'MEASURED before: kept for good, its clear header with it').toBeUndefined();
    expect(rows.filter((r) => r.threadId !== undefined), 'nothing on disk names the conversation').toEqual([]);
    const env2 = idb();
    const v3b = await openRaw(env2.indexedDB, 'h08c', 3, (db) => {
      db.createObjectStore('historyKeys', { keyPath: 'id' });
      const s = db.createObjectStore('encryptedMessages', { keyPath: 'id' });
      s.createIndex('threadCreated', ['threadId', 'createdAt']);
      s.createIndex('capsuleId', 'capsuleId');
    });
    { const tx = v3b.transaction('encryptedMessages', 'readwrite'); tx.objectStore('encryptedMessages').put(good); await done(tx); }
    v3b.close();
    const keyless = await createIndexedDbEncryptedMessageHistoryStore({ dbName: 'h08c', keys, ...env2 });
    expect((keyless as any).migration).toMatchObject({ moved: 0, unreadable: 1, keyRetired: false });
    expect(await keyless.listMessages({ threadId: 't' })).toEqual([]);
    expect(await rawRows(env2.indexedDB, 'h08c')).toEqual([]);
  });

  it('HISTORY-09: a window is walked off the order index from its newest end — the conversation is never read whole', async () => {
    const env = idb();
    const store = await createIndexedDbEncryptedMessageHistoryStore({ dbName: 'h09', keys: await historyKeys(), maxPerThread: 1000, ...env });
    await fill(store, 't', 300);
    await fill(store, 'other', 20, { from: NOW + 10 ** 9 });
    const storeGetAll = vi.spyOn(IDBObjectStore.prototype, 'getAll');
    const indexGetAll = vi.spyOn(IDBIndex.prototype, 'getAll');
    const indexGetAllKeys = vi.spyOn(IDBIndex.prototype, 'getAllKeys');
    const newest = await store.listMessagesDetailed({ threadId: 't', limit: 96 });
    expect(newest.messages.map((m: any) => m.message.text)).toEqual(Array.from({ length: 96 }, (_, i) => `t #${204 + i}`));
    const older = await store.listMessagesDetailed({ threadId: 't', limit: 96, beforeId: newest.cursor });
    expect(older.messages.map((m: any) => m.message.text)).toEqual(Array.from({ length: 96 }, (_, i) => `t #${108 + i}`));
    expect(storeGetAll, 'a windowed read never reads the store').not.toHaveBeenCalled();
    expect(indexGetAll, 'nor the conversation').not.toHaveBeenCalled();
    expect(indexGetAllKeys, 'a page by its cursor needs no search').not.toHaveBeenCalled();
    const byTime = await store.listMessagesDetailed({ threadId: 't', limit: 96, before: newest.messages[0].createdAt });
    expect(byTime.messages.map((m: any) => m.message.text)).toEqual(older.messages.map((m: any) => m.message.text));
    expect(byTime.messages.at(-1)!.createdAt, '`before` is exclusive: the boundary record belongs to the page above').toBeLessThan(newest.messages[0].createdAt);
    const last = await store.listMessagesDetailed({ threadId: 't', limit: 96, before: NOW + 12 * 1000 });
    expect(last.messages.map((m: any) => m.message.text), 'the oldest page is shorter, and the page before nothing is empty').toEqual(Array.from({ length: 12 }, (_, i) => `t #${i}`));
    expect((await store.listMessagesDetailed({ threadId: 't', limit: 96, before: NOW })).messages).toEqual([]);
    expect((await store.listMessagesDetailed({ threadId: 't', limit: 0 })).messages).toEqual([]);
    expect(storeGetAll).not.toHaveBeenCalled();
    const whole = await store.listMessagesDetailed({ threadId: 'other' });
    expect(whole.messages.map((m: any) => m.message.text)).toEqual(Array.from({ length: 20 }, (_, i) => `other #${i}`));
  });

  it('HISTORY-10: the two arrival-time questions are answered exactly — by the capsule tag, and by the time order', async () => {
    const env = idb();
    const store = await createIndexedDbEncryptedMessageHistoryStore({ dbName: 'h10', keys: await historyKeys(), ...env });
    await store.putMessage({ threadId: 'a', createdAt: NOW, message: { type: 'in', text: 'in', capsule: { id: 'cap-in' } } });
    await store.putMessage({ threadId: 'a', createdAt: NOW + 10_000, message: { type: 'out', text: 'mine' } });
    await store.putMessage({ threadId: 'b', createdAt: NOW + 10_000, message: { type: 'out', text: 'mine elsewhere' } });
    await store.putMessage({ threadId: 'a', createdAt: NOW + 30_000, message: { type: 'in', text: 'theirs at the same moment as nothing of mine', capsule: { id: 'cap-late' } } });
    expect(await store.hasCapsule('cap-in')).toBe(true);
    expect(await store.hasCapsule('cap-late')).toBe(true);
    expect(await store.hasCapsule('cap-never')).toBe(false);
    expect(await store.hasCapsule(null as any)).toBe(false);
    expect(await store.hasCapsule('')).toBe(false);
    const slack = 5_000;
    expect(await store.hasOwnSendNear('a', NOW + 10_000, slack), 'at the moment').toBe(true);
    expect(await store.hasOwnSendNear('a', NOW + 15_000, slack), 'at the edge of the slack (inclusive)').toBe(true);
    expect(await store.hasOwnSendNear('a', NOW + 5_000, slack), 'and the other edge').toBe(true);
    expect(await store.hasOwnSendNear('a', NOW + 15_001, slack), 'one millisecond past it').toBe(false);
    expect(await store.hasOwnSendNear('a', NOW + 30_000, slack), 'an incoming record at that moment is not an own send').toBe(false);
    expect(await store.hasOwnSendNear('a', NOW, slack), 'nor is the incoming one at the start').toBe(false);
    expect(await store.hasOwnSendNear('c', NOW + 10_000, slack), 'another conversation\'s own send does not count').toBe(false);
    expect(await store.hasOwnSendNear('a', Number.NaN, slack)).toBe(false);
    expect(await store.hasOwnSendNear('a', NOW + 10_000, -1)).toBe(false);
    const [mine] = (await store.listMessages({ threadId: 'a' })).filter((m: any) => m.type === 'out');
    await store.deleteMessage(mine.id);
    expect(await store.hasOwnSendNear('a', NOW + 10_000, slack)).toBe(false);
  });

  it('HISTORY-11: the prune runs inside the write\'s own transaction and touches only the excess', async () => {
    const env = idb();
    const store = await createIndexedDbEncryptedMessageHistoryStore({ dbName: 'h11', keys: await historyKeys(), maxPerThread: 50, ...env });
    await fill(store, 't', 50);
    const getAllKeys = vi.spyOn(IDBIndex.prototype, 'getAllKeys');
    const transaction = vi.spyOn(IDBDatabase.prototype, 'transaction');
    for (let i = 50; i < 60; i += 1) await store.putMessage({ threadId: 't', createdAt: NOW + i * 1000, message: { type: 'in', text: `t #${i}` } });
    expect(transaction.mock.calls.filter(([, mode]) => mode === 'readwrite')).toHaveLength(10);
    expect(getAllKeys).toHaveBeenCalledTimes(10);
    for (const call of getAllKeys.mock.calls) expect(call[1], 'the oldest one, not the whole conversation').toBe(1);
    const kept = await store.listMessages({ threadId: 't' });
    expect(kept).toHaveLength(50);
    expect(kept[0].message.text, 'the ten oldest are the ones gone').toBe('t #10');
    expect(kept.at(-1)!.message.text).toBe('t #59');
    await Promise.all(Array.from({ length: 25 }, (_, i) => store.putMessage({ threadId: 't', createdAt: NOW + (100 + i) * 1000, message: { type: 'in', text: `burst ${i}` } })));
    expect((await store.listThreadSummaries()).find((s: any) => s.threadId === 't')!.count).toBe(50);
    getAllKeys.mockClear();
    await store.putMessage({ threadId: 'fresh', createdAt: NOW, message: { type: 'in', text: 'first' } });
    expect(getAllKeys).not.toHaveBeenCalled();
  });

  it('HISTORY-12: the conversation summaries — a row per conversation, its newest record opened for its name and moment, newest first', async () => {
    const env = idb();
    const store = await createIndexedDbEncryptedMessageHistoryStore({ dbName: 'h12', keys: await historyKeys(), ...env });
    expect(await store.listThreadSummaries(), 'an empty store lists nothing').toEqual([]);
    await fill(store, 'quiet', 3, { from: NOW });
    await fill(store, 'busy', 120, { from: NOW + 1000 });
    await fill(store, 'old', 7, { from: NOW - 10 ** 8 });
    const storeGetAll = vi.spyOn(IDBObjectStore.prototype, 'getAll');
    const indexGetAll = vi.spyOn(IDBIndex.prototype, 'getAll');
    const openKeyCursor = vi.spyOn(IDBIndex.prototype, 'openKeyCursor');
    const step = vi.spyOn(IDBCursor.prototype, 'continue');
    const summaries = await store.listThreadSummaries();
    expect(openKeyCursor).toHaveBeenCalledTimes(3 + 1);
    expect(step.mock.calls.length, 'never a walk through a conversation').toBeLessThanOrEqual(3 * 4);
    expect(summaries).toEqual([
      { threadId: 'busy', count: 120, newestCreatedAt: NOW + 1000 + 119 * 1000 },
      { threadId: 'quiet', count: 3, newestCreatedAt: NOW + 2 * 1000 },
      { threadId: 'old', count: 7, newestCreatedAt: NOW - 10 ** 8 + 6 * 1000 },
    ]);
    expect(storeGetAll).not.toHaveBeenCalled();
    expect(indexGetAll).not.toHaveBeenCalled();
    for (const record of await store.listMessages({ threadId: 'quiet' })) await store.deleteMessage(record.id);
    expect((await store.listThreadSummaries()).map((s: any) => s.threadId)).toEqual(['busy', 'old']);
  });

  it('HISTORY-15: a conversation\'s record count comes off the index — nothing read or opened — and the memory store agrees', async () => {
    const env = idb();
    const store = await createIndexedDbEncryptedMessageHistoryStore({ dbName: 'h15', keys: await historyKeys(), ...env });
    const memory = await createMemoryEncryptedMessageHistoryStore();
    for (const s of [store, memory]) {
      await fill(s, 'saved', 5, { from: NOW });
      await fill(s, 'other', 3, { from: NOW + 10 ** 6 });
    }
    const storeGetAll = vi.spyOn(IDBObjectStore.prototype, 'getAll');
    const indexGetAll = vi.spyOn(IDBIndex.prototype, 'getAll');
    const openCursor = vi.spyOn(IDBIndex.prototype, 'openCursor');
    for (const s of [store, memory]) {
      expect(await s.countThreadMessages('saved')).toBe(5);
      expect(await s.countThreadMessages('other')).toBe(3);
      expect(await s.countThreadMessages('nobody')).toBe(0);
      expect(await s.countThreadMessages('')).toBe(0);
      expect(await s.countThreadMessages(null as any)).toBe(0);
    }
    expect(storeGetAll).not.toHaveBeenCalled();
    expect(indexGetAll).not.toHaveBeenCalled();
    expect(openCursor, 'a count, not a walk').not.toHaveBeenCalled();
    for (const s of [store, memory]) {
      const [first] = await s.listMessages({ threadId: 'saved' });
      await s.deleteMessage(first.id);
      expect(await s.countThreadMessages('saved')).toBe(4);
    }
  });

  it('HISTORY-13: the record\'s createdAt is a finite number at the door, on both stores — the order depends on it', async () => {
    const env = idb();
    for (const store of [await createIndexedDbEncryptedMessageHistoryStore({ dbName: 'h13', keys: await historyKeys(), ...env }), await createMemoryEncryptedMessageHistoryStore()]) {
      await expect(store.putMessage({ threadId: 't', createdAt: '2026-09-23T10:00:00Z', message: { type: 'in', text: 'x' } })).rejects.toThrow(/createdAt must be a finite number/);
      await expect(store.putMessage({ threadId: 't', createdAt: Number.NaN, message: { type: 'in', text: 'x' } })).rejects.toThrow(/createdAt must be a finite number/);
      const stored = await store.putMessage({ threadId: 't', createdAt: new Date(NOW), message: { type: 'in', text: 'a Date is a number' } });
      expect(stored.createdAt).toBe(NOW);
      const defaulted = await store.putMessage({ threadId: 't', message: { type: 'in', text: 'no stamp at all' } });
      expect(Number.isFinite(defaulted.createdAt)).toBe(true);
    }
  });

  it('HISTORY-14: the memory store answers every question the persistent one does, with the same answers', async () => {
    const env = idb();
    const stores = [await createIndexedDbEncryptedMessageHistoryStore({ dbName: 'h14', keys: await historyKeys(), maxPerThread: 30, ...env }), await createMemoryEncryptedMessageHistoryStore({ maxPerThread: 30 })];
    for (const store of stores) {
      await fill(store, 'a', 45, { from: NOW, step: 7_000 });
      await fill(store, 'b', 5, { from: NOW + 10 ** 9, step: 3_000 });
      await fill(store, 'c', 1, { from: NOW - 10 ** 9 });
    }
    const strip = (rows: any[]) => rows.map((m) => [m.threadId, m.createdAt, m.type, m.capsuleId, m.message.text]);
    const [persistent, memory] = stores;
    expect(await memory.listThreadSummaries()).toEqual(await persistent.listThreadSummaries());
    for (const filter of [{ threadId: 'a', limit: 10 }, { threadId: 'a', limit: 10, before: NOW + 40 * 7_000 }, { threadId: 'a' }, { threadId: 'b', limit: 96 }, { threadId: 'zzz', limit: 5 }, { limit: 7 }, {}]) {
      const p = await persistent.listMessagesDetailed(filter);
      const m = await memory.listMessagesDetailed(filter);
      expect(strip(m.messages), JSON.stringify(filter)).toEqual(strip(p.messages));
      expect(m.failed).toEqual(p.failed);
    }
    for (const capsuleId of ['cap-a-40', 'cap-a-1', 'cap-b-2', 'cap-c-0', 'nope', '']) expect(await memory.hasCapsule(capsuleId), capsuleId).toBe(await persistent.hasCapsule(capsuleId));
    for (const [thread, at] of [['a', NOW + 30 * 7_000], ['a', NOW + 30 * 7_000 + 4_999], ['a', NOW + 30 * 7_000 + 5_001], ['a', NOW], ['b', NOW + 10 ** 9], ['q', NOW]] as const) {
      expect(await memory.hasOwnSendNear(thread, at, 5_000), `${thread} @ ${at}`).toBe(await persistent.hasOwnSendNear(thread, at, 5_000));
    }
    const stripHeaders = (rows: any[]) => rows.map((h) => [h.threadId, h.createdAt, h.type, h.capsuleId]);
    expect(stripHeaders(await memory.listMessageHeaders())).toEqual(stripHeaders(await persistent.listMessageHeaders()));
  });

  it('HISTORY-16: a record arriving out of time order takes its place by time — the position carries no clock, and a spent gap is renumbered', async () => {
    const env = idb();
    for (const store of [await createIndexedDbEncryptedMessageHistoryStore({ dbName: 'h16', keys: await historyKeys(), ...env }), await createMemoryEncryptedMessageHistoryStore()]) {
      const times = Array.from({ length: 80 }, (_, i) => NOW + Math.floor(i / 2) * 1000 + (i % 2));
      const order = times.map((at, i) => ({ at, key: (i * 37) % 80 })).sort((a, b) => a.key - b.key).map((x) => x.at);
      for (const at of order) await store.putMessage({ threadId: 't', createdAt: at, message: { type: 'in', text: `@${at - NOW}` } });
      const all = await store.listMessages({ threadId: 't' });
      expect(all.map((m) => m.createdAt)).toEqual([...times].sort((a, b) => a - b));
      const newest = await store.listMessagesDetailed({ threadId: 't', limit: 10 });
      expect(newest.messages.map((m: any) => m.createdAt)).toEqual([...times].sort((a, b) => a - b).slice(-10));
      const next = await store.listMessagesDetailed({ threadId: 't', limit: 10, beforeId: newest.cursor });
      expect(next.messages.map((m: any) => m.createdAt)).toEqual([...times].sort((a, b) => a - b).slice(-20, -10));
      for (let i = 0; i < 60; i += 1) await store.putMessage({ threadId: 't', createdAt: NOW + 500 + i / 100, message: { type: 'in', text: `squeezed ${i}` } });
      const squeezed = (await store.listMessages({ threadId: 't' })).map((m) => m.createdAt);
      expect(squeezed).toEqual([...squeezed].sort((a, b) => a - b));
    }
    const rows = await rawRows(env.indexedDB, 'h16');
    for (const row of rows) expect(Math.abs(row.o), 'a position is a rank, not a time').toBeLessThan(2 ** 24 + 10_000);
  });

  it('HISTORY-17: a copy of the database opens nothing under another wallet\'s keys — not a message, not a conversation, not a capsule', async () => {
    const env = idb();
    const mine = (await deriveAtRestKeys(new Uint8Array(32).fill(1))).history;
    const store = await createIndexedDbEncryptedMessageHistoryStore({ dbName: 'h17', keys: mine, ...env });
    await fill(store, PEER, 12);
    const copy = await createIndexedDbEncryptedMessageHistoryStore({ dbName: 'h17', keys: (await deriveAtRestKeys(new Uint8Array(32).fill(2))).history, ...env });
    expect(await copy.listThreadSummaries()).toEqual([]);
    expect(await copy.listMessages({ threadId: PEER })).toEqual([]);
    expect(await copy.hasCapsule(`cap-${PEER}-1`)).toBe(false);
    const all = await copy.listMessagesDetailed();
    expect(all.messages).toEqual([]);
    expect(all.failed).toHaveLength(12);
    const again = await createIndexedDbEncryptedMessageHistoryStore({ dbName: 'h17', keys: (await deriveAtRestKeys(new Uint8Array(32).fill(1))).history, ...env });
    expect((await again.listMessages({ threadId: PEER })).length).toBe(12);
  });
});
