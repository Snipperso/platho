import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { encodeCompactPayload, decodeCompactPayload } from '../web/crypto/platho-crypto.mjs';

// A dialog must show the peer's .ath, not their raw address — when the peer has one and it is REALLY theirs.
//
// OBSERVED 2026-08-03 on the owner's phone, build v811: the wallet address finally appeared (the previous fix), but
// the .ath linked to that same wallet did not. The name was never missing from the wire — the sender attaches it as
// `senderUsername` compact-payload metadata (currentPrivateSenderOptions), and the receiver decodes it into
// `payload.senderUsername`. Nothing on the private receive path ever read it. Only public posts did.
//
// Two things had to hold for the fix, and both are pinned here rather than argued:
//   1. the claim really does survive the codec into `payload.senderUsername` — asserted by a ROUND TRIP below, not by
//      reading the encoder and the decoder and believing they agree (they are declared in separate places, which is
//      exactly the shape that has silently diverged in this codebase before);
//   2. the claim is VERIFIED against the dialog's wallet before it becomes a label — the sender types this string, so
//      an unverified claim would let anyone wear anyone's name.
const APP = readFileSync('web/app.js', 'utf8');

describe('PEERNAME — the peer .ath travels on the wire and is verified before display', () => {
  it('PEERNAME-01: senderUsername survives encode -> decode as payload.senderUsername', () => {
    const encoded = encodeCompactPayload(
      { type: 'text', text: 'hi' },
      { usefulBytes: 512, senderUsername: 'glasnost' },
    );
    const payload = decodeCompactPayload(encoded);
    // The exact property the receive path now reads. A rename on either side breaks this, which is the point.
    expect(payload.senderUsername).toBe('glasnost.ath');
    expect(payload.sender_username).toBe('glasnost.ath');
  });

  it('PEERNAME-02: a payload with no username decodes without one — absence must not read as a name', () => {
    // Counter-case: PEERNAME-01 alone would also pass against a decoder that hard-coded the string.
    const payload = decodeCompactPayload(encodeCompactPayload({ type: 'text', text: 'hi' }, { usefulBytes: 512 }));
    expect(payload.senderUsername).toBeUndefined();
    // …and the reader treats that as "no claim", not as an empty name to verify.
    const reader = APP.slice(APP.indexOf('function claimedPeerUsernameFromOpened(opened) {'));
    expect(reader).toContain("typeof claim === 'string' && claim.trim().length > 0 ? claim : null");
  });

  it('PEERNAME-03: the claim is checked against the wallet before it can become the label', () => {
    const fn = APP.slice(
      APP.indexOf('async function resolveInboundPeerWalletIdentity(thread, claimedUsername = null) {'),
      APP.indexOf('function threadWearsUsername(thread, claimedUsername) {'),
    );
    expect(fn.length).toBeGreaterThan(400);
    const verifyAt = fn.indexOf('verifiedPlathoUsernameIdentityForWallet(claimedUsername, peerWallet)');
    const applyAt = fn.indexOf('refreshThreadIdentityFromVariants(thread, variants)');
    expect(verifyAt, 'the .ath claim is not verified against the wallet').toBeGreaterThan(-1);
    expect(applyAt).toBeGreaterThan(-1);
    expect(verifyAt, 'the claim is applied before it is verified').toBeLessThan(applyAt);
    // A transient read must keep the address rather than clear the dialog's name.
    expect(fn).toContain('catch { usernameIdentity = null; }');
  });

  it('PEERNAME-04: name and address go over in ONE call, so the address cannot freeze the dialog', () => {
    // refreshThreadIdentityFromVariants never REPLACES thread.identity once set, and preferredInboundIdentity ranks
    // PLATHO_NFT above WALLET_ADDRESS. Handing them over separately would permanently pin whichever landed first —
    // the address, since the KeyShard read returns before the username read.
    const fn = APP.slice(
      APP.indexOf('async function resolveInboundPeerWalletIdentity(thread, claimedUsername = null) {'),
      APP.indexOf('function threadWearsUsername(thread, claimedUsername) {'),
    );
    expect(fn).toContain('const variants = [...(usernameIdentity ? [usernameIdentity] : []), ...privateWalletIdentityVariants(peerWallet)];');
    expect((fn.match(/refreshThreadIdentityFromVariants\(/g) ?? []).length, 'exactly one apply call').toBe(1);
    // And an ALREADY-named dialog (address landed in an earlier build) is upgraded to the verified name.
    expect(fn).toContain('if (usernameIdentity && !anonymous) {');
    expect(fn).toContain('thread.identity = usernameIdentity;');
  });

  it('PEERNAME-05: the resolution re-runs for a name but not once the dialog already wears it', () => {
    // Without the second half this fires a chain read on EVERY incoming message for the life of the dialog.
    const queue = APP.slice(
      APP.indexOf('function queueInboundPeerIdentityResolution(thread, claimedUsername = null) {'),
      APP.indexOf('// onFirstContact:'),
    );
    expect(queue).toContain('if (!isAnonymousPeerThread(thread) && (!claimedUsername || threadWearsUsername(thread, claimedUsername))) return;');
    // Canonical comparison — "name", "name.ath" and "NAME" must not each trigger their own read.
    const wears = APP.slice(APP.indexOf('function threadWearsUsername(thread, claimedUsername) {'));
    expect(wears).toContain('variant.value === claimed.value');
    expect(wears).toContain('plathoUsernameIdentity(claimedUsername)');
  });

  it('PEERNAME-06: both the single-part and multipart receive paths pass the claim along', () => {
    expect(APP).toContain("queueInboundPeerIdentityResolution(targetThread, claimedPeerUsernameFromOpened(opened));");
    expect(APP).toContain("queueInboundPeerIdentityResolution(targetThread, claimedPeerUsernameFromOpened(parts[0]?.opened));");
  });
});
