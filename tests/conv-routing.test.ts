import { describe, it, expect } from 'vitest';
import { createMessagingIdentity } from '../web/crypto/platho-crypto.mjs';
import {
  establishConvKRootInitiator,
  establishConvKRootResponder,
  conversationOrder,
  epochFromCreatedAtSeconds,
  computeKEpoch,
  computeBucketKey,
  outgoingBucketKey,
  incomingBucketKeys,
  computeConvKRootSelf,
  selfRecoveryBucketKey,
  CONV_ROOT_SALT_DOMAIN,
  CONV_ROOT_INFO_DOMAIN,
  CONV_ROOT_SELF_SALT_DOMAIN,
  CONV_ROOT_SELF_INFO_DOMAIN,
  CONV_RATCHET_SALT_DOMAIN,
  CONV_RATCHET_INFO_DOMAIN,
  CONV_BUCKET_SALT_DOMAIN,
  CONV_BUCKET_INFO_DOMAIN,
  CONV_EPOCH_SECONDS,
  CONV_DIR_LO_TO_HI,
  CONV_DIR_HI_TO_LO,
  CONV_SELF_EPOCH_SENTINEL,
  CONV_KEY_BYTES,
} from '../web/crypto/conv-routing.mjs';

const hex = (b: Uint8Array | ArrayBuffer): string => Buffer.from(b as Uint8Array).toString('hex');

async function identity() {
  return (await createMessagingIdentity()).encryptionKeyPair as any;
}

describe('conv-routing (CONV lane key schedule — clean-16 hybrid)', () => {
  it('CONV-ROUTE-00: FROZEN domain strings / pins (conformance)', () => {
    expect(CONV_ROOT_SALT_DOMAIN).toBe('PLATHO.CONV.ROOT.SALT.V1');
    expect(CONV_ROOT_INFO_DOMAIN).toBe('PLATHO.CONV.ROOT.V1');
    expect(CONV_ROOT_SELF_SALT_DOMAIN).toBe('PLATHO.CONV.ROOT.SELF.SALT.V1');
    expect(CONV_ROOT_SELF_INFO_DOMAIN).toBe('PLATHO.CONV.ROOT.SELF.V1');
    expect(CONV_RATCHET_SALT_DOMAIN).toBe('PLATHO.CONV.RATCHET.SALT.V1');
    expect(CONV_RATCHET_INFO_DOMAIN).toBe('PLATHO.CONV.RATCHET.V1');
    expect(CONV_BUCKET_SALT_DOMAIN).toBe('PLATHO.CONV.BUCKET.SALT.V1');
    expect(CONV_BUCKET_INFO_DOMAIN).toBe('PLATHO.CONV.BUCKET.V1');
    expect(CONV_EPOCH_SECONDS).toBe(86400);
    expect(CONV_DIR_LO_TO_HI).toBe(0x00);
    expect(CONV_DIR_HI_TO_LO).toBe(0x01);
    expect(CONV_SELF_EPOCH_SENTINEL).toBe(0);
    expect(CONV_KEY_BYTES).toBe(32);
  });

  it('CONV-ROUTE-01: initiator and responder derive an IDENTICAL K_root (genuine ML-KEM round-trip)', async () => {
    const A = await identity();
    const B = await identity();
    const { kRoot: kA, ctRoot } = await establishConvKRootInitiator({
      selfEncSecretKey: A.x25519SecretKey,
      peerEncPublicKey: B.x25519PublicKey,
      peerMlKem768PublicKey: B.mlKem768PublicKey,
      selfKeyId: A.keyId,
      peerKeyId: B.keyId,
    });
    const { kRoot: kB } = await establishConvKRootResponder({
      selfEncSecretKey: B.x25519SecretKey,
      selfMlKem768SecretKey: B.mlKem768SecretKey,
      peerEncPublicKey: A.x25519PublicKey,
      ctRoot,
      selfKeyId: B.keyId,
      peerKeyId: A.keyId,
    });
    expect(kA.length).toBe(32);
    expect(hex(kA)).toBe(hex(kB));
  });

  it('CONV-ROUTE-02: K_root is GENUINELY randomized — a second intro yields a different K_root (not derandomized)', async () => {
    const A = await identity();
    const B = await identity();
    const args = {
      selfEncSecretKey: A.x25519SecretKey,
      peerEncPublicKey: B.x25519PublicKey,
      peerMlKem768PublicKey: B.mlKem768PublicKey,
      selfKeyId: A.keyId,
      peerKeyId: B.keyId,
    };
    const first = await establishConvKRootInitiator(args);
    const second = await establishConvKRootInitiator(args);
    // fresh ML-KEM encapsulation each time ⇒ different ct_root ⇒ different K_root (proves ss enters K_root, PQ contribution live)
    expect(hex(first.ctRoot)).not.toBe(hex(second.ctRoot));
    expect(hex(first.kRoot)).not.toBe(hex(second.kRoot));
  });

  it('CONV-ROUTE-03: a third party derives a DIFFERENT K_root (per-pair isolation)', async () => {
    const A = await identity();
    const B = await identity();
    const C = await identity();
    const { kRoot: kAB } = await establishConvKRootInitiator({
      selfEncSecretKey: A.x25519SecretKey, peerEncPublicKey: B.x25519PublicKey,
      peerMlKem768PublicKey: B.mlKem768PublicKey, selfKeyId: A.keyId, peerKeyId: B.keyId,
    });
    const { kRoot: kAC } = await establishConvKRootInitiator({
      selfEncSecretKey: A.x25519SecretKey, peerEncPublicKey: C.x25519PublicKey,
      peerMlKem768PublicKey: C.mlKem768PublicKey, selfKeyId: A.keyId, peerKeyId: C.keyId,
    });
    expect(hex(kAB)).not.toBe(hex(kAC));
  });

  it('CONV-ROUTE-04: directions are canonical and OPPOSITE for the two parties', async () => {
    const A = await identity();
    const B = await identity();
    const oa = conversationOrder(A.keyId, B.keyId);
    const ob = conversationOrder(B.keyId, A.keyId);
    expect(hex(oa.lo)).toBe(hex(ob.lo)); // both agree on lo/hi
    expect(hex(oa.hi)).toBe(hex(ob.hi));
    expect(oa.selfIsLo).toBe(!ob.selfIsLo);
    expect(oa.outgoingDir).not.toBe(ob.outgoingDir);
    // A's outgoing direction equals B's incoming direction (they route into the same directional bucket).
    expect(oa.outgoingDir).toBe(ob.incomingDir);
    expect(ob.outgoingDir).toBe(oa.incomingDir);
  });

  it('CONV-ROUTE-05: A outgoing bucket == B incoming bucket (same epoch); B outgoing == A incoming', async () => {
    const A = await identity();
    const B = await identity();
    const { kRoot } = await establishConvKRootInitiator({
      selfEncSecretKey: A.x25519SecretKey, peerEncPublicKey: B.x25519PublicKey,
      peerMlKem768PublicKey: B.mlKem768PublicKey, selfKeyId: A.keyId, peerKeyId: B.keyId,
    });
    const createdAt = CONV_EPOCH_SECONDS * 20000 + 137; // some day boundary + offset
    const epoch = epochFromCreatedAtSeconds(createdAt);

    const aOut = await outgoingBucketKey({ kRoot, selfKeyId: A.keyId, peerKeyId: B.keyId, createdAtSec: createdAt });
    const bInWin = await incomingBucketKeys({ kRoot, selfKeyId: B.keyId, peerKeyId: A.keyId, epochNow: epoch, windowW: 0 });
    expect(bInWin).toHaveLength(1);
    expect(hex(bInWin[0].bucketKey)).toBe(hex(aOut.bucketKey));

    const bOut = await outgoingBucketKey({ kRoot, selfKeyId: B.keyId, peerKeyId: A.keyId, createdAtSec: createdAt });
    const aInWin = await incomingBucketKeys({ kRoot, selfKeyId: A.keyId, peerKeyId: B.keyId, epochNow: epoch, windowW: 0 });
    expect(hex(aInWin[0].bucketKey)).toBe(hex(bOut.bucketKey));

    // the two directions are DISTINCT buckets (else a shared bidirectional bucket would leak the pair)
    expect(hex(aOut.bucketKey)).not.toBe(hex(bOut.bucketKey));
    // bucketKey is opaque: not the keyId, 32 bytes
    expect(aOut.bucketKey.length).toBe(32);
    expect(hex(aOut.bucketKey)).not.toBe(hex(conversationOrder(A.keyId, B.keyId).lo));
  });

  it('CONV-ROUTE-06: different epochs → different buckets; window covers [now-W..now]', async () => {
    const A = await identity();
    const B = await identity();
    const { kRoot } = await establishConvKRootInitiator({
      selfEncSecretKey: A.x25519SecretKey, peerEncPublicKey: B.x25519PublicKey,
      peerMlKem768PublicKey: B.mlKem768PublicKey, selfKeyId: A.keyId, peerKeyId: B.keyId,
    });
    const kE10 = await computeKEpoch(kRoot, 10);
    const kE11 = await computeKEpoch(kRoot, 11);
    const b10 = await computeBucketKey(kE10, CONV_DIR_LO_TO_HI, 10);
    const b11 = await computeBucketKey(kE11, CONV_DIR_LO_TO_HI, 11);
    expect(hex(b10)).not.toBe(hex(b11));

    const win = await incomingBucketKeys({ kRoot, selfKeyId: A.keyId, peerKeyId: B.keyId, epochNow: 100, windowW: 2 });
    expect(win.map((w) => w.epoch)).toEqual([98, 99, 100]);
  });

  it('CONV-ROUTE-07: epoch from createdAt is floor(seconds/86400)', () => {
    expect(epochFromCreatedAtSeconds(CONV_EPOCH_SECONDS * 5 + 100)).toBe(5);
    expect(epochFromCreatedAtSeconds(0)).toBe(0);
    expect(epochFromCreatedAtSeconds(CONV_EPOCH_SECONDS - 1)).toBe(0);
  });

  it('CONV-ROUTE-08: self-recovery lane is deterministic from the seed (survives reinstall) and seed-isolated', async () => {
    const seed1 = new Uint8Array(64).fill(7);
    const seed2 = new Uint8Array(64).fill(9);
    const kSelfA = await computeConvKRootSelf(seed1);
    const kSelfB = await computeConvKRootSelf(seed1);
    expect(hex(kSelfA)).toBe(hex(kSelfB));
    expect(hex(await computeConvKRootSelf(seed2))).not.toBe(hex(kSelfA));

    const bucketA = await selfRecoveryBucketKey(seed1);
    const bucketB = await selfRecoveryBucketKey(seed1);
    expect(bucketA.length).toBe(32);
    expect(hex(bucketA)).toBe(hex(bucketB)); // one fixed bucket, found in ONE lookup regardless of time
    expect(hex(await selfRecoveryBucketKey(seed2))).not.toBe(hex(bucketA));
  });

  it('CONV-ROUTE-09: conversationOrder rejects self==peer (self-pair uses the self lane)', async () => {
    const A = await identity();
    expect(() => conversationOrder(A.keyId, A.keyId)).toThrow(/self keyId equals peer/i);
  });
});
