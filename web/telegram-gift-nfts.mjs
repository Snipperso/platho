// telegram-gift-nfts — the Telegram collectible gifts a wallet holds, settled on chain.
//
// A gift is DECORATION. Nothing here guards money, and nothing here decides who somebody is: the .ath name beside a
// gift is proven by its own registry read, and a wallet is a wallet. So the question this module answers is narrow —
// "is this NFT really one of Telegram's collectible gifts, and does this wallet really hold it" — and the answer is
// taken from the chain rather than from whoever listed it.
//
// THE ANCHOR, MEASURED 2026-09-06 against six live gift collections (Durov's Caps, Diamond Rings, Voodoo Dolls, Toy
// Bears, Heart Lockets, Hanging Stars). They are ownerless (`owner_address` is addr_none, `next_item_index` is -1),
// they all run the SAME code, and each carries the SAME 256-bit constant at bit 33 of its data root — by shape, the
// key that authorises a mint. Either half alone is weak: the code is public, so anyone can redeploy it with their own
// key, and a constant without the code is a number in a stranger's contract. Together they are a pair only Telegram's
// own collections satisfy, and both are read from the chain.
//
// WHAT IS PROVEN AND WHAT IS COSMETIC — the same split as username-nft-owned, for the same reason. Proven: the item
// is authentic, its collection is authentic, and the owner is this wallet. Cosmetic: the picture, and the pretty name
// ("Durov's Cap #37"). The pretty name is not merely trusted though — it is checked by ARITHMETIC against the slug the
// chain carries, so a hostile indexer that relabels a Durov's Cap as a Plush Pepe fails the comparison and the item
// falls back to its chain-derived name. The picture is the only thing a bad indexer can still get wrong, and the worst
// it achieves is a wrong thumbnail next to a right name.
//
// AN INDEXER MAY ADD, NEVER REMOVE. A wallet's gift list is a statement about somebody's property, and an indexer that
// answers with an empty array looks exactly like "you own nothing". `complete` carries that distinction; a caller that
// ignores it will show a list that lies.
import { tonCell } from './pwa-contract-transactions.mjs?v=47';
import { parseTonAddress } from './crypto/platho-crypto.mjs?v=21';

/** Every Telegram gift collection runs this code. Measured on six collections; base64 as toncenter reports it. */
export const TELEGRAM_GIFT_COLLECTION_CODE_HASH = 'iEEMIg+CIYFmgmnOg+ucwNOznCGZnItV3gM2CiDnwoI=';
/** …and carries this constant in its data root. Both halves are required; see the header. */
export const TELEGRAM_GIFT_MINTER_KEY = 0xbe3a1bc943496314139a36e2ab85f53fefb5e32c098fe6cef85094d6cdebc898n;
/**
 * Where that constant sits in the data root: one lazy-init bit, then a u32 collection ordinal, then the key.
 * Read as an OFFSET rather than by walking a decoded cell because the root's second ref is an exotic library cell,
 * which the shared BOC reader refuses outright (and should keep refusing — see readCollectionMinterKey).
 */
export const TELEGRAM_GIFT_MINTER_KEY_BIT_OFFSET = 33;
/** Bound on what an indexer may propose in one answer. It is untrusted input; an unbounded list is a free DoS. */
export const TELEGRAM_GIFT_DISCOVERY_LIMIT = 100;
/**
 * A ceiling on the content string an account may hand us. It is untrusted input arriving over the wire, and the
 * URIs it is a ceiling for are ~50 bytes; an unbounded snake read is a chain of cells somebody else chooses the
 * length of. (`maxBytes: 0` would mean a literal zero-byte cap, not "no cap" — the reader takes it at its word.)
 */
export const TELEGRAM_GIFT_URI_MAX_BYTES = 512;
/** Telegram's own asset host. Only ever used to FETCH a picture, never to decide anything. */
export const TELEGRAM_GIFT_ASSET_ORIGIN = 'https://nft.fragment.com';

/**
 * What to attach when sending a gift on.
 *
 * MEASURED on chain rather than borrowed [2026-09-07]. The name transfer's 0.02 GRAM mirrors UsernameNFTItem's own
 * budget, read from its .tact — a gift's contract is somebody else's and that number says nothing about it. So the
 * figure comes from what really happens: across three gifts in three different collections, every real transfer
 * attached 51,345,944 nanotons, the item consumed 798,137, and 50,547,806 came back.
 *
 * 0.05 GRAM is that same figure and sixty-two times what the item spends. The body below sets forward_amount to
 * zero, which is strictly cheaper than the measured case, so the margin is wider than the measurement shows.
 */
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

/**
 * `https://nft.fragment.com/gift/durovscap-37.json` -> `{ slug: 'durovscap', number: 37 }`, or null.
 *
 * This string is the item's own on-chain content, so slug and number are CHAIN FACTS — which is what lets the
 * display name below be checked instead of believed, and what builds the picture URL without asking anyone.
 */
export function parseTelegramGiftItemUri(value) {
  const match = GIFT_ITEM_URI.exec(String(value ?? '').trim());
  if (!match) return null;
  const number = Number(match[2]);
  if (!Number.isSafeInteger(number) || number < 0) return null;
  return { slug: match[1], number };
}

/** The collection half of the same shape: `…/collection/durovscap.json` -> `durovscap`, or null. */
export function parseTelegramGiftCollectionUri(value) {
  const match = GIFT_COLLECTION_URI.exec(String(value ?? '').trim());
  return match ? match[1] : null;
}

/**
 * The minter key out of a collection's raw data BOC, or null when the bytes are not the shape we expect.
 *
 * WHY THIS DOES NOT USE tonCell.parseBocBase64: a gift collection's data root holds an EXOTIC library cell as its
 * second reference, and the shared reader throws on exotic cells by design — it feeds capsule bodies, where an
 * unexpected exotic cell is a reason to stop, not to shrug. Widening it for a decoration would weaken every caller.
 * So this walks the serialized cells itself, reads only the ROOT's own bits, and never follows a reference. Anything
 * unexpected returns null, which reads downstream as "not proven" rather than as "not authentic".
 */
/**
 * Parse a BOC into a flat cell table: `{ bits, bitLength, refs }` per cell, plus the index of the root.
 *
 * WHY THIS EXISTS AND tonCell.parseBocBase64 IS NOT USED: a gift collection's data root holds an EXOTIC library
 * cell as one of its references, and the shared reader throws on exotic cells by design — it feeds capsule bodies,
 * where an unexpected exotic cell is a reason to stop, not to shrug. Widening it for a decoration would weaken
 * every caller. This reads the structure only, keeps exotic cells as opaque entries, and never treats one as data.
 *
 * Returns null on anything unexpected, which reads downstream as "not proven" rather than as "not authentic".
 */
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
      // Odd d2 means the last byte is padded with a terminator 1-bit followed by zeros; find it and drop it.
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

/**
 * The minter key out of a collection's raw data BOC, or null when the bytes are not the shape we expect.
 *
 * An exotic ROOT is refused outright: a gift collection's root is an ordinary cell whose refs happen to include an
 * exotic one, and reading a pruned branch's bits as if they were state is exactly the mistake worth refusing.
 */
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

/**
 * The collection's own content URI, out of the SAME bytes — so it costs no second request.
 *
 * It was being fetched with `get_collection_data`, one more call on an endpoint that grants about one a second and
 * had already started refusing. It is the first reference of the data root: a TEP-64 off-chain string, `0x01` then
 * the URI, as a snake cell. Returns '' when it is not that shape, which fails the slug check downstream.
 */
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

/**
 * Is this account one of Telegram's gift collections?
 *
 * BOTH halves of the anchor, and the caller must have read them from the chain (an `accountStates` row), not from an
 * indexer's summary of it. A missing or unreadable field is `false` — this is the gate the "genuine" badge hangs on,
 * and a gate that passes on absent evidence is not a gate.
 */
export function telegramGiftCollectionIsAuthentic({ codeHash = null, dataBoc = null } = {}) {
  if (String(codeHash ?? '') !== TELEGRAM_GIFT_COLLECTION_CODE_HASH) return false;
  const key = readCollectionMinterKey(dataBoc);
  return key !== null && key === TELEGRAM_GIFT_MINTER_KEY;
}

/**
 * A display name we are willing to show, or null.
 *
 * The indexer's pretty name ("Durov's Cap #37") is the only readable label a gift has — the chain carries a slug and a
 * number, and turning `durovscap` into `Durov's Cap` needs a dictionary nobody should hardcode. So the name is checked
 * rather than trusted: stripped of everything but letters and digits it must reproduce exactly `slug + number`. A
 * relabelled item fails that comparison and shows its chain-derived name instead. Same move as settling a username by
 * its hash — the proposer can be wrong, but it cannot be wrong CONVINCINGLY.
 */
export function verifiedTelegramGiftName(proposedName, { slug, number } = {}) {
  const proposed = String(proposedName ?? '').trim();
  if (!proposed || !slug) return null;
  const squashed = proposed.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return squashed === `${slug}${number}` ? proposed : null;
}

/** The name to show when nothing prettier proved itself: the chain's own slug and number. */
export function telegramGiftFallbackName({ slug, number } = {}) {
  return slug ? `${slug} #${number}` : '';
}

/**
 * Where a gift's picture can be fetched from, best first.
 *
 * The toncenter proxy comes first because the app already talks to toncenter — no new host learns which wallet is
 * looking at which gift — and because its answer is CORS-open and cached for a year. It is only ever a PROPOSAL from
 * the discovery response, so it is used when offered and skipped when not. Telegram's own asset host is the fallback
 * and is built from the chain's slug and number, so it needs nobody's cooperation. Both are fetched as bytes and
 * rendered from a blob: URL — `img-src` allows blob: already, and bytes in hand can be cached on the device.
 */
export function telegramGiftImageSources({ slug, number, proposedImage = null } = {}) {
  const out = [];
  const proposed = String(proposedImage ?? '').trim();
  // PARSED, NOT PATTERN-MATCHED [pre-stage security review 2026-09-08]. The regex this replaced accepted any host
  // that merely ENDED in the letters "toncenter.com" — evil-toncenter.com passed it. A hostname compared whole,
  // or as a real subdomain, is the only shape of this check that means what it says.
  let host = null;
  try {
    const url = new URL(proposed);
    if (url.protocol === 'https:') host = url.hostname.toLowerCase();
  } catch { host = null; }
  if (host === 'toncenter.com' || (host && host.endsWith('.toncenter.com'))) out.push(proposed);
  if (slug) out.push(`${TELEGRAM_GIFT_ASSET_ORIGIN}/gift/${slug}-${number}.webp`);
  return out;
}

/**
 * Ask the indexer which NFTs this wallet holds, and keep the ones SHAPED like a gift.
 *
 * The shape filter is not a trust decision, it is a cost decision: a real wallet also holds airdropped junk (the two
 * probe wallets on 2026-09-06 carried a dozen "you won 100 TON" items between them), and verifying every one of them
 * on chain would be a chain read per piece of spam. What survives here is still only a PROPOSED address; the collection
 * anchor and the ownership are settled afterwards, on chain.
 */
export async function discoverTelegramGiftItems({
  ownerWallet,
  fetchImpl = globalThis.fetch,
  origin = 'https://toncenter.com',
  apiKey = null,
  limit = TELEGRAM_GIFT_DISCOVERY_LIMIT,
} = {}) {
  if (!ownerWallet) throw new Error('telegram gift discovery: wallet is required');
  if (typeof fetchImpl !== 'function') throw new Error('telegram gift discovery: no fetch available');
  const url = `${origin}/api/v3/nft/items?owner_address=${encodeURIComponent(ownerWallet)}`
    + `&limit=${Number(limit)}&offset=0`;
  const headers = { Accept: 'application/json' };
  if (apiKey) headers['X-API-Key'] = String(apiKey);
  const response = await fetchImpl(url, { headers });
  if (!response?.ok) {
    // The STATUS rides on the error. A 429 is "ask again in a moment" and a caller that cannot tell it from a
    // refusal has to treat both as final — which is how a busy minute became "this wallet owns nothing".
    const error = new Error(`telegram gift discovery: indexer answered ${response?.status ?? 'nothing'}`);
    error.status = Number(response?.status) || 0;
    throw error;
  }
  const payload = await response.json();
  const items = Array.isArray(payload?.nft_items) ? payload.nft_items : [];
  const metadata = payload?.metadata ?? {};
  const out = [];
  const seen = new Set();
  for (const item of items.slice(0, Number(limit))) {
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
    if (out.length >= Number(limit)) break;
  }
  return out;
}

/**
 * The owned list, chain-verified.
 *
 * `verifyItem(itemAddress)` must return `{ collectionAddress, ownerWallet, contentUri }` read from the item's own
 * get_nft_data. `verifyCollection(collectionAddress)` must return `{ codeHash, dataBoc, contentUri }` read from that
 * account's raw state — collections are immutable in practice, so a caller is expected to cache it and pay for each
 * collection once rather than once per gift.
 *
 * An item is kept only when ALL of it holds: the collection passes the anchor, the item's content URI is a gift URI,
 * the collection's content URI names the SAME slug, and the owner is this wallet. `transferred` reports the one
 * positive proof that a remembered gift left — an authentic item now owned by somebody else — because forgetting on
 * ABSENCE is the shape that cost the owner his linked username twice.
 *
 * `complete` is false when the indexer could not be asked or refused, or when any check THREW. A caller must say so;
 * a caller that reconciles its own memory against this list may only ADD from an incomplete one.
 */
export async function collectOwnedTelegramGifts({
  ownerWallet,
  indexerItems = null,
  indexerError = null,
  verifyItem,
  verifyCollection,
} = {}) {
  if (typeof verifyItem !== 'function') throw new Error('telegram gift collect: verifyItem is required');
  if (typeof verifyCollection !== 'function') throw new Error('telegram gift collect: verifyCollection is required');
  const mine = rawAddress(ownerWallet);
  if (!mine) throw new Error('telegram gift collect: owner wallet is required');

  const gifts = [];
  const transferred = [];
  let unverified = 0;
  // One answer per collection, remembered for this pass. Six gifts from one collection are six item reads and ONE
  // collection read; the per-pass cost lives here rather than in each caller.
  const collectionVerdicts = new Map();
  const collectionVerdict = async (collectionAddress) => {
    if (collectionVerdicts.has(collectionAddress)) return collectionVerdicts.get(collectionAddress);
    const record = await verifyCollection(collectionAddress);
    const verdict = {
      authentic: telegramGiftCollectionIsAuthentic(record ?? {}),
      slug: parseTelegramGiftCollectionUri(record?.contentUri),
    };
    collectionVerdicts.set(collectionAddress, verdict);
    return verdict;
  };

  const seen = new Set();
  for (const proposal of indexerItems ?? []) {
    const itemAddress = rawAddress(proposal?.itemAddress ?? proposal);
    if (!itemAddress || seen.has(itemAddress)) continue;
    seen.add(itemAddress);

    let item = null;
    let verdict = null;
    try {
      item = await verifyItem(itemAddress);
      const collectionAddress = rawAddress(item?.collectionAddress);
      if (!collectionAddress) { unverified += 1; continue; }
      verdict = await collectionVerdict(collectionAddress);
    } catch {
      // A read that failed proves nothing either way: neither shown nor denied, and the list is incomplete.
      unverified += 1;
      continue;
    }
    if (!verdict?.authentic) continue;

    // THE ITEM'S OWN CONTENT, not the indexer's copy of it. This is what names the gift.
    const parsed = parseTelegramGiftItemUri(item?.contentUri);
    if (!parsed) continue;
    // The collection must be the collection this slug belongs to. Without this an authentic Durov's Caps collection
    // would vouch for an item whose content URI claims to be a Plush Pepe.
    if (verdict.slug !== parsed.slug) continue;

    const owner = rawAddress(item?.ownerWallet);
    if (!owner) { unverified += 1; continue; }
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
      // Cosmetic, and labelled as such at every use: a wrong thumbnail beside a right name is the worst a bad
      // indexer achieves, and a missing one just means the picture is fetched from Telegram's host instead.
      imageSources: telegramGiftImageSources({ ...parsed, proposedImage: proposal?.proposedImage }),
      attributes: Array.isArray(proposal?.proposedAttributes) ? proposal.proposedAttributes : [],
    });
  }

  return {
    gifts,
    transferred,
    complete: indexerError === null && indexerItems !== null && unverified === 0,
    indexerError,
    unverified,
  };
}

/**
 * TEP-62 `get_nft_data`, decoded into the three facts a gift check needs: which collection vouches for this item,
 * who holds it, and what the item says it is.
 *
 * The decoders come in as parameters rather than as imports. This module is the RULE — what counts as a genuine
 * gift — and a rule that drags a transport in behind it cannot be exercised without one. `decodeAddressSliceBoc` is
 * the app's own address reader; the content cell is read here, because a gift's content is one snake string and
 * nothing about it is transport-shaped.
 *
 * Every failure is an exception, never a partial answer: a half-read item is exactly the shape that makes a gift
 * look transferred when the chain never said so.
 */
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
    // A TVM boolean arrives as "-0x1" for true; BigInt() refuses the sign in front of the radix prefix.
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
  // TEP-64 off-chain content: a 0x01 marker then the URI, as a snake string. `readSnakeCellBytes` follows the
  // chain of references for us; a gift's URI fits one cell today, and this does not depend on that staying true.
  const bytes = tonCell.readSnakeCellBytes(tonCell.parseBocBase64(contentCell), { maxBytes: TELEGRAM_GIFT_URI_MAX_BYTES, name: 'gift item content' });
  if (!bytes?.length || bytes[0] !== 0x01) throw new Error('gift item: content is not an off-chain TEP-64 string');
  return {
    index,
    collectionAddress,
    ownerWallet,
    contentUri: new TextDecoder().decode(bytes.subarray(1)).trim(),
  };
}
