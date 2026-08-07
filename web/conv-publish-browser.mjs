// conv-publish-browser — build a CONV private-message publish in the BROWSER, no @ton/core and no build/*.ts.
//
// The reference builder (web/publish-builder.mjs buildConvPublish) speaks the compiled Tact serialiser and does not
// load in a browser. This is the SAME message on the client's own primitives, for the clean-17 direct-pay CONV lane
// (a private capsule sent from the user's wallet straight to the conversation-direction's RecordShard).
//
// AUTHORISATION IS A SIGNATURE, NOT A DESTINATION. A RecordShard's address is public the moment anything is published
// there, so knowing where to send is not permission: the shard's identity is the conversation-direction WRITE PUBLIC
// KEY, and every publish carries an ed25519 signature under the matching write secret over (seq ‖ frameCommit). `seq`
// must strictly exceed the shard's last_seq (gate 13653) — that, plus the signature, is what stops a captured publish
// from being replayed to burn the shard's SAFE_CAP.
//
// TWO THINGS ARE LOAD-BEARING, both silent if wrong (identical to intro/public):
//   * StateInit MUST be attached (a RecordShard is new every epoch and deployed lazily).
//   * The body must serialise byte-for-byte as RecordShard expects, because it recomputes frameCommit from the cells
//     it receives; a near-miss stores a commitment the reader's delivery check rejects.
// tests/conv-publish-browser.test.ts pins the message against the @ton/core reference AND against a live RecordShard.

import { beginCell, computeCellHashAndDepth } from './pwa-contract-transactions.mjs?v=36';
import { recordShardAddressBytes, recordShardStateInit, rawAddress } from './shard-address.mjs?v=6';
import { ed25519 } from './vendor/@noble/curves/ed25519.js';

// MUST equal the RecordShard.tact constants; mirrored here (not imported) so this browser builder is the independent
// check the reference derivation is pinned against.
const RS_FRAME_DOMAIN = 0x52534643n;        // "RSFC"
const RS_WRITE_DOMAIN = 0x52535744n;        // "RSWD"
const CAPSULE_PUBLISH_OPCODE = 0x52535031n; // "RSP1" — message(0x52535031) CapsulePublish

const bytesToBig = (b) => { let x = 0n; for (const byte of b) x = (x << 8n) | BigInt(byte & 0xff); return x; };

async function cellHashBig(cell) {
  const { hash } = await computeCellHashAndDepth(cell);
  return bytesToBig(hash);
}

/** H(RS_FRAME_DOMAIN ‖ header0.hash ‖ header1.hash ‖ body.hash) — mirrors RecordShard.frameCommit. */
export async function convFrameCommit(header0, header1, body) {
  const h0 = await cellHashBig(header0);
  const h1 = await cellHashBig(header1);
  const bh = await cellHashBig(body);
  const cell = beginCell()
    .uint(RS_FRAME_DOMAIN, 32, 'RS_FRAME_DOMAIN')
    .uint(h0, 256, 'header0 hash')
    .uint(h1, 256, 'header1 hash')
    .uint(bh, 256, 'body hash')
    .endCell();
  return cellHashBig(cell);
}

/**
 * Mirrors the COMPILED storeCapsulePublish EXACTLY: op | seq | ^header_0 | ^header_1 | ^(^body | ^sig). Tact nested
 * body+sig into a sub-cell (a cell holds 4 refs; header_0/header_1 + that sub-cell = 3 root refs), so a flat 4-ref
 * body would NOT match — verified against build/RecordShard storeCapsulePublish.
 */
export function buildConvPublishBody({ seq, header0, header1, body, sig }) {
  const sigCell = beginCell().bytesValue(sig, 64, 'sig').endCell();
  const bodySig = beginCell().ref(body, 'body').ref(sigCell, 'sig').endCell();
  return beginCell()
    .uint(CAPSULE_PUBLISH_OPCODE, 32, 'CapsulePublish opcode')
    .uint(BigInt(seq), 64, 'seq')
    .ref(header0, 'header_0')
    .ref(header1, 'header_1')
    .ref(bodySig, 'body+sig sub-cell')
    .endCell();
}

/**
 * Everything a wallet needs to publish a CONV capsule direct-pay: where to send, how much, the body, the StateInit,
 * and the commit the reader will match against.
 *
 * `writePublicKey`/`writeSecret` are the conversation-direction write keypair (conv-routing.convWritePublicKey /
 * convWriteSecret, derived from the conversation's K_root); `epoch` is the CONV epoch; header0/header1/body are the
 * capsule's three snake cells. FUNDING: pass CONV_PUBLISH_VALUE (the deploy figure) for every publish — overpaying an
 * existing shard is returned mode-128, and "pay more only when absent" is forgeable on a public bucket space.
 */
export async function buildConvPublishBrowser({ writePublicKey, writeSecret, seq, epoch, header0, header1, body, value }) {
  const commit = await convFrameCommit(header0, header1, body);
  const digestCell = beginCell()
    .uint(RS_WRITE_DOMAIN, 32, 'RS_WRITE_DOMAIN')
    .uint(BigInt(seq), 64, 'seq')
    .uint(commit, 256, 'frameCommit')
    .endCell();
  const { hash: digest } = await computeCellHashAndDepth(digestCell);
  const sig = ed25519.sign(digest, writeSecret);
  const pubBig = bytesToBig(writePublicKey);
  const address = await recordShardAddressBytes(pubBig, epoch);
  return {
    to: rawAddress(address),
    addressBytes: address,
    value,
    body: buildConvPublishBody({ seq, header0, header1, body, sig }),
    init: recordShardStateInit(pubBig, epoch),
    commit,
  };
}
