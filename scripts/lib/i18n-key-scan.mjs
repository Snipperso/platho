
const KEY_LITERAL = /^(?:'([a-zA-Z0-9_.]+)'|"([a-zA-Z0-9_.]+)"|`([a-zA-Z0-9_.]+)`)$/;
const ARGUMENT_MAX_CHARS = 4_000;

function skipQuoted(src, at) {
  const quote = src[at];
  for (let i = at + 1; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '\\') { i += 1; continue; }
    if (ch === quote) return i + 1;
    if (ch === '\n') return -1;
  }
  return -1;
}

function skipTemplate(src, at) {
  for (let i = at + 1; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '\\') { i += 1; continue; }
    if (ch === '`') return i + 1;
    if (ch === '$' && src[i + 1] === '{') {
      const end = skipCode(src, i + 2, '}');
      if (end < 0) return -1;
      i = end;
    }
  }
  return -1;
}

function skipComment(src, at) {
  if (src[at] !== '/') return at;
  if (src[at + 1] === '/') { const end = src.indexOf('\n', at); return end < 0 ? src.length : end; }
  if (src[at + 1] === '*') { const end = src.indexOf('*/', at + 2); return end < 0 ? -1 : end + 2; }
  return at;
}

function skipCode(src, at, closer) {
  const stack = [];
  for (let i = at; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === "'" || ch === '"') { const end = skipQuoted(src, i); if (end < 0) return -1; i = end - 1; continue; }
    if (ch === '`') { const end = skipTemplate(src, i); if (end < 0) return -1; i = end - 1; continue; }
    if (ch === '/') { const end = skipComment(src, i); if (end < 0) return -1; if (end !== i) { i = end - 1; continue; } }
    if (ch === '(' || ch === '[' || ch === '{') { stack.push(ch); continue; }
    if (ch === ')' || ch === ']' || ch === '}') {
      if (stack.length === 0) return ch === closer ? i : -1;
      stack.pop();
    }
  }
  return -1;
}

export function firstCallArgument(src, at) {
  const stack = [];
  const limit = Math.min(src.length, at + ARGUMENT_MAX_CHARS);
  for (let i = at; i < limit; i += 1) {
    const ch = src[i];
    if (ch === "'" || ch === '"') { const end = skipQuoted(src, i); if (end < 0) return null; i = end - 1; continue; }
    if (ch === '`') { const end = skipTemplate(src, i); if (end < 0) return null; i = end - 1; continue; }
    if (ch === '/') { const end = skipComment(src, i); if (end < 0) return null; if (end !== i) { i = end - 1; continue; } }
    if (ch === '(' || ch === '[' || ch === '{') { stack.push(ch); continue; }
    if (ch === ')' || ch === ']' || ch === '}') {
      if (stack.length === 0) return ch === ')' ? src.slice(at, i) : null;
      stack.pop();
      continue;
    }
    if (ch === ',' && stack.length === 0) return src.slice(at, i);
  }
  return null;
}

function isTernaryMark(src, i) {
  if (src[i] !== '?') return false;
  if (src[i + 1] === '?' || src[i - 1] === '?') return false;
  if (src[i + 1] === '.' && !/[0-9]/.test(src[i + 2] ?? '')) return false;
  return true;
}

function ternaryPieces(expr) {
  const pieces = [];
  const stack = [];
  let start = 0;
  let before = null;
  for (let i = 0; i < expr.length; i += 1) {
    const ch = expr[i];
    if (ch === "'" || ch === '"') { const end = skipQuoted(expr, i); if (end < 0) return null; i = end - 1; continue; }
    if (ch === '`') { const end = skipTemplate(expr, i); if (end < 0) return null; i = end - 1; continue; }
    if (ch === '/') { const end = skipComment(expr, i); if (end < 0) return null; if (end !== i) { i = end - 1; continue; } }
    if (ch === '(' || ch === '[' || ch === '{') { stack.push(ch); continue; }
    if (ch === ')' || ch === ']' || ch === '}') { stack.pop(); continue; }
    if (stack.length > 0) continue;
    const mark = isTernaryMark(expr, i) ? '?' : ch === ':' ? ':' : null;
    if (!mark) continue;
    pieces.push({ text: expr.slice(start, i), before, after: mark });
    before = mark;
    start = i + 1;
  }
  pieces.push({ text: expr.slice(start), before, after: null });
  return pieces;
}

function fallbackOperands(expr) {
  const operands = [];
  const stack = [];
  let start = 0;
  for (let i = 0; i < expr.length; i += 1) {
    const ch = expr[i];
    if (ch === "'" || ch === '"') { const end = skipQuoted(expr, i); if (end < 0) return null; i = end - 1; continue; }
    if (ch === '`') { const end = skipTemplate(expr, i); if (end < 0) return null; i = end - 1; continue; }
    if (ch === '/') { const end = skipComment(expr, i); if (end < 0) return null; if (end !== i) { i = end - 1; continue; } }
    if (ch === '(' || ch === '[' || ch === '{') { stack.push(ch); continue; }
    if (ch === ')' || ch === ']' || ch === '}') { stack.pop(); continue; }
    if (stack.length > 0) continue;
    const pair = expr.slice(i, i + 2);
    if ((pair === '??' || pair === '||') && expr[i + 2] !== '=') {
      operands.push(expr.slice(start, i));
      start = i + 2;
      i += 1;
    }
  }
  operands.push(expr.slice(start));
  return operands;
}

function fallbackKeys(expr) {
  const operands = fallbackOperands(expr);
  if (!operands || operands.length < 2) return [];
  return operands.map(literalKey).filter(Boolean);
}

function withoutComments(text) {
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "'" || ch === '"') { const end = skipQuoted(text, i); if (end < 0) return text; out += text.slice(i, end); i = end - 1; continue; }
    if (ch === '`') { const end = skipTemplate(text, i); if (end < 0) return text; out += text.slice(i, end); i = end - 1; continue; }
    if (ch === '/') { const end = skipComment(text, i); if (end < 0) return text; if (end !== i) { out += ' '; i = end - 1; continue; } }
    out += ch;
  }
  return out;
}

function literalKey(text) {
  let body = withoutComments(text).trim();
  while (body.startsWith('(') && body.endsWith(')') && firstCallArgument(body, 1) === body.slice(1, -1)) body = body.slice(1, -1).trim();
  const m = KEY_LITERAL.exec(body);
  return m ? (m[1] ?? m[2] ?? m[3]) : null;
}

export function argumentKeys(argument) {
  const plain = literalKey(argument);
  if (plain) return [plain];
  const pieces = ternaryPieces(argument);
  if (!pieces) return [];
  if (pieces.length === 1) return fallbackKeys(argument);
  if (pieces.length < 3) return [];
  const keys = [];
  for (const piece of pieces) {
    const arm = (piece.before === '?' || piece.before === ':') && piece.after !== '?';
    if (!arm) continue;
    const key = literalKey(piece.text);
    if (key) { keys.push(key); continue; }
    const inner = withoutComments(piece.text).trim();
    if (inner.startsWith('(') && inner.endsWith(')') && firstCallArgument(inner, 1) === inner.slice(1, -1)) {
      keys.push(...argumentKeys(inner.slice(1, -1)));
      continue;
    }
    keys.push(...fallbackKeys(piece.text));
  }
  return keys;
}

export function collectI18nKeysFromSource(source) {
  const plain = new Set();
  const plural = new Set();
  const unread = [];
  for (const [callee, bucket] of [['t', plain], ['tPlural', plural]]) {
    for (const m of source.matchAll(new RegExp(`\\b${callee}\\(`, 'g'))) {
      const argument = firstCallArgument(source, m.index + m[0].length);
      if (argument === null) { unread.push(source.slice(0, m.index).split('\n').length); continue; }
      for (const key of argumentKeys(argument)) bucket.add(key);
    }
  }
  return { plain, plural, unread };
}
