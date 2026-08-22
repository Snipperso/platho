import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE PRODUCT VERSION — one semantic number, written out in four places.
//
// Owner, 2026-08-19: "что-то версия залипла на 1.0.34" ... "ну надо сделать автоматически значит, ты же
// забудешь через минуту". He was right on both counts: several releases had shipped without it moving.
//
// It cannot simply auto-increment. The version was deliberately split away from the cache keys on 2026-08-09 so
// that it could STAND STILL through a one-line hotfix while the keys move on every deploy — tying it back to the
// deploy would undo that. So the guarantee comes from two other places instead: this gate (all four copies say
// the same thing) and the deploy step (it refuses a version that is already live).
//
// PWA-RUNTIME already pinned two of the four to each other, after they drifted once as v672 vs v691. The other
// two — package.json and the hidden profile badge — were pinned to nothing at all.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const app = readFileSync('web/app.js', 'utf8');
const html = readFileSync('web/index.html', 'utf8');
const pkg = readFileSync('package.json', 'utf8');
const deploy = readFileSync('scripts/deploy_static_web.mjs', 'utf8');
const bumper = readFileSync('scripts/bump_release_version.mjs', 'utf8');

/** Every place the version is spelled out, by the same anchors the bump script writes through. */
const SITES: Array<[string, string, RegExp]> = [
  ['package.json version', pkg, /"version":\s*"(\d+\.\d+\.\d+)"/],
  ['runtime const', app, /const PLATHO_APP_RUNTIME_VERSION = '(\d+\.\d+\.\d+)'/],
  ['sidebar badge', html, /id="appVersionLabel">(\d+\.\d+\.\d+)</],
  ['profile badge', html, /id="profileVersionLabel" hidden>(\d+\.\d+\.\d+)</],
];

describe('RELVER — the product version is one number', () => {
  it('RELVER-01: all four copies agree', () => {
    const found = SITES.map(([what, text, pattern]) => {
      const all = [...text.matchAll(new RegExp(pattern.source, 'g'))];
      expect(all.length, `${what}: expected exactly one match, found ${all.length}`).toBe(1);
      return [what, all[0][1]] as const;
    });
    const distinct = [...new Set(found.map(([, value]) => value))];
    expect(distinct, `drifted: ${found.map(([w, v]) => `${w}=${v}`).join(', ')}`).toHaveLength(1);
  });

  it('RELVER-02: the bump script writes every one of them, and none of them by hand', () => {
    // A script that knows about three of four sites is worse than no script: it makes the fourth look tended.
    for (const [what] of SITES) {
      const label = what.replace(' version', '').replace('runtime const', 'PLATHO_APP_RUNTIME_VERSION');
      expect(bumper.includes(label) || bumper.includes(label.split(' ')[0]), `${what} is not in the bump script`)
        .toBe(true);
    }
    expect(bumper).toContain('appVersionLabel');
    expect(bumper).toContain('profileVersionLabel');
    expect(bumper).toContain('PLATHO_APP_RUNTIME_VERSION');
    expect(bumper).toContain('"version"');
    // Exactly-one-match or refuse. A scripted replace that silently takes the first of several matches once
    // rewrote an unrelated function while `node --check` stayed happy.
    expect(bumper).toContain('expected exactly one match');
  });

  it('RELVER-03: the version is NOT a cache key, and the cache key is not the version', () => {
    // The whole point of the 2026-08-09 split. If the entry point were busted by the version, a hotfix that
    // rightly leaves the version alone would serve the old bundle to every installed client forever.
    expect(html).toMatch(/<script src="\/app\.js\?v=(b[0-9a-f]{8})" type="module">/);
    const version = /id="appVersionLabel">(\d+\.\d+\.\d+)</.exec(html)?.[1] ?? '';
    expect(html).not.toContain(`app.js?v=${version}`);
  });

  it('RELVER-04: production deploy refuses a version that is already live', () => {
    // This is what makes forgetting impossible without making the number meaningless.
    expect(deploy).toContain('--same-version');
    expect(deploy).toContain('is already live');
    expect(deploy).toContain('bump_release_version.mjs');
    // An unreachable site must NOT block a deploy — that is exactly when you most need one.
    const check = deploy.slice(deploy.indexOf('THE VERSION MUST MOVE'));
    expect(check.slice(0, 3000)).toContain('shipping without the same-version check');
  });

  it('RELVER-05: the guard reads the machine being deployed to, not the public name', () => {
    // With one server these are the same address and the difference is invisible. With two they are not: on
    // 2026-08-20, right after 1.1.7 reached the live box, shipping the SAME release to the second server — still
    // on 1.1.5 — was refused as "already live". The guard had asked a machine nobody was deploying to, and the
    // only way past it was --same-version, which also waves through the real mistake this exists to catch.
    expect(deploy, 'the version probe is pinned to a hard-coded URL again')
      .not.toMatch(/fetch\(\s*['"]https:\/\/platho\.app\//);
    // It must connect to HOST while still presenting the real name, or Caddy answers for a vhost that does not
    // exist and the probe reads an empty version — which silently disables the check instead of failing loudly.
    const guard = deploy.slice(deploy.indexOf("!process.argv.includes('--same-version')"));
    const body = guard.slice(0, guard.indexOf('\n}'));
    expect(body).toContain('JSON.stringify(HOST)');
    // The name presented is the SITE's (2026-08-21: the stand stage.platho.app shares the machine and the
    // script), resolved once above the guard — production is still asked as platho.app.
    expect(body).toContain('servername: ${JSON.stringify(SITE_HOST)}');
    expect(body).toContain('Host: ${JSON.stringify(SITE_HOST)}');
    expect(deploy).toMatch(/const SITE_HOST = SITE === 'stage' \? 'stage\.platho\.app' : 'platho\.app';/);
    // Unreachable target still ships, and the note names WHICH machine could not be read.
    expect(body).toContain('could not read the version on');
  });

  it('RELVER-06: the stand takes the same version again without a bump — it is not a release', () => {
    // A build under test carries the number it would ship with, so re-shipping 1.2.4 to stage.platho.app while
    // 1.2.4 is already there is the normal case. The guard says so and ships; only PRODUCTION refuses.
    const guard = deploy.slice(deploy.indexOf("!process.argv.includes('--same-version')"));
    const body = guard.slice(0, guard.indexOf('\n}'));
    const standBranch = body.indexOf("live === shipping && SITE === 'stage'");
    const refuseBranch = body.indexOf('live === shipping) {');
    expect(standBranch, 'the stand branch exists').toBeGreaterThan(-1);
    expect(standBranch, 'and is tested BEFORE the refusal, or it never runs').toBeLessThan(refuseBranch);
    expect(body).toContain('a stand takes the same version again');
  });
});
