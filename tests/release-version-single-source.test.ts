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
    expect(check.slice(0, 2000)).toContain('could not read the live version');
  });
});
