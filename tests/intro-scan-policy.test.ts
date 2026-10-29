import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { planIntroScan, liveBucketsFor, passCostBytes, DEFAULT_POLICY, INTRO_SAFE_CAP, BYTES_PER_RECORD } from '../web/intro-scan-policy.mjs';
import { INTRO_READ_SPACE } from '../web/shard-discovery.mjs';


const MB = 1024 * 1024;

describe('INTRO-SCAN-POLICY — cost in bytes, not in requests', () => {
  it('POLICY-01: at launch scale a minute-fresh scan is a few megabytes a day', () => {
    expect(liveBucketsFor(8000)).toBe(1);
    const plan = planIntroScan({ highestLiveBucket: 0, liveBuckets: 10, readSpace: INTRO_READ_SPACE, msSinceFullSweep: 0 });
    expect(plan.full, 'a hot pass, not the safety sweep').toBe(false);
    expect(plan.buckets.to, 'only the range in use, plus margin').toBeLessThanOrEqual(1 + DEFAULT_POLICY.hotMarginBuckets);
    expect(plan.epochCount, 'a hot pass skips the epochs that can no longer change').toBe(3);
    expect(plan.intervalMs, 'cheap enough to poll at the floor').toBe(DEFAULT_POLICY.minIntervalMs);
    expect(plan.estimatedDailyBytes, 'a few megabytes, not hundreds').toBeLessThan(5 * MB);
  });

  it('POLICY-02: polling the WHOLE space at the same cadence would cost ~100x more — this is why the range is tiered', () => {
    const hot = passCostBytes({ asked: 5, live: 3, epochs: 3 });
    const wide = passCostBytes({ asked: INTRO_READ_SPACE, live: 10, epochs: 10 });
    expect(wide / hot).toBeGreaterThan(50);
    const perDayWide = wide * (86_400_000 / DEFAULT_POLICY.minIntervalMs);
    expect(perDayWide, 'minute-polling the full space at launch is hundreds of megabytes').toBeGreaterThan(500 * MB);
  });

  it('POLICY-03: the interval degrades on its own as the network grows — no manual steps', () => {
    const at = (introsPerDay: number) => {
      const live = liveBucketsFor(introsPerDay);
      return planIntroScan({ distinctLiveBuckets: live, liveBuckets: live * 10, readSpace: INTRO_READ_SPACE, msSinceFullSweep: 0 });
    };
    const small = at(8_000);
    const medium = at(1_000_000);
    const huge = at(8_200_000);

    expect(small.intervalMs).toBe(DEFAULT_POLICY.minIntervalMs);
    expect(medium.intervalMs, 'a million a day costs more, so it slows down').toBeGreaterThan(small.intervalMs);
    expect(huge.intervalMs, 'at the ceiling it slows further still').toBeGreaterThan(medium.intervalMs);
    expect(huge.intervalMs).toBeLessThanOrEqual(DEFAULT_POLICY.maxIntervalMs);

    for (const plan of [small, medium]) {
      expect(plan.estimatedDailyBytes, `budget respected (interval ${plan.intervalMs}ms)`)
        .toBeLessThanOrEqual(DEFAULT_POLICY.budgetBytesPerDay + 1 * MB);
    }
    expect(huge.intervalMs, 'at the ceiling there is no slower poll to reach for').toBe(DEFAULT_POLICY.maxIntervalMs);
    expect(huge.estimatedDailyBytes, 'and the overrun is REPORTED rather than hidden')
      .toBeGreaterThan(DEFAULT_POLICY.budgetBytesPerDay);
  });

  it('POLICY-08: the records the scan downloads are IN the model, and they are what binds', () => {
    expect(BYTES_PER_RECORD).toBe(47);
    const withRecords = passCostBytes({ asked: 10, live: 5, epochs: 3, records: 1_000 });
    const without = passCostBytes({ asked: 10, live: 5, epochs: 3 });
    expect(withRecords - without).toBe(1_000 * BYTES_PER_RECORD);

    const live = liveBucketsFor(1_000_000);
    const blind = planIntroScan({ distinctLiveBuckets: live, liveBuckets: live * 10, readSpace: INTRO_READ_SPACE, msSinceFullSweep: 0 });
    const honest = planIntroScan({
      distinctLiveBuckets: live, liveBuckets: live * 10, readSpace: INTRO_READ_SPACE, msSinceFullSweep: 0,
      recordsPerDay: 1_000_000,
    });
    expect(honest.records.bytesPerDay).toBe(1_000_000 * BYTES_PER_RECORD);
    expect(honest.records.overBudget).toBe(true);
    expect(honest.estimatedDailyBytes).toBeGreaterThan(blind.estimatedDailyBytes);
    expect(honest.intervalMs, 'nothing is left for the pollable part').toBe(DEFAULT_POLICY.maxIntervalMs);
    const today = planIntroScan({
      distinctLiveBuckets: 1, liveBuckets: 10, readSpace: INTRO_READ_SPACE, msSinceFullSweep: 0, recordsPerDay: 8_000,
    });
    expect(today.records.overBudget).toBe(false);
    expect(today.intervalMs).toBe(DEFAULT_POLICY.minIntervalMs);
  });

  it('POLICY-04: the safety sweep covers the whole space, and only when it is due', () => {
    const early = planIntroScan({ highestLiveBucket: 0, liveBuckets: 1, readSpace: INTRO_READ_SPACE, msSinceFullSweep: 60_000 });
    expect(early.full).toBe(false);
    expect(early.buckets.to).toBeLessThan(INTRO_READ_SPACE);

    const due = planIntroScan({ highestLiveBucket: 0, liveBuckets: 1, readSpace: INTRO_READ_SPACE, msSinceFullSweep: DEFAULT_POLICY.fullSweepEveryMs });
    expect(due.full, 'the sweep that notices a write above the hot range').toBe(true);
    expect(due.buckets.to).toBe(INTRO_READ_SPACE);
  });

  it('POLICY-05: a cold client with no history still looks at something', () => {
    const plan = planIntroScan({ highestLiveBucket: -1, liveBuckets: 0, readSpace: INTRO_READ_SPACE, msSinceFullSweep: 0 });
    expect(plan.buckets.to).toBeGreaterThanOrEqual(1);
    expect(plan.intervalMs).toBe(DEFAULT_POLICY.minIntervalMs);
  });

  it('POLICY-06: the budget is honoured even when the caller asks for an absurd one', () => {
    const stingy = planIntroScan({ highestLiveBucket: 1023, liveBuckets: 10240, readSpace: INTRO_READ_SPACE, msSinceFullSweep: 0, policy: { budgetBytesPerDay: 1024 } });
    expect(stingy.intervalMs, 'clamped at the slow end rather than never polling').toBe(DEFAULT_POLICY.maxIntervalMs);

    const lavish = planIntroScan({ highestLiveBucket: 0, liveBuckets: 10, readSpace: INTRO_READ_SPACE, msSinceFullSweep: 0, policy: { budgetBytesPerDay: 10_000 * MB } });
    expect(lavish.intervalMs, 'clamped at the fast end — battery is a cost the byte budget cannot see').toBe(DEFAULT_POLICY.minIntervalMs);
  });

  it('POLICY-07: SAFE_CAP here matches the contract that enforces it', () => {
    const src = readFileSync('contracts/IntroShard.tact', 'utf8');
    const m = src.match(/^const IS_SAFE_CAP: Int = (\d+);/m);
    expect(m, 'IS_SAFE_CAP must exist in the contract').not.toBeNull();
    expect(Number(m![1]), 'the policy sizes live buckets from this number, so it may not drift').toBe(INTRO_SAFE_CAP);
  });
});
