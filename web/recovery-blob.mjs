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
