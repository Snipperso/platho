import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';


const app = readFileSync('web/app.js', 'utf8');
const subs = readFileSync('web/public-channel-subscriptions.mjs', 'utf8');

function loadCoordinateFunctions() {
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
    const feedItem = { entryId: '441.2.7', authorWallet: WALLET, channelId: 'lace.ath' };
    expect(publicPostChainCoordinates(feedItem)).toEqual({
      authorWallet: WALLET,
      epochTag: 441n,
      shardSeq: 2,
      shardEntryId: 7n,
      generation: 17,
    });
  });

  it('COORDS-01G: a FOUR-part id names its generation — the straddle-era twin is a different post', () => {
    const { publicPostChainCoordinates } = loadCoordinateFunctions();
    expect(publicPostChainCoordinates({ entryId: '441.2.7.18', authorWallet: WALLET })).toEqual({
      authorWallet: WALLET, epochTag: 441n, shardSeq: 2, shardEntryId: 7n, generation: 18,
    });
    expect(publicPostChainCoordinates({ entryId: '441.2.7', authorWallet: WALLET, generation: 18 }).generation)
      .toBe(18);
  });

  it('COORDS-02: the raw per-shard entry id is NOT the composite, and the shard seq is NOT assumed to be 0', () => {
    const { publicPostChainCoordinates } = loadCoordinateFunctions();
    const overflow = publicPostChainCoordinates({ entryId: '441.2.7', authorWallet: WALLET });
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
    expect(publicPostChainCoordinates({ entryId: null, authorWallet: WALLET })).toBeNull();
    expect(publicPostChainCoordinates({ entryId: '441.2.7', authorWallet: null })).toBeNull();
    expect(publicPostChainCoordinates({ entryId: '12345', authorWallet: WALLET })).toBeNull();
    expect(publicPostChainCoordinates(null)).toBeNull();
  });

  it('COORDS-05: BOTH the read and the write go through the primitive — no direct field reads left', () => {
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
    const item = subs.slice(
      subs.indexOf('export function publicChannelThreadsToFeedItems('),
      subs.indexOf('export function clonePublicChannelSubscriptions('),
    );
    expect(item).not.toContain('channelEpochTag');
    const normalizer = subs.slice(subs.indexOf('function normalizeFeedPost('), subs.indexOf('function normalizeFeedComment('));
    expect(normalizer).not.toContain('channelEpochTag');
  });

  it('COORDS-07: an unaddressable published post reports UNKNOWN, never "no comments yet"', () => {
    const read = app.slice(
      app.indexOf('async function loadPublicPostCommentsFromShards('),
      app.indexOf('async function loadPublicPostComments(item, options = {})'),
    );
    expect(read).toMatch(/if \(item\?\.entryId === undefined \|\| item\?\.entryId === null\) \{[\s\S]*?parentExists: false/);
    expect(read).toMatch(/if \(!coords\) return \{ comments: \[\], degraded: true \};/);
  });

  it('COORDS-08: a failed send gives the draft back — unless the text is already on screen', () => {
    const handlerStart = app.indexOf("publicComposer?.addEventListener('submit'");
    const handler = app.slice(handlerStart, app.indexOf("composer?.addEventListener('submit'", handlerStart));
    expect(handler).toContain('const recordsPlacedBefore = publicOptimisticRecordsPlaced;');
    expect(handler).toContain('if (publicOptimisticRecordsPlaced === recordsPlacedBefore || error?.publicRowTakenBack === true) {');
    expect(handler).not.toMatch(/if \(cancelled\) \{\s*\/\/[^\n]*\n\s*publicMessageInput\.value = text;/);
    for (const fn of ['function rememberLocalPublicPost(', 'function rememberLocalPublicComment(']) {
      const body = app.slice(app.indexOf(fn), app.indexOf('\n}\n', app.indexOf(fn)));
      expect(body, fn).toContain('publicOptimisticRecordsPlaced += 1;');
      if (fn === 'function rememberLocalPublicComment(') {
        expect(body.indexOf('publicOptimisticRecordsPlaced += 1;')).toBeGreaterThan(body.indexOf('if (index >= 0) {'));
      }
    }
  });
  it('CMTSEAT-01: two people writing the same words are two comments, not one', async () => {
    const app = readFileSync('web/app.js', 'utf8');
    const at = app.indexOf('async function publicThreadPostsToComments(');
    expect(at, 'the comment mapper must still be there').toBeGreaterThan(-1);
    let depth = 0; let stop = -1;
    for (let i = app.indexOf('{', at); i < app.length; i += 1) {
      if (app[i] === '{') depth += 1;
      else if (app[i] === '}') { depth -= 1; if (depth === 0) { stop = i + 1; break; } }
    }
    const mapper = app.slice(at, stop);

    expect(mapper).toContain('const commentSeat = tp.shard_key !== undefined && tp.shard_key !== null');
    expect(mapper).toContain('`${String(tp.shard_key)}.${Number(tp.entry_id)}`');
    expect(mapper, 'the feed id must be built from the seat').toContain('entryId: `c-${commentUid}`');
    expect(mapper, 'and so must the short id and the uid the reading position stores')
      .toContain('id: `pshard-c-${commentUid.slice(0, 16)}`');
    expect(mapper).toContain('entryUid: commentUid,');
    expect(mapper).toContain('const commentUid = commentSeat ? await publicCommentSeatUid(commentSeat) : bodyHashHex.slice(2);');
  });

  it('CMTSEAT-02: only the author of a pending comment can retire it', async () => {
    const app = readFileSync('web/app.js', 'utf8');
    const at = app.indexOf('function retireConfirmedLocalPublicComments(');
    expect(at, 'the retire path must still be there').toBeGreaterThan(-1);
    const body = app.slice(at, app.indexOf('\n}', at));
    expect(body).toContain('samePublicBodyHash(comment, chainComment)');
    expect(body, 'the author must match too').toContain('sameWalletAddress(comment.authorWallet, chainComment.authorWallet)');
  });
  it('CMTSEAT-03: a comment cached under the OLD id does not double up beside its re-read twin', () => {
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

    const theirs = { entryId: 'c-77aa', bodyHash: HASH, authorWallet: '0:BBB', createdAt: '2026-09-01T10:01:00.000Z', text: 'ok' };
    expect(run([cachedLegacy], [freshSeated, theirs]), 'two people, two comments').toHaveLength(2);

    const orphan = { entryId: 'c-dead', bodyHash: '0xdead', authorWallet: ME, createdAt: '2026-09-01T09:00:00.000Z', text: 'hi' };
    expect(run([orphan], []), 'nothing is dropped for having an old id alone').toHaveLength(1);
  });
});
