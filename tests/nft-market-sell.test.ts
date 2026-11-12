import { describe, expect, it } from 'vitest';
import { createPublicKey, verify } from 'node:crypto';
import { Address, Cell, beginCell as tonBeginCell } from '@ton/core';
import {
  GETGEMS_AUCTION_V3R3_CODE_HASH, GETGEMS_FEE_ADDRESS, GETGEMS_MARKETPLACE, GETGEMS_SALE_DEPLOYER, GETGEMS_SALE_V4_CODE_HASH, NFT_FEE_MAX, NFT_LIST_FORWARD, NFT_LIST_TO_SALE, NFT_ROYALTY_MAX,
  NFT_ITEM_RESERVE, NFT_PINNED_COLLECTIONS, NFT_SALES_MAX, buildListing, listingTermsFrom, nftCancelBody, nftChangePriceBody,
  nftItemTopUp, readListingsOf, saleV4Code,
} from '../web/nft-market.mjs';
import { beginCell, serializeBoc } from '../web/pwa-contract-transactions.mjs';
import { encodeTonAddressSliceBoc } from '../web/ton-rpc-transport.mjs';
import { readCollectionRoyalty, readNftOwnSaleOn } from '../web/wallet-transfers.mjs';
import { WALLET_LIST_PAGES, WALLET_NFT_PAGE, nftCollectionTransferable, parseNftItems } from '../web/wallet-assets.mjs';


const toTon = (cell: any) => Cell.fromBoc(Buffer.from(serializeBoc(cell)))[0];
const raw = (a: Address | null) => (a ? a.toRawString() : null);
const NFT = '0:1111111111111111111111111111111111111111111111111111111111111111';
const SELLER = '0:2222222222222222222222222222222222222222222222222222222222222222';
const ROYALTY = '0:3333333333333333333333333333333333333333333333333333333333333333';
const COLLECTION = '0:4444444444444444444444444444444444444444444444444444444444444444';
const OTHER = '0:5555555555555555555555555555555555555555555555555555555555555555';
const GRAM = 1_000_000_000n;
const v4Data = (d: Partial<{ complete: boolean, seller: string, price: bigint, nft: string }> = {}) => {
  const v = { complete: false, seller: SELLER, price: GRAM, nft: NFT, ...d };
  const fees = tonBeginCell().storeAddress(Address.parse(OTHER)).storeAddress(null).storeUint(1000, 17).storeUint(0, 17).storeAddress(Address.parse(v.nft))
    .storeUint(1_800_000_000, 32).endCell();
  return tonBeginCell().storeBit(v.complete).storeAddress(Address.parse(OTHER)).storeAddress(Address.parse(v.seller)).storeCoins(v.price)
    .storeUint(0, 32).storeUint(0, 64).storeRef(fees).storeBit(false).storeBit(true).storeUint(7n, 256).endCell().toBoc().toString('base64');
};
const auctionData = (d: Partial<{ ended: boolean, seller: string, nft: string, endTime: number }> = {}) => {
  const v = { ended: false, seller: SELLER, nft: NFT, endTime: Math.floor(Date.now() / 1000) + 86_400, ...d };
  const fees = tonBeginCell().storeAddress(Address.parse(OTHER)).storeAddress(Address.parse(ROYALTY)).endCell();
  const constants = tonBeginCell().storeAddress(Address.parse(OTHER)).storeCoins(20n * GRAM).storeCoins(100n * GRAM).storeUint(5, 7).storeUint(300, 17)
    .storeAddress(Address.parse(v.nft)).storeUint(1_800_000_000, 32).endCell();
  return tonBeginCell().storeInt(v.ended ? -1 : 0, 1).storeInt(0, 1).storeAddress(null).storeCoins(0n).storeUint(0, 32).storeUint(v.endTime, 32)
    .storeAddress(Address.parse(v.seller)).storeUint(0, 64).storeUint(5, 32).storeUint(100, 32).storeUint(75, 32).storeUint(1000, 32)
    .storeRef(fees).storeRef(constants).endCell().toBoc().toString('base64');
};
const ed25519Spki = (raw32: Buffer) => createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), raw32]), format: 'der', type: 'spki' });

describe('selling — the listing', () => {
  it('NFTSELL-01: the transfer is the marketplace\'s own shape — to the deployer, 0.2 forward, do_sale with the v4 sale and its deploy_jetton; the sale\'s address is its first state\'s hash', async () => {
    const secretKey = new Uint8Array(32).fill(7);
    const listing = await buildListing({ nft: NFT, seller: SELLER, price: 3n * GRAM, feePercent: 1000, royaltyAddress: ROYALTY, royaltyPercent: 5000,
      createdAt: 1_800_000_000, queryId: 42n, secretKey });
    const t = toTon(listing.body).beginParse();
    expect(t.loadUint(32)).toBe(0x5fcc3d14);
    expect(t.loadUintBig(64)).toBe(42n);
    expect(raw(t.loadAddress())).toBe(GETGEMS_SALE_DEPLOYER);
    expect(raw(t.loadAddress())).toBe(SELLER);
    expect(t.loadBit()).toBe(false);
    expect(t.loadCoins()).toBe(NFT_LIST_FORWARD);
    expect(t.loadBit(), 'the forward payload in a ref, as the marketplace\'s').toBe(true);
    const p = t.loadRef().beginParse();
    expect(p.loadUint(32)).toBe(0x00fe0ede);
    const stateInit = p.loadRef();
    const body = p.loadRef();
    expect(p.loadCoins()).toBe(NFT_LIST_TO_SALE);
    expect(listing.sale).toBe(`0:${stateInit.hash().toString('hex')}`);

    const si = stateInit.beginParse();
    expect([si.loadBit(), si.loadBit()]).toEqual([false, false]);
    const code = si.loadMaybeRef()!;
    const data = si.loadMaybeRef()!;
    expect(si.loadBit()).toBe(false);
    expect(code.hash().toString('base64')).toBe(GETGEMS_SALE_V4_CODE_HASH);
    const d = data.beginParse();
    expect(d.loadUint(1)).toBe(0);
    expect(raw(d.loadAddress()), 'the deployer first: deploy_jetton is taken only from it').toBe(GETGEMS_SALE_DEPLOYER);
    expect(raw(d.loadAddress())).toBe(SELLER);
    expect(d.loadCoins()).toBe(3n * GRAM);
    expect(d.loadUint(32)).toBe(0);
    expect(d.loadUintBig(64)).toBe(0n);
    const st = d.loadRef().beginParse();
    expect(raw(st.loadAddress())).toBe(GETGEMS_FEE_ADDRESS);
    expect(raw(st.loadAddress())).toBe(ROYALTY);
    expect([st.loadUint(17), st.loadUint(17)]).toEqual([1000, 5000]);
    expect(raw(st.loadAddress())).toBe(NFT);
    expect(st.loadUint(32)).toBe(1_800_000_000);
    expect(d.loadBit(), 'no jetton prices').toBe(false);
    expect(d.loadUint(1)).toBe(1);
    const publicKey = d.loadBuffer(32);
    expect(Buffer.from(listing.publicKey).equals(publicKey)).toBe(true);

    const b = body.beginParse();
    expect(b.loadUint(32)).toBe(0xfb5dbf47);
    expect(b.loadUintBig(64)).toBe(42n);
    const signature = b.loadBuffer(64);
    const signed = b.asCell();
    expect(verify(null, signed.hash(), ed25519Spki(publicKey), signature), 'the sale\'s check_signature over slice_hash(rest)').toBe(true);
    const rest = signed.beginParse();
    expect(raw(rest.loadAddress())).toBe(GETGEMS_MARKETPLACE);
    expect(rest.loadBit()).toBe(false);
    expect(rest.remainingBits).toBe(0);
  });

  it('NFTSELL-02: no royalty is addr_none; each listing\'s key is its own; out-of-bounds terms and a bad key are refused before anything is built', async () => {
    const base = { nft: NFT, seller: SELLER, price: GRAM, feePercent: 2000, createdAt: 1, queryId: 1n };
    const a = await buildListing({ ...base, secretKey: new Uint8Array(32).fill(1) });
    const d = toTon(a.body).beginParse();
    d.loadUint(32); d.loadUintBig(64); d.loadAddress(); d.loadAddress(); d.loadBit(); d.loadCoins(); d.loadBit();
    const p = d.loadRef().beginParse(); p.loadUint(32);
    const data = p.loadRef().beginParse(); data.loadBit(); data.loadBit(); data.loadMaybeRef();
    const st = data.loadMaybeRef()!.beginParse(); st.loadUint(1); st.loadAddress(); st.loadAddress(); st.loadCoins(); st.loadUint(32); st.loadUintBig(64);
    const terms = st.loadRef().beginParse(); terms.loadAddress();
    expect(terms.loadAddressAny()).toBeNull();
    const b = await buildListing({ ...base, secretKey: new Uint8Array(32).fill(2) });
    expect(Buffer.from(a.publicKey).equals(Buffer.from(b.publicKey))).toBe(false);
    expect(a.sale).not.toBe(b.sale);
    await expect(buildListing({ ...base, price: 0n, secretKey: new Uint8Array(32) })).rejects.toThrow('a listing needs a price');
    await expect(buildListing({ ...base, feePercent: NFT_FEE_MAX + 1, secretKey: new Uint8Array(32) })).rejects.toThrow('the fee is out of bounds');
    await expect(buildListing({ ...base, royaltyAddress: ROYALTY, royaltyPercent: NFT_ROYALTY_MAX + 1, secretKey: new Uint8Array(32) })).rejects.toThrow('the royalty is out of bounds');
    await expect(buildListing({ ...base, secretKey: new Uint8Array(31) })).rejects.toThrow('the listing key must be 32 bytes');
    expect((await saleV4Code()).refs.length).toBeGreaterThan(0);
  });

  it('NFTSELL-03: a cancel is op 3; a new price is change_price with no jetton prices — as the sale reads them', () => {
    const c = toTon(nftCancelBody(9n)).beginParse();
    expect([c.loadUint(32), c.loadUintBig(64), c.remainingBits]).toEqual([3, 9n, 0]);
    const n = toTon(nftChangePriceBody(9n, 2n * GRAM)).beginParse();
    expect([n.loadUint(32), n.loadUintBig(64), n.loadCoins(), n.loadBit(), n.remainingBits]).toEqual([0xfd135f7b, 9n, 2n * GRAM, false, 0]);
    expect(() => nftChangePriceBody(1n, 0n)).toThrow('a listing needs a price');
  });
});

describe('selling — the terms a listing takes', () => {
  const listing = (over: Record<string, any> = {}) => ({ live: true, collection: COLLECTION, marketplace: GETGEMS_MARKETPLACE, feeAddress: GETGEMS_FEE_ADDRESS,
    feePercent: 1000, royaltyAddress: ROYALTY, royaltyPercent: 0, seller: SELLER, ...over });
  const sellers = (n: number, over: Record<string, any> = {}) => Array.from({ length: n }, (_, i) => listing({ seller: `0:${String(i).padStart(64, 'a')}`, ...over }));

  const onChain = (numerator: bigint, denominator: bigint, address: string | null = ROYALTY) => ({ numerator, denominator, address });
  const strangers = (n: number, over: Record<string, any> = {}) => sellers(n, over).map((l, i) => ({ ...l, seller: `0:${String(i).padStart(64, 'b')}` }));

  it('NFTSELL-04: the fee most sellers used; the royalty the collection names on chain — the collection\'s own listings only, each seller once', () => {
    const terms = listingTermsFrom([...sellers(5), ...sellers(2, { royaltyPercent: 5000 }), ...sellers(9, { collection: OTHER, feePercent: 5000 })], COLLECTION, null);
    expect(terms, 'naming none: no royalty, the listings\' address at 0 %').toEqual({ feePercent: 1000, royaltyAddress: ROYALTY, royaltyPercent: 0, sellers: 5 });
    expect(listingTermsFrom(sellers(3, { royaltyPercent: 7500 }), COLLECTION, onChain(75n, 1000n))).toEqual({ feePercent: 1000, royaltyAddress: ROYALTY, royaltyPercent: 7500, sellers: 3 });
    expect(listingTermsFrom(sellers(3, { royaltyPercent: 7500 }), COLLECTION, null), 'a royalty the chain does not name is not followed').toBeNull();
    expect(listingTermsFrom(sellers(3), COLLECTION), 'the chain not read, no terms').toBeNull();
    expect(listingTermsFrom(sellers(3), '', null), 'no collection named, no terms').toBeNull();
    expect(listingTermsFrom(sellers(3, { collection: OTHER }), COLLECTION, null), 'another collection\'s terms are not its terms').toBeNull();
  });

  it('NFTSELL-05: anyone may deploy a listing — however many wallets list, the royalty stays the chain\'s; nothing at another marketplace or fee address counts', () => {
    const attacker = '0:6666666666666666666666666666666666666666666666666666666666666666';
    const steered = [...sellers(2, { royaltyPercent: 5000 }), ...strangers(9, { royaltyAddress: attacker, royaltyPercent: 9000 })];
    expect(listingTermsFrom(steered, COLLECTION, onChain(5n, 100n)), 'nine strangers beside two sellers').toMatchObject({ royaltyAddress: ROYALTY, royaltyPercent: 5000 });
    expect(listingTermsFrom(steered, COLLECTION, null), 'naming none: the strangers\' royalty settles nothing').toBeNull();
    expect(listingTermsFrom([...sellers(2), ...strangers(9, { royaltyAddress: attacker })], COLLECTION, null), 'their address at 0 % moves nothing')
      .toMatchObject({ royaltyAddress: attacker, royaltyPercent: 0 });
    expect(listingTermsFrom(sellers(3, { marketplace: OTHER }), COLLECTION, null)).toBeNull();
    expect(listingTermsFrom(sellers(3, { feeAddress: OTHER }), COLLECTION, null)).toBeNull();
    expect(listingTermsFrom(sellers(3, { live: false }), COLLECTION, null)).toBeNull();
    expect(listingTermsFrom(Array.from({ length: 6 }, () => listing()), COLLECTION, null)!.sellers, 'one seller\'s six listings are one voice').toBe(1);
  });

  it('NFTSELL-06: bounds and ties — a fee above 5 %, a royalty on chain above 15 % or with no address, a tie between two fees or two royalty addresses settle nothing', () => {
    expect(listingTermsFrom(sellers(3, { feePercent: NFT_FEE_MAX + 1 }), COLLECTION, null)).toBeNull();
    expect(listingTermsFrom(sellers(3), COLLECTION, onChain(BigInt(NFT_ROYALTY_MAX + 1), 100_000n))).toBeNull();
    expect(listingTermsFrom(sellers(3), COLLECTION, onChain(150n, 1000n)), 'a collection naming 15 % on chain').toMatchObject({ royaltyAddress: ROYALTY, royaltyPercent: 15_000 });
    expect(listingTermsFrom(sellers(3), COLLECTION, onChain(16n, 100n))).toBeNull();
    expect(listingTermsFrom(sellers(3), COLLECTION, onChain(5n, 100n, null)), 'a share with no address').toBeNull();
    expect(listingTermsFrom(sellers(3), COLLECTION, onChain(0n, 100n, null))).toMatchObject({ royaltyAddress: null, royaltyPercent: 0 });
    expect(listingTermsFrom(sellers(3), COLLECTION, onChain(1n, 0n)), 'no denominator').toBeNull();
    expect(listingTermsFrom(sellers(3), COLLECTION, onChain(0n, 0n)), 'a royalty of nothing named 0/0 [round 94 — C10-1]').toMatchObject({ royaltyAddress: ROYALTY, royaltyPercent: 0 });
    expect(listingTermsFrom(sellers(3), COLLECTION, onChain(1n, 30n)), 'rounded down, never more than asked').toMatchObject({ royaltyPercent: 3333 });
    expect(listingTermsFrom([...sellers(2), ...sellers(2, { feePercent: 2000 }).map((l, i) => ({ ...l, seller: `0:${String(i).padStart(64, 'c')}` }))], COLLECTION, null)).toBeNull();
    expect(listingTermsFrom([...sellers(2), ...sellers(2, { royaltyAddress: OTHER }).map((l, i) => ({ ...l, seller: `0:${String(i).padStart(64, 'd')}` }))], COLLECTION, null)).toBeNull();
    expect(listingTermsFrom([], COLLECTION, null)).toBeNull();
  });

  it('NFTSELL-09: a royalty the chain does not name is never followed — the newest 100 transfers are a window strangers can fill [client audit round 93 — C10-2]', () => {
    const attacker = '0:6666666666666666666666666666666666666666666666666666666666666666';
    const many = (n: number, tag: string, over: Record<string, any> = {}) => Array.from({ length: n }, (_, i) => listing({ seller: `0:${tag}${String(i).padStart(63, '0')}`, ...over }));
    expect(listingTermsFrom(many(76, 'a', { royaltyPercent: 5000 }), COLLECTION, null), 'every seller at 5 %').toBeNull();
    expect(listingTermsFrom(many(10, 'b', { royaltyAddress: attacker, royaltyPercent: 10_000 }), COLLECTION, null), 'ten wallets that filled the window').toBeNull();
    expect(listingTermsFrom([...many(76, 'a', { royaltyPercent: 5000 }), ...many(9, 'b', { royaltyPercent: 0 })], COLLECTION, null), 'and a few at 0 %, the lowest')
      .toMatchObject({ royaltyAddress: ROYALTY, royaltyPercent: 0 });
    expect(listingTermsFrom(many(10, 'b', { royaltyAddress: attacker, royaltyPercent: 10_000 }), COLLECTION, { numerator: 5n, denominator: 100n, address: ROYALTY }),
      'the chain\'s royalty, whatever fills the window').toMatchObject({ royaltyAddress: ROYALTY, royaltyPercent: 5000 });
  });

  it('NFTSELL-10: a username, +888 number or .ton item below its 1 GRAM reserve is topped up to it, rounded up to 0.01; nothing else is', () => {
    const [usernames, numbers, dns] = NFT_PINNED_COLLECTIONS;
    expect(nftItemTopUp(usernames, 904_300_000n)).toBe(100_000_000n);
    expect(nftItemTopUp(numbers, '920000000')).toBe(80_000_000n);
    expect(nftItemTopUp(dns, 938_500_000)).toBe(70_000_000n);
    expect(nftItemTopUp(usernames, NFT_ITEM_RESERVE)).toBe(0n);
    expect(nftItemTopUp(usernames, 1_050_000_000n)).toBe(0n);
    expect(nftItemTopUp(COLLECTION, 29_500_000n), 'an item that keeps no reserve').toBe(0n);
  });

  it('NFTSELL-11: an item on its own sale — Telemint\'s get_telemint_auction_state answers while it is on; the index\'s on_sale rides the held item [client audit round 95 — C10-1]', async () => {
    const answer = (status: number, body: any) => ({ ok: status === 200, status, json: async () => body });
    const seen: any[] = [];
    const fetchOf = (reply: any) => async (url: string, init: any) => { seen.push({ url, init }); return reply; };
    await expect(readNftOwnSaleOn({ fetchImpl: fetchOf(answer(200, { exit_code: 0, stack: [{ type: 'list', value: [] }, { type: 'num', value: '0x1' }] })), origin: 'o', item: NFT })).resolves.toBe(true);
    expect(JSON.parse(seen[0].init.body)).toEqual({ address: NFT, method: 'get_telemint_auction_state', stack: [] });
    await expect(readNftOwnSaleOn({ fetchImpl: fetchOf(answer(200, { exit_code: 219, stack: [] })), origin: 'o', item: NFT }), 'no sale on').resolves.toBe(false);
    await expect(readNftOwnSaleOn({ fetchImpl: fetchOf(answer(200, { exit_code: 11, stack: [] })), origin: 'o', item: NFT }), 'no such method: not Telemint').resolves.toBe(false);
    await expect(readNftOwnSaleOn({ fetchImpl: fetchOf(answer(502, {})), origin: 'o', item: NFT })).rejects.toThrow(/HTTP 502/);
    const items = parseNftItems({ nft_items: [{ address: NFT, collection_address: COLLECTION, owner_address: SELLER, on_sale: true }, { address: OTHER, collection_address: COLLECTION, owner_address: SELLER }] });
    expect(items.map((one: any) => one.onSale)).toEqual([true, false]);
  });

  it('NFTSELL-12: its listings read as its NFT list is — pages of WALLET_NFT_PAGE, WALLET_LIST_PAGES of them; a list cut there says so [client audit round 96 — C10-1]', async () => {
    const saleA = '0:a'.padEnd(66, 'a');
    const asked: string[] = [];
    const filler = (n: number) => Array.from({ length: n }, (_, i) => ({ address: `0:${String(i).padStart(64, 'f')}`, owner_address: SELLER, on_sale: false }));
    const pageOf = (offset: number) => (offset === (WALLET_LIST_PAGES - 1) * WALLET_NFT_PAGE
      ? [...filler(WALLET_NFT_PAGE - 1), { address: NFT, owner_address: saleA, real_owner: SELLER, on_sale: true }] : filler(WALLET_NFT_PAGE));
    const sale = { address: saleA, status: 'active', code_hash: GETGEMS_SALE_V4_CODE_HASH, data_hash: 'h-a', data_boc: v4Data() };
    const fetchImpl = async (url: string) => {
      asked.push(url);
      const offset = Number(new URL(url).searchParams.get('offset') ?? 0);
      return { ok: true, json: async () => (url.includes('/nft/items') ? { nft_items: pageOf(offset) } : { accounts: [sale] }) };
    };
    const own: any = await readListingsOf({ fetchImpl, origin: 'https://o', owner: SELLER });
    expect(own.map((l: any) => l.sale), 'a listing behind 4 999 other rows').toEqual([saleA]);
    expect(own.capped, 'the list was cut at its bound: the rows read, as the NFT list says it').toBe(WALLET_LIST_PAGES * WALLET_NFT_PAGE);
    expect(asked.filter((u) => u.includes('/nft/items')).length).toBe(WALLET_LIST_PAGES);
  });

  it('NFTSELL-13: a soulbound verified collection is known by its address — its items refuse every transfer [client audit round 94 — C10-2]', () => {
    for (const soulbound of ['0:c089c5b80494c179cec2fc4d6a6890ef7a6e0188ac260b31fd78896f422e8349', '0:7958c516fb3c518f5cb1c9bfc7140db917655e19bd4b90f32ba576620f847851']) {
      expect(nftCollectionTransferable(soulbound)).toBe(false);
    }
    expect(nftCollectionTransferable(NFT_PINNED_COLLECTIONS[0])).toBe(true);
    expect(nftCollectionTransferable(COLLECTION)).toBe(true);
  });

  it('NFTSELL-08: the royalty is read from the collection — royalty_params, one POST; an exit code is "names none", a read that did not answer throws', async () => {
    const answer = (status: number, body: any) => ({ ok: status === 200, status, json: async () => body });
    const seen: any[] = [];
    const fetchOf = (reply: any) => async (url: string, init: any) => { seen.push({ url, init }); return reply; };
    const cell = (b64: string) => ({ type: 'cell', value: b64 });
    const named = await readCollectionRoyalty({ fetchImpl: fetchOf(answer(200, { exit_code: 0,
      stack: [{ type: 'num', value: '0x5' }, { type: 'num', value: '0x64' }, cell(encodeTonAddressSliceBoc(ROYALTY))] })), origin: 'https://example.test', collection: COLLECTION });
    expect(named).toEqual({ numerator: 5n, denominator: 100n, address: ROYALTY });
    expect(seen[0].url).toBe('https://example.test/api/v3/runGetMethod');
    expect(seen[0].init.method).toBe('POST');
    expect(JSON.parse(seen[0].init.body)).toEqual({ address: COLLECTION, method: 'royalty_params', stack: [] });
    const none = Buffer.from(serializeBoc(beginCell().uint(0n, 2, 'addr_none').endCell())).toString('base64');
    await expect(readCollectionRoyalty({ fetchImpl: fetchOf(answer(200, { exit_code: 0,
      stack: [{ type: 'num', value: '0x0' }, { type: 'num', value: '0x64' }, cell(none)] })), origin: 'o', collection: COLLECTION })).resolves.toEqual({ numerator: 0n, denominator: 100n, address: null });
    await expect(readCollectionRoyalty({ fetchImpl: fetchOf(answer(200, { exit_code: 11, stack: [] })), origin: 'o', collection: COLLECTION }), 'no such method').resolves.toBeNull();
    await expect(readCollectionRoyalty({ fetchImpl: fetchOf(answer(200, { exit_code: -13, stack: [] })), origin: 'o', collection: COLLECTION }), 'no code').resolves.toBeNull();
    await expect(readCollectionRoyalty({ fetchImpl: fetchOf(answer(500, {})), origin: 'o', collection: COLLECTION })).rejects.toThrow(/HTTP 500/);
    await expect(readCollectionRoyalty({ fetchImpl: fetchOf(answer(200, { stack: [] })), origin: 'o', collection: COLLECTION })).rejects.toThrow(/no exit code/);
    await expect(readCollectionRoyalty({ fetchImpl: fetchOf(answer(200, { exit_code: 0, stack: [{ type: 'num', value: '0x5' }] })), origin: 'o', collection: COLLECTION })).rejects.toThrow(/three values/);
  });
});

describe('selling — the wallet\'s own listings', () => {
  it('NFTSELL-07: its items on a sale (include_on_sale, real_owner this wallet), each sale read by its own state as the market reads its lots — a v4 sale or a v3r3 auction, live and this wallet\'s only [client audit round 153 — C5-2]', async () => {
    const asked: string[] = [];
    const saleA = '0:a'.padEnd(66, 'a');
    const saleB = '0:b'.padEnd(66, 'b');
    const auctionC = '0:c'.padEnd(66, 'c');
    const nftC = '0:6'.padEnd(66, '6');
    const items = { nft_items: [
      { address: NFT, owner_address: saleA, real_owner: SELLER, on_sale: true, collection_address: COLLECTION },
      { address: OTHER, owner_address: saleB, real_owner: ROYALTY, on_sale: true },
      { address: nftC, owner_address: auctionC, real_owner: SELLER, on_sale: true, collection_address: COLLECTION },
      { address: COLLECTION, owner_address: SELLER, on_sale: false },
    ] };
    const v4 = (over: any = {}) => ({ address: saleA, status: 'active', code_hash: GETGEMS_SALE_V4_CODE_HASH, data_hash: 'h-a', data_boc: v4Data(over) });
    const auction = (over: any = {}) => ({ address: auctionC, status: 'active', code_hash: GETGEMS_AUCTION_V3R3_CODE_HASH, data_hash: 'h-c', balance: '1000000000',
      data_boc: auctionData({ nft: nftC, ...over }) });
    const serve = (accounts: any[]) => async (url: string) => {
      asked.push(url);
      return { ok: true, json: async () => (url.includes('/nft/items') ? items : { accounts }) };
    };
    for (const accounts of [[v4({ complete: true })], [v4({ seller: ROYALTY })], [auction({ ended: true })], [auction({ seller: ROYALTY })]]) {
      expect(await readListingsOf({ fetchImpl: serve(accounts), origin: 'https://o', owner: SELLER })).toEqual([]);
    }
    asked.length = 0;
    const own = await readListingsOf({ fetchImpl: serve([v4(), auction()]), origin: 'https://o', owner: SELLER });
    expect(own.map((l: any) => [l.sale, l.kind]), 'MEASURED before: the auction in neither «On sale» nor the NFT list').toEqual([[saleA, 'sale'], [auctionC, 'auction']]);
    expect(own.map((l: any) => l.collection), 'the item as the index has it').toEqual([COLLECTION, COLLECTION]);
    expect(asked[0]).toContain(`owner_address=${encodeURIComponent(SELLER)}&include_on_sale=true&limit=${WALLET_NFT_PAGE}&offset=0`);
    expect(asked[1]).toContain('/api/v3/accountStates?');
    expect(asked[1]).toContain(`address=${encodeURIComponent(saleA)}`);
    expect(asked[1]).toContain(`address=${encodeURIComponent(auctionC)}`);
    expect(asked[1]).not.toContain(encodeURIComponent(saleB));
    expect(await readListingsOf({ fetchImpl: serve([]), origin: 'https://o', owner: '' })).toEqual([]);
  });
});
