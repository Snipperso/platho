import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// `convPeerKeyId` is the bridge from an adopted INTRO to CONV routing: the receive scan finds a dialog by it, and the
// send path stamps it. It used to live ONLY in memory — serializeThreadForHistory wrote eleven fields and not this one.
//
// OBSERVED 2026-08-03, owner's device: after a send, an empty "Anonymous jJrUJ8t-" dialog appeared next to the real
// one. jJrUJ8t- is the PEER's keyId (checked against the owner's own, which starts A4eZWHSb — so this was not a
// self-send). With the field dropped on reload, resolveConvReceiveThread could not match the established dialog and
// minted an anonymous one beside it; that empty twin then persisted into local history and returned on every start.
//
// Source-level pins: the failure is which FIELDS cross the persistence boundary, and driving the real store would need
// the whole encrypted-history stack. What must hold is that all three sides — write, restore, create — name it.
const APP = readFileSync('web/app.js', 'utf8');

describe('CONVBRIDGE — the peer keyId must survive a reload', () => {
  it('CONVBRIDGE-01: the history snapshot carries convPeerKeyId', () => {
    const serializer = APP.slice(APP.indexOf('function serializeThreadForHistory'), APP.indexOf('function peerLabelFromThreadId'));
    expect(serializer).toContain('convPeerKeyId: thread.convPeerKeyId ?? null,');
  });

  it('CONVBRIDGE-02: restoring a snapshot puts it back, without clobbering a live value', () => {
    const restore = APP.slice(APP.indexOf('function applyHistoryThreadSnapshot'), APP.indexOf('function ensureHistoryThread'));
    expect(restore).toContain('if (!thread.convPeerKeyId && snapshot.convPeerKeyId) thread.convPeerKeyId = snapshot.convPeerKeyId;');
    // The guard matters in its own right: a value stamped by THIS session's send is authoritative over a persisted
    // copy, so the restore must not overwrite it. Counted rather than pattern-matched — the assignment may appear
    // exactly once, and that once is the guarded line asserted above.
    const assignments = restore.match(/thread\.convPeerKeyId = snapshot\.convPeerKeyId/g) ?? [];
    expect(assignments).toHaveLength(1);
  });

  it('CONVBRIDGE-03: a send heals the empty anonymous twin an older build left behind', () => {
    expect(APP).toContain('dropEmptyAnonymousTwin(thread, sendState.peerKeyId);');
    const heal = APP.slice(APP.indexOf('function dropEmptyAnonymousTwin'), APP.indexOf('function resolveConvReceiveThread'));
    // Narrowness is the whole safety argument: an anonymous thread WITH messages is a real conversation whose peer
    // never revealed a wallet. Deleting that would lose messages, so the length check must stay.
    expect(heal).toContain("if ((threads[index].messages?.length ?? 0) > 0) return;");
    expect(heal).toContain('if (!twinId || twinId === keepThread.id) return;');
  });
});
