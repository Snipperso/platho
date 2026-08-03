import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { scheduleToncenterHttpRequest } from '../web/ton-rpc-transport.mjs';

// A BROADCAST MUST NOT DIE ON ONE 500.
//
// MEASURED 2026-08-04, straight from the owner's console while sending a burst:
//   POST https://toncenter.com/api/v3/message 500 (Internal Server Error)   ×8
//   [platho] wallet external broadcast failed
// The send queue had already fixed the pile-up ("гораздо лучше стало"), but a couple of messages still hung — and
// this is why: scheduleToncenterHttpRequest retried ONLY on 429 (`if (response?.status !== 429) return response;`),
// so a 500 came straight back after a single POST. The message then fell into the app-level retry ladder with its
// multi-second backoff, which is exactly what "зависло" looks like from the outside.
//
// Re-POSTing is safe, and that is the only reason a retry is allowed here: the external is already SIGNED and bound
// to one wallet seqno, so the chain runs it AT MOST ONCE however many copies arrive.
//
// There is no second provider to fall back to, for a TECHNICAL reason and not a preference: the old Orbs (ton-access)
// path is stuck on toncenter API v2 and lags the 2026-04 sub-second TON upgrade, so it cannot confirm a just-sent
// message — bringing it back would add latency, not resilience. Retrying the one modern provider is the available
// answer. A different, v3-capable provider would be a legitimate second lane; Orbs specifically is not.
const TRANSPORT = readFileSync('web/ton-rpc-transport.mjs', 'utf8');

const ENDPOINT = 'https://example.invalid/api/v3/message';
const ok = () => ({ status: 200, ok: true, async json() { return { ok: true }; } });
const boom = (status: number) => ({ status, ok: false, async json() { return { ok: false }; } });

describe('SENDRETRY — a 5xx on broadcast is retried, a 5xx on a read is not', () => {
  it('SENDRETRY-01: three 500s then a 200 — the broadcast still lands', async () => {
    let calls = 0;
    const response: any = await scheduleToncenterHttpRequest(ENDPOINT, null, async () => {
      calls += 1;
      return calls <= 3 ? boom(500) : ok();
    }, { serverErrorRetries: 3, serverErrorBackoffMs: 1, requestSpacingMs: 0, rateLimitKey: 'sendretry-01' });
    expect(calls).toBe(4);
    expect(response.status).toBe(200);
  });

  it('SENDRETRY-02: the retry budget is BOUNDED — a permanently broken endpoint is not hammered', async () => {
    // Counter-case. An unbounded retry against a 500-ing endpoint is a worse failure than the one being fixed: it
    // would spin forever inside a queued send and block every message behind it in the lane.
    let calls = 0;
    const response: any = await scheduleToncenterHttpRequest(ENDPOINT, null, async () => {
      calls += 1;
      return boom(500);
    }, { serverErrorRetries: 3, serverErrorBackoffMs: 1, requestSpacingMs: 0, rateLimitKey: 'sendretry-02' });
    expect(calls, 'one first try plus exactly three retries').toBe(4);
    expect(response.status).toBe(500);
  });

  it('SENDRETRY-03: READS keep the old behaviour — no retry unless asked', async () => {
    // The default is 0. A failed read is cheap to repeat on the next tick; retrying every read on 5xx would multiply
    // load on the shared pump exactly when the provider is already struggling.
    let calls = 0;
    const response: any = await scheduleToncenterHttpRequest(ENDPOINT, null, async () => {
      calls += 1;
      return boom(503);
    }, { requestSpacingMs: 0, rateLimitKey: 'sendretry-03' });
    expect(calls).toBe(1);
    expect(response.status).toBe(503);
  });

  it('SENDRETRY-04: a 429 is still handled by its OWN budget, unchanged', async () => {
    // The rewrite replaced a for-loop with a while-loop; the rate-limit path must not have picked up the 5xx budget.
    let calls = 0;
    const response: any = await scheduleToncenterHttpRequest(ENDPOINT, null, async () => {
      calls += 1;
      return calls === 1 ? boom(429) : ok();
    }, { rateLimitRetries: 1, rateLimitBackoffMs: 1, requestSpacingMs: 0, rateLimitKey: 'sendretry-04' });
    expect(calls).toBe(2);
    expect(response.status).toBe(200);
  });

  it('SENDRETRY-05: only sendBoc opts in, and the idempotency reason is written down', () => {
    // If a future read path copies `serverErrorRetries` in, the reasoning above stops applying — the safety argument
    // is specific to a SIGNED, seqno-bound external.
    expect(TRANSPORT).toContain('const TONCENTER_SEND_BOC_SERVER_ERROR_RETRIES = 3;');
    expect(TRANSPORT).toContain('options.sendBocServerErrorRetries, TONCENTER_SEND_BOC_SERVER_ERROR_RETRIES,');
    expect((TRANSPORT.match(/serverErrorRetries:/g) ?? []).length, 'a second opt-in appeared').toBe(1);
    expect(TRANSPORT).toMatch(/signed and bound to one wallet seqno, so the chain runs it AT MOST ONCE/);
  });
});
