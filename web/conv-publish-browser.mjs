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

import { beginCell, computeCellHashAndDepth } from './pwa-contract-transactions.mjs?v=47';
import { recordShardAddressBytesFor, recordShardStateInitFor, rawAddress } from './shard-address.mjs?v=29';
import { generationForEpochAt, CUTOVER_EPOCH } from './cutover-epoch.mjs?v=4';
import { ed25519 } from './vendor/@noble/curves/ed25519.js';

// MUST equal the RecordShard.tact constants; mirrored here (not imported) so this browser builder is the independent
// check the reference derivation is pinned against.
const RS_FRAME_DOMAIN = 0x52534643n;        // "RSFC"
const RS_WRITE_DOMAIN = 0x52535744n;        // "RSWD"
// 🔴 CUTOVER: contracts18/docs/CUTOVER.md item 11. In clean-18 this body stops being a message a wallet may
// send: RecordShard's direct door is DELETED [OWNER 2026-08-30] and the same bytes travel as the `record` REF
// inside VaultPublish, built and sent through the payer's own FeeVault (web/fee-vault.mjs). The builder below
// stays byte-identical either way — what changes at the flip is WHO the wallet addresses.
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
/**
 * THE WRITE-AUTHORIZATION DIGEST, AND WHY IT HAS TWO SHAPES [audit 2026-09-01, round 11].
 *
 * clean-17 signs H(domain ‖ seq ‖ frame_commit) — a digest that names the CAPSULE but not the ACCOUNT that
 * stores it, so byte-identical signed bytes were accepted by RecordShard(pk, E) and RecordShard(pk, E+1) alike
 * (measured: exit 0 at both). It is inert on the shipped client, because convWriteSecret folds the direction
 * byte and u32be(epoch) into the write key and K_epoch is itself epoch-derived, so no two live shards share a
 * write_pubkey — but that made a CONTRACT invariant depend on a property of the CLIENT, on code nobody can
 * redeploy. clean-18 appends the shard's own `epoch`, which makes a signature valid for exactly one address.
 *
 * The sealed clean-17 shard is on chain and verifies the three-field digest, so this is per GENERATION, not a
 * swap: the epoch names the generation (shard-address.mjs keys its derivation the same way), and a signature
 * built for the wrong one is refused 13654 by whichever shard receives it — loudly, never silently stored.
 */
export function convWriteDigestCell({ seq, commit, epoch, boundary = CUTOVER_EPOCH }) {
  // Never Number(undefined) into the generation test: NaN < boundary is FALSE, which resolves to generation 18
  // and would sign for a shard that does not exist. The instant is required, exactly as it is for the PUBLIC
  // writer (CUTEPOCH-07 measures that trap).
  if (epoch === undefined || epoch === null) {
    throw new RangeError('convWriteDigestCell: epoch is required — it names the generation the digest is for');
  }
  const cell = beginCell()
    .uint(RS_WRITE_DOMAIN, 32, 'RS_WRITE_DOMAIN')
    .uint(BigInt(seq), 64, 'seq')
    .uint(commit, 256, 'frameCommit');
  // `boundary` IS THE TEST SEAM, and it exists because the branch below is otherwise unreachable until the day
  // it decides every CONV write in the network [audit 2026-09-01, round 13]. CUTOVER_EPOCH is a module constant
  // that is null today, so before this parameter no test could execute the four-field shape through the shipped
  // function — CONVDIG-01 hand-built the preimage instead, which proves the CONTRACT and not the CLIENT. Its
  // sibling seam in web/shard-address.mjs (__setLaneGenerationCodeForTests) exists for exactly the same reason.
  // Production callers pass nothing and get the module constant.
  if (generationForEpochAt(Number(epoch), boundary) >= 18) cell.uint(BigInt(epoch), 32, 'epoch');
  return cell.endCell();
}

// `boundary` defaults to the BAKED CUTOVER_EPOCH, so product callers keep today's answer without passing it. It
// exists because the digest could already be rehearsed at a boundary while the ADDRESS could not — so no test
// could drive a whole clean-18 CONV publish, and the one lane whose direct door disappears at the flip was the
// one lane whose flip could not be rehearsed end to end. Both halves take it now, from the same value, so a
// rehearsal cannot sign for one generation and address the other. [audit 2026-09-02]
export async function buildConvPublishBrowser({ writePublicKey, writeSecret, sign, seq, epoch, header0, header1, body, value, boundary = CUTOVER_EPOCH }) {
  const commit = await convFrameCommit(header0, header1, body);
  const { hash: digest } = await computeCellHashAndDepth(convWriteDigestCell({ seq, commit, epoch, boundary }));
  // A SECRET OR A SIGNER, never both and never neither [private groups, 2026-09-05]. A two-party lane holds its
  // write key as a 32-byte seed; a GROUP member's lane key is blinded (crypto/group-lane.mjs), so the scalar
  // exists only as a scalar and can only be offered as a signing function. Guessing between them would produce a
  // publish the wallet signs, the shard refuses, and nothing explains.
  if ((writeSecret === undefined) === (sign === undefined)) {
    throw new TypeError('buildConvPublishBrowser needs exactly one of writeSecret or sign');
  }
  const sig = sign === undefined ? ed25519.sign(digest, writeSecret) : await sign(digest);
  if (!(sig instanceof Uint8Array) || sig.length !== 64) throw new TypeError('the signer must return 64 bytes');
  const pubBig = bytesToBig(writePublicKey);
  // ONE DERIVATION FOR THE ADDRESS, THE STATEINIT AND THE CALLER. The address and the init cell each called
  // this separately, and the vault door derived it a third time from its own arguments — three copies of a
  // value that must never differ, which is the shape that produced the envelope naming one generation's shard
  // while carrying the other's code [CONVVAULT-01].
  const generation = generationForEpochAt(Number(epoch), boundary);
  const address = await recordShardAddressBytesFor(generation, pubBig, epoch);
  return {
    to: rawAddress(address),
    addressBytes: address,
    generation,
    value,
    body: buildConvPublishBody({ seq, header0, header1, body, sig }),
    init: recordShardStateInitFor(generation, pubBig, epoch),
    commit,
  };
}
