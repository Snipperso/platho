import { describe, expect, it } from 'vitest';
import {
  GROUP_AVATAR_HEADER_BYTES, GROUP_CAPSULE_TTL_SECONDS, GROUP_INVITE_PREFIX, GROUP_JOIN_PREFIX, GROUP_KIND,
  GROUP_PART_MAX_BYTES, GROUP_REKEY_ENTRY_BYTES, GROUP_WIRE_BODY_PREFIX_BYTES, GROUP_WIRE_HEADER0_BYTES, MLKEM768_CIPHERTEXT_BYTES,
  GROUP_WIRE_HEADER1_BYTES, GROUP_WIRE_NONCE_OFFSET,
  GROUP_MAX_PARTS, assembleGroupParts, decodeGroupMembers, encodeGroupAdmit, encodeGroupAvatar, encodeGroupInviteToken,
  encodeGroupJoinToken, encodeGroupMembers, encodeGroupProfile, groupMembersBytes, parseGroupInviteToken,
  parseGroupJoinToken, decodeGroupPayload, encodeGroupAdmins, encodeGroupLeave, encodeGroupRemove, encodeGroupRoster,
  encodeGroupText, groupAvatarHash, groupCapsulePlan, groupCapsuleWireBytes, groupRekeyEnvelopeBytes,
  openGroupCapsule, openGroupRekeyEnvelope, sealGroupCapsules, sealGroupRekeyEnvelope,
} from '../web/group-protocol.mjs';
import { groupCapsuleCells } from '../web/group-lane-send.mjs';
import {
  createEncryptedConvCapsule, createMessagingIdentity, exportPublicKeyBundle, CONTRACT_CRYPTO_SUITE,
} from '../web/crypto/platho-crypto.mjs';
import { Cell } from '@ton/core';
import { createGroupFounding, groupContentKey, groupMemberPublicKey, groupMemberSeed } from '../web/crypto/group-lane.mjs';
import { x25519 } from '../web/vendor/@noble/curves/ed25519.js';
import { ml_kem768 } from '../web/vendor/@noble/post-quantum/ml-kem.js';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// GROUP PROTOCOL — the capsule shape and the rekey envelope (contracts18/docs/DESIGN-private-groups.md).
//
// The frame is the AEAD's additional data, so the two things a group cannot survive being wrong about are proved
// by the tag itself: a capsule cannot be moved to another epoch/generation/sender/seq, and a rekey can only be
// opened by a member's own KeyShard keys — never by anything the group has ever seen, because the member being
// removed saw all of that.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const CLOCK = 1_800_000_000;
const bytes = (fill: number, length = 32) => new Uint8Array(length).fill(fill);
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

async function scene() {
  const founding = await createGroupFounding({ entropy: bytes(0x11), createdAtSec: CLOCK });
  const contentKey = await groupContentKey(founding);
  const seedA = await groupMemberSeed({ vaultSeed: bytes(0x22), groupId: founding.groupId });
  return { founding, contentKey, pubA: groupMemberPublicKey(seedA) };
}

/** A member as the roster carries them: a group key plus the KeyShard keys a rekey wraps to. */
function member(fill: number) {
  const kem = ml_kem768.keygen(new Uint8Array(64).fill(fill));
  const xSecret = new Uint8Array(32).fill(fill ^ 0x5A);
  return {
    groupKey: bytes(fill),
    wallet: `0:${'ab'.repeat(32)}`,
    keyId: `key-${fill}`,
    x25519SecretKey: xSecret,
    x25519PublicKey: x25519.getPublicKey(xSecret),
    mlKem768SecretKey: kem.secretKey,
    mlKem768PublicKey: kem.publicKey,
  };
}

describe('GROUP-PROTOCOL — capsules and the rekey envelope', () => {
  it('GP-01: a capsule opens only in the lane, day, generation and seq it was sealed for — none of which is on the wire', async () => {
    const { founding, contentKey, pubA } = await scene();
    const context = { groupId: founding.groupId, epoch: founding.epoch, generation: founding.generation, senderGroupKey: pubA };
    const payload = encodeGroupText({ text: 'a message like any other', sentAt: CLOCK });
    const [part] = await sealGroupCapsules({ contentKey, kind: GROUP_KIND.TEXT, payload, context, firstSeq: 7, sentAt: CLOCK });

    // NOTHING ON THE WIRE NAMES THE GROUP, THE DAY, THE WRITER OR THE KIND: the cleartext is a private capsule's.
    expect(part.header0.length).toBe(GROUP_WIRE_HEADER0_BYTES);
    expect(part.header1.length).toBe(GROUP_WIRE_HEADER1_BYTES);
    expect(Buffer.from(part.header0.subarray(0, 4)).toString()).toBe('PH0C');
    expect(Buffer.from(part.header1.subarray(0, 4)).toString()).toBe('PH1B');
    expect(Buffer.from(part.body.subarray(0, 4)).toString()).toBe('PLB1');
    const wire = Buffer.concat([part.header0, part.header1, part.body]);
    for (const secret of [founding.groupId, pubA]) expect(wire.includes(Buffer.from(secret))).toBe(false);
    // a class-1 private body, to the byte: 2,228 — the 64-byte sender-recovery section is inside the class, not on top
    expect(part.body.length).toBe(groupCapsuleWireBytes(1) - GROUP_WIRE_HEADER0_BYTES - GROUP_WIRE_HEADER1_BYTES);
    expect(part.body.length).toBe(2228);

    const opened = await openGroupCapsule({ contentKey, context, seq: 7, header0: part.header0, header1: part.header1, body: part.body });
    expect(opened.kind).toBe(GROUP_KIND.TEXT);
    expect(opened.part).toBe(0);
    expect(opened.parts).toBe(1);
    expect(opened.sentAt).toBe(CLOCK);
    expect(decodeGroupPayload(opened.kind, assembleGroupParts([opened])!)).toEqual({ text: 'a message like any other', replyTo: null, sentAt: CLOCK });

    // THE CONTEXT IS THE AAD: every one of these is a replay into somewhere it did not come from.
    const wrong = [
      ['seq', { context, seq: 8 }],
      ['epoch', { context: { ...context, epoch: founding.epoch + 1 }, seq: 7 }],
      ['generation', { context: { ...context, generation: 1 }, seq: 7 }],
      ['writer', { context: { ...context, senderGroupKey: bytes(0x44) }, seq: 7 }],
      ['group', { context: { ...context, groupId: bytes(0x45) }, seq: 7 }],
    ] as [string, any][];
    for (const [what, over] of wrong) {
      await expect(openGroupCapsule({ contentKey, ...over, header0: part.header0, header1: part.header1, body: part.body }), what).rejects.toThrow();
    }
    //...and the cleartext is bound too: an edited header or body prefix fails the tag
    for (const [what, edit] of [
      ['header0', () => { const h = part.header0.slice(); h[6] ^= 1; return { header0: h, header1: part.header1, body: part.body }; }],
      ['header1', () => { const h = part.header1.slice(); h[8] ^= 1; return { header0: part.header0, header1: h, body: part.body }; }],
      ['body prefix', () => { const b = part.body.slice(); b[40] ^= 1; return { header0: part.header0, header1: part.header1, body: b }; }],
      ['nonce', () => { const b = part.body.slice(); b[GROUP_WIRE_NONCE_OFFSET] ^= 1; return { header0: part.header0, header1: part.header1, body: b }; }],
    ] as [string, () => any][]) {
      await expect(openGroupCapsule({ contentKey, context, seq: 7, ...edit() }), what).rejects.toThrow();
    }
    //...and another (epoch, generation) has another content key, which is the same refusal one layer up
    const otherKey = await groupContentKey({ ...founding, generation: 1 });
    await expect(openGroupCapsule({ contentKey: otherKey, context, seq: 7, header0: part.header0, header1: part.header1, body: part.body })).rejects.toThrow();
  });

  it('GP-02: every control payload round-trips through its own kind, and the join is a token, not a lane message', async () => {
    const { founding, contentKey, pubA } = await scene();
    const context = { groupId: founding.groupId, epoch: founding.epoch, generation: founding.generation, senderGroupKey: pubA };
    const roundTrip = async (kind: number, payload: Uint8Array) => {
      const parts = await sealGroupCapsules({ contentKey, kind, payload, context, firstSeq: 1, sentAt: CLOCK });
      const opened = [];
      for (const part of parts) opened.push(await openGroupCapsule({ contentKey, context, seq: part.seq, header0: part.header0, header1: part.header1, body: part.body }));
      expect(opened[0].kind).toBe(kind);
      return decodeGroupPayload(kind, assembleGroupParts(opened)!);
    };

    const m = member(0x31);
    const roster: any = await roundTrip(GROUP_KIND.ROSTER, encodeGroupRoster({
      members: [{ groupKey: m.groupKey, wallet: m.wallet, keyId: m.keyId, x25519PublicKey: m.x25519PublicKey, mlKem768PublicKey: m.mlKem768PublicKey }],
      admins: [pubA], name: 'the room', sizeHint: 50,
    }));
    expect(roster.name).toBe('the room');
    expect(roster.sizeHint).toBe(50);
    expect(hex(roster.admins[0])).toBe(hex(pubA));
    // the roster carries what a REKEY needs, so a removal never has to go back to the chain for it
    expect(hex(roster.members[0].mlKem768PublicKey)).toBe(hex(m.mlKem768PublicKey));
    expect(hex(roster.members[0].x25519PublicKey)).toBe(hex(m.x25519PublicKey));

    expect(await roundTrip(GROUP_KIND.LEAVE, encodeGroupLeave({ groupKey: pubA, sentAt: CLOCK })))
      .toMatchObject({ sentAt: CLOCK });
    expect(await roundTrip(GROUP_KIND.REMOVE, encodeGroupRemove({ groupKey: pubA, generation: 2, sentAt: CLOCK })))
      .toMatchObject({ generation: 2, envelope: null });
    // THE ENVELOPE RIDES AS RAW BYTES: hex inside JSON doubled it, and at 50 members that was past what any capsule
    // could carry — a cut-reading removal in the default preset could never have been sent.
    const envelope = new Uint8Array(1200).map((_, i) => (i * 13) & 0xff);
    const removed: any = await roundTrip(GROUP_KIND.REMOVE, encodeGroupRemove({ groupKey: pubA, generation: 2, envelope, sentAt: CLOCK }));
    expect(hex(removed.envelope)).toBe(hex(envelope));
    expect(encodeGroupRemove({ groupKey: pubA, generation: 2, envelope, sentAt: CLOCK }).length, 'raw, plus a small head')
      .toBeLessThan(envelope.length + 200);
    expect(await roundTrip(GROUP_KIND.ADMIN, encodeGroupAdmins({ admins: [pubA], sentAt: CLOCK })))
      .toMatchObject({ sentAt: CLOCK });
    await expect(sealGroupCapsules({ contentKey, kind: 99, payload: new Uint8Array(1), context, firstSeq: 1, sentAt: CLOCK }))
      .rejects.toThrow(/unknown group capsule kind/);

    // JOINING IS NOT A LANE MESSAGE. It is a token the newcomer sends back in the private conversation the invite
    // came in — with the KeyShard keys a later rekey must wrap to, or "cut their reading" would wrap to nobody.
    expect((GROUP_KIND as any).JOIN).toBeUndefined();
    const token = encodeGroupJoinToken({ groupId: founding.groupId, groupKey: m.groupKey, wallet: m.wallet, keyId: m.keyId, name: 'Mo', x25519PublicKey: m.x25519PublicKey, mlKem768PublicKey: m.mlKem768PublicKey });
    expect(token.startsWith(GROUP_JOIN_PREFIX)).toBe(true);
    const join = parseGroupJoinToken(token)!;
    expect(join.groupId).toBe(hex(founding.groupId));
    expect(hex(join.groupKey)).toBe(hex(m.groupKey));
    expect(join.name).toBe('Mo');
    expect(hex(join.mlKem768PublicKey!)).toBe(hex(m.mlKem768PublicKey));
    expect(parseGroupInviteToken(token), 'the two tokens are never mistaken for each other').toBeNull();
    expect(parseGroupJoinToken(encodeGroupInviteToken({ groupId: hex(founding.groupId), key: hex(founding.key), epoch: 1, generation: 0 }))).toBeNull();
  });

  it('GP-03: a rekey opens for its recipients and for nobody else — not even with the whole group state', async () => {
    const { founding } = await scene();
    const stays = [member(0x41), member(0x42)];
    const removed = member(0x43);
    const newKey = bytes(0x77);
    const envelope = await sealGroupRekeyEnvelope({
      groupId: founding.groupId, generation: 1, newKey, members: stays,
    });
    expect(envelope.length).toBe(groupRekeyEnvelopeBytes(stays.length));

    for (const who of stays) {
      const opened = await openGroupRekeyEnvelope({
        groupId: founding.groupId, envelope, memberGroupKey: who.groupKey,
        x25519SecretKey: who.x25519SecretKey, mlKem768SecretKey: who.mlKem768SecretKey,
      });
      expect(opened, 'a remaining member gets the new generation').toBeTruthy();
      expect(opened!.generation).toBe(1);
      expect(hex(opened!.key)).toBe(hex(newKey));
    }

    // THE REMOVED MEMBER holds the group key, the roster, the whole envelope — and no entry is theirs.
    expect(await openGroupRekeyEnvelope({
      groupId: founding.groupId, envelope, memberGroupKey: removed.groupKey,
      x25519SecretKey: removed.x25519SecretKey, mlKem768SecretKey: removed.mlKem768SecretKey,
    }), 'the removed member finds nothing addressed to them').toBeNull();

    //...and even holding a REMAINING member's group key does not help without that member's KeyShard secrets
    await expect(openGroupRekeyEnvelope({
      groupId: founding.groupId, envelope, memberGroupKey: stays[0].groupKey,
      x25519SecretKey: removed.x25519SecretKey, mlKem768SecretKey: removed.mlKem768SecretKey,
    })).rejects.toThrow();
  });

  it('GP-04: an envelope is bound to its group and its generation', async () => {
    const { founding } = await scene();
    const who = member(0x51);
    const envelope = await sealGroupRekeyEnvelope({
      groupId: founding.groupId, generation: 3, newKey: bytes(0x88), members: [who],
    });
    const openWith = (groupId: Uint8Array) => openGroupRekeyEnvelope({
      groupId, envelope, memberGroupKey: who.groupKey,
      x25519SecretKey: who.x25519SecretKey, mlKem768SecretKey: who.mlKem768SecretKey,
    });
    expect((await openWith(founding.groupId))!.generation).toBe(3);
    // another group derives another entry tag, so the entry is not even recognised as one's own
    expect(await openWith(bytes(0x99))).toBeNull();
    // move the generation in the header and the entry tag no longer matches: the member finds nothing of theirs,
    // which is the right answer — an envelope for another generation is simply not addressed to this state
    const tampered = envelope.slice();
    tampered[7] ^= 0x01;
    expect(await openGroupRekeyEnvelope({
      groupId: founding.groupId, envelope: tampered, memberGroupKey: who.groupKey,
      x25519SecretKey: who.x25519SecretKey, mlKem768SecretKey: who.mlKem768SecretKey,
    })).toBeNull();
  });

  it('GP-04B: an invite is a token a private message can carry, and nothing else is mistaken for one', async () => {
    const { founding } = await scene();
    const secret = {
      groupId: hex(founding.groupId), key: hex(founding.key), epoch: founding.epoch, generation: 0,
      name: 'the kitchen', sizeHint: 50, inviter: hex(bytes(0x12)),
    };
    const token = encodeGroupInviteToken(secret);
    expect(token.startsWith(GROUP_INVITE_PREFIX)).toBe(true);
    // it carries the KEY and a pointer, never the roster — an invite must not grow with the room
    expect(token.length).toBeLessThan(400);
    expect(parseGroupInviteToken(token)).toMatchObject(secret);
    // ordinary words are never an invite, and a mangled token is not one either
    for (const text of ['hello', '', 'platho.group.invite.v1:not-base64!!', `${GROUP_INVITE_PREFIX}${btoa('{}')}`]) {
      expect(parseGroupInviteToken(text), text).toBeNull();
    }
  });

  it('GP-06: a picture is one payload in as many capsules as it needs, back whole, and only if it is the one the roster named', async () => {
    const { founding, contentKey, pubA } = await scene();
    const context = { groupId: founding.groupId, epoch: founding.epoch, generation: 0, senderGroupKey: pubA };
    const image = new Uint8Array(70_000);
    for (let i = 0; i < image.length; i += 1) image[i] = (i * 31) & 0xff;
    const payload = encodeGroupAvatar({ bytes: image, width: 256, height: 256, sentAt: CLOCK });

    // NOT JSON, NOT BASE64: the WebP sits in the payload byte for byte, behind a 16-byte header.
    expect(payload.length).toBe(GROUP_AVATAR_HEADER_BYTES + image.length);
    expect([...payload.subarray(GROUP_AVATAR_HEADER_BYTES, GROUP_AVATAR_HEADER_BYTES + 8)]).toEqual([...image.subarray(0, 8)]);

    // THE CAPSULE LAYER SPLITS IT, the same way it splits anything: 70,016 bytes are three private-shaped capsules
    const plan = groupCapsulePlan(payload.length);
    expect(plan.count).toBe(3);
    expect(plan.parts.map((p: any) => p.sizeClass)).toEqual([32, 32, 8]);
    expect(plan.wireBytes).toBe(2 * groupCapsuleWireBytes(32) + groupCapsuleWireBytes(8));
    const parts = await sealGroupCapsules({ contentKey, kind: GROUP_KIND.AVATAR, payload, context, firstSeq: 4, sentAt: CLOCK });
    expect(parts.map((p: any) => p.seq)).toEqual([4, 5, 6]);
    const opened = [];
    for (const part of parts) opened.push(await openGroupCapsule({ contentKey, context, seq: part.seq, header0: part.header0, header1: part.header1, body: part.body }));

    // out of order is fine — the chain hands rows back in whatever order a lane was read
    const whole = assembleGroupParts([opened[2], opened[0], opened[1]])!;
    const picture: any = decodeGroupPayload(GROUP_KIND.AVATAR, whole);
    expect(picture.width).toBe(256);
    expect(picture.bytes.length).toBe(image.length);
    expect([...picture.bytes.subarray(0, 16)]).toEqual([...image.subarray(0, 16)]);
    const digest = await groupAvatarHash(image);
    expect(digest).toBe(Buffer.from(await crypto.subtle.digest('SHA-256', image)).toString('hex'));
    expect(await groupAvatarHash(picture.bytes), 'the hash a roster names and a reader checks').toBe(digest);

    // a part missing: nothing, until the next pass — never a half picture
    expect(assembleGroupParts([opened[0], opened[1]])).toBeNull();
    // parts of another message never mix in: the tag and the count must agree
    const [other] = await sealGroupCapsules({ contentKey, kind: GROUP_KIND.AVATAR, payload: payload.subarray(0, 100), context, firstSeq: 9, sentAt: CLOCK });
    const strayPart = await openGroupCapsule({ contentKey, context, seq: 9, header0: other.header0, header1: other.header1, body: other.body });
    expect(assembleGroupParts([opened[0], opened[1], strayPart])).toBeNull();

    // and a roster carries the pointer, not the picture
    const roster: any = decodeGroupPayload(GROUP_KIND.ROSTER, encodeGroupRoster({
      members: [], admins: [], name: 'the kitchen',
      avatar: { epoch: 20833, seq: 4, parts: 3, hash: digest, width: 256, height: 256 },
    }));
    expect(roster.avatar).toEqual({ epoch: 20833, seq: 4, parts: 3, hash: digest, width: 256, height: 256 });
    expect(decodeGroupPayload(GROUP_KIND.ROSTER, encodeGroupRoster({ members: [], admins: [] })).avatar).toBeNull();
  });

  it('GP-07: on the wire a group capsule is a private message — field for field and cell for cell against a real one', async () => {
    // THE REAL THING, from the private lane's own builder: what an observer of any CONV lane sees every day.
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const pairwise: any = await createEncryptedConvCapsule('a private message', exportPublicKeyBundle(recipient.encryptionKeyPair), sender,
      bytes(0x11), { now: CLOCK * 1000 });
    const snakeBytes = (cell: Cell): Uint8Array => {
      const out: Buffer[] = [];
      let at: Cell | undefined = cell;
      while (at) { out.push(at.bits.subbuffer(0, at.bits.length)!); at = at.refs[0]; }
      return new Uint8Array(Buffer.concat(out));
    };
    const shape = (cell: Cell): number[] => {
      const out: number[] = [];
      let at: Cell | undefined = cell;
      while (at) { out.push(at.bits.length, at.refs.length); at = at.refs[0]; }
      return out;
    };
    const real = {
      header0: snakeBytes(Cell.fromBase64(pairwise.chainCells.header0.boc)),
      header1: snakeBytes(Cell.fromBase64(pairwise.chainCells.header1.boc)),
      body: snakeBytes(Cell.fromBase64(pairwise.chainCells.body.boc)),
    };
    expect(real.header0.length).toBe(GROUP_WIRE_HEADER0_BYTES);
    expect(real.header1.length).toBe(GROUP_WIRE_HEADER1_BYTES);
    expect(real.header0[7], 'the private lane sends hybrid — so must we, or the suite byte gives us away').toBe(CONTRACT_CRYPTO_SUITE.HYBRID);

    // OURS, of the same size class
    const { founding, contentKey, pubA } = await scene();
    const context = { groupId: founding.groupId, epoch: founding.epoch, generation: founding.generation, senderGroupKey: pubA };
    const [ours] = await sealGroupCapsules({
      contentKey, kind: GROUP_KIND.TEXT, payload: encodeGroupText({ text: 'a group message', sentAt: CLOCK }), context,
      firstSeq: 1, sentAt: CLOCK, createdAtSec: CLOCK,
    });
    expect(ours.sizeClass, 'both are the smallest class').toBe(real.header0[6]);

    // FIELD FOR FIELD: every byte a private capsule fixes, we fix to the same value; every byte it leaves random, we
    // leave random. header0: magic, version, publishKind, sizeClass, suite — then 32 bytes nobody can read either way.
    expect([...ours.header0.subarray(0, 8)]).toEqual([...real.header0.subarray(0, 8)]);
    // header1: magic, version, flags; then createdAt and expiresAt a day apart, exactly as a private capsule's are
    expect([...ours.header1.subarray(0, 6)]).toEqual([...real.header1.subarray(0, 6)]);
    const u32 = (b: Uint8Array, at: number) => new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(at);
    expect(u32(real.header1, 10) - u32(real.header1, 6), 'the private lane lives a day').toBe(GROUP_CAPSULE_TTL_SECONDS);
    expect(u32(ours.header1, 10) - u32(ours.header1, 6)).toBe(GROUP_CAPSULE_TTL_SECONDS);
    expect(u32(ours.header1, 6)).toBe(CLOCK);
    // body: magic, version, suite, flags, reserved — then message id, nonce, ephemeral, KEM ciphertext, all random
    // to anyone without keys — and the SAME LENGTH, because the plaintext is padded to the same class
    expect([...ours.body.subarray(0, 8)]).toEqual([...real.body.subarray(0, 8)]);
    expect(ours.body.length).toBe(real.body.length);
    // THE THREE TELLS [audit 2026-09-05, round 1]. "Random to anyone without keys" was not what a private body
    // carries in three places, and this gate could not see any of them:
    //   (a) the sender-recovery section opens with the CONSTANT "PSR1" at 1156 — a 4-byte marker in cleartext;
    //   (b) the X25519 ephemeral at 36..68 never has its top bit set (u < 2^255 - 19);
    //   (c) the ML-KEM-768 ciphertext at 68..1156 is not uniform — GP-08 rebuilds it from the seeds.
    expect(Buffer.from(real.body.subarray(1156, 1160)).toString('latin1'), 'the private body carries its magic in cleartext').toBe('PSR1');
    expect([...ours.body.subarray(1156, 1160)], 'so must ours').toEqual([...real.body.subarray(1156, 1160)]);
    expect(real.body[67] & 0x80, 'a real X25519 public key').toBe(0);
    expect(ours.body[67] & 0x80, 'ours is a real X25519 public key too, not 32 random bytes').toBe(0);

    // CELL FOR CELL: the bytes are cut into the account's cells the same way (127 from the front, the short one last)
    const cells = groupCapsuleCells(ours).chainCells;
    expect(shape(Cell.fromBase64(cells.header0.boc))).toEqual(shape(Cell.fromBase64(pairwise.chainCells.header0.boc)));
    expect(shape(Cell.fromBase64(cells.header1.boc))).toEqual(shape(Cell.fromBase64(pairwise.chainCells.header1.boc)));
    expect(shape(Cell.fromBase64(cells.body.boc))).toEqual(shape(Cell.fromBase64(pairwise.chainCells.body.boc)));
    //...and what went in comes back out of the cells unchanged
    expect(hex(snakeBytes(Cell.fromBase64(cells.body.boc)))).toBe(hex(ours.body));

    // A PART IS NEVER LARGER THAN THE LARGEST PRIVATE CAPSULE, so there is no size a private message could not have
    expect(GROUP_PART_MAX_BYTES).toBe(32768 - 64);
    expect(groupCapsulePlan(GROUP_PART_MAX_BYTES).count).toBe(1);
    expect(groupCapsulePlan(GROUP_PART_MAX_BYTES + 1).count).toBe(2);
    expect(groupCapsuleWireBytes(32) - GROUP_WIRE_HEADER0_BYTES - GROUP_WIRE_HEADER1_BYTES, 'a class-32 private body').toBe(1156 + 32 + 32768 + 16);
  });

  it('GP-11: the shaped cleartext fields are GENUINE — a real X25519 key and a real ML-KEM-768 encapsulation, rebuilt from the same draws', async () => {
    // [audit 2026-09-05, round 1] Random bytes where a private body carries a curve point and a KEM ciphertext were a
    // tell (top bit set half the time; compressed coefficients not uniform). The builder now draws throwaway seeds
    // and produces the real thing. A deterministic draw stream is replayed here and each field is found among the
    // constructions those draws produce — whatever order the builder makes them in.
    const { founding, contentKey, pubA } = await scene();
    const context = { groupId: founding.groupId, epoch: founding.epoch, generation: founding.generation, senderGroupKey: pubA };
    const draws: Uint8Array[] = [];
    let n = 0;
    const stream = (len: number) => {
      const out = new Uint8Array(len);
      for (let i = 0; i < len; i += 1) out[i] = (n * 131 + i * 7 + 3) & 0xff;
      n += 1;
      draws.push(out);
      return out;
    };
    const [ours] = await sealGroupCapsules({
      contentKey, kind: GROUP_KIND.TEXT, payload: encodeGroupText({ text: 'seeded', sentAt: CLOCK }), context,
      firstSeq: 1, sentAt: CLOCK, createdAtSec: CLOCK, random: stream,
    });
    const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
    const ephemeral = ours.body.subarray(36, 68);
    const kemCiphertext = ours.body.subarray(68, 68 + MLKEM768_CIPHERTEXT_BYTES);
    const seeds32 = draws.filter((d) => d.length === 32);
    const seeds64 = draws.filter((d) => d.length === 64);
    expect(seeds32.some((seed) => hex(x25519.getPublicKey(seed)) === hex(ephemeral)), 'the ephemeral is x25519(seed) for one of the 32-byte draws').toBe(true);
    let genuine = false;
    for (const seed of seeds64) {
      const kem = ml_kem768.keygen(seed);
      for (const coins of seeds32) {
        if (hex(ml_kem768.encapsulate(kem.publicKey, coins).cipherText) === hex(kemCiphertext)) genuine = true;
      }
    }
    expect(genuine, 'the KEM ciphertext is an encapsulation to a throwaway key made from the draws').toBe(true);
    expect(Buffer.from(ours.body.subarray(1156, 1160)).toString('latin1')).toBe('PSR1');
    // and none of it is the plaintext's business: the capsule still opens
    const opened = await openGroupCapsule({ contentKey, context, seq: 1, header0: ours.header0, header1: ours.header1, body: ours.body });
    expect(opened.kind).toBe(GROUP_KIND.TEXT);
  });

  it('GP-08: membership travels as deltas and snapshots in a compact record — a room of 1024 fits under the cap, an admission is one capsule', async () => {
    const m = (i: number) => ({
      groupKey: bytes(i & 0xff), wallet: `0:${'ab'.repeat(32)}`, keyId: `k-${i}`, name: `member ${i}`,
      x25519PublicKey: bytes(0x60), mlKem768PublicKey: bytes(0x61, 1184),
    });
    // the record round-trips, absent keys included
    const bare = { groupKey: bytes(9), wallet: null, keyId: null, name: null, x25519PublicKey: null, mlKem768PublicKey: null };
    const { members: back } = decodeGroupMembers(encodeGroupMembers([m(1), bare]));
    expect(back.length).toBe(2);
    expect(hex(back[0].mlKem768PublicKey!)).toBe(hex(bytes(0x61, 1184)));
    expect(back[0].name).toBe('member 1');
    expect(back[1]).toEqual(bare);

    // SIZES — the whole point. As hex-in-JSON a member was ~2.6 KB; here ~1.33 KB, and that is the ML-KEM key.
    const fifty = Array.from({ length: 50 }, (_, i) => m(i));
    const room = Array.from({ length: 1024 }, (_, i) => m(i));
    expect(groupMembersBytes(room)).toBeLessThan(1024 * 1400);
    expect(groupCapsulePlan(encodeGroupRoster({ members: fifty, admins: [bytes(1)], name: 'the kitchen', sentAt: 1 }).length).count, 'fifty: three capsules').toBe(3);
    const roomPlan = groupCapsulePlan(encodeGroupRoster({ members: room, admins: [bytes(1)], name: 'the room', sentAt: 1 }).length);
    expect(roomPlan.count, 'a room: 42 capsules').toBe(42);
    expect(roomPlan.count).toBeLessThanOrEqual(GROUP_MAX_PARTS);
    expect(groupCapsulePlan(encodeGroupAdmit({ members: [m(3)], sentAt: 1 }).length).count, 'an admission: one capsule, whatever the room').toBe(1);
    expect(groupCapsulePlan(encodeGroupAdmit({ members: room.slice(0, 16), sentAt: 1 }).length).count, 'sixteen at once: still one').toBe(1);

    // the snapshot decodes whole, the admission decodes whole
    const snap: any = decodeGroupPayload(GROUP_KIND.ROSTER, encodeGroupRoster({
      members: fifty, admins: [bytes(1)], name: 'the kitchen', sizeHint: 50,
      avatar: { epoch: 20833, seq: 4, parts: 2, hash: 'ab'.repeat(32), width: 1, height: 2 }, sentAt: 77,
    }));
    expect(snap.members.length).toBe(50);
    expect(snap.name).toBe('the kitchen');
    expect(snap.avatar.parts).toBe(2);
    expect(snap.sentAt).toBe(77);
    const admit: any = decodeGroupPayload(GROUP_KIND.ADMIT, encodeGroupAdmit({ members: [m(7), m(8)], sentAt: 5 }));
    expect(admit.members.map((x: any) => x.name)).toEqual(['member 7', 'member 8']);
    expect(admit.sentAt).toBe(5);

    // a profile says only what changed; `avatar: null` REMOVES the picture, an absent field leaves it alone
    const cleared: any = decodeGroupPayload(GROUP_KIND.PROFILE, encodeGroupProfile({ avatar: null, sentAt: 1 }));
    expect('avatar' in cleared).toBe(true);
    expect(cleared.avatar).toBeNull();
    expect('name' in cleared).toBe(false);
    const renamed: any = decodeGroupPayload(GROUP_KIND.PROFILE, encodeGroupProfile({ name: 'the pantry', sentAt: 2 }));
    expect(renamed.name).toBe('the pantry');
    expect('avatar' in renamed).toBe(false);

    // the invite carries the roster key and the snapshot pointer; an old invite without them still parses
    const token = encodeGroupInviteToken({
      groupId: 'aa'.repeat(32), key: 'bb'.repeat(32), rosterKey: 'cc'.repeat(32), epoch: 1, generation: 0,
      snapshot: { epoch: 20833, generation: 0, admin: 'dd'.repeat(32), seq: 3, parts: 2 },
    });
    const parsed = parseGroupInviteToken(token)!;
    expect(parsed.rosterKey).toBe('cc'.repeat(32));
    expect(parsed.snapshot).toEqual({ epoch: 20833, generation: 0, admin: 'dd'.repeat(32), seq: 3, parts: 2 });
    const bareToken = parseGroupInviteToken(encodeGroupInviteToken({ groupId: 'aa'.repeat(32), key: 'bb'.repeat(32), epoch: 1, generation: 0 }))!;
    expect(bareToken.rosterKey).toBeNull();
    expect(bareToken.snapshot).toBeNull();
  });

  it('GP-05: the price of a removal in bytes is the figure the design states', async () => {
    // 1,156 bytes a member: an ML-KEM-768 ciphertext (1,088) plus the nonce, the wrapped key and its tag, plus
    // the 8-byte hint that lets a member find their own entry in one step instead of 1,024 decapsulations.
    expect(GROUP_REKEY_ENTRY_BYTES).toBe(1156);
    expect(groupRekeyEnvelopeBytes(49)).toBe(44 + 49 * 1156);      // a group of 50, one member removed
    expect(groupRekeyEnvelopeBytes(1023)).toBe(44 + 1023 * 1156);  // a room of 1024
    // and the room's envelope needs more than one external message (65,535 bytes), exactly as the design says
    expect(groupRekeyEnvelopeBytes(1023)).toBeGreaterThan(65_535);
    expect(groupRekeyEnvelopeBytes(49)).toBeLessThan(65_535);
  });
});
