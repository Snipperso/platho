// intro-scan-runner — the loop that actually makes first contact arrive.
//
// Everything else in this lane is a piece: the scan finds hits, the policy says how wide and how often, the store
// remembers where we stopped, the transport fetches and verifies the body. This is the part that runs them, and
// it is deliberately a module rather than lines inside app.js — the scheduling decisions here have already been
// wrong twice in ways that cost real money on a phone, so they belong somewhere they can be tested without a
// browser or a network.
//
// WHAT IT GUARANTEES, and why each one exists:
//   - A hit is delivered ONCE, and that is enforced TWICE. Cursors mean a normal pass never re-reads what it has
//     already read; a persisted delivery ledger means that even if it does — a retry after a failure, a restored
//     backup, a cursor lost to a storage error — the same first contact is not put in front of the user again.
//     Belt and braces on purpose: showing a duplicate is showing rubbish, and "the user will cope" is not a
//     design decision, it is an excuse for one.
//   - A pass that FAILS advances nothing. Failed buckets keep their old cursor and are retried; a transient RPC
//     error must never be able to mark a first contact as seen.
//   - Cursors are pruned. A fresh set of shards is minted every day, so without pruning the map grows for the
//     life of the install and every entry in it is for a shard that can never hold anything again.
//   - The interval comes from measured cost, not from a constant. It is minute-fresh while that is affordable and
//     degrades on its own as the network grows.
//   - Nothing runs while the app is hidden. Background polling is battery the user did not agree to spend.

import { INTRO_READ_SPACE } from './shard-discovery.mjs?v=14';
import { scanIntroWindow, INTRO_SCAN_EPOCHS_BACK, INTRO_SCAN_EPOCHS_FORWARD } from './intro-receive.mjs';
import { planIntroScan, DEFAULT_POLICY } from './intro-scan-policy.mjs?v=1';
import { pruneCursors, pruneDelivered, deliveryKey } from './intro-cursor-store.mjs?v=1';

export const epochNow = (nowMs) => Math.floor(nowMs / 1000 / 86400);

/**
 * Create the runner. Every dependency is injected, so a test drives it with a fake clock and a sandbox while the
 * app passes the real transport.
 *
 *   readStates(addresses)                     -> Map(addrKey -> state)
 *   readScanPage(address, fromId, maxCount)   -> page | null   (null ONLY for a shard that does not exist)
 *   fetchCapsule({ epoch, bucket, entryId })  -> capsule | null (already verified against body_commit)
 *   onIntro(delivery)                         -> called once per first contact, awaited
 *   store                                     -> intro-cursor-store
 */
export function createIntroScanRunner({
  scanSecretKey,
  readStates,
  readScanPage,
  fetchCapsule,
  onIntro,
  store,
  readSpace = INTRO_READ_SPACE,
  policy = {},
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (handle) => clearTimeout(handle),
  onError = () => {},
} = {}) {
  if (!scanSecretKey) throw new Error('createIntroScanRunner requires scanSecretKey');
  for (const [name, fn] of [['readStates', readStates], ['readScanPage', readScanPage], ['onIntro', onIntro]]) {
    if (typeof fn !== 'function') throw new Error(`createIntroScanRunner requires ${name}`);
  }
  if (!store) throw new Error('createIntroScanRunner requires a cursor store');

  let timer = null;
  let running = false;
  let passInFlight = false;      // a manual refresh must not race the scheduled pass over the same cursors
  let stopped = true;
  let lastStats = null;

  async function runPass({ force = false } = {}) {
    // ONE PASS AT A TIME. Two overlapping passes both load the cursor map, both extend it, and the second save
    // overwrites the first — losing the progress of whichever finished earlier and re-delivering its intros.
    if (passInFlight) return null;
    passInFlight = true;
    try {
      const cursors = await store.load();
      const delivered = (await store.loadDelivered?.()) ?? new Map();
      const meta = await store.loadMeta();
      const currentEpoch = epochNow(now());
      const msSinceFullSweep = force ? Infinity : now() - (meta.lastFullSweepAt ?? 0);

      const plan = planIntroScan({
        // The hot range is sized by a COUNT of live buckets, not by the highest index seen — a maximum is
        // poisoned by a single intro written high, see intro-scan-policy.mjs.
        distinctLiveBuckets: meta.distinctLiveBuckets ?? 0,
        liveBucketIndices: meta.liveBucketIndices ?? [],
        liveBuckets: meta.liveBuckets ?? 0,
        readSpace,
        currentEpoch,
        msSinceFullSweep,
        policy,
      });

      const result = await scanIntroWindow({
        scanSecretKey,
        currentEpoch,
        fromEpoch: plan.epochs?.from ?? currentEpoch - INTRO_SCAN_EPOCHS_BACK,
        toEpoch: plan.epochs?.to ?? currentEpoch + INTRO_SCAN_EPOCHS_FORWARD,
        readSpace,
        buckets: plan.buckets,
        extraBuckets: plan.extraBuckets,
        cursors,
        readStates,
        readScanPage,
      });

      // Deliver before the cursor is persisted, so a delivery that throws is retried rather than skipped — and
      // check the ledger first, so a retry cannot become a duplicate. The ledger is written immediately after a
      // successful hand-off, in the same save as the cursors below.
      let deliveries = 0;
      const undelivered = new Set();
      for (const hit of result.hits) {
        const key = deliveryKey(hit);
        if (delivered.has(key)) continue;                 // already shown; a re-read must not resurface it
        try {
          const capsule = fetchCapsule ? await fetchCapsule(hit) : null;
          await onIntro({ ...hit, capsule });
          delivered.set(key, hit.epoch);
          deliveries += 1;
        } catch (error) {
          onError(error);
          // NOT recorded — and its shard's cursor must not advance either, or the next pass will never re-read
          // the entry and the first contact is lost for good. Leaving the cursor alone costs one re-read.
          undelivered.add(hit.key);
        }
      }

      // Roll back the cursor of any shard whose delivery failed, to exactly where this pass found it.
      const nextCursors = new Map(result.cursors);
      for (const key of undelivered) {
        if (cursors.has(key)) nextCursors.set(key, cursors.get(key));
        else nextCursors.delete(key);
      }

      // A hot pass only looked at part of the space, so its view of "what exists" is partial: only a full sweep
      // may lower highestLiveBucket, or the hot range could shrink below where senders are actually writing and
      // stay there. Raising it is always safe.
      const seenHighest = result.stats.highestLiveBucket ?? -1;
      const seenDistinct = result.stats.distinctLiveBuckets ?? 0;
      const nextMeta = {
        ...meta,
        liveBuckets: plan.full ? result.stats.live : Math.max(meta.liveBuckets ?? 0, result.stats.live),
        // Same ratchet, same reason: a hot pass saw only part of the space, so it may RAISE this figure but
        // never lower it; only a full sweep, which saw everything, may lower it.
        distinctLiveBuckets: plan.full ? seenDistinct : Math.max(meta.distinctLiveBuckets ?? 0, seenDistinct),
        // Same ratchet: a full sweep saw everything and may replace the list; a hot pass saw only part of the
        // space, so it may only ADD to what it already knew.
        liveBucketIndices: plan.full
          ? (result.stats.liveBucketIndices ?? [])
          : [...new Set([...(meta.liveBucketIndices ?? []), ...(result.stats.liveBucketIndices ?? [])])]
            .sort((a, b) => a - b),
        highestLiveBucket: plan.full ? seenHighest : Math.max(meta.highestLiveBucket ?? -1, seenHighest),
        lastFullSweepAt: plan.full ? now() : (meta.lastFullSweepAt ?? 0),
        lastPassAt: now(),
      };

      const oldestUseful = currentEpoch - INTRO_SCAN_EPOCHS_BACK;
      await store.save(pruneCursors(nextCursors, result.keyEpochs, oldestUseful, { sawWholeWindow: plan.full }));
      await store.saveDelivered?.(pruneDelivered(delivered, oldestUseful));
      await store.saveMeta(nextMeta);

      lastStats = { ...result.stats, delivered: deliveries, plan: { full: plan.full, intervalMs: plan.intervalMs, estimatedDailyBytes: plan.estimatedDailyBytes } };
      return { hits: result.hits.length, delivered: deliveries, stats: lastStats, nextIntervalMs: plan.intervalMs };
    } finally {
      passInFlight = false;
    }
  }

  function schedule(ms) {
    if (stopped) return;
    clearTimer(timer);
    // Returns the promise on purpose: a real setTimeout ignores it, but a test clock can await the pass instead
    // of asserting against one that has not run yet.
    timer = setTimer(() => tick().catch(onError), ms);
  }

  async function tick() {
    if (stopped) return;
    let next = DEFAULT_POLICY.minIntervalMs;
    try {
      const outcome = await runPass();
      if (outcome) next = outcome.nextIntervalMs;
    } catch (error) {
      onError(error);
      // Back off on failure rather than hammering an endpoint that is already unhappy — but never stop, because
      // stopping means first contacts silently stop arriving.
      next = Math.min(DEFAULT_POLICY.maxIntervalMs, DEFAULT_POLICY.minIntervalMs * 4);
    }
    schedule(next);
  }

  return {
    /** Begin scanning. Safe to call repeatedly. The first pass runs immediately: an app-open scan is the case that
     *  makes a demo work, and it costs one request. */
    async start() {
      if (running) return;
      running = true; stopped = false;
      await tick();
    },
    /** Stop scanning — call when the app goes to the background. Nothing in flight is cancelled, but nothing new
     *  is scheduled, so a hidden tab spends no battery. */
    stop() {
      stopped = true; running = false;
      clearTimer(timer);
      timer = null;
    },
    /** A user-initiated refresh: sweep the WHOLE space now, regardless of where the cadence had got to. */
    async refreshNow() {
      const outcome = await runPass({ force: true });
      if (outcome) schedule(outcome.nextIntervalMs);
      return outcome;
    },
    get isRunning() { return running; },
    get lastStats() { return lastStats; },
  };
}
