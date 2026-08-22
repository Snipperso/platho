// conv-lane — the READ assembly of the clean-17 private CONV lane, wired together in one place (mirror of public-lane).
//
// The pieces exist on their own: conv-discovery derives the incoming RecordShard addresses for a conversation from its
// K_root (A's outgoing direction == B's incoming direction, address = f(bucketKey, epoch), zero on-chain lookups), and
// conv-lane-read parses a shard's published CapsulePublish bodies back into openable chain-entries and verifies the
// write signature. What did not exist was anything that put them together for one conversation. This is that seam.
//
// IT STOPS AT AUTHENTICATED-TRANSPORT ENTRIES. Decrypt is the app's job (it holds the recipient key), exactly as
// public-lane stops at authenticated posts: this returns parsed capsule chain-entries whose write signature verified
// under the conversation-direction write key, and app.js opens each with openPrivateCapsuleChainEntry (which does the
// recipient-key decrypt + in-body sender-signature check). A body that fails the write-sig gate is dropped here (junk
// sent to a public shard address); a body encrypted to someone else fails to open downstream. Neither ever surfaces.
//
// WHY ITS OWN MODULE rather than lines in app.js: app.js cannot be tested without a browser; here the whole read lane
// runs against a stub transport and fixed key-ids, the way the public and intro lanes do.

import { incomingRecordShards } from './conv-discovery.mjs?v=20';
import { parseCapsulePublishBody, convChainEntryFromParsed, verifyConvWriteSignature } from './conv-lane-read.mjs?v=26';
import { changeMarkerOf } from './shard-reader.mjs?v=24';
import { addrKey } from './shard-discovery.mjs?v=21';

// Mirrors createShardMessagesWithSourceReader's default `limit`. When a single shard returns exactly this many bodies,
// it MAY hold older ones the newest-page read did not return. The reader now pages, but only to get PAST junk when an
// endpoint ignores the opcode filter — a window legitimately full of capsules is still just the newest ones. So the
// truncation stays worth logging rather than silently assuming completeness. What DID change: the window is now 128
// CAPSULES rather than 128 inbound messages, since the shard's own fee deposits and top-ups no longer occupy it.
// [conv-receive review]
const CONV_SHARD_MESSAGE_PAGE_LIMIT = 128;

// HOW MANY OLDER BODY PAGES ONE PASS MAY PULL for a shard whose newest window did not reach what we already hold.
//
// MEASURED 2026-08-21 on the owner's incoming shards: record counts of 159, 213, 371, 2156 and 3968 in ONE
// direction-epoch — single senders writing thousands of capsules in minutes (3968 in ten). The reader took the newest
// 128 bodies and the high-water mark jumped to the top, so everything between the mark and the window was never read:
// not a warning, a loss. Paging back by lt (toncenter `end_lt`, measured honoured) closes the gap for any honest
// burst; the cap keeps a flood from turning one sync pass into a thousand requests — beyond it the gap is real and
// is said ONCE per shard, not once per pass (fifteen shards at the cap produced fifteen lines every twelve seconds).
const CONV_MAX_OLDER_BODY_PAGES = 4;
const convGapWarnedShards = new Set();

/**
 * Build the CONV read lane.
 *
 * `readMessagesWithSource` is createShardMessagesWithSourceReader(rpc) — `async (address) -> [{ bodyCell, source }]`,
 * the SAME reader the public and intro lanes use (a friendly shard address is accepted as the toncenter destination,
 * as the intro lane already relies on in production). `verifyWriteSig` (default true) re-checks each body's write
 * signature under the bucket's write public key before accepting it — the same gate RecordShard enforces.
 */
export function createConvReadLane({ readMessagesWithSource, verifyWriteSig = true } = {}) {
  if (typeof readMessagesWithSource !== 'function') throw new Error('createConvReadLane requires readMessagesWithSource');

  // ─────────────────────────────────────────────────────────────────────────────────────────────────────
  // THE CHANGE-MARKER GATE — a shard nobody wrote to must not cost a history read.
  //
  // MEASURED 2026-08-04: one conversation, no new messages, and the pass still fetched the /messages window of
  // all three window epochs, every 12 seconds, forever. Three requests to learn nothing — and at N conversations
  // it is 3N, sequential, so the "syncing" spinner grows linearly with how many people you talk to. That is a
  // product ceiling, not an inefficiency: at 20 dialogs the pass no longer finishes between ticks.
  //
  // `last_transaction_lt` settles it STRICTLY EARLIER and for free: it arrives in the batched accountStates read,
  // it is monotonic per account, and it moves on ANY inbound transaction. So it can be wrong only in the harmless
  // direction — a fee top-up re-reads a shard for nothing; it can never report "unchanged" for a shard that
  // accepted a capsule. The PUBLIC lane already caches its comment threads on exactly this marker; this is the
  // same instrument on the private side.
  //
  // ABSENCE IS ALSO AN ANSWER, and the cheapest one: toncenter omits an address it has never seen, so a bucket
  // with no row has no history to read. (A touched-but-empty address does come back, as an uninit row — so this
  // is "never written to", not "currently empty".)
  //
  // THE MARK MOVES ONLY AFTER A SUCCESSFUL READ. A bucket whose /messages call failed keeps its OLD mark, so the
  // next pass reads it again. Recording the new marker there would skip the shard forever — a silent, permanent
  // loss of every capsule in it, which is the one failure this lane exists to prevent.
  const shardMarks = new Map();            // addrKey -> change marker last read successfully
  const SHARD_MARK_LIMIT = 512;            // bounded: epochs advance and old buckets leave the window for good
  // Cumulative since this lane was built (i.e. since unlock). Reported in the on-device diagnostic dump, because
  // "the gate is skipping" and "the gate is skipping EVERYTHING" look identical from the outside — a silent lane
  // is the healthy state here AND the shape of a receive failure, so the counters have to separate them.
  const laneStats = { read: 0, skipped: 0, absent: 0 };

  function markShard(key, marker) {
    if (!key || marker === null || marker === undefined) return;
    shardMarks.delete(key);                // re-insert: Map insertion order doubles as the LRU list
    shardMarks.set(key, marker);
    while (shardMarks.size > SHARD_MARK_LIMIT) {
      const oldest = shardMarks.keys().next();
      if (oldest.done) break;
      shardMarks.delete(oldest.value);
    }
  }

  return {
    /**
     * Drop a shard's change mark so the next pass reads its whole window again, whatever the marker says.
     *
     * THE GATE ABOVE ONLY KNOWS WHETHER THE BYTES ARRIVED. The caller decrypts them, and a capsule that failed to
     * open for a TRANSIENT reason must be read again — but by then the shard's marker has not moved, so the gate
     * would skip it forever. The caller already tracks exactly this (its per-bucket `blocked` set, which also bars
     * its own seq high-water from advancing); this is how it tells the read side the same thing. The two marks are
     * one decision and they must be dropped together.
     */
    forgetShard(address) {
      if (!address) return;
      try { shardMarks.delete(addrKey(address)); } catch { /* not an address we ever marked */ }
    },

    /** History reads made, gate skips, and never-written shards — cumulative since this lane was built. */
    shardReadStats() {
      return { ...laneStats, marks: shardMarks.size };
    },

    /**
     * Every incoming CONV capsule chain-entry for one conversation across the acceptance window [epochNow-windowW ..
     * epochNow]. Each entry is ready for openPrivateCapsuleChainEntry. Foreign/malformed/wrong-signature bodies are
     * dropped. A shard whose read throws is skipped (its conversation window is best-effort, never fatal to the rest).
     */
    async readIncoming({ kRoot, selfKeyId, peerKeyId, epochNow, windowW, shards = null, states = null, knownSeqOf = null }) {
      // `shards` lets a caller that already derived these buckets hand them over rather than pay the HKDF twice;
      // `states` lets a caller that batched the accountStates read for MANY conversations at once share the answer
      // (1024 addresses fit one request, so every conversation's window costs one request between them all).
      // Omit both and this behaves exactly as it always did: derive, then read every bucket.
      const buckets = shards ?? await incomingRecordShards({ kRoot, selfKeyId, peerKeyId, epochNow, windowW });
      const out = [];
      for (const bucket of buckets) {
        const key = addrKey(bucket.address);
        // The marker this read will be worth, or null when the caller gave us no states to judge by (then the
        // bucket is read unconditionally, as it always was). A LOCAL, never written back onto `bucket` — the
        // caller may hold that array across passes, and a marker surviving into a pass that has no states would
        // silence a shard on the strength of a measurement nobody made this time round.
        let marker = null;
        if (states) {
          const state = states.get(key);
          // No row: never written to, nothing to read.
          if (!state) { markShard(key, 'absent'); laneStats.absent += 1; continue; }
          // A row with neither an lt nor a data hash carries no evidence either way. changeMarkerOf would still
          // hand back a string ("null"), and a CONSTANT marker is the worst possible one — it matches itself on
          // every later pass and silences the shard for good. Unknown means read it and remember nothing.
          if ((state.lastLt ?? state.dataHash ?? null) !== null) {
            marker = changeMarkerOf(state);
            if (shardMarks.get(key) === marker) { laneStats.skipped += 1; continue; }
          }
        }
        let messages;
        try { messages = await readMessagesWithSource(bucket.address); } catch { continue; }
        laneStats.read += 1;
        // THE NEWEST WINDOW MAY NOT REACH WHAT WE ALREADY HOLD. The caller knows the highest seq it has stored for
        // this shard (knownSeqOf); if the window is full and its oldest capsule is still above that mark, the bodies
        // in between were never read — page back by lt until the mark is reached, the history runs out, or the cap
        // says stop. A caller that gives no mark gets the window as before.
        let pagedBack = 0;
        let olderReadFailed = false;
        // ONLY WHEN THERE IS A MARK TO REACH. A device that holds nothing from this shard (mark -1: a cold start, a
        // dialog deleted locally, history cleared) has no gap between "what I hold" and the window — it has a
        // window, and reading five pages of it instead of one buys little and costs five times the decryption
        // (OBSERVED 2026-08-21 on the owner's reload: "bodies between seq -1 and 3694" on two shards a farm bot had
        // filled with thousands of capsules — 640 spam bodies opened per shard per reload). So a cold shard reads
        // the newest window as it always did, silently; paging back is for a mark the window did not reach.
        const known = typeof knownSeqOf === 'function' ? Number(knownSeqOf(bucket.address)) : NaN;
        if ((messages?.length ?? 0) >= CONV_SHARD_MESSAGE_PAGE_LIMIT && Number.isFinite(known) && known >= 0) {
          const oldestSeqOf = (rows) => {
            let oldest = null;
            for (const row of rows ?? []) {
              const seq = Number(parseCapsulePublishBody(row?.bodyCell)?.seq);
              if (Number.isFinite(seq) && (oldest === null || seq < oldest)) oldest = seq;
            }
            return oldest;
          };
          const oldestLtOf = (rows) => {
            let oldest = null;
            for (const row of rows ?? []) {
              if (row?.createdLt == null) continue;
              try { const lt = BigInt(row.createdLt); if (oldest === null || lt < oldest) oldest = lt; } catch { /* not an lt */ }
            }
            return oldest;
          };
          let page = messages;
          while (pagedBack < CONV_MAX_OLDER_BODY_PAGES) {
            const oldestSeq = oldestSeqOf(page);
            if (oldestSeq === null || (Number.isFinite(known) && oldestSeq <= known + 1)) break;   // reached what we hold
            const oldestLt = oldestLtOf(page);
            if (oldestLt === null) break;                                   // no lt on the wire — cannot page
            let older;
            // An older page that FAILED leaves no mark on this shard (below): the newest window was read, but the
            // pass did not see everything it could have, so the next pass must come back even if nobody writes.
            try { older = await readMessagesWithSource(bucket.address, { endLt: String(oldestLt - 1n) }); } catch { olderReadFailed = true; break; }
            if (!older || older.length === 0) break;                        // the history ran out
            pagedBack += 1;
            laneStats.pagedBack = (laneStats.pagedBack ?? 0) + 1;
            messages = [...messages, ...older];
            page = older;
          }
          const stillOldest = oldestSeqOf(page);
          const gapRemains = stillOldest !== null && Number.isFinite(known) && stillOldest > known + 1
            && pagedBack >= CONV_MAX_OLDER_BODY_PAGES;
          if (gapRemains && !convGapWarnedShards.has(key)) {
            convGapWarnedShards.add(key);
            laneStats.gaps = (laneStats.gaps ?? 0) + 1;
            console.warn('[conv] incoming shard outran the reader — bodies between seq', known, 'and', stillOldest, 'could not be paged this pass (cap', CONV_MAX_OLDER_BODY_PAGES, 'pages); said once for', bucket.address);
          }
        }
        if (marker !== null && !olderReadFailed) markShard(key, marker);
        for (const { bodyCell } of messages ?? []) {
          const parsed = parseCapsulePublishBody(bodyCell);
          if (!parsed) continue;
          if (verifyWriteSig && !(await verifyConvWriteSignature(parsed, bucket.writePublicKey))) continue;
          out.push({
            epoch: bucket.epoch,
            dir: bucket.dir,
            address: bucket.address,
            seq: parsed.seq === undefined || parsed.seq === null ? null : String(parsed.seq),
            entry: convChainEntryFromParsed(parsed),
          });
        }
      }
      return out;
    },
  };
}
