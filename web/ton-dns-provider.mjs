import { parseTonAddress } from './crypto/platho-crypto.mjs?v=12';
import { beginCell, tonCell } from './pwa-contract-transactions.mjs?v=25';
import { createTonCenterV3VaultTransport } from './vault-ton-rpc-provider.mjs?v=36';

export class TonDnsProviderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TonDnsProviderError';
  }
}

export const TON_DNS_RECORD_TAGS = Object.freeze({
  NEXT_RESOLVER: 0xba93,
  WALLET: 0x9fd3,
});

const TON_DNS_NAME_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+ton$/;
const MAX_TON_DNS_BYTES = 126;
const MAX_DNS_RECURSION = 8;

function assertString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TonDnsProviderError(`${name} must be a non-empty string`);
  }
  return value;
}

function toStackNumber(value) {
  const bigint = typeof value === 'bigint' ? value : BigInt(value);
  return bigint < 0n ? `-0x${(-bigint).toString(16)}` : `0x${bigint.toString(16)}`;
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
  throw new TonDnsProviderError(`${name} must be an integer stack item`);
}

function extractStack(result) {
  const stack = result?.stack ?? result?.result?.stack;
  if (!Array.isArray(stack)) throw new TonDnsProviderError('TON DNS get-method response did not include a stack');
  return stack;
}

function readStackInt(stack, index, name) {
  if (index >= stack.length) throw new TonDnsProviderError(`Missing ${name} stack item`);
  return parseStackBigIntValue(stackItemValue(stack[index]), name);
}

function readStackCellBocOrNull(stack, index, name) {
  if (index >= stack.length) throw new TonDnsProviderError(`Missing ${name} stack item`);
  const item = stack[index];
  const type = stackItemType(item);
  const value = stackItemValue(item);
  if (value === null || value === undefined || type === 'null') return null;
  if (typeof value === 'string' && (type.includes('cell') || type.includes('slice') || value.startsWith('te6'))) {
    return value;
  }
  throw new TonDnsProviderError(`${name} must be a TON cell stack item or null`);
}

async function sha256BigInt(text) {
  const cryptoImpl = globalThis.crypto;
  if (!cryptoImpl?.subtle) throw new TonDnsProviderError('crypto.subtle is unavailable');
  const digest = new Uint8Array(await cryptoImpl.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return tonCell.bytesToBigInt(digest);
}

export async function tonDnsCategoryHash(name) {
  return sha256BigInt(assertString(name, 'TON DNS category'));
}

export function normalizeTonDnsName(name) {
  const normalized = assertString(name, 'TON DNS name').trim().toLowerCase();
  if (!TON_DNS_NAME_RE.test(normalized)) throw new TonDnsProviderError('Only .ton DNS names are supported');
  const bytes = new TextEncoder().encode(normalized);
  if (bytes.length > MAX_TON_DNS_BYTES) throw new TonDnsProviderError('TON DNS name is too long');
  return normalized;
}

export function tonDnsNameToInternalBytes(name, { leadingZero = false } = {}) {
  const normalized = normalizeTonDnsName(name);
  const labels = normalized.split('.').reverse();
  const encoder = new TextEncoder();
  const chunks = [];
  let size = leadingZero ? 1 : 0;
  if (leadingZero) chunks.push(new Uint8Array([0]));
  for (const label of labels) {
    const bytes = encoder.encode(label);
    chunks.push(bytes, new Uint8Array([0]));
    size += bytes.length + 1;
  }
  if (size > 127) throw new TonDnsProviderError('TON DNS internal name is too long');
  return tonCell.concatBytes(...chunks);
}

function stackSlice(bytes, name) {
  return {
    type: 'slice',
    value: beginCell().bytesValue(bytes, bytes.length, name).toBocBase64(),
  };
}

function stackNumber(value) {
  return { type: 'num', value: toStackNumber(value) };
}

class BitReader {
  constructor(cell, name = 'TON DNS cell') {
    this.cell = cell;
    this.name = name;
    this.offset = 0;
  }

  remainingBits() {
    return this.cell.bitLength - this.offset;
  }

  readUint(bitLength, field) {
    if (bitLength < 0 || this.offset + bitLength > this.cell.bitLength) {
      throw new TonDnsProviderError(`${this.name}.${field} is truncated`);
    }
    let out = 0n;
    for (let index = 0; index < bitLength; index += 1) {
      const absolute = this.offset + index;
      const bit = (this.cell.data[absolute >> 3] >> (7 - (absolute & 7))) & 1;
      out = (out << 1n) | BigInt(bit);
    }
    this.offset += bitLength;
    return out;
  }

  readBytes(length, field) {
    const out = new Uint8Array(length);
    for (let index = 0; index < length; index += 1) {
      out[index] = Number(this.readUint(8, field));
    }
    return out;
  }
}

function signedInt(value, bitLength) {
  const sign = 1n << BigInt(bitLength - 1);
  const mask = 1n << BigInt(bitLength);
  return (value & sign) === 0n ? Number(value) : Number(value - mask);
}

function readMsgAddressInt(reader) {
  const tag = Number(reader.readUint(2, 'address_tag'));
  if (tag !== 2 && tag !== 3) throw new TonDnsProviderError('TON DNS record contains unsupported address type');
  const anycast = Number(reader.readUint(1, 'address_anycast'));
  if (anycast !== 0) throw new TonDnsProviderError('TON DNS record contains unsupported anycast address');

  let workchain;
  if (tag === 2) {
    workchain = signedInt(reader.readUint(8, 'address_workchain'), 8);
  } else {
    const addressBits = Number(reader.readUint(9, 'address_len'));
    if (addressBits !== 256) throw new TonDnsProviderError('TON DNS record contains non-256-bit address');
    workchain = signedInt(reader.readUint(32, 'address_workchain'), 32);
  }

  const hash = reader.readBytes(32, 'address_hash');
  return `${workchain}:${tonCell.bytesToHex(hash)}`;
}

export function decodeTonDnsRecordCell(cellOrBoc) {
  const cell = typeof cellOrBoc === 'string' ? tonCell.parseBocBase64(cellOrBoc) : cellOrBoc;
  if (!cell) throw new TonDnsProviderError('TON DNS record is missing');
  const reader = new BitReader(cell, 'TON DNS record');
  const tag = Number(reader.readUint(16, 'tag'));

  if (tag === TON_DNS_RECORD_TAGS.NEXT_RESOLVER) {
    return {
      type: 'next_resolver',
      address: parseTonAddress(readMsgAddressInt(reader)).raw,
    };
  }

  if (tag === TON_DNS_RECORD_TAGS.WALLET) {
    const address = parseTonAddress(readMsgAddressInt(reader)).raw;
    const flags = Number(reader.readUint(8, 'flags'));
    if (flags > 1) throw new TonDnsProviderError('TON DNS wallet record flags are invalid');
    return {
      type: 'wallet',
      address,
      flags,
    };
  }

  throw new TonDnsProviderError(`Unsupported TON DNS record tag 0x${tag.toString(16)}`);
}

export function decodeDnsResolveStack(result) {
  const stack = extractStack(result);
  const resolvedBits = readStackInt(stack, 0, 'TON DNS resolved bits');
  const recordBoc = readStackCellBocOrNull(stack, 1, 'TON DNS record');
  return {
    resolvedBits,
    record: recordBoc ? tonCell.parseBocBase64(recordBoc) : null,
  };
}

function resolveTransport(options) {
  if (options.transport) return options.transport;
  const globalTransport = globalThis.plathoTonDnsTransport ?? globalThis.plathoTonRpcTransport;
  if (globalTransport) return globalTransport;
  const endpoint = options.endpoint
    ?? globalThis.plathoTonDnsRpcEndpoint
    ?? globalThis.plathoTonRpcEndpoint
    ?? globalThis.PLATHO_TON_RPC_ENDPOINT;
  if (endpoint) {
    return createTonCenterV3VaultTransport({
      endpoint,
      apiKey: options.apiKey ?? globalThis.plathoTonDnsRpcApiKey ?? globalThis.plathoTonRpcApiKey ?? globalThis.PLATHO_TON_RPC_API_KEY,
      headers: options.headers,
      fetch: options.fetch,
    });
  }
  return null;
}

function resolveRootAddress(configured, callOptions) {
  const address = callOptions?.rootAddress
    ?? configured
    ?? globalThis.plathoTonDnsRootAddress
    ?? globalThis.PLATHO_TON_DNS_ROOT_ADDRESS;
  if (!address) throw new TonDnsProviderError('TON DNS root address is not configured');
  return parseTonAddress(address).raw;
}

export function createTonDnsProvider(options = {}) {
  return {
    kind: options.kind ?? options.transport?.kind ?? 'ton-dns-rpc',
    async resolveWallet(name, callOptions = {}) {
      const transport = resolveTransport(options);
      if (!transport?.runGetMethod) throw new TonDnsProviderError('TON DNS transport is not configured');
      const walletCategory = await tonDnsCategoryHash('wallet');
      const rootAddress = resolveRootAddress(options.rootAddress, callOptions);
      let resolverAddress = rootAddress;
      let queryBytes = tonDnsNameToInternalBytes(name);

      for (let depth = 0; depth < (options.maxDepth ?? MAX_DNS_RECURSION); depth += 1) {
        const result = decodeDnsResolveStack(await transport.runGetMethod({
          address: resolverAddress,
          method: 'dnsresolve',
          stack: [
            stackSlice(queryBytes, 'TON DNS query'),
            stackNumber(walletCategory),
          ],
          verify: callOptions.verify,
          priority: callOptions.priority,
          cacheTtlMs: callOptions.cacheTtlMs,
        }));
        if (result.resolvedBits <= 0n) throw new TonDnsProviderError(`${name} does not have a TON DNS wallet record`);
        if (result.resolvedBits % 8n !== 0n) throw new TonDnsProviderError('TON DNS resolver returned non-byte prefix');
        if (result.resolvedBits > BigInt(queryBytes.length * 8)) {
          throw new TonDnsProviderError('TON DNS resolver returned an invalid prefix length');
        }

        if (result.resolvedBits === BigInt(queryBytes.length * 8)) {
          if (!result.record) throw new TonDnsProviderError(`${name} does not have a TON DNS wallet record`);
          const record = decodeTonDnsRecordCell(result.record);
          if (record.type !== 'wallet') throw new TonDnsProviderError(`${name} resolved to a non-wallet TON DNS record`);
          return record.address;
        }

        if (!result.record) throw new TonDnsProviderError(`${name} TON DNS resolver did not return a next resolver`);
        const record = decodeTonDnsRecordCell(result.record);
        if (record.type !== 'next_resolver') {
          throw new TonDnsProviderError(`${name} TON DNS partial result is not a next resolver`);
        }
        resolverAddress = record.address;
        const resolvedBytes = Number(result.resolvedBits / 8n);
        const remaining = queryBytes.slice(resolvedBytes);
        queryBytes = remaining[0] === 0 ? remaining : tonCell.concatBytes(new Uint8Array([0]), remaining);
      }

      throw new TonDnsProviderError(`${name} TON DNS resolution exceeded recursion limit`);
    },
  };
}

const defaultTonDnsProvider = createTonDnsProvider();

export default defaultTonDnsProvider;
