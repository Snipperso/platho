import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createMessagingIdentity, exportPublicKeyBundle, createEncryptedIntroCapsule } from '../web/crypto/platho-crypto.mjs';
import { createMemoryConvKeyStore } from '../web/conv-key-store.mjs';
import { createMemoryReplayStore } from '../web/replay-store.mjs';
import { createIntroReceiveHandler } from '../web/intro-receive-handler.mjs';
import { parseBocBase64 } from '../web/pwa-contract-transactions.mjs';


const hex = (b: Uint8Array): string => Buffer.from(b).toString('hex');
const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
const fromUtf8 = (b: Uint8Array): string => new TextDecoder().decode(b);

const asScanCapsule = (built: any, created_at: number, source: string | null = null) => ({
  r: 0n, view_tag: built.header0.viewTag, epoch: 0, bucket: 0, entryId: 0,
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
    expect(rec.peerWallet, 'the INTRO publish source is stored for reply-bundle resolution').toBe(senderWallet);
    expect(fromUtf8(firstContact.firstMessageBytes), 'the first message is surfaced to the app').toBe('привет');
  });

  it('IRH-02: a re-INTRO adopts newest-by-createdAt through the handler (no silent fork)', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const store = createMemoryConvKeyStore();
    const onIntro = createIntroReceiveHandler({ recipientKeyPair: recipient.encryptionKeyPair, convKeyStore: store });

    const introA = await createEncryptedIntroCapsule(exportPublicKeyBundle(recipient.encryptionKeyPair), sender, {});
    const introB = await createEncryptedIntroCapsule(exportPublicKeyBundle(recipient.encryptionKeyPair), sender, {});

    const a = await onIntro(asScanCapsule(introA, 200));
    const b = await onIntro(asScanCapsule(introB, 100));
    expect(a.adoption).toBe('created');
    expect(b.adoption).toBe('retained');

    const rec = store.getConversation(recipient.encryptionKeyPair.keyId, a.senderKeyId);
    expect(hex(rec.kRootCurrent), 'the newer-created intro root stays current').toBe(hex(introA.kRoot));
    expect(rec.kRootsForRead.length, 'the older root is kept only for decrypting its history').toBe(1);
  });

  it('IRH-03: no resolver is required (auth moved into the handshake), and a corrupted first contact stores nothing', async () => {
    const recipient: any = await createMessagingIdentity();
    const store = createMemoryConvKeyStore();
    const onIntro = createIntroReceiveHandler({ recipientKeyPair: recipient.encryptionKeyPair, convKeyStore: store });

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
    const recipient: any = await createMessagingIdentity();
    const store = createMemoryConvKeyStore();
    const onIntro = createIntroReceiveHandler({ recipientKeyPair: recipient.encryptionKeyPair, convKeyStore: store });
    const unfetched = { r: 0n, view_tag: 1, epoch: 0, bucket: 0, entryId: 0, capsule: null };
    await expect(onIntro(unfetched)).rejects.toThrow(/was not fetched/);
    await expect(onIntro(unfetched)).rejects.not.toThrow(/must be a TON cell/);
  });

  it('IRH-07: a replay still throws (IRH-04), and the throw is TAGGED so the runner can retire it', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const built = await createEncryptedIntroCapsule(exportPublicKeyBundle(recipient.encryptionKeyPair), sender, { firstMessageBytes: utf8('дважды') });
    const guard = createMemoryReplayStore();
    const onIntro = createIntroReceiveHandler({ recipientKeyPair: recipient.encryptionKeyPair, convKeyStore: createMemoryConvKeyStore(), introReplayGuard: guard });
    expect((await onIntro(asScanCapsule(built, 1_790_000_000, '0:' + 'ab'.repeat(32)))).adoption).toBe('created');
    let caught: any = null;
    try { await onIntro(asScanCapsule(built, 1_790_000_001, '0:' + 'ab'.repeat(32))); } catch (error) { caught = error; }
    expect(caught, 'the copy is refused').not.toBeNull();
    expect(String(caught.message)).toMatch(/replay/i);
    expect(caught.code, 'and the refusal is named').toBe('INTRO_REPLAY');
  });


  it('IRH-04: a guard that survives the reload rejects the replayed capsule; a fresh one accepts it', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const built = await createEncryptedIntroCapsule(exportPublicKeyBundle(recipient.encryptionKeyPair), sender, { firstMessageBytes: utf8('первый контакт') });
    const delivery = () => asScanCapsule(built, 1_790_000_000, '0:' + 'ab'.repeat(32));

    const persistentGuard = createMemoryReplayStore();
    const handlerBeforeReload = createIntroReceiveHandler({
      recipientKeyPair: recipient.encryptionKeyPair,
      convKeyStore: createMemoryConvKeyStore(),
      introReplayGuard: persistentGuard,
    });
    expect((await handlerBeforeReload(delivery())).adoption, 'the genuine first contact lands').toBe('created');

    const handlerAfterReload = createIntroReceiveHandler({
      recipientKeyPair: recipient.encryptionKeyPair,
      convKeyStore: createMemoryConvKeyStore(),
      introReplayGuard: persistentGuard,
    });
    await expect(handlerAfterReload(delivery()), 'a surviving guard refuses the replay').rejects.toThrow();

    const forgetfulHandler = createIntroReceiveHandler({
      recipientKeyPair: recipient.encryptionKeyPair,
      convKeyStore: createMemoryConvKeyStore(),
      introReplayGuard: createMemoryReplayStore(),
    });
    expect((await forgetfulHandler(delivery())).adoption, 'a forgotten nonce set re-accepts the replay').toBe('created');
  });

  it('IRH-05: the app arms the INTRO lane with a PERSISTENT replay guard, in its own database', () => {
    const app = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');

    expect(app, 'a boot step builds the persistent intro guard').toMatch(
      /const opening\s*=\s*createSealedReplayGuard\(\s*\{\s*dbName:\s*currentIntroReplayDbName\(wallet\.address\),\s*sealKey:\s*keys\.introLedger\.seal\s*\}\)/,
    );
    expect(app).toContain('const guard = await Promise.race([opening, delay(INTRO_REPLAY_GUARD_OPEN_BOUND_MS).then(() => null)]);');
    expect(app).toContain('introReplayGuard = guard;');
    expect(app, 'the intro guard has a database of its own').toMatch(/currentIntroReplayDbName[\s\S]{0,400}?platho-intro-replay-v1/);
    expect(app.includes("walletScopedIndexedDbName('platho-intro-replay-v1'"), 'and it is wallet-scoped').toBe(true);

    const bootIdx = app.indexOf('await bootIntroReplayGuard()');
    const armIdx = app.indexOf("armIntroReceiveLane().catch((error) => console.warn('[intro] arm on unlock failed', error));");
    expect(bootIdx, 'the boot step is wired into the unlock path').toBeGreaterThan(0);
    expect(bootIdx, 'and it runs before the lane is armed').toBeLessThan(armIdx);
  });

  it('IRH-08: every publisher of the commitment reaches the conversation record, so the reply can try each [round 5]', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const built = await createEncryptedIntroCapsule(exportPublicKeyBundle(recipient.encryptionKeyPair), sender, { firstMessageBytes: utf8('hi') });
    const store = createMemoryConvKeyStore();
    const onIntro = createIntroReceiveHandler({ recipientKeyPair: recipient.encryptionKeyPair, convKeyStore: store, onFirstContact: () => {} });
    const replayer = '0:' + 'cd'.repeat(32);
    const genuine = '0:' + 'ab'.repeat(32);
    const hit = asScanCapsule(built, 1_790_000_000, replayer);
    const opened = await onIntro({ ...hit, capsule: { ...hit.capsule, sourceCandidates: [replayer, genuine] } });
    const rec = store.getConversation(recipient.encryptionKeyPair.keyId, opened.senderKeyId)!;
    expect(rec.peerWallet, 'the first publisher is still the recorded one').toBe(replayer);
    expect(rec.peerWalletCandidates, 'and every publisher is kept for the reply to try').toEqual([replayer, genuine]);
  });

});
