// group-record-store — where a private group lives between passes and between launches.
//
// A group's record is not a cache: it holds the EPOCH KEYS of the window this device can still read, and the
// ratchet is forward-only. Lose it and the days it covered are unreadable forever — not re-fetchable, because no
// key on earth derives them again. That is why this store exists at all, and why it degrades to memory rather
// than throwing: a device that cannot persist should still work for as long as it is open.
//
// The shape mirrors web/intro-cursor-store.mjs and web/replay-store.mjs: one interface, a memory implementation
// for tests and for browsers without IndexedDB, and a persistent one for the app. The database name is
// WALLET-SCOPED by the caller, like every other store that holds identity-bearing material — a second identity on
// one device must not inherit the first one's rooms, nor its keys.
//
// SEALED AT REST [audit 2026-09-05, round 2]. The record carries the same class of secret the CONV key store
// carries — content keys, and the roster that says who is in the room — and the CONV store seals its K_roots
// under a non-extractable device key held in the same IndexedDB (conv-key-persist.mjs). This store wrote its
// records in the clear. It now seals every record the same way: AES-256-GCM under a device key generated on
// first use and never exported, one nonce per write, the group id bound into the additional data so a blob cannot
// be re-filed under another room. A blob the key cannot open (another device's export, a corrupted row) is skipped
// and counted, never returned as a record.
//
// The records are stored as `serializeGroupRecord` gives them (plain JSON with hex strings), so nothing in here
// has to know what a group is.

export const GROUP_RECORD_DB_NAME = 'platho-groups-v1';
export const GROUP_RECORD_STORE_NAME = 'groups';
const KEY_STORE_NAME = 'deviceKey';
const DEVICE_KEY_ID = 'device-group-key-v1';
const DB_VERSION = 2;                        // 2: the device-key store joined the record store
export const GROUP_RECORD_SEAL_VERSION = 1;
const SEAL_DOMAIN = 'PLATHO.GROUP.RECORD.SEAL.V1';
const AES_GCM_NONCE_BYTES = 12;

const utf8 = (s) => new TextEncoder().encode(s);
const cryptoApi = () => {
  const api = globalThis.crypto;
  if (!api?.subtle) throw new Error('WebCrypto is unavailable for the group record seal');
  return api;
};

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

async function openDatabase(dbName, storeName, indexedDB) {
  const request = indexedDB.open(dbName, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName);
    if (!db.objectStoreNames.contains(KEY_STORE_NAME)) db.createObjectStore(KEY_STORE_NAME, { keyPath: 'id' });
  };
  return requestToPromise(request);
}

// ── seal / open ────────────────────────────────────────────────────────────────────────────────────────────────
const sealAad = (groupId) => utf8(JSON.stringify({ domain: SEAL_DOMAIN, version: GROUP_RECORD_SEAL_VERSION, groupId: String(groupId) }));

/** The non-extractable AES-256-GCM device key that seals this device's group records. */
export async function createGroupRecordSealKey() {
  return cryptoApi().subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** One record, sealed for one group id. The blob carries raw bytes (structured-cloneable), not text. */
export async function sealGroupRecord(key, groupId, record) {
  const nonce = cryptoApi().getRandomValues(new Uint8Array(AES_GCM_NONCE_BYTES));
  const ciphertext = await cryptoApi().subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: sealAad(groupId), tagLength: 128 }, key, utf8(JSON.stringify(record)));
  return { version: GROUP_RECORD_SEAL_VERSION, alg: 'AES-256-GCM', nonce, ciphertext: new Uint8Array(ciphertext) };
}

/** The record a blob holds, or null for a blob this key (or this group id) cannot open. Never throws. */
export async function openGroupRecord(key, groupId, blob) {
  if (!blob || blob.version !== GROUP_RECORD_SEAL_VERSION || blob.alg !== 'AES-256-GCM' || !blob.ciphertext || !blob.nonce) return null;
  try {
    const plaintext = await cryptoApi().subtle.decrypt(
      { name: 'AES-GCM', iv: blob.nonce, additionalData: sealAad(groupId), tagLength: 128 }, key, blob.ciphertext);
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    return null;
  }
}

/** The in-memory form: complete, ordinary, and what every test uses. */
export function createMemoryGroupRecordStore() {
  const records = new Map();
  return {
    get type() { return 'memory'; },
    async list() { return [...records.values()].map((r) => JSON.parse(JSON.stringify(r))); },
    async get(groupId) {
      const held = records.get(String(groupId));
      return held ? JSON.parse(JSON.stringify(held)) : null;
    },
    async put(groupId, record) { records.set(String(groupId), JSON.parse(JSON.stringify(record))); },
    async remove(groupId) { records.delete(String(groupId)); },
    async clear() { records.clear(); },
  };
}

/**
 * The sealed store over an injectable blob backend — `{ list() -> [{ id, blob }], get(id) -> blob|null,
 * put(id, blob), remove(id), clear() }`. IndexedDB supplies it in production, a Map in tests. `onUnreadable(id)`
 * hears about every blob the key could not open; such a row is skipped, never returned and never overwritten by
 * this call (the caller decides whether to put a fresh record over it).
 */
export function createSealedGroupRecordStore({ key, backend, onUnreadable = null }) {
  if (!key) throw new Error('createSealedGroupRecordStore requires a seal key');
  if (!backend) throw new Error('createSealedGroupRecordStore requires a blob backend');
  const open = async (id, blob) => {
    const record = await openGroupRecord(key, id, blob);
    if (record === null && blob) { try { onUnreadable?.(id); } catch { /* advisory */ } }
    return record;
  };
  return {
    get type() { return 'sealed'; },
    async list() {
      const out = [];
      for (const { id, blob } of await backend.list()) {
        const record = await open(id, blob);
        if (record) out.push(record);
      }
      return out;
    },
    async get(groupId) {
      const blob = await backend.get(String(groupId));
      return blob ? open(String(groupId), blob) : null;
    },
    async put(groupId, record) { await backend.put(String(groupId), await sealGroupRecord(key, String(groupId), record)); },
    async remove(groupId) { await backend.remove(String(groupId)); },
    async clear() { await backend.clear(); },
  };
}

async function getOrCreateDeviceKey(db) {
  const stored = await requestToPromise(db.transaction(KEY_STORE_NAME, 'readonly').objectStore(KEY_STORE_NAME).get(DEVICE_KEY_ID));
  if (stored?.key) return stored.key;
  const key = await createGroupRecordSealKey();
  await requestToPromise(db.transaction(KEY_STORE_NAME, 'readwrite').objectStore(KEY_STORE_NAME).put({ id: DEVICE_KEY_ID, key, createdAt: Date.now() }));
  return key;
}

/**
 * The persistent form. `dbName` must already be wallet-scoped by the caller (the app does this for every store
 * that holds identity material). A store that cannot be opened answers with the memory one — the app keeps
 * working, and the next launch tries again. Every record is sealed under the database's own device key.
 */
export async function createGroupRecordStore({
  dbName = GROUP_RECORD_DB_NAME,
  storeName = GROUP_RECORD_STORE_NAME,
  indexedDB = globalThis.indexedDB,
  onUnreadable = null,
} = {}) {
  if (!indexedDB) return createMemoryGroupRecordStore();
  let db = null;
  let key = null;
  try {
    db = await openDatabase(dbName, storeName, indexedDB);
    key = await getOrCreateDeviceKey(db);
  } catch {
    return createMemoryGroupRecordStore();
  }
  const tx = (mode) => db.transaction(storeName, mode).objectStore(storeName);
  const fallback = new Map();   // what a failing IndexedDB call leaves us: this session's blobs, sealed all the same
  const guard = async (run, onFail) => {
    try { return await run(); } catch { return onFail(); }
  };
  const backend = {
    list: () => guard(async () => {
      const store = tx('readonly');
      const [ids, blobs] = await Promise.all([requestToPromise(store.getAllKeys()), requestToPromise(store.getAll())]);
      return (ids ?? []).map((id, index) => ({ id: String(id), blob: blobs?.[index] ?? null })).filter((row) => row.blob);
    }, () => [...fallback.entries()].map(([id, blob]) => ({ id, blob }))),
    get: (id) => guard(async () => (await requestToPromise(tx('readonly').get(id))) ?? null, () => fallback.get(id) ?? null),
    put: (id, blob) => guard(async () => { await requestToPromise(tx('readwrite').put(blob, id)); }, () => { fallback.set(id, blob); }),
    remove: (id) => guard(async () => { await requestToPromise(tx('readwrite').delete(id)); }, () => { fallback.delete(id); }),
    clear: () => guard(async () => { await requestToPromise(tx('readwrite').clear()); }, () => { fallback.clear(); }),
  };
  return createSealedGroupRecordStore({ key, backend, onUnreadable });
}
