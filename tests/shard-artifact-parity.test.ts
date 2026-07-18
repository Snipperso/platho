import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// ARTIFACT PARITY — the committed build/ must reflect the committed contracts/.
//
// This exists because the failure it catches actually happened: a commit changed contracts/RecordShard.tact to add
// the write-authorization gate (13654) and the replay floor (13653), but did not include the rebuilt artifact. The
// contract source had the gates; build/ did not. Every client and every test imports from build/, so for one commit
// the security fix was present in the source, absent from the code anyone would deploy, and the whole positive suite
// stayed green — PB-01..PB-07 cannot see a missing gate, because they only send well-formed data.
//
// The check derives its expectations FROM THE SOURCE (every throwUnless code, every message field name), so it never
// goes stale and needs no hand-maintained list. If someone edits a .tact and forgets to rebuild, this goes red.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const SHARDS = ['RecordShard', 'IntroShard', 'RecoveryShard'];

const sourceOf = (name: string) => readFileSync(`contracts/${name}.tact`, 'utf8');
// The COMPILED output, not the binding. Measured: the generated .ts wrapper carries only the standard TVM error map,
// so the contract's own throwUnless codes appear in the FunC the compiler emitted (and in the .fif) — that is the
// artifact a stale build actually betrays.
const compiledOf = (name: string) => readFileSync(`build/${name}/${name}_${name}.fc`, 'utf8');
const wrapperOf = (name: string) => readFileSync(`build/${name}/${name}_${name}.ts`, 'utf8');

/** Every error code the contract can throw, taken from the source itself. */
function gateCodes(src: string): number[] {
  const out = new Set<number>();
  for (const m of src.matchAll(/throwUnless\(\s*(\d+)/g)) out.add(Number(m[1]));
  return [...out].sort((a, b) => a - b);
}

/** Field names of every `message(0x..) Name { ... }` block, which the wrapper must serialize. */
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
        // the wrapper declares the type, then stores/loads each field
        expect(built, `build/${name} does not know message ${message}`).toContain(message);
        for (const f of fields) {
          expect(built.includes(`_${f}`) || built.includes(`src.${f}`), `${message}.${f} missing from build/${name} — stale artifact`).toBe(true);
        }
      }
    });
  }

  it('the parity check can actually fail (it is not vacuously true)', () => {
    // A guard that cannot fail is worthless — the exact lesson from the gate this test exists to protect. Feed it a
    // source that declares a gate the artifact cannot contain, and confirm the comparison rejects it.
    const fakeSource = 'throwUnless(99991, x); throwUnless(99992, y);';
    const codes = gateCodes(fakeSource);
    expect(codes).toEqual([99991, 99992]);
    const built = compiledOf('RecordShard');
    expect(codes.filter((c) => !built.includes(String(c)))).toEqual([99991, 99992]);
  });
});
