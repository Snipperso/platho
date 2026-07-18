// intro-receive — the INTRO lane's receive path: find the first contacts addressed to me, without asking.
//
// THE SHAPE OF THE PROBLEM. A first contact comes from a stranger, so there is no shared secret yet and the
// sender picks the bucket. The recipient is hidden behind a stealth tag, view_tag = HKDF(X25519(r, scan_pub), R),
// which is a function of the intro's OWN ephemeral point. There is therefore no single "my tag" to look up, and
// asking a shard "which entries are mine" would reveal exactly the who-contacts-whom link the lane exists to
// hide. The recipient must look at every live intro and test each one. That is not a limitation to engineer
// around — it IS the privacy property.
//
// WHAT MAKES IT AFFORDABLE (all measured, see web/shard-reader.mjs for the raw numbers):
//   - The whole read space is ONE batched accountStates request, because empty buckets cost nothing and 1024
//     addresses fit under the 64 KiB URL wall.
//   - That cheap pass carries data_hash / last_transaction_lt, so it says exactly which buckets changed.
//   - Only changed buckets are opened, and they are opened with get_scan_page from a remembered cursor, so the
//     bytes are proportional to what is NEW rather than to what exists.
// Consequently: requests track the read space (a constant), bytes track real traffic. A minute-fresh first
// contact costs about three minutes of connection a day; a scan on app-open is one request and about a second.
//
// TWO INVARIANTS THAT LOOK LIKE DETAILS AND ARE NOT:
//   - An absent bucket is EMPTY, never an error. Under lazy deploy most buckets have no account at all.
//   - The scan window must cover the full retention period, not just today. An intro published just before
//     midnight lives in yesterday's shard, and entries stay live for a week from the moment they were written.

import { INTRO_READ_SPACE, introShardAddress, addrKey } from './shard-discovery.mjs';
import { INTRO_SAFE_CAP } from './intro-scan-policy.mjs';
import { readAccountStates, changedSince, changeMarkerOf } from './shard-reader.mjs';
import { scanIntros } from './intro-scan.mjs';

// THE WINDOW REACHES FORWARD AS WELL AS BACK, and the forward edge is not decoration.
// The publish gate (13684) accepts a shard whose epoch is now +/-1, so a sender with a fast clock legitimately
// writes into TOMORROW's shard. An earlier revision ended the window at today and simply could not see those
// intros until the client's own epoch rolled over — up to a day late, with the entry's usable life cut short.
// The backward edge follows from the same gate: an entry may be created as late as the end of epoch S+1 and lives
// a week from then, so shard S can still hold live entries until the end of epoch S+8.
// Hence the window for a client at epoch C is [C-8, C+1] — ten epochs, not nine.
export const INTRO_SCAN_EPOCHS_BACK = 8;
export const INTRO_SCAN_EPOCHS_FORWARD = 1;
export const INTRO_SCAN_EPOCHS = INTRO_SCAN_EPOCHS_BACK + INTRO_SCAN_EPOCHS_FORWARD + 1;

/** Unpack a get_scan_page payload: (uint256 r, uint16 view_tag) pairs, 3 per cell, in ascending id order. */
export function unpackScanPage(pairs, count) {
  const out = [];
  let cur = pairs;
  while (cur && out.length < count) {
    const slice = cur.beginParse();
    while (slice.remainingBits >= 272 && out.length < count) {
      out.push({ r: slice.loadUintBig(256), view_tag: slice.loadUint(16) });
    }
    cur = cur.refs.length > 0 ? cur.refs[0] : null;
  }
  return out;
}

/**
 * One scan pass over the INTRO lane.
 *
 * `readStates(addresses)`   -> Map(addrKey -> state), as web/shard-reader.readAccountStates produces.
 * `readScanPage(address, fromId, maxCount)` -> { from_id, count, next_id, evict_cursor, pairs } or null if the
 *                              shard does not exist. Both are injected so this stays transport-agnostic.
 * `cursors` is the caller's memory across passes: addrKey -> { marker, nextId }. Pass the returned one back in.
 * `buckets` is the range to look at, `{from, to}` (to exclusive). Defaults to the whole read space. A narrower
 * range is how the frequent poll stays cheap — see web/intro-scan-policy.mjs for why that is the dominant cost —
 * and it is safe because the full space is swept on a slower cadence to catch anything written above the range.
 *
 * Returns { hits, cursors, stats }. A hit is a first contact addressed to this scan key; the caller then fetches
 * its body from the shard's transaction history using the entry it names.
 */
export async function scanIntroWindow({
  scanSecretKey,
  currentEpoch,
  toEpoch = currentEpoch + INTRO_SCAN_EPOCHS_FORWARD,
  fromEpoch = (currentEpoch ?? toEpoch) - INTRO_SCAN_EPOCHS_BACK,
  readSpace = INTRO_READ_SPACE,
  buckets = null,
  cursors = new Map(),
  readStates,
  readScanPage,
  pageSize = 256,
} = {}) {
  if (!scanSecretKey) throw new Error('scanIntroWindow requires scanSecretKey');
  if (!Number.isInteger(toEpoch)) throw new Error('scanIntroWindow requires currentEpoch or toEpoch');
  if (typeof readStates !== 'function' || typeof readScanPage !== 'function') {
    throw new Error('scanIntroWindow requires readStates and readScanPage');
  }

  // Pass 1 — ask about the whole range at once. Buckets nobody has written to simply do not come back, so an
  // over-wide range costs only the addresses in the request URL, never anything in the response.
  const from = Math.max(0, buckets?.from ?? 0);
  const to = Math.min(readSpace, buckets?.to ?? readSpace);
  const targets = [];
  for (let epoch = fromEpoch; epoch <= toEpoch; epoch += 1) {
    for (let bucket = from; bucket < to; bucket += 1) {
      targets.push({ epoch, bucket, address: await introShardAddress(epoch, bucket) });
    }
  }
  const byKey = new Map(targets.map((t) => [addrKey(t.address), t]));
  const states = await readStates(targets.map((t) => t.address));

  const seen = new Map();
  for (const [key, entry] of cursors) seen.set(key, entry?.marker ?? null);
  const changed = changedSince(states, seen);

  // Pass 2 — open only what moved, and only from where we stopped. This is the step a whole-state read cannot do:
  // data_boc always returns the entire dictionary, while the getter takes a cursor.
  const nextCursors = new Map(cursors);
  const candidates = [];
  const failures = [];
  let pagesRead = 0;
  for (const { key, state } of changed) {
    const target = byKey.get(key);
    if (!target) continue;                                  // not ours; ignore rather than trust the response
    let fromId = cursors.get(key)?.nextId ?? 0;
    // An honest shard can never need more than this: SAFE_CAP entries at pageSize each, plus one page to see the
    // end. Without the bound, termination depends entirely on server-supplied `count` and `next_id`, and an
    // endpoint answering {count: pageSize, next_id: huge} forever makes a scan pass never return — no first
    // contact from ANY bucket is delivered, and the UI simply shows nothing arriving.
    const maxPages = Math.ceil(INTRO_SAFE_CAP / Math.max(1, pageSize)) + 1;
    let drained = false;
    try {
      for (let page = 0; page < maxPages; page += 1) {
        const read = await readScanPage(target.address, fromId, pageSize);
        if (!read) { drained = true; break; }   // the shard does not exist: genuinely nothing here
        pagesRead += 1;
        // Eviction may have overtaken our cursor; the shard clamps from_id up to its live floor, so resume there.
        const start = Number(read.from_id);
        const count = Number(read.count);
        if (!Number.isFinite(start) || !Number.isFinite(count) || count < 0 || start < 0) {
          throw new Error(`get_scan_page returned a nonsensical page (from_id=${read.from_id}, count=${read.count})`);
        }
        const entries = count > 0 ? unpackScanPage(read.pairs, count) : [];
        entries.forEach((e, i) => candidates.push({ ...e, key, epoch: target.epoch, bucket: target.bucket, entryId: start + i }));
        const advanced = start + count;
        if (advanced <= fromId && count === 0) { fromId = Number(read.next_id); drained = true; break; }
        fromId = advanced;
        if (fromId >= Number(read.next_id)) { fromId = Number(read.next_id); drained = true; break; }
      }
    } catch (error) {
      // A read that FAILED is not a read that found nothing. Leave the cursor untouched so the next pass retries.
      failures.push({ key, epoch: target.epoch, bucket: target.bucket, error });
      continue;
    }

    // COMMIT THE MARKER ONLY IF THE BUCKET WAS ACTUALLY DRAINED. The previous revision committed it
    // unconditionally, so a single transient RPC hiccup marked the bucket "already processed at this state" and it
    // was never reopened — the epoch gate closes the shard to further writes, so nothing would ever move its
    // marker again and every intro in it was lost silently and permanently. One bad response, one lost first
    // contact, no error anywhere.
    // COMMIT ONLY A BUCKET WE ACTUALLY REACHED THE END OF.
    // Two things were wrong here and each loses a first contact silently. Committing unconditionally marked a
    // bucket "processed at this state" after a failed read, and since the epoch gate closes the shard to further
    // writes, nothing would ever reopen it. Then "keep the progress we made" was wrong too: the only way to leave
    // the loop undrained is the page bound, which is reached only when the responses were pathological — so the
    // position they advanced us to is exactly the thing not to trust. An undrained bucket keeps its OLD cursor and
    // is read again from where the last GOOD pass stopped.
    if (drained) nextCursors.set(key, { marker: changeMarkerOf(state), nextId: fromId });
  }

  // The filter itself. One X25519 per candidate — unavoidable, it is what stealth costs.
  const hits = candidates.length ? await scanIntros(scanSecretKey, candidates) : [];

  return {
    hits,
    cursors: nextCursors,
    stats: {
      window: [fromEpoch, toEpoch],
      buckets: [from, to],
      probed: targets.length,
      live: states.size,
      // the highest bucket actually in use — this is what lets the caller size its hot range without agreeing
      // anything with anyone; a full sweep updates it, a hot pass can only confirm what it already covers
      highestLiveBucket: [...states.keys()].reduce((max, key) => Math.max(max, byKey.get(key)?.bucket ?? -1), -1),
      changed: changed.length,
      pagesRead,
      candidates: candidates.length,
      // Buckets whose read FAILED. Their cursors were deliberately left alone, so the next pass retries them; a
      // caller that wants to surface "some buckets could not be read" has it here rather than having to guess.
      failed: failures.length,
    },
    failures,
    // key -> epoch for everything this pass looked at, so the caller can prune cursors for shards that have
    // aged out of the window. Without it the cursor map grows by a fresh set of shards every single day.
    keyEpochs: new Map([...byKey].map(([key, target]) => [key, target.epoch])),
  };
}
