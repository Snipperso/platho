import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
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
  'web/publish-price.mjs',
  'web/shard-rpc.mjs',
  'web/intro-lane.mjs',
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
    // The `\?[^']*` is load-bearing: written without it this matched only the bare specifier, so adding a
    // `?v=3` cache-buster would have made the guard stop guarding while still passing.
    expect(reference, 'the reference must not borrow the browser derivation')
      .not.toMatch(/from '\.\/shard-discovery\.mjs(\?[^']*)?'/);
  });

  it('BROWSER-LOAD-03: every module is imported under ONE specifier — a second form is a second download', () => {
    // './x.mjs' and './x.mjs?v=1' are DIFFERENT modules to a browser: it fetches, parses and instantiates the
    // file twice, and the service worker precaches by exact URL, so whichever form is not in its list also costs
    // a network round-trip on every cold start. MEASURED before this was unified: the three biggest modules were
    // each pulled twice — platho-crypto (164 KB), pwa-contract-transactions (99 KB), platho-wallet (30 KB) —
    // roughly 350 KB of duplicate JavaScript downloaded and re-parsed on startup, which on the slow devices this
    // project cares about is paid in parse time, not just bytes.
    //
    // Today every divergent module is stateless, so the duplicates were pure waste rather than a bug. That is the
    // reason to hold the line NOW: add a cache or a counter to any of them later and the two copies diverge
    // silently, with no error to trace. The rule is one form per module, and when versions differ the HIGHEST
    // wins — downgrading would serve a returning user a stale copy out of their HTTP cache.
    const files: string[] = [];
    (function walkDir(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = `${dir}/${entry.name}`;
        if (entry.isDirectory()) { if (entry.name !== 'vendor') walkDir(p); }
        else if (/\.(mjs|js)$/.test(entry.name)) files.push(p);
      }
    })('web');

    const forms = new Map<string, Map<string, string[]>>();   // target -> form -> importers
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const m of source.matchAll(/(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g)) {
        const spec = m[1];
        const bare = spec.split('?')[0];
        const target = relative(process.cwd(), resolve(dirname(file), bare)).replace(/\\/g, '/');
        if (!existsSync(target)) continue;
        const form = spec.includes('?') ? spec.slice(spec.indexOf('?')) : '(no suffix)';
        if (!forms.has(target)) forms.set(target, new Map());
        const byForm = forms.get(target)!;
        if (!byForm.has(form)) byForm.set(form, []);
        byForm.get(form)!.push(file);
      }
    }

    const split = [...forms].filter(([, byForm]) => byForm.size > 1);
    const report = split
      .map(([target, byForm]) => `  ${target} is imported ${byForm.size} ways:\n`
        + [...byForm].map(([form, importers]) => `      ${form}  <- ${importers.join(', ')}`).join('\n'))
      .join('\n');
    expect(split.length, split.length ? `\n${report}\n` : '').toBe(0);

    // Sanity: the scan must actually have found imports, or an empty result would pass for the wrong reason.
    expect(forms.size, 'the specifier scan must reach the module graph').toBeGreaterThan(50);
  });
});
