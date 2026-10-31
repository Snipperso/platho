
import { incomingRecordShards } from './conv-discovery.mjs?v=105';
import {
  parseCapsulePublishBody, convChainEntryFromParsed, verifyConvWriteSignature, convReadOpcodesForGeneration, convHeader0BucketKey,
} from './conv-lane-read.mjs?v=122';
import { computeKEpoch, computeBucketKey } from './crypto/conv-routing.mjs?v=9';
import { changeMarkerOf } from './shard-reader.mjs?v=109';
import { addrKey } from './shard-discovery.mjs?v=104';

const CONV_SHARD_MESSAGE_PAGE_LIMIT = 128;
const CONV_READ_THROUGH_SLACK_SEC = 3_600;
const rowsAnswered = (rows) => (Number.isFinite(rows?.rawCount) ? rows.rawCount : (rows?.length ?? 0));

const CONV_MAX_OLDER_BODY_PAGES = 4;

const CONV_MAX_OLDER_BODY_PAGES_FULL = 32;
const convGapWarnedShards = new Set();

export function createConvReadLane({ readMessagesWithSource, verifyWriteSig = true, markLimit = 512 } = {}) {
  if (typeof readMessagesWithSource !== 'function') throw new Error('createConvReadLane requires readMessagesWithSource');

  const shardMarks = new Map();
  const readThrough = new Map();
  const SHARD_MARK_LIMIT = Math.max(64, Number(markLimit) || 512);
  const laneStats = { read: 0, skipped: 0, absent: 0, failed: 0 };

  const junkRuns = new Map();
  const JUNK_RUNS_PER_SHARD = 64;

  function noteJunkRun(key, lo, hi) {
    if (!key || lo === null || hi === null || lo > hi) return;
    const merged = [];
    let next = { lo, hi };
    for (const run of junkRuns.get(key) ?? []) {
      if (run.hi + 1n < next.lo || next.hi + 1n < run.lo) { merged.push(run); continue; }
      next = { lo: run.lo < next.lo ? run.lo : next.lo, hi: run.hi > next.hi ? run.hi : next.hi };
    }
    merged.push(next);
    merged.sort((a, b) => (a.hi > b.hi ? -1 : a.hi < b.hi ? 1 : 0));
    junkRuns.delete(key);
    junkRuns.set(key, merged.slice(0, JUNK_RUNS_PER_SHARD));
    while (junkRuns.size > SHARD_MARK_LIMIT) {
      const oldest = junkRuns.keys().next();
      if (oldest.done) break;
      junkRuns.delete(oldest.value);
    }
  }

  function belowJunkRuns(key, endLt) {
    const runs = junkRuns.get(key);
    if (!runs || runs.length === 0) return endLt;
    let at = endLt;
    for (let moved = true; moved;) {
      moved = false;
      for (const run of runs) {
        if (run.lo <= at && at <= run.hi) { at = run.lo - 1n; moved = true; }
      }
    }
    return at;
  }

  function markShard(key, marker, through = undefined) {
    if (!key || marker === null || marker === undefined) return;
    shardMarks.delete(key);
    shardMarks.set(key, marker);
    if (Number.isFinite(through) && through > 0) readThrough.set(key, through);
    while (shardMarks.size > SHARD_MARK_LIMIT) {
      const oldest = shardMarks.keys().next();
      if (oldest.done) break;
      shardMarks.delete(oldest.value);
      readThrough.delete(oldest.value);
    }
  }

  return {
    forgetShard(address) {
      if (!address) return;
      try { const key = addrKey(address); shardMarks.delete(key); readThrough.delete(key); } catch { }
    },

    exportMarks() { return [...shardMarks.entries()].map(([key, marker]) => (readThrough.has(key) ? [key, marker, readThrough.get(key)] : [key, marker])); },
    importMarks(entries) {
      let taken = 0;
      for (const entry of entries ?? []) {
        if (!Array.isArray(entry) || typeof entry[0] !== 'string' || typeof entry[1] !== 'string' || shardMarks.has(entry[0])) continue;
        markShard(entry[0], entry[1], Number(entry[2]));
        taken += 1;
      }
      return taken;
    },

    shardReadStats() {
      return { ...laneStats, marks: shardMarks.size, junkShards: junkRuns.size };
    },

    async readIncoming({ kRoot, selfKeyId, peerKeyId, epochNow, windowW, shards = null, states = null, knownSeqOf = null, onShardFailed = null, onShardGap = null, onShardRead = null, fullWalk = false, bindBucket = false }) {
      if (bindBucket && !kRoot) throw new Error('readIncoming: bindBucket needs kRoot');
      const bucketKeys = new Map();
      const bucketKeyOf = async (bucket) => {
        if (!bucketKeys.has(bucket.address)) {
          const bytes = await computeBucketKey(await computeKEpoch(kRoot, Number(bucket.epoch)), bucket.dir, Number(bucket.epoch));
          bucketKeys.set(bucket.address, BigInt(`0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`));
        }
        return bucketKeys.get(bucket.address);
      };
      const shardFailed = (address, error) => {
        laneStats.failed += 1;
        try { onShardFailed?.(address, error); } catch { }
      };
      const buckets = shards ?? await incomingRecordShards({ kRoot, selfKeyId, peerKeyId, epochNow, windowW });
      const out = [];
      for (const bucket of buckets) {
        const key = addrKey(bucket.address);
        let marker = null;
        if (states) {
          const state = states.get(key);
          if (!state) { laneStats.absent += 1; continue; }
          if (state.deferred === true) { shardFailed(bucket.address, new Error('the state probe for this shard failed this pass')); continue; }
          if ((state.lastLt ?? state.dataHash ?? null) !== null) {
            marker = changeMarkerOf(state);
            if (shardMarks.get(key) === marker) { markShard(key, marker); laneStats.skipped += 1; continue; }
          }
        }
        const shardOpcodes = convReadOpcodesForGeneration(bucket.laneGeneration);
        let messages;
        try { messages = await readMessagesWithSource(bucket.address, { opcode: shardOpcodes }); } catch (error) { shardFailed(bucket.address, error); continue; }
        laneStats.read += 1;
        let pagedBack = 0;
        let olderReadFailed = false;
        let gapRemains = false;
        let whole = rowsAnswered(messages) < CONV_SHARD_MESSAGE_PAGE_LIMIT;
        const known = typeof knownSeqOf === 'function' ? Number(knownSeqOf(bucket.address)) : NaN;
        const mark = Number.isFinite(known) ? Math.max(known, 0) : NaN;
          const verified = new Map();
          const isOurs = async (row) => {
            const cell = row?.bodyCell;
            if (!cell) return null;
            if (verified.has(cell)) return verified.get(cell);
            const parsed = parseCapsulePublishBody(cell);
            let answer = null;
            if (parsed) {
              answer = (!verifyWriteSig
                || await verifyConvWriteSignature(parsed, bucket.writePublicKey, bucket.epoch,
                  bucket.boundary === undefined ? {} : { boundary: bucket.boundary })) ? parsed : null;
            }
            verified.set(cell, answer);
            return answer;
          };
        if (rowsAnswered(messages) >= CONV_SHARD_MESSAGE_PAGE_LIMIT && Number.isFinite(mark)) {
          const oldestSeqOf = async (rows) => {
            let oldest = null;
            for (const row of rows ?? []) {
              const parsed = await isOurs(row);
              const seq = Number(parsed?.seq);
              if (Number.isFinite(seq) && (oldest === null || seq < oldest)) oldest = seq;
            }
            return oldest;
          };
          const oldestLtOf = (rows) => {
            let oldest = null;
            for (const row of rows ?? []) {
              if (row?.createdLt == null) continue;
              try { const lt = BigInt(row.createdLt); if (oldest === null || lt < oldest) oldest = lt; } catch { }
            }
            return oldest;
          };
          const newestLtOf = (rows) => {
            let newest = null;
            for (const row of rows ?? []) {
              if (row?.createdLt == null) continue;
              try { const lt = BigInt(row.createdLt); if (newest === null || lt > newest) newest = lt; } catch { }
            }
            return newest;
          };
          const walkFull = typeof fullWalk === 'function' ? fullWalk(bucket.address) === true : fullWalk === true;
          const olderPageCap = walkFull ? CONV_MAX_OLDER_BODY_PAGES_FULL : CONV_MAX_OLDER_BODY_PAGES;
          let page = messages;
          let pageTop = newestLtOf(messages);
          let reached = false;
          let ranOut = false;
          const through = walkFull ? null : (readThrough.get(key) ?? null);
          const oldestAtOf = (rows) => {
            let at = null;
            for (const row of rows ?? []) {
              const created = Number(row?.createdAt);
              if (Number.isFinite(created) && created > 0 && (at === null || created < at)) at = created;
            }
            return at;
          };
          const reachedThrough = (rows) => {
            if (through === null) return false;
            const at = oldestAtOf(rows);
            return at !== null && at <= through - CONV_READ_THROUGH_SLACK_SEC;
          };
          while (pagedBack < olderPageCap) {
            const oldestSeq = await oldestSeqOf(page);
            if (reachedThrough(page)) { reached = true; break; }
            const oldestLt = page?.rawOldestLt != null ? BigInt(page.rawOldestLt) : oldestLtOf(page);
            if (oldestLt === null) { ranOut = true; break; }
            if (oldestSeq === null) noteJunkRun(key, oldestLt, pageTop);
            const endLt = belowJunkRuns(key, oldestLt - 1n);
            if (endLt < 0n) { ranOut = true; break; }
            let older;
            try { older = await readMessagesWithSource(bucket.address, { endLt: String(endLt), opcode: shardOpcodes }); } catch (error) { olderReadFailed = error ?? new Error('older page read failed'); break; }
            if (!older || rowsAnswered(older) === 0) { ranOut = true; break; }
            pagedBack += 1;
            laneStats.pagedBack = (laneStats.pagedBack ?? 0) + 1;
            messages = [...messages, ...older];
            page = older;
            pageTop = endLt;
            if (rowsAnswered(older) < CONV_SHARD_MESSAGE_PAGE_LIMIT) { ranOut = true; break; }
          }
          const stillOldest = await oldestSeqOf(page);
          if (!reached && !ranOut && reachedThrough(page)) reached = true;
          if (!reached && !ranOut && !olderReadFailed && stillOldest === null) {
            noteJunkRun(key, page?.rawOldestLt != null ? BigInt(page.rawOldestLt) : oldestLtOf(page), pageTop);
          }
          gapRemains = !reached && !ranOut && pagedBack >= olderPageCap;
          if (reached || ranOut) junkRuns.delete(key);
          whole = reached || ranOut;
          if (gapRemains) {
            laneStats.gaps = (laneStats.gaps ?? 0) + 1;
            try { onShardGap?.(bucket.address, { known: mark, oldest: stillOldest }); } catch { }
            if (!convGapWarnedShards.has(key)) {
              convGapWarnedShards.add(key);
              console.warn('[conv] incoming shard outran the reader — bodies between seq', mark, 'and', stillOldest, 'could not be paged this pass (cap', olderPageCap, 'pages); said once for', bucket.address);
            }
          }
        }
        if (olderReadFailed) { shardFailed(bucket.address, olderReadFailed); continue; }
        let newestAt = 0;
        if (whole) for (const row of messages ?? []) { const created = Number(row?.createdAt); if (Number.isFinite(created) && created > newestAt) newestAt = created; }
        if (marker !== null && !gapRemains) markShard(key, marker, whole && newestAt > 0 ? newestAt : undefined);
        try { onShardRead?.(bucket.address, { gap: gapRemains }); } catch { }
        const firstOfSeq = new Map();
        for (const row of messages ?? []) {
          const parsed = await isOurs(row);
          if (!parsed) continue;
          if (bindBucket && convHeader0BucketKey(parsed.header0) !== await bucketKeyOf(bucket)) continue;
          const seqKey = String(parsed.seq);
          let lt = null;
          try { lt = row?.createdLt == null ? null : BigInt(row.createdLt); } catch { lt = null; }
          const held = firstOfSeq.get(seqKey);
          if (!held || held.lt === null || (lt !== null && lt < held.lt)) firstOfSeq.set(seqKey, { row, parsed, lt });
        }
        for (const { row, parsed } of firstOfSeq.values()) {
          const { createdAt } = row;
          out.push({
            epoch: bucket.epoch,
            dir: bucket.dir,
            address: bucket.address,
            seq: parsed.seq === undefined || parsed.seq === null ? null : String(parsed.seq),
            entry: convChainEntryFromParsed(parsed),
            createdAt: Number.isFinite(Number(createdAt)) && Number(createdAt) > 0 ? Number(createdAt) : null,
          });
        }
      }
      return out;
    },
  };
}
