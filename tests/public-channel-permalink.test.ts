import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// CHANNEL LINKS — platho.app/<username|wallet>
//
// Owner, 2026-08-19: "было бы классно иметь возможность поделиться именно каналом, а не сообщением".
//
// The post form (tests/public-post-permalink.test.ts) can afford a permissive first segment because its second
// segment is digits and dots. A single segment has nothing to lean on: the server answers every path it has no
// file for with the app shell, so /favicon.ico, /app.js and every typo arrive at this parser. It must therefore
// accept ONLY what can actually name a channel and leave everything else alone.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const app = readFileSync('web/app.js', 'utf8');
const html = readFileSync('web/index.html', 'utf8');

/** Lift the pure link functions out of app.js and RUN them, with the app-level helpers they touch stubbed. */
function loadChannelLinkFunctions(profiles: Record<string, { verifiedUsername?: string }> = {}) {
  const sharedStart = app.indexOf('const PERMALINK_RESERVED_SEGMENTS');
  const sharedEnd = app.indexOf('function parsePublicPostPermalink(');
  const channelStart = app.indexOf('const PUBLIC_CHANNEL_PERMALINK_USERNAME_RE');
  const channelEnd = app.indexOf('/**\n * Open the channel a link names');
  expect(sharedStart).toBeGreaterThan(-1);
  expect(sharedEnd).toBeGreaterThan(sharedStart);
  expect(channelStart).toBeGreaterThan(sharedEnd);
  expect(channelEnd).toBeGreaterThan(channelStart);
  const source = `${app.slice(sharedStart, sharedEnd)}\n${app.slice(channelStart, channelEnd)}`;
  const prelude = `
    const location = { origin: 'https://platho.app' };
    const publicChannelProfileCache = ${JSON.stringify(profiles)};
    const channelProfileCacheKey = (w) => String(w ?? '');
    const rawWalletAddress = (w) => {
      const s = String(w ?? '');
      return s.startsWith('0:') || /^[UE]Q[A-Za-z0-9_-]{46}$/.test(s) ? s : null;
    };
    const displayWalletAddress = (w) => 'UQ' + String(w).slice(2, 10);
    const canonicalUsernameDisplay = (l) => String(l ?? '').replace(/\\.ath$/i, '');
    const sharedPostShardCoordinates = (id) => (/^\\d+\\.\\d+\\.\\d+$/.test(String(id)) ? {} : null);
  `;
  // eslint-disable-next-line no-new-func
  return new Function(`${prelude}\n${source}\n`
    + 'return { publicChannelPermalink, parsePublicChannelPermalink, PERMALINK_RESERVED_SEGMENTS };')();
}

describe('CHANLINK — a channel is shareable on its own', () => {
  const WALLET = '0:aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899';

  it('CHANLINK-01: a verified name builds the short link; an unnamed wallet still gets one', () => {
    const named = loadChannelLinkFunctions({ [WALLET]: { verifiedUsername: 'glasnost.ath' } });
    expect(named.publicChannelPermalink(WALLET)).toBe('https://platho.app/glasnost');
    // The address form cannot rot: a .ath can be transferred, and identity in Platho follows the WALLET.
    const anonymous = loadChannelLinkFunctions();
    expect(anonymous.publicChannelPermalink(WALLET)).toMatch(/^https:\/\/platho\.app\/UQ[A-Za-z0-9_-]+$/);
    expect(anonymous.publicChannelPermalink(WALLET)).not.toContain('glasnost');
    expect(anonymous.publicChannelPermalink(null)).toBe(null);
  });

  it('CHANLINK-02: the two link shapes round-trip and cannot be confused for each other', () => {
    const { parsePublicChannelPermalink } = loadChannelLinkFunctions();
    expect(parsePublicChannelPermalink('/glasnost')).toEqual({ author: 'glasnost' });
    expect(parsePublicChannelPermalink('/glasnost/')).toEqual({ author: 'glasnost' });
    expect(parsePublicChannelPermalink(`/${'UQ' + 'a'.repeat(46)}`)).toEqual({ author: `UQ${'a'.repeat(46)}` });
    // A POST link must never be read as a channel — the boot order relies on this staying disjoint.
    expect(parsePublicChannelPermalink('/glasnost/688.0.1')).toBe(null);
    expect(parsePublicChannelPermalink('/')).toBe(null);
    expect(parsePublicChannelPermalink('')).toBe(null);
  });

  it('CHANLINK-03: paths that are not names are left alone, not opened as somebody channel', () => {
    const { parsePublicChannelPermalink } = loadChannelLinkFunctions();
    // Everything the server has no file for lands here. A dot disqualifies: no username may contain one.
    for (const path of ['/app.js', '/favicon.ico', '/sw.js', '/manifest.webmanifest', '/platho-config.mjs']) {
      expect(parsePublicChannelPermalink(path), `${path} must not be read as a channel`).toBe(null);
    }
    // Too short, too long, and wrong alphabet — the registry would not issue any of these.
    for (const path of ['/ab', '/ABCDEF', '/' + 'a'.repeat(17), '/hello world', '/привет']) {
      expect(parsePublicChannelPermalink(path), `${path} must not be read as a channel`).toBe(null);
    }
  });

  it('CHANLINK-04: the legal pages are reserved, and they are reserved against something that EXISTS', () => {
    const { parsePublicChannelPermalink, PERMALINK_RESERVED_SEGMENTS } = loadChannelLinkFunctions();
    for (const name of ['privacy', 'terms', 'assets', 'vendor']) {
      expect(PERMALINK_RESERVED_SEGMENTS.has(name)).toBe(true);
      expect(parsePublicChannelPermalink(`/${name}`), `/${name} must not be a channel`).toBe(null);
      expect(parsePublicChannelPermalink(`/${name.toUpperCase()}`)).toBe(null);
    }
    // A reservation guarding a page that does not exist is dead weight that nobody would ever remove.
    expect(existsSync('web/privacy.html'), 'privacy.html must exist for /privacy to be worth reserving').toBe(true);
    expect(existsSync('web/terms.html'), 'terms.html must exist for /terms to be worth reserving').toBe(true);
  });

  it('CHANLINK-05: boot tries the POST form first, so the stricter shape always wins', () => {
    const boot = app.slice(app.indexOf('const link = parsePublicPostPermalink(location.pathname);'));
    const postAt = boot.indexOf('openPublicPostFromPermalink');
    const channelAt = boot.indexOf('parsePublicChannelPermalink');
    expect(postAt).toBeGreaterThan(-1);
    expect(channelAt).toBeGreaterThan(postAt);
  });

  it('CHANLINK-06: a failed channel link is cleared from the address bar, like a failed post link', () => {
    const clear = app.slice(
      app.indexOf('function clearPublicPostPermalinkFromAddressBar'),
      app.indexOf('function clearPublicPostPermalinkFromAddressBar') + 700,
    );
    // Otherwise a reload retries a link that cannot resolve, forever.
    expect(clear).toContain('parsePublicChannelPermalink');
  });

  it('CHANLINK-07: the share control is a LABELLED button, wired to the channel link', () => {
    expect(html).toContain('id="publicChannelViewShareButton"');
    // Labelled, not an icon — the project rule for actions whose meaning is not obvious from a glyph.
    expect(html).toMatch(/publicChannelViewShareButton"[^>]*data-i18n="public\.shareChannel"/);
    const handler = app.slice(app.indexOf('publicChannelViewShareButton?.addEventListener'));
    expect(handler.slice(0, 400)).toContain('publicChannelPermalink(publicChannelViewWallet)');
  });

  it('CHANLINK-09: a clipboard copy is CONFIRMED on screen, because nothing else would be', () => {
    // SHIPPED BROKEN 2026-08-19 and found by the owner: the button copied the link correctly and reported it
    // through setPublicStatus, which is a console.debug wrapper and not a UI surface at all. From the outside the
    // control looked dead — "ничего не происходит, в консоли ошибок нет".
    const status = app.slice(app.indexOf('function setPublicStatus('), app.indexOf('function setPublicStatus(') + 260);
    expect(status, 'if this ever becomes a real surface, this gate should be revisited').toContain('console.debug');
    const primitive = app.slice(app.indexOf('async function shareLinkOutOfPlatho('));
    // The outcome has to reach the caller — only the caller knows what its surface can show.
    expect(primitive).toContain("return 'copied';");
    expect(primitive).toContain("return 'shared';");
    const handler = app.slice(app.indexOf('publicChannelViewShareButton?.addEventListener'));
    // BOTH clipboard outcomes speak. The first fix covered only success and left failure reporting itself to the
    // same console.debug — caught when a copy really did fail (an unfocused window refuses the clipboard) and the
    // button again sat there saying nothing.
    expect(handler.slice(0, 900)).toContain("t('dialog.shareLinkCopied')");
    expect(handler.slice(0, 900)).toContain("t('dialog.shareCopyFailed')");
    // A dismissed share sheet stays silent — the user closed it themselves.
    expect(handler.slice(0, 900)).toContain('if (!said) return;');
    // And the periodic re-render must not eat the confirmation before it is read.
    const render = app.slice(app.indexOf('if (publicChannelViewShareButton) {'));
    expect(render.slice(0, 600)).toContain("dataset.copied !== 'true'");
  });

  it('CHANLINK-08: both share paths go through ONE primitive', () => {
    // chooseShareLink used to carry its own copy of the share-sheet-then-clipboard dance; a second copy is how
    // the two drift apart (one gains an AbortError branch, the other does not).
    expect(app).toContain('async function shareLinkOutOfPlatho(');
    // ONE call sharing a LINK — which is what this gate is about. A share of FILES is a different action with a
    // different payload and a different fallback (there is no clipboard answer for an image), so it is counted
    // separately rather than folded into this primitive: a wrapper that only forwards its argument would satisfy
    // the count while giving the two paths nothing in common.
    const linkShares = app.match(/navigator\.share\((?!\{ files)/g) ?? [];
    expect(linkShares.length, 'every link share is shareLinkOutOfPlatho').toBe(1);
    const fileShares = app.match(/navigator\.share\(\{ files/g) ?? [];
    expect(fileShares.length, 'the image save inside Telegram — see saveImageOutOfPlatho').toBe(1);
  });
});
