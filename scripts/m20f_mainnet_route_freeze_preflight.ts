import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Address } from '@ton/core';
import { PLATHO_BUYBACK_STONFI_M19B, STONFI_SDK_SOURCE } from './stonfi_v2_1_route_lib';

const ARTIFACTS_DIR = join(process.cwd(), 'artifacts');

export const M20F_OFFICIAL_SOURCES = {
  stonfiSdkSwapDocs: 'https://docs.ston.fi/developer-section/dex/sdk/v2/swap',
  stonfiRestApiDocs: 'https://docs.ston.fi/developer-section/dex/api',
  stonfiRestApiReference: 'https://docs.ston.fi/developer-section/dex/api/reference',
  stonfiApiBaseUrl: 'https://api.ston.fi',
  stonfiApiSwapSimulationEndpoint: 'POST /v1/swap/simulate',
  sdkPackage: '@ston-fi/sdk',
  sdkVersionVerifiedByNpm: STONFI_SDK_SOURCE.version,
  apiPackage: '@ston-fi/api',
  apiPackageVersionVerifiedByNpm: '0.32.0',
} as const;

export const M20F_SAFE_VALUE_BOUNDS = {
  buybackRouteAthNotifyValueUpstreamMinNanotons: '40000000',
  athNotifyOwnerRequestValueSafeMinNanotons: '50000000',
} as const;

export interface M20FMainnetRouteFreezeInput {
  document: 'PLATHO.V1.M20F_MAINNET_ROUTE_FREEZE_INPUT';
  network: 'mainnet';
  status: 'DRAFT_MAINNET_ROUTE_FREEZE_INPUT' | 'FINAL_ROUTE_FREEZE_CANDIDATE';
  addresses: {
    athMasterAddress: string;
    buybackBurnStateInitAddress: string;
    buybackBurnOfficialAthWalletAddress: string;
    stonfiRouterAddress: string;
    stonfiPoolAddressTonAth: string;
    stonfiAthSourceOwnerAddress: string;
    stonfiAthSourceWalletAddress: string;
    stonfiPtonMasterAddress: string;
    stonfiPtonWalletAddress: string;
    askJettonWalletAddress: string;
  };
  evidenceRefs: {
    athDeploymentManifest: string;
    buybackBurnStateInitVector: string;
    officialAthWalletDerivationVector: string;
    stonfiAthSourceWalletDerivationVector: string;
    stonfiApiSimulationCapture: string;
    stonfiSdkOrApiTxParamsCapture: string;
    routerPoolPtonCodeHashes: string;
    successExcessProof: string;
    minOutFailureRefundProof: string;
    ptonRefundProof: string;
    bounceOrFailureBehaviorProof: string;
  };
  safeValueBounds: {
    buybackRouteAthNotifyValueUpstreamNanotons: string;
    vaultAthDepositOwnerRequestValueNanotons: string;
    usernameMintOwnerRequestValueNanotons: string;
    buybackRouteAthNotifyBoundaryProof: string;
    athNotifyOwnerRequestBoundaryProof: string;
  };
  m19fDossierPath: string;
}

export interface M20FMainnetRouteFreezePreflight {
  document: 'PLATHO.V1.M20F_MAINNET_ROUTE_FREEZE_PREFLIGHT';
  status:
    | 'BLOCKED_MISSING_FINAL_MAINNET_INPUTS'
    | 'BLOCKED_TESTNET_OR_NONPROD_INPUT'
    | 'BLOCKED_M19F_DOSSIER_NOT_READY'
    | 'M20F_ROUTE_FREEZE_READY';
  generated_at: 'DETERMINISTIC_ARTIFACT';
  route_freeze_ready: boolean;
  production_buyback_burn_unlocked: boolean;
  official_sources: typeof M20F_OFFICIAL_SOURCES;
  route_profile: {
    offerAmountNanotons: string;
    conservativeTotalSendValueNanotons: string;
    routeForwardGasNanotons: string;
    ptonTransferGasNanotons: string;
  };
  safe_value_bounds: typeof M20F_SAFE_VALUE_BOUNDS;
  m20t: {
    evidenceSource: string;
    status: string | null;
    complete: boolean;
    notProductionUnlock: boolean;
  };
  inputSource: string | null;
  m19fDossierPath: string;
  m19fRouteFreezeReady: boolean;
  blockers: string[];
  missingInputs: string[];
  rejectedNonProdInputs: string[];
  requiredNextInputs: string[];
}

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readFlag(path: string): boolean {
  if (!existsSync(path)) return false;
  return readFileSync(path, 'utf8').trim().toLowerCase() === 'true';
}

function isPlaceholder(value: unknown): boolean {
  if (typeof value !== 'string') return true;
  const v = value.trim();
  return v.length === 0
    || v.includes('REQUIRED_')
    || v.includes('required:')
    || v.includes('EQ...')
    || v.includes('FILL_')
    || v.includes('<');
}

function isParseableTonAddress(value: string): boolean {
  try {
    Address.parse(value);
    return true;
  } catch {
    return false;
  }
}

function isDecimalString(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9]+$/.test(value);
}

export function isTestnetFriendlyAddress(value: string): boolean {
  return /^[0k]Q/.test(value.trim());
}

function hasNonProdMarker(value: string): boolean {
  return /\b(testnet|fixture|preview|mock|template|placeholder)\b/i.test(value);
}

function makeTemplate(): M20FMainnetRouteFreezeInput {
  return {
    document: 'PLATHO.V1.M20F_MAINNET_ROUTE_FREEZE_INPUT',
    network: 'mainnet',
    status: 'DRAFT_MAINNET_ROUTE_FREEZE_INPUT',
    addresses: {
      athMasterAddress: 'REQUIRED_MAINNET_ATH_MASTER_ADDRESS',
      buybackBurnStateInitAddress: 'REQUIRED_MAINNET_BUYBACKBURN_STATEINIT_ADDRESS',
      buybackBurnOfficialAthWalletAddress: 'REQUIRED_MAINNET_BUYBACKBURN_OFFICIAL_ATH_WALLET_ADDRESS',
      stonfiRouterAddress: 'REQUIRED_FROM_STONFI_API_SIMULATION_ROUTER_ADDRESS',
      stonfiPoolAddressTonAth: 'REQUIRED_FROM_STONFI_API_SIMULATION_OR_POOL_QUERY',
      stonfiAthSourceOwnerAddress: 'REQUIRED_ATH_OUTPUT_SOURCE_OWNER_WHO_DERIVES_ASK_WALLET',
      stonfiAthSourceWalletAddress: 'REQUIRED_DERIVED_ATH_OUTPUT_SOURCE_WALLET_ADDRESS',
      stonfiPtonMasterAddress: 'REQUIRED_FROM_STONFI_API_SIMULATION_ROUTER_PTON_MASTER',
      stonfiPtonWalletAddress: 'REQUIRED_FROM_OFFICIAL_SDK_TX_PARAMS_TO_ADDRESS',
      askJettonWalletAddress: 'REQUIRED_FROM_OFFICIAL_SDK_SWAP_PAYLOAD',
    },
    evidenceRefs: {
      athDeploymentManifest: 'required: immutable artifact path/hash for final ATH deployment',
      buybackBurnStateInitVector: 'required: immutable artifact path/hash for final BuybackBurn StateInit',
      officialAthWalletDerivationVector: 'required: immutable artifact path/hash for official BuybackBurn ATH wallet derivation',
      stonfiAthSourceWalletDerivationVector: 'required: immutable artifact path/hash proving source owner derives askJettonWalletAddress',
      stonfiApiSimulationCapture: 'required: STON.fi API /v1/swap/simulate capture path/hash',
      stonfiSdkOrApiTxParamsCapture: 'required: official @ston-fi/sdk/API tx params capture path/hash',
      routerPoolPtonCodeHashes: 'required: mainnet router/pool/pTON code hash proof path/hash',
      successExcessProof: 'required: successful swap tx evidence where excesses return to BuybackBurn',
      minOutFailureRefundProof: 'required: min_out failure tx evidence where refund returns to BuybackBurn',
      ptonRefundProof: 'required: pTON refund tx evidence where refund returns to BuybackBurn',
      bounceOrFailureBehaviorProof: 'required: documented bounce/failure behavior evidence',
    },
    safeValueBounds: {
      buybackRouteAthNotifyValueUpstreamNanotons: 'required: decimal nanotons, production-safe value >= 40000000',
      vaultAthDepositOwnerRequestValueNanotons: 'required: decimal nanotons, production-safe value >= 50000000',
      usernameMintOwnerRequestValueNanotons: 'required: decimal nanotons, production-safe value >= 50000000',
      buybackRouteAthNotifyBoundaryProof: 'required: sandbox/live proof that 35M is unsafe and configured upstream notify value completes BuybackBurn burn path',
      athNotifyOwnerRequestBoundaryProof: 'required: sandbox proof that configured Vault deposit and username mint request values complete the full ATHWallet notify path',
    },
    m19fDossierPath: 'artifacts/stonfi_route_evidence_dossier_m19f.json',
  };
}

function collectInputFindings(input: M20FMainnetRouteFreezeInput | null) {
  const missingInputs: string[] = [];
  const rejectedNonProdInputs: string[] = [];

  if (!input) {
    return {
      missingInputs: [
        'M20F_MAINNET_ROUTE_FREEZE_INPUT',
        'FINAL_MAINNET_ATH_MASTER_ADDRESS',
        'FINAL_BUYBACKBURN_STATEINIT_ADDRESS',
        'OFFICIAL_BUYBACKBURN_ATH_WALLET_ADDRESS',
        'STONFI_API_SIMULATION_CAPTURE',
        'OFFICIAL_STONFI_SDK_OR_API_TX_PARAMS_CAPTURE',
        'MAINNET_REFUND_EXCESS_AND_FAILURE_PROOFS',
      ],
      rejectedNonProdInputs,
    };
  }

  if (input.document !== 'PLATHO.V1.M20F_MAINNET_ROUTE_FREEZE_INPUT') missingInputs.push('VALID_M20F_DOCUMENT');
  if (input.network !== 'mainnet') rejectedNonProdInputs.push('network');

  for (const [key, value] of Object.entries(input.addresses ?? {})) {
    if (isPlaceholder(value) || !isParseableTonAddress(value)) {
      missingInputs.push(key);
      continue;
    }
    if (isTestnetFriendlyAddress(value) || hasNonProdMarker(value)) {
      rejectedNonProdInputs.push(key);
    }
  }

  for (const [key, value] of Object.entries(input.evidenceRefs ?? {})) {
    if (isPlaceholder(value)) missingInputs.push(key);
    if (typeof value === 'string' && hasNonProdMarker(value)) rejectedNonProdInputs.push(key);
  }

  const safeBounds = input.safeValueBounds ?? {} as M20FMainnetRouteFreezeInput['safeValueBounds'];
  const numericBounds = [
    {
      key: 'buybackRouteAthNotifyValueUpstreamNanotons',
      min: BigInt(M20F_SAFE_VALUE_BOUNDS.buybackRouteAthNotifyValueUpstreamMinNanotons),
    },
    {
      key: 'vaultAthDepositOwnerRequestValueNanotons',
      min: BigInt(M20F_SAFE_VALUE_BOUNDS.athNotifyOwnerRequestValueSafeMinNanotons),
    },
    {
      key: 'usernameMintOwnerRequestValueNanotons',
      min: BigInt(M20F_SAFE_VALUE_BOUNDS.athNotifyOwnerRequestValueSafeMinNanotons),
    },
  ] as const;

  for (const { key, min } of numericBounds) {
    const value = safeBounds[key];
    if (!isDecimalString(value)) {
      missingInputs.push(key);
      continue;
    }
    if (BigInt(value) < min) {
      missingInputs.push(key);
    }
  }

  for (const key of ['buybackRouteAthNotifyBoundaryProof', 'athNotifyOwnerRequestBoundaryProof'] as const) {
    const value = safeBounds[key];
    if (isPlaceholder(value)) missingInputs.push(key);
    if (typeof value === 'string' && hasNonProdMarker(value)) rejectedNonProdInputs.push(key);
  }

  return { missingInputs, rejectedNonProdInputs };
}

function readM20TStatus(artifactsDir: string) {
  const evidenceSource = join(artifactsDir, 'm20t_testnet_evidence.json');
  if (!existsSync(evidenceSource)) {
    return { evidenceSource: 'artifacts/m20t_testnet_evidence.json', status: null, complete: false, notProductionUnlock: true };
  }
  const evidence = readJson(evidenceSource);
  return {
    evidenceSource: 'artifacts/m20t_testnet_evidence.json',
    status: typeof evidence.status === 'string' ? evidence.status : null,
    complete: evidence.status === 'LIVE_TESTNET_M20T_HARNESS_PASS'
      && evidence.network === 'testnet'
      && evidence.productionFlagsRemainFalse === true,
    notProductionUnlock: evidence.notProductionBuybackBurnUnlock === true && evidence.notMainnetRouteFreeze === true,
  };
}

export function createM20FMainnetRouteFreezePreflight(options: {
  artifactsDir?: string;
  inputPath?: string;
  input?: M20FMainnetRouteFreezeInput | null;
  m19fRouteFreezeReady?: boolean;
} = {}): M20FMainnetRouteFreezePreflight {
  const artifactsDir = options.artifactsDir ?? ARTIFACTS_DIR;
  const inputSource = options.inputPath ?? null;
  const input = options.input ?? (inputSource && existsSync(inputSource) ? readJson(inputSource) as M20FMainnetRouteFreezeInput : null);
  const findings = collectInputFindings(input);
  const m19fDossierPath = input?.m19fDossierPath ?? 'artifacts/stonfi_route_evidence_dossier_m19f.json';
  const m19fReady = options.m19fRouteFreezeReady ?? readFlag(join(artifactsDir, 'STONFI_ROUTE_FREEZE_READY_M19F.txt'));
  const m20t = readM20TStatus(artifactsDir);

  const blockers: string[] = [];
  if (!m20t.complete) blockers.push('M20T_TESTNET_DEPLOYMENT_PROBE_NOT_COMPLETE');
  if (!m20t.notProductionUnlock) blockers.push('M20T_EVIDENCE_MUST_REMAIN_NON_PRODUCTION_UNLOCK');
  if (findings.missingInputs.length > 0) blockers.push('MISSING_FINAL_MAINNET_M20F_INPUTS');
  if (findings.rejectedNonProdInputs.length > 0) blockers.push('TESTNET_OR_NONPROD_INPUT_IN_MAINNET_ROUTE_FREEZE');
  if (!m19fReady) blockers.push('M19F_ROUTE_EVIDENCE_DOSSIER_NOT_READY');

  const routeFreezeReady = blockers.length === 0;
  const status = routeFreezeReady
    ? 'M20F_ROUTE_FREEZE_READY'
    : findings.rejectedNonProdInputs.length > 0
      ? 'BLOCKED_TESTNET_OR_NONPROD_INPUT'
      : findings.missingInputs.length > 0
        ? 'BLOCKED_MISSING_FINAL_MAINNET_INPUTS'
        : 'BLOCKED_M19F_DOSSIER_NOT_READY';

  return {
    document: 'PLATHO.V1.M20F_MAINNET_ROUTE_FREEZE_PREFLIGHT',
    status,
    generated_at: 'DETERMINISTIC_ARTIFACT',
    route_freeze_ready: routeFreezeReady,
    production_buyback_burn_unlocked: false,
    official_sources: M20F_OFFICIAL_SOURCES,
    route_profile: {
      offerAmountNanotons: PLATHO_BUYBACK_STONFI_M19B.BUYBACK_OFFER_AMOUNT.toString(),
      conservativeTotalSendValueNanotons: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_TOTAL_STONFI_SEND_VALUE.toString(),
      routeForwardGasNanotons: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_ROUTE_FORWARD_GAS.toString(),
      ptonTransferGasNanotons: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_PTON_TRANSFER_GAS.toString(),
    },
    safe_value_bounds: M20F_SAFE_VALUE_BOUNDS,
    m20t,
    inputSource,
    m19fDossierPath,
    m19fRouteFreezeReady: m19fReady,
    blockers,
    missingInputs: findings.missingInputs,
    rejectedNonProdInputs: findings.rejectedNonProdInputs,
    requiredNextInputs: [
      'Deploy/freeze final mainnet ATH master and capture immutable deployment manifest.',
      'Derive final production BuybackBurn StateInit address and official BuybackBurn ATH wallet.',
      'Derive the STON.fi ATH source owner wallet and prove it equals the SDK/API askJettonWalletAddress.',
      'Use STON.fi API mainnet simulation for exact 50 TON -> ATH route and capture router metadata.',
      'Generate official @ston-fi/sdk/@ston-fi/api tx params from the simulation result.',
      'Capture router, pool, pTON, ATH master, and ATH wallet code hashes on mainnet.',
      'Prove success excesses, min_out failure refund, pTON refund, and bounce/failure behavior return to BuybackBurn.',
      'Prove BuybackBurn ATH route notify value is production-safe: upstream notify value must be >= 40,000,000 nanotons and must not leave BuybackBurn pending.',
      'Pin Vault ATH deposit and username mint owner request values to >= 50,000,000 nanotons or stricter current safe bounds.',
      'Feed the complete evidence dossier through M19F; only then may M20F_ROUTE_FREEZE_READY become true.',
    ],
  };
}

function writeMarkdown(report: M20FMainnetRouteFreezePreflight) {
  const lines = [
    '# M20F Mainnet Route Freeze Preflight',
    '',
    `Status: ${report.status}`,
    '',
    '## Flags',
    '',
    `- M20T complete: ${report.m20t.complete}`,
    `- M19F route freeze ready: ${report.m19fRouteFreezeReady}`,
    `- M20F route freeze ready: ${report.route_freeze_ready}`,
    `- Production BuybackBurn unlocked: ${report.production_buyback_burn_unlocked}`,
    `- Buyback route ATH notify upstream min: ${report.safe_value_bounds.buybackRouteAthNotifyValueUpstreamMinNanotons}`,
    `- ATH notify owner request safe min: ${report.safe_value_bounds.athNotifyOwnerRequestValueSafeMinNanotons}`,
    '',
    '## Blockers',
    '',
    ...(
      report.blockers.length > 0
        ? report.blockers.map((blocker) => `- ${blocker}`)
        : ['- none']
    ),
    '',
    '## Missing Inputs',
    '',
    ...(
      report.missingInputs.length > 0
        ? report.missingInputs.map((input) => `- ${input}`)
        : ['- none']
    ),
    '',
    '## Rejected Non-Prod Inputs',
    '',
    ...(
      report.rejectedNonProdInputs.length > 0
        ? report.rejectedNonProdInputs.map((input) => `- ${input}`)
        : ['- none']
    ),
    '',
    '## Official Sources',
    '',
    `- STON.fi SDK swap docs: ${report.official_sources.stonfiSdkSwapDocs}`,
    `- STON.fi REST API docs: ${report.official_sources.stonfiRestApiDocs}`,
    `- STON.fi REST API reference: ${report.official_sources.stonfiRestApiReference}`,
    `- STON.fi API base URL: ${report.official_sources.stonfiApiBaseUrl}`,
    `- @ston-fi/sdk version verified by npm: ${report.official_sources.sdkVersionVerifiedByNpm}`,
    `- @ston-fi/api version verified by npm: ${report.official_sources.apiPackageVersionVerifiedByNpm}`,
    '',
    '## Next Inputs',
    '',
    ...report.requiredNextInputs.map((input) => `- ${input}`),
    '',
    'M20F is not complete until M19F passes with real mainnet evidence. Testnet M20T evidence must stay separate.',
    '',
  ];
  return lines.join('\n');
}

export function writeM20FMainnetRouteFreezePreflightArtifacts(inputPath?: string) {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const template = makeTemplate();
  writeFileSync(join(ARTIFACTS_DIR, 'm20f_mainnet_route_freeze_input_template.json'), `${JSON.stringify(template, null, 2)}\n`);

  const report = createM20FMainnetRouteFreezePreflight({ inputPath });
  writeFileSync(join(ARTIFACTS_DIR, 'm20f_mainnet_route_freeze_preflight.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(ARTIFACTS_DIR, 'M20F_MAINNET_ROUTE_FREEZE_PREFLIGHT.md'), writeMarkdown(report));
  writeFileSync(join(ARTIFACTS_DIR, 'M20F_ROUTE_FREEZE_READY.txt'), `${report.route_freeze_ready}\n`);
  return report;
}

if (require.main === module) {
  const report = writeM20FMainnetRouteFreezePreflightArtifacts(process.argv[2]);
  console.log(JSON.stringify({
    status: report.status,
    route_freeze_ready: report.route_freeze_ready,
    production_buyback_burn_unlocked: report.production_buyback_burn_unlocked,
    blockers: report.blockers,
    output: 'artifacts/m20f_mainnet_route_freeze_preflight.json',
  }, null, 2));
}
