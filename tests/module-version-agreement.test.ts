import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE_DIRS = ['web', 'web/crypto'];
const IMPORT_RE = /['"`](\.[^'"`]*?\/?([A-Za-z0-9._-]+\.(?:mjs|js)))\?v=(\d+)['"`]/g;

function clientSources(): string[] {
  const out: string[] = [];
  for (const dir of SOURCE_DIRS) {
    for (const name of readdirSync(dir)) {
      if (/\.(mjs|js)$/.test(name) && name !== 'sw.js') out.push(join(dir, name));
    }
  }
  out.push('web/index.html');
  return out;
}

function importedVersions(): Map<string, Map<string, string[]>> {
  const importers = new Map<string, Map<string, string[]>>();
  for (const file of clientSources()) {
    for (const m of readFileSync(file, 'utf8').matchAll(IMPORT_RE)) {
      const key = m[2];
      if (!importers.has(key)) importers.set(key, new Map());
      const byVersion = importers.get(key)!;
      if (!byVersion.has(m[3])) byVersion.set(m[3], []);
      byVersion.get(m[3])!.push(file);
    }
  }
  return importers;
}

function precachedVersions(): Map<string, string> {
  const sw = readFileSync('web/sw.js', 'utf8');
  const out = new Map<string, string>();
  for (const m of sw.matchAll(/['"`]\.[^'"`]*?\/?([A-Za-z0-9._-]+\.(?:mjs|js))\?v=(\d+)['"`]/g)) out.set(m[1], m[2]);
  return out;
}

describe('MODVER — one version per module, agreed everywhere it is named', () => {
  it('MODVER-01: every importer of a module asks for the same version', () => {
    const split: string[] = [];
    for (const [mod, byVersion] of importedVersions()) {
      if (byVersion.size <= 1) continue;
      split.push(`${mod}: ${[...byVersion].map(([v, files]) => `v${v} <- ${files.join(', ')}`).join('  |  ')}`);
    }
    expect(split, `a module is imported at more than one version:\n${split.join('\n')}`).toEqual([]);
  });

  it('MODVER-02: the service worker precaches the version the app actually imports', () => {
    const importers = importedVersions();
    const drift: string[] = [];
    for (const [mod, swVersion] of precachedVersions()) {
      const byVersion = importers.get(mod);
      if (!byVersion) continue;
      const wanted = [...byVersion.keys()];
      if (!wanted.includes(swVersion)) drift.push(`${mod}: sw precaches v${swVersion}, importers ask v${wanted.join('/')}`);
    }
    expect(drift, `the precache warms a URL nothing requests:\n${drift.join('\n')}`).toEqual([]);
  });

  it('MODVER-03: the check has something to check — it must not pass by finding nothing', () => {
    const importers = importedVersions();
    expect(importers.size).toBeGreaterThan(40);
    expect(precachedVersions().size).toBeGreaterThan(20);
    expect(importers.has('platho-crypto.mjs')).toBe(true);
    expect(importers.has('conv-routing.mjs')).toBe(true);
  });
});
