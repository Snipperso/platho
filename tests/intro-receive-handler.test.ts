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

/** Shape a built INTRO as what fetchIntroCapsule delivers: the two published cells (parsed from their BoC) + the
 *  CONTRACT-stamped created_at (the field name fetchIntroCapsule actually surfaces — the adoption ordering key). */
const asScanCapsule = (built: any, created_at: number, source: string | null = null) => ({
  header0: parseBocBase64(built.chainCells.header0.boc),
  body: parseBocBase64(built.chainCells.body.boc),
  r: 0n,
  viewTag: built.header0.viewTag,
  created_at,
  source,
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

    const senderWallet = '0:' + 'ab'.repeat(32);
    const opened = await onIntro(asScanCapsule(built, 1_790_000_000, senderWallet));
    expect(opened.adoption).toBe('created');

    const rec = store.getConversation(recipient.encryptionKeyPair.keyId, opened.senderKeyId);
    expect(rec, 'the conversation is now in the store').not.toBeNull();
    expect(hex(rec.kRootCurrent), 'the store holds the SAME pairwise root the sender minted').toBe(hex(built.kRoot));
    // The INTRO tx src is captured as peerWallet so a reply can resolve the sender's full bundle (KeyShard). [Y]
    expect(rec.peerWallet, 'the INTRO publish source is stored for reply-bundle resolution').toBe(senderWallet);
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

  it('IRH-03: no resolver is required (auth moved into the handshake), and a corrupted first contact stores nothing', async () => {
    const recipient: any = await createMessagingIdentity();
    const store = createMemoryConvKeyStore();
    // (a) construction WITHOUT a resolveVaultKeyRecord now SUCCEEDS — first-contact authenticity moved into the handshake
    // crypto (keyId binding + K_root confirm), so the handler no longer demands a chain resolver. [auth-crypto-binding]
    const onIntro = createIntroReceiveHandler({ recipientKeyPair: recipient.encryptionKeyPair, convKeyStore: store });

    // (b) fail-closed on a broken first contact: header0 from one capsule + body from another cannot open (the body AEAD
    // binds the header hashes), so onIntro rejects and NOTHING lands in the store — a garbage/forged scan is inert.
    const sender: any = await createMessagingIdentity();
    const bundle = exportPublicKeyBundle(recipient.encryptionKeyPair);
    const builtA = await createEncryptedIntroCapsule(bundle, sender, { firstMessageBytes: utf8('a') });
    const builtB = await createEncryptedIntroCapsule(bundle, sender, { firstMessageBytes: utf8('b') });
    const frankenstein = {
      header0: parseBocBase64(builtA.chainCells.header0.boc),
      body: parseBocBase64(builtB.chainCells.body.boc),
      r: 0n,
      viewTag: builtA.header0.viewTag,
      created_at: 100,
    };
    await expect(onIntro(frankenstein), 'a mismatched header/body cannot open').rejects.toThrow();
    expect(store.getConversation(recipient.encryptionKeyPair.keyId, sender.encryptionKeyPair.keyId), 'nothing stored for a rejected forgery').toBeNull();
  });
});
