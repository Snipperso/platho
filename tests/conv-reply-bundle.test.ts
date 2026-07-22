import { describe, expect, it } from 'vitest';
import { beginCell } from '@ton/core';
import { createHash } from 'node:crypto';
import { createMessagingIdentity } from '../web/crypto/platho-crypto.mjs';
import { resolvePeerBundleFromKeyShardView, resolvePeerReplyBundle } from '../web/conv-reply-bundle.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// CONV-REPLY-BUNDLE — the responder resolves the initiator's FULL bundle from their KeyShard (Y). The security
// property: the resolved bundle must reproduce the pairwise keyId, else a wrong/hostile INTRO source could point at
// any shard. Driven against the REAL getter format — pq_kem_pubkey as the 41/127 SNAKE CELL the contract stores,
// serialised to the base64 BoC the getter returns — NOT a stub, so the format handling is genuinely exercised.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const big = (b: Uint8Array): bigint => BigInt('0x' + Buffer.from(b).toString('hex'));
const sha256Big = (b: Uint8Array): bigint => BigInt('0x' + createHash('sha256').update(Buffer.from(b)).digest('hex'));

/** The ML-KEM-768 pubkey as the KeyShard stores it: 41-byte head then 127-byte links (10 cells) — the fixture format
 *  — from REAL key bytes, serialised to the base64 BoC a get_view stack returns. */
function mlkemSnakeBoc(buf: Uint8Array): string {
  const chunks: Buffer[] = [Buffer.from(buf.subarray(0, 41))];
  for (let o = 41; o < buf.length; o += 127) chunks.push(Buffer.from(buf.subarray(o, Math.min(o + 127, buf.length))));
  let cursor = beginCell().storeBuffer(chunks[chunks.length - 1]);
  for (let i = chunks.length - 2; i >= 0; i -= 1) cursor = beginCell().storeBuffer(chunks[i]).storeRef(cursor.endCell());
  return cursor.endCell().toBoc().toString('base64');
}

/** A KeyShard get_view result for `identity`, in the shape createKeyShardTonRpcProvider.getView returns. */
function keyShardViewFor(identity: any) {
  const kp = identity.encryptionKeyPair;
  return {
    exists: true,
    enc_pubkey: big(kp.x25519PublicKey),
    sign_pubkey: big(identity.signingPublicKey),
    scan_pubkey: big(identity.scanPublicKey),
    pq_kem_pubkey_hash: sha256Big(kp.mlKem768PublicKey),
    pq_kem_pubkey_len: 1184n,
    pq_kem_pubkey: mlkemSnakeBoc(kp.mlKem768PublicKey),
    crypto_suite_mask: 2n, // hybrid
  };
}

describe('CONV-REPLY-BUNDLE (Y: resolve + verify the peer bundle from their KeyShard)', () => {
  it('CRB-01: a matching KeyShard view resolves to a full bundle whose keyId equals the conversation peerKeyId', async () => {
    const peer: any = await createMessagingIdentity();
    const view = keyShardViewFor(peer);
    const bundle = await resolvePeerBundleFromKeyShardView(view, peer.encryptionKeyPair.keyId);
    expect(bundle.keyId, 'the resolved bundle reproduces the pairwise keyId').toBe(peer.encryptionKeyPair.keyId);
    // and it carries the full hybrid material a CONV seal needs (enc + ML-KEM), decoded from the snake cell.
    expect(bundle.x25519PublicKey, 'enc key present').toBeTruthy();
    expect(bundle.mlKem768PublicKey, 'ML-KEM key present (snake decoded)').toBeTruthy();
  });

  it('CRB-02: a view for a DIFFERENT identity is REFUSED (keyId mismatch — wrong/hostile source)', async () => {
    const peer: any = await createMessagingIdentity();
    const impostor: any = await createMessagingIdentity();
    // The src pointed at the impostor's shard, but the conversation was established under the peer's keyId.
    await expect(resolvePeerBundleFromKeyShardView(keyShardViewFor(impostor), peer.encryptionKeyPair.keyId))
      .rejects.toThrow(/does not match the conversation keyId/i);
  });

  it('CRB-03: an unregistered shard fails closed', async () => {
    const peer: any = await createMessagingIdentity();
    await expect(resolvePeerBundleFromKeyShardView({ exists: false }, peer.encryptionKeyPair.keyId))
      .rejects.toThrow(/not registered/i);
  });

  it('CRB-04: resolvePeerReplyBundle reads via the injected provider then verifies (I/O wrapper)', async () => {
    const peer: any = await createMessagingIdentity();
    const view = keyShardViewFor(peer);
    let askedWallet: string | null = null;
    const provider = { getView: async (wallet: string) => { askedWallet = wallet; return view; } };
    const bundle = await resolvePeerReplyBundle({ provider, peerWallet: '0:' + 'ab'.repeat(32), peerKeyId: peer.encryptionKeyPair.keyId });
    expect(askedWallet, 'the provider was asked for the peer wallet').toBe('0:' + 'ab'.repeat(32));
    expect(bundle.keyId).toBe(peer.encryptionKeyPair.keyId);
  });
});
