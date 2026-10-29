import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';


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
  'web/fee-vault.mjs',
  'web/fee-vault-read.mjs',
  'web/cutover-epoch.mjs',
];

const FORBIDDEN = [
  { pattern: /@ton\/core/, why: '@ton/core does not load in the browser — use web/pwa-contract-transactions.mjs' },
  { pattern: /\.\.\/build\//, why: 'build/*.ts are TypeScript Tact wrappers — the browser cannot import them' },
  { pattern: /^node:/, why: 'node: builtins do not exist in the browser' },
  { pattern: /^(fs|path|crypto|buffer)$/, why: 'Node builtins do not exist in the browser' },
];

function importsOf(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const specs: string[] = [];
  for (const m of source.matchAll(/^\s*import\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]/gm)) specs.push(m[1]);
  for (const m of source.matchAll(/^\s*export\s+[^'"]*?\sfrom\s+['"]([^'"]+)['"]/gm)) specs.push(m[1]);
  return specs.map((s) => s.replace(/\?.*$/, ''));
}

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
      if (!spec.startsWith('.')) continue;
      const resolved = relative(process.cwd(), resolve(dirname(file), spec)).replace(/\\/g, '/');
      if (!visited.has(resolved)) queue.push({ file: resolved, via: [...via, file] });
    }
  }
  return { visited, violations };
}

describe('BROWSER-LOADABLE-MODULES — the shipping client path loads without a bundler', () => {
  it('BROWSER-LOAD-01: no module reachable from a browser entry point imports a Node-only dependency', () => {
    const { visited, violations } = walk(BROWSER_ENTRY_POINTS);

    const report = violations
      .map((v) => `  ${v.file} imports "${v.spec}"\n      reached via: ${[...v.via, v.file].join(' -> ')}\n      ${v.why}`)
      .join('\n');
    expect(violations.length, violations.length ? `\n${report}\n` : '').toBe(0);

    expect(visited.size, 'the import walk must reach beyond the entry points').toBeGreaterThan(BROWSER_ENTRY_POINTS.length);
  });

  it('BROWSER-LOAD-02: the reference builder is NOT in the browser graph, and still exists', () => {
    const { visited } = walk(BROWSER_ENTRY_POINTS);
    expect([...visited], 'the reference builder must not be reachable from the browser path')
      .not.toContain('web/publish-builder.mjs');

    const reference = readFileSync('web/publish-builder.mjs', 'utf8');
    expect(reference, 'the reference must keep deriving independently').toMatch(/from '@ton\/core'/);
    expect(reference, 'the reference must not borrow the browser derivation')
      .not.toMatch(/from '\.\/shard-discovery\.mjs(\?[^']*)?'/);
  });

  it('BROWSER-LOAD-03: every module is imported under ONE specifier — a second form is a second download', () => {
    const files: string[] = [];
    (function walkDir(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = `${dir}/${entry.name}`;
        if (entry.isDirectory()) { if (entry.name !== 'vendor') walkDir(p); }
        else if (/\.(mjs|js)$/.test(entry.name)) files.push(p);
      }
    })('web');

    const forms = new Map<string, Map<string, string[]>>();
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

    expect(forms.size, 'the specifier scan must reach the module graph').toBeGreaterThan(50);
  });
});
