import { describe, expect, it } from 'vitest';
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
    expect(render, 'a window turned into the other layout is drawn again').toContain('if (walletNftMarket.drawnDesktop !== isDesktopLayout()) { renderWalletNftMarket(panel); return; }');
  });

  it('NFTUI-02: the cards stay while a view reads, kept by their sale, and the focus stands on its card — or the one now in its place [round 84 — C7-1]; "Show more" never said unavailable [round 84 — C7-2]', () => {
    const paint = block('function walletNftViewPaint() {');
    expect(paint).toContain("const focused = focusedAt >= 0 ? document.activeElement.dataset.sale : '';");
    expect(paint).toContain('cards.children[Math.min(focusedAt, cards.children.length - 1)]');
    expect(paint).toContain("moreCards.setAttribute('aria-busy', String(reading && listings.length <= shown.length));");
    expect(paint).not.toContain('aria-disabled');
    const card = block('function walletNftCard(listing, { withCollection = false } = {}) {');
    expect(card).toMatch(/if \(held && held\.price === listing\.price\) \{[\s\S]*?held\.listing = listing;\s+return held\.card;/);
    expect(card).toContain('card.dataset.sale = listing.sale;');
    expect(css).toContain('.wallet-nft-cards[hidden] { display: none; }');
    const picker = block('function walletNftPickerPaint() {');
    expect(picker).toContain('picker.querySelector(`[data-collection="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });');
  });

  it('NFTUI-03: every collection\'s newest is read as one collection is — the head at once, older pages behind it while All collections is the view, the head again each beat — so the collections\' list fills by itself [2026-10-30: drawn from the newest page alone it held 30 collections and never grew]', () => {
    expect(app, 'the feed\'s own reader is gone').not.toContain('async function walletNftMarketRead(');
    expect(app).toContain("const NFT_ALL = '';");
    const read = block('async function walletNftCollectionRead(entry, { deeper = false, priority = \'focus\', forList = false } = {}) {');
    expect(read).toContain('collection: entry.collection || null,');
    expect(read).toContain('const open = () => (entry.collection === NFT_ALL && !deeper ? walletNftMarketSeen() && Boolean(walletNftMarket.box?.isConnected)');
    expect(read.indexOf('walletNftMarketPaint();'), 'what is known verified drawn before a new collection\'s check [round 82 — C5]').toBeLessThan(read.indexOf('await walletNftVerifyCollections(read.listings.map((listing) => listing.collection));'));
    expect(read).toContain("const pulse = entry.collection === NFT_ALL && !deeper ? walletNftMarket.box?.querySelector('.wallet-market-live') : null;");
    expect(block('function renderWalletNftMarket(panel) {')).toContain('walletNftViewStart(NFT_ALL);');
    expect(block('function walletNftViewStart(key) {')).not.toContain('if (!key) return;');
    const tick = block('function walletMarketTick() {');
    expect(tick).toMatch(/if \(walletNftMarket\.mode === 'nft' && walletNftMarket\.box\?\.isConnected\) \{\s+void walletNftCollectionRead\(walletNftCollection\(NFT_ALL\)\);/);
    expect(tick).toContain('if (open !== NFT_ALL) { void walletNftCollectionRead(walletNftCollection(open)); walletNftLookupAgain(open); }');
    expect(block('function walletNftPickerEntries() {')).toContain('for (const listing of walletNftCollection(NFT_ALL).listings.values()) {');
    expect(block('function walletNftPickerPaint() {')).toContain('rows.push(...entries.slice(0, NFT_PICKER_ROWS).map(walletNftPickerRow));');
    expect(block('function walletNftVisibleFeed() {')).toContain('.sort((a, b) => (b.listedAt || 0) - (a.listedAt || 0));');
    expect(css, 'every view is read again each beat: the strip is never paused').not.toContain('is-paused');
  });

  it('NFTUI-06: a press of "Show more" during a read runs when it ends [round 83 — C5-2, C7-1]; past what is read it reads on, by the cursor, the head first after a while away [round 84 — C5-1]; a window\'s opener drawn anew gives the focus to its twin by key [round 83 — C7-2]', () => {
    const collection = block('async function walletNftCollectionRead(entry, { deeper = false, priority = \'focus\', forList = false } = {}) {');
    expect(collection).toMatch(/if \(entry\.reading\) \{\s+if \(deeper\) entry\.moreWanted = true;/);
    expect(collection).toContain("void walletNftCollectionRead(entry, { deeper: true, priority: pressed || walletNftListInFront(entry) ? 'focus' : 'background' });");
    expect(block('function walletNftShowMore() {')).toContain('void walletNftCollectionRead(walletNftCollection(parts.key), { deeper: true });');
    const focus = block('function restoreDialogFocus(target) {');
    expect(focus).toContain('.wallet-nft-cards [data-sale="${CSS.escape(target.dataset.sale)}"]');
    expect(focus).toContain('.wallet-nft-picker [data-collection="${CSS.escape(target.dataset.collection)}"]');
  });

  it('NFTUI-07: a collection\'s own pages — the head again takes the live and drops the sold, a head past what was read starts over, the older pages follow while it is open, to NFT_COLLECTION_DEEP_PAGES, by the cursor', () => {
    const read = block('async function walletNftCollectionRead(entry, { deeper = false, priority = \'focus\', forList = false } = {}) {');
    expect(read).toContain('limit: NFT_COLLECTION_PAGE, collection: entry.collection || null,');
    expect(read).toContain('endLt: deeper ? entry.cursor : null');
    expect(read).toMatch(/if \(deeper && \(!entry\.cursor \|\| Date\.now\(\) - entry\.at > 2 \* WALLET_MARKET_REFRESH_MS\)\) \{\s+entry\.moreWanted = true;\s+deeper = false;/);
    expect(read, 'a sale gone leaves every read of it [round 87 — C5-4]').toContain('for (const sale of read.sales) if (!live.has(sale)) for (const one of walletNftMarket.collections.values()) one.listings.delete(sale);');
    expect(read, 'every collection\'s pages join their collection\'s').toContain('if (entry.collection === NFT_ALL) walletNftMarket.collections.get(listing.collection)?.listings.set(listing.sale, listing);');
    expect(block('function walletNftCollection(collection) {'), 'seeded with what every collection\'s pages hold of it').toContain('if (listing.collection === collection) entry.listings.set(listing.sale, listing);');
    expect(read).toMatch(/if \(!deeper && entry\.at && read\.more && read\.oldestAt > entry\.newestAt\) \{\s+entry\.listings\.clear\(\);/);
    expect(read).toContain("void walletNftCollectionRead(entry, { deeper: true, priority: pressed || walletNftListInFront(entry) ? 'focus' : 'background' });");
    expect(read).toContain('entry.pages < NFT_COLLECTION_DEEP_PAGES');
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
    expect((entries.match(/walletNftCollectionVerified\(([^)]+)\) !== 'yes'\) continue;/g) ?? []).length).toBe(2);
    expect(block('async function walletNftFindByAddress() {')).toContain('await walletNftVerifyCollections([raw]);');
  });

  it('NFTUI-04: the card and the buy window say every place signed [C1-1]; a listing refused as gone leaves every view, one changed takes its fresh figures [C1-4, C7-9]', () => {
    expect((app.match(/const gram = \(units\) => `\$\{formatUnits\(String\(units\), 9, \{ shown: 9 \}\)\} GRAM`;/g) ?? []).length).toBe(2);
    const buy = block('async function openNftBuyDialog(listing, hold) {');
    expect(buy).toContain("if (error?.code === 'NFT_SALE_GONE') walletNftForgetListing(listing.sale);");
    expect(buy).toContain("else if (error?.code === 'NFT_SALE_CHANGED' && fresh?.live) walletNftTakeListing(fresh);");
    const card = block('function openWalletNftListing(listing, { back = null } = {}) {');
    expect(card).toContain("copied: 'nft.collectionCopied'");
    expect(card).toContain("hero: walletNftHero({ pictures: [...walletNftAthArtOf(listing), ...walletNftPictures(gift, listing.pictureBig, listing.picture)], letter: listing.name || '?', gift,");
    expect(card).toContain('const gift = walletNftGiftOf(listing.collection, listing.uri);');
    expect(card).toContain('...walletNftTraitRows(listing.attributes),');
    expect(card).toContain("openWalletGroup('token', { title, back });");
    const forget = block('function walletNftForgetListing(sale) {');
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
    expect(held, 'an unverified item\'s domain is not drawn either').toContain("domain: item.verified ? item.domain : '' }),");
    expect(held).toContain('...walletNftTraitRows(item.verified ? traits : []),');
    expect(css).toContain('.wallet-nft-hero { position: relative; width: min(100%, 340px); aspect-ratio: 1;');
  });

  it('NFTUI-09: on a phone a collection opens in the wallet\'s window and a listing over it, Back returning to the collection; Settings\' pages still go back to the menu', () => {
    expect(block('function walletNftPick(key) {')).toMatch(/if \(isDesktopLayout\(\)\) walletNftShow\(key\);\s+else openWalletNftCollection\(key\);/);
    expect(block('function walletNftCard(listing, { withCollection = false } = {}) {')).toContain('back: !walletNftMarket.drawnDesktop && from !== undefined ? () => openWalletNftCollection(from, keep) : null');
    expect(block('function openWalletGroup(group, { title = t(\'wallet.groupSettings\'), back = false, also = [] } = {}) {')).toContain("walletGroupBack = typeof back === 'function' ? back : null;");
    expect(app).toContain("document.querySelector('#walletGroupBackButton')?.addEventListener('click', () => (walletGroupBack ? walletGroupBack() : openWalletGroup('menu')));");
  });

  it('NFTUI-10: a picture toncenter keeps no copy of is a gift\'s own from Telegram\'s host, a collection\'s SVG gives way to one of its listings\' pictures, and a card drawn takes a picture a later read brings [2026-10-30: 3 of 144 Stellar Rockets drew their letter]', () => {
    expect(block('function walletNftPictures(gift, ...indexed) {')).toContain('...(gift ? telegramGiftImageSources({ slug: gift.slug, number: gift.number }) : [])');
    const first = block('function paintWalletAssetIconFirst(icon, pictures, { shared = false } = {}) {');
    expect(first).toMatch(/for \(const picture of tried\) \{\s+const url = await walletPicture\(picture, \{ shared \}\);\s+if \(!url\) continue;/);
    const card = block('function walletNftCard(listing, { withCollection = false } = {}) {');
    expect(card).toContain('const pictures = [...walletNftAthArtOf(listing), ...walletNftPictures(walletNftGiftOf(listing.collection, listing.uri), listing.picture)];');
    expect(card).toContain("if (pictures.join(' ') !== held.pictures) { held.pictures = pictures.join(' '); paintWalletAssetIconFirst(held.icon, pictures, { shared: true }); }");
    const row = block('function walletNftPickerRow(entry) {');
    expect(row).toContain('const pictures = [entry.picture, entry.stand].filter(Boolean);');
    expect(block('function walletNftPickerEntries() {')).toContain('entry.stand ||= listing.picture;');
  });

  it('NFTUI-11: "Open in Tonviewer" keeps its card under the outside-link question [round 85 — C7-1]; on a phone a listing\'s Back returns to its collection where it stood — its cards shown, its scroll, the card that opened it [round 85 — C7-2]', () => {
    const explorer = block('function walletNftExplorerButton(address) {');
    expect(explorer, 'not a card\'s door: that closes the card first').not.toContain('walletCardSend(');
    expect(explorer).toContain("button.addEventListener('click', () => activateExternalLink(`${TRADER_EXPLORER_ORIGIN}/${encodeURIComponent(shown)}`));");
    const card = block('function walletNftCard(listing, { withCollection = false } = {}) {');
    expect(card).toContain("const keep = { shown: walletNftMarket.parts?.shown ?? NFT_CARDS_PAGE, scroll: document.querySelector('#walletGroupDialog .wallet-group-body')?.scrollTop ?? 0,");
    expect(card).toContain('() => openWalletNftCollection(from, keep)');
    const open = block('function openWalletNftCollection(key, keep = null) {');
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
    const read = block("async function walletNftCollectionRead(entry, { deeper = false, priority = 'focus', forList = false } = {}) {");
    expect(read).toContain('wanted: forList ? () => listed() || open() : open');
    expect(read).toContain('if (!held && walletNftViewOpen(entry.collection) && entry.hasMore && !entry.failed');
  });

  it('NFTUI-13: a grid drawn again keeps the scroll it stood at — the window\'s on a phone, the pane\'s on a desktop — with the browser\'s anchoring off there [round 86 — C7-1: 4 890 px back to 111-504 within seconds]', () => {
    const paint = block('function walletNftViewPaint() {');
    expect(paint, 'held by script only while a card holds the focus [round 87 — C5-2]').toContain("const scroller = focused ? cards.closest('.wallet-group-body, .wallet-nft-detail') : null;");
    expect(paint.indexOf('const stood = scroller ? scroller.scrollTop : 0;')).toBeLessThan(paint.indexOf('cards.replaceChildren('));
    expect(paint.indexOf('if (scroller && scroller.scrollTop !== stood) scroller.scrollTop = stood;')).toBeGreaterThan(paint.indexOf('?.focus({ preventScroll: true });'));
    expect(css).toMatch(/\.modal-backdrop\.is-nft-view \.wallet-group-body,\s*\.wallet-nft-detail \{ overflow-anchor: none; \}/);
    expect(block('function openWalletNftCollection(key, keep = null) {')).toContain("walletGroupDialog?.classList.add('is-nft-view');");
    expect(block('function fillWalletCard({ picture, letter, title, subtitle, stats, hero = null }) {')).toContain("walletGroupDialog?.classList.remove('is-nft-view');");
  });

  it('NFTUI-14: a name with no picture of its own is drawn as itself — a TON DNS domain on TON\'s blue, in its card, its listing\'s hero and a held one\'s tile [2026-10-30]', () => {
    const face = block('function walletNftDomainFace(icon, pictures, domain) {');
    expect(face).toContain('if (!domain || pictures.length) return;');
    expect(face).toContain("icon.classList.add('is-domain');");
    expect(block('function walletNftCard(listing, { withCollection = false } = {}) {')).toContain('walletNftDomainFace(icon, pictures, listing.domain);');
    expect(block('function walletNftHero({ pictures = [], letter, gift = null, shared = false, domain = \'\', nft = \'\' }) {')).toContain('walletNftDomainFace(still, pictures, domain);');
    expect(block('function walletNftTile(item) {')).toContain('if (verified) walletNftDomainFace(entry.icon, item.picture ? [item.picture] : [], item.domain);');
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
    expect(block('function walletNftViewListings(key) {')).toContain('const listings = walletNftFiltered(key, [...walletNftCollection(key).listings.values()]);');
    expect(css).toContain('.wallet-nft-filter-reset[hidden] { display: none; }');
  });

  it('NFTUI-16: a .ath name\'s art in the market is the profile\'s and the wallet\'s — the indexer\'s whole SVG, read for the names drawn, twenty a call; the registry\'s row is Platho\'s mark [2026-10-30]', () => {
    const art = block('function walletNftAthArtOf(listing) {');
    expect(art).toContain('if (!listing?.nft || !listing.collection || listing.collection !== walletNftRegistryRaw()) return [];');
    const read = block('async function walletNftReadAthArt() {');
    expect(read).toContain('const art = await readUsernameNftArt({ itemAddresses: batch });');
    expect(read).toContain("for (const nft of batch) walletNftKeepAthArt(nft, art.get(nft) ?? '');");
    expect(read, 'a failed read is asked again after a beat [round 88 — C7-2]').toContain('walletNftKeepAthArt(nft, again);');
    expect(block('function walletNftCard(listing, { withCollection = false } = {}) {')).toContain('const pictures = [...walletNftAthArtOf(listing), ...walletNftPictures(');
    expect(block('function walletNftPickerEntries() {')).toContain('entries.get(registry).picture ||= NFT_REGISTRY_PICTURE;');
    expect(app).toContain("const NFT_REGISTRY_PICTURE = '/assets/platho-icon-192.png';");
  });

  it('NFTUI-17: a listing bought here leaves every view at once; the cards on screen are read again each beat by their sales — sold or withdrawn they leave, repriced they take the fresh price [2026-10-30: a bought name stood for sale]', () => {
    const buy = block('async function openNftBuyDialog(listing, hold) {');
    expect(buy.slice(buy.indexOf('if (!values?.sent) return null;')), 'bought here: gone from every view at once').toContain('walletNftForgetListing(listing.sale);');
    const read = block("async function walletNftCollectionRead(entry, { deeper = false, priority = 'focus', forList = false } = {}) {");
    expect(read).toContain('if (!deeper) await walletNftRecheckShown(entry, read.sales, fetchImpl);');
    const recheck = block('async function walletNftRecheckShown(entry, named, fetchImpl) {');
    expect(recheck).toContain('if (parts?.key !== entry.collection || !parts.grid?.isConnected) return;');
    expect(recheck).toContain('if (!fresh?.live) walletNftForgetListing(sale);');
    expect(recheck).toContain('else if (fresh.price !== entry.listings.get(sale)?.price) walletNftTakeListing(fresh);');
    expect(recheck, 'a failed read leaves them for the next beat').toContain('try { now = await readSalesNow({ fetchImpl, origin: toncenterRestOrigin(), sales }); } catch { return; }');
  });

  it('NFTUI-18: the collections\' list keeps its scroll across its paint, a row focused or none — the list\'s own on a desktop, the page\'s on a phone [round 87 — C7-1]; the browser\'s anchoring back when the window closes [C7-5]', () => {
    const paint = block('function walletNftPickerPaint() {');
    expect(paint, 'held by script only while a row holds the focus [round 87 — C5-2]').toContain("const scroller = focused === null ? null : walletNftMarket.drawnDesktop ? picker : picker.closest('.wallet-scroll-content');");
    expect(paint.indexOf('const stood = scroller ? scroller.scrollTop : 0;')).toBeLessThan(paint.indexOf('picker.replaceChildren(...rows);'));
    expect(paint.indexOf('if (scroller && scroller.scrollTop !== stood) scroller.scrollTop = stood;')).toBeGreaterThan(paint.indexOf('?.focus({ preventScroll: true });'));
    expect(block('function closeWalletGroup() {')).toContain("walletGroupDialog.classList.remove('is-nft-view');");
  });

  it('NFTUI-19: the .ath names, Telegram\'s usernames and numbers and TON\'s domains are always in the list, first, named by one read; a search while the list fills says so, not "nothing found"; a search or a filter reads the collection on, to NFT_COLLECTION_SEARCH_PAGES, and says how far [2026-10-30]', () => {
    expect(block('function walletNftPinnedCollections() {')).toContain('return [walletNftRegistryRaw(), ...NFT_PINNED_COLLECTIONS].filter(Boolean);');
    expect(block('async function walletNftNamePinned() {')).toContain('const named = await readCollectionNames({ fetchImpl, origin: toncenterRestOrigin(), collections: unnamed });');
    expect(block('function walletNftPickerEntries() {')).toContain('rank(a) - rank(b) || b.feed - a.feed');
    expect(block('function walletNftPickerPaint() {')).toContain(": filling ? t('nft.collectionsLoading') : t('wallet.swapNothingFound');");
    const read = block("async function walletNftCollectionRead(entry, { deeper = false, priority = 'focus', forList = false } = {}) {");
    expect(read).toContain('|| walletNftSearchReadsOn(entry.collection, entry.pages))) {');
    expect(block('function walletNftSearchReadsOn(key, pages) {'), 'not once the name is found [round 88 — C5-4]').toContain('return walletNftFilterActive(key) && pages < NFT_COLLECTION_SEARCH_PAGES && !walletNftLookupOf(key)?.found;');
    expect(block('function walletNftSearchOn(key) {')).toContain('else void walletNftCollectionRead(entry, { deeper: true });');
    expect(block('function walletNftSearchOn(key) {'), 'a search during a read goes on from it').toContain('if (entry.reading) entry.moreWanted = true;');
    expect(block('function walletNftFilterChanged() {')).toContain('else walletNftSearchOn(key);');
    expect(block('function walletNftViewPaint() {')).toContain(": searching ? t('nft.filterReading', { count: entry.listings.size })");
  });

  it('NFTUI-20: only the view open reads past its head — All collections\' older pages while it is the view, a collection\'s while it is open; the list takes every collection\'s head each beat and says "loading" only while it is read [2026-10-30]', () => {
    const read = block("async function walletNftCollectionRead(entry, { deeper = false, priority = 'focus', forList = false } = {}) {");
    expect(read).toContain('if (!held && walletNftViewOpen(entry.collection) && entry.hasMore && !entry.failed && (entry.moreWanted || entry.pages < NFT_COLLECTION_DEEP_PAGES');
    expect(read, 'no older page outside the view').not.toContain('if (open() && entry.hasMore');
    const start = block('function walletNftViewStart(key) {');
    expect(start).toContain('else if (walletNftViewOpen(key) && entry.hasMore && (entry.pages < NFT_COLLECTION_DEEP_PAGES');
    expect(start).toContain('|| walletNftSearchReadsOn(key, entry.pages))) {');
    expect(start, 'a name let go is asked again as its view opens [round 88 — C5-3]').toContain('walletNftLookupAgain(key);');
    expect(block('function walletMarketTick() {'), '...and every beat').toContain('walletNftLookupAgain(open);');
    expect(block('function walletNftLookupAgain(key) {')).toContain('if (walletNftNameShaped(key, walletNftMarket.filter.q)) walletNftLookupSoon(key);');
    expect(block('function walletNftViewOpen(key) {')).toContain("if (key === NFT_ALL && !walletNftMarket.drawnDesktop && walletNftMarketSeen() && Boolean(walletNftMarket.picker?.isConnected) && !modalOnScreen()) return true;");
    expect(block('function walletNftPickerPaint() {'), 'not at every beat\'s head [round 88 — C5-5]').toContain('const filling = !all.at || (walletNftViewOpen(NFT_ALL) && all.hasMore && all.pages < NFT_COLLECTION_DEEP_PAGES);');
  });

  it('NFTUI-21: a name typed in the .ath names, Telegram\'s usernames and numbers or TON\'s domains is read by its index once the typing rests — whatever its listing\'s age — and taken among the listings; "not on sale" said for it [2026-10-30]', () => {
    expect(block('function walletNftFilterChanged() {')).toContain('if (key && walletNftNameShaped(key, walletNftMarket.filter.q)) walletNftLookupSoon(key);');
    const soon = block('function walletNftLookupSoon(key) {');
    expect(soon).toContain('void walletNftLookupName().finally(() => {');
    expect(soon).toContain('if (walletNftMarket.lookupDue !== due) return;');
    expect(soon.indexOf('walletNftMarket.lookupDue = null;')).toBeLessThan(soon.indexOf('walletNftSearchOn(key);'));
    expect(block("async function walletNftCollectionRead(entry, { deeper = false, priority = 'focus', forList = false } = {}) {")).toContain('const held = walletNftMarket.lookupDue?.key === entry.collection;');
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
    expect(lookup).toContain('for (const listing of listings) entry.listings.set(listing.sale, { ...listing, listedAt: listing.createdAt });');
    const paint = block('function walletNftViewPaint() {');
    expect(paint).toContain('|| walletNftMarket.lookupDue?.key === key || Boolean(lookup?.reading);');
    expect(paint, 'the name\'s answer at once, before the pages\' progress').toContain("cardsNote.textContent = !listings.length && lookup && !lookup.reading && !lookup.found");
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
