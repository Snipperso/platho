import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';


const BASELINE = 'artifacts/module-version-content-baseline.json';

const walkModules = (dir = 'web', prefix = ''): string[] => {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
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
    try { sources.set(rel, readFileSync(rel, 'utf8')); } catch { }
  }
  return sources;
};

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
      if (importSites(base, sources).length === 0) continue;
      if (!Object.prototype.hasOwnProperty.call(baseline, base)) missing.push(rel);
    }
    expect(missing,
      'These modules are imported but absent from the version baseline, so MODCONTENT never checks them and '
      + 'their content can drift from their cache key forever.\n  ' + missing.join('\n  ')).toEqual([]);
  });

  it('MVC-03: the walk really reaches subdirectories — the hole this gate itself had', () => {
    expect(modules.some((m) => m.includes('/')),
      'the module list is flat — subdirectories under web/ are not being scanned').toBe(true);
    expect(modules, 'web/crypto/intro-handshake.mjs is the instance that exposed the hole; it must be in scope')
      .toContain('crypto/intro-handshake.mjs');
  });
});
