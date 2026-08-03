import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// A RECEIVED private message must be ordered by WHEN IT WAS SENT, never by when this device happened to find it.
//
// MEASURED 2026-08-03 on the owner's phone, build v810. The desktop sent Test7, Test8, Test9, Test10, Test11, Test12,
// then an image. The phone rendered them [image], Test12, Test9, Test8 — top to bottom — and the dialog list showed
// "19:32" for a message sent at 16:59.
//
// Nothing sorted wrong. Three facts composed:
//   1. web/conv-lane.mjs calls convChainEntryFromParsed(parsed) WITHOUT createdAtSec, so the entry handed to the
//      opener has no `created_at` — only `{ entry_id: seq }` (web/app.js, appendConvOpenedCapsules).
//   2. web/app.js ensureMessageOrderFields therefore found no time and stamped Date.now() AT PERSIST TIME.
//   3. toncenter serves /messages with `sort=desc` (VERIFIED against the live API below), so the scan opens the
//      NEWEST capsule first — and the OLDEST message got the LARGEST stamp. Reverse order, exactly.
//
// The fix is not to plumb the chain time through three joints; it is to use the time the SENDER signed. header1
// travels inside the AEAD-authenticated capsule, is identical on both devices, and is already in hand when the
// capsule is opened. It is also persisted into local history, so it repairs already-scrambled dialogs on reload.
const APP = readFileSync('web/app.js', 'utf8');
const SHARD_RPC = readFileSync('web/shard-rpc.mjs', 'utf8');
const CONV_LANE = readFileSync('web/conv-lane.mjs', 'utf8');

describe('RECVORDER — received messages carry the sender-signed time', () => {
  it('RECVORDER-01: the wire really is newest-first, so discovery order is the REVERSE of send order', () => {
    // The premise of the whole defect, pinned at its source. If this ever flips to `asc`, the reasoning in this file
    // stops applying and someone must re-derive it rather than trust the comments.
    expect(SHARD_RPC).toContain("url.searchParams.set('sort', 'desc');");
  });

  it('RECVORDER-02: the CONV lane still supplies no chain time — so the capsule time is not optional', () => {
    // Not a wish: this asserts the gap the fix compensates for. Should the lane ever start passing createdAtSec, this
    // goes red and the fallback chain in privateChainMessageOrderFields can be revisited deliberately.
    expect(CONV_LANE).toContain('entry: convChainEntryFromParsed(parsed),');
    expect(CONV_LANE, 'lane now supplies createdAtSec — revisit the ordering fallback').not.toContain('createdAtSec');
  });

  it('RECVORDER-03: the signed sender time is read from header1 and outranks every local stamp', () => {
    expect(APP).toMatch(/function capsuleSenderCreatedAtMs\(carrier\) \{\s*const ms = Number\(carrier\?\.capsule\?\.header1\?\.createdAt\);/);
    // FIRST in messageCreatedAtMs, before localCreatedAtMs — that ordering is what repairs already-stamped history.
    const body = APP.slice(APP.indexOf('function messageCreatedAtMs(message) {'));
    const signedAt = body.indexOf('capsuleSenderCreatedAtMs(message)');
    const localAt = body.indexOf('message?.localCreatedAtMs');
    expect(signedAt).toBeGreaterThan(-1);
    expect(localAt).toBeGreaterThan(-1);
    expect(signedAt, 'the local discovery stamp must not outrank the signed sender time').toBeLessThan(localAt);
  });

  it('RECVORDER-04: both message builders pass the opened capsule to the order-field builder', () => {
    // Single-part AND multipart. The image the owner sent was multipart; fixing only the single-part path would have
    // left the one message he actually noticed at the top still in the wrong place.
    expect(APP).toContain('...privateChainMessageOrderFields(entry, opened),');
    expect(APP).toContain('...privateChainMessageOrderFields(firstEntry, first),');
    expect(APP).toMatch(/const createdAtMs = privateEntryCreatedAtMs\(entry\) \?\? capsuleSenderCreatedAtMs\(opened\);/);
  });

  it('RECVORDER-05: first contact is stamped from the IntroShard, since an INTRO header1 is deliberately zero', () => {
    // An INTRO capsule uses a CANONICAL header1 (createdAt 0) so it leaks no timing — so first contact cannot use the
    // same source as CONV and must take the shard's own stamp, which the handler passes as the second argument.
    expect(APP).toContain('function handleIntroFirstContact(opened, capsule = null) {');
    expect(APP).toMatch(/const introCreatedAtSec = Number\(capsule\?\.created_at \?\? capsule\?\.createdAt \?\? 0\) \|\| 0;/);
    expect(APP).toMatch(/introCreatedAtSec > 0[\s\S]{0,200}createdAtMs: introCreatedAtSec \* 1000/);
    // The canonical zero must stay unusable rather than becoming 1970: the `> 0` guard is load-bearing.
    expect(APP).toMatch(/return Number\.isFinite\(ms\) && ms > 0 \? ms : null;/);
  });

  it('RECVORDER-06: the stale comment that caused the drop is gone', () => {
    // "INTRO carries no sender wallet" was false under direct-pay and is why handleIntroFirstContact took one
    // argument for so long. A wrong comment above a wrong signature is how a defect survives review.
    expect(APP, 'the comment asserting INTRO has no sender wallet is back').not.toContain('INTRO carries no sender wallet');
  });
});

describe('RECVIDENT — an inbound dialog is named from the INTRO source, but only once VERIFIED', () => {
  it('RECVIDENT-01: the peer wallet is verified against the KeyShard before it becomes a label', () => {
    // The src of an INTRO publish is a HINT: anyone can re-publish a captured capsule from their own wallet. Naming
    // the dialog from an unverified src would let a relayer put THEIR address on someone else's conversation.
    const fn = APP.slice(
      APP.indexOf('async function resolveInboundPeerWalletIdentity(thread, claimedUsername = null) {'),
      APP.indexOf('function threadWearsUsername(thread, claimedUsername) {'),
    );
    expect(fn.length).toBeGreaterThan(200);
    const verifyAt = fn.indexOf('resolvePeerReplyBundle(');
    const labelAt = fn.indexOf('refreshThreadIdentityFromVariants(');
    expect(verifyAt, 'no KeyShard verification in the identity path').toBeGreaterThan(-1);
    expect(labelAt).toBeGreaterThan(-1);
    expect(verifyAt, 'the wallet is labelled before it is verified').toBeLessThan(labelAt);
    expect(fn).toContain('peerKeyId: thread.convPeerKeyId');
  });

  it('RECVIDENT-02: a failed verification SHOWS the dialog rather than hiding it forever', () => {
    // The grace window hides a dialog that is about to be named. If the read never lands, a real received message
    // must not stay invisible — the catch clears the flags.
    const fn = APP.slice(
      APP.indexOf('async function resolveInboundPeerWalletIdentity(thread, claimedUsername = null) {'),
      APP.indexOf('function threadWearsUsername(thread, claimedUsername) {'),
    );
    const catchBlock = fn.slice(fn.indexOf('} catch (error) {'));
    expect(catchBlock).toContain('thread.pendingIdentityResolution = false;');
    expect(catchBlock).toContain('thread.pendingClaimedSenderResolution = false;');
  });

  it('RECVIDENT-03: the pending flags now have a WRITER — the grace machinery was dead code', () => {
    // Before this change `pendingIdentityResolution` was only ever set to false and `pendingClaimedSenderResolution`
    // was never set at all, so isTransientPendingResolutionThread could not return true and the documented 45-second
    // grace never engaged once. A guard reading a flag nobody writes proves nothing.
    expect(APP).toContain('thread.pendingIdentityResolution = true;');
    expect(APP).toContain('thread.pendingClaimedSenderResolution = true;');
    expect(APP).toContain('const PENDING_SENDER_RESOLUTION_GRACE_MS = 45000;');
  });

  it('RECVIDENT-04: resolution is retried on later incoming messages, and never runs twice at once', () => {
    expect(APP).toContain("queueInboundPeerIdentityResolution(targetThread, claimedPeerUsernameFromOpened(opened));");
    expect(APP).toContain('const inboundPeerIdentityInFlight = new Set();');
    expect(APP).toContain('inboundPeerIdentityInFlight.add(thread.id);');
    expect(APP).toContain('inboundPeerIdentityInFlight.delete(thread.id);');
  });
});
