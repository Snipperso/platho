
import { tonCell } from './pwa-contract-transactions.mjs?v=59';

const RECOVERY_BLOB_SALT = 'PLATHO.RECOVERY.BLOB.SALT.V1';
const RECOVERY_BLOB_INFO = 'PLATHO.RECOVERY.BLOB.KEY.V1';
const RECOVERY_BLOB_H0_DOMAIN = 'PLATHO.RECOVERY.BLOB.V1';
const RECOVERY_BLOB_SEAL_DOMAIN = 'PLATHO.RECOVERY.BLOB.SEAL.V1';
const PREFS_BLOB_INFO = 'PLATHO.PREFS.BLOB.KEY.V1';
const PREFS_BLOB_SEAL_DOMAIN = 'PLATHO.PREFS.BLOB.SEAL.V1';
const PREFS_SEAL_VERSION = 1;
const GROUPS_BLOB_INFO = 'PLATHO.GROUPS.BLOB.KEY.V1';
const GROUPS_BLOB_H0_DOMAIN = 'PLATHO.GROUPS.BLOB.V1';
const GROUPS_BLOB_SEAL_DOMAIN = 'PLATHO.GROUPS.BLOB.SEAL.V1';
const GROUPS_SEAL_VERSION = 1;
const NOTES_BLOB_INFO = 'PLATHO.NOTES.BLOB.KEY.V1';
const NOTES_BLOB_H0_DOMAIN = 'PLATHO.NOTES.BLOB.V1';
const NOTES_BLOB_SEAL_DOMAIN = 'PLATHO.NOTES.BLOB.SEAL.V1';
const NOTES_BLOB_NONCE_INFO = 'PLATHO.NOTES.BLOB.NONCE.V1';
const NOTES_SEAL_VERSION = 1;
const AES_GCM_NONCE_BYTES = 12;
const SEAL_VERSION = 2;

const utf8 = (s) => new TextEncoder().encode(s);
const fromUtf8 = (b) => new TextDecoder().decode(b);
const b64 = (bytes) => tonCell.bytesToBase64(bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes));
const unb64 = (value) => tonCell.base64ToBytes(value);
const cryptoApi = () => {
  const api = globalThis.crypto;
  if (!api?.subtle) throw new Error('WebCrypto is unavailable for the recovery blob');
  return api;
};
const bytesToBig = (b) => { let x = 0n; for (const byte of b) x = (x << 8n) | BigInt(byte & 0xff); return x; };

async function sha256Big(bytes) {
  const digest = await cryptoApi().subtle.digest('SHA-256', bytes);
  return bytesToBig(new Uint8Array(digest));
}

export function serializeRecoveryMap(map) {
  const out = {};
  for (const [convId, r] of map) {
    if (!r?.kRootCurrent) continue;
    out[convId] = {
      k: b64(r.kRootCurrent),
      p: b64(r.peerKeyId),
      w: r.peerWallet ?? null,
      ...((r.peerWalletCandidates ?? []).filter((w) => w && w !== r.peerWallet).length > 0
        ? { v: (r.peerWalletCandidates ?? []).filter((w) => w && w !== r.peerWallet).slice(0, 8).map((w) => String(w)) } : {}),
      ...(r.peerWalletVerified === true ? { s: 1 } : {}),
      c: Number(r.adoptedCreatedAt ?? 0),
      n: b64(r.adoptedIntroNonce),
      e: r.lastScannedEpoch == null ? null : Number(r.lastScannedEpoch),
      ...((r.retiredIntroNonces ?? []).length > 0 ? { x: r.retiredIntroNonces.slice(-8).map((n) => b64(n)) } : {}),
    };
  }
  return out;
}

export function deserializeRecoveryMap(obj) {
  const map = new Map();
  for (const [convId, r] of Object.entries(obj ?? {})) {
    map.set(convId, {
      kRootCurrent: unb64(r.k),
      kRootsForRead: [],
      peerKeyId: unb64(r.p),
      peerEncPublicKey: null,
      peerWallet: r.w ?? null,
      peerWalletCandidates: Array.isArray(r.v) ? r.v.filter((w) => typeof w === 'string' && w).slice(0, 8) : [],
      peerWalletVerified: r.s === 1,
      adoptedCreatedAt: Number(r.c ?? 0),
      adoptedIntroNonce: unb64(r.n),
      outgoingSeq: {},
      lastScannedEpoch: r.e == null ? null : Number(r.e),
      retiredIntroNonces: Array.isArray(r.x) ? r.x.map((n) => unb64(n)).filter((n) => n?.length === 16) : [],
    });
  }
  return map;
}

const sealAad = () => utf8(JSON.stringify({ domain: RECOVERY_BLOB_SEAL_DOMAIN, version: SEAL_VERSION }));

export async function recoveryBlobKey(seed) {
  const ikm = seed instanceof Uint8Array ? seed : Uint8Array.from(seed);
  const material = await cryptoApi().subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await cryptoApi().subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: utf8(RECOVERY_BLOB_SALT), info: utf8(RECOVERY_BLOB_INFO) }, material, 256);
  return cryptoApi().subtle.importKey('raw', bits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function sealRecoveryBlob(seed, map) {
  const key = await recoveryBlobKey(seed);
  const nonce = cryptoApi().getRandomValues(new Uint8Array(AES_GCM_NONCE_BYTES));
  const payload = utf8(JSON.stringify({ version: SEAL_VERSION, map: serializeRecoveryMap(map) }));
  const ciphertext = await cryptoApi().subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: sealAad(), tagLength: 128 }, key, payload);
  const record = { version: SEAL_VERSION, alg: 'AES-256-GCM', nonce: b64(nonce), ciphertext: b64(new Uint8Array(ciphertext)) };
  const bytes = utf8(JSON.stringify(record));
  const body = tonCell.snakeCellFromBytes(bytes, 'recovery blob');
  return {
    body,
    h0: await sha256Big(utf8(RECOVERY_BLOB_H0_DOMAIN)),
    h1: await sha256Big(bytes),
  };
}

export const RECOVERY_BLOB_UNREADABLE_CODE = 'RECOVERY_BLOB_UNREADABLE';

function recoveryBlobUnreadable(reason) {
  const error = new Error(`Recovery blob cannot be read: ${reason}`);
  error.code = RECOVERY_BLOB_UNREADABLE_CODE;
  return error;
}

export async function openRecoveryBlob(seed, body) {
  const bytes = tonCell.readSnakeCellBytes(body, { name: 'recovery blob' });
  let record;
  try { record = JSON.parse(fromUtf8(bytes)); } catch { throw recoveryBlobUnreadable('not a sealed record'); }
  if (record?.version !== SEAL_VERSION) throw recoveryBlobUnreadable(`sealed under version ${record?.version}`);
  if (record.alg !== 'AES-256-GCM' || !record.ciphertext) throw recoveryBlobUnreadable('malformed record');
  const key = await recoveryBlobKey(seed);
  const plaintext = await cryptoApi().subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(record.nonce), additionalData: sealAad(), tagLength: 128 }, key, unb64(record.ciphertext));
  const payload = JSON.parse(fromUtf8(new Uint8Array(plaintext)));
  if (payload?.version !== SEAL_VERSION) throw recoveryBlobUnreadable(`payload version ${payload?.version}`);
  return deserializeRecoveryMap(payload.map);
}

const prefsSealAad = () => utf8(JSON.stringify({ domain: PREFS_BLOB_SEAL_DOMAIN, version: PREFS_SEAL_VERSION }));
const PREFS_SEAL_V2 = 2;
const PREFS_BLOB_V2_H0_DOMAIN = 'PLATHO.PREFS.BLOB.V2';
const AES_GCM_TAG_BYTES = 16;
export const PREFS_SEAL_OVERHEAD_BYTES = 1 + AES_GCM_NONCE_BYTES + AES_GCM_TAG_BYTES;
const prefsSealAadV2 = (chunkIndex) => utf8(JSON.stringify({ domain: PREFS_BLOB_SEAL_DOMAIN, version: PREFS_SEAL_V2, chunk: Number(chunkIndex) }));

async function prefsBlobKey(seed) {
  const ikm = seed instanceof Uint8Array ? seed : Uint8Array.from(seed);
  const material = await cryptoApi().subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await cryptoApi().subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: utf8(RECOVERY_BLOB_SALT), info: utf8(PREFS_BLOB_INFO) }, material, 256);
  return cryptoApi().subtle.importKey('raw', bits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function sealPrefsBlob(seed, prefsBytes, chunkIndex = 0) {
  const key = await prefsBlobKey(seed);
  const nonce = cryptoApi().getRandomValues(new Uint8Array(AES_GCM_NONCE_BYTES));
  const plain = prefsBytes instanceof Uint8Array ? prefsBytes : Uint8Array.from(prefsBytes ?? []);
  const ciphertext = new Uint8Array(await cryptoApi().subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: prefsSealAadV2(chunkIndex), tagLength: 128 }, key, plain));
  const bytes = new Uint8Array(1 + nonce.length + ciphertext.length);
  bytes[0] = PREFS_SEAL_V2;
  bytes.set(nonce, 1);
  bytes.set(ciphertext, 1 + nonce.length);
  return {
    body: tonCell.snakeCellFromBytes(bytes, 'prefs blob'),
    h0: await sha256Big(utf8(PREFS_BLOB_V2_H0_DOMAIN)),
    h1: await sha256Big(bytes),
  };
}

export async function openPrefsBlob(seed, body, chunkIndex = 0) {
  try {
    const bytes = tonCell.readSnakeCellBytes(body, { name: 'prefs blob' });
    const key = await prefsBlobKey(seed);
    if (bytes[0] === PREFS_SEAL_V2) {
      if (bytes.length < PREFS_SEAL_OVERHEAD_BYTES) return null;
      const plaintext = await cryptoApi().subtle.decrypt(
        { name: 'AES-GCM', iv: bytes.slice(1, 1 + AES_GCM_NONCE_BYTES), additionalData: prefsSealAadV2(chunkIndex), tagLength: 128 },
        key, bytes.slice(1 + AES_GCM_NONCE_BYTES));
      return new Uint8Array(plaintext);
    }
    if (chunkIndex !== 0) return null;
    const record = JSON.parse(fromUtf8(bytes));
    if (record?.version !== PREFS_SEAL_VERSION || record.alg !== 'AES-256-GCM' || !record.ciphertext) return null;
    const plaintext = await cryptoApi().subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(record.nonce), additionalData: prefsSealAad(), tagLength: 128 }, key, unb64(record.ciphertext));
    return new Uint8Array(plaintext);
  } catch {
    return null;
  }
}

const notesSealAad = (chunkIndex) => utf8(JSON.stringify({
  domain: NOTES_BLOB_SEAL_DOMAIN, version: NOTES_SEAL_VERSION, chunk: Number(chunkIndex),
}));

async function notesBlobKey(seed) {
  const ikm = seed instanceof Uint8Array ? seed : Uint8Array.from(seed);
  const material = await cryptoApi().subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await cryptoApi().subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: utf8(RECOVERY_BLOB_SALT), info: utf8(NOTES_BLOB_INFO) }, material, 256);
  return cryptoApi().subtle.importKey('raw', bits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function notesBlobNonce(seed, chunkIndex, plain) {
  const ikm = seed instanceof Uint8Array ? seed : Uint8Array.from(seed);
  const material = await cryptoApi().subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const digest = new Uint8Array(await cryptoApi().subtle.digest('SHA-256', plain));
  const info = new Uint8Array([...utf8(`${NOTES_BLOB_NONCE_INFO}:${Number(chunkIndex)}:`), ...digest]);
  const bits = await cryptoApi().subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: utf8(RECOVERY_BLOB_SALT), info }, material, AES_GCM_NONCE_BYTES * 8);
  return new Uint8Array(bits);
}

export async function sealNotesBlob(seed, notesBytes, chunkIndex) {
  const key = await notesBlobKey(seed);
  const plainForNonce = notesBytes instanceof Uint8Array ? notesBytes : Uint8Array.from(notesBytes ?? []);
  const nonce = await notesBlobNonce(seed, chunkIndex, plainForNonce);
  const plain = notesBytes instanceof Uint8Array ? notesBytes : Uint8Array.from(notesBytes ?? []);
  const ciphertext = await cryptoApi().subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: notesSealAad(chunkIndex), tagLength: 128 }, key, plain);
  const record = { version: NOTES_SEAL_VERSION, alg: 'AES-256-GCM', nonce: b64(nonce), ciphertext: b64(new Uint8Array(ciphertext)) };
  const bytes = utf8(JSON.stringify(record));
  return {
    body: tonCell.snakeCellFromBytes(bytes, 'notes blob'),
    bodyBytes: bytes.length,
    h0: await sha256Big(utf8(NOTES_BLOB_H0_DOMAIN)),
    h1: await sha256Big(bytes),
  };
}

export async function openNotesBlob(seed, body, chunkIndex) {
  try {
    const bytes = tonCell.readSnakeCellBytes(body, { name: 'notes blob' });
    const record = JSON.parse(fromUtf8(bytes));
    if (record?.version !== NOTES_SEAL_VERSION || record.alg !== 'AES-256-GCM' || !record.ciphertext) return null;
    const key = await notesBlobKey(seed);
    const plaintext = await cryptoApi().subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(record.nonce), additionalData: notesSealAad(chunkIndex), tagLength: 128 }, key, unb64(record.ciphertext));
    return new Uint8Array(plaintext);
  } catch {
    return null;
  }
}

const groupsSealAad = (chunkIndex) => utf8(JSON.stringify({
  domain: GROUPS_BLOB_SEAL_DOMAIN, version: GROUPS_SEAL_VERSION, chunk: Number(chunkIndex),
}));

async function groupsBlobKey(seed) {
  const ikm = seed instanceof Uint8Array ? seed : Uint8Array.from(seed);
  const material = await cryptoApi().subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await cryptoApi().subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: utf8(RECOVERY_BLOB_SALT), info: utf8(GROUPS_BLOB_INFO) }, material, 256);
  return cryptoApi().subtle.importKey('raw', bits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function sealGroupsBlob(seed, groupsBytes, chunkIndex = 0) {
  const key = await groupsBlobKey(seed);
  const nonce = cryptoApi().getRandomValues(new Uint8Array(AES_GCM_NONCE_BYTES));
  const plain = groupsBytes instanceof Uint8Array ? groupsBytes : Uint8Array.from(groupsBytes ?? []);
  const ciphertext = await cryptoApi().subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: groupsSealAad(chunkIndex), tagLength: 128 }, key, plain);
  const record = { version: GROUPS_SEAL_VERSION, alg: 'AES-256-GCM', nonce: b64(nonce), ciphertext: b64(new Uint8Array(ciphertext)) };
  const bytes = utf8(JSON.stringify(record));
  return {
    body: tonCell.snakeCellFromBytes(bytes, 'groups blob'),
    h0: await sha256Big(utf8(GROUPS_BLOB_H0_DOMAIN)),
    h1: await sha256Big(bytes),
  };
}

export async function openGroupsBlob(seed, body, chunkIndex = 0) {
  try {
    const bytes = tonCell.readSnakeCellBytes(body, { name: 'groups blob' });
    const record = JSON.parse(fromUtf8(bytes));
    if (record?.version !== GROUPS_SEAL_VERSION || record.alg !== 'AES-256-GCM' || !record.ciphertext) return null;
    const key = await groupsBlobKey(seed);
    const plaintext = await cryptoApi().subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(record.nonce), additionalData: groupsSealAad(chunkIndex), tagLength: 128 }, key, unb64(record.ciphertext));
    return new Uint8Array(plaintext);
  } catch {
    return null;
  }
}
