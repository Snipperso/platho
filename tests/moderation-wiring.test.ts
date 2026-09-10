import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { I18N_LOCALES, I18N_STRINGS } from '../web/i18n-strings.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// MODERATION WIRING [rebuilt 2026-09-04] — the last inch: the ONE predicate reaches every public surface (the feed,
// the channel screen, the detail comments, the catalogue and its preview, permalinks, and the opener every road
// into a post passes through), the report control sits on the card, the comment row and the detail screen, a
// comment carries its coordinates, the restricted wallet's own client refuses to publish, the standings are read
// with the public sync, every outcome is shown to the person, and the new module is registered wherever a
// runtime module must be. Source gates, deliberately: each is a line a refactor can drop without any behaviour
// test noticing until the feed shows a hidden post.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const app = src('web/app.js');
const between = (from: string, to: string) => {
  const start = app.indexOf(from);
  const end = app.indexOf(to, start);
  expect(start, `anchor present: ${from}`).toBeGreaterThan(-1);
  expect(end, `anchor present after it: ${to}`).toBeGreaterThan(start);
  return app.slice(start, end);
};

describe('MODERATION-WIRING — the predicate reaches every public surface', () => {
  it('MW-01: feed, channel screen, detail comments, item comments, catalogue and its preview, permalink, and the opener itself', () => {
    expect(between('function renderPublicFeed(items, options = {}) {', 'const hiddenOlderCount'))
      .toContain("const allItems = (items ?? []).filter((item) => publicItemVisibleUnderModeration(item, 0));");
    expect(between('function publicChannelViewItems() {', 'function openPublicChannelView('))
      .toContain('item.channelId === publicChannelViewChannelId && publicItemVisibleUnderModeration(item, 0)');
    expect(between('function renderPublicPostDetail() {', 'heading.className'))
      .toContain('publicPostDetailMergedComments().filter((comment) => publicItemVisibleUnderModeration(comment, 1))');
    expect(between('function appendPublicItemComments(article, item, keptList = null) {', 'const commentList'))
      .toContain('.filter((comment) => publicItemVisibleUnderModeration(comment, 1))');
    expect(app).toContain('if (!publicChannelVisibleUnderModeration(channel)) continue;');
    expect(app).toContain('const latest = items.find((candidate) => publicItemVisibleUnderModeration(candidate, 0)) ?? null;');
    const permalink = between('async function openPublicPostFromPermalink(link) {', 'renderPublicSurface({ anchorUnread: false });');
    expect(permalink).toContain('if (!publicItemVisibleUnderModeration(post, 0)) {');
    // the link resolves, so the address bar keeps it (PERMA-09 owns that rule); nothing is opened
    expect(permalink.slice(permalink.indexOf('if (!publicItemVisibleUnderModeration(post, 0)) {'))).not.toContain('clearPublicPostPermalinkFromAddressBar');
    // every road into a post — a shared embed included — passes the guarded opener; only the queue takes the twin
    const opener = between('function openPublicPostDetail(item) {', 'function openPublicPostDetailUnfiltered(item) {');
    expect(opener).toContain("if (!publicItemVisibleUnderModeration(item, 0)) { showModerationStatus(t('moderation.hiddenPost')); return; }");
    expect(opener).toContain('openPublicPostDetailUnfiltered(item);');
    expect(app.split('openPublicPostDetailUnfiltered(').length - 1, 'declared, called by the opener, called by the queue').toBe(3);
    // a shared embed's chain copy passes the predicate; the hidden bits of held rows are applied at the feed merge
    expect(app).toContain("if (!publicItemVisibleUnderModeration(post, 0)) {\n        // the chain copy is hidden by moderation");
    expect(app).toContain('const merged = applyHiddenBitmaps(upsertPublicChainPosts(existing, posts), shardPosts.hidden);');
    const lane = src('web/public-lane.mjs');
    // THE INDEX, ON BOTH READS [round 3]: the bitmap cost the shard's FILL to answer (6,041,335 gas at 4,096
    // entries, measured — six times what a get-method may spend), so the refresh it was built for could not run
    // on a busy shard at all; and the THREAD read never asked for it, so a hidden comment below the newest
    // window stayed visible on any device that already held it.
    expect(lane.split('await provider.getHiddenIds(').length - 1, 'the channel read and the thread read').toBe(2);
    //...and the feed sync tells the lane what it holds for EVERY channel, or the refresh runs only where a
    // snapshot from this session stands — after a reload, nowhere
    expect(app).toContain('knownRange: channel ? publicChannelKnownEntryRange(channel.id) : null,');
    expect(lane).toContain('return { posts, cursors, hasMore, shardsSeen, hidden };');
    expect(src('web/public-shard-ton-rpc-provider.mjs')).toContain("method: 'get_hidden_ids',");
    expect(app).toContain('mergePublicComments(publicPostDetailChainComments, result.comments), result.hidden ?? []);');
    // a truncated index may only ADD a hide, never clear one
    expect(app).toContain('if (!hidden && !answer.complete) return post;');
    //...and the bit survives the feed cache's two mappers (it did not: the feed never saw a hide)
    const subs = src('web/public-channel-subscriptions.mjs');
    expect(subs).toContain('publicHidden: post.hidden === true,');
    expect(subs).toContain('hidden: message.publicHidden === true,');
  });

  it('MW-01C: a delisted channel leaves the catalogue, the queue is one order across its eras, a full shard is said before signing, and the open target agrees with the hide [audit 2026-09-05, round 2]', () => {
    const lane = readFileSync(new URL('../web/public-lane.mjs', import.meta.url), 'utf8');
    // the contract keeps the hidden bit across a beacon re-save so a delisted channel cannot relist itself; the
    // catalogue honours it now instead of mapping every row to a card
    const catalogue = lane.indexOf('async sweepChannelCatalog(');
    expect(catalogue, 'the catalogue reader exists').toBeGreaterThan(-1);
    expect(lane.slice(catalogue, lane.indexOf('async readChannelPosts(', catalogue))).toContain('if (post.hidden === true) { delisted.add(wallet); byWallet.delete(wallet); continue; }');   // round 3: on every seq of the publisher
    // three sweeps, each sorted, were concatenated: last month's 300-report row sat under this month's single one
    // round 3: FIVE eras — a report shard of era e retires at (e+2) eras + 91 days, so eras e-4..e are on chain
    expect(app).toMatch(/moderationQueueRows = \[\.\.\.\(await sweep\(era\)\), \.\.\.\(await sweep\(era - 1\)\), \.\.\.\(await sweep\(era - 2\)\), \.\.\.\(await sweep\(era - 3\)\), \.\.\.\(await sweep\(era - 4\)\)\]\s*\n\s*\.sort\(\(a, b\) => b\.unreviewed - a\.unreviewed \|\| b\.count - a\.count \|\| b\.lastAt - a\.lastAt\);/);
    // a fresh row into a shard at its cap is refused at 13808; the client says so instead of signing and waiting
    expect(app).toContain("if (countBefore === 0 && prices.live && prices.safeCap > 0 && prices.targetCount >= prices.safeCap) {");
    expect(app).toContain("showModerationStatus(t('moderation.reportShardFull'), { ttlMs: 15_000 });");
    // "sending" is shown once the price is settled, not before the premium confirmation
    const report = between('async function submitReport(reason) {', 'const built = await buildReportMessage({ target, reason, nowUnix: reportedAt, value:');
    // (lastIndexOf: the in-flight guard of round 2 says "sending" earlier, about the FIRST report still confirming)
    expect(report.lastIndexOf("showModerationStatus(t('moderation.sending')")).toBeGreaterThan(report.indexOf("t('moderation.reportPriceSubmit')"));
    // the permalink the queue opens is checked against the partition key the preview and the hide used
    expect(between('async function openModerationTarget(row) {', 'const composite = row.target.generation === 17'))
      .toContain('if (BigInt(expectedKey) !== BigInt(row.partitionKey)) { showModerationStatus(t(\'moderation.previewUnavailable\')); return; }');
  });

  it('MW-01B: the queue can lift what it can impose, the report reads the row before it prices it, and no two elements in the document share an id', () => {
    // AN EXPLICIT RESTRICT CLEARS `auto` [round 3]: no number of unwarns lifts it, and until this row existed no
    // shipped surface could send action 5 at all — a restriction, including a mistaken one, was permanent.
    expect(app).toContain("[t('moderation.unrestrict'), () => sendWalletVerdict(row, VERDICT_ACTION.UNRESTRICT_WALLET)],");
    for (const caption of ['moderation.warn', 'moderation.unwarn', 'moderation.restrict', 'moderation.unrestrict']) {
      expect(Object.keys(I18N_STRINGS.en)).toContain(caption);
    }
    // the price of a REPEAT is the shard's flat figure, and the row is read before the message is built
    expect(app).toContain('const countBefore = await reportRowCount(fresh, draft.to, draft.key, target.partitionKey);');
    expect(app).toContain('value: reportAttachValue(prices, countBefore > 0)');
    expect(src('web/moderation.mjs')).toContain('if (repeat && prices.live && prices.repeatValue) return prices.repeatValue;');
    // the gate address is normalised to the raw form every derivation demands
    expect(src('web/moderation.mjs')).toContain('try { return addrKey(configured); } catch { return null; }');
    // ONE ELEMENT PER ID [round 3]: two carried id="moderationQueueStatus", so querySelector answered the first —
    // the profile button's badge, behind the open dialog — and every line the queue wrote went nowhere a reader
    // could see it. This holds for the whole document, not just that pair.
    const ids = [...src('web/index.html').matchAll(/\sid="([A-Za-z0-9_-]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(100);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i), 'ids used twice').toEqual([]);
  });

  it('MW-02: the predicate — own words always, a device mute, the row\'s hidden bit, the author\'s standing; nothing folded from a log', () => {
    const fn = between('function publicItemVisibleUnderModeration(item, kind = 0) {', 'function publicChannelVisibleUnderModeration(channel) {');
    expect(fn).toContain('if (wallet && isOwnPublicAuthor(wallet)) return true;');
    expect(fn).toContain('if (wallet && localMuteStore.has(wallet)) return false;');
    expect(fn).toContain('if (item?.hidden === true) return false;');
    expect(fn).toContain('return !(wallet && moderationRuntime?.sanctions?.isRestricted(wallet));');
    expect(app).not.toContain('createModerationState(');
    expect(app).not.toContain('isTargetHidden(');
    // the hidden bit rides the feed item from the row, the cache keeps it, the comment carries its coordinates
    expect(app).toContain('hidden: sp.hidden === true,');
    expect(src('web/public-channel-subscriptions.mjs')).toContain('hidden: post.hidden === true,');
    const comment = between('async function publicThreadPostsToComments(item, threadPosts, hashMemo = null) {', 'const comments = assemblePublicParts(commentParts);');
    for (const line of ['shardEntryId: tp.entry_id === undefined || tp.entry_id === null ? null : String(tp.entry_id),', 'threadShardSeq: tp.thread_seq ?? null,',
      'epochTag: tp.thread_epoch_tag ?? null,', 'generation: tp.thread_generation ?? null,', 'partitionKey: tp.thread_pk ?? null,', 'hidden: tp.hidden === true,']) {
      expect(comment).toContain(line);
    }
    //...which the lane's thread reader stamps on every row, fresh or from a snapshot
    const lane = src('web/public-lane.mjs');
    expect(lane).toContain("coordOf.set(addrKey(address), { thread_pk: String(threadPk), thread_epoch_tag: String(epochTag), thread_seq: seq, thread_generation: generation });");
    expect(lane).toContain('const stampedPosts = shardPosts.map((post) => ({ ...post, ...where, shard_key: key }));');
    expect(lane).toContain('posts.push(...snapshot.posts.map((post) => (post.shard_key && post.thread_pk ? post : { ...post, ...where, shard_key: key })));');
    // the coordinates take the kind from the epoch tag, never from the caller
    const coords = between('function publicItemCoordinates(item, kind = null) {', 'function publicItemAuthor(item) {');
    expect(coords).toContain('const tagKind = Number(tag >> 32n);');
    expect(coords).toContain('if (kind !== null && kind !== tagKind) return null;');
    expect(coords).toContain('const shardSeq = item?.threadShardSeq ?? item?.channelShardSeq ?? derived?.shardSeq ?? null;');
  });

  it('MW-03: the report control sits on the post card, the comment row and the detail screen; off on your own words and before the gate exists', () => {
    const actions = between('function appendPublicItemActions(article, item) {', "// \"Private chat\"");
    expect(actions).toContain('if (!isOwnPost && moderationSupported() && publicItemCoordinates(item, 0)) {');
    expect(actions).toContain("reportButton.addEventListener('click', () => openReportDialog(item, 0));");
    expect(between('function buildPublicCommentRow(comment, surfacing) {', 'function appendPublicItemComments(')).toContain('appendRowReportButton(row, comment);');
    const rowButton = between('function appendRowReportButton(row, comment) {', 'function appendDetailReportButton(postNode, item) {');
    expect(rowButton).toContain('if (!moderationSupported() || !publicPostDetailItem) return;');
    expect(rowButton).toContain('openReportDialog(comment, 1, publicPostDetailItem);');
    expect(between('function renderPublicPostDetail() {', 'heading.className')).toContain('appendDetailReportButton(post, publicPostDetailItem);');
    const detail = between('function appendDetailReportButton(postNode, item) {', 'function renderModerationNotice() {');
    expect(detail).toContain("if (!moderationSupported() || !item || isOwnPublicAuthor(publicItemAuthor(item)) || !publicItemCoordinates(item, 0)) return;");
  });

  it('MW-04: a report pays the shard\'s OWN price at its fill plus the cushion, asserted before signing; every outcome is shown', () => {
    const fn = between('async function submitReport(reason) {', 'function appendRowReportButton(row, comment) {');
    expect(fn).toContain("if (!plathoWallet?.address) { showModerationStatus(t('moderation.walletRequired')); return; }");
    expect(fn).toContain('const prices = await reportShardPrices(fresh, draft.to);');
    expect(fn).toContain('value: reportAttachValue(prices, countBefore > 0)');
    // green means chain: the row's count must move before the report is called sent
    expect(fn).toContain('const seen = await awaitModerationEffect(async () => (await reportRowCount(fresh, built.to, built.key, target.partitionKey)) > countBefore);');
    expect(fn).toContain("showModerationStatus(t(seen ? 'moderation.sent' : 'moderation.unconfirmed'), { ttlMs: seen ? 6000 : 15_000 });");
    expect(fn).toContain('const { cushion } = await applyShardSurcharge(LANE_REPORT, prepared, {});');
    expect(fn).toContain('const reportNeed = built.value + cushion + surchargeExtraNanotons({ prepared, budgeted: [built.value], cushion })');
    expect(fn).toContain("await assertWalletGramAtLeast(reportNeed, 'report');");
    expect(fn).toContain("showModerationStatus(t('moderation.sendFailed', { error: error?.message ?? String(error) }), { ttlMs: 12_000 });");
    // the status is a line the person sees, not a console line
    const status = between('function showModerationStatus(text, { ttlMs = 6000 } = {}) {', 'function openReportDialog(item, kind, parentPost = null) {');
    expect(status).toContain('moderationNotice.textContent = text;');
    expect(status).toContain('moderationNotice.hidden = !text;');
  });

  it('MW-05: a restricted wallet refuses its own public posts and comments, and the notice says why, with the limit', () => {
    expect(app.split('assertNotRestrictedForPublicPublishing();').length - 1, 'the post and the comment send sites').toBe(2);
    expect(app.split('await assertNotRestrictedForPublicPublishing();').length - 1, 'both sites await the guard').toBe(2);
    const gate = between('async function assertNotRestrictedForPublicPublishing() {', 'function moderationTextRow(text) {');
    expect(gate).toContain("error.code = 'PLATHO_MODERATION_RESTRICTED';");
    expect(gate).toContain('await runtime.sanctions.lookup([wallet]);');   // the chain is asked for THIS wallet first
    expect(gate).toContain('if (runtime.sanctions.isRestricted(wallet)) {');
    const notice = between('function renderModerationNotice() {', 'function assertNotRestrictedForPublicPublishing() {');
    expect(notice).toContain("text = t('moderation.restrictedBanner');");
    expect(notice).toContain("text = t('moderation.warningBanner', { count: warnings, limit: WARNINGS_TO_RESTRICT });");
    expect(notice).toContain('moderationQueueButton.hidden = !(wallet && moderationRuntime?.moderatorFor?.get(publicAddrKey(wallet))?.seat === true);');
    // the author's own hidden post is badged
    expect(app).toContain("const hiddenBadge = item.hidden === true && isOwnPublicAuthor(item.authorWallet) ? t('moderation.hiddenBadge') : null;");
  });

  it('MW-06: the standings are read at the head of every public sync for the authors on screen, fail-open and loud; the banner follows every render', () => {
    expect(between('async function syncPublicChannelsRun() {', 'const syncedFromChain')).toContain('await refreshModeration();');
    const refresh = between('async function refreshModeration() {', 'function publicItemCoordinates(item, kind = null) {');
    expect(refresh).toContain('await runtime.sanctions.lookup(moderationAuthorsOnScreen());');
    const authors = between('function moderationAuthorsOnScreen() {', 'async function refreshModeration() {');
    for (const line of ['add(plathoWallet?.address);', 'for (const item of publicSurfaceItems()) add(publicItemAuthor(item));',
      'for (const channel of publicChannelRegistry) add(channel?.authorWallet ?? channel?.author_wallet);',
      'for (const channel of publicDiscoveryResults ?? []) add(channel?.authorWallet ?? channel?.author_wallet);',
      'if (publicPostDetailOpen) for (const comment of publicPostDetailMergedComments()) add(publicItemAuthor(comment));']) {
      expect(authors, 'every surface\'s authors enter the lookup').toContain(line);
    }
    expect(refresh).toContain('await refreshModerationLedger(runtime);');
    // the ledger is read from the gate, both halves or neither, and again before every verdict (a handover lands without a release)
    const ledger = between('async function refreshModerationLedger(runtime, { force = false } = {}) {', 'async function refreshModeration() {');
    expect(ledger).toContain('const ledgerAddress = await runtime.reader.ledgerOf(runtime.gateAddress);');
    expect(ledger).toContain('runtime.ledgerReadAt = Date.now();');
    expect(between('async function sendVerdict(', 'async function sendEntryVerdict(row, action) {')).toContain('await refreshModerationLedger(runtime, { force: true });');
    // the runtime goes with the wallet
    expect(between("function clearWalletScopedRuntimeState(reason = 'wallet changed') {", 'privateSendRetryJobs.clear();')).toContain('moderationRuntime = null;');
    expect(refresh).toContain("console.warn('[moderation] refresh failed; the last answers stay', error);");
    expect(between('function renderPublicSurface(options = {}) {', '\n}\n')).toContain('renderModerationNotice();');
    // the transport is resolved per call, never closed over (an API key change replaces the global)
    const runtime = between('function moderationRuntimeFor() {', 'function moderationAuthorsOnScreen() {');
    expect(runtime).toContain('const transport = moderationTransport();');
    expect(runtime).not.toContain('createModerationLedgerReader((call) => transport.runGetMethod(call))');
  });

  it('MW-07: the module is registered everywhere a runtime module must be, the two lanes ship at the seal, the gate is the config constant', () => {
    expect(src('web/sw.js')).toMatch(/'\.\/moderation\.mjs\?v=\d+'/);
    expect(src('scripts/prepare_static_web_deploy.mjs')).toContain("'moderation.mjs',");
    expect(src('scripts/generate_shard_code.mjs')).toMatch(/const SHARDS_18 = \[[^\]]*'ReportShard', 'SanctionShard'/);
    expect(src('web/shard-address.mjs')).toContain('report: {},');
    expect(src('web/shard-address.mjs')).toContain('sanction: {},');
    expect(src('web/platho-config.mjs')).toContain('moderationGate: {');
    expect(src('web/platho-config.mjs')).not.toContain('moderationLedger: {');
    expect(src('web/index.html')).toContain('id="reportPostDialog"');
    expect(src('web/index.html')).toContain('id="moderationQueueDialog"');
    expect(src('web/index.html')).toContain('id="moderationNotice"');
    expect(src('web/index.html')).toContain('id="moderationQueueButton"');
    // the device-local mute lives in the channel's about card, never on your own channel, and repaints the catalogue
    expect(app).toContain("muteButton.textContent = t(localMuteStore.has(authorWallet) ? 'moderation.unmute' : 'moderation.mute');");
    expect(app).toContain('if (publicDiscoveryOpen) renderPublicDiscovery();');
    // the queue: previews, a review mark, the composite id minted as the feed mints it
    const queue = between('function renderModerationQueue() {', 'async function moderationEntryOf(row) {');
    expect(queue).toContain("[t('moderation.dismiss'), () => sendReviewVerdict(row)],");
    expect(between('async function sendReviewVerdict(row) {', 'function appendPublicItemActions(article, item) {')).toContain('const seen = await sendVerdict({ action: VERDICT_ACTION.REVIEW_REPORT, shard: row.shard, key: BigInt(row.rowKey), extra,');
    expect(queue).toContain('void moderationEntryPreview(row).then((line) => { preview.textContent = line; })');
    expect(queue).toContain("[t('moderation.unwarn'), () => sendWalletVerdict(row, VERDICT_ACTION.UNWARN_WALLET)],");
    // a pre-flip row has no hide door: the queue offers no hide, and the send refuses before any money moves
    expect(queue).toContain('const canHide = row.target.generation >= MODERATION_GENERATION && row.target.kind !== 3;');   // round 3: no hide door for a picture
    expect(between('async function sendEntryVerdict(row, action) {', 'async function moderationWalletStanding(runtime, wallet) {'))
      .toContain("if (row.target.generation < MODERATION_GENERATION) { showModerationStatus(t('moderation.cannotHideOld')); return; }");
    // previews load lazily past the first few, and the queue pages
    expect(queue).toContain('if (i < MODERATION_QUEUE_EAGER_PREVIEWS) loadPreview();');
    expect(queue).toContain("more.textContent = t('moderation.more', { count: rows.length - upTo });");
    expect(src('web/index.html')).toContain('id="moderationQueueStatus"');
    // a verdict is checked against the chain before it is sent: a refused forward bounces into the gate (measured)
    const entryVerdict = between('async function sendEntryVerdict(row, action) {', 'async function moderationWalletStanding(runtime, wallet) {');
    expect(entryVerdict).toContain("if (!entry?.exists) { showModerationStatus(t('moderation.entryMissing')); return; }");
    expect(entryVerdict).toContain("if (entry.hidden === wantHidden) { showModerationStatus(t('moderation.alreadySo')); return; }");
    expect(entryVerdict).toContain("confirm: async () => (await moderationEntryOf(row))?.hidden === wantHidden });");
    const open = between('async function openModerationTarget(row) {', 'async function sendVerdict(');
    expect(open).toContain('const composite = row.target.generation === 17');
    expect(open).toContain('openPublicPostDetailUnfiltered(post);');
    expect(src('web/public-lane.mjs')).toContain('async readEntryAt({ generation, partitionKey, epochTag, entryId, window = 1 }) {');
  });

  it('MW-08: every moderation string exists in every locale, with the same placeholders as English', () => {
    const en = I18N_STRINGS.en as Record<string, string>;
    const keys = Object.keys(en).filter((k) => k.startsWith('moderation.') || k === 'dialog.reportPost' || k === 'dialog.reportPostHint'
      || k === 'dialog.moderationQueue' || k === 'dialog.moderationQueueHint' || k === 'profile.moderationQueue'
      || k.startsWith('public.react') || k === 'public.walletRequiredToReact');   // the reaction strings too [audit 2026-09-05, round 2]
    expect(keys.length).toBeGreaterThanOrEqual(48);
    for (const k of ['moderation.dismiss', 'moderation.hiddenBadge', 'moderation.previewUnavailable', 'moderation.queueNew']) expect(keys).toContain(k);
    expect(en['moderation.warningBanner']).toContain('{limit}');
    for (const { code: locale } of I18N_LOCALES as any[]) {
      const table = (I18N_STRINGS as any)[locale] as Record<string, string>;
      for (const key of keys) {
        expect(typeof table[key], `${locale}: ${key}`).toBe('string');
        const placeholders = (s: string) => (s.match(/\{[a-z]+\}/g) ?? []).sort().join(',');
        expect(placeholders(table[key]), `${locale}: ${key} placeholders`).toBe(placeholders(en[key]));
      }
    }
  });
});
