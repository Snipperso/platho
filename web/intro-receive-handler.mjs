// intro-receive-handler — the onIntro handler the INTRO scan lane was missing. It is the "subsystem that does not
// exist yet" intro-lane.mjs stops at: it turns a scanned first contact into an established conversation.
//
// The scan (createIntroScanRunner) delivers each first contact — its capsule body already fetched and verified
// against the shard's stored commitment — to onIntro. This handler:
//   1. reconstructs + opens the INTRO from its 2-cell on-chain form (openIntroCapsuleFromChainCells, which reproduces
//      the canonical header1 and authenticates the sender by the handshake transcript),
//   2. adopts the pairwise K_root into the conversation key store (last-writer-wins, so a re-INTRO cannot fork the
//      conversation), keyed by the join id both sides compute identically,
//   3. hands the opened first contact to the app (onFirstContact) to create the inbound thread + surface the first
//      message.
//
// It is a thin, injectable seam so it can be tested without a browser or a chain: tests/intro-receive-handler.test.ts
// drives a REAL INTRO capsule through it and checks the stored K_root equals the sender's.

import { openIntroCapsuleFromChainCells } from './crypto/platho-crypto.mjs?v=12';
import { readSnakeCellBytes } from './pwa-contract-transactions.mjs?v=33';

const asBytes = (value, name) => (value instanceof Uint8Array ? value : readSnakeCellBytes(value, { name }));

/**
 * Build the onIntro handler.
 *
 * `recipientKeyPair` is the user's OWN encryption key pair ({ keyId, x25519SecretKey, mlKem768SecretKey }) — the one
 * the stealth scan already uses. `convKeyStore` is web/conv-key-store. `resolveVaultKeyRecord` (recommended) binds the
 * sender's handshake keys to their LIVE registered bundle (first-contact impersonation guard); `introReplayGuard`
 * dedupes byte-identical replays by introNonce. `onFirstContact(opened, capsule)` creates the thread / shows the first
 * message — the app's decision, kept out of here.
 */
export function createIntroReceiveHandler({
  recipientKeyPair,
  convKeyStore,
  resolveVaultKeyRecord = null,
  introReplayGuard = null,
  onFirstContact = null,
} = {}) {
  if (!recipientKeyPair?.keyId) throw new Error('createIntroReceiveHandler requires recipientKeyPair with a keyId');
  if (typeof convKeyStore?.upsertConversationKRoot !== 'function') throw new Error('createIntroReceiveHandler requires a conv key store');

  return async function onIntro(capsule) {
    const header0Bytes = asBytes(capsule.header0, 'intro header0');
    const bodyBytes = asBytes(capsule.body, 'intro body');
    const opened = await openIntroCapsuleFromChainCells(header0Bytes, bodyBytes, recipientKeyPair, {
      resolveVaultKeyRecord: resolveVaultKeyRecord ?? undefined,
      introReplayGuard: introReplayGuard ?? undefined,
      enforceExpiry: false,
    });

    // Adoption ordering: prefer the CONTRACT-STAMPED created_at (both sides see the same on-chain value, so their
    // adoption stays consistent); introNonce is the deterministic tie-break. Falls back to 0 when the scan did not
    // surface created_at — then the (unique) introNonce alone orders re-INTROs.
    const createdAt = Number(capsule.createdAt ?? capsule.created_at ?? 0) || 0;
    const adoption = await convKeyStore.upsertConversationKRoot(recipientKeyPair.keyId, opened.senderKeyId, {
      kRoot: opened.kRoot,
      createdAt,
      introNonce: opened.introNonce,
      peerEncPublicKey: opened.senderEncPublicKey,
    });

    const result = { ...opened, adoption };
    if (typeof onFirstContact === 'function') await onFirstContact(result, capsule);
    return result;
  };
}
