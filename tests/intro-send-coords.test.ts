import { describe, expect, it } from 'vitest';
import { readIntroBucketFill, pickIntroSendSlot, confirmIntroCreatedAt } from '../web/intro-send-coords.mjs';
import { introShardAddress } from '../web/shard-discovery.mjs';
import { INTRO_SAFE_CAP } from '../web/intro-scan-policy.mjs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// INTRO-SEND-COORDS — the write-side coordination: pick a bucket a recipient will actually scan, and read back the
// CONTRACT created_at so the sender stores the SAME recency the recipient does (a local clock would fork a re-INTRO).
// Driven over stub get-method readers keyed by the REAL shard address the module derives, so the derivation is exercised.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const EPOCH = Math.floor(1_790_000_000 / 86400);

// A stub readScanPage keyed by the friendly address introShardAddress produces for each bucket.
async function scanPageStub(fillByBucket: Record<number, number | null>) {
  const byAddress = new Map<string, number | null>();
  for (const [bucket, fill] of Object.entries(fillByBucket)) {
    byAddress.set(await introShardAddress(EPOCH, Number(bucket)), fill);
  }
  return async (address: string) => {
    const fill = byAddress.get(address);
    if (fill === undefined || fill === null) return null; // absent shard
    return { from_id: 0n, count: BigInt(fill), next_id: BigInt(fill), pairs: null };
  };
}

describe('INTRO-SEND-COORDS', () => {
  it('ISC-FILL: bucket fill is next_id; an absent shard reads as 0', async () => {
    const readScanPage = await scanPageStub({ 0: 12, 1: null });
    expect(await readIntroBucketFill({ readScanPage, epoch: EPOCH, bucket: 0 })).toBe(12);
    expect(await readIntroBucketFill({ readScanPage, epoch: EPOCH, bucket: 1 }), 'absent → 0').toBe(0);
  });

  it('ISC-PICK: picks the lowest bucket with room; a FULL bucket 0 rolls to bucket 1', async () => {
    const empty = await scanPageStub({});
    expect(await pickIntroSendSlot({ readScanPage: empty, epoch: EPOCH }))
      .toEqual({ epoch: EPOCH, bucket: 0, expectedEntryId: 0 });

    // bucket 0 packed to the cap → chooseIntroBucket rolls to bucket 1 (empty), where the entry lands at id 0.
    const full0 = await scanPageStub({ 0: INTRO_SAFE_CAP });
    const slot = await pickIntroSendSlot({ readScanPage: full0, epoch: EPOCH });
    expect(slot.bucket, 'a full bucket 0 rolls over to 1').toBe(1);
    expect(slot.expectedEntryId, 'lands at the start of the fresh bucket').toBe(0);
  });

  it('ISC-CONFIRM: reads back the contract created_at by matching the ephemeral r, tolerating a raced entryId', async () => {
    const address = await introShardAddress(EPOCH, 0);
    const myR = (1n << 250n) + 7n;
    const otherR = 42n;
    const entries = new Map<string, any>([
      [`${address}:0`, { exists: true, r: otherR, view_tag: 9n, created_at: 1_790_000_100 }], // another sender raced in
      [`${address}:1`, { exists: true, r: myR, view_tag: 0x1234n, created_at: 1_790_000_222 }], // mine
    ]);
    const readEntry = async (addr: string, id: number) => entries.get(`${addr}:${id}`) ?? { exists: false };

    // I expected id 0, but a concurrent publish took it; the match by r finds mine at id 1 with ITS contract created_at.
    const found = await confirmIntroCreatedAt({ readEntry, epoch: EPOCH, bucket: 0, fromEntryId: 0, r: myR, viewTag: 0x1234n });
    expect(found).toEqual({ entryId: 1, createdAt: 1_790_000_222 });

    // an intro not yet visible on this endpoint → null (caller retries, never stores a wrong/local time).
    const missing = await confirmIntroCreatedAt({ readEntry, epoch: EPOCH, bucket: 0, fromEntryId: 0, r: 999n, viewTag: 1n });
    expect(missing).toBeNull();
  });
});
