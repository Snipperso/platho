import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { inlinePictureOf, parseNftItems } from '../web/wallet-assets.mjs';


const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const lift = (env: Record<string, any>, sources: string[], exported: string) => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [...sources, `return ${exported};`].join(String.fromCharCode(10)))(...names.map((n) => env[n]));
};
const addr = (n: number) => `0:${n.toString(16).padStart(64, '0')}`;
const OWNER = addr(0x77);

describe('client audit round 42', () => {
  it('R42-01: a gift not yet proven is "checking" — among the verified, without the bin or Hide; the burn refuses it at its door', async () => {
    const rows = { nft_items: [
      { address: addr(1), collection_address: addr(0x10), content: { uri: 'https://nft.fragment.com/gift/spicedwine-12074.json' } },
      { address: addr(2), collection_address: addr(0x20), content: { uri: 'https://spam.example/platho.ath.json' } },
    ], metadata: {} };
    expect(parseNftItems(rows, { giftVerdictsKnown: false }).map((item: any) => item.verified)).toEqual([null, false]);
    expect(parseNftItems(rows, { giftVerdictsKnown: true }).map((item: any) => item.verified), 'a whole proof decides').toEqual([false, false]);
    expect(parseNftItems(rows, { giftVerdictsKnown: true, examinedItems: [] }).map((item: any) => item.verified)).toEqual([null, false]);
    expect(parseNftItems(rows, { giftVerdictsKnown: true, examinedItems: [addr(1)] }).map((item: any) => item.verified)).toEqual([false, false]);
    expect(parseNftItems(rows, { giftVerdictsKnown: false, verifiedItems: [addr(1)] }).map((item: any) => item.verified)).toEqual([true, false]);
    const load = code(fn('async function loadWalletAssets(tab, { force = false, more = false, keep = false } = {}) {'));
    expect(load).toContain('giftVerdictsKnown: gifts?.complete === true');
    const nfts = code(fn('function renderWalletNfts(panel) {'));
    expect(nfts).toContain('const out = (one) => one.verified === null || hiddenByOwner.has(one.address);');
    expect(nfts).toContain('for (const item of items.filter((one) => one.verified === true && !out(one))) grid.append(walletNftTile(item));');
    expect(nfts).toContain('const tucked = walletShowsHidden() ? items.filter(out) : [];');
    const card = code(fn('function walletCardNftActions(item) {'));
    expect(card).toContain("item.verified === false ? walletCardBurn(() => runWalletAssetBurn({ kind: 'nft', item })) : null,");
    expect(card).toContain('item.verified === false ? walletCardHide(item.address,');
    expect(card).toContain("if (item.verified === null) return walletCardStat(t('wallet.actionSend'), t('wallet.nftChecking'));");
    let reached = false;
    const burn = lift({ plathoWallet: { address: OWNER }, walletTransferOnItsWay: () => false, walletTonTransfersBusy: { add: () => { reached = true; } },
      walletAddressForCopy: (w: any) => w.address, shortAddress: (a: string) => a }, [fn('async function runWalletAssetBurn(picked) {')], 'runWalletAssetBurn');
    await burn({ kind: 'nft', item: { address: addr(1), verified: null } });
    expect(reached, 'a checking gift never reaches the burn').toBe(false);
  });

  it('R42-02: a fold the person opened stays open through every redraw', () => {
    const made: any[] = [];
    const element = (tag: string) => {
      const node: any = { tag, children: [], open: false, listeners: {}, className: '', textContent: '',
        append(...items: any[]) { this.children.push(...items); }, addEventListener(type: string, cb: any) { this.listeners[type] = cb; } };
      made.push(node);
      return node;
    };
    const state = { openFolds: new Set<string>() };
    const fold = lift({ document: { createElement: element }, walletAssetsState: state }, [fn('function appendWalletFold(panel, key, title, listClass, nodes) {')], 'appendWalletFold');
    const panel: any = { children: [], append(item: any) { this.children.push(item); } };
    fold(panel, 'nft-unverified', 'Unverified (2)', 'wallet-nft-grid', [{}, {}]);
    const first = panel.children[0];
    expect(first.open).toBe(false);
    first.open = true;
    first.listeners.toggle();
    fold(panel, 'nft-unverified', 'Unverified (1)', 'wallet-nft-grid', [{}]);
    expect(panel.children[1].open, 'drawn again, still open').toBe(true);
    expect(code(fn('function resetWalletAssets(owner) {'))).toContain('walletAssetsState.openFolds.clear();');
  });

  it('R42-03: last time\'s tokens and NFTs drawn at once, sealed for the wallet — and no Send, bin, Hide or Swap until the chain is read', async () => {
    const records = new Map<string, any>();
    const store = { get: async (key: string) => records.get(key), put: async (key: string, url: string) => { records.set(key, { url }); } };
    const io = lift({ deviceCacheStore: async (name: string) => (name === 'walletAssets' ? store : null), plathoLocalDataClearing: false },
      [fn('async function readStoredWalletAssets(rawWallet, tab) {'), fn('async function writeStoredWalletAssets(rawWallet, tab, list) {')],
      '{ read: readStoredWalletAssets, write: writeStoredWalletAssets }');
    await io.write(OWNER, 'nft', [{ address: addr(1), picture: 'https://imgproxy.toncenter.com/a.png' }, { address: addr(2), picture: 'data:image/svg+xml;base64,AAAA' }]);
    expect(await io.read(OWNER, 'nft')).toEqual([{ address: addr(1), picture: 'https://imgproxy.toncenter.com/a.png' }, { address: addr(2), picture: '' }]);
    expect(await io.read(addr(0x88), 'nft'), 'another wallet\'s is its own').toBe(null);
    expect(app).toMatch(/walletAssets: Object\.freeze\(\{ plain: null, cap: \(\) => 16 \}\)/);
    const load = code(fn('async function loadWalletAssets(tab, { force = false, more = false, keep = false } = {}) {'));
    expect(load.indexOf('readStoredWalletAssets(owner, tab)')).toBeLessThan(load.indexOf('readJettonBalances('));
    expect(load).toContain("void writeStoredWalletAssets(owner, tab, tab === 'tokens' ? state.tokens : state.nfts);");
    expect(code(fn('function walletAssetsFresh(tab) {'))).toContain("return (tab === 'tokens' ? walletAssetsState.tokens : walletAssetsState.nfts) !== null;");
    const token = code(fn('function openWalletTokenCard(token, { refill = false } = {}) {'));
    expect(token).toContain("walletAssetsFresh('tokens') ? walletCardSendRow(");
    expect(token).toContain(": walletCardStat(t('wallet.actionSend'), t('wallet.readingChain')),");
    expect(token).toContain('...(walletSwapOffers().some((offer) => offer.id === token.master)');
    expect(code(fn('function walletCardNftActions(item) {'))).toContain("if (!walletAssetsFresh('nft')) return walletCardStat(t('wallet.actionSend'), t('wallet.readingChain'));");
    let answer: (rows: any[]) => void = () => {};
    const drawn: any[] = [];
    const written: any[] = [];
    const state: any = { owner: OWNER, tab: 'tokens', tokens: null, loading: new Map(), failures: new Map(), retries: new Map(), at: new Map(), stored: {} };
    const loadTokens = lift({
      walletAssetsState: state, WALLET_ASSETS_TTL_MS: 60_000, WALLET_ASSETS_RETRY_MS: [5_000], toncenterRestOrigin: () => '', readStoredToncenterApiKey: () => '',
      createToncenterRestFetch: () => null, walletAthMaster: () => '', noteTonRpcRateLimit: () => false, walletTokenDecimals: () => null, isVaultViewActive: () => true,
      renderWalletAssets: () => drawn.push((state.tokens ?? state.stored.tokens)?.map((token: any) => token.master) ?? null),
      readStoredWalletAssets: async () => [{ master: 'last-time', balance: '1', decimals: 9 }],
      writeStoredWalletAssets: async (_owner: string, tab: string, list: any[]) => { written.push([tab, list.map((token) => token.master)]); },
      readJettonBalances: () => new Promise((resolve) => { answer = resolve; }),
      walletMarketSettleTrades: () => {},
    }, [fn('async function loadWalletAssets(tab, { force = false, more = false, keep = false } = {}) {')], 'loadWalletAssets');
    const running = loadTokens('tokens');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(state.stored.tokens?.map((token: any) => token.master), 'last time\'s list while the chain is read').toEqual(['last-time']);
    expect(state.tokens, 'APART from the live list — nothing offers or signs from it [round 43 — F1-1]').toBe(null);
    answer([{ master: 'now', balance: '2', decimals: 9 }]);
    await running;
    expect([state.tokens.map((token: any) => token.master), state.at.has('tokens'), written]).toEqual([['now'], true, [['tokens', ['now']]]]);
    expect(drawn.some((list) => list?.[0] === 'last-time')).toBe(true);
  });

  it('R42-04 (F3-1): a picture\'s kind is cleaned where every data URL is built — a header with a quote cannot reach url("…")', () => {
    const build = lift({ webpCanvasSize: () => ({ width: 1, height: 1 }), DRAWN_IMAGE_MAX_SIDE: 4096, DRAWN_IMAGE_MAX_PIXELS: 16e6, EMPTY_WEBP_DATA_URL: 'data:image/webp;base64,EMPTY',
      bytesToBase64: () => 'AQID' }, [fn("function bytesToImageDataUrl(bytes, mime = 'image/webp') {")], 'bytesToImageDataUrl');
    expect(build(new Uint8Array([1, 2, 3]), 'image/png')).toBe('data:image/png;base64,AQID');
    const hostile = build(new Uint8Array([1, 2, 3]), 'image/png");background:url("https://x.example/');
    expect(hostile).not.toContain('"');
    expect(hostile.startsWith('data:image/webp;base64,')).toBe(true);
  });

  it('R42-05 (F3-2): Telegram\'s gift-collection code refuses the burn whatever its data says; a junk collection still burns', () => {
    const burn = code(fn('async function runWalletAssetBurn(picked) {'));
    expect(burn).toContain("if (verdict.codeHash === TELEGRAM_GIFT_COLLECTION_CODE_HASH || parseTelegramGiftCollectionUri(verdict.contentUri)) return { ok: false, error: t('wallet.burnGift') };");
    expect(burn).toContain("if (!verdict?.codeHash && !(verdict?.dead && !verdict.missing)) throw new Error('the collection could not be read');");
    expect(burn.split('skipIfRateLimited: false').length - 1, 'the bin\'s reads wait a 429 park out [F1-L1, F6-3]').toBe(3);
  });

  it('R42-06 (F3-3, F6-1, F1-L4; F6-2; F1-L3): the chooser reads the hidden list once; the names\' stored art is drawn before any read; the empty line by what is shown', async () => {
    const chooser = code(fn('async function openWalletSendChooser() {'));
    expect(chooser.split('walletHiddenAssets()').length - 1).toBe(1);
    const REGISTRY = addr(0x4444);
    const NAME = addr(0x5151);
    const art = 'data:image/svg+xml;base64,PHN2Zy8+';
    const drawn: string[] = [];
    const state: any = { owner: OWNER, nfts: null, tab: 'nft' };
    const nfts = [{ address: NAME, collection: REGISTRY, picture: '' }, { address: addr(0x5353), collection: REGISTRY, picture: '' }];
    state.nfts = nfts;
    const dress = lift({
      walletAssetsState: state, rawAccount: (a: string) => String(a).toLowerCase(), safeInlineImage: (image: string) => image, inlinePictureOf,
      readStoredUsernameNftList: async () => ({ owned: [{ itemAddress: NAME, image: art }] }),
      loadOwnedUsernameNfts: () => new Promise(() => {}),
      writeStoredUsernameNftList: async () => {}, sameWalletAddress: (a: string, b: string) => a === b, plathoWallet: { address: OWNER },
      isVaultViewActive: () => true, renderWalletAssets: (tab: string) => drawn.push(tab),
    }, [fn('async function dressWalletNamesFromProfileList(owner, registry, nfts) {')], 'dressWalletNamesFromProfileList');
    void dress(OWNER, REGISTRY, nfts);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect([nfts[0].picture, drawn], 'drawn while the read still runs').toEqual([art, ['nft']]);
    expect(code(fn('function renderWalletNfts(panel) {'))).toContain("walletAssetsNote(panel, 'nft', emptyKey, walletAssetsState.nfts !== null && panel.childElementCount > 0);");
  });
});
