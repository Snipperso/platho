import { parseTonAddress } from './crypto/platho-crypto.mjs';
import { decodeTonAddressSliceBoc, encodeTonAddressSliceBoc } from './vault-ton-rpc-provider.mjs';

export class UsernameTonRpcProviderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsernameTonRpcProviderError';
  }
}

const USERNAME_NAME_HASH_DOMAIN = 0xC5CC7CD6;
const USERNAME_MIN_LENGTH = 4;
const USERNAME_MAX_LENGTH = 32;

function toStackNumber(value) {
  const bigint = typeof value === 'bigint' ? value : BigInt(value);
  return bigint < 0n ? `-0x${(-bigint).toString(16)}` : `0x${bigint.toString(16)}`;
}

function readStackInt(stack, index, name) {
  const item = stack[index];
  const raw = item?.value ?? item?.num ?? item;
  if (typeof raw === 'bigint') return raw;
  if (typeof raw === 'number' && Number.isSafeInteger(raw)) return BigInt(raw);
  if (typeof raw === 'string') {
    if (raw.startsWith('-0x')) return -BigInt(`0x${raw.slice(3)}`);
    if (raw.startsWith('0x')) return BigInt(raw);
    if (/^-?[0-9]+$/.test(raw)) return BigInt(raw);
  }
  throw new UsernameTonRpcProviderError(`${name} is not an integer stack item`);
}

function readStackBool(stack, index, name) {
  return readStackInt(stack, index, name) !== 0n;
}

function readStackAddress(stack, index, name) {
  const item = stack[index];
  if (item?.type === 'slice' && typeof item.value === 'string') {
    return decodeTonAddressSliceBoc(item.value);
  }
  if (typeof item?.address === 'string') return parseTonAddress(item.address).raw;
  if (typeof item?.value === 'string' && /^-?[0-9]+:/.test(item.value)) return parseTonAddress(item.value).raw;
  throw new UsernameTonRpcProviderError(`${name} is not an address stack item`);
}

function extractStack(result) {
  const stack = result?.stack ?? result?.result?.stack;
  if (!Array.isArray(stack)) throw new UsernameTonRpcProviderError('TON get-method response did not include a stack');
  return stack;
}

function resolveTransport(options) {
  const transport = options.transport ?? globalThis.plathoUsernameRpcTransport ?? globalThis.plathoTonRpcTransport;
  if (!transport?.runGetMethod) throw new UsernameTonRpcProviderError('TON RPC transport is not configured');
  return transport;
}

function resolveAddress(configured, callOptions, globalName, label) {
  const address = callOptions?.address ?? configured ?? globalThis[globalName];
  if (!address) throw new UsernameTonRpcProviderError(`${label} address is not configured`);
  return parseTonAddress(address).raw;
}

function stackAddress(address) {
  return { type: 'slice', value: encodeTonAddressSliceBoc(parseTonAddress(address).raw) };
}

function stackNumber(value) {
  return { type: 'num', value: toStackNumber(value) };
}

function bytesToBigInt(bytes) {
  let out = 0n;
  for (const byte of bytes) out = (out << 8n) | BigInt(byte);
  return out;
}

function uint32Bytes(value) {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]);
}

async function sha256(bytes) {
  const cryptoImpl = globalThis.crypto;
  if (!cryptoImpl?.subtle) throw new UsernameTonRpcProviderError('crypto.subtle is unavailable');
  return new Uint8Array(await cryptoImpl.subtle.digest('SHA-256', bytes));
}

function normalizeUsername(username) {
  if (typeof username !== 'string') throw new TypeError('username must be a string');
  const raw = username.toLowerCase().endsWith('.ath') ? username.slice(0, -4) : username;
  if (raw.length < USERNAME_MIN_LENGTH || raw.length > USERNAME_MAX_LENGTH) {
    throw new RangeError(`username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} ASCII chars`);
  }
  if (!/^[a-z0-9]+$/.test(raw)) {
    throw new RangeError('username must contain only lowercase ASCII letters and digits');
  }
  return raw;
}

export async function computeUsernameNameHash(username) {
  const name = normalizeUsername(username);
  const nameBytes = new TextEncoder().encode(name);
  const data = new Uint8Array(4 + nameBytes.length);
  data.set(uint32Bytes(USERNAME_NAME_HASH_DOMAIN), 0);
  data.set(nameBytes, 4);
  const cellRepr = new Uint8Array(2 + data.length);
  cellRepr[0] = 0;
  cellRepr[1] = data.length * 2;
  cellRepr.set(data, 2);
  return bytesToBigInt(await sha256(cellRepr));
}

export function decodeUsernamePriceStack(result) {
  const stack = extractStack(result);
  return {
    valid_length: readStackBool(stack, 0, 'username valid length'),
    price_ath_atomic: readStackInt(stack, 1, 'username price'),
  };
}

export function decodeUsernameNameRecordStack(result) {
  const stack = extractStack(result);
  return {
    exists: readStackBool(stack, 0, 'username record exists'),
    owner_wallet: readStackAddress(stack, 1, 'username owner wallet'),
    item_address: readStackAddress(stack, 2, 'username item address'),
    registered_at: readStackInt(stack, 3, 'username registered at'),
  };
}

export function decodePendingUsernameMintStack(result) {
  const stack = extractStack(result);
  return {
    exists: readStackBool(stack, 0, 'username pending mint exists'),
    owner_wallet: readStackAddress(stack, 1, 'username pending owner wallet'),
    name_hash: readStackInt(stack, 2, 'username pending name hash'),
    price_paid: readStackInt(stack, 3, 'username pending price paid'),
    item_address: readStackAddress(stack, 4, 'username pending item address'),
    item_deploy_value: readStackInt(stack, 5, 'username pending item deploy value'),
    created_at: readStackInt(stack, 6, 'username pending created at'),
  };
}

export function decodePendingAthRefundFlushStack(result) {
  const stack = extractStack(result);
  return {
    exists: readStackBool(stack, 0, 'username refund flush exists'),
    owner_wallet: readStackAddress(stack, 1, 'username refund owner wallet'),
    amount: readStackInt(stack, 2, 'username refund amount'),
    recipient_ath_wallet: readStackAddress(stack, 3, 'username refund recipient ATH wallet'),
    created_at: readStackInt(stack, 4, 'username refund created at'),
  };
}

export function decodePendingAthTreasuryFlushStack(result) {
  const stack = extractStack(result);
  return {
    exists: readStackBool(stack, 0, 'username treasury flush exists'),
    amount: readStackInt(stack, 1, 'username treasury amount'),
    recipient_ath_wallet: readStackAddress(stack, 2, 'username treasury recipient ATH wallet'),
    created_at: readStackInt(stack, 3, 'username treasury created at'),
  };
}

export function decodePendingAthBurnFlushStack(result) {
  const stack = extractStack(result);
  return {
    exists: readStackBool(stack, 0, 'username burn flush exists'),
    amount: readStackInt(stack, 1, 'username burn amount'),
    created_at: readStackInt(stack, 2, 'username burn created at'),
  };
}

export function decodeUsernameRegistryGlobalStack(result) {
  const stack = extractStack(result);
  return {
    sealed: readStackBool(stack, 0, 'UsernameRegistry sealed'),
    official_ath_wallet_bound: readStackBool(stack, 1, 'UsernameRegistry official wallet bound'),
    deployment_manifest_hash: readStackInt(stack, 2, 'UsernameRegistry manifest hash'),
    genesis_config_hash: readStackInt(stack, 3, 'UsernameRegistry genesis config hash'),
    official_ath_wallet_address: readStackAddress(stack, 4, 'UsernameRegistry official ATH wallet'),
    genesis_controller_address: readStackAddress(stack, 5, 'UsernameRegistry genesis controller'),
    name_record_count: readStackInt(stack, 6, 'UsernameRegistry name record count'),
    pending_mint_count: readStackInt(stack, 7, 'UsernameRegistry pending mint count'),
    refund_due_count: readStackInt(stack, 8, 'UsernameRegistry refund due count'),
    treasury_due_ath: readStackInt(stack, 9, 'UsernameRegistry treasury due'),
    burn_due_ath: readStackInt(stack, 10, 'UsernameRegistry burn due'),
    pending_refund_flush_count: readStackInt(stack, 11, 'UsernameRegistry pending refund flush count'),
    pending_treasury_flush_count: readStackInt(stack, 12, 'UsernameRegistry pending treasury flush count'),
    pending_burn_flush_count: readStackInt(stack, 13, 'UsernameRegistry pending burn flush count'),
    pending_mint_stale_ttl: readStackInt(stack, 14, 'UsernameRegistry pending mint stale ttl'),
  };
}

export function decodeUsernameNftItemStateStack(result) {
  const stack = extractStack(result);
  return {
    owner_wallet: readStackAddress(stack, 0, 'UsernameNFTItem owner wallet'),
    username_registry_address: readStackAddress(stack, 1, 'UsernameNFTItem registry address'),
    name_hash: readStackInt(stack, 2, 'UsernameNFTItem name hash'),
  };
}

export async function resolveAuthoritativeUsernameItemOwnership({
  registryProvider,
  itemProvider,
  itemAddress,
  registryAddress = null,
  registryCallOptions = {},
  itemCallOptions = {},
} = {}) {
  if (!registryProvider?.getNameRecord) throw new UsernameTonRpcProviderError('UsernameRegistry provider cannot read authoritative name records');
  if (!itemProvider?.getState) throw new UsernameTonRpcProviderError('UsernameNFTItem provider cannot read item state');
  if (!itemAddress) throw new UsernameTonRpcProviderError('UsernameNFTItem address is required');

  const parsedItemAddress = parseTonAddress(itemAddress).raw;
  const itemState = await itemProvider.getState(itemCallOptions);
  const parsedItemRegistry = parseTonAddress(itemState.username_registry_address).raw;
  const expectedRegistry = registryAddress ? parseTonAddress(registryAddress).raw : null;
  if (expectedRegistry && parsedItemRegistry !== expectedRegistry) {
    return {
      authoritative: false,
      reason: 'item_registry_mismatch',
      item_state: itemState,
      record: null,
    };
  }

  const record = await registryProvider.getNameRecord(itemState.name_hash, registryCallOptions);
  if (record?.exists !== true) {
    return {
      authoritative: false,
      reason: 'missing_registry_record',
      item_state: itemState,
      record,
    };
  }

  const recordItemAddress = parseTonAddress(record.item_address).raw;
  const recordOwnerWallet = parseTonAddress(record.owner_wallet).raw;
  const itemOwnerWallet = parseTonAddress(itemState.owner_wallet).raw;
  const authoritative = recordItemAddress === parsedItemAddress && recordOwnerWallet === itemOwnerWallet;
  return {
    authoritative,
    reason: authoritative ? 'registry_record' : 'registry_record_mismatch',
    owner_wallet: authoritative ? recordOwnerWallet : null,
    item_address: parsedItemAddress,
    name_hash: itemState.name_hash,
    item_state: itemState,
    record,
  };
}

export function createUsernameRegistryTonRpcProvider(options = {}) {
  return {
    kind: options.kind ?? options.transport?.kind ?? 'ton-rpc',
    async getUsernamePrice(nameLength, callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveAddress(options.usernameRegistryAddress, callOptions, 'plathoUsernameRegistryAddress', 'UsernameRegistry');
      return decodeUsernamePriceStack(await transport.runGetMethod({
        address,
        method: 'get_username_price',
        stack: [stackNumber(nameLength)],
      }));
    },
    async getUsernameItemAddress(ownerWallet, nameHash, callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveAddress(options.usernameRegistryAddress, callOptions, 'plathoUsernameRegistryAddress', 'UsernameRegistry');
      const result = await transport.runGetMethod({
        address,
        method: 'get_username_item_address',
        stack: [stackAddress(ownerWallet), stackNumber(nameHash)],
      });
      return readStackAddress(extractStack(result), 0, 'username item address');
    },
    async getNameRecord(nameHash, callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveAddress(options.usernameRegistryAddress, callOptions, 'plathoUsernameRegistryAddress', 'UsernameRegistry');
      return decodeUsernameNameRecordStack(await transport.runGetMethod({
        address,
        method: 'get_name_record',
        stack: [stackNumber(nameHash)],
      }));
    },
    async getNameRecordByUsername(username, callOptions = {}) {
      return this.getNameRecord(await computeUsernameNameHash(username), callOptions);
    },
    async getPendingMint(nameHash, callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveAddress(options.usernameRegistryAddress, callOptions, 'plathoUsernameRegistryAddress', 'UsernameRegistry');
      return decodePendingUsernameMintStack(await transport.runGetMethod({
        address,
        method: 'get_pending_mint',
        stack: [stackNumber(nameHash)],
      }));
    },
    async getRefundDue(ownerWallet, callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveAddress(options.usernameRegistryAddress, callOptions, 'plathoUsernameRegistryAddress', 'UsernameRegistry');
      const result = await transport.runGetMethod({
        address,
        method: 'get_refund_due',
        stack: [stackAddress(ownerWallet)],
      });
      return readStackInt(extractStack(result), 0, 'username refund due');
    },
    async getPendingRefundFlush(queryId, callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveAddress(options.usernameRegistryAddress, callOptions, 'plathoUsernameRegistryAddress', 'UsernameRegistry');
      return decodePendingAthRefundFlushStack(await transport.runGetMethod({
        address,
        method: 'get_pending_refund_flush',
        stack: [stackNumber(queryId)],
      }));
    },
    async getRefundFlushId(ownerWallet, queryId, callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveAddress(options.usernameRegistryAddress, callOptions, 'plathoUsernameRegistryAddress', 'UsernameRegistry');
      const result = await transport.runGetMethod({
        address,
        method: 'get_refund_flush_id',
        stack: [stackAddress(ownerWallet), stackNumber(queryId)],
      });
      return readStackInt(extractStack(result), 0, 'username refund flush id');
    },
    async getPendingRefundFlushFor(ownerWallet, queryId, callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveAddress(options.usernameRegistryAddress, callOptions, 'plathoUsernameRegistryAddress', 'UsernameRegistry');
      return decodePendingAthRefundFlushStack(await transport.runGetMethod({
        address,
        method: 'get_pending_refund_flush_for',
        stack: [stackAddress(ownerWallet), stackNumber(queryId)],
      }));
    },
    async getPendingTreasuryFlush(queryId, callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveAddress(options.usernameRegistryAddress, callOptions, 'plathoUsernameRegistryAddress', 'UsernameRegistry');
      return decodePendingAthTreasuryFlushStack(await transport.runGetMethod({
        address,
        method: 'get_pending_treasury_flush',
        stack: [stackNumber(queryId)],
      }));
    },
    async getPendingBurnFlush(queryId, callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveAddress(options.usernameRegistryAddress, callOptions, 'plathoUsernameRegistryAddress', 'UsernameRegistry');
      return decodePendingAthBurnFlushStack(await transport.runGetMethod({
        address,
        method: 'get_pending_burn_flush',
        stack: [stackNumber(queryId)],
      }));
    },
    async getAthWalletAddress(ownerWallet, callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveAddress(options.usernameRegistryAddress, callOptions, 'plathoUsernameRegistryAddress', 'UsernameRegistry');
      const result = await transport.runGetMethod({
        address,
        method: 'get_ath_wallet_address',
        stack: [stackAddress(ownerWallet)],
      });
      return readStackAddress(extractStack(result), 0, 'username ATH wallet address');
    },
    async getGlobal(callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveAddress(options.usernameRegistryAddress, callOptions, 'plathoUsernameRegistryAddress', 'UsernameRegistry');
      return decodeUsernameRegistryGlobalStack(await transport.runGetMethod({
        address,
        method: 'get_global',
        stack: [],
      }));
    },
  };
}

export function createUsernameNftItemTonRpcProvider(options = {}) {
  return {
    kind: options.kind ?? options.transport?.kind ?? 'ton-rpc',
    async getState(callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveAddress(options.usernameNftItemAddress, callOptions, 'plathoUsernameNftItemAddress', 'UsernameNFTItem');
      return decodeUsernameNftItemStateStack(await transport.runGetMethod({
        address,
        method: 'get_state',
        stack: [],
      }));
    },
  };
}
