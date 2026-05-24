import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Address } from '@ton/core';
import {
  collectLiveEvidenceM19E,
  createFixtureLiveEvidenceInputM19E,
  createLiveEvidenceInputTemplateM19E,
  StonfiLiveEvidenceInputM19E,
} from './stonfi_live_evidence_collector_m19e';
import { PLATHO_BUYBACK_STONFI_M19B, STONFI_SDK_SOURCE } from './stonfi_v2_1_route_lib';

const ARTIFACTS_DIR = join(process.cwd(), 'artifacts');

function jsonReplacer(_key: string, value: unknown) {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

function readJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function isPlaceholder(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  return v.length === 0 || v.includes('EQ...') || v.includes('FILL_') || v.includes('required:') || v.includes('64 lowercase hex') || v.includes('uint64 decimal') || v.includes('live quote') || v.includes('pinned circuit') || v.includes('base64 BOC') || v.includes('ISO timestamp');
}

function isDecimalString(value: unknown): boolean {
  return typeof value === 'string' && /^[0-9]+$/.test(value);
}

function isHex64(value: unknown): boolean {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

function isBocLike(value: unknown): boolean {
  return typeof value === 'string' && value.length > 8 && /^[A-Za-z0-9+/=]+$/.test(value);
}

function parseableAddress(value: unknown): boolean {
  if (typeof value !== 'string' || isPlaceholder(value)) return false;
  try {
    Address.parse(value);
    return true;
  } catch {
    return false;
  }
}

function issue(code: string, message: string) {
  return { code, message };
}

export interface StonfiRouteEvidenceDossierM19F {
  document: 'PLATHO.V1.STONFI_ROUTE_EVIDENCE_DOSSIER_M19F';
  status: 'TEMPLATE_NOT_FINAL_ROUTE_FREEZE' | 'FINAL_ROUTE_FREEZE_CANDIDATE';
  operatorGuideVersion: 'M19F';
  immutableRules: {
    noProductionBuybackBurnUntilRouteFreezeReady: true;
    offerAmountNanotonsMustEqual: string;
    conservativeTotalSendValueNanotonsMustEqual: string;
    refundAndExcessReceiverMustBe: 'BuybackBurn';
    successSignalMustBe: 'ATH receipt by official BuybackBurn ATH wallet, then ATHBurnFinalized from ATH Master';
  };
  requiredEvidenceChecklist: {
    athMasterAddressFinal: boolean;
    buybackBurnStateInitAddressFinal: boolean;
    buybackBurnOfficialAthWalletDerived: boolean;
    stonfiRouterAddressPinned: boolean;
    stonfiPoolAddressTonAthPinned: boolean;
    stonfiPtonWalletAddressPinned: boolean;
    codeHashesCaptured: boolean;
    officialSdkOrApiTxParamsCaptured: boolean;
    liveQuoteCaptured: boolean;
    successExcessesObservedToBuybackBurn: boolean;
    minOutFailureRefundObservedToBuybackBurn: boolean;
    ptonRefundObservedToBuybackBurn: boolean;
    bounceOrFailureBehaviorDocumented: boolean;
  };
  evidenceRefs: {
    athDeploymentManifest: string;
    buybackBurnStateInitVector: string;
    officialAthWalletDerivationVector: string;
    stonfiSdkOrApiTxParams: string;
    liveQuote: string;
    codeHashProofs: string;
    successExcessProof: string;
    minOutFailureRefundProof: string;
    ptonRefundProof: string;
    bounceOrFailureBehaviorProof: string;
  };
  liveEvidenceInput: StonfiLiveEvidenceInputM19E;
}

export function createStonfiRouteEvidenceDossierTemplateM19F(): StonfiRouteEvidenceDossierM19F {
  return {
    document: 'PLATHO.V1.STONFI_ROUTE_EVIDENCE_DOSSIER_M19F',
    status: 'TEMPLATE_NOT_FINAL_ROUTE_FREEZE',
    operatorGuideVersion: 'M19F',
    immutableRules: {
      noProductionBuybackBurnUntilRouteFreezeReady: true,
      offerAmountNanotonsMustEqual: PLATHO_BUYBACK_STONFI_M19B.BUYBACK_OFFER_AMOUNT.toString(),
      conservativeTotalSendValueNanotonsMustEqual: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_TOTAL_STONFI_SEND_VALUE.toString(),
      refundAndExcessReceiverMustBe: 'BuybackBurn',
      successSignalMustBe: 'ATH receipt by official BuybackBurn ATH wallet, then ATHBurnFinalized from ATH Master',
    },
    requiredEvidenceChecklist: {
      athMasterAddressFinal: false,
      buybackBurnStateInitAddressFinal: false,
      buybackBurnOfficialAthWalletDerived: false,
      stonfiRouterAddressPinned: false,
      stonfiPoolAddressTonAthPinned: false,
      stonfiPtonWalletAddressPinned: false,
      codeHashesCaptured: false,
      officialSdkOrApiTxParamsCaptured: false,
      liveQuoteCaptured: false,
      successExcessesObservedToBuybackBurn: false,
      minOutFailureRefundObservedToBuybackBurn: false,
      ptonRefundObservedToBuybackBurn: false,
      bounceOrFailureBehaviorDocumented: false,
    },
    evidenceRefs: {
      athDeploymentManifest: 'required: ATH deployment manifest artifact path/hash',
      buybackBurnStateInitVector: 'required: BuybackBurn StateInit vector artifact path/hash',
      officialAthWalletDerivationVector: 'required: official BuybackBurn ATH wallet derivation vector path/hash',
      stonfiSdkOrApiTxParams: 'required: official @ston-fi/sdk/API tx params capture path/hash',
      liveQuote: 'required: quote source, block/seqno/timestamp, and output amount path/hash',
      codeHashProofs: 'required: router/pool/pTON code hash evidence path/hash',
      successExcessProof: 'required: successful swap evidence where excesses return to BuybackBurn',
      minOutFailureRefundProof: 'required: min_out failure evidence where refund returns to BuybackBurn',
      ptonRefundProof: 'required: pTON refund evidence where refund returns to BuybackBurn',
      bounceOrFailureBehaviorProof: 'required: documented router/pTON/pool bounce/failure behavior evidence',
    },
    liveEvidenceInput: createLiveEvidenceInputTemplateM19E(),
  };
}

export function createFixtureFinalDossierM19F(): StonfiRouteEvidenceDossierM19F {
  const input = createFixtureLiveEvidenceInputM19E();
  return {
    ...createStonfiRouteEvidenceDossierTemplateM19F(),
    status: 'FINAL_ROUTE_FREEZE_CANDIDATE',
    requiredEvidenceChecklist: Object.fromEntries(Object.keys(createStonfiRouteEvidenceDossierTemplateM19F().requiredEvidenceChecklist).map((k) => [k, true])) as any,
    evidenceRefs: {
      athDeploymentManifest: 'fixture://ath-deployment-manifest#sha256',
      buybackBurnStateInitVector: 'fixture://buybackburn-stateinit-vector#sha256',
      officialAthWalletDerivationVector: 'fixture://official-ath-wallet-derivation-vector#sha256',
      stonfiSdkOrApiTxParams: 'fixture://official-stonfi-sdk-tx-params#sha256',
      liveQuote: 'fixture://live-quote#block-seqno',
      codeHashProofs: 'fixture://code-hash-proofs#sha256',
      successExcessProof: 'fixture://success-excess-proof#tx',
      minOutFailureRefundProof: 'fixture://min-out-failure-refund-proof#tx',
      ptonRefundProof: 'fixture://pton-refund-proof#tx',
      bounceOrFailureBehaviorProof: 'fixture://bounce-failure-proof#tx',
    },
    liveEvidenceInput: input,
  };
}

export function validateStonfiRouteEvidenceDossierM19F(dossier: StonfiRouteEvidenceDossierM19F) {
  const issues: { code: string; message: string }[] = [];

  if (!dossier || dossier.document !== 'PLATHO.V1.STONFI_ROUTE_EVIDENCE_DOSSIER_M19F') {
    issues.push(issue('BAD_DOCUMENT_TYPE', 'Dossier document must be PLATHO.V1.STONFI_ROUTE_EVIDENCE_DOSSIER_M19F'));
  }
  if (dossier?.operatorGuideVersion !== 'M19F') {
    issues.push(issue('BAD_OPERATOR_GUIDE_VERSION', 'operatorGuideVersion must be M19F'));
  }
  if (dossier?.immutableRules?.noProductionBuybackBurnUntilRouteFreezeReady !== true) {
    issues.push(issue('MISSING_NO_BUYBACKBURN_UNTIL_ROUTE_FREEZE_RULE', 'Dossier must explicitly preserve the no-production-BuybackBurn-until-route-freeze rule'));
  }
  if (dossier?.immutableRules?.offerAmountNanotonsMustEqual !== PLATHO_BUYBACK_STONFI_M19B.BUYBACK_OFFER_AMOUNT.toString()) {
    issues.push(issue('BAD_OFFER_AMOUNT_RULE', 'Dossier must pin offer amount to exactly 50 TON'));
  }
  if (dossier?.immutableRules?.conservativeTotalSendValueNanotonsMustEqual !== PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_TOTAL_STONFI_SEND_VALUE.toString()) {
    issues.push(issue('BAD_TOTAL_SEND_VALUE_RULE', 'Dossier must pin conservative total send value to 51.05 TON'));
  }
  if (dossier?.immutableRules?.refundAndExcessReceiverMustBe !== 'BuybackBurn') {
    issues.push(issue('BAD_REFUND_EXCESS_RECEIVER_RULE', 'Dossier must require refund/excess receiver to be BuybackBurn'));
  }

  const checklist = dossier?.requiredEvidenceChecklist ?? {} as any;
  for (const [label, ok] of Object.entries(checklist)) {
    if (ok !== true) issues.push(issue(`CHECKLIST_${label.toUpperCase()}_NOT_TRUE`, `Required evidence checklist item is not true: ${label}`));
  }

  const refs: Record<string, unknown> = (dossier?.evidenceRefs ?? {}) as any;
  const requiredRefs = [
    'athDeploymentManifest',
    'buybackBurnStateInitVector',
    'officialAthWalletDerivationVector',
    'stonfiSdkOrApiTxParams',
    'liveQuote',
    'codeHashProofs',
    'successExcessProof',
    'minOutFailureRefundProof',
    'ptonRefundProof',
    'bounceOrFailureBehaviorProof',
  ];
  for (const ref of requiredRefs) {
    if (isPlaceholder(refs[ref]) || typeof refs[ref] !== 'string') {
      issues.push(issue(`MISSING_EVIDENCE_REF_${ref.toUpperCase()}`, `Evidence reference must be filled with a real immutable ref: ${ref}`));
    }
  }

  const input = dossier?.liveEvidenceInput;
  if (!input) {
    issues.push(issue('MISSING_LIVE_EVIDENCE_INPUT', 'Dossier must include liveEvidenceInput'));
  } else {
    const addresses: Record<string, unknown> = input.addresses as any;
    for (const key of ['athMasterAddress', 'buybackBurnAddress', 'buybackBurnOfficialAthWalletAddress', 'stonfiRouterAddress', 'stonfiPoolAddressTonAth', 'stonfiPtonWalletAddress', 'askJettonWalletAddress']) {
      if (!parseableAddress(addresses[key])) issues.push(issue(`BAD_ADDRESS_${key.toUpperCase()}`, `${key} must be a real parseable TON address, not a placeholder`));
    }
    for (const [key, value] of Object.entries(input.codeHashes as any)) {
      if (key === 'stonfiVaultCodeHash' && (value === null || value === undefined)) continue;
      if (!isHex64(value)) issues.push(issue(`BAD_CODE_HASH_${key.toUpperCase()}`, `${key} must be a lowercase 32-byte hex string`));
    }
    for (const key of ['queryId', 'deadline', 'quoteOutAtomicAth', 'dexMinOutAtomicAth', 'buybackMinAthOutPer50TonAtomic']) {
      if (!isDecimalString((input.swap as any)[key])) issues.push(issue(`BAD_SWAP_${key.toUpperCase()}`, `${key} must be a decimal string`));
    }
    if (input.sdkTxParams?.sdkPackage !== '@ston-fi/sdk') {
      issues.push(issue('BAD_SDK_PACKAGE', 'sdkTxParams.sdkPackage must be @ston-fi/sdk'));
    }
    if (!input.sdkTxParams?.sdkVersion || isPlaceholder(input.sdkTxParams.sdkVersion)) {
      issues.push(issue('MISSING_SDK_VERSION', 'sdkTxParams.sdkVersion must be the exact official SDK/API version used'));
    }
    if (!parseableAddress(input.sdkTxParams?.to)) {
      issues.push(issue('BAD_SDK_TX_TO', 'sdkTxParams.to must be a real parseable TON address'));
    }
    if (input.sdkTxParams?.valueNanotons !== PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_TOTAL_STONFI_SEND_VALUE.toString()) {
      issues.push(issue('BAD_SDK_TX_VALUE', 'sdkTxParams.valueNanotons must equal 51.05 TON conservative total send value'));
    }
    if (!isBocLike(input.sdkTxParams?.bodyBocBase64)) {
      issues.push(issue('BAD_SDK_TX_BODY_BOC', 'sdkTxParams.bodyBocBase64 must be a non-placeholder base64 BOC'));
    }
  }

  const collectorReport = input ? collectLiveEvidenceM19E(input) : null;
  if (collectorReport && !collectorReport.route_freeze_ready) {
    for (const collectorIssue of collectorReport.issues) {
      issues.push(issue(`COLLECTOR_${collectorIssue.code}`, collectorIssue.message));
    }
  }

  const schemaReady = issues.length === 0;
  const routeFreezeReady = schemaReady && collectorReport?.route_freeze_ready === true && dossier.status === 'FINAL_ROUTE_FREEZE_CANDIDATE';
  if (dossier?.status !== 'FINAL_ROUTE_FREEZE_CANDIDATE') {
    issues.push(issue('DOSSIER_STATUS_NOT_FINAL_ROUTE_FREEZE_CANDIDATE', 'Dossier status must be FINAL_ROUTE_FREEZE_CANDIDATE for route freeze'));
  }

  return {
    milestone: 'M19F_STONFI_ROUTE_EVIDENCE_DOSSIER_VALIDATION',
    generated_at: 'DETERMINISTIC_ARTIFACT',
    official_source: STONFI_SDK_SOURCE,
    schema_ready: schemaReady,
    route_freeze_ready: routeFreezeReady && issues.length === 0,
    issue_codes: issues.map((i) => i.code),
    issues,
    collector_route_freeze_ready: collectorReport?.route_freeze_ready ?? false,
    collector_issue_codes: collectorReport?.issue_codes ?? [],
    decoded: collectorReport?.decoded ?? null,
    rebuilt_hashes: collectorReport?.candidate_validation?.rebuiltHashes ?? null,
    next_step_when_ready: 'If route_freeze_ready is true, use the one-time post-pool FreezeBuybackRoute operation and then enable production buyback execution. If false, keep BuybackBurn route execution blocked.',
  };
}

export function writeM19FArtifacts(inputPath?: string) {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const template = createStonfiRouteEvidenceDossierTemplateM19F();
  writeFileSync(join(ARTIFACTS_DIR, 'stonfi_route_evidence_dossier_template_m19f.json'), JSON.stringify(template, jsonReplacer, 2) + '\n');

  const fixture = createFixtureFinalDossierM19F();
  const fixtureReport = validateStonfiRouteEvidenceDossierM19F(fixture);

  let suppliedReport: ReturnType<typeof validateStonfiRouteEvidenceDossierM19F> | null = null;
  let suppliedSource: string | null = null;
  if (inputPath && existsSync(inputPath)) {
    suppliedSource = inputPath;
    suppliedReport = validateStonfiRouteEvidenceDossierM19F(readJson(inputPath));
  }

  const templateReport = validateStonfiRouteEvidenceDossierM19F(template);
  const report = {
    milestone: 'M19F_STONFI_ROUTE_EVIDENCE_DOSSIER',
    status: suppliedReport?.route_freeze_ready ? 'SUPPLIED_DOSSIER_ROUTE_FREEZE_READY' : 'WAITING_FOR_REAL_STONFI_EVIDENCE_DOSSIER',
    generated_at: 'DETERMINISTIC_ARTIFACT',
    official_source: STONFI_SDK_SOURCE,
    supplied_input_source: suppliedSource,
    route_freeze_ready: suppliedReport?.route_freeze_ready === true,
    template_output: 'artifacts/stonfi_route_evidence_dossier_template_m19f.json',
    template_report: {
      route_freeze_ready: templateReport.route_freeze_ready,
      issue_codes: templateReport.issue_codes,
    },
    fixture_self_test: {
      route_freeze_ready: fixtureReport.route_freeze_ready,
      issue_codes: fixtureReport.issue_codes,
      rebuilt_hashes: fixtureReport.rebuilt_hashes,
    },
    supplied_report: suppliedReport,
  };

  writeFileSync(join(ARTIFACTS_DIR, 'stonfi_route_evidence_dossier_m19f.json'), JSON.stringify(report, jsonReplacer, 2) + '\n');
  writeFileSync(join(ARTIFACTS_DIR, 'STONFI_ROUTE_FREEZE_READY_M19F.txt'), report.route_freeze_ready ? 'true\n' : 'false\n');
  return report;
}

if (require.main === module) {
  const inputPath = process.argv[2];
  const report = writeM19FArtifacts(inputPath);
  console.log(JSON.stringify({
    status: report.status,
    route_freeze_ready: report.route_freeze_ready,
    supplied_input_source: report.supplied_input_source,
    template_output: report.template_output,
    output: 'artifacts/stonfi_route_evidence_dossier_m19f.json',
  }, null, 2));
}
