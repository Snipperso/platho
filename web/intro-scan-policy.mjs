
export const INTRO_SAFE_CAP = 8000;
export const BYTES_PER_BUCKET_ASKED = 57;
export const BYTES_PER_BUCKET_LIVE = 439;
export const BYTES_PER_RECORD = 47;

export const HOT_EPOCHS = 3;
export const WINDOW_EPOCHS = 10;

export const DEFAULT_POLICY = {
  budgetBytesPerDay: 30 * 1024 * 1024,
  minIntervalMs: 60_000,
  maxIntervalMs: 60 * 60_000,
  fullSweepEveryMs: 6 * 60 * 60_000,
  hotMarginBuckets: 4,
  requestShare: 0.2,
  requestPaceMs: 1_380,
};

export const liveBucketsFor = (introsPerDay) => Math.max(1, Math.ceil(introsPerDay / INTRO_SAFE_CAP));

export function passCostBytes({ asked, live, epochs = 1, records = 0 }) {
  return epochs * asked * BYTES_PER_BUCKET_ASKED
    + live * BYTES_PER_BUCKET_LIVE
    + Math.max(0, Number(records) || 0) * BYTES_PER_RECORD;
}

export const recordBytesPerDay = (recordsPerDay) => Math.max(0, Number(recordsPerDay) || 0) * BYTES_PER_RECORD;

export function planIntroScan({
  distinctLiveBuckets = 0,
  liveBucketIndices = null,
  liveBuckets = 0,
  readSpace,
  currentEpoch = null,
  msSinceFullSweep = Infinity,
  recordsPerDay = 0,
  policy = {},
} = {}) {
  const p = { ...DEFAULT_POLICY, ...policy };
  if (!Number.isInteger(readSpace) || readSpace < 1) throw new Error('planIntroScan requires readSpace');

  const full = msSinceFullSweep >= p.fullSweepEveryMs;
  const hotTo = full
    ? readSpace
    : Math.min(readSpace, Math.max(1, distinctLiveBuckets + p.hotMarginBuckets));

  const epochs = full ? WINDOW_EPOCHS : HOT_EPOCHS;
  const asked = hotTo;
  const live = Math.min(liveBuckets, hotTo * epochs) * (full ? 1 : HOT_EPOCHS / WINDOW_EPOCHS);
  const cost = passCostBytes({ asked, live, epochs });

  const sweepsPerDay = 86_400_000 / p.fullSweepEveryMs;
  const fullCost = passCostBytes({ asked: readSpace, live: liveBuckets, epochs: WINDOW_EPOCHS });
  const hotCost = full
    ? passCostBytes({
      asked: Math.min(readSpace, Math.max(1, distinctLiveBuckets + p.hotMarginBuckets)),
      live: Math.min(liveBuckets, readSpace * HOT_EPOCHS) * (HOT_EPOCHS / WINDOW_EPOCHS),
      epochs: HOT_EPOCHS,
    })
    : cost;
  const recordsBytes = recordBytesPerDay(recordsPerDay);
  const hotBudget = Math.max(0, p.budgetBytesPerDay - sweepsPerDay * fullCost - recordsBytes);
  const recordsOverBudget = recordsBytes >= Math.max(0, p.budgetBytesPerDay - sweepsPerDay * fullCost);

  const affordablePassesPerDay = hotCost > 0 ? hotBudget / hotCost : Infinity;
  const byteIntervalMs = Number.isFinite(affordablePassesPerDay) && affordablePassesPerDay > 0
    ? Math.min(p.maxIntervalMs, Math.max(p.minIntervalMs, Math.round(86_400_000 / affordablePassesPerDay)))
    : (affordablePassesPerDay === 0 ? p.maxIntervalMs : p.minIntervalMs);
  const hotRequests = 1 + Math.max(0, Math.floor(Number(distinctLiveBuckets) || 0));
  const requestIntervalMs = Number(p.requestShare) > 0 ? Math.ceil(hotRequests * Number(p.requestPaceMs) / Number(p.requestShare)) : 0;
  const intervalMs = Math.min(p.maxIntervalMs, Math.max(byteIntervalMs, requestIntervalMs));

  const epochRange = currentEpoch === null ? null : (full
    ? { from: currentEpoch - (WINDOW_EPOCHS - 2), to: currentEpoch + 1 }
    : { from: currentEpoch - 1, to: currentEpoch + 1 });

  const extraBuckets = full ? [] : (liveBucketIndices ?? []).filter((b) => b >= hotTo && b < readSpace);

  return {
    full,
    epochs: epochRange,
    epochCount: epochs,
    buckets: { from: 0, to: hotTo },
    extraBuckets,
    intervalMs,
    estimatedPassBytes: cost,
    estimatedDailyBytes: Math.round(cost * (86_400_000 / intervalMs) + sweepsPerDay * fullCost + recordsBytes),
    records: {
      perDay: Math.max(0, Number(recordsPerDay) || 0),
      bytesPerDay: Math.round(recordsBytes),
      overBudget: recordsOverBudget,
    },
  };
}
