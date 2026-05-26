import { describe, expect, it } from 'vitest';
import {
  buildStonfiTonToJettonTxParamsV21,
  cellBocBase64,
  createBuybackRouteNotifyPayload,
  deterministicAddress,
  PLATHO_BUYBACK_STONFI_M19B,
  STONFI_SDK_SOURCE,
  StonfiRouteFreezeCandidateV21,
  validateStonfiRouteFreezeCandidateV21,
} from '../scripts/stonfi_v2_1_route_lib';

const codeHashes = {
  athMasterCodeHash: '143c2255d9bf3ae853947e45560afeb6ad0a0648361ed2350c714c3e9d6d2328',
  athWalletCodeHash: '7b4b51d5044ddd869d277dd037fd738a4f38696dc47c0960808e6891ca61a7d5',
  stonfiRouterCodeHash: '1'.repeat(64),
  stonfiPoolCodeHash: '2'.repeat(64),
  stonfiPtonCodeHash: '3'.repeat(64),
  stonfiVaultCodeHash: null,
};

function makeCandidate(overrides: Partial<StonfiRouteFreezeCandidateV21> = {}): StonfiRouteFreezeCandidateV21 {
  const addresses = {
    athMasterAddress: deterministicAddress('M19C.test.ath.master'),
    buybackBurnAddress: deterministicAddress('M19C.test.buybackburn'),
    buybackBurnOfficialAthWalletAddress: deterministicAddress('M19C.test.buybackburn.official.ath.wallet'),
    stonfiRouterAddress: deterministicAddress('M19C.test.stonfi.router'),
    stonfiPoolAddressTonAth: deterministicAddress('M19C.test.stonfi.pool'),
    stonfiAthSourceOwnerAddress: deterministicAddress('M19C.test.stonfi.ath.source.owner'),
    stonfiAthSourceWalletAddress: deterministicAddress('M19C.test.router.ath.wallet'),
    stonfiPtonWalletAddress: deterministicAddress('M19C.test.pton.wallet'),
    askJettonWalletAddress: deterministicAddress('M19C.test.router.ath.wallet'),
  };
  const swap = {
    queryId: 0x504c4154484f19c1n,
    deadline: 1_800_400_000n,
    offerAmountNanotons: PLATHO_BUYBACK_STONFI_M19B.BUYBACK_OFFER_AMOUNT,
    conservativeTotalSendValueNanotons: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_TOTAL_STONFI_SEND_VALUE,
    routeForwardGasNanotons: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_ROUTE_FORWARD_GAS,
    ptonTransferGasNanotons: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_PTON_TRANSFER_GAS,
    quoteOutAtomicAth: 1_000_000_000_000_000n,
    dexMinOutAtomicAth: 950_000_000_000_000n,
    buybackMinAthOutPer50TonAtomic: 900_000_000_000_000n,
  };
  const tx = buildStonfiTonToJettonTxParamsV21({
    queryId: swap.queryId,
    offerAmount: swap.offerAmountNanotons,
    minAskAmount: swap.dexMinOutAtomicAth,
    routerAddress: addresses.stonfiRouterAddress,
    ptonWalletAddress: addresses.stonfiPtonWalletAddress,
    askJettonWalletAddress: addresses.askJettonWalletAddress,
    receiverAddress: addresses.buybackBurnOfficialAthWalletAddress,
    refundAddress: addresses.buybackBurnAddress,
    excessesAddress: addresses.buybackBurnAddress,
    deadline: swap.deadline,
    forwardGasAmount: swap.routeForwardGasNanotons,
    dexCustomPayloadForwardGasAmount: PLATHO_BUYBACK_STONFI_M19B.ROUTE_ATH_NOTIFY_FORWARD_GAS,
    dexCustomPayload: createBuybackRouteNotifyPayload(swap.queryId),
    ptonTonTransferGas: swap.ptonTransferGasNanotons,
  });

  const candidate: StonfiRouteFreezeCandidateV21 = {
    candidateLabel: 'M19C_TEST_FINAL_ROUTE_CANDIDATE',
    status: 'FINAL_ROUTE_FREEZE_CANDIDATE',
    officialSource: STONFI_SDK_SOURCE,
    addresses,
    codeHashes,
    swap,
    sdkSample: {
      ptonTransferBodyBocBase64: cellBocBase64(tx.body),
      stonfiSwapForwardPayloadBocBase64: cellBocBase64(tx.forwardPayload),
    },
    liveProofs: {
      sdkOrApiTxParamsCaptured: true,
      liveQuoteCaptured: true,
      successExcessesAddressObservedAsBuybackBurn: true,
      minOutFailureRefundObservedAsBuybackBurn: true,
      ptonRefundObservedAsBuybackBurn: true,
      bounceOrFailureBehaviorDocumented: true,
    },
  };

  return {
    ...candidate,
    ...overrides,
    addresses: { ...candidate.addresses, ...(overrides.addresses ?? {}) },
    codeHashes: { ...candidate.codeHashes, ...(overrides.codeHashes ?? {}) },
    swap: { ...candidate.swap, ...(overrides.swap ?? {}) },
    sdkSample: { ...candidate.sdkSample, ...(overrides.sdkSample ?? {}) },
    liveProofs: { ...candidate.liveProofs, ...(overrides.liveProofs ?? {}) },
  };
}

describe('M19C STON.fi route freeze gate / live sample harness', () => {
  it('accepts a mechanically complete final route candidate only when SDK sample, quote, min_out, and live proofs all match', () => {
    const report = validateStonfiRouteFreezeCandidateV21(makeCandidate());

    expect(report.freezeReady).toBe(true);
    expect(report.issues).toEqual([]);
    expect(report.decoded?.ptonTransfer.tonAmount).toBe(PLATHO_BUYBACK_STONFI_M19B.BUYBACK_OFFER_AMOUNT.toString());
    expect(report.decoded?.stonfiSwapPayload.details.minAskAmount).toBe('950000000000000');
    expect(report.decoded?.stonfiSwapPayload.details.dexCustomPayloadForwardGasAmount).toBe(PLATHO_BUYBACK_STONFI_M19B.ROUTE_ATH_NOTIFY_FORWARD_GAS.toString());
    expect(report.decoded?.stonfiSwapPayload.details.hasDexCustomPayload).toBe(true);
    expect(report.rebuiltHashes?.ptonTransferBodyHash).toBe(report.rebuiltHashes?.samplePtonTransferBodyHash);
    expect(report.rebuiltHashes?.stonfiSwapForwardPayloadHash).toBe(report.rebuiltHashes?.sampleStonfiSwapForwardPayloadHash);
  });

  it('rejects a draft candidate even if payload mechanics match, because live route proof is mandatory', () => {
    const report = validateStonfiRouteFreezeCandidateV21(makeCandidate({
      status: 'DRAFT_NOT_FINAL_ROUTE_FREEZE',
      liveProofs: {
        sdkOrApiTxParamsCaptured: false,
        liveQuoteCaptured: false,
        successExcessesAddressObservedAsBuybackBurn: false,
        minOutFailureRefundObservedAsBuybackBurn: false,
        ptonRefundObservedAsBuybackBurn: false,
        bounceOrFailureBehaviorDocumented: false,
      },
    }));

    expect(report.freezeReady).toBe(false);
    const codes = report.issues.map((issue) => issue.code);
    expect(codes).toContain('STATUS_NOT_FINAL_ROUTE_FREEZE_CANDIDATE');
    expect(codes).toContain('MISSING_LIVEQUOTECAPTURED');
    expect(codes).toContain('MISSING_SUCCESSEXCESSESADDRESSOBSERVEDASBUYBACKBURN');
    expect(codes).toContain('MISSING_MINOUTFAILUREREFUNDOBSERVEDASBUYBACKBURN');
    expect(codes).toContain('MISSING_PTONREFUNDOBSERVEDASBUYBACKBURN');
  });

  it('rejects a candidate whose dex_min_out is not the exact min_ask_amount inside the SDK/API sample', () => {
    const base = makeCandidate();
    const tampered = makeCandidate({
      swap: {
        ...base.swap,
        dexMinOutAtomicAth: 960_000_000_000_000n,
      },
      sdkSample: base.sdkSample,
    });
    const report = validateStonfiRouteFreezeCandidateV21(tampered);

    expect(report.freezeReady).toBe(false);
    const codes = report.issues.map((issue) => issue.code);
    expect(codes).toContain('SAMPLE_MIN_OUT_MISMATCH');
    expect(codes).toContain('REBUILT_PTON_BODY_HASH_MISMATCH');
    expect(codes).toContain('REBUILT_SWAP_PAYLOAD_HASH_MISMATCH');
  });

  it('rejects a candidate whose pinned ask wallet is not the derived source ATH wallet', () => {
    const report = validateStonfiRouteFreezeCandidateV21(makeCandidate({
      addresses: {
        stonfiAthSourceWalletAddress: deterministicAddress('M19C.test.wrong.source.wallet'),
      },
    }));

    expect(report.freezeReady).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toContain('ASK_JETTON_WALLET_NOT_SOURCE_ATH_WALLET');
  });

  it('rejects parseable masterchain route endpoint addresses', () => {
    const report = validateStonfiRouteFreezeCandidateV21(makeCandidate({
      addresses: {
        stonfiRouterAddress: deterministicAddress('M19C.test.masterchain.router', -1),
        stonfiPoolAddressTonAth: deterministicAddress('M19C.test.masterchain.pool', -1),
        stonfiPtonWalletAddress: deterministicAddress('M19C.test.masterchain.pton', -1),
      },
    }));

    const codes = report.issues.map((issue) => issue.code);
    expect(report.freezeReady).toBe(false);
    expect(codes).toContain('ROUTE_ADDRESS_NOT_BASECHAIN_STONFI_ROUTER');
    expect(codes).toContain('ROUTE_ADDRESS_NOT_BASECHAIN_STONFI_POOL');
    expect(codes).toContain('ROUTE_ADDRESS_NOT_BASECHAIN_PTON_WALLET');
  });

  it('rejects a candidate below 95% live quote even when it is above the static circuit breaker', () => {
    const report = validateStonfiRouteFreezeCandidateV21(makeCandidate({
      swap: {
        quoteOutAtomicAth: 1_000_000_000_000_000n,
        dexMinOutAtomicAth: 949_999_999_999_999n,
        buybackMinAthOutPer50TonAtomic: 900_000_000_000_000n,
      },
    }));

    expect(report.freezeReady).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toContain('DEX_MIN_OUT_BELOW_95_PERCENT_QUOTE');
  });
});
