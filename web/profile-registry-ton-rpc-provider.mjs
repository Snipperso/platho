import { parseTonAddress } from './crypto/platho-crypto.mjs?v=31';
import { decodeTonAddressSliceBoc, encodeTonAddressSliceBoc } from './ton-rpc-transport.mjs?v=111';

export class ProfileRegistryTonRpcProviderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProfileRegistryTonRpcProviderError';
  }
}

function readStackInt(stack, index, name) {
  const item = stack[index];
  const raw = stackItemValue(item);
  if (typeof raw === 'bigint') return raw;
  if (typeof raw === 'number' && Number.isSafeInteger(raw)) return BigInt(raw);
  if (typeof raw === 'boolean') return raw ? -1n : 0n;
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (/^-?0x[0-9a-fA-F]+$/.test(text)) {
      return text.startsWith('-') ? -BigInt(`0x${text.slice(3)}`) : BigInt(text);
    }
    if (/^-?[0-9]+$/.test(text)) return BigInt(text);
  }
  throw new ProfileRegistryTonRpcProviderError(`${name} is not an integer stack item`);
}

function readStackBool(stack, index, name) {
  return readStackInt(stack, index, name) !== 0n;
}

function readStackAddress(stack, index, name) {
  const item = stack[index];
  const value = stackItemValue(item);
  const type = stackItemType(item);
  if (typeof item?.address === 'string') return parseTonAddress(item.address).raw;
  if (typeof value === 'string') {
    try {
      return parseTonAddress(value).raw;
    } catch {
      if (type.includes('slice') || type === 'cell' || /^[A-Za-z0-9+/=_-]+$/.test(value)) {
        return decodeTonAddressSliceBoc(value);
      }
    }
  }
  throw new ProfileRegistryTonRpcProviderError(`${name} is not an address stack item`);
}

function stackItemValue(item) {
  if (Array.isArray(item)) return item[1];
  if (item && typeof item === 'object' && 'value' in item) return item.value;
  if (item && typeof item === 'object' && 'num' in item) return item.num;
  if (item && typeof item === 'object' && 'boc' in item) return item.boc;
  if (item && typeof item === 'object' && 'cell' in item) return item.cell;
  if (item && typeof item === 'object' && 'bytes' in item) return item.bytes;
  return item;
}

function stackItemType(item) {
  if (Array.isArray(item)) return String(item[0] ?? '').toLowerCase();
  if (item && typeof item === 'object' && 'type' in item) return String(item.type ?? '').toLowerCase();
  return typeof item;
}

function extractStack(result) {
  const stack = result?.stack ?? result?.result?.stack;
  if (!Array.isArray(stack)) throw new ProfileRegistryTonRpcProviderError('TON get-method response did not include a stack');
  return stack;
}

function resolveTransport(options) {
  const transport = options.transport ?? globalThis.plathoProfileRegistryRpcTransport ?? globalThis.plathoTonRpcTransport;
  if (!transport?.runGetMethod) throw new ProfileRegistryTonRpcProviderError('TON RPC transport is not configured');
  return transport;
}

function resolveAddress(configured, callOptions) {
  const address = callOptions?.profileRegistryAddress
    ?? callOptions?.address
    ?? configured
    ?? globalThis.plathoProfileRegistryAddress
    ?? globalThis.PLATHO_PROFILE_REGISTRY_ADDRESS;
  if (!address) throw new ProfileRegistryTonRpcProviderError('ProfileRegistry address is not configured');
  return parseTonAddress(address).raw;
}

function stackAddress(address) {
  return { type: 'slice', value: encodeTonAddressSliceBoc(parseTonAddress(address).raw) };
}

function criticalCallOptions(callOptions = {}) {
  const out = {};
  for (const key of ['cacheTtlMs', 'ttlMs', 'priority', 'verify', 'allowUnverifiedCriticalRead', 'stopOnUninitializedAccount', 'queueTimeoutMs']) {
    if (callOptions[key] !== undefined) out[key] = callOptions[key];
  }
  return out;
}


export function decodeProfileRegistryGlobalStack(result) {
  const stack = extractStack(result);
  if (stack.length !== 15) {
    throw new ProfileRegistryTonRpcProviderError(`ProfileRegistry get_global ABI mismatch: expected 15 stack items, got ${stack.length}`);
  }
  return {
    sealed: readStackBool(stack, 0, 'ProfileRegistry sealed'),
    official_ath_wallet_bound: readStackBool(stack, 1, 'ProfileRegistry official wallet bound'),
    deployment_manifest_hash: readStackInt(stack, 2, 'ProfileRegistry manifest hash'),
    genesis_config_hash: readStackInt(stack, 3, 'ProfileRegistry genesis config hash'),
    official_ath_wallet_address: readStackAddress(stack, 4, 'ProfileRegistry official ATH wallet'),
    ath_master_address: readStackAddress(stack, 5, 'ProfileRegistry ATHMaster'),
    treasury_ath_receiver_address: readStackAddress(stack, 6, 'ProfileRegistry treasury ATH receiver'),
    genesis_controller_address: readStackAddress(stack, 7, 'ProfileRegistry genesis controller'),
    profile_count: readStackInt(stack, 8, 'ProfileRegistry profile count'),
    pending_avatar_write_count: readStackInt(stack, 9, 'ProfileRegistry pending avatar write count'),
    next_avatar_write_id: readStackInt(stack, 10, 'ProfileRegistry next avatar write id'),
    treasury_due_ath: readStackInt(stack, 11, 'ProfileRegistry treasury due'),
    burn_due_ath: readStackInt(stack, 12, 'ProfileRegistry burn due'),
    pending_treasury_flush_count: readStackInt(stack, 13, 'ProfileRegistry pending treasury flush count'),
    pending_burn_flush_count: readStackInt(stack, 14, 'ProfileRegistry pending burn flush count'),
  };
}

export function decodeProfileRegistryPendingAvatarWriteStack(result) {
  const stack = extractStack(result);
  if (stack.length !== 6) {
    throw new ProfileRegistryTonRpcProviderError(`ProfileRegistry get_pending_avatar_write ABI mismatch: expected 6 stack items, got ${stack.length}`);
  }
  return {
    exists: readStackBool(stack, 0, 'pending avatar write exists'),
    query_id: readStackInt(stack, 1, 'pending avatar write query id'),
    sender_key: readStackInt(stack, 2, 'pending avatar write sender key'),
    amount: readStackInt(stack, 3, 'pending avatar write amount'),
    owner_wallet: readStackAddress(stack, 4, 'pending avatar write owner wallet'),
    created_at: readStackInt(stack, 5, 'pending avatar write created at'),
  };
}

const stackInt = (value) => ({ type: 'num', value: String(value) });

export function createProfileRegistryTonRpcProvider(options = {}) {
  return {
    kind: options.kind ?? options.transport?.kind ?? 'ton-rpc',
    async getKeyShardAddress(ownerWallet, callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveAddress(options.profileRegistryAddress, callOptions);
      const result = await transport.runGetMethod({
        address,
        method: 'get_key_shard_address',
        stack: [stackAddress(ownerWallet)],
        ...criticalCallOptions(callOptions),
      });
      return readStackAddress(extractStack(result), 0, 'ProfileRegistry KeyShard address');
    },
    async getAthWalletAddress(ownerWallet, callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveAddress(options.profileRegistryAddress, callOptions);
      const result = await transport.runGetMethod({
        address,
        method: 'get_ath_wallet_address',
        stack: [stackAddress(ownerWallet)],
        ...criticalCallOptions(callOptions),
      });
      return readStackAddress(extractStack(result), 0, 'ProfileRegistry ATH wallet address');
    },
    async getGlobal(callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveAddress(options.profileRegistryAddress, callOptions);
      return decodeProfileRegistryGlobalStack(await transport.runGetMethod({
        address,
        method: 'get_global',
        stack: [],
        ...criticalCallOptions(callOptions),
      }));
    },
    async getPendingAvatarWrite(writeId, callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveAddress(options.profileRegistryAddress, callOptions);
      return decodeProfileRegistryPendingAvatarWriteStack(await transport.runGetMethod({
        address,
        method: 'get_pending_avatar_write',
        stack: [stackInt(writeId)],
        ...criticalCallOptions(callOptions),
      }));
    },
  };
}
