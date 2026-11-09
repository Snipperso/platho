import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';


const app = readFileSync('web/app.js', 'utf8');
const css = readFileSync('web/styles.css', 'utf8');
const block = (start: string) => code(sourceBlock(app, start));

describe('the NFT half of the Market', () => {
  it('NFTUI-01: the pressed half of the switch is written in ink ON the accent [C7-1, C5-2: 1:1 in the dark theme]; on a desktop the collections and the one picked, side by side, GRAM\'s price at the head of both halves', () => {
    expect(css).toMatch(/\.wallet-market-mode\[aria-pressed="true"\] \{ background: var\(--accent\); color: var\(--on-accent\); \}/);
    expect(css).not.toMatch(/\.wallet-market-mode\[aria-pressed="true"\][^}]*--accent-ink/);
    expect(css, 'the tokens\' two columns are the NFT half\'s too').not.toContain('.wallet-nft-market { grid-template-columns');
    const render = block('function renderWalletNftMarket(panel) {');
    expect(render).toContain('box.append(head, side, detail);');
    expect(render).toContain('side.append(search, picker, pickerNote);');
    expect(render).toContain("detail.className = 'wallet-market-detail wallet-nft-detail profile-stat-list';");
    expect(render, 'GRAM in dollars at the NFT half\'s head too [2026-10-30]').toContain('head.append(walletMarketModeSwitch(), walletMarketGramBox(), live);');
    expect(block('function renderWalletMarket(panel) {')).toContain('head.append(walletMarketModeSwitch(), walletMarketGramBox(), live);');
    expect(block('function walletMarketPaint() {')).toContain("const nftGram = walletNftMarket.box?.querySelector('.wallet-market-gram-usd');");
    for (const start of ['function walletMarketFit() {', 'function walletMarketWheel(event) {']) {
      expect(block(start)).toContain("const box = walletNftMarket.mode === 'nft' ? walletNftMarket.box : walletMarket.box;");
    }
    expect(render, 'a window turned into the other layout is drawn again').toMatch(/if \(walletNftMarket\.drawnDesktop !== isDesktopLayout\(\)\) \{[\s\S]*?renderWalletNftMarket\(panel\);[\s\S]*?return;\s+\}/);
  });

  it('NFTUI-02: the cards stay while a view reads, kept by their sale, and the focus stands on its card — or the one now in its place [round 84 — C7-1]; "Show more" never said unavailable [round 84 — C7-2]', () => {
    const paint = block('function walletNftViewPaint() {');
    expect(paint).toContain("const focused = focusedAt >= 0 ? document.activeElement.dataset.sale : '';");
    expect(paint).toContain('cards.children[Math.min(focusedAt, cards.children.length - 1)]');
    expect(paint).toContain("moreCards.setAttribute('aria-busy', String(reading && listings.length <= shown.length));");
    expect(paint).not.toContain('aria-disabled');
    const card = block('function walletNftCard(listing, { withCollection = false, own = false } = {}) {');
    expect(card).toMatch(/if \(held && held\.price === listing\.price\) \{[\s\S]*?held\.listing = listing;\s+return held\.card;/);
    expect(card).toContain('card.dataset.sale = listing.sale;');
    expect(css).toContain('.wallet-nft-cards[hidden] { display: none; }');
    const picker = block('function walletNftPickerPaint() {');
    expect(picker).toContain('picker.querySelector(`[data-collection="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });');
  });

  it('NFTUI-03: every collection\'s newest is read as one collection is — the head at once, older pages behind it while All collections is the view, the head again each beat — so the collections\' list fills by itself [2026-10-30: drawn from the newest page alone it held 30 collections and never grew]', () => {
    expect(app, 'the feed\'s own reader is gone').not.toContain('async function walletNftMarketRead(');
    expect(app).toContain("const NFT_ALL = '';");
    const read = block('async function walletNftCollectionRead(entry, { deeper = false, priority = \'focus\', forList = false, pressed = false } = {}) {');
    expect(read).toContain('collection: entry.collection || null,');
    expect(read).toContain('const open = () => (entry.collection === NFT_ALL && !deeper ? walletNftMarketSeen() && Boolean(walletNftMarket.box?.isConnected)');
    expect(read.indexOf('walletNftMarketPaint();'), 'what is known verified drawn before a new collection\'s check [round 82 — C5]').toBeLessThan(read.indexOf('await walletNftVerifyCollections(read.listings.map((listing) => listing.collection)).catch(() => {});'));
    expect(read).toContain("const pulse = entry.collection === NFT_ALL && head ? walletNftMarket.box?.querySelector('.wallet-market-live') : null;");
    expect(block('function renderWalletNftMarket(panel) {')).toContain('walletNftViewStart(NFT_ALL);');
    expect(block('function walletNftViewStart(key) {')).not.toContain('if (!key) return;');
    const tick = block('function walletMarketTick() {');
    expect(tick).toMatch(/if \(walletNftMarket\.mode === 'nft' && walletNftMarket\.box\?\.isConnected\) \{\s+void walletNftCollectionRead\(walletNftCollection\(NFT_ALL\)\);/);
    expect(tick).toContain('if (open !== NFT_ALL) { void walletNftCollectionRead(walletNftCollection(open)); walletNftLookupAgain(open); }');
    expect(block('function walletNftPickerEntries() {')).toContain('for (const listing of walletNftCollection(NFT_ALL).listings.values()) {');
    expect(block('function walletNftPickerPaint() {')).toContain('rows.push(...entries.slice(0, NFT_PICKER_ROWS).map(walletNftPickerRow));');
    expect(app, 'no Show more under the list').not.toContain('function walletNftPickerMore(');
    expect(app).toContain('const NFT_PICKER_ROWS = 120;');
    expect(block('function walletNftVisibleFeed() {')).toContain('.sort((a, b) => (b.listedAt || 0) - (a.listedAt || 0));');
    expect(css, 'every view is read again each beat: the strip is never paused').not.toContain('is-paused');
  });

  it('NFTUI-06: a press of "Show more" during a read runs when it ends [round 83 — C5-2, C7-1]; past what is read it reads on, by the cursor, the head first after a while away [round 84 — C5-1]; a window\'s opener drawn anew gives the focus to its twin by key [round 83 — C7-2]', () => {
    const collection = block('async function walletNftCollectionRead(entry, { deeper = false, priority = \'focus\', forList = false, pressed = false } = {}) {');
    expect(collection).toMatch(/if \(entry\.reading\) \{[\s\S]*?if \(pressed\) \{\s+if \(entry\.turnGo\) entry\.turnGo\(\);\s+else entry\.moreWanted = true;/);
    expect(collection).toContain("void walletNftCollectionRead(entry, { deeper: true, priority: pressed || walletNftListInFront(entry) ? 'focus' : 'background', pressed });");
    expect(block('function walletNftShowMore() {')).toContain('void walletNftCollectionRead(walletNftCollection(parts.key), { deeper: true, pressed: true });');
    const focus = block('function restoreDialogFocus(target) {');
    expect(focus).toContain('.wallet-nft-cards [data-sale="${CSS.escape(target.dataset.sale)}"]');
    expect(focus).toContain('.wallet-nft-picker [data-collection="${CSS.escape(target.dataset.collection)}"]');
  });

  it('NFTUI-07: a collection\'s own pages — the head again takes the live and drops the sold, a head past what a collection holds has the listings between read first (every collection\'s starts over), the older pages follow while it is open, to its first listing, by the cursor [2026-11-04]', () => {
    const read = block('async function walletNftCollectionRead(entry, { deeper = false, priority = \'focus\', forList = false, pressed = false } = {}) {');
    expect(read, 'a head read once pages are held is short').toContain('limit: head && entry.pages ? NFT_HEAD_PAGE : NFT_COLLECTION_PAGE,');
    expect(app).toContain('const NFT_HEAD_PAGE = 20;');
    expect(read).toContain('endLt: deeper ? entry.cursor : catchUp ? catchUp.cursor : null');
    expect(read, '...the listings between before any older page').toContain('const catchUp = deeper && entry.catchUp ? entry.catchUp : null;');
    expect(read).toContain('} else entry.catchUp = { cursor: read.cursor, until: entry.catchUp?.until ?? entry.newestAt };');
    expect(read, 'down to what was held, then done').toContain('} else if (catchUp) entry.catchUp = read.more && read.cursor && read.oldestAt > catchUp.until ? { ...catchUp, cursor: read.cursor } : null;');
    expect(read).toMatch(/if \(deeper && \(!entry\.cursor \|\| Date\.now\(\) - entry\.at > 2 \* WALLET_MARKET_REFRESH_MS \|\| Date\.now\(\) - entry\.headAt > WALLET_MARKET_REFRESH_MS\)\) \{\s+if \(pressed\) entry\.moreWanted = true;\s+deeper = false;/);
    expect(read, 'a sale gone leaves every read of it [round 87 — C5-4]').toContain('for (const sale of read.sales) if (!live.has(sale)) for (const one of walletNftMarket.collections.values()) one.listings.delete(sale);');
    expect(read, 'every collection\'s pages join their collection\'s').toContain('if (entry.collection === NFT_ALL) walletNftMarket.collections.get(listing.collection)?.listings.set(listing.sale, shown);');
    expect(block('function walletNftCollection(collection) {'), 'seeded with what every collection\'s pages hold of it').toContain('if (listing.collection === collection) entry.listings.set(listing.sale, listing);');
    expect(read).toMatch(/if \(head && entry\.at && read\.more && read\.oldestAt > entry\.newestAt\) \{\s+if \(entry\.collection === NFT_ALL\) \{\s+entry\.listings\.clear\(\);/);
    expect(read).toContain("void walletNftCollectionRead(entry, { deeper: true, priority: pressed || walletNftListInFront(entry) ? 'focus' : 'background', pressed });");
    expect(block('function walletNftReadsOn(entry) {'), 'a collection to its first listing; every collection\'s, and Telegram\'s usernames and numbers and TON\'s domains, to ten pages [2026-11-04]')
      .toContain('return (entry.collection !== NFT_ALL && !NFT_PINNED_COLLECTIONS.includes(entry.collection)) || entry.pages < NFT_COLLECTION_DEEP_PAGES;');
    const view = block('function walletNftViewPaint() {');
    expect(view).toContain('const freshOnly = Boolean(key) && hasMore && !walletNftReadsOn(entry) && NFT_PINNED_COLLECTIONS.includes(key);');
    expect(view).toContain(": freshOnly && listings.length ? t('nft.freshOnly')");
    expect(read, 'its reads let go as the view closes: no failure said').toContain("entry.failed = error?.code !== 'NOT_WANTED';");
    expect(read).toContain(': walletNftViewOpen(entry.collection));');
    expect(block('function walletNftViewOpen(key) {'), 'only while seen [round 85 — C5-5]').toContain('return walletNftMarketSeen() && parts?.key === key && Boolean(parts.grid?.isConnected);');
    expect(block('function walletNftMarketSeen() {'), 'the Market\'s tab too [round 86 — C5-1]').toContain("return pageOnScreen() && isVaultViewActive() && walletAssetsState.tab === 'market';");
    const front = block('function walletNftListInFront(entry) {');
    expect(front, 'a collection open is the screen; on a phone the view is its own window').toContain('if (entry.collection !== NFT_ALL || !walletNftMarket.drawnDesktop) return true;');
    expect(front, 'All collections behind a window on a desktop at background [round 86 — C5-3]').toContain('return !modalOnScreen();');
    expect(block('function walletNftViewListings(key) {')).toContain("listings.sort((a, b) => (a.price < b.price ? -1 : a.price > b.price ? 1 : newer(a, b)))");
    expect(block('function walletNftViewPaint() {')).toContain("pair(t('nft.listedCount'), `${listings.length}${hasMore ? '+' : ''}`)");
    const entries = block('function walletNftPickerEntries() {');
    expect((entries.match(/walletNftCollectionVerified\(([^)]+)\) !== 'yes'( \|\| !walletNftListingOn\(listing\))?\) continue;/g) ?? []).length).toBe(2);
    expect(entries).toContain("if (walletNftCollectionVerified(listing.collection) !== 'yes' || !walletNftListingOn(listing)) continue;");
    expect(entries).toContain('if (!walletNftListingOn(listing)) continue;\n      entry.count += 1;');
    expect(entries).not.toContain('entry.count = read.listings.size;');
    expect(block('async function walletNftFindByAddress() {')).toContain('await walletNftVerifyCollections([raw]);');
  });

  it('NFTUI-04: the card and the buy window say every place signed [C1-1]; a listing refused as gone leaves every view, one changed takes its fresh figures [C1-4, C7-9]', () => {
    expect(block('function nftGram(units) {')).toContain('return `${formatUnits(String(units), 9, { shown: 9 })} GRAM`;');
    for (const start of ['function openWalletNftListing(listing, { back = null } = {}) {', 'async function openNftBuyDialog(listing, hold) {', 'async function openNftSellDialog(item, hold) {',
      'async function openNftRepriceDialog(listing, hold) {', 'async function openNftCancelDialog(listing, hold) {', 'function walletNftSplitRows(price, terms) {',
      'async function openNftBidDialog(listing, hold) {']) expect(block(start), start).toContain('const gram = nftGram;');
    expect(app).not.toMatch(/const gram = \(units\) => `\$\{formatUnits\(String\(units\), 9/);
    const refused = block('function walletNftPressRefusal(listing, error, signing) {');
    expect(refused).toContain("if (error?.code === 'NFT_SALE_GONE' || error?.code === 'NFT_SALE_ENDED') walletNftForgetListing(listing.sale);");
    expect(refused, 'an ended sale says so [round 118 — C7-3]').toContain("error?.code === 'NFT_SALE_ENDED' ? t('nft.saleEnded')");
    expect(refused, 'an auction within the margin of its end has not ended: it stays [round 117 — C1-2]').not.toMatch(/NFT_AUCTION_ENDED'\) walletNftForgetListing/);
    expect(refused).toContain("else if ((error?.code === 'NFT_SALE_CHANGED' || error?.code === 'NFT_BID_LOW' || error?.code === 'NFT_BID_IS_BUY_NOW') && error.fresh?.live) {");
    expect(block('async function openNftBuyDialog(listing, hold) {')).toContain('return { ok: false, error: walletNftPressRefusal(listing, error, signing) };');
    expect(block('async function openNftBidDialog(listing, hold) {')).toContain('return { ok: false, error: walletNftPressRefusal(listing, error, signing), repaint: Boolean(error?.fresh?.live || fresh?.live) };');
    const card = block('function openWalletNftListing(listing, { back = null } = {}) {');
    expect(card).toContain("copied: 'nft.collectionCopied'");
    expect(card).toContain("hero: walletNftHero({ pictures: [...walletNftAthArtOf(listing), ...walletNftPictures(gift, listing.pictureBig, listing.picture), ...walletNftSamePicture(listing)],");
    expect(card).toContain('const gift = walletNftGiftOf(listing.collection, listing.uri);');
    expect(card).toContain('...walletNftTraitRows(listing.attributes),');
    expect(card).toContain("openWalletGroup('token', { title, back });");
    const forget = block('function walletNftForgetListing(sale, { paint = true } = {}) {');
    expect(forget).toContain('for (const entry of walletNftMarket.collections.values()) entry.listings.delete(sale);');
  });

  it('NFTUI-08: an NFT shown whole — a gift\'s animation only from a collection proven a gift\'s by its code, played only while its card is in front, stopped by every way the card goes, kept over a refill', () => {
    expect(block('function walletNftGiftOf(collection, uri) {')).toContain("if (!collection || walletNftMarket.giftVerdicts.get(collection) !== 'yes') return null;");
    expect(app, 'and only while its hero is in view [round 85 — C5-4]').toContain('[walletNftHeroMotion, () => modalInFront() === walletGroupDialog && walletNftHeroMotion?.inView !== false]');
    expect(block('function playWalletNftHero(hero) {')).toContain('walletNftHeroMotion.inView = entries[entries.length - 1]?.isIntersecting !== false;');
    expect(block('function dropWalletNftHeroMotion() {')).toContain('walletNftHeroMotion?.seer?.disconnect();');
    expect(block('function closeWalletGroup() {')).toContain('stopWalletNftHero();');
    expect(block('function forgetWalletGroup() {')).toContain('stopWalletNftHero();');
    expect(block('function openWalletGroup(group, { title = t(\'wallet.groupSettings\'), back = false, also = [] } = {}) {')).toMatch(/if \(group !== 'token' && !also\.includes\('token'\)\) \{\s+stopWalletNftHero\(\);/);
    const fill = block('function fillWalletCard({ picture, letter, title, subtitle, stats, hero = null }) {');
    expect(fill).toContain('if (!kept) stopWalletNftHero();');
    expect(fill).toContain('if (hero && !kept) playWalletNftHero(hero);');
    expect(block('function stopWalletNftHero() {'), 'the boot empties the card before the motion\'s state exists').toContain('if (!globalThis.__plathoGiftRuntimeReady) return;');
    const held = block('function openWalletNftCard(item, { refill = false } = {}) {');
    expect(held).toContain("hero: walletNftHero({ pictures: item.verified ? walletNftPictures(gift, item.pictureBig, item.picture) : [], letter: item.name || '?', gift,");
    expect(held, 'an unverified item\'s domain is not drawn either').toContain("domain: item.verified ? walletNftFaceName(item) : '' }),");
    expect(held).toContain('...walletNftTraitRows(item.verified ? traits : []),');
    expect(css).toContain('.wallet-nft-hero { position: relative; width: min(100%, 340px); aspect-ratio: 1;');
  });

  it('NFTUI-09: on a phone a collection opens in the wallet\'s window and a listing over it, Back returning to the collection; Settings\' pages still go back to the menu', () => {
    expect(block('function walletNftPick(key) {')).toMatch(/if \(isDesktopLayout\(\)\) walletNftShow\(key\);\s+else openWalletNftCollection\(key\);/);
    expect(block('function walletNftCard(listing, { withCollection = false, own = false } = {}) {')).toContain('back: !walletNftMarket.drawnDesktop && from !== undefined ? () => openWalletNftCollection(from, keep) : null');
    expect(block('function openWalletGroup(group, { title = t(\'wallet.groupSettings\'), back = false, also = [] } = {}) {')).toContain("walletGroupBack = typeof back === 'function' ? back : null;");
    expect(app).toContain("document.querySelector('#walletGroupBackButton')?.addEventListener('click', () => (walletGroupBack ? walletGroupBack() : openWalletGroup('menu')));");
  });

  it('NFTUI-10: a picture toncenter keeps no copy of is a gift\'s own from Telegram\'s host, a collection\'s SVG gives way to one of its listings\' pictures, and a card drawn takes a picture a later read brings [2026-10-30: 3 of 144 Stellar Rockets drew their letter]', () => {
    expect(block('function walletNftPictures(gift, ...indexed) {')).toContain('...(gift ? telegramGiftImageSources({ slug: gift.slug, number: gift.number }) : [])');
    const first = block('function paintWalletAssetIconFirst(icon, pictures, { shared = false, standIn = [] } = {}) {');
    expect(first).toMatch(/for \(const picture of list\) \{\s+const url = await walletPicture\(picture, \{ shared \}\);\s+if \(icon\.walletPaint !== paint\) return;\s+if \(!url\) continue;/);
    expect(first, 'its collection\'s picture stands in, dimmed, only once none of its own draws [2026-11-04]').toContain('for (const [list, stand] of [[tried, false], [instead, true]]) {');
    expect(first).toContain("icon.classList.toggle('is-stand-in', stand);");
    expect(css).toContain('.wallet-nft-card-picture.is-stand-in,');
    expect(block('function walletNftStandIn(listing) {'), 'a name is drawn as itself').toContain('return walletNftFaceName(listing) ? [] : [listing?.collectionPicture].filter(Boolean);');
    const card = block('function walletNftCard(listing, { withCollection = false, own = false } = {}) {');
    expect(card).toContain('const pictures = [...walletNftAthArtOf(listing), ...walletNftPictures(walletNftGiftOf(listing.collection, listing.uri), listing.picture), ...walletNftSamePicture(listing)];');
    expect(card).toContain("if (pictures.join(' ') !== held.pictures) { held.pictures = pictures.join(' '); paintWalletAssetIconFirst(held.icon, pictures, { shared: true, standIn: walletNftStandIn(listing) }); }");
    expect(card).toContain('paintWalletAssetIconFirst(icon, pictures, { shared: true, standIn: walletNftStandIn(listing) });');
    expect(block('async function walletNftReadRows() {')).toContain('void walletNftNameRows();');
    expect(block('function walletNftWatchRows(picker) {'), 'as the rows come into view, beside their reads').toContain('void walletNftNameRows();');
    expect(block('async function walletNftNameRows() {'), 'one call at a time').toContain('if (walletNftMarket.namesReading) return;');
    const named = block('async function walletNftNameRows() {');
    expect(named).toContain('const named = await readCollectionNames({ fetchImpl, origin: toncenterRestOrigin(), collections: keys });');
    expect(named, 'a failed call waits a beat').toContain('walletNftMarket.namesRetryAt = Date.now() + WALLET_MARKET_REFRESH_MS;');
    expect(named).toContain('.slice(0, 20);');
    const row = block('function walletNftPickerRow(entry) {');
    expect(row).toContain('const pictures = [entry.picture, entry.stand].filter(Boolean);');
    expect(block('function walletNftPickerEntries() {')).toContain('entry.stand ||= listing.picture;');
  });

  it('NFTUI-32: a turn between the phone\'s layout and the desktop\'s closes the phone\'s collection window, the pane taking its cards; a listing\'s Back fixed on the phone and pressed after the turn shows the pane, not a window [round 109 — C7-1]', () => {
    const market = block('function renderWalletNftMarket(panel) {');
    const turn = market.slice(market.indexOf('if (walletNftMarket.drawnDesktop !== isDesktopLayout()) {'));
    expect(turn).toContain("const inWindow = Boolean(walletGroupDialog && !walletGroupDialog.hidden && walletGroupDialog.classList.contains('is-nft-view'));");
    expect(turn.indexOf('renderWalletNftMarket(panel);'), 'the pane drawn first, then the window closed').toBeLessThan(turn.indexOf('if (inWindow) closeWalletGroup();'));
    const open = block('function openWalletNftCollection(key, keep = null) {');
    const desktop = open.slice(0, open.indexOf('walletNftMarket.view = key;'));
    expect(desktop).toMatch(/if \(walletNftMarket\.drawnDesktop\) \{\s+closeWalletGroup\(\);\s+walletNftShow\(key\);/);
    expect(desktop).toContain('if (keep && parts?.key === key && parts.grid?.isConnected) {');
    expect(desktop).toMatch(/parts\.shown = keep\.shown;\s+walletNftViewPaint\(\);/);
    expect(desktop).toMatch(/walletNftViewPaint\(\);[\s\S]*\?\.focus\(\);\s+\}\s+return;\s+\}\s*$/);
  });

  it('NFTUI-33: a beat\'s recheck takes every changed sale, then paints the market ONCE — the sold out of every view, the repriced at their price [round 109 — C5-1: a paint per changed sale froze a phone 6.1 s for 46]', async () => {
    const lift = (start: string) => sourceBlock(app, start);
    const sales = Array.from({ length: 60 }, (_, i) => `s${i}`);
    const listingOf = (sale: string) => ({ sale, collection: 'c', price: 100n, name: sale, picture: '', pictureBig: '', collectionName: 'C', listedAt: 1 });
    const collections = new Map([['', { collection: '', listings: new Map(sales.map((s) => [s, listingOf(s)])), sweptTo: 0 }],
      ['c', { collection: 'c', listings: new Map(sales.map((s) => [s, listingOf(s)])), sweptTo: 0 }]]);
    const market: any = { collections, parts: { key: 'c', shown: 40, grid: { isConnected: true } } };
    let paints = 0;
    let answer = new Map<string, any>();
    let during: null | (() => void) = null;
    // eslint-disable-next-line no-new-func
    const run = new Function('walletNftMarket', 'walletNftViewListings', 'readListingsChanged', 'toncenterRestOrigin', 'walletNftMarketPaint', 'NFT_SALES_MAX',
      `const walletNftWithOwnBid = (listing) => listing;\n${lift('function walletNftForgetListing(sale, { paint = true } = {}) {')}\n${lift('function walletNftTakeListing(read, { paint = true } = {}) {')}\n`
      + `${lift('function walletNftAsRead(listing) {')}\n${lift('function walletNftTakeItemLt(sale, itemLt) {')}\n`
      + `${lift('async function walletNftRecheckShown(entry, named, fetchImpl) {')}\nreturn { walletNftRecheckShown, walletNftForgetListing };`);
    const { walletNftRecheckShown, walletNftForgetListing } = run(market, (key: string) => [...collections.get(key)!.listings.values()],
      async () => { during?.(); return answer; }, () => 'origin', () => { paints += 1; }, 100);
    answer = new Map(sales.slice(0, 46).map((sale, i) => [sale, i % 2 ? { sale, price: 7n } : null]));
    await walletNftRecheckShown(collections.get('c'), [], null);
    expect(paints, '46 changed, one paint').toBe(1);
    for (const [i, sale] of sales.slice(0, 46).entries()) {
      for (const key of ['', 'c']) {
        const held = collections.get(key)!.listings.get(sale);
        if (i % 2) expect(held?.price).toBe(7n);
        else expect(held).toBeUndefined();
      }
    }
    answer = new Map();
    await walletNftRecheckShown(collections.get('c'), [], null);
    expect(paints, 'nothing changed, nothing painted').toBe(1);
    walletNftForgetListing('s59');
    expect(paints, 'one sale forgotten elsewhere (a Buy refused as gone) still paints at once').toBe(2);
    const marked = (sale: string, dataHash: string) => ({ ...listingOf(sale), dataHash, lastBid: 50n, ownBid: true });
    collections.get('c')!.listings.set('s50', marked('s50', 'dh'));
    collections.get('c')!.listings.set('s52', marked('s52', 'dh'));
    answer = new Map([['s50', { ...marked('s50', 'dh'), itemLt: '9' }], ['s52', { ...marked('s52', 'dh2'), lastBid: 60n }]]);
    await walletNftRecheckShown(collections.get('c'), [], null);
    expect(collections.get('c')!.listings.get('s50'), 'its NFT moved, its data as asked: as held').toMatchObject({ ownBid: true, lastBid: 50n, itemLt: '9' });
    expect(collections.get('c')!.listings.get('s52'), 'its data read again: the chain\'s').toMatchObject({ ownBid: false, lastBid: 60n });
    collections.get('c')!.listings.set('s54', marked('s54', 'dh'));
    during = () => collections.get('c')!.listings.set('s54', { ...listingOf('s54'), dataHash: '', lastBid: 10n, ownBid: false });
    answer = new Map([['s54', { ...marked('s54', 'dh'), itemLt: '11' }]]);
    await walletNftRecheckShown(collections.get('c'), [], null);
    during = null;
    expect(collections.get('c')!.listings.get('s54'), 'put back, its NFT\'s transaction taken').toMatchObject({ ownBid: false, lastBid: 10n, dataHash: '', itemLt: '11' });
  });

  it('NFTUI-34: a Buy press asks the collection for its item at the press\'s own class, not the profile\'s — elsewhere it stays the profile\'s [round 109 — C1-1: the press checked 31–62 s behind an open collection\'s pages]', async () => {
    const buy = block('async function walletNftPressChecks(listing, { buying }) {');
    expect(buy).toContain('const named = await verifyTelegramGiftMembershipOnChain(fresh.collection, fresh.index, { callOptions: pressReadOptions(criticalChainReadOptions()) });');
    expect(buy).toContain('const owner = await readNftOwner({ transport: globalThis.plathoTonRpcTransport, item: fresh.nft, callOptions: pressReadOptions(criticalChainReadOptions()) });');
    expect(app.match(/verifyTelegramGiftMembershipOnChain\(collection, index\)\)/g), 'the profile\'s proofs keep the profile\'s class').toHaveLength(2);
    const calls: any[] = [];
    const transport = { runGetMethod: async (call: any) => { calls.push(call); return { stack: [] }; } };
    // eslint-disable-next-line no-new-func
    const ask = new Function('telegramGiftMemberships', 'giftChainReadOptions', 'decodeNftAddressByIndexStack', 'decodeTonAddressSliceBoc', 'globalThis',
      `${sourceBlock(app, 'async function verifyTelegramGiftMembershipOnChain(collectionAddress, index, { callOptions = giftChainReadOptions() } = {}) {')}\nreturn verifyTelegramGiftMembershipOnChain;`)(
      new Map(), () => ({ priority: 'profile', cacheTtlMs: 1 }), () => 'item', () => '', { plathoTonRpcTransport: transport });
    await ask('c', 1n);
    await ask('c', 2n, { callOptions: { priority: 'critical', cacheTtlMs: 0 } });
    expect(calls.map((call) => call.priority)).toEqual(['profile', 'critical']);
  });

  it('NFTUI-35: a view draws four pages of cards at most — Show more gone at the last, the keyboard on the first card it added, the note saying how any other is found [round 110 — C5-1: 480 cards held a phone 1.15 s a paint]', () => {
    expect(app).toContain('const NFT_CARDS_MAX = 4 * NFT_CARDS_PAGE;');
    const focused: number[] = [];
    const grid = { children: Array.from({ length: 200 }, (_, i) => ({ focus: () => focused.push(i) })) };
    const more = { hidden: false };
    const parts: any = { key: 'c', shown: 40, grid, more };
    let paints = 0;
    let reads = 0;
    (more as any).matches = (selector: string) => selector === ':focus-visible';
    const doc = { activeElement: more as any };
    // eslint-disable-next-line no-new-func
    const showMore = new Function('walletNftMarket', 'walletNftViewListings', 'walletNftViewPaint', 'walletNftCollectionRead', 'walletNftCollection', 'document',
      'NFT_CARDS_PAGE', 'NFT_CARDS_MAX', `${sourceBlock(app, 'function walletNftShowMore() {')}\nreturn walletNftShowMore;`)(
      { parts }, () => Array.from({ length: 2000 }), () => { paints += 1; more.hidden = parts.shown >= 160; }, () => { reads += 1; }, () => ({}), doc, 40, 160);
    for (let press = 0; press < 30; press += 1) showMore();
    expect(parts.shown, 'never past the last page').toBe(160);
    expect(paints).toBe(3);
    expect(reads, 'no deeper read asked for a grid that is full').toBe(0);
    expect(focused, 'the first card the last page added').toEqual([120]);
    Object.assign(parts, { shown: 150 });
    more.hidden = false;
    showMore();
    expect(parts.shown, 'a page that would pass the last stops at it').toBe(160);
    Object.assign(parts, { shown: 120 });
    more.hidden = false;
    (more as any).matches = () => false;
    showMore();
    expect(focused, 'the press from 150 by keyboard went on from the card it added; a tap moves no focus').toEqual([120, 150]);
    const view = block('function walletNftViewPaint() {');
    expect(view).toContain('const capped = parts.shown >= NFT_CARDS_MAX && (listings.length > shown.length || hasMore);');
    expect(view).toContain('moreCards.hidden = capped || !(listings.length > shown.length || hasMore);');
    expect(view.indexOf(": capped ? t(key ? 'nft.cardsCapped' : 'nft.allCapped', { count: shown.length })"), 'said before the reading-on note it takes the place of')
      .toBeGreaterThan(view.indexOf(': searching ?'));
    expect(view.indexOf(": capped ? t(key ? 'nft.cardsCapped' : 'nft.allCapped'")).toBeLessThan(view.indexOf(': readingOn && listings.length ?'));
  });

  it('NFTUI-36: a view paint leaves the grid as it stands when its cards and their order are the same, and otherwise moves only what changed — the focused card kept in place [round 110 — C5-1: every paint put every card back, the whole grid laid out again]', () => {
    // eslint-disable-next-line no-new-func
    const { walletNftCardsDrawn, walletNftPutCards } = new Function(`${sourceBlock(app, 'function walletNftCardsDrawn(cards, want) {')}\n`
      + `${sourceBlock(app, 'function walletNftPutCards(cards, want) {')}\nreturn { walletNftCardsDrawn, walletNftPutCards };`)();
    let moves = 0;
    const grid: any = { children: [] as any[], insertBefore(node: any, ref: any) {
      const was = grid.children.indexOf(node);
      if (was >= 0) grid.children.splice(was, 1);
      grid.children.splice(ref ? grid.children.indexOf(ref) : grid.children.length, 0, node);
      moves += 1;
    } };
    const card = (id: string) => ({ id, remove() { grid.children.splice(grid.children.indexOf(this), 1); moves += 1; } });
    const [a, b, c, d, n] = ['a', 'b', 'c', 'd', 'n'].map(card);
    walletNftPutCards(grid, [a, b, c, d]);
    expect(grid.children.map((one: any) => one.id).join('')).toBe('abcd');
    expect(walletNftCardsDrawn(grid, [a, b, c, d]), 'the same: the paint touches nothing').toBe(true);
    expect(walletNftCardsDrawn(grid, [a, c, b, d])).toBe(false);
    expect(walletNftCardsDrawn(grid, [a, b, c])).toBe(false);
    moves = 0;
    walletNftPutCards(grid, [n, a, b, c, d]);
    expect([grid.children.map((one: any) => one.id).join(''), moves], 'a new one first: only it is put').toEqual(['nabcd', 1]);
    moves = 0;
    walletNftPutCards(grid, [n, a, c, d]);
    expect([grid.children.map((one: any) => one.id).join(''), moves], 'one sold: only it goes').toEqual(['nacd', 1]);
    moves = 0;
    walletNftPutCards(grid, [n, c, a, d]);
    expect(grid.children.map((one: any) => one.id).join(''), 'one repriced moves').toBe('ncad');
    expect(moves).toBe(1);
    const paint = block('function walletNftViewPaint() {');
    expect(paint).toMatch(/if \(!walletNftCardsDrawn\(cards, want\)\) \{[\s\S]*?const stood = scroller \? scroller\.scrollTop : 0;[\s\S]*?walletNftPutCards\(cards, want\);/);
    expect(paint, 'no card put back wholesale').not.toContain('cards.replaceChildren(');
    expect(paint, 'a card that kept the focus is not focused again: that call costs the layout').toContain('if (target && document.activeElement !== target) target.focus({ preventScroll: true });');
  });

  it('NFTUI-37: a Buy press proves its collection — verified as the market drew it, a gift (unlisted, its verdict a gift\'s) proven again on chain; a collection with any other verdict, the .ath registry\'s, is not sent to the gift check [round 111 — C1-1: no .ath name could be bought]', async () => {
    const buy = block('async function walletNftPressChecks(listing, { buying }) {');
    expect(buy).toContain('if (!(await walletNftBuyCollectionProven(fresh.collection))) {');
    expect(buy, 'one check, in one place').not.toContain('giftVerdicts');
    const chain: string[] = [];
    const run = (verified: string | null, listed: boolean, verdict: string | undefined, authentic = true) => {
      const verdicts = new Map(verdict === undefined ? [] : [['c', verdict]]);
      // eslint-disable-next-line no-new-func
      const proven = new Function('walletNftCollectionVerified', 'listedNftCollection', 'walletNftMarket', 'telegramGiftCollectionIsAuthentic', 'pressReadOptions', 'verifyTelegramGiftCollectionOnChain',
        `${sourceBlock(app, 'async function walletNftBuyCollectionProven(collection) {')}\nreturn walletNftBuyCollectionProven;`)(
        () => verified, () => listed, { giftVerdicts: verdicts }, () => authentic, (options: any) => options,
        async (collection: string, options: any) => { chain.push(`${collection}:${options.fresh}`); return {}; });
      return proven('c');
    };
    const cases: Array<[string | null, boolean, string | undefined, boolean, boolean, number, string]> = [
      ['no', false, 'no', true, false, 0, 'not verified'],
      [null, false, undefined, true, false, 0, 'not read yet'],
      ['yes', true, 'no', true, true, 0, 'an approved collection'],
      ['yes', true, 'yes', true, true, 0, 'an approved gift collection: the list proves it'],
      ['yes', false, 'no', true, true, 0, 'the .ath registry: verified, its verdict "no" — no gift check'],
      ['yes', false, undefined, true, true, 0, 'the .ath registry before its verdict'],
      ['yes', false, 'yes', true, true, 1, 'an unlisted gift: proven again on chain'],
      ['yes', false, 'yes', false, false, 1, 'an unlisted gift the chain no longer proves'],
    ];
    for (const [verified, listed, verdict, authentic, expected, reads, why] of cases) {
      chain.length = 0;
      expect(await run(verified, listed, verdict, authentic), why).toBe(expected);
      expect(chain, `${why}: chain reads`).toEqual(reads ? ['c:true'] : []);
    }
    const view = block('function walletNftViewPaint() {');
    expect(view.indexOf(": freshOnly && listings.length ? t('nft.freshOnly')"), 'the three largest say "the newest", before the cap [round 111 — C1-2]')
      .toBeLessThan(view.indexOf(": capped ? t(key ? 'nft.cardsCapped' : 'nft.allCapped'"));
  });

  it('NFTUI-40: the list\'s rows are named only while seen — a window over them stops it, as it stops their listings\' reads [round 118 — C5-1]', async () => {
    let covered = true;
    const asked: string[][] = [];
    const env: Record<string, any> = {
      walletNftMarket: { namesReading: false, namesAsked: new Set(), namesRetryAt: 0, picker: { isConnected: true }, rowsInView: new Set(['c1', 'c2']), collections: new Map() },
      walletNftMarketSeen: () => true, modalOnScreen: () => covered, walletNftCollection: () => ({ picture: '' }), WALLET_MARKET_REFRESH_MS: 30_000,
      createToncenterRestFetch: () => null, toncenterRestOrigin: () => 'https://o', walletNftPickerPaint: () => {},
      readCollectionNames: async ({ collections }: any) => { asked.push(collections); return new Map(); },
    };
    const names = Object.keys(env);
    // eslint-disable-next-line no-new-func
    const nameRows = new Function(...names, `${sourceBlock(app, 'async function walletNftNameRows() {')}\nreturn walletNftNameRows;`)(...names.map((n) => env[n]));
    await nameRows();
    expect(asked, 'covered: nothing asked').toEqual([]);
    covered = false;
    await nameRows();
    expect(asked).toEqual([['c1', 'c2']]);
    expect(block('async function walletNftReadRows() {')).toContain('if (!walletNftMarket.picker?.isConnected || !walletNftMarketSeen() || modalOnScreen()) break;');
  });

  it('NFTUI-39: a collection\'s page drawn stands when its verdicts\' read is refused — read, timed and read on; the page\'s own refusal still fails it [round 113 — C5-1]', async () => {
    const verdicts = { refuse: true, asked: 0 };
    const pages: Array<string | null> = [];
    const fetchOptions: any[] = [];
    const telemintReads: any[] = [];
    let refusePage = false;
    const env: Record<string, any> = {
      WALLET_MARKET_REFRESH_MS: 30_000, NFT_ALL: '', NFT_HEAD_PAGE: 20, NFT_COLLECTION_PAGE: 100, NFT_TURN_WAIT_MS: 1_000,
      walletNftMarket: { collections: new Map(), lookupDue: null }, walletNftViewPaint: () => {}, walletNftMarketPaint: () => {},
      walletNftMarketSeen: () => true, walletNftViewOpen: () => true, walletNftReadsOn: () => true, walletNftListInFront: () => true,
      createToncenterRestFetch: (options: any) => { fetchOptions.push(options.requestOptions); return null; }, toncenterRestOrigin: () => 'https://o',
      readLatestListings: async ({ endLt }: any) => {
        pages.push(endLt);
        if (refusePage) throw Object.assign(new Error('rate limited'), { code: 'RATE_LIMITED' });
        return endLt ? { more: false, oldestAt: 50, newestAt: 90, cursor: null, sales: [], listings: [] }
          : { more: true, oldestAt: 100, newestAt: 200, cursor: '41', sales: ['s1'], listings: [{ sale: 's1', collection: 'c', nft: 'n1' }] };
      },
      walletNftLearnPicture: () => {}, walletNftRecheckShown: async () => {}, walletNftTelemintRead: (one: any) => telemintReads.push(one), walletNftWithOwnBid: (listing: any) => listing,
      walletNftSetRead: (one: any, listing: any) => { one.listings.set(listing.sale, listing); return listing; },
      walletNftVerifyCollections: async () => { verdicts.asked += 1; if (verdicts.refuse) throw Object.assign(new Error('rate limited'), { code: 'RATE_LIMITED' }); return []; },
      isTonRpcRateLimitError: (error: any) => error?.code === 'RATE_LIMITED', console: { warn: () => {} },
    };
    const names = Object.keys(env);
    const start = 'async function walletNftCollectionRead(entry, { deeper = false, priority = \'focus\', forList = false, pressed = false } = {}) {';
    // eslint-disable-next-line no-new-func
    const read = new Function(...names, `${sourceBlock(app, 'async function walletNftTurn({ first = false, entry = null } = {}) {')}\n${sourceBlock(app, start)}\nreturn walletNftCollectionRead;`)(...names.map((n) => env[n]));
    const settle = async () => { for (let i = 0; i < 20; i += 1) await new Promise((done) => setTimeout(done, 0)); };
    const fresh = () => ({ collection: 'c', listings: new Map(), pages: 0, at: 0, headAt: 0, newestAt: 0, hasMore: false, reading: false, failed: false });
    const entry: any = fresh();
    await read(entry);
    expect([entry.failed, entry.at > 0, entry.listings.has('s1')], 'the page drawn stands, timed').toEqual([false, true, true]);
    await settle();
    expect(pages, 'the head, then the older page read on from its cursor').toEqual([null, '41']);
    expect([entry.pages, entry.hasMore, entry.failed]).toEqual([2, false, false]);
    expect(fetchOptions.map((one) => [one.skipIfRateLimited, one.rateLimitRetries])).toEqual([[undefined, undefined], [false, 1]]);
    expect(telemintReads, 'a Telemint collection\'s own sales asked beside the head alone, not awaited').toEqual([entry]);
    expect(verdicts.asked, 'each page asked its verdicts, each refusal let go').toBe(2);
    pages.length = 0;
    refusePage = true;
    const failed: any = fresh();
    await read(failed);
    await settle();
    expect([failed.pages, failed.failed, failed.at, pages], 'no page: failed').toEqual([0, true, 0, [null]]);
    expect(block(start)).toContain('await walletNftVerifyCollections(read.listings.map((listing) => listing.collection)).catch(() => {});');
  });

  it('NFTUI-41: the market\'s reads past the beat\'s heads take turns — a row\'s own first page waits for a view\'s older page in flight, and the next for it; a beat\'s head is not held; a refused read lets the next go [round 121 — C5-1]; a page pressed for is not held, and a holder that never settles holds the next no longer than the bound [round 124 — C5-3, C5-1]; a read going on that turned into a head goes on by the turn, a press\'s goes on pressed [round 125 — C5-1]', async () => {
    const calls: Array<{ collection: string, endLt: string | null, done: (value: any) => void, fail: (error: any) => void }> = [];
    const flags = { readsOn: false };
    const env: Record<string, any> = {
      WALLET_MARKET_REFRESH_MS: 30_000, NFT_ALL: '', NFT_HEAD_PAGE: 20, NFT_COLLECTION_PAGE: 100, NFT_TURN_WAIT_MS: 1_000,
      walletNftMarket: { collections: new Map(), lookupDue: null, turn: null, picker: { isConnected: true } }, walletNftViewPaint: () => {}, walletNftMarketPaint: () => {},
      walletNftMarketSeen: () => true, walletNftViewOpen: () => true, walletNftReadsOn: () => flags.readsOn, walletNftListInFront: () => true,
      createToncenterRestFetch: () => null, toncenterRestOrigin: () => 'https://o',
      readLatestListings: ({ collection, endLt }: any) => new Promise((done, fail) => { calls.push({ collection, endLt, done, fail }); }),
      walletNftLearnPicture: () => {}, walletNftRecheckShown: async () => {}, walletNftTelemintRead: () => {}, walletNftVerifyCollections: async () => [],
      isTonRpcRateLimitError: (error: any) => error?.code === 'RATE_LIMITED', console: { warn: () => {} },
    };
    const names = Object.keys(env);
    const start = 'async function walletNftCollectionRead(entry, { deeper = false, priority = \'focus\', forList = false, pressed = false } = {}) {';
    // eslint-disable-next-line no-new-func
    const read = new Function(...names, `${sourceBlock(app, 'async function walletNftTurn({ first = false, entry = null } = {}) {')}\n${sourceBlock(app, start)}\nreturn walletNftCollectionRead;`)(...names.map((n) => env[n]));
    const settle = async () => { for (let i = 0; i < 20; i += 1) await new Promise((done) => setTimeout(done, 0)); };
    const page = { more: false, oldestAt: 50, newestAt: 90, cursor: null, sales: [], listings: [] };
    const now = Date.now();
    const entry = (collection: string, held = false): any => ({ collection, listings: new Map(), pages: held ? 1 : 0, at: held ? now : 0, headAt: held ? now : 0,
      cursor: held ? '41' : null, newestAt: 0, hasMore: true, reading: false, failed: false });
    const view = entry('v', true);
    void read(view, { deeper: true });
    await settle();
    void read(entry('r1'), { forList: true });
    await settle();
    expect(calls.map((one) => [one.collection, one.endLt]), 'the row waits for the view\'s older page').toEqual([['v', '41']]);
    void read(entry('h'));
    await settle();
    expect(calls.map((one) => one.collection)).toEqual(['v', 'h']);
    calls[1].done(page);
    calls[0].done(page);
    await settle();
    expect(calls.map((one) => one.collection)).toEqual(['v', 'h', 'r1']);
    void read(entry('r2'), { forList: true });
    await settle();
    expect(calls.map((one) => one.collection), 'the next waits for the row in flight').toEqual(['v', 'h', 'r1']);
    calls[2].fail(Object.assign(new Error('rate limited'), { code: 'RATE_LIMITED' }));
    await settle();
    expect(calls.map((one) => one.collection)).toEqual(['v', 'h', 'r1', 'r2']);
    calls[3].done(page);
    await settle();
    void read(entry('v2', true), { deeper: true });
    await settle();
    expect(calls.map((one) => one.collection), 'all let go: the next goes at once').toEqual(['v', 'h', 'r1', 'r2', 'v2']);
    void read(entry('p', true), { deeper: true, pressed: true });
    await settle();
    expect(calls.map((one) => one.collection)).toEqual(['v', 'h', 'r1', 'r2', 'v2', 'p']);
    calls[5].done(page);
    void read(entry('r3'), { forList: true });
    await settle();
    expect(calls).toHaveLength(6);
    await new Promise((done) => setTimeout(done, 1_100));
    await settle();
    expect(calls.map((one) => one.collection).slice(6)).toEqual(['r3']);
    void read(entry('r4'), { forList: true });
    await settle();
    expect(calls).toHaveLength(7);
    calls[6].done(page);
    await settle();
    expect(calls.map((one) => one.collection).slice(6)).toEqual(['r3', 'r4']);
    flags.readsOn = true;
    const stale = (collection: string): any => ({ ...entry(collection, true), headAt: now - 31_000 });
    const c = stale('c');
    void read(c, { deeper: true });
    await settle();
    expect(calls.slice(8).map((one) => [one.collection, one.endLt])).toEqual([['c', null]]);
    calls[8].done(page);
    await settle();
    expect(calls, 'not taken for a press').toHaveLength(9);
    calls[7].done(page);
    await settle();
    expect(calls.slice(9).map((one) => [one.collection, one.endLt])).toEqual([['c', '41']]);
    void read(stale('q'), { deeper: true, pressed: true });
    await settle();
    expect(calls.slice(10).map((one) => [one.collection, one.endLt])).toEqual([['q', null]]);
    calls[10].done(page);
    await settle();
    expect(calls.slice(11).map((one) => [one.collection, one.endLt])).toEqual([['q', '41']]);
    const w = entry('w', true);
    void read(w);
    await settle();
    expect(calls.slice(12).map((one) => [one.collection, one.endLt])).toEqual([['w', null]]);
    void read(w, { deeper: true });
    calls[12].done(page);
    await settle();
    expect(calls, 'not taken for a press').toHaveLength(13);
    calls[9].done(page);
    await settle();
    expect(calls.slice(13).map((one) => [one.collection, one.endLt])).toEqual([['w', '41']]);
  });

  it('NFTUI-43: in the market\'s turn a row\'s own first page and a Fragment call go before a view\'s older page waiting [round 124 — C5-2]; a press or a search on the view lets its page waiting go at once, outside the turn — an unpressed read does not [round 125 — C5-2]; that page is the press\'s, none after it beside the turn [round 132 — C5-3]', async () => {
    const calls: Array<{ collection: string, endLt: string | null, done: (value: any) => void }> = [];
    const flags = { readsOn: false };
    const ownBids = new Map();
    const takes: string[] = [];
    const market: any = { collections: new Map(), lookupDue: null, turnLine: null, picker: { isConnected: true } };
    const env: Record<string, any> = {
      WALLET_MARKET_REFRESH_MS: 30_000, NFT_ALL: '', NFT_HEAD_PAGE: 20, NFT_COLLECTION_PAGE: 100, NFT_TURN_WAIT_MS: 60_000,
      walletNftMarket: market, walletNftViewPaint: () => {}, walletNftMarketPaint: () => {},
      walletNftMarketSeen: () => true, walletNftViewOpen: () => true, walletNftReadsOn: () => flags.readsOn, walletNftListInFront: () => true,
      createToncenterRestFetch: () => null, toncenterRestOrigin: () => 'https://o',
      readLatestListings: ({ collection, endLt }: any) => new Promise((done) => { calls.push({ collection, endLt, done }); }),
      walletNftLearnPicture: () => {}, walletNftRecheckShown: async () => {}, walletNftTelemintRead: () => {}, walletNftVerifyCollections: async () => [],
      isTonRpcRateLimitError: () => false, console: { warn: () => {} }, walletNftWithOwnBid: (listing: any) => ({ ...listing, mine: true }),
      walletNftOwnBids: ownBids, walletNftTakeListing: (listing: any) => takes.push(listing.sale),
    };
    const names = Object.keys(env);
    const start = 'async function walletNftCollectionRead(entry, { deeper = false, priority = \'focus\', forList = false, pressed = false } = {}) {';
    // eslint-disable-next-line no-new-func
    const { walletNftCollectionRead: read, walletNftTurn: turn, walletNftSearchOn: searchOn } = new Function(...names,
      `${sourceBlock(app, 'async function walletNftTurn({ first = false, entry = null } = {}) {')}\n${sourceBlock(app, start)}\n${sourceBlock(app, 'function walletNftSearchOn(key) {')}\n`
      + `${sourceBlock(app, 'function walletNftSetRead(entry, listing) {')}\nreturn { walletNftCollectionRead, walletNftTurn, walletNftSearchOn };`)(...names.map((n) => env[n]));
    const settle = async () => { for (let i = 0; i < 20; i += 1) await new Promise((done) => setTimeout(done, 0)); };
    const page = { more: false, oldestAt: 50, newestAt: 90, cursor: null, sales: [], listings: [] };
    const now = Date.now();
    const entry = (collection: string, held = false): any => ({ collection, listings: new Map(), pages: held ? 1 : 0, at: held ? now : 0, headAt: held ? now : 0,
      cursor: held ? '41' : null, newestAt: 0, hasMore: true, reading: false, failed: false });
    const shown = () => calls.map((one) => [one.collection, one.endLt]);
    void read(entry('r1'), { forList: true });
    await settle();
    void read(entry('v', true), { deeper: true });
    await settle();
    void read(entry('r2'), { forList: true });
    let fragmentGo: null | (() => void) = null;
    void turn({ first: true }).then((release: () => void) => { fragmentGo = release; });
    await settle();
    expect(shown()).toEqual([['r1', null]]);
    calls[0].done(page);
    await settle();
    expect(shown(), 'the row before the page waiting').toEqual([['r1', null], ['r2', null]]);
    calls[1].done(page);
    await settle();
    expect(fragmentGo, 'the Fragment call next').not.toBeNull();
    expect(shown(), 'the page still waits').toEqual([['r1', null], ['r2', null]]);
    fragmentGo!();
    await settle();
    expect(shown()).toEqual([['r1', null], ['r2', null], ['v', '41']]);
    calls[2].done(page);
    await settle();
    void read(entry('r3'), { forList: true });
    await settle();
    const w = entry('w', true);
    void read(w, { deeper: true });
    await settle();
    expect(shown().slice(3)).toEqual([['r3', null]]);
    void read(w, { deeper: true });
    await settle();
    expect(shown().slice(3), 'an unpressed read during the wait lets nothing go').toEqual([['r3', null]]);
    void read(w, { deeper: true, pressed: true });
    await settle();
    expect(shown().slice(3), 'pressed: its page at once, beside the row').toEqual([['r3', null], ['w', '41']]);
    expect(w.moreWanted).toBeFalsy();
    calls[4].done({ ...page, more: true, cursor: '40' });
    await settle();
    expect(shown().slice(5), 'none pressed after it').toEqual([]);
    void read(w, { deeper: true, pressed: true });
    await settle();
    expect(shown().slice(5)).toEqual([['w', '40']]);
    expect(w.besideTurn, 'a page pressed for: beside the turn').toBe(true);
    void read(w, { deeper: true, pressed: true });
    expect(w.moreWanted, 'the press runs when the page ends').toBe(true);
    calls[5].done({ ...page, more: true, cursor: '39' });
    await settle();
    expect(shown().slice(5)).toEqual([['w', '40'], ['w', '39']]);
    calls[6].done(page);
    await settle();
    expect(w.besideTurn, 'ended: no longer').toBe(false);
    flags.readsOn = true;
    const s = entry('s', true);
    market.collections.set('s', s);
    void read(s, { deeper: true });
    await settle();
    expect(shown().slice(7)).toEqual([]);
    searchOn('s');
    await settle();
    expect(shown().slice(7), 'a search lets its page go').toEqual([['s', '41']]);
    expect(s.moreWanted, 'its own page: none after it beside the turn [round 132 — C5-3]').toBeFalsy();
    expect(s.besideTurn, 'let go: beside the turn').toBe(true);
    searchOn('s');
    expect(s.moreWanted, 'the next keystroke').toBeFalsy();
    const z: any = { collection: 'z', at: now, hasMore: true, reading: true, turnGo: null, besideTurn: false, listings: new Map() };
    market.collections.set('z', z);
    searchOn('z');
    expect(z.moreWanted, 'a page in the turn under way').toBe(true);
    void read(entry('r4'), { forList: true });
    await settle();
    expect(shown().slice(8)).toEqual([]);
    calls[3].done(page);
    await settle();
    expect(shown().slice(8), 'the row r3 holding it ends: the next row').toEqual([['r4', null]]);
    const x = entry('x');
    market.collections.set('x', x);
    void read(x);
    await settle();
    calls.at(-1)!.done({ ...page, listings: [{ sale: 'L1', collection: 'x', lastBid: 1n }], sales: ['L1'] });
    await settle();
    expect(x.listings.get('L1')).toMatchObject({ sale: 'L1', mine: true });
    const all = entry('');
    void read(all);
    await settle();
    calls.at(-1)!.done({ ...page, listings: [{ sale: 'L2', collection: 'x', lastBid: 1n }], sales: ['L2'] });
    await settle();
    expect([all.listings.get('L2')?.mine, x.listings.get('L2')?.mine], 'every collection\'s list, and its own').toEqual([true, true]);
    expect(takes, 'no bid of one\'s own pending: no other copy touched').toEqual([]);
    ownBids.set('L4', {});
    void read(x);
    await settle();
    calls.at(-1)!.done({ ...page, listings: [{ sale: 'L4', collection: 'x', lastBid: 1n }, { sale: 'L5', collection: 'x', lastBid: 1n }], sales: ['L4', 'L5'] });
    await settle();
    expect(takes).toEqual(['L4']);
    expect(block('function walletNftTelemintRead(entry) {')).toContain('walletNftSetRead(entry, { ...lot, listedAt: 0 });');
    expect(block('function walletNftTelemintRead(entry) {')).toContain('const release = await walletNftTurn({ first: true });');
    expect(block(start)).toContain('if ((forList || !head) && !pressed) release = await walletNftTurn(forList ? { first: true } : { entry });');
  });

  it('NFTUI-44: a name typed holds the collection\'s pages until it is answered — NFT_LOOKUP_HOLD_MS at most: then the pages go on and the note stops saying the name is read; its late answer moves nothing, a name typed again keeps its own hold [round 130 — C5-2]; the read said slow at its own bound, the same name typed again too [round 132 — C5-5]', async () => {
    vi.useFakeTimers();
    try {
      const market: any = { lookupTimer: 0, lookupDue: null, lookup: null };
      const searched: string[] = [];
      let answer: (() => void) | null = null;
      const env: Record<string, any> = {
        walletNftMarket: market, NFT_LOOKUP_REST_MS: 400, NFT_LOOKUP_HOLD_MS: 30_000, walletNftViewPaint: () => {},
        walletNftSearchOn: (key: string) => searched.push(key),
        walletNftLookupName: () => { market.lookup = { key: 'k', reading: true }; return new Promise<void>((done) => { answer = () => { market.lookup.reading = false; done(); }; }); },
      };
      const names = Object.keys(env);
      // eslint-disable-next-line no-new-func
      const soon = new Function(...names, `${sourceBlock(app, 'function walletNftLookupSoon(key) {')}\nreturn walletNftLookupSoon;`)(...names.map((n) => env[n]));
      soon('k');
      const due = market.lookupDue;
      await vi.advanceTimersByTimeAsync(400 + 29_999);
      expect([market.lookupDue, searched], 'held while it is read').toEqual([due, []]);
      await vi.advanceTimersByTimeAsync(1);
      expect([market.lookupDue, searched], 'its bound: the pages go on').toEqual([null, ['k']]);
      answer!();
      await vi.advanceTimersByTimeAsync(0);
      expect(searched, 'its late answer moves nothing').toEqual(['k']);
      soon('k');
      await vi.advanceTimersByTimeAsync(400 + 1_000);
      answer!();
      await vi.advanceTimersByTimeAsync(0);
      expect([market.lookupDue, searched]).toEqual([null, ['k', 'k']]);
      await vi.advanceTimersByTimeAsync(40_000);
      expect(searched).toEqual(['k', 'k']);
      soon('k');
      await vi.advanceTimersByTimeAsync(400 + 20_000);
      soon('k');
      const again = market.lookupDue;
      await vi.advanceTimersByTimeAsync(10_500);
      expect([market.lookupDue, searched.length], 'the second keeps its hold').toEqual([again, 2]);
      await vi.advanceTimersByTimeAsync(20_000);
      expect([market.lookupDue, searched.length]).toEqual([null, 3]);
      const market2: any = { lookupTimer: 0, lookupDue: null, lookup: null, parts: { key: 'k' }, filter: { key: 'k', q: 'name' } };
      const searched2: string[] = [];
      let paints = 0;
      const env2: Record<string, any> = {
        walletNftMarket: market2, NFT_LOOKUP_REST_MS: 400, NFT_LOOKUP_HOLD_MS: 30_000, NFT_ALL: '', walletNftViewPaint: () => { paints += 1; },
        walletNftSearchOn: (key: string) => searched2.push(key), walletNftIndexTyped: async () => '7', walletNftAthLabel: (text: string) => text,
        createToncenterRestFetch: () => null, walletNftViewOpen: () => true, toncenterRestOrigin: () => 'https://o', readListingsByIndex: () => new Promise(() => {}),
        walletNftCollection: () => ({ listings: new Map() }), isTonRpcRateLimitError: () => false, console: { warn: () => {} },
      };
      const names2 = Object.keys(env2);
      // eslint-disable-next-line no-new-func
      const soon2 = new Function(...names2, `${sourceBlock(app, 'function walletNftLookupSoon(key) {')}\n${sourceBlock(app, 'async function walletNftLookupName() {')}\nreturn walletNftLookupSoon;`)(
        ...names2.map((n) => env2[n]));
      soon2('k');
      await vi.advanceTimersByTimeAsync(400);
      expect(market2.lookup).toMatchObject({ index: '7', reading: true, slow: false });
      await vi.advanceTimersByTimeAsync(10_000);
      soon2('k');
      await vi.advanceTimersByTimeAsync(400);
      expect([market2.lookupDue, searched2, market2.lookup.slow], 'typed again: the pages go at once').toEqual([null, ['k'], false]);
      const before = paints;
      await vi.advanceTimersByTimeAsync(19_600);
      expect([market2.lookup.slow, market2.lookup.reading], 'its own bound: no longer said read').toEqual([true, true]);
      expect(paints, 'and drawn so').toBeGreaterThan(before);
      expect(searched2, 'nothing more asked').toEqual(['k']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('NFTUI-38: the market\'s two status notes are written only when their words change — a status written again with its own words is announced again [round 112 — C7-1]', () => {
    const view = block('function walletNftViewPaint() {');
    expect(view).toContain('setTextIfChanged(cardsNote, !listings.length && lookup && !lookup.reading && !lookup.found');
    expect(view, 'no other write of the note').not.toMatch(/cardsNote\.(textContent|innerText|innerHTML)\s*=/);
    const list = block('function walletNftPickerPaint() {');
    expect(list).toContain('setTextIfChanged(pickerNote, rows.length ? \'\'');
    expect(list, 'no other write of the note').not.toMatch(/pickerNote\.(textContent|innerText|innerHTML)\s*=/);
    // eslint-disable-next-line no-new-func
    const setText = new Function(`${sourceBlock(app, 'function setTextIfChanged(node, text) {')}\nreturn setTextIfChanged;`)();
    let writes = 0;
    let held = '';
    const note = { get textContent() { return held; }, set textContent(text: string) { writes += 1; held = text; } };
    setText(note, 'Fresh listings shown.');
    setText(note, 'Fresh listings shown.');
    setText(note, 'Fresh listings shown.');
    expect(writes, 'the same words, written once').toBe(1);
    setText(note, '');
    setText(note, '');
    expect(writes).toBe(2);
  });

  it('NFTUI-11: "Open in Tonviewer" keeps its card under the outside-link question [round 85 — C7-1]; on a phone a listing\'s Back returns to its collection where it stood — its cards shown, its scroll, the card that opened it [round 85 — C7-2]', () => {
    const explorer = block('function walletNftExplorerButton(address) {');
    expect(explorer, 'not a card\'s door: that closes the card first').not.toContain('walletCardSend(');
    expect(explorer).toContain("button.addEventListener('click', () => activateExternalLink(`${TRADER_EXPLORER_ORIGIN}/${encodeURIComponent(shown)}`));");
    const card = block('function walletNftCard(listing, { withCollection = false, own = false } = {}) {');
    expect(card).toContain("const keep = { shown: walletNftMarket.parts?.shown ?? NFT_CARDS_PAGE, scroll: document.querySelector('#walletGroupDialog .wallet-group-body')?.scrollTop ?? 0,");
    expect(card).toContain('() => openWalletNftCollection(from, keep)');
    const whole = block('function openWalletNftCollection(key, keep = null) {');
    const open = whole.slice(whole.indexOf('walletNftMarket.view = key;'));
    expect(open.indexOf('if (keep) walletNftMarket.parts.shown = keep.shown;'), 'the cards it showed, before they are drawn').toBeLessThan(open.indexOf('walletNftViewPaint();'));
    expect(open).toContain('walletNftMarket.parts.grid.querySelector(`[data-sale="${CSS.escape(keep.sale)}"]`)?.focus({ preventScroll: true });');
    expect(open).toContain('requestAnimationFrame(() => { if (body) body.scrollTop = keep.scroll; });');
  });

  it('NFTUI-12: a collection\'s row reads its own first page while it is in view — one row at a time, at focus, so every collection\'s older pages go on between them; once, again past ten beats, a failed one after a beat [2026-10-30]', () => {
    const watch = block('function walletNftWatchRows(picker) {');
    expect(watch, 'the window\'s own view, clipped by the list [round 87 — C5-5]').toContain("}, { rootMargin: '100px 0px' });");
    expect(watch).toContain('if (!walletNftMarket.rowSeer || walletNftMarket.rowSeerList !== picker) {');
    expect(watch).not.toContain('{ root,');
    expect(watch).toContain('if (seen.isIntersecting) walletNftMarket.rowsInView.add(key);');
    expect(watch).toContain('void walletNftReadRows();');
    const rows = block('async function walletNftReadRows() {');
    expect(rows).toContain('if (walletNftMarket.rowReading) return;');
    expect(rows).toContain('await walletNftCollectionRead(entry, { forList: true });');
    expect(rows).toContain('if (!walletNftMarket.picker?.isConnected || !walletNftMarketSeen() || modalOnScreen()) break;');
    expect(rows).toContain('now - (entry.listTriedAt ?? 0) > (entry.at ? NFT_ROW_STALE_MS : WALLET_MARKET_REFRESH_MS)');
    expect(block('function walletNftPickerPaint() {')).toContain('walletNftWatchRows(picker);');
    const read = block("async function walletNftCollectionRead(entry, { deeper = false, priority = 'focus', forList = false, pressed = false } = {}) {");
    expect(read).toContain('wanted: forList ? () => listed() || open() : open');
    expect(read).toContain('if (!held && walletNftViewOpen(entry.collection) && !entry.failed && (entry.catchUp || (entry.hasMore');
  });

  it('NFTUI-13: a grid drawn again keeps the scroll it stood at — the window\'s on a phone, the pane\'s on a desktop — with the browser\'s anchoring off there [round 86 — C7-1: 4 890 px back to 111-504 within seconds]', () => {
    const paint = block('function walletNftViewPaint() {');
    expect(paint, 'held by script only while a card holds the focus [round 87 — C5-2]').toContain("const scroller = focused ? cards.closest('.wallet-group-body, .wallet-nft-detail') : null;");
    expect(paint.indexOf('const stood = scroller ? scroller.scrollTop : 0;')).toBeLessThan(paint.indexOf('walletNftPutCards(cards, want);'));
    expect(paint.indexOf('if (scroller && scroller.scrollTop !== stood) scroller.scrollTop = stood;')).toBeGreaterThan(paint.indexOf('if (target && document.activeElement !== target) target.focus({ preventScroll: true });'));
    expect(css).toMatch(/\.modal-backdrop\.is-nft-view \.wallet-group-body,\s*\.wallet-nft-detail \{ overflow-anchor: none; \}/);
    expect(block('function openWalletNftCollection(key, keep = null) {')).toContain("walletGroupDialog?.classList.add('is-nft-view');");
    expect(block('function fillWalletCard({ picture, letter, title, subtitle, stats, hero = null }) {')).toContain("walletGroupDialog?.classList.remove('is-nft-view');");
  });

  it('NFTUI-14: a name with no picture of its own is drawn as itself — a TON DNS domain on TON\'s blue, in its card, its listing\'s hero and a held one\'s tile [2026-10-30]', () => {
    const face = block('function walletNftDomainFace(icon, domain) {');
    expect(face, 'beneath any picture: one that draws covers it [2026-11-04]').toContain('if (!domain) return;');
    expect(css).toContain('.wallet-nft-card-picture.is-domain.has-picture,');
    const faceRule = css.slice(css.indexOf('.wallet-nft-picture.is-domain {'), css.indexOf('}', css.indexOf('.wallet-nft-picture.is-domain {')));
    expect(faceRule).toContain('background-image: linear-gradient(140deg, #0098ea, #0b4f9c);');
    expect(faceRule).not.toMatch(/\bbackground:/);
    expect(face).toContain("icon.classList.add('is-domain');");
    expect(block('function walletNftCard(listing, { withCollection = false, own = false } = {}) {')).toContain('walletNftDomainFace(icon, walletNftFaceName(listing));');
    expect(block('function walletNftHero({ pictures = [], letter, gift = null, shared = false, domain = \'\', nft = \'\', standIn = [] }) {')).toContain('walletNftDomainFace(still, domain);');
    expect(block('function walletNftTile(item) {')).toContain('if (verified) walletNftDomainFace(entry.icon, walletNftFaceName(item));');
    expect(css).toContain('.wallet-nft-card-picture.is-domain,');
  });

  it('NFTUI-15: a collection\'s filters — a name or a number (an anonymous number by its digits), its traits with their counts (up to ten, a gift\'s three first), a price from / to — over the listings read, kept for the collection open [2026-10-30]', () => {
    const lift = (start: string) => sourceBlock(app, start);
    // eslint-disable-next-line no-new-func
    const run = new Function('walletNftMarket', `${lift('function walletNftGramUnits(typed) {')}\n${lift('function walletNftFiltered(key, listings) {')}\nreturn { walletNftGramUnits, walletNftFiltered };`);
    const market: any = { filter: { key: 'c', traits: new Map(), min: '', max: '', q: '' } };
    const { walletNftGramUnits, walletNftFiltered } = run(market);
    expect([walletNftGramUnits('5'), walletNftGramUnits('5,5'), walletNftGramUnits('0.000000001'), walletNftGramUnits(''), walletNftGramUnits('5 GRAM')])
      .toEqual([5_000_000_000n, 5_500_000_000n, 1n, null, 5_000_000_000n]);
    const listing = (name: string, price: bigint, attributes: any[] = []) => ({ name, price, attributes });
    const all = [
      listing('+888 0123 4567', 2_950_000_000_000n), listing('+888 0765 4321', 2_969_000_000_000n),
      listing('Top Hat #90001', 9_000_000_000n, [{ trait: 'Model', value: 'Burned Brass' }, { trait: 'Backdrop', value: 'Chocolate' }]),
      listing('Top Hat #12', 7_000_000_000n, [{ trait: 'Model', value: 'Gold' }, { trait: 'Backdrop', value: 'Chocolate' }]),
    ];
    const names = () => walletNftFiltered('c', all).map((one: any) => one.name);
    market.filter.q = '0123 4567';
    expect(names(), 'a number by its digits, spaces aside').toEqual(['+888 0123 4567']);
    market.filter.q = '01234567';
    expect(names()).toEqual(['+888 0123 4567']);
    market.filter.q = '#90001';
    expect(names()).toEqual(['Top Hat #90001']);
    market.filter.q = '';
    market.filter.traits.set('Backdrop', 'Chocolate');
    expect(names()).toEqual(['Top Hat #90001', 'Top Hat #12']);
    market.filter.traits.set('Model', 'Gold');
    expect(names(), 'every trait chosen at once').toEqual(['Top Hat #12']);
    market.filter.traits.clear();
    market.filter.min = '8';
    market.filter.max = '3000';
    expect(names(), 'from 8 to 3 000 GRAM').toEqual(['+888 0123 4567', '+888 0765 4321', 'Top Hat #90001']);
    expect(walletNftFiltered('other', all), 'another collection\'s filters filter nothing here').toHaveLength(4);
    const paint = block('function walletNftFilterPaint(bar, listings) {');
    expect(paint).toContain('.slice(0, NFT_FILTER_TRAITS_MAX);');
    expect(paint).toContain("if (box.dataset.signature !== signature && !box.contains(document.activeElement)) {");
    expect(paint, 'the one in hand keeps counting, in place').toContain("option.textContent = `${option.value} (${values.get(option.value) ?? 0})`;");
    expect(app).toContain('const NFT_FILTER_TRAITS_MAX = 10;');
    expect(block('function walletNftViewListings(key) {')).toContain('const listings = walletNftFiltered(key, [...walletNftCollection(key).listings.values()].filter((listing) => walletNftListingOn(listing)));');
    expect(css).toContain('.wallet-nft-filter-reset[hidden] { display: none; }');
  });

  it('NFTUI-16: a .ath name\'s art in the market is the profile\'s and the wallet\'s — the indexer\'s whole SVG, read for the names drawn, twenty a call; the registry\'s row is Platho\'s mark [2026-10-30]', () => {
    const art = block('function walletNftAthArtOf(listing) {');
    expect(art).toContain('if (!listing?.nft || !listing.collection || listing.collection !== walletNftRegistryRaw()) return [];');
    const read = block('async function walletNftReadAthArt() {');
    expect(read).toContain('const art = await readUsernameNftArt({ itemAddresses: batch });');
    expect(read, 'whole base64 pictures only [pentest 2026-10-31 — P5]').toContain("for (const nft of batch) walletNftKeepAthArt(nft, inlinePictureOf({ image: art.get(nft) ?? '' }));");
    expect(read, 'a failed read is asked again after a beat [round 88 — C7-2]').toContain('walletNftKeepAthArt(nft, again);');
    expect(block('function walletNftCard(listing, { withCollection = false, own = false } = {}) {')).toContain('const pictures = [...walletNftAthArtOf(listing), ...walletNftPictures(');
    expect(block('function walletNftPickerEntries() {')).toContain('entries.get(registry).picture ||= NFT_REGISTRY_PICTURE;');
    expect(app).toContain("const NFT_REGISTRY_PICTURE = '/assets/platho-icon-192.png';");
  });

  it('NFTUI-17: a listing bought here leaves every view at once; the cards on screen are read again each beat by their sales — sold or withdrawn they leave, repriced they take the fresh price [2026-10-30: a bought name stood for sale]', () => {
    const buy = block('async function openNftBuyDialog(listing, hold) {');
    expect(buy.slice(buy.indexOf('if (!values?.sent) return null;')), 'bought here: gone from every view at once').toContain('walletNftForgetListing(listing.sale);');
    const read = block("async function walletNftCollectionRead(entry, { deeper = false, priority = 'focus', forList = false, pressed = false } = {}) {");
    expect(read).toContain('if (head) await walletNftRecheckShown(entry, read.sales, fetchImpl);');
    const recheck = block('async function walletNftRecheckShown(entry, named, fetchImpl) {');
    expect(recheck).toContain('if (parts?.key !== entry.collection || !parts.grid?.isConnected) return;');
    expect(recheck, 'what changed takes its fresh figures').toContain('else walletNftTakeListing(walletNftAsRead(fresh), { paint: false });');
    expect(recheck, 'a copy only re-stamped takes its NFT\'s transaction [round 135 — C1-1]').toContain('else if (fresh.dataHash && fresh.dataHash === dataAsked.get(sale)) walletNftTakeItemLt(sale, fresh.itemLt);');
    expect(recheck, 'what is gone leaves').toContain('if (!fresh) walletNftForgetListing(sale, { paint: false });');
    expect(recheck).toContain('const swept = rest.slice(entry.sweptTo ?? 0, (entry.sweptTo ?? 0) + NFT_SALES_MAX - shown.length);');
    expect(recheck, 'a failed read leaves them for the next beat')
      .toContain('try { changed = await readListingsChanged({ fetchImpl, origin: toncenterRestOrigin(), listings: sent }); } catch { return; }');
    expect(recheck).toContain('const sent = [...shown, ...swept];');
  });

  it('NFTUI-18: the collections\' list keeps its scroll across its paint, a row focused or none — the list\'s own on a desktop, the page\'s on a phone [round 87 — C7-1]; the browser\'s anchoring back when the window closes [C7-5]', () => {
    const paint = block('function walletNftPickerPaint() {');
    expect(paint, 'held by script only while a row holds the focus [round 87 — C5-2]').toContain("const scroller = focused === null ? null : walletNftMarket.drawnDesktop ? picker : picker.closest('.wallet-scroll-content');");
    expect(paint.indexOf('const stood = scroller ? scroller.scrollTop : 0;')).toBeLessThan(paint.indexOf('picker.replaceChildren(...rows);'));
    expect(paint.indexOf('if (scroller && scroller.scrollTop !== stood) scroller.scrollTop = stood;')).toBeGreaterThan(paint.indexOf('?.focus({ preventScroll: true });'));
    expect(block('function closeWalletGroup() {')).toContain("walletGroupDialog.classList.remove('is-nft-view');");
  });

  it('NFTUI-19: the .ath names, Telegram\'s usernames and numbers and TON\'s domains are always in the list, first, named by one read; then every verified collection, the busiest first; a search while the list fills says so, not "nothing found"; a collection open reads on to its first listing and says how far [2026-11-04]', () => {
    expect(block('function walletNftPinnedCollections() {')).toContain('return [walletNftRegistryRaw(), ...NFT_PINNED_COLLECTIONS].filter(Boolean);');
    expect(block('async function walletNftNamePinned() {')).toContain('const named = await readCollectionNames({ fetchImpl, origin: toncenterRestOrigin(), collections: unnamed });');
    const entries = block('function walletNftPickerEntries() {');
    expect(entries, 'by the month before the release and the feed since: the order holds as the feed fills').toContain('rank(a) - rank(b) || (b.listed + b.feed) - (a.listed + a.feed)');
    expect(entries, 'every collection Getgems verifies, read or not').toContain('for (const one of approvedNftCollections()) {');
    expect(app).toContain("import { approvedNftCollections } from './nft-collections.mjs?v=");
    const paint = block('function walletNftPickerPaint() {');
    expect(paint).toContain(": filling ? t('nft.collectionsLoading') : t('wallet.swapNothingFound'));");
    const read = block("async function walletNftCollectionRead(entry, { deeper = false, priority = 'focus', forList = false, pressed = false } = {}) {");
    expect(read).toContain('(entry.catchUp || (entry.hasMore && (entry.moreWanted || walletNftReadsOn(entry))))) {');
    expect(read).toContain('|| Date.now() - entry.headAt > WALLET_MARKET_REFRESH_MS)) {');
    expect(read).toContain('if (head) entry.headAt = entry.at;');
    expect(block('function walletNftSearchOn(key) {')).toContain('else void walletNftCollectionRead(entry, { deeper: true, pressed: true });');
    expect(block('function walletNftSearchOn(key) {'), 'a search during a read goes on from it').toMatch(/if \(entry\.reading\) \{\s+if \(entry\.turnGo\) entry\.turnGo\(\);[\s\S]*?else if \(!entry\.besideTurn\) entry\.moreWanted = true;/);
    expect(block('function walletNftFilterChanged() {')).toContain('else walletNftSearchOn(key);');
    const view = block('function walletNftViewPaint() {');
    expect(view).toContain(": searching ? t('nft.filterReading', { count: entry.listings.size })");
    expect(view, 'reading on, said with how many it has found').toContain(": readingOn && listings.length ? t('nft.readingOn', { count: entry.listings.size })");
    expect(view).toContain('const readingOn = Boolean(key) && hasMore && !failed && walletNftReadsOn(entry);');
  });

  it('NFTUI-20: only the view open reads past its head — All collections\' older pages while it is the view, a collection\'s while it is open; the list takes every collection\'s head each beat and says "loading" only while it is read [2026-10-30]', () => {
    const read = block("async function walletNftCollectionRead(entry, { deeper = false, priority = 'focus', forList = false, pressed = false } = {}) {");
    expect(read).toContain('if (!held && walletNftViewOpen(entry.collection) && !entry.failed && (entry.catchUp || (entry.hasMore && (entry.moreWanted || walletNftReadsOn(entry))))) {');
    expect(read, 'no older page outside the view').not.toContain('if (open() && entry.hasMore');
    const start = block('function walletNftViewStart(key) {');
    expect(start).toContain('else if (walletNftViewOpen(key) && (entry.catchUp || (entry.hasMore && walletNftReadsOn(entry)))) {');
    expect(start, 'a name let go is asked again as its view opens [round 88 — C5-3]').toContain('walletNftLookupAgain(key);');
    expect(block('function walletMarketTick() {'), '...and every beat').toContain('walletNftLookupAgain(open);');
    expect(block('function walletNftLookupAgain(key) {')).toContain('if (walletNftNameShaped(key, walletNftMarket.filter.q)) walletNftLookupSoon(key);');
    expect(block('function walletNftViewOpen(key) {')).toContain("if (key === NFT_ALL && !walletNftMarket.drawnDesktop && walletNftMarketSeen() && Boolean(walletNftMarket.picker?.isConnected) && !modalOnScreen()) return true;");
    expect(block('function walletNftPickerPaint() {'), 'not at every beat\'s head [round 88 — C5-5]').toContain('const filling = !all.at || (walletNftViewOpen(NFT_ALL) && all.hasMore && all.pages < NFT_COLLECTION_DEEP_PAGES);');
  });

  it('NFTUI-30: an NFT with no picture drawn is its name where the name is a handle, as a TON domain is; a picture toncenter answers 404 for is another of its copies [2026-11-04]', () => {
    const face = block('function walletNftFaceName(item) {');
    expect(face, 'the handle before the domain — a username\'s is "name.t.me" [round 107 — C7-1]').toContain('if (/^@[^\\s@]{1,64}$/u.test(name)) return name;');
    expect(face).toContain("return item?.domain || '';");
    expect(face.indexOf('return name;')).toBeLessThan(face.indexOf('return item?.domain'));
    expect(block('function walletNftCard(listing, { withCollection = false, own = false } = {}) {')).toContain('walletNftDomainFace(icon, walletNftFaceName(listing));');
    expect(app).toContain('shared: true, domain: walletNftFaceName(listing), nft: listing.nft, standIn: walletNftStandIn(listing) }),');
    expect(app).toContain("if (verified) walletNftDomainFace(entry.icon, walletNftFaceName(item));");
    expect(app).toContain("domain: item.verified ? walletNftFaceName(item) : '' }),");
    expect(app, 'no NFT drawn by its domain alone any more').not.toMatch(/walletNftDomainFace\([^)]*\.domain\)/);
    expect(block("async function walletNftCollectionRead(entry, { deeper = false, priority = 'focus', forList = false, pressed = false } = {}) {")).toContain('walletNftLearnPicture(listing);');
    expect(block('function walletNftCard(listing, { withCollection = false, own = false } = {}) {')).toContain('listing.picture), ...walletNftSamePicture(listing)];');
    expect(app).toContain('...walletNftPictures(gift, listing.pictureBig, listing.picture), ...walletNftSamePicture(listing)],');
    const learn = block('function walletNftLearnPicture(listing) {');
    expect(learn).toContain('if (copies.length < NFT_PICTURE_COPIES && !copies.includes(listing.picture)) copies.push(listing.picture);');
    expect(learn, 'bounded').toContain('if (walletNftMarket.pictureCopies.size >= NFT_PICTURE_KEYS) walletNftMarket.pictureCopies.clear();');
    expect(block('function walletNftSamePicture(listing) {')).toContain('.filter((copy) => copy !== listing.picture && copy !== listing.pictureBig);');
  });

  it('NFTUI-31: a listed collection is read for its gift verdict too — a gift\'s motion and its picture from Telegram\'s host come by it [round 106 — C1-1]', () => {
    const verify = block('async function walletNftVerifyCollections(collections) {');
    expect(verify).toContain('const unknown = [...new Set(collections)].filter((collection) => collection && !walletNftMarket.giftVerdicts.has(collection));');
    expect(block('function walletNftGiftOf(collection, uri) {')).toContain("if (!collection || walletNftMarket.giftVerdicts.get(collection) !== 'yes') return null;");
    expect(block('function walletNftCollectionVerified(collection) {'), 'a listed collection stays verified whatever its gift verdict').toMatch(/if \(listedNftCollection\(collection\)\) return 'yes';[\s\S]*return walletNftMarket\.giftVerdicts\.get\(collection\) \?\? null;/);
  });

  it('NFTUI-21: a name typed in the .ath names, Telegram\'s usernames and numbers or TON\'s domains is read by its index once the typing rests — whatever its listing\'s age — and taken among the listings; "not on sale" said for it [2026-10-30]', () => {
    expect(block('function walletNftFilterChanged() {')).toContain('if (key && walletNftNameShaped(key, walletNftMarket.filter.q)) walletNftLookupSoon(key);');
    const soon = block('function walletNftLookupSoon(key) {');
    expect(soon).toContain('void walletNftLookupName().finally(() => {');
    expect(soon).toContain('if (walletNftMarket.lookupDue !== due) return;');
    expect(soon.indexOf('walletNftMarket.lookupDue = null;')).toBeLessThan(soon.indexOf('walletNftSearchOn(key);'));
    expect(block("async function walletNftCollectionRead(entry, { deeper = false, priority = 'focus', forList = false, pressed = false } = {}) {")).toContain('const held = walletNftMarket.lookupDue?.key === entry.collection;');
    expect(block('function walletNftNameShaped(key, text) {')).toContain("if (key === walletNftRegistryRaw()) return /^[a-z0-9_-]+$/.test(walletNftAthLabel(text));");
    const typed = block('async function walletNftIndexTyped(key) {');
    expect(typed).toContain('if (key !== walletNftRegistryRaw()) return nftIndexOfName(key, text);');
    expect(typed).toContain('try { return String(await computeUsernameNameHash(text)); } catch { return null; }');
    const lookup = block('async function walletNftLookupName() {');
    expect(lookup).toContain('if (index === null || (walletNftMarket.lookup?.key === key && walletNftMarket.lookup.index === index)) return;');
    expect(lookup).toContain("wanted: () => walletNftViewOpen(key) && walletNftMarket.lookup === lookup");
    expect(lookup, 'asked: ahead of the screen\'s reads, through a park').toContain("requestOptions: { priority: 'asked', skipIfRateLimited: false,");
    const weights = sourceBlock(readFileSync('web/ton-rpc-transport.mjs', 'utf8'), 'const TONCENTER_REQUEST_PRIORITY_WEIGHTS = Object.freeze({');
    expect(weights).toMatch(/critical: 0,[\s\S]*asked: 0\.25,[\s\S]*focus: 0\.5,/);
    expect(lookup).toContain('for (const listing of listings) walletNftSetRead(entry, { ...listing, listedAt: listing.createdAt });');
    const paint = block('function walletNftViewPaint() {');
    expect(paint).toContain('|| walletNftMarket.lookupDue?.key === key || Boolean(lookup?.reading && !lookup.slow);');
    expect(paint, 'the name\'s answer at once, before the pages\' progress').toContain("setTextIfChanged(cardsNote, !listings.length && lookup && !lookup.reading && !lookup.found");
  });

  it('NFTUI-22: a price as the app writes one is read, one that cannot be read is said on its field and filters nothing; a refused .ath art read waits a beat; a name on another kind of sale is said on sale [round 88 — C7-1, C7-2, C1-1, C7-3]', () => {
    const units = new Function(`${block('function walletNftGramUnits(typed) {')}; return walletNftGramUnits;`)();
    const GRAM = 1_000_000_000n;
    for (const [typed, want] of [['5', 5n * GRAM], ['5 000', 5000n * GRAM], ['5\u00a0000', 5000n * GRAM], ['5\u202f000,5', 5000n * GRAM + GRAM / 2n],
      [',5', GRAM / 2n], ['5 GRAM', 5n * GRAM], ['\uff15', 5n * GRAM], ['1 250.25', 1250n * GRAM + GRAM / 4n]] as const) expect(units(typed), typed).toBe(want);
    for (const typed of ['', ' ', 'abc', '5..5', '.', '1-2']) expect(units(typed), typed).toBeNull();
    expect(block('function walletNftFilterActive(key) {')).toContain('walletNftGramUnits(filter.min) !== null');
    expect(block('function walletNftFilterBar(key) {')).toContain("input.setAttribute('aria-invalid', String(Boolean(input.value.trim()) && walletNftGramUnits(input.value) === null))");
    expect(css, 'said while typed too [round 89 — C7-1]').toContain('.wallet-nft-filter-price[aria-invalid="true"]:focus-visible { border-color: var(--danger); }');
    expect(css.indexOf('.wallet-nft-filter-price[aria-invalid="true"]:focus-visible')).toBeGreaterThan(css.indexOf('.wallet-nft-filter-price:focus-visible { outline: none;'));
    const read = block('async function walletNftReadAthArt() {');
    expect(read).toContain('for (const nft of batch) walletNftKeepAthArt(nft, again);');
    const keep = block('function walletNftKeepAthArt(nft, art) {');
    expect(keep).toContain('for (const held of walletNftMarket.cards.values()) if (held.card?.isConnected && held.listing?.nft) drawn.add(held.listing.nft);');
    expect(keep).toContain('if (!drawn.has(key)) kept.delete(key);');
    expect(read).not.toContain('walletNftMarket.athArt.delete(nft)');
    expect(block('function walletNftAthArtOf(listing) {')).toContain("if (typeof art === 'number' && Date.now() < art) return [];");
    expect(block('function walletNftViewPaint() {')).toContain("t(lookup.onSale ? 'nft.nameListedElsewhere' : 'nft.nameNotListed',");
  });

  it('NFTUI-05: a verdict\'s focus stays where it is when it is somewhere real, the queue\'s title too [round 83 — C9-49: taken from the title, it jumped to an old card off screen]', () => {
    const focus = block('function focusModerationQueueCard(rowKey, {');
    expect(focus).toContain("if (!force && active && active !== document.body && active.isConnected && !active.closest('[hidden]')) return;");
    expect(focus).not.toContain("active.id !== 'moderationQueueTitle'");
  });
});
