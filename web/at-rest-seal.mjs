
const SEED_SALT = 'PLATHO.WALLET.SEED.V1';
const TAG_BYTES = 16;

export const AT_REST_KEY_PLAN = Object.freeze({
  history: Object.freeze({ seal: 'at-rest.v1.history.seal', index: 'at-rest.v1.history.index' }),
  convKeys: Object.freeze({ seal: 'at-rest.v1.conv-keys.seal' }),
  groups: Object.freeze({ seal: 'at-rest.v1.groups.seal', index: 'at-rest.v1.groups.index' }),
  publicGroups: Object.freeze({ seal: 'at-rest.v1.public-groups.seal', index: 'at-rest.v1.public-groups.index' }),
  groupRequests: Object.freeze({ seal: 'at-rest.v1.group-requests.seal', index: 'at-rest.v1.group-requests.index' }),
  contactLabels: Object.freeze({ seal: 'at-rest.v1.contact-labels.seal' }),
  introLedger: Object.freeze({ seal: 'at-rest.v1.intro-ledger.seal' }),
  caches: Object.freeze({ seal: 'at-rest.v1.caches.seal', index: 'at-rest.v1.caches.index' }),
});

const subtle = () => {
  const api = globalThis.crypto?.subtle;
  if (!api) throw new Error('WebCrypto is unavailable for the at-rest seal');
  return api;
};
const randomBytes = (length) => {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
};
const encoder = new TextEncoder();

const SEAL_ALGORITHM = Object.freeze({ name: 'AES-GCM', length: 256 });
const INDEX_ALGORITHM = Object.freeze({ name: 'HMAC', hash: 'SHA-256', length: 256 });
const usagesOf = (role) => (role === 'index' ? ['sign'] : ['encrypt', 'decrypt']);
const algorithmOf = (role) => (role === 'index' ? INDEX_ALGORITHM : SEAL_ALGORITHM);

export async function deriveAtRestKeys(seed) {
  if (!(seed instanceof Uint8Array) || seed.length < 32) throw new Error('deriveAtRestKeys needs the wallet seed');
  const base = await subtle().importKey('raw', seed, 'HKDF', false, ['deriveKey']);
  const out = {};
  for (const [store, roles] of Object.entries(AT_REST_KEY_PLAN)) {
    const keys = {};
    for (const [role, info] of Object.entries(roles)) {
      // eslint-disable-next-line no-await-in-loop
      keys[role] = await subtle().deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: encoder.encode(SEED_SALT), info: encoder.encode(info) },
        base, algorithmOf(role), false, usagesOf(role));
    }
    out[store] = Object.freeze(keys);
  }
  return Object.freeze(out);
}

export async function generateRandomAtRestKeys() {
  const out = {};
  for (const [store, roles] of Object.entries(AT_REST_KEY_PLAN)) {
    const keys = {};
    for (const role of Object.keys(roles)) {
      // eslint-disable-next-line no-await-in-loop
      keys[role] = await subtle().generateKey(algorithmOf(role), false, usagesOf(role));
    }
    out[store] = Object.freeze(keys);
  }
  return Object.freeze(out);
}

const ENCODE_SLICE = 0x8000;
export function bytesToBase64url(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let at = 0; at < input.length; at += ENCODE_SLICE) binary += String.fromCharCode.apply(null, input.subarray(at, at + ENCODE_SLICE));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64urlToBytes(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]*$/.test(value)) throw new Error('Invalid base64url value');
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`;
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(binary.length);
  for (let at = 0; at < binary.length; at += 1) out[at] = binary.charCodeAt(at);
  return out;
}

const sealPartBytes = (value) => {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return base64urlToBytes(value);
};
const isSealPart = (value) => typeof value === 'string' || value instanceof Uint8Array || value instanceof ArrayBuffer;

export async function atRestTag(indexKey, purpose, value) {
  if (!indexKey) throw new Error('atRestTag needs an index key');
  if (!purpose) throw new Error('atRestTag needs a purpose');
  const mac = await subtle().sign('HMAC', indexKey, encoder.encode(`${purpose}\u0000${String(value)}`));
  return bytesToBase64url(new Uint8Array(mac).subarray(0, TAG_BYTES));
}

const aadBytes = (domain, aad) => encoder.encode(JSON.stringify([String(domain), aad ?? null]));

export async function sealAtRest(sealKey, { domain, aad = null, value, padTo = 0, binary = false }) {
  if (!sealKey) throw new Error('sealAtRest needs a seal key');
  let plaintext = encoder.encode(JSON.stringify(value));
  if (padTo > 0 && plaintext.length % padTo !== 0) {
    const padded = new Uint8Array(plaintext.length + (padTo - (plaintext.length % padTo)));
    padded.set(plaintext);
    padded.fill(0x20, plaintext.length);
    plaintext = padded;
  }
  const nonce = randomBytes(12);
  const ciphertext = await subtle().encrypt({ name: 'AES-GCM', iv: nonce, additionalData: aadBytes(domain, aad), tagLength: 128 }, sealKey, plaintext);
  if (binary) return { n: nonce, x: new Uint8Array(ciphertext) };
  return { n: bytesToBase64url(nonce), x: bytesToBase64url(new Uint8Array(ciphertext)) };
}

export async function openAtRest(sealKey, { domain, aad = null, sealed }) {
  if (!sealKey) throw new Error('openAtRest needs a seal key');
  if (!sealed || !isSealPart(sealed.n) || !isSealPart(sealed.x)) throw new Error('Not an at-rest seal');
  const nonce = sealPartBytes(sealed.n);
  if (nonce.length !== 12) throw new Error('Invalid at-rest nonce');
  const plaintext = await subtle().decrypt({ name: 'AES-GCM', iv: nonce, additionalData: aadBytes(domain, aad), tagLength: 128 },
    sealKey, sealPartBytes(sealed.x));
  return JSON.parse(new TextDecoder().decode(new Uint8Array(plaintext)));
}

export const LEGACY_KEY_GRACE_MS = 7 * 86_400_000;
export const LEGACY_KEY_GRACE_ID = 'legacy-key-retire-after';
export function legacyKeyRetirement({ grace = null, legacyFound = false, now = Date.now() } = {}) {
  const until = Number(grace?.at);
  if (legacyFound || !Number.isFinite(until)) return { retire: false, graceAt: now + LEGACY_KEY_GRACE_MS };
  if (until <= now) return { retire: true, graceAt: null };
  return { retire: false, graceAt: until };
}

const LEGACY_GRACE_DOMAIN = 'PLATHO.LEGACY.KEY.GRACE.V1';
export async function sealLegacyGrace(sealKey, at) {
  const sealed = await sealAtRest(sealKey, { domain: LEGACY_GRACE_DOMAIN, value: { at: Number(at) }, padTo: 64 });
  return { id: LEGACY_KEY_GRACE_ID, n: sealed.n, x: sealed.x };
}
export async function openLegacyGrace(sealKey, record) {
  if (!record) return null;
  if (record.x) {
    const opened = await openAtRest(sealKey, { domain: LEGACY_GRACE_DOMAIN, sealed: record }).catch(() => null);
    return Number.isFinite(Number(opened?.at)) ? { at: Number(opened.at) } : null;
  }
  return Number.isFinite(Number(record.at)) ? { at: Number(record.at) } : null;
}
export const legacyGraceInClear = (record) => Boolean(record) && !record.x && Number.isFinite(Number(record.at));

export async function withAtRestLock(name, work) {
  const locks = globalThis.navigator?.locks;
  if (!name || typeof locks?.request !== 'function') return work();
  let ran = false;
  try {
    return await locks.request(name, () => { ran = true; return work(); });
  } catch (error) {
    if (ran) throw error;
    return work();
  }
}
