import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// A COMMENT NEEDS THE PARENT POST'S CHAIN COORDINATES, AND THE FEED ITEM DID NOT HAVE THEM.
//
// Owner, 2026-08-13: Console:
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
  // ANCHORED ON THE DECLARATION, NOT ON THE PROSE ABOVE IT [2026-08-31]. This used to slice from the doc
  // comment's first line, so rewording that comment — which round 5 did, when the generation became a fourth
  // coordinate — silently made the slice EMPTY and every assertion below failed on an undefined function.
  // A signature is the thing this test is actually about; a sentence is not.
  const start = app.indexOf('function sharedPostShardCoordinates(');
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
      // THE FOURTH COORDINATE [round 5]. A three-part id says nothing about the generation, and 17 is what that
      // means — it is the generation every post written so far was published by. Its thread address is therefore
      // byte-identical to what it has always been (publicPostUid folds nothing extra for 17).
      generation: 17,
    });
  });

  it('COORDS-01G: a FOUR-part id names its generation — the straddle-era twin is a different post', () => {
    // The flip gives one (epoch_tag, seq, entry_id) two shards, and both number entries from 0 — so without this
    // fourth coordinate the gen-17 and gen-18 posts at the same index share a feed id AND a comment thread.
    const { publicPostChainCoordinates } = loadCoordinateFunctions();
    expect(publicPostChainCoordinates({ entryId: '441.2.7.18', authorWallet: WALLET })).toEqual({
      authorWallet: WALLET, epochTag: 441n, shardSeq: 2, shardEntryId: 7n, generation: 18,
    });
    // A post carried straight from the walk states it on the item itself; that wins over the parsed id.
    expect(publicPostChainCoordinates({ entryId: '441.2.7', authorWallet: WALLET, generation: 18 }).generation)
      .toBe(18);
  });

  it('COORDS-02: the raw per-shard entry id is NOT the composite, and the shard seq is NOT assumed to be 0', () => {
    const { publicPostChainCoordinates } = loadCoordinateFunctions();
    const overflow = publicPostChainCoordinates({ entryId: '441.2.7', authorWallet: WALLET });
    // Folding the composite (or a 0 shard seq) addresses a different shard, and the post's thread is never found.
    expect(overflow.shardEntryId).toBe(7n);
    expect(overflow.shardSeq).toBe(2);
    expect(publicPostChainCoordinates({ entryId: '441.0.0', authorWallet: WALLET }))
      .toEqual({ authorWallet: WALLET, epochTag: 441n, shardSeq: 0, shardEntryId: 0n, generation: 17 });
  });

  it('COORDS-03: an explicitly-carried coordinate still wins, so a freshly-walked post is unaffected', () => {
    const { publicPostChainCoordinates } = loadCoordinateFunctions();
    const walked = {
      entryId: '441.2.7', authorWallet: WALLET,
      channelEpochTag: '441', channelShardSeq: 2, shardEntryId: '7',
    };
    expect(publicPostChainCoordinates(walked))
      .toEqual({ authorWallet: WALLET, epochTag: 441n, shardSeq: 2, shardEntryId: 7n, generation: 17 });
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
  it('CMTSEAT-01: two people writing the same words are two comments, not one', async () => {
    // [audit 2026-09-01, round 9.] A comment's feed identity was the hash of its BODY cell alone — and the PPH2
    // body carries only the document bytes, while the timestamp, the streamId and the publisher live in the
    // header. MEASURED: Alice and Bob each commenting "ok" under one post produced ONE key from two chain rows.
    // assemblePublicParts groups by `single:${channelId}:${entryId}`, so the later one was dropped as a duplicate
    // and no reader ever saw it — after paying ~0.022 GRAM for it. "ok", "+1" and an emoji make that routine.
    const app = readFileSync('web/app.js', 'utf8');
    const at = app.indexOf('async function publicThreadPostsToComments(');
    expect(at, 'the comment mapper must still be there').toBeGreaterThan(-1);
    let depth = 0; let stop = -1;
    for (let i = app.indexOf('{', at); i < app.length; i += 1) {
      if (app[i] === '{') depth += 1;
      else if (app[i] === '}') { depth -= 1; if (depth === 0) { stop = i + 1; break; } }
    }
    const mapper = app.slice(at, stop);

    // The identity is the chain SEAT — the shard the row lives in plus its row number, which is exactly the
    // coordinate a post already uses and which the comment object was already carrying, unused.
    expect(mapper).toContain('const commentSeat = tp.shard_key !== undefined && tp.shard_key !== null');
    expect(mapper).toContain('`${String(tp.shard_key)}.${Number(tp.entry_id)}`');
    expect(mapper, 'the feed id must be built from the seat').toContain('entryId: `c-${commentUid}`');
    expect(mapper, 'and so must the short id and the uid the reading position stores')
      .toContain('id: `pshard-c-${commentUid.slice(0, 16)}`');
    expect(mapper).toContain('entryUid: commentUid,');
    // The body hash survives only as the fallback for a row with no seat — a LOCAL-PENDING comment, which is
    // exactly the case that has no chain row yet.
    expect(mapper).toContain('const commentUid = commentSeat ? await publicCommentSeatUid(commentSeat) : bodyHashHex.slice(2);');
  });

  it('CMTSEAT-02: only the author of a pending comment can retire it', async () => {
    // The other half. The retire matched on body hash alone, so a STRANGER's identical comment retired this
    // device's pending one as confirmed: the pending record vanished, the UI turned green, and the entry it
    // stood for was never published.
    const app = readFileSync('web/app.js', 'utf8');
    const at = app.indexOf('function retireConfirmedLocalPublicComments(');
    expect(at, 'the retire path must still be there').toBeGreaterThan(-1);
    const body = app.slice(at, app.indexOf('\n}', at));
    expect(body).toContain('samePublicBodyHash(comment, chainComment)');
    expect(body, 'the author must match too').toContain('sameWalletAddress(comment.authorWallet, chainComment.authorWallet)');
  });
  it('CMTSEAT-03: a comment cached under the OLD id does not double up beside its re-read twin', () => {
    // THE CONSUMER I ALMOST MISSED [audit 2026-09-01, round 9]. Changing a comment's identity is not a local
    // edit: comments are PERSISTED, mergePublicComments dedups by entryId, and normalizeFeedComment does not keep
    // the chain seat — so a comment cached by an older build cannot have its new id recomputed, and the merge
    // would have shown the SAME comment twice in every thread the reader already had cached. Caught by tracing
    // the changed line to its consumers rather than by a test going red.
    const app = readFileSync('web/app.js', 'utf8');
    const at = app.indexOf('function mergePublicComments(');
    expect(at, 'the merge must still be there').toBeGreaterThan(-1);
    let depth = 0; let stop = -1;
    for (let i = app.indexOf('{', at); i < app.length; i += 1) {
      if (app[i] === '{') depth += 1;
      else if (app[i] === '}') { depth -= 1; if (depth === 0) { stop = i + 1; break; } }
    }
    const merge = app.slice(at, stop);
    // eslint-disable-next-line no-new-func
    const run = new Function('rawWalletAddress', `
      ${app.slice(app.indexOf('function isLegacyBodyHashCommentId('), app.indexOf('function mergePublicComments('))}
      ${merge}
      return mergePublicComments;
    `)((a: any) => (a == null ? null : String(a).toLowerCase()));

    const HASH = '0xbeef';
    const ME = '0:AAA';
    const cachedLegacy = { entryId: `c-beef`, bodyHash: HASH, authorWallet: ME, createdAt: '2026-09-01T10:00:00.000Z', text: 'ok' };
    const freshSeated = { entryId: 'c-9f2c', bodyHash: HASH, authorWallet: ME, createdAt: '2026-09-01T10:00:00.000Z', text: 'ok' };
    const merged = run([cachedLegacy], [freshSeated]);
    expect(merged, 'one comment, not two').toHaveLength(1);
    expect(merged[0].entryId, 'and it is the one with a chain seat').toBe('c-9f2c');

    // A DIFFERENT author's identical words are still their own comment — the whole point of the seat identity.
    const theirs = { entryId: 'c-77aa', bodyHash: HASH, authorWallet: '0:BBB', createdAt: '2026-09-01T10:01:00.000Z', text: 'ok' };
    expect(run([cachedLegacy], [freshSeated, theirs]), 'two people, two comments').toHaveLength(2);

    // And a legacy comment with no seated twin yet is kept: it is a real comment the reader can still see.
    const orphan = { entryId: 'c-dead', bodyHash: '0xdead', authorWallet: ME, createdAt: '2026-09-01T09:00:00.000Z', text: 'hi' };
    expect(run([orphan], []), 'nothing is dropped for having an old id alone').toHaveLength(1);
  });
});
