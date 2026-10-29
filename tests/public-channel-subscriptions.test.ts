import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLATHO_APP_CONFIG } from '../web/platho-config.mjs';
import {
  DEFAULT_PUBLIC_CHANNEL_AUTHOR_WALLET,
  DEFAULT_PUBLIC_CHANNEL_ID,
  PUBLIC_CHANNEL_FEED_CACHE_KEY,
  createDefaultPublicChannelSubscriptions,
  normalizeChannelProfile,
  normalizePublicChannelFeed,
  normalizePublicChannelSubscriptions,
  publicChannelThreadsToFeedItems,
  sortPublicFeedItemsByTime,
  publicChannelSubscriptionsToThreads,
  readPublicChannelFeedCache,
  readPublicChannelProfileCache,
  publicChannelThreadId,
  subscribedPublicChannels,
  writePublicChannelFeedCache,
} from '../web/public-channel-subscriptions.mjs';

describe('PWA public channel subscriptions', () => {
  it('PUBLIC-SUB-01: first-run subscription seeds platho.app as the active read-only channel', () => {
    const state = createDefaultPublicChannelSubscriptions(PLATHO_APP_CONFIG.publicChannels);
    const channels = subscribedPublicChannels(state, PLATHO_APP_CONFIG.publicChannels);
    const threads = publicChannelSubscriptionsToThreads(state, PLATHO_APP_CONFIG.publicChannels, {});

    expect(state.activeChannelId).toBe(DEFAULT_PUBLIC_CHANNEL_ID);
    expect(channels.map((channel) => channel.id)).toEqual([DEFAULT_PUBLIC_CHANNEL_ID]);
    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({
      id: publicChannelThreadId(DEFAULT_PUBLIC_CHANNEL_ID),
      name: 'platho',
      readOnly: true,
      state: 'syncing',
    });

    expect(publicChannelThreadsToFeedItems(threads)).toEqual([]);
    const app = readFileSync('web/app.js', 'utf8');
    expect(app).toMatch(/if \(publicSyncPhase === 'syncing' && !publicChannelSearchQuery\) \{\s*(?:publicFeed\.append\(buildSkeletonNodes\('post', \d+\)\);\s*)?renderPublicEmpty\(t\('public\.previewWaitingFeed'\)/);
    expect(app).toMatch(/renderPublicEmpty\(publicChannelSearchQuery \? t\('public\.noPostsFound'\) : t\('public\.noPosts'\)/);
  });

  it('PUBLIC-SUB-02: config declares chain channel authors, not bundled channel messages', () => {
    expect(PLATHO_APP_CONFIG.publicChannels?.[0]).toMatchObject({
      id: 'platho.app',
      authorWallet: DEFAULT_PUBLIC_CHANNEL_AUTHOR_WALLET,
    });
    expect(PLATHO_APP_CONFIG.publicChannels?.[0]).not.toHaveProperty('sourceUrl');
    expect(PLATHO_APP_CONFIG.ui.publicFeed).toBeUndefined();
  });

  it('PUBLIC-SUB-03: fetched feed posts become read-only messenger thread messages', () => {
    const state = normalizePublicChannelSubscriptions(null, PLATHO_APP_CONFIG.publicChannels);
    const feed = normalizePublicChannelFeed({
      version: 1,
      channelId: 'platho.app',
      updatedAt: '2026-05-21T12:00:00.000Z',
      posts: [
        {
          id: 'post-1',
          createdAt: '2026-05-21T12:00:00.000Z',
          author: 'platho.app',
          authorWallet: `0:${'11'.repeat(32)}`,
          profileVersion: 3,
          avatarHash: `0x${'12'.repeat(32)}`,
          avatarImageUrl: 'data:image/webp;base64,AAAA',
          title: 'Public note',
          text: 'Readable without connecting a wallet.',
          entryId: '7',
          bodyHash: `0x${'aa'.repeat(32)}`,
          publishStatus: 'public publish submitted',
          publishState: { partCount: 1, submittedCount: 1 },
          commentsAllowed: false,
          comments: [
            {
              id: 'comment-1',
              entryId: '8',
              parentEntryId: '7',
              parentHash: `0x${'aa'.repeat(32)}`,
              createdAt: '2026-05-21T12:01:00.000Z',
              author: 'alex.ath',
              authorWallet: `0:${'22'.repeat(32)}`,
              profileVersion: 2,
              avatarHash: `0x${'34'.repeat(32)}`,
              avatarImageUrl: 'data:image/webp;base64,BBBB',
              text: 'One level only.',
            },
          ],
        },
      ],
    }, 'platho.app');

    const threads = publicChannelSubscriptionsToThreads(state, PLATHO_APP_CONFIG.publicChannels, {
      'platho.app': { feed },
    });

    expect(threads[0].readOnly).toBe(true);
    expect(threads[0].state).toBe('channel');
    expect(threads[0].preview).toBe('Public note');
    expect(threads[0].messages).toEqual([
      expect.objectContaining({
        type: 'in',
        publicChannelId: 'platho.app',
        publicPostId: 'post-1',
        publicPostTitle: 'Public note',
        publicPostText: 'Readable without connecting a wallet.',
        publicAuthorWallet: `0:${'11'.repeat(32)}`,
        publicProfileVersion: 3,
        publicAvatarHash: `0x${'12'.repeat(32)}`,
        publicAvatarImageUrl: 'data:image/webp;base64,AAAA',
        publicEntryId: '7',
        publicBodyHash: `0x${'aa'.repeat(32)}`,
        publicPublishStatus: 'public publish submitted',
        publicPublishState: { partCount: 1, submittedCount: 1 },
        publicCommentsAllowed: false,
        publicComments: [
          expect.objectContaining({
            id: 'comment-1',
            text: 'One level only.',
          }),
        ],
        text: 'Public note\nReadable without connecting a wallet.',
      }),
    ]);

    expect(publicChannelThreadsToFeedItems(threads)).toEqual([
      expect.objectContaining({
        title: 'Public note',
        text: 'Readable without connecting a wallet.',
        authorWallet: `0:${'11'.repeat(32)}`,
        profileVersion: 3,
        avatarHash: `0x${'12'.repeat(32)}`,
        avatarImageUrl: 'data:image/webp;base64,AAAA',
        publishStatus: 'public publish submitted',
        publishState: { partCount: 1, submittedCount: 1 },
        commentsAllowed: false,
        comments: [
          expect.objectContaining({
            text: 'One level only.',
            avatarImageUrl: 'data:image/webp;base64,BBBB',
          }),
        ],
      }),
    ]);
    expect(publicChannelThreadsToFeedItems(threads)[0]).not.toHaveProperty('threadId');
  });

  it('PUBLIC-SUB-ORDER-01: the feed is ONE list by post time — a late follow\'s new post outranks an early follow\'s old one', () => {
    const mk = (channelId: string, id: string, createdAt: string | null, entryId: string) => ({ id, channelId, createdAt, entryId });
    const quiet = [mk('quiet', 'q1', '2026-08-01T10:00:00.000Z', '1'), mk('quiet', 'q2', '2026-08-10T10:00:00.000Z', '2')];
    const talker = [mk('talker', 't1', '2026-08-05T10:00:00.000Z', '1'), mk('talker', 't2', '2026-08-20T10:00:00.000Z', '2')];
    const grouped = [...quiet, ...talker];
    const sorted = sortPublicFeedItemsByTime(grouped);
    expect(sorted.map((i: any) => i.id), 'interleaved by time, oldest first').toEqual(['q1', 't1', 'q2', 't2']);
    expect(sorted.slice().reverse().map((i: any) => i.id)).toEqual(['t2', 'q2', 't1', 'q1']);
    const tied = [mk('a', 'late-id', '2026-08-20T10:00:00.000Z', '9'), mk('b', 'early-id', '2026-08-20T10:00:00.000Z', '3'), mk('c', 'no-time', null, '7'), mk('d', 'bad-time', 'not a date', '8')];
    const tiedSorted = sortPublicFeedItemsByTime(tied);
    expect(tiedSorted.map((i: any) => i.id)).toEqual(['no-time', 'bad-time', 'early-id', 'late-id']);
    expect(tied.map((i: any) => i.id), 'the input array is left alone').toEqual(['late-id', 'early-id', 'no-time', 'bad-time']);
    expect(sortPublicFeedItemsByTime([])).toEqual([]);
    expect(sortPublicFeedItemsByTime(null as any)).toEqual([]);
    const state = normalizePublicChannelSubscriptions(null, PLATHO_APP_CONFIG.publicChannels);
    const feed = normalizePublicChannelFeed({
      version: 1, channelId: 'platho.app',
      posts: [{ id: 'p', createdAt: '2026-08-19T09:00:00.000Z', author: 'platho.app', authorWallet: `0:${'11'.repeat(32)}`, text: 'x', entryId: '4', bodyHash: `0x${'cc'.repeat(32)}` }],
    }, 'platho.app');
    const threads = publicChannelSubscriptionsToThreads(state, PLATHO_APP_CONFIG.publicChannels, { 'platho.app': { feed } });
    expect(publicChannelThreadsToFeedItems(threads)[0].createdAt).toBe('2026-08-19T09:00:00.000Z');
  });

  it('PUBLIC-SUB-03B: block posts keep ordered text and images through thread/feed conversion', () => {
    const state = normalizePublicChannelSubscriptions(null, PLATHO_APP_CONFIG.publicChannels);
    const blocks = [
      { type: 'text', text: 'First paragraph' },
      { type: 'image', url: 'data:image/webp;base64,AAAA' },
      { type: 'text', text: 'Second paragraph' },
      { type: 'image', url: 'data:image/webp;base64,BBBB' },
    ];
    const feed = normalizePublicChannelFeed({
      version: 1,
      channelId: 'platho.app',
      posts: [{
        id: 'post-blocks',
        createdAt: '2026-05-21T12:00:00.000Z',
        author: 'platho.app',
        authorWallet: `0:${'11'.repeat(32)}`,
        blocks,
        entryId: '7',
        bodyHash: `0x${'aa'.repeat(32)}`,
      }],
    }, 'platho.app');

    const threads = publicChannelSubscriptionsToThreads(state, PLATHO_APP_CONFIG.publicChannels, {
      'platho.app': { feed },
    });
    const message = threads[0].messages[0];

    expect(threads[0].preview).toBe('First paragraph');
    expect(message.text).toBe('First paragraph');
    expect(message.blocks).toEqual(blocks);
    expect(message.attachment).toBeNull();

    const roundtrip = publicChannelThreadsToFeedItems(threads)[0];
    expect(roundtrip.text).toBe('First paragraph');
    expect(roundtrip.blocks).toEqual(blocks);
    expect(roundtrip.imageUrl).toBeNull();
  });

  it('PUBLIC-CACHE-HASH-01: stored public cache loses chain-verified status until chain revalidation', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
    const cached = {
      'platho.app': {
        feed: {
          version: 1,
          channelId: 'platho.app',
          posts: [
            {
              id: 'post-1',
              entryId: '7',
              bodyHash: `0x${'aa'.repeat(32)}`,
              entryUid: 'abc123',
              chainVerified: true,
              text: 'Tampered local cache text',
              comments: [
                {
                  id: 'comment-1',
                  entryId: '8',
                  bodyHash: `0x${'bb'.repeat(32)}`,
                  entryUid: 'def456',
                  chainVerified: true,
                  text: 'Cached comment',
                },
              ],
            },
          ],
        },
      },
    };

    writePublicChannelFeedCache(storage, cached);
    expect(JSON.parse(store.get(PUBLIC_CHANNEL_FEED_CACHE_KEY) ?? '{}')['platho.app'].feed.posts[0].chainVerified).toBe(true);

    const loaded = readPublicChannelFeedCache(storage);
    const post = loaded['platho.app'].feed.posts[0];
    expect(post.chainVerified).toBe(false);
    expect(post.comments[0].chainVerified).toBe(false);
  });

  it('PUBLIC-SUB-MEDIA-STRIP: heavy base64 media is NOT persisted to localStorage (iOS Vault-freeze root fix)', () => {
    const store = new Map();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) };
    const big = (c: string) => `data:image/webp;base64,${c.repeat(5000)}`;
    const cached = {
      'wallet:abc': { feed: { posts: [{
        id: 'p1', entryId: '1', text: 'hi',
        imageUrl: big('A'), avatarImageUrl: big('B'),
        blocks: [{ type: 'image', url: big('C') }, { type: 'text', text: 'kept' }],
        comments: [{ id: 'c1', text: 'c', imageUrl: big('D'), avatarImageUrl: big('E') }],
      }] } },
    };
    writePublicChannelFeedCache(storage, cached);
    const raw = store.get(PUBLIC_CHANNEL_FEED_CACHE_KEY) ?? '';
    expect(raw).not.toMatch(/data:image/);
    expect(raw).not.toContain('"imageUrl"');
    expect(raw).not.toContain('"avatarImageUrl"');
    expect(raw).not.toContain('"url"');
    expect(raw).toContain('"text":"hi"');
    expect(raw).toContain('"text":"kept"');
  });

  it('PUBLIC-SUB-MEDIA-STRIP-02: a retained signed external is NOT persisted either — it stays in memory', () => {
    const store = new Map();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) };
    const cached = {
      'wallet:abc': { feed: { posts: [{
        id: 'p1', text: 'a post awaiting confirmation',
        publishStatus: 'public publish unconfirmed, retrying',
        publicDirectSend: { boc: 'te6ccg'.repeat(8000), at: 1_790_000_000_000, seqno: 12, rebroadcastAt: null },
        comments: [],
      }] } },
    };
    writePublicChannelFeedCache(storage, cached);
    const raw = store.get(PUBLIC_CHANNEL_FEED_CACHE_KEY) ?? '';

    expect(raw, 'the external itself is gone').not.toContain('te6ccg');
    expect(raw, 'and so is its key').not.toContain('"boc"');
    expect(raw.length, 'what is left is small — the whole point').toBeLessThan(1000);
    expect(raw).toContain('"publishStatus":"public publish unconfirmed, retrying"');
    expect(raw).toContain('"seqno":12');
    expect(raw).toContain('"text":"a post awaiting confirmation"');
  });

  it('PUBLIC-SUB-04: stored unsubscribe is preserved and not re-seeded on every reload', () => {
    const state = normalizePublicChannelSubscriptions({
      version: 1,
      activeChannelId: 'platho.app',
      channels: [{ id: 'platho.app', subscribed: false }],
    }, PLATHO_APP_CONFIG.publicChannels);

    expect(state.channels).toEqual([{ id: 'platho.app', subscribed: false }]);
    expect(subscribedPublicChannels(state, PLATHO_APP_CONFIG.publicChannels)).toEqual([]);
    expect(publicChannelSubscriptionsToThreads(state, PLATHO_APP_CONFIG.publicChannels, {})).toEqual([]);
  });

  it('PUBLIC-SUB-05: custom on-chain channels can be subscribed by author wallet without a feed URL', () => {
    const authorWallet = `0:${'33'.repeat(32)}`;
    const registry = [
      ...PLATHO_APP_CONFIG.publicChannels,
      {
        id: `wallet:${authorWallet}`,
        name: 'Builder',
        avatar: 'B',
        subtitle: 'on-chain public channel',
        authorWallet,
      },
    ];
    const state = normalizePublicChannelSubscriptions({
      version: 1,
      activeChannelId: `wallet:${authorWallet}`,
      channels: [
        { id: 'platho.app', subscribed: true },
        { id: `wallet:${authorWallet}`, subscribed: true },
      ],
    }, registry);
    const channels = subscribedPublicChannels(state, registry);

    expect(channels.map((channel) => channel.id)).toContain(`wallet:${authorWallet}`);
    expect(channels.find((channel) => channel.id === `wallet:${authorWallet}`)).toMatchObject({
      name: 'Builder',
      authorWallet,
    });
  });
});

describe('The feed cache bounds itself', () => {

  function boundedStorage(limit: number) {
    const data = new Map<string, string>();
    return {
      storage: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => {
          if (value.length > limit) {
            const error: any = new Error('QuotaExceededError');
            error.name = 'QuotaExceededError';
            throw error;
          }
          data.set(key, value);
        },
        removeItem: (key: string) => { data.delete(key); },
      },
      stored: () => data.get(PUBLIC_CHANNEL_FEED_CACHE_KEY) ?? null,
    };
  }

  const postsOf = (count: number) => Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    entryId: `20800.0.${i}`,
    text: 'x'.repeat(200),
    createdAt: new Date(1_790_000_000_000 + i * 60_000).toISOString(),
    comments: [],
  }));
  const cacheOf = (count: number) => ({
    'a.ath': { syncedAt: 'S', feed: { version: 1, channelId: 'a.ath', updatedAt: 'S', posts: postsOf(count) } },
  });
  const postsIn = (stored: any) => stored?.['a.ath']?.feed?.posts ?? stored?.['a.ath'] ?? [];

  it('PUBLIC-CACHE-01: an oversized cache is TRIMMED until it fits, newest kept', () => {
    const big = cacheOf(200);
    const room = boundedStorage(20_000);
    expect(writePublicChannelFeedCache(room.storage as any, big), 'it must find a size that fits').toBe(true);
    const stored = JSON.parse(String(room.stored()));
    const kept = postsIn(stored);
    expect(stored['a.ath'].feed?.version, 'the feed wrapper must survive').toBe(1);
    expect(stored['a.ath'].syncedAt, 'and the fields beside it').toBe('S');
    expect(kept.length, 'something was kept').toBeGreaterThan(0);
    expect(kept.length, 'and it is smaller than what was handed in').toBeLessThan(200);
    expect(kept[kept.length - 1].id).toBe('p199');
    const oldestKept = Math.min(...kept.map((post: any) => Number(String(post.id).slice(1))));
    expect(oldestKept, 'the survivors are a suffix of the timeline, not a random subset')
      .toBe(200 - kept.length);
  });

  it('PUBLIC-CACHE-02: a cache that already fits is written whole, untouched', () => {
    const small = cacheOf(3);
    const room = boundedStorage(1_000_000);
    expect(writePublicChannelFeedCache(room.storage as any, small)).toBe(true);
    expect(postsIn(JSON.parse(String(room.stored())))).toHaveLength(3);
  });

  it('PUBLIC-CACHE-03: a storage that refuses everything answers FALSE — never a silent stale snapshot', () => {
    const room = boundedStorage(0);
    expect(writePublicChannelFeedCache(room.storage as any, cacheOf(5))).toBe(false);
    expect(room.stored(), 'nothing may be claimed as stored').toBeNull();
    expect(writePublicChannelFeedCache({} as any, cacheOf(1))).toBe(false);
  });
  it('PUBLIC-CACHE-04: the fixture is the shape app.js writes — checked against app.js, not assumed', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const writes = [...app.matchAll(/\[channel(?:Id|\.id)\]: \{ feed: \{/g)].length
      + [...app.matchAll(/feed: \{ version: 1, channelId/g)].length;
    expect(writes, 'app.js must still write the wrapper this fixture models').toBeGreaterThan(0);
    expect(app, 'a bare post array is not a shape this app produces')
      .not.toMatch(/publicChannelFeedCache\[[^\]]+\] = \[/);
    const subs = readFileSync('web/public-channel-subscriptions.mjs', 'utf8');
    expect(subs, 'the trim must read through the wrapper').toContain('const feed = record?.feed ?? record;');
    expect(subs, 'and write it back intact').toContain('return record?.feed ? { ...record, feed: nextFeed } : nextFeed;');
  });

  it('PUBLIC-CACHE-05: the device keeps each channel\'s newest window — the session keeps the rest — and a quota refusal leaves room and is adopted', () => {
    const roomy = boundedStorage(10_000_000);
    const cache = cacheOf(40);
    expect(writePublicChannelFeedCache(roomy.storage as any, cache, { perChannelMax: 10 })).toBe(true);
    const kept = postsIn(JSON.parse(String(roomy.stored())));
    expect(kept.map((post: any) => post.id), 'the newest ten, in their order').toEqual(Array.from({ length: 10 }, (_, i) => `p${30 + i}`));
    expect(postsIn(cache), 'what the session holds is not touched by the bound').toHaveLength(40);
    const whole = JSON.stringify(cacheOf(200)).length;
    const tight = boundedStorage(Math.floor(whole * 0.6));
    let adopted: any = null;
    expect(writePublicChannelFeedCache(tight.storage as any, cacheOf(200), { onTrimmed: (value: any) => { adopted = value; } })).toBe(true);
    const storedPosts = postsIn(JSON.parse(String(tight.stored())));
    expect(adopted, 'the trimmed copy goes back to the caller').not.toBeNull();
    expect(postsIn(adopted).length, 'the caller keeps what the device kept').toBe(storedPosts.length);
    expect(String(tight.stored()).length, 'a quarter of room left under the quota, not a brim-full write').toBeLessThan(Math.floor(whole * 0.6) * 0.8);
    expect(storedPosts.at(-1).id, 'the newest survive').toBe('p199');
    let untouched = true;
    writePublicChannelFeedCache(boundedStorage(10_000_000).storage as any, cacheOf(5), { onTrimmed: () => { untouched = false; } });
    expect(untouched).toBe(true);
    const app = readFileSync('web/app.js', 'utf8');
    expect(app).toContain('perChannelMax: PUBLIC_FEED_RENDER_CAP,');
    expect(app).toContain('onTrimmed: (trimmed) => { publicChannelFeedCache = trimmed; },');
    expect(app.match(/writePublicChannelFeedCache\(/g)?.length, 'one caller: persistPublicChannelFeedCache').toBe(1);
  });
});

describe('The channel profile cache survives a record without every field', () => {
  const record = {
    description: 'about', tags: ['a'], entryId: '2', createdAtSec: 1, fetchedAt: 1,
    ownerUsername: 'lacewing', verifiedUsername: 'lacewing',
  };
  const gift = '0:6a6a6a6a6a6a6a6a6a6a6a6a6a6a6a6a6a6a6a6a6a6a6a6a6a6a6a6a6a6a6a6a';

  it('PROFILE-CACHE-01: a record from before the worn-gift field normalizes, with the claim absent', () => {
    const profile = normalizeChannelProfile(record);
    expect(profile).not.toBeNull();
    expect(profile?.description).toBe('about');
    expect(profile?.wornGift).toBeNull();
    expect(normalizeChannelProfile({ ...record, wornGift: null })?.wornGift).toBeNull();
    expect(normalizeChannelProfile({ ...record, wornGift: '' })?.wornGift).toBeNull();
    expect(normalizeChannelProfile({ ...record, wornGift: gift.toUpperCase() })?.wornGift).toBe(gift);
    expect(normalizeChannelProfile({ ...record, wornGift: 'not an address' })?.wornGift).toBeNull();
  });

  it('PROFILE-CACHE-02: a look without a gift, and a gift record without an address, do not throw either', () => {
    const look = normalizeChannelProfile({
      ...record,
      appearance: { kind: 'look', theme: 'light', background: 'plasma', settings: [90, 6, 3, 4], itemAddress: null },
    });
    expect(look?.appearance).toEqual({ kind: 'look', theme: 'light', background: 'plasma', settings: [90, 6, 3, 4], itemAddress: null });
    expect(normalizeChannelProfile({ ...record, appearance: { kind: 'look' } })?.appearance?.kind).toBe('look');
    expect(normalizeChannelProfile({ ...record, appearance: { kind: 'telegram-gift' } })?.appearance).toBeNull();
    expect(normalizeChannelProfile({ ...record, verifiedGift: { slug: 'starnotepad', number: 1 } })?.verifiedGift).toBeNull();
    expect(normalizeChannelProfile({ ...record, verifiedGift: { itemAddress: gift, slug: 'starnotepad', number: 14609, verifiedAt: 5 } })?.verifiedGift)
      .toEqual({ itemAddress: gift, slug: 'starnotepad', number: 14609, verifiedAt: 5 });
  });

  it('PROFILE-CACHE-03: the cache on disk loads whole — one odd record must not empty it', () => {
    const stored = {
      '0:aa': record,
      '0:bb': { ...record, appearance: { kind: 'look', theme: 'dark', background: 'nodes', settings: [1, 2, 3, 4], itemAddress: null } },
      '0:cc': { ...record, wornGift: gift, verifiedGift: { itemAddress: gift, slug: 'starnotepad', number: 14609, verifiedAt: 5 } },
    };
    const storage = { getItem: () => JSON.stringify(stored), setItem: () => undefined };
    const cache = readPublicChannelProfileCache(storage as any);
    expect(Object.keys(cache).sort()).toEqual(['0:aa', '0:bb', '0:cc']);
    expect(cache['0:cc'].wornGift).toBe(gift);
    expect(cache['0:bb'].appearance?.background).toBe('nodes');
  });

  it('PROFILE-CACHE-04: no normalizer in the module lower-cases the answer of nonEmptyString', () => {
    const subs = readFileSync('web/public-channel-subscriptions.mjs', 'utf8');
    expect(subs).not.toMatch(/nonEmptyString\([^\n]*\)\.toLowerCase\(\)/);
    expect(subs, 'the profile address fields go through one throw-free helper').toContain('function rawAddressOrNull(value)');
  });
});
