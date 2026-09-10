import { describe, expect, it } from 'vitest';
import {
  serializeConvKeyMap,
  deserializeConvKeyMap,
  sealConvKeyMap,
  openConvKeyMap,
  createConvKeySealKey,
  createSealedConvKeyStore,
  mergeConvKeyMaps,
} from '../web/conv-key-persist.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// CONV-KEY-PERSIST — K_roots are conversation SECRETS; losing them on reload drops every conversation, and storing
// them in the clear leaks every conversation's keys. These tests prove the round-trip survives a simulated reload
// (a message published while offline is still decryptable after) AND that the persisted blob is ciphertext, not the
// keys in the clear. Driven over an in-memory blob backend so the seal + serialize logic is exercised without IndexedDB.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const A = new Uint8Array(32).fill(0x11);
const B = new Uint8Array(32).fill(0x22);
const kroot = (n: number) => new Uint8Array(32).fill(n);
const nonce = (n: number) => new Uint8Array(16).fill(n);
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

function memoryBackend(key: CryptoKey) {
  let blob: any = null;
  return { key, readBlob: async () => blob, writeBlob: async (record: any) => { blob = record; }, peek: () => blob };
}

describe('CONV-KEY-PERSIST', () => {
  it('CKP-01: serialize → deserialize restores every byte field as a real Uint8Array', () => {
    const map = new Map<string, any>();
    map.set('lo:hi', {
      kRootCurrent: kroot(0xa1), kRootsForRead: [{ kRoot: kroot(0xa0), adoptedAt: 90 }],
      peerKeyId: B, peerEncPublicKey: kroot(0xe1), peerWallet: '0:' + 'ab'.repeat(32),
      adoptedCreatedAt: 100, adoptedIntroNonce: nonce(7), outgoingSeq: { 19000: 3 }, lastScannedEpoch: 19001,
    });
    const back = deserializeConvKeyMap(serializeConvKeyMap(map));
    const r = back.get('lo:hi')!;
    expect(r.kRootCurrent).toBeInstanceOf(Uint8Array);
    expect(hex(r.kRootCurrent)).toBe(hex(kroot(0xa1)));
    expect(hex(r.kRootsForRead[0].kRoot)).toBe(hex(kroot(0xa0)));
    expect(r.kRootsForRead[0].adoptedAt).toBe(90);
    expect(hex(r.peerKeyId)).toBe(hex(B));
    expect(hex(r.peerEncPublicKey)).toBe(hex(kroot(0xe1)));
    expect(r.peerWallet).toBe('0:' + 'ab'.repeat(32));
    expect(r.adoptedCreatedAt).toBe(100);
    expect(hex(r.adoptedIntroNonce)).toBe(hex(nonce(7)));
    expect(r.outgoingSeq).toEqual({ 19000: 3 });
    expect(r.lastScannedEpoch).toBe(19001);
  });

  it('CKP-02: a K_root, its scan cursor, and its outgoing seq SURVIVE a simulated reload', async () => {
    const key = await createConvKeySealKey();
    const backend = memoryBackend(key);
    const s1 = await createSealedConvKeyStore(backend);
    await s1.upsertConversationKRoot(A, B, { kRoot: kroot(0x5a), createdAt: 100, introNonce: nonce(1), peerWallet: 'w-A' });
    await s1.advanceConvScanCursor(A, B, 19005);
    expect(await s1.nextOutgoingSeq(A, B, 19005, 0)).toBe(1); // first outgoing on this epoch

    // reload: a fresh store over the SAME sealed blob (device reopened) rehydrates from disk.
    const s2 = await createSealedConvKeyStore(backend);
    const rec = s2.getConversation(A, B)!;
    expect(rec, 'the conversation survived reload').toBeTruthy();
    expect(hex(rec.kRootCurrent), 'K_root recovered — the conversation is not lost').toBe(hex(kroot(0x5a)));
    expect(rec.peerWallet).toBe('w-A');
    expect(rec.lastScannedEpoch, 'scan cursor recovered — offline catch-up still works after reload').toBe(19005);
    // the seq counter continues where it left off, so a post-reload send does not collide with a pre-reload seq.
    expect(await s2.nextOutgoingSeq(A, B, 19005, 0), 'seq continues at 2, not reset to 1').toBe(2);
  });

  it('CKP-03: the persisted blob is CIPHERTEXT — no K_root bytes in the clear', async () => {
    const key = await createConvKeySealKey();
    const map = new Map<string, any>();
    map.set('lo:hi', {
      kRootCurrent: kroot(0xab), kRootsForRead: [], peerKeyId: B, peerEncPublicKey: null,
      peerWallet: null, adoptedCreatedAt: 1, adoptedIntroNonce: nonce(1), outgoingSeq: {}, lastScannedEpoch: null,
    });
    const record = await sealConvKeyMap(key, map);
    const serialized = JSON.stringify(record);
    // the plaintext serialisation would carry the kRoot as base64; the sealed blob must not.
    const clearKRootB64 = Buffer.from(kroot(0xab)).toString('base64');
    expect(serialized.includes(clearKRootB64), 'sealed blob does not leak the K_root').toBe(false);
    // and it round-trips back under the right key.
    const opened = await openConvKeyMap(key, record);
    expect(hex(opened.get('lo:hi')!.kRootCurrent)).toBe(hex(kroot(0xab)));
  });

  it('CKP-04: a blob sealed under one device key does not open under another (isolation / tamper)', async () => {
    const key1 = await createConvKeySealKey();
    const key2 = await createConvKeySealKey();
    const map = new Map<string, any>([['lo:hi', {
      kRootCurrent: kroot(1), kRootsForRead: [], peerKeyId: B, peerEncPublicKey: null,
      peerWallet: null, adoptedCreatedAt: 1, adoptedIntroNonce: nonce(1), outgoingSeq: {}, lastScannedEpoch: null,
    }]]);
    const record = await sealConvKeyMap(key1, map);
    await expect(openConvKeyMap(key2, record)).rejects.toThrow();
    // a missing / empty blob simply yields an empty map (fresh device), never throws.
    expect((await openConvKeyMap(key1, null)).size).toBe(0);
  });
  it('CKP-10: a second tab of the same wallet cannot erase what the first one learned', async () => {
    // THE DEFECT [audit 2026-09-01, round 9]. The persisted form is ONE sealed blob holding the whole map,
    // hydrated once at boot and never re-read, and nothing in this app coordinates tabs — a repo-wide search for
    // BroadcastChannel, navigator.locks and the storage event found ZERO hits. So a tab holding a stale view
    // erased everything the other had learned since it booted, on its very next write. The window opens every
    // sync tick (12-60 s), because a quiet conversation persists its cursor on each one, and what it erases is a
    // K_root: the conversation the peer PAID to open becomes undecryptable and they must send a new INTRO.
    const key = await createConvKeySealKey();
    const backend = memoryBackend(key);
    const open = () => createSealedConvKeyStore({ key, readBlob: backend.readBlob, writeBlob: backend.writeBlob });

    const tab1: any = await open();
    await tab1.upsertConversationKRoot(A, B, { kRoot: kroot(0x31), createdAt: 100, introNonce: nonce(1), peerWallet: null });

    // Tab 2 boots now — its view is a snapshot of this moment and it never re-reads.
    const tab2: any = await open();
    expect(tab2.getConversation(A, B), 'tab 2 sees what was there when it booted').toBeTruthy();

    // Tab 1 then adopts a SECOND conversation — a first contact, paid for by the peer.
    const C = new Uint8Array(32).fill(0x33);
    await tab1.upsertConversationKRoot(A, C, { kRoot: kroot(0x77), createdAt: 200, introNonce: nonce(2), peerWallet: null });
    expect(tab1.getConversation(A, C)).toBeTruthy();

    // …and tab 2 does something entirely unrelated: it advances a cursor on the conversation it already knew.
    await tab2.advanceConvScanCursor(A, B, 20_800);

    // The blob must still hold BOTH. Read it back the way a reload would.
    const reloaded: any = await open();
    expect(reloaded.getConversation(A, C), 'the conversation tab 1 adopted was erased by tab 2').toBeTruthy();
    expect(hex(reloaded.getConversation(A, C).kRootCurrent)).toBe(hex(kroot(0x77)));
    // …and tab 2's own write survived too, and tab 2 is no longer stale about the conversation it never saw.
    expect(Number(reloaded.getConversation(A, B).lastScannedEpoch)).toBe(20_800);
    expect(tab2.getConversation(A, C), 'the writing tab adopts the merged map').toBeTruthy();
  });

  it('CKP-11: the merge never rolls a monotonic field backwards', async () => {
    // A cursor and an outgoing seq are claims about THIS DEVICE — both tabs read the same chain into the same
    // message store — so the max is the honest value. For outgoingSeq it is also load-bearing: RecordShard gate
    // 13653 refuses a seq that does not advance, so a rolled-back counter BOUNCES the next send of that day.
    const mine = new Map<string, any>([['lo:hi', {
      kRootCurrent: kroot(0xa1), kRootsForRead: [{ kRoot: kroot(0xa0), adoptedAt: 90 }],
      peerKeyId: B, peerWallet: null, adoptedCreatedAt: 100, adoptedIntroNonce: nonce(7),
      outgoingSeq: { 20800: 5, 20801: 1 }, lastScannedEpoch: 20_799, lastScannedGeneration: 17,
    }]]);
    const theirs = new Map<string, any>([['lo:hi', {
      kRootCurrent: kroot(0xa1), kRootsForRead: [{ kRoot: kroot(0xb0), adoptedAt: 80 }],
      peerKeyId: B, peerWallet: null, adoptedCreatedAt: 100, adoptedIntroNonce: nonce(7),
      outgoingSeq: { 20800: 9 }, lastScannedEpoch: 20_805, lastScannedGeneration: 18,
    }]]);
    const merged: any = mergeConvKeyMaps(theirs, mine).get('lo:hi');
    expect(merged.outgoingSeq[20800], 'the higher claim on a shared epoch wins').toBe(9);
    expect(merged.outgoingSeq[20801], 'an epoch only one side has is kept').toBe(1);
    expect(Number(merged.lastScannedEpoch), 'the further cursor wins').toBe(20_805);
    expect(merged.lastScannedGeneration, 'and carries the stamp that belongs to it').toBe(18);
    // A retired root either side holds still decrypts that side's history, so the read set unions.
    expect(merged.kRootsForRead.map((entry: any) => hex(entry.kRoot)).sort())
      .toEqual([hex(kroot(0xa0)), hex(kroot(0xb0))].sort());

    // …and a re-INTRO on the other side replaces the root, never the reverse (the importConversations rule).
    const rotated = new Map<string, any>([['lo:hi', { ...theirs.get('lo:hi'), kRootCurrent: kroot(0xcc), adoptedCreatedAt: 500 }]]);
    expect(hex(mergeConvKeyMaps(rotated, mine).get('lo:hi').kRootCurrent)).toBe(hex(kroot(0xcc)));
    expect(hex(mergeConvKeyMaps(mine, rotated).get('lo:hi').kRootCurrent),
      'and an older record can never roll a live root back').toBe(hex(kroot(0xcc)));
  });
});
