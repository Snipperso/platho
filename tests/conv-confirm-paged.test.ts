import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { confirmConvRecordsLanded } from '../web/conv-lane-read.mjs';


function shard(n: number, { shortPageAt = null as number | null } = {}) {
  const calls = { view: 0, record: 0, page: 0 };
  const readView = async () => { calls.view += 1; return { exists: true, recordCount: n, lastSeq: n }; };
  const readRecord = async (_a: string, id: number) => { calls.record += 1; return { exists: true, frameCommit: BigInt(1000 + id) }; };
  const readPage = async (_a: string, from: number, count: number) => {
    calls.page += 1;
    const take = shortPageAt !== null && from <= shortPageAt && shortPageAt < from + count ? count - 1 : Math.min(count, 256);
    const rows = Array.from({ length: take }, (_, i) => ({ frameCommit: BigInt(1000 + from + i), createdAt: 1 }));
    return { exists: true, fromId: from, count: rows.length, recordCount: n, rows };
  };
  return { calls, readView, readRecord, readPage };
}

describe('FLIP-07 — the paged delivery confirm', () => {
  it('CONFIRM-PAGE-01: a landed message near the top is found in ONE page', async () => {
    const s = shard(4096);
    const res = await confirmConvRecordsLanded({ ...s, address: 'x', commits: [1000n + 4094n, 1000n + 4095n], minSeq: 4000 });
    expect(res.landed).toBe(true);
    expect(s.calls.page).toBe(1);
    expect(s.calls.record, 'no per-record getters on a generation-18 shard').toBe(0);
  });

  it('CONFIRM-PAGE-02: proving ABSENCE across a full 4,096-record shard costs 16 pages, not 4,096 getters', async () => {
    const s = shard(4096);
    const res = await confirmConvRecordsLanded({ ...s, address: 'x', commits: [42n], minSeq: 1 });
    expect(res.landed).toBe(false);
    expect(res.complete, 'the walk reached record 0: the absence is authoritative').toBe(true);
    expect(res.scanned).toBe(4096);
    expect(s.calls.page).toBe(16);
    expect(s.calls.record).toBe(0);
    const legacy = shard(4096);
    const old = await confirmConvRecordsLanded({ readView: legacy.readView, readRecord: legacy.readRecord, address: 'x', commits: [42n], minSeq: 1 });
    expect(old.complete).toBe(true);
    expect(legacy.calls.record).toBe(4096);
  });

  it('CONFIRM-PAGE-03: a bounded scan pages only its window, and a found commit deep down is still found', async () => {
    const bounded = shard(1000);
    const res = await confirmConvRecordsLanded({ ...bounded, address: 'x', commits: [1000n + 100n], minSeq: 1, maxScan: 256 });
    expect(res.landed).toBe(false);
    expect(res.complete, 'an exhausted window is inconclusive, not a verdict').toBe(false);
    expect(res.scanned).toBe(256);
    expect(bounded.calls.page).toBe(1);
    const deep = shard(1000);
    const found = await confirmConvRecordsLanded({ ...deep, address: 'x', commits: [1000n + 3n], minSeq: 1 });
    expect(found.landed).toBe(true);
    expect(deep.calls.page, 'four pages down to record 3').toBe(4);
  });

  it('CONFIRM-PAGE-04: a SHORT page is never read as absence — it throws, and the caller retries', async () => {
    const s = shard(600, { shortPageAt: 500 });
    await expect(confirmConvRecordsLanded({ ...s, address: 'x', commits: [7n], minSeq: 1 }))
      .rejects.toThrow(/retried, not concluded/);
  });

  it('CONFIRM-PAGE-05: the app pages only a send whose epoch is KNOWN to be generation 18', () => {
    const app = readFileSync('web/app.js', 'utf8');
    expect(app).toContain('const readPage = Number.isFinite(sendEpoch) && generationForEpoch(sendEpoch) >= 18');
    expect(app).toContain('res = await confirmConvRecordsLanded({ readView, readRecord, readPage, address: send.address,');
  });
});
