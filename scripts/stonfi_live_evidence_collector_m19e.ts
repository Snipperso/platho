import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Address, Cell } from '@ton/core';
import {
  addressRaw,
  cellBocBase64,
  cellFromBocBase64,
  decodePtonTonTransferBodyV21,
  deterministicAddress,
  normalizeDecodedPtonForJson,
  normalizeDecodedSwapForJson,
  decodeStonfiSwapBodyV21,
  PLATHO_BUYBACK_STONFI_M19B,
  STONFI_SDK_SOURCE,
  StonfiRouteFreezeCandidateV21,
  validateStonfiRouteFreezeCandidateV21,
  buildStonfiTonToJettonTxParamsV21,
} from './stonfi_v2_1_route_lib';
import { createFixtureFinalCandidateM19D } from './stonfi_route_candidate_intake_m19d';

const ARTIFACTS_DIR = join(process.cwd(), 'artifacts');

function jsonReplacer(_key: string, value: unknown) {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

function parseAddress(value: string, label: string): Address {
  try {
    return Address.parse(value);
  } catch (e: any) {
    throw new Error(`${label} is not a parseable TON address: ${e?.message ?? String(e)}`);
  }
}

function readJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export interface StonfiLiveEvidenceInputM19E {
  document: 'PLATHO.V1.STONFI_LIVE_EVIDENCE_INPUT_M19E';
  status: 'TEMPLATE_NOT_FINAL_ROUTE_FREEZE' | 'FINAL_ROUTE_FREEZE_CANDIDATE';
  candidateLabel: string;
  officialSource: typeof STONFI_SDK_SOURCE;
  addresses: {
    athMasterAddress: string;
    buybackBurnAddress: string;
    buybackBurnOfficialAthWalletAddress: string;
    stonfiRouterAddress: string;
    stonfiPoolAddressTonAth: string;
    stonfiAthSourceOwnerAddress: string;
    stonfiAthSourceWalletAddress: string;
    stonfiPtonWalletAddress: string;
    stonfiVaultAddress?: string | null;
    askJettonWalletAddress: string;
  };
  codeHashes: StonfiRouteFreezeCandidateV21['codeHashes'];
  swap: {
    queryId: string;
    deadline: string;
    quoteOutAtomicAth: string;
    dexMinOutAtomicAth: string;
    buybackMinAthOutPer50TonAtomic: string;
  };
  sdkTxParams: {
    source: 'official_stonfi_sdk_or_api';
    sdkPackage: '@ston-fi/sdk';
    sdkVersion: string;
    capturedAt: string;
    to: string;
    valueNanotons: string;
    bodyBocBase64: string;
  };
  liveProofs: StonfiRouteFreezeCandidateV21['liveProofs'] & {
    evidenceRefs?: Record<string, string>;
  };
}

export function createLiveEvidenceInputTemplateM19E(): StonfiLiveEvidenceInputM19E {
  return {
    document: 'PLATHO.V1.STONFI_LIVE_EVIDENCE_INPUT_M19E',
    status: 'TEMPLATE_NOT_FINAL_ROUTE_FREEZE',
    candidateLabel: 'FILL_FROM_OFFICIAL_STONFI_V2_1_SDK_OR_API_TX_SAMPLE',
    officialSource: STONFI_SDK_SOURCE,
    addresses: {
      athMasterAddress: 'EQ... final Platho ATH master address',
      buybackBurnAddress: 'EQ... final BuybackBurn StateInit address',
      buybackBurnOfficialAthWalletAddress: 'EQ... official BuybackBurn ATH wallet address',
      stonfiRouterAddress: 'EQ... selected STON.fi v2.1 router address',
      stonfiPoolAddressTonAth: 'EQ... selected STON.fi TON/ATH pool address',
      stonfiAthSourceOwnerAddress: 'EQ... ATH output source owner whose derived ATHWallet equals askJettonWalletAddress',
      stonfiAthSourceWalletAddress: 'EQ... derived ATH output source wallet address; must equal askJettonWalletAddress',
      stonfiPtonWalletAddress: 'EQ... pTON wallet / proxy address used by selected router route',
      stonfiVaultAddress: null,
      askJettonWalletAddress: 'EQ... router-side ATH jetton wallet address used as ask_jetton_wallet_address',
    },
    codeHashes: {
      athMasterCodeHash: '64 lowercase hex chars',
      athWalletCodeHash: '64 lowercase hex chars',
      stonfiRouterCodeHash: '64 lowercase hex chars',
      stonfiPoolCodeHash: '64 lowercase hex chars',
      stonfiPtonCodeHash: '64 lowercase hex chars',
      stonfiVaultCodeHash: null,
    },
    swap: {
      queryId: 'uint64 decimal string from captured SDK/API tx params',
      deadline: 'uint64 decimal string from captured SDK/API tx params',
      quoteOutAtomicAth: 'live quote output in atomic ATH units',
      dexMinOutAtomicAth: 'min_out used in captured SDK/API tx params',
      buybackMinAthOutPer50TonAtomic: 'pinned circuit-breaker min ATH out for 50 TON',
    },
    sdkTxParams: {
      source: 'official_stonfi_sdk_or_api',
      sdkPackage: '@ston-fi/sdk',
      sdkVersion: '2.7.0 or exact official SDK/API version used',
      capturedAt: 'ISO timestamp / block / tx evidence reference',
      to: 'must equal stonfiPtonWalletAddress',
      valueNanotons: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_TOTAL_STONFI_SEND_VALUE.toString(),
      bodyBocBase64: 'base64 BOC of official SDK/API pTON TON-transfer tx body',
    },
    liveProofs: {
      sdkOrApiTxParamsCaptured: false,
      liveQuoteCaptured: false,
      successExcessesAddressObservedAsBuybackBurn: false,
      minOutFailureRefundObservedAsBuybackBurn: false,
      ptonRefundObservedAsBuybackBurn: false,
      bounceOrFailureBehaviorDocumented: false,
      evidenceRefs: {
        sdkTxParams: 'required: file path / tx hash / capture id',
        liveQuote: 'required: quote source and timestamp/block',
        successExcess: 'required: successful swap tx evidence where excesses return to BuybackBurn',
        minOutFailureRefund: 'required: failed min_out tx evidence where refund returns to BuybackBurn',
        ptonRefund: 'required: pTON refund evidence where refund returns to BuybackBurn',
        bounceOrFailureBehavior: 'required: router/pTON/pool bounce/failure behavior notes and tx evidence',
      },
    },
  };
}

function makeIssue(code: string, message: string) {
  return { code, message };
}

export function collectLiveEvidenceM19E(input: StonfiLiveEvidenceInputM19E) {
  const issues: { code: string; message: string }[] = [];
  let candidate: StonfiRouteFreezeCandidateV21 | null = null;
  let candidateValidation: ReturnType<typeof validateStonfiRouteFreezeCandidateV21> | null = null;
  let decoded: any = null;

  try {
    if (input.document !== 'PLATHO.V1.STONFI_LIVE_EVIDENCE_INPUT_M19E') {
      issues.push(makeIssue('BAD_DOCUMENT_TYPE', 'Input document must be PLATHO.V1.STONFI_LIVE_EVIDENCE_INPUT_M19E'));
    }
    if (input.sdkTxParams?.source !== 'official_stonfi_sdk_or_api') {
      issues.push(makeIssue('BAD_SDK_TX_SOURCE', 'sdkTxParams.source must be official_stonfi_sdk_or_api'));
    }
    if (input.sdkTxParams?.sdkPackage !== '@ston-fi/sdk') {
      issues.push(makeIssue('BAD_SDK_PACKAGE', 'sdkTxParams.sdkPackage must be @ston-fi/sdk'));
    }

    const ptonWallet = parseAddress(input.addresses.stonfiPtonWalletAddress, 'stonfiPtonWalletAddress');
    const txTo = parseAddress(input.sdkTxParams.to, 'sdkTxParams.to');
    if (!txTo.equals(ptonWallet)) {
      issues.push(makeIssue('SDK_TX_TO_NOT_PTON_WALLET', 'Official SDK/API tx params must send the pTON transfer message to the pinned stonfiPtonWalletAddress'));
    }

    const txValue = BigInt(input.sdkTxParams.valueNanotons);
    if (txValue !== PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_TOTAL_STONFI_SEND_VALUE) {
      issues.push(makeIssue('SDK_TX_VALUE_NOT_CONSERVATIVE_TOTAL', 'Official SDK/API tx value must equal Platho conservative total send value 51.05 TON'));
    }

    const ptonBody = cellFromBocBase64(input.sdkTxParams.bodyBocBase64);
    const decodedPton = decodePtonTonTransferBodyV21(ptonBody);
    if (!decodedPton.forwardPayload) {
      issues.push(makeIssue('SDK_TX_BODY_MISSING_FORWARD_PAYLOAD', 'pTON TON-transfer body must carry the STON.fi swap forward payload ref'));
    }

    decoded = {
      sdkTxTo: addressRaw(txTo),
      sdkTxValueNanotons: input.sdkTxParams.valueNanotons,
      ptonTransfer: normalizeDecodedPtonForJson(decodedPton),
      stonfiSwapPayload: decodedPton.forwardPayload ? normalizeDecodedSwapForJson(decodeStonfiSwapBodyV21(decodedPton.forwardPayload)) : null,
    };

    const routeForwardGas = PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_ROUTE_FORWARD_GAS;
    const ptonTransferGas = PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_PTON_TRANSFER_GAS;
    const offerAmount = PLATHO_BUYBACK_STONFI_M19B.BUYBACK_OFFER_AMOUNT;
    candidate = {
      candidateLabel: input.candidateLabel,
      status: input.status === 'FINAL_ROUTE_FREEZE_CANDIDATE' ? 'FINAL_ROUTE_FREEZE_CANDIDATE' : 'DRAFT_NOT_FINAL_ROUTE_FREEZE',
      officialSource: STONFI_SDK_SOURCE,
      addresses: input.addresses,
      codeHashes: input.codeHashes,
      swap: {
        queryId: input.swap.queryId,
        deadline: input.swap.deadline,
        offerAmountNanotons: offerAmount,
        conservativeTotalSendValueNanotons: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_TOTAL_STONFI_SEND_VALUE,
        routeForwardGasNanotons: routeForwardGas,
        ptonTransferGasNanotons: ptonTransferGas,
        quoteOutAtomicAth: input.swap.quoteOutAtomicAth,
        dexMinOutAtomicAth: input.swap.dexMinOutAtomicAth,
        buybackMinAthOutPer50TonAtomic: input.swap.buybackMinAthOutPer50TonAtomic,
      },
      sdkSample: {
        ptonTransferBodyBocBase64: input.sdkTxParams.bodyBocBase64,
        stonfiSwapForwardPayloadBocBase64: decodedPton.forwardPayload ? cellBocBase64(decodedPton.forwardPayload) : '',
      },
      liveProofs: {
        sdkOrApiTxParamsCaptured: input.liveProofs.sdkOrApiTxParamsCaptured,
        liveQuoteCaptured: input.liveProofs.liveQuoteCaptured,
        successExcessesAddressObservedAsBuybackBurn: input.liveProofs.successExcessesAddressObservedAsBuybackBurn,
        minOutFailureRefundObservedAsBuybackBurn: input.liveProofs.minOutFailureRefundObservedAsBuybackBurn,
        ptonRefundObservedAsBuybackBurn: input.liveProofs.ptonRefundObservedAsBuybackBurn,
        bounceOrFailureBehaviorDocumented: input.liveProofs.bounceOrFailureBehaviorDocumented,
      },
    };

    candidateValidation = validateStonfiRouteFreezeCandidateV21(candidate);
    issues.push(...candidateValidation.issues);
  } catch (e: any) {
    issues.push(makeIssue('LIVE_EVIDENCE_COLLECT_FAILED', e?.message ?? String(e)));
  }

  const issueCodes = issues.map((issue) => issue.code);
  return {
    milestone: 'M19E_STONFI_LIVE_SDK_API_EVIDENCE_COLLECTOR',
    generated_at: 'DETERMINISTIC_ARTIFACT',
    route_freeze_ready: issues.length === 0 && candidateValidation?.freezeReady === true,
    issue_codes: issueCodes,
    issues,
    decoded,
    candidate,
    candidate_validation: candidateValidation,
    next_step_when_ready: 'If route_freeze_ready is true, accept v0.19 final route values and implement BuybackBurn against the frozen route profile.',
  };
}

export function createFixtureLiveEvidenceInputM19E(): StonfiLiveEvidenceInputM19E {
  const candidate = createFixtureFinalCandidateM19D();
  return {
    document: 'PLATHO.V1.STONFI_LIVE_EVIDENCE_INPUT_M19E',
    status: 'FINAL_ROUTE_FREEZE_CANDIDATE',
    candidateLabel: 'PLATHO_M19E_FIXTURE_FINAL_ROUTE_CANDIDATE',
    officialSource: STONFI_SDK_SOURCE,
    addresses: Object.fromEntries(Object.entries(candidate.addresses).map(([k, v]) => [k, (v as Address).toString()])) as any,
    codeHashes: candidate.codeHashes,
    swap: {
      queryId: String(candidate.swap.queryId),
      deadline: String(candidate.swap.deadline),
      quoteOutAtomicAth: String(candidate.swap.quoteOutAtomicAth),
      dexMinOutAtomicAth: String(candidate.swap.dexMinOutAtomicAth),
      buybackMinAthOutPer50TonAtomic: String(candidate.swap.buybackMinAthOutPer50TonAtomic),
    },
    sdkTxParams: {
      source: 'official_stonfi_sdk_or_api',
      sdkPackage: '@ston-fi/sdk',
      sdkVersion: STONFI_SDK_SOURCE.version,
      capturedAt: 'DETERMINISTIC_FIXTURE',
      to: (candidate.addresses.stonfiPtonWalletAddress as Address).toString(),
      valueNanotons: String(candidate.swap.conservativeTotalSendValueNanotons),
      bodyBocBase64: candidate.sdkSample.ptonTransferBodyBocBase64,
    },
    liveProofs: {
      ...candidate.liveProofs,
      evidenceRefs: {
        sdkTxParams: 'fixture: official SDK equivalent builder output',
        liveQuote: 'fixture: quote out satisfies 95% rule',
        successExcess: 'fixture: excesses address encoded as BuybackBurn',
        minOutFailureRefund: 'fixture: refund address encoded as BuybackBurn',
        ptonRefund: 'fixture: pTON refund address encoded as BuybackBurn',
        bounceOrFailureBehavior: 'fixture: behavior documented by mock gate',
      },
    },
  };
}

export function writeM19EArtifacts(inputPath?: string) {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });

  const template = createLiveEvidenceInputTemplateM19E();
  writeFileSync(join(ARTIFACTS_DIR, 'stonfi_live_evidence_input_template_m19e.json'), JSON.stringify(template, jsonReplacer, 2) + '\n');

  let suppliedReport: ReturnType<typeof collectLiveEvidenceM19E> | null = null;
  let suppliedSource: string | null = null;
  if (inputPath && existsSync(inputPath)) {
    suppliedSource = inputPath;
    suppliedReport = collectLiveEvidenceM19E(readJson(inputPath));
    if (suppliedReport.candidate) {
      writeFileSync(join(ARTIFACTS_DIR, 'stonfi_route_candidate_from_live_evidence_m19e.json'), JSON.stringify(suppliedReport.candidate, jsonReplacer, 2) + '\n');
    }
  }

  const fixtureInput = createFixtureLiveEvidenceInputM19E();
  const fixtureReport = collectLiveEvidenceM19E(fixtureInput);

  const report = {
    milestone: 'M19E_STONFI_LIVE_SDK_API_EVIDENCE_COLLECTOR',
    status: suppliedReport?.route_freeze_ready ? 'SUPPLIED_LIVE_EVIDENCE_ROUTE_FREEZE_READY' : 'WAITING_FOR_REAL_STONFI_LIVE_EVIDENCE',
    generated_at: 'DETERMINISTIC_ARTIFACT',
    official_source: STONFI_SDK_SOURCE,
    supplied_input_source: suppliedSource,
    route_freeze_ready: suppliedReport?.route_freeze_ready === true,
    template_output: 'artifacts/stonfi_live_evidence_input_template_m19e.json',
    candidate_output_when_supplied: suppliedReport?.candidate ? 'artifacts/stonfi_route_candidate_from_live_evidence_m19e.json' : null,
    required_input: [
      'official @ston-fi/sdk/API pTON TON-transfer tx params body BOC for exact 50 TON -> ATH route',
      'tx params `to` address, which must equal selected pTON wallet/proxy address',
      'tx params `value`, which must equal 51.05 TON conservative route value',
      'live quote output in atomic ATH units',
      'dex_min_out inserted into the official sample',
      'router/pool/pTON code hashes',
      'success excess/refund/pTON-refund/bounce evidence flags backed by tx references',
    ],
    fixture_self_test: {
      route_freeze_ready: fixtureReport.route_freeze_ready,
      issue_codes: fixtureReport.issue_codes,
      decoded: fixtureReport.decoded,
      rebuilt_hashes: fixtureReport.candidate_validation?.rebuiltHashes,
    },
    supplied_report: suppliedReport ? {
      route_freeze_ready: suppliedReport.route_freeze_ready,
      issue_codes: suppliedReport.issue_codes,
      issues: suppliedReport.issues,
      decoded: suppliedReport.decoded,
      rebuilt_hashes: suppliedReport.candidate_validation?.rebuiltHashes,
    } : null,
  };

  writeFileSync(join(ARTIFACTS_DIR, 'stonfi_live_evidence_collector_m19e.json'), JSON.stringify(report, jsonReplacer, 2) + '\n');
  writeFileSync(join(ARTIFACTS_DIR, 'STONFI_ROUTE_FREEZE_READY_M19E.txt'), report.route_freeze_ready ? 'true\n' : 'false\n');
  return report;
}

if (require.main === module) {
  const inputPath = process.argv[2];
  const report = writeM19EArtifacts(inputPath);
  console.log(JSON.stringify({
    status: report.status,
    route_freeze_ready: report.route_freeze_ready,
    supplied_input_source: report.supplied_input_source,
    template_output: report.template_output,
    output: 'artifacts/stonfi_live_evidence_collector_m19e.json',
  }, null, 2));
}
