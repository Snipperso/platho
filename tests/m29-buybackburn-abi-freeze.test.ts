import { describe, expect, it } from 'vitest';
import { BuybackBurn } from '../build/BuybackBurn/BuybackBurn_BuybackBurn';

function hexOpcode(value: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(8, '0')}`;
}

describe('M29 BuybackBurn ABI freeze', () => {
  it('M29-BUYBACK-ABI-01: generated wrapper exposes the final BY* BuybackBurn opcode table', () => {
    const opcodes = BuybackBurn.opcodes as Record<string, number>;

    expect(hexOpcode(opcodes.AcceptBurnReserve)).toBe('0x594BA505');
    expect(hexOpcode(opcodes.BindBuybackFeeAccumulator)).toBe('0x42594641');
    expect(hexOpcode(opcodes.BindBuybackOfficialAthWallet)).toBe('0x42594157');
    expect(hexOpcode(opcodes.FreezeBuybackRoute)).toBe('0x42595246');
    expect(hexOpcode(opcodes.SealBuybackBurnGenesis)).toBe('0x4259534C');
    expect(hexOpcode(opcodes.ExecuteBuybackChunk)).toBe('0x42594558');
    expect(hexOpcode(opcodes.RetryAthBurnDue)).toBe('0x42595254');
    expect(hexOpcode(opcodes.RecoverStonfiRouteRefund)).toBe('0x42595243');
    expect(hexOpcode(opcodes.RecycleRouteRefundReserve)).toBe('0x42595252');
    expect(hexOpcode(opcodes.TopUpStorageReserve)).toBe('0x906182D2');

    expect(opcodes.ExecuteBuyback).toBeUndefined();
    expect(opcodes.BuybackBounceRecovery).toBeUndefined();
    expect(opcodes.PruneStuckBuyback).toBeUndefined();
  });
});
