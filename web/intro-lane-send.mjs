// intro-lane-send — the SEND half of the clean-17 first-contact (INTRO) lane, wired to the user's wallet.
//
// The read half (intro-lane) scans the stealth pool for first contacts addressed to this wallet. This turns an
// already-sealed INTRO capsule into a signed, direct-pay wallet transaction to the IntroShard the recipient will scan.
// Thin, exactly like conv-lane-send / public-lane-send: createEncryptedIntroCapsule already sealed the bytes and minted
// the pairwise K_root, buildIntroPublishBrowser already builds and pins the message (opcode, StateInit, r + view_tag,
// body commit) against the contract, and sendPlathoWalletTransaction signs and broadcasts — this only marries them.
//
// STEALTH, NOT AUTHENTICATED-BY-DESTINATION. An INTRO carries the ephemeral R and the stealth view_tag in the clear on
// chain (op | r | view_tag | ^header_0 | ^body); the RECIPIENT is hidden — it is found only by a scanner holding the
// matching scan key, which trial-matches the view_tag. So the bucket/epoch say nothing about who the intro is for.
//
// TWO THINGS ARE LOAD-BEARING, both silent if wrong (identical to conv/public):
//   * StateInit MUST be attached (an IntroShard is deployed lazily on the first publish into an (epoch, bucket)).
//   * The two snake cells must serialise byte-for-byte — the contract recomputes the body commitment from the cells it
//     receives, and a near-miss stores a commitment the recipient's delivery check rejects (paid for, undeliverable).
// The bucket MUST be inside the read space (assertReadableBucket, enforced by buildIntroPublishBrowser) or no scanner
// ever looks at it. tests/intro-lane-send.test.ts pins the message against a REAL sealed capsule and a live IntroShard.
//
// FUNDING: always INTRO_PUBLISH_VALUE (the deploy figure). The shard keeps only what it needs and returns the surplus.

import { buildIntroPublishBrowser } from './intro-publish-browser.mjs?v=18';
import { parseBocBase64, serializeBoc, tonCell } from './pwa-contract-transactions.mjs?v=37';
import { sendPlathoWalletTransaction } from './platho-wallet.mjs?v=35';

/** base64url → bytes (the capsule advertises ephemeralR / view material as base64url, not standard base64). */
function b64urlToBytes(value) {
  const b64 = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.length % 4 === 0 ? b64 : b64 + '='.repeat(4 - (b64.length % 4));
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

const bytesToBig = (b) => { let x = 0n; for (const byte of b) x = (x << 8n) | BigInt(byte & 0xff); return x; };

/** The INTRO capsule's on-chain fields, as buildIntroPublishBrowser consumes them: header0/body cells + the uint256
 *  ephemeral r + the view_tag. INTRO publishes only header0 + body (header1 is canonical, reproduced by the recipient). */
function introPublishFieldsFromCapsule(capsule) {
  const cells = capsule?.chainCells;
  if (!cells?.header0?.boc || !cells?.body?.boc) {
    throw new Error('INTRO capsule is missing its on-chain payload cells (chainCells.header0/body)');
  }
  const ephemeralR = capsule.header0?.ephemeralR ?? capsule.header0?.ephemeral_r;
  if (!ephemeralR) throw new Error('INTRO capsule header0 is missing the ephemeral R');
  return {
    header0: parseBocBase64(cells.header0.boc),
    body: parseBocBase64(cells.body.boc),
    r: bytesToBig(b64urlToBytes(ephemeralR)),
    viewTag: BigInt(capsule.header0?.viewTag ?? capsule.header0?.view_tag ?? 0),
  };
}

/** The stealth fields the SENDER needs to read back its own published intro (r = the uint256 ephemeral, view_tag),
 *  computed straight from the capsule — so they are available whether or not the broadcast succeeded (an ambiguous
 *  broadcast still needs them to confirm the on-chain created_at on retry). [direct-pay send hardening] */
export function introCapsuleStealthFields(capsule) {
  const ephemeralR = capsule?.header0?.ephemeralR ?? capsule?.header0?.ephemeral_r;
  if (!ephemeralR) throw new Error('INTRO capsule header0 is missing the ephemeral R');
  return { r: bytesToBig(b64urlToBytes(ephemeralR)), viewTag: BigInt(capsule?.header0?.viewTag ?? capsule?.header0?.view_tag ?? 0) };
}

/**
 * Shape an INTRO publish as the wallet-message form sendPlathoWalletTransaction consumes:
 *   { address, amount, payload (base64 BoC of the body), stateInit (cell), bounce }.
 * `epoch`/`bucket` are the stealth-pool coordinates (chooseIntroBucket picks the bucket); `capsule` is a
 * createEncryptedIntroCapsule result; `value` is INTRO_PUBLISH_VALUE.
 */
export async function buildIntroPublishWalletMessage({ epoch, bucket, capsule, value }) {
  const { header0, body, r, viewTag } = introPublishFieldsFromCapsule(capsule);
  const built = await buildIntroPublishBrowser({ epoch, bucket, r, viewTag, header0, body, value });
  return {
    to: built.to,
    value: built.value,
    init: built.init,
    body: built.body,
    epoch,
    bucket,
    r,           // the uint256 ephemeral r the publish carries — the sender matches it to read back its own created_at
    viewTag,
    message: {
      address: built.to,
      amount: built.value,
      payload: tonCell.bytesToBase64(serializeBoc(built.body)),
      stateInit: built.init,
      bounce: true,
    },
  };
}

/**
 * Publish a first contact from the user's wallet. Thin over the wallet send path; the message is the only new thing,
 * pinned by tests against the live contract. `wallet` is the app's WalletContractV5R1 handle; `transport` is the RPC
 * transport (sendBoc + runGetMethod for seqno). Returns the prepared message plus the single wallet-send result.
 */
export async function publishIntroLane({ wallet, transport, epoch, bucket, capsule, value }, options = {}) {
  if (!wallet) throw new Error('publishIntroLane requires a wallet');
  const prepared = await buildIntroPublishWalletMessage({ epoch, bucket, capsule, value });
  const result = await sendPlathoWalletTransaction(wallet, { messages: [prepared.message] }, { ...options, transport });
  return { ...prepared, result };
}
