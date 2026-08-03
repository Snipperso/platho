// public-publish-browser — build a PublicPublish in the BROWSER, no @ton/core and no build/*.ts.
//
// The reference builder (web/publish-builder.mjs buildPublicPublish) speaks the compiled Tact serialiser, which
// does not load in a browser. This is the SAME message, built on the client's own cell primitives, for the
// public/avatar lane (channel posts, thread comments, the beacon directory, avatars).
//
// TWO THINGS ARE LOAD-BEARING, both silent if wrong — identical to the intro path:
//   - StateInit MUST be attached. A PublicShard is deployed lazily: the first publish into a (partition, epoch_tag)
//     is what creates the account. Send without it and the message lands on an uninitialised account, runs with its
//     COMPUTE PHASE SKIPPED, and disappears — no bounce, no error, the wallet reports success.
//   - The (opcode, kind, key_arg, shard_seq, header, body) layout must serialise byte-for-byte as the contract
//     expects. The contract recomputes body_commit = H(PS_BODY_DOMAIN ‖ header.hash ‖ body.hash) from the cells it
//     receives and stores only that; the reader re-derives it to authenticate the body against transaction history.
//     A layout merely close stores a commit no read will match — a post paid for and unreadable.
// tests/public-publish-browser.test.ts pins the message against the @ton/core reference (by representation hash)
// and against a live PublicShard in a sandbox.

import { beginCell } from './pwa-contract-transactions.mjs?v=35';
import { publicShardAddressBytes, publicShardStateInit, rawAddress } from './shard-address.mjs?v=5';
import { publicBodyCommit } from './public-shard-ton-rpc-provider.mjs?v=2';

// "PSP1" — message(0x50535031) PublicPublish. MUST equal the opcode PublicShard.tact declares; mirrored here (not
// imported from the reader) because a builder that derives its own opcode is the independent check, and drift shows
// up immediately as a rejected publish in PUB-02.
export const PUBLIC_PUBLISH_OPCODE = 0x50535031;

/** Mirrors `message(0x50535031) PublicPublish` — op | kind:uint8 | key_arg:uint256 | shard_seq:uint32 | ^header | ^body. */
export function buildPublicPublishBody({ kind, keyArg = 0n, shardSeq = 0, header, body }) {
  if (!(BigInt(kind) >= 0n && BigInt(kind) <= 3n)) throw new Error(`buildPublicPublishBody: kind ${kind} out of range 0..3`);
  if (!header || !body) throw new Error('buildPublicPublishBody: header and body cells are required');
  const builder = beginCell();
  builder.uint(PUBLIC_PUBLISH_OPCODE, 32, 'PublicPublish opcode');
  builder.uint(BigInt(kind), 8, 'kind');
  builder.uint(BigInt(keyArg), 256, 'key_arg');
  builder.uint(BigInt(shardSeq), 32, 'shard_seq');
  builder.ref(header, 'header');
  builder.ref(body, 'body');
  return builder.endCell();
}

/**
 * Everything a wallet needs to publish into the public/avatar lane: where to send, how much, the body, the
 * StateInit, and the commit the reader will match against.
 *
 * `kind` is the PublicShard KIND (0 CHANNEL, 1 THREAD, 2 BEACON, 3 AVATAR) — the high field of epoch_tag, NOT the
 * PPH body kind. `keyArg` is post_uid for THREAD, the bucket for BEACON, unused (0) for CHANNEL/AVATAR — the same
 * positional contract the message carries. `partitionKey`/`epochTag` come from web/shard-discovery, which derives
 * and pins them; deriving them a second time here would be a place for the two to drift silently.
 *
 * FUNDING: pass the DEPLOY figure (get_view.deploy_min_value, charged while entry_count == 0) unless a get_view read
 * proves the shard already holds entries — overpaying costs nothing (the shard returns the change) and underpaying a
 * fresh shard is refused in compute. StateInit is attached unconditionally for the lazy-deploy reason above.
 */
export async function buildPublicPublishBrowser({ kind, keyArg = 0n, shardSeq = 0, header, body, value, partitionKey, epochTag }) {
  const address = await publicShardAddressBytes(partitionKey, epochTag);
  return {
    to: rawAddress(address),
    addressBytes: address,
    value,
    body: buildPublicPublishBody({ kind, keyArg, shardSeq, header, body }),
    init: publicShardStateInit(partitionKey, epochTag),
    commit: await publicBodyCommit(header, body),
  };
}
