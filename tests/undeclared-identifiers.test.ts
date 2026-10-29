import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';


const SCRIPT = 'scripts/check_undeclared_identifiers.mjs';

function run(): { code: number; out: string } {
  try {
    const out = execFileSync(process.execPath, [SCRIPT, '--json'], { encoding: 'utf8' });
    return { code: 0, out };
  } catch (error: any) {
    return { code: Number(error?.status ?? 1), out: String(error?.stdout ?? '') };
  }
}

describe('UNDECLARED IDENTIFIERS — every name a shipped module reads can be resolved', () => {
  it('UNDECL-01: the shipped web tree has no read that resolves to nothing', () => {
    const { code, out } = run();
    const report = JSON.parse(out);
    const named = (report.findings ?? []).map((f: any) => `${f.file}:${f.line} ${f.name}`);
    expect(named,
      'These names are read and never declared. That throws at RUNTIME, where neither node --check nor a '
      + 'source-reading gate will meet it. If one is a browser global the list does not know, add it to GLOBALS '
      + `in ${SCRIPT} — never silence the file.`).toEqual([]);
    expect(code, 'and the script exits non-zero when it finds something, so a hook or CI can use it').toBe(0);
    expect(report.files, 'the sweep found the web tree').toBeGreaterThan(50);
  });

  it('UNDECL-02: the checker stays narrow on purpose, and says why in its own file', () => {
    const script = readFileSync(SCRIPT, 'utf8');
    expect(script).toContain("case 'UnaryExpression': return parent.operator !== 'typeof';");
    expect(script).toContain('function featureDetected(ast) {');
    expect(script).toContain('vendor');
  });
});
