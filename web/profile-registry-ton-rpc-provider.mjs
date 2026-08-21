import { parseTonAddress } from './crypto/platho-crypto.mjs?v=15';
import { decodeTonAddressSliceBoc, encodeTonAddressSliceBoc } from './ton-rpc-transport.mjs?v=77';

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
  for (const key of ['cacheTtlMs', 'ttlMs', 'priority', 'verify', 'allowUnverifiedCriticalRead']) {
    if (callOptions[key] !== undefined) out[key] = callOptions[key];
  }
  return out;
}

// decodeProfileAvatarStack / getAvatar / getAvatarVersion RETIRED 2026-07-21 with the maps behind them. The paid
// avatar pointer lives in the buyer's own KeyShard now — see web/key-shard-ton-rpc-provider.mjs, which returns the
// identical record shape — because holding it here cost 5.0000 cells per profile against a ~65536-cell account and
// capped the product at 13,076 profiles, silently. What this provider still answers is WHERE that shard is
// (getKeyShardAddress), exactly as the username provider answers where a name's item is.

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

export function createProfileRegistryTonRpcProvider(options = {}) {
  return {
    kind: options.kind ?? options.transport?.kind ?? 'ton-rpc',
    // Where the wallet's avatar pointer actually lives. The client can derive this locally too
    // (web/shard-address.mjs), and SHOULD for batched reads; this getter exists so the derivation can be checked
    // against the registry's own — the two disagreeing would mean reads and writes are aimed at different accounts.
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
  };
}
