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
// The end anchor is the cursor advance that closes the scan. It carries a third condition since round 7 — the
// pass must also have been able to ADDRESS the newest epoch it claims — so the needle is the stable prefix
// rather than the whole line, which is what a source-scope anchor should have been all along.
const SCAN = APP.slice(
  APP.indexOf('const bucketMaxSeq = new Map();'),
  APP.indexOf('if (convClean && !tornDown()'),
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
    expect(SCAN).toContain('if (bucketBlocked.has(bucket)) continue;');
    expect(SCAN).toContain('advanceConvBucketSeqHighWater(bucket, capped);');
    // A PERMANENTLY unreadable capsule (someone else's, in a shared bucket) DOES advance — retrying it forever is
    // exactly the waste being removed.
    const permanent = SCAN.slice(SCAN.indexOf('if (isPrivateUnreadableCapsuleError(error)) {'));
    expect(permanent.slice(0, 400)).toContain('bucketMaxSeq.set(bucket, Math.max(');
  });

  it('SEQTAIL-04: marks advance only AFTER the append stored the messages', () => {
    // Advancing before the append would lose the whole collected batch if the append threw.
    const appendAt = SCAN.indexOf('await appendConvOpenedCapsules(collected, targetThread)');
    const advanceAt = SCAN.indexOf('advanceConvBucketSeqHighWater(bucket, capped)');
    expect(appendAt).toBeGreaterThan(-1);
    expect(advanceAt, 'the mark moves before the messages are stored').toBeGreaterThan(appendAt);
  });

  it('SEQTAIL-08: the mark stops BELOW a multipart part the append could not store yet', () => {
    // THE LOSS THIS CLOSES. A multipart message whose remaining parts are not on chain yet is deliberately not
    // rendered as fragments — appendConvOpenedCapsules skips the group and waits for a later tick. But the mark
    // advanced to the highest seq OPENED, held parts included, and the scan skips everything at or below the mark
    // BEFORE decrypting: the parts in hand were never opened again, the group could never complete, and the paid
    // message was gone. Nothing healed it either — a reload rebuilds the mark from stored history, and a message
    // that was never stored contributes nothing while any LATER message in the same shard puts the mark back above
    // the lost parts. Only a manual full rescan could recover it, and only if the shard still held the bodies.
    //
    // The split is the ordinary case, not an exotic one: the parts of one message are separate externals seconds
    // apart and the receive pass runs every 12s.
    const append = APP.slice(APP.indexOf('async function appendConvOpenedCapsules('), APP.indexOf('// clean-17 CONV receive (gated)'));
    expect(append).toContain('if (parts.length < partCount) {');
    expect(append, 'an incomplete group still holds the mark below the parts in hand').toContain('if (!abandoned) hold(parts);');
    // …BUT NOT FOREVER [audit 2026-09-01, round 9]. `partCount` is a peer-controlled uint16 inside the encrypted
    // payload, so `partIndex: 0, partCount: 2` with no sibling ever published pinned the shard's mark at floor-1
    // permanently — every capsule above it re-decrypted on every 12-second pass for the life of the account, for
    // one publish per epoch-day. Reachable without malice too: the confirm path's own note says a middle part can
    // bounce while a later one lands, which leaves the RECIPIENT here. The floor is released at the point the
    // SENDER stops retrying, because past that no sibling is coming from anyone; the parts stay in hand, so a
    // late arrival still assembles.
    expect(append).toContain('(Date.now() - sealedAt) > PRIVATE_SEND_PARTIAL_RETRY_DEADLINE_MS');
    // An append that THREW stored nothing either — the same one line closes the gap seedConvSeqMarksFromHistory
    // documents as "known and unchanged".
    expect(append).toContain("      hold(parts);   // stored nothing, so the mark may not pass it either");
    expect(append).toContain('return { appended, held };');
    // And the caller keeps its mark under the lowest held part of each shard, rather than barring the shard whole:
    // everything below that part really was stored.
    expect(SCAN).toContain('const capped = floor === undefined ? seq : Math.min(seq, floor - 1);');
    expect(SCAN).toContain('if (previous === undefined || entry.seq < previous) heldFloor.set(entry.address, entry.seq);');
  });

  it('SEQTAIL-05: the mark store is bounded, and eviction can only cost a re-read', () => {
    // Epochs advance forever; without a bound a long session grows one entry per bucket per epoch with no ceiling.
    expect(APP).toContain('const CONV_BUCKET_SEQ_MARK_LIMIT = 512;');
    expect(APP).toContain('while (convBucketSeqMarks.size > CONV_BUCKET_SEQ_MARK_LIMIT) {');
    // Never below a known mark — a mark that could go BACKWARDS would re-open the window it just skipped.
    expect(APP).toContain('if (seq <= convBucketSeqHighWater(bucketAddress)) return;');
  });

  it('SEQTAIL-07: the mark SURVIVES a reload, and it is DERIVED from the stored messages', () => {
    // MEASURED on the owner's dump: the first pass after every reload read `collected: 51, appended: 0` — the whole
    // window decrypted to conclude nothing was new, because the mark lived only in the tab's memory. The cost scaled
    // with how much the conversation had carried lately, not with how much of it was new.
    //
    // The mark is a fact ABOUT the messages ("everything up to seq N in this shard is already in my history"), so it
    // is rebuilt FROM them rather than persisted beside them. A second stored copy of a derived value is the thing
    // that breaks somewhere other than where it lives — and here the specific break would be a mark that outlives
    // the messages it speaks for, which is a silent skip: exactly the failure this lane must never have.
    expect(APP).toContain('function seedConvSeqMarksFromHistory(messages) {');
    expect(APP, 'the shard address rides with the entry, so a stored message remembers where it came from')
      .toContain('collected.push({ opened, entry: { entry_id: found.seq, address: bucket || undefined } });');
    expect(APP, 'and lands on the message as a first-class field')
      .toContain('if (shardAddress !== null) fields.convShardAddress = shardAddress;');

    // Rebuilt from the RESTORED messages — no separate store to fall out of sync with, and nothing to migrate.
    expect(APP).toContain('const seededSeqMarks = seedConvSeqMarksFromHistory(restored.map((item) => item.message));');
    expect(APP, 'and the count is visible, so a device that seeded nothing is diagnosable').toContain('seededSeqMarks,');

    // A multipart message spans several entries in one shard; the mark must clear its HIGHEST, or the tail of it
    // gets re-opened on every pass forever.
    const seed = APP.slice(APP.indexOf('function seedConvSeqMarksFromHistory(messages) {'), APP.indexOf('function advanceConvBucketSeqHighWater('));
    expect(seed).toContain('Number(message.chainLastEntryId ?? message.chainEntryId)');
    // Absence of the field is the SAFE direction: no address, no mark, one honest re-read.
    expect(seed).toContain("if (typeof address !== 'string' || !address) continue;");

    // AND THE FIELD MUST ACTUALLY REACH THE STORE. serializeMessageForHistory is a WHITELIST; leaving the field out
    // of it made this entire mechanism a no-op — set in memory, never written, nothing to rebuild from on the next
    // boot. MEASURED on the owner's dump: the first pass after a reload still read `collected: 58, seqSkipped: 0`.
    const serializerAt = APP.indexOf('function serializeMessageForHistory(message) {');
    const serializer = APP.slice(serializerAt, serializerAt + 3000);
    expect(serializer.length).toBeGreaterThan(200);
    expect(serializer, 'persisted, or the seeding above has nothing to read').toContain('convShardAddress: message.convShardAddress ?? null,');

    // A message stored before the field existed gets it BACKFILLED on the pass that re-reads its capsule, so one
    // full pass makes the whole window seedable instead of waiting for new traffic shard by shard.
    const merge = APP.slice(APP.indexOf('function mergeOpenedPrivateMessage('), APP.indexOf('function upsertOpenedPrivateMessage('));
    expect(merge, 'backfilled onto an already-known message').toContain("'convShardAddress',");

    // And the counter is IN THE DUMP, not only in a global. Twice today I pointed at a number the dump did not
    // carry; a diagnostic nobody can print is a note to self, not a diagnostic.
    expect(APP).toContain('seeded: globalThis.plathoLastEncryptedHistoryRestore.seededSeqMarks ?? null,');
  });

  it('SEQTAIL-06: the skip count is reported, so the win is visible on a real device', () => {
    // A pass that skips EVERYTHING is the healthy steady state; a diagnostic that only records passes which did work
    // cannot show that the work stopped.
    expect(APP).toContain('if (collected.length > 0 || seqSkipped > 0) {');
    expect(APP).toContain('appended: appendedNow, seqSkipped });');
    expect(APP).toMatch(/function recordConvRouteDebug\(\{[^}]*seqSkipped = 0 \}\)/);
  });
});
