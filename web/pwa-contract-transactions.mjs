import { randomBytes, parseTonAddress } from './crypto/platho-crypto.mjs?v=12';
import { ed25519 } from './vendor/@noble/curves/ed25519.js';

export const VAULT_OPS = Object.freeze({
  DepositTon: 716160408,
  WithdrawTonFromVaultBalance: 2115981368,
  WithdrawAthFromVaultBalance: 2115981369,
  RegisterMessagingKeys: 1383096026,
  ReplaceMessagingKeys: 2312521915,
  PublishPrivateFromVaultBalance: 2115981361,
  PublishPublicFromVaultBalance: 2115981362,
  SetProfileAvatarFromVaultBalance: 2115981363,
  MintUsernameFromVaultBalance: 2115981364,
});

export const ATH_WALLET_OPS = Object.freeze({
  ATHBurn: 1096042497,
  ATHTransferRequest: 1096042512,
  ATHTransferRequestWithNotify: 1096042516,
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

export const VAULT_BALANCE_PUBLISH_SIGNING_DOMAIN = 0x56504231n; // "VPB1"
export const VAULT_BATCH_PUBLISH_SIGNING_DOMAIN = 0x56504232n; // "VPB2" batch-publish signed-root domain
export const VAULT_BATCH_PUBLISH_ID_DOMAIN = 0x42504931n;      // "BPI1" batch publish_id derivation
export const CAPSULE_ENTRY_PUBLISH_ID_DOMAIN = 0x45504931n;    // "EPI1" per-entry publish_id derivation
export const OP_PUBLISH_BATCH = 0x7e1f5041n;                   // Vault external op for PublishBatchFromVaultBalance
export const MAX_BATCH_PARTS = 8;                              // mirrors contracts/Vault.tact MAX_BATCH_PARTS
export const MAX_EXTERNAL_MESSAGE_BYTES = 65535;               // TON max_ext_msg_size (config-43); validators
                                                               // DROP a larger inbound external BoC before the
                                                               // contract runs (Vault.tact EXT_HARD_BITS=65535*8).
export const VPB2_VERSION = 1n;                                // mirrors contracts/Vault.tact VPB2_VERSION
// Pinned affine charge floor (mirrors contracts/Vault.tact BATCH_FLOOR_BASE_PIN + BATCH_FLOOR_PER_PART_PIN * n).
// Recalibrated 2026-06-14: base = worst-case EXT_HARD import hold (89.63M -> 92M) + reject base compute (0.7M).
export const BATCH_FLOOR_BASE_PIN = 92_700_000n;
export const BATCH_FLOOR_PER_PART_PIN = 6_200_000n;
export const VAULT_PROFILE_AVATAR_SIGNING_DOMAIN = 0x56504131n; // "VPA1"
export const VAULT_USERNAME_MINT_SIGNING_DOMAIN = 0x56554E31n; // "VUN1"
export const VAULT_WITHDRAW_TON_SIGNING_DOMAIN = 0x56545731n; // "VTW1"
export const VAULT_WITHDRAW_ATH_SIGNING_DOMAIN = 0x56574131n; // "VWA1"
export const VAULT_REPLACE_MESSAGING_KEYS_SIGNING_DOMAIN = 0x56524B31n; // "VRK1"
export const VAULT_KEY_ID_DOMAIN = 0x4b455949n; // "KEYI"

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
export const PROFILE_AVATAR_NOTIFY_VALUE_NANOTONS = 66_000_000n; // mirrors Vault.PROFILE_AVATAR_NOTIFY_VALUE (raised 30M->66M with the ProfileRegistry endowment raise). Informational; the live attached charge is PROFILE_AVATAR_VAULT_TON_CHARGE_NANOTONS.
// Raised 61M->115M to track the ATH_TRANSFER_NOTIFY_STORAGE_ENDOWMENT raise (2M->20M) and the
// ProfileRegistry avatar-record/owner-version endowment raises (which lifted PROFILE_AVATAR_NOTIFY_VALUE 30M->66M):
// the Vault forwards VAULT_PROFILE_AVATAR_ATH_WALLET_REQUEST_VALUE (55M->109M) + 6M local exec = 115M.
export const PROFILE_AVATAR_VAULT_TON_CHARGE_NANOTONS = 115_000_000n;
// UsernameRegistry now retains 511M nanotons per mint (6M endowment + 500M NFT-item deploy reserve [0.5 TON
// prepaid storage, ~250+ years] + 1M ack + 4M state-growth), up from the old 32M. The Vault-funded mint hold is
// the registry retained value plus the Vault local exec reserve (6M) and ATH-wallet forwarding overhead margin.
// Raised 581M->617M for clean-11 (name-record endowment +36M: Vault forwards
// VAULT_USERNAME_MINT_ATH_WALLET_REQUEST_VALUE 575M->611M + 6M local exec = 617M). This is a signed max_ton_charge
// CEILING, not the actual debit: the Vault charges its own fixed usernameMintTonCharge() (581M on clean-10, 617M on
// clean-11) as long as it is <= this ceiling, so 617M is safe against BOTH genesis (clean-10 still debits 581M).
export const USERNAME_MINT_VAULT_TON_CHARGE_NANOTONS = 617_000_000n;
const UINT128_MOD = 1n << 128n;

export const VAULT_RESERVES_NANOTONS = Object.freeze({
  userStateStorage: 10_000_000n,
  keyRecordStandardStorage: 5_000_000n,
  keyRecordLongTermStorage: 30_000_000n,
  stateGrowthExec: 2_000_000n,
  depositTonExec: 2_000_000n,
  withdrawTonExec: 2_000_000n,
  withdrawAthMinValue: 58_000_000n,
});

export const ATH_WALLET_RESERVES_NANOTONS = Object.freeze({
  transferNotifyAckValue: 1_000_000n,
  internalTransferAckValue: 3_000_000n,
  internalTransferSourceAckValue: 1_000_000n,
  internalTransferFwdFeeAllowance: 21_000_000n,
  transferNotifyMinValue: 30_000_000n,
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

function bytesToBase64(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (typeof Buffer !== 'undefined') return Buffer.from(input).toString('base64');
  let binary = '';
  for (const byte of input) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function bytesToHex(bytes) {
  return [...toUint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
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

async function sha256(bytes) {
  const cryptoImpl = globalThis.crypto;
  if (!cryptoImpl?.subtle) throw new Error('crypto.subtle is unavailable');
  return new Uint8Array(await cryptoImpl.subtle.digest('SHA-256', toUint8Array(bytes)));
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

function beginVaultBody(op) {
  return new TinyCellBuilder().uint(op, 32, 'op');
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

function keyRecordStorageEndowment(cryptoSuiteMask) {
  const mask = toBigInt(cryptoSuiteMask, 'crypto_suite_mask');
  if (mask === 2n) return VAULT_RESERVES_NANOTONS.keyRecordLongTermStorage;
  throw new RangeError('Platho v1 messaging keys require hybrid-v1');
}

export function estimateVaultAttachedValueNanotons(type, params = {}, context = {}) {
  assertString(type, 'type');
  const userExists = context.userExists === true;

  if (type === 'DepositTon') {
    return assertUint(params.amount, 128, 'amount')
      + VAULT_RESERVES_NANOTONS.depositTonExec
      + (userExists ? 0n : VAULT_RESERVES_NANOTONS.userStateStorage);
  }
  if (type === 'RegisterMessagingKeys') {
    return keyRecordStorageEndowment(params.crypto_suite_mask)
      + VAULT_RESERVES_NANOTONS.stateGrowthExec
      + (userExists ? 0n : VAULT_RESERVES_NANOTONS.userStateStorage);
  }
  if (type === 'ReplaceMessagingKeys') {
    return keyRecordStorageEndowment(params.crypto_suite_mask)
      + VAULT_RESERVES_NANOTONS.stateGrowthExec;
  }
  throw new Error(`Unsupported Vault message type ${type}`);
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
  if (type === 'ATHTransferRequest') {
    return ATH_WALLET_RESERVES_NANOTONS.internalTransferExec
      + ATH_WALLET_RESERVES_NANOTONS.internalTransferAckValue
      + ATH_WALLET_RESERVES_NANOTONS.transferNotifyStorageEndowment
      + ATH_WALLET_RESERVES_NANOTONS.internalTransferFwdFeeAllowance
      + ATH_WALLET_RESERVES_NANOTONS.ownerRequestExec;
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

function vaultBalancePublishOwner(params) {
  return assertString(params.owner_wallet ?? params.ownerWallet, 'owner_wallet');
}

function vaultBalancePublishManifestHash(params) {
  const value = params.deployment_manifest_hash
    ?? params.deploymentManifestHash
    ?? params.manifest_hash
    ?? params.manifestHash;
  if (typeof value === 'string' && /^[0-9a-fA-F]{64}$/.test(value.trim())) {
    return `0x${value.trim()}`;
  }
  return value;
}

function vaultBalancePublishVaultAddress(params) {
  return params.vault_address ?? params.vaultAddress;
}

function basechainAddressHashValue(address, name) {
  const parsed = parseTonAddress(assertString(address, name));
  if (parsed.workchain !== 0) throw new Error(`${name} must be a basechain address`);
  return bytesToBigInt(parsed.hash);
}

export async function computeVaultMessagingKeyId(params = {}) {
  assertObject(params, 'params');
  const keyFields = beginCell()
    .uint(params.enc_pubkey ?? params.encPubkey, 256, 'enc_pubkey')
    .uint(params.sign_pubkey ?? params.signPubkey, 256, 'sign_pubkey')
    .uint(params.pq_kem_pubkey_hash ?? params.pqKemPubkeyHash, 256, 'pq_kem_pubkey_hash')
    .endCell();
  const keyIdCell = beginCell()
    .uint(VAULT_KEY_ID_DOMAIN, 32, 'key_id_domain')
    .address(params.owner_wallet ?? params.ownerWallet, 'owner_wallet')
    .uint(params.key_generation ?? params.keyGeneration, 32, 'key_generation')
    .uint(params.pq_kem_pubkey_len ?? params.pqKemPubkeyLen, 16, 'pq_kem_pubkey_len')
    .uint(params.crypto_suite_mask ?? params.cryptoSuiteMask, 16, 'crypto_suite_mask')
    .ref(keyFields, 'key_fields')
    .endCell();
  const { hash } = await computeCellHashAndDepth(keyIdCell);
  return bytesToBigInt(hash);
}

// Public author-index key id: hash of the FULL standard-address serialization of the author wallet, byte-for-byte
// matching CapsuleHub.publicAuthorKeyId = beginCell().storeAddress(author).endCell().hash(). The builder's
// .address() serializes identically to Tact storeAddress (tag 2 + anycast 0 + workchain byte + 32 hash bytes).
// MUST be used for getPublicAuthorIndex — do NOT use basechainAddressHashValue (the bare 256-bit account hash, a
// DIFFERENT value): a mismatch would make the author index resolve to "no posts" for every author.
export async function computePublicAuthorKeyId(authorWallet) {
  const cell = beginCell().address(authorWallet, 'author_wallet').endCell();
  const { hash } = await computeCellHashAndDepth(cell);
  return bytesToBigInt(hash);
}

function privateVaultBalancePublishSignedDataCell(params) {
  const publish = assertObject(params.publish ?? params, 'publish');
  const payload = beginCell()
    .uint(publish.size_class, 8, 'size_class')
    .uint(publish.crypto_suite, 8, 'crypto_suite')
    .uint(publishHashValue(publish.header_0_hash, 'publish.header_0_hash'), 256, 'header_0_hash')
    .uint(publishHashValue(publish.header_1_hash, 'publish.header_1_hash'), 256, 'header_1_hash')
    .uint(publishHashValue(publish.body_hash, 'publish.body_hash'), 256, 'body_hash')
    .ref(publishCellFromPayload(publish.header_0_cell, 'publish.header_0_cell'), 'header_0')
    .ref(publishCellFromPayload(publish.header_1_cell, 'publish.header_1_cell'), 'header_1')
    .ref(publishCellFromPayload(publish.body_cell, 'publish.body_cell'), 'body')
    .endCell();
  return beginCell()
    .uint(VAULT_BALANCE_PUBLISH_SIGNING_DOMAIN, 32, 'domain_magic')
    .uint(vaultBalancePublishManifestHash(params), 256, 'deployment_manifest_hash')
    .uint(basechainAddressHashValue(vaultBalancePublishVaultAddress(params), 'vault_address'), 256, 'vault_address_hash')
    .uint(VAULT_PUBLISH_KIND.PRIVATE, 8, 'publish_kind')
    .uint(basechainAddressHashValue(vaultBalancePublishOwner(params), 'owner_wallet'), 256, 'owner_wallet_hash')
    .uint(params.client_nonce ?? params.clientNonce, 64, 'client_nonce')
    .uint(params.max_charge ?? params.maxCharge, 128, 'max_charge')
    .uint(publish.size_class, 8, 'signed_size_class')
    .uint(publish.crypto_suite, 8, 'signed_crypto_suite')
    .ref(payload, 'payload')
    .endCell();
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

function publicVaultBalancePublishSignedDataCell(params) {
  const publish = assertObject(params.publish ?? params, 'publish');
  const sizeClass = normalizePublicSizeClass(publish.size_class ?? publish.sizeClass, 'publish.size_class');
  const payload = beginCell()
    .uint(publishHashValue(publish.header_hash ?? publish.header_0_hash, 'publish.header_hash'), 256, 'header_hash')
    .uint(publishHashValue(publish.body_hash, 'publish.body_hash'), 256, 'body_hash')
    .ref(publishCellFromPayload(publish.header_cell ?? publish.header_0_cell, 'publish.header_cell'), 'header')
    .ref(publishCellFromPayload(publish.body_cell, 'publish.body_cell'), 'body')
    .endCell();
  return beginCell()
    .uint(VAULT_BALANCE_PUBLISH_SIGNING_DOMAIN, 32, 'domain_magic')
    .uint(vaultBalancePublishManifestHash(params), 256, 'deployment_manifest_hash')
    .uint(basechainAddressHashValue(vaultBalancePublishVaultAddress(params), 'vault_address'), 256, 'vault_address_hash')
    .uint(VAULT_PUBLISH_KIND.PUBLIC, 8, 'publish_kind')
    .uint(basechainAddressHashValue(vaultBalancePublishOwner(params), 'owner_wallet'), 256, 'owner_wallet_hash')
    .uint(params.client_nonce ?? params.clientNonce, 64, 'client_nonce')
    .uint(params.max_charge ?? params.maxCharge, 128, 'max_charge')
    .uint(sizeClass, 8, 'signed_size_class')
    .uint(VAULT_CRYPTO_SUITE.PUBLIC_NONE, 8, 'signed_crypto_suite')
    .ref(payload, 'payload')
    .endCell();
}

function vaultBalancePublishSignedDataCell(type, params = {}) {
  assertString(type, 'type');
  assertObject(params, 'params');
  if (type === 'PublishPrivateFromVaultBalance') return privateVaultBalancePublishSignedDataCell(params);
  if (type === 'PublishPublicFromVaultBalance') return publicVaultBalancePublishSignedDataCell(params);
  throw new Error(`Unsupported Vault balance publish type ${type}`);
}

function vaultProfileAvatarOwner(params) {
  return assertString(params.owner_wallet ?? params.ownerWallet, 'owner_wallet');
}

function vaultProfileAvatarRegistryAddress(params) {
  return params.profile_registry_address
    ?? params.profileRegistryAddress
    ?? params.registry_address
    ?? params.registryAddress;
}

function vaultProfileAvatarSignedDataCell(params) {
  const avatarPayload = beginCell()
    .address(vaultProfileAvatarRegistryAddress(params), 'profile_registry_address')
    .uint(publishHashValue(params.avatar_hash ?? params.avatarHash, 'avatar_hash'), 256, 'avatar_hash')
    .uint(params.avatar_entry_id ?? params.avatarEntryId ?? 0n, 64, 'avatar_entry_id')
    .uint(params.avatar_stream_id ?? params.avatarStreamId, 128, 'avatar_stream_id')
    .uint(params.avatar_part_count ?? params.avatarPartCount, 16, 'avatar_part_count')
    .uint(params.media_format ?? params.mediaFormat ?? PUBLIC_BODY_MEDIA_FORMATS.WEBP, 8, 'media_format')
    .endCell();
  return beginCell()
    .uint(VAULT_PROFILE_AVATAR_SIGNING_DOMAIN, 32, 'domain_magic')
    .uint(vaultBalancePublishManifestHash(params), 256, 'deployment_manifest_hash')
    .address(vaultProfileAvatarOwner(params), 'owner_wallet')
    .uint(params.client_nonce ?? params.clientNonce, 64, 'client_nonce')
    .uint(params.max_ton_charge ?? params.maxTonCharge, 128, 'max_ton_charge')
    .address(vaultBalancePublishVaultAddress(params), 'vault_address')
    .ref(avatarPayload, 'avatar_payload')
    .endCell();
}

function vaultUsernameMintRegistryAddress(params) {
  return params.username_registry_address
    ?? params.usernameRegistryAddress
    ?? params.registry_address
    ?? params.registryAddress;
}

function vaultUsernameMintOwner(params) {
  return assertString(params.owner_wallet ?? params.ownerWallet, 'owner_wallet');
}

function vaultUsernameMintSignedDataCell(params) {
  const usernameBytes = normalizeUsernameBytes(params.username);
  const usernamePayload = beginCell()
    .address(vaultUsernameMintRegistryAddress(params), 'username_registry_address')
    .uint(usernameBytes.length, 8, 'username_len')
    .bytesValue(usernameBytes, usernameBytes.length, 'username')
    .endCell();
  return beginCell()
    .uint(VAULT_USERNAME_MINT_SIGNING_DOMAIN, 32, 'domain_magic')
    .uint(vaultBalancePublishManifestHash(params), 256, 'deployment_manifest_hash')
    .address(vaultUsernameMintOwner(params), 'owner_wallet')
    .uint(params.client_nonce ?? params.clientNonce, 64, 'client_nonce')
    .uint(params.max_ton_charge ?? params.maxTonCharge, 128, 'max_ton_charge')
    .address(vaultBalancePublishVaultAddress(params), 'vault_address')
    .ref(usernamePayload, 'username_payload')
    .endCell();
}


function vaultWithdrawOwner(params) {
  return assertString(params.owner_wallet ?? params.ownerWallet, 'owner_wallet');
}

function vaultWithdrawSignedDataCell(params = {}, domain) {
  const actionPayload = beginCell()
    .uint(params.amount, 128, 'amount')
    .address(params.recipient, 'recipient')
    .endCell();
  return beginCell()
    .uint(domain, 32, 'domain_magic')
    .uint(vaultBalancePublishManifestHash(params), 256, 'deployment_manifest_hash')
    .address(vaultBalancePublishVaultAddress(params), 'vault_address')
    .address(vaultWithdrawOwner(params), 'owner_wallet')
    .uint(params.client_nonce ?? params.clientNonce, 64, 'client_nonce')
    .ref(actionPayload, 'action_payload')
    .endCell();
}

async function buildVaultWithdrawExternalBoc(params = {}, options = {}, domain, op) {
  const vaultAddress = assertString(options.vaultAddress ?? params.vaultAddress, 'vaultAddress');
  const deploymentManifestHash = options.deployment_manifest_hash
    ?? options.deploymentManifestHash
    ?? params.deployment_manifest_hash
    ?? params.deploymentManifestHash;
  const signedData = vaultWithdrawSignedDataCell({
    ...params,
    vaultAddress,
    deploymentManifestHash,
  }, domain);
  const signingSecretKey = assertBytes(params.signingSecretKey, 32, 'signingSecretKey');
  const { hash } = await computeCellHashAndDepth(signedData);
  const signature = ed25519.sign(hash, signingSecretKey);
  const bodyCell = beginVaultBody(op)
    .address(vaultWithdrawOwner(params), 'owner_wallet')
    .bytesValue(signature, 64, 'signature')
    .ref(signedData, 'signed_payload')
    .endCell();
  const root = externalInMessageCell(vaultAddress, bodyCell);
  return {
    bodyCell,
    signedData,
    signedDataHash: bytesToHex(hash),
    signature: bytesToHex(signature),
    boc: bytesToBase64(serializeBoc(root)),
    vaultAddress,
  };
}

export async function buildVaultWithdrawTonExternalBoc(params = {}, options = {}) {
  return buildVaultWithdrawExternalBoc(
    params,
    options,
    VAULT_WITHDRAW_TON_SIGNING_DOMAIN,
    VAULT_OPS.WithdrawTonFromVaultBalance,
  );
}

export async function buildVaultWithdrawAthExternalBoc(params = {}, options = {}) {
  return buildVaultWithdrawExternalBoc(
    params,
    options,
    VAULT_WITHDRAW_ATH_SIGNING_DOMAIN,
    VAULT_OPS.WithdrawAthFromVaultBalance,
  );
}


function replaceMessagingKeysOwner(params) {
  return assertString(params.owner_wallet ?? params.ownerWallet, 'owner_wallet');
}

function replaceMessagingKeysSignedDataCell(params = {}) {
  const payload = beginCell()
    .uint(params.enc_pubkey, 256, 'enc_pubkey')
    .uint(params.sign_pubkey, 256, 'sign_pubkey')
    .uint(params.pq_kem_pubkey_hash, 256, 'pq_kem_pubkey_hash')
    .uint(params.pq_kem_pubkey_len, 16, 'pq_kem_pubkey_len')
    .ref(pqKemPubkeyCellFromParams(params), 'pq_kem_pubkey')
    .uint(params.crypto_suite_mask, 16, 'crypto_suite_mask')
    .endCell();

  return beginCell()
    .uint(VAULT_REPLACE_MESSAGING_KEYS_SIGNING_DOMAIN, 32, 'domain_magic')
    .uint(vaultBalancePublishManifestHash(params), 256, 'deployment_manifest_hash')
    .uint(basechainAddressHashValue(vaultBalancePublishVaultAddress(params), 'vault_address'), 256, 'vault_address_hash')
    .uint(basechainAddressHashValue(replaceMessagingKeysOwner(params), 'owner_wallet'), 256, 'owner_wallet_hash')
    .uint(params.client_nonce ?? params.clientNonce, 64, 'client_nonce')
    .ref(payload, 'replace_keys_payload')
    .endCell();
}

export async function buildVaultReplaceMessagingKeysBodyCell(params = {}) {
  assertObject(params, 'params');
  const signedData = replaceMessagingKeysSignedDataCell(params);
  const signingSecretKey = assertBytes(params.signingSecretKey, 32, 'signingSecretKey');
  const { hash } = await computeCellHashAndDepth(signedData);
  const signature = ed25519.sign(hash, signingSecretKey);
  return {
    bodyCell: beginVaultBody(VAULT_OPS.ReplaceMessagingKeys)
      .address(replaceMessagingKeysOwner(params), 'owner_wallet')
      .bytesValue(signature, 64, 'signature')
      .ref(signedData, 'signed_payload')
      .endCell(),
    signedData,
    signedDataHash: bytesToHex(hash),
    signature: bytesToHex(signature),
  };
}

export async function buildVaultReplaceMessagingKeysExternalBoc(params = {}, options = {}) {
  const vaultAddress = assertString(options.vaultAddress ?? params.vaultAddress, 'vaultAddress');
  const deploymentManifestHash = options.deployment_manifest_hash
    ?? options.deploymentManifestHash
    ?? params.deployment_manifest_hash
    ?? params.deploymentManifestHash;
  const built = await buildVaultReplaceMessagingKeysBodyCell({
    ...params,
    vaultAddress,
    deploymentManifestHash,
  });
  const root = externalInMessageCell(vaultAddress, built.bodyCell);
  return {
    ...built,
    boc: bytesToBase64(serializeBoc(root)),
    vaultAddress,
  };
}

function externalInMessageCell(destinationAddress, bodyCell) {
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

export async function buildVaultBalancePublishBodyCell(type, params = {}) {
  const signedData = vaultBalancePublishSignedDataCell(type, params);
  const signingSecretKey = assertBytes(params.signingSecretKey, 32, 'signingSecretKey');
  const { hash } = await computeCellHashAndDepth(signedData);
  const signature = ed25519.sign(hash, signingSecretKey);
  const op = type === 'PublishPrivateFromVaultBalance'
    ? VAULT_OPS.PublishPrivateFromVaultBalance
    : VAULT_OPS.PublishPublicFromVaultBalance;
  return {
    bodyCell: beginVaultBody(op)
      .address(vaultBalancePublishOwner(params), 'owner_wallet')
      .bytesValue(signature, 64, 'signature')
      .ref(signedData, 'signed_payload')
      .endCell(),
    signedData,
    signedDataHash: bytesToHex(hash),
    signature: bytesToHex(signature),
  };
}

export async function buildVaultBalancePublishExternalBoc(type, params = {}, options = {}) {
  const vaultAddress = assertString(options.vaultAddress ?? params.vaultAddress, 'vaultAddress');
  const deploymentManifestHash = options.deployment_manifest_hash
    ?? options.deploymentManifestHash
    ?? params.deployment_manifest_hash
    ?? params.deploymentManifestHash;
  const built = await buildVaultBalancePublishBodyCell(type, {
    ...params,
    vaultAddress,
    deploymentManifestHash,
  });
  const root = externalInMessageCell(vaultAddress, built.bodyCell);
  return {
    ...built,
    boc: bytesToBase64(serializeBoc(root)),
    vaultAddress,
  };
}

// ---------------------------------------------------------------------------
// VPB2 batch publish (signed BATCH external). Mirrors contracts/Vault.tact
// external(PublishBatchFromVaultBalance) + tests/helpers/vpb2.ts byte-for-byte.
// All inputs are pre-built capsule cells + scalar fields; nothing here reads app state.
// ---------------------------------------------------------------------------

// Worst-case affine floor max_charge must clear (mirrors Vault.batchChargeFloor / BATCH_FLOOR_*_PIN).
export function batchChargeFloor(partCount) {
  const n = assertUint(partCount, 8, 'part_count');
  return BATCH_FLOOR_BASE_PIN + BATCH_FLOOR_PER_PART_PIN * n;
}

function batchPartKind(part) {
  const raw = part?.kind ?? part?.publish_kind ?? part?.publishKind;
  if (raw !== undefined && raw !== null) {
    const kind = toBigInt(raw, 'part.kind');
    if (kind === VAULT_PUBLISH_KIND.PRIVATE) return VAULT_PUBLISH_KIND.PRIVATE;
    if (kind === VAULT_PUBLISH_KIND.PUBLIC) return VAULT_PUBLISH_KIND.PUBLIC;
    throw new RangeError('part.kind must be PRIVATE(1) or PUBLIC(2)');
  }
  // Discriminator fallback: a private part carries two headers, a public part one.
  const hasH1 = (part?.header_1_cell ?? part?.header1Cell) !== undefined
    || (part?.header_1_hash ?? part?.header1Hash) !== undefined;
  return hasH1 ? VAULT_PUBLISH_KIND.PRIVATE : VAULT_PUBLISH_KIND.PUBLIC;
}

// One linked-list part cell. PRIVATE: size(8) suite(8) h0(256) h1(256) bh(256) + ref h0,h1,body[,next].
// PUBLIC: size(8) reserved(8=0) h(256) bh(256) + ref header,body[,next]. `part.next` (a built cell) appends
// the 4th/3rd ref to the successor part — the head is part 0, the tail (last) carries no next ref.
export function buildBatchPublishPartCell(part) {
  assertObject(part, 'part');
  const next = part.next ?? part.nextCell ?? null;
  if (batchPartKind(part) === VAULT_PUBLISH_KIND.PRIVATE) {
    const header0 = publishCellFromPayload(part.header_0_cell ?? part.header0Cell, 'part.header_0_cell');
    const header1 = publishCellFromPayload(part.header_1_cell ?? part.header1Cell, 'part.header_1_cell');
    const body = publishCellFromPayload(part.body_cell ?? part.bodyCell, 'part.body_cell');
    const builder = beginCell()
      .uint(part.size_class ?? part.sizeClass, 8, 'size_class')
      .uint(part.crypto_suite ?? part.cryptoSuite ?? VAULT_CRYPTO_SUITE.HYBRID, 8, 'crypto_suite')
      .uint(publishHashValue(part.header_0_hash ?? part.header0Hash, 'part.header_0_hash'), 256, 'header_0_hash')
      .uint(publishHashValue(part.header_1_hash ?? part.header1Hash, 'part.header_1_hash'), 256, 'header_1_hash')
      .uint(publishHashValue(part.body_hash ?? part.bodyHash, 'part.body_hash'), 256, 'body_hash')
      .ref(header0, 'header_0')
      .ref(header1, 'header_1')
      .ref(body, 'body');
    if (next) builder.ref(next, 'next_part');
    return builder.endCell();
  }
  const header = publishCellFromPayload(part.header_cell ?? part.headerCell ?? part.header_0_cell, 'part.header_cell');
  const body = publishCellFromPayload(part.body_cell ?? part.bodyCell, 'part.body_cell');
  const builder = beginCell()
    .uint(normalizePublicSizeClass(part.size_class ?? part.sizeClass, 'part.size_class'), 8, 'size_class')
    // reserved byte: bit0 = is_profile (clean-11 channel-description PROFILE post), bits 1..7 stay 0. Defaults to 0
    // (a normal public post) so this is a no-op on clean-10; callers set is_profile ONLY when the genesis supports
    // the profile-pointer (clean-10 Vault/Hub reject reserved != 0).
    .uint((part.is_profile ?? part.isProfile) ? 1n : 0n, 8, 'reserved')
    .uint(publishPublicParentLink(part), 64, 'parent_link')
    .uint(publishHashValue(part.header_hash ?? part.headerHash ?? part.header_0_hash, 'part.header_hash'), 256, 'header_hash')
    .uint(publishHashValue(part.body_hash ?? part.bodyHash, 'part.body_hash'), 256, 'body_hash')
    .ref(header, 'header')
    .ref(body, 'body');
  if (next) builder.ref(next, 'next_part');
  return builder.endCell();
}

// parent_link wire field (entryLink convention): 0 -> top-level post (indexed by author on-chain);
// parentEntryId+1 -> comment (indexed by parent). Mirrors CapsuleHub's parentLink/entryIdFromLink.
function publishPublicParentLink(part) {
  const explicit = part.parent_link ?? part.parentLink;
  if (explicit !== undefined && explicit !== null) return BigInt(explicit);
  const pid = part.parent_entry_id ?? part.parentEntryId;
  if (pid === undefined || pid === null) return 0n;
  const value = BigInt(pid);
  return value < 0n ? 0n : value + 1n;
}

// Link 1..MAX_BATCH_PARTS parts into the singly-linked list and return its head (part 0). Built tail-first so
// each non-last part carries a ref to its successor.
export function buildBatchPublishPartsRoot(parts) {
  if (!Array.isArray(parts) || parts.length < 1) {
    throw new RangeError('parts must be a non-empty array');
  }
  if (parts.length > MAX_BATCH_PARTS) {
    throw new RangeError(`parts must be at most ${MAX_BATCH_PARTS}`);
  }
  let next = null;
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    next = buildBatchPublishPartCell({ ...parts[i], next });
  }
  return next;
}

// Signed ROOT cell: domain(32) manifest(256) vault_hash(256) kind(8) owner_hash(256) nonce(64) max_charge(128)
// part_count(8) version(8) + ref(partsRoot). Field order is the Vault's authoritative re-validation order.
export function buildBatchPublishSignedRootCell(params = {}) {
  assertObject(params, 'params');
  return beginCell()
    .uint(VAULT_BATCH_PUBLISH_SIGNING_DOMAIN, 32, 'domain_magic')
    .uint(vaultBalancePublishManifestHash(params), 256, 'deployment_manifest_hash')
    .uint(basechainAddressHashValue(vaultBalancePublishVaultAddress(params), 'vault_address'), 256, 'vault_address_hash')
    .uint(params.kind ?? params.publish_kind ?? VAULT_PUBLISH_KIND.PRIVATE, 8, 'publish_kind')
    .uint(basechainAddressHashValue(vaultBalancePublishOwner(params), 'owner_wallet'), 256, 'owner_wallet_hash')
    .uint(params.client_nonce ?? params.clientNonce, 64, 'client_nonce')
    .uint(params.max_charge ?? params.maxCharge, 128, 'max_charge')
    .uint(params.part_count ?? params.partCount, 8, 'part_count')
    .uint(params.version ?? VPB2_VERSION, 8, 'version')
    .ref(params.partsRoot ?? params.parts_root, 'parts_root')
    .endCell();
}

// BPI1 batch publish_id = sha256(domain(32) manifest(256) owner(address) nonce(64) parts_root_hash(256) kind(8)
// part_count(8)). The owner is a FULL address here (not a hash), matching Vault.computeBatchPublishId.
export async function computeBatchPublishId(params = {}) {
  assertObject(params, 'params');
  const partsRoot = params.partsRoot ?? params.parts_root;
  const { hash: partsRootHash } = await computeCellHashAndDepth(partsRoot);
  const idCell = beginCell()
    .uint(VAULT_BATCH_PUBLISH_ID_DOMAIN, 32, 'batch_publish_id_domain')
    .uint(vaultBalancePublishManifestHash(params), 256, 'deployment_manifest_hash')
    .address(vaultBalancePublishOwner(params), 'owner_wallet')
    .uint(params.client_nonce ?? params.clientNonce, 64, 'client_nonce')
    .uint(bytesToBigInt(partsRootHash), 256, 'parts_root_hash')
    .uint(params.kind ?? params.publish_kind ?? VAULT_PUBLISH_KIND.PRIVATE, 8, 'publish_kind')
    .uint(params.part_count ?? params.partCount, 8, 'part_count')
    .endCell();
  const { hash } = await computeCellHashAndDepth(idCell);
  return bytesToBigInt(hash);
}

// EPI1 entry publish_id = sha256(domain(32) batch_publish_id(256) part_index(16)).
export async function computeEntryPublishId(batchPublishId, partIndex) {
  const idCell = beginCell()
    .uint(CAPSULE_ENTRY_PUBLISH_ID_DOMAIN, 32, 'capsule_entry_publish_id_domain')
    .uint(batchPublishId, 256, 'batch_publish_id')
    .uint(partIndex, 16, 'part_index')
    .endCell();
  const { hash } = await computeCellHashAndDepth(idCell);
  return bytesToBigInt(hash);
}

// Signed envelope (external body): op(32) owner_wallet(address) signature(512) + ref(signedRoot). The signature
// is ed25519 over signedRoot.hash() with the user's AUTH secret key (32-byte seed), NOT the messaging sign key.
export async function buildBatchPublishExternalBody(params = {}) {
  assertObject(params, 'params');
  const partsRoot = params.partsRoot ?? params.parts_root;
  if (!partsRoot) throw new TypeError('partsRoot is required');
  const signedRoot = buildBatchPublishSignedRootCell({ ...params, partsRoot });
  const authSecretKey = assertBytes(params.authSecretKey ?? params.auth_secret_key, 32, 'authSecretKey');
  const { hash } = await computeCellHashAndDepth(signedRoot);
  const signature = ed25519.sign(hash, authSecretKey);
  const bodyCell = beginVaultBody(Number(OP_PUBLISH_BATCH))
    .address(vaultBalancePublishOwner(params), 'owner_wallet')
    .bytesValue(signature, 64, 'signature')
    .ref(signedRoot, 'signed_root')
    .endCell();
  return {
    bodyCell,
    signedRoot,
    signedRootHash: bytesToHex(hash),
    signature: bytesToHex(signature),
  };
}

// Full signed BATCH external: serialized external-in BOC + the derived ids the client can confirm against later.
export async function buildBatchPublishExternalBoc(params = {}, options = {}) {
  assertObject(params, 'params');
  const vaultAddress = assertString(options.vaultAddress ?? params.vaultAddress, 'vaultAddress');
  const deploymentManifestHash = options.deployment_manifest_hash
    ?? options.deploymentManifestHash
    ?? params.deployment_manifest_hash
    ?? params.deploymentManifestHash;
  const partsRoot = params.partsRoot ?? params.parts_root;
  if (!partsRoot) throw new TypeError('partsRoot is required');
  const kind = params.kind ?? params.publish_kind ?? VAULT_PUBLISH_KIND.PRIVATE;
  const partCount = params.part_count ?? params.partCount;
  const merged = { ...params, vaultAddress, deploymentManifestHash, partsRoot, kind, part_count: partCount };
  const built = await buildBatchPublishExternalBody(merged);
  const batchPublishId = await computeBatchPublishId(merged);
  const count = Number(assertUint(partCount, 8, 'part_count'));
  const entryPublishIds = [];
  for (let i = 0; i < count; i += 1) {
    entryPublishIds.push(await computeEntryPublishId(batchPublishId, i));
  }
  const root = externalInMessageCell(vaultAddress, built.bodyCell);
  const serializedRoot = serializeBoc(root);
  // Fail-closed backstop. TON validators silently DROP an external BoC larger than max_ext_msg_size
  // before the Vault's external() receiver runs (no acceptMessage, no nonce bump, no bounce), which strands
  // the publish at SENT forever. NEVER sign/broadcast an oversized external — surface a deterministic error
  // so the size-aware packer (groupPublishItemsIntoBatches in publish-batch-orchestration.mjs) can split
  // instead of broadcasting into the void. This is the last line of defense if the packer's byte estimate
  // is ever too loose for an unusual capsule shape.
  if (serializedRoot.length > MAX_EXTERNAL_MESSAGE_BYTES) {
    throw new RangeError(`batch external is ${serializedRoot.length} bytes, exceeds max_ext_msg_size ${MAX_EXTERNAL_MESSAGE_BYTES}`);
  }
  return {
    boc: bytesToBase64(serializedRoot),
    bodyCell: built.bodyCell,
    signedRoot: built.signedRoot,
    signedRootHash: built.signedRootHash,
    signature: built.signature,
    batchPublishId,
    entryPublishIds,
    vaultAddress,
  };
}

// K pre-signed VARIANTS of the SAME batch external (same nonce/parts/ids), differing only in max_charge
// (+k nanotons, k = variant index). Every TON dedup layer keys on either the serialized bytes or the root
// repr hash — both change with the signature — so rotating variants makes EVERY retry a REAL broadcast
// (a same-BoC re-POST within the network's ~60s dedup windows is a silent no-op, which is what made large
// externals take minutes: the retry ladder was almost entirely fake). Correctness: max_charge is NOT part of
// computeBatchPublishId, so batchPublishId/entryPublishIds are byte-identical across variants and every
// confirm/receipt path matches unchanged; all variants share ONE nonce, so the contract's pre-accept
// throwUnless(16453) lets exactly ONE land (over-reserve refunded by the mode-128 ACK) and bounces the rest
// uncharged — no double-spend by construction. Cost: <= K-1 nanotons on the winning variant, refunded.
export async function buildBatchPublishExternalVariants(params = {}, options = {}, variantOptions = {}) {
  const variantCount = Math.max(1, Math.min(64, Number(variantOptions.variantCount ?? 16)));
  const baseMaxCharge = BigInt(params.max_charge ?? params.maxCharge);
  const variants = [];
  let first = null;
  for (let k = 0; k < variantCount; k += 1) {
    const built = await buildBatchPublishExternalBoc({
      ...params,
      max_charge: baseMaxCharge + BigInt(k),
      maxCharge: baseMaxCharge + BigInt(k),
    }, options);
    if (k === 0) first = built;
    variants.push(built.boc);
  }
  return { ...first, maxCharge: baseMaxCharge, variants };
}

export async function buildVaultProfileAvatarBodyCell(params = {}) {
  assertObject(params, 'params');
  const signedData = vaultProfileAvatarSignedDataCell(params);
  const signingSecretKey = assertBytes(params.signingSecretKey, 32, 'signingSecretKey');
  const { hash } = await computeCellHashAndDepth(signedData);
  const signature = ed25519.sign(hash, signingSecretKey);
  return {
    bodyCell: beginVaultBody(VAULT_OPS.SetProfileAvatarFromVaultBalance)
      .address(vaultProfileAvatarOwner(params), 'owner_wallet')
      .bytesValue(signature, 64, 'signature')
      .ref(signedData, 'signed_payload')
      .endCell(),
    signedData,
    signedDataHash: bytesToHex(hash),
    signature: bytesToHex(signature),
  };
}

export async function buildVaultProfileAvatarExternalBoc(params = {}, options = {}) {
  const vaultAddress = assertString(options.vaultAddress ?? params.vaultAddress, 'vaultAddress');
  const deploymentManifestHash = options.deployment_manifest_hash
    ?? options.deploymentManifestHash
    ?? params.deployment_manifest_hash
    ?? params.deploymentManifestHash;
  const built = await buildVaultProfileAvatarBodyCell({
    ...params,
    vaultAddress,
    deploymentManifestHash,
  });
  const root = externalInMessageCell(vaultAddress, built.bodyCell);
  return {
    ...built,
    boc: bytesToBase64(serializeBoc(root)),
    vaultAddress,
  };
}

export async function buildVaultUsernameMintBodyCell(params = {}) {
  assertObject(params, 'params');
  const signedData = vaultUsernameMintSignedDataCell(params);
  const signingSecretKey = assertBytes(params.signingSecretKey, 32, 'signingSecretKey');
  const { hash } = await computeCellHashAndDepth(signedData);
  const signature = ed25519.sign(hash, signingSecretKey);
  return {
    bodyCell: beginVaultBody(VAULT_OPS.MintUsernameFromVaultBalance)
      .address(vaultUsernameMintOwner(params), 'owner_wallet')
      .bytesValue(signature, 64, 'signature')
      .ref(signedData, 'signed_payload')
      .endCell(),
    signedData,
    signedDataHash: bytesToHex(hash),
    signature: bytesToHex(signature),
  };
}

export async function buildVaultUsernameMintExternalBoc(params = {}, options = {}) {
  const vaultAddress = assertString(options.vaultAddress ?? params.vaultAddress, 'vaultAddress');
  const deploymentManifestHash = options.deployment_manifest_hash
    ?? options.deploymentManifestHash
    ?? params.deployment_manifest_hash
    ?? params.deploymentManifestHash;
  const built = await buildVaultUsernameMintBodyCell({
    ...params,
    vaultAddress,
    deploymentManifestHash,
  });
  const root = externalInMessageCell(vaultAddress, built.bodyCell);
  return {
    ...built,
    boc: bytesToBase64(serializeBoc(root)),
    vaultAddress,
  };
}

export function buildVaultMessageBody(type, params = {}) {
  assertObject(params, 'params');
  switch (type) {
    case 'DepositTon':
      return beginVaultBody(VAULT_OPS.DepositTon)
        .uint(params.amount, 128, 'amount')
        .toBocBase64();
    case 'RegisterMessagingKeys':
      return beginVaultBody(VAULT_OPS.RegisterMessagingKeys)
        .uint(params.enc_pubkey, 256, 'enc_pubkey')
        .uint(params.sign_pubkey, 256, 'sign_pubkey')
        .uint(params.auth_pubkey, 256, 'auth_pubkey')
        .ref(beginCell()
          .uint(params.pq_kem_pubkey_hash, 256, 'pq_kem_pubkey_hash')
          .uint(params.pq_kem_pubkey_len, 16, 'pq_kem_pubkey_len')
          .ref(pqKemPubkeyCellFromParams(params), 'pq_kem_pubkey')
          .uint(params.crypto_suite_mask, 16, 'crypto_suite_mask')
          .endCell(), 'register_keys_tail')
        .toBocBase64();
    default:
      throw new Error(`Unsupported Vault message type ${type}`);
  }
}

export function buildAthWalletMessageBody(type, params = {}) {
  assertObject(params, 'params');
  switch (type) {
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

export function createVaultWalletMessage(type, params = {}, options = {}) {
  const address = assertString(options.vaultAddress, 'vaultAddress');
  const amount = options.valueNanotons !== undefined
    ? assertUint(options.valueNanotons, 128, 'valueNanotons')
    : estimateVaultAttachedValueNanotons(type, params, options);
  return {
    address,
    amount: amount.toString(),
    payload: buildVaultMessageBody(type, params),
  };
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
    // clean-11: a channel-PROFILE post sets reserved bit0 (is_profile) in buildBatchPublishPartCell so the contract
    // threads it into the global profile chain. Wire-only (not part of the header/body hash) so bodyHash-based feed
    // merging is unaffected; baked in before signing so retries stay byte-identical. Caller gates on the genesis.
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
    if (new TextDecoder().decode(header.slice(0, 4)) !== PUBLIC_HEADER_MAGIC) return null;
    if (header[4] !== PUBLIC_BODY_VERSION) return null;
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
