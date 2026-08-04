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

// Every name any project module exports. vendor/ is third-party and never imported by bare name here.
const exported = new Set();
for (const path of walk('web')) {
  if (!path.endsWith('.mjs') || path.includes('/vendor/')) continue;
  const text = readFileSync(path, 'utf8');
  for (const m of text.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g)) exported.add(m[1]);
  for (const m of text.matchAll(/export\s+(?:const|let|class)\s+([A-Za-z0-9_$]+)/g)) exported.add(m[1]);
  for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) exported.add(name);
    }
  }
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

// What app.js declares itself.
const local = new Set();
for (const m of code.matchAll(/(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g)) local.add(m[1]);
for (const m of code.matchAll(/(?:^|\n)\s*(?:const|let|var|class)\s+([A-Za-z0-9_$]+)/g)) local.add(m[1]);

// Not after a dot (that is a method), and the declaration forms above are already collected.
const missing = new Map();
for (const m of code.matchAll(/(?<![.\w$])([A-Za-z0-9_$]+)\s*\(/g)) {
  const name = m[1];
  if (!exported.has(name) || imported.has(name) || local.has(name)) continue;
  if (!missing.has(name)) missing.set(name, code.slice(0, m.index).split('\n').length);
}

if (missing.size === 0) {
  console.log(`[imports] ${ENTRY}: чисто — каждое использованное имя модуля импортировано`);
  process.exit(0);
}
console.error(`[imports] ${ENTRY}: имена, которые модуль экспортирует, но app.js НЕ импортирует:`);
for (const [name, line] of missing) console.error(`  ${ENTRY}:${line}  ${name}`);
process.exit(1);
