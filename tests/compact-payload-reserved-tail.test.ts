import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  compactPayloadReservedTailBytes,
  encodeCompactPayload,
  createEncryptedConvCapsule,
  createMessagingIdentity,
  exportPublicKeyBundle,
  PLATHO_COMPACT_IDENTITY_BYTES,
  PLATHO_COMPACT_SENDER_RECOVERY_BYTES,
} from '../web/crypto/platho-crypto.mjs';

// A caller that PRE-ENCODES its payload (the CONV multi-part send does, to split a document across parts) must reserve
// exactly what the sealer will carve out. app.js reserved only the sender-recovery section and missed the 68-byte
// identity one that clean-16 added, so the useful size came out 68 bytes off every size class and EVERY message after
// the first contact died on "Compact payload must use a supported useful slot size". The conversation established and
// then could not be used — the failure sat one step past the one everybody was watching.
describe('COMPACT-TAIL — the pre-encoder and the sealer must reserve the same bytes', () => {
  it('TAIL-01: the shared helper is the sum of both carved sections', () => {
    expect(compactPayloadReservedTailBytes({ senderRecovery: true }))
      .toBe(PLATHO_COMPACT_IDENTITY_BYTES + PLATHO_COMPACT_SENDER_RECOVERY_BYTES);
    expect(compactPayloadReservedTailBytes({ senderRecovery: false })).toBe(PLATHO_COMPACT_IDENTITY_BYTES);
    expect(compactPayloadReservedTailBytes()).toBe(compactPayloadReservedTailBytes({ senderRecovery: true }));
  });

  it('TAIL-02: a payload pre-encoded with the helper seals as a CONV capsule', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const bundle = exportPublicKeyBundle(recipient.encryptionKeyPair);
    const payloadBytes = encodeCompactPayload({
      type: 'document',
      bytes: new Uint8Array(64).fill(7),
      sizeClass: 1,
      streamId: new Uint8Array(16).fill(1),
      partIndex: 0,
      partCount: 1,
      reservedTailBytes: compactPayloadReservedTailBytes({ senderRecovery: true }),
    });
    const capsule: any = await createEncryptedConvCapsule('', bundle, sender, new Uint8Array(32).fill(3), {
      payloadBytes, sizeClass: 1, senderRecovery: true, now: 1785693962000,
    });
    expect(capsule).toBeTruthy();
  });

  it('TAIL-03: the OLD reservation is rejected — the guard must fail on what production actually did', async () => {
    // The counter-case, and the whole point: reserving only the sender-recovery section must NOT seal. Without this
    // TAIL-02 alone would pass against a sealer that ignored the reservation entirely.
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const bundle = exportPublicKeyBundle(recipient.encryptionKeyPair);
    const payloadBytes = encodeCompactPayload({
      type: 'document',
      bytes: new Uint8Array(64).fill(7),
      sizeClass: 1,
      streamId: new Uint8Array(16).fill(1),
      partIndex: 0,
      partCount: 1,
      reservedTailBytes: PLATHO_COMPACT_SENDER_RECOVERY_BYTES,   // what app.js used to pass
    });
    await expect(createEncryptedConvCapsule('', bundle, sender, new Uint8Array(32).fill(3), {
      payloadBytes, sizeClass: 1, senderRecovery: true, now: 1785693962000,
    })).rejects.toThrow(/slot size|size class/i);
  });

  it('TAIL-04: the CONV send call site derives its reservation instead of restating the formula', () => {
    // The formula existed in four places and the fifth copy is what broke. Pin that the call site does not grow a
    // sixth: a literal here is exactly how this returns.
    const app = readFileSync('web/app.js', 'utf8');
    expect(app).toContain('reservedTailBytes: compactPayloadReservedTailBytes({ senderRecovery: true }),');
    expect(app).not.toContain('reservedTailBytes: PLATHO_COMPACT_SENDER_RECOVERY_BYTES,');
  });
});
