import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { shouldIncludeWebRuntimeFile } from '../scripts/prepare_static_web_deploy.mjs';

// Guard against the publish-batch-orchestration.mjs regression: a module that
// app.js statically imports was present in web/ but EXCLUDED from the production
// bundle by prepare_static_web_deploy's allowlist. The server then answered the
// missing module with the SPA fallback (text/html), the browser refused it as a
// module, the whole app.js graph failed, and every user got the boot watchdog.
// This test walks the real import graph from app.js and asserts every relative
// import both exists and is selected into the production bundle.

const WEB_ROOT = resolve('web');

const IMPORT_PATTERNS = [
  /\bfrom\s*['"]([^'"]+)['"]/g, //            import ... from '...'  /  export ... from '...'
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // dynamic import('...')
  /(?:^|[;\n])\s*import\s+['"]([^'"]+)['"]/g, // side-effect import '...'
];

const toPosix = (p: string): string => p.replace(/\\/g, '/');
const stripQuery = (spec: string): string => spec.replace(/[?#].*$/, '');

function walkModuleGraph(entryAbs: string): { missing: string[]; excluded: string[] } {
  const visited = new Set<string>();
  const missing: string[] = [];
  const excluded: string[] = [];
  const queue = [entryAbs];

  while (queue.length) {
    const file = queue.shift() as string;
    if (visited.has(file)) continue;
    visited.add(file);

    const rel = toPosix(relative(WEB_ROOT, file));
    if (!existsSync(file)) {
      missing.push(rel);
      continue;
    }
    if (!shouldIncludeWebRuntimeFile(rel)) {
      excluded.push(rel);
      continue;
    }

    const src = readFileSync(file, 'utf8');
    for (const pattern of IMPORT_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(src))) {
        const spec = match[1];
        // Bare specifiers (e.g. @noble/...) are covered by PWA-CONFIG-09B; here
        // we only follow relative graph edges that the bundle must satisfy.
        if (spec.startsWith('.') || spec.startsWith('/')) {
          queue.push(resolve(dirname(file), stripQuery(spec)));
        }
      }
    }
  }

  return { missing, excluded };
}

describe('production web bundle is import-complete', () => {
  it('WEB-GRAPH-01: every relative import reachable from app.js ships in the production bundle', () => {
    const entry = resolve(WEB_ROOT, 'app.js');
    expect(existsSync(entry), 'web/app.js must exist').toBe(true);

    const { missing, excluded } = walkModuleGraph(entry);

    expect(missing, `imported modules missing from web/:\n${missing.join('\n')}`).toEqual([]);
    expect(
      excluded,
      `imported modules present in web/ but NOT selected into the production bundle ` +
        `(add them to prepare_static_web_deploy ROOT_RUNTIME_FILES):\n${excluded.join('\n')}`,
    ).toEqual([]);
  });

  it('WEB-GRAPH-02: every <script src> in index.html ships in the production bundle', () => {
    const html = readFileSync(resolve(WEB_ROOT, 'index.html'), 'utf8');
    const refs = [...html.matchAll(/<script[^>]*\ssrc="\.\/([^"?]+)(?:\?[^"]*)?"/g)].map((m) => m[1]);

    expect(refs).toContain('boot-guard.js');
    expect(refs).toContain('app.js');
    for (const ref of refs) {
      expect(existsSync(resolve(WEB_ROOT, ref)), `${ref} referenced by index.html must exist`).toBe(true);
      expect(
        shouldIncludeWebRuntimeFile(ref),
        `${ref} referenced by index.html but not selected into the production bundle`,
      ).toBe(true);
    }
  });
});
