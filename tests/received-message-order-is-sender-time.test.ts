import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const APP = readFileSync('web/app.js', 'utf8');
const SHARD_RPC = readFileSync('web/shard-rpc.mjs', 'utf8');
const CONV_LANE = readFileSync('web/conv-lane.mjs', 'utf8');

describe('RECVORDER — received messages carry the sender-signed time', () => {
  it('RECVORDER-01: the wire really is newest-first, so discovery order is the REVERSE of send order', () => {
    expect(SHARD_RPC).toContain("url.searchParams.set('sort', 'desc');");
  });

  it('RECVORDER-02: the CONV lane still supplies no chain time — so the capsule time is not optional', () => {
    expect(CONV_LANE).toContain('entry: convChainEntryFromParsed(parsed),');
    expect(CONV_LANE, 'lane now supplies createdAtSec — revisit the ordering fallback').not.toContain('createdAtSec');
  });

  it('RECVORDER-03: the signed sender time is read from header1 and outranks every local stamp', () => {
    expect(APP).toMatch(/function capsuleSenderCreatedAtMs\(carrier\) \{\s*const ms = Number\(carrier\?\.capsule\?\.header1\?\.createdAt\);/);
    const body = APP.slice(APP.indexOf('function messageCreatedAtMs(message) {'));
    const signedAt = body.indexOf('capsuleSenderCreatedAtMs(message)');
    const localAt = body.indexOf('message?.localCreatedAtMs');
    expect(signedAt).toBeGreaterThan(-1);
    expect(localAt).toBeGreaterThan(-1);
    expect(signedAt, 'the local discovery stamp must not outrank the signed sender time').toBeLessThan(localAt);
  });

  it('RECVORDER-04: both message builders pass the opened capsule to the order-field builder', () => {
    expect(APP).toContain('...privateChainMessageOrderFields(entry, opened),');
    expect(APP).toContain('...privateChainMessageOrderFields(firstEntry, first),');
    expect(APP).toMatch(/const createdAtMs = privateEntryCreatedAtMs\(entry\) \?\? capsuleSenderCreatedAtMs\(opened\);/);
  });

  it('RECVORDER-05: first contact is stamped from the IntroShard, since an INTRO header1 is deliberately zero', () => {
    expect(APP).toContain('function handleIntroFirstContact(opened, capsule = null) {');
    expect(APP).toMatch(/const introCreatedAtSec = Number\(capsule\?\.created_at \?\? capsule\?\.createdAt \?\? 0\) \|\| 0;/);
    expect(APP).toMatch(/introCreatedAtSec > 0[\s\S]{0,200}createdAtMs: introCreatedAtSec \* 1000/);
    expect(APP).toMatch(/return Number\.isFinite\(ms\) && ms > 0 \? ms : null;/);
  });

  it('RECVORDER-06: the stale comment that caused the drop is gone', () => {
    expect(APP, 'the comment asserting INTRO has no sender wallet is back').not.toContain('INTRO carries no sender wallet');
  });
});

describe('RECVIDENT — an inbound dialog is named from the INTRO source, but only once VERIFIED', () => {
  it('RECVIDENT-01: the peer wallet is verified against the KeyShard before it becomes a label', () => {
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
    const fn = APP.slice(
      APP.indexOf('async function resolveInboundPeerWalletIdentity(thread, claimedUsername = null) {'),
      APP.indexOf('function threadWearsUsername(thread, claimedUsername) {'),
    );
    const catchBlock = fn.slice(fn.indexOf('} catch (error) {'));
    expect(catchBlock).toContain('thread.pendingIdentityResolution = false;');
    expect(catchBlock).toContain('thread.pendingClaimedSenderResolution = false;');
  });

  it('RECVIDENT-03: the pending flags now have a WRITER — the grace machinery was dead code', () => {
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
