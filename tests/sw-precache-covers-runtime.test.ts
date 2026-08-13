import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { precacheAssetUrls, precacheEntries } from '../scripts/web_cache_ids.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// EVERY MODULE THE APP IMPORTS MUST BE PRECACHED.
//
// The service worker's ASSETS list was hand-maintained and had fallen 46 modules behind (found 2026-08-13 while
// designing the on-chain release manifest): every messaging lane (intro, conv, public, recovery, notes), the
// conversation key store, shard addressing, and hkdf.js were shipped but never precached.
//
// WHY IT MATTERS. Those modules reached devices anyway — the runtime fetch handler caches whatever is requested,
// and app.js imports them at boot. But that cache is keyed by CACHE_NAME, and `activate` DELETES the previous
// cache. So after every release each of the 46 had to come back over the network. A device whose network (or
// domain) is gone at that moment has an app that boots and cannot message — which is precisely the situation
// the precache exists for. "Install survives a block" was only ever true for the 108 files in the list.
//
// It also decides what a published release hash can prove: CACHE_NAME is derived from the precache list, so
// anything outside it is outside the content-addressed chain that a third party can verify.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const WEB = 'web';
const slash = (p: string) => p.split('\\').join('/');

/** Transitive static-import closure from the app entry point — what a boot actually needs. */
function reachableFromApp(): string[] {
  const seen = new Set<string>();
  const stack = ['app.js'];
  const importRe = /(?:^|\n)\s*(?:import|export)[^'"\n]*from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
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
    // Sanity: the walk must actually find the graph, or an empty set would pass vacuously.
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
    // precacheEntries throws when the worker warms a URL nothing can answer — a warm that 404s is a cache miss
    // on every load, silently.
    expect(() => precacheEntries()).not.toThrow();
  });

  it('SWCOVER-03: the precached URL carries the SAME ?v= token the importer uses', () => {
    // Two spellings of one module means the worker warms a URL nothing requests, and the request nothing warmed
    // goes to the network — the exact defect that made the old hand-written list useless while looking correct.
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
