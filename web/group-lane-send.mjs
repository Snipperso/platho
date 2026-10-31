
import { groupAvatarKey, groupAvatarLaneSigner, groupContentKey, groupLaneSigner } from './crypto/group-lane.mjs?v=8';
import { sealGroupCapsules, GROUP_AVATAR_SENDER, GROUP_KIND } from './group-protocol.mjs?v=31';
import { buildConvPublishViaVaultMessage, buildConvPublishWalletMessage } from './conv-lane-send.mjs?v=137';
import { serializeBoc, tonCell } from './pwa-contract-transactions.mjs?v=59';
import { PLATHO_ONCHAIN_CELL_DATA_BYTES } from './crypto/platho-crypto.mjs?v=31';

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

async function messagesFor({ signer, parts, epoch, door, vaultAddress, feeDue, value, boundary, attachStateInit = true, prices = null }) {
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
    const attachHere = attachStateInit && messages.length === 0;
    let built;
    if (door === 'vault') {
      const measured = await buildConvPublishWalletMessage(common);
      built = await buildConvPublishViaVaultMessage({
        ...common, vaultAddress, capsuleBytes: serializeBoc(measured.body).length, feeDue, attachStateInit: attachHere, prices,
      });
    } else {
      built = await buildConvPublishWalletMessage(common);
    }
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

export async function buildGroupPublishMessages({
  state, memberSeed, kind = GROUP_KIND.TEXT, payload, firstSeq, sentAt, random,
  door, vaultAddress, feeDue, value, boundary, attachStateInit, prices = null,
}) {
  const { signer, parts } = await buildGroupCapsules({ state, memberSeed, kind, payload, firstSeq, sentAt, random });
  const messages = await messagesFor({ signer, parts, epoch: state.epoch, door, vaultAddress, feeDue, value, boundary, attachStateInit, prices });
  return { messages, lanePublicKey: signer.publicKey, memberPublicKey: signer.memberPublicKey, ...summary(parts, firstSeq) };
}

export async function buildGroupAvatarPublishMessages({
  groupId, epoch, payload, firstSeq, sentAt, random, secret = null,
  door, vaultAddress, feeDue, value, boundary, attachStateInit, prices = null,
}) {
  const contentKey = await groupAvatarKey(groupId, secret);
  const signer = await groupAvatarLaneSigner({ groupId, epoch, secret });
  const sealed = await sealGroupCapsules({
    contentKey, kind: GROUP_KIND.AVATAR, payload, firstSeq, sentAt,
    context: { groupId, epoch, generation: 0, senderGroupKey: GROUP_AVATAR_SENDER },
    ...(random ? { random } : {}),
  });
  const parts = sealed.map((part) => ({ ...part, capsule: groupCapsuleCells(part) }));
  const messages = await messagesFor({ signer, parts, epoch, door, vaultAddress, feeDue, value, boundary, attachStateInit, prices });
  return { messages, lanePublicKey: signer.publicKey, ...summary(parts, firstSeq) };
}
