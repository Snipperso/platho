import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { commentKind, leftoverComments, sameCode, shippedBytes, stripComments } from '../scripts/lib/strip-comments.mjs';

const webFiles = (dir = 'web'): string[] => readdirSync(dir).flatMap((name) => {
  const path = `${dir}/${name}`;
  if (name === 'vendor') return [];
  return statSync(path).isDirectory() ? webFiles(path) : [path];
});

describe('STRIP — a file ships without its comments and with every byte of its code', () => {
  it('STRIP-01: tokens that look like comments stay; comments of every placement go', () => {
    const src = [
      '#!/usr/bin/env node',
      '// a line of its own',
      "const url = 'https://example.org/a'; // after code",
      'const re = /\\/\\/[^*]*\\*/g;',
      'const tpl = `/* not a comment */ ${a /* inside an expression */ + b}`;',
      'const ab = a/* glued */+b;',
      '/** a doc block',
      ' *  over two lines */',
      'export { url, re, tpl, ab };',
      '',
    ].join('\n');
    const out = stripComments(src, 'x.mjs');
    expect(out).toBe([
      '#!/usr/bin/env node',
      "const url = 'https://example.org/a';",
      'const re = /\\/\\/[^*]*\\*/g;',
      'const tpl = `/* not a comment */ ${a + b}`;',
      'const ab = a +b;',
      'export { url, re, tpl, ab };',
      '',
    ].join('\n'));
    expect(leftoverComments(out, 'x.mjs')).toEqual([]);
    expect(stripComments(out, 'x.mjs'), 'idempotent').toBe(out);
  });

  it('STRIP-02: the comments a tool reads are kept', () => {
    const src = "// eslint-disable-next-line no-await-in-loop\nawait x;\nimport(/* @vite-ignore */ url);\n/*! licence */\n";
    expect(stripComments(src, 'x.js')).toBe(src);
  });

  it('STRIP-03: in CSS a comment between two tokens is nothing, not a space — `.a/**/.b` is `.a.b`', async () => {
    const src = '/* head */\n.a/* x */.b { color: red; /* why */ }\n.c { background: url("x/*y*/z.png"); }\n';
    const out = stripComments(src, 'x.css');
    expect(out).toBe('.a.b { color: red; }\n.c { background: url("x/*y*/z.png"); }\n');
    expect(await sameCode(src, out, 'x.css')).toBe(true);
  });

  it('STRIP-04: HTML loses its comments and its scripts\' comments; JSON scripts are left alone', () => {
    const src = '<!-- a note -->\n<p>hi</p>\n<script>\n  // why\n  go(); /* and how */\n</script>\n<script type="application/json">{"a":"/* x */"}</script>\n';
    expect(stripComments(src, 'x.html')).toBe('<p>hi</p>\n<script>\n  go();\n</script>\n<script type="application/json">{"a":"/* x */"}</script>\n');
  });

  it('STRIP-05: Tact and shell — strings keep their markers, full-line `#` comments go, the shebang stays', () => {
    expect(stripComments('const A: Int = 1; // why\nlet s: String = "a // b";\n', 'x.tact')).toBe('const A: Int = 1;\nlet s: String = "a // b";\n');
    expect(stripComments('#!/bin/sh\n# why\necho "#not"\n', 'x.sh')).toBe('#!/bin/sh\necho "#not"\n');
  });

  it('STRIP-06: every file the site ships, as shipped, is the same program with no comment left in it', async () => {
    for (const path of webFiles().filter((p) => commentKind(p) === 'js' || commentKind(p) === 'css')) {
      const shipped = shippedBytes(path).toString('utf8');
      expect(leftoverComments(shipped, path), path).toEqual([]);
      expect(await sameCode(readFileSync(path, 'utf8'), shipped, path), path).toBe(true);
    }
  });

  it('STRIP-07: third-party code ships as published', () => {
    const vendored = join('web', 'vendor', readdirSync('web/vendor').find((n) => statSync(`web/vendor/${n}`).isFile()) ?? '');
    if (vendored.endsWith('vendor')) return;
    expect(shippedBytes(vendored).equals(readFileSync(vendored))).toBe(true);
  });
});
