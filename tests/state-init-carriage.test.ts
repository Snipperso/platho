import { describe, expect, it } from 'vitest';
import {
  FV_CARRIAGE_BASE, FV_CARRIAGE_PER_BYTE, FV_FEE_TRANSPORT, FV_MSG_FORWARD_PRICES, FV_PROTOCOL_FEE,
  FV_PUBLISH_SELF_RESERVE, FV_FWD_HEADROOM,
  cellTreeStats, forwardFeeNanotons, publicPublishRoute, stateInitCarriageNanotons, vaultActionValue,
  vaultInternalPublishValue, vaultTakeFor,
} from '../web/fee-vault.mjs';
import { beginCell } from '../web/pwa-contract-transactions.mjs';


const leaf = (fill: number, bits = 8) => beginCell().uint(BigInt(fill), bits, 'leaf').endCell();

describe('STATE-INIT-CARRIAGE — the shard code a deploying publish carries is priced cell by cell', () => {
  it('SIC-01: the walker counts distinct cells and their bits, root included, a shared ref once', () => {
    const shared = leaf(1, 5);
    const root = beginCell().uint(3n, 2, 'root').ref(shared, 'a').ref(shared, 'b')
      .ref(beginCell().uint(7n, 3, 'mid').ref(leaf(2, 11), 'deep').endCell(), 'c').endCell();
    expect(cellTreeStats(root)).toEqual({ cells: 4n, bits: 21n });
    expect(cellTreeStats(null)).toEqual({ cells: 0n, bits: 0n });
  });

  it('SIC-02: the forward fee is config 25 to the letter — lump plus bit and cell prices per 2^16, rounded up', () => {
    const { lump, bit, cell } = FV_MSG_FORWARD_PRICES;
    expect({ lump, bit, cell }).toEqual({ lump: 66_667n, bit: 4_369_067n, cell: 436_906_667n });
    expect(forwardFeeNanotons({ cells: 0n, bits: 0n })).toBe(lump);
    expect(forwardFeeNanotons({ cells: 1n, bits: 0n })).toBe(lump + (cell + 65_535n) / 65_536n);
    expect(forwardFeeNanotons({ cells: 0n, bits: 1n }) - lump).toBe(67n);
    expect(forwardFeeNanotons({ cells: 1n, bits: 1016n }) - lump).toBe(74_401n);
    expect(forwardFeeNanotons({ cells: 67n, bits: 31_195n }) - lump).toBe(2_526_334n);
  });

  it('SIC-03: the StateInit term is the halves without the lump, zero with no halves, refused for half a pair', () => {
    const code = beginCell().uint(1n, 8, 'c').ref(leaf(9, 1000), 'x').ref(leaf(8, 1000), 'y').endCell();
    const data = leaf(5, 515);
    const stats = cellTreeStats(code);
    const expected = (FV_MSG_FORWARD_PRICES.bit * (stats.bits + 515n) + FV_MSG_FORWARD_PRICES.cell * (stats.cells + 1n) + 65_535n) / 65_536n;
    expect(stateInitCarriageNanotons(code, data)).toBe(expected);
    expect(stateInitCarriageNanotons(code, data)).toBe(forwardFeeNanotons({ cells: stats.cells + 1n, bits: stats.bits + 515n }) - FV_MSG_FORWARD_PRICES.lump);
    expect(stateInitCarriageNanotons(null, null)).toBe(0n);
    expect(() => stateInitCarriageNanotons(code, null)).toThrow(/together/);
    expect(() => stateInitCarriageNanotons(null, data)).toThrow(/together/);
  });

  it('SIC-04: the attach grows by exactly the term when the halves ride, and by nothing when they do not', () => {
    const code = beginCell().uint(1n, 8, 'c').ref(leaf(9, 1000), 'x').endCell();
    const data = leaf(5, 515);
    const base = { directValue: 21_600_000n, capsuleBytes: 512, feeDue: 0n };
    const term = stateInitCarriageNanotons(code, data);
    expect(vaultActionValue({ ...base, stateInit: { code, data } })).toBe(vaultActionValue(base) + term);
    expect(vaultActionValue({ ...base, stateInit: null })).toBe(vaultActionValue(base));
    expect(vaultInternalPublishValue({ ...base, stateInit: { code, data } }))
      .toBe(vaultActionValue(base) + term + FV_PUBLISH_SELF_RESERVE + FV_FWD_HEADROOM);
    expect(vaultActionValue({ ...base, feeDue: 5_000_000n, stateInit: { code, data } }))
      .toBe(21_600_000n - FV_PROTOCOL_FEE - FV_FEE_TRANSPORT + FV_CARRIAGE_BASE + FV_CARRIAGE_PER_BYTE * 512n + term + vaultTakeFor(5_000_000n));
    expect(() => vaultActionValue({ ...base, stateInit: { code, data: null } })).toThrow(/together/);
  });

  it('SIC-05: the door decision counts the halves too — one more crossing of the code turns a marginal discount into a surcharge', () => {
    let code = leaf(1, 1000);
    for (let i = 0; i < 40; i += 1) code = beginCell().uint(BigInt(i), 16, 'n').ref(code, 'prev').endCell();
    const data = leaf(5, 515);
    const term = stateInitCarriageNanotons(code, data);
    const feeDue = 5_000_000n;
    const saved = FV_PROTOCOL_FEE + FV_FEE_TRANSPORT - vaultTakeFor(feeDue);
    const bytes = Number((saved - FV_CARRIAGE_BASE - 1n) / FV_CARRIAGE_PER_BYTE);
    expect(FV_CARRIAGE_BASE + FV_CARRIAGE_PER_BYTE * BigInt(bytes) < saved).toBe(true);
    expect(FV_CARRIAGE_BASE + FV_CARRIAGE_PER_BYTE * BigInt(bytes) + term > saved, 'and the halves push it over').toBe(true);
    expect(publicPublishRoute({ kind: 0, capsuleBytes: bytes, feeDue }).route, 'a shard that exists: the discount wins').toBe('vault');
    expect(publicPublishRoute({ kind: 0, capsuleBytes: bytes, feeDue, stateInit: { code, data } }),
      'a shard this publish must create: the extra hop carries the code too, and the direct door is cheaper')
      .toEqual({ route: 'direct', reason: 'carriage' });
    expect(publicPublishRoute({ kind: 0, capsuleBytes: 512, feeDue: 0n, stateInit: { code, data } }).route).toBe('vault');
  });
});
