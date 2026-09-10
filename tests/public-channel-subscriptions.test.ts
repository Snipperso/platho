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
    // decided 2026-08-21 The feed items came out grouped by channel in thread order.
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

describe('The feed cache bounds itself', () => {
  // [REPLACED 2026-09-01, audit round 9.] What stood here tested publicEvictionFloor and
  // prunePublicPostsBelowFloor — the CapsuleHub-era FIFO eviction model. Its call sites went with the CapsuleHub
  // readers in 38bc0727 and only the imports were left behind, so nothing had pruned this cache for over a month;
  // and the functions could not have worked if revived, because `BigInt(post.entryId)` throws on the shard
  // composite ("epochTag.shardSeq.entryId[.generation]") that has been a post's identity since the PublicShard
  // cutover — every id threw, was swallowed, and counted as un-prunable. Testing a mechanism nobody runs, against
  // an identity that no longer exists, is a gate aimed at a deleted thing.
  //
  // What replaces it is the property the cache actually needs: it must FIT. MEASURED against the production
  // replacer, a channel of 4,000-character posts filled a 5 MB localStorage budget at 292 posts — and past that
  // the write threw, answered false, and its caller discarded the answer, so the old snapshot stayed on disk and
  // a reload showed 1 post of the 400 in memory. That budget is shared with the wallet record, so an unpruned
  // feed could also turn wallet creation into "cannot store a wallet".

  /** A storage that refuses anything past `limit` characters — what a full localStorage does. */
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

  /**
   * THE SHAPE THE APP ACTUALLY WRITES [audit 2026-09-01, round 10].
   *
   * The first version of this fixture used a flat `{ channelId: [post, …] }` array — a shape NOTHING in the app
   * produces. app.js writes `{ channelId: { feed: { version, channelId, updatedAt, posts }, syncedAt } }` at
   * every site, and every reader unwraps it as `record?.feed ?? record`. The trim under test required
   * `Array.isArray(record)`, so against the real cache it skipped every channel and returned false having
   * dropped nothing — MEASURED at a 5 MB quota with 2,000 long posts: one attempt, zero bytes stored — while
   * this test stayed green, because the fixture had been written to match the fix instead of the product.
   *
   * That is the circular-gate failure this repo has already been bitten by (WSF-07 derived its probe payloads
   * from the table it was validating). A fixture is a claim about the product; it has to be checked like one.
   */
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
    // …and the record it wrote back is still the record the app reads: the wrapper survives the trim.
    expect(stored['a.ath'].feed?.version, 'the feed wrapper must survive').toBe(1);
    expect(stored['a.ath'].syncedAt, 'and the fields beside it').toBe('S');
    expect(kept.length, 'something was kept').toBeGreaterThan(0);
    expect(kept.length, 'and it is smaller than what was handed in').toBeLessThan(200);
    // The OLDEST go first: whatever survived must end at the newest post.
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
    // The half the caller now reports. A false here means site data is blocked outright, not that the cache is
    // large: the trim above already handles large. Leaving the previous value on disk while memory moves on is
    // what made a reload lose 399 of 400 posts with nothing said.
    const room = boundedStorage(0);
    expect(writePublicChannelFeedCache(room.storage as any, cacheOf(5))).toBe(false);
    expect(room.stored(), 'nothing may be claimed as stored').toBeNull();
    // And a storage with no setItem at all is refused rather than crashed on.
    expect(writePublicChannelFeedCache({} as any, cacheOf(1))).toBe(false);
  });
  it('PUBLIC-CACHE-04: the fixture is the shape app.js writes — checked against app.js, not assumed', () => {
    // The check that would have caught round 9's defect at the moment it was written. A trim that runs on a shape
    // the product never produces is worse than no trim: it reports success while doing nothing.
    const app = readFileSync('web/app.js', 'utf8');
    // Every site that writes a channel record into the cache writes the FEED WRAPPER.
    const writes = [...app.matchAll(/\[channel(?:Id|\.id)\]: \{ feed: \{/g)].length
      + [...app.matchAll(/feed: \{ version: 1, channelId/g)].length;
    expect(writes, 'app.js must still write the wrapper this fixture models').toBeGreaterThan(0);
    // …and no site writes a bare array, which is what the first fixture assumed.
    expect(app, 'a bare post array is not a shape this app produces')
      .not.toMatch(/publicChannelFeedCache\[[^\]]+\] = \[/);
    // The trim must therefore unwrap, exactly as every reader in the tree does.
    const subs = readFileSync('web/public-channel-subscriptions.mjs', 'utf8');
    expect(subs, 'the trim must read through the wrapper').toContain('const feed = record?.feed ?? record;');
    expect(subs, 'and write it back intact').toContain('return record?.feed ? { ...record, feed: nextFeed } : nextFeed;');
  });
});

describe('The channel profile cache survives a record without every field', () => {
  // [2026-09-10] The worn-gift claim joined the profile record, and its normalizer lower-cased the answer of a
  // helper that returns NULL for an empty string. Every record from before the field — that is, every record —
  // threw inside normalizeChannelProfile; readPublicChannelProfileCache swallowed the throw and answered an EMPTY
  // cache. Measured on stage: two cached profiles on disk, zero loaded; the owner's own card offered to "show
  // others" a gift and a name the chain already carried, and every walked profile threw the same way.
  const record = {
    description: 'about', tags: ['a'], entryId: '2', createdAtSec: 1, fetchedAt: 1,
    ownerUsername: 'inkling', verifiedUsername: 'inkling',
  };
  const gift = '0:59f6c102af7bf86bb35a34cab0e720b27dc27e7ce76ebddb702e54e8f5f4b2f2';

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
    // The shape of the defect, pinned at its source: nonEmptyString answers null, and null has no toLowerCase.
    const subs = readFileSync('web/public-channel-subscriptions.mjs', 'utf8');
    expect(subs).not.toMatch(/nonEmptyString\([^\n]*\)\.toLowerCase\(\)/);
    expect(subs, 'the profile address fields go through one throw-free helper').toContain('function rawAddressOrNull(value)');
  });
});
