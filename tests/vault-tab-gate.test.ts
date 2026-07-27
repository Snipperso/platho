import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Vault tab gated until account activation (owner request 2026-07-02): moving GRAM into the Vault before
// activation strands it (withdraw needs the registered auth key), so there's no reason to fund it first — the
// tab is inert + dark-grey until activated. Activation lives in the PROFILE tab, so nothing needed to activate
// is behind the gate. + durable comment cache so post-detail comment images don't re-download on reload.
describe('vault tab gate + durable comment cache guard', () => {
  const app = readFileSync('web/app.js', 'utf8');
  const css = readFileSync('web/styles.css', 'utf8');

  it('VAULT-GATE-01: the Vault rail tab is locked until activation and runs AFTER the blanket rail re-enable', () => {
    expect(app).toMatch(/function refreshVaultTabLock\(\)/);
    expect(app).toMatch(/const locked = !hasActivePlathoAccount\(\);/);
    expect(app).toMatch(/item\.classList\.toggle\('is-locked', locked\);\s*item\.disabled = locked;/);
    // MUST be called AFTER the loop that re-enables all rail items, or that loop undoes the gate.
    const reenableIdx = app.indexOf("item.disabled = false;\n    item.title = item.getAttribute('aria-label')");
    const gateCallIdx = app.indexOf('refreshVaultTabLock();', reenableIdx);
    expect(reenableIdx).toBeGreaterThan(-1);
    expect(gateCallIdx).toBeGreaterThan(reenableIdx);
    // setView also refuses a locked Vault view (belt-and-braces for a programmatic / deep-link open).
    expect(app).toMatch(/if \(view === 'vault' && !hasActivePlathoAccount\(\)\) view = 'public';/);
    // Locked style is class-based (prod CSP bans inline styles).
    expect(css).toMatch(/\.rail-item\.is-locked \{/);
    expect(app).not.toMatch(/style\s*=\s*["'`][^"'`]*is-locked/);
  });

  it('VAULT-GATE-02: post-detail comments cache durably in IndexedDB (localStorage strips the image data URLs)', () => {
    // A dedicated IndexedDB store (localStorage's omitHeavyFeedMediaForPersist strips imageUrl, so the feed
    // cache can't hold comment images).
    expect(app).toMatch(/const publicCommentCacheStorePromise = \(\(\) => \{[\s\S]*platho-public-comments-v1/);
    expect(app).toMatch(/function readCachedPublicComments\(cacheKey\)/);
    expect(app).toMatch(/function writeCachedPublicComments\(cacheKey, comments, parentExists, latestLink\)/);
    // Written on a fresh load (WITH the incremental cursor), read to seed the detail view instantly on reload.
    expect(app).toMatch(/writeCachedPublicComments\(cacheKey, result\.comments, result\.parentExists, result\.latestLink\);/);
    expect(app).toMatch(/readCachedPublicComments\(cacheKey\)\.then\(\(durable\) => \{\s*if \(!durable \|\| publicPostDetailItem !== item \|\| publicPostDetailChainComments\.length > 0\) return;/);
    // The ineffective localStorage persist (stripped images) is gone.
    expect(app).not.toMatch(/function persistLoadedPublicPostComments/);
  });

  // VAULT-GATE-03 removed with the CapsuleHub comment walk. It pinned INCREMENTAL comment loading over the shared
  // log: a snapshot boundary (latest_entry_link) let an unchanged thread return from cache with ZERO body reads,
  // and the walk stopped at that boundary instead of re-reading everything below it. That machinery went with the
  // log. The shard loader reads the post's THREAD shard window on each open instead — two RPC calls (a
  // tail-anchored get_page + one /messages) against a per-post shard rather than a global log. HONEST GAP, logged
  // in the roadmap: an unchanged thread is still re-read where the Hub path could skip it; the cheap fix is an
  // entry_count-keyed snapshot (the reader already probes entry_count), not a rewrite.
});
