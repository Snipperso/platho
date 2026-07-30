import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { Address } from '@ton/core';
import { FA_BUYBACK, FA_TREASURY } from './helpers/fee-sink-fixture';

// The FEE_SINK baked into RecordShard, IntroShard, PublicShard and AirdropTicket is derived from
// FeeAccumulator.init(ton_treasury_receiver, buyback_burn). One of those two inputs is a fixed role address; the other,
// buyback_burn, is DERIVED from BuybackBurn's code and therefore moves whenever that contract is edited.
//
// This project has already baked the sink from a TEST literal instead of from the ceremony. The airdrop was dead on
// arrival and PT-04b proved a self-consistent fiction, because the test and the constant agreed with each other while
// both disagreed with what the ceremony would deploy. The wave-8 cascade found the same shape again: FA_BUYBACK was a
// stale copy of a derived value, duplicated across seven files.
//
// So the fixture is now the single source, and this ties that source to the CEREMONY rather than to itself. The draft
// lives under artifacts/local/, which is gitignored live scaffolding, so its absence skips rather than fails — a
// missing draft must not be reported as agreement.

const DRAFT = 'artifacts/local/mainnet_final_manifest_draft.json';

describe('fee sink fixture source of truth', () => {
  it('FA-SOURCE-01: the fixture inputs are the ones the ceremony would actually deploy with', () => {
    if (!existsSync(DRAFT)) {
      // eslint-disable-next-line no-console
      console.warn(`[FA-SOURCE-01] ${DRAFT} absent — regenerate it with scripts/mainnet_final_manifest_draft.ts to check this`);
      return;
    }
    const draft = JSON.parse(readFileSync(DRAFT, 'utf8'));
    const addresses = draft.manifest?.addresses ?? draft.addresses ?? {};

    const ceremonyBuyback = addresses.fee_accumulator_buyback_burn;
    const ceremonyTreasury = addresses.fee_accumulator_ton_treasury_receiver;
    expect(ceremonyBuyback, 'the draft must name the FeeAccumulator init inputs').toBeTruthy();
    expect(ceremonyTreasury).toBeTruthy();

    expect(FA_BUYBACK.toRawString(), 'FA_BUYBACK is a copy of a DERIVED address — rebake it from the ceremony draft')
      .toBe(Address.parse(ceremonyBuyback).toRawString());
    expect(FA_TREASURY.toRawString(), 'FA_TREASURY must be the ceremony ton_treasury_receiver')
      .toBe(Address.parse(ceremonyTreasury).toRawString());
  });

  it('FA-SOURCE-02: nothing outside the fixture keeps a private copy of these two addresses', () => {
    // The lesson the fixture's own header records, enforced instead of narrated: a fixture duplicated across suites is
    // a change that has to land in every one of them, and it will not.
    const { globSync } = require('node:fs') as typeof import('node:fs');
    const files = globSync('tests/**/*.test.ts');
    expect(files.length, 'the sweep must actually find tests').toBeGreaterThan(50);

    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const literal of [FA_BUYBACK, FA_TREASURY]) {
        for (const form of [literal.toString(), literal.toString({ bounceable: true, urlSafe: true })]) {
          if (src.includes(form)) offenders.push(`${file}: ${form}`);
        }
      }
    }
    expect(offenders, `import them from tests/helpers/fee-sink-fixture instead:\n${offenders.join('\n')}`).toEqual([]);
  });
});
