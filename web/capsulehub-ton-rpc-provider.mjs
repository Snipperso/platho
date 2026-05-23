import { parseTonAddress } from './crypto/platho-crypto.mjs';
import { decodeTonAddressSliceBoc } from './vault-ton-rpc-provider.mjs';

export class CapsuleHubTonRpcProviderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CapsuleHubTonRpcProviderError';
  }
}

function assertString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new CapsuleHubTonRpcProviderError(`${name} must be a non-empty string`);
  }
  return value;
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
  throw new CapsuleHubTonRpcProviderError(`${name} is not an integer stack item`);
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
  throw new CapsuleHubTonRpcProviderError(`${name} is not an address stack item`);
}

function readStackCellBoc(stack, index, name) {
  const item = stack[index];
  const value = item?.boc ?? item?.cell ?? item?.value;
  if (typeof value !== 'string' || value.length === 0) {
    throw new CapsuleHubTonRpcProviderError(`${name} is not a cell stack item`);
  }
  return value;
}

function extractStack(result) {
  const stack = result?.stack ?? result?.result?.stack;
  if (!Array.isArray(stack)) throw new CapsuleHubTonRpcProviderError('TON get-method response did not include a stack');
  return stack;
}

function resolveTransport(options) {
  const transport = options.transport ?? globalThis.plathoCapsuleHubRpcTransport ?? globalThis.plathoTonRpcTransport;
  if (!transport?.runGetMethod) throw new CapsuleHubTonRpcProviderError('TON RPC transport is not configured');
  return transport;
}

function resolveCapsuleHubAddress(configured, callOptions) {
  const address = callOptions?.capsuleHubAddress
    ?? configured
    ?? globalThis.plathoCapsuleHubAddress
    ?? globalThis.PLATHO_CAPSULEHUB_ADDRESS;
  if (!address) throw new CapsuleHubTonRpcProviderError('CapsuleHub contract address is not configured');
  return parseTonAddress(address).raw;
}

function stackNumber(value) {
  return { type: 'num', value: toStackNumber(value) };
}

export function decodePrivateCapsuleEntryStack(result) {
  const stack = extractStack(result);
  return {
    exists: readStackBool(stack, 0, 'private entry exists'),
    entry_id: readStackInt(stack, 1, 'private entry id'),
    entry_uid: readStackInt(stack, 2, 'private entry uid'),
    publish_id: readStackInt(stack, 3, 'private publish id'),
    author_wallet: readStackAddress(stack, 4, 'private author wallet'),
    size_class: readStackInt(stack, 5, 'private size class'),
    crypto_suite: readStackInt(stack, 6, 'private crypto suite'),
    header_0_hash: readStackInt(stack, 7, 'private header 0 hash'),
    header_1_hash: readStackInt(stack, 8, 'private header 1 hash'),
    body_hash: readStackInt(stack, 9, 'private body hash'),
    header_0_boc: readStackCellBoc(stack, 10, 'private header 0 cell'),
    header_1_boc: readStackCellBoc(stack, 11, 'private header 1 cell'),
    body_boc: readStackCellBoc(stack, 12, 'private body cell'),
    created_at: readStackInt(stack, 13, 'private created at'),
  };
}

export function decodePublicCapsuleEntryStack(result) {
  const stack = extractStack(result);
  return {
    exists: readStackBool(stack, 0, 'public entry exists'),
    entry_id: readStackInt(stack, 1, 'public entry id'),
    entry_uid: readStackInt(stack, 2, 'public entry uid'),
    publish_id: readStackInt(stack, 3, 'public publish id'),
    author_wallet: readStackAddress(stack, 4, 'public author wallet'),
    header_hash: readStackInt(stack, 5, 'public header hash'),
    body_hash: readStackInt(stack, 6, 'public body hash'),
    header_boc: readStackCellBoc(stack, 7, 'public header cell'),
    body_boc: readStackCellBoc(stack, 8, 'public body cell'),
    created_at: readStackInt(stack, 9, 'public created at'),
  };
}

export function decodeCapsuleHubStateStack(result) {
  const stack = extractStack(result);
  return {
    sealed: readStackBool(stack, 0, 'CapsuleHub sealed'),
    vault_bound: readStackBool(stack, 1, 'CapsuleHub vault_bound'),
    deployment_manifest_hash: readStackInt(stack, 2, 'CapsuleHub manifest hash'),
    private_latest_id: readStackInt(stack, 3, 'CapsuleHub private latest id'),
    public_latest_id: readStackInt(stack, 4, 'CapsuleHub public latest id'),
    accrued_plato_fee_ton: readStackInt(stack, 5, 'CapsuleHub accrued fee'),
    fee_accumulator_address: readStackAddress(stack, 6, 'CapsuleHub fee accumulator'),
    vault_address: readStackAddress(stack, 7, 'CapsuleHub vault'),
    genesis_controller_address: readStackAddress(stack, 8, 'CapsuleHub genesis controller'),
  };
}

export function createCapsuleHubTonRpcProvider(options = {}) {
  return {
    kind: options.kind ?? options.transport?.kind ?? 'ton-rpc',
    async getPrivateEntry(entryId, callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveCapsuleHubAddress(options.capsuleHubAddress, callOptions);
      return decodePrivateCapsuleEntryStack(await transport.runGetMethod({
        address,
        method: 'get_private_entry',
        stack: [stackNumber(entryId)],
      }));
    },
    async getPublicEntry(entryId, callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveCapsuleHubAddress(options.capsuleHubAddress, callOptions);
      return decodePublicCapsuleEntryStack(await transport.runGetMethod({
        address,
        method: 'get_public_entry',
        stack: [stackNumber(entryId)],
      }));
    },
    async getState(callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveCapsuleHubAddress(options.capsuleHubAddress, callOptions);
      return decodeCapsuleHubStateStack(await transport.runGetMethod({
        address,
        method: 'get_state',
        stack: [],
      }));
    },
  };
}
