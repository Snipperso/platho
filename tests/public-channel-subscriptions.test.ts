import { describe, expect, it } from 'vitest';
import { PLATHO_APP_CONFIG } from '../web/platho-config.mjs';
import {
  DEFAULT_PUBLIC_CHANNEL_ID,
  createDefaultPublicChannelSubscriptions,
  normalizePublicChannelFeed,
  normalizePublicChannelSubscriptions,
  publicChannelThreadsToFeedItems,
  publicChannelSubscriptionsToThreads,
  publicChannelThreadId,
  subscribedPublicChannels,
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
      name: 'platho.app',
      readOnly: true,
      state: 'syncing',
    });
  });

  it('PUBLIC-SUB-02: config declares channel sources, not bundled channel messages', () => {
    expect(PLATHO_APP_CONFIG.publicChannels?.[0]).toMatchObject({
      id: 'platho.app',
      sourceUrl: './channels/platho.app/feed.json',
    });
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
