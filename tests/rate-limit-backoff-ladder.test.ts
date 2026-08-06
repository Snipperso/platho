import { describe, expect, it } from 'vitest';
import { scheduleToncenterHttpRequest } from '../web/ton-rpc-transport.mjs';

// ONE STRAY 429 MUST NOT COST A MINUTE.
//
// The shared pump parks itself on a 429: requests without skipIfRateLimited WAIT for the backoff, and background
// reads that carry the flag are rejected outright for its whole duration. That park used to be a flat 60 SECONDS —
// which is what the owner met on the keyless path as "RPC busy" followed by everything working. The bucket that
// refused us is counted PER SECOND and PER IP, so it clears in about one second, and the burst that spent it may
// not even have been ours: carrier NAT, or a second app instance on the same machine.
//
// The other direction is a real hazard, not a hypothetical: a short FLAT backoff turns a genuine overload into
// hammering, and hammering a rate-limited endpoint earns a ban far longer than the wait it skipped. So the delay
// grows with CONSECUTIVE refusals and resets as soon as a request gets through.
describe('BACKOFF — the 429 park grows instead of starting at a minute', () => {
  const limited = () => ({ status: 429, ok: false, async json() { return {}; }, headers: { get: () => null } });
  const ok = () => ({ status: 200, ok: true, async json() { return { ok: true }; }, headers: { get: () => null } });

  const elapsedFor = async (key: string, responses: Array<() => any>) => {
    const started = Date.now();
    for (const make of responses) {
      await scheduleToncenterHttpRequest(`https://toncenter.example/api/v3/x`, null, async () => make(), {
        rateLimitKey: key, requestSpacingMs: 0, rateLimitRetries: 0,
      });
    }
    return Date.now() - started;
  };

  it('BACKOFF-01: the first refusal parks for seconds, not for a minute', async () => {
    // Two calls: the first is refused and sets the park, the second must WAIT it out before running.
    const elapsed = await elapsedFor('backoff-01', [limited, ok]);
    expect(elapsed, 'the first 429 still parks the queue for the best part of a minute').toBeLessThan(4_000);
    expect(elapsed, 'the park vanished entirely — a 429 must still slow us down').toBeGreaterThanOrEqual(1_500);
  }, 30_000);

  it('BACKOFF-02: consecutive refusals grow the park', async () => {
    const first = await elapsedFor('backoff-02', [limited, limited]);   // 1st refusal parks ~2s, then the 2nd runs
    const second = await elapsedFor('backoff-02', [ok]);                // waits the SECOND refusal's longer park
    expect(second, 'the ladder does not grow — a sustained overload would be hammered').toBeGreaterThan(first);
  }, 40_000);

  it('BACKOFF-03: a request that gets through resets the ladder', async () => {
    await elapsedFor('backoff-03', [limited, limited, ok]);             // climb, then succeed
    const afterReset = await elapsedFor('backoff-03', [limited, ok]);   // a fresh stray 429 starts from step 1 again
    expect(afterReset, 'the streak survived a success — later strays inherit an old overload').toBeLessThan(4_000);
  }, 40_000);
});
