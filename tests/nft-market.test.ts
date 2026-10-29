import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  GETGEMS_SALE_DEPLOYER, GETGEMS_SALE_V4_CODE_HASH, NFT_BUY_GAS, NFT_SALES_MAX, buyValue, latestListingsUrl, parseSales, priceSplit,
  readLatestListings, readSaleFresh, salesUrl,
} from '../web/nft-market.mjs';


const fixture = JSON.parse(readFileSync('tests/fixtures/nft-market-feed.json', 'utf8'));
const GRAM = 1_000_000_000n;
const answer = (...bodies: any[]) => {
  const asked: string[] = [];
  let at = 0;
  return { asked, fetchImpl: async (url: string) => { asked.push(url); const body = bodies[Math.min(at++, bodies.length - 1)]; return body?.status ? { ok: false, status: body.status } : { ok: true, json: async () => body }; } };
};
const sale = (over: Record<string, any> = {}, details: Record<string, any> = {}, item: Record<string, any> = {}) => {
  const base = structuredClone(fixture.sales.nft_sales[0]);
  return { ...base, ...over, details: { ...base.details, ...details }, nft_item: { ...base.nft_item, ...item } };
};

describe('the NFT market', () => {
  it('NFTM-01: a live capture reads as live Getgems v4 listings — price, seller, shares, the item, its collection, its name', () => {
    const listings = parseSales(fixture.sales);
    expect(listings).toHaveLength(fixture.sales.nft_sales.length);
    expect(listings.every((one: any) => one.live), 'every sale of the capture is a v4 sale holding its NFT, not done').toBe(true);
    for (const one of listings) {
      expect(typeof one.price).toBe('bigint');
      expect(one.sale).toMatch(/^0:[0-9a-f]{64}$/);
      expect(one.collection).toMatch(/^0:[0-9a-f]{64}$/);
      expect(one.feePercent + one.royaltyPercent).toBeLessThanOrEqual(100_000);
    }
    expect(listings.filter((one: any) => one.name).length, 'names come from the answer\'s metadata').toBeGreaterThan(0);
  });

  it('NFTM-02: nothing that is not a live v4 sale holding its NFT is ever offered — done, another code, its NFT gone, no price, shares past the whole', () => {
    const live = (row: any) => parseSales({ nft_sales: [row], metadata: {} })[0]?.live;
    expect(live(sale())).toBe(true);
    expect(live(sale({}, { is_complete: true })), 'sold or cancelled').toBe(false);
    expect(live(sale({ code_hash: 'AAAA' + GETGEMS_SALE_V4_CODE_HASH.slice(4) })), 'not Getgems\' v4 code: a lookalike').toBe(false);
    expect(live(sale({ type: 'getgems_auction' })), 'an auction is not a fix-price buy').toBe(false);
    expect(live(sale({}, {}, { owner_address: '0:' + '11'.repeat(32) })), 'the NFT no longer on the sale').toBe(false);
    expect(live(sale({}, { full_price: '0' }))).toBe(false);
    expect(live(sale({}, { marketplace_fee: '60000', royalty_amount: '50000' })), 'shares over the whole throw in the contract (451)').toBe(false);
    expect(parseSales({ nft_sales: [sale({}, { full_price: 'not a number' })] }), 'an unreadable price: not a listing at all').toEqual([]);
  });

  it('NFTM-03: the feed is two calls — the deployer\'s transfers, then their sales, newest first; an aborted transfer is no listing; a refusal throws its status', async () => {
    const transfers = structuredClone(fixture.transfers);
    transfers.nft_transfers[1].transaction_aborted = true;
    const { asked, fetchImpl } = answer(transfers, fixture.sales);
    const { listings, more } = await readLatestListings({ fetchImpl, origin: 'https://o', limit: 8 });
    expect(asked).toHaveLength(2);
    expect(asked[0]).toBe(latestListingsUrl('https://o', { limit: 8 }));
    const aborted = transfers.nft_transfers[1].new_owner;
    expect(asked[1]).not.toContain(encodeURIComponent(aborted));
    const expected = transfers.nft_transfers.filter((row: any) => !row.transaction_aborted).map((row: any) => row.new_owner.toLowerCase());
    expect(listings.map((one: any) => one.sale)).toEqual(expected);
    expect(more, 'a full page: the feed has more').toBe(true);
    await expect(readLatestListings({ fetchImpl: answer({ status: 429 }).fetchImpl, origin: 'https://o' })).rejects.toMatchObject({ status: 429 });
    const fresh = await readSaleFresh({ fetchImpl: answer(fixture.sales).fetchImpl, origin: 'https://o', sale: fixture.sales.nft_sales[2].address });
    expect(fresh?.sale).toBe(fixture.sales.nft_sales[2].address.toLowerCase());
  });

  it('NFTM-04: the split is the contract\'s — MEASURED in @ton/sandbox on live code: 10 GRAM at 5 % + 5 % paid 9 / 0.5 / 0.5, 15000 at 2 % paid 14700 / 300', () => {
    const at = (price: bigint, fee: number, royalty: number, royaltyAddress: string | null = '0:' + '22'.repeat(32)) =>
      priceSplit({ price, feePercent: fee, royaltyPercent: royalty, feeAddress: '0:' + '33'.repeat(32), royaltyAddress });
    expect(at(10n * GRAM, 5000, 5000)).toEqual({ seller: 9n * GRAM, fee: GRAM / 2n, royalty: GRAM / 2n });
    expect(at(15000n * GRAM, 2000, 0, null)).toEqual({ seller: 14700n * GRAM, fee: 300n * GRAM, royalty: 0n });
    expect(at(1_200_000_000n, 5000, 7500)).toEqual({ seller: 1_050_000_000n, fee: 60_000_000n, royalty: 90_000_000n });
    expect(buyValue({ price: 10n * GRAM }), 'the price and the sale\'s 0.1 GRAM of gas').toBe(10n * GRAM + 100_000_000n);
    expect(NFT_BUY_GAS).toBe(100_000_000n);
  });

  it('NFTM-05: a stranger\'s name is cut and loses the controls that turn text round; a picture only through toncenter\'s proxy', () => {
    const row = sale();
    const nft = row.nft_address;
    const [one] = parseSales({ nft_sales: [row], metadata: { [nft]: { token_info: [{ valid: true, type: 'nft_items', name: 'evil‮txt.exe', image: 'https://evil.example/x.png' }] } } });
    expect(one.name).toBe('eviltxt.exe');
    expect(one.picture, 'a picture from anywhere is not drawn').toBe('');
  });

  it('NFTM-06: the feed is the deployer\'s outgoing transfers, newest first; a sales call asks a page at most', () => {
    const url = latestListingsUrl('https://o');
    expect(url).toContain(`owner_address=${encodeURIComponent(GETGEMS_SALE_DEPLOYER)}`);
    expect(url).toContain('direction=out');
    expect(url).toContain('sort=desc');
    const many = Array.from({ length: NFT_SALES_MAX + 20 }, (_, i) => `0:${String(i).padStart(64, '0')}`);
    expect(salesUrl('https://o', many).split('address=').length - 1).toBe(NFT_SALES_MAX);
  });
});
