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
  });
});
