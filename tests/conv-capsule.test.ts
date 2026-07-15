import { describe, it, expect } from 'vitest';
import {
  createMessagingIdentity,
  exportPublicKeyBundle,
  createEncryptedConvCapsule,
  openEncryptedPrivateCapsule,
  verifyEncryptedPrivateCapsule,
  convCapsuleHeader0Bytes,
  CAPSULE_PUBLISH_KIND,
  randomBytes,
} from '../web/crypto/platho-crypto.mjs';

const hex = (b: Uint8Array): string => Buffer.from(b).toString('hex');

describe('CONV capsule build/open round-trip (clean-16 hybrid)', () => {
  it('CONV-CAP-01: recipient opens a CONV capsule → recovers plaintext + sender signing key; header0 is 40B opaque bucketKey', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const recipientBundle = exportPublicKeyBundle(recipient.encryptionKeyPair);
    const bucketKey = randomBytes(32);

    const built = await createEncryptedConvCapsule('привет CONV lane', recipientBundle, sender, bucketKey, {});
    expect(built.kind).toBe('conv');
    expect(built.header0.kind).toBe('conv');
    expect(built.publish.publish_kind).toBe(CAPSULE_PUBLISH_KIND.CONV); // 1
    expect(convCapsuleHeader0Bytes(built.header0).length).toBe(40);
    expect(Buffer.from(built.header0.bucketKey, 'base64url').toString('hex')).toBe(hex(bucketKey));
    // no sender label / view_tag / ephemeral leaked into header0
    expect(built.header0).not.toHaveProperty('senderKeyId');
    expect(built.header0).not.toHaveProperty('viewTag');

    const opened = await openEncryptedPrivateCapsule(built, recipient.encryptionKeyPair, { enforceExpiry: false });
    expect(opened.plaintext).toBe('привет CONV lane');
    expect(hex(opened.senderSigningPublicKey)).toBe(hex(sender.signingPublicKey));
    expect(opened.openedAs).toBe('recipient');
  });

  it('CONV-CAP-02: the sender re-opens its OWN CONV outbox copy via openAsSenderKeyId', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const recipientBundle = exportPublicKeyBundle(recipient.encryptionKeyPair);
    const built = await createEncryptedConvCapsule('outbox echo', recipientBundle, sender, randomBytes(32), {});

    const openedBySender = await openEncryptedPrivateCapsule(built, sender.encryptionKeyPair, {
      enforceExpiry: false,
      openAsSenderKeyId: sender.encryptionKeyPair.keyId,
    });
    expect(openedBySender.plaintext).toBe('outbox echo');
    expect(openedBySender.openedAs).toBe('sender');
  });

  it('CONV-CAP-03: a wrong recipient cannot decrypt (recognition = AES-GCM tag)', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const stranger: any = await createMessagingIdentity();
    const recipientBundle = exportPublicKeyBundle(recipient.encryptionKeyPair);
    const built = await createEncryptedConvCapsule('secret', recipientBundle, sender, randomBytes(32), {});
    await expect(openEncryptedPrivateCapsule(built, stranger.encryptionKeyPair, { enforceExpiry: false })).rejects.toThrow();
  });

  it('CONV-CAP-04: tampering the bucketKey breaks the id/hash (structural integrity)', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const recipientBundle = exportPublicKeyBundle(recipient.encryptionKeyPair);
    const built = await createEncryptedConvCapsule('x', recipientBundle, sender, randomBytes(32), {});
    const tampered = {
      ...built,
      header0: { ...built.header0, bucketKey: Buffer.from(new Uint8Array(32).fill(0x99)).toString('base64url') },
    };
    await expect(openEncryptedPrivateCapsule(tampered, recipient.encryptionKeyPair, { enforceExpiry: false }))
      .rejects.toThrow(/hash mismatch|id mismatch|cell/i);
  });

  it('CONV-CAP-05: a capsule whose top-level kind disagrees with header0.kind is rejected', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const built = await createEncryptedConvCapsule('x', exportPublicKeyBundle(recipient.encryptionKeyPair), sender, randomBytes(32), {});
    const confused = { ...built, kind: 'intro' }; // header0.kind stays 'conv'
    await expect(verifyEncryptedPrivateCapsule(confused, { enforceExpiry: false })).rejects.toThrow(/kind does not match/i);
  });
});
