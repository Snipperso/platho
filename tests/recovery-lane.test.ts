import { describe, expect, it } from 'vitest';
import { restoreConvKeysFromRecovery, prepareRecoveryBackup } from '../web/recovery-lane.mjs';
import { selfRecoveryShardSpace } from '../web/conv-discovery.mjs';
import { sealRecoveryBlob } from '../web/recovery-blob.mjs';
import { createMemoryConvKeyStore } from '../web/conv-key-store.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// RECOVERY-LANE — the restore + backup orchestration, over stub readers. Restore must probe the WHOLE slot range
// (an eviction hole must not truncate the result), skip a blob sealed under a different seed, and rebuild the K_root
// map from what it finds. Backup must read the slot's seq and publish at seq+1 (a non-advancing seq is rejected).
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const A = new Uint8Array(32).fill(0x11);
const B = new Uint8Array(32).fill(0x22);
const kroot = (n: number) => new Uint8Array(32).fill(n);
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
const SEED = new Uint8Array(32).fill(0x9c);
const OTHER_SEED = new Uint8Array(32).fill(0x01);
const VALUE = 50_000_000n;

async function sampleMap() {
  const store = createMemoryConvKeyStore();
  await store.upsertConversationKRoot(A, B, { kRoot: kroot(0x5a), createdAt: 100, introNonce: new Uint8Array(16).fill(1), peerWallet: 'w-A' });
  await store.advanceConvScanCursor(A, B, 19005);
  return { map: store.snapshot(), convId: [...store.snapshot().keys()][0] };
}

describe('RECOVERY-LANE', () => {
  it('RL-01: restore rebuilds the map from a bound slot, skips a foreign-seed blob, and probes past a gap', async () => {
    const { map, convId } = await sampleMap();
    const { slots } = await selfRecoveryShardSpace(SEED);
    const { body: mine } = await sealRecoveryBlob(SEED, map);
    const { body: foreign } = await sealRecoveryBlob(OTHER_SEED, map);   // sealed under a DIFFERENT seed

    // slot 0 empty (a gap), slot 2 a foreign blob (must be skipped), slot 4 MINE — restore must still reach slot 4.
    const views = new Map<string, any>([
      [slots[2].address, { bound: true, seq: 1n }],
      [slots[4].address, { bound: true, seq: 7n }],
    ]);
    const bodies = new Map<string, any>([
      [slots[2].address, foreign],
      [slots[4].address, mine],
    ]);
    const readView = async (addr: string) => views.get(addr) ?? { bound: false };
    const readBody = async (addr: string) => bodies.get(addr) ?? null;

    const { map: restored, found } = await restoreConvKeysFromRecovery({ seed: SEED, readView, readBody });
    expect(hex(restored.get(convId)!.kRootCurrent), 'the backed-up K_root is restored').toBe(hex(kroot(0x5a)));
    expect(restored.get(convId)!.lastScannedEpoch, 'the cursor comes back too').toBe(19005);
    // ONLY slot 4 yielded records — the foreign-seed slot 2 was skipped, not merged.
    expect(found).toEqual([{ slotIndex: 4, seq: 7, count: 1 }]);
  });

  it('RL-02: an empty recovery space restores to an empty map (fresh account, no error)', async () => {
    const readView = async () => ({ bound: false });
    const readBody = async () => null;
    const { map, found } = await restoreConvKeysFromRecovery({ seed: SEED, readView, readBody });
    expect(map.size).toBe(0);
    expect(found).toEqual([]);
  });

  it('RL-03: backup reads the slot seq and builds at seq+1; a fresh slot starts at seq 1', async () => {
    const { map } = await sampleMap();
    const { slots } = await selfRecoveryShardSpace(SEED);

    const readViewSeq3 = async (addr: string) => (addr === slots[4].address ? { bound: true, seq: 3n } : { bound: false });
    const backup = await prepareRecoveryBackup({ seed: SEED, slotIndex: 4, map, readView: readViewSeq3, value: VALUE });
    expect(backup.seq, 'a bound slot at seq 3 gets the next write at seq 4').toBe(4);
    expect(backup.to, 'the built message targets the derived slot').toBeTruthy();

    const backupFresh = await prepareRecoveryBackup({ seed: SEED, slotIndex: 0, map, readView: async () => ({ bound: false }), value: VALUE });
    expect(backupFresh.seq, 'a fresh slot binds at seq 1').toBe(1);
  });

  it('RL-04: a transient read failure marks the restore UNCLEAN (caller must not treat it as authoritative)', async () => {
    const { map } = await sampleMap();
    const { slots } = await selfRecoveryShardSpace(SEED);
    const { body: mine } = await sealRecoveryBlob(SEED, map);
    // slot 4 holds MY backup, but its view read THROWS (a 429) — restore must report clean=false and NOT return it.
    const readView = async (addr: string) => { if (addr === slots[4].address) throw new Error('429'); return { bound: false }; };
    const readBody = async (addr: string) => (addr === slots[4].address ? mine : null);
    const { clean, found } = await restoreConvKeysFromRecovery({ seed: SEED, readView, readBody });
    expect(clean, 'a thrown read makes the whole scan unclean').toBe(false);
    expect(found.some((f) => f.slotIndex === 4), 'the failed slot yielded nothing').toBe(false);
  });

  it('RL-05: prepareRecoveryBackup REFUSES a blob that would overflow the on-chain cap (loud, not a silent bounce)', async () => {
    // Build a conversation set large enough to exceed RS_MAX_BLOB_CELLS=79 once sealed (each fat record is several cells).
    const big = createMemoryConvKeyStore();
    for (let i = 0; i < 40; i += 1) {
      // peer fills 100..139 never collide with A (0x11) — conversationOrder throws on self==peer.
      await big.upsertConversationKRoot(A, new Uint8Array(32).fill(i + 100), { kRoot: kroot(i + 100), createdAt: 100 + i, introNonce: new Uint8Array(16).fill((i % 40) + 1), peerWallet: '0:' + (i.toString(16).padStart(2, '0')).repeat(32) });
    }
    await expect(
      prepareRecoveryBackup({ seed: SEED, slotIndex: 0, map: big.snapshot(), readView: async () => ({ bound: false }), value: VALUE }),
    ).rejects.toThrow(/over the on-chain cap|RECOVERY_BLOB_OVERFLOW|does not fit/i);
  });

  it('RL-06: prepareRecoveryBackup PROPAGATES a readView failure (never guesses seq 0 and bounces the anti-rollback)', async () => {
    const { map } = await sampleMap();
    await expect(
      prepareRecoveryBackup({ seed: SEED, slotIndex: 0, map, readView: async () => { throw new Error('429'); }, value: VALUE }),
    ).rejects.toThrow(/429/);
  });
});
