import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// A RECEIVED MESSAGE THAT IS NOT WRITTEN DOWN IS LOST, AND THE LOSS IS PERMANENT.
//
// OBSERVED 2026-08-06, owner's device (dump v869, wallet UQAQio…ap0WLp): a first contact arrived and was readable —
// its text and its sender's wallet address both on screen. The app then offered an update, the page was reloaded, and
// the dialog came back EMPTY and unnamed ("Anonymous Lvb69Zu8", 0 messages, no wallet).
//
// handleIntroFirstContact pushed the message into the in-memory thread and stopped there. Every other receive path
// persists on the way in. Two things followed from the one omission:
//   * the message was gone — the INTRO scan may not hand the same entry over twice (intro-cursor-store keeps its
//     delivered set, keyed epoch:bucket:entryId, in IndexedDB), so nothing re-delivered it;
//   * the DIALOG was gone too — a thread snapshot only reaches local history alongside a message, so the thread's
//     name and its convPeerKeyId bridge were never stored either.
//
// Source-level pins, like the other app.js gates: driving this for real needs the whole encrypted-history stack plus
// a browser. What must hold is that no receive path can quietly skip the write again.
const APP = readFileSync('web/app.js', 'utf8');

/** The top-level function declaration containing `index`, as text. app.js declares these at column 0. */
function enclosingFunction(index: number): { name: string; body: string } {
  const before = APP.slice(0, index);
  const start = Math.max(before.lastIndexOf('\nfunction '), before.lastIndexOf('\nasync function '));
  if (start < 0) return { name: '<top level>', body: '' };
  const end = APP.indexOf('\n}', index);
  const body = APP.slice(start, end < 0 ? APP.length : end + 2);
  return { name: /function\s+([A-Za-z0-9_$]+)/.exec(body)?.[1] ?? '<anonymous>', body };
}

function lineOf(index: number): number {
  return APP.slice(0, index).split('\n').length;
}

describe('INTROPERSIST — an incoming message reaches local history', () => {
  it('INTROPERSIST-01: EVERY path that takes delivery of an incoming message also persists it', () => {
    // The gate is on the COMPLETENESS of the set, not on the three sites known today. markIncomingThreadMessage is
    // exactly the statement "an incoming message just landed in this dialog" — so a function that says it and never
    // writes the message down is the defect, whatever it is called and whenever it is added.
    const offenders: string[] = [];
    const pattern = /markIncomingThreadMessage\(/g;
    for (let match = pattern.exec(APP); match; match = pattern.exec(APP)) {
      const { name, body } = enclosingFunction(match.index);
      if (name === 'markIncomingThreadMessage') continue;   // the declaration itself
      if (body.includes('persistMessageToEncryptedHistory(') || body.includes('writeMessageToEncryptedHistory(')) continue;
      offenders.push(`web/app.js:${lineOf(match.index)} — ${name}() takes delivery but never persists`);
    }
    expect(offenders, offenders.join('\n')).toEqual([]);

    // And the set is not empty — a rename that made the pattern match nothing would otherwise pass silently.
    expect((APP.match(pattern) ?? []).length).toBeGreaterThanOrEqual(4);   // 3 call sites + the declaration
  });

  it('INTROPERSIST-02: the INTRO first message carries a stable id, so a re-delivery cannot duplicate it', () => {
    // Persisting without an id would trade a lost message for a growing pile of copies: the cursor store degrades to
    // MEMORY when IndexedDB is unusable (createIntroCursorStore falls back on purpose), and every reload would then
    // re-deliver the same first contact into history. The handshake nonce is unique per INTRO and already the replay
    // guard's key, so it is the honest identity — carried in `capsule.id`, which is what the existing dedup primitive
    // reads and what serializeMessageForHistory already whitelists.
    const helper = APP.slice(APP.indexOf('function introFirstMessageCapsuleId'), APP.indexOf('// onFirstContact:'));
    expect(helper).toContain('return `intro:${introKeyIdString(introNonce)}`;');

    const handler = enclosingFunction(APP.indexOf('async function handleIntroFirstContact')).body;
    expect(handler).toContain('const capsuleId = introFirstMessageCapsuleId(opened.introNonce);');
    expect(handler).toContain('!(capsuleId && findMessageByCapsuleId(capsuleId))');
    expect(handler).toContain('...(capsuleId ? { capsule: { id: capsuleId } } : {}),');
    // The write is AWAITED inside the guarded block, not fired and forgotten: onFirstContact is awaited by the
    // receive handler, and a swallowed rejection here is the same silent loss this gate exists for.
    expect(handler).toContain('await persistMessageToEncryptedHistory(thread, message);');
  });

  it('INTROPERSIST-03: `capsule` is a persisted field, so the dedup id survives the reload it guards against', () => {
    const serializer = APP.slice(APP.indexOf('function serializeMessageForHistory'), APP.indexOf('function serializeThreadForHistory'));
    expect(serializer).toContain('capsule: message.capsule ?? null,');
  });
});

// THE DIALOG'S NAME HAD NOWHERE TO COME FROM EITHER.
//
// Same dump: the conversation's key record survived (the CONV scan lists it), and that record carries the peer's
// wallet — conv-key-persist writes `peerWallet` in both directions. But every naming path hung off an INCOMING
// MESSAGE, and a conversation rebuilt from the key store has none: resolveConvReceiveThread mints its thread from the
// record alone. So a first contact nobody has replied to yet stayed "Anonymous <keyId>" for good.
describe('CONVNAME — a dialog restored from the key store can still be named', () => {
  const resolver = APP.slice(APP.indexOf('function resolveConvReceiveThread'), APP.indexOf('// Merge a conversation'));

  it('CONVNAME-01: both branches ask — the freshly minted thread and the one restored from history', () => {
    // Two branches, two calls. The restored branch matters just as much: a thread snapshot is written at the moment a
    // message is stored, so a dialog whose identity resolved a second later was persisted ANONYMOUS.
    expect((resolver.match(/queueRestoredConvIdentityResolution\(thread\)/g) ?? [])).toHaveLength(2);
    // Ordering: the resolve reads convPeerKeyId off the thread to find the conversation record.
    expect(resolver.indexOf('thread.convPeerKeyId = peerKeyIdB64;'))
      .toBeLessThan(resolver.lastIndexOf('queueRestoredConvIdentityResolution(thread)'));
  });

  it('CONVNAME-02: bounded to one attempt per dialog per session — the CONV scan calls it every pass', () => {
    const helper = enclosingFunction(APP.indexOf('function queueRestoredConvIdentityResolution')).body;
    expect(helper).toContain('if (convThreadIdentityAttempted.has(thread.id)) return;');
    expect(helper).toContain('convThreadIdentityAttempted.add(thread.id);');
    // A named dialog asks nothing at all.
    expect(helper).toContain('!isAnonymousPeerThread(thread)');
  });

  it('CONVNAME-03: the wallet it resolves against is a HINT, still verified against the KeyShard', () => {
    // The naming rule does not change: the INTRO publish source is re-checked against the peer's KeyShard before it
    // becomes a label, because anyone can re-publish a captured capsule from their own wallet.
    const resolve = enclosingFunction(APP.indexOf('async function resolveInboundPeerWalletIdentity')).body;
    expect(resolve).toContain('await resolvePeerReplyBundle({');
    expect(resolve).toContain('peerKeyId: thread.convPeerKeyId');
  });
});
