import { describe, expect, it } from 'vitest';
import { formatUnits, parseJettonBalances, parseNftItems, parseWalletHistory, readJettonBalances, readWalletHistory, rawAccount, toncenterPicture, ownTracesOf, withoutOwnChange } from '../web/wallet-assets.mjs';
import { VERIFIED_COLLECTION_COUNT, VERIFIED_JETTON_COUNT, isVerifiedJettonMaster, isVerifiedNftCollection } from '../web/verified-assets.mjs';


const USDT = '0:B113A994B5024A16719F69139328EB759596C38A25F59028B146FECDC3621DFE';
const SELF = `0:${'5e'.repeat(32).toUpperCase()}`;
const OTHER = `0:${'0f'.repeat(32).toUpperCase()}`;
const SPAMMY = `0:${'ab'.repeat(32).toUpperCase()}`;
const ATH = `0:${'cd'.repeat(32).toUpperCase()}`;
const proxy = (tag: string) => `https://proxy.toncenter.com/${tag}/pr:small/abc`;
const master = (name: string, symbol: string, extra: Record<string, any> = {}, rest: Record<string, any> = {}) => ({
  is_indexed: true, token_info: [{ valid: true, type: 'jetton_masters', name, symbol, image: 'https://example.com/logo.png', is_scam: false, extra, ...rest }],
});

describe('tokens', () => {
  it('ASSETS-01: balances with their masters\' names and decimals; verified by the built-in list first, the rest apart; zero balances and scams out of the verified', () => {
    const payload = {
      jetton_wallets: [
        { address: `0:${'44'.repeat(32)}`, balance: '6296726', owner: SELF, jetton: USDT },
        { address: `0:${'11'.repeat(32)}`, balance: '1000000000000', owner: SELF, jetton: SPAMMY },
        { address: `0:${'22'.repeat(32)}`, balance: '0', owner: SELF, jetton: `0:${'ef'.repeat(32)}` },
        { address: `0:${'33'.repeat(32)}`, balance: '5000000000', owner: SELF, jetton: ATH },
      ],
      metadata: {
        [USDT]: master('Tether USD', 'USD₮', { decimals: '6', _image_small: proxy('usdt') }),
        [SPAMMY]: master('Tether USD', 'USDT', { decimals: '9' }, { is_scam: true }),
        [ATH]: master('ATH', 'ATH', {}),
      },
    };
    const tokens = parseJettonBalances(payload, { alsoVerified: [ATH] });
    expect(tokens.map((one: any) => [one.symbol, one.verified, one.scam])).toEqual([['ATH', true, false], ['USD₮', true, false], ['USDT', false, true]]);
    const usdt = tokens.find((one: any) => one.symbol === 'USD₮');
    expect([usdt.master, usdt.decimals, usdt.picture, formatUnits(usdt.balance, usdt.decimals)]).toEqual([USDT.toLowerCase(), 6, proxy('usdt'), '6.2967']);
    expect(tokens.find((one: any) => one.symbol === 'ATH').picture, 'a picture from anywhere but toncenter is not drawn').toBe('');
    expect(tokens.some((one: any) => one.balance === '0'), 'zero balances left out').toBe(false);
  });

  it('ASSETS-02: the built-in list knows the verified masters by the first 64 bits of their ids; amounts read as a person reads them', () => {
    expect(VERIFIED_JETTON_COUNT).toBeGreaterThan(3000);
    expect([isVerifiedJettonMaster(USDT), isVerifiedJettonMaster(USDT.toLowerCase().slice(2)), isVerifiedJettonMaster(SPAMMY), isVerifiedJettonMaster('nope')]).toEqual([true, true, false, false]);
    const hex = USDT.toLowerCase().slice(2);
    const flip = (at: number) => `0:${hex.slice(0, at)}${hex[at] === '0' ? '1' : '0'}${hex.slice(at + 1)}`;
    expect(isVerifiedJettonMaster(flip(16)), 'the same 64 bits, then one more differs').toBe(false);
    expect(isVerifiedJettonMaster(flip(31)), 'the same 124 bits, the 128th digit differs').toBe(false);
    expect(isVerifiedJettonMaster(flip(32)), 'past the 128 bits nothing is read').toBe(true);
    expect([formatUnits('1500000000', 9), formatUnits('1234567890123', 9), formatUnits('5', 0), formatUnits('100', 2), formatUnits('x', 9)]).toEqual(['1.5', '1 234.5678', '5', '1', '0']);
    expect([toncenterPicture('https://proxy.toncenter.com/a'), toncenterPicture('https://imgproxy.toncenter.com/b'), toncenterPicture('https://toncenter.com/x'),
      toncenterPicture('https://evil.com/proxy.toncenter.com'), toncenterPicture('http://proxy.toncenter.com/a'), toncenterPicture('https://user@proxy.toncenter.com/a')])
      .toEqual(['https://proxy.toncenter.com/a', 'https://imgproxy.toncenter.com/b', '', '', '', '']);
    expect([rawAccount(USDT), rawAccount('EQ...'), rawAccount('')]).toEqual([USDT.toLowerCase(), '', '']);
  });

  it('ASSETS-03: reads go through the fetch it is given, with the key, and a refusal keeps its status (a 429 is "later", never "nothing here")', async () => {
    const asked: any[] = [];
    const fetchImpl = async (url: string, init: any) => { asked.push([url, init.headers['X-API-Key']]); return { ok: true, json: async () => ({ jetton_wallets: [] }) }; };
    expect(await readJettonBalances({ owner: SELF, fetchImpl, origin: 'https://toncenter.com', apiKey: 'k' })).toEqual([]);
    expect(asked[0][0]).toBe(`https://toncenter.com/api/v3/jetton/wallets?owner_address=${encodeURIComponent(SELF.toLowerCase())}&exclude_zero_balance=true&limit=1000&offset=0`);
    expect(asked[0][1]).toBe('k');
    const refused = async () => ({ ok: false, status: 429 });
    await expect(readWalletHistory({ account: SELF, fetchImpl: refused })).rejects.toMatchObject({ status: 429 });
  });
});

describe('NFTs', () => {
  it('ASSETS-04: items with their names, collections and pictures from toncenter\'s proxy; verified by the built-in list of collections or proven otherwise', () => {
    const item = `0:${'44'.repeat(32).toUpperCase()}`;
    const collection = '0:80D78A35F955A14B679FAA887FF4CD5BFC0F43B4A4EEA2A7E6927F3701B273C2';
    const payload = {
      nft_items: [{ address: item, collection_address: collection, owner_address: SELF, content: { domain: 'name.t.me' } }, { address: item }],
      metadata: {
        [item]: { token_info: [{ valid: true, type: 'nft_items', name: '@name', image: 'https://nft.fragment.com/x.webp', extra: { _image_medium: proxy('nft') } }] },
        [collection]: { token_info: [{ valid: true, type: 'nft_collections', name: 'Telegram Usernames' }] },
      },
    };
    expect(parseNftItems(payload)).toEqual([{ address: item.toLowerCase(), collection: collection.toLowerCase(), collectionName: 'Telegram Usernames', name: '@name', picture: proxy('nft'),
      domain: 'name.t.me', pictureBig: proxy('nft'), attributes: [], uri: '', scam: false, verified: true, lastLt: '' }]);
    const gift = { nft_items: [{ address: item, collection_address: collection, content: { uri: 'https://nft.fragment.com/gift/tophat-4841.json' } }],
      metadata: { [item]: { token_info: [{ valid: true, name: 'Top Hat #4841', extra: { _image_big: proxy('big'), attributes: [
        { trait_type: 'Model', value: 'Burned Brass' }, { trait_type: 'Backdrop', value: 'Chocolate' }, { trait_type: 'Symbol\u202e', value: 'x'.repeat(60) },
        { trait_type: '', value: 'no trait' }, { trait_type: 'Rank', value: 7 }, ...Array.from({ length: 20 }, (_, i) => ({ trait_type: `t${i}`, value: 'v' })),
      ] } }] } } };
    const [whole] = parseNftItems(gift);
    expect(whole.pictureBig).toBe(proxy('big'));
    expect(whole.uri).toBe('https://nft.fragment.com/gift/tophat-4841.json');
    expect(whole.attributes.slice(0, 4)).toEqual([{ trait: 'Model', value: 'Burned Brass' }, { trait: 'Backdrop', value: 'Chocolate' }, { trait: 'Symbol', value: 'x'.repeat(48) },
      { trait: 'Rank', value: '7' }]);
    expect(whole.attributes).toHaveLength(12);
    const spam = parseNftItems({ ...gift, nft_items: [{ ...gift.nft_items[0], collection_address: `0:${'55'.repeat(32)}`, content: {} }] })[0];
    expect([spam.pictureBig, spam.attributes], 'an unverified item draws nothing of a stranger\'s').toEqual(['', []]);
    expect([VERIFIED_COLLECTION_COUNT > 10, isVerifiedNftCollection(collection), isVerifiedNftCollection(SPAMMY)]).toEqual([true, true, false]);
    const airdrop = { nft_items: [{ address: SPAMMY, collection_address: `0:${'55'.repeat(32)}` }], metadata: { [SPAMMY]: { token_info: [{ valid: true, name: 'Airdrop - claim.com' }] } } };
    expect(parseNftItems(airdrop).map((one: any) => one.verified), 'a collection off the list: unverified, shown apart').toEqual([false]);
    expect(parseNftItems(airdrop, { verifiedItems: [SPAMMY] }).map((one: any) => one.verified), 'proven otherwise (a Telegram gift)').toEqual([true]);
    expect(parseNftItems({ nft_items: [{ address: item, collection_address: collection }], metadata: { [item]: { token_info: [{ name: `${'x'.repeat(79)}😀😀` }] } } })[0].name, 'cut by characters').toBe(`${'x'.repeat(79)}😀`);
  });
});

describe('history', () => {
  it('ASSETS-05: GRAM, jetton and NFT transfers as this wallet sees them, newest first; contract calls left out; encrypted comments not shown', () => {
    const payload = {
      actions: [
        { type: 'ton_transfer', success: true, end_utime: 300, action_id: 'a', details: { source: OTHER, destination: SELF, value: '947428853', comment: 'hi', encrypted: false } },
        { type: 'jetton_transfer', success: true, end_utime: 400, action_id: 'b', details: { asset: USDT, sender: SELF, receiver: OTHER, amount: '6296726', comment: 'secret', is_encrypted_comment: true } },
        { type: 'call_contract', success: true, end_utime: 500, action_id: 'c', details: { source: SELF, destination: OTHER, value: '1' } },
        { type: 'nft_transfer', success: false, end_utime: 200, action_id: 'd', details: { nft_item: SPAMMY, old_owner: OTHER, new_owner: SELF } },
        { type: 'ton_transfer', success: true, end_utime: 100, action_id: 'e', details: { source: SELF, destination: SELF, value: '5' } },
      ],
      metadata: { [USDT]: master('Tether USD', 'USD₮', { decimals: '6' }), [SPAMMY]: { token_info: [{ valid: true, type: 'nft_items', name: 'A prize' }] } },
    };
    const rows = parseWalletHistory(payload, SELF);
    expect(rows.map((row: any) => [row.id, row.kind, row.direction, row.symbol || row.nftName, row.comment, row.success])).toEqual([
      ['b', 'jetton', 'out', 'USD₮', '', true],
      ['a', 'gram', 'in', 'GRAM', 'hi', true],
      ['d', 'nft', 'in', 'A prize', '', false],
    ]);
    expect([rows[0].counterparty, formatUnits(rows[0].amount, rows[0].decimals), formatUnits(rows[1].amount, rows[1].decimals)]).toEqual([OTHER.toLowerCase(), '6.2967', '0.9474']);
  });

  it('ASSETS-07: a swap this wallet made reads as one row — what it gave, what came back; a refunded one shows nothing came [stage 3, 2026-10-16]', () => {
    const ROUTER = '0:' + '92'.repeat(32);
    const swap = (id: string, at: number, given: any, got: any, extra: any = {}) => ({ type: 'jetton_swap', success: true, end_utime: at, action_id: id,
      details: { dex: 'stonfi_v2', sender: SELF, asset_in: given.asset, asset_out: got.asset, dex_incoming_transfer: { source: SELF, destination: ROUTER, ...given },
        dex_outgoing_transfer: { source: ROUTER, destination: SELF, ...got }, ...extra } });
    const rows = parseWalletHistory({
      actions: [
        swap('in', 300, { asset: null, amount: '10000000000' }, { asset: USDT, amount: '13857210' }),
        swap('out', 400, { asset: USDT, amount: '6928605' }, { asset: null, amount: '4984359231' }),
        swap('theirs', 500, { asset: null, amount: '1' }, { asset: USDT, amount: '1' }, { sender: OTHER, dex_incoming_transfer: { source: OTHER, destination: ROUTER, asset: null, amount: '1' } }),
        swap('back', 200, { asset: USDT, amount: '5' }, { asset: USDT, amount: '5', destination: OTHER }),
      ],
      metadata: { [USDT]: master('Tether USD', 'USD₮', { decimals: '6' }) },
    }, SELF);
    expect(rows.map((row: any) => [row.id, row.kind, row.symbol, formatUnits(row.amount, row.decimals), row.got.symbol, formatUnits(row.got.amount, row.got.decimals)])).toEqual([
      ['out', 'swap', 'USD₮', '6.9286', 'GRAM', '4.9843'],
      ['in', 'swap', 'GRAM', '10', 'USD₮', '13.8572'],
      ['back', 'swap', 'USD₮', '0.000005', 'USD₮', '0'],
    ]);
    expect(rows[1].counterparty).toBe(ROUTER);
  });

  it('ASSETS-08: GRAM coming back in a trace this wallet started is its own message\'s change, not "received" — on one page or across two [2026-10-16]', () => {
    const SHARD = '0:' + '5a'.repeat(32);
    const page = {
      actions: [
        { type: 'ton_transfer', success: true, end_utime: 501, action_id: 'change', trace_id: 'T1', details: { source: SHARD, destination: SELF, value: '37500000' } },
        { type: 'call_contract', success: true, end_utime: 500, action_id: 'write', trace_id: 'T1', details: { source: SELF, destination: SHARD, value: '61000000', opcode: '0x52535031' } },
        { type: 'ton_transfer', success: true, end_utime: 400, action_id: 'gift', trace_id: 'T2', details: { source: OTHER, destination: SELF, value: '5000000000' } },
        { type: 'ton_transfer', success: true, end_utime: 300, action_id: 'late', trace_id: 'T3', details: { source: SHARD, destination: SELF, value: '6300000' } },
      ],
    };
    const rows = parseWalletHistory(page, SELF);
    expect(rows.map((row: any) => row.id), 'the change of T1 stays out; a transfer someone else started stays in').toEqual(['gift', 'late']);
    const next = { actions: [{ type: 'call_contract', success: true, end_utime: 299, action_id: 'w3', trace_id: 'T3', details: { source: SELF, destination: SHARD, value: '9000000' } }] };
    const traces = new Set([...ownTracesOf(page, SELF), ...ownTracesOf(next, SELF)]);
    expect(withoutOwnChange([...rows, ...parseWalletHistory(next, SELF)], traces).map((row: any) => row.id)).toEqual(['gift']);
    expect([...ownTracesOf(page, SELF)], 'only the traces this wallet sent in').toEqual(['T1']);
  });

  it('ASSETS-09: a marketplace\'s buy, sale, listing and withdrawal are one row each — the GRAM with the NFT; the rest of a buy is its change [2026-10-30]', () => {
    const SALE = '0:' + '5b'.repeat(32);
    const ITEM = '0:' + '6c'.repeat(32).toUpperCase();
    const COLLECTION = '0:80D78A35F955A14B679FAA887FF4CD5BFC0F43B4A4EEA2A7E6927F3701B273C2';
    const meta = { [ITEM]: { token_info: [{ valid: true, name: '@name' }] } };
    const bought = { actions: [
      { type: 'nft_purchase', success: true, end_utime: 900, action_id: 'buy', trace_id: 'B', details: { nft_collection: COLLECTION, nft_item: ITEM, old_owner: SALE,
        new_owner: SELF, real_old_owner: OTHER, price: '18300000000', payout_address: OTHER, payout_amount: '17934000000' } },
      { type: 'ton_transfer', success: true, end_utime: 901, action_id: 'rest', trace_id: 'B', details: { source: ITEM, destination: SELF, value: '90000000' } },
    ], metadata: meta };
    expect(parseWalletHistory(bought, SELF).map((row: any) => [row.id, row.trade, row.direction, row.amount, row.nftName, row.verified]),
      'bought, for its price; the rest that came back with the NFT is the buy\'s change').toEqual([['buy', 'bought', 'in', '18300000000', '@name', true]]);
    expect(parseWalletHistory(bought, OTHER).map((row: any) => [row.trade, row.direction, row.amount]), 'the seller: sold, for the payout it got').toEqual([['sold', 'out', '17934000000']]);
    const elsewhere = structuredClone(bought);
    elsewhere.actions[0].details.payout_address = '0:' + '7d'.repeat(32);
    expect(parseWalletHistory(elsewhere, OTHER)[0].amount, 'a payout to another wallet is not this one\'s').toBe('0');
    const listed = { actions: [
      { type: 'nft_put_on_sale', success: true, end_utime: 800, action_id: 'list', trace_id: 'L', details: { nft_collection: COLLECTION, nft_item: ITEM, owner: SELF, sale_address: SALE, full_price: '5794900000' } },
      { type: 'nft_cancel_sale', success: true, end_utime: 700, action_id: 'cancel', trace_id: 'C', details: { nft_collection: COLLECTION, nft_item: ITEM, owner: SELF, sale_address: SALE } },
      { type: 'nft_transfer', success: true, end_utime: 700, action_id: 'back', trace_id: 'C', details: { nft_collection: COLLECTION, nft_item: ITEM, old_owner: SALE, new_owner: SELF } },
      { type: 'nft_put_on_sale', success: true, end_utime: 600, action_id: 'theirs', trace_id: 'X', details: { nft_collection: COLLECTION, nft_item: ITEM, owner: OTHER, sale_address: SALE, full_price: '1' } },
    ], metadata: meta };
    expect(parseWalletHistory(listed, SELF).map((row: any) => [row.id, row.trade, row.amount]), 'the NFT a withdrawn sale sends back is the withdrawal\'s; a stranger\'s listing is not here')
      .toEqual([['list', 'listed', '5794900000'], ['cancel', 'unlisted', '0']]);
    expect([...ownTracesOf({ actions: [...bought.actions, ...listed.actions] }, SELF)].sort(), 'this wallet\'s buy, listing and withdrawal are its own traces').toEqual(['B', 'C', 'L']);
    const scam = structuredClone(bought);
    scam.metadata[ITEM].token_info[0].is_scam = true;
    expect(parseWalletHistory(scam, SELF), 'a scam item is not history').toEqual([]);
  });

  it('ASSETS-10: GRAM inside an own trace that is not its change stays — what an NFT\'s new owner paid for it, what an address paid back past what was sent it; a rest, a jetton\'s rest and dust do not [round 85 — C1-1: accepted and cancelled Getgems offers]', () => {
    const OFFER = '0:' + '7e'.repeat(32);
    const SHARD = '0:' + '5a'.repeat(32);
    const ITEM = '0:' + '6c'.repeat(32);
    const JETTON_WALLET = '0:' + '3d'.repeat(32);
    const page = { actions: [
      { type: 'nft_transfer', success: true, end_utime: 900, action_id: 'nft', trace_id: 'A', details: { nft_item: ITEM, old_owner: SELF, new_owner: OFFER } },
      { type: 'ton_transfer', success: true, end_utime: 901, action_id: 'profit', trace_id: 'A', details: { source: OFFER, destination: SELF, value: '85850000000', comment: 'Profit' } },
      { type: 'ton_transfer', success: true, end_utime: 901, action_id: 'item-rest', trace_id: 'A', details: { source: ITEM, destination: SELF, value: '40000000' } },
      { type: 'ton_transfer', success: true, end_utime: 800, action_id: 'cancel', trace_id: 'C', details: { source: SELF, destination: OFFER, value: '30000000', comment: 'cancel' } },
      { type: 'ton_transfer', success: true, end_utime: 801, action_id: 'refund', trace_id: 'C', details: { source: OFFER, destination: SELF, value: '150028101834' } },
      { type: 'call_contract', success: true, end_utime: 700, action_id: 'write', trace_id: 'S', details: { source: SELF, destination: SHARD, value: '61000000', opcode: '0x52535031' } },
      { type: 'ton_transfer', success: true, end_utime: 701, action_id: 'change', trace_id: 'S', details: { source: SHARD, destination: SELF, value: '37500000' } },
      { type: 'jetton_transfer', success: true, end_utime: 600, action_id: 'jetton', trace_id: 'J', details: { asset: USDT, sender: SELF, receiver: OTHER, amount: '1000000' } },
      { type: 'ton_transfer', success: true, end_utime: 601, action_id: 'jetton-rest', trace_id: 'J', details: { source: JETTON_WALLET, destination: SELF, value: '50000000' } },
      { type: 'call_contract', success: false, end_utime: 500, action_id: 'tiny', trace_id: 'D', details: { source: SELF, destination: OTHER, value: '3333', opcode: '0xffffffff' } },
      { type: 'ton_transfer', success: false, end_utime: 501, action_id: 'dust', trace_id: 'D', details: { source: OTHER, destination: SELF, value: '70000' } },
    ], metadata: { [USDT]: master('Tether USD', 'USD₮', { decimals: '6' }) } };
    const rows = parseWalletHistory(page, SELF);
    const ids = rows.filter((row: any) => row.kind === 'gram' && row.direction === 'in').map((row: any) => row.id);
    expect(ids, 'the payment and the refund stay; every rest and the dust go').toEqual(['profit', 'refund']);
    expect(rows.filter((row: any) => row.payment).map((row: any) => [row.id, row.payment])).toEqual([['profit', 'sale'], ['refund', 'refund']]);
    const ROUTER = '0:' + '4e'.repeat(32);
    const VAULT = '0:' + '9a'.repeat(32);
    const pool = { actions: [
      { type: 'nft_transfer', success: true, end_utime: 400, action_id: 'to-pool', trace_id: 'P', details: { nft_item: ITEM, old_owner: SELF, new_owner: ROUTER } },
      { type: 'ton_transfer', success: true, end_utime: 401, action_id: 'pool-pays', trace_id: 'P', details: { source: VAULT, destination: SELF, value: '4030000000' } },
      { type: 'ton_transfer', success: true, end_utime: 401, action_id: 'pool-item-rest', trace_id: 'P', details: { source: ITEM, destination: SELF, value: '40000000' } },
    ] };
    expect(parseWalletHistory(pool, SELF).filter((row: any) => row.kind === 'gram').map((row: any) => [row.id, row.payment]), 'the vault\'s payment stays, the NFT\'s rest goes')
      .toEqual([['pool-pays', 'sale']]);
    expect(withoutOwnChange(rows, ownTracesOf(page, SELF)).filter((row: any) => row.kind === 'gram' && row.direction === 'in').map((row: any) => row.id)).toEqual(['profit', 'refund']);
  });

  it('ASSETS-06: a page asks the index from its offset; a full page says there is more', async () => {
    const asked: string[] = [];
    const full = Array.from({ length: 30 }, (_, i) => ({ type: 'call_contract', end_utime: i, details: {} }));
    const fetchImpl = async (url: string) => { asked.push(url); return { ok: true, json: async () => ({ actions: full }) }; };
    const page = await readWalletHistory({ account: SELF, offset: 30, fetchImpl });
    expect([page.rows.length, page.nextOffset, page.more]).toEqual([0, 60, true]);
    expect(asked[0]).toContain('/api/v3/actions?');
    expect(asked[0]).toContain('offset=30');
    expect(asked[0]).toContain('sort=desc');
  });
});
