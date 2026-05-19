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
