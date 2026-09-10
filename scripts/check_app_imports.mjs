#!/usr/bin/env node
/*
 * A NAME THAT A PROJECT MODULE EXPORTS, USED IN app.js, MUST BE IMPORTED THERE.
 *
 * MEASURED 2026-08-04: readPublicPostPayloadV2 was called from FIVE places in web/app.js and imported by none. Every
 * call threw a ReferenceError, and every one of the five sits inside a bare `catch { continue; }` — so the avatar
 * media could never assemble and the public feed's V2 payload reads were dead, both in complete silence. It cost a
 * day of chasing a chain that was healthy the whole time.
 *
 * The check only considers names some web module actually EXPORTS. That is what keeps it quiet: DOM methods
 * (document.createElement), globals (parseInt) and locals are not module exports, so they never appear here. A hit is
 * a genuine "this identifier resolves to nothing at runtime".
 *
 *   node scripts/check_app_imports.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';

const ENTRY = 'web/app.js';
const source = readFileSync(ENTRY, 'utf8');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = `${dir}/${name}`;
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

// COMMENTS ONLY. Stripping STRING literals as well is what broke the first version of this check: app.js holds regex
// literals containing quote characters, the string stripper desynchronised on them and swallowed whole regions —
// including the very call sites being looked for — so it reported "clean" with the import deliberately removed. A
// name that appears only inside a string is a false ALARM here; a swallowed call site is a silent MISS, and this
// check exists because a silent miss cost a day.
const code = source
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

// Every name any project module exports, BOTH globally and per module. vendor/ is third-party and never imported
// by bare name here. The per-module map is what answers the second question below: not "is this name imported"
// but "does the module it is imported FROM actually have it".
const exported = new Set();
const exportsByModule = new Map();
for (const path of walk('web')) {
  if (!path.endsWith('.mjs') || path.includes('/vendor/')) continue;
  const text = readFileSync(path, 'utf8');
  const own = new Set();
  for (const m of text.matchAll(/export\s+(?:async\s+)?function\s*\*?\s*([A-Za-z0-9_$]+)/g)) own.add(m[1]);
  for (const m of text.matchAll(/export\s+(?:const|let|class)\s+([A-Za-z0-9_$]+)/g)) own.add(m[1]);
  for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) own.add(name);
    }
  }
  for (const name of own) exported.add(name);
  exportsByModule.set(path.replace(/^web\//, ''), own);
}

// What app.js imports, under whatever local alias it binds. Parsed from the COMMENT-STRIPPED text: the import block
// carries explanatory comments, and the commas inside them split into entries that swallow the name beside them —
// the second version of this check called seven imported names missing for exactly that reason.
const imported = new Set();
for (const m of code.matchAll(/import\s*\{([^}]*)\}\s*from/g)) {
  for (const part of m[1].split(',')) {
    const name = part.trim().split(/\s+as\s+/).pop()?.trim();
    if (name) imported.add(name);
  }
}
for (const m of code.matchAll(/import\s+([A-Za-z0-9_$]+)\s*(?:,|from)/g)) imported.add(m[1]);

// THE REVERSE QUESTION, and it is just as fatal. [MEASURED 2026-08-29: a deliberately bogus name added to an
// import block passed this check, browser-loadable-modules, the bundle graph and the version gates — all eight
// green — while a browser refuses the module outright: "does not provide an export named …", and nothing loads.
// Same blank screen as a missing import, reached from the other side.]
// A name imported FROM a module must be exported BY that module.
const notExported = [];
for (const m of code.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]\.\/([^'"?]+)(?:\?[^'"]*)?['"]/g)) {
  const modulePath = m[2];
  if (modulePath.includes('vendor/')) continue;
  const own = exportsByModule.get(modulePath);
  if (!own) {
    notExported.push(`${modulePath}  (imported, but no such module under web/)`);
    continue;
  }
  for (const part of m[1].split(',')) {
    const name = part.trim().split(/\s+as\s+/)[0]?.trim();
    if (!name || !/^[A-Za-z0-9_$]+$/.test(name)) continue;
    if (!own.has(name)) notExported.push(`${modulePath}  does not export  ${name}`);
  }
}
if (notExported.length) {
  console.error(`[imports] ${ENTRY}: names imported from a module that does NOT export them:`);
  for (const line of notExported) console.error(`  ${line}`);
  process.exit(1);
}

// What app.js declares itself.
const local = new Set();
for (const m of code.matchAll(/(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g)) local.add(m[1]);
for (const m of code.matchAll(/(?:^|\n)\s*(?:const|let|var|class)\s+([A-Za-z0-9_$]+)/g)) local.add(m[1]);

// EVERY reference, not every CALL. [MEASURED 2026-08-29 — this check said "clean" while the app did not boot.]
// The pattern used to be `name\s*\(`, because the defect it was written for (readPublicPostPayloadV2) was a
// function. A CONSTANT is never called: `const COMPOSER_MAX_MESSAGE_PARTS = MAX_MESSAGE_PARTS;` reads an imported
// name with no parenthesis in sight, so moving that constant into capsule-part-policy.mjs without adding the import
// passed here, passed all 2,102 tests, and threw ReferenceError during module evaluation — a blank screen, not a
// degraded feature. Matching bare identifiers costs nothing: the `exported` filter is what keeps this quiet, and it
// does not care whether a name is called or read. `(?!\s*:)` drops object-literal keys and case labels, which are
// the only bare-identifier positions that are not references.
// The import statements themselves are BINDINGS, not references: `addrKey as publicAddrKey` mentions a name app.js
// never reads under that spelling, and the old call-only pattern skipped it for free. Blank them out first.
const refs = code.replace(/import\s*(?:\{[^}]*\}|[A-Za-z0-9_$]+)\s*from\s*['"][^'"]*['"];?/g, ' ');
const missing = new Map();
for (const m of refs.matchAll(/(?<![.\w$])([A-Za-z0-9_$]+)(?!\s*:)/g)) {
  const name = m[1];
  if (!exported.has(name) || imported.has(name) || local.has(name)) continue;
  if (!missing.has(name)) missing.set(name, refs.slice(0, m.index).split('\n').length);
}

if (missing.size === 0) {
  console.log(`[imports] ${ENTRY}: clean — every module name it uses is imported, and every import resolves`);
  process.exit(0);
}
console.error(`[imports] ${ENTRY}: names some module exports that app.js uses but does NOT import:`);
for (const [name, line] of missing) console.error(`  ${ENTRY}:${line}  ${name}`);
process.exit(1);
