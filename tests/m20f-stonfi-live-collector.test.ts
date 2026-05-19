import { describe, expect, it } from 'vitest';
import { Address } from '@ton/core';
import {
  collectM20FStonfiLiveEvidence,
  createM20FStonfiLiveCollectorInputTemplate,
  M20FSimulationResult,
  M20FStonfiLiveCollectorInput,
} from '../scripts/m20f_stonfi_live_collector';
import {
  addressRaw,
  buildStonfiTonToJettonTxParamsV21,
  cellBocBase64,
  deterministicAddress,
  PLATHO_BUYBACK_STONFI_M19B,
} from '../scripts/stonfi_v2_1_route_lib';

const HEX64 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function addr(label: string, testOnly = false) {
  return deterministicAddress(`M20F.LIVE.${label}`).toString({ testOnly });
}

function completeInput(overrides: Partial<M20FStonfiLiveCollectorInput> = {}): M20FStonfiLiveCollectorInput {
  const athMaster = addr('athMaster');
  const base: M20FStonfiLiveCollectorInput = {
    document: 'PLATHO.V1.M20F_STONFI_LIVE_COLLECTOR_INPUT',
    network: 'mainnet',
    status: 'FINAL_ROUTE_FREEZE_CANDIDATE',
    tonRpcEndpoint: null,
    addresses: {
      athMasterAddress: athMaster,
      buybackBurnAddress: addr('buybackBurn'),
      buybackBurnOfficialAthWalletAddress: addr('buybackOfficialAthWallet'),
    },
    route: {
      offerAddress: 'ton',
      askAddress: athMaster,
      offerUnits: PLATHO_BUYBACK_STONFI_M19B.BUYBACK_OFFER_AMOUNT.toString(),
      slippageTolerance: '0.01',
      dexV2: true,
      dexVersion: [2],
      poolAddress: null,
      expectedRouterMajorVersion: 2,
      expectedRouterMinorVersion: 1,
    },
    routeControls: {
      queryId: '123456',
      deadline: '1893456000',
      buybackMinAthOutPer50TonAtomic: '95000000000',
      referralAddress: null,
      referralValue: '10',
    },
    codeHashes: {
      athMasterCodeHash: HEX64,
      athWalletCodeHash: HEX64,
      stonfiRouterCodeHash: HEX64,
      stonfiPoolCodeHash: HEX64,
      stonfiPtonCodeHash: HEX64,
      stonfiVaultCodeHash: null,
    },
    proofRefs: {
      athDeploymentManifest: 'sha256:ath-deployment-mainnet',
      buybackBurnStateInitVector: 'sha256:buyback-stateinit-mainnet',
      officialAthWalletDerivationVector: 'sha256:official-ath-wallet-mainnet',
      stonfiApiSimulationCapture: 'sha256:stonfi-api-simulation-mainnet',
      stonfiSdkOrApiTxParamsCapture: 'sha256:stonfi-sdk-txparams-mainnet',
      routerPoolPtonCodeHashes: 'sha256:router-pool-pton-codehashes-mainnet',
      successExcessProof: 'tx:success-excess-mainnet',
      minOutFailureRefundProof: 'tx:minout-refund-mainnet',
      ptonRefundProof: 'tx:pton-refund-mainnet',
      bounceOrFailureBehaviorProof: 'tx:bounce-failure-mainnet',
    },
    liveProofs: {
      sdkOrApiTxParamsCaptured: true,
      liveQuoteCaptured: true,
      successExcessesAddressObservedAsBuybackBurn: true,
      minOutFailureRefundObservedAsBuybackBurn: true,
      ptonRefundObservedAsBuybackBurn: true,
      bounceOrFailureBehaviorDocumented: true,
      evidenceRefs: {},
    },
  };

  return {
    ...base,
    ...overrides,
    addresses: { ...base.addresses, ...(overrides.addresses ?? {}) },
    route: { ...base.route, ...(overrides.route ?? {}) },
    routeControls: { ...base.routeControls, ...(overrides.routeControls ?? {}) },
    codeHashes: { ...base.codeHashes, ...(overrides.codeHashes ?? {}) },
    proofRefs: { ...base.proofRefs, ...(overrides.proofRefs ?? {}) },
    liveProofs: { ...base.liveProofs, ...(overrides.liveProofs ?? {}) },
  };
}

function simulationFor(input: M20FStonfiLiveCollectorInput): M20FSimulationResult {
  return {
    askAddress: input.addresses.athMasterAddress,
    askJettonWallet: addr('askJettonWallet'),
    askUnits: '100000000000',
    minAskUnits: '99000000000',
    offerAddress: 'ton',
    offerUnits: input.route.offerUnits,
    poolAddress: addr('poolTonAth'),
    routerAddress: addr('router'),
    router: {
      address: addr('router'),
      majorVersion: 2,
      minorVersion: 1,
      ptonMasterAddress: addr('ptonMaster'),
      ptonVersion: 'v2_1',
      ptonWalletAddress: addr('ptonWallet'),
      routerType: 'constant_product',
    },
    slippageTolerance: input.route.slippageTolerance,
    recommendedMinAskUnits: '99000000000',
    gasParams: {
      forwardGas: '1000000000',
      estimatedGasConsumption: '50000000',
    },
  };
}

async function txParamsFor(input: M20FStonfiLiveCollectorInput, simulation: M20FSimulationResult) {
  const txParams = buildStonfiTonToJettonTxParamsV21({
    queryId: input.routeControls.queryId,
    offerAmount: simulation.offerUnits,
    minAskAmount: simulation.minAskUnits,
    routerAddress: simulation.router.address,
    ptonWalletAddress: simulation.router.ptonWalletAddress,
    askJettonWalletAddress: simulation.askJettonWallet,
    receiverAddress: input.addresses.buybackBurnOfficialAthWalletAddress,
    refundAddress: input.addresses.buybackBurnAddress,
    excessesAddress: input.addresses.buybackBurnAddress,
    deadline: input.routeControls.deadline,
    forwardGasAmount: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_ROUTE_FORWARD_GAS,
    ptonTonTransferGas: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_PTON_TRANSFER_GAS,
  });

  return {
    to: txParams.to.toString(),
    valueNanotons: txParams.value.toString(),
    bodyBocBase64: cellBocBase64(txParams.body),
  };
}

describe('M20F STON.fi live collector', () => {
  it('writes a waiting report when no final mainnet input is supplied', async () => {
    const report = await collectM20FStonfiLiveEvidence(null, { capturedAt: () => 'TEST_TIME' });

    expect(report.status).toBe('WAITING_FOR_FINAL_MAINNET_INPUT');
    expect(report.route_freeze_ready).toBe(false);
    expect(report.production_buyback_burn_unlocked).toBe(false);
    expect(report.issue_codes).toEqual(['MISSING_INPUT']);
  });

  it('template is intentionally non-final and cannot trigger a live STON.fi call', async () => {
    let called = false;
    const template = createM20FStonfiLiveCollectorInputTemplate();
    const report = await collectM20FStonfiLiveEvidence(template, {
      capturedAt: () => 'TEST_TIME',
      simulateSwap: async () => {
        called = true;
        throw new Error('must not be called');
      },
    });

    expect(called).toBe(false);
    expect(report.status).toBe('BLOCKED_INPUT_NOT_READY');
    expect(report.issue_codes).toContain('STATUS_NOT_FINAL_ROUTE_FREEZE_CANDIDATE');
    expect(report.issue_codes).toContain('BAD_ADDRESS_ATHMASTERADDRESS');
  });

  it('rejects testnet-friendly addresses before simulation or SDK tx generation', async () => {
    let called = false;
    const input = completeInput({
      addresses: { buybackBurnAddress: addr('testnetBuyback', true) } as any,
    });
    const report = await collectM20FStonfiLiveEvidence(input, {
      capturedAt: () => 'TEST_TIME',
      simulateSwap: async () => {
        called = true;
        return simulationFor(input);
      },
    });

    expect(called).toBe(false);
    expect(report.status).toBe('BLOCKED_INPUT_NOT_READY');
    expect(report.issue_codes).toContain('NON_PROD_ADDRESS_BUYBACKBURNADDRESS');
  });

  it('builds M19E input from STON.fi simulation and official tx params while preserving BuybackBurn refund/excess receivers', async () => {
    const input = completeInput();
    const report = await collectM20FStonfiLiveEvidence(input, {
      capturedAt: () => 'TEST_TIME',
      simulateSwap: async () => simulationFor(input),
      generateTxParams: txParamsFor,
    });

    const buybackRaw = addressRaw(Address.parse(input.addresses.buybackBurnAddress));
    const officialWalletRaw = addressRaw(Address.parse(input.addresses.buybackBurnOfficialAthWalletAddress));

    expect(report.status).toBe('M20F_LIVE_EVIDENCE_ROUTE_FREEZE_READY');
    expect(report.route_freeze_ready).toBe(true);
    expect(report.production_buyback_burn_unlocked).toBe(false);
    expect(report.sdkTxParams?.valueNanotons).toBe(PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_TOTAL_STONFI_SEND_VALUE.toString());
    expect(report.decoded?.ptonTransfer.refundAddress).toBe(buybackRaw);
    expect(report.decoded?.stonfiSwapPayload?.refundAddress).toBe(buybackRaw);
    expect(report.decoded?.stonfiSwapPayload?.excessesAddress).toBe(buybackRaw);
    expect(report.decoded?.stonfiSwapPayload?.details.receiverAddress).toBe(officialWalletRaw);
    expect(report.m19eReport?.route_freeze_ready).toBe(true);
  });

  it('blocks an API-selected router that is not the currently pinned v2.1 route', async () => {
    const input = completeInput();
    const report = await collectM20FStonfiLiveEvidence(input, {
      capturedAt: () => 'TEST_TIME',
      simulateSwap: async () => ({
        ...simulationFor(input),
        router: { ...simulationFor(input).router, minorVersion: 2 },
      }),
      generateTxParams: txParamsFor,
    });

    expect(report.route_freeze_ready).toBe(false);
    expect(report.issue_codes).toContain('SIM_ROUTER_VERSION_NOT_V2_1');
    expect(report.sdkTxParams).toBe(null);
  });
});
