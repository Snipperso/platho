import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// A PUBLISHED COMMENT MUST STOP SAYING "CONFIRMING".
//
// decided 2026-08-13
//
// Two independent holes, both specific to COMMENTS:
//
//  1. NOTHING COULD EVER RETIRE THE LOCAL COPY. mergeLocalPendingPublicFeed drops a pending record when the chain
//     twin with the same body hash appears in the sync — but the sync walks the CHANNEL shard, and comments live
//     in the post's THREAD shard. Its comment list is always empty, so the match never happened. Past the
//     no-progress deadline resumePendingPublicPublishConfirmations would then TERMINAL it: a red "failed" badge
//     on a comment that was on chain the whole time.
//
//  2. NOTHING RE-READ THE OPEN THREAD. The post-publish ticker calls syncPublicChannels() — channel posts only —
//     so the badge survived on screen until the user closed and reopened the post.
//
// Posts do not share either hole: the channel walk returns them, so their pending twin retires normally.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

import { parseTonAddress } from '../web/crypto/platho-crypto.mjs';
import { formatTonUserFriendlyAddress } from '../web/platho-wallet.mjs';

const app = readFileSync('web/app.js', 'utf8');

/** Lift the retirement out of app.js and RUN it against a cache shaped like the real one. */
function loadRetire(cache: Record<string, unknown>) {
  const start = app.indexOf('function retireConfirmedLocalPublicComments(');
  const end = app.indexOf('\n}', start) + 2;
  expect(start).toBeGreaterThan(-1);
  const prelude = `
    let publicChannelFeedCache = ${JSON.stringify(cache)};
    let committed = 0;
    const commitPublicChannelFeedCache = () => { committed += 1; };
    const isPendingPublicFeedItem = (i) => Boolean(i?.publishStatus && (i.entryId === undefined || i.entryId === null || i.entryId === ''));
    const samePublicBodyHash = (l, r) => {
      const a = String(l?.bodyHash ?? '').toLowerCase(); const b = String(r?.bodyHash ?? '').toLowerCase();
      return Boolean(a && b && a === b);
    };
    const sameCachedPublicPost = (p, i) => String(p?.entryId ?? p?.id) === String(i?.entryId ?? i?.id);
    // The retirement now also requires the AUTHOR to match [audit 2026-09-01, round 9]: matching on body hash
    // alone let a STRANGER's identical comment retire this device's pending one as confirmed — the pending record
    // vanished, the UI turned green, and the entry it stood for was never published. Two people writing "ok" was
    // all it took, because a comment's PPH2 body cell carries only the document bytes while the publisher lives
    // in the header. Lifted verbatim from app.js rather than restated, so this stub cannot describe a comparison
    // the product does not make.
    ${(() => {
      const at = app.indexOf('function sameWalletAddress(');
      let depth = 0;
      for (let i = app.indexOf('{', at); i < app.length; i += 1) {
        if (app[i] === '{') depth += 1;
        else if (app[i] === '}') { depth -= 1; if (depth === 0) return app.slice(at, i + 1); }
      }
      throw new Error('sameWalletAddress braces do not balance');
    })()}
  `;
  // eslint-disable-next-line no-new-func
  return new Function('parseTonAddress', `${prelude}\n${app.slice(start, end)}
    return { retire: retireConfirmedLocalPublicComments, cache: () => publicChannelFeedCache, commits: () => committed };`)(parseTonAddress);
}

const POST = { entryId: '441.0.3', channelId: 'lace.ath', bodyHash: '0xaa' };
const cacheWith = (comments: unknown[]) => ({
  'lace.ath': { syncedAt: 'X', feed: { version: 1, channelId: 'lace.ath', posts: [{ id: 'p1', entryId: '441.0.3', bodyHash: '0xaa', comments }] } },
});
// The author rides on both halves in production — rememberLocalPublicComment stamps `authorWallet` from the
// wallet that composed it, and the chain mapper stamps it from the row's `publisher` — so the fixtures carry it
// too. Deliberately in DIFFERENT address forms: sameWalletAddress normalises through parseTonAddress(...).raw,
// and a comparison that only matched identical strings would silently stop retiring anything.
const ME = `0:${'11'.repeat(32)}`;
const ME_FRIENDLY = formatTonUserFriendlyAddress(ME);   // the same wallet, written the other way
const STRANGER = `0:${'22'.repeat(32)}`;
const PENDING = { id: 'local-comment-1', entryId: null, bodyHash: '0xbeef', authorWallet: ME, publishStatus: 'comment published, confirming' };
const CHAIN = { id: 'c1', entryId: 'c-beef', bodyHash: '0xBEEF', authorWallet: ME_FRIENDLY };

describe('public comment confirmation', () => {
  it('CONF-01: a chain twin retires the local "confirming" copy — and the cache is persisted', () => {
    const { retire, cache, commits } = loadRetire(cacheWith([PENDING]));
    expect(retire(POST, [CHAIN])).toBe(true);
    expect(cache()['lace.ath'].feed.posts[0].comments).toEqual([]);
    expect(commits()).toBe(1);              // survives the reload, or the badge is back on next boot
    expect(cache()['lace.ath'].syncedAt).toBe('X');  // the entry is patched, not rebuilt
  });

  it('CONF-03: a STRANGER writing the same words does not retire my pending comment', () => {
    // [audit 2026-09-01, round 9.] The retirement matched on body hash alone. A comment's PPH2 body cell carries
    // only the document bytes — the timestamp, the streamId and the publisher all live in the header — so two
    // people commenting "ok" under one post produce the SAME hash. MEASURED: the stranger's chain row retired
    // this device's pending record as confirmed, the badge turned green, and the comment it stood for was never
    // published. "ok", "+1" and an emoji make that routine rather than exotic.
    const theirs = { id: 'c2', entryId: 'c-beef', bodyHash: '0xBEEF', authorWallet: STRANGER };
    const mine = loadRetire(cacheWith([PENDING]));
    expect(mine.retire(POST, [theirs]), 'nothing of mine was confirmed').toBe(false);
    expect(mine.cache()['lace.ath'].feed.posts[0].comments, 'my pending comment must survive').toEqual([PENDING]);
    expect(mine.commits(), 'and nothing is written').toBe(0);
    // …and my own twin still retires it, so the guard did not simply switch retirement off.
    const ours = loadRetire(cacheWith([PENDING]));
    expect(ours.retire(POST, [theirs, CHAIN])).toBe(true);
    expect(ours.cache()['lace.ath'].feed.posts[0].comments).toEqual([]);
  });

  it('CONF-02: nothing else is touched — a confirmed comment, a different body, an empty read', () => {
    // A comment that already has an entryId is not pending and must survive.
    const confirmed = { id: 'c9', entryId: 'c-dead', bodyHash: '0xdead' };
    const kept = loadRetire(cacheWith([confirmed, PENDING]));
    expect(kept.retire(POST, [CHAIN])).toBe(true);
    expect(kept.cache()['lace.ath'].feed.posts[0].comments).toEqual([confirmed]);

    // A pending comment whose body is NOT in the chain list stays pending — it really has not landed.
    const other = loadRetire(cacheWith([PENDING]));
    expect(other.retire(POST, [{ id: 'c2', entryId: 'c-1234', bodyHash: '0x1234' }])).toBe(false);
    expect(other.cache()['lace.ath'].feed.posts[0].comments).toEqual([PENDING]);
    expect(other.commits()).toBe(0);        // no write, no render churn, when nothing changed

    // A DEGRADED read yields no comments; it must never be read as "nothing landed".
    const degraded = loadRetire(cacheWith([PENDING]));
    expect(degraded.retire(POST, [])).toBe(false);
    expect(degraded.cache()['lace.ath'].feed.posts[0].comments).toEqual([PENDING]);
  });

  it('CONF-03: the retirement is spent on a CLEAN read, never on a degraded one', () => {
    const refresh = app.slice(
      app.indexOf('async function refreshPublicPostDetailComments('),
      app.indexOf('function schedulePublicPublishVisibilityChecks('),
    );
    expect(refresh).toContain('retireConfirmedLocalPublicComments(item, result.comments);');
    // Inside the `if (!result.degraded)` branch: a partial list would retire a comment that never landed.
    const clean = refresh.slice(refresh.indexOf('if (!result.degraded) {'), refresh.indexOf('// Degraded:'));
    expect(clean).toContain('retireConfirmedLocalPublicComments(');
  });

  it('CONF-04: the post-publish ticker re-reads the open thread, not only the channel sync', () => {
    const ticker = app.slice(
      app.indexOf('function schedulePublicPublishVisibilityChecks('),
      app.indexOf('function anyPublicPublishStillResolving('),
    );
    expect(ticker).toContain('await syncPublicChannels();');
    expect(ticker).toContain('await refreshPublicPostDetailComments();');
    // Bounded to the OPEN post with something of our own still pending — the one exception to
    // "comments load only on thread open", and the reason it is not the walker that rule forbids.
    // (2026-08-23: also skipped while the reader stands in a newer-than/jumped window of the thread — the refresh's
    // exit-replace would teleport them mid-read; the confirmation retries next pass.)
    expect(ticker).toMatch(/if \(openPublicPostHasPendingComment\(\)(?: && ![A-Za-z]+)*\) \{/);
    // Both reads are rate-limit aware — a 429 here used to hammer at the tick cadence.
    expect(ticker.match(/noteTonRpcRateLimit\(error\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('CONF-05: one predicate decides "this cached post is that item", for every reader of a channel cache', () => {
    // It was written out by hand in two places and about to be a third. entryId is unique only WITHIN a channel,
    // which is exactly what a per-channel cache list is — see samePublicPost for the cross-channel rule.
    expect(app).toContain('function sameCachedPublicPost(cachedPost, item)');
    for (const caller of [
      'function cachedCommentsForPost(',
      'function retireConfirmedLocalPublicComments(',
      'function rememberLocalPublicComment(',
    ]) {
      const body = app.slice(app.indexOf(caller), app.indexOf(caller) + 1400);
      expect(body, caller).toContain('sameCachedPublicPost(');
    }
  });
});
