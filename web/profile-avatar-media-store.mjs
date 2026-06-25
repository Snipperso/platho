// Device-wide IndexedDB store for profile-avatar media blobs (webp data URLs, ~tens of KB each), keyed by
// the content hash (sha256 of the bytes). Content-addressed, so it is shared across wallets and must be
// readable BEFORE a wallet is unlocked (the public feed renders without a wallet) — hence NOT wallet-scoped.
//
// Why IndexedDB and not localStorage: on iOS WebKit every localStorage setItem re-serializes the ENTIRE
// store, so accumulating blobs there blocked the main thread (the Vault freeze). IndexedDB writes per-record
// and has a far larger quota. The store is LRU-bounded so it cannot grow without limit.
const DEFAULT_DB_NAME = 'platho-profile-avatar-media-v1';
const STORE_NAME = 'profileAvatarMedia';
const DEFAULT_CAP = 300;

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

export async function createProfileAvatarMediaStore(options = {}) {
  if (!globalThis.indexedDB) throw new Error('IndexedDB is unavailable');
  const dbName = options.dbName ?? DEFAULT_DB_NAME;
  const cap = Number.isInteger(options.cap) && options.cap > 0 ? options.cap : DEFAULT_CAP;
  const openRequest = indexedDB.open(dbName, 1);
  openRequest.onupgradeneeded = () => {
    const db = openRequest.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'hash' });
      store.createIndex('cachedAt', 'cachedAt');
    }
  };
  const db = await requestToPromise(openRequest);

  // LRU bound: after a write, if the store exceeds `cap`, evict the oldest entries by cachedAt (ascending
  // cursor on the cachedAt index = oldest first). Avatars are reconstructable from chain, so eviction is safe.
  async function enforceCap() {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const total = await requestToPromise(store.count());
    if (total <= cap) { await transactionDone(transaction); return; }
    let remaining = total - cap;
    const cursorRequest = store.index('cachedAt').openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor || remaining <= 0) return;
      cursor.delete();
      remaining -= 1;
      cursor.continue();
    };
    await transactionDone(transaction);
  }

  return {
    async get(hash) {
      if (!hash) return null;
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const record = await requestToPromise(transaction.objectStore(STORE_NAME).get(hash));
      await transactionDone(transaction);
      return record ?? null;
    },
    // Batch read for the boot warm-up: one transaction, many gets, returns Map(hash -> url) for hits only.
    async getMany(hashes) {
      const out = new Map();
      const unique = [...new Set((hashes ?? []).filter(Boolean))];
      if (unique.length === 0) return out;
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const records = await Promise.all(unique.map((hash) => requestToPromise(store.get(hash))));
      await transactionDone(transaction);
      unique.forEach((hash, index) => {
        const url = records[index]?.url;
        if (typeof url === 'string') out.set(hash, url);
      });
      return out;
    },
    async put(hash, url) {
      if (!hash || typeof url !== 'string') return;
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put({ hash, url, cachedAt: Date.now() });
      await transactionDone(transaction);
      try { await enforceCap(); } catch { /* best effort: an over-cap store still works, just larger */ }
    },
    async delete(hash) {
      if (!hash) return;
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(hash);
      await transactionDone(transaction);
    },
    get type() { return 'indexeddb'; },
  };
}
