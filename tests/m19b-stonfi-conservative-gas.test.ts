import { describe, expect, it } from 'vitest';
import { toNano } from '@ton/core';
import {
  buildStonfiTonToJettonTxParamsV21,
  cellHashHex,
  decodePtonTonTransferBodyV21,
  decodeStonfiSwapBodyV21,
  deterministicAddress,
  PLATHO_BUYBACK_STONFI_M19B,
  STONFI_V2_1,
  validateConservativeBuybackRouteProfile,
} from '../scripts/stonfi_v2_1_route_lib';

describe('M19B STON.fi conservative gas / excess profile draft', () => {
  const buybackBurn = deterministicAddress('M19B.buybackburn');
  const baseParams = {
    queryId: 0x504c4154484f19b0n,
    offerAmount: PLATHO_BUYBACK_STONFI_M19B.BUYBACK_OFFER_AMOUNT,
    minAskAmount: 987_654_321_000_000n,
    routerAddress: deterministicAddress('M19B.router'),
    ptonWalletAddress: deterministicAddress('M19B.pton.wallet'),
    askJettonWalletAddress: deterministicAddress('M19B.router.ath.wallet'),
    receiverAddress: buybackBurn,
    refundAddress: buybackBurn,
    excessesAddress: buybackBurn,
    deadline: 1_800_100_000n,
  } as const;

  it('overfunds route gas conservatively while preserving exact 50 TON offer and dex_min_out', () => {
    const tx = buildStonfiTonToJettonTxParamsV21({
      ...baseParams,
      forwardGasAmount: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_ROUTE_FORWARD_GAS,
      ptonTonTransferGas: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_PTON_TRANSFER_GAS,
    });

    const pton = decodePtonTonTransferBodyV21(tx.body);
    const swap = decodeStonfiSwapBodyV21(tx.forwardPayload);

    expect(tx.value).toBe(PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_TOTAL_STONFI_SEND_VALUE);
    expect(pton.tonAmount).toBe(toNano('50').toString());
    expect(swap.details.minAskAmount).toBe(baseParams.minAskAmount.toString());
    expect(swap.refundAddress?.equals(buybackBurn)).toBe(true);
    expect(swap.excessesAddress?.equals(buybackBurn)).toBe(true);
    expect(pton.refundAddress?.equals(buybackBurn)).toBe(true);
  });

  it('changing only conservative route funding changes total message value but not swap payload identity', () => {
    const sdkDefault = buildStonfiTonToJettonTxParamsV21(baseParams);
    const conservative = buildStonfiTonToJettonTxParamsV21({
      ...baseParams,
      forwardGasAmount: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_ROUTE_FORWARD_GAS,
      ptonTonTransferGas: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_PTON_TRANSFER_GAS,
    });

    expect(sdkDefault.value).toBe(
      PLATHO_BUYBACK_STONFI_M19B.BUYBACK_OFFER_AMOUNT +
        STONFI_V2_1.BASE_ROUTER_SWAP_TON_TO_JETTON_FORWARD_GAS +
        STONFI_V2_1.PTON_TON_TRANSFER_GAS,
    );
    expect(conservative.value).toBe(PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_TOTAL_STONFI_SEND_VALUE);

    // The pTON body and embedded swap payload keep the exact same semantic payload:
    // offer amount remains 50 TON, minAskAmount remains dex_min_out, refund/excess remain BuybackBurn.
    expect(cellHashHex(conservative.forwardPayload)).toBe(cellHashHex(sdkDefault.forwardPayload));
    expect(cellHashHex(conservative.body)).toBe(cellHashHex(sdkDefault.body));
  });

  it('rejects route profiles that leak STON.fi refund/excess to any address other than BuybackBurn', () => {
    const attacker = deterministicAddress('M19B.executor.or.attacker');

    expect(() => validateConservativeBuybackRouteProfile({
      buybackBurnAddress: buybackBurn,
      refundAddress: attacker,
      excessesAddress: buybackBurn,
      offerAmount: toNano('50'),
      routeForwardGas: toNano('1'),
      ptonTransferGas: toNano('0.05'),
    })).toThrow('refund_address must be BuybackBurn');

    expect(() => validateConservativeBuybackRouteProfile({
      buybackBurnAddress: buybackBurn,
      refundAddress: buybackBurn,
      excessesAddress: attacker,
      offerAmount: toNano('50'),
      routeForwardGas: toNano('1'),
      ptonTransferGas: toNano('0.05'),
    })).toThrow('excesses_address must be BuybackBurn');
  });
});
