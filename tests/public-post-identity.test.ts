import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';


const app = readFileSync('web/app.js', 'utf8');

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
    const bookChapter = { channelId: 'platho.app', entryId: '441.0.0' };
    const lacePost = { channelId: 'lace.ath', entryId: '441.0.0' };
    expect(publicPostIdentity(bookChapter)).not.toBe(publicPostIdentity(lacePost));
    expect(samePublicPost(bookChapter, lacePost)).toBe(false);
    expect(samePublicPost(lacePost, { ...lacePost, title: 'relabelled' })).toBe(true);
  });

  it('PUBID-02: a post with no entryId has no identity and never matches — not even itself', () => {
    const { publicPostIdentity, samePublicPost } = loadIdentityFunctions();
    const pending = { channelId: 'lace.ath', entryId: null };
    expect(publicPostIdentity(pending)).toBeNull();
    expect(publicPostIdentity(undefined)).toBeNull();
    expect(samePublicPost(pending, pending)).toBe(false);
    expect(samePublicPost(pending, { channelId: 'lace.ath', entryId: undefined })).toBe(false);
    expect(publicPostIdentity({ channelId: 'lace.ath', entryId: 0 })).toBe('lace.ath:0');
  });

  it('PUBID-03: the comments cache key IS the identity function, not a second copy of the formula', () => {
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
