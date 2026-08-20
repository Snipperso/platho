import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// TWO COPIES OF THE WEB SERVER CONFIG, AND ONLY ONE OF THEM WAS RIGHT.
//
// Found 2026-08-20 while adding the probe-only access log. `deploy/Caddyfile` and `scripts/server/Caddyfile`
// had drifted to 89 vs 34 functional lines. The copy under scripts/server — the one placed on a machine while
// building it — was missing, in full:
//
//   * the entire cache policy, including `no-store` on /sw.js (the header whose absence pins a device to an old
//     build; it cost hours on the Telegram webview once already),
//   * `@real_files` + `file_server @real_files`, without which a missing asset answers 200 with HTML and the app
//     dies on strict MIME checking showing a blank screen,
//   * the whole about.platho.app site,
//   * three security headers.
//
// A new server built from it would have been quietly wrong in exactly the ways that are hardest to notice, and
// PWA-CONFIG-09 would not have said a word: it checks CSP across every hosting document, and CSP was fine in
// both. The gate that existed proved the thing that had not broken.
//
// Byte identity is enforced here rather than argued for in a comment, because the previous defence against this
// WAS a comment — deploy/Caddyfile opens with "a stale copy here is worse than none" — and the copy went stale
// anyway. If the two files ever need to differ, that difference has to be designed, not discovered during an
// outage.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('HOSTING — the web server config has ONE source of truth', () => {
  it('HOSTCFG-01: deploy/Caddyfile and scripts/server/Caddyfile are byte-identical', () => {
    const deployed = readFileSync('deploy/Caddyfile', 'utf8');
    const provisioning = readFileSync('scripts/server/Caddyfile', 'utf8');
    expect(provisioning, 'the provisioning copy has drifted from the live config — build a server from it and it '
      + 'will be wrong in ways nothing reports').toBe(deployed);
  });

  it('HOSTCFG-02: the properties that drifted are actually present, not merely equal', () => {
    // Identity alone would be satisfied by two equally-broken files. These are the specific things the stale
    // copy had lost, asserted directly.
    const caddy = readFileSync('scripts/server/Caddyfile', 'utf8');
    expect(caddy).toContain('@service_worker path /sw.js');
    expect(caddy).toMatch(/header @service_worker Cache-Control "no-cache, no-store, must-revalidate"/);
    expect(caddy).toContain('header @shell Cache-Control "no-cache"');
    expect(caddy).toContain('file_server @real_files');
    expect(caddy).toContain('about.platho.app {');
    expect(caddy).toContain('Cross-Origin-Opener-Policy "same-origin"');
    expect(caddy).toContain('-Server');
  });

  it('HOSTCFG-03: neither copy carries an access log', () => {
    // Reinforces PERMA-05 across BOTH files. PERMA-05 only reads deploy/Caddyfile, so a logger added to the
    // provisioning copy would have gone straight onto the next server unremarked.
    //
    // I added one here on 2026-08-20 — scoped by `log_skip` to a single monitoring address, with working
    // positive and negative controls — and it was still wrong: a permalink path reaches this server, and the
    // promise is that nothing is written down. The diagnosis I wanted belonged to the prober, not the server.
    for (const path of ['deploy/Caddyfile', 'scripts/server/Caddyfile']) {
      // COMMENTS STRIPPED FIRST. The gate tests the configuration, not the prose about it — the note explaining
      // why this logger was removed contains the words it forbids, and the first version of this assertion
      // failed on its own documentation.
      const directives = readFileSync(path, 'utf8').split('\n').filter((line) => !line.trim().startsWith('#'))
        .join('\n');
      const sites = directives.slice(directives.indexOf('platho.app {'));
      expect(sites, `${path} records requests`).not.toMatch(/^\s*log\s*(\{|$)/m);
      expect(directives, `${path} still has a log_skip, so a logger was only half-removed`)
        .not.toContain('log_skip');
    }
  });
});
