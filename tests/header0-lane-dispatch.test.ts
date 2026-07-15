import { describe, it, expect } from 'vitest';
import {
  computePrivateCapsuleHeaderHashes,
  convCapsuleHeader0Bytes,
  introCapsuleHeader0Bytes,
  CAPSULE_PUBLISH_KIND,
  CAPSULE_SIZE_CLASS,
  CONTRACT_CRYPTO_SUITE,
  CRYPTO_SUITES,
} from '../web/crypto/platho-crypto.mjs';

const meta = {
  version: 1,
  sizeClass: CAPSULE_SIZE_CLASS.KIB_1,
  cryptoSuite: CONTRACT_CRYPTO_SUITE.HYBRID,
  suite: CRYPTO_SUITES.HYBRID_V1,
};
const header1 = {
  version: 1,
  flags: 0,
  createdAt: 1_800_000_000_000,
  expiresAt: 1_800_000_100_000,
  clientNonce: Buffer.from(new Uint8Array(16).fill(0x33)).toString('base64url'),
};
const bucketKey = new Uint8Array(32).fill(0x11);
const ephemeralR = new Uint8Array(32).fill(0x22);

const convH0 = { ...meta, kind: 'conv', publishKind: CAPSULE_PUBLISH_KIND.CONV, bucketKey };
const introH0 = { ...meta, kind: 'intro', publishKind: CAPSULE_PUBLISH_KIND.INTRO, ephemeralR, viewTag: 0x1234 };

describe('header0 lane dispatcher through the chain-cell / hash machinery', () => {
  it('DISP-01: CONV and INTRO header0 objects serialize to their lane sizes', () => {
    expect(convCapsuleHeader0Bytes(convH0).length).toBe(40);
    expect(introCapsuleHeader0Bytes(introH0).length).toBe(42);
  });

  it('DISP-02: header hashes are deterministic per lane (dispatcher routes CONV → 40B cell, INTRO → 42B cell)', async () => {
    const c1 = await computePrivateCapsuleHeaderHashes(convH0, header1);
    const c2 = await computePrivateCapsuleHeaderHashes(convH0, header1);
    expect(c1.header0Hash).toBe(c2.header0Hash);
    expect(c1.header1Hash).toBe(c2.header1Hash);
    expect(c1.header0Hash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('DISP-03: different lanes over the same header1 yield different header0 hashes, same header1 hash', async () => {
    const conv = await computePrivateCapsuleHeaderHashes(convH0, header1);
    const intro = await computePrivateCapsuleHeaderHashes(introH0, header1);
    expect(conv.header0Hash).not.toBe(intro.header0Hash);
    expect(conv.header1Hash).toBe(intro.header1Hash); // header1 is lane-independent
  });

  it('DISP-04: a bucketKey change flips the CONV header0 hash (routing field is bound)', async () => {
    const a = await computePrivateCapsuleHeaderHashes(convH0, header1);
    const b = await computePrivateCapsuleHeaderHashes({ ...convH0, bucketKey: new Uint8Array(32).fill(0x99) }, header1);
    expect(a.header0Hash).not.toBe(b.header0Hash);
  });
});
