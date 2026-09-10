// conv-key-persist — seal the CONV conversation key store (K_roots) at rest, mirroring encrypted-message-store's
// device-key AES-GCM model. K_roots are conversation SECRETS: derive every bucket/write key of a conversation, so
// they must NEVER touch localStorage in the clear. The whole (small) conversation map is sealed as ONE blob per
// wallet-scoped DB, under a non-extractable device key held in the same IndexedDB.
//
// SPLIT FOR TESTABILITY (same shape as encrypted-message-store): the serialize + seal/open + sealed-store logic is
// pure and driven over an injectable blob backend (tests/conv-key-persist.test.ts pins the round-trip + that the blob
// is ciphertext). createIndexedDbConvKeyStore is the thin production glue that supplies a real IndexedDB backend.

import { createConvKeyStore } from './conv-key-store.mjs?v=12';
import { tonCell } from './pwa-contract-transactions.mjs?v=47';

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
      // THE CURSOR'S GENERATION MUST REACH DISK, or the mark that outlives the build is the one thing that does
      // not [audit 2026-08-31, round 7 — a round-6 fix that was inert in production]. This serializer is a STRICT
      // WHITELIST: round 6 taught advanceConvScanCursor to record which generation the cursor was earned in, and
      // this list silently dropped it on every persist. The consumer requires a non-null value to detect a stale
      // cursor, so after any reload the rewind never fired — and a reload is exactly the event it targets (the
      // device takes the new build and restarts). Within one session both sides derive from the same baked
      // CUTOVER_EPOCH and can never disagree, so the field only means anything once it has survived a restart.
      lastScannedGeneration: r.lastScannedGeneration == null ? null : Number(r.lastScannedGeneration),
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
      // null for a record written before round 7 — which reads as "this cursor names no generation", and the
      // consumer then leaves it alone rather than rewinding on a guess. The first advance after the update
      // stamps it, and from then on a build disagreement is detectable.
      lastScannedGeneration: r.lastScannedGeneration == null ? null : Number(r.lastScannedGeneration),
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
/**
 * MERGE TWO TABS' VIEWS OF THE SAME CONVERSATION MAP.
 *
 * The persisted form is ONE sealed blob, so a write is a write of EVERYTHING — which is why a tab holding a stale
 * view erases what another tab learned. The union below is what makes a whole-map write safe:
 *
 *  • a conversation only the OTHER writer has is kept, whole. This is the erasure that mattered: a K_root adopted
 *    for a first contact the peer PAID for, gone because a sibling tab persisted a cursor.
 *  • a conversation both have takes the record with the newer `adoptedCreatedAt` — the same rule
 *    importConversations uses for a restored backup, so a re-INTRO can never be rolled back to a retired root.
 *  • the monotonic fields then take the MAX across both, whichever record won. Both tabs read the same chain for
 *    the same account into the same message store, so each cursor is an honest claim for this DEVICE; and rolling
 *    `outgoingSeq` back is not merely wasteful but wrong — the chain refuses a seq that does not advance
 *    (RecordShard gate 13653), so a rolled-back counter bounces the next send of that conversation-day.
 *  • `kRootsForRead` unions, because a root either side retired is still needed to decrypt that side's history.
 */
export function mergeConvKeyMaps(theirs, mine) {
  const merged = new Map(mine instanceof Map ? mine : []);
  if (!(theirs instanceof Map)) return merged;
  const num = (value) => (value == null ? null : Number(value));
  const maxOf = (a, b) => {
    if (a == null) return b;
    if (b == null) return a;
    return a >= b ? a : b;
  };
  for (const [id, theirRecord] of theirs) {
    const myRecord = merged.get(id);
    if (!myRecord) { merged.set(id, theirRecord); continue; }
    const theirsIsNewer = Number(theirRecord?.adoptedCreatedAt ?? 0) > Number(myRecord?.adoptedCreatedAt ?? 0);
    const base = theirsIsNewer ? theirRecord : myRecord;
    // The highest epoch either writer has fully scanned, with the generation stamp that belongs to it.
    const myEpoch = num(myRecord?.lastScannedEpoch);
    const theirEpoch = num(theirRecord?.lastScannedEpoch);
    const epoch = maxOf(myEpoch, theirEpoch);
    const generationSource = epoch == null ? base
      : (theirEpoch != null && epoch === theirEpoch ? theirRecord : myRecord);
    const outgoingSeq = { ...(myRecord?.outgoingSeq ?? {}) };
    for (const [epochKey, seq] of Object.entries(theirRecord?.outgoingSeq ?? {})) {
      const held = Number(outgoingSeq[epochKey] ?? -1);
      if (Number(seq) > held) outgoingSeq[epochKey] = Number(seq);
    }
    const roots = new Map();
    for (const entry of [...(myRecord?.kRootsForRead ?? []), ...(theirRecord?.kRootsForRead ?? [])]) {
      const hex = Array.from(entry?.kRoot ?? [], (b) => (b & 0xff).toString(16).padStart(2, '0')).join('');
      if (hex && !roots.has(hex)) roots.set(hex, entry);
    }
    merged.set(id, {
      ...base,
      lastScannedEpoch: epoch,
      lastScannedGeneration: generationSource?.lastScannedGeneration ?? null,
      outgoingSeq,
      kRootsForRead: [...roots.values()],
    });
  }
  return merged;
}

/**
 * Serialize the read-merge-write against the other tabs of this wallet. navigator.locks is the only cross-tab
 * primitive this app uses; where it is unavailable the merge still runs, which closes the erasure for every
 * interleaving except two writes overlapping to the millisecond.
 */
async function withConvKeyWriteLock(name, run) {
  const locks = globalThis.navigator?.locks;
  if (!name || typeof locks?.request !== 'function') return run();
  try {
    return await locks.request(name, run);
  } catch {
    return run();   // a lock manager that refuses must not stop the write
  }
}

export async function createSealedConvKeyStore({ key, readBlob, writeBlob, lockName = null }) {
  if (!key) throw new Error('createSealedConvKeyStore requires a seal key');
  if (typeof readBlob !== 'function' || typeof writeBlob !== 'function') {
    throw new Error('createSealedConvKeyStore requires readBlob/writeBlob');
  }
  const store = createConvKeyStore({
    // READ-MODIFY-WRITE, NOT WRITE [audit 2026-09-01, round 9]. This used to seal the caller's map and put it
    // down whole. With one blob for the whole map and no cross-tab coordination anywhere in this app, that meant
    // a tab which hydrated at boot erased everything every other tab had learned since — MEASURED: tab 1 adopts a
    // conversation, tab 2 advances an unrelated cursor, and the conversation is gone from disk in three writes.
    // The chance arrives every sync tick (12-60 s), because a quiet conversation persists its cursor on each one.
    // The merged map is returned so the writing tab stops being stale at the moment it writes.
    persist: async (map) => withConvKeyWriteLock(lockName, async () => {
      const onDisk = await openConvKeyMap(key, await readBlob());
      const merged = mergeConvKeyMaps(onDisk, map);
      await writeBlob(await sealConvKeyMap(key, merged));
      return merged;
    }),
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
    // Scoped to this wallet's database, so two wallets' stores never wait on each other.
    lockName: `platho.convkeys.${dbName}`,
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
