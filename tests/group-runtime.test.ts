import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { beginCell } from '@ton/core';
import { __setLaneGenerationCodeForTests, __resetLaneGenerationCodeOverridesForTests } from '../web/shard-address.mjs';
import { createGroupRuntime, GROUP_LEFT_READ_S } from '../web/group-runtime.mjs';
import { createGroupRequestQueue, createMemoryGroupRecordStore } from '../web/group-record-store.mjs';
import { groupCandidatesWaiting, groupOwnerKey, groupRecoveryEntry, groupsRecoverySecret, isGroupAdmin } from '../web/group-store.mjs';
import {
  GROUP_KIND, GROUP_HIDE_EXCERPT_MAX, decodeGroupPayload, encodeGroupAdmit, encodeGroupRoster, parseGroupInviteToken, parseGroupJoinToken,
  sealGroupRekeyEnvelope,
} from '../web/group-protocol.mjs';
import { groupMemberPublicKey, groupMemberSeed } from '../web/crypto/group-lane.mjs';
import { x25519 } from '../web/vendor/@noble/curves/ed25519.js';
import { ml_kem768 } from '../web/vendor/@noble/post-quantum/ml-kem.js';


const CLOCK = 1_800_000_000;
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

function runtimeFor(identity: any, extra: any = {}) {
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
    boundary: Math.floor(CLOCK / 86_400),
    random: (n: number) => new Uint8Array(n).fill(0x5C),
    ...extra,
  });
  return { runtime, sent };
}

describe('GROUP-RUNTIME — the sequences', () => {
  it('GR-RESTORE-01: a room planted from its recovery entry on its founder\'s other device has its founder in it — never "0 in the group"; an earlier build\'s plant is healed', async () => {
    const founder = identityFor(0x31);
    const { runtime } = runtimeFor(founder);
    const room = await runtime.create({ name: 'Platho official' });
    const entry = groupRecoveryEntry(room)!;
    const other = runtimeFor(founder);
    const planted = await other.runtime.adopt(groupsRecoverySecret(entry));
    expect(planted.members.map((m: any) => [hex(m.groupKey), m.wallet]), 'MEASURED before (2026-10-15): "0 in the group" in the founder\'s own room')
      .toEqual([[hex(room.self), founder.wallet]]);
    expect(hex(groupOwnerKey(planted)!)).toBe(hex(room.self));
    const guest = runtimeFor(identityFor(0x32));
    const invited = await guest.runtime.adopt(runtime.secretFor(hex(room.groupId)));
    expect(invited.members, 'a guest is no member before an admin admits them').toEqual([]);
    const store = createMemoryGroupRecordStore();
    const earlier = runtimeFor(founder, { store });
    const plantedBefore = await earlier.runtime.adopt(groupsRecoverySecret(entry));
    const id = hex(plantedBefore.groupId);
    const row = (await store.list()).find((r: any) => JSON.stringify(r).includes(id));
    await store.put(id, { ...row, members: [] });
    const reopened = runtimeFor(founder, { store });
    const [healed] = await reopened.runtime.load();
    expect(healed.members.map((m: any) => hex(m.groupKey)), 'healed at the load').toEqual([hex(room.self)]);
    const [again] = await runtimeFor(founder, { store }).runtime.load();
    expect(again.members.length, 'once: written, not added again').toBe(1);
  });

  it('GR-01: a new group has its creator as its only member and its only admin', async () => {
    const { runtime } = runtimeFor(identityFor(0x21));
    const record = await runtime.create({ name: 'the kitchen' });
    expect(record.name).toBe('the kitchen');
    expect('sizeHint' in record, 'a record carries no size hint any more').toBe(false);
    expect(record.members.length).toBe(1);
    expect(isGroupAdmin(record, record.self)).toBe(true);
    const reloaded = await runtime.load();
    expect(reloaded.length).toBe(1);
    expect(hex(reloaded[0].groupId)).toBe(hex(record.groupId));
    expect(hex(reloaded[0].epochs[0].key)).toBe(hex(record.epochs[0].key));
  });

  it('GR-02: an invite carries the key and a pointer, costs no roster, and the invitee answers with a token — not a lane write', async () => {
    const inviter = identityFor(0x21);
    const guest = identityFor(0x22);
    const { runtime, sent } = runtimeFor(inviter);
    const record = await runtime.create({ name: 'the kitchen' });
    const id = hex(record.groupId);

    const secret = runtime.secretFor(id);
    expect(Object.keys(secret).sort()).toEqual(['epoch', 'generation', 'groupId', 'inviter', 'key', 'name', 'rosterKey', 'snapshot']);
    expect(secret.key).toBe(hex(record.epochs[0].key));

    const noted = await runtime.noteInvite(id, { wallet: guest.wallet, keyId: guest.keyId, name: guest.name });
    expect(sent.length, 'a note is not a message').toBe(0);
    expect(noted.pendingInvites.length).toBe(1);
    expect(noted.members.length, 'and nobody is in the roster who has not arrived').toBe(1);

    const guestSide = runtimeFor(guest);
    const adopted = await guestSide.runtime.adopt(secret);
    expect(hex(adopted.groupId)).toBe(hex(record.groupId));
    expect(adopted.epochs.length).toBe(1);
    expect(adopted.epochs[0].epoch).toBe(record.epochs[0].epoch);
    expect(guestSide.sent.length, 'joining writes nothing to any lane').toBe(0);
    const token = parseGroupJoinToken(guestSide.runtime.joinTokenFor(id))!;
    expect(token.groupId).toBe(id);
    expect(hex(token.groupKey)).toBe(hex(adopted.self!));
    expect(token.wallet).toBe(guest.wallet);
    expect(hex(token.mlKem768PublicKey!), 'with the keys a rekey must wrap to').toBe(hex(guest.mlKem768PublicKey));
  });

  it('GR-02B: the admin\'s device admits the candidate it invited at once, and lists anyone else for a person to decide', async () => {
    const admin = identityFor(0x24);
    const invited = identityFor(0x25);
    const stranger = identityFor(0x26);
    const { runtime, sent } = runtimeFor(admin);
    const record = await runtime.create({ name: 'the kitchen' });
    const id = hex(record.groupId);
    await runtime.noteInvite(id, { wallet: invited.wallet, keyId: invited.keyId, name: invited.name });
    const secret = runtime.secretFor(id);
    const tokenOf = async (who: any) => { const side = runtimeFor(who); await side.runtime.adopt(secret); return parseGroupJoinToken(side.runtime.joinTokenFor(id))!; };
    sent.length = 0;

    const after = await runtime.noteCandidate(id, await tokenOf(invited));
    expect(sent.length, 'one roster payload').toBe(1);
    expect(after.members.map((m: any) => m.wallet)).toContain(invited.wallet);
    expect(after.pendingInvites.length, 'the invite is spent once it is answered').toBe(0);
    expect(after.candidates.length).toBe(0);

    sent.length = 0;
    const waiting = await runtime.noteCandidate(id, await tokenOf(stranger));
    expect(sent.length, 'nothing is published for a candidate').toBe(0);
    expect(waiting.members.map((m: any) => m.wallet)).not.toContain(stranger.wallet);
    expect(waiting.candidates.map((c: any) => c.wallet)).toEqual([stranger.wallet]);
    expect((await runtime.noteCandidate(id, await tokenOf(stranger))).candidates.length, 'noted once').toBe(1);

    const seated = await runtime.admit(id, waiting.candidates);
    expect(seated.members.map((m: any) => m.wallet)).toContain(stranger.wallet);
    expect(seated.candidates.length).toBe(0);

    const bystander = runtimeFor(identityFor(0x27));
    await bystander.runtime.adopt(secret);
    const untouched = await bystander.runtime.noteCandidate(id, await tokenOf(stranger));
    expect(untouched!.candidates.length).toBe(0);
    expect(bystander.sent.length).toBe(0);
  });

  it('GR-03: a device that is not an admin may not invite, admit, remove or name admins', async () => {
    const { runtime } = runtimeFor(identityFor(0x33));
    const record = await runtime.create({ name: 'not yours' });
    runtime.get(hex(record.groupId))!.admins = [];
    const id = hex(record.groupId);
    await expect(runtime.noteInvite(id, { wallet: '0:aa' })).rejects.toThrow(/admin/);
    await expect(runtime.remove(id, bytes(0x99))).rejects.toThrow(/admin/);
    await expect(runtime.setAdmins(id, [])).rejects.toThrow(/admin/);
    await expect(runtime.admit(id, [])).rejects.toThrow(/admin/);
  });

  it('GR-04: a removal prices both halves, and the cheap one is a real choice', async () => {
    const admin = identityFor(0x41);
    const guest = identityFor(0x42);
    const { runtime, sent } = runtimeFor(admin);
    const record = await runtime.create({ name: 'the room' });
    const guestSeed = await groupMemberSeed({ vaultSeed: guest.vaultSeed, groupId: record.groupId });
    const guestKey = groupMemberPublicKey(guestSeed);
    await runtime.admit(hex(record.groupId), [{
      groupKey: guestKey, wallet: guest.wallet, keyId: guest.keyId, name: guest.name,
      x25519PublicKey: guest.x25519PublicKey, mlKem768PublicKey: guest.mlKem768PublicKey,
    }]);

    const plan = runtime.plan(hex(record.groupId), guestKey);
    expect(plan.stays.length).toBe(1);
    expect(plan.wrappable.length).toBe(1);
    expect(plan.envelopeBytes).toBe(44 + 1156);
    expect(plan.generation).toBe(1);

    const quiet = await runtime.remove(hex(record.groupId), guestKey, { cutReading: false });
    expect(quiet.members.length).toBe(1);
    expect(quiet.epochs.length, 'no rekey, so no second generation in the window').toBe(1);

    const admin2 = identityFor(0x43);
    const second = runtimeFor(admin2);
    const room = await second.runtime.create({ name: 'the room' });
    const otherSeed = await groupMemberSeed({ vaultSeed: guest.vaultSeed, groupId: room.groupId });
    const otherKey = groupMemberPublicKey(otherSeed);
    await second.runtime.admit(hex(room.groupId), [{
      groupKey: otherKey, wallet: guest.wallet, keyId: guest.keyId, name: guest.name,
      x25519PublicKey: guest.x25519PublicKey, mlKem768PublicKey: guest.mlKem768PublicKey,
    }]);
    const cut = await second.runtime.remove(hex(room.groupId), otherKey, { cutReading: true });
    expect(cut.epochs.length).toBe(2);
    expect(cut.epochs[1].generation).toBe(1);
    expect(hex(cut.epochs[1].key)).not.toBe(hex(cut.epochs[0].key));
    void sent;
  });

  it('GR-05: a sync that reads a removal opens its envelope and adopts the new generation', async () => {
    const stays = identityFor(0x52);
    const admin = identityFor(0x51);
    const seeded = runtimeFor(admin);
    const record = await seeded.runtime.create({ name: 'the room' });
    const staysKey = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: stays.vaultSeed, groupId: record.groupId }));
    const adminKey = record.self!;

    const newKey = bytes(0x7E);
    const envelope = await sealGroupRekeyEnvelope({
      groupId: record.groupId,
      generation: 1,
      newKey,
      members: [{ groupKey: staysKey, x25519PublicKey: stays.x25519PublicKey, mlKem768PublicKey: stays.mlKem768PublicKey }],
    });

    const store = createMemoryGroupRecordStore();
    const staysSide = createGroupRuntime({
      store,
      identity: stays,
      send: async () => {},
      vaultRouting: async () => ({ vaultAddress: `0:${'aa'.repeat(32)}`, feeDue: 10_000_000n }),
      publishValue: 19_100_000n,
      now: () => CLOCK,
      random: (n: number) => new Uint8Array(n).fill(0x5C),
      lane: {
        buckets: async () => [],
        rosterBuckets: async () => [],
        readRoster: async () => [],
        readSnapshot: async () => null,
        read: async () => [{
          address: '0:' + '11'.repeat(32),
          epoch: record.epochs[0].epoch,
          generation: 0,
          seq: '1',
          kind: GROUP_KIND.REMOVE,
          senderGroupKey: adminKey,
          payload: { groupKey: bytes(0x53), generation: 1, envelope, sentAt: CLOCK },
        }],
      },
    });
    await store.put(hex(record.groupId), JSON.parse(JSON.stringify(
      (await import('../web/group-store.mjs')).serializeGroupRecord({
        ...record,
        self: staysKey,
        members: [{ groupKey: staysKey, wallet: stays.wallet, keyId: stays.keyId, name: stays.name, x25519PublicKey: stays.x25519PublicKey, mlKem768PublicKey: stays.mlKem768PublicKey }],
        admins: [adminKey],
      }),
    )));
    await staysSide.load();
    const passes = await staysSide.sync();
    expect(passes.length).toBe(1);
    const window = passes[0].record.epochs;
    expect(window.length, 'the new generation joined the window beside the old one').toBe(2);
    expect(window[1].generation).toBe(1);
    expect(hex(window[1].key), 'and it is the key the envelope carried').toBe(hex(newKey));
  });

  it('GR-05B: the door follows the generation — a group is usable before the flip, and moves with the lane', async () => {
    const vaultRouting = vi.fn(async () => ({ vaultAddress: `0:${'aa'.repeat(32)}`, feeDue: 10_000_000n }));
    const pre = runtimeFor(identityFor(0x81), { vaultRouting, boundary: Math.floor(CLOCK / 86_400) + 10 });
    const record = await pre.runtime.create({ name: 'before the flip' });
    await pre.runtime.say(hex(record.groupId), 'hello, generation seventeen');
    expect(pre.sent.length).toBe(1);
    expect(vaultRouting, 'the direct door needs no vault at all').not.toHaveBeenCalled();

    const post = runtimeFor(identityFor(0x82), { boundary: Math.floor(CLOCK / 86_400) });
    const room = await post.runtime.create({ name: 'after the flip' });
    await post.runtime.say(hex(room.groupId), 'hello, generation eighteen');
    expect(post.sent.length).toBe(1);
    expect(String(post.sent[0].address).toLowerCase()).toBe(`0:${'aa'.repeat(32)}`);
  });

  it('GR-06: leaving does not rekey, and the record keeps what it holds', async () => {
    let clock = CLOCK;
    const { runtime, sent } = runtimeFor(identityFor(0x61), { now: () => clock });
    const record = await runtime.create({ name: 'the kitchen' });
    sent.length = 0;
    const after = await runtime.leave(hex(record.groupId));
    expect(sent.length, 'one message: "I am gone"').toBe(1);
    expect(after.leftAt).toBe(CLOCK);
    expect(after.epochs.length, 'no rekey — the key stays exactly where it was').toBe(1);
    expect(hex(after.epochs[0].key)).toBe(hex(record.epochs[0].key));
    expect((await runtime.sync()).length, 'read for GROUP_LEFT_READ_S after the leave').toBe(1);
    expect(sent.length, 'nothing published from a left room').toBe(1);
    clock = CLOCK + GROUP_LEFT_READ_S + 1;
    expect((await runtime.sync()).length).toBe(0);
  });

  it('GR-08: the room\'s picture is published once, pointed at by the roster, and outlives the next roster', async () => {
    const admin = identityFor(0x31);
    const { runtime, sent } = runtimeFor(admin);
    const record = await runtime.create({ name: 'the kitchen' });
    const id = hex(record.groupId);
    sent.length = 0;

    const image = new Uint8Array(40_000);
    for (let i = 0; i < image.length; i += 1) image[i] = (i * 17) & 0xff;
    const after = await runtime.setAvatar(id, { bytes: image, width: 256, height: 256 });

    expect(sent.length, 'two parts and the roster that points at them').toBe(3);
    expect(after.avatar.parts).toBe(2);
    expect(after.avatar.epoch).toBe(record.epochs[0].epoch);
    expect(after.avatar.seq, 'an empty lane starts at one').toBe(1);
    expect(after.avatar.hash).toBe(Buffer.from(await crypto.subtle.digest('SHA-256', image)).toString('hex'));
    expect(after.avatar.width).toBe(256);

    const guest = identityFor(0x32);
    const guestKey = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: guest.vaultSeed, groupId: record.groupId }));
    const admitted = await runtime.admit(id, [{ groupKey: guestKey, wallet: guest.wallet, keyId: guest.keyId }]);
    expect(admitted.avatar).toEqual(after.avatar);

    const bystander = runtimeFor(identityFor(0x33));
    await bystander.runtime.adopt(runtime.secretFor(id));
    await expect(bystander.runtime.setAvatar(id, { bytes: image, width: 8, height: 8 })).rejects.toThrow(/admin/);
  });

  it('GR-09: a cut-reading removal in a group of 50 is TWO capsules, and the plan says so before anything is signed', async () => {
    const admin = identityFor(0x71);
    const { runtime, sent } = runtimeFor(admin);
    const record = await runtime.create({ name: 'fifty' });
    const id = hex(record.groupId);
    const others = [];
    for (let i = 0; i < 49; i += 1) {
      const who = identityFor(0x90 + i);
      others.push({
        groupKey: groupMemberPublicKey(await groupMemberSeed({ vaultSeed: who.vaultSeed, groupId: record.groupId })),
        wallet: who.wallet, keyId: who.keyId, name: who.name,
        x25519PublicKey: who.x25519PublicKey, mlKem768PublicKey: who.mlKem768PublicKey,
      });
    }
    sent.length = 0;
    await runtime.admit(id, others);
    expect(sent.length, 'a delta, not the roster').toBe(3);
    const victim = others[0];
    const plan = runtime.plan(id, victim.groupKey);
    expect(plan.wrappable.length).toBe(48 + 1);
    expect(plan.envelopeBytes).toBe(44 + 49 * 1156);
    expect(plan.capsules.count, 'the envelope needs two private-shaped capsules').toBe(2);
    expect(plan.capsulesWithoutRekey.count, 'a bare removal is one').toBe(1);
    sent.length = 0;
    const after = await runtime.remove(id, victim.groupKey, { cutReading: true });
    expect(sent.length, 'what the plan said').toBe(2);
    expect(sent.map((m: any) => m.seq)).toEqual([4, 5]);
    expect(sent.map((m: any) => m.sizeClass)).toEqual([32, 32]);
    expect(after.members.length).toBe(49);
    expect(after.epochs[after.epochs.length - 1].generation).toBe(1);
  }, 60_000);

  it('GR-10: a snapshot is taken when stale and pointed at by the invite; an admission is one delta capsule', async () => {
    const admin = identityFor(0x41);
    const { runtime, sent } = runtimeFor(admin);
    const record = await runtime.create({ name: 'the kitchen' });
    const id = hex(record.groupId);
    expect(record.snapshot).toBeNull();
    expect(Object.keys(record.rosterKeys)).toEqual(['0']);

    sent.length = 0;
    const withSnapshot = await runtime.ensureSnapshot(id);
    expect(sent.length).toBe(1);
    expect(withSnapshot.snapshot).toMatchObject({ epoch: record.epochs[0].epoch, generation: 0, seq: 1, parts: 1 });
    expect(hex(withSnapshot.snapshot!.admin)).toBe(hex(record.self!));
    await runtime.ensureSnapshot(id);
    expect(sent.length, 'fresh: nothing published').toBe(1);
    expect(runtime.snapshotPlan(id), 'and the dialog is told there is nothing to pay').toBeNull();

    const secret = runtime.secretFor(id);
    expect(secret.rosterKey).toBe(hex(record.rosterKeys['0']));
    expect(secret.snapshot).toEqual({ epoch: record.epochs[0].epoch, generation: 0, admin: hex(record.self!), seq: 1, parts: 1 });

    sent.length = 0;
    for (let i = 0; i < 16; i += 1) {
      const who = identityFor(0xa0 + i);
      await runtime.admit(id, [{ groupKey: groupMemberPublicKey(await groupMemberSeed({ vaultSeed: who.vaultSeed, groupId: record.groupId })), wallet: who.wallet, keyId: who.keyId, name: who.name, x25519PublicKey: who.x25519PublicKey, mlKem768PublicKey: who.mlKem768PublicKey }]);
    }
    expect(sent.length, 'sixteen admissions, sixteen single capsules').toBe(16);
    expect(sent.every((m: any) => m.sizeClass <= 2)).toBe(true);
    expect(runtime.get(id)!.admitsSinceSnapshot).toBe(16);
    expect(runtime.snapshotPlan(id)!.count, 'seventeen members: one capsule of snapshot').toBe(1);
    sent.length = 0;
    const renewed = await runtime.ensureSnapshot(id);
    expect(sent.length).toBe(1);
    expect(renewed.admitsSinceSnapshot).toBe(0);
    expect(renewed.snapshot!.seq, 'the snapshot sits after the sixteen deltas in the roster lane').toBe(18);
  });

  it('GR-11: a newcomer\'s first pass reads the snapshot the invite pointed at, then every admission after it', async () => {
    const admin = identityFor(0x43);
    const guest = identityFor(0x44);
    const other = identityFor(0x45);
    const seeded = runtimeFor(admin);
    const record = await seeded.runtime.create({ name: 'the kitchen' });
    const id = hex(record.groupId);
    const withSnapshot = await seeded.runtime.ensureSnapshot(id);
    const otherKey = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: other.vaultSeed, groupId: record.groupId }));
    const otherMember = { groupKey: otherKey, wallet: other.wallet, keyId: other.keyId, name: other.name, x25519PublicKey: other.x25519PublicKey, mlKem768PublicKey: other.mlKem768PublicKey };

    const served = { snapshotReads: 0, rosterReads: 0 };
    const snapshotRow = {
      address: '0:' + '11'.repeat(32), epoch: withSnapshot.snapshot!.epoch, generation: 0, seq: 1, kind: GROUP_KIND.ROSTER,
      senderGroupKey: record.self!, sentAt: CLOCK, roster: true,
      payload: decodeGroupPayload(GROUP_KIND.ROSTER, encodeGroupRoster({ members: record.members, admins: record.admins, name: record.name, sentAt: CLOCK })),
    };
    const admitRow = {
      address: '0:' + '11'.repeat(32), epoch: withSnapshot.snapshot!.epoch, generation: 0, seq: 2, kind: GROUP_KIND.ADMIT,
      senderGroupKey: record.self!, sentAt: CLOCK + 1, roster: true,
      payload: decodeGroupPayload(GROUP_KIND.ADMIT, encodeGroupAdmit({ members: [otherMember], sentAt: CLOCK + 1 })),
    };
    const lane = {
      buckets: async () => [], read: async () => [],
      rosterBuckets: async () => [{ address: '0:' + '11'.repeat(32) }],
      readSnapshot: async (args: any) => { served.snapshotReads += 1; expect(hex(args.rosterKey)).toBe(hex(record.rosterKeys['0'])); expect(args.pointer.seq).toBe(1); return snapshotRow; },
      readRoster: async (args: any) => { served.rosterReads += 1; expect(args.adminPublicKeys.map(hex)).toContain(hex(record.self!)); return [admitRow]; },
      avatarTip: async () => 0, readAvatar: async () => null,
    };
    const guestSide = runtimeFor(guest, { lane });
    const adopted = await guestSide.runtime.adopt(parseGroupInviteToken(seeded.runtime.secretFor(id) && (await import('../web/group-protocol.mjs')).encodeGroupInviteToken(seeded.runtime.secretFor(id)))!);
    expect(adopted.snapshotApplied).toBe(false);
    expect(adopted.members.length, 'nothing yet').toBe(0);
    expect(adopted.admins.map(hex), 'the inviter is the one admin known').toEqual([hex(record.self!)]);
    expect(adopted.rosterCursor).toBe(withSnapshot.snapshot!.epoch);

    const passes = await guestSide.runtime.sync();
    const seen = passes[0].record;
    expect(served.snapshotReads).toBe(1);
    expect(seen.snapshotApplied).toBe(true);
    expect(seen.members.map((m: any) => m.wallet).sort(), 'the founder from the snapshot, the other from the delta').toEqual([admin.wallet, other.wallet].sort());
    expect(seen.rosterCursor).toBe(Math.floor(CLOCK / 86_400));

    await guestSide.runtime.sync();
    expect(served.snapshotReads).toBe(1);
    expect(served.rosterReads).toBe(2);
  });

  it('GR-07: a sync pass turns the ratchet, reads nothing when nothing moved, and keeps the window', async () => {
    const failures: string[] = [];
    const readStates = vi.fn(async () => new Map());
    const readMessagesWithSource = vi.fn(async () => []);
    let clock = CLOCK;
    const { runtime } = runtimeFor(identityFor(0x71), {
      readStates, readMessagesWithSource, now: () => clock,
      onError: (where: string, e: any) => { failures.push(`${where}: ${e?.message ?? e}`); },
    });
    const record = await runtime.create({ name: 'the kitchen' });
    clock = CLOCK + 2 * 86_400;
    const passes = await runtime.sync();
    expect(failures, 'the pass reported no trouble').toEqual([]);
    expect(passes.length).toBe(1);
    expect(passes[0].record.epochs.length).toBe(3);
    expect(readStates, 'one batched accountStates for the whole group').toHaveBeenCalledTimes(1);
    expect(readMessagesWithSource).not.toHaveBeenCalled();
    expect(passes[0].messages).toEqual([]);
    const reloaded = await runtime.load();
    expect(reloaded[0].epochs.length).toBe(3);
    void record;
  });


  it('GR-10: the first claim of a lane-day reads the chain floor — a sibling device wrote 5, this one claims 6', async () => {
    const readLastSeq = vi.fn(async () => 5);
    const { runtime, sent } = runtimeFor(identityFor(0x91), { readLastSeq });
    const record = await runtime.create({ name: 'two phones' });
    const first = await runtime.say(hex(record.groupId), 'from the second phone');
    expect(readLastSeq, 'the lane floor is read once, before the first claim').toHaveBeenCalledTimes(1);
    expect(first.firstSeq, 'claimed above what the chain holds, not from the empty local counter').toBe(6);
    expect(first.lastSeq).toBe(6);
    expect(first.epoch).toBe(Math.floor(CLOCK / 86_400));
    expect(sent.length).toBe(1);
    const second = await runtime.say(hex(record.groupId), 'and again');
    expect(readLastSeq, 'a message reads the floor again').toHaveBeenCalledTimes(2);
    expect(second.firstSeq).toBe(7);
  });

  it('GR-10B: a floor read that fails refuses the send rather than claiming blind', async () => {
    const { runtime, sent } = runtimeFor(identityFor(0x92), { readLastSeq: async () => { throw new Error('429'); } });
    const record = await runtime.create({ name: 'offline' });
    await expect(runtime.say(hex(record.groupId), 'blind')).rejects.toThrow(/429/);
    expect(sent.length, 'nothing was signed').toBe(0);
  });

  it('GR-11: a pass that reads this device\'s own lane raises its counter — the next claim follows the chain', async () => {
    const identity = identityFor(0x93);
    const seeded = runtimeFor(identity);
    const record = await seeded.runtime.create({ name: 'own rows' });
    const selfKey = record.self!;
    const store = createMemoryGroupRecordStore();
    await store.put(hex(record.groupId), JSON.parse(JSON.stringify((await import('../web/group-store.mjs')).serializeGroupRecord(record))));
    const sent: any[] = [];
    const runtime = createGroupRuntime({
      store, identity, send: async (messages: any[]) => { sent.push(...messages); },
      vaultRouting: async () => ({ vaultAddress: `0:${'aa'.repeat(32)}`, feeDue: 10_000_000n }),
      publishValue: 19_100_000n, now: () => CLOCK, boundary: Math.floor(CLOCK / 86_400),
      random: (n: number) => new Uint8Array(n).fill(0x5C),
      lane: {
        buckets: async () => [{ address: '0:' + '22'.repeat(32), epoch: record.epochs[0].epoch, generation: 0, member: selfKey }],
        rosterBuckets: async () => [], readRoster: async () => [], readSnapshot: async () => null,
        read: async () => [{
          address: '0:' + '22'.repeat(32), epoch: record.epochs[0].epoch, generation: 0, seq: '3', kind: GROUP_KIND.TEXT,
          senderGroupKey: selfKey, sentAt: CLOCK, payload: { text: 'written by my other phone', sentAt: CLOCK },
        }],
      },
    });
    await runtime.load();
    const passes = await runtime.sync();
    expect(passes[0].messages.length).toBe(1);
    expect(passes[0].record.seenSeq['0:' + '22'.repeat(32)], 'the lane\'s highest seq read is remembered for paging').toBe(3);
    const said = await runtime.say(hex(record.groupId), 'mine, after theirs');
    expect(said.firstSeq, 'claimed above the sibling\'s row').toBe(4);
    expect(sent.length).toBe(1);
  });

  it('GR-12: a removal on a stale record is published from TODAY, and the new key is born in the epoch it is written in', async () => {
    const admin = identityFor(0x94);
    const guest = identityFor(0x95);
    const dayZero = runtimeFor(admin);
    const record = await dayZero.runtime.create({ name: 'yesterday' });
    const guestKey = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: guest.vaultSeed, groupId: record.groupId }));
    await dayZero.runtime.admit(hex(record.groupId), [{
      groupKey: guestKey, wallet: guest.wallet, keyId: guest.keyId, name: guest.name,
      x25519PublicKey: guest.x25519PublicKey, mlKem768PublicKey: guest.mlKem768PublicKey,
    }]);
    const stored = createMemoryGroupRecordStore();
    await stored.put(hex(record.groupId), JSON.parse(JSON.stringify((await import('../web/group-store.mjs')).serializeGroupRecord(dayZero.runtime.get(hex(record.groupId))!))));
    const tomorrow = CLOCK + 86_400;
    const later = createGroupRuntime({
      store: stored, identity: admin, send: async () => {},
      vaultRouting: async () => ({ vaultAddress: `0:${'aa'.repeat(32)}`, feeDue: 10_000_000n }),
      publishValue: 19_100_000n, now: () => tomorrow, boundary: Math.floor(CLOCK / 86_400),
      random: (n: number) => new Uint8Array(n).fill(0x5D),
      lane: { buckets: async () => [], rosterBuckets: async () => [], readRoster: async () => [], readSnapshot: async () => null, read: async () => [] },
    });
    await later.load();
    const cut = await later.remove(hex(record.groupId), guestKey, { cutReading: true });
    const today = Math.floor(tomorrow / 86_400);
    const fresh = cut.epochs.find((e: any) => e.generation === 1);
    expect(fresh, 'the new generation was adopted').toBeTruthy();
    expect(fresh!.epoch, 'at today\'s epoch — the one the REMOVE was written in — not the stale record\'s day').toBe(today);
    expect(cut.epochs.some((e: any) => e.generation === 0 && e.epoch === today), 'the record was advanced to today before publishing').toBe(true);
    expect(cut.rosterCursor).toBe(today);
  });

  it('GR-13: a key that is not a curve point is refused at the token and at the admit, and never reaches the roster', async () => {
    const { runtime, sent } = runtimeFor(identityFor(0x96));
    const record = await runtime.create({ name: 'strict' });
    let junk = bytes(0xff);
    for (let fill = 0xff; fill > 0; fill -= 1) {
      junk = bytes(fill);
      try { (await import('../web/vendor/@noble/curves/ed25519.js')).ed25519.Point.fromBytes(junk); } catch { break; }
    }
    sent.length = 0;
    const noted = await runtime.noteCandidate(hex(record.groupId), { groupKey: junk, wallet: '0:' + '77'.repeat(32), keyId: 'k' });
    expect((noted!.candidates ?? []).length, 'not even listed as a candidate').toBe(0);
    const admitted = await runtime.admit(hex(record.groupId), [{ groupKey: junk, wallet: null, keyId: null, name: null, x25519PublicKey: null, mlKem768PublicKey: null }]);
    expect(admitted.members.length, 'the roster is unchanged').toBe(1);
    expect(sent.length, 'and nothing was published').toBe(0);
  });

  it('GR-14: the sender is told the door and whether the vault must be created first', async () => {
    const routes: any[] = [];
    const flight = { wallet: 'W', settled: false };
    const vaultRouting = async () => ({ vaultAddress: `0:${'aa'.repeat(32)}`, feeDue: 10_000_000n, deployVault: true, deployFlight: flight });
    const { runtime } = runtimeFor(identityFor(0x97), { vaultRouting, send: async (_m: any[], route: any) => { routes.push(route); } });
    const record = await runtime.create({ name: 'first message ever' });
    await runtime.say(hex(record.groupId), 'hello');
    expect(routes.length).toBe(1);
    expect(routes[0]).toEqual({ door: 'vault', vaultAddress: `0:${'aa'.repeat(32)}`, deployVault: true, deployFlight: flight });
    expect(routes[0].deployFlight, 'the very flight, not a copy').toBe(flight);
    const direct = runtimeFor(identityFor(0x98), { boundary: Math.floor(CLOCK / 86_400) + 10, send: async (_m: any[], route: any) => { routes.push(route); } });
    const before = await direct.runtime.create({ name: 'before the flip' });
    await direct.runtime.say(hex(before.groupId), 'hello');
    expect(routes[1].door).toBe('direct');
    expect(routes[1].deployVault).toBe(false);
  });


  it('GR-16: the roster cursor holds over a failed roster-lane read, and moves on a clean one', async () => {
    const admin = identityFor(0xa1);
    const member = identityFor(0xa2);
    const seeded = runtimeFor(admin);
    const record = await seeded.runtime.create({ name: 'cursor' });
    const adminKey = record.self!;
    const memberKey = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: member.vaultSeed, groupId: record.groupId }));
    const store = createMemoryGroupRecordStore();
    const dayZero = record.epochs[0].epoch;
    await store.put(hex(record.groupId), JSON.parse(JSON.stringify((await import('../web/group-store.mjs')).serializeGroupRecord({
      ...record, self: memberKey, admins: [adminKey], rosterCursor: dayZero,
      members: [{ groupKey: memberKey, wallet: member.wallet, keyId: member.keyId, name: member.name, x25519PublicKey: member.x25519PublicKey, mlKem768PublicKey: member.mlKem768PublicKey }],
    }))));
    let rosterFails = true;
    const rosterLane = `0:${'a3'.repeat(32)}`;
    const runtime = createGroupRuntime({
      store, identity: member, send: async () => {},
      vaultRouting: async () => ({ vaultAddress: `0:${'aa'.repeat(32)}`, feeDue: 10_000_000n }),
      publishValue: 19_100_000n, now: () => CLOCK + 2 * 86_400, boundary: Math.floor(CLOCK / 86_400),
      lane: {
        buckets: async () => [], readSnapshot: async () => null, read: async () => [],
        rosterBuckets: async ({ epochs }: any) => epochs.map((epoch: number) => ({ address: rosterLane, epoch, generation: 0, member: adminKey, roster: true })),
        readRoster: async ({ onShardFailed }: any) => { if (rosterFails) onShardFailed(rosterLane, new Error('429')); return []; },
      },
    });
    await runtime.load();
    const failed = await runtime.sync();
    expect(failed[0].record.rosterCursor, 'a declined read of an admin lane leaves the cursor where it was').toBe(dayZero);
    rosterFails = false;
    const clean = await runtime.sync();
    expect(clean[0].record.rosterCursor, 'a clean read moves it to today').toBe(Math.floor((CLOCK + 2 * 86_400) / 86_400));
  });

  it('GR-17: a leaving admin leaves the admin set; the last admin cannot be removed; the sole admin cannot leave a room with people in it', async () => {
    const admin = identityFor(0xa4);
    const guest = identityFor(0xa5);
    const { runtime } = runtimeFor(admin);
    const record = await runtime.create({ name: 'admins' });
    const guestKey = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: guest.vaultSeed, groupId: record.groupId }));
    await runtime.admit(hex(record.groupId), [{ groupKey: guestKey, wallet: guest.wallet, keyId: guest.keyId, name: guest.name, x25519PublicKey: guest.x25519PublicKey, mlKem768PublicKey: guest.mlKem768PublicKey }]);
    await expect(runtime.remove(hex(record.groupId), record.self!, { cutReading: false })).rejects.toThrow(/owner cannot be removed/);
    await expect(runtime.leave(hex(record.groupId))).rejects.toThrow(/only admin cannot leave/);
    {
      const { applyGroupRows: fold, serializeGroupRecord: ser, parseGroupRecord: par } = await import('../web/group-store.mjs');
      void fold;
      const legacy = par({ ...ser(runtime.get(hex(record.groupId))), owner: null });
      expect(legacy.owner).toBeNull();
    }
    await expect(runtime.setAdmins(hex(record.groupId), [])).rejects.toThrow(/at least one admin/);
    await expect(runtime.setAdmins(hex(record.groupId), [bytes(0x77)])).rejects.toThrow(/must be a member/);
    const { applyGroupRows } = await import('../web/group-store.mjs');
    const two = await runtime.setAdmins(hex(record.groupId), [record.self!, guestKey]);
    const folded = applyGroupRows(two, [{ epoch: two.epochs[0].epoch, generation: 0, seq: '1', kind: GROUP_KIND.LEAVE, senderGroupKey: guestKey, sentAt: CLOCK, payload: { groupKey: guestKey, sentAt: CLOCK } }]);
    expect(folded.record.members.some((m: any) => hex(m.groupKey) === hex(guestKey))).toBe(false);
    expect(folded.record.admins.some((a: any) => hex(a) === hex(guestKey)), 'gone from the admin set too').toBe(false);
  });

  it('GR-18: malformed KeyShard keys are refused at the token and the admit, and a rekey skips a member it cannot wrap to', async () => {
    const admin = identityFor(0xa6);
    const good = identityFor(0xa7);
    const { runtime, sent } = runtimeFor(admin);
    const record = await runtime.create({ name: 'keys' });
    const goodKey = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: good.vaultSeed, groupId: record.groupId }));
    const badKey = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: bytes(0xa8), groupId: record.groupId }));
    const junkKem = new Uint8Array(1184).fill(0xff);
    sent.length = 0;
    const refused = await runtime.admit(hex(record.groupId), [{ groupKey: badKey, wallet: null, keyId: null, name: null, x25519PublicKey: good.x25519PublicKey, mlKem768PublicKey: junkKem }]);
    expect(refused.members.length, 'not admitted').toBe(1);
    expect(sent.length).toBe(0);
    const noted = await runtime.noteCandidate(hex(record.groupId), { groupKey: badKey, wallet: '0:' + '99'.repeat(32), keyId: 'k', x25519PublicKey: good.x25519PublicKey, mlKem768PublicKey: junkKem });
    expect((noted!.candidates ?? []).length, 'not even a candidate').toBe(0);
    const keyless = await runtime.admit(hex(record.groupId), [{ groupKey: goodKey, wallet: good.wallet, keyId: good.keyId, name: good.name, x25519PublicKey: null, mlKem768PublicKey: null }]);
    expect(keyless.members.length).toBe(2);
    const skipped: any[] = [];
    const envelope = await sealGroupRekeyEnvelope({
      groupId: record.groupId, generation: 1, newKey: bytes(0x7e),
      members: [
        { groupKey: goodKey, x25519PublicKey: good.x25519PublicKey, mlKem768PublicKey: good.mlKem768PublicKey },
        { groupKey: badKey, x25519PublicKey: good.x25519PublicKey, mlKem768PublicKey: junkKem },
      ],
      onSkipped: (member: any) => skipped.push(hex(member.groupKey)),
    });
    expect(skipped).toEqual([hex(badKey)]);
    expect(envelope.length).toBeGreaterThan(0);
  });

  it('GR-19: two sends racing on one group claim distinct seqs, and a pass reports whether the own lane was read', async () => {
    const { runtime } = runtimeFor(identityFor(0xa9));
    const record = await runtime.create({ name: 'race' });
    const [a, b] = await Promise.all([runtime.say(hex(record.groupId), 'one'), runtime.say(hex(record.groupId), 'two')]);
    expect(new Set([a.firstSeq, b.firstSeq]).size, 'serialised under the group lock').toBe(2);
    expect(Math.max(a.firstSeq, b.firstSeq)).toBe(2);
    const own = identityFor(0xaa);
    const seeded = runtimeFor(own);
    const mine = await seeded.runtime.create({ name: 'own lane' });
    const store = createMemoryGroupRecordStore();
    await store.put(hex(mine.groupId), JSON.parse(JSON.stringify((await import('../web/group-store.mjs')).serializeGroupRecord(mine))));
    const ownLane = `0:${'ab'.repeat(32)}`;
    const failing = createGroupRuntime({
      store, identity: own, send: async () => {},
      vaultRouting: async () => ({ vaultAddress: `0:${'aa'.repeat(32)}`, feeDue: 10_000_000n }),
      publishValue: 19_100_000n, now: () => CLOCK, boundary: Math.floor(CLOCK / 86_400),
      lane: {
        buckets: async ({ epochs }: any) => epochs.map((e: any) => ({ address: ownLane, epoch: e.epoch, generation: e.generation, member: mine.self })),
        rosterBuckets: async () => [], readRoster: async () => [], readSnapshot: async () => null,
        read: async ({ onShardFailed }: any) => { onShardFailed(ownLane, new Error('429')); return []; },
      },
    });
    await failing.load();
    const passes = await failing.sync();
    expect(passes[0].ownLaneRead).toBe(false);
  });


  it('GR-20: a hostile invite plants no dead record — every field it names must be well-formed', async () => {
    const { runtime } = runtimeFor(identityFor(0xb1));
    const good = { groupId: 'ab'.repeat(32), key: 'cd'.repeat(32), epoch: Math.floor(CLOCK / 86_400), generation: 0, name: 'x', inviter: null, rosterKey: null, snapshot: null };
    await expect(runtime.adopt({ ...good, generation: 'NaN' })).rejects.toThrow(/generation/);
    await expect(runtime.adopt({ ...good, key: 'cd'.repeat(16) })).rejects.toThrow(/day key/);
    await expect(runtime.adopt({ ...good, rosterKey: 'ef'.repeat(8) })).rejects.toThrow(/roster key/);
    await expect(runtime.adopt({ ...good, inviter: 'ff'.repeat(32) })).rejects.toThrow(/inviter/);
    await expect(runtime.adopt({ ...good, snapshot: { epoch: good.epoch, generation: 0, admin: 'ff'.repeat(32), seq: 1, parts: 1 } })).rejects.toThrow(/snapshot/);
    expect(runtime.list().length, 'nothing was persisted').toBe(0);
    const record = await runtime.adopt(good);
    expect(hex(record.groupId)).toBe('ab'.repeat(32));
  });

  it('GR-21: a join whose auto-admit could not be sent stays a candidate the admin can admit with one press', async () => {
    const admin = identityFor(0xb2);
    const guest = identityFor(0xb3);
    let fail = true;
    const { runtime } = runtimeFor(admin, { send: async () => { if (fail) throw new Error('no GRAM'); } });
    const record = await runtime.create({ name: 'kept' });
    await runtime.noteInvite(hex(record.groupId), { wallet: guest.wallet, keyId: guest.keyId, name: guest.name });
    const guestKey = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: guest.vaultSeed, groupId: record.groupId }));
    const candidate = { groupKey: guestKey, wallet: guest.wallet, keyId: guest.keyId, name: guest.name, x25519PublicKey: guest.x25519PublicKey, mlKem768PublicKey: guest.mlKem768PublicKey };
    const after = await runtime.noteCandidate(hex(record.groupId), candidate);
    expect(after!.members.length, 'not admitted — the send failed').toBe(1);
    expect(after!.candidates.some((c: any) => hex(c.groupKey) === hex(guestKey)), 'but kept as a candidate').toBe(true);
    fail = false;
    const admitted = await runtime.admit(hex(record.groupId), [candidate]);
    expect(admitted.members.length).toBe(2);
    expect(admitted.pendingControl.length, 'the admit waits for its own row to be read back').toBe(1);
    expect(admitted.pendingControl[0].kind).toBe(GROUP_KIND.ADMIT);
  });

  it('GR-22: after a rekey the pass reads the generation just left for two days, and a competing earlier rekey wins — the lost one is published again', async () => {
    const admin = identityFor(0xb4);
    const other = identityFor(0xb5);
    const victim = identityFor(0xb6);
    const requested: any[] = [];
    const rosterRows: any[] = [];
    const { runtime, sent } = runtimeFor(admin, {
      lane: {
        buckets: async () => [], readSnapshot: async () => null, read: async () => [],
        rosterBuckets: async ({ generation, epochs, adminPublicKeys }: any) => {
          requested.push({ generation, epochs: [...epochs] });
          return epochs.flatMap((epoch: number) => adminPublicKeys.map((a: Uint8Array) => ({ address: `0:${hex(a).slice(0, 2).repeat(32)}`, epoch, generation, member: a, roster: true })));
        },
        readRoster: async ({ generation }: any) => rosterRows.filter((r) => r.generation === generation),
      },
    });
    const record = await runtime.create({ name: 'race' });
    const id = hex(record.groupId);
    const otherKey = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: other.vaultSeed, groupId: record.groupId }));
    const victimKey = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: victim.vaultSeed, groupId: record.groupId }));
    await runtime.admit(id, [
      { groupKey: otherKey, wallet: other.wallet, keyId: other.keyId, name: other.name, x25519PublicKey: other.x25519PublicKey, mlKem768PublicKey: other.mlKem768PublicKey },
      { groupKey: victimKey, wallet: victim.wallet, keyId: victim.keyId, name: victim.name, x25519PublicKey: victim.x25519PublicKey, mlKem768PublicKey: victim.mlKem768PublicKey },
    ]);
    await runtime.setAdmins(id, [record.self!, otherKey]);
    const removed = await runtime.remove(id, victimKey, { cutReading: true });
    expect(removed.epochs.some((e: any) => e.generation === 1 && e.speculative === true)).toBe(true);
    const sentBefore = sent.length;
    requested.length = 0;
    await runtime.sync();
    expect(requested.some((r) => r.generation === 1)).toBe(true);
    expect(requested.some((r) => r.generation === 0), 'the generation just left is still read').toBe(true);
    const epoch = Math.floor(CLOCK / 86_400);
    rosterRows.push({
      address: `0:${hex(otherKey).slice(0, 2).repeat(32)}`, epoch, generation: 0, seq: 1, kind: GROUP_KIND.REMOVE, roster: true,
      senderGroupKey: otherKey, sentAt: CLOCK - 100, createdAt: CLOCK - 100,
      payload: { groupKey: bytes(0x99), generation: 1, envelope: new Uint8Array([1, 2, 3]), sentAt: CLOCK - 100 },
    });
    const passes = await runtime.sync();
    const after = passes[0].record;
    expect(after.pendingControl.some((e: any) => e.kind === GROUP_KIND.REMOVE), 'the own REMOVE still waits for its row').toBe(true);
    expect(sent.length, 'nothing more was sent for a rekey that could not be opened').toBe(sentBefore);
  });

  it('GR-15: an invite from further back than the ratchet can walk is refused rather than derived for hours', async () => {
    const { runtime } = runtimeFor(identityFor(0x99));
    const record = await runtime.create({ name: 'old' });
    const secret = runtime.secretFor(hex(record.groupId));
    await expect(runtime.adopt({ ...secret, groupId: 'ab'.repeat(32), epoch: Math.floor(CLOCK / 86_400) - 20_000 }))
      .rejects.toThrow(/out of the ratchet's reach/);
  });

  it('GR-QUEUE-01: the people waiting at the door cost the room nothing', async () => {
    const queueStore = createMemoryGroupRecordStore();
    const recordStore = createMemoryGroupRecordStore();
    const requests = createGroupRequestQueue(queueStore);
    const owner = identityFor(0x21);
    const { runtime } = runtimeFor(owner, { store: recordStore, requests });
    const record = await runtime.create({ name: 'the door' });
    const id = hex(record.groupId);
    const sizeOfRoom = async () => JSON.stringify(await recordStore.get(id)).length;
    const empty = await sizeOfRoom();

    const asker = (n: number) => {
      const seed = new Uint8Array(32); seed[0] = n & 0xff; seed[1] = (n >> 8) & 0xff;
      const kem = ml_kem768.keygen(new Uint8Array(64).fill((n % 200) + 1));
      const xSecret = bytes((n % 200) + 3);
      return {
        groupKey: groupMemberPublicKey(seed), wallet: `0:${String(n).padStart(64, '0')}`, keyId: `k-${n}`,
        name: `asker-${n}`, x25519PublicKey: x25519.getPublicKey(xSecret), mlKem768PublicKey: kem.publicKey,
      };
    };

    const waiting = [asker(1), asker(2), asker(3)];
    for (const one of waiting) await runtime.noteCandidate(id, one);
    expect(runtime.get(id).candidates.map((c: any) => c.name), 'the screen sees them').toEqual(['asker-1', 'asker-2', 'asker-3']);
    expect(await requests.list(id), 'and so does the queue').toHaveLength(3);
    expect(await sizeOfRoom(), 'and the room is the size it was').toBe(empty);
    expect(JSON.stringify(await recordStore.get(id)), 'not one of them is in the room blob').not.toContain('asker-1');

    const { runtime: reopened } = runtimeFor(owner, { store: recordStore, requests });
    await reopened.load();
    expect(reopened.get(id).candidates.map((c: any) => c.name)).toEqual(['asker-1', 'asker-2', 'asker-3']);

    await reopened.admit(id, [waiting[1]]);
    expect((await requests.list(id)).map((c: any) => c.name)).toEqual(['asker-1', 'asker-3']);
    expect(reopened.get(id).members.some((m: any) => hex(m.groupKey) === hex(waiting[1].groupKey))).toBe(true);
  });

  it('GR-QUEUE-02: a room written before the queue moved out gives its waiting people up on the first load', async () => {
    const queueStore = createMemoryGroupRecordStore();
    const recordStore = createMemoryGroupRecordStore();
    const requests = createGroupRequestQueue(queueStore);
    const owner = identityFor(0x22);
    const first = runtimeFor(owner, { store: recordStore });
    const record = await first.runtime.create({ name: 'the old room' });
    const id = hex(record.groupId);
    const seed = new Uint8Array(32); seed[0] = 9;
    const kem = ml_kem768.keygen(new Uint8Array(64).fill(9));
    const xSecret = bytes(11);
    const old = {
      groupKey: groupMemberPublicKey(seed), wallet: `0:${'9'.repeat(64)}`, keyId: 'k-old', name: 'from-the-old-record',
      x25519PublicKey: x25519.getPublicKey(xSecret), mlKem768PublicKey: kem.publicKey,
    };
    const blob: any = await recordStore.get(id);
    blob.candidates = [{
      groupKey: hex(old.groupKey), wallet: old.wallet, keyId: old.keyId, name: old.name,
      x: hex(old.x25519PublicKey), k: hex(old.mlKem768PublicKey), at: 1_790_000_000,
    }];
    await recordStore.put(id, blob);
    expect(JSON.stringify(await recordStore.get(id)), 'the old shape really is in the blob').toContain('from-the-old-record');

    const { runtime: migrated } = runtimeFor(owner, { store: recordStore, requests });
    await migrated.load();
    expect((await requests.list(id)).map((c: any) => c.name), 'lifted into the queue').toEqual(['from-the-old-record']);
    expect(migrated.get(id).candidates, 'and still on screen').toHaveLength(1);
    expect(JSON.stringify(await recordStore.get(id)), 'and gone from the room blob').not.toContain('from-the-old-record');
  });

  it('GR-RENAME-01: an admin renames the room, and the row says only what changed', async () => {
    const owner = identityFor(0x31);
    const { runtime, sent } = runtimeFor(owner);
    const record = await runtime.create({ name: 'the kitchen' });
    const id = hex(record.groupId);
    const before = sent.length;

    const renamed = await runtime.setName(id, 'the yard');
    expect(renamed.name, 'the record wears the new name').toBe('the yard');
    expect(runtime.get(id).name).toBe('the yard');
    expect(sent.length, 'one row on the wire, not a roster and not a picture').toBe(before + 1);

    const again = sent.length;
    await runtime.setName(id, 'the yard');
    expect(sent.length).toBe(again);

    await expect(runtime.setName(id, '   ')).rejects.toThrow(/needs a name/);
    const stranger = identityFor(0x32);
    const theirs = runtimeFor(stranger);
    await theirs.runtime.adopt({
      groupId: id, key: hex(record.epochs[0].key), epoch: record.epochs[0].epoch, generation: 0,
      name: 'the yard', inviter: hex(record.self!), rosterKey: null, snapshot: null,
    } as any);
    await expect(theirs.runtime.setName(id, 'mine now')).rejects.toThrow(/only an admin/);
  });

  it('GR-FEE-01: the owner prices the door — one PROFILE row, believed at once; saying what stands costs nothing; nobody else may', async () => {
    const owner = identityFor(0x41);
    const { runtime, sent } = runtimeFor(owner);
    const record = await runtime.create({ name: 'the kitchen' });
    const id = hex(record.groupId);
    const before = sent.length;
    const priced = await runtime.setEntryFee(id, '5000000000');
    expect(priced.entryFee).toBe('5000000000');
    expect(runtime.get(id).entryFee).toBe('5000000000');
    expect(sent.length, 'one row on the wire').toBe(before + 1);
    expect(priced.pendingControl.at(-1)).toMatchObject({ kind: GROUP_KIND.PROFILE, revert: { entryFee: null } });
    expect(runtime.controlPlan(id, GROUP_KIND.PROFILE, { entryFee: '5000000000' }).count).toBe(1);
    const pricedSnapshot = runtime.snapshotPlan(id)!.parts[0].chunkBytes;
    await runtime.setEntryFee(id, 5000000000n);
    expect(sent.length, 'the same price is not published').toBe(before + 1);
    await expect(runtime.setEntryFee(id, '-1')).rejects.toThrow(/positive/);
    await expect(runtime.setEntryFee(id, '1.5')).rejects.toThrow(/positive/);
    const cleared = await runtime.setEntryFee(id, null);
    expect(cleared.entryFee).toBeNull();
    expect(pricedSnapshot - runtime.snapshotPlan(id)!.parts[0].chunkBytes, 'the snapshot payload said the price').toBe(8);
    expect(sent.length).toBe(before + 2);
    expect(cleared.pendingControl.at(-1)).toMatchObject({ kind: GROUP_KIND.PROFILE, revert: { entryFee: '5000000000' } });
    expect((await runtime.setEntryFee(id, '0')).entryFee, 'zero is free, and free is what stands').toBeNull();
    expect(sent.length).toBe(before + 2);
    const stranger = identityFor(0x46);
    const theirs = runtimeFor(stranger);
    await theirs.runtime.adopt({
      groupId: id, key: hex(record.epochs[0].key), epoch: record.epochs[0].epoch, generation: 0,
      name: 'the kitchen', inviter: hex(record.self!), rosterKey: null, snapshot: null,
    } as any);
    await expect(theirs.runtime.setEntryFee(id, '5')).rejects.toThrow(/owner/);
    const nameless = runtimeFor({ ...identityFor(0x49), wallet: null });
    const unpayable = await nameless.runtime.create({ name: 'nowhere to pay' });
    await expect(nameless.runtime.setEntryFee(hex(unpayable.groupId), '5')).rejects.toThrow(/wallet/);
    expect((await nameless.runtime.setEntryFee(hex(unpayable.groupId), null)).entryFee, 'a free room needs nothing').toBeNull();
  });

  it('GR-DECLINE-01: an admin declines a request — off the list, not brought back by the rescan, kept across a relaunch, nothing on chain; Admit still works', async () => {
    const queueStore = createMemoryGroupRecordStore();
    const recordStore = createMemoryGroupRecordStore();
    const requests = createGroupRequestQueue(queueStore);
    const owner = identityFor(0x23);
    const { runtime, sent } = runtimeFor(owner, { store: recordStore, requests });
    const record = await runtime.create({ name: 'the door' });
    const id = hex(record.groupId);
    const secret = runtime.secretFor(id);
    const tokenOf = async (who: any) => { const side = runtimeFor(who); await side.runtime.adopt(secret); return parseGroupJoinToken(side.runtime.joinTokenFor(id))!; };
    const a = await tokenOf(identityFor(0x31));
    const b = await tokenOf(identityFor(0x32));
    await runtime.noteCandidate(id, a);
    await runtime.noteCandidate(id, b);
    sent.length = 0;
    const declined = await runtime.declineCandidate(id, a.groupKey);
    expect(sent.length, 'nothing is written to the chain').toBe(0);
    expect(groupCandidatesWaiting(declined).map((c: any) => hex(c.groupKey))).toEqual([hex(b.groupKey)]);
    expect((await requests.list(id)).find((row: any) => row.groupKey === hex(a.groupKey)), 'the mark rides the queue row').toMatchObject({ d: 1 });
    expect(groupCandidatesWaiting(await runtime.noteCandidate(id, a)).map((c: any) => hex(c.groupKey))).toEqual([hex(b.groupKey)]);
    const { runtime: reopened } = runtimeFor(owner, { store: recordStore, requests });
    await reopened.load();
    expect(groupCandidatesWaiting(reopened.get(id)).map((c: any) => hex(c.groupKey))).toEqual([hex(b.groupKey)]);
    expect(await reopened.declineCandidate(id, a.groupKey), 'twice changes nothing').toBe(reopened.get(id));
    const held = reopened.get(id).candidates.find((c: any) => hex(c.groupKey) === hex(a.groupKey));
    const seated = await reopened.admit(id, [held]);
    expect(seated.members.some((m: any) => hex(m.groupKey) === hex(a.groupKey))).toBe(true);
    expect((await requests.list(id)).map((row: any) => row.groupKey)).toEqual([hex(b.groupKey)]);
  });

  it('GR-DECLINE-02: a decline decides nothing else — at a priced door a payment still admits, an invitation still admits, and only an admin declines', async () => {
    const admin = identityFor(0x46);
    let answer: any = { paid: false };
    const { runtime } = runtimeFor(admin, { readEntryPayment: async () => answer });
    const record = await runtime.create({ name: 'the kitchen' });
    const id = hex(record.groupId);
    await runtime.setEntryFee(id, '2000000000');
    const secret = runtime.secretFor(id);
    const sides: any[] = [];
    const tokenOf = async (who: any) => { const side = runtimeFor(who); sides.push(side); await side.runtime.adopt(secret); return parseGroupJoinToken(side.runtime.joinTokenFor(id))!; };
    const payer = identityFor(0x47);
    const payerToken = await tokenOf(payer);
    await runtime.noteCandidate(id, payerToken);
    await runtime.declineCandidate(id, payerToken.groupKey);
    expect(groupCandidatesWaiting(runtime.get(id))).toHaveLength(0);
    answer = { paid: true, at: CLOCK };
    expect((await runtime.noteCandidate(id, payerToken)).members.map((m: any) => m.wallet)).toContain(payer.wallet);
    await runtime.setEntryFee(id, null);
    const guest = identityFor(0x48);
    const guestToken = await tokenOf(guest);
    await runtime.noteCandidate(id, guestToken);
    await runtime.declineCandidate(id, guestToken.groupKey);
    await runtime.noteInvite(id, { wallet: guest.wallet, keyId: guest.keyId, name: guest.name });
    expect((await runtime.noteCandidate(id, guestToken)).members.map((m: any) => m.wallet)).toContain(guest.wallet);
    await expect(sides[0].runtime.declineCandidate(id, guestToken.groupKey)).rejects.toThrow(/admin/);
  });

  it('GR-FEE-02: at a priced door a stranger who paid is admitted at once, one who has not waits marked, a guest is never asked, and a removed member pays again', async () => {
    const admin = identityFor(0x42);
    const stranger = identityFor(0x43);
    const invited = identityFor(0x44);
    const asked: any[] = [];
    let answer: any = { paid: false };
    const { runtime, sent } = runtimeFor(admin, {
      readEntryPayment: async (args: any) => { asked.push(args); if (answer instanceof Error) throw answer; return answer; },
    });
    const record = await runtime.create({ name: 'the kitchen' });
    const id = hex(record.groupId);
    await runtime.setEntryFee(id, '2000000000');
    const secret = runtime.secretFor(id);
    const tokenOf = async (who: any) => { const side = runtimeFor(who); await side.runtime.adopt(secret); return parseGroupJoinToken(side.runtime.joinTokenFor(id))!; };
    const strangerToken = await tokenOf(stranger);
    sent.length = 0;
    const waiting = await runtime.noteCandidate(id, strangerToken);
    expect(sent.length).toBe(0);
    expect(waiting.candidates.map((c: any) => [c.wallet, c.paid])).toEqual([[stranger.wallet, false]]);
    expect(asked.at(-1)).toMatchObject({ wallet: stranger.wallet, ownerWallet: admin.wallet, entryFee: '2000000000', since: 0 });
    expect(hex(asked.at(-1).groupId)).toBe(id);
    expect(hex(asked.at(-1).groupKey)).toBe(hex(strangerToken.groupKey));
    answer = new Error('429');
    expect((await runtime.noteCandidate(id, strangerToken)).candidates[0].paid).toBeNull();
    answer = null;
    expect((await runtime.noteCandidate(id, strangerToken)).candidates[0].paid).toBeNull();
    expect(sent.length).toBe(0);
    answer = { paid: true, at: CLOCK };
    const seated = await runtime.noteCandidate(id, strangerToken);
    expect(sent.length, 'one roster payload').toBe(1);
    expect(seated.members.map((m: any) => m.wallet)).toContain(stranger.wallet);
    expect(seated.candidates.length).toBe(0);
    const askedSeated = asked.length;
    expect(await runtime.noteCandidate(id, strangerToken)).toBe(runtime.get(id));
    expect(asked.length, 'no chain read for a member').toBe(askedSeated);
    const askedBefore = asked.length;
    await runtime.noteInvite(id, { wallet: invited.wallet, keyId: invited.keyId, name: invited.name });
    const guest = await runtime.noteCandidate(id, await tokenOf(invited));
    expect(guest.members.map((m: any) => m.wallet)).toContain(invited.wallet);
    expect(asked.length, 'no payment asked of a guest').toBe(askedBefore);
    const removed = await runtime.remove(id, strangerToken.groupKey, { cutReading: false });
    expect(removed.removals[hex(strangerToken.groupKey)]).toBe(CLOCK);
    expect(removed.pendingControl.at(-1).revert.removals).toEqual({});
    answer = { paid: false };
    const again = await runtime.noteCandidate(id, strangerToken);
    expect(asked.at(-1).since).toBe(CLOCK);
    expect(again.candidates.map((c: any) => c.wallet)).toEqual([stranger.wallet]);
    await runtime.setEntryFee(id, null);
    const askedFree = asked.length;
    const other = identityFor(0x45);
    const free = await runtime.noteCandidate(id, await tokenOf(other));
    expect(free.candidates.find((c: any) => c.wallet === other.wallet)?.paid).toBeNull();
    expect(asked.length).toBe(askedFree);
    const blind = runtimeFor(identityFor(0x47));
    const room = await blind.runtime.create({ name: 'blind' });
    await blind.runtime.setEntryFee(hex(room.groupId), '1000');
    const side = runtimeFor(identityFor(0x48)); await side.runtime.adopt(blind.runtime.secretFor(hex(room.groupId)));
    const unseen = await blind.runtime.noteCandidate(hex(room.groupId), parseGroupJoinToken(side.runtime.joinTokenFor(hex(room.groupId)))!);
    expect(unseen.candidates.length).toBe(1);
    expect(unseen.candidates[0].paid).toBeNull();
  });

  it('GR-R4-01: every publisher runs under the group lock — a handover and an admit at once claim two seqs, and the handover survives', async () => {
    const owner = identityFor(0x51);
    const guest = identityFor(0x52);
    const other = identityFor(0x53);
    const { runtime } = runtimeFor(owner);
    const record = await runtime.create({ name: 'handover' });
    const id = hex(record.groupId);
    const memberOf = async (who: any) => ({ groupKey: groupMemberPublicKey(await groupMemberSeed({ vaultSeed: who.vaultSeed, groupId: record.groupId })), wallet: who.wallet, keyId: who.keyId, name: who.name, x25519PublicKey: who.x25519PublicKey, mlKem768PublicKey: who.mlKem768PublicKey });
    const guestMember = await memberOf(guest);
    await runtime.admit(id, [guestMember]);
    const [handover, admitted] = await Promise.all([runtime.transferOwnership(id, guestMember.groupKey), runtime.admit(id, [await memberOf(other)])]);
    const seqs = runtime.get(id).pendingControl.map((e: any) => `${e.kind}@${e.seq}`);
    expect(new Set(runtime.get(id).pendingControl.map((e: any) => e.seq)).size, `distinct seqs: ${seqs.join(' ')}`).toBe(runtime.get(id).pendingControl.length);
    expect(hex(runtime.get(id).owner!), 'the handover is not erased by the admit').toBe(hex(guestMember.groupKey));
    expect(runtime.get(id).members.length).toBe(3);
    void handover; void admitted;
    const { runtime: theirs } = runtimeFor(owner);
    const room = await theirs.create({ name: 'mine' });
    await theirs.admit(hex(room.groupId), [await memberOf(guest)]);
    await expect(theirs.leave(hex(room.groupId))).rejects.toThrow(/cannot leave|hands the group on/);
    await expect(theirs.remove(hex(room.groupId), room.self!, { cutReading: false })).rejects.toThrow(/owner cannot be removed/);
  });

  it('GR-R4-02: an ambiguous broadcast is a send — the seq is consumed and the write believed; a plain failure still fails', async () => {
    const owner = identityFor(0x54);
    let mode: 'ok' | 'ambiguous' | 'dead' = 'ok';
    const { runtime } = runtimeFor(owner, {
      send: async () => {
        if (mode === 'ambiguous') { const error: any = new Error('sendBoc timed out'); error.builtBoc = 'te6cc'; throw error; }
        if (mode === 'dead') throw new Error('no GRAM');
      },
    });
    const record = await runtime.create({ name: 'unsure' });
    const id = hex(record.groupId);
    const first = await runtime.say(id, 'one');
    mode = 'ambiguous';
    const second = await runtime.say(id, 'two');
    expect(second.firstSeq, 'the seq after an ambiguous send is consumed').toBe(first.lastSeq + 1);
    const renamed = await runtime.setName(id, 'believed');
    expect(renamed.name).toBe('believed');
    expect(renamed.pendingControl.at(-1)).toMatchObject({ kind: GROUP_KIND.PROFILE });
    mode = 'ok';
    const third = await runtime.say(id, 'three');
    expect(third.firstSeq, 'and the next claim is above it').toBe(second.lastSeq + 1);
    mode = 'dead';
    await expect(runtime.say(id, 'four')).rejects.toThrow(/no GRAM/);
  });

  it('GR-R4-03: a lift learned from the chain re-reads the lanes on this device — the paging marks and the lane marks of the lanes it concerns are dropped [round 13 — perf-6: those lanes only]', async () => {
    const owner = identityFor(0x56);
    const seeded = runtimeFor(owner);
    const made = await seeded.runtime.create({ name: 'lifted' });
    const guest = identityFor(0x57);
    const guestKey = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: guest.vaultSeed, groupId: made.groupId }));
    await seeded.runtime.admit(hex(made.groupId), [{ groupKey: guestKey, wallet: guest.wallet, keyId: guest.keyId, name: guest.name, x25519PublicKey: guest.x25519PublicKey, mlKem768PublicKey: guest.mlKem768PublicKey }]);
    const held = { ...seeded.runtime.get(hex(made.groupId))!, muted: [guestKey], seenSeq: { ['0:' + '22'.repeat(32)]: 9 } };
    const store = createMemoryGroupRecordStore();
    await store.put(hex(made.groupId), JSON.parse(JSON.stringify((await import('../web/group-store.mjs')).serializeGroupRecord(held))));
    const forgotten: string[] = [];
    const lift = { address: '0:' + '33'.repeat(32), epoch: made.epochs[0].epoch, generation: 0, seq: '2', roster: true, kind: GROUP_KIND.MUTE, senderGroupKey: made.self, payload: { groupKey: guestKey, lift: true, sentAt: CLOCK } };
    const runtime = createGroupRuntime({
      store, identity: owner, send: async () => {},
      vaultRouting: async () => ({ vaultAddress: `0:${'aa'.repeat(32)}`, feeDue: 10_000_000n }),
      publishValue: 19_100_000n, now: () => CLOCK, boundary: Math.floor(CLOCK / 86_400),
      lane: {
        buckets: async () => [{ address: '0:' + '22'.repeat(32), epoch: made.epochs[0].epoch, generation: 0, member: guestKey }],
        rosterBuckets: async () => [{ address: '0:' + '33'.repeat(32), epoch: made.epochs[0].epoch, generation: 0, member: made.self }],
        readRoster: async () => [lift], readSnapshot: async () => null, read: async () => [],
        forgetShards: (addresses: string[]) => { forgotten.push(...addresses); },
      },
    });
    await runtime.load();
    const [pass] = await runtime.sync();
    expect(pass.liftedNow).toEqual([hex(guestKey)]);
    expect(Object.keys(pass.record.seenSeq), 'the lifted member\'s paging marks are dropped, so their window is read again').not.toContain('0:' + '22'.repeat(32));
    expect(forgotten, 'and their lanes\' change marks with them').toContain('0:' + '22'.repeat(32));
    expect(pass.record.seenSeq['0:' + '33'.repeat(32)], 'MEASURED before: every mark of the room dropped').toBe(2);
    expect(forgotten, 'MEASURED before: every held lane forgotten').not.toContain('0:' + '33'.repeat(32));
  });

  it('GR-MUTE-01: an admin mutes and hides on the roster lane — one row each, believed at once, refused where the fold would refuse', async () => {
    const owner = identityFor(0x35);
    const { runtime, sent } = runtimeFor(owner);
    const record = await runtime.create({ name: 'the kitchen' });
    const id = hex(record.groupId);
    const guest = identityFor(0x77);
    const other = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: guest.vaultSeed, groupId: record.groupId }));
    await runtime.admit(id, [{ groupKey: other, wallet: guest.wallet, keyId: guest.keyId, name: guest.name, x25519PublicKey: guest.x25519PublicKey, mlKem768PublicKey: guest.mlKem768PublicKey }]);
    await expect(runtime.mute(id, bytes(0x78)), 'not a member').rejects.toThrow(/not a member/);
    const before = sent.length;
    await expect(runtime.mute(id, record.self!)).rejects.toThrow(/owner/);
    const muted = await runtime.mute(id, other);
    expect(muted.muted.map(hex)).toEqual([hex(other)]);
    expect(sent.length).toBe(before + 1);
    expect(muted.pendingControl.at(-1)).toMatchObject({ kind: GROUP_KIND.MUTE, revert: { muted: [] } });
    await runtime.mute(id, other);
    expect(sent.length).toBe(before + 1);
    const lifted = await runtime.mute(id, other, { lift: true });
    expect(lifted.muted).toEqual([]);
    expect(sent.length).toBe(before + 2);
    await expect(runtime.hide(id, 'nonsense')).rejects.toThrow(/key/);
    const key = `${record.epochs[0].epoch}.0.${hex(other)}.7`;
    const hid = await runtime.hide(id, key, { excerpt: 'x'.repeat(200) });
    expect(hid.hidden[key].excerpt.length).toBe(GROUP_HIDE_EXCERPT_MAX);
    expect(sent.length).toBe(before + 3);
    expect(hid.pendingControl.at(-1)).toMatchObject({ kind: GROUP_KIND.HIDE });
    expect(runtime.controlPlan(id, GROUP_KIND.MUTE, { groupKey: other }).count).toBe(1);
    expect(runtime.controlPlan(id, GROUP_KIND.HIDE, { key, excerpt: 'x'.repeat(80) }).count).toBe(1);
    const stranger = identityFor(0x36);
    const theirs = runtimeFor(stranger);
    await theirs.runtime.adopt({
      groupId: id, key: hex(record.epochs[0].key), epoch: record.epochs[0].epoch, generation: 0,
      name: 'the kitchen', inviter: hex(record.self!), rosterKey: null, snapshot: null,
    } as any);
    await expect(theirs.runtime.mute(id, other)).rejects.toThrow(/only an admin/);
    await expect(theirs.runtime.hide(id, key)).rejects.toThrow(/only an admin/);
  });

  it('GR-RENAME-02: renaming costs one capsule on the roster lane, like naming an admin', async () => {
    const owner = identityFor(0x33);
    const { runtime } = runtimeFor(owner);
    const record = await runtime.create({ name: 'the kitchen' });
    const id = hex(record.groupId);
    const plan = runtime.controlPlan(id, GROUP_KIND.PROFILE, { name: 'a considerably longer room name' });
    expect(plan.count).toBe(1);
    expect(plan.parts[0].sizeClass).toBe(1);
  });


  const memberEntry = (who: any, groupKey: Uint8Array) => ({ groupKey, wallet: who.wallet, keyId: who.keyId, name: who.name, x25519PublicKey: who.x25519PublicKey, mlKem768PublicKey: who.mlKem768PublicKey });
  const rosterLaneOf = (a: Uint8Array) => `0:${hex(a).slice(0, 2).repeat(32)}`;
  const rosterLane = (rosterRows: any[], extra: any = {}) => ({
    buckets: async () => [], readSnapshot: async () => null, read: async () => [],
    rosterBuckets: async ({ generation, epochs, adminPublicKeys }: any) => epochs.flatMap((epoch: number) => adminPublicKeys.map((a: Uint8Array) => ({ address: rosterLaneOf(a), epoch, generation, member: a, roster: true }))),
    readRoster: async ({ generation }: any) => rosterRows.filter((r) => r.generation === generation),
    ...extra,
  });

  it("GR-R5-01: a rekey lost to an earlier rival is made again even when the settle dropped this device's own REMOVE in the same pass", async () => {
    const admin = identityFor(0xc1);
    const other = identityFor(0xc2);
    const victim = identityFor(0xc3);
    const rosterRows: any[] = [];
    const { runtime, sent } = runtimeFor(admin, { lane: rosterLane(rosterRows) });
    const record = await runtime.create({ name: 'lost cut' });
    const id = hex(record.groupId);
    const otherKey = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: other.vaultSeed, groupId: record.groupId }));
    const victimKey = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: victim.vaultSeed, groupId: record.groupId }));
    await runtime.admit(id, [memberEntry(other, otherKey), memberEntry(victim, victimKey)]);
    await runtime.setAdmins(id, [record.self!, otherKey]);
    const removed = await runtime.remove(id, victimKey, { cutReading: true });
    const own = removed.pendingControl.find((e: any) => e.kind === GROUP_KIND.REMOVE && e.rekey);
    expect(own, 'the cut is pending with its rekey material').toBeTruthy();
    const epoch = Math.floor(CLOCK / 86_400);
    const ownEnvelope = await sealGroupRekeyEnvelope({ groupId: record.groupId, generation: 1, newKey: bytes(0x7e), members: [memberEntry(other, otherKey)] });
    rosterRows.push({
      address: rosterLaneOf(record.self!), epoch: Number(own.epoch), generation: Number(own.generation ?? 0), seq: Number(own.seq), kind: GROUP_KIND.REMOVE, roster: true,
      senderGroupKey: record.self!, sentAt: CLOCK, createdAt: CLOCK,
      payload: { groupKey: victimKey, generation: 1, envelope: ownEnvelope, sentAt: CLOCK },
    });
    const rivalEnvelope = await sealGroupRekeyEnvelope({ groupId: record.groupId, generation: 1, newKey: bytes(0x7d), members: [{ groupKey: record.self!, x25519PublicKey: admin.x25519PublicKey, mlKem768PublicKey: admin.mlKem768PublicKey }] });
    rosterRows.push({
      address: rosterLaneOf(otherKey), epoch, generation: 0, seq: 1, kind: GROUP_KIND.REMOVE, roster: true,
      senderGroupKey: otherKey, sentAt: CLOCK - 100, createdAt: CLOCK - 100,
      payload: { groupKey: victimKey, generation: 1, envelope: rivalEnvelope, sentAt: CLOCK - 100 },
    });
    const sentBefore = sent.length;
    const [pass] = await runtime.sync();
    expect(pass.record.pendingControl.some((e: any) => e.kind === GROUP_KIND.REMOVE && Number(e.seq) === Number(own.seq) && Number(e.epoch) === Number(own.epoch)), 'the own row was read back: settled').toBe(false);
    expect(pass.record.generationLost ?? [], 'the loss is answered, not carried').toEqual([]);
    expect(sent.length, 'the cut was made again').toBeGreaterThan(sentBefore);
    expect(pass.record.pendingControl.some((e: any) => e.kind === GROUP_KIND.REMOVE && e.rekey && Number(e.rekey.generation) > 1), 'from the winning generation, one further on').toBe(true);
    expect(pass.record.members.some((m: any) => hex(m.groupKey) === hex(victimKey))).toBe(false);
  });

  it('GR-R5-02: a member admitted by a roster row read this pass has their lane read this same pass — the states batch is completed after the fold', async () => {
    const owner = identityFor(0xc4);
    const other = identityFor(0xc5);
    const newcomer = identityFor(0xc6);
    const laneOf = (k: Uint8Array, epoch: number) => `0:${hex(k).slice(0, 48)}${epoch.toString(16).padStart(16, '0')}`;
    const rosterRows: any[] = [];
    const statesSeen: string[][] = [];
    const readStates = vi.fn(async (addresses: string[]) => new Map(addresses.map((a) => [a, { status: 'active' }])));
    const { runtime } = runtimeFor(owner, {
      readStates,
      lane: rosterLane(rosterRows, {
        buckets: async ({ epochs, memberPublicKeys }: any) => memberPublicKeys.flatMap((k: Uint8Array) => epochs.map((e: any) => ({ address: laneOf(k, Number(e.epoch)), epoch: Number(e.epoch), generation: Number(e.generation ?? 0), member: k }))),
        read: async ({ states }: any) => { statesSeen.push([...(states?.keys?.() ?? [])]); return []; },
      }),
    });
    const record = await runtime.create({ name: 'newcomers' });
    const id = hex(record.groupId);
    const otherKey = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: other.vaultSeed, groupId: record.groupId }));
    await runtime.admit(id, [memberEntry(other, otherKey)]);
    await runtime.setAdmins(id, [record.self!, otherKey]);
    const newKey = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: newcomer.vaultSeed, groupId: record.groupId }));
    const epoch = Math.floor(CLOCK / 86_400);
    rosterRows.push({
      address: rosterLaneOf(otherKey), epoch, generation: 0, seq: 1, kind: GROUP_KIND.ADMIT, roster: true,
      senderGroupKey: otherKey, sentAt: CLOCK, createdAt: CLOCK,
      payload: decodeGroupPayload(GROUP_KIND.ADMIT, encodeGroupAdmit({ members: [memberEntry(newcomer, newKey)], sentAt: CLOCK })),
    });
    readStates.mockClear();
    statesSeen.length = 0;
    const [pass] = await runtime.sync();
    expect(pass.record.members.some((m: any) => hex(m.groupKey) === hex(newKey)), 'the admit folded').toBe(true);
    expect(readStates, 'one batch before the fold, one for the lanes the fold added').toHaveBeenCalledTimes(2);
    expect(readStates.mock.calls[1][0], "the second batch is the newcomer's lanes only").toEqual([laneOf(newKey, epoch)]);
    expect(statesSeen[0], "and the read had the newcomer's state").toContain(laneOf(newKey, epoch));
    readStates.mockClear();
    await runtime.sync();
    expect(readStates).toHaveBeenCalledTimes(1);
  });

  it('GR-R5-03: a rekey envelope addressed to this device that will not open holds the roster cursor at its day — silence is not adoption', async () => {
    const admin = identityFor(0xc7);
    const other = identityFor(0xc8);
    let clock = CLOCK;
    const rosterRows: any[] = [];
    const trouble: string[] = [];
    const { runtime } = runtimeFor(admin, { now: () => clock, lane: rosterLane(rosterRows), onError: (where: string, e: any) => { trouble.push(`${where}: ${e?.message ?? e}`); } });
    const record = await runtime.create({ name: 'held' });
    const id = hex(record.groupId);
    const otherKey = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: other.vaultSeed, groupId: record.groupId }));
    await runtime.admit(id, [memberEntry(other, otherKey)]);
    await runtime.setAdmins(id, [record.self!, otherKey]);
    const yesterday = Math.floor(CLOCK / 86_400);
    const ownAdmin = runtime.get(id)!.pendingControl.find((e: any) => e.kind === GROUP_KIND.ADMIN)!;
    rosterRows.push({
      address: rosterLaneOf(record.self!), epoch: Number(ownAdmin.epoch), generation: Number(ownAdmin.generation ?? 0), seq: Number(ownAdmin.seq), kind: GROUP_KIND.ADMIN, roster: true,
      senderGroupKey: record.self!, sentAt: CLOCK, createdAt: CLOCK,
      payload: { admins: [record.self!, otherKey], owner: record.self!, sentAt: CLOCK },
    });
    clock = CLOCK + 86_400;
    const sound = await sealGroupRekeyEnvelope({ groupId: record.groupId, generation: 1, newKey: bytes(0x7c), members: [{ groupKey: record.self!, x25519PublicKey: admin.x25519PublicKey, mlKem768PublicKey: admin.mlKem768PublicKey }] });
    const corrupt = Uint8Array.from(sound);
    corrupt[corrupt.length - 1] ^= 0xff;
    const rowWith = (envelope: Uint8Array) => ({
      address: rosterLaneOf(otherKey), epoch: yesterday, generation: 0, seq: 1, kind: GROUP_KIND.REMOVE, roster: true,
      senderGroupKey: otherKey, sentAt: CLOCK + 10, createdAt: CLOCK + 10,
      payload: { groupKey: bytes(0x99), generation: 1, envelope, sentAt: CLOCK + 10 },
    });
    rosterRows.push(rowWith(corrupt));
    const [held] = await runtime.sync();
    expect(held.record.epochs.some((e: any) => e.generation === 1), 'nothing adopted from a corrupt envelope').toBe(false);
    expect(held.record.rosterCursor, "held at the row's day, not moved past it").toBe(yesterday);
    rosterRows.length = 0;
    rosterRows.push(rowWith(sound));
    trouble.length = 0;
    const [adopted] = await runtime.sync();
    expect(adopted.record.epochs.some((e: any) => e.generation === 1), `a sound envelope adopts; trouble: ${trouble.join(' | ') || 'none'}`).toBe(true);
  });

  it('GR-R5-04: adopting a room this device already holds keeps the held record; a left room is re-entered; an invite from the future is refused', async () => {
    const owner = identityFor(0xc9);
    const guest = identityFor(0xca);
    const { runtime } = runtimeFor(owner);
    const record = await runtime.create({ name: 'twice' });
    const id = hex(record.groupId);
    const secret = runtime.secretFor(id);
    const side = runtimeFor(guest);
    await side.runtime.adopt(secret);
    await side.runtime.say(id, 'here');
    const held = side.runtime.get(id)!;
    const again = await side.runtime.adopt(secret);
    expect(again, 'the second restorer does not replace what the first folded').toBe(held);
    await side.runtime.leave(id);
    expect(side.runtime.get(id)!.leftAt).toBeTruthy();
    const back = await side.runtime.adopt(secret);
    expect(back.leftAt ?? null, 'a fresh invite re-enters a left room').toBeNull();
    await expect(side.runtime.adopt({ ...secret, groupId: 'cd'.repeat(32), epoch: Math.floor(CLOCK / 86_400) + 5 })).rejects.toThrow(/future/);
  });



  it('GR-R6-01: an admin learned this pass has their roster lane read this same pass — the twin of the member rule', async () => {
    const owner = identityFor(0xd1);
    const other = identityFor(0xd2);
    const third = identityFor(0xd3);
    const newcomer = identityFor(0xd4);
    const rosterRows: any[] = [];
    const asked: string[][] = [];
    const { runtime } = runtimeFor(owner, {
      lane: rosterLane(rosterRows, {
        readRoster: async ({ generation, adminPublicKeys }: any) => {
          asked.push(adminPublicKeys.map((a: Uint8Array) => hex(a)));
          return rosterRows.filter((r) => r.generation === generation && adminPublicKeys.some((a: Uint8Array) => hex(a) === hex(r.senderGroupKey)));
        },
      }),
    });
    const record = await runtime.create({ name: 'appointed' });
    const id = hex(record.groupId);
    const keyOf = async (who: any) => groupMemberPublicKey(await groupMemberSeed({ vaultSeed: who.vaultSeed, groupId: record.groupId }));
    const [otherKey, thirdKey, newKey] = await Promise.all([keyOf(other), keyOf(third), keyOf(newcomer)]);
    await runtime.admit(id, [memberEntry(other, otherKey), memberEntry(third, thirdKey)]);
    await runtime.setAdmins(id, [record.self!, otherKey]);
    const epoch = Math.floor(CLOCK / 86_400);
    rosterRows.push({
      address: rosterLaneOf(record.self!), epoch, generation: 0, seq: 7, kind: GROUP_KIND.ADMIN, roster: true,
      senderGroupKey: record.self!, sentAt: CLOCK + 5, createdAt: CLOCK + 5,
      payload: { admins: [record.self!, otherKey, thirdKey], owner: record.self!, sentAt: CLOCK + 5 },
    });
    rosterRows.push({
      address: rosterLaneOf(thirdKey), epoch, generation: 0, seq: 1, kind: GROUP_KIND.ADMIT, roster: true,
      senderGroupKey: thirdKey, sentAt: CLOCK + 6, createdAt: CLOCK + 6,
      payload: decodeGroupPayload(GROUP_KIND.ADMIT, encodeGroupAdmit({ members: [memberEntry(newcomer, newKey)], sentAt: CLOCK + 6 })),
    });
    asked.length = 0;
    const [pass] = await runtime.sync();
    expect(pass.record.admins.map(hex).sort(), 'the admin was learned').toEqual([hex(record.self!), hex(otherKey), hex(thirdKey)].sort());
    expect(asked.some((set) => set.includes(hex(thirdKey))), 'the new admin\'s lane was asked for in the same pass').toBe(true);
    expect(asked[0], 'and not in the first read, which the record could not know about').not.toContain(hex(thirdKey));
    expect(pass.record.members.some((m: any) => hex(m.groupKey) === hex(newKey)), 'the member they seated is seated here').toBe(true);
    expect(pass.record.rosterCursor, 'every lane read clean: the cursor moves').toBe(epoch);
  });

  it('GR-R6-02: a rekey that will not open drops the roster lanes\' change marks with the cursor — or the next pass skips the unchanged lane and lets go', async () => {
    const admin = identityFor(0xd5);
    const other = identityFor(0xd6);
    let clock = CLOCK;
    const rosterRows: any[] = [];
    const forgotten: string[] = [];
    const { runtime } = runtimeFor(admin, { now: () => clock, lane: rosterLane(rosterRows, { forgetShards: (addresses: string[]) => { forgotten.push(...addresses); } }) });
    const record = await runtime.create({ name: 'held again' });
    const id = hex(record.groupId);
    const otherKey = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: other.vaultSeed, groupId: record.groupId }));
    await runtime.admit(id, [memberEntry(other, otherKey)]);
    await runtime.setAdmins(id, [record.self!, otherKey]);
    const ownAdmin = runtime.get(id)!.pendingControl.find((e: any) => e.kind === GROUP_KIND.ADMIN)!;
    rosterRows.push({ address: rosterLaneOf(record.self!), epoch: Number(ownAdmin.epoch), generation: Number(ownAdmin.generation ?? 0), seq: Number(ownAdmin.seq), kind: GROUP_KIND.ADMIN, roster: true, senderGroupKey: record.self!, sentAt: CLOCK, createdAt: CLOCK, payload: { admins: [record.self!, otherKey], owner: record.self!, sentAt: CLOCK } });
    const yesterday = Math.floor(CLOCK / 86_400);
    clock = CLOCK + 86_400;
    const sound = await sealGroupRekeyEnvelope({ groupId: record.groupId, generation: 1, newKey: bytes(0x7b), members: [{ groupKey: record.self!, x25519PublicKey: admin.x25519PublicKey, mlKem768PublicKey: admin.mlKem768PublicKey }] });
    const corrupt = Uint8Array.from(sound);
    corrupt[corrupt.length - 1] ^= 0xff;
    rosterRows.push({ address: rosterLaneOf(otherKey), epoch: yesterday, generation: 0, seq: 1, kind: GROUP_KIND.REMOVE, roster: true, senderGroupKey: otherKey, sentAt: CLOCK + 10, createdAt: CLOCK + 10, payload: { groupKey: bytes(0x99), generation: 1, envelope: corrupt, sentAt: CLOCK + 10 } });
    const [held] = await runtime.sync();
    expect(held.record.rosterCursor).toBe(yesterday);
    expect(forgotten, 'the lane that carried the envelope is read whole again next pass').toContain(rosterLaneOf(otherKey));
  });

});
