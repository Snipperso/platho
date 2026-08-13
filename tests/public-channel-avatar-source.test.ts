import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE AVATAR HYDRATOR MUST COVER THE SURFACE THE USER IS LOOKING AT.
//
// Owner, 2026-08-13, twice in one day:
//
//   (1) a channel opened from channel SEARCH showed its posts, its description and its name — and a letter tile
//       where the avatar belongs. The sync walks feedSourcePublicChannels() (subscribed + own + a channel open in
//       the channel view but not followed); the hydrator walked subscribedPublicChannels() alone.
//   (2) "в окне «Найти каналы» не грузятся аватары. Если зайти в канал, то грузятся." A discovery RESULT is not a
//       feed source at all — it is a wallet the beacon sweep just named, with no registry channel and no posts —
//       so widening the set in (1) did nothing for the screen where a face carries the most information.
//
// Two surfaces, one loader. The rule pinned here is that the cache and the cost live in ONE place and callers only
// supply wallets: the third surface that grows its own copy is the third time this bug ships.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const app = readFileSync('web/app.js', 'utf8');

const loader = app.slice(
  app.indexOf('async function hydrateProfileAvatarsForWallets('),
  app.indexOf('async function hydratePublicChannelAvatars()'),
);
const hydrator = app.slice(
  app.indexOf('async function hydratePublicChannelAvatars()'),
  app.indexOf('async function hydratePublicDiscoveryAvatars('),
);
const discovery = app.slice(
  app.indexOf('async function hydratePublicDiscoveryAvatars('),
  app.indexOf('function base64UrlToBytes('),
);

describe('public channel avatar source', () => {
  it('AVSRC-01: the channel hydrator takes its channels from the same function the sync does', () => {
    expect(hydrator.length).toBeGreaterThan(0);
    expect(hydrator).toContain('feedSourcePublicChannels().map((channel) => channel.authorWallet).filter(Boolean)');
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
    expect(loader.length).toBeGreaterThan(0);
    expect(loader).toContain('if (!raw || publicChannelAvatarUrlByWallet.get(raw)) continue;');
    expect(loader).toMatch(/\.slice\(0, limit\)/);
    expect(loader).toMatch(/\{ limit = 24 \} = \{\}/);
    // A failed read leaves the wallet UNCACHED so a later pass retries — caching a miss would make one bad
    // moment permanent for that channel.
    expect(loader).toMatch(/catch \(error\) \{[\s\S]*?continue;/);
    expect(loader).toContain('if (!imageUrl) continue;');
  });

  it('AVSRC-04: the cache and the cost have exactly ONE owner', () => {
    // Both callers delegate. A second surface writing publicChannelAvatarUrlByWallet directly would carry its own
    // bound, its own retry rule and its own idea of what a failed read means — which is how (2) happened.
    expect(hydrator).toContain('await hydrateProfileAvatarsForWallets(');
    expect(discovery).toContain('await hydrateProfileAvatarsForWallets(');
    expect(hydrator, 'the channel hydrator must not read profiles itself').not.toContain('loadProfileAvatarImage(');
    expect(discovery, 'nor the discovery one').not.toContain('loadProfileAvatarImage(');
    // Exactly one CHAIN-READING writer of the cache. (The other writers are the durable warm from IndexedDB /
    // legacy localStorage and the own-avatar setter — none of them costs a profile read, which is the budget this
    // is protecting.)
    const chainReaders = app.split('loadProfileAvatarImage(').length - 1;
    expect(chainReaders, 'definition + feed-cache attach + shared loader + the two own-avatar paths').toBe(5);
    expect(loader).toContain('await loadProfileAvatarImage(walletAddress);');
  });

  it('AVSRC-05: channel SEARCH hydrates its own results, after the cards rather than before them', () => {
    expect(discovery.length).toBeGreaterThan(0);
    expect(discovery).toContain('(results ?? []).map((entry) => entry.authorWallet).filter(Boolean)');
    // Both doors into discovery: the first open and the explicit refresh. Missing either leaves one of them faceless.
    for (const [opener, next] of [
      ['async function openPublicDiscovery()', 'function closePublicDiscovery()'],
      ['async function refreshPublicDiscovery()', 'function renderPublicDiscovery(options'],
    ]) {
      const fn = app.slice(app.indexOf(opener), app.indexOf(next));
      expect(fn.length, `${opener} slice must not collapse`).toBeGreaterThan(300);
      expect(fn, `${opener} must hydrate its results`).toContain('void hydratePublicDiscoveryAvatars(results, token);');
      // AFTER the cards are painted: the list must never wait on a profile read per wallet before showing anything.
      expect(
        fn.indexOf('renderPublicDiscovery({ loading: false })'),
        `${opener} must paint the cards first`,
      ).toBeLessThan(fn.indexOf('void hydratePublicDiscoveryAvatars'));
    }
    // ...and it takes the SAME staleness guard the results themselves take, so a closed or re-run sweep cannot
    // repaint the screen from a pass that belongs to the previous one.
    expect(discovery).toContain('token !== publicDiscoveryLoadToken || !publicDiscoveryOpen');
  });

  it('AVSRC-06: the discovery card reads the same per-wallet cache the loader fills', () => {
    // Otherwise the reads would land and nothing would show them — the failure mode that is invisible in a diff.
    const card = app.slice(app.indexOf('function buildDiscoveryCard(channel)'), app.indexOf('function buildDiscoveryCard(channel)') + 1200);
    expect(card).toContain('publicAvatarUrlForWallet(channel.authorWallet)');
    const resolver = app.slice(
      app.indexOf('function publicAvatarUrlForWallet('),
      app.indexOf('async function hydrateProfileAvatarsForWallets('),
    );
    expect(resolver).toContain('publicChannelAvatarUrlByWallet.get(raw)');
  });
});
