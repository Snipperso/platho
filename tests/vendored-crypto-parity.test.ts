import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';


const PACKAGES = ['ciphers', 'curves', 'hashes', 'post-quantum'] as const;
const VENDOR_ROOT = join(process.cwd(), 'web', 'vendor', '@noble');
const MODULES_ROOT = join(process.cwd(), 'node_modules', '@noble');

function collectJs(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.endsWith('.js') || entry.endsWith('.js.map')) continue;
      out.push(relative(root, full).split(sep).join('/'));
    }
  };
  walk(root);
  return out.sort();
}

const SPECIFIER = new RegExp(
  `(['"])((?:\\.\\./)+)(${PACKAGES.join('|')})/`,
  'g',
);

function canonicalize(source: string): string {
  return source
    .replace(/\r\n/g, '\n')
    .replace(SPECIFIER, (_match, quote: string, _hops: string, pkg: string) => `${quote}@noble/${pkg}/`);
}

function readVersion(packageJsonPath: string): string {
  return JSON.parse(readFileSync(packageJsonPath, 'utf8')).version;
}

describe('vendored @noble crypto parity', () => {
  it('has the installed package available to compare against', () => {
    for (const pkg of PACKAGES) {
      expect(
        () => readVersion(join(MODULES_ROOT, pkg, 'package.json')),
        `node_modules/@noble/${pkg} is missing — run npm install before trusting this suite`,
      ).not.toThrow();
    }
  });

  it('vendors exactly the installed version of every @noble package', () => {
    for (const pkg of PACKAGES) {
      const installed = readVersion(join(MODULES_ROOT, pkg, 'package.json'));
      const vendored = readVersion(join(VENDOR_ROOT, pkg, 'package.json'));
      expect(vendored, `web/vendor/@noble/${pkg} claims ${vendored}, node_modules has ${installed}`).toBe(installed);
    }
  });

  it('vendors no .js file that the installed package does not have', () => {
    const orphans: string[] = [];
    for (const pkg of PACKAGES) {
      for (const file of collectJs(join(VENDOR_ROOT, pkg))) {
        try {
          statSync(join(MODULES_ROOT, pkg, file));
        } catch {
          orphans.push(`@noble/${pkg}/${file}`);
        }
      }
    }
    expect(orphans, `vendored files with no counterpart in node_modules:\n${orphans.join('\n')}`).toEqual([]);
  });

  it('keeps every vendored .js byte-identical to the installed package, modulo the import rewrite', () => {
    const drifted: string[] = [];
    let compared = 0;

    for (const pkg of PACKAGES) {
      for (const file of collectJs(join(VENDOR_ROOT, pkg))) {
        const modulesPath = join(MODULES_ROOT, pkg, file);
        let original: string;
        try {
          original = readFileSync(modulesPath, 'utf8');
        } catch {
          continue;
        }
        compared += 1;
        const vendored = readFileSync(join(VENDOR_ROOT, pkg, file), 'utf8');
        if (canonicalize(vendored) !== canonicalize(original)) drifted.push(`@noble/${pkg}/${file}`);
      }
    }

    expect(compared).toBeGreaterThanOrEqual(55);
    expect(drifted, `vendored crypto differs from node_modules beyond the import rewrite:\n${drifted.join('\n')}`).toEqual([]);
  });

  it('leaves no vendored file importing a bare @noble specifier the browser cannot resolve', () => {
    const STATEMENT = /(?:^|[\r\n])\s*(?:import|export)\b[^\r\n]*?from\s*(['"])@noble\//;
    const unrewritten: string[] = [];
    for (const pkg of PACKAGES) {
      for (const file of collectJs(join(VENDOR_ROOT, pkg))) {
        const source = readFileSync(join(VENDOR_ROOT, pkg, file), 'utf8');
        if (STATEMENT.test(source)) unrewritten.push(`@noble/${pkg}/${file}`);
      }
    }
    expect(unrewritten, `vendored files still importing bare @noble specifiers:\n${unrewritten.join('\n')}`).toEqual([]);
  });
});
