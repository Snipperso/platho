
import { WRITES_GENERATION } from './cutover-epoch.mjs?v=7';
import { parseTonAddress } from './crypto/platho-crypto.mjs?v=31';
import { keyShardAddressBytes, rawAddress } from './shard-address.mjs?v=47';

export class KeyShardTonRpcProviderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'KeyShardTonRpcProviderError';
  }
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

function readStackInt(stack, index, name) {
  const raw = stackItemValue(stack[index]);
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
  throw new KeyShardTonRpcProviderError(`${name} is not an integer stack item`);
}

const readStackBool = (stack, index, name) => readStackInt(stack, index, name) !== 0n;

function readStackAddress(stack, index, name, decodeAddressSliceBoc) {
  const item = stack[index];
  const value = stackItemValue(item);
  if (typeof item?.address === 'string') return parseTonAddress(item.address).raw;
  if (typeof value === 'string') {
    try {
      return parseTonAddress(value).raw;
    } catch {
      const type = stackItemType(item);
      if (typeof decodeAddressSliceBoc === 'function'
        && (type.includes('slice') || type === 'cell' || /^[A-Za-z0-9+/=_-]+$/.test(value))) {
        return decodeAddressSliceBoc(value);
      }
    }
  }
  throw new KeyShardTonRpcProviderError(`${name} is not an address stack item`);
}

export function decodeKeyShardViewStack(result, decodeAddressSliceBoc) {
  const stack = result?.stack ?? result?.result?.stack;
  if (!Array.isArray(stack)) throw new KeyShardTonRpcProviderError('TON get-method response did not include a stack');
  if (stack.length !== 25) {
    throw new KeyShardTonRpcProviderError(`KeyShard get_view ABI mismatch: expected 25 stack items, got ${stack.length}`);
  }
  return {
    exists: readStackBool(stack, 0, 'KeyShard exists'),
    owner_wallet: readStackAddress(stack, 1, 'KeyShard owner wallet', decodeAddressSliceBoc),
    key_id: readStackInt(stack, 2, 'KeyShard key id'),
    key_generation: readStackInt(stack, 3, 'KeyShard key generation'),
    rotation_nonce: readStackInt(stack, 4, 'KeyShard rotation nonce'),
    enc_pubkey: readStackInt(stack, 5, 'KeyShard enc pubkey'),
    sign_pubkey: readStackInt(stack, 6, 'KeyShard sign pubkey'),
    scan_pubkey: readStackInt(stack, 7, 'KeyShard scan pubkey'),
    pq_kem_pubkey_hash: readStackInt(stack, 8, 'KeyShard ML-KEM pubkey hash'),
    pq_kem_pubkey_len: readStackInt(stack, 9, 'KeyShard ML-KEM pubkey length'),
    pq_kem_pubkey: stackItemValue(stack[10]),
    crypto_suite_mask: readStackInt(stack, 11, 'KeyShard crypto suite mask'),
    created_at: readStackInt(stack, 12, 'KeyShard created at'),
    created_lt: readStackInt(stack, 13, 'KeyShard created lt'),
    min_register_value: readStackInt(stack, 14, 'KeyShard min register value'),
    min_replace_value: readStackInt(stack, 15, 'KeyShard min replace value'),
    profile_registry: readStackAddress(stack, 16, 'KeyShard profile registry', decodeAddressSliceBoc),
    avatar_version: readStackInt(stack, 17, 'KeyShard avatar version'),
    avatar_hash: readStackInt(stack, 18, 'KeyShard avatar hash'),
    avatar_entry_id: readStackInt(stack, 19, 'KeyShard avatar entry id'),
    avatar_stream_id: readStackInt(stack, 20, 'KeyShard avatar stream id'),
    avatar_part_count: readStackInt(stack, 21, 'KeyShard avatar part count'),
    avatar_media_format: readStackInt(stack, 22, 'KeyShard avatar media format'),
    avatar_updated_at: readStackInt(stack, 23, 'KeyShard avatar updated at'),
    rotation_min_balance: readStackInt(stack, 24, 'KeyShard rotation min balance'),
  };
}

export function avatarRecordFromKeyShardView(view, ownerWallet) {
  const version = BigInt(view?.avatar_version ?? 0n);
  const registered = view?.exists === true && view?.fromPredecessor !== true;
  if (version === 0n) {
    return {
      exists: false,
      registered,
      owner_wallet: ownerWallet,
      version: 0n,
      avatar_hash: 0n,
      avatar_entry_id: 0n,
      avatar_stream_id: 0n,
      avatar_part_count: 0n,
      media_format: 0n,
      updated_at: 0n,
    };
  }
  return {
    exists: true,
    registered,
    owner_wallet: view.owner_wallet ?? ownerWallet,
    version,
    avatar_hash: view.avatar_hash,
    avatar_entry_id: view.avatar_entry_id,
    avatar_stream_id: view.avatar_stream_id,
    avatar_part_count: view.avatar_part_count,
    media_format: view.avatar_media_format,
    updated_at: view.avatar_updated_at,
  };
}

export async function deriveKeyShardRawAddress(ownerWallet, profileRegistryAddress, generation = WRITES_GENERATION) {
  const owner = parseTonAddress(ownerWallet).raw;
  const registry = parseTonAddress(profileRegistryAddress).raw;
  return rawAddress(await keyShardAddressBytes(owner, registry, generation));
}

function resolveTransport(options) {
  const transport = options.transport ?? globalThis.plathoKeyShardRpcTransport ?? globalThis.plathoTonRpcTransport;
  if (!transport?.runGetMethod) throw new KeyShardTonRpcProviderError('TON RPC transport is not configured');
  return transport;
}

function resolveRegistryAddress(configured, callOptions) {
  const address = callOptions?.profileRegistryAddress
    ?? configured
    ?? globalThis.plathoProfileRegistryAddress
    ?? globalThis.PLATHO_PROFILE_REGISTRY_ADDRESS;
  if (!address) throw new KeyShardTonRpcProviderError('ProfileRegistry address is required to derive a KeyShard address');
  return address;
}

function criticalCallOptions(callOptions = {}) {
  const out = {};
  for (const key of ['cacheTtlMs', 'ttlMs', 'priority', 'verify', 'allowUnverifiedCriticalRead', 'stopOnUninitializedAccount', 'queueTimeoutMs']) {
    if (callOptions[key] !== undefined) out[key] = callOptions[key];
  }
  return out;
}

export const KEYSHARD_PREDECESSOR_WRITTEN_BEFORE = 1_791_072_000n;

function isAbsentAccountError(error) {
  const exitCode = Number(error?.exitCode);
  if (exitCode === -13 || exitCode === -256) return true;
  return /get-method exit code -(?:13|256)\b/.test(String(error?.message ?? ''));
}

export function createKeyShardTonRpcProvider(options = {}) {
  return {
    kind: options.kind ?? options.transport?.kind ?? 'ton-rpc',

    async getShardAddress(ownerWallet, callOptions = {}) {
      return deriveKeyShardRawAddress(ownerWallet, resolveRegistryAddress(options.profileRegistryAddress, callOptions));
    },

    async getView(ownerWallet, callOptions = {}) {
      const transport = resolveTransport(options);
      const readViewAt = async (address, extra = {}) => decodeKeyShardViewStack(await transport.runGetMethod({
        address,
        method: 'get_view',
        stack: [],
        ...criticalCallOptions({ ...callOptions, ...extra }),
      }), options.decodeAddressSliceBoc);
      const address = await deriveKeyShardRawAddress(
        ownerWallet, resolveRegistryAddress(options.profileRegistryAddress, callOptions),
      );
      const predecessorRegistry = options.predecessorRegistryAddress ?? null;
      if (!predecessorRegistry || WRITES_GENERATION < 18) return readViewAt(address);
      let current = null;
      let absent = null;
      const settled = { stopOnUninitializedAccount: true };
      try {
        current = await readViewAt(address, settled);
      } catch (error) {
        if (!isAbsentAccountError(error)) throw error;
        absent = error;
      }
      if (current?.exists === true) return current;
      let older = null;
      try {
        older = await readViewAt(await deriveKeyShardRawAddress(ownerWallet, predecessorRegistry, 17), settled);
      } catch (error) {
        if (!isAbsentAccountError(error)) throw error;
      }
      const createdAt = BigInt(older?.created_at ?? 0n);
      if (older?.exists === true && createdAt > 0n && createdAt < KEYSHARD_PREDECESSOR_WRITTEN_BEFORE) {
        return { ...older, fromPredecessor: true, generation: 17 };
      }
      if (current) return current;
      throw absent;
    },

    async getAvatar(ownerWallet, callOptions = {}) {
      const raw = parseTonAddress(ownerWallet).raw;
      return avatarRecordFromKeyShardView(await this.getView(ownerWallet, callOptions), raw);
    },

    async getAvatarVersion(ownerWallet, version, callOptions = {}) {
      const record = await this.getAvatar(ownerWallet, callOptions);
      if (!record.exists || BigInt(record.version) !== BigInt(version)) {
        return { ...record, exists: false, version: BigInt(version) };
      }
      return record;
    },
  };
}
