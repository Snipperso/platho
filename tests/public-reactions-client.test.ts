import { describe, expect, it } from 'vitest';
import { beginCell, Cell } from '@ton/core';
import {
  PUBLIC_REACT_OPCODE, PUBLIC_REACT_VALUE, PUBLIC_REACTION_COUNT, PUBLIC_REACTION_GLYPHS, PUBLIC_REACTION_PAGE_CAP,
  buildReactMessage, createOwnReactionStore, decodePublicReactions, reactionGlyph, reactionsGetterCall, reactionsShown,
  reactionsTotal,
} from '../web/public-reactions.mjs';
import { parseBocBase64 } from '../web/pwa-contract-transactions.mjs';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// REACTIONS — the client half, without a chain. The contract half (the receiver, the gates, the getter's gas and
// the client mirror against the compiled shard) lives in contracts18/tests/public-reactions.test.ts.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('PUBLIC-REACTIONS (client)', () => {
  it('RXC-01: the message is `React{ target, emoji }` under the contract opcode, with the receiver demand attached', () => {
    const built = buildReactMessage({ shardAddress: '0:' + 'ab'.repeat(32), target: 7, emoji: 3 });
    expect(built.address).toBe('0:' + 'ab'.repeat(32));
    expect(built.amount).toBe(PUBLIC_REACT_VALUE);
    expect(PUBLIC_REACT_VALUE).toBe(4_350_000n);   // 3,850,000 until audit round 3: PS_REACT_GAS 2.0M -> 2.5M
    expect(built.bounce).toBe(true);
    expect(parseBocBase64(built.payload), 'a well-formed BoC in the project own reader').toBeTruthy();
    // the body: op u32 ‖ target u32 ‖ emoji u8 — 72 bits, nothing else
    const bits = bitsOf(built.payload);
    expect(bits.length).toBe(72);
    expect(parseInt(bits.slice(0, 32), 2)).toBe(PUBLIC_REACT_OPCODE);
    expect(parseInt(bits.slice(32, 64), 2)).toBe(7);
    expect(parseInt(bits.slice(64, 72), 2)).toBe(3);
    // `extra` rides the amount (the squat cushion), never the body
    expect(buildReactMessage({ shardAddress: '0:' + 'ab'.repeat(32), target: 7, emoji: 3, extra: 1_000n }).amount).toBe(PUBLIC_REACT_VALUE + 1_000n);
    expect(() => buildReactMessage({ shardAddress: '0:' + 'ab'.repeat(32), target: 7, emoji: 16 })).toThrow(/no reaction/);
    expect(() => buildReactMessage({ shardAddress: '0:' + 'ab'.repeat(32), target: -1, emoji: 0 })).toThrow(/uint32/);
    expect(() => buildReactMessage({ shardAddress: '', target: 1, emoji: 0 })).toThrow(/shard address/);
  });

  it('RXC-02: sixteen glyphs, one per index, none repeated — and an index once used keeps its meaning', () => {
    expect(PUBLIC_REACTION_COUNT).toBe(16);
    expect(PUBLIC_REACTION_GLYPHS.length).toBe(16);
    expect(new Set(PUBLIC_REACTION_GLYPHS).size).toBe(16);
    // PINNED: the first eight are the launch row; a change here would relabel every count already on chain
    expect(PUBLIC_REACTION_GLYPHS.slice(0, 8)).toEqual(['❤️', '👍', '👎', '🔥', '😂', '😮', '😢', '🙏']);
    expect(reactionGlyph(3)).toBe('🔥');
    expect(() => reactionGlyph(16)).toThrow(/no reaction/);
  });

  it('RXC-03: the getter decoder walks the ref-chained 512-bit cells the contract packs, tail first', () => {
    // build what packReactions builds: one cell per target, sixteen u32, each cell referencing the NEXT
    const row = (counters: number[]) => { const b = beginCell(); for (const c of counters) b.storeUint(c, 32); return b; };
    const third = row(Array.from({ length: 16 }, (_, i) => (i === 15 ? 5 : 0))).endCell();
    const second = row(new Array(16).fill(0)).storeRef(third).endCell();
    const first = row(Array.from({ length: 16 }, (_, i) => (i === 0 ? 2 : i === 3 ? 1 : 0))).storeRef(second).endCell();
    const result = { exit_code: 0, stack: [
      { type: 'num', value: '0x4' }, { type: 'num', value: '0x3' }, { type: 'num', value: '0x2a' },
      { type: 'cell', cell: first.toBoc().toString('base64') },
    ] };
    const page = decodePublicReactions(result);
    expect(page.from_target).toBe(4n);
    expect(page.count).toBe(3);
    expect(page.entry_count).toBe(42n);
    expect(page.rows.map((r) => Number(r.target))).toEqual([4, 5, 6]);
    expect(page.rows[0].counters[0]).toBe(2);
    expect(page.rows[0].counters[3]).toBe(1);
    expect(page.rows[2].counters[15]).toBe(5);
    expect(reactionsTotal(page.rows[0].counters)).toBe(3);
    expect(reactionsShown(page.rows[0].counters)).toEqual([{ index: 0, count: 2, glyph: '❤️' }, { index: 3, count: 1, glyph: '🔥' }]);
    expect(reactionsShown(page.rows[1].counters)).toEqual([]);
    expect(() => decodePublicReactions({ exit_code: 0, stack: [{ type: 'num', value: '0x0' }] })).toThrow(/ABI mismatch/);
  });

  it('RXC-04: the getter call is capped at the page the contract answers, in the wire shape runGetMethod takes', () => {
    const call = reactionsGetterCall('0:' + 'cd'.repeat(32), 40, 500);
    expect(call.method).toBe('get_reactions');
    expect(call.stack).toEqual([{ type: 'num', value: '0x28' }, { type: 'num', value: `0x${PUBLIC_REACTION_PAGE_CAP.toString(16)}` }]);
    expect(reactionsGetterCall('0:' + 'cd'.repeat(32), 0, 0).stack[1]).toEqual({ type: 'num', value: '0x1' });
  });

  it('RXC-05: what this device pressed is remembered per wallet, survives a reload, and never leaks to another wallet', () => {
    const bag = new Map<string, string>();
    const storage = { getItem: (k: string) => bag.get(k) ?? null, setItem: (k: string, v: string) => { bag.set(k, v); } };
    const shard = '0:' + 'EF'.repeat(32);
    const store = createOwnReactionStore({ storage, wallet: '0:' + '11'.repeat(32) });
    expect(store.has(shard, 5, 2)).toBe(false);
    store.note(shard, 5, 2);
    store.note(shard, 5, 9);
    expect(store.has(shard.toLowerCase(), 5n, 2), 'address case and target type do not matter').toBe(true);
    expect(store.mine(shard, 5).sort()).toEqual([2, 9]);
    expect(store.mine(shard, 6)).toEqual([]);
    // a reload reads it back
    const again = createOwnReactionStore({ storage, wallet: '0:' + '11'.repeat(32) });
    expect(again.mine(shard, 5).sort()).toEqual([2, 9]);
    // another wallet on the same device starts clean
    const other = createOwnReactionStore({ storage, wallet: '0:' + '22'.repeat(32) });
    expect(other.size()).toBe(0);
    // and a storage that throws is a device that simply forgets, not a crash
    const broken = createOwnReactionStore({ storage: { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } }, wallet: 'w' });
    broken.note(shard, 1, 1);
    expect(broken.has(shard, 1, 1)).toBe(true);
  });
});

/** The bit string of a single-cell BoC's data — enough to read a 72-bit body without a cell library. */
function bitsOf(bocBase64: string): string {
  const cell = Cell.fromBase64(bocBase64);
  const s = cell.beginParse();
  let out = '';
  while (s.remainingBits > 0) out += s.loadBit() ? '1' : '0';
  return out;
}

describe('PUBLIC-REACTIONS (client, the press reconciliation) [audit 2026-09-05, round 2]', () => {
  it('RXC-06: a re-read lands PAST the settle window, so a press the chain never showed can be forgotten; counters age out', () => {
    // Round 1 scheduled re-reads at 15/45/90 s under a 120 s settle window: every read arrived young, kept the
    // optimistic figure, and nothing ever read the target again — the forget branch was unreachable.
    const app = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
    const num = (name: string) => {
      const m = app.match(new RegExp(`const ${name} = ([^;]+);`));
      if (!m) throw new Error(`${name} not found`);
      // eslint-disable-next-line no-new-func
      return new Function(`return (${m[1]});`)();
    };
    const settle = Number(num('REACTION_SETTLE_MS'));
    const delays = (num('REACTION_REREAD_DELAYS_MS') as number[]).map(Number);
    expect(delays.length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...delays), 'the last re-read must be older than the settle window when it lands').toBeGreaterThan(settle);
    expect(Math.min(...delays), 'and the first must give the hop time to land (p50 27 s measured 2026-09-04)').toBeGreaterThanOrEqual(15_000);
    // counters are trusted for a bounded time, then a render asks again
    const ttl = Number(num('REACTION_COUNTS_TTL_MS'));
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(10 * 60_000);
    expect(app).toContain('const fresh = reactionCounts.has(key) && Date.now() - (reactionReadAt.get(key) ?? 0) < REACTION_COUNTS_TTL_MS;');
    expect(app).toContain('if (!force && fresh && !reactionsOwedFor(key)) return;');
    // a hidden entry gets no bar: the press would be refused at 13743 and cost the send fee
    expect(app).toContain("if (item?.hidden === true) return;");
  });
});
