import { describe, expect, it } from 'vitest';
import { createMessagingIdentity, exportPublicKeyBundle, createEncryptedIntroCapsule } from '../web/crypto/platho-crypto.mjs';
import { createMemoryConvKeyStore } from '../web/conv-key-store.mjs';
import { createIntroReceiveHandler } from '../web/intro-receive-handler.mjs';
import { parseBocBase64 } from '../web/pwa-contract-transactions.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// INTRO-RECEIVE-HANDLER — the onIntro seam that turns a scanned first contact into an established conversation.
// End-to-end through REAL crypto: a genuine INTRO capsule, delivered as the two on-chain cells the scan would hand
// over, must land the SAME pairwise K_root in the store that the sender minted — else CONV receive/send is dead.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const hex = (b: Uint8Array): string => Buffer.from(b).toString('hex');
const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
const fromUtf8 = (b: Uint8Array): string => new TextDecoder().decode(b);

/** Shape a built INTRO as what fetchIntroCapsule delivers: the two published cells (parsed from their BoC). */
const asScanCapsule = (built: any, createdAt: number) => ({
  header0: parseBocBase64(built.chainCells.header0.boc),
  body: parseBocBase64(built.chainCells.body.boc),
  r: 0n,
  viewTag: built.header0.viewTag,
  createdAt,
});

describe('INTRO-RECEIVE-HANDLER', () => {
  it('IRH-01: a scanned INTRO establishes the pairwise K_root in the conv key store + surfaces the first message', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const built = await createEncryptedIntroCapsule(exportPublicKeyBundle(recipient.encryptionKeyPair), sender, { firstMessageBytes: utf8('привет') });

    const store = createMemoryConvKeyStore();
    let firstContact: any = null;
    const onIntro = createIntroReceiveHandler({
      recipientKeyPair: recipient.encryptionKeyPair,
      convKeyStore: store,
      onFirstContact: (r: any) => { firstContact = r; },
    });

    const opened = await onIntro(asScanCapsule(built, 1_790_000_000));
    expect(opened.adoption).toBe('created');

    const rec = store.getConversation(recipient.encryptionKeyPair.keyId, opened.senderKeyId);
    expect(rec, 'the conversation is now in the store').not.toBeNull();
    expect(hex(rec.kRootCurrent), 'the store holds the SAME pairwise root the sender minted').toBe(hex(built.kRoot));
    expect(fromUtf8(firstContact.firstMessageBytes), 'the first message is surfaced to the app').toBe('привет');
  });

  it('IRH-02: a re-INTRO adopts newest-by-createdAt through the handler (no silent fork)', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const store = createMemoryConvKeyStore();
    const onIntro = createIntroReceiveHandler({ recipientKeyPair: recipient.encryptionKeyPair, convKeyStore: store });

    // Two DISTINCT first contacts (each mints its own K_root). The later-created one must win regardless of order.
    const introA = await createEncryptedIntroCapsule(exportPublicKeyBundle(recipient.encryptionKeyPair), sender, {});
    const introB = await createEncryptedIntroCapsule(exportPublicKeyBundle(recipient.encryptionKeyPair), sender, {});

    const a = await onIntro(asScanCapsule(introA, 200));   // adopted (created)
    const b = await onIntro(asScanCapsule(introB, 100));   // older -> retained, does NOT clobber
    expect(a.adoption).toBe('created');
    expect(b.adoption).toBe('retained');

    const rec = store.getConversation(recipient.encryptionKeyPair.keyId, a.senderKeyId);
    expect(hex(rec.kRootCurrent), 'the newer-created intro root stays current').toBe(hex(introA.kRoot));
    expect(rec.kRootsForRead.length, 'the older root is kept only for decrypting its history').toBe(1);
  });
});
