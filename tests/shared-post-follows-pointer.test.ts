import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

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
    expect(resolve).toContain('fetchSharedPostFromChain(entry, expectedBodyHash, authorWallet, { keep })');
    expect(resolve).toContain("const key = `${entry}|${want ?? ''}|${rawWalletAddress(authorWallet) ?? String(authorWallet ?? '')}|${keep ? 'keep' : 'read'}`;");
    const coords = functionBody('function sharedPostShardCoordinates(');
    expect(coords).toContain("const parts = String(entryId ?? '').split('.');");
    expect(coords).toContain("if (parts.length < 3 || parts.length > 4 || !parts.every((part) => /^\\d+$/.test(part))) return null;");
    expect(coords).toContain('generation: parts.length === 4 ? Number(parts[3]) : null,');
  });

  it('SHAREREF-02: at most one read per post per session, and none at all when nothing is missing', () => {
    const resolve = functionBody('function resolveSharedPostOriginal(');
    expect(resolve).toContain('const inFlight = sharedPostChainReads.get(key);');
    expect(resolve).toContain('if (inFlight) return inFlight;');
    expect(resolve).toContain('sharedPostChainReads.set(key, job);');
    expect(resolve).toContain('while (sharedPostChainReads.size > SHARED_POST_CHAIN_READ_LIMIT)');

    const embed = functionBody('function buildSharedPostEmbed(');
    expect(embed, 'verification may not be gated on flags the sender writes')
      .not.toMatch(/block\.hasImage \|\| block\.textTruncated\) \{/);
    expect(embed).toContain('if (embedDepth === 0 && claimsChainRow) {');
    expect(embed).toMatch(/if \(claimsChainRow && embedDepth > 0\) \{\s*\n\s*const note = document\.createElement\('span'\);\s*\n\s*note\.className = 'shared-post-embed-unverified-note';/);
    expect(embed).toContain('appendBoundedContent(real, openedWithCard(`share:${shareKey}`), (target, budget) => appendPublicItemContent(target, post, embedDepth + 1, { budget }));');
  });

  it('SHAREREF-02B: the resolver costs one chain read per post per session, and none on a cache hit', () => {
    const source = functionBody('function resolveSharedPostOriginal(');
    let fetches = 0;
    let cached: any = null;
    // eslint-disable-next-line no-new-func
    const resolve = new Function('setCached', 'counter', `
      const sharedPostChainReads = new Map();
      const SHARED_POST_CHAIN_READ_LIMIT = 64;
      let __cached = null;
      const findCachedPublicPostByEntryId = () => __cached;
      const findAllFeedPostByEntryId = () => null;
      const sharedOriginalCopyCurrent = () => true;   // a followed channel's copy; a stale one is R16-REPOST-01's [round 16 — C4]
      const normalizeBodyHashHex = (h) => (h == null ? null : String(h).toLowerCase());
      const rawWalletAddress = (w) => (w == null ? null : String(w));
      const noteTonRpcRateLimit = () => true;
      const fetchSharedPostFromChain = async () => { counter(); return { id: 'from-chain' }; };
      ${source}
      return {
        resolveSharedPostOriginal,
        setCached: (post) => { __cached = post; },
        reads: () => sharedPostChainReads.size,
      };
    `)(null, () => { fetches += 1; });

    resolve.setCached({ id: 'local', bodyHash: 'AABB', authorWallet: 'w' });
    expect(resolve.resolveSharedPostOriginal('20800.0.5', 'aabb', 'w')).resolves.toMatchObject({ id: 'local' });
    expect(fetches, 'a complete repost the reader already has costs nothing').toBe(0);
    resolve.setCached({ id: 'local', bodyHash: 'AABB', authorWallet: 'someone-else' });
    resolve.resolveSharedPostOriginal('20800.0.5', 'aabb', 'w');
    expect(fetches, 'a foreign author\'s cached copy reads the chain').toBe(1);
    fetches = 0;

    resolve.setCached({ id: 'local', bodyHash: 'CCDD', authorWallet: 'w' });
    resolve.resolveSharedPostOriginal('20800.0.6', 'aabb', 'w');
    expect(fetches, 'a mismatched cache entry may not answer for the reference').toBe(1);

    resolve.setCached(null);
    resolve.resolveSharedPostOriginal('20800.0.7', 'aabb', 'w');
    resolve.resolveSharedPostOriginal('20800.0.7', 'aabb', 'w');
    resolve.resolveSharedPostOriginal('20800.0.7', 'aabb', 'w');
    expect(fetches, 'one read per post per session, whatever the render count').toBe(2);

    resolve.resolveSharedPostOriginal('20800.0.7', 'aabb', 'someone-else');
    expect(fetches, 'a different author is a different row: its own read').toBe(3);
    resolve.resolveSharedPostOriginal('20800.0.7', 'eeff', 'w');
    expect(fetches, 'a different claimed hash for the same row is not answered by the other claim\'s read').toBe(4);
    void cached;
  });

  it('SHAREREF-03: only a body-authentic post may answer for the reference, and it replaces the snapshot one way', () => {
    const fetchBody = functionBody('async function fetchSharedPostFromChain(');
    expect(fetchBody).toContain('(item) => normalizeBodyHashHex(item.bodyHash) === want');
    expect(fetchBody).toContain('if (!want) return null;');
    const shared = functionBody('async function fetchPublicPostFromChain(');
    expect(shared).toContain('.find((item) => selectPost(item)) ?? null');
    expect(shared).not.toMatch(/selectPost\s*=/);
    const embed = functionBody('function buildSharedPostEmbed(');
    expect(embed).not.toMatch(/block\.snippet\s*=/);
    expect(embed).toContain('snapshot.replaceWith(real);');
    expect(embed).toContain('if (real.childNodes.length === 0) return;');
  });

  it('SHAREREF-08: the original renders through the FEED\'s renderer, so the author\'s layout survives', () => {
    const embed = functionBody('function buildSharedPostEmbed(');
    expect(embed).toContain('appendBoundedContent(real, openedWithCard(`share:${shareKey}`), (target, budget) => appendPublicItemContent(target, post, embedDepth + 1, { budget }));');
    expect(embed.indexOf('await sharedPostImageUrlWarm(post);'))
      .toBeLessThan(embed.indexOf('appendBoundedContent(real, openedWithCard(`share:${shareKey}`), (target, budget) => appendPublicItemContent(target, post, embedDepth + 1, { budget }));'));
    const feedRenderer = functionBody('function appendPublicItemContent(');
    expect(feedRenderer).toContain('function appendPublicItemContent(container, item, embedDepth = 0, options = {})');
    expect(feedRenderer).toContain('container.append(buildSharedPostEmbed(block, embedDepth, options));');
  });

  it('SHAREREF-04: the fetched post is CACHED — the second render, and every one after a reload, costs nothing', () => {
    const fetchBody = functionBody('async function fetchPublicPostFromChain(');
    expect(fetchBody).toContain('upsertPublicChainPosts(existing, [{ ...post, seeded: true }])');
    expect(fetchBody).toContain('commitPublicChannelFeedCache();');
    expect(functionBody('async function sharedPostImageUrlWarm(')).toContain('await publicPostMediaStore()');
  });

  it('SHAREREF-05: following a reference must never turn into a follow', () => {
    const fetchBody = functionBody('async function fetchPublicPostFromChain(');
    expect(fetchBody).toContain("ensurePublicChannelForAuthorWallet(wallet, { activate: false })");
    expect(fetchBody).not.toContain('activate: true');
  });

  it('SHAREREF-06: the header opens the POST, not just the channel it lives in', () => {
    const embed = functionBody('function buildSharedPostEmbed(');
    expect(embed).toContain('openPublicChannelView({ authorWallet: wallet });');
    expect(embed).toContain('&& (rawWalletAddress(post.authorWallet) ?? null) === (rawWalletAddress(wallet) ?? null)) openPublicPostDetail(post);');
    expect(embed.indexOf('openPublicChannelView({ authorWallet: wallet });'))
      .toBeLessThan(embed.indexOf('openPublicPostDetail(post)'));
  });

  it('SHAREREF-07: ONE decoder — the addressed read cannot drift from the sync walk', () => {
    expect((APP.match(/await publicPostPartsFromShardPosts\(/g) ?? []).length).toBe(4);
    const decoder = functionBody('async function publicPostPartsFromShardPosts(');
    expect(decoder).toContain('? `${sp.channelEpochTag}.${sp.channelShardSeq ?? 0}.${shardEntryId}`');
    expect(decoder).toContain(': `${sp.channelEpochTag}.${sp.channelShardSeq ?? 0}.${shardEntryId}.${postGeneration}`;');
  });
});
