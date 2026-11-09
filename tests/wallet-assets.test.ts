import { describe, expect, it } from 'vitest';
import { formatUnits, parseJettonBalances, parseNftItems, parseWalletHistory, readJettonBalances, readWalletHistory, rawAccount, toncenterPicture, ownTracesOf, withoutOwnChange, historyRowsOf } from '../web/wallet-assets.mjs';
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
      domain: 'name.t.me', pictureBig: proxy('nft'), attributes: [], uri: '', scam: false, verified: true, onSale: false, lastLt: '' }]);
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
        swap('theirs', 500, { asset: null, amount: '1' }, { asset: USDT, amount: '1', destination: OTHER }, { sender: OTHER, dex_incoming_transfer: { source: OTHER, destination: ROUTER, asset: null, amount: '1' } }),
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
    const AGG = '0:' + 'a9'.repeat(32);
    const call = (id: string, at: number, trace: string, source: string, value: string, opcode = '0x4cb700a9') => ({ type: 'call_contract', success: true, end_utime: at,
      action_id: id, trace_id: trace, details: { source, destination: SELF, value, opcode } });
    const routed = parseWalletHistory({ actions: [
      { ...swap('agg', 600, { asset: USDT, amount: '925271' }, { asset: null, amount: '836000000', destination: AGG }), trace_id: 'TA' },
      call('pay', 601, 'TA', AGG, '1104200000'), call('elsewhere', 602, 'TB', AGG, '5'), call('another', 603, 'TA', OTHER, '7', '0x3216ca09'), call('nothing', 604, 'TA', AGG, '0'),
      { ...call('refused', 605, 'TA', AGG, '9'), success: false },
      call('excess', 606, 'TA', AGG, '47800000', '0xd53276db'), call('bounce', 607, 'TA', OTHER, '11', '0xffffffff'), call('gas', 608, 'TA', AGG, '305000000', '0x73696e74'),
      call('notified', 609, 'TA', OTHER, '50000000', '0x7362d09c'),
    ], metadata: { [USDT]: master('Tether USD', 'USD₮', { decimals: '6' }) } }, SELF);
    expect(routed.map((row: any) => [row.id, row.kind, row.direction, row.amount])).toEqual([['agg', 'swap', 'out', '925271'], ['pay', 'gram', 'in', '1104200000'], ['another', 'gram', 'in', '7']]);
    expect(routed[1], 'a payment: not the trace\'s change').toMatchObject({ payment: 'swap', counterparty: AGG, symbol: 'GRAM' });
    expect(routed[2], 'from an account no swap of this wallet paid').toMatchObject({ payment: 'swap', counterparty: rawAccount(OTHER) });
    expect(routed[0].got.amount, 'the swap\'s own "+": nothing came to this wallet from the DEX').toBe('0');
    const direct = parseWalletHistory({ actions: [swap('own', 610, { asset: USDT, amount: '925271' }, { asset: null, amount: '836000000' }), call('pay', 611, undefined as any, AGG, '1104200000')].map((one: any) => ({ ...one, trace_id: 'TS' })),
      metadata: { [USDT]: master('Tether USD', 'USD₮', { decimals: '6' }) } }, SELF);
    expect(direct.map((row: any) => row.id), 'a swap paid to this wallet itself routes nothing: a call beside it is the trace\'s change').toEqual(['own']);
    const notOurs = parseWalletHistory({ actions: [{ ...swap('theirs', 620, { asset: USDT, amount: '925271' }, { asset: null, amount: '836000000', destination: AGG },
      { sender: OTHER, dex_incoming_transfer: { source: OTHER, destination: ROUTER, asset: USDT, amount: '925271' } }), trace_id: 'TO' }, call('pay', 621, 'TO', AGG, '1104200000')],
      metadata: { [USDT]: master('Tether USD', 'USD₮', { decimals: '6' }) } }, SELF);
    expect(notOurs, 'another account\'s route is not this wallet\'s swap').toEqual([]);
    const refund = parseWalletHistory({ actions: [{ type: 'jetton_swap', success: false, end_utime: 700, action_id: 'refund', trace_id: 'TR',
      details: { dex: 'stonfi_v2', sender: SELF, asset_in: null, asset_out: USDT, dex_incoming_transfer: { source: SELF, destination: ROUTER, asset: null, amount: '26000000000' },
        dex_outgoing_transfer: { source: ROUTER, destination: SELF, asset: null, amount: '26000000000' } } }],
      metadata: { [USDT]: master('Tether USD', 'USD₮', { decimals: '6' }) } }, SELF);
    expect([refund[0].got.symbol, formatUnits(refund[0].got.amount, refund[0].got.decimals), refund[0].wanted.symbol, refund[0].success]).toEqual(['GRAM', '26', 'USD₮', false]);
    expect(rows[0].wanted.symbol, 'a swap that went through: what it asked for is what came').toBe('GRAM');
    const TOKEN = '0:' + 'c3'.repeat(32);
    const JW = '0:' + 'f3'.repeat(32);
    const hop = (id: string, trace: string, extra: any = {}, paidTo = SELF) => ({ type: 'jetton_swap', success: true, end_utime: 801, action_id: id, trace_id: trace,
      transactions: [`${id}-in`, `${id}-take`], start_lt: '8010', end_lt: '8019',
      details: { dex: 'stonfi_v2', sender: AGG, asset_in: null, asset_out: TOKEN, dex_incoming_transfer: { source: AGG, destination: ROUTER, asset: null, amount: '836000000' },
        dex_outgoing_transfer: { source: ROUTER, destination: paidTo, destination_jetton_wallet: JW, asset: TOKEN, amount: '30092300000' } }, ...extra });
    const meta = { [USDT]: master('Tether USD', 'USD₮', { decimals: '6' }), [TOKEN]: master('Made Up Token', 'MUT', { decimals: '9' }) };
    const first = { ...swap('first', 800, { asset: USDT, amount: '1116800' }, { asset: null, amount: '836000000', destination: AGG }), trace_id: 'TH' };
    const route = parseWalletHistory({ actions: [first, hop('last', 'TH')], metadata: meta }, SELF);
    expect(route.map((row: any) => [row.id, row.kind])).toEqual([['first', 'swap']]);
    expect([route[0].symbol, route[0].wanted.symbol, route[0].got.symbol, formatUnits(route[0].got.amount, route[0].got.decimals)]).toEqual(['USD₮', 'MUT', 'MUT', '30.0923']);
    expect([route[0].take?.wallet, route[0].take?.transactions], 'read by the end\'s own transactions, into the wallet its payout names [round 140]').toEqual([rawAccount(JW), ['last-in', 'last-take']]);
    const refunded = (amount: string, asset: any = null, said = true) => {
      const one: any = hop('last', 'TH', { success: false });
      one.details.dex_outgoing_transfer = { source: ROUTER, destination: SELF, amount, ...(said ? { asset } : {}) };
      return one;
    };
    for (const [label, end] of [['said', refunded('836000000')], ['not said', refunded('836000000', null, false)]] as const) {
      const failed = parseWalletHistory({ actions: [first, end], metadata: meta }, SELF);
      expect(failed.map((row: any) => [row.id, row.success, row.got.symbol, formatUnits(row.got.amount, row.got.decimals), row.wanted.symbol]), label)
        .toEqual([['first', true, 'GRAM', '0.836', 'GRAM']]);
    }
    expect(parseWalletHistory({ actions: [first, refunded('0', TOKEN)], metadata: meta }, SELF).map((row: any) => [row.id, row.got.amount, row.wanted.symbol])).toEqual([['first', '0', 'GRAM']]);
    expect(parseWalletHistory({ actions: [first, { ...refunded('0'), trace_id: 'TX' }], metadata: meta }, SELF).map((row: any) => row.id), 'nor anything that came').toEqual(['first']);
    expect(parseWalletHistory({ actions: [first, { ...refunded('836000000'), trace_id: 'TX' }], metadata: meta }, SELF).map((row: any) => [row.id, row.kind, row.amount, row.success, row.payment ?? null]))
      .toEqual([['last', 'gram', '836000000', true, 'swap'], ['first', 'swap', '1116800', true, null]]);
    const elsewhere = parseWalletHistory({ actions: [first, hop('last', 'TX')], metadata: meta }, SELF);
    expect(elsewhere.map((row: any) => [row.id, row.kind, row.direction, row.symbol, formatUnits(row.amount, row.decimals), row.counterparty, row.verified ?? null])).toEqual([
      ['last', 'jetton', 'in', 'MUT', '30.0923', AGG, false], ['first', 'swap', 'out', 'USD₮', '1.1168', ROUTER, null]]);
    expect([elsewhere[1].got.amount, elsewhere[1].wanted.symbol]).toEqual(['0', 'GRAM']);
    expect([elsewhere[0].held, elsewhere[0].take?.wallet], 'held until its jetton wallet\'s take is read [round 140 — C1-1]').toEqual([true, rawAccount(JW)]);
    const unread: any = hop('last', 'TX');
    delete unread.transactions;
    expect(parseWalletHistory({ actions: [first, unread], metadata: meta }, SELF).map((row: any) => row.id), 'nothing to read it by: not drawn').toEqual(['first']);
    const paysAnother = parseWalletHistory({ actions: [first, hop('last', 'TH', {}, OTHER)], metadata: meta }, SELF);
    expect(paysAnother.map((row: any) => [row.id, row.got.amount, row.got.symbol, row.wanted.symbol, row.take])).toEqual([['first', '0', 'GRAM', 'GRAM', undefined]]);
    const twice = parseWalletHistory({ actions: [first, { ...first, action_id: 'second' }, hop('last', 'TH')], metadata: meta }, SELF);
    expect(twice.map((row: any) => row.got.amount).sort()).toEqual(['0', '30092300000']);
    const more: any = hop('more', 'TH');
    more.details.dex_outgoing_transfer.amount = '1000000000';
    const twoEnds = parseWalletHistory({ actions: [first, { ...first, action_id: 'second' }, hop('last', 'TH'), more], metadata: meta }, SELF);
    expect(twoEnds.map((row: any) => [row.kind, row.got.amount]).sort()).toEqual([['swap', '1000000000'], ['swap', '30092300000']]);
    const oneOfTwo = parseWalletHistory({ actions: [first, hop('last', 'TH'), more], metadata: meta }, SELF);
    expect(oneOfTwo.map((row: any) => [row.id, row.kind, row.kind === 'swap' ? row.got.amount : row.amount])).toEqual([['more', 'jetton', '1000000000'], ['first', 'swap', '30092300000']]);
    const J = '0:' + 'e4'.repeat(32);
    const B = '0:' + 'bb'.repeat(32);
    const toJ = { ...swap('direct', 900, { asset: USDT, amount: '12000000' }, { asset: null, amount: '1500000000', destination: J }), trace_id: 'TD' };
    const via = (wallet: string) => ({ type: 'jetton_swap', success: true, end_utime: 901, action_id: 'next', trace_id: 'TD', transactions: ['next-take'], start_lt: '9010', end_lt: '9019',
      details: { dex: 'stonfi_v2', sender: B, asset_in: null, asset_out: TOKEN, dex_incoming_transfer: { source: B, destination: ROUTER, destination_jetton_wallet: wallet, asset: null, amount: '1500000000' },
        dex_outgoing_transfer: { source: ROUTER, destination: SELF, destination_jetton_wallet: JW, asset: TOKEN, amount: '5968501500000' } } });
    const joined = parseWalletHistory({ actions: [toJ, via(J)], metadata: meta }, SELF);
    expect(joined.map((row: any) => [row.id, row.wanted.symbol, row.got.symbol, formatUnits(row.got.amount, row.got.decimals)])).toEqual([['direct', 'MUT', 'MUT', '5 968.5015']]);
    const apart = parseWalletHistory({ actions: [toJ, via(OTHER)], metadata: meta }, SELF);
    expect(apart.map((row: any) => [row.id, row.kind, row.kind === 'swap' ? row.got.amount : row.amount]), 'by another wallet: what came, beside it')
      .toEqual([['next', 'jetton', '5968501500000'], ['direct', 'swap', '0']]);
    const toB = { ...toJ, action_id: 'toB', details: { ...toJ.details, dex_outgoing_transfer: { ...toJ.details.dex_outgoing_transfer, destination: B } } };
    expect(parseWalletHistory({ actions: [toJ, toB, via(J)], metadata: meta }, SELF).map((row: any) => row.got.amount).sort(), 'one end under two keys: taken once')
      .toEqual(['0', '5968501500000']);
    const SCAM = '0:' + '5c'.repeat(32);
    const theirs = (id: string, asset: any, amount: string) => ({ type: 'jetton_swap', success: true, end_utime: 950, action_id: id, trace_id: `T-${id}`,
      transactions: [`${id}-take`], start_lt: '9500', end_lt: '9509',
      details: { dex: 'dedust', sender: OTHER, asset_in: TOKEN, asset_out: asset, dex_incoming_transfer: { source: OTHER, destination: ROUTER, asset: TOKEN, amount: '65450000000' },
        dex_outgoing_transfer: { source: ROUTER, destination: SELF, destination_jetton_wallet: asset ? '0:' + 'f4'.repeat(32) : null, asset, amount } } });
    const paidUs = parseWalletHistory({ actions: [theirs('usdt', USDT, '2304718049'), theirs('gram', null, '59800000000'), theirs('scam', SCAM, '1000')],
      metadata: { ...meta, [SCAM]: master('Tether USD', 'USD₮', { decimals: '6' }, { is_scam: true }) } }, SELF);
    expect(paidUs.map((row: any) => [row.id, row.kind, row.direction, row.symbol, formatUnits(row.amount, row.decimals), row.counterparty, row.payment ?? null, row.verified ?? null, row.success]))
      .toEqual([['usdt', 'jetton', 'in', 'USD₮', '2 304.718', rawAccount(OTHER), null, true, true], ['gram', 'gram', 'in', 'GRAM', '59.8', rawAccount(OTHER), 'swap', null, true]]);
    expect(paidUs.map((row: any) => row.held ?? false), 'a token end is held until read; GRAM is drawn as it came').toEqual([true, false]);
    const RELAYER = '0:' + 'f5'.repeat(32);
    const relayed = parseWalletHistory({ actions: [{ ...swap('relayed', 990, { asset: USDT, amount: '5000000' }, { asset: TOKEN, amount: '7000000000' }, { sender: RELAYER }), trace_id: 'TG' }], metadata: meta }, SELF);
    expect(relayed.map((row: any) => [row.id, row.kind, row.got.amount])).toEqual([['relayed', 'swap', '7000000000']]);
    const unsaid = parseWalletHistory({ actions: [{ type: 'jetton_swap', success: false, end_utime: 990, action_id: 'unsaid', trace_id: 'TU',
      details: { dex: 'stonfi_v2', sender: SELF, asset_in: null, asset_out: USDT, dex_incoming_transfer: { source: SELF, destination: ROUTER, asset: null, amount: '3000000000' },
        dex_outgoing_transfer: { source: ROUTER, destination: SELF, amount: '3000000000' } } }], metadata: meta }, SELF);
    expect([unsaid[0].got.symbol, unsaid[0].got.amount, unsaid[0].wanted.symbol]).toEqual(['GRAM', '3000000000', 'USD₮']);
  });

  it('ASSETS-14: what came by a swap in a token is what this wallet\'s own jetton wallet took — one read beside the page, the figures corrected when it lands; an end no swap took drawn only then [client audit round 140 — C1-1, C1-2]', async () => {
    const DEX = '0:' + '92'.repeat(32);
    const TAXED = '0:' + 'c9'.repeat(32);
    const OTHERTAX = '0:' + 'af'.repeat(32);
    const TAXWALLET = '0:' + 'fd'.repeat(32);
    const BUYER = '0:' + '77'.repeat(32);
    const JW_TAXED = '0:' + 'e1'.repeat(32);
    const JW_OTHER = '0:' + 'e2'.repeat(32);
    const ownWallet = (jetton: string) => ({ is_indexed: true, token_info: [{ valid: true, type: 'jetton_wallets', extra: { owner: SELF, jetton, balance: '1' } }] });
    const meta = { [TAXED]: master('Taxed', 'TXD', { decimals: '9' }), [OTHERTAX]: master('Other Taxed', 'OTX', { decimals: '9' }),
      [JW_TAXED.toUpperCase()]: ownWallet(TAXED), [JW_OTHER.toUpperCase()]: ownWallet(OTHERTAX),
      [('0:' + 'e9'.repeat(32)).toUpperCase()]: { is_indexed: true, token_info: [{ valid: true, type: 'jetton_wallets', extra: { owner: BUYER, jetton: TAXED, balance: '1' } }] } };
    const swapOf = (id: string, sender: string, to: string, asset: string, amount: string, lt: number, extra: any = {}) => ({ type: 'jetton_swap', success: true,
      end_utime: 1_000 + lt, action_id: id, trace_id: `T-${id}`, transactions: [`${id}-a`, `${id}-b`, `${id}-c`], start_lt: String(lt * 10), end_lt: String(lt * 10 + 9),
      details: { dex: 'dedust', sender, asset_in: null, asset_out: asset, dex_incoming_transfer: { source: sender, destination: DEX, asset: null, amount: '7600000000' },
        dex_outgoing_transfer: { source: DEX, destination: to, destination_jetton_wallet: to === SELF ? (asset === TAXED ? JW_TAXED : JW_OTHER) : '0:' + '1a'.repeat(32), asset, amount } }, ...extra });
    const takeTx = (hash: string, account: string, amount: string, extra: any = {}) => ({ hash, account, description: { aborted: false },
      in_msg: { opcode: '0x178d4519', bounced: false, message_content: { decoded: { amount: { value: amount } } } }, ...extra });
    const asked: string[] = [];
    const serve = (actions: any[], transactions: any) => async (url: string) => {
      asked.push(url);
      if (url.includes('/api/v3/actions?')) return { ok: true, json: async () => ({ actions, metadata: meta }) };
      return transactions ? { ok: true, json: async () => ({ transactions }) } : { ok: false, status: 429 };
    };
    const read = (actions: any[], transactions: any) => new Promise<any>((done) => {
      let page: any = null;
      const timer = setTimeout(() => done({ page, landed: false }), 200);
      void readWalletHistory({ account: SELF, origin: 'https://o', fetchImpl: serve(actions, transactions) as any,
        onTokenTakes: () => { clearTimeout(timer); setTimeout(() => done({ page, landed: true }), 0); } }).then((one) => { page = one; });
    });
    const page1 = [
      swapOf('buy', SELF, SELF, TAXED, '673018891800000', 10),
      swapOf('named-away', SELF, TAXWALLET, OTHERTAX, '1347728565598', 20),
      swapOf('end', BUYER, SELF, TAXED, '45669454700000', 30),
      { type: 'jetton_transfer', success: true, end_utime: 1_040, action_id: 'plain', trace_id: 'T-plain', transactions: ['plain-a'], start_lt: '400', end_lt: '409',
        details: { asset: TAXED, sender: OTHER, receiver: SELF, amount: '5000000000' } },
    ];
    const took = [takeTx('buy-b', JW_TAXED, '625907569400000'), takeTx('named-away-b', JW_OTHER, '1199478423383'), takeTx('end-b', JW_TAXED, '38819036500000'),
      takeTx('elsewhere', JW_TAXED, '5'),
      takeTx('buy-a', DEX, '999'),
      takeTx('end-a', JW_TAXED, '777', { in_msg: { opcode: '0x178d4519', bounced: true, message_content: { decoded: { amount: { value: '777' } } } } }),
      takeTx('plain-a', JW_TAXED, '1'),
      takeTx('buy-c', JW_TAXED, '1000', { description: { aborted: true } }),
      takeTx('named-away-c', JW_OTHER, '5', { in_msg: { opcode: '0xd53276db', bounced: false, message_content: { decoded: { amount: { value: '5' } } } } }),
      takeTx('hop-b', JW_TAXED, '88')];
    const AGG = '0:' + 'a9'.repeat(32);
    page1.push({ ...swapOf('routed', SELF, AGG, null as any, '836000000', 33), trace_id: 'T-route' },
      { ...swapOf('hop', AGG, SELF, TAXED, '100', 34), trace_id: 'T-route' });
    const a = await read(page1, took);
    expect(a.landed).toBe(true);
    const row = (id: string) => a.page.rows.find((one: any) => one.id === id);
    expect([row('buy').got.amount, row('named-away').got.amount, row('end').amount, row('end').held ?? false, row('plain').amount, row('routed').got.amount]).toEqual(
      ['625907569400000', '1199478423383', '38819036500000', false, '5000000000', '88']);
    expect(historyRowsOf(a.page.rows).rows.map((one: any) => one.id), 'the end, read, is drawn').toContain('end');
    const transactionsAsked = asked.filter((url) => url.includes('/api/v3/transactions?'));
    expect(transactionsAsked.length, 'one read for the page').toBe(1);
    expect(transactionsAsked[0]).toContain(`account=${encodeURIComponent(rawAccount(JW_TAXED))}`);
    expect(transactionsAsked[0]).toContain(`account=${encodeURIComponent(rawAccount(JW_OTHER))}`);
    expect(transactionsAsked[0]).toContain('start_lt=100&end_lt=349');
    const named = parseWalletHistory({ actions: [swapOf('bare', SELF, SELF, TAXED, '10', 5)], metadata: {} }, SELF);
    expect(named[0].take?.wallet).toBe(rawAccount(JW_TAXED));
    asked.length = 0;
    const first = await readWalletHistory({ account: SELF, origin: 'https://o', fetchImpl: serve([swapOf('buy2', SELF, SELF, TAXED, '10', 50), swapOf('end2', BUYER, SELF, TAXED, '20', 60)], null) as any });
    expect([first.rows.find((one: any) => one.id === 'buy2').got.amount, first.rows.find((one: any) => one.id === 'end2').held]).toEqual(['10', true]);
    expect(historyRowsOf(first.rows).rows.map((one: any) => one.id), 'held: not drawn').toEqual(['buy2']);
    await new Promise((done) => setTimeout(done, 20));
    const again = await read([swapOf('buy2', SELF, SELF, TAXED, '10', 50), swapOf('end2', BUYER, SELF, TAXED, '20', 60)], [takeTx('buy2-b', JW_TAXED, '9'), takeTx('end2-b', JW_TAXED, '19')]);
    expect([again.landed, again.page.rows.find((one: any) => one.id === 'buy2').got.amount, again.page.rows.find((one: any) => one.id === 'end2').amount]).toEqual([true, '9', '19']);
    asked.length = 0;
    const kept = await readWalletHistory({ account: SELF, origin: 'https://o', fetchImpl: serve(page1, took) as any });
    expect(asked.filter((url) => url.includes('/api/v3/transactions?'))).toEqual([]);
    expect(kept.rows.find((one: any) => one.id === 'buy').got.amount).toBe('625907569400000');
    const none = await read([swapOf('end3', BUYER, SELF, TAXED, '30', 70), swapOf('buy3', SELF, SELF, TAXED, '40', 80)], [takeTx('buy3-b', JW_TAXED, '39')]);
    expect([none.page.rows.find((one: any) => one.id === 'end3').held, none.page.rows.find((one: any) => one.id === 'buy3').got.amount], 'read whole, found nothing: no longer waited on')
      .toEqual(['nothing', '39']);
    asked.length = 0;
    const later = await readWalletHistory({ account: SELF, origin: 'https://o', fetchImpl: serve([swapOf('end3', BUYER, SELF, TAXED, '30', 70)], []) as any });
    expect([asked.filter((url) => url.includes('/api/v3/transactions?')).length, later.rows[0].held]).toEqual([0, 'nothing']);
    asked.length = 0;
    const full = Array.from({ length: 100 }, (_, index) => takeTx(`noise-${index}`, JW_TAXED, '1'));
    const paged = new Promise<any>((done) => {
      let page: any = null;
      let calls = 0;
      void readWalletHistory({ account: SELF, origin: 'https://o', onTokenTakes: () => setTimeout(() => done(page), 0),
        fetchImpl: (async (url: string) => {
          asked.push(url);
          if (url.includes('/api/v3/actions?')) return { ok: true, json: async () => ({ actions: [swapOf('buy4', SELF, SELF, TAXED, '50', 90)], metadata: meta }) };
          calls += 1;
          return { ok: true, json: async () => ({ transactions: calls === 1 ? full : [takeTx('buy4-b', JW_TAXED, '49')] }) };
        }) as any }).then((one) => { page = one; });
    });
    const p = await paged;
    expect([p.rows[0].got.amount, asked.filter((url) => url.includes('/api/v3/transactions?')).map((url) => new URL(url).searchParams.get('offset'))]).toEqual(['49', ['0', '100']]);
    const OTHERWALLET = '0:' + '6b'.repeat(32);
    const theirJw = '0:' + '1a'.repeat(32);
    const intoOther = swapOf('into', SELF, OTHERWALLET, TAXED, '70', 97);
    const mine = await read([intoOther], [takeTx('into-b', theirJw, '69')]);
    expect(mine.page?.rows?.[0]?.got?.amount ?? '0').toBe('0');
    const theirs = await new Promise<any>((done) => {
      let page: any = null;
      void readWalletHistory({ account: OTHERWALLET, origin: 'https://o', fetchImpl: serve([intoOther], [takeTx('into-b', theirJw, '69')]) as any,
        onTokenTakes: () => setTimeout(() => done(page), 0) }).then((one) => { page = one; });
    });
    expect([theirs.rows[0].id, theirs.rows[0].held ?? false, theirs.rows[0].amount]).toEqual(['into', false, '69']);
    const higher = await read([swapOf('buy5', SELF, SELF, TAXED, '60', 95)], [takeTx('buy5-b', JW_TAXED, '61')]);
    expect([higher.landed, higher.page.rows[0].got.amount]).toEqual([false, '60']);
  });

  it('ASSETS-15: a page is drawn at once, its token end held while its take is out — a stalled take holds nothing up [client audit round 142 — C7-1, C7-2]', async () => {
    const TAXED = '0:' + 'c8'.repeat(32);
    const JW = '0:' + 'e8'.repeat(32);
    const end = { type: 'jetton_swap', success: true, end_utime: 2_000, action_id: 'stall-end', trace_id: 'T-stall', transactions: ['stall-a'], start_lt: '20', end_lt: '29',
      details: { dex: 'dedust', sender: OTHER, asset_in: null, asset_out: TAXED, dex_incoming_transfer: { source: OTHER, destination: '0:' + '92'.repeat(32), asset: null, amount: '1' },
        dex_outgoing_transfer: { source: '0:' + '92'.repeat(32), destination: SELF, destination_jetton_wallet: JW, asset: TAXED, amount: '100' } } };
    const started = Date.now();
    const page = await readWalletHistory({ account: SELF, origin: 'https://o', fetchImpl: (async (url: string) => (url.includes('/api/v3/actions?')
      ? { ok: true, json: async () => ({ actions: [end], metadata: { [TAXED]: master('Taxed', 'TXD', { decimals: '9' }) } }) }
      : new Promise(() => {}))) as any });
    const waited = Date.now() - started;
    expect([page.rows[0].held, waited < 1_000]).toEqual([true, true]);
  });

  it('ASSETS-16: a failed swap whose payout toncenter names 0 had its input back, read as taken; a route ending in the paid account\'s own transfer is the swap\'s "+"; a royalty from the sale bought from, whatever its words [the LOW batch of 2026-11-07]', async () => {
    const VAULT = '0:' + '07'.repeat(32);
    const AGG = '0:' + 'f0'.repeat(32);
    const SALE = '0:' + '5b'.repeat(32);
    const JW_USDT = '0:' + '0e'.repeat(32);
    const TOKEN = '0:' + 'c4'.repeat(32);
    const meta = { [USDT]: master('Tether USD', 'USD₮', { decimals: '6' }), [TOKEN]: master('Made Up', 'MUP', { decimals: '9' }) };
    const failed = (id: string, given: any) => ({ type: 'jetton_swap', success: false, end_utime: 3_000, action_id: id, trace_id: `T-${id}`, transactions: [`${id}-a`, `${id}-b`, `${id}-c`, `${id}-d`],
      start_lt: '300', end_lt: '309', details: { dex: 'dedust_v2', sender: SELF, asset_in: given.asset, asset_out: TOKEN,
        dex_incoming_transfer: { source: SELF, destination: VAULT, source_jetton_wallet: given.asset ? JW_USDT : null, ...given },
        dex_outgoing_transfer: { source: VAULT, destination: SELF, asset: null, amount: '0' } } });
    const tx = (hash: string, account: string, source: string | null, value: string, opcode: string, amount?: string, lt = '10', sent = false) => ({ hash, account, lt,
      out_msgs: sent ? [{ destination: VAULT }] : [], description: { aborted: false },
      in_msg: { source, value, opcode, bounced: false, message_content: { decoded: amount ? { amount: { value: amount } } : null } } });
    const settle = (actions: any[], transactions: any[]) => new Promise<any>((done) => {
      let page: any = null;
      const timer = setTimeout(() => done(page), 200);
      void readWalletHistory({ account: SELF, origin: 'https://o', onTokenTakes: () => { clearTimeout(timer); setTimeout(() => done(page), 0); },
        fetchImpl: (async (url: string) => ({ ok: true, json: async () => (url.includes('/api/v3/actions?') ? { actions, metadata: meta } : { transactions }) })) as any })
        .then((one) => { page = one; });
    });
    const parsedToken = parseWalletHistory({ actions: [failed('ft', { asset: USDT, amount: '20000000' })], metadata: meta }, SELF);
    expect([parsedToken[0].got.amount, parsedToken[0].got.symbol, parsedToken[0].take?.wallet, parsedToken[0].wanted.symbol]).toEqual(['0', 'USD₮', rawAccount(JW_USDT), 'MUP']);
    const token = await settle([failed('ft2', { asset: USDT, amount: '20000000' })], [tx('ft2-b', JW_USDT, VAULT, '50000000', '0x178d4519', '20000000'), tx('elsewhere', JW_USDT, VAULT, '1', '0x178d4519', '7')]);
    expect([token.rows[0].got.amount, token.rows[0].got.symbol, token.rows[0].success]).toEqual(['20000000', 'USD₮', false]);
    const gram = await settle([failed('fg', { asset: null, amount: '16932435982' })], [tx('fg-b', SELF, VAULT, '16932435982', '0x3216ca09', undefined, '5'), tx('fg-c', SELF, VAULT, '248800000', '0xd53276db', undefined, '6'),
      tx('fg-d', SELF, SELF, '999', '0x00000000', undefined, '7'), tx('fg-e', SELF, VAULT, '20000000', '0x7362d09c', undefined, '8')]);
    expect([gram.rows[0].got.amount, gram.rows[0].got.symbol]).toEqual(['16932435982', 'GRAM']);
    const loop = (id: string, txs: string[], at: number, lt: number) => ({ ...failed(id, { asset: null, amount: '21489735742' }), trace_id: 'T-loop', end_utime: at,
      transactions: txs, start_lt: String(lt), end_lt: String(lt + 9) });
    const looped = await settle([loop('l2', ['l1-r', 'l2-r', 'l2-x'], 3_001, 320), loop('l1', ['l1-o', 'l1-r', 'l1-x'], 3_000, 300)], [tx('l1-o', SELF, null, '0', '', undefined, '1', true),
      tx('l1-r', SELF, VAULT, '21499735742', '0x3216ca09', undefined, '3', true), tx('l1-x', SELF, VAULT, '388800000', '0xd53276db', undefined, '4'),
      tx('l2-r', SELF, VAULT, '21499735742', '0x3216ca09', undefined, '5'), tx('l2-x', SELF, VAULT, '388800000', '0xd53276db', undefined, '6')]);
    expect(looped.rows.filter((row: any) => row.kind === 'swap').map((row: any) => [row.id, row.got.amount])).toEqual([['l2', '21499735742'], ['l1', '21499735742']]);
    const forwards = await settle([failed('ff', { asset: null, amount: '276000000000' })], [tx('ff-b', SELF, VAULT, '276564210785', '0x3216ca09', undefined, '34', true),
      tx('ff-c', SELF, VAULT, '698800000', '0xd53276db', undefined, '40')]);
    expect(forwards.rows[0].got.amount).toBe('276564210785');
    const named = parseWalletHistory({ actions: [{ ...failed('fn', { asset: null, amount: '5' }), details: { ...failed('fn', { asset: null, amount: '5' }).details,
      dex_outgoing_transfer: { source: VAULT, destination: SELF, asset: null, amount: '5' } } }], metadata: meta }, SELF);
    expect([named[0].got.amount, named[0].take]).toEqual(['5', undefined]);
    const through = parseWalletHistory({ actions: [{ ...failed('fo', { asset: USDT, amount: '5' }), success: true }], metadata: meta }, SELF);
    expect([through[0].got.amount, through[0].got.symbol, through[0].take]).toEqual(['0', 'GRAM', undefined]);
    const ownSwap = (id: string, trace: string, assetIn: any, assetOut: any) => ({ type: 'jetton_swap', success: true, end_utime: 4_000, action_id: id, trace_id: trace,
      details: { dex: 'stonfi_v2', sender: SELF, asset_in: assetIn, asset_out: assetOut, dex_incoming_transfer: { source: SELF, destination: VAULT, asset: assetIn, amount: '1000000000' },
        dex_outgoing_transfer: { source: VAULT, destination: AGG, asset: null, amount: '990000000' } } });
    const handed = (id: string, trace: string, asset: string, amount: string) => ({ type: 'jetton_transfer', success: true, end_utime: 4_001, action_id: id, trace_id: trace,
      details: { asset, sender: AGG, receiver: SELF, amount } });
    const route = parseWalletHistory({ actions: [handed('h1', 'TR', USDT, '5408214'), ownSwap('s1', 'TR', null, TOKEN)], metadata: meta }, SELF);
    expect(route.map((row: any) => [row.id, row.kind, row.got?.amount, row.got?.symbol, row.wanted?.symbol])).toEqual([['s1', 'swap', '5408214', 'USD₮', 'USD₮']]);
    const back = parseWalletHistory({ actions: [handed('h2', 'TB', USDT, '74104436'), ownSwap('s2', 'TB', USDT, TOKEN)], metadata: meta }, SELF);
    expect(back.map((row: any) => [row.id, row.got?.symbol, row.wanted?.symbol])).toEqual([['s2', 'USD₮', 'MUP']]);
    const withEnd = parseWalletHistory({ actions: [handed('h3', 'TE', USDT, '1'), ownSwap('s3', 'TE', null, TOKEN), { type: 'jetton_swap', success: true, end_utime: 4_002, action_id: 'e3',
      trace_id: 'TE', transactions: ['e3-a'], start_lt: '1', end_lt: '2', details: { dex: 'dedust', sender: AGG, asset_in: null, asset_out: TOKEN,
        dex_incoming_transfer: { source: AGG, destination: VAULT, asset: null, amount: '1' }, dex_outgoing_transfer: { source: VAULT, destination: SELF, destination_jetton_wallet: '0:' + 'f3'.repeat(32), asset: TOKEN, amount: '9' } } }],
    metadata: meta }, SELF);
    expect(withEnd.map((row: any) => [row.id, row.kind, row.kind === 'swap' ? row.got.amount : row.amount]).sort()).toEqual([['h3', 'jetton', '1'], ['s3', 'swap', '9']]);
    const stranger = parseWalletHistory({ actions: [{ ...handed('h4', 'TS', USDT, '3'), details: { asset: USDT, sender: OTHER, receiver: SELF, amount: '3' } }, ownSwap('s4', 'TS', null, USDT)], metadata: meta }, SELF);
    expect(stranger.map((row: any) => [row.id, row.kind]).sort()).toEqual([['h4', 'jetton'], ['s4', 'swap']]);
    const SCAMMY = '0:' + 'dd'.repeat(32);
    const away = parseWalletHistory({ actions: [{ ...handed('h7', 'TW', USDT, '4'), details: { asset: USDT, sender: AGG, receiver: OTHER, amount: '4' } }, ownSwap('s7', 'TW', null, USDT)], metadata: meta }, SELF);
    expect(away.map((row: any) => [row.id, row.got?.amount])).toEqual([['s7', '0']]);
    const scam = parseWalletHistory({ actions: [handed('h8', 'TX8', SCAMMY, '4'), ownSwap('s8', 'TX8', null, USDT)],
      metadata: { ...meta, [SCAMMY]: master('Tether USD', 'USD₮', { decimals: '6' }, { is_scam: true }) } }, SELF);
    expect(scam.map((row: any) => [row.id, row.got?.amount])).toEqual([['s8', '0']]);
    const pair = parseWalletHistory({ actions: [handed('h5', 'TP', USDT, '11'), handed('h6', 'TP', USDT, '22'), ownSwap('s5', 'TP', null, USDT), { ...ownSwap('s6', 'TP', null, USDT), end_utime: 4_005 }], metadata: meta }, SELF);
    expect(pair.map((row: any) => [row.id, row.got?.amount])).toEqual([['s6', '22'], ['s5', '11']]);
    const COLLECTION = '0:80D78A35F955A14B679FAA887FF4CD5BFC0F43B4A4EEA2A7E6927F3701B273C2';
    const ITEM = '0:' + '6c'.repeat(32);
    const bought = parseWalletHistory({ actions: [
      { type: 'nft_purchase', success: true, end_utime: 5_000, action_id: 'buy', trace_id: 'TQ', details: { nft_collection: COLLECTION, nft_item: ITEM, old_owner: SALE, new_owner: SELF,
        real_old_owner: OTHER, price: '10000000000', payout_address: OTHER, payout_amount: '9000000000' } },
      { type: 'ton_transfer', success: true, end_utime: 5_001, action_id: 'royalty', trace_id: 'TQ', details: { source: SALE, destination: SELF, value: '500000000' } },
      { type: 'ton_transfer', success: true, end_utime: 5_001, action_id: 'rest', trace_id: 'TQ', details: { source: ITEM, destination: SELF, value: '90000000' } },
    ], metadata: {} }, SELF);
    expect(bought.map((row: any) => [row.id, row.payment ?? null])).toEqual([['royalty', 'royalty'], ['buy', null]]);
    const call = (id: string, at: number, value: string) => ({ type: 'call_contract', success: true, end_utime: at, action_id: id, trace_id: 'TT', details: { source: AGG, destination: SELF, value, opcode: '0x4cb700a9' } });
    const twoSwaps = parseWalletHistory({ actions: [call('r2', 6_003, '2'), call('r1', 6_002, '1'), { ...ownSwap('sb', 'TT', USDT, null), end_utime: 6_001 }, { ...ownSwap('sa', 'TT', USDT, null), end_utime: 6_000 }],
      metadata: meta }, SELF);
    expect(twoSwaps.map((row: any) => row.id)).toEqual(['sb', 'sa', 'r2', 'r1']);
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
