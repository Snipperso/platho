import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// A confirm asks "has the write I just made landed?". Answering it from a cache filled BEFORE the write is not a
// stale answer — it is an answer to a different question, and it is always "no".
//
// MEASURED 2026-08-02, owner's first sends on clean-17: the INTRO confirm looped 6 times over ~14s against a transport
// whose default runGetMethodCacheTtlMs is 15_000. Every retry after the first was served from the cache of the first —
// which fired in the instant right after broadcast, when the entry could not yet exist. One real request, five
// arguments with itself, then "INTRO published, but its on-chain time is not yet visible — resend". All three of the
// owner's sends were on chain the whole time (epoch 20667, bucket 0, entries 0/1/2) and no amount of resending could
// have helped: the read was answering from before the write on every attempt.
//
// Source-level pins, deliberately. A behavioural test would need the whole transport, and the property that broke is
// structural: WHICH options the call carries. That is exactly what a source pin can hold.
const APP = readFileSync('web/app.js', 'utf8');

describe('CONFIRM-FRESH — a landed-check may never read its own cache', () => {
  it('FRESH-01: the INTRO confirm reader bypasses the read cache', () => {
    expect(APP).toContain(
      'const readEntry = createEntryReader((call) => transport.runGetMethod({ ...call, cacheTtlMs: 0, priority: \'critical\' }));',
    );
  });

  it('FRESH-02: the CONV delivery confirm readers bypass the read cache', () => {
    expect(APP).toContain(
      'const readView = createRecordShardViewReader((call) => transport.runGetMethod({ ...call, cacheTtlMs: 0, priority: \'critical\' }));',
    );
    expect(APP).toContain(
      'const readRecord = createRecordShardRecordReader((call) => transport.runGetMethod({ ...call, cacheTtlMs: 0, priority: \'critical\' }));',
    );
  });

  it('FRESH-03: the polling READ lanes still use the cache — this is not "every read must be fresh"', () => {
    // The counter-case. The intro scanner and the public feed reader poll the same addresses on a loop and SHOULD
    // coalesce; making them fresh would multiply request load for nothing. Without this assertion the rule above
    // degenerates into "disable the cache", which is a different and worse change.
    expect(APP).toContain('runGetMethod: (call) => transport.runGetMethod(call),');
  });

  it('FRESH-04: the INTRO confirm waits longer than one block-plus-indexing round', () => {
    // The second half of the same defect: even with fresh reads, a window that expires before the endpoint can show
    // the write turns a successful send into a red error and charges the user again on the resend. Pinned as a
    // computed total so a future edit to either the count or the backoff has to face the number.
    const loop = APP.match(/for \(let attempt = 0; attempt < (\d+) && createdAtSec === null; attempt \+= 1\) \{\s*if \(attempt > 0\) await delay\(Math\.min\((\d+) \* attempt, (\d+)\)\);/);
    expect(loop, 'the INTRO confirm retry loop moved — re-pin it').toBeTruthy();
    const [, attemptsRaw, stepRaw, capRaw] = loop!;
    let totalMs = 0;
    for (let attempt = 1; attempt < Number(attemptsRaw); attempt += 1) {
      totalMs += Math.min(Number(stepRaw) * attempt, Number(capRaw));
    }
    expect(totalMs).toBeGreaterThanOrEqual(60_000);
  });
});
