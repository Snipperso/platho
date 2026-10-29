export const SINGLE_CAPSULE_USEFUL_BYTES = 1024;

export const MAX_MESSAGE_PARTS = 8;
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

export const REPLY_BLOCK_CONTENT_VERSION = 1;
export const REPLY_BLOCK_CONTENT_VERSION_TEXT_ID = 2;
export const REPLY_AUTHOR_MAX_BYTES = 64;
export const REPLY_SNIPPET_MAX_BYTES = 160;
export const REPLY_ENTRY_ID_MAX_BYTES = 80;
const REPLY_TEXT_ENTRY_ID = /^[0-9A-Za-z][0-9A-Za-z._:-]{0,79}$/;

export function encodeReplyBlockContent(reply) {
  const idText = String(reply?.refEntryId ?? '').trim();
  const author = textEncoder.encode(truncateUtf8ToBytes(reply?.author ?? '', REPLY_AUTHOR_MAX_BYTES));
  const snippet = textEncoder.encode(truncateUtf8ToBytes(reply?.snippet ?? '', REPLY_SNIPPET_MAX_BYTES));
  if (/^\d+$/.test(idText)) {
    const refEntryId = BigInt(idText);
    if (refEntryId > 0xffffffffffffffffn) throw new Error('reply refEntryId must fit uint64');
    const out = new Uint8Array(1 + 8 + 1 + author.length + snippet.length);
    out[0] = REPLY_BLOCK_CONTENT_VERSION;
    let id = refEntryId;
    for (let i = 8; i >= 1; i -= 1) { out[i] = Number(id & 0xffn); id >>= 8n; }
    out[9] = author.length;
    out.set(author, 10);
    out.set(snippet, 10 + author.length);
    return out;
  }
  if (!REPLY_TEXT_ENTRY_ID.test(idText)) throw new Error('reply refEntryId is not an entry id');
  const id = textEncoder.encode(idText);
  const out = new Uint8Array(1 + 1 + id.length + 1 + author.length + snippet.length);
  out[0] = REPLY_BLOCK_CONTENT_VERSION_TEXT_ID;
  out[1] = id.length;
  out.set(id, 2);
  out[2 + id.length] = author.length;
  out.set(author, 3 + id.length);
  out.set(snippet, 3 + id.length + author.length);
  return out;
}

export function decodeReplyBlockContent(content) {
  const bytes = content instanceof Uint8Array ? content : new Uint8Array(content ?? []);
  const decoder = new TextDecoder();
  const quote = (refEntryId, authorStart, authorLength) => ({
    refEntryId,
    author: truncateUtf8ToBytes(decoder.decode(bytes.subarray(authorStart, authorStart + authorLength)), REPLY_AUTHOR_MAX_BYTES),
    snippet: truncateUtf8ToBytes(decoder.decode(bytes.subarray(authorStart + authorLength)), REPLY_SNIPPET_MAX_BYTES),
  });
  if (bytes[0] === REPLY_BLOCK_CONTENT_VERSION) {
    if (bytes.length < 10) return null;
    let refEntryId = 0n;
    for (let i = 1; i <= 8; i += 1) refEntryId = (refEntryId << 8n) | BigInt(bytes[i]);
    const authorLength = bytes[9];
    if (10 + authorLength > bytes.length) return null;
    return quote(refEntryId.toString(), 10, authorLength);
  }
  if (bytes[0] === REPLY_BLOCK_CONTENT_VERSION_TEXT_ID) {
    const idLength = bytes[1] ?? 0;
    if (idLength === 0 || idLength > REPLY_ENTRY_ID_MAX_BYTES || 2 + idLength + 1 > bytes.length) return null;
    const refEntryId = decoder.decode(bytes.subarray(2, 2 + idLength));
    if (!REPLY_TEXT_ENTRY_ID.test(refEntryId)) return null;
    const authorLength = bytes[2 + idLength];
    if (3 + idLength + authorLength > bytes.length) return null;
    return quote(refEntryId, 3 + idLength, authorLength);
  }
  return null;
}

export const FILE_BLOCK_CONTENT_VERSION = 1;
export const FILE_NAME_MAX_BYTES = 512;
export const FILE_MIME_MAX_BYTES = 128;
export function mediaTypeIn(value) {
  const text = String(value ?? '').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9!#$&^_.+-]{0,63}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,63}$/.test(text) ? text : 'application/octet-stream';
}

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
  if (bytes.length < 5 || bytes[0] !== FILE_BLOCK_CONTENT_VERSION) return null;
  const nameLength = (bytes[1] << 8) | bytes[2];
  if (nameLength === 0 || 3 + nameLength + 1 > bytes.length) return null;
  const mimeLength = bytes[3 + nameLength];
  const payloadStart = 4 + nameLength + mimeLength;
  if (payloadStart > bytes.length) return null;
  const decoder = new TextDecoder();
  return {
    name: decoder.decode(bytes.subarray(3, 3 + nameLength)),
    mime: mediaTypeIn(decoder.decode(bytes.subarray(4 + nameLength, 4 + nameLength + mimeLength))),
    bytes: bytes.slice(payloadStart),
  };
}

export const PROFILE_BLOCK_CONTENT_VERSION = 1;
export const PROFILE_DESCRIPTION_MAX_BYTES = 1536;
export const PROFILE_TAG_MAX_BYTES = 64;
export const PROFILE_MAX_TAGS = 12;
export const PROFILE_USERNAME_MAX_BYTES = 20;

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

export const PROFILE_GROUPS_MAX = 8;
export const PROFILE_GROUP_NAME_MAX_BYTES = 96;

export const PROFILE_FLAGS_MARKER = 0xf1;
export const PROFILE_FLAG_BALANCE_CARD = 0x01;

function profileGroupKeyHex(value) {
  const hex = String(value ?? '').trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(hex) && !/^0{64}$/.test(hex) ? hex : null;
}

export function normalizeProfileGroups(value) {
  const out = [];
  for (const entry of Array.isArray(value) ? value : []) {
    const groupId = String(entry?.groupId ?? '').trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(groupId)) continue;
    if (out.some((held) => held.groupId === groupId)) continue;
    const name = truncateUtf8ToBytes(String(entry?.name ?? '').trim(), PROFILE_GROUP_NAME_MAX_BYTES);
    const founder = profileGroupKeyHex(entry?.founder);
    const owner = profileGroupKeyHex(entry?.owner);
    out.push({ groupId, name, ...(founder ? { founder } : {}), ...(owner ? { owner } : {}) });
    if (out.length >= PROFILE_GROUPS_MAX) break;
  }
  return out;
}

export function encodeProfileBlockContent(profile) {
  const description = textEncoder.encode(truncateUtf8ToBytes(profile?.description ?? '', PROFILE_DESCRIPTION_MAX_BYTES));
  const tags = normalizeProfileTags(profile?.tags).map((tag) => textEncoder.encode(tag));
  const ownerUsername = textEncoder.encode(truncateUtf8ToBytes(String(profile?.ownerUsername ?? '').trim(), PROFILE_USERNAME_MAX_BYTES));
  const appearance = encodeProfileAppearance(profile?.appearance);
  const wornGift = textEncoder.encode(normalizeProfileWornGift(profile?.wornGift) ?? '');
  const groups = normalizeProfileGroups(profile?.groups);
  const groupNames = groups.map((group) => textEncoder.encode(group.name));
  const groupsBytes = groups.length > 0
    ? 1 + groups.reduce((sum, _group, index) => sum + 32 + 1 + groupNames[index].length, 0)
    : 0;
  const anyFounder = groups.some((group) => group.founder || group.owner);
  const foundersBytes = groupsBytes > 0 && anyFounder ? 1 + groups.length * 64 : 0;
  const flags = profile?.balanceCard === true ? PROFILE_FLAG_BALANCE_CARD : 0;
  const flagsBytes = flags ? 3 : 0;
  let total = 1 + 2 + description.length + 1;
  for (const tag of tags) total += 1 + tag.length;
  total += 1 + ownerUsername.length;
  if (appearance) total += 1 + appearance.length;
  else if (wornGift.length > 0 || groupsBytes > 0 || flagsBytes > 0) total += 1;
  if (wornGift.length > 0) total += 1 + wornGift.length;
  else if (groupsBytes > 0 || flagsBytes > 0) total += 1;
  total += groupsBytes + foundersBytes;
  if (flagsBytes > 0 && groupsBytes === 0) total += 1;
  total += flagsBytes;
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
  out[offset] = ownerUsername.length;
  offset += 1;
  out.set(ownerUsername, offset);
  offset += ownerUsername.length;
  if (appearance) {
    out[offset] = appearance.length;
    offset += 1;
    out.set(appearance, offset);
    offset += appearance.length;
  } else if (wornGift.length > 0 || groupsBytes > 0 || flagsBytes > 0) {
    out[offset] = 0;
    offset += 1;
  }
  if (wornGift.length > 0) {
    out[offset] = wornGift.length;
    offset += 1;
    out.set(wornGift, offset);
    offset += wornGift.length;
  } else if (groupsBytes > 0 || flagsBytes > 0) {
    out[offset] = 0;
    offset += 1;
  }
  if (groupsBytes > 0) {
    out[offset] = groups.length;
    offset += 1;
    for (let index = 0; index < groups.length; index += 1) {
      for (let byte = 0; byte < 32; byte += 1) {
        out[offset + byte] = parseInt(groups[index].groupId.slice(byte * 2, byte * 2 + 2), 16);
      }
      offset += 32;
      out[offset] = groupNames[index].length;
      offset += 1;
      out.set(groupNames[index], offset);
      offset += groupNames[index].length;
    }
  } else if (flagsBytes > 0) {
    out[offset] = 0;
    offset += 1;
  }
  if (foundersBytes > 0) {
    out[offset] = groups.length;
    offset += 1;
    for (const group of groups) {
      for (const key of [group.founder ?? null, group.owner ?? null]) {
        for (let byte = 0; byte < 32; byte += 1) out[offset + byte] = key ? parseInt(key.slice(byte * 2, byte * 2 + 2), 16) : 0;
        offset += 32;
      }
    }
  }
  if (flagsBytes > 0) {
    out[offset] = PROFILE_FLAGS_MARKER;
    out[offset + 1] = 1;
    out[offset + 2] = flags;
    offset += 3;
  }
  return out;
}

export function normalizeProfileWornGift(value) {
  const address = String(value ?? '').trim().toLowerCase();
  return RAW_ADDRESS_RE.test(address) ? address : null;
}

export const PROFILE_APPEARANCE_KIND_TELEGRAM_GIFT = 1;
export const PROFILE_APPEARANCE_KIND_LOOK = 2;
export const PROFILE_LOOK_THEMES = Object.freeze(['dark', 'light']);
export const PROFILE_LOOK_BACKGROUNDS = Object.freeze(['none', 'plasma', 'nodes']);
export const PROFILE_LOOK_SETTING_RANGES = Object.freeze({
  none: Object.freeze([]),
  plasma: Object.freeze([[0, 100, 30], [1, 16, 5], [25, 600, 175], [0, 200, 50]]),
  nodes: Object.freeze([[0, 300, 100], [0, 300, 100], [25, 300, 100], [0, 300, 100]]),
});
const RAW_ADDRESS_RE = /^-?\d{1,3}:[0-9a-f]{64}$/i;

function normalizeLookSettings(background, values) {
  const ranges = PROFILE_LOOK_SETTING_RANGES[background] ?? [];
  return ranges.map(([min, max, fallback], index) => {
    const raw = Number(Array.isArray(values) ? values[index] : undefined);
    return Number.isFinite(raw) ? Math.max(min, Math.min(max, Math.round(raw))) : fallback;
  });
}

export function normalizeProfileAppearance(value) {
  if (!value || typeof value !== 'object') return null;
  if (value.kind === 'telegram-gift') {
    const itemAddress = String(value.itemAddress ?? '').trim().toLowerCase();
    return RAW_ADDRESS_RE.test(itemAddress) ? { kind: 'telegram-gift', itemAddress } : null;
  }
  if (value.kind !== 'look') return null;
  const theme = PROFILE_LOOK_THEMES.includes(value.theme) ? value.theme : 'dark';
  const background = PROFILE_LOOK_BACKGROUNDS.includes(value.background) ? value.background : null;
  const settings = background ? normalizeLookSettings(background, value.settings) : [];
  const address = String(value.itemAddress ?? '').trim().toLowerCase();
  const itemAddress = RAW_ADDRESS_RE.test(address) ? address : null;
  return { kind: 'look', theme, background, settings, itemAddress };
}

function encodeProfileAppearance(value) {
  const appearance = normalizeProfileAppearance(value);
  if (!appearance) return null;
  if (appearance.kind === 'telegram-gift') {
    const address = textEncoder.encode(appearance.itemAddress);
    const out = new Uint8Array(1 + address.length);
    out[0] = PROFILE_APPEARANCE_KIND_TELEGRAM_GIFT;
    out.set(address, 1);
    return out;
  }
  const gift = appearance.itemAddress ? textEncoder.encode(appearance.itemAddress) : new Uint8Array(0);
  const settings = appearance.settings;
  const out = new Uint8Array(1 + 1 + 1 + 1 + settings.length * 2 + 1 + gift.length);
  out[0] = PROFILE_APPEARANCE_KIND_LOOK;
  out[1] = PROFILE_LOOK_THEMES.indexOf(appearance.theme);
  out[2] = appearance.background ? PROFILE_LOOK_BACKGROUNDS.indexOf(appearance.background) : 0;
  out[3] = settings.length;
  let offset = 4;
  for (const setting of settings) {
    out[offset] = (setting >> 8) & 0xff;
    out[offset + 1] = setting & 0xff;
    offset += 2;
  }
  out[offset] = gift.length;
  offset += 1;
  out.set(gift, offset);
  return out;
}

export function decodeProfileLook(bytes) {
  if (bytes.length < 4) return null;
  const theme = PROFILE_LOOK_THEMES[bytes[0]] ?? 'dark';
  const backgroundIndex = bytes[1];
  const count = bytes[2];
  let offset = 3;
  if (offset + count * 2 + 1 > bytes.length) return null;
  const settings = [];
  for (let index = 0; index < count; index += 1) {
    settings.push((bytes[offset] << 8) | bytes[offset + 1]);
    offset += 2;
  }
  const giftLength = bytes[offset];
  offset += 1;
  if (offset + giftLength > bytes.length) return null;
  const itemAddress = giftLength > 0 ? new TextDecoder().decode(bytes.subarray(offset, offset + giftLength)) : null;
  return normalizeProfileAppearance({
    kind: 'look',
    theme,
    background: PROFILE_LOOK_BACKGROUNDS[backgroundIndex] ?? 'unknown',
    settings,
    itemAddress,
  });
}

export function decodeProfileBlockContent(content) {
  const bytes = content instanceof Uint8Array ? content : new Uint8Array(content ?? []);
  if (bytes.length < 4 || bytes[0] !== PROFILE_BLOCK_CONTENT_VERSION) return null;
  const descLength = (bytes[1] << 8) | bytes[2];
  if (3 + descLength + 1 > bytes.length) return null;
  const decoder = new TextDecoder();
  const description = truncateUtf8ToBytes(decoder.decode(bytes.subarray(3, 3 + descLength)), PROFILE_DESCRIPTION_MAX_BYTES);
  let offset = 3 + descLength;
  const tagCount = bytes[offset];
  offset += 1;
  const rawTags = [];
  for (let index = 0; index < tagCount; index += 1) {
    if (offset + 1 > bytes.length) return null;
    const tagLength = bytes[offset];
    offset += 1;
    if (offset + tagLength > bytes.length) return null;
    rawTags.push(decoder.decode(bytes.subarray(offset, offset + tagLength)));
    offset += tagLength;
  }
  const tags = normalizeProfileTags(rawTags);
  let ownerUsername = '';
  if (offset < bytes.length) {
    const usernameLength = bytes[offset];
    offset += 1;
    if (usernameLength > 0 && offset + usernameLength <= bytes.length) {
      ownerUsername = decoder.decode(bytes.subarray(offset, offset + usernameLength));
      offset += usernameLength;
    }
  }
  let appearance = null;
  if (offset < bytes.length) {
    const appearanceLength = bytes[offset];
    offset += 1;
    if (appearanceLength > 1 && offset + appearanceLength <= bytes.length) {
      if (bytes[offset] === PROFILE_APPEARANCE_KIND_TELEGRAM_GIFT) {
        appearance = normalizeProfileAppearance({
          kind: 'telegram-gift',
          itemAddress: decoder.decode(bytes.subarray(offset + 1, offset + appearanceLength)),
        });
      } else if (bytes[offset] === PROFILE_APPEARANCE_KIND_LOOK) {
        appearance = decodeProfileLook(bytes.subarray(offset + 1, offset + appearanceLength));
      }
      offset += appearanceLength;
    }
  }
  let wornGift = null;
  if (offset < bytes.length) {
    const wornGiftLength = bytes[offset];
    offset += 1;
    if (wornGiftLength > 0 && offset + wornGiftLength <= bytes.length) {
      wornGift = normalizeProfileWornGift(decoder.decode(bytes.subarray(offset, offset + wornGiftLength)));
      offset += wornGiftLength;
    }
  }
  const groups = [];
  if (offset < bytes.length) {
    const count = bytes[offset];
    offset += 1;
    for (let index = 0; index < count && index < PROFILE_GROUPS_MAX; index += 1) {
      if (offset + 33 > bytes.length) break;
      let groupId = '';
      for (let byte = 0; byte < 32; byte += 1) groupId += bytes[offset + byte].toString(16).padStart(2, '0');
      offset += 32;
      const nameLength = bytes[offset];
      offset += 1;
      if (offset + nameLength > bytes.length) break;
      groups.push({ groupId, name: decoder.decode(bytes.subarray(offset, offset + nameLength)) });
      offset += nameLength;
    }
  }
  if (offset < bytes.length && bytes[offset] === groups.length && offset + 1 + groups.length * 64 <= bytes.length) {
    offset += 1;
    for (const group of groups) {
      const pair = [];
      for (let k = 0; k < 2; k += 1) {
        let hex = '';
        let zero = true;
        for (let byte = 0; byte < 32; byte += 1) {
          const value = bytes[offset + byte];
          if (value !== 0) zero = false;
          hex += value.toString(16).padStart(2, '0');
        }
        offset += 32;
        pair.push(zero ? null : hex);
      }
      if (pair[0]) group.founder = pair[0];
      if (pair[1]) group.owner = pair[1];
    }
  }
  let balanceCard = false;
  if (offset + 3 <= bytes.length && bytes[offset] === PROFILE_FLAGS_MARKER) {
    const length = bytes[offset + 1];
    if (length >= 1 && offset + 2 + length <= bytes.length) balanceCard = (bytes[offset + 2] & PROFILE_FLAG_BALANCE_CARD) !== 0;
  }
  return { description, tags, ownerUsername, appearance, wornGift, groups, balanceCard };
}

export const SHARE_BLOCK_CONTENT_VERSION = 2;
export const SHARE_ENTRY_ID_MAX_BYTES = 64;
export const SHARE_AUTHOR_MAX_BYTES = 64;
export const SHARE_TITLE_MAX_BYTES = 96;
export const SHARE_WALLET_MAX_BYTES = 80;
export const SHARE_SNIPPET_MAX_BYTES = 4096;
export const SHARE_FLAG_HAS_IMAGE = 0x01;
export const SHARE_FLAG_TEXT_TRUNCATED = 0x02;

export function encodeShareBlockContent(share) {
  const entryIdText = String(share?.entryId ?? '').trim();
  if (!entryIdText) throw new Error('share block needs the entry id');
  const entryId = textEncoder.encode(truncateUtf8ToBytes(entryIdText, SHARE_ENTRY_ID_MAX_BYTES));
  if (entryId.length !== textEncoder.encode(entryIdText).length) throw new Error('share entryId is too long');
  const bodyHashHex = String(share?.bodyHash ?? '').replace(/^0x/i, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(bodyHashHex)) throw new Error('share bodyHash must be 32 hex bytes');
  const wallet = textEncoder.encode(truncateUtf8ToBytes(String(share?.authorWallet ?? '').trim(), SHARE_WALLET_MAX_BYTES));
  if (wallet.length === 0) throw new Error('share block needs the author wallet');
  const author = textEncoder.encode(truncateUtf8ToBytes(share?.author ?? '', SHARE_AUTHOR_MAX_BYTES));
  const title = textEncoder.encode(truncateUtf8ToBytes(share?.title ?? '', SHARE_TITLE_MAX_BYTES));
  const fullSnippet = String(share?.snippet ?? '');
  const snippetText = truncateUtf8ToBytes(fullSnippet, SHARE_SNIPPET_MAX_BYTES);
  const snippet = textEncoder.encode(snippetText);
  const flags = (share?.hasImage ? SHARE_FLAG_HAS_IMAGE : 0)
    | (share?.textTruncated || snippetText.length < fullSnippet.length ? SHARE_FLAG_TEXT_TRUNCATED : 0);
  const out = new Uint8Array(2 + 1 + entryId.length + 32 + 1 + wallet.length + 1 + author.length + 1 + title.length + snippet.length);
  out[0] = SHARE_BLOCK_CONTENT_VERSION;
  out[1] = flags;
  out[2] = entryId.length;
  out.set(entryId, 3);
  let offset = 3 + entryId.length;
  for (let i = 0; i < 32; i += 1) out[offset + i] = parseInt(bodyHashHex.slice(i * 2, i * 2 + 2), 16);
  offset += 32;
  out[offset] = wallet.length;
  out.set(wallet, offset + 1);
  offset += 1 + wallet.length;
  out[offset] = author.length;
  out.set(author, offset + 1);
  offset += 1 + author.length;
  out[offset] = title.length;
  out.set(title, offset + 1);
  offset += 1 + title.length;
  out.set(snippet, offset);
  return out;
}

export function decodeShareBlockContent(content) {
  const bytes = content instanceof Uint8Array ? content : new Uint8Array(content ?? []);
  if (bytes.length < 45 || bytes[0] !== SHARE_BLOCK_CONTENT_VERSION) return null;
  const flags = bytes[1];
  const decoder = new TextDecoder();
  const entryIdLength = bytes[2];
  if (entryIdLength === 0 || 3 + entryIdLength + 32 + 1 > bytes.length) return null;
  const entryId = decoder.decode(bytes.subarray(3, 3 + entryIdLength));
  let bodyHash = '0x';
  let offset = 3 + entryIdLength;
  for (let i = offset; i < offset + 32; i += 1) bodyHash += bytes[i].toString(16).padStart(2, '0');
  offset += 32;
  const walletLength = bytes[offset];
  if (walletLength === 0 || offset + 1 + walletLength + 1 > bytes.length) return null;
  const authorWallet = decoder.decode(bytes.subarray(offset + 1, offset + 1 + walletLength));
  offset += 1 + walletLength;
  const authorLength = bytes[offset];
  if (offset + 1 + authorLength + 1 > bytes.length) return null;
  const author = decoder.decode(bytes.subarray(offset + 1, offset + 1 + authorLength));
  offset += 1 + authorLength;
  const titleLength = bytes[offset];
  if (offset + 1 + titleLength > bytes.length) return null;
  const title = decoder.decode(bytes.subarray(offset + 1, offset + 1 + titleLength));
  offset += 1 + titleLength;
  return {
    entryId,
    bodyHash,
    authorWallet,
    author: truncateUtf8ToBytes(author, SHARE_AUTHOR_MAX_BYTES),
    title: truncateUtf8ToBytes(title, SHARE_TITLE_MAX_BYTES),
    snippet: truncateUtf8ToBytes(decoder.decode(bytes.subarray(offset)), SHARE_SNIPPET_MAX_BYTES),
    hasImage: (flags & SHARE_FLAG_HAS_IMAGE) !== 0,
    textTruncated: (flags & SHARE_FLAG_TEXT_TRUNCATED) !== 0,
  };
}
