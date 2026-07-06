import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// PUBLIC publish heal/confirm driver guards (owner symmetric-case audit 2026-07-02).
// Before v633 the heal/confirm machinery (fresh-variant re-broadcast ladder, age terminals, resume) was
// attached ONLY to private thread messages (+ avatars): a public post/comment that produced a 2nd external
// had it DEFERRED (v623) with nobody to POST it — never delivered — and its orphaned nonce poisoned the
// publish-nonce floor for every later send of the tab. These guards pin the symmetric driver in place.
describe('public publish heal driver guard', () => {
  const app = readFileSync('web/app.js', 'utf8');
  const css = readFileSync('web/styles.css', 'utf8');

  it('PWA-PUBLIC-HEAL-01: the public confirm driver exists and reuses the private core', () => {
    expect(app).toMatch(/const publicPublishConfirmJobs = new Map\(\)/);
    expect(app).toMatch(/function startPublicPublishConfirmation\(record\)/);
    expect(app).toMatch(/async function runPublicPublishConfirmationPass\(job\)/);
    // The pass reuses the SAME idempotent core as private sends: the fresh-variant heal ladder (<=1 sendBoc
    // per pass — the v630 serial-pump lesson reused as code) and the CapsuleHub confirm.
    const pass = app.slice(app.indexOf('async function runPublicPublishConfirmationPass'), app.indexOf('function resumePendingPublicPublishConfirmations'));
    expect(pass).toMatch(/retryUnconfirmedVaultPublishBroadcasts\(publishState, \{/);
    expect(pass).toMatch(/confirmCapsuleHubPublishEntries\(publishState, \{/);
    expect(pass).toMatch(/owner: resolvePublishOwner\(publishState\)/);
    // Same cadence engine as private (settle/active/unlanded/stretch + 429 backoff) via the shim.
    expect(pass).toMatch(/privatePublishConfirmDelayMs\(\{ publishState, createdAtMs: job\.createdAt \}, passError\)/);
  });

  it('PWA-PUBLIC-HEAL-02: age terminals fire BEFORE any RPC (no post-offline storm) with the shared constants', () => {
    const pass = app.slice(app.indexOf('async function runPublicPublishConfirmationPass'), app.indexOf('function resumePendingPublicPublishConfirmations'));
    // v648: the no-progress terminal is the part-count-scaled helper (shared with the private drivers).
    const terminalIndex = pass.indexOf('publishConfirmNoProgressDeadlineMs(publishState)');
    const rpcIndex = pass.indexOf('retryUnconfirmedVaultPublishBroadcasts');
    expect(terminalIndex).toBeGreaterThan(-1);
    expect(rpcIndex).toBeGreaterThan(terminalIndex);
    expect(pass).toMatch(/PRIVATE_PUBLISH_CONFIRM_BROADCAST_FAIL_AFTER_MS/);
    expect(pass).toMatch(/publishStateBroadcastIsFailing\(publishState\)/);
    expect(pass).toMatch(/publishStatus: 'public publish failed'/);
  });

  it('PWA-PUBLIC-HEAL-03: submit paths start the driver and resume runs alongside the private one', () => {
    // Posts (PARTIAL + SUBMITTED) and comments both wire the driver with the local record reference.
    expect(app.match(/startPublicPublishConfirmation\(\{ \.\.\.(ref|partialRef|submittedRef), kind: '(post|comment)'/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(app).toMatch(/return \{ channelId, localId \};/);
    expect(app).toMatch(/return \{ channelId, localId: commentLocalId \};/);
    // Resume-on-reload is wired at every private resume hook.
    expect(app.match(/resumePendingPublicPublishConfirmations\(\);/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
    expect(app).toMatch(/function resumePendingPublicPublishConfirmations\(\)/);
  });

  it('PWA-PUBLIC-HEAL-04: driver state is persisted back into the feed cache and stops on merge', () => {
    // Each pass write-backs the LIVE publishState (feed syncs rebuild the cache via safeClone, detaching refs).
    expect(app).toMatch(/function persistPublicPublishProgress\(job, patch = \{\}\)/);
    // Persist always writes the cache; the repaint is the status-only fast path (patch the badge in place,
    // scroller untouched) with the full renderPublicSurface as the structural fallback (see PWA-CHAT-SCROLL-01).
    expect(app).toMatch(/writePublicChannelFeedCache\(publicChannelStorage\(\), publicChannelFeedCache\);/);
    expect(app).toMatch(/if \(!patchPublicPublishBadgesInPlace\(job, patchedItem\)\) renderPublicSurface\(\{ anchorUnread: false \}\);\s*return located;/);
    // A record that merged with its on-chain twin (or vanished) stops the driver quietly.
    expect(app).toMatch(/if \(!located \|\| !isPendingPublicFeedItem\(located\.item\)\) \{\s*stopPublicPublishConfirmation\(job\);/);
    // Account switch clears public jobs like private ones.
    expect(app).toMatch(/publicPublishConfirmJobs\.clear\(\);/);
  });

  it('PWA-PUBLIC-HEAL-05: pending badge is CSS-class based (prod CSP bans inline styles) and the dead option is gone', () => {
    expect(app).toMatch(/public-publish-status--failed/);
    expect(css).toMatch(/\.public-publish-status \{/);
    expect(css).toMatch(/\.public-publish-status--failed \{/);
    expect(app).not.toMatch(/style\s*=\s*["'`][^"'`]*public-publish/);
    // confirmFinalNonce has been dead since v616 (shouldConfirmVaultPublishNonceAfterSend ignores options) —
    // the public driver owns final-batch confirmation now.
    const publicParts = app.slice(app.indexOf('async function publishPublicPayloadParts'), app.indexOf('async function createPublicPayloadParts'));
    expect(publicParts).not.toMatch(/confirmFinalNonce\s*:/);
  });

  it('PWA-PUBLIC-HEAL-06: composer parity with private — instant clear, optimistic insert, live private-style status', () => {
    // The composer empties the moment send is pressed (BEFORE the await), and a user-cancel restores the draft.
    const handlerStart = app.indexOf("publicComposer?.addEventListener('submit'");
    const handler = app.slice(handlerStart, handlerStart + 4000);
    const clearIndex = handler.indexOf("publicMessageInput.value = '';");
    const awaitIndex = handler.indexOf('await submitPublic');
    expect(clearIndex).toBeGreaterThan(-1);
    expect(clearIndex).toBeLessThan(awaitIndex);
    expect(handler).toMatch(/publicMessageInput\.value = text;/);
    // Both submit paths insert the optimistic record with a streaming private-style status and patch the SAME
    // record on result (never a second insert).
    expect(app.match(/publishStatus: 'sending',\s*publishState: null,/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(app.match(/persistPublicPublishProgress\(\{ \.\.\.ref, publishState \}, \{ publishStatus: publishStateMeta\(publishState\) \|\| 'sending' \}\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(app.match(/removeLocalPublicPendingRecord\(ref\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    // The feed badge shows the SAME status strings as private messages (publishStateMeta off the live state).
    expect(app).toMatch(/\(item\.publishState \? publishStateMeta\(item\.publishState\) : null\) \|\| item\.publishStatus/);
    // Persisted publishState is variant-stripped (the ~16×47KB BoCs stay in-memory only).
    expect(app).toMatch(/const persistedState = publishStateForHistory\(job\.publishState\)/);
  });

  it('PWA-PUBLIC-HEAL-07: optimistic author label matches the chain twin + comments show the status badge', () => {
    // No placeholder 'you' on own optimistic records — the same label the sync assigns (username / short wallet).
    expect(app).not.toMatch(/author: 'you'/);
    expect(app.match(/author: publicAuthorLabel\(plathoWallet\?\.address\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    // The comment renderer shows the SAME live private-style status badge as feed posts.
    const commentRenderer = app.slice(app.indexOf('function appendPublicItemComments'), app.indexOf('function appendPublicItemComments') + 2200);
    expect(commentRenderer).toMatch(/isPendingPublicFeedItem\(comment\) && comment\.publishStatus/);
    expect(commentRenderer).toMatch(/\(comment\.publishState \? publishStateMeta\(comment\.publishState\) : null\) \|\| comment\.publishStatus/);
    // The open post-detail screen refreshes on every progress write-back.
    expect(app).toMatch(/if \(publicPostDetailOpen\) renderPublicPostDetail\(\);/);
  });

  it('PWA-PUBLIC-HEAL-08: post-detail comments are cached stale-while-revalidate (no re-download flash)', () => {
    // A per-post SWR cache keyed by channel+entryId; reopening paints cached comments before the background load.
    expect(app).toMatch(/const publicPostCommentsCache = new Map\(\)/);
    expect(app).toMatch(/const cacheKey = publicPostCommentsCacheKey\(item\);\s*const cached = publicPostCommentsCache\.get\(cacheKey\);/);
    expect(app).toMatch(/publicPostDetailLoadState = publicPostDetailChainComments\.length > 0 \? 'ready' : 'loading';/);
    // A fresh authoritative (non-degraded) load populates the cache (bounded LRU) — a degraded read must NOT.
    const refresh = app.slice(app.indexOf('async function refreshPublicPostDetailComments'), app.indexOf('async function refreshPublicPostDetailComments') + 3200);
    expect(refresh).toMatch(/if \(cacheKey\) \{[\s\S]*publicPostCommentsCache\.set\(cacheKey, \{ comments: result\.comments/);
    expect(refresh).toMatch(/while \(publicPostCommentsCache\.size > 24\)/);
    // Cleared on account switch alongside the other public state.
    expect(app).toMatch(/publicPostCommentsCache\.clear\(\);/);
  });

  it('PWA-PUBLIC-HEAL-09: public entry BODIES persist per-entry + unconditionally (the private-message model — no body re-download on reload)', () => {
    // A per-ENTRY durable BoC store hooked into resolvePublicEntryPayload — the single funnel every public body
    // reader (feed sync, post detail, avatar payloads) goes through. Hash-pinned: a hit is accepted only when the
    // stored body_hash matches the entry's on-chain hash (bodies are immutable, so a match is authoritative).
    expect(app).toMatch(/const publicEntryBodyStorePromise = \(\(\) => \{/);
    expect(app).toMatch(/scopedIndexedDbName\('platho-public-entry-bodies-v1'\)/);
    expect(app).toMatch(/async function readCachedPublicEntryBody\(entryId\)/);
    expect(app).toMatch(/async function writeCachedPublicEntryBody\(entryId, bodyBoc, bodyHashHex\)/);
    const funnel = app.slice(app.indexOf('async function resolvePublicEntryPayload'), app.indexOf('async function resolvePrivateEntryBody'));
    const readIdx = funnel.indexOf('const cachedBody = await readCachedPublicEntryBody(entry?.entry_id);');
    const chainIdx = funnel.indexOf('await provider.resolvePublicEntryBody(entry, {');
    const writeIdx = funnel.indexOf('writeCachedPublicEntryBody(entry.entry_id, hydrated.body_boc, entryBodyHashHex);');
    expect(readIdx).toBeGreaterThan(-1);
    expect(chainIdx).toBeGreaterThan(-1);
    expect(readIdx).toBeLessThan(chainIdx); // durable read precedes the ~32KB live body read
    expect(writeIdx).toBeGreaterThan(chainIdx); // live resolve persists unconditionally (fire-and-forget)
    expect(funnel).toMatch(/cachedBody\.body_hash === entryBodyHashHex/); // hash-pinned hit
    // The cached path re-parses through the SAME pipeline as a live read (zero decode drift).
    expect(funnel).toMatch(/hydrated = \{ \.\.\.entry, body_boc: cachedBody\.body_boc \};/);
    // A degraded detail load still persists the assembled snapshot (accumulate-never-wipe) with latestLink=null.
    const refresh = app.slice(app.indexOf('async function refreshPublicPostDetailComments'), app.indexOf('async function refreshPublicPostDetailComments') + 3600);
    expect(refresh).toMatch(/writeCachedPublicComments\(cacheKey, durablePartial, publicPostDetailParentExists === true, null\)/);
    // The detail unions BOTH real comment sources: feed-sync (author-indexed legacy comments — chain forensics
    // 2026-07-02: every pre-fix comment has parent_link=0, invisible to get_public_parent_index forever) and the
    // parent-index walk (post-fix comments). Chain/durable copies win collisions (they carry the image data URL).
    const merged = app.slice(app.indexOf('function publicPostDetailMergedComments'), app.indexOf('function publicPostDetailMergedComments') + 1800);
    expect(merged).toMatch(/return mergePublicComments\(cached, chain\);/);
  });
});

describe('public publish manual retry', () => {
  const app = readFileSync('web/app.js', 'utf8');
  const css = readFileSync('web/styles.css', 'utf8');

  it('PWA-PUBLIC-HEAL-10: a terminaled public publish retries from its badge (nonce-floor escape without reload)', () => {
    // The FAILED badge itself is the affordance (owner rule: no extra Retry/Dismiss buttons) — clickable +
    // keyboard-accessible, and inert when nothing was ever signed (no publishState = nothing to re-broadcast).
    expect(app).toMatch(/function retryPublicPublishFromUi\(item, kind\)/);
    expect(app).toMatch(/function wirePublicPublishRetryBadge\(statusBadge, item, kind\)/);
    expect(app).toMatch(/if \(!String\(item\?\.publishStatus \?\? ''\)\.endsWith\('failed'\) \|\| !item\?\.publishState\) return;/);
    // Both badge render sites (feed post + comment) wire it.
    expect(app).toMatch(/wirePublicPublishRetryBadge\(statusBadge, item, 'post'\);/);
    expect(app).toMatch(/wirePublicPublishRetryBadge\(statusBadge, comment, 'comment'\);/);
    // The retry mirrors the private already-signed branch: re-arm the broadcast budget on the SAME persisted
    // publishState (same-nonce re-broadcast is idempotent) + a FRESH driver job so the scaled age terminal
    // opens a new window.
    const retry = app.slice(app.indexOf('function retryPublicPublishFromUi'), app.indexOf('function wirePublicPublishRetryBadge'));
    expect(retry).toMatch(/resetPublishBroadcastBudgetForManualRetry\(item\.publishState\);/);
    expect(retry).toMatch(/startPublicPublishConfirmation\(\{ channelId, localId, kind, createdAt: Date\.now\(\), publishState: item\.publishState \}\);/);
    // Visual affordance is a CSS class (prod CSP bans inline styles).
    expect(css).toMatch(/\.public-publish-status--retryable \{/);
  });
});

describe('public comment parent_link publish wiring', () => {
  // Chain forensics (2026-07-02, mainnet probe): EVERY public entry since genesis had parent_link=0 and
  // get_public_parent_index(entryId) returned exists=false for all posts — comments were silently published as
  // top-level posts because publishItemToBatchPart DROPPED parent_entry_id from the public part mapping. These
  // tests pin the full client pipeline: draft -> batch part -> part cell bits the contract actually reads.
  it('PWA-PUBLIC-PARENT-01: publishItemToBatchPart carries the comment parent and the part cell encodes parent_link=parentEntryId+1', async () => {
    const [{ buildBatchPublishPartCell, tonCell }, { publishItemToBatchPart }, { Cell }] = await Promise.all([
      import('../web/pwa-contract-transactions.mjs'),
      import('../web/publish-batch-orchestration.mjs'),
      import('@ton/core'),
    ]);
    const headerCell = tonCell.snakeCellFromBytes(new Uint8Array([1, 2, 3]), 'header');
    const bodyCell = tonCell.snakeCellFromBytes(new Uint8Array([4, 5, 6]), 'body');
    const asPayload = (cell) => ({ boc: tonCell.bytesToBase64(tonCell.serializeBoc(cell)) });
    const draft = (parentEntryId) => ({
      publish: {
        publish_kind: 1n,
        size_class: 1n,
        header_hash: '0x' + '11'.repeat(32),
        body_hash: '0x' + '22'.repeat(32),
        header_cell: asPayload(headerCell),
        body_cell: asPayload(bodyCell),
        ...(parentEntryId === undefined ? {} : { parent_entry_id: parentEntryId }),
      },
    });
    const parentLinkOf = (item) => {
      const part = publishItemToBatchPart(item, 'public');
      const cell = Cell.fromBoc(Buffer.from(tonCell.serializeBoc(buildBatchPublishPartCell(part))))[0];
      const s = cell.beginParse();
      s.loadUint(8); s.loadUint(8); // size_class, reserved
      return s.loadUintBig(64); // parent_link — the exact field CapsuleHub loads at part.loadUint(64)
    };
    // A comment on entry 3 -> parent_link 4 (entryLink convention, parent indexed on-chain).
    expect(parentLinkOf(draft(3n))).toBe(4n);
    // Entry 0 stays unambiguous: a comment on entry 0 -> parent_link 1.
    expect(parentLinkOf(draft(0n))).toBe(1n);
    // A post (no parent) -> parent_link 0 (author-indexed).
    expect(parentLinkOf(draft(undefined))).toBe(0n);
  });

  it('PWA-PUBLIC-PROFILE-01: the publish draft->part->cell pipeline carries is_profile into reserved bit0 (clean-11), default 0', async () => {
    // Exercise the REAL mapper publishItemToBatchPart (NOT buildBatchPublishPartCell in isolation): the is_profile
    // bit was dropped here (same field-drop class as parent_entry_id in PWA-PUBLIC-PARENT-01), so the profile-pointer
    // reserved byte silently stayed 0. This pins the mapper end-to-end into the exact cell bits the contract reads.
    const [{ buildBatchPublishPartCell, tonCell }, { publishItemToBatchPart }, { Cell }] = await Promise.all([
      import('../web/pwa-contract-transactions.mjs'),
      import('../web/publish-batch-orchestration.mjs'),
      import('@ton/core'),
    ]);
    const headerCell = tonCell.snakeCellFromBytes(new Uint8Array([1, 2, 3]), 'header');
    const bodyCell = tonCell.snakeCellFromBytes(new Uint8Array([4, 5, 6]), 'body');
    const asPayload = (cell) => ({ boc: tonCell.bytesToBase64(tonCell.serializeBoc(cell)) });
    const draft = (isProfile) => ({
      publish: {
        publish_kind: 1n,
        size_class: 1n,
        header_hash: '0x' + '11'.repeat(32),
        body_hash: '0x' + '22'.repeat(32),
        header_cell: asPayload(headerCell),
        body_cell: asPayload(bodyCell),
        ...(isProfile === undefined ? {} : { is_profile: isProfile }),
      },
    });
    const reservedOf = (item) => {
      const part = publishItemToBatchPart(item, 'public');
      const cell = Cell.fromBoc(Buffer.from(tonCell.serializeBoc(buildBatchPublishPartCell(part))))[0];
      const s = cell.beginParse();
      s.loadUint(8); // size_class
      return s.loadUint(8); // reserved — the exact byte CapsuleHub/Vault load at part.loadUint(8)
    };
    expect(reservedOf(draft(true))).toBe(1);       // is_profile survives the mapper -> bit0 set (clean-11 profile-chain thread)
    expect(reservedOf(draft(false))).toBe(0);
    expect(reservedOf(draft(undefined))).toBe(0);   // normal post — byte-identical to clean-10, no accidental flag
  });

  it('PWA-PUBLIC-PARENT-02: the mapping survives the field-name variants the app draft uses', async () => {
    const { publishItemToBatchPart } = await import('../web/publish-batch-orchestration.mjs');
    const base = { size_class: 1n, header_hash: '0x11', body_hash: '0x22', header_cell: { boc: 'x' }, body_cell: { boc: 'x' } };
    expect(publishItemToBatchPart({ publish: { ...base, parent_entry_id: 7n } }, 'public').parent_entry_id).toBe(7n);
    expect(publishItemToBatchPart({ publish: { ...base, parentEntryId: 7n } }, 'public').parent_entry_id).toBe(7n);
    expect(publishItemToBatchPart({ publish: { ...base } }, 'public').parent_entry_id).toBeUndefined();
  });
});
