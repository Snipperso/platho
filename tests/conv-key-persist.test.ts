import { describe, expect, it } from 'vitest';
import {
  serializeConvKeyMap,
  deserializeConvKeyMap,
  sealConvKeyMap,
  openConvKeyMap,
  createConvKeySealKey,
  createSealedConvKeyStore,
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
});
