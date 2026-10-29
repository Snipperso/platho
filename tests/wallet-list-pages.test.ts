import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { WALLET_LIST_PAGES, WALLET_NFT_PAGE, WALLET_TOKEN_PAGE, readJettonBalances, readNftItems } from '../web/wallet-assets.mjs';
import { TELEGRAM_GIFT_DISCOVERY_PAGE, TELEGRAM_GIFT_DISCOVERY_PAGES, discoverTelegramGiftItems } from '../web/telegram-gift-nfts.mjs';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';


const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const OWNER = `0:${'11'.repeat(32)}`;
const USDT = `0:${'b1'.repeat(32)}`;
const hex = (n: number) => n.toString(16).padStart(64, '0');
const junkWallet = (i: number) => ({ address: `0:${hex(i + 1)}`, owner: OWNER, jetton: `0:${hex(0x100000 + i)}`, balance: '1' });
const genuineWallet = { address: `0:${'f0'.repeat(32)}`, owner: OWNER, jetton: USDT, balance: '2500000000' };

function indexOf(key: string, rows: any[], metadataOf: (row: any) => [string, any] | null = () => null) {
  const asked: URLSearchParams[] = [];
  const fetchImpl = async (url: string) => {
    const query = new URL(url).searchParams;
    asked.push(query);
    const limit = Number(query.get('limit'));
    const offset = Number(query.get('offset'));
    const page = rows.slice(offset, offset + limit);
    const metadata: any = {};
    for (const row of page) { const entry = metadataOf(row); if (entry) metadata[entry[0]] = entry[1]; }
    return { ok: true, json: async () => ({ [key]: page, metadata }) };
  };
  return { asked, fetchImpl };
}

describe('a wallet\'s lists read past the first page', () => {
  it('WLPAGES-01: tokens — a full page asks for the next; the genuine token behind 1,000 junk rows is found, its metadata with it; nothing said cut', async () => {
    const index = indexOf('jetton_wallets', [...Array.from({ length: WALLET_TOKEN_PAGE }, (_u, i) => junkWallet(i)), genuineWallet],
      (row) => (row.jetton === USDT ? [USDT, { is_indexed: true, token_info: [{ type: 'jetton_masters', name: 'Tether USD', symbol: 'USDT', extra: { decimals: '6' } }] }] : null));
    const tokens = await readJettonBalances({ owner: OWNER, fetchImpl: index.fetchImpl, alsoVerified: [USDT] });
    expect(index.asked.map((q) => [q.get('offset'), q.get('limit'), q.get('owner_address'), q.get('exclude_zero_balance')]))
      .toEqual([['0', String(WALLET_TOKEN_PAGE), OWNER, 'true'], [String(WALLET_TOKEN_PAGE), String(WALLET_TOKEN_PAGE), OWNER, 'true']]);
    const usdt = tokens.find((one: any) => one.master === USDT);
    expect(usdt).toMatchObject({ balance: '2500000000', verified: true, symbol: 'USDT', decimals: 6 });
    expect(tokens).toHaveLength(WALLET_TOKEN_PAGE + 1);
    expect((tokens as any).capped).toBeUndefined();
    const small = indexOf('jetton_wallets', [genuineWallet]);
    await readJettonBalances({ owner: OWNER, fetchImpl: small.fetchImpl });
    expect(small.asked).toHaveLength(1);
  });

  it('WLPAGES-02: the bound — a flood past it reads the bound\'s pages, no more, and the list carries how many rows it read', async () => {
    const flood = indexOf('jetton_wallets', Array.from({ length: WALLET_TOKEN_PAGE * WALLET_LIST_PAGES + 5 }, (_u, i) => junkWallet(i)));
    const tokens = await readJettonBalances({ owner: OWNER, fetchImpl: flood.fetchImpl });
    expect(WALLET_LIST_PAGES).toBe(5);
    expect(flood.asked.map((q) => q.get('offset'))).toEqual(['0', '1000', '2000', '3000', '4000']);
    expect((tokens as any).capped).toBe(WALLET_TOKEN_PAGE * WALLET_LIST_PAGES);
    expect(Object.keys(tokens), 'the mark is not a row').not.toContain('capped');
    let n = 0;
    const failing = async (url: string) => { n += 1; if (n === 2) return { ok: false, status: 429 }; return flood.fetchImpl(url); };
    await expect(readJettonBalances({ owner: OWNER, fetchImpl: failing })).rejects.toMatchObject({ status: 429 });
  });

  it('WLPAGES-03: NFTs — the genuine items behind a 1,000-item junk collection are read, newest first as before; the flood is marked cut', async () => {
    const junk = Array.from({ length: WALLET_NFT_PAGE }, (_u, i) => ({ address: `0:${hex(i + 1)}`, collection_address: `0:${'00'.repeat(31)}01`, last_transaction_lt: String(10 + i), content: {} }));
    const dns = { address: `0:${'d0'.repeat(32)}`, collection_address: `0:${'e5'.repeat(32)}`, last_transaction_lt: '99999', content: {} };
    const index = indexOf('nft_items', [...junk, dns], (row) => (row === dns ? [dns.address, { token_info: [{ name: 'myname.ton' }] }] : null));
    const items = await readNftItems({ owner: OWNER, fetchImpl: index.fetchImpl, verifiedItems: [dns.address] });
    expect(index.asked.map((q) => q.get('offset'))).toEqual(['0', '1000']);
    expect(items[0]).toMatchObject({ address: dns.address, name: 'myname.ton', verified: true });
    expect((items as any).capped).toBeUndefined();
    const flood = indexOf('nft_items', Array.from({ length: WALLET_NFT_PAGE * WALLET_LIST_PAGES }, (_u, i) => ({ address: `0:${hex(i + 1)}`, collection_address: `0:${'00'.repeat(31)}01`, content: {} })));
    expect((await readNftItems({ owner: OWNER, fetchImpl: flood.fetchImpl }) as any).capped).toBe(WALLET_NFT_PAGE * WALLET_LIST_PAGES);
  });

  it('WLPAGES-04: the gift discovery reads the same pages — a gift behind 1,000 junk items is proposed; the bound holds; the proposal cap counts every page', async () => {
    const junk = Array.from({ length: TELEGRAM_GIFT_DISCOVERY_PAGE }, (_u, i) => ({ address: `0:${hex(i + 1)}`, collection_address: `0:${'00'.repeat(31)}01`, content: { uri: `https://spam.example/${i}.json` } }));
    const gift = { address: `0:${'a7'.repeat(32)}`, collection_address: `0:${'f0'.repeat(32)}`, content: { uri: 'https://nft.fragment.com/gift/hangingstar-24388.json' } };
    const index = indexOf('nft_items', [...junk, gift]);
    const proposed = await discoverTelegramGiftItems({ ownerWallet: OWNER, fetchImpl: index.fetchImpl });
    expect(proposed.map((one: any) => [one.itemAddress, one.proposedSlug])).toEqual([[gift.address, 'hangingstar']]);
    expect(index.asked.map((q) => q.get('offset'))).toEqual(['0', '1000']);
    const gifts = Array.from({ length: TELEGRAM_GIFT_DISCOVERY_PAGE * (TELEGRAM_GIFT_DISCOVERY_PAGES + 1) }, (_u, i) => ({ address: `0:${hex(i + 1)}`, collection_address: `0:${'f0'.repeat(32)}`, content: { uri: `https://nft.fragment.com/gift/durovscap-${i + 1}.json` } }));
    const flood = indexOf('nft_items', gifts);
    expect(await discoverTelegramGiftItems({ ownerWallet: OWNER, fetchImpl: flood.fetchImpl })).toHaveLength(TELEGRAM_GIFT_DISCOVERY_PAGE * TELEGRAM_GIFT_DISCOVERY_PAGES);
    expect(flood.asked).toHaveLength(TELEGRAM_GIFT_DISCOVERY_PAGES);
    expect(TELEGRAM_GIFT_DISCOVERY_PAGES).toBe(WALLET_LIST_PAGES);
  });

  it('WLPAGES-05: the tab keeps the cut and draws it, last under each list and only over a live list; a new wallet starts uncut', () => {
    const note = new Function('document', 't', `${fn('function walletAssetsCutNote(panel, count) {')}\nreturn walletAssetsCutNote;`)(
      { createElement: (tag: string) => ({ tag, className: '', textContent: '' }) }, (key: string, params: any) => `${key}:${params.count}`);
    const appended: any[] = [];
    const panel = { append: (one: any) => appended.push(one) };
    note(panel, 0);
    note(panel, undefined);
    expect(appended).toEqual([]);
    note(panel, 5000);
    expect(appended).toEqual([{ tag: 'p', className: 'wallet-assets-note', textContent: 'wallet.assetsCut:5000' }]);
    const load = code(fn('async function loadWalletAssets(tab, { force = false, more = false, keep = false } = {}) {'));
    expect(load).toContain('state.cutTokens = Number(tokens?.capped) || 0;');
    expect(load).toContain('state.cutNfts = Number(nfts?.capped) || 0;');
    const node = (tag: string): any => ({
      tag, className: '', textContent: '', children: [] as any[],
      get childElementCount() { return this.children.length; }, get lastElementChild() { return this.children.at(-1) ?? null; },
      get classList() { const self = this; return { contains: (name: string) => self.className.split(' ').includes(name) }; },
      append(...more: any[]) { this.children.push(...more); }, replaceChildren(...more: any[]) { this.children = [...more]; },
    });
    const draw = (state: any) => {
      const target = node('section');
      new Function('walletAssetsState', 'walletHiddenAssets', 'walletShowsHidden', 'walletNftTile', 't', 'walletNftTiles', 'appendWalletFold', 'document',
        [fn('function walletAssetsReading(tab) {'), fn('function walletAssetsNote(panel, tab, emptyKey, hasRows) {'), fn('function walletAssetsCutNote(panel, count) {'), fn('function renderWalletNfts(panel) {'), 'return renderWalletNfts;'].join(String.fromCharCode(10)))(
        { stored: {}, loading: new Map(), failures: new Map(), retries: new Map(), at: new Map([['nft', 1]]), ...state }, () => new Set(), () => false, () => node('div'),
        (key: string, params: any) => (params ? `${key}:${params.count}` : key), new Map(), (into: any, _id: string, _title: string, _cls: string, tiles: any[]) => { if (tiles.length) into.append(node('details')); },
        { createElement: node })(target);
      return target.children.filter((one: any) => one.className === 'wallet-assets-note').map((one: any) => one.textContent);
    };
    expect(draw({ nfts: [{ address: 'a', verified: true }, { address: 'b', verified: null }], cutNfts: 5000 })).toEqual(['wallet.nftChecking', 'wallet.assetsCut:5000']);
    expect(draw({ nfts: [{ address: 'a', verified: true }], cutNfts: 0 })).toEqual([]);
    expect(draw({ nfts: null, stored: { nft: [{ address: 'a', verified: true }] }, cutNfts: 5000 }).filter((line: string) => line.startsWith('wallet.assetsCut'))).toEqual([]);
    const tokens = code(fn('function renderWalletTokens(panel) {')).trim();
    expect(tokens.endsWith('walletAssetsCutNote(panel, walletAssetsState.tokens === null ? 0 : walletAssetsState.cutTokens);\n}')).toBe(true);
    const nfts = code(fn('function renderWalletNfts(panel) {')).trim();
    expect(nfts.endsWith('walletAssetsCutNote(panel, walletAssetsState.nfts === null ? 0 : walletAssetsState.cutNfts);\n}')).toBe(true);
    expect(code(fn('function resetWalletAssets(owner) {'))).toContain('cutTokens: 0, cutNfts: 0,');
    for (const [locale, strings] of Object.entries(I18N_STRINGS as any)) expect((strings as any)['wallet.assetsCut'], locale).toContain('{count}');
  });
});
