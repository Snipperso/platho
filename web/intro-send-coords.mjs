// intro-send-coords — the WRITE-side coordination an INTRO send needs beyond the byte-exact publish:
//   1. WHICH bucket to write into (chooseIntroBucket packs densely from the bottom so every recipient's scan stays
//      cheap), and the entryId the publish will land at.
//   2. The CONTRACT-STAMPED created_at of the intro just written. The sender MUST store THAT, never Date.now(): re-INTRO
//      K_root adoption orders on created_at, and it is the only recency value both sides read identically — if the
//      sender kept a local clock and the recipient kept the contract time, a later re-INTRO would order differently on
//      the two sides and the conversation would silently FORK. [reintro-kroot-adoption-invariant; conv-receive review #3]
//
// Both go through the SAME get-method readers the receive lane uses (createScanPageReader / createEntryReader), passed
// in so this stays testable against a stub transport. tests/intro-send-coords.test.ts pins the fill read, the pick, and
// the created_at match (including the race where another sender's publish bumped the entryId).

import { chooseIntroBucket } from './intro-bucket.mjs?v=19';
import { introShardAddress } from './shard-discovery.mjs?v=21';

/** next_id (fill) of an (epoch, bucket) shard — how many intros it already holds — and 0 for a shard that does not
 *  exist yet (readScanPage returns null for a structurally-absent account). */
export async function readIntroBucketFill({ readScanPage, epoch, bucket }) {
  const page = await readScanPage(await introShardAddress(epoch, bucket), 0, 1);
  return page ? Number(page.next_id) : 0;
}

/**
 * Pick the (epoch, bucket) this first contact belongs in and the entryId it will land at. `skip` (buckets already
 * refused by gate 13680 on a retry) is threaded into chooseIntroBucket so a retry walks upward instead of hammering a
 * full shard. Returns { epoch, bucket, expectedEntryId } — expectedEntryId is the bucket fill at pick time, which is
 * where the publish lands UNLESS another sender raced in first (confirmIntroCreatedAt handles that).
 */
export async function pickIntroSendSlot({ readScanPage, epoch, skip = new Set() }) {
  const bucket = await chooseIntroBucket({
    epoch,
    readBucketFill: (e, b) => readIntroBucketFill({ readScanPage, epoch: e, bucket: b }),
    skip,
  });
  const expectedEntryId = await readIntroBucketFill({ readScanPage, epoch, bucket });
  return { epoch, bucket, expectedEntryId };
}

/**
 * Read back the CONTRACT-stamped created_at of the intro this wallet just published, by matching the stored entry's
 * ephemeral r (a unique 256-bit key per capsule) from `fromEntryId` forward — so a concurrent publish that bumped the
 * id is still found. Returns { entryId, createdAt } or null if it is not yet visible on this endpoint (caller retries).
 */
export async function confirmIntroCreatedAt({ readEntry, epoch, bucket, fromEntryId, r, viewTag, maxScan = 128 }) {
  const address = await introShardAddress(epoch, bucket);
  const wantR = BigInt(r);
  const wantTag = BigInt(viewTag ?? 0);
  for (let id = Number(fromEntryId); id < Number(fromEntryId) + maxScan; id += 1) {
    const entry = await readEntry(address, id);
    if (!entry?.exists) break; // past the end of what is stored — the publish is not visible on this endpoint yet
    if (BigInt(entry.r) === wantR && BigInt(entry.view_tag ?? 0) === wantTag) {
      return { entryId: id, createdAt: Number(entry.created_at) };
    }
  }
  return null;
}
