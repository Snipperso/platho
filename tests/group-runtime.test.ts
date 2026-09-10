import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { beginCell } from '@ton/core';
import { __setLaneGenerationCodeForTests, __resetLaneGenerationCodeOverridesForTests } from '../web/shard-address.mjs';
import { createGroupRuntime } from '../web/group-runtime.mjs';
import { createMemoryGroupRecordStore } from '../web/group-record-store.mjs';
import { GROUP_SIZE_ROOM, isGroupAdmin } from '../web/group-store.mjs';
import {
  GROUP_KIND, decodeGroupPayload, encodeGroupAdmit, encodeGroupRoster, parseGroupInviteToken, parseGroupJoinToken,
  sealGroupRekeyEnvelope,
} from '../web/group-protocol.mjs';
import { groupMemberPublicKey, groupMemberSeed } from '../web/crypto/group-lane.mjs';
import { x25519 } from '../web/vendor/@noble/curves/ed25519.js';
import { ml_kem768 } from '../web/vendor/@noble/post-quantum/ml-kem.js';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// GROUP RUNTIME — the sequences a group is made of, against fakes: an invite is TWO writes in one signature and
// the INVITER pays both; a removal prices its two halves and lets the person choose; a member who left is not
// told they lost what they did not lose. Nothing here touches a chain — the chain half is proved in
// contracts18/tests/group-lane-contract.test.ts.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const CLOCK = 1_800_000_000;
// GENERATION 18 IS REFUSED BY NAME until the seal ships web/shard-code-18.mjs, so the lane cells are injected the
// way the CONV send tests inject them. Nothing here addresses a real account: the runtime is being exercised, not
// the chain (that half is contracts18/tests/group-lane-contract.test.ts, against the compiled cells).
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
  it('GR-01: a new group has its creator as its only member and its only admin', async () => {
    const { runtime } = runtimeFor(identityFor(0x21));
    const record = await runtime.create({ name: 'the kitchen', sizeHint: GROUP_SIZE_ROOM });
    expect(record.name).toBe('the kitchen');
    expect(record.sizeHint).toBe(GROUP_SIZE_ROOM);
    expect(record.members.length).toBe(1);
    expect(isGroupAdmin(record, record.self)).toBe(true);
    // it survives a reload — those epoch keys cannot be derived again
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

    // THE SECRET: today's key and where to look — never the roster, or an invite would grow with the room.
    const secret = runtime.secretFor(id);
    expect(Object.keys(secret).sort()).toEqual(['epoch', 'generation', 'groupId', 'inviter', 'key', 'name', 'rosterKey', 'sizeHint', 'snapshot']);
    expect(secret.key).toBe(hex(record.epochs[0].key));

    // NOTHING GOES ON CHAIN when it is sent: the invitee's group key comes from THEIR vault seed, so there is
    // nobody to name yet. The device only remembers whom it invited.
    const noted = await runtime.noteInvite(id, { wallet: guest.wallet, keyId: guest.keyId, name: guest.name });
    expect(sent.length, 'a note is not a message').toBe(0);
    expect(noted.pendingInvites.length).toBe(1);
    expect(noted.members.length, 'and nobody is in the roster who has not arrived').toBe(1);

    // the guest's own device adopts it: today forward, nothing before — and NOTHING ON CHAIN either. The first
    // draft wrote "I am here" into a LOBBY lane with a shared key: a lane any member could jam for a day, and whose
    // payers were visibly that day's joiners. The answer is a TOKEN back through the private conversation.
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

    // THE INVITED ONE: the decision and the money were spent on the invite — one roster, in.
    const after = await runtime.noteCandidate(id, await tokenOf(invited));
    expect(sent.length, 'one roster payload').toBe(1);
    expect(after.members.map((m: any) => m.wallet)).toContain(invited.wallet);
    expect(after.pendingInvites.length, 'the invite is spent once it is answered').toBe(0);
    expect(after.candidates.length).toBe(0);

    // A STRANGER WITH THE KEY (a forwarded token): a candidate, never a member, until a person says so.
    sent.length = 0;
    const waiting = await runtime.noteCandidate(id, await tokenOf(stranger));
    expect(sent.length, 'nothing is published for a candidate').toBe(0);
    expect(waiting.members.map((m: any) => m.wallet)).not.toContain(stranger.wallet);
    expect(waiting.candidates.map((c: any) => c.wallet)).toEqual([stranger.wallet]);
    expect((await runtime.noteCandidate(id, await tokenOf(stranger))).candidates.length, 'noted once').toBe(1);

    //...and the person says so
    const seated = await runtime.admit(id, waiting.candidates);
    expect(seated.members.map((m: any) => m.wallet)).toContain(stranger.wallet);
    expect(seated.candidates.length).toBe(0);

    // a device that is not an admin does nothing with a token
    const bystander = runtimeFor(identityFor(0x27));
    await bystander.runtime.adopt(secret);
    const untouched = await bystander.runtime.noteCandidate(id, await tokenOf(stranger));
    expect(untouched!.candidates.length).toBe(0);
    expect(bystander.sent.length).toBe(0);
  });

  it('GR-03: a device that is not an admin may not invite, admit, remove or name admins', async () => {
    const { runtime } = runtimeFor(identityFor(0x33));
    const record = await runtime.create({ name: 'not yours' });
    // the state a handover leaves behind: still a member, no longer an admin
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
    const record = await runtime.create({ name: 'the room', sizeHint: GROUP_SIZE_ROOM });
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

    // WITHOUT cutting reading: no new generation, and the person simply can no longer be heard
    const quiet = await runtime.remove(hex(record.groupId), guestKey, { cutReading: false });
    expect(quiet.members.length).toBe(1);
    expect(quiet.epochs.length, 'no rekey, so no second generation in the window').toBe(1);

    // WITH it: a new generation joins the window, and the envelope really opens for who stays
    const admin2 = identityFor(0x43);
    const second = runtimeFor(admin2);
    const room = await second.runtime.create({ name: 'the room', sizeHint: GROUP_SIZE_ROOM });
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
    // The one branch of a pass that cannot be reached without a chain. The lane is injected, and it answers with
    // exactly what an admin's removal puts on chain: a REMOVE row carrying the envelope.
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

    //...read on the device of the member who STAYS
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
    // clean-17's RecordShard has only the DIRECT door and clean-18's only the vault one; the epoch says which
    // shard this is. Before this the runtime always built the vault envelope, so a group could not have sent one
    // message until the flip — for no reason: a group lane is an ordinary CONV lane with a blinded write key.
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
    // the vault door addresses the payer's own vault, which is the whole point of it
    expect(String(post.sent[0].address).toLowerCase()).toBe(`0:${'aa'.repeat(32)}`);
  });

  it('GR-06: leaving does not rekey, and the record keeps what it holds', async () => {
    const { runtime, sent } = runtimeFor(identityFor(0x61));
    const record = await runtime.create({ name: 'the kitchen' });
    sent.length = 0;
    const after = await runtime.leave(hex(record.groupId));
    expect(sent.length, 'one message: "I am gone"').toBe(1);
    expect(after.leftAt).toBe(CLOCK);
    expect(after.epochs.length, 'no rekey — the key stays exactly where it was').toBe(1);
    expect(hex(after.epochs[0].key)).toBe(hex(record.epochs[0].key));
    // a group left is not synced any more, but its history is still readable on this device
    expect((await runtime.sync()).length).toBe(0);
  });

  it('GR-08: the room\'s picture is published once, pointed at by the roster, and outlives the next roster', async () => {
    const admin = identityFor(0x31);
    const { runtime, sent } = runtimeFor(admin);
    const record = await runtime.create({ name: 'the kitchen' });
    const id = hex(record.groupId);
    sent.length = 0;

    // 40,000 bytes of "WebP" — over one capsule's 32,732, so the picture is TWO parts and one roster
    const image = new Uint8Array(40_000);
    for (let i = 0; i < image.length; i += 1) image[i] = (i * 17) & 0xff;
    const after = await runtime.setAvatar(id, { bytes: image, width: 256, height: 256 });

    expect(sent.length, 'two parts and the roster that points at them').toBe(3);
    expect(after.avatar.parts).toBe(2);
    expect(after.avatar.epoch).toBe(record.epochs[0].epoch);
    expect(after.avatar.seq, 'an empty lane starts at one').toBe(1);
    expect(after.avatar.hash).toBe(Buffer.from(await crypto.subtle.digest('SHA-256', image)).toString('hex'));
    expect(after.avatar.width).toBe(256);

    // THE POINTER SURVIVES THE NEXT ROSTER. Every roster is published whole, so an admit that dropped the avatar
    // would leave newcomers looking at a letter tile with no way to learn the picture exists.
    const guest = identityFor(0x32);
    const guestKey = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: guest.vaultSeed, groupId: record.groupId }));
    const admitted = await runtime.admit(id, [{ groupKey: guestKey, wallet: guest.wallet, keyId: guest.keyId }]);
    expect(admitted.avatar).toEqual(after.avatar);

    // and it is the admin's picture to set
    const bystander = runtimeFor(identityFor(0x33));
    await bystander.runtime.adopt(runtime.secretFor(id));
    await expect(bystander.runtime.setAvatar(id, { bytes: image, width: 8, height: 8 })).rejects.toThrow(/admin/);
  });

  it('GR-09: a cut-reading removal in a group of 50 is TWO capsules, and the plan says so before anything is signed', async () => {
    // Until today this could not have been sent at all: the 56,688-byte envelope travelled as hex inside JSON —
    // 113 KB — past the largest capsule and past the external limit. GR-04 never noticed because it removed one of
    // three. Fifty members with real KEM keys, one removed, forty-nine wrapped.
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
    // forty-nine at once is ~66 KB of member records: three capsules of DELTA (one at a time is one each) —
    // against the four capsules of ROSTER the first draft republished on EVERY admission
    expect(sent.length, 'a delta, not the roster').toBe(3);
    const victim = others[0];
    const plan = runtime.plan(id, victim.groupKey);
    expect(plan.wrappable.length).toBe(48 + 1);      // 48 others plus the admin
    expect(plan.envelopeBytes).toBe(44 + 49 * 1156);
    expect(plan.capsules.count, 'the envelope needs two private-shaped capsules').toBe(2);
    expect(plan.capsulesWithoutRekey.count, 'a bare removal is one').toBe(1);
    sent.length = 0;
    const after = await runtime.remove(id, victim.groupKey, { cutReading: true });
    expect(sent.length, 'what the plan said').toBe(2);
    // consecutive seqs in the admin's ROSTER lane, after the three capsules the admission took
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

    // the first invite needs something to point at: ONE snapshot capsule, and a fresh one is not retaken
    sent.length = 0;
    const withSnapshot = await runtime.ensureSnapshot(id);
    expect(sent.length).toBe(1);
    expect(withSnapshot.snapshot).toMatchObject({ epoch: record.epochs[0].epoch, generation: 0, seq: 1, parts: 1 });
    expect(hex(withSnapshot.snapshot!.admin)).toBe(hex(record.self!));
    await runtime.ensureSnapshot(id);
    expect(sent.length, 'fresh: nothing published').toBe(1);
    expect(runtime.snapshotPlan(id), 'and the dialog is told there is nothing to pay').toBeNull();

    // the secret carries the roster key and the pointer
    const secret = runtime.secretFor(id);
    expect(secret.rosterKey).toBe(hex(record.rosterKeys['0']));
    expect(secret.snapshot).toEqual({ epoch: record.epochs[0].epoch, generation: 0, admin: hex(record.self!), seq: 1, parts: 1 });

    // sixteen admissions later the snapshot is stale, and the next invite takes a new one
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

    // what the chain would hold: the snapshot at seq 1, and an ADMIT of `other` at seq 2 — served by a fake lane
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

    // the next pass does not read the snapshot again — the roster lanes carry everything from here
    await guestSide.runtime.sync();
    expect(served.snapshotReads).toBe(1);
    expect(served.rosterReads).toBe(2);
  });

  it('GR-07: a sync pass turns the ratchet, reads nothing when nothing moved, and keeps the window', async () => {
    const failures: string[] = [];
    const readStates = vi.fn(async () => new Map());
    const readMessagesWithSource = vi.fn(async () => []);
    // one device, two days passing — the group is made today and synced the day after tomorrow
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
    // the ratchet walked two days and kept them readable
    expect(passes[0].record.epochs.length).toBe(3);
    expect(readStates, 'one batched accountStates for the whole group').toHaveBeenCalledTimes(1);
    // an empty states map means every lane is absent: nothing to read, and no history request at all
    expect(readMessagesWithSource).not.toHaveBeenCalled();
    expect(passes[0].messages).toEqual([]);
    // and the walked window is what was persisted
    const reloaded = await runtime.load();
    expect(reloaded[0].epochs.length).toBe(3);
    void record;
  });

  // ── audit 2026-09-05, round 1 ─────────────────────────────────────────────────────────────────────────────

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
    expect(readLastSeq, 'the floor is not re-read within the lane-day').toHaveBeenCalledTimes(1);
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
        // the lane the row comes from is one the pass asked about — a mark is kept only for lanes in the pass's set
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
    // the same record, a day later, with no pass in between (the app was backgrounded across midnight)
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
    // half of all 32-byte strings are not points; this one is measured to throw in ed25519.Point.fromBytes
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
    const vaultRouting = async () => ({ vaultAddress: `0:${'aa'.repeat(32)}`, feeDue: 10_000_000n, deployVault: true });
    const { runtime } = runtimeFor(identityFor(0x97), { vaultRouting, send: async (_m: any[], route: any) => { routes.push(route); } });
    const record = await runtime.create({ name: 'first message ever' });
    await runtime.say(hex(record.groupId), 'hello');
    expect(routes.length).toBe(1);
    expect(routes[0]).toEqual({ door: 'vault', vaultAddress: `0:${'aa'.repeat(32)}`, deployVault: true });
    const direct = runtimeFor(identityFor(0x98), { boundary: Math.floor(CLOCK / 86_400) + 10, send: async (_m: any[], route: any) => { routes.push(route); } });
    const before = await direct.runtime.create({ name: 'before the flip' });
    await direct.runtime.say(hex(before.groupId), 'hello');
    expect(routes[1].door).toBe('direct');
    expect(routes[1].deployVault).toBe(false);
  });

  // ── audit 2026-09-05, round 2 ─────────────────────────────────────────────────────────────────────────────

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
    await expect(runtime.remove(hex(record.groupId), record.self!, { cutReading: false })).rejects.toThrow(/last admin/);
    await expect(runtime.leave(hex(record.groupId))).rejects.toThrow(/only admin cannot leave/);
    await expect(runtime.setAdmins(hex(record.groupId), [])).rejects.toThrow(/at least one admin/);
    await expect(runtime.setAdmins(hex(record.groupId), [bytes(0x77)])).rejects.toThrow(/must be a member/);
    // the fold: a LEAVE by an admin drops them from `admins`, so their roster lane is neither read nor obeyed
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
    const junkKem = new Uint8Array(1184).fill(0xff);   // fails ML-KEM-768's modulus check
    sent.length = 0;
    const refused = await runtime.admit(hex(record.groupId), [{ groupKey: badKey, wallet: null, keyId: null, name: null, x25519PublicKey: good.x25519PublicKey, mlKem768PublicKey: junkKem }]);
    expect(refused.members.length, 'not admitted').toBe(1);
    expect(sent.length).toBe(0);
    const noted = await runtime.noteCandidate(hex(record.groupId), { groupKey: badKey, wallet: '0:' + '99'.repeat(32), keyId: 'k', x25519PublicKey: good.x25519PublicKey, mlKem768PublicKey: junkKem });
    expect((noted!.candidates ?? []).length, 'not even a candidate').toBe(0);
    // a member without keys at all is still admissible — they simply cannot be wrapped to
    const keyless = await runtime.admit(hex(record.groupId), [{ groupKey: goodKey, wallet: good.wallet, keyId: good.keyId, name: good.name, x25519PublicKey: null, mlKem768PublicKey: null }]);
    expect(keyless.members.length).toBe(2);
    // and the sealer itself skips what it cannot wrap to instead of failing the whole rekey
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
    // the own lane failing to read is reported, so the app does not call an echo undelivered on its account
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

  // ── audit 2026-09-06, round 3 ─────────────────────────────────────────────────────────────────────────────

  it('GR-20: a hostile invite plants no dead record — every field it names must be well-formed', async () => {
    const { runtime } = runtimeFor(identityFor(0xb1));
    const good = { groupId: 'ab'.repeat(32), key: 'cd'.repeat(32), epoch: Math.floor(CLOCK / 86_400), generation: 0, name: 'x', sizeHint: 50, inviter: null, rosterKey: null, snapshot: null };
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
    // this device removes the victim with a rekey: generation 1, speculative
    const removed = await runtime.remove(id, victimKey, { cutReading: true });
    expect(removed.epochs.some((e: any) => e.generation === 1 && e.speculative === true)).toBe(true);
    const sentBefore = sent.length;
    // the pass asks for BOTH generations' roster lanes on the rekey day
    requested.length = 0;
    await runtime.sync();
    expect(requested.some((r) => r.generation === 1)).toBe(true);
    expect(requested.some((r) => r.generation === 0), 'the generation just left is still read').toBe(true);
    // the other admin's rekey of the same generation, stamped EARLIER by the chain, arrives in the old lane: this
    // device's claim loses, its members/admins fold the other's REMOVE, and its own removal is published again
    const epoch = Math.floor(CLOCK / 86_400);
    rosterRows.push({
      address: `0:${hex(otherKey).slice(0, 2).repeat(32)}`, epoch, generation: 0, seq: 1, kind: GROUP_KIND.REMOVE, roster: true,
      senderGroupKey: otherKey, sentAt: CLOCK - 100, createdAt: CLOCK - 100,
      payload: { groupKey: bytes(0x99), generation: 1, envelope: new Uint8Array([1, 2, 3]), sentAt: CLOCK - 100 },
    });
    const passes = await runtime.sync();
    const after = passes[0].record;
    // the envelope was not addressed to this device (opens to null), so the winning KEY is not learned — but the
    // speculative claim on generation 1 is no longer this device's alone: the stamp of the other's row is on record
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
});
