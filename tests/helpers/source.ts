export function code(text: string): string {
  let out = '';
  let quote = '';
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      out += ch;
      if (ch === '\\') { out += text[i + 1] ?? ''; i += 1; }
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; out += ch; continue; }
    if (ch === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i += 1; out += '\n'; continue; }
    if (ch === '/' && text[i + 1] === '*') { const end = text.indexOf('*/', i + 2); i = end < 0 ? text.length : end + 1; continue; }
    out += ch;
  }
  return out;
}

export function sourceBlock(text: string, starts: string): string {
  const at = text.indexOf(starts);
  if (at < 0) throw new Error(`not found: ${starts}`);
  let parens = 0;
  let i = text.indexOf('(', at);
  for (; i < text.length; i += 1) {
    if (text[i] === '(') parens += 1;
    else if (text[i] === ')') { parens -= 1; if (parens === 0) break; }
  }
  let depth = 0;
  for (let k = text.indexOf('{', i); k < text.length; k += 1) {
    if (text[k] === '{') depth += 1;
    else if (text[k] === '}') { depth -= 1; if (depth === 0) return text.slice(at, k + 1); }
  }
  throw new Error(`unbalanced braces after ${starts}`);
}
