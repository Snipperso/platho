import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  addressRaw,
  buildStonfiTonToJettonTxParamsV21,
  cellBocBase64,
  createBuybackRouteNotifyPayload,
  deterministicAddress,
  PLATHO_BUYBACK_STONFI_M19B,
  STONFI_SDK_SOURCE,
  StonfiRouteFreezeCandidateV21,
  validateStonfiRouteFreezeCandidateV21,
} from './stonfi_v2_1_route_lib';

const ARTIFACTS_DIR = join(process.cwd(), 'artifacts');

function jsonReplacer(_key: string, value: unknown) {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

export function createRouteCandidateTemplateM19D() {
  return {
    document: 'PLATHO.V1.STONFI_ROUTE_CANDIDATE_INPUT_M19D',
    status: 'TEMPLATE_NOT_FINAL_ROUTE_FREEZE',
    generated_at: 'DETERMINISTIC_ARTIFACT',
    instructions: [
      'Fill this object from an official STON.fi v2.1 SDK/API-generated TON->ATH tx sample.',
      'Do not hand-type payload BOCs. Copy them from the SDK/API tx params for the selected route.',
      'All refund/excess addresses must be the final BuybackBurn address.',
      'Receiver must be the final official BuybackBurn ATH wallet.',
      'Set status to FINAL_ROUTE_FREEZE_CANDIDATE only after live proof flags are backed by captured transaction evidence.',
    ],
    requiredEvidence: {
      officialSdkOrApiTxParams: 'required: full tx params for 50 TON -> ATH through selected STON.fi v2.1 route',
      liveQuote: 'required: quote output for 50 TON -> ATH, with source and timestamp/lt/hash if available',
      successExcess: 'required: successful swap evidence showing excesses_address returns to BuybackBurn',
      minOutFailureRefund: 'required: min_out failure evidence showing refund returns to BuybackBurn',
      ptonRefund: 'required: pTON refund evidence showing refund returns to BuybackBurn',
      bounceFailureBehavior: 'required: documented sender/body/value behavior for route bounce/failure cases',
      codeHashes: 'required: router, pool, pTON and optional vault code hashes from live chain state or official verified source',
    },
    candidate: {
      candidateLabel: 'REPLACE_WITH_ROUTE_LABEL',
      status: 'DRAFT_NOT_FINAL_ROUTE_FREEZE',
      officialSource: STONFI_SDK_SOURCE,
      addresses: {
        athMasterAddress: 'REPLACE_WITH_FINAL_ATH_MASTER_ADDRESS',
        buybackBurnAddress: 'REPLACE_WITH_FINAL_BUYBACKBURN_ADDRESS',
        buybackBurnOfficialAthWalletAddress: 'REPLACE_WITH_FINAL_BUYBACKBURN_OFFICIAL_ATH_WALLET_ADDRESS',
        stonfiRouterAddress: 'REPLACE_WITH_SELECTED_STONFI_V2_1_ROUTER_ADDRESS',
        stonfiPoolAddressTonAth: 'REPLACE_WITH_SELECTED_TON_ATH_POOL_ADDRESS',
        stonfiAthSourceOwnerAddress: 'REPLACE_WITH_ATH_OUTPUT_SOURCE_OWNER_ADDRESS_FOR_ASK_WALLET',
        stonfiAthSourceWalletAddress: 'REPLACE_WITH_DERIVED_ATH_OUTPUT_SOURCE_WALLET_ADDRESS',
        stonfiPtonWalletAddress: 'REPLACE_WITH_SELECTED_ROUTER_PTON_WALLET_ADDRESS',
        stonfiVaultAddress: null,
        askJettonWalletAddress: 'REPLACE_WITH_ROUTER_ATH_JETTON_WALLET_ADDRESS',
      },
      codeHashes: {
        athMasterCodeHash: '143c2255d9bf3ae853947e45560afeb6ad0a0648361ed2350c714c3e9d6d2328',
        athWalletCodeHash: '7b4b51d5044ddd869d277dd037fd738a4f38696dc47c0960808e6891ca61a7d5',
        stonfiRouterCodeHash: 'REPLACE_WITH_32_BYTE_HEX_ROUTER_CODE_HASH',
        stonfiPoolCodeHash: 'REPLACE_WITH_32_BYTE_HEX_POOL_CODE_HASH',
        stonfiPtonCodeHash: 'REPLACE_WITH_32_BYTE_HEX_PTON_CODE_HASH',
        stonfiVaultCodeHash: null,
      },
      swap: {
        queryId: 'REPLACE_WITH_QUERY_ID_FROM_SDK_SAMPLE',
        deadline: 'REPLACE_WITH_DEADLINE_FROM_SDK_SAMPLE',
        offerAmountNanotons: PLATHO_BUYBACK_STONFI_M19B.BUYBACK_OFFER_AMOUNT.toString(),
        conservativeTotalSendValueNanotons: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_TOTAL_STONFI_SEND_VALUE.toString(),
        routeForwardGasNanotons: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_ROUTE_FORWARD_GAS.toString(),
        ptonTransferGasNanotons: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_PTON_TRANSFER_GAS.toString(),
        quoteOutAtomicAth: 'REPLACE_WITH_LIVE_QUOTE_OUT_ATOMIC_ATH',
        dexMinOutAtomicAth: 'REPLACE_WITH_SELECTED_DEX_MIN_OUT_ATOMIC_ATH',
        buybackMinAthOutPer50TonAtomic: 'REPLACE_WITH_STATIC_BUYBACK_MIN_ATH_OUT_PER_50_TON',
      },
      sdkSample: {
        ptonTransferBodyBocBase64: 'REPLACE_WITH_OFFICIAL_SDK_API_PTON_TRANSFER_BODY_BOC_BASE64',
        stonfiSwapForwardPayloadBocBase64: 'REPLACE_WITH_OFFICIAL_SDK_API_STONFI_SWAP_FORWARD_PAYLOAD_BOC_BASE64',
      },
      liveProofs: {
        sdkOrApiTxParamsCaptured: false,
        liveQuoteCaptured: false,
        successExcessesAddressObservedAsBuybackBurn: false,
        minOutFailureRefundObservedAsBuybackBurn: false,
        ptonRefundObservedAsBuybackBurn: false,
        bounceOrFailureBehaviorDocumented: false,
      },
    },
  };
}

export function createFixtureFinalCandidateM19D(): StonfiRouteFreezeCandidateV21 {
  const addresses = {
    athMasterAddress: deterministicAddress('M19D.fixture.ath.master'),
    buybackBurnAddress: deterministicAddress('M19D.fixture.buybackburn'),
    buybackBurnOfficialAthWalletAddress: deterministicAddress('M19D.fixture.buybackburn.official.ath.wallet'),
    stonfiRouterAddress: deterministicAddress('M19D.fixture.stonfi.router'),
    stonfiPoolAddressTonAth: deterministicAddress('M19D.fixture.stonfi.pool'),
    stonfiAthSourceOwnerAddress: deterministicAddress('M19D.fixture.stonfi.ath.source.owner'),
    stonfiAthSourceWalletAddress: deterministicAddress('M19D.fixture.router.ath.wallet'),
    stonfiPtonWalletAddress: deterministicAddress('M19D.fixture.pton.wallet'),
    askJettonWalletAddress: deterministicAddress('M19D.fixture.router.ath.wallet'),
  };
  const swap = {
    queryId: 0x504c4154484f19d0n,
    deadline: 1_800_500_000n,
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

  return {
    candidateLabel: 'M19D_FIXTURE_FINAL_ROUTE_CANDIDATE',
    status: 'FINAL_ROUTE_FREEZE_CANDIDATE',
    officialSource: STONFI_SDK_SOURCE,
    addresses,
    codeHashes: {
      athMasterCodeHash: '143c2255d9bf3ae853947e45560afeb6ad0a0648361ed2350c714c3e9d6d2328',
      athWalletCodeHash: '7b4b51d5044ddd869d277dd037fd738a4f38696dc47c0960808e6891ca61a7d5',
      stonfiRouterCodeHash: '1'.repeat(64),
      stonfiPoolCodeHash: '2'.repeat(64),
      stonfiPtonCodeHash: '3'.repeat(64),
      stonfiVaultCodeHash: null,
    },
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
}

function reviveCandidateBigints(candidate: any): StonfiRouteFreezeCandidateV21 {
  return candidate as StonfiRouteFreezeCandidateV21;
}

export function validateRouteCandidateInputM19D(input: any) {
  const candidate = reviveCandidateBigints(input?.candidate ?? input);
  try {
    return validateStonfiRouteFreezeCandidateV21(candidate);
  } catch (e: any) {
    return {
      candidateLabel: candidate?.candidateLabel ?? 'UNPARSEABLE_ROUTE_CANDIDATE',
      freezeReady: false,
      issues: [{
        code: 'CANDIDATE_PARSE_FAILED',
        message: e?.message ?? String(e),
      }],
    };
  }
}

function loadInput(path: string) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function writeM19DArtifacts(candidateInputPath?: string) {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });

  const template = createRouteCandidateTemplateM19D();
  writeFileSync(join(ARTIFACTS_DIR, 'stonfi_route_candidate_input_template_m19d.json'), JSON.stringify(template, jsonReplacer, 2) + '\n');

  const fixtureCandidate = createFixtureFinalCandidateM19D();
  const fixtureValidation = validateStonfiRouteFreezeCandidateV21(fixtureCandidate);

  let suppliedValidation = null as any;
  let suppliedCandidateSource = null as string | null;
  if (candidateInputPath && existsSync(candidateInputPath)) {
    suppliedCandidateSource = candidateInputPath;
    suppliedValidation = validateRouteCandidateInputM19D(loadInput(candidateInputPath));
  }

  const report = {
    milestone: 'M19D_STONFI_ROUTE_CANDIDATE_INTAKE_AND_EVIDENCE_TEMPLATE',
    status: suppliedValidation?.freezeReady ? 'SUPPLIED_ROUTE_FREEZE_CANDIDATE_READY' : 'WAITING_FOR_REAL_STONFI_ROUTE_EVIDENCE',
    generated_at: 'DETERMINISTIC_ARTIFACT',
    supplied_candidate_source: suppliedCandidateSource,
    route_freeze_ready: suppliedValidation?.freezeReady === true,
    template_output: 'artifacts/stonfi_route_candidate_input_template_m19d.json',
    required_user_supplied_evidence: template.requiredEvidence,
    fixture_self_test: {
      freeze_ready: fixtureValidation.freezeReady,
      issue_codes: fixtureValidation.issues.map((issue) => issue.code),
      fixture_addresses: Object.fromEntries(Object.entries(fixtureCandidate.addresses).map(([k, v]) => [k, addressRaw(v as any)])),
      rebuilt_hashes: fixtureValidation.rebuiltHashes,
    },
    supplied_validation: suppliedValidation ? {
      freeze_ready: suppliedValidation.freezeReady,
      issue_codes: suppliedValidation.issues.map((issue: any) => issue.code),
      issues: suppliedValidation.issues,
      decoded: suppliedValidation.decoded,
      rebuilt_hashes: suppliedValidation.rebuiltHashes,
    } : null,
    next_step_when_ready: 'If supplied_validation.freeze_ready is true, freeze v0.19 route values and implement BuybackBurn against that exact route profile.',
  };

  writeFileSync(join(ARTIFACTS_DIR, 'stonfi_route_candidate_intake_m19d.json'), JSON.stringify(report, jsonReplacer, 2) + '\n');
  writeFileSync(join(ARTIFACTS_DIR, 'STONFI_ROUTE_FREEZE_READY_M19D.txt'), report.route_freeze_ready ? 'true\n' : 'false\n');

  return report;
}

if (require.main === module) {
  const candidateInputPath = process.argv[2];
  const report = writeM19DArtifacts(candidateInputPath);
  console.log(JSON.stringify({
    status: report.status,
    route_freeze_ready: report.route_freeze_ready,
    supplied_candidate_source: report.supplied_candidate_source,
    template_output: report.template_output,
    output: 'artifacts/stonfi_route_candidate_intake_m19d.json',
  }, null, 2));
}
