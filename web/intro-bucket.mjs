
import { INTRO_READ_SPACE } from './shard-discovery.mjs?v=103';
import { INTRO_SAFE_CAP } from './intro-scan-policy.mjs?v=6';

export const INTRO_BUCKET_HEADROOM = 64;

export async function chooseIntroBucket({
  epoch,
  readBucketFill,
  readSpace = INTRO_READ_SPACE,
  headroom = INTRO_BUCKET_HEADROOM,
  skip = new Set(),
} = {}) {
  if (!Number.isInteger(epoch)) throw new Error('chooseIntroBucket requires an integer epoch');
  if (typeof readBucketFill !== 'function') throw new Error('chooseIntroBucket requires readBucketFill');

  for (let bucket = 0; bucket < readSpace; bucket += 1) {
    if (skip.has(bucket)) continue;
    const fill = Number((await readBucketFill(epoch, bucket)) ?? 0);
    if (!Number.isFinite(fill) || fill < 0) throw new Error(`readBucketFill returned ${fill} for bucket ${bucket}`);
    if (fill + headroom <= INTRO_SAFE_CAP) return bucket;
  }

  throw new Error(`every one of ${readSpace} INTRO buckets for epoch ${epoch} is full`);
}

export function assertReadableBucket(bucket, readSpace = INTRO_READ_SPACE) {
  const value = typeof bucket === 'bigint' ? bucket : BigInt(bucket ?? -1);
  if (value < 0n || value >= BigInt(readSpace)) {
    throw new Error(
      `INTRO bucket ${value} is outside the read space of ${readSpace} — no recipient would ever scan it`,
    );
  }
  return value;
}
