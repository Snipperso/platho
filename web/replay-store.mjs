import { bytesToBase64url, openAtRest, sealAtRest, withAtRestLock } from './at-rest-seal.mjs?v=5';

const DEFAULT_DB_NAME = 'platho-local-security-v1';
const DEFAULT_STORE_NAME = 'privateCapsuleReplay';

export function createMemoryReplayStore() {
  const seen = new Map();
  return {
    async has(id) {
      const expiresAt = seen.get(id);
      if (expiresAt === undefined) return false;
      if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
        seen.delete(id);
        return false;
      }
      return true;
    },
    async add(id, expiresAt = Number.POSITIVE_INFINITY) {
      seen.set(id, expiresAt);
    },
    async prune(now = Date.now()) {
      for (const [id, expiresAt] of seen.entries()) {
        if (Number.isFinite(expiresAt) && expiresAt <= now) seen.delete(id);
      }
    },
    get type() {
      return 'memory';
    },
  };
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function createIndexedDbReplayStore(options = {}) {
  if (!globalThis.indexedDB) throw new Error('IndexedDB is unavailable');
  const dbName = options.dbName ?? DEFAULT_DB_NAME;
  const storeName = options.storeName ?? DEFAULT_STORE_NAME;
  const openRequest = indexedDB.open(dbName, 1);
  openRequest.onupgradeneeded = () => {
    const db = openRequest.result;
    if (!db.objectStoreNames.contains(storeName)) {
      const store = db.createObjectStore(storeName, { keyPath: 'id' });
      store.createIndex('expiresAt', 'expiresAt');
    }
  };
  const db = await requestToPromise(openRequest);

  async function prune(now = Date.now()) {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const index = store.index('expiresAt');
    const range = IDBKeyRange.upperBound(now);
    const cursorRequest = index.openCursor(range);
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
    await transactionDone(transaction);
  }

  return {
    async has(id) {
      await prune();
      const transaction = db.transaction(storeName, 'readonly');
      const record = await requestToPromise(transaction.objectStore(storeName).get(id));
      await transactionDone(transaction);
      return Boolean(record);
    },
    async add(id, expiresAt = Number.POSITIVE_INFINITY) {
      const transaction = db.transaction(storeName, 'readwrite');
      transaction.objectStore(storeName).put({
        id,
        expiresAt,
        storedAt: Date.now(),
      });
      await transactionDone(transaction);
    },
    prune,
    get type() {
      return 'indexeddb';
    },
  };
}

const SEALED_GUARD_ID = 'sealed.v2';
const SEALED_GUARD_DOMAIN = 'PLATHO.INTRO.REPLAY.SEAL.V2';
const SEALED_GUARD_PAD = 1024;
const SEALED_GUARD_PART = 'sealed.v2.part.';
const SEALED_GUARD_PARTS_BEFORE_FOLD = 32;
const isGuardPart = (id) => typeof id === 'string' && id.startsWith(SEALED_GUARD_PART);
const isGuardRow = (row) => row?.id === SEALED_GUARD_ID || isGuardPart(row?.id);
const guardAad = (id) => (isGuardPart(id) ? { part: id } : null);
const newGuardPartId = () => {
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return `${SEALED_GUARD_PART}${bytesToBase64url(bytes)}`;
};

export async function createSealedReplayGuard({ dbName = DEFAULT_DB_NAME, storeName = DEFAULT_STORE_NAME, sealKey, indexedDB = globalThis.indexedDB } = {}) {
  if (!sealKey) throw new Error('the sealed replay guard needs the wallet\'s key');
  if (!indexedDB) throw new Error('IndexedDB is unavailable');
  const openRequest = indexedDB.open(dbName, 1);
  openRequest.onupgradeneeded = () => {
    const db = openRequest.result;
    if (!db.objectStoreNames.contains(storeName)) {
      const store = db.createObjectStore(storeName, { keyPath: 'id' });
      store.createIndex('expiresAt', 'expiresAt');
    }
  };
  const db = await requestToPromise(openRequest);
  db.onversionchange = () => { try { db.close(); } catch { } };
  const seen = new Set();
  const openGuardRow = async (row) => {
    const opened = await openAtRest(sealKey, { domain: SEALED_GUARD_DOMAIN, aad: guardAad(row.id), sealed: row }).catch(() => null);
    return Array.isArray(opened?.nonces) ? opened.nonces.map(String) : [];
  };
  const read = db.transaction(storeName, 'readonly');
  const rows = await requestToPromise(read.objectStore(storeName).getAll());
  await transactionDone(read);
  const plainIds = [];
  for (const row of rows ?? []) {
    if (isGuardRow(row) || row?.id === undefined) continue;
    seen.add(String(row.id));
    plainIds.push(row.id);
  }
  for (const nonces of await Promise.all((rows ?? []).filter(isGuardRow).map(openGuardRow))) for (const nonce of nonces) seen.add(nonce);

  const lockName = `platho.intro.replay.${dbName}.${storeName}`;
  const pending = new Set();
  const fold = async (deleteIds) => {
    const reading = db.transaction(storeName, 'readonly');
    const held = ((await requestToPromise(reading.objectStore(storeName).getAll())) ?? []).filter(isGuardRow);
    await transactionDone(reading);
    for (const nonces of await Promise.all(held.map(openGuardRow))) for (const nonce of nonces) seen.add(nonce);
    const sealed = await sealAtRest(sealKey, { domain: SEALED_GUARD_DOMAIN, value: { nonces: [...seen] }, padTo: SEALED_GUARD_PAD, binary: true });
    const write = db.transaction(storeName, 'readwrite');
    const store = write.objectStore(storeName);
    store.put({ id: SEALED_GUARD_ID, n: sealed.n, x: sealed.x });
    for (const row of held) if (isGuardPart(row.id)) store.delete(row.id);
    for (const id of deleteIds) store.delete(id);
    await transactionDone(write);
  };
  const writePart = async (nonces) => {
    const id = newGuardPartId();
    const sealed = await sealAtRest(sealKey, { domain: SEALED_GUARD_DOMAIN, aad: guardAad(id), value: { nonces }, padTo: SEALED_GUARD_PAD, binary: true });
    const write = db.transaction(storeName, 'readwrite');
    write.objectStore(storeName).put({ id, n: sealed.n, x: sealed.x });
    await transactionDone(write);
  };
  const writePending = async (deleteIds = []) => {
    const batch = [...pending];
    pending.clear();
    try {
      const reading = db.transaction(storeName, 'readonly');
      const store = reading.objectStore(storeName);
      const ids = ((await requestToPromise(store.getAllKeys())) ?? []).filter(isGuardPart);
      const parts = await Promise.all(ids.map((id) => requestToPromise(store.get(id))));
      await transactionDone(reading);
      for (const nonces of await Promise.all(parts.filter(Boolean).map(openGuardRow))) for (const nonce of nonces) seen.add(nonce);
      if (deleteIds.length > 0 || ids.length >= SEALED_GUARD_PARTS_BEFORE_FOLD) await fold(deleteIds);
      else if (batch.length > 0) await writePart(batch);
    } catch (error) {
      for (const nonce of batch) pending.add(nonce);
      throw error;
    }
  };
  let writes = Promise.resolve();
  let queued = null;
  const flush = () => {
    if (queued) return queued;
    const run = writes.then(() => {
      queued = null;
      return withAtRestLock(lockName, () => writePending());
    });
    queued = run;
    writes = run.catch(() => {});
    return run;
  };
  if (plainIds.length > 0) {
    const run = writes.then(() => withAtRestLock(lockName, () => writePending(plainIds)));
    writes = run.catch(() => {});
    await run;
  }
  return {
    async has(id) { return seen.has(String(id)); },
    async add(id) {
      if (seen.has(String(id))) return;
      seen.add(String(id));
      pending.add(String(id));
      await flush();
    },
    async prune() { },
    close() { try { db.close(); } catch { } },
    get type() { return 'sealed-indexeddb'; },
  };
}
