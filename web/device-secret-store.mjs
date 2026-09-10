// device-secret-store — a small named secret, sealed at rest under a non-extractable device key.
//
// WHY IT EXISTS. The node API key was written to localStorage as ordinary text: a value that any inspection of the
// browser profile, any backup of it, and anything that can read that file at all hands over verbatim. It is not
// money and not identity — it is a rate-limit token for a public provider — but "stored in the clear" is not a
// posture this app takes anywhere else, and the app's own privacy policy had to be corrected to admit it.
// [decided 2026-08-29]
//
// WHAT IT BUYS, EXACTLY, so nobody reads more into it than is there. The seal key is generated on the device,
// non-extractable, and lives in the same IndexedDB as the ciphertext — the model encrypted-message-store and
// conv-key-persist already use for message history and K_roots. It removes the secret from a plain-text store, so
// reading the profile's files no longer yields the value; it is NOT a defence against code running on this origin,
// which can always ask the browser to decrypt. Binding the key to the user's PASSWORD would be stronger and is
// deliberately not done here: this value is needed BEFORE unlock (the public feed and every boot read use it), and
// a keyed transport that only starts working after unlock would make the app slower for exactly the users who
// bothered to supply a key.
//
// SAME SHAPE as conv-key-persist on purpose: pure seal/open over an injectable blob backend, with a thin IndexedDB
// glue underneath, so the round-trip and the ciphertext are testable without a browser. This is the generic one of
// the three; when either of the others is next touched, it is the one to collapse them into.

const KEY_STORE_NAME = 'deviceSecretKeys';
const BLOB_STORE_NAME = 'deviceSecrets';
const DEVICE_KEY_ID = 'device-secret-key-v1';
const DB_VERSION = 1;
const AES_GCM_NONCE_BYTES = 12;
const SEAL_VERSION = 1;
const SEAL_DOMAIN = 'PLATHO.DEVICE.SECRET.SEAL.V1';

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

// THE ID IS INSIDE THE AAD, not only in the record key. Without it a sealed record could be moved from one named
// secret to another by whoever can write the database, and the open would accept it: same key, same domain.
const sealAad = (id) => utf8(JSON.stringify({ domain: SEAL_DOMAIN, version: SEAL_VERSION, id: String(id) }));

/** The non-extractable AES-256-GCM device key that seals every secret in one store. */
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

/**
 * Open a sealed record. Returns null for a missing / foreign / unsupported one — a fresh device simply has no
 * secret — and throws only when a ciphertext IS present and will not decrypt, which means tampering or a key that
 * is not the one that sealed it.
 */
export async function openDeviceSecret(key, id, record) {
  if (!record || record.version !== SEAL_VERSION || record.alg !== 'AES-256-GCM' || !record.ciphertext) return null;
  const plaintext = await cryptoApi().subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(record.nonce), additionalData: sealAad(id), tagLength: 128 }, key, unb64(record.ciphertext));
  const payload = JSON.parse(new TextDecoder().decode(new Uint8Array(plaintext)));
  if (payload?.version !== SEAL_VERSION || String(payload?.id) !== String(id)) return null;
  const value = String(payload.value ?? '');
  return value === '' ? null : value;
}

/**
 * A named secret over an injectable blob backend. `read()` returns the value or null; `write(value)` seals it;
 * writing an empty value clears the record rather than storing an empty ciphertext.
 */
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

// ── IndexedDB production backend ───────────────────────────────────────────────────────────────────────────────
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
  const read = db.transaction(KEY_STORE_NAME, 'readonly');
  const stored = await reqToPromise(read.objectStore(KEY_STORE_NAME).get(DEVICE_KEY_ID));
  await txDone(read);
  if (stored?.key) return stored.key;
  const key = await createDeviceSecretSealKey();
  const write = db.transaction(KEY_STORE_NAME, 'readwrite');
  write.objectStore(KEY_STORE_NAME).put({ id: DEVICE_KEY_ID, key, createdAt: Date.now() });
  await txDone(write);
  return key;
}

/** Production glue: one named secret in a real IndexedDB, sealed under the store's device key. */
export async function createIndexedDbDeviceSecretStore({ dbName, id }) {
  const db = await openDb(dbName);
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
