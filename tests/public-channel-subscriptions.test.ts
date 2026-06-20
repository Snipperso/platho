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
  publicChannelSubscriptionsToThreads,
  readPublicChannelFeedCache,
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

    // The empty-channel placeholder renders like an ordinary post: author name once (no syncing/public
    // labels), no title, the "waiting" line as the body, and the channel wallet for the avatar.
    const item = publicChannelThreadsToFeedItems(threads)[0];
    expect(item.compact).toBe(true);
    expect(item.meta).toEqual(['platho']);
    expect(item.title).toBeNull();
    expect(item.text).toBe('Waiting for public feed');
    expect(item.author).toBe('platho');
    expect(item.authorWallet).toBe(DEFAULT_PUBLIC_CHANNEL_AUTHOR_WALLET);
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
