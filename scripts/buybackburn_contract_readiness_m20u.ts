import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { BUYBACKBURN_M19G, createBuybackBurnStateMachineProfileM19G } from './buybackburn_state_machine_m19g';
import { BUYBACKBURN_FUNDING_ENVELOPE_M19H, createFundingEnvelopeProfileM19H } from './buybackburn_funding_envelope_m19h';
import { createStonfiRouteEvidenceDossierTemplateM19F, validateStonfiRouteEvidenceDossierM19F } from './stonfi_route_evidence_dossier_m19f';

const ARTIFACTS_DIR = join(process.cwd(), 'artifacts');

export type BuybackBurnImplementationReadinessStatusM20U =
  | 'BLOCKED_PENDING_TESTNET_AND_MAINNET_ROUTE_FREEZE'
  | 'READY_FOR_IMPLEMENTATION_AFTER_M20F';

export interface BuybackBurnImplementationReadinessM20U {
  document: 'PLATHO.V1.BUYBACKBURN_IMPLEMENTATION_READINESS_M20U';
  status: BuybackBurnImplementationReadinessStatusM20U;
  productionBuybackBurnImplementationReady: boolean;
  stonfiRouteFreezeReady: boolean;
  testnetProbeComplete: boolean;
  testnetProbeRequiredBeforeMainnetFreeze: boolean;
  canImplementProductionContractNow: boolean;
  addressCircularityResolution: {
    m20fNeedsFinalBuybackBurnAddress: boolean;
    productionStateInitCanBePreparedBeforeM20FRouteFreeze: boolean;
    productionRouteSealStillRequiresM20F: boolean;
    addressUnlockPreflight: string;
  };
  evidenceSources: {
    m20tTestnetEvidence: string;
    m20fMainnetRouteFreezeFlag: string;
    m20fMainnetAddressUnlockFlag: string;
  };
  inheritedProfiles: {
    m19gStateMachineProfile: string;
    m19hFundingEnvelopeProfile: string;
    m20tTestnetPreflightProfile: string;
  };
  pinnedRouteIndependentValues: {
    buybackOfferAmountNanotons: string;
    routeTotalFundingEnvelopeNanotons: string;
    feeAccumulatorFlushAmountNanotons: string;
  };
  requiredBeforeProductionImplementation: string[];
  candidateContractSurface: {
    messages: string[];
    immutableAddresses: string[];
    state: string[];
    getMethods: string[];
  };
  implementationAcceptanceMatrix: {
    label: string;
    required: boolean;
    source: string;
  }[];
  forbidden: string[];
  codexGuardrails: string[];
  blockedBy: string[];
}

export interface ReadinessOverridesM20U {
  stonfiRouteFreezeReady?: boolean;
  testnetProbeComplete?: boolean;
  artifactsDir?: string;
}

function readJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readM20TTestnetProbeComplete(artifactsDir: string): boolean {
  const evidencePath = join(artifactsDir, 'm20t_testnet_evidence.json');
  if (!existsSync(evidencePath)) return false;
  const evidence = readJson(evidencePath);
  return evidence.status === 'LIVE_TESTNET_M20T_HARNESS_PASS'
    && evidence.network === 'testnet'
    && evidence.notMainnetRouteFreeze === true
    && evidence.notProductionBuybackBurnUnlock === true
    && evidence.productionFlagsRemainFalse === true;
}

function readM20FRouteFreezeReady(artifactsDir: string): boolean | null {
  const m20fPath = join(artifactsDir, 'M20F_ROUTE_FREEZE_READY.txt');
  if (existsSync(m20fPath)) return readFileSync(m20fPath, 'utf8').trim().toLowerCase() === 'true';
  const m19fPath = join(artifactsDir, 'STONFI_ROUTE_FREEZE_READY_M19F.txt');
  if (existsSync(m19fPath)) return readFileSync(m19fPath, 'utf8').trim().toLowerCase() === 'true';
  return null;
}

export function createBuybackBurnImplementationReadinessM20U(
  overrides: ReadinessOverridesM20U = {},
): BuybackBurnImplementationReadinessM20U {
  const artifactsDir = overrides.artifactsDir ?? ARTIFACTS_DIR;
  const stateMachine = createBuybackBurnStateMachineProfileM19G();
  const envelope = createFundingEnvelopeProfileM19H();
  const routeTemplate = createStonfiRouteEvidenceDossierTemplateM19F();
  const routeReport = validateStonfiRouteEvidenceDossierM19F(routeTemplate);
  const artifactRouteReady = readM20FRouteFreezeReady(artifactsDir);

  const stonfiRouteFreezeReady = overrides.stonfiRouteFreezeReady ?? artifactRouteReady ?? routeReport.route_freeze_ready;
  const testnetProbeComplete = overrides.testnetProbeComplete ?? readM20TTestnetProbeComplete(artifactsDir);
  const canImplementProductionContractNow = stonfiRouteFreezeReady && testnetProbeComplete;

  const blockedBy: string[] = [];
  if (!testnetProbeComplete) blockedBy.push('M20T_TESTNET_DEPLOYMENT_PROBE_NOT_COMPLETE');
  if (!stonfiRouteFreezeReady) blockedBy.push('M20F_MAINNET_STONFI_ROUTE_FREEZE_NOT_READY');

  return {
    document: 'PLATHO.V1.BUYBACKBURN_IMPLEMENTATION_READINESS_M20U',
    status: canImplementProductionContractNow
      ? 'READY_FOR_IMPLEMENTATION_AFTER_M20F'
      : 'BLOCKED_PENDING_TESTNET_AND_MAINNET_ROUTE_FREEZE',
    productionBuybackBurnImplementationReady: canImplementProductionContractNow,
    stonfiRouteFreezeReady,
    testnetProbeComplete,
    testnetProbeRequiredBeforeMainnetFreeze: true,
    canImplementProductionContractNow,
    addressCircularityResolution: {
      m20fNeedsFinalBuybackBurnAddress: true,
      productionStateInitCanBePreparedBeforeM20FRouteFreeze: true,
      productionRouteSealStillRequiresM20F: true,
      addressUnlockPreflight: 'artifacts/M20F_MAINNET_ADDRESS_UNLOCK_READY.txt',
    },
    evidenceSources: {
      m20tTestnetEvidence: 'artifacts/m20t_testnet_evidence.json',
      m20fMainnetRouteFreezeFlag: existsSync(join(artifactsDir, 'M20F_ROUTE_FREEZE_READY.txt'))
        ? 'artifacts/M20F_ROUTE_FREEZE_READY.txt'
        : 'artifacts/STONFI_ROUTE_FREEZE_READY_M19F.txt',
      m20fMainnetAddressUnlockFlag: 'artifacts/M20F_MAINNET_ADDRESS_UNLOCK_READY.txt',
    },
    inheritedProfiles: {
      m19gStateMachineProfile: stateMachine.document,
      m19hFundingEnvelopeProfile: envelope.document,
      m20tTestnetPreflightProfile: 'PLATHO.V1.M20T_TESTNET_DEPLOYMENT_PROBE_PREFLIGHT',
    },
    pinnedRouteIndependentValues: {
      buybackOfferAmountNanotons: BUYBACKBURN_M19G.buybackOfferAmountNanotons.toString(),
      routeTotalFundingEnvelopeNanotons: BUYBACKBURN_M19G.routeTotalValueNanotons.toString(),
      feeAccumulatorFlushAmountNanotons: BUYBACKBURN_FUNDING_ENVELOPE_M19H.buybackFeeAccumulatorFlushAmountNanotons.toString(),
    },
    requiredBeforeProductionImplementation: [
      'M20T live testnet deployment/probe evidence with disposable testnet wallet',
      'M20F mainnet STON.fi route evidence dossier passing M19F/M19E/M19C gates before production route seal/execution',
      'final ATH master address',
      'address-stable production BuybackBurn StateInit implementation before M20F final input collection; route execution remains sealed until M20F',
      'final BuybackBurn StateInit address',
      'official BuybackBurn ATH wallet derivation vector',
      'pinned STON.fi router/pool/pTON addresses and code hashes',
      'official SDK/API tx params for exactly 50 TON -> ATH',
      'live quote and dex_min_out policy',
      'refund/excess/bounce evidence returning value to BuybackBurn',
    ],
    candidateContractSurface: {
      messages: [
        'AcceptBurnReserve from immutable FeeAccumulator only, exact 51.05 TON funding envelope',
        'ExecuteBuybackChunk only when route freeze values are embedded in final implementation',
        'JettonTransferNotification only from official BuybackBurn ATH wallet',
        'ATHBurnFinalized only from ATH Master',
        'Route refund/failure handling without pretending burn success',
        'RecoverStonfiRouteRefund only after large current-swap refund delta and deadline grace',
        'RecycleRouteRefundReserve for permissionless conversion of a full returned 51.05 TON envelope into reserve',
        'RetryAthBurnDue for ATH held after authenticated burn failure',
      ],
      immutableAddresses: [
        'feeAccumulatorAddress',
        'athMasterAddress',
        'officialBuybackBurnAthWalletAddress',
        'stonfiRouterAddress',
        'stonfiPoolAddressTonAth',
        'stonfiPtonWalletAddress',
      ],
      state: [
        'IDLE',
        'PENDING_STONFI_SWAP',
        'PENDING_ATH_BURN',
        'pendingQueryId',
        'pendingDeadline',
        'pendingRouteRefundStartNanotons',
        'pendingDexMinOutAtomicAth',
        'pendingReceivedAthAtomic',
        'routeRefundDueNanotons',
        'athBurnRetryDueAtomic',
        'burnedAthTotalAtomic',
      ],
      getMethods: [
        'get_buyback_burn_state',
        'get_buyback_burn_config',
        'get_buyback_burn_totals',
      ],
    },
    implementationAcceptanceMatrix: [
      { label: 'raw 50 TON funding envelope is rejected by FeeAccumulator', required: true, source: 'M19I/M19H' },
      { label: 'exact 51.05 TON envelope is accepted only for BuybackBurn reserve path', required: true, source: 'M19I/M19H' },
      { label: 'no production BuybackBurn before route freeze', required: true, source: 'M19C/M19F/M19G' },
      { label: 'pending STON.fi swap cannot be cleared by router claim alone', required: true, source: 'M19G' },
      { label: 'pending burn cannot be cleared without ATHBurnFinalized from ATH Master', required: true, source: 'M19G' },
      { label: 'refund/excess receiver remains BuybackBurn', required: true, source: 'M19H/M19F' },
      { label: 'testnet evidence is separated from mainnet route freeze', required: true, source: 'M20T' },
      { label: 'final genesis replaces blocked placeholder with BuybackBurn StateInit address', required: true, source: 'M15/M16/M18' },
    ],
    forbidden: [
      ...stateMachine.forbidden,
      'turning testnet proof into mainnet route freeze',
      'setting STONFI_ROUTE_FREEZE_READY=true from templates or placeholders',
      'setting BUYBACKBURN_IMPLEMENTATION_READY=true before both M20T and M20F are complete',
      'adding owner/admin rescue/pause/governance surfaces to make route uncertainty manageable',
      'committing deployer mnemonic/private key/.env.local',
    ],
    codexGuardrails: [
      'Do not modify contracts during M20T unless explicitly instructed in a later milestone.',
      'Do not implement production BuybackBurn from this readiness report alone.',
      'You may prepare an address-stable BuybackBurn StateInit candidate before M20F, but do not seal/execute a live STON.fi route until M20F passes.',
      'If wallet funding is missing, stop with NEED_TESTNET_TON and print only the disposable testnet address.',
      'Never commit seed phrases, private keys, .env, .env.*, *.mnemonic, *.seed, or *.secret.',
      'Keep testnet manifests and mainnet route-freeze manifests separate.',
    ],
    blockedBy,
  };
}

function main() {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const report = createBuybackBurnImplementationReadinessM20U();
  writeFileSync(join(ARTIFACTS_DIR, 'buybackburn_implementation_readiness_m20u.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(ARTIFACTS_DIR, 'BUYBACKBURN_IMPLEMENTATION_READY_M20U.txt'), `${report.productionBuybackBurnImplementationReady}\n`);
  console.log(JSON.stringify({
    ok: true,
    document: report.document,
    status: report.status,
    implementationReady: report.productionBuybackBurnImplementationReady,
    blockedBy: report.blockedBy,
  }, null, 2));
}

if (require.main === module) main();
