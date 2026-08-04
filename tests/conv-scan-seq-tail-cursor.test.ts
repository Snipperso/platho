import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// THE RECEIVE SCAN MUST READ THE TAIL, NOT THE WHOLE WINDOW.
//
// MEASURED 2026-08-04 from the owner's diagnostic dump: 24 consecutive passes, every one `collected: 32, appended: 0`.
// Every ~37 seconds the scan re-opened 32 capsules and found nothing new, because dedup ran AFTER decryption
// (findMessageByCapsuleId needs the opened capsule). Benchmarked on this machine: 4.7ms per own capsule, 2.3ms per
// foreign one — ~150ms per pass on a desktop, 3-5x that on a phone, plus a real macrotask yield after every open.
// Half a second of main thread, per pass, to learn nothing.
//
// The cursor is exact rather than a heuristic: `seq` is PLAINTEXT in the publish body (parseCapsulePublishBody reads
// it before any crypto), and RecordShard gate 13653 refuses a publish whose seq does not exceed the shard's last_seq,
// so seq strictly increases per shard. Nothing at or below the mark can be new.
const APP = readFileSync('web/app.js', 'utf8');
const CONV_LANE = readFileSync('web/conv-lane.mjs', 'utf8');

/** The scan body, so ordering assertions cannot accidentally match some other loop. */
const SCAN = APP.slice(
  APP.indexOf('const bucketMaxSeq = new Map();'),
  APP.indexOf('if (convClean) await convKeyStore.advanceConvScanCursor('),
);

describe('SEQTAIL — the CONV scan skips already-decrypted entries before decrypting them', () => {
  it('SEQTAIL-01: the skip happens BEFORE the open, not after', () => {
    expect(SCAN.length).toBeGreaterThan(400);
    const skipAt = SCAN.indexOf('foundSeq <= convBucketSeqHighWater(bucket)');
    const openAt = SCAN.indexOf('await openPrivateCapsuleChainEntry(');
    expect(skipAt, 'the seq gate is gone').toBeGreaterThan(-1);
    expect(openAt).toBeGreaterThan(-1);
    expect(skipAt, 'skipping AFTER the open saves nothing — decryption is the whole cost').toBeLessThan(openAt);
  });

  it('SEQTAIL-02: the mark is exact — seq is plaintext and strictly increases per shard', () => {
    // The lane parses seq from the publish body and hands it up UNOPENED, which is what makes a pre-decryption gate
    // possible at all. If that ever stops being true this test should be the thing that notices.
    expect(CONV_LANE).toContain('seq: parsed.seq === undefined || parsed.seq === null ? null : String(parsed.seq),');
    expect(CONV_LANE).toContain('address: bucket.address,');
  });

  it('SEQTAIL-03: a TRANSIENT failure bars its bucket entirely — no message is ever skipped past', () => {
    // The one way this optimisation could lose a message: advance the mark over an entry that failed to open for a
    // transient reason. The bucket is barred from advancing at all, so the whole range is re-read next pass.
    // Anchor on the CAPSULE-OPEN catch specifically: the shard-READ catch above it also sets convClean, and slicing
    // from the first match lands there instead.
    const transient = SCAN.slice(SCAN.indexOf('// TRANSIENT. The mark must NOT move past'));
    expect(transient.length, 'the transient-failure branch lost its marker comment').toBeGreaterThan(100);
    expect(transient.slice(0, 400)).toContain('bucketBlocked.add(bucket)');
    expect(SCAN).toContain('if (!bucketBlocked.has(bucket)) advanceConvBucketSeqHighWater(bucket, seq);');
    // A PERMANENTLY unreadable capsule (someone else's, in a shared bucket) DOES advance — retrying it forever is
    // exactly the waste being removed.
    const permanent = SCAN.slice(SCAN.indexOf('if (isPrivateUnreadableCapsuleError(error)) {'));
    expect(permanent.slice(0, 400)).toContain('bucketMaxSeq.set(bucket, Math.max(');
  });

  it('SEQTAIL-04: marks advance only AFTER the append stored the messages', () => {
    // Advancing before the append would lose the whole collected batch if the append threw.
    const appendAt = SCAN.indexOf('await appendConvOpenedCapsules(collected, targetThread)');
    const advanceAt = SCAN.indexOf('advanceConvBucketSeqHighWater(bucket, seq)');
    expect(appendAt).toBeGreaterThan(-1);
    expect(advanceAt, 'the mark moves before the messages are stored').toBeGreaterThan(appendAt);
  });

  it('SEQTAIL-05: the mark store is bounded, and eviction can only cost a re-read', () => {
    // Epochs advance forever; without a bound a long session grows one entry per bucket per epoch with no ceiling.
    expect(APP).toContain('const CONV_BUCKET_SEQ_MARK_LIMIT = 512;');
    expect(APP).toContain('while (convBucketSeqMarks.size > CONV_BUCKET_SEQ_MARK_LIMIT) {');
    // Never below a known mark — a mark that could go BACKWARDS would re-open the window it just skipped.
    expect(APP).toContain('if (seq <= convBucketSeqHighWater(bucketAddress)) return;');
  });

  it('SEQTAIL-06: the skip count is reported, so the win is visible on a real device', () => {
    // A pass that skips EVERYTHING is the healthy steady state; a diagnostic that only records passes which did work
    // cannot show that the work stopped.
    expect(APP).toContain('if (collected.length > 0 || seqSkipped > 0) {');
    expect(APP).toContain('appended: appendedNow, seqSkipped });');
    expect(APP).toMatch(/function recordConvRouteDebug\(\{[^}]*seqSkipped = 0 \}\)/);
  });
});
