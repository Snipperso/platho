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
// MEASURED, not assumed. tests/wallet-send-fee.test.ts drives REAL sealed CONV capsules through the REAL builder
// into a sandbox and reads the fee the network actually charged the payer, across every size class and four part
// counts. It asserts this model never quotes BELOW a measured send and never more than 15% above it. If TON's fee
// schedule moves, that test goes red instead of the user reading a stale number — the failure mode this file exists
// to end (three fee constants in this repo have already outlived the architecture they described).
//
// DIRECTION OF ERROR IS DELIBERATE. Quoting high is honest: the surplus returns. Quoting low promises a send the
// wallet cannot fund, and that is the shape that hurts — the user funds exactly the quoted figure and the send is
// refused for the difference.

import {
  PLATHO_WALLET_CHUNK_EXTERNAL_BYTE_BUDGET,
  PLATHO_WALLET_MAX_MESSAGES_PER_TRANSFER,
  PLATHO_WALLET_MESSAGE_FRAMING_BYTES,
} from './platho-wallet.mjs?v=32';

/**
 * Fixed cost of ONE EXTERNAL: importing it plus the wallet's own compute.
 * Measured 816,190 against a sandbox treasury; raised to cover the ~224,200 by which a treasury understates a real
 * WalletContractV5R1 (sandbox-treasury-is-not-a-wallet) and checked against the owner's on-chain 0.0223.
 */
export const WALLET_SEND_FEE_BASE_NANOTONS = 1_100_000n;

/**
 * Per outgoing publish in the transfer, by capsule size class: its forward fee plus the action-phase cost.
 * Sandbox-measured (tests/wallet-send-fee.test.ts re-measures and brackets these on every run).
 */
export const WALLET_SEND_FEE_PER_PART_BY_SIZE_CLASS = Object.freeze({
  1: 2_272_000n,
  2: 3_071_286n,
  4: 4_669_858n,
  8: 7_867_001n,
  16: 14_270_178n,
  32: 27_067_641n,
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
  1: 2_454,
  2: 3_502,
  4: 5_598,
  8: 9_790,
  16: 18_177,
  32: 35_224,
});

const SIZE_CLASSES = Object.freeze([1, 2, 4, 8, 16, 32]);

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
