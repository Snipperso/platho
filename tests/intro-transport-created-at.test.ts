import { describe, expect, it } from 'vitest';
import { createMessagingIdentity, exportPublicKeyBundle, createEncryptedIntroCapsule } from '../web/crypto/platho-crypto.mjs';
import { parseBocBase64 } from '../web/pwa-contract-transactions.mjs';
import { buildIntroPublishBrowser } from '../web/intro-publish-browser.mjs';
import { fetchIntroCapsule, introBodyCommitBrowser } from '../web/intro-transport.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// FETCH-INTRO-CAPSULE must surface the CONTRACT-STAMPED created_at. The re-INTRO K_root adoption orders on it, and it
// is the only recency value both sides read identically — if the transport dropped it (as it did before), adoption
// would collapse to a random introNonce and re-INTROs could silently fork the conversation. This closes the
// private-review #3 gap AND proves the handler test is not just feeding a value the real pipeline never emits.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('FETCH-INTRO-CAPSULE surfaces the contract created_at', () => {
  it('FIC-01: the entry\'s contract-stamped created_at flows out of fetchIntroCapsule', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const built = await createEncryptedIntroCapsule(exportPublicKeyBundle(recipient.encryptionKeyPair), sender, {});
    const header0 = parseBocBase64(built.chainCells.header0.boc);
    const body = parseBocBase64(built.chainCells.body.boc);

    // The IntroPublish message the shard would hold (what readMessages returns).
    const publish = await buildIntroPublishBrowser({ epoch: 20000, bucket: 0, r: 1n, viewTag: built.header0.viewTag, header0, body, value: 0n });
    const commit = await introBodyCommitBrowser(header0, body);

    const CONTRACT_CREATED_AT = 1_790_000_777;   // what IntroShard.now() stamped, returned by get_entry
    const readEntry = async () => ({ exists: true, body_commit: commit, created_at: CONTRACT_CREATED_AT });
    const readMessages = async () => [publish.body];

    const fetched = await fetchIntroCapsule({ address: '0:' + '11'.repeat(32), entryId: 0n, readEntry, readMessages });
    expect(fetched, 'the intro was matched by commitment').not.toBeNull();
    expect(fetched.created_at, 'the contract created_at is surfaced for adoption ordering').toBe(CONTRACT_CREATED_AT);
    // Source-free reader (plain cells) → source is null (no bundle-resolution hint available).
    expect(fetched.source, 'a plain-cell reader yields no source').toBeNull();
  });

  it('FIC-02: fetchIntroCapsule surfaces the matched message source from a with-source reader (Y reply resolution)', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const built = await createEncryptedIntroCapsule(exportPublicKeyBundle(recipient.encryptionKeyPair), sender, {});
    const header0 = parseBocBase64(built.chainCells.header0.boc);
    const body = parseBocBase64(built.chainCells.body.boc);
    const publish = await buildIntroPublishBrowser({ epoch: 20000, bucket: 0, r: 1n, viewTag: built.header0.viewTag, header0, body, value: 0n });
    const commit = await introBodyCommitBrowser(header0, body);

    const SENDER_WALLET = '0:' + 'cd'.repeat(32);
    const readEntry = async () => ({ exists: true, body_commit: commit, created_at: 1_790_000_000 });
    // The with-source reader yields { bodyCell, source } — the INTRO publish transaction's src = the sender's wallet.
    const readMessages = async () => [{ bodyCell: publish.body, source: SENDER_WALLET }];

    const fetched = await fetchIntroCapsule({ address: '0:' + '22'.repeat(32), entryId: 0n, readEntry, readMessages });
    expect(fetched, 'the intro was matched by commitment').not.toBeNull();
    expect(fetched.source, 'the sender wallet (tx src) is surfaced for reply-bundle resolution').toBe(SENDER_WALLET);
  });

  it('FIC-04: a body that fell out of the newest window is fetched by the entry\'s own time', async () => {
    // OWNER'S CONSOLE 2026-08-21, once the runner started saying what it could not do: "entry 20685:0:375 is on chain
    // but no message in its shard window reproduces the stored body_commit" — entries 375 and 376 of a bucket that
    // took 648 first contacts that day. The reader served the newest 128 publishes, so a recipient away for more than
    // ~5 hours came back to contacts that were paid for, stored, and unreadable. The contract stamps created_at on
    // the entry; the body is now asked for from the minutes around it.
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const built = await createEncryptedIntroCapsule(exportPublicKeyBundle(recipient.encryptionKeyPair), sender, {});
    const header0 = parseBocBase64(built.chainCells.header0.boc);
    const body = parseBocBase64(built.chainCells.body.boc);
    const publish = await buildIntroPublishBrowser({ epoch: 20685, bucket: 0, r: 375n, viewTag: built.header0.viewTag, header0, body, value: 0n });
    const commit = await introBodyCommitBrowser(header0, body);
    const STAMPED = 1_787_220_000;   // what IntroShard.now() stamped for entry 375
    const SENDER_WALLET = '0:' + 'ab'.repeat(32);

    // A reader shaped like toncenter: the newest window holds only OTHER publishes (the bucket has moved on by
    // hundreds); only a time-bounded ask around the stamp returns the row. Every ask is recorded.
    const asks: any[] = [];
    const other = await buildIntroPublishBrowser({ epoch: 20685, bucket: 0, r: 640n, viewTag: 1n, header0: parseBocBase64(built.chainCells.body.boc), body: parseBocBase64(built.chainCells.header0.boc), value: 0n });
    const readMessages = async (_address: string, options: any = {}) => {
      asks.push(options);
      const { startUtime, endUtime } = options ?? {};
      if (startUtime === undefined && endUtime === undefined) return [{ bodyCell: other.body, source: '0:' + 'ff'.repeat(32) }];
      if (startUtime <= STAMPED - 3 && endUtime >= STAMPED - 3) return [{ bodyCell: publish.body, source: SENDER_WALLET }];
      return [];
    };
    const readEntry = async () => ({ exists: true, body_commit: commit, created_at: STAMPED });

    const fetched = await fetchIntroCapsule({ address: '0:' + '33'.repeat(32), entryId: 375n, readEntry, readMessages });
    expect(fetched, 'found by time, not by recency').not.toBeNull();
    expect(fetched.source).toBe(SENDER_WALLET);
    expect(fetched.created_at).toBe(STAMPED);
    expect(asks.length, 'the newest window first, then ONE time-bounded ask').toBe(2);
    expect(asks[1].startUtime, 'the ask is centred on the contract stamp').toBeLessThan(STAMPED);
    expect(asks[1].endUtime).toBeGreaterThan(STAMPED);

    // A reader that does not understand the bounds (a plain stub) answers with its usual window — and the result is
    // the honest null it always was, not a throw and not a wrong capsule.
    const plain = async () => [{ bodyCell: other.body, source: null }];
    expect(await fetchIntroCapsule({ address: '0:' + '33'.repeat(32), entryId: 375n, readEntry, readMessages: plain })).toBeNull();
  });

  it('FIC-03: a replayed publish cannot steal the source — the OLDEST matching row wins (wave-7 audit)', async () => {
    // IntroShard stores no publisher, so the sender's wallet can only come from the message history. Anyone who reads
    // a published INTRO off the chain can re-publish those exact bytes into the same shard: the row hashes to the SAME
    // body_commit and, arriving later, used to be picked. The reply then resolved the attacker's KeyShard, whose keyId
    // does not match the conversation — resolvePeerBundleFromKeyShardView fails closed, so nothing is impersonated,
    // but the responder could never reply again, for the price of one publish.
    //
    // A copy has to be READ before it can be made, so the genuine publish is always strictly older. That ordering is
    // what the attacker cannot beat, and it is what this test pins.
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const built = await createEncryptedIntroCapsule(exportPublicKeyBundle(recipient.encryptionKeyPair), sender, {});
    const header0 = parseBocBase64(built.chainCells.header0.boc);
    const body = parseBocBase64(built.chainCells.body.boc);
    const publish = await buildIntroPublishBrowser({ epoch: 20000, bucket: 0, r: 1n, viewTag: built.header0.viewTag, header0, body, value: 0n });
    const commit = await introBodyCommitBrowser(header0, body);

    const GENUINE = '0:' + 'aa'.repeat(32);
    const MALLORY = '0:' + 'ee'.repeat(32);
    const readEntry = async () => ({ exists: true, body_commit: commit, created_at: 1_790_000_000 });
    // Rows arrive NEWEST FIRST, which is how the reader queries them: Mallory's replay leads, the real one trails.
    const readMessages = async () => [
      { bodyCell: publish.body, source: MALLORY },
      { bodyCell: publish.body, source: GENUINE },
    ];

    const fetched = await fetchIntroCapsule({ address: '0:' + '33'.repeat(32), entryId: 0n, readEntry, readMessages });
    expect(fetched.source, 'the earliest publisher of these bytes is the real sender').toBe(GENUINE);
    expect(fetched.sourceCandidates, 'every matching source is kept, oldest first, as a fallback')
      .toEqual([GENUINE, MALLORY]);
    // The capsule itself is unaffected: both rows hash to one body_commit, so the cells are interchangeable.
    expect(fetched.created_at).toBe(1_790_000_000);
  });
});
