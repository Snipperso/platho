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

import { openIntroCapsuleFromChainCells } from './crypto/platho-crypto.mjs?v=15';
import { readSnakeCellBytes } from './pwa-contract-transactions.mjs?v=37';

const asBytes = (value, name) => (value instanceof Uint8Array ? value : readSnakeCellBytes(value, { name }));

/**
 * Build the onIntro handler.
 *
 * `recipientKeyPair` is the user's OWN encryption key pair ({ keyId, x25519SecretKey, mlKem768SecretKey }) — the one
 * the stealth scan already uses. `convKeyStore` is web/conv-key-store. `introReplayGuard` dedupes byte-identical
 * replays by introNonce. `onFirstContact(opened, capsule)` creates the thread / shows the first message — the app's
 * decision, kept out of here.
 *
 * FIRST-CONTACT IMPERSONATION IS CLOSED IN THE HANDSHAKE (clean-17), not by a chain lookup here: openIntroHandshake
 * binds keyId_A == H(senderEnc, senderMlKemHash) and verifies a K_root confirm tag, so a stranger cannot claim a
 * victim's keyId. The old mandatory resolveVaultKeyRecord guard is gone — clean-17 deleted the Vault keyId→keys index
 * it needed, and the cryptographic binding needs no on-chain read. [intro-first-contact-auth-crypto-binding]
 */
export function createIntroReceiveHandler({
  recipientKeyPair,
  convKeyStore,
  introReplayGuard = null,
  onFirstContact = null,
} = {}) {
  if (!recipientKeyPair?.keyId) throw new Error('createIntroReceiveHandler requires recipientKeyPair with a keyId');
  if (typeof convKeyStore?.upsertConversationKRoot !== 'function') throw new Error('createIntroReceiveHandler requires a conv key store');

  return async function onIntro(delivery) {
    // THE SCAN RUNNER DELIVERS { ...hit, capsule } — the fetched+verified capsule (header0/body/created_at/source, flat
    // from fetchIntroCapsule) is NESTED under `.capsule`, alongside the hit's r/view_tag/epoch/bucket/entryId. Read it
    // from there. A flat capsule (a direct caller / an old test shape) is tolerated so both work. Getting this wrong is
    // silent: header0 reads undefined, the open throws, and EVERY first contact is lost while the sender thinks it
    // succeeded — exactly the seam a same-commit fixture cannot prove. [intro-send review]
    // An EXPLICIT `capsule: null` is the runner saying "I could not fetch the body" — not a flat-shape delivery.
    // Falling through to the hit produced a TypeError about header0 that named the wrong problem entirely
    // (OBSERVED 2026-08-21: "intro header0 must be a TON cell or BoC payload", once a minute, for a body toncenter's
    // index had not caught up with). The runner now retries such hits itself; this guard is for any other caller.
    if (delivery && typeof delivery === 'object' && 'capsule' in delivery && delivery.capsule == null) {
      throw new Error('intro capsule was not fetched — nothing to open (the body is not in the shard window yet)');
    }
    const capsule = delivery?.capsule ?? delivery;
    const header0Bytes = asBytes(capsule.header0, 'intro header0');
    const bodyBytes = asBytes(capsule.body, 'intro body');
    // THE NONCE IS RECORDED ONLY AFTER ADOPTION SUCCEEDS. The crypto layer adds it INSIDE the open, before K_root is
    // stored; if upsertConversationKRoot / onFirstContact then threw (an IDB write error, a lock mid-pass), the next
    // pass saw "replay" and the runner marked the entry delivered — a first contact lost durably and silently. So the
    // guard handed to the open only CHECKS; the add happens below, once the adoption has landed.
    let nonceToRecord = null;
    const checkOnlyGuard = introReplayGuard
      ? { has: (key) => introReplayGuard.has(key), add: async (key) => { nonceToRecord = key; } }
      : undefined;
    let opened;
    try {
      opened = await openIntroCapsuleFromChainCells(header0Bytes, bodyBytes, recipientKeyPair, {
        introReplayGuard: checkOnlyGuard,
        enforceExpiry: false,
      });
    } catch (error) {
      // A REPLAY IS TERMINAL, and the runner has to be able to tell. The guard refuses a byte-identical capsule for
      // good — the nonce stays seen — so re-trying this hit on the next pass can only throw again. Without the tag the
      // runner treated the throw as transient, rolled the shard's cursor back, and fetched the same entry once a minute
      // for as long as the app lived (OBSERVED 2026-08-21, entries 375 and 376 of one bucket: the same INTRO published
      // twice). The throw itself stays: a replay must not be adopted, and IRH-04 pins that it is refused.
      if (error && /INTRO replay detected/i.test(String(error.message ?? ''))) {
        try { error.code = 'INTRO_REPLAY'; } catch { /* frozen error — the message still says it */ }
      }
      throw error;
    }

    // Adoption ordering MUST be the CONTRACT-STAMPED created_at surfaced by fetchIntroCapsule (IntroShard stamps now()):
    // it is the ONLY recency value both sides read identically. A local clock here would let the two parties disagree on
    // which re-INTRO is newest and silently fork the conversation, so NEVER seed this from Date.now(). introNonce is the
    // deterministic tie-break for same-instant re-INTROs. [private-review #3]
    const createdAt = Number(capsule.created_at ?? capsule.createdAt ?? 0) || 0;
    const adoption = await convKeyStore.upsertConversationKRoot(recipientKeyPair.keyId, opened.senderKeyId, {
      kRoot: opened.kRoot,
      createdAt,
      introNonce: opened.introNonce,
      peerEncPublicKey: opened.senderEncPublicKey,
      // The INTRO publish tx src = the sender's wallet (direct-pay), captured so a reply can resolve the sender's full
      // bundle from their KeyShard (verified against senderKeyId). A HINT — never trusted on its own. [Y resolution]
      peerWallet: capsule.source ?? null,
    });

    const result = { ...opened, adoption };
    if (typeof onFirstContact === 'function') await onFirstContact(result, capsule);
    if (introReplayGuard && nonceToRecord !== null) await introReplayGuard.add(nonceToRecord);
    return result;
  };
}
