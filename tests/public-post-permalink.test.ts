import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// PERMALINKS — platho.app/<username|wallet>/<epochTag.shardSeq.entryId>
//
// Owner, 2026-08-13: "давай ссылку сделай так platho.app/юзернейм или адресс кошелька/пост".
//
// The link is the only way a post leaves Platho to someone who is not here yet, so the whole chain has to hold
// at once: the server must answer a two-segment path with the app shell, the shell must still find its assets from
// that path, the client must parse the path, resolve the name, and read the post — with NO account.
//
// Three of those halves live outside app.js, which is exactly why they are pinned here: a correct client on a
// server that 404s the path is a dead link, and nothing else in the suite would say so.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const app = readFileSync('web/app.js', 'utf8');
const html = readFileSync('web/index.html', 'utf8');
// THE CONFIG THAT ACTUALLY SERVES. Until 2026-08-13 these guards read deploy/nginx-platho.app.conf, and nginx is
// not running on that host at all — Caddy is, and the nginx file was a three-month-old fiction. A guard pointed at
// a file nobody serves proves nothing while looking like proof.
const caddy = readFileSync('deploy/Caddyfile', 'utf8');

/** Lift the pure link functions out of app.js and RUN them, with the app-level helpers they touch stubbed. */
function loadPermalinkFunctions(profiles: Record<string, { verifiedUsername?: string }> = {}) {
  const start = app.indexOf('const PERMALINK_RESERVED_SEGMENTS');
  const end = app.indexOf('/** {author, entryId} for a permalink path');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const parseStart = app.indexOf('function parsePublicPostPermalink(');
  const parseEnd = app.indexOf('\n}', parseStart) + 2;
  const source = `${app.slice(start, end)}\n${app.slice(parseStart, parseEnd)}`;
  const prelude = `
    const location = { origin: 'https://platho.app' };
    const publicChannelProfileCache = ${JSON.stringify(profiles)};
    const channelProfileCacheKey = (w) => String(w ?? '');
    const rawWalletAddress = (w) => (typeof w === 'string' && w.startsWith('0:') ? w : null);
    const displayWalletAddress = (w) => 'UQ' + String(w).slice(2, 10);
    const canonicalUsernameDisplay = (l) => String(l ?? '').replace(/\\.ath$/i, '');
    const sharedPostShardCoordinates = (id) => (/^\\d+\\.\\d+\\.\\d+$/.test(String(id)) ? {} : null);
  `;
  // eslint-disable-next-line no-new-func
  return new Function(`${prelude}\n${source}\nreturn { publicPostPermalink, publicPostPermalinkAuthorSegment, parsePublicPostPermalink };`)();
}

const WALLET = `0:${'ab'.repeat(32)}`;

describe('public post permalinks', () => {
  it('PERMA-01: the link is /<name>/<entryId> when the name is registry-verified, /<address>/<entryId> otherwise', () => {
    const named = loadPermalinkFunctions({ [WALLET]: { verifiedUsername: 'alice.ath' } });
    expect(named.publicPostPermalink({ entryId: '441.0.0', authorWallet: WALLET }))
      .toBe('https://platho.app/alice/441.0.0');
    // No verified name -> the address, which always resolves. An UNVERIFIED claim must never reach a link.
    const anon = loadPermalinkFunctions({ [WALLET]: {} });
    const link = anon.publicPostPermalink({ entryId: '441.0.0', authorWallet: WALLET });
    expect(link).toMatch(/^https:\/\/platho\.app\/UQ[A-Za-z0-9_-]+\/441\.0\.0$/);
    expect(link).not.toContain('alice');
  });

  it('PERMA-02: a username colliding with a served path prefix falls back to the address', () => {
    // A username really can be "assets" or "vendor" (4-16 of [a-z0-9_-]). A link under one still resolves — the
    // shell answers any extensionless path — but it would be served with that prefix's ASSET cache policy (a day),
    // so the shell for that post would be held stale on every reader's device. Cheaper to not mint the link.
    for (const reserved of ['assets', 'vendor']) {
      const fns = loadPermalinkFunctions({ [WALLET]: { verifiedUsername: `${reserved}.ath` } });
      expect(fns.publicPostPermalinkAuthorSegment(WALLET)).not.toBe(reserved);
      expect(fns.publicPostPermalinkAuthorSegment(WALLET)).toMatch(/^UQ/);
    }
    // The reserved list has TWO origins and both are pinned here, because a list whose entries nobody can
    // account for is a list nobody dares to prune.
    //
    //  1. Every asset prefix the server treats as immutable. Derived from the config, never typed twice — a
    //     prefix added to one side and forgotten on the other is exactly how this rots.
    //  2. The extensionless forms of the pages served at the root. Added 2026-08-19 with channel links: from
    //     then on a bare /<name> means a channel, and /privacy would otherwise stop being available for the
    //     page that lives at /privacy.html.
    const reservedInApp = /const PERMALINK_RESERVED_SEGMENTS = new Set\(\[([^\]]*)\]\)/.exec(app)?.[1] ?? '';
    const names = [...reservedInApp.matchAll(/'([a-z0-9_-]+)'/g)].map((m) => m[1]).sort();
    const assetPrefixes = /@immutable_assets \{\s*path ([^\n]+)/.exec(caddy)?.[1] ?? '';
    const fromConfig = [...assetPrefixes.matchAll(/\/([a-z0-9_-]+)\/\*/g)].map((m) => m[1]).sort();
    expect(fromConfig.length).toBeGreaterThan(0);
    for (const prefix of fromConfig) expect(names, `${prefix} is an asset prefix`).toContain(prefix);
    const rootPages = ['privacy', 'terms'];
    for (const page of rootPages) {
      expect(existsSync(`web/${page}.html`), `${page}.html must exist to be worth reserving`).toBe(true);
      expect(names, `/${page} must not become a channel`).toContain(page);
    }
    // Nothing ELSE may sit in the list unexplained.
    expect(names).toEqual([...new Set([...fromConfig, ...rootPages])].sort());
  });

  it('PERMA-03: a post with no addressable row has no link (nothing to point at)', () => {
    const fns = loadPermalinkFunctions({ [WALLET]: { verifiedUsername: 'alice.ath' } });
    expect(fns.publicPostPermalink({ entryId: null, authorWallet: WALLET })).toBeNull();     // local-pending
    expect(fns.publicPostPermalink({ entryId: '12345', authorWallet: WALLET })).toBeNull();  // pre-shard v1 id
    expect(fns.publicPostPermalink({ entryId: '441.0.0', authorWallet: null })).toBeNull();
  });

  it('PERMA-04: the path parses back, and only a real permalink path does', () => {
    const { parsePublicPostPermalink } = loadPermalinkFunctions();
    expect(parsePublicPostPermalink('/alice/441.0.0')).toEqual({ author: 'alice', entryId: '441.0.0' });
    expect(parsePublicPostPermalink('/alice/441.0.0/')).toEqual({ author: 'alice', entryId: '441.0.0' });
    expect(parsePublicPostPermalink(`/UQabcdefgh/441.0.0`)).toEqual({ author: 'UQabcdefgh', entryId: '441.0.0' });
    // The app's own routes and asset paths must not look like a permalink, or a normal load would try to open one.
    for (const path of ['/', '/index.html', '/assets/icons/chat.svg', '/docs/about-platho.md', '/alice', '/alice/441']) {
      expect(parsePublicPostPermalink(path), path).toBeNull();
    }
  });

  it('PERMA-05: the server answers a permalink path with the app shell, and records nothing', () => {
    // Without this the whole feature is a 404 — and no client-side test could tell.
    expect(caddy).toMatch(/try_files \{path\} \/index\.html/);
    // THE PRIVACY CLAIM the permalink comment in app.js makes. A path reaches the server (a #fragment never
    // would), so the only reason it leaks nothing is that nothing is written down. Caddy logs no requests unless
    // a `log` directive is present — VERIFIED against the live journal 2026-08-13, which carried reload and TLS
    // lines and not one request. Adding `log` to the site silently turns the permalink into a record of who read
    // what, so the absence is asserted here rather than remembered.
    const siteBlocks = caddy.slice(caddy.indexOf('platho.app {'));
    expect(siteBlocks).not.toMatch(/^\s*log\s*(\{|$)/m);
  });

  it('PERMA-06: every app-shell URL is ROOT-ABSOLUTE, because a document-relative one dies on a permalink path', () => {
    // A document-relative "./app.js" resolves against the DOCUMENT url, so at /alice/441.0.0 the browser asks for
    // /alice/app.js. On this server that answers with the app shell (200, text/html), strict MIME checking refuses
    // it as a module, and the reader gets a blank screen.
    //
    // <base href="/"> was tried first and is NOT usable: the CSP below carries `base-uri 'none'`, so the browser
    // BLOCKS the tag outright ("Setting the document's base URI ... violates ... base-uri 'none'") — MEASURED
    // against production 2026-08-13, after shipping it. No bundle-only test could have caught that, because the
    // directive lives in the server config; this one can, because it reads both.
    expect(html).not.toContain('<base');
    expect(caddy).toContain("base-uri 'none'");
    const relative = [...html.matchAll(/(?:src|href)="(\.\/[^"]*)"/g)].map((m) => m[1]);
    expect(relative, `document-relative URLs break at a permalink path: ${relative.join(', ')}`).toEqual([]);
    // Every one of them must still be same-origin absolute, not protocol-relative or external.
    const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(url, url).toMatch(/^\/[^/]/);
    // The service worker registration is the same trap one layer down: './sw.js' would register /<name>/sw.js.
    expect(app).toContain("navigator.serviceWorker.register('/sw.js'");
    // sw.js keeps its own './' — those resolve against the WORKER's scope, not the document, so they are correct.
    expect(readFileSync('web/sw.js', 'utf8')).toContain("'./index.html'");
  });

  it('PERMA-07: opening a link needs no account, and never silently follows the channel', () => {
    const open = app.slice(
      app.indexOf('async function openPublicPostFromPermalink('),
      app.indexOf('function clearPublicPostPermalinkFromAddressBar('),
    );
    // The whole point of a shared link: a reader who has never touched Platho gets the post. Nothing in the open
    // path may require a wallet, a password or an account.
    expect(open).not.toMatch(/requirePlathoWallet|plathoWallet|hasActivePlathoAccount|requireUnlocked/);
    expect(open).toContain('await fetchPermalinkPostFromChain(link.entryId, wallet)');
    expect(open).toContain('openPublicPostDetail(post)');
    // Reading someone's post from a link is not subscribing to them — asserted in the shared primitive.
    const shared = app.slice(
      app.indexOf('async function fetchPublicPostFromChain('),
      app.indexOf('async function fetchSharedPostFromChain('),
    );
    expect(shared).toContain('{ activate: false }');
  });

  it('PERMA-08: the permalink opens LAST in boot, on whatever branch the boot decision took', () => {
    // A reader arriving from a link may have no wallet at all, so the open cannot hang off the unlock path. And
    // it must run after the boot decision, or the post would be opened onto a surface that is not live yet.
    const boot = app.slice(app.indexOf("document.documentElement.dataset.plathoAppJs = 'ready';"));
    expect(boot).toContain('const link = parsePublicPostPermalink(location.pathname);');
    expect(boot).toContain('return openPublicPostFromPermalink(link)');
    expect(boot.indexOf('markBootAppReady();')).toBeLessThan(boot.indexOf('parsePublicPostPermalink(location.pathname)'));
    // Its own failures are handled inside it, so the boot chain cannot be broken by an unresolvable link.
    expect(boot).toMatch(/openPublicPostFromPermalink\(link\)\.catch\(/);
  });

  it('PERMA-09: a link that cannot resolve says so and clears the address bar; a good one keeps it', () => {
    const open = app.slice(
      app.indexOf('async function openPublicPostFromPermalink('),
      app.indexOf('function clearPublicPostPermalinkFromAddressBar('),
    );
    // "No such name" and "the chain would not answer" are DIFFERENT facts and the registry already separates them.
    expect(open).toContain('error instanceof UsernameNotRegisteredError');
    expect(open).toContain("t('public.linkNoSuchName')");
    expect(open).toContain("t('public.linkNotFound')");
    // Cleared only on failure — the URL IS the permalink, and a reader who wants to pass it on copies it from
    // the address bar. Clearing it on success would take that away.
    expect(open).toContain('clearPublicPostPermalinkFromAddressBar();');
    const success = open.slice(0, open.indexOf('} catch'));
    expect(success).not.toContain('clearPublicPostPermalinkFromAddressBar');
  });

  it('PERMA-10: the share dialog offers the link, and only for a post that has one', () => {
    const list = app.slice(app.indexOf('function renderSharePostList()'), app.indexOf('function insertShareMarker('));
    expect(list).toContain('const permalink = pendingSharePayload?.permalink ?? null;');
    expect(list).toContain('if (permalink) {');
    // Honest label: a phone hands the URL to its share sheet, a desktop browser can only copy it.
    expect(list).toContain("canSystemShareLink(permalink) ? t('dialog.shareLink') : t('dialog.shareCopyLink')");
    // The sheet-then-clipboard dance moved into shareLinkOutOfPlatho on 2026-08-19, when channel links needed
    // the same behaviour; chooseShareLink now delegates. Follow it there rather than assert on an empty shell.
    const choose = app.slice(app.indexOf('async function chooseShareLink()'), app.indexOf('// Copy the shared post'));
    expect(choose).toContain('shareLinkOutOfPlatho(share?.permalink, share?.title)');
    const primitive = app.slice(app.indexOf('async function shareLinkOutOfPlatho('));
    // A dismissed share sheet is the user changing their mind, not a failure to report.
    expect(primitive).toContain("if (error?.name === 'AbortError') return;");
    expect(primitive).toContain('copyTextToClipboard(url)');
  });
});
