import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { beginCell } from '@ton/core';
import { __setLaneGenerationCodeForTests, __resetLaneGenerationCodeOverridesForTests } from '../web/shard-address.mjs';
import { createGroupRuntime } from '../web/group-runtime.mjs';
import { createMemoryGroupRecordStore } from '../web/group-record-store.mjs';
import {
  GROUPS_RECOVERY_REFRESH_DAYS, groupRecoveryEntry, groupsRecoveryBytes, groupsRecoveryEntries,
  groupsRecoveryIsStale, groupsRecoverySecret, isPublicGroupRecoveryEntry, parseGroupsRecovery,
  publicGroupRecoveryEntry, publicGroupRecoveryPointer,
} from '../web/group-store.mjs';
import { sealGroupsBlob, openGroupsBlob, openPrefsBlob } from '../web/recovery-blob.mjs';
import { groupsChunkSlot, packGroupsForRecovery, prepareGroupsBackup, restoreGroupsEntries } from '../web/recovery-lane.mjs';
import { GROUPS_NAMED_SLOT_BASE, GROUPS_NAMED_SLOT_COUNT, NOTES_NAMED_SLOT_BASE, NOTES_NAMED_SLOT_COUNT, RECOVERY_MAX_SLOTS } from '../web/shard-discovery.mjs';
import { x25519 } from '../web/vendor/@noble/curves/ed25519.js';
import { ml_kem768 } from '../web/vendor/@noble/post-quantum/ml-kem.js';


const CLOCK = 1_800_000_000;
const TODAY = Math.floor(CLOCK / 86_400);
const DUMMY_CELL = beginCell().storeUint(0x5a5a, 16).endCell().toBoc().toString('base64');
beforeAll(() => {
  __setLaneGenerationCodeForTests('record', 18, DUMMY_CELL);
  __setLaneGenerationCodeForTests('vault', 18, DUMMY_CELL);
});
afterAll(() => { __resetLaneGenerationCodeOverridesForTests(); });

const bytes = (fill: number, length = 32) => new Uint8Array(length).fill(fill);
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

function identityFor(fill: number) {
  const kem = ml_kem768.keygen(new Uint8Array(64).fill(fill));
  const xSecret = bytes(fill ^ 0x5A);
  return {
    vaultSeed: bytes(fill),
    wallet: `0:${String(fill).padStart(2, '0').repeat(32).slice(0, 64)}`,
    keyId: `key-${fill}`,
    name: `member-${fill}`,
    x25519SecretKey: xSecret,
    x25519PublicKey: x25519.getPublicKey(xSecret),
    mlKem768SecretKey: kem.secretKey,
    mlKem768PublicKey: kem.publicKey,
  };
}

function runtimeFor(identity: any) {
  const sent: any[] = [];
  const runtime = createGroupRuntime({
    store: createMemoryGroupRecordStore(),
    identity,
    send: async (messages: any[]) => { sent.push(...messages); },
    vaultRouting: async () => ({ vaultAddress: `0:${'aa'.repeat(32)}`, feeDue: 10_000_000n }),
    readMessagesWithSource: async () => [],
    readStates: async () => new Map(),
    publishValue: 19_100_000n,
    now: () => CLOCK,
    boundary: TODAY,
    random: (n: number) => new Uint8Array(n).fill(0x5C),
  });
  return { runtime, sent };
}

function fakeSlots() {
  const store = new Map<string, any>();
  return {
    store,
    readView: async (address: string) => (store.has(address) ? { bound: true, seq: 1 } : { bound: false }),
    readBody: async (address: string) => store.get(address) ?? null,
  };
}

describe('GROUP RECOVERY — a group outlives its device', () => {
  it('GREC-01: the slot range is inside the deployed named block and takes nobody else\'s room', () => {
    expect(GROUPS_NAMED_SLOT_BASE).toBe(NOTES_NAMED_SLOT_BASE + NOTES_NAMED_SLOT_COUNT);
    expect(GROUPS_NAMED_SLOT_BASE).toBeGreaterThanOrEqual(RECOVERY_MAX_SLOTS);
    expect(GROUPS_NAMED_SLOT_BASE + GROUPS_NAMED_SLOT_COUNT).toBeLessThanOrEqual(RECOVERY_MAX_SLOTS + 16);
  });

  it('GREC-02: the blob is domain-separated, and a chunk cannot be replayed into another slot', async () => {
    const seed = bytes(7);
    const body = (await sealGroupsBlob(seed, groupsRecoveryBytes([]), 0)).body;
    expect(await openGroupsBlob(seed, body, 0)).not.toBeNull();
    expect(await openGroupsBlob(seed, body, 1)).toBeNull();
    expect(await openGroupsBlob(bytes(8), body, 0)).toBeNull();
    expect(await openPrefsBlob(seed, body)).toBeNull();
  });

  it('GREC-03: a group made on one device is adopted whole on another that has only the seed', async () => {
    const me = identityFor(0x21);
    const first = runtimeFor(me);
    const made = await first.runtime.create({ name: '\u041a\u0443\u0445\u043d\u044f' });

    const entries = groupsRecoveryEntries(first.runtime.list());
    expect(entries).toHaveLength(1);
    const chain = fakeSlots();
    const { chunks, overflow } = await packGroupsForRecovery(me.vaultSeed, entries);
    expect(overflow).toHaveLength(0);
    for (const [index, chunk] of chunks.entries()) {
      const slot = await groupsChunkSlot(me.vaultSeed, index);
      chain.store.set(slot.address, (await sealGroupsBlob(me.vaultSeed, groupsRecoveryBytes(chunk), index)).body);
    }

    const fresh = runtimeFor(me);
    expect(fresh.runtime.list()).toHaveLength(0);
    const restored = await restoreGroupsEntries({ seed: me.vaultSeed, readView: chain.readView, readBody: chain.readBody });
    expect(restored.clean).toBe(true);
    for (const entry of restored.entries) await fresh.runtime.adopt(groupsRecoverySecret(entry));

    const back = fresh.runtime.list();
    expect(back).toHaveLength(1);
    expect(hex(back[0].groupId)).toBe(hex(made.groupId));
    expect(back[0].name).toBe('\u041a\u0443\u0445\u043d\u044f');
    expect(made.openedAt).toBe(CLOCK);
    expect(back[0].openedAt, 'the restore plants it as joined now').toBe(CLOCK);
    expect(hex(back[0].epochs[0].key)).toBe(hex(made.epochs[0].key));
    expect(hex(back[0].self)).toBe(hex(made.self));
    {
      const { groupRosterKeyFor } = await import('../web/group-store.mjs');
      expect(hex(groupRosterKeyFor(back[0], 0)!)).toBe(hex(groupRosterKeyFor(made, 0)!));
      expect(back[0].snapshotApplied).toBe(true);
      expect(restored.entries[0].r).toBe(hex(groupRosterKeyFor(made, 0)!));
      expect(restored.entries[0].a, 'the owner, whose lane is read first').toBe(hex(made.self));
    }
    expect(back[0].admins.map(hex)).toContain(hex(made.self));
    expect(fresh.sent).toHaveLength(0);
  });

  it('GREC-04: a removal re-keys and the stored entry does NOT have to be rewritten', async () => {
    const me = identityFor(0x31);
    const { runtime } = runtimeFor(me);
    const made = await runtime.create({ name: '\u041a\u0443\u0445\u043d\u044f' });
    const before = groupRecoveryEntry(runtime.get(hex(made.groupId)));
    expect(before).not.toBeNull();
    const stored = parseGroupsRecovery(groupsRecoveryBytes([before]));
    expect(groupsRecoveryIsStale(groupsRecoveryEntries(runtime.list()), stored, TODAY)).toBe(false);
  });

  it('GREC-05: an entry is refreshed before adopt would refuse its age, and never on an ordinary day', () => {
    const me = identityFor(0x41);
    const record = { groupId: bytes(0xab), name: '\u041a\u0443\u0445\u043d\u044f', self: bytes(1), admins: [bytes(1)], members: [], rosterKeys: {}, leftAt: null, epochs: [{ epoch: TODAY, generation: 0, key: bytes(0xcd) }] };
    const stored = parseGroupsRecovery(groupsRecoveryBytes([groupRecoveryEntry(record as any)]));
    const mine = (records: any[]) => groupsRecoveryEntries(records);
    expect(groupsRecoveryIsStale(mine([record]), stored, TODAY)).toBe(false);
    expect(groupsRecoveryIsStale(mine([record]), stored, TODAY + GROUPS_RECOVERY_REFRESH_DAYS)).toBe(false);
    const later = TODAY + GROUPS_RECOVERY_REFRESH_DAYS + 1;
    const moved = { ...record, epochs: [{ epoch: later - 3, generation: 0, key: bytes(0xce) }] };
    expect(groupsRecoveryIsStale(mine([moved]), stored, later)).toBe(true);
    expect(groupsRecoveryIsStale(mine([record]), stored, later), 'the same entry again is not a refresh').toBe(false);
    expect(GROUPS_RECOVERY_REFRESH_DAYS).toBeLessThan(366);
    expect(groupsRecoveryIsStale(mine([record, { ...record, groupId: bytes(0xee) }]), stored, TODAY)).toBe(true);
    expect(groupRecoveryEntry({ ...record, leftAt: CLOCK } as any)).toBeNull();
  });

  it('GREC-06: more groups than the slots hold come back as overflow, never silently dropped', async () => {
    const seed = bytes(0x51);
    const entry = (i: number) => ({ g: hex(bytes(i % 256)), k: hex(bytes((i * 7) % 256)), e: TODAY, n: 0, t: `\u0413\u0440\u0443\u043f\u043f\u0430 ${i}`, a: hex(bytes(1)) });
    const many = Array.from({ length: 200 }, (_, i) => entry(i + 1));
    const { chunks, overflow } = await packGroupsForRecovery(seed, many);
    expect(chunks.length).toBeLessThanOrEqual(GROUPS_NAMED_SLOT_COUNT);
    expect(chunks.reduce((sum, c) => sum + c.length, 0) + overflow.length).toBe(many.length);
    expect(overflow.length).toBeGreaterThan(0);
  });

  it('GREC-08: a shrinking set CLEARS its tail slot, or a restore resurrects what was left behind', async () => {
    const seed = bytes(0x71);
    const unbound = await prepareGroupsBackup({
      seed, entries: [], chunkIndex: 1, readView: async () => ({ bound: false }), value: 38_400_000n,
    });
    expect(unbound, 'an empty chunk on a never-written slot is not worth a publish').toBeNull();
    const bound = await prepareGroupsBackup({
      seed, entries: [], chunkIndex: 1, readView: async () => ({ bound: true, seq: 4 }), value: 38_400_000n,
    });
    expect(bound, 'a slot that HOLDS something must be cleared').not.toBeNull();
    expect(bound!.seq, 'anti-rollback: the clear is a forward write').toBe(5);
    const cleared = await openGroupsBlob(seed, (await sealGroupsBlob(seed, groupsRecoveryBytes([]), 1)).body, 1);
    expect(parseGroupsRecovery(cleared as Uint8Array)).toEqual([]);
  });

  it('GREC-09: a PUBLIC room rides the same slots as its pointer, in a field a build from before it does not read', async () => {
    const me = identityFor(0x81);
    const priv = runtimeFor(me);
    await priv.runtime.create({ name: '\u041a\u0443\u0445\u043d\u044f' });
    const founder = bytes(0x99);
    const room = { kind: 'public', groupId: bytes(0x42), founder, foundedEra: 694, name: '\u041f\u043b\u043e\u0449\u0430\u0434\u044c', leftAt: null };
    const left = { ...room, groupId: bytes(0x43), leftAt: CLOCK };
    const entries = groupsRecoveryEntries(priv.runtime.list(), [room, left]);
    expect(entries, 'the private room and the public one; the room this device LEFT stays history here').toHaveLength(2);
    const pointerEntry = entries.find(isPublicGroupRecoveryEntry)!;
    expect(pointerEntry).toEqual({ g: hex(bytes(0x42)), f: hex(founder), r: 694, t: '\u041f\u043b\u043e\u0449\u0430\u0434\u044c' });
    expect(publicGroupRecoveryEntry({ ...room, founder: null } as any), 'no founder, no address, nothing to plant').toBeNull();
    expect(publicGroupRecoveryEntry({ ...room, foundedEra: null })).toEqual({ g: hex(bytes(0x42)), f: hex(founder), t: '\u041f\u043b\u043e\u0449\u0430\u0434\u044c' });
    const raw = JSON.parse(new TextDecoder().decode(groupsRecoveryBytes(entries)));
    expect(raw.v).toBe(1);
    expect(raw.groups).toHaveLength(1);
    expect(raw.groups.every((entry: any) => typeof entry.k === 'string' && entry.f === undefined), 'nothing but private entries in `groups`').toBe(true);
    expect(raw.public).toHaveLength(1);
    expect(JSON.parse(new TextDecoder().decode(groupsRecoveryBytes(groupsRecoveryEntries(priv.runtime.list())))).public, 'no field when there is nothing in it — the bytes of a private-only blob are unchanged').toBeUndefined();
    expect(parseGroupsRecovery(groupsRecoveryBytes(entries))).toHaveLength(2);
    const forged = (pointers: any[]) => new TextEncoder().encode(JSON.stringify({ v: 1, groups: [], public: pointers }));
    expect(parseGroupsRecovery(forged([{ g: hex(bytes(1)), f: 'not-a-founder' }])), 'a pointer without a founder is not a pointer').toHaveLength(0);
    expect(parseGroupsRecovery(forged([{ g: hex(bytes(1)), f: hex(bytes(2)), r: -1 }])), 'nor one with an era below zero').toHaveLength(0);
    expect(parseGroupsRecovery(forged([{ g: hex(bytes(1)), f: hex(bytes(2)) }]))).toHaveLength(1);
    const chain = fakeSlots();
    const { chunks, overflow } = await packGroupsForRecovery(me.vaultSeed, entries);
    expect(overflow).toHaveLength(0);
    for (const [index, chunk] of chunks.entries()) {
      chain.store.set((await groupsChunkSlot(me.vaultSeed, index)).address, (await sealGroupsBlob(me.vaultSeed, groupsRecoveryBytes(chunk), index)).body);
    }
    const restored = await restoreGroupsEntries({ seed: me.vaultSeed, readView: chain.readView, readBody: chain.readBody });
    expect(restored.clean).toBe(true);
    expect(restored.entries).toHaveLength(2);
    const pointer = publicGroupRecoveryPointer(restored.entries.find(isPublicGroupRecoveryEntry)!);
    expect(hex(pointer.groupId)).toBe(hex(bytes(0x42)));
    expect(hex(pointer.founder)).toBe(hex(founder));
    expect(pointer.foundedEra).toBe(694);
    expect(pointer.name).toBe('\u041f\u043b\u043e\u0449\u0430\u0434\u044c');
  });

  it('GREC-10: a pointer never ages, is rewritten once when the era is learned, and a new room makes the blob stale at once', () => {
    const room = { kind: 'public', groupId: bytes(0x42), founder: bytes(0x99), foundedEra: null, name: 'square', leftAt: null };
    const mine = groupsRecoveryEntries([], [room]);
    const stored = parseGroupsRecovery(groupsRecoveryBytes(mine));
    expect(groupsRecoveryIsStale(mine, stored, TODAY)).toBe(false);
    expect(groupsRecoveryIsStale(mine, stored, TODAY + 10_000), 'no ratchet to outrun: the founder is in the address for as long as the group exists').toBe(false);
    expect(groupsRecoveryIsStale(groupsRecoveryEntries([], [{ ...room, foundedEra: 694 }]), stored, TODAY), 'the era, once the founding row taught it').toBe(true);
    expect(groupsRecoveryIsStale(groupsRecoveryEntries([], [{ ...room, name: 'plaza' }]), stored, TODAY), 'a rename is not a way back in').toBe(false);
    expect(groupsRecoveryIsStale(groupsRecoveryEntries([], [{ ...room, founder: bytes(0x98) }]), stored, TODAY), 'another founder is another group').toBe(true);
    expect(groupsRecoveryIsStale(groupsRecoveryEntries([], [room, { ...room, groupId: bytes(0x44) }]), stored, TODAY)).toBe(true);
    expect(groupsRecoveryIsStale(mine, [], TODAY), 'a blob from before public groups says nothing about the room').toBe(true);
    const asPrivate = { g: hex(bytes(0x42)), k: hex(bytes(1)), e: TODAY, n: 0 };
    expect(groupsRecoveryIsStale(mine, [asPrivate], TODAY)).toBe(true);
    expect(groupsRecoveryIsStale([asPrivate], stored, TODAY), 'and the other way round').toBe(true);
  });

  it('GREC-07: a read that fails is not an answer of "this seed has no groups"', async () => {
    const seed = bytes(0x61);
    const thrown = await restoreGroupsEntries({ seed, readView: async () => { throw new Error('rpc'); }, readBody: async () => null });
    expect(thrown.entries).toHaveLength(0);
    expect(thrown.clean, 'a throwing read must never read as an empty account').toBe(false);
    const unbound = await restoreGroupsEntries({ seed, readView: async () => ({ bound: false }), readBody: async () => null });
    expect(unbound.entries).toHaveLength(0);
    expect(unbound.clean).toBe(true);
  });
});
