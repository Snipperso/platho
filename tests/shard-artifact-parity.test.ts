import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';


const SHARDS = ['RecordShard', 'IntroShard', 'RecoveryShard'];

const sourceOf = (name: string) => readFileSync(`contracts/${name}.tact`, 'utf8');
const compiledOf = (name: string) => readFileSync(`build/${name}/${name}_${name}.fc`, 'utf8');
const wrapperOf = (name: string) => readFileSync(`build/${name}/${name}_${name}.ts`, 'utf8');

function gateCodes(src: string): number[] {
  const out = new Set<number>();
  for (const m of src.matchAll(/throwUnless\(\s*(\d+)/g)) out.add(Number(m[1]));
  return [...out].sort((a, b) => a - b);
}

function messageFields(src: string): Array<{ message: string; fields: string[] }> {
  const out: Array<{ message: string; fields: string[] }> = [];
  for (const m of src.matchAll(/message\([^)]*\)\s+(\w+)\s*\{([^}]*)\}/g)) {
    const fields = [...m[2].matchAll(/^\s*(\w+)\s*:/gm)].map((f) => f[1]);
    out.push({ message: m[1], fields });
  }
  return out;
}

describe('ARTIFACT PARITY — build/ matches contracts/', () => {
  for (const name of SHARDS) {
    it(`${name}: every gate in the source exists in the built artifact`, () => {
      const src = sourceOf(name);
      const built = compiledOf(name);
      const codes = gateCodes(src);
      expect(codes.length, 'the contract must actually have gates').toBeGreaterThan(0);

      const missing = codes.filter((c) => !built.includes(String(c)));
      expect(missing, `stale build/${name} — rebuild with: node scripts/tact_build.js --config tact.config.json --project ${name}`).toEqual([]);
    });

    it(`${name}: every message field in the source is serialized by the built wrapper`, () => {
      const src = sourceOf(name);
      const built = wrapperOf(name);
      for (const { message, fields } of messageFields(src)) {
        expect(built, `build/${name} does not know message ${message}`).toContain(message);
        for (const f of fields) {
          expect(built.includes(`_${f}`) || built.includes(`src.${f}`), `${message}.${f} missing from build/${name} — stale artifact`).toBe(true);
        }
      }
    });
  }

  it('the parity check can actually fail (it is not vacuously true)', () => {
    const fakeSource = 'throwUnless(99991, x); throwUnless(99992, y);';
    const codes = gateCodes(fakeSource);
    expect(codes).toEqual([99991, 99992]);
    const built = compiledOf('RecordShard');
    expect(codes.filter((c) => !built.includes(String(c)))).toEqual([99991, 99992]);
  });
});
