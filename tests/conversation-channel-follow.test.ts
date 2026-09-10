import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// FOLLOWING ON FIRST CONTACT IS ASYMMETRIC, AND THE ASYMMETRY IS THE FEATURE.
//
// decided 2026-08-06, asking for both sides to be subscribed automatically — then, on the spam surface
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
    // The receive path must not follow. If a future change adds one there, this is what says why not.
    //
    // THIS GATE GUARDED NOTHING FOR AS LONG AS ITS ANCHOR HAS BEEN DEAD [audit 2026-09-02]. `adoptIncomingIntro`
    // is gone from web/app.js, so `indexOf` returned -1, `slice(-1, 3999)` produced '', and the `if (adopt)`
    // wrapper below it was FALSE — both refusals were skipped every run. The one assertion that still executed
    // checks for a COMMENT line. MEASURED: planting `followContactPublicChannel(opened.senderWallet)` into the
    // live receive path left this file at 4 passed. The `if` was the whole defect: a scope guard that turns a
    // missing subject into a silent pass, in a gate whose title claims live anti-spam coverage.
    const RECEIVE = 'async function handleIntroFirstContact(';
    const start = app.indexOf(RECEIVE);
    expect(start, 'the receive path this gate names must exist — a renamed subject is a dead gate')
      .toBeGreaterThan(-1);
    const after = app.slice(start + 1);
    const next = after.search(/^(?:async )?function /m);
    const receive = next >= 0 ? app.slice(start, start + 1 + next) : app.slice(start);
    expect(receive.length, 'and the slice must be that function, not the rest of the file')
      .toBeGreaterThan(400);
    expect(receive.length).toBeLessThan(12_000);
    // NO `if` HERE, EVER: the assertions run unconditionally, so a subject that moves turns this red rather
    // than quiet.
    expect(receive).not.toContain('followContactPublicChannel(');
    expect(receive).not.toContain('followPeerChannelOnFirstReply(');
    // The restore's inference (FOLLOW-05) is not a door into this path either: it queues from the SCAN, on a
    // conversation that already holds a message of mine — never from an INTRO that just arrived.
    expect(receive).not.toContain('noteRestoredConversationFollow(');
    expect(receive).not.toContain('followRestoredContactChannels(');
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

  // THE SAME CHOICE, RESTORED [F-23, 2026-09-09]. A conversation restored on a new device (recovery import, cleared
  // store) arrives COLD, and the follow the two rules above made when it was live comes back only with a saved
  // subscriptions snapshot. So fifty restored dialogs made a feed of nobody. The follow is re-derived from the same
  // evidence the live rules used — at least one OUTGOING message — and never from receipt alone.
  it('FOLLOW-05: a RESTORED conversation follows the peer only on evidence that I wrote to them', () => {
    const note = app.slice(app.indexOf('function noteRestoredConversationFollow('), app.indexOf('function peerChannelAlreadyFollowed('));
    expect(note, 'only a COLD record — once per conversation per device').toContain('if (plan?.cold !== true) return;');
    expect(note, 'and only with my own message in it').toContain('if (ownCopiesOpened === 0 && countThreadDirections(thread).outgoing === 0) return;');
    expect(note, 'never my own wallet').toContain('sameWalletAddress(wallet, plathoWallet.address)');
    // The scan hands it the cold plan after the append, with the count of MY OWN capsules it opened this pass.
    expect(app).toContain('noteRestoredConversationFollow(plan, targetThread, ownCopiesOpened);');
    expect(app).toContain('if (ownCopies) ownCopiesOpened += 1;');
    // The record's peer wallet rides the plan — a restored record carries it (recovery-blob field `w`).
    expect(app).toContain('plans.push({ peerKeyId, peerWallet: record.peerWallet ?? null, windowW, rootShards, cold });');
  });

  it('FOLLOW-06: the inference waits for the saved snapshot, and a snapshot wins', () => {
    // drainRestoredPrefsSnapshots applies a snapshot only to a device with no local follows — an inference applied
    // first would have silenced the user's own saved list for good. So: queued during the scan, applied only once
    // the named recovery slot has answered CLEANLY, and dropped whenever a snapshot governs (prefsLastSyncedAt).
    const apply = app.slice(app.indexOf('function applyRestoredConversationFollows('),
      app.indexOf('function applyRestoredConversationFollows(') + 1200);
    expect(apply).toContain('if (restoredConversationFollowQueue.size === 0 || !prefsRestoreSettled) return;');
    expect(apply).toContain('const snapshotGoverns = prefsLastSyncedAt !== null;');
    expect(apply).toContain('const followed = snapshotGoverns ? 0 : followRestoredContactChannels([...queued.keys()]);');
    const restore = app.slice(app.indexOf('async function restorePrefsFromRecoveryIfFresh('),
      app.indexOf('async function restorePrefsFromRecoveryIfFresh(') + 2500);
    expect(restore, 'settled by a CLEAN answer only, and applied right there')
      .toContain('if (clean === true) { prefsRestoreSettled = true; applyRestoredConversationFollows(); }');
    // The private pass drains the diverted snapshot FIRST, asks the slot if it has not answered yet, then applies.
    const anchor = 'privateChainSyncPromise = syncPrivateCapsulesFromChain(options);';
    const pass = app.slice(app.indexOf(anchor), app.indexOf(anchor) + 1400);
    expect(pass.indexOf('drainRestoredPrefsSnapshots();'), 'snapshot before inference').toBeLessThan(pass.indexOf('applyRestoredConversationFollows();'));
    expect(pass).toContain('if (restoredConversationFollowQueue.size > 0 && !prefsRestoreSettled) await restorePrefsFromRecoveryIfFresh();');
  });

  it('FOLLOW-07: fifty restored follows are ONE write, ONE rebuild, ONE walk — and never undo an unfollow', () => {
    const batch = app.slice(app.indexOf('function followRestoredContactChannels('), app.indexOf('function applyRestoredConversationFollows('));
    expect(batch, 'a channel already followed is left alone').toContain('if (peerChannelAlreadyFollowed(wallet)) continue;');
    expect(batch, 'registered without a per-channel thread rebuild').toContain('ensurePublicChannelForAuthorWallet(wallet, { activate: false, rebuild: false })');
    expect(batch, 'subscribed in one go').toContain('if (ids.length > 0) setPublicChannelsSubscribed(ids, true);');
    const single = app.slice(app.indexOf('function setPublicChannelSubscribed('), app.indexOf('function setPublicChannelsSubscribed('));
    expect(single, 'the single form is the batch with a list of one').toContain('return setPublicChannelsSubscribed([id], subscribed);');
    const ensure = app.slice(app.indexOf('function ensurePublicChannelForAuthorWallet('), app.indexOf('function assemblePublicParts('));
    expect(ensure).toContain('if (options.rebuild !== false) rebuildThreadsFromPublicSubscriptions({ preserveActive: true });');
  });
});
