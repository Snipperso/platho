import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Ф6 — the private/public publish DOUBLE-SPEND gate, after clean-17 direct pay.
//
// The original file executed the real per-part predicates (publishPartCanFreshSendRetry and friends) extracted
// from web/app.js, because a grep could not tell an inverted condition from a correct one — and an inverted one
// meant re-signing an already-signed external under a fresh nonce: a double publish, a double GRAM spend and a
// duplicate airdrop credit. Those predicates existed to police a Vault batch whose parts each carried their own
// signed external and nonce.
//
// Direct pay has no such batch: a message is ONE wallet transfer, and the protection moved down a layer, where it
// is structural rather than conditional:
//   * the external is bound to the wallet's seqno, so the chain executes it AT MOST ONCE, however many times it
//     is broadcast;
//   * an ambiguous broadcast hands the signed BOC back (error.builtBoc) and the retry re-broadcasts THAT — it
//     never rebuilds, so it never consumes a second conversation seq.
// Both are pinned in tests/pwa-runtime-config PWA-CONV-DELIVERY-01 (#6) and PWA-SEND-02C.
//
// What is left worth executing here is the wallet-level invariant itself.

describe('publish double-spend gate — direct pay', () => {
  const wallet = readFileSync('web/platho-wallet.mjs', 'utf8');

  it('PUBLISH-RETRY-01: a wallet external is bound to a seqno and its BOC is handed back on an ambiguous send', () => {
    // The signed external carries the seqno it was built for; re-broadcasting the same bytes cannot double-execute.
    // An explicit options.seqno still wins — that is what makes a re-broadcast idempotent. The chain read goes
    // through resolveWalletSendSeqno, which both keeps two overlapping sends off one value AND refuses to sign
    // past a chain that has not consumed the previous external; see tests/burst-send-seqno-collision.test.ts and
    // PLATHO-WALLET-04J/04K.
    expect(wallet).toMatch(/seqno = options\.seqno \?\? await resolveWalletSendSeqno\(wallet, transport, options\)/);
    // On a throw the built BOC (and its seqno) travel with the error so the caller can re-broadcast verbatim
    // instead of re-signing under a fresh seqno.
    expect(wallet).toMatch(/error\.builtBoc = built\.boc; error\.builtSeqno = seqno;/);
    // ...but ONLY when the failure was ambiguous. A chain verdict (exit code 133) proves the bytes dead, and
    // handing a corpse to the re-broadcast path is what kept the owner's image on "sending" for 6.5 minutes.
    expect(wallet).toMatch(/if \(!definitivelyRejected && error && typeof error === 'object' && built\?\.boc/);
    expect(wallet).toMatch(/if \(definitivelyRejected\) resetWalletSeqnoFloor\(wallet\)/);
  });
});
