import { describe, expect, it } from 'vitest';
import {
  GROUP_WINDOW_DAYS, adoptGroupGeneration, advanceGroupWindow, applyGroupRows, createGroupRecord, groupEpochsToRead, markGroupEpochsRead, noteSeenSeq, pruneSeenSeq,
  currentGroupEpoch, groupMemberPublicKeys, groupRemovalPlan, groupRosterKeyFor, isGroupAdmin, nextGroupSeq,
  noteGroupCandidate, noteGroupRosterKey, noteGroupSeq, parseGroupRecord, serializeGroupRecord,
} from '../web/group-store.mjs';
import { GROUP_KIND } from '../web/group-protocol.mjs';
import { memberForLog, notePendingControl, noteRosterSeen, settlePendingControl } from '../web/group-store.mjs';
import { createGroupFounding, groupMemberPublicKey, groupMemberSeed } from '../web/crypto/group-lane.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// GROUP STORE — what a control message is ALLOWED to change. The lane already proved who wrote a capsule (its
// blinded key) and the frame named the same person, so authority here is one question: is that key an admin.
// The gates below are the answers a group cannot get wrong without becoming somebody else's room.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

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
    // EVERY day in between is READABLE and KEPT — a device that was away must still see what it missed, so a day
    // leaves the window only once a pass has read it [audit 2026-09-05, round 1: pruning by age alone threw the
    // keys of the missed days away in the same call that derived them]
    expect(walked.epochs.length).toBe(6);
    expect(walked.epochs.map((e: any) => e.epoch)).toEqual([0, 1, 2, 3, 4, 5].map((d) => Math.floor(CLOCK / DAY) + d));
    //...and the keys really differ, which is the ratchet doing its work
    expect(new Set(walked.epochs.map((e: any) => hex(e.key))).size).toBe(walked.epochs.length);
    // a pass reads the window plus the oldest missed days first
    expect(groupEpochsToRead(walked, CLOCK + 5 * DAY).map((e: any) => e.epoch)).toEqual([0, 1, 2, 3, 4, 5].map((d) => Math.floor(CLOCK / DAY) + d));
    // once read, the old days prune to the window: three days back plus today
    const read = markGroupEpochsRead(walked, walked.epochs);
    const pruned = await advanceGroupWindow(read, CLOCK + 5 * DAY);
    expect(pruned.epochs.map((e: any) => e.epoch)).toEqual([2, 3, 4, 5].map((d) => Math.floor(CLOCK / DAY) + d));
    expect(pruned.epochs.length).toBe(GROUP_WINDOW_DAYS + 1);
    // a day with a failed lane stays unread and stays kept
    const partly = markGroupEpochsRead(walked, walked.epochs.slice(1));
    expect((await advanceGroupWindow(partly, CLOCK + 5 * DAY)).epochs.map((e: any) => e.epoch)).toEqual([0, 2, 3, 4, 5].map((d) => Math.floor(CLOCK / DAY) + d));

    // a clock BEHIND the ratchet never turns it back
    const back = await advanceGroupWindow(walked, CLOCK);
    expect(currentGroupEpoch(back)!.epoch).toBe(currentGroupEpoch(walked)!.epoch);
  });

  it('GS-02: a new generation joins the window beside the old one, so a removal takes effect at once', async () => {
    const { record, founding } = await scene();
    const rekeyed = adoptGroupGeneration(record, { epoch: founding.epoch, generation: 1, key: bytes(0x99) });
    expect(rekeyed.epochs.length).toBe(2);
    expect(currentGroupEpoch(rekeyed)!.generation).toBe(1);
    // both are readable for the rest of the day: what was said before the removal is not lost
    expect(rekeyed.epochs[0].generation).toBe(0);
    // idempotent — the same envelope read twice does not double the window
    expect(adoptGroupGeneration(rekeyed, { epoch: founding.epoch, generation: 1, key: bytes(0x99) }).epochs.length).toBe(2);
  });

  it('GS-03: the seq is this device\'s own claim, and it only ever moves up', async () => {
    const { record, founding } = await scene();
    expect(nextGroupSeq(record, founding)).toBe(1);
    const after = noteGroupSeq(record, { ...founding, seq: 4 });
    expect(nextGroupSeq(after, founding)).toBe(5);
    expect(nextGroupSeq(noteGroupSeq(after, { ...founding, seq: 2 }), founding), 'a late confirmation cannot lower it').toBe(5);
    // another generation is another lane, and starts again
    expect(nextGroupSeq(after, { ...founding, generation: 1 })).toBe(1);
  });

  // ── audit 2026-09-06, round 3 ─────────────────────────────────────────────────────────────────────────────

  it('GS-11: a late snapshot cannot un-admit or re-admit — the deltas it did not see are replayed after it', async () => {
    const { founding, record, pubA, pubB, member } = await scene();
    const z = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: bytes(0x51), groupId: founding.groupId }));
    const two = applyGroupRows(record, [row({ kind: GROUP_KIND.ADMIN, senderGroupKey: pubA, payload: { admins: [pubA, pubB], sentAt: CLOCK } })]).record;
    // B admits Z at T; A's device took its snapshot at T+10 having folded nothing of B's lane (asOf names B at seq 0)
    const admitted = applyGroupRows(two, [row({ kind: GROUP_KIND.ADMIT, senderGroupKey: pubB, seq: '1', createdAt: CLOCK + 1, payload: { members: [member(z, 'Zed')], sentAt: CLOCK + 1 } })]).record;
    expect(admitted.members.some((m: any) => hex(m.groupKey) === hex(z))).toBe(true);
    expect(admitted.controlLog.length, 'the delta is logged').toBe(2);
    const stale = applyGroupRows(admitted, [row({
      kind: GROUP_KIND.ROSTER, senderGroupKey: pubA, seq: '2', createdAt: CLOCK + 10,
      payload: { name: 'the kitchen', sizeHint: 50, admins: [pubA, pubB], members: [member(pubA, 'Ann'), member(pubB, 'Bo')], asOf: { [hex(pubB)]: { epoch: 20833, seq: 0 } } },
    })]).record;
    expect(stale.members.some((m: any) => hex(m.groupKey) === hex(z)), 'Z survives the wholesale roster: the ADMIT is beyond its asOf').toBe(true);
    // the mirror: B removed pubB's friend... a REMOVE the snapshot did not see stays removed
    const gone = applyGroupRows(stale, [row({ kind: GROUP_KIND.REMOVE, senderGroupKey: pubB, seq: '2', createdAt: CLOCK + 20, payload: { groupKey: z, generation: 0, envelope: null, sentAt: CLOCK + 20 } })]).record;
    expect(gone.members.some((m: any) => hex(m.groupKey) === hex(z))).toBe(false);
    const staleAgain = applyGroupRows(gone, [row({
      kind: GROUP_KIND.ROSTER, senderGroupKey: pubA, seq: '3', createdAt: CLOCK + 30,
      payload: { name: 'the kitchen', sizeHint: 50, admins: [pubA, pubB], members: [member(pubA, 'Ann'), member(pubB, 'Bo'), member(z, 'Zed')], asOf: { [hex(pubB)]: { epoch: 20833, seq: 1 } } },
    })]).record;
    expect(staleAgain.members.some((m: any) => hex(m.groupKey) === hex(z)), 'a snapshot that listed Z before reading the REMOVE does not bring Z back').toBe(false);
    // a snapshot that HAD seen the delta (asOf covers it) is the truth as it stands
    const current = applyGroupRows(gone, [row({
      kind: GROUP_KIND.ROSTER, senderGroupKey: pubA, seq: '4', createdAt: CLOCK + 40,
      payload: { name: 'the kitchen', sizeHint: 50, admins: [pubA, pubB], members: [member(pubA, 'Ann'), member(pubB, 'Bo'), member(z, 'Zed')], asOf: { [hex(pubB)]: { epoch: 20833, seq: 2 } } },
    })]).record;
    expect(current.members.some((m: any) => hex(m.groupKey) === hex(z)), 'covered deltas are not replayed').toBe(true);
    // and the record remembers what a snapshot of its own would say it saw
    const seen = noteRosterSeen(record, [row({ roster: true, kind: GROUP_KIND.ADMIT, senderGroupKey: pubB, seq: '7', payload: {} }), row({ roster: true, kind: GROUP_KIND.ADMIT, senderGroupKey: pubB, seq: '3', payload: {} })]);
    expect(seen.rosterSeen[hex(pubB)]).toEqual({ epoch: 20833, seq: 7 });
  });

  it('GS-12: two claims on one generation — the chain\'s earlier row wins, a speculative claim loses to any row, the loser is named', async () => {
    const { record } = await scene();
    const epoch = record.epochs[0].epoch;
    const mine = adoptGroupGeneration(record, { epoch, generation: 1, key: bytes(0x61), speculative: true });
    expect(mine.epochs.some((e: any) => e.generation === 1 && e.speculative === true)).toBe(true);
    // the chain shows another admin's generation-1 row: the speculative claim yields, whatever its stamp
    const theirs = adoptGroupGeneration(mine, { epoch, generation: 1, key: bytes(0x62), stamp: [CLOCK + 50, 0, 'bb', 1] });
    expect(hex(theirs.epochs.find((e: any) => e.generation === 1)!.key)).toBe(hex(bytes(0x62)));
    expect(theirs.generationLost.map((g: any) => hex(g.key))).toEqual([hex(bytes(0x61))]);
    // two chain rows: the earlier stamp wins, a later one changes nothing
    const later = adoptGroupGeneration(theirs, { epoch, generation: 1, key: bytes(0x63), stamp: [CLOCK + 60, 0, 'cc', 1] });
    expect(hex(later.epochs.find((e: any) => e.generation === 1)!.key)).toBe(hex(bytes(0x62)));
    const earlier = adoptGroupGeneration(theirs, { epoch, generation: 1, key: bytes(0x60), stamp: [CLOCK + 40, 0, 'aa', 1] });
    expect(hex(earlier.epochs.find((e: any) => e.generation === 1)!.key)).toBe(hex(bytes(0x60)));
    // the chain confirming this device's own claim clears the speculative mark
    const confirmed = adoptGroupGeneration(mine, { epoch, generation: 1, key: bytes(0x61), stamp: [CLOCK + 45, 0, 'me', 1] });
    expect(confirmed.epochs.find((e: any) => e.generation === 1)!.speculative).toBe(false);
    // the storage form carries the stamp and the mark
    const back = parseGroupRecord(JSON.parse(JSON.stringify(serializeGroupRecord(theirs))));
    expect(back.epochs.find((e: any) => e.generation === 1)!.stamp).toEqual([CLOCK + 50, 0, 'bb', 1]);
    expect(back.generationLost.map((g: any) => hex(g.key))).toEqual([hex(bytes(0x61))]);
  });

  it('GS-13: a control write is believed at broadcast and taken back when the own lane, read clean, never shows it', async () => {
    const { founding, record, pubA, pubB, member } = await scene();
    const z = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: bytes(0x52), groupId: founding.groupId }));
    const epoch = record.epochs[0].epoch;
    // an ADMIT of Z, pending at seq 5 of today's roster lane
    const admitted = notePendingControl({ ...record, members: [...record.members, member(z, 'Zed')] }, {
      kind: GROUP_KIND.ADMIT, epoch, generation: 0, seq: 5, at: CLOCK, members: [memberForLog(member(z, 'Zed'))], revert: {},
    });
    // still in flight: nothing happens while the window is open, or while the own lane was not read clean
    const young = settlePendingControl(admitted, { rosterRows: [], cleanEpochs: [epoch], nowSec: CLOCK + 60 });
    expect(young.record.pendingControl.length).toBe(1);
    const unread = settlePendingControl(admitted, { rosterRows: [], cleanEpochs: [], nowSec: CLOCK + 3600 });
    expect(unread.record.pendingControl.length).toBe(1);
    // the own row read back confirms it
    const confirmed = settlePendingControl(admitted, { rosterRows: [row({ roster: true, kind: GROUP_KIND.ADMIT, senderGroupKey: pubA, epoch, seq: '5', payload: {} })], cleanEpochs: [epoch], nowSec: CLOCK + 3600 });
    expect(confirmed.record.pendingControl.length).toBe(0);
    expect(confirmed.record.members.some((m: any) => hex(m.groupKey) === hex(z))).toBe(true);
    // the lane read clean past the window without the row: the admit is undone, Z waits as a candidate again
    const reverted = settlePendingControl(admitted, { rosterRows: [], cleanEpochs: [epoch], nowSec: CLOCK + 3600 });
    expect(reverted.reverted.length).toBe(1);
    expect(reverted.record.members.some((m: any) => hex(m.groupKey) === hex(z))).toBe(false);
    expect(reverted.record.candidates.some((c: any) => hex(c.groupKey) === hex(z))).toBe(true);
    expect(reverted.record.lastControlFailure.kind).toBe(GROUP_KIND.ADMIT);
    // a REMOVE with a rekey: the victim comes back, the speculative generation and its roster key go
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
    // an ADMIN row naming a non-point beside a real key: the junk is dropped, the room keeps an admin
    const junk = applyGroupRows(record, [row({ kind: GROUP_KIND.ADMIN, senderGroupKey: pubA, payload: { admins: [pubA, bytes(0x44)], sentAt: CLOCK } })]).record;
    expect(junk.admins.map(hex)).toEqual([hex(pubA)]);
    // a row that would leave no valid admin changes nothing
    const none = applyGroupRows(record, [row({ kind: GROUP_KIND.ADMIN, senderGroupKey: pubA, payload: { admins: [bytes(0x44)], sentAt: CLOCK } })]).record;
    expect(none.admins.map(hex)).toEqual([hex(pubA)]);
  });

  it('GS-04: only an admin may change the roster or the admin set; a join is a candidate, not a member', async () => {
    const { founding, record, pubA, pubB, member } = await scene();
    // a real group key (a curve point): the fold drops keys that are not points since round 3
    const stranger = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: bytes(0x44), groupId: founding.groupId }));

    // someone answered an invite with the key only they can derive: a candidate and nothing more
    const noted = noteGroupCandidate(record, { groupKey: stranger, wallet: '0:cc', keyId: 'k-x', name: 'Cy' });
    expect(noted.members.length, 'the key alone is not a membership card').toBe(2);
    expect(noted.candidates.length).toBe(1);
    expect(noted.candidates[0].name).toBe('Cy');
    expect(noteGroupCandidate(noted, { groupKey: stranger }).candidates.length, 'noted once').toBe(1);

    // a ROSTER from a NON-admin changes nothing
    const forged = applyGroupRows(record, [row({
      kind: GROUP_KIND.ROSTER, senderGroupKey: pubB,
      payload: { name: 'mine now', sizeHint: null, admins: [pubB], members: [member(pubB, 'Bo')] },
    })]);
    expect(forged.record.members.length).toBe(2);
    expect(isGroupAdmin(forged.record, pubB)).toBe(false);
    expect(forged.record.name).toBe('the kitchen');

    // the same roster FROM the admin lands whole — and takes the admitted person off the waiting list
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

    // B tries to "leave" on A's behalf — the lane proved it was B, so it changes nothing
    const forged = applyGroupRows(record, [row({
      kind: GROUP_KIND.LEAVE, senderGroupKey: pubB, payload: { groupKey: pubA, sentAt: CLOCK },
    })]);
    expect(forged.record.members.length).toBe(2);

    const left = applyGroupRows(record, [row({
      kind: GROUP_KIND.LEAVE, senderGroupKey: pubB, payload: { groupKey: pubB, sentAt: CLOCK },
    })]);
    expect(left.record.members.map((m: any) => hex(m.groupKey))).toEqual([hex(pubA)]);

    // a REMOVE from a non-admin is ignored; from the admin it drops the member AND hands over the envelope
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

    // TWO competing handovers in one pass: the chain-stamped one is applied first, and the loser — now written by
    // a key that is no longer an admin — changes nothing. Every device folds the same order, so all agree.
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
    // a member the roster has no KeyShard keys for cannot be wrapped to — the dialog must say so rather than
    // quietly cut them off with everyone else
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

    // THE BOMB THIS DEFUSES: a roster is published whole. A client that knows nothing about pictures writes one
    // without an avatar, and everyone who had not fetched it yet would lose the room's picture for good.
    const later = applyGroupRows(named, [roster({
      name: 'the kitchen', sizeHint: null, admins: [pubA], members: [member(pubA, 'Ann')],
    })]).record;
    expect(later.avatar, 'silence is not a deletion').toEqual(pointer);

    // and it survives storage, because the bytes it points at do not
    expect(parseGroupRecord(serializeGroupRecord(later)).avatar).toEqual(pointer);
  });

  it('GS-10: an ADMIT adds people and a PROFILE changes the room — from an admin only; the roster state survives storage', async () => {
    const { record, founding, pubA, pubB, member } = await scene();
    const newcomer = bytes(0x77);
    const waiting = noteGroupCandidate(record, { groupKey: newcomer, wallet: '0:cc', keyId: 'k-c', name: 'Cy' });

    // an ADMIT from a non-admin changes nothing; from the admin it adds, once, and clears the waiting list
    const forged = applyGroupRows(waiting, [row({ kind: GROUP_KIND.ADMIT, senderGroupKey: pubB, payload: { members: [member(newcomer, 'Cy')], sentAt: 1 } })]).record;
    expect(forged.members.length).toBe(2);
    const admitted = applyGroupRows(waiting, [
      row({ kind: GROUP_KIND.ADMIT, senderGroupKey: pubA, payload: { members: [member(newcomer, 'Cy')], sentAt: 1 } }),
      row({ kind: GROUP_KIND.ADMIT, senderGroupKey: pubA, seq: '2', payload: { members: [member(newcomer, 'Cy')], sentAt: 2 } }),
    ]).record;
    expect(admitted.members.length, 'added once').toBe(3);
    expect(admitted.candidates.length, 'and off the waiting list').toBe(0);

    // a PROFILE renames, points at a picture, and an explicit null takes the picture away — a silent one does not
    const pointer = { epoch: 20833, seq: 4, parts: 2, hash: 'ab'.repeat(32), width: 1, height: 1 };
    const pictured = applyGroupRows(admitted, [row({ kind: GROUP_KIND.PROFILE, senderGroupKey: pubA, payload: { name: 'the pantry', avatar: pointer, sentAt: 3 } })]).record;
    expect(pictured.name).toBe('the pantry');
    expect(pictured.avatar).toEqual(pointer);
    const renamedOnly = applyGroupRows(pictured, [row({ kind: GROUP_KIND.PROFILE, senderGroupKey: pubA, payload: { name: 'the larder', sentAt: 4 } })]).record;
    expect(renamedOnly.avatar, 'silence is not a deletion').toEqual(pointer);
    const cleared = applyGroupRows(pictured, [row({ kind: GROUP_KIND.PROFILE, senderGroupKey: pubA, payload: { avatar: null, sentAt: 5 } })]).record;
    expect(cleared.avatar).toBeNull();
    expect(applyGroupRows(pictured, [row({ kind: GROUP_KIND.PROFILE, senderGroupKey: pubB, payload: { name: 'mine', sentAt: 6 } })]).record.name, 'not from a non-admin').toBe('the pantry');

    // the roster key of the founding generation is on the record, and a later generation's can be noted
    expect(hex(groupRosterKeyFor(record, 0)!)).toBe(hex(founding.rosterKey));
    expect(groupRosterKeyFor(record, 1)).toBeNull();
    const twoGens = noteGroupRosterKey(record, 1, bytes(0x99));
    expect(hex(groupRosterKeyFor(twoGens, 1)!)).toBe(hex(bytes(0x99)));

    // the roster lane has its own seq space
    const daily = { ...founding, seq: 5 };
    const stepped = noteGroupSeq(noteGroupSeq(record, daily), { ...founding, lane: 'roster', seq: 2 });
    expect(nextGroupSeq(stepped, founding)).toBe(6);
    expect(nextGroupSeq(stepped, { ...founding, lane: 'roster' })).toBe(3);

    // and all of it survives storage
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
    // [self-review 2026-09-05, round 2] seenSeq grew by one address per member per day for ever; a room of 1,024
    // over a year is 373,000 keys in one IndexedDB record. A pass keeps the marks of the lanes it asked about.
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
});
