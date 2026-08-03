import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

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

  it('MODCONTENT-03: the FOUR release anchors agree, and the bump tool never touches app.js', () => {
    // app.js?v= IS the release version. PLATHO_APP_RUNTIME_VERSION, #appVersionLabel and #profileVersionLabel all
    // live INSIDE app.js, so a tool that auto-bumps app.js on a content change desynchronises the label — and fixing
    // the label changes the content, which bumps it again. That circle burned a release cycle on 2026-08-04.
    const app = readFileSync('web/app.js', 'utf8');
    const html = readFileSync('web/index.html', 'utf8');
    const sw = readFileSync('web/sw.js', 'utf8');
    const runtime = app.match(/const PLATHO_APP_RUNTIME_VERSION = 'v(\d+)';/)?.[1];
    expect(runtime, 'PLATHO_APP_RUNTIME_VERSION is unreadable').toBeTruthy();
    expect(html, 'index.html loads a different app.js than the runtime version claims')
      .toContain(`./app.js?v=${runtime}"`);
    expect(sw, 'the service worker precaches a different app.js than the runtime version claims')
      .toContain(`'./app.js?v=${runtime}'`);
    expect(html).toContain(`id="appVersionLabel">v${runtime}<`);
    expect(html).toContain(`id="profileVersionLabel">v${runtime}<`);
    // And the tool that cascades every OTHER module is told to keep its hands off this one.
    const tool = readFileSync('scripts/bump_module_versions.mjs', 'utf8');
    expect(tool).toContain("const RELEASE_VERSIONED = new Set(['app.js']);");
    expect(tool).toContain('if (RELEASE_VERSIONED.has(name)) return null;');
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
