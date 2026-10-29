import { describe, expect, it } from 'vitest';
import {
  GROUP_MAX_CANDIDATES, groupRemovedAt, noteGroupCandidatePaid, parseGroupCandidate, serializeGroupCandidate,
  declineGroupCandidate, groupCandidatesWaiting,
  GROUP_HIDDEN_MAX, GROUP_MUTED_MAX, groupRecoveryEntry, groupsRecoveryIsStale, groupsRecoverySecret,
  GROUP_WINDOW_DAYS, adoptGroupGeneration, advanceGroupWindow, applyGroupRows, groupMessageKey, isGroupMuted, createGroupRecord, groupEpochsToRead, markGroupEpochsRead, noteSeenSeq, pruneSeenSeq,
  currentGroupEpoch, groupMemberPublicKeys, groupRemovalPlan, groupRosterKeyFor, isGroupAdmin, nextGroupSeq,
  noteGroupCandidate, noteGroupRosterKey, noteGroupSeq, parseGroupRecord, serializeGroupRecord,
} from '../web/group-store.mjs';
import { GROUP_KIND } from '../web/group-protocol.mjs';
import { groupMember, memberForLog, noteGroupSeqFromRows, notePendingControl, noteRosterSeen, settlePendingControl, snapshotForRevert, snapshotFromRevert, noteSeenSeqs, GROUP_CONTROL_LOG_MAX, GROUP_CONTROL_LOG_MAX_MEMBERS, GROUP_PENDING_INVITES_MAX, GROUP_CONTROL_ABANDON_S, notePendingGroupInvite } from '../web/group-store.mjs';
import { GROUP_MAX_RATCHET_STEPS, createGroupFounding, groupMemberPublicKey, groupMemberSeed } from '../web/crypto/group-lane.mjs';


const DAY = 86_400;
const CLOCK = 1_800_000_000;
const bytes = (fill: number, length = 32) => new Uint8Array(length).fill(fill);
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

async function scene() {
  const founding = await createGroupFounding({ entropy: bytes(0x11), createdAtSec: CLOCK });
  const seedA = await groupMemberSeed({ vaultSeed: bytes(0x22), groupId: founding.groupId });
  const seedB = await groupMemberSeed({ vaultSeed: bytes(0x33), groupId: founding.groupId });
  const pubA = groupMemberPublicKey(seedA);
  const pubB = groupMemberPublicKey(seedB);
  const member = (groupKey: Uint8Array, name: string) => ({
    groupKey, wallet: `0:${'ab'.repeat(32)}`, keyId: `k-${name}`, name,
    x25519PublicKey: bytes(0x60), mlKem768PublicKey: bytes(0x61, 1184),
  });
  const record = createGroupRecord({
    founding, name: 'the kitchen', self: pubA,
    members: [member(pubA, 'Ann'), member(pubB, 'Bo')],
    admins: [pubA],
  });
  return { founding, record, pubA, pubB, member };
}

const row = (over: any) => ({
  address: '0:' + '11'.repeat(32), epoch: 20833, generation: 0, seq: '1', ...over,
});

describe('GROUP-STORE — the window, the seq and what a control message may change', () => {
  it('GS-01: the window walks forward to today, keeps the days it walked through, and prunes the rest', async () => {
    const { record } = await scene();
    expect(currentGroupEpoch(record)!.epoch).toBe(Math.floor(CLOCK / DAY));

    const walked = await advanceGroupWindow(record, CLOCK + 5 * DAY);
    expect(currentGroupEpoch(walked)!.epoch).toBe(Math.floor(CLOCK / DAY) + 5);
    expect(walked.epochs.length).toBe(6);
    expect(walked.epochs.map((e: any) => e.epoch)).toEqual([0, 1, 2, 3, 4, 5].map((d) => Math.floor(CLOCK / DAY) + d));
    expect(new Set(walked.epochs.map((e: any) => hex(e.key))).size).toBe(walked.epochs.length);
    expect(groupEpochsToRead(walked, CLOCK + 5 * DAY).map((e: any) => e.epoch)).toEqual([0, 1, 2, 3, 4, 5].map((d) => Math.floor(CLOCK / DAY) + d));
    const read = markGroupEpochsRead(walked, walked.epochs);
    const pruned = await advanceGroupWindow(read, CLOCK + 5 * DAY);
    expect(pruned.epochs.map((e: any) => e.epoch)).toEqual([2, 3, 4, 5].map((d) => Math.floor(CLOCK / DAY) + d));
    expect(pruned.epochs.length).toBe(GROUP_WINDOW_DAYS + 1);
    const partly = markGroupEpochsRead(walked, walked.epochs.slice(1));
    expect((await advanceGroupWindow(partly, CLOCK + 5 * DAY)).epochs.map((e: any) => e.epoch)).toEqual([0, 2, 3, 4, 5].map((d) => Math.floor(CLOCK / DAY) + d));

    const back = await advanceGroupWindow(walked, CLOCK);
    expect(currentGroupEpoch(back)!.epoch).toBe(currentGroupEpoch(walked)!.epoch);
  });

  it('GS-02: a new generation joins the window beside the old one, so a removal takes effect at once', async () => {
    const { record, founding } = await scene();
    const rekeyed = adoptGroupGeneration(record, { epoch: founding.epoch, generation: 1, key: bytes(0x99) });
    expect(rekeyed.epochs.length).toBe(2);
    expect(currentGroupEpoch(rekeyed)!.generation).toBe(1);
    expect(rekeyed.epochs[0].generation).toBe(0);
    expect(adoptGroupGeneration(rekeyed, { epoch: founding.epoch, generation: 1, key: bytes(0x99) }).epochs.length).toBe(2);
  });

  it('GS-03: the seq is this device\'s own claim, and it only ever moves up', async () => {
    const { record, founding } = await scene();
    expect(nextGroupSeq(record, founding)).toBe(1);
    const after = noteGroupSeq(record, { ...founding, seq: 4 });
    expect(nextGroupSeq(after, founding)).toBe(5);
    expect(nextGroupSeq(noteGroupSeq(after, { ...founding, seq: 2 }), founding), 'a late confirmation cannot lower it').toBe(5);
    expect(nextGroupSeq(after, { ...founding, generation: 1 })).toBe(1);
  });


  it('GS-11: a late snapshot cannot un-admit or re-admit — the deltas it did not see are replayed after it', async () => {
    const { founding, record, pubA, pubB, member } = await scene();
    const z = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: bytes(0x51), groupId: founding.groupId }));
    const two = applyGroupRows(record, [row({ kind: GROUP_KIND.ADMIN, senderGroupKey: pubA, payload: { admins: [pubA, pubB], sentAt: CLOCK } })]).record;
    const admitted = applyGroupRows(two, [row({ kind: GROUP_KIND.ADMIT, senderGroupKey: pubB, seq: '1', createdAt: CLOCK + 1, payload: { members: [member(z, 'Zed')], sentAt: CLOCK + 1 } })]).record;
    expect(admitted.members.some((m: any) => hex(m.groupKey) === hex(z))).toBe(true);
    expect(admitted.controlLog.length, 'the delta is logged').toBe(2);
    const stale = applyGroupRows(admitted, [row({
      kind: GROUP_KIND.ROSTER, senderGroupKey: pubA, seq: '2', createdAt: CLOCK + 10,
      payload: { name: 'the kitchen', sizeHint: 50, admins: [pubA, pubB], members: [member(pubA, 'Ann'), member(pubB, 'Bo')], asOf: { [hex(pubB)]: { epoch: 20833, seq: 0 } } },
    })]).record;
    expect(stale.members.some((m: any) => hex(m.groupKey) === hex(z)), 'Z survives the wholesale roster: the ADMIT is beyond its asOf').toBe(true);
    const gone = applyGroupRows(stale, [row({ kind: GROUP_KIND.REMOVE, senderGroupKey: pubB, seq: '2', createdAt: CLOCK + 20, payload: { groupKey: z, generation: 0, envelope: null, sentAt: CLOCK + 20 } })]).record;
    expect(gone.members.some((m: any) => hex(m.groupKey) === hex(z))).toBe(false);
    const staleAgain = applyGroupRows(gone, [row({
      kind: GROUP_KIND.ROSTER, senderGroupKey: pubA, seq: '3', createdAt: CLOCK + 30,
      payload: { name: 'the kitchen', sizeHint: 50, admins: [pubA, pubB], members: [member(pubA, 'Ann'), member(pubB, 'Bo'), member(z, 'Zed')], asOf: { [hex(pubB)]: { epoch: 20833, seq: 1 } } },
    })]).record;
    expect(staleAgain.members.some((m: any) => hex(m.groupKey) === hex(z)), 'a snapshot that listed Z before reading the REMOVE does not bring Z back').toBe(false);
    const current = applyGroupRows(gone, [row({
      kind: GROUP_KIND.ROSTER, senderGroupKey: pubA, seq: '4', createdAt: CLOCK + 40,
      payload: { name: 'the kitchen', sizeHint: 50, admins: [pubA, pubB], members: [member(pubA, 'Ann'), member(pubB, 'Bo'), member(z, 'Zed')], asOf: { [hex(pubB)]: { epoch: 20833, seq: 2 } } },
    })]).record;
    expect(current.members.some((m: any) => hex(m.groupKey) === hex(z)), 'covered deltas are not replayed').toBe(true);
    const seen = noteRosterSeen(record, [row({ roster: true, kind: GROUP_KIND.ADMIT, senderGroupKey: pubB, seq: '7', payload: {} }), row({ roster: true, kind: GROUP_KIND.ADMIT, senderGroupKey: pubB, seq: '3', payload: {} })]);
    expect(seen.rosterSeen[hex(pubB)]).toEqual({ epoch: 20833, seq: 7, g: 0 });
  });

  it('GS-12: two claims on one generation — the chain\'s earlier row wins, a speculative claim loses to any row, the loser is named', async () => {
    const { record } = await scene();
    const epoch = record.epochs[0].epoch;
    const mine = adoptGroupGeneration(record, { epoch, generation: 1, key: bytes(0x61), speculative: true });
    expect(mine.epochs.some((e: any) => e.generation === 1 && e.speculative === true)).toBe(true);
    const theirs = adoptGroupGeneration(mine, { epoch, generation: 1, key: bytes(0x62), stamp: [CLOCK + 50, 0, 'bb', 1] });
    expect(hex(theirs.epochs.find((e: any) => e.generation === 1)!.key)).toBe(hex(bytes(0x62)));
    expect(theirs.generationLost.map((g: any) => hex(g.key))).toEqual([hex(bytes(0x61))]);
    const later = adoptGroupGeneration(theirs, { epoch, generation: 1, key: bytes(0x63), stamp: [CLOCK + 60, 0, 'cc', 1] });
    expect(hex(later.epochs.find((e: any) => e.generation === 1)!.key)).toBe(hex(bytes(0x62)));
    const earlier = adoptGroupGeneration(theirs, { epoch, generation: 1, key: bytes(0x60), stamp: [CLOCK + 40, 0, 'aa', 1] });
    expect(hex(earlier.epochs.find((e: any) => e.generation === 1)!.key)).toBe(hex(bytes(0x60)));
    const confirmed = adoptGroupGeneration(mine, { epoch, generation: 1, key: bytes(0x61), stamp: [CLOCK + 45, 0, 'me', 1] });
    expect(confirmed.epochs.find((e: any) => e.generation === 1)!.speculative).toBe(false);
    const back = parseGroupRecord(JSON.parse(JSON.stringify(serializeGroupRecord(theirs))));
    expect(back.epochs.find((e: any) => e.generation === 1)!.stamp).toEqual([CLOCK + 50, 0, 'bb', 1]);
    expect(back.generationLost.map((g: any) => hex(g.key))).toEqual([hex(bytes(0x61))]);
  });

  it('GS-13: a control write is believed at broadcast and taken back when the own lane, read clean, never shows it', async () => {
    const { founding, record, pubA, pubB, member } = await scene();
    const z = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: bytes(0x52), groupId: founding.groupId }));
    const epoch = record.epochs[0].epoch;
    const admitted = notePendingControl({ ...record, members: [...record.members, member(z, 'Zed')] }, {
      kind: GROUP_KIND.ADMIT, epoch, generation: 0, seq: 5, at: CLOCK, members: [memberForLog(member(z, 'Zed'))], revert: {},
    });
    const young = settlePendingControl(admitted, { rosterRows: [], cleanEpochs: [epoch], nowSec: CLOCK + 60 });
    expect(young.record.pendingControl.length).toBe(1);
    const unread = settlePendingControl(admitted, { rosterRows: [], cleanEpochs: [], nowSec: CLOCK + 3600 });
    expect(unread.record.pendingControl.length).toBe(1);
    const confirmed = settlePendingControl(admitted, { rosterRows: [row({ roster: true, kind: GROUP_KIND.ADMIT, senderGroupKey: pubA, epoch, seq: '5', payload: {} })], cleanEpochs: [epoch], nowSec: CLOCK + 3600 });
    expect(confirmed.record.pendingControl.length).toBe(0);
    expect(confirmed.record.members.some((m: any) => hex(m.groupKey) === hex(z))).toBe(true);
    const reverted = settlePendingControl(admitted, { rosterRows: [], cleanEpochs: [epoch], nowSec: CLOCK + 3600 });
    expect(reverted.reverted.length).toBe(1);
    expect(reverted.record.members.some((m: any) => hex(m.groupKey) === hex(z))).toBe(false);
    expect(reverted.record.candidates.some((c: any) => hex(c.groupKey) === hex(z))).toBe(true);
    expect(reverted.record.lastControlFailure.kind).toBe(GROUP_KIND.ADMIT);
    const removed = notePendingControl(
      noteGroupRosterKey(adoptGroupGeneration({ ...record, members: [record.members[0]], admins: [pubA] }, { epoch, generation: 1, key: bytes(0x71), speculative: true }), 1, bytes(0x72)),
      { kind: GROUP_KIND.REMOVE, epoch, generation: 0, seq: 6, at: CLOCK, victim: memberForLog(member(pubB, 'Bo')), victimWasAdmin: true,
        rekey: { epoch, generation: 1, key: hex(bytes(0x71)) }, revert: { snapshot: null, admitsSinceSnapshot: 0, rosterCursor: epoch } },
    );
    const undone = settlePendingControl(removed, { rosterRows: [], cleanEpochs: [epoch], nowSec: CLOCK + 3600 }).record;
    expect(undone.members.some((m: any) => hex(m.groupKey) === hex(pubB)), 'the victim is a member again').toBe(true);
    expect(undone.admins.some((a: any) => hex(a) === hex(pubB)), 'and an admin again').toBe(true);
    expect(undone.epochs.some((e: any) => e.generation === 1), 'the generation nobody has is gone').toBe(false);
    expect(undone.rosterKeys['1']).toBeUndefined();
  });

  it('GS-14: this device\'s own removal reads as having left; admin keys that are not points never enter the record', async () => {
    const { record, pubA, pubB } = await scene();
    const asB = { ...record, self: pubB };
    const removed = applyGroupRows(asB, [row({ kind: GROUP_KIND.REMOVE, senderGroupKey: pubA, createdAt: CLOCK + 5, payload: { groupKey: pubB, generation: 0, envelope: null, sentAt: CLOCK + 4 } })]).record;
    expect(removed.leftAt, 'the thread turns read-only and a fresh invite is a way back in').toBe(CLOCK + 5);
    expect(removed.removedAt).toBe(CLOCK + 4);
    const junk = applyGroupRows(record, [row({ kind: GROUP_KIND.ADMIN, senderGroupKey: pubA, payload: { admins: [pubA, bytes(0x44)], sentAt: CLOCK } })]).record;
    expect(junk.admins.map(hex)).toEqual([hex(pubA)]);
    const none = applyGroupRows(record, [row({ kind: GROUP_KIND.ADMIN, senderGroupKey: pubA, payload: { admins: [bytes(0x44)], sentAt: CLOCK } })]).record;
    expect(none.admins.map(hex)).toEqual([hex(pubA)]);
  });

  it('GS-16: the door\'s price is the OWNER\'s to say — an admin\'s PROFILE or ROSTER does not move it, a newcomer learns it with the owner, a REMOVE is dated and carried, a candidate\'s answer rides their row', async () => {
    const { record, founding, pubA, pubB } = await scene();
    const owned = { ...record, owner: pubA, admins: [pubA, pubB] };
    const priced = applyGroupRows(owned, [row({ kind: GROUP_KIND.PROFILE, senderGroupKey: pubA, payload: { entryFee: '5000000000', sentAt: 1 } })]).record;
    expect(priced.entryFee).toBe('5000000000');
    const byAdmin = applyGroupRows(priced, [row({ kind: GROUP_KIND.PROFILE, senderGroupKey: pubB, seq: '2', payload: { name: 'the yard', entryFee: '1', sentAt: 2 } })]).record;
    expect(byAdmin.entryFee, 'not from an admin').toBe('5000000000');
    expect(byAdmin.name, 'the same row\'s name still applies').toBe('the yard');
    expect(applyGroupRows(priced, [row({ kind: GROUP_KIND.PROFILE, senderGroupKey: pubA, seq: '3', payload: { entryFee: null, sentAt: 3 } })]).record.entryFee, 'cleared by the owner').toBeNull();
    expect(applyGroupRows(priced, [row({ kind: GROUP_KIND.PROFILE, senderGroupKey: pubA, seq: '4', payload: { name: 'x', sentAt: 4 } })]).record.entryFee, 'a row that says nothing leaves it').toBe('5000000000');
    expect(applyGroupRows(priced, [row({ kind: GROUP_KIND.PROFILE, senderGroupKey: pubA, seq: '4', payload: { entryFee: 'nonsense', sentAt: 4 } })]).record.entryFee, 'a price that is not one is a free room').toBeNull();
    const rosterPayload = (over: any) => ({ members: record.members, admins: [pubA, pubB], owner: pubA, name: 'the kitchen', avatar: null, asOf: { [hex(pubA)]: { epoch: 20833, seq: 99, g: 0 } }, ...over });
    expect(applyGroupRows(priced, [row({ kind: GROUP_KIND.ROSTER, senderGroupKey: pubA, seq: '5', payload: rosterPayload({ entryFee: '7', sentAt: 5 }) })]).record.entryFee).toBe('7');
    expect(applyGroupRows(priced, [row({ kind: GROUP_KIND.ROSTER, senderGroupKey: pubA, seq: '5', payload: rosterPayload({ entryFee: '7', asOf: {}, sentAt: 5 }) })]).record.entryFee, 'a snapshot that saw nothing is corrected by the replayed PROFILE').toBe('5000000000');
    expect(applyGroupRows(priced, [row({ kind: GROUP_KIND.ROSTER, senderGroupKey: pubA, seq: '5', payload: rosterPayload({ entryFee: null, sentAt: 5 }) })]).record.entryFee, 'the owner\'s roster clears it').toBeNull();
    expect(applyGroupRows(priced, [row({ kind: GROUP_KIND.ROSTER, senderGroupKey: pubB, seq: '6', payload: rosterPayload({ entryFee: '7', sentAt: 6 }) })]).record.entryFee, 'not from an admin\'s roster').toBe('5000000000');
    expect(applyGroupRows(priced, [row({ kind: GROUP_KIND.ROSTER, senderGroupKey: pubA, seq: '7', payload: rosterPayload({ sentAt: 7 }) })]).record.entryFee, 'a roster from before the field leaves it').toBe('5000000000');
    const newcomer = { ...record, owner: null, admins: [pubB], members: [] };
    const taught = applyGroupRows(newcomer, [row({ kind: GROUP_KIND.ROSTER, senderGroupKey: pubB, seq: '8', payload: rosterPayload({ entryFee: '9', sentAt: 8 }) })]).record;
    expect(hex(taught.owner!)).toBe(hex(pubA));
    expect(taught.entryFee).toBe('9');
    const removed = applyGroupRows(owned, [row({ kind: GROUP_KIND.REMOVE, senderGroupKey: pubA, seq: '9', createdAt: 1234, payload: { groupKey: pubB, generation: 0, envelope: null, sentAt: 1200 } })]).record;
    expect(removed.removals).toEqual({ [hex(pubB)]: 1234 });
    expect(groupRemovedAt(removed, pubB)).toBe(1234);
    expect(groupRemovedAt(removed, pubA)).toBe(0);
    const merged = applyGroupRows(removed, [row({ kind: GROUP_KIND.ROSTER, senderGroupKey: pubA, seq: '10', payload: rosterPayload({ removals: { ['ff'.repeat(32)]: 77, [hex(pubB)]: 1000 }, sentAt: 10 }) })]).record;
    expect(merged.removals).toEqual({ [hex(pubB)]: 1234, ['ff'.repeat(32)]: 77 });
    expect(applyGroupRows(owned, [row({ kind: GROUP_KIND.LEAVE, senderGroupKey: pubB, seq: '11', createdAt: 99, payload: { groupKey: pubB, sentAt: 98 } })]).record.removals).toEqual({});
    const back = parseGroupRecord(JSON.parse(JSON.stringify(serializeGroupRecord({ ...merged, entryFee: '5' }))));
    expect(back.entryFee).toBe('5');
    expect(back.removals).toEqual(merged.removals);
    expect(parseGroupRecord(JSON.parse(JSON.stringify(serializeGroupRecord(record)))).entryFee, 'a record from before the field').toBeNull();
    const stranger = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: bytes(0x45), groupId: founding.groupId }));
    const noted = noteGroupCandidate(record, { groupKey: stranger, wallet: '0:cc', keyId: 'k-x', name: 'Cy', paid: false });
    expect(noted.candidates[0].paid).toBe(false);
    expect(noteGroupCandidate(record, { groupKey: stranger, wallet: '0:cc' }).candidates[0].paid, 'not asked is null').toBeNull();
    expect(noteGroupCandidatePaid(noted, stranger, false), 'the same answer changes nothing').toBe(noted);
    expect(noteGroupCandidatePaid(noted, stranger, true).candidates[0].paid).toBe(true);
    expect(noteGroupCandidatePaid(noted, pubA, true), 'not a candidate: nothing').toBe(noted);
    expect(parseGroupCandidate(JSON.parse(JSON.stringify(serializeGroupCandidate(noted.candidates[0])))).paid).toBe(false);
    expect(parseGroupCandidate(JSON.parse(JSON.stringify(serializeGroupCandidate({ ...noted.candidates[0], paid: null })))).paid).toBeNull();
    const declined = declineGroupCandidate(noted, stranger);
    expect(declined.candidates[0].declined).toBe(true);
    expect(groupCandidatesWaiting(declined)).toEqual([]);
    expect(groupCandidatesWaiting(noted).map((c: any) => c.name)).toEqual(['Cy']);
    expect(noteGroupCandidate(declined, { groupKey: stranger, wallet: '0:cc' }), 'the rescan adds nothing').toBe(declined);
    expect(declineGroupCandidate(declined, stranger), 'twice changes nothing').toBe(declined);
    expect(declineGroupCandidate(noted, pubA), 'not a candidate: nothing').toBe(noted);
    expect(noteGroupCandidatePaid(declined, stranger, true).candidates[0].declined, 'a new answer from the chain keeps it').toBe(true);
    const stored = JSON.parse(JSON.stringify(serializeGroupCandidate(declined.candidates[0])));
    expect(stored.d).toBe(1);
    expect(parseGroupCandidate(stored).declined).toBe(true);
    expect('declined' in parseGroupCandidate(JSON.parse(JSON.stringify(serializeGroupCandidate(noted.candidates[0]))))).toBe(false);
  });

  it('GS-17: the owner tier holds at every door — a non-owner ROSTER moves members only, a REMOVE cannot name the owner, a roster\'s muted/hidden are bounded and immune', async () => {
    const { record, pubA, pubB, member } = await scene();
    const owned = { ...record, owner: pubA, admins: [pubA, pubB] };
    const rosterPayload = (over: any) => ({ members: record.members, admins: [pubA, pubB], owner: pubA, name: 'the kitchen', avatar: null, asOf: {}, ...over });
    const grabbed = applyGroupRows(owned, [row({ kind: GROUP_KIND.ROSTER, senderGroupKey: pubB, payload: rosterPayload({ admins: [pubB], members: [member(pubB, 'Bo')], sentAt: 1 }) })]).record;
    expect(grabbed.admins.map(hex).sort(), 'the admin set is the owner\'s to replace').toEqual([hex(pubA), hex(pubB)].sort());
    expect(grabbed.members.some((m: any) => hex(m.groupKey) === hex(pubA)), 'the owner stays in the room').toBe(true);
    expect(hex(grabbed.owner!)).toBe(hex(pubA));
    const shrunk = applyGroupRows(owned, [row({ kind: GROUP_KIND.ROSTER, senderGroupKey: pubA, payload: rosterPayload({ admins: [pubA], sentAt: 1 }) })]).record;
    expect(shrunk.admins.map(hex)).toEqual([hex(pubA)]);
    const kept = applyGroupRows(owned, [row({ kind: GROUP_KIND.REMOVE, senderGroupKey: pubB, seq: '2', createdAt: 5, payload: { groupKey: pubA, generation: 0, envelope: null, sentAt: 5 } })]).record;
    expect(kept.members.length).toBe(2);
    expect(isGroupAdmin(kept, pubA)).toBe(true);
    expect(kept.removals, 'and it is not dated').toEqual({});
    const many = (n: number, prefix: string) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`${20833}.0.${prefix}${String(i).padStart(2, '0')}${'ab'.repeat(31)}.${i}`.slice(0, 200).replace(/\.\d+$/, `.${i}`), { at: i, excerpt: 'x' }]));
    const hidden: Record<string, any> = {};
    for (let i = 0; i < 600; i += 1) hidden[`20833.0.${i.toString(16).padStart(64, '0')}.1`] = { at: i, excerpt: 'x' };
    void many;
    const flooded = applyGroupRows(owned, [row({ kind: GROUP_KIND.ROSTER, senderGroupKey: pubB, seq: '3', payload: rosterPayload({ muted: [pubA, pubB], hidden, sentAt: 2 }) })]).record;
    expect(isGroupMuted(flooded, pubA), 'the owner is immune to a roster too').toBe(false);
    expect(isGroupMuted(flooded, pubB), 'an admin is not muted by a non-owner\'s roster').toBe(false);
    expect(Object.keys(flooded.hidden).length, 'hidden is bounded in the fold').toBe(GROUP_HIDDEN_MAX);
    expect(isGroupMuted(applyGroupRows(owned, [row({ kind: GROUP_KIND.ROSTER, senderGroupKey: pubA, seq: '3', payload: rosterPayload({ muted: [pubB], sentAt: 2 }) })]).record, pubB), 'the owner\'s roster mutes an admin').toBe(true);
    expect(GROUP_MUTED_MAX).toBe(1024);
    const stranger = new Uint8Array(32).fill(0x77);
    expect(applyGroupRows(owned, [row({ kind: GROUP_KIND.MUTE, senderGroupKey: pubA, seq: '4', payload: { groupKey: stranger, lift: false, sentAt: 3 } })]).record.muted).toEqual([]);
    const mutedB = applyGroupRows(owned, [row({ kind: GROUP_KIND.MUTE, senderGroupKey: pubA, seq: '4', payload: { groupKey: pubB, lift: false, sentAt: 3 } })]).record;
    expect(isGroupMuted(mutedB, pubB)).toBe(true);
    expect(applyGroupRows(mutedB, [row({ kind: GROUP_KIND.LEAVE, senderGroupKey: pubB, seq: '5', payload: { groupKey: pubB, sentAt: 4 } })]).record.muted, 'a leaver leaves the muted set').toEqual([]);
  });

  it('GS-18: a LEAVE spent by a later ADMIT is not replayed after a roster; an unspent one still is; a PROFILE is logged and replayed; the asOf names the generation', async () => {
    const { record, founding, pubA, pubB, member } = await scene();
    const owned = { ...record, owner: pubA };
    const c = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: bytes(0x55), groupId: founding.groupId }));
    const withC = { ...owned, members: [...owned.members, member(c, 'Cy')] };
    const rosterPayload = (over: any) => ({ members: withC.members, admins: [pubA], owner: pubA, name: 'the kitchen', avatar: null, asOf: {}, ...over });
    const left = applyGroupRows(withC, [row({ kind: GROUP_KIND.LEAVE, senderGroupKey: c, seq: '1', createdAt: 1, payload: { groupKey: c, sentAt: 1 } })]).record;
    expect(left.members.some((m: any) => hex(m.groupKey) === hex(c))).toBe(false);
    const back = applyGroupRows(left, [row({ kind: GROUP_KIND.ADMIT, senderGroupKey: pubA, seq: '2', createdAt: 2, payload: { members: [member(c, 'Cy')], sentAt: 2 } })]).record;
    expect(back.members.some((m: any) => hex(m.groupKey) === hex(c))).toBe(true);
    const rostered = applyGroupRows(back, [row({ kind: GROUP_KIND.ROSTER, senderGroupKey: pubA, seq: '3', createdAt: 3, payload: rosterPayload({ asOf: { [hex(pubA)]: { epoch: 20833, seq: 2, g: 0 } }, sentAt: 3 }) })]).record;
    expect(rostered.members.some((m: any) => hex(m.groupKey) === hex(c)), 'the re-admitted member survives the roster').toBe(true);
    const stale = applyGroupRows(left, [row({ kind: GROUP_KIND.ROSTER, senderGroupKey: pubA, seq: '3', createdAt: 3, payload: rosterPayload({ sentAt: 3 }) })]).record;
    expect(stale.members.some((m: any) => hex(m.groupKey) === hex(c)), 'a stale roster does not bring a leaver back').toBe(false);
    const renamed = applyGroupRows(owned, [row({ kind: GROUP_KIND.PROFILE, senderGroupKey: pubA, seq: '4', createdAt: 4, payload: { name: 'the yard', sentAt: 4 } })]).record;
    expect(renamed.name).toBe('the yard');
    expect(renamed.controlLog.at(-1)).toMatchObject({ kind: GROUP_KIND.PROFILE, profile: { name: 'the yard' } });
    const lateRoster = applyGroupRows(renamed, [row({ kind: GROUP_KIND.ROSTER, senderGroupKey: pubA, seq: '5', createdAt: 3, payload: rosterPayload({ name: 'the kitchen', sentAt: 3 }) })]).record;
    expect(lateRoster.name, 'the rename the snapshot did not see is replayed after it').toBe('the yard');
    const gen1 = applyGroupRows(owned, [row({ kind: GROUP_KIND.ADMIT, senderGroupKey: pubA, generation: 1, seq: '1', createdAt: 6, payload: { members: [member(c, 'Cy')], sentAt: 6 } })]).record;
    expect(gen1.controlLog.at(-1)).toMatchObject({ generation: 1, seq: 1 });
    const oldCover = applyGroupRows(gen1, [row({ kind: GROUP_KIND.ROSTER, senderGroupKey: pubA, seq: '7', createdAt: 7, payload: rosterPayload({ members: owned.members, asOf: { [hex(pubA)]: { epoch: 20833, seq: 9, g: 0 } }, sentAt: 7 }) })]).record;
    expect(oldCover.members.some((m: any) => hex(m.groupKey) === hex(c)), 'replayed: the asOf names an older generation').toBe(true);
    const newCover = applyGroupRows(gen1, [row({ kind: GROUP_KIND.ROSTER, senderGroupKey: pubA, seq: '7', createdAt: 7, payload: rosterPayload({ members: owned.members, asOf: { [hex(pubA)]: { epoch: 20833, seq: 1, g: 1 } }, sentAt: 7 }) })]).record;
    expect(newCover.members.some((m: any) => hex(m.groupKey) === hex(c)), 'covered: the asOf names the same generation at that seq').toBe(false);
    const pending = notePendingControl({ ...owned, muted: [pubB] }, { kind: GROUP_KIND.MUTE, epoch: 20833, generation: 0, seq: 2, at: 0, revert: { muted: [] } });
    const settled = settlePendingControl(pending, { rosterRows: [row({ roster: true, kind: GROUP_KIND.MUTE, senderGroupKey: pubA, generation: 1, seq: '2', payload: {} })], cleanEpochs: [20833], nowSec: 700 });
    expect(settled.reverted.length, 'not confirmed by another generation\'s row').toBe(1);
    expect(settled.record.muted).toEqual([]);
    const entry = groupRecoveryEntry({ ...owned, admins: [pubB, pubA], rosterKeys: { '0': bytes(0x66) } })!;
    expect(entry.a).toBe(hex(pubA));
    expect(entry.r).toBe(hex(bytes(0x66)));
    expect(groupsRecoverySecret(entry).rosterKey).toBe(hex(bytes(0x66)));
    expect(groupsRecoveryIsStale([entry], [{ ...entry, r: undefined }], 20833), 'a stored entry without the roster key is rewritten once').toBe(true);
    expect(groupsRecoveryIsStale([entry], [entry], 20833)).toBe(false);
  });

  it('GS-15: a MUTE and a HIDE are an admin\'s deltas — owner immune, an admin only by the owner — carried whole by a roster, replayed after a snapshot that missed them', async () => {
    const { record, pubA, pubB } = await scene();
    const owned = { ...record, owner: pubA };
    expect(applyGroupRows(owned, [row({ kind: GROUP_KIND.MUTE, senderGroupKey: pubB, payload: { groupKey: pubB, lift: false, sentAt: 1 } })]).record.muted).toEqual([]);
    const text = row({ kind: GROUP_KIND.TEXT, senderGroupKey: pubB, seq: '3', payload: { text: 'hello', sentAt: 2 } });
    const muted = applyGroupRows(owned, [row({ kind: GROUP_KIND.MUTE, senderGroupKey: pubA, payload: { groupKey: pubB, lift: false, sentAt: 1 } }), text]);
    expect(isGroupMuted(muted.record, pubB)).toBe(true);
    expect(muted.record.members.length, 'still in the room').toBe(2);
    expect(muted.messages.map((m) => [m.key, m.hidden])).toEqual([[groupMessageKey(text), true]]);
    const twoAdmins = { ...owned, admins: [pubA, pubB] };
    expect(applyGroupRows(twoAdmins, [row({ kind: GROUP_KIND.MUTE, senderGroupKey: pubB, payload: { groupKey: pubA, lift: false, sentAt: 1 } })]).record.muted, 'the owner is immune').toEqual([]);
    expect(isGroupMuted(applyGroupRows(twoAdmins, [row({ kind: GROUP_KIND.MUTE, senderGroupKey: pubA, payload: { groupKey: pubB, lift: false, sentAt: 1 } })]).record, pubB), 'the owner mutes an admin').toBe(true);
    const key = groupMessageKey(text);
    const hid = applyGroupRows(owned, [row({ kind: GROUP_KIND.HIDE, senderGroupKey: pubA, seq: '2', payload: { key, lift: false, excerpt: 'hello', sentAt: 3 } }), text]);
    expect(hid.record.hidden[key]).toMatchObject({ excerpt: 'hello' });
    expect(applyGroupRows(owned, [row({ kind: GROUP_KIND.HIDE, senderGroupKey: pubB, seq: '9', payload: { key, lift: false, excerpt: 'mine', sentAt: 9 } })]).record.hidden, 'not from a non-admin').toEqual({});
    expect(hid.messages[0].hidden).toBe(true);
    const shown = applyGroupRows(hid.record, [row({ kind: GROUP_KIND.HIDE, senderGroupKey: pubA, seq: '4', payload: { key, lift: true, sentAt: 4 } }), text]);
    expect(shown.record.hidden).toEqual({});
    expect(shown.messages[0].hidden).toBeUndefined();
    const rosterPayload = (over: any) => ({ members: record.members, admins: [pubA], owner: pubA, name: 'the kitchen', avatar: null, asOf: {}, ...over });
    const fromRoster = applyGroupRows(owned, [row({ kind: GROUP_KIND.ROSTER, senderGroupKey: pubA, seq: '5', payload: rosterPayload({ muted: [pubB], hidden: { [key]: { at: 3, excerpt: 'hello' } }, sentAt: 5 }) })]).record;
    expect(isGroupMuted(fromRoster, pubB)).toBe(true);
    expect(fromRoster.hidden[key].excerpt).toBe('hello');
    const afterOld = applyGroupRows(fromRoster, [row({ kind: GROUP_KIND.ROSTER, senderGroupKey: pubA, seq: '6', payload: rosterPayload({ muted: null, hidden: null, sentAt: 6 }) })]).record;
    expect(isGroupMuted(afterOld, pubB), 'an old roster does not un-mute').toBe(true);
    expect(afterOld.hidden[key].excerpt, 'nor un-hide').toBe('hello');
    const replayed = applyGroupRows(muted.record, [row({ kind: GROUP_KIND.ROSTER, senderGroupKey: pubA, seq: '7', payload: rosterPayload({ muted: [], hidden: {}, sentAt: 7 }) })]).record;
    expect(isGroupMuted(replayed, pubB), 'the delta the snapshot did not see is replayed after it').toBe(true);
    const back = parseGroupRecord(JSON.parse(JSON.stringify(serializeGroupRecord(hid.record))));
    expect(back.hidden[key].excerpt).toBe('hello');
    expect(parseGroupRecord(JSON.parse(JSON.stringify(serializeGroupRecord(muted.record)))).muted.map(hex)).toEqual([hex(pubB)]);
  });

  it('GS-04: only an admin may change the roster or the admin set; a join is a candidate, not a member', async () => {
    const { founding, record, pubA, pubB, member } = await scene();
    const stranger = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: bytes(0x44), groupId: founding.groupId }));

    const noted = noteGroupCandidate(record, { groupKey: stranger, wallet: '0:cc', keyId: 'k-x', name: 'Cy' });
    expect(noted.members.length, 'the key alone is not a membership card').toBe(2);
    expect(noted.candidates.length).toBe(1);
    expect(noted.candidates[0].name).toBe('Cy');
    expect(noteGroupCandidate(noted, { groupKey: stranger }).candidates.length, 'noted once').toBe(1);

    const forged = applyGroupRows(record, [row({
      kind: GROUP_KIND.ROSTER, senderGroupKey: pubB,
      payload: { name: 'mine now', sizeHint: null, admins: [pubB], members: [member(pubB, 'Bo')] },
    })]);
    expect(forged.record.members.length).toBe(2);
    expect(isGroupAdmin(forged.record, pubB)).toBe(false);
    expect(forged.record.name).toBe('the kitchen');

    const seated = applyGroupRows(noted, [row({
      kind: GROUP_KIND.ROSTER, senderGroupKey: pubA,
      payload: { name: 'the kitchen', sizeHint: 50, admins: [pubA, pubB], members: [member(pubA, 'Ann'), member(pubB, 'Bo'), member(stranger, 'Cy')] },
    })]);
    expect(seated.record.members.length).toBe(3);
    expect(isGroupAdmin(seated.record, pubB)).toBe(true);
    expect(seated.record.candidates.length).toBe(0);
  });

  it('GS-05: a leave speaks only for itself; a removal is an admin\'s, and its envelope is handed to the caller', async () => {
    const { record, pubA, pubB } = await scene();

    const forged = applyGroupRows(record, [row({
      kind: GROUP_KIND.LEAVE, senderGroupKey: pubB, payload: { groupKey: pubA, sentAt: CLOCK },
    })]);
    expect(forged.record.members.length).toBe(2);

    const left = applyGroupRows(record, [row({
      kind: GROUP_KIND.LEAVE, senderGroupKey: pubB, payload: { groupKey: pubB, sentAt: CLOCK },
    })]);
    expect(left.record.members.map((m: any) => hex(m.groupKey))).toEqual([hex(pubA)]);

    expect(applyGroupRows(record, [row({
      kind: GROUP_KIND.REMOVE, senderGroupKey: pubB, payload: { groupKey: pubA, generation: 1, envelope: bytes(0x70, 8), sentAt: CLOCK },
    })]).record.members.length).toBe(2);

    const removed = applyGroupRows(record, [row({
      kind: GROUP_KIND.REMOVE, senderGroupKey: pubA, payload: { groupKey: pubB, generation: 1, envelope: bytes(0x70, 8), sentAt: CLOCK },
    })]);
    expect(removed.record.members.map((m: any) => hex(m.groupKey))).toEqual([hex(pubA)]);
    expect(removed.rekeys.length, 'opening it needs THIS device\'s KeyShard secrets, which this module never sees').toBe(1);
    expect(removed.rekeys[0].generation).toBe(1);
  });

  it('GS-06: the admin set is replaced wholesale, and the earliest change wins when two compete', async () => {
    const { record, pubA, pubB } = await scene();
    const handover = applyGroupRows(record, [row({
      kind: GROUP_KIND.ADMIN, senderGroupKey: pubA, payload: { admins: [pubB], sentAt: CLOCK },
    })]);
    expect(isGroupAdmin(handover.record, pubB)).toBe(true);
    expect(isGroupAdmin(handover.record, pubA), 'wholesale: the old key is revoked, not merely superseded').toBe(false);

    const stranger = bytes(0x44);
    const both = applyGroupRows(record, [
      row({ kind: GROUP_KIND.ADMIN, senderGroupKey: pubA, createdAt: CLOCK + 60, payload: { admins: [stranger], sentAt: CLOCK } }),
      row({ kind: GROUP_KIND.ADMIN, senderGroupKey: pubA, createdAt: CLOCK + 10, payload: { admins: [pubB], sentAt: CLOCK + 999 } }),
    ]);
    expect(both.record.admins.map(hex), 'the earlier stamp won and the later one had no authority left').toEqual([hex(pubB)]);
  });

  it('GS-07: a removal names its cost before anything is signed', async () => {
    const { record, pubB } = await scene();
    const plan = groupRemovalPlan(record, pubB);
    expect(plan.stays.length).toBe(1);
    expect(plan.wrappable.length).toBe(1);
    expect(plan.missingKeys).toBe(0);
    expect(plan.bytes).toBe(44 + 1156);
    expect(plan.generation).toBe(1);
    const thin = { ...record, members: [...record.members, { groupKey: bytes(0x55), wallet: null, keyId: null, name: 'no keys' }] };
    expect(groupRemovalPlan(thin as any, pubB).missingKeys).toBe(1);
  });

  it('GS-09: a roster names the picture, and one that does not name it does not erase it', async () => {
    const { record, pubA, member } = await scene();
    const pointer = { epoch: 20833, seq: 4, parts: 2, hash: 'ab'.repeat(32), width: 256, height: 256 };
    const roster = (payload: any) => row({ kind: GROUP_KIND.ROSTER, senderGroupKey: pubA, payload });
    const named = applyGroupRows(record, [roster({
      name: 'the kitchen', sizeHint: null, avatar: pointer, admins: [pubA], members: [member(pubA, 'Ann')],
    })]).record;
    expect(named.avatar).toEqual(pointer);

    const later = applyGroupRows(named, [roster({
      name: 'the kitchen', sizeHint: null, admins: [pubA], members: [member(pubA, 'Ann')],
    })]).record;
    expect(later.avatar, 'silence is not a deletion').toEqual(pointer);

    expect(parseGroupRecord(serializeGroupRecord(later)).avatar).toEqual(pointer);
  });

  it('GS-10: an ADMIT adds people and a PROFILE changes the room — from an admin only; the roster state survives storage', async () => {
    const { record, founding, pubA, pubB, member } = await scene();
    const newcomer = bytes(0x77);
    const waiting = noteGroupCandidate(record, { groupKey: newcomer, wallet: '0:cc', keyId: 'k-c', name: 'Cy' });

    const forged = applyGroupRows(waiting, [row({ kind: GROUP_KIND.ADMIT, senderGroupKey: pubB, payload: { members: [member(newcomer, 'Cy')], sentAt: 1 } })]).record;
    expect(forged.members.length).toBe(2);
    const admitted = applyGroupRows(waiting, [
      row({ kind: GROUP_KIND.ADMIT, senderGroupKey: pubA, payload: { members: [member(newcomer, 'Cy')], sentAt: 1 } }),
      row({ kind: GROUP_KIND.ADMIT, senderGroupKey: pubA, seq: '2', payload: { members: [member(newcomer, 'Cy')], sentAt: 2 } }),
    ]).record;
    expect(admitted.members.length, 'added once').toBe(3);
    expect(admitted.candidates.length, 'and off the waiting list').toBe(0);

    const pointer = { epoch: 20833, seq: 4, parts: 2, hash: 'ab'.repeat(32), width: 1, height: 1 };
    const pictured = applyGroupRows(admitted, [row({ kind: GROUP_KIND.PROFILE, senderGroupKey: pubA, payload: { name: 'the pantry', avatar: pointer, sentAt: 3 } })]).record;
    expect(pictured.name).toBe('the pantry');
    expect(pictured.avatar).toEqual(pointer);
    const renamedOnly = applyGroupRows(pictured, [row({ kind: GROUP_KIND.PROFILE, senderGroupKey: pubA, payload: { name: 'the larder', sentAt: 4 } })]).record;
    expect(renamedOnly.avatar, 'silence is not a deletion').toEqual(pointer);
    const cleared = applyGroupRows(pictured, [row({ kind: GROUP_KIND.PROFILE, senderGroupKey: pubA, payload: { avatar: null, sentAt: 5 } })]).record;
    expect(cleared.avatar).toBeNull();
    expect(applyGroupRows(pictured, [row({ kind: GROUP_KIND.PROFILE, senderGroupKey: pubB, payload: { name: 'mine', sentAt: 6 } })]).record.name, 'not from a non-admin').toBe('the pantry');

    expect(hex(groupRosterKeyFor(record, 0)!)).toBe(hex(founding.rosterKey));
    expect(groupRosterKeyFor(record, 1)).toBeNull();
    const twoGens = noteGroupRosterKey(record, 1, bytes(0x99));
    expect(hex(groupRosterKeyFor(twoGens, 1)!)).toBe(hex(bytes(0x99)));

    const daily = { ...founding, seq: 5 };
    const stepped = noteGroupSeq(noteGroupSeq(record, daily), { ...founding, lane: 'roster', seq: 2 });
    expect(nextGroupSeq(stepped, founding)).toBe(6);
    expect(nextGroupSeq(stepped, { ...founding, lane: 'roster' })).toBe(3);

    const withSnapshot = { ...twoGens, snapshot: { epoch: 20833, generation: 0, admin: pubA, seq: 1, parts: 3, at: 7 }, snapshotApplied: false, admitsSinceSnapshot: 4, rosterCursor: 20830 };
    const back = parseGroupRecord(JSON.parse(JSON.stringify(serializeGroupRecord(withSnapshot))));
    expect(hex(groupRosterKeyFor(back, 1)!)).toBe(hex(bytes(0x99)));
    expect(hex(back.snapshot!.admin)).toBe(hex(pubA));
    expect(back.snapshot!.parts).toBe(3);
    expect(back.snapshotApplied).toBe(false);
    expect(back.admitsSinceSnapshot).toBe(4);
    expect(back.rosterCursor).toBe(20830);
  });

  it('GS-10: the paging marks are bounded by the window — a lane that left it is forgotten', async () => {
    const { record } = await scene();
    let marked = record;
    for (let i = 0; i < 6; i += 1) marked = noteSeenSeq(marked, `0:${String(i).padStart(2, '0').repeat(32)}`, 10 + i);
    expect(Object.keys(marked.seenSeq).length).toBe(6);
    expect(noteSeenSeq(marked, `0:${'00'.repeat(32)}`, 3), 'a lower seq never lowers a mark').toBe(marked);
    const kept = pruneSeenSeq(marked, [`0:${'01'.repeat(32)}`, `0:${'03'.repeat(32)}`.toUpperCase()]);
    expect(Object.keys(kept.seenSeq).sort()).toEqual([`0:${'01'.repeat(32)}`, `0:${'03'.repeat(32)}`]);
    expect(kept.seenSeq[`0:${'03'.repeat(32)}`]).toBe(13);
    expect(pruneSeenSeq(kept, Object.keys(kept.seenSeq)), 'nothing to forget returns the same record').toBe(kept);
  });

  it('GS-08: the record survives storage, keys and all', async () => {
    const { record, founding } = await scene();
    const walked = noteGroupSeq(await advanceGroupWindow(record, CLOCK + DAY), { ...founding, seq: 3 });
    const back = parseGroupRecord(JSON.parse(JSON.stringify(serializeGroupRecord(walked))));
    expect(hex(back.groupId)).toBe(hex(walked.groupId));
    expect(back.epochs.map((e: any) => [e.epoch, e.generation, hex(e.key)]))
      .toEqual(walked.epochs.map((e: any) => [e.epoch, e.generation, hex(e.key)]));
    expect(back.members.map((m: any) => hex(m.mlKem768PublicKey))).toEqual(walked.members.map((m: any) => hex(m.mlKem768PublicKey)));
    expect(hex(back.self!)).toBe(hex(walked.self!));
    expect(back.seqHighWater).toEqual(walked.seqHighWater);
    expect(groupMemberPublicKeys(back).map(hex)).toEqual(groupMemberPublicKeys(walked).map(hex));
    expect(() => parseGroupRecord({ v: 2 } as any)).toThrow(/unsupported/);
  });

  it('GS-CAND-01: the queue at the door is bounded, and the newest are the ones waiting', async () => {
    const asker = (n: number) => { const k = new Uint8Array(32); k[0] = n & 0xff; k[1] = (n >> 8) & 0xff; return k; };
    let record: any = (await scene()).record;
    for (let i = 0; i < GROUP_MAX_CANDIDATES + 8; i += 1) {
      record = noteGroupCandidate(record, { groupKey: asker(i) } as any, { at: 1_790_000_000 + i });
    }
    const number = (k: Uint8Array) => k[0] | (k[1] << 8);
    expect(record.candidates.length, 'bounded').toBe(GROUP_MAX_CANDIDATES);
    expect(number(record.candidates[0].groupKey), 'the oldest eight gave way').toBe(8);
    expect(number(record.candidates.at(-1).groupKey), 'and the newest is still there').toBe(GROUP_MAX_CANDIDATES + 7);
    const again = noteGroupCandidate(record, { groupKey: asker(GROUP_MAX_CANDIDATES + 7) } as any, { at: 1 });
    expect(again.candidates.length).toBe(GROUP_MAX_CANDIDATES);
  });


  it('GS-19: a multi-part message marks its LAST seq; a non-owner roster keeps every standing admin seated; a replayed older removal does not date the floor back', async () => {
    const { record, founding, pubA, pubB, member } = await scene();
    const epoch = currentGroupEpoch(record)!.epoch;
    const marked = noteGroupSeqFromRows(record, [row({ senderGroupKey: pubA, seq: '5', parts: 3, epoch, generation: 0 })]);
    expect(nextGroupSeq(marked, { epoch, generation: 0, lane: 'daily' }), 'three parts at 5, 6, 7: the next claim is 8').toBe(8);
    expect(nextGroupSeq(noteGroupSeqFromRows(record, [row({ senderGroupKey: pubA, seq: '5', epoch, generation: 0 })]), { epoch, generation: 0, lane: 'daily' }), 'one part: 6').toBe(6);
    const pubC = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: bytes(0x44), groupId: founding.groupId }));
    const owned = { ...record, owner: pubA, admins: [pubA, pubB, pubC], members: [...record.members, member(pubC, 'Cy')] };
    const rosterPayload = (over: any) => ({ members: owned.members, admins: owned.admins, owner: pubA, name: 'the kitchen', avatar: null, asOf: {}, ...over });
    const trimmed = applyGroupRows(owned, [row({ kind: GROUP_KIND.ROSTER, senderGroupKey: pubB, payload: rosterPayload({ members: [member(pubA, 'Ann'), member(pubB, 'Bo')], sentAt: 1 }) })]).record;
    expect(Boolean(groupMember(trimmed, pubC)), 'the admin the roster omitted is still seated').toBe(true);
    expect(isGroupAdmin(trimmed, pubC)).toBe(true);
    const dropped = applyGroupRows(owned, [row({ kind: GROUP_KIND.ROSTER, senderGroupKey: pubA, payload: rosterPayload({ members: [member(pubA, 'Ann'), member(pubB, 'Bo')], admins: [pubA, pubB], sentAt: 1 }) })]).record;
    expect(Boolean(groupMember(dropped, pubC))).toBe(false);
    const removedEarly = applyGroupRows(owned, [row({ kind: GROUP_KIND.REMOVE, senderGroupKey: pubA, seq: '2', createdAt: 100, payload: { groupKey: pubB, generation: 0, envelope: null, sentAt: 100 } })]).record;
    expect(groupRemovedAt(removedEarly, pubB)).toBe(100);
    const rosterLater = applyGroupRows(removedEarly, [row({ kind: GROUP_KIND.ROSTER, senderGroupKey: pubA, seq: '3', createdAt: 300, payload: rosterPayload({ members: [member(pubA, 'Ann'), member(pubC, 'Cy')], admins: [pubA, pubC], removals: { [hex(pubB)]: 200 }, asOf: {}, sentAt: 300 }) })]).record;
    expect(groupRemovedAt(rosterLater, pubB), 'the roster dated it 200; the replayed REMOVE at 100 does not move it back').toBe(200);
  });

  it('GS-20: the read window never reaches into the future, and the ratchet walks a bounded distance per call', async () => {
    const { record } = await scene();
    const today = Math.floor(CLOCK / DAY);
    const ahead = { ...record, epochs: [...record.epochs, ...[5, 17, 34].map((d) => ({ epoch: today + d, generation: 0, key: bytes(0x50 + d) }))] };
    const toRead = groupEpochsToRead(ahead, CLOCK).map((e: any) => e.epoch);
    expect(toRead.every((e: number) => e <= today + 1), 'tomorrow at most').toBe(true);
    expect(toRead).toContain(today);
    const walked = await advanceGroupWindow(record, CLOCK + 5_000 * DAY);
    expect(currentGroupEpoch(walked)!.epoch - today, "four guards' worth a call").toBe(GROUP_MAX_RATCHET_STEPS * 4);
    const further = await advanceGroupWindow(walked, CLOCK + 5_000 * DAY);
    expect(currentGroupEpoch(further)!.epoch - today, 'and the next call continues').toBe(GROUP_MAX_RATCHET_STEPS * 8);
  });



  it('GS-21: a reverted roster keeps a snapshot pointer that survives JSON; the log and the invites are bounded; a week-old write is given up', async () => {
    const { record, pubA, pubB, member } = await scene();
    const epoch = record.epochs[0].epoch;
    const snapshot = { epoch, generation: 0, admin: pubA, seq: 1, parts: 1, at: 100 };
    const noted = notePendingControl({ ...record, snapshot }, { kind: GROUP_KIND.ROSTER, epoch, generation: 0, seq: 5, at: 1000, revert: { snapshot: snapshotForRevert(snapshot), admitsSinceSnapshot: 0 } });
    const reloaded = parseGroupRecord(JSON.parse(JSON.stringify(serializeGroupRecord(noted))));
    const settled = settlePendingControl(reloaded, { rosterRows: [], cleanEpochs: [epoch], nowSec: 1000 + 700 }).record;
    expect(settled.pendingControl.length, 'overdue on a clean lane: taken back').toBe(0);
    expect(settled.snapshot?.admin).toBeInstanceOf(Uint8Array);
    expect(hex(settled.snapshot!.admin), 'the admin the pointer names').toBe(hex(pubA));
    expect(settled.snapshot!.seq).toBe(1);
    const broken = Object.fromEntries([...pubA].map((b, i) => [String(i), b]));
    expect(hex(snapshotFromRevert({ epoch, generation: 0, admin: broken, seq: 1, parts: 1 })!.admin)).toBe(hex(pubA));
    expect(snapshotFromRevert({ epoch, generation: 0, admin: '', seq: 1, parts: 1 }), 'no admin is no pointer').toBeNull();
    const eight = await Promise.all(Array.from({ length: 8 }, async (_, i) => groupMemberPublicKey(await groupMemberSeed({ vaultSeed: bytes(0x40 + i), groupId: record.groupId }))));
    const admits = Array.from({ length: 300 }, (_, i) => row({ kind: GROUP_KIND.ADMIT, senderGroupKey: pubA, seq: String(10 + i), createdAt: CLOCK + i, payload: { members: eight.map((k, j) => member(k, `m${j}`)), sentAt: CLOCK + i } }));
    const logged = applyGroupRows(record, admits).record;
    const members = (logged.controlLog ?? []).reduce((sum: number, e: any) => sum + (Array.isArray(e.members) ? e.members.length : 0), 0);
    expect(logged.controlLog.length).toBeLessThanOrEqual(GROUP_CONTROL_LOG_MAX);
    expect(logged.controlLog.length, 'rows were logged').toBeGreaterThan(100);
    expect(members, 'no more members than the bound').toBeLessThanOrEqual(GROUP_CONTROL_LOG_MAX_MEMBERS);
    expect(JSON.stringify(serializeGroupRecord(logged)).length, 'the record stays well under what IndexedDB seals in one row').toBeLessThan(6 * 1024 * 1024);
    let invited: any = record;
    for (let i = 0; i < GROUP_PENDING_INVITES_MAX + 10; i += 1) invited = notePendingGroupInvite(invited, { wallet: `w${i}`, keyId: `k${i}`, name: 'x', at: i });
    expect(invited.pendingInvites.length).toBe(GROUP_PENDING_INVITES_MAX);
    expect(invited.pendingInvites.at(-1).wallet).toBe(`w${GROUP_PENDING_INVITES_MAX + 9}`);
    const stale = notePendingControl({ ...record, muted: [pubB] }, { kind: GROUP_KIND.MUTE, epoch, generation: 0, seq: 9, at: 1000, revert: { muted: [] } });
    expect(settlePendingControl(stale, { rosterRows: [], cleanEpochs: [], nowSec: 1000 + GROUP_CONTROL_ABANDON_S - 1 }).record.pendingControl.length, 'kept while the lane never reads clean').toBe(1);
    const abandoned = settlePendingControl(stale, { rosterRows: [], cleanEpochs: [], nowSec: 1000 + GROUP_CONTROL_ABANDON_S + 1 }).record;
    expect(abandoned.pendingControl.length).toBe(0);
    expect(abandoned.muted, 'and its effect taken back').toEqual([]);
  });

  it('GS-22: the marks of a pass are written once, and a roster replay keeps one seated set — measured, not guessed', async () => {
    const { record, pubA, member } = await scene();
    const held = noteSeenSeqs(record, [['0:AA', 5], ['0:bb', 3]]);
    expect(held.seenSeq).toEqual({ '0:aa': 5, '0:bb': 3 });
    const again = noteSeenSeqs(held, [['0:aa', 4], ['0:bb', 7], ['0:cc', NaN]]);
    expect(again.seenSeq).toEqual({ '0:aa': 5, '0:bb': 7 });
    expect(noteSeenSeqs(again, [['0:aa', 1]]), 'nothing to raise: the same record').toBe(again);
    let big: any = { ...record, seenSeq: Object.fromEntries(Array.from({ length: 4096 }, (_, i) => [`0:${i.toString(16).padStart(64, '0')}`, 1])) };
    const rows = Array.from({ length: 200 }, (_, i) => [`0:${i.toString(16).padStart(64, '0')}`, 9] as [string, number]);
    const t0 = performance.now();
    big = noteSeenSeqs(big, rows);
    expect(performance.now() - t0, 'ms for 200 marks over 4,096').toBeLessThan(40);
    expect(Object.keys(big.seenSeq).length).toBe(4096);
    const keys = await Promise.all(Array.from({ length: 1024 }, async (_, i) => { const seed = bytes(0x50); seed[0] = i & 0xff; seed[1] = i >> 8; return groupMemberPublicKey(await groupMemberSeed({ vaultSeed: seed, groupId: record.groupId })); }));
    const admits = Array.from({ length: 512 }, (_, i) => row({ kind: GROUP_KIND.ADMIT, senderGroupKey: pubA, seq: String(10 + i), createdAt: CLOCK + i, payload: { members: [member(keys[2 * i], `a${i}`), member(keys[2 * i + 1], `b${i}`)], sentAt: CLOCK + i } }));
    const room = applyGroupRows(record, admits).record;
    expect(room.members.length).toBe(1026);
    expect(room.controlLog.length).toBe(512);
    const roster = row({ kind: GROUP_KIND.ROSTER, senderGroupKey: pubA, seq: '900', createdAt: CLOCK + 900, payload: { members: room.members, admins: [pubA], owner: pubA, name: 'big', avatar: null, asOf: {}, sentAt: CLOCK + 900 } });
    const t1 = performance.now();
    const folded = applyGroupRows(room, [roster]).record;
    const ms = performance.now() - t1;
    expect(folded.members.length).toBe(1026);
    expect(ms, 'ms for one roster row over 1,024 members and 512 log entries').toBeLessThan(25);
  });

});
