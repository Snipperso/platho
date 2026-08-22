// intro-bucket — WHICH bucket a first contact is written into. The write-side twin of intro-scan-policy.mjs.
//
// Until now no such rule existed anywhere. `bucket` was a required argument that both publish builders passed
// straight into the shard address, no default and no derivation, and no shipping code ever called them — so the
// only callers were tests passing literals. That is a comfortable place to be exactly once: the first line that
// chooses a bucket for real decides the shape of the network, and some of the choices are irreversible.
//
// ═══ WHY THE RULE MUST NOT BE A SCHEDULE ═══
//
// The obvious design is a schedule: "this week we use N buckets, next week 2N as load grows". It cannot work
// here, and the reason is the founding rule rather than any detail of TON. There is no server, no relay and no
// coordination channel, so every one of thousands of independently-updating app installs would have to compute
// the same N by itself — from observations they do not share. A client that scanned at a different hour sees a
// different fill; one that was offline for a week sees nothing; a fresh install has no history at all; and
// "next week" begins at a different second on every device clock.
//
// The failure that disagreement produces is the worst one this project has. Alice's client writes to bucket 12;
// the contract ACCEPTS it, charges the fee and returns her change, so her wallet reports success. Bob's client,
// on an older build, reads buckets 0..7 and never derives that address. No error, no bounce, no gap in any
// sequence. A week later the shard is retired and the evidence is gone, and gate 13684 has long since closed
// the epoch so it cannot even be retried.
//
// So the rule below OBSERVES instead of scheduling. Every client derives the same answer from the same chain
// state, with no parameter to agree on, no week boundary and no version-dependent constant. A client acting on
// stale information picks a bucket that has since filled, the contract refuses it in COMPUTE (gate 13680), and
// the client moves up one — which is a bounced, refunded retry rather than a silent loss.
//
// ═══ WHY DENSELY FROM THE BOTTOM ═══
//
// Spreading writes uniformly would maximise the number of LIVE buckets, and a recipient must look at every live
// bucket of every epoch in its window. Packing from the bottom keeps that count minimal for everybody, and it
// costs nothing in privacy: the bucket index says nothing about the recipient either way, who is hidden behind
// the stealth view_tag. intro-scan-policy.mjs has recommended this in prose since it was written; this is the
// code that finally does it.

import { INTRO_READ_SPACE } from './shard-discovery.mjs?v=21';
import { INTRO_SAFE_CAP } from './intro-scan-policy.mjs?v=1';

/**
 * How much room a bucket must still have before we will write into it.
 *
 * Not zero, because several senders choose concurrently from the same chain state and none of them can see the
 * others' in-flight messages. Without headroom the last few slots of a bucket would be a thundering herd, and
 * every loser gets a bounce instead of a delivery. 64 is generous against IS_SAFE_CAP's 8000 (0.8%) and costs
 * only that the bucket rolls over a hair early.
 */
export const INTRO_BUCKET_HEADROOM = 64;

/**
 * The lowest bucket of `epoch` that still has room, which is where this first contact belongs.
 *
 * `readBucketFill(epoch, bucket)` must resolve to how many intros that shard already holds — its `next_id` —
 * and 0 for a shard that does not exist yet. In practice this is one read: at any plausible launch volume the
 * whole network's daily first contacts fit in bucket 0, and IS_SAFE_CAP is 8000 per bucket per day.
 *
 * `skip` lets a caller exclude buckets it has already been refused from, so a retry after gate 13680 walks
 * upward instead of hammering the same full shard.
 */
export async function chooseIntroBucket({
  epoch,
  readBucketFill,
  readSpace = INTRO_READ_SPACE,
  headroom = INTRO_BUCKET_HEADROOM,
  skip = new Set(),
} = {}) {
  if (!Number.isInteger(epoch)) throw new Error('chooseIntroBucket requires an integer epoch');
  if (typeof readBucketFill !== 'function') throw new Error('chooseIntroBucket requires readBucketFill');

  for (let bucket = 0; bucket < readSpace; bucket += 1) {
    if (skip.has(bucket)) continue;
    const fill = Number((await readBucketFill(epoch, bucket)) ?? 0);
    if (!Number.isFinite(fill) || fill < 0) throw new Error(`readBucketFill returned ${fill} for bucket ${bucket}`);
    if (fill + headroom <= INTRO_SAFE_CAP) return bucket;
  }

  // Every bucket of the read space is full. That is readSpace x IS_SAFE_CAP first contacts in one day —
  // 8.2 million at the current numbers — and the honest answer is to say so rather than write somewhere nobody
  // reads. Widening INTRO_READ_SPACE is possible without redeploying anything, but readers must ship first.
  throw new Error(`every one of ${readSpace} INTRO buckets for epoch ${epoch} is full`);
}

/**
 * Refuse a bucket the readers will never look at.
 *
 * THE SINGLE HIGHEST-VALUE GUARD IN THIS FILE. IntroShard.init accepts any uint32 bucket and no contract gate
 * looks at it, while every reader is clamped to INTRO_READ_SPACE — so a publish to bucket 1024 or above is
 * accepted, paid for, and then read by nobody, for ever. Nothing rejected it anywhere before this: not the
 * builders, not the contract, not a test.
 *
 * It throws rather than clamping. Silently rewriting a caller's bucket would produce a message that goes
 * somewhere the caller did not ask for, which is the same class of surprise one step removed.
 */
export function assertReadableBucket(bucket, readSpace = INTRO_READ_SPACE) {
  const value = typeof bucket === 'bigint' ? bucket : BigInt(bucket ?? -1);
  if (value < 0n || value >= BigInt(readSpace)) {
    throw new Error(
      `INTRO bucket ${value} is outside the read space of ${readSpace} — no recipient would ever scan it`,
    );
  }
  return value;
}
