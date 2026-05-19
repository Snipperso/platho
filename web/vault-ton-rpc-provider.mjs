import { parseTonAddress } from './crypto/platho-crypto.mjs';

export class VaultTonRpcProviderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'VaultTonRpcProviderError';
  }
}

const BOC_MAGIC = [0xb5, 0xee, 0x9c, 0x72];
const ADDRESS_SLICE_BITS = 267;
const ADDRESS_CELL_DATA_BYTES = 34;

function assertString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function bytesToBase64(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (typeof Buffer !== 'undefined') return Buffer.from(input).toString('base64');
  let binary = '';
  for (const byte of input) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  assertString(value, 'base64');
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(value, 'base64'));
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function hexToBytes(value) {
  const text = assertString(value, 'hex').replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]*$/.test(text) || text.length % 2 !== 0) {
    throw new Error('Invalid hex string');
  }
  const out = new Uint8Array(text.length / 2);
  for (let index = 0; index < out.length; index += 1) {
    out[index] = Number.parseInt(text.slice(index * 2, index * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function writeBit(bytes, bitOffset, bit) {
  if (bit) bytes[bitOffset >> 3] |= 1 << (7 - (bitOffset & 7));
  return bitOffset + 1;
}

function writeUint(bytes, bitOffset, value, bitLength) {
  let next = bitOffset;
  const bigint = BigInt(value);
  for (let shift = bitLength - 1; shift >= 0; shift -= 1) {
    next = writeBit(bytes, next, ((bigint >> BigInt(shift)) & 1n) === 1n);
  }
  return next;
}

function readUint(bytes, bitOffset, bitLength) {
  let out = 0n;
  for (let index = 0; index < bitLength; index += 1) {
    const bit = (bytes[(bitOffset + index) >> 3] >> (7 - ((bitOffset + index) & 7))) & 1;
    out = (out << 1n) | BigInt(bit);
  }
  return out;
}

function signedWorkchainByte(workchain) {
  if (!Number.isInteger(workchain) || workchain < -128 || workchain > 127) {
    throw new Error('TON workchain must fit int8');
  }
  return workchain < 0 ? 0x100 + workchain : workchain;
}

function unsignedByteToSigned(value) {
  return value > 0x7f ? value - 0x100 : value;
}

function singleCellBoc(dataBytes, dataBits) {
  const cell = new Uint8Array(2 + dataBytes.length);
  cell[0] = 0;
  cell[1] = Math.floor(dataBits / 8) + Math.ceil(dataBits / 8);
  cell.set(dataBytes, 2);

  const boc = new Uint8Array(11 + cell.length);
  let offset = 0;
  boc.set(BOC_MAGIC, offset); offset += 4;
  boc[offset] = 0x01; offset += 1; // no index, no CRC, one-byte counters
  boc[offset] = 0x01; offset += 1; // one-byte total cell size
  boc[offset] = 0x01; offset += 1; // cells count
  boc[offset] = 0x01; offset += 1; // roots count
  boc[offset] = 0x00; offset += 1; // absent cells
  boc[offset] = cell.length; offset += 1;
  boc[offset] = 0x00; offset += 1; // root cell index
  boc.set(cell, offset);
  return bytesToBase64(boc);
}

function readSingleCellBoc(bocBase64) {
  const bytes = base64ToBytes(bocBase64);
  if (bytes.length < 13 || !BOC_MAGIC.every((byte, index) => bytes[index] === byte)) {
    throw new Error('Invalid TON BoC magic');
  }
  let offset = 4;
  const flags = bytes[offset]; offset += 1;
  const sizeBytes = flags & 0x07;
  if (sizeBytes !== 1) throw new Error('Unsupported TON BoC size bytes');
  const hasIndex = (flags & 0x80) !== 0;
  const hasCrc32 = (flags & 0x40) !== 0;
  const offsetBytes = bytes[offset]; offset += 1;
  if (offsetBytes !== 1) throw new Error('Unsupported TON BoC offset bytes');
  const cells = bytes[offset]; offset += 1;
  const roots = bytes[offset]; offset += 1;
  offset += 1; // absent cells
  const totalCellSize = bytes[offset]; offset += 1;
  if (cells !== 1 || roots !== 1) throw new Error('Expected a single-root single-cell BoC');
  offset += roots * sizeBytes;
  if (hasIndex) offset += cells * offsetBytes;
  const cellEnd = offset + totalCellSize;
  if (cellEnd > bytes.length - (hasCrc32 ? 4 : 0)) throw new Error('Invalid TON BoC cell size');
  const refsDescriptor = bytes[offset]; offset += 1;
  const bitsDescriptor = bytes[offset]; offset += 1;
  if ((refsDescriptor & 0x07) !== 0) throw new Error('Address slice BoC must not contain refs');
  const dataBytes = Math.ceil(bitsDescriptor / 2);
  if (offset + dataBytes > cellEnd) throw new Error('Invalid TON cell data size');
  return bytes.subarray(offset, offset + dataBytes);
}

export function encodeTonAddressSliceBoc(address) {
  const parsed = parseTonAddress(address);
  const data = new Uint8Array(ADDRESS_CELL_DATA_BYTES);
  let bitOffset = 0;
  bitOffset = writeBit(data, bitOffset, true);
  bitOffset = writeBit(data, bitOffset, false);
  bitOffset = writeBit(data, bitOffset, false); // no anycast
  bitOffset = writeUint(data, bitOffset, signedWorkchainByte(parsed.workchain), 8);
  for (const byte of parsed.hash) {
    bitOffset = writeUint(data, bitOffset, byte, 8);
  }
  bitOffset = writeBit(data, bitOffset, true); // top-up bit
  if (bitOffset > data.length * 8) throw new Error('TON address slice overflow');
  return singleCellBoc(data, ADDRESS_SLICE_BITS);
}

export function decodeTonAddressSliceBoc(bocBase64) {
  const data = readSingleCellBoc(bocBase64);
  if (data.length < ADDRESS_CELL_DATA_BYTES) throw new Error('Address slice BoC is too short');
  let bitOffset = 0;
  const tag = readUint(data, bitOffset, 2); bitOffset += 2;
  const anycast = readUint(data, bitOffset, 1); bitOffset += 1;
  if (tag !== 2n || anycast !== 0n) throw new Error('Unsupported TON address slice');
  const workchain = unsignedByteToSigned(Number(readUint(data, bitOffset, 8))); bitOffset += 8;
  const hash = new Uint8Array(32);
  for (let index = 0; index < hash.length; index += 1) {
    hash[index] = Number(readUint(data, bitOffset, 8));
    bitOffset += 8;
  }
  return `${workchain}:${bytesToHex(hash)}`;
}

function toStackNumber(value) {
  const bigint = typeof value === 'bigint' ? value : BigInt(value);
  return bigint < 0n ? `-0x${(-bigint).toString(16)}` : `0x${bigint.toString(16)}`;
}

function parseStackBigIntValue(value, name) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'boolean') return value ? -1n : 0n;
  if (typeof value === 'string') {
    const text = value.trim();
    if (/^-?0x[0-9a-fA-F]+$/.test(text)) {
      return text.startsWith('-') ? -BigInt(`0x${text.slice(3)}`) : BigInt(text);
    }
    if (/^-?[0-9]+$/.test(text)) return BigInt(text);
  }
  if (value && typeof value.toString === 'function') {
    return parseStackBigIntValue(value.toString(), name);
  }
  throw new Error(`${name} must be an integer stack item`);
}

function stackItemValue(item) {
  if (Array.isArray(item)) return item[1];
  if (item && typeof item === 'object' && 'value' in item) return item.value;
  return item;
}

function stackItemType(item) {
  if (Array.isArray(item)) return String(item[0] ?? '').toLowerCase();
  if (item && typeof item === 'object' && 'type' in item) return String(item.type ?? '').toLowerCase();
  return typeof item;
}

function readStackInt(stack, index, name) {
  if (index >= stack.length) throw new Error(`Missing ${name} stack item`);
  return parseStackBigIntValue(stackItemValue(stack[index]), name);
}

function readStackBool(stack, index, name) {
  return readStackInt(stack, index, name) !== 0n;
}

function readStackAddress(stack, index, name) {
  if (index >= stack.length) throw new Error(`Missing ${name} stack item`);
  const item = stack[index];
  const value = stackItemValue(item);
  const type = stackItemType(item);
  if (typeof value === 'string') {
    try {
      return parseTonAddress(value).raw;
    } catch {
      if (type.includes('slice') || type === 'cell') return decodeTonAddressSliceBoc(value);
    }
  }
  if (value && typeof value.toString === 'function') return parseTonAddress(value.toString()).raw;
  throw new Error(`${name} must be a TON address stack item`);
}

function extractStack(result) {
  const stack = result?.stack ?? result?.result?.stack;
  if (!Array.isArray(stack)) throw new Error('TON get-method response did not include a stack');
  return stack;
}

export function decodeVaultUserViewStack(result) {
  const stack = extractStack(result);
  return {
    exists: readStackBool(stack, 0, 'Vault user exists'),
    ton_balance: readStackInt(stack, 1, 'Vault user ton_balance'),
    ath_balance: readStackInt(stack, 2, 'Vault user ath_balance'),
    message_budget_ton: readStackInt(stack, 3, 'Vault user message_budget_ton'),
    budget_epoch: readStackInt(stack, 4, 'Vault user budget_epoch'),
    current_key_id: readStackInt(stack, 5, 'Vault user current_key_id'),
  };
}

export function decodeVaultKeyRecordViewStack(result) {
  const stack = extractStack(result);
  return {
    exists: readStackBool(stack, 0, 'Vault key record exists'),
    owner_wallet: readStackAddress(stack, 1, 'Vault key record owner_wallet'),
    key_generation: readStackInt(stack, 2, 'Vault key record key_generation'),
    enc_pubkey: readStackInt(stack, 3, 'Vault key record enc_pubkey'),
    sign_pubkey: readStackInt(stack, 4, 'Vault key record sign_pubkey'),
    pq_kem_pubkey_hash: readStackInt(stack, 5, 'Vault key record pq_kem_pubkey_hash'),
    pq_kem_pubkey_len: readStackInt(stack, 6, 'Vault key record pq_kem_pubkey_len'),
    crypto_suite_mask: readStackInt(stack, 7, 'Vault key record crypto_suite_mask'),
    created_at: readStackInt(stack, 8, 'Vault key record created_at'),
    created_lt: readStackInt(stack, 9, 'Vault key record created_lt'),
    revoked_at: readStackInt(stack, 10, 'Vault key record revoked_at'),
    revoked_lt: readStackInt(stack, 11, 'Vault key record revoked_lt'),
  };
}

export function createTonCenterV3VaultTransport(options = {}) {
  const endpoint = assertString(options.endpoint, 'TON RPC endpoint');
  const fetchImpl = options.fetch ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new VaultTonRpcProviderError('fetch is unavailable');
  return {
    kind: 'toncenter-v3',
    async runGetMethod({ address, method, stack }) {
      const headers = { 'Content-Type': 'application/json', ...(options.headers ?? {}) };
      if (options.apiKey) headers['X-API-Key'] = options.apiKey;
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ address, method, stack }),
      });
      if (!response.ok) {
        throw new VaultTonRpcProviderError(`TON RPC get-method HTTP ${response.status}`);
      }
      const json = await response.json();
      const exitCode = json.exit_code ?? json.exitCode ?? json.result?.exit_code ?? json.result?.exitCode ?? 0;
      if (Number(exitCode) !== 0) {
        throw new VaultTonRpcProviderError(`TON RPC get-method exit code ${exitCode}`);
      }
      return json;
    },
  };
}

function resolveTransport(options) {
  if (options.transport) return options.transport;
  const globalTransport = globalThis.plathoTonRpcTransport;
  if (globalTransport) return globalTransport;
  const endpoint = options.endpoint ?? globalThis.plathoTonRpcEndpoint ?? globalThis.PLATHO_TON_RPC_ENDPOINT;
  if (endpoint) {
    return createTonCenterV3VaultTransport({
      endpoint,
      apiKey: options.apiKey ?? globalThis.plathoTonRpcApiKey ?? globalThis.PLATHO_TON_RPC_API_KEY,
      headers: options.headers,
      fetch: options.fetch,
    });
  }
  return null;
}

function resolveVaultAddress(configured, callOptions) {
  const address = callOptions?.vaultAddress ?? configured ?? globalThis.plathoVaultAddress ?? globalThis.PLATHO_VAULT_ADDRESS;
  if (!address) throw new VaultTonRpcProviderError('Vault contract address is not configured');
  return parseTonAddress(address).raw;
}

export function createVaultTonRpcProvider(options = {}) {
  return {
    kind: options.kind ?? options.transport?.kind ?? 'ton-rpc',
    async getUser(ownerWallet, callOptions = {}) {
      const transport = resolveTransport(options);
      if (!transport?.runGetMethod) throw new VaultTonRpcProviderError('TON RPC transport is not configured');
      const vaultAddress = resolveVaultAddress(options.vaultAddress, callOptions);
      const owner = parseTonAddress(ownerWallet).raw;
      return decodeVaultUserViewStack(await transport.runGetMethod({
        address: vaultAddress,
        method: 'get_user',
        stack: [{ type: 'slice', value: encodeTonAddressSliceBoc(owner) }],
      }));
    },
    async getKeyRecord(keyId, callOptions = {}) {
      const transport = resolveTransport(options);
      if (!transport?.runGetMethod) throw new VaultTonRpcProviderError('TON RPC transport is not configured');
      const vaultAddress = resolveVaultAddress(options.vaultAddress, callOptions);
      return decodeVaultKeyRecordViewStack(await transport.runGetMethod({
        address: vaultAddress,
        method: 'get_key_record',
        stack: [{ type: 'num', value: toStackNumber(keyId) }],
      }));
    },
  };
}

const defaultProvider = createVaultTonRpcProvider();

export default defaultProvider;
