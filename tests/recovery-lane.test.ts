import { describe, expect, it } from 'vitest';
import { restoreConvKeysFromRecovery, prepareRecoveryBackup, staleRecoverySlots, recoverySlotForConversation, partitionRecoveryMap, preparePrefsBackup, restorePrefsSnapshot, confirmRecoverySlotWrite, confirmRecoverySlotWrites, RECOVERY_CONFIRM_DELAYS_MS } from '../web/recovery-lane.mjs';
import { selfRecoveryShardSpace, selfRecoveryShard } from '../web/conv-discovery.mjs';
import { sealRecoveryBlob, sealPrefsBlob } from '../web/recovery-blob.mjs';
import { PREFS_NAMED_SLOT_INDEX } from '../web/shard-discovery.mjs';
import { createMemoryConvKeyStore } from '../web/conv-key-store.mjs';
import { tonCell } from '../web/pwa-contract-transactions.mjs';

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

  it('RL-09: the W1-009 freeze sweep returns only bound, locally-present slots idle past the refresh horizon', async () => {
    const { slots } = await selfRecoveryShardSpace(SEED);
    const nowS = 1_800_000_000;
    const refreshAfterS = 47_304_000;   // 1.5y — mirrors app.js RECOVERY_REFRESH_AFTER_S
    const views = new Map<string, any>([
      [slots[1].address, { bound: true, seq: 2n, updated_at: BigInt(nowS - 63_072_000) }],   // 2y idle -> STALE
      [slots[3].address, { bound: true, seq: 5n, updated_at: BigInt(nowS - 86_400) }],        // 1 day -> fresh
      [slots[5].address, { bound: true, seq: 1n, updated_at: BigInt(nowS - 63_072_000) }],    // stale but NOT local
      [slots[9].address, { bound: false }],                                                    // never written
    ]);
    const readView = async (addr: string) => {
      if (addr === slots[7].address) throw new Error('429');   // transient read -> skip, never treat as stale
      return views.get(addr) ?? { bound: false };
    };
    // slot 5 is deliberately EXCLUDED — a slot the local map no longer occupies must not be rewritten from a partial map.
    const localSlotIndices = new Set([1, 3, 7, 9]);
    const stale = await staleRecoverySlots({ seed: SEED, readView, localSlotIndices, nowS, refreshAfterS });
    expect(stale, 'only the bound, locally-present, idle-past-horizon slot is refreshed').toEqual([1]);
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

  it('RL-07: multi-slot — slot mapping is deterministic + in range, and partition loses no conversation', async () => {
    const store = createMemoryConvKeyStore();
    for (let i = 0; i < 50; i += 1) {
      await store.upsertConversationKRoot(A, new Uint8Array(32).fill(i + 100), { kRoot: kroot(i + 100), createdAt: 100 + i, introNonce: new Uint8Array(16).fill((i % 40) + 1) });
    }
    const map = store.snapshot();
    for (const id of map.keys()) {
      const slot = recoverySlotForConversation(id);
      expect(slot, 'deterministic').toBe(recoverySlotForConversation(id));
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(slot, 'within [0, RECOVERY_MAX_SLOTS)').toBeLessThan(256);
    }
    const bySlot = partitionRecoveryMap(map);
    let total = 0;
    for (const [slot, part] of bySlot) {
      total += part.size;
      for (const id of part.keys()) expect(recoverySlotForConversation(id), 'each conversation is in ITS slot').toBe(slot);
    }
    expect(total, 'no conversation lost across the partition').toBe(map.size);
    expect(bySlot.size, '50 conversations spread across more than one slot').toBeGreaterThan(1);
  });

  it('RL-08: prefs backup builds at seq+1 on the NAMED slot, and restore reads it back from that slot only', async () => {
    const prefs = new TextEncoder().encode(JSON.stringify({ channels: ['0:cc'], at: 1790000000 }));
    const prefsSlot = await selfRecoveryShard(SEED, PREFS_NAMED_SLOT_INDEX);
    const otherSlot = (await selfRecoveryShardSpace(SEED)).slots[7];   // a conversation slot — must NOT be where prefs land

    // backup: reads the prefs slot's seq and builds at seq+1, targeting the prefs slot (not a conversation slot).
    const readViewSeq2 = async (addr: string) => (addr === prefsSlot.address ? { bound: true, seq: 2n } : { bound: false });
    const backup = await preparePrefsBackup({ seed: SEED, prefsBytes: prefs, readView: readViewSeq2, value: VALUE });
    expect(backup.seq, 'a bound prefs slot at seq 2 gets the next write at seq 3').toBe(3);
    expect(backup.to, 'the built message targets the NAMED prefs slot, not a conversation slot').toBe(otherSlot.address === backup.to ? 'MISMATCH' : backup.to);
    expect(backup.slotIndex).toBe(PREFS_NAMED_SLOT_INDEX);

    // restore: the prefs slot holds the sealed blob; a conversation slot does not — restore reads the named slot ONLY.
    const { body } = await sealPrefsBlob(SEED, prefs);
    const readView = async (addr: string) => (addr === prefsSlot.address ? { bound: true, seq: 3n } : { bound: false });
    const readBody = async (addr: string) => (addr === prefsSlot.address ? body : null);
    const restored = await restorePrefsSnapshot({ seed: SEED, readView, readBody });
    expect(restored.clean).toBe(true);
    expect(restored.prefsBytes, 'the exact prefs bytes come back from the named slot').toEqual(prefs);

    // a fresh (never-written) prefs slot restores cleanly to null (no prefs yet), not an error.
    const empty = await restorePrefsSnapshot({ seed: SEED, readView: async () => ({ bound: false }), readBody: async () => null });
    expect(empty).toEqual({ prefsBytes: null, clean: true });
  });
  it('RL-UNREADABLE-01: a bound slot this build cannot open makes the restore UNCLEAN, so backups stay locked', async () => {
    // [audit 2026-09-01, round 9.] openRecoveryBlob answered an unreadable blob with an EMPTY MAP and the restore
    // skipped the throw path without touching `clean`. Either way the pass came back clean, which is what unlocks
    // the backup (convRecoveryBackupAllowed) — and the next dirty slot then published OVER that slot at seq+1,
    // destroying every conversation in it. The live trigger is a version skew: SEAL_VERSION is 2 and version 1
    // existed, so two devices on different builds during a PWA rollout is the whole story. Nothing foreign can
    // be at the slot — the address is seed-derived and the contract makes the slot commit to the owner key — so
    // an unopenable blob there is THIS seed's own, from a build whose format this one does not read.
    const slots = (await selfRecoveryShardSpace(SEED)).slots;
    const target = slots[7];
    const unreadable = tonCell.snakeCellFromBytes(
      new TextEncoder().encode(JSON.stringify({ version: 1, alg: 'AES-256-GCM', nonce: 'AA', ciphertext: 'BB' })),
      'recovery blob',
    );
    const result: any = await restoreConvKeysFromRecovery({
      seed: SEED,
      readView: async (address: string) => (address === target.address ? { bound: true, seq: 3 } : { bound: false }),
      readBody: async (address: string) => (address === target.address ? unreadable : null),
    });
    expect(result.clean, 'a slot that could not be opened must not read as a clean pass').toBe(false);
    expect(result.map.size, 'and nothing may be claimed as restored from it').toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE RECEIPT [audit 2026-09-05, round 2]: a self-lane write is saved when the slot's seq shows it, not when the
// external is queued at a door. These gates hold the poller that every self lane now waits on.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
describe('recovery slot receipt', () => {
  const slot = '0:' + 'aa'.repeat(32);
  it('RL-RECEIPT-01: the write is confirmed the moment a slot shows the claimed seq, and not before', async () => {
    const seqs = [3n, 3n, 4n];   // two reads still show the old seq, the third the claimed one
    let reads = 0;
    const slept: number[] = [];
    const readView = async () => ({ bound: true, seq: seqs[Math.min(reads++, seqs.length - 1)] });
    const receipt = await confirmRecoverySlotWrites({ readView, writes: [{ address: slot, seq: 4 }], sleep: async (ms: number) => { slept.push(ms); } });
    expect(receipt.landed).toBe(true);
    expect(receipt.pending).toEqual([]);
    expect(reads, 'stopped reading once the seq showed').toBe(3);
    expect(slept, 'one rung of the ladder per read').toEqual([...RECOVERY_CONFIRM_DELAYS_MS.slice(0, 3)]);
    // a seq PAST the claimed one is a landed write only when the caller cannot name its content...
    expect(await confirmRecoverySlotWrite({ readView: async () => ({ bound: true, seq: 9n }), address: slot, seq: 4, sleep: async () => {} })).toBe(true);
    // ...WITH the content named, the slot must hold THIS blob [round 3]: a sibling's write that took the seq is not ours
    const h1 = 0xabcn;
    expect(await confirmRecoverySlotWrite({ readView: async () => ({ bound: true, seq: 4n, h1 }), address: slot, seq: 4, h1, sleep: async () => {} }), 'seq and h1 shown').toBe(true);
    expect(await confirmRecoverySlotWrite({ readView: async () => ({ bound: true, seq: 4n, h1: 0xdefn }), address: slot, seq: 4, h1, delaysMs: [1, 1], sleep: async () => {} }), 'the seq is there, the content is not ours').toBe(false);
    expect(await confirmRecoverySlotWrite({ readView: async () => ({ bound: true, seq: 9n, h1: 0xdefn }), address: slot, seq: 4, h1, delaysMs: [1, 1], sleep: async () => {} }), 'a later write of another content does not vouch for this one').toBe(false);
  });

  it('RL-RECEIPT-02: a slot that never shows the seq, an unbound slot and a read that throws all leave the write pending', async () => {
    let reads = 0;
    const never = await confirmRecoverySlotWrites({ readView: async () => { reads++; return { bound: true, seq: 3n }; }, writes: [{ address: slot, seq: 4 }], sleep: async () => {} });
    expect(never.landed).toBe(false);
    expect(never.pending).toEqual([{ address: slot, seq: 4n }]);
    expect(reads, 'every rung of the ladder was used').toBe(RECOVERY_CONFIRM_DELAYS_MS.length);
    expect(await confirmRecoverySlotWrite({ readView: async () => null, address: slot, seq: 1, sleep: async () => {} }), 'unbound').toBe(false);
    let throws = 0;
    const thrown = await confirmRecoverySlotWrite({ readView: async () => { throws++; throw new Error('429'); }, address: slot, seq: 1, delaysMs: [1, 1, 1], sleep: async () => {} });
    expect(thrown).toBe(false);
    expect(throws, 'a read that throws is asked again on the next rung').toBe(3);
    // several writes: the ones that landed leave the ladder, the one that did not is named
    const other = '0:' + 'bb'.repeat(32);
    const two = await confirmRecoverySlotWrites({
      readView: async (address: string) => (address === slot ? { bound: true, seq: 7n } : { bound: true, seq: 1n }),
      writes: [{ address: slot, seq: 7 }, { address: other, seq: 2 }], delaysMs: [1, 1], sleep: async () => {},
    });
    expect(two.landed).toBe(false);
    expect(two.pending).toEqual([{ address: other, seq: 2n }]);
  });
});
