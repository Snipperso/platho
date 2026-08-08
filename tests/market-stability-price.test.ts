import { readFileSync } from 'node:fs';
import { Address, Cell, beginCell } from '@ton/core';
import { describe, expect, it } from 'vitest';
import { storeBuyMarketStabilityAth } from '../build/MarketStabilitySeller/MarketStabilitySeller_ATHWallet';
import {
  ATH_ATOMIC_PER_UNIT,
  MARKET_STABILITY_ATH_TRANSFER_REQUEST_VALUE,
  MARKET_STABILITY_BASE_TRANCHE_PRICE,
  MARKET_STABILITY_BUY_EXEC_RESERVE,
  MARKET_STABILITY_TRANCHE_ATH,
  athForNanotons,
  buyValueNanotons,
  decodeMarketStabilityStateStack,
  marketStabilityCanSell,
  maxBuyableAtomic,
  quoteNanotonsForAth,
} from '../web/market-stability-read.mjs';
import { buildMarketStabilityBuyBody, nextMarketStabilityQueryId } from '../web/market-stability-buy-send.mjs';
import { serializeBoc } from '../web/pwa-contract-transactions.mjs';

// The client quotes a price for a SEALED contract it cannot correct. A mirror that falls behind a contract rebuild
// does not misprice by a little — it quotes a figure gate 23218 refuses, and the buy bounces with nothing on screen to
// explain it. So every constant here is pinned against the .tact source, exactly as publish-price.mjs is.
//
// The headline number matters too, because it will be printed at the user in ten languages: the ladder starts at
// multiplier x2 against a base of 3000 GRAM per 3,000,000-ATH tranche, i.e. 0.002 GRAM per ATH — TWICE the 0.001 the
// liquidity pool will open at. That is the design (a stabiliser stands above the pool, it is not a presale under it),
// and the copy has to say so rather than imply a discount.

const tact = readFileSync('contracts/MarketStabilitySeller.tact', 'utf8');

function tactConst(name: string): bigint {
  const match = new RegExp(`const ${name}: Int = (\\d+);`).exec(tact);
  if (!match) throw new Error(`MarketStabilitySeller.tact has no constant ${name}`);
  return BigInt(match[1]);
}

const OWNER = 'UQAxFB71mW7q9bv8qXjk9kMIS_JgAS08QDWlnLYJafGYtbzG';

describe('market stability price mirror', () => {
  it('MSPRICE-01: every mirrored constant matches the sealed contract', () => {
    expect(MARKET_STABILITY_BASE_TRANCHE_PRICE).toBe(tactConst('MARKET_STABILITY_BASE_TRANCHE_PRICE'));
    expect(MARKET_STABILITY_TRANCHE_ATH).toBe(tactConst('MARKET_STABILITY_TRANCHE_ATH'));
    expect(MARKET_STABILITY_ATH_TRANSFER_REQUEST_VALUE).toBe(tactConst('MARKET_STABILITY_ATH_TRANSFER_REQUEST_VALUE'));
    expect(MARKET_STABILITY_BUY_EXEC_RESERVE).toBe(tactConst('MARKET_STABILITY_BUY_EXEC_RESERVE'));
    // The ladder itself — the numbers the copy is built on.
    expect(tactConst('MARKET_STABILITY_START_MULTIPLIER')).toBe(2n);
    expect(tactConst('MARKET_STABILITY_END_MULTIPLIER')).toBe(21n);
    expect(tactConst('MARKET_STABILITY_TRANCHE_COUNT')).toBe(20n);
    expect(tactConst('MARKET_STABILITY_TOTAL_RESERVE_ATH')).toBe(60_000_000n * ATH_ATOMIC_PER_UNIT);
  });

  it('MSPRICE-02: the opening price is 0.002 GRAM per ATH, and the last tranche is 0.021', () => {
    expect(quoteNanotonsForAth(ATH_ATOMIC_PER_UNIT, 2)).toBe(2_000_000n);       // 0.002 GRAM
    expect(quoteNanotonsForAth(ATH_ATOMIC_PER_UNIT, 21)).toBe(21_000_000n);     // 0.021 GRAM
    // A whole opening tranche: 3,000,000 ATH at x2 = 6000 GRAM.
    expect(quoteNanotonsForAth(MARKET_STABILITY_TRANCHE_ATH, 2)).toBe(6_000_000_000_000n);
  });

  it('MSPRICE-03: the quote CEILS, exactly as the contract does', () => {
    // Rounding down would quote a figure gate 23218 refuses. One nanoton, one bounced buy, nothing on screen.
    // At x2 an atomic unit costs 2/1000 of a nanoton, so any sub-500-unit amount is pure rounding.
    expect(quoteNanotonsForAth(1n, 2)).toBe(1n);
    expect(quoteNanotonsForAth(499n, 2)).toBe(1n);
    expect(quoteNanotonsForAth(500n, 2)).toBe(1n);
    expect(quoteNanotonsForAth(501n, 2)).toBe(2n);
    expect(quoteNanotonsForAth(0n, 2)).toBe(0n);
  });

  it('MSPRICE-04: the GRAM->ATH direction never returns an amount the user cannot afford', () => {
    // The one property the pair must satisfy: type a GRAM figure, get an amount, and the quote for that amount fits
    // inside what you typed. Inverting the ceiling algebraically would sometimes be one nanoton over.
    for (let multiplier = 2; multiplier <= 21; multiplier += 1) {
      for (const budget of [1n, 999n, 1_000n, 2_000_000n, 6_500_000n, 1_000_000_000n, 6_000_000_000_000n]) {
        const amount = athForNanotons(budget, multiplier);
        expect(
          quoteNanotonsForAth(amount, multiplier) <= budget,
          `x${multiplier}, budget ${budget}: ${amount} atomic costs ${quoteNanotonsForAth(amount, multiplier)}`,
        ).toBe(true);
      }
    }
  });

  it('MSPRICE-05: the attached value carries the delivery overhead the gate checks', () => {
    const amount = 1_000n * ATH_ATOMIC_PER_UNIT;
    expect(buyValueNanotons(amount, 2)).toBe(quoteNanotonsForAth(amount, 2) + 60_000_000n);
  });
});

describe('market stability state', () => {
  const stack = (nums: Array<number | bigint>) => nums.map((v) => ({ value: `0x${BigInt(v).toString(16)}` }));
  // 14 fields; 6..8 are addresses and are never read, so any placeholder is fine positionally.
  const liveStack = stack([0, 60_000_000n * ATH_ATOMIC_PER_UNIT, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3_000_000n * ATH_ATOMIC_PER_UNIT, 0]);

  it('MSSTATE-01: decodes the live shape read off mainnet', () => {
    const state = decodeMarketStabilityStateStack(liveStack);
    expect(state.phase).toBe(0);
    expect(state.currentMultiplier).toBe(2);
    expect(state.reserveDueAth).toBe(60_000_000n * ATH_ATOMIC_PER_UNIT);
    expect(state.currentTrancheRemainingAth).toBe(3_000_000n * ATH_ATOMIC_PER_UNIT);
  });

  it('MSSTATE-02: a short stack throws instead of handing values to the wrong field', () => {
    expect(() => decodeMarketStabilityStateStack(stack([0, 1, 2]))).toThrow(/expected 14/);
  });

  it('MSSTATE-03: the buyable amount is clamped by BOTH bounds, not just the tranche', () => {
    // Gate 23215 caps at the tranche remainder, 23216 at the undelivered reserve. Near the end of the reserve the
    // second is the smaller one, and offering the first would compose a transaction the contract refuses.
    expect(maxBuyableAtomic({ currentTrancheRemainingAth: 500n, reserveDueAth: 900n })).toBe(500n);
    expect(maxBuyableAtomic({ currentTrancheRemainingAth: 900n, reserveDueAth: 500n })).toBe(500n);
  });

  it('MSSTATE-04: a busy or sold-out seller cannot sell', () => {
    const base = { exists: true, phase: 0, currentTrancheRemainingAth: 10n, reserveDueAth: 10n };
    expect(marketStabilityCanSell(base)).toBe(true);
    expect(marketStabilityCanSell({ ...base, phase: 1 }), 'a sale in flight refuses at 23211').toBe(false);
    expect(marketStabilityCanSell({ ...base, reserveDueAth: 0n })).toBe(false);
    expect(marketStabilityCanSell({ ...base, exists: false }), 'an unreadable seller is unknown, not empty').toBe(false);
  });
});

describe('market stability buy message', () => {
  it('MSBUY-01: the body is byte-identical to the compiled storeBuyMarketStabilityAth', () => {
    const queryId = 1_786_000_000_000n;
    const amount = 1_234n * ATH_ATOMIC_PER_UNIT;
    const mine = buildMarketStabilityBuyBody({ queryId, amountAtomic: amount, recipient: OWNER });
    const reference = beginCell()
      .store(storeBuyMarketStabilityAth({ $$type: 'BuyMarketStabilityAth', query_id: queryId, amount, recipient: Address.parse(OWNER) }))
      .endCell();
    // The browser builder returns its own cell shape; compare the serialized bits through @ton/core.
    const parsed = Cell.fromBoc(Buffer.from(serializeBoc(mine)))[0];
    expect(parsed.hash().toString('hex')).toBe(reference.hash().toString('hex'));
  });

  it('MSBUY-02: a query id is always above the seller’s last terminal one', () => {
    // Gate 23012 only requires ">", so a timestamp works and cannot be raced out of — but it must still win against a
    // terminal id that is somehow ahead of the clock, or every buy from this device bounces forever.
    expect(nextMarketStabilityQueryId(0n, 1_000n)).toBe(1_000n);
    expect(nextMarketStabilityQueryId(5_000n, 1_000n)).toBe(5_001n);
    expect(nextMarketStabilityQueryId(999n, 1_000n)).toBe(1_000n);
  });

  it('MSBUY-03: a zero or negative amount is refused before it can bounce on chain', () => {
    expect(() => buildMarketStabilityBuyBody({ queryId: 1n, amountAtomic: 0n, recipient: OWNER })).toThrow(/positive/);
    expect(() => buildMarketStabilityBuyBody({ queryId: 0n, amountAtomic: 1n, recipient: OWNER })).toThrow(/query_id/);
  });
});
