import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Wave-8 LOW, generalised. DeployTreasurySupply and ATHWalletTopUpStorageReserve were both declared 0x41544807, and
// because ATHMaster imports ATHWallet both reached one compilation module. Tact did not object; the built ABI simply
// showed header 1096042503 twice. The dangerous direction was silent: a field-less receiver that never checks the body
// is exhausted accepts ANY body carrying its opcode and reports success, so a genesis mint misaimed at an ATH wallet
// would have been swallowed as a storage top-up.
//
// A one-off assertion on that pair would prove nothing about the next pair. This walks every built ABI instead —
// contracts are added to this repo regularly, and the compiler is now known not to catch this.

const BUILD_DIR = join(process.cwd(), 'build');

// Collisions that are MANDATED, not accidental. 0xD53276DB is the shared "excesses" opcode of TEP-62 (NFT) and
// TEP-74 (jetton): two standards that deliberately use one header. It is harmless here for reasons that were checked,
// not assumed — both types carry the identical single field (query_id: uint64), and neither has a RECEIVER anywhere
// in this codebase; they exist only as outgoing bodies, so nothing ever has to decide which one a message is.
// Keyed on the exact set of names, so a third type joining this header still fails.
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
    // If this ever reads zero files the test would pass by doing nothing — the exact failure mode this repo has been
    // bitten by before (a guard aimed at something that is no longer there is an ABSENT guard).
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
