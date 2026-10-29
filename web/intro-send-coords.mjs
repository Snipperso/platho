
import { chooseIntroBucket } from './intro-bucket.mjs?v=103';
import { introShardAddress } from './shard-discovery.mjs?v=103';
import { unpackScanPage } from './intro-receive.mjs?v=83';

export async function readIntroBucketFill({ readScanPage, epoch, bucket }) {
  const page = await readScanPage(await introShardAddress(epoch, bucket), 0, 1);
  return page ? Number(page.next_id) : 0;
}

export async function pickIntroSendSlot({ readScanPage, epoch, skip = new Set() }) {
  const bucket = await chooseIntroBucket({
    epoch,
    readBucketFill: (e, b) => readIntroBucketFill({ readScanPage, epoch: e, bucket: b }),
    skip,
  });
  const expectedEntryId = await readIntroBucketFill({ readScanPage, epoch, bucket });
  return { epoch, bucket, expectedEntryId };
}

export const INTRO_CONFIRM_PAGE = 256;
export const INTRO_CONFIRM_MAX_PAGES = 64;

export async function confirmIntroCreatedAt({ readScanPage, readEntry, epoch, bucket, fromEntryId, r, viewTag, maxPages = INTRO_CONFIRM_MAX_PAGES, reportAbsence = false }) {
  if (typeof readScanPage !== 'function' || typeof readEntry !== 'function') {
    throw new Error('confirmIntroCreatedAt requires readScanPage and readEntry');
  }
  const address = await introShardAddress(epoch, bucket);
  const wantR = BigInt(r);
  const wantTag = BigInt(viewTag ?? 0);
  let from = Math.max(0, Number(fromEntryId) || 0);
  for (let page = 0; page < maxPages; page += 1) {
    const read = await readScanPage(address, from, INTRO_CONFIRM_PAGE);
    if (!read) return reportAbsence ? { absent: 'no-shard' } : null;
    const pageFrom = Number(read.from_id);
    const count = Number(read.count);
    const nextId = Number(read.next_id);
    if (!Number.isSafeInteger(pageFrom) || !Number.isSafeInteger(count) || !Number.isSafeInteger(nextId)
      || count < 0 || pageFrom !== from) {
      throw new Error('intro confirm: the scan page contradicts itself');
    }
    if (pageFrom + count > nextId) throw new Error('intro confirm: the scan page runs past the bucket end');
    const pairs = count > 0 ? unpackScanPage(read.pairs, count) : [];
    if (pairs.length !== count) throw new Error('intro confirm: the scan page is short of its own count');
    for (let i = 0; i < pairs.length; i += 1) {
      if (BigInt(pairs[i].r) !== wantR || BigInt(pairs[i].view_tag) !== wantTag) continue;
      const entryId = pageFrom + i;
      const entry = await readEntry(address, entryId);
      if (!entry?.exists || BigInt(entry.r) !== wantR) throw new Error('intro confirm: the entry disagrees with its scan page');
      return { entryId, createdAt: Number(entry.created_at) };
    }
    from = pageFrom + count;
    if (count === 0 || from >= nextId) return reportAbsence ? { absent: 'not-in-bucket' } : null;
  }
  throw new Error('intro confirm: the bucket did not end within the page budget');
}
