
import { beginCell } from './pwa-contract-transactions.mjs?v=59';
import { publicShardAddressBytesFor, publicShardStateInitFor, rawAddress } from './shard-address.mjs?v=47';
import { generationForEpochAt, CUTOVER_EPOCH } from './cutover-epoch.mjs?v=7';
import { publicBeaconPartitionKeyFor } from './shard-discovery.mjs?v=103';
import { publicBodyCommit } from './public-shard-ton-rpc-provider.mjs?v=44';

export const PUBLIC_PUBLISH_OPCODE = 0x50535031;

export function buildPublicPublishBody({ kind, keyArg = 0n, shardSeq = 0, header, body }) {
  if (!(BigInt(kind) >= 0n && BigInt(kind) <= 3n)) throw new Error(`buildPublicPublishBody: kind ${kind} out of range 0..3`);
  if (!header || !body) throw new Error('buildPublicPublishBody: header and body cells are required');
  const builder = beginCell();
  builder.uint(PUBLIC_PUBLISH_OPCODE, 32, 'PublicPublish opcode');
  builder.uint(BigInt(kind), 8, 'kind');
  builder.uint(BigInt(keyArg), 256, 'key_arg');
  builder.uint(BigInt(shardSeq), 32, 'shard_seq');
  builder.ref(header, 'header');
  builder.ref(body, 'body');
  return builder.endCell();
}

export async function buildPublicPublishBrowser({ kind, keyArg = 0n, shardSeq = 0, header, body, value, partitionKey, epochTag, nowUnix, boundary = CUTOVER_EPOCH }) {
  const writeUnix = Number(nowUnix);
  if (!Number.isFinite(writeUnix) || writeUnix <= 0) {
    throw new TypeError('buildPublicPublishBrowser: nowUnix (the SAME instant the caller derived epochTag from) '
      + 'is required — deriving it here would re-open the two-clock straddle loss');
  }
  const generation = generationForEpochAt(Math.floor(writeUnix / 86400), boundary);
  if (Number(kind) === 2 && partitionKey !== undefined && partitionKey !== null) {
    throw new TypeError('buildPublicPublishBrowser: a BEACON part must NOT carry a partitionKey — it is chosen '
      + 'from the write generation here, and a caller-supplied one is a key derived without that generation');
  }
  const key = Number(kind) === 2 ? await publicBeaconPartitionKeyFor(generation, keyArg, shardSeq) : partitionKey;
  const address = await publicShardAddressBytesFor(generation, key, epochTag);
  return {
    to: rawAddress(address),
    addressBytes: address,
    generation,
    partitionKey: key,
    value,
    body: buildPublicPublishBody({ kind, keyArg, shardSeq, header, body }),
    init: publicShardStateInitFor(generation, key, epochTag),
    commit: await publicBodyCommit(header, body),
  };
}
