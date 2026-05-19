import { describe, expect, it } from 'vitest';
import {
  createFixtureFinalCandidateM19D,
  createRouteCandidateTemplateM19D,
  validateRouteCandidateInputM19D,
} from '../scripts/stonfi_route_candidate_intake_m19d';
import {
  buildStonfiTonToJettonTxParamsV21,
  cellBocBase64,
  deterministicAddress,
} from '../scripts/stonfi_v2_1_route_lib';

describe('M19D STON.fi route candidate intake and evidence template', () => {
  it('template remains non-final and cannot pass route freeze by itself', () => {
    const template = createRouteCandidateTemplateM19D();
    const report = validateRouteCandidateInputM19D(template);

    expect(report.freezeReady).toBe(false);
    const codes = report.issues.map((issue) => issue.code);
    expect(codes).toContain('CANDIDATE_PARSE_FAILED');
  });

  it('accepts a complete SDK/API evidence candidate when all route and live-proof fields match', () => {
    const candidate = createFixtureFinalCandidateM19D();
    const report = validateRouteCandidateInputM19D({ candidate });

    expect(report.freezeReady).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.rebuiltHashes?.ptonTransferBodyHash).toBe(report.rebuiltHashes?.samplePtonTransferBodyHash);
    expect(report.rebuiltHashes?.stonfiSwapForwardPayloadHash).toBe(report.rebuiltHashes?.sampleStonfiSwapForwardPayloadHash);
  });

  it('rejects evidence that routes refund/excess away from BuybackBurn even if the body decodes', () => {
    const candidate = createFixtureFinalCandidateM19D();
    const leakedAddress = deterministicAddress('M19D.test.executor.leak.address');
    const tx = buildStonfiTonToJettonTxParamsV21({
      queryId: candidate.swap.queryId,
      offerAmount: candidate.swap.offerAmountNanotons,
      minAskAmount: candidate.swap.dexMinOutAtomicAth,
      routerAddress: candidate.addresses.stonfiRouterAddress,
      ptonWalletAddress: candidate.addresses.stonfiPtonWalletAddress,
      askJettonWalletAddress: candidate.addresses.askJettonWalletAddress,
      receiverAddress: candidate.addresses.buybackBurnOfficialAthWalletAddress,
      refundAddress: leakedAddress,
      excessesAddress: leakedAddress,
      deadline: candidate.swap.deadline,
      forwardGasAmount: candidate.swap.routeForwardGasNanotons,
      ptonTonTransferGas: candidate.swap.ptonTransferGasNanotons,
    });

    const report = validateRouteCandidateInputM19D({
      candidate: {
        ...candidate,
        sdkSample: {
          ptonTransferBodyBocBase64: cellBocBase64(tx.body),
          stonfiSwapForwardPayloadBocBase64: cellBocBase64(tx.forwardPayload),
        },
      },
    });

    expect(report.freezeReady).toBe(false);
    const codes = report.issues.map((issue) => issue.code);
    expect(codes).toContain('SAMPLE_PTON_REFUND_NOT_BUYBACK');
    expect(codes).toContain('SAMPLE_SWAP_REFUND_NOT_BUYBACK');
    expect(codes).toContain('SAMPLE_SWAP_EXCESSES_NOT_BUYBACK');
  });
});
