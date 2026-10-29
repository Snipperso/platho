#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';

const ENTRY = 'web/app.js';
const source = readFileSync(ENTRY, 'utf8');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = `${dir}/${name}`;
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const code = source
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

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

const imported = new Set();
for (const m of code.matchAll(/import\s*\{([^}]*)\}\s*from/g)) {
  for (const part of m[1].split(',')) {
    const name = part.trim().split(/\s+as\s+/).pop()?.trim();
    if (name) imported.add(name);
  }
}
for (const m of code.matchAll(/import\s+([A-Za-z0-9_$]+)\s*(?:,|from)/g)) imported.add(m[1]);

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

const local = new Set();
for (const m of code.matchAll(/(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g)) local.add(m[1]);
for (const m of code.matchAll(/(?:^|\n)\s*(?:const|let|var|class)\s+([A-Za-z0-9_$]+)/g)) local.add(m[1]);

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
