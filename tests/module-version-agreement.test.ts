import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// EVERY `?v=` IN THE CLIENT, CHECKED AGAINST EVERY OTHER ONE.
//
// A module's cache-bust version is written in three kinds of place: the import sites that request it, the service
// worker list that precaches it, and — until this file — a literal in tests/pwa-runtime-config.test.ts that restated
// the number a third time. Restating it is what broke: a release moves the module and one of the three copies stays.
//
// MEASURED 2026-08-02, the first time this was computed rather than asserted per-literal:
//   profile-registry-ton-rpc-provider.mjs — sw.js precached ?v=44 while app.js imported ?v=45.
// So the service worker was warming a URL nothing requests: cold starts fetched the module over the network and an
// offline start had no copy at all. The literal pin in PWA-CONFIG-08 asserted sw.js contained `?v=44`, which was
// perfectly true — the guard was green ON the defect, because it compared the file with a number rather than with the
// other half of the system.
//
// The same class, one level up, killed the send path today: conv-key-store and conv-routing disagreed about an
// encoding. Agreement between two places is a property; a literal in a third place is not a check of it.
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

/** module basename -> version -> the files asking for it at that version */
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
    // Two importers on different versions means two COPIES of the module in the browser, each with its own module
    // state. Today that was an encoding disagreement between neighbours; it can just as easily be two key stores.
    expect(split, `a module is imported at more than one version:\n${split.join('\n')}`).toEqual([]);
  });

  it('MODVER-02: the service worker precaches the version the app actually imports', () => {
    const importers = importedVersions();
    const drift: string[] = [];
    for (const [mod, swVersion] of precachedVersions()) {
      const byVersion = importers.get(mod);
      if (!byVersion) continue;   // entry points and workers are precached but never imported by URL
      const wanted = [...byVersion.keys()];
      if (!wanted.includes(swVersion)) drift.push(`${mod}: sw precaches v${swVersion}, importers ask v${wanted.join('/')}`);
    }
    expect(drift, `the precache warms a URL nothing requests:\n${drift.join('\n')}`).toEqual([]);
  });

  it('MODVER-03: the check has something to check — it must not pass by finding nothing', () => {
    // The counter-case. Both assertions above are "no disagreements found", which is also what an empty scan returns.
    // Without this, a regex that stopped matching would make the whole file vacuously green.
    const importers = importedVersions();
    expect(importers.size).toBeGreaterThan(40);
    expect(precachedVersions().size).toBeGreaterThan(20);
    expect(importers.has('platho-crypto.mjs')).toBe(true);
    expect(importers.has('conv-routing.mjs')).toBe(true);
  });
});
