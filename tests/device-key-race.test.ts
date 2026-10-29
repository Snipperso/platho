import { afterEach, describe, expect, it } from 'vitest';
import { webcrypto } from 'node:crypto';
import { createIndexedDbConvKeyStore } from '../web/conv-key-persist.mjs';
import { createIndexedDbEncryptedMessageHistoryStore } from '../web/encrypted-message-store.mjs';
import { createGroupRecordStore } from '../web/group-record-store.mjs';
import { createIndexedDbDeviceSecretStore } from '../web/device-secret-store.mjs';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { deriveAtRestKeys } from '../web/at-rest-seal.mjs';


if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

function serialisingIndexedDb() {
  type Store = { keyPath: string | null; data: Map<any, any>; indexes: Map<string, string> };
  const dbs = new Map<string, { version: number; stores: Map<string, Store>; tails: Map<string, Promise<void>> }>();
  const request = () => ({ onsuccess: null as any, onerror: null as any, onupgradeneeded: null as any, result: undefined as any, error: null as any });
  const handle = (name: string) => {
    const entry = dbs.get(name)!;
    return {
      objectStoreNames: { contains: (store: string) => entry.stores.has(store) },
      createObjectStore: (store: string, options: any = {}) => {
        const made: Store = { keyPath: options.keyPath ?? null, data: new Map(), indexes: new Map() };
        entry.stores.set(store, made);
        return { createIndex: (indexName: string, keyPath: string) => { made.indexes.set(indexName, keyPath); return {}; } };
      },
      close: () => {},
      transaction: (names: string | string[], mode = 'readonly') => {
        const scope = Array.isArray(names) ? names : [names];
        const tx: any = { oncomplete: null, onerror: null, onabort: null, mode, error: null };
        const ops: Array<() => void> = [];
        let started = false;
        let resolveDone!: () => void;
        const done = new Promise<void>((resolve) => { resolveDone = resolve; });
        const gate = Promise.all(scope.map((s) => entry.tails.get(s) ?? Promise.resolve()));
        for (const s of scope) entry.tails.set(s, done);
        const settle = () => {
          while (ops.length > 0) ops.shift()!();
          setTimeout(() => { if (ops.length > 0) { settle(); return; } tx.oncomplete?.(); resolveDone(); }, 0);
        };
        gate.then(() => { started = true; settle(); });
        const enqueue = (compute: () => any) => {
          const req = request();
          const op = () => {
            try { req.result = compute(); queueMicrotask(() => req.onsuccess?.({ target: req })); } catch (error) { req.error = error; queueMicrotask(() => req.onerror?.({ target: req })); }
          };
          ops.push(op);
          if (started) settle();
          return req;
        };
        const storeOf = (storeName: string) => {
          const store = entry.stores.get(storeName);
          if (!store) throw new Error(`no object store ${storeName}`);
          const keyOf = (value: any, key: any) => (key !== undefined ? key : (store.keyPath ? value?.[store.keyPath] : undefined));
          return {
            get: (key: any) => enqueue(() => store.data.get(key)),
            put: (value: any, key?: any) => enqueue(() => { const k = keyOf(value, key); store.data.set(k, value); return k; }),
            delete: (key: any) => enqueue(() => { store.data.delete(key); return undefined; }),
            clear: () => enqueue(() => { store.data.clear(); return undefined; }),
            getAll: () => enqueue(() => [...store.data.values()]),
            getAllKeys: () => enqueue(() => [...store.data.keys()]),
            index: (indexName: string) => {
              const path = store.indexes.get(indexName);
              if (!path) throw new Error(`no index ${indexName}`);
              const matching = (key: any) => [...store.data.values()].filter((v) => v?.[path] === key);
              return {
                count: (key: any) => enqueue(() => matching(key).length),
                getAll: (key: any) => enqueue(() => matching(key)),
                getAllKeys: (key: any) => enqueue(() => matching(key).map((v) => (store.keyPath ? v[store.keyPath] : undefined))),
              };
            },
          };
        };
        tx.objectStore = (storeName: string) => storeOf(storeName);
        return tx;
      },
    };
  };
  return {
    open(name: string, version?: number) {
      const req = request();
      queueMicrotask(() => {
        const fresh = !dbs.has(name);
        if (fresh) dbs.set(name, { version: version ?? 1, stores: new Map(), tails: new Map() });
        const entry = dbs.get(name)!;
        req.result = handle(name);
        if (version !== undefined && (fresh || version > entry.version)) {
          entry.version = version;
          req.onupgradeneeded?.({ target: req });
        }
        req.onsuccess?.({ target: req });
      });
      return req;
    },
    deleteDatabase(name: string) { dbs.delete(name); return { onsuccess: null, onerror: null, onblocked: null }; },
  };
}

const A = new Uint8Array(32).fill(0x11);
const B = new Uint8Array(32).fill(0x22);
const C = new Uint8Array(32).fill(0x33);
const kroot = (n: number) => new Uint8Array(32).fill(n);
const nonce = (n: number) => new Uint8Array(16).fill(n);
const walletKeys = () => deriveAtRestKeys(new Uint8Array(32).fill(0x5a));

describe('DEVKEY-RACE — two first opens of one database agree on one device key', () => {
  const held = (globalThis as any).indexedDB;
  afterEach(() => { (globalThis as any).indexedDB = held; });

  it('DEVKEY-01: the conv key store — what either racer seals, a later open reads', async () => {
    (globalThis as any).indexedDB = serialisingIndexedDb();
    const keys = await walletKeys();
    const open = () => createIndexedDbConvKeyStore({ dbName: 'platho-convkeys-race', atRestKey: keys.convKeys.seal });
    const [a, b] = await Promise.all([open(), open()]);
    await a.upsertConversationKRoot(A, B, { kRoot: kroot(1), createdAt: 100, introNonce: nonce(1), peerWallet: 'w-a' });
    expect((await open()).getConversation(A, B)?.peerWallet, 'sealed by the first racer, opened by a third party').toBe('w-a');
    await b.upsertConversationKRoot(A, C, { kRoot: kroot(2), createdAt: 100, introNonce: nonce(2), peerWallet: 'w-b' });
    expect((await open()).getConversation(A, C)?.peerWallet, 'sealed by the second racer, opened by a third party').toBe('w-b');
  });

  it('DEVKEY-02: the message history — a record either racer wrote is opened by a later open', async () => {
    const factory = new IDBFactory();
    const keys = await walletKeys();
    const open = () => createIndexedDbEncryptedMessageHistoryStore({ dbName: 'platho-history-race', keys: keys.history, indexedDB: factory, IDBKeyRange });
    const [a, b] = await Promise.all([open(), open()]);
    await a.putMessage({ threadId: 'peer:a', createdAt: 1, message: { type: 'in', text: 'from a' } });
    await b.putMessage({ threadId: 'peer:b', createdAt: 2, message: { type: 'in', text: 'from b' } });
    const later = await open();
    const detailed = await later.listMessagesDetailed();
    expect(detailed.failed, 'nothing sealed under a key the database no longer holds').toEqual([]);
    expect(detailed.messages.map((m: any) => m.message?.text ?? m.text).sort()).toEqual(['from a', 'from b']);
  });

  it('DEVKEY-03: the group record store — a room either racer sealed is read by a later open', async () => {
    const indexedDB: any = serialisingIndexedDb();
    const keys = await walletKeys();
    const open = () => createGroupRecordStore({ dbName: 'platho-groups-race', indexedDB, keys: keys.groups });
    const [a, b] = await Promise.all([open(), open()]);
    expect(a.type).toBe('sealed');
    await a.put('g1', { groupId: 'g1', name: 'one' });
    expect((await open()).get('g1'), 'sealed by the first racer').resolves.toMatchObject({ name: 'one' });
    await b.put('g2', { groupId: 'g2', name: 'two' });
    expect((await open()).get('g2'), 'sealed by the second racer').resolves.toMatchObject({ name: 'two' });
  });

  it('DEVKEY-04: the device secret store — a secret either racer sealed is read by a later open', async () => {
    (globalThis as any).indexedDB = serialisingIndexedDb();
    const open = (id: string) => createIndexedDbDeviceSecretStore({ dbName: 'platho-secrets-race', id });
    const [a, b] = await Promise.all([open('k1'), open('k2')]);
    await a.write('secret one');
    expect(await (await open('k1')).read(), 'sealed by the first racer').toBe('secret one');
    await b.write('secret two');
    expect(await (await open('k2')).read(), 'sealed by the second racer').toBe('secret two');
  });
});
