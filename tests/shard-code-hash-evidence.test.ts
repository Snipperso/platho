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

// EXTENDED 2026-07-28 from the three-shard lane to ALL SIXTEEN production contracts. The original guard was written
// after the shard lane fell out of the evidence entirely; the same hole was open for thirteen other contracts, every
// one of them immutable. hash_codes.js already hashed all sixteen — nothing asserted that it kept doing so, and a
// contract dropping out of the evidence is invisible precisely because nothing then reports it.
const LANE = [
  ['ATH_WALLET_CODE_HASH', 'build/ATHWallet/ATHWallet_ATHWallet.code.boc'],
  ['ATHMASTER_CODE_HASH', 'build/ATHMaster/ATHMaster_ATHMaster.code.boc'],
  ['ATHVESTING_CODE_HASH', 'build/ATHVesting/ATHVesting_ATHVesting.code.boc'],
  ['BUYBACKBURN_CODE_HASH', 'build/BuybackBurn/BuybackBurn_BuybackBurn.code.boc'],
  ['MARKET_STABILITY_SELLER_CODE_HASH', 'build/MarketStabilitySeller/MarketStabilitySeller_MarketStabilitySeller.code.boc'],
  ['FEEACCUMULATOR_CODE_HASH', 'build/FeeAccumulator/FeeAccumulator_FeeAccumulator.code.boc'],
  ['USERNAME_NFT_ITEM_CODE_HASH', 'build/UsernameNFTItem/UsernameNFTItem_UsernameNFTItem.code.boc'],
  ['USERNAME_REGISTRY_CODE_HASH', 'build/UsernameRegistry/UsernameRegistry_UsernameRegistry.code.boc'],
  ['PROFILE_REGISTRY_CODE_HASH', 'build/ProfileRegistry/ProfileRegistry_ProfileRegistry.code.boc'],
  ['KEY_SHARD_CODE_HASH', 'build/KeyShard/KeyShard_KeyShard.code.boc'],
  ['AIRDROP_TICKET_CODE_HASH', 'build/AirdropTicket/AirdropTicket_AirdropTicket.code.boc'],
  ['AIRDROP_POOL_CODE_HASH', 'build/AirdropPool/AirdropPool_AirdropPool.code.boc'],
  ['RECORD_SHARD_CODE_HASH', 'build/RecordShard/RecordShard_RecordShard.code.boc'],
  ['INTRO_SHARD_CODE_HASH', 'build/IntroShard/IntroShard_IntroShard.code.boc'],
  ['PUBLIC_SHARD_CODE_HASH', 'build/PublicShard/PublicShard_PublicShard.code.boc'],
  ['RECOVERY_SHARD_CODE_HASH', 'build/RecoveryShard/RecoveryShard_RecoveryShard.code.boc'],
] as const;

const CONTRACT_SOURCES = [
  'ATHMaster', 'ATHVesting', 'ATHWallet', 'AirdropPool', 'AirdropTicket', 'BuybackBurn', 'FeeAccumulator',
  'IntroShard', 'KeyShard', 'MarketStabilitySeller', 'ProfileRegistry', 'PublicShard', 'RecordShard',
  'RecoveryShard', 'UsernameNFTItem', 'UsernameRegistry',
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

  it('EVID-02: every path the script names really is hashable — the wiring', () => {
    // A mistyped path would otherwise throw at seal, mid-ceremony.
    for (const [key, path] of LANE) {
      expect(existsSync(path), `${key}: ${path} must exist`).toBe(true);
      const hash = Cell.fromBoc(readFileSync(path))[0].hash().toString('hex');
      expect(hash, `${key} must hash to 32 bytes`).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('EVID-04: no production contract can quietly drop out of the evidence', () => {
    // The original failure was a whole lane missing from the evidence, unnoticed. Tie the list to the contracts
    // that actually exist, so ADDING a contract without adding its hash fails here rather than at the ceremony.
    for (const name of CONTRACT_SOURCES) {
      expect(existsSync(`contracts/${name}.tact`), `${name}.tact must exist`).toBe(true);
      const covered = LANE.some(([, path]) => path.startsWith(`build/${name}/`));
      expect(covered, `contracts/${name}.tact has no code-hash evidence entry`).toBe(true);
    }
    expect(LANE.length, 'sixteen production contracts, sixteen evidence rows').toBe(CONTRACT_SOURCES.length);
  });

  it('EVID-05: the committed code-hash evidence matches what the current build actually hashes to', () => {
    // DEFERRED UNTIL NOW, ON PURPOSE. This assertion used to be impossible: the artifact set was deliberately
    // stale for the whole clean-16 -> clean-17 transition, and a permanently red test teaches people to ignore
    // red. The seal rebaseline (2026-07-28) made the artifact current, so the check is finally meaningful — and
    // it closes the exact hole recorded during that work: CURRENT_CODE_HASHES.txt is itself a derived file, and
    // while it lags, everything pinned AGAINST it is green and false at the same time
    // (threat-checklist(old hash) == artifact(old hash) -> PASS, with build/ long since moved on).
    //
    // Deliberately compares the artifact to build/ — never to another artifact.
    const artifact = readFileSync('artifacts/CURRENT_CODE_HASHES.txt', 'utf8');
    const recorded = new Map(
      artifact.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
        .map((line) => line.split('=') as [string, string]),
    );

    const drifted: string[] = [];
    for (const [key, path] of LANE) {
      const actual = Cell.fromBoc(readFileSync(path))[0].hash().toString('hex');
      const claimed = recorded.get(key);
      if (claimed !== actual) drifted.push(`${key}: evidence ${claimed ?? '(absent)'} vs build ${actual}`);
    }
    expect(drifted, `code-hash evidence is stale — regenerate with \`node scripts/hash_codes.js\`:\n${drifted.join('\n')}`).toEqual([]);
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
