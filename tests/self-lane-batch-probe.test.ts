import { describe, expect, it } from 'vitest';
import { restoreConvKeysFromRecovery, staleRecoverySlots } from '../web/recovery-lane.mjs';
import { restoreNotes, prepareNotesBackup, notesChunkSlot, serializeNotes } from '../web/notes-lane.mjs';
import { selfRecoveryShardSpace } from '../web/conv-discovery.mjs';
import { sealRecoveryBlob, sealNotesBlob } from '../web/recovery-blob.mjs';
import { isActiveAccountState, probeActiveAddresses } from '../web/shard-reader.mjs';
import { addrKey, NOTES_NAMED_SLOT_COUNT } from '../web/shard-discovery.mjs';
import { createMemoryConvKeyStore } from '../web/conv-key-store.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// SELF-LANE BATCH PROBE — one accountStates call instead of a per-slot scan, and the safety contract that makes
// that legal.
//
// The self lanes address their slots by construction from the seed, so discovery means ASKING ABOUT ALL OF THEM:
// 256 recovery slots, 8 notes chunks. Get-methods do not batch (an array of addresses is a 422), so a fresh-device
// restore was 256 sequential calls, almost all of them about slots the user never bound. accountStates does batch —
// the whole space fits ONE request, since the wall is URL length, not address count.
//
// THE RISK THIS PAYS FOR, AND WHY THESE TESTS EXIST. The prefilter works by treating "no account" as proof that a
// slot was never written, and then NOT reading it. Get that wrong and a restore reports a clean, empty result;
// the next backup then overwrites the on-chain blob with a partial map, and the user's conversations are gone with
// no error anywhere. So the batch may only ever narrow a KNOWN-COMPLETE answer: every untrustworthy outcome falls
// back to probing every slot the slow way. These tests pin that the shortcut changes the COST and never the ANSWER.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const A = new Uint8Array(32).fill(0x11);
const B = new Uint8Array(32).fill(0x22);
const SEED = new Uint8Array(32).fill(0x9c);
const VALUE = 50_000_000n;
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

// Deriving 256 per-slot keypairs is the expensive part of every case here — derive once, share.
let spacePromise: Promise<any> | null = null;
const space = () => (spacePromise ??= selfRecoveryShardSpace(SEED));

async function sampleMap() {
  const store = createMemoryConvKeyStore();
  await store.upsertConversationKRoot(A, B, {
    kRoot: new Uint8Array(32).fill(0x5a), createdAt: 100, introNonce: new Uint8Array(16).fill(1), peerWallet: 'w-A',
  });
  return { map: store.snapshot(), convId: [...store.snapshot().keys()][0] };
}

/** A batched reader that reports exactly `live` as active — the shape web/shard-reader.readAccountStates returns. */
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

    // The answer must be identical to the 256-call path it replaces — that equality is the whole licence to skip.
    probed.length = 0;
    const full = await restoreConvKeysFromRecovery({ seed: SEED, readView, readBody });
    expect(probed.length, 'without the batch it really is one call per slot').toBe(slots.length);
    expect(full.found).toEqual(batched.found);
    expect([...full.map.keys()]).toEqual([...batched.map.keys()]);
  });

  it('BATCH-02: a batch that cannot be trusted falls back to probing every slot — never to an empty restore', async () => {
    // THE FAILURE THAT MATTERS. A restore that mistook a failed batch for "nothing is backed up" would latch a
    // clean-empty result, and the next backup would overwrite the on-chain blob with a partial map. So every
    // untrustworthy outcome — a throw, or a reader that answers with something other than a Map — must degrade to
    // the slow path, which still finds the conversation.
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
    // Slot addresses are derivable by anyone who knows the owner key, and anyone at all can send a coin to one.
    // That leaves a row in the response with status 'uninit', which a bare presence check would read as "exists".
    // A get-method against it aborts (-13) anyway, so the only thing a presence check buys is wasted requests.
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
    // The single place the safety contract lives, pinned directly: null means "I learned nothing, probe everything".
    expect(await probeActiveAddresses(['0:' + '11'.repeat(32)], null)).toBeNull();
    expect(await probeActiveAddresses(['0:' + '11'.repeat(32)], async () => { throw new Error('nope'); })).toBeNull();
    expect(await probeActiveAddresses(['0:' + '11'.repeat(32)], async () => undefined as any)).toBeNull();
    // No addresses is not an untrustworthy answer — it is nothing to ask about.
    expect(await probeActiveAddresses([], async () => new Map())).toEqual(new Set());
    // AN UNKNOWN ROW IS AN INCOMPLETE ANSWER. readAccountStates records an address the endpoint did not answer (its
    // deadline) or refused as status 'unknown' instead of throwing — and a restore that read that as "not active"
    // would skip a bound slot and latch as clean: a conversation silently missing. One unknown row → null → the
    // slow, complete probe. [2026-08-22: the deadline-at-the-floor path made this reachable on the stand.]
    const live = '0:' + '11'.repeat(32);
    const unknown = '0:' + '12'.repeat(32);
    const mixed = new Map([
      [addrKey(live), { status: 'active', lastLt: '5' }],
      [addrKey(unknown), { status: 'unknown', lastLt: null, dataHash: null, unanswered: true, refused: false }],
    ]);
    expect(await probeActiveAddresses([live, unknown], async () => mixed), 'one unanswered row poisons completeness').toBeNull();
    const refused = new Map([[addrKey(unknown), { status: 'unknown', lastLt: null, dataHash: null, refused: true }]]);
    expect(await probeActiveAddresses([unknown], async () => refused), 'a refused row too').toBeNull();
    // And a complete answer with only real rows is still a Set.
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
    // The prefilter may skip a READ, never a WRITE. A chunk's stored seq is the anti-rollback floor: publishing at
    // seq 1 into a slot that turned out to be bound BOUNCES, and the caller fires and forgets — so it would land as
    // a recorded success with the notes silently dropped. Here the batch claims nothing is live (a stale or wrong
    // answer) while chunk 0 has notes to store: the get_view for chunk 0 must still happen.
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
});
