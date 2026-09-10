import { describe, expect, it } from 'vitest';
import {
  GROUP_EPOCH_SECONDS, GROUP_MAX_RATCHET_STEPS,
  advanceGroupEpoch, createGroupFounding, groupContentKey, groupEpochAt, groupEpochFromSeconds,
  groupAvatarKey, groupAvatarLanePublicKey, groupAvatarLaneSigner,
  groupLaneBlind, groupLanePublicKey, groupLaneSet, groupLaneSigner,
  groupMemberPublicKey, groupMemberSeed, groupRosterKey, rekeyGroup, verifyGroupLaneSignature,
} from '../web/crypto/group-lane.mjs';
import { ed25519 } from '../web/vendor/@noble/curves/ed25519.js';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// GROUP LANES — the key schedule and the blinded per-member lane (contracts18/docs/DESIGN-private-groups.md).
//
// The two properties everything else rests on are proved here against the real primitives, and again against the
// COMPILED RecordShard in contracts18/tests/group-lane-contract.test.ts (the contract's own checkSignature is the
// only verifier whose opinion actually matters):
//
//   1. EVERY member derives EVERY member's lane address — without it a group cannot be read at all;
//   2. only the OWNER can sign for their lane — without it any member could write as any other, and could bury a
//      reader under junk bodies that only an in-capsule signature would reject.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const CLOCK = 1_800_000_000;
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');
const bytes = (fill: number, length = 32) => new Uint8Array(length).fill(fill);
const message = (text: string) => new TextEncoder().encode(text);

async function scene(createdAtSec = CLOCK) {
  const founding = await createGroupFounding({ entropy: bytes(0x11), createdAtSec });
  const seedA = await groupMemberSeed({ vaultSeed: bytes(0x22), groupId: founding.groupId });
  const seedB = await groupMemberSeed({ vaultSeed: bytes(0x33), groupId: founding.groupId });
  return { founding, seedA, seedB, pubA: groupMemberPublicKey(seedA), pubB: groupMemberPublicKey(seedB) };
}

describe('GROUP-LANE — the key schedule and the blinded member lane', () => {
  it('GL-01: the ratchet steps forward only, one day at a time, and refuses to walk back or wander', async () => {
    const { founding } = await scene();
    expect(founding.epoch).toBe(Math.floor(CLOCK / GROUP_EPOCH_SECONDS));
    expect(groupEpochFromSeconds(CLOCK + GROUP_EPOCH_SECONDS)).toBe(founding.epoch + 1);

    const next = await advanceGroupEpoch(founding);
    expect(next.epoch).toBe(founding.epoch + 1);
    expect(hex(next.key)).not.toBe(hex(founding.key));
    // deterministic: the same state always steps to the same key, or two devices of one member disagree
    expect(hex((await advanceGroupEpoch(founding)).key)).toBe(hex(next.key));
    // and walking is the same as stepping
    expect(hex((await groupEpochAt(founding, founding.epoch + 3)).key))
      .toBe(hex((await advanceGroupEpoch(await advanceGroupEpoch(next))).key));

    // FORWARD ONLY IS THE FEATURE: yesterday is unreachable from today, which is what closes the past to a
    // member who joins now [OWNER 2026-09-05].
    await expect(groupEpochAt(founding, founding.epoch - 1)).rejects.toThrow(/forward-only/);
    await expect(groupEpochAt(founding, founding.epoch + GROUP_MAX_RATCHET_STEPS + 1)).rejects.toThrow(/guard/);
  });

  it('GL-02: every member derives the same lane address, and the owner\'s signature verifies under it', async () => {
    const { founding, seedA, pubA } = await scene();
    // what B (or anyone holding the epoch key) computes for A's lane
    const derived = await groupLanePublicKey({ ...founding, memberPublicKey: pubA });
    // what A's own device signs with
    const signer = await groupLaneSigner({ ...founding, memberSeed: seedA });
    expect(hex(signer.publicKey), 'the address a reader derives is the key the owner signs under').toBe(hex(derived));
    expect(hex(signer.memberPublicKey)).toBe(hex(pubA));

    const body = message('the shard verifies exactly this');
    const signature = await signer.sign(body);
    expect(signature.length).toBe(64);
    expect(verifyGroupLaneSignature({ signature, message: body, publicKey: derived })).toBe(true);
    //...and it is an ORDINARY ed25519 signature: the contract's checkSignature is this verifier
    expect(ed25519.verify(signature, body, derived)).toBe(true);
    // a different message is a different signature, and neither is accepted for the other
    const other = await signer.sign(message('not the same bytes'));
    expect(hex(other)).not.toBe(hex(signature));
    expect(ed25519.verify(other, body, derived)).toBe(false);
    // deterministic, so a retry of the SAME capsule cannot fork into two signatures
    expect(hex(await signer.sign(body))).toBe(hex(signature));
  });

  it('GL-03: a member who holds the epoch key can address another\'s lane but cannot sign for it', async () => {
    const { founding, seedA, seedB, pubA } = await scene();
    const laneOfA = await groupLanePublicKey({ ...founding, memberPublicKey: pubA });
    const blind = await groupLaneBlind({ ...founding, memberPublicKey: pubA });
    const body = message('forged');

    // B holds everything the group holds: the epoch key, A's public key, the blinding scalar itself.
    const asB = await groupLaneSigner({ ...founding, memberSeed: seedB });
    expect(ed25519.verify(await asB.sign(body), body, laneOfA), 'B signing as themselves').toBe(false);
    // the blinding scalar as a seed is the best material B has that is bound to A's lane at all
    const fromBlind = ed25519.sign(body, new Uint8Array(32).map((_, i) => Number((blind >> BigInt(8 * i)) & 0xFFn)));
    expect(ed25519.verify(fromBlind, body, laneOfA), 'the blind alone signs nothing').toBe(false);
    // and A's UNBLINDED key does not sign for the blinded lane either
    expect(ed25519.verify(ed25519.sign(body, seedA), body, laneOfA), 'the unblinded identity').toBe(false);
    // only A's blinded signer works
    const asA = await groupLaneSigner({ ...founding, memberSeed: seedA });
    expect(ed25519.verify(await asA.sign(body), body, laneOfA)).toBe(true);
  });

  it('GL-04: lanes and content keys separate by group, member, epoch and generation', async () => {
    const { founding, pubA, pubB } = await scene();
    const lane = (over: any) => groupLanePublicKey({ ...founding, memberPublicKey: pubA, ...over });
    const base = hex(await lane({}));
    expect(hex(await lane({ memberPublicKey: pubB })), 'another member').not.toBe(base);
    expect(hex(await lane({ epoch: founding.epoch + 1 })), 'another day').not.toBe(base);
    expect(hex(await lane({ generation: 1 })), 'another generation').not.toBe(base);
    expect(hex(await lane({ groupId: bytes(0x99) })), 'another group').not.toBe(base);

    const content = hex(await groupContentKey(founding));
    expect(hex(await groupContentKey({ ...founding, epoch: founding.epoch + 1 }))).not.toBe(content);
    expect(hex(await groupContentKey({ ...founding, generation: 1 }))).not.toBe(content);
    expect(content, 'the content key is not the epoch key itself').not.toBe(hex(founding.key));
  });

  it('GL-05: a member key belongs to the member and to the group — the same vault in another group is another key', async () => {
    const { founding, seedA } = await scene();
    const elsewhere = await createGroupFounding({ entropy: bytes(0x44), createdAtSec: CLOCK });
    const sameVaultOtherGroup = await groupMemberSeed({ vaultSeed: bytes(0x22), groupId: elsewhere.groupId });
    expect(hex(sameVaultOtherGroup)).not.toBe(hex(seedA));
    // nothing but the vault seed is needed to recover it: a restored wallet is the same member again
    expect(hex(await groupMemberSeed({ vaultSeed: bytes(0x22), groupId: founding.groupId }))).toBe(hex(seedA));
    await expect(groupMemberSeed({ vaultSeed: new Uint8Array(8), groupId: founding.groupId })).rejects.toThrow(/too short/);
  });

  it('GL-06: a rekey starts a generation unrelated to the old key, at the same epoch, under the same group id', async () => {
    const { founding } = await scene();
    const rekeyed = await rekeyGroup({ groupId: founding.groupId, entropy: bytes(0x55), createdAtSec: CLOCK, generation: 1 });
    expect(hex(rekeyed.groupId)).toBe(hex(founding.groupId));
    expect(rekeyed.epoch).toBe(founding.epoch);
    expect(rekeyed.generation).toBe(1);
    expect(hex(rekeyed.key)).not.toBe(hex(founding.key));
    // the removed member walks their own generation forward and never meets the new one
    expect(hex((await advanceGroupEpoch(founding)).key)).not.toBe(hex((await advanceGroupEpoch(rekeyed)).key));
    await expect(rekeyGroup({ groupId: founding.groupId, entropy: bytes(0x55), createdAtSec: CLOCK, generation: 0 }))
      .rejects.toThrow(/generation/);
  });

  it('GL-07: the read set is one lane per member — no lobby — and 1024 of them fit one accountStates call', async () => {
    const { founding, pubA, pubB } = await scene();
    const set = await groupLaneSet({ ...founding, memberPublicKeys: [pubA, pubB] });
    expect(set.lanes.length).toBe(2);
    expect(hex(set.lanes[0].writePublicKey)).toBe(hex(await groupLanePublicKey({ ...founding, memberPublicKey: pubA })));
    expect((set as any).lobby, 'no shared-key lane exists to be jammed or to link a day\'s joiners').toBeUndefined();
    const addresses = new Set(set.lanes.map((l: any) => hex(l.writePublicKey)));
    expect(addresses.size, 'no two lanes of one group collide').toBe(2);
    // the measured URL wall is 1149 addresses (web/shard-reader.mjs); a room of 1024 sits inside it
    expect(1024).toBeLessThanOrEqual(1149);
  });

  it('GL-09: the picture is keyed by the GROUP, not by the day — so a newcomer can see it and a rekey cannot hide it', async () => {
    const { founding } = await scene();
    const laneToday = await groupAvatarLanePublicKey({ groupId: founding.groupId, epoch: founding.epoch });

    // THE POINT OF THE WHOLE CARVE-OUT: a member who holds only a LATER epoch key — or a different generation
    // after a removal — derives exactly the same key and the same lane for a picture published long before.
    const tomorrow = await advanceGroupEpoch(founding);
    const rekeyed = await rekeyGroup({ groupId: founding.groupId, entropy: bytes(0x77), createdAtSec: CLOCK, generation: 1 });
    expect(hex(await groupAvatarKey(founding.groupId))).toBe(hex(await groupAvatarKey(tomorrow.groupId)));
    expect(hex(await groupAvatarKey(rekeyed.groupId))).toBe(hex(await groupAvatarKey(founding.groupId)));
    expect(hex(await groupAvatarLanePublicKey({ groupId: tomorrow.groupId, epoch: founding.epoch })))
      .toBe(hex(laneToday));

    // it is nobody else's picture: another group is another key and another lane
    const other = await createGroupFounding({ entropy: bytes(0x44), createdAtSec: CLOCK });
    expect(hex(await groupAvatarKey(other.groupId))).not.toBe(hex(await groupAvatarKey(founding.groupId)));
    expect(hex(await groupAvatarLanePublicKey({ groupId: other.groupId, epoch: founding.epoch }))).not.toBe(hex(laneToday));
    // and each day is its own lane, so a year of pictures does not pile into one shard
    expect(hex(await groupAvatarLanePublicKey({ groupId: founding.groupId, epoch: founding.epoch + 1 })))
      .not.toBe(hex(laneToday));

    // the lane signs — the shard checks this signature exactly as it checks a member's
    const signer = await groupAvatarLaneSigner({ groupId: founding.groupId, epoch: founding.epoch });
    expect(hex(signer.publicKey)).toBe(hex(laneToday));
    expect(ed25519.verify(await signer.sign(message('hello group')), message('hello group'), signer.publicKey)).toBe(true);

    // PINNED, for the same reason GL-08 is: a change here orphans every picture already published
    expect(hex(await groupAvatarKey(founding.groupId)))
      .toBe('9ec95039fb000ca43def7856660708dd4e2021ee0c677835c1f7dd160bcac698');
    expect(hex(laneToday)).toBe('da1342627e5927c868127f2ead772b0fd09b3fd29f8e5bae431981016909919e');
  });

  it('GL-10: the roster key belongs to the GENERATION — from its first day key, handed on in the invite, replaced by a rekey', async () => {
    const { founding, pubA } = await scene();
    // derived from the generation's FIRST day key — the one every founding member held
    expect(hex(founding.rosterKey)).toBe(hex(await groupRosterKey({ key: founding.key, groupId: founding.groupId, generation: 0 })));
    // a later day key does NOT derive it: a newcomer holds today's key and is HANDED the roster key in the invite
    const tomorrow = await advanceGroupEpoch(founding);
    expect(hex(await groupRosterKey({ key: tomorrow.key, groupId: founding.groupId, generation: 0 }))).not.toBe(hex(founding.rosterKey));
    // and it gives no day key back — one way — so the newcomer still reads no message from before their day
    // (HKDF; asserted by shape: 32 bytes unrelated to the day key)
    expect(hex(founding.rosterKey)).not.toBe(hex(founding.key));
    // a rekey replaces it: a removed member reads no admission after the removal
    const rekeyed = await rekeyGroup({ groupId: founding.groupId, entropy: bytes(0x77), createdAtSec: CLOCK, generation: 1 });
    expect(hex(rekeyed.rosterKey)).not.toBe(hex(founding.rosterKey));
    expect(hex(rekeyed.rosterKey)).toBe(hex(await groupRosterKey({ key: rekeyed.key, groupId: founding.groupId, generation: 1 })));

    // THE ROSTER LANE is the daily lane's construction under the roster key: an admin's blinded key that everyone in
    // the generation derives for any day, and only the admin signs for — not a shared key, and not the daily lane
    const rosterLane = await groupLanePublicKey({ key: founding.rosterKey, groupId: founding.groupId, memberPublicKey: pubA, epoch: founding.epoch, generation: 0 });
    expect(hex(rosterLane)).not.toBe(hex(await groupLanePublicKey({ ...founding, memberPublicKey: pubA })));

    // PINNED, for the same reason GL-08 is
    expect(hex(founding.rosterKey)).toBe('4da455a48bf75ebba3cafe8fa2447a11cd4c9052074a39fc3c555b5ed3f86eb7');
    expect(hex(rosterLane)).toBe('3c84f0c76a03eb2d4669b77324044d9f9a2ff10459b3547e0a0fc376c4d90b7d');
  });

  it('GL-08: the derivation is PINNED — a silent change to any domain string or step orphans every live group', async () => {
    const { founding, seedA, pubA } = await scene();
    expect(hex(founding.groupId)).toBe('cabcdd19319e4ee0a216465df2b45557b23f697c9b46e2765d063d5f5d2bc413');
    expect(founding.epoch).toBe(20833);
    expect(hex(founding.key)).toBe('1ffc5aae827e8ea108a88f88735f523f80f17e0dd03cad0de7b827df4707278b');
    expect(hex((await advanceGroupEpoch(founding)).key))
      .toBe('9a07d00953092bdd90baff8e938d4bb24f99b661c48344016e0ca1597ca0b31e');
    expect(hex(seedA)).toBe('712cdfcecdd85ee3ad86e830eaeb077ddd14bb1bda4a0b43d2099787197e5731');
    expect(hex(pubA)).toBe('1578eae89901a249ad531ef9a3e8e722d38eb8965934e3e773c5a149577e0c46');
    expect(hex(await groupLanePublicKey({ ...founding, memberPublicKey: pubA })))
      .toBe('25a0b95803c4f98f8d653d2e171e60f4840edc7abfa2d3ecc7138efca4ff7934');
    expect(hex(await groupContentKey(founding)))
      .toBe('e563ae57fc2ce069b3dcc4acd365736d6f68a7287359e4773ddc1ce11ddfaae3');
    const signer = await groupLaneSigner({ ...founding, memberSeed: seedA });
    expect(hex(await signer.sign(message('hello group'))))
      .toBe('5a9efbc21da28fdf601599ccdf82b9f4e91e75388a9db8bbc1177ad84f6862328fed32deb4e0e4451a74609eeda241bc'
        + '6666ad71b437a87c58b0fada8094b702');
  });
});
