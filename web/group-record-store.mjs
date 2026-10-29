import { LEGACY_KEY_GRACE_ID, atRestTag, legacyGraceInClear, legacyKeyRetirement, openAtRest, openLegacyGrace, sealAtRest, sealLegacyGrace, withAtRestLock } from './at-rest-seal.mjs?v=5';

export const GROUP_RECORD_DB_NAME = 'platho-groups-v1';
export const PUBLIC_GROUP_RECORD_DB_NAME = 'platho-public-groups-v1';
export const GROUP_REQUEST_DB_NAME = 'platho-group-requests-v1';
export const GROUP_REQUEST_STORE_NAME = 'requests';
export const GROUP_RECORD_STORE_NAME = 'groups';
const KEY_STORE_NAME = 'deviceKey';
const LEGACY_DEVICE_KEY_ID = 'device-group-key-v1';
const DB_VERSION = 2;
export const GROUP_RECORD_SEAL_VERSION = 2;
const LEGACY_SEAL_VERSION = 1;
const SEAL_DOMAIN = 'PLATHO.GROUP.RECORD.SEAL.V2';
const LEGACY_SEAL_DOMAIN = 'PLATHO.GROUP.RECORD.SEAL.V1';
const ROW_TAG_PURPOSE = 'group-store.row';
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

export function groupRowTag(keys, rowKey) {
  return atRestTag(keys.index, ROW_TAG_PURPOSE, String(rowKey));
}

export async function sealGroupRecord(keys, tag, record) {
  const sealed = await sealAtRest(keys.seal, { domain: SEAL_DOMAIN, aad: { tag: String(tag) }, value: record, padTo: 1024, binary: true });
  return { v: GROUP_RECORD_SEAL_VERSION, n: sealed.n, x: sealed.x };
}

export async function openGroupRecord(keys, tag, blob) {
  if (!blob || blob.v !== GROUP_RECORD_SEAL_VERSION || !blob.x) return null;
  try {
    return await openAtRest(keys.seal, { domain: SEAL_DOMAIN, aad: { tag: String(tag) }, sealed: { n: blob.n, x: blob.x } });
  } catch {
    return null;
  }
}

const legacySealAad = (groupId) => utf8(JSON.stringify({ domain: LEGACY_SEAL_DOMAIN, version: LEGACY_SEAL_VERSION, groupId: String(groupId) }));

export async function createLegacyGroupRecordSealKey() {
  return cryptoApi().subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function sealLegacyGroupRecord(key, groupId, record) {
  const nonce = cryptoApi().getRandomValues(new Uint8Array(AES_GCM_NONCE_BYTES));
  const ciphertext = await cryptoApi().subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: legacySealAad(groupId), tagLength: 128 }, key, utf8(JSON.stringify(record)));
  return { version: LEGACY_SEAL_VERSION, alg: 'AES-256-GCM', nonce, ciphertext: new Uint8Array(ciphertext) };
}

async function openLegacyGroupRecord(key, groupId, blob) {
  if (!blob || blob.version !== LEGACY_SEAL_VERSION || blob.alg !== 'AES-256-GCM' || !blob.ciphertext || !blob.nonce) return null;
  try {
    const plaintext = await cryptoApi().subtle.decrypt(
      { name: 'AES-GCM', iv: blob.nonce, additionalData: legacySealAad(groupId), tagLength: 128 }, key, blob.ciphertext);
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    return null;
  }
}

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

export function createSealedGroupRecordStore({ keys, backend, onUnreadable = null }) {
  if (!keys?.seal || !keys?.index) throw new Error('createSealedGroupRecordStore requires the wallet\'s at-rest keys');
  if (!backend) throw new Error('createSealedGroupRecordStore requires a blob backend');
  const tags = new Map();
  const tagOf = async (rowKey) => {
    const key = String(rowKey);
    let tag = tags.get(key);
    if (!tag) { tag = await groupRowTag(keys, key); tags.set(key, tag); }
    return tag;
  };
  const open = async (tag, blob) => {
    if (blob?.version === LEGACY_SEAL_VERSION) return null;
    const record = await openGroupRecord(keys, tag, blob);
    if (record === null && blob) { try { onUnreadable?.(tag); } catch { } }
    return record;
  };
  return {
    get type() { return 'sealed'; },
    async list() {
      const out = [];
      for (const { id, blob } of await backend.list()) {
        // eslint-disable-next-line no-await-in-loop
        const record = await open(id, blob);
        if (record) out.push(record);
      }
      return out;
    },
    async get(groupId) {
      const tag = await tagOf(groupId);
      const blob = await backend.get(tag);
      return blob ? open(tag, blob) : null;
    },
    async put(groupId, record) {
      const tag = await tagOf(groupId);
      await backend.put(tag, await sealGroupRecord(keys, tag, record));
    },
    async remove(groupId) { await backend.remove(await tagOf(groupId)); },
    async clear() { await backend.clear(); },
  };
}

export function createGroupRequestQueue(store) {
  if (!store) throw new Error('createGroupRequestQueue requires a sealed store');
  const rowId = (groupId, keyHex) => `${String(groupId)}:${String(keyHex)}`;
  return {
    async list(groupId) {
      const wanted = String(groupId);
      const rows = await store.list();
      return rows.filter((row) => String(row?.g) === wanted).map((row) => row.c).filter(Boolean);
    },
    async add(groupId, row) {
      await store.put(rowId(groupId, row.groupKey), { v: 1, g: String(groupId), c: row });
    },
    async remove(groupId, keyHex) {
      await store.remove(rowId(groupId, keyHex));
    },
  };
}

const isTagRowId = (id) => /^[A-Za-z0-9_-]{22}$/.test(String(id));

async function moveLegacyRows(db, storeName, keys, lockName, { mergeRows = null, now = Date.now() } = {}) {
  return withAtRestLock(lockName, async () => {
    const read = db.transaction([storeName, KEY_STORE_NAME], 'readonly');
    const [ids, device, graceRecord] = await Promise.all([
      requestToPromise(read.objectStore(storeName).getAllKeys()),
      requestToPromise(read.objectStore(KEY_STORE_NAME).get(LEGACY_DEVICE_KEY_ID)),
      requestToPromise(read.objectStore(KEY_STORE_NAME).get(LEGACY_KEY_GRACE_ID)),
    ]);
    const legacyIds = (ids ?? []).map(String).filter((id) => !isTagRowId(id));
    if (legacyIds.length === 0 && !device) return { moved: 0, dropped: 0 };
    const grace = await openLegacyGrace(keys.seal, graceRecord);
    const held = new Set((ids ?? []).map(String).filter(isTagRowId));
    const legacy = [];
    if (legacyIds.length > 0 && device?.key) {
      const rows = db.transaction(storeName, 'readonly').objectStore(storeName);
      const blobs = await Promise.all(legacyIds.map((id) => requestToPromise(rows.get(id))));
      legacyIds.forEach((id, index) => { if (blobs[index]?.version === LEGACY_SEAL_VERSION) legacy.push({ id, blob: blobs[index] }); });
    }
    const puts = [];
    const deletes = device?.key ? [] : [...legacyIds];
    let moved = 0;
    for (const row of legacy) {
      // eslint-disable-next-line no-await-in-loop
      const record = await openLegacyGroupRecord(device.key, row.id, row.blob);
      if (record === null) { deletes.push(row.id); continue; }
      // eslint-disable-next-line no-await-in-loop
      const tag = await groupRowTag(keys, row.id);
      let next = record;
      if (held.has(tag)) {
        if (typeof mergeRows !== 'function') { deletes.push(row.id); continue; }
        // eslint-disable-next-line no-await-in-loop
        const current = await openGroupRecord(keys, tag, await requestToPromise(db.transaction(storeName, 'readonly').objectStore(storeName).get(tag)));
        if (current === null) { deletes.push(row.id); continue; }
        try { next = mergeRows(current, record); } catch { deletes.push(row.id); continue; }
      }
      // eslint-disable-next-line no-await-in-loop
      const blob = await sealGroupRecord(keys, tag, next);
      // eslint-disable-next-line no-await-in-loop
      if ((await openGroupRecord(keys, tag, blob)) === null) continue;
      puts.push([tag, blob]);
      deletes.push(row.id);
      moved += 1;
    }
    const { retire, graceAt } = device ? legacyKeyRetirement({ grace, legacyFound: legacy.length > 0, now }) : { retire: false, graceAt: null };
    const graceMoves = Boolean(device) && (retire || Number(grace?.at) !== graceAt || legacyGraceInClear(graceRecord));
    if (puts.length === 0 && deletes.length === 0 && !graceMoves) return { moved: 0, dropped: 0 };
    const sealedGrace = graceMoves && !retire && Number.isFinite(graceAt) ? await sealLegacyGrace(keys.seal, graceAt) : null;
    const write = db.transaction([storeName, KEY_STORE_NAME], 'readwrite');
    const target = write.objectStore(storeName);
    for (const [tag, blob] of puts) target.put(blob, tag);
    for (const id of deletes) target.delete(id);
    if (device && retire) {
      write.objectStore(KEY_STORE_NAME).delete(LEGACY_DEVICE_KEY_ID);
      write.objectStore(KEY_STORE_NAME).delete(LEGACY_KEY_GRACE_ID);
    } else if (sealedGrace) {
      write.objectStore(KEY_STORE_NAME).put(sealedGrace);
    }
    await new Promise((resolve, reject) => { write.oncomplete = resolve; write.onerror = () => reject(write.error); write.onabort = () => reject(write.error); });
    return { moved, dropped: deletes.length - moved, keyRetired: Boolean(device && retire) };
  });
}

export async function createGroupRecordStore({
  dbName = GROUP_RECORD_DB_NAME,
  storeName = GROUP_RECORD_STORE_NAME,
  indexedDB = globalThis.indexedDB,
  onUnreadable = null,
  keys = null,
  mergeRows = null,
  now = () => Date.now(),
  onLegacy = null,
} = {}) {
  if (!keys?.seal || !keys?.index) throw new Error('the group record store needs the wallet\'s at-rest keys');
  if (!indexedDB) return createMemoryGroupRecordStore();
  let db = null;
  try {
    db = await openDatabase(dbName, storeName, indexedDB);
  } catch {
    return createMemoryGroupRecordStore();
  }
  try {
    const move = await moveLegacyRows(db, storeName, keys, `platho.groups.move.${dbName}.${storeName}`, { mergeRows, now: now() });
    if ((move?.moved ?? 0) > 0 || (move?.dropped ?? 0) > 0) { try { onLegacy?.(); } catch { } }
  } catch (error) {
    console.warn('[groups] the stored rooms could not be moved to the wallet\'s key yet; the next open tries again', error);
  }
  const tx = (mode) => db.transaction(storeName, mode).objectStore(storeName);
  const write = (op) => new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    let result;
    const request = op(transaction.objectStore(storeName));
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () => reject(transaction.error ?? request.error ?? new Error('IndexedDB transaction aborted'));
    transaction.onerror = () => { };
  });
  const fallback = new Map();
  const guard = async (run, onFail, { rethrow = false } = {}) => {
    try { return await run(); } catch (error) { const out = onFail(); if (rethrow) throw error; return out; }
  };
  const fallbackRows = () => [...fallback.entries()].map(([id, blob]) => ({ id, blob }));
  const backend = {
    list: () => guard(async () => {
      const store = tx('readonly');
      const [ids, blobs] = await Promise.all([requestToPromise(store.getAllKeys()), requestToPromise(store.getAll())]);
      const rows = (ids ?? []).map((id, index) => ({ id: String(id), blob: blobs?.[index] ?? null })).filter((row) => row.blob && !fallback.has(row.id));
      return [...rows, ...fallbackRows()];
    }, fallbackRows),
    get: (id) => (fallback.has(String(id)) ? Promise.resolve(fallback.get(String(id))) : guard(async () => (await requestToPromise(tx('readonly').get(id))) ?? null, () => null)),
    put: (id, blob) => guard(async () => { await write((store) => store.put(blob, id)); fallback.delete(String(id)); }, () => { fallback.set(String(id), blob); }, { rethrow: true }),
    remove: (id) => guard(async () => { await write((store) => store.delete(id)); fallback.delete(String(id)); }, () => { fallback.delete(String(id)); }, { rethrow: true }),
    clear: () => guard(async () => { await write((store) => store.clear()); fallback.clear(); }, () => { fallback.clear(); }, { rethrow: true }),
  };
  return createSealedGroupRecordStore({ keys, backend, onUnreadable });
}
