import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

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
    expect(APP).toContain('runGetMethod: (call) => transport.runGetMethod(call),');
  });

  it('FRESH-04: the INTRO confirm waits longer than one block-plus-indexing round', () => {
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
