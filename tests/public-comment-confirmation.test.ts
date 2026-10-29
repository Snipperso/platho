import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';


import { parseTonAddress } from '../web/crypto/platho-crypto.mjs';
import { formatTonUserFriendlyAddress } from '../web/platho-wallet.mjs';

const app = readFileSync('web/app.js', 'utf8');

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
const ME = `0:${'11'.repeat(32)}`;
const ME_FRIENDLY = formatTonUserFriendlyAddress(ME);
const STRANGER = `0:${'22'.repeat(32)}`;
const PENDING = { id: 'local-comment-1', entryId: null, bodyHash: '0xbeef', authorWallet: ME, publishStatus: 'comment published, confirming' };
const CHAIN = { id: 'c1', entryId: 'c-beef', bodyHash: '0xBEEF', authorWallet: ME_FRIENDLY };

describe('public comment confirmation', () => {
  it('CONF-01: a chain twin retires the local "confirming" copy — and the cache is persisted', () => {
    const { retire, cache, commits } = loadRetire(cacheWith([PENDING]));
    expect(retire(POST, [CHAIN])).toBe(true);
    expect(cache()['lace.ath'].feed.posts[0].comments).toEqual([]);
    expect(commits()).toBe(1);
    expect(cache()['lace.ath'].syncedAt).toBe('X');
  });

  it('CONF-03: a STRANGER writing the same words does not retire my pending comment', () => {
    const theirs = { id: 'c2', entryId: 'c-beef', bodyHash: '0xBEEF', authorWallet: STRANGER };
    const mine = loadRetire(cacheWith([PENDING]));
    expect(mine.retire(POST, [theirs]), 'nothing of mine was confirmed').toBe(false);
    expect(mine.cache()['lace.ath'].feed.posts[0].comments, 'my pending comment must survive').toEqual([PENDING]);
    expect(mine.commits(), 'and nothing is written').toBe(0);
    const ours = loadRetire(cacheWith([PENDING]));
    expect(ours.retire(POST, [theirs, CHAIN])).toBe(true);
    expect(ours.cache()['lace.ath'].feed.posts[0].comments).toEqual([]);
  });

  it('CONF-02: nothing else is touched — a confirmed comment, a different body, an empty read', () => {
    const confirmed = { id: 'c9', entryId: 'c-dead', bodyHash: '0xdead' };
    const kept = loadRetire(cacheWith([confirmed, PENDING]));
    expect(kept.retire(POST, [CHAIN])).toBe(true);
    expect(kept.cache()['lace.ath'].feed.posts[0].comments).toEqual([confirmed]);

    const other = loadRetire(cacheWith([PENDING]));
    expect(other.retire(POST, [{ id: 'c2', entryId: 'c-1234', bodyHash: '0x1234' }])).toBe(false);
    expect(other.cache()['lace.ath'].feed.posts[0].comments).toEqual([PENDING]);
    expect(other.commits()).toBe(0);

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
    expect(ticker).toMatch(/if \(openPublicPostHasPendingComment\(\)(?: && ![A-Za-z]+)*\) \{/);
    expect(ticker.match(/noteTonRpcRateLimit\(error\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('CONF-05: one predicate decides "this cached post is that item", for every reader of a channel cache', () => {
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
