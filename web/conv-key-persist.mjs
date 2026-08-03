// conv-key-persist — seal the CONV conversation key store (K_roots) at rest, mirroring encrypted-message-store's
// device-key AES-GCM model. K_roots are conversation SECRETS: derive every bucket/write key of a conversation, so
// they must NEVER touch localStorage in the clear. The whole (small) conversation map is sealed as ONE blob per
// wallet-scoped DB, under a non-extractable device key held in the same IndexedDB.
//
// SPLIT FOR TESTABILITY (same shape as encrypted-message-store): the serialize + seal/open + sealed-store logic is
// pure and driven over an injectable blob backend (tests/conv-key-persist.test.ts pins the round-trip + that the blob
// is ciphertext). createIndexedDbConvKeyStore is the thin production glue that supplies a real IndexedDB backend.

import { createConvKeyStore } from './conv-key-store.mjs?v=2';
import { tonCell } from './pwa-contract-transactions.mjs?v=33';

const KEY_STORE_NAME = 'convKeys';
const BLOB_STORE_NAME = 'convKeyBlob';
const DEVICE_KEY_ID = 'device-conv-key-v1';
const BLOB_ID = 'conv-key-map-v1';
const DB_VERSION = 1;
const AES_GCM_NONCE_BYTES = 12;
const SEAL_VERSION = 1;
const SEAL_DOMAIN = 'PLATHO.CONVKEY.SEAL.V1';

const b64 = (bytes) => tonCell.bytesToBase64(bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes));
const unb64 = (value) => tonCell.base64ToBytes(value);
const utf8 = (s) => new TextEncoder().encode(s);
const cryptoApi = () => {
  const api = globalThis.crypto;
  if (!api?.subtle) throw new Error('WebCrypto is unavailable for the conv key store seal');
  return api;
};

// ── serialize ──────────────────────────────────────────────────────────────────────────────────────────────────
// The conv record holds raw byte fields (K_roots, key ids, nonce) that JSON cannot carry, so each is base64'd here and
// restored to a Uint8Array on load — the store's derivation code (outgoingRecordShard etc.) requires real bytes back.

export function serializeConvKeyMap(map) {
  const out = {};
  for (const [convId, r] of map) {
    out[convId] = {
      kRootCurrent: b64(r.kRootCurrent),
      kRootsForRead: (r.kRootsForRead ?? []).map((e) => ({ kRoot: b64(e.kRoot), adoptedAt: e.adoptedAt ?? null })),
      peerKeyId: b64(r.peerKeyId),
      peerEncPublicKey: r.peerEncPublicKey ? b64(r.peerEncPublicKey) : null,
      peerWallet: r.peerWallet ?? null,
      adoptedCreatedAt: Number(r.adoptedCreatedAt ?? 0),
      adoptedIntroNonce: b64(r.adoptedIntroNonce),
      outgoingSeq: { ...(r.outgoingSeq ?? {}) },
      lastScannedEpoch: r.lastScannedEpoch == null ? null : Number(r.lastScannedEpoch),
    };
  }
  return out;
}

export function deserializeConvKeyMap(obj) {
  const map = new Map();
  for (const [convId, r] of Object.entries(obj ?? {})) {
    map.set(convId, {
      kRootCurrent: unb64(r.kRootCurrent),
      kRootsForRead: (r.kRootsForRead ?? []).map((e) => ({ kRoot: unb64(e.kRoot), adoptedAt: e.adoptedAt ?? null })),
      peerKeyId: unb64(r.peerKeyId),
      peerEncPublicKey: r.peerEncPublicKey ? unb64(r.peerEncPublicKey) : null,
      peerWallet: r.peerWallet ?? null,
      adoptedCreatedAt: Number(r.adoptedCreatedAt ?? 0),
      adoptedIntroNonce: unb64(r.adoptedIntroNonce),
      outgoingSeq: { ...(r.outgoingSeq ?? {}) },
      lastScannedEpoch: r.lastScannedEpoch == null ? null : Number(r.lastScannedEpoch),
    });
  }
  return map;
}

// ── seal / open ────────────────────────────────────────────────────────────────────────────────────────────────
const sealAad = () => utf8(JSON.stringify({ domain: SEAL_DOMAIN, version: SEAL_VERSION }));

/** Generate the non-extractable AES-256-GCM device key that seals the conv key blob. */
export function createConvKeySealKey() {
  return cryptoApi().subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function sealConvKeyMap(key, map) {
  const nonce = cryptoApi().getRandomValues(new Uint8Array(AES_GCM_NONCE_BYTES));
  const payload = utf8(JSON.stringify({ version: SEAL_VERSION, map: serializeConvKeyMap(map) }));
  const ciphertext = await cryptoApi().subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: sealAad(), tagLength: 128 }, key, payload);
  return { id: BLOB_ID, version: SEAL_VERSION, alg: 'AES-256-GCM', nonce: b64(nonce), ciphertext: b64(new Uint8Array(ciphertext)) };
}

/** Open a sealed conv key blob to a Map. Returns an EMPTY map for a missing/foreign/unsupported record (a fresh
 *  device just starts empty); throws only if the ciphertext is present but fails to decrypt (tamper / wrong key). */
export async function openConvKeyMap(key, record) {
  if (!record || record.version !== SEAL_VERSION || record.alg !== 'AES-256-GCM' || !record.ciphertext) return new Map();
  const nonce = unb64(record.nonce);
  const plaintext = await cryptoApi().subtle.decrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: sealAad(), tagLength: 128 }, key, unb64(record.ciphertext));
  const payload = JSON.parse(new TextDecoder().decode(new Uint8Array(plaintext)));
  if (payload?.version !== SEAL_VERSION) return new Map();
  return deserializeConvKeyMap(payload.map);
}

// ── sealed store over an injectable blob backend ───────────────────────────────────────────────────────────────
/**
 * A conv key store whose K_roots are sealed at rest. `key` is the AES-GCM device key; `readBlob()`/`writeBlob(record)`
 * are the storage backend (IndexedDB in production, an in-memory closure in tests). The whole map is re-sealed on every
 * mutation — cheap, because a user's active conversation set is small — and hydrated once via the store's own load().
 */
export async function createSealedConvKeyStore({ key, readBlob, writeBlob }) {
  if (!key) throw new Error('createSealedConvKeyStore requires a seal key');
  if (typeof readBlob !== 'function' || typeof writeBlob !== 'function') {
    throw new Error('createSealedConvKeyStore requires readBlob/writeBlob');
  }
  const store = createConvKeyStore({
    persist: async (map) => { await writeBlob(await sealConvKeyMap(key, map)); },
    load: async () => openConvKeyMap(key, await readBlob()),
  });
  await store.load();
  return store;
}

// ── IndexedDB production backend ───────────────────────────────────────────────────────────────────────────────
function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}
async function openConvKeyDb(dbName) {
  if (!globalThis.indexedDB) throw new Error('IndexedDB is unavailable');
  const openRequest = indexedDB.open(dbName, DB_VERSION);
  openRequest.onupgradeneeded = () => {
    const db = openRequest.result;
    if (!db.objectStoreNames.contains(KEY_STORE_NAME)) db.createObjectStore(KEY_STORE_NAME, { keyPath: 'id' });
    if (!db.objectStoreNames.contains(BLOB_STORE_NAME)) db.createObjectStore(BLOB_STORE_NAME, { keyPath: 'id' });
  };
  return reqToPromise(openRequest);
}
async function getOrCreateDeviceKey(db) {
  const readTx = db.transaction(KEY_STORE_NAME, 'readonly');
  const stored = await reqToPromise(readTx.objectStore(KEY_STORE_NAME).get(DEVICE_KEY_ID));
  await txDone(readTx);
  if (stored?.key) return stored.key;
  const key = await createConvKeySealKey();
  const writeTx = db.transaction(KEY_STORE_NAME, 'readwrite');
  writeTx.objectStore(KEY_STORE_NAME).put({ id: DEVICE_KEY_ID, key, createdAt: Date.now() });
  await txDone(writeTx);
  return key;
}

/** The production conv key store: sealed, persisted in a wallet-scoped IndexedDB. Falls back to memory at the caller. */
export async function createIndexedDbConvKeyStore({ dbName }) {
  const db = await openConvKeyDb(dbName);
  const key = await getOrCreateDeviceKey(db);
  return createSealedConvKeyStore({
    key,
    readBlob: async () => {
      const tx = db.transaction(BLOB_STORE_NAME, 'readonly');
      const record = await reqToPromise(tx.objectStore(BLOB_STORE_NAME).get(BLOB_ID));
      await txDone(tx);
      return record ?? null;
    },
    writeBlob: async (record) => {
      const tx = db.transaction(BLOB_STORE_NAME, 'readwrite');
      tx.objectStore(BLOB_STORE_NAME).put(record);
      await txDone(tx);
    },
  });
}
