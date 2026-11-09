import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Address, Cell, beginCell as tonBeginCell } from '@ton/core';
import {
  GETGEMS_FEE_ADDRESS, GETGEMS_SALE_DEPLOYER, GETGEMS_SALE_V4_CODE_HASH, NFT_BUY_GAS, NFT_COLLECTION_PAGE, NFT_PINNED_COLLECTIONS, NFT_SALES_MAX, buildListing, buyValue,
  latestListingsUrl, parseSaleV4Data, parseSales, priceSplit, nftIndexOfName, readCollectionNames, readListingsByIndex, readListingsChanged, readSalesNow,
  readLatestListings, readSaleFresh, saleStatesUrl, salesUrl,
} from '../web/nft-market.mjs';
import { serializeBoc } from '../web/pwa-contract-transactions.mjs';
import { NFT_COLLECTIONS_COUNT, approvedNftCollections, isApprovedNftCollection } from '../web/nft-collections.mjs';
import { listedNftCollection } from '../web/wallet-assets.mjs';


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
const v4Data = (d: { complete?: boolean, marketplace: string, seller: string, price: bigint, feeAddress: string, royaltyAddress: string | null, feePercent: number,
  royaltyPercent: number, nft: string, createdAt: number }) => {
  const fees = tonBeginCell().storeAddress(Address.parse(d.feeAddress)).storeAddress(d.royaltyAddress ? Address.parse(d.royaltyAddress) : null)
    .storeUint(d.feePercent, 17).storeUint(d.royaltyPercent, 17).storeAddress(Address.parse(d.nft)).storeUint(d.createdAt, 32).endCell();
  return tonBeginCell().storeBit(Boolean(d.complete)).storeAddress(Address.parse(d.marketplace)).storeAddress(Address.parse(d.seller)).storeCoins(d.price)
    .storeUint(0, 32).storeUint(0, 64).storeRef(fees).storeBit(false).storeBit(true).storeUint(7n, 256).endCell().toBoc().toString('base64');
};
const saleData = (row: any, over: Record<string, any> = {}) => v4Data({ complete: row.details.is_complete, marketplace: row.marketplace_address, seller: row.nft_owner_address,
  price: BigInt(row.details.full_price), feeAddress: row.details.marketplace_fee_address, royaltyAddress: row.details.royalty_address || null,
  feePercent: Number(row.details.marketplace_fee), royaltyPercent: Number(row.details.royalty_amount), nft: row.nft_address, createdAt: row.created_at, ...over });
const stateOf = (row: any, over: Record<string, any> = {}) => ({
  address: row.address, status: 'active', code_hash: row.code_hash, data_hash: row.data_hash ?? `hash-${row.address.slice(2, 10)}`, data_boc: saleData(row),
  ...over,
});
const emptyCell = () => tonBeginCell().endCell().toBoc().toString('base64');
const states = (rows: any[] = fixture.sales.nft_sales) => ({ accounts: rows.map((row) => stateOf(row)) });
const transfersPage = () => ({ ...structuredClone(fixture.transfers), metadata: structuredClone(fixture.sales.metadata) });

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

  it('NFTM-03: the feed is two calls — the deployer\'s transfers, then their sales\' accounts, newest first; an aborted transfer is no listing; a refusal throws its status', async () => {
    const transfers = transfersPage();
    transfers.nft_transfers[1].transaction_aborted = true;
    const { asked, fetchImpl } = answer(transfers, states());
    const { listings, more } = await readLatestListings({ fetchImpl, origin: 'https://o', limit: 8 });
    expect(asked, 'the newest page asks its NFTs in its sales\' own call [round 108 — C5-1]').toHaveLength(2);
    expect(asked[0]).toBe(latestListingsUrl('https://o', { limit: 8 }));
    expect(asked[1], 'their accounts with their data, not nft/sales').toMatch(/^https:\/\/o\/api\/v3\/accountStates\?address=.*&include_boc=true$/);
    const aborted = transfers.nft_transfers[1].new_owner;
    expect(asked[1]).not.toContain(encodeURIComponent(aborted));
    for (const row of transfers.nft_transfers.filter((one: any) => !one.transaction_aborted)) {
      expect(asked[1], 'each listing\'s sale').toContain(encodeURIComponent(row.new_owner.toLowerCase()));
      expect(asked[1], 'and its NFT, in the one call').toContain(encodeURIComponent(row.nft_address.toLowerCase()));
    }
    for (const options of [{ checkItems: false }, { endLt: '99999' }]) {
      const alone = answer(transfers, states());
      await readLatestListings({ fetchImpl: alone.fetchImpl, origin: 'https://o', limit: 8, ...options });
      expect(alone.asked, JSON.stringify(options)).toHaveLength(2);
      for (const row of transfers.nft_transfers) expect(alone.asked[1], JSON.stringify(options)).not.toContain(encodeURIComponent(row.nft_address.toLowerCase()));
    }
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

  it('NFTM-12: listings by index — the items of one collection asked by their indexes, the data of those on a sale read as sales; only a live sale of that collection, at an index asked', async () => {
    const [usernames] = NFT_PINNED_COLLECTIONS;
    const base = structuredClone(fixture.sales.nft_sales[0]);
    const row = (index: string, over: Record<string, any> = {}) => ({ address: base.nft_address, index, collection_address: usernames, owner_address: base.address,
      real_owner: base.nft_owner_address, on_sale: true, ...over });
    const items = { nft_items: [row('7'), row('8', { address: '0:' + 'cd'.repeat(32), owner_address: '0:' + 'ce'.repeat(32) })], metadata: {} };
    const { asked, fetchImpl } = answer(items, states([base]));
    const { listings: found, onSale } = await readListingsByIndex({ fetchImpl, origin: 'https://o', collection: usernames, indexes: ['7', '8', '7'] });
    expect(onSale, 'both marked on sale').toBe(2);
    expect(asked[0]).toBe(`https://o/api/v3/nft/items?collection_address=${encodeURIComponent(usernames)}&index=7&index=8&limit=2`);
    expect(asked[1], 'their owners\' data, as the feed reads its sales').toMatch(/\/api\/v3\/accountStates\?.*&include_boc=true$/);
    expect(found.map((one: any) => [one.index, one.kind, one.sale]), 'an owner the index names no sale of is no listing').toEqual([['7', 'sale', base.address.toLowerCase()]]);
    const other = answer({ nft_items: [row('7', { collection_address: '0:' + 'ef'.repeat(32) })], metadata: {} }, states([base]));
    expect((await readListingsByIndex({ fetchImpl: other.fetchImpl, origin: 'https://o', collection: usernames, indexes: ['7'] })).listings, 'another collection\'s').toEqual([]);
    const elsewhere = answer({ nft_items: [row('7', { owner_address: '0:' + '12'.repeat(32) })], metadata: {} }, { accounts: [{ address: '0:' + '12'.repeat(32), status: 'active',
      code_hash: 'AAAA' + GETGEMS_SALE_V4_CODE_HASH.slice(4), data_hash: 'x', data_boc: saleData(base) }] });
    expect(await readListingsByIndex({ fetchImpl: elsewhere.fetchImpl, origin: 'https://o', collection: usernames, indexes: ['7'] })).toEqual({ listings: [], onSale: 1 });
    const off = answer({ nft_items: [row('7', { on_sale: false })] });
    expect(await readListingsByIndex({ fetchImpl: off.fetchImpl, origin: 'https://o', collection: usernames, indexes: ['7'] }), 'held off sale: no second call').toEqual({ listings: [], onSale: 0 });
    expect(off.asked).toHaveLength(1);
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
    const transfers = transfersPage();
    transfers.nft_transfers.forEach((row: any, at: number) => { row.transaction_lt = String(90_000 - at * 10); });
    const { asked, fetchImpl } = answer(transfers, states());
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

  it('NFTM-13: a page read by its sales\' own data says what nft/sales says of it — every field the market draws and buys by [2026-11-04]', async () => {
    const page = await readLatestListings({ fetchImpl: answer(transfersPage(), states()).fetchImpl, origin: 'https://o', limit: 100 });
    const decoded = new Map(parseSales(fixture.sales).map((one: any) => [one.sale, one]));
    expect(page.listings).toHaveLength(fixture.sales.nft_sales.length);
    const fields = ['sale', 'nft', 'collection', 'seller', 'price', 'feePercent', 'royaltyPercent', 'marketplace', 'feeAddress', 'royaltyAddress', 'createdAt',
      'name', 'domain', 'picture', 'pictureBig', 'pictureKey', 'attributes', 'collectionName', 'collectionPicture', 'live'];
    for (const one of page.listings) {
      const other = decoded.get(one.sale);
      for (const field of fields) expect(one[field], `${one.sale.slice(0, 10)} ${field}`).toEqual(other[field]);
    }
    expect(saleStatesUrl('https://o', Array.from({ length: NFT_SALES_MAX + 20 }, (_, i) => `0:${String(i).padStart(64, '0')}`)).split('address=').length - 1,
      'a call asks a page at most').toBe(NFT_SALES_MAX);
  });

  it('NFTM-14: an item\'s index, its content\'s URI and its domain are the page\'s metadata; a stranger\'s text is cut as ever', async () => {
    const row = fixture.sales.nft_sales[0];
    const transfers = transfersPage();
    transfers.nft_transfers = [transfers.nft_transfers.find((one: any) => one.new_owner === row.address)];
    transfers.metadata[row.nft_address] = { token_info: [{ valid: true, type: 'nft_items', nft_index: '77',
      extra: { uri: 'https://nft.fragment.com/gift/example-77.json', domain: 'example‮.ton' } }] };
    const [one] = (await readLatestListings({ fetchImpl: answer(transfers, states([row])).fetchImpl, origin: 'https://o' })).listings;
    expect([one.index, one.uri, one.domain, one.name]).toEqual(['77', 'https://nft.fragment.com/gift/example-77.json', 'example.ton', 'example.ton']);
    const keyed = async (image: unknown) => {
      transfers.metadata[row.nft_address] = { token_info: [{ valid: true, type: 'nft_items', name: 'Example #1', image }] };
      return (await readLatestListings({ fetchImpl: answer(transfers, states([row])).fetchImpl, origin: 'https://o' })).listings[0];
    };
    const shared = await keyed('https://cdn.example.com/1/12.png?v=3');
    expect([shared.pictureKey, shared.picture], 'a key, not a picture: only toncenter\'s copies are drawn').toEqual(['https://cdn.example.com/1/12.png?v=3', '']);
    for (const image of ['http://cdn.example.com/12.png', 'data:image/png;base64,AAAA', `https://cdn.example.com/${'a'.repeat(520)}`, 7]) expect((await keyed(image)).pictureKey, String(image).slice(0, 30)).toBe('');
  });

  it('NFTM-15: only a live v4 sale of the NFT it was handed is offered, read from its own data — done, another code, not active, another NFT, no price, shares past the whole, bytes of another shape', async () => {
    const row = fixture.sales.nft_sales[0];
    const transfers = transfersPage();
    transfers.nft_transfers = [transfers.nft_transfers.find((one: any) => one.new_owner === row.address)];
    const live = async (over: Record<string, any>) => (await readLatestListings({ fetchImpl: answer(transfers, { accounts: [stateOf(row, over)] }).fetchImpl,
      origin: 'https://o' })).listings.length === 1;
    expect(await live({})).toBe(true);
    expect(await live({ data_boc: saleData(row, { complete: true }) }), 'sold or cancelled').toBe(false);
    expect(await live({ code_hash: 'AAAA' + GETGEMS_SALE_V4_CODE_HASH.slice(4) }), 'another code: an auction, a lookalike').toBe(false);
    expect(await live({ status: 'frozen' })).toBe(false);
    expect(await live({ data_boc: saleData(row, { nft: '0:' + '12'.repeat(32) }) }), 'a sale of another NFT than the one handed to it').toBe(false);
    expect(await live({ data_boc: saleData(row, { price: 0n }) })).toBe(false);
    expect(await live({ data_boc: saleData(row, { feePercent: 60_000, royaltyPercent: 50_000 }) }), 'shares past the whole throw in the contract (451)').toBe(false);
    expect(await live({ data_boc: emptyCell() }), 'bytes that are not a v4 sale\'s').toBe(false);
    expect(await live({ data_boc: undefined }), 'no bytes').toBe(false);
  });

  it('NFTM-16: a sale\'s data as this app writes it (buildListing) reads back as written — a royalty to nobody too; anything else is null', async () => {
    const nft = '0:' + '11'.repeat(32);
    const seller = '0:' + '22'.repeat(32);
    for (const royaltyAddress of ['0:' + '33'.repeat(32), null]) {
      const listing = await buildListing({ nft, seller, price: 5n * GRAM, feePercent: 1000, royaltyAddress, royaltyPercent: royaltyAddress ? 5000 : 0,
        createdAt: 1_800_000_000, queryId: 9n, secretKey: new Uint8Array(32).fill(3) });
      const data = Cell.fromBoc(Buffer.from(serializeBoc(listing.body)))[0].refs[0].refs[0].refs[1];
      expect(parseSaleV4Data(data.toBoc().toString('base64'))).toEqual({ complete: false, marketplace: GETGEMS_SALE_DEPLOYER, seller, price: 5n * GRAM, soldAt: 0,
        feeAddress: GETGEMS_FEE_ADDRESS, royaltyAddress, feePercent: 1000, royaltyPercent: royaltyAddress ? 5000 : 0, nft, createdAt: 1_800_000_000 });
    }
    expect(parseSaleV4Data(emptyCell())).toBeNull();
    expect(parseSaleV4Data('')).toBeNull();
    expect(parseSaleV4Data('not a boc')).toBeNull();
  });

  it('NFTM-17: listings asked again lightly — one call without the bytes; what changed is read again with them; a sale of another code, not active or not answered is gone [2026-11-04]', async () => {
    const rows = fixture.sales.nft_sales.slice(0, 4);
    const page = await readLatestListings({ fetchImpl: answer(transfersPage(), states()).fetchImpl, origin: 'https://o', limit: 100 });
    const held = rows.map((row: any) => page.listings.find((one: any) => one.sale === row.address.toLowerCase()));
    const light = { accounts: [
      { ...stateOf(rows[0]), data_boc: undefined },
      { ...stateOf(rows[1]), data_hash: 'moved', data_boc: undefined },
      { ...stateOf(rows[2]), code_hash: 'other', data_boc: undefined },
    ] };
    const repriced = { accounts: [stateOf(rows[1], { data_hash: 'moved', data_boc: saleData(rows[1], { price: GRAM }) })] };
    const { asked, fetchImpl } = answer(light, repriced);
    const changed = await readListingsChanged({ fetchImpl, origin: 'https://o', listings: held });
    expect(asked).toEqual([saleStatesUrl('https://o', [...held.map((one: any) => one.sale), ...held.map((one: any) => one.nft)], { boc: false, max: 2 * NFT_SALES_MAX }),
      saleStatesUrl('https://o', [held[1].sale])]);
    expect([asked[0].endsWith('&include_boc=false'), asked[1].endsWith('&include_boc=true')], 'the bytes only for what changed').toEqual([true, true]);
    expect(changed.has(held[0].sale), 'as read: not asked again').toBe(false);
    expect(changed.get(held[1].sale)).toMatchObject({ price: GRAM, dataHash: 'moved', name: held[1].name, listedAt: held[1].listedAt, live: true });
    expect([changed.get(held[2].sale), changed.get(held[3].sale)]).toEqual([null, null]);
    const sold = answer({ accounts: [{ ...stateOf(rows[0]), data_hash: 'done', data_boc: undefined }] }, { accounts: [stateOf(rows[0], { data_hash: 'done', data_boc: saleData(rows[0], { complete: true }) })] });
    expect((await readListingsChanged({ fetchImpl: sold.fetchImpl, origin: 'https://o', listings: [held[0]] })).get(held[0].sale), 'sold since').toBeNull();
    const still = answer({ accounts: [{ ...stateOf(rows[0]), data_boc: undefined }] });
    expect((await readListingsChanged({ fetchImpl: still.fetchImpl, origin: 'https://o', listings: [held[0]] })).size).toBe(0);
    expect(still.asked, 'nothing changed: one call').toHaveLength(1);
    expect((await readListingsChanged({ fetchImpl: still.fetchImpl, origin: 'https://o', listings: [] })).size, 'nothing asked, nothing read').toBe(0);
  });

  it('NFTM-19: a listing stands only while its NFT is on its sale — asked with the cards: untouched since the transfer onto it, or named the sale\'s by the index; one taken off by another leaves [round 106 — C10]', async () => {
    const rows = fixture.sales.nft_sales.slice(0, 3);
    const transfers = transfersPage();
    transfers.nft_transfers = rows.map((row: any) => transfers.nft_transfers.find((one: any) => one.new_owner === row.address));
    transfers.nft_transfers.forEach((one: any, at: number) => { one.transaction_lt = String(5_000 + at); });
    const page = await readLatestListings({ fetchImpl: answer(transfers, states(rows)).fetchImpl, origin: 'https://o', limit: 100 });
    expect(page.listings.map((one: any) => one.itemLt), 'each with the transfer onto its sale, its NFT\'s own transaction').toEqual(['5000', '5001', '5002']);
    const other = '0:' + '17'.repeat(32);
    const light = { accounts: [...rows.map((row: any) => ({ ...stateOf(row), data_boc: undefined })), { address: rows[0].nft_address, last_transaction_lt: '5000' },
      { address: rows[1].nft_address, last_transaction_lt: '9001' }, { address: rows[2].nft_address, last_transaction_lt: '9002' }] };
    const owners = { nft_items: [{ address: rows[1].nft_address, owner_address: other }, { address: rows[2].nft_address, owner_address: rows[2].address }] };
    const { asked, fetchImpl } = answer(light, owners);
    const changed = await readListingsChanged({ fetchImpl, origin: 'https://o', listings: page.listings });
    const [kept, gone, moved] = page.listings;
    expect([changed.has(kept.sale), changed.get(gone.sale), changed.get(moved.sale)?.itemLt]).toEqual([false, null, '9002']);
    expect(asked[1], 'only the moved NFTs asked of the index').toBe(`https://o/api/v3/nft/items?address=${encodeURIComponent(rows[1].nft_address.toLowerCase())}&address=${encodeURIComponent(rows[2].nft_address.toLowerCase())}&limit=2`);
    const quiet = answer({ accounts: rows.map((row: any) => ({ ...stateOf(row), data_boc: undefined })) });
    expect((await readListingsChanged({ fetchImpl: quiet.fetchImpl, origin: 'https://o', listings: page.listings })).size).toBe(0);
    expect(quiet.asked).toHaveLength(1);
    expect(parseSales({ nft_sales: [sale({}, {}, { last_transaction_lt: '777' })], metadata: {} })[0].itemLt).toBe('777');
  });

  it('NFTM-21: the newest page — a head, read again each beat and left out of the recheck — drops a sale whose NFT another took; an older page leaves it to the sweep [round 107 — C1-1]', async () => {
    const rows = fixture.sales.nft_sales.slice(0, 2);
    const transfers = transfersPage();
    transfers.nft_transfers = rows.map((row: any) => transfers.nft_transfers.find((one: any) => one.new_owner === row.address));
    transfers.nft_transfers.forEach((one: any, at: number) => { one.transaction_lt = String(7_000 + at); });
    const items = [{ address: rows[0].nft_address, status: 'active', last_transaction_lt: '7000' }, { address: rows[1].nft_address, status: 'active', last_transaction_lt: '9999' }];
    const owners = { nft_items: [{ address: rows[1].nft_address, owner_address: '0:' + '17'.repeat(32) }] };
    const head = answer(transfers, { accounts: [...states(rows).accounts, ...items] }, owners);
    const page = await readLatestListings({ fetchImpl: head.fetchImpl, origin: 'https://o', limit: 100 });
    expect(page.listings.map((one: any) => one.sale)).toEqual([rows[0].address.toLowerCase()]);
    expect(page.sales, 'judged, so a view drops what it held of it').toContain(rows[1].address.toLowerCase());
    expect(head.asked, 'the page, its sales and NFTs in one call, the moved NFT\'s owner').toHaveLength(3);
    expect(head.asked[2]).toContain(encodeURIComponent(rows[1].nft_address.toLowerCase()));
    expect(head.asked[2]).not.toContain(encodeURIComponent(rows[0].nft_address.toLowerCase()));
    const many = transfersPage();
    const hex = (n: number, pad: string) => '0:' + pad.repeat(56) + n.toString(16).padStart(8, '0');
    many.nft_transfers = Array.from({ length: 100 }, (_, at) => ({ ...transfers.nft_transfers[0], new_owner: hex(at, 'a'), nft_address: hex(at, 'b'), transaction_lt: String(9_000 + at) }));
    const full = answer(many, { accounts: [] });
    await readLatestListings({ fetchImpl: full.fetchImpl, origin: 'https://o', limit: 100 });
    for (let at = 0; at < 100; at += 1) {
      expect(full.asked[1]).toContain(encodeURIComponent(hex(at, 'a')));
      expect(full.asked[1]).toContain(encodeURIComponent(hex(at, 'b')));
    }
    const still = answer(transfers, { accounts: [...states(rows).accounts, { ...items[1], last_transaction_lt: '7001' }, items[0]] });
    expect((await readLatestListings({ fetchImpl: still.fetchImpl, origin: 'https://o', limit: 100 })).listings).toHaveLength(2);
    expect(still.asked).toHaveLength(2);
    const older = answer(transfers, states(rows));
    expect((await readLatestListings({ fetchImpl: older.fetchImpl, origin: 'https://o', limit: 100, endLt: '99999' })).listings).toHaveLength(2);
    expect(older.asked, 'an older page: two calls').toHaveLength(2);
  });

  it('NFTM-22: the newest page\'s still-on-sale check follows the page — its NFTs not answered, or their owners refused, the page stands as read; refused at the page\'s own calls, it does not [round 113 — C5-1]', async () => {
    const rows = fixture.sales.nft_sales.slice(0, 2);
    const transfers = transfersPage();
    transfers.nft_transfers = rows.map((row: any) => transfers.nft_transfers.find((one: any) => one.new_owner === row.address));
    transfers.nft_transfers.forEach((one: any, at: number) => { one.transaction_lt = String(7_000 + at); });
    const both = rows.map((row: any) => row.address.toLowerCase());
    const unnamed = answer(transfers, states(rows));
    const page = await readLatestListings({ fetchImpl: unnamed.fetchImpl, origin: 'https://o', limit: 100 });
    expect(page.listings.map((one: any) => one.sale), 'the index names none of the NFTs: both listings as read').toEqual(both);
    expect(page.sales).toEqual(both);
    expect(unnamed.asked).toHaveLength(2);
    const items = [{ address: rows[0].nft_address, status: 'active', last_transaction_lt: '7000' }, { address: rows[1].nft_address, status: 'active', last_transaction_lt: '9999' }];
    const owners429 = answer(transfers, { accounts: [...states(rows).accounts, ...items] }, { status: 429 });
    const second = await readLatestListings({ fetchImpl: owners429.fetchImpl, origin: 'https://o', limit: 100 });
    expect(second.listings.map((one: any) => one.sale), 'the moved NFT\'s owner refused: the page as read').toEqual(both);
    expect(owners429.asked).toHaveLength(3);
    await expect(readLatestListings({ fetchImpl: answer(transfers, { status: 429 }).fetchImpl, origin: 'https://o', limit: 100 })).rejects.toMatchObject({ status: 429 });
    await expect(readLatestListings({ fetchImpl: answer({ status: 429 }).fetchImpl, origin: 'https://o', limit: 100 })).rejects.toMatchObject({ status: 429 });
  });

  it('NFTM-20: a stranger\'s NFT sent onto a live sale is not the sale — the transfer of the sale\'s own NFT is; a page with only the stranger\'s judges nothing [round 106 — C1-2]', async () => {
    const row = fixture.sales.nft_sales[0];
    const transfers = transfersPage();
    const own = { ...transfers.nft_transfers.find((one: any) => one.new_owner === row.address), transaction_lt: '5000' };
    const stranger = { ...own, nft_address: '0:' + '5a'.repeat(32), transaction_lt: '5010', transaction_now: own.transaction_now + 60 };
    transfers.nft_transfers = [stranger, own];
    const both = await readLatestListings({ fetchImpl: answer(transfers, states([row])).fetchImpl, origin: 'https://o' });
    expect(both.listings.map((one: any) => [one.nft, one.listedAt, one.itemLt])).toEqual([[row.nft_address.toLowerCase(), own.transaction_now, own.transaction_lt]]);
    expect(both.sales).toEqual([row.address.toLowerCase()]);
    transfers.nft_transfers = [stranger];
    const alone = await readLatestListings({ fetchImpl: answer(transfers, states([row])).fetchImpl, origin: 'https://o' });
    expect([alone.listings, alone.sales]).toEqual([[], []]);
    transfers.nft_transfers = [own];
    expect((await readLatestListings({ fetchImpl: answer(transfers, { accounts: [] }).fetchImpl, origin: 'https://o' })).sales).toEqual([]);
  });
  it('NFTM-18: a collection Getgems verifies is genuine wherever the app asks — by its address, never its name: a lookalike named alike is not [MEASURED 2026-11-04: three "Lost Dogs: The Hint", one approved]', () => {
    const lostDogs = '0:e94df19084924c35e9dae2dd0ae9fc4739716ea90f1a2b99f7b52fff7f6ff6a3';
    const lookalike = '0:71ff01a4accf4c9b04048fcd2c77ded56b2b45bae41ffda3631ed76fdadb3bf9';
    expect(isApprovedNftCollection(lostDogs)).toBe(true);
    expect(isApprovedNftCollection(lostDogs.toUpperCase()), 'any case').toBe(true);
    expect(isApprovedNftCollection(lookalike)).toBe(false);
    expect(listedNftCollection(lostDogs), 'the market, the wallet and the sell window take it').toBe(true);
    expect(listedNftCollection(lookalike)).toBe(false);
    expect(isApprovedNftCollection(lostDogs.slice(0, 40)), 'a prefix is no address').toBe(false);
    const rows = approvedNftCollections();
    expect(rows.length).toBe(NFT_COLLECTIONS_COUNT);
    expect(rows.length, 'a list, not a broken answer').toBeGreaterThanOrEqual(100);
    expect(rows.every((one: any, at: number) => at === 0 || rows[at - 1].listed >= one.listed), 'the busiest first').toBe(true);
    expect(rows.every((one: any) => /^0:[0-9a-f]{64}$/.test(one.collection) && typeof one.name === 'string'), 'whole raw addresses').toBe(true);
    const builder = readFileSync('scripts/build_nft_collections.mjs', 'utf8');
    expect(builder).toContain("Array.isArray(row.approved_by) && row.approved_by.includes('getgems')");
    expect(builder).toContain('if (unanswered > ids.length * UNANSWERED_MAX) throw new Error(');
    expect(builder).toContain('if (approved.length < APPROVED_MIN) throw new Error(');
  });
});
