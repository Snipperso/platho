
import { beginCell } from './pwa-contract-transactions.mjs?v=59';
import { introShardAddressBytes, introShardStateInit, rawAddress } from './shard-address.mjs?v=47';
import { INTRO_PUBLISH_OPCODE } from './intro-codec.mjs?v=4';
import { assertReadableBucket } from './intro-bucket.mjs?v=103';

export function buildIntroPublishBody({ r, viewTag, header0, body }) {
  const builder = beginCell();
  builder.uint(INTRO_PUBLISH_OPCODE, 32, 'IntroPublish opcode');
  builder.uint(BigInt(r), 256, 'r');
  builder.uint(BigInt(viewTag), 16, 'view_tag');
  builder.ref(header0, 'header_0');
  builder.ref(body, 'body');
  return builder.endCell();
}

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
