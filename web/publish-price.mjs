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
// So the client always attaches the deploy figure. There is nothing to read, nothing to infer, and nothing an
// attacker can forge into a wrong decision. The user needs the headroom in their wallet for one block; they do
// not spend it.
//
// These mirror contract constants BY HAND, because the modules that need them must load in a browser and cannot
// import the compiled wrappers. tests/publish-price.test.ts pins every one of them against the .tact sources and
// against the live getters, so a drift is loud rather than a refused publish in production.

/** RS_MIN_VALUE — what a publish into an EXISTING RecordShard must bring. Steady state. */
export const CONV_MIN_VALUE = 13_400_000n;
/** RS_DEPLOY_MIN_VALUE — what the FIRST publish must bring; also what a client should always attach. */
export const CONV_PUBLISH_VALUE = 16_900_000n;

/** IS_MIN_VALUE — what an intro into an EXISTING IntroShard must bring. */
export const INTRO_MIN_VALUE = 13_110_000n;
/** IS_DEPLOY_MIN_VALUE — what the first intro must bring; also what a client should always attach. */
export const INTRO_PUBLISH_VALUE = 15_610_000n;

/**
 * What to attach to a publish on the given lane. Takes no state and asks nothing of the chain, on purpose —
 * see the note above for why every state-derived rule is either an extra round trip or forgeable.
 */
export function publishValueFor(lane) {
  if (lane === 'conv') return CONV_PUBLISH_VALUE;
  if (lane === 'intro') return INTRO_PUBLISH_VALUE;
  throw new Error(`publishValueFor: unknown lane "${lane}" (expected "conv" or "intro")`);
}
