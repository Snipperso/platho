// intro-scan-policy — how often to scan, and how much of the bucket space to look at each time.
//
// WHY A POLICY MODULE AT ALL. The receive path's cost is not a constant, it is a function of network traffic, and
// getting that function wrong in either direction is a product failure: too eager and a phone burns hundreds of
// megabytes a day, too lazy and a first contact takes an hour to arrive. The arithmetic below is small but it is
// the thing that decides whether the lane is usable, so it lives in one place with its measurements attached.
//
// MEASURED INPUTS (live toncenter v3, 2026-07-18):
//   - Asking about a bucket costs ~57 B UP (its address in the request URL) whether or not it exists.
//   - A bucket that exists costs ~439 B DOWN. One that does not costs zero.
//   - Up to 1149 addresses fit one request (64 KiB URL wall).
//
// THE "COSTS ZERO" RULE IS NARROWER THAN IT READS, re-probed against the live endpoint 2026-07-19. What is
// omitted is an address the indexer has NEVER SEEN. An address that was touched at some point and is now empty
// comes back as a full `uninit` row costing ~525 B — nearly as much as the ~654 B of a live one. Measured with
// three addresses in one request: a never-touched address returned no row at all, while an address with a
// transaction history returned `status: "uninit"` with balance, hashes and lt.
//
// That matters because a RETIRED shard has a transaction history and will therefore keep returning a row. It
// does not touch this budget only because retirement is deliberately placed OUTSIDE the scan window: an INTRO
// shard of epoch E leaves the window at (E+9)*86400 and becomes retireable at (E+13)*86400 — the four epochs of
// IS_RETIRE_SLACK. A scanner never asks about a shard that could be gone. If that slack is ever reduced, this
// cost reappears in every pass, on top of the silent-loss risk the slack exists to prevent.
//
// THE TWO LEVERS, and they compose:
//
// 1. TIERED RANGE. Live buckets are ceil(daily_intros / IS_SAFE_CAP), not the whole read space — at 8000 intros a
//    day network-wide that is ONE bucket. So the frequent poll covers only the range where a sender might
//    plausibly write, and the full read space is swept rarely, purely to notice someone writing above that range.
//    At launch this is the difference between 0.8 MB/day and 84 MB/day for minute-fresh contact, because the
//    dominant cost of a wide poll is the request URL, which is paid even when every bucket is empty.
//
// 2. ADAPTIVE INTERVAL. Once the network is large the frequent poll is genuinely expensive, and no arrangement of
//    ranges fixes that — a scanner must look at every live bucket. So the interval is derived from a byte budget
//    rather than fixed: minute-fresh while it is affordable, degrading smoothly as traffic grows.
//
// A NOTE ON THE WRITE SIDE, because it is what makes tier 1 work: senders should pack buckets DENSELY FROM THE
// BOTTOM, moving up only as one approaches IS_SAFE_CAP. Spreading uniformly would maximise the live-bucket count
// and therefore the scan cost for everyone. It costs nothing in privacy — the bucket index carries no information
// about the recipient either way — so there is no reason to spread.

export const INTRO_SAFE_CAP = 8000;          // mirrors IS_SAFE_CAP in contracts/IntroShard.tact
export const BYTES_PER_BUCKET_ASKED = 57;    // measured: the address in the request URL
export const BYTES_PER_BUCKET_LIVE = 439;    // measured: one account in an include_boc=false response

// Defaults chosen to feel instant while staying small; every one of them is a product knob, not a law.
// The window is ten epochs, but only three of them can still CHANGE: the publish gate (13684) accepts a shard
// whose epoch is now +/-1, and anything older is closed to writes forever. So the frequent pass polls only
// [C-1, C+1] and the rest of the window is covered by the slower full sweep. Skipping the frozen epochs is worth
// ~3.4x on the hot pass and costs nothing — a frozen shard cannot acquire a new intro to miss.
export const HOT_EPOCHS = 3;
export const WINDOW_EPOCHS = 10;

export const DEFAULT_POLICY = {
  budgetBytesPerDay: 30 * 1024 * 1024,   // what the scan may spend on a phone in a day
  minIntervalMs: 60_000,                 // never poll faster than this, however cheap it looks
  maxIntervalMs: 60 * 60_000,            // never slower than this, however expensive
  fullSweepEveryMs: 30 * 60_000,         // the safety net that notices writes above the hot range
  hotMarginBuckets: 4,                   // headroom above the highest live bucket seen
};

/** How many buckets the network can be expected to be using, from its daily first-contact volume. */
export const liveBucketsFor = (introsPerDay) => Math.max(1, Math.ceil(introsPerDay / INTRO_SAFE_CAP));

/**
 * What one pass costs, in bytes.
 *
 * `epochs` IS NOT OPTIONAL DECORATION. A scan pass covers the whole retention window — ten epochs — and asks about
 * every bucket of EVERY one of them, because an intro published on any day of that window is still live. An
 * earlier revision of this model counted a single epoch and therefore understated every cost, and every interval
 * derived from it, by up to 10x: it advertised 0.8 MB/day at launch where the real figure was 6.5 MB, and
 * reported a 30 MiB budget as met while the pass actually spent 284 MiB. A phone on a metered plan would have
 * paid ten times what this module promised.
 */
export function passCostBytes({ asked, live, epochs = 1 }) {
  return epochs * asked * BYTES_PER_BUCKET_ASKED + live * BYTES_PER_BUCKET_LIVE;
}

/**
 * The scan plan for right now.
 *
 * `highestLiveBucket` is the largest bucket index the client has actually seen in use (-1 if none yet) — it comes
 * from the last full sweep, so the hot range self-corrects without anyone agreeing on anything. `liveBuckets` is
 * how many exist in the window, which the last pass reports directly.
 *
 * Returns the hot range to poll now, the interval until the next poll, and whether this pass should be a full
 * sweep instead. The interval is derived from the budget, so it degrades on its own as the network grows.
 */
export function planIntroScan({
  highestLiveBucket = -1,
  liveBuckets = 0,
  readSpace,
  currentEpoch = null,
  msSinceFullSweep = Infinity,
  policy = {},
} = {}) {
  const p = { ...DEFAULT_POLICY, ...policy };
  if (!Number.isInteger(readSpace) || readSpace < 1) throw new Error('planIntroScan requires readSpace');

  const full = msSinceFullSweep >= p.fullSweepEveryMs;
  const hotTo = full
    ? readSpace
    : Math.min(readSpace, Math.max(1, highestLiveBucket + 1 + p.hotMarginBuckets));

  // A full sweep covers the whole retention window; a hot pass covers only the epochs that can still change.
  const epochs = full ? WINDOW_EPOCHS : HOT_EPOCHS;
  const asked = hotTo;
  // `liveBuckets` is what the last pass saw ACROSS the window, so scale it to the epochs this pass looks at.
  const live = Math.min(liveBuckets, hotTo * epochs) * (full ? 1 : HOT_EPOCHS / WINDOW_EPOCHS);
  const cost = passCostBytes({ asked, live, epochs });

  // How often can we afford this? A pass that costs nothing still respects minIntervalMs — polling faster than a
  // minute buys freshness nobody perceives and costs battery, which no byte budget accounts for.
  const affordablePassesPerDay = cost > 0 ? p.budgetBytesPerDay / cost : Infinity;
  const intervalMs = Number.isFinite(affordablePassesPerDay)
    ? Math.min(p.maxIntervalMs, Math.max(p.minIntervalMs, Math.round(86_400_000 / affordablePassesPerDay)))
    : p.minIntervalMs;

  const epochRange = currentEpoch === null ? null : (full
    ? { from: currentEpoch - (WINDOW_EPOCHS - 2), to: currentEpoch + 1 }
    : { from: currentEpoch - 1, to: currentEpoch + 1 });

  return {
    full,
    epochs: epochRange,
    epochCount: epochs,
    buckets: { from: 0, to: hotTo },
    intervalMs,
    estimatedPassBytes: cost,
    estimatedDailyBytes: Math.round(cost * (86_400_000 / intervalMs)),
  };
}
