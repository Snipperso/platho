import { describe, expect, it } from 'vitest';
import { toNano } from '@ton/core';
import {
  buildStonfiTonToJettonTxParamsV21,
  decodePtonTonTransferBodyV21,
  decodeStonfiSwapBodyV21,
  deterministicAddress,
  STONFI_V2_1,
} from '../scripts/stonfi_v2_1_route_lib';

describe('M19A STON.fi route discovery / payload conformance draft', () => {
  it('builds SDK v2.1-equivalent TON->jetton payload and places dex_min_out in minAskAmount', () => {
    const minAskAmount = 987_654_321_000n;
    const offerAmount = toNano('50');
    const queryId = 19n;
    const deadline = 1_800_000_001n;

    const tx = buildStonfiTonToJettonTxParamsV21({
      queryId,
      offerAmount,
      minAskAmount,
      routerAddress: deterministicAddress('M19.router'),
      ptonWalletAddress: deterministicAddress('M19.pton.wallet'),
      askJettonWalletAddress: deterministicAddress('M19.router.ath.wallet'),
      receiverAddress: deterministicAddress('M19.buybackburn'),
      refundAddress: deterministicAddress('M19.buybackburn'),
      excessesAddress: deterministicAddress('M19.buybackburn'),
      deadline,
    });

    const pton = decodePtonTonTransferBodyV21(tx.body);
    const swap = decodeStonfiSwapBodyV21(tx.forwardPayload);

    expect(pton.op).toBe(STONFI_V2_1.PTON_OP_TON_TRANSFER);
    expect(pton.queryId).toBe(queryId.toString());
    expect(pton.tonAmount).toBe(offerAmount.toString());
    expect(pton.hasForwardPayload).toBe(true);

    expect(swap.op).toBe(STONFI_V2_1.DEX_OP_SWAP);
    expect(swap.deadline).toBe(deadline.toString());
    expect(swap.details.minAskAmount).toBe(minAskAmount.toString());
    expect(swap.details.dexCustomPayloadForwardGasAmount).toBe('0');
    expect(swap.details.hasDexCustomPayload).toBe(false);
    expect(swap.details.refundForwardGasAmount).toBe('0');
    expect(swap.details.hasRefundPayload).toBe(false);
    expect(swap.details.referralValue).toBe('10');
  });

  it('uses SDK v2.1 default value formula: offer + router forward gas + pTON transfer gas', () => {
    const offerAmount = toNano('50');
    const tx = buildStonfiTonToJettonTxParamsV21({
      offerAmount,
      minAskAmount: 1n,
      routerAddress: deterministicAddress('M19.router.value'),
      ptonWalletAddress: deterministicAddress('M19.pton.wallet.value'),
      askJettonWalletAddress: deterministicAddress('M19.router.ath.wallet.value'),
      receiverAddress: deterministicAddress('M19.buybackburn.value'),
      refundAddress: deterministicAddress('M19.buybackburn.value'),
      excessesAddress: deterministicAddress('M19.buybackburn.value'),
      deadline: 1_800_000_002n,
    });

    expect(tx.value).toBe(
      offerAmount +
      STONFI_V2_1.BASE_ROUTER_SWAP_TON_TO_JETTON_FORWARD_GAS +
      STONFI_V2_1.PTON_TON_TRANSFER_GAS,
    );
  });

  it('keeps production BuybackBurn blocked until real ATH/TON route values and quote policy are pinned', () => {
    const unresolved = [
      'ATH_MASTER_ADDRESS',
      'STONFI_ROUTER_ADDRESS',
      'STONFI_POOL_ADDRESS_TON_ATH',
      'STONFI_PTON_ADDRESS',
      'STONFI_SWAP_PAYLOAD_LAYOUT_SAMPLE',
      'BUYBACK_MIN_ATH_OUT_PER_50_TON',
    ];

    expect(unresolved.length).toBeGreaterThan(0);
    expect(unresolved).toContain('BUYBACK_MIN_ATH_OUT_PER_50_TON');
  });
});
