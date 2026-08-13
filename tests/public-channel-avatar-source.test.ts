import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE AVATAR HYDRATOR MUST COVER THE CHANNELS THE SYNC ACTUALLY WALKS.
//
// Owner, 2026-08-13: a channel opened from channel SEARCH showed its posts, its description and its name — and a
// letter tile where the avatar belongs. The sync walks feedSourcePublicChannels() (subscribed + own + a channel
// open in the channel view but not followed); the avatar hydrator walked subscribedPublicChannels() alone. So a
// previewed channel was fetched in every respect except its face.
//
// The rule is a SET relationship, not a literal list: whatever the sync reads, the hydrator must be able to reach.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const app = readFileSync('web/app.js', 'utf8');

const hydrator = app.slice(
  app.indexOf('async function hydratePublicChannelAvatars()'),
  app.indexOf('function base64UrlToBytes('),
);

describe('public channel avatar source', () => {
  it('AVSRC-01: the hydrator takes its channels from the same function the sync does', () => {
    expect(hydrator.length).toBeGreaterThan(0);
    expect(hydrator).toContain('feedSourcePublicChannels().filter((channel) => channel.authorWallet)');
    // The narrower set is what left a previewed channel faceless.
    expect(hydrator).not.toContain('subscribedPublicChannels(');
  });

  it('AVSRC-02: a previewed (searched, unfollowed) channel really is in that set', () => {
    const source = app.slice(
      app.indexOf('function feedSourcePublicChannels()'),
      app.indexOf('function feedSourcePublicChannels()') + 900,
    );
    expect(source).toContain('publicChannelPreviewChannelId');
    expect(source).toContain('ownPublicChannel()');
  });

  it('AVSRC-03: it stays cheap — one profile read per wallet, bounded per pass, transient failures retried', () => {
    // Widening the set must not widen the cost: the per-wallet cache is what keeps this one read per wallet for
    // the life of the tab, and the slice bounds a single pass.
    expect(hydrator).toContain('if (!raw || publicChannelAvatarUrlByWallet.get(raw)) continue;');
    expect(hydrator).toMatch(/channels\.slice\(0, 24\)/);
    // A failed read leaves the wallet UNCACHED so a later sync retries — caching a miss would make one bad
    // moment permanent for that channel.
    expect(hydrator).toMatch(/catch \(error\) \{[\s\S]*?continue;/);
    expect(hydrator).toContain('if (!imageUrl) continue;');
  });
});
