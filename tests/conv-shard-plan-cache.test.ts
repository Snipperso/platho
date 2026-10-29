import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { createRecordShardPlanner } from '../web/conv-discovery.mjs';
import { convForwardEpochs, outgoingBucketKeys, CONV_FORWARD_EPOCH_GRACE_SEC } from '../web/crypto/conv-routing.mjs';


if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

const app = readFileSync('web/app.js', 'utf8');
const bytes = (seed: number) => Uint8Array.from({ length: 32 }, (_, i) => (seed * 31 + i * 7) & 0xff);
const CONV = { kRoot: bytes(1), selfKeyId: bytes(2), peerKeyId: bytes(3), epochNow: 20690, windowW: 2 };

describe('CONVPLAN — the shard plan is derived once per (keys, epoch, window)', () => {
  it('CONVPLAN-01: a repeated pass derives nothing and returns the same addresses', async () => {
    const planner = createRecordShardPlanner();
    const first = await planner.incoming(CONV);
    const second = await planner.incoming(CONV);
    expect(planner.stats).toMatchObject({ misses: 1, hits: 1 });
    expect(second.map((s: any) => s.address)).toEqual(first.map((s: any) => s.address));
    const out = await planner.outgoing(CONV);
    expect(first.length + out.length).toBe(6);
  });

  it('CONVPLAN-02: the two directions are separate answers, not one cached twice', async () => {
    const planner = createRecordShardPlanner();
    const incoming = await planner.incoming(CONV);
    const outgoing = await planner.outgoing(CONV);
    expect(planner.stats).toMatchObject({ misses: 2, hits: 0 });
    expect(new Set(outgoing.map((s: any) => s.address))).not.toEqual(new Set(incoming.map((s: any) => s.address)));
  });

  it('CONVPLAN-03: every input that changes the answer re-derives it', async () => {
    const planner = createRecordShardPlanner();
    await planner.incoming(CONV);
    const variants = [
      { ...CONV, epochNow: CONV.epochNow + 1 },
      { ...CONV, windowW: CONV.windowW + 1 },
      { ...CONV, kRoot: bytes(9) },
      { ...CONV, peerKeyId: bytes(9) },
      { ...CONV, selfKeyId: bytes(9) },
    ];
    for (const variant of variants) await planner.incoming(variant);
    expect(planner.stats.hits, 'none of these may be served from the cache').toBe(0);
    expect(planner.stats.misses).toBe(1 + variants.length);
  });

  it('CONVPLAN-04: it is bounded, and the eviction is least-recently-used', async () => {
    const planner = createRecordShardPlanner({ limit: 2 });
    await planner.incoming({ ...CONV, peerKeyId: bytes(11) });
    await planner.incoming({ ...CONV, peerKeyId: bytes(12) });
    await planner.incoming({ ...CONV, peerKeyId: bytes(11) });
    await planner.incoming({ ...CONV, peerKeyId: bytes(13) });
    expect(planner.size).toBe(2);
    expect(planner.stats.evictions).toBe(1);
    const before = planner.stats.hits;
    await planner.incoming({ ...CONV, peerKeyId: bytes(11) });
    expect(planner.stats.hits, 'the recently used entry survived').toBe(before + 1);
  });

  it('CONVPLAN-05: the app clears it on a wallet switch', () => {
    const teardown = app.slice(app.indexOf('function clearWalletScopedRuntimeState('), app.indexOf('\n}\n', app.indexOf('function clearWalletScopedRuntimeState(')));
    expect(teardown).toContain('convShardPlanner.clear();');
    expect(app).toContain('await convShardPlanner.incoming({ kRoot, selfKeyId, peerKeyId, epochNow, windowW, forwardEpochs })');
    expect(app).toContain('await convShardPlanner.outgoing({ kRoot, selfKeyId, peerKeyId, epochNow, windowW })');
    expect(app).not.toMatch(/await incomingRecordShards\(/);
    expect(app).not.toMatch(/await outgoingRecordShards\(/);
  });

  it('CONVPLAN-06: the forward edge is in the cache key, so a plan is never reused across it', async () => {
    const planner = createRecordShardPlanner({ limit: 64 });
    const base = { ...CONV };
    const withoutForward = await planner.incoming({ ...base, forwardEpochs: 0 });
    const misses = planner.stats.misses;
    const withForward = await planner.incoming({ ...base, forwardEpochs: 1 });
    expect(planner.stats.misses, 'the forward plan is DERIVED, not served from the cache').toBe(misses + 1);
    expect(withForward.length, 'and it is one epoch longer').toBe(withoutForward.length + 1);
    expect(withForward.map((x: any) => x.epoch).slice(0, withoutForward.length),
      'the epochs it already had are unchanged').toEqual(withoutForward.map((x: any) => x.epoch));
    expect(Math.max(...withForward.map((x: any) => Number(x.epoch))),
      'the new one is exactly tomorrow').toBe(Number(base.epochNow) + 1);

    const hits = planner.stats.hits;
    await planner.incoming({ ...base, forwardEpochs: 0 });
    await planner.incoming({ ...base, forwardEpochs: 1 });
    expect(planner.stats.hits, 'both are held separately').toBe(hits + 2);
  });

  it('CONVPLAN-07: the clock opens the forward edge only in the last hour, and the outgoing side never', async () => {
    const DAY = 86400;
    expect(convForwardEpochs(DAY * 100), 'midnight').toBe(0);
    expect(convForwardEpochs(DAY * 100 + 43_200), 'noon').toBe(0);
    expect(convForwardEpochs(DAY * 100 + DAY - CONV_FORWARD_EPOCH_GRACE_SEC - 1), 'one second before the grace').toBe(0);
    expect(convForwardEpochs(DAY * 100 + DAY - CONV_FORWARD_EPOCH_GRACE_SEC), 'the first second of it').toBe(1);
    expect(convForwardEpochs(DAY * 100 + DAY - 1), 'the last second of the day').toBe(1);
    expect(convForwardEpochs(Number.NaN), 'an unusable clock must not widen the window').toBe(0);

    expect(CONV_FORWARD_EPOCH_GRACE_SEC / DAY).toBeCloseTo(1 / 24, 6);

    const out0 = await outgoingBucketKeys({ ...CONV, forwardEpochs: 1 } as any);
    const out1 = await outgoingBucketKeys({ ...CONV } as any);
    expect(out0.map((x: any) => x.epoch), 'outgoing ignores a forward edge entirely')
      .toEqual(out1.map((x: any) => x.epoch));
    expect(Math.max(...out0.map((x: any) => Number(x.epoch)))).toBe(Number(CONV.epochNow));
  });
});
