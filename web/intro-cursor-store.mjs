// intro-cursor-store — what the INTRO scanner remembers between passes, and between app launches.
//
// WHY THIS MATTERS MORE THAN IT LOOKS. The scan is affordable only because a pass opens the buckets that moved
// and reads them from where the last pass stopped. Lose that memory and every pass becomes a cold start: the
// whole live set is re-fetched and re-tested, every entry is re-delivered as if new, and the byte budget the
// policy module computes is meaningless. So the cursor is not a cache — dropping it is a correctness problem for
// the user (duplicate first contacts) and a cost problem for the device.
//
// The shape mirrors web/replay-store.mjs: a memory implementation for tests and for browsers without IndexedDB,
// and a persistent one for the app, behind one interface. Failures degrade to memory rather than throwing —
// a scanner that cannot persist should still work, just more expensively.

const DEFAULT_DB_NAME = 'platho-local-security-v1';
const DEFAULT_STORE_NAME = 'introScanCursors';

/** The identity of a delivered intro. Exact and stable: the shard names the epoch and bucket, the contract
 *  assigns the entry id, and none of the three can be restated by an endpoint. */
export const deliveryKey = ({ epoch, bucket, entryId }) => `${epoch}:${bucket}:${entryId}`;

/** A cursor entry: how far this shard was read, and the change marker it had when we read it. */
export const cursorEntry = (marker, nextId) => ({ marker: String(marker ?? ''), nextId: Number(nextId ?? 0) });

export function createMemoryIntroCursorStore() {
  const cursors = new Map();
  let delivered = new Map();
  let meta = {};
  return {
    async load() { return new Map(cursors); },
    async save(next) {
      cursors.clear();
      for (const [key, value] of next) cursors.set(key, cursorEntry(value?.marker, value?.nextId));
    },
    async loadDelivered() { return new Map(delivered); },
    async saveDelivered(next) { delivered = new Map(next); },
    async loadMeta() { return { ...meta }; },
    async saveMeta(next) { meta = { ...next }; },
    async clear() { cursors.clear(); delivered = new Map(); meta = {}; },
    get type() { return 'memory'; },
  };
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

async function openDatabase(dbName, storeName, indexedDB) {
  const request = indexedDB.open(dbName, 1);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName);
  };
  return requestToPromise(request);
}

/**
 * Persistent cursors. Falls back to memory when IndexedDB is unavailable or unusable — a scanner that cannot
 * remember is slower and chattier, but it is not broken, and refusing to run would be worse.
 */
export async function createIntroCursorStore({
  dbName = DEFAULT_DB_NAME,
  storeName = DEFAULT_STORE_NAME,
  indexedDB = globalThis.indexedDB,
} = {}) {
  if (!indexedDB) return createMemoryIntroCursorStore();
  let db;
  try {
    db = await openDatabase(dbName, storeName, indexedDB);
  } catch {
    return createMemoryIntroCursorStore();
  }

  const withStore = async (mode, fn) => {
    const tx = db.transaction(storeName, mode);
    const result = await fn(tx.objectStore(storeName));
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
    return result;
  };

  return {
    async load() {
      try {
        const raw = await withStore('readonly', (store) => requestToPromise(store.get('cursors')));
        const out = new Map();
        for (const [key, value] of Object.entries(raw ?? {})) out.set(key, cursorEntry(value?.marker, value?.nextId));
        return out;
      } catch { return new Map(); }
    },
    async save(next) {
      // Stored as a plain object: a Map survives structured clone, but an object keeps the record readable to
      // anyone inspecting the database, and this data is not secret — it is public chain positions.
      const plain = {};
      for (const [key, value] of next) plain[key] = cursorEntry(value?.marker, value?.nextId);
      try { await withStore('readwrite', (store) => requestToPromise(store.put(plain, 'cursors'))); } catch { /* degrade to volatile */ }
    },
    async loadDelivered() {
      try {
        const raw = await withStore('readonly', (store) => requestToPromise(store.get('delivered')));
        return new Map(Object.entries(raw ?? {}).map(([key, epoch]) => [key, Number(epoch)]));
      } catch { return new Map(); }
    },
    async saveDelivered(next) {
      const plain = {};
      for (const [key, epoch] of next) plain[key] = Number(epoch);
      try { await withStore('readwrite', (store) => requestToPromise(store.put(plain, 'delivered'))); } catch { /* degrade */ }
    },
    async loadMeta() {
      try { return (await withStore('readonly', (store) => requestToPromise(store.get('meta')))) ?? {}; } catch { return {}; }
    },
    async saveMeta(next) {
      try { await withStore('readwrite', (store) => requestToPromise(store.put({ ...next }, 'meta'))); } catch { /* degrade */ }
    },
    async clear() {
      try { await withStore('readwrite', (store) => requestToPromise(store.clear())); } catch { /* degrade */ }
    },
    get type() { return 'indexeddb'; },
  };
}

/**
 * Drop cursors for shards that can no longer hold anything we want.
 *
 * Without this the map grows without bound: every (epoch, bucket) ever seen stays forever, and the INTRO lane
 * mints a fresh set every single day. Anything older than the scan window is dead — its entries have been evicted
 * and its epoch can no longer be written to, so its cursor can never become useful again.
 */
export function pruneCursors(cursors, keyEpochs, oldestUsefulEpoch, { sawWholeWindow = false } = {}) {
  const kept = new Map();
  for (const [key, value] of cursors) {
    const epoch = keyEpochs.get(key);
    if (epoch !== undefined) {
      if (epoch >= oldestUsefulEpoch) kept.set(key, value);
      continue;
    }
    // A key the pass did not look at. Whether that means "stale" or "outside this pass's range" depends entirely
    // on what the pass covered: a HOT pass sees three epochs of a ten-epoch window, so dropping what it missed
    // would throw away seven epochs of cursors every minute and re-deliver their intros. Only a full sweep is
    // entitled to conclude that an unseen shard is gone.
    if (!sawWholeWindow) kept.set(key, value);
  }
  return kept;
}

/**
 * Drop delivery records for epochs that have left the scan window.
 *
 * The set exists to stop a re-read from showing the same first contact twice, and it only has to cover what can
 * still be re-read. An entry outside the window has been evicted from its shard, so it can never come back — its
 * record is dead weight, and without this the set grows for the life of the install.
 */
export function pruneDelivered(delivered, oldestUsefulEpoch) {
  const kept = new Map();
  for (const [key, epoch] of delivered) if (Number(epoch) >= oldestUsefulEpoch) kept.set(key, Number(epoch));
  return kept;
}
