import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  addressRaw,
  buildStonfiTonToJettonTxParamsV21,
  cellBocBase64,
  createBuybackRouteNotifyPayload,
  deterministicAddress,
  PLATHO_BUYBACK_STONFI_M19B,
  STONFI_SDK_SOURCE,
  STONFI_V2_1,
  StonfiRouteFreezeCandidateV21,
  validateStonfiRouteFreezeCandidateV21,
} from './stonfi_v2_1_route_lib';

const ARTIFACTS_DIR = join(process.cwd(), 'artifacts');

const fixture = {
  athMasterAddress: deterministicAddress('PLATHO.M19C.fixture.ath.master'),
  buybackBurnAddress: deterministicAddress('PLATHO.M19C.fixture.buybackburn'),
  buybackBurnOfficialAthWalletAddress: deterministicAddress('PLATHO.M19C.fixture.buybackburn.official.ath.wallet'),
  stonfiRouterAddress: deterministicAddress('PLATHO.M19C.fixture.stonfi.router.v2_1'),
  stonfiPoolAddressTonAth: deterministicAddress('PLATHO.M19C.fixture.stonfi.pool.ton-ath'),
  stonfiAthSourceOwnerAddress: deterministicAddress('PLATHO.M19C.fixture.stonfi.ath.source.owner'),
  stonfiAthSourceWalletAddress: deterministicAddress('PLATHO.M19C.fixture.router.ath.wallet'),
  stonfiPtonWalletAddress: deterministicAddress('PLATHO.M19C.fixture.pton.wallet'),
  askJettonWalletAddress: deterministicAddress('PLATHO.M19C.fixture.router.ath.wallet'),
};

const queryId = 0x504c4154484f19c0n;
const deadline = 1_800_300_000n;
const quoteOutAtomicAth = 1_000_000_000_000_000n;
const dexMinOutAtomicAth = 950_000_000_000_000n;
const buybackMinAthOutPer50TonAtomic = 900_000_000_000_000n;

const fixtureTx = buildStonfiTonToJettonTxParamsV21({
  queryId,
  offerAmount: PLATHO_BUYBACK_STONFI_M19B.BUYBACK_OFFER_AMOUNT,
  minAskAmount: dexMinOutAtomicAth,
  routerAddress: fixture.stonfiRouterAddress,
  ptonWalletAddress: fixture.stonfiPtonWalletAddress,
  askJettonWalletAddress: fixture.askJettonWalletAddress,
  receiverAddress: fixture.buybackBurnOfficialAthWalletAddress,
  refundAddress: fixture.buybackBurnAddress,
  excessesAddress: fixture.buybackBurnAddress,
  deadline,
  forwardGasAmount: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_ROUTE_FORWARD_GAS,
  dexCustomPayloadForwardGasAmount: PLATHO_BUYBACK_STONFI_M19B.ROUTE_ATH_NOTIFY_FORWARD_GAS,
  dexCustomPayload: createBuybackRouteNotifyPayload(queryId),
  ptonTonTransferGas: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_PTON_TRANSFER_GAS,
});

const draftCandidate: StonfiRouteFreezeCandidateV21 = {
  candidateLabel: 'PLATHO_M19C_DRAFT_ROUTE_NOT_FINAL',
  status: 'DRAFT_NOT_FINAL_ROUTE_FREEZE',
  officialSource: STONFI_SDK_SOURCE,
  addresses: {
    ...fixture,
  },
  codeHashes: {
    athMasterCodeHash: '143c2255d9bf3ae853947e45560afeb6ad0a0648361ed2350c714c3e9d6d2328',
    athWalletCodeHash: '7b4b51d5044ddd869d277dd037fd738a4f38696dc47c0960808e6891ca61a7d5',
    stonfiRouterCodeHash: '0'.repeat(64),
    stonfiPoolCodeHash: '0'.repeat(64),
    stonfiPtonCodeHash: '0'.repeat(64),
    stonfiVaultCodeHash: null,
  },
  swap: {
    queryId,
    deadline,
    offerAmountNanotons: PLATHO_BUYBACK_STONFI_M19B.BUYBACK_OFFER_AMOUNT,
    conservativeTotalSendValueNanotons: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_TOTAL_STONFI_SEND_VALUE,
    routeForwardGasNanotons: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_ROUTE_FORWARD_GAS,
    ptonTransferGasNanotons: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_PTON_TRANSFER_GAS,
    quoteOutAtomicAth,
    dexMinOutAtomicAth,
    buybackMinAthOutPer50TonAtomic,
  },
  sdkSample: {
    ptonTransferBodyBocBase64: cellBocBase64(fixtureTx.body),
    stonfiSwapForwardPayloadBocBase64: cellBocBase64(fixtureTx.forwardPayload),
  },
  liveProofs: {
    sdkOrApiTxParamsCaptured: false,
    liveQuoteCaptured: false,
    successExcessesAddressObservedAsBuybackBurn: false,
    minOutFailureRefundObservedAsBuybackBurn: false,
    ptonRefundObservedAsBuybackBurn: false,
    bounceOrFailureBehaviorDocumented: false,
  },
};

const draftValidation = validateStonfiRouteFreezeCandidateV21(draftCandidate);

const report = {
  milestone: 'M19C_STONFI_ROUTE_FREEZE_GATE_LIVE_SAMPLE_HARNESS',
  status: 'ROUTE_FREEZE_BLOCKED_UNTIL_REAL_VALUES_AND_LIVE_PROOFS',
  generated_at: 'DETERMINISTIC_ARTIFACT',
  official_source: STONFI_SDK_SOURCE,
  freeze_gate: {
    requires_status: 'FINAL_ROUTE_FREEZE_CANDIDATE',
    requires_sdk_sample_match: true,
    requires_live_quote: true,
    requires_live_refund_excess_proofs: true,
    requires_code_hash_identity: true,
    required_success_signal: 'ATH receipt by official BuybackBurn ATH wallet, then ATHBurnFinalized from ATH Master',
    forbidden_success_signal: 'router/pool payload claim without ATH receipt and burn finalization',
  },
  candidate_fixture_addresses: Object.fromEntries(Object.entries(fixture).map(([k, v]) => [k, addressRaw(v)])),
  current_draft_candidate_validation: {
    freeze_ready: draftValidation.freezeReady,
    issue_codes: draftValidation.issues.map((issue) => issue.code),
    issues: draftValidation.issues,
    rebuilt_hashes: draftValidation.rebuiltHashes,
    decoded: draftValidation.decoded,
  },
  required_before_final_route_freeze: [
    'ATH_MASTER_ADDRESS final deployment address',
    'BuybackBurn final StateInit address',
    'BuybackBurn official ATH wallet final address',
    'STONFI_ROUTER_ADDRESS selected production v2.1 router address',
    'STONFI_POOL_ADDRESS_TON_ATH selected production TON/ATH pool address',
    'STONFI_PTON_ADDRESS / router pTON wallet address for selected router',
    'STONFI_VAULT_ADDRESS and code hash if selected route uses a vault',
    'Router/pool/pTON code hashes from live chain state or official source',
    'BUYBACK_MIN_ATH_OUT_PER_50_TON from liquidity/route tests',
    'Official SDK/API generated tx params for real 50 TON -> ATH route',
    'Manual payload builder hash equals official SDK/API pTON body hash',
    'Manual swap forward payload hash equals official SDK/API forward payload hash',
    'Live quote proof for selected route',
    'Successful swap excesses_address proof returns to BuybackBurn',
    'min_out failure refund proof returns to BuybackBurn',
    'pTON refund proof returns to BuybackBurn',
    'Bounce/failure behavior documented for selected route',
  ],
  constants: {
    pton_op_ton_transfer: `0x${STONFI_V2_1.PTON_OP_TON_TRANSFER.toString(16).padStart(8, '0')}`,
    dex_op_swap: `0x${STONFI_V2_1.DEX_OP_SWAP.toString(16).padStart(8, '0')}`,
    buyback_offer_amount_nanotons: PLATHO_BUYBACK_STONFI_M19B.BUYBACK_OFFER_AMOUNT.toString(),
    conservative_total_send_value_nanotons: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_TOTAL_STONFI_SEND_VALUE.toString(),
  },
  route_freeze_ready: false,
};

mkdirSync(ARTIFACTS_DIR, { recursive: true });
writeFileSync(join(ARTIFACTS_DIR, 'stonfi_route_freeze_gate_m19c.json'), JSON.stringify(report, null, 2) + '\n');
writeFileSync(join(ARTIFACTS_DIR, 'STONFI_ROUTE_FREEZE_READY_M19C.txt'), 'false\n');

console.log(JSON.stringify({
  status: report.status,
  route_freeze_ready: report.route_freeze_ready,
  issue_codes: report.current_draft_candidate_validation.issue_codes,
  output: 'artifacts/stonfi_route_freeze_gate_m19c.json',
}, null, 2));
