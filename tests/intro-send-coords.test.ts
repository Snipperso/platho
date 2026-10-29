import { describe, expect, it } from 'vitest';
import { readIntroBucketFill, pickIntroSendSlot, confirmIntroCreatedAt } from '../web/intro-send-coords.mjs';
import { introShardAddress } from '../web/shard-discovery.mjs';
import { INTRO_SAFE_CAP } from '../web/intro-scan-policy.mjs';
import { beginCell } from '../web/pwa-contract-transactions.mjs';


const EPOCH = Math.floor(1_790_000_000 / 86400);

async function scanPageStub(fillByBucket: Record<number, number | null>) {
  const byAddress = new Map<string, number | null>();
  for (const [bucket, fill] of Object.entries(fillByBucket)) {
    byAddress.set(await introShardAddress(EPOCH, Number(bucket)), fill);
  }
  return async (address: string) => {
    const fill = byAddress.get(address);
    if (fill === undefined || fill === null) return null;
    return { from_id: 0n, count: BigInt(fill), next_id: BigInt(fill), pairs: null };
  };
}

function scanPairsCell(pairs: Array<{ r: bigint; tag: bigint }>) {
  let cell: any = null;
  for (let start = Math.floor((pairs.length - 1) / 3) * 3; start >= 0; start -= 3) {
    const builder = beginCell();
    for (const pair of pairs.slice(start, start + 3)) builder.uint(pair.r, 256, 'r').uint(pair.tag, 16, 'view_tag');
    if (cell) builder.ref(cell, 'next');
    cell = builder.endCell();
  }
  return cell ?? beginCell().endCell();
}

function pagedIntroBucket(address: string, entries: Array<{ r: bigint; tag: bigint; createdAt: number }>) {
  const reads = { pages: 0, entries: 0 };
  const readScanPage = async (addr: string, from: number, max: number) => {
    reads.pages += 1;
    if (addr !== address) return null;
    const start = Math.max(0, Number(from));
    const count = Math.max(0, Math.min(Number(max), 256, entries.length - start));
    return { from_id: BigInt(start), count: BigInt(count), next_id: BigInt(entries.length), pairs: scanPairsCell(entries.slice(start, start + count)) };
  };
  const readEntry = async (addr: string, id: number) => {
    reads.entries += 1;
    const entry = addr === address ? entries[id] : undefined;
    return entry ? { exists: true, r: entry.r, view_tag: entry.tag, created_at: entry.createdAt } : { exists: false };
  };
  return { readScanPage, readEntry, reads };
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

    const full0 = await scanPageStub({ 0: INTRO_SAFE_CAP });
    const slot = await pickIntroSendSlot({ readScanPage: full0, epoch: EPOCH });
    expect(slot.bucket, 'a full bucket 0 rolls over to 1').toBe(1);
    expect(slot.expectedEntryId, 'lands at the start of the fresh bucket').toBe(0);
  });

  it('ISC-CONFIRM: reads back the contract created_at by matching the ephemeral r, tolerating a raced entryId', async () => {
    const address = await introShardAddress(EPOCH, 0);
    const myR = (1n << 250n) + 7n;
    const lane = pagedIntroBucket(address, [
      { r: 42n, tag: 9n, createdAt: 1_790_000_100 },
      { r: myR, tag: 0x1234n, createdAt: 1_790_000_222 },
    ]);

    const found = await confirmIntroCreatedAt({ ...lane, epoch: EPOCH, bucket: 0, fromEntryId: 0, r: myR, viewTag: 0x1234n });
    expect(found).toEqual({ entryId: 1, createdAt: 1_790_000_222 });

    const missing = await confirmIntroCreatedAt({ ...lane, epoch: EPOCH, bucket: 0, fromEntryId: 0, r: 999n, viewTag: 1n });
    expect(missing).toBeNull();
  });
});
