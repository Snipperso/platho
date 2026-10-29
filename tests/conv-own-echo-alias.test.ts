import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';


const app = readFileSync('web/app.js', 'utf8');

function cut(startMark: string, endMark: string, minLength: number): string {
  const start = app.indexOf(startMark);
  const end = app.indexOf(endMark);
  expect(start, `${startMark} must exist`).toBeGreaterThan(-1);
  expect(end, `${endMark} must exist`).toBeGreaterThan(start);
  const source = app.slice(start, end);
  expect(source.length, `slice ${startMark} looks truncated or bloated`).toBeGreaterThan(minLength);
  return source;
}

function loadEchoMatcher() {
  const source = cut('function findOwnEchoForChainCopy', 'async function absorbOwnChainCopy', 2000);
  const prelude = `
    const CONV_OWN_ECHO_TIME_SLACK_MS = 5000;
    const privateEntryIdValue = ({ entry_id } = {}) => {
      if (entry_id === null || entry_id === undefined) return null;
      const n = Number(entry_id);
      return Number.isFinite(n) ? n : null;
    };
    const sameConvShardAddress = (a, b) => String(a) === String(b);
    const messageCreatedAtMs = (m) => (Number.isFinite(Number(m?.createdAtMs)) ? Number(m.createdAtMs) : null);
  `;
  // eslint-disable-next-line no-new-func
  return new Function(`${prelude}\n${source}\nreturn findOwnEchoForChainCopy;`)();
}

function runSeqMarkSeeder(messages: unknown[]): { marks: Map<string, number>, seeded: number } {
  const source = cut('function seedConvSeqMarksFromHistory', 'function advanceConvBucketSeqHighWater', 500);
  const marks = new Map<string, number>();
  const prelude = `
    const advanceConvBucketSeqHighWater = (address, seq) => {
      if (!address || !Number.isFinite(seq)) return;
      marks.set(address, Math.max(marks.get(address) ?? -1, seq));
    };
    // The real bucketing: 'published'/'sent' are the green metas the delivery confirm writes; red text stays red.
    const messageStatusKey = (m) => {
      const t = String(m?.meta ?? '').toLowerCase();
      if (t.includes('failed') || t.includes('not sent')) return 'failed';
      if (t.includes('published') || t.includes('sent')) return 'sent';
      return 'info';
    };
  `;
  // eslint-disable-next-line no-new-func
  const seeded = new Function('marks', 'messages', `${prelude}\n${source}\nreturn seedConvSeqMarksFromHistory(messages);`)(marks, messages);
  return { marks, seeded };
}

describe('CONVALIAS — the sibling device message stands, the dead claim does not', () => {
  const T = 1_756_200_000_000;

  it('CONVALIAS-01: a copy under the red echo seq but sealed at ANOTHER time is NOT merged into it', () => {
    const echo = { type: 'out', chainEntryId: '5', convShardAddress: 'S', convSealedAtMs: T, createdAtMs: T, meta: 'Send failed' };
    const copy = { type: 'out', chainEntryId: '5', convShardAddress: 'S', createdAtMs: T + 40_000 };
    expect(loadEchoMatcher()({ messages: [echo] }, copy)).toBe(null);
  });

  it('CONVALIAS-02: the same seq sealed in the SAME second is still my own copy — the merge heal survives', () => {
    const echo = { type: 'out', chainEntryId: '5', convShardAddress: 'S', convSealedAtMs: T, createdAtMs: T, meta: 'not confirmed' };
    const copy = { type: 'out', chainEntryId: '5', convShardAddress: 'S', createdAtMs: T + 1_000 };
    expect(loadEchoMatcher()({ messages: [echo] }, copy)).toBe(echo);
  });

  it('CONVALIAS-03: an echo that predates the seal stamp keeps matching by (shard, seq) alone', () => {
    const echo = { type: 'out', chainEntryId: '7', convShardAddress: 'S', createdAtMs: T, meta: 'sending' };
    const copy = { type: 'out', chainEntryId: '7', convShardAddress: 'S', createdAtMs: T + 90_000 };
    expect(loadEchoMatcher()({ messages: [echo] }, copy)).toBe(echo);
  });

  it('CONVALIAS-04: the seq high-water seeds only from CHAIN-PROVEN rows — a red echo contributes nothing', () => {
    const { marks, seeded } = runSeqMarkSeeder([
      { type: 'out', meta: 'Send failed — not sent', chainEntryId: '5', convShardAddress: 'S1' },
      { type: 'out', meta: 'received', capsule: { id: 'c1' }, chainEntryId: '4', convShardAddress: 'S2' },
      { type: 'out', meta: 'published', chainEntryId: '2', chainLastEntryId: '3', convShardAddress: 'S3' },
      { type: 'in', meta: 'whatever', chainEntryId: '9', convShardAddress: 'S4' },
      { type: 'out', meta: 'sent, not verified', chainEntryId: '7', convShardAddress: 'S5' },
    ]);
    expect(marks.has('S1'), 'the unproven claim must not become a mark').toBe(false);
    expect(marks.get('S2')).toBe(4);
    expect(marks.get('S3'), 'a multipart seeds its LAST record').toBe(3);
    expect(marks.get('S4')).toBe(9);
    expect(marks.has('S5'), 'an unverified send is not proof').toBe(false);
    expect(seeded).toBe(3);
  });
});
