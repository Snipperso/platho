// intro-publish-browser — build an INTRO publish in the BROWSER, with no @ton/core and no build/*.ts.
//
// The reference builder (web/publish-builder.mjs) uses the compiled Tact serialisers, which do not load in a
// browser. This is the same message, built on the client's own primitives.
//
// TWO THINGS HERE ARE LOAD-BEARING, and both fail silently if wrong:
//   - The StateInit MUST be attached. Shards are deployed lazily, so the first publish into a new (epoch, bucket)
//     is what creates the account. Send without it and the message lands on an uninitialised account, runs with
//     its COMPUTE PHASE SKIPPED, and disappears — no bounce, no error, wallet reports success.
//   - The body must serialise byte-for-byte as the contract expects, because the contract recomputes the
//     commitment from the cells it receives. A layout that is merely close produces a different commit and the
//     recipient's delivery check rejects the capsule it just paid to publish.
// tests/intro-publish-browser.test.ts pins both against the reference builder and against the live contract.

import { beginCell } from './pwa-contract-transactions.mjs?v=37';
import { introShardAddressBytes, introShardStateInit, rawAddress } from './shard-address.mjs?v=7';
import { INTRO_PUBLISH_OPCODE } from './intro-codec.mjs?v=2';
import { assertReadableBucket } from './intro-bucket.mjs?v=16';

/** Mirrors `message(0x49535031) IntroPublish` — op | r:uint256 | view_tag:uint16 | ^header_0 | ^body. */
export function buildIntroPublishBody({ r, viewTag, header0, body }) {
  const builder = beginCell();
  builder.uint(INTRO_PUBLISH_OPCODE, 32, 'IntroPublish opcode');
  builder.uint(BigInt(r), 256, 'r');
  builder.uint(BigInt(viewTag), 16, 'view_tag');
  builder.ref(header0, 'header_0');
  builder.ref(body, 'body');
  return builder.endCell();
}

/**
 * Everything a wallet needs to publish a first contact: where to send, how much, the body, and the StateInit.
 *
 * The bucket is REFUSED if it lies outside the read space. IntroShard.init takes any uint32 and no contract gate
 * looks at it, while every reader is clamped to INTRO_READ_SPACE — so bucket 1024 and up is a publish that is
 * accepted, charged for, and read by nobody, for ever. Use chooseIntroBucket() to pick one.
 *
 * FUNDING: pass INTRO_PUBLISH_VALUE from web/publish-price.mjs — the DEPLOY figure — for every intro, not only
 * the first into a bucket-day. Gate 13682 is state-dependent, and the obvious "pay more only when the account is
 * absent" rule is forgeable on this lane in particular: the bucket space is public, so anyone can create a shard
 * with a bare value message and leave it holding zero entries. Overpaying costs nothing; the shard returns it.
 */
export async function buildIntroPublishBrowser({ epoch, bucket, r, viewTag, header0, body, value }) {
  assertReadableBucket(bucket);
  const address = await introShardAddressBytes(epoch, bucket);
  return {
    to: rawAddress(address),
    addressBytes: address,
    value,
    body: buildIntroPublishBody({ r, viewTag, header0, body }),
    init: introShardStateInit(epoch, bucket),
  };
}
