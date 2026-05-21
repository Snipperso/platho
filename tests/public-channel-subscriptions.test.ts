import { describe, expect, it } from 'vitest';
import { PLATHO_APP_CONFIG } from '../web/platho-config.mjs';
import {
  DEFAULT_PUBLIC_CHANNEL_ID,
  createDefaultPublicChannelSubscriptions,
  normalizePublicChannelFeed,
  normalizePublicChannelSubscriptions,
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
          title: 'Public note',
          text: 'Readable without connecting a wallet.',
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
        text: 'Public note\nReadable without connecting a wallet.',
      }),
    ]);
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
});
