import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createMessagingIdentity, exportPublicKeyBundle, createEncryptedIntroCapsule } from '../web/crypto/platho-crypto.mjs';
import { createMemoryConvKeyStore } from '../web/conv-key-store.mjs';
import { createMemoryReplayStore } from '../web/replay-store.mjs';
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

/** Shape a built INTRO as the EXACT delivery the scan runner hands onIntro: `{ ...hit, capsule }`, where the fetched
 *  capsule (the two published cells parsed from BoC + the CONTRACT-stamped created_at + the publish src) is NESTED
 *  under `.capsule`, alongside the hit's r/view_tag/epoch/bucket/entryId. Feeding the flat capsule the handler used to
 *  read would test a shape the runner never produces — the seam-green-while-broken this test now guards. [intro-send review] */
const asScanCapsule = (built: any, created_at: number, source: string | null = null) => ({
  r: 0n, view_tag: built.header0.viewTag, epoch: 0, bucket: 0, entryId: 0,   // hit fields the runner spreads
  capsule: {
    header0: parseBocBase64(built.chainCells.header0.boc),
    body: parseBocBase64(built.chainCells.body.boc),
    r: 0n,
    viewTag: built.header0.viewTag,
    created_at,
    source,
  },
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
      r: 0n, view_tag: builtA.header0.viewTag, epoch: 0, bucket: 0, entryId: 0,
      capsule: {
        header0: parseBocBase64(builtA.chainCells.header0.boc),
        body: parseBocBase64(builtB.chainCells.body.boc),
        r: 0n,
        viewTag: builtA.header0.viewTag,
        created_at: 100,
      },
    };
    await expect(onIntro(frankenstein), 'a mismatched header/body cannot open').rejects.toThrow();
    expect(store.getConversation(recipient.encryptionKeyPair.keyId, sender.encryptionKeyPair.keyId), 'nothing stored for a rejected forgery').toBeNull();
  });

  it('IRH-06: an unfetched body (capsule: null) is named as such — not as a header0 type error', async () => {
    // OBSERVED 2026-08-21: the runner handed over `capsule: null` (toncenter's index had not caught up with the
    // entry), the handler fell through to the hit itself and threw "intro header0 must be a TON cell or BoC
    // payload" — once a minute, naming the wrong problem. The runner now retries such hits itself; the handler's
    // own answer for any other caller has to say what actually happened.
    const recipient: any = await createMessagingIdentity();
    const store = createMemoryConvKeyStore();
    const onIntro = createIntroReceiveHandler({ recipientKeyPair: recipient.encryptionKeyPair, convKeyStore: store });
    const unfetched = { r: 0n, view_tag: 1, epoch: 0, bucket: 0, entryId: 0, capsule: null };
    await expect(onIntro(unfetched)).rejects.toThrow(/was not fetched/);
    await expect(onIntro(unfetched)).rejects.not.toThrow(/must be a TON cell/);
  });

  // ── IRH-04/05: the replay guard has to OUTLIVE a reload (wave-7 audit) ─────────────────────────────────────
  // openIntroCapsuleFromChainCells states it plainly: the intro nonce is the ONLY thing that stops a byte-identical
  // replay, because the transcript signature, the keyId binding and the confirm tag are all valid on a replay by
  // construction — it IS the original capsule, re-published by anyone who read it off the chain. The app used to arm
  // the lane with a MEMORY guard, so every reload started with an empty nonce set.

  it('IRH-04: a guard that survives the reload rejects the replayed capsule; a fresh one accepts it', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const built = await createEncryptedIntroCapsule(exportPublicKeyBundle(recipient.encryptionKeyPair), sender, { firstMessageBytes: utf8('первый контакт') });
    const delivery = () => asScanCapsule(built, 1_790_000_000, '0:' + 'ab'.repeat(32));

    // A store that persists across handler instances is exactly what an IndexedDB-backed guard gives the app.
    const persistentGuard = createMemoryReplayStore();
    const handlerBeforeReload = createIntroReceiveHandler({
      recipientKeyPair: recipient.encryptionKeyPair,
      convKeyStore: createMemoryConvKeyStore(),
      introReplayGuard: persistentGuard,
    });
    expect((await handlerBeforeReload(delivery())).adoption, 'the genuine first contact lands').toBe('created');

    // Reload: a NEW handler and a NEW conv key store, but the SAME guard — the attacker re-publishes the capsule.
    const handlerAfterReload = createIntroReceiveHandler({
      recipientKeyPair: recipient.encryptionKeyPair,
      convKeyStore: createMemoryConvKeyStore(),
      introReplayGuard: persistentGuard,
    });
    await expect(handlerAfterReload(delivery()), 'a surviving guard refuses the replay').rejects.toThrow();

    // And the control: with a guard that forgot everything, the very same replay is accepted as new. This is the
    // behaviour the app shipped before the fix, and it is why the guard must not be memory-only.
    const forgetfulHandler = createIntroReceiveHandler({
      recipientKeyPair: recipient.encryptionKeyPair,
      convKeyStore: createMemoryConvKeyStore(),
      introReplayGuard: createMemoryReplayStore(),
    });
    expect((await forgetfulHandler(delivery())).adoption, 'a forgotten nonce set re-accepts the replay').toBe('created');
  });

  it('IRH-05: the app arms the INTRO lane with a PERSISTENT replay guard, in its own database', () => {
    // A behavioural test on the handler proves nothing about the app if the app hands it a memory store. Read the
    // shipping source: the boot path must build an IndexedDB guard, and it must run before the lane is armed.
    const app = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');

    expect(app, 'a boot step builds the persistent intro guard').toMatch(
      /introReplayGuard\s*=\s*await\s+createIndexedDbReplayStore\(\s*\{\s*dbName:\s*currentIntroReplayDbName\(\)/,
    );
    // Its own database: sharing the private-capsule replay keyspace could mark a real first contact as already-seen.
    expect(app, 'the intro guard has a database of its own').toMatch(/currentIntroReplayDbName[\s\S]{0,400}?platho-intro-replay-v1/);
    expect(app.includes("walletScopedIndexedDbName('platho-intro-replay-v1'"), 'and it is wallet-scoped').toBe(true);

    // Ordering: the guard must be built before armIntroReceiveLane runs, or the lane captures the memory fallback.
    const bootIdx = app.indexOf('await bootIntroReplayGuard()');
    const armIdx = app.indexOf('armIntroReceiveLane().catch');
    expect(bootIdx, 'the boot step is wired into the unlock path').toBeGreaterThan(0);
    expect(bootIdx, 'and it runs before the lane is armed').toBeLessThan(armIdx);
  });
});
