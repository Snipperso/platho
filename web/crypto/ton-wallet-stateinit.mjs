import { parseTonAddress } from './platho-crypto.mjs';

const BOC_GENERIC_MAGIC = 0xb5ee9c72;
const BOC_INDEXED_MAGIC = 0x68ff65f3;
const BOC_INDEXED_CRC32_MAGIC = 0xacc3a728;
const CRC32C_POLY = 0x82f63b78;

const encoder = new TextEncoder();

export const KNOWN_TON_WALLET_CODE_HASHES = Object.freeze({
  a0cfc2c48aee16a271f2cfc0b7382d81756cecb1017d077faaab3bb602f6868c: Object.freeze({ version: 'v1r1', publicKeyOffsetBits: 32 }),
  d4902fcc9fad74698fa8e353220a68da0dcf72e32bcb2eb9ee04217c17d3062c: Object.freeze({ version: 'v1r2', publicKeyOffsetBits: 32 }),
  '587cc789eff1c84f46ec3797e45fc809a14ff5ae24f1e0c7a6a99cc9dc9061ff': Object.freeze({ version: 'v1r3', publicKeyOffsetBits: 32 }),
  '5c9a5e68c108e18721a07c42f9956bfb39ad77ec6d624b60c576ec88eee65329': Object.freeze({ version: 'v2r1', publicKeyOffsetBits: 32 }),
  fe9530d3243853083ef2ef0b4c2908c0abf6fa1c31ea243aacaa5bf8c7d753f1: Object.freeze({ version: 'v2r2', publicKeyOffsetBits: 32 }),
  b61041a58a7980b946e8fb9e198e3c904d24799ffa36574ea4251c41a566f581: Object.freeze({ version: 'v3r1', publicKeyOffsetBits: 64 }),
  '84dafa449f98a6987789ba232358072bc0f76dc4524002a5d0918b9a75d2d599': Object.freeze({ version: 'v3r2', publicKeyOffsetBits: 64 }),
  '64dd54805522c5be8a9db59cea0105ccf0d08786ca79beb8cb79e880a8d7322d': Object.freeze({ version: 'v4r1', publicKeyOffsetBits: 64 }),
  feb5ff6820e2ff0d9483e7e0d62c817d846789fb4ae580c878866d959dabd5c0: Object.freeze({ version: 'v4r2', publicKeyOffsetBits: 64 }),
  '20834b7b72b112147e1b2fb457b84e74d1a30f04f737d4f62a668e9552d2b72f': Object.freeze({ version: 'v5r1', publicKeyOffsetBits: 65 }),
});

function getCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new Error('WebCrypto is required for TON wallet StateInit verification');
  }
  return globalThis.crypto;
}

function toUint8Array(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new TypeError('Expected byte array');
}

function bytesToHex(bytes) {
  return [...toUint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left, right) {
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

async function sha256(bytes) {
  return new Uint8Array(await getCrypto().subtle.digest('SHA-256', toUint8Array(bytes)));
}

function base64Decode(value) {
  if (typeof value !== 'string') throw new TypeError('Expected base64 string');
  const text = value.trim().replaceAll('-', '+').replaceAll('_', '/');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text)) throw new Error('Invalid base64 encoding');
  const padded = text.padEnd(Math.ceil(text.length / 4) * 4, '=');
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(padded, 'base64'));
  }
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function readUintBe(bytes, offset, length, name) {
  if (length < 1 || length > 6) throw new Error(`${name} uses unsupported integer width`);
  if (offset + length > bytes.length) throw new Error(`${name} is out of bounds`);
  let value = 0;
  for (let i = 0; i < length; i += 1) value = value * 256 + bytes[offset + i];
  if (!Number.isSafeInteger(value)) throw new Error(`${name} exceeds safe integer range`);
  return value;
}

function crc32c(bytes) {
  let crc = 0xffffffff;
  for (const byte of toUint8Array(bytes)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) !== 0 ? (crc >>> 1) ^ CRC32C_POLY : crc >>> 1;
    }
  }
  const value = (crc ^ 0xffffffff) >>> 0;
  return new Uint8Array([
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ]);
}

function paddedBufferBitLength(bytes) {
  for (let i = bytes.length - 1; i >= 0; i -= 1) {
    const testByte = bytes[i];
    if (testByte === 0) continue;
    let bitPos = testByte & -testByte;
    if ((bitPos & 1) === 0) bitPos = Math.log2(bitPos) + 1;
    return (i > 0 ? i << 3 : 0) + 8 - bitPos;
  }
  return 0;
}

function getBit(cell, index) {
  if (index < 0 || index >= cell.bitLength) throw new Error('Cell bit index is out of bounds');
  return (cell.bits[index >> 3] & (1 << (7 - (index % 8)))) !== 0;
}

function setBit(bytes, index, value) {
  if (value) bytes[index >> 3] |= 1 << (7 - (index % 8));
}

function bitsToPaddedBytes(cell) {
  const size = Math.ceil(cell.bitLength / 8);
  const out = new Uint8Array(size);
  for (let i = 0; i < cell.bitLength; i += 1) setBit(out, i, getBit(cell, i));
  if (cell.bitLength % 8 !== 0) setBit(out, cell.bitLength, true);
  return out;
}

function getHashesCount(levelMask) {
  let count = 0;
  let mask = levelMask & 7;
  for (let i = 0; i < 3; i += 1) {
    count += mask & 1;
    mask >>= 1;
  }
  return count + 1;
}

function readCell(bytes, cursor, sizeBytes) {
  if (cursor + 2 > bytes.length) throw new Error('BOC cell descriptor is truncated');
  const d1 = bytes[cursor];
  const d2 = bytes[cursor + 1];
  let offset = cursor + 2;
  const refsCount = d1 & 7;
  const exotic = (d1 & 8) !== 0;
  const hasHashes = (d1 & 16) !== 0;
  const levelMask = d1 >> 5;
  const dataByteSize = Math.ceil(d2 / 2);
  const paddingAdded = (d2 % 2) !== 0;
  if (refsCount > 4) throw new Error('BOC cell has too many refs');
  if (hasHashes) offset += getHashesCount(levelMask) * (32 + 2);
  if (offset + dataByteSize > bytes.length) throw new Error('BOC cell bits are truncated');
  const bitBytes = bytes.slice(offset, offset + dataByteSize);
  offset += dataByteSize;
  const bitLength = paddingAdded ? paddedBufferBitLength(bitBytes) : dataByteSize * 8;
  const refs = [];
  for (let i = 0; i < refsCount; i += 1) {
    refs.push(readUintBe(bytes, offset, sizeBytes, 'BOC cell ref index'));
    offset += sizeBytes;
  }
  return {
    cell: {
      bits: bitBytes,
      bitLength,
      refIndexes: refs,
      refs: [],
      exotic,
      hashPromise: null,
      depthValue: null,
    },
    offset,
  };
}

function parseBocHeader(bytes) {
  if (bytes.length < 8) throw new Error('BOC is too short');
  const magic = readUintBe(bytes, 0, 4, 'BOC magic');
  let offset = 4;
  if (magic === BOC_INDEXED_MAGIC || magic === BOC_INDEXED_CRC32_MAGIC) {
    const sizeBytes = bytes[offset];
    const offBytes = bytes[offset + 1];
    offset += 2;
    const cells = readUintBe(bytes, offset, sizeBytes, 'BOC cells count');
    offset += sizeBytes;
    const roots = readUintBe(bytes, offset, sizeBytes, 'BOC roots count');
    offset += sizeBytes;
    const absent = readUintBe(bytes, offset, sizeBytes, 'BOC absent count');
    offset += sizeBytes;
    const totalCellSize = readUintBe(bytes, offset, offBytes, 'BOC cell data size');
    offset += offBytes;
    const indexSize = cells * offBytes;
    const cellDataOffset = offset + indexSize;
    const root = [0];
    if (magic === BOC_INDEXED_CRC32_MAGIC) {
      const expected = crc32c(bytes.subarray(0, bytes.length - 4));
      const actual = bytes.subarray(bytes.length - 4);
      if (!constantTimeEqual(expected, actual)) throw new Error('BOC CRC32C mismatch');
    }
    return { sizeBytes, cells, roots, absent, totalCellSize, root, cellDataOffset };
  }
  if (magic !== BOC_GENERIC_MAGIC) throw new Error('Invalid BOC magic');
  const flagsAndSize = bytes[offset];
  offset += 1;
  const hasIdx = (flagsAndSize & 0x80) !== 0;
  const hasCrc32c = (flagsAndSize & 0x40) !== 0;
  const hasCacheBits = (flagsAndSize & 0x20) !== 0;
  const flags = (flagsAndSize >> 3) & 3;
  const sizeBytes = flagsAndSize & 7;
  const offBytes = bytes[offset];
  offset += 1;
  if (hasCacheBits || flags !== 0) throw new Error('Unsupported BOC flags');
  const cells = readUintBe(bytes, offset, sizeBytes, 'BOC cells count');
  offset += sizeBytes;
  const roots = readUintBe(bytes, offset, sizeBytes, 'BOC roots count');
  offset += sizeBytes;
  const absent = readUintBe(bytes, offset, sizeBytes, 'BOC absent count');
  offset += sizeBytes;
  const totalCellSize = readUintBe(bytes, offset, offBytes, 'BOC cell data size');
  offset += offBytes;
  const root = [];
  for (let i = 0; i < roots; i += 1) {
    root.push(readUintBe(bytes, offset, sizeBytes, 'BOC root index'));
    offset += sizeBytes;
  }
  if (hasIdx) offset += cells * offBytes;
  if (hasCrc32c) {
    const expected = crc32c(bytes.subarray(0, bytes.length - 4));
    const actual = bytes.subarray(bytes.length - 4);
    if (!constantTimeEqual(expected, actual)) throw new Error('BOC CRC32C mismatch');
  }
  return { sizeBytes, cells, roots, absent, totalCellSize, root, cellDataOffset: offset };
}

export function deserializeBoc(bytesLike) {
  const bytes = toUint8Array(bytesLike);
  const header = parseBocHeader(bytes);
  if (header.roots !== 1) throw new Error('TON wallet StateInit BOC must have exactly one root');
  if (header.absent !== 0) throw new Error('TON wallet StateInit BOC must not have absent cells');
  const cellDataEnd = header.cellDataOffset + header.totalCellSize;
  if (cellDataEnd > bytes.length) throw new Error('BOC cell data is truncated');
  const cellData = bytes.subarray(header.cellDataOffset, cellDataEnd);
  const cells = [];
  let offset = 0;
  for (let i = 0; i < header.cells; i += 1) {
    const read = readCell(cellData, offset, header.sizeBytes);
    cells.push(read.cell);
    offset = read.offset;
  }
  if (offset !== cellData.length) throw new Error('BOC cell data has trailing bytes');
  for (let i = cells.length - 1; i >= 0; i -= 1) {
    const cell = cells[i];
    if (cell.exotic) throw new Error('Exotic cells are not supported for TON wallet StateInit');
    if (cell.bitLength > 1023) throw new Error('BOC cell bits exceed ordinary cell limit');
    cell.refs = cell.refIndexes.map((refIndex) => {
      if (refIndex <= i || refIndex >= cells.length) throw new Error('Invalid BOC cell ref order');
      return cells[refIndex];
    });
    delete cell.refIndexes;
  }
  const rootIndex = header.root[0];
  if (rootIndex < 0 || rootIndex >= cells.length) throw new Error('BOC root index is out of bounds');
  return cells[rootIndex];
}

export function parseBocBase64(value) {
  return deserializeBoc(base64Decode(value));
}

function cellDepth(cell) {
  if (cell.depthValue !== null) return cell.depthValue;
  let depth = 0;
  for (const ref of cell.refs) depth = Math.max(depth, cellDepth(ref) + 1);
  cell.depthValue = depth;
  return depth;
}

async function cellHash(cell) {
  if (cell.hashPromise) return cell.hashPromise;
  cell.hashPromise = (async () => {
    const bits = bitsToPaddedBytes(cell);
    const repr = new Uint8Array(2 + bits.length + cell.refs.length * 34);
    repr[0] = cell.refs.length;
    repr[1] = Math.ceil(cell.bitLength / 8) + Math.floor(cell.bitLength / 8);
    repr.set(bits, 2);
    let cursor = 2 + bits.length;
    for (const ref of cell.refs) {
      const depth = cellDepth(ref);
      repr[cursor] = Math.floor(depth / 256);
      repr[cursor + 1] = depth % 256;
      cursor += 2;
    }
    for (const ref of cell.refs) {
      repr.set(await cellHash(ref), cursor);
      cursor += 32;
    }
    return sha256(repr);
  })();
  return cell.hashPromise;
}

export async function hashTonCellHex(cell) {
  return bytesToHex(await cellHash(cell));
}

class TonBitReader {
  constructor(cell) {
    this.cell = cell;
    this.offset = 0;
    this.refOffset = 0;
  }

  remainingBits() {
    return this.cell.bitLength - this.offset;
  }

  remainingRefs() {
    return this.cell.refs.length - this.refOffset;
  }

  loadBit() {
    if (this.remainingBits() < 1) throw new Error('StateInit bit slice is truncated');
    const bit = getBit(this.cell, this.offset);
    this.offset += 1;
    return bit;
  }

  skip(bits) {
    if (bits < 0 || this.remainingBits() < bits) throw new Error('StateInit bit slice is truncated');
    this.offset += bits;
  }

  loadBuffer(byteLength) {
    const bitLength = byteLength * 8;
    if (this.remainingBits() < bitLength) throw new Error('StateInit buffer is truncated');
    const out = new Uint8Array(byteLength);
    for (let i = 0; i < bitLength; i += 1) {
      setBit(out, i, getBit(this.cell, this.offset + i));
    }
    this.offset += bitLength;
    return out;
  }

  loadMaybeRef() {
    if (!this.loadBit()) return null;
    if (this.remainingRefs() < 1) throw new Error('StateInit ref slice is truncated');
    const ref = this.cell.refs[this.refOffset];
    this.refOffset += 1;
    return ref;
  }
}

export function loadTonStateInit(root) {
  const reader = new TonBitReader(root);
  if (reader.loadBit()) throw new Error('StateInit split_depth is not supported for standard wallets');
  if (reader.loadBit()) throw new Error('StateInit special TickTock is not supported for standard wallets');
  const code = reader.loadMaybeRef();
  const data = reader.loadMaybeRef();
  const hasLibraries = reader.loadBit();
  if (hasLibraries) throw new Error('StateInit libraries are not supported for standard wallets');
  if (reader.remainingBits() !== 0 || reader.remainingRefs() !== 0) {
    throw new Error('StateInit has trailing data');
  }
  return { code, data };
}

function normalizeWalletCodeHashes(value) {
  const source = value ?? KNOWN_TON_WALLET_CODE_HASHES;
  const out = new Map();
  if (source instanceof Map) {
    for (const [hash, layout] of source.entries()) out.set(String(hash).toLowerCase(), layout);
    return out;
  }
  for (const [hash, layout] of Object.entries(source)) out.set(hash.toLowerCase(), layout);
  return out;
}

function readWalletPublicKey(dataCell, layout) {
  if (!dataCell) throw new Error('TON wallet StateInit is missing data');
  const offsetBits = layout.publicKeyOffsetBits;
  if (!Number.isSafeInteger(offsetBits) || offsetBits < 0) {
    throw new Error(`TON wallet ${layout.version} has invalid public key offset`);
  }
  const reader = new TonBitReader(dataCell);
  reader.skip(offsetBits);
  return reader.loadBuffer(32);
}

export async function parseTonWalletStateInit(walletStateInit, options = {}) {
  const root = parseBocBase64(walletStateInit);
  const stateInit = loadTonStateInit(root);
  if (!stateInit.code || !stateInit.data) throw new Error('TON wallet StateInit must include code and data');
  const codeHash = await hashTonCellHex(stateInit.code);
  const knownWalletCodeHashes = normalizeWalletCodeHashes(options.knownWalletCodeHashes);
  const layout = knownWalletCodeHashes.get(codeHash);
  if (!layout) {
    throw new Error(`Unsupported TON wallet code hash: ${codeHash}`);
  }
  return {
    root,
    stateInit,
    codeHash,
    walletVersion: layout.version,
    publicKey: readWalletPublicKey(stateInit.data, layout),
    addressHash: await cellHash(root),
  };
}

export async function resolveTonWalletPublicKeyFromStateInit(account, options = {}) {
  const walletStateInit = account?.walletStateInit ?? account?.wallet_state_init;
  if (typeof walletStateInit !== 'string' || walletStateInit.length === 0) {
    throw new Error('TON Connect account is missing walletStateInit');
  }
  const address = parseTonAddress(account.address);
  const parsed = await parseTonWalletStateInit(walletStateInit, options);
  if (!constantTimeEqual(parsed.addressHash, address.hash)) {
    throw new Error('TON wallet StateInit hash does not match account address');
  }
  return {
    publicKey: parsed.publicKey,
    walletVersion: parsed.walletVersion,
    codeHash: parsed.codeHash,
    address: address.raw,
  };
}

export async function tonStateInitSelfTestFromFixture(fixture) {
  const resolved = await resolveTonWalletPublicKeyFromStateInit(fixture.account, {
    knownWalletCodeHashes: fixture.knownWalletCodeHashes,
  });
  if (!constantTimeEqual(resolved.publicKey, fixture.expectedPublicKey)) {
    throw new Error('TON wallet StateInit fixture public key mismatch');
  }
  let addressMismatchRejected = false;
  try {
    await resolveTonWalletPublicKeyFromStateInit({
      ...fixture.account,
      address: `0:${'00'.repeat(32)}`,
    }, {
      knownWalletCodeHashes: fixture.knownWalletCodeHashes,
    });
  } catch {
    addressMismatchRejected = true;
  }
  if (!addressMismatchRejected) throw new Error('TON wallet StateInit address mismatch was not rejected');
  return {
    walletVersion: resolved.walletVersion,
    codeHash: resolved.codeHash,
    publicKeyBytes: resolved.publicKey.length,
    addressBound: true,
    addressMismatchRejected,
  };
}

export function tonWalletStateInitReferenceNote() {
  return encoder.encode('TON wallet StateInit parser uses official wallet code hashes and version-aware data offsets.');
}
