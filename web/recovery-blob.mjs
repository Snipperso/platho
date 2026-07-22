// recovery-blob — seal/open the CONV conversation key map as the ON-CHAIN recovery body, keyed by the SEED.
//
// WHY A SEED KEY, NOT THE DEVICE KEY. conv-key-persist seals the K_root map at rest under a device-local IndexedDB key —
// perfect for surviving a reload, useless after a REINSTALL (the IndexedDB is gone). The recovery lane exists for that
// case: a fresh device that has only the mnemonic re-derives the seed, finds its RecoveryShard slot, reads the blob,
// and decrypts it — so the blob MUST be sealed under a key derived from the seed alone. Same AES-GCM record format as
// conv-key-persist (its seal/open are reused); only the key material differs, and the ciphertext is packed into a snake
// cell so it can ride on chain as the RecoveryStore body.
//
// The recovery digest the owner signs commits to h0/h1/bh (bh = body.hash, derived by the builder). h0/h1 must be
// NON-ZERO (gate 13571); here h0 is a fixed version-domain marker and h1 is the blob content hash — both integrity
// markers the reader can cross-check. tests/recovery-blob.test.ts pins the seed round-trip, the wrong-seed refusal,
// and the non-zero hashes.

import { sealConvKeyMap, openConvKeyMap } from './conv-key-persist.mjs?v=1';
import { tonCell } from './pwa-contract-transactions.mjs?v=33';

const RECOVERY_BLOB_SALT = 'PLATHO.RECOVERY.BLOB.SALT.V1';
const RECOVERY_BLOB_INFO = 'PLATHO.RECOVERY.BLOB.KEY.V1';
const RECOVERY_BLOB_H0_DOMAIN = 'PLATHO.RECOVERY.BLOB.V1';

const utf8 = (s) => new TextEncoder().encode(s);
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
  const record = await sealConvKeyMap(key, map);          // { version, alg, nonce, ciphertext } — base64 fields
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
 * the blob was sealed under a different seed (wrong key). A missing/foreign record opens to an empty map (fresh slot).
 */
export async function openRecoveryBlob(seed, body) {
  const bytes = tonCell.readSnakeCellBytes(body, { name: 'recovery blob' });
  const record = JSON.parse(new TextDecoder().decode(bytes));
  const key = await recoveryBlobKey(seed);
  return openConvKeyMap(key, record);
}
