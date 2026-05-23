export const SINGLE_CAPSULE_USEFUL_BYTES = 1024;

const textEncoder = new TextEncoder();

export function utf8ByteLength(value) {
  return textEncoder.encode(String(value ?? '')).length;
}

export function truncateUtf8ToBytes(value, maxBytes = SINGLE_CAPSULE_USEFUL_BYTES) {
  const text = String(value ?? '');
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new Error('maxBytes must be a non-negative safe integer');
  }
  let output = '';
  let usedBytes = 0;
  for (const symbol of text) {
    const symbolBytes = utf8ByteLength(symbol);
    if (usedBytes + symbolBytes > maxBytes) break;
    output += symbol;
    usedBytes += symbolBytes;
  }
  return output;
}

export function messagePartCountForBytes(byteLength, partBytes = SINGLE_CAPSULE_USEFUL_BYTES) {
  if (!Number.isSafeInteger(partBytes) || partBytes <= 0) {
    throw new Error('partBytes must be a positive safe integer');
  }
  const length = Number(byteLength);
  if (!Number.isFinite(length) || length <= 0) return 1;
  return Math.max(1, Math.ceil(length / partBytes));
}

export function messagePartCount(text, partBytes = SINGLE_CAPSULE_USEFUL_BYTES) {
  return messagePartCountForBytes(utf8ByteLength(text), partBytes);
}

export function splitUtf8ToParts(value, partBytes = SINGLE_CAPSULE_USEFUL_BYTES) {
  const text = String(value ?? '');
  if (!Number.isSafeInteger(partBytes) || partBytes <= 0) {
    throw new Error('partBytes must be a positive safe integer');
  }
  if (text.length === 0) return [''];
  const parts = [];
  let current = '';
  let usedBytes = 0;
  for (const symbol of text) {
    const symbolBytes = utf8ByteLength(symbol);
    if (symbolBytes > partBytes) {
      throw new Error('single UTF-8 symbol exceeds part size');
    }
    if (usedBytes + symbolBytes > partBytes) {
      parts.push(current);
      current = '';
      usedBytes = 0;
    }
    current += symbol;
    usedBytes += symbolBytes;
  }
  if (current.length > 0 || parts.length === 0) parts.push(current);
  return parts;
}

export function splitBytesToParts(value, partBytes = SINGLE_CAPSULE_USEFUL_BYTES) {
  const bytes = value instanceof Uint8Array
    ? value
    : (value instanceof ArrayBuffer
        ? new Uint8Array(value)
        : (ArrayBuffer.isView(value)
            ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
            : new Uint8Array(value ?? [])));
  if (!Number.isSafeInteger(partBytes) || partBytes <= 0) {
    throw new Error('partBytes must be a positive safe integer');
  }
  if (bytes.length === 0) return [new Uint8Array()];
  const parts = [];
  for (let offset = 0; offset < bytes.length; offset += partBytes) {
    parts.push(bytes.slice(offset, Math.min(bytes.length, offset + partBytes)));
  }
  return parts;
}

function integerLikeToBigInt(value) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && /^[0-9]+$/.test(value)) return BigInt(value);
  if (value && typeof value.toString === 'function') {
    const text = value.toString();
    if (/^[0-9]+$/.test(text)) return BigInt(text);
  }
  return 0n;
}

export function hasMessageBudgetAllocation(source) {
  if (!source) return false;
  if (typeof source === 'bigint' || typeof source === 'number' || typeof source === 'string') {
    return integerLikeToBigInt(source) > 0n;
  }
  if (typeof source !== 'object') return false;
  const amount = source.message_budget_ton
    ?? source.messageBudgetTon
    ?? source.available_budget_ton
    ?? source.availableBudgetTon
    ?? source.availableNanotons
    ?? source.available;
  return integerLikeToBigInt(amount) > 0n;
}

export function singleCapsuleMessageFits(text, hasBudget = false) {
  return hasBudget || utf8ByteLength(text) <= SINGLE_CAPSULE_USEFUL_BYTES;
}
