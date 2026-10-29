import { describe, expect, it } from 'vitest';
import { restoreConvKeysFromRecovery, staleRecoverySlots, restoreGroupsEntries, groupsChunkSlot } from '../web/recovery-lane.mjs';
import { GROUPS_NAMED_SLOT_COUNT } from '../web/shard-discovery.mjs';
import { restoreNotes, prepareNotesBackup, notesChunkSlot, serializeNotes } from '../web/notes-lane.mjs';
import { selfRecoveryShardSpace } from '../web/conv-discovery.mjs';
import { sealRecoveryBlob, sealNotesBlob } from '../web/recovery-blob.mjs';
import { isActiveAccountState, probeActiveAddresses } from '../web/shard-reader.mjs';
import { addrKey, NOTES_NAMED_SLOT_COUNT } from '../web/shard-discovery.mjs';
import { createMemoryConvKeyStore } from '../web/conv-key-store.mjs';


const A = new Uint8Array(32).fill(0x11);
const B = new Uint8Array(32).fill(0x22);
const SEED = new Uint8Array(32).fill(0x9c);
const VALUE = 50_000_000n;
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

let spacePromise: Promise<any> | null = null;
const space = () => (spacePromise ??= selfRecoveryShardSpace(SEED));

async function sampleMap() {
  const store = createMemoryConvKeyStore();
  await store.upsertConversationKRoot(A, B, {
    kRoot: new Uint8Array(32).fill(0x5a), createdAt: 100, introNonce: new Uint8Array(16).fill(1), peerWallet: 'w-A',
  });
  return { map: store.snapshot(), convId: [...store.snapshot().keys()][0] };
}

const statesReader = (live: string[], extra: Array<{ address: string; status: string }> = []) =>
  async (addresses: string[]) => {
    const out = new Map<string, any>();
    for (const address of addresses) {
      if (live.includes(address)) out.set(addrKey(address), { status: 'active', balance: 1n, lastLt: '9' });
    }
    for (const row of extra) out.set(addrKey(row.address), { status: row.status, balance: 1n, lastLt: '9' });
    return out;
  };

describe('SELF-LANE BATCH PROBE', () => {
  it('BATCH-01: the recovery restore reads only the slots that exist, and gets the same map as the full probe', async () => {
    const { map, convId } = await sampleMap();
    const { slots } = await space();
    const { body: mine } = await sealRecoveryBlob(SEED, map);

    const views = new Map<string, any>([[slots[4].address, { bound: true, seq: 7n }]]);
    const probed: string[] = [];
    const readView = async (addr: string) => { probed.push(addr); return views.get(addr) ?? { bound: false }; };
    const readBody = async (addr: string) => (addr === slots[4].address ? mine : null);

    const batched = await restoreConvKeysFromRecovery({
      seed: SEED, readView, readBody, readStates: statesReader([slots[4].address]),
    });

    expect(probed, 'ONE get_view — the other 255 slots were answered by the single batched read').toEqual([slots[4].address]);
    expect(hex(batched.map.get(convId)!.kRootCurrent)).toBe(hex(new Uint8Array(32).fill(0x5a)));
    expect(batched.found).toEqual([{ slotIndex: 4, seq: 7, count: 1 }]);
    expect(batched.clean, 'slots with no account are a CLEAN absence, exactly as get_view would report').toBe(true);

    probed.length = 0;
    const full = await restoreConvKeysFromRecovery({ seed: SEED, readView, readBody });
    expect(probed.length, 'without the batch it really is one call per slot').toBe(slots.length);
    expect(full.found).toEqual(batched.found);
    expect([...full.map.keys()]).toEqual([...batched.map.keys()]);
  });

  it('BATCH-02: a batch that cannot be trusted falls back to probing every slot — never to an empty restore', async () => {
    const { map, convId } = await sampleMap();
    const { slots } = await space();
    const { body: mine } = await sealRecoveryBlob(SEED, map);
    const readView = async (addr: string) => (addr === slots[4].address ? { bound: true, seq: 7n } : { bound: false });
    const readBody = async (addr: string) => (addr === slots[4].address ? mine : null);

    for (const [label, readStates] of [
      ['a throwing batch', async () => { throw new Error('rate limited'); }],
      ['a non-Map answer', async () => ({ accounts: [] } as any)],
    ] as const) {
      const restored = await restoreConvKeysFromRecovery({ seed: SEED, readView, readBody, readStates });
      expect(restored.map.get(convId), `${label}: the backup is still found`).toBeTruthy();
      expect(restored.found, `${label}: and the slot is still reported`).toEqual([{ slotIndex: 4, seq: 7, count: 1 }]);
    }
  });

  it('BATCH-03: a touched-but-uninit slot is not "live" — a stranger cannot buy a get_view, or hide a slot', async () => {
    expect(isActiveAccountState({ status: 'active' })).toBe(true);
    expect(isActiveAccountState({ status: 'uninit' })).toBe(false);
    expect(isActiveAccountState({ status: 'frozen' }), 'frozen has no code either').toBe(false);
    expect(isActiveAccountState(undefined)).toBe(false);

    const { slots } = await space();
    const probed: string[] = [];
    const readView = async (addr: string) => { probed.push(addr); return { bound: false }; };
    await restoreConvKeysFromRecovery({
      seed: SEED, readView, readBody: async () => null,
      readStates: statesReader([], [{ address: slots[9].address, status: 'uninit' }]),
    });
    expect(probed, 'the touched-but-uninit slot is skipped like any other empty one').toEqual([]);
  });

  it('BATCH-04: probeActiveAddresses reports null for every untrustworthy answer, and a Set otherwise', async () => {
    expect(await probeActiveAddresses(['0:' + '11'.repeat(32)], null)).toBeNull();
    expect(await probeActiveAddresses(['0:' + '11'.repeat(32)], async () => { throw new Error('nope'); })).toBeNull();
    expect(await probeActiveAddresses(['0:' + '11'.repeat(32)], async () => undefined as any)).toBeNull();
    expect(await probeActiveAddresses([], async () => new Map())).toEqual(new Set());
    const live = '0:' + '11'.repeat(32);
    const unknown = '0:' + '12'.repeat(32);
    const mixed = new Map([
      [addrKey(live), { status: 'active', lastLt: '5' }],
      [addrKey(unknown), { status: 'unknown', lastLt: null, dataHash: null, unanswered: true, refused: false }],
    ]);
    expect(await probeActiveAddresses([live, unknown], async () => mixed), 'an unanswered row is read, not skipped').toEqual(new Set([addrKey(live), addrKey(unknown)]));
    const refused = new Map([[addrKey(unknown), { status: 'unknown', lastLt: null, dataHash: null, refused: true }]]);
    expect(await probeActiveAddresses([unknown], async () => refused), 'a refused row too').toEqual(new Set([addrKey(unknown)]));
    expect(await probeActiveAddresses([live], async () => new Map([[addrKey(live), { status: 'active', lastLt: '5' }]]))).toEqual(new Set([addrKey(live)]));
  });

  it('BATCH-05: the notes restore skips absent chunks and stays clean; a bound chunk still opens', async () => {
    const notes = [{ at: 1, text: 'первая' }, { at: 2, text: 'вторая' }];
    const slot0 = await notesChunkSlot(SEED, 0);
    const { body } = await sealNotesBlob(SEED, serializeNotes(notes), 0);
    const probed: string[] = [];
    const readView = async (addr: string) => {
      probed.push(addr);
      return addr === slot0.address ? { bound: true, seq: 1n } : { bound: false };
    };
    const readBody = async (addr: string) => (addr === slot0.address ? body : null);

    const restored = await restoreNotes({ seed: SEED, readView, readBody, readStates: statesReader([slot0.address]) });
    expect(probed, 'only the chunk that exists is read').toEqual([slot0.address]);
    expect(restored.notes.map((n: any) => n.text)).toEqual(['первая', 'вторая']);
    expect(restored.clean, 'absent chunks are a clean empty, not a failed read').toBe(true);
  });

  it('BATCH-06: a notes chunk that will be WRITTEN is always read for real, whatever the batch says', async () => {
    const probed: string[] = [];
    const readView = async (addr: string) => { probed.push(addr); return { bound: true, seq: 4n }; };
    const slot0 = await notesChunkSlot(SEED, 0);

    const built = await prepareNotesBackup({
      seed: SEED, notes: [{ at: 1, text: 'сохранить' }], readView, value: VALUE, readStates: statesReader([]),
    });

    expect(probed, 'the chunk being written was read despite the batch calling it absent').toEqual([slot0.address]);
    expect(built.publishes.length).toBe(1);
    expect(built.publishes[0].seq, 'and its real on-chain seq was honoured, not assumed to be 0').toBe(5);
    expect(probed.length, 'the seven empty chunks cost no get_view at all').toBeLessThan(NOTES_NAMED_SLOT_COUNT);
  });

  it('BATCH-07: the freeze sweep batches only the slots the local map occupies', async () => {
    const { slots } = await space();
    const probed: string[] = [];
    const readView = async (addr: string) => {
      probed.push(addr);
      return { bound: true, updated_at: 0n };
    };
    const asked: string[][] = [];
    const readStates = async (addresses: string[]) => {
      asked.push(addresses);
      return new Map([[addrKey(slots[3].address), { status: 'active' }]]);
    };

    const stale = await staleRecoverySlots({
      seed: SEED, readView, localSlotIndices: new Set([3, 5]), nowS: 10_000_000, refreshAfterS: 1, readStates,
    });

    expect(asked[0], 'it asks about the two local slots, not all 256').toHaveLength(2);
    expect(probed, 'and only the one with a live account costs a get_view').toEqual([slots[3].address]);
    expect(stale).toEqual([3]);
  });

  it('BATCH-08: the groups restore reads only the live chunks; an untrusted batch probes all four, as before', async () => {
    const slots = [];
    for (let index = 0; index < GROUPS_NAMED_SLOT_COUNT; index += 1) slots.push(await groupsChunkSlot(SEED, index));
    const probed: string[] = [];
    const readView = async (addr: string) => { probed.push(addr); return { bound: false }; };
    const readBody = async () => null;

    const narrowed = await restoreGroupsEntries({ seed: SEED, readView, readBody, readStates: statesReader([slots[1].address]) });
    expect(probed, 'one live chunk, one get_view').toEqual([slots[1].address]);
    expect(narrowed).toEqual({ entries: [], clean: true });

    probed.length = 0;
    const none = await restoreGroupsEntries({ seed: SEED, readView, readBody, readStates: statesReader([]) });
    expect(probed, 'no live chunk: nothing is read, and that is a CLEAN empty').toEqual([]);
    expect(none).toEqual({ entries: [], clean: true });

    for (const [label, readStates] of [
      ['no reader', null],
      ['a reader that throws', async () => { throw new Error('rate limited'); }],
    ] as Array<[string, any]>) {
      probed.length = 0;
      const full = await restoreGroupsEntries({ seed: SEED, readView, readBody, readStates });
      expect(probed, label).toEqual(slots.map((slot) => slot.address));
      expect(full.clean, label).toBe(true);
    }
    probed.length = 0;
    const oneUnknown = await restoreGroupsEntries({ seed: SEED, readView, readBody, readStates: statesReader([], [{ address: slots[2].address, status: 'unknown' }]) });
    expect(probed).toEqual([slots[2].address]);
    expect(oneUnknown.clean).toBe(true);
  });

  it('BATCH-09: a caller holding markers reads only the slots it names, and the answer speaks for those', async () => {
    const { slots } = await space();
    const { map: first } = await sampleMap();
    const C = new Uint8Array(32).fill(0x33);
    const second = createMemoryConvKeyStore();
    await second.upsertConversationKRoot(A, C, {
      kRoot: new Uint8Array(32).fill(0x6b), createdAt: 200, introNonce: new Uint8Array(16).fill(2), peerWallet: 'w-B',
    });
    const bodies = new Map<string, any>([
      [slots[4].address, (await sealRecoveryBlob(SEED, first)).body],
      [slots[9].address, (await sealRecoveryBlob(SEED, second.snapshot())).body],
    ]);
    const viewed: string[] = [];
    const readView = async (addr: string) => { viewed.push(addr); return bodies.has(addr) ? { bound: true, seq: 1n } : { bound: false }; };
    const readBody = async (addr: string) => bodies.get(addr) ?? null;
    const readStates = statesReader([slots[4].address, slots[9].address]);

    const narrowed = await restoreConvKeysFromRecovery({ seed: SEED, readView, readBody, readStates, onlySlots: new Set([addrKey(slots[9].address)]) });
    expect(viewed, 'slot 4 is live but was not asked for').toEqual([slots[9].address]);
    expect(narrowed.clean).toBe(true);
    expect(narrowed.found.map((f: any) => f.slotIndex)).toEqual([9]);
    expect([...narrowed.map.keys()], 'only the second conversation').toEqual([...second.snapshot().keys()]);

    viewed.length = 0;
    const whole = await restoreConvKeysFromRecovery({ seed: SEED, readView, readBody, readStates });
    expect(viewed, 'without onlySlots every live slot is read').toEqual([slots[4].address, slots[9].address]);
    expect(whole.map.size).toBe(2);
  });
});
