import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';


function generatedFieldOrder(generatedPath: string, loaderName: string): string[] {
  const source = readFileSync(generatedPath, 'utf8');
  const start = source.indexOf(`export function ${loaderName}(source: TupleReader)`);
  expect(start, `${loaderName} must exist in ${generatedPath}`).toBeGreaterThanOrEqual(0);
  const body = source.slice(start, source.indexOf('\n}', start));
  return [...body.matchAll(/const _([A-Za-z0-9_]+) = source\.read[A-Za-z]+\(\)/g)].map((m) => m[1]);
}

function decoderFieldOrder(modulePath: string, decoderName: string): Array<{ field: string; index: number }> {
  const source = readFileSync(modulePath, 'utf8');
  const start = source.indexOf(`export function ${decoderName}(`);
  expect(start, `${decoderName} must exist in ${modulePath}`).toBeGreaterThanOrEqual(0);
  const body = source.slice(start, source.indexOf('\n}', start));
  return [...body.matchAll(/([A-Za-z0-9_]+): readStack[A-Za-z]+\(stack, (\d+),/g)]
    .map((m) => ({ field: m[1], index: Number(m[2]) }));
}

function declaredArity(modulePath: string, decoderName: string): number {
  const source = readFileSync(modulePath, 'utf8');
  const body = source.slice(source.indexOf(`export function ${decoderName}(`));
  const match = body.match(/stack\.length !== (\d+)/);
  expect(match, `${decoderName} must guard the stack length`).not.toBeNull();
  return Number(match![1]);
}

const CASES = [
  {
    name: 'UsernameRegistry',
    generated: 'build/UsernameRegistry/UsernameRegistry_UsernameRegistry.ts',
    loader: 'loadTupleUsernameRegistryGlobalView',
    module: 'web/username-ton-rpc-provider.mjs',
    decoder: 'decodeUsernameRegistryGlobalStack',
  },
  {
    name: 'ProfileRegistry',
    generated: 'build/ProfileRegistry/ProfileRegistry_ProfileRegistry.ts',
    loader: 'loadTupleProfileRegistryGlobalView',
    module: 'web/profile-registry-ton-rpc-provider.mjs',
    decoder: 'decodeProfileRegistryGlobalStack',
  },
];

describe('REGISTRY-GETTER-DECODER-INDEX — hand-written decoders track the compiled getter', () => {
  for (const c of CASES) {
    it(`DECODER-IDX-${c.name}: every index maps to the field the compiler puts in that position`, () => {
      const generated = generatedFieldOrder(c.generated, c.loader);
      const decoded = decoderFieldOrder(c.module, c.decoder);

      expect(generated.length, `${c.name} getter must expose fields`).toBeGreaterThan(0);
      expect(decoded.map((d) => d.field), `${c.name}: decoder field order vs. compiled getter`).toEqual(generated);
      decoded.forEach((d, position) => {
        expect(d.index, `${c.name}.${d.field} is read from stack[${d.index}] but sits at position ${position}`)
          .toBe(position);
      });
    });

    it(`DECODER-ARITY-${c.name}: the length guard equals the compiled getter's field count`, () => {
      expect(declaredArity(c.module, c.decoder), `${c.name} arity guard`)
        .toBe(generatedFieldOrder(c.generated, c.loader).length);
    });
  }
});
