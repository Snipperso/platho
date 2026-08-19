#!/usr/bin/env node
/*
 * Move the PRODUCT version — the one semantic number a human decides on — in every place that spells it out.
 *
 * There are four, and until now all four were typed by hand. Two of them are pinned to each other by a gate
 * (PWA-RUNTIME: the runtime const and the sidebar badge, which had silently drifted once as v672 vs v691); the
 * other two are pinned to nothing at all, so package.json could sit a release behind and no run would say so.
 *
 * DELIBERATELY NOT A BUILD COUNTER. The version was split away from the cache keys on 2026-08-09 precisely so it
 * could STAND STILL through a one-line hotfix while the cache keys move on every deploy — so this script does not
 * fire on its own. You say what kind of release it is; the deploy refuses to ship a version that is already live,
 * which is what makes forgetting impossible without making the number meaningless.
 *
 *   node scripts/bump_release_version.mjs              # patch: 1.0.34 -> 1.0.35
 *   node scripts/bump_release_version.mjs --minor       # a feature a user can see: 1.0.34 -> 1.1.0
 *   node scripts/bump_release_version.mjs --major       # a break: 1.0.34 -> 2.0.0
 *   node scripts/bump_release_version.mjs --set 1.2.3
 *   node scripts/bump_release_version.mjs --check       # report the four, change nothing
 *
 * Run it BEFORE scripts/bump_module_versions.mjs: this edits app.js and index.html, and the cache keys are hashes
 * of exactly those bytes.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const arg = (name) => process.argv.includes(`--${name}`);
const valueOf = (name) => {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : null;
};

// Each site is matched by an ANCHORED pattern that must hit EXACTLY ONCE. A scripted replace that takes the first
// of several matches is how an unrelated function got rewritten once while `node --check` stayed happy.
const SITES = [
  {
    file: 'package.json',
    // The top-level field. Dependencies carry "name": "^1.2.3", never a "version" key, so this cannot stray.
    pattern: /("version":\s*")(\d+\.\d+\.\d+)(")/,
    what: 'package.json version',
  },
  {
    file: 'web/app.js',
    pattern: /(const PLATHO_APP_RUNTIME_VERSION = ')(\d+\.\d+\.\d+)(')/,
    what: 'runtime const',
  },
  {
    file: 'web/index.html',
    pattern: /(id="appVersionLabel">)(\d+\.\d+\.\d+)(<)/,
    what: 'sidebar badge',
  },
  {
    file: 'web/index.html',
    // Hidden, but live: the Profile pane mirrors the badge for devices whose rail is off-screen (mobile / TMA).
    pattern: /(id="profileVersionLabel" hidden>)(\d+\.\d+\.\d+)(<)/,
    what: 'profile badge',
  },
];

/** Every site's current value, with the file text, or an explicit failure naming the site that could not be read. */
function readSites() {
  const cache = new Map();
  return SITES.map((site) => {
    if (!cache.has(site.file)) cache.set(site.file, readFileSync(site.file, 'utf8'));
    const text = cache.get(site.file);
    const all = [...text.matchAll(new RegExp(site.pattern.source, 'g'))];
    if (all.length !== 1) {
      console.error(`${site.what} (${site.file}): expected exactly one match, found ${all.length}. `
        + 'Refusing to guess — fix the pattern or the file.');
      process.exit(1);
    }
    return { ...site, current: all[0][2] };
  });
}

const sites = readSites();
const distinct = [...new Set(sites.map((s) => s.current))];
for (const site of sites) console.error(`  ${site.what.padEnd(18)} ${site.current}  (${site.file})`);

if (arg('check')) {
  if (distinct.length !== 1) {
    console.error(`\nDRIFTED: ${distinct.join(' vs ')}. Run without --check to bring them together.`);
    process.exit(1);
  }
  console.error(`\nall four agree: ${distinct[0]}`);
  process.exit(0);
}

// A bump computed from a disagreeing set would pick one copy's opinion and silently overwrite the rest, so the
// drift has to be settled first — with --set, which states the answer instead of inferring it.
const explicit = valueOf('set');
if (distinct.length !== 1 && !explicit) {
  console.error(`\nDRIFTED: ${distinct.join(' vs ')}. Pass --set <x.y.z> to say which one is right.`);
  process.exit(1);
}

let next;
if (explicit) {
  if (!/^\d+\.\d+\.\d+$/.test(explicit)) { console.error(`--set expects x.y.z, got "${explicit}"`); process.exit(1); }
  next = explicit;
} else {
  const [major, minor, patch] = distinct[0].split('.').map(Number);
  if (arg('major')) next = `${major + 1}.0.0`;
  else if (arg('minor')) next = `${major}.${minor + 1}.0`;
  else next = `${major}.${minor}.${patch + 1}`;
}

if (distinct.length === 1 && next === distinct[0]) {
  console.error(`\nalready ${next} — nothing to do`);
  process.exit(0);
}

// Written per FILE, not per site: index.html holds two of them, and two separate read-modify-writes of one file
// would have the second read stale content from before the first.
const byFile = new Map();
for (const site of sites) {
  if (!byFile.has(site.file)) byFile.set(site.file, readFileSync(site.file, 'utf8'));
  // Line endings survive because the file is never re-serialized — only the matched span is replaced.
  byFile.set(site.file, byFile.get(site.file).replace(site.pattern, `$1${next}$3`));
}
for (const [file, text] of byFile) writeFileSync(file, text, 'utf8');

const after = readSites();
const settled = [...new Set(after.map((s) => s.current))];
if (settled.length !== 1 || settled[0] !== next) {
  console.error(`\nWROTE BUT DID NOT SETTLE: ${settled.join(' vs ')} (wanted ${next})`);
  process.exit(1);
}
console.error(`\n${distinct.join('/')} -> ${next} in ${byFile.size} files`);
console.error('now run: node scripts/bump_module_versions.mjs --run   (the cache keys hash these bytes)');
