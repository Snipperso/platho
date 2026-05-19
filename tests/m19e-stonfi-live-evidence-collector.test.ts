import { describe, expect, it } from 'vitest';
import {
  collectLiveEvidenceM19E,
  createFixtureLiveEvidenceInputM19E,
  createLiveEvidenceInputTemplateM19E,
} from '../scripts/stonfi_live_evidence_collector_m19e';
import {
  buildStonfiTonToJettonTxParamsV21,
  cellBocBase64,
  deterministicAddress,
  PLATHO_BUYBACK_STONFI_M19B,
} from '../scripts/stonfi_v2_1_route_lib';

describe('M19E STON.fi live SDK/API evidence collector', () => {
  it('template is non-final and cannot pass route freeze', () => {
    const template = createLiveEvidenceInputTemplateM19E();
    const report = collectLiveEvidenceM19E(template);

    expect(report.route_freeze_ready).toBe(false);
    expect(report.issue_codes.length).toBeGreaterThan(0);
  });

  it('accepts complete official SDK/API tx evidence and converts it into a freeze-ready route candidate', () => {
    const input = createFixtureLiveEvidenceInputM19E();
    const report = collectLiveEvidenceM19E(input);

    expect(report.route_freeze_ready).toBe(true);
    expect(report.issue_codes).toEqual([]);
    expect(report.candidate_validation?.freezeReady).toBe(true);
    expect(report.decoded?.ptonTransfer.tonAmount).toBe(PLATHO_BUYBACK_STONFI_M19B.BUYBACK_OFFER_AMOUNT.toString());
    expect(report.candidate_validation?.rebuiltHashes?.ptonTransferBodyHash).toBe(report.candidate_validation?.rebuiltHashes?.samplePtonTransferBodyHash);
  });

  it('rejects official tx params whose to address is not the pinned pTON wallet', () => {
    const input = createFixtureLiveEvidenceInputM19E();
    input.sdkTxParams.to = deterministicAddress('M19E.bad.tx.to').toString();

    const report = collectLiveEvidenceM19E(input);

    expect(report.route_freeze_ready).toBe(false);
    expect(report.issue_codes).toContain('SDK_TX_TO_NOT_PTON_WALLET');
  });

  it('rejects underfunded official tx params even when the body itself is valid', () => {
    const input = createFixtureLiveEvidenceInputM19E();
    input.sdkTxParams.valueNanotons = '50310000000';

    const report = collectLiveEvidenceM19E(input);

    expect(report.route_freeze_ready).toBe(false);
    expect(report.issue_codes).toContain('SDK_TX_VALUE_NOT_CONSERVATIVE_TOTAL');
  });

  it('rejects a tx body that routes swap excess away from BuybackBurn', () => {
    const input = createFixtureLiveEvidenceInputM19E();
    const leaked = deterministicAddress('M19E.executor.leaks.excess');
    const tx = buildStonfiTonToJettonTxParamsV21({
      queryId: input.swap.queryId,
      offerAmount: PLATHO_BUYBACK_STONFI_M19B.BUYBACK_OFFER_AMOUNT,
      minAskAmount: input.swap.dexMinOutAtomicAth,
      routerAddress: input.addresses.stonfiRouterAddress,
      ptonWalletAddress: input.addresses.stonfiPtonWalletAddress,
      askJettonWalletAddress: input.addresses.askJettonWalletAddress,
      receiverAddress: input.addresses.buybackBurnOfficialAthWalletAddress,
      refundAddress: input.addresses.buybackBurnAddress,
      excessesAddress: leaked,
      deadline: input.swap.deadline,
      forwardGasAmount: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_ROUTE_FORWARD_GAS,
      ptonTonTransferGas: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_PTON_TRANSFER_GAS,
    });
    input.sdkTxParams.bodyBocBase64 = cellBocBase64(tx.body);

    const report = collectLiveEvidenceM19E(input);

    expect(report.route_freeze_ready).toBe(false);
    expect(report.issue_codes).toContain('SAMPLE_SWAP_EXCESSES_NOT_BUYBACK');
  });
});
