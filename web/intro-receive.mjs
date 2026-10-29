
import { INTRO_READ_SPACE, introShardAddress, epochIsDerivable, addrKey } from './shard-discovery.mjs?v=103';
import { INTRO_SAFE_CAP } from './intro-scan-policy.mjs?v=6';
import { readAccountStates, changedSince, changeMarkerOf } from './shard-reader.mjs?v=108';
import { scanIntros } from './intro-scan.mjs?v=16';

export const INTRO_SCAN_EPOCHS_BACK = 8;
export const INTRO_SCAN_EPOCHS_FORWARD = 1;
export const INTRO_SCAN_EPOCHS = INTRO_SCAN_EPOCHS_BACK + INTRO_SCAN_EPOCHS_FORWARD + 1;

export function unpackScanPage(pairs, count) {
  const out = [];
  let cur = pairs;
  while (cur && out.length < count) {
    if (typeof cur.beginParse === 'function') {
      const slice = cur.beginParse();
      while (slice.remainingBits >= 272 && out.length < count) {
        out.push({ r: slice.loadUintBig(256), view_tag: slice.loadUint(16) });
      }
    } else {
      const bytes = cur.data ?? new Uint8Array(0);
      const bitLength = Number(cur.bitLength ?? bytes.length * 8);
      let bit = 0;
      const take = (width) => {
        let value = 0n;
        for (let i = 0; i < width; i += 1, bit += 1) {
          value = (value << 1n) | BigInt(((bytes[bit >> 3] ?? 0) >> (7 - (bit & 7))) & 1);
        }
        return value;
      };
      while (bitLength - bit >= 272 && out.length < count) {
        out.push({ r: take(256), view_tag: Number(take(16)) });
      }
    }
    cur = (cur.refs && cur.refs.length > 0) ? cur.refs[0] : null;
  }
  return out;
}

export async function scanIntroWindow({
  scanSecretKey,
  currentEpoch,
  toEpoch = currentEpoch + INTRO_SCAN_EPOCHS_FORWARD,
  fromEpoch = (currentEpoch ?? toEpoch) - INTRO_SCAN_EPOCHS_BACK,
  readSpace = INTRO_READ_SPACE,
  buckets = null,
  extraBuckets = null,
  cursors = new Map(),
  readStates,
  readScanPage,
  pageSize = 256,
} = {}) {
  if (!scanSecretKey) throw new Error('scanIntroWindow requires scanSecretKey');
  if (!Number.isInteger(toEpoch)) throw new Error('scanIntroWindow requires currentEpoch or toEpoch');
  if (typeof readStates !== 'function' || typeof readScanPage !== 'function') {
    throw new Error('scanIntroWindow requires readStates and readScanPage');
  }

  const from = Math.max(0, buckets?.from ?? 0);
  const to = Math.min(readSpace, buckets?.to ?? readSpace);
  const wanted = new Set();
  for (let bucket = from; bucket < to; bucket += 1) wanted.add(bucket);
  for (const bucket of extraBuckets ?? []) {
    const b = Number(bucket);
    if (Number.isInteger(b) && b >= 0 && b < readSpace) wanted.add(b);
  }
  const bucketList = [...wanted].sort((a, b) => a - b);

  const targets = [];
  for (let epoch = fromEpoch; epoch <= toEpoch; epoch += 1) {
    if (!epochIsDerivable('intro', epoch)) continue;
    for (const bucket of bucketList) {
      targets.push({ epoch, bucket, address: await introShardAddress(epoch, bucket) });
    }
  }
  const byKey = new Map(targets.map((t) => [addrKey(t.address), t]));
  const states = await readStates(targets.map((t) => t.address));

  const live = new Map();
  for (const [key, state] of states) {
    if (state && state.status !== undefined && state.status !== 'active' && state.status !== 'unknown') continue;
    live.set(key, state);
  }
  const active = new Map([...live].filter(([, s]) => !s || s.status !== 'unknown'));

  const seen = new Map();
  for (const [key, entry] of cursors) seen.set(key, entry?.marker ?? null);
  const changed = changedSince(live, seen);

  const nextCursors = new Map(cursors);
  const candidates = [];
  const failures = [];
  let pagesRead = 0;
  for (const { key, state } of changed) {
    const target = byKey.get(key);
    if (!target) continue;
    let fromId = cursors.get(key)?.nextId ?? 0;
    const maxPages = Math.ceil(INTRO_SAFE_CAP / Math.max(1, pageSize)) + 1;
    let drained = false;
    try {
      for (let page = 0; page < maxPages; page += 1) {
        const read = await readScanPage(target.address, fromId, pageSize);
        if (!read) { drained = true; break; }
        pagesRead += 1;
        const start = Number(read.from_id);
        const count = Number(read.count);
        if (!Number.isFinite(start) || !Number.isFinite(count) || count < 0 || start < 0) {
          throw new Error(`get_scan_page returned a nonsensical page (from_id=${read.from_id}, count=${read.count})`);
        }
        const entries = count > 0 ? unpackScanPage(read.pairs, count) : [];
        entries.forEach((e, i) => candidates.push({ ...e, key, epoch: target.epoch, bucket: target.bucket, entryId: start + i }));
        const advanced = start + count;
        if (advanced <= fromId && count === 0) { fromId = Number(read.next_id); drained = true; break; }
        fromId = advanced;
        if (fromId >= Number(read.next_id)) { fromId = Number(read.next_id); drained = true; break; }
      }
    } catch (error) {
      failures.push({ key, epoch: target.epoch, bucket: target.bucket, error });
      continue;
    }

    if (drained) nextCursors.set(key, { marker: changeMarkerOf(state), nextId: fromId });
  }

  const bearingKeys = [...active.keys()].filter((key) => {
    const seenNextId = nextCursors.get(key)?.nextId;
    return !(Number.isFinite(Number(seenNextId)) && Number(seenNextId) === 0);
  });

  const hits = candidates.length ? await scanIntros(scanSecretKey, candidates) : [];

  return {
    hits,
    cursors: nextCursors,
    stats: {
      window: [fromEpoch, toEpoch],
      buckets: [from, to],
      probed: targets.length,
      live: active.size,
      highestLiveBucket: [...active.keys()].reduce((max, key) => Math.max(max, byKey.get(key)?.bucket ?? -1), -1),
      distinctLiveBuckets: new Set(bearingKeys.map((key) => byKey.get(key)?.bucket)).size,
      liveBucketIndices: [...new Set(bearingKeys
        .map((key) => byKey.get(key)?.bucket)
        .filter((b) => Number.isInteger(b)))].sort((a, b) => a - b),
      changed: changed.length,
      pagesRead,
      candidates: candidates.length,
      failed: failures.length,
    },
    failures,
    keyEpochs: new Map([...byKey].map(([key, target]) => [key, target.epoch])),
  };
}
