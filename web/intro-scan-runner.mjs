
import { INTRO_READ_SPACE } from './shard-discovery.mjs?v=104';
import { scanIntroWindow, INTRO_SCAN_EPOCHS_BACK, INTRO_SCAN_EPOCHS_FORWARD } from './intro-receive.mjs?v=84';
import { planIntroScan, DEFAULT_POLICY } from './intro-scan-policy.mjs?v=6';
import { pruneCursors, pruneDelivered, deliveryKey } from './intro-cursor-store.mjs?v=16';

export const epochNow = (nowMs) => Math.floor(nowMs / 1000 / 86400);

export const INTRO_CAPSULE_EAGER_RETRIES = 3;
export const INTRO_CAPSULE_MAX_BACKOFF_PASSES = 64;

const UNOPENABLE_PREFIX = 'u|';
export const unopenableLedgerKey = (build, key) => `${UNOPENABLE_PREFIX}${String(build ?? '')}|${key}`;
export function parseUnopenableLedgerKey(ledgerKey) {
  const text = String(ledgerKey ?? '');
  if (!text.startsWith(UNOPENABLE_PREFIX)) return null;
  const rest = text.slice(UNOPENABLE_PREFIX.length);
  const bar = rest.indexOf('|');
  if (bar < 0) return null;
  const key = rest.slice(bar + 1);
  const [epoch, bucket, entryId] = key.split(':').map(Number);
  if (![epoch, bucket, entryId].every((value) => Number.isInteger(value) && value >= 0)) return null;
  return { build: rest.slice(0, bar), key, epoch, bucket, entryId };
}

export function createIntroScanRunner({
  scanSecretKey,
  readStates,
  readScanPage,
  fetchCapsule,
  build = '',
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
  let passInFlight = false;
  let stopped = true;
  let lastStats = null;

  const unfetchable = new Map();
  let passIndex = 0;

  function noteUnfetchable(key, hit) {
    const prior = unfetchable.get(key);
    const attempts = (prior?.attempts ?? 0) + 1;
    const backoff = attempts <= INTRO_CAPSULE_EAGER_RETRIES
      ? 1
      : Math.min(INTRO_CAPSULE_MAX_BACKOFF_PASSES, 2 ** (attempts - INTRO_CAPSULE_EAGER_RETRIES));
    unfetchable.set(key, { attempts, notBeforePass: passIndex + backoff, firstAt: prior?.firstAt ?? now() });
    if (attempts === 1 || attempts === INTRO_CAPSULE_EAGER_RETRIES + 1 || attempts % 16 === 0) {
      const error = new Error(
        `intro capsule not readable yet (attempt ${attempts}): entry ${key} is on chain but no message in its shard `
        + `window reproduces the stored body_commit — index lag, or a body past the window; retrying in ${backoff} pass(es)`,
      );
      error.code = 'INTRO_CAPSULE_UNAVAILABLE';
      error.hit = { epoch: hit.epoch, bucket: hit.bucket, entryId: hit.entryId };
      onError(error);
    }
  }

  async function runPass({ force = false } = {}) {
    if (passInFlight) return null;
    passInFlight = true;
    passIndex += 1;
    try {
      const cursors = await store.load();
      const delivered = (await store.loadDelivered?.()) ?? new Map();
      const meta = await store.loadMeta();
      const currentEpoch = epochNow(now());
      const msSinceFullSweep = force ? Infinity : now() - (meta.lastFullSweepAt ?? 0);

      const plan = planIntroScan({
        distinctLiveBuckets: meta.distinctLiveBuckets ?? 0,
        liveBucketIndices: meta.liveBucketIndices ?? [],
        liveBuckets: meta.liveBuckets ?? 0,
        readSpace,
        currentEpoch,
        msSinceFullSweep,
        recordsPerDay: Number(meta.recordsPerDay ?? 0),
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

      let deliveries = 0;
      let replays = 0;
      let unopenable = 0;
      const undelivered = new Set();
      for (const hit of result.hits) {
        const key = deliveryKey(hit);
        if (delivered.has(key)) continue;
        if (delivered.has(unopenableLedgerKey(build, key))) continue;
        const pending = unfetchable.get(key);
        if (pending && passIndex < pending.notBeforePass) { undelivered.add(hit.key); continue; }
        try {
          const capsule = fetchCapsule ? await fetchCapsule(hit) : null;
          if (fetchCapsule && capsule == null) {
            noteUnfetchable(key, hit);
            undelivered.add(hit.key);
            continue;
          }
          await onIntro({ ...hit, capsule });
          unfetchable.delete(key);
          delivered.set(key, hit.epoch);
          deliveries += 1;
        } catch (error) {
          if (error?.code === 'INTRO_REPLAY') {
            delivered.set(key, hit.epoch);
            replays += 1;
            continue;
          }
          if (error?.code === 'INTRO_NOT_MINE') {
            delivered.set(key, hit.epoch);
            unopenable += 1;
            continue;
          }
          if (error?.code === 'INTRO_UNOPENABLE') {
            delivered.set(unopenableLedgerKey(build, key), hit.epoch);
            unopenable += 1;
            continue;
          }
          onError(error);
          undelivered.add(hit.key);
        }
      }

      for (const [ledgerKey, ledgerEpoch] of [...delivered]) {
        const held = parseUnopenableLedgerKey(ledgerKey);
        if (!held || held.build === String(build ?? '')) continue;
        delivered.delete(ledgerKey);
        if (delivered.has(held.key)) continue;
        const hit = { epoch: held.epoch, bucket: held.bucket, entryId: held.entryId };
        const pending = unfetchable.get(held.key);
        if (pending && passIndex < pending.notBeforePass) { delivered.set(ledgerKey, ledgerEpoch); continue; }
        try {
          const capsule = fetchCapsule ? await fetchCapsule(hit) : null;
          if (fetchCapsule && capsule == null) { noteUnfetchable(held.key, hit); delivered.set(ledgerKey, ledgerEpoch); continue; }
          await onIntro({ ...hit, capsule });
          delivered.set(held.key, held.epoch);
          deliveries += 1;
        } catch (error) {
          if (error?.code === 'INTRO_REPLAY' || error?.code === 'INTRO_NOT_MINE') { delivered.set(held.key, held.epoch); continue; }
          if (error?.code === 'INTRO_UNOPENABLE') { delivered.set(unopenableLedgerKey(build, held.key), held.epoch); continue; }
          delivered.set(ledgerKey, ledgerEpoch);
          onError(error);
        }
      }

      const nextCursors = new Map(result.cursors);
      for (const key of undelivered) {
        if (cursors.has(key)) nextCursors.set(key, cursors.get(key));
        else nextCursors.delete(key);
      }

      const seenHighest = result.stats.highestLiveBucket ?? -1;
      const seenDistinct = result.stats.distinctLiveBuckets ?? 0;
      const nextMeta = {
        ...meta,
        liveBuckets: plan.full ? result.stats.live : Math.max(meta.liveBuckets ?? 0, result.stats.live),
        distinctLiveBuckets: plan.full ? seenDistinct : Math.max(meta.distinctLiveBuckets ?? 0, seenDistinct),
        liveBucketIndices: plan.full
          ? (result.stats.liveBucketIndices ?? [])
          : [...new Set([...(meta.liveBucketIndices ?? []), ...(result.stats.liveBucketIndices ?? [])])]
            .sort((a, b) => a - b),
        highestLiveBucket: plan.full ? seenHighest : Math.max(meta.highestLiveBucket ?? -1, seenHighest),
        lastFullSweepAt: plan.full ? now() : (meta.lastFullSweepAt ?? 0),
        lastPassAt: now(),
        recordsPerDay: (() => {
          const previous = Math.max(0, Number(meta.recordsPerDay ?? 0));
          const elapsedMs = Math.max(1, now() - Number(meta.lastPassAt ?? now()));
          const decay = Math.exp(-Math.min(elapsedMs, 7 * 86_400_000) / 86_400_000);
          return previous * decay + Math.max(0, Number(result.stats.candidates ?? 0));
        })(),
      };

      const oldestUseful = currentEpoch - INTRO_SCAN_EPOCHS_BACK;
      await store.save(pruneCursors(nextCursors, result.keyEpochs, oldestUseful, { sawWholeWindow: plan.full }));
      await store.saveDelivered?.(pruneDelivered(delivered, oldestUseful));
      await store.saveMeta(nextMeta);

      lastStats = {
        ...result.stats,
        delivered: deliveries,
        replays,
        unfetchable: unfetchable.size,
        plan: {
          full: plan.full,
          intervalMs: plan.intervalMs,
          estimatedDailyBytes: plan.estimatedDailyBytes,
          records: plan.records,
        },
      };
      return { hits: result.hits.length, delivered: deliveries, stats: lastStats, nextIntervalMs: plan.intervalMs };
    } finally {
      passInFlight = false;
    }
  }

  function schedule(ms) {
    if (stopped) return;
    clearTimer(timer);
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
      next = Math.min(DEFAULT_POLICY.maxIntervalMs, DEFAULT_POLICY.minIntervalMs * 4);
    }
    schedule(next);
  }

  return {
    async start() {
      if (running) return;
      running = true; stopped = false;
      await tick();
    },
    stop() {
      stopped = true; running = false;
      clearTimer(timer);
      timer = null;
    },
    async refreshNow() {
      const outcome = await runPass({ force: true });
      if (outcome) schedule(outcome.nextIntervalMs);
      return outcome;
    },
    get isRunning() { return running; },
    get lastStats() { return lastStats; },
  };
}
