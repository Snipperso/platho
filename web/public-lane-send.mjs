// public-lane-send — the SEND half of the clean-17 public/avatar lane, wired to the user's wallet.
//
// The read half (public-lane.mjs) turns shards into posts. This turns a composed capsule into a signed, direct-pay
// wallet transaction to the shard that stores it. It is deliberately thin: buildPublicPublishBrowser already builds
// and pins the message (opcode, StateInit, commit) against the contract, and platho-wallet.sendPlathoWalletTransaction
// already signs and broadcasts the v5 external — this module only marries the two and shapes the wallet message.
//
// DIRECT-PAY, no Vault, no CapsuleHub. The clean-15 client sent an EXTERNAL message to the user's Vault, which
// relayed to the Hub; clean-17 sends an INTERNAL message from the user's own wallet straight to the shard, with the
// StateInit attached so the shard deploys lazily on first publish. The wallet is the payer and the sender, so the
// shard's transaction history carries the real publisher — which is exactly what the reader attributes posts by.
//
// FUNDING: always the deploy figure for the kind (see web/publish-price.mjs for why "always the deploy figure" is
// the only rule that needs no chain read and cannot be forged into a refused publish). The shard keeps only what it
// needs and returns the surplus via mode-128, so overpaying an existing shard costs nothing.

import { buildPublicPublishBrowser } from './public-publish-browser.mjs?v=2';
import { serializeBoc, tonCell } from './pwa-contract-transactions.mjs?v=35';
import { sendPlathoWalletTransaction } from './platho-wallet.mjs?v=21';

/**
 * Shape a PublicPublish as the wallet-message form sendPlathoWalletTransaction consumes:
 *   { address, amount, payload (base64 BoC of the body), stateInit (cell), bounce }.
 * Returns the built message plus the address/value/commit the caller may want for tracking. `value` is the funding
 * the caller decided (the kind's deploy figure); `header`/`body` are the client cells from createPublicPostPayloadV2.
 */
export async function buildPublicPublishWalletMessage({ kind, keyArg = 0n, shardSeq = 0, header, body, value, partitionKey, epochTag }) {
  const built = await buildPublicPublishBrowser({ kind, keyArg, shardSeq, header, body, value, partitionKey, epochTag });
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
 * Publish into the public/avatar lane from the user's wallet. Thin over the wallet send path; the message is the
 * only new thing, and it is pinned by tests/public-publish-browser.test.ts against the live contract.
 *
 * `wallet` is the app's WalletContractV5R1 handle (address, walletId, walletSecretKey, stateInit); `transport` is
 * the RPC transport with sendBoc (and runGetMethod for seqno). Extra `options` pass through to the wallet send.
 */
export async function publishPublicLane({ wallet, transport, ...args }, options = {}) {
  if (!wallet) throw new Error('publishPublicLane requires a wallet');
  const prepared = await buildPublicPublishWalletMessage(args);
  const result = await sendPlathoWalletTransaction(wallet, { messages: [prepared.message] }, { ...options, transport });
  return { ...prepared, result };
}

/**
 * Publish SEVERAL PublicPublish parts in ONE wallet transfer — the multipart case: a post split across N body cells
 * is N separate entries in the SAME shard (grouped on read by the header's streamId), so one signed transfer carries
 * all N. `parts` is an array of the buildPublicPublishWalletMessage args ({ kind, keyArg, header, body, value,
 * partitionKey, epochTag }); every part shares the same StateInit-bearing shard, so the first deploys it and the
 * rest just publish. Returns the prepared parts (for commit tracking) and the single wallet-send result.
 */
export async function publishPublicLaneParts({ wallet, transport }, parts, options = {}) {
  if (!wallet) throw new Error('publishPublicLaneParts requires a wallet');
  if (!Array.isArray(parts) || parts.length === 0) throw new Error('publishPublicLaneParts requires at least one part');
  const prepared = [];
  for (const part of parts) prepared.push(await buildPublicPublishWalletMessage(part));
  // extraMessages lets a caller ride a NON-PublicPublish message in the same v5 transfer — the avatar path attaches
  // the 100-ATH payment request ({address, amount, payload}) alongside the AVATAR shard bytes so both land atomically.
  const extra = Array.isArray(options.extraMessages) ? options.extraMessages : [];
  const { extraMessages, ...sendOptions } = options;
  const result = await sendPlathoWalletTransaction(wallet, { messages: [...prepared.map((p) => p.message), ...extra] }, { ...sendOptions, transport });
  return { parts: prepared, result };
}
