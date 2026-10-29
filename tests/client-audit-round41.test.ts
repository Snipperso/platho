import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { beginCell } from '@ton/core';
import { code, sourceBlock } from './helpers/source';
import { TELEGRAM_GIFT_COLLECTION_CODE_HASH, parseTelegramGiftCollectionUri, telegramGiftCollectionIsAuthentic } from '../web/telegram-gift-nfts.mjs';
import { inlinePictureOf, parseNftItems } from '../web/wallet-assets.mjs';
import { BURN_ADDRESS, BURN_VALUE_NANOTONS, readNftHolder } from '../web/wallet-transfers.mjs';
import { encodeTonAddressSliceBoc } from '../web/ton-rpc-transport.mjs';


const app = readFileSync('web/app.js', 'utf8');
const css = readFileSync('web/styles.css', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const lift = (env: Record<string, any>, sources: string[], exported: string) => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [...sources, `return ${exported};`].join(String.fromCharCode(10)))(...names.map((n) => env[n]));
};
const addr = (n: number) => `0:${n.toString(16).padStart(64, '0')}`;
const OWNER = addr(0x77);
const ITEM = addr(0x7171);
const DUROVS_CAPS = '0:fd8a466aeb13e02a3ce67411b41b44bcd11bd42636f0807acf6570ca73fc2c13';
const DUROVS_CAPS_DATA_BOC =
  'te6ccgEBBQEArwAESYAAABLfHQ3koaSxignNG3FVwvqf99rxlgTH82d8KEprZvXkTEABAgMEAGYBaHR0cHM6Ly9uZnQu'
  + 'ZnJhZ21lbnQuY29tL2NvbGxlY3Rpb24vZHVyb3ZzY2FwLmpzb24IQgKR2eKsFp/Hhc4A3gqBrydiK5t9F2RBXHdeflDA'
  + 'POmKogAEAQAASwAFAGSADR50Dtpoo0MfqDwLjjaYBAqLqNZOrgycywS72hiTfgWQ';
const boc = (cell: any) => cell.toBoc().toString('base64');
const ADDR_NONE = { type: 'slice', value: boc(beginCell().storeUint(0, 2).endCell()) };
const slice = (address: string) => ({ type: 'slice', value: encodeTonAddressSliceBoc(address) });
const itemStack = ({ collection = slice(addr(0x1234)) as any, owner = OWNER, content = beginCell().storeStringTail('0/meta.json').endCell() } = {}) => ({
  stack: [{ type: 'num', value: '-0x1' }, { type: 'num', value: '0x7' }, collection, slice(owner), { type: 'cell', value: boc(content) }],
});

function burnRig({ stack = itemStack(), collectionRecord = { codeHash: 'junkcode', dataBoc: 'te6junk', contentUri: 'https://junk.example/c.json' } as any } = {}) {
  const signed: any[] = [];
  const said: any[] = [];
  const configs: any[] = [];
  const hid: any[] = [];
  const wallet = { address: OWNER, seed: 'never-quoted' };
  const transport = { runGetMethod: async (call: any) => { if (call.method !== 'get_nft_data') throw new Error(call.method); return stack; } };
  const env: Record<string, any> = {
    plathoWallet: wallet, walletTransferOnItsWay: () => false, walletTonTransfersBusy: new Set(), activeWindowHoldsWork: { inHand: 0 },
    refreshMessagingControls: () => {}, shortAddress: (a: string) => a.slice(0, 8), t: (key: string) => key, formatTonNanotonsUp: () => '0.05',
    formatUnits: (v: any) => String(v), balanceNeededText: () => 'needed', walletSendFeeReserveNanotons: () => 10_000_000n, walletAddressForCopy: (w: any) => w.address,
    BURN_VALUE_NANOTONS, BURN_ADDRESS, requireNoPendingServiceWorkerAppShellReload: () => {}, requirePlathoWallet: () => wallet,
    sameWalletAddress: (a: string, b: string) => String(a).toLowerCase() === String(b).toLowerCase(), walletChangedBeforeSigningError: () => new Error('changed'),
    readJettonWalletAddress: async () => addr(0x99), criticalChainReadOptions: () => ({ priority: 'critical' }), nextTransferQueryId: () => 1n,
    buildJettonTransferBody: (o: any) => ({ kind: 'jetton', ...o }), buildNftTransferBody: (o: any) => ({ kind: 'nft', ...o }),
    readNftHolder, globalThis: { plathoTonRpcTransport: transport }, plathoLocalDataClearing: false,
    verifyTelegramGiftCollectionOnChain: async () => collectionRecord, telegramGiftCollectionIsAuthentic, parseTelegramGiftCollectionUri, TELEGRAM_GIFT_COLLECTION_CODE_HASH,
    sendWalletAssetMessage: async (_signer: any, message: any) => { signed.push(message); return true; },
    walletAssetSendRefusal: (error: any) => `refused: ${error?.code ?? error?.message}`, walletAssetsSent: () => {}, flashWalletIdentityStatus: () => {},
    console: { error: () => {} }, setWalletAssetHidden: (address: string, hidden: boolean) => hid.push([address, hidden]),
    spendPasswordFields: () => [], spendPasswordRefusal: async () => '',
    openActionDialog: async (config: any) => {
      configs.push(config);
      said.push(...(config.summary?.() ?? []).map((line: any) => `${line.label}=${line.value}`));
      const answer = await config.validateSubmit({});
      said.push(answer.ok ? 'ok' : answer.error);
      return answer.ok ? answer.result : null;
    },
  };
  return { burn: lift(env, [fn('async function runWalletAssetBurn(picked) {')], 'runWalletAssetBurn'), signed, said, configs, hid };
}
const junkNft = { address: ITEM, collection: addr(0x1234), name: 'junk', verified: false };

describe('client audit round 41', () => {
  it('R41-01 (F3-1, F1-2, F5-1 — REGRESSION of round 40): a real NFT burns again — owner and collection read, never a gift\'s content', async () => {
    const standard = burnRig();
    await standard.burn({ kind: 'nft', item: junkNft });
    expect(standard.signed, 'a collection item whose content is a suffix').toHaveLength(1);
    expect(standard.signed[0]).toMatchObject({ address: ITEM, value: BURN_VALUE_NANOTONS, body: { kind: 'nft', newOwner: BURN_ADDRESS, forwardAmount: 0n } });
    const onChain = burnRig({ stack: itemStack({ content: beginCell().storeUint(0, 8).endCell() }) });
    await onChain.burn({ kind: 'nft', item: junkNft });
    expect(onChain.signed, 'on-chain content').toHaveLength(1);
    const standalone = burnRig({ stack: itemStack({ collection: ADDR_NONE }) });
    await standalone.burn({ kind: 'nft', item: { ...junkNft, collection: '' } });
    expect(standalone.signed, 'a standalone NFT (addr_none) is no gift').toHaveLength(1);
    expect(await readNftHolder({ transport: { runGetMethod: async () => itemStack({ collection: ADDR_NONE }) }, item: ITEM })).toEqual({ owner: OWNER, collection: null });
  });

  it('R41-02 (round 40 F3-2 kept; F3-3): a gift is still refused — by its collection\'s state or the content it names; a short answer proves nothing', async () => {
    const authentic = { codeHash: TELEGRAM_GIFT_COLLECTION_CODE_HASH, dataBoc: DUROVS_CAPS_DATA_BOC, contentUri: 'https://nft.fragment.com/collection/durovscap.json' };
    const gift = burnRig({ stack: itemStack({ collection: slice(DUROVS_CAPS) }), collectionRecord: authentic });
    await gift.burn({ kind: 'nft', item: { ...junkNft, collection: DUROVS_CAPS } });
    expect(gift.signed).toEqual([]);
    expect(gift.said).toContain('wallet.burnGift');
    const named = burnRig({ collectionRecord: { codeHash: 'other', dataBoc: 'te6x', contentUri: 'https://nft.fragment.com/collection/plushpepe.json' } });
    await named.burn({ kind: 'nft', item: junkNft });
    expect(named.signed, 'a collection whose content names a Telegram gift collection').toEqual([]);
    const short = burnRig({ collectionRecord: { codeHash: TELEGRAM_GIFT_COLLECTION_CODE_HASH, dataBoc: null, contentUri: '' } });
    await short.burn({ kind: 'nft', item: junkNft });
    expect(short.signed, 'an answer with no data proves nothing — refused').toEqual([]);
    const stranger = burnRig({ stack: itemStack({ owner: addr(0x88) }) });
    await stranger.burn({ kind: 'nft', item: junkNft });
    expect(stranger.signed, 'no longer this wallet\'s').toEqual([]);
  });

  it('R41-03 (F1-1 HIGH — REGRESSION of round 40): a double click on the bin is no burn — the dialog takes no press for its first moments', async () => {
    const rig = burnRig();
    await rig.burn({ kind: 'jetton', token: { master: addr(0x31), wallet: addr(0x99), balance: '123', decimals: 0, symbol: 'JUNK', verified: false } });
    expect(rig.configs[0].unprompted).toBe(true);
    expect(code(fn('function actionDialogPressAccepted(dialog, pressAt, now) {'))).toContain('if (dialog.unprompted && startedAt < openedAt + ACTION_DIALOG_UNPROMPTED_GRACE_MS) return false;');
    expect(rig.said.slice(0, 3)).toEqual(['wallet.from=0:000000', 'wallet.burnAmount=123 JUNK', 'common.balanceNeeded=needed']);
    expect(code(fn('async function runWalletAssetBurn(picked) {'))).not.toContain('signerAtPress');
  });

  it('R41-04 (F3-2): no NFT draws an inline picture — a forged item claiming the .ath registry carried a stranger\'s', () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64');
    const registry = addr(0x4444);
    const forged = addr(0x5555);
    const items = parseNftItems({ nft_items: [{ address: forged, collection_address: registry }],
      metadata: { [forged.toUpperCase()]: { token_info: [{ valid: true, name: 'tiles.ath', image: `data:image/svg+xml;base64,${svg}`, extra: { image_data: svg } }] } } },
    { verifiedCollections: [registry] });
    expect(items[0]).toMatchObject({ verified: true, picture: '' });
  });

  it('R41-05 (the stand): the .ath tiles draw the profile\'s stored art; an SVG cut mid-path is no picture', async () => {
    const whole = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4"/></svg>').toString('base64');
    expect(inlinePictureOf({ extra: { image_data: whole } })).toBe(`data:image/svg+xml;base64,${whole}`);
    const cut = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><path d="M1 1L${'2 2L'.repeat(40)}`).toString('base64');
    expect(inlinePictureOf({ extra: { image_data: cut } }), 'toncenter cuts image_data at 10,836 characters, mid-path').toBe('');
    const REGISTRY = addr(0x4444);
    const NAME = addr(0x5151);
    const art = `data:image/svg+xml;base64,${whole}`;
    const drawn: string[] = [];
    let ownReads = 0;
    const state: any = { owner: OWNER, nfts: null, tab: 'nft' };
    const env = {
      walletAssetsState: state, rawAccount: (a: string) => String(a).toLowerCase(), safeInlineImage: (image: string) => image, inlinePictureOf,
      readStoredUsernameNftList: async () => ({ owned: [{ label: 'tiles', itemAddress: NAME, image: art }] }),
      loadOwnedUsernameNfts: async () => { ownReads += 1; return null; }, writeStoredUsernameNftList: async () => {},
      sameWalletAddress: (a: string, b: string) => a === b, plathoWallet: { address: OWNER }, isVaultViewActive: () => true,
      renderWalletAssets: (tab: string) => drawn.push(tab),
    };
    const dress = lift(env, [fn('async function dressWalletNamesFromProfileList(owner, registry, nfts) {')], 'dressWalletNamesFromProfileList');
    const nfts = [{ address: NAME, collection: REGISTRY, picture: '' }, { address: addr(0x5252), collection: addr(0x9999), picture: '' }];
    state.nfts = nfts;
    await dress(OWNER, REGISTRY, nfts);
    expect(nfts.map((item) => item.picture)).toEqual([art, '']);
    expect([drawn, ownReads], 'drawn from the stored list, no read').toEqual([['nft'], 0]);
    const missing = [{ address: addr(0x5353), collection: REGISTRY, picture: '' }];
    state.nfts = missing;
    await dress(OWNER, REGISTRY, missing);
    await dress(OWNER, REGISTRY, missing);
    expect(ownReads, 'a name the list lacks: the profile\'s own read, once a session').toBe(1);
    expect(code(fn('async function loadWalletAssets(tab, { force = false, more = false, keep = false } = {}) {'))).toContain('void dressWalletNamesFromProfileList(owner, registry, nfts);');
  });

  it('R41-06 (F3-4, F5-2, F4 I-4): a picture\'s kind from a fixed list; the picture over the letter under forced colors; the icon is decoration', async () => {
    const picture = lift({
      walletPictureCache: new Map(), WALLET_NFT_PAGE: 1000, WALLET_PICTURE_MAX_BYTES: 1 << 20,
      rememberInBoundedCache: (cache: Map<string, any>, key: string, value: any) => cache.set(key, value),
      blobToBytes: async () => new Uint8Array([1, 2, 3]), bytesToImageDataUrl: (_b: any, type: string) => `data:${type};base64,AQID`,
      fetch: async (url: string) => ({ ok: true, blob: async () => ({ size: 3, type: url.includes('quote') ? 'image/png");background:url("x' : url.includes('svg') ? 'image/svg+xml' : 'image/png' }) }),
    }, [fn('function walletPicture(url, { shared = false } = {}) {')], 'walletPicture');
    expect(await picture('https://imgproxy.toncenter.com/a.png')).toBe('data:image/png;base64,AQID');
    expect(await picture('https://imgproxy.toncenter.com/quote.png'), 'a quote in the header').toBe(null);
    expect(await picture('https://imgproxy.toncenter.com/svg.svg'), 'not a raster').toBe(null);
    expect(css).toMatch(/\.wallet-nft-picture\.has-picture \{\s*color: transparent;\s*forced-color-adjust: none;/);
    expect(code(fn("function walletAssetIcon(picture, letter, className = 'wallet-asset-icon', { shared = false } = {}) {"))).toContain("icon.setAttribute('aria-hidden', 'true');");
  });
  it('R41-07: Burn hides the junk at once — it burns if its contract allows, else it stays hidden; Hide hides; shown again only by the setting', async () => {
    const burned = burnRig();
    await burned.burn({ kind: 'nft', item: junkNft });
    expect([burned.signed.length, burned.hid]).toEqual([1, [[ITEM, true]]]);
    const refused = burnRig({ stack: itemStack({ owner: addr(0x88) }) });
    await refused.burn({ kind: 'nft', item: junkNft });
    expect(refused.hid, 'nothing sent, nothing hidden').toEqual([]);
    const map = new Map<string, string>();
    const env = {
      walletLocalStorage: () => ({ getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => map.set(k, v), removeItem: (k: string) => map.delete(k) }),
      rawAccount: (a: string) => String(a).toLowerCase(), plathoWallet: { address: OWNER },
      WALLET_HIDDEN_ASSETS_KEY: 'platho.walletHiddenAssets.v1', WALLET_SHOW_HIDDEN_KEY: 'platho.walletShowHidden.v1', WALLET_HIDDEN_ASSETS_MAX: 5000,
    };
    const api = lift(env, [fn('function walletHiddenAssets() {'), fn('function setWalletAssetHidden(address, hidden) {'), fn('function walletShowsHidden() {'),
], '{ hidden: walletHiddenAssets, set: setWalletAssetHidden, shows: walletShowsHidden }');
    const JUNK = addr(0x31);
    expect(api.shows(), 'shown hidden: No by default').toBe(false);
    api.set(JUNK, true);
    expect(api.hidden().has(JUNK)).toBe(true);
    map.set('platho.walletShowHidden.v1', '1');
    expect(api.shows(), 'the setting shows them, apart').toBe(true);
    api.set(JUNK, false);
    expect(api.hidden().has(JUNK)).toBe(false);
    const html = readFileSync('web/index.html', 'utf8');
    expect(html).toMatch(/<select id="walletShowHiddenSelect"[^>]*>\s*<option value="no" data-i18n="wallet\.showHiddenNo">/);
    const tokens = code(fn('function renderWalletTokens(panel) {'));
    expect(tokens).toContain("const unverified = tokens.filter((one) => !one.verified && !hidden.has(one.master));");
    expect(tokens).toContain("const tucked = walletShowsHidden() ? tokens.filter((one) => hidden.has(one.master)) : [];");
    const nfts = code(fn('function renderWalletNfts(panel) {'));
    expect(nfts).toContain("const unverified = items.filter((one) => one.verified === false && !out(one));");
    expect(code(fn('async function openWalletSendChooser() {'))).toContain('const hiddenNow = walletHiddenAssets();');
    expect(code(fn('function openWalletTokenCard(token, { refill = false } = {}) {'))).toContain('token.verified ? null : walletCardHide(token.master,');
    expect(code(fn('function walletCardNftActions(item) {'))).toContain('item.verified === false ? walletCardHide(item.address,');
  });
});
