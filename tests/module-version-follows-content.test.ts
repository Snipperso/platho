import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { appBuildId, cacheId, cacheIdFromEntries, precacheEntries } from '../scripts/web_cache_ids.mjs';
import { shippedBytes } from '../scripts/lib/strip-comments.mjs';

const BASELINE = 'artifacts/module-version-content-baseline.json';
const UPDATE = process.argv.includes('--update') || process.env.PLATHO_UPDATE_MODULE_BASELINE === '1';

function versionedModules(): Map<string, string> {
  const out = new Map<string, string>();
  const sources = ['web/index.html'];
  for (const dir of ['web', 'web/crypto']) {
    for (const name of readdirSync(dir)) {
      if (/\.(mjs|js)$/.test(name)) sources.push(`${dir}/${name}`);
    }
  }
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
  return vendorPathFor(name);
}

function vendorPathFor(name: string): string | null {
  const stack: string[] = ['web/vendor'];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries: any[] = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) stack.push(path);
      else if (entry.name === name) return path;
    }
  }
  return null;
}


describe('MODCONTENT — a module version must move when the module does', () => {
  it('MODCONTENT-01: every versioned module matches the content its version was recorded against', () => {
    const modules = versionedModules();
    const current: Record<string, { version: string; sha256: string }> = {};
    for (const [name, version] of [...modules].sort()) {
      const path = resolveModulePath(name);
      if (!path) continue;
      current[name] = { version, sha256: createHash('sha256').update(shippedBytes(path)).digest('hex') };
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
      if (!was) continue;
      if (now.sha256 === was.sha256) continue;
      if (now.version !== was.version) continue;
      stale.push(`${name}: content changed but ?v= is still ${now.version}`);
    }
    expect(stale, `a changed module kept its version, so cached clients will not see it:\n${stale.join('\n')}`).toEqual([]);
  });

  it('MODCONTENT-03: one product version in three places, and both cache keys equal the content they key', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const html = readFileSync('web/index.html', 'utf8');
    const sw = readFileSync('web/sw.js', 'utf8');

    const version = app.match(/const PLATHO_APP_RUNTIME_VERSION = '(\d+\.\d+\.\d+)';/)?.[1];
    expect(version, 'PLATHO_APP_RUNTIME_VERSION must be a semantic version').toBeTruthy();
    for (const id of ['appVersionLabel', 'profileVersionLabel']) {
      expect(html, `${id} must show the product version`)
        .toMatch(new RegExp(`id="${id}"[^>]*>${version.replace(/\./g, '\\.')}<`));
    }
    expect(JSON.parse(readFileSync('package.json', 'utf8')).version, 'package.json states a different version')
      .toBe(version);

    const buildId = appBuildId();
    expect(buildId, 'the build id must not look like a counter').toMatch(/^b[0-9a-f]{8}$/);
    expect(html, 'index.html loads an app.js build that is not the one in the tree').toContain(`/app.js?v=${buildId}"`);
    expect(sw, 'the service worker precaches an app.js build that is not the one in the tree')
      .toContain(`'./app.js?v=${buildId}'`);

    expect(sw, 'CACHE_NAME does not match the content of the precache').toContain(`const CACHE_NAME = 'platho-pwa-${cacheId()}';`);

    const tool = readFileSync('scripts/bump_module_versions.mjs', 'utf8');
    expect(tool).toContain("const RELEASE_VERSIONED = new Set(['app.js']);");
    expect(tool).toContain('if (RELEASE_VERSIONED.has(name)) return null;');
  });

  it('MODCONTENT-04: the two derived ids actually follow content — a constant would pass MODCONTENT-03', () => {
    expect(appBuildId(Buffer.from('one'))).not.toBe(appBuildId(Buffer.from('two')));
    expect(appBuildId(Buffer.from('one'))).toBe(appBuildId(Buffer.from('one')));

    const entries = precacheEntries();
    expect(entries.length, 'the precache scan must not come back empty').toBeGreaterThan(80);
    const changedBytes = entries.map((e, i) => (i === 0 ? { ...e, sha256: `${e.sha256}x` } : e));
    expect(cacheIdFromEntries(changedBytes)).not.toBe(cacheIdFromEntries(entries));
    const changedUrl = entries.map((e, i) => (i === 0 ? { ...e, url: `${e.url}?rev` } : e));
    expect(cacheIdFromEntries(changedUrl)).not.toBe(cacheIdFromEntries(entries));
    expect(cacheIdFromEntries(entries.slice(1))).not.toBe(cacheIdFromEntries(entries));
  });

  it('MODCONTENT-05: the line never enters the reserved range — ?v= 10000 and up belongs to builds forked off it', () => {
    const RESERVED = 10000;
    const RE = /['"`](\.[^'"`]*?\/?([A-Za-z0-9._-]+\.(?:mjs|js|css)))\?v=(\d+)['"`]/g;
    const sources = ['web/index.html'];
    for (const dir of ['web', 'web/crypto']) {
      for (const name of readdirSync(dir)) if (/\.(mjs|js)$/.test(name)) sources.push(`${dir}/${name}`);
    }
    const inRange: string[] = [];
    let seen = 0;
    for (const file of sources) {
      for (const m of readFileSync(file, 'utf8').matchAll(RE)) {
        seen += 1;
        if (Number(m[3]) >= RESERVED) inRange.push(`${file}: ${m[2]}?v=${m[3]}`);
      }
    }
    expect(seen, 'the scan found no versioned references — it would pass anything').toBeGreaterThan(100);
    expect([...`import { CUTOVER_EPOCH } from './cutover-epoch.mjs?v=10006';`.matchAll(RE)].map((m) => Number(m[3])))
      .toEqual([10006]);
    expect(inRange, `a line reference inside the forked-build range:\n${inRange.join('\n')}`).toEqual([]);
  });

  it('MODCONTENT-02: the baseline covers the modules that matter — an empty scan must not pass', () => {
    const modules = versionedModules();
    expect(modules.size).toBeGreaterThan(40);
    for (const required of ['i18n-strings.mjs', 'platho-crypto.mjs', 'pwa-contract-transactions.mjs']) {
      expect(modules.has(required), `${required} is not being scanned`).toBe(true);
    }
  });
});
