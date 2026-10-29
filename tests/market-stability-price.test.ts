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
    expect(tactConst('MARKET_STABILITY_START_MULTIPLIER')).toBe(2n);
    expect(tactConst('MARKET_STABILITY_END_MULTIPLIER')).toBe(21n);
    expect(tactConst('MARKET_STABILITY_TRANCHE_COUNT')).toBe(20n);
    expect(tactConst('MARKET_STABILITY_TOTAL_RESERVE_ATH')).toBe(60_000_000n * ATH_ATOMIC_PER_UNIT);
  });

  it('MSPRICE-02: the opening price is 0.002 GRAM per ATH, and the last tranche is 0.021', () => {
    expect(quoteNanotonsForAth(ATH_ATOMIC_PER_UNIT, 2)).toBe(2_000_000n);
    expect(quoteNanotonsForAth(ATH_ATOMIC_PER_UNIT, 21)).toBe(21_000_000n);
    expect(quoteNanotonsForAth(MARKET_STABILITY_TRANCHE_ATH, 2)).toBe(6_000_000_000_000n);
  });

  it('MSPRICE-03: the quote CEILS, exactly as the contract does', () => {
    expect(quoteNanotonsForAth(1n, 2)).toBe(1n);
    expect(quoteNanotonsForAth(499n, 2)).toBe(1n);
    expect(quoteNanotonsForAth(500n, 2)).toBe(1n);
    expect(quoteNanotonsForAth(501n, 2)).toBe(2n);
    expect(quoteNanotonsForAth(0n, 2)).toBe(0n);
  });

  it('MSPRICE-04: the GRAM->ATH direction never returns an amount the user cannot afford', () => {
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
    const parsed = Cell.fromBoc(Buffer.from(serializeBoc(mine)))[0];
    expect(parsed.hash().toString('hex')).toBe(reference.hash().toString('hex'));
  });

  it('MSBUY-02: a query id is always above the seller’s last terminal one', () => {
    expect(nextMarketStabilityQueryId(0n, 1_000n)).toBe(1_000n);
    expect(nextMarketStabilityQueryId(5_000n, 1_000n)).toBe(5_001n);
    expect(nextMarketStabilityQueryId(999n, 1_000n)).toBe(1_000n);
  });

  it('MSBUY-03: a zero or negative amount is refused before it can bounce on chain', () => {
    expect(() => buildMarketStabilityBuyBody({ queryId: 1n, amountAtomic: 0n, recipient: OWNER })).toThrow(/positive/);
    expect(() => buildMarketStabilityBuyBody({ queryId: 0n, amountAtomic: 1n, recipient: OWNER })).toThrow(/query_id/);
  });
});
