import { describe, expect, it } from 'vitest';
import { findTemporalDeadZoneReads, scanTree } from '../scripts/check_tdz.mjs';


describe('TDZ — the checker, then the tree', () => {
  it('TDZ-01: the production shape is a finding — a later const read inside an earlier branch of the same loop body', () => {
    const source = [
      'function fold(rows, held) {',
      '  for (const row of rows) {',
      '    if (held) {',
      '      if (!mine && !held.label) { held.label = 1; }',
      '      continue;',
      '    }',
      '    const senderHex = row.hex;',
      '    const mine = senderHex === "aa";',
      '    if (!mine) held = row;',
      '  }',
      '}',
    ].join('\n');
    expect(findTemporalDeadZoneReads(source)).toEqual([{ name: 'mine', line: 4, column: 12, declaredAtLine: 8 }]);
  });

  it('TDZ-02: what a dead zone is — and what it is not', () => {
    const findings = (source: string) => findTemporalDeadZoneReads(source).map((f) => `${f.name}@${f.line}`);
    expect(findings('let a = b + 1; let b = 2;')).toEqual(['b@1']);
    expect(findings('const x = x + 1;')).toEqual(['x@1']);
    expect(findings('function f() { if (typeof later === "string") return; let later = 1; return later; }')).toEqual(['later@1']);
    expect(findings('function f() { new K(); class K {} }')).toEqual(['K@1']);
    expect(findings('function f() { return { later }; const later = 1; }'), 'a shorthand property is a read').toEqual(['later@1']);
    expect(findings('function f() { later = 1; const later = 2; }'), 'an assignment is a read of the binding too').toEqual(['later@1']);
    expect(findings('switch (k) { case 1: use(z); break; case 2: const z = 1; }')).toEqual(['z@1']);
    expect(findings('function f() { g(); var v = 1; use(v); function g() {} }')).toEqual([]);
    expect(findings('function f(mine) { if (mine) {} for (const row of []) { if (row) { if (!mine) {} } const mine = 1; } }'), 'the parameter shadows the loop const').toEqual(['mine@1']);
    expect(findings('function f() { const cb = () => later; const later = 1; return cb; }'), 'a closure is not reported').toEqual([]);
    expect(findings('function f() { class C { m() { return later; } } const later = 1; return C; }'), 'a method body is not reported').toEqual([]);
    expect(findings('function f(o) { o.later = 1; const later = 2; return { later: 3 }; }'), 'property names are not reads').toEqual([]);
    expect(findings('function f() { later: for (;;) { break later; } const later = 1; }'), 'labels are not reads').toEqual([]);
    expect(findings('function f() { { use(a); } const a = 1; }'), 'a read in an inner block before the outer const IS a dead zone').toEqual(['a@1']);
    expect(findings('function f() { const a = 1; { const a = a + 1; } }'), 'the inner const shadows: its own initialiser is the dead zone').toEqual(['a@1']);
    expect(findings('function f() { for (const x of xs()) { use(x); } const xs = () => []; }'), 'xs is a read before its const').toEqual(['xs@1']);
    expect(findings('function f() { const a = 1; if (a) { const b = a; return b; } return a; }')).toEqual([]);
    expect(findings('import { x } from "./x.mjs"; use(x); const y = x;')).toEqual([]);
    expect(findings('try { t(); } catch (error) { use(error); } const t = () => 1;'), 'a catch parameter is initialised on entry; t is a read before its const').toEqual(['t@1']);
  });

  it('TDZ-03: the tree is clean', () => {
    const { files, findings } = scanTree('web');
    expect(files).toBeGreaterThan(50);
    expect(findings, findings.map((f) => `${f.file}:${f.line} ${f.name} (declared line ${f.declaredAtLine})`).join('\n')).toEqual([]);
  });
});
