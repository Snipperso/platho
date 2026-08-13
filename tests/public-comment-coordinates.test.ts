import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// A COMMENT NEEDS THE PARENT POST'S CHAIN COORDINATES, AND THE FEED ITEM DID NOT HAVE THEM.
//
// Owner, 2026-08-13: "Написал комментарий на пост, нажал отправить. Из композера текст исчез, в посте не
// появился... Я не подписан на этот канал, просто нашёл через поиск каналов." Console:
// "Public comment parent is missing its channel coordinates".
//
// Both the comment READ and the comment WRITE fold (author wallet, channel epoch tag, channel shard seq, raw
// per-shard entry id) into the post's thread address. They read those off explicit item fields — and the copy
// did not survive the trip: publicChannelFeedToThread never mapped them onto a message,
// publicChannelThreadsToFeedItems never mapped them onto a feed item, and normalizeFeedPost (a strict whitelist)
// strips them from the cache. Only a post held in memory straight from the shard walk still had them, which is
// why commenting worked from a SHARE embed and nowhere else, and why the code comment claiming "the opened post
// carries channelEpochTag/authorWallet from the shard feed" was describing a mechanism that never ran.
//
// The coordinates were in entryId the whole time: it IS `${epochTag}.${shardSeq}.${shardEntryId}`. So they are
// DERIVED now, and this file holds that derivation down against the shape the feed actually produces.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const app = readFileSync('web/app.js', 'utf8');
const subs = readFileSync('web/public-channel-subscriptions.mjs', 'utf8');

function loadCoordinateFunctions() {
  const start = app.indexOf('/** epochTag.shardSeq.entryId -> the three coordinates');
  const end = app.indexOf('async function fetchPublicPostFromChain(');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  // eslint-disable-next-line no-new-func
  return new Function(`${app.slice(start, end)}\nreturn { publicPostChainCoordinates };`)();
}

const WALLET = `0:${'cd'.repeat(32)}`;

describe('public comment coordinates', () => {
  it('COORDS-01: a plain FEED ITEM — entryId + authorWallet and nothing else — yields a full thread address', () => {
    const { publicPostChainCoordinates } = loadCoordinateFunctions();
    // Exactly the shape publicChannelThreadsToFeedItems builds. This is the case that was broken in production.
    const feedItem = { entryId: '441.2.7', authorWallet: WALLET, channelId: 'lace.ath' };
    expect(publicPostChainCoordinates(feedItem)).toEqual({
      authorWallet: WALLET,
      epochTag: 441n,
      shardSeq: 2,
      shardEntryId: 7n,
    });
  });

  it('COORDS-02: the raw per-shard entry id is NOT the composite, and the shard seq is NOT assumed to be 0', () => {
    const { publicPostChainCoordinates } = loadCoordinateFunctions();
    const overflow = publicPostChainCoordinates({ entryId: '441.2.7', authorWallet: WALLET });
    // Folding the composite (or a 0 shard seq) addresses a different shard, and the post's thread is never found.
    expect(overflow.shardEntryId).toBe(7n);
    expect(overflow.shardSeq).toBe(2);
    expect(publicPostChainCoordinates({ entryId: '441.0.0', authorWallet: WALLET }))
      .toEqual({ authorWallet: WALLET, epochTag: 441n, shardSeq: 0, shardEntryId: 0n });
  });

  it('COORDS-03: an explicitly-carried coordinate still wins, so a freshly-walked post is unaffected', () => {
    const { publicPostChainCoordinates } = loadCoordinateFunctions();
    const walked = {
      entryId: '441.2.7', authorWallet: WALLET,
      channelEpochTag: '441', channelShardSeq: 2, shardEntryId: '7',
    };
    expect(publicPostChainCoordinates(walked))
      .toEqual({ authorWallet: WALLET, epochTag: 441n, shardSeq: 2, shardEntryId: 7n });
  });

  it('COORDS-04: no address at all when there is nothing to address', () => {
    const { publicPostChainCoordinates } = loadCoordinateFunctions();
    expect(publicPostChainCoordinates({ entryId: null, authorWallet: WALLET })).toBeNull();   // local-pending
    expect(publicPostChainCoordinates({ entryId: '441.2.7', authorWallet: null })).toBeNull();
    expect(publicPostChainCoordinates({ entryId: '12345', authorWallet: WALLET })).toBeNull();  // pre-shard v1 id
    expect(publicPostChainCoordinates(null)).toBeNull();
  });

  it('COORDS-05: BOTH the read and the write go through the primitive — no direct field reads left', () => {
    // Completeness over the set, not over the one call site the owner happened to hit. A direct read is exactly
    // what broke: the field is absent on a feed item, so `?? 0` / `?? item.entryId` fallbacks silently addressed
    // the wrong shard instead of failing.
    const read = app.slice(
      app.indexOf('async function loadPublicPostCommentsFromShards('),
      app.indexOf('async function loadPublicPostComments(item, options = {})'),
    );
    const write = app.slice(
      app.indexOf('async function submitPublicCommentDirect('),
      app.indexOf('globalThis.plathoVaultTransactions'),
    );
    for (const [label, body] of [['read', read], ['write', write]] as const) {
      expect(body.length, label).toBeGreaterThan(0);
      expect(body, label).toContain('publicPostChainCoordinates(');
      expect(body, label).not.toMatch(/\bitem\.channelEpochTag\b|\bparent\.channelEpochTag\b/);
      expect(body, label).not.toMatch(/\bitem\.shardEntryId\b|\bparent\.shardEntryId\b/);
      expect(body, label).not.toMatch(/channelShardSeq: item\.|channelShardSeq \?\? 0/);
    }
  });

  it('COORDS-06: the feed item genuinely does not carry the coordinates — deriving them is not optional', () => {
    // The reason the primitive exists. If a future change starts carrying them, this test says so and the
    // derivation can be revisited — it does not silently become dead code.
    const item = subs.slice(
      subs.indexOf('export function publicChannelThreadsToFeedItems('),
      subs.indexOf('export function clonePublicChannelSubscriptions('),
    );
    expect(item).not.toContain('channelEpochTag');
    // And the cache normalizer would strip them anyway: it is a strict whitelist, so a carried field dies on the
    // first localStorage round trip.
    const normalizer = subs.slice(subs.indexOf('function normalizeFeedPost('), subs.indexOf('function normalizeFeedComment('));
    expect(normalizer).not.toContain('channelEpochTag');
  });

  it('COORDS-07: an unaddressable published post reports UNKNOWN, never "no comments yet"', () => {
    const read = app.slice(
      app.indexOf('async function loadPublicPostCommentsFromShards('),
      app.indexOf('async function loadPublicPostComments(item, options = {})'),
    );
    // parentExists:false is a CLAIM the UI prints as "no comments yet". It may only be made for a post that has
    // not been published (no entryId, so no thread can exist) — not for one we merely failed to address.
    expect(read).toMatch(/if \(item\?\.entryId === undefined \|\| item\?\.entryId === null\) \{[\s\S]*?parentExists: false/);
    expect(read).toMatch(/if \(!coords\) return \{ comments: \[\], degraded: true \};/);
  });

  it('COORDS-08: a failed send gives the draft back — unless the text is already on screen', () => {
    const handlerStart = app.indexOf("publicComposer?.addEventListener('submit'");
    const handler = app.slice(handlerStart, app.indexOf("composer?.addEventListener('submit'", handlerStart));
    expect(handler).toContain('const recordsPlacedBefore = publicOptimisticRecordsPlaced;');
    expect(handler).toContain('if (publicOptimisticRecordsPlaced === recordsPlacedBefore) {');
    // It must NOT be gated on the price-cancel branch any more: that was the whole defect — every other failure
    // dropped what the user had written.
    expect(handler).not.toMatch(/if \(cancelled\) \{\s*\/\/[^\n]*\n\s*publicMessageInput\.value = text;/);
    // The counter moves where records are PLACED, so a newly added throw site is classified without being listed.
    for (const fn of ['function rememberLocalPublicPost(', 'function rememberLocalPublicComment(']) {
      const body = app.slice(app.indexOf(fn), app.indexOf(fn) + 400);
      expect(body, fn).toContain('publicOptimisticRecordsPlaced += 1;');
    }
  });
});
