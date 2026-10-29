import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { collectOwnedTelegramGifts } from '../web/telegram-gift-nfts.mjs';
import { parseNftItems } from '../web/wallet-assets.mjs';
import { RESECURE_CACHE_CARRY_ORDER } from '../web/storage-resecure.mjs';


const app = readFileSync('web/app.js', 'utf8');
const html = readFileSync('web/index.html', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const lift = (env: Record<string, any>, sources: string[], exported: string) => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [...sources, `return ${exported};`].join(String.fromCharCode(10)))(...names.map((n) => env[n]));
};
const addr = (n: number) => `0:${n.toString(16).padStart(64, '0')}`;
const OWNER = addr(0x77);

describe('client audit round 43', () => {
  it('R43-01 (F1-1, F5-1, F4-1, F6-5): last time\'s list lives apart — drawn by the two lists only; nothing that offers or signs reads it', async () => {
    const state: any = { owner: OWNER, tab: 'tokens', tokens: null, loading: new Map(), failures: new Map(), retries: new Map(), at: new Map(), stored: {} };
    let answer: (rows: any[]) => void = () => {};
    let asked = 0;
    const load = lift({
      walletAssetsState: state, WALLET_ASSETS_TTL_MS: 60_000, WALLET_ASSETS_RETRY_MS: [5_000], toncenterRestOrigin: () => '', readStoredToncenterApiKey: () => '',
      createToncenterRestFetch: () => null, walletAthMaster: () => '', noteTonRpcRateLimit: () => false, walletTokenDecimals: () => null, isVaultViewActive: () => true,
      renderWalletAssets: () => {}, writeStoredWalletAssets: async () => {},
      readStoredWalletAssets: () => new Promise(() => {}),
      readJettonBalances: () => { asked += 1; return new Promise((resolve) => { answer = resolve; }); },
    }, [fn('async function loadWalletAssets(tab, { force = false, more = false, keep = false } = {}) {')], 'loadWalletAssets');
    const running = load('tokens');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(asked, 'the chain is read BESIDE the store, never after it').toBe(1);
    answer([{ master: 'now', balance: '1', decimals: 9 }]);
    await running;
    expect(state.tokens.map((token: any) => token.master)).toEqual(['now']);
    const second: any = { owner: OWNER, tab: 'tokens', tokens: null, loading: new Map(), failures: new Map(), retries: new Map(), at: new Map(), stored: {} };
    let reply: (rows: any[]) => void = () => {};
    const loadAgain = lift({
      walletAssetsState: second, WALLET_ASSETS_TTL_MS: 60_000, WALLET_ASSETS_RETRY_MS: [5_000], toncenterRestOrigin: () => '', readStoredToncenterApiKey: () => '',
      createToncenterRestFetch: () => null, walletAthMaster: () => '', noteTonRpcRateLimit: () => false, walletTokenDecimals: () => null, isVaultViewActive: () => true,
      renderWalletAssets: () => {}, writeStoredWalletAssets: async () => {},
      readStoredWalletAssets: async () => [{ master: 'last-time', balance: '5', decimals: 9 }],
      readJettonBalances: () => new Promise((resolve) => { reply = resolve; }),
    }, [fn('async function loadWalletAssets(tab, { force = false, more = false, keep = false } = {}) {')], 'loadWalletAssets');
    const again = loadAgain('tokens');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect([second.stored.tokens?.map((token: any) => token.master), second.tokens]).toEqual([['last-time'], null]);
    reply([{ master: 'now', balance: '1', decimals: 9 }]);
    await again;
    for (const reader of ['function walletAthToken() {', 'async function openWalletSendChooser() {', 'function walletSwapOffers() {']) {
      expect(code(fn(reader)), reader).not.toContain('stored');
    }
    expect(code(fn('function renderWalletTokens(panel) {'))).toContain('walletAssetsState.tokens ?? walletAssetsState.stored.tokens ?? []');
    expect(code(fn('function renderWalletNfts(panel) {'))).toContain('walletAssetsState.nfts ?? walletAssetsState.stored.nft ?? []');
    expect(code(fn('function walletAssetsFresh(tab) {')), 'fresh = the live list exists [F1-3, F6-1]').toContain("return (tab === 'tokens' ? walletAssetsState.tokens : walletAssetsState.nfts) !== null;");
    expect(code(fn('async function writeStoredWalletAssets(rawWallet, tab, list) {'))).toContain('plathoLocalDataClearing) return;');
    expect(RESECURE_CACHE_CARRY_ORDER, 'carried by the storage re-secure [F6-7]').toContain('walletAssets');
  });

  it('R43-02 (F1-2, F3-2): the proof says what it DECIDED; a gift that came after it is not spam; one fresh proof, once a session', async () => {
    const result = await collectOwnedTelegramGifts({
      ownerWallet: OWNER, indexerItems: [{ itemAddress: addr(0xa1) }, { itemAddress: addr(0xb2) }],
      verifyItem: async (address: string) => { if (address === addr(0xb2)) throw new Error('no answer'); return { collectionAddress: addr(0xc3), ownerWallet: OWNER, contentUri: '' }; },
      verifyCollection: async () => ({ codeHash: 'junk', dataBoc: null, contentUri: '' }), verifyMembership: async () => '',
    });
    expect(result.examined, 'a read that failed decides nothing').toEqual([addr(0xa1)]);
    const rows = { nft_items: [{ address: addr(1), collection_address: addr(0x10), content: { uri: 'https://nft.fragment.com/gift/spicedwine-12074.json' } }], metadata: {} };
    expect(parseNftItems(rows, { giftVerdictsKnown: true, examinedItems: [] })[0].verified, 'came after the proof').toBe(null);
    expect(parseNftItems(rows, { giftVerdictsKnown: true, examinedItems: [addr(1)] })[0].verified).toBe(false);
    const load = code(fn('async function loadWalletAssets(tab, { force = false, more = false, keep = false } = {}) {'));
    expect(load).toContain('examinedItems: gifts?.examined ?? []');
    expect(load).toContain("if (gifts?.complete && nfts.some((item) => item.verified === null) && state.reprovedFor !== owner) {");
    expect(load, 'proven in an earlier session stays proven [F5-3]').toContain("const provenBefore = (state.stored.nft ?? []).filter((one) => one?.verified === true).map((one) => one.address);");
    expect(load).toContain('verifiedItems: [...(gifts?.gifts ?? []).map((gift) => gift.itemAddress), ...provenBefore]');
  });

  it('R43-03 (F3-1): a dead collection is an answer — "not a gift", decided — and the bin burns its junk', () => {
    const reader = code(fn('async function verifyTelegramGiftCollectionOnChain('));
    expect(reader).toContain("if (!row) return { codeHash: '', dataBoc: '', contentUri: '', dead: true, missing: true };");
    expect(reader).toContain('createShardStatesRequest({ strict: true, requestOptions })');
    expect(code(fn('async function runWalletAssetBurn(picked) {'))).toContain("if (!verdict?.codeHash && !(verdict?.dead && !verdict.missing)) throw new Error('the collection could not be read');");
  });

  it('R43-04: not yet checked goes with the hidden; a hidden one has "Show again" alone; nothing hidden or unchecked is offered to send', () => {
    const nfts = code(fn('function renderWalletNfts(panel) {'));
    expect(nfts).toContain('const out = (one) => one.verified === null || hiddenByOwner.has(one.address);');
    expect(nfts).toContain('const tucked = walletShowsHidden() ? items.filter(out) : [];');
    const actions = code(fn('function walletCardNftActions(item) {'));
    expect(actions.indexOf('if (item.verified === null) return')).toBeLessThan(actions.indexOf('walletCardSendRow('));
    expect(actions).toContain('if (walletHiddenAssets().has(item.address)) return walletCardUnhide(item.address);');
    expect(code(fn('function openWalletTokenCard(token, { refill = false } = {}) {'))).toContain('walletHiddenAssets().has(token.master) ? walletCardUnhide(token.master)');
    const chooser = code(fn('async function openWalletSendChooser() {'));
    expect(chooser).toContain('const hiddenNow = walletHiddenAssets();');
    expect(chooser).toContain('...nfts.filter((one) => one.verified === true && !hiddenNow.has(one.address)), ...nfts.filter((one) => one.verified === false && !hiddenNow.has(one.address))');
    const tokens = code(fn('function renderWalletTokens(panel) {'));
    expect(tokens).toContain('for (const token of tokens.filter((one) => one.verified && !hidden.has(one.master))) list.append(row(token));');
  });

  it('R43-05 (split 2026-10-21; [2026-10-23]): ATH\'s row opens the token card every token has, and the program rides under it', () => {
    expect(html).not.toMatch(/id="athSendButton"|id="athSwapButton"|id="athCardHead"|id="athCardStats"|id="athCardActions"/);
    expect(html).toMatch(/<section class="profile-section" data-wallet-group="ath"[^>]*>\s*<div class="settings-list">/);
    expect(app).not.toContain('function openWalletAthGroup(');
    expect(code(fn('function openWalletTokenCard(token, { refill = false } = {}) {'))).toContain("also: isAth ? ['ath'] : []");
    expect(code(fn('function openWalletAthCard() {'))).toContain('if (token) openWalletTokenCard(token);');
  });

  it('R43-06 (F5-2): an open card is drawn again from its list when the list is drawn', () => {
    const render = code(fn('function renderWalletAssets(tab) {'));
    expect(render).toContain('const open = walletAssetsState.openCard;');
    expect(render).toContain('(tab === \'tokens\' ? openWalletTokenCard : openWalletNftCard)(row, { refill: true });');
    expect(code(fn('function openWalletTokenCard(token, { refill = false } = {}) {'))).toContain("if (!refill) openWalletGroup('token',");
    expect(code(fn('function openWalletGramCard() {'))).toContain('walletAssetsState.openCard = null;');
  });
});
