import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// BROWSER-LOADABLE-MODULES — the clean-17 client path must actually load in a browser.
//
// This guard exists because the property silently broke once already. web/shard-discovery.mjs imported
// @ton/core and the compiled Tact wrappers under build/, and FOUR shipping modules import it — intro-receive,
// intro-scan-runner, shard-reader, conv-discovery. So the entire INTRO receive path was unloadable in a
// browser while every test stayed green, because tests run in Node where those imports resolve fine.
//
// That is the trap: the test environment is strictly more permissive than the target. Nothing in a Node test
// run can notice. So the check has to be static, and it has to be TRANSITIVE — a browser module that imports a
// browser module that imports @ton/core is just as broken as importing it directly.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Entry points that the PWA loads directly. Everything they reach must be browser-safe too. */
const BROWSER_ENTRY_POINTS = [
  'web/shard-discovery.mjs',
  'web/shard-address.mjs',
  'web/shard-reader.mjs',
  'web/conv-discovery.mjs',
  'web/intro-receive.mjs',
  'web/intro-scan-runner.mjs',
  'web/intro-scan-policy.mjs',
  'web/intro-cursor-store.mjs',
  'web/intro-transport.mjs',
  'web/intro-codec.mjs',
  'web/intro-publish-browser.mjs',
  'web/intro-bucket.mjs',
];

/** Imports that exist only in Node: the browser has no bundler step here, it loads these files as-is. */
const FORBIDDEN = [
  { pattern: /@ton\/core/, why: '@ton/core does not load in the browser — use web/pwa-contract-transactions.mjs' },
  { pattern: /\.\.\/build\//, why: 'build/*.ts are TypeScript Tact wrappers — the browser cannot import them' },
  { pattern: /^node:/, why: 'node: builtins do not exist in the browser' },
  { pattern: /^(fs|path|crypto|buffer)$/, why: 'Node builtins do not exist in the browser' },
];

/** Every static import specifier in a module, with the `?v=NN` cache-busting suffix stripped. */
function importsOf(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const specs: string[] = [];
  for (const m of source.matchAll(/^\s*import\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/gm)) specs.push(m[1]);
  for (const m of source.matchAll(/^\s*export\s+[^'"]*?\sfrom\s+['"]([^'"]+)['"]/gm)) specs.push(m[1]);
  return specs.map((s) => s.replace(/\?.*$/, ''));
}

/** Walk the local import graph from the entry points; returns every reachable file and every violation. */
function walk(entries: string[]) {
  const visited = new Set<string>();
  const violations: Array<{ file: string; spec: string; why: string; via: string[] }> = [];
  const queue: Array<{ file: string; via: string[] }> = entries.map((file) => ({ file, via: [] }));

  while (queue.length) {
    const { file, via } = queue.shift()!;
    if (visited.has(file)) continue;
    visited.add(file);
    expect(existsSync(file), `${file} (reached via ${via.join(' -> ') || 'entry point'}) must exist`).toBe(true);

    for (const spec of importsOf(file)) {
      const bad = FORBIDDEN.find((f) => f.pattern.test(spec));
      if (bad) { violations.push({ file, spec, why: bad.why, via }); continue; }
      if (!spec.startsWith('.')) continue;                 // bare vendored packages are checked by their path
      const resolved = relative(process.cwd(), resolve(dirname(file), spec)).replace(/\\/g, '/');
      if (!visited.has(resolved)) queue.push({ file: resolved, via: [...via, file] });
    }
  }
  return { visited, violations };
}

describe('BROWSER-LOADABLE-MODULES — the shipping client path loads without a bundler', () => {
  it('BROWSER-LOAD-01: no module reachable from a browser entry point imports a Node-only dependency', () => {
    const { visited, violations } = walk(BROWSER_ENTRY_POINTS);

    // A readable failure matters here: the offending import is usually several hops from the entry point, which
    // is exactly why it went unnoticed.
    const report = violations
      .map((v) => `  ${v.file} imports "${v.spec}"\n      reached via: ${[...v.via, v.file].join(' -> ')}\n      ${v.why}`)
      .join('\n');
    expect(violations.length, violations.length ? `\n${report}\n` : '').toBe(0);

    // Sanity: the walk must actually have traversed the graph, not silently visited nothing.
    expect(visited.size, 'the import walk must reach beyond the entry points').toBeGreaterThan(BROWSER_ENTRY_POINTS.length);
  });

  it('BROWSER-LOAD-02: the reference builder is NOT in the browser graph, and still exists', () => {
    // web/publish-builder.mjs deliberately speaks @ton/core and the compiled wrappers: it is the independent
    // implementation the browser derivation is pinned against. It must therefore stay out of the browser graph
    // AND stay Node-only — if it ever started sharing shard-discovery's derivation, the agreement between them
    // would prove nothing.
    const { visited } = walk(BROWSER_ENTRY_POINTS);
    expect([...visited], 'the reference builder must not be reachable from the browser path')
      .not.toContain('web/publish-builder.mjs');

    const reference = readFileSync('web/publish-builder.mjs', 'utf8');
    expect(reference, 'the reference must keep deriving independently').toMatch(/from '@ton\/core'/);
    expect(reference, 'the reference must not borrow the browser derivation')
      .not.toMatch(/from '\.\/shard-discovery\.mjs'/);
  });
});
