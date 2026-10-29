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

  let top = await (async () => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const cursor = await requestToPromise(transaction.objectStore(STORE_NAME).index('cachedAt').openCursor(null, 'prev'));
    await transactionDone(transaction).catch(() => {});
    const highest = Number(cursor?.value?.cachedAt ?? 0);
    return Number.isFinite(highest) ? highest : 0;
  })();

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
    async getAll() {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const records = await requestToPromise(transaction.objectStore(STORE_NAME).getAll());
      await transactionDone(transaction);
      const out = new Map();
      for (const record of records ?? []) {
        if (record?.hash && typeof record.url === 'string') out.set(record.hash, record.url);
      }
      return out;
    },
    async records() {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const records = await requestToPromise(transaction.objectStore(STORE_NAME).index('cachedAt').getAll());
      await transactionDone(transaction);
      return (records ?? []).filter((record) => record?.hash && typeof record.url === 'string')
        .map((record) => ({ hash: record.hash, url: record.url, rank: Number(record.cachedAt) }));
    },
    async put(hash, url, { rankAt = null } = {}) {
      if (!hash || typeof url !== 'string') return;
      const rank = Number.isFinite(rankAt) ? rankAt : top + 1;
      top = Math.max(top, rank);
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put({ hash, url, cachedAt: rank });
      await transactionDone(transaction);
      try { await enforceCap(); } catch { }
    },
    async delete(hash) {
      if (!hash) return;
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(hash);
      await transactionDone(transaction);
    },
    close() { try { db.close(); } catch { } },
    get type() { return 'indexeddb'; },
  };
}
