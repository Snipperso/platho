import { sha256Sync } from './crypto/platho-crypto.mjs?v=31';
import { beginCell } from './pwa-contract-transactions.mjs?v=59';
import { assetAttributesOf, assetContentUriOf, assetInfoOf, assetPictureOf, assetText, rawAccount } from './wallet-assets.mjs?v=34';

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
      feeAddress: rawAccount(row?.details?.marketplace_fee_address) || null,
      royaltyAddress: rawAccount(row?.details?.royalty_address) || null,
      createdAt: Number(row?.created_at ?? 0),
      index: String(item.index ?? ''),
      name: assetText(info?.name) || assetText(item.content?.domain, 126) || '',
      domain: assetText(item.content?.domain, 126),
      picture: assetPictureOf(info, '_image_medium'),
      pictureBig: assetPictureOf(info, '_image_big'),
      attributes: assetAttributesOf(info),
      uri: assetContentUriOf(item.content),
      collectionName: assetText(collectionInfo?.name) || '',
      collectionPicture: assetPictureOf(collectionInfo),
      live,
    });
  }
  return out;
}

export async function readLatestListings({ fetchImpl, origin, limit = NFT_FEED_PAGE, offset = 0, collection = null, endLt = null } = {}) {
  const transfers = await json(fetchImpl, latestListingsUrl(origin, { limit, offset, collection, endLt }));
  const rows = (Array.isArray(transfers?.nft_transfers) ? transfers.nft_transfers : []).filter((row) => row?.transaction_aborted !== true);
  const listedAt = new Map();
  for (const row of rows) {
    const sale = rawAccount(row?.new_owner);
    if (sale && !listedAt.has(sale)) listedAt.set(sale, Number(row?.transaction_now) || 0);
  }
  const sales = [...listedAt.keys()];
  const times = [...listedAt.values()].filter((at) => at > 0);
  const listed = Array.isArray(transfers?.nft_transfers) ? transfers.nft_transfers : [];
  const more = listed.length >= limit;
  const lts = listed.map((row) => units(row?.transaction_lt)).filter((lt) => lt !== null && lt > 0n);
  const least = lts.length ? lts.reduce((low, lt) => (lt < low ? lt : low)) : null;
  const page = { sales, more, oldestAt: times.length ? Math.min(...times) : 0, newestAt: times.length ? Math.max(...times) : 0,
    cursor: least === null ? null : String(least - 1n) };
  if (!sales.length) return { ...page, listings: [] };
  const order = new Map(sales.map((sale, at) => [sale, at]));
  const listings = parseSales(await json(fetchImpl, salesUrl(origin, sales)))
    .filter((listing) => listing.live && order.has(listing.sale) && (!collection || listing.collection === rawAccount(collection)))
    .map((listing) => ({ ...listing, listedAt: listedAt.get(listing.sale) ?? 0 }));
  return { ...page, listings: listings.sort((a, b) => order.get(a.sale) - order.get(b.sale)) };
}

export async function readSalesNow({ fetchImpl, origin, sales }) {
  const asked = [...new Set(sales.map(rawAccount).filter(Boolean))].slice(0, NFT_SALES_MAX);
  if (!asked.length) return new Map();
  return new Map(parseSales(await json(fetchImpl, salesUrl(origin, asked))).filter((listing) => asked.includes(listing.sale)).map((listing) => [listing.sale, listing]));
}
export async function readListingsByIndex({ fetchImpl, origin, collection, indexes }) {
  const key = rawAccount(collection);
  const asked = [...new Set(indexes.filter(Boolean).map(String))].slice(0, 20);
  if (!key || !asked.length) return { listings: [], onSale: 0 };
  const body = await json(fetchImpl, `${origin}/api/v3/nft/items?collection_address=${encodeURIComponent(key)}${asked.map((index) => `&index=${encodeURIComponent(index)}`).join('')}&limit=${asked.length}`);
  const items = (Array.isArray(body?.nft_items) ? body.nft_items : []).filter((item) => asked.includes(String(item?.index ?? '')));
  const onSale = items.filter((item) => item?.on_sale === true).length;
  const owners = items.map((item) => rawAccount(item?.owner_address)).filter(Boolean);
  if (!owners.length) return { listings: [], onSale };
  const listings = [...(await readSalesNow({ fetchImpl, origin, sales: owners })).values()]
    .filter((listing) => listing.live && listing.collection === key && asked.includes(listing.index));
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
