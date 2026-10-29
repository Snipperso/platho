import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createConvKeyStore } from '../web/conv-key-store.mjs';
import { partitionRecoveryMap, recoverySlotForConversation } from '../web/recovery-lane.mjs';
import { selfRecoveryShardSpace } from '../web/conv-discovery.mjs';


const app = readFileSync('web/app.js', 'utf8');
const fn = (declaration: string) => {
  const at = app.indexOf(declaration);
  if (at < 0) throw new Error(`${declaration} not found`);
  if (app.indexOf(declaration, at + 1) >= 0) throw new Error(`${declaration} is not unique`);
  return app.slice(at, app.indexOf('\n}', at) + 2);
};
const line = (prefix: string) => {
  const match = app.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^;]*;`, 'm'));
  if (!match) throw new Error(`${prefix} not found`);
  return match[0];
};
function appFunctions(env: Record<string, any>, sources: string[], exported: string) {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, `${sources.join('\n')}\nreturn ${exported};`)(...names.map((n) => env[n]));
}
const WALLET = `0:${'0d'.repeat(32)}`;
const SEED = new Uint8Array(32).fill(0x9c);
const root = (fill: number) => new Uint8Array(32).fill(fill);
const record = (fill: number, at: number) => ({ kRootCurrent: root(fill), kRootsForRead: [], peerKeyId: `p${fill}`, adoptedCreatedAt: at, outgoingSeq: {}, lastScannedEpoch: null });

function idsSharingASlot() {
  const bySlot = new Map<number, string[]>();
  for (let i = 0; i < 5000; i += 1) {
    const id = `${i.toString(16).padStart(8, '0')}:${'cd'.repeat(4)}`;
    const slot = recoverySlotForConversation(id);
    const list = bySlot.get(slot) ?? [];
    list.push(id);
    bySlot.set(slot, list);
    if (list.length === 2) {
      const other = [...bySlot.entries()].find(([s]) => s !== slot)?.[1]?.[0];
      if (other) return { a: list[0], b: list[1], slot, other, otherSlot: recoverySlotForConversation(other) };
    }
  }
  throw new Error('no shared slot');
}

async function backupHarness({ chain, clean = () => true, local }: { chain: Map<number, Map<string, any>>; clean?: (slot: number) => boolean; local: Map<string, any> }) {
  const store = createConvKeyStore();
  await store.importConversations(local);
  const written: Array<{ slot: number; ids: string[] }> = [];
  const synced: number[] = [];
  const dirty = new Set<number>();
  const env: Record<string, any> = {
    convKeyStore: store, plathoWallet: { address: WALLET, seed: SEED }, walletSessionGeneration: 1,
    convRecoveryDirtySlots: dirty, convRecoveryDirtyMarks: new Map(),
    convRecoveryQuietSlots: new Map(), armRecoveryQuietTimer: () => {},
    markRecoverySlotDirty: (slot: number) => { dirty.add(slot); }, clearRecoverySlotDirty: (slot: number) => { dirty.delete(slot); },
    confirmRecoverySlotWritten: (slot: number, _entries: any, unchanged: boolean) => { if (unchanged) dirty.delete(slot); },
    convRecoveryPendingEntries: new Map(), convRecoveryRefreshSlots: new Set(), dropRecoveryEntriesConfirmedElsewhere: async () => {},
    globalThis: { plathoTonRpcTransport: { runGetMethod: async () => ({}), sendBoc: async () => ({}) } },
    console: { warn: () => {}, error: () => {} },
    createRecoveryViewReader: () => async () => ({ bound: true, seq: 1n }),
    criticalRecoveryReaders: () => ({ readView: async () => null, readBody: async () => null }),
    selfRecoveryShard: async (_seed: any, slot: number) => ({ address: `0:${Number(slot).toString(16).padStart(64, '0')}` }),
    publicAddrKey: (address: string) => String(address).toLowerCase(),
    restoreConvKeysFromRecovery: async ({ onlySlots }: any) => {
      const slot = parseInt([...onlySlots][0].slice(2), 16);
      return { map: new Map(chain.get(slot) ?? []), found: [], clean: clean(slot) };
    },
    partitionRecoveryMap,
    requireBasechainAddress: () => {},
    prepareRecoveryBackup: async ({ slotIndex, map }: any) => { written.push({ slot: slotIndex, ids: [...map.keys()].sort() }); return { to: `0:${slotIndex.toString(16).padStart(64, '0')}`, seq: 2, h1: 5n, value: 1n, body: {}, init: null }; },
    RECOVERY_PUBLISH_VALUE: 1n, shardArrearOf: async () => 0n, LANE_RECOVERY: 'recovery',
    assertWalletGramAtLeast: async () => {}, walletSendFeeReserveNanotons: () => 0n, walletSendSizeClassForPayloadBytes: () => 1,
    tonCell: { serializeBoc: () => new Uint8Array(4), bytesToBase64: () => '' },
    sendPlathoWalletTransaction: async () => ({}), broadcastMayHaveLanded: () => false, noteTonRpcRateLimit: () => false,
    confirmRecoverySlotWrites: async () => ({ landed: true, pending: [] }),
    scheduleMessageAutoSync: (ms: number) => { synced.push(ms); }, renderThreads: () => {},
    noteChatKeysBackupShortfall: () => {}, clearChatKeysBackupShortfall: () => {},
    convRecoveryBackupAllowed: false,
  };
  const run = appFunctions(env, [fn('function recoveryPartitionHeld('), fn('async function runRecoveryBackupLocked() {')], 'runRecoveryBackupLocked');
  return { run, store, written, dirty, synced };
}

describe('R7 — the conversation keys: a slot is read before it is written', () => {
  it('RR-01: a conversation another device put in the slot is written back with this device\'s — and imported here', async () => {
    const { a, b, slot } = idsSharingASlot();
    const { run, store, written, dirty, synced } = await backupHarness({ chain: new Map([[slot, new Map([[b, record(0xb0, 20)]])]]), local: new Map([[a, record(0xa0, 10)]]) });
    dirty.add(slot);
    await run();
    expect(written, 'one write, carrying both').toEqual([{ slot, ids: [a, b].sort() }]);
    expect(store.snapshot().has(b), 'and this device now holds the other one').toBe(true);
    expect([...dirty], 'confirmed and cleared').toEqual([]);
    expect(synced, 'the imported conversation is walked from its birth, as a restore does').toEqual([2_000]);
  });

  it('RR-02: a slot whose blob will not read is not written — it stays dirty — and the other slots are not held back by it', async () => {
    const { a, slot, other, otherSlot } = idsSharingASlot();
    const { run, written, dirty } = await backupHarness({
      chain: new Map(), clean: (s) => s !== slot,
      local: new Map([[a, record(0xa0, 10)], [other, record(0xc0, 10)]]),
    });
    dirty.add(slot);
    dirty.add(otherSlot);
    await run();
    expect(written.map((w) => w.slot), 'the readable slot is written, the gate over all of them is gone').toEqual([otherSlot]);
    expect([...dirty], 'the unreadable one waits').toEqual([slot]);
    expect(fn('function rearmRecoveryBackupIfDirty() {')).not.toContain('convRecoveryBackupAllowed');
    expect(fn('async function runRecoveryFreezeSweep() {')).not.toContain('if (!convRecoveryBackupAllowed) return;');
  });

  it('RR-03: the same second decides the same root on every device, whichever it held first', async () => {
    const id = `00000001:${'ef'.repeat(4)}`;
    const deviceA = createConvKeyStore();
    await deviceA.importConversations(new Map([[id, record(0x11, 50)]]));
    await deviceA.importConversations(new Map([[id, record(0x22, 50)]]));
    const deviceB = createConvKeyStore();
    await deviceB.importConversations(new Map([[id, record(0x22, 50)]]));
    await deviceB.importConversations(new Map([[id, record(0x11, 50)]]));
    expect(Buffer.from(deviceA.snapshot().get(id).kRootCurrent).toString('hex')).toBe(Buffer.from(deviceB.snapshot().get(id).kRootCurrent).toString('hex'));
    expect(deviceA.snapshot().get(id).kRootCurrent[0]).toBe(0x22);
    await deviceA.importConversations(new Map([[id, record(0x05, 51)]]));
    expect(deviceA.snapshot().get(id).kRootCurrent[0]).toBe(0x05);
    await deviceA.importConversations(new Map([[id, record(0x99, 40)]]));
    expect(deviceA.snapshot().get(id).kRootCurrent[0]).toBe(0x05);
  });

  it('RR-04: the 256 slots are derived once per seed — and again for another seed', async () => {
    const seed = new Uint8Array(32).fill(0x31);
    const first = await selfRecoveryShardSpace(seed);
    const second = await selfRecoveryShardSpace(seed);
    expect(second, 'the same derivation, not a second one').toBe(first);
    expect(first.slots).toHaveLength(256);
    const other = await selfRecoveryShardSpace(new Uint8Array(32).fill(0x32));
    expect(other).not.toBe(first);
    expect(other.slots[0].address).not.toBe(first.slots[0].address);
  });
});

describe('R7 — the notepad and the groups blob: read before write', () => {
  it('RR-05: a note is saved only after the chunks that moved were read and merged — and not at all if they could not be', async () => {
    const order: string[] = [];
    let incomplete = false;
    const env: Record<string, any> = {
      plathoWallet: { address: WALLET, seed: SEED }, globalThis: { plathoTonRpcTransport: { runGetMethod: async () => ({}) } }, t: (k: string) => k,
      readSelfSlotLedger: async (options: any) => { order.push(`ledger:${options?.only}:${options?.force}`); return { trusted: true }; },
      restoreSelfNotesFromRecovery: async () => { order.push('restore'); selfNotesRestoreIncompleteBox.value = incomplete; },
      publishSelfNotesSnapshotForThread: async () => { order.push('publish'); return { writes: [], wrote: 0 }; },
      markDirectSendBroadcast: () => {}, markSelfNotePublished: () => {}, armSelfNoteReceipt: () => {},
      sameWalletAddress: (a: any, b: any) => a === b, walletChangedBeforeSigningError: () => new Error('changed'),
    };
    const selfNotesRestoreIncompleteBox = { value: false };
    const source = fn('async function publishSelfNoteSnapshot(context) {').replace(/\bselfNotesRestoreIncomplete\b/g, 'selfNotesRestoreIncompleteBox.value');
    const save = appFunctions({ ...env, selfNotesRestoreIncompleteBox }, [fn('function walletOfSend(owner = undefined) {'), source], 'publishSelfNoteSnapshot');
    await save({ thread: {}, message: {} });
    expect(order, 'read the moved chunks, then write').toEqual(['ledger:notes:true', 'restore', 'publish']);
    order.length = 0;
    incomplete = true;
    await expect(save({ thread: {}, message: {} })).rejects.toMatchObject({ code: 'PLATHO_NOTES_RESTORE_INCOMPLETE' });
    expect(order, 'a read that could not complete holds the save').toEqual(['ledger:notes:true', 'restore']);
  });

  it('RR-06: the groups blob is written only after the chunks were read again — not when the chain already says the same, not after an unclean read', async () => {
    const events: string[] = [];
    let chainSaysTheSame = false;
    let readClean = true;
    const box = { allowed: true, stored: [] as any[], inFlight: false };
    const env: Record<string, any> = {
      plathoWallet: { address: WALLET, seed: SEED }, groupRuntimeInstance: { list: () => [{ id: 'g1' }] }, publicGroupRuntimeInstance: null,
      groupsRecoveryEntries: (records: any[]) => records.map((r) => ({ g: r.id })), isPublicGroupRecoveryEntry: () => false,
      groupsRecoveryOverflowIds: new Set(), groupsRecoveryIsStale: (comparable: any[], stored: any[]) => JSON.stringify(comparable) !== JSON.stringify(stored),
      globalThis: { plathoTonRpcTransport: { runGetMethod: async () => ({}) } },
      readSelfSlotLedger: async (options: any) => { events.push(`ledger:${options?.only}:${options?.force}`); return { trusted: true }; },
      restoreGroupsFromRecoveryIfFresh: async () => { events.push('restore'); boxAllowed(readClean); if (chainSaysTheSame) boxStored([{ g: 'g1' }]); },
      packGroupsForRecovery: async () => { events.push('pack'); return { chunks: [], overflow: [] }; },
      GROUPS_NAMED_SLOT_COUNT: 0, console: { warn: () => {} },
      createRecoveryViewReader: () => async () => null, requireBasechainAddress: () => {}, requirePlathoWalletAddress: () => WALLET,
      noteChatKeysBackupShortfall: () => {}, clearChatKeysBackupShortfall: () => {},
    };
    const boxAllowed = (v: boolean) => { box.allowed = v; };
    const boxStored = (v: any[]) => { box.stored = v; };
    const source = fn('async function backupGroupsIfNeeded() {')
      .replace(/\bgroupsBackupAllowed\b/g, 'box.allowed').replace(/\bgroupsRecoveryStored\b/g, 'box.stored').replace(/\bgroupsBackupInFlight\b/g, 'box.inFlight');
    const backup = appFunctions({ ...env, box, boxAllowed, boxStored }, [source], 'backupGroupsIfNeeded');
    await backup();
    expect(events, 'read, then write').toEqual(['ledger:groups:true', 'restore', 'pack']);
    events.length = 0; box.stored = []; chainSaysTheSame = true;
    await backup();
    expect(events, 'another device already wrote it: nothing to write').toEqual(['ledger:groups:true', 'restore']);
    events.length = 0; box.stored = []; chainSaysTheSame = false; readClean = false;
    await backup();
    expect(events, 'an unclean read holds the write').toEqual(['ledger:groups:true', 'restore']);
    expect(box.inFlight, 'and lets go of the guard').toBe(false);
  });

  it('RR-07: a write\'s read asks its own lane\'s slots, fresh, and that ledger is never held for the others', () => {
    const ledger = fn('async function readSelfSlotLedger({ force = false, only = null } = {}) {');
    expect(ledger).toContain('try { states = await readStates((only ? space[only] ?? [] : space.all).map((slot) => slot.address)); } catch { states = null; }');
    expect(ledger).toContain('if (trusted && !only) selfSlotLedger = ledger;');
    expect(ledger).toContain("if (!force && !only && selfSlotLedger?.walletRaw === walletRaw");
    expect(line('const SELF_SLOT_LEDGER_FRESH_MS = ')).toContain('60_000');
  });
});
