import { parseTonAddress } from './crypto/platho-crypto.mjs';
import { MLKEM768_PUBLIC_KEY_BYTES, readSnakeCellBytes } from './pwa-contract-transactions.mjs';

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

function readStackCellBoc(stack, index, name) {
  if (index >= stack.length) throw new Error(`Missing ${name} stack item`);
  const item = stack[index];
  const value = stackItemValue(item);
  const type = stackItemType(item);
  if (typeof value === 'string' && (type.includes('cell') || type.includes('slice'))) return value;
  if (typeof value === 'string' && value.startsWith('te6')) return value;
  throw new Error(`${name} must be a TON cell stack item`);
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
    current_key_id: readStackInt(stack, 3, 'Vault user current_key_id'),
    publish_nonce: readStackInt(stack, 4, 'Vault user publish_nonce'),
  };
}

export function decodeVaultKeyRecordViewStack(result) {
  const stack = extractStack(result);
  const pqKemPubkeyBoc = readStackCellBoc(stack, 7, 'Vault key record pq_kem_pubkey');
  return {
    exists: readStackBool(stack, 0, 'Vault key record exists'),
    owner_wallet: readStackAddress(stack, 1, 'Vault key record owner_wallet'),
    key_generation: readStackInt(stack, 2, 'Vault key record key_generation'),
    enc_pubkey: readStackInt(stack, 3, 'Vault key record enc_pubkey'),
    sign_pubkey: readStackInt(stack, 4, 'Vault key record sign_pubkey'),
    pq_kem_pubkey_hash: readStackInt(stack, 5, 'Vault key record pq_kem_pubkey_hash'),
    pq_kem_pubkey_len: readStackInt(stack, 6, 'Vault key record pq_kem_pubkey_len'),
    pq_kem_pubkey: readSnakeCellBytes(pqKemPubkeyBoc, {
      maxBytes: MLKEM768_PUBLIC_KEY_BYTES,
      name: 'Vault key record pq_kem_pubkey',
    }),
    pq_kem_pubkey_boc: pqKemPubkeyBoc,
    crypto_suite_mask: readStackInt(stack, 8, 'Vault key record crypto_suite_mask'),
    created_at: readStackInt(stack, 9, 'Vault key record created_at'),
    created_lt: readStackInt(stack, 10, 'Vault key record created_lt'),
    revoked_at: readStackInt(stack, 11, 'Vault key record revoked_at'),
    revoked_lt: readStackInt(stack, 12, 'Vault key record revoked_lt'),
  };
}

export function decodeVaultReceiveIntentViewStack(result) {
  const stack = extractStack(result);
  return {
    exists: readStackBool(stack, 0, 'Vault receive intent exists'),
    sender_wallet: readStackAddress(stack, 1, 'Vault receive intent sender_wallet'),
    recipient_wallet: readStackAddress(stack, 2, 'Vault receive intent recipient_wallet'),
    asset: readStackInt(stack, 3, 'Vault receive intent asset'),
    amount: readStackInt(stack, 4, 'Vault receive intent amount'),
    commitment: readStackInt(stack, 5, 'Vault receive intent commitment'),
    client_nonce: readStackInt(stack, 6, 'Vault receive intent client_nonce'),
    created_at: readStackInt(stack, 7, 'Vault receive intent created_at'),
    claimed: readStackBool(stack, 8, 'Vault receive intent claimed'),
  };
}

export function decodeVaultPendingAthWithdrawalViewStack(result) {
  const stack = extractStack(result);
  return {
    exists: readStackBool(stack, 0, 'Vault pending ATH withdrawal exists'),
    owner_wallet: readStackAddress(stack, 1, 'Vault pending ATH withdrawal owner_wallet'),
    recipient: readStackAddress(stack, 2, 'Vault pending ATH withdrawal recipient'),
    recipient_ath_wallet: readStackAddress(stack, 3, 'Vault pending ATH withdrawal recipient_ath_wallet'),
    amount: readStackInt(stack, 4, 'Vault pending ATH withdrawal amount'),
    created_at: readStackInt(stack, 5, 'Vault pending ATH withdrawal created_at'),
  };
}

export function decodeVaultGlobalViewStack(result) {
  const stack = extractStack(result);
  return {
    sealed: readStackBool(stack, 0, 'Vault global sealed'),
    capsule_hub_bound: readStackBool(stack, 1, 'Vault global capsule_hub_bound'),
    deployment_manifest_hash: readStackInt(stack, 2, 'Vault global deployment_manifest_hash'),
    capsule_hub_address: readStackAddress(stack, 3, 'Vault global capsule_hub_address'),
    vault_ath_wallet_address: readStackAddress(stack, 4, 'Vault global vault_ath_wallet_address'),
    ath_master_address: readStackAddress(stack, 5, 'Vault global ath_master_address'),
    user_count: readStackInt(stack, 6, 'Vault global user_count'),
    key_record_count: readStackInt(stack, 7, 'Vault global key_record_count'),
    receive_intent_count: readStackInt(stack, 8, 'Vault global receive_intent_count'),
    pending_ath_withdrawal_count: readStackInt(stack, 9, 'Vault global pending_ath_withdrawal_count'),
    pending_publish_count: readStackInt(stack, 10, 'Vault global pending_publish_count'),
    processed_ath_deposit_count: readStackInt(stack, 11, 'Vault global processed_ath_deposit_count'),
    pending_publish_stale_ttl: readStackInt(stack, 12, 'Vault global pending_publish_stale_ttl'),
    airdrop_remaining_ath: readStackInt(stack, 13, 'Vault global airdrop_remaining_ath'),
    airdrop_distributed_ath: readStackInt(stack, 14, 'Vault global airdrop_distributed_ath'),
    airdrop_reward_per_message_ath: readStackInt(stack, 15, 'Vault global airdrop_reward_per_message_ath'),
    airdrop_total_allocation_ath: readStackInt(stack, 16, 'Vault global airdrop_total_allocation_ath'),
  };
}

export function createTonCenterV3VaultTransport(options = {}) {
  const endpoint = assertString(options.endpoint, 'TON RPC endpoint');
  const sendBocEndpoint = options.sendBocEndpoint
    ?? globalThis.plathoTonSendBocEndpoint
    ?? globalThis.PLATHO_TON_SEND_BOC_ENDPOINT
    ?? null;
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
    async sendBoc({ boc }) {
      const endpointForSend = sendBocEndpoint;
      if (!endpointForSend) {
        throw new VaultTonRpcProviderError('TON sendBoc endpoint is not configured');
      }
      const headers = { 'Content-Type': 'application/json', ...(options.headers ?? {}) };
      if (options.apiKey) headers['X-API-Key'] = options.apiKey;
      const response = await fetchImpl(endpointForSend, {
        method: 'POST',
        headers,
        body: JSON.stringify({ boc }),
      });
      if (!response.ok) {
        throw new VaultTonRpcProviderError(`TON RPC sendBoc HTTP ${response.status}`);
      }
      const json = await response.json();
      const ok = json.ok ?? json.result?.ok ?? true;
      if (ok === false) throw new VaultTonRpcProviderError('TON RPC sendBoc rejected message');
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

function stackAddress(address) {
  return { type: 'slice', value: encodeTonAddressSliceBoc(parseTonAddress(address).raw) };
}

function stackNumber(value) {
  return { type: 'num', value: toStackNumber(value) };
}

export function createVaultTonRpcProvider(options = {}) {
  return {
    kind: options.kind ?? options.transport?.kind ?? 'ton-rpc',
    async getUser(ownerWallet, callOptions = {}) {
      const transport = resolveTransport(options);
      if (!transport?.runGetMethod) throw new VaultTonRpcProviderError('TON RPC transport is not configured');
      const vaultAddress = resolveVaultAddress(options.vaultAddress, callOptions);
      return decodeVaultUserViewStack(await transport.runGetMethod({
        address: vaultAddress,
        method: 'get_user',
        stack: [stackAddress(ownerWallet)],
      }));
    },
    async getKeyRecord(keyId, callOptions = {}) {
      const transport = resolveTransport(options);
      if (!transport?.runGetMethod) throw new VaultTonRpcProviderError('TON RPC transport is not configured');
      const vaultAddress = resolveVaultAddress(options.vaultAddress, callOptions);
      return decodeVaultKeyRecordViewStack(await transport.runGetMethod({
        address: vaultAddress,
        method: 'get_key_record',
        stack: [stackNumber(keyId)],
      }));
    },
    async getReceiveIntent(intentId, callOptions = {}) {
      const transport = resolveTransport(options);
      if (!transport?.runGetMethod) throw new VaultTonRpcProviderError('TON RPC transport is not configured');
      const vaultAddress = resolveVaultAddress(options.vaultAddress, callOptions);
      return decodeVaultReceiveIntentViewStack(await transport.runGetMethod({
        address: vaultAddress,
        method: 'get_receive_intent',
        stack: [stackNumber(intentId)],
      }));
    },
    async getReceiveIntentId(senderWallet, recipientWallet, asset, amount, clientNonce, callOptions = {}) {
      const transport = resolveTransport(options);
      if (!transport?.runGetMethod) throw new VaultTonRpcProviderError('TON RPC transport is not configured');
      const vaultAddress = resolveVaultAddress(options.vaultAddress, callOptions);
      const result = await transport.runGetMethod({
        address: vaultAddress,
        method: 'get_receive_intent_id',
        stack: [
          stackAddress(senderWallet),
          stackAddress(recipientWallet),
          stackNumber(asset),
          stackNumber(amount),
          stackNumber(clientNonce),
        ],
      });
      return readStackInt(extractStack(result), 0, 'Vault receive intent id');
    },
    async getReceiveIntentCommitment(intentId, recipientWallet, secret32, callOptions = {}) {
      const transport = resolveTransport(options);
      if (!transport?.runGetMethod) throw new VaultTonRpcProviderError('TON RPC transport is not configured');
      const vaultAddress = resolveVaultAddress(options.vaultAddress, callOptions);
      const result = await transport.runGetMethod({
        address: vaultAddress,
        method: 'get_receive_intent_commitment',
        stack: [
          stackNumber(intentId),
          stackAddress(recipientWallet),
          stackNumber(secret32),
        ],
      });
      return readStackInt(extractStack(result), 0, 'Vault receive intent commitment');
    },
    async getAthWithdrawalId(ownerWallet, queryId, callOptions = {}) {
      const transport = resolveTransport(options);
      if (!transport?.runGetMethod) throw new VaultTonRpcProviderError('TON RPC transport is not configured');
      const vaultAddress = resolveVaultAddress(options.vaultAddress, callOptions);
      const result = await transport.runGetMethod({
        address: vaultAddress,
        method: 'get_ath_withdrawal_id',
        stack: [stackAddress(ownerWallet), stackNumber(queryId)],
      });
      return readStackInt(extractStack(result), 0, 'Vault ATH withdrawal id');
    },
    async getPendingAthWithdrawalFor(ownerWallet, queryId, callOptions = {}) {
      const transport = resolveTransport(options);
      if (!transport?.runGetMethod) throw new VaultTonRpcProviderError('TON RPC transport is not configured');
      const vaultAddress = resolveVaultAddress(options.vaultAddress, callOptions);
      return decodeVaultPendingAthWithdrawalViewStack(await transport.runGetMethod({
        address: vaultAddress,
        method: 'get_pending_ath_withdrawal_for',
        stack: [stackAddress(ownerWallet), stackNumber(queryId)],
      }));
    },
    async getCanonicalPublishCharge(ownerWallet, publishKind, sizeClass, cryptoSuite, callOptions = {}) {
      const transport = resolveTransport(options);
      if (!transport?.runGetMethod) throw new VaultTonRpcProviderError('TON RPC transport is not configured');
      const vaultAddress = resolveVaultAddress(options.vaultAddress, callOptions);
      const result = await transport.runGetMethod({
        address: vaultAddress,
        method: 'get_canonical_publish_charge',
        stack: [
          stackAddress(ownerWallet),
          stackNumber(publishKind),
          stackNumber(sizeClass),
          stackNumber(cryptoSuite),
        ],
      });
      return readStackInt(extractStack(result), 0, 'Vault canonical publish charge');
    },
    async getGlobal(callOptions = {}) {
      const transport = resolveTransport(options);
      if (!transport?.runGetMethod) throw new VaultTonRpcProviderError('TON RPC transport is not configured');
      const vaultAddress = resolveVaultAddress(options.vaultAddress, callOptions);
      return decodeVaultGlobalViewStack(await transport.runGetMethod({
        address: vaultAddress,
        method: 'get_global',
        stack: [],
      }));
    },
  };
}

const defaultProvider = createVaultTonRpcProvider();

export default defaultProvider;
