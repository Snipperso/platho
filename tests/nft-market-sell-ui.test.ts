import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { historyRowsOf } from '../web/wallet-assets.mjs';


const app = readFileSync('web/app.js', 'utf8');
const block = (start: string) => code(sourceBlock(app, start));
const before = (text: string, first: string, second: string) => {
  const a = text.indexOf(first);
  const b = text.indexOf(second);
  expect(a, first).toBeGreaterThan(-1);
  expect(b, second).toBeGreaterThan(-1);
  expect(a, `${first} before ${second}`).toBeLessThan(b);
};

describe('selling from the wallet', () => {
  it('NFTSELLUI-01: Sell stands beside Send only on what the app vouches for; an unverified NFT keeps its bin and Hide, never a Sell', () => {
    const actions = block('function walletCardNftActions(item) {');
    expect(actions).toContain("if (item.verified === true && item.collection) return walletCardButtonPair(send, walletCardSend(() => runWalletNftAction((hold) => openNftSellDialog(item, hold)), t('nft.sell'), 'is-sell'));");
    before(actions, "if (item.verified === null) return", 'openNftSellDialog');
    before(actions, "if (!walletAssetsFresh('nft')) return", 'openNftSellDialog');
  });

  it('NFTSELLUI-02: the sale is signed only after the NFT reads as this wallet\'s again and the terms read as the window showed them; the key is wiped whatever happens', () => {
    const sell = block('async function openNftSellDialog(item, hold) {');
    before(sell, 'const opened = openActionDialog({', 'void walletNftListingTerms(item.collection, { wanted: () => activeActionDialog === mine })');
    expect(sell).not.toMatch(/await walletNftListingTerms\(item\.collection\);/);
    expect(sell).toContain('setActiveActionSubmitEnabled(activeActionDialog?.validating !== true && Boolean(terms));');
    expect(sell).toContain('if (!terms) return { ok: false, error: termsRefusal() };');
    expect(sell).toContain("unread ? t('errors.networkNotNow') : t('nft.sellNoTerms')");
    before(sell, 'if (activeActionDialog !== mine) return;', 'updateActiveActionSummary();');
    before(sell, 'const asked = walletNftListingPrice(submitted?.price, terms);', 'await spendPasswordRefusal(submitted)');
    before(sell, 'await spendPasswordRefusal(submitted)', 'hold?.();');
    before(sell, 'const owner = await readNftOwner({ transport: globalThis.plathoTonRpcTransport, item: item.address, callOptions: pressReadOptions(criticalChainReadOptions()) });', 'await buildListing(');
    before(sell, "if (!sameWalletAddress(owner, signer.address)) throw Object.assign(new Error('this NFT is not this wallet\\'s'), { code: 'NFT_NOT_OWNED' });", 'await buildListing(');
    before(sell, 'if (!walletNftSameTerms(await walletNftListingTerms(item.collection), terms))', 'await buildListing(');
    before(sell, 'await buildListing(', 'await sendWalletAssetMessage(signer, { address: item.address, value: NFT_LIST_VALUE + topUp, body: listing.body });');
    expect(sell).toContain(".then(async (read) => { topUp = await walletNftTopUp(item, pressReadOptions({ priority: 'focus' })); return read; })");
    before(sell, "if (await walletNftTopUp(item, pressReadOptions(criticalChainReadOptions())) > topUp) throw", 'await sendWalletAssetMessage(');
    expect(sell).toContain("{ label: t('common.balanceNeeded'), value: balanceNeededText(NFT_LIST_VALUE + topUp + walletSendFeeReserveNanotons()) },");
    expect(sell).toContain('const secretKey = crypto.getRandomValues(new Uint8Array(32));');
    expect(sell).toMatch(/\} finally \{\s*secretKey\.fill\(0\);/);
    before(sell, 'await sendWalletAssetMessage(', 'if (isName) usernameNftLeftWallet(label, signer.address);');
    before(sell, 'await sendWalletAssetMessage(', 'if (isGift) telegramGiftLeftWallet(item.address, signer.address);');
    expect(block('async function submitUsernameNftTransfer(nft, recipient) {')).toContain('usernameNftLeftWallet(nft.label, wallet.address);');
    expect(block('async function submitTelegramGiftTransfer(gift, recipient) {')).toContain('telegramGiftLeftWallet(gift.itemAddress, wallet.address);');
  });

  it('NFTSELLUI-07: an item on its own sale offers no transfer, and every window that signs one away reads it first [client audit round 95 — C10-1]', () => {
    const actions = block('function walletCardNftActions(item) {');
    before(actions, "if (item.onSale && item.verified !== false) return walletCardStat(t('wallet.actionSend'), t('wallet.historyNftListed'));", 'const send = walletCardSend(');
    before(block('async function openNftSellDialog(item, hold) {'), 'await refuseNftOnOwnSale(item.address);', 'await sendWalletAssetMessage(');
    before(block('async function openWalletNftTransferDialog(item, hold) {'), 'await refuseNftOnOwnSale(item.address);', 'await sendWalletAssetMessage(');
    before(block('async function submitTelegramGiftTransfer(gift, recipient) {'), 'await refuseNftOnOwnSale(gift.itemAddress);', 'await sendPlathoWalletTransaction(');
    expect(block('function walletAssetSendRefusal(error) {')).toContain("error?.code === 'NFT_ON_OWN_SALE' ? t('nft.onOwnSale')");
    expect(block('async function refuseNftOnOwnSale(itemAddress) {')).toContain("{ code: 'NFT_ON_OWN_SALE' }");
  });

  it('NFTSELLUI-08: what one\'s own listing just did holds over the index\'s lag; a sale found gone leaves «On sale» too [client audit rounds 91, 95]', () => {
    const fn = (start: string) => sourceBlock(app, start);
    const env: Record<string, any> = { walletAssetsState: { ownPending: new Map(), nftListings: null, tab: 'tokens' } };
    const applied = new Function('walletAssetsState', `${fn('function walletNftOwnPendingApplied(listings) {')}\nreturn walletNftOwnPendingApplied;`)(env.walletAssetsState);
    const listings = [{ sale: 'a', price: 5n }, { sale: 'b', price: 7n }, { sale: 'c', price: 9n }];
    env.walletAssetsState.ownPending.set('a', { price: null, at: Date.now() });
    env.walletAssetsState.ownPending.set('b', { price: 8n, at: Date.now() });
    env.walletAssetsState.ownPending.set('c', { price: null, at: Date.now() - 121_000 });
    expect(applied(listings)).toEqual([{ sale: 'b', price: 8n }, { sale: 'c', price: 9n }]);
    expect(env.walletAssetsState.ownPending.has('c'), 'forgotten once stale').toBe(false);
    for (const start of ['async function openNftRepriceDialog(listing, hold) {', 'async function openNftCancelDialog(listing, hold) {']) {
      expect(block(start)).toContain("if (error?.code === 'NFT_SALE_GONE') walletNftOwnListingMoved(listing.sale);");
    }
    const reprice = block('async function openNftRepriceDialog(listing, hold) {');
    before(reprice, 'sentPrice = asked.price;', "outcome = t('nft.changePriceSubmitted');");
    expect(reprice).toContain('walletNftOwnListingRepriced(listing, sentPrice);');
    expect(reprice).toContain("hint: t('nft.changePriceHint', { amount: gram(NFT_CHANGE_PRICE_VALUE) }),");
    expect(block('async function openNftCancelDialog(listing, hold) {')).toContain("hint: t('nft.cancelHint', { amount: gram(NFT_CANCEL_VALUE) }),");
    expect(block('function walletNftOwnListingRepriced(listing, price) {')).toContain("walletNftTakeListing({ ...listing, price, dataHash: '' });");
    const art = block('async function walletNftReadAthArt() {');
    expect(art).toContain('if ((walletAssetsState.nftListings ?? []).some((one) => batch.includes(one.nft))) walletAssetsState.onSaleArtLanded = true;');
    expect(art, 'once, when the run of batches ends [round 97 — C10-3]').toContain('if (walletAssetsState.onSaleArtLanded && !walletNftMarket.athQueue.size) {');
    expect(art).toContain('for (const one of walletAssetsState.nfts ?? walletAssetsState.stored?.nft ?? []) {');
    expect(art).toContain("if (typeof art === 'string' && art) { one.picture = art; walletAssetsState.onSaleArtLanded = true; }");
  });

  it('NFTSELLUI-09: what no transfer can move is not offered — soulbound, or on its own sale; a worn gift goes off whatever proved it [rounds 94–96]', () => {
    before(block('function walletCardNftActions(item) {'), "if (!nftCollectionTransferable(item.collection)) return walletCardStat(t('wallet.actionSend'), t('nft.notTransferable'));", 'const send = walletCardSend(');
    expect(app).toContain('const offered = (one) => !hiddenNow.has(one.address) && !one.onSale && nftCollectionTransferable(one.collection);');
    expect(app).toContain('if (own && !walletNftOnOwnSale(gift.itemAddress)) {');
    expect(block('function telegramGiftLeftWallet(itemAddress, walletAddress) {')).toContain('if (walletNftWornNow(itemAddress)) unwearTelegramGift();');
    expect(block('function walletNftWornNow(itemAddress) {')).toContain("try { return parseTonAddress(String(address ?? '')).raw; } catch { return ''; }");
    before(block('async function openWalletNftTransferDialog(item, hold) {'), 'await sendWalletAssetMessage(signer, { address: item.address, value, body });',
      'if (walletNftWornNow(item.address)) telegramGiftLeftWallet(item.address, signer.address);');
    expect(block('async function openNftSellDialog(item, hold) {')).toContain('|| walletNftWornNow(item.address);');
  });

  it('NFTSELLUI-10: History draws a trade row by its collection\'s verdict — named when vouched, marked and nameless when not, nameless while judged [rounds 99–100]', () => {
    const node = (): any => ({ className: '', textContent: '', children: [] as any[], append(...more: any[]) { this.children.push(...more); },
      replaceChildren(...more: any[]) { this.children = [...more]; }, addEventListener() {} });
    const panel = node();
    const judgedAsked: string[][] = [];
    const verdicts: Record<string, string | null> = { G: 'yes', X: 'no', U: null };
    const draw = new Function('document', 'walletAssetsState', 't', 'formatUnits', 'walletAssetRow', 'walletNftCollectionVerified', 'walletHistoryJudge',
      'walletAssetsReading', 'walletAssetsNote', 'historyRowsOf', `${sourceBlock(app, 'function walletHistoryUnit(symbol, master) {')}
${sourceBlock(app, 'function renderWalletHistory(panel) {')}\nreturn renderWalletHistory;`)(
      { createElement: node, documentElement: { lang: 'en' } },
      { history: [
        { trade: 'sold', collection: 'G', nftName: 'Plush Pepe #1', amount: '28800000000', at: 0, success: true, direction: 'out' },
        { trade: 'sold', collection: 'X', nftName: 'Claim 5000 USDT at example', amount: '929000', at: 0, success: true, direction: 'out' },
        { trade: 'listed', collection: 'U', nftName: 'Gift #2', amount: '25000000000', at: 0, success: true, direction: 'out' },
      ], historyMore: false },
      (key: string) => key, (value: string) => String(value), (opts: any) => opts, (collection: string) => (collection in verdicts ? verdicts[collection] : 'no'),
      (collections: string[]) => judgedAsked.push(collections), () => false, () => {}, historyRowsOf);
    draw(panel);
    const subs = panel.children[0].children.map((row: any) => row.subtitle);
    expect(subs[0], 'one\'s own gift, vouched by its collection: named').toContain('Plush Pepe #1');
    expect(subs[0]).not.toContain('wallet.tokenUnverified');
    expect(subs[1], 'a stranger\'s sale: marked, its words left out').toContain('wallet.tokenUnverified');
    expect(subs[1]).not.toContain('Claim');
    expect(subs[2], 'not judged yet: no name until it is').not.toContain('Gift #2');
    expect(judgedAsked).toEqual([['U']]);
    const history = block('function renderWalletHistory(panel) {');
    expect(history).toContain("const nftJudged = row.kind === 'nft' ? walletNftCollectionVerified(row.collection) : null;");
    expect(block('function walletHistoryJudge(collections) {')).toContain('void walletNftVerifyCollections(fresh).then((unanswered) => unanswered ?? [], () => fresh).then((again) => {');
    expect(block('function walletHistoryJudge(collections) {')).toContain('for (const one of again) if (walletNftCollectionVerified(one) === null) asked.delete(one);');
    expect(block('async function walletNftVerifyCollections(collections) {')).toContain('if (row && isUnknownAccountState(row)) { unanswered.push(collection); continue; }');
    expect(block('function walletHistoryJudge(collections) {')).toContain('refreshWalletIncomingBadges();');
    expect(block('function refreshWalletIncomingBadges() {')).toContain('if (unjudged.size) walletHistoryJudge([...unjudged]);');
  });

  it('NFTSELLUI-11: History draws a swap failed only as the chain says — one whose output the DEX paid to another account (an aggregator) went through; "+" only for what came [client audit round 137 — C1-1]', () => {
    const node = (): any => ({ className: '', textContent: '', children: [] as any[], append(...more: any[]) { this.children.push(...more); },
      replaceChildren(...more: any[]) { this.children = [...more]; }, addEventListener() {} });
    const panel = node();
    const swap = (success: boolean, got: string) => ({ kind: 'swap', direction: 'out', success, at: 0, amount: '925271', decimals: 6, symbol: 'USD₮',
      got: { amount: got, decimals: 9, symbol: 'GRAM' } });
    // eslint-disable-next-line no-new-func
    const draw = new Function('document', 'walletAssetsState', 't', 'formatUnits', 'walletAssetRow', 'walletNftCollectionVerified', 'walletHistoryJudge',
      'walletAssetsReading', 'walletAssetsNote', 'historyRowsOf', `${sourceBlock(app, 'function walletHistoryUnit(symbol, master) {')}
${sourceBlock(app, 'function renderWalletHistory(panel) {')}\nreturn renderWalletHistory;`)(
      { createElement: node, documentElement: { lang: 'en' } },
      { history: [swap(true, '0'), swap(false, '0'), swap(true, '836000000')], historyMore: false },
      (key: string) => key, (value: string) => String(value), (opts: any) => opts, () => 'yes', () => {}, () => false, () => {}, historyRowsOf);
    draw(panel);
    const [paidElsewhere, refused, came] = panel.children[0].children;
    expect([paidElsewhere.subtitle.includes('wallet.historyFailed'), paidElsewhere.className.includes('is-failed'), paidElsewhere.amount], 'went through, paid elsewhere')
      .toEqual([false, false, '']);
    expect([refused.subtitle.includes('wallet.historyFailed'), refused.className.includes('is-failed')], 'did not go through').toEqual([true, true]);
    expect([came.className.includes('is-failed'), came.amount], 'what came').toEqual([false, '+836000000 GRAM']);
    const panel2 = node();
    // eslint-disable-next-line no-new-func
    new Function('document', 'walletAssetsState', 't', 'formatUnits', 'walletAssetRow', 'walletNftCollectionVerified', 'walletHistoryJudge',
      'walletAssetsReading', 'walletAssetsNote', 'historyRowsOf', `${sourceBlock(app, 'function walletHistoryUnit(symbol, master) {')}
${sourceBlock(app, 'function renderWalletHistory(panel) {')}\nreturn renderWalletHistory;`)(
      { createElement: node, documentElement: { lang: 'en' } },
      { history: [{ ...swap(false, '26000000000'), symbol: 'GRAM', decimals: 9, wanted: { symbol: 'USD₮', decimals: 6 } }], historyMore: false },
      (key: string, params: any) => (params ? `${key}:${params.from}>${params.to}` : key), (value: string) => String(value), (opts: any) => opts, () => 'yes',
      () => {}, () => false, () => {}, historyRowsOf)(panel2);
    const [refundRow] = panel2.children[0].children;
    expect([refundRow.title, refundRow.amount]).toEqual(['wallet.historySwap:GRAM>USD₮', '+26000000000 GRAM']);
  });

  it('NFTSELLUI-06: an NFT sent tops its item up to the reserve it keeps, read fresh at the press [client audit round 92 — C10-1]', () => {
    const send = block('async function openWalletNftTransferDialog(item, hold) {');
    before(send, 'const owner = await readNftOwner(', 'const value = NFT_TRANSFER_VALUE_NANOTONS + await walletNftTopUp(item, pressReadOptions(criticalChainReadOptions()));');
    before(send, 'const value = NFT_TRANSFER_VALUE_NANOTONS + await walletNftTopUp(item, pressReadOptions(criticalChainReadOptions()));', 'await sendWalletAssetMessage(signer, { address: item.address, value, body });');
    const topUp = block('async function walletNftTopUp(item, callOptions = {}) {');
    expect(topUp).toContain('if (!nftItemKeepsReserve(item.collection)) return 0n;');
    expect(topUp).toContain('getAccountBalance(item.address, { skipIfRateLimited: false, cacheTtlMs: 0, ...callOptions })');
  });

  it('NFTSELLUI-03: a new price and a take-down go only to a sale read now as live and this wallet\'s, from the wallet that pressed', () => {
    const own = block('async function walletNftOwnSaleNow(listing, signer) {');
    expect(own).toContain("if (!fresh?.live) throw Object.assign(new Error('the sale is gone'), { code: 'NFT_SALE_GONE' });");
    expect(own).toContain("if (!sameWalletAddress(fresh.seller, signer.address)) throw");
    for (const [start, send] of [
      ['async function openNftRepriceDialog(listing, hold) {', 'await sendWalletAssetMessage(signer, { address: fresh.sale, value: NFT_CHANGE_PRICE_VALUE, body: nftChangePriceBody(nextTransferQueryId(), asked.price) });'],
      ['async function openNftCancelDialog(listing, hold) {', 'await sendWalletAssetMessage(signer, { address: fresh.sale, value: NFT_CANCEL_VALUE, body: nftCancelBody(nextTransferQueryId()) });'],
    ]) {
      const dialog = block(start);
      before(dialog, 'await spendPasswordRefusal(submitted)', 'const fresh = await walletNftOwnSaleNow(listing, signer);');
      before(dialog, 'const fresh = await walletNftOwnSaleNow(listing, signer);', send);
    }
  });

  it('NFTSELLUI-04: one\'s own listing is priced again or taken down, anyone else\'s bought — each window one transfer at a time per wallet', () => {
    const card = block('function openWalletNftListing(listing, { back = null } = {}) {');
    expect(card).toContain('openNftRepriceDialog(listing, hold)');
    expect(card).toContain('openNftCancelDialog(listing, hold)');
    expect(card).toContain('openNftBuyDialog(listing, hold)');
    const run = block('async function runWalletNftAction(open) {');
    expect(run).toContain('if (!pressedBy || walletTransferOnItsWay(pressedBy)) return;');
    expect(run).toContain('walletTonTransfersBusy.add(pressedBy);');
    expect(run).toContain('walletTonTransfersBusy.delete(pressedBy);');
  });

  it('NFTSELLUI-05: the wallet\'s own listings are read beside its NFTs, for this wallet only, and drawn first under "On sale"', () => {
    expect(app).toMatch(/const readListings = \(tries\) => readListingsOf\(\{ fetchImpl: createToncenterRestFetch\(\{ requestOptions: \{ priority: 'focus', skipIfRateLimited: false, rateLimitRetries: 1 \} \}\),\s*origin: toncenterRestOrigin\(\), owner \}\)/);
    expect(app).toMatch(/await walletNftVerifyCollections\(listings\.map\(\(one\) => one\.collection\)\)\.catch\(\(\) => \{\}\);\s*if \(!current\(\)\) return;/);
    expect(app).toContain('const current = () => owner === state.owner && run === state.listingsRun;');
    expect(app).toMatch(/state\.nftListings = walletNftOwnPendingApplied\(listings\.filter\(\(one\) => walletNftCollectionVerified\(one\.collection\) === 'yes'\)\);/);
    expect(app).toContain("if (tries > 1 && listings.some((one) => walletNftCollectionVerified(one.collection) === null)) throw new Error('a listing\\'s collection is not judged yet');");
    const history = block('function renderWalletHistory(panel) {');
    expect(history).toContain('const judged = walletNftCollectionVerified(row.collection);');
    expect(history).toContain("const unverified = judged === 'no' ? t('wallet.tokenUnverified') : '';");
    expect(history).toContain("const sub = [unverified, judged === 'yes' ? row.nftName : '',");
    expect(history).toContain('walletHistoryJudge([...unjudged]);');
    expect(block('function walletHistoryJudge(collections) {')).toContain('for (const one of fresh) asked.add(one);');
    expect(block('function renderWalletNfts(panel) {')).toContain("panel.querySelectorAll('.wallet-assets-apart .wallet-nft-card')[shown]?.focus();");
    expect(app).toContain('if (tries > 1) { setTimeout(() => { if (current()) void readListings(tries - 1); }, 5_000); return; }');
    expect(app).toContain('void readListings(3);');
    expect(block('function renderWalletNfts(panel) {')).toContain("walletAssetsState.nftListings === null ? 'wallet.assetsLoading' : 'wallet.nftEmpty'");
    expect(app, 'a cut list of listings is said as the NFT list\'s cut is [rounds 96–97 — C10-1, C10-4]').toContain('if (listings?.capped) state.cutNfts = Math.max(state.cutNfts, Number(listings.capped));');
    expect(block('function renderWalletNfts(panel) {')).toContain('onSale.slice(0, shown).map((listing) => walletNftCard(listing, { own: true })), more);');
    const render = block('function renderWalletNfts(panel) {');
    before(render, "appendWalletFold(panel, 'nft-on-sale'", "grid.className = 'wallet-nft-grid';");
    expect(app).toMatch(/Object\.assign\(walletAssetsState, \{ owner, tokens: null, nfts: null, nftListings: null,/);
  });
});

describe('the market windows say the price and what the balance must hold', () => {
  it('NFTSELLUI-SUMMARY-01: no window lists what is sent and what comes back — the balance line says the rest comes back [2026-11-08]', () => {
    for (const start of ['async function openNftBuyDialog(listing, hold) {', 'async function openNftSellDialog(item, hold) {',
      'async function openNftRepriceDialog(listing, hold) {', 'async function openNftCancelDialog(listing, hold) {']) {
      const window = block(start);
      expect(window, start).not.toContain("t('nft.youSend')");
      expect(window, start).not.toContain("t('nft.comesBack')");
      expect(window, start).toContain("{ label: t('common.balanceNeeded'), value: balanceNeededText(");
    }
    const buy = block('async function openNftBuyDialog(listing, hold) {');
    const rows = buy.slice(buy.indexOf('summary: () => ['), buy.indexOf('validateSubmit:'));
    expect(rows.match(/\{ label: t\('[^']+'\)/g), 'the buy window: the price, then the balance')
      .toEqual(["{ label: t('nft.price')", "{ label: t('common.balanceNeeded')"]);
    expect(rows).toContain('balanceNeededText(value + walletSendFeeReserveNanotons())');
    const strings = readFileSync('web/i18n-strings.mjs', 'utf8');
    expect(strings, 'the two words went with their rows').not.toContain('"nft.youSend"');
    expect(strings).not.toContain('"nft.comesBack"');
  });
});
