import { randomBytes, parseTonAddress, sha256Sync } from './crypto/platho-crypto.mjs?v=21';
import { ed25519 } from './vendor/@noble/curves/ed25519.js';

export const ATH_WALLET_OPS = Object.freeze({
  // TEP-74's own transfer, 0x0F8A7EA5. The frozen wallet serves TWO notify lanes and they are NOT interchangeable:
  // this one makes the RECIPIENT's wallet emit the standard JettonTransferNotification, while
  // ATHTransferRequestWithNotify makes it emit Platho's own AthTransferNotification. A contract that listens for
  // one hears silence from the other — which is exactly what the M21C FeeVault does, so staking into a vault has
  // to travel this lane. [2026-08-29: the vault refused the custom lane's notification with its unknown-body
  // throw, and the client had no builder for this one at all.]
  JettonTransfer: 0x0F8A7EA5,
  ATHBurn: 1096042497,
  ATHTransferRequest: 1096042512,
  ATHTransferRequestWithNotify: 1096042516,
  ATHTransferRequestRegistryProfileAvatar: 1096042522,   // 0x4154481A
  ATHTransferRequestRegistryMintUsername: 1096042524,    // 0x4154481C
});

export const USERNAME_REGISTRY_OPS = Object.freeze({
  FlushBurnAthDue: 0xE9A2C2CB,
});

export const PROFILE_REGISTRY_OPS = Object.freeze({
  FlushProfileBurnAthDue: 0x50A61111,
});

export const REGISTRY_BURN_FLUSH_MESSAGE_VALUE_NANOTONS = 20_000_000n;

export const VAULT_PUBLISH_KIND = Object.freeze({
  PRIVATE: 1n,
  PUBLIC: 2n,
});

export const MAX_EXTERNAL_MESSAGE_BYTES = 65535;               // TON max_ext_msg_size (config-43); validators
                                                               // DROP a larger inbound external BoC before the
                                                               // contract runs. The chain config is the ONLY
                                                               // authority here: the note used to cite
                                                               // Vault.tact EXT_HARD_BITS, a contract clean-17
                                                               // deleted, and a dead citation invites a reader
                                                               // to go looking for a limit nothing enforces.
export const VAULT_SIZE_CLASS = Object.freeze({
  KIB_1: 1n,
  KIB_2: 2n,
  KIB_4: 4n,
  KIB_8: 8n,
  KIB_16: 16n,
  KIB_32: 32n,
  STANDARD: 1n,
});

export const VAULT_CRYPTO_SUITE = Object.freeze({
  PUBLIC_NONE: 0n,
  CLASSICAL: 1n,
  HYBRID: 2n,
});

export const PUBLIC_POST_BODY_MAX_BYTES = 32 * 1024;
export const PUBLIC_BODY_LAYOUT = 'platho.public-byte-layout.v1';
export const PUBLIC_HEADER_MAGIC = 'PPH1';
export const PUBLIC_BODY_VERSION = 1;
export const PUBLIC_BODY_KIND = Object.freeze({
  POST: 1,
  COMMENT: 2,
  IMAGE_POST: 3,
  IMAGE_COMMENT: 4,
  AVATAR: 5,
  DOCUMENT_POST: 6,
  DOCUMENT_COMMENT: 7,
});
export const PUBLIC_BODY_FLAGS = Object.freeze({
  COMMENTS_DISABLED: 1,
});
export const PUBLIC_BODY_MEDIA_FORMATS = Object.freeze({
  NONE: 0,
  WEBP: 1,
});
export const PUBLIC_POST_HEADER_BYTES = 68;
export const PUBLIC_COMMENT_HEADER_BYTES = 72;
export const PUBLIC_POST_TEXT_MAX_BYTES = PUBLIC_POST_BODY_MAX_BYTES;
export const PUBLIC_COMMENT_TEXT_MAX_BYTES = PUBLIC_POST_BODY_MAX_BYTES;
export const MLKEM768_PUBLIC_KEY_BYTES = 1184;
export const PROFILE_AVATAR_PRICE_ATH = 100_000_000_000n;
// [REPLACED 2026-07-30, class sweep 2] Three constants used to live here — PROFILE_AVATAR_NOTIFY_VALUE_NANOTONS,
// PROFILE_AVATAR_VAULT_TON_CHARGE_NANOTONS (115,000,000) and USERNAME_MINT_VAULT_TON_CHARGE_NANOTONS (617,000,000) —
// and every one of them was described in terms of a Vault that clean-17 DELETED. They were not merely stale prose:
// app.js still fed them to the two fee ESTIMATORS while the live direct-pay send paths attached completely different
// values, so the number a user was shown before signing was wrong by 78% for a name and 74% for an avatar.
//
// The values below are the ones the send path actually attaches, exported from ONE place so an estimator and a
// transaction cannot drift apart again. PVSEND-01 pins the estimator to the attached value.
//
// Direct-pay username mint: the mint deploys a UsernameNFTItem, so the registry retains ~0.91 GRAM (a 100-year item
// endowment). notify carries that downstream; the request is notify plus forwarding, and the ATH wallet refunds every
// excess nanoton through refund_owner_excess, so an ample request costs the user nothing.
export const USERNAME_MINT_DIRECT_NOTIFY_VALUE_NANOTONS = 1_000_000_000n;
export const USERNAME_MINT_DIRECT_REQUEST_VALUE_NANOTONS = 1_100_000_000n;
// Direct-pay profile avatar: an avatar pointer write, far cheaper than deploying an NFT item.
export const PROFILE_AVATAR_DIRECT_NOTIFY_VALUE_NANOTONS = 66_000_000n;
export const PROFILE_AVATAR_DIRECT_REQUEST_VALUE_NANOTONS = 200_000_000n;
const UINT128_MOD = 1n << 128n;

export const ATH_WALLET_RESERVES_NANOTONS = Object.freeze({
  transferNotifyAckValue: 1_000_000n,
  internalTransferAckValue: 3_000_000n,
  // [CORRECTED 2026-07-31] Mirrors ATH_INTERNAL_TRANSFER_SOURCE_ACK_VALUE, which the contract raised 1M -> 4M on
  // 2026-07-29 because it funds the only path that clears pending_outgoing_transfers. This copy was left at 1M, so
  // athNotifyTransferValue() computed 3,000,000 less than gate 14307 demands and every quote it produced was
  // unspendable. PWA-TX-07 stayed green because it compared this function to a hand-typed 69_000_000 derived from
  // the same stale number — a literal agreeing with a literal. ATH-MIRROR-01 now reads the contract instead.
  internalTransferSourceAckValue: 4_000_000n,
  // Mirrors ATH_INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE, lowered 21M -> 8M on 2026-08-01 against the measurement in
  // COST-01 (worst observed forward fee 4,111,321 at a 250-cell payload). ATH-MIRROR-01 reads the contract.
  internalTransferFwdFeeAllowance: 8_000_000n,
  // Mirrors ATH_TRANSFER_NOTIFY_MIN_VALUE. Raised 30M -> 45M on 2026-07-20: at 30M a REFUSED registry purchase
  // refunded only 24,037,796, below the 26M that gate 14212 demands on arrival, so the buyer's ATH was stranded.
  transferNotifyMinValue: 45_000_000n,
  transferNotifyStorageEndowment: 20_000_000n,
  internalTransferExec: 2_000_000n,
  burnNotificationExec: 2_000_000n,
  transferNotifyExec: 7_000_000n,
  ownerRequestExec: 2_000_000n,
  notifyOwnerRequestExec: 10_000_000n,
});

const BOC_MAGIC = [0xb5, 0xee, 0x9c, 0x72];
function assertObject(value, name) {
  if (!value || typeof value !== 'object') throw new TypeError(`${name} must be an object`);
  return value;
}

function assertString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value;
}

function toBigInt(value, name) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'string' && /^-?[0-9]+$/.test(value.trim())) return BigInt(value.trim());
  if (typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value.trim())) return BigInt(value.trim());
  throw new TypeError(`${name} must be an integer`);
}

function assertUint(value, bitLength, name) {
  const bigint = toBigInt(value, name);
  if (bigint < 0n) throw new RangeError(`${name} must be unsigned`);
  if (bitLength < 1) throw new RangeError(`${name} bit length must be positive`);
  if (bigint >= (1n << BigInt(bitLength))) {
    throw new RangeError(`${name} does not fit uint${bitLength}`);
  }
  return bigint;
}

// EXPORTED alongside externalInMessageCell: a builder that serializes an external has to hand the transport the
// same base64 every other builder here does, and a private copy of a base64 encoder is a duplicate waiting to drift.
export function bytesToBase64(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (typeof Buffer !== 'undefined') return Buffer.from(input).toString('base64');
  let binary = '';
  for (const byte of input) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function bytesToHex(bytes) {
  return [...toUint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * A 256-bit hash (or any byte string) as a BigInt, WITHOUT Buffer.
 *
 * MEASURED 2026-08-03, from the owner's phone: the intro scan reported `Buffer is not defined` on every pass. Two
 * shipped browser modules built this value as `BigInt('0x' + Buffer.from(h).toString('hex'))` — and `Buffer` is a
 * Node global that browsers do not have. One of them is literally named `introBodyCommitBrowser`.
 *
 * The consequence was total and silent: the scan FOUND the intro, fetched the capsule, and then died verifying the
 * body commitment. First contact could never complete in a browser, while the sender saw every message publish. The
 * error went to console.warn — unreachable on a phone, which is the device it happened on.
 */
export function bytesToBigUint(bytes) {
  const hex = bytesToHex(bytes);
  return hex.length === 0 ? 0n : BigInt(`0x${hex}`);
}

function hexToBytes(value, length = null, name = 'hex bytes') {
  const text = String(value ?? '').trim();
  if (!/^[0-9a-fA-F]*$/.test(text) || text.length % 2 !== 0) {
    throw new TypeError(`${name} must be an even-length hex string`);
  }
  const out = new Uint8Array(text.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(text.slice(i * 2, i * 2 + 2), 16);
  if (length !== null && out.length !== length) throw new RangeError(`${name} must be ${length} bytes`);
  return out;
}

function base64ToBytes(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    throw new TypeError('Expected base64 string');
  }
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(value, 'base64'));
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function toUint8Array(value, name = 'bytes') {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new TypeError(`${name} must be a byte array`);
}

function assertBytes(value, length, name) {
  const bytes = toUint8Array(value, name);
  if (bytes.length !== length) throw new RangeError(`${name} must be ${length} bytes`);
  return bytes;
}

function bytesToBigInt(bytes) {
  let out = 0n;
  for (const byte of toUint8Array(bytes)) out = (out << 8n) | BigInt(byte);
  return out;
}

function bigintToBytes(value, length, name) {
  let bigint = assertUint(value, length * 8, name);
  const out = new Uint8Array(length);
  for (let i = length - 1; i >= 0; i -= 1) {
    out[i] = Number(bigint & 0xffn);
    bigint >>= 8n;
  }
  return out;
}

function hexUint(value, bitLength, name) {
  if (typeof value === 'string' && value.startsWith('0x')) return assertUint(value, bitLength, name);
  return assertUint(value, bitLength, name);
}

function minimalUintByteLength(value) {
  const bigint = toBigInt(value, 'byte length value');
  if (bigint < 0n) throw new RangeError('byte length value must be unsigned');
  let bytes = 1;
  while (bigint >= (1n << BigInt(bytes * 8))) bytes += 1;
  return bytes;
}

function writeBigUintBytes(value, byteLength, name) {
  return bigintToBytes(value, byteLength, name);
}

function concatBytes(...parts) {
  const arrays = parts.map((part) => toUint8Array(part));
  const size = arrays.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of arrays) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function uint16Bytes(value, name = 'uint16') {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new RangeError(`${name} must fit uint16`);
  }
  return new Uint8Array([(value >> 8) & 0xff, value & 0xff]);
}

// Defers to the ONE shared implementation [2026-08-28]: this used to wrap the ASYNCHRONOUS
// crypto.subtle.digest, whose per-call overhead is the whole cost on small inputs (MEASURED 16x on the shard
// derivation path). The async signature is kept so every caller stays unchanged.
async function sha256(bytes) {
  return sha256Sync(toUint8Array(bytes));
}

function writeBit(bytes, bitOffset, bit) {
  if (bit) bytes[bitOffset >> 3] |= 1 << (7 - (bitOffset & 7));
  return bitOffset + 1;
}

function readBit(bytes, bitOffset) {
  return (bytes[bitOffset >> 3] & (1 << (7 - (bitOffset & 7)))) !== 0;
}

function clearBit(bytes, bitOffset) {
  bytes[bitOffset >> 3] &= ~(1 << (7 - (bitOffset & 7)));
}

function signedWorkchainByte(workchain) {
  if (!Number.isInteger(workchain) || workchain < -128 || workchain > 127) {
    throw new RangeError('TON workchain must fit int8');
  }
  return workchain < 0 ? 0x100 + workchain : workchain;
}

function cellBitsDescriptor(bitLength) {
  return Math.floor(bitLength / 8) + Math.ceil(bitLength / 8);
}

function flattenCellTree(root) {
  const postorder = [];
  const seen = new WeakSet();
  const visit = (cell) => {
    if (seen.has(cell)) return;
    seen.add(cell);
    for (let index = cell.refs.length - 1; index >= 0; index -= 1) visit(cell.refs[index]);
    postorder.push(cell);
  };
  visit(root);
  const cells = postorder.reverse();
  const indexes = new WeakMap();
  cells.forEach((cell, index) => indexes.set(cell, index));
  return { cells, indexes };
}

function cellDataWithTerminator(cell) {
  const data = cell.data.slice();
  if (cell.bitLength % 8 !== 0) {
    writeBit(data, cell.bitLength, true);
  }
  return data;
}

function serializeCellForBoc(cell, indexes, sizeBytes) {
  if (cell.refs.length > 4) throw new Error('TON cell can have at most 4 refs');
  const data = cellDataWithTerminator(cell);
  const refs = cell.refs.map((ref) => writeBigUintBytes(indexes.get(ref), sizeBytes, 'cell ref index'));
  return concatBytes(
    new Uint8Array([cell.refs.length, cellBitsDescriptor(cell.bitLength)]),
    data,
    ...refs,
  );
}

export function serializeBoc(root) {
  const { cells, indexes } = flattenCellTree(root);
  const sizeBytes = minimalUintByteLength(cells.length);
  const payloads = cells.map((cell) => serializeCellForBoc(cell, indexes, sizeBytes));
  const totalCellsSize = payloads.reduce((sum, payload) => sum + payload.length, 0);
  const offsetBytes = minimalUintByteLength(totalCellsSize);
  return concatBytes(
    new Uint8Array(BOC_MAGIC),
    new Uint8Array([sizeBytes, offsetBytes]),
    writeBigUintBytes(cells.length, sizeBytes, 'BOC cells count'),
    writeBigUintBytes(1, sizeBytes, 'BOC roots count'),
    writeBigUintBytes(0, sizeBytes, 'BOC absent count'),
    writeBigUintBytes(totalCellsSize, offsetBytes, 'BOC total cells size'),
    writeBigUintBytes(0, sizeBytes, 'BOC root index'),
    ...payloads,
  );
}

export async function computeCellHashAndDepth(cell, cache = new WeakMap()) {
  const cached = cache.get(cell);
  if (cached) return cached;
  const refs = [];
  for (const ref of cell.refs) refs.push(await computeCellHashAndDepth(ref, cache));
  const depth = refs.length === 0 ? 0 : Math.max(...refs.map((ref) => ref.depth)) + 1;
  const repr = concatBytes(
    new Uint8Array([cell.refs.length, cellBitsDescriptor(cell.bitLength)]),
    cellDataWithTerminator(cell),
    ...refs.map((ref) => uint16Bytes(ref.depth, 'cell depth')),
    ...refs.map((ref) => ref.hash),
  );
  const result = { hash: await sha256(repr), depth };
  cache.set(cell, result);
  return result;
}

function readBigUintBytes(bytes, offset, byteLength, name) {
  if (offset + byteLength > bytes.length) throw new Error(`${name} is truncated`);
  let out = 0n;
  for (let i = 0; i < byteLength; i += 1) out = (out << 8n) | BigInt(bytes[offset + i]);
  return out;
}

export function parseBocBase64(value) {
  const bytes = base64ToBytes(assertString(value, 'BoC'));
  if (bytes.length < 10 || BOC_MAGIC.some((byte, index) => bytes[index] !== byte)) {
    throw new Error('Invalid BoC magic');
  }
  let offset = 4;
  const flags = bytes[offset]; offset += 1;
  const hasIndex = (flags & 0x80) !== 0;
  const hasCrc32 = (flags & 0x40) !== 0;
  const hasCacheBits = (flags & 0x20) !== 0;
  const bocFlags = (flags >> 3) & 0x03;
  const sizeBytes = flags & 0x07;
  const offsetBytes = bytes[offset]; offset += 1;
  if (hasCacheBits || bocFlags !== 0) throw new Error('Unsupported BoC flags');
  if (sizeBytes < 1 || sizeBytes > 4 || offsetBytes < 1 || offsetBytes > 4) {
    throw new Error('Unsupported BoC counter width');
  }
  const cellsCount = Number(readBigUintBytes(bytes, offset, sizeBytes, 'BOC cells count')); offset += sizeBytes;
  const rootsCount = Number(readBigUintBytes(bytes, offset, sizeBytes, 'BOC roots count')); offset += sizeBytes;
  const absentCount = Number(readBigUintBytes(bytes, offset, sizeBytes, 'BOC absent count')); offset += sizeBytes;
  const totalCellsSize = Number(readBigUintBytes(bytes, offset, offsetBytes, 'BOC total cells size')); offset += offsetBytes;
  if (rootsCount !== 1 || absentCount !== 0) throw new Error('Unsupported BoC root/absent count');
  const rootIndex = Number(readBigUintBytes(bytes, offset, sizeBytes, 'BOC root index')); offset += sizeBytes;
  if (hasIndex) {
    const indexBytes = cellsCount * offsetBytes;
    if (offset + indexBytes > bytes.length) throw new Error('BOC index table is truncated');
    offset += indexBytes;
  }
  const cellsStart = offset;
  const cellsEnd = cellsStart + totalCellsSize;
  const trailerBytes = hasCrc32 ? 4 : 0;
  if (cellsEnd + trailerBytes > bytes.length) throw new Error('BOC cells data is truncated');
  const parsed = [];
  for (let index = 0; index < cellsCount; index += 1) {
    if (offset + 2 > bytes.length) throw new Error('BOC cell descriptor is truncated');
    const d1 = bytes[offset]; offset += 1;
    const d2 = bytes[offset]; offset += 1;
    const refsCount = d1 & 0x07;
    if ((d1 & 0xf8) !== 0) throw new Error('Exotic or levelled cells are not supported');
    const dataLength = Math.ceil(d2 / 2);
    if (offset + dataLength > bytes.length) throw new Error('BOC cell data is truncated');
    let data = bytes.slice(offset, offset + dataLength); offset += dataLength;
    let bitLength = dataLength * 8;
    if (d2 % 2 !== 0) {
      let terminatorBit = -1;
      for (let bit = bitLength - 1; bit >= 0; bit -= 1) {
        if (readBit(data, bit)) {
          terminatorBit = bit;
          break;
        }
      }
      if (terminatorBit < 0) throw new Error('BOC non-byte-aligned cell is missing terminator bit');
      clearBit(data, terminatorBit);
      bitLength = terminatorBit;
      data = data.slice(0, Math.ceil(bitLength / 8));
    }
    const refIndexes = [];
    for (let ref = 0; ref < refsCount; ref += 1) {
      refIndexes.push(Number(readBigUintBytes(bytes, offset, sizeBytes, 'BOC cell ref index')));
      offset += sizeBytes;
    }
    parsed.push({ data, bitLength, refIndexes });
  }
  if (offset !== cellsEnd) throw new Error('BOC cell size mismatch');
  if (bytes.length !== cellsEnd + trailerBytes) throw new Error('BOC trailing data mismatch');
  const cells = parsed.map((cell) => ({ data: cell.data, bitLength: cell.bitLength, refs: [] }));
  for (let index = 0; index < parsed.length; index += 1) {
    cells[index].refs = parsed[index].refIndexes.map((refIndex) => {
      if (!cells[refIndex]) throw new Error('BOC cell ref index out of range');
      return cells[refIndex];
    });
  }
  if (!cells[rootIndex]) throw new Error('BOC root index out of range');
  return cells[rootIndex];
}

class TinyCellBuilder {
  constructor() {
    this.bytes = new Uint8Array(128);
    this.bitLength = 0;
    this.refs = [];
  }

  ensureBits(extraBits) {
    const requiredBytes = Math.ceil((this.bitLength + extraBits + 1) / 8);
    if (requiredBytes <= this.bytes.length) return;
    let size = this.bytes.length;
    while (size < requiredBytes) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.bytes);
    this.bytes = next;
  }

  uint(value, bitLength, name) {
    const bigint = assertUint(value, bitLength, name);
    this.ensureBits(bitLength);
    for (let shift = bitLength - 1; shift >= 0; shift -= 1) {
      const bit = ((bigint >> BigInt(shift)) & 1n) === 1n;
      this.bitLength = writeBit(this.bytes, this.bitLength, bit);
    }
    return this;
  }

  address(value, name) {
    const parsed = parseTonAddress(assertString(value, name));
    this.uint(2n, 2, `${name}.tag`);
    this.uint(0n, 1, `${name}.anycast`);
    this.uint(signedWorkchainByte(parsed.workchain), 8, `${name}.workchain`);
    for (const byte of parsed.hash) this.uint(byte, 8, `${name}.hash`);
    return this;
  }

  bytesValue(value, length, name) {
    const bytes = assertBytes(value, length, name);
    for (const byte of bytes) this.uint(byte, 8, name);
    return this;
  }

  ref(cell, name = 'ref') {
    if (!cell || !(cell.data instanceof Uint8Array) || !Array.isArray(cell.refs)) {
      throw new TypeError(`${name} must be a TON cell`);
    }
    if (this.refs.length >= 4) throw new RangeError('TON cell can have at most 4 refs');
    this.refs.push(cell);
    return this;
  }

  cell(cell, name = 'cell') {
    if (!cell || !(cell.data instanceof Uint8Array) || !Array.isArray(cell.refs)) {
      throw new TypeError(`${name} must be a TON cell`);
    }
    this.ensureBits(cell.bitLength);
    for (let offset = 0; offset < cell.bitLength; offset += 1) {
      const bit = (cell.data[offset >> 3] & (1 << (7 - (offset & 7)))) !== 0;
      this.bitLength = writeBit(this.bytes, this.bitLength, bit);
    }
    for (const ref of cell.refs) this.ref(ref, `${name}.ref`);
    return this;
  }

  coins(value, name = 'coins') {
    const amount = assertUint(value, 128, name);
    if (amount === 0n) return this.uint(0n, 4, `${name}.len`);
    const byteLength = minimalUintByteLength(amount);
    if (byteLength > 15) throw new RangeError(`${name} does not fit VarUInteger16`);
    this.uint(byteLength, 4, `${name}.len`);
    return this.bytesValue(bigintToBytes(amount, byteLength, name), byteLength, name);
  }

  /** TEP-74's `Maybe ^Cell`: ONE bit then the ref. Distinct from maybeRef, which serialises Maybe (Either …). */
  customPayloadMaybe(cell, name = 'custom_payload') {
    if (!cell) return this.uint(0n, 1, `${name}.none`);
    this.uint(1n, 1, `${name}.some`);
    return this.ref(cell, name);
  }

  maybeRef(cell, name = 'maybeRef') {
    if (!cell) return this.uint(0n, 1, `${name}.none`);
    this.uint(1n, 1, `${name}.some`);
    this.uint(1n, 1, `${name}.right`);
    return this.ref(cell, name);
  }

  endCell() {
    const dataBytesLength = Math.ceil(this.bitLength / 8);
    const data = this.bytes.slice(0, dataBytesLength);
    return { data, bitLength: this.bitLength, refs: [...this.refs] };
  }

  toBocBase64() {
    return bytesToBase64(serializeBoc(this.endCell()));
  }
}

function beginAthWalletBody(op) {
  return new TinyCellBuilder().uint(op, 32, 'op');
}

function beginUsernameRegistryBody(op) {
  return new TinyCellBuilder().uint(op, 32, 'op');
}

function beginProfileRegistryBody(op) {
  return new TinyCellBuilder().uint(op, 32, 'op');
}

export function beginCell() {
  return new TinyCellBuilder();
}

function normalizeUsernameBytes(username) {
  const value = assertString(username, 'username');
  const raw = value.toLowerCase().endsWith('.ath') ? value.slice(0, -4) : value;
  if (raw.length < 4 || raw.length > 16) throw new RangeError('username must be 4-16 ASCII chars');
  if (!/^[a-z0-9_-]+$/.test(raw)) {
    throw new RangeError('username must contain only lowercase ASCII letters, digits, underscores, or hyphens');
  }
  return new TextEncoder().encode(raw);
}

/** Mirrors ATH_INTERNAL_TRANSFER_ARRIVAL_MIN — what gate 14212 demands of an arriving ATHInternalTransfer. */
function athInternalTransferArrivalMin() {
  return ATH_WALLET_RESERVES_NANOTONS.internalTransferExec
    + ATH_WALLET_RESERVES_NANOTONS.internalTransferAckValue
    + ATH_WALLET_RESERVES_NANOTONS.internalTransferSourceAckValue
    + ATH_WALLET_RESERVES_NANOTONS.transferNotifyStorageEndowment;
}

function athNotifyTransferValue(notifyValue) {
  return assertUint(notifyValue, 128, 'notify_value')
    + ATH_WALLET_RESERVES_NANOTONS.transferNotifyAckValue
    + ATH_WALLET_RESERVES_NANOTONS.internalTransferSourceAckValue
    + ATH_WALLET_RESERVES_NANOTONS.transferNotifyExec
    + ATH_WALLET_RESERVES_NANOTONS.transferNotifyStorageEndowment;
}

export function estimateAthWalletAttachedValueNanotons(type, params = {}) {
  assertString(type, 'type');
  if (type === 'JettonTransfer') {
    // Gate 14704, term for term:
    //   required = OWNER_REQUEST_EXEC + arrival_min + INTERNAL_TRANSFER_FWD_FEE_ALLOWANCE
    // with arrival_min, for a forwarding transfer, being
    //   forward + SOURCE_ACK + NOTIFY_EXEC + NOTIFY_STORAGE_ENDOWMENT + readForwardFee(this very message).
    // readForwardFee is the fee of the owner's OWN message, which a client cannot compute — so it is covered by a
    // second internalTransferFwdFeeAllowance. That is the contract's own name for this class of fee on this lane,
    // and the payload here is empty, so 8,000,000 is orders of magnitude of headroom rather than a guess. The
    // excess is not lost: the wallet refunds the owner's change on the same hop.
    const forward = assertUint(params.forward_ton_amount, 128, 'forward_ton_amount');
    return ATH_WALLET_RESERVES_NANOTONS.ownerRequestExec
      + forward
      + ATH_WALLET_RESERVES_NANOTONS.internalTransferSourceAckValue
      + ATH_WALLET_RESERVES_NANOTONS.transferNotifyExec
      + ATH_WALLET_RESERVES_NANOTONS.transferNotifyStorageEndowment
      + ATH_WALLET_RESERVES_NANOTONS.internalTransferFwdFeeAllowance
      + ATH_WALLET_RESERVES_NANOTONS.internalTransferFwdFeeAllowance;
  }
  if (type === 'ATHTransferRequest') {
    // [CORRECTED 2026-08-01] This restated gate 14204 term by term and inherited its omission: the contract's
    // ARRIVAL floor includes internalTransferSourceAckValue and this sum did not. It matched only because the old
    // 21,000,000 forward allowance was fat enough to absorb the missing 4,000,000. When that allowance came down to
    // its measured size the quote fell to 35,000,000 against a 39,000,000 gate — every transfer from the app would
    // have been refused. Composed the way the contract composes it: owner exec + arrival floor + forward allowance.
    return ATH_WALLET_RESERVES_NANOTONS.ownerRequestExec
      + athInternalTransferArrivalMin()
      + ATH_WALLET_RESERVES_NANOTONS.internalTransferFwdFeeAllowance;
  }
  if (type === 'ATHBurn') {
    return ATH_WALLET_RESERVES_NANOTONS.burnNotificationExec
      + ATH_WALLET_RESERVES_NANOTONS.ownerRequestExec;
  }
  if (type === 'ATHTransferRequestWithNotify') {
    const notifyValue = params.notify_value ?? ATH_WALLET_RESERVES_NANOTONS.transferNotifyMinValue;
    return athNotifyTransferValue(notifyValue)
      + ATH_WALLET_RESERVES_NANOTONS.notifyOwnerRequestExec;
  }
  throw new Error(`Unsupported ATHWallet message type ${type}`);
}

const PUBLIC_SIZE_CLASSES = Object.freeze([1, 2, 4, 8, 16, 32]);

function normalizePublicSizeClass(value, name = 'public size_class') {
  const sizeClass = Number(toBigInt(value ?? VAULT_SIZE_CLASS.STANDARD, name));
  if (!PUBLIC_SIZE_CLASSES.includes(sizeClass)) {
    throw new RangeError(`${name} must be one of ${PUBLIC_SIZE_CLASSES.join(', ')}`);
  }
  return BigInt(sizeClass);
}

function publicSizeClassForBodyBytes(byteLength) {
  const length = Number(byteLength);
  if (!Number.isFinite(length) || length <= 0) return VAULT_SIZE_CLASS.STANDARD;
  for (const sizeClass of PUBLIC_SIZE_CLASSES) {
    if (length <= sizeClass * 1024) return BigInt(sizeClass);
  }
  throw new RangeError(`public body exceeds ${PUBLIC_POST_BODY_MAX_BYTES} bytes`);
}

function publicUsefulBytesForSizeClass(sizeClass) {
  return Number(normalizePublicSizeClass(sizeClass)) * 1024;
}

// EXPORTED so the M21C vault door builds its externals with the SAME envelope every other external here uses
// (web/fee-vault.mjs). A second hand-rolled copy of this header is a class of bug this repo has already paid for.
export function externalInMessageCell(destinationAddress, bodyCell) {
  return beginCell()
    .uint(2n, 2, 'ext_in_msg_info.tag')
    .uint(0n, 2, 'ext_in_msg_info.src_none')
    .address(destinationAddress, 'ext_in_msg_info.dest')
    .coins(0n, 'ext_in_msg_info.import_fee')
    .uint(0n, 1, 'external.init_none')
    .uint(1n, 1, 'external.body_ref')
    .ref(bodyCell, 'external.body')
    .endCell();
}

export function buildAthWalletMessageBody(type, params = {}) {
  assertObject(params, 'params');
  switch (type) {
    case 'JettonTransfer':
      // Layout is TEP-74's, which the frozen wallet implements verbatim: custom_payload is a maybe-ref and
      // forward_payload is `Slice as remaining`, so an empty one appends nothing at all.
      return beginAthWalletBody(ATH_WALLET_OPS.JettonTransfer)
        .uint(params.query_id, 64, 'query_id')
        .coins(params.amount, 'amount')
        .address(params.destination, 'destination')
        .address(params.response_destination, 'response_destination')
        // ONE bit, not two. `maybeRef` writes `some` + `right` because its other caller (platho-wallet.mjs) is
        // serialising a `Maybe (Either X ^X)`; TEP-74's custom_payload is a plain `Maybe ^Cell`, which ATHWallet
        // declares as `custom_payload: Cell?`. Using maybeRef here left an extra set bit in the body, and the
        // frozen wallet then read the following coins field off by one — MEASURED as exit 9, cell underflow,
        // aborted. Harmless today only because every caller passes null (which maybeRef also writes as one bit),
        // so the defect waited for the first non-null payload.
        .customPayloadMaybe(params.custom_payload ?? null)
        .coins(params.forward_ton_amount, 'forward_ton_amount')
        .toBocBase64();
    case 'ATHTransferRequest':
      return beginAthWalletBody(ATH_WALLET_OPS.ATHTransferRequest)
        .uint(params.query_id, 64, 'query_id')
        .uint(params.amount, 128, 'amount')
        .address(params.recipient, 'recipient')
        .address(params.response_destination, 'response_destination')
        .toBocBase64();
    case 'ATHTransferRequestWithNotify':
      return beginAthWalletBody(ATH_WALLET_OPS.ATHTransferRequestWithNotify)
        .uint(params.query_id, 64, 'query_id')
        .uint(params.amount, 128, 'amount')
        .address(params.recipient, 'recipient')
        .address(params.response_destination, 'response_destination')
        .ref(beginCell()
          .address(params.notify_destination, 'notify_destination')
          .uint(params.notify_value, 128, 'notify_value')
          .endCell(), 'notify_ref')
        .toBocBase64();
    case 'ATHBurn':
      return beginAthWalletBody(ATH_WALLET_OPS.ATHBurn)
        .uint(params.query_id, 64, 'query_id')
        .uint(params.amount, 128, 'amount')
        .address(params.response_destination, 'response_destination')
        .toBocBase64();
    // clean-17 direct-pay avatar: the buyer's own ATH wallet is asked to send 100 ATH to ProfileRegistry's ATH
    // wallet, carrying the avatar pointer fields. Layout mirrors ATHMaster's storeATHTransferRequestRegistryProfileAvatar
    // EXACTLY — root: op|query_id|amount|recipient|response_destination|notify_value, then a REF with
    // owner_wallet|avatar_hash(256)|avatar_entry_id(64)|avatar_stream_id(128)|avatar_part_count(16)|media_format(8).
    case 'ATHTransferRequestRegistryProfileAvatar':
      return beginAthWalletBody(ATH_WALLET_OPS.ATHTransferRequestRegistryProfileAvatar)
        .uint(params.query_id, 64, 'query_id')
        .uint(params.amount, 128, 'amount')
        .address(params.recipient, 'recipient')
        .address(params.response_destination, 'response_destination')
        .uint(params.notify_value, 128, 'notify_value')
        .ref(beginCell()
          .address(params.owner_wallet, 'owner_wallet')
          .uint(params.avatar_hash, 256, 'avatar_hash')
          .uint(params.avatar_entry_id, 64, 'avatar_entry_id')
          .uint(params.avatar_stream_id, 128, 'avatar_stream_id')
          .uint(params.avatar_part_count, 16, 'avatar_part_count')
          .uint(params.media_format, 8, 'media_format')
          .endCell(), 'avatar_ref')
        .toBocBase64();
    // clean-17 DIRECT-PAY username mint: the user's OWN ATH wallet pays the UsernameRegistry directly (Vault-independent
    // by design — UsernameRegistry.tact:588). Layout mirrors the compiled storeATHTransferRequestRegistryMintUsername
    // EXACTLY — root: op|query_id|amount|recipient|response_destination|notify_value, then a REF with
    // owner_wallet|username_len(8)|username(remaining ASCII bytes). `username` is the raw lowercase-ASCII byte array.
    case 'ATHTransferRequestRegistryMintUsername': {
      const usernameBytes = params.username instanceof Uint8Array ? params.username : new Uint8Array(params.username ?? []);
      return beginAthWalletBody(ATH_WALLET_OPS.ATHTransferRequestRegistryMintUsername)
        .uint(params.query_id, 64, 'query_id')
        .uint(params.amount, 128, 'amount')
        .address(params.recipient, 'recipient')
        .address(params.response_destination, 'response_destination')
        .uint(params.notify_value, 128, 'notify_value')
        .ref(beginCell()
          .address(params.owner_wallet, 'owner_wallet')
          .uint(BigInt(usernameBytes.length), 8, 'username_len')
          .bytesValue(usernameBytes, usernameBytes.length, 'username')
          .endCell(), 'mint_ref')
        .toBocBase64();
    }
    default:
      throw new Error(`Unsupported ATHWallet message type ${type}`);
  }
}

export function buildUsernameRegistryMessageBody(type, params = {}) {
  assertObject(params, 'params');
  switch (type) {
    case 'FlushBurnAthDue':
      return beginUsernameRegistryBody(USERNAME_REGISTRY_OPS.FlushBurnAthDue)
        .uint(params.query_id, 64, 'query_id')
        .toBocBase64();
    default:
      throw new Error(`Unsupported UsernameRegistry message type ${type}`);
  }
}

export function buildProfileRegistryMessageBody(type, params = {}) {
  assertObject(params, 'params');
  switch (type) {
    case 'FlushProfileBurnAthDue':
      return beginProfileRegistryBody(PROFILE_REGISTRY_OPS.FlushProfileBurnAthDue)
        .uint(params.query_id, 64, 'query_id')
        .toBocBase64();
    default:
      throw new Error(`Unsupported ProfileRegistry message type ${type}`);
  }
}

export function createAthWalletMessage(type, params = {}, options = {}) {
  const address = assertString(options.athWalletAddress, 'athWalletAddress');
  const amount = options.valueNanotons !== undefined
    ? assertUint(options.valueNanotons, 128, 'valueNanotons')
    : estimateAthWalletAttachedValueNanotons(type, params);
  return {
    address,
    amount: amount.toString(),
    payload: buildAthWalletMessageBody(type, params),
  };
}

export function createUsernameRegistryMessage(type, params = {}, options = {}) {
  const address = assertString(options.usernameRegistryAddress, 'usernameRegistryAddress');
  const amount = options.valueNanotons !== undefined
    ? assertUint(options.valueNanotons, 128, 'valueNanotons')
    : REGISTRY_BURN_FLUSH_MESSAGE_VALUE_NANOTONS;
  return {
    address,
    amount: amount.toString(),
    payload: buildUsernameRegistryMessageBody(type, params),
  };
}

export function createProfileRegistryMessage(type, params = {}, options = {}) {
  const address = assertString(options.profileRegistryAddress, 'profileRegistryAddress');
  const amount = options.valueNanotons !== undefined
    ? assertUint(options.valueNanotons, 128, 'valueNanotons')
    : REGISTRY_BURN_FLUSH_MESSAGE_VALUE_NANOTONS;
  return {
    address,
    amount: amount.toString(),
    payload: buildProfileRegistryMessageBody(type, params),
  };
}

export function createWalletTransaction(messages, options = {}) {
  const validUntil = options.validUntil
    ?? Math.floor((options.nowMs ?? Date.now()) / 1000) + (options.ttlSeconds ?? 300);
  return {
    validUntil,
    messages: Array.isArray(messages) ? messages : [messages],
  };
}

function publishHashValue(value, name) {
  return hexUint(value, 256, name);
}

function publishCellFromPayload(payload, name) {
  if (!payload || typeof payload !== 'object') throw new TypeError(`${name} must be an on-chain payload object`);
  return parseBocBase64(payload.boc);
}

function publicTextBytes(input, maxBytes, name = 'public text') {
  const text = typeof input === 'string' ? input : String(input ?? '');
  const bytes = new TextEncoder().encode(text);
  if (bytes.length === 0) throw new RangeError(`${name} must not be empty`);
  if (bytes.length > maxBytes) throw new RangeError(`${name} exceeds ${maxBytes} bytes`);
  return { text, bytes };
}

function publicParentHashBytes(value) {
  if (value instanceof Uint8Array || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return assertBytes(value, 32, 'parent_hash');
  }
  if (typeof value === 'bigint' || typeof value === 'number') {
    return bigintToBytes(value, 32, 'parent_hash');
  }
  if (typeof value === 'string') {
    const text = value.trim().startsWith('0x') ? value.trim().slice(2) : value.trim();
    return hexToBytes(text, 32, 'parent_hash');
  }
  throw new TypeError('parent_hash is required for public comments');
}

function publicStreamIdBytes(input) {
  const value = input && typeof input === 'object' && !ArrayBuffer.isView(input) && !(input instanceof ArrayBuffer)
    ? (input.streamId ?? input.stream_id)
    : null;
  if (value instanceof Uint8Array || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return assertBytes(value, 16, 'public stream_id');
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const text = value.trim().startsWith('0x') ? value.trim().slice(2) : value.trim();
    return hexToBytes(text, 16, 'public stream_id');
  }
  return randomBytes(16);
}

function publicPartNumber(value, name) {
  const bigint = assertUint(value, 16, name);
  const number = Number(bigint);
  if (!Number.isSafeInteger(number)) throw new RangeError(`${name} is too large`);
  return number;
}

function publicPayloadKind(input) {
  if (input && typeof input === 'object' && !ArrayBuffer.isView(input) && !(input instanceof ArrayBuffer)) {
    const type = String(input.type ?? input.kind ?? 'post').toLowerCase();
    if (type === 'comment' || Number(input.kind) === PUBLIC_BODY_KIND.COMMENT) return PUBLIC_BODY_KIND.COMMENT;
    if (type === 'image_comment' || type === 'comment_image' || Number(input.kind) === PUBLIC_BODY_KIND.IMAGE_COMMENT) return PUBLIC_BODY_KIND.IMAGE_COMMENT;
    if (type === 'image' || type === 'image_post' || type === 'post_image' || Number(input.kind) === PUBLIC_BODY_KIND.IMAGE_POST) return PUBLIC_BODY_KIND.IMAGE_POST;
    if (type === 'avatar' || type === 'profile_avatar' || Number(input.kind) === PUBLIC_BODY_KIND.AVATAR) return PUBLIC_BODY_KIND.AVATAR;
    if (type === 'document_comment' || type === 'comment_document' || Number(input.kind) === PUBLIC_BODY_KIND.DOCUMENT_COMMENT) return PUBLIC_BODY_KIND.DOCUMENT_COMMENT;
    if (type === 'document' || type === 'document_post' || type === 'post_document' || Number(input.kind) === PUBLIC_BODY_KIND.DOCUMENT_POST) return PUBLIC_BODY_KIND.DOCUMENT_POST;
  }
  return PUBLIC_BODY_KIND.POST;
}

function publicCommentsAllowed(input) {
  if (!input || typeof input !== 'object' || ArrayBuffer.isView(input) || input instanceof ArrayBuffer) return true;
  if (input.commentsAllowed === false || input.comments_allowed === false) return false;
  const value = String(input.comments ?? '').toLowerCase();
  if (['disabled', 'closed', 'off', 'false', '0'].includes(value)) return false;
  return true;
}

function publicCreatedAtSeconds(input) {
  if (!input || typeof input !== 'object' || ArrayBuffer.isView(input) || input instanceof ArrayBuffer) return 0;
  const direct = input.createdAtSec ?? input.created_at_sec;
  if (direct !== undefined && direct !== null) return Number(assertUint(direct, 32, 'public created_at_sec'));
  const ms = input.createdAtMs ?? input.created_at_ms;
  if (ms !== undefined && ms !== null) {
    const value = Number(ms);
    if (!Number.isFinite(value) || value < 0) throw new RangeError('public createdAtMs must be non-negative');
    return Number(assertUint(Math.floor(value / 1000), 32, 'public created_at_sec'));
  }
  const createdAt = input.createdAt ?? input.created_at;
  if (createdAt !== undefined && createdAt !== null && String(createdAt).trim()) {
    const parsed = Date.parse(String(createdAt));
    if (!Number.isFinite(parsed) || parsed < 0) throw new RangeError('public createdAt must be a valid date');
    return Number(assertUint(Math.floor(parsed / 1000), 32, 'public created_at_sec'));
  }
  return 0;
}

function publicProfilePointerBytes(input) {
  const profileVersion = input && typeof input === 'object' && !ArrayBuffer.isView(input) && !(input instanceof ArrayBuffer)
    ? (input.profileVersion ?? input.profile_version ?? 0)
    : 0;
  const avatarHash = input && typeof input === 'object' && !ArrayBuffer.isView(input) && !(input instanceof ArrayBuffer)
    ? (input.avatarHash ?? input.avatar_hash ?? 0n)
    : 0n;
  return concatBytes(
    bigintToBytes(assertUint(profileVersion, 32, 'profile_version'), 4, 'profile_version'),
    bigintToBytes(assertUint(avatarHash, 256, 'avatar_hash'), 32, 'avatar_hash'),
  );
}

function publicHeaderBytes(input) {
  const magic = new TextEncoder().encode(PUBLIC_HEADER_MAGIC);
  const kind = publicPayloadKind(input);
  const streamId = publicStreamIdBytes(input);
  const partIndex = publicPartNumber(input?.partIndex ?? input?.part_index ?? 0, 'public part index');
  const partCount = publicPartNumber(input?.partCount ?? input?.part_count ?? 1, 'public part count');
  const createdAtSec = publicCreatedAtSeconds(input);
  const isImage = kind === PUBLIC_BODY_KIND.IMAGE_POST || kind === PUBLIC_BODY_KIND.IMAGE_COMMENT;
  const isDocument = kind === PUBLIC_BODY_KIND.DOCUMENT_POST || kind === PUBLIC_BODY_KIND.DOCUMENT_COMMENT;
  const mediaFormat = isImage
    ? Number(input?.mediaFormat ?? input?.media_format ?? input?.format ?? PUBLIC_BODY_MEDIA_FORMATS.WEBP)
    : PUBLIC_BODY_MEDIA_FORMATS.NONE;
  if (partCount <= 0 || partIndex >= partCount) throw new RangeError('public part index mismatch');
  const partBytes = concatBytes(
    streamId,
    bigintToBytes(BigInt(partIndex), 2, 'part_index'),
    bigintToBytes(BigInt(partCount), 2, 'part_count'),
    bigintToBytes(BigInt(createdAtSec), 4, 'created_at_sec'),
  );
  const profileBytes = publicProfilePointerBytes(input);
  if (kind === PUBLIC_BODY_KIND.POST) {
    const flags = publicCommentsAllowed(input) ? 0 : PUBLIC_BODY_FLAGS.COMMENTS_DISABLED;
    return concatBytes(
      magic,
      new Uint8Array([PUBLIC_BODY_VERSION, PUBLIC_BODY_KIND.POST, flags, PUBLIC_BODY_MEDIA_FORMATS.NONE]),
      partBytes,
      profileBytes,
    );
  }
  if (kind === PUBLIC_BODY_KIND.IMAGE_POST) {
    const flags = publicCommentsAllowed(input) ? 0 : PUBLIC_BODY_FLAGS.COMMENTS_DISABLED;
    return concatBytes(
      magic,
      new Uint8Array([PUBLIC_BODY_VERSION, PUBLIC_BODY_KIND.IMAGE_POST, flags, mediaFormat]),
      partBytes,
      profileBytes,
    );
  }
  if (kind === PUBLIC_BODY_KIND.DOCUMENT_POST) {
    const flags = publicCommentsAllowed(input) ? 0 : PUBLIC_BODY_FLAGS.COMMENTS_DISABLED;
    return concatBytes(
      magic,
      new Uint8Array([PUBLIC_BODY_VERSION, PUBLIC_BODY_KIND.DOCUMENT_POST, flags, PUBLIC_BODY_MEDIA_FORMATS.NONE]),
      partBytes,
      profileBytes,
    );
  }
  if (kind === PUBLIC_BODY_KIND.AVATAR) {
    return concatBytes(
      magic,
      new Uint8Array([PUBLIC_BODY_VERSION, PUBLIC_BODY_KIND.AVATAR, 0, mediaFormat || PUBLIC_BODY_MEDIA_FORMATS.WEBP]),
      partBytes,
      profileBytes,
    );
  }

  const object = assertObject(input, 'public comment');
  const parentEntryId = bigintToBytes(object.parentEntryId ?? object.parent_entry_id, 8, 'parent_entry_id');
  const parentHash = publicParentHashBytes(object.parentHash ?? object.parent_hash);
  const commentKind = kind === PUBLIC_BODY_KIND.IMAGE_COMMENT
    ? PUBLIC_BODY_KIND.IMAGE_COMMENT
    : (isDocument ? PUBLIC_BODY_KIND.DOCUMENT_COMMENT : PUBLIC_BODY_KIND.COMMENT);
  return concatBytes(
    magic,
    new Uint8Array([PUBLIC_BODY_VERSION, commentKind, 0, mediaFormat]),
    partBytes,
    parentEntryId,
    parentHash,
  );
}

function publicBodyBytes(input) {
  const kind = publicPayloadKind(input);
  if (kind === PUBLIC_BODY_KIND.POST) {
    const value = input && typeof input === 'object' && !ArrayBuffer.isView(input) && !(input instanceof ArrayBuffer)
      ? input.text
      : input;
    return publicTextBytes(value, PUBLIC_POST_TEXT_MAX_BYTES, 'public post text').bytes;
  }
  if (kind === PUBLIC_BODY_KIND.DOCUMENT_POST || kind === PUBLIC_BODY_KIND.DOCUMENT_COMMENT) {
    const bytes = toUint8Array(input?.bytes ?? input?.documentBytes ?? input?.document_bytes ?? new Uint8Array(), 'public document bytes');
    if (bytes.length > PUBLIC_POST_BODY_MAX_BYTES) throw new RangeError('public document bytes exceed public body cap');
    return bytes;
  }
  if (kind === PUBLIC_BODY_KIND.IMAGE_POST || kind === PUBLIC_BODY_KIND.IMAGE_COMMENT || kind === PUBLIC_BODY_KIND.AVATAR) {
    const bytes = toUint8Array(input?.bytes ?? input?.imageBytes ?? input?.image_bytes ?? new Uint8Array(), 'public image bytes');
    if (bytes.length > PUBLIC_POST_BODY_MAX_BYTES) throw new RangeError('public image bytes exceed public body cap');
    return bytes;
  }

  const object = assertObject(input, 'public comment');
  return publicTextBytes(object.text, PUBLIC_COMMENT_TEXT_MAX_BYTES, 'public comment text').bytes;
}

export function snakeCellFromBytes(bytes, chunkName = 'snake chunk') {
  let tail = null;
  for (let offset = bytes.length; offset > 0;) {
    const start = Math.max(0, offset - 127);
    const builder = beginCell().bytesValue(bytes.slice(start, offset), offset - start, chunkName);
    if (tail) builder.ref(tail, 'snake tail');
    tail = builder.endCell();
    offset = start;
  }
  return tail ?? beginCell().endCell();
}

export function readSnakeCellBytes(payload, options = {}) {
  const maxBytes = options.maxBytes ?? Number.MAX_SAFE_INTEGER;
  const name = options.name ?? 'snake cell';
  const root = typeof payload === 'string'
    ? parseBocBase64(payload)
    : payload?.boc
      ? parseBocBase64(payload.boc)
      : payload;
  if (!root || !(root.data instanceof Uint8Array) || !Array.isArray(root.refs)) {
    throw new TypeError(`${name} must be a TON cell or BoC payload`);
  }
  const chunks = [];
  const seen = new Set();
  let cell = root;
  while (cell) {
    if (seen.has(cell)) throw new Error(`${name} has a cycle`);
    seen.add(cell);
    if (cell.bitLength % 8 !== 0) throw new Error(`${name} must be byte-aligned`);
    if (cell.refs.length > 1) throw new Error(`${name} can have at most one ref per chunk`);
    chunks.push(cell.data.slice(0, cell.bitLength / 8));
    cell = cell.refs[0] ?? null;
  }
  const bytes = concatBytes(...chunks);
  if (bytes.length > maxBytes) throw new RangeError(`${name} exceeds ${maxBytes} bytes`);
  return bytes;
}

function pqKemPubkeyCellFromParams(params) {
  const pqLen = params.pq_kem_pubkey_len === undefined
    ? 0n
    : assertUint(params.pq_kem_pubkey_len, 16, 'pq_kem_pubkey_len');
  const value = params.pq_kem_pubkey ?? params.pqKemPubkey ?? params.pq_kem_pubkey_cell ?? params.pqKemPubkeyCell;
  if (pqLen === 0n) {
    if (value === undefined || value === null) return beginCell().endCell();
    const bytes = (value?.data instanceof Uint8Array && Array.isArray(value.refs)) || value?.boc || typeof value === 'string'
      ? readSnakeCellBytes(value, { maxBytes: 0, name: 'pq_kem_pubkey' })
      : toUint8Array(value, 'pq_kem_pubkey');
    if (bytes.length !== 0) throw new RangeError('pq_kem_pubkey must be empty for classical-v1');
    return beginCell().endCell();
  }
  if (pqLen !== BigInt(MLKEM768_PUBLIC_KEY_BYTES)) {
    throw new RangeError(`pq_kem_pubkey_len must be ${MLKEM768_PUBLIC_KEY_BYTES} for hybrid-v1`);
  }
  if (value === undefined || value === null) throw new TypeError('pq_kem_pubkey is required for hybrid-v1');
  if (value?.data instanceof Uint8Array && Array.isArray(value.refs)) {
    const bytes = readSnakeCellBytes(value, { maxBytes: MLKEM768_PUBLIC_KEY_BYTES, name: 'pq_kem_pubkey' });
    if (bytes.length !== MLKEM768_PUBLIC_KEY_BYTES) {
      throw new RangeError(`pq_kem_pubkey must be ${MLKEM768_PUBLIC_KEY_BYTES} bytes`);
    }
    return value;
  }
  if (value?.boc || typeof value === 'string') {
    const cell = parseBocBase64(value.boc ?? value);
    const bytes = readSnakeCellBytes(cell, { maxBytes: MLKEM768_PUBLIC_KEY_BYTES, name: 'pq_kem_pubkey' });
    if (bytes.length !== MLKEM768_PUBLIC_KEY_BYTES) {
      throw new RangeError(`pq_kem_pubkey must be ${MLKEM768_PUBLIC_KEY_BYTES} bytes`);
    }
    return cell;
  }
  const bytes = assertBytes(value, MLKEM768_PUBLIC_KEY_BYTES, 'pq_kem_pubkey');
  return snakeCellFromBytes(bytes, 'pq_kem_pubkey chunk');
}

export async function createPublicPostPayload(input, options = {}) {
  const headerBytes = publicHeaderBytes(input);
  const bodyBytes = publicBodyBytes(input);
  const sizeClass = normalizePublicSizeClass(
    options.sizeClass ?? options.size_class ?? publicSizeClassForBodyBytes(bodyBytes.length),
    'public payload size_class',
  );
  const maxBytes = options.maxBytes ?? publicUsefulBytesForSizeClass(sizeClass);
  if (bodyBytes.length > maxBytes) {
    throw new RangeError(`public body exceeds ${maxBytes} bytes`);
  }
  const headerCell = snakeCellFromBytes(headerBytes, 'public header chunk');
  const bodyCell = snakeCellFromBytes(bodyBytes, 'public body chunk');
  const { hash: headerHashBytes } = await computeCellHashAndDepth(headerCell);
  const { hash: bodyHashBytes } = await computeCellHashAndDepth(bodyCell);
  const headerHash = `0x${bytesToHex(headerHashBytes)}`;
  const bodyHash = `0x${bytesToHex(bodyHashBytes)}`;
  const headerBoc = bytesToBase64(serializeBoc(headerCell));
  const bodyBoc = bytesToBase64(serializeBoc(bodyCell));
  const parsed = readPublicBodyBytes(headerBytes, bodyBytes);
  return {
    layout: PUBLIC_BODY_LAYOUT,
    kind: parsed.kind,
    type: parsed.type,
    // clean-11 history: a channel-PROFILE post set reserved bit0 (is_profile) on the retired Vault batch wire so
    // the contract threaded it into the global profile chain. The wire is gone; the field survives here because
    // V1 payload READERS still surface it for old locally-cached posts.
    is_profile: input.is_profile === true,
    headerBytes: headerBytes.length,
    bodyBytes: bodyBytes.length,
    bytes: bodyBytes.length,
    sizeClass,
    size_class: sizeClass,
    usefulBytes: publicUsefulBytesForSizeClass(sizeClass),
    headerHash,
    header_hash: headerHash,
    bodyHash,
    body_hash: bodyHash,
    headerBoc,
    header_boc: headerBoc,
    bodyBoc,
    body_boc: bodyBoc,
    header_cell: { hash: headerHash, boc: headerBoc, bytes: headerBytes.length },
    body_cell: { hash: bodyHash, boc: bodyBoc, bytes: bodyBytes.length },
    // Surface the comment parent so the part builder sets parent_link (0 for posts) → the contract indexes a
    // comment under its parent, not as a top-level post. Sourced from the parsed header (undefined for posts).
    parentEntryId: parsed.parentEntryId,
    parent_entry_id: parsed.parent_entry_id,
    parentHash: parsed.parentHash,
    parent_hash: parsed.parent_hash,
  };
}

export const tonCell = Object.freeze({
  beginCell,
  snakeCellFromBytes,
  serializeBoc,
  parseBocBase64,
  computeCellHashAndDepth,
  readSnakeCellBytes,
  bytesToBase64,
  base64ToBytes,
  bytesToHex,
  hexToBytes,
  bytesToBigInt,
  bigintToBytes,
  concatBytes,
});

function readPublicBodyBytes(headerBytes, bodyBytes) {
  const header = toUint8Array(headerBytes, 'public header bytes');
  const data = toUint8Array(bodyBytes, 'public body bytes');
  const magic = new TextDecoder().decode(header.slice(0, 4));
  if (magic !== PUBLIC_HEADER_MAGIC) throw new Error('Unsupported public header magic');
  if (header[4] !== PUBLIC_BODY_VERSION) throw new Error('Unsupported public header version');
  const kind = header[5];
  const flags = header[6];
  const mediaFormat = header[7];

  const readMultipart = () => {
    const streamId = header.slice(8, 24);
    const partIndex = Number(readBigUintBytes(header, 24, 2, 'part_index'));
    const partCount = Number(readBigUintBytes(header, 26, 2, 'part_count'));
    if (partCount <= 0 || partIndex >= partCount) throw new Error('Public part index mismatch');
    const createdAtSec = Number(readBigUintBytes(header, 28, 4, 'created_at_sec'));
    return {
      streamId,
      stream_id: `0x${bytesToHex(streamId)}`,
      partIndex,
      part_index: partIndex,
      partCount,
      part_count: partCount,
      createdAtSec,
      created_at_sec: createdAtSec,
    };
  };
  const readProfilePointer = () => {
    if (header.length !== PUBLIC_POST_HEADER_BYTES) throw new Error('Public profile pointer header length mismatch');
    const profileVersion = Number(readBigUintBytes(header, 32, 4, 'profile_version'));
    const avatarHashBytes = header.slice(36, 68);
    return {
      profileVersion,
      profile_version: profileVersion,
      avatarHash: `0x${bytesToHex(avatarHashBytes)}`,
      avatar_hash: `0x${bytesToHex(avatarHashBytes)}`,
    };
  };

  if (kind === PUBLIC_BODY_KIND.POST) {
    if (header.length !== PUBLIC_POST_HEADER_BYTES) throw new Error('Public post header length mismatch');
    if (mediaFormat !== PUBLIC_BODY_MEDIA_FORMATS.NONE) throw new Error('Unsupported public post media format');
    if ((flags & ~PUBLIC_BODY_FLAGS.COMMENTS_DISABLED) !== 0) throw new Error('Unsupported public post body flags');
    const part = readMultipart();
    const profile = readProfilePointer();
    return {
      layout: PUBLIC_BODY_LAYOUT,
      kind,
      type: 'post',
      headerBytes: header.length,
      bodyBytes: data.length,
      bytes: data.length,
      header,
      data,
      flags,
      ...part,
      ...profile,
      commentsAllowed: (flags & PUBLIC_BODY_FLAGS.COMMENTS_DISABLED) === 0,
      comments_allowed: (flags & PUBLIC_BODY_FLAGS.COMMENTS_DISABLED) === 0,
      textBytes: data,
      text: new TextDecoder().decode(data),
    };
  }

  if (kind === PUBLIC_BODY_KIND.COMMENT) {
    if (header.length !== PUBLIC_COMMENT_HEADER_BYTES) throw new Error('Public comment header length mismatch');
    if (mediaFormat !== PUBLIC_BODY_MEDIA_FORMATS.NONE) throw new Error('Unsupported public comment media format');
    if (flags !== 0) throw new Error('Unsupported public comment body flags');
    const part = readMultipart();
    const parentEntryId = readBigUintBytes(header, 32, 8, 'parent_entry_id');
    const parentHashBytes = header.slice(40, 72);
    return {
      layout: PUBLIC_BODY_LAYOUT,
      kind,
      type: 'comment',
      headerBytes: header.length,
      bodyBytes: data.length,
      bytes: data.length,
      header,
      data,
      ...part,
      parentEntryId,
      parent_entry_id: parentEntryId,
      parentHash: `0x${bytesToHex(parentHashBytes)}`,
      parent_hash: `0x${bytesToHex(parentHashBytes)}`,
      textBytes: data,
      text: new TextDecoder().decode(data),
    };
  }

  if (kind === PUBLIC_BODY_KIND.IMAGE_POST) {
    if (header.length !== PUBLIC_POST_HEADER_BYTES) throw new Error('Public image post header length mismatch');
    if (mediaFormat !== PUBLIC_BODY_MEDIA_FORMATS.WEBP) throw new Error('Unsupported public image media format');
    if ((flags & ~PUBLIC_BODY_FLAGS.COMMENTS_DISABLED) !== 0) throw new Error('Unsupported public image post body flags');
    const part = readMultipart();
    const profile = readProfilePointer();
    return {
      layout: PUBLIC_BODY_LAYOUT,
      kind,
      type: 'image',
      headerBytes: header.length,
      bodyBytes: data.length,
      bytes: data.length,
      header,
      data,
      flags,
      mediaFormat,
      media_format: mediaFormat,
      ...part,
      ...profile,
      commentsAllowed: (flags & PUBLIC_BODY_FLAGS.COMMENTS_DISABLED) === 0,
      comments_allowed: (flags & PUBLIC_BODY_FLAGS.COMMENTS_DISABLED) === 0,
      imageBytes: data,
      image_bytes: data,
    };
  }

  if (kind === PUBLIC_BODY_KIND.DOCUMENT_POST) {
    if (header.length !== PUBLIC_POST_HEADER_BYTES) throw new Error('Public document post header length mismatch');
    if (mediaFormat !== PUBLIC_BODY_MEDIA_FORMATS.NONE) throw new Error('Unsupported public document media format');
    if ((flags & ~PUBLIC_BODY_FLAGS.COMMENTS_DISABLED) !== 0) throw new Error('Unsupported public document post body flags');
    const part = readMultipart();
    const profile = readProfilePointer();
    return {
      layout: PUBLIC_BODY_LAYOUT,
      kind,
      type: 'document',
      headerBytes: header.length,
      bodyBytes: data.length,
      bytes: data.length,
      header,
      data,
      flags,
      ...part,
      ...profile,
      commentsAllowed: (flags & PUBLIC_BODY_FLAGS.COMMENTS_DISABLED) === 0,
      comments_allowed: (flags & PUBLIC_BODY_FLAGS.COMMENTS_DISABLED) === 0,
      documentBytes: data,
      document_bytes: data,
    };
  }

  if (kind === PUBLIC_BODY_KIND.IMAGE_COMMENT) {
    if (header.length !== PUBLIC_COMMENT_HEADER_BYTES) throw new Error('Public image comment header length mismatch');
    if (mediaFormat !== PUBLIC_BODY_MEDIA_FORMATS.WEBP) throw new Error('Unsupported public image media format');
    if (flags !== 0) throw new Error('Unsupported public image comment body flags');
    const part = readMultipart();
    const parentEntryId = readBigUintBytes(header, 32, 8, 'parent_entry_id');
    const parentHashBytes = header.slice(40, 72);
    return {
      layout: PUBLIC_BODY_LAYOUT,
      kind,
      type: 'image_comment',
      headerBytes: header.length,
      bodyBytes: data.length,
      bytes: data.length,
      header,
      data,
      flags,
      mediaFormat,
      media_format: mediaFormat,
      ...part,
      parentEntryId,
      parent_entry_id: parentEntryId,
      parentHash: `0x${bytesToHex(parentHashBytes)}`,
      parent_hash: `0x${bytesToHex(parentHashBytes)}`,
      imageBytes: data,
      image_bytes: data,
    };
  }

  if (kind === PUBLIC_BODY_KIND.DOCUMENT_COMMENT) {
    if (header.length !== PUBLIC_COMMENT_HEADER_BYTES) throw new Error('Public document comment header length mismatch');
    if (mediaFormat !== PUBLIC_BODY_MEDIA_FORMATS.NONE) throw new Error('Unsupported public document media format');
    if (flags !== 0) throw new Error('Unsupported public document comment body flags');
    const part = readMultipart();
    const parentEntryId = readBigUintBytes(header, 32, 8, 'parent_entry_id');
    const parentHashBytes = header.slice(40, 72);
    return {
      layout: PUBLIC_BODY_LAYOUT,
      kind,
      type: 'document_comment',
      headerBytes: header.length,
      bodyBytes: data.length,
      bytes: data.length,
      header,
      data,
      flags,
      ...part,
      parentEntryId,
      parent_entry_id: parentEntryId,
      parentHash: `0x${bytesToHex(parentHashBytes)}`,
      parent_hash: `0x${bytesToHex(parentHashBytes)}`,
      documentBytes: data,
      document_bytes: data,
    };
  }

  if (kind === PUBLIC_BODY_KIND.AVATAR) {
    if (header.length !== PUBLIC_POST_HEADER_BYTES) throw new Error('Public avatar header length mismatch');
    if (mediaFormat !== PUBLIC_BODY_MEDIA_FORMATS.WEBP) throw new Error('Unsupported public avatar media format');
    if (flags !== 0) throw new Error('Unsupported public avatar body flags');
    const part = readMultipart();
    const profile = readProfilePointer();
    return {
      layout: PUBLIC_BODY_LAYOUT,
      kind,
      type: 'avatar',
      headerBytes: header.length,
      bodyBytes: data.length,
      bytes: data.length,
      header,
      data,
      flags,
      mediaFormat,
      media_format: mediaFormat,
      ...part,
      ...profile,
      imageBytes: data,
      image_bytes: data,
    };
  }

  throw new Error('Unsupported public body kind');
}

export function readPublicPostPayload(payload, options = {}) {
  const maxBytes = options.maxBytes ?? PUBLIC_POST_BODY_MAX_BYTES;
  const headerPayload = payload?.header_boc ?? payload?.headerBoc ?? payload?.header_cell ?? payload?.headerCell ?? payload?.header;
  const bodyPayload = payload?.body_boc ?? payload?.bodyBoc ?? payload?.body_cell ?? payload?.bodyCell ?? payload?.body;
  if (!headerPayload || !bodyPayload) {
    throw new TypeError('public payload must include header and body cells');
  }
  const headerBytes = readSnakeCellBytes(headerPayload, { maxBytes: PUBLIC_COMMENT_HEADER_BYTES, name: 'public header snake cell' });
  const bodyBytes = readSnakeCellBytes(bodyPayload, { maxBytes, name: 'public body snake cell' });
  return readPublicBodyBytes(headerBytes, bodyBytes);
}

// ══ PPH2 — the clean-17 PublicShard header ══════════════════════════════════════════════════════════════════
// A header is CLIENT-DEFINED opaque data: PublicShard stores it as a ref and never parses it (it commits only to
// H(PS_BODY_DOMAIN ‖ header.hash ‖ body.hash)). So this is a client convention, not an immutable ABI — but the
// reader re-derives that commit from the exact header bytes, so publicHeaderBytesV2 and readPublicBodyBytesV2
// below MUST stay each other's inverse or a post authenticates against nothing.
//
// PPH2 drops three PPH1 fields the shard model made redundant or unsafe, leaving ONE uniform 32-byte header:
//   - the profile pointer (profile_version + avatar_hash): advertised an avatar straight from the post header,
//     bypassing the PAID KeyShard pointer (mandatory fix #4). The authoritative avatar is KeyShard's.
//   - parent_entry_id: there is no global monotonic entry id; a comment's parent is the THREAD shard it lives in
//     (address = f(post_uid)), so routing already binds it.
//   - parent_hash: the reader derives the thread shard from the post's coordinates, so it already holds the parent.
// Layout (all kinds): magic(4)="PPH2" | ver(1)=2 | kind(1) | flags(1) | media(1) | streamId(16) | partIdx(2) |
// partCnt(2) | createdAt(4) = 32B. streamId/partIdx/partCnt stay at PPH1 offsets so readPublicPartHeaderInfo walks
// both. createdAt is the CLIENT's declared post time (stable across a multipart post's per-part contract stamps).
export const PUBLIC_HEADER_MAGIC_V2 = 'PPH2';
export const PUBLIC_HEADER_VERSION_V2 = 2;
export const PUBLIC_HEADER_BYTES_V2 = 32;

const PUBLIC_V2_POST_KINDS = new Set([PUBLIC_BODY_KIND.POST, PUBLIC_BODY_KIND.IMAGE_POST, PUBLIC_BODY_KIND.DOCUMENT_POST]);
const PUBLIC_V2_MEDIA_KINDS = new Set([PUBLIC_BODY_KIND.IMAGE_POST, PUBLIC_BODY_KIND.IMAGE_COMMENT, PUBLIC_BODY_KIND.AVATAR]);
const PUBLIC_V2_KIND_TYPE = Object.freeze({
  [PUBLIC_BODY_KIND.POST]: 'post',
  [PUBLIC_BODY_KIND.COMMENT]: 'comment',
  [PUBLIC_BODY_KIND.IMAGE_POST]: 'image',
  [PUBLIC_BODY_KIND.IMAGE_COMMENT]: 'image_comment',
  [PUBLIC_BODY_KIND.AVATAR]: 'avatar',
  [PUBLIC_BODY_KIND.DOCUMENT_POST]: 'document',
  [PUBLIC_BODY_KIND.DOCUMENT_COMMENT]: 'document_comment',
});

export function publicHeaderBytesV2(input) {
  const kind = publicPayloadKind(input);
  const streamId = publicStreamIdBytes(input);
  const partIndex = publicPartNumber(input?.partIndex ?? input?.part_index ?? 0, 'public part index');
  const partCount = publicPartNumber(input?.partCount ?? input?.part_count ?? 1, 'public part count');
  if (partCount <= 0 || partIndex >= partCount) throw new RangeError('public part index mismatch');
  const createdAtSec = publicCreatedAtSeconds(input);
  const mediaFormat = PUBLIC_V2_MEDIA_KINDS.has(kind)
    ? (kind === PUBLIC_BODY_KIND.AVATAR
        ? PUBLIC_BODY_MEDIA_FORMATS.WEBP
        : Number(input?.mediaFormat ?? input?.media_format ?? input?.format ?? PUBLIC_BODY_MEDIA_FORMATS.WEBP))
    : PUBLIC_BODY_MEDIA_FORMATS.NONE;
  const flags = PUBLIC_V2_POST_KINDS.has(kind) && !publicCommentsAllowed(input) ? PUBLIC_BODY_FLAGS.COMMENTS_DISABLED : 0;
  return concatBytes(
    new TextEncoder().encode(PUBLIC_HEADER_MAGIC_V2),
    new Uint8Array([PUBLIC_HEADER_VERSION_V2, kind, flags, mediaFormat]),
    streamId,
    bigintToBytes(BigInt(partIndex), 2, 'part_index'),
    bigintToBytes(BigInt(partCount), 2, 'part_count'),
    bigintToBytes(BigInt(createdAtSec), 4, 'created_at_sec'),
  );
}

export function readPublicBodyBytesV2(headerBytes, bodyBytes) {
  const header = toUint8Array(headerBytes, 'public header bytes');
  const data = toUint8Array(bodyBytes, 'public body bytes');
  if (header.length !== PUBLIC_HEADER_BYTES_V2) throw new Error('Public header length mismatch');
  if (new TextDecoder().decode(header.slice(0, 4)) !== PUBLIC_HEADER_MAGIC_V2) throw new Error('Unsupported public header magic');
  if (header[4] !== PUBLIC_HEADER_VERSION_V2) throw new Error('Unsupported public header version');
  const kind = header[5];
  const flags = header[6];
  const mediaFormat = header[7];
  const type = PUBLIC_V2_KIND_TYPE[kind];
  if (!type) throw new Error('Unsupported public body kind');

  // The bytes come from untrusted transaction history: reject an incoherent media/flags combination, don't render it.
  if (PUBLIC_V2_MEDIA_KINDS.has(kind)) {
    if (mediaFormat !== PUBLIC_BODY_MEDIA_FORMATS.WEBP) throw new Error('Unsupported public media format');
  } else if (mediaFormat !== PUBLIC_BODY_MEDIA_FORMATS.NONE) {
    throw new Error('Unsupported public media format');
  }
  if (PUBLIC_V2_POST_KINDS.has(kind)) {
    if ((flags & ~PUBLIC_BODY_FLAGS.COMMENTS_DISABLED) !== 0) throw new Error('Unsupported public post body flags');
  } else if (flags !== 0) {
    throw new Error('Unsupported public body flags');
  }

  const streamId = header.slice(8, 24);
  const partIndex = Number(readBigUintBytes(header, 24, 2, 'part_index'));
  const partCount = Number(readBigUintBytes(header, 26, 2, 'part_count'));
  if (partCount <= 0 || partIndex >= partCount) throw new Error('Public part index mismatch');
  const createdAtSec = Number(readBigUintBytes(header, 28, 4, 'created_at_sec'));

  const isText = kind === PUBLIC_BODY_KIND.POST || kind === PUBLIC_BODY_KIND.COMMENT;
  const isDocument = kind === PUBLIC_BODY_KIND.DOCUMENT_POST || kind === PUBLIC_BODY_KIND.DOCUMENT_COMMENT;
  const out = {
    layout: PUBLIC_BODY_LAYOUT,
    kind,
    type,
    headerBytes: header.length,
    bodyBytes: data.length,
    bytes: data.length,
    header,
    data,
    flags,
    streamId,
    stream_id: `0x${bytesToHex(streamId)}`,
    partIndex,
    part_index: partIndex,
    partCount,
    part_count: partCount,
    createdAtSec,
    created_at_sec: createdAtSec,
  };
  if (PUBLIC_V2_POST_KINDS.has(kind)) {
    out.commentsAllowed = (flags & PUBLIC_BODY_FLAGS.COMMENTS_DISABLED) === 0;
    out.comments_allowed = out.commentsAllowed;
  }
  if (isText) {
    out.textBytes = data;
    out.text = new TextDecoder().decode(data);
  } else if (isDocument) {
    out.documentBytes = data;
    out.document_bytes = data;
  } else {
    out.mediaFormat = mediaFormat;
    out.media_format = mediaFormat;
    out.imageBytes = data;
    out.image_bytes = data;
  }
  return out;
}

/** Build the PPH2 header + body cells for a public capsule. Returns the client cells directly (headerCell/bodyCell)
 *  so the send path hands them straight to buildPublicPublishBrowser without a BoC round-trip. */
export async function createPublicPostPayloadV2(input, options = {}) {
  const headerBytes = publicHeaderBytesV2(input);
  const bodyBytes = publicBodyBytes(input);
  const sizeClass = normalizePublicSizeClass(
    options.sizeClass ?? options.size_class ?? publicSizeClassForBodyBytes(bodyBytes.length),
    'public payload size_class',
  );
  const maxBytes = options.maxBytes ?? publicUsefulBytesForSizeClass(sizeClass);
  if (bodyBytes.length > maxBytes) throw new RangeError(`public body exceeds ${maxBytes} bytes`);
  const headerCell = snakeCellFromBytes(headerBytes, 'public header chunk');
  const bodyCell = snakeCellFromBytes(bodyBytes, 'public body chunk');
  const { hash: headerHashBytes } = await computeCellHashAndDepth(headerCell);
  const { hash: bodyHashBytes } = await computeCellHashAndDepth(bodyCell);
  const headerHash = `0x${bytesToHex(headerHashBytes)}`;
  const bodyHash = `0x${bytesToHex(bodyHashBytes)}`;
  const headerBoc = bytesToBase64(serializeBoc(headerCell));
  const bodyBoc = bytesToBase64(serializeBoc(bodyCell));
  const parsed = readPublicBodyBytesV2(headerBytes, bodyBytes);
  return {
    layout: PUBLIC_BODY_LAYOUT,
    version: PUBLIC_HEADER_VERSION_V2,
    kind: parsed.kind,
    type: parsed.type,
    streamId: parsed.stream_id,
    stream_id: parsed.stream_id,
    partIndex: parsed.partIndex,
    part_index: parsed.part_index,
    partCount: parsed.partCount,
    part_count: parsed.part_count,
    createdAtSec: parsed.createdAtSec,
    created_at_sec: parsed.created_at_sec,
    commentsAllowed: parsed.commentsAllowed,
    comments_allowed: parsed.comments_allowed,
    headerBytes: headerBytes.length,
    bodyBytes: bodyBytes.length,
    bytes: bodyBytes.length,
    sizeClass,
    size_class: sizeClass,
    usefulBytes: publicUsefulBytesForSizeClass(sizeClass),
    headerHash,
    header_hash: headerHash,
    bodyHash,
    body_hash: bodyHash,
    headerBoc,
    header_boc: headerBoc,
    bodyBoc,
    body_boc: bodyBoc,
    headerCell,
    bodyCell,
    header_cell: { hash: headerHash, boc: headerBoc, bytes: headerBytes.length },
    body_cell: { hash: bodyHash, boc: bodyBoc, bytes: bodyBytes.length },
  };
}

export function readPublicPostPayloadV2(payload, options = {}) {
  const maxBytes = options.maxBytes ?? PUBLIC_POST_BODY_MAX_BYTES;
  const headerPayload = payload?.header_boc ?? payload?.headerBoc ?? payload?.header_cell ?? payload?.headerCell ?? payload?.header;
  const bodyPayload = payload?.body_boc ?? payload?.bodyBoc ?? payload?.body_cell ?? payload?.bodyCell ?? payload?.body;
  if (!headerPayload || !bodyPayload) throw new TypeError('public payload must include header and body cells');
  const headerBytes = readSnakeCellBytes(headerPayload, { maxBytes: PUBLIC_HEADER_BYTES_V2, name: 'public header snake cell' });
  const bodyBytes = readSnakeCellBytes(bodyPayload, { maxBytes, name: 'public body snake cell' });
  return readPublicBodyBytesV2(headerBytes, bodyBytes);
}

// HEADER-ONLY multipart info (v650): every PPH1 kind carries the multipart fields at the same fixed offsets
// (streamId @8..24, part_index @24..26, part_count @26..28), so a chain walker can group entries into multipart
// streams WITHOUT the ~32KB body reads — used by the feed sync's boundary-straddle extension to keep walking
// until a window-split post's parts are all inside the window. TOLERANT: any malformed/foreign/future header
// returns null (the walker just treats the entry as single-part), never throws.
export function readPublicPartHeaderInfo(headerPayload) {
  try {
    if (!headerPayload) return null;
    const header = readSnakeCellBytes(headerPayload, { maxBytes: PUBLIC_COMMENT_HEADER_BYTES, name: 'public header snake cell' });
    if (header.length < 28) return null;
    const magic = new TextDecoder().decode(header.slice(0, 4));
    const version = header[4];
    // PPH1 and PPH2 share streamId@8..24, part_index@24..26, part_count@26..28, so one walker groups both.
    const isV1 = magic === PUBLIC_HEADER_MAGIC && version === PUBLIC_BODY_VERSION;
    const isV2 = magic === PUBLIC_HEADER_MAGIC_V2 && version === PUBLIC_HEADER_VERSION_V2;
    if (!isV1 && !isV2) return null;
    const partIndex = Number(readBigUintBytes(header, 24, 2, 'part_index'));
    const partCount = Number(readBigUintBytes(header, 26, 2, 'part_count'));
    if (!Number.isFinite(partIndex) || !Number.isFinite(partCount) || partCount <= 0 || partIndex >= partCount) return null;
    return {
      kind: header[5],
      streamId: `0x${bytesToHex(header.slice(8, 24))}`,
      partIndex,
      partCount,
    };
  } catch {
    return null;
  }
}
