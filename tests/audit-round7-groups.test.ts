import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { beginCell } from '@ton/core';
import { __setLaneGenerationCodeForTests, __resetLaneGenerationCodeOverridesForTests } from '../web/shard-address.mjs';
import { createGroupRuntime, GROUP_LEFT_READ_S } from '../web/group-runtime.mjs';
import { createMemoryGroupRecordStore } from '../web/group-record-store.mjs';
import {
  GROUP_KIND, GROUP_INVITE_PREFIX, decodeGroupPayload, encodeGroupInviteToken, encodeGroupRoster, parseGroupInviteToken, parseGroupJoinToken,
  sealGroupRekeyEnvelope,
} from '../web/group-protocol.mjs';
import {
  adoptGroupGeneration, advanceGroupWindow, applyGroupRows, createGroupRecord, currentGroupEpoch, groupMember,
  groupRosterKeyFor, holdsGroupGeneration, isGroupAdmin, isGroupMuted, memberForLog, noteGroupRosterKey, notePendingControl,
  parseGroupRecord, serializeGroupRecord, settlePendingControl,
  catchUpGroupGeneration, groupAccessOwedIn, groupAdminByWallet, notePendingGroupInvite, pendingInviteBehind,
} from '../web/group-store.mjs';
import { createGroupFounding, groupMemberPublicKey, groupMemberSeed, groupRosterKey } from '../web/crypto/group-lane.mjs';
import { x25519 } from '../web/vendor/@noble/curves/ed25519.js';
import { ml_kem768 } from '../web/vendor/@noble/post-quantum/ml-kem.js';


const CLOCK = 1_800_000_000;
const DAY = 86_400;
const EPOCH = Math.floor(CLOCK / DAY);
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
type Identity = ReturnType<typeof identityFor>;

function runtimeFor(identity: Identity, extra: any = {}) {
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
    boundary: EPOCH,
    random: (n: number) => new Uint8Array(n).fill(0x5C),
    ...extra,
  });
  return { runtime, sent };
}

const keyIn = async (who: Identity, groupId: Uint8Array) => groupMemberPublicKey(await groupMemberSeed({ vaultSeed: who.vaultSeed, groupId }));
const seat = (who: Identity, groupKey: Uint8Array) => ({ groupKey, wallet: who.wallet, keyId: who.keyId, name: who.name, x25519PublicKey: who.x25519PublicKey, mlKem768PublicKey: who.mlKem768PublicKey });
const rosterAddress = (admin: Uint8Array, generation: number, epoch: number) => `0:${hex(admin).slice(0, 40)}${generation.toString(16).padStart(8, '0')}${epoch.toString(16).padStart(16, '0')}`;
function rosterLane(rows: any[], asked: any[] = [], extra: any = {}) {
  return {
    buckets: async () => [], readSnapshot: async () => null, read: async () => [],
    rosterBuckets: async ({ generation, epochs, adminPublicKeys }: any) => epochs.flatMap((epoch: number) => adminPublicKeys.map((a: Uint8Array) => ({
      address: rosterAddress(a, generation, epoch), epoch, generation, member: a, roster: true,
    }))),
    readRoster: async ({ generation, epochs, adminPublicKeys }: any) => {
      asked.push({ generation, epochs: [...epochs], admins: adminPublicKeys.map(hex) });
      return rows.filter((r) => r.generation === generation && epochs.includes(r.epoch) && adminPublicKeys.some((a: Uint8Array) => hex(a) === hex(r.senderGroupKey)));
    },
    ...extra,
  };
}
const controlRow = (kind: number, sender: Uint8Array, payload: any, { epoch = EPOCH, generation = 0, seq = 1, at = CLOCK } = {}) => ({
  address: rosterAddress(sender, generation, epoch), kind, roster: kind !== GROUP_KIND.LEAVE && kind !== GROUP_KIND.TEXT,
  senderGroupKey: sender, epoch, generation, seq, sentAt: at, createdAt: at, payload: { sentAt: at, ...payload },
});

async function room(people: Record<string, Identity>, { self, owner, admins, members, entropy = 0x11, openedAt = 0 }: { self: string; owner: string | null; admins: string[]; members: string[]; entropy?: number; openedAt?: number }) {
  const founding = await createGroupFounding({ entropy: bytes(entropy), createdAtSec: CLOCK });
  const keys: Record<string, Uint8Array> = {};
  for (const [name, who] of Object.entries(people)) keys[name] = await keyIn(who, founding.groupId);
  const record = createGroupRecord({
    founding, name: 'the room', self: keys[self], owner: owner ? keys[owner] : null,
    admins: admins.map((n) => keys[n]), members: members.map((n) => seat(people[n], keys[n])), openedAt,
  });
  return { founding, keys, record, id: hex(founding.groupId) };
}
async function onDevice(identity: Identity, record: any, extra: any = {}) {
  const store = createMemoryGroupRecordStore();
  await store.put(hex(record.groupId), serializeGroupRecord(record));
  const device = runtimeFor(identity, { store, ...extra });
  await device.runtime.load();
  return { ...device, store };
}

function code(text: string) {
  let out = '';
  let quote: string | null = null;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const next = text[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') { out += next ?? ''; i += 1; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; out += c; continue; }
    if (c === '/' && next === '/') { while (i < text.length && text[i] !== '\n') i += 1; out += ' '; continue; }
    if (c === '/' && next === '*') { const end = text.indexOf('*/', i + 2); i = end < 0 ? text.length : end + 1; out += ' '; continue; }
    out += c;
  }
  return out.replace(/\s+/g, ' ');
}
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

describe('R7 — what a control row may change', () => {
  it('G7-01: a roster cannot rewrite a seated member — their keys, their wallet, the owner\'s own — and fills only what is missing', async () => {
    const people = { owner: identityFor(0x21), admin: identityFor(0x22), member: identityFor(0x23), blank: identityFor(0x24), thief: identityFor(0x25), stranger: identityFor(0x26) };
    const { keys, record: base } = await room(people, { self: 'owner', owner: 'owner', admins: ['owner', 'admin'], members: ['owner', 'admin', 'member', 'blank'] });
    const record = { ...base, members: base.members.map((m: any) => (hex(m.groupKey) === hex(keys.blank) ? { ...m, x25519PublicKey: null, mlKem768PublicKey: null } : m)) };
    const forged = (k: Uint8Array) => ({ ...seat(people.thief, k), name: 'x' });
    const roster = controlRow(GROUP_KIND.ROSTER, keys.admin, {
      members: [forged(keys.owner), forged(keys.admin), forged(keys.member), seat(people.blank, keys.blank), seat(people.stranger, keys.stranger)],
      admins: [keys.owner, keys.admin], owner: keys.owner, name: 'the room', asOf: {},
    }, { at: CLOCK + 10 });
    const { record: after } = applyGroupRows(record, [roster]);
    for (const name of ['owner', 'admin', 'member'] as const) {
      const held = groupMember(after, keys[name]);
      expect(held.wallet, `${name}'s wallet — where the door's price is paid, for the owner`).toBe(people[name].wallet);
      expect(hex(held.x25519PublicKey), `${name}'s X25519 key — what every later rekey is sealed to`).toBe(hex(people[name].x25519PublicKey));
      expect(hex(held.mlKem768PublicKey)).toBe(hex(people[name].mlKem768PublicKey));
    }
    const filled = groupMember(after, keys.blank);
    expect(hex(filled.x25519PublicKey)).toBe(hex(people.blank.x25519PublicKey));
    expect(hex(filled.mlKem768PublicKey)).toBe(hex(people.blank.mlKem768PublicKey));
    const junk = controlRow(GROUP_KIND.ROSTER, keys.admin, {
      members: [seat(people.owner, keys.owner), seat(people.admin, keys.admin), seat(people.member, keys.member), { ...seat(people.blank, keys.blank), x25519PublicKey: bytes(0, 32), mlKem768PublicKey: bytes(1, 1184) }],
      admins: [keys.owner, keys.admin], owner: keys.owner, name: 'the room', asOf: {},
    }, { at: CLOCK + 11, seq: 2 });
    expect(groupMember(applyGroupRows(record, [junk]).record, keys.blank).x25519PublicKey).toBeNull();
    expect(groupMember(after, keys.stranger).wallet).toBe(people.stranger.wallet);
  });

  it('G7-02: an admin is removed by the owner alone — on every reader, and on the device that would have paid for the row', async () => {
    const people = { owner: identityFor(0x31), me: identityFor(0x32), other: identityFor(0x33), plain: identityFor(0x34) };
    const { keys, record, id } = await room(people, { self: 'me', owner: 'owner', admins: ['owner', 'me', 'other'], members: ['owner', 'me', 'other', 'plain'] });
    const byAdmin = controlRow(GROUP_KIND.REMOVE, keys.me, { groupKey: keys.other, generation: 1, envelope: null });
    const dropped = applyGroupRows(record, [byAdmin]).record;
    expect(isGroupAdmin(dropped, keys.other)).toBe(true);
    expect(groupMember(dropped, keys.other)).toBeTruthy();
    const byOwner = controlRow(GROUP_KIND.REMOVE, keys.owner, { groupKey: keys.other, generation: 1, envelope: null });
    expect(groupMember(applyGroupRows(record, [byOwner]).record, keys.other)).toBeNull();
    const { runtime, sent } = await onDevice(people.me, record);
    await expect(runtime.remove(id, keys.other, { cutReading: false })).rejects.toThrow(/only the owner removes an admin/);
    expect(sent.length, 'nothing paid for a row every reader drops').toBe(0);
    await runtime.remove(id, keys.plain, { cutReading: false });
    expect(sent.length, 'a plain member is still removed by any admin').toBe(1);
  });

  it('G7-03: a leave or a removal that a later admission undid is spent — across the two folds of a pass, and on a replay', async () => {
    const people = { owner: identityFor(0x41), x: identityFor(0x42), y: identityFor(0x43), c: identityFor(0x44) };
    const { keys, record } = await room(people, { self: 'owner', owner: 'owner', admins: ['owner', 'x', 'y'], members: ['owner', 'x', 'y', 'c'] });
    const admitted = controlRow(GROUP_KIND.ADMIT, keys.x, { members: [seat(people.c, keys.c)] }, { at: CLOCK + 20 });
    const leave = controlRow(GROUP_KIND.LEAVE, keys.c, { groupKey: keys.c }, { at: CLOCK + 10 });
    let r = applyGroupRows(record, [admitted]).record;
    r = applyGroupRows(r, [leave]).record;
    expect(groupMember(r, keys.c), 'the older leave does not take them out of the room they came back to').toBeTruthy();
    r = applyGroupRows(r, [controlRow(GROUP_KIND.LEAVE, keys.c, { groupKey: keys.c }, { at: CLOCK + 30, seq: 2 })]).record;
    expect(groupMember(r, keys.c)).toBeNull();
    const removed = controlRow(GROUP_KIND.REMOVE, keys.x, { groupKey: keys.c, generation: 1, envelope: null }, { at: CLOCK + 10 });
    const readmitted = controlRow(GROUP_KIND.ADMIT, keys.y, { members: [seat(people.c, keys.c)] }, { at: CLOCK + 20 });
    let s = applyGroupRows(record, [removed, readmitted]).record;
    expect(groupMember(s, keys.c)).toBeTruthy();
    const snapshot = controlRow(GROUP_KIND.ROSTER, keys.y, {
      members: ['owner', 'x', 'y', 'c'].map((n) => seat((people as any)[n], keys[n])), admins: [keys.owner, keys.x, keys.y], owner: keys.owner, name: 'the room',
      asOf: { [hex(keys.y)]: { epoch: EPOCH, seq: 1, g: 0 } },
    }, { at: CLOCK + 30, seq: 2 });
    s = applyGroupRows(s, [snapshot]).record;
    expect(groupMember(s, keys.c), 'the admission stands').toBeTruthy();
  });

  it('G7-04: this device\'s own leave from before it (re)joined says nothing about the membership it holds now', async () => {
    const people = { owner: identityFor(0x45), me: identityFor(0x46) };
    const { keys, record } = await room(people, { self: 'me', owner: 'owner', admins: ['owner'], members: ['owner', 'me'], openedAt: CLOCK + 100 });
    const old = applyGroupRows(record, [controlRow(GROUP_KIND.LEAVE, keys.me, { groupKey: keys.me }, { at: CLOCK + 50 })]).record;
    expect(old.leftAt).toBeNull();
    expect(groupMember(old, keys.me)).toBeTruthy();
    const now = applyGroupRows(record, [controlRow(GROUP_KIND.LEAVE, keys.me, { groupKey: keys.me }, { at: CLOCK + 150, seq: 2 })]).record;
    expect(now.leftAt).toBe(CLOCK + 150);
  });
});

describe('R7 — generations: the head, the chain, the rival', () => {
  it('G7-05: the head is the highest generation\'s newest day; a walked day carries its chain and its stamp; the same chain read again is not a rival', async () => {
    const people = { me: identityFor(0x51) };
    const { record: base } = await room(people, { self: 'me', owner: 'me', admins: ['me'], members: ['me'] });
    const stamp = [CLOCK, 0, 'aa', 1];
    let record = await advanceGroupWindow(base, CLOCK + DAY);
    record = adoptGroupGeneration(record, { epoch: EPOCH + 1, generation: 1, key: bytes(0x70), speculative: true });
    record = adoptGroupGeneration(record, { epoch: EPOCH, generation: 1, key: bytes(0x71), stamp });
    expect(record.epochs.at(-1).generation, 'sorted by day, the list ends on the old generation').toBe(0);
    expect(currentGroupEpoch(record)).toMatchObject({ generation: 1, epoch: EPOCH });
    const walked = await advanceGroupWindow(record, CLOCK + DAY);
    expect(currentGroupEpoch(walked)).toMatchObject({ generation: 1, epoch: EPOCH + 1 });
    expect(holdsGroupGeneration(walked, 1, bytes(0x71)), 'the walked day descends from the adopted key').toBe(true);
    expect(walked.epochs.find((e: any) => e.generation === 1 && e.epoch === EPOCH + 1).stamp).toEqual(stamp);
    const aged = { ...walked, epochs: walked.epochs.filter((e: any) => !(e.generation === 1 && e.epoch === EPOCH)).map((e: any) => ({ ...e, stamp: undefined })) };
    const again = adoptGroupGeneration(aged, { epoch: EPOCH, generation: 1, key: bytes(0x71), stamp });
    expect(again, 'the same chain, not a rival').toBe(aged);
  });

  it('G7-06: a rekey lost after midnight takes back its whole chain and its roster key — and leaves a rival\'s chain of that generation alone', async () => {
    const people = { me: identityFor(0x52), gone: identityFor(0x53) };
    const { keys, record: base } = await room(people, { self: 'me', owner: 'me', admins: ['me'], members: ['me', 'gone'] });
    const own = bytes(0x72);
    const pendingRemove = (record: any) => notePendingControl(record, {
      kind: GROUP_KIND.REMOVE, epoch: EPOCH, generation: 0, seq: 1, at: CLOCK, victim: memberForLog(seat(people.gone, keys.gone)), victimWasAdmin: false,
      rekey: { epoch: EPOCH, generation: 1, key: hex(own) }, revert: { snapshot: null, admitsSinceSnapshot: 0, rosterCursor: EPOCH, removals: {} },
    });
    let record = { ...base, members: base.members.filter((m: any) => hex(m.groupKey) !== hex(keys.gone)) };
    record = adoptGroupGeneration(record, { epoch: EPOCH, generation: 1, key: own, speculative: true });
    record = noteGroupRosterKey(record, 1, bytes(0x73));
    record = await advanceGroupWindow(pendingRemove(record), CLOCK + DAY);
    expect(record.epochs.filter((e: any) => e.generation === 1), 'the claim walked past midnight').toHaveLength(2);
    const lanes = new Set([`0.${EPOCH}`]);
    const { record: after, reverted } = settlePendingControl(record, { rosterRows: [], cleanLanes: lanes, nowSec: CLOCK + DAY });
    expect(reverted).toHaveLength(1);
    expect(after.epochs.some((e: any) => e.generation === 1), 'the whole chain, the day after midnight included').toBe(false);
    expect(groupRosterKeyFor(after, 1)).toBeNull();
    expect(currentGroupEpoch(after).generation).toBe(0);
    expect(groupMember(after, keys.gone), 'and the person is back').toBeTruthy();
    let rival = { ...base, members: base.members.filter((m: any) => hex(m.groupKey) !== hex(keys.gone)) };
    rival = adoptGroupGeneration(rival, { epoch: EPOCH, generation: 1, key: own, speculative: true });
    rival = adoptGroupGeneration(rival, { epoch: EPOCH, generation: 1, key: bytes(0x74), stamp: [CLOCK - 5, 0, 'bb', 1] });
    rival = noteGroupRosterKey(rival, 1, bytes(0x75));
    const kept = settlePendingControl(pendingRemove(rival), { rosterRows: [], cleanLanes: lanes, nowSec: CLOCK + 601 }).record;
    expect(holdsGroupGeneration(kept, 1, bytes(0x74))).toBe(true);
    expect(hex(groupRosterKeyFor(kept, 1))).toBe(hex(bytes(0x75)));
  });

  it('G7-07: a handover that never landed is taken back whole — the owner with the admin set', async () => {
    const people = { me: identityFor(0x54), heir: identityFor(0x55) };
    const { keys, record: base } = await room(people, { self: 'me', owner: 'me', admins: ['me'], members: ['me', 'heir'] });
    const handed = notePendingControl({ ...base, admins: [keys.me, keys.heir], owner: keys.heir }, {
      kind: GROUP_KIND.ADMIN, epoch: EPOCH, generation: 0, seq: 1, at: CLOCK, revert: { admins: [hex(keys.me)], owner: hex(keys.me) },
    });
    const { record: after } = settlePendingControl(handed, { rosterRows: [], cleanLanes: new Set([`0.${EPOCH}`]), nowSec: CLOCK + 601 });
    expect(hex(after.owner), 'the old owner is the owner again on its own device').toBe(hex(keys.me));
    expect(after.admins.map(hex)).toEqual([hex(keys.me)]);
  });

  it('G7-08: an undo takes back this device\'s own change and nobody else\'s — member by member, row by row', async () => {
    const people = { me: identityFor(0x56), other: identityFor(0x57), x: identityFor(0x58), z: identityFor(0x59) };
    const { keys, record: base } = await room(people, { self: 'me', owner: 'me', admins: ['me', 'other'], members: ['me', 'other', 'x', 'z'] });
    const lanes = new Set([`0.${EPOCH}`]);
    const mutedByMe = (record: any) => notePendingControl({ ...record, muted: [keys.x] }, { kind: GROUP_KIND.MUTE, epoch: EPOCH, generation: 0, seq: 1, at: CLOCK, revert: { muted: [] } });
    const otherMutes = (target: Uint8Array, seq: number) => controlRow(GROUP_KIND.MUTE, keys.other, { groupKey: target, lift: false }, { at: CLOCK + 5, seq });
    let record = applyGroupRows(mutedByMe(base), [otherMutes(keys.z, 1)]).record;
    let after = settlePendingControl(record, { rosterRows: [], cleanLanes: lanes, nowSec: CLOCK + 601 }).record;
    expect(isGroupMuted(after, keys.z), "the other admin's mute stands").toBe(true);
    expect(isGroupMuted(after, keys.x), "this device's own mute is taken back — the chain never said it").toBe(false);
    record = applyGroupRows(mutedByMe(base), [otherMutes(keys.z, 1), otherMutes(keys.x, 2)]).record;
    after = settlePendingControl(record, { rosterRows: [], cleanLanes: lanes, nowSec: CLOCK + 601 }).record;
    expect(isGroupMuted(after, keys.x), 'the chain agreed with this device, through the other admin').toBe(true);
    expect(isGroupMuted(after, keys.z)).toBe(true);
    const rowA = `${EPOCH}.0.${hex(keys.x)}.1`;
    const rowB = `${EPOCH}.0.${hex(keys.z)}.1`;
    record = notePendingControl({ ...base, hidden: { [rowA]: { at: CLOCK, excerpt: 'a' } } }, { kind: GROUP_KIND.HIDE, epoch: EPOCH, generation: 0, seq: 1, at: CLOCK, revert: { hidden: {} } });
    record = applyGroupRows(record, [controlRow(GROUP_KIND.HIDE, keys.other, { key: rowB, lift: false, excerpt: 'b' }, { at: CLOCK + 5 })]).record;
    after = settlePendingControl(record, { rosterRows: [], cleanLanes: lanes, nowSec: CLOCK + 601 }).record;
    expect(Object.keys(after.hidden)).toEqual([rowB]);
  });

  it('G7-08B: a row that agreed with what stood is remembered for the undo, and never replayed over a later snapshot', async () => {
    const people = { me: identityFor(0x5c), y: identityFor(0x5d), z: identityFor(0x5e), x: identityFor(0x5f) };
    const { keys, record: base } = await room(people, { self: 'me', owner: 'me', admins: ['me', 'y', 'z'], members: ['me', 'y', 'z', 'x'] });
    let r = applyGroupRows(base, [
      controlRow(GROUP_KIND.MUTE, keys.y, { groupKey: keys.x, lift: false }, { at: CLOCK + 1, seq: 1 }),
      controlRow(GROUP_KIND.MUTE, keys.z, { groupKey: keys.x, lift: false }, { at: CLOCK + 2, seq: 1 }),
      controlRow(GROUP_KIND.MUTE, keys.y, { groupKey: keys.x, lift: true }, { at: CLOCK + 3, seq: 2 }),
    ]).record;
    expect(r.controlLog.filter((e: any) => e.kind === GROUP_KIND.MUTE)).toHaveLength(3);
    expect(isGroupMuted(r, keys.x)).toBe(false);
    const snapshot = controlRow(GROUP_KIND.ROSTER, keys.y, {
      members: ['me', 'y', 'z', 'x'].map((n) => seat((people as any)[n], keys[n])), admins: [keys.me, keys.y, keys.z], owner: keys.me, name: 'the room', muted: [],
      asOf: { [hex(keys.y)]: { epoch: EPOCH, seq: 2, g: 0 } },
    }, { at: CLOCK + 4, seq: 3 });
    r = applyGroupRows(r, [snapshot]).record;
    expect(isGroupMuted(r, keys.x), 'the agreeing row changed nothing when it was folded, and says nothing after the snapshot').toBe(false);
  });

  it('G7-09: a pending write settles by its own lane — generation and day — not by the day alone', async () => {
    const people = { me: identityFor(0x5a), gone: identityFor(0x5b) };
    const { keys, record: base } = await room(people, { self: 'me', owner: 'me', admins: ['me'], members: ['me', 'gone'] });
    const record = notePendingControl({ ...base, members: base.members.filter((m: any) => hex(m.groupKey) !== hex(keys.gone)) }, {
      kind: GROUP_KIND.REMOVE, epoch: EPOCH, generation: 0, seq: 1, at: CLOCK, victim: memberForLog(seat(people.gone, keys.gone)), victimWasAdmin: false,
      rekey: null, revert: { removals: {} },
    });
    const settle = (opts: any) => settlePendingControl(record, { rosterRows: [], nowSec: CLOCK + 601, ...opts }).reverted.length;
    expect(settle({ cleanLanes: new Set([`2.${EPOCH}`]) }), "generation 2's lane of the same day says nothing about generation 0's").toBe(0);
    expect(settle({ cleanLanes: new Set([`0.${EPOCH}`]) })).toBe(1);
    expect(settle({ cleanEpochs: [EPOCH] }), 'the old form, for an old caller').toBe(1);
  });
});

describe('R7 — the pass: what it reads, what it keeps, what it writes', () => {
  it("G7-10: a pending write's own lane is read until it settles — a removal in generation 0 after the room moved to generation 2", async () => {
    const admin = identityFor(0x61);
    const others = [identityFor(0x62), identityFor(0x63), identityFor(0x64)];
    const rows: any[] = [];
    const asked: any[] = [];
    const { runtime } = runtimeFor(admin, { lane: rosterLane(rows, asked) });
    const record = await runtime.create({ name: 'two cuts' });
    const id = hex(record.groupId);
    const [kb, kc, kd] = await Promise.all(others.map((who) => keyIn(who, record.groupId)));
    await runtime.admit(id, [seat(others[0], kb), seat(others[1], kc), seat(others[2], kd)]);
    const first = (await runtime.remove(id, kb, { cutReading: true })).pendingControl.find((e: any) => e.kind === GROUP_KIND.REMOVE);
    const second = await runtime.remove(id, kc, { cutReading: true });
    expect(currentGroupEpoch(second).generation, 'two cuts: the room is on generation 2').toBe(2);
    expect(Number(first.generation), 'and the first removal was written into generation 0').toBe(0);
    asked.length = 0;
    await runtime.sync();
    expect(asked.some((a) => a.generation === 0 && a.epochs.includes(EPOCH) && a.admins.length === 1 && a.admins[0] === hex(record.self!)),
      "generation 0's own lane is read for the write waiting in it").toBe(true);
    rows.push(controlRow(GROUP_KIND.REMOVE, record.self!, { groupKey: kb, generation: 1, envelope: null }, { generation: 0, seq: Number(first.seq) }));
    const [pass] = await runtime.sync();
    expect(pass.record.pendingControl.some((e: any) => Number(e.generation) === 0 && Number(e.seq) === Number(first.seq)), 'confirmed by its own row').toBe(false);
    expect(groupMember(pass.record, kb)).toBeNull();
  });

  it("G7-10B: a pending write whose own lane could not be read is kept — a clean read of another generation's lane that day proves nothing", async () => {
    let clock = CLOCK;
    const admin = identityFor(0x6f);
    const others = [identityFor(0x80), identityFor(0x81), identityFor(0x82)];
    let failing = '';
    const lane = rosterLane([], [], {
      readRoster: async ({ generation, epochs, adminPublicKeys, onShardFailed }: any) => {
        for (const epoch of epochs) for (const a of adminPublicKeys) {
          if (rosterAddress(a, generation, epoch) === failing) onShardFailed?.(failing, new Error('429'));
        }
        return [];
      },
    });
    const { runtime } = runtimeFor(admin, { now: () => clock, lane });
    const record = await runtime.create({ name: 'two cuts' });
    const id = hex(record.groupId);
    const [kb, kc, kd] = await Promise.all(others.map((who) => keyIn(who, record.groupId)));
    await runtime.admit(id, [seat(others[0], kb), seat(others[1], kc), seat(others[2], kd)]);
    await runtime.remove(id, kb, { cutReading: true });
    await runtime.remove(id, kc, { cutReading: true });
    failing = rosterAddress(record.self!, 0, EPOCH);
    clock = CLOCK + 601;
    const [pass] = await runtime.sync();
    expect(pass.record.pendingControl.some((e: any) => e.kind === GROUP_KIND.REMOVE && Number(e.generation) === 0), 'still waiting for its own lane').toBe(true);
    expect(groupMember(pass.record, kb), 'and the removal stands').toBeNull();
  });

  it('G7-11: a rival rekey that lost does not write its roster key over the winner\'s, and the same rekey read twice resets nothing', async () => {
    const admin = identityFor(0x65);
    const other = identityFor(0x66);
    const victim = identityFor(0x67);
    const rows: any[] = [];
    const { runtime } = runtimeFor(admin, { lane: rosterLane(rows) });
    const record = await runtime.create({ name: 'race' });
    const id = hex(record.groupId);
    const [ko, kv] = await Promise.all([keyIn(other, record.groupId), keyIn(victim, record.groupId)]);
    await runtime.admit(id, [seat(other, ko), seat(victim, kv)]);
    await runtime.setAdmins(id, [record.self!, ko]);
    const removed = await runtime.remove(id, kv, { cutReading: true });
    const mine = removed.pendingControl.find((e: any) => e.kind === GROUP_KIND.REMOVE && e.rekey);
    const ownKey = removed.epochs.find((e: any) => e.generation === 1).key;
    const toMe = [{ groupKey: record.self!, x25519PublicKey: admin.x25519PublicKey, mlKem768PublicKey: admin.mlKem768PublicKey }];
    rows.push(controlRow(GROUP_KIND.REMOVE, record.self!, {
      groupKey: kv, generation: 1, envelope: await sealGroupRekeyEnvelope({ groupId: record.groupId, generation: 1, newKey: ownKey, members: toMe }),
    }, { seq: Number(mine.seq), at: CLOCK }));
    rows.push(controlRow(GROUP_KIND.REMOVE, ko, {
      groupKey: kv, generation: 1, envelope: await sealGroupRekeyEnvelope({ groupId: record.groupId, generation: 1, newKey: bytes(0x7d), members: toMe }),
    }, { seq: 1, at: CLOCK + 100 }));
    const [pass] = await runtime.sync();
    const winner = await groupRosterKey({ key: ownKey, groupId: record.groupId, generation: 1 });
    expect(holdsGroupGeneration(pass.record, 1, ownKey), 'the earlier row holds the generation').toBe(true);
    expect(holdsGroupGeneration(pass.record, 1, bytes(0x7d))).toBe(false);
    expect(hex(groupRosterKeyFor(pass.record, 1)), "and the generation's roster key is the winner's").toBe(hex(winner));
    const snapped = await runtime.ensureSnapshot(id);
    expect(snapped.snapshot).toBeTruthy();
    const [again] = await runtime.sync();
    expect(again.record.snapshot, 'the same rekey read again resets nothing').toBeTruthy();
    expect(again.record.rosterCursor).toBe(EPOCH);
  });

  it('G7-12: a room this device left publishes nothing and admits nobody — and is read a quarter of an hour for its own last rows', async () => {
    let clock = CLOCK;
    const guest = identityFor(0x69);
    const rows: any[] = [];
    const me = identityFor(0x68);
    const own: any[] = [];
    const { runtime, sent } = runtimeFor(me, {
      now: () => clock,
      lane: rosterLane(rows, [], { read: async () => own }),
    });
    const record = await runtime.create({ name: 'gone' });
    const id = hex(record.groupId);
    await runtime.noteInvite(id, { wallet: guest.wallet, keyId: guest.keyId, name: guest.name });
    const guestSide = runtimeFor(guest);
    await guestSide.runtime.adopt(runtime.secretFor(id));
    const token = parseGroupJoinToken(guestSide.runtime.joinTokenFor(id))!;
    await runtime.leave(id);
    const paid = sent.length;
    expect(await runtime.noteCandidate(id, token), 'the invitee answers after the leave: nobody is admitted').toBe(runtime.get(id));
    expect(runtime.get(id).candidates ?? [], 'nor noted as waiting').toEqual([]);
    expect(await runtime.leave(id), 'leaving twice says nothing').toBe(runtime.get(id));
    for (const act of [
      () => runtime.say(id, 'still here?'), () => runtime.admit(id, [token]), () => runtime.ensureSnapshot(id), () => runtime.setName(id, 'renamed'),
      () => runtime.noteInvite(id, { wallet: guest.wallet }), () => runtime.mute(id, record.self!, { lift: true }),
    ]) await expect(act()).rejects.toThrow(/left the room/);
    expect(sent.length, 'not one row paid for').toBe(paid);
    const text = (sender: Uint8Array, at: number, seq: number) => ({ kind: GROUP_KIND.TEXT, senderGroupKey: sender, epoch: EPOCH, generation: 0, seq, payload: { text: `t${seq}`, sentAt: at }, sentAt: at, createdAt: at });
    own.push(text(record.self!, CLOCK - 5, 1), text(token.groupKey, CLOCK - 3, 1), text(token.groupKey, CLOCK + 60, 2));
    clock = CLOCK + 120;
    const [pass] = await runtime.sync();
    expect(pass.messages.map((m: any) => m.payload.text)).toEqual(['t1', 't1']);
    expect(sent.length).toBe(paid);
    clock = CLOCK + GROUP_LEFT_READ_S + 1;
    expect(await runtime.sync(), 'after it, the room is history').toEqual([]);
  });

  it('G7-12B: the reads after a leave ask the chain nothing about the door', async () => {
    let clock = CLOCK;
    const asked: number[] = [];
    const stranger = identityFor(0x83);
    const { runtime } = runtimeFor(identityFor(0x84), { now: () => clock, lane: rosterLane([]), readEntryPayment: async () => { asked.push(clock); return { paid: false }; } });
    const record = await runtime.create({ name: 'door' });
    const id = hex(record.groupId);
    await runtime.setEntryFee(id, '2000000000');
    const side = runtimeFor(stranger);
    await side.runtime.adopt(runtime.secretFor(id));
    await runtime.noteCandidate(id, parseGroupJoinToken(side.runtime.joinTokenFor(id))!);
    await runtime.leave(id);
    clock = CLOCK + 120;
    expect(await runtime.sync()).toHaveLength(1);
    expect(asked, 'the one question asked before the leave').toEqual([CLOCK]);
  });

  it('G7-13: a muted member\'s row is refused before it is paid for', async () => {
    const people = { owner: identityFor(0x6a), me: identityFor(0x6b) };
    const { keys, record, id } = await room(people, { self: 'me', owner: 'owner', admins: ['owner'], members: ['owner', 'me'] });
    const { runtime, sent } = await onDevice(people.me, { ...record, muted: [keys.me] });
    await expect(runtime.say(id, 'hello?')).rejects.toThrow(/muted/);
    expect(sent.length).toBe(0);
    const free = await onDevice(people.me, record);
    await free.runtime.say(id, 'hello');
    expect(free.sent.length, 'the same device unmuted sends').toBe(1);
  });

  it('G7-14: a record that did not change is not written again', async () => {
    const puts: string[] = [];
    const store = createMemoryGroupRecordStore();
    const counted = { ...store, put: async (id: string, value: any) => { puts.push(id); return store.put(id, value); } };
    const { runtime } = runtimeFor(identityFor(0x6c), { store: counted, lane: rosterLane([]) });
    await runtime.create({ name: 'quiet' });
    await runtime.sync();
    const settled = puts.length;
    await runtime.sync();
    await runtime.sync();
    expect(puts.length, 'two quiet passes write nothing').toBe(settled);
    await runtime.setName(hex(runtime.list()[0].groupId), 'renamed');
    expect(puts.length, 'a change is written').toBe(settled + 1);
  });

  it("G7-15: a stranger's payment is asked about on a doubling interval, not on every pass", async () => {
    let clock = CLOCK;
    const owner = identityFor(0x6d);
    const stranger = identityFor(0x6e);
    const asked: number[] = [];
    const { runtime } = runtimeFor(owner, { now: () => clock, lane: rosterLane([]), readEntryPayment: async () => { asked.push(clock); return { paid: false }; } });
    const record = await runtime.create({ name: 'door' });
    const id = hex(record.groupId);
    await runtime.setEntryFee(id, '2000000000');
    const side = runtimeFor(stranger);
    await side.runtime.adopt(runtime.secretFor(id));
    await runtime.noteCandidate(id, parseGroupJoinToken(side.runtime.joinTokenFor(id))!);
    expect(asked).toEqual([CLOCK]);
    for (const at of [CLOCK + 12, CLOCK + 24, CLOCK + 30, CLOCK + 42, CLOCK + 89, CLOCK + 90, CLOCK + 150, CLOCK + 210]) { clock = at; await runtime.sync(); }
    expect(asked, 'at 30 s, then 60 s after that, then 120 s').toEqual([CLOCK, CLOCK + 30, CLOCK + 90, CLOCK + 210]);
  });
});

describe('R7 — the key owed to a person let in through the door', () => {
  it('G7-16: an admission without an invite owes the room\'s key; an invitee is owed nothing; the note is kept, told, cleared and taken back', async () => {
    const owner = identityFor(0x71);
    const asker = identityFor(0x72);
    const guest = identityFor(0x73);
    const told: any[] = [];
    let lockHeld = false;
    const store = createMemoryGroupRecordStore();
    const { runtime } = runtimeFor(owner, { store, onAdmitted: (event: any) => { told.push({ ...event, lockHeld }); } });
    const record = await runtime.create({ name: 'the door' });
    const id = hex(record.groupId);
    const ka = await keyIn(asker, record.groupId);
    lockHeld = true;
    const admitted = await runtime.admit(id, [seat(asker, ka)]);
    lockHeld = false;
    expect(admitted.accessOwed.map((o: any) => o.groupKey)).toEqual([hex(ka)]);
    expect(told, 'told only after the admission returned — the handover takes the lock').toEqual([]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(told).toEqual([{ groupId: id, lockHeld: false }]);
    expect(runtime.accessOwed()).toMatchObject([{ groupId: id, groupKeyHex: hex(ka), wallet: asker.wallet, keyId: asker.keyId, member: true }]);
    expect(parseGroupInviteToken(encodeGroupInviteToken(runtime.secretFor(id, { admitted: true })))!.admitted).toBe(true);
    expect(parseGroupInviteToken(encodeGroupInviteToken(runtime.secretFor(id)))!.admitted).toBe(false);
    expect(parseGroupRecord(await store.get(id)).accessOwed.map((o: any) => o.groupKey)).toEqual([hex(ka)]);
    await runtime.noteAccessSent(id, ka);
    expect(runtime.accessOwed()).toEqual([]);
    expect(parseGroupRecord(await store.get(id)).accessOwed).toEqual([]);
    await runtime.noteInvite(id, { wallet: guest.wallet, keyId: guest.keyId, name: guest.name });
    const guestSide = runtimeFor(guest);
    await guestSide.runtime.adopt(runtime.secretFor(id));
    const seated = await runtime.noteCandidate(id, parseGroupJoinToken(guestSide.runtime.joinTokenFor(id))!);
    expect(groupMember(seated, await keyIn(guest, record.groupId))).toBeTruthy();
    expect(runtime.accessOwed()).toEqual([]);
    const late = identityFor(0x74);
    const kl = await keyIn(late, record.groupId);
    const withLate = await runtime.admit(id, [seat(late, kl)]);
    const entry = withLate.pendingControl.find((e: any) => e.kind === GROUP_KIND.ADMIT && (e.members ?? []).some((m: any) => m.groupKey === hex(kl)));
    const undone = settlePendingControl(withLate, { rosterRows: [], cleanLanes: new Set([`${entry.generation}.${entry.epoch}`]), nowSec: CLOCK + 601 }).record;
    expect(undone.accessOwed).toEqual([]);
  });

  it('G7-17: the app hands the key over — a fresh snapshot, the marked token, the note cleared before the send; nobody gone is sent anything', async () => {
    const owner = identityFor(0x75);
    const asker = identityFor(0x76);
    const leaver = identityFor(0x77);
    const { runtime, sent } = runtimeFor(owner);
    const record = await runtime.create({ name: 'the door' });
    const id = hex(record.groupId);
    const [ka, kl] = await Promise.all([keyIn(asker, record.groupId), keyIn(leaver, record.groupId)]);
    await runtime.admit(id, [seat(asker, ka), seat(leaver, kl)]);
    await runtime.remove(id, kl, { cutReading: false });
    const events: string[] = [];
    const tokens: any[] = [];
    const realNote = runtime.noteAccessSent;
    runtime.noteAccessSent = async (...args: any[]) => { events.push(`noted ${hex(args[1]).slice(0, 4)}`); return realNote(...args); };
    const peer = { id: 'dm:asker', messages: [] as any[] };
    let fakeNow = 1_000_000;
    let threadFor = (owed: any) => (owed.wallet === asker.wallet ? peer : null);
    const env: Record<string, any> = {
      groupRuntimeInstance: runtime, walletSessionGeneration: 1,
      groupSelfIsAdmin: () => true, encodeGroupInviteToken,
      groupAccessThreadFor: (owed: any) => threadFor(owed),
      sendGroupTokenMessage: async (thread: any, token: string) => { events.push('sent'); tokens.push({ thread, token }); },
      noteTonRpcRateLimit: () => false, console: { warn: () => {} }, Date: { now: () => fakeNow },
    };
    const drain = appFunctions(env, [line('const GROUP_ACCESS_RETRY_MS = '), line('const groupAccessTriedAt = '), fn('async function drainGroupAccessOwedUnguarded() {')], 'drainGroupAccessOwedUnguarded');
    const snapshotsBefore = sent.length;
    await drain();
    expect(events, 'the asker noted before the send, the removed person forgotten and sent nothing').toEqual([`noted ${hex(ka).slice(0, 4)}`, 'sent', `noted ${hex(kl).slice(0, 4)}`]);
    expect(sent.length, 'a fresh snapshot first — the key must point at a roster they can read').toBeGreaterThan(snapshotsBefore);
    const handed = parseGroupInviteToken(tokens[0].token)!;
    expect(tokens[0].thread).toBe(peer);
    expect(handed.admitted).toBe(true);
    expect(handed.groupId).toBe(id);
    expect(handed.snapshot, 'pointing at the snapshot just taken').toBeTruthy();
    expect(runtime.accessOwed()).toEqual([]);
    const late = identityFor(0x78);
    const kLate = await keyIn(late, record.groupId);
    await runtime.admit(id, [seat(late, kLate)]);
    events.length = 0;
    await drain();
    expect(events, 'no conversation to hand it over in: nothing noted, nothing sent').toEqual([]);
    expect(runtime.accessOwed()).toHaveLength(1);
    threadFor = () => peer;
    fakeNow += 60_000;
    await drain();
    expect(events, 'a minute later the gap still holds').toEqual([]);
    fakeNow += 5 * 60_000;
    await drain();
    expect(events).toEqual([`noted ${hex(kLate).slice(0, 4)}`, 'sent']);
    expect(runtime.accessOwed()).toEqual([]);
  });

  it('G7-18: the conversation a key goes to — the one the request came in, found by wallet or by key id, made (never opened) when missing', () => {
    const existing = { id: 'dm:1', convPeerKeyId: 'key-1' };
    const threads: any[] = [existing];
    const env: Record<string, any> = {
      threads, Date,
      createRecipientThread: (wallet: string) => (wallet.startsWith('0:') ? { ok: true, thread: { id: `dm:${wallet}`, wallet } } : { ok: false }),
      findExistingRecipientThread: (thread: any) => (thread.wallet === '0:known' ? existing : null),
      isGroupThread: () => false, isSavedMessagesThread: () => false,
    };
    const find = appFunctions(env, [fn('function groupAccessThreadFor(owed) {')], 'groupAccessThreadFor');
    expect(find({ wallet: '0:known' })).toBe(existing);
    const made = find({ wallet: '0:new' });
    expect(made.id).toBe('dm:0:new');
    expect(threads, 'made and listed').toContain(made);
    expect(find({ wallet: null, keyId: 'key-1' })).toBe(existing);
    expect(find({ wallet: null, keyId: null })).toBeNull();
    expect(code(fn('function groupAccessThreadFor(owed) {'))).not.toMatch(/activeThreadId|openGroupThread|selectOrCreate/);
  });
});

describe('R7 — the app around a private room', () => {
  it('G7-19: a token is retried like a message — a failed first attempt goes on the ladder or to the recovery a typed message shows, never thrown', async () => {
    const calls: string[] = [];
    const build = (error: any) => appFunctions({
      localMessageOrderFields: () => ({}), insertThreadMessage: (t: any, m: any) => { t.messages.push(m); },
      refreshThreadAfterMessageChange: () => {}, renderThreads: () => {}, renderConversation: () => {},
      enqueueOutgoingPublish: (task: any) => task(), attemptPrivateComposerMessagePublish: async () => { throw error; },
      noteTonRpcRateLimit: () => false, isRecoverablePrivateSendError: (e: any) => e.recoverable === true,
      schedulePrivateSendRetry: (context: any) => { calls.push(`retry ${context.text}`); },
      markPrivateMessageManualRecovery: (context: any, e: any, meta: string) => { calls.push(`recovery ${context.text} ${meta}`); },
      privateSendBlockedStatusText: () => 'blocked',
      holdLiveSend: () => () => {},
      currentPrivateSenderOptions: () => ({ includeSenderWalletMetadata: true }),
    }, [fn('async function sendGroupTokenMessage(peerThread, token, { pricedGeneration = null } = {}) {')], 'sendGroupTokenMessage');
    const thread = { messages: [] as any[] };
    await expect(build(Object.assign(new Error('429'), { recoverable: true }))(thread, 'TOKEN-A')).resolves.toBeUndefined();
    await expect(build(new Error('no GRAM'))(thread, 'TOKEN-B')).resolves.toBeUndefined();
    expect(calls).toEqual(['retry TOKEN-A', 'recovery TOKEN-B blocked']);
    expect(thread.messages.map((m: any) => m.text)).toEqual(['TOKEN-A', 'TOKEN-B']);
  });

  it('G7-20: the key of a room already entered is taken without a paid answer; an invitation is still answered', async () => {
    const answered: string[] = [];
    const peer = { id: 'dm:admin' };
    const accept = appFunctions({
      ensureGroupRuntime: async () => ({ get: () => null, adopt: async () => ({ groupId: new Uint8Array(32) }), joinTokenFor: () => 'JOIN' }),
      threads: [peer], activeThreadId: peer.id, isGroupThread: () => false,
      groupIdOnOtherLane: async () => false,
      sendGroupTokenMessage: async (thread: any, token: string) => { answered.push(`${thread.id} ${token}`); },
      ensureGroupThread: () => ({}), refreshThreadAfterMessageChange: () => {}, openGroupThread: () => {}, t: (k: string) => k, console: { warn: () => {} },
    }, [fn('async function acceptGroupInvite(secret, button, { pricedGeneration = null } = {}) {')], 'acceptGroupInvite');
    await accept({ groupId: 'aa'.repeat(32), admitted: true }, null);
    expect(answered, 'let in already: nothing to answer').toEqual([]);
    await accept({ groupId: 'aa'.repeat(32) }, null);
    expect(answered).toEqual(['dm:admin JOIN']);
  });

  it('G7-21: the composer refuses a muted or banned member\'s row whatever submitted it — the button, or Ctrl+Enter past it', async () => {
    const inserted: any[] = [];
    const said: string[] = [];
    const status = { textContent: '', dataset: {} as any };
    const build = ({ muted = false, banned = false }) => appFunctions({
      groupIdOfThread: () => 'gid', ensurePublicGroupRuntime: async () => null,
      ensureGroupRuntime: async () => ({ get: () => ({ self: new Uint8Array(32) }), say: async (_: string, text: string) => { said.push(text); return { epoch: 1, generation: 0, firstSeq: 1, record: null }; } }),
      groupSelfIsBanned: () => banned, groupSelfIsMuted: () => muted, privateComposerCostStatus: status, t: (k: string) => k,
      insertThreadMessage: (_: any, m: any) => { inserted.push(m); }, localMessageOrderFields: () => ({}), messageInput: { value: '' },
      refreshThreadAfterMessageChange: () => {}, focusComposerField: () => {}, renderThreads: () => {}, renderConversation: () => {},
      persistMessageToEncryptedHistory: async () => {}, scheduleGroupEchoConfirmChecks: () => {}, ensureGroupThread: () => ({}),
      updateMessageInEncryptedHistory: async () => {}, forgetMessageFromHistory: async () => {},
      noteTonRpcRateLimit: () => false, console: { warn: () => {} }, ownSendPendingRender: false, rawWalletAddress: () => null, plathoWallet: null,
      awaitWalletChainClock: async () => {},
      holdLiveSend: () => () => {},
      walletSessionGeneration: 1,
    }, [fn('function sameWalletSessionAsPress(pressSession, pressWallet) {'), fn('async function sendGroupMessageFromComposer(thread, text) {')], 'sendGroupMessageFromComposer');
    await build({ muted: true })({ messages: [] }, 'hush');
    expect(status.textContent).toBe('composer.mutedInGroup');
    await build({ banned: true })({ messages: [] }, 'hush');
    expect(status.textContent).toBe('composer.bannedInGroup');
    expect(inserted, 'no bubble').toEqual([]);
    expect(said, 'no row').toEqual([]);
    await build({})({ messages: [] }, 'hello');
    expect(said, 'the same path unmuted sends — the refusal is not the stubs').toEqual(['hello']);
  });

  it('G7-23: an echo in a room left long ago is aged — it stayed "sending" for ever and kept the confirm ladder asking', async () => {
    const groupId = 'ab'.repeat(32);
    const now = 1_900_000_000_000;
    const echo = { type: 'out', meta: 'sending', groupSentAtMs: now - 11 * 60_000 };
    const fresh = { type: 'out', meta: 'sending', groupSentAtMs: now - 60_000 };
    const thread = { id: `group:${groupId}`, messages: [echo, fresh] };
    const left = { groupId: new Uint8Array(32).fill(0xab), leftAt: 1 };
    const runtime = { sync: async (options: any) => { expect(typeof options?.deliver, 'the pass is handed a delivery').toBe('function'); return []; }, list: () => [left], accessOwed: () => [] };
    let painted = 0;
    const pass = appFunctions({
      ensureGroupRuntime: async () => runtime, groupRuntimeInstance: runtime, threads: [thread], GROUP_THREAD_PREFIX: 'group:',
      GROUP_ECHO_CONFIRM_MS: 10 * 60_000, Date: { now: () => now }, refreshThreadAfterMessageChange: () => {},
      renderThreads: () => { painted += 1; }, renderConversation: () => {}, drainGroupAccessOwed: () => {},
      noteTonRpcRateLimit: () => false, console: { warn: () => {} },
      deliverPrivateGroupPass: async () => ({ added: 0, stored: true }),
      groupStatesPass: null, publicAddrKey: (a: any) => String(a),
      privateRoomBook: { due: (ids: string[]) => ids, hint: () => [], begin() {}, end() {}, claim() {}, note() {}, askedAll: () => new Set(),
        askedKeys: () => new Set(), takeAskedChange: () => null },
      persistLaneRecordSoon: () => {}, GROUP_LANE_ASKED_RECORD: 'roomsAsked',
      quietAddressesPerMinute: () => Infinity,
      bytesToHex: (bytes: Uint8Array) => Buffer.from(bytes).toString('hex'), groupRoomsAwake: () => new Set(),
      persistLaneMarksSoon: () => {}, GROUP_LANE_MARKS_RECORD: 'rooms', groupRuntimeLanes: new WeakMap(), groupPersistFailures: 0,
      epochFromCreatedAtSeconds: () => 20734, chainNowSec: () => Math.floor(now / 1000),
    }, [fn('function ageLeftGroupEchoes(records, passes) {'), fn('async function syncPrivateGroupsFromChainUnguarded() {')], 'syncPrivateGroupsFromChainUnguarded');
    await pass();
    expect(echo.meta).toBe('not delivered');
    expect(fresh.meta, 'one still inside the confirm window is left alone').toBe('sending');
    expect(painted).toBe(1);
  });

  it('G7-22: the card and the list say which token it is; the members card offers a removal only where every reader applies it; the handover is wired', () => {
    const title = appFunctions({ t: (k: string, v: any) => `${k}:${v?.name}` }, [fn('function groupInviteTitleText(invite, mine) {')], 'groupInviteTitleText');
    expect(title({ name: 'R', admitted: true }, false)).toBe('group.admittedReceived:R');
    expect(title({ name: 'R', admitted: true }, true)).toBe('group.admittedSentTo:R');
    expect(title({ name: 'R' }, false)).toBe('group.inviteReceived:R');
    expect(code(fn('function buildGroupInviteCard(secret, mine) {'))).toContain('title.textContent = groupInviteTitleText(secret, mine);');
    expect(code(fn('function groupTokenPreviewText(message) {'))).toContain("if (invite) return groupInviteTitleText(invite, message.type === 'out');");
    expect(code(fn('async function openGroupMembersDialog(groupId) {'))).toContain('if (amAdmin && key !== mine && !isOwner && !member.unseated && (amOwner || !isAdmin)) { const remove = actionButton(');
    expect(code(fn('async function buildGroupRuntime() {'))).toContain('onAdmitted: () => { void drainGroupAccessOwed(); },');
    expect(code(fn('async function syncPrivateGroupsFromChainUnguarded() {'))).toContain("if (typeof runtime.accessOwed === 'function' && runtime.accessOwed().length > 0) void drainGroupAccessOwed();");
  });
});

describe('R7 — an invitee let in after the room changed its keys', () => {
  async function invitedBeforeARekey({ firstPass = true, guestExtra = {} }: { firstPass?: boolean; guestExtra?: any } = {}) {
    const clock = { now: CLOCK };
    const now = () => clock.now;
    const admin = identityFor(0x91);
    const guest = identityFor(0x92);
    const gone = identityFor(0x93);
    const A = runtimeFor(admin, { now });
    const founded = await A.runtime.create({ name: 'the room' });
    const id = hex(founded.groupId);
    const kA = founded.self!;
    const [kGone, kGuest] = await Promise.all([keyIn(gone, founded.groupId), keyIn(guest, founded.groupId)]);
    await A.runtime.admit(id, [seat(gone, kGone)]);
    const snapped = await A.runtime.ensureSnapshot(id);
    const invite = A.runtime.secretFor(id);
    await A.runtime.noteInvite(id, { wallet: guest.wallet, keyId: guest.keyId, name: guest.name, generation: invite.generation, epoch: invite.epoch });
    const rosterRow = (record: any, generation: number) => ({
      address: rosterAddress(kA, generation, record.snapshot.epoch), epoch: record.snapshot.epoch, generation, seq: record.snapshot.seq, parts: 1,
      kind: GROUP_KIND.ROSTER, senderGroupKey: kA, sentAt: now(), createdAt: now(), roster: true,
      payload: decodeGroupPayload(GROUP_KIND.ROSTER, encodeGroupRoster({ members: record.members, admins: record.admins, owner: record.owner, name: record.name, sentAt: now() })),
    });
    const snapshots: any[] = [rosterRow(snapped, 0)];
    const asked: any[] = [];
    const lane = rosterLane([], [], {
      readSnapshot: async ({ rosterKey, pointer }: any) => {
        asked.push({ rosterKey: hex(rosterKey), generation: pointer.generation, seq: pointer.seq });
        return snapshots.find((row) => row.generation === pointer.generation && row.seq === pointer.seq) ?? null;
      },
    });
    const B = runtimeFor(guest, { lane, now, ...guestExtra });
    await B.runtime.adopt(invite, { from: admin.wallet });
    if (firstPass) {
      await B.runtime.sync();
      expect(B.runtime.get(id)!.members.map((m: any) => m.wallet), 'the snapshot is read: the admin stands with a wallet').toContain(admin.wallet);
    }
    await A.runtime.remove(id, kGone, { cutReading: true });
    const admitAndHandOver = async () => {
      await A.runtime.noteCandidate(id, parseGroupJoinToken(B.runtime.joinTokenFor(id))!);
      const owed = A.runtime.accessOwed().filter((o: any) => o.groupKeyHex === hex(kGuest));
      const record = await A.runtime.ensureSnapshot(id);
      const handover = parseGroupInviteToken(encodeGroupInviteToken(A.runtime.secretFor(id, { admitted: true, since: owed[0]?.since ?? null })))!;
      return { owed, record, handover };
    };
    return { admin, guest, gone, A, B, id, kA, kGone, kGuest, invite, snapshots, rosterRow, asked, clock, admitAndHandOver };
  }

  it('G7-24: an invitee admitted after the room changed its keys is owed the new key, and their device takes it and reads itself in', async () => {
    const s = await invitedBeforeARekey();
    expect(currentGroupEpoch(s.B.runtime.get(s.id)!).generation, 'the guest holds the generation the invite carried').toBe(0);
    const { owed, record: snapped, handover } = await s.admitAndHandOver();
    expect(groupMember(s.A.runtime.get(s.id)!, s.kGuest), 'admitted — into generation 1').toBeTruthy();
    expect(currentGroupEpoch(s.A.runtime.get(s.id)!).generation).toBe(1);
    expect(owed).toMatchObject([{ groupId: s.id, groupKeyHex: hex(s.kGuest), wallet: s.guest.wallet, since: s.invite.epoch, member: true }]);
    expect(handover).toMatchObject({ groupId: s.id, generation: 1, admitted: true });
    expect(handover.snapshot, 'pointing at a snapshot of the new generation').toMatchObject({ generation: 1, seq: snapped.snapshot!.seq });
    const taken = await s.B.runtime.adopt(handover, { from: s.admin.wallet });
    const head = currentGroupEpoch(taken);
    expect(head.generation, 'the held room moves to the new generation').toBe(1);
    expect(hex(head.key)).toBe(hex(currentGroupEpoch(s.A.runtime.get(s.id)!).key));
    expect(hex(groupRosterKeyFor(taken, 1))).toBe(hex(groupRosterKeyFor(s.A.runtime.get(s.id)!, 1)));
    expect(taken.epochs.some((e: any) => e.generation === 0), 'the old generation\'s days stay beside it').toBe(true);
    expect(taken.snapshot).toMatchObject({ generation: 1, seq: snapped.snapshot!.seq });
    expect(taken.snapshotApplied).toBe(false);
    s.snapshots.push(s.rosterRow(snapped, 1));
    await s.B.runtime.sync();
    expect(s.asked.at(-1)).toEqual({ rosterKey: hex(groupRosterKeyFor(snapped, 1)), generation: 1, seq: snapped.snapshot!.seq });
    const seated = s.B.runtime.get(s.id)!;
    expect(seated.snapshotApplied).toBe(true);
    expect(groupMember(seated, s.kGuest), 'the guest reads themself in').toBeTruthy();
    expect(await s.B.runtime.adopt(handover, { from: s.admin.wallet })).toBe(seated);
    const second = identityFor(0x95);
    const again = await s.A.runtime.ensureSnapshot(s.id);
    const inviteNow = s.A.runtime.secretFor(s.id);
    await s.A.runtime.noteInvite(s.id, { wallet: second.wallet, keyId: second.keyId, name: second.name, generation: inviteNow.generation, epoch: inviteNow.epoch });
    const secondSide = runtimeFor(second);
    await secondSide.runtime.adopt(inviteNow);
    await s.A.runtime.noteCandidate(s.id, parseGroupJoinToken(secondSide.runtime.joinTokenFor(s.id))!);
    expect(groupMember(s.A.runtime.get(s.id)!, await keyIn(second, again.groupId))).toBeTruthy();
    expect(s.A.runtime.accessOwed().map((o: any) => o.groupKeyHex), 'the invite\'s key still opens the room').not.toContain(hex(await keyIn(second, again.groupId)));
  });

  it('G7-25: a newer key is taken only from an admin of the room as its roster names them — and only when it is newer and whole', async () => {
    const notes: string[] = [];
    const s = await invitedBeforeARekey({ guestExtra: { onError: (where: string) => { notes.push(where); } } });
    const { handover } = await s.admitAndHandOver();
    const held = s.B.runtime.get(s.id)!;
    const stranger = identityFor(0x94);
    notes.length = 0;
    expect(await s.B.runtime.adopt(s.invite, { from: stranger.wallet })).toBe(held);
    expect(await s.B.runtime.adopt({ ...s.invite, rosterKey: null }, { from: s.admin.wallet })).toBe(held);
    expect(notes, 'nothing said about a key already held').toEqual([]);
    for (const from of [stranger.wallet, s.gone.wallet, null, '']) {
      expect(await s.B.runtime.adopt(handover, { from }), `from ${from}`).toBe(held);
    }
    expect(await s.B.runtime.adopt({ ...handover, key: 'ab'.repeat(32), rosterKey: 'cd'.repeat(32), generation: 7 }, { from: stranger.wallet })).toBe(held);
    expect(notes).toContain('handover');
    expect(await s.B.runtime.adopt(s.invite, { from: s.admin.wallet })).toBe(held);
    expect(await s.B.runtime.adopt({ ...handover, rosterKey: null }, { from: s.admin.wallet })).toBe(held);
    expect(await s.B.runtime.adopt({ ...handover, key: 'zz'.repeat(32) }, { from: s.admin.wallet })).toBe(held);
    expect(await s.B.runtime.adopt({ ...handover, rosterKey: 'ab'.repeat(31) }, { from: s.admin.wallet })).toBe(held);
    expect(currentGroupEpoch(s.B.runtime.get(s.id)!).generation, 'nothing moved').toBe(0);
    expect(currentGroupEpoch(await s.B.runtime.adopt(handover, { from: s.admin.wallet })).generation).toBe(1);
  });

  it('G7-25B: the admin is found by the app\'s own comparison of wallets — a raw address and a friendly form are one wallet', async () => {
    const friendly = (w: string) => `friendly:${w}`;
    const s = await invitedBeforeARekey({ guestExtra: { sameWallet: (a: string, b: string) => a.replace(/^friendly:/, '') === b.replace(/^friendly:/, '') } });
    const { handover } = await s.admitAndHandOver();
    expect(currentGroupEpoch(await s.B.runtime.adopt(handover, { from: friendly(s.admin.wallet) })).generation).toBe(1);
  });

  it('G7-26: a newer key that arrives before the room\'s roster was ever read waits for the pass that reads it — and only an admin\'s is taken then', async () => {
    const s = await invitedBeforeARekey({ firstPass: false });
    const { handover } = await s.admitAndHandOver();
    const stranger = identityFor(0x96);
    const unread = s.B.runtime.get(s.id)!;
    expect(unread.snapshotApplied, 'the first pass has not run').toBe(false);
    expect(await s.B.runtime.adopt(handover, { from: s.admin.wallet }), 'nothing to judge it by yet').toBe(unread);
    expect(await s.B.runtime.adopt({ ...handover, key: 'ab'.repeat(32), rosterKey: 'cd'.repeat(32), generation: 9 }, { from: stranger.wallet })).toBe(unread);
    expect(currentGroupEpoch(s.B.runtime.get(s.id)!).generation).toBe(0);
    await s.B.runtime.sync();
    const after = s.B.runtime.get(s.id)!;
    expect(currentGroupEpoch(after).generation, 'the pass read the roster, and the admin\'s key was taken').toBe(1);
    expect(hex(groupRosterKeyFor(after, 1))).toBe(hex(groupRosterKeyFor(s.A.runtime.get(s.id)!, 1)));
    await s.B.runtime.sync();
    expect(currentGroupEpoch(s.B.runtime.get(s.id)!).generation).toBe(1);
  });

  it('G7-27: the handed key starts on the day of the invite, never earlier — and a person let in without an invite is handed today', async () => {
    const s = await invitedBeforeARekey();
    s.clock.now = CLOCK + 2 * DAY;
    const { owed, handover } = await s.admitAndHandOver();
    expect(owed[0].since).toBe(EPOCH);
    expect(handover.epoch, 'the first day of the new generation, which is the invite\'s day').toBe(EPOCH);
    const record = s.A.runtime.get(s.id)!;
    const dayKey = (epoch: number) => hex(record.epochs.find((e: any) => e.generation === 1 && e.epoch === epoch)!.key);
    expect(handover.key).toBe(dayKey(EPOCH));
    expect(s.A.runtime.secretFor(s.id, { admitted: true, since: EPOCH + 1 }).epoch).toBe(EPOCH + 1);
    expect(s.A.runtime.secretFor(s.id, { admitted: true, since: EPOCH + 1 }).key).toBe(dayKey(EPOCH + 1));
    expect(s.A.runtime.secretFor(s.id, { admitted: true }).epoch).toBe(EPOCH + 2);
    expect(s.A.runtime.secretFor(s.id).epoch).toBe(EPOCH + 2);
    const taken = await s.B.runtime.adopt(handover, { from: s.admin.wallet });
    expect(currentGroupEpoch(taken)).toMatchObject({ generation: 1, epoch: EPOCH });
    await s.B.runtime.sync();
    const walked = s.B.runtime.get(s.id)!;
    expect(hex(walked.epochs.find((e: any) => e.generation === 1 && e.epoch === EPOCH + 2)!.key)).toBe(dayKey(EPOCH + 2));
    expect(walked.epochs.filter((e: any) => e.generation === 1).map((e: any) => e.epoch).sort(), 'every day from the invite\'s is readable').toEqual([EPOCH, EPOCH + 1, EPOCH + 2]);
  });

  it('G7-28: the app takes a handed key the moment it arrives, from the conversation\'s own wallet, and says which keys an invite carried', async () => {
    const calls: string[] = [];
    const held = { groupId: new Uint8Array(32), leftAt: null };
    const moved = { groupId: new Uint8Array(32), leftAt: null, moved: true };
    const privateThread = { id: 'dm:wallet_address:admin' };
    const groupThread = { id: 'group:x' };
    const token = encodeGroupInviteToken({ groupId: 'aa'.repeat(32), key: 'bb'.repeat(32), epoch: EPOCH, generation: 1, rosterKey: 'cc'.repeat(32), admitted: true });
    const plain = encodeGroupInviteToken({ groupId: 'aa'.repeat(32), key: 'bb'.repeat(32), epoch: EPOCH, generation: 1, rosterKey: 'cc'.repeat(32) });
    let holds: any = held;
    const runtime = {
      get: () => holds,
      adopt: async (secret: any, options: any) => { calls.push(`adopt g${secret.generation} from ${options?.from}`); return moved; },
    };
    const note = appFunctions({
      parseGroupInviteToken, ensureGroupRuntime: async () => runtime,
      isGroupThread: (t: any) => t === groupThread, isSavedMessagesThread: () => false,
      threadPrimaryWalletRaw: (t: any) => (t === privateThread || t === groupThread ? '0:admin' : null),
      ensureGroupThread: () => 'room-thread', refreshThreadAfterMessageChange: (t: any) => { calls.push(`refresh ${t}`); },
      renderThreads: () => { calls.push('threads'); }, renderConversation: () => { calls.push('conversation'); },
      noteTonRpcRateLimit: () => false, console: { warn: (...args: any[]) => { calls.push(`warn ${args[0]}`); } },
    }, [fn('async function noteGroupHandoverFromText(text, thread) {')], 'noteGroupHandoverFromText');
    await note(token, privateThread);
    expect(calls).toEqual(['adopt g1 from 0:admin', 'refresh room-thread', 'threads', 'conversation']);
    calls.length = 0;
    await note(plain, privateThread);
    await note(token, groupThread);
    await note(token, { id: 'dm:no-wallet' });
    holds = null;
    await note(token, privateThread);
    holds = { ...held, leftAt: 1 };
    await note(token, privateThread);
    expect(calls).toEqual([]);
    const insert = code(fn('function insertThreadMessage(thread, message) {'));
    expect(insert).toContain("if (message?.type === 'in') { const arrivingToken = groupTokenTextOf(message); if (arrivingToken.startsWith(GROUP_INVITE_PREFIX)) void noteGroupHandoverFromText(arrivingToken, thread); }");
    expect(app).toMatch(/import \{[^}]*\bGROUP_INVITE_PREFIX\b[^}]*\} from '\.\/group-protocol\.mjs\?v=\d+';/);
    expect(GROUP_INVITE_PREFIX).toBe('platho.group.invite.v1:');
    const build = code(fn('async function buildGroupRuntime() {'));
    expect(build).toContain('sameWallet: sameWalletAddress,');
    expect(build).toContain('void rescanGroupHandovers(runtime);');
    const rescan = code(fn('async function rescanGroupHandovers(runtime) {'));
    expect(rescan).toContain("if (message?.type !== 'in') continue; const text = groupTokenTextOf(message); if (!text.startsWith(GROUP_INVITE_PREFIX)) continue; await noteGroupHandoverFromText(text, thread);");
    const answered: string[] = [];
    const adopted: any[] = [];
    const accept = appFunctions({
      ensureGroupRuntime: async () => ({ get: () => ({ groupId: new Uint8Array(32), leftAt: null }), adopt: async (secret: any, options: any) => { adopted.push(options?.from ?? null); return { groupId: new Uint8Array(32), taken: true }; }, joinTokenFor: () => 'JOIN' }),
      threads: [privateThread, groupThread], activeThreadId: privateThread.id, isGroupThread: (t: any) => t === groupThread, isSavedMessagesThread: () => false,
      threadPrimaryWalletRaw: (t: any) => (t === privateThread ? '0:admin' : null),
      sendGroupTokenMessage: async (thread: any, tokenText: string) => { answered.push(`${thread.id} ${tokenText}`); },
      ensureGroupThread: (record: any) => (record.taken ? 'taken' : 'held'), refreshThreadAfterMessageChange: () => {},
      openGroupThread: (thread: any) => { answered.push(`open ${thread}`); }, t: (k: string) => k, console: { warn: () => {} },
    }, [fn('async function acceptGroupInvite(secret, button, { pricedGeneration = null } = {}) {')], 'acceptGroupInvite');
    await accept(parseGroupInviteToken(plain), null);
    expect(adopted).toEqual(['0:admin']);
    expect(answered, 'the room is opened as the runtime left it; no answer is paid for').toEqual(['open taken']);
    const invite = code(fn('async function inviteContactToGroup(groupId, peerThread, { pricedGeneration = null } = {}) {'));
    expect(invite).toContain('const secret = runtime.secretFor(groupId); await sendGroupTokenMessage(peerThread, encodeGroupInviteToken(secret), { pricedGeneration });');
    expect(invite).toContain('generation: secret.generation, epoch: secret.epoch,');
    expect(code(fn('async function drainGroupAccessOwedUnguarded() {'))).toContain('runtime.secretFor(owed.groupId, { admitted: true, since: owed.since ?? null })');
  });

  it('G7-29: the store keeps what an invite carried, says when it is behind, finds an admin by wallet, and takes a later generation only whole', async () => {
    const people = { a: identityFor(0x97), b: identityFor(0x98) };
    const r = await room(people, { self: 'b', owner: 'a', admins: ['a'], members: ['a', 'b'] });
    let rec = notePendingGroupInvite(r.record, { wallet: '0:x', keyId: 'k', name: 'x', at: CLOCK, generation: 0, epoch: EPOCH });
    rec = notePendingGroupInvite(rec, { wallet: '0:x', keyId: 'k', name: 'x', at: CLOCK + DAY, generation: 1, epoch: EPOCH + 1 });
    expect(rec.pendingInvites).toEqual([{ wallet: '0:x', keyId: 'k', name: 'x', at: CLOCK, generation: 0, epoch: EPOCH }]);
    expect(parseGroupRecord(serializeGroupRecord(rec)).pendingInvites, 'kept across the store').toEqual(rec.pendingInvites);
    expect(notePendingGroupInvite(r.record, { wallet: '0:z', at: CLOCK, generation: -1, epoch: 'soon' as any }).pendingInvites[0], 'a number that is not a day is not kept')
      .toEqual({ wallet: '0:z', keyId: null, name: null, at: CLOCK });
    expect(pendingInviteBehind(rec.pendingInvites[0], 1)).toBe(EPOCH);
    expect(pendingInviteBehind(rec.pendingInvites[0], 0)).toBeNull();
    expect(pendingInviteBehind({ wallet: '0:y', at: CLOCK + 3 * DAY }, 0)).toBe(EPOCH + 3);
    expect(pendingInviteBehind(null, 1)).toBeNull();
    expect(groupAccessOwedIn([{ groupKey: 'ab'.repeat(32), since: EPOCH }, { groupKey: 'cd'.repeat(32), since: -3 }]).map((o: any) => o.since ?? null)).toEqual([EPOCH, null]);
    expect(groupAdminByWallet(r.record, people.a.wallet)?.wallet).toBe(people.a.wallet);
    expect(groupAdminByWallet(r.record, people.a.wallet.toUpperCase())?.wallet, 'the plain comparison ignores case').toBe(people.a.wallet);
    expect(groupAdminByWallet(r.record, people.b.wallet), 'a member who is no admin').toBeNull();
    expect(groupAdminByWallet(r.record, null)).toBeNull();
    expect(groupAdminByWallet({ ...r.record, members: r.record.members.map((m: any) => ({ ...m, wallet: '' })) }, ''), 'an empty wallet is nobody').toBeNull();
    const key = bytes(0x61);
    const rosterKey = bytes(0x62);
    const cursorAhead = { ...r.record, rosterCursor: EPOCH + 5 };
    expect(catchUpGroupGeneration(cursorAhead, { generation: 0, epoch: EPOCH, key, rosterKey }), 'the generation held is nothing to take').toBe(cursorAhead);
    const pointer = { epoch: EPOCH + 2, generation: 1, admin: r.keys.a, seq: 3, parts: 1, at: 0 };
    const taken = catchUpGroupGeneration(cursorAhead, { generation: 1, epoch: EPOCH + 1, key, rosterKey, snapshot: pointer });
    expect(currentGroupEpoch(taken)).toMatchObject({ generation: 1, epoch: EPOCH + 1 });
    expect(hex(currentGroupEpoch(taken).key)).toBe(hex(key));
    expect(hex(groupRosterKeyFor(taken, 1))).toBe(hex(rosterKey));
    expect(taken.epochs.filter((e: any) => e.generation === 0).length, 'the held generation stays').toBe(r.record.epochs.length);
    expect(taken).toMatchObject({ snapshot: pointer, snapshotApplied: false, admitsSinceSnapshot: 0, rosterCursor: EPOCH + 2 });
    const bare = catchUpGroupGeneration(cursorAhead, { generation: 1, epoch: EPOCH + 1, key, rosterKey, snapshot: { ...pointer, generation: 0 } });
    expect(bare, 'no pointer of the new generation: read from the handed day, nothing to apply').toMatchObject({ snapshot: null, snapshotApplied: true, rosterCursor: EPOCH + 1 });
    expect(() => catchUpGroupGeneration(cursorAhead, { generation: 1, epoch: EPOCH, key, rosterKey: null as any })).toThrow();
    expect(() => catchUpGroupGeneration(cursorAhead, { generation: 1, epoch: EPOCH, key: null as any, rosterKey }), 'a generation without its day key is not taken').toThrow();
  });
});
