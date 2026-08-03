import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// A module that SHIPS to the browser may not reach for a Node global.
//
// MEASURED 2026-08-03, from the owner's phone diagnostic: the intro scan reported `Buffer is not defined` on every
// pass. Two shipped modules built a 256-bit hash as `BigInt('0x' + Buffer.from(h).toString('hex'))`, and one of them
// is named `introBodyCommitBrowser`. The consequence was total: the scan FOUND the intro, fetched the capsule, and
// died verifying the body commitment — so first contact could never complete in a browser while the sender watched
// every message publish successfully. The error went to console.warn, which on a phone nobody can read.
//
// The file list is the one the deploy actually ships, not a hand-written guess, so a new browser module is covered
// the moment it enters the bundle.
//
// The names are matched on a WORD boundary and not after a dot or an identifier character. A plain substring scan
// counts `ArrayBuffer`, `slice.loadBuffer`, and `processImage` as offenders — it reported ten hits on this tree, of
// which six were that. A guard that cries wolf gets its baseline widened until it stops guarding anything.
const NODE_ONLY_GLOBALS: Array<{ name: string; use: RegExp; guard: RegExp }> = [
  { name: 'Buffer', use: /(?<![$\w.])Buffer\b/g, guard: /typeof\s+Buffer\s*[!=]==?/g },
  { name: 'process', use: /(?<![$\w.])process\b/g, guard: /typeof\s+process\s*[!=]==?/g },
  { name: '__dirname', use: /(?<![$\w.])__dirname\b/g, guard: /typeof\s+__dirname\s*[!=]==?/g },
  { name: '__filename', use: /(?<![$\w.])__filename\b/g, guard: /typeof\s+__filename\s*[!=]==?/g },
  { name: 'require()', use: /(?<![$\w.])require\s*\(/g, guard: /typeof\s+require\s*[!=]==?/g },
];

async function shippedBrowserModules(): Promise<string[]> {
  const mod = await import(pathToFileURL('scripts/prepare_static_web_deploy.mjs').href);
  const prep = JSON.parse(readFileSync('artifacts/web_static_deploy_prep.production.json', 'utf8'));
  const files: string[] = (prep.runtime?.files ?? []).map((f: any) => String(f.path ?? f));
  expect(typeof mod.shouldIncludeWebRuntimeFile).toBe('function');
  return files.filter((path) => /\.mjs$/.test(path) && !path.startsWith('vendor/'));
}

/** Strip comments and strings so a mention inside prose or a `typeof` guard is not read as a use. */
function executableText(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');
}

/** Node globals used outside a `typeof` feature test, as `name used Nx, guarded Mx` lines. */
function unguardedNodeGlobals(source: string, label: string): string[] {
  const text = executableText(source);
  const offenders: string[] = [];
  for (const { name, use, guard } of NODE_ONLY_GLOBALS) {
    const uses = (text.match(use) ?? []).length;
    if (uses === 0) continue;
    // A `typeof X !== 'undefined'` feature test is the legitimate dual-mode shape: it is how platho-crypto supports
    // both worlds. The test itself mentions the name, so one guard covers itself plus the branch it opens — hence
    // `uses > guards * 2`. Anything beyond that is a use standing outside a feature test.
    const guards = (text.match(guard) ?? []).length;
    if (uses > guards * 2) offenders.push(`${label}: ${name} used ${uses}x, guarded ${guards}x`);
  }
  return offenders;
}

describe('BROWSERSAFE — shipped modules must not use Node globals', () => {
  it('BROWSERSAFE-01: no shipped browser module reaches for a Node global unguarded', async () => {
    const offenders: string[] = [];
    for (const path of await shippedBrowserModules()) {
      offenders.push(...unguardedNodeGlobals(readFileSync(`web/${path}`, 'utf8'), `web/${path}`));
    }
    expect(offenders, `a Node global in a browser bundle throws at runtime, not at build:\n${offenders.join('\n')}`)
      .toEqual([]);
  });

  it('BROWSERSAFE-02: the scan covers the modules it claims to — an empty file list must not pass', async () => {
    // Counter-case. "No offenders found" is also what a scan of nothing returns, and this guard's whole value is
    // that it looks at the REAL shipped list.
    const modules = await shippedBrowserModules();
    expect(modules.length).toBeGreaterThan(30);
    for (const required of ['intro-transport.mjs', 'public-shard-ton-rpc-provider.mjs', 'conv-lane-read.mjs']) {
      expect(modules, `${required} is not in the shipped list`).toContain(required);
    }
  });

  it('BROWSERSAFE-03: the detector catches the exact line that shipped, and none of its look-alikes', () => {
    // Guard-of-the-guard. BROWSERSAFE-01 passing proves nothing on its own — a detector that matches nothing also
    // reports no offenders. Feed it the real defect and the real false positives that its first version produced.
    const shipped = "const commit = BigInt('0x' + Buffer.from(hash).toString('hex'));";
    expect(unguardedNodeGlobals(shipped, 'fixture')).toEqual(['fixture: Buffer used 1x, guarded 0x']);
    expect(unguardedNodeGlobals('if (typeof process !== "undefined") return process.env.X;', 'fixture')).toEqual([]);
    expect(unguardedNodeGlobals('const m = require("node:fs");', 'fixture'))
      .toEqual(['fixture: require() used 1x, guarded 0x']);

    // The six hits the substring version invented on this very tree. Every one of these is ordinary browser code.
    const lookAlikes = [
      'if (value instanceof ArrayBuffer) return new Uint8Array(value);',
      'return Uint8Array.from(slice.loadBuffer(64));',
      'ArrayBuffer.isView(value)',
      'await processImageForAvatar(file);',
      'const buf = new SharedArrayBuffer(8);',
      'obj.process = 1; obj.Buffer = 2;',
    ];
    for (const line of lookAlikes) {
      expect(unguardedNodeGlobals(line, 'fixture'), `false positive on: ${line}`).toEqual([]);
    }
  });
});
