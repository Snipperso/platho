
import { generationForEpoch, generationForEpochAt } from './cutover-epoch.mjs?v=7';
import { openAtRest, sealAtRest } from './at-rest-seal.mjs?v=5';

const DEFAULT_DB_NAME = 'platho-local-security-v1';
const LEGACY_SHARED_DB_NAME = 'platho-local-security-v1';
const DEFAULT_STORE_NAME = 'introScanCursors';
const RECORD_KEYS = Object.freeze(['cursors', 'delivered', 'meta']);
const SEALED_DELIVERED_KEY = 'delivered.v2';
const LEDGER_DOMAIN = 'PLATHO.INTRO.DELIVERED.SEAL.V2';
const SEALED_META_KEY = 'meta.v2';
const META_DOMAIN = 'PLATHO.INTRO.SCAN.META.SEAL.V2';
const SEALED_CURSORS_KEY = 'cursors.v2';
const CURSORS_DOMAIN = 'PLATHO.INTRO.SCAN.CURSORS.SEAL.V2';
const SEAL_PAD = 1024;

export const deliveryKey = ({ epoch, bucket, entryId, boundary }) => {
  const generation = boundary === undefined
    ? generationForEpoch(Number(epoch))
    : generationForEpochAt(Number(epoch), boundary);
  return generation === 17
    ? `${epoch}:${bucket}:${entryId}`
    : `${epoch}:${bucket}:${entryId}:${generation}`;
};

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
  const db = await requestToPromise(request);
  db.onversionchange = () => { try { db.close(); } catch { } };
  return db;
}

async function adoptLegacyRecords(indexedDB, storeName, put) {
  let legacy = null;
  try {
    legacy = await requestToPromise(indexedDB.open(LEGACY_SHARED_DB_NAME));
  } catch { return false; }
  try {
    if (!legacy.objectStoreNames.contains(storeName)) {
      const created = legacy.version === 1 && legacy.objectStoreNames.length === 0;
      legacy.close();
      if (created) { try { indexedDB.deleteDatabase(LEGACY_SHARED_DB_NAME); } catch { } }
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
    const write = legacy.transaction(storeName, 'readwrite').objectStore(storeName);
    for (const [key] of carried) await requestToPromise(write.delete(key));
    legacy.close();
    return true;
  } catch {
    try { legacy.close(); } catch { }
    return false;
  }
}

export async function createIntroCursorStore({
  dbName = DEFAULT_DB_NAME,
  storeName = DEFAULT_STORE_NAME,
  indexedDB = globalThis.indexedDB,
  ledgerKey = null,
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

  if (dbName !== LEGACY_SHARED_DB_NAME) {
    try {
      const existing = await withStore('readonly', (store) => Promise.all([requestToPromise(store.get('cursors')), requestToPromise(store.get(SEALED_CURSORS_KEY))]));
      if (existing.every((value) => value === undefined || value === null)) {
        await adoptLegacyRecords(indexedDB, storeName, (key, value) => withStore('readwrite', (store) => requestToPromise(store.put(value, key))));
      }
    } catch { }
  }

  return {
    async load() {
      try {
        const [plain, sealed] = await withStore('readonly', (store) => Promise.all([
          requestToPromise(store.get('cursors')),
          ledgerKey ? requestToPromise(store.get(SEALED_CURSORS_KEY)) : Promise.resolve(null),
        ]));
        let raw = plain;
        if (ledgerKey && sealed) {
          const opened = await openAtRest(ledgerKey, { domain: CURSORS_DOMAIN, sealed }).catch(() => null);
          if (opened && typeof opened.cursors === 'object') raw = opened.cursors;
        }
        const out = new Map();
        for (const [key, value] of Object.entries(raw ?? {})) out.set(key, cursorEntry(value?.marker, value?.nextId));
        return out;
      } catch { return new Map(); }
    },
    async save(next) {
      const plain = {};
      for (const [key, value] of next) plain[key] = cursorEntry(value?.marker, value?.nextId);
      try {
        if (ledgerKey) {
          const sealed = await sealAtRest(ledgerKey, { domain: CURSORS_DOMAIN, value: { cursors: plain }, padTo: SEAL_PAD });
          await withStore('readwrite', (store) => { store.put(sealed, SEALED_CURSORS_KEY); return requestToPromise(store.delete('cursors')); });
        } else {
          await withStore('readwrite', (store) => requestToPromise(store.put(plain, 'cursors')));
        }
      } catch { }
    },
    async loadDelivered() {
      const out = new Map();
      try {
        const [plain, sealed] = await withStore('readonly', (store) => Promise.all([
          requestToPromise(store.get('delivered')),
          ledgerKey ? requestToPromise(store.get(SEALED_DELIVERED_KEY)) : Promise.resolve(null),
        ]));
        for (const [key, epoch] of Object.entries(plain ?? {})) out.set(key, Number(epoch));
        if (ledgerKey && sealed) {
          const opened = await openAtRest(ledgerKey, { domain: LEDGER_DOMAIN, sealed }).catch(() => null);
          for (const [key, epoch] of Object.entries(opened?.delivered ?? {})) out.set(key, Math.max(Number(epoch), out.get(key) ?? -Infinity));
        }
      } catch { }
      return out;
    },
    async saveDelivered(next) {
      const plain = {};
      for (const [key, epoch] of next) plain[key] = Number(epoch);
      try {
        if (ledgerKey) {
          const sealed = await sealAtRest(ledgerKey, { domain: LEDGER_DOMAIN, value: { delivered: plain }, padTo: SEAL_PAD });
          await withStore('readwrite', (store) => { store.put(sealed, SEALED_DELIVERED_KEY); return requestToPromise(store.delete('delivered')); });
        } else {
          await withStore('readwrite', (store) => requestToPromise(store.put(plain, 'delivered')));
        }
      } catch { }
    },
    async loadMeta() {
      try {
        const [plain, sealed] = await withStore('readonly', (store) => Promise.all([
          requestToPromise(store.get('meta')),
          ledgerKey ? requestToPromise(store.get(SEALED_META_KEY)) : Promise.resolve(null),
        ]));
        if (ledgerKey && sealed) {
          const opened = await openAtRest(ledgerKey, { domain: META_DOMAIN, sealed }).catch(() => null);
          if (opened && typeof opened === 'object') return { ...(opened.meta ?? {}) };
        }
        return plain ?? {};
      } catch { return {}; }
    },
    async saveMeta(next) {
      try {
        if (ledgerKey) {
          const sealed = await sealAtRest(ledgerKey, { domain: META_DOMAIN, value: { meta: { ...next } }, padTo: SEAL_PAD });
          await withStore('readwrite', (store) => { store.put(sealed, SEALED_META_KEY); return requestToPromise(store.delete('meta')); });
        } else {
          await withStore('readwrite', (store) => requestToPromise(store.put({ ...next }, 'meta')));
        }
      } catch { }
    },
    async clear() {
      try { await withStore('readwrite', (store) => requestToPromise(store.clear())); } catch { }
    },
    get type() { return 'indexeddb'; },
  };
}

export function pruneCursors(cursors, keyEpochs, oldestUsefulEpoch, { sawWholeWindow = false } = {}) {
  const kept = new Map();
  for (const [key, value] of cursors) {
    const epoch = keyEpochs.get(key);
    if (epoch !== undefined) {
      if (epoch >= oldestUsefulEpoch) kept.set(key, value);
      continue;
    }
    if (!sawWholeWindow) kept.set(key, value);
  }
  return kept;
}

export function pruneDelivered(delivered, oldestUsefulEpoch) {
  const kept = new Map();
  for (const [key, epoch] of delivered) if (Number(epoch) >= oldestUsefulEpoch) kept.set(key, Number(epoch));
  return kept;
}
