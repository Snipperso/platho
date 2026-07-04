export const SINGLE_CAPSULE_USEFUL_BYTES = 1024;
export const CAPSULE_USEFUL_SIZE_BYTES = Object.freeze([1024, 2048, 4096, 8192, 16384, 32768]);
export const MAX_CAPSULE_USEFUL_BYTES = CAPSULE_USEFUL_SIZE_BYTES[CAPSULE_USEFUL_SIZE_BYTES.length - 1];

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

export function capsuleSizeClassForUsefulBytes(usefulBytes) {
  const value = Number(usefulBytes);
  if (!CAPSULE_USEFUL_SIZE_BYTES.includes(value)) {
    throw new Error('unsupported capsule useful byte size');
  }
  return value / SINGLE_CAPSULE_USEFUL_BYTES;
}

export function minimalCapsuleUsefulBytesForLength(byteLength) {
  const length = Number(byteLength);
  if (!Number.isFinite(length) || length <= 0) return SINGLE_CAPSULE_USEFUL_BYTES;
  for (const usefulBytes of CAPSULE_USEFUL_SIZE_BYTES) {
    if (length <= usefulBytes) return usefulBytes;
  }
  return MAX_CAPSULE_USEFUL_BYTES;
}

function capsulePart(bytes, usefulBytes) {
  return {
    bytes,
    usefulBytes,
    sizeClass: capsuleSizeClassForUsefulBytes(usefulBytes),
  };
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

function normalizePerPartOverheadBytes(options = {}) {
  const overhead = Number(options.perPartOverheadBytes ?? options.overheadBytes ?? 0);
  if (!Number.isSafeInteger(overhead) || overhead < 0) {
    throw new Error('perPartOverheadBytes must be a non-negative safe integer');
  }
  return overhead;
}

export function splitUtf8ToCapsuleParts(value, maxPartBytes = MAX_CAPSULE_USEFUL_BYTES, options = {}) {
  const text = String(value ?? '');
  const maxBytes = Math.min(Number(maxPartBytes) || MAX_CAPSULE_USEFUL_BYTES, MAX_CAPSULE_USEFUL_BYTES);
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error('maxPartBytes must be a positive safe integer');
  }
  const overheadBytes = normalizePerPartOverheadBytes(options);
  const maxContentBytes = maxBytes - overheadBytes;
  if (maxContentBytes <= 0) throw new Error('per-part overhead exceeds capsule size');
  if (text.length === 0) {
    const usefulBytes = minimalCapsuleUsefulBytesForLength(overheadBytes);
    return [{ text: '', bytes: new Uint8Array(), usefulBytes, sizeClass: capsuleSizeClassForUsefulBytes(usefulBytes) }];
  }
  const parts = [];
  let current = '';
  let usedBytes = 0;
  for (const symbol of text) {
    const symbolBytes = utf8ByteLength(symbol);
    if (symbolBytes > maxContentBytes) {
      throw new Error('single UTF-8 symbol exceeds capsule size');
    }
    if (usedBytes + symbolBytes > maxContentBytes) {
      const usefulBytes = minimalCapsuleUsefulBytesForLength(usedBytes + overheadBytes);
      parts.push({ text: current, bytes: textEncoder.encode(current), usefulBytes, sizeClass: capsuleSizeClassForUsefulBytes(usefulBytes) });
      current = '';
      usedBytes = 0;
    }
    current += symbol;
    usedBytes += symbolBytes;
  }
  if (current.length > 0 || parts.length === 0) {
    const usefulBytes = minimalCapsuleUsefulBytesForLength(usedBytes + overheadBytes);
    parts.push({ text: current, bytes: textEncoder.encode(current), usefulBytes, sizeClass: capsuleSizeClassForUsefulBytes(usefulBytes) });
  }
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

export function splitBytesToCapsuleParts(value, maxPartBytes = MAX_CAPSULE_USEFUL_BYTES, options = {}) {
  const bytes = value instanceof Uint8Array
    ? value
    : (value instanceof ArrayBuffer
        ? new Uint8Array(value)
        : (ArrayBuffer.isView(value)
            ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
            : new Uint8Array(value ?? [])));
  const maxBytes = Math.min(Number(maxPartBytes) || MAX_CAPSULE_USEFUL_BYTES, MAX_CAPSULE_USEFUL_BYTES);
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error('maxPartBytes must be a positive safe integer');
  }
  const overheadBytes = normalizePerPartOverheadBytes(options);
  const maxContentBytes = maxBytes - overheadBytes;
  if (maxContentBytes <= 0) throw new Error('per-part overhead exceeds capsule size');
  if (bytes.length === 0) {
    return [capsulePart(new Uint8Array(), minimalCapsuleUsefulBytesForLength(overheadBytes))];
  }
  const parts = [];
  for (let offset = 0; offset < bytes.length;) {
    const remaining = bytes.length - offset;
    const take = Math.min(maxContentBytes, remaining);
    const end = offset + take;
    const usefulBytes = minimalCapsuleUsefulBytesForLength(take + overheadBytes);
    parts.push(capsulePart(bytes.slice(offset, end), usefulBytes));
    offset = end;
  }
  return parts;
}

export function singleCapsuleMessageFits(text, walletFunded = false) {
  return walletFunded || utf8ByteLength(text) <= SINGLE_CAPSULE_USEFUL_BYTES;
}

// --- Reply-block content codec (document block type REPLY) ---
// A reply reference rides INSIDE the shared PDC1 document container as its own block, so it is symmetric across
// private messages and public posts/comments (both surfaces already ship PDC1 documents). The quote is
// DENORMALIZED (author label + snippet baked in at compose time, Telegram-style) so it renders standalone even
// when the referenced entry is evicted or not yet loaded; refEntryId (the chain-global CapsuleHub entry id, the
// same value on both sides of a private dialog) only powers scroll-to-original.
// Content layout: [version u8=1][refEntryId u64 BE][authorLen u8][author utf8<=64B][snippet utf8, rest<=160B]
export const REPLY_BLOCK_CONTENT_VERSION = 1;
export const REPLY_AUTHOR_MAX_BYTES = 64;
export const REPLY_SNIPPET_MAX_BYTES = 160;

export function encodeReplyBlockContent(reply) {
  const refEntryId = BigInt(reply?.refEntryId ?? -1n);
  if (refEntryId < 0n || refEntryId > 0xffffffffffffffffn) throw new Error('reply refEntryId must fit uint64');
  const author = textEncoder.encode(truncateUtf8ToBytes(reply?.author ?? '', REPLY_AUTHOR_MAX_BYTES));
  const snippet = textEncoder.encode(truncateUtf8ToBytes(reply?.snippet ?? '', REPLY_SNIPPET_MAX_BYTES));
  const out = new Uint8Array(1 + 8 + 1 + author.length + snippet.length);
  out[0] = REPLY_BLOCK_CONTENT_VERSION;
  let id = refEntryId;
  for (let i = 8; i >= 1; i -= 1) { out[i] = Number(id & 0xffn); id >>= 8n; }
  out[9] = author.length;
  out.set(author, 10);
  out.set(snippet, 10 + author.length);
  return out;
}

export function decodeReplyBlockContent(content) {
  const bytes = content instanceof Uint8Array ? content : new Uint8Array(content ?? []);
  // Unknown future versions and truncated frames return null (the renderer just drops the quote) — a reply
  // block must NEVER make the whole message undecodable.
  if (bytes.length < 10 || bytes[0] !== REPLY_BLOCK_CONTENT_VERSION) return null;
  let refEntryId = 0n;
  for (let i = 1; i <= 8; i += 1) refEntryId = (refEntryId << 8n) | BigInt(bytes[i]);
  const authorLength = bytes[9];
  if (10 + authorLength > bytes.length) return null;
  const decoder = new TextDecoder();
  return {
    refEntryId: refEntryId.toString(),
    author: decoder.decode(bytes.subarray(10, 10 + authorLength)),
    snippet: decoder.decode(bytes.subarray(10 + authorLength)),
  };
}

// --- File-block content codec (document block type FILE) ---
// An arbitrary attachment (name + mime + bytes) riding inside the shared PDC1 document container — symmetric
// across surfaces like REPLY above. Content layout:
//   [version u8=1][nameLen u16 BE][name utf8][mimeLen u8][mime utf8][bytes...]
// nameLen is u16 (a cyrillic filename hits 255 BYTES at ~127 chars); mime fits u8. The byte payload length is
// derived from the block frame length, exactly like the IMAGE block derives its pixels.
export const FILE_BLOCK_CONTENT_VERSION = 1;
export const FILE_NAME_MAX_BYTES = 512;
export const FILE_MIME_MAX_BYTES = 128;

export function encodeFileBlockContent(file) {
  const name = textEncoder.encode(truncateUtf8ToBytes(file?.name ?? 'file', FILE_NAME_MAX_BYTES));
  const mime = textEncoder.encode(truncateUtf8ToBytes(file?.mime ?? 'application/octet-stream', FILE_MIME_MAX_BYTES));
  const bytes = file?.bytes instanceof Uint8Array ? file.bytes : new Uint8Array(file?.bytes ?? []);
  if (name.length === 0) throw new Error('file block needs a name');
  if (bytes.length === 0) throw new Error('file block needs bytes');
  const out = new Uint8Array(1 + 2 + name.length + 1 + mime.length + bytes.length);
  out[0] = FILE_BLOCK_CONTENT_VERSION;
  out[1] = (name.length >> 8) & 0xff;
  out[2] = name.length & 0xff;
  out.set(name, 3);
  out[3 + name.length] = mime.length;
  out.set(mime, 4 + name.length);
  out.set(bytes, 4 + name.length + mime.length);
  return out;
}

export function decodeFileBlockContent(content) {
  const bytes = content instanceof Uint8Array ? content : new Uint8Array(content ?? []);
  // Unknown future versions / truncated frames return null — a bad file block must never make the carrying
  // message undecodable (the REPLY rule).
  if (bytes.length < 5 || bytes[0] !== FILE_BLOCK_CONTENT_VERSION) return null;
  const nameLength = (bytes[1] << 8) | bytes[2];
  if (nameLength === 0 || 3 + nameLength + 1 > bytes.length) return null;
  const mimeLength = bytes[3 + nameLength];
  const payloadStart = 4 + nameLength + mimeLength;
  if (payloadStart > bytes.length) return null;
  const decoder = new TextDecoder();
  return {
    name: decoder.decode(bytes.subarray(3, 3 + nameLength)),
    mime: decoder.decode(bytes.subarray(4 + nameLength, 4 + nameLength + mimeLength)) || 'application/octet-stream',
    bytes: bytes.slice(payloadStart),
  };
}

// --- Channel-profile content codec (document block type PROFILE) ---
// A channel's public self-description (free-text + user-invented tags) riding inside the shared PDC1 document
// container, published as a normal public top-level POST (parent_link==0) so it lands on the author's on-chain
// public_author_index and ANY client can read it by walking that one author's chain — unlike PREFS, which is
// encrypted to the owner and readable only by them. Latest profile post per author wins. Content layout:
//   [version u8=1][descLen u16 BE][desc utf8][tagCount u8][ tagLen u8 | tag utf8 ]*
// descLen is u16 (a cyrillic description hits 512 BYTES well before 512 chars); each tag length fits u8. Tags are
// expected pre-normalized by the composer (lowercase/trim/dedupe), but encode defends the wire bounds anyway.
export const PROFILE_BLOCK_CONTENT_VERSION = 1;
export const PROFILE_DESCRIPTION_MAX_BYTES = 512;
export const PROFILE_TAG_MAX_BYTES = 32;
export const PROFILE_MAX_TAGS = 12;

export function normalizeProfileTags(tags) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(tags) ? tags : []) {
    const tag = truncateUtf8ToBytes(String(raw ?? '').trim().toLowerCase(), PROFILE_TAG_MAX_BYTES).trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= PROFILE_MAX_TAGS) break;
  }
  return out;
}

export function encodeProfileBlockContent(profile) {
  const description = textEncoder.encode(truncateUtf8ToBytes(profile?.description ?? '', PROFILE_DESCRIPTION_MAX_BYTES));
  const tags = normalizeProfileTags(profile?.tags).map((tag) => textEncoder.encode(tag));
  let total = 1 + 2 + description.length + 1;
  for (const tag of tags) total += 1 + tag.length;
  const out = new Uint8Array(total);
  out[0] = PROFILE_BLOCK_CONTENT_VERSION;
  out[1] = (description.length >> 8) & 0xff;
  out[2] = description.length & 0xff;
  out.set(description, 3);
  let offset = 3 + description.length;
  out[offset] = tags.length;
  offset += 1;
  for (const tag of tags) {
    out[offset] = tag.length;
    offset += 1;
    out.set(tag, offset);
    offset += tag.length;
  }
  return out;
}

export function decodeProfileBlockContent(content) {
  const bytes = content instanceof Uint8Array ? content : new Uint8Array(content ?? []);
  // Unknown future versions / truncated frames return null — a bad profile block must never make the carrying
  // post undecodable (the REPLY/FILE rule).
  if (bytes.length < 4 || bytes[0] !== PROFILE_BLOCK_CONTENT_VERSION) return null;
  const descLength = (bytes[1] << 8) | bytes[2];
  if (3 + descLength + 1 > bytes.length) return null;
  const decoder = new TextDecoder();
  const description = decoder.decode(bytes.subarray(3, 3 + descLength));
  let offset = 3 + descLength;
  const tagCount = bytes[offset];
  offset += 1;
  const tags = [];
  for (let index = 0; index < tagCount; index += 1) {
    if (offset + 1 > bytes.length) return null;
    const tagLength = bytes[offset];
    offset += 1;
    if (offset + tagLength > bytes.length) return null;
    tags.push(decoder.decode(bytes.subarray(offset, offset + tagLength)));
    offset += tagLength;
  }
  return { description, tags };
}
