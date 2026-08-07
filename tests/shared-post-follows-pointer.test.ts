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
    // common case — costs zero requests.
    const embed = functionBody('function buildSharedPostEmbed(');
    expect(embed).toContain('if (block.entryId && (block.hasImage || block.textTruncated)) {');
  });

  it('SHAREREF-03: only a body-authentic post may answer for the reference, and it replaces the snapshot one way', () => {
    const fetchBody = functionBody('async function fetchSharedPostFromChain(');
    // The read window holds neighbouring entries, and the SENDER chose the coordinates. The body hash is what makes
    // a reference a reference.
    expect(fetchBody).toContain('.find((item) => normalizeBodyHashHex(item.bodyHash) === want) ?? null');
    // The snapshot is sender-authored and unverified; a post read back through the lane matched its body_commit and
    // its publisher tag. So the card upgrades snapshot -> chain and never the reverse: nothing writes block.snippet.
    const embed = functionBody('function buildSharedPostEmbed(');
    expect(embed).not.toMatch(/block\.snippet\s*=/);
    expect(embed).toContain('const whole = publicPostFullText(post);');
    expect(embed).toContain('text.replaceWith(replacement);');
  });

  it('SHAREREF-04: the fetched post is CACHED — the second render, and every one after a reload, costs nothing', () => {
    const fetchBody = functionBody('async function fetchSharedPostFromChain(');
    expect(fetchBody).toContain('upsertPublicChainPosts(existing, [post])');
    // commitPublicChannelFeedCache is the single choke point: text to localStorage, image media to IndexedDB. Without
    // it the read would repeat after every reload, which is exactly the cost this change exists to avoid.
    expect(fetchBody).toContain('commitPublicChannelFeedCache();');
    // The picture survives the localStorage strip through the same warm the feed does at load time.
    expect(functionBody('async function sharedPostImageUrlWarm(')).toContain('await publicPostMediaStore()');
  });

  it('SHAREREF-05: following a reference must never turn into a follow', () => {
    const fetchBody = functionBody('async function fetchSharedPostFromChain(');
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
