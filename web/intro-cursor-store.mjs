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

// THE CURSORS BELONG TO ONE IDENTITY, and until 2026-08-29 they lived in a database with no wallet in its name —
// the one place in this lane that was not scoped. Everything else a first contact touches IS: the replay guard
// ('platho-intro-replay-v1' + wallet), the sealed K_root store, the message history. A cursor says HOW FAR each
// shard has been read, so a second identity on the same device resumed from wherever the first one had reached and
// never looked below it — and below it are exactly that identity's older first contacts: on chain, paid for by
// whoever wrote them, skipped in silence. The caller passes a wallet-scoped dbName; the default below is only the
// legacy value, kept so the adoption has a name to look for.
import { generationForEpoch, generationForEpochAt } from './cutover-epoch.mjs?v=4';

const DEFAULT_DB_NAME = 'platho-local-security-v1';
const LEGACY_SHARED_DB_NAME = 'platho-local-security-v1';
const DEFAULT_STORE_NAME = 'introScanCursors';
const RECORD_KEYS = Object.freeze(['cursors', 'delivered', 'meta']);

/**
 * The identity of a delivered intro. Exact and stable: the shard names the epoch and bucket, the contract
 * assigns the entry id, and none of the three can be restated by an endpoint.
 *
 * …AND THE GENERATION, because those three stopped naming one entry [audit 2026-08-31, round 6]. Within a single
 * build an epoch owns exactly one generation, so the triple is unambiguous — but this ledger OUTLIVES the build
 * that wrote it. A device running a boundary-less build scans epoch E as generation 17 and records `E:0:k`; it
 * then updates to the flip release, where epoch E is generation 18, and entry k of the gen-18 shard — a genuine
 * first contact from a different person — matches that key and is skipped. The skip is a bare `continue` above
 * the undelivered-rollback in intro-scan-runner, so the cursor advances past it: never re-read, never delivered,
 * no error. The module's own header calls that "the one failure this lane cannot afford".
 *
 * The sibling half of this store was already immune — cursors are keyed by `addrKey(address)`, which carries the
 * generation by construction. This is that asymmetry closed.
 *
 * Generation 17 keeps the EXACT key it has always had, so every entry already on a device keeps its meaning and
 * nothing is re-delivered; only 18 appends, and its entries cannot exist before the flip.
 */
export const deliveryKey = ({ epoch, bucket, entryId, boundary }) => {
  // `boundary` IS THE TEST SEAM, and it exists for the same reason its two siblings have one [round 14].
  // CUTOVER_EPOCH is a module constant that is null today, so `generationForEpoch` here can only ever answer
  // 17 and the generation-18 arm below is unreachable from any test — a gate could pin the SOURCE LINE and
  // nothing more, which is the shape this file's own note records being bitten by (a field asserted by grep
  // and silently dropped one module downstream). On flip day this line decides whether a first contact
  // already shown is shown again, or a new one is silently skipped as already delivered.
  // Production callers pass no boundary and get the module constant, unchanged.
  const generation = boundary === undefined
    ? generationForEpoch(Number(epoch))
    : generationForEpochAt(Number(epoch), boundary);
  return generation === 17
    ? `${epoch}:${bucket}:${entryId}`
    : `${epoch}:${bucket}:${entryId}:${generation}`;
};

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
 * MOVE THE SHARED DATABASE'S RECORDS INTO THIS WALLET'S, ONCE.
 *
 * Without it every existing device pays a cold start on the update: an empty cursor map re-reads the whole live
 * window, and an empty delivered ledger re-offers every first contact ever received. Those re-offers are absorbed
 * (the replay guard is permanent and wallet-scoped, and the handler will not write a message twice), but each one
 * still costs a body fetch — and a body old enough to have left its shard's newest window comes back null, which is
 * the backoff path, repeated. So the records are ADOPTED by the first wallet to run after the update, which on a
 * single-identity device is the wallet that wrote them, and REMOVED from the shared database, so a second identity
 * cannot inherit the first one's progress and with it the very skip this scoping exists to end.
 *
 * Opened WITHOUT a version, so a device that never had the legacy database does not get an empty one created here;
 * the signature of an accidental creation (version 1, no object stores) is deleted rather than left behind.
 */
async function adoptLegacyRecords(indexedDB, storeName, put) {
  let legacy = null;
  try {
    legacy = await requestToPromise(indexedDB.open(LEGACY_SHARED_DB_NAME));
  } catch { return false; }
  try {
    if (!legacy.objectStoreNames.contains(storeName)) {
      const created = legacy.version === 1 && legacy.objectStoreNames.length === 0;
      legacy.close();
      if (created) { try { indexedDB.deleteDatabase(LEGACY_SHARED_DB_NAME); } catch { /* nothing to undo */ } }
      return false;
    }
    const read = legacy.transaction(storeName, 'readonly').objectStore(storeName);
    const carried = [];
    for (const key of RECORD_KEYS) {
      const value = await requestToPromise(read.get(key));
      if (value !== undefined && value !== null) carried.push([key, value]);
    }
    if (carried.length === 0) { legacy.close(); return false; }
    for (const [key, value] of carried) await put(key, value);
    // Only after the new home holds them: a failure above leaves the legacy copy intact and the next launch retries.
    const write = legacy.transaction(storeName, 'readwrite').objectStore(storeName);
    for (const [key] of carried) await requestToPromise(write.delete(key));
    legacy.close();
    return true;
  } catch {
    try { legacy.close(); } catch { /* already closed */ }
    return false;
  }
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

  // ADOPTION, once per wallet database, and only while this one is still empty — it can never overwrite progress.
  if (dbName !== LEGACY_SHARED_DB_NAME) {
    try {
      const existing = await withStore('readonly', (store) => requestToPromise(store.get('cursors')));
      if (existing === undefined || existing === null) {
        await adoptLegacyRecords(indexedDB, storeName, (key, value) => withStore('readwrite', (store) => requestToPromise(store.put(value, key))));
      }
    } catch { /* a device that cannot read its own store starts cold; the scan still works, it just costs more */ }
  }

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
