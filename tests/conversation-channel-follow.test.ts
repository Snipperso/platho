import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// FOLLOWING ON FIRST CONTACT IS ASYMMETRIC, AND THE ASYMMETRY IS THE FEATURE.
//
// Owner, 2026-08-06, asking for both sides to be subscribed automatically — then, on the spam surface: "а то
// наподписываюсь на всё подряд, из-за сообщений от спамеров."
//
// INITIATOR follows on send: writing to someone is already the choice to hear from them.
// RECIPIENT follows on their REPLY, never on receipt: an INTRO can be sent to anyone (that is what first contact is
// for), so following the sender the moment a message arrives would make a mass blast a way into every feed.
//
// Subscriptions themselves are private — seed-sealed into the owner's own named recovery slot — so this leaks no
// social graph to third parties. That was checked before the design, not assumed.
describe('FOLLOW — a conversation follows the peer, asymmetrically', () => {
  const app = readFileSync('web/app.js', 'utf8');

  it('FOLLOW-01: the initiator follows the peer when the first contact is adopted', () => {
    const intro = app.slice(app.indexOf('async function attemptIntroFirstContactDirect('),
      app.indexOf('async function attemptIntroFirstContactDirect(') + 12000);
    expect(intro).toContain('followContactPublicChannel(sendState.peerWallet);');
    // Adoption first: a follow must never be what decides whether the conversation exists.
    expect(intro.indexOf('await convKeyStore.upsertConversationKRoot('))
      .toBeLessThan(intro.indexOf('followContactPublicChannel(sendState.peerWallet);'));
  });

  it('FOLLOW-02: the recipient follows only on their FIRST reply, and only if they did not start it', () => {
    expect(app).toContain('followPeerChannelOnFirstReply(thread, rec?.peerWallet);');
    const helper = app.slice(app.indexOf('function followPeerChannelOnFirstReply('),
      app.indexOf('function followPeerChannelOnFirstReply(') + 900);
    // Exactly one outgoing (the message being sent) and at least one incoming = they opened it, this is my answer.
    expect(helper).toContain('if (outgoing !== 1 || incoming === 0) return;');
    // DERIVED, not stored: no new persisted flag, and it cannot fire twice — so a deliberate unfollow later is not
    // undone by simply continuing the conversation.
    expect(helper).toContain('followContactPublicChannel(peerWallet);');
  });

  it('FOLLOW-03: nothing follows on RECEIPT — that is the spam door', () => {
    // The receive/adopt path must not follow. If a future change adds one there, this is what says why not.
    const adopt = app.slice(app.indexOf('function adoptIncomingIntro'), app.indexOf('function adoptIncomingIntro') + 4000);
    if (adopt) {
      expect(adopt).not.toContain('followContactPublicChannel(');
      expect(adopt).not.toContain('followPeerChannelOnFirstReply(');
    }
    // And the follow helper itself never subscribes without an explicit call — discovery registers channels
    // unsubscribed on purpose (the original "a fresh feed fills with everyone" bug).
    expect(app).toContain('// Only an EXPLICIT user action (options.activate) subscribes.');
  });

  it('FOLLOW-04: a follow never breaks a send', () => {
    const helper = app.slice(app.indexOf('function followContactPublicChannel('),
      app.indexOf('function followContactPublicChannel(') + 900);
    expect(helper).toContain('catch (error)');
    expect(helper, 'a follow must not subscribe you to your own channel').toContain('sameWalletAddress(wallet, plathoWallet.address)');
  });
});
