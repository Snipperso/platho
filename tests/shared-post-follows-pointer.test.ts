import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// A REPOST IS A REFERENCE, AND NOTHING FOLLOWED IT.
//
// decided 2026-08-07
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
    // THREE parts or FOUR [round 5]: the fourth names the generation, which the flip made part of a post's
    // identity (in the era straddling the boundary the two generations' shards share an epoch_tag AND a seq, and
    // both number entries from 0). A v1 share is still a bare uint64 and still resolves to nothing.
    expect(coords).toContain("if (parts.length < 3 || parts.length > 4 || !parts.every((part) => /^\\d+$/.test(part))) return null;");
    expect(coords).toContain('generation: parts.length === 4 ? Number(parts[3]) : null,');
  });

  it('SHAREREF-02: at most one read per post per session, and none at all when nothing is missing', () => {
    const resolve = functionBody('function resolveSharedPostOriginal(');
    expect(resolve).toContain('const inFlight = sharedPostChainReads.get(key);');
    expect(resolve).toContain('if (inFlight) return inFlight;');
    // The FAILED attempt is remembered too — this runs from a render, and an unresolvable post (older than the
    // shard's reachable history, retired, fabricated) must not re-read on every scroll.
    expect(resolve).toContain('sharedPostChainReads.set(key, job);');
    expect(resolve).toContain('while (sharedPostChainReads.size > SHARED_POST_CHAIN_READ_LIMIT)');

    // ZERO REQUESTS WHEN NOTHING IS MISSING — but the reader's CACHE is what decides that, never the sender.
    // [audit 2026-08-31, round 8] This used to pin `&& (block.hasImage || block.textTruncated)`: two bits the
    // SENDER encodes, with nothing on the wire binding them to the post being referenced. A hostile block with
    // flags = 0 skipped verification entirely while wearing the referenced author's registry-verified name,
    // hash-verified avatar and a header tap into their real channel — broadcast impersonation on the public
    // feed. The cost property it was protecting survives intact and is now DRIVEN below rather than read: a
    // cache hit still costs nothing, because the reader already holds the original.
    const embed = functionBody('function buildSharedPostEmbed(');
    expect(embed, 'verification may not be gated on flags the sender writes')
      .not.toMatch(/block\.hasImage \|\| block\.textTruncated\) \{/);
    expect(embed).toContain('if (embedDepth === 0 && claimsChainRow) {');
    // …and a card the read bound cannot reach is LABELLED, never trusted [pre-stage security review 2026-09-08]:
    // a share nested inside a verified post wore the referenced author's verified name with only a quiet rule.
    expect(embed).toMatch(/if \(claimsChainRow && embedDepth > 0\) \{\s*\n\s*const note = document\.createElement\('span'\);\s*\n\s*note\.className = 'shared-post-embed-unverified-note';/);
    // embedDepth bounds a repost OF a repost: the inner card keeps its snapshot instead of every level fetching
    // the next one's original.
    expect(embed).toContain('appendPublicItemContent(real, post, embedDepth + 1);');
  });

  it('SHAREREF-02B: the resolver costs one chain read per post per session, and none on a cache hit', () => {
    // The cost half of SHAREREF-02, RUN rather than read — because it is the half a security fix could quietly
    // trade away, and a source pin could not tell.
    const source = functionBody('function resolveSharedPostOriginal(');
    let fetches = 0;
    let cached: any = null;
    // eslint-disable-next-line no-new-func
    const resolve = new Function('setCached', 'counter', `
      const sharedPostChainReads = new Map();
      const SHARED_POST_CHAIN_READ_LIMIT = 64;
      let __cached = null;
      const findCachedPublicPostByEntryId = () => __cached;
      const normalizeBodyHashHex = (h) => (h == null ? null : String(h).toLowerCase());
      const noteTonRpcRateLimit = () => true;
      const fetchSharedPostFromChain = async () => { counter(); return { id: 'from-chain' }; };
      ${source}
      return {
        resolveSharedPostOriginal,
        setCached: (post) => { __cached = post; },
        reads: () => sharedPostChainReads.size,
      };
    `)(null, () => { fetches += 1; });

    // (1) The reader already holds the original and its body hash matches the claim: no request at all.
    resolve.setCached({ id: 'local', bodyHash: 'AABB' });
    expect(resolve.resolveSharedPostOriginal('20800.0.5', 'aabb', 'w')).resolves.toMatchObject({ id: 'local' });
    expect(fetches, 'a complete repost the reader already has costs nothing').toBe(0);

    // (2) A cache entry whose body hash does NOT match the claim is not an answer — that is the whole point of
    //     carrying the hash. It must read the chain rather than serve the wrong post under the claim.
    resolve.setCached({ id: 'local', bodyHash: 'CCDD' });
    resolve.resolveSharedPostOriginal('20800.0.6', 'aabb', 'w');
    expect(fetches, 'a mismatched cache entry may not answer for the reference').toBe(1);

    // (3) …and the same post never reads twice in a session, however many cards render it.
    resolve.setCached(null);
    resolve.resolveSharedPostOriginal('20800.0.7', 'aabb', 'w');
    resolve.resolveSharedPostOriginal('20800.0.7', 'aabb', 'w');
    resolve.resolveSharedPostOriginal('20800.0.7', 'aabb', 'w');
    expect(fetches, 'one read per post per session, whatever the render count').toBe(2);
    void cached;
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
    // THREE callers, ONE decoder: the sync walk, the addressed read, and (2026-08-21) the Discover card's latest-post
    // read — which is the point of the pin: a new reader of shard posts joins this decoder, it does not copy it.
    expect((APP.match(/await publicPostPartsFromShardPosts\(/g) ?? []).length).toBe(3);
    const decoder = functionBody('async function publicPostPartsFromShardPosts(');
    // The feed identity is what the SHARE block's entryId is compared against — it must be built in that one
    // place. Since round 5 it carries the GENERATION as a fourth coordinate when there is one: generation 17
    // keeps the exact three-part form every minted id and share block in the wild already uses, so a pre-flip
    // share still compares equal; only 18 appends, and its posts are born after the flip.
    expect(decoder).toContain('? `${sp.channelEpochTag}.${sp.channelShardSeq ?? 0}.${shardEntryId}`');
    expect(decoder).toContain(': `${sp.channelEpochTag}.${sp.channelShardSeq ?? 0}.${shardEntryId}.${postGeneration}`;');
  });
});
