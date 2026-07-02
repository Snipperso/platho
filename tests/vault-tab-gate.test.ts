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

  it('VAULT-GATE-02: post-detail comments persist into the feed cache so a reload does not re-download images', () => {
    expect(app).toMatch(/function persistLoadedPublicPostComments\(item, chainComments\)/);
    // Writes the merged comments into the cached post and persists.
    expect(app).toMatch(/feed\.posts\[idx\] = \{ \.\.\.posts\[idx\], comments: merged \};/);
    expect(app).toMatch(/persistLoadedPublicPostComments\(item, result\.comments\);/);
    // Local-pending comments (no entryId, not on chain) are preserved through the merge.
    expect(app).toMatch(/const localPending = existing\.filter\(\(c\) => \{[\s\S]*!chainComments\.some/);
  });
});
