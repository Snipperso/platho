import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRecordShardLastSeqReader } from '../web/conv-lane-read.mjs';

describe('COLDFLOOR — an unread shard is not an empty shard', () => {
  const absent = (exitCode: number) => {
    const error: any = new Error(`TON RPC get-method exit code ${exitCode}`);
    error.exitCode = exitCode;
    return error;
  };

  it('COLDFLOOR-01: a shard with NO CODE answers 0, whether the transport throws or returns the code', async () => {
    for (const exitCode of [-13, -256]) {
      const thrown = createRecordShardLastSeqReader(async () => { throw absent(exitCode); });
      await expect(thrown(`0:${'11'.repeat(32)}`)).resolves.toBe(0);

      const returned = createRecordShardLastSeqReader(async () => ({ exit_code: exitCode, stack: [] }));
      await expect(returned(`0:${'11'.repeat(32)}`)).resolves.toBe(0);
    }
  });

  it('COLDFLOOR-02: a FAILED read throws instead of pretending the shard is empty', async () => {
    for (const error of [
      Object.assign(new Error('HTTP 429'), { status: 429 }),
      new Error('network timeout'),
      Object.assign(new Error('exit code 4'), { exitCode: 4 }),
    ]) {
      const reader = createRecordShardLastSeqReader(async () => { throw error; });
      await expect(reader(`0:${'22'.repeat(32)}`)).rejects.toThrow();
    }
  });

  it('COLDFLOOR-03: the send no longer swallows the failure into a 0 floor', () => {
    const app = readFileSync('web/app.js', 'utf8');
    expect(app, 'the swallowing catch came back').not.toContain("cold-floor read failed, using 0");
    expect(app).toMatch(/coldFloor = await createRecordShardLastSeqReader\(\(call\) => transport\.runGetMethod\(\{ \.\.\.call, cacheTtlMs: 0, priority: 'critical', skipIfRateLimited: false \}\)\)\(route\.address\);/);
  });
});
