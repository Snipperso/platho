import { describe, expect, it } from 'vitest';
import { createMemoryConvKeyStore, conversationId, adoptKRoot } from '../web/conv-key-store.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// CONV-KEY-STORE — the two invariants that keep a private conversation from silently forking or dropping a message.
// Both are the kind of bug that never throws and only shows as "the other side stopped getting my messages".
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const kid = (b: number) => new Uint8Array(32).fill(b);
const kroot = (b: number) => new Uint8Array(32).fill(b);
const nonce = (b: number) => new Uint8Array(16).fill(b);
const A = kid(0x11);
const B = kid(0x22);

describe('CONV-KEY-STORE', () => {
  it('CKS-01: conversationId is the SAME join key from both sides (order-independent)', () => {
    expect(conversationId(A, B), 'initiator and responder must land on one record').toBe(conversationId(B, A));
  });

  it('CKS-02: re-INTRO adoption is last-writer-WINS by createdAt, not by arrival order', async () => {
    const store = createMemoryConvKeyStore();
    // Adopt root #1 (createdAt 100).
    expect(await store.upsertConversationKRoot(A, B, { kRoot: kroot(1), createdAt: 100, introNonce: nonce(1), peerEncPublicKey: kid(0x33) })).toBe('created');
    // A LATER-ARRIVING but OLDER re-INTRO (createdAt 50) must NOT clobber the live root — this is the fork-prevention.
    expect(await store.upsertConversationKRoot(A, B, { kRoot: kroot(2), createdAt: 50, introNonce: nonce(2) })).toBe('retained');
    let rec = store.getConversation(A, B)!;
    expect([...rec.kRootCurrent], 'the newer root stays current').toEqual([...kroot(1)]);
    expect(rec.kRootsForRead.length, 'the older root is kept for decrypting its history').toBe(1);
    // A genuinely NEWER re-INTRO (createdAt 150) IS adopted; the previous current retires to read-only.
    expect(await store.upsertConversationKRoot(A, B, { kRoot: kroot(3), createdAt: 150, introNonce: nonce(3) })).toBe('adopted');
    rec = store.getConversation(A, B)!;
    expect([...rec.kRootCurrent], 'the newest root now drives derivation').toEqual([...kroot(3)]);
    expect(rec.kRootsForRead.length, 'both older roots remain readable').toBe(2);
  });

  it('CKS-03: adoption ties on createdAt break by introNonce (deterministic on both sides)', () => {
    const base = adoptKRoot(undefined, { kRoot: kroot(1), createdAt: 100, introNonce: nonce(5), peerKeyId: B }).record;
    // higher nonce at the same createdAt wins; lower nonce is retained
    expect(adoptKRoot(base, { kRoot: kroot(2), createdAt: 100, introNonce: nonce(9), peerKeyId: B }).outcome).toBe('adopted');
    expect(adoptKRoot(base, { kRoot: kroot(2), createdAt: 100, introNonce: nonce(2), peerKeyId: B }).outcome).toBe('retained');
  });

  it('CKS-04: re-adopting the identical intro is idempotent (no duplicate read-roots)', async () => {
    const store = createMemoryConvKeyStore();
    await store.upsertConversationKRoot(A, B, { kRoot: kroot(1), createdAt: 100, introNonce: nonce(1) });
    expect(await store.upsertConversationKRoot(A, B, { kRoot: kroot(1), createdAt: 100, introNonce: nonce(1) })).toBe('duplicate');
    expect(store.getConversation(A, B)!.kRootsForRead.length, 'no phantom read-root from a replayed intro').toBe(0);
  });

  it('CKS-05: outgoing seq is locally monotonic — two fast messages never collide, coldFloor only seeds', async () => {
    const store = createMemoryConvKeyStore();
    await store.upsertConversationKRoot(A, B, { kRoot: kroot(1), createdAt: 100, introNonce: nonce(1) });
    // cold start: the chain says last_seq = 7, so the first outgoing is 8...
    const first = await store.nextOutgoingSeq(A, B, 19000, 7);
    // ...and a SECOND message sent before the chain read refreshes must be 9, not 8 again (the lost-2nd-message bug).
    const second = await store.nextOutgoingSeq(A, B, 19000, 7);
    expect(first).toBe(8);
    expect(second, 'a stale coldFloor must not reset the local counter').toBe(9);
    // a different epoch has its own counter, seeded by its own floor
    expect(await store.nextOutgoingSeq(A, B, 19001, 0)).toBe(1);
  });

  it('CKS-06: peerWallet (the INTRO tx src) is stored on create and preserved across a re-INTRO', async () => {
    const store = createMemoryConvKeyStore();
    const walletA = '0:' + 'ab'.repeat(32);
    await store.upsertConversationKRoot(A, B, { kRoot: kroot(1), createdAt: 100, introNonce: nonce(1), peerWallet: walletA });
    expect(store.getConversation(A, B)!.peerWallet, 'wallet captured on first contact').toBe(walletA);
    // a re-INTRO with no wallet must NOT wipe the known peer wallet (a reply must still resolve the bundle)...
    await store.upsertConversationKRoot(A, B, { kRoot: kroot(2), createdAt: 200, introNonce: nonce(2) });
    expect(store.getConversation(A, B)!.peerWallet, 'a walletless re-INTRO keeps the known wallet').toBe(walletA);
    // ...and a re-INTRO carrying a NEW wallet updates it.
    const walletA2 = '0:' + 'cd'.repeat(32);
    await store.upsertConversationKRoot(A, B, { kRoot: kroot(3), createdAt: 300, introNonce: nonce(3), peerWallet: walletA2 });
    expect(store.getConversation(A, B)!.peerWallet, 'a newer INTRO updates the wallet').toBe(walletA2);
  });

  it('CKS-07: the receive scan cursor is null on create, advances MONOTONICALLY, and survives a re-INTRO', async () => {
    const store = createMemoryConvKeyStore();
    await store.upsertConversationKRoot(A, B, { kRoot: kroot(1), createdAt: 100, introNonce: nonce(1) });
    expect(store.getConversation(A, B)!.lastScannedEpoch, 'never scanned yet').toBeNull();
    await store.advanceConvScanCursor(A, B, 19000);
    expect(store.getConversation(A, B)!.lastScannedEpoch, 'cursor set').toBe(19000);
    // a LATER pass that scanned a NARROWER window must not rewind the cursor and re-open the offline gap.
    await store.advanceConvScanCursor(A, B, 18990);
    expect(store.getConversation(A, B)!.lastScannedEpoch, 'monotonic — never rewinds').toBe(19000);
    await store.advanceConvScanCursor(A, B, 19005);
    expect(store.getConversation(A, B)!.lastScannedEpoch, 'advances forward').toBe(19005);
    // a re-INTRO (adopt) keeps the cursor — a new K_root does not reset how far we have scanned.
    await store.upsertConversationKRoot(A, B, { kRoot: kroot(2), createdAt: 200, introNonce: nonce(2) });
    expect(store.getConversation(A, B)!.lastScannedEpoch, 'cursor survives a re-INTRO').toBe(19005);
    // unknown conversation is a no-op (never throws).
    await store.advanceConvScanCursor(A, kroot(9), 5);
  });

  it('CKS-08: importConversations rehydrates records (restore), and a NEWER live root is not rolled back by an older backup', async () => {
    const hx = (b: Uint8Array) => Buffer.from(b).toString('hex');
    // a backup map (what the RECOVERY blob would restore)
    const backup = createMemoryConvKeyStore();
    await backup.upsertConversationKRoot(A, B, { kRoot: kroot(1), createdAt: 100, introNonce: nonce(1), peerWallet: 'w-A' });
    await backup.advanceConvScanCursor(A, B, 19005);
    const backupMap = backup.snapshot();

    // import into a FRESH device store — the conversation (K_root + cursor + wallet) comes back.
    const fresh = createMemoryConvKeyStore();
    expect(await fresh.importConversations(backupMap), 'one record imported').toBe(1);
    expect(hx(fresh.getConversation(A, B)!.kRootCurrent)).toBe(hx(kroot(1)));
    expect(fresh.getConversation(A, B)!.lastScannedEpoch).toBe(19005);
    expect(fresh.getConversation(A, B)!.peerWallet).toBe('w-A');

    // NEWER-WINS: a device already holding a newer root (createdAt 300) ignores the older backup (createdAt 100).
    const live = createMemoryConvKeyStore();
    await live.upsertConversationKRoot(A, B, { kRoot: kroot(9), createdAt: 300, introNonce: nonce(9) });
    expect(await live.importConversations(backupMap), 'older backup does not overwrite a newer live root').toBe(0);
    expect(hx(live.getConversation(A, B)!.kRootCurrent), 'the live (rotated) root stays current').toBe(hx(kroot(9)));
  });
});
