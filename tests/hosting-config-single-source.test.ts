import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

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

  it('HOSTCFG-04: the stand (stage.platho.app) IS the production site body — one snippet, two roots, one extra header', () => {
    // [OWNER 2026-08-21: "сделай копию сайта для тестирования … по безопасности сделай также как на основном
    // сайте".] A stand that served a build under different headers, a different cache policy or a different
    // route chain would prove nothing about production, and a second copy of the body would drift the way the
    // two files in HOSTCFG-01 drifted. So the body is written ONCE as a snippet whose only argument is the root,
    // and each site is nothing but "the headers, the snippet with my root" — the stand adds exactly one header
    // of its own, noindex, because a test build must not be indexed as the product.
    const caddy = readFileSync('scripts/server/Caddyfile', 'utf8');
    const block = (name: string) => {
      const start = caddy.indexOf(`\n${name} {\n`);
      expect(start, `${name} site block present`).toBeGreaterThan(-1);
      const end = caddy.indexOf('\n}\n', start);
      return caddy.slice(start + name.length + 4, end).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    };
    // The shared body holds the whole cache policy and route chain (the things HOSTCFG-02 asserts), under the
    // argument root.
    expect(caddy).toContain('(platho_app_site) {\n\troot * {args[0]}\n');
    const snippetStart = caddy.indexOf('(platho_app_site) {');
    const snippetEnd = caddy.indexOf('\n}\n', snippetStart);
    const snippet = caddy.slice(snippetStart, snippetEnd);
    for (const must of ['@service_worker path /sw.js', 'header @shell Cache-Control "no-cache"', 'file_server @real_files', 'try_files {path} /index.html', 'respond @sensitive_paths 404']) {
      expect(snippet, `the shared body carries: ${must}`).toContain(must);
    }
    // Production: EXACTLY the headers and the body with its root. Nothing else — a directive added here alone
    // would make the stand lie about production.
    expect(block('platho.app')).toEqual(['import security_headers', 'import platho_app_site /srv/platho/current']);
    // The stand: the same two lines plus noindex, a different root, in that order.
    expect(block('stage.platho.app')).toEqual([
      'import security_headers',
      'header X-Robots-Tag "noindex, nofollow"',
      'import platho_app_site /srv/platho-stage/current',
    ]);
    // The body must not be written twice anywhere (the drift shape).
    expect((caddy.match(/@service_worker path \/sw\.js/g) ?? []).length).toBe(1);
    expect((caddy.match(/try_files \{path\} \/index\.html/g) ?? []).length).toBe(1);
  });

  it('HOSTCFG-06: a preview deploy cannot reach the production site, and the guard runs before anything else', () => {
    // MEASURED 2026-08-29 (audit 7). `--mode` and `--site` are independent axes and `--site` defaults to
    // production, so `npm run web:deploy:preview` — the script whose name promises a rehearsal — addressed
    // platho.app while BOTH production gates stood down, because each is written `MODE === 'production' && ...`:
    // the genesis-verified blocker, the testnet-config blocker and the version-must-move guard. The bundle is the
    // same either way (one prep, one bundleSha256, no mode in the file selection), so the danger was never wrong
    // bytes — it was every gate switched off on the live site by a flag that reads like a rehearsal.
    const deploy = readFileSync('scripts/deploy_static_web.mjs', 'utf8');
    expect(deploy, 'preview must refuse the production site')
      .toMatch(/if \(MODE === 'preview' && SITE === 'production'\) \{/);
    // BEFORE the key/known-hosts/prep existence checks, or the refusal depends on what happens to be on disk.
    expect(deploy.indexOf("MODE === 'preview' && SITE === 'production'"))
      .toBeLessThan(deploy.indexOf('if (!existsSync(path)) die('));
    // And the npm script the operator actually types names the stand explicitly rather than relying on a default.
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.scripts['web:deploy:preview'], 'the preview script must name the stand')
      .toBe('node scripts/deploy_static_web.mjs --mode preview --site stage');
    // The two the owner actually uses, pinned so this stays a three-way distinction rather than drifting into one.
    expect(pkg.scripts['web:deploy']).toBe('node scripts/deploy_static_web.mjs');
    expect(pkg.scripts['web:deploy:stage']).toBe('node scripts/deploy_static_web.mjs --site stage');
  });

  it('HOSTCFG-05: the stand is deployed by the SAME receiver and the SAME script, addressed by a site prefix', () => {
    // One deploy path: "stage <release>" over the same forced command maps to /srv/platho-stage and changes
    // nothing else (release-name rules, archive checks, ownership, the atomic switch); the client script names
    // the site, asks the stand's own vhost in SNI/Host, and never refuses a same-version ship to a stand.
    const receiver = readFileSync('scripts/server/platho-deploy-receive.sh', 'utf8');
    expect(receiver).toMatch(/^base=\/srv\/platho\n/m);
    expect(receiver).toMatch(/case "\$command" in\n\s*stage\\ \*\)\n\s*base=\/srv\/platho-stage\n\s*command="\$\{command#stage \}"/);
    // The derived paths come AFTER the site is chosen, or the prefix would choose nothing.
    expect(receiver.indexOf('base=/srv/platho-stage')).toBeLessThan(receiver.indexOf('releases="$base/releases"'));
    const deploy = readFileSync('scripts/deploy_static_web.mjs', 'utf8');
    expect(deploy).toMatch(/const SITE = arg\('--site', 'production'\);/);
    expect(deploy).toMatch(/const SITE_HOST = SITE === 'stage' \? 'stage\.platho\.app' : 'platho\.app';/);
    // The site still chooses the MACHINE, not merely the vhost — but by setting name now, not by a literal
    // address: the addresses moved out of this public repo on 2026-09-05 (see HOSTCFG-06).
    expect(deploy).toMatch(
      /const HOST = arg\('--host', null\) \?\? setting\(SITE === 'stage' \? 'PLATHO_HOST_STAGE' : 'PLATHO_HOST_PRODUCTION'\);/,
    );
    expect(deploy).toMatch(/`\$\{SITE === 'stage' \? 'stage ' : ''\}\$\{release\}`/);
    expect(deploy).toMatch(/live === shipping && SITE === 'stage'/);
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.scripts['web:deploy:stage']).toBe('node scripts/deploy_static_web.mjs --site stage');
  });

  it('HOSTCFG-06: no machine address is written down in this PUBLIC repository', () => {
    // 2026-09-05. The production address, the standby address, both SSH key filenames and the deploy account were
    // hardcoded as DEFAULTS across six tracked scripts and deploy/README.md. None of it is a credential — SSH here
    // is key-only behind AllowUsers, fail2ban and a default-deny firewall — so nothing that grants access was
    // exposed. What was handed over for free was the target list, and one entry of it is worse than the rest:
    // the standby machine's only real property is that it is ABSENT FROM DNS and carries no organic traffic, and
    // this repository named it as the DEFAULT deploy host. The production address is public through DNS anyway.
    //
    // Addresses now live in artifacts/local/deploy-hosts.env (gitignored). This gate is what stops one
    // copy-pasted default from quietly putting them back, because the previous defence was that nobody had
    // thought about it.
    const OPERATOR_FILES = [
      'scripts/deploy_static_web.mjs',
      'scripts/deploy_static_web.ps1',
      'scripts/manage_static_web.ps1',
      'scripts/check_server_health.ps1',
      'scripts/backup_server_config.ps1',
      'scripts/deploy_about_web.sh',
      'deploy/README.md',
    ];
    // Loopback, the unspecified address, and RFC 5737's documentation ranges name no real machine.
    const NAMES_NO_MACHINE = /^(127\.|0\.0\.0\.0$|192\.0\.2\.|198\.51\.100\.|203\.0\.113\.)/;
    for (const path of OPERATOR_FILES) {
      const found = (readFileSync(path, 'utf8').match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g) ?? [])
        .filter((address) => !NAMES_NO_MACHINE.test(address));
      expect(found, `${path} names a real machine — that address belongs in artifacts/local/deploy-hosts.env, `
        + 'which is outside git. See deploy/deploy-hosts.env.example.').toEqual([]);
    }
    // The documented shape has to STAY in git, or the local file becomes a guessing game and the next operator
    // reintroduces the defaults out of frustration.
    expect(existsSync('deploy/deploy-hosts.env.example'), 'the example that documents every setting is missing')
      .toBe(true);
    const example = readFileSync('deploy/deploy-hosts.env.example', 'utf8');
    for (const setting of ['PLATHO_HOST_PRODUCTION', 'PLATHO_HOST_STAGE', 'PLATHO_DEPLOY_USER',
      'PLATHO_DEPLOY_KEY', 'PLATHO_ADMIN_USER', 'PLATHO_ADMIN_KEY', 'PLATHO_KNOWN_HOSTS']) {
      expect(example, `the example does not document ${setting}`).toContain(setting);
    }
  });
});
