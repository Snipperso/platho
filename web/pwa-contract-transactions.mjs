import { randomBytes, parseTonAddress } from './crypto/platho-crypto.mjs';
import { ed25519 } from './vendor/@noble/curves/ed25519.js';

export const VAULT_OPS = Object.freeze({
  DepositTon: 716160408,
  WithdrawTon: 1212947826,
  WithdrawAth: 4188293172,
  RegisterMessagingKeys: 1383096026,
  ReplaceMessagingKeys: 2312521915,
  CreateReceiveIntent: 4152424723,
  ClaimReceiveIntent: 2582433020,
  CancelReceiveIntent: 841519988,
  PublishPrivateFromVaultBalance: 2115981361,
  PublishPublicFromVaultBalance: 2115981362,
});

export const ATH_WALLET_OPS = Object.freeze({
  ATHBurn: 1096042497,
  ATHTransferRequest: 1096042512,
  ATHTransferRequestWithNotify: 1096042516,
  ATHTransferRequestMintUsername: 1096042518,
  ATHTransferRequestProfileAvatar: 1096042520,
});

export const USERNAME_REGISTRY_OPS = Object.freeze({
  FlushAthRefundDue: 1804766023,
});

export const VAULT_PUBLISH_KIND = Object.freeze({
  PRIVATE: 1n,
  PUBLIC: 2n,
});

export const VAULT_BALANCE_PUBLISH_SIGNING_DOMAIN = 0x56504231n; // "VPB1"

export const VAULT_SIZE_CLASS = Object.freeze({
  STANDARD: 1n,
  LONG_TERM: 2n,
});

export const VAULT_CRYPTO_SUITE = Object.freeze({
  PUBLIC_NONE: 0n,
  CLASSICAL: 1n,
  HYBRID: 2n,
});

export const PUBLIC_POST_BODY_MAX_BYTES = 1024;
export const PUBLIC_BODY_LAYOUT = 'platho.public-byte-layout.v1';
export const PUBLIC_HEADER_MAGIC = 'PPH1';
export const PUBLIC_BODY_VERSION = 1;
export const PUBLIC_BODY_KIND = Object.freeze({
  POST: 1,
  COMMENT: 2,
  IMAGE_POST: 3,
  IMAGE_COMMENT: 4,
  AVATAR: 5,
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
export const PROFILE_AVATAR_NOTIFY_VALUE_NANOTONS = 30_000_000n;

export const VAULT_RESERVES_NANOTONS = Object.freeze({
  userStateStorage: 10_000_000n,
  keyRecordStandardStorage: 5_000_000n,
  keyRecordLongTermStorage: 30_000_000n,
  receiveIntentStorage: 5_000_000n,
  stateGrowthExec: 2_000_000n,
  depositTonExec: 2_000_000n,
  withdrawTonExec: 2_000_000n,
  withdrawAthMinValue: 40_000_000n,
});

export const ATH_WALLET_RESERVES_NANOTONS = Object.freeze({
  transferNotifyAckValue: 1_000_000n,
  internalTransferAckValue: 3_000_000n,
  internalTransferSourceAckValue: 1_000_000n,
  internalTransferFwdFeeAllowance: 21_000_000n,
  transferNotifyMinValue: 30_000_000n,
  transferNotifyStorageEndowment: 2_000_000n,
  internalTransferExec: 2_000_000n,
  burnNotificationExec: 2_000_000n,
  transferNotifyExec: 7_000_000n,
  ownerRequestExec: 2_000_000n,
  notifyOwnerRequestExec: 10_000_000n,
});

export const USERNAME_REGISTRY_RESERVES_NANOTONS = Object.freeze({
  athTransferExec: 30_000_000n,
  dueFlushLocalExec: 2_000_000n,
});

export const RECEIVE_ASSETS = Object.freeze({
  TON: 1n,
  ATH: 2n,
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

function serializeBoc(root) {
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

async function computeCellHashAndDepth(cell, cache = new WeakMap()) {
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

function parseBocBase64(value) {
  const bytes = base64ToBytes(assertString(value, 'BoC'));
  if (bytes.length < 10 || BOC_MAGIC.some((byte, index) => bytes[index] !== byte)) {
    throw new Error('Invalid BoC magic');
  }
  let offset = 4;
  const sizeBytes = bytes[offset]; offset += 1;
  const offsetBytes = bytes[offset]; offset += 1;
  if (sizeBytes < 1 || sizeBytes > 4 || offsetBytes < 1 || offsetBytes > 4) {
    throw new Error('Unsupported BoC counter width');
  }
  const cellsCount = Number(readBigUintBytes(bytes, offset, sizeBytes, 'BOC cells count')); offset += sizeBytes;
  const rootsCount = Number(readBigUintBytes(bytes, offset, sizeBytes, 'BOC roots count')); offset += sizeBytes;
  const absentCount = Number(readBigUintBytes(bytes, offset, sizeBytes, 'BOC absent count')); offset += sizeBytes;
  const totalCellsSize = Number(readBigUintBytes(bytes, offset, offsetBytes, 'BOC total cells size')); offset += offsetBytes;
  if (rootsCount !== 1 || absentCount !== 0) throw new Error('Unsupported BoC root/absent count');
  const rootIndex = Number(readBigUintBytes(bytes, offset, sizeBytes, 'BOC root index')); offset += sizeBytes;
  const cellsStart = offset;
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
  if (offset !== cellsStart + totalCellsSize) throw new Error('BOC cell size mismatch');
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

export function beginCell() {
  return new TinyCellBuilder();
}

function normalizeUsernameBytes(username) {
  const value = assertString(username, 'username');
  const raw = value.toLowerCase().endsWith('.ath') ? value.slice(0, -4) : value;
  if (raw.length < 4 || raw.length > 32) throw new RangeError('username must be 4-32 ASCII chars');
  if (!/^[a-z0-9]+$/.test(raw)) throw new RangeError('username must contain only lowercase ASCII letters and digits');
  return new TextEncoder().encode(raw);
}

function keyRecordStorageEndowment(cryptoSuiteMask) {
  const mask = toBigInt(cryptoSuiteMask, 'crypto_suite_mask');
  if (mask === 1n) return VAULT_RESERVES_NANOTONS.keyRecordStandardStorage;
  if (mask === 2n) return VAULT_RESERVES_NANOTONS.keyRecordLongTermStorage;
  throw new RangeError('Unsupported crypto suite mask for Vault key storage quote');
}

export function estimateVaultAttachedValueNanotons(type, params = {}, context = {}) {
  assertString(type, 'type');
  const userExists = context.userExists === true;
  const recipientUserExists = context.recipientUserExists === true;

  if (type === 'DepositTon') {
    return assertUint(params.amount, 128, 'amount')
      + VAULT_RESERVES_NANOTONS.depositTonExec
      + (userExists ? 0n : VAULT_RESERVES_NANOTONS.userStateStorage);
  }
  if (type === 'WithdrawTon') return VAULT_RESERVES_NANOTONS.withdrawTonExec;
  if (type === 'WithdrawAth') return VAULT_RESERVES_NANOTONS.withdrawAthMinValue;
  if (type === 'RegisterMessagingKeys') {
    return keyRecordStorageEndowment(params.crypto_suite_mask)
      + VAULT_RESERVES_NANOTONS.stateGrowthExec
      + (userExists ? 0n : VAULT_RESERVES_NANOTONS.userStateStorage);
  }
  if (type === 'ReplaceMessagingKeys') {
    return keyRecordStorageEndowment(params.crypto_suite_mask)
      + VAULT_RESERVES_NANOTONS.stateGrowthExec;
  }
  if (type === 'CreateReceiveIntent') {
    return VAULT_RESERVES_NANOTONS.receiveIntentStorage
      + VAULT_RESERVES_NANOTONS.stateGrowthExec;
  }
  if (type === 'ClaimReceiveIntent') {
    return recipientUserExists ? 0n : VAULT_RESERVES_NANOTONS.userStateStorage
      + VAULT_RESERVES_NANOTONS.stateGrowthExec;
  }
  if (type === 'CancelReceiveIntent') {
    return 0n;
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
  if (type === 'ATHTransferRequestWithNotify' || type === 'ATHTransferRequestMintUsername' || type === 'ATHTransferRequestProfileAvatar') {
    const notifyValue = params.notify_value ?? ATH_WALLET_RESERVES_NANOTONS.transferNotifyMinValue;
    return athNotifyTransferValue(notifyValue)
      + ATH_WALLET_RESERVES_NANOTONS.notifyOwnerRequestExec;
  }
  throw new Error(`Unsupported ATHWallet message type ${type}`);
}

export function estimateUsernameRegistryAttachedValueNanotons(type) {
  assertString(type, 'type');
  if (type === 'FlushAthRefundDue') {
    return USERNAME_REGISTRY_RESERVES_NANOTONS.athTransferExec
      + USERNAME_REGISTRY_RESERVES_NANOTONS.dueFlushLocalExec;
  }
  throw new Error(`Unsupported UsernameRegistry message type ${type}`);
}

function vaultBalancePublishOwner(params) {
  return assertString(params.owner_wallet ?? params.ownerWallet, 'owner_wallet');
}

function vaultBalancePublishManifestHash(params) {
  return params.deployment_manifest_hash
    ?? params.deploymentManifestHash
    ?? params.manifest_hash
    ?? params.manifestHash;
}

function vaultBalancePublishVaultAddress(params) {
  return params.vault_address ?? params.vaultAddress;
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
    .address(vaultBalancePublishVaultAddress(params), 'vault_address')
    .uint(VAULT_PUBLISH_KIND.PRIVATE, 8, 'publish_kind')
    .address(vaultBalancePublishOwner(params), 'owner_wallet')
    .uint(params.client_nonce ?? params.clientNonce, 64, 'client_nonce')
    .uint(params.max_charge ?? params.maxCharge, 128, 'max_charge')
    .ref(payload, 'payload')
    .endCell();
}

function publicVaultBalancePublishSignedDataCell(params) {
  const publish = assertObject(params.publish ?? params, 'publish');
  const payload = beginCell()
    .uint(publishHashValue(publish.header_hash ?? publish.header_0_hash, 'publish.header_hash'), 256, 'header_hash')
    .uint(publishHashValue(publish.body_hash, 'publish.body_hash'), 256, 'body_hash')
    .ref(publishCellFromPayload(publish.header_cell ?? publish.header_0_cell, 'publish.header_cell'), 'header')
    .ref(publishCellFromPayload(publish.body_cell, 'publish.body_cell'), 'body')
    .endCell();
  return beginCell()
    .uint(VAULT_BALANCE_PUBLISH_SIGNING_DOMAIN, 32, 'domain_magic')
    .uint(vaultBalancePublishManifestHash(params), 256, 'deployment_manifest_hash')
    .address(vaultBalancePublishVaultAddress(params), 'vault_address')
    .uint(VAULT_PUBLISH_KIND.PUBLIC, 8, 'publish_kind')
    .address(vaultBalancePublishOwner(params), 'owner_wallet')
    .uint(params.client_nonce ?? params.clientNonce, 64, 'client_nonce')
    .uint(params.max_charge ?? params.maxCharge, 128, 'max_charge')
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

export function buildVaultMessageBody(type, params = {}) {
  assertObject(params, 'params');
  switch (type) {
    case 'DepositTon':
      return beginVaultBody(VAULT_OPS.DepositTon)
        .uint(params.amount, 128, 'amount')
        .toBocBase64();
    case 'WithdrawTon':
      return beginVaultBody(VAULT_OPS.WithdrawTon)
        .uint(params.amount, 128, 'amount')
        .address(params.recipient, 'recipient')
        .toBocBase64();
    case 'WithdrawAth':
      return beginVaultBody(VAULT_OPS.WithdrawAth)
        .uint(params.query_id, 64, 'query_id')
        .uint(params.amount, 128, 'amount')
        .address(params.recipient, 'recipient')
        .toBocBase64();
    case 'RegisterMessagingKeys':
      return beginVaultBody(VAULT_OPS.RegisterMessagingKeys)
        .uint(params.enc_pubkey, 256, 'enc_pubkey')
        .uint(params.sign_pubkey, 256, 'sign_pubkey')
        .uint(params.pq_kem_pubkey_hash, 256, 'pq_kem_pubkey_hash')
        .uint(params.pq_kem_pubkey_len, 16, 'pq_kem_pubkey_len')
        .ref(pqKemPubkeyCellFromParams(params), 'pq_kem_pubkey')
        .uint(params.crypto_suite_mask, 16, 'crypto_suite_mask')
        .toBocBase64();
    case 'ReplaceMessagingKeys':
      return beginVaultBody(VAULT_OPS.ReplaceMessagingKeys)
        .uint(params.enc_pubkey, 256, 'enc_pubkey')
        .uint(params.sign_pubkey, 256, 'sign_pubkey')
        .uint(params.pq_kem_pubkey_hash, 256, 'pq_kem_pubkey_hash')
        .uint(params.pq_kem_pubkey_len, 16, 'pq_kem_pubkey_len')
        .ref(pqKemPubkeyCellFromParams(params), 'pq_kem_pubkey')
        .uint(params.crypto_suite_mask, 16, 'crypto_suite_mask')
        .toBocBase64();
    case 'CreateReceiveIntent':
      return beginVaultBody(VAULT_OPS.CreateReceiveIntent)
        .uint(params.asset, 8, 'asset')
        .uint(params.amount, 128, 'amount')
        .address(params.recipient_wallet, 'recipient_wallet')
        .uint(params.commitment, 256, 'commitment')
        .uint(params.client_nonce, 64, 'client_nonce')
        .toBocBase64();
    case 'ClaimReceiveIntent':
      return beginVaultBody(VAULT_OPS.ClaimReceiveIntent)
        .uint(params.intent_id, 256, 'intent_id')
        .uint(params.secret32, 256, 'secret32')
        .toBocBase64();
    case 'CancelReceiveIntent':
      return beginVaultBody(VAULT_OPS.CancelReceiveIntent)
        .uint(params.intent_id, 256, 'intent_id')
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
    case 'ATHTransferRequestMintUsername': {
      const usernameBytes = normalizeUsernameBytes(params.username);
      return beginAthWalletBody(ATH_WALLET_OPS.ATHTransferRequestMintUsername)
        .uint(params.query_id, 64, 'query_id')
        .uint(params.amount, 128, 'amount')
        .address(params.recipient, 'recipient')
        .address(params.response_destination, 'response_destination')
        .uint(params.notify_value, 128, 'notify_value')
        .uint(usernameBytes.length, 8, 'username_len')
        .bytesValue(usernameBytes, usernameBytes.length, 'username')
        .toBocBase64();
    }
    case 'ATHTransferRequestProfileAvatar':
      return beginAthWalletBody(ATH_WALLET_OPS.ATHTransferRequestProfileAvatar)
        .uint(params.query_id, 64, 'query_id')
        .uint(params.amount, 128, 'amount')
        .address(params.recipient, 'recipient')
        .address(params.response_destination, 'response_destination')
        .uint(params.notify_value, 128, 'notify_value')
        .ref(beginCell()
          .uint(params.avatar_hash, 256, 'avatar_hash')
          .uint(params.avatar_entry_id ?? 0n, 64, 'avatar_entry_id')
          .uint(params.avatar_stream_id, 128, 'avatar_stream_id')
          .uint(params.avatar_part_count, 16, 'avatar_part_count')
          .uint(params.media_format ?? PUBLIC_BODY_MEDIA_FORMATS.WEBP, 8, 'media_format')
          .endCell(), 'avatar_ref')
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
    case 'FlushAthRefundDue':
      return beginUsernameRegistryBody(USERNAME_REGISTRY_OPS.FlushAthRefundDue)
        .uint(params.query_id, 64, 'query_id')
        .address(params.owner_wallet, 'owner_wallet')
        .toBocBase64();
    default:
      throw new Error(`Unsupported UsernameRegistry message type ${type}`);
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

export function createUsernameRegistryWalletMessage(type, params = {}, options = {}) {
  const address = assertString(options.usernameRegistryAddress, 'usernameRegistryAddress');
  const amount = options.valueNanotons !== undefined
    ? assertUint(options.valueNanotons, 128, 'valueNanotons')
    : estimateUsernameRegistryAttachedValueNanotons(type, params);
  return {
    address,
    amount: amount.toString(),
    payload: buildUsernameRegistryMessageBody(type, params),
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
  const isImage = kind === PUBLIC_BODY_KIND.IMAGE_POST || kind === PUBLIC_BODY_KIND.IMAGE_COMMENT;
  const mediaFormat = isImage
    ? Number(input?.mediaFormat ?? input?.media_format ?? input?.format ?? PUBLIC_BODY_MEDIA_FORMATS.WEBP)
    : PUBLIC_BODY_MEDIA_FORMATS.NONE;
  if (partCount <= 0 || partIndex >= partCount) throw new RangeError('public part index mismatch');
  const partBytes = concatBytes(
    streamId,
    bigintToBytes(BigInt(partIndex), 2, 'part_index'),
    bigintToBytes(BigInt(partCount), 2, 'part_count'),
    new Uint8Array(4),
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
  const commentKind = kind === PUBLIC_BODY_KIND.IMAGE_COMMENT ? PUBLIC_BODY_KIND.IMAGE_COMMENT : PUBLIC_BODY_KIND.COMMENT;
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
  const maxBytes = options.maxBytes ?? PUBLIC_POST_BODY_MAX_BYTES;
  const headerBytes = publicHeaderBytes(input);
  const bodyBytes = publicBodyBytes(input);
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
    headerBytes: headerBytes.length,
    bodyBytes: bodyBytes.length,
    bytes: bodyBytes.length,
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
    for (let i = 28; i < 32; i += 1) {
      if (header[i] !== 0) throw new Error('Unsupported public part reserved bytes');
    }
    return {
      streamId,
      stream_id: `0x${bytesToHex(streamId)}`,
      partIndex,
      part_index: partIndex,
      partCount,
      part_count: partCount,
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
