import { parseTonAddress } from './crypto/platho-crypto.mjs?v=31';
import { decodeTonAddressSliceBoc, encodeTonAddressSliceBoc } from './ton-rpc-transport.mjs?v=111';
import { beginCell, parseBocBase64 } from './pwa-contract-transactions.mjs?v=59';

export const JETTON_TRANSFER_OPCODE = 0x0F8A7EA5n;
export const NFT_TRANSFER_OPCODE = 0x5FCC3D14n;
export const JETTON_TRANSFER_VALUE_NANOTONS = 50_000_000n;
export const NFT_TRANSFER_VALUE_NANOTONS = 50_000_000n;
export const TRANSFER_NOTIFY_NANOTONS = 1n;
export const TRANSFER_COMMENT_MAX_BYTES = 120;
export const BURN_ADDRESS = '0:0000000000000000000000000000000000000000000000000000000000000000';
export const BURN_VALUE_NANOTONS = 50_000_000n;

export function parseUnits(input, decimals = 9) {
  const places = Number.isInteger(Number(decimals)) ? Math.max(0, Math.min(36, Number(decimals))) : 9;
  const text = String(input ?? '').trim().replace(/\s+/g, '').replace(',', '.');
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(text)) throw Object.assign(new Error('not an amount'), { code: 'AMOUNT_INVALID' });
  const [whole = '0', fraction = ''] = text.split('.');
  if (fraction.length > places) throw Object.assign(new Error(`at most ${places} decimal places`), { code: 'AMOUNT_TOO_PRECISE', places });
  const units = BigInt(whole || '0') * 10n ** BigInt(places) + BigInt((fraction || '').padEnd(places, '0') || '0');
  if (units <= 0n) throw Object.assign(new Error('the amount must be above zero'), { code: 'AMOUNT_ZERO' });
  return units;
}

export function buildTextCommentBody(comment) {
  const text = String(comment ?? '');
  if (!text) return null;
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > TRANSFER_COMMENT_MAX_BYTES) throw Object.assign(new Error('the comment is too long'), { code: 'COMMENT_TOO_LONG' });
  return beginCell().uint(0n, 32, 'text_comment').bytesValue(bytes, bytes.length, 'comment').endCell();
}
function withForwardPayload(builder, comment, payload = null) {
  const cell = payload ?? buildTextCommentBody(comment);
  return cell ? builder.uint(1n, 1, 'forward_payload.ref').ref(cell, 'forward_payload') : builder.uint(0n, 1, 'forward_payload.inline');
}
function basechain(address, name) {
  const parsed = parseTonAddress(address);
  if (parsed.workchain !== 0) throw Object.assign(new Error(`${name} must be a basechain address`), { code: 'NOT_BASECHAIN' });
  return parsed.raw;
}
function queryOf(queryId) {
  const query = BigInt(queryId ?? 0n);
  if (query < 0n) throw new Error('query_id must not be negative');
  return query;
}

export function buildJettonTransferBody({ queryId, amount, destination, responseDestination, forwardTonAmount = TRANSFER_NOTIFY_NANOTONS, comment = '', forwardPayload = null }) {
  const units = BigInt(amount ?? 0n);
  if (units <= 0n) throw new Error('jetton transfer: the amount must be above zero');
  const builder = beginCell()
    .uint(JETTON_TRANSFER_OPCODE, 32, 'op')
    .uint(queryOf(queryId), 64, 'query_id')
    .coins(units, 'amount')
    .address(basechain(destination, 'the recipient'), 'destination')
    .address(basechain(responseDestination, 'the response destination'), 'response_destination')
    .customPayloadMaybe(null)
    .coins(BigInt(forwardTonAmount), 'forward_ton_amount');
  if (forwardPayload && comment) throw new Error('jetton transfer: a payload or a comment, not both');
  return withForwardPayload(builder, comment, forwardPayload).endCell();
}

export function buildNftTransferBody({ queryId, newOwner, responseDestination, forwardAmount = TRANSFER_NOTIFY_NANOTONS, comment = '' }) {
  const builder = beginCell()
    .uint(NFT_TRANSFER_OPCODE, 32, 'op')
    .uint(queryOf(queryId), 64, 'query_id')
    .address(basechain(newOwner, 'the recipient'), 'new_owner')
    .address(basechain(responseDestination, 'the response destination'), 'response_destination')
    .uint(0n, 1, 'custom_payload.none')
    .coins(BigInt(forwardAmount), 'forward_amount');
  return withForwardPayload(builder, comment).endCell();
}

export function nextTransferQueryId(now = Date.now()) {
  const raw = typeof now === 'bigint' ? now : BigInt(Math.floor(Number(now) || 0));
  return raw > 0n ? raw : 1n;
}

export function getMethodStack(result) {
  const stack = result?.stack ?? result?.result?.stack;
  if (!Array.isArray(stack)) throw new Error('the get-method answered no stack');
  return stack;
}
export function stackAddress(item, name) {
  const value = Array.isArray(item) ? item[1] : item?.value ?? item?.boc ?? item?.cell;
  if (typeof item?.address === 'string') return parseTonAddress(item.address).raw;
  if (typeof value === 'string' && /^-?\d+:[0-9a-fA-F]{64}$/.test(value)) return parseTonAddress(value).raw;
  if (typeof value === 'string') return parseTonAddress(decodeTonAddressSliceBoc(value)).raw;
  throw new Error(`${name} is not an address`);
}
export function stackInteger(item, name) {
  const value = Array.isArray(item) ? item[1] : item?.value ?? item?.num ?? item;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === 'string') {
    const text = value.trim();
    if (/^-0x[0-9a-fA-F]+$/.test(text)) return -BigInt(text.slice(1));
    if (/^0x[0-9a-fA-F]+$/.test(text) || /^-?\d+$/.test(text)) return BigInt(text);
  }
  throw new Error(`${name} is not an integer`);
}
const same = (a, b) => {
  try { return parseTonAddress(a).raw === parseTonAddress(b).raw; } catch { return false; }
};

export async function readJettonWalletAddress({ transport, master, owner, expected = '', callOptions = {} }) {
  if (!transport?.runGetMethod) throw new Error('jetton wallet: no transport');
  const result = await transport.runGetMethod({
    address: parseTonAddress(master).raw,
    method: 'get_wallet_address',
    stack: [{ type: 'slice', value: encodeTonAddressSliceBoc(parseTonAddress(owner).raw) }],
    cacheTtlMs: 0,
    ...callOptions,
  });
  const named = stackAddress(getMethodStack(result)[0], 'the jetton wallet');
  if (expected && !same(named, expected)) {
    throw Object.assign(new Error(`the master named ${named}, the index ${expected}`), { code: 'JETTON_WALLET_DISAGREES' });
  }
  return named;
}

export async function readNftHolder({ transport, item, callOptions = {} }) {
  if (!transport?.runGetMethod) throw new Error('nft holder: no transport');
  const result = await transport.runGetMethod({ address: parseTonAddress(item).raw, method: 'get_nft_data', stack: [], cacheTtlMs: 0, ...callOptions });
  const stack = getMethodStack(result);
  if (stack.length < 5) throw new Error('get_nft_data did not return five values');
  return { owner: stackAddress(stack[3], 'the owner'), collection: addrNoneSlice(stack[2]) ? null : stackAddress(stack[2], 'the collection') };
}
function addrNoneSlice(item) {
  const value = Array.isArray(item) ? item[1] : item?.value ?? item?.boc ?? item?.cell;
  if (typeof item?.address === 'string' || typeof value !== 'string' || /^-?\d+:/.test(value)) return false;
  try {
    const cell = parseBocBase64(value);
    return cell.bitLength === 2 && (cell.data[0] & 0xc0) === 0 && cell.refs.length === 0;
  } catch { return false; }
}
export async function readNftOwner({ transport, item, callOptions = {} }) {
  if (!transport?.runGetMethod) throw new Error('nft owner: no transport');
  const result = await transport.runGetMethod({ address: parseTonAddress(item).raw, method: 'get_nft_data', stack: [], cacheTtlMs: 0, ...callOptions });
  const stack = getMethodStack(result);
  if (stack.length < 5) throw new Error('get_nft_data did not return five values');
  return stackAddress(stack[3], 'the owner');
}
