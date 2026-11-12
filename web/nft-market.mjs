import { sha256Sync } from './crypto/platho-crypto.mjs?v=32';
import { readRef, readUint, readerOf } from './intro-codec.mjs?v=4';
import { ed25519 } from './vendor/@noble/curves/ed25519.js';
import { beginCell, bytesToBase64, computeCellHashAndDepth, parseBocBase64 } from './pwa-contract-transactions.mjs?v=60';
import { WALLET_LIST_PAGES, WALLET_NFT_PAGE, assetAttributesOf, assetContentUriOf, assetInfoOf, assetPictureOf, assetText, rawAccount } from './wallet-assets.mjs?v=61';
import { readTelemintAuction } from './wallet-transfers.mjs?v=25';

export const GETGEMS_SALE_DEPLOYER = '0:39d63083e48f46452ff8a04cd0d3733a90c8be299aa5951b62741759b2c17e0e';
export const GETGEMS_SALE_V4_CODE_HASH = 'a5WmQYucnSNZBF0edVm41UmuDlBvJMqrWPowyPsf64Y=';
export const NFT_BUY_GAS = 100_000_000n;
export const NFT_FEE_BASE = 100_000;
export const NFT_FEED_PAGE = 100;
export const NFT_COLLECTION_PAGE = 100;
export const NFT_COLLECTION_DEEP_PAGES = 10;
export const NFT_COLLECTION_SEARCH_PAGES = 50;
export const NFT_PINNED_COLLECTIONS = Object.freeze([
  '0:80d78a35f955a14b679faa887ff4cd5bfc0f43b4a4eea2a7e6927f3701b273c2',
  '0:0e41dc1dc3c9067ed24248580e12b3359818d83dee0304fabcf80845eafafdb2',
  '0:b774d95eb20543f186c06b371ab88ad704f7e256130caf96189368a7d0cb6ccf',
]);
export const NFT_SALES_MAX = 100;
const [TELEGRAM_USERNAMES, TELEGRAM_NUMBERS, TON_DNS] = NFT_PINNED_COLLECTIONS;
const indexOfHash = (bytes) => BigInt(`0x${[...sha256Sync(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`).toString();

export function nftIndexOfName(collection, text) {
  const value = String(text ?? '').trim().toLowerCase();
  const key = rawAccount(collection);
  const bytes = (name) => new TextEncoder().encode(name);
  if (key === TELEGRAM_USERNAMES) {
    const name = value.replace(/^@/, '').replace(/\.t\.me$/, '');
    return /^[a-z0-9_]{4,32}$/.test(name) ? indexOfHash(bytes(name)) : null;
  }
  if (key === TELEGRAM_NUMBERS) {
    if (!/^[\d\s+()-]+$/.test(value)) return null;
    const digits = value.replace(/\D/g, '');
    const number = /^888\d{8}$/.test(digits) ? digits : /^\d{8}$/.test(digits) ? `888${digits}` : '';
    return number ? indexOfHash(bytes(number)) : null;
  }
  if (key === TON_DNS) {
    const name = value.replace(/\.ton$/, '');
    if (!/^[a-z0-9-]{4,126}$/.test(name)) return null;
    const data = bytes(name);
    return indexOfHash(Uint8Array.of(0, data.length * 2, ...data));
  }
  return null;
}

export function latestListingsUrl(origin, { limit = NFT_FEED_PAGE, offset = 0, collection = null, endLt = null } = {}) {
  const only = collection ? `&collection_address=${encodeURIComponent(collection)}` : '';
  const below = endLt ? `&end_lt=${encodeURIComponent(String(endLt))}` : '';
  return `${origin}/api/v3/nft/transfers?owner_address=${encodeURIComponent(GETGEMS_SALE_DEPLOYER)}${only}${below}&direction=out&sort=desc&limit=${limit}&offset=${endLt ? 0 : offset}`;
}
export function salesUrl(origin, addresses) {
  return `${origin}/api/v3/nft/sales?${addresses.slice(0, NFT_SALES_MAX).map((address) => `address=${encodeURIComponent(address)}`).join('&')}`;
}

async function json(fetchImpl, url) {
  const response = await fetchImpl(url);
  if (!response?.ok) throw Object.assign(new Error(`nft market: HTTP ${response?.status}`), { status: response?.status });
  return response.json();
}
const units = (value) => { try { return BigInt(String(value ?? '')); } catch { return null; } };

export function parseSales(body) {
  const out = [];
  for (const row of Array.isArray(body?.nft_sales) ? body.nft_sales : []) {
    const sale = rawAccount(row?.address);
    const nft = rawAccount(row?.nft_address);
    const seller = rawAccount(row?.nft_owner_address);
    const price = units(row?.details?.full_price);
    if (!sale || !nft || !seller || price === null) continue;
    const item = row?.nft_item ?? {};
    const collection = rawAccount(item.collection_address) || null;
    const feePercent = Number(row?.details?.marketplace_fee ?? 0);
    const royaltyPercent = Number(row?.details?.royalty_amount ?? 0);
    const shares = Number.isInteger(feePercent) && Number.isInteger(royaltyPercent) && feePercent >= 0 && royaltyPercent >= 0
      && feePercent + royaltyPercent <= NFT_FEE_BASE;
    const live = row?.type === 'getgems_sale' && row?.code_hash === GETGEMS_SALE_V4_CODE_HASH && row?.details?.is_complete === false
      && rawAccount(item.owner_address) === sale && price > 0n && shares;
    const info = assetInfoOf(body?.metadata, row.nft_address);
    const collectionInfo = collection ? assetInfoOf(body?.metadata, item.collection_address) : {};
    out.push({
      sale, nft, collection, seller, price, feePercent, royaltyPercent,
      marketplace: rawAccount(row?.marketplace_address) || null,
      feeAddress: rawAccount(row?.details?.marketplace_fee_address) || null,
      royaltyAddress: rawAccount(row?.details?.royalty_address) || null,
      createdAt: Number(row?.created_at ?? 0),
      index: String(item.index ?? ''),
      name: assetText(info?.name) || assetText(item.content?.domain, 126) || '',
      domain: assetText(item.content?.domain, 126),
      picture: assetPictureOf(info, '_image_medium'),
      pictureBig: assetPictureOf(info, '_image_big'),
      pictureKey: pictureKeyOf(info),
      attributes: assetAttributesOf(info),
      uri: assetContentUriOf(item.content),
      collectionName: assetText(collectionInfo?.name) || '',
      collectionPicture: assetPictureOf(collectionInfo),
      dataHash: String(row?.data_hash ?? ''),
      itemLt: String(item.last_transaction_lt ?? ''),
      live,
    });
  }
  return out;
}

function pictureKeyOf(info) {
  const image = info?.image;
  return typeof image === 'string' && image.length <= 512 && /^https:\/\//.test(image) ? image : '';
}
function readAddress(reader, name) {
  const tag = readUint(reader, 2, name);
  if (tag === 0n) return null;
  if (tag !== 2n || readUint(reader, 1, `${name}.anycast`) !== 0n) throw new Error(`${name}: not a standard address`);
  const workchain = BigInt.asIntN(8, readUint(reader, 8, `${name}.workchain`));
  return `${workchain}:${readUint(reader, 256, `${name}.hash`).toString(16).padStart(64, '0')}`;
}
function readCoins(reader, name) {
  return readUint(reader, Number(readUint(reader, 4, `${name}.length`)) * 8, name);
}
export function parseSaleV4Data(dataBoc) {
  try {
    const root = readerOf(parseBocBase64(dataBoc));
    const complete = readUint(root, 1, 'is_complete') === 1n;
    const marketplace = readAddress(root, 'marketplace_address');
    const seller = readAddress(root, 'nft_owner_address');
    const price = readCoins(root, 'full_price');
    const soldAt = Number(readUint(root, 32, 'sold_at'));
    readUint(root, 64, 'query_id');
    const fees = readerOf(readRef(root, 'static_data'));
    const feeAddress = readAddress(fees, 'fee_address');
    const royaltyAddress = readAddress(fees, 'royalty_address');
    const feePercent = Number(readUint(fees, 17, 'fee_percent'));
    const royaltyPercent = Number(readUint(fees, 17, 'royalty_percent'));
    const nft = readAddress(fees, 'nft_address');
    const createdAt = Number(readUint(fees, 32, 'created_at'));
    return { complete, marketplace, seller, price, soldAt, feeAddress, royaltyAddress, feePercent, royaltyPercent, nft, createdAt };
  } catch {
    return null;
  }
}


export const GETGEMS_AUCTION_V3R3_CODE_HASH = 'u29ireD+stefqzuK6/CTCvmFU99gCTsgJ/Covxab/Ow=';
export const NFT_AUCTION_BUYOUT_GAS = 100_000_000n;
export const NFT_AUCTION_LONGEST_S = 20 * 86_400;
export const NFT_AUCTION_BID_KEEP = 5_577_000n;
const NANO = 1_000_000_000n;
export function auctionPercent(amount, factor, base) {
  if (!base) return 0n;
  return (((amount * BigInt(factor)) / NANO) * NANO) / BigInt(base);
}
export function auctionNextBid({ lastBid, minBid, minStep }) {
  if (lastBid <= 0n) return minBid;
  const stepped = auctionPercent(lastBid, 100 + minStep, 100);
  const plus = lastBid + 100_000_000n;
  return stepped > plus ? stepped : plus;
}
export function telemintNextBid({ lastBid, minStep }) {
  const stepped = (lastBid * BigInt(100 + minStep) + 99n) / 100n;
  const plus = lastBid + NANO;
  return stepped > plus ? stepped : plus;
}
export function auctionSplit(listing, bid) {
  const fee = auctionPercent(bid, listing.feeFactor, listing.feeBase);
  const royalty = auctionPercent(bid, listing.royaltyFactor, listing.royaltyBase);
  return { seller: bid - fee - royalty, fee, royalty };
}
const shareOf = (factor, base) => (base > 0 ? Math.floor((factor * NFT_FEE_BASE) / base) : 0);
export function parseAuctionV3R3Data(dataBoc) {
  try {
    const root = readerOf(parseBocBase64(dataBoc));
    const ended = readUint(root, 1, 'end') === 1n;
    const canceled = readUint(root, 1, 'is_canceled') === 1n;
    const bidder = readAddress(root, 'last_member');
    const lastBid = readCoins(root, 'last_bid');
    const lastBidAt = Number(readUint(root, 32, 'last_bid_at'));
    const endTime = Number(readUint(root, 32, 'end_time'));
    const seller = readAddress(root, 'nft_owner');
    readUint(root, 64, 'last_query_id');
    const feeFactor = Number(readUint(root, 32, 'mp_fee_factor'));
    const feeBase = Number(readUint(root, 32, 'mp_fee_base'));
    const royaltyFactor = Number(readUint(root, 32, 'royalty_fee_factor'));
    const royaltyBase = Number(readUint(root, 32, 'royalty_fee_base'));
    const fees = readerOf(readRef(root, 'fees'));
    const feeAddress = readAddress(fees, 'mp_fee_addr');
    const royaltyAddress = readAddress(fees, 'royalty_fee_addr');
    const constants = readerOf(readRef(root, 'constants'));
    const marketplace = readAddress(constants, 'mp_addr');
    const minBid = readCoins(constants, 'min_bid');
    const maxBid = readCoins(constants, 'max_bid');
    const minStep = Number(readUint(constants, 7, 'min_step'));
    const stepTime = Number(readUint(constants, 17, 'step_time'));
    const nft = readAddress(constants, 'nft_addr');
    const createdAt = Number(readUint(constants, 32, 'created_at'));
    return { ended, canceled, bidder, lastBid, lastBidAt, endTime, seller, feeFactor, feeBase, royaltyFactor, royaltyBase, feeAddress, royaltyAddress,
      marketplace, minBid, maxBid, minStep, stepTime, nft, createdAt };
  } catch {
    return null;
  }
}
function auctionOfState(item, state, now) {
  const data = state?.dataBoc ? parseAuctionV3R3Data(state.dataBoc) : null;
  if (!item || !data?.seller || !data.nft) return null;
  const nextBid = auctionNextBid(data);
  const shares = auctionPercent(NANO, data.feeFactor, data.feeBase) + auctionPercent(NANO, data.royaltyFactor, data.royaltyBase) < NANO;
  const bidHeld = data.lastBid === 0n || (typeof state.balance === 'bigint' && state.balance >= data.lastBid);
  const live = state.active && state.codeHash === GETGEMS_AUCTION_V3R3_CODE_HASH && !data.ended && !data.canceled && data.nft === item.nft && shares
    && bidHeld && now < data.endTime && data.endTime - now <= NFT_AUCTION_LONGEST_S && nextBid > 0n && (data.maxBid === 0n || data.maxBid >= nextBid);
  return {
    ...item, kind: 'auction', seller: data.seller, price: nextBid, nextBid, lastBid: data.lastBid, bidder: data.bidder, maxBid: data.maxBid,
    endTime: data.endTime, minStep: data.minStep, stepTime: data.stepTime, marketplace: data.marketplace,
    feeAddress: data.feeAddress, royaltyAddress: data.royaltyAddress, feeFactor: data.feeFactor, feeBase: data.feeBase,
    royaltyFactor: data.royaltyFactor, royaltyBase: data.royaltyBase,
    feePercent: shareOf(data.feeFactor, data.feeBase), royaltyPercent: shareOf(data.royaltyFactor, data.royaltyBase),
    createdAt: data.createdAt, dataHash: state.dataHash, live,
  };
}


export const TELEMINT_DATA_CODE_HASHES = Object.freeze([
  'p6Jhak1jmgdsL2fnzOBCP9Khwu5VCtZRwe2hbuE7yso=',
  'WwkpkWUPvEizKIsIrMdneyLkwl1IRYxW0qF/I+gGtrQ=',
]);
export const TELEMINT_NO_END = 0xffffffff;
export function parseTelemintItemData(dataBoc) {
  try {
    const root = readerOf(parseBocBase64(dataBoc));
    const config = readerOf(readRef(root, 'config'));
    const index = readUint(config, 256, 'item_index').toString();
    const collection = readAddress(config, 'collection_address');
    if (readUint(root, 1, 'state?') !== 1n) return { index, collection, owner: null, auction: null, royalty: null };
    const state = readerOf(readRef(root, 'state'));
    const owner = readAddress(state, 'owner_address');
    readRef(state, 'content');
    let auction = null;
    if (readUint(state, 1, 'auction?') === 1n) {
      const both = readerOf(readRef(state, 'auction'));
      const now = readerOf(readRef(both, 'auction_state'));
      const terms = readerOf(readRef(both, 'auction_config'));
      let bidder = null;
      let lastBid = 0n;
      let lastBidAt = 0;
      if (readUint(now, 1, 'last_bid?') === 1n) {
        const bid = readerOf(readRef(now, 'last_bid'));
        bidder = readAddress(bid, 'bidder_address');
        lastBid = readCoins(bid, 'bid');
        lastBidAt = Number(readUint(bid, 32, 'bid_ts'));
      }
      const minBid = readCoins(now, 'min_bid');
      const endTime = Number(readUint(now, 32, 'end_time'));
      auction = { bidder, lastBid, lastBidAt, minBid, endTime, beneficiary: readAddress(terms, 'beneficiary_address'), initialMinBid: readCoins(terms, 'initial_min_bid'),
        maxBid: readCoins(terms, 'max_bid'), minStep: Number(readUint(terms, 8, 'min_bid_step')), extendTime: Number(readUint(terms, 32, 'min_extend_time')),
        duration: Number(readUint(terms, 32, 'duration')) };
    }
    const royaltyCell = readerOf(readRef(state, 'royalty_params'));
    const royalty = { numerator: Number(readUint(royaltyCell, 16, 'numerator')), denominator: Number(readUint(royaltyCell, 16, 'denominator')),
      address: readAddress(royaltyCell, 'destination') };
    return { index, collection, owner, auction, royalty };
  } catch {
    return null;
  }
}
export function telemintListingOf(item, auction, { royalty = null, dataHash = '', now = Math.floor(Date.now() / 1000) } = {}) {
  if (!item?.nft || !auction?.beneficiary) return null;
  const fixed = auction.maxBid > 0n && auction.minBid >= auction.maxBid;
  const live = auction.minBid > 0n && (auction.maxBid === 0n || auction.minBid <= auction.maxBid) && now < auction.endTime;
  const royaltyPercent = royalty && royalty.denominator > 0 && royalty.address && royalty.address !== auction.beneficiary
    ? Math.min(NFT_FEE_BASE, Math.floor((royalty.numerator * NFT_FEE_BASE) / royalty.denominator)) : 0;
  return {
    ...item, kind: 'telemint', sale: item.nft, seller: auction.beneficiary, price: fixed ? auction.maxBid : auction.minBid, nextBid: auction.minBid,
    lastBid: auction.lastBid, bidder: auction.bidder, maxBid: auction.maxBid, endTime: auction.endTime, fixed, minStep: Number.isFinite(auction.minStep) ? auction.minStep : null,
    feeAddress: null, feePercent: 0, royaltyAddress: royaltyPercent ? royalty.address : null, royaltyPercent, royaltyKnown: Boolean(royalty),
    dataHash, live,
  };
}

export function saleStatesUrl(origin, sales, { boc = true, max = NFT_SALES_MAX } = {}) {
  return `${origin}/api/v3/accountStates?${sales.slice(0, max).map((sale) => `address=${encodeURIComponent(sale)}`).join('&')}&include_boc=${boc}`;
}
export async function readSaleStates({ fetchImpl, origin, sales, boc = true, max = NFT_SALES_MAX }) {
  const asked = [...new Set(sales.map(rawAccount).filter(Boolean))].slice(0, max);
  if (!asked.length) return new Map();
  const body = await json(fetchImpl, saleStatesUrl(origin, asked, { boc, max }));
  const wanted = new Set(asked);
  const out = new Map();
  for (const row of Array.isArray(body?.accounts) ? body.accounts : []) {
    const sale = rawAccount(row?.address);
    if (!wanted.has(sale)) continue;
    out.set(sale, { active: row.status === 'active', codeHash: String(row.code_hash ?? ''), dataHash: String(row.data_hash ?? ''),
      dataBoc: typeof row.data_boc === 'string' ? row.data_boc : '', lastLt: String(row.last_transaction_lt ?? ''),
      balance: /^\d+$/.test(String(row.balance ?? '')) ? BigInt(row.balance) : null });
  }
  return out;
}
async function readItemOwners({ fetchImpl, origin, items }) {
  const asked = [...new Set(items.map(rawAccount).filter(Boolean))].slice(0, NFT_SALES_MAX);
  if (!asked.length) return new Map();
  const body = await json(fetchImpl, `${origin}/api/v3/nft/items?${asked.map((item) => `address=${encodeURIComponent(item)}`).join('&')}&limit=${asked.length}`);
  const wanted = new Set(asked);
  const out = new Map();
  for (const row of Array.isArray(body?.nft_items) ? body.nft_items : []) {
    const item = rawAccount(row?.address);
    if (wanted.has(item)) out.set(item, rawAccount(row?.owner_address));
  }
  return out;
}
async function stillOnSale({ fetchImpl, origin, listings, now }) {
  if (!listings.length) return listings;
  const moved = listings.filter((listing) => now.get(listing.nft) && now.get(listing.nft) !== listing.itemLt);
  const owners = moved.length ? await readItemOwners({ fetchImpl, origin, items: moved.map((listing) => listing.nft) }) : new Map();
  const out = [];
  for (const listing of listings) {
    const owner = owners.get(listing.nft);
    if (owner && owner !== listing.sale) continue;
    out.push(!moved.includes(listing) || owner ? { ...listing, itemLt: now.get(listing.nft) || listing.itemLt } : listing);
  }
  return out;
}
function feedItemOf(row, metadata) {
  const sale = rawAccount(row?.new_owner);
  const nft = rawAccount(row?.nft_address);
  if (!sale || !nft) return null;
  const collection = rawAccount(row?.nft_collection) || null;
  const info = assetInfoOf(metadata, row.nft_address);
  const collectionInfo = collection ? assetInfoOf(metadata, row.nft_collection) : {};
  const domain = assetText(info?.extra?.domain, 126);
  return {
    sale, nft, collection, index: String(info?.nft_index ?? ''), name: assetText(info?.name) || domain || '', domain,
    picture: assetPictureOf(info, '_image_medium'), pictureBig: assetPictureOf(info, '_image_big'), pictureKey: pictureKeyOf(info), attributes: assetAttributesOf(info),
    uri: assetContentUriOf(info?.extra), collectionName: assetText(collectionInfo?.name) || '', collectionPicture: assetPictureOf(collectionInfo),
  };
}
function listingOfState(item, state, now = Math.floor(Date.now() / 1000)) {
  if (state?.codeHash === GETGEMS_AUCTION_V3R3_CODE_HASH) return auctionOfState(item, state, now);
  const data = state?.dataBoc ? parseSaleV4Data(state.dataBoc) : null;
  if (!item || !data?.seller) return null;
  const live = state.active && state.codeHash === GETGEMS_SALE_V4_CODE_HASH && !data.complete && data.price > 0n && data.nft === item.nft
    && data.feePercent + data.royaltyPercent <= NFT_FEE_BASE;
  return {
    ...item, kind: 'sale', seller: data.seller, price: data.price, feePercent: data.feePercent, royaltyPercent: data.royaltyPercent, marketplace: data.marketplace,
    feeAddress: data.feeAddress, royaltyAddress: data.royaltyAddress, createdAt: data.createdAt, dataHash: state.dataHash, live,
  };
}
function nftOfState(state) {
  if (!state?.dataBoc) return null;
  if (state.codeHash === GETGEMS_AUCTION_V3R3_CODE_HASH) return parseAuctionV3R3Data(state.dataBoc)?.nft ?? null;
  return parseSaleV4Data(state.dataBoc)?.nft ?? null;
}
const LISTING_CODE_HASHES = new Set([GETGEMS_SALE_V4_CODE_HASH, GETGEMS_AUCTION_V3R3_CODE_HASH]);

export async function readLatestListings({ fetchImpl, origin, limit = NFT_FEED_PAGE, offset = 0, collection = null, endLt = null, checkItems = true } = {}) {
  const transfers = await json(fetchImpl, latestListingsUrl(origin, { limit, offset, collection, endLt }));
  const rows = (Array.isArray(transfers?.nft_transfers) ? transfers.nft_transfers : []).filter((row) => row?.transaction_aborted !== true);
  const rowsOf = new Map();
  for (const row of rows) {
    const sale = rawAccount(row?.new_owner);
    if (!sale) continue;
    if (!rowsOf.has(sale)) rowsOf.set(sale, []);
    rowsOf.get(sale).push(row);
  }
  const times = rows.map((row) => Number(row?.transaction_now) || 0).filter((at) => at > 0);
  const listed = Array.isArray(transfers?.nft_transfers) ? transfers.nft_transfers : [];
  const more = listed.length >= limit;
  const lts = listed.map((row) => units(row?.transaction_lt)).filter((lt) => lt !== null && lt > 0n);
  const least = lts.length ? lts.reduce((low, lt) => (lt < low ? lt : low)) : null;
  const page = { more, oldestAt: times.length ? Math.min(...times) : 0, newestAt: times.length ? Math.max(...times) : 0,
    cursor: least === null ? null : String(least - 1n) };
  if (!rowsOf.size) return { ...page, sales: [], listings: [] };
  const checked = checkItems && !endLt;
  const nfts = checked ? [...new Set(rows.map((row) => rawAccount(row?.nft_address)).filter(Boolean))] : [];
  const states = await readSaleStates({ fetchImpl, origin, sales: [...rowsOf.keys(), ...nfts], max: 2 * NFT_SALES_MAX });
  const only = collection ? rawAccount(collection) : null;
  const sales = [];
  const listings = [];
  for (const [sale, its] of rowsOf) {
    const state = states.get(sale);
    const nft = nftOfState(state);
    const row = nft ? its.find((one) => rawAccount(one?.nft_address) === nft) : null;
    if (!row) continue;
    sales.push(sale);
    const listing = listingOfState({ ...feedItemOf(row, transfers?.metadata), itemLt: String(row.transaction_lt ?? '') }, state);
    if (listing?.live && (!only || listing.collection === only)) listings.push({ ...listing, listedAt: Number(row.transaction_now) || 0 });
  }
  if (!checked || !listings.length) return { ...page, sales, listings };
  const now = new Map(listings.map((listing) => [listing.nft, states.get(listing.nft)?.lastLt ?? '']).filter(([, lt]) => lt));
  try {
    return { ...page, sales, listings: await stillOnSale({ fetchImpl, origin, listings, now }) };
  } catch {
    return { ...page, sales, listings };
  }
}

export async function readListingsChanged({ fetchImpl, origin, listings }) {
  const all = [...new Map(listings.filter((listing) => listing?.sale).map((listing) => [listing.sale, listing])).values()].slice(0, NFT_SALES_MAX);
  if (!all.length) return new Map();
  const asked = all.filter((listing) => listing.kind !== 'telemint');
  const own = all.filter((listing) => listing.kind === 'telemint');
  const now = await readSaleStates({ fetchImpl, origin, sales: [...all.map((listing) => listing.sale), ...asked.map((listing) => listing.nft)], boc: false,
    max: 2 * NFT_SALES_MAX });
  const out = new Map();
  const ownAgain = [];
  for (const listing of own) {
    const state = now.get(listing.sale);
    if (!state?.active) out.set(listing.sale, null);
    else if (!listing.dataHash || state.dataHash !== listing.dataHash) ownAgain.push(listing);
  }
  if (ownAgain.length) {
    const lots = await telemintListingsOfRows({ fetchImpl, origin, rows: ownAgain.map(telemintRowOf), metadata: null, asked: ownAgain.length });
    const fresh = new Map(lots.map((listing) => [listing.sale, listing]));
    for (const listing of ownAgain) {
      if (lots.unread.has(listing.nft)) continue;
      const read = fresh.get(listing.sale);
      out.set(listing.sale, read ? { ...read, name: listing.name, domain: listing.domain, picture: listing.picture, pictureBig: listing.pictureBig,
        pictureKey: listing.pictureKey, attributes: listing.attributes, uri: listing.uri, collectionName: listing.collectionName,
        collectionPicture: listing.collectionPicture } : null);
    }
  }
  const again = [];
  for (const listing of asked) {
    const state = now.get(listing.sale);
    if (!state?.active || !LISTING_CODE_HASHES.has(state.codeHash)) out.set(listing.sale, null);
    else if (!listing.dataHash || state.dataHash !== listing.dataHash) again.push(listing);
  }
  if (again.length) {
    const read = await readSaleStates({ fetchImpl, origin, sales: again.map((listing) => listing.sale) });
    for (const listing of again) {
      const fresh = listingOfState(listing, read.get(listing.sale));
      out.set(listing.sale, fresh?.live ? fresh : null);
    }
  }
  const standing = asked.filter((listing) => out.get(listing.sale) !== null).map((listing) => out.get(listing.sale) ?? listing);
  const lts = new Map(standing.map((listing) => [listing.nft, now.get(listing.nft)?.lastLt ?? '']));
  const held = new Map((await stillOnSale({ fetchImpl, origin, listings: standing, now: lts })).map((listing) => [listing.sale, listing]));
  for (const listing of standing) {
    const kept = held.get(listing.sale);
    if (!kept) out.set(listing.sale, null);
    else if (out.has(listing.sale) || kept.itemLt !== listing.itemLt) out.set(listing.sale, kept);
  }
  return out;
}

export async function readSalesNow({ fetchImpl, origin, sales }) {
  const asked = [...new Set(sales.map(rawAccount).filter(Boolean))].slice(0, NFT_SALES_MAX);
  if (!asked.length) return new Map();
  return new Map(parseSales(await json(fetchImpl, salesUrl(origin, asked))).filter((listing) => asked.includes(listing.sale)).map((listing) => [listing.sale, listing]));
}
const onItsOwnSale = (row) => row?.on_sale === true && Boolean(rawAccount(row?.owner_address)) && rawAccount(row?.owner_address) === rawAccount(row?.real_owner);
function itemOfRow(row, metadata, sale = null) {
  const nft = rawAccount(row?.address);
  if (!nft) return null;
  const collection = rawAccount(row?.collection_address) || null;
  const info = assetInfoOf(metadata, row.address);
  const collectionInfo = collection ? assetInfoOf(metadata, row.collection_address) : {};
  const domain = assetText(row?.content?.domain, 126) || assetText(info?.extra?.domain, 126);
  return {
    sale: sale ?? nft, nft, collection, index: String(row?.index ?? ''), name: assetText(info?.name) || domain || '', domain,
    picture: assetPictureOf(info, '_image_medium'), pictureBig: assetPictureOf(info, '_image_big'), pictureKey: pictureKeyOf(info), attributes: assetAttributesOf(info),
    uri: assetContentUriOf(row?.content) || assetContentUriOf(info?.extra), collectionName: assetText(collectionInfo?.name) || '', collectionPicture: assetPictureOf(collectionInfo),
    itemLt: String(row?.last_transaction_lt ?? ''),
  };
}
const telemintRowOf = (listing) => ({ address: listing.nft, collection_address: listing.collection, index: listing.index, on_sale: true });
async function telemintListingsOfRows({ fetchImpl, origin, rows, metadata, asked, held = null }) {
  const items = rows.map((row) => itemOfRow(row, metadata)).filter(Boolean);
  const out = [];
  out.unread = new Set();
  if (!items.length) return out;
  const states = await readSaleStates({ fetchImpl, origin, sales: items.map((item) => item.nft) });
  let left = asked;
  let refused = false;
  for (const item of items) {
    const state = states.get(item.nft);
    if (!state?.active) continue;
    let listing = null;
    const kept = held?.get(item.nft);
    if (TELEMINT_DATA_CODE_HASHES.includes(state.codeHash)) {
      const data = parseTelemintItemData(state.dataBoc);
      if (!data?.auction || data.collection !== item.collection || data.index !== item.index) continue;
      listing = telemintListingOf(item, data.auction, { royalty: data.royalty, dataHash: state.dataHash });
    } else if (kept?.dataHash && kept.dataHash === state.dataHash) listing = kept;
    else if (left > 0 && !refused) {
      left -= 1;
      try {
        listing = telemintListingOf(item, await readTelemintAuction({ fetchImpl, origin, item: item.nft }), { dataHash: state.dataHash });
      } catch (error) {
        if (error?.code === 'NOT_WANTED') throw error;
        refused = true;
        out.unread.add(item.nft);
      }
    } else out.unread.add(item.nft);
    if (listing?.live) out.push(listing);
  }
  return out;
}
export async function readTelemintListings({ fetchImpl, origin, collection, limit = NFT_COLLECTION_PAGE, asked = 6, held = null }) {
  const key = rawAccount(collection);
  if (!key) return [];
  const body = await json(fetchImpl, `${origin}/api/v3/nft/items?collection_address=${encodeURIComponent(key)}&sort_by_last_transaction_lt=true&limit=${limit}`);
  const rows = (Array.isArray(body?.nft_items) ? body.nft_items : []).filter((row) => onItsOwnSale(row) && rawAccount(row?.collection_address) === key);
  return telemintListingsOfRows({ fetchImpl, origin, rows, metadata: body?.metadata, asked, held });
}
export async function readListingsByIndex({ fetchImpl, origin, collection, indexes }) {
  const key = rawAccount(collection);
  const asked = [...new Set(indexes.filter(Boolean).map(String))].slice(0, 20);
  if (!key || !asked.length) return { listings: [], onSale: 0 };
  const body = await json(fetchImpl, `${origin}/api/v3/nft/items?collection_address=${encodeURIComponent(key)}${asked.map((index) => `&index=${encodeURIComponent(index)}`).join('')}&limit=${asked.length}`);
  const items = (Array.isArray(body?.nft_items) ? body.nft_items : []).filter((item) => asked.includes(String(item?.index ?? '')));
  const onSale = items.filter((item) => item?.on_sale === true).length;
  const ofCollection = (listing) => listing?.live && listing.collection === key && asked.includes(listing.index);
  const listings = [];
  const onContracts = items.filter((row) => row?.on_sale === true && !onItsOwnSale(row) && rawAccount(row?.owner_address));
  if (onContracts.length) {
    const states = await readSaleStates({ fetchImpl, origin, sales: onContracts.map((row) => row.owner_address) });
    for (const row of onContracts) {
      const owner = rawAccount(row.owner_address);
      const listing = listingOfState(itemOfRow(row, body?.metadata, owner), states.get(owner));
      if (ofCollection(listing)) listings.push(listing);
    }
  }
  const own = items.filter(onItsOwnSale);
  if (own.length) listings.push(...(await telemintListingsOfRows({ fetchImpl, origin, rows: own, metadata: body?.metadata, asked: own.length })).filter(ofCollection));
  return { listings, onSale };
}
export async function readCollectionNames({ fetchImpl, origin, collections }) {
  const asked = [...new Set(collections.map(rawAccount).filter(Boolean))].slice(0, 20);
  if (!asked.length) return new Map();
  const body = await json(fetchImpl, `${origin}/api/v3/nft/collections?${asked.map((one) => `collection_address=${encodeURIComponent(one)}`).join('&')}&limit=${asked.length}`);
  const out = new Map();
  for (const row of Array.isArray(body?.nft_collections) ? body.nft_collections : []) {
    const key = rawAccount(row?.address);
    if (!asked.includes(key)) continue;
    const info = assetInfoOf(body?.metadata, row.address);
    out.set(key, { name: assetText(info?.name) || '', picture: assetPictureOf(info) });
  }
  return out;
}
export async function readSaleFresh({ fetchImpl, origin, sale }) {
  return parseSales(await json(fetchImpl, salesUrl(origin, [sale]))).find((listing) => listing.sale === rawAccount(sale)) ?? null;
}

export async function readAuctionFresh({ fetchImpl, origin, listing, now }) {
  const state = (await readSaleStates({ fetchImpl, origin, sales: [listing.sale] })).get(rawAccount(listing.sale));
  return state ? listingOfState(listing, state, now) : null;
}

export function nftBuyBody() {
  return beginCell().endCell();
}

export function buyValue(listing) {
  return listing.price + NFT_BUY_GAS;
}

export function priceSplit(listing) {
  const fee = listing.feeAddress ? (listing.price * BigInt(listing.feePercent)) / BigInt(NFT_FEE_BASE) : 0n;
  const royalty = listing.royaltyAddress ? (listing.price * BigInt(listing.royaltyPercent)) / BigInt(NFT_FEE_BASE) : 0n;
  return { seller: listing.price - fee - royalty, fee, royalty };
}


export const GETGEMS_MARKETPLACE = '0:584ee61b2dff0837116d0fcb5078d93964bcbe9c05fd6a141b1bfca5d6a43e18';
export const GETGEMS_FEE_ADDRESS = '0:bee7a3d7b8c06f9552032c3880a56a74b702ad8b224f42bfb1ac1c33bd719080';
export const NFT_SALE_V4_CODE_BOC = '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';
export const NFT_LIST_FORWARD = 200_000_000n;
export const NFT_LIST_TO_SALE = 20_000_000n;
export const NFT_LIST_VALUE = 350_000_000n;
export const NFT_CANCEL_VALUE = 100_000_000n;
export const NFT_CHANGE_PRICE_VALUE = 10_000_000n;
export const NFT_FEE_MAX = 5_000;
export const NFT_ROYALTY_MAX = 15_000;
export const NFT_ITEM_RESERVE = 1_000_000_000n;
export const NFT_TOP_UP_STEP = 10_000_000n;
export const nftItemKeepsReserve = (collection) => NFT_PINNED_COLLECTIONS.includes(rawAccount(collection));
export function nftItemTopUp(collection, balance) {
  if (!nftItemKeepsReserve(collection)) return 0n;
  const short = NFT_ITEM_RESERVE - BigInt(balance);
  return short > 0n ? ((short + NFT_TOP_UP_STEP - 1n) / NFT_TOP_UP_STEP) * NFT_TOP_UP_STEP : 0n;
}
const NFT_OP = Object.freeze({ transfer: 0x5fcc3d14, doSale: 0x00fe0ede, deployJetton: 0xfb5dbf47, cancel: 3, changePrice: 0xfd135f7b });
const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

let saleCode = null;
export async function saleV4Code() {
  if (saleCode) return saleCode;
  const cell = parseBocBase64(NFT_SALE_V4_CODE_BOC);
  const { hash } = await computeCellHashAndDepth(cell);
  if (bytesToBase64(hash) !== GETGEMS_SALE_V4_CODE_HASH) throw new Error('nft market: the sale code is not the one the deployer allows');
  saleCode = cell;
  return saleCode;
}

export function listingTermsFrom(listings, collection, royalty) {
  const own = rawAccount(collection);
  if (!own || royalty === undefined) return null;
  const standard = (listings ?? []).filter((l) => l?.live && l.collection === own && l.marketplace === GETGEMS_MARKETPLACE && l.feeAddress === GETGEMS_FEE_ADDRESS);
  if (standard.length === 0) return null;
  const tally = (key) => {
    const sellers = new Map();
    for (const l of standard) {
      const k = key(l);
      if (!sellers.has(k)) sellers.set(k, new Set());
      sellers.get(k).add(l.seller);
    }
    const ranked = [...sellers].sort((a, b) => b[1].size - a[1].size);
    if (ranked.length > 1 && ranked[0][1].size === ranked[1][1].size) return null;
    return { value: ranked[0][0], sellers: ranked[0][1].size };
  };
  const fee = tally((l) => l.feePercent);
  if (!fee || fee.value > NFT_FEE_MAX) return null;
  const sellers = new Set(standard.map((l) => l.seller)).size;
  if (royalty) {
    const { numerator, denominator, address } = royalty;
    if (typeof numerator !== 'bigint' || typeof denominator !== 'bigint' || numerator < 0n || (numerator > 0n && denominator <= 0n)) return null;
    const parts = numerator === 0n ? 0n : (numerator * BigInt(NFT_FEE_BASE)) / denominator;
    if (parts > BigInt(NFT_ROYALTY_MAX) || (parts > 0n && !address)) return null;
    return { feePercent: fee.value, royaltyAddress: address || null, royaltyPercent: Number(parts), sellers };
  }
  const royaltyAt = tally((l) => l.royaltyAddress ?? '');
  if (!royaltyAt) return null;
  if (Math.min(...standard.filter((l) => (l.royaltyAddress ?? '') === royaltyAt.value).map((l) => l.royaltyPercent)) > 0) return null;
  return { feePercent: fee.value, royaltyAddress: royaltyAt.value || null, royaltyPercent: 0, sellers };
}

export async function buildListing({ nft, seller, price, feePercent, royaltyAddress = null, royaltyPercent = 0, createdAt, queryId, secretKey }) {
  const amount = BigInt(price);
  if (amount <= 0n) throw new Error('nft market: a listing needs a price');
  if (!Number.isInteger(feePercent) || feePercent < 0 || feePercent > NFT_FEE_MAX) throw new Error('nft market: the fee is out of bounds');
  if (!Number.isInteger(royaltyPercent) || royaltyPercent < 0 || royaltyPercent > NFT_ROYALTY_MAX) throw new Error('nft market: the royalty is out of bounds');
  if (!(secretKey instanceof Uint8Array) || secretKey.length !== 32) throw new Error('nft market: the listing key must be 32 bytes');
  const publicKey = ed25519.getPublicKey(secretKey);
  const terms = beginCell().address(GETGEMS_FEE_ADDRESS, 'fee_address');
  if (royaltyAddress) terms.address(royaltyAddress, 'royalty_address');
  else terms.uint(0n, 2, 'royalty_address.none');
  const staticData = terms
    .uint(BigInt(feePercent), 17, 'fee_percent')
    .uint(BigInt(royaltyPercent), 17, 'royalty_percent')
    .address(nft, 'nft_address')
    .uint(BigInt(createdAt), 32, 'created_at')
    .endCell();
  const data = beginCell()
    .uint(0n, 1, 'is_complete')
    .address(GETGEMS_SALE_DEPLOYER, 'marketplace_address')
    .address(seller, 'nft_owner_address')
    .coins(amount, 'full_price')
    .uint(0n, 32, 'sold_at')
    .uint(0n, 64, 'query_id')
    .ref(staticData, 'static_data')
    .uint(0n, 1, 'jetton_price_dict.none')
    .uint(1n, 1, 'public_key.some')
    .bytesValue(publicKey, 32, 'public_key')
    .endCell();
  const stateInit = beginCell()
    .uint(0n, 1, 'split_depth.none')
    .uint(0n, 1, 'special.none')
    .customPayloadMaybe(await saleV4Code(), 'code')
    .customPayloadMaybe(data, 'data')
    .uint(0n, 1, 'library.none')
    .endCell();
  const signed = beginCell().address(GETGEMS_MARKETPLACE, 'new_marketplace').uint(0n, 1, 'jetton_price_dict.none').endCell();
  const signature = ed25519.sign((await computeCellHashAndDepth(signed)).hash, secretKey);
  const deployBody = beginCell()
    .uint(BigInt(NFT_OP.deployJetton), 32, 'op')
    .uint(BigInt(queryId), 64, 'query_id')
    .bytesValue(signature, 64, 'signature')
    .cell(signed, 'signed')
    .endCell();
  const payload = beginCell()
    .uint(BigInt(NFT_OP.doSale), 32, 'do_sale')
    .ref(stateInit, 'state_init')
    .ref(deployBody, 'body')
    .coins(NFT_LIST_TO_SALE, 'to_sale')
    .endCell();
  const body = beginCell()
    .uint(BigInt(NFT_OP.transfer), 32, 'op')
    .uint(BigInt(queryId), 64, 'query_id')
    .address(GETGEMS_SALE_DEPLOYER, 'new_owner')
    .address(seller, 'response_destination')
    .uint(0n, 1, 'custom_payload.none')
    .coins(NFT_LIST_FORWARD, 'forward_amount')
    .uint(1n, 1, 'forward_payload.ref')
    .ref(payload, 'forward_payload')
    .endCell();
  const sale = `0:${hex((await computeCellHashAndDepth(stateInit)).hash)}`;
  return { sale, body, publicKey };
}

export async function readListingsOf({ fetchImpl, origin, owner }) {
  const account = rawAccount(owner);
  if (!account) return [];
  const items = [];
  let cut = false;
  for (let page = 0; page < WALLET_LIST_PAGES; page += 1) {
    const body = await json(fetchImpl, `${origin}/api/v3/nft/items?owner_address=${encodeURIComponent(account)}&include_on_sale=true&limit=${WALLET_NFT_PAGE}&offset=${page * WALLET_NFT_PAGE}`);
    const rows = Array.isArray(body?.nft_items) ? body.nft_items : [];
    for (const row of rows) {
      const sale = rawAccount(row?.owner_address);
      if (row?.on_sale !== true || rawAccount(row?.real_owner) !== account || !sale || sale === account) continue;
      const item = itemOfRow(row, body?.metadata, sale);
      if (item) items.push(item);
    }
    if (rows.length < WALLET_NFT_PAGE) break;
    cut = page === WALLET_LIST_PAGES - 1;
  }
  const out = [];
  for (let at = 0; at < items.length; at += NFT_SALES_MAX) {
    const batch = items.slice(at, at + NFT_SALES_MAX);
    const states = await readSaleStates({ fetchImpl, origin, sales: batch.map((item) => item.sale) });
    for (const item of batch) {
      const listing = listingOfState(item, states.get(item.sale));
      if (listing?.live && listing.seller === account) out.push(listing);
    }
  }
  return cut ? Object.defineProperty(out, 'capped', { value: WALLET_LIST_PAGES * WALLET_NFT_PAGE }) : out;
}

export function nftCancelBody(queryId) {
  return beginCell().uint(BigInt(NFT_OP.cancel), 32, 'op').uint(BigInt(queryId), 64, 'query_id').endCell();
}

export function nftChangePriceBody(queryId, price) {
  const amount = BigInt(price);
  if (amount <= 0n) throw new Error('nft market: a listing needs a price');
  return beginCell().uint(BigInt(NFT_OP.changePrice), 32, 'op').uint(BigInt(queryId), 64, 'query_id').coins(amount, 'new_price')
    .uint(0n, 1, 'jetton_price_dict.none').endCell();
}
