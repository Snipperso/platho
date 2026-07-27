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

  // PWA-PUBLIC-HEAL-01/02/03/04 removed with the public Vault confirm driver. Every one of them pinned a
  // machine that only ran for a record carrying a publishState: the fresh-variant re-broadcast ladder, the
  // per-batch receipt confirm, the driver's persistence back into the feed cache. A direct-pay public record
  // never has a publishState (its publish IS one wallet transfer), so the driver could not start — it is gone.
  // What survives, and is pinned below, is the honest end state: a record stuck optimistic past the no-progress
  // deadline is TERMINALED on resume instead of showing 'sending' forever, and the badge is CSS-class based.
  it('PWA-PUBLIC-HEAL-03B: resume terminals a stuck optimistic public record instead of leaving it sending', () => {
    const resume = app.slice(
      app.indexOf('function resumePendingPublicPublishConfirmations'),
      app.indexOf('function rememberLocalPublicPost'),
    );
    expect(resume).toMatch(/if \(!isPendingPublicFeedItem\(item\)\) continue;/);
    expect(resume).toMatch(/Date\.now\(\) - createdAt >= PRIVATE_PUBLISH_CONFIRM_NO_PROGRESS_DEADLINE_MS/);
    expect(resume).toMatch(/publishStatus: 'public publish failed'/);
    // Resume is wired at the same hooks as the private side (parity, not a magic count).
    expect(app.match(/resumePendingPublicPublishConfirmations\(\);/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('PWA-PUBLIC-HEAL-05: pending badge is CSS-class based (prod CSP bans inline styles) and the dead option is gone', () => {
    expect(app).toMatch(/public-publish-status--failed/);
    expect(css).toMatch(/\.public-publish-status \{/);
    expect(css).toMatch(/\.public-publish-status--failed \{/);
    expect(app).not.toMatch(/style\s*=\s*["'`][^"'`]*public-publish/);
    // confirmFinalNonce was already dead since v616; its whole home (publishPublicPayloadParts -> the Vault publish
    // trunk) is now deleted, so assert it app-wide instead of over a slice that no longer exists (an indexOf(-1)
    // slice is '' and would pass vacuously).
    expect(app).not.toMatch(/confirmFinalNonce/);
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
    // Both direct-pay submit paths insert the optimistic record with a private-style 'sending' status and patch the
    // SAME record on result (never a second insert) — post + comment.
    expect(app.match(/publishStatus: 'sending',\s*publishState: null,/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
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

// PWA-PUBLIC-HEAL-10 removed with retryPublicPublishFromUi: the badge could only re-arm a publishState-driven
// driver, and a direct publish parks no signed external to re-broadcast. Restoring a public retry means giving the
// direct path a captured BOC first (roadmap: ACK-without-delivery) — the private lane already has one.

