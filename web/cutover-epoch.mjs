// cutover-epoch — the clean-17 -> clean-18 boundary, baked into the build.
//
// 🔴 CUTOVER: contracts18/docs/CUTOVER.md items 6 and 7. The written plan says "an epoch boundary baked into
// both client versions", and until 2026-08-31 no such constant existed anywhere — the generation switch would
// have been install-time (whenever the service worker happened to update), which splits one conversation-day
// across two shard generations mid-epoch. This module is the boundary's single home; everything that must act
// differently across the flip asks HERE and nowhere else.
//
// HOW THE FLIP USES THESE TWO LITERALS, and why null is the shipped state:
//   * Today (every 1.3.x release): CUTOVER_EPOCH = null, WRITES_GENERATION = 17. Every helper below collapses
//     to "generation 17, nothing blocked" — byte-equivalent to the app before this module existed.
//   * The BOUNDARY release (ships BEFORE the flip, still a clean-17 client): sets CUTOVER_EPOCH = E (the epoch
//     number chosen at the seal), keeps WRITES_GENERATION = 17. From epoch E this build refuses to write and
//     shows the update screen: its writes would land in clean-17 shard addresses that clean-18 readers derive
//     for epochs < E only — a write nobody will ever read, reported as success. Refusing loudly is the whole
//     point (the silent-loss shape this codebase refuses).
//   * The FLIP release (the clean-18 client): keeps CUTOVER_EPOCH = E, sets WRITES_GENERATION = 18. Before E it
//     writes clean-17 exactly like its predecessor; from E it writes clean-18. Readers use generationForEpoch
//     per epoch/era to walk the right generation for the retention window (CUTOVER.md item 3), which is how the
//     INTRO sweep stays at its 10,240 addresses with no doubling — each epoch belongs to exactly ONE generation
//     [OWNER 2026-08-31, item 7 ruling].
//
// THE EPOCH is the conversation-day epoch every lane already uses: floor(unixSeconds / 86400), UTC. E is
// defined AT an epoch boundary by construction, so CONV and INTRO partitions (keyed by this epoch) never
// straddle it; PublicShard eras can straddle E and the one straddling era is dual-read (item 3's concern, not
// this module's).

/** The boundary epoch E. null = no boundary announced; the boundary release replaces this with a literal. */
export const CUTOVER_EPOCH = null;

/** Which shard generation THIS build writes. The flip release changes 17 -> 18 in the same commit that wires
 *  its writers; nothing else may read this to decide a WRITE path — writers flip together or not at all. */
export const WRITES_GENERATION = 17;

/** The conversation-day epoch for a wall-clock instant: floor(unixSeconds / 86400), UTC. */
export function currentEpochUtc(nowMs = Date.now()) {
  return Math.floor(nowMs / 86400000);
}

/**
 * The pure core, boundary injected — what the tests exercise with real values while the shipped wrapper stays
 * inert. One rule, total: every epoch strictly before the boundary is clean-17, everything from it on is
 * clean-18, and "no boundary" means the world is clean-17.
 */
export function generationForEpochAt(epoch, boundary) {
  // A BOUNDARY THAT IS NOT A REAL EPOCH MEANS "NO BOUNDARY", not "everything is clean-18" [audit 2026-09-01,
  // round 14]. This guarded `boundary === null` alone, so every other falsy value fell through to the comparison
  // and `epoch < 0` / `< false` / `< ''` / `< NaN` are all FALSE — MEASURED: 0, false, '' and NaN each flipped
  // the CONV write digest from its 352-bit clean-17 shape to the 384-bit clean-18 one. Unreachable while
  // CUTOVER_EPOCH is null, but the flip release bakes a number here, and a `0` placeholder in that edit would
  // sign EVERY CONV write in the network for a shard that does not exist yet — refused 13654, network-wide, on
  // the one day nobody can roll back. The epoch side of this same function already carries this guard.
  if (!Number.isFinite(boundary) || boundary <= 0) return 17;
  return epoch < boundary ? 17 : 18;
}

/** Which generation owns the given epoch under the BAKED boundary. Readers walk shard addresses per epoch
 *  through this; writers compare it with WRITES_GENERATION. */
export function generationForEpoch(epoch) {
  return generationForEpochAt(epoch, CUTOVER_EPOCH);
}

/** The pure core of the update gate: a build must stop writing the moment the current epoch's generation is
 *  newer than what it writes — its writes would be unreadable, reported as success. */
export function cutoverUpdateRequiredAt(nowMs, boundary, writesGeneration) {
  return generationForEpochAt(Math.floor(nowMs / 86400000), boundary) > writesGeneration;
}

/** Is THIS build past its own generation? true = show the update screen, refuse sends, stop the intro sweep.
 *  With the shipped CUTOVER_EPOCH = null this is false forever — the gate is dormant until the boundary
 *  release bakes E. */
export function cutoverUpdateRequired(nowMs = Date.now()) {
  return cutoverUpdateRequiredAt(nowMs, CUTOVER_EPOCH, WRITES_GENERATION);
}

/**
 * Which generations can hold the writes of ONE PublicShard era — the pure core, boundary injected.
 *
 * Eras are longer than a day (30 days for CHANNEL/THREAD, a year for BEACON/AVATAR), so unlike the daily epochs
 * — where E sits ON an epoch boundary by construction and no CONV/INTRO partition ever straddles it — one era
 * CAN contain writes from both sides of the flip: pre-E writes sit in the clean-17 era-shard, post-E writes in
 * the clean-18 shard OF THE SAME era index. A reader of that one straddling era must probe both addresses;
 * every other era belongs to exactly one generation. Ascending order, so [17, 18] reads oldest-first.
 */
export function generationsForEraAt(eraLengthSeconds, eraIndex, boundary) {
  // THE TWIN OF generationForEpochAt'S GUARD, and it was missing [audit 2026-09-02]. That function was hardened
  // in round 14 against a boundary that is not a real epoch; this one still tested `boundary === null` alone, so
  // every other non-boundary fell through to the arithmetic below. MEASURED, all of them: 0, false, '' and -1
  // each returned [18] — every era resolved to a generation whose shards do not exist yet, which is an EMPTY
  // PUBLIC FEED for everyone, network-wide; NaN and undefined returned [17, 18], doubling every read address
  // instead. Unreachable while CUTOVER_EPOCH is null, exactly as its twin was — and the flip release bakes a
  // number here, on the one day nobody can roll back.
  if (!Number.isFinite(boundary) || boundary <= 0) return [17];
  const boundarySec = boundary * 86400;
  const startSec = eraIndex * eraLengthSeconds;
  const endSec = (eraIndex + 1) * eraLengthSeconds;
  if (endSec <= boundarySec) return [17];
  if (startSec >= boundarySec) return [18];
  return [17, 18];
}

/** The era's generations under the BAKED boundary. The PUBLIC read sweeps expand each era through this —
 *  one address per returned generation — so the straddling era costs one extra address for one era length,
 *  and every fully-old or fully-new era stays a single probe. Shipped boundary null = always [17]. */
export function generationsForEra(eraLengthSeconds, eraIndex) {
  return generationsForEraAt(eraLengthSeconds, eraIndex, CUTOVER_EPOCH);
}

/** The generation that owns a WRITE happening at this wall-clock instant (unix SECONDS — the chain-time unit
 *  the lanes carry). This is what the PUBLIC writer and its room probe ask: within the straddling era, pre-E
 *  writes belong to the clean-17 era-shard and post-E writes to the clean-18 shard of the SAME era index, so
 *  write-time — never era index — picks the writer's generation. */
export function generationForUnixSeconds(unixSeconds) {
  return generationForEpoch(Math.floor(unixSeconds / 86400));
}
