// key-shard-ton-rpc-provider — reads a wallet's KeyShard: its messaging identity AND its paid avatar pointer.
//
// WHY BOTH LIVE IN ONE READ. ProfileRegistry used to answer `get_avatar(wallet)` out of a map that MEASURED 5.0000
// cells per profile against a ~65536-cell account, i.e. a hard ceiling of 13,076 profiles, reached silently
// (ACTION-phase code 50 while COMPUTE reports exit 0). The pointer moved into the per-wallet KeyShard on
// 2026-07-21, which removes the ceiling and, as a side effect, removes a whole round trip: a client resolving a
// contact already reads that contact's KeyShard, so the avatar now arrives in the SAME batched read as the keys
// instead of a second getter against a registry.
//
// THE ADDRESS IS DERIVED, NOT LOOKED UP. contractAddress(0, KeyShard(owner_wallet, profile_registry)) — so the
// registry address used here MUST be the one the shard was deployed against. Derive with a different registry and
// you get a well-formed address that simply holds nothing: reads return "no such user" and nothing errors. That is
// why web/shard-address.mjs pins this derivation against @ton/core rather than trusting it.

import { parseTonAddress } from './crypto/platho-crypto.mjs?v=12';
import { keyShardAddressBytes, rawAddress } from './shard-address.mjs?v=3';

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

/**
 * KeyShardView, in getter stack order. The length check is deliberate and load-bearing: this decoder reads keys
 * used to ENCRYPT and a pointer used to display identity, so a silent off-by-one after a contract change would
 * hand callers the wrong field rather than an error. The registry lane learned this the expensive way — a stale
 * 13-item decoder against a 12-item getter.
 */
export function decodeKeyShardViewStack(result, decodeAddressSliceBoc) {
  const stack = result?.stack ?? result?.result?.stack;
  if (!Array.isArray(stack)) throw new KeyShardTonRpcProviderError('TON get-method response did not include a stack');
  if (stack.length !== 24) {
    throw new KeyShardTonRpcProviderError(`KeyShard get_view ABI mismatch: expected 24 stack items, got ${stack.length}`);
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
  };
}

/**
 * The avatar half of the view, in the shape ProfileRegistry.get_avatar used to return. Keeping the shape lets the
 * app's pointer handling stay put while its SOURCE moves; `exists` now means "this wallet has bought an avatar",
 * which is avatar_version > 0 rather than a map hit.
 */
export function avatarRecordFromKeyShardView(view, ownerWallet) {
  const version = BigInt(view?.avatar_version ?? 0n);
  if (version === 0n) {
    return {
      exists: false,
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

export async function deriveKeyShardRawAddress(ownerWallet, profileRegistryAddress) {
  const owner = parseTonAddress(ownerWallet).raw;
  const registry = parseTonAddress(profileRegistryAddress).raw;
  return rawAddress(await keyShardAddressBytes(owner, registry));
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
  for (const key of ['cacheTtlMs', 'ttlMs', 'priority', 'verify', 'allowUnverifiedCriticalRead']) {
    if (callOptions[key] !== undefined) out[key] = callOptions[key];
  }
  return out;
}

export function createKeyShardTonRpcProvider(options = {}) {
  return {
    kind: options.kind ?? options.transport?.kind ?? 'ton-rpc',

    async getShardAddress(ownerWallet, callOptions = {}) {
      return deriveKeyShardRawAddress(ownerWallet, resolveRegistryAddress(options.profileRegistryAddress, callOptions));
    },

    async getView(ownerWallet, callOptions = {}) {
      const transport = resolveTransport(options);
      const address = await deriveKeyShardRawAddress(
        ownerWallet, resolveRegistryAddress(options.profileRegistryAddress, callOptions),
      );
      return decodeKeyShardViewStack(await transport.runGetMethod({
        address,
        method: 'get_view',
        stack: [],
        ...criticalCallOptions(callOptions),
      }), options.decodeAddressSliceBoc);
    },

    async getAvatar(ownerWallet, callOptions = {}) {
      const raw = parseTonAddress(ownerWallet).raw;
      return avatarRecordFromKeyShardView(await this.getView(ownerWallet, callOptions), raw);
    },

    // The registry kept no version history — an update DELETED the previous record, so this only ever answered for
    // the CURRENT version. Answering the same question against the shard's single pointer is therefore not a
    // reduction in what a caller can learn; it is the same answer from the account that now owns it.
    async getAvatarVersion(ownerWallet, version, callOptions = {}) {
      const record = await this.getAvatar(ownerWallet, callOptions);
      if (!record.exists || BigInt(record.version) !== BigInt(version)) {
        return { ...record, exists: false, version: BigInt(version) };
      }
      return record;
    },
  };
}
