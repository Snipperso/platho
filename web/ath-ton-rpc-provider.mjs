import { parseTonAddress } from './crypto/platho-crypto.mjs?v=12';
import { decodeTonAddressSliceBoc, encodeTonAddressSliceBoc } from './vault-ton-rpc-provider.mjs?v=36';

export class AthTonRpcProviderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AthTonRpcProviderError';
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
  throw new AthTonRpcProviderError(`${name} is not an integer stack item`);
}

function readStackBool(stack, index, name) {
  return readStackInt(stack, index, name) !== 0n;
}

function readStackAddress(stack, index, name) {
  const item = stack[index];
  const value = item?.value ?? item?.boc ?? item?.cell;
  const type = String(item?.type ?? '').toLowerCase();
  if ((type === 'slice' || type === 'cell') && typeof value === 'string') return decodeTonAddressSliceBoc(value);
  if (typeof item?.address === 'string') return parseTonAddress(item.address).raw;
  if (typeof value === 'string' && /^-?[0-9]+:/.test(value)) return parseTonAddress(value).raw;
  throw new AthTonRpcProviderError(`${name} is not an address stack item`);
}

function readStackCellBoc(stack, index, name) {
  const item = stack[index];
  const value = item?.boc ?? item?.cell ?? item?.value;
  if (typeof value !== 'string' || value.length === 0) {
    throw new AthTonRpcProviderError(`${name} is not a cell stack item`);
  }
  return value;
}

function extractStack(result) {
  const stack = result?.stack ?? result?.result?.stack;
  if (!Array.isArray(stack)) throw new AthTonRpcProviderError('TON get-method response did not include a stack');
  return stack;
}

function resolveTransport(options) {
  const transport = options.transport ?? globalThis.plathoAthRpcTransport ?? globalThis.plathoTonRpcTransport;
  if (!transport?.runGetMethod) throw new AthTonRpcProviderError('TON RPC transport is not configured');
  return transport;
}

function resolveAddress(configured, callOptions, globalName, label) {
  const address = callOptions?.address ?? configured ?? globalThis[globalName];
  if (!address) throw new AthTonRpcProviderError(`${label} address is not configured`);
  return parseTonAddress(address).raw;
}

function stackAddress(address) {
  return { type: 'slice', value: encodeTonAddressSliceBoc(parseTonAddress(address).raw) };
}

function stackNumber(value) {
  return { type: 'num', value: toStackNumber(value) };
}

function criticalCallOptions(callOptions = {}) {
  const out = {};
  for (const key of ['cacheTtlMs', 'ttlMs', 'priority', 'verify', 'allowUnverifiedCriticalRead']) {
    if (callOptions[key] !== undefined) out[key] = callOptions[key];
  }
  return out;
}

export function decodeAthJettonDataStack(result) {
  const stack = extractStack(result);
  return {
    total_supply: readStackInt(stack, 0, 'ATH total supply'),
    mintable: readStackBool(stack, 1, 'ATH mintable'),
    admin_address: readStackAddress(stack, 2, 'ATH admin address'),
    jetton_content_boc: readStackCellBoc(stack, 3, 'ATH jetton content'),
    jetton_wallet_code_boc: readStackCellBoc(stack, 4, 'ATH wallet code'),
  };
}

export function decodeAthWalletDataStack(result) {
  const stack = extractStack(result);
  return {
    balance: readStackInt(stack, 0, 'ATH wallet balance'),
    owner_address: readStackAddress(stack, 1, 'ATH wallet owner'),
    ath_master_address: readStackAddress(stack, 2, 'ATH master address'),
  };
}

export function decodePendingAthNotificationStack(result) {
  const stack = extractStack(result);
  return {
    exists: readStackBool(stack, 0, 'ATH pending notification exists'),
    sender_owner: readStackAddress(stack, 1, 'ATH pending sender owner'),
    response_destination: readStackAddress(stack, 2, 'ATH pending response destination'),
    amount: readStackInt(stack, 3, 'ATH pending amount'),
    created_at: readStackInt(stack, 4, 'ATH pending created at'),
  };
}

export function createAthMasterTonRpcProvider(options = {}) {
  return {
    kind: options.kind ?? options.transport?.kind ?? 'ton-rpc',
    async getJettonData(callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveAddress(options.athMasterAddress, callOptions, 'plathoAthMasterAddress', 'ATHMaster');
      return decodeAthJettonDataStack(await transport.runGetMethod({
        address,
        method: 'get_jetton_data',
        stack: [],
        ...criticalCallOptions(callOptions),
      }));
    },
    async getWalletAddress(ownerAddress, callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveAddress(options.athMasterAddress, callOptions, 'plathoAthMasterAddress', 'ATHMaster');
      const result = await transport.runGetMethod({
        address,
        method: 'get_wallet_address',
        stack: [stackAddress(ownerAddress)],
        ...criticalCallOptions(callOptions),
      });
      return readStackAddress(extractStack(result), 0, 'ATH wallet address');
    },
  };
}

export function createAthWalletTonRpcProvider(options = {}) {
  return {
    kind: options.kind ?? options.transport?.kind ?? 'ton-rpc',
    async getWalletData(callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveAddress(options.athWalletAddress, callOptions, 'plathoAthWalletAddress', 'ATHWallet');
      return decodeAthWalletDataStack(await transport.runGetMethod({
        address,
        method: 'get_wallet_data',
        stack: [],
        ...criticalCallOptions(callOptions),
      }));
    },
    async getPendingNotification(queryId, senderKey, callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveAddress(options.athWalletAddress, callOptions, 'plathoAthWalletAddress', 'ATHWallet');
      return decodePendingAthNotificationStack(await transport.runGetMethod({
        address,
        method: 'get_pending_notification',
        stack: [stackNumber(queryId), stackNumber(senderKey)],
        ...criticalCallOptions(callOptions),
      }));
    },
  };
}
