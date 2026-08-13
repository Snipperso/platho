import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// A REPOST IS A REFERENCE, AND NOTHING FOLLOWED IT.
//
// Owner, 2026-08-07: "а почему репост публичного поста отправляется не полностью и без картинок?"
//
// By design the SHARE block carries a pointer (entry id, body hash, author wallet), a 4KB text snapshot and a
// "has image" flag — copying the picture would republish it on chain at full price. The half that was missing: the
// only resolver looked in the reader's OWN feed cache, and the recipient of a repost is precisely someone who
// probably does not follow that channel. So the picture never appeared, the text stayed a fragment, and the header
// that was supposed to "lead to the original" opened the CHANNEL — a dead end in a channel serialising a book.
//
// The read itself is measured for real against sandbox PublicShard accounts in tests/public-lane-post-at. What is
// pinned here is the WIRING, which needs a browser to run: when the fetch may happen, what may replace what, and
// that it happens at most once.
const APP = readFileSync('web/app.js', 'utf8');

function functionBody(name: string): string {
  const start = APP.indexOf(name);
  if (start < 0) return '';
  const end = APP.indexOf('\n}', start);
  return APP.slice(start, end < 0 ? APP.length : end + 2);
}

describe('SHAREREF — a shared post resolves to its original', () => {
  it('SHAREREF-01: the resolver reads the CHAIN when the local cache misses', () => {
    const resolve = functionBody('function resolveSharedPostOriginal(');
    expect(resolve).toContain('findCachedPublicPostByEntryId(entryId)');
    expect(resolve).toContain('fetchSharedPostFromChain(key, expectedBodyHash, authorWallet)');
    // The coordinates ARE the feed id. A v1 share (a bare uint64, minted before the public feed made ids
    // shard-qualified) has no coordinates and must resolve to nothing rather than read a guessed address.
    const coords = functionBody('function sharedPostShardCoordinates(');
    expect(coords).toContain("const parts = String(entryId ?? '').split('.');");
    expect(coords).toContain("if (parts.length !== 3 || !parts.every((part) => /^\\d+$/.test(part))) return null;");
  });

  it('SHAREREF-02: at most one read per post per session, and none at all when nothing is missing', () => {
    const resolve = functionBody('function resolveSharedPostOriginal(');
    expect(resolve).toContain('const inFlight = sharedPostChainReads.get(key);');
    expect(resolve).toContain('if (inFlight) return inFlight;');
    // The FAILED attempt is remembered too — this runs from a render, and an unresolvable post (older than the
    // shard's reachable history, retired, fabricated) must not re-read on every scroll.
    expect(resolve).toContain('sharedPostChainReads.set(key, job);');
    expect(resolve).toContain('while (sharedPostChainReads.size > SHARED_POST_CHAIN_READ_LIMIT)');

    // And the card only asks when the snapshot is genuinely short of the original. A complete short repost — the
    // common case — costs zero requests. embedDepth bounds a repost OF a repost: the inner card keeps its snapshot
    // instead of every level fetching the next one's original.
    const embed = functionBody('function buildSharedPostEmbed(');
    expect(embed).toContain('if (embedDepth === 0 && block.entryId && (block.hasImage || block.textTruncated)) {');
    expect(embed).toContain('appendPublicItemContent(real, post, embedDepth + 1);');
  });

  it('SHAREREF-03: only a body-authentic post may answer for the reference, and it replaces the snapshot one way', () => {
    // Since permalinks (1.0.16) the addressed read is a SHARED primitive taking the "which post answers" rule from
    // its caller, so the check is asserted where the SHARE path supplies it — and a share read with no expected
    // hash must resolve to NOTHING rather than fall through to the first post in the window.
    const fetchBody = functionBody('async function fetchSharedPostFromChain(');
    // The read window holds neighbouring entries, and the SENDER chose the coordinates. The body hash is what makes
    // a reference a reference.
    expect(fetchBody).toContain('(item) => normalizeBodyHashHex(item.bodyHash) === want');
    expect(fetchBody).toContain('if (!want) return null;');
    // The primitive itself must NOT carry a default rule: a caller that forgets the selector has to fail, not
    // silently accept whatever the shard returned first.
    const shared = functionBody('async function fetchPublicPostFromChain(');
    expect(shared).toContain('.find((item) => selectPost(item)) ?? null');
    expect(shared).not.toMatch(/selectPost\s*=/);
    // The snapshot is sender-authored and unverified; a post read back through the lane matched its body_commit and
    // its publisher tag. So the card upgrades snapshot -> chain and never the reverse: nothing writes block.snippet.
    const embed = functionBody('function buildSharedPostEmbed(');
    expect(embed).not.toMatch(/block\.snippet\s*=/);
    expect(embed).toContain('snapshot.replaceWith(real);');
    // Replaced WHOLE, and only when there is something to put there — a resolve that renders nothing must leave the
    // snapshot standing rather than blank the card.
    expect(embed).toContain('if (real.childNodes.length === 0) return;');
  });

  it('SHAREREF-08: the original renders through the FEED\'s renderer, so the author\'s layout survives', () => {
    // The card used to be patched piecewise: the text swapped in place, the picture swapped into a hint appended
    // AFTER it. That could only ever produce one layout — everything, then the image — so a post with a picture in
    // the middle came out with it stuck at the bottom (owner, 2026-08-07). appendPublicItemContent walks the post's
    // blocks in order and is the same function the feed and the post detail use.
    const embed = functionBody('function buildSharedPostEmbed(');
    expect(embed).toContain('appendPublicItemContent(real, post, embedDepth + 1);');
    // The warm runs BEFORE the render, not after: the persisted feed cache holds a post's text without its image
    // (data-urls are stripped on write), so rendering first would draw the post with no picture at all.
    expect(embed.indexOf('await sharedPostImageUrlWarm(post);'))
      .toBeLessThan(embed.indexOf('appendPublicItemContent(real, post, embedDepth + 1);'));
    // And the renderer threads the depth on, or the bound would stop at the first level.
    const feedRenderer = functionBody('function appendPublicItemContent(');
    expect(feedRenderer).toContain('function appendPublicItemContent(container, item, embedDepth = 0)');
    expect(feedRenderer).toContain('container.append(buildSharedPostEmbed(block, embedDepth));');
  });

  it('SHAREREF-04: the fetched post is CACHED — the second render, and every one after a reload, costs nothing', () => {
    // The caching lives in the shared addressed-read primitive, so it covers the permalink path too.
    const fetchBody = functionBody('async function fetchPublicPostFromChain(');
    expect(fetchBody).toContain('upsertPublicChainPosts(existing, [post])');
    // commitPublicChannelFeedCache is the single choke point: text to localStorage, image media to IndexedDB. Without
    // it the read would repeat after every reload, which is exactly the cost this change exists to avoid.
    expect(fetchBody).toContain('commitPublicChannelFeedCache();');
    // The picture survives the localStorage strip through the same warm the feed does at load time.
    expect(functionBody('async function sharedPostImageUrlWarm(')).toContain('await publicPostMediaStore()');
  });

  it('SHAREREF-05: following a reference must never turn into a follow', () => {
    // In the shared primitive, so opening a PERMALINK does not silently subscribe the reader either.
    const fetchBody = functionBody('async function fetchPublicPostFromChain(');
    expect(fetchBody).toContain("ensurePublicChannelForAuthorWallet(wallet, { activate: false })");
    // Spelled as an exclusion as well: reading someone's post because a contact forwarded it is not subscribing to
    // them. That is the spam door the asymmetric conversation-follow rule exists to keep shut.
    expect(fetchBody).not.toContain('activate: true');
  });

  it('SHAREREF-06: the header opens the POST, not just the channel it lives in', () => {
    const embed = functionBody('function buildSharedPostEmbed(');
    expect(embed).toContain('openPublicChannelView({ authorWallet: wallet });');
    expect(embed).toContain('if (post) openPublicPostDetail(post);');
    // Order matters: the detail stacks on the channel view, so a failed resolve leaves the reader in the channel
    // rather than nowhere.
    expect(embed.indexOf('openPublicChannelView({ authorWallet: wallet });'))
      .toBeLessThan(embed.indexOf('openPublicPostDetail(post)'));
  });

  it('SHAREREF-07: ONE decoder — the addressed read cannot drift from the sync walk', () => {
    // A second copy of the shard-post -> feed-post decode would be a slow-motion bug: the two would agree on the
    // day they were written and diverge on the first change to either.
    expect((APP.match(/await publicPostPartsFromShardPosts\(/g) ?? []).length).toBe(2);
    const decoder = functionBody('async function publicPostPartsFromShardPosts(');
    // The feed identity is what the SHARE block's entryId is compared against — it must be built in that one place.
    expect(decoder).toContain('const globalEntryId = `${sp.channelEpochTag}.${sp.channelShardSeq ?? 0}.${shardEntryId}`;');
  });
});
