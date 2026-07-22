import { describe, it, expect } from 'vitest';
import {
  createMessagingIdentity,
  exportPublicKeyBundle,
  createEncryptedIntroCapsule,
  openEncryptedIntroCapsule,
  openIntroCapsuleFromChainCells,
  introCapsuleHeader0Bytes,
  CAPSULE_PUBLISH_KIND,
} from '../web/crypto/platho-crypto.mjs';

const hex = (b: Uint8Array): string => Buffer.from(b).toString('hex');
const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
const fromUtf8 = (b: Uint8Array): string => new TextDecoder().decode(b);

describe('INTRO capsule build/open round-trip (clean-16 hybrid first contact)', () => {
  it('INTRO-CAP-01: recipient opens → SAME pairwise K_root as sender + sender identity + first message', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const recipientBundle = exportPublicKeyBundle(recipient.encryptionKeyPair);

    const built = await createEncryptedIntroCapsule(recipientBundle, sender, { firstMessageBytes: utf8('первое сообщение') });
    expect(built.kind).toBe('intro');
    expect(built.publish.publish_kind).toBe(CAPSULE_PUBLISH_KIND.INTRO); // 3
    expect(introCapsuleHeader0Bytes(built.header0).length).toBe(42);
    expect(built.kRoot.length).toBe(32);

    const opened = await openEncryptedIntroCapsule(built, recipient.encryptionKeyPair, { enforceExpiry: false });
    // the whole point: both sides derive the SAME pairwise CONV root from the handshake
    expect(hex(opened.kRoot)).toBe(hex(built.kRoot));
    expect(hex(opened.senderEncPublicKey)).toBe(hex(sender.encryptionKeyPair.x25519PublicKey));
    expect(hex(opened.senderSigningPublicKey)).toBe(hex(sender.signingPublicKey));
    expect(Buffer.from(opened.senderKeyId).toString('base64url')).toBe(sender.encryptionKeyPair.keyId);
    expect(fromUtf8(opened.firstMessageBytes)).toBe('первое сообщение');
  });

  it('INTRO-CAP-CHAIN: opened from the 2-CELL on-chain form (canonical header1) derives the SAME K_root', async () => {
    // This is the fix that makes INTRO RECEIVE possible. IntroPublish stores only ^header_0 ^body — header1 is NOT
    // published, to keep the stealth first-contact entry minimal. The recipient reconstructs the CANONICAL header1
    // (introCanonicalHeader1) and opens from just those two cells; if header1 were per-message it could never be
    // recovered and receive would be dead. [OWNER 2026-07-22: the "do it right" fix, canonicalise not publish.]
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const built = await createEncryptedIntroCapsule(exportPublicKeyBundle(recipient.encryptionKeyPair), sender, { firstMessageBytes: utf8('через цепь') });

    // exactly what fetchIntroCapsule surfaces from the shard: the two published cells' bytes, nothing else. The snake
    // payload stores its bytes as base64url chunks (concatenated = the on-chain cell content).
    const bytesOf = (p: any): Uint8Array => Buffer.concat(p.chunks.map((c: string) => Buffer.from(c, 'base64url')));
    const header0Bytes = bytesOf(built.chainCells.header0);
    const bodyBytes = bytesOf(built.chainCells.body);

    const opened = await openIntroCapsuleFromChainCells(header0Bytes, bodyBytes, recipient.encryptionKeyPair, { enforceExpiry: false });
    expect(hex(opened.kRoot), 'recipient derives the SAME pairwise K_root from 2 cells').toBe(hex(built.kRoot));
    expect(hex(opened.senderEncPublicKey)).toBe(hex(sender.encryptionKeyPair.x25519PublicKey));
    expect(Buffer.from(opened.senderKeyId).toString('base64url')).toBe(sender.encryptionKeyPair.keyId);
    expect(fromUtf8(opened.firstMessageBytes)).toBe('через цепь');

    // a stranger cannot open the chain form either (decrypt fails on the wrong recipient key)
    const stranger: any = await createMessagingIdentity();
    await expect(openIntroCapsuleFromChainCells(header0Bytes, bodyBytes, stranger.encryptionKeyPair, { enforceExpiry: false })).rejects.toThrow();
  });

  it('INTRO-CAP-02: works with no first message (pure handshake)', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const built = await createEncryptedIntroCapsule(exportPublicKeyBundle(recipient.encryptionKeyPair), sender, {});
    const opened = await openEncryptedIntroCapsule(built, recipient.encryptionKeyPair, { enforceExpiry: false });
    expect(hex(opened.kRoot)).toBe(hex(built.kRoot));
    expect(opened.firstMessageBytes.length).toBe(0);
  });

  it('INTRO-CAP-03: a wrong recipient cannot open (decrypt fails)', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const stranger: any = await createMessagingIdentity();
    const built = await createEncryptedIntroCapsule(exportPublicKeyBundle(recipient.encryptionKeyPair), sender, {});
    await expect(openEncryptedIntroCapsule(built, stranger.encryptionKeyPair, { enforceExpiry: false })).rejects.toThrow();
  });

  it('INTRO-CAP-06: resolveVaultKeyRecord binds the sender to the LIVE Vault record (honest sender opens)', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const built = await createEncryptedIntroCapsule(exportPublicKeyBundle(recipient.encryptionKeyPair), sender, {});
    const resolveVaultKeyRecord = async (_keyId: string) => ({
      signingPublicKey: sender.signingPublicKey,
      x25519PublicKey: sender.encryptionKeyPair.x25519PublicKey,
      mlKem768PublicKey: sender.encryptionKeyPair.mlKem768PublicKey,
    });
    const opened = await openEncryptedIntroCapsule(built, recipient.encryptionKeyPair, { enforceExpiry: false, resolveVaultKeyRecord });
    expect(hex(opened.kRoot)).toBe(hex(built.kRoot));
  });

  it('INTRO-CAP-07: resolveVaultKeyRecord REJECTS a sender whose in-body key ≠ the registered Vault key (impersonation)', async () => {
    const sender: any = await createMessagingIdentity();
    const impostorKeys: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const built = await createEncryptedIntroCapsule(exportPublicKeyBundle(recipient.encryptionKeyPair), sender, {});
    // the Vault record for this keyId carries a DIFFERENT signing key than the one signed into the body
    const resolveVaultKeyRecord = async (_keyId: string) => ({
      signingPublicKey: impostorKeys.signingPublicKey,
      x25519PublicKey: sender.encryptionKeyPair.x25519PublicKey,
      mlKem768PublicKey: sender.encryptionKeyPair.mlKem768PublicKey,
    });
    await expect(openEncryptedIntroCapsule(built, recipient.encryptionKeyPair, { enforceExpiry: false, resolveVaultKeyRecord }))
      .rejects.toThrow(/does not match the Vault|impersonation/i);
  });

  it('INTRO-CAP-05: introReplayGuard makes a byte-identical replay fail-closed', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const built = await createEncryptedIntroCapsule(exportPublicKeyBundle(recipient.encryptionKeyPair), sender, {});
    const seen = new Set<string>();
    const introReplayGuard = { has: (k: string) => seen.has(k), add: (k: string) => { seen.add(k); } };
    const first = await openEncryptedIntroCapsule(built, recipient.encryptionKeyPair, { enforceExpiry: false, introReplayGuard });
    expect(first.kRoot.length).toBe(32);
    await expect(openEncryptedIntroCapsule(built, recipient.encryptionKeyPair, { enforceExpiry: false, introReplayGuard }))
      .rejects.toThrow(/replay/i);
  });

  it('INTRO-CAP-04: tampering header0 view_tag breaks structural integrity (header0 hash is bound)', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const built = await createEncryptedIntroCapsule(exportPublicKeyBundle(recipient.encryptionKeyPair), sender, {});
    const tampered = { ...built, header0: { ...built.header0, viewTag: (built.header0.viewTag ^ 0x1) & 0xffff } };
    await expect(openEncryptedIntroCapsule(tampered, recipient.encryptionKeyPair, { enforceExpiry: false }))
      .rejects.toThrow(/hash mismatch|id mismatch|verification failed|cell/i);
  });
});
