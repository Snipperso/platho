import { ed25519, x25519 } from '../vendor/@noble/curves/ed25519.js';
import { ml_kem768 } from '../vendor/@noble/post-quantum/ml-kem.js';

export const CRYPTO_SUITES = Object.freeze({
  CLASSICAL_V1: 'classical-v1',
  HYBRID_V1: 'hybrid-v1',
});

export const CONTRACT_CRYPTO_SUITE = Object.freeze({
  CLASSICAL: 1,
  HYBRID: 2,
});

export const CAPSULE_SIZE_CLASS = Object.freeze({
  STANDARD: 1,
  LONG_TERM: 2,
});

export const CAPSULE_PUBLISH_KIND = Object.freeze({
  PRIVATE: 1,
});

export const MLKEM768_PUBLIC_KEY_BYTES = 1184;
export const MLKEM768_CIPHERTEXT_BYTES = 1088;
export const X25519_PUBLIC_KEY_BYTES = 32;
export const X25519_SECRET_KEY_BYTES = 32;
export const ED25519_PUBLIC_KEY_BYTES = 32;
export const ED25519_SECRET_KEY_BYTES = 32;
export const ED25519_SIGNATURE_BYTES = 64;
export const AES_GCM_NONCE_BYTES = 12;

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const PROTOCOL_VERSION = 1;
const KEY_ID_CLASSICAL_DOMAIN = 'PLATHO.KEYID.CLASSICAL.V1';
const KEY_ID_HYBRID_DOMAIN = 'PLATHO.KEYID.HYBRID.V1';
const MESSAGE_KEY_DOMAIN = 'PLATHO.MESSAGE.KEY.V1';
const MESSAGE_SALT_DOMAIN = 'PLATHO.MESSAGE.SALT.V1';
const SIGNED_BUNDLE_DOMAIN = 'PLATHO.MESSAGING.KEY_BUNDLE.SIGNATURE.V1';
const WALLET_OWNERSHIP_DOMAIN = 'PLATHO.WALLET.KEY_BUNDLE.OWNERSHIP.V1';
const WALLET_BUNDLE_HASH_DOMAIN = 'PLATHO.WALLET.KEY_BUNDLE.HASH.V1';
const TON_PROOF_PREFIX = 'ton-proof-item-v2/';
const TON_CONNECT_SIGNATURE_DOMAIN = 'ton-connect';
const PRIVATE_CAPSULE_HEADER0_DOMAIN = 'PLATHO.PRIVATE_CAPSULE.HEADER0.V1';
const PRIVATE_CAPSULE_HEADER1_DOMAIN = 'PLATHO.PRIVATE_CAPSULE.HEADER1.V1';
const PRIVATE_CAPSULE_BODY_DOMAIN = 'PLATHO.PRIVATE_CAPSULE.BODY.V1';
const PRIVATE_CAPSULE_ID_DOMAIN = 'PLATHO.PRIVATE_CAPSULE.ID.V1';
const PRIVATE_CAPSULE_SIGNATURE_DOMAIN = 'PLATHO.PRIVATE_CAPSULE.SIGNATURE.V1';
const DEFAULT_CAPSULE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CAPSULE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_CLOCK_SKEW_MS = 5 * 60 * 1000;
const DEFAULT_TON_PROOF_MAX_AGE_SEC = 15 * 60;

const SUITE_CONFIG = Object.freeze({
  [CRYPTO_SUITES.CLASSICAL_V1]: Object.freeze({
    contractSuite: CONTRACT_CRYPTO_SUITE.CLASSICAL,
    alg: Object.freeze({
      kdf: 'HKDF-SHA-256',
      aead: 'AES-256-GCM',
      classicKem: 'X25519',
      pqKem: null,
    }),
  }),
  [CRYPTO_SUITES.HYBRID_V1]: Object.freeze({
    contractSuite: CONTRACT_CRYPTO_SUITE.HYBRID,
    alg: Object.freeze({
      kdf: 'HKDF-SHA-256',
      aead: 'AES-256-GCM',
      classicKem: 'X25519',
      pqKem: 'ML-KEM-768',
    }),
  }),
});

function getCrypto() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error('WebCrypto is required for Platho message encryption');
  }
  return globalThis.crypto;
}

export function randomBytes(length) {
  const out = new Uint8Array(length);
  getCrypto().getRandomValues(out);
  return out;
}

function utf8(value) {
  return encoder.encode(value);
}

function fromUtf8(bytes) {
  return decoder.decode(bytes);
}

function toUint8Array(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new TypeError('Expected byte array');
}

function concatBytes(...parts) {
  const arrays = parts.map(toUint8Array);
  const size = arrays.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of arrays) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function assertBytes(name, value, length) {
  const bytes = toUint8Array(value);
  if (bytes.length !== length) {
    throw new Error(`${name} must be ${length} bytes, got ${bytes.length}`);
  }
  return bytes;
}

function assertNonZeroSharedSecret(name, bytes) {
  if (bytes.every((byte) => byte === 0)) {
    throw new Error(`${name} must not be the all-zero X25519 shared secret`);
  }
  return bytes;
}

function deriveX25519SharedSecret(secretKey, publicKey) {
  const sharedSecret = x25519.getSharedSecret(
    assertBytes('x25519SecretKey', secretKey, X25519_SECRET_KEY_BYTES),
    assertBytes('x25519PublicKey', publicKey, X25519_PUBLIC_KEY_BYTES),
  );
  return assertNonZeroSharedSecret(
    'x25519SharedSecret',
    assertBytes('x25519SharedSecret', sharedSecret, X25519_PUBLIC_KEY_BYTES),
  );
}

function base64urlEncode(bytes) {
  const input = toUint8Array(bytes);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(input).toString('base64url');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < input.length; i += chunkSize) {
    binary += String.fromCharCode(...input.subarray(i, i + chunkSize));
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64urlDecode(value) {
  if (typeof value !== 'string') throw new TypeError('Expected base64url string');
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error('Invalid base64url encoding');
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64url'));
  }
  const padded = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function base64Encode(bytes) {
  const input = toUint8Array(bytes);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(input).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < input.length; i += chunkSize) {
    binary += String.fromCharCode(...input.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64Decode(value) {
  if (typeof value !== 'string') throw new TypeError('Expected base64 string');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('Invalid base64 encoding');
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64'));
  }
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function bytesToHex(bytes) {
  return [...toUint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(value, length, name) {
  if (typeof value !== 'string') throw new TypeError(`${name} must be a hex string`);
  const hex = value.startsWith('0x') ? value.slice(2) : value;
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length !== length * 2) {
    throw new Error(`${name} must be ${length} bytes hex`);
  }
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function normalizePublicKeyBytes(value, name) {
  if (value instanceof Uint8Array || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return assertBytes(name, value, ED25519_PUBLIC_KEY_BYTES);
  }
  if (typeof value !== 'string') {
    throw new TypeError(`${name} must be a byte array, hex, base64, or base64url string`);
  }
  const text = value.trim();
  if (/^(0x)?[0-9a-fA-F]{64}$/.test(text)) {
    return hexToBytes(text, ED25519_PUBLIC_KEY_BYTES, name);
  }
  try {
    return assertBytes(name, base64urlDecode(text), ED25519_PUBLIC_KEY_BYTES);
  } catch {
    return assertBytes(name, base64Decode(text), ED25519_PUBLIC_KEY_BYTES);
  }
}

function base64urlMaybeDecode(value, name) {
  try {
    return base64urlDecode(value);
  } catch {
    return base64Decode(value);
  }
}

function int32Be(value, name) {
  if (!Number.isSafeInteger(value) || value < -2147483648 || value > 2147483647) {
    throw new Error(`${name} must be a signed 32-bit integer`);
  }
  const out = new Uint8Array(4);
  new DataView(out.buffer).setInt32(0, value, false);
  return out;
}

function uint32Le(value, name) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`${name} must be an unsigned 32-bit integer`);
  }
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, true);
  return out;
}

function uint64Le(value, name) {
  const integer = typeof value === 'bigint' ? value : BigInt(value);
  if (integer < 0n || integer > 0xffffffffffffffffn) {
    throw new Error(`${name} must be an unsigned 64-bit integer`);
  }
  const out = new Uint8Array(8);
  let rest = integer;
  for (let i = 0; i < 8; i += 1) {
    out[i] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  return out;
}

function safeInteger(value, name) {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
  if (typeof value === 'bigint' && value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER)) {
    return Number(value);
  }
  if (typeof value === 'string' && /^-?[0-9]+$/.test(value)) {
    const numberValue = Number(value);
    if (Number.isSafeInteger(numberValue)) return numberValue;
  }
  throw new Error(`${name} must be a safe integer`);
}

function constantTimeEqual(left, right) {
  const a = toUint8Array(left);
  const b = toUint8Array(right);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}

async function sha256(...parts) {
  const digest = await getCrypto().subtle.digest('SHA-256', concatBytes(...parts));
  return new Uint8Array(digest);
}

function suiteConfig(suite) {
  const config = SUITE_CONFIG[suite];
  if (!config) throw new Error(`Unsupported Platho crypto suite: ${suite}`);
  return config;
}

function assertCanonicalAlg(suite, alg) {
  const expected = stableStringify(suiteConfig(suite).alg);
  const actual = stableStringify(alg);
  if (actual !== expected) {
    throw new Error(`Envelope algorithm does not match ${suite}`);
  }
}

function bytesToBigInt(bytes) {
  const input = toUint8Array(bytes);
  let out = 0n;
  for (const byte of input) out = (out << 8n) | BigInt(byte);
  return out;
}

function bigintHex256(value) {
  const bigint = BigInt(value);
  if (bigint < 0n || bigint >= (1n << 256n)) throw new Error('uint256 value is out of range');
  return `0x${bigint.toString(16).padStart(64, '0')}`;
}

function uintLikeToBigInt(value, name) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === 'string') {
    if (/^0x[0-9a-fA-F]+$/.test(value)) return BigInt(value);
    if (/^[0-9]+$/.test(value)) return BigInt(value);
  }
  if (value !== null && value !== undefined && typeof value.toString === 'function') {
    const stringValue = value.toString();
    if (/^[0-9]+$/.test(stringValue)) return BigInt(stringValue);
  }
  throw new Error(`${name} must be an unsigned integer-like value`);
}

function recordField(record, snakeName, camelName = snakeName) {
  if (record && Object.hasOwn(record, snakeName)) return record[snakeName];
  if (record && Object.hasOwn(record, camelName)) return record[camelName];
  throw new Error(`Vault key record missing ${snakeName}`);
}

function compareAddressLike(left, right) {
  const leftText = String(left).trim();
  const rightText = String(right).trim();
  if (leftText === rightText) return true;
  try {
    return parseTonAddress(leftText).raw === parseTonAddress(rightText).raw;
  } catch {
    return false;
  }
}

function assertHashHex(name, value) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{64}$/.test(value)) {
    throw new Error(`${name} must be a canonical uint256 hex string`);
  }
  if (BigInt(value) === 0n) throw new Error(`${name} must not be zero`);
  return value;
}

async function stableJsonHashHex(value) {
  return bigintHex256(bytesToBigInt(await sha256(utf8(stableStringify(value)))));
}

async function stableJsonHashId(value) {
  return base64urlEncode(await sha256(utf8(PRIVATE_CAPSULE_ID_DOMAIN), utf8(stableStringify(value))));
}

function sizeClassForSuite(suite) {
  if (suite === CRYPTO_SUITES.CLASSICAL_V1) return CAPSULE_SIZE_CLASS.STANDARD;
  if (suite === CRYPTO_SUITES.HYBRID_V1) return CAPSULE_SIZE_CLASS.LONG_TERM;
  throw new Error(`Unsupported Platho capsule suite: ${suite}`);
}

function assertAllowedPrivateCapsulePair(sizeClass, cryptoSuite) {
  const standard = sizeClass === CAPSULE_SIZE_CLASS.STANDARD && cryptoSuite === CONTRACT_CRYPTO_SUITE.CLASSICAL;
  const longTerm = sizeClass === CAPSULE_SIZE_CLASS.LONG_TERM && cryptoSuite === CONTRACT_CRYPTO_SUITE.HYBRID;
  if (!standard && !longTerm) {
    throw new Error('Private capsule size class and crypto suite do not match CapsuleHub rules');
  }
}

function assertCapsuleTimestampPolicy(header1, options = {}) {
  const now = options.now ?? Date.now();
  const maxTtlMs = options.maxTtlMs ?? MAX_CAPSULE_TTL_MS;
  const clockSkewMs = options.clockSkewMs ?? DEFAULT_CLOCK_SKEW_MS;
  if (!Number.isSafeInteger(header1.createdAt) || !Number.isSafeInteger(header1.expiresAt)) {
    throw new Error('Private capsule timestamps must be safe integer milliseconds');
  }
  if (header1.createdAt > now + clockSkewMs) {
    throw new Error('Private capsule was created too far in the future');
  }
  if (header1.expiresAt <= header1.createdAt) {
    throw new Error('Private capsule expiry must be after creation time');
  }
  if (header1.expiresAt - header1.createdAt > maxTtlMs) {
    throw new Error('Private capsule TTL exceeds policy');
  }
  if (options.enforceExpiry !== false && header1.expiresAt <= now) {
    throw new Error('Private capsule is expired');
  }
}

function assertEnvelopeMatchesRecipient(envelope, recipientKeyPair) {
  if (!envelope || envelope.version !== PROTOCOL_VERSION) throw new Error('Invalid Platho envelope');
  const config = suiteConfig(envelope.suite);
  if (envelope.contractSuite !== config.contractSuite) {
    throw new Error(`Envelope contract suite does not match ${envelope.suite}`);
  }
  assertCanonicalAlg(envelope.suite, envelope.alg);
  assertBytes('envelope.nonce', base64urlDecode(envelope.nonce), AES_GCM_NONCE_BYTES);

  if (recipientKeyPair.suite !== envelope.suite) {
    throw new Error(`Recipient key suite ${recipientKeyPair.suite} cannot decrypt ${envelope.suite}`);
  }
  if (recipientKeyPair.contractSuite !== envelope.contractSuite) {
    throw new Error('Recipient contract suite does not match envelope contract suite');
  }
  if (recipientKeyPair.keyId && envelope.recipientKeyId !== recipientKeyPair.keyId) {
    throw new Error('Envelope recipient key id does not match recipient key pair');
  }

  if (envelope.suite === CRYPTO_SUITES.CLASSICAL_V1 && envelope.kem?.mlKem768Ciphertext !== undefined) {
    throw new Error('classical-v1 envelope must not carry ML-KEM ciphertext');
  }
  if (envelope.suite === CRYPTO_SUITES.HYBRID_V1 && envelope.kem?.mlKem768Ciphertext === undefined) {
    throw new Error('hybrid-v1 envelope must carry ML-KEM ciphertext');
  }
}

async function deriveAesGcmKey(sharedParts, protectedHeader) {
  const transcript = utf8(stableStringify(protectedHeader));
  const transcriptHash = await sha256(transcript);
  const ikm = concatBytes(...sharedParts);
  const salt = await sha256(utf8(MESSAGE_SALT_DOMAIN), transcriptHash);
  const info = concatBytes(utf8(MESSAGE_KEY_DOMAIN), transcriptHash);
  const hkdfKey = await getCrypto().subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey']);
  return getCrypto().subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function protectedHeader(envelope) {
  const header = {
    version: envelope.version,
    suite: envelope.suite,
    contractSuite: envelope.contractSuite,
    alg: envelope.alg,
    senderKeyId: envelope.senderKeyId,
    recipientKeyId: envelope.recipientKeyId,
    createdAt: envelope.createdAt,
    nonce: envelope.nonce,
    kem: envelope.kem,
  };
  if (envelope.context !== undefined) header.context = envelope.context;
  return header;
}

async function encryptBytes(plainBytes, sharedParts, envelope) {
  const header = protectedHeader(envelope);
  const key = await deriveAesGcmKey(sharedParts, header);
  const aad = utf8(stableStringify(header));
  const nonce = base64urlDecode(envelope.nonce);
  const ciphertext = await getCrypto().subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: aad, tagLength: 128 },
    key,
    toUint8Array(plainBytes),
  );
  return base64urlEncode(new Uint8Array(ciphertext));
}

async function decryptBytes(envelope, sharedParts) {
  const header = protectedHeader(envelope);
  const key = await deriveAesGcmKey(sharedParts, header);
  const aad = utf8(stableStringify(header));
  const nonce = base64urlDecode(envelope.nonce);
  const ciphertext = base64urlDecode(envelope.ciphertext);
  const plaintext = await getCrypto().subtle.decrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: aad, tagLength: 128 },
    key,
    ciphertext,
  );
  return new Uint8Array(plaintext);
}

export async function computeClassicalKeyId(x25519PublicKey) {
  const digest = await sha256(utf8(KEY_ID_CLASSICAL_DOMAIN), assertBytes('x25519PublicKey', x25519PublicKey, 32));
  return base64urlEncode(digest);
}

export async function computeHybridKeyId(x25519PublicKey, mlKem768PublicKey) {
  const pqPublicKey = assertBytes('mlKem768PublicKey', mlKem768PublicKey, MLKEM768_PUBLIC_KEY_BYTES);
  const pqHash = await sha256(pqPublicKey);
  const digest = await sha256(
    utf8(KEY_ID_HYBRID_DOMAIN),
    assertBytes('x25519PublicKey', x25519PublicKey, 32),
    pqHash,
    utf8(String(MLKEM768_PUBLIC_KEY_BYTES)),
  );
  return base64urlEncode(digest);
}

export async function createClassicalKeyPair() {
  const secretKey = randomBytes(X25519_SECRET_KEY_BYTES);
  const publicKey = x25519.getPublicKey(secretKey);
  return {
    suite: CRYPTO_SUITES.CLASSICAL_V1,
    contractSuite: CONTRACT_CRYPTO_SUITE.CLASSICAL,
    keyId: await computeClassicalKeyId(publicKey),
    x25519SecretKey: secretKey,
    x25519PublicKey: publicKey,
  };
}

export async function createHybridKeyPair() {
  const x25519SecretKey = randomBytes(X25519_SECRET_KEY_BYTES);
  const x25519PublicKey = x25519.getPublicKey(x25519SecretKey);
  const mlKem = ml_kem768.keygen();
  const mlKem768PublicKey = assertBytes('mlKem768PublicKey', mlKem.publicKey, MLKEM768_PUBLIC_KEY_BYTES);
  const mlKem768SecretKey = assertBytes('mlKem768SecretKey', mlKem.secretKey, 2400);
  const mlKem768PublicKeyHash = await sha256(mlKem768PublicKey);
  return {
    suite: CRYPTO_SUITES.HYBRID_V1,
    contractSuite: CONTRACT_CRYPTO_SUITE.HYBRID,
    keyId: await computeHybridKeyId(x25519PublicKey, mlKem768PublicKey),
    x25519SecretKey,
    x25519PublicKey,
    mlKem768SecretKey,
    mlKem768PublicKey,
    mlKem768PublicKeyHash,
    mlKem768PublicKeyLen: MLKEM768_PUBLIC_KEY_BYTES,
  };
}

export async function createMessagingIdentity(options = {}) {
  const encryptionKeyPair = options.suite === CRYPTO_SUITES.CLASSICAL_V1
    ? await createClassicalKeyPair()
    : await createHybridKeyPair();
  const signingSecretKey = options.signingSecretKey
    ? assertBytes('signingSecretKey', options.signingSecretKey, ED25519_SECRET_KEY_BYTES)
    : randomBytes(ED25519_SECRET_KEY_BYTES);
  const signingPublicKey = assertBytes(
    'signingPublicKey',
    ed25519.getPublicKey(signingSecretKey),
    ED25519_PUBLIC_KEY_BYTES,
  );
  return {
    version: PROTOCOL_VERSION,
    suite: encryptionKeyPair.suite,
    contractSuite: encryptionKeyPair.contractSuite,
    keyId: encryptionKeyPair.keyId,
    encryptionKeyPair,
    signingSecretKey,
    signingPublicKey,
  };
}

export function exportPublicKeyBundle(keyPair) {
  const config = suiteConfig(keyPair.suite);
  const bundle = {
    version: PROTOCOL_VERSION,
    suite: keyPair.suite,
    contractSuite: config.contractSuite,
    keyId: keyPair.keyId,
    x25519PublicKey: base64urlEncode(assertBytes('x25519PublicKey', keyPair.x25519PublicKey, 32)),
  };
  if (keyPair.suite === CRYPTO_SUITES.HYBRID_V1) {
    bundle.mlKem768PublicKey = base64urlEncode(assertBytes('mlKem768PublicKey', keyPair.mlKem768PublicKey, MLKEM768_PUBLIC_KEY_BYTES));
    bundle.mlKem768PublicKeyHash = base64urlEncode(assertBytes('mlKem768PublicKeyHash', keyPair.mlKem768PublicKeyHash, 32));
    bundle.mlKem768PublicKeyLen = MLKEM768_PUBLIC_KEY_BYTES;
  }
  return bundle;
}

async function normalizeRecipientBundle(bundle) {
  if (!bundle || bundle.version !== PROTOCOL_VERSION || typeof bundle.keyId !== 'string') {
    throw new Error('Invalid Platho public key bundle');
  }
  const config = suiteConfig(bundle.suite);
  if (bundle.contractSuite !== config.contractSuite) {
    throw new Error(`Public key bundle contract suite does not match ${bundle.suite}`);
  }
  const x25519PublicKey = assertBytes('recipient.x25519PublicKey', base64urlDecode(bundle.x25519PublicKey), 32);
  if (bundle.suite === CRYPTO_SUITES.CLASSICAL_V1) {
    if (
      bundle.mlKem768PublicKey !== undefined ||
      bundle.mlKem768PublicKeyHash !== undefined ||
      bundle.mlKem768PublicKeyLen !== undefined
    ) {
      throw new Error('classical-v1 public key bundle must not carry ML-KEM fields');
    }
    const expectedKeyId = await computeClassicalKeyId(x25519PublicKey);
    if (bundle.keyId !== expectedKeyId) {
      throw new Error('classical-v1 public key bundle id does not match key material');
    }
    return { ...bundle, x25519PublicKey };
  }
  if (bundle.suite === CRYPTO_SUITES.HYBRID_V1) {
    if (bundle.mlKem768PublicKeyLen !== MLKEM768_PUBLIC_KEY_BYTES) {
      throw new Error('hybrid-v1 public key bundle has an invalid ML-KEM public key length');
    }
    const mlKem768PublicKey = assertBytes(
      'recipient.mlKem768PublicKey',
      base64urlDecode(bundle.mlKem768PublicKey),
      MLKEM768_PUBLIC_KEY_BYTES,
    );
    const mlKem768PublicKeyHash = await sha256(mlKem768PublicKey);
    const advertisedHash = assertBytes(
      'recipient.mlKem768PublicKeyHash',
      base64urlDecode(bundle.mlKem768PublicKeyHash),
      32,
    );
    if (base64urlEncode(mlKem768PublicKeyHash) !== base64urlEncode(advertisedHash)) {
      throw new Error('hybrid-v1 public key bundle ML-KEM hash does not match key material');
    }
    const expectedKeyId = await computeHybridKeyId(x25519PublicKey, mlKem768PublicKey);
    if (bundle.keyId !== expectedKeyId) {
      throw new Error('hybrid-v1 public key bundle id does not match key material');
    }
    return { ...bundle, x25519PublicKey, mlKem768PublicKey };
  }
  throw new Error(`Unsupported Platho crypto suite: ${bundle.suite}`);
}

function signedBundlePayload(publicBundle, signingPublicKey, options = {}) {
  return {
    domain: SIGNED_BUNDLE_DOMAIN,
    version: PROTOCOL_VERSION,
    issuedAt: options.issuedAt,
    expiresAt: options.expiresAt ?? null,
    ownerWallet: options.ownerWallet ?? null,
    vaultAddress: options.vaultAddress ?? null,
    purpose: options.purpose ?? 'messaging',
    bundle: publicBundle,
    signingPublicKey: base64urlEncode(assertBytes('signingPublicKey', signingPublicKey, ED25519_PUBLIC_KEY_BYTES)),
  };
}

export async function exportSignedPublicKeyBundle(identity, options = {}) {
  if (!identity?.encryptionKeyPair || !identity?.signingSecretKey || !identity?.signingPublicKey) {
    throw new Error('Invalid Platho messaging identity');
  }
  const bundle = exportPublicKeyBundle(identity.encryptionKeyPair);
  const issuedAt = options.issuedAt ?? Date.now();
  const payload = signedBundlePayload(bundle, identity.signingPublicKey, { ...options, issuedAt });
  const signature = ed25519.sign(utf8(stableStringify(payload)), identity.signingSecretKey);
  return {
    ...payload,
    signature: base64urlEncode(assertBytes('signature', signature, ED25519_SIGNATURE_BYTES)),
  };
}

export async function verifySignedPublicKeyBundle(signedBundle, options = {}) {
  if (!signedBundle || signedBundle.domain !== SIGNED_BUNDLE_DOMAIN || signedBundle.version !== PROTOCOL_VERSION) {
    throw new Error('Invalid Platho signed public key bundle');
  }
  if (options.now !== undefined && signedBundle.expiresAt !== null && signedBundle.expiresAt < options.now) {
    throw new Error('Platho signed public key bundle is expired');
  }
  await normalizeRecipientBundle(signedBundle.bundle);
  const signingPublicKey = assertBytes(
    'signedBundle.signingPublicKey',
    base64urlDecode(signedBundle.signingPublicKey),
    ED25519_PUBLIC_KEY_BYTES,
  );
  const signature = assertBytes(
    'signedBundle.signature',
    base64urlDecode(signedBundle.signature),
    ED25519_SIGNATURE_BYTES,
  );
  const payload = signedBundlePayload(signedBundle.bundle, signingPublicKey, signedBundle);
  const verified = ed25519.verify(signature, utf8(stableStringify(payload)), signingPublicKey, { zip215: false });
  if (!verified) throw new Error('Platho signed public key bundle signature is invalid');
  return {
    bundle: signedBundle.bundle,
    signingPublicKey,
    keyId: signedBundle.bundle.keyId,
    suite: signedBundle.bundle.suite,
    contractSuite: signedBundle.bundle.contractSuite,
    issuedAt: signedBundle.issuedAt,
    expiresAt: signedBundle.expiresAt,
    ownerWallet: signedBundle.ownerWallet,
    vaultAddress: signedBundle.vaultAddress,
    purpose: signedBundle.purpose,
  };
}

async function signedBundleHash(signedBundle) {
  return stableJsonHashHex({ domain: WALLET_BUNDLE_HASH_DOMAIN, signedBundle });
}

function parseTonRawAddress(address) {
  if (typeof address !== 'string') throw new TypeError('TON address must be a string');
  const match = address.trim().match(/^(-?\d+):([0-9a-fA-F]{64})$/);
  if (!match) {
    throw new Error('TON proof verification requires a raw address in workchain:hex format');
  }
  const workchain = safeInteger(match[1], 'tonAddress.workchain');
  return {
    raw: `${workchain}:${match[2].toLowerCase()}`,
    workchain,
    hash: hexToBytes(match[2], 32, 'tonAddress.hash'),
  };
}

function crc16Ccitt(bytes) {
  let crc = 0;
  for (const byte of toUint8Array(bytes)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc;
}

function parseTonFriendlyAddress(address) {
  const text = String(address).trim();
  const bytes = base64urlMaybeDecode(text, 'tonAddress');
  if (bytes.length !== 36) {
    throw new Error('TON user-friendly address must decode to 36 bytes');
  }
  const body = bytes.subarray(0, 34);
  const checksum = (bytes[34] << 8) | bytes[35];
  if (crc16Ccitt(body) !== checksum) {
    throw new Error('TON user-friendly address checksum mismatch');
  }
  const tag = bytes[0];
  if (![0x11, 0x51, 0x91, 0xd1].includes(tag)) {
    throw new Error('TON user-friendly address has unsupported flags');
  }
  const workchain = bytes[1] === 0xff ? -1 : bytes[1] > 0x7f ? bytes[1] - 0x100 : bytes[1];
  const hash = bytes.subarray(2, 34);
  return {
    raw: `${workchain}:${bytesToHex(hash)}`,
    workchain,
    hash,
    bounceable: tag === 0x11 || tag === 0x91,
    testOnly: tag === 0x91 || tag === 0xd1,
  };
}

export function parseTonAddress(address) {
  try {
    return parseTonRawAddress(address);
  } catch (rawError) {
    try {
      return parseTonFriendlyAddress(address);
    } catch {
      throw rawError;
    }
  }
}

function normalizeTonConnectProof(input) {
  const proof = input?.proof
    ?? input?.connectItems?.tonProof?.proof
    ?? input?.tonProof?.proof
    ?? input?.ton_proof?.proof
    ?? null;
  const account = input?.account ?? {
    address: input?.address,
    publicKey: input?.publicKey ?? input?.public_key,
    walletStateInit: input?.walletStateInit ?? input?.wallet_state_init,
    chain: input?.chain ?? input?.network,
  };
  if (!account?.address || !proof) throw new Error('TON Connect proof requires account and proof objects');
  const timestamp = safeInteger(proof.timestamp, 'tonProof.timestamp');
  const domainValue = proof.domain?.value;
  const domainLengthBytes = safeInteger(proof.domain?.lengthBytes, 'tonProof.domain.lengthBytes');
  if (typeof domainValue !== 'string' || domainValue.length === 0) {
    throw new Error('TON proof domain is required');
  }
  const domainBytes = utf8(domainValue);
  if (domainBytes.length !== domainLengthBytes) {
    throw new Error('TON proof domain length does not match UTF-8 byte length');
  }
  if (typeof proof.payload !== 'string' || proof.payload.length === 0) {
    throw new Error('TON proof payload is required');
  }
  return {
    account: {
      ...account,
      address: parseTonAddress(account.address).raw,
    },
    proof: {
      timestamp,
      domain: {
        lengthBytes: domainLengthBytes,
        value: domainValue,
      },
      signature: proof.signature,
      payload: proof.payload,
    },
  };
}

async function tonConnectProofSigningHash(accountAddress, proof) {
  const address = parseTonAddress(accountAddress);
  const domainBytes = utf8(proof.domain.value);
  const message = concatBytes(
    utf8(TON_PROOF_PREFIX),
    int32Be(address.workchain, 'tonAddress.workchain'),
    address.hash,
    uint32Le(proof.domain.lengthBytes, 'tonProof.domain.lengthBytes'),
    domainBytes,
    uint64Le(proof.timestamp, 'tonProof.timestamp'),
    utf8(proof.payload),
  );
  const messageHash = await sha256(message);
  return sha256(new Uint8Array([0xff, 0xff]), utf8(TON_CONNECT_SIGNATURE_DOMAIN), messageHash);
}

async function resolveTonWalletPublicKey(account, options = {}) {
  const advertised = account.publicKey ?? account.public_key
    ? normalizePublicKeyBytes(account.publicKey ?? account.public_key, 'tonConnect.account.publicKey')
    : null;
  let verified = null;
  let source = null;
  if (options.verifiedWalletPublicKey) {
    verified = normalizePublicKeyBytes(options.verifiedWalletPublicKey, 'verifiedWalletPublicKey');
    source = 'verified-option';
  } else if (typeof options.getWalletPublicKey === 'function') {
    const resolved = await options.getWalletPublicKey(account);
    if (resolved) {
      verified = normalizePublicKeyBytes(resolved, 'resolvedWalletPublicKey');
      source = 'chain-or-state-init';
    }
  }
  if (verified) {
    if (advertised && !constantTimeEqual(advertised, verified)) {
      throw new Error('TON Connect account public key does not match verified wallet public key');
    }
    return { publicKey: verified, source };
  }
  if (options.trustTonConnectAccountPublicKey === true && advertised) {
    return { publicKey: advertised, source: 'tonconnect-account-unverified' };
  }
  throw new Error('TON wallet public key must be verified from walletStateInit or chain lookup');
}

export async function createTonConnectOwnershipPayload(signedBundle, options = {}) {
  const verified = await verifySignedPublicKeyBundle(signedBundle, { now: options.now });
  const bundleHash = options.bundleHash ?? await signedBundleHash(signedBundle);
  const issuedAt = options.issuedAt ?? Date.now();
  const expiresAt = options.expiresAt ?? issuedAt + DEFAULT_TON_PROOF_MAX_AGE_SEC * 1000;
  if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt) || expiresAt <= issuedAt) {
    throw new Error('TON Connect ownership payload timestamps are invalid');
  }
  return stableStringify({
    domain: WALLET_OWNERSHIP_DOMAIN,
    version: PROTOCOL_VERSION,
    issuedAt,
    expiresAt,
    vaultAddress: options.vaultAddress ?? signedBundle.vaultAddress ?? null,
    keyId: verified.keyId,
    bundleHash,
    nonce: options.nonce ?? base64urlEncode(randomBytes(16)),
  });
}

async function parseTonConnectOwnershipPayload(signedBundle, payloadString, options = {}) {
  let payload;
  try {
    payload = JSON.parse(payloadString);
  } catch {
    throw new Error('TON Connect ownership payload is not valid JSON');
  }
  if (!payload || payload.domain !== WALLET_OWNERSHIP_DOMAIN || payload.version !== PROTOCOL_VERSION) {
    throw new Error('Invalid Platho TON Connect ownership payload');
  }
  const now = options.now ?? Date.now();
  const clockSkewMs = options.clockSkewMs ?? DEFAULT_CLOCK_SKEW_MS;
  if (!Number.isSafeInteger(payload.issuedAt) || !Number.isSafeInteger(payload.expiresAt)) {
    throw new Error('TON Connect ownership payload timestamps must be safe integer milliseconds');
  }
  if (payload.expiresAt - payload.issuedAt > (options.maxPayloadAgeMs ?? DEFAULT_TON_PROOF_MAX_AGE_SEC * 1000)) {
    throw new Error('TON Connect ownership payload lifetime exceeds policy');
  }
  if (payload.issuedAt > now + clockSkewMs) {
    throw new Error('TON Connect ownership payload was issued too far in the future');
  }
  if (payload.expiresAt <= now) {
    throw new Error('TON Connect ownership payload is expired');
  }
  if (typeof payload.nonce !== 'string' || payload.nonce.length < 16) {
    throw new Error('TON Connect ownership payload nonce is too short');
  }
  const verified = await verifySignedPublicKeyBundle(signedBundle, { now: options.now });
  const bundleHash = await signedBundleHash(signedBundle);
  if (payload.keyId !== verified.keyId) {
    throw new Error('TON Connect ownership payload key id does not match signed bundle');
  }
  if (payload.bundleHash !== bundleHash) {
    throw new Error('TON Connect ownership payload bundle hash does not match signed bundle');
  }
  if (payload.vaultAddress !== null && typeof payload.vaultAddress !== 'string') {
    throw new Error('TON Connect ownership payload vault address is invalid');
  }
  const canonicalPayload = {
    domain: payload.domain,
    version: payload.version,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    vaultAddress: payload.vaultAddress,
    keyId: payload.keyId,
    bundleHash: payload.bundleHash,
    nonce: payload.nonce,
  };
  if (stableStringify(payload) !== stableStringify(canonicalPayload)) {
    throw new Error('TON Connect ownership payload has unexpected fields');
  }
  if (options.expectedVaultAddress && !compareAddressLike(payload.vaultAddress, options.expectedVaultAddress)) {
    throw new Error('TON Connect ownership payload Vault address mismatch');
  }
  return { payload, verifiedBundle: verified, bundleHash };
}

export async function verifyTonConnectWalletOwnershipProof(signedBundle, tonConnectProof, options = {}) {
  const { account, proof } = normalizeTonConnectProof(tonConnectProof);
  const now = options.now ?? Date.now();
  const nowSec = options.nowSec ?? Math.floor(now / 1000);
  const clockSkewSec = options.clockSkewSec ?? Math.ceil(DEFAULT_CLOCK_SKEW_MS / 1000);
  const maxAgeSec = options.maxAgeSec ?? DEFAULT_TON_PROOF_MAX_AGE_SEC;
  if (proof.timestamp > nowSec + clockSkewSec) {
    throw new Error('TON proof timestamp is too far in the future');
  }
  if (proof.timestamp < nowSec - maxAgeSec) {
    throw new Error('TON proof timestamp is too old');
  }
  if (options.expectedDomain && proof.domain.value !== options.expectedDomain) {
    throw new Error('TON proof domain is not allowed');
  }
  const { payload, verifiedBundle, bundleHash } = await parseTonConnectOwnershipPayload(
    signedBundle,
    proof.payload,
    options,
  );
  const resolved = await resolveTonWalletPublicKey(account, options);
  const signature = assertBytes(
    'tonProof.signature',
    base64urlMaybeDecode(proof.signature),
    ED25519_SIGNATURE_BYTES,
  );
  const signingHash = await tonConnectProofSigningHash(account.address, proof);
  const verified = ed25519.verify(signature, signingHash, resolved.publicKey, { zip215: false });
  if (!verified) throw new Error('TON proof signature is invalid');

  if (options.walletAddress && !compareAddressLike(account.address, options.walletAddress)) {
    throw new Error('TON proof wallet address mismatch');
  }
  if (
    signedBundle.ownerWallet !== null &&
    signedBundle.ownerWallet !== undefined &&
    !compareAddressLike(signedBundle.ownerWallet, account.address)
  ) {
    throw new Error('Platho signed bundle owner wallet does not match TON proof');
  }
  return {
    walletAddress: account.address,
    walletPublicKey: resolved.publicKey,
    walletPublicKeySource: resolved.source,
    domain: proof.domain.value,
    timestamp: proof.timestamp,
    vaultAddress: payload.vaultAddress,
    keyId: verifiedBundle.keyId,
    bundleHash,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    payload,
  };
}

async function createTonConnectProofForSelfTest(options) {
  const walletPublicKey = normalizePublicKeyBytes(options.walletPublicKey, 'walletPublicKey');
  const proof = {
    timestamp: safeInteger(options.timestamp, 'tonProof.timestamp'),
    domain: {
      lengthBytes: utf8(options.domain).length,
      value: options.domain,
    },
    payload: options.payload,
  };
  const signingHash = await tonConnectProofSigningHash(options.address, proof);
  const signature = ed25519.sign(
    signingHash,
    assertBytes('walletSecretKey', options.walletSecretKey, ED25519_SECRET_KEY_BYTES),
  );
  return {
    account: {
      address: options.accountAddress ?? parseTonAddress(options.address).raw,
      publicKey: bytesToHex(walletPublicKey),
    },
    proof: {
      ...proof,
      signature: base64Encode(signature),
    },
  };
}

function tonFriendlyAddressForSelfTest(rawAddress, options = {}) {
  const parsed = parseTonRawAddress(rawAddress);
  const tag = (options.bounceable === false ? 0x51 : 0x11) + (options.testOnly ? 0x80 : 0);
  const workchainByte = parsed.workchain === -1 ? 0xff : parsed.workchain & 0xff;
  const body = concatBytes(new Uint8Array([tag, workchainByte]), parsed.hash);
  const checksum = crc16Ccitt(body);
  return base64urlEncode(concatBytes(body, new Uint8Array([checksum >> 8, checksum & 0xff])));
}

export async function createVaultMessagingKeyDraft(publicBundle, signingPublicKey) {
  const bundle = await normalizeRecipientBundle(publicBundle);
  const signPublicKey = assertBytes('signingPublicKey', signingPublicKey, ED25519_PUBLIC_KEY_BYTES);
  const encPublicKey = assertBytes('x25519PublicKey', bundle.x25519PublicKey, X25519_PUBLIC_KEY_BYTES);
  const pqHash = bundle.suite === CRYPTO_SUITES.HYBRID_V1
    ? assertBytes('mlKem768PublicKeyHash', base64urlDecode(bundle.mlKem768PublicKeyHash), 32)
    : new Uint8Array(32);
  const draft = {
    $$type: 'RegisterMessagingKeys',
    enc_pubkey: bytesToBigInt(encPublicKey),
    sign_pubkey: bytesToBigInt(signPublicKey),
    pq_kem_pubkey_hash: bytesToBigInt(pqHash),
    pq_kem_pubkey_len: bundle.suite === CRYPTO_SUITES.HYBRID_V1 ? BigInt(MLKEM768_PUBLIC_KEY_BYTES) : 0n,
    crypto_suite_mask: BigInt(bundle.contractSuite),
  };
  return {
    message: draft,
    json: {
      $$type: draft.$$type,
      enc_pubkey: bigintHex256(draft.enc_pubkey),
      sign_pubkey: bigintHex256(draft.sign_pubkey),
      pq_kem_pubkey_hash: bigintHex256(draft.pq_kem_pubkey_hash),
      pq_kem_pubkey_len: Number(draft.pq_kem_pubkey_len),
      crypto_suite_mask: Number(draft.crypto_suite_mask),
    },
  };
}

export async function verifyVaultKeyRecordBinding(signedBundle, keyRecord, options = {}) {
  const verifiedBundle = await verifySignedPublicKeyBundle(signedBundle, { now: options.now });
  if (options.walletProof) {
    throw new Error('Legacy local wallet proof is not supported; use TON Connect proof');
  }
  const wallet = options.tonConnectProof
    ? await verifyTonConnectWalletOwnershipProof(signedBundle, options.tonConnectProof, {
      ...options,
      walletAddress: options.ownerWallet,
    })
    : null;
  if (!keyRecord || keyRecord.exists !== true) throw new Error('Vault key record does not exist');
  const draft = await createVaultMessagingKeyDraft(verifiedBundle.bundle, verifiedBundle.signingPublicKey);

  const expectedOwner = options.ownerWallet ?? wallet?.walletAddress ?? signedBundle.ownerWallet;
  if (expectedOwner !== null && expectedOwner !== undefined) {
    const recordOwner = recordField(keyRecord, 'owner_wallet', 'ownerWallet');
    if (!compareAddressLike(recordOwner, expectedOwner)) {
      throw new Error('Vault key record owner does not match wallet proof');
    }
  }
  if (options.currentKeyId !== undefined && options.recordKeyId !== undefined) {
    const currentKeyId = uintLikeToBigInt(options.currentKeyId, 'currentKeyId');
    const recordKeyId = uintLikeToBigInt(options.recordKeyId, 'recordKeyId');
    if (currentKeyId !== recordKeyId) throw new Error('Vault current key id does not point to this key record');
  }

  const checks = [
    ['enc_pubkey', 'encPubkey', draft.message.enc_pubkey],
    ['sign_pubkey', 'signPubkey', draft.message.sign_pubkey],
    ['pq_kem_pubkey_hash', 'pqKemPubkeyHash', draft.message.pq_kem_pubkey_hash],
    ['pq_kem_pubkey_len', 'pqKemPubkeyLen', draft.message.pq_kem_pubkey_len],
    ['crypto_suite_mask', 'cryptoSuiteMask', draft.message.crypto_suite_mask],
  ];
  for (const [snakeName, camelName, expected] of checks) {
    const actual = uintLikeToBigInt(recordField(keyRecord, snakeName, camelName), snakeName);
    if (actual !== expected) throw new Error(`Vault key record ${snakeName} does not match signed bundle`);
  }
  if (uintLikeToBigInt(recordField(keyRecord, 'revoked_lt', 'revokedLt'), 'revoked_lt') !== 0n) {
    throw new Error('Vault key record is revoked');
  }

  return {
    signedBundle: verifiedBundle,
    wallet,
    draft,
    active: true,
    recordKeyId: options.recordKeyId ?? null,
    currentKeyId: options.currentKeyId ?? null,
  };
}

async function computePrivateCapsuleHashes(header0, header1, body) {
  return {
    header0Hash: await stableJsonHashHex({ domain: PRIVATE_CAPSULE_HEADER0_DOMAIN, header0 }),
    header1Hash: await stableJsonHashHex({ domain: PRIVATE_CAPSULE_HEADER1_DOMAIN, header1 }),
    bodyHash: await stableJsonHashHex({ domain: PRIVATE_CAPSULE_BODY_DOMAIN, body }),
  };
}

async function computePrivateCapsuleId(hashes) {
  return stableJsonHashId({
    header0Hash: assertHashHex('header0Hash', hashes.header0Hash),
    header1Hash: assertHashHex('header1Hash', hashes.header1Hash),
    bodyHash: assertHashHex('bodyHash', hashes.bodyHash),
  });
}

function privateCapsuleSignaturePayload(capsule) {
  return {
    domain: PRIVATE_CAPSULE_SIGNATURE_DOMAIN,
    version: PROTOCOL_VERSION,
    id: capsule.id,
    header0Hash: capsule.hashes.header0Hash,
    header1Hash: capsule.hashes.header1Hash,
    bodyHash: capsule.hashes.bodyHash,
    senderKeyId: capsule.header0.senderKeyId,
    recipientKeyId: capsule.header0.recipientKeyId,
    createdAt: capsule.header1.createdAt,
    expiresAt: capsule.header1.expiresAt,
  };
}

function privateCapsulePublishDraft(capsule) {
  return {
    kind: 'private',
    publish_kind: CAPSULE_PUBLISH_KIND.PRIVATE,
    size_class: capsule.header0.sizeClass,
    crypto_suite: capsule.header0.cryptoSuite,
    header_0_hash: capsule.hashes.header0Hash,
    header_1_hash: capsule.hashes.header1Hash,
    body_hash: capsule.hashes.bodyHash,
    hashes_ref_order: ['body_hash', 'header_0_hash', 'header_1_hash'],
    valid_until: Math.floor(capsule.header1.expiresAt / 1000),
  };
}

export async function createEncryptedPrivateCapsule(plaintext, recipientSignedBundle, senderIdentity, options = {}) {
  if (!senderIdentity?.encryptionKeyPair || !senderIdentity?.signingSecretKey || !senderIdentity?.signingPublicKey) {
    throw new Error('Invalid Platho sender identity');
  }
  const now = options.now ?? Date.now();
  const recipient = await verifySignedPublicKeyBundle(recipientSignedBundle, { now });
  const suite = recipient.suite;
  const sizeClass = sizeClassForSuite(suite);
  const cryptoSuite = recipient.contractSuite;
  assertAllowedPrivateCapsulePair(sizeClass, cryptoSuite);

  const createdAt = options.createdAt ?? now;
  const expiresAt = options.expiresAt ?? createdAt + (options.ttlMs ?? DEFAULT_CAPSULE_TTL_MS);
  const clientNonce = options.clientNonce ?? base64urlEncode(randomBytes(16));
  const header0 = {
    version: PROTOCOL_VERSION,
    kind: 'private',
    publishKind: CAPSULE_PUBLISH_KIND.PRIVATE,
    sizeClass,
    cryptoSuite,
    suite,
    senderKeyId: senderIdentity.encryptionKeyPair.keyId,
    recipientKeyId: recipient.keyId,
    senderSigningPublicKey: base64urlEncode(senderIdentity.signingPublicKey),
    recipientSigningPublicKey: recipientSignedBundle.signingPublicKey,
  };
  const header1 = {
    version: PROTOCOL_VERSION,
    createdAt,
    expiresAt,
    clientNonce,
    threadId: options.threadId ?? null,
    purpose: options.purpose ?? 'message',
  };
  assertCapsuleTimestampPolicy(header1, { ...options, now });

  const partialHashes = await computePrivateCapsuleHashes(header0, header1, { pending: true });
  const envelope = await encryptText(plaintext, recipient.bundle, {
    senderKeyId: senderIdentity.encryptionKeyPair.keyId,
    createdAt,
    context: {
      capsule: {
        version: PROTOCOL_VERSION,
        kind: 'private',
        header0Hash: partialHashes.header0Hash,
        header1Hash: partialHashes.header1Hash,
        clientNonce,
        threadId: header1.threadId,
      },
    },
  });
  const body = {
    version: PROTOCOL_VERSION,
    kind: 'private',
    envelope,
  };
  const hashes = await computePrivateCapsuleHashes(header0, header1, body);
  const id = await computePrivateCapsuleId(hashes);
  const unsignedCapsule = {
    version: PROTOCOL_VERSION,
    kind: 'private',
    id,
    header0,
    header1,
    body,
    hashes,
  };
  const signature = ed25519.sign(utf8(stableStringify(privateCapsuleSignaturePayload(unsignedCapsule))), senderIdentity.signingSecretKey);
  const capsule = {
    ...unsignedCapsule,
    senderSignature: base64urlEncode(assertBytes('senderSignature', signature, ED25519_SIGNATURE_BYTES)),
  };
  return {
    ...capsule,
    publish: privateCapsulePublishDraft(capsule),
  };
}

export async function verifyEncryptedPrivateCapsule(capsule, options = {}) {
  if (!capsule || capsule.version !== PROTOCOL_VERSION || capsule.kind !== 'private') {
    throw new Error('Invalid Platho private capsule');
  }
  if (capsule.header0?.version !== PROTOCOL_VERSION || capsule.header0.kind !== 'private') {
    throw new Error('Invalid Platho private capsule header0');
  }
  if (capsule.header1?.version !== PROTOCOL_VERSION) {
    throw new Error('Invalid Platho private capsule header1');
  }
  assertAllowedPrivateCapsulePair(capsule.header0.sizeClass, capsule.header0.cryptoSuite);
  const expectedSizeClass = sizeClassForSuite(capsule.header0.suite);
  const expectedContractSuite = suiteConfig(capsule.header0.suite).contractSuite;
  if (capsule.header0.sizeClass !== expectedSizeClass || capsule.header0.cryptoSuite !== expectedContractSuite) {
    throw new Error('Private capsule header suite does not match size class');
  }
  assertCapsuleTimestampPolicy(capsule.header1, options);

  const hashes = await computePrivateCapsuleHashes(capsule.header0, capsule.header1, capsule.body);
  if (hashes.header0Hash !== assertHashHex('capsule.hashes.header0Hash', capsule.hashes?.header0Hash)) {
    throw new Error('Private capsule header0 hash mismatch');
  }
  if (hashes.header1Hash !== assertHashHex('capsule.hashes.header1Hash', capsule.hashes?.header1Hash)) {
    throw new Error('Private capsule header1 hash mismatch');
  }
  if (hashes.bodyHash !== assertHashHex('capsule.hashes.bodyHash', capsule.hashes?.bodyHash)) {
    throw new Error('Private capsule body hash mismatch');
  }
  const expectedId = await computePrivateCapsuleId(hashes);
  if (capsule.id !== expectedId) throw new Error('Private capsule id mismatch');

  const envelope = capsule.body?.envelope;
  if (capsule.body?.version !== PROTOCOL_VERSION || capsule.body?.kind !== 'private' || !envelope) {
    throw new Error('Invalid Platho private capsule body');
  }
  if (envelope?.context?.capsule?.header0Hash !== hashes.header0Hash) {
    throw new Error('Private capsule envelope header0 binding mismatch');
  }
  if (envelope?.context?.capsule?.header1Hash !== hashes.header1Hash) {
    throw new Error('Private capsule envelope header1 binding mismatch');
  }
  if (envelope?.context?.capsule?.clientNonce !== capsule.header1.clientNonce) {
    throw new Error('Private capsule envelope nonce binding mismatch');
  }
  if (envelope.suite !== capsule.header0.suite || envelope.contractSuite !== capsule.header0.cryptoSuite) {
    throw new Error('Private capsule envelope suite mismatch');
  }
  if (envelope.recipientKeyId !== capsule.header0.recipientKeyId) {
    throw new Error('Private capsule envelope recipient mismatch');
  }
  if (envelope.senderKeyId !== capsule.header0.senderKeyId) {
    throw new Error('Private capsule envelope sender mismatch');
  }

  const senderSigningPublicKey = assertBytes(
    'capsule.header0.senderSigningPublicKey',
    base64urlDecode(capsule.header0.senderSigningPublicKey),
    ED25519_PUBLIC_KEY_BYTES,
  );
  const senderSignature = assertBytes(
    'capsule.senderSignature',
    base64urlDecode(capsule.senderSignature),
    ED25519_SIGNATURE_BYTES,
  );
  const signaturePayload = privateCapsuleSignaturePayload(capsule);
  if (!ed25519.verify(senderSignature, utf8(stableStringify(signaturePayload)), senderSigningPublicKey, { zip215: false })) {
    throw new Error('Private capsule sender signature is invalid');
  }

  return {
    capsule,
    publish: privateCapsulePublishDraft(capsule),
    senderSigningPublicKey,
  };
}

export async function openEncryptedPrivateCapsule(capsule, recipientKeyPair, options = {}) {
  const verified = await verifyEncryptedPrivateCapsule(capsule, options);
  const replayCache = options.replayCache;
  if (replayCache && await replayCache.has(verified.capsule.id)) {
    throw new Error('Private capsule replay detected');
  }
  const plaintext = await decryptText(verified.capsule.body.envelope, recipientKeyPair);
  if (replayCache) await replayCache.add(verified.capsule.id, verified.capsule.header1.expiresAt);
  return {
    plaintext,
    capsule: verified.capsule,
    publish: verified.publish,
    senderSigningPublicKey: verified.senderSigningPublicKey,
  };
}

export async function encryptText(plaintext, recipientPublicBundle, options = {}) {
  const plainBytes = utf8(String(plaintext));
  const recipient = await normalizeRecipientBundle(recipientPublicBundle);
  const config = suiteConfig(recipient.suite);
  const createdAt = options.createdAt ?? Date.now();
  const nonce = randomBytes(AES_GCM_NONCE_BYTES);
  const ephemeralSecretKey = randomBytes(X25519_SECRET_KEY_BYTES);
  const ephemeralPublicKey = x25519.getPublicKey(ephemeralSecretKey);
  const x25519SharedSecret = deriveX25519SharedSecret(ephemeralSecretKey, recipient.x25519PublicKey);

  const baseEnvelope = {
    version: PROTOCOL_VERSION,
    suite: recipient.suite,
    contractSuite: config.contractSuite,
    alg: config.alg,
    senderKeyId: options.senderKeyId ?? null,
    recipientKeyId: recipient.keyId,
    createdAt,
    nonce: base64urlEncode(nonce),
    kem: {
      x25519EphemeralPublicKey: base64urlEncode(ephemeralPublicKey),
    },
    context: options.context,
  };

  if (recipient.suite === CRYPTO_SUITES.CLASSICAL_V1) {
    return {
      ...baseEnvelope,
      ciphertext: await encryptBytes(plainBytes, [x25519SharedSecret], baseEnvelope),
    };
  }

  const encapsulated = ml_kem768.encapsulate(recipient.mlKem768PublicKey);
  const mlKem768Ciphertext = assertBytes('mlKem768Ciphertext', encapsulated.cipherText, MLKEM768_CIPHERTEXT_BYTES);
  const mlKem768SharedSecret = assertBytes('mlKem768SharedSecret', encapsulated.sharedSecret, 32);
  const hybridEnvelope = {
    ...baseEnvelope,
    kem: {
      ...baseEnvelope.kem,
      mlKem768Ciphertext: base64urlEncode(mlKem768Ciphertext),
    },
  };
  return {
    ...hybridEnvelope,
    ciphertext: await encryptBytes(plainBytes, [x25519SharedSecret, mlKem768SharedSecret], hybridEnvelope),
  };
}

export async function decryptText(envelope, recipientKeyPair) {
  assertEnvelopeMatchesRecipient(envelope, recipientKeyPair);
  const ephemeralPublicKey = assertBytes(
    'envelope.kem.x25519EphemeralPublicKey',
    base64urlDecode(envelope.kem?.x25519EphemeralPublicKey),
    32,
  );
  const x25519SharedSecret = deriveX25519SharedSecret(recipientKeyPair.x25519SecretKey, ephemeralPublicKey);

  if (envelope.suite === CRYPTO_SUITES.CLASSICAL_V1) {
    const plaintext = await decryptBytes(envelope, [x25519SharedSecret]);
    return fromUtf8(plaintext);
  }

  if (envelope.suite === CRYPTO_SUITES.HYBRID_V1) {
    const mlKem768Ciphertext = assertBytes(
      'envelope.kem.mlKem768Ciphertext',
      base64urlDecode(envelope.kem?.mlKem768Ciphertext),
      MLKEM768_CIPHERTEXT_BYTES,
    );
    const mlKem768SharedSecret = ml_kem768.decapsulate(
      mlKem768Ciphertext,
      assertBytes('recipient.mlKem768SecretKey', recipientKeyPair.mlKem768SecretKey, 2400),
    );
    const plaintext = await decryptBytes(envelope, [x25519SharedSecret, mlKem768SharedSecret]);
    return fromUtf8(plaintext);
  }

  throw new Error(`Unsupported Platho envelope suite: ${envelope.suite}`);
}

export async function runPlathoCryptoSelfTest() {
  const alice = await createClassicalKeyPair();
  const bobClassical = await createClassicalKeyPair();
  const classicalEnvelope = await encryptText('standard sealed message', exportPublicKeyBundle(bobClassical), {
    senderKeyId: alice.keyId,
    context: { channel: 'self-test' },
  });
  const classicalPlaintext = await decryptText(classicalEnvelope, bobClassical);
  if (classicalPlaintext !== 'standard sealed message') {
    throw new Error('classical-v1 self-test failed');
  }

  const bobHybrid = await createHybridKeyPair();
  const hybridEnvelope = await encryptText('long-term hybrid sealed message', exportPublicKeyBundle(bobHybrid), {
    senderKeyId: alice.keyId,
    context: { channel: 'self-test' },
  });
  const hybridPlaintext = await decryptText(hybridEnvelope, bobHybrid);
  if (hybridPlaintext !== 'long-term hybrid sealed message') {
    throw new Error('hybrid-v1 self-test failed');
  }

  const identity = await createMessagingIdentity({ suite: CRYPTO_SUITES.HYBRID_V1 });
  const walletSecretKey = randomBytes(ED25519_SECRET_KEY_BYTES);
  const walletPublicKey = assertBytes(
    'walletPublicKey',
    ed25519.getPublicKey(walletSecretKey),
    ED25519_PUBLIC_KEY_BYTES,
  );
  const walletAddress = `0:${bytesToHex(await sha256(utf8('self-test-ton-wallet-address')))}`;
  const tonProofDomain = 'platho.local';
  const signedBundle = await exportSignedPublicKeyBundle(identity, {
    issuedAt: 1_700_000_000_000,
    expiresAt: 1_700_003_600_000,
    ownerWallet: walletAddress,
    vaultAddress: 'testnet:vault-placeholder',
  });
  const verifiedBundle = await verifySignedPublicKeyBundle(signedBundle, { now: 1_700_000_001_000 });
  const vaultDraft = await createVaultMessagingKeyDraft(verifiedBundle.bundle, verifiedBundle.signingPublicKey);
  if (vaultDraft.message.crypto_suite_mask !== BigInt(CONTRACT_CRYPTO_SUITE.HYBRID)) {
    throw new Error('hybrid-v1 Vault key draft failed');
  }
  if (vaultDraft.message.pq_kem_pubkey_len !== BigInt(MLKEM768_PUBLIC_KEY_BYTES)) {
    throw new Error('hybrid-v1 Vault key draft ML-KEM length failed');
  }
  const tonProofPayload = await createTonConnectOwnershipPayload(signedBundle, {
    issuedAt: 1_700_000_000_000,
    expiresAt: 1_700_000_600_000,
    vaultAddress: 'testnet:vault-placeholder',
    nonce: 'self-test-ton-proof-nonce',
  });
  const tonConnectProof = await createTonConnectProofForSelfTest({
    address: walletAddress,
    walletPublicKey,
    walletSecretKey,
    domain: tonProofDomain,
    timestamp: 1_700_000_001,
    payload: tonProofPayload,
  });
  const verifiedWalletProof = await verifyTonConnectWalletOwnershipProof(signedBundle, tonConnectProof, {
    now: 1_700_000_001_000,
    nowSec: 1_700_000_001,
    expectedDomain: tonProofDomain,
    verifiedWalletPublicKey: walletPublicKey,
  });
  const friendlyWalletAddress = tonFriendlyAddressForSelfTest(walletAddress, { testOnly: true });
  const friendlyTonConnectProof = await createTonConnectProofForSelfTest({
    address: walletAddress,
    accountAddress: friendlyWalletAddress,
    walletPublicKey,
    walletSecretKey,
    domain: tonProofDomain,
    timestamp: 1_700_000_001,
    payload: tonProofPayload,
  });
  const verifiedFriendlyWalletProof = await verifyTonConnectWalletOwnershipProof(signedBundle, friendlyTonConnectProof, {
    now: 1_700_000_001_000,
    nowSec: 1_700_000_001,
    expectedDomain: tonProofDomain,
    verifiedWalletPublicKey: walletPublicKey,
  });
  if (!compareAddressLike(verifiedFriendlyWalletProof.walletAddress, walletAddress)) {
    throw new Error('TON user-friendly wallet address normalization failed');
  }
  const activeVaultKeyRecord = {
    exists: true,
    owner_wallet: verifiedWalletProof.walletAddress,
    key_generation: 0n,
    enc_pubkey: vaultDraft.message.enc_pubkey,
    sign_pubkey: vaultDraft.message.sign_pubkey,
    pq_kem_pubkey_hash: vaultDraft.message.pq_kem_pubkey_hash,
    pq_kem_pubkey_len: vaultDraft.message.pq_kem_pubkey_len,
    crypto_suite_mask: vaultDraft.message.crypto_suite_mask,
    created_at: 1_700_000_000n,
    created_lt: 1n,
    revoked_at: 0n,
    revoked_lt: 0n,
  };
  const vaultRecordBinding = await verifyVaultKeyRecordBinding(signedBundle, activeVaultKeyRecord, {
    now: 1_700_000_001_000,
    nowSec: 1_700_000_001,
    ownerWallet: walletAddress,
    tonConnectProof,
    expectedDomain: tonProofDomain,
    verifiedWalletPublicKey: walletPublicKey,
    currentKeyId: '0x0100000000000000000000000000000000000000000000000000000000000001',
    recordKeyId: '0x0100000000000000000000000000000000000000000000000000000000000001',
  });
  if (!vaultRecordBinding.active) {
    throw new Error('Vault key record binding failed');
  }
  const capsuleReplayCache = new Set();
  const capsule = await createEncryptedPrivateCapsule('capsule sealed message', signedBundle, identity, {
    now: 1_700_000_002_000,
    createdAt: 1_700_000_002_000,
    expiresAt: 1_700_000_062_000,
    clientNonce: 'self-test-capsule-nonce',
    threadId: 'self-test',
  });
  const openedCapsule = await openEncryptedPrivateCapsule(capsule, identity.encryptionKeyPair, {
    now: 1_700_000_003_000,
    replayCache: capsuleReplayCache,
  });
  if (openedCapsule.plaintext !== 'capsule sealed message') {
    throw new Error('private capsule open failed');
  }
  if (openedCapsule.publish.size_class !== CAPSULE_SIZE_CLASS.LONG_TERM) {
    throw new Error('private capsule size class draft failed');
  }
  if (openedCapsule.publish.crypto_suite !== CONTRACT_CRYPTO_SUITE.HYBRID) {
    throw new Error('private capsule crypto suite draft failed');
  }

  const tampered = structuredClone(hybridEnvelope);
  tampered.recipientKeyId = `${tampered.recipientKeyId}.tampered`;
  let tamperChecks = 0;
  async function expectReject(label, fn) {
    let rejected = false;
    try {
      await fn();
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error(`${label} was not rejected`);
    tamperChecks += 1;
  }
  await expectReject('hybrid-v1 AAD recipient key id tamper', () => decryptText(tampered, bobHybrid));

  const kemTampered = structuredClone(hybridEnvelope);
  const tamperedKemBytes = base64urlDecode(kemTampered.kem.mlKem768Ciphertext);
  tamperedKemBytes[0] ^= 1;
  kemTampered.kem.mlKem768Ciphertext = base64urlEncode(tamperedKemBytes);
  await expectReject('hybrid-v1 KEM ciphertext tamper', () => decryptText(kemTampered, bobHybrid));

  const algTampered = structuredClone(hybridEnvelope);
  algTampered.alg.kdf = 'HKDF-SHA-512';
  await expectReject('hybrid-v1 algorithm confusion', () => decryptText(algTampered, bobHybrid));

  const bundleKeyTampered = exportPublicKeyBundle(bobHybrid);
  bundleKeyTampered.keyId = alice.keyId;
  await expectReject('hybrid-v1 public key bundle id tamper', () => encryptText('tamper', bundleKeyTampered));

  const bundleHashTampered = exportPublicKeyBundle(bobHybrid);
  bundleHashTampered.mlKem768PublicKeyHash = alice.keyId;
  await expectReject('hybrid-v1 public key bundle hash tamper', () => encryptText('tamper', bundleHashTampered));

  const signedBundleKeyTampered = structuredClone(signedBundle);
  signedBundleKeyTampered.bundle.keyId = alice.keyId;
  await expectReject('signed public key bundle tamper', () => verifySignedPublicKeyBundle(signedBundleKeyTampered));

  const signedBundleSignatureTampered = structuredClone(signedBundle);
  const tamperedSignatureBytes = base64urlDecode(signedBundleSignatureTampered.signature);
  tamperedSignatureBytes[0] ^= 1;
  signedBundleSignatureTampered.signature = base64urlEncode(tamperedSignatureBytes);
  await expectReject('signed public key bundle signature tamper', () => verifySignedPublicKeyBundle(signedBundleSignatureTampered));

  await expectReject('signed public key bundle expiry', () => verifySignedPublicKeyBundle(signedBundle, {
    now: 1_700_003_600_001,
  }));

  await expectReject('TON proof without verified public key source', () => verifyTonConnectWalletOwnershipProof(signedBundle, tonConnectProof, {
    now: 1_700_000_001_000,
    nowSec: 1_700_000_001,
    expectedDomain: tonProofDomain,
  }));

  const tonProofSignatureTampered = structuredClone(tonConnectProof);
  const walletSignatureBytes = base64Decode(tonProofSignatureTampered.proof.signature);
  walletSignatureBytes[0] ^= 1;
  tonProofSignatureTampered.proof.signature = base64Encode(walletSignatureBytes);
  await expectReject('TON proof signature tamper', () => verifyTonConnectWalletOwnershipProof(signedBundle, tonProofSignatureTampered, {
    now: 1_700_000_001_000,
    nowSec: 1_700_000_001,
    expectedDomain: tonProofDomain,
    verifiedWalletPublicKey: walletPublicKey,
  }));

  const tonProofBundlePayloadTampered = JSON.parse(tonProofPayload);
  tonProofBundlePayloadTampered.bundleHash = vaultDraft.json.enc_pubkey;
  const tonProofBundleTampered = await createTonConnectProofForSelfTest({
    address: walletAddress,
    walletPublicKey,
    walletSecretKey,
    domain: tonProofDomain,
    timestamp: 1_700_000_001,
    payload: stableStringify(tonProofBundlePayloadTampered),
  });
  await expectReject('TON proof bundle hash tamper', () => verifyTonConnectWalletOwnershipProof(signedBundle, tonProofBundleTampered, {
    now: 1_700_000_001_000,
    nowSec: 1_700_000_001,
    expectedDomain: tonProofDomain,
    verifiedWalletPublicKey: walletPublicKey,
  }));

  await expectReject('TON proof payload expiry', () => verifyTonConnectWalletOwnershipProof(signedBundle, tonConnectProof, {
    now: 1_700_000_600_001,
    nowSec: 1_700_000_600,
    expectedDomain: tonProofDomain,
    verifiedWalletPublicKey: walletPublicKey,
  }));

  await expectReject('TON proof timestamp stale', () => verifyTonConnectWalletOwnershipProof(signedBundle, tonConnectProof, {
    now: 1_700_000_003_000,
    nowSec: 1_700_000_003,
    maxAgeSec: 1,
    expectedDomain: tonProofDomain,
    verifiedWalletPublicKey: walletPublicKey,
  }));

  await expectReject('TON proof domain mismatch', () => verifyTonConnectWalletOwnershipProof(signedBundle, tonConnectProof, {
    now: 1_700_000_001_000,
    nowSec: 1_700_000_001,
    expectedDomain: 'evil.example',
    verifiedWalletPublicKey: walletPublicKey,
  }));

  const ownerMismatchRecord = { ...activeVaultKeyRecord, owner_wallet: 'testnet:attacker-wallet-placeholder' };
  await expectReject('Vault key record owner mismatch', () => verifyVaultKeyRecordBinding(signedBundle, ownerMismatchRecord, {
    now: 1_700_000_001_000,
    nowSec: 1_700_000_001,
    ownerWallet: walletAddress,
    tonConnectProof,
    expectedDomain: tonProofDomain,
    verifiedWalletPublicKey: walletPublicKey,
  }));

  const revokedRecord = { ...activeVaultKeyRecord, revoked_lt: 2n };
  await expectReject('Vault key record revoked', () => verifyVaultKeyRecordBinding(signedBundle, revokedRecord, {
    now: 1_700_000_001_000,
    nowSec: 1_700_000_001,
    ownerWallet: walletAddress,
    tonConnectProof,
    expectedDomain: tonProofDomain,
    verifiedWalletPublicKey: walletPublicKey,
  }));

  const encMismatchRecord = { ...activeVaultKeyRecord, enc_pubkey: activeVaultKeyRecord.enc_pubkey ^ 1n };
  await expectReject('Vault key record enc_pubkey mismatch', () => verifyVaultKeyRecordBinding(signedBundle, encMismatchRecord, {
    now: 1_700_000_001_000,
    nowSec: 1_700_000_001,
    ownerWallet: walletAddress,
    tonConnectProof,
    expectedDomain: tonProofDomain,
    verifiedWalletPublicKey: walletPublicKey,
  }));

  await expectReject('private capsule replay', () => openEncryptedPrivateCapsule(capsule, identity.encryptionKeyPair, {
    now: 1_700_000_004_000,
    replayCache: capsuleReplayCache,
  }));

  await expectReject('private capsule expiry', () => openEncryptedPrivateCapsule(capsule, identity.encryptionKeyPair, {
    now: 1_700_000_062_001,
    replayCache: new Set(),
  }));

  const capsuleHeaderTampered = structuredClone(capsule);
  capsuleHeaderTampered.header1.threadId = 'tampered-thread';
  await expectReject('private capsule header tamper', () => verifyEncryptedPrivateCapsule(capsuleHeaderTampered, {
    now: 1_700_000_004_000,
  }));

  const capsuleBodyTampered = structuredClone(capsule);
  capsuleBodyTampered.body.envelope.senderKeyId = alice.keyId;
  await expectReject('private capsule body tamper', () => verifyEncryptedPrivateCapsule(capsuleBodyTampered, {
    now: 1_700_000_004_000,
  }));

  const capsuleSignatureTampered = structuredClone(capsule);
  const capsuleSignatureBytes = base64urlDecode(capsuleSignatureTampered.senderSignature);
  capsuleSignatureBytes[0] ^= 1;
  capsuleSignatureTampered.senderSignature = base64urlEncode(capsuleSignatureBytes);
  await expectReject('private capsule signature tamper', () => verifyEncryptedPrivateCapsule(capsuleSignatureTampered, {
    now: 1_700_000_004_000,
  }));

  const capsuleContextTampered = structuredClone(capsule);
  capsuleContextTampered.body.envelope.context.capsule.header0Hash = capsule.hashes.header1Hash;
  capsuleContextTampered.hashes = await computePrivateCapsuleHashes(
    capsuleContextTampered.header0,
    capsuleContextTampered.header1,
    capsuleContextTampered.body,
  );
  capsuleContextTampered.id = await computePrivateCapsuleId(capsuleContextTampered.hashes);
  capsuleContextTampered.publish = privateCapsulePublishDraft(capsuleContextTampered);
  capsuleContextTampered.senderSignature = base64urlEncode(ed25519.sign(
    utf8(stableStringify(privateCapsuleSignaturePayload(capsuleContextTampered))),
    identity.signingSecretKey,
  ));
  await expectReject('private capsule envelope context mismatch', () => verifyEncryptedPrivateCapsule(capsuleContextTampered, {
    now: 1_700_000_004_000,
  }));

  const zeroX25519Bundle = exportPublicKeyBundle({
    suite: CRYPTO_SUITES.CLASSICAL_V1,
    keyId: await computeClassicalKeyId(new Uint8Array(32)),
    x25519PublicKey: new Uint8Array(32),
  });
  await expectReject('all-zero X25519 shared secret', () => encryptText('zero', zeroX25519Bundle));

  const hybridAsClassicalBundle = exportPublicKeyBundle({
    suite: CRYPTO_SUITES.CLASSICAL_V1,
    keyId: await computeClassicalKeyId(bobHybrid.x25519PublicKey),
    x25519PublicKey: bobHybrid.x25519PublicKey,
  });
  const downgradeEnvelope = await encryptText('downgrade attempt', hybridAsClassicalBundle);
  await expectReject('classical-v1 downgrade into hybrid key pair', () => decryptText(downgradeEnvelope, bobHybrid));

  const classicalWithKem = structuredClone(classicalEnvelope);
  classicalWithKem.kem.mlKem768Ciphertext = hybridEnvelope.kem.mlKem768Ciphertext;
  await expectReject('classical-v1 envelope carrying ML-KEM fields', () => decryptText(classicalWithKem, bobClassical));

  try {
    await decryptText(tampered, bobHybrid);
  } catch {
    // Already counted above; this keeps the old return shape meaningful.
  }

  return {
    classical: {
      suite: classicalEnvelope.suite,
      contractSuite: classicalEnvelope.contractSuite,
      x25519PublicKeyBytes: X25519_PUBLIC_KEY_BYTES,
      ciphertextBytes: base64urlDecode(classicalEnvelope.ciphertext).length,
    },
    hybrid: {
      suite: hybridEnvelope.suite,
      contractSuite: hybridEnvelope.contractSuite,
      x25519PublicKeyBytes: X25519_PUBLIC_KEY_BYTES,
      mlKem768PublicKeyBytes: bobHybrid.mlKem768PublicKey.length,
      mlKem768CiphertextBytes: base64urlDecode(hybridEnvelope.kem.mlKem768Ciphertext).length,
      ciphertextBytes: base64urlDecode(hybridEnvelope.ciphertext).length,
      aadTamperRejected: true,
      negativeChecksPassed: tamperChecks,
    },
    identity: {
      signedBundleVerified: true,
      signingPublicKeyBytes: verifiedBundle.signingPublicKey.length,
      vaultDraftSuiteMask: Number(vaultDraft.message.crypto_suite_mask),
      vaultDraftPqKeyBytes: Number(vaultDraft.message.pq_kem_pubkey_len),
      tonProofVerified: true,
      tonProofDomain: verifiedWalletProof.domain,
      walletProofVerified: true,
      walletPublicKeyBytes: verifiedWalletProof.walletPublicKey.length,
      walletPublicKeySource: verifiedWalletProof.walletPublicKeySource,
      userFriendlyAddressAccepted: true,
      vaultRecordBound: vaultRecordBinding.active,
    },
    capsule: {
      opened: true,
      idBytes: base64urlDecode(capsule.id).length,
      replayRejected: true,
      sizeClass: openedCapsule.publish.size_class,
      cryptoSuite: openedCapsule.publish.crypto_suite,
      header0Hash: openedCapsule.publish.header_0_hash,
      header1Hash: openedCapsule.publish.header_1_hash,
      bodyHash: openedCapsule.publish.body_hash,
    },
  };
}
