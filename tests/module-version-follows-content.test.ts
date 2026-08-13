import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
// The SAME derivation the bump tool writes with — not a second copy of the algorithm. A copy would let the gate
// certify a value the tool never produces, which is the failure this whole file exists to prevent one level down.
import { appBuildId, cacheId, cacheIdFromEntries, precacheEntries } from '../scripts/web_cache_ids.mjs';

// A CHANGED module must get a NEW `?v=`, or every installed client keeps serving the old copy from cache.
//
// OBSERVED 2026-08-03, on the owner's screen: two profile rows rendered `[profile.activityCredits]` and
// `[profile.claimAirdrop]` — the raw i18n keys. The strings were in web/i18n-strings.mjs and had been deployed; the
// app simply never saw them, because the file's version stayed at ?v=33 and the browser answered from cache.
//
// tests/module-version-agreement.test.ts does NOT catch this, and that is the point of a second file. It compares
// importers with each other and with the service worker — three places that all still said 33, and agreed. Agreement
// is not currency. This guard is the missing half: it compares the version against the FILE'S OWN CONTENT.
//
// The baseline is checked in. Change a module without bumping it and this goes red with the file named; bump it and
// the baseline is refreshed by `npm run test:file -- tests/module-version-follows-content.test.ts --update` (or by
// deleting the entry). Regenerating on every run would make it vacuous — it must remember the previous release.
const BASELINE = 'artifacts/module-version-content-baseline.json';
const UPDATE = process.argv.includes('--update') || process.env.PLATHO_UPDATE_MODULE_BASELINE === '1';

/** module path -> the `?v=` its importers use. Reuses the same scan shape as module-version-agreement. */
function versionedModules(): Map<string, string> {
  const out = new Map<string, string>();
  // Read the import sites out of every client source rather than guessing a file list.
  const sources = ['web/index.html'];
  for (const dir of ['web', 'web/crypto']) {
    for (const name of readdirSync(dir)) {
      if (/\.(mjs|js)$/.test(name)) sources.push(`${dir}/${name}`);
    }
  }
  // .css TOO. A stylesheet is cached exactly like a module, and this scan used to skip it: on 2026-08-03 styles.css
  // changed while its ?v= stayed at 276, which is the same defect this file exists for, one file type over.
  const RE = /['"`](\.[^'"`]*?\/?([A-Za-z0-9._-]+\.(?:mjs|js|css)))\?v=(\d+)['"`]/g;
  for (const file of [...new Set(sources)]) {
    if (!existsSync(file)) continue;
    for (const m of readFileSync(file, 'utf8').matchAll(RE)) out.set(m[2], m[3]);
  }
  return out;
}

function resolveModulePath(name: string): string | null {
  for (const candidate of [`web/${name}`, `web/crypto/${name}`]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

describe('MODCONTENT — a module version must move when the module does', () => {
  it('MODCONTENT-01: every versioned module matches the content its version was recorded against', () => {
    const modules = versionedModules();
    const current: Record<string, { version: string; sha256: string }> = {};
    for (const [name, version] of [...modules].sort()) {
      const path = resolveModulePath(name);
      if (!path) continue;   // vendor/worker entries that live outside web/ and web/crypto
      current[name] = { version, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') };
    }

    if (UPDATE || !existsSync(BASELINE)) {
      writeFileSync(BASELINE, `${JSON.stringify(current, null, 2)}\n`);
      expect(Object.keys(current).length).toBeGreaterThan(20);
      return;
    }

    const baseline: Record<string, { version: string; sha256: string }> = JSON.parse(readFileSync(BASELINE, 'utf8'));
    const stale: string[] = [];
    for (const [name, now] of Object.entries(current)) {
      const was = baseline[name];
      if (!was) continue;                       // a new module has nothing to drift from
      if (now.sha256 === was.sha256) continue;  // unchanged
      if (now.version !== was.version) continue; // changed AND bumped — correct
      stale.push(`${name}: content changed but ?v= is still ${now.version}`);
    }
    expect(stale, `a changed module kept its version, so cached clients will not see it:\n${stale.join('\n')}`).toEqual([]);
  });

  it('MODCONTENT-03: one product version in three places, and both cache keys equal the content they key', () => {
    // [2026-08-09] The product version and the cache keys used to be the SAME `vNNN` counter, written by hand in
    // five places that had to agree. They are different jobs and now different things:
    //
    //   VERSION — semantic, moves when a human decides it does. PLATHO_APP_RUNTIME_VERSION, both badges, package.json.
    //   BUILD ID — `./app.js?v=b<hash>`, moves on every byte of app.js. index.html + sw.js.
    //   CACHE ID — CACHE_NAME, moves on every byte of every precached asset. sw.js.
    //
    // The three assertions below are not the same shape. The version is checked for AGREEMENT (three copies of a
    // number a human types). The two ids are checked against the CONTENT THEY ARE DERIVED FROM, which is strictly
    // stronger: agreement alone was green on 2026-08-04 for a set of anchors that all said the same stale thing.
    const app = readFileSync('web/app.js', 'utf8');
    const html = readFileSync('web/index.html', 'utf8');
    const sw = readFileSync('web/sw.js', 'utf8');

    const version = app.match(/const PLATHO_APP_RUNTIME_VERSION = '(\d+\.\d+\.\d+)';/)?.[1];
    expect(version, 'PLATHO_APP_RUNTIME_VERSION must be a semantic version').toBeTruthy();
    // Matched with a pattern rather than a literal substring: the profile badge was HIDDEN on 2026-08-07 (it is an
    // operator affordance, not something a reader of the profile needs), which put a `hidden` attribute between the
    // id and the `>`. The element still carries the version — hiding it must not be mistaken for removing it, and
    // pinning the exact character after the id would have forced a choice between the gate and the UI decision.
    for (const id of ['appVersionLabel', 'profileVersionLabel']) {
      expect(html, `${id} must show the product version`)
        .toMatch(new RegExp(`id="${id}"[^>]*>${version.replace(/\./g, '\\.')}<`));
    }
    // The package manifest is the fourth place a human reads a version off this project. Nothing breaks
    // functionally when it drifts — it just puts two different answers to "what version is this" side by side,
    // which is the exact confusion the move to semantic versioning was meant to end.
    expect(JSON.parse(readFileSync('package.json', 'utf8')).version, 'package.json states a different version')
      .toBe(version);

    // The build id, recomputed here from web/app.js. A stale token in either file is red without anyone having to
    // remember what the previous one was.
    const buildId = appBuildId();
    expect(buildId, 'the build id must not look like a counter').toMatch(/^b[0-9a-f]{8}$/);
    // Root-absolute in index.html (a permalink is served at /<name>/<post>), `./` in the worker (resolved against
    // the worker's own scope). Two spellings, one token.
    expect(html, 'index.html loads an app.js build that is not the one in the tree').toContain(`/app.js?v=${buildId}"`);
    expect(sw, 'the service worker precaches an app.js build that is not the one in the tree')
      .toContain(`'./app.js?v=${buildId}'`);

    // The cache id, recomputed here from every precached asset. This is the guard that a changed icon — an asset
    // with no `?v=` of its own — actually reaches devices; a missed bump meant it reached none.
    expect(sw, 'CACHE_NAME does not match the content of the precache').toContain(`const CACHE_NAME = 'platho-pwa-${cacheId()}';`);

    // And the tool that cascades COUNTER-versioned modules still keeps its hands off app.js, so the counter phase
    // and the build-id phase can never both claim it.
    const tool = readFileSync('scripts/bump_module_versions.mjs', 'utf8');
    expect(tool).toContain("const RELEASE_VERSIONED = new Set(['app.js']);");
    expect(tool).toContain('if (RELEASE_VERSIONED.has(name)) return null;');
  });

  it('MODCONTENT-04: the two derived ids actually follow content — a constant would pass MODCONTENT-03', () => {
    // The counter-case. MODCONTENT-03 compares the files against these functions, so a derivation that returned a
    // fixed string would make it green while guarding nothing. Feed both a change and require the answer to move.
    expect(appBuildId(Buffer.from('one'))).not.toBe(appBuildId(Buffer.from('two')));
    expect(appBuildId(Buffer.from('one'))).toBe(appBuildId(Buffer.from('one')));

    const entries = precacheEntries();
    expect(entries.length, 'the precache scan must not come back empty').toBeGreaterThan(80);
    // Bytes move it...
    const changedBytes = entries.map((e, i) => (i === 0 ? { ...e, sha256: `${e.sha256}x` } : e));
    expect(cacheIdFromEntries(changedBytes)).not.toBe(cacheIdFromEntries(entries));
    // ...and so does the URL alone, which is what catches a re-versioned or newly added asset whose file is
    // unchanged or shared (the two `?v=` variants of manifest.webmanifest are the same bytes twice).
    const changedUrl = entries.map((e, i) => (i === 0 ? { ...e, url: `${e.url}?rev` } : e));
    expect(cacheIdFromEntries(changedUrl)).not.toBe(cacheIdFromEntries(entries));
    // Dropping one must move it too, or removing an asset would leave devices holding the old cache.
    expect(cacheIdFromEntries(entries.slice(1))).not.toBe(cacheIdFromEntries(entries));
  });

  it('MODCONTENT-02: the baseline covers the modules that matter — an empty scan must not pass', () => {
    // Counter-case. The assertion above is "no stale entries found", which an empty scan also satisfies.
    const modules = versionedModules();
    expect(modules.size).toBeGreaterThan(40);
    for (const required of ['i18n-strings.mjs', 'platho-crypto.mjs', 'pwa-contract-transactions.mjs']) {
      expect(modules.has(required), `${required} is not being scanned`).toBe(true);
    }
  });
});
