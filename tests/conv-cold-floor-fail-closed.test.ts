import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRecordShardLastSeqReader } from '../web/conv-lane-read.mjs';

// THE COLD-START SEQ FLOOR MUST FAIL CLOSED.
//
// Before the first send into a (conversation, epoch) the client asks the RecordShard for its on-chain last_seq, so
// the outgoing seq starts ABOVE what is already committed. The shard's anti-rollback gate (13653) rejects a publish
// at or below last_seq, so an answer that is too low does not error — the message simply never lands.
//
// Two distinct situations produce "no number":
//   * the shard has NO CODE (exit -13 in production, -256 in the sandbox) — proof that nothing was ever published,
//     so 0 is the correct floor;
//   * the read FAILED (429 on the keyless path, timeout, endpoint outage) — proof of nothing at all.
// The caller used to answer 0 for BOTH: `catch { console.warn('...using 0') }`. On a conversation that already had
// records, that silently restarted the seq at 0 and the shard threw the publish away. The owner saw the warning in
// the console on 2026-08-06 and asked what it was; the -13 case behind it is benign, the swallow was not.
describe('COLDFLOOR — an unread shard is not an empty shard', () => {
  const absent = (exitCode: number) => {
    const error: any = new Error(`TON RPC get-method exit code ${exitCode}`);
    error.exitCode = exitCode;
    return error;
  };

  it('COLDFLOOR-01: a shard with NO CODE answers 0, whether the transport throws or returns the code', async () => {
    // Production throws; the sandbox transport returns the code. Both mean "never deployed".
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
      Object.assign(new Error('exit code 4'), { exitCode: 4 }),   // a real contract error is not absence either
    ]) {
      const reader = createRecordShardLastSeqReader(async () => { throw error; });
      await expect(reader(`0:${'22'.repeat(32)}`)).rejects.toThrow();
    }
  });

  it('COLDFLOOR-03: the send no longer swallows the failure into a 0 floor', () => {
    const app = readFileSync('web/app.js', 'utf8');
    expect(app, 'the swallowing catch came back').not.toContain("cold-floor read failed, using 0");
    // The read stands on its own: a throw propagates, the send fails, the retry ladder re-attempts. That is the
    // honest outcome — the old one bought a silent non-delivery to avoid a visible retry.
    expect(app).toMatch(/coldFloor = await createRecordShardLastSeqReader\(\(call\) => transport\.runGetMethod\(call\)\)\(route\.address\);/);
  });
});
