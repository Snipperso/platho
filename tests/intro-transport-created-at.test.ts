import { describe, expect, it } from 'vitest';
import { createMessagingIdentity, exportPublicKeyBundle, createEncryptedIntroCapsule } from '../web/crypto/platho-crypto.mjs';
import { parseBocBase64 } from '../web/pwa-contract-transactions.mjs';
import { buildIntroPublishBrowser } from '../web/intro-publish-browser.mjs';
import { fetchIntroCapsule, introBodyCommitBrowser } from '../web/intro-transport.mjs';


describe('FETCH-INTRO-CAPSULE surfaces the contract created_at', () => {
  it('FIC-01: the entry\'s contract-stamped created_at flows out of fetchIntroCapsule', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const built = await createEncryptedIntroCapsule(exportPublicKeyBundle(recipient.encryptionKeyPair), sender, {});
    const header0 = parseBocBase64(built.chainCells.header0.boc);
    const body = parseBocBase64(built.chainCells.body.boc);

    const publish = await buildIntroPublishBrowser({ epoch: 20000, bucket: 0, r: 1n, viewTag: built.header0.viewTag, header0, body, value: 0n });
    const commit = await introBodyCommitBrowser(header0, body);

    const CONTRACT_CREATED_AT = 1_790_000_777;
    const readEntry = async () => ({ exists: true, body_commit: commit, created_at: CONTRACT_CREATED_AT });
    const readMessages = async () => [publish.body];

    const fetched = await fetchIntroCapsule({ address: '0:' + '11'.repeat(32), entryId: 0n, readEntry, readMessages });
    expect(fetched, 'the intro was matched by commitment').not.toBeNull();
    expect(fetched.created_at, 'the contract created_at is surfaced for adoption ordering').toBe(CONTRACT_CREATED_AT);
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
    const readMessages = async () => [{ bodyCell: publish.body, source: SENDER_WALLET }];

    const fetched = await fetchIntroCapsule({ address: '0:' + '22'.repeat(32), entryId: 0n, readEntry, readMessages });
    expect(fetched, 'the intro was matched by commitment').not.toBeNull();
    expect(fetched.source, 'the sender wallet (tx src) is surfaced for reply-bundle resolution').toBe(SENDER_WALLET);
  });

  it('FIC-04: a body that fell out of the newest window is fetched by the entry\'s own time', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const built = await createEncryptedIntroCapsule(exportPublicKeyBundle(recipient.encryptionKeyPair), sender, {});
    const header0 = parseBocBase64(built.chainCells.header0.boc);
    const body = parseBocBase64(built.chainCells.body.boc);
    const publish = await buildIntroPublishBrowser({ epoch: 20685, bucket: 0, r: 375n, viewTag: built.header0.viewTag, header0, body, value: 0n });
    const commit = await introBodyCommitBrowser(header0, body);
    const STAMPED = 1_787_220_000;
    const SENDER_WALLET = '0:' + 'ab'.repeat(32);

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
    expect(asks[1].startUtime, 'the ask reaches BELOW the contract stamp (a queued external)').toBeLessThan(STAMPED);
    expect(asks[1].endUtime, 'no slack above the stamp').toBe(STAMPED);

    const plain = async () => [{ bodyCell: other.body, source: null }];
    expect(await fetchIntroCapsule({ address: '0:' + '33'.repeat(32), entryId: 375n, readEntry, readMessages: plain })).toBeNull();
  });

  it('FIC-03: a replayed publish cannot steal the source — the OLDEST matching row wins (wave-7 audit)', async () => {
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
    const readMessages = async () => [
      { bodyCell: publish.body, source: MALLORY },
      { bodyCell: publish.body, source: GENUINE },
    ];

    const fetched = await fetchIntroCapsule({ address: '0:' + '33'.repeat(32), entryId: 0n, readEntry, readMessages });
    expect(fetched.source, 'the earliest publisher of these bytes is the real sender').toBe(GENUINE);
    expect(fetched.sourceCandidates, 'every matching source is kept, oldest first, as a fallback')
      .toEqual([GENUINE, MALLORY]);
    expect(fetched.created_at).toBe(1_790_000_000);
  });
});
