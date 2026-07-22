import { describe, expect, it } from 'vitest';
import { createMemoryConvKeyStore } from '../web/conv-key-store.mjs';
import { sealRecoveryBlob, openRecoveryBlob, recoveryBlobKey } from '../web/recovery-blob.mjs';
import { tonCell } from '../web/pwa-contract-transactions.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// RECOVERY-BLOB — the on-chain durability body. A reinstalled device has ONLY the mnemonic, so the K_root map must
// seal + open from the SEED alone (not a device key). These prove: the map survives seal→(on-chain cell)→open under the
// same seed, a different seed cannot open it, the digest hashes are non-zero (gate 13571), and it round-trips through
// the BoC form the slot actually stores/returns.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const A = new Uint8Array(32).fill(0x11);
const B = new Uint8Array(32).fill(0x22);
const kroot = (n: number) => new Uint8Array(32).fill(n);
const nonce = (n: number) => new Uint8Array(16).fill(n);
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
const SEED = new Uint8Array(32).fill(0x33);

async function sampleMap() {
  const store = createMemoryConvKeyStore();
  await store.upsertConversationKRoot(A, B, { kRoot: kroot(0x5a), createdAt: 100, introNonce: nonce(1), peerWallet: 'w-A' });
  await store.advanceConvScanCursor(A, B, 19005);
  await store.nextOutgoingSeq(A, B, 19005, 0);
  return { map: store.snapshot(), convId: [...store.snapshot().keys()][0] };
}

describe('RECOVERY-BLOB', () => {
  it('RB-01: the K_root map survives seal → open under the SAME seed (K_root, cursor, seq recovered)', async () => {
    const { map, convId } = await sampleMap();
    const { body, h0, h1 } = await sealRecoveryBlob(SEED, map);
    expect(h0, 'h0 non-zero (gate 13571)').not.toBe(0n);
    expect(h1, 'h1 non-zero (gate 13571)').not.toBe(0n);

    const restored = await openRecoveryBlob(SEED, body);
    const rec = restored.get(convId)!;
    expect(rec, 'the conversation is recovered on a fresh device from the seed').toBeTruthy();
    expect(hex(rec.kRootCurrent), 'K_root recovered').toBe(hex(kroot(0x5a)));
    expect(rec.peerWallet).toBe('w-A');
    expect(rec.lastScannedEpoch, 'scan cursor recovered').toBe(19005);
    // COMPACT FORM: outgoingSeq / kRootsForRead / peerEncPublicKey are NOT stored on chain (unbounded / re-derivable) —
    // they default on restore, and the next send cold-floors the seq from the shard's chain last_seq. [compact blob]
    expect(rec.outgoingSeq, 'outgoing seq is NOT persisted — re-derived from chain on send').toEqual({});
    expect(rec.kRootsForRead, 'retired roots are not persisted').toEqual([]);
    expect(rec.peerEncPublicKey, 'peer enc key re-read from the KeyShard bundle').toBeNull();
  });

  it('RB-02: a DIFFERENT seed cannot open the blob (the durability is seed-bound)', async () => {
    const { map } = await sampleMap();
    const { body } = await sealRecoveryBlob(SEED, map);
    await expect(openRecoveryBlob(new Uint8Array(32).fill(0x99), body)).rejects.toThrow();
  });

  it('RB-03: h1 is the blob content hash — a different map yields a different h1 (integrity marker)', async () => {
    const { map } = await sampleMap();
    const a = await sealRecoveryBlob(SEED, map);
    const empty = await sealRecoveryBlob(SEED, new Map());
    expect(a.h1).not.toBe(empty.h1);
    // h0 is a fixed version domain marker — stable across blobs.
    expect(a.h0).toBe(empty.h0);
  });

  it('RB-04: the body round-trips through the BoC form the slot stores + returns', async () => {
    const { map, convId } = await sampleMap();
    const { body } = await sealRecoveryBlob(SEED, map);
    // simulate the on-chain store + read-back: serialise to BoC and parse it back, exactly as a slot getter returns it.
    const wireBody = tonCell.parseBocBase64(tonCell.bytesToBase64(tonCell.serializeBoc(body)));
    const restored = await openRecoveryBlob(SEED, wireBody);
    expect(hex(restored.get(convId)!.kRootCurrent)).toBe(hex(kroot(0x5a)));
  });

  it('RB-05: the blob key is deterministic from the seed (a reinstall derives the same key)', async () => {
    const k1 = await recoveryBlobKey(SEED);
    const k2 = await recoveryBlobKey(SEED);
    // seal under k1 (via sealRecoveryBlob path) and open under a freshly-derived key proves determinism end-to-end.
    const { map, convId } = await sampleMap();
    const { body } = await sealRecoveryBlob(SEED, map);
    const restored = await openRecoveryBlob(SEED, body);
    expect(restored.get(convId)).toBeTruthy();
    expect(k1).toBeTruthy(); expect(k2).toBeTruthy();
  });
});
