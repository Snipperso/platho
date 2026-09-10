// What the NETWORK charges the wallet to send a publish — the term every price quote in this app was missing.
//
// THE DEFECT (owner-measured, 2026-08-16): the private composer quoted 0.0191 GRAM for a minimal message while
// 0.0223 actually left the wallet. 0.0191 is CONV_PUBLISH_VALUE — the value the message CARRIES to the shard. It is
// not what the send costs. The wallet signs with sendMode 3, whose bit 1 means "pay the transfer fees separately",
// so the wallet is additionally charged for importing the signed external, for the gas that runs it, and for
// forwarding each outgoing message. The payload travels TWICE — inbound in the external, outbound to the shard.
//
// The send path already knew this: attemptConvMessagePublishDirect reserves WALLET_FEE_HEADROOM_NANOTONS on top of
// the attached value before it signs. Only the screen did not.
//
// THE COST IS A STEP FUNCTION, NOT A RATE. A first cut charged per byte and the gate killed it (19% over on a
// 3.5 KiB part). A sweep across 21 payload sizes then showed why: a capsule is PADDED to its size class, so every
// payload inside a class costs exactly the same to send, and each class doubles the increment over the one below —
// 0.8M, 1.6M, 3.2M, 6.4M, 12.8M. So the fee is a table keyed by the size class the composer's plan already computes.
// A 4-byte "ok" and a 800-byte note are the same send, and the model now says so instead of interpolating a rate
// that describes neither.
//
// MEASURED, not assumed — AND MEASURED AS THE RIGHT QUANTITY, which it was not until 2026-08-31. Until then the
// table came from `walletTx.totalFees`, the fees on the payer's own transaction. That is not what a send costs a
// wallet: PAY_GAS_SEPARATELY also charges it the forward fee of every outgoing message, and TON keeps only about a
// third of that at the source, where `totalFees` can see it. So every entry was short by the transit remainder —
// 22% at the smallest class, 32% at the largest — and the pre-flight built on it let a fully-funded post land as
// nothing, which is precisely the shape the paragraph below forbids.
//
// tests/wallet-send-fee.test.ts now drives REAL sealed capsules through the REAL builder into a sandbox and
// BRACKETS every quote against the chain from both sides: funded at exactly the quote, every part must land;
// funded at 90% of it, the send must fail. That pair cannot be satisfied by a number that is either too low or
// wildly too high, and it tests the property the user meets rather than a proxy for it. If TON's fee schedule
// moves, that test goes red instead of the user reading a stale number — the failure mode this file exists to end
// (three fee constants in this repo have already outlived the architecture they described).
//
// DIRECTION OF ERROR IS DELIBERATE. Quoting high is honest: the surplus returns. Quoting low promises a send the
// wallet cannot fund, and that is the shape that hurts — the user funds exactly the quoted figure and the send is
// refused for the difference.

import {
  PLATHO_WALLET_CHUNK_EXTERNAL_BYTE_BUDGET,
  PLATHO_WALLET_MAX_MESSAGES_PER_TRANSFER,
  PLATHO_WALLET_MESSAGE_FRAMING_BYTES,
} from './platho-wallet.mjs?v=57';

/**
 * Fixed cost of ONE EXTERNAL: importing it plus the wallet's own compute.
 * Measured 816,190 against a sandbox treasury; raised to cover the ~224,200 by which a treasury understates a real
 * WalletContractV5R1 (sandbox-treasury-is-not-a-wallet) and checked against the owner's on-chain 0.0223.
 */
export const WALLET_SEND_FEE_BASE_NANOTONS = 1_100_000n;

/**
 * Per outgoing publish in the transfer, by capsule size class.
 *
 * RE-MEASURED 2026-08-31 (audit round 9) AGAINST THE WRONG QUANTITY BEFORE THAT. The old figures came from
 * `walletTx.totalFees` — the fees charged to the payer's own TRANSACTION. Under sendMode's PAY_GAS_SEPARATELY the
 * wallet is additionally charged the forward fee of each outgoing message, and TON keeps only about a third of that
 * at the source (inside `totalFees`); the rest rides with the message and is burned on delivery. `totalFees` cannot
 * see it, so every entry was short — and short is the one direction this file's header forbids.
 *
 * WHAT THESE NUMBERS NOW ARE: the balance a wallet must HOLD BEFORE IT SIGNS, which is the question the pre-flight
 * (assertWalletGramAtLeast) actually asks. Not the balance delta — the shard REFUNDS its excess, so a delta is what
 * the user ends up losing and is smaller; funding to it still loses the send. Measured by BISECTING the funding
 * floor: fund a payer with exactly B, send the real sealed capsule through the real builder, and ask whether the
 * publish reached the shard at all. Below the floor sendMode's IGNORE_ERRORS bit drops the action it cannot pay
 * for, THE TRANSACTION STILL SUCCEEDS, and the app reports a publish that does not exist.
 *
 *   class  floor held at signing   minus CONV value   minus the measured base   old table    short by
 *       1          23,650,355          4,550,355            3,727,099          2,272,000    1,178,355
 *       2          24,851,076          5,751,076            4,927,820          3,071,286    1,579,790
 *       4          27,250,546          8,150,546            7,327,290          4,669,858    2,380,688
 *       8          32,041,580         12,941,580           12,118,324          7,867,001    3,974,579
 *      16          41,645,057         22,545,057           21,721,801         14,270,178    7,174,879
 *      32          60,845,704         41,745,704           40,922,448         27,067,641   13,578,063
 *
 * The step-function structure the header describes SURVIVED the correction intact — the increments are
 * 1.20M, 2.40M, 4.79M, 9.60M, 19.20M, each still double the one below. Only the scale was wrong.
 *
 * The base separates cleanly and did NOT move: three part counts of class 1 inside ONE external cost 4,550,355 /
 * 8,277,454 / 12,009,673, a straight line whose intercept is 823,256 — within 0.9% of the 816,190 the base
 * constant above was measured at. So the fixed per-external cost was right all along.
 *
 * Entries are the measured floor rounded UP to the bisection's own 10,000-nanoton resolution, so no entry can sit
 * below what it measured. tests/wallet-send-fee.test.ts WSF-01 now BRACKETS each quote from both sides against the
 * real chain: funded at the quote every part must land, funded at 90% of it the send must fail.
 */
export const WALLET_SEND_FEE_PER_PART_BY_SIZE_CLASS = Object.freeze({
  1: 3_730_000n,
  2: 4_930_000n,
  4: 7_330_000n,
  8: 12_120_000n,
  16: 21_730_000n,
  32: 40_930_000n,
});

/** The smallest class's fee — what a caller pays for a part whose payload is not known yet. */
export const WALLET_SEND_FEE_PER_PART_NANOTONS = WALLET_SEND_FEE_PER_PART_BY_SIZE_CLASS[1];

/**
 * Serialized payload bytes one publish of each size class contributes to the external — the number the wallet's own
 * packer measures (estimateWalletMessageExternalBytes). Measured through the REAL builder; WSF-07 re-derives the
 * external count from these against chunkWalletMessages itself, so a drift here turns a test red rather than a quote
 * low.
 */
export const WALLET_SEND_PAYLOAD_BYTES_BY_SIZE_CLASS = Object.freeze({
  // RE-MEASURED 2026-08-31 (audit round 8) through the real sealer and the real builder — sealConvCapsule at two
  // text lengths inside each band, then buildConvPublishWalletMessage, then the packer's own formula
  // ceil(payload.length * 3 / 4). Classes 2, 8 and 32 were each 2 BYTES LOW. Both lengths in a band give the same
  // number (a capsule is padded to its class), so these are exact, not samples.
  //
  // Two bytes matter because the packer closes a chunk on a THRESHOLD: for the mixed list [8,1,2,8,4,1,2,1,8,2,2]
  // the model said one external while chunkWalletMessages produces two, so the quote was short by one
  // WALLET_SEND_FEE_BASE_NANOTONS (48,472,005 quoted against 49,572,005 honest). A sweep of 400k random mixed
  // lists found 23 such disagreements. Under-quoting is the one direction this module's header forbids.
  1: 2_454,
  2: 3_504,
  4: 5_598,
  8: 9_792,
  16: 18_177,
  32: 35_226,
});

const SIZE_CLASSES = Object.freeze([1, 2, 4, 8, 16, 32]);

/**
 * THE SIZE CLASS FOR A BODY THAT IS NOT A CAPSULE — the recovery blob, the prefs snapshot, anything whose length
 * is known but which never went through capsule-part-policy.
 *
 * [audit 2026-09-01, round 9.] The two self-lanes (conversation-key backup, prefs snapshot) had NO affordability
 * pre-flight at all, and sendMode forces IGNORE_ERRORS, so an underfunded publish was dropped while the wallet's
 * own transaction succeeded — after which the caller cleared its dirty flag and nothing ever retried. MEASURED by
 * bisecting the funding floor against a real RecoveryShard deploy: a FULL slot (28 conversations, 10,485 payload
 * bytes) needs the wallet to hold 52,040,098, while RECOVERY_PUBLISH_VALUE plus the class-8 quote is 51,620,000 —
 * short by 420,098, and short is fatal on a lane nobody reads back.
 *
 * A fixed class would be wrong at both ends: too small for a full slot, and too large for a one-conversation slot,
 * where over-reserving REFUSES a backup that would have succeeded — on the lane whose absence is what makes
 * conversations undecryptable after a reinstall. So the class comes from the body actually built. Rounds UP: the
 * table's entries are what a capsule of that class serializes to, so the smallest entry at or above this body's
 * length is the smallest quote that provably covers it.
 */
export function walletSendSizeClassForPayloadBytes(payloadBytes) {
  const bytes = Number(payloadBytes);
  if (!Number.isFinite(bytes) || bytes <= 0) return SIZE_CLASSES[0];
  for (const sizeClass of SIZE_CLASSES) {
    if (bytes <= WALLET_SEND_PAYLOAD_BYTES_BY_SIZE_CLASS[sizeClass]) return sizeClass;
  }
  return SIZE_CLASSES[SIZE_CLASSES.length - 1];
}

/** The real size class an input maps to: unknown or between-class values round UP to the next real one. */
function normalizedSizeClass(sizeClass) {
  const requested = Number(sizeClass);
  const normalized = Number.isFinite(requested) && requested > 0 ? requested : 1;
  return SIZE_CLASSES.find((value) => value >= normalized) ?? SIZE_CLASSES[SIZE_CLASSES.length - 1];
}

/** Per-part fee for one capsule of `sizeClass`. An unknown class rounds UP to the next real one. */
function perPartFeeNanotons(sizeClass) {
  return WALLET_SEND_FEE_PER_PART_BY_SIZE_CLASS[normalizedSizeClass(sizeClass)];
}

/** Serialized bytes one publish of `sizeClass` contributes to the external it rides in. */
function payloadBytesFor(sizeClass) {
  return WALLET_SEND_PAYLOAD_BYTES_BY_SIZE_CLASS[normalizedSizeClass(sizeClass)];
}

/**
 * How many EXTERNALS these parts will be signed as. One "send" is not one external: sendPlathoWalletTransaction runs
 * the list through chunkWalletMessages, which closes a chunk when the next message would breach the 58,000-byte
 * budget or the 255-message count, and sends each chunk as its own seqno-ordered external. Each of those pays its
 * own import fee and its own compute — so the base is per EXTERNAL, not per send.
 *
 * This mirrors the packer instead of calling it, because calling it would mean synthesizing a full base64 payload
 * per part on every keystroke. WSF-07 pins the mirror against the real chunkWalletMessages across a matrix of part
 * lists, so the two cannot drift apart silently.
 */
export function walletSendExternalCount(sizeClasses = []) {
  const list = Array.isArray(sizeClasses) ? sizeClasses : [sizeClasses];
  if (list.length === 0) return 1;
  let externals = 1;
  let bytes = 0;
  let count = 0;
  for (const sizeClass of list) {
    const messageBytes = payloadBytesFor(sizeClass) + PLATHO_WALLET_MESSAGE_FRAMING_BYTES;
    if (count > 0 && (count >= PLATHO_WALLET_MAX_MESSAGES_PER_TRANSFER
      || bytes + messageBytes > PLATHO_WALLET_CHUNK_EXTERNAL_BYTE_BUDGET)) {
      externals += 1;
      bytes = 0;
      count = 0;
    }
    bytes += messageBytes;
    count += 1;
  }
  return externals;
}

/**
 * The fee the wallet pays to send these publishes.
 *
 * `sizeClasses` is each part's capsule size class (1, 2, 4, 8, 16, 32 — the plan already carries it). An empty array
 * means one bodyless part (a mint request, an activation): still a signed external, still charged.
 */
export function walletSendFeeNanotons(sizeClasses = []) {
  const list = Array.isArray(sizeClasses) ? sizeClasses : [sizeClasses];
  const parts = list.length > 0 ? list : [1];
  let fee = WALLET_SEND_FEE_BASE_NANOTONS * BigInt(walletSendExternalCount(list));
  for (const sizeClass of parts) fee += perPartFeeNanotons(sizeClass);
  return fee;
}
