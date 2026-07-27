// recovery-blob — seal/open the CONV conversation key map as the ON-CHAIN recovery body, keyed by the SEED.
//
// WHY A SEED KEY, NOT THE DEVICE KEY. conv-key-persist seals the K_root map at rest under a device-local IndexedDB key —
// perfect for surviving a reload, useless after a REINSTALL (the IndexedDB is gone). The recovery lane exists for that
// case: a fresh device that has only the mnemonic re-derives the seed, finds its RecoveryShard slot, reads the blob,
// and decrypts it — so the blob MUST be sealed under a key derived from the seed alone.
//
// COMPACT, BOUNDED-PER-CONVERSATION FORM. The on-chain slot is capped at RS_MAX_BLOB_CELLS, so the blob stores ONLY the
// fields a reinstall genuinely needs, each a FIXED size — never the fat conv-key-store record whose kRootsForRead[] and
// outgoingSeq{} grow without bound with a conversation's age (a single old chat could blow the cap). Kept: kRootCurrent,
// peerKeyId, peerWallet, adoptedCreatedAt, adoptedIntroNonce, lastScannedEpoch. Dropped, all re-derivable: kRootsForRead
// (old-history roots — re-fetched/lost, an accepted edge), peerEncPublicKey (re-read from the KeyShard bundle),
// outgoingSeq (cold-floored from the RecordShard's on-chain last_seq on the next send). Short JSON keys, since the field
// names repeat once per conversation. [recovery-wiring review #3/#4]
//
// The recovery digest the owner signs commits to h0/h1/bh (bh = body.hash, derived by the builder). h0/h1 must be
// NON-ZERO (gate 13571); h0 is a fixed version-domain marker and h1 is the blob content hash — integrity markers the
// reader can cross-check. tests/recovery-blob.test.ts pins the seed round-trip, the wrong-seed refusal, the essentials
// that survive, the non-essentials that default, and the non-zero hashes.

import { tonCell } from './pwa-contract-transactions.mjs?v=33';

const RECOVERY_BLOB_SALT = 'PLATHO.RECOVERY.BLOB.SALT.V1';
const RECOVERY_BLOB_INFO = 'PLATHO.RECOVERY.BLOB.KEY.V1';
const RECOVERY_BLOB_H0_DOMAIN = 'PLATHO.RECOVERY.BLOB.V1';
const RECOVERY_BLOB_SEAL_DOMAIN = 'PLATHO.RECOVERY.BLOB.SEAL.V1';
// Prefs live in a NAMED RecoveryShard slot (a separate blob at a separate address from any conversation slot). The
// SAME salt anchors the HKDF, but a DISTINCT info string domain-separates the prefs blob key from the conversation
// recovery key — a wrong seed still fails, and the two blobs can never be cross-decrypted even under the same seed.
const PREFS_BLOB_INFO = 'PLATHO.PREFS.BLOB.KEY.V1';
const PREFS_BLOB_H0_DOMAIN = 'PLATHO.PREFS.BLOB.V1';
const PREFS_BLOB_SEAL_DOMAIN = 'PLATHO.PREFS.BLOB.SEAL.V1';
const PREFS_SEAL_VERSION = 1;
// Self-notes ("My notes") live in their OWN named-slot range, sealed under the seed with a THIRD domain: the same
// salt, a distinct HKDF info string. A note blob and a prefs blob can therefore never be cross-decrypted even under
// the same seed, and a wrong seed still fails on the GCM tag. The blob is per-CHUNK — see notes-lane.
const NOTES_BLOB_INFO = 'PLATHO.NOTES.BLOB.KEY.V1';
const NOTES_BLOB_H0_DOMAIN = 'PLATHO.NOTES.BLOB.V1';
const NOTES_BLOB_SEAL_DOMAIN = 'PLATHO.NOTES.BLOB.SEAL.V1';
const NOTES_BLOB_NONCE_INFO = 'PLATHO.NOTES.BLOB.NONCE.V1';
const NOTES_SEAL_VERSION = 1;
const AES_GCM_NONCE_BYTES = 12;
const SEAL_VERSION = 2;   // v2 = compact record form (v1 was the full conv record)

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

// ── compact serialize (essentials only; short keys) ──────────────────────────────────────────────────────────────
export function serializeRecoveryMap(map) {
  const out = {};
  for (const [convId, r] of map) {
    if (!r?.kRootCurrent) continue;
    out[convId] = {
      k: b64(r.kRootCurrent),
      p: b64(r.peerKeyId),
      w: r.peerWallet ?? null,
      c: Number(r.adoptedCreatedAt ?? 0),
      n: b64(r.adoptedIntroNonce),
      e: r.lastScannedEpoch == null ? null : Number(r.lastScannedEpoch),
    };
  }
  return out;
}

export function deserializeRecoveryMap(obj) {
  const map = new Map();
  for (const [convId, r] of Object.entries(obj ?? {})) {
    map.set(convId, {
      kRootCurrent: unb64(r.k),
      kRootsForRead: [],                                 // dropped — old-history roots re-fetched/lost on reinstall
      peerKeyId: unb64(r.p),
      peerEncPublicKey: null,                            // dropped — re-read from the peer's KeyShard bundle
      peerWallet: r.w ?? null,
      adoptedCreatedAt: Number(r.c ?? 0),
      adoptedIntroNonce: unb64(r.n),
      outgoingSeq: {},                                   // dropped — cold-floored from the chain last_seq on next send
      lastScannedEpoch: r.e == null ? null : Number(r.e),
    });
  }
  return map;
}

// ── seed key + seal / open ───────────────────────────────────────────────────────────────────────────────────────
const sealAad = () => utf8(JSON.stringify({ domain: RECOVERY_BLOB_SEAL_DOMAIN, version: SEAL_VERSION }));

/** The AES-GCM blob key derived FROM THE SEED (HKDF-SHA256), distinct from the recovery OWNER signing key. A reinstalled
 *  client re-derives it from the mnemonic alone. `seed` is the wallet seed bytes. */
export async function recoveryBlobKey(seed) {
  const ikm = seed instanceof Uint8Array ? seed : Uint8Array.from(seed);
  const material = await cryptoApi().subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await cryptoApi().subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: utf8(RECOVERY_BLOB_SALT), info: utf8(RECOVERY_BLOB_INFO) }, material, 256);
  return cryptoApi().subtle.importKey('raw', bits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/**
 * Seal the conversation key map into the on-chain recovery body. Returns { body (a snake cell), h0, h1 } — the caller
 * (buildRecoveryPublishBrowser) derives bh from the body and signs the digest over (h0, h1, bh). h0/h1 are non-zero.
 */
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
    h0: await sha256Big(utf8(RECOVERY_BLOB_H0_DOMAIN)),   // fixed version-domain marker (non-zero)
    h1: await sha256Big(bytes),                           // blob content hash (non-zero)
  };
}

/**
 * Open a recovery body (the snake cell read back from the slot) to the conversation key Map, using the seed. Throws if
 * the blob was sealed under a different seed (wrong key). A missing/foreign/unsupported record opens to an empty map.
 */
export async function openRecoveryBlob(seed, body) {
  const bytes = tonCell.readSnakeCellBytes(body, { name: 'recovery blob' });
  const record = JSON.parse(fromUtf8(bytes));
  if (record?.version !== SEAL_VERSION || record.alg !== 'AES-256-GCM' || !record.ciphertext) return new Map();
  const key = await recoveryBlobKey(seed);
  const plaintext = await cryptoApi().subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(record.nonce), additionalData: sealAad(), tagLength: 128 }, key, unb64(record.ciphertext));
  const payload = JSON.parse(fromUtf8(new Uint8Array(plaintext)));
  if (payload?.version !== SEAL_VERSION) return new Map();
  return deserializeRecoveryMap(payload.map);
}

// ── prefs blob (the named-slot self-data: raw prefs snapshot bytes, sealed under the seed) ─────────────────────────
const prefsSealAad = () => utf8(JSON.stringify({ domain: PREFS_BLOB_SEAL_DOMAIN, version: PREFS_SEAL_VERSION }));

/** The AES-GCM prefs blob key from the seed — domain-separated from recoveryBlobKey via a distinct HKDF info string. */
async function prefsBlobKey(seed) {
  const ikm = seed instanceof Uint8Array ? seed : Uint8Array.from(seed);
  const material = await cryptoApi().subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await cryptoApi().subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: utf8(RECOVERY_BLOB_SALT), info: utf8(PREFS_BLOB_INFO) }, material, 256);
  return cryptoApi().subtle.importKey('raw', bits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/**
 * Seal the prefs snapshot BYTES (opaque to this layer — the caller's serializePrefsSnapshotBytes) into the named-slot
 * recovery body. Returns { body (snake cell), h0, h1 } exactly like sealRecoveryBlob, so buildRecoveryPublishBrowser
 * publishes it identically — only the slot index (the prefs named slot) and the blob key differ.
 */
export async function sealPrefsBlob(seed, prefsBytes) {
  const key = await prefsBlobKey(seed);
  const nonce = cryptoApi().getRandomValues(new Uint8Array(AES_GCM_NONCE_BYTES));
  const plain = prefsBytes instanceof Uint8Array ? prefsBytes : Uint8Array.from(prefsBytes ?? []);
  const ciphertext = await cryptoApi().subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: prefsSealAad(), tagLength: 128 }, key, plain);
  const record = { version: PREFS_SEAL_VERSION, alg: 'AES-256-GCM', nonce: b64(nonce), ciphertext: b64(new Uint8Array(ciphertext)) };
  const bytes = utf8(JSON.stringify(record));
  return {
    body: tonCell.snakeCellFromBytes(bytes, 'prefs blob'),
    h0: await sha256Big(utf8(PREFS_BLOB_H0_DOMAIN)),   // fixed prefs version-domain marker (non-zero, ≠ recovery h0)
    h1: await sha256Big(bytes),                        // blob content hash (non-zero)
  };
}

/** Open a prefs body (snake cell from the named slot) to the raw prefs snapshot bytes, using the seed. Returns null for
 *  a wrong seed / missing / foreign / unsupported record (the caller then keeps its local prefs untouched). */
export async function openPrefsBlob(seed, body) {
  try {
    const bytes = tonCell.readSnakeCellBytes(body, { name: 'prefs blob' });
    const record = JSON.parse(fromUtf8(bytes));
    if (record?.version !== PREFS_SEAL_VERSION || record.alg !== 'AES-256-GCM' || !record.ciphertext) return null;
    const key = await prefsBlobKey(seed);
    const plaintext = await cryptoApi().subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(record.nonce), additionalData: prefsSealAad(), tagLength: 128 }, key, unb64(record.ciphertext));
    return new Uint8Array(plaintext);
  } catch {
    return null;   // wrong seed (GCM tag fail) or a malformed body — never throw into the restore path
  }
}

// ── notes blob (the self-notes chunks: raw notes bytes, sealed under the seed) ─────────────────────────────────────
// AAD binds the chunk INDEX as well as the domain: a chunk lifted from slot k and replayed into slot j fails to open,
// so a reordering attack on the slot range cannot silently permute the note history.
const notesSealAad = (chunkIndex) => utf8(JSON.stringify({
  domain: NOTES_BLOB_SEAL_DOMAIN, version: NOTES_SEAL_VERSION, chunk: Number(chunkIndex),
}));

/** The AES-GCM notes blob key from the seed — domain-separated from the recovery and prefs keys by its HKDF info. */
async function notesBlobKey(seed) {
  const ikm = seed instanceof Uint8Array ? seed : Uint8Array.from(seed);
  const material = await cryptoApi().subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await cryptoApi().subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: utf8(RECOVERY_BLOB_SALT), info: utf8(NOTES_BLOB_INFO) }, material, 256);
  return cryptoApi().subtle.importKey('raw', bits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/**
 * The notes nonce is SYNTHETIC (derived from the content), not random — a deliberate deviation from the prefs and
 * recovery blobs, and the reason the notes lane can tell an unchanged chunk from a changed one for free.
 *
 * With a random nonce, sealing the same notes twice yields different bytes and therefore a different content hash
 * (h1), so "has this chunk changed?" could only be answered by DOWNLOADING and decrypting every chunk on every
 * backup — eight extra chain reads per note written. With nonce = HKDF(seed; chunk ‖ plaintext) the blob is a pure
 * function of the content, so a re-backup of unchanged notes reproduces the stored h1 exactly and costs nothing.
 *
 * This is safe precisely because it is content-derived: AES-GCM breaks when one key+nonce encrypts DIFFERENT
 * plaintexts, and here an identical nonce implies an identical plaintext by construction (the SIV rule). What it
 * reveals — that a chunk's content is unchanged — is exactly what the skip already announces by not writing.
 */
async function notesBlobNonce(seed, chunkIndex, plain) {
  const ikm = seed instanceof Uint8Array ? seed : Uint8Array.from(seed);
  const material = await cryptoApi().subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  // The plaintext goes in as its DIGEST: HKDF caps `info` at 1024 bytes and a chunk is kilobytes. A digest binds the
  // content just as tightly for this purpose — the nonce still changes whenever the content does.
  const digest = new Uint8Array(await cryptoApi().subtle.digest('SHA-256', plain));
  const info = new Uint8Array([...utf8(`${NOTES_BLOB_NONCE_INFO}:${Number(chunkIndex)}:`), ...digest]);
  const bits = await cryptoApi().subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: utf8(RECOVERY_BLOB_SALT), info }, material, AES_GCM_NONCE_BYTES * 8);
  return new Uint8Array(bits);
}

/** Seal one notes CHUNK for its named slot. Returns { body, h0, h1 } shaped for buildRecoveryPublish. */
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
    h0: await sha256Big(utf8(NOTES_BLOB_H0_DOMAIN)),   // fixed notes version-domain marker (non-zero, distinct)
    h1: await sha256Big(bytes),                        // blob content hash (non-zero)
  };
}

/** Open a notes CHUNK body. Returns null for a wrong seed / foreign / unsupported record / wrong chunk index — the
 *  caller then keeps its local notes untouched rather than treating an unreadable chunk as an empty one. */
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
    return null;   // wrong seed (GCM tag fail), wrong chunk (AAD mismatch) or a malformed body — never throw
  }
}
