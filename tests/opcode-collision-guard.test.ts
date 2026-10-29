import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';


const BUILD_DIR = join(process.cwd(), 'build');

const ALLOWED_SHARED_HEADERS = new Map<number, string>([
  [0xd53276db, 'JettonExcesses,NftExcesses'],
]);

function abiFiles(): string[] {
  const out: string[] = [];
  for (const project of readdirSync(BUILD_DIR)) {
    const dir = join(BUILD_DIR, project);
    if (!statSync(dir).isDirectory()) continue;
    for (const file of readdirSync(dir)) {
      if (file.endsWith('.abi')) out.push(join(dir, file));
    }
  }
  return out;
}

describe('opcode collision guard', () => {
  it('OPCODE-01: no two message types share a header inside any compiled contract', () => {
    const files = abiFiles();
    expect(files.length, 'built ABIs must exist — run node scripts/tact_build.js').toBeGreaterThan(10);

    const collisions: string[] = [];
    for (const file of files) {
      const abi = JSON.parse(readFileSync(file, 'utf8')) as {
        name: string;
        types: { name: string; header: number | null }[];
      };
      const byHeader = new Map<number, string[]>();
      for (const type of abi.types ?? []) {
        if (type.header === null || type.header === undefined) continue;
        const names = byHeader.get(type.header) ?? [];
        names.push(type.name);
        byHeader.set(type.header, names);
      }
      for (const [header, names] of byHeader) {
        if (names.length > 1) {
          if (ALLOWED_SHARED_HEADERS.get(header) === [...names].sort().join(',')) continue;
          collisions.push(`${abi.name}: header ${header} (0x${header.toString(16).toUpperCase()}) shared by ${names.join(', ')}`);
        }
      }
    }

    expect(collisions, collisions.join('\n')).toEqual([]);
  });
});
