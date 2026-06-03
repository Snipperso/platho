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
  KIB_1: 1,
  KIB_2: 2,
  KIB_4: 4,
  KIB_8: 8,
  KIB_16: 16,
  KIB_32: 32,
  STANDARD: 1,
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
export const PLATHO_COMPACT_BODY_LAYOUT = 'platho.byte-layout.v1';
export const PLATHO_COMPACT_TEXT_BLOCK_BYTES = 1024;
export const PLATHO_COMPACT_MAX_CHUNKS = 1;
export const PLATHO_CAPSULE_USEFUL_SIZE_CLASSES = Object.freeze([1024, 2048, 4096, 8192, 16384, 32768]);
export const PLATHO_ONCHAIN_CELL_LAYOUT = 'ton-snake-byte-cell.v1';
export const PLATHO_ONCHAIN_CELL_DATA_BYTES = 127;
export const PLATHO_ONCHAIN_HEADER_MAX_BYTES = 4096;
export const PLATHO_ONCHAIN_BODY_MAX_BYTES = 40 * 1024;
export const PLATHO_BINARY_HEADER0_BYTES = 140;
export const PLATHO_BINARY_HEADER1_BYTES = 30;
export const PLATHO_COMPACT_PAYLOAD_PREFIX_BYTES = 32;
export const PLATHO_COMPACT_SENDER_WALLET_METADATA_BYTES = 69;
export const PLATHO_COMPACT_CONTENT_TYPES = Object.freeze({
  TEXT: 1,
  IMAGE: 2,
  PAYMENT: 3,
});
export const PLATHO_COMPACT_IMAGE_FORMATS = Object.freeze({
  WEBP: 1,
  AVIF: 2,
  JPEG: 3,
  PNG: 4,
});

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const PROTOCOL_VERSION = 1;
const KEY_ID_CLASSICAL_DOMAIN = 'PLATHO.KEYID.CLASSICAL.V1';
const KEY_ID_HYBRID_DOMAIN = 'PLATHO.KEYID.HYBRID.V1';
const MESSAGE_KEY_DOMAIN = 'PLATHO.MESSAGE.KEY.V1';
const MESSAGE_SALT_DOMAIN = 'PLATHO.MESSAGE.SALT.V1';
const SIGNED_BUNDLE_DOMAIN = 'PLATHO.MESSAGING.KEY_BUNDLE.SIGNATURE.V1';
const WALLET_BUNDLE_HASH_DOMAIN = 'PLATHO.WALLET.KEY_BUNDLE.HASH.V1';
const PRIVATE_CAPSULE_HEADER0_DOMAIN = 'PLATHO.PRIVATE_CAPSULE.HEADER0.V1';
const PRIVATE_CAPSULE_HEADER1_DOMAIN = 'PLATHO.PRIVATE_CAPSULE.HEADER1.V1';
const PRIVATE_CAPSULE_BODY_DOMAIN = 'PLATHO.PRIVATE_CAPSULE.BODY.V1';
const PRIVATE_CAPSULE_ID_DOMAIN = 'PLATHO.PRIVATE_CAPSULE.ID.V1';
const PRIVATE_CAPSULE_SIGNATURE_DOMAIN = 'PLATHO.PRIVATE_CAPSULE.SIGNATURE.V1';
const DEFAULT_CAPSULE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CAPSULE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_CLOCK_SKEW_MS = 5 * 60 * 1000;
const COMPACT_BODY_MAGIC = new Uint8Array([0x50, 0x4c, 0x42, 0x31]); // "PLB1"
const COMPACT_CHUNK_MAGIC = new Uint8Array([0x50, 0x4c, 0x43, 0x31]); // "PLC1"
const COMPACT_PAYLOAD_MAGIC = new Uint8Array([0x50, 0x43, 0x50, 0x31]); // "PCP1"
const COMPACT_SENDER_WALLET_MAGIC = new Uint8Array([0x50, 0x53, 0x57, 0x31]); // "PSW1"
const COMPACT_PAYLOAD_FLAG_SENDER_WALLET = 1;
const PRIVATE_CAPSULE_HEADER0_MAGIC = new Uint8Array([0x50, 0x48, 0x30, 0x42]); // "PH0B"
const PRIVATE_CAPSULE_HEADER1_MAGIC = new Uint8Array([0x50, 0x48, 0x31, 0x42]); // "PH1B"
const COMPACT_BODY_AAD_DOMAIN = 'PLATHO.COMPACT_BODY.AAD.V1';
const COMPACT_STANDARD_CHUNK_WIRE_BYTES = 2048;
const COMPACT_HYBRID_CHUNK_WIRE_BYTES = 4096;
const COMPACT_CHUNK_HEADER_BYTES = 24;
const COMPACT_BODY_BASE_PREFIX_BYTES = 68;
const COMPACT_BODY_TAG_BYTES = 16;
const COMPACT_IMAGE_CONTENT_HEADER_BYTES = 0;
const COMPACT_PAYMENT_CONTENT_BYTES = 82;
const ZERO_32_BYTES = new Uint8Array(32);

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

function bytesEqual(left, right) {
  const a = toUint8Array(left);
  const b = toUint8Array(right);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
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

function minimalUintByteLength(value) {
  const current = BigInt(value);
  if (current < 0n) throw new Error('Cannot encode a negative integer');
  let bytes = 1;
  while (current >= (1n << BigInt(bytes * 8))) bytes += 1;
  return bytes;
}

function createByteCell(data, refs = []) {
  const bytes = toUint8Array(data);
  if (bytes.length > PLATHO_ONCHAIN_CELL_DATA_BYTES) {
    throw new Error(`TON cell data exceeds ${PLATHO_ONCHAIN_CELL_DATA_BYTES} bytes`);
  }
  if (!Array.isArray(refs) || refs.length > 4) {
    throw new Error('TON cell can have at most 4 refs');
  }
  return { data: bytes, refs };
}

function splitSnakeCellChunks(bytesLike) {
  const bytes = toUint8Array(bytesLike);
  if (bytes.length === 0) return [new Uint8Array()];
  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += PLATHO_ONCHAIN_CELL_DATA_BYTES) {
    chunks.push(bytes.subarray(offset, offset + PLATHO_ONCHAIN_CELL_DATA_BYTES));
  }
  return chunks;
}

function buildSnakeCell(bytesLike) {
  const chunks = splitSnakeCellChunks(bytesLike);
  let root = null;
  for (let i = chunks.length - 1; i >= 0; i -= 1) {
    root = createByteCell(chunks[i], root ? [root] : []);
  }
  return { root, chunks };
}

function flattenCellTree(root) {
  const cells = [];
  const indexes = new WeakMap();
  const visit = (cell) => {
    if (indexes.has(cell)) return;
    indexes.set(cell, cells.length);
    cells.push(cell);
    for (const ref of cell.refs) visit(ref);
  };
  visit(root);
  return { cells, indexes };
}

function cellDescriptorBytes(cell) {
  if (cell.refs.length > 4) throw new Error('TON cell can have at most 4 refs');
  if (cell.data.length > PLATHO_ONCHAIN_CELL_DATA_BYTES) {
    throw new Error(`TON cell data exceeds ${PLATHO_ONCHAIN_CELL_DATA_BYTES} bytes`);
  }
  return new Uint8Array([cell.refs.length, cell.data.length * 2]);
}

function serializeCellForBoc(cell, indexes, sizeBytes) {
  const refIndexes = cell.refs.map((ref) => writeBigUintBytes(indexes.get(ref), sizeBytes, 'cell ref index'));
  return concatBytes(cellDescriptorBytes(cell), cell.data, ...refIndexes);
}

function serializeBoc(root) {
  const { cells, indexes } = flattenCellTree(root);
  const sizeBytes = minimalUintByteLength(cells.length);
  const cellPayloads = cells.map((cell) => serializeCellForBoc(cell, indexes, sizeBytes));
  const totalCellsSize = cellPayloads.reduce((sum, payload) => sum + payload.length, 0);
  const offsetBytes = minimalUintByteLength(totalCellsSize);
  return concatBytes(
    new Uint8Array([0xb5, 0xee, 0x9c, 0x72]),
    new Uint8Array([sizeBytes, offsetBytes]),
    writeBigUintBytes(cells.length, sizeBytes, 'BOC cells count'),
    writeBigUintBytes(1, sizeBytes, 'BOC roots count'),
    writeBigUintBytes(0, sizeBytes, 'BOC absent count'),
    writeBigUintBytes(totalCellsSize, offsetBytes, 'BOC total cells size'),
    writeBigUintBytes(0, sizeBytes, 'BOC root index'),
    ...cellPayloads,
  );
}

function readBocUint(bytes, cursor, byteLength, name) {
  if (cursor.offset + byteLength > bytes.length) throw new Error(`${name} is truncated`);
  const value = readBigUintBytes(bytes, cursor.offset, byteLength, name);
  cursor.offset += byteLength;
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${name} is too large`);
  return Number(value);
}

function parseOrdinaryByteCellBoc(bocLike, name = 'TON cell BOC') {
  const bytes = typeof bocLike === 'string' ? base64Decode(bocLike) : toUint8Array(bocLike);
  if (bytes.length < 8) throw new Error(`${name} is truncated`);
  if (bytes[0] !== 0xb5 || bytes[1] !== 0xee || bytes[2] !== 0x9c || bytes[3] !== 0x72) {
    throw new Error(`${name} has invalid magic`);
  }
  const cursor = { offset: 4 };
  const flagsByte = bytes[cursor.offset];
  cursor.offset += 1;
  const hasIndex = (flagsByte & 0x80) !== 0;
  const hasCrc32c = (flagsByte & 0x40) !== 0;
  const hasCacheBits = (flagsByte & 0x20) !== 0;
  const bocFlags = (flagsByte >> 3) & 0x03;
  const sizeBytes = flagsByte & 0x07;
  if (hasCacheBits || bocFlags !== 0 || sizeBytes <= 0 || sizeBytes > 4) {
    throw new Error(`${name} uses unsupported BOC flags`);
  }
  const offsetBytes = bytes[cursor.offset];
  cursor.offset += 1;
  if (offsetBytes <= 0 || offsetBytes > 4) throw new Error(`${name} has invalid offset size`);
  const cellsCount = readBocUint(bytes, cursor, sizeBytes, `${name} cells count`);
  const rootsCount = readBocUint(bytes, cursor, sizeBytes, `${name} roots count`);
  const absentCount = readBocUint(bytes, cursor, sizeBytes, `${name} absent count`);
  const totalCellsSize = readBocUint(bytes, cursor, offsetBytes, `${name} cells size`);
  if (cellsCount <= 0 || rootsCount !== 1 || absentCount !== 0) {
    throw new Error(`${name} must contain one ordinary root`);
  }
  const rootIndex = readBocUint(bytes, cursor, sizeBytes, `${name} root index`);
  if (rootIndex < 0 || rootIndex >= cellsCount) throw new Error(`${name} root index is out of range`);
  if (hasIndex) {
    const indexBytes = cellsCount * offsetBytes;
    if (cursor.offset + indexBytes > bytes.length) throw new Error(`${name} BOC index table is truncated`);
    cursor.offset += indexBytes;
  }
  const cellsEnd = cursor.offset + totalCellsSize;
  const trailerBytes = hasCrc32c ? 4 : 0;
  if (cellsEnd + trailerBytes > bytes.length) throw new Error(`${name} cell payload is truncated`);

  const parsed = [];
  for (let i = 0; i < cellsCount; i += 1) {
    if (cursor.offset + 2 > cellsEnd) throw new Error(`${name} cell descriptor is truncated`);
    const d1 = bytes[cursor.offset];
    const d2 = bytes[cursor.offset + 1];
    cursor.offset += 2;
    const refsCount = d1 & 0x07;
    const exotic = (d1 & 0x08) !== 0;
    const levelMask = d1 & 0xe0;
    if (exotic || levelMask !== 0 || refsCount > 4) throw new Error(`${name} contains unsupported cell type`);
    if (d2 % 2 !== 0) throw new Error(`${name} contains non-byte-aligned cell data`);
    const dataBytes = d2 / 2;
    if (cursor.offset + dataBytes + (refsCount * sizeBytes) > cellsEnd) {
      throw new Error(`${name} cell payload is truncated`);
    }
    const data = bytes.slice(cursor.offset, cursor.offset + dataBytes);
    cursor.offset += dataBytes;
    const refIndexes = [];
    for (let ref = 0; ref < refsCount; ref += 1) {
      refIndexes.push(readBocUint(bytes, cursor, sizeBytes, `${name} cell ref`));
    }
    parsed.push({ data, refIndexes });
  }
  if (cursor.offset !== cellsEnd) throw new Error(`${name} has trailing cell bytes`);
  if (bytes.length !== cellsEnd + trailerBytes) throw new Error(`${name} has trailing bytes`);

  const built = parsed.map((cell) => ({ data: cell.data, refs: [] }));
  for (let i = 0; i < parsed.length; i += 1) {
    built[i].refs = parsed[i].refIndexes.map((refIndex) => {
      if (refIndex <= i || refIndex >= built.length) {
        throw new Error(`${name} has invalid cell ref order`);
      }
      return built[refIndex];
    });
  }
  return built[rootIndex];
}

function snakeBytesFromBoc(bocLike, name) {
  let cell = parseOrdinaryByteCellBoc(bocLike, name);
  const chunks = [];
  let guard = 0;
  while (cell) {
    if (cell.data.length > PLATHO_ONCHAIN_CELL_DATA_BYTES) {
      throw new Error(`${name} cell exceeds Platho byte-cell limit`);
    }
    if (!Array.isArray(cell.refs) || cell.refs.length > 1) {
      throw new Error(`${name} is not a Platho snake byte cell`);
    }
    chunks.push(cell.data);
    cell = cell.refs[0] ?? null;
    guard += 1;
    if (guard > 1024) throw new Error(`${name} snake cell is too deep`);
  }
  return concatBytes(...chunks);
}

async function computeTonCellHashAndDepth(cell, cache = new WeakMap()) {
  const cached = cache.get(cell);
  if (cached) return cached;
  const refs = [];
  for (const ref of cell.refs) refs.push(await computeTonCellHashAndDepth(ref, cache));
  const depth = refs.length === 0 ? 0 : Math.max(...refs.map((ref) => ref.depth)) + 1;
  const repr = concatBytes(
    cellDescriptorBytes(cell),
    cell.data,
    ...refs.map((ref) => uint16Bytes(ref.depth, 'cell depth')),
    ...refs.map((ref) => ref.hash),
  );
  const result = { hash: await sha256(repr), depth };
  cache.set(cell, result);
  return result;
}

async function createSnakeCellPayload(name, bytesLike, maxBytes) {
  const bytes = toUint8Array(bytesLike);
  if (bytes.length > maxBytes) {
    throw new Error(`${name} exceeds on-chain payload cap: ${bytes.length} > ${maxBytes}`);
  }
  const { root, chunks } = buildSnakeCell(bytes);
  const { cells } = flattenCellTree(root);
  const { hash } = await computeTonCellHashAndDepth(root);
  return {
    layout: PLATHO_ONCHAIN_CELL_LAYOUT,
    bytes: bytes.length,
    bits: bytes.length * 8,
    cells: cells.length,
    refs: Math.max(0, cells.length - 1),
    hash: bigintHex256(bytesToBigInt(hash)),
    boc: base64Encode(serializeBoc(root)),
    chunks: chunks.map((chunk) => base64urlEncode(chunk)),
  };
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

function uint16Bytes(value, name = 'uint16') {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new Error(`${name} must be a uint16`);
  }
  return new Uint8Array([(value >> 8) & 0xff, value & 0xff]);
}

function uint8Byte(value, name = 'uint8') {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new Error(`${name} must be a uint8`);
  }
  return value;
}

function readUint16(bytes, offset, name = 'uint16') {
  if (offset + 2 > bytes.length) throw new Error(`${name} is truncated`);
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function uint32Bytes(value, name = 'uint32') {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`${name} must be an unsigned 32-bit integer`);
  }
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, false);
  return out;
}

function readUint32(bytes, offset, name = 'uint32') {
  if (offset + 4 > bytes.length) throw new Error(`${name} is truncated`);
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, false);
}

function uint64Bytes(value, name = 'uint64') {
  const integer = typeof value === 'bigint' ? value : BigInt(value);
  if (integer < 0n || integer > 0xffffffffffffffffn) {
    throw new Error(`${name} must be an unsigned 64-bit integer`);
  }
  return writeBigUintBytes(integer, 8, name);
}

function writeBigUintBytes(value, byteLength, name) {
  let current;
  try {
    current = BigInt(value);
  } catch {
    throw new Error(`${name} must be an unsigned integer`);
  }
  if (current < 0n) throw new Error(`${name} must be an unsigned integer`);
  const limit = 1n << BigInt(byteLength * 8);
  if (current >= limit) throw new Error(`${name} does not fit into ${byteLength} bytes`);
  const out = new Uint8Array(byteLength);
  for (let i = byteLength - 1; i >= 0; i -= 1) {
    out[i] = Number(current & 0xffn);
    current >>= 8n;
  }
  return out;
}

function readBigUintBytes(bytes, offset, byteLength, name) {
  if (offset + byteLength > bytes.length) throw new Error(`${name} is truncated`);
  let value = 0n;
  for (let i = 0; i < byteLength; i += 1) value = (value << 8n) | BigInt(bytes[offset + i]);
  return value;
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

function optionalRecordField(record, ...names) {
  for (const name of names) {
    if (record && Object.hasOwn(record, name)) return record[name];
  }
  return undefined;
}

function recordPqKemPubkeyBytes(record, expectedLen) {
  const value = optionalRecordField(
    record,
    'pq_kem_pubkey',
    'pqKemPubkey',
    'pq_kem_pubkey_bytes',
    'pqKemPubkeyBytes',
  );
  if (expectedLen === 0) {
    if (value === undefined || value === null) return new Uint8Array();
    if (value instanceof Uint8Array || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
      const bytes = toUint8Array(value, 'pq_kem_pubkey');
      if (bytes.length === 0) return bytes;
    }
    if (typeof value === 'string' && value.length === 0) return new Uint8Array();
    throw new Error('Vault key record pq_kem_pubkey must be empty for classical-v1');
  }
  if (value === undefined || value === null) {
    throw new Error('Vault key record missing pq_kem_pubkey');
  }
  if (value instanceof Uint8Array || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return assertBytes('Vault key record pq_kem_pubkey', value, expectedLen);
  }
  if (typeof value === 'string') {
    return assertBytes('Vault key record pq_kem_pubkey', base64urlDecode(value), expectedLen);
  }
  throw new Error('Vault key record pq_kem_pubkey must be bytes');
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

function normalizeCapsuleSizeClass(value = CAPSULE_SIZE_CLASS.KIB_1) {
  const numberValue = Number(value);
  if (!Number.isSafeInteger(numberValue)) throw new Error('Private capsule size class must be a safe integer');
  if (!Object.values(CAPSULE_SIZE_CLASS).includes(numberValue)) {
    throw new Error('Unsupported private capsule size class');
  }
  return numberValue;
}

export function usefulBytesForCapsuleSizeClass(sizeClass = CAPSULE_SIZE_CLASS.KIB_1) {
  const normalized = normalizeCapsuleSizeClass(sizeClass);
  return normalized * PLATHO_COMPACT_TEXT_BLOCK_BYTES;
}

export function sizeClassForPayloadByteLength(byteLength) {
  const length = safeInteger(byteLength, 'payload byte length');
  if (length < 0) throw new Error('payload byte length must be non-negative');
  for (const usefulBytes of PLATHO_CAPSULE_USEFUL_SIZE_CLASSES) {
    if (length <= usefulBytes) return usefulBytes / PLATHO_COMPACT_TEXT_BLOCK_BYTES;
  }
  throw new Error(`Compact payload exceeds largest capsule size: ${length} > ${PLATHO_CAPSULE_USEFUL_SIZE_CLASSES[PLATHO_CAPSULE_USEFUL_SIZE_CLASSES.length - 1]}`);
}

function assertSupportedPrivateSuite(suite) {
  if (suite === CRYPTO_SUITES.CLASSICAL_V1 || suite === CRYPTO_SUITES.HYBRID_V1) return suite;
  throw new Error(`Unsupported Platho capsule suite: ${suite}`);
}

function assertAllowedPrivateCapsulePair(sizeClass, cryptoSuite) {
  const validSize = Object.values(CAPSULE_SIZE_CLASS).includes(Number(sizeClass));
  const validSuite = cryptoSuite === CONTRACT_CRYPTO_SUITE.HYBRID;
  if (!validSize || !validSuite) {
    throw new Error('Private capsule size class and crypto suite do not match CapsuleHub rules');
  }
}

function suiteByteForSuite(suite) {
  if (suite === CRYPTO_SUITES.CLASSICAL_V1) return CONTRACT_CRYPTO_SUITE.CLASSICAL;
  if (suite === CRYPTO_SUITES.HYBRID_V1) return CONTRACT_CRYPTO_SUITE.HYBRID;
  throw new Error(`Unsupported Platho compact suite: ${suite}`);
}

function suiteForByte(byte) {
  if (byte === CONTRACT_CRYPTO_SUITE.CLASSICAL) return CRYPTO_SUITES.CLASSICAL_V1;
  if (byte === CONTRACT_CRYPTO_SUITE.HYBRID) return CRYPTO_SUITES.HYBRID_V1;
  throw new Error('Unsupported Platho compact suite byte');
}

function compactMaxChunkWireBytesForSuite(suite) {
  if (suite === CRYPTO_SUITES.CLASSICAL_V1) return COMPACT_STANDARD_CHUNK_WIRE_BYTES;
  if (suite === CRYPTO_SUITES.HYBRID_V1) return COMPACT_HYBRID_CHUNK_WIRE_BYTES;
  throw new Error(`Unsupported Platho compact suite: ${suite}`);
}

function compactBodyPrefixBytesForSuite(suite) {
  return COMPACT_BODY_BASE_PREFIX_BYTES + (suite === CRYPTO_SUITES.HYBRID_V1 ? MLKEM768_CIPHERTEXT_BYTES : 0);
}

function compactBodyBytesForUsefulBytes(suite, usefulBytes) {
  return compactBodyPrefixBytesForSuite(suite)
    + PLATHO_COMPACT_PAYLOAD_PREFIX_BYTES
    + usefulBytes
    + COMPACT_BODY_TAG_BYTES;
}

function compactBodyBytesForPayloadBlocks(suite, blocks) {
  return compactBodyBytesForUsefulBytes(suite, blocks * PLATHO_COMPACT_TEXT_BLOCK_BYTES);
}

export function getCompactCapsuleCapacity(suite, options = {}) {
  assertSupportedPrivateSuite(suite);
  const sizeClass = normalizeCapsuleSizeClass(options.sizeClass ?? options.size_class ?? CAPSULE_SIZE_CLASS.KIB_1);
  const maxChunks = usefulBytesForCapsuleSizeClass(sizeClass) / PLATHO_COMPACT_TEXT_BLOCK_BYTES;
  const maxChunkWireBytes = compactMaxChunkWireBytesForSuite(suite);
  const onChainBodyCapBytes = options.maxOnChainBodyBytes ?? PLATHO_ONCHAIN_BODY_MAX_BYTES;
  const maxUsefulPayloadBytes = usefulBytesForCapsuleSizeClass(sizeClass);
  const maxEncryptedPayloadBytes = PLATHO_COMPACT_PAYLOAD_PREFIX_BYTES + maxUsefulPayloadBytes;
  const maxBodyBytes = compactBodyBytesForUsefulBytes(suite, maxUsefulPayloadBytes);
  if (maxBodyBytes > onChainBodyCapBytes) {
    throw new Error('Compact capsule capacity exceeds on-chain body cap');
  }
  return {
    suite,
    sizeClass,
    maxChunks,
    maxChunkWireBytes,
    chunkHeaderBytes: COMPACT_CHUNK_HEADER_BYTES,
    onChainBodyCapBytes,
    payloadBlockBytes: PLATHO_COMPACT_TEXT_BLOCK_BYTES,
    payloadPrefixBytes: PLATHO_COMPACT_PAYLOAD_PREFIX_BYTES,
    oneChunkPlaintextBytes: PLATHO_COMPACT_PAYLOAD_PREFIX_BYTES + PLATHO_COMPACT_TEXT_BLOCK_BYTES,
    oneChunkBodyBytes: compactBodyBytesForPayloadBlocks(suite, 1),
    maxBodyBytes,
    maxEncryptedPayloadBytes,
    maxUsefulPayloadBytes,
    maxTextBytes: maxUsefulPayloadBytes,
    maxImageBytes: maxUsefulPayloadBytes - COMPACT_IMAGE_CONTENT_HEADER_BYTES,
    maxPaymentBytes: COMPACT_PAYMENT_CONTENT_BYTES,
  };
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

function normalizeRequestedSuite(value) {
  if (value === undefined || value === null) return null;
  if (value === CRYPTO_SUITES.CLASSICAL_V1 || value === CRYPTO_SUITES.HYBRID_V1) return value;
  throw new Error(`Unsupported requested Platho crypto suite: ${value}`);
}

async function recipientKeyIdForSuite(recipientKeyPair, suite) {
  if (recipientKeyPair.suite === suite) return recipientKeyPair.keyId;
  if (recipientKeyPair.suite === CRYPTO_SUITES.HYBRID_V1 && suite === CRYPTO_SUITES.CLASSICAL_V1) {
    return computeClassicalKeyId(assertBytes('recipient.x25519PublicKey', recipientKeyPair.x25519PublicKey, X25519_PUBLIC_KEY_BYTES));
  }
  throw new Error(`Recipient key suite ${recipientKeyPair.suite} cannot decrypt ${suite}`);
}

async function assertEnvelopeMatchesRecipient(envelope, recipientKeyPair) {
  if (!envelope || envelope.version !== PROTOCOL_VERSION) throw new Error('Invalid Platho envelope');
  const config = suiteConfig(envelope.suite);
  if (envelope.contractSuite !== config.contractSuite) {
    throw new Error(`Envelope contract suite does not match ${envelope.suite}`);
  }
  assertCanonicalAlg(envelope.suite, envelope.alg);
  assertBytes('envelope.nonce', base64urlDecode(envelope.nonce), AES_GCM_NONCE_BYTES);

  const expectedRecipientKeyId = await recipientKeyIdForSuite(recipientKeyPair, envelope.suite);
  if (expectedRecipientKeyId && envelope.recipientKeyId !== expectedRecipientKeyId) {
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
  return deriveAesGcmKeyFromTranscriptHash(sharedParts, transcriptHash);
}

async function deriveAesGcmKeyFromTranscriptHash(sharedParts, transcriptHash) {
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

function assertCompactMagic(bytes, offset, magic, name) {
  if (offset + magic.length > bytes.length || !bytesEqual(bytes.subarray(offset, offset + magic.length), magic)) {
    throw new Error(`Invalid Platho compact ${name} magic`);
  }
}

function compactHashBytes(hashHex, name) {
  return hexToBytes(assertHashHex(name, hashHex), 32, name);
}

function compactPayloadUsefulBytes(contentLength, options = {}) {
  if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
    throw new Error('Compact payload content length is invalid');
  }
  const requestedSizeClass = options.sizeClass ?? options.size_class;
  const sizeClass = requestedSizeClass === undefined
    ? sizeClassForPayloadByteLength(contentLength)
    : normalizeCapsuleSizeClass(requestedSizeClass);
  const usefulBytes = usefulBytesForCapsuleSizeClass(sizeClass);
  if (contentLength > usefulBytes) {
    throw new Error(`Compact payload exceeds selected capsule size: ${contentLength} > ${usefulBytes}`);
  }
  return { sizeClass, usefulBytes, blocks: usefulBytes / PLATHO_COMPACT_TEXT_BLOCK_BYTES };
}

function encodeFixedCompactPayload(type, flags, content, options = {}) {
  const contentBytes = toUint8Array(content);
  const { usefulBytes } = compactPayloadUsefulBytes(contentBytes.length, options);
  const out = new Uint8Array(PLATHO_COMPACT_PAYLOAD_PREFIX_BYTES + usefulBytes);
  const streamId = options.streamId
    ? assertBytes('compact payload stream id', options.streamId, 16)
    : randomBytes(16);
  out.set(COMPACT_PAYLOAD_MAGIC, 0);
  out[4] = PROTOCOL_VERSION;
  out[5] = uint8Byte(type, 'compact payload type');
  out[6] = uint8Byte(flags, 'compact payload flags');
  out[7] = uint8Byte(options.mediaFormat ?? 0, 'compact payload media format');
  out.set(streamId, 8);
  out.set(uint16Bytes(options.partIndex ?? 0, 'compact payload part index'), 24);
  out.set(uint16Bytes(options.partCount ?? 1, 'compact payload part count'), 26);
  out.set(uint16Bytes(contentBytes.length, 'compact payload content length'), 28);
  out.set(contentBytes, PLATHO_COMPACT_PAYLOAD_PREFIX_BYTES);
  return out;
}

function compactSenderWalletMetadataBytes(options = {}) {
  const wallet = options.senderWallet ?? options.sender_wallet;
  if (wallet === undefined || wallet === null || wallet === '') return null;
  const parsed = parseTonAddress(wallet);
  if (parsed.workchain < -128 || parsed.workchain > 127) {
    throw new Error('sender wallet workchain must fit int8');
  }
  const vaultKeyId = options.senderVaultKeyId ?? options.sender_vault_key_id ?? 0n;
  return concatBytes(
    COMPACT_SENDER_WALLET_MAGIC,
    new Uint8Array([parsed.workchain & 0xff]),
    assertBytes('sender wallet hash', parsed.hash, 32),
    writeBigUintBytes(vaultKeyId, 32, 'senderVaultKeyId'),
  );
}

function encodeCompactPayloadContentWithMetadata(content, options = {}) {
  const walletMetadata = compactSenderWalletMetadataBytes(options);
  if (!walletMetadata) return { flags: 0, content: toUint8Array(content) };
  return {
    flags: COMPACT_PAYLOAD_FLAG_SENDER_WALLET,
    content: concatBytes(walletMetadata, toUint8Array(content)),
  };
}

function decodeCompactPayloadMetadata(content, flags) {
  const unsupportedFlags = flags & ~COMPACT_PAYLOAD_FLAG_SENDER_WALLET;
  if (unsupportedFlags !== 0) throw new Error('Unsupported compact payload flags');
  let remaining = toUint8Array(content);
  const metadata = {};
  if ((flags & COMPACT_PAYLOAD_FLAG_SENDER_WALLET) !== 0) {
    if (remaining.length < PLATHO_COMPACT_SENDER_WALLET_METADATA_BYTES) {
      throw new Error('Compact payload sender wallet metadata is truncated');
    }
    const prefix = remaining.subarray(0, PLATHO_COMPACT_SENDER_WALLET_METADATA_BYTES);
    if (!bytesEqual(prefix.subarray(0, 4), COMPACT_SENDER_WALLET_MAGIC)) {
      throw new Error('Compact payload sender wallet metadata magic mismatch');
    }
    const rawWorkchain = prefix[4] >= 0x80 ? prefix[4] - 0x100 : prefix[4];
    const senderWallet = `${rawWorkchain}:${bytesToHex(prefix.subarray(5, 37))}`;
    const senderVaultKeyIdBigint = bytesToBigInt(prefix.subarray(37, 69));
    metadata.senderWallet = senderWallet;
    metadata.sender_wallet = senderWallet;
    if (senderVaultKeyIdBigint !== 0n) {
      const senderVaultKeyId = senderVaultKeyIdBigint.toString();
      metadata.senderVaultKeyId = senderVaultKeyId;
      metadata.sender_vault_key_id = senderVaultKeyId;
    }
    remaining = remaining.subarray(PLATHO_COMPACT_SENDER_WALLET_METADATA_BYTES);
  }
  return { content: remaining, metadata };
}

function compactPayloadContent(bytesLike) {
  const bytes = toUint8Array(bytesLike);
  const usefulBytes = bytes.length - PLATHO_COMPACT_PAYLOAD_PREFIX_BYTES;
  if (!PLATHO_CAPSULE_USEFUL_SIZE_CLASSES.includes(usefulBytes)) {
    throw new Error('Compact payload must use a supported useful slot size');
  }
  assertCompactMagic(bytes, 0, COMPACT_PAYLOAD_MAGIC, 'payload');
  if (bytes[4] !== PROTOCOL_VERSION) throw new Error('Unsupported compact payload version');
  const type = bytes[5];
  const flags = bytes[6];
  const mediaFormat = bytes[7];
  const streamId = bytes.subarray(8, 24);
  const partIndex = readUint16(bytes, 24, 'compact payload part index');
  const partCount = readUint16(bytes, 26, 'compact payload part count');
  const contentLength = readUint16(bytes, 28, 'compact payload content length');
  if (partCount <= 0 || partIndex >= partCount) throw new Error('Compact payload part index mismatch');
  if (bytes[30] !== 0 || bytes[31] !== 0) throw new Error('Compact payload reserved bytes must be zero');
  const blocks = usefulBytes / PLATHO_COMPACT_TEXT_BLOCK_BYTES;
  const sizeClass = usefulBytes / PLATHO_COMPACT_TEXT_BLOCK_BYTES;
  const contentStart = PLATHO_COMPACT_PAYLOAD_PREFIX_BYTES;
  const contentEnd = contentStart + contentLength;
  if (contentEnd > bytes.length) throw new Error('Compact payload content is truncated');
  for (let i = contentEnd; i < bytes.length; i += 1) {
    if (bytes[i] !== 0) throw new Error('Compact payload padding must be zero');
  }
  return {
    type,
    flags,
    mediaFormat,
    streamId,
    partIndex,
    partCount,
    content: bytes.subarray(contentStart, contentEnd),
    sizeClass,
    usefulBytes,
    blocks,
  };
}

function assertCompactPayloadBytes(bytesLike, options = {}) {
  const bytes = toUint8Array(bytesLike);
  const payload = compactPayloadContent(bytes);
  const requestedSizeClass = options.sizeClass ?? options.size_class;
  if (requestedSizeClass !== undefined && payload.sizeClass !== normalizeCapsuleSizeClass(requestedSizeClass)) {
    throw new Error('Compact payload size class mismatch');
  }
  return bytes;
}

export function encodeCompactPayload(input, options = {}) {
  const payload = typeof input === 'string' ? { type: 'text', text: input } : (input ?? {});
  const payloadOptions = { ...payload, ...options };
  if (payload.type === 'text' || payload.type === PLATHO_COMPACT_CONTENT_TYPES.TEXT) {
    const encoded = encodeCompactPayloadContentWithMetadata(utf8(payload.text ?? ''), payloadOptions);
    return encodeFixedCompactPayload(PLATHO_COMPACT_CONTENT_TYPES.TEXT, encoded.flags, encoded.content, payloadOptions);
  }
  if (payload.type === 'image' || payload.type === PLATHO_COMPACT_CONTENT_TYPES.IMAGE) {
    const bytes = toUint8Array(payload.bytes ?? payload.imageBytes ?? new Uint8Array());
    const encoded = encodeCompactPayloadContentWithMetadata(bytes, payloadOptions);
    return encodeFixedCompactPayload(PLATHO_COMPACT_CONTENT_TYPES.IMAGE, encoded.flags, encoded.content, {
      ...payloadOptions,
      mediaFormat: payload.format ?? PLATHO_COMPACT_IMAGE_FORMATS.WEBP,
    });
  }
  if (payload.type === 'payment' || payload.type === PLATHO_COMPACT_CONTENT_TYPES.PAYMENT) {
    const content = encodeCompactPayloadContentWithMetadata(concatBytes(
      new Uint8Array([uint8Byte(payload.asset ?? 0, 'payment asset'), 0]),
      writeBigUintBytes(payload.amount ?? 0n, 16, 'payment amount'),
      assertBytes('payment intent id', payload.intentId ?? payload.intent_id, 32),
      assertBytes('payment secret', payload.secret ?? payload.secret32, 32),
    ), payloadOptions);
    return encodeFixedCompactPayload(PLATHO_COMPACT_CONTENT_TYPES.PAYMENT, content.flags, content.content, payloadOptions);
  }
  throw new Error('Unsupported Platho compact payload type');
}

export function decodeCompactPayload(bytesLike) {
  const {
    type,
    flags,
    content,
    mediaFormat,
    streamId,
    partIndex,
    partCount,
  } = compactPayloadContent(bytesLike);
  const decoded = decodeCompactPayloadMetadata(content, flags);
  const part = {
    streamId,
    stream_id: `0x${bytesToHex(streamId)}`,
    partIndex,
    part_index: partIndex,
    partCount,
    part_count: partCount,
    ...decoded.metadata,
  };
  if (type === PLATHO_COMPACT_CONTENT_TYPES.TEXT) {
    return { type: 'text', text: fromUtf8(decoded.content), ...part };
  }
  if (type === PLATHO_COMPACT_CONTENT_TYPES.IMAGE) {
    return {
      type: 'image',
      format: mediaFormat,
      bytes: decoded.content,
      ...part,
    };
  }
  if (type === PLATHO_COMPACT_CONTENT_TYPES.PAYMENT) {
    if (decoded.content.length !== COMPACT_PAYMENT_CONTENT_BYTES) throw new Error('Compact payment payload has invalid length');
    return {
      type: 'payment',
      asset: decoded.content[0],
      amount: readBigUintBytes(decoded.content, 2, 16, 'payment amount'),
      intentId: decoded.content.subarray(18, 50),
      secret32: decoded.content.subarray(50, 82),
      ...part,
    };
  }
  throw new Error('Unsupported Platho compact payload type');
}

function compactBodyAad(bodyPrefix, hashes) {
  return concatBytes(
    utf8(COMPACT_BODY_AAD_DOMAIN),
    bodyPrefix,
    compactHashBytes(hashes.header0Hash, 'header0Hash'),
    compactHashBytes(hashes.header1Hash, 'header1Hash'),
  );
}

async function encryptCompactPayloadBytes(payloadBytes, recipientPublicBundle, options) {
  const recipient = await normalizeRecipientBundle(recipientPublicBundle);
  const suite = recipient.suite;
  const suiteByte = suiteByteForSuite(suite);
  const nonce = randomBytes(AES_GCM_NONCE_BYTES);
  const messageId = options.messageId ? assertBytes('compact message id', options.messageId, 16) : randomBytes(16);
  const ephemeralSecretKey = randomBytes(X25519_SECRET_KEY_BYTES);
  const ephemeralPublicKey = x25519.getPublicKey(ephemeralSecretKey);
  const x25519SharedSecret = deriveX25519SharedSecret(ephemeralSecretKey, recipient.x25519PublicKey);
  const sharedParts = [x25519SharedSecret];
  const kemParts = [];
  if (suite === CRYPTO_SUITES.HYBRID_V1) {
    const encapsulated = ml_kem768.encapsulate(recipient.mlKem768PublicKey);
    kemParts.push(assertBytes('mlKem768Ciphertext', encapsulated.cipherText, MLKEM768_CIPHERTEXT_BYTES));
    sharedParts.push(assertBytes('mlKem768SharedSecret', encapsulated.sharedSecret, 32));
  }
  const bodyPrefix = concatBytes(
    COMPACT_BODY_MAGIC,
    new Uint8Array([PROTOCOL_VERSION, suiteByte, 0, 0]),
    messageId,
    nonce,
    assertBytes('x25519EphemeralPublicKey', ephemeralPublicKey, X25519_PUBLIC_KEY_BYTES),
    ...kemParts,
  );
  const aad = compactBodyAad(bodyPrefix, options.hashes);
  const transcriptHash = await sha256(aad);
  const key = await deriveAesGcmKeyFromTranscriptHash(sharedParts, transcriptHash);
  const ciphertext = await getCrypto().subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: aad, tagLength: 128 },
    key,
    toUint8Array(payloadBytes),
  );
  return concatBytes(bodyPrefix, new Uint8Array(ciphertext));
}

function inspectCompactBodyBytes(bodyBytesLike) {
  const bodyBytes = toUint8Array(bodyBytesLike);
  if (bodyBytes.length < COMPACT_BODY_BASE_PREFIX_BYTES + COMPACT_BODY_TAG_BYTES) {
    throw new Error('Compact body is truncated');
  }
  assertCompactMagic(bodyBytes, 0, COMPACT_BODY_MAGIC, 'body');
  if (bodyBytes[4] !== PROTOCOL_VERSION) throw new Error('Unsupported Platho compact body version');
  const suite = suiteForByte(bodyBytes[5]);
  const prefixBytes = compactBodyPrefixBytesForSuite(suite);
  if (bodyBytes.length < prefixBytes + COMPACT_BODY_TAG_BYTES) throw new Error('Compact body is truncated');
  return {
    suite,
    suiteByte: bodyBytes[5],
    flags: bodyBytes[6],
    messageId: bodyBytes.subarray(8, 24),
    nonce: bodyBytes.subarray(24, 36),
    ephemeralPublicKey: bodyBytes.subarray(36, 68),
    mlKem768Ciphertext: suite === CRYPTO_SUITES.HYBRID_V1 ? bodyBytes.subarray(68, 68 + MLKEM768_CIPHERTEXT_BYTES) : null,
    prefix: bodyBytes.subarray(0, prefixBytes),
    ciphertext: bodyBytes.subarray(prefixBytes),
  };
}

async function decryptCompactBodyBytes(bodyBytesLike, recipientKeyPair, hashes) {
  const bodyBytes = toUint8Array(bodyBytesLike);
  const info = inspectCompactBodyBytes(bodyBytes);
  const expectedRecipientKeyId = await recipientKeyIdForSuite(recipientKeyPair, info.suite);
  if (expectedRecipientKeyId && hashes.recipientKeyId && expectedRecipientKeyId !== hashes.recipientKeyId) {
    throw new Error('Compact body recipient key mismatch');
  }
  const sharedParts = [deriveX25519SharedSecret(recipientKeyPair.x25519SecretKey, info.ephemeralPublicKey)];
  if (info.suite === CRYPTO_SUITES.HYBRID_V1) {
    sharedParts.push(ml_kem768.decapsulate(
      assertBytes('mlKem768Ciphertext', info.mlKem768Ciphertext, MLKEM768_CIPHERTEXT_BYTES),
      assertBytes('recipient.mlKem768SecretKey', recipientKeyPair.mlKem768SecretKey, 2400),
    ));
  }
  const aad = compactBodyAad(info.prefix, hashes);
  const transcriptHash = await sha256(aad);
  const key = await deriveAesGcmKeyFromTranscriptHash(sharedParts, transcriptHash);
  const plaintext = await getCrypto().subtle.decrypt(
    { name: 'AES-GCM', iv: info.nonce, additionalData: aad, tagLength: 128 },
    key,
    info.ciphertext,
  );
  return decodeCompactPayload(new Uint8Array(plaintext));
}

function compactChunkDataBytesForSuite(suite) {
  return compactMaxChunkWireBytesForSuite(suite) - COMPACT_CHUNK_HEADER_BYTES;
}

export function splitCompactBodyBytes(bodyBytesLike) {
  const bodyBytes = toUint8Array(bodyBytesLike);
  const info = inspectCompactBodyBytes(bodyBytes);
  const chunkDataBytes = compactChunkDataBytesForSuite(info.suite);
  const total = Math.ceil(bodyBytes.length / chunkDataBytes);
  if (total <= 0 || total > PLATHO_COMPACT_MAX_CHUNKS) {
    throw new Error(`Compact body needs ${total} chunks, max is ${PLATHO_COMPACT_MAX_CHUNKS}`);
  }
  const chunks = [];
  for (let i = 0; i < total; i += 1) {
    const start = i * chunkDataBytes;
    const end = Math.min(start + chunkDataBytes, bodyBytes.length);
    chunks.push(concatBytes(
      COMPACT_CHUNK_MAGIC,
      new Uint8Array([PROTOCOL_VERSION, info.suiteByte, i, total]),
      info.messageId,
      bodyBytes.subarray(start, end),
    ));
  }
  return chunks;
}

export function assembleCompactBodyChunks(chunksLike) {
  if (!Array.isArray(chunksLike) || chunksLike.length === 0) throw new Error('Compact chunks must be a non-empty array');
  if (chunksLike.length > PLATHO_COMPACT_MAX_CHUNKS) throw new Error('Too many Platho compact chunks');
  const parsed = chunksLike.map((chunkLike) => {
    const chunk = toUint8Array(chunkLike);
    if (chunk.length < COMPACT_CHUNK_HEADER_BYTES) throw new Error('Compact chunk is truncated');
    assertCompactMagic(chunk, 0, COMPACT_CHUNK_MAGIC, 'chunk');
    if (chunk[4] !== PROTOCOL_VERSION) throw new Error('Unsupported compact chunk version');
    const suite = suiteForByte(chunk[5]);
    const maxWireBytes = compactMaxChunkWireBytesForSuite(suite);
    if (chunk.length > maxWireBytes) throw new Error('Compact chunk exceeds suite wire limit');
    return {
      suite,
      suiteByte: chunk[5],
      index: chunk[6],
      total: chunk[7],
      messageId: chunk.subarray(8, 24),
      data: chunk.subarray(COMPACT_CHUNK_HEADER_BYTES),
    };
  });
  const first = parsed[0];
  if (first.total !== chunksLike.length || first.total === 0 || first.total > PLATHO_COMPACT_MAX_CHUNKS) {
    throw new Error('Compact chunk total mismatch');
  }
  const seen = new Set();
  for (const item of parsed) {
    if (item.suite !== first.suite || item.suiteByte !== first.suiteByte) throw new Error('Compact chunk suite mismatch');
    if (item.total !== first.total) throw new Error('Compact chunk total mismatch');
    if (!bytesEqual(item.messageId, first.messageId)) throw new Error('Compact chunk message id mismatch');
    if (item.index >= first.total || seen.has(item.index)) throw new Error('Compact chunk index mismatch');
    seen.add(item.index);
  }
  const ordered = [...parsed].sort((a, b) => a.index - b.index);
  const bodyBytes = concatBytes(...ordered.map((item) => item.data));
  const info = inspectCompactBodyBytes(bodyBytes);
  if (info.suite !== first.suite || !bytesEqual(info.messageId, first.messageId)) {
    throw new Error('Compact chunk body identity mismatch');
  }
  return bodyBytes;
}

function compactBodyBytesFromCapsuleBody(body) {
  if (!body || body.version !== PROTOCOL_VERSION || body.kind !== 'private' || body.layout !== PLATHO_COMPACT_BODY_LAYOUT) {
    throw new Error('Invalid Platho compact private capsule body');
  }
  const encodedBodyBytes = body.bodyBytes ?? body.body_bytes;
  if (encodedBodyBytes !== undefined) {
    const bodyBytes = base64urlDecode(encodedBodyBytes);
    const info = inspectCompactBodyBytes(bodyBytes);
    if (body.suite !== info.suite) throw new Error('Compact body suite mismatch');
    if (body.messageId !== base64urlEncode(info.messageId)) throw new Error('Compact body message id mismatch');
    if (body.byteLength !== bodyBytes.length) throw new Error('Compact body byte length mismatch');
    return bodyBytes;
  }
  const chunks = (body.chunks ?? []).map((chunk) => base64urlDecode(chunk));
  if (body.chunkCount !== chunks.length) throw new Error('Compact body chunk count mismatch');
  const bodyBytes = assembleCompactBodyChunks(chunks);
  const info = inspectCompactBodyBytes(bodyBytes);
  if (body.suite !== info.suite) throw new Error('Compact body suite mismatch');
  if (body.messageId !== base64urlEncode(info.messageId)) throw new Error('Compact body message id mismatch');
  if (body.byteLength !== bodyBytes.length) throw new Error('Compact body byte length mismatch');
  return bodyBytes;
}

function compactBodyObjectFromBytes(bodyBytes) {
  const info = inspectCompactBodyBytes(bodyBytes);
  return {
    version: PROTOCOL_VERSION,
    kind: 'private',
    layout: PLATHO_COMPACT_BODY_LAYOUT,
    suite: info.suite,
    messageId: base64urlEncode(info.messageId),
    byteLength: bodyBytes.length,
    encoding: 'base64url',
    bodyBytes: base64urlEncode(bodyBytes),
  };
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
  const encryptionKeyPair = options.encryptionKeyPair
    ? options.encryptionKeyPair
    : options.suite === CRYPTO_SUITES.CLASSICAL_V1
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

export async function publicKeyBundleFromVaultKeyRecord(keyRecord, options = {}) {
  if (!keyRecord || keyRecord.exists !== true) throw new Error('Vault key record does not exist');
  const requestedSuite = normalizeRequestedSuite(options.suite ?? options.requestedSuite);
  if (options.ownerWallet !== undefined && options.ownerWallet !== null) {
    const recordOwner = recordField(keyRecord, 'owner_wallet', 'ownerWallet');
    if (!compareAddressLike(recordOwner, options.ownerWallet)) {
      throw new Error('Vault key record owner does not match wallet owner');
    }
  }
  if (uintLikeToBigInt(recordField(keyRecord, 'revoked_lt', 'revokedLt'), 'revoked_lt') !== 0n) {
    throw new Error('Vault key record is revoked');
  }

  const encPublicKey = writeBigUintBytes(
    uintLikeToBigInt(recordField(keyRecord, 'enc_pubkey', 'encPubkey'), 'enc_pubkey'),
    X25519_PUBLIC_KEY_BYTES,
    'enc_pubkey',
  );
  const cryptoSuiteMask = uintLikeToBigInt(
    recordField(keyRecord, 'crypto_suite_mask', 'cryptoSuiteMask'),
    'crypto_suite_mask',
  );
  const pqLen = Number(uintLikeToBigInt(
    recordField(keyRecord, 'pq_kem_pubkey_len', 'pqKemPubkeyLen'),
    'pq_kem_pubkey_len',
  ));
  const pqHash = uintLikeToBigInt(
    recordField(keyRecord, 'pq_kem_pubkey_hash', 'pqKemPubkeyHash'),
    'pq_kem_pubkey_hash',
  );

  if (cryptoSuiteMask === BigInt(CONTRACT_CRYPTO_SUITE.CLASSICAL)) {
    if (requestedSuite === CRYPTO_SUITES.HYBRID_V1) {
      throw new Error('Recipient has not activated postquantum receive keys');
    }
    if (pqLen !== 0 || pqHash !== 0n) throw new Error('classical-v1 Vault key record must not carry ML-KEM fields');
    const emptyPq = recordPqKemPubkeyBytes(keyRecord, 0);
    if (emptyPq.length !== 0) throw new Error('classical-v1 Vault key record pq_kem_pubkey must be empty');
    return {
      version: PROTOCOL_VERSION,
      suite: CRYPTO_SUITES.CLASSICAL_V1,
      contractSuite: CONTRACT_CRYPTO_SUITE.CLASSICAL,
      keyId: await computeClassicalKeyId(encPublicKey),
      x25519PublicKey: base64urlEncode(encPublicKey),
    };
  }

  if (cryptoSuiteMask === BigInt(CONTRACT_CRYPTO_SUITE.HYBRID)) {
    if (pqLen !== MLKEM768_PUBLIC_KEY_BYTES) throw new Error('hybrid-v1 Vault key record has invalid ML-KEM length');
    const pqPubkey = recordPqKemPubkeyBytes(keyRecord, MLKEM768_PUBLIC_KEY_BYTES);
    const computedHash = await sha256(pqPubkey);
    if (bytesToBigInt(computedHash) !== pqHash) {
      throw new Error('Vault key record pq_kem_pubkey hash does not match key material');
    }
    if (requestedSuite === CRYPTO_SUITES.CLASSICAL_V1) {
      return {
        version: PROTOCOL_VERSION,
        suite: CRYPTO_SUITES.CLASSICAL_V1,
        contractSuite: CONTRACT_CRYPTO_SUITE.CLASSICAL,
        keyId: await computeClassicalKeyId(encPublicKey),
        x25519PublicKey: base64urlEncode(encPublicKey),
      };
    }
    return {
      version: PROTOCOL_VERSION,
      suite: CRYPTO_SUITES.HYBRID_V1,
      contractSuite: CONTRACT_CRYPTO_SUITE.HYBRID,
      keyId: await computeHybridKeyId(encPublicKey, pqPubkey),
      x25519PublicKey: base64urlEncode(encPublicKey),
      mlKem768PublicKey: base64urlEncode(pqPubkey),
      mlKem768PublicKeyHash: base64urlEncode(computedHash),
      mlKem768PublicKeyLen: MLKEM768_PUBLIC_KEY_BYTES,
    };
  }

  throw new Error('Vault key record has unsupported crypto suite');
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

export async function createVaultMessagingKeyDraft(publicBundle, signingPublicKey) {
  const bundle = await normalizeRecipientBundle(publicBundle);
  if (bundle.suite !== CRYPTO_SUITES.HYBRID_V1) {
    throw new Error('Platho v1 messaging keys require hybrid-v1');
  }
  const signPublicKey = assertBytes('signingPublicKey', signingPublicKey, ED25519_PUBLIC_KEY_BYTES);
  const encPublicKey = assertBytes('x25519PublicKey', bundle.x25519PublicKey, X25519_PUBLIC_KEY_BYTES);
  const pqHash = bundle.suite === CRYPTO_SUITES.HYBRID_V1
    ? assertBytes('mlKem768PublicKeyHash', base64urlDecode(bundle.mlKem768PublicKeyHash), 32)
    : new Uint8Array(32);
  const pqPubkey = bundle.suite === CRYPTO_SUITES.HYBRID_V1
    ? assertBytes('mlKem768PublicKey', bundle.mlKem768PublicKey, MLKEM768_PUBLIC_KEY_BYTES)
    : new Uint8Array();
  const draft = {
    $$type: 'RegisterMessagingKeys',
    enc_pubkey: bytesToBigInt(encPublicKey),
    sign_pubkey: bytesToBigInt(signPublicKey),
    pq_kem_pubkey_hash: bytesToBigInt(pqHash),
    pq_kem_pubkey_len: bundle.suite === CRYPTO_SUITES.HYBRID_V1 ? BigInt(MLKEM768_PUBLIC_KEY_BYTES) : 0n,
    pq_kem_pubkey: pqPubkey,
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
      pq_kem_pubkey_b64u: base64urlEncode(pqPubkey),
      crypto_suite_mask: Number(draft.crypto_suite_mask),
    },
  };
}

export async function verifyVaultKeyRecordBinding(signedBundle, keyRecord, options = {}) {
  const verifiedBundle = await verifySignedPublicKeyBundle(signedBundle, { now: options.now });
  if (!keyRecord || keyRecord.exists !== true) throw new Error('Vault key record does not exist');
  const draft = await createVaultMessagingKeyDraft(verifiedBundle.bundle, verifiedBundle.signingPublicKey);

  const expectedOwner = options.ownerWallet ?? signedBundle.ownerWallet;
  if (expectedOwner !== null && expectedOwner !== undefined) {
    const recordOwner = recordField(keyRecord, 'owner_wallet', 'ownerWallet');
    if (!compareAddressLike(recordOwner, expectedOwner)) {
      throw new Error('Vault key record owner does not match wallet owner');
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
  const pqLen = Number(draft.message.pq_kem_pubkey_len);
  const recordPqPubkey = recordPqKemPubkeyBytes(keyRecord, pqLen);
  if (pqLen === MLKEM768_PUBLIC_KEY_BYTES) {
    if (!bytesEqual(recordPqPubkey, draft.message.pq_kem_pubkey)) {
      throw new Error('Vault key record pq_kem_pubkey does not match signed bundle');
    }
    const recordPqHash = await sha256(recordPqPubkey);
    if (bytesToBigInt(recordPqHash) !== draft.message.pq_kem_pubkey_hash) {
      throw new Error('Vault key record pq_kem_pubkey hash does not match key material');
    }
  }
  if (uintLikeToBigInt(recordField(keyRecord, 'revoked_lt', 'revokedLt'), 'revoked_lt') !== 0n) {
    throw new Error('Vault key record is revoked');
  }

  return {
    signedBundle: verifiedBundle,
    wallet: expectedOwner ? { walletAddress: parseTonAddress(expectedOwner).raw } : null,
    draft,
    active: true,
    recordKeyId: options.recordKeyId ?? null,
    currentKeyId: options.currentKeyId ?? null,
  };
}

function base64urlFixedBytes(value, length, name) {
  return assertBytes(name, base64urlDecode(value), length);
}

function uint256Bytes(value, name = 'uint256') {
  if (value instanceof Uint8Array || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return assertBytes(name, value, 32);
  }
  if (typeof value === 'string') {
    const text = value.trim();
    if (/^(0x)?[0-9a-fA-F]{64}$/.test(text)) {
      return hexToBytes(text, 32, name);
    }
    return assertBytes(name, base64urlMaybeDecode(text), 32);
  }
  return writeBigUintBytes(uintLikeToBigInt(value ?? 0n, name), 32, name);
}

function privateProfilePointer(profile = {}) {
  const version = safeInteger(profile.version ?? profile.profileVersion ?? profile.profile_version ?? 0, 'profile_version');
  return {
    version,
    avatarHashBytes: uint256Bytes(profile.avatarHash ?? profile.avatar_hash ?? 0n, 'avatar_hash'),
  };
}

function capsuleTimestampSecond(value, name) {
  if (!Number.isSafeInteger(value) || value < 0 || value % 1000 !== 0) {
    throw new Error(`${name} must be second-aligned milliseconds`);
  }
  const seconds = value / 1000;
  if (!Number.isSafeInteger(seconds) || seconds > 0xffffffff) {
    throw new Error(`${name} must fit uint32 seconds`);
  }
  return seconds;
}

function alignCapsuleTimestampMs(value, mode, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be safe integer milliseconds`);
  }
  const seconds = mode === 'ceil' ? Math.ceil(value / 1000) : Math.floor(value / 1000);
  if (!Number.isSafeInteger(seconds) || seconds > 0xffffffff) {
    throw new Error(`${name} must fit uint32 seconds`);
  }
  return seconds * 1000;
}

function privateCapsuleHeader0Bytes(header0) {
  if (header0?.version !== PROTOCOL_VERSION || header0.kind !== 'private') {
    throw new Error('Invalid Platho private capsule header0');
  }
  assertAllowedPrivateCapsulePair(header0.sizeClass, header0.cryptoSuite);
  const suiteByte = suiteByteForSuite(header0.suite);
  if (header0.cryptoSuite !== suiteByte) throw new Error('Private capsule header0 suite byte mismatch');
  const bytes = concatBytes(
    PRIVATE_CAPSULE_HEADER0_MAGIC,
    new Uint8Array([
      PROTOCOL_VERSION,
      uint8Byte(header0.publishKind, 'header0.publishKind'),
      uint8Byte(header0.sizeClass, 'header0.sizeClass'),
      uint8Byte(header0.cryptoSuite, 'header0.cryptoSuite'),
    ]),
    base64urlFixedBytes(header0.senderKeyId, 32, 'header0.senderKeyId'),
    base64urlFixedBytes(header0.recipientKeyId, 32, 'header0.recipientKeyId'),
    base64urlFixedBytes(header0.senderSigningPublicKey, ED25519_PUBLIC_KEY_BYTES, 'header0.senderSigningPublicKey'),
    uint32Bytes(header0.profileVersion ?? 0, 'header0.profileVersion'),
    uint256Bytes(header0.avatarHash ?? 0n, 'header0.avatarHash'),
  );
  if (bytes.length !== PLATHO_BINARY_HEADER0_BYTES) throw new Error('Private capsule header0 binary size drift');
  return bytes;
}

function privateCapsuleHeader1Bytes(header1) {
  if (header1?.version !== PROTOCOL_VERSION) throw new Error('Invalid Platho private capsule header1');
  const flags = uint8Byte(header1.flags ?? 0, 'header1.flags');
  if (flags !== 0) throw new Error('Private capsule header1 flags must be zero in v1');
  const bytes = concatBytes(
    PRIVATE_CAPSULE_HEADER1_MAGIC,
    new Uint8Array([
      PROTOCOL_VERSION,
      flags,
    ]),
    uint32Bytes(capsuleTimestampSecond(header1.createdAt, 'header1.createdAt'), 'header1.createdAtSec'),
    uint32Bytes(capsuleTimestampSecond(header1.expiresAt, 'header1.expiresAt'), 'header1.expiresAtSec'),
    base64urlFixedBytes(header1.clientNonce, 16, 'header1.clientNonce'),
  );
  if (bytes.length !== PLATHO_BINARY_HEADER1_BYTES) throw new Error('Private capsule header1 binary size drift');
  return bytes;
}

function privateCapsuleHeader0ObjectFromBytes(bytesLike) {
  const bytes = toUint8Array(bytesLike);
  if (bytes.length !== PLATHO_BINARY_HEADER0_BYTES) throw new Error('Private capsule header0 binary size drift');
  if (!bytesEqual(bytes.subarray(0, 4), PRIVATE_CAPSULE_HEADER0_MAGIC)) {
    throw new Error('Private capsule header0 magic mismatch');
  }
  const version = bytes[4];
  if (version !== PROTOCOL_VERSION) throw new Error('Unsupported private capsule header0 version');
  const publishKind = bytes[5];
  const sizeClass = bytes[6];
  const cryptoSuite = bytes[7];
  assertAllowedPrivateCapsulePair(sizeClass, cryptoSuite);
  const suite = suiteForByte(cryptoSuite);
  return {
    version,
    kind: 'private',
    publishKind,
    sizeClass,
    cryptoSuite,
    suite,
    senderKeyId: base64urlEncode(bytes.subarray(8, 40)),
    recipientKeyId: base64urlEncode(bytes.subarray(40, 72)),
    senderSigningPublicKey: base64urlEncode(bytes.subarray(72, 104)),
    profileVersion: readUint32(bytes, 104, 'header0.profileVersion'),
    profile_version: readUint32(bytes, 104, 'header0.profileVersion'),
    avatarHash: bigintHex256(bytesToBigInt(bytes.subarray(108, 140))),
    avatar_hash: bigintHex256(bytesToBigInt(bytes.subarray(108, 140))),
  };
}

function privateCapsuleHeader1ObjectFromBytes(bytesLike) {
  const bytes = toUint8Array(bytesLike);
  if (bytes.length !== PLATHO_BINARY_HEADER1_BYTES) throw new Error('Private capsule header1 binary size drift');
  if (!bytesEqual(bytes.subarray(0, 4), PRIVATE_CAPSULE_HEADER1_MAGIC)) {
    throw new Error('Private capsule header1 magic mismatch');
  }
  const version = bytes[4];
  if (version !== PROTOCOL_VERSION) throw new Error('Unsupported private capsule header1 version');
  const flags = bytes[5];
  if (flags !== 0) throw new Error('Private capsule header1 flags must be zero in v1');
  return {
    version,
    flags,
    createdAt: readUint32(bytes, 6, 'header1.createdAtSec') * 1000,
    expiresAt: readUint32(bytes, 10, 'header1.expiresAtSec') * 1000,
    clientNonce: base64urlEncode(bytes.subarray(14, 30)),
  };
}

function privateCapsuleBodyBytes(body) {
  if (body?.layout !== PLATHO_COMPACT_BODY_LAYOUT) {
    throw new Error('Private capsule body must use platho.byte-layout.v1');
  }
  return compactBodyBytesFromCapsuleBody(body);
}

function expectedPrivateBodyBytes(sizeClass, cryptoSuite) {
  const suite = suiteForByte(cryptoSuite);
  return compactBodyBytesForUsefulBytes(suite, usefulBytesForCapsuleSizeClass(sizeClass));
}

function assertPrivateBodyMatchesHeader(header0, bodyBytes) {
  const bytes = toUint8Array(bodyBytes);
  const expectedBytes = expectedPrivateBodyBytes(header0.sizeClass, header0.cryptoSuite);
  if (bytes.length !== expectedBytes) {
    throw new Error(`Private capsule body size mismatch: ${bytes.length} != ${expectedBytes}`);
  }
  const info = inspectCompactBodyBytes(bytes);
  if (info.suite !== header0.suite || suiteByteForSuite(info.suite) !== header0.cryptoSuite) {
    throw new Error('Private capsule compact body suite mismatch');
  }
}

async function computePrivateCapsuleChainCells(header0, header1, body) {
  return {
    header0: await createSnakeCellPayload('private capsule header0', privateCapsuleHeader0Bytes(header0), PLATHO_ONCHAIN_HEADER_MAX_BYTES),
    header1: await createSnakeCellPayload('private capsule header1', privateCapsuleHeader1Bytes(header1), PLATHO_ONCHAIN_HEADER_MAX_BYTES),
    body: await createSnakeCellPayload('private capsule body', privateCapsuleBodyBytes(body), PLATHO_ONCHAIN_BODY_MAX_BYTES),
  };
}

async function computePrivateCapsuleHeaderHashes(header0, header1) {
  const header0Cell = await createSnakeCellPayload('private capsule header0', privateCapsuleHeader0Bytes(header0), PLATHO_ONCHAIN_HEADER_MAX_BYTES);
  const header1Cell = await createSnakeCellPayload('private capsule header1', privateCapsuleHeader1Bytes(header1), PLATHO_ONCHAIN_HEADER_MAX_BYTES);
  return {
    header0Hash: assertHashHex('chainCells.header0.hash', header0Cell.hash),
    header1Hash: assertHashHex('chainCells.header1.hash', header1Cell.hash),
  };
}

function privateCapsuleHashesFromChainCells(chainCells) {
  return {
    header0Hash: assertHashHex('chainCells.header0.hash', chainCells.header0.hash),
    header1Hash: assertHashHex('chainCells.header1.hash', chainCells.header1.hash),
    bodyHash: assertHashHex('chainCells.body.hash', chainCells.body.hash),
  };
}

async function computePrivateCapsuleHashes(header0, header1, body) {
  return privateCapsuleHashesFromChainCells(await computePrivateCapsuleChainCells(header0, header1, body));
}

async function computePrivateCapsuleId(hashes) {
  return stableJsonHashId({
    header0Hash: assertHashHex('header0Hash', hashes.header0Hash),
    header1Hash: assertHashHex('header1Hash', hashes.header1Hash),
    bodyHash: assertHashHex('bodyHash', hashes.bodyHash),
  });
}

function entryHashHex(entry, fieldName) {
  if (entry?.[fieldName] === null || entry?.[fieldName] === undefined) return null;
  return bigintHex256(entry[fieldName]);
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
    profileVersion: capsule.header0.profileVersion ?? 0,
    avatarHash: capsule.header0.avatarHash ?? bigintHex256(0n),
    createdAt: capsule.header1.createdAt,
    expiresAt: capsule.header1.expiresAt,
  };
}

function assertChainCellPayloadMatches(name, actual, expected) {
  if (actual === undefined || actual === null) return;
  const fields = ['layout', 'bytes', 'bits', 'cells', 'refs', 'hash', 'boc'];
  for (const field of fields) {
    if (actual[field] !== expected[field]) {
      throw new Error(`${name}.${field} does not match deterministic on-chain cell`);
    }
  }
}

function privateCapsulePublishDraft(capsule) {
  if (!capsule.chainCells?.header0 || !capsule.chainCells?.header1 || !capsule.chainCells?.body) {
    throw new Error('Private capsule is missing on-chain payload cells');
  }
  return {
    kind: 'private',
    publish_kind: CAPSULE_PUBLISH_KIND.PRIVATE,
    size_class: capsule.header0.sizeClass,
    crypto_suite: capsule.header0.cryptoSuite,
    header_0_hash: capsule.hashes.header0Hash,
    header_1_hash: capsule.hashes.header1Hash,
    body_hash: capsule.hashes.bodyHash,
    header_0_cell: capsule.chainCells.header0,
    header_1_cell: capsule.chainCells.header1,
    body_cell: capsule.chainCells.body,
    hashes_ref_order: ['body_hash', 'header_0_hash', 'header_1_hash'],
    payload_bundle_ref_order: ['header_0_cell', 'header_1_cell', 'body_cell'],
    valid_until: Math.floor(capsule.header1.expiresAt / 1000),
  };
}

export async function createEncryptedPrivateCapsule(plaintext, recipientSignedBundle, senderIdentity, options = {}) {
  if (!senderIdentity?.encryptionKeyPair || !senderIdentity?.signingSecretKey || !senderIdentity?.signingPublicKey) {
    throw new Error('Invalid Platho sender identity');
  }
  const now = options.now ?? Date.now();
  const recipient = await verifySignedPublicKeyBundle(recipientSignedBundle, { now });
  return createEncryptedPrivateCapsuleForVerifiedRecipient(plaintext, recipient, senderIdentity, { ...options, now });
}

export async function createEncryptedPrivateCapsuleFromPublicBundle(plaintext, recipientPublicBundle, senderIdentity, options = {}) {
  if (!senderIdentity?.encryptionKeyPair || !senderIdentity?.signingSecretKey || !senderIdentity?.signingPublicKey) {
    throw new Error('Invalid Platho sender identity');
  }
  const normalizedRecipient = await normalizeRecipientBundle(recipientPublicBundle);
  const recipient = {
    bundle: recipientPublicBundle,
    keyId: normalizedRecipient.keyId,
    suite: normalizedRecipient.suite,
    contractSuite: normalizedRecipient.contractSuite,
  };
  return createEncryptedPrivateCapsuleForVerifiedRecipient(plaintext, recipient, senderIdentity, options);
}

async function createEncryptedPrivateCapsuleForVerifiedRecipient(plaintext, recipient, senderIdentity, options = {}) {
  const now = options.now ?? Date.now();
  const suite = assertSupportedPrivateSuite(recipient.suite);
  const cryptoSuite = recipient.contractSuite;
  const payloadBytes = options.payloadBytes
    ? assertCompactPayloadBytes(options.payloadBytes, options)
    : encodeCompactPayload(options.payload ?? { type: 'text', text: plaintext }, options);
  const payloadInfo = compactPayloadContent(payloadBytes);
  const sizeClass = normalizeCapsuleSizeClass(options.sizeClass ?? options.size_class ?? payloadInfo.sizeClass);
  if (payloadInfo.sizeClass !== sizeClass) throw new Error('Private capsule payload size class mismatch');
  assertAllowedPrivateCapsulePair(sizeClass, cryptoSuite);

  const requestedCreatedAt = options.createdAt ?? now;
  const requestedExpiresAt = options.expiresAt ?? requestedCreatedAt + (options.ttlMs ?? DEFAULT_CAPSULE_TTL_MS);
  const createdAt = alignCapsuleTimestampMs(requestedCreatedAt, 'floor', 'header1.createdAt');
  const expiresAt = alignCapsuleTimestampMs(requestedExpiresAt, 'ceil', 'header1.expiresAt');
  const clientNonce = options.clientNonce ?? base64urlEncode(randomBytes(16));
  const pointer = privateProfilePointer(options.profile ?? {
    profileVersion: options.senderProfileVersion ?? options.profileVersion,
    avatarHash: options.senderAvatarHash ?? options.avatarHash,
  });
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
    profileVersion: pointer.version,
    profile_version: pointer.version,
    avatarHash: bigintHex256(bytesToBigInt(pointer.avatarHashBytes)),
    avatar_hash: bigintHex256(bytesToBigInt(pointer.avatarHashBytes)),
  };
  const header1 = {
    version: PROTOCOL_VERSION,
    flags: 0,
    createdAt,
    expiresAt,
    clientNonce,
  };
  assertCapsuleTimestampPolicy(header1, { ...options, now });

  const partialHashes = await computePrivateCapsuleHeaderHashes(header0, header1);
  const bodyBytes = await encryptCompactPayloadBytes(payloadBytes, recipient.bundle, {
    hashes: partialHashes,
    messageId: options.messageId,
  });
  assertPrivateBodyMatchesHeader(header0, bodyBytes);
  const body = {
    version: PROTOCOL_VERSION,
    kind: 'private',
    ...compactBodyObjectFromBytes(bodyBytes),
  };
  const chainCells = await computePrivateCapsuleChainCells(header0, header1, body);
  const hashes = privateCapsuleHashesFromChainCells(chainCells);
  const id = await computePrivateCapsuleId(hashes);
  const unsignedCapsule = {
    version: PROTOCOL_VERSION,
    kind: 'private',
    id,
    header0,
    header1,
    body,
    hashes,
    chainCells,
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
  const expectedContractSuite = suiteConfig(capsule.header0.suite).contractSuite;
  if (capsule.header0.cryptoSuite !== expectedContractSuite) {
    throw new Error('Private capsule header suite does not match crypto suite');
  }
  assertCapsuleTimestampPolicy(capsule.header1, options);

  const chainCells = await computePrivateCapsuleChainCells(capsule.header0, capsule.header1, capsule.body);
  assertChainCellPayloadMatches('capsule.chainCells.header0', capsule.chainCells?.header0, chainCells.header0);
  assertChainCellPayloadMatches('capsule.chainCells.header1', capsule.chainCells?.header1, chainCells.header1);
  assertChainCellPayloadMatches('capsule.chainCells.body', capsule.chainCells?.body, chainCells.body);
  const hashes = privateCapsuleHashesFromChainCells(chainCells);
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

  const bodyBytes = compactBodyBytesFromCapsuleBody(capsule.body);
  assertPrivateBodyMatchesHeader(capsule.header0, bodyBytes);

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

  const normalizedCapsule = { ...capsule, hashes, chainCells };
  return {
    capsule: normalizedCapsule,
    publish: privateCapsulePublishDraft(normalizedCapsule),
    senderSigningPublicKey,
    bodyBytes,
  };
}

export async function openEncryptedPrivateCapsule(capsule, recipientKeyPair, options = {}) {
  const verified = await verifyEncryptedPrivateCapsule(capsule, options);
  const replayCache = options.replayCache;
  if (replayCache && await replayCache.has(verified.capsule.id)) {
    throw new Error('Private capsule replay detected');
  }
  const payload = await decryptCompactBodyBytes(verified.bodyBytes, recipientKeyPair, {
    header0Hash: verified.capsule.hashes.header0Hash,
    header1Hash: verified.capsule.hashes.header1Hash,
    recipientKeyId: verified.capsule.header0.recipientKeyId,
  });
  if (replayCache) await replayCache.add(verified.capsule.id, verified.capsule.header1.expiresAt);
  return {
    plaintext: payload.type === 'text' ? payload.text : '',
    payload,
    capsule: verified.capsule,
    publish: verified.publish,
    senderSigningPublicKey: verified.senderSigningPublicKey,
  };
}

export async function privateCapsuleFromChainEntry(entry, options = {}) {
  if (!entry || entry.exists !== true) throw new Error('CapsuleHub private entry does not exist');
  const header0Bytes = snakeBytesFromBoc(entry.header_0_boc, 'CapsuleHub private header0');
  const header1Bytes = snakeBytesFromBoc(entry.header_1_boc, 'CapsuleHub private header1');
  const bodyBytes = snakeBytesFromBoc(entry.body_boc, 'CapsuleHub private body');
  const header0 = privateCapsuleHeader0ObjectFromBytes(header0Bytes);
  const header1 = privateCapsuleHeader1ObjectFromBytes(header1Bytes);
  const body = {
    version: PROTOCOL_VERSION,
    kind: 'private',
    ...compactBodyObjectFromBytes(bodyBytes),
  };
  if (entry.size_class !== undefined && BigInt(entry.size_class) !== BigInt(header0.sizeClass)) {
    throw new Error('CapsuleHub private entry size class mismatch');
  }
  if (entry.crypto_suite !== undefined && BigInt(entry.crypto_suite) !== BigInt(header0.cryptoSuite)) {
    throw new Error('CapsuleHub private entry crypto suite mismatch');
  }
  assertCapsuleTimestampPolicy(header1, {
    ...options,
    enforceExpiry: options.enforceExpiry ?? false,
  });
  assertPrivateBodyMatchesHeader(header0, bodyBytes);
  const chainCells = await computePrivateCapsuleChainCells(header0, header1, body);
  const hashes = privateCapsuleHashesFromChainCells(chainCells);
  const expectedHeader0Hash = entryHashHex(entry, 'header_0_hash');
  const expectedHeader1Hash = entryHashHex(entry, 'header_1_hash');
  const expectedBodyHash = entryHashHex(entry, 'body_hash');
  if (expectedHeader0Hash && hashes.header0Hash !== expectedHeader0Hash) {
    throw new Error('CapsuleHub private entry header0 hash mismatch');
  }
  if (expectedHeader1Hash && hashes.header1Hash !== expectedHeader1Hash) {
    throw new Error('CapsuleHub private entry header1 hash mismatch');
  }
  if (expectedBodyHash && hashes.bodyHash !== expectedBodyHash) {
    throw new Error('CapsuleHub private entry body hash mismatch');
  }
  const id = await computePrivateCapsuleId(hashes);
  const capsule = {
    version: PROTOCOL_VERSION,
    kind: 'private',
    id,
    header0,
    header1,
    body,
    hashes,
    chainCells,
    chainSource: {
      capsuleHub: 'CapsuleHub',
      entryId: entry.entry_id === undefined ? null : String(entry.entry_id),
      entryUid: entry.entry_uid === undefined ? null : String(entry.entry_uid),
      publishId: entry.publish_id === undefined ? null : String(entry.publish_id),
      authorWallet: entry.author_wallet ?? null,
      createdAt: entry.created_at === undefined ? null : String(entry.created_at),
    },
  };
  return {
    capsule,
    publish: privateCapsulePublishDraft(capsule),
    senderSigningPublicKey: base64urlDecode(header0.senderSigningPublicKey),
    bodyBytes,
  };
}

export async function openPrivateCapsuleChainEntry(entry, recipientKeyPair, options = {}) {
  const verified = await privateCapsuleFromChainEntry(entry, options);
  const replayCache = options.replayCache;
  if (replayCache && await replayCache.has(verified.capsule.id)) {
    throw new Error('Private capsule replay detected');
  }
  const payload = await decryptCompactBodyBytes(verified.bodyBytes, recipientKeyPair, {
    header0Hash: verified.capsule.hashes.header0Hash,
    header1Hash: verified.capsule.hashes.header1Hash,
    recipientKeyId: verified.capsule.header0.recipientKeyId,
  });
  if (replayCache) await replayCache.add(verified.capsule.id, verified.capsule.header1.expiresAt);
  return {
    plaintext: payload.type === 'text' ? payload.text : '',
    payload,
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
  await assertEnvelopeMatchesRecipient(envelope, recipientKeyPair);
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
  const walletAddress = `0:${bytesToHex(await sha256(utf8('self-test-ton-wallet-address')))}`;
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
  const activeVaultKeyRecord = {
    exists: true,
    owner_wallet: walletAddress,
    key_generation: 0n,
    enc_pubkey: vaultDraft.message.enc_pubkey,
    sign_pubkey: vaultDraft.message.sign_pubkey,
    pq_kem_pubkey_hash: vaultDraft.message.pq_kem_pubkey_hash,
    pq_kem_pubkey_len: vaultDraft.message.pq_kem_pubkey_len,
    pq_kem_pubkey: vaultDraft.message.pq_kem_pubkey,
    crypto_suite_mask: vaultDraft.message.crypto_suite_mask,
    created_at: 1_700_000_000n,
    created_lt: 1n,
    revoked_at: 0n,
    revoked_lt: 0n,
  };
  const vaultRecordBinding = await verifyVaultKeyRecordBinding(signedBundle, activeVaultKeyRecord, {
    now: 1_700_000_001_000,
    ownerWallet: walletAddress,
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
    clientNonce: base64urlEncode(new Uint8Array(16).fill(1)),
    threadId: 'self-test',
  });
  const openedCapsule = await openEncryptedPrivateCapsule(capsule, identity.encryptionKeyPair, {
    now: 1_700_000_003_000,
    replayCache: capsuleReplayCache,
  });
  if (openedCapsule.plaintext !== 'capsule sealed message') {
    throw new Error('private capsule open failed');
  }
  if (openedCapsule.publish.size_class !== CAPSULE_SIZE_CLASS.STANDARD) {
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

  const ownerMismatchRecord = { ...activeVaultKeyRecord, owner_wallet: 'testnet:attacker-wallet-placeholder' };
  await expectReject('Vault key record owner mismatch', () => verifyVaultKeyRecordBinding(signedBundle, ownerMismatchRecord, {
    now: 1_700_000_001_000,
    ownerWallet: walletAddress,
  }));

  const revokedRecord = { ...activeVaultKeyRecord, revoked_lt: 2n };
  await expectReject('Vault key record revoked', () => verifyVaultKeyRecordBinding(signedBundle, revokedRecord, {
    now: 1_700_000_001_000,
    ownerWallet: walletAddress,
  }));

  const encMismatchRecord = { ...activeVaultKeyRecord, enc_pubkey: activeVaultKeyRecord.enc_pubkey ^ 1n };
  await expectReject('Vault key record enc_pubkey mismatch', () => verifyVaultKeyRecordBinding(signedBundle, encMismatchRecord, {
    now: 1_700_000_001_000,
    ownerWallet: walletAddress,
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
  capsuleHeaderTampered.header1.clientNonce = base64urlEncode(randomBytes(16));
  await expectReject('private capsule header tamper', () => verifyEncryptedPrivateCapsule(capsuleHeaderTampered, {
    now: 1_700_000_004_000,
  }));

  const capsuleBodyTampered = structuredClone(capsule);
  const capsuleBodyTamperedBytes = base64urlDecode(capsuleBodyTampered.body.bodyBytes);
  capsuleBodyTamperedBytes[capsuleBodyTamperedBytes.length - 1] ^= 1;
  capsuleBodyTampered.body.bodyBytes = base64urlEncode(capsuleBodyTamperedBytes);
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
  capsuleContextTampered.header0.senderKeyId = base64urlEncode(randomBytes(32));
  capsuleContextTampered.hashes = await computePrivateCapsuleHashes(
    capsuleContextTampered.header0,
    capsuleContextTampered.header1,
    capsuleContextTampered.body,
  );
  capsuleContextTampered.chainCells = await computePrivateCapsuleChainCells(
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
  await expectReject('private capsule compact AAD mismatch', () => openEncryptedPrivateCapsule(capsuleContextTampered, identity.encryptionKeyPair, {
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
  const standardToHybridCapableEnvelope = await encryptText('standard message', hybridAsClassicalBundle);
  if (await decryptText(standardToHybridCapableEnvelope, bobHybrid) !== 'standard message') {
    throw new Error('hybrid-capable key pair failed to decrypt standard message');
  }
  const wrongRecipientIdEnvelope = structuredClone(standardToHybridCapableEnvelope);
  wrongRecipientIdEnvelope.recipientKeyId = bobHybrid.keyId;
  await expectReject('classical-v1 message with hybrid recipient key id', () => decryptText(wrongRecipientIdEnvelope, bobHybrid));

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
      walletBindingVerified: true,
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
      bodyCellBytes: openedCapsule.publish.body_cell.bytes,
      bodyCellBocBytes: base64Decode(openedCapsule.publish.body_cell.boc).length,
    },
  };
}
