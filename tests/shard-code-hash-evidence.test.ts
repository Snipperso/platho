import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { Cell, contractAddress } from '@ton/core';
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { RecoveryShard } from '../build/RecoveryShard/RecoveryShard_RecoveryShard';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// SHARD-CODE-HASH-EVIDENCE — the clean-17 lane must appear in the release evidence at all.
//
// It did not. scripts/hash_codes.js hashed fourteen contracts and none of RecordShard, IntroShard or
// RecoveryShard, so artifacts/CURRENT_CODE_HASHES.txt never mentioned them and the release Stop Rule — "final
// manifest code hashes match current build outputs" — could not see the entire lane the redeploy is about.
//
// It matters more than a missing row usually would, because a shard's ADDRESS is derived from its code hash.
// Every CONV, INTRO and RECOVERY address in the network moves when the code moves, and the fee sink constant
// baked into two of them moves with it. A code change between the audited archive and the deploy would have
// gone unremarked by every gate in the release chain.
//
// Found by the 2026-07-19 consistency audit, after a day in which the shard code changed four times.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const LANE = [
  ['RECORD_SHARD_CODE_HASH', 'build/RecordShard/RecordShard_RecordShard.code.boc'],
  ['INTRO_SHARD_CODE_HASH', 'build/IntroShard/IntroShard_IntroShard.code.boc'],
  ['RECOVERY_SHARD_CODE_HASH', 'build/RecoveryShard/RecoveryShard_RecoveryShard.code.boc'],
] as const;

describe('SHARD-CODE-HASH-EVIDENCE — the shard lane cannot fall out of the release evidence again', () => {
  it('EVID-01: hash_codes.js hashes all three shards, and calls them production', () => {
    const src = readFileSync('scripts/hash_codes.js', 'utf8');
    for (const [key, path] of LANE) {
      expect(src, `${key} must be hashed`).toContain(key);
      expect(src, `${key} must point at the built code`).toContain(path);
      // productionKeys is what CURRENT_PRODUCTION_CODE_HASHES.txt is built from — the file the release chain
      // actually compares against. A hash that exists but is not "production" is evidence nobody checks.
      expect(src.slice(src.indexOf('const productionKeys')), `${key} must be a production key`).toContain(key);
    }
  });

  it('EVID-02: every shard path the script names really is hashable — the wiring, not the artifact', () => {
    // NOT an assertion that artifacts/CURRENT_CODE_HASHES.txt is current. That whole artifact set is
    // DELIBERATELY stale on this branch and rebaselined once at seal, because regenerating it mid-branch reds
    // two pinned suites (m20u-buybackburn-implementation-readiness, publish-reserve-pricing-artifact) over
    // contracts unrelated to the change in hand. Asserting currency here would either force that rebaseline
    // early or sit red for the rest of the branch — and a permanently red test teaches people to ignore red.
    //
    // What CAN be checked now, and is what was actually broken, is the wiring: the script names three real
    // files and each one hashes. A mistyped path would otherwise have thrown at seal, mid-ceremony.
    for (const [key, path] of LANE) {
      expect(existsSync(path), `${key}: ${path} must exist`).toBe(true);
      const hash = Cell.fromBoc(readFileSync(path))[0].hash().toString('hex');
      expect(hash, `${key} must hash to 32 bytes`).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('EVID-03: the hash really does determine the address — so a drift moves every shard in the network', async () => {
    // Stated as an executable fact rather than a claim in a comment, because it is the reason EVID-01 exists.
    // Two shards differing only in code land at different addresses for identical init parameters.
    const conv = contractAddress(0, await RecordShard.init(1n, 20_000n));
    const intro = contractAddress(0, await IntroShard.init(20_000n, 1n));
    const recovery = contractAddress(0, await RecoveryShard.init(1n));
    const addresses = [conv, intro, recovery].map((a) => a.toRawString());
    expect(new Set(addresses).size, 'three different codes, three different addresses').toBe(3);

    // And the address is a function of the code hash SPECIFICALLY: the cell hash_codes.js hashes is exactly the
    // code cell the StateInit carries. Compared against the built .code.boc rather than against the artifact,
    // which is deliberately stale on this branch (see EVID-02).
    const initCode = await RecordShard.init(1n, 20_000n);
    const built = Cell.fromBoc(readFileSync('build/RecordShard/RecordShard_RecordShard.code.boc'))[0];
    expect(initCode.code.hash().toString('hex'), 'the StateInit carries the code the script hashes')
      .toBe(built.hash().toString('hex'));
  });
});
