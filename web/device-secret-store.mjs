
import { LEGACY_KEY_GRACE_ID, legacyGraceInClear, legacyKeyRetirement, openAtRest, openLegacyGrace, sealAtRest, sealLegacyGrace, withAtRestLock } from './at-rest-seal.mjs?v=5';

const KEY_STORE_NAME = 'deviceSecretKeys';
const BLOB_STORE_NAME = 'deviceSecrets';
const DEVICE_KEY_ID = 'device-secret-key-v1';
const DB_VERSION = 1;
const AES_GCM_NONCE_BYTES = 12;
const SEAL_VERSION = 1;
const SEAL_DOMAIN = 'PLATHO.DEVICE.SECRET.SEAL.V1';
const WALLET_SEAL_VERSION = 2;
const WALLET_SEAL_DOMAIN = 'PLATHO.WALLET.SECRET.SEAL.V2';
const WALLET_SEAL_PAD = 1024;
const walletRecordId = (id) => `${String(id)}.v2`;

const cryptoApi = () => {
  const api = globalThis.crypto;
  if (!api?.subtle) throw new Error('WebCrypto is unavailable for the device secret seal');
  return api;
};

const utf8 = (value) => new TextEncoder().encode(value);
const b64 = (bytes) => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};
const unb64 = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

const sealAad = (id) => utf8(JSON.stringify({ domain: SEAL_DOMAIN, version: SEAL_VERSION, id: String(id) }));

export function createDeviceSecretSealKey() {
  return cryptoApi().subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function sealDeviceSecret(key, id, value) {
  const nonce = cryptoApi().getRandomValues(new Uint8Array(AES_GCM_NONCE_BYTES));
  const payload = utf8(JSON.stringify({ version: SEAL_VERSION, id: String(id), value: String(value ?? '') }));
  const ciphertext = await cryptoApi().subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: sealAad(id), tagLength: 128 }, key, payload);
  return {
    id: String(id),
    version: SEAL_VERSION,
    alg: 'AES-256-GCM',
    nonce: b64(nonce),
    ciphertext: b64(new Uint8Array(ciphertext)),
  };
}

export async function openDeviceSecret(key, id, record) {
  if (!record || record.version !== SEAL_VERSION || record.alg !== 'AES-256-GCM' || !record.ciphertext) return null;
  const plaintext = await cryptoApi().subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(record.nonce), additionalData: sealAad(id), tagLength: 128 }, key, unb64(record.ciphertext));
  const payload = JSON.parse(new TextDecoder().decode(new Uint8Array(plaintext)));
  if (payload?.version !== SEAL_VERSION || String(payload?.id) !== String(id)) return null;
  const value = String(payload.value ?? '');
  return value === '' ? null : value;
}

export async function createSealedSecretStore({ key, id, readBlob, writeBlob, deleteBlob }) {
  if (!key) throw new Error('createSealedSecretStore requires a seal key');
  if (!id) throw new Error('createSealedSecretStore requires an id');
  if (typeof readBlob !== 'function' || typeof writeBlob !== 'function' || typeof deleteBlob !== 'function') {
    throw new Error('createSealedSecretStore requires readBlob/writeBlob/deleteBlob');
  }
  return {
    async read() {
      try { return await openDeviceSecret(key, id, await readBlob()); } catch { return null; }
    },
    async write(value) {
      const next = String(value ?? '').trim();
      if (next === '') { await deleteBlob(); return null; }
      await writeBlob(await sealDeviceSecret(key, id, next));
      return next;
    },
    async clear() { await deleteBlob(); },
  };
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
  });
}

async function openDb(dbName) {
  if (!globalThis.indexedDB) throw new Error('IndexedDB is unavailable');
  const request = indexedDB.open(dbName, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(KEY_STORE_NAME)) db.createObjectStore(KEY_STORE_NAME, { keyPath: 'id' });
    if (!db.objectStoreNames.contains(BLOB_STORE_NAME)) db.createObjectStore(BLOB_STORE_NAME, { keyPath: 'id' });
  };
  return reqToPromise(request);
}

async function getOrCreateSealKey(db) {
  const candidate = await createDeviceSecretSealKey();
  const tx = db.transaction(KEY_STORE_NAME, 'readwrite');
  const store = tx.objectStore(KEY_STORE_NAME);
  const stored = await reqToPromise(store.get(DEVICE_KEY_ID));
  if (stored?.key) { await txDone(tx); return stored.key; }
  store.put({ id: DEVICE_KEY_ID, key: candidate });
  await txDone(tx);
  return candidate;
}

export async function sealWalletSecret(key, id, value) {
  const sealed = await sealAtRest(key, { domain: WALLET_SEAL_DOMAIN, aad: { id: String(id) }, value: { v: WALLET_SEAL_VERSION, value: String(value ?? '') }, padTo: WALLET_SEAL_PAD, binary: true });
  return { id: walletRecordId(id), v: WALLET_SEAL_VERSION, n: sealed.n, x: sealed.x };
}

export async function openWalletSecret(key, id, record) {
  if (!record || record.v !== WALLET_SEAL_VERSION || !record.x) return null;
  const payload = await openAtRest(key, { domain: WALLET_SEAL_DOMAIN, aad: { id: String(id) }, sealed: { n: record.n, x: record.x } });
  const value = String(payload?.value ?? '');
  return value === '' ? null : value;
}

async function moveLegacySecret(db, key, id, mergeLegacy, { now = Date.now() } = {}) {
  return withAtRestLock(`platho.secrets.move.${db.name}.${id}`, async () => {
    const read = db.transaction([KEY_STORE_NAME, BLOB_STORE_NAME], 'readonly');
    const [legacy, current, device, all, graceRecord] = await Promise.all([
      reqToPromise(read.objectStore(BLOB_STORE_NAME).get(String(id))),
      reqToPromise(read.objectStore(BLOB_STORE_NAME).get(walletRecordId(id))),
      reqToPromise(read.objectStore(KEY_STORE_NAME).get(DEVICE_KEY_ID)),
      reqToPromise(read.objectStore(BLOB_STORE_NAME).getAll()),
      reqToPromise(read.objectStore(KEY_STORE_NAME).get(LEGACY_KEY_GRACE_ID)),
    ]);
    await txDone(read);
    if (!legacy && !device) return { moved: false };
    const grace = await openLegacyGrace(key, graceRecord);
    let legacyValue = null;
    let opened = false;
    if (legacy && device?.key) {
      try { legacyValue = await openDeviceSecret(device.key, id, legacy); opened = true; } catch { opened = false; }
    }
    let sealed = null;
    if (opened) {
      const currentValue = await openWalletSecret(key, id, current ?? null);
      const merged = typeof mergeLegacy === 'function' ? mergeLegacy(currentValue, legacyValue) : (currentValue ?? legacyValue);
      sealed = merged ? await sealWalletSecret(key, id, merged) : null;
      if (sealed) await openWalletSecret(key, id, sealed);
    }
    const otherLegacy = (all ?? []).some((record) => record?.version === SEAL_VERSION && record.id !== String(id));
    const { retire, graceAt } = device && !otherLegacy
      ? legacyKeyRetirement({ grace, legacyFound: opened, now })
      : { retire: false, graceAt: Number.isFinite(Number(grace?.at)) ? Number(grace.at) : null };
    const graceMoves = Boolean(device) && !otherLegacy && (retire || Number(grace?.at) !== graceAt || legacyGraceInClear(graceRecord));
    if (!legacy && !graceMoves) return { moved: false };
    const sealedGrace = graceMoves && !retire && Number.isFinite(graceAt) ? await sealLegacyGrace(key, graceAt) : null;
    const write = db.transaction([KEY_STORE_NAME, BLOB_STORE_NAME], 'readwrite');
    if (sealed) write.objectStore(BLOB_STORE_NAME).put(sealed);
    if (legacy) write.objectStore(BLOB_STORE_NAME).delete(String(id));
    if (device && retire) {
      write.objectStore(KEY_STORE_NAME).delete(DEVICE_KEY_ID);
      write.objectStore(KEY_STORE_NAME).delete(LEGACY_KEY_GRACE_ID);
    } else if (sealedGrace) {
      write.objectStore(KEY_STORE_NAME).put(sealedGrace);
    }
    await txDone(write);
    return { moved: opened, keyRetired: Boolean(device && retire) };
  });
}

export async function createIndexedDbDeviceSecretStore({ dbName, id, atRestKey = null, mergeLegacy = null, now = () => Date.now(), onLegacy = null }) {
  const db = await openDb(dbName);
  if (atRestKey) {
    try {
      const move = await moveLegacySecret(db, atRestKey, id, mergeLegacy, { now: now() });
      if (move?.moved === true) { try { onLegacy?.(); } catch { } }
    } catch (error) { console.warn('[secrets] the stored value could not be moved to the wallet\'s key yet', error); }
    const recordId = walletRecordId(id);
    return {
      async read() {
        try {
          const tx = db.transaction(BLOB_STORE_NAME, 'readonly');
          const record = await reqToPromise(tx.objectStore(BLOB_STORE_NAME).get(recordId));
          await txDone(tx);
          return await openWalletSecret(atRestKey, id, record ?? null);
        } catch { return null; }
      },
      async write(value) {
        const next = String(value ?? '').trim();
        const sealed = next === '' ? null : await sealWalletSecret(atRestKey, id, next);
        const tx = db.transaction(BLOB_STORE_NAME, 'readwrite');
        if (sealed) tx.objectStore(BLOB_STORE_NAME).put(sealed); else tx.objectStore(BLOB_STORE_NAME).delete(recordId);
        await txDone(tx);
        return sealed ? next : null;
      },
      async clear() {
        const tx = db.transaction(BLOB_STORE_NAME, 'readwrite');
        tx.objectStore(BLOB_STORE_NAME).delete(recordId);
        await txDone(tx);
      },
      close() { try { db.close(); } catch { } },
    };
  }
  const key = await getOrCreateSealKey(db);
  return createSealedSecretStore({
    key,
    id,
    readBlob: async () => {
      const tx = db.transaction(BLOB_STORE_NAME, 'readonly');
      const record = await reqToPromise(tx.objectStore(BLOB_STORE_NAME).get(String(id)));
      await txDone(tx);
      return record ?? null;
    },
    writeBlob: async (record) => {
      const tx = db.transaction(BLOB_STORE_NAME, 'readwrite');
      tx.objectStore(BLOB_STORE_NAME).put(record);
      await txDone(tx);
    },
    deleteBlob: async () => {
      const tx = db.transaction(BLOB_STORE_NAME, 'readwrite');
      tx.objectStore(BLOB_STORE_NAME).delete(String(id));
      await txDone(tx);
    },
  });
}
