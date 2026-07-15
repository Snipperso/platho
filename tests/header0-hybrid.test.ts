import { describe, it, expect } from 'vitest';
import {
  convCapsuleHeader0Bytes,
  convCapsuleHeader0ObjectFromBytes,
  introCapsuleHeader0Bytes,
  introCapsuleHeader0ObjectFromBytes,
  PLATHO_BINARY_HEADER0_BYTES_CONV,
  PLATHO_BINARY_HEADER0_BYTES_INTRO,
  CAPSULE_PUBLISH_KIND,
  CAPSULE_SIZE_CLASS,
  CONTRACT_CRYPTO_SUITE,
  CRYPTO_SUITES,
  randomBytes,
} from '../web/crypto/platho-crypto.mjs';

const hex = (b: Uint8Array): string => Buffer.from(b).toString('hex');
const PH0C = '50483043';

const baseMeta = {
  version: 1,
  sizeClass: CAPSULE_SIZE_CLASS.KIB_1,
  cryptoSuite: CONTRACT_CRYPTO_SUITE.HYBRID, // 2
  suite: CRYPTO_SUITES.HYBRID_V1,
};

describe('clean-16 hybrid header0 split (CONV 40B / INTRO 42B)', () => {
  it('HDR-00: FROZEN size pins and publish_kind values', () => {
    expect(PLATHO_BINARY_HEADER0_BYTES_CONV).toBe(40);
    expect(PLATHO_BINARY_HEADER0_BYTES_INTRO).toBe(42);
    expect(CAPSULE_PUBLISH_KIND.CONV).toBe(1);
    expect(CAPSULE_PUBLISH_KIND.PRIVATE).toBe(1);
    expect(CAPSULE_PUBLISH_KIND.INTRO).toBe(3);
    expect(CONTRACT_CRYPTO_SUITE.HYBRID).toBe(2);
  });

  it('HDR-01: CONV header0 round-trips (40 bytes; bucketKey at 8..40; meta layout)', () => {
    const bucketKey = randomBytes(32);
    const bytes = convCapsuleHeader0Bytes({ ...baseMeta, publishKind: CAPSULE_PUBLISH_KIND.CONV, bucketKey });
    expect(bytes.length).toBe(40);
    // meta layout
    expect(hex(bytes.subarray(0, 4))).toBe(PH0C);
    expect(bytes[4]).toBe(1);                                  // version
    expect(bytes[5]).toBe(CAPSULE_PUBLISH_KIND.CONV);          // publishKind = 1
    expect(bytes[6]).toBe(CAPSULE_SIZE_CLASS.KIB_1);           // sizeClass
    expect(bytes[7]).toBe(CONTRACT_CRYPTO_SUITE.HYBRID);       // cryptoSuite = 2
    // bucketKey occupies bytes 8..40 = bits 64..320 (the exact window the contract extractor reads)
    expect(hex(bytes.subarray(8, 40))).toBe(hex(bucketKey));

    const obj = convCapsuleHeader0ObjectFromBytes(bytes);
    expect(obj.kind).toBe('conv');
    expect(obj.publishKind).toBe(1);
    expect(Buffer.from(obj.bucketKey, 'base64url').toString('hex')).toBe(hex(bucketKey));
  });

  it('HDR-02: INTRO header0 round-trips (42 bytes; ephemeral_R at 8..40, view_tag at 40..42)', () => {
    const ephemeralR = randomBytes(32);
    const viewTag = 0xa15e;
    const bytes = introCapsuleHeader0Bytes({ ...baseMeta, publishKind: CAPSULE_PUBLISH_KIND.INTRO, ephemeralR, viewTag });
    expect(bytes.length).toBe(42);
    expect(hex(bytes.subarray(0, 4))).toBe(PH0C);
    expect(bytes[5]).toBe(CAPSULE_PUBLISH_KIND.INTRO);         // publishKind = 3
    expect(hex(bytes.subarray(8, 40))).toBe(hex(ephemeralR));  // bits 64..320
    expect((bytes[40] << 8) | bytes[41]).toBe(viewTag);        // bits 320..336

    const obj = introCapsuleHeader0ObjectFromBytes(bytes);
    expect(obj.kind).toBe('intro');
    expect(obj.publishKind).toBe(3);
    expect(Buffer.from(obj.ephemeralR, 'base64url').toString('hex')).toBe(hex(ephemeralR));
    expect(obj.viewTag).toBe(viewTag);
  });

  it('HDR-03: lane discriminator is enforced (wrong publishKind / cross-lane parse rejected)', () => {
    const bucketKey = randomBytes(32);
    const ephemeralR = randomBytes(32);
    // CONV builder refuses INTRO kind and vice versa
    expect(() => convCapsuleHeader0Bytes({ ...baseMeta, publishKind: CAPSULE_PUBLISH_KIND.INTRO, bucketKey })).toThrow(/publishKind/i);
    expect(() => introCapsuleHeader0Bytes({ ...baseMeta, publishKind: CAPSULE_PUBLISH_KIND.CONV, ephemeralR, viewTag: 1 })).toThrow(/publishKind/i);
    // a CONV (40B) cell cannot be parsed as INTRO (42B) — size drift is fail-closed
    const conv = convCapsuleHeader0Bytes({ ...baseMeta, publishKind: CAPSULE_PUBLISH_KIND.CONV, bucketKey });
    expect(() => introCapsuleHeader0ObjectFromBytes(conv)).toThrow(/size drift/i);
    // an INTRO cell with CONV publishKind byte is rejected by the CONV parser (publishKind mismatch), and its length (42) also drifts
    const intro = introCapsuleHeader0Bytes({ ...baseMeta, publishKind: CAPSULE_PUBLISH_KIND.INTRO, ephemeralR, viewTag: 7 });
    expect(() => convCapsuleHeader0ObjectFromBytes(intro)).toThrow(/size drift/i);
  });

  it('HDR-04: default view_tag is 0 and CONV carries no ephemeral/view_tag (no sender-linkable field)', () => {
    const bytes = introCapsuleHeader0Bytes({ ...baseMeta, publishKind: CAPSULE_PUBLISH_KIND.INTRO, ephemeralR: randomBytes(32) });
    expect(introCapsuleHeader0ObjectFromBytes(bytes).viewTag).toBe(0);
    // CONV is exactly meta(8)+bucketKey(32); there is no room for an ephemeral or a view_tag
    const conv = convCapsuleHeader0Bytes({ ...baseMeta, publishKind: CAPSULE_PUBLISH_KIND.CONV, bucketKey: randomBytes(32) });
    expect(conv.length).toBe(40);
    expect(convCapsuleHeader0ObjectFromBytes(conv)).not.toHaveProperty('viewTag');
  });
});
