import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  serializeConvKeyMap,
  deserializeConvKeyMap,
  sealConvKeyMap,
  openConvKeyMap,
  createConvKeySealKey,
  createSealedConvKeyStore,
  createIndexedDbConvKeyStore,
  mergeConvKeyMaps,
  sealLegacyConvKeyMap,
} from '../web/conv-key-persist.mjs';
import { generateRandomAtRestKeys, openLegacyGrace } from '../web/at-rest-seal.mjs';


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
    expect(await s1.nextOutgoingSeq(A, B, 19005, 0)).toBe(1);

    const s2 = await createSealedConvKeyStore(backend);
    const rec = s2.getConversation(A, B)!;
    expect(rec, 'the conversation survived reload').toBeTruthy();
    expect(hex(rec.kRootCurrent), 'K_root recovered — the conversation is not lost').toBe(hex(kroot(0x5a)));
    expect(rec.peerWallet).toBe('w-A');
    expect(rec.lastScannedEpoch, 'scan cursor recovered — offline catch-up still works after reload').toBe(19005);
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
    const clearKRootB64 = Buffer.from(kroot(0xab)).toString('base64');
    expect(serialized.includes(clearKRootB64), 'sealed blob does not leak the K_root').toBe(false);
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
    expect((await openConvKeyMap(key1, null)).size).toBe(0);
  });
  it('CKP-10: a second tab of the same wallet cannot erase what the first one learned', async () => {
    const key = await createConvKeySealKey();
    const backend = memoryBackend(key);
    const open = () => createSealedConvKeyStore({ key, readBlob: backend.readBlob, writeBlob: backend.writeBlob });

    const tab1: any = await open();
    await tab1.upsertConversationKRoot(A, B, { kRoot: kroot(0x31), createdAt: 100, introNonce: nonce(1), peerWallet: null });

    const tab2: any = await open();
    expect(tab2.getConversation(A, B), 'tab 2 sees what was there when it booted').toBeTruthy();

    const C = new Uint8Array(32).fill(0x33);
    await tab1.upsertConversationKRoot(A, C, { kRoot: kroot(0x77), createdAt: 200, introNonce: nonce(2), peerWallet: null });
    expect(tab1.getConversation(A, C)).toBeTruthy();

    await tab2.advanceConvScanCursor(A, B, 20_800);

    const reloaded: any = await open();
    expect(reloaded.getConversation(A, C), 'the conversation tab 1 adopted was erased by tab 2').toBeTruthy();
    expect(hex(reloaded.getConversation(A, C).kRootCurrent)).toBe(hex(kroot(0x77)));
    expect(Number(reloaded.getConversation(A, B).lastScannedEpoch)).toBe(20_800);
    expect(tab2.getConversation(A, C), 'the writing tab adopts the merged map').toBeTruthy();
  });

  it('CKP-11: the merge never rolls a monotonic field backwards', async () => {
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
    expect(merged.kRootsForRead.map((entry: any) => hex(entry.kRoot)).sort())
      .toEqual([hex(kroot(0xa0)), hex(kroot(0xb0))].sort());

    const rotated = new Map<string, any>([['lo:hi', { ...theirs.get('lo:hi'), kRootCurrent: kroot(0xcc), adoptedCreatedAt: 500 }]]);
    expect(hex(mergeConvKeyMaps(rotated, mine).get('lo:hi').kRootCurrent)).toBe(hex(kroot(0xcc)));
    expect(hex(mergeConvKeyMaps(mine, rotated).get('lo:hi').kRootCurrent),
      'and an older record can never roll a live root back').toBe(hex(kroot(0xcc)));
  });

  it('CKP-04: the INTRO publishers ride the sealed map — serialize → deserialize keeps them, and an old record without them reads as none [round 5]', () => {
    const map = new Map<string, any>();
    map.set('lo:hi', {
      kRootCurrent: kroot(0xa1), kRootsForRead: [], peerKeyId: B, peerEncPublicKey: kroot(0xe1), peerWallet: 'w-a',
      peerWalletCandidates: ['w-a', 'w-b'], adoptedCreatedAt: 100, adoptedIntroNonce: nonce(7), outgoingSeq: {}, lastScannedEpoch: null,
    });
    map.set('old:one', {
      kRootCurrent: kroot(0xa2), kRootsForRead: [], peerKeyId: B, peerEncPublicKey: kroot(0xe2), peerWallet: 'w-c',
      adoptedCreatedAt: 100, adoptedIntroNonce: nonce(8), outgoingSeq: {}, lastScannedEpoch: null,
    });
    const back = deserializeConvKeyMap(serializeConvKeyMap(map));
    expect(back.get('lo:hi')!.peerWalletCandidates).toEqual(['w-a', 'w-b']);
    expect(back.get('old:one')!.peerWalletCandidates).toEqual([]);
  });

  it('CKP-12: the roots sealed under the device key move to the wallet\'s key at the first open — merged, never overwritten — and the device key stays for its grace; what an older tab writes back is moved again', async () => {
    const held = (globalThis as any).indexedDB;
    const factory = new IDBFactory();
    (globalThis as any).indexedDB = factory;
    try {
      const raw = (name: string) => new Promise<any>((resolve, reject) => {
        const request = factory.open(name, 1);
        request.onupgradeneeded = () => { const db = request.result; db.createObjectStore('convKeys', { keyPath: 'id' }); db.createObjectStore('convKeyBlob', { keyPath: 'id' }); };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const put = async (db: any, store: string, value: any) => new Promise<void>((resolve) => { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(value); tx.oncomplete = () => resolve(); });
      const all = async (db: any, store: string) => new Promise<any[]>((resolve) => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => resolve(r.result); });
      const deviceKey = await createConvKeySealKey();
      const legacy = new Map<string, any>([['lo:hi', {
        kRootCurrent: kroot(0xa1), kRootsForRead: [], peerKeyId: B, peerEncPublicKey: kroot(0xe1), peerWallet: 'w-old',
        adoptedCreatedAt: 100, adoptedIntroNonce: nonce(7), outgoingSeq: { 20000: 4 }, lastScannedEpoch: 20000,
      }]]);
      const db = await raw('ckp-move');
      await put(db, 'convKeys', { id: 'device-conv-key-v1', key: deviceKey, createdAt: 1 });
      await put(db, 'convKeyBlob', await sealLegacyConvKeyMap(deviceKey, legacy));
      const atRestKey = (await generateRandomAtRestKeys()).convKeys.seal;
      await expect(createIndexedDbConvKeyStore({ dbName: 'ckp-move' } as any), 'no store without the wallet\'s key').rejects.toThrow(/at-rest key/);
      const store: any = await createIndexedDbConvKeyStore({ dbName: 'ckp-move', atRestKey });
      expect(store.getConversation(A, B)?.peerWallet ?? store.snapshot().get('lo:hi')?.peerWallet).toBe('w-old');
      const kept = await all(db, 'convKeys');
      expect(kept.map((k: any) => k.id).sort(), 'the device key stays, beside its grace').toEqual(['device-conv-key-v1', 'legacy-key-retire-after']);
      const grace = kept.find((k: any) => k.id === 'legacy-key-retire-after');
      expect(grace.at, 'its moment is sealed, not in clear [round 13 — atrest-4]').toBeUndefined();
      expect((await openLegacyGrace(atRestKey, grace))!.at - Date.now()).toBeGreaterThan(6 * 86_400_000);
      const blobs = await all(db, 'convKeyBlob');
      expect(blobs.map((b: any) => b.id)).toEqual(['conv-key-map-v2']);
      expect(JSON.stringify(blobs)).not.toContain(Buffer.from(kroot(0xa1)).toString('base64'));
      const again = await createConvKeySealKey();
      await put(db, 'convKeys', { id: 'device-conv-key-v1', key: again, createdAt: 2 });
      await put(db, 'convKeyBlob', await sealLegacyConvKeyMap(again, new Map([['lo:hi', { ...legacy.get('lo:hi'), outgoingSeq: { 20000: 9 } }]])));
      const reopened: any = await createIndexedDbConvKeyStore({ dbName: 'ckp-move', atRestKey });
      expect(reopened.snapshot().get('lo:hi').outgoingSeq['20000']).toBe(9);
      expect((await all(db, 'convKeyBlob')).map((b: any) => b.id)).toEqual(['conv-key-map-v2']);
      expect((await all(db, 'convKeys')).map((k: any) => k.id).sort()).toEqual(['device-conv-key-v1', 'legacy-key-retire-after']);
      await createIndexedDbConvKeyStore({ dbName: 'ckp-move', atRestKey, now: () => Date.now() + 8 * 86_400_000 } as any);
      expect(await all(db, 'convKeys')).toEqual([]);
      await expect(createIndexedDbConvKeyStore({ dbName: 'ckp-move', atRestKey: (await generateRandomAtRestKeys()).convKeys.seal })).rejects.toThrow();
      db.close();
    } finally {
      (globalThis as any).indexedDB = held;
    }
  });

});
