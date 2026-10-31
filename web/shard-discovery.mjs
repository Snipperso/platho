
import { beginCell, computeCellHashAndDepth } from './pwa-contract-transactions.mjs?v=59';
import { parseTonAddress } from './crypto/platho-crypto.mjs?v=31';
import { formatTonUserFriendlyAddress } from './platho-wallet.mjs?v=94';
import {
  recordShardStateInit,
  introShardStateInit,
  recoveryShardStateInit,
  recordShardAddressBytes,
  introShardAddressBytes,
  recoveryShardAddressBytes,
  publicShardAddressBytesFor,
  hasLaneCode,
  canDeriveForEpoch,
  rawAddress,
} from './shard-address.mjs?v=47';
import { generationsForEra } from './cutover-epoch.mjs?v=7';

export const EPOCH_SECONDS = 86400;

export const epochOf = (unixSeconds) => Math.floor(unixSeconds / EPOCH_SECONDS);

const RECOVERY_SLOT_DOMAIN = 0x52534C4Bn;
const bytesToBig = (b) => { let x = 0n; for (const byte of b) x = (x << 8n) | BigInt(byte & 0xff); return x; };

export const RECOVERY_MAX_SLOTS = 256;

export const RECOVERY_NAMED_SLOTS = 16;
export const PREFS_NAMED_SLOT_INDEX = RECOVERY_MAX_SLOTS;

export const NOTES_NAMED_SLOT_BASE = RECOVERY_MAX_SLOTS + 1;
export const NOTES_NAMED_SLOT_COUNT = 8;

export const GROUPS_NAMED_SLOT_BASE = NOTES_NAMED_SLOT_BASE + NOTES_NAMED_SLOT_COUNT;
export const GROUPS_NAMED_SLOT_COUNT = 4;

export const PREFS_OVERFLOW_SLOT_BASE = GROUPS_NAMED_SLOT_BASE + GROUPS_NAMED_SLOT_COUNT;
export const PREFS_CHUNK_COUNT = 1 + (RECOVERY_MAX_SLOTS + RECOVERY_NAMED_SLOTS - PREFS_OVERFLOW_SLOT_BASE);
export function prefsChunkSlotIndex(chunkIndex) {
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= PREFS_CHUNK_COUNT) {
    throw new RangeError(`prefsChunkSlotIndex: chunkIndex must be in [0, ${PREFS_CHUNK_COUNT}), got ${chunkIndex}`);
  }
  return chunkIndex === 0 ? PREFS_NAMED_SLOT_INDEX : PREFS_OVERFLOW_SLOT_BASE + chunkIndex - 1;
}

export async function recoveryOwnerSlotKey(ownerPublicKey, slotIndex) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= RECOVERY_MAX_SLOTS + RECOVERY_NAMED_SLOTS) {
    throw new Error(`recoveryOwnerSlotKey: slotIndex must be an integer in [0, ${RECOVERY_MAX_SLOTS + RECOVERY_NAMED_SLOTS}), got ${slotIndex}`);
  }
  const pub = typeof ownerPublicKey === 'bigint' ? ownerPublicKey : bytesToBig(ownerPublicKey);
  const cell = beginCell()
    .uint(RECOVERY_SLOT_DOMAIN, 32, 'RS_SLOT_DOMAIN')
    .uint(pub, 256, 'owner_pubkey')
    .uint(BigInt(slotIndex), 32, 'slot_index')
    .endCell();
  const { hash } = await computeCellHashAndDepth(cell);
  return bytesToBig(hash);
}


export async function recordShardState(bucketKey, epoch) {
  return {
    init: recordShardStateInit(BigInt(bucketKey), BigInt(epoch)),
    address: await friendly(recordShardAddressBytes(BigInt(bucketKey), BigInt(epoch))),
  };
}

export async function introShardState(epoch, bucket) {
  return {
    init: introShardStateInit(BigInt(epoch), BigInt(bucket)),
    address: await friendly(introShardAddressBytes(BigInt(epoch), BigInt(bucket))),
  };
}

export async function recoveryShardState(selfBucketKey) {
  return {
    init: recoveryShardStateInit(BigInt(selfBucketKey)),
    address: await friendly(recoveryShardAddressBytes(BigInt(selfBucketKey))),
  };
}

async function friendly(addressBytesPromise) {
  const { workchain, hash } = await addressBytesPromise;
  return formatTonUserFriendlyAddress(rawAddress({ workchain, hash }), { bounceable: true });
}


export async function recordShardAddress(bucketKey, epoch) {
  return friendly(recordShardAddressBytes(BigInt(bucketKey), BigInt(epoch)));
}

export async function introShardAddress(epoch, bucket) {
  return friendly(introShardAddressBytes(BigInt(epoch), BigInt(bucket)));
}

export const epochIsDerivable = canDeriveForEpoch;

export async function recoveryShardAddress(selfBucketKey) {
  return friendly(recoveryShardAddressBytes(BigInt(selfBucketKey)));
}

export const INTRO_READ_SPACE = 1024;

export async function introScanAddresses(fromEpoch, toEpoch, bucketCount = INTRO_READ_SPACE) {
  const out = [];
  for (let e = fromEpoch; e <= toEpoch; e += 1) {
    for (let b = 0; b < bucketCount; b += 1) {
      out.push(await introShardAddress(e, b));
    }
  }
  return out;
}


const PS_KIND = Object.freeze({ CHANNEL: 0, THREAD: 1, BEACON: 2, AVATAR: 3 });
const PS_ERA_SHORT = 2592000;
const PS_ERA_LONG = 31536000;
const PS_CHANNEL_DOMAIN = 0x50534348n;
const PS_THREAD_DOMAIN = 0x50535448n;
const PS_BEACON_DOMAIN = 0x50534243n;
const PS_AVATAR_DOMAIN = 0x50534156n;
const PS_POST_UID_DOMAIN = 0x50535544n;

export const PUBLIC_BEACON_READ_SPACE = 1024;

export const PUBLIC_SEQ_PROBE = 4;

export const publicEraOf = (kind, unixSeconds) =>
  Math.floor(unixSeconds / (kind < PS_KIND.BEACON ? PS_ERA_SHORT : PS_ERA_LONG));

export const publicEpochTag = (kind, era) => (BigInt(kind) << 32n) | BigInt(era);

const bigToBucket = (n) => BigInt(n) & 0xFFFFFFFFn;

async function hashCell(cell) {
  const { hash } = await computeCellHashAndDepth(cell);
  return bytesToBig(hash);
}

export async function publicChannelPartitionKey(ownerWalletHash, shardSeq = 0) {
  return hashCell(beginCell()
    .uint(PS_CHANNEL_DOMAIN, 32, 'PS_CHANNEL_DOMAIN')
    .uint(BigInt(ownerWalletHash), 256, 'owner_hash')
    .uint(BigInt(shardSeq), 32, 'shard_seq')
    .endCell());
}
export async function publicThreadPartitionKey(postUid, shardSeq = 0) {
  return hashCell(beginCell()
    .uint(PS_THREAD_DOMAIN, 32, 'PS_THREAD_DOMAIN')
    .uint(BigInt(postUid), 256, 'post_uid')
    .uint(BigInt(shardSeq), 32, 'shard_seq')
    .endCell());
}
export async function publicBeaconPartitionKey(bucket) {
  return hashCell(beginCell()
    .uint(PS_BEACON_DOMAIN, 32, 'PS_BEACON_DOMAIN')
    .uint(bigToBucket(bucket), 32, 'bucket')
    .endCell());
}
export async function publicBeaconPartitionKey18(bucket, shardSeq = 0) {
  return hashCell(beginCell()
    .uint(PS_BEACON_DOMAIN, 32, 'PS_BEACON_DOMAIN')
    .uint(bigToBucket(bucket), 32, 'bucket')
    .uint(BigInt(shardSeq), 32, 'shard_seq')
    .endCell());
}

export async function publicBeaconPartitionKeyFor(generation, bucket, shardSeq = 0) {
  const g = Number(generation);
  if (!Number.isInteger(g) || g < 17) {
    throw new RangeError(`publicBeaconPartitionKeyFor: ${generation} is not a lane generation`);
  }
  if (g < 18) {
    if (Number(shardSeq) !== 0) {
      throw new RangeError(`publicBeaconPartitionKeyFor: generation ${g} folds no shard_seq into BEACON, so seq `
        + `${shardSeq} has no key there — answering the seq-0 one would name a different account silently`);
    }
    return publicBeaconPartitionKey(bucket);
  }
  return publicBeaconPartitionKey18(bucket, shardSeq);
}

export async function publicAvatarPartitionKey(ownerWalletHash) {
  return hashCell(beginCell()
    .uint(PS_AVATAR_DOMAIN, 32, 'PS_AVATAR_DOMAIN')
    .uint(BigInt(ownerWalletHash), 256, 'owner_hash')
    .endCell());
}

export async function publicPostUid(channelPartitionKey, epochTag, entryId, generation = 17) {
  const builder = beginCell()
    .uint(PS_POST_UID_DOMAIN, 32, 'PS_POST_UID_DOMAIN')
    .uint(BigInt(channelPartitionKey), 256, 'channel_partition_key')
    .uint(BigInt(epochTag), 64, 'epoch_tag')
    .uint(BigInt(entryId), 64, 'entry_id');
  if (Number(generation) !== 17) builder.uint(BigInt(Number(generation)), 8, 'generation');
  return hashCell(builder.endCell());
}

export function publicWalletHash(address) {
  const { hash } = parseTonAddress(String(address));
  return bytesToBig(hash);
}

export const publicEraLengthOf = (kind) => (kind < PS_KIND.BEACON ? PS_ERA_SHORT : PS_ERA_LONG);

export const publicEraGenerations = (kind, era) => generationsForEra(publicEraLengthOf(kind), era)
  .filter((generation) => hasLaneCode('public', generation));

async function publicShardFriendlyFor(generation, partitionKey, epochTag) {
  const address = friendly(publicShardAddressBytesFor(generation, partitionKey, epochTag));
  notePublicAddressGeneration(await address, generation);
  return address;
}

const publicAddressGenerations = new Map();
const PUBLIC_ADDRESS_GENERATIONS_MAX = 32_768;
export function notePublicAddressGeneration(address, generation) {
  let key;
  try { key = addrKey(address); } catch { return; }
  if (publicAddressGenerations.has(key)) publicAddressGenerations.delete(key);
  else if (publicAddressGenerations.size >= PUBLIC_ADDRESS_GENERATIONS_MAX) publicAddressGenerations.delete(publicAddressGenerations.keys().next().value);
  publicAddressGenerations.set(key, Number(generation));
}
export function publicAddressGenerationOf(address) {
  try { return publicAddressGenerations.get(addrKey(address)) ?? null; } catch { return null; }
}

let beaconScanAddressesKept = null;
export async function publicBeaconScanAddresses(nowUnix, eraWindow = 3, bucketCount = PUBLIC_BEACON_READ_SPACE) {
  const era = publicEraOf(PS_KIND.BEACON, nowUnix);
  const key = `${era}:${eraWindow}:${bucketCount}`;
  if (beaconScanAddressesKept?.key === key) return [...beaconScanAddressesKept.addresses];
  const out = [];
  for (let e = era; e > era - eraWindow && e >= 0; e -= 1) {
    const tag = publicEpochTag(PS_KIND.BEACON, e);
    for (const generation of publicEraGenerations(PS_KIND.BEACON, e)) {
      for (let b = 0; b < bucketCount; b += 1) {
        out.push(await publicShardFriendlyFor(generation, await publicBeaconPartitionKeyFor(generation, b), tag));
        if (out.length % 128 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }
  beaconScanAddressesKept = { key, addresses: out };
  return [...out];
}

export async function publicChannelScanAddresses(ownerWalletHash, nowUnix, eraWindow = 3, seqProbe = PUBLIC_SEQ_PROBE) {
  const era = publicEraOf(PS_KIND.CHANNEL, nowUnix);
  const out = [];
  for (let e = era; e > era - eraWindow && e >= 0; e -= 1) {
    const tag = publicEpochTag(PS_KIND.CHANNEL, e);
    for (const generation of publicEraGenerations(PS_KIND.CHANNEL, e)) {
      for (let seq = 0; seq < seqProbe; seq += 1) {
        out.push(await publicShardFriendlyFor(generation, await publicChannelPartitionKey(ownerWalletHash, seq), tag));
      }
    }
  }
  return out;
}

export const PUBLIC_AVATAR_ERA_WINDOW = 5;

export async function publicAvatarScanAddresses(ownerWalletHash, nowUnix, eraWindow = PUBLIC_AVATAR_ERA_WINDOW) {
  const era = publicEraOf(PS_KIND.AVATAR, nowUnix);
  const pk = await publicAvatarPartitionKey(ownerWalletHash);
  const out = [];
  for (let e = era; e > era - eraWindow && e >= 0; e -= 1) {
    for (const generation of publicEraGenerations(PS_KIND.AVATAR, e)) {
      out.push(await publicShardFriendlyFor(generation, pk, publicEpochTag(PS_KIND.AVATAR, e)));
    }
  }
  return out;
}

export function addrKey(a) {
  const { workchain, hash } = parseTonAddress(String(a));
  const hex = Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${workchain}:${hex}`;
}
