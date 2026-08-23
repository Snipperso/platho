import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLATHO_APP_CONFIG } from '../web/platho-config.mjs';
import {
  DEFAULT_PUBLIC_CHANNEL_AUTHOR_WALLET,
  DEFAULT_PUBLIC_CHANNEL_ID,
  PUBLIC_CHANNEL_FEED_CACHE_KEY,
  createDefaultPublicChannelSubscriptions,
  normalizePublicChannelFeed,
  normalizePublicChannelSubscriptions,
  publicChannelThreadsToFeedItems,
  sortPublicFeedItemsByTime,
  publicChannelSubscriptionsToThreads,
  readPublicChannelFeedCache,
  publicChannelThreadId,
  subscribedPublicChannels,
  writePublicChannelFeedCache,
  publicEvictionFloor,
  prunePublicPostsBelowFloor,
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

    // [OWNER 2026-08-09] The seeded channel produces NO feed item until it actually has posts. It used to emit a
    // placeholder card reading "waiting for public feed", which was an empty seat held for a channel that may never
    // publish — the owner asked for those gone. The SUBSCRIPTION above is what survives, and it is asserted intact.
    //
    // The placeholder had a SECOND job nobody had written down: on a fresh install it was the only thing in the
    // Public tab while platho.app's posts were still loading, so removing it blanked the first run. That job moved
    // to the feed's own empty state, which now says "waiting" while publicSyncPhase is 'syncing' and only claims
    // "no public posts" once the sync has settled — said once for the whole feed instead of once per silent
    // channel. Pinned here because this test is where the two behaviours meet.
    expect(publicChannelThreadsToFeedItems(threads)).toEqual([]);
    const app = readFileSync('web/app.js', 'utf8');
    // The 2026-08 redesign paints two skeleton cards above the waiting line; the waiting line itself is unchanged.
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
    // OWNER 2026-08-21: "I follow many people; one of them posted, and the new post appeared at the BOTTOM next to
    // his old one, while silent channels stayed on top." The feed items came out grouped by channel in thread order.
    // The order now belongs to the posts: oldest first here (the renderer reverses), ties by entryId then position,
    // and a post without a parseable time sinks to the OLD end — unknown is not new.
    const mk = (channelId: string, id: string, createdAt: string | null, entryId: string) => ({ id, channelId, createdAt, entryId });
    const quiet = [mk('quiet', 'q1', '2026-08-01T10:00:00.000Z', '1'), mk('quiet', 'q2', '2026-08-10T10:00:00.000Z', '2')];
    const talker = [mk('talker', 't1', '2026-08-05T10:00:00.000Z', '1'), mk('talker', 't2', '2026-08-20T10:00:00.000Z', '2')];
    // Thread order: the quiet channel was followed first, the talker later — the grouping the owner saw.
    const grouped = [...quiet, ...talker];
    const sorted = sortPublicFeedItemsByTime(grouped);
    expect(sorted.map((i: any) => i.id), 'interleaved by time, oldest first').toEqual(['q1', 't1', 'q2', 't2']);
    // Displayed newest-first that is: t2 (his new post), q2, t1 (his old post), q1 — exactly the owner's wish.
    expect(sorted.slice().reverse().map((i: any) => i.id)).toEqual(['t2', 'q2', 't1', 'q1']);
    // Ties: same instant → entryId decides; no time → the old end; the input is not mutated and the sort is stable.
    const tied = [mk('a', 'late-id', '2026-08-20T10:00:00.000Z', '9'), mk('b', 'early-id', '2026-08-20T10:00:00.000Z', '3'), mk('c', 'no-time', null, '7'), mk('d', 'bad-time', 'not a date', '8')];
    const tiedSorted = sortPublicFeedItemsByTime(tied);
    expect(tiedSorted.map((i: any) => i.id)).toEqual(['no-time', 'bad-time', 'early-id', 'late-id']);
    expect(tied.map((i: any) => i.id), 'the input array is left alone').toEqual(['late-id', 'early-id', 'no-time', 'bad-time']);
    expect(sortPublicFeedItemsByTime([])).toEqual([]);
    expect(sortPublicFeedItemsByTime(null as any)).toEqual([]);
    // And the item carries the time it is sorted by, straight from the cached post.
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
    // A localStorage feed cache bloated with base64 media made every synchronous setItem re-serialize the
    // whole store on iOS WebKit -> a multi-second Vault-tab freeze (even on iPhone 16 Pro Max). The persisted
    // copy must carry NO base64 media; the light text/metadata stays (images re-derive from chain on sync).
    expect(raw).not.toMatch(/data:image/);
    expect(raw).not.toContain('"imageUrl"');
    expect(raw).not.toContain('"avatarImageUrl"');
    expect(raw).not.toContain('"url"');
    expect(raw).toContain('"text":"hi"');
    expect(raw).toContain('"text":"kept"');
  });

  it('PUBLIC-SUB-MEDIA-STRIP-02: a retained signed external is NOT persisted either — it stays in memory', () => {
    // An ambiguous public broadcast keeps its signed external so the resume can re-send it verbatim (same seqno,
    // so the chain runs it at most once). That external must never reach this value: it runs to tens of KB for a
    // media post, and THIS WHOLE CACHE IS ONE localStorage ENTRY whose write fails SILENTLY on quota — persisting
    // it would trade one unconfirmed post for the loss of the entire cached feed, which is the worse bargain.
    // The rest of the record is persisted, so the pending post still survives a reload and still terminals on the
    // no-progress deadline; only the in-session re-broadcast depends on the in-memory copy.
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
    // The record and everything the deadline terminal needs are still there.
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

describe('Public eviction floor + prune (Phase 3)', () => {
  // entryIds are 0-indexed; public_latest_id (latest) is the NEXT id, so the highest live id is latest-1 and the
  // live id range is [latest - live_count, latest - 1]. The floor (oldest-live id) is EXACTLY latest - live_count.
  // An off-by-one here would silently drop the OLDEST LIVE post every cycle — so this is checked NUMERICALLY.
  it('PUBLIC-EVICT-FLOOR-01: floor = latest - live_count (the oldest-live id), keeping the oldest live entry', () => {
    // Fresh chain, 3 posts (ids 0,1,2), nothing evicted: latest=3, live=3 -> floor 0 (keep all).
    expect(publicEvictionFloor(3n, 3n)).toBe(0n);
    // After evicting ids 0..4 (O=5): ids 5..9 live, latest=10, live=5 -> floor 5 (the oldest LIVE id, kept).
    expect(publicEvictionFloor(10n, 5n)).toBe(5n);
    // One post, none evicted: latest=1, live=1 -> floor 0.
    expect(publicEvictionFloor(1n, 1n)).toBe(0n);
    // Everything evicted: live=0 -> floor = latest (prune all ids 0..latest-1).
    expect(publicEvictionFloor(10n, 0n)).toBe(10n);
    // Empty chain.
    expect(publicEvictionFloor(0n, 0n)).toBe(0n);
    // Coerces non-BigInt inputs.
    expect(publicEvictionFloor(10, 5)).toBe(5n);
  });

  it('PUBLIC-EVICT-PRUNE-01: prune drops entries strictly below the floor, KEEPS the oldest-live entry + comments', () => {
    const post = (entryId: bigint | string, comments: any[] = []) => ({ entryId: String(entryId), comments });
    // floor 5: ids < 5 are evicted, id 5 is the oldest LIVE and must survive.
    const posts = [post(3n), post(5n, [post(4n), post(6n)]), post(9n)];
    const kept = prunePublicPostsBelowFloor(posts, 5n);
    expect(kept.map((p: any) => p.entryId)).toEqual(['5', '9']); // id 3 dropped; id 5 (oldest live) kept
    // The kept post's comments: id 4 (< floor) dropped, id 6 kept.
    expect(kept[0].comments.map((c: any) => c.entryId)).toEqual(['6']);
  });

  it('PUBLIC-EVICT-PRUNE-02: floor 0 (no eviction) returns posts unchanged; local-pending (no entryId) is never pruned', () => {
    const posts = [{ entryId: '0', comments: [] }, { id: 'pending', comments: [] }];
    expect(prunePublicPostsBelowFloor(posts, 0n)).toBe(posts); // floor <= 0 -> unchanged
    // With a real floor, a numeric-id post below it drops but a pending (no entryId) post is kept.
    const mixed = [{ entryId: '2', comments: [] }, { id: 'pending-no-entryid', comments: [] }];
    const kept = prunePublicPostsBelowFloor(mixed, 5n);
    expect(kept).toHaveLength(1);
    expect(kept[0].id).toBe('pending-no-entryid');
  });
});
