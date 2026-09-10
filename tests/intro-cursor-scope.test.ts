import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createIntroCursorStore, cursorEntry } from '../web/intro-cursor-store.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE INTRO SCAN'S CURSORS BELONG TO ONE IDENTITY.
//
// A cursor says how far a shard has been READ. Everything else the first-contact path keeps is wallet-scoped —
// the replay guard, the sealed K_root store, the message history — but the cursors were kept in a database with
// no wallet in its name, shared with the legacy replay store. So a second identity on the same device resumed
// from wherever the first one had reached and never looked below it, and below it are precisely that identity's
// older first contacts: on chain, paid for by whoever wrote them, and skipped without a word.
//
// Measured here against a double of IndexedDB rather than pinned in prose, because what matters is the BEHAVIOUR
// of two stores side by side — and because the migration must be shown to move the records exactly once.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

/** The slice of IndexedDB this store uses, and nothing else: open (with and without a version), object stores,
 *  transactions that complete on their own, get/put/delete/clear, close, deleteDatabase. */
function createFakeIndexedDb() {
  const dbs = new Map<string, { version: number; stores: Map<string, Map<string, any>> }>();
  const request = (compute: () => any) => {
    const req: any = { onsuccess: null, onerror: null, onupgradeneeded: null, result: undefined, error: null };
    queueMicrotask(() => {
      try { req.result = compute(); req.onsuccess?.(); } catch (error) { req.error = error; req.onerror?.(); }
    });
    return req;
  };
  const handle = (name: string) => {
    const entry = dbs.get(name)!;
    return {
      get version() { return entry.version; },
      objectStoreNames: {
        contains: (store: string) => entry.stores.has(store),
        get length() { return entry.stores.size; },
      },
      createObjectStore: (store: string) => { entry.stores.set(store, new Map()); return {}; },
      close: () => {},
      transaction: (storeName: string) => {
        const tx: any = { oncomplete: null, onerror: null, onabort: null };
        const data = entry.stores.get(storeName);
        if (!data) throw new Error(`no object store ${storeName}`);
        tx.objectStore = () => ({
          get: (key: string) => request(() => data.get(key)),
          put: (value: any, key: string) => request(() => { data.set(key, value); return key; }),
          delete: (key: string) => request(() => { data.delete(key); return undefined; }),
          clear: () => request(() => { data.clear(); return undefined; }),
        });
        // A real transaction commits when the task ends with nothing pending; a macrotask is late enough that the
        // store's own `await` on its request has already installed the oncomplete handler.
        setTimeout(() => tx.oncomplete?.(), 0);
        return tx;
      },
    };
  };
  return {
    open(name: string, version?: number) {
      const req: any = { onsuccess: null, onerror: null, onupgradeneeded: null, result: undefined, error: null };
      queueMicrotask(() => {
        const fresh = !dbs.has(name);
        if (fresh) dbs.set(name, { version: version ?? 1, stores: new Map() });
        const entry = dbs.get(name)!;
        req.result = handle(name);
        // Only a versioned open upgrades — the version-less open used by the migration must not create stores.
        if (version !== undefined && (fresh || version > entry.version)) {
          entry.version = version;
          req.onupgradeneeded?.();
        }
        req.onsuccess?.();
      });
      return req;
    },
    deleteDatabase(name: string) { dbs.delete(name); return { onsuccess: null, onerror: null, onblocked: null }; },
    _dbs: dbs,
  };
}

const LEGACY = 'platho-local-security-v1';
const STORE = 'introScanCursors';
const WALLET_A = 'platho-intro-cursors-v1.deploy.walletA';
const WALLET_B = 'platho-intro-cursors-v1.deploy.walletB';

describe('ICSCOPE — one identity, one set of scan cursors', () => {
  it('ICSCOPE-01: two wallets do not read each other\'s positions', async () => {
    const indexedDB: any = createFakeIndexedDb();
    const a = await createIntroCursorStore({ dbName: WALLET_A, indexedDB });
    expect(a.type, 'the double must exercise the persistent path, not the memory fallback').toBe('indexeddb');
    await a.save(new Map([['20685:0', cursorEntry('m1', 420)]]));
    await a.saveDelivered(new Map([['20685:0:12', 20685]]));

    const b = await createIntroCursorStore({ dbName: WALLET_B, indexedDB });
    // The whole point: wallet B must start at nothing. Inheriting A's 420 means every entry below 420 in that
    // shard — B's own older first contacts — is never tested against B's scan key.
    expect(await b.load()).toEqual(new Map());
    expect(await b.loadDelivered()).toEqual(new Map());

    await b.save(new Map([['20685:0', cursorEntry('m2', 7)]]));
    expect((await a.load()).get('20685:0')).toEqual(cursorEntry('m1', 420));
  });

  it('ICSCOPE-02: the shared legacy record is adopted ONCE, by the first wallet to run', async () => {
    const indexedDB: any = createFakeIndexedDb();
    // A device as it stands before the update: cursors and a delivered ledger in the unscoped shared database.
    const legacy = await createIntroCursorStore({ dbName: LEGACY, indexedDB });
    await legacy.save(new Map([['20685:0', cursorEntry('m1', 420)]]));
    await legacy.saveDelivered(new Map([['20685:0:12', 20685]]));

    const a = await createIntroCursorStore({ dbName: WALLET_A, indexedDB });
    // Adopted, so the update does not cost a cold re-scan and a re-offer of every first contact ever received.
    expect((await a.load()).get('20685:0')).toEqual(cursorEntry('m1', 420));
    expect(await a.loadDelivered()).toEqual(new Map([['20685:0:12', 20685]]));
    // And GONE from the shared database, or the next identity would inherit the very position this fixes.
    expect(indexedDB._dbs.get(LEGACY).stores.get(STORE).has('cursors')).toBe(false);
    expect(indexedDB._dbs.get(LEGACY).stores.get(STORE).has('delivered')).toBe(false);

    const b = await createIntroCursorStore({ dbName: WALLET_B, indexedDB });
    expect(await b.load()).toEqual(new Map());
  });

  it('ICSCOPE-03: adoption never overwrites a wallet that already has its own position', async () => {
    const indexedDB: any = createFakeIndexedDb();
    const legacy = await createIntroCursorStore({ dbName: LEGACY, indexedDB });
    await legacy.save(new Map([['20685:0', cursorEntry('stale', 900)]]));

    const a = await createIntroCursorStore({ dbName: WALLET_A, indexedDB });
    await a.save(new Map([['20685:0', cursorEntry('mine', 3)]]));
    const reopened = await createIntroCursorStore({ dbName: WALLET_A, indexedDB });
    expect((await reopened.load()).get('20685:0')).toEqual(cursorEntry('mine', 3));
  });

  it('ICSCOPE-04: a device that never had the legacy database does not get an empty one', async () => {
    const indexedDB: any = createFakeIndexedDb();
    await createIntroCursorStore({ dbName: WALLET_A, indexedDB });
    // The version-less open would otherwise leave a store-less database behind on every fresh install.
    expect(indexedDB._dbs.has(LEGACY)).toBe(false);
  });

  it('ICSCOPE-05: the app names the wallet-scoped database and the clear routine knows it', () => {
    const app = readFileSync('web/app.js', 'utf8');
    expect(app).toContain("return walletScopedIndexedDbName('platho-intro-cursors-v1', walletAddress);");
    expect(app).toContain('cursorDbName: currentIntroCursorDbName(),');
    // [[clear-local-data-must-wipe-every-platho-db]] — a store missing from this list survives "clear local data"
    // and a restore then runs on somebody else's cursors.
    expect(app).toContain("  'platho-intro-cursors-v1',          // the INTRO scan's cursors + delivered ledger");
  });
});
