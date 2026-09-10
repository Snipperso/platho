// PLATHO — sending into a private group lane. The whole file is an ADAPTER: a group capsule is shaped so that the
// CONV send path, unchanged, carries it. Nothing here talks to the chain; nothing here decides policy.
// Design: contracts18/docs/DESIGN-private-groups.md.
//
// A group message is an ordinary CONV publish with two substitutions:
//   * the write key is the sender's BLINDED lane key (crypto/group-lane.mjs) — a signer, not a seed, which is why
//     the builders take `sign`;
//   * the three capsule cells carry the group's own sealed payload (group-protocol.mjs), shaped byte for byte as a
//     private message's — down to how the bytes are cut into cells.
//
// Everything else — the vault door (the only door clean-18 has), the generation, the StateInit halves, the squat
// cushion, the value — is the private lane's, because a group message IS a private message as far as the chain
// can tell. That is the property the whole design rests on, and it is why this file is short.
//
// A payload larger than one size class travels as PARTS: consecutive seqs in the same lane, each its own wallet
// message. The builders therefore answer with ARRAYS, and the caller signs them together.

import { groupAvatarKey, groupAvatarLaneSigner, groupContentKey, groupLaneSigner } from './crypto/group-lane.mjs?v=5';
import { sealGroupCapsules, GROUP_AVATAR_SENDER, GROUP_KIND } from './group-protocol.mjs?v=9';
import { buildConvPublishViaVaultMessage, buildConvPublishWalletMessage } from './conv-lane-send.mjs?v=62';
import { serializeBoc, tonCell } from './pwa-contract-transactions.mjs?v=47';
import { PLATHO_ONCHAIN_CELL_DATA_BYTES } from './crypto/platho-crypto.mjs?v=21';

/**
 * Bytes to a snake cell CUT THE WAY A PRIVATE CAPSULE IS CUT: full 127-byte cells from the FRONT, the short one
 * last (platho-crypto's buildSnakeCell). pwa-contract-transactions' snakeCellFromBytes cuts from the END, short
 * cell first, and a reader of the raw account would see that difference in the cell tree — the one tell the byte
 * layout alone would not close. GP-07 lays the two trees side by side.
 */
export function privateShapedSnakeCell(bytes, name = 'group cell') {
  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += PLATHO_ONCHAIN_CELL_DATA_BYTES) {
    chunks.push(bytes.subarray(offset, offset + PLATHO_ONCHAIN_CELL_DATA_BYTES));
  }
  if (chunks.length === 0) chunks.push(new Uint8Array(0));
  let tail = null;
  for (let index = chunks.length - 1; index >= 0; index -= 1) {
    const builder = tonCell.beginCell().bytesValue(chunks[index], chunks[index].length, name);
    if (tail) builder.ref(tail, 'snake tail');
    tail = builder.endCell();
  }
  return tail;
}

/** The three cells a CONV publish carries, in the shape `convCapsuleCells` reads, from one sealed part. */
export function groupCapsuleCells({ header0, header1, body }) {
  const cell = (bytes, name) => ({ boc: tonCell.bytesToBase64(serializeBoc(privateShapedSnakeCell(bytes, name))) });
  return {
    chainCells: {
      header0: cell(header0, 'group header0'),
      header1: cell(header1, 'group header1'),
      body: cell(body, 'group body'),
    },
    bytes: header0.length + header1.length + body.length,
  };
}

/**
 * Every part of one payload, sealed for this member's lane of `state` = { groupId, key, epoch, generation }.
 * `memberSeed` is this device's own group seed (crypto/group-lane.mjs groupMemberSeed) and never leaves it.
 * `firstSeq` must strictly exceed this member's own lane high-water for the day: a member's lane has exactly one
 * writer (their devices), so the two-device seq claim of the private lane applies unchanged.
 */
export async function buildGroupCapsules({ state, memberSeed, kind = GROUP_KIND.TEXT, payload, firstSeq, sentAt, random }) {
  const contentKey = await groupContentKey(state);
  const signer = await groupLaneSigner({ ...state, memberSeed });
  const parts = await sealGroupCapsules({
    contentKey, kind, payload, firstSeq, sentAt,
    context: { groupId: state.groupId, epoch: state.epoch, generation: state.generation, senderGroupKey: signer.memberPublicKey },
    ...(random ? { random } : {}),
  });
  return { signer, parts: parts.map((part) => ({ ...part, capsule: groupCapsuleCells(part) })) };
}

/**
 * One wallet message per part, through the door the caller named. `door` is 'vault' (clean-18: the only door its
 * RecordShard has, and the one with the ATH discount) or 'direct' (clean-17). The caller chooses BY GENERATION,
 * exactly as a private message does — the epoch owns the generation.
 */
async function messagesFor({ signer, parts, epoch, door, vaultAddress, feeDue, value, boundary, attachStateInit = true }) {
  if (door !== 'vault' && door !== 'direct') throw new RangeError(`unknown group door ${door}`);
  const messages = [];
  for (const part of parts) {
    const common = {
      writePublicKey: signer.publicKey,
      sign: signer.sign,
      seq: BigInt(part.seq),
      epoch: BigInt(epoch),
      capsule: part.capsule,
      value,
      ...(boundary === undefined ? {} : { boundary }),
    };
    // THE HALVES RIDE THE FIRST PART ALONE, and only when the caller does not know the lane to be live [audit 2026-09-05,
    // round 2]: every later part follows a first that created the shard, and a lane the chain already holds needs
    // none (a RecordShard's halves cost ~703,667 nanoton a hop, on both hops through the vault door).
    const attachHere = attachStateInit && messages.length === 0;
    const built = door === 'vault'
      ? await buildConvPublishViaVaultMessage({ ...common, vaultAddress, capsuleBytes: part.capsule.bytes, feeDue, attachStateInit: attachHere })
      : await buildConvPublishWalletMessage(common);
    // `sizeClass`, `seq` and `wireBytes` ride beside the wallet message so the payer's pre-flight can size its fee
    // reserve by class (wallet-send-fee.mjs); `shard` is the lane the capsule lands in — the address itself on the
    // direct door, the shard the vault forwards to on the vault door — so the sender can carry the squat cushion and
    // debt of THAT account (web/shard-debt.mjs), as every private publish does. The sender strips all four before
    // signing.
    messages.push({ ...built.message, sizeClass: part.sizeClass, seq: part.seq, wireBytes: part.wireBytes, shard: built.shard ?? built.to });
  }
  return messages;
}

function summary(parts, firstSeq) {
  return {
    firstSeq: Number(firstSeq),
    lastSeq: Number(firstSeq) + parts.length - 1,
    count: parts.length,
    wireBytes: parts.reduce((sum, part) => sum + part.wireBytes, 0),
  };
}

/** One payload into this member's lane: the messages to sign together, and where the lane's seq now stands. */
export async function buildGroupPublishMessages({
  state, memberSeed, kind = GROUP_KIND.TEXT, payload, firstSeq, sentAt, random,
  door, vaultAddress, feeDue, value, boundary, attachStateInit,
}) {
  const { signer, parts } = await buildGroupCapsules({ state, memberSeed, kind, payload, firstSeq, sentAt, random });
  const messages = await messagesFor({ signer, parts, epoch: state.epoch, door, vaultAddress, feeDue, value, boundary, attachStateInit });
  return { messages, lanePublicKey: signer.publicKey, memberPublicKey: signer.memberPublicKey, ...summary(parts, firstSeq) };
}

/**
 * The room's picture into the group's shared avatar lane. Two things differ from every other capsule and both are
 * deliberate: the seal is the AVATAR key — from the group id, not the ratchet — so a member who joined this
 * morning can read a picture published a year ago; and the write key is the group's own, so that member can
 * ADDRESS it. The additional data names no sender (GROUP_AVATAR_SENDER): the writer is "the group".
 */
export async function buildGroupAvatarPublishMessages({
  groupId, epoch, payload, firstSeq, sentAt, random,
  door, vaultAddress, feeDue, value, boundary, attachStateInit,
}) {
  const contentKey = await groupAvatarKey(groupId);
  const signer = await groupAvatarLaneSigner({ groupId, epoch });
  const sealed = await sealGroupCapsules({
    contentKey, kind: GROUP_KIND.AVATAR, payload, firstSeq, sentAt,
    context: { groupId, epoch, generation: 0, senderGroupKey: GROUP_AVATAR_SENDER },
    ...(random ? { random } : {}),
  });
  const parts = sealed.map((part) => ({ ...part, capsule: groupCapsuleCells(part) }));
  const messages = await messagesFor({ signer, parts, epoch, door, vaultAddress, feeDue, value, boundary, attachStateInit });
  return { messages, lanePublicKey: signer.publicKey, ...summary(parts, firstSeq) };
}
