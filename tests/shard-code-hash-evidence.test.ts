import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { Cell, contractAddress } from '@ton/core';
import { RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import { IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { RecoveryShard } from '../build/RecoveryShard/RecoveryShard_RecoveryShard';


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
      expect(src.slice(src.indexOf('const productionKeys')), `${key} must be a production key`).toContain(key);
    }
  });

  it('EVID-02: every path the script names really is hashable — the wiring', () => {
    for (const [key, path] of LANE) {
      expect(existsSync(path), `${key}: ${path} must exist`).toBe(true);
      const hash = Cell.fromBoc(readFileSync(path))[0].hash().toString('hex');
      expect(hash, `${key} must hash to 32 bytes`).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('EVID-04: no production contract can quietly drop out of the evidence', () => {
    for (const name of CONTRACT_SOURCES) {
      expect(existsSync(`contracts/${name}.tact`), `${name}.tact must exist`).toBe(true);
      const covered = LANE.some(([, path]) => path.startsWith(`build/${name}/`));
      expect(covered, `contracts/${name}.tact has no code-hash evidence entry`).toBe(true);
    }
    expect(LANE.length, 'sixteen production contracts, sixteen evidence rows').toBe(CONTRACT_SOURCES.length);
  });

  it('EVID-05: the committed code-hash evidence matches what the current build actually hashes to', () => {
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
    const conv = contractAddress(0, await RecordShard.init(1n, 20_000n));
    const intro = contractAddress(0, await IntroShard.init(20_000n, 1n));
    const recovery = contractAddress(0, await RecoveryShard.init(1n));
    const addresses = [conv, intro, recovery].map((a) => a.toRawString());
    expect(new Set(addresses).size, 'three different codes, three different addresses').toBe(3);

    const initCode = await RecordShard.init(1n, 20_000n);
    const built = Cell.fromBoc(readFileSync('build/RecordShard/RecordShard_RecordShard.code.boc'))[0];
    expect(initCode.code.hash().toString('hex'), 'the StateInit carries the code the script hashes')
      .toBe(built.hash().toString('hex'));
  });
});
