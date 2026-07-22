// conv-lane-send — the SEND half of the clean-17 PRIVATE CONV lane, wired to the user's wallet.
//
// The read half (conv-lane / conv-discovery) turns RecordShards back into conversation messages. This turns an
// already-sealed CONV capsule into a signed, direct-pay wallet transaction to the RecordShard that stores it. It is
// deliberately thin: createEncryptedConvCapsule already sealed the bytes, buildConvPublishBrowser already builds and
// pins the message (opcode, StateInit, frameCommit, ed25519 write signature) against the contract, and
// platho-wallet.sendPlathoWalletTransaction already signs and broadcasts the v5 external — this module only marries
// the three and shapes the wallet message. Exact mirror of public-lane-send.mjs.
//
// DIRECT-PAY, no Vault, no CapsuleHub. clean-15 sent an EXTERNAL message to the user's Vault, which relayed it; clean-17
// sends an INTERNAL message from the user's own wallet straight to the RecordShard, StateInit attached so the shard
// deploys lazily on the first publish of the epoch. The write key (not the sender wallet) is the shard's identity, so
// the wallet is only the payer — the conversation stays unlinkable to the payer on-chain.
//
// TWO THINGS ARE LOAD-BEARING, both silent if wrong (identical to public/intro):
//   * StateInit MUST be attached (a RecordShard is new every epoch and deployed lazily).
//   * The three snake cells must serialise byte-for-byte as RecordShard expects — it recomputes frameCommit from the
//     cells it receives, and a near-miss stores a commitment the recipient's delivery check rejects (money spent,
//     nothing arrives). The capsule already produced those cells; we only carry them, never re-encode them.
//
// FUNDING: always CONV_PUBLISH_VALUE (the deploy figure). The shard keeps only what it needs and returns the surplus
// mode-128, so overpaying an already-deployed shard costs nothing — and "pay more only when absent" is forgeable on a
// public bucket space. tests/conv-lane-send.test.ts pins the message against a REAL sealed capsule and a live RecordShard.

import { buildConvPublishBrowser } from './conv-publish-browser.mjs?v=1';
import { parseBocBase64, serializeBoc, tonCell } from './pwa-contract-transactions.mjs?v=33';
import { sendPlathoWalletTransaction } from './platho-wallet.mjs?v=1';

/**
 * The capsule's three on-chain snake cells, as CLIENT cells buildConvPublishBrowser consumes. createEncryptedConvCapsule
 * hands back chainCells as snake PAYLOAD objects (carrying the serialised .boc), not raw cells, so each is parsed back
 * to a cell here. The parse round-trips the exact cell tree (same hash), so the frameCommit the shard recomputes matches.
 */
function convCapsuleCells(capsule) {
  const cells = capsule?.chainCells;
  if (!cells?.header0?.boc || !cells?.header1?.boc || !cells?.body?.boc) {
    throw new Error('CONV capsule is missing its on-chain payload cells (chainCells.header0/header1/body)');
  }
  return {
    header0: parseBocBase64(cells.header0.boc),
    header1: parseBocBase64(cells.header1.boc),
    body: parseBocBase64(cells.body.boc),
  };
}

/**
 * Shape a CONV publish as the wallet-message form sendPlathoWalletTransaction consumes:
 *   { address, amount, payload (base64 BoC of the body), stateInit (cell), bounce }.
 * `writePublicKey`/`writeSecret` are the conversation-direction write keypair (conv-routing, derived from the
 * conversation K_root via outgoingRecordShard); `seq` must strictly exceed the shard's last_seq; `epoch` is the CONV
 * epoch; `capsule` is a createEncryptedConvCapsule result; `value` is CONV_PUBLISH_VALUE. Returns the built message plus
 * the address/value/commit the caller may want for tracking.
 */
export async function buildConvPublishWalletMessage({ writePublicKey, writeSecret, seq, epoch, capsule, value }) {
  const cells = convCapsuleCells(capsule);
  const built = await buildConvPublishBrowser({
    writePublicKey, writeSecret, seq, epoch, value,
    header0: cells.header0, header1: cells.header1, body: cells.body,
  });
  return {
    to: built.to,
    value: built.value,
    commit: built.commit,
    init: built.init,
    body: built.body,
    message: {
      address: built.to,
      amount: built.value,
      payload: tonCell.bytesToBase64(serializeBoc(built.body)),
      stateInit: built.init,   // storeInternalMessage takes the StateInit cell directly
      bounce: true,            // a rejected publish bounces the funds back, exactly like the reference path
    },
  };
}

/**
 * Publish SEVERAL CONV capsule parts in ONE wallet transfer — the multipart case: a message split across N capsules is
 * N separate records in the SAME conversation-direction RecordShard (grouped on read by the shared stream), so one
 * signed transfer carries all N. `parts` is an array of buildConvPublishWalletMessage args ({ writePublicKey,
 * writeSecret, seq, epoch, capsule, value }); every part shares the same write key / epoch (so the same shard), with
 * strictly increasing seq — the first publish deploys the shard (StateInit), the rest just publish. Returns the
 * prepared parts (for commit tracking) and the single wallet-send result.
 *
 * `wallet` is the app's WalletContractV5R1 handle; `transport` is the RPC transport (sendBoc + runGetMethod for seqno).
 */
export async function publishConvLaneParts({ wallet, transport }, parts, options = {}) {
  if (!wallet) throw new Error('publishConvLaneParts requires a wallet');
  if (!Array.isArray(parts) || parts.length === 0) throw new Error('publishConvLaneParts requires at least one part');
  const prepared = [];
  for (const part of parts) prepared.push(await buildConvPublishWalletMessage(part));
  const result = await sendPlathoWalletTransaction(wallet, { messages: prepared.map((p) => p.message) }, { ...options, transport });
  return { parts: prepared, result };
}

/** The single-capsule case (one wallet transfer, one record). Thin over publishConvLaneParts. */
export async function publishConvLane({ wallet, transport, ...part }, options = {}) {
  const { parts, result } = await publishConvLaneParts({ wallet, transport }, [part], options);
  return { ...parts[0], result };
}
