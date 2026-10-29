import { readFileSync } from 'node:fs';
import ts from 'typescript';

const KEEP = /^(?:\/\/\s*eslint-|\/\*\s*eslint-|\/\*\s*@vite-ignore|\/\/[#@]\s*sourceMappingURL|\/\*[#@]\s*sourceMappingURL|\/\/\/\s*<reference|\/\/\s*@ts-|\/\*!)/;

const ext = (path) => (path.match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase();

function scriptKind(path) {
  const e = ext(path);
  if (e === 'ts' || e === 'mts' || e === 'cts') return ts.ScriptKind.TS;
  if (e === 'tsx') return ts.ScriptKind.TSX;
  return ts.ScriptKind.JS;
}

function jsCommentRanges(text, path) {
  const sf = ts.createSourceFile(`x.${ext(path) || 'js'}`, text, ts.ScriptTarget.Latest, true, scriptKind(path));
  const found = new Map();
  const collect = (ranges) => {
    for (const r of ranges ?? []) found.set(r.pos, r.end);
  };
  const visit = (node) => {
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) return;
    const kids = node.getChildren(sf);
    if (kids.length === 0) {
      collect(ts.getLeadingCommentRanges(text, node.pos));
      collect(ts.getTrailingCommentRanges(text, node.end));
      return;
    }
    for (const kid of kids) visit(kid);
  };
  visit(sf);
  collect(ts.getLeadingCommentRanges(text, sf.endOfFileToken.pos));
  return [...found].sort((a, b) => a[0] - b[0]);
}

function scanRanges(text, { line = ['//'], block = [['/*', '*/']], quotes = ['"', "'"] } = {}) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (quotes.includes(ch)) {
      let j = i + 1;
      while (j < text.length && text[j] !== ch) {
        if (text[j] === '\\') j += 1;
        else if (text[j] === '\n' && ch !== '`') break;
        j += 1;
      }
      i = j + 1;
      continue;
    }
    const b = block.find(([open]) => text.startsWith(open, i));
    if (b) {
      const end = text.indexOf(b[1], i + b[0].length);
      const stop = end < 0 ? text.length : end + b[1].length;
      out.push([i, stop]);
      i = stop;
      continue;
    }
    if (line.some((open) => text.startsWith(open, i))) {
      let j = text.indexOf('\n', i);
      if (j < 0) j = text.length;
      if (text[j - 1] === '\r') j -= 1;
      out.push([i, j]);
      i = j;
      continue;
    }
    i += 1;
  }
  return out;
}

function cut(text, ranges, gap = ' ') {
  let out = '';
  let at = 0;
  for (const [start, end] of ranges) {
    if (start < at) continue;
    const body = text.slice(start, end);
    if (KEEP.test(body) || (start === 0 && body.startsWith('#!'))) continue;
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = text.indexOf('\n', end);
    if (lineEnd < 0) lineEnd = text.length;
    const before = text.slice(lineStart, start);
    const after = text.slice(end, lineEnd).replace(/\r$/, '');
    const aloneBefore = /^[ \t]*$/.test(before) && lineStart >= at;
    const aloneAfter = /^[ \t]*$/.test(after);
    if (aloneBefore && aloneAfter) {
      out += text.slice(at, lineStart);
      at = lineEnd < text.length ? lineEnd + 1 : lineEnd;
      if (lineEnd >= text.length && out.endsWith('\n') && !text.endsWith('\n')) out = out.replace(/\r?\n$/, '');
    } else if (aloneAfter) {
      out += text.slice(at, start).replace(/[ \t]+$/, '');
      at = end;
    } else if (aloneBefore) {
      out += text.slice(at, start);
      at = end;
      while (text[at] === ' ' || text[at] === '\t') at += 1;
    } else {
      out += text.slice(at, start);
      at = end;
      if (/[ \t]$/.test(out)) while (text[at] === ' ' || text[at] === '\t') at += 1;
      else if (!/^\s/.test(text.slice(at, at + 1))) out += gap;
    }
  }
  return out + text.slice(at);
}

function stripHashLines(text) {
  return text.split(/(?<=\n)/).filter((line, index) => {
    const t = line.trimStart();
    if (!t.startsWith('#')) return true;
    if (index === 0 && t.startsWith('#!')) return true;
    return /^#\s*(?:shellcheck|requires|region|endregion)\b/i.test(t);
  }).join('');
}

function stripHtml(text) {
  const parts = [];
  const re = /(<script\b[^>]*>)([\s\S]*?)(<\/script\s*>)|(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)|<!--[\s\S]*?-->/gi;
  let at = 0;
  for (const m of text.matchAll(re)) {
    parts.push(text.slice(at, m.index));
    if (m[1]) {
      const json = /type\s*=\s*["']?(?:application\/(?:ld\+)?json|importmap)/i.test(m[1]);
      parts.push(m[1] + (json ? m[2] : cut(m[2], jsCommentRanges(m[2], 'inline.js'))) + m[3]);
    } else if (m[4]) {
      parts.push(m[4] + cut(m[5], scanRanges(m[5], { line: [], quotes: ['"', "'"] }), '') + m[6]);
    } else {
      const lineStart = text.lastIndexOf('\n', m.index - 1) + 1;
      const head = text.slice(lineStart, m.index);
      const end = m.index + m[0].length;
      const lineEnd = text.indexOf('\n', end);
      const tail = text.slice(end, lineEnd < 0 ? text.length : lineEnd).replace(/\r$/, '');
      if (/^[ \t]*$/.test(head) && /^[ \t]*$/.test(tail)) {
        parts[parts.length - 1] = parts[parts.length - 1].slice(0, parts[parts.length - 1].length - head.length);
        at = lineEnd < 0 ? text.length : lineEnd + 1;
        continue;
      }
    }
    at = m.index + m[0].length;
  }
  parts.push(text.slice(at));
  return parts.join('');
}

const C_FAMILY = new Set(['tact', 'cu', 'cuh', 'c', 'h', 'cpp']);
const HASH_FAMILY = new Set(['sh', 'ps1', 'yml', 'yaml', 'conf', 'service', 'timer', 'toml', 'example', 'gitignore', 'gitattributes']);

export function commentKind(path, text = '') {
  const name = path.split(/[\\/]/).pop();
  const e = name.includes('.') ? ext(name) : '';
  if (!e && !name.startsWith('.') && text.startsWith('#!')) return 'hash';
  if (['js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'tsx'].includes(e)) return e === 'ts' && name.endsWith('.d.ts') ? null : 'js';
  if (e === 'css') return 'css';
  if (e === 'html' || e === 'htm') return 'html';
  if (C_FAMILY.has(e)) return 'c';
  if (e === 'fc' || e === 'func') return 'func';
  if (HASH_FAMILY.has(e) || name === 'Caddyfile' || name.startsWith('.gitignore') || name === '.gitattributes') return 'hash';
  return null;
}

export function stripComments(text, path) {
  switch (commentKind(path, text)) {
    case 'js': return cut(text, jsCommentRanges(text, path));
    case 'css': return cut(text, scanRanges(text, { line: [], quotes: ['"', "'"] }), '');
    case 'html': return stripHtml(text);
    case 'c': return cut(text, scanRanges(text, { line: ['//'], quotes: ['"', "'"] }));
    case 'func': return cut(text, scanRanges(text, { line: [';;'], block: [['{-', '-}']], quotes: ['"'] }));
    case 'hash': return stripHashLines(text);
    default: return text;
  }
}

export const isVendored = (path) => /(?:^|[\\/])vendor[\\/]/.test(path);

export function shippedBytes(path) {
  const bytes = readFileSync(path);
  const posix = path.replace(/\\/g, '/');
  if (isVendored(posix) || !commentKind(posix, bytes.subarray(0, 2).toString('latin1'))) return bytes;
  return Buffer.from(stripComments(bytes.toString('utf8'), posix), 'utf8');
}

export function leftoverComments(text, path) {
  const kind = commentKind(path);
  const ranges = kind === 'js' ? jsCommentRanges(text, path)
    : kind === 'css' ? scanRanges(text, { line: [], quotes: ['"', "'"] })
      : kind === 'c' ? scanRanges(text, { line: ['//'], quotes: ['"', "'"] }) : [];
  return ranges.map(([s, e]) => text.slice(s, e)).filter((body) => !KEEP.test(body) && !body.startsWith('#!'));
}

export async function sameCode(before, after, path) {
  const kind = commentKind(path);
  if (kind === 'js') {
    const print = (text) => ts.createPrinter({ removeComments: true }).printFile(
      ts.createSourceFile(`x.${ext(path)}`, text, ts.ScriptTarget.Latest, true, scriptKind(path)));
    return print(before) === print(after);
  }
  if (kind === 'css') {
    const { transform } = await import('lightningcss');
    const min = (text) => transform({ filename: 'x.css', code: Buffer.from(text), minify: true, errorRecovery: true })
      .code.toString().replace(/\s+/g, ' ');
    return min(before) === min(after);
  }
  return null;
}
