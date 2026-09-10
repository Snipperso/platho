import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// MODULE VERSION COVERAGE — every module a browser loads must carry a cache key at EVERY import site.
//
// MODCONTENT proves that a TRACKED module's version moves when its content does. It cannot prove that a module
// is tracked at all, and on 2026-08-28 two were not: web/intro-receive.mjs and web/intro-scan.mjs, between them
// the whole first-contact receive path. Their only importers used a bare `from './x.mjs'`, so they had no
// baseline entry, no version, and no cache key that could ever move. A change to either — including a security
// fix — would be served from the browser's old copy indefinitely.
//
// THE FIRST VERSION OF THIS GATE HAD THE SAME SHAPE OF HOLE IT WAS WRITTEN TO CLOSE [corrected 2026-08-29].
// It listed modules with `readdirSync('web')`, which does not descend, so `web/crypto/` was in neither the
// module list nor the source list — and an auditor found a LIVE instance sitting there: platho-crypto.mjs
// imported `./intro-handshake.mjs` with no `?v=` at all, and that file was absent from the baseline. That is the
// INTRO first-contact handshake: the crypto that establishes a conversation. It now walks the tree.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const BASELINE = 'artifacts/module-version-content-baseline.json';

/** Every browser module under web/, at any depth. Returns paths relative to web/, e.g. 'crypto/x.mjs'. */
const walkModules = (dir = 'web', prefix = ''): string[] => {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      // vendor/ is third-party and shipped whole; node_modules and build output are not served.
      if (['vendor', 'node_modules', 'build', 'docs'].includes(e.name)) continue;
      out.push(...walkModules(join(dir, e.name), prefix + e.name + '/'));
    } else if (e.name.endsWith('.mjs')) {
      out.push(prefix + e.name);
    }
  }
  return out;
};

const readSources = (modules: string[]): Map<string, string> => {
  const sources = new Map<string, string>();
  for (const rel of [...modules.map((m) => `web/${m}`), 'web/app.js', 'web/sw.js']) {
    try { sources.set(rel, readFileSync(rel, 'utf8')); } catch { /* not present */ }
  }
  return sources;
};

/** Import sites of `basename`, as [sourceFile, hadVersion] — quotes of either kind, any relative depth. */
const importSites = (basename: string, sources: Map<string, string>): Array<[string, boolean]> => {
  const esc = basename.replace('.', '\\.');
  const re = new RegExp(`from\\s+['"][^'"]*\\/${esc}(\\?v=\\d+)?['"]`, 'g');
  const found: Array<[string, boolean]> = [];
  for (const [src, text] of sources) {
    if (src.endsWith(`/${basename}`)) continue;
    for (const m of text.matchAll(re)) found.push([src, Boolean(m[1])]);
  }
  return found;
};

describe('MODULE-VERSION-COVERAGE', () => {
  const modules = walkModules();
  const sources = readSources(modules);

  it('MVC-01: no browser module is imported without a ?v= cache key, at any depth', () => {
    const offenders: string[] = [];
    for (const rel of modules) {
      const base = rel.split('/').pop()!;
      for (const [src, versioned] of importSites(base, sources)) {
        if (!versioned) offenders.push(`${src} imports ${rel} with no ?v=`);
      }
    }
    expect(offenders,
      'A bare import has no cache key, so a deployed change to that module is never fetched by a browser '
      + 'holding the old copy. Add ?v=1 at the import site and re-run scripts/bump_module_versions.mjs --run.\n  '
      + offenders.join('\n  ')).toEqual([]);
  });

  it('MVC-02: every imported browser module has a baseline entry, so MODCONTENT can watch it', () => {
    const baseline: Record<string, unknown> = JSON.parse(readFileSync(BASELINE, 'utf8'));
    const missing: string[] = [];
    for (const rel of modules) {
      const base = rel.split('/').pop()!;
      if (importSites(base, sources).length === 0) continue;   // an entry point, not an imported module
      if (!Object.prototype.hasOwnProperty.call(baseline, base)) missing.push(rel);
    }
    expect(missing,
      'These modules are imported but absent from the version baseline, so MODCONTENT never checks them and '
      + 'their content can drift from their cache key forever.\n  ' + missing.join('\n  ')).toEqual([]);
  });

  it('MVC-03: the walk really reaches subdirectories — the hole this gate itself had', () => {
    // Without this, the two assertions above silently cover a smaller tree than they claim to. The first
    // version listed only `readdirSync('web')` and therefore never saw web/crypto/, where a live bare import
    // was sitting the whole time.
    expect(modules.some((m) => m.includes('/')),
      'the module list is flat — subdirectories under web/ are not being scanned').toBe(true);
    expect(modules, 'web/crypto/intro-handshake.mjs is the instance that exposed the hole; it must be in scope')
      .toContain('crypto/intro-handshake.mjs');
  });
});
