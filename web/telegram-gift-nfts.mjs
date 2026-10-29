import { tonCell } from './pwa-contract-transactions.mjs?v=59';
import { parseTonAddress } from './crypto/platho-crypto.mjs?v=31';

export const TELEGRAM_GIFT_COLLECTION_CODE_HASH = 'iEEMIg+CIYFmgmnOg+ucwNOznCGZnItV3gM2CiDnwoI=';
export const TELEGRAM_GIFT_MINTER_KEY = 0xbe3a1bc943496314139a36e2ab85f53fefb5e32c098fe6cef85094d6cdebc898n;
export const TELEGRAM_GIFT_MINTER_KEY_BIT_OFFSET = 33;
export const TELEGRAM_GIFT_ITEM_CODE_LIBRARIES = Object.freeze([
  '91d9e2ac169fc785ce00de0a81af27622b9b7d1764415c775e7e50c03ce98aa2',
  '2498bd63f3e9cc2c20c79abe58899a4816ea156855b8d4fcd47cda4bae9e911a',
]);
export const TELEGRAM_GIFT_DISCOVERY_LIMIT = 100;
export const TELEGRAM_GIFT_DISCOVERY_PAGE = 1000;
export const TELEGRAM_GIFT_DISCOVERY_PAGES = 5;
export const TELEGRAM_GIFT_URI_MAX_BYTES = 512;
export const TELEGRAM_GIFT_ASSET_ORIGIN = 'https://nft.fragment.com';

export const TELEGRAM_GIFT_TRANSFER_VALUE_NANOTONS = 50_000_000n;

const GIFT_ITEM_URI = /^https:\/\/nft\.fragment\.com\/gift\/([a-z0-9]+)-(\d+)\.json$/;
const GIFT_COLLECTION_URI = /^https:\/\/nft\.fragment\.com\/collection\/([a-z0-9]+)\.json$/;

const rawAddress = (value) => {
  try {
    return parseTonAddress(value).raw;
  } catch {
    return null;
  }
};

export function parseTelegramGiftItemUri(value) {
  const match = GIFT_ITEM_URI.exec(String(value ?? '').trim());
  if (!match) return null;
  const number = Number(match[2]);
  if (!Number.isSafeInteger(number) || number < 0) return null;
  return { slug: match[1], number };
}

export function parseTelegramGiftCollectionUri(value) {
  const match = GIFT_COLLECTION_URI.exec(String(value ?? '').trim());
  return match ? match[1] : null;
}

function parseGiftCollectionCells(dataBocBase64) {
  let bytes;
  try {
    bytes = tonCell.base64ToBytes(String(dataBocBase64 ?? ''));
  } catch {
    return null;
  }
  if (!bytes || bytes.length < 10) return null;
  if (bytes[0] !== 0xb5 || bytes[1] !== 0xee || bytes[2] !== 0x9c || bytes[3] !== 0x72) return null;
  let offset = 4;
  const flags = bytes[offset]; offset += 1;
  const hasIndex = (flags & 0x80) !== 0;
  const hasCacheBits = (flags & 0x20) !== 0;
  const bocFlags = (flags >> 3) & 0x03;
  const sizeBytes = flags & 0x07;
  const offsetBytes = bytes[offset]; offset += 1;
  if (hasCacheBits || bocFlags !== 0) return null;
  if (sizeBytes < 1 || sizeBytes > 4 || offsetBytes < 1 || offsetBytes > 4) return null;
  const readCounter = (width) => {
    let out = 0;
    for (let i = 0; i < width; i += 1) out = (out * 256) + (bytes[offset + i] ?? 0);
    offset += width;
    return out;
  };
  if (offset + (sizeBytes * 3) + offsetBytes > bytes.length) return null;
  const cellsCount = readCounter(sizeBytes);
  const rootsCount = readCounter(sizeBytes);
  const absentCount = readCounter(sizeBytes);
  readCounter(offsetBytes);
  if (rootsCount !== 1 || absentCount !== 0 || cellsCount < 1 || cellsCount > 256) return null;
  if (offset + sizeBytes > bytes.length) return null;
  const rootIndex = readCounter(sizeBytes);
  if (rootIndex < 0 || rootIndex >= cellsCount) return null;
  if (hasIndex) offset += cellsCount * offsetBytes;

  const cells = [];
  for (let index = 0; index < cellsCount; index += 1) {
    if (offset + 2 > bytes.length) return null;
    const d1 = bytes[offset];
    const d2 = bytes[offset + 1];
    const refsCount = d1 & 0x07;
    const dataLength = Math.ceil(d2 / 2);
    const dataStart = offset + 2;
    if (dataStart + dataLength + (refsCount * sizeBytes) > bytes.length) return null;
    let bitLength = dataLength * 8;
    if (d2 % 2 !== 0) {
      let terminator = -1;
      for (let bit = bitLength - 1; bit >= 0; bit -= 1) {
        if (((bytes[dataStart + (bit >> 3)] >> (7 - (bit & 7))) & 1) === 1) { terminator = bit; break; }
      }
      if (terminator < 0) return null;
      bitLength = terminator;
    }
    const refs = [];
    let at = dataStart + dataLength;
    for (let r = 0; r < refsCount; r += 1) {
      let ref = 0;
      for (let i = 0; i < sizeBytes; i += 1) ref = (ref * 256) + bytes[at + i];
      at += sizeBytes;
      if (ref >= cellsCount) return null;
      refs.push(ref);
    }
    cells.push({ exotic: (d1 & 0x08) !== 0, start: dataStart, bitLength, refs });
    offset = at;
  }
  return { cells, rootIndex, bytes };
}

export function readCollectionMinterKey(dataBocBase64) {
  const parsed = parseGiftCollectionCells(dataBocBase64);
  if (!parsed) return null;
  const root = parsed.cells[parsed.rootIndex];
  if (!root || root.exotic) return null;
  const end = TELEGRAM_GIFT_MINTER_KEY_BIT_OFFSET + 256;
  if (root.bitLength < end) return null;
  let key = 0n;
  for (let bit = TELEGRAM_GIFT_MINTER_KEY_BIT_OFFSET; bit < end; bit += 1) {
    key = (key << 1n) | BigInt((parsed.bytes[root.start + (bit >> 3)] >> (7 - (bit & 7))) & 1);
  }
  return key;
}

export function readCollectionContentUri(dataBocBase64) {
  const parsed = parseGiftCollectionCells(dataBocBase64);
  if (!parsed) return '';
  const root = parsed.cells[parsed.rootIndex];
  if (!root || root.exotic || root.refs.length === 0) return '';
  const out = [];
  let index = root.refs[0];
  const seen = new Set();
  while (index !== undefined && !seen.has(index)) {
    seen.add(index);
    const cell = parsed.cells[index];
    if (!cell || cell.exotic || cell.bitLength % 8 !== 0) return '';
    for (let byte = 0; byte < cell.bitLength / 8; byte += 1) out.push(parsed.bytes[cell.start + byte]);
    if (out.length > TELEGRAM_GIFT_URI_MAX_BYTES) return '';
    index = cell.refs[0];
  }
  if (out.length === 0 || out[0] !== 0x01) return '';
  return new TextDecoder().decode(new Uint8Array(out.slice(1))).trim();
}

export function telegramGiftCollectionIsAuthentic({ codeHash = null, dataBoc = null } = {}) {
  if (String(codeHash ?? '') !== TELEGRAM_GIFT_COLLECTION_CODE_HASH) return false;
  const key = readCollectionMinterKey(dataBoc);
  if (key === null || key !== TELEGRAM_GIFT_MINTER_KEY) return false;
  return TELEGRAM_GIFT_ITEM_CODE_LIBRARIES.includes(readCollectionItemCodeLibrary(dataBoc));
}

export function readCollectionItemCodeLibrary(dataBocBase64) {
  const parsed = parseGiftCollectionCells(dataBocBase64);
  if (!parsed) return null;
  const root = parsed.cells[parsed.rootIndex];
  if (!root || root.exotic || root.refs.length < 2) return null;
  const library = parsed.cells[root.refs[1]];
  if (!library?.exotic || library.bitLength !== 264 || library.refs.length !== 0 || parsed.bytes[library.start] !== 0x02) return null;
  return [...parsed.bytes.subarray(library.start + 1, library.start + 33)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function verifiedTelegramGiftName(proposedName, { slug, number } = {}) {
  const proposed = String(proposedName ?? '').trim();
  if (!proposed || !slug) return null;
  const squashed = proposed.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return squashed === `${slug}${number}` ? proposed : null;
}

export function telegramGiftFallbackName({ slug, number } = {}) {
  return slug ? `${slug} #${number}` : '';
}

export function telegramGiftImageSources({ slug, number, proposedImage = null } = {}) {
  const out = [];
  const proposed = String(proposedImage ?? '').trim();
  let host = null;
  try {
    const url = new URL(proposed);
    if (url.protocol === 'https:') host = url.hostname.toLowerCase();
  } catch { host = null; }
  if (host === 'toncenter.com' || (host && host.endsWith('.toncenter.com'))) out.push(proposed);
  if (slug) out.push(`${TELEGRAM_GIFT_ASSET_ORIGIN}/gift/${slug}-${number}.webp`);
  return out;
}

export async function discoverTelegramGiftItems({
  ownerWallet,
  fetchImpl = globalThis.fetch,
  origin = 'https://toncenter.com',
  apiKey = null,
  limit = TELEGRAM_GIFT_DISCOVERY_PAGE * TELEGRAM_GIFT_DISCOVERY_PAGES,
} = {}) {
  if (!ownerWallet) throw new Error('telegram gift discovery: wallet is required');
  if (typeof fetchImpl !== 'function') throw new Error('telegram gift discovery: no fetch available');
  const headers = { Accept: 'application/json' };
  if (apiKey) headers['X-API-Key'] = String(apiKey);
  const out = [];
  const seen = new Set();
  for (let page = 0; page < TELEGRAM_GIFT_DISCOVERY_PAGES; page += 1) {
    const url = `${origin}/api/v3/nft/items?owner_address=${encodeURIComponent(ownerWallet)}`
      + `&limit=${TELEGRAM_GIFT_DISCOVERY_PAGE}&offset=${page * TELEGRAM_GIFT_DISCOVERY_PAGE}`;
    const response = await fetchImpl(url, { headers, cache: 'no-store' });
    if (!response?.ok) {
      const error = new Error(`telegram gift discovery: indexer answered ${response?.status ?? 'nothing'}`);
      error.status = Number(response?.status) || 0;
      throw error;
    }
    const payload = await response.json();
    const items = Array.isArray(payload?.nft_items) ? payload.nft_items : [];
    const metadata = payload?.metadata ?? {};
    for (const item of items.slice(0, TELEGRAM_GIFT_DISCOVERY_PAGE)) {
      const parsed = parseTelegramGiftItemUri(item?.content?.uri);
      if (!parsed) continue;
      const itemAddress = rawAddress(item?.address);
      const collectionAddress = rawAddress(item?.collection_address);
      if (!itemAddress || !collectionAddress || seen.has(itemAddress)) continue;
      seen.add(itemAddress);
      const info = (metadata?.[String(item.address).toUpperCase()]?.token_info ?? [])[0] ?? {};
      out.push({
        itemAddress,
        collectionAddress,
        proposedSlug: parsed.slug,
        proposedNumber: parsed.number,
        proposedName: typeof info?.name === 'string' ? info.name : '',
        proposedImage: typeof info?.extra?._image_medium === 'string' ? info.extra._image_medium : '',
        proposedAttributes: Array.isArray(info?.extra?.attributes) ? info.extra.attributes : [],
      });
      if (out.length >= Number(limit)) return out;
    }
    if (items.length < TELEGRAM_GIFT_DISCOVERY_PAGE) break;
  }
  return out;
}

export async function collectOwnedTelegramGifts({
  ownerWallet,
  indexerItems = null,
  indexerError = null,
  verifyItem,
  verifyCollection,
  verifyMembership,
  knownCollection = null,
} = {}) {
  if (typeof verifyItem !== 'function') throw new Error('telegram gift collect: verifyItem is required');
  if (typeof verifyCollection !== 'function') throw new Error('telegram gift collect: verifyCollection is required');
  if (typeof verifyMembership !== 'function') throw new Error('telegram gift collect: verifyMembership is required');
  const mine = rawAddress(ownerWallet);
  if (!mine) throw new Error('telegram gift collect: owner wallet is required');

  const gifts = [];
  const transferred = [];
  let unverified = 0;
  const collectionVerdicts = new Map();
  const readCollections = new Set();
  const known = (collectionAddress) => typeof knownCollection === 'function' && knownCollection(collectionAddress) === true;
  const collectionVerdict = (collectionAddress) => {
    if (!collectionVerdicts.has(collectionAddress) && !known(collectionAddress)) readCollections.add(collectionAddress);
    if (!collectionVerdicts.has(collectionAddress)) {
      collectionVerdicts.set(collectionAddress, (async () => {
        const record = await verifyCollection(collectionAddress);
        return {
          authentic: telegramGiftCollectionIsAuthentic(record ?? {}),
          slug: parseTelegramGiftCollectionUri(record?.contentUri),
        };
      })());
    }
    return collectionVerdicts.get(collectionAddress);
  };

  const seen = new Set();
  const undecided = new Set();
  let itemReads = 0;
  for (const proposal of indexerItems ?? []) {
    const itemAddress = rawAddress(proposal?.itemAddress ?? proposal);
    if (!itemAddress || seen.has(itemAddress)) continue;
    seen.add(itemAddress);
    const named = rawAddress(proposal?.collectionAddress);
    if (named) {
      if (!collectionVerdicts.has(named) && !known(named) && readCollections.size >= TELEGRAM_GIFT_DISCOVERY_LIMIT) { undecided.add(itemAddress); unverified += 1; continue; }
      try {
        if (!(await collectionVerdict(named)).authentic) continue;
      } catch {
        undecided.add(itemAddress); unverified += 1;
        continue;
      }
    }
    if (itemReads >= TELEGRAM_GIFT_DISCOVERY_LIMIT) { undecided.add(itemAddress); unverified += 1; continue; }
    itemReads += 1;

    let item = null;
    let verdict = null;
    let collectionAddress = '';
    try {
      item = await verifyItem(itemAddress);
      collectionAddress = rawAddress(item?.collectionAddress);
      if (!collectionAddress) { undecided.add(itemAddress); unverified += 1; continue; }
      verdict = await collectionVerdict(collectionAddress);
    } catch {
      undecided.add(itemAddress); unverified += 1;
      continue;
    }
    if (!verdict?.authentic) continue;

    const parsed = parseTelegramGiftItemUri(item?.contentUri);
    if (!parsed) continue;
    if (verdict.slug !== parsed.slug) continue;
    let member = '';
    try { member = rawAddress(await verifyMembership(collectionAddress, item?.index)); } catch { undecided.add(itemAddress); unverified += 1; continue; }
    if (member !== itemAddress) continue;

    const owner = rawAddress(item?.ownerWallet);
    if (!owner) { undecided.add(itemAddress); unverified += 1; continue; }
    const name = verifiedTelegramGiftName(proposal?.proposedName, parsed) ?? telegramGiftFallbackName(parsed);
    if (owner !== mine) {
      transferred.push({ itemAddress, slug: parsed.slug, number: parsed.number, name, ownerWallet: owner });
      continue;
    }
    gifts.push({
      itemAddress,
      collectionAddress: rawAddress(item.collectionAddress),
      slug: parsed.slug,
      number: parsed.number,
      name,
      imageSources: telegramGiftImageSources({ ...parsed, proposedImage: proposal?.proposedImage }),
      attributes: Array.isArray(proposal?.proposedAttributes) ? proposal.proposedAttributes : [],
    });
  }

  return {
    gifts,
    transferred,
    examined: [...seen].filter((address) => !undecided.has(address)),
    complete: indexerError === null && indexerItems !== null && unverified === 0,
    indexerError,
    unverified,
  };
}

export function decodeNftAddressByIndexStack(stack, { decodeAddressSliceBoc } = {}) {
  const items = Array.isArray(stack) ? stack : (Array.isArray(stack?.stack) ? stack.stack : null);
  if (!items || items.length < 1) throw new Error('gift collection: get_nft_address_by_index returned nothing');
  if (typeof decodeAddressSliceBoc !== 'function') throw new Error('gift collection: an address slice decoder is required');
  const item = items[0];
  if (typeof item?.address === 'string') return rawAddress(item.address);
  const raw = Array.isArray(item) ? item[1] : (item && typeof item === 'object' && 'value' in item ? item.value : item);
  if (typeof raw !== 'string') throw new Error('gift collection: the item is not an address stack item');
  const named = rawAddress(raw) || rawAddress(decodeAddressSliceBoc(raw));
  if (!named) throw new Error('gift collection: the item did not decode to an address');
  return named;
}

export function decodeNftItemDataStack(stack, { decodeAddressSliceBoc } = {}) {
  const items = Array.isArray(stack) ? stack : (Array.isArray(stack?.stack) ? stack.stack : null);
  if (!items || items.length < 5) throw new Error('gift item: get_nft_data did not return five values');
  if (typeof decodeAddressSliceBoc !== 'function') throw new Error('gift item: an address slice decoder is required');
  const valueOf = (item) => (Array.isArray(item) ? item[1] : (item && typeof item === 'object' && 'value' in item ? item.value : item));
  const intOf = (item, name) => {
    const raw = valueOf(item);
    if (typeof raw === 'bigint') return raw;
    if (typeof raw === 'number' && Number.isSafeInteger(raw)) return BigInt(raw);
    const text = String(raw ?? '').trim();
    if (/^-?0x[0-9a-fA-F]+$/.test(text)) return text.startsWith('-') ? -BigInt(`0x${text.slice(3)}`) : BigInt(text);
    if (/^-?[0-9]+$/.test(text)) return BigInt(text);
    throw new Error(`gift item: ${name} is not an integer stack item`);
  };
  const addressOf = (item, name) => {
    const raw = valueOf(item);
    if (typeof item?.address === 'string') return rawAddress(item.address);
    if (typeof raw !== 'string') throw new Error(`gift item: ${name} is not an address stack item`);
    const direct = rawAddress(raw);
    if (direct) return direct;
    const decoded = decodeAddressSliceBoc(raw);
    const normalised = rawAddress(decoded);
    if (!normalised) throw new Error(`gift item: ${name} did not decode to an address`);
    return normalised;
  };

  const initialised = intOf(items[0], 'init') !== 0n;
  if (!initialised) throw new Error('gift item: the account is not initialised');
  const index = intOf(items[1], 'index');
  const collectionAddress = addressOf(items[2], 'collection');
  const ownerWallet = addressOf(items[3], 'owner');
  const contentCell = valueOf(items[4]);
  if (typeof contentCell !== 'string') throw new Error('gift item: individual content is not a cell');
  const bytes = tonCell.readSnakeCellBytes(tonCell.parseBocBase64(contentCell), { maxBytes: TELEGRAM_GIFT_URI_MAX_BYTES, name: 'gift item content' });
  if (!bytes?.length || bytes[0] !== 0x01) throw new Error('gift item: content is not an off-chain TEP-64 string');
  return {
    index,
    collectionAddress,
    ownerWallet,
    contentUri: new TextDecoder().decode(bytes.subarray(1)).trim(),
  };
}
