import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { restoreConvKeysFromRecovery, prepareRecoveryBackup, staleRecoverySlots, recoverySlotForConversation, partitionRecoveryMap, preparePrefsBackup, restorePrefsChunks, confirmRecoverySlotWrite, confirmRecoverySlotWrites, RECOVERY_CONFIRM_DELAYS_MS } from '../web/recovery-lane.mjs';
import { selfRecoveryShardSpace, selfRecoveryShard } from '../web/conv-discovery.mjs';
import { sealRecoveryBlob, sealPrefsBlob } from '../web/recovery-blob.mjs';
import { PREFS_NAMED_SLOT_INDEX, PREFS_OVERFLOW_SLOT_BASE, PREFS_CHUNK_COUNT, addrKey } from '../web/shard-discovery.mjs';
import { createMemoryConvKeyStore } from '../web/conv-key-store.mjs';
import { tonCell } from '../web/pwa-contract-transactions.mjs';


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
    const { body: foreign } = await sealRecoveryBlob(OTHER_SEED, map);

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
    const refreshAfterS = 47_304_000;
    const views = new Map<string, any>([
      [slots[1].address, { bound: true, seq: 2n, updated_at: BigInt(nowS - 63_072_000) }],
      [slots[3].address, { bound: true, seq: 5n, updated_at: BigInt(nowS - 86_400) }],
      [slots[5].address, { bound: true, seq: 1n, updated_at: BigInt(nowS - 63_072_000) }],
      [slots[9].address, { bound: false }],
    ]);
    const readView = async (addr: string) => {
      if (addr === slots[7].address) throw new Error('429');
      return views.get(addr) ?? { bound: false };
    };
    const localSlotIndices = new Set([1, 3, 7, 9]);
    const stale = await staleRecoverySlots({ seed: SEED, readView, localSlotIndices, nowS, refreshAfterS });
    expect(stale, 'only the bound, locally-present, idle-past-horizon slot is refreshed').toEqual([1]);
  });

  it('RL-04: a transient read failure marks the restore UNCLEAN (caller must not treat it as authoritative)', async () => {
    const { map } = await sampleMap();
    const { slots } = await selfRecoveryShardSpace(SEED);
    const { body: mine } = await sealRecoveryBlob(SEED, map);
    const readView = async (addr: string) => { if (addr === slots[4].address) throw new Error('429'); return { bound: false }; };
    const readBody = async (addr: string) => (addr === slots[4].address ? mine : null);
    const { clean, found } = await restoreConvKeysFromRecovery({ seed: SEED, readView, readBody });
    expect(clean, 'a thrown read makes the whole scan unclean').toBe(false);
    expect(found.some((f) => f.slotIndex === 4), 'the failed slot yielded nothing').toBe(false);
  });

  it('RL-05: prepareRecoveryBackup REFUSES a blob that would overflow the on-chain cap (loud, not a silent bounce)', async () => {
    const big = createMemoryConvKeyStore();
    for (let i = 0; i < 40; i += 1) {
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

  it('RL-08: prefs chunks build at seq+1 on their NAMED slots — chunk 0 the original, the rest the overflow block — and restore reads those slots only', async () => {
    const prefs = new TextEncoder().encode(JSON.stringify({ channels: ['0:cc'], at: 1790000000 }));
    const more = Uint8Array.of(2, 0, 0, 0, 1, 1, 2, 1, 0, 0);
    const prefsSlot = await selfRecoveryShard(SEED, PREFS_NAMED_SLOT_INDEX);
    const overflowSlot = await selfRecoveryShard(SEED, PREFS_OVERFLOW_SLOT_BASE);
    const otherSlot = (await selfRecoveryShardSpace(SEED)).slots[7];

    const readViewSeq2 = async (addr: string) => (addr === prefsSlot.address ? { bound: true, seq: 2n } : { bound: false });
    const backup = await preparePrefsBackup({ seed: SEED, prefsBytes: prefs, readView: readViewSeq2, value: VALUE });
    expect(backup.seq, 'a bound prefs slot at seq 2 gets the next write at seq 3').toBe(3);
    expect(backup.to, 'the built message targets the NAMED prefs slot, not a conversation slot').toBe(otherSlot.address === backup.to ? 'MISMATCH' : backup.to);
    expect(backup.slotIndex).toBe(PREFS_NAMED_SLOT_INDEX);
    expect(backup.chunkIndex).toBe(0);
    const second = await preparePrefsBackup({ seed: SEED, prefsBytes: more, chunkIndex: 1, readView: readViewSeq2, value: VALUE });
    expect(second.slotIndex, 'chunk 1 lands on the first slot of the overflow block').toBe(PREFS_OVERFLOW_SLOT_BASE);
    expect(addrKey(second.to)).toBe(addrKey(overflowSlot.address));
    expect(second.seq, 'each chunk has its own slot and its own seq').toBe(1);
    await expect(preparePrefsBackup({ seed: SEED, prefsBytes: more, chunkIndex: PREFS_CHUNK_COUNT, readView: readViewSeq2, value: VALUE }), 'there is no fifth prefs slot')
      .rejects.toThrow(RangeError);

    const bodies = new Map([[prefsSlot.address, (await sealPrefsBlob(SEED, prefs, 0)).body], [overflowSlot.address, (await sealPrefsBlob(SEED, more, 1)).body]]);
    const asked: string[] = [];
    const readView = async (addr: string) => { asked.push(addr); return (bodies.has(addr) ? { bound: true, seq: 3n } : { bound: false }); };
    const readBody = async (addr: string) => bodies.get(addr) ?? null;
    const restored = await restorePrefsChunks({ seed: SEED, readView, readBody });
    expect(restored.clean).toBe(true);
    expect(restored.chunks.map((chunk: any) => chunk.chunkIndex)).toEqual([0, 1]);
    expect(restored.chunks[0].bytes, 'the exact bytes come back from each slot').toEqual(prefs);
    expect(restored.chunks[1].bytes).toEqual(more);
    expect(asked, 'the four prefs slots and nothing else').toHaveLength(PREFS_CHUNK_COUNT);
    expect(asked).not.toContain(otherSlot.address);

    const empty = await restorePrefsChunks({ seed: SEED, readView: async () => ({ bound: false }), readBody: async () => null });
    expect(empty).toEqual({ chunks: [], clean: true });
  });
  it('RL-UNREADABLE-01: a bound slot this build cannot open makes the restore UNCLEAN, so backups stay locked', async () => {
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

describe('recovery slot receipt', () => {
  const slot = '0:' + 'aa'.repeat(32);
  it('RL-RECEIPT-01: the write is confirmed the moment a slot shows the claimed seq, and not before', async () => {
    const seqs = [3n, 3n, 4n];
    let reads = 0;
    const slept: number[] = [];
    const readView = async () => ({ bound: true, seq: seqs[Math.min(reads++, seqs.length - 1)] });
    const receipt = await confirmRecoverySlotWrites({ readView, writes: [{ address: slot, seq: 4 }], sleep: async (ms: number) => { slept.push(ms); } });
    expect(receipt.landed).toBe(true);
    expect(receipt.pending).toEqual([]);
    expect(reads, 'stopped reading once the seq showed').toBe(3);
    expect(slept, 'one rung of the ladder per read').toEqual([...RECOVERY_CONFIRM_DELAYS_MS.slice(0, 3)]);
    expect(await confirmRecoverySlotWrite({ readView: async () => ({ bound: true, seq: 9n }), address: slot, seq: 4, sleep: async () => {} })).toBe(true);
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
    const other = '0:' + 'bb'.repeat(32);
    const two = await confirmRecoverySlotWrites({
      readView: async (address: string) => (address === slot ? { bound: true, seq: 7n } : { bound: true, seq: 1n }),
      writes: [{ address: slot, seq: 7 }, { address: other, seq: 2 }], delaysMs: [1, 1], sleep: async () => {},
    });
    expect(two.landed).toBe(false);
    expect(two.pending).toEqual([{ address: other, seq: 2n }]);
  });

  it('RECO-ARREAR-01: both recovery writes pay the slot\'s standing arrear in a message of its own', () => {
    const app = readFileSync('web/app.js', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .split('\n').map((line) => line.replace(/\/\/.*$/, '')).join('\n');

    expect(app, 'the lane the debt is read on must exist and be imported').toContain('LANE_RECOVERY');
    for (const which of ['backup']) {
      expect(app, `${which}: the arrear is read for the RECOVERY lane`)
        .toContain(`const ${which}Arrear = await shardArrearOf(built.to, LANE_RECOVERY);`);
      expect(app, `${which}: and paid as a BARE, non-bouncing message — a body would hit a receiver that reserves`)
        .toContain(`${which}Messages.push({ address: built.to, amount: ${which}Arrear, payload: null, stateInit: null, bounce: false });`);
      expect(app, `${which}: the write still follows, and in the same transaction`)
        .toContain(`await sendPlathoWalletTransaction(wallet, { messages: ${which}Messages }, { transport });`);
      const arrearAt = app.indexOf(`${which}Messages.push({ address: built.to, amount: ${which}Arrear`);
      const writeAt = app.indexOf(`${which}Messages.push({ address: built.to, amount: built.value`);
      expect(arrearAt, `${which}: the top-up is queued BEFORE the write`).toBeGreaterThan(0);
      expect(writeAt, `${which}: the write is queued after it`).toBeGreaterThan(arrearAt);
    }
    expect(app).toContain('for (const write of built) prefsArrears.push(await shardArrearOf(write.to, LANE_RECOVERY));');
    const prefsArrearAt = app.indexOf('if (prefsArrears[index] > 0n) prefsMessages.push({ address: write.to, amount: prefsArrears[index], payload: null, stateInit: null, bounce: false });');
    const prefsWriteAt = app.indexOf('prefsMessages.push({ address: write.to, amount: write.value, payload: tonCell.bytesToBase64(tonCell.serializeBoc(write.body)), stateInit: write.init, bounce: true });');
    expect(prefsArrearAt, 'prefs: the top-ups are queued').toBeGreaterThan(0);
    expect(prefsWriteAt, 'prefs: the writes after them').toBeGreaterThan(prefsArrearAt);
    expect(app).toContain('await sendPlathoWalletTransaction(wallet, { messages: prefsMessages }, { transport });');
  });

  it('RECO-EVICT-01: no shipped code builds or sends EvictRecovery — the door that returns nothing', () => {
    const FORBIDDEN = [/EvictRecovery/, /0x52435632/i, /RCV2/];
    const files = ['web/recovery-lane.mjs', 'web/recovery-transport.mjs', 'web/recovery-publish-browser.mjs',
      'web/recovery-blob.mjs', 'web/app.js', 'web/pwa-contract-transactions.mjs', 'web/shard-discovery.mjs'];
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .split('\n').map((line) => line.replace(/\/\/.*$/, '')).join('\n');
      for (const pattern of FORBIDDEN) {
        expect(source, `${file} must not reach for the eviction door: it returns nothing and burns the caller\'s attach`)
          .not.toMatch(pattern);
      }
    }
  });
});
