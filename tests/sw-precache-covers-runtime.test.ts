import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { precacheAssetUrls, precacheEntries } from '../scripts/web_cache_ids.mjs';


const WEB = 'web';
const slash = (p: string) => p.split('\\').join('/');

function reachableFromApp(): string[] {
  const seen = new Set<string>();
  const stack = ['app.js'];
  const importRe = /(?:^|\n)\s*(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while (stack.length > 0) {
    const rel = stack.pop() as string;
    if (seen.has(rel)) continue;
    const abs = join(WEB, rel);
    if (!existsSync(abs)) continue;
    seen.add(rel);
    const src = readFileSync(abs, 'utf8');
    importRe.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = importRe.exec(src)) !== null) {
      const spec = match[1] ?? match[2];
      if (!spec || !spec.startsWith('.')) continue;
      stack.push(slash(normalize(join(dirname(rel), spec.split('?')[0]))));
    }
  }
  return [...seen].sort();
}

const precachedPaths = new Set(
  precacheAssetUrls().map((url) => url.split('?')[0].replace(/^\.\//, '')).filter(Boolean),
);

describe('service worker precache covers the runtime', () => {
  it('SWCOVER-01: every module reachable from app.js is in the precache list', () => {
    const reachable = reachableFromApp();
    expect(reachable.length).toBeGreaterThan(50);
    expect(reachable).toContain('crypto/platho-crypto.mjs');
    const missing = reachable.filter((path) => path !== 'app.js' && !precachedPaths.has(path));
    expect(
      missing,
      `these modules ship and are imported at boot but are NOT precached, so they must be re-fetched after every `
      + `release — add them to ASSETS in web/sw.js:\n  ${missing.join('\n  ')}`,
    ).toEqual([]);
  });

  it('SWCOVER-02: the app entry itself is precached, and every precached URL has a file behind it', () => {
    expect(precachedPaths.has('app.js')).toBe(true);
    expect(precachedPaths.has('index.html')).toBe(true);
    expect(() => precacheEntries()).not.toThrow();
  });

  it('SWCOVER-04: every document the app can open is precached', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const paths = [...app.matchAll(/path: '\.\/(docs\/[^']+)'/g)].map((match) => match[1]);
    expect(paths.length, 'the documents list should not be empty — did its shape change?').toBeGreaterThanOrEqual(5);
    const missing = paths.filter((path) => !precachedPaths.has(path));
    expect(missing, 'listed in the app, absent from the precache: offline these open on nothing').toEqual([]);
  });

  it('SWCOVER-05: every asset the STYLESHEET fetches is precached', () => {
    const css = readFileSync('web/styles.css', 'utf8');
    const referenced = [...new Set([...css.matchAll(/assets\/[A-Za-z0-9._/-]+/g)].map((match) => match[0]))];
    expect(referenced.length, 'the stylesheet should reference assets — did its shape change?')
      .toBeGreaterThanOrEqual(20);
    const missing = referenced.filter((asset) => !precachedPaths.has(asset));
    expect(missing, `referenced by styles.css, absent from the precache:\n${missing.join('\n')}`).toEqual([]);
    const absent = referenced.filter((asset) => !existsSync(`web/${asset}`));
    expect(absent, `referenced by styles.css, missing from disk:\n${absent.join('\n')}`).toEqual([]);
  });

  it('SWCOVER-03: the precached URL carries the SAME ?v= token the importer uses', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const imported = new Map<string, string>();
    for (const match of app.matchAll(/from\s*['"]\.\/([^'"?]+\.mjs)\?v=(\d+)['"]/g)) {
      imported.set(match[1], match[2]);
    }
    expect(imported.size).toBeGreaterThan(10);
    const precachedTokens = new Map<string, string>();
    for (const url of precacheAssetUrls()) {
      const match = /^\.\/([^?]+\.mjs)\?v=(\d+)$/.exec(url);
      if (match) precachedTokens.set(match[1], match[2]);
    }
    const drifted: string[] = [];
    for (const [path, token] of imported) {
      const warmed = precachedTokens.get(path);
      if (warmed !== undefined && warmed !== token) drifted.push(`${path}: imported ?v=${token}, precached ?v=${warmed}`);
    }
    expect(drifted, `precache warms a different version than the app imports:\n  ${drifted.join('\n  ')}`).toEqual([]);
  });
});
