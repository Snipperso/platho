import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Address } from '@ton/core';
import {
  addressRaw,
  cellBocBase64,
  cellFromBocBase64,
  createBuybackRouteNotifyPayload,
  decodePtonTonTransferBodyV21,
  decodeStonfiSwapBodyV21,
  normalizeDecodedPtonForJson,
  normalizeDecodedSwapForJson,
  PLATHO_BUYBACK_STONFI_M19B,
  STONFI_SDK_SOURCE,
} from './stonfi_v2_1_route_lib';
import {
  StonfiLiveEvidenceInputM19E,
  collectLiveEvidenceM19E,
} from './stonfi_live_evidence_collector_m19e';
import { M20F_OFFICIAL_SOURCES, M20F_SAFE_VALUE_BOUNDS, isBasechainTonAddress, isTestnetFriendlyAddress } from './m20f_mainnet_route_freeze_preflight';

const ARTIFACTS_DIR = join(process.cwd(), 'artifacts');
const EXPECTED_ROUTER_MAJOR_VERSION = 2;
const EXPECTED_ROUTER_MINOR_VERSION = 1;
const DEFAULT_SLIPPAGE_TOLERANCE = '0.01';
const DEFAULT_REFERRAL_VALUE = '10';

function jsonReplacer(_key: string, value: unknown) {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

function readJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function shaRef(label: string) {
  return `required: immutable ${label} path/hash`;
}

function isPlaceholder(value: unknown): boolean {
  if (typeof value !== 'string') return true;
  const v = value.trim();
  return v.length === 0
    || v.includes('REQUIRED_')
    || v.includes('required:')
    || v.includes('EQ...')
    || v.includes('<')
    || v.includes('FILL_');
}

function isDecimalString(value: unknown): boolean {
  return typeof value === 'string' && /^[0-9]+$/.test(value);
}

function isHex64(value: unknown): boolean {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

function isParseableAddress(value: unknown): boolean {
  if (typeof value !== 'string' || isPlaceholder(value)) return false;
  try {
    Address.parse(value);
    return true;
  } catch {
    return false;
  }
}

function hasNonProdMarker(value: string): boolean {
  return /\b(testnet|fixture|preview|mock|template|placeholder)\b/i.test(value);
}

function issue(code: string, message: string) {
  return { code, message };
}

export interface M20FStonfiLiveCollectorInput {
  document: 'PLATHO.V1.M20F_STONFI_LIVE_COLLECTOR_INPUT';
  network: 'mainnet';
  status: 'DRAFT_MAINNET_ROUTE_FREEZE_INPUT' | 'FINAL_ROUTE_FREEZE_CANDIDATE';
  tonRpcEndpoint?: string | null;
  addresses: {
    athMasterAddress: string;
    buybackBurnAddress: string;
    buybackBurnOfficialAthWalletAddress: string;
    stonfiAthSourceOwnerAddress: string;
    stonfiAthSourceWalletAddress: string;
  };
  route: {
    offerAddress: 'ton';
    askAddress: string;
    offerUnits: string;
    slippageTolerance: string;
    dexV2: true;
    dexVersion: [2];
    poolAddress?: string | null;
    expectedRouterMajorVersion: 2;
    expectedRouterMinorVersion: 1;
  };
  routeControls: {
    queryId: string;
    deadline: string;
    buybackMinAthOutPer50TonAtomic: string;
    buybackRouteAthNotifyValueUpstreamNanotons: string;
    referralAddress?: string | null;
    referralValue?: string;
  };
  codeHashes: StonfiLiveEvidenceInputM19E['codeHashes'];
  proofRefs: {
    athDeploymentManifest: string;
    buybackBurnStateInitVector: string;
    officialAthWalletDerivationVector: string;
    stonfiAthSourceWalletDerivationVector: string;
    stonfiApiSimulationCapture: string;
    stonfiSdkOrApiTxParamsCapture: string;
    routerPoolPtonCodeHashes: string;
    athNotificationQueryIdPropagationProof: string;
    refundExcessBodyShapeProof: string;
    successExcessProof: string;
    minOutFailureRefundProof: string;
    ptonRefundProof: string;
    bounceOrFailureBehaviorProof: string;
  };
  liveProofs: StonfiLiveEvidenceInputM19E['liveProofs'];
}

export interface M20FSimulationResult {
  askAddress: string;
  askJettonWallet: string;
  askUnits: string;
  minAskUnits: string;
  offerAddress: string;
  offerUnits: string;
  poolAddress: string;
  routerAddress: string;
  router: {
    address: string;
    majorVersion: number;
    minorVersion: number;
    ptonMasterAddress: string;
    ptonVersion: string;
    ptonWalletAddress: string;
    routerType: string;
  };
  slippageTolerance: string;
  recommendedMinAskUnits?: string;
  gasParams?: {
    forwardGas?: string;
    gasBudget?: string;
    estimatedGasConsumption?: string;
  };
}

export interface M20FTxParams {
  to: string;
  valueNanotons: string;
  bodyBocBase64: string;
}

export interface M20FCollectorDeps {
  simulateSwap?: (input: M20FStonfiLiveCollectorInput) => Promise<M20FSimulationResult>;
  generateTxParams?: (input: M20FStonfiLiveCollectorInput, simulation: M20FSimulationResult) => Promise<M20FTxParams>;
  capturedAt?: () => string;
}

export interface M20FStonfiLiveCollectorReport {
  document: 'PLATHO.V1.M20F_STONFI_LIVE_COLLECTOR_REPORT';
  status:
    | 'WAITING_FOR_FINAL_MAINNET_INPUT'
    | 'BLOCKED_INPUT_NOT_READY'
    | 'BLOCKED_STONFI_LIVE_COLLECT_FAILED'
    | 'COLLECTED_STONFI_SIMULATION_AND_TX_PARAMS'
    | 'M20F_LIVE_EVIDENCE_ROUTE_FREEZE_READY';
  generated_at: string;
  route_freeze_ready: boolean;
  production_buyback_burn_unlocked: false;
  official_sources: typeof M20F_OFFICIAL_SOURCES;
  inputSource: string | null;
  issue_codes: string[];
  issues: { code: string; message: string }[];
  simulation: M20FSimulationResult | null;
  sdkTxParams: M20FTxParams | null;
  decoded: {
    sdkTxToRaw: string | null;
    ptonTransfer: ReturnType<typeof normalizeDecodedPtonForJson>;
    stonfiSwapPayload: ReturnType<typeof normalizeDecodedSwapForJson> | null;
  } | null;
  m19eInput: StonfiLiveEvidenceInputM19E | null;
  m19eReport: ReturnType<typeof collectLiveEvidenceM19E> | null;
  outputs: Record<string, string | null>;
}

export function createM20FStonfiLiveCollectorInputTemplate(): M20FStonfiLiveCollectorInput {
  return {
    document: 'PLATHO.V1.M20F_STONFI_LIVE_COLLECTOR_INPUT',
    network: 'mainnet',
    status: 'DRAFT_MAINNET_ROUTE_FREEZE_INPUT',
    tonRpcEndpoint: null,
    addresses: {
      athMasterAddress: 'REQUIRED_MAINNET_ATH_MASTER_ADDRESS',
      buybackBurnAddress: 'REQUIRED_MAINNET_BUYBACKBURN_STATEINIT_ADDRESS',
      buybackBurnOfficialAthWalletAddress: 'REQUIRED_MAINNET_BUYBACKBURN_OFFICIAL_ATH_WALLET_ADDRESS',
      stonfiAthSourceOwnerAddress: 'REQUIRED_ATH_OUTPUT_SOURCE_OWNER_FOR_ASK_JETTON_WALLET',
      stonfiAthSourceWalletAddress: 'REQUIRED_DERIVED_ATH_OUTPUT_SOURCE_WALLET_ADDRESS',
    },
    route: {
      offerAddress: 'ton',
      askAddress: 'REQUIRED_MAINNET_ATH_MASTER_ADDRESS',
      offerUnits: PLATHO_BUYBACK_STONFI_M19B.BUYBACK_OFFER_AMOUNT.toString(),
      slippageTolerance: DEFAULT_SLIPPAGE_TOLERANCE,
      dexV2: true,
      dexVersion: [2],
      poolAddress: null,
      expectedRouterMajorVersion: EXPECTED_ROUTER_MAJOR_VERSION,
      expectedRouterMinorVersion: EXPECTED_ROUTER_MINOR_VERSION,
    },
    routeControls: {
      queryId: 'required: uint64 decimal query id',
      deadline: 'required: uint64 decimal unix timestamp',
      buybackMinAthOutPer50TonAtomic: 'required: positive atomic ATH minimum',
      buybackRouteAthNotifyValueUpstreamNanotons: 'required: decimal nanotons, production-safe value >= 40000000',
      referralAddress: null,
      referralValue: DEFAULT_REFERRAL_VALUE,
    },
    codeHashes: {
      athMasterCodeHash: 'required: 64 lowercase hex chars',
      athWalletCodeHash: 'required: 64 lowercase hex chars',
      stonfiRouterCodeHash: 'required: 64 lowercase hex chars',
      stonfiPoolCodeHash: 'required: 64 lowercase hex chars',
      stonfiPtonCodeHash: 'required: 64 lowercase hex chars',
      stonfiVaultCodeHash: null,
    },
    proofRefs: {
      athDeploymentManifest: shaRef('ATH deployment manifest'),
      buybackBurnStateInitVector: shaRef('BuybackBurn StateInit vector'),
      officialAthWalletDerivationVector: shaRef('official BuybackBurn ATH wallet derivation vector'),
      stonfiAthSourceWalletDerivationVector: shaRef('STON.fi ATH source owner wallet derivation vector'),
      stonfiApiSimulationCapture: shaRef('STON.fi API simulation capture'),
      stonfiSdkOrApiTxParamsCapture: shaRef('official STON.fi SDK/API tx params capture'),
      routerPoolPtonCodeHashes: shaRef('router/pool/pTON code hash proof'),
      athNotificationQueryIdPropagationProof: shaRef('ATH notification query_id propagation and BuybackBurn burn finalization proof'),
      refundExcessBodyShapeProof: shaRef('refund/excess/failure body shape proof matching BuybackBurn handlers'),
      successExcessProof: shaRef('success excess proof returning to BuybackBurn'),
      minOutFailureRefundProof: shaRef('min_out failure refund proof returning to BuybackBurn'),
      ptonRefundProof: shaRef('pTON refund proof returning to BuybackBurn'),
      bounceOrFailureBehaviorProof: shaRef('bounce/failure behavior proof'),
    },
    liveProofs: {
      sdkOrApiTxParamsCaptured: false,
      liveQuoteCaptured: false,
      successExcessesAddressObservedAsBuybackBurn: false,
      minOutFailureRefundObservedAsBuybackBurn: false,
      ptonRefundObservedAsBuybackBurn: false,
      bounceOrFailureBehaviorDocumented: false,
      evidenceRefs: {
        sdkTxParams: shaRef('official tx params'),
        liveQuote: shaRef('live STON.fi simulation'),
        successExcess: shaRef('success excess proof'),
        minOutFailureRefund: shaRef('min_out refund proof'),
        ptonRefund: shaRef('pTON refund proof'),
        bounceOrFailureBehavior: shaRef('bounce/failure behavior proof'),
      },
    },
  };
}

export function validateM20FStonfiLiveCollectorInput(input: M20FStonfiLiveCollectorInput | null) {
  const issues: { code: string; message: string }[] = [];
  if (!input) {
    issues.push(issue('MISSING_INPUT', 'Supply artifacts/m20f_stonfi_live_collector_input_template.json filled with final mainnet values.'));
    return { ok: false, issues, issue_codes: issues.map((i) => i.code) };
  }

  if (input.document !== 'PLATHO.V1.M20F_STONFI_LIVE_COLLECTOR_INPUT') {
    issues.push(issue('BAD_DOCUMENT_TYPE', 'Input document must be PLATHO.V1.M20F_STONFI_LIVE_COLLECTOR_INPUT.'));
  }
  if (input.network !== 'mainnet') {
    issues.push(issue('NETWORK_NOT_MAINNET', 'M20F collector only accepts mainnet input.'));
  }
  if (input.status !== 'FINAL_ROUTE_FREEZE_CANDIDATE') {
    issues.push(issue('STATUS_NOT_FINAL_ROUTE_FREEZE_CANDIDATE', 'Live collector input must be explicitly final before network collection.'));
  }

  for (const [key, value] of Object.entries(input.addresses ?? {})) {
    if (!isParseableAddress(value)) {
      issues.push(issue(`BAD_ADDRESS_${key.toUpperCase()}`, `${key} must be a real parseable TON mainnet address.`));
      continue;
    }
    if (isTestnetFriendlyAddress(value) || hasNonProdMarker(value)) {
      issues.push(issue(`NON_PROD_ADDRESS_${key.toUpperCase()}`, `${key} must not be a testnet/fixture/preview address.`));
    }
    if (!isBasechainTonAddress(value)) {
      issues.push(issue(`NON_BASECHAIN_ADDRESS_${key.toUpperCase()}`, `${key} must be a basechain workchain 0 address.`));
    }
  }

  if (input.route.offerAddress !== 'ton') {
    issues.push(issue('BAD_OFFER_ADDRESS', 'M20F buyback route must offer TON.'));
  }
  if (input.route.askAddress !== input.addresses.athMasterAddress) {
    issues.push(issue('ASK_ADDRESS_NOT_ATH_MASTER', 'route.askAddress must equal addresses.athMasterAddress.'));
  }
  if (input.route.offerUnits !== PLATHO_BUYBACK_STONFI_M19B.BUYBACK_OFFER_AMOUNT.toString()) {
    issues.push(issue('BAD_OFFER_UNITS', 'M20F buyback simulation must offer exactly 50 TON in nanotons.'));
  }
  if (input.route.dexV2 !== true || input.route.dexVersion?.[0] !== 2) {
    issues.push(issue('BAD_DEX_VERSION_FILTER', 'M20F collector must restrict simulation to STON.fi DEX v2.'));
  }
  if (input.route.expectedRouterMajorVersion !== EXPECTED_ROUTER_MAJOR_VERSION || input.route.expectedRouterMinorVersion !== EXPECTED_ROUTER_MINOR_VERSION) {
    issues.push(issue('BAD_EXPECTED_ROUTER_VERSION', 'Current Platho decoder is pinned to STON.fi router v2.1.'));
  }

  if (!isDecimalString(input.routeControls.queryId)) issues.push(issue('BAD_QUERY_ID', 'routeControls.queryId must be a uint64 decimal string.'));
  if (!isDecimalString(input.routeControls.deadline)) issues.push(issue('BAD_DEADLINE', 'routeControls.deadline must be a uint64 decimal string.'));
  if (!isDecimalString(input.routeControls.buybackMinAthOutPer50TonAtomic) || BigInt(input.routeControls.buybackMinAthOutPer50TonAtomic || '0') <= 0n) {
    issues.push(issue('BAD_BUYBACK_MIN_OUT', 'buybackMinAthOutPer50TonAtomic must be a positive decimal string.'));
  }
  if (
    !isDecimalString(input.routeControls.buybackRouteAthNotifyValueUpstreamNanotons)
    || BigInt(input.routeControls.buybackRouteAthNotifyValueUpstreamNanotons || '0') < BigInt(M20F_SAFE_VALUE_BOUNDS.buybackRouteAthNotifyValueUpstreamMinNanotons)
  ) {
    issues.push(issue('BAD_BUYBACK_ROUTE_ATH_NOTIFY_VALUE', 'buybackRouteAthNotifyValueUpstreamNanotons must be at least 40,000,000 nanotons.'));
  }

  for (const [key, value] of Object.entries(input.codeHashes ?? {})) {
    if (key === 'stonfiVaultCodeHash' && (value === null || value === undefined)) continue;
    if (!isHex64(value)) issues.push(issue(`BAD_CODE_HASH_${key.toUpperCase()}`, `${key} must be a 32-byte lowercase hex hash.`));
  }

  for (const [key, value] of Object.entries(input.proofRefs ?? {})) {
    if (isPlaceholder(value)) issues.push(issue(`MISSING_PROOF_REF_${key.toUpperCase()}`, `${key} must point to an immutable evidence artifact or tx hash.`));
    if (typeof value === 'string' && hasNonProdMarker(value)) issues.push(issue(`NON_PROD_PROOF_REF_${key.toUpperCase()}`, `${key} must not point to testnet/fixture/preview evidence.`));
  }

  return { ok: issues.length === 0, issues, issue_codes: issues.map((i) => i.code) };
}

function normalizeTxParams(txParams: any): M20FTxParams {
  return {
    to: txParams.to?.toString ? txParams.to.toString() : String(txParams.to),
    valueNanotons: txParams.value?.toString ? txParams.value.toString() : String(txParams.value),
    bodyBocBase64: cellBocBase64(txParams.body),
  };
}

export async function defaultSimulateSwap(input: M20FStonfiLiveCollectorInput): Promise<M20FSimulationResult> {
  const { StonApiClient } = await import('@ston-fi/api');
  const client = new StonApiClient();
  return await client.simulateSwap({
    offerAddress: input.route.offerAddress,
    askAddress: input.route.askAddress,
    offerUnits: input.route.offerUnits,
    slippageTolerance: input.route.slippageTolerance,
    dexV2: input.route.dexV2,
    dexVersion: input.route.dexVersion,
    poolAddress: input.route.poolAddress ?? undefined,
  }) as M20FSimulationResult;
}

export async function defaultGenerateTxParams(
  input: M20FStonfiLiveCollectorInput,
  simulation: M20FSimulationResult,
): Promise<M20FTxParams> {
  const { Client, dexFactory } = await import('@ston-fi/sdk');
  const dexContracts = dexFactory(simulation.router);
  const tonClient = new Client({
    endpoint: input.tonRpcEndpoint || 'https://toncenter.com/api/v2/jsonRPC',
  });
  const router = tonClient.open(dexContracts.Router.create(simulation.router.address));
  const proxyTon = new dexContracts.pTON(simulation.router.ptonMasterAddress, {
    gasConstants: {
      tonTransfer: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_PTON_TRANSFER_GAS,
    },
  });

  const txParams = await router.getSwapTonToJettonTxParams({
    userWalletAddress: input.addresses.buybackBurnAddress,
    receiverAddress: input.addresses.buybackBurnOfficialAthWalletAddress,
    proxyTon,
    offerJettonWalletAddress: simulation.router.ptonWalletAddress,
    askJettonAddress: simulation.askAddress,
    askJettonWalletAddress: simulation.askJettonWallet,
    offerAmount: simulation.offerUnits,
    minAskAmount: simulation.minAskUnits,
    refundAddress: input.addresses.buybackBurnAddress,
    excessesAddress: input.addresses.buybackBurnAddress,
    referralAddress: input.routeControls.referralAddress ?? undefined,
    referralValue: input.routeControls.referralValue ?? DEFAULT_REFERRAL_VALUE,
    deadline: Number(input.routeControls.deadline),
    forwardGasAmount: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_ROUTE_FORWARD_GAS,
    dexCustomPayloadForwardGasAmount: PLATHO_BUYBACK_STONFI_M19B.ROUTE_ATH_NOTIFY_FORWARD_GAS,
    dexCustomPayload: createBuybackRouteNotifyPayload(input.routeControls.queryId),
    queryId: BigInt(input.routeControls.queryId),
  });

  return normalizeTxParams(txParams);
}

function simulationIssues(input: M20FStonfiLiveCollectorInput, simulation: M20FSimulationResult) {
  const issues: { code: string; message: string }[] = [];
  if (simulation.offerAddress !== input.route.offerAddress) issues.push(issue('SIM_OFFER_ADDRESS_MISMATCH', 'Simulation offerAddress must be ton.'));
  if (simulation.askAddress !== input.addresses.athMasterAddress) issues.push(issue('SIM_ASK_ADDRESS_MISMATCH', 'Simulation askAddress must equal ATH master.'));
  if (simulation.offerUnits !== input.route.offerUnits) issues.push(issue('SIM_OFFER_UNITS_MISMATCH', 'Simulation offerUnits must remain exactly 50 TON.'));
  if (simulation.router.majorVersion !== input.route.expectedRouterMajorVersion || simulation.router.minorVersion !== input.route.expectedRouterMinorVersion) {
    issues.push(issue('SIM_ROUTER_VERSION_NOT_V2_1', 'Simulation selected router is not the currently pinned STON.fi v2.1 router.'));
  }
  if (!isParseableAddress(simulation.router.address)) issues.push(issue('SIM_BAD_ROUTER_ADDRESS', 'Simulation router address is not parseable.'));
  else if (!isBasechainTonAddress(simulation.router.address)) issues.push(issue('SIM_ROUTER_ADDRESS_NOT_BASECHAIN', 'Simulation router address must be basechain workchain 0.'));
  if (!isParseableAddress(simulation.poolAddress)) issues.push(issue('SIM_BAD_POOL_ADDRESS', 'Simulation pool address is not parseable.'));
  else if (!isBasechainTonAddress(simulation.poolAddress)) issues.push(issue('SIM_POOL_ADDRESS_NOT_BASECHAIN', 'Simulation pool address must be basechain workchain 0.'));
  if (!isParseableAddress(simulation.router.ptonWalletAddress)) issues.push(issue('SIM_BAD_PTON_WALLET_ADDRESS', 'Simulation pTON wallet address is not parseable.'));
  else if (!isBasechainTonAddress(simulation.router.ptonWalletAddress)) issues.push(issue('SIM_PTON_WALLET_ADDRESS_NOT_BASECHAIN', 'Simulation pTON wallet address must be basechain workchain 0.'));
  if (!isParseableAddress(simulation.askJettonWallet)) issues.push(issue('SIM_BAD_ASK_JETTON_WALLET', 'Simulation ask jetton wallet address is not parseable.'));
  else if (!isBasechainTonAddress(simulation.askJettonWallet)) issues.push(issue('SIM_ASK_JETTON_WALLET_NOT_BASECHAIN', 'Simulation ask jetton wallet address must be basechain workchain 0.'));
  return issues;
}

function buildM19EInput(
  input: M20FStonfiLiveCollectorInput,
  simulation: M20FSimulationResult,
  txParams: M20FTxParams,
  capturedAt: string,
): StonfiLiveEvidenceInputM19E {
  return {
    document: 'PLATHO.V1.STONFI_LIVE_EVIDENCE_INPUT_M19E',
    status: input.status === 'FINAL_ROUTE_FREEZE_CANDIDATE'
      ? 'FINAL_ROUTE_FREEZE_CANDIDATE'
      : 'TEMPLATE_NOT_FINAL_ROUTE_FREEZE',
    candidateLabel: 'PLATHO_M20F_MAINNET_STONFI_API_SDK_ROUTE_CANDIDATE',
    officialSource: STONFI_SDK_SOURCE,
    addresses: {
      athMasterAddress: input.addresses.athMasterAddress,
      buybackBurnAddress: input.addresses.buybackBurnAddress,
      buybackBurnOfficialAthWalletAddress: input.addresses.buybackBurnOfficialAthWalletAddress,
      stonfiRouterAddress: simulation.router.address,
      stonfiPoolAddressTonAth: simulation.poolAddress,
      stonfiAthSourceOwnerAddress: input.addresses.stonfiAthSourceOwnerAddress,
      stonfiAthSourceWalletAddress: input.addresses.stonfiAthSourceWalletAddress,
      stonfiPtonWalletAddress: simulation.router.ptonWalletAddress,
      stonfiVaultAddress: null,
      askJettonWalletAddress: simulation.askJettonWallet,
    },
    codeHashes: input.codeHashes,
    swap: {
      queryId: input.routeControls.queryId,
      deadline: input.routeControls.deadline,
      quoteOutAtomicAth: simulation.askUnits,
      dexMinOutAtomicAth: simulation.minAskUnits,
      buybackMinAthOutPer50TonAtomic: input.routeControls.buybackMinAthOutPer50TonAtomic,
    },
    sdkTxParams: {
      source: 'official_stonfi_sdk_or_api',
      sdkPackage: '@ston-fi/sdk',
      sdkVersion: STONFI_SDK_SOURCE.version,
      capturedAt,
      to: txParams.to,
      valueNanotons: txParams.valueNanotons,
      bodyBocBase64: txParams.bodyBocBase64,
    },
    liveProofs: {
      ...input.liveProofs,
      sdkOrApiTxParamsCaptured: true,
      liveQuoteCaptured: true,
      evidenceRefs: {
        sdkTxParams: input.proofRefs.stonfiSdkOrApiTxParamsCapture,
        liveQuote: input.proofRefs.stonfiApiSimulationCapture,
        stonfiAthSourceWalletDerivation: input.proofRefs.stonfiAthSourceWalletDerivationVector,
        athNotificationQueryIdPropagation: input.proofRefs.athNotificationQueryIdPropagationProof,
        refundExcessBodyShape: input.proofRefs.refundExcessBodyShapeProof,
        successExcess: input.proofRefs.successExcessProof,
        minOutFailureRefund: input.proofRefs.minOutFailureRefundProof,
        ptonRefund: input.proofRefs.ptonRefundProof,
        bounceOrFailureBehavior: input.proofRefs.bounceOrFailureBehaviorProof,
      },
    },
  };
}

function decodeTxParamsSafe(txParams: M20FTxParams) {
  const txTo = Address.parse(txParams.to);
  const ptonTransfer = decodePtonTonTransferBodyV21(cellFromBocBase64(txParams.bodyBocBase64));
  const stonfiSwapPayload = ptonTransfer.forwardPayload ? decodeStonfiSwapBodyV21(ptonTransfer.forwardPayload) : null;
  return {
    sdkTxToRaw: addressRaw(txTo),
    ptonTransfer: normalizeDecodedPtonForJson(ptonTransfer),
    stonfiSwapPayload: stonfiSwapPayload ? normalizeDecodedSwapForJson(stonfiSwapPayload) : null,
  };
}

export async function collectM20FStonfiLiveEvidence(
  input: M20FStonfiLiveCollectorInput | null,
  deps: M20FCollectorDeps = {},
  inputSource: string | null = null,
): Promise<M20FStonfiLiveCollectorReport> {
  const generatedAt = deps.capturedAt?.() ?? new Date().toISOString();
  const validation = validateM20FStonfiLiveCollectorInput(input);
  const outputs = {
    template: 'artifacts/m20f_stonfi_live_collector_input_template.json',
    simulation: null as string | null,
    sdkTxParams: null as string | null,
    m19eInput: null as string | null,
  };

  if (!input) {
    return {
      document: 'PLATHO.V1.M20F_STONFI_LIVE_COLLECTOR_REPORT',
      status: 'WAITING_FOR_FINAL_MAINNET_INPUT',
      generated_at: generatedAt,
      route_freeze_ready: false,
      production_buyback_burn_unlocked: false,
      official_sources: M20F_OFFICIAL_SOURCES,
      inputSource,
      issue_codes: validation.issue_codes,
      issues: validation.issues,
      simulation: null,
      sdkTxParams: null,
      decoded: null,
      m19eInput: null,
      m19eReport: null,
      outputs,
    };
  }

  if (!validation.ok) {
    return {
      document: 'PLATHO.V1.M20F_STONFI_LIVE_COLLECTOR_REPORT',
      status: 'BLOCKED_INPUT_NOT_READY',
      generated_at: generatedAt,
      route_freeze_ready: false,
      production_buyback_burn_unlocked: false,
      official_sources: M20F_OFFICIAL_SOURCES,
      inputSource,
      issue_codes: validation.issue_codes,
      issues: validation.issues,
      simulation: null,
      sdkTxParams: null,
      decoded: null,
      m19eInput: null,
      m19eReport: null,
      outputs,
    };
  }

  const issues: { code: string; message: string }[] = [];
  let simulation: M20FSimulationResult | null = null;
  let sdkTxParams: M20FTxParams | null = null;
  let decoded: M20FStonfiLiveCollectorReport['decoded'] = null;
  let m19eInput: StonfiLiveEvidenceInputM19E | null = null;
  let m19eReport: ReturnType<typeof collectLiveEvidenceM19E> | null = null;

  try {
    simulation = await (deps.simulateSwap ?? defaultSimulateSwap)(input);
    issues.push(...simulationIssues(input, simulation));
    if (issues.length === 0) {
      sdkTxParams = await (deps.generateTxParams ?? defaultGenerateTxParams)(input, simulation);
      decoded = decodeTxParamsSafe(sdkTxParams);
      m19eInput = buildM19EInput(input, simulation, sdkTxParams, generatedAt);
      m19eReport = collectLiveEvidenceM19E(m19eInput);
      if (!m19eReport.route_freeze_ready) {
        for (const m19eIssue of m19eReport.issues) {
          issues.push(issue(`M19E_${m19eIssue.code}`, m19eIssue.message));
        }
      }
    }
  } catch (e: any) {
    issues.push(issue('STONFI_LIVE_COLLECT_FAILED', e?.message ?? String(e)));
  }

  const routeFreezeReady = issues.length === 0 && m19eReport?.route_freeze_ready === true;
  return {
    document: 'PLATHO.V1.M20F_STONFI_LIVE_COLLECTOR_REPORT',
    status: routeFreezeReady
      ? 'M20F_LIVE_EVIDENCE_ROUTE_FREEZE_READY'
      : simulation && sdkTxParams
        ? 'COLLECTED_STONFI_SIMULATION_AND_TX_PARAMS'
        : 'BLOCKED_STONFI_LIVE_COLLECT_FAILED',
    generated_at: generatedAt,
    route_freeze_ready: routeFreezeReady,
    production_buyback_burn_unlocked: false,
    official_sources: M20F_OFFICIAL_SOURCES,
    inputSource,
    issue_codes: issues.map((i) => i.code),
    issues,
    simulation,
    sdkTxParams,
    decoded,
    m19eInput,
    m19eReport,
    outputs,
  };
}

function markdown(report: M20FStonfiLiveCollectorReport) {
  const lines = [
    '# M20F STON.fi Live Collector',
    '',
    `Status: ${report.status}`,
    '',
    `- route_freeze_ready: ${report.route_freeze_ready}`,
    `- production_buyback_burn_unlocked: ${report.production_buyback_burn_unlocked}`,
    `- input: ${report.inputSource ?? 'not supplied'}`,
    '',
    '## Issues',
    '',
    ...(report.issues.length > 0 ? report.issues.map((item) => `- ${item.code}: ${item.message}`) : ['- none']),
    '',
    '## Outputs',
    '',
    ...Object.entries(report.outputs).map(([key, value]) => `- ${key}: ${value ?? 'not written'}`),
    '',
    '## Official Sources',
    '',
    `- STON.fi SDK swap docs: ${report.official_sources.stonfiSdkSwapDocs}`,
    `- STON.fi REST API reference: ${report.official_sources.stonfiRestApiReference}`,
    '',
  ];
  return lines.join('\n');
}

export async function writeM20FStonfiLiveCollectorArtifacts(inputPath?: string) {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const template = createM20FStonfiLiveCollectorInputTemplate();
  writeFileSync(join(ARTIFACTS_DIR, 'm20f_stonfi_live_collector_input_template.json'), `${JSON.stringify(template, jsonReplacer, 2)}\n`);

  const input = inputPath && existsSync(inputPath) ? readJson(inputPath) as M20FStonfiLiveCollectorInput : null;
  const report = await collectM20FStonfiLiveEvidence(input, {}, inputPath ?? null);

  if (report.simulation) {
    report.outputs.simulation = 'artifacts/m20f_stonfi_api_simulation_capture.json';
    writeFileSync(join(ARTIFACTS_DIR, 'm20f_stonfi_api_simulation_capture.json'), `${JSON.stringify(report.simulation, jsonReplacer, 2)}\n`);
  }
  if (report.sdkTxParams) {
    report.outputs.sdkTxParams = 'artifacts/m20f_official_sdk_tx_params_capture.json';
    writeFileSync(join(ARTIFACTS_DIR, 'm20f_official_sdk_tx_params_capture.json'), `${JSON.stringify(report.sdkTxParams, jsonReplacer, 2)}\n`);
  }
  if (report.m19eInput) {
    report.outputs.m19eInput = 'artifacts/m20f_live_evidence_input_m19e.json';
    writeFileSync(join(ARTIFACTS_DIR, 'm20f_live_evidence_input_m19e.json'), `${JSON.stringify(report.m19eInput, jsonReplacer, 2)}\n`);
  }

  writeFileSync(join(ARTIFACTS_DIR, 'm20f_stonfi_live_collector.json'), `${JSON.stringify(report, jsonReplacer, 2)}\n`);
  writeFileSync(join(ARTIFACTS_DIR, 'M20F_STONFI_LIVE_COLLECTOR.md'), markdown(report));
  return report;
}

if (require.main === module) {
  writeM20FStonfiLiveCollectorArtifacts(process.argv[2]).then((report) => {
    console.log(JSON.stringify({
      status: report.status,
      route_freeze_ready: report.route_freeze_ready,
      production_buyback_burn_unlocked: report.production_buyback_burn_unlocked,
      issue_codes: report.issue_codes,
      output: 'artifacts/m20f_stonfi_live_collector.json',
    }, null, 2));
  }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
