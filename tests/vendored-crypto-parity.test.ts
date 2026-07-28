import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// Supply-chain guard for the ONE layer of Platho's crypto the owner cannot audit by reading: the vendored copy of
// @noble that the PWA actually loads in the browser. The client imports web/vendor/@noble/**, NOT node_modules — the
// vendored tree is a hand-copied snapshot with import specifiers rewritten from bare ("@noble/hashes/sha3.js") to
// relative ("../hashes/sha3.js") so a browser can resolve them without a bundler.
//
// Nothing checked that snapshot against the package it claims to be. A single edited byte inside ml-kem.js — a
// weakened rejection branch, a nudged RNG — would ship to every user, pass every crypto test that only round-trips
// (encrypt/decrypt still agree if BOTH sides are patched), and survive review because nobody reads vendored code.
// This suite pins every vendored .js byte-for-byte against node_modules, modulo exactly the import rewrite.
//
// Scope note: the guard proves "vendor == the installed package", not "the installed package is honest". The second
// half is package-lock's job. Together they close the path.

const PACKAGES = ['ciphers', 'curves', 'hashes', 'post-quantum'] as const;
const VENDOR_ROOT = join(process.cwd(), 'web', 'vendor', '@noble');
const MODULES_ROOT = join(process.cwd(), 'node_modules', '@noble');

/** Every .js file under a vendored package, repo-relative to that package root, forward-slashed. */
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

// The vendoring step rewrites cross-package specifiers to relative paths. Undo it so the comparison sees the original.
// Deliberately narrow: only quoted specifiers, only the four @noble package names, only leading "../" hops. Anything
// else the vendoring touched shows up as a diff — which is the point.
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
    // Not a skip: @noble is a real dependency, so if it is missing the tree is broken, not the guard.
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
    // An orphan is the loudest possible smell: a file that exists ONLY in the copy the browser loads.
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
          continue; // orphans are reported by the test above; do not double-fail here
        }
        compared += 1;
        const vendored = readFileSync(join(VENDOR_ROOT, pkg, file), 'utf8');
        if (canonicalize(vendored) !== canonicalize(original)) drifted.push(`@noble/${pkg}/${file}`);
      }
    }

    // Pin the count too: a vendoring step that silently stopped copying files would otherwise pass with zero drift.
    expect(compared).toBeGreaterThanOrEqual(55);
    expect(drifted, `vendored crypto differs from node_modules beyond the import rewrite:\n${drifted.join('\n')}`).toEqual([]);
  });

  it('leaves no vendored file importing a bare @noble specifier the browser cannot resolve', () => {
    // The mirror failure of the one above: a file that was copied but NOT rewritten resolves to nothing in the PWA.
    // There is no import map, so a bare specifier is a hard load error — and it fails in production only, on the
    // first path that happens to import that file. Found one live: curves/index.js was importing its OWN package by
    // name, which the cross-package rewriter did not match.
    //
    // Statements only. Every noble file carries JSDoc usage examples that quote the bare specifier on purpose
    // ("import { ed25519 } from '@noble/curves/ed25519.js'"), and those are documentation, not module resolution.
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
