import { beginCell } from './pwa-contract-transactions.mjs?v=59';
import { assetInfoOf, assetPictureOf, assetText, rawAccount } from './wallet-assets.mjs?v=29';

export const GETGEMS_SALE_DEPLOYER = '0:39d63083e48f46452ff8a04cd0d3733a90c8be299aa5951b62741759b2c17e0e';
export const GETGEMS_SALE_V4_CODE_HASH = 'a5WmQYucnSNZBF0edVm41UmuDlBvJMqrWPowyPsf64Y=';
export const NFT_BUY_GAS = 100_000_000n;
export const NFT_FEE_BASE = 100_000;
export const NFT_FEED_PAGE = 50;
export const NFT_SALES_MAX = 100;

export function latestListingsUrl(origin, { limit = NFT_FEED_PAGE, offset = 0 } = {}) {
  return `${origin}/api/v3/nft/transfers?owner_address=${encodeURIComponent(GETGEMS_SALE_DEPLOYER)}&direction=out&sort=desc&limit=${limit}&offset=${offset}`;
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
      name: assetText(info?.name) || '',
      picture: assetPictureOf(info),
      collectionName: assetText(collectionInfo?.name) || '',
      live,
    });
  }
  return out;
}

export async function readLatestListings({ fetchImpl, origin, limit = NFT_FEED_PAGE, offset = 0 } = {}) {
  const transfers = await json(fetchImpl, latestListingsUrl(origin, { limit, offset }));
  const rows = Array.isArray(transfers?.nft_transfers) ? transfers.nft_transfers : [];
  const sales = [...new Set(rows.filter((row) => row?.transaction_aborted !== true).map((row) => rawAccount(row?.new_owner)).filter(Boolean))];
  const more = rows.length >= limit;
  if (!sales.length) return { listings: [], more };
  const order = new Map(sales.map((sale, at) => [sale, at]));
  const listings = parseSales(await json(fetchImpl, salesUrl(origin, sales))).filter((listing) => listing.live && order.has(listing.sale));
  return { listings: listings.sort((a, b) => order.get(a.sale) - order.get(b.sale)), more };
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
