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
    const terminalIndex = pass.indexOf('PRIVATE_PUBLISH_CONFIRM_NO_PROGRESS_DEADLINE_MS');
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
    expect(app).toMatch(/writePublicChannelFeedCache\(publicChannelStorage\(\), publicChannelFeedCache\);\s*renderPublicSurface\(\{ anchorUnread: false \}\);\s*return located;/);
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
    const refresh = app.slice(app.indexOf('async function refreshPublicPostDetailComments'), app.indexOf('async function refreshPublicPostDetailComments') + 1400);
    expect(refresh).toMatch(/if \(cacheKey\) \{[\s\S]*publicPostCommentsCache\.set\(cacheKey, \{ comments: result\.comments/);
    expect(refresh).toMatch(/while \(publicPostCommentsCache\.size > 24\)/);
    // Cleared on account switch alongside the other public state.
    expect(app).toMatch(/publicPostCommentsCache\.clear\(\);/);
  });
});
