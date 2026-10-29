import { describe, expect, it } from 'vitest';
import { scheduleToncenterHttpRequest } from '../web/ton-rpc-transport.mjs';

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
    const elapsed = await elapsedFor('backoff-01', [limited, ok]);
    expect(elapsed, 'the first 429 still parks the queue for the best part of a minute').toBeLessThan(4_000);
    expect(elapsed, 'the park vanished entirely — a 429 must still slow us down').toBeGreaterThanOrEqual(1_500);
  }, 30_000);

  it('BACKOFF-02: consecutive refusals grow the park', async () => {
    const first = await elapsedFor('backoff-02', [limited, limited]);
    const second = await elapsedFor('backoff-02', [ok]);
    expect(second, 'the ladder does not grow — a sustained overload would be hammered').toBeGreaterThan(first);
  }, 40_000);

  it('BACKOFF-03: a request that gets through resets the ladder', async () => {
    await elapsedFor('backoff-03', [limited, limited, ok]);
    const afterReset = await elapsedFor('backoff-03', [limited, ok]);
    expect(afterReset, 'the streak survived a success — later strays inherit an old overload').toBeLessThan(4_000);
  }, 40_000);
});
