// publish-price — what a client must attach to a publish, and why the answer is "always the deploy figure".
//
// THE PROBLEM THIS SOLVES. Since the eviction bounty was replaced by a per-shard retirement endowment, the
// publish gates are STATE-DEPENDENT: a shard charges more for the publish that creates it than for the ones
// after it.
//
//     RecordShard  gate 13652:  value >= (record_count == 0 ? RS_DEPLOY_MIN_VALUE : RS_MIN_VALUE)
//     IntroShard   gate 13682:  value >= (next_id      == 0 ? IS_DEPLOY_MIN_VALUE : IS_MIN_VALUE)
//
// The obvious client rule — "pay the deploy figure when the account is absent, otherwise the steady one" — is
// WRONG, and cheaply so. Account-absence is not a trustworthy signal: anyone can create a shard for the price of
// a bare value message through its catch-all `receive()`, leaving an account that EXISTS while its entry count
// is still 0. A client reading absence would then attach the steady figure, be refused by the gate, and see its
// send bounce — a denial of service for a few thousandths of a GRAM per shard-day, on a lane where the bucket
// space is public and every address is derivable by anyone.
//
// THE RULE THAT NEEDS NO SIGNAL AT ALL. MEASURED 2026-07-19: attaching the deploy figure to a publish into a
// shard that already exists costs nothing — the reserve keeps only what it needs and mode-128 returns the rest.
//     first publish  at 16_900_000: accepted, 293_473 of the payer's own gas on top
//     later publish  at 16_900_000: accepted, 3_137_794 CAME BACK
// (Those two lines are the ORIGINAL measurement at the then-current price; the figures below have since risen
//  twice as RS_FEE_TRANSPORT grew to carry the airdrop credit. The PROPERTY they established — that attaching
//  the deploy figure to an existing shard costs nothing, because mode-128 returns the surplus — is unchanged.)
// So the client always attaches the deploy figure. There is nothing to read, nothing to infer, and nothing an
// attacker can forge into a wrong decision. The user needs the headroom in their wallet for one block; they do
// not spend it.
//
// These mirror contract constants BY HAND, because the modules that need them must load in a browser and cannot
// import the compiled wrappers. [STALE FOR A DAY, 2026-07-20..21] RS_FEE_TRANSPORT rose twice to carry the
// airdrop credit and these four figures were not moved with it, so the client attached 13_400_000 against a
// gate demanding 15_600_000 — every publish refused. PP-01 caught it exactly as the next sentence promises;
// what failed was propagation, not detection. tests/publish-price.test.ts pins every one of them against the .tact sources and
// against the live getters, so a drift is loud rather than a refused publish in production.

/** RS_MIN_VALUE — what a publish into an EXISTING RecordShard must bring. Steady state. */
export const CONV_MIN_VALUE = 15_600_000n;
/** RS_DEPLOY_MIN_VALUE — what the FIRST publish must bring; also what a client should always attach. */
export const CONV_PUBLISH_VALUE = 19_100_000n;

/** IS_MIN_VALUE — what an intro into an EXISTING IntroShard must bring. */
export const INTRO_MIN_VALUE = 15_310_000n;
/** IS_DEPLOY_MIN_VALUE — what the first intro must bring; also what a client should always attach. */
export const INTRO_PUBLISH_VALUE = 17_810_000n;

/**
 * RS_MIN_VALUE — required on EVERY recovery write (gate 13572), NOT just the first: it is RS_RECOVERY_ENDOWMENT
 * (29_000_000, the ~3-year on-chain rent float) + RS_RECOVERY_PATH_GAS, and the first bind retains the endowment while
 * an overwrite returns the surplus. So one figure covers both cases. Pinned == 37_000_000 by tests/publish-builder.test.ts.
 */
export const RECOVERY_PUBLISH_VALUE = 37_000_000n;

/**
 * KS_MIN_REGISTER_VALUE — what a FIRST KeyShard register must bring (gate 22110): KS_BASE_ENDOWMENT (45_000_000, the
 * account's rent float, reserved and held) + KS_REGISTER_GAS (12_000_000) = 57_000_000. The shard reserves the base and
 * mode-SendRemainingBalance returns the surplus, so a small margin over the floor (import fee headroom) is free — an
 * overpay is refunded and a replace (min = KS_REGISTER_GAS) is amply covered by the same figure. Pinned by publish-price.test.ts.
 */
export const KEYSHARD_REGISTER_VALUE = 60_000_000n;

/**
 * What to attach to a publish on the given lane. Takes no state and asks nothing of the chain, on purpose —
 * see the note above for why every state-derived rule is either an extra round trip or forgeable.
 */
export function publishValueFor(lane) {
  if (lane === 'conv') return CONV_PUBLISH_VALUE;
  if (lane === 'intro') return INTRO_PUBLISH_VALUE;
  if (lane === 'recovery') return RECOVERY_PUBLISH_VALUE;
  if (lane === 'keyshard-register') return KEYSHARD_REGISTER_VALUE;
  throw new Error(`publishValueFor: unknown lane "${lane}" (expected "conv", "intro", "recovery" or "keyshard-register")`);
}

// PublicShard deploy figures per KIND (0 CHANNEL, 1 THREAD, 2 BEACON, 3 AVATAR) — PS_DEPLOY_MIN_VALUE. Same
// "always attach the deploy figure" rule as CONV/INTRO: the shard keeps only what it needs and mode-128 returns the
// surplus, so a client that always pays this is never refused and never overspends. CHANNEL and THREAD share the
// post endowment (30-day era, 1-year retention); BEACON funds a 1-year era, AVATAR a 3-year retention.
// MEASURED against get_view.deploy_min_value; pinned in tests/public-lane-price.test.ts against the live getter so a
// contract drift is a red test, not a refused publish.
// [RAISED 2026-07-24 with PS_BASE_ENDOWMENT_* — was 19_300_000 / 19_300_000 / 23_900_000 / 28_700_000. The old
//  PublicShard base endowments were measured INSOLVENT at today's rate (AVATAR 0.88x, BEACON 0.85x — the shard froze
//  before its retention expired and the avatar/beacon was lost). Raising the contract's base endowment raises
//  deploy_min_value by the same amount, so these MUST move together: a client still sending the old figure is
//  refused by gate 13704 on every first publish.]
export const PUBLIC_CHANNEL_PUBLISH_VALUE = 20_300_000n;
export const PUBLIC_THREAD_PUBLISH_VALUE = 20_300_000n;
export const PUBLIC_BEACON_PUBLISH_VALUE = 31_400_000n;
export const PUBLIC_AVATAR_PUBLISH_VALUE = 39_200_000n;

const PUBLIC_PUBLISH_VALUE_BY_KIND = Object.freeze({
  0: PUBLIC_CHANNEL_PUBLISH_VALUE,
  1: PUBLIC_THREAD_PUBLISH_VALUE,
  2: PUBLIC_BEACON_PUBLISH_VALUE,
  3: PUBLIC_AVATAR_PUBLISH_VALUE,
});

/** The deploy figure to attach to a PublicShard publish of the given KIND (0..3). */
export function publicPublishValueForKind(kind) {
  const value = PUBLIC_PUBLISH_VALUE_BY_KIND[Number(kind)];
  if (value === undefined) throw new Error(`publicPublishValueForKind: unknown PublicShard kind ${kind} (expected 0..3)`);
  return value;
}
