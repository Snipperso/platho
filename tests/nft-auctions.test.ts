import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Address, beginCell } from '@ton/core';
import {
  GETGEMS_AUCTION_V3R3_CODE_HASH, GETGEMS_SALE_V4_CODE_HASH, NFT_AUCTION_BID_KEEP, NFT_AUCTION_BUYOUT_GAS, NFT_AUCTION_LONGEST_S, NFT_PINNED_COLLECTIONS,
  TELEMINT_DATA_CODE_HASHES, TELEMINT_NO_END, auctionNextBid, auctionPercent, auctionSplit, parseAuctionV3R3Data, parseTelemintItemData, readAuctionFresh,
  readLatestListings, readListingsByIndex, readListingsChanged, readTelemintListings, telemintListingOf, telemintNextBid,
} from '../web/nft-market.mjs';
import { formatPrice, formatUsdAmount } from '../web/price-history.mjs';
import { readTelemintAuction } from '../web/wallet-transfers.mjs';
import { historyRowsOf, parseWalletHistory, readWalletHistory, wonBidsOf } from '../web/wallet-assets.mjs';
import { code, sourceBlock } from './helpers/source';


const GRAM = 1_000_000_000n;
const addr = (byte: string) => `0:${byte.repeat(32)}`;
const NOW = 1_800_000_000;
const app = readFileSync('web/app.js', 'utf8');

const auctionData = (d: Partial<{ ended: boolean, canceled: boolean, bidder: string | null, lastBid: bigint, lastBidAt: number, endTime: number, seller: string | null,
  feeFactor: number, feeBase: number, royaltyFactor: number, royaltyBase: number, feeAddress: string, royaltyAddress: string, marketplace: string, minBid: bigint,
  maxBid: bigint, minStep: number, stepTime: number, nft: string, createdAt: number }> = {}) => {
  const v = { ended: false, canceled: false, bidder: null, lastBid: 0n, lastBidAt: 0, endTime: NOW + 86_400, seller: addr('5e'), feeFactor: 5, feeBase: 100,
    royaltyFactor: 75, royaltyBase: 1000, feeAddress: addr('fe'), royaltyAddress: addr('70'), marketplace: addr('3a'), minBid: 20n * GRAM, maxBid: 100n * GRAM,
    minStep: 5, stepTime: 300, nft: addr('a1'), createdAt: NOW - 3600, ...d };
  const fees = beginCell().storeAddress(Address.parse(v.feeAddress)).storeAddress(Address.parse(v.royaltyAddress)).endCell();
  const constants = beginCell().storeAddress(Address.parse(v.marketplace)).storeCoins(v.minBid).storeCoins(v.maxBid).storeUint(v.minStep, 7).storeUint(v.stepTime, 17)
    .storeAddress(Address.parse(v.nft)).storeUint(v.createdAt, 32).endCell();
  return beginCell().storeInt(v.ended ? -1 : 0, 1).storeInt(v.canceled ? -1 : 0, 1).storeAddress(v.bidder ? Address.parse(v.bidder) : null).storeCoins(v.lastBid)
    .storeUint(v.lastBidAt, 32).storeUint(v.endTime, 32).storeAddress(v.seller ? Address.parse(v.seller) : null).storeUint(0, 64)
    .storeUint(v.feeFactor, 32).storeUint(v.feeBase, 32).storeUint(v.royaltyFactor, 32).storeUint(v.royaltyBase, 32).storeRef(fees).storeRef(constants)
    .endCell().toBoc().toString('base64');
};
const itemData = (d: Partial<{ index: bigint, collection: string, owner: string, auction: null | { bidder?: string, lastBid?: bigint, lastBidAt?: number, minBid: bigint,
  endTime: number, beneficiary: string, initialMinBid: bigint, maxBid: bigint, minStep?: number, extendTime?: number, duration?: number }, royalty: [number, number, string] }> = {}) => {
  const v = { index: 77n, collection: NFT_PINNED_COLLECTIONS[0], owner: addr('0c'), auction: null, royalty: [5, 100, addr('40')] as [number, number, string], ...d };
  const config = beginCell().storeUint(v.index, 256).storeAddress(Address.parse(v.collection)).endCell();
  let auction = null;
  if (v.auction) {
    const a = v.auction;
    const lastBid = a.bidder ? beginCell().storeAddress(Address.parse(a.bidder)).storeCoins(a.lastBid ?? 0n).storeUint(a.lastBidAt ?? 0, 32).endCell() : null;
    const state = beginCell().storeMaybeRef(lastBid).storeCoins(a.minBid).storeUint(a.endTime, 32).endCell();
    const terms = beginCell().storeAddress(Address.parse(a.beneficiary)).storeCoins(a.initialMinBid).storeCoins(a.maxBid).storeUint(a.minStep ?? 5, 8)
      .storeUint(a.extendTime ?? 3600, 32).storeUint(a.duration ?? 3600, 32).endCell();
    auction = beginCell().storeRef(state).storeRef(terms).endCell();
  }
  const royalty = beginCell().storeUint(v.royalty[0], 16).storeUint(v.royalty[1], 16).storeAddress(Address.parse(v.royalty[2])).endCell();
  const state = beginCell().storeAddress(Address.parse(v.owner)).storeRef(beginCell().endCell()).storeMaybeRef(auction).storeRef(royalty).endCell();
  return beginCell().storeRef(config).storeMaybeRef(state).endCell().toBoc().toString('base64');
};
const answer = (...bodies: any[]) => {
  const asked: string[] = [];
  const posted: any[] = [];
  let at = 0;
  return { asked, posted, fetchImpl: async (url: string, init?: any) => {
    asked.push(url);
    if (init?.body) posted.push(JSON.parse(init.body));
    const body = bodies[Math.min(at++, bodies.length - 1)];
    return body?.status ? { ok: false, status: body.status } : { ok: true, json: async () => body };
  } };
};

describe('auctions and items on their own sale', () => {
  it('AUC-01: a v3r3 auction\'s data reads as its pack_data writes it; bytes of another shape read as nothing', () => {
    const read = parseAuctionV3R3Data(auctionData({ bidder: addr('b1'), lastBid: 9n * GRAM, lastBidAt: NOW - 60 }));
    expect(read).toMatchObject({ ended: false, canceled: false, bidder: addr('b1'), lastBid: 9n * GRAM, lastBidAt: NOW - 60, endTime: NOW + 86_400, seller: addr('5e'),
      feeFactor: 5, feeBase: 100, royaltyFactor: 75, royaltyBase: 1000, feeAddress: addr('fe'), royaltyAddress: addr('70'), marketplace: addr('3a'), minBid: 20n * GRAM,
      maxBid: 100n * GRAM, minStep: 5, stepTime: 300, nft: addr('a1'), createdAt: NOW - 3600 });
    expect(parseAuctionV3R3Data(auctionData({ ended: true, canceled: true })), 'end and cancelled: -1 stored in one bit').toMatchObject({ ended: true, canceled: true });
    expect(parseAuctionV3R3Data(auctionData({ seller: null })), 'not activated: no owner named').toMatchObject({ seller: null, bidder: null });
    expect(parseAuctionV3R3Data(beginCell().storeUint(1, 8).endCell().toBoc().toString('base64'))).toBeNull();
    expect(parseAuctionV3R3Data('not a boc')).toBeNull();
  });

  it('AUC-02: the next bid and the split are the auction\'s own arithmetic — two floors at 1e9, 0.1 GRAM at least [MEASURED: get_auction_data agreed on 6 live auctions]', () => {
    expect(auctionNextBid({ lastBid: 0n, minBid: 20n * GRAM, minStep: 5 }), 'no bid yet: min_bid').toBe(20n * GRAM);
    expect(auctionNextBid({ lastBid: 9n * GRAM, minBid: 9n * GRAM, minStep: 30 })).toBe(11_700_000_000n);
    expect(auctionNextBid({ lastBid: 3_300_000_000n, minBid: 1n, minStep: 7 }), '3.531 floors to 3.53').toBe(3_530_000_000n);
    expect(auctionNextBid({ lastBid: 2800n * GRAM, minBid: 1n, minStep: 1 })).toBe(2828n * GRAM);
    expect(auctionNextBid({ lastBid: GRAM, minBid: 1n, minStep: 1 }), 'the step under 0.1 GRAM: 0.1 GRAM').toBe(1_100_000_000n);
    expect(auctionPercent(100n * GRAM, 5, 100)).toBe(5n * GRAM);
    expect(auctionPercent(100n * GRAM, 5, 0), 'no base: nothing').toBe(0n);
    expect(auctionSplit({ feeFactor: 5, feeBase: 100, royaltyFactor: 75, royaltyBase: 1000 }, 50n * GRAM))
      .toEqual({ fee: 2_500_000_000n, royalty: 3_750_000_000n, seller: 43_750_000_000n });
    expect([NFT_AUCTION_BUYOUT_GAS, NFT_AUCTION_BID_KEEP, NFT_AUCTION_LONGEST_S]).toEqual([100_000_000n, 5_577_000n, 20 * 86_400]);
  });

  it('AUC-03: an auction in the deployer\'s feed is a listing taking bids — live only while on, before its end and within twenty days, holding this NFT, its shares possible', async () => {
    const now = Math.floor(Date.now() / 1000);
    const nft = addr('a1');
    const auction = addr('ac');
    const transfers = { nft_transfers: [{ new_owner: auction, nft_address: nft, nft_collection: addr('c0'), transaction_lt: '900', transaction_now: now - 10 }], metadata: {} };
    const stateOf = (data: string, codeHash = GETGEMS_AUCTION_V3R3_CODE_HASH) => ({ accounts: [{ address: auction, status: 'active', code_hash: codeHash, data_hash: 'h1', data_boc: data },
      { address: nft, status: 'active', last_transaction_lt: '900' }] });
    const read = async (data: string, codeHash?: string) => (await readLatestListings({ fetchImpl: answer(transfers, stateOf(data, codeHash)).fetchImpl, origin: 'https://o', limit: 100 }));
    const live = await read(auctionData({ endTime: now + 3600, bidder: addr('b1'), lastBid: 30n * GRAM }));
    expect(live.listings).toHaveLength(1);
    expect(live.listings[0]).toMatchObject({ kind: 'auction', sale: auction, nft, seller: addr('5e'), price: 31_500_000_000n, nextBid: 31_500_000_000n, lastBid: 30n * GRAM,
      maxBid: 100n * GRAM, feePercent: 5000, royaltyPercent: 7500, live: true });
    for (const [why, data] of [
      ['ended', auctionData({ endTime: now + 3600, ended: true })], ['cancelled', auctionData({ endTime: now + 3600, canceled: true })],
      ['past its end', auctionData({ endTime: now - 1 })], ['more than twenty days left: it takes no bid (1014)', auctionData({ endTime: now + NFT_AUCTION_LONGEST_S + 60 })],
      ['another NFT', auctionData({ endTime: now + 3600, nft: addr('a2') })], ['the next bid over the buyout', auctionData({ endTime: now + 3600, bidder: addr('b1'), lastBid: 99n * GRAM })],
      ['shares of the whole', auctionData({ endTime: now + 3600, feeFactor: 60, feeBase: 100, royaltyFactor: 40, royaltyBase: 100 })],
    ] as [string, string][]) {
      expect((await read(data)).listings, why).toEqual([]);
    }
    expect((await read(auctionData({ endTime: now + 3600, seller: null }))).sales, 'not activated: judged, no listing').toEqual([auction]);
    expect((await read(auctionData({ endTime: now + 3600 }), 'AAAA' + GETGEMS_AUCTION_V3R3_CODE_HASH.slice(4))).listings, 'another code').toEqual([]);
  });

  it('AUC-04: an auction on screen asked again stands while its code holds; a code that is no listing\'s leaves; the fresh read before a press reads its own data', async () => {
    const now = Math.floor(Date.now() / 1000);
    const listing = { kind: 'auction', sale: addr('ac'), nft: addr('a1'), dataHash: 'h1', itemLt: '900' };
    const light = (codeHash: string, dataHash = 'h1') => ({ accounts: [{ address: addr('ac'), status: 'active', code_hash: codeHash, data_hash: dataHash },
      { address: addr('a1'), status: 'active', last_transaction_lt: '900' }] });
    expect((await readListingsChanged({ fetchImpl: answer(light(GETGEMS_AUCTION_V3R3_CODE_HASH)).fetchImpl, origin: 'https://o', listings: [listing] })).size, 'unchanged').toBe(0);
    expect((await readListingsChanged({ fetchImpl: answer(light(GETGEMS_SALE_V4_CODE_HASH + 'x')).fetchImpl, origin: 'https://o', listings: [listing] })).get(addr('ac'))).toBeNull();
    const bid = { accounts: [{ address: addr('ac'), status: 'active', code_hash: GETGEMS_AUCTION_V3R3_CODE_HASH, data_hash: 'h2',
      data_boc: auctionData({ endTime: now + 600, bidder: addr('b2'), lastBid: 40n * GRAM }) }] };
    const changed = await readListingsChanged({ fetchImpl: answer(light(GETGEMS_AUCTION_V3R3_CODE_HASH, 'h2'), bid).fetchImpl, origin: 'https://o', listings: [listing] });
    expect(changed.get(addr('ac')), 'a new bid: its fresh figures').toMatchObject({ kind: 'auction', lastBid: 40n * GRAM, bidder: addr('b2'), live: true });
    const fresh = await readAuctionFresh({ fetchImpl: answer(bid).fetchImpl, origin: 'https://o', listing: { ...listing, name: 'Hat #1' } });
    expect(fresh).toMatchObject({ kind: 'auction', name: 'Hat #1', nextBid: 42n * GRAM, live: true });
    expect(await readAuctionFresh({ fetchImpl: answer({ accounts: [] }).fetchImpl, origin: 'https://o', listing }), 'no such account').toBeNull();
    const another = { accounts: [{ address: addr('ac'), status: 'active', code_hash: GETGEMS_AUCTION_V3R3_CODE_HASH, data_hash: 'h3', data_boc: auctionData({ endTime: now + 600, nft: addr('a2') }) }] };
    expect((await readAuctionFresh({ fetchImpl: answer(another).fetchImpl, origin: 'https://o', listing }))?.live, 'its data names another NFT').toBe(false);
  });

  it('TELE-01: an item\'s own data reads as Telemint lays it out; as a listing — a fixed price, an auction with or without a buy-now price, never past its end', () => {
    const fixed = parseTelemintItemData(itemData({ auction: { minBid: 15n * GRAM, endTime: NOW + 3600, beneficiary: addr('be'), initialMinBid: 15n * GRAM, maxBid: 15n * GRAM } }));
    expect(fixed).toMatchObject({ index: '77', collection: NFT_PINNED_COLLECTIONS[0], owner: addr('0c'), royalty: { numerator: 5, denominator: 100, address: addr('40') },
      auction: { bidder: null, lastBid: 0n, minBid: 15n * GRAM, endTime: NOW + 3600, beneficiary: addr('be'), maxBid: 15n * GRAM, minStep: 5 } });
    const bid = parseTelemintItemData(itemData({ auction: { bidder: addr('b1'), lastBid: 6n * GRAM, lastBidAt: NOW - 5, minBid: 7n * GRAM, endTime: NOW + 600,
      beneficiary: addr('be'), initialMinBid: 6n * GRAM, maxBid: 9n * GRAM, extendTime: 604_800 } }));
    expect(bid?.auction).toMatchObject({ bidder: addr('b1'), lastBid: 6n * GRAM, lastBidAt: NOW - 5, minBid: 7n * GRAM, extendTime: 604_800 });
    expect(parseTelemintItemData(itemData({ auction: null }))?.auction, 'no sale on').toBeNull();
    expect(parseTelemintItemData('nope')).toBeNull();
    const item = { nft: addr('17'), collection: NFT_PINNED_COLLECTIONS[0], index: '77', name: '@madeup' };
    const asFixed = telemintListingOf(item, fixed!.auction, { royalty: fixed!.royalty, now: NOW });
    expect(asFixed).toMatchObject({ kind: 'telemint', sale: addr('17'), nft: addr('17'), seller: addr('be'), price: 15n * GRAM, maxBid: 15n * GRAM, fixed: true,
      feePercent: 0, royaltyPercent: 5000, royaltyAddress: addr('40'), live: true });
    expect(telemintListingOf(item, bid!.auction, { now: NOW }), 'an auction: priced at the least bid it takes').toMatchObject({ price: 7n * GRAM, nextBid: 7n * GRAM, maxBid: 9n * GRAM,
      fixed: false, royaltyKnown: false, live: true });
    expect(telemintListingOf(item, { ...bid!.auction!, maxBid: 0n }, { now: NOW }), 'no buy-now price').toMatchObject({ fixed: false, maxBid: 0n, live: true });
    expect(telemintListingOf(item, bid!.auction, { now: NOW + 600 })?.live, 'at its end').toBe(false);
    expect(telemintListingOf(item, { ...fixed!.auction!, endTime: TELEMINT_NO_END }, { now: NOW + 10 ** 6 })?.live, 'a sale that never ends').toBe(true);
    expect(telemintListingOf(item, { ...bid!.auction!, minBid: 10n * GRAM }, { now: NOW })?.live, 'a least bid over the buy-now price').toBe(false);
    expect(telemintListingOf(item, fixed!.auction, { royalty: { numerator: 5, denominator: 100, address: addr('be') }, now: NOW })?.royaltyPercent,
      'a royalty to the seller is not taken (the item pays it nothing)').toBe(0);
    expect(telemintListingOf(item, null), 'no sale on').toBeNull();
  });

  it('TELE-02: a Telemint collection\'s own sales — its items touched last, those a wallet holds on sale, read by their data; another code by its get-methods, at most as asked', async () => {
    const [usernames] = NFT_PINNED_COLLECTIONS;
    const end = Math.floor(Date.now() / 1000) + 3600;
    const lot = (index: bigint, minBid: bigint, maxBid: bigint) => itemData({ index, auction: { minBid, endTime: end, beneficiary: addr('be'), initialMinBid: minBid, maxBid } });
    const items = { nft_items: [
      { address: addr('11'), index: '1', collection_address: usernames, owner_address: addr('0c'), real_owner: addr('0c'), on_sale: true },
      { address: addr('12'), index: '2', collection_address: usernames, owner_address: addr('5a'), real_owner: addr('0d'), on_sale: true },
      { address: addr('13'), index: '3', collection_address: usernames, owner_address: addr('0c'), real_owner: addr('0c'), on_sale: false },
      { address: addr('14'), index: '4', collection_address: addr('99'), owner_address: addr('0c'), real_owner: addr('0c'), on_sale: true },
      { address: addr('15'), index: '5', collection_address: usernames, owner_address: addr('0c'), real_owner: addr('0c'), on_sale: true },
      { address: addr('16'), index: '6', collection_address: usernames, owner_address: addr('0c'), real_owner: addr('0c'), on_sale: true },
    ], metadata: {} };
    const states = { accounts: [
      { address: addr('11'), status: 'active', code_hash: TELEMINT_DATA_CODE_HASHES[0], data_hash: 'd1', data_boc: lot(1n, 15n * GRAM, 15n * GRAM) },
      { address: addr('15'), status: 'active', code_hash: TELEMINT_DATA_CODE_HASHES[0], data_hash: 'd5', data_boc: lot(9n, 15n * GRAM, 15n * GRAM) },
      { address: addr('16'), status: 'active', code_hash: 'gift-code', data_hash: 'd6', data_boc: 'x' },
    ] };
    const stateStack = { exit_code: 0, stack: [{ type: 'list', value: [] }, { type: 'num', value: '0x0' }, { type: 'num', value: '0x0' }, { type: 'num', value: `0x${(8n * GRAM).toString(16)}` },
      { type: 'num', value: '0xffffffff' }] };
    const beneficiary = beginCell().storeAddress(Address.parse(addr('be'))).endCell().toBoc().toString('base64');
    const configStack = { exit_code: 0, stack: [{ type: 'slice', value: beneficiary }, { type: 'num', value: `0x${(8n * GRAM).toString(16)}` },
      { type: 'num', value: `0x${(8n * GRAM).toString(16)}` }, { type: 'num', value: '0x5' }, { type: 'num', value: '0xe10' }, { type: 'num', value: '0x0' }] };
    const read = answer(items, states, stateStack, configStack);
    const lots = await readTelemintListings({ fetchImpl: read.fetchImpl, origin: 'https://o', collection: usernames });
    expect(read.asked[0]).toBe(`https://o/api/v3/nft/items?collection_address=${encodeURIComponent(usernames)}&sort_by_last_transaction_lt=true&limit=100`);
    expect(read.asked[1]).toContain('/api/v3/accountStates?');
    for (const left of [addr('12'), addr('13'), addr('14')]) expect(read.asked[1], 'only items a wallet holds on sale, of this collection').not.toContain(encodeURIComponent(left));
    expect(lots.map((one: any) => [one.nft, one.price, one.fixed, one.endTime])).toEqual([[addr('11'), 15n * GRAM, true, end], [addr('16'), 8n * GRAM, true, TELEMINT_NO_END]]);
    expect(read.posted.map((one) => one.method), 'the gift\'s by its get-methods').toEqual(['get_telemint_auction_state', 'get_telemint_auction_config']);
    const capped = answer(items, states);
    expect(await readTelemintListings({ fetchImpl: capped.fetchImpl, origin: 'https://o', collection: usernames, asked: 0 })).toHaveLength(1);
    expect(capped.posted).toHaveLength(0);
  });

  it('TELE-06: a gift held whose data is as read asks nothing again, the get-methods go to those not held; a refusal keeps what was read [round 117 — C5-1, C5-5]', async () => {
    const [usernames] = NFT_PINNED_COLLECTIONS;
    const row = (byte: string, index: string) => ({ address: addr(byte), index, collection_address: usernames, owner_address: addr('0c'), real_owner: addr('0c'), on_sale: true });
    const items = { nft_items: [row('21', '1'), row('22', '2'), row('23', '3')], metadata: {} };
    const states = { accounts: ['21', '22', '23'].map((byte) => ({ address: addr(byte), status: 'active', code_hash: 'gift-code', data_hash: `d${byte}`, data_boc: 'x' })) };
    const num = (v: bigint | number) => ({ type: 'num', value: `0x${BigInt(v).toString(16)}` });
    const beneficiary = { type: 'slice', value: beginCell().storeAddress(Address.parse(addr('be'))).endCell().toBoc().toString('base64') };
    const stateStack = { exit_code: 0, stack: [{ type: 'list', value: [] }, num(0), num(0), num(8n * GRAM), num(TELEMINT_NO_END)] };
    const configStack = { exit_code: 0, stack: [beneficiary, num(8n * GRAM), num(8n * GRAM), num(5), num(3600), num(0)] };
    const kept = { kind: 'telemint', sale: addr('21'), nft: addr('21'), dataHash: 'd21', price: 7n * GRAM, live: true, name: 'Made Up #1' };
    const held = new Map([[addr('21'), kept]]);
    const read = answer(items, states, stateStack, configStack);
    const lots = await readTelemintListings({ fetchImpl: read.fetchImpl, origin: 'https://o', collection: usernames, asked: 1, held });
    expect(lots.map((one: any) => one.nft), 'the one held as it stands, and the one asked').toEqual([addr('21'), addr('22')]);
    expect(lots[0]).toBe(kept);
    expect(read.posted.map((one) => one.method), 'one gift\'s get-methods: not the held one\'s').toEqual(['get_telemint_auction_state', 'get_telemint_auction_config']);
    expect([...lots.unread], 'past what may be asked: not read').toEqual([addr('23')]);
    const moved = answer(items, { accounts: states.accounts.map((one) => ({ ...one, data_hash: `${one.data_hash}x` })) }, stateStack, configStack);
    await readTelemintListings({ fetchImpl: moved.fetchImpl, origin: 'https://o', collection: usernames, asked: 1, held });
    expect(moved.posted.length, 'its data moved: the held one asked').toBe(2);
    const refused = answer(items, states, { status: 500 });
    const part = await readTelemintListings({ fetchImpl: refused.fetchImpl, origin: 'https://o', collection: usernames, held });
    expect(part.map((one: any) => one.nft)).toEqual([addr('21')]);
    expect([...part.unread]).toEqual([addr('22'), addr('23')]);
    expect(refused.posted, 'nothing asked past the refusal').toHaveLength(1);
    let at = 0;
    const letGo = async () => {
      const body = [items, states][at++];
      if (body) return { ok: true, json: async () => body };
      throw Object.assign(new Error('let go'), { code: 'NOT_WANTED' });
    };
    await expect(readTelemintListings({ fetchImpl: letGo as any, origin: 'https://o', collection: usernames })).rejects.toMatchObject({ code: 'NOT_WANTED' });
    const shown = { kind: 'telemint', sale: addr('22'), nft: addr('22'), collection: usernames, index: '2', dataHash: 'old', name: 'Made Up #2' };
    const light = { accounts: [{ address: addr('22'), status: 'active', code_hash: 'gift-code', data_hash: 'new' }] };
    const again = { accounts: [{ address: addr('22'), status: 'active', code_hash: 'gift-code', data_hash: 'new', data_boc: 'x' }] };
    const changed = await readListingsChanged({ fetchImpl: answer(light, again, { status: 429 }).fetchImpl, origin: 'https://o', listings: [shown] });
    expect(changed.has(addr('22'))).toBe(false);
  });

  it('TELE-03: a name looked up — an item on a sale or an auction by its owner\'s data, an item on its own sale by its own; only of that collection, at an index asked', async () => {
    const [usernames] = NFT_PINNED_COLLECTIONS;
    const end = Math.floor(Date.now() / 1000) + 3600;
    const items = { nft_items: [
      { address: addr('a1'), index: '7', collection_address: usernames, owner_address: addr('ac'), real_owner: addr('5e'), on_sale: true },
      { address: addr('17'), index: '8', collection_address: usernames, owner_address: addr('0c'), real_owner: addr('0c'), on_sale: true },
      { address: addr('18'), index: '9', collection_address: usernames, owner_address: addr('0c'), real_owner: addr('0c'), on_sale: false },
    ], metadata: {} };
    const owners = { accounts: [{ address: addr('ac'), status: 'active', code_hash: GETGEMS_AUCTION_V3R3_CODE_HASH, data_hash: 'h', data_boc: auctionData({ endTime: end }) }] };
    const own = { accounts: [{ address: addr('17'), status: 'active', code_hash: TELEMINT_DATA_CODE_HASHES[0], data_hash: 'd',
      data_boc: itemData({ index: 8n, auction: { minBid: 30n * GRAM, endTime: end, beneficiary: addr('be'), initialMinBid: 30n * GRAM, maxBid: 30n * GRAM } }) }] };
    const looked = answer(items, owners, own);
    const { listings, onSale } = await readListingsByIndex({ fetchImpl: looked.fetchImpl, origin: 'https://o', collection: usernames, indexes: ['7', '8', '9'] });
    expect(onSale).toBe(2);
    expect(listings.map((one: any) => [one.kind, one.index, one.price])).toEqual([['auction', '7', 20n * GRAM], ['telemint', '8', 30n * GRAM]]);
    expect(looked.asked[1], 'the auction\'s data').toContain(encodeURIComponent(addr('ac')));
    expect(looked.asked[1], 'not the item held off sale').not.toContain(encodeURIComponent(addr('0c')));
    const nothing = answer({ nft_items: [{ address: addr('18'), index: '9', collection_address: usernames, owner_address: addr('0c'), real_owner: addr('0c'), on_sale: false }] });
    expect(await readListingsByIndex({ fetchImpl: nothing.fetchImpl, origin: 'https://o', collection: usernames, indexes: ['9'] })).toEqual({ listings: [], onSale: 0 });
    expect(nothing.asked, 'nothing on sale: one call').toHaveLength(1);
  });

  it('TELE-04: an item on its own sale on screen asked again — gone where its account is; unchanged where its data is; read again by its data where it changed, its name kept', async () => {
    const end = Math.floor(Date.now() / 1000) + 3600;
    const listing = { kind: 'telemint', sale: addr('17'), nft: addr('17'), collection: NFT_PINNED_COLLECTIONS[0], index: '8', dataHash: 'd', name: '@madeup', picture: 'p' };
    const light = (dataHash: string, status = 'active') => ({ accounts: [{ address: addr('17'), status, code_hash: TELEMINT_DATA_CODE_HASHES[0], data_hash: dataHash }] });
    expect((await readListingsChanged({ fetchImpl: answer(light('d')).fetchImpl, origin: 'https://o', listings: [listing] })).size).toBe(0);
    const gone = answer({ accounts: [] });
    expect((await readListingsChanged({ fetchImpl: gone.fetchImpl, origin: 'https://o', listings: [listing] })).get(addr('17'))).toBeNull();
    expect(gone.asked, 'gone: its data is not asked for').toHaveLength(1);
    const bid = { accounts: [{ address: addr('17'), status: 'active', code_hash: TELEMINT_DATA_CODE_HASHES[0], data_hash: 'e',
      data_boc: itemData({ index: 8n, auction: { bidder: addr('b1'), lastBid: 30n * GRAM, minBid: 32n * GRAM, endTime: end, beneficiary: addr('be'), initialMinBid: 30n * GRAM, maxBid: 50n * GRAM } }) }] };
    const changed = await readListingsChanged({ fetchImpl: answer(light('e'), bid).fetchImpl, origin: 'https://o', listings: [listing] });
    expect(changed.get(addr('17'))).toMatchObject({ kind: 'telemint', name: '@madeup', picture: 'p', lastBid: 30n * GRAM, nextBid: 32n * GRAM, dataHash: 'e', live: true });
    const over = { accounts: [{ address: addr('17'), status: 'active', code_hash: TELEMINT_DATA_CODE_HASHES[0], data_hash: 'f', data_boc: itemData({ index: 8n, auction: null }) }] };
    expect((await readListingsChanged({ fetchImpl: answer(light('f'), over).fetchImpl, origin: 'https://o', listings: [listing] })).get(addr('17')), 'its sale over').toBeNull();
  });

  it('TELE-05: an item\'s own sale by its get-methods — none on (219), a bid\'s bidder, a config naming no one', async () => {
    const num = (v: bigint | number) => ({ type: 'num', value: `0x${BigInt(v).toString(16)}` });
    const slice = (a: string) => ({ type: 'slice', value: beginCell().storeAddress(Address.parse(a)).endCell().toBoc().toString('base64') });
    const none = answer({ exit_code: 219, stack: [] });
    expect(await readTelemintAuction({ fetchImpl: none.fetchImpl, origin: 'https://o', item: addr('17') })).toBeNull();
    expect(none.posted, 'no sale on: the config is not asked').toHaveLength(1);
    const on = answer({ exit_code: 0, stack: [slice(addr('b1')), num(6n * GRAM), num(NOW), num(7n * GRAM), num(NOW + 600)] },
      { exit_code: 0, stack: [slice(addr('be')), num(5n * GRAM), num(9n * GRAM), num(5), num(604_800), num(3600)] });
    expect(await readTelemintAuction({ fetchImpl: on.fetchImpl, origin: 'https://o', item: addr('17') })).toEqual({ bidder: addr('b1'), lastBid: 6n * GRAM, lastBidAt: NOW,
      minBid: 7n * GRAM, endTime: NOW + 600, beneficiary: addr('be'), initialMinBid: 5n * GRAM, maxBid: 9n * GRAM, minStep: 5, extendTime: 604_800, duration: 3600 });
    const nobody = answer({ exit_code: 0, stack: [{ type: 'list', value: [] }, num(0), num(0), num(7n * GRAM), num(NOW + 600)] }, { exit_code: 0, stack: [{ type: 'list', value: [] }, num(0), num(0), num(0), num(0), num(0)] });
    expect(await readTelemintAuction({ fetchImpl: nobody.fetchImpl, origin: 'https://o', item: addr('17') })).toBeNull();
    await expect(readTelemintAuction({ fetchImpl: answer({ status: 429 }).fetchImpl, origin: 'https://o', item: addr('17') }), 'a read that did not answer throws').rejects.toMatchObject({ status: 429 });
  });

  it('AUCUI-01: a press checks the listing again before it signs — gone, ended (said so), changed in what it pays; the NFT on its auction (an item is its own sale); the collection\'s item, a verified collection; the end\'s margin on the chain\'s clock, at once and again after the reads [round 117 — C1-4; round 118 — C7-3; round 132 — C5-2]', async () => {
    const chainSkew = { s: 0 };
    const readsTake = { s: 0 };
    const asked: string[] = [];
    // eslint-disable-next-line no-new-func
    const lift = (fresh: any, { owner = addr('ac'), named = addr('a1'), proven = true } = {}) => new Function('walletNftListingFresh', 'readNftOwner', 'verifyTelegramGiftMembershipOnChain',
      'walletNftBuyCollectionProven', 'pressReadOptions', 'criticalChainReadOptions', 'sameWalletAddress', 'TELEMINT_NO_END', 'NFT_PRESS_END_MARGIN_S', 'globalThis', 'chainNowSec',
      `${sourceBlock(app, 'async function walletNftPressChecks(listing, { buying }) {')}\nreturn walletNftPressChecks;`)(
      async () => fresh, async () => { asked.push('owner'); chainSkew.s += readsTake.s; return owner; }, async () => { asked.push('member'); return named; }, async () => proven, (o: any) => o, () => ({}),
      (a: string, b: string) => a === b, TELEMINT_NO_END, 60, {}, () => Math.floor(Date.now() / 1000) + chainSkew.s);
    const now = Math.floor(Date.now() / 1000);
    const listing = { kind: 'auction', sale: addr('ac'), nft: addr('a1'), seller: addr('5e'), collection: addr('c0'), index: '1', maxBid: 100n * GRAM,
      feeFactor: 5, feeBase: 100, royaltyFactor: 0, royaltyBase: 100, endTime: now + 3600 };
    const fresh = { ...listing, live: true };
    await expect(lift(fresh)(listing, { buying: true })).resolves.toBe(fresh);
    await expect(lift({ ...fresh, live: false })(listing, { buying: true })).rejects.toMatchObject({ code: 'NFT_SALE_GONE' });
    await expect(lift(null)(listing, { buying: true })).rejects.toMatchObject({ code: 'NFT_SALE_GONE' });
    asked.length = 0;
    await expect(lift({ ...fresh, endTime: now + 30 })(listing, { buying: false }), 'within the margin of its end').rejects.toMatchObject({ code: 'NFT_AUCTION_ENDED' });
    expect(asked, 'no read after the fresh one').toEqual([]);
    readsTake.s = 40;
    await expect(lift({ ...fresh, endTime: now + 90 })(listing, { buying: false }), '90 s left at the fresh read, 50 after the reads').rejects.toMatchObject({ code: 'NFT_AUCTION_ENDED' });
    expect(asked, 'the owner and the membership read first').toEqual(['owner', 'member']);
    readsTake.s = 0;
    chainSkew.s = 100;
    await expect(lift({ ...fresh, endTime: now + 130 })(listing, { buying: false }), 'the chain 100 s ahead: 30 s left').rejects.toMatchObject({ code: 'NFT_AUCTION_ENDED' });
    chainSkew.s = 0;
    await expect(lift({ ...fresh, endTime: now - 5, live: false })(listing, { buying: false })).rejects.toMatchObject({ code: 'NFT_SALE_ENDED' });
    await expect(lift({ ...fresh, endTime: now - 5 })(listing, { buying: true })).rejects.toMatchObject({ code: 'NFT_SALE_ENDED' });
    await expect(lift({ ...fresh, maxBid: 120n * GRAM })(listing, { buying: true }), 'a buyout repriced').rejects.toMatchObject({ code: 'NFT_SALE_CHANGED' });
    await expect(lift({ ...fresh, maxBid: 120n * GRAM })(listing, { buying: false }), 'a bid is not the buyout').resolves.toBeTruthy();
    await expect(lift({ ...fresh, seller: addr('5f') })(listing, { buying: false })).rejects.toMatchObject({ code: 'NFT_SALE_CHANGED' });
    await expect(lift({ ...fresh, feeFactor: 6 })(listing, { buying: false }), 'its shares').rejects.toMatchObject({ code: 'NFT_SALE_CHANGED' });
    await expect(lift(fresh, { owner: addr('0f') })(listing, { buying: true }), 'the NFT off the auction').rejects.toMatchObject({ code: 'NFT_SALE_GONE' });
    await expect(lift(fresh, { named: addr('a9') })(listing, { buying: true })).rejects.toMatchObject({ code: 'NFT_NOT_OF_COLLECTION' });
    await expect(lift(fresh, { proven: false })(listing, { buying: true })).rejects.toMatchObject({ code: 'NFT_NOT_OF_COLLECTION' });
    const item = { kind: 'telemint', sale: addr('17'), nft: addr('17'), seller: addr('be'), collection: addr('c0'), index: '8', maxBid: 15n * GRAM, endTime: TELEMINT_NO_END };
    await expect(lift({ ...item, live: true }, { owner: addr('0c'), named: addr('17') })(item, { buying: true }), 'an item is its own sale: no owner asked').resolves.toBeTruthy();
  });

  it('AUCUI-02: what a press signs — a sale price + 0.1, a buyout max_bid + 0.1, an item exactly its buy-now price; a bid exactly what is typed, at least the next bid, under the buy-now price', () => {
    const buy = code(sourceBlock(app, 'async function openNftBuyDialog(listing, hold) {'));
    expect(buy).toContain("const valueOf = (one) => (kind === 'sale' ? buyValue(one) : kind === 'auction' ? one.maxBid + NFT_AUCTION_BUYOUT_GAS : one.maxBid);");
    expect(buy).toContain('await sendWalletAssetMessage(signer, { address: fresh.sale, value: valueOf(fresh), body: nftBuyBody() });');
    expect(buy).toContain("if (walletNftBuyNowPrice(fresh) === null) throw Object.assign(new Error('no buy-now price'), { code: 'NFT_SALE_CHANGED', fresh });");
    const bid = code(sourceBlock(app, 'async function openNftBidDialog(listing, hold) {'));
    expect(bid).toContain('const least = walletNftWithOwnBid(fresh).nextBid;');
    expect(bid).toContain("if (amount < least) throw Object.assign(new Error('the bid is under the least'), { code: 'NFT_BID_LOW', least, fresh });");
    expect(bid).toContain('walletNftOwnBidSent(fresh, amount, signer.address);');
    expect(bid).toContain("if (fresh.maxBid > 0n && amount >= fresh.maxBid) throw Object.assign(new Error('the bid is a buy'), { code: 'NFT_BID_IS_BUY_NOW', buyNow: fresh.maxBid, fresh });");
    expect(bid, 'the figures a refusal took, drawn at once [round 134 — C7-1] — a live read\'s only [round 135 — C7-2]').toContain('return { ok: false, error: walletNftPressRefusal(listing, error, signing), repaint: Boolean(error?.fresh?.live || fresh?.live) };');
    expect(bid).toContain('fresh = await walletNftPressChecks(listing, { buying: false });');
    expect(bid).toContain('if (fresh?.live && !error?.fresh) walletNftTakeListing(fresh);');
    expect(bid.indexOf('let fresh = null;'), 'held past the try').toBeLessThan(bid.indexOf('fresh = await walletNftPressChecks('));
    expect(bid, 'the one held past the try, not another inside it').not.toMatch(/(const|let) fresh = await walletNftPressChecks\(/);
    expect(bid).toContain('await sendWalletAssetMessage(signer, { address: fresh.sale, value: amount, body: nftBuyBody() });');
    expect(bid).toContain("if (!walletNftIsAuction(fresh)) throw Object.assign(new Error('no longer an auction'), { code: 'NFT_SALE_CHANGED', fresh });");
    const card = code(sourceBlock(app, 'function openWalletNftListing(listing, { back = null } = {}) {'));
    expect(card).toContain(': [walletCardStat(t(\'nft.yourListing\'), \'\')])');
    expect(card).toContain(": !auction ? [walletCardSend(buy, t('wallet.marketBuy'), 'is-buy')]");
  });

  it('AUCUI-03: a view offers nothing that has ended; "from" is what owning it now costs — an auction without a buy-now price is no floor; a Telemint collection\'s own sales read with its head', () => {
    // eslint-disable-next-line no-new-func
    const { walletNftListingOn, walletNftBuyNowPrice, walletNftIsAuction } = new Function('TELEMINT_NO_END', `${sourceBlock(app, 'function walletNftListingOn(listing, now = Math.floor(Date.now() / 1000)) {')}
${sourceBlock(app, 'function walletNftIsAuction(listing) {')}\n${sourceBlock(app, 'function walletNftBuyNowPrice(listing) {')}
return { walletNftListingOn, walletNftBuyNowPrice, walletNftIsAuction };`)(TELEMINT_NO_END);
    expect(walletNftListingOn({ price: 1n }, NOW), 'a sale').toBe(true);
    expect(walletNftListingOn({ endTime: NOW + 1 }, NOW)).toBe(true);
    expect(walletNftListingOn({ endTime: NOW }, NOW)).toBe(false);
    expect(walletNftListingOn({ endTime: TELEMINT_NO_END }, NOW)).toBe(true);
    for (const [start, one] of [['function openWalletNftListing(listing, { back = null } = {}) {', 'listing'], ['async function openNftBidDialog(listing, hold) {', 'shown']]) {
      expect(code(sourceBlock(app, start)), `${start}: no date for a sale that never ends`).toContain(`${one}.endTime && ${one}.endTime !== TELEMINT_NO_END ?`);
    }
    expect(walletNftBuyNowPrice({ kind: 'sale', price: 5n })).toBe(5n);
    expect(walletNftBuyNowPrice({ price: 5n }), 'a feed listing of old: a sale').toBe(5n);
    expect(walletNftBuyNowPrice({ kind: 'auction', price: 2n, maxBid: 0n })).toBeNull();
    expect(walletNftBuyNowPrice({ kind: 'auction', price: 2n, maxBid: 9n })).toBe(9n);
    expect(walletNftBuyNowPrice({ kind: 'telemint', price: 9n, maxBid: 9n, fixed: true })).toBe(9n);
    expect([walletNftIsAuction({ kind: 'auction' }), walletNftIsAuction({ kind: 'telemint', fixed: true }), walletNftIsAuction({ kind: 'telemint', fixed: false }),
      walletNftIsAuction({ kind: 'sale' })]).toEqual([true, false, true, false]);
    expect(app).toContain('[...walletNftCollection(NFT_ALL).listings.values()].filter((listing) => walletNftCollectionVerified(listing.collection) === \'yes\' && walletNftListingOn(listing))');
    const read = code(sourceBlock(app, 'async function walletNftCollectionRead(entry, { deeper = false, priority = \'focus\', forList = false, pressed = false } = {}) {'));
    expect(read, 'its own read beside the head, never between the head and its read-on [round 117 — C5-1]').toContain('if (head && !forList) walletNftTelemintRead(entry);');
    expect(read).not.toContain('readTelemintListings');
    expect(code(sourceBlock(app, 'function walletNftTelemintCollection(key) {'))).toContain("return key === NFT_PINNED_COLLECTIONS[0] || key === NFT_PINNED_COLLECTIONS[1] || (Boolean(key) && walletNftMarket.giftVerdicts.get(key) === 'yes');");
    expect(app.match(/const now = walletNftBuyNowPrice\(listing\);/g), 'the feed rows, a collection read, a view').toHaveLength(3);
    expect(app).toContain('const now = walletNftBuyNowPrice(listing);\n    return now !== null && (least === null || now < least) ? now : least;');
  });

  it('AUCUI-04: a Telemint collection\'s own sales are their own read — once in NFT_TELEMINT_STALE_MS, one at a time, its calls waiting a park out; refused or part read, asked with the next head [round 117 — C5-1, C5-5]; each call in the market\'s turn [round 127 — C5-1]; one at a time however long it lasts, due again from its end [round 128 — C5-1]; a stalled one read again past five times it [round 129 — C5-1], its late end leaving the next read\'s mark [round 130 — C5-1]', async () => {
    const calls: any[] = [];
    const made: any[] = [];
    const sent: Array<{ url: string, done: (value: any) => void }> = [];
    let answerWith: () => Promise<any> = () => Promise.resolve([]);
    const env: Record<string, any> = {
      NFT_TELEMINT_STALE_MS: 120_000, walletNftTelemintCollection: (key: string) => key === 'c', walletNftViewOpen: () => true,
      createToncenterRestFetch: (options: any) => { made.push(options); return (url: string) => new Promise((done) => { sent.push({ url, done }); }); },
      toncenterRestOrigin: () => 'https://o', walletNftLearnPicture: () => {}, walletNftMarketPaint: () => {}, walletNftWithOwnBid: (listing: any) => listing,
      walletNftSetRead: (one: any, listing: any) => { one.listings.set(listing.sale, listing); return listing; },
      readTelemintListings: (args: any) => { calls.push(args); return answerWith(); },
      walletNftMarket: { turn: null }, NFT_TURN_WAIT_MS: 1_000,
    };
    const names = Object.keys(env);
    // eslint-disable-next-line no-new-func
    const { walletNftTelemintRead: run, walletNftTurn: turn } = new Function(...names, `${sourceBlock(app, 'async function walletNftTurn({ first = false, entry = null } = {}) {')}\n${sourceBlock(app, 'function walletNftTelemintRead(entry) {')}\nreturn { walletNftTelemintRead, walletNftTurn };`)(...names.map((n) => env[n]));
    const settle = async () => { for (let i = 0; i < 5; i += 1) await new Promise((done) => setTimeout(done, 0)); };
    const held = { kind: 'telemint', sale: 'g1', nft: 'g1', dataHash: 'd' };
    const entry: any = { collection: 'c', listings: new Map<string, any>([['s1', { kind: 'sale', sale: 's1', nft: 'n1' }], ['g1', held],
      ['g9', { kind: 'telemint', sale: 'g9', nft: 'g9', dataHash: 'd', ownBid: true }]]) };
    let release: (value: any) => void = () => {};
    answerWith = () => new Promise((done) => { release = done; });
    run(entry);
    run(entry);
    expect(calls, 'one at a time').toHaveLength(1);
    expect(made[0].requestOptions).toMatchObject({ priority: 'focus', skipIfRateLimited: false, rateLimitRetries: 1 });
    expect([...calls[0].held.keys()], 'the lots held, by their item').toEqual(['g1']);
    const free = await turn();
    void calls[0].fetchImpl('https://o/a');
    await settle();
    expect(sent, 'waits for the page in its turn').toHaveLength(0);
    free();
    await settle();
    void calls[0].fetchImpl('https://o/b');
    await settle();
    expect(sent.map((one) => one.url), 'one at a time').toEqual(['https://o/a']);
    sent[0].done({ ok: true });
    await settle();
    expect(sent.map((one) => one.url)).toEqual(['https://o/a', 'https://o/b']);
    sent[1].done({ ok: true });
    await settle();
    const started = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(started + 121_000);
    try {
      run(entry);
      expect(calls, 'one at a time however long it lasts').toHaveLength(1);
      release(Object.assign([{ kind: 'telemint', sale: 'g2', nft: 'g2' }], { unread: new Set() }));
      await settle();
      expect(entry.telemintDue, 'due two minutes from its end').toBe(started + 121_000 + 120_000);
    } finally {
      clock.mockRestore();
    }
    expect(entry.listings.get('g2')).toMatchObject({ listedAt: 0 });
    run(entry);
    expect(calls, 'not again within NFT_TELEMINT_STALE_MS').toHaveLength(1);
    entry.telemintDue = 0;
    answerWith = () => Promise.resolve(Object.assign([], { unread: new Set(['g3']) }));
    run(entry);
    expect([...calls[1].held.keys()], 'the lots held, the last read\'s among them').toEqual(['g1', 'g2']);
    await settle();
    expect([calls.length, entry.telemintDue]).toEqual([2, 0]);
    answerWith = () => Promise.reject(Object.assign(new Error('refused'), { code: 'RATE_LIMITED' }));
    run(entry);
    await settle();
    expect([calls.length, entry.telemintDue]).toEqual([3, 0]);
    answerWith = () => Promise.resolve(Object.assign([], { unread: new Set() }));
    run(entry);
    await settle();
    expect(calls).toHaveLength(4);
    expect(entry.telemintDue, 'read whole: two minutes on').toBeGreaterThan(Date.now() + 100_000);
    run({ collection: 'other', listings: new Map() });
    expect(calls, 'not a Telemint collection').toHaveLength(4);
    const stalled: any = { collection: 'c', listings: new Map() };
    let endFirst: (value: any) => void = () => {};
    let failSecond: (error: any) => void = () => {};
    answerWith = () => new Promise((done) => { endFirst = done; });
    const t0 = Date.now();
    run(stalled);
    answerWith = () => new Promise((_done, fail) => { failSecond = fail; });
    const later = vi.spyOn(Date, 'now').mockReturnValue(t0 + 590_000);
    try {
      run(stalled);
      expect(calls, 'still the one within ten minutes').toHaveLength(5);
      later.mockReturnValue(t0 + 610_000);
      run(stalled);
      expect(calls, 'read again past them').toHaveLength(6);
      const second = stalled.telemintDue;
      endFirst(Object.assign([], { unread: new Set(['g4']) }));
      await settle();
      expect(stalled.telemintDue, 'a late end, part read').toBe(second);
      run(stalled);
      expect(calls, 'no read beside the second').toHaveLength(6);
      answerWith = () => new Promise(() => {});
      later.mockReturnValue(t0 + 1_220_000);
      run(stalled);
      expect(calls).toHaveLength(7);
      const third = stalled.telemintDue;
      failSecond(new Error('late'));
      await settle();
      expect(stalled.telemintDue, 'a late end, refused').toBe(third);
    } finally {
      later.mockRestore();
    }
  });

  it('AUCUI-05: one\'s own bid, sent and not on chain, is on its listing — the bid and the least after it, the auction\'s own arithmetic — until the chain has it, two minutes at most, then read again as the chain has it; a bid pressed meanwhile is at least that least [round 117 — C1-3, C7-2]; the bid as typed is refused before the password [round 117 — C7-3]', () => {
    vi.useFakeTimers();
    try {
      const market: any = { collections: new Map() };
      const paints = { count: 0 };
      const names = ['NFT_OWN_BID_PENDING_MS', 'walletNftOwnBids', 'auctionNextBid', 'telemintNextBid', 'walletNftMarket', 'walletNftMarketPaint'];
      // eslint-disable-next-line no-new-func
      const lifted = new Function(...names, `${sourceBlock(app, 'function walletNftNextBidAfter(listing, amount) {')}\n${sourceBlock(app, 'function walletNftWithOwnBid(listing) {')}\n`
        + `${sourceBlock(app, 'function walletNftOwnBidSent(fresh, amount, bidder) {')}\n${sourceBlock(app, 'function walletNftTakeListing(read, { paint = true } = {}) {')}\n`
        + `${sourceBlock(app, 'function walletNftHeldListing(listing) {')}\n${sourceBlock(app, 'function walletNftAsRead(listing) {')}\n`
        + 'return { walletNftWithOwnBid, walletNftOwnBidSent, walletNftTakeListing, walletNftHeldListing, walletNftAsRead };')(120_000, new Map(), auctionNextBid, telemintNextBid, market, () => { paints.count += 1; });
      const chain = { kind: 'auction', sale: 's', nft: 'n', lastBid: 10n * GRAM, bidder: 'x', nextBid: 11n * GRAM, price: 11n * GRAM, minStep: 5, dataHash: 'h' };
      market.collections.set('c', { listings: new Map([['s', { ...chain }]]) });
      market.collections.set('', { listings: new Map([['s', { ...chain }]]) });
      const held = (key = 'c') => market.collections.get(key).listings.get('s');
      lifted.walletNftOwnBidSent(chain, 20n * GRAM, 'me');
      expect(held(), 'on the listing at once, every view').toMatchObject({ lastBid: 20n * GRAM, bidder: 'me', nextBid: 21n * GRAM, price: 21n * GRAM, ownBid: true });
      expect(held('')).toMatchObject({ lastBid: 20n * GRAM, ownBid: true });
      lifted.walletNftTakeListing({ ...chain });
      expect(held()).toMatchObject({ lastBid: 20n * GRAM, nextBid: 21n * GRAM, ownBid: true });
      expect(lifted.walletNftWithOwnBid({ ...chain }).nextBid, 'a second Bid pressed before the first lands').toBe(21n * GRAM);
      expect(lifted.walletNftWithOwnBid(held()).nextBid, 'the listing drawn with it, asked again (the Bid window): still on').toBe(21n * GRAM);
      expect(lifted.walletNftWithOwnBid({ ...chain }).nextBid).toBe(21n * GRAM);
      lifted.walletNftTakeListing({ ...chain, lastBid: 20n * GRAM, bidder: 'me', nextBid: 21n * GRAM, price: 21n * GRAM, dataHash: 'h2' });
      expect(held()).toMatchObject({ lastBid: 20n * GRAM, ownBid: false, dataHash: 'h2' });
      expect(lifted.walletNftWithOwnBid({ ...chain }).nextBid, 'ended: the chain\'s least').toBe(11n * GRAM);
      vi.advanceTimersByTime(120_000);
      expect(held(), 'its time over after it landed: nothing undone').toMatchObject({ lastBid: 20n * GRAM, dataHash: 'h2' });
      market.collections.get('c').listings.set('s', { ...chain });
      lifted.walletNftOwnBidSent(chain, 30n * GRAM, 'me');
      expect(held()).toMatchObject({ lastBid: 30n * GRAM, ownBid: true });
      market.collections.get('').listings.set('s', { ...chain, lastBid: 40n * GRAM, bidder: 'y', dataHash: 'h4' });
      const before = paints.count;
      vi.advanceTimersByTime(119_999);
      expect(held().ownBid).toBe(true);
      vi.advanceTimersByTime(1);
      expect(held(), 'not drawn leading for the session').toMatchObject({ lastBid: 10n * GRAM, bidder: 'x', nextBid: 11n * GRAM, price: 11n * GRAM, ownBid: false, dataHash: '' });
      expect(held(''), 'read anew: kept').toMatchObject({ lastBid: 40n * GRAM, bidder: 'y', dataHash: 'h4' });
      expect(paints.count - before, 'drawn again once').toBe(1);
      expect(lifted.walletNftWithOwnBid({ ...chain }).nextBid).toBe(11n * GRAM);
      market.collections.get('c').listings.set('s', { ...chain });
      lifted.walletNftOwnBidSent(chain, 50n * GRAM, 'me');
      expect(held()).toMatchObject({ lastBid: 50n * GRAM, ownBid: true });
      lifted.walletNftTakeListing({ ...chain, lastBid: 12n * GRAM, bidder: 'z', nextBid: 13n * GRAM, price: 13n * GRAM, dataHash: 'h5' });
      expect(held(), 'another\'s bid first').toMatchObject({ lastBid: 12n * GRAM, bidder: 'z', nextBid: 13n * GRAM, ownBid: false });
      expect(lifted.walletNftWithOwnBid({ ...chain, lastBid: 12n * GRAM, bidder: 'z', nextBid: 13n * GRAM }).nextBid).toBe(13n * GRAM);
      expect(lifted.walletNftHeldListing({ ...chain }), 'held: what came since').toBe(held());
      expect(lifted.walletNftHeldListing({ ...chain, sale: 'none' }), 'not held: as it is').toMatchObject({ sale: 'none' });
      market.collections.get('').listings.set('s2', { sale: 's2', collection: 'x', lastBid: 1n * GRAM });
      market.collections.set('x', { listings: new Map([['s2', { sale: 's2', collection: 'x', lastBid: 2n * GRAM }]]) });
      expect(lifted.walletNftHeldListing({ sale: 's2', collection: 'x' }).lastBid, 'the collection\'s own copy').toBe(2n * GRAM);
      expect(lifted.walletNftHeldListing({ sale: 's2', collection: 'gone' }).lastBid, 'none of its own: any view\'s').toBe(1n * GRAM);
      market.collections.get('c').listings.set('s', { ...chain });
      lifted.walletNftOwnBidSent(chain, 60n * GRAM, 'me');
      const over = { ...held(), lastBid: 12n * GRAM, bidder: 'z', nextBid: 13n * GRAM, price: 13n * GRAM, dataHash: 'h7' };
      expect(over.ownBid, 'the mark carried over').toBe(true);
      expect(lifted.walletNftWithOwnBid(over).lastBid, 'marked: taken for one\'s own').toBe(60n * GRAM);
      lifted.walletNftTakeListing(lifted.walletNftAsRead(over));
      expect(held(), 'read as the chain\'s: another\'s bid ends it').toMatchObject({ lastBid: 12n * GRAM, bidder: 'z', nextBid: 13n * GRAM, ownBid: false });
      expect(lifted.walletNftAsRead(chain), 'unmarked: as it is').toBe(chain);
      expect(code(sourceBlock(app, 'async function walletNftRecheckShown(entry, named, fetchImpl) {'))).toContain('else if (fresh.dataHash && fresh.dataHash === dataAsked.get(sale)) walletNftTakeItemLt(sale, fresh.itemLt);');
      const pressRead = code(sourceBlock(app, 'async function walletNftListingFresh(listing) {'));
      expect(pressRead).toContain("return fresh?.kind === 'auction' ? walletNftAsRead(fresh) : null;");
      expect(pressRead).toContain('return walletNftAsRead(telemintListingOf(listing, await readTelemintAuction(');
      // eslint-disable-next-line no-new-func
      const refusal = new Function('walletNftForgetListing', 'walletNftTakeListing', 't', 'nftGram', 'walletPressRefusal',
        `${sourceBlock(app, 'function walletNftPressRefusal(listing, error, signing) {')}\nreturn walletNftPressRefusal;`)(
        () => {}, lifted.walletNftTakeListing, (key: string) => key, (units: bigint) => String(units), () => 'other');
      market.collections.get('c').listings.set('s', { ...chain });
      lifted.walletNftOwnBidSent(chain, 70n * GRAM, 'me');
      const bidRead = { ...chain, lastBid: 90n * GRAM, bidder: 'z', nextBid: 96n * GRAM, price: 96n * GRAM, dataHash: 'h8', live: true };
      expect(lifted.walletNftWithOwnBid(bidRead).nextBid, 'the press\'s read: the chain\'s least, one\'s own ended').toBe(96n * GRAM);
      expect(held(), 'the card before the refusal: still one\'s own').toMatchObject({ lastBid: 70n * GRAM, ownBid: true });
      expect(refusal({ sale: 's' }, { code: 'NFT_BID_LOW', least: 96n * GRAM, fresh: bidRead }, false)).toBe('nft.bidTooLow');
      expect(held(), 'after it: the chain\'s').toMatchObject({ lastBid: 90n * GRAM, bidder: 'z', nextBid: 96n * GRAM, ownBid: false });
      expect(code(sourceBlock(app, 'async function walletNftLookupName() {')), 'a name\'s read, as every read [round 133 — C7-2]')
        .toContain('for (const listing of listings) walletNftSetRead(entry, { ...listing, listedAt: listing.createdAt });');
      const behind = { ...chain, sale: 'q' };
      market.collections.set('q', { listings: new Map([['q', { ...behind }]]) });
      lifted.walletNftOwnBidSent(behind, 50n * GRAM, 'me');
      lifted.walletNftTakeListing({ ...behind, lastBid: 9n * GRAM, bidder: 'y', nextBid: 10n * GRAM, price: 10n * GRAM, dataHash: 'h6' });
      expect(market.collections.get('q').listings.get('q'), 'a read behind the press\'s own').toMatchObject({ lastBid: 50n * GRAM, nextBid: 52_500_000_000n, ownBid: true });
      const open = { ...chain, sale: 'o', maxBid: 0n };
      market.collections.set('o', { listings: new Map([['o', { ...open }]]) });
      lifted.walletNftOwnBidSent(open, 20n * GRAM, 'me');
      expect(market.collections.get('o').listings.get('o'), 'no buy-now: the step').toMatchObject({ nextBid: 21n * GRAM, ownBid: true });
      expect(telemintNextBid({ lastBid: 10n * GRAM, minStep: 5 })).toBe(11n * GRAM);
      expect(telemintNextBid({ lastBid: 100n * GRAM, minStep: 5 })).toBe(105n * GRAM);
      expect(telemintNextBid({ lastBid: 30_000_000_001n, minStep: 5 }), 'rounded up').toBe(31_500_000_002n);
      const now = Math.floor(Date.now() / 1000);
      expect(telemintListingOf({ nft: addr('17') }, { beneficiary: addr('be'), minBid: GRAM, maxBid: 0n, endTime: now + 600, lastBid: 0n, bidder: null, minStep: 7 }, { now })?.minStep).toBe(7);
      const item = { kind: 'telemint', sale: 't', nft: 't', lastBid: 0n, bidder: null, nextBid: 5n * GRAM, price: 5n * GRAM, minStep: 5 };
      market.collections.set('t', { listings: new Map([['t', { ...item }]]) });
      lifted.walletNftOwnBidSent(item, 5n * GRAM, 'me');
      expect(market.collections.get('t').listings.get('t')).toMatchObject({ lastBid: 5n * GRAM, nextBid: 6n * GRAM, ownBid: true });
      const near = { ...chain, sale: 'v', maxBid: 8n * GRAM, lastBid: 7n * GRAM, nextBid: 7_350_000_000n, price: 7_350_000_000n };
      market.collections.set('v', { listings: new Map([['v', { ...near }]]) });
      lifted.walletNftOwnBidSent(near, 7_700_000_000n, 'me');
      expect(market.collections.get('v').listings.get('v'), 'v3r3: 8.085 past 8').toMatchObject({ nextBid: 8n * GRAM, price: 8n * GRAM, ownBid: true });
      const nearItem = { ...item, sale: 'w', maxBid: 10n * GRAM };
      market.collections.set('w', { listings: new Map([['w', { ...nearItem }]]) });
      lifted.walletNftOwnBidSent(nearItem, 9_990_000_000n, 'me');
      expect(market.collections.get('w').listings.get('w'), 'an item\'s own sale: 10.99 past 10').toMatchObject({ nextBid: 10n * GRAM, ownBid: true });
      const unknown = { ...item, sale: 'u', minStep: null };
      market.collections.set('u', { listings: new Map([['u', { ...unknown }]]) });
      lifted.walletNftOwnBidSent(unknown, 5n * GRAM, 'me');
      expect(market.collections.get('u').listings.get('u'), 'no step known: the least not guessed').toMatchObject({ lastBid: 5n * GRAM, nextBid: 5n * GRAM });
    } finally {
      vi.useRealTimers();
    }
    const bid = code(sourceBlock(app, 'async function openNftBidDialog(listing, hold) {'));
    const password = bid.indexOf('const passwordRefusal = await spendPasswordRefusal(submitted);');
    for (const one of ["if (amount === null || amount <= 0n) return { ok: false, error: t('nft.bidAmountInvalid') };",
      "if (amount < shown.nextBid) return { ok: false, error: t('nft.bidTooLow', { amount: gram(shown.nextBid) }) };",
      "if (shown.maxBid > 0n && amount >= shown.maxBid) return { ok: false, error: t('nft.bidIsBuyNow', { amount: gram(shown.maxBid) }) };"]) {
      expect(bid.indexOf(one), one).toBeGreaterThan(-1);
      expect(bid.indexOf(one), `${one} — before the password`).toBeLessThan(password);
    }
    expect(bid).toContain('const shown = walletNftWithOwnBid(walletNftHeldListing(listing));');
    expect(bid, 'not the listing as it was when the window opened [round 132 — C1-4]').not.toContain('walletNftWithOwnBid(listing)');
    expect(bid).toContain("{ label: t('nft.nextBid'), value: gram(shown.nextBid) },");
    expect(bid).toContain("...(shown.maxBid > 0n ? [{ label: t('nft.buyNow'), value: gram(shown.maxBid) }] : []),");
    expect(bid).toContain("...(shown.endTime && shown.endTime !== TELEMINT_NO_END ? [{ label: t('nft.endsAt'), value: walletNftEndText(shown.endTime) }] : []),");
    expect(bid, 'nothing of the listing as the window opened').not.toMatch(/listing\.(maxBid|endTime|lastBid|nextBid)/);
  });

  it('AUCUI-06: a dollar amount in cents from $1, thousands spaced — in a listing window and a trader\'s total [round 118 — C7-4]; the pair of trade buttons on one line [round 117 — C7-6]', () => {
    expect([55.9303, 6.4879, 1, 87.2513, 12_345.678, 999.999].map(formatUsdAmount)).toEqual(['55.93', '6.49', '1.00', '87.25', '12 345.68', '1 000.00']);
    expect([0.1099, 0.1527, 0.9877, 0.5, 0.01].map(formatUsdAmount), 'under $1 in cents too [round 132 — C7-3]').toEqual(['0.11', '0.15', '0.99', '0.50', '0.01']);
    expect(formatUsdAmount(0.000123), 'under a cent: as a price').toBe(formatPrice(0.000123));
    expect(formatUsdAmount(0.0099)).toBe(formatPrice(0.0099));
    expect([3.3e21, 1e25].map(formatUsdAmount)).toEqual([formatPrice(3.3e21), formatPrice(1e25)]);
    expect([3.3e21, 1e25].map(formatUsdAmount).join(' '), 'digits only').toMatch(/^[\d ]+$/);
    expect([9.99e20, 1e13].map(formatUsdAmount), 'from $10 trillion: whole dollars').toEqual([formatPrice(9.99e20), '10 000 000 000 000']);
    expect(formatUsdAmount(9_999_999_999_999.99)).toBe('9 999 999 999 999.99');
    expect(app).toContain('const withUsd = (units) => `${gram(units)}${gramPerUsd ? ` ($${formatUsdAmount(Number(units) / 1e9 / gramPerUsd)})` : \'\'}`;');
    expect(app).toContain('GRAM${gramPerUsd ? ` ($${formatUsdAmount(holdings.total / gramPerUsd)})` : \'\'}`;');
    const css = readFileSync('web/styles.css', 'utf8');
    expect(css).toContain('.wallet-market-trade-buttons { margin-top: 12px; }');
    expect(css).toContain('.wallet-market-trade-buttons > .wallet-card-send { margin-top: 0; }');
  });

  it('HIST-01: History says a bid this wallet placed and its return — toncenter\'s auction_bid / auction_outbid, with no GRAM transfer beside them [MEASURED on live traces]', () => {
    const self = addr('0a');
    const action = (type: string, details: any, at = NOW) => ({ type, details, end_utime: at, action_id: `${type}-${at}`, trace_id: `t-${at}`, success: true });
    const payload = { actions: [
      action('auction_bid', { bidder: self, auction: addr('ac'), nft_item: addr('a1'), nft_collection: NFT_PINNED_COLLECTIONS[0], amount: '152000000000' }, NOW),
      action('auction_outbid', { bidder: self, new_bidder: addr('0b'), auction_address: addr('ac'), nft_item: addr('a1'), nft_collection: NFT_PINNED_COLLECTIONS[0], amount: '152000000000' }, NOW + 60),
      action('auction_bid', { bidder: addr('0b'), auction: addr('ac'), nft_item: addr('a1'), nft_collection: NFT_PINNED_COLLECTIONS[0], amount: '160000000000' }, NOW + 60),
      action('auction_outbid', { bidder: addr('0c'), new_bidder: self, auction_address: addr('ad'), nft_item: addr('a2'), amount: '5' }, NOW + 90),
    ], metadata: { [addr('a1')]: { is_indexed: true, token_info: [{ valid: true, type: 'nft_items', name: '@madeup' }] } } };
    const rows = parseWalletHistory(payload, self);
    expect(rows.map((row: any) => [row.trade, row.direction, row.amount, row.counterparty, row.nftName])).toEqual([
      ['outbid', 'in', '152000000000', addr('ac'), '@madeup'],
      ['bid', 'out', '152000000000', addr('ac'), '@madeup'],
    ]);
    expect(rows[0]).toMatchObject({ kind: 'nft', symbol: 'GRAM', decimals: 9, verified: true, collection: NFT_PINNED_COLLECTIONS[0] });
    const drawn = app.indexOf("const grams = BigInt(row.amount || '0') > 0n && !wonBids.has(row.id) ? ");
    expect(drawn).toBeGreaterThan(-1);
    const shown = app.slice(drawn, drawn + 3000);
    expect(shown).toContain("(row.trade === 'bought' || row.trade === 'bid') && grams ? `−${grams}` : (row.trade === 'sold' || row.trade === 'outbid') && grams ? `+${grams}` : '';");
    expect(shown).toContain("bid: 'wallet.historyNftBid',");
    expect(shown).toContain("outbid: 'wallet.historyNftOutbid' }[row.trade]");
  });

  it('HIST-02: a won bid is paid once — its purchase carries the GRAM, the bid none (or no row, in one trace); a returned bid keeps −X beside +X; an open bid keeps −X [round 117 — C1-1]', () => {
    const self = addr('0a');
    const action = (type: string, details: any, at: number, trace: string, success = true) => ({ type, details, end_utime: at, action_id: `${type}-${at}-${trace}`, trace_id: trace, success });
    const collection = NFT_PINNED_COLLECTIONS[1];
    const bid = (item: string, amount: string, at: number, trace: string, success = true) => action('auction_bid', { bidder: self, auction: item, nft_item: item, nft_collection: collection, amount }, at, trace, success);
    const back = (item: string, amount: string, at: number, trace: string) => action('auction_outbid', { bidder: self, new_bidder: addr('0b'), auction_address: item, nft_item: item, nft_collection: collection, amount }, at, trace);
    const bought = (item: string, price: string, at: number, trace: string) => action('nft_purchase', { new_owner: self, real_old_owner: addr('0f'), old_owner: item, nft_item: item, nft_collection: collection, price }, at, trace);
    const won = parseWalletHistory({ actions: [
      bid(addr('a1'), '2800000000000', NOW, 'tA'), bought(addr('a1'), '2800000000000', NOW + 600, 'tB'),
      bid(addr('a2'), '50100000000', NOW + 10, 'tC'), bought(addr('a2'), '50000000000', NOW + 10, 'tC'),
      bid(addr('a3'), '4700000000', NOW + 20, 'tD'), back(addr('a3'), '4694300000', NOW + 30, 'tE'), bid(addr('a3'), '5050000000', NOW + 40, 'tF'),
      bought(addr('a3'), '5050000000', NOW + 90, 'tG'),
      bid(addr('a4'), '9000000000', NOW + 50, 'tH'),
      bid(addr('a5'), '1000', NOW + 60, 'tI', false), bought(addr('a5'), '7000000000', NOW + 70, 'tJ'),
    ] }, self);
    const settled = wonBidsOf(won);
    const label = (row: any) => `${row.trade}:${row.master.slice(2, 4)}:${row.amount}`;
    expect(won.filter((row: any) => settled.get(row.id) === 'paid').map(label).sort()).toEqual(['bid:a1:2800000000000', 'bid:a3:5050000000']);
    expect(won.filter((row: any) => settled.get(row.id) === 'folded').map(label)).toEqual(['bid:a2:50100000000']);
    expect(settled.size).toBe(3);
    const drawn = (item: string) => won.filter((row: any) => row.master === item && row.success && !settled.has(row.id))
      .reduce((sum: bigint, row: any) => sum + (row.trade === 'outbid' || row.trade === 'sold' ? BigInt(row.amount) : -BigInt(row.amount)), 0n);
    expect([drawn(addr('a1')), drawn(addr('a2')), drawn(addr('a3')), drawn(addr('a4'))]).toEqual([-2800n * GRAM, -50n * GRAM, -5_055_700_000n, -9n * GRAM]);
    const body = code(sourceBlock(app, 'function renderWalletHistory(panel) {'));
    expect(body).toContain('const { rows, won: wonBids } = historyRowsOf(walletAssetsState.history ?? []);');
    expect(body).toContain("if (wonBids.get(row.id) === 'folded') continue;");
    expect(body).toContain("const grams = BigInt(row.amount || '0') > 0n && !wonBids.has(row.id) ? `${formatUnits(row.amount, 9)} GRAM` : '';");
  });

  it('HIST-03: a raise of one\'s own lead returns the bid before it in the raise\'s own trace — that return is the earlier bid\'s; won, the auction is paid once [round 118 — C1-1]', () => {
    const self = addr('0a');
    const action = (type: string, details: any, at: number, trace: string) => ({ type, details, end_utime: at, action_id: `${type}-${at}-${trace}`, trace_id: trace, success: true });
    const collection = NFT_PINNED_COLLECTIONS[1];
    const bid = (item: string, amount: string, at: number, trace: string) => action('auction_bid', { bidder: self, auction: item, nft_item: item, nft_collection: collection, amount }, at, trace);
    const back = (item: string, amount: string, at: number, trace: string, by = self) => action('auction_outbid', { bidder: self, new_bidder: by, auction_address: item, nft_item: item, nft_collection: collection, amount }, at, trace);
    const bought = (item: string, price: string, at: number, trace: string) => action('nft_purchase', { new_owner: self, real_old_owner: addr('0f'), old_owner: item, nft_item: item, nft_collection: collection, price }, at, trace);
    const rows = parseWalletHistory({ actions: [
      bid(addr('a1'), '5250000000', NOW, 'tA'), bid(addr('a1'), '10500000000', NOW + 100, 'tB'), back(addr('a1'), '5249158598', NOW + 100, 'tB'),
      bought(addr('a1'), '10500000000', NOW + 900, 'tC'),
      bid(addr('a2'), '2000000000', NOW + 10, 'tD'), bid(addr('a2'), '3000000000', NOW + 20, 'tE'), back(addr('a2'), '1994300000', NOW + 20, 'tE'),
      bid(addr('a2'), '4000000000', NOW + 30, 'tF'), back(addr('a2'), '2994300000', NOW + 30, 'tF'), bought(addr('a2'), '4000000000', NOW + 800, 'tG'),
      bid(addr('a3'), '10000000000', NOW + 40, 'tH'), bid(addr('a3'), '100100000000', NOW + 50, 'tI'), back(addr('a3'), '9994300000', NOW + 50, 'tI'),
      bought(addr('a3'), '100000000000', NOW + 50, 'tI'),
      bid(addr('a4'), '1000000000', NOW + 60, 'tJ'), bid(addr('a4'), '2000000000', NOW + 70, 'tK'), back(addr('a4'), '994300000', NOW + 70, 'tK'),
      back(addr('a4'), '1994300000', NOW + 80, 'tL', addr('0b')),
      bid(addr('a5'), '3000000000', NOW + 200, 'tM'), bought(addr('a5'), '3000000000', NOW + 210, 'tN'),
      bid(addr('a5'), '6000000000', NOW + 300, 'tO'), back(addr('a5'), '5994300000', NOW + 310, 'tP', addr('0b')),
    ] }, self);
    const settled = wonBidsOf(rows);
    const drawn = (item: string) => rows.filter((row: any) => row.master === item && row.success && !settled.has(row.id))
      .reduce((sum: bigint, row: any) => sum + (row.trade === 'outbid' ? BigInt(row.amount) : -BigInt(row.amount)), 0n);
    expect(drawn(addr('a1'))).toBe(-10_500_000_000n - 841_402n);
    expect(drawn(addr('a2'))).toBe(-4_000_000_000n - 2n * 5_700_000n);
    expect(drawn(addr('a3'))).toBe(-100_000_000_000n - 5_700_000n);
    expect(drawn(addr('a4'))).toBe(-2n * 5_700_000n);
    expect(drawn(addr('a5'))).toBe(-3_000_000_000n - 5_700_000n);
    const label = (row: any) => `${row.master.slice(2, 4)}:${row.amount}`;
    expect(rows.filter((row: any) => settled.get(row.id) === 'paid').map(label).sort()).toEqual(['a1:10500000000', 'a2:4000000000', 'a5:3000000000']);
    expect(rows.filter((row: any) => settled.get(row.id) === 'folded').map(label)).toEqual(['a3:100100000000']);
  });

  it('HIST-06: a bid is paid only by a purchase from its own auction — a bid returned as a plain transfer, or won on an item\'s own sale, keeps its GRAM when the NFT is later bought on another sale [round 119 — C1-3; round 118 — C1-2]', () => {
    const self = addr('0a');
    const collection = NFT_PINNED_COLLECTIONS[1];
    const action = (type: string, details: any, at: number, trace: string) => ({ type, details, end_utime: at, action_id: `${type}-${at}-${trace}`, trace_id: trace, success: true });
    const bid = (item: string, auction: string, amount: string, at: number, trace: string) => action('auction_bid', { bidder: self, auction, nft_item: item, nft_collection: collection, amount }, at, trace);
    const bought = (item: string, sale: string, price: string, at: number, trace: string) => action('nft_purchase', { new_owner: self, real_old_owner: addr('0f'), old_owner: sale, nft_item: item, nft_collection: collection, price }, at, trace);
    const rows = parseWalletHistory({ actions: [
      bid(addr('a1'), addr('ac'), '10000000000', NOW, 'tA'),
      action('ton_transfer', { source: addr('ac'), destination: self, value: '9994300000', comment: 'Your bid has been outbid by another user.' }, NOW + 10, 'tB'),
      bought(addr('a1'), addr('5a'), '20000000000', NOW + 100, 'tC'),
      bid(addr('a2'), addr('a2'), '5000000000', NOW + 20, 'tD'),
      action('nft_transfer', { old_owner: addr('0e'), new_owner: self, nft_item: addr('a2'), nft_collection: collection }, NOW + 30, 'tE'),
      bought(addr('a2'), addr('5b'), '15000000000', NOW + 200, 'tF'),
      bid(addr('a3'), addr('ad'), '7000000000', NOW + 40, 'tG'), bought(addr('a3'), addr('ad'), '7000000000', NOW + 300, 'tH'),
    ] }, self);
    const settled = wonBidsOf(rows);
    expect(rows.filter((row: any) => settled.has(row.id)).map((row: any) => `${row.master.slice(2, 4)}:${settled.get(row.id)}`)).toEqual(['a3:paid']);
    expect(rows.find((row: any) => row.trade === 'bought' && row.master === addr('a3'))?.sale).toBe(addr('ad'));
  });

  it('HIST-04: an item\'s own sale pays its seller by Telemint\'s fill_up, a contract call to toncenter — drawn as GRAM received, in a trace the seller started too; the buyer\'s bid, handed the item in its trace, a purchase [round 119 — C1-1; round 117 — C7-1]', () => {
    const self = addr('0a');
    const item = addr('17');
    const call = (source: string, destination: string, opcode: string, value: string, trace: string) => ({ type: 'call_contract', end_utime: NOW, action_id: `cc-${destination}-${opcode}`,
      trace_id: trace, success: true, details: { source, destination, opcode, value } });
    const trace = [
      { type: 'auction_bid', end_utime: NOW, action_id: 'bid', trace_id: 'tS', success: true,
        details: { bidder: addr('b1'), auction: item, nft_item: item, nft_collection: NFT_PINNED_COLLECTIONS[0], amount: '31000000000' } },
      call(item, addr('b1'), '0x05138d91', '0', 'tS'),
      call(item, addr('40'), '0x370fec51', '1549933000', 'tS'),
      call(item, self, '0x370fec51', '29449066609', 'tS'),
    ];
    const rows = parseWalletHistory({ actions: trace }, self);
    expect(rows.map((row: any) => [row.kind, row.direction, row.amount, row.counterparty, row.payment])).toEqual([['gram', 'in', '29449066609', item, 'sale']]);
    const poked = parseWalletHistory({ actions: [{ type: 'call_contract', end_utime: NOW, action_id: 'poke', trace_id: 'tS', success: true,
      details: { source: self, destination: item, opcode: '0x00000000', value: '50000000' } }, ...trace] }, self);
    expect(poked.filter((row: any) => row.kind === 'gram' && row.direction === 'in').map((row: any) => [row.amount, row.payment]), 'a sale, never a refund').toEqual([['29449066609', 'sale']]);
    expect(parseWalletHistory({ actions: [call(item, self, '0xd53276db', '5000000', 'tX')] }, self)).toEqual([]);
    expect(parseWalletHistory({ actions: [call(self, item, '0x370fec51', '5000000', 'tY')] }, self), 'a top-up this wallet sends is a contract call, out of History').toEqual([]);
    expect(parseWalletHistory({ actions: trace }, addr('b1')).map((row: any) => [row.trade, row.direction, row.amount, row.sale]), 'the buyer: one row, a purchase')
      .toEqual([['bought', 'in', '31000000000', item]]);
  });

  it('HIST-05: a sale whose NFT sends its rest back to the seller shows its payout at once, then what it brought — the purchase\'s own GRAM in, less what the wallet sent in the trace that no row says; read once, beside the page [rounds 119–120 — C1-2, C1-1]', async () => {
    const self = addr('0a');
    const purchase = (trace: string, extra: any = {}) => ({ type: 'nft_purchase', end_utime: NOW, action_id: `p-${trace}`, trace_id: trace,
      success: true, transactions: [`h1-${trace}`, `h2-${trace}`],
      details: { nft_item: addr('a1'), nft_collection: NFT_PINNED_COLLECTIONS[0], old_owner: addr('ac'), real_old_owner: self, new_owner: addr('b1'), price: '6500000000',
        payout_address: self, payout_amount: '5939933333', response_destination: self, ...extra } });
    const tx = (hash: string, account: string, value: string, source: string | null = addr('ac'), outs: string[] = []) => ({ hash, account,
      in_msg: { source, destination: account, value }, out_msgs: outs.map((v) => ({ destination: addr('ac'), value: v })) });
    const trace = (...transactions: any[]) => ({ traces: [{ transactions: Object.fromEntries(transactions.map((one) => [one.hash, one])) }] });
    const asked: string[] = [];
    const serve = (actions: any[], body: any) => async (url: string) => {
      asked.push(url);
      if (url.includes('/api/v3/actions?')) return { ok: true, json: async () => ({ actions, metadata: {} }) };
      return body ? { ok: true, json: async () => body } : { ok: false, status: 429 };
    };
    const read = (actions: any[], body: any) => new Promise<any>((done) => {
      let page: any = null;
      const timer = setTimeout(() => done({ page, landed: false }), 200);
      void readWalletHistory({ account: self, origin: 'https://o', fetchImpl: serve(actions, body) as any,
        onSaleRests: () => { clearTimeout(timer); setTimeout(() => done({ page, landed: true }), 0); } }).then((one) => { page = one; });
    });
    const royalty = { type: 'ton_transfer', end_utime: NOW, action_id: 'r-tA', trace_id: 'tA', success: true, details: { source: addr('ac'), destination: self, value: '389900000' } };
    const first = await readWalletHistory({ account: self, origin: 'https://o', fetchImpl: serve([purchase('tW')], null) as any });
    expect(first.rows[0].amount, 'drawn at once with its payout').toBe('5939933333');
    expect('rest' in first.rows[0]).toBe(false);
    const a = await read([purchase('tA'), royalty], trace(tx('h1-tA', self, '5939933333'), tx('h2-tA', self, '521576000', addr('a1')), tx('h9-tA', self, '389900000'),
      tx('hB-tA', addr('b1'), '6500000000', null, ['6500000000'])));
    expect(a.landed).toBe(true);
    expect(a.page.rows.find((row: any) => row.trade === 'sold').amount).toBe('6461509333');
    expect(a.page.rows.find((row: any) => row.kind === 'gram')?.amount, 'the royalty: its own row').toBe('389900000');
    expect(asked.at(-1)).toContain('/api/v3/traces?trace_id=tA');
    const quick = await readWalletHistory({ account: self, origin: 'https://o',
      fetchImpl: serve([purchase('tQ')], trace(tx('h1-tQ', self, '5939933333'), tx('h2-tQ', self, '521576000', addr('a1')))) as any });
    expect(quick.rows[0].amount).toBe('5939933333');
    await new Promise((done) => setTimeout(done, 20));
    expect(quick.rows[0].amount, 'then what it brought').toBe('6461509333');
    const own = await read([purchase('tS')], trace(tx('tS', self, '0', null, ['200000000']), tx('h1-tS', self, '5649933333'), tx('h2-tS', self, '217000000', addr('a1')),
      { hash: 'tS2', account: self, in_msg: { source: null, destination: self, value: '0' }, out_msgs: [{ destination: addr('ae'), value: '200000000' }] }));
    expect(own.page.rows[0].amount).toBe('5666933333');
    const stop = { type: 'ton_transfer', end_utime: NOW, action_id: 's-tT', trace_id: 'tT', success: true, details: { source: self, destination: addr('ac'), value: '200000000', comment: 'stop' } };
    const drawnStop = await read([purchase('tT'), stop], trace(tx('tT', self, '0', null, ['200000000']), tx('h1-tT', self, '5649933333'), tx('h2-tT', self, '217000000', addr('a1'))));
    expect(drawnStop.page.rows.find((row: any) => row.trade === 'sold').amount).toBe('5866933333');
    const elsewhere = { ...stop, action_id: 's-tU', trace_id: 'tU', details: { ...stop.details, destination: addr('b7'), value: '1000000000' } };
    const otherRow = await read([purchase('tU'), elsewhere], trace({ hash: 'tU', account: self, in_msg: { source: null, destination: self, value: '0' }, out_msgs: [{ destination: addr('ac'), value: '200000000' },
      { destination: addr('b7'), value: '1000000000' }] }, tx('h1-tU', self, '5649933333'),
      tx('h2-tU', self, '217000000', addr('a1'))));
    expect(otherRow.page.rows.find((row: any) => row.trade === 'sold').amount).toBe('5666933333');
    asked.length = 0;
    const again = await readWalletHistory({ account: self, origin: 'https://o', fetchImpl: serve([purchase('tA')], null) as any });
    expect([again.rows[0].amount, asked.length]).toEqual(['6461509333', 1]);
    expect((await read([purchase('tB')], null)).page.rows[0].amount).toBe('5939933333');
    expect((await read([purchase('tB')], trace(tx('h1-tB', self, '5939933333'), tx('h2-tB', self, '521576000', addr('a1'))))).page.rows[0].amount).toBe('6461509333');
    const missed = await read([purchase('tD')], trace(tx('h7', self, '1')));
    expect([missed.landed, missed.page.rows[0].amount]).toEqual([false, '5939933333']);
    const over = await read([purchase('tO')], trace(tx('tO', self, '0', null, ['9000000000']), tx('h1-tO', self, '100000000')));
    expect([over.landed, over.page.rows[0].amount]).toEqual([false, '5939933333']);
    expect(app).toContain("onSaleRests: () => { if (owner === state.owner && state.tab === 'history' && isVaultViewActive()) renderWalletAssets('history'); },");
    asked.length = 0;
    const plain = await readWalletHistory({ account: self, origin: 'https://o', fetchImpl: serve([purchase('tC', { response_destination: addr('b1') })], trace()) as any });
    await new Promise((done) => setTimeout(done, 20));
    expect([plain.rows[0].amount, asked.length]).toEqual(['5939933333', 1]);
    asked.length = 0;
    await read(['tE', 'tF', 'tG', 'tH', 'tI', 'tJ'].map((one) => purchase(one)), trace());
    expect(asked.filter((url) => url.includes('/api/v3/traces?'))).toHaveLength(6);
    const six = ['tV1', 'tV2', 'tV3', 'tV4', 'tV5', 'tV6'];
    const whole = await new Promise<any>((done) => {
      let landed = 0;
      let held: any = null;
      void readWalletHistory({ account: self, origin: 'https://o',
        onSaleRests: () => { landed += 1; if (landed === six.length) setTimeout(() => done(held), 0); },
        fetchImpl: serve(six.map((one) => purchase(one)), trace(...six.flatMap((one) => [tx(`h1-${one}`, self, '5939933333'), tx(`h2-${one}`, self, '521576000', addr('a1'))]))) as any })
        .then((one) => { held = one; });
    });
    expect(whole.rows.map((row: any) => row.amount), 'six sales on a page read once: all six whole').toEqual(six.map(() => '6461509333'));
    asked.length = 0;
    const two = await read([purchase('tK'), { ...purchase('tK'), action_id: 'p-tK-2', transactions: ['h3-tK'] }],
      trace(tx('h1-tK', self, '5939933333'), tx('h3-tK', self, '20000000000')));
    expect(two.page.rows.map((row: any) => row.amount).sort()).toEqual(['20000000000', '5939933333']);
    expect(asked.filter((url) => url.includes('/api/v3/traces?')), 'one trace read once').toHaveLength(1);
    let drawnAgain = 0;
    await readWalletHistory({ account: self, origin: 'https://o', onSaleRests: () => { drawnAgain += 1; },
      fetchImpl: serve([purchase('tM'), purchase('tN')], { traces: [{ transactions: Object.fromEntries([tx('h1-tM', self, '5939933333'), tx('h2-tM', self, '1', addr('a1')),
        tx('h1-tN', self, '5939933333'), tx('h2-tN', self, '1', addr('a1'))].map((one) => [one.hash, one])) }] }) as any });
    await new Promise((done) => setTimeout(done, 20));
    expect(drawnAgain).toBe(2);
    asked.length = 0;
    let release: (value: any) => void = () => {};
    const slow = async (url: string) => {
      asked.push(url);
      if (url.includes('/api/v3/actions?')) return { ok: true, json: async () => ({ actions: [purchase('tL')], metadata: {} }) };
      await new Promise((done) => { release = done; });
      return { ok: true, json: async () => trace(tx('h1-tL', self, '5939933333'), tx('h2-tL', self, '521576000', addr('a1'))) };
    };
    const firstRead = await readWalletHistory({ account: self, origin: 'https://o', fetchImpl: slow as any });
    const secondRead = await readWalletHistory({ account: self, origin: 'https://o', fetchImpl: slow as any });
    release(null);
    await new Promise((done) => setTimeout(done, 20));
    expect([firstRead.rows[0].amount, secondRead.rows[0].amount]).toEqual(['6461509333', '6461509333']);
    expect(asked.filter((url) => url.includes('/api/v3/traces?'))).toHaveLength(1);
  });

  it('HIST-07: a transfer from an auction is drawn as what it is — a royalty to the winner beside its purchase takes no bid\'s place; a buyout\'s return of another\'s bid stays a receipt [round 121 — C1-1, the relabel of round 120 taken out]', () => {
    const self = addr('0a');
    const collection = NFT_PINNED_COLLECTIONS[1];
    const action = (type: string, details: any, at: number, trace: string) => ({ type, details, end_utime: at, action_id: `${type}-${at}-${trace}`, trace_id: trace, success: true });
    const rows = parseWalletHistory({ actions: [
      action('auction_bid', { bidder: self, auction: addr('ac'), nft_item: addr('a1'), nft_collection: collection, amount: '99000000000' }, NOW, 'tA'),
      action('nft_purchase', { new_owner: self, real_old_owner: addr('0f'), old_owner: addr('ac'), nft_item: addr('a1'), nft_collection: collection, price: '99000000000' }, NOW + 900, 'tB'),
      action('ton_transfer', { source: addr('ac'), destination: self, value: '4949900000', comment: 'Royalty' }, NOW + 900, 'tB'),
      action('auction_bid', { bidder: self, auction: addr('ad'), nft_item: addr('a2'), nft_collection: collection, amount: '1110000000' }, NOW + 10, 'tC'),
      action('ton_transfer', { source: addr('ad'), destination: self, value: '1104300000', comment: 'Your bid has been outbid by another user.' }, NOW + 20, 'tD'),
    ] }, self);
    const settled = wonBidsOf(rows);
    const debits = rows.filter((row: any) => row.master === addr('a1') && !settled.has(row.id) && row.direction === 'out' || (row.trade === 'bought' && row.master === addr('a1')))
      .reduce((sum: bigint, row: any) => sum + BigInt(row.amount), 0n);
    expect(debits, 'the win paid once').toBe(99_000_000_000n);
    expect(rows.filter((row: any) => row.trade === 'outbid')).toEqual([]);
    expect(rows.find((row: any) => row.trace === 'tD')).toMatchObject({ kind: 'gram', direction: 'in', amount: '1104300000' });
    expect(rows.find((row: any) => row.trace === 'tB' && row.kind === 'gram')).toMatchObject({ direction: 'in', amount: '4949900000', payment: 'royalty' });
    const drawn = historyRowsOf(rows);
    expect(drawn.won.get(rows.find((row: any) => row.trace === 'tA').id)).toBe('paid');
    expect(drawn.rows.find((row: any) => row.trace === 'tB' && row.payment === 'royalty')).toMatchObject({ kind: 'gram', comment: 'Royalty' });
    expect(drawn.rows.find((row: any) => row.trace === 'tD')).toMatchObject({ kind: 'nft', trade: 'outbid', master: addr('a2') });
  });

  it('HIST-08: History as drawn, over every page held — a buyout\'s return is its bid\'s, the bid on an older page too; an item\'s own auction won is a purchase at the bid, its end named by a transfer from no one or by the item\'s call alone; a bid that bought in its trace is one row and takes no other bid; a gift stays a gift [rounds 117–121 — C7-1, C1-2; round 132 — C1-1, C1-2, C1-3]', () => {
    const self = addr('0a');
    const collection = NFT_PINNED_COLLECTIONS[1];
    const action = (type: string, details: any, at: number, trace: string) => ({ type, details, end_utime: at, action_id: `${type}-${at}-${trace}`, trace_id: trace, success: true });
    const bid = (item: string, auction: string, amount: string, at: number, trace: string) => action('auction_bid', { bidder: self, auction, nft_item: item, nft_collection: collection, amount }, at, trace);
    const back = (item: string, amount: string, at: number, trace: string) => action('auction_outbid', { bidder: self, new_bidder: addr('0b'), auction_address: item, nft_item: item, nft_collection: collection, amount }, at, trace);
    const meta = { [addr('a2')]: { is_indexed: true, token_info: [{ valid: true, type: 'nft_items', name: '@madeupname' }] } };
    const outbidWords = 'Your bid has been outbid by another user.';
    const page1 = parseWalletHistory({ actions: [
      action('ton_transfer', { source: addr('ad'), destination: self, value: '1104300000', comment: outbidWords }, NOW + 500, 'tD'),
      action('nft_transfer', { new_owner: self, nft_item: addr('a3'), nft_collection: collection }, NOW + 900, 'tW'),
      action('nft_transfer', { old_owner: addr('0f'), new_owner: self, nft_item: addr('a4'), nft_collection: collection }, NOW + 950, 'tX'),
      action('ton_transfer', { source: addr('ae'), destination: self, value: '7000000000', comment: outbidWords }, NOW + 960, 'tY'),
      action('ton_transfer', { source: addr('ad'), destination: self, value: '300000000', comment: 'Royalty' }, NOW + 970, 'tZ'),
    ], metadata: meta }, self);
    const page2 = parseWalletHistory({ actions: [
      bid(addr('a2'), addr('ad'), '1110000000', NOW + 10, 'tC'),
      bid(addr('a3'), addr('a3'), '5000000000', NOW + 20, 'tE'), back(addr('a3'), '5000000000', NOW + 30, 'tF'), bid(addr('a3'), addr('a3'), '6000000000', NOW + 40, 'tG'),
      bid(addr('a4'), addr('a4'), '2000000000', NOW + 50, 'tH'), back(addr('a4'), '2000000000', NOW + 60, 'tI'),
    ], metadata: meta }, self);
    expect(historyRowsOf(page1).rows, 'page 1 alone: as it came').toEqual(page1);
    const held = [...page1, ...page2];
    const { rows, won } = historyRowsOf(held);
    const at = (trace: string) => rows.find((row: any) => row.trace === trace);
    expect(at('tD'), 'the buyout\'s return: its bid\'s, on the older page').toMatchObject({ kind: 'nft', trade: 'outbid', direction: 'in', amount: '1104300000', master: addr('a2'), nftName: '@madeupname' });
    expect(won.has(at('tC').id), 'that bid keeps −X beside its +X').toBe(false);
    expect(at('tW'), 'won: a purchase at the winning bid').toMatchObject({ trade: 'bought', amount: '6000000000', master: addr('a3'), sale: addr('a3') });
    expect(won.get(at('tG').id), 'the winning bid drawn without its GRAM').toBe('paid');
    expect(won.has(at('tE').id), 'the bid returned keeps its GRAM').toBe(false);
    expect(at('tX'), 'a gift after a lost bid').toEqual(page1.find((row: any) => row.trace === 'tX'));
    expect(at('tY'), 'no bid of this wallet there: a receipt').toMatchObject({ kind: 'gram', comment: outbidWords });
    expect(at('tZ'), 'other words from the auction: a receipt').toMatchObject({ kind: 'gram', comment: 'Royalty' });
    expect(held.map((row: any) => row.trade ?? row.kind), 'what is held is not changed').toEqual([...page1, ...page2].map((row: any) => row.trade ?? row.kind));
    const sum = (item: string) => rows.filter((row: any) => row.master === item && won.get(row.id) !== 'folded' && !won.has(row.id))
      .reduce((total: bigint, row: any) => total + (row.trade === 'outbid' || row.trade === 'sold' ? BigInt(row.amount) : row.trade ? -BigInt(row.amount) : 0n), 0n);
    expect([sum(addr('a3')), sum(addr('a2')), sum(addr('a4'))]).toEqual([-6_000_000_000n, -5_700_000n, 0n]);
    const buyNow = parseWalletHistory({ actions: [
      bid(addr('a5'), addr('a5'), '6000000000', NOW + 70, 'tJ'),
      action('call_contract', { source: addr('a5'), destination: self, opcode: '0x05138d91', value: '0' }, NOW + 70, 'tJ'),
    ] }, self);
    expect(buyNow.map((row: any) => [row.trade, row.direction, row.amount, row.sale])).toEqual([['bought', 'in', '6000000000', addr('a5')]]);
    const viaTransfer = parseWalletHistory({ actions: [
      bid(addr('a6'), addr('af'), '9000000000', NOW + 80, 'tK'),
      action('nft_transfer', { old_owner: addr('af'), new_owner: self, nft_item: addr('a6'), nft_collection: collection }, NOW + 80, 'tK'),
    ] }, self);
    expect(viaTransfer.map((row: any) => [row.trade, row.amount, row.sale])).toEqual([['bought', '9000000000', addr('af')]]);
    const other = parseWalletHistory({ actions: [
      bid(addr('a7'), addr('a7'), '1000000000', NOW + 90, 'tL'),
      action('call_contract', { source: addr('a8'), destination: self, opcode: '0x05138d91', value: '0' }, NOW + 90, 'tL'),
      action('call_contract', { source: addr('a7'), destination: self, opcode: '0x05138d91', value: '0' }, NOW + 95, 'tM'),
    ] }, self);
    expect(other.filter((row: any) => !row.endOnly).map((row: any) => row.trade), 'parsed: the bid a bid').toEqual(['bid']);
    const drawnOther = historyRowsOf(other);
    expect(drawnOther.rows.filter((row: any) => row.master === addr('a8')), 'no bid on it: not drawn').toEqual([]);
    expect(drawnOther.rows.find((row: any) => row.trace === 'tM')).toMatchObject({ trade: 'bought', amount: '1000000000', master: addr('a7') });
    const onlyCall = (item: string, at: number, trace: string) => action('call_contract', { source: item, destination: self, opcode: '0x05138d91', value: '0' }, at, trace);
    const later = parseWalletHistory({ actions: [
      bid(addr('b1'), addr('b1'), '9000000000', NOW + 100, 'tN'),
      onlyCall(addr('b1'), NOW + 200, 'tO'),
      action('nft_transfer', { old_owner: self, new_owner: addr('0d'), nft_item: addr('b1'), nft_collection: collection }, NOW + 300, 'tP'),
      action('nft_transfer', { old_owner: addr('0d'), new_owner: self, nft_item: addr('b1'), nft_collection: collection }, NOW + 400, 'tQ'),
      action('nft_transfer', { old_owner: self, new_owner: addr('0d'), nft_item: addr('b1'), nft_collection: collection }, NOW + 450, 'tQ2'),
      bid(addr('b1'), addr('b1'), '15000000000', NOW + 500, 'tR'), onlyCall(addr('b1'), NOW + 500, 'tR'),
      onlyCall(addr('c9'), NOW + 600, 'tS'),
    ], metadata: { [addr('b1')]: { is_indexed: true, token_info: [{ valid: true, type: 'nft_items', name: '@madeupthree' }] } } }, self);
    const drawnLater = historyRowsOf(later);
    const atL = (trace: string) => drawnLater.rows.find((row: any) => row.trace === trace);
    expect(atL('tO'), 'the end: a purchase at the winning bid').toMatchObject({ trade: 'bought', amount: '9000000000', master: addr('b1'), collection, nftName: '@madeupthree' });
    expect(drawnLater.won.get(atL('tN').id)).toBe('paid');
    expect(atL('tR'), 'the buy-back: one row, paid by its own bid').toMatchObject({ trade: 'bought', amount: '15000000000', byBid: true });
    expect(atL('tQ'), 'given back: a gift').toMatchObject({ kind: 'nft', counterparty: addr('0d') });
    expect(atL('tQ').trade).toBeUndefined();
    expect(atL('tS'), 'a contract\'s words alone: not drawn').toBeUndefined();
    expect(later.find((row: any) => row.trace === 'tS'), 'held, no news by itself').toMatchObject({ endOnly: true, verified: false, collection: '' });
    const paid = drawnLater.rows.filter((row: any) => row.master === addr('b1') && (row.trade === 'bought' || row.trade === 'bid') && !drawnLater.won.has(row.id))
      .reduce((total: bigint, row: any) => total + BigInt(row.amount), 0n);
    expect(paid, 'each bid paid once').toBe(24_000_000_000n);
    const handed = parseWalletHistory({ actions: [
      action('nft_transfer', { old_owner: addr('0d'), new_owner: self, nft_item: addr('b2'), nft_collection: collection }, NOW + 700, 'tT'),
      onlyCall(addr('b2'), NOW + 700, 'tT'),
      action('call_contract', { source: addr('b3'), destination: addr('0d'), opcode: '0x05138d91', value: '0' }, NOW + 710, 'tU'),
    ] }, self);
    expect(handed.map((row: any) => [row.kind, row.trace, row.endOnly ?? false])).toEqual([['nft', 'tT', false]]);
    const endPage = parseWalletHistory({ actions: [onlyCall(addr('b4'), NOW + 800, 'tV')] }, self);
    const bidPage = parseWalletHistory({ actions: [bid(addr('b4'), addr('b4'), '3000000000', NOW + 750, 'tU2')],
      metadata: { [addr('b4')]: { is_indexed: true, token_info: [{ valid: true, type: 'nft_items', name: '@madeupfour' }] } } }, self);
    expect(bidPage[0].verified, 'a verified collection\'s bid').toBe(true);
    expect(historyRowsOf([...endPage, ...bidPage]).rows.find((row: any) => row.trace === 'tV'))
      .toMatchObject({ trade: 'bought', amount: '3000000000', collection, nftName: '@madeupfour', verified: true });
    const noEnd = historyRowsOf(parseWalletHistory({ actions: [
      bid(addr('b5'), addr('b5'), '4000000000', NOW + 1000, 'tW1'),
      bid(addr('b5'), addr('b5'), '7000000000', NOW + 1100, 'tW2'), onlyCall(addr('b5'), NOW + 1100, 'tW2'),
    ] }, self));
    expect(noEnd.won.has(noEnd.rows.find((row: any) => row.trace === 'tW1').id), 'the older bid keeps its GRAM').toBe(false);
    const giftOnly = historyRowsOf(parseWalletHistory({ actions: [
      bid(addr('b6'), addr('b6'), '6000000000', NOW + 1200, 'tX1'),
      action('nft_transfer', { old_owner: addr('0d'), new_owner: self, nft_item: addr('b6'), nft_collection: collection }, NOW + 1300, 'tX2'),
    ] }, self));
    expect(giftOnly.rows.find((row: any) => row.trace === 'tX2').trade, 'from another wallet: a gift, whatever bid stood').toBeUndefined();
    expect(giftOnly.won.has(giftOnly.rows.find((row: any) => row.trace === 'tX1').id)).toBe(false);
  });

  it('HIST-09: a sale\'s read whose answer stalls past its headers ends at its bound — that sale at its payout, asked again with a later page; the sales after it read [round 132 — C5-1]', async () => {
    vi.useFakeTimers();
    try {
      const self = addr('0a');
      const sales = ['tY1', 'tY2', 'tY3'];
      const purchase = (trace: string) => ({ type: 'nft_purchase', end_utime: NOW, action_id: `p-${trace}`, trace_id: trace, success: true,
        transactions: [`h1-${trace}`, `h2-${trace}`],
        details: { nft_item: addr('a1'), nft_collection: NFT_PINNED_COLLECTIONS[0], old_owner: addr('ac'), real_old_owner: self, new_owner: addr('b1'),
          price: '6500000000', payout_address: self, payout_amount: '5939933333', response_destination: self } });
      const tx = (hash: string, value: string, source: string) => ({ hash, account: self, in_msg: { source, destination: self, value }, out_msgs: [] });
      const asked: string[] = [];
      let stalls = 1;
      let landed = 0;
      const fetchImpl = async (url: string) => {
        asked.push(url);
        if (url.includes('/api/v3/actions?')) return { ok: true, json: async () => ({ actions: sales.map(purchase), metadata: {} }) };
        const trace = sales.find((one) => url.includes(`trace_id=${one}&`))!;
        if (trace === 'tY1' && stalls > 0) {
          stalls -= 1;
          return { ok: true, json: () => new Promise(() => {}) };
        }
        const transactions = [tx(`h1-${trace}`, '5939933333', addr('ac')), tx(`h2-${trace}`, '521576000', addr('a1'))];
        return { ok: true, json: async () => ({ traces: [{ transactions: Object.fromEntries(transactions.map((one) => [one.hash, one])) }] }) };
      };
      const traces = () => asked.filter((url) => url.includes('/api/v3/traces?'));
      const amounts = (rows: any[]) => sales.map((one) => rows.find((row: any) => row.trace === one)?.amount);
      const settle = async () => { for (let i = 0; i < 100; i += 1) await Promise.resolve(); };
      const page = await readWalletHistory({ account: self, origin: 'https://o', fetchImpl: fetchImpl as any, onSaleRests: () => { landed += 1; } });
      await vi.advanceTimersByTimeAsync(29_999);
      await settle();
      expect([landed, traces().length], 'the first sale\'s answer stalls: the others wait').toEqual([0, 1]);
      await vi.advanceTimersByTimeAsync(1);
      await settle();
      expect([landed, traces().length], 'its bound: the sales after it are read').toEqual([2, 3]);
      expect(amounts(page.rows)).toEqual(['5939933333', '6461509333', '6461509333']);
      asked.length = 0;
      const later = await readWalletHistory({ account: self, origin: 'https://o', fetchImpl: fetchImpl as any, onSaleRests: () => { landed += 1; } });
      await settle();
      expect(traces(), 'the stalled sale alone').toEqual([expect.stringContaining('trace_id=tY1&')]);
      expect([landed, amounts(later.rows)]).toEqual([3, ['6461509333', '6461509333', '6461509333']]);
    } finally {
      vi.useRealTimers();
    }
  });
});
