import { describe, expect, it } from 'vitest';
import { planIntroScan, DEFAULT_POLICY, passCostBytes, WINDOW_EPOCHS, HOT_EPOCHS } from '../web/intro-scan-policy.mjs';
import { INTRO_READ_SPACE } from '../web/shard-discovery.mjs';


const plan = (over: Record<string, unknown> = {}) =>
  planIntroScan({ readSpace: INTRO_READ_SPACE, currentEpoch: 20_000, msSinceFullSweep: 0, ...over });

describe('INTRO-SCAN-HOT-RANGE — one cheap message must not widen everyone else\'s scan', () => {
  it('HOT-01: a single intro in the top bucket costs ONE extra address, not the whole read space', () => {
    const honest = plan({ distinctLiveBuckets: 1, liveBucketIndices: [0] });
    const griefed = plan({ distinctLiveBuckets: 2, liveBucketIndices: [0, 1023] });

    expect(honest.buckets.to, 'honest traffic sits in a handful of buckets').toBeLessThanOrEqual(8);
    expect(griefed.buckets.to, 'the outlier must NOT drag the prefix outward').toBeLessThanOrEqual(8);
    expect(griefed.extraBuckets, 'it is covered by name instead').toEqual([1023]);

    const asked = (p: any) => p.buckets.to + p.extraBuckets.length;
    expect(asked(griefed) - asked(honest), 'the grief buys two addresses').toBe(2);
    expect(asked(griefed), 'and not the full read space').toBeLessThan(INTRO_READ_SPACE / 100);
    const oldSizing = 1023 + 1 + DEFAULT_POLICY.hotMarginBuckets;
    expect(Math.min(oldSizing, INTRO_READ_SPACE) - asked(griefed), 'which is what the fix is worth')
      .toBeGreaterThan(1000);
  });

  it('HOT-02: an intro OUTSIDE the dense prefix is still scanned every pass, not once every six hours', () => {
    const p = plan({ distinctLiveBuckets: 1, liveBucketIndices: [0, 500] });
    expect(p.buckets.to, 'the prefix stays small').toBeLessThanOrEqual(8);
    expect(p.extraBuckets, 'and the far bucket is named, so a hot pass covers it').toContain(500);
  });

  it('HOT-03: a full sweep still covers everything — the net is intact', () => {
    const p = plan({ distinctLiveBuckets: 1, liveBucketIndices: [0], msSinceFullSweep: Infinity });
    expect(p.full).toBe(true);
    expect(p.buckets, 'a sweep is the whole space').toEqual({ from: 0, to: INTRO_READ_SPACE });
    expect(p.extraBuckets, 'nothing to add — the range already covers it').toEqual([]);
    expect(p.epochCount, 'and the whole retention window').toBe(WINDOW_EPOCHS);
  });

  it('HOT-04: a new install polls again in a MINUTE, not in half an hour', () => {
    const first = plan({ msSinceFullSweep: Infinity });
    expect(first.full, 'a new install sweeps first').toBe(true);
    expect(first.intervalMs, 'and then polls a minute later, not 26 minutes')
      .toBe(DEFAULT_POLICY.minIntervalMs);
  });

  it('HOT-05: the safety net costs 2.2 MiB/day, not 26.7 — and the arithmetic is asserted, not assumed', () => {
    const fullCost = passCostBytes({ asked: INTRO_READ_SPACE, live: 0, epochs: WINDOW_EPOCHS });
    expect(fullCost, 'a full sweep is 10 x 1024 x 57 B').toBe(583_680);

    const perDay = (everyMs: number) => (86_400_000 / everyMs) * fullCost;
    expect(perDay(30 * 60_000) / (1024 * 1024), 'the old 30-minute cadence ate the budget').toBeGreaterThan(26);
    expect(perDay(DEFAULT_POLICY.fullSweepEveryMs) / (1024 * 1024), 'the new one is affordable').toBeLessThan(2.5);
    expect(perDay(DEFAULT_POLICY.fullSweepEveryMs), 'and leaves the great majority of the budget for polling')
      .toBeLessThan(DEFAULT_POLICY.budgetBytesPerDay / 10);
  });

  it('HOT-06: the interval still degrades as the network grows — the budget is real, not decorative', () => {
    const small = plan({ distinctLiveBuckets: 1, liveBuckets: 3, liveBucketIndices: [0] });
    const huge = plan({
      distinctLiveBuckets: INTRO_READ_SPACE,
      liveBuckets: INTRO_READ_SPACE * WINDOW_EPOCHS,
      liveBucketIndices: [],
    });
    expect(small.intervalMs, 'launch volume is minute-fresh').toBe(DEFAULT_POLICY.minIntervalMs);
    expect(huge.intervalMs, 'a saturated network polls less often').toBeGreaterThan(small.intervalMs);
    expect(huge.intervalMs, 'but never stops').toBeLessThanOrEqual(DEFAULT_POLICY.maxIntervalMs);
    expect(huge.epochCount, 'a hot pass still only covers the epochs that can change').toBe(HOT_EPOCHS);
  });

  it('HOT-07: the prefix never exceeds the read space, however the inputs are poisoned', () => {
    for (const distinct of [INTRO_READ_SPACE, INTRO_READ_SPACE * 10, Number.MAX_SAFE_INTEGER]) {
      const p = plan({ distinctLiveBuckets: distinct, liveBucketIndices: [] });
      expect(p.buckets.to, `distinct=${distinct} must clamp`).toBeLessThanOrEqual(INTRO_READ_SPACE);
      expect(p.buckets.from).toBe(0);
    }
    const p = plan({ distinctLiveBuckets: 1, liveBucketIndices: [0, INTRO_READ_SPACE, INTRO_READ_SPACE + 7] });
    expect(p.extraBuckets, 'nothing above the read space is ever asked for').toEqual([]);
  });
});
