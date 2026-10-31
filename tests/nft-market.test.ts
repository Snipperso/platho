import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  GETGEMS_SALE_DEPLOYER, GETGEMS_SALE_V4_CODE_HASH, NFT_BUY_GAS, NFT_COLLECTION_PAGE, NFT_PINNED_COLLECTIONS, NFT_SALES_MAX, buyValue, latestListingsUrl, parseSales, priceSplit,
  nftIndexOfName, readCollectionNames, readListingsByIndex, readSalesNow,
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
    expect(NFT_COLLECTION_PAGE, 'a collection\'s page is one sales call').toBeLessThanOrEqual(NFT_SALES_MAX);
  });

  it('NFTM-09: several sales read at once by their addresses, one call; a sale toncenter names none of is absent [2026-10-30]', async () => {
    const { asked, fetchImpl } = answer(fixture.sales);
    const ids = fixture.sales.nft_sales.slice(0, 2).map((row: any) => row.address);
    const gone = `0:${'9'.repeat(64)}`;
    const now = await readSalesNow({ fetchImpl, origin: 'https://o', sales: [...ids, gone] });
    expect(asked).toHaveLength(1);
    expect([...now.keys()].sort()).toEqual(ids.map((id: string) => id.toLowerCase()).sort());
    expect(now.has(gone)).toBe(false);
    expect((await readSalesNow({ fetchImpl, origin: 'https://o', sales: [] })).size, 'nothing asked, nothing read').toBe(0);
  });

  it('NFTM-11: a name typed is its item\'s index — a username\'s, a number\'s by its digits, a domain\'s by its cell — as the chain has them (live items, 2026-10-30); anything else none', () => {
    const [usernames, numbers, domains] = NFT_PINNED_COLLECTIONS;
    const username = BigInt(`0x${createHash('sha256').update('platho_example').digest('hex')}`).toString();
    for (const typed of ['platho_example', '@Platho_Example', ' platho_example.t.me ']) expect(nftIndexOfName(usernames, typed), typed).toBe(username);
    const number = BigInt(`0x${createHash('sha256').update('88801234567').digest('hex')}`).toString();
    for (const typed of ['0123 4567', '+888 0123 4567', '88801234567', '(888) 0123-4567']) expect(nftIndexOfName(numbers, typed), typed).toBe(number);
    const cell = Buffer.concat([Buffer.from([0, 'example'.length * 2]), Buffer.from('example')]);
    const domain = BigInt(`0x${createHash('sha256').update(cell).digest('hex')}`).toString();
    for (const typed of ['example', 'example.ton', 'EXAMPLE.TON']) expect(nftIndexOfName(domains, typed), typed).toBe(domain);
    for (const [collection, typed] of [[usernames, 'abc'], [usernames, 'two words'], [numbers, '0123 456'], [numbers, 'platho_example'], [domains, 'abc'], [domains, 'a_b_c.ton'], ['0:' + 'ab'.repeat(32), 'platho_example']]) {
      expect(nftIndexOfName(collection, typed), `${collection.slice(0, 6)} ${typed}`).toBeNull();
    }
  });

  it('NFTM-12: listings by index — the items of one collection asked by their indexes, their owners read as sales; only a live sale of that collection, at an index asked', async () => {
    const [usernames] = NFT_PINNED_COLLECTIONS;
    const base = structuredClone(fixture.sales.nft_sales[0]);
    const owner = base.nft_item.owner_address;
    const items = { nft_items: [{ index: '7', owner_address: owner }, { index: '8', owner_address: '0:' + 'cd'.repeat(32) }] };
    const sales = { nft_sales: [
      sale({}, {}, { index: '7', collection_address: usernames }),
      sale({ address: '0:' + 'cd'.repeat(32) }, {}, { index: '9', collection_address: usernames, owner_address: '0:' + 'cd'.repeat(32) }),
    ], metadata: {} };
    const { asked, fetchImpl } = answer(items, sales);
    const { listings: found, onSale } = await readListingsByIndex({ fetchImpl, origin: 'https://o', collection: usernames, indexes: ['7', '8', '7'] });
    expect(onSale, 'none marked on sale in the answer').toBe(0);
    expect(asked[0]).toBe(`https://o/api/v3/nft/items?collection_address=${encodeURIComponent(usernames)}&index=7&index=8&limit=2`);
    expect(asked[1]).toContain('/api/v3/nft/sales?');
    expect(found.map((one: any) => one.index), 'the index not asked is no answer').toEqual(['7']);
    const other = answer(items, { nft_sales: [sale({}, {}, { index: '7', collection_address: '0:' + 'ef'.repeat(32) })], metadata: {} });
    expect((await readListingsByIndex({ fetchImpl: other.fetchImpl, origin: 'https://o', collection: usernames, indexes: ['7'] })).listings, 'another collection\'s').toEqual([]);
    const auction = answer({ nft_items: [{ index: '7', owner_address: '0:' + '12'.repeat(32), on_sale: true }] }, { nft_sales: [], metadata: {} });
    expect(await readListingsByIndex({ fetchImpl: auction.fetchImpl, origin: 'https://o', collection: usernames, indexes: ['7'] })).toEqual({ listings: [], onSale: 1 });
    const none = answer({ nft_items: [] });
    expect(await readListingsByIndex({ fetchImpl: none.fetchImpl, origin: 'https://o', collection: usernames, indexes: ['5'] }), 'no item: no name').toEqual({ listings: [], onSale: 0 });
    expect(none.asked, 'one call where no item is').toHaveLength(1);
  });

  it('NFTM-10: the pinned collections are three raw addresses; their names and pictures in one call, a stranger\'s text cut [2026-10-30]', async () => {
    expect(NFT_PINNED_COLLECTIONS.every((one: string) => /^0:[0-9a-f]{64}$/.test(one))).toBe(true);
    const [usernames] = NFT_PINNED_COLLECTIONS;
    const { asked, fetchImpl } = answer({ nft_collections: [{ address: usernames.toUpperCase() }], metadata: { [usernames.toUpperCase()]: { token_info: [{ valid: true, name: 'Telegram\u202eUsernames' }] } } });
    const named = await readCollectionNames({ fetchImpl, origin: 'https://o', collections: NFT_PINNED_COLLECTIONS });
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain('/api/v3/nft/collections?collection_address=');
    expect(named.get(usernames)?.name).toBe('TelegramUsernames');
  });

  it('NFTM-08: a TON DNS item the index names nothing is named by its own domain, written on chain [2026-10-30: "UQCrY3…" over a "?"]', () => {
    const row = sale({}, {}, { content: { domain: 'example-domain.ton' } });
    const [named] = parseSales({ nft_sales: [row], metadata: { [row.nft_address]: { token_info: [{ valid: true, type: 'nft_items', extra: { domain: 'example-domain.ton' } }] } } });
    expect([named.name, named.domain]).toEqual(['example-domain.ton', 'example-domain.ton']);
    const [spoof] = parseSales({ nft_sales: [sale({}, {}, { content: { domain: 'evil\u202e.ton' } })], metadata: {} });
    expect(spoof.domain, 'cut as every stranger\'s text').toBe('evil.ton');
    const [plain] = parseSales({ nft_sales: [sale()], metadata: {} });
    expect(plain.domain).toBe('');
  });

  it('NFTM-07: one collection\'s page, and the older pages by a cursor below the page shown [round 84 — C5-1: asked by an offset from a head that moved, a press added none, or newer rows under older]', async () => {
    const collection = parseSales(fixture.sales)[0].collection;
    const transfers = structuredClone(fixture.transfers);
    transfers.nft_transfers.forEach((row: any, at: number) => { row.transaction_lt = String(90_000 - at * 10); });
    const { asked, fetchImpl } = answer(transfers, fixture.sales);
    const page = await readLatestListings({ fetchImpl, origin: 'https://o', limit: 100, collection, endLt: '12345' });
    expect(asked[0]).toBe(latestListingsUrl('https://o', { limit: 100, collection, endLt: '12345' }));
    expect(asked[0]).toContain(`collection_address=${encodeURIComponent(collection)}`);
    expect(asked[0]).toContain('end_lt=12345');
    expect(asked[0], 'the cursor, never an offset beside it').toContain('&offset=0');
    expect(page.listings.length).toBeGreaterThan(0);
    expect(page.listings.every((one: any) => one.collection === collection), 'another collection\'s listing is not this one\'s').toBe(true);
    expect(page.sales, 'every sale the page named, live or not').toHaveLength(transfers.nft_transfers.length);
    expect(page.cursor, 'the next page: below the least transfer of this one').toBe(String(90_000 - (transfers.nft_transfers.length - 1) * 10 - 1));
    const first = transfers.nft_transfers.find((row: any) => row.new_owner.toLowerCase() === page.listings[0].sale);
    expect(page.listings[0].listedAt).toBe(first.transaction_now);
    expect([page.more, page.newestAt >= page.oldestAt, page.oldestAt > 0]).toEqual([false, true, true]);
    const empty = await readLatestListings({ fetchImpl: answer({ nft_transfers: [] }).fetchImpl, origin: 'https://o' });
    expect(empty).toMatchObject({ listings: [], sales: [], cursor: null, more: false });
  });
});
