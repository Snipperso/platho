export const SINGLE_CAPSULE_USEFUL_BYTES = 1024;

// HOW MANY CAPSULES ONE MESSAGE MAY SPAN. Two bounds meet at 8 and both are real: it caps the worst-case send
// at the measured slow terminal (~21 minutes scaled — the number the composer's own comment carries), and it
// was also, until 2026-09-01, the most publishes one signed vault external could carry. That external door is
// deleted [OWNER: the money for sending travels WITH the message], so each part is now its own wallet message
// and no door caps the count — the measured slow-terminal ceiling is the only bound left, and it is the one
// that mattered for the user anyway.
// [2026-08-29] Until today this number lived as MAX_BATCH_PARTS in the batch machinery of the DELETED Vault
// contract, and the whole of that machinery shipped to every user so the composer could read one constant.
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
// descLen is u16 (cyrillic is 2 bytes/char, so a byte cap hits well before the char count); each tag length fits u8.
// Tags are expected pre-normalized by the composer (lowercase/trim/dedupe), but encode defends the wire bounds anyway.
// v792 raised the caps (owner: 16 chars/tag was too tight for cyrillic — long russian tags cut mid-word; 256-char
// descriptions were too short): tag 32->64 bytes (~32 cyrillic chars, still u8-safe), description 512->1536 bytes
// (~768 cyrillic chars, still u16). DECODE is unchanged and backward-compatible — the length fields carry any size.
export const PROFILE_BLOCK_CONTENT_VERSION = 1;
export const PROFILE_DESCRIPTION_MAX_BYTES = 1536;
export const PROFILE_TAG_MAX_BYTES = 64;
export const PROFILE_MAX_TAGS = 12;
// The channel's SELF-DECLARED .ath owner username — carried the same way private messages carry senderUsername,
// and verified the same way (against the on-chain username registry: owner == the channel's author wallet). The
// claim is NEVER trusted on its own; only a registry-verified name is ever displayed. A profile with no linked
// username encodes a zero-length field, so the wire is uniform. Registry names are <=16 ASCII; 20 bytes headroom.
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

export function encodeProfileBlockContent(profile) {
  const description = textEncoder.encode(truncateUtf8ToBytes(profile?.description ?? '', PROFILE_DESCRIPTION_MAX_BYTES));
  const tags = normalizeProfileTags(profile?.tags).map((tag) => textEncoder.encode(tag));
  // decided), appended after tags — see PROFILE_USERNAME_MAX_BYTES.
  const ownerUsername = textEncoder.encode(truncateUtf8ToBytes(String(profile?.ownerUsername ?? '').trim(), PROFILE_USERNAME_MAX_BYTES));
  // THE LOOK, appended after the username [2026-09-07]: [appearanceLen:u8][kind:u8][payload]. A reader that stops
  // at the username reads exactly what it read before, and a profile without one adds not a byte.
  const appearance = encodeProfileAppearance(profile?.appearance);
  // THE WORN GIFT, its own trailer [2026-09-09]: the gift a wallet WEARS (its profile card) is not the gift its
  // CHANNEL is dressed in (the look's own choice) — the owner may show one on the card and none on the channel. A
  // raw item address, after the appearance trailer; when a worn gift is carried and there is no appearance, an
  // EMPTY appearance trailer (length 0) is written so the reader's trailers stay in order. Readers before this
  // field stop at the appearance and never see it — forward-compatible by the same rule the appearance used.
  const wornGift = textEncoder.encode(normalizeProfileWornGift(profile?.wornGift) ?? '');
  let total = 1 + 2 + description.length + 1;
  for (const tag of tags) total += 1 + tag.length;
  total += 1 + ownerUsername.length; // [usernameLen:u8][username:utf8]
  if (appearance) total += 1 + appearance.length;
  else if (wornGift.length > 0) total += 1;   // the empty appearance trailer the worn gift rides behind
  if (wornGift.length > 0) total += 1 + wornGift.length;   // [wornGiftLen:u8][rawAddress:utf8]
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
  } else if (wornGift.length > 0) {
    out[offset] = 0;
    offset += 1;
  }
  if (wornGift.length > 0) {
    out[offset] = wornGift.length;
    offset += 1;
    out.set(wornGift, offset);
    offset += wornGift.length;
  }
  return out;
}

/** The worn gift's item address as the block carries it: raw, lowercase — or null for anything else. */
export function normalizeProfileWornGift(value) {
  const address = String(value ?? '').trim().toLowerCase();
  return RAW_ADDRESS_RE.test(address) ? address : null;
}

// --- Channel appearance (a trailer of the PROFILE block) ---
// The one kind so far: a Telegram gift, named by its item's raw address. The address is the whole claim — the
// gift's slug and number are chain facts read from the item itself when the claim is proven (see the reader), so
// nothing a publisher writes here can dress a channel in a gift it does not hold.
export const PROFILE_APPEARANCE_KIND_TELEGRAM_GIFT = 1;
// THE LOOK, kind 2 [decided 2026-09-09]: a channel's whole appearance for its visitors, not only a gift — the
// theme the owner chose for guests, the background animation and its settings, and the gift if there is one.
// [kind:u8][theme:u8][background:u8][n:u8][n × value:u16 BE][giftLen:u8][gift:utf8]. A background index this
// reader does not know (a mode a newer build shipped) decodes as "not carried", so the guest keeps their own;
// the settings are clamped to the sliders' own bounds, so a hostile profile cannot ask a guest's device for more
// than the Appearance dialog allows.
export const PROFILE_APPEARANCE_KIND_LOOK = 2;
export const PROFILE_LOOK_THEMES = Object.freeze(['dark', 'light']);
export const PROFILE_LOOK_BACKGROUNDS = Object.freeze(['none', 'plasma', 'nodes']);
// [min, max, default] per slider, in the sliders' own order — the Appearance dialog's `min`/`max`/`value`.
export const PROFILE_LOOK_SETTING_RANGES = Object.freeze({
  none: Object.freeze([]),
  plasma: Object.freeze([[0, 100, 30], [1, 16, 5], [25, 600, 175], [0, 200, 50]]),   // glow, suns, speed, energy
  nodes: Object.freeze([[0, 300, 100], [0, 300, 100], [25, 300, 100], [0, 300, 100]]), // brightness, signals, speed, flashlights
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
  // null = not carried (a background this build does not know): the guest keeps their own.
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

function decodeProfileLook(bytes) {
  // bytes: the trailer WITHOUT its kind byte
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
    background: PROFILE_LOOK_BACKGROUNDS[backgroundIndex] ?? 'unknown',   // unknown → not carried
    settings,
    itemAddress,
  });
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
  // Owner-username claim. A truncated trailer must never null the profile (description+tags already parsed) — the
  // reader falls through with '' and simply shows the wallet address, never a half-read name.
  let ownerUsername = '';
  if (offset < bytes.length) {
    const usernameLength = bytes[offset];
    offset += 1;
    if (usernameLength > 0 && offset + usernameLength <= bytes.length) {
      ownerUsername = decoder.decode(bytes.subarray(offset, offset + usernameLength));
      offset += usernameLength;   // the trailer after this one starts where the name ends
    }
  }
  // The look. Same contract as the name: a truncated or unknown trailer never nulls the profile — the channel is
  // simply undressed, and an unknown kind is a kind this build does not draw.
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
  return { description, tags, ownerUsername, appearance, wornGift };
}

// --- Shared-post content codec (document block type SHARE) ---
// A reference to a PUBLIC post shared into a private chat / the sender's own channel (v766), riding inside the
// shared PDC1 document container — symmetric across surfaces like REPLY/FILE above. Carries the post's chain
// coordinates (entryId + bodyHash: content-addressed, so the original is always fetchable/verifiable) plus a
// DENORMALIZED display snapshot (author label + title + text excerpt) so the embed renders instantly with zero
// chain reads, Telegram-forward-style. The snapshot is SENDER-authored (unverified, the REPLY-quote precedent);
// the recipient resolves the header identity (avatar/name) from authorWallet through their OWN resolver, so
// only title/snippet are ever claim-only. Content layout:
//   [version u8=1][flags u8: bit0 hasImage, bit1 textTruncated]
//   [entryId u64 BE][bodyHash 32 bytes]
//   [walletLen u8][wallet utf8 raw form][authorLen u8][author utf8][titleLen u8][title utf8][snippet utf8 ...]
// v1 packed the entry id as a uint64. clean-17's public feed id is `epochTag.shardSeq.entryId` — a string — so v2
// carries it length-prefixed as text. The decoder reads BOTH: v1 shares already on chain keep rendering.
export const SHARE_BLOCK_CONTENT_VERSION = 2;
export const SHARE_ENTRY_ID_MAX_BYTES = 64;
export const SHARE_AUTHOR_MAX_BYTES = 64;
export const SHARE_TITLE_MAX_BYTES = 96;
export const SHARE_WALLET_MAX_BYTES = 80;
// Big enough to carry the vast majority of posts WHOLE (so "expand" honestly shows the full text); a
// pathological post truncates with the textTruncated flag and the embed's channel link leads to the original.
export const SHARE_SNIPPET_MAX_BYTES = 4096;
export const SHARE_FLAG_HAS_IMAGE = 0x01;
export const SHARE_FLAG_TEXT_TRUNCATED = 0x02;

export function encodeShareBlockContent(share) {
  // THE ENTRY ID IS A STRING, and packing it as a uint64 is what made forwarding a public post impossible.
  //
  // OBSERVED 2026-08-04 (owner): attach a post to a message and the send does nothing at all until the forward is
  // cancelled. `BigInt('688.0.1')` throws a SyntaxError, the submit handler died on it, and an async handler that
  // throws looks exactly like a button that does nothing.
  //
  // The id stopped being a number when the public feed made it globally unique: entry_id is 0-based PER SHARD, so
  // a channel's posts across its era/overflow shards collide on it, and the feed identity became
  // `epochTag.shardSeq.entryId`. This encoder kept the CapsuleHub-era assumption that an entry id is an integer —
  // the same "stale after the redeploy" class as the Vault wording, except this one was load-bearing.
  //
  // v2 carries it length-prefixed as text. decodeShareBlockContent still reads v1 (the uint64 form), so shares
  // already on chain keep rendering; only newly written ones use v2.
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
  // textTruncated survives from the draft too: the composer pre-truncates so the echo matches the wire, and the
  // encoder's own re-cut is then a no-op that must not drop the flag.
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
  // Unknown future versions / truncated frames return null — a bad share block must never make the carrying
  // message undecodable (the REPLY/FILE/PROFILE rule).
  // NO v1 COMPATIBILITY PATH, and that is not an oversight. v1 packed the entry id as a uint64, which means it
  // could never encode a public post at all — clean-17's feed id is `epochTag.shardSeq.entryId`, BigInt() threw on
  // it, and the send died there. So no v1 share was ever written to the wire: carrying a reader for it would be
  // dead weight pretending to be caution. [decided 2026-08-04]
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
    author,
    title,
    snippet: decoder.decode(bytes.subarray(offset)),
    hasImage: (flags & SHARE_FLAG_HAS_IMAGE) !== 0,
    textTruncated: (flags & SHARE_FLAG_TEXT_TRUNCATED) !== 0,
  };
}
