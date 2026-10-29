import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { sourceBlock } from './helpers/source';
import { readPublicChannelFeedCache, writePublicChannelFeedCache } from '../web/public-channel-subscriptions.mjs';


const RAW = readFileSync('web/app.js', 'utf8');
const fn = (starts: string) => sourceBlock(RAW, starts);

const GLOBALS = new Set(Object.getOwnPropertyNames(globalThis));
function inert(): any {
  const self: any = new Proxy(function () { }, {
    get(_target, key) {
      if (key === Symbol.toPrimitive) return () => '';
      if (key === Symbol.iterator) return function* () { };
      if (key === 'then') return undefined;
      return self;
    },
    apply() { return self; },
    construct() { return self; },
    set() { return true; },
  });
  return self;
}
function inAppScope(sources: string[], exported: string, overrides: Record<string, any>) {
  const scope = new Proxy(overrides, {
    has(target, key) { return typeof key === 'string' && (key in target || !GLOBALS.has(key)); },
    get(target, key) {
      if (key === Symbol.unscopables) return undefined;
      if (typeof key === 'string' && key in target) return (target as any)[key];
      return inert();
    },
    set(target, key, value) { (target as any)[key] = value; return true; },
  });
  // eslint-disable-next-line no-new-func
  return new Function('scope', `with (scope) {\n${sources.join('\n')}\nreturn ${exported};\n}`)(scope);
}

const REAL = [
  'function publicFeedPostHasChainAnchor(',
  'function upsertPublicChainPosts(',
  'function publicFeedPostKey(',
  'function mergeLocalPendingPublicFeed(',
  'function isPendingPublicFeedItem(',
  'function samePublicBodyHash(',
  'function dropPostsBelowFeedGaps(',
  'function sharedPostShardCoordinates(',
  'function publicFeedPostsUnchanged(',
].map(fn);

const hash = (n: number) => `0x${n.toString(16).padStart(2, '0').repeat(32)}`;
const chainPost = (n: number, text: string, at: string) => ({
  id: `pshard-platho.app-${n}`, entryId: `20000.0.${n}`, bodyHash: hash(n), entryUid: `uid-${n}`, chainVerified: true,
  createdAt: at, text, comments: [],
});

function restartedCache(posts: any[]) {
  const store = new Map<string, string>();
  const storage = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value); } };
  writePublicChannelFeedCache(storage, { 'platho.app': { feed: { version: 1, channelId: 'platho.app', updatedAt: null, posts }, syncedAt: null } });
  const cache = readPublicChannelFeedCache(storage);
  expect(cache['platho.app'].feed.posts.every((post: any) => post.chainVerified === false), 'the load clears the flag').toBe(true);
  return cache;
}

function feedWorld(cache: any, freshRows: any[]) {
  const scope: any = {
    publicChannelFeedCache: cache,
    publicSyncInvalidationEpoch: 1,
    walletSessionGeneration: 1,
    PUBLIC_FEED_PROGRESSIVE_PAINT_MS: 250,
    directPublicLaneReader: () => ({
      readChannelPostsMany: async () => new Map([['W', freshRows]]),
      readPostAt: async () => freshRows,
    }),
    feedSourcePublicChannels: () => [{ id: 'platho.app', authorWallet: 'W' }],
    publicChannelKnownEntryRange: () => null,
    renderPublicSurface: () => {},
    publicPostPartsFromShardPosts: async (rows: any[]) => rows,
    assemblePublicParts: (parts: any[]) => parts.map((part) => ({ ...part })),
    applyHiddenBitmaps: (posts: any[]) => posts,
    mergePublicComments: (a: any[], b: any[]) => [...a, ...b],
    rawWalletAddress: (wallet: string) => wallet,
    sharedPostShardCoordinates: () => ({ epochTag: 20000, shardSeq: 0, shardEntryId: 9, generation: 17 }),
    ensurePublicChannelForAuthorWallet: () => 'platho.app',
    commitPublicChannelFeedCache: () => {},
  };
  return scope;
}

const texts = (scope: any) => scope.publicChannelFeedCache['platho.app'].feed.posts.map((post: any) => post.text);

describe('FEEDRESTART — what the device held is the base the first pass after a start lays its reads over', () => {
  it('FEEDRESTART-01: a read that came back empty after a restart keeps every stored post', async () => {
    const stored = [chainPost(1, 'one', '2026-09-20T10:00:00.000Z'), chainPost(2, 'two', '2026-09-21T10:00:00.000Z')];
    const scope = feedWorld(restartedCache(stored), []);
    const sync = inAppScope([...REAL, fn('async function syncPublicChannelFromShards(')], 'syncPublicChannelFromShards', scope);
    expect(await sync()).toBe(true);
    expect(texts(scope), 'nothing was deleted by a short read').toEqual(['one', 'two']);
  });

  it('FEEDRESTART-02: a re-read post replaces its stored copy — text and flag — and the rest stay', async () => {
    const stored = [chainPost(1, 'one', '2026-09-20T10:00:00.000Z'), chainPost(2, 'tampered', '2026-09-21T10:00:00.000Z')];
    const fresh = [chainPost(2, 'two from the chain', '2026-09-21T10:00:00.000Z'), chainPost(3, 'three', '2026-09-22T10:00:00.000Z')];
    const scope = feedWorld(restartedCache(stored), fresh);
    const sync = inAppScope([...REAL, fn('async function syncPublicChannelFromShards(')], 'syncPublicChannelFromShards', scope);
    await sync();
    const posts = scope.publicChannelFeedCache['platho.app'].feed.posts;
    expect(texts(scope)).toEqual(['one', 'two from the chain', 'three']);
    expect(posts.map((post: any) => post.chainVerified), 'read in this session: the flag again; stored only: still cleared').toEqual([false, true, true]);
  });

  it('FEEDRESTART-03: a post still on its way to the chain is carried as pending, never as a chain post; a post with no anchor is not one', async () => {
    const pending = { id: 'local-1', publishStatus: 'public published, confirming', bodyHash: hash(7), text: 'mine, on its way', createdAt: '2026-09-23T10:00:00.000Z' };
    const unanchored = { ...chainPost(4, 'no uid', '2026-09-19T10:00:00.000Z'), entryUid: undefined };
    const scope = feedWorld(restartedCache([chainPost(1, 'one', '2026-09-20T10:00:00.000Z'), pending, unanchored]), []);
    const sync = inAppScope([...REAL, fn('async function syncPublicChannelFromShards(')], 'syncPublicChannelFromShards', scope);
    await sync();
    expect(texts(scope)).toEqual(['one', 'mine, on its way']);
  });

  it('FEEDRESTART-04: the original of a shared post, fetched after a restart, joins the stored feed of its channel instead of replacing it', async () => {
    const stored = [chainPost(1, 'one', '2026-09-20T10:00:00.000Z'), chainPost(2, 'two', '2026-09-21T10:00:00.000Z')];
    const original = chainPost(9, 'the original', '2026-09-10T10:00:00.000Z');
    const scope = feedWorld(restartedCache(stored), [original]);
    const fetchPost = inAppScope([...REAL, fn('async function fetchPublicPostFromChain(')], 'fetchPublicPostFromChain', scope);
    const post = await fetchPost('20000.0.9', 'W', (item: any) => item.entryId === '20000.0.9');
    expect(post?.text).toBe('the original');
    expect(texts(scope)).toEqual(['the original', 'one', 'two']);
  });

  it('FEEDRESTART-05: the anchor is the entry id, the body hash and the entry uid — not the session flag', () => {
    const anchor = inAppScope([fn('function publicFeedPostHasChainAnchor(')], 'publicFeedPostHasChainAnchor', {});
    const post = chainPost(1, 'one', '2026-09-20T10:00:00.000Z');
    expect(anchor(post)).toBe(true);
    expect(anchor({ ...post, chainVerified: false }), 'stored from an earlier session').toBe(true);
    expect(anchor({ ...post, entryId: '' })).toBe(false);
    expect(anchor({ ...post, entryUid: null })).toBe(false);
    expect(anchor({ ...post, bodyHash: '0x1234' })).toBe(false);
  });
});
