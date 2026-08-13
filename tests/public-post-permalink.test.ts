import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// PERMALINKS — platho.app/<username|wallet>/<epochTag.shardSeq.entryId>
//
// Owner, 2026-08-13: "давай ссылку сделай так platho.app/юзернейм или адресс кошелька/пост".
//
// The link is the only way a post leaves Platho to someone who is not here yet, so the whole chain has to hold
// at once: nginx must answer a two-segment path with the app shell, the shell must still find its assets from
// that path, the client must parse the path, resolve the name, and read the post — with NO account.
//
// Three of those halves live outside app.js, which is exactly why they are pinned here: a correct client on a
// server that 404s the path is a dead link, and nothing else in the suite would say so.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const app = readFileSync('web/app.js', 'utf8');
const html = readFileSync('web/index.html', 'utf8');
const nginx = readFileSync('deploy/nginx-platho.app.conf', 'utf8');

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

  it('PERMA-02: a username colliding with an nginx-reserved prefix falls back to the address', () => {
    // nginx hard-404s /assets/ and /vendor/ so a MISSING asset fails as an asset instead of answering with the
    // app shell. A user really can register those names (4-16 of [a-z0-9_-]), and a link under one would be dead.
    for (const reserved of ['assets', 'vendor']) {
      const fns = loadPermalinkFunctions({ [WALLET]: { verifiedUsername: `${reserved}.ath` } });
      expect(fns.publicPostPermalinkAuthorSegment(WALLET)).not.toBe(reserved);
      expect(fns.publicPostPermalinkAuthorSegment(WALLET)).toMatch(/^UQ/);
    }
    // Every reserved segment named in the client is really hard-404ed by the server config, and vice versa.
    const reservedInApp = /const PERMALINK_RESERVED_SEGMENTS = new Set\(\[([^\]]*)\]\)/.exec(app)?.[1] ?? '';
    const names = [...reservedInApp.matchAll(/'([a-z0-9_-]+)'/g)].map((m) => m[1]).sort();
    const hard404 = /location ~ \^\/\(([a-z|]+)\)\/ \{\s*try_files \$uri =404;/.exec(nginx)?.[1] ?? '';
    expect(names).toEqual(hard404.split('|').sort());
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
    expect(nginx).toMatch(/location \/ \{\s*try_files \$uri \/index\.html;\s*\}/);
    // The privacy claim the code comment makes: a PATH reaches the server (a #fragment would not), so the only
    // reason it leaks nothing is that nothing is written down. If this ever flips, that comment becomes a lie.
    expect(nginx).toMatch(/^\s*access_log off;/m);
  });

  it('PERMA-06: the app shell still finds its assets from a two-segment path', () => {
    // index.html references everything relatively ("./app.js"), which resolves against the DOCUMENT url — so on
    // /alice/441.0.0 the browser would ask for /alice/app.js and get a 404 from the .js location block. <base>
    // pins resolution to the origin root, and must precede the first URL-bearing tag to affect it at all.
    expect(html).toContain('<base href="/">');
    const firstUrlTag = Math.min(...['<link', '<script'].map((tag) => html.indexOf(tag)).filter((i) => i > -1));
    expect(html.indexOf('<base href="/">')).toBeLessThan(firstUrlTag);
    // And the reason a wrong asset path would be FATAL rather than merely odd: nginx 404s them, never falls back.
    expect(nginx).toMatch(/location ~ \\\.\(html\|webmanifest\|css\|js\|mjs\|json\|md\|wasm\|svg\|png\)\$ \{\s*try_files \$uri =404;/);
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
    const choose = app.slice(app.indexOf('async function chooseShareLink()'), app.indexOf('// Copy the shared post'));
    // A dismissed share sheet is the user changing their mind, not a failure to report.
    expect(choose).toContain("if (error?.name === 'AbortError') return;");
    expect(choose).toContain('copyTextToClipboard(url)');
  });
});
