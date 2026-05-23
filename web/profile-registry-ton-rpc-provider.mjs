import { parseTonAddress } from './crypto/platho-crypto.mjs';
import { decodeTonAddressSliceBoc, encodeTonAddressSliceBoc } from './vault-ton-rpc-provider.mjs';

export class ProfileRegistryTonRpcProviderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProfileRegistryTonRpcProviderError';
  }
}

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
  throw new ProfileRegistryTonRpcProviderError(`${name} is not an integer stack item`);
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
  throw new ProfileRegistryTonRpcProviderError(`${name} is not an address stack item`);
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

function stackNumber(value) {
  return { type: 'num', value: toStackNumber(value) };
}

export function decodeProfileAvatarStack(result) {
  const stack = extractStack(result);
  return {
    exists: readStackBool(stack, 0, 'profile avatar exists'),
    owner_wallet: readStackAddress(stack, 1, 'profile avatar owner wallet'),
    version: readStackInt(stack, 2, 'profile avatar version'),
    avatar_hash: readStackInt(stack, 3, 'profile avatar hash'),
    avatar_entry_id: readStackInt(stack, 4, 'profile avatar entry id'),
    avatar_stream_id: readStackInt(stack, 5, 'profile avatar stream id'),
    avatar_part_count: readStackInt(stack, 6, 'profile avatar part count'),
    media_format: readStackInt(stack, 7, 'profile avatar media format'),
    updated_at: readStackInt(stack, 8, 'profile avatar updated at'),
  };
}

export function decodeProfileRegistryGlobalStack(result) {
  const stack = extractStack(result);
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
    avatar_record_count: readStackInt(stack, 9, 'ProfileRegistry avatar record count'),
    treasury_due_ath: readStackInt(stack, 10, 'ProfileRegistry treasury due'),
    burn_due_ath: readStackInt(stack, 11, 'ProfileRegistry burn due'),
    pending_treasury_flush_count: readStackInt(stack, 12, 'ProfileRegistry pending treasury flush count'),
    pending_burn_flush_count: readStackInt(stack, 13, 'ProfileRegistry pending burn flush count'),
  };
}

export function createProfileRegistryTonRpcProvider(options = {}) {
  return {
    kind: options.kind ?? options.transport?.kind ?? 'ton-rpc',
    async getAvatar(ownerWallet, callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveAddress(options.profileRegistryAddress, callOptions);
      return decodeProfileAvatarStack(await transport.runGetMethod({
        address,
        method: 'get_avatar',
        stack: [stackAddress(ownerWallet)],
      }));
    },
    async getAvatarVersion(ownerWallet, version, callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveAddress(options.profileRegistryAddress, callOptions);
      return decodeProfileAvatarStack(await transport.runGetMethod({
        address,
        method: 'get_avatar_version',
        stack: [stackAddress(ownerWallet), stackNumber(version)],
      }));
    },
    async getAthWalletAddress(ownerWallet, callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveAddress(options.profileRegistryAddress, callOptions);
      const result = await transport.runGetMethod({
        address,
        method: 'get_ath_wallet_address',
        stack: [stackAddress(ownerWallet)],
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
      }));
    },
  };
}
