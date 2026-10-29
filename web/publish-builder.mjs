
import { Address, beginCell, contractAddress } from '@ton/core';
import { ed25519 } from './vendor/@noble/curves/ed25519.js';
import { storeCapsulePublish, RecordShard } from '../build/RecordShard/RecordShard_RecordShard';
import { storeIntroPublish, IntroShard } from '../build/IntroShard/IntroShard_IntroShard';
import { storeRecoveryStore, RecoveryShard } from '../build/RecoveryShard/RecoveryShard_RecoveryShard';
import { storePublicPublish, PublicShard } from '../build/PublicShard/PublicShard_PublicShard';
import { recoveryOwnerSecret, recoveryOwnerPublicKey } from './crypto/conv-routing.mjs?v=9';

const bytesToBig = (b) => { let x = 0n; for (const byte of b) x = (x << 8n) | BigInt(byte & 0xff); return x; };

const RECOVERY_SLOT_DOMAIN = 0x52534C4Bn;

const RECOVERY_MAX_SLOTS = 256;
const RECOVERY_NAMED_SLOTS = 16;

const recoveryOwnerSlotKey = (ownerPublicKey, slotIndex) => {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= RECOVERY_MAX_SLOTS + RECOVERY_NAMED_SLOTS) {
    throw new Error(`buildRecoveryPublish: slotIndex must be an integer in [0, ${RECOVERY_MAX_SLOTS + RECOVERY_NAMED_SLOTS}), got ${slotIndex}`);
  }
  return BigInt('0x' + beginCell()
    .storeUint(RECOVERY_SLOT_DOMAIN, 32)
    .storeUint(typeof ownerPublicKey === 'bigint' ? ownerPublicKey : bytesToBig(ownerPublicKey), 256)
    .storeUint(slotIndex, 32)
    .endCell().hash().toString('hex'));
};

async function recordShardState(bucketKey, epoch) {
  const init = await RecordShard.init(BigInt(bucketKey), BigInt(epoch));
  return { init, address: contractAddress(0, init) };
}

async function introShardState(epoch, bucket) {
  const init = await IntroShard.init(BigInt(epoch), BigInt(bucket));
  return { init, address: contractAddress(0, init) };
}

async function recoveryShardState(selfBucketKey) {
  const init = await RecoveryShard.init(BigInt(selfBucketKey));
  return { init, address: contractAddress(0, init) };
}

async function publicShardState(partitionKey, epochTag) {
  const init = await PublicShard.init(BigInt(partitionKey), BigInt(epochTag));
  return { init, address: contractAddress(0, init) };
}

const RS_FRAME_DOMAIN = 0x52534643n;
const RS_WRITE_DOMAIN = 0x52535744n;
const IS_BODY_DOMAIN = 0x49534243n;
const RECOVERY_DOMAIN = 0x42525331n;

const bufBig = (h) => BigInt('0x' + Buffer.from(h).toString('hex'));
const sigCell = (sig) => beginCell().storeBuffer(Buffer.from(sig)).endCell();
const cellBig = (c) => bufBig(c.hash());

export function frameCommit(header0, header1, body) {
  return bufBig(beginCell()
    .storeUint(RS_FRAME_DOMAIN, 32)
    .storeUint(cellBig(header0), 256).storeUint(cellBig(header1), 256).storeUint(cellBig(body), 256)
    .endCell().hash());
}

export function introBodyCommit(header0, body) {
  return bufBig(beginCell()
    .storeUint(IS_BODY_DOMAIN, 32)
    .storeUint(cellBig(header0), 256).storeUint(cellBig(body), 256)
    .endCell().hash());
}

export async function buildConvPublish({ writePublicKey, writeSecret, seq, epoch, header0, header1, body, value }) {
  const commit = frameCommit(header0, header1, body);
  const digest = beginCell()
    .storeUint(RS_WRITE_DOMAIN, 32).storeUint(BigInt(seq), 64).storeUint(commit, 256)
    .endCell().hash();
  const target = await recordShardState(bytesToBig(writePublicKey), epoch);
  return {
    to: target.address,
    init: target.init,
    value,
    body: beginCell().store(storeCapsulePublish({
      $$type: 'CapsulePublish', seq: BigInt(seq), header_0: header0, header_1: header1, body,
      sig: sigCell(ed25519.sign(digest, writeSecret)),
    })).endCell(),
    commit,
  };
}

const INTRO_READ_SPACE_MIRROR = 1024;

export async function buildIntroPublish({ epoch, bucket, r, viewTag, header0, body, value }) {
  if (!(BigInt(bucket) >= 0n && BigInt(bucket) < BigInt(INTRO_READ_SPACE_MIRROR))) {
    throw new Error(`INTRO bucket ${bucket} is outside the read space of ${INTRO_READ_SPACE_MIRROR}`);
  }
  const target = await introShardState(epoch, bucket);
  return {
    to: target.address,
    init: target.init,
    value,
    body: beginCell().store(storeIntroPublish({
      $$type: 'IntroPublish', r: BigInt(r), view_tag: BigInt(viewTag), header_0: header0, body,
    })).endCell(),
    commit: introBodyCommit(header0, body),
  };
}

export async function buildRecoveryPublish({ seed, slotIndex, seq, h0, h1, body, value }) {
  const ownerSecret = await recoveryOwnerSecret(seed, slotIndex);
  const ownerPub = await recoveryOwnerPublicKey(seed, slotIndex);
  const slotKey = recoveryOwnerSlotKey(ownerPub, slotIndex);
  const target = await recoveryShardState(slotKey);
  const bh = cellBig(body);

  const digest = beginCell()
    .storeUint(RECOVERY_DOMAIN, 32).storeAddress(target.address).storeUint(slotKey, 256).storeUint(BigInt(seq), 64)
    .storeRef(beginCell().storeUint(h0, 256).storeUint(h1, 256).storeUint(bh, 256).endCell())
    .endCell().hash();

  return {
    to: target.address,
    init: target.init,
    value,
    body: beginCell().store(storeRecoveryStore({
      $$type: 'RecoveryStore',
      owner_pubkey: bytesToBig(ownerPub), slot_index: BigInt(slotIndex), seq: BigInt(seq), h0, h1, bh, body,
      owner_sig: sigCell(ed25519.sign(digest, ownerSecret)),
    })).endCell(),
    slotKey,
    slotIndex,
    ownerPublicKey: ownerPub,
  };
}

export async function buildPublicPublish({ kind, keyArg = 0n, shardSeq = 0, header, body, value, partitionKey, epochTag }) {
  if (!(BigInt(kind) >= 0n && BigInt(kind) <= 3n)) throw new Error(`buildPublicPublish: kind ${kind} out of range 0..3`);
  const target = await publicShardState(partitionKey, epochTag);
  return {
    to: target.address,
    init: target.init,
    value,
    body: beginCell().store(storePublicPublish({
      $$type: 'PublicPublish',
      kind: BigInt(kind), key_arg: BigInt(keyArg), shard_seq: BigInt(shardSeq), header, body,
    })).endCell(),
    commit: publicBodyCommit(header, body),
  };
}

const PS_BODY_DOMAIN = 0x50534644n;
function publicBodyCommit(header, body) {
  return BigInt('0x' + beginCell()
    .storeUint(PS_BODY_DOMAIN, 32)
    .storeUint(cellBig(header), 256)
    .storeUint(cellBig(body), 256)
    .endCell().hash().toString('hex'));
}
