import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import {
  CONV_MIN_VALUE, CONV_PUBLISH_VALUE, INTRO_MIN_VALUE, INTRO_PUBLISH_VALUE,
  RECOVERY_PUBLISH_VALUE, KEYSHARD_REGISTER_VALUE,
  PUBLIC_CHANNEL_PUBLISH_VALUE, PUBLIC_BEACON_PUBLISH_VALUE, PUBLIC_AVATAR_PUBLISH_VALUE,
} from '../web/publish-price.mjs';

// The release evidence for publish pricing must describe THIS build, not a build it was generated against months
// ago. The gate (preprod_guard.validatePublishReservePricingArtifact) checks lane coverage, the fee config and that
// no lane is underfunded — but every one of those reads the artefact's own numbers. Staleness is the gap: an
// artefact generated before a shard's floor moved passes all three while describing prices that no longer exist.
//
// So this re-derives both sides from source, exactly as the generator does, and requires the committed artefact to
// agree. Regenerate with `npm run pricing:report`.
//
// Context worth keeping: the gate used to demand twelve cases keyed by capsule SIZE CLASS with a hold and a net
// price — the Vault batch model, deleted in clean-17. Those tables were read by nothing but the gate itself, so
// satisfying it would have certified prices nobody pays for a contract that does not exist.

const REPORT = 'artifacts/publish_reserve_pricing_report.json';

function constOf(src: string, name: string): bigint {
  const m = src.match(new RegExp(`^const ${name}: Int = ([^;]+);`, 'm'));
  if (!m) throw new Error(`${name} not found`);
  const expr = m[1].trim();
  if (/^\d+$/.test(expr)) return BigInt(expr);
  return expr.split('+').map((t) => t.trim())
    .reduce((sum, t) => sum + (/^\d+$/.test(t) ? BigInt(t) : constOf(src, t)), 0n);
}

describe('publish reserve pricing report describes this build', () => {
  it('PRICE-REPORT-01: every lane in the artefact matches the contracts and the client right now', () => {
    expect(existsSync(REPORT), 'run `npm run pricing:report`').toBe(true);
    const report = JSON.parse(readFileSync(REPORT, 'utf8'));
    expect(report.profile).toBe('PLATHO.V1.PUBLISH_RESERVE_PRICING');
    expect(report.status).toBe('PASS');

    const rec = readFileSync('contracts/RecordShard.tact', 'utf8');
    const intro = readFileSync('contracts/IntroShard.tact', 'utf8');
    const recov = readFileSync('contracts/RecoveryShard.tact', 'utf8');
    const pub = readFileSync('contracts/PublicShard.tact', 'utf8');
    const key = readFileSync('contracts/KeyShard.tact', 'utf8');
    const tail = constOf(pub, 'PS_PUBLISH_GAS') + constOf(pub, 'PS_PROTOCOL_FEE') + constOf(pub, 'PS_FEE_TRANSPORT');

    const expected: Record<string, [bigint, bigint]> = {
      conv_first_publish: [constOf(rec, 'RS_DEPLOY_MIN_VALUE'), CONV_PUBLISH_VALUE],
      conv_steady_publish: [constOf(rec, 'RS_MIN_VALUE'), CONV_PUBLISH_VALUE],
      intro_first_publish: [constOf(intro, 'IS_DEPLOY_MIN_VALUE'), INTRO_PUBLISH_VALUE],
      intro_steady_publish: [constOf(intro, 'IS_MIN_VALUE'), INTRO_PUBLISH_VALUE],
      recovery_write: [constOf(recov, 'RS_MIN_VALUE'), RECOVERY_PUBLISH_VALUE],
      keyshard_register: [constOf(key, 'KS_MIN_REGISTER_VALUE'), KEYSHARD_REGISTER_VALUE],
      public_channel_first: [constOf(pub, 'PS_ENTRY_ENDOWMENT_POST') + constOf(pub, 'PS_BASE_ENDOWMENT_POST') + tail,
        PUBLIC_CHANNEL_PUBLISH_VALUE],
      public_beacon_first: [constOf(pub, 'PS_ENTRY_ENDOWMENT_BEACON') + constOf(pub, 'PS_BASE_ENDOWMENT_BEACON') + tail,
        PUBLIC_BEACON_PUBLISH_VALUE],
      public_avatar_first: [constOf(pub, 'PS_ENTRY_ENDOWMENT_AVATAR') + constOf(pub, 'PS_BASE_ENDOWMENT_AVATAR') + tail,
        PUBLIC_AVATAR_PUBLISH_VALUE],
    };

    const byId = new Map<string, any>((report.cases ?? []).map((c: any) => [c.id, c]));
    const stale: string[] = [];
    for (const [id, [floor, attached]] of Object.entries(expected)) {
      const c = byId.get(id);
      if (!c) { stale.push(`${id}: missing from the artefact`); continue; }
      if (BigInt(c.contract_floor_nanotons) !== floor) {
        stale.push(`${id}: artefact floor ${c.contract_floor_nanotons} vs contract ${floor}`);
      }
      if (BigInt(c.client_attaches_nanotons) !== attached) {
        stale.push(`${id}: artefact attaches ${c.client_attaches_nanotons} vs client ${attached}`);
      }
    }
    expect(stale, `the artefact is stale — run \`npm run pricing:report\`:\n${stale.join('\n')}`).toEqual([]);

    // Also pin that the STEADY floors are genuinely lower than the deploy floors, which is the whole reason the
    // client must always attach the deploy figure (PP-03 measures the refusal that follows from getting this wrong).
    expect(constOf(rec, 'RS_MIN_VALUE')).toBeLessThan(constOf(rec, 'RS_DEPLOY_MIN_VALUE'));
    expect(constOf(intro, 'IS_MIN_VALUE')).toBeLessThan(constOf(intro, 'IS_DEPLOY_MIN_VALUE'));
    expect(CONV_MIN_VALUE).toBeLessThan(CONV_PUBLISH_VALUE);
    expect(INTRO_MIN_VALUE).toBeLessThan(INTRO_PUBLISH_VALUE);
  });

  it('PRICE-REPORT-02: the artefact code hashes are the current build', () => {
    if (!existsSync(REPORT)) return;
    const report = JSON.parse(readFileSync(REPORT, 'utf8'));
    const current = Object.fromEntries(readFileSync('artifacts/CURRENT_CODE_HASHES.txt', 'utf8')
      .split(/\r?\n/).filter((l) => l.includes('=')).map((l) => l.split('=')));
    const pairs: Array<[string, string]> = [
      ['ath_wallet', 'ATH_WALLET_CODE_HASH'],
      ['record_shard', 'RECORD_SHARD_CODE_HASH'],
      ['intro_shard', 'INTRO_SHARD_CODE_HASH'],
      ['public_shard', 'PUBLIC_SHARD_CODE_HASH'],
      ['recovery_shard', 'RECOVERY_SHARD_CODE_HASH'],
      ['key_shard', 'KEY_SHARD_CODE_HASH'],
    ];
    const drifted = pairs.filter(([k, cur]) => report.code_hashes?.[k] !== current[cur]).map(([k]) => k);
    expect(drifted, `pricing report was generated against a different build: ${drifted.join(', ')}`).toEqual([]);
  });
});
