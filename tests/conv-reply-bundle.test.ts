import { describe, expect, it } from 'vitest';
import { beginCell } from '@ton/core';
import { createHash } from 'node:crypto';
import { createMessagingIdentity } from '../web/crypto/platho-crypto.mjs';
import { resolveBundleFromKeyShardView, resolvePeerBundleFromKeyShardView, resolvePeerReplyBundle, resolveRecipientBundleByWallet } from '../web/conv-reply-bundle.mjs';


const big = (b: Uint8Array): bigint => BigInt('0x' + Buffer.from(b).toString('hex'));
const sha256Big = (b: Uint8Array): bigint => BigInt('0x' + createHash('sha256').update(Buffer.from(b)).digest('hex'));

function mlkemSnakeBoc(buf: Uint8Array): string {
  const chunks: Buffer[] = [Buffer.from(buf.subarray(0, 41))];
  for (let o = 41; o < buf.length; o += 127) chunks.push(Buffer.from(buf.subarray(o, Math.min(o + 127, buf.length))));
  let cursor = beginCell().storeBuffer(chunks[chunks.length - 1]);
  for (let i = chunks.length - 2; i >= 0; i -= 1) cursor = beginCell().storeBuffer(chunks[i]).storeRef(cursor.endCell());
  return cursor.endCell().toBoc().toString('base64');
}

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
    crypto_suite_mask: 2n,
  };
}

describe('CONV-REPLY-BUNDLE (Y: resolve + verify the peer bundle from their KeyShard)', () => {
  it('CRB-01: a matching KeyShard view resolves to a full bundle whose keyId equals the conversation peerKeyId', async () => {
    const peer: any = await createMessagingIdentity();
    const view = keyShardViewFor(peer);
    const bundle = await resolvePeerBundleFromKeyShardView(view, peer.encryptionKeyPair.keyId);
    expect(bundle.keyId, 'the resolved bundle reproduces the pairwise keyId').toBe(peer.encryptionKeyPair.keyId);
    expect(bundle.x25519PublicKey, 'enc key present').toBeTruthy();
    expect(bundle.mlKem768PublicKey, 'ML-KEM key present (snake decoded)').toBeTruthy();
    expect(bundle.scanPublicKey, 'stealth scan key present (needed for an INTRO seal)').toBe(
      Buffer.from(peer.scanPublicKey).toString('base64url'));
  });

  it('CRB-02: a view for a DIFFERENT identity is REFUSED (keyId mismatch — wrong/hostile source)', async () => {
    const peer: any = await createMessagingIdentity();
    const impostor: any = await createMessagingIdentity();
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

  it('CRB-05: INITIATOR — resolveRecipientBundleByWallet builds the bundle with NO pre-known keyId (keyId is output)', async () => {
    const recipient: any = await createMessagingIdentity();
    const view = keyShardViewFor(recipient);
    let askedWallet: string | null = null;
    const provider = { getView: async (wallet: string) => { askedWallet = wallet; return view; } };
    const wallet = '0:' + 'cd'.repeat(32);
    const bundle = await resolveRecipientBundleByWallet({ provider, wallet });
    expect(askedWallet, 'the provider was asked for the recipient wallet').toBe(wallet);
    expect(bundle.keyId, 'derived keyId is the recipient identity keyId').toBe(recipient.encryptionKeyPair.keyId);
    expect(bundle.mlKem768PublicKey, 'ML-KEM key present (snake decoded)').toBeTruthy();
    expect(bundle.scanPublicKey, 'scan key present (needed for an INTRO seal)').toBe(
      Buffer.from(recipient.scanPublicKey).toString('base64url'));
  });

  it('CRB-06: the ungated core fails closed on an unregistered shard', async () => {
    await expect(resolveBundleFromKeyShardView({ exists: false })).rejects.toThrow(/not registered/i);
    await expect(resolveBundleFromKeyShardView({ exists: false })).rejects.toMatchObject({ code: 'PLATHO_RECIPIENT_NOT_ACTIVATED' });
  });

  it('CRB-05: the reply tries every wallet that published the commitment, the recorded one first, and adopts only the one whose KeyShard reproduces the keyId [round 5]', async () => {
    const peer: any = await createMessagingIdentity();
    const impostor: any = await createMessagingIdentity();
    const asked: string[] = [];
    const provider = { getView: async (wallet: string) => { asked.push(wallet); return wallet === 'w-real' ? keyShardViewFor(peer) : keyShardViewFor(impostor); } };
    const bundle = await resolvePeerReplyBundle({ provider, peerWallet: 'w-replay', peerKeyId: peer.encryptionKeyPair.keyId, peerWalletCandidates: ['w-replay', 'w-real'] });
    expect(bundle.keyId).toBe(peer.encryptionKeyPair.keyId);
    expect(asked, 'the recorded wallet first, then the other publisher').toEqual(['w-replay', 'w-real']);
    await expect(resolvePeerReplyBundle({ provider, peerWallet: 'w-replay', peerKeyId: peer.encryptionKeyPair.keyId, peerWalletCandidates: ['w-other'] })).rejects.toThrow(/does not match/i);
    const alone = await resolvePeerReplyBundle({ provider, peerWallet: 'w-real', peerKeyId: peer.encryptionKeyPair.keyId });
    expect(alone.keyId).toBe(peer.encryptionKeyPair.keyId);
  });

});
