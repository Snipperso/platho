import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// A PUBLIC POST'S IDENTITY IS channel + entry — NEVER entryId alone.
//
// The feed's entryId is `${channelEpochTag}.${channelShardSeq}.${shardEntryId}` (see the PublicShard walk). That
// composite is unique WITHIN a channel and nowhere else: every channel's first post in a given epoch is
// `<epochTag>.0.0`. Two channels publishing in the same epoch therefore produce IDENTICAL entryIds.
//
// MEASURED 2026-08-13 (owner, live mainnet): he pressed "Comments" on his wife's post and the detail screen
// painted HIS OWN post from another channel — a book chapter with comments disabled — while loading the wife's
// comments under it and aiming the composer at her post. renderPublicPostDetail re-found the feed item by
// entryId alone, and `.find()` over the oldest-first feed returned the older colliding post.
//
// The failure mode this file holds down is the whole CLASS, not that one line: any search of a CROSS-CHANNEL
// item list (publicFeedItemsChronological is the only one) that matches on entryId without the channel.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const app = readFileSync('web/app.js', 'utf8');

/** Lift the two identity functions out of app.js and RUN them — a prose pin cannot prove a collision. */
function loadIdentityFunctions(): {
  publicPostIdentity: (item: unknown) => string | null;
  samePublicPost: (left: unknown, right: unknown) => boolean;
} {
  const start = app.indexOf('function publicPostIdentity(');
  const end = app.indexOf('const publicPostCommentsCache = new Map();');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const source = app.slice(start, end);
  // eslint-disable-next-line no-new-func
  return new Function(`${source}\nreturn { publicPostIdentity, samePublicPost };`)() as ReturnType<typeof loadIdentityFunctions>;
}

describe('public post identity', () => {
  it('PUBID-01: the same entryId in two channels is NOT the same post', () => {
    const { publicPostIdentity, samePublicPost } = loadIdentityFunctions();
    // The exact live shape: both channels' first post of the same epoch.
    const bookChapter = { channelId: 'platho.app', entryId: '441.0.0' };
    const lacePost = { channelId: 'lace.ath', entryId: '441.0.0' };
    expect(publicPostIdentity(bookChapter)).not.toBe(publicPostIdentity(lacePost));
    expect(samePublicPost(bookChapter, lacePost)).toBe(false);
    // ...and the same post from two renders of the feed still matches (the fix must not break re-finding).
    expect(samePublicPost(lacePost, { ...lacePost, title: 'relabelled' })).toBe(true);
  });

  it('PUBID-02: a post with no entryId has no identity and never matches — not even itself', () => {
    const { publicPostIdentity, samePublicPost } = loadIdentityFunctions();
    // A local-pending post (published, not yet read back from a shard) carries no entryId. Matching two of them
    // on a null identity would collapse every pending post in the feed into one.
    const pending = { channelId: 'lace.ath', entryId: null };
    expect(publicPostIdentity(pending)).toBeNull();
    expect(publicPostIdentity(undefined)).toBeNull();
    expect(samePublicPost(pending, pending)).toBe(false);
    expect(samePublicPost(pending, { channelId: 'lace.ath', entryId: undefined })).toBe(false);
    // entryId 0 is a REAL entry, not a missing one.
    expect(publicPostIdentity({ channelId: 'lace.ath', entryId: 0 })).toBe('lace.ath:0');
  });

  it('PUBID-03: the comments cache key IS the identity function, not a second copy of the formula', () => {
    // One definition: a cache hit and a "same post" check can never disagree about which post this is.
    expect(app).toMatch(/const publicPostCommentsCacheKey = publicPostIdentity;/);
    expect(app.match(/function publicPostCommentsCacheKey\(/g)).toBeNull();
  });

  it('PUBID-04: the open post detail re-finds its item by identity, never by a bare entryId', () => {
    const detail = app.slice(
      app.indexOf('function renderPublicPostDetail()'),
      app.indexOf('function openPublicPostDetail'),
    );
    const reFind = detail.slice(0, detail.indexOf('publicPostDetailBody.replaceChildren()'));
    expect(reFind).toMatch(/samePublicPost\(it, publicPostDetailItem\)/);
    // The regression itself: comparing the captured item's entryId to a feed item's.
    expect(reFind).not.toMatch(/String\(publicPostDetailItem\.entryId\)/);
  });

  it('PUBID-05: the comment-cache warm paints only into the post it actually warmed', () => {
    const warm = app.slice(
      app.indexOf('async function warmPublicPostCommentsCache'),
      app.indexOf('function openPublicPostDetail'),
    );
    expect(warm).toMatch(/samePublicPost\(publicPostDetailItem, item\)/);
    expect(warm).not.toMatch(/String\(publicPostDetailItem\.entryId\)/);
  });

  it('PUBID-06: NO search of the cross-channel feed matches on entryId without the channel', () => {
    // Completeness over the whole set, not over the two call sites the owner happened to hit.
    // publicFeedItemsChronological() is the only list that spans channels, so every find/filter over it is
    // where a channel-blind match can hide.
    const searches = [...app.matchAll(/publicFeedItemsChronological\(\)\s*\.\s*(find|filter|some|findIndex)\(([\s\S]*?)\);/g)];
    expect(searches.length).toBeGreaterThan(0);
    for (const [, method, predicate] of searches) {
      if (!/entryId/.test(predicate)) continue;
      expect(
        /samePublicPost\(|publicPostIdentity\(|channelId/.test(predicate),
        `publicFeedItemsChronological().${method}() matches on entryId with no channel: ${predicate.trim()}`,
      ).toBe(true);
    }
  });
});
