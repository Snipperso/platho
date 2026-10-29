
import { createConvKeyStore, OUTGOING_SEQ_KEEP_EPOCHS, walletList } from './conv-key-store.mjs?v=27';
import { tonCell } from './pwa-contract-transactions.mjs?v=59';
import { LEGACY_KEY_GRACE_ID, legacyGraceInClear, legacyKeyRetirement, openAtRest, openLegacyGrace, sealAtRest, sealLegacyGrace, withAtRestLock } from './at-rest-seal.mjs?v=5';

const KEY_STORE_NAME = 'convKeys';
const BLOB_STORE_NAME = 'convKeyBlob';
const LEGACY_DEVICE_KEY_ID = 'device-conv-key-v1';
const LEGACY_BLOB_ID = 'conv-key-map-v1';
const BLOB_ID = 'conv-key-map-v2';
const DB_VERSION = 1;
const AES_GCM_NONCE_BYTES = 12;
const LEGACY_SEAL_VERSION = 1;
const LEGACY_SEAL_DOMAIN = 'PLATHO.CONVKEY.SEAL.V1';
const SEAL_VERSION = 2;
const SEAL_DOMAIN = 'PLATHO.CONVKEY.SEAL.V2';

const b64 = (bytes) => tonCell.bytesToBase64(bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes));
const unb64 = (value) => tonCell.base64ToBytes(value);
const utf8 = (s) => new TextEncoder().encode(s);
const cryptoApi = () => {
  const api = globalThis.crypto;
  if (!api?.subtle) throw new Error('WebCrypto is unavailable for the conv key store seal');
  return api;
};


export function serializeConvKeyMap(map) {
  const out = {};
  for (const [convId, r] of map) {
    out[convId] = {
      kRootCurrent: b64(r.kRootCurrent),
      kRootsForRead: (r.kRootsForRead ?? []).map((e) => ({ kRoot: b64(e.kRoot), adoptedAt: e.adoptedAt ?? null })),
      peerKeyId: b64(r.peerKeyId),
      peerEncPublicKey: r.peerEncPublicKey ? b64(r.peerEncPublicKey) : null,
      peerWallet: r.peerWallet ?? null,
      peerWalletCandidates: Array.isArray(r.peerWalletCandidates) ? r.peerWalletCandidates.map((s) => String(s)) : [],
      adoptedCreatedAt: Number(r.adoptedCreatedAt ?? 0),
      adoptedIntroNonce: b64(r.adoptedIntroNonce),
      outgoingSeq: { ...(r.outgoingSeq ?? {}) },
      lastScannedEpoch: r.lastScannedEpoch == null ? null : Number(r.lastScannedEpoch),
      lastScannedGeneration: r.lastScannedGeneration == null ? null : Number(r.lastScannedGeneration),
      gapFloors: gapFloorsOf(r.gapFloors),
      retiredIntroNonces: (r.retiredIntroNonces ?? []).map((n) => b64(n)),
    };
  }
  return out;
}

function gapFloorsOf(value) {
  const out = {};
  if (!value || typeof value !== 'object') return out;
  for (const [address, floor] of Object.entries(value)) {
    if (address && Number.isSafeInteger(Number(floor))) out[address] = Number(floor);
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
      peerWalletCandidates: Array.isArray(r.peerWalletCandidates) ? r.peerWalletCandidates.map((s) => String(s)) : [],
      adoptedCreatedAt: Number(r.adoptedCreatedAt ?? 0),
      adoptedIntroNonce: unb64(r.adoptedIntroNonce),
      outgoingSeq: { ...(r.outgoingSeq ?? {}) },
      lastScannedEpoch: r.lastScannedEpoch == null ? null : Number(r.lastScannedEpoch),
      lastScannedGeneration: r.lastScannedGeneration == null ? null : Number(r.lastScannedGeneration),
      gapFloors: gapFloorsOf(r.gapFloors),
      retiredIntroNonces: Array.isArray(r.retiredIntroNonces) ? r.retiredIntroNonces.map((n) => unb64(n)) : [],
    });
  }
  return map;
}

export function createConvKeySealKey() {
  return cryptoApi().subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function sealConvKeyMap(key, map) {
  const sealed = await sealAtRest(key, { domain: SEAL_DOMAIN, aad: { id: BLOB_ID }, value: { version: SEAL_VERSION, map: serializeConvKeyMap(map) }, padTo: 4096, binary: true });
  return { id: BLOB_ID, version: SEAL_VERSION, n: sealed.n, x: sealed.x };
}

export async function openConvKeyMap(key, record) {
  if (!record || record.version !== SEAL_VERSION || !record.x) return new Map();
  const payload = await openAtRest(key, { domain: SEAL_DOMAIN, aad: { id: BLOB_ID }, sealed: { n: record.n, x: record.x } });
  if (payload?.version !== SEAL_VERSION) return new Map();
  return deserializeConvKeyMap(payload.map);
}

const legacySealAad = () => utf8(JSON.stringify({ domain: LEGACY_SEAL_DOMAIN, version: LEGACY_SEAL_VERSION }));

export async function sealLegacyConvKeyMap(key, map) {
  const nonce = cryptoApi().getRandomValues(new Uint8Array(AES_GCM_NONCE_BYTES));
  const payload = utf8(JSON.stringify({ version: LEGACY_SEAL_VERSION, map: serializeConvKeyMap(map) }));
  const ciphertext = await cryptoApi().subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: legacySealAad(), tagLength: 128 }, key, payload);
  return { id: LEGACY_BLOB_ID, version: LEGACY_SEAL_VERSION, alg: 'AES-256-GCM', nonce: b64(nonce), ciphertext: b64(new Uint8Array(ciphertext)) };
}

export async function openLegacyConvKeyMap(key, record) {
  if (!record || record.version !== LEGACY_SEAL_VERSION || record.alg !== 'AES-256-GCM' || !record.ciphertext) return new Map();
  const plaintext = await cryptoApi().subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(record.nonce), additionalData: legacySealAad(), tagLength: 128 }, key, unb64(record.ciphertext));
  const payload = JSON.parse(new TextDecoder().decode(new Uint8Array(plaintext)));
  if (payload?.version !== LEGACY_SEAL_VERSION) return new Map();
  return deserializeConvKeyMap(payload.map);
}

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
    const newestDay = Math.max(-Infinity, ...Object.keys(outgoingSeq).map(Number).filter(Number.isFinite));
    for (const key of Object.keys(outgoingSeq)) if (Number(key) < newestDay - OUTGOING_SEQ_KEEP_EPOCHS) delete outgoingSeq[key];
    const roots = new Map();
    for (const entry of [...(myRecord?.kRootsForRead ?? []), ...(theirRecord?.kRootsForRead ?? [])]) {
      const hex = Array.from(entry?.kRoot ?? [], (b) => (b & 0xff).toString(16).padStart(2, '0')).join('');
      if (hex && !roots.has(hex)) roots.set(hex, entry);
    }
    const gapFloors = { ...gapFloorsOf(myRecord?.gapFloors) };
    for (const [address, floor] of Object.entries(gapFloorsOf(theirRecord?.gapFloors))) {
      if (gapFloors[address] === undefined || floor < gapFloors[address]) gapFloors[address] = floor;
    }
    const retired = new Map();
    for (const nonce of [...(myRecord?.retiredIntroNonces ?? []), ...(theirRecord?.retiredIntroNonces ?? [])]) {
      const hex = Array.from(nonce ?? [], (b) => (b & 0xff).toString(16).padStart(2, '0')).join('');
      if (hex && !retired.has(hex)) retired.set(hex, nonce);
    }
    const settled = myRecord?.peerWalletVerified === true ? myRecord : (theirRecord?.peerWalletVerified === true ? theirRecord : null);
    const peerWallet = settled ? settled.peerWallet : (base.peerWallet ?? myRecord?.peerWallet ?? theirRecord?.peerWallet ?? null);
    merged.set(id, {
      ...base,
      peerWallet,
      peerWalletVerified: Boolean(settled),
      peerWalletCandidates: walletList([peerWallet], myRecord?.peerWalletCandidates ?? [], [myRecord?.peerWallet], theirRecord?.peerWalletCandidates ?? [], [theirRecord?.peerWallet]),
      lastScannedEpoch: epoch,
      lastScannedGeneration: generationSource?.lastScannedGeneration ?? null,
      outgoingSeq,
      kRootsForRead: [...roots.values()],
      gapFloors,
      retiredIntroNonces: [...retired.values()].slice(-16),
    });
  }
  return merged;
}


export async function createSealedConvKeyStore({ key, readBlob, writeBlob, lockName = null }) {
  if (!key) throw new Error('createSealedConvKeyStore requires a seal key');
  if (typeof readBlob !== 'function' || typeof writeBlob !== 'function') {
    throw new Error('createSealedConvKeyStore requires readBlob/writeBlob');
  }
  const store = createConvKeyStore({
    persist: async (map, claim = null) => withAtRestLock(lockName, async () => {
      const onDisk = await openConvKeyMap(key, await readBlob());
      const before = new Map([...onDisk].map(([id, record]) => [id, { outgoingSeq: { ...(record?.outgoingSeq ?? {}) } }]));
      const merged = mergeConvKeyMaps(onDisk, map);
      if (claim) claim(merged, before);
      await writeBlob(await sealConvKeyMap(key, merged));
      return merged;
    }),
    load: async () => openConvKeyMap(key, await readBlob()),
  });
  await store.load();
  return store;
}

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
async function moveLegacyConvKeys(db, key, lockName, { now = Date.now() } = {}) {
  return withAtRestLock(lockName, async () => {
    const tx = db.transaction([KEY_STORE_NAME, BLOB_STORE_NAME], 'readonly');
    const [legacyBlob, current, deviceKey, graceRecord] = await Promise.all([
      reqToPromise(tx.objectStore(BLOB_STORE_NAME).get(LEGACY_BLOB_ID)),
      reqToPromise(tx.objectStore(BLOB_STORE_NAME).get(BLOB_ID)),
      reqToPromise(tx.objectStore(KEY_STORE_NAME).get(LEGACY_DEVICE_KEY_ID)),
      reqToPromise(tx.objectStore(KEY_STORE_NAME).get(LEGACY_KEY_GRACE_ID)),
    ]);
    await txDone(tx);
    if (!legacyBlob && !deviceKey) return { moved: false };
    const grace = await openLegacyGrace(key, graceRecord);
    let legacy = null;
    if (legacyBlob && deviceKey?.key) {
      try { legacy = await openLegacyConvKeyMap(deviceKey.key, legacyBlob); } catch { legacy = null; }
    }
    let sealed = null;
    let merged = null;
    if (legacy) {
      const mine = await openConvKeyMap(key, current ?? null);
      merged = mergeConvKeyMaps(legacy, mine);
      sealed = await sealConvKeyMap(key, merged);
      await openConvKeyMap(key, sealed);
    }
    const { retire, graceAt } = deviceKey ? legacyKeyRetirement({ grace, legacyFound: Boolean(legacy), now }) : { retire: false, graceAt: null };
    const graceMoves = Boolean(deviceKey) && (retire || Number(grace?.at) !== graceAt || legacyGraceInClear(graceRecord));
    if (!legacyBlob && !graceMoves) return { moved: false };
    const sealedGrace = graceMoves && !retire && Number.isFinite(graceAt) ? await sealLegacyGrace(key, graceAt) : null;
    const write = db.transaction([KEY_STORE_NAME, BLOB_STORE_NAME], 'readwrite');
    if (sealed) write.objectStore(BLOB_STORE_NAME).put(sealed);
    if (legacyBlob) write.objectStore(BLOB_STORE_NAME).delete(LEGACY_BLOB_ID);
    if (deviceKey && retire) {
      write.objectStore(KEY_STORE_NAME).delete(LEGACY_DEVICE_KEY_ID);
      write.objectStore(KEY_STORE_NAME).delete(LEGACY_KEY_GRACE_ID);
    } else if (sealedGrace) {
      write.objectStore(KEY_STORE_NAME).put(sealedGrace);
    }
    await txDone(write);
    const keyRetired = Boolean(deviceKey && retire);
    return legacy ? { moved: true, conversations: merged.size, keyRetired } : { moved: false, dropped: Boolean(legacyBlob), keyRetired };
  });
}

export async function createIndexedDbConvKeyStore({ dbName, atRestKey, now = () => Date.now(), onLegacy = null }) {
  if (!atRestKey) throw new Error('the conv key store needs the wallet\'s at-rest key');
  const db = await openConvKeyDb(dbName);
  const key = atRestKey;
  const lockName = `platho.convkeys.${dbName}`;
  const move = await moveLegacyConvKeys(db, key, lockName, { now: now() });
  if (move?.moved === true || move?.dropped === true) { try { onLegacy?.(); } catch { } }
  return createSealedConvKeyStore({
    key,
    lockName,
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
