import { parseTonAddress } from './crypto/platho-crypto.mjs?v=12';
import { decodeTonAddressSliceBoc } from './vault-ton-rpc-provider.mjs?v=36';
import { tonCell } from './pwa-contract-transactions.mjs?v=25';

const CAPSULEHUB_OPS = Object.freeze({
  PublishPrivateFromVault: 0xA4F862C0n,
  PublishPublicFromVault: 0x8C2A76B7n,
});

const CAPSULEHUB_MESSAGE_BODY_BUCKET_SECONDS = 3600;
const CAPSULEHUB_MESSAGE_BODY_LOOKUP_LIMIT = 1000;
const CAPSULEHUB_MESSAGE_BODY_LOOKUP_MAX_PAGES = 8;
const CAPSULEHUB_BODY_HISTORY_UNAVAILABLE = 'BODY_HISTORY_UNAVAILABLE';

export class CapsuleHubTonRpcProviderError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'CapsuleHubTonRpcProviderError';
    if (options.code !== undefined) this.code = options.code;
    if (options.entryId !== undefined) this.entryId = options.entryId;
    if (options.kind !== undefined) this.kind = options.kind;
    if (options.historyScanIncomplete !== undefined) this.historyScanIncomplete = options.historyScanIncomplete;
    if (options.cause !== undefined) this.cause = options.cause;
    if (options.historyError !== undefined) this.historyError = options.historyError;
  }
}

export function isCapsuleHubBodyHistoryUnavailable(error) {
  return error?.code === CAPSULEHUB_BODY_HISTORY_UNAVAILABLE;
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

function stackItemValue(item) {
  if (Array.isArray(item)) return item[1];
  if (item && typeof item === 'object' && 'value' in item) return item.value;
  if (item && typeof item === 'object' && 'num' in item) return item.num;
  if (item && typeof item === 'object' && 'boc' in item) return item.boc;
  if (item && typeof item === 'object' && 'cell' in item) return item.cell;
  return item;
}

function stackItemType(item) {
  if (Array.isArray(item)) return String(item[0] ?? '').toLowerCase();
  if (item && typeof item === 'object' && 'type' in item) return String(item.type ?? '').toLowerCase();
  return typeof item;
}

function readStackInt(stack, index, name) {
  const item = stack[index];
  const raw = stackItemValue(item);
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
  throw new CapsuleHubTonRpcProviderError(`${name} is not an address stack item`);
}

function readStackCellBoc(stack, index, name) {
  const item = stack[index];
  const value = stackItemValue(item);
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

function messageHistoryTransports(transport) {
  const transports = Array.isArray(transport?.transports) && transport.transports.length > 0
    ? transport.transports
    : [transport];
  const out = [];
  for (const item of transports) {
    const resolved = item?.transport ?? item;
    if (resolved?.supportsMessageHistory === false) continue;
    if (resolved?.getMessages && !out.includes(resolved)) out.push(resolved);
  }
  return out;
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

function runGetCallOptions(callOptions = {}) {
  const out = {};
  for (const key of ['cacheTtlMs', 'ttlMs', 'priority', 'verify', 'allowUnverifiedCriticalRead', 'requestTimeoutMs', 'timeoutMs', 'queueTimeoutMs']) {
    if (callOptions[key] !== undefined) out[key] = callOptions[key];
  }
  return out;
}

function uint256Hex(value) {
  return `0x${BigInt(value).toString(16).padStart(64, '0')}`;
}

function uint256HexPlain(value) {
  return BigInt(value).toString(16).padStart(64, '0');
}

function cellToBocBase64(cell) {
  return tonCell.bytesToBase64(tonCell.serializeBoc(cell));
}

async function cellHashHex(cell) {
  const { hash } = await tonCell.computeCellHashAndDepth(cell);
  return `0x${tonCell.bytesToHex(hash)}`;
}

class TinyCellReader {
  constructor(cell, name = 'cell') {
    if (!cell || !(cell.data instanceof Uint8Array) || !Array.isArray(cell.refs)) {
      throw new CapsuleHubTonRpcProviderError(`${name} is not a TON cell`);
    }
    this.cell = cell;
    this.name = name;
    this.bitOffset = 0;
    this.refOffset = 0;
  }

  readBit(label) {
    if (this.bitOffset >= this.cell.bitLength) {
      throw new CapsuleHubTonRpcProviderError(`${this.name}.${label} is truncated`);
    }
    const byte = this.cell.data[this.bitOffset >> 3] ?? 0;
    const bit = (byte & (1 << (7 - (this.bitOffset & 7)))) !== 0;
    this.bitOffset += 1;
    return bit;
  }

  readUint(bitLength, label) {
    let out = 0n;
    for (let index = 0; index < bitLength; index += 1) {
      out = (out << 1n) | (this.readBit(label) ? 1n : 0n);
    }
    return out;
  }

  skipBits(bitLength, label) {
    for (let index = 0; index < bitLength; index += 1) this.readBit(label);
  }

  readAddress(label) {
    const tag = this.readUint(2, `${label}.tag`);
    if (tag === 0n) return null;
    if (tag !== 2n) throw new CapsuleHubTonRpcProviderError(`${this.name}.${label} is not a standard address`);
    const anycast = this.readUint(1, `${label}.anycast`);
    if (anycast !== 0n) throw new CapsuleHubTonRpcProviderError(`${this.name}.${label} uses unsupported anycast`);
    const wcByte = Number(this.readUint(8, `${label}.workchain`));
    const workchain = wcByte >= 128 ? wcByte - 256 : wcByte;
    const hash = [];
    for (let index = 0; index < 32; index += 1) {
      hash.push(Number(this.readUint(8, `${label}.hash`)));
    }
    return `${workchain}:${hash.map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  }

  readRef(label) {
    const ref = this.cell.refs[this.refOffset];
    if (!ref) throw new CapsuleHubTonRpcProviderError(`${this.name}.${label} ref is missing`);
    this.refOffset += 1;
    return ref;
  }
}

function parseCapsuleHubPublishMessageBody(bodyBoc) {
  const root = tonCell.parseBocBase64(assertString(bodyBoc, 'message body BoC'));
  const reader = new TinyCellReader(root, 'CapsuleHub publish message');
  const op = reader.readUint(32, 'op');
  if (op === CAPSULEHUB_OPS.PublishPrivateFromVault) {
    reader.readUint(64, 'bounce_id');
    reader.readUint(160, 'bounce_tag');
    const publishId = reader.readUint(256, 'publish_id');
    const sizeClass = reader.readUint(8, 'size_class');
    const cryptoSuite = reader.readUint(8, 'crypto_suite');
    const header0Hash = reader.readUint(256, 'header_0_hash');
    const payload = new TinyCellReader(reader.readRef('payload'), 'CapsuleHub private publish payload');
    const header1Hash = payload.readUint(256, 'header_1_hash');
    const bodyHash = payload.readUint(256, 'body_hash');
    const header0 = payload.readRef('header_0');
    const header1 = payload.readRef('header_1');
    const body = payload.readRef('body');
    const protocolFeePaid = payload.readUint(128, 'protocol_fee_paid');
    return {
      kind: 'private',
      publish_id: publishId,
      size_class: sizeClass,
      crypto_suite: cryptoSuite,
      header_0_hash: header0Hash,
      header_1_hash: header1Hash,
      body_hash: bodyHash,
      header_0_cell: header0,
      header_1_cell: header1,
      body_cell: body,
      header_0_boc: cellToBocBase64(header0),
      header_1_boc: cellToBocBase64(header1),
      body_boc: cellToBocBase64(body),
      protocol_fee_paid: protocolFeePaid,
    };
  }
  if (op === CAPSULEHUB_OPS.PublishPublicFromVault) {
    reader.readUint(64, 'bounce_id');
    reader.readUint(160, 'bounce_tag');
    const publishId = reader.readUint(256, 'publish_id');
    const sizeClass = reader.readUint(8, 'size_class');
    const marketingNote = reader.readUint(152, 'marketing_note');
    const authorWallet = reader.readAddress('author_wallet');
    const payload = new TinyCellReader(reader.readRef('payload'), 'CapsuleHub public publish payload');
    const headerHash = payload.readUint(256, 'header_hash');
    const bodyHash = payload.readUint(256, 'body_hash');
    const header = payload.readRef('header');
    const body = payload.readRef('body');
    const protocolFeePaid = payload.readUint(128, 'protocol_fee_paid');
    return {
      kind: 'public',
      publish_id: publishId,
      size_class: sizeClass,
      marketing_note: marketingNote,
      author_wallet: authorWallet,
      header_hash: headerHash,
      body_hash: bodyHash,
      header_cell: header,
      body_cell: body,
      header_boc: cellToBocBase64(header),
      body_boc: cellToBocBase64(body),
      protocol_fee_paid: protocolFeePaid,
    };
  }
  throw new CapsuleHubTonRpcProviderError(`Unsupported CapsuleHub publish opcode 0x${op.toString(16)}`);
}

function messageRecordsFromResponse(response) {
  const records = response?.messages ?? response?.result?.messages ?? response?.result ?? [];
  return Array.isArray(records) ? records : [];
}

function pagedMessageParams(params, pageIndex) {
  if (pageIndex <= 0) return params;
  const limit = Math.max(1, Number(params.limit ?? CAPSULEHUB_MESSAGE_BODY_LOOKUP_LIMIT));
  const offset = Math.max(0, Number(params.offset ?? 0)) + (pageIndex * limit);
  return { ...params, offset };
}

function messageBodyBocFromRecord(record) {
  return record?.message_content?.body
    ?? record?.messageContent?.body
    ?? record?.body
    ?? record?.in_msg?.message_content?.body
    ?? record?.inMsg?.messageContent?.body
    ?? null;
}

function messageRecordAddressValue(value) {
  if (!value || typeof value !== 'object') return value;
  return value.address
    ?? value.account_address
    ?? value.accountAddress
    ?? value.raw
    ?? value.addr
    ?? value.value
    ?? null;
}

function normalizeRecordAddressRaw(value) {
  const address = messageRecordAddressValue(value);
  if (address === null || address === undefined || address === '') return null;
  try {
    return parseTonAddress(String(address)).raw;
  } catch {
    return null;
  }
}

function messageSourceRawFromRecord(record) {
  return normalizeRecordAddressRaw(
    record?.source
    ?? record?.source_address
    ?? record?.sourceAddress
    ?? record?.src
    ?? record?.from
    ?? record?.in_msg?.source
    ?? record?.in_msg?.source_address
    ?? record?.inMsg?.source
    ?? record?.inMsg?.sourceAddress
    ?? null,
  );
}

function expectedVaultSourceRaw(callOptions = {}, providerOptions = {}) {
  const source = callOptions.vaultAddress ?? providerOptions.vaultAddress ?? null;
  return source ? parseTonAddress(source).raw : null;
}

function messageCreatedAtSecFromRecord(record) {
  const value = record?.created_at
    ?? record?.createdAt
    ?? record?.utime
    ?? record?.now
    ?? record?.in_msg?.created_at
    ?? record?.inMsg?.createdAt
    ?? null;
  if (value === null || value === undefined) return null;
  try {
    const sec = BigInt(value);
    return sec > 0n ? sec : null;
  } catch {
    return null;
  }
}

function opcodeHex(op) {
  return `0x${op.toString(16).toUpperCase()}`;
}

function entryBodyCacheKey(kind, entry) {
  if (!entry) return null;
  const publishId = entry.publish_id === undefined || entry.publish_id === null ? null : BigInt(entry.publish_id).toString();
  const bodyHash = entry.body_hash === undefined || entry.body_hash === null ? null : BigInt(entry.body_hash).toString();
  if (!publishId || !bodyHash) return null;
  return `${kind}|${publishId}|${bodyHash}`;
}

function messageBucketParams(kind, entry, address, callOptions = {}, providerOptions = {}, options = {}) {
  const op = kind === 'private' ? CAPSULEHUB_OPS.PublishPrivateFromVault : CAPSULEHUB_OPS.PublishPublicFromVault;
  const limit = Number(callOptions.messageLookupLimit ?? providerOptions.messageLookupLimit ?? CAPSULEHUB_MESSAGE_BODY_LOOKUP_LIMIT);
  const params = {
    destination: address,
    opcode: opcodeHex(op),
    exclude_externals: true,
    limit: Number.isFinite(limit) ? Math.max(1, Math.min(1000, Math.floor(limit))) : CAPSULEHUB_MESSAGE_BODY_LOOKUP_LIMIT,
    sort: 'desc',
  };
  // Toncenter v3 message history can miss valid messages when the source
  // filter uses a different raw-address casing. Keep the query broad enough
  // and validate the expected Vault source after parsing each record.
  if (options.includeBodyHash !== false && entry?.body_hash !== undefined && entry?.body_hash !== null && BigInt(entry.body_hash) !== 0n) {
    params.body_hash = uint256HexPlain(entry.body_hash);
    params.limit = Math.min(params.limit, 10);
  }
  const createdAt = Number(BigInt(entry?.created_at ?? 0n));
  if (Number.isFinite(createdAt) && createdAt > 0) {
    const bucketSeconds = Number(callOptions.messageBucketSeconds ?? providerOptions.messageBucketSeconds ?? CAPSULEHUB_MESSAGE_BODY_BUCKET_SECONDS);
    const bucket = Number.isFinite(bucketSeconds) && bucketSeconds > 0
      ? Math.floor(createdAt / bucketSeconds) * bucketSeconds
      : createdAt;
    params.start_utime = Math.max(0, bucket - 60);
    params.end_utime = bucket + Math.max(1, bucketSeconds) + 120;
    params.sort = 'asc';
  }
  return params;
}

function withoutBodyHash(params) {
  const { body_hash: _bodyHash, ...rest } = params;
  if (params.body_hash !== undefined) rest.limit = CAPSULEHUB_MESSAGE_BODY_LOOKUP_LIMIT;
  return rest;
}

function unbucketedMessagesParams(params) {
  const {
    start_utime: _startUtime,
    end_utime: _endUtime,
    ...rest
  } = params;
  return {
    ...rest,
    sort: 'desc',
  };
}

function stableParamKey(params) {
  return JSON.stringify(Object.keys(params).sort().map((key) => [key, params[key]]));
}

function messageLookupParamAttempts(kind, entry, address, callOptions = {}, providerOptions = {}) {
  const primary = messageBucketParams(kind, entry, address, callOptions, providerOptions, { includeBodyHash: true });
  const attempts = [primary];
  if (primary.body_hash) attempts.push(withoutBodyHash(primary));
  if (primary.start_utime !== undefined || primary.end_utime !== undefined) {
    const unbucketed = unbucketedMessagesParams(primary);
    attempts.push(unbucketed);
    if (unbucketed.body_hash) attempts.push(withoutBodyHash(unbucketed));
  }
  const seen = new Set();
  return attempts.filter((params) => {
    const key = stableParamKey(params);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function bodyHistoryUnavailable(kind, entry, options = {}) {
  // CapsuleHub stores authenticated hashes on-chain; the publish body must come from message history or this provider fails closed.
  return new CapsuleHubTonRpcProviderError('CapsuleHub publish body was not found in message history', {
    code: CAPSULEHUB_BODY_HISTORY_UNAVAILABLE,
    entryId: entry?.entry_id?.toString?.() ?? null,
    kind,
    historyScanIncomplete: options.historyScanIncomplete === true,
    cause: options.cause,
    historyError: options.cause ? String(options.cause?.message ?? options.cause).slice(0, 500) : undefined,
  });
}

async function assertParsedPublishMatchesEntry(kind, parsed, entry) {
  const expectedBodyHash = uint256Hex(entry.body_hash);
  if (parsed.kind !== kind) throw new CapsuleHubTonRpcProviderError('CapsuleHub publish kind mismatch');
  if (BigInt(parsed.publish_id) !== BigInt(entry.publish_id)) {
    throw new CapsuleHubTonRpcProviderError('CapsuleHub publish id mismatch');
  }
  if (uint256Hex(parsed.body_hash) !== expectedBodyHash) {
    throw new CapsuleHubTonRpcProviderError('CapsuleHub publish body hash field mismatch');
  }
  if (await cellHashHex(parsed.body_cell) !== expectedBodyHash) {
    throw new CapsuleHubTonRpcProviderError('CapsuleHub publish body cell hash mismatch');
  }
  if (kind === 'private') {
    if (uint256Hex(parsed.header_0_hash) !== uint256Hex(entry.header_0_hash)) {
      throw new CapsuleHubTonRpcProviderError('CapsuleHub private header0 hash field mismatch');
    }
    if (uint256Hex(parsed.header_1_hash) !== uint256Hex(entry.header_1_hash)) {
      throw new CapsuleHubTonRpcProviderError('CapsuleHub private header1 hash field mismatch');
    }
    if (await cellHashHex(parsed.header_0_cell) !== uint256Hex(entry.header_0_hash)) {
      throw new CapsuleHubTonRpcProviderError('CapsuleHub private header0 cell hash mismatch');
    }
    if (await cellHashHex(parsed.header_1_cell) !== uint256Hex(entry.header_1_hash)) {
      throw new CapsuleHubTonRpcProviderError('CapsuleHub private header1 cell hash mismatch');
    }
  } else {
    if (uint256Hex(parsed.header_hash) !== uint256Hex(entry.header_hash)) {
      throw new CapsuleHubTonRpcProviderError('CapsuleHub public header hash field mismatch');
    }
    if (await cellHashHex(parsed.header_cell) !== uint256Hex(entry.header_hash)) {
      throw new CapsuleHubTonRpcProviderError('CapsuleHub public header cell hash mismatch');
    }
  }
}

export function decodePrivateCapsuleEntryStack(result) {
  const stack = extractStack(result);
  if (stack.length !== 15) {
    throw new CapsuleHubTonRpcProviderError('CapsuleHub private entry ABI mismatch: key-index entry view required');
  }
  const header1Boc = readStackCellBoc(stack, 14, 'private header 1 cell');
  return {
    exists: readStackBool(stack, 0, 'private entry exists'),
    entry_id: readStackInt(stack, 1, 'private entry id'),
    sender_prev_link: readStackInt(stack, 2, 'private sender previous link'),
    recipient_prev_link: readStackInt(stack, 3, 'private recipient previous link'),
    entry_uid: readStackInt(stack, 4, 'private entry uid'),
    publish_id: readStackInt(stack, 5, 'private publish id'),
    author_wallet: readStackAddress(stack, 6, 'private author wallet'),
    page_id: readStackInt(stack, 7, 'private page id'),
    page_offset: readStackInt(stack, 8, 'private page offset'),
    created_at: readStackInt(stack, 9, 'private created at'),
    header_0_hash: readStackInt(stack, 10, 'private header 0 hash'),
    header_1_hash: readStackInt(stack, 11, 'private header 1 hash'),
    body_hash: readStackInt(stack, 12, 'private body hash'),
    header_0_boc: readStackCellBoc(stack, 13, 'private header 0 cell'),
    header_1_boc: header1Boc,
    body_boc: null,
  };
}

export function decodePrivateCapsuleKeyIndexStack(result) {
  const stack = extractStack(result);
  if (stack.length !== 5) {
    throw new CapsuleHubTonRpcProviderError('CapsuleHub private key index ABI mismatch: current key-index view required');
  }
  return {
    exists: readStackBool(stack, 0, 'private key index exists'),
    key_id: readStackInt(stack, 1, 'private key index key id'),
    latest_entry_id: readStackInt(stack, 2, 'private key index latest entry id'),
    latest_entry_link: readStackInt(stack, 3, 'private key index latest entry link'),
    entry_count: readStackInt(stack, 4, 'private key index entry count'),
  };
}

export function decodePublicCapsuleEntryStack(result) {
  const stack = extractStack(result);
  if (stack.length !== 11) {
    throw new CapsuleHubTonRpcProviderError('CapsuleHub public entry ABI mismatch: current entry view required');
  }
  const headerBoc = readStackCellBoc(stack, 10, 'public header cell');
  return {
    exists: readStackBool(stack, 0, 'public entry exists'),
    entry_id: readStackInt(stack, 1, 'public entry id'),
    entry_uid: readStackInt(stack, 2, 'public entry uid'),
    publish_id: readStackInt(stack, 3, 'public publish id'),
    author_wallet: readStackAddress(stack, 4, 'public author wallet'),
    page_id: readStackInt(stack, 5, 'public page id'),
    page_offset: readStackInt(stack, 6, 'public page offset'),
    created_at: readStackInt(stack, 7, 'public created at'),
    header_hash: readStackInt(stack, 8, 'public header hash'),
    body_hash: readStackInt(stack, 9, 'public body hash'),
    header_boc: headerBoc,
    body_boc: null,
  };
}

export function decodeCapsuleHubPageStack(result) {
  const stack = extractStack(result);
  return {
    exists: readStackBool(stack, 0, 'CapsuleHub page exists'),
    page_id: readStackInt(stack, 1, 'CapsuleHub page id'),
    first_entry_id: readStackInt(stack, 2, 'CapsuleHub page first entry id'),
    next_entry_id: readStackInt(stack, 3, 'CapsuleHub page next entry id'),
    entry_count: readStackInt(stack, 4, 'CapsuleHub page entry count'),
    opened_at: readStackInt(stack, 5, 'CapsuleHub page opened at'),
    updated_at: readStackInt(stack, 6, 'CapsuleHub page updated at'),
  };
}

export function decodeCapsuleHubStateStack(result) {
  const stack = extractStack(result);
  if (stack.length !== 21) {
    throw new CapsuleHubTonRpcProviderError('CapsuleHub state ABI mismatch: current state view required');
  }
  const privateLatest = readStackInt(stack, 3, 'CapsuleHub private latest id');
  const publicLatest = readStackInt(stack, 4, 'CapsuleHub public latest id');
  return {
    sealed: readStackBool(stack, 0, 'CapsuleHub sealed'),
    vault_bound: readStackBool(stack, 1, 'CapsuleHub vault_bound'),
    deployment_manifest_hash: readStackInt(stack, 2, 'CapsuleHub manifest hash'),
    private_latest_id: privateLatest,
    public_latest_id: publicLatest,
    private_page_count: readStackInt(stack, 5, 'CapsuleHub private page count'),
    public_page_count: readStackInt(stack, 6, 'CapsuleHub public page count'),
    page_size: readStackInt(stack, 7, 'CapsuleHub page size'),
    index_storage_years: readStackInt(stack, 8, 'CapsuleHub index storage years'),
    index_retention_seconds: readStackInt(stack, 9, 'CapsuleHub index retention seconds'),
    accrued_plato_fee_ton: readStackInt(stack, 10, 'CapsuleHub accrued fee'),
    fee_accumulator_address: readStackAddress(stack, 11, 'CapsuleHub fee accumulator'),
    vault_address: readStackAddress(stack, 12, 'CapsuleHub vault'),
    genesis_controller_address: readStackAddress(stack, 13, 'CapsuleHub genesis controller'),
    private_live_count: readStackInt(stack, 14, 'CapsuleHub private live count'),
    public_live_count: readStackInt(stack, 15, 'CapsuleHub public live count'),
    index_storage_reserve_ton: readStackInt(stack, 16, 'CapsuleHub index storage reserve'),
    protected_reserve_ton: readStackInt(stack, 17, 'CapsuleHub protected reserve'),
    reserve_floor_ton: readStackInt(stack, 18, 'CapsuleHub reserve floor'),
    reserve_buffer_numerator: readStackInt(stack, 19, 'CapsuleHub reserve buffer numerator'),
    reserve_buffer_denominator: readStackInt(stack, 20, 'CapsuleHub reserve buffer denominator'),
  };
}

export function createCapsuleHubTonRpcProvider(options = {}) {
  const publishBodyCache = new Map();

  async function cachePublishMessages(kind, records, expectedSourceRaw = null) {
    for (const record of records) {
      const actualSourceRaw = messageSourceRawFromRecord(record);
      if (expectedSourceRaw && actualSourceRaw && actualSourceRaw !== expectedSourceRaw) continue;
      const bodyBoc = messageBodyBocFromRecord(record);
      if (!bodyBoc) continue;
      try {
        const parsed = parseCapsuleHubPublishMessageBody(bodyBoc);
        const createdAt = messageCreatedAtSecFromRecord(record);
        if (createdAt !== null && (!parsed.created_at || parsed.created_at === 0n)) parsed.created_at = createdAt;
        const key = `${parsed.kind}|${parsed.publish_id.toString()}|${parsed.body_hash.toString()}`;
        publishBodyCache.set(key, parsed);
      } catch {
        // The endpoint may return neighboring messages when filters are broad.
      }
    }
  }

  async function resolveEntryBody(kind, entry, callOptions = {}) {
    if (!entry || entry.exists !== true) return entry;
    if (entry.body_boc) return entry;
    const key = entryBodyCacheKey(kind, entry);
    if (!key) throw new CapsuleHubTonRpcProviderError('CapsuleHub entry cannot be matched to a publish body');
    let parsed = publishBodyCache.get(key);
    if (!parsed) {
      const transport = resolveTransport(options);
      if (!transport?.getMessages) {
        throw new CapsuleHubTonRpcProviderError('TON RPC transport cannot read CapsuleHub message history');
      }
      const historyTransports = messageHistoryTransports(transport);
      if (historyTransports.length === 0) {
        throw new CapsuleHubTonRpcProviderError('TON RPC transport cannot read CapsuleHub message history');
      }
      const address = resolveCapsuleHubAddress(options.capsuleHubAddress, callOptions);
      const attempts = messageLookupParamAttempts(kind, entry, address, callOptions, options);
      const expectedSourceRaw = expectedVaultSourceRaw(callOptions, options);
      const maxPages = Math.max(1, Number(callOptions.messageLookupMaxPages ?? options.messageLookupMaxPages ?? CAPSULEHUB_MESSAGE_BODY_LOOKUP_MAX_PAGES));
      let historyScanIncomplete = false;
      let lastHistoryError = null;
      const takeValidParsed = async () => {
        const candidate = publishBodyCache.get(key);
        if (!candidate) return null;
        try {
          await assertParsedPublishMatchesEntry(kind, candidate, entry);
          return candidate;
        } catch (error) {
          publishBodyCache.delete(key);
          lastHistoryError = error;
          return null;
        }
      };
      for (const params of attempts) {
        const limit = Math.max(1, Number(params.limit ?? CAPSULEHUB_MESSAGE_BODY_LOOKUP_LIMIT));
        for (const historyTransport of historyTransports) {
          try {
            for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
              const pageParams = pagedMessageParams(params, pageIndex);
              const response = await historyTransport.getMessages(pageParams, {
                priority: callOptions.priority ?? 'messages',
                cacheTtlMs: callOptions.messageCacheTtlMs ?? options.messageCacheTtlMs,
              });
              const records = messageRecordsFromResponse(response);
              await cachePublishMessages(kind, records, expectedSourceRaw);
              parsed = await takeValidParsed();
              if (parsed) break;
              if (records.length < limit) break;
              if (pageIndex === maxPages - 1) historyScanIncomplete = true;
            }
          } catch (error) {
            lastHistoryError = error;
            historyScanIncomplete = true;
            if (params.body_hash !== undefined) continue;
            continue;
          }
          parsed = await takeValidParsed();
          if (parsed) break;
        }
        if (parsed) break;
      }
      if (!parsed) throw bodyHistoryUnavailable(kind, entry, { historyScanIncomplete, cause: lastHistoryError });
    }
    await assertParsedPublishMatchesEntry(kind, parsed, entry);
    if (kind === 'private') {
      return {
        ...entry,
        header_0_boc: entry.header_0_boc ?? parsed.header_0_boc,
        header_1_boc: entry.header_1_boc ?? parsed.header_1_boc,
        body_boc: parsed.body_boc,
        size_class: parsed.size_class,
        created_at: entry.created_at && entry.created_at !== 0n ? entry.created_at : (parsed.created_at ?? entry.created_at),
      };
    }
    return {
      ...entry,
      author_wallet: entry.author_wallet ?? parsed.author_wallet,
      header_boc: entry.header_boc ?? parsed.header_boc,
      body_boc: parsed.body_boc,
      size_class: parsed.size_class,
      created_at: entry.created_at && entry.created_at !== 0n ? entry.created_at : (parsed.created_at ?? entry.created_at),
    };
  }

  return {
    kind: options.kind ?? options.transport?.kind ?? 'ton-rpc',
    async getPrivateEntry(entryId, callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveCapsuleHubAddress(options.capsuleHubAddress, callOptions);
      return decodePrivateCapsuleEntryStack(await transport.runGetMethod({
        address,
        method: 'get_private_entry',
        stack: [stackNumber(entryId)],
        ...runGetCallOptions(callOptions),
      }));
    },
    async getPrivateSenderIndex(keyId, callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveCapsuleHubAddress(options.capsuleHubAddress, callOptions);
      return decodePrivateCapsuleKeyIndexStack(await transport.runGetMethod({
        address,
        method: 'get_private_sender_index',
        stack: [stackNumber(keyId)],
        ...runGetCallOptions(callOptions),
      }));
    },
    async getPrivateRecipientIndex(keyId, callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveCapsuleHubAddress(options.capsuleHubAddress, callOptions);
      return decodePrivateCapsuleKeyIndexStack(await transport.runGetMethod({
        address,
        method: 'get_private_recipient_index',
        stack: [stackNumber(keyId)],
        ...runGetCallOptions(callOptions),
      }));
    },
    async resolvePrivateEntryBody(entry, callOptions = {}) {
      return resolveEntryBody('private', entry, callOptions);
    },
    async getPublicEntry(entryId, callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveCapsuleHubAddress(options.capsuleHubAddress, callOptions);
      return decodePublicCapsuleEntryStack(await transport.runGetMethod({
        address,
        method: 'get_public_entry',
        stack: [stackNumber(entryId)],
        ...runGetCallOptions(callOptions),
      }));
    },
    async resolvePublicEntryBody(entry, callOptions = {}) {
      return resolveEntryBody('public', entry, callOptions);
    },
    async getPrivatePage(pageId, callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveCapsuleHubAddress(options.capsuleHubAddress, callOptions);
      return decodeCapsuleHubPageStack(await transport.runGetMethod({
        address,
        method: 'get_private_page',
        stack: [stackNumber(pageId)],
        ...runGetCallOptions(callOptions),
      }));
    },
    async getPublicPage(pageId, callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveCapsuleHubAddress(options.capsuleHubAddress, callOptions);
      return decodeCapsuleHubPageStack(await transport.runGetMethod({
        address,
        method: 'get_public_page',
        stack: [stackNumber(pageId)],
        ...runGetCallOptions(callOptions),
      }));
    },
    async getState(callOptions = {}) {
      const transport = resolveTransport(options);
      const address = resolveCapsuleHubAddress(options.capsuleHubAddress, callOptions);
      return decodeCapsuleHubStateStack(await transport.runGetMethod({
        address,
        method: 'get_state',
        stack: [],
        ...runGetCallOptions(callOptions),
      }));
    },
  };
}
