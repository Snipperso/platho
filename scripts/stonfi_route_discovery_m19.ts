import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { toNano } from '@ton/core';
import {
  buildStonfiTonToJettonTxParamsV21,
  cellBocBase64,
  cellHashHex,
  decodePtonTonTransferBodyV21,
  decodeStonfiSwapBodyV21,
  deterministicAddress,
  normalizeDecodedPtonForJson,
  normalizeDecodedSwapForJson,
  STONFI_SDK_SOURCE,
  STONFI_V2_1,
  addressRaw,
} from './stonfi_v2_1_route_lib';

const ARTIFACTS_DIR = join(process.cwd(), 'artifacts');

const fixture = {
  routerAddress: deterministicAddress('PLATHO.M19.fixture.stonfi.router.v2_1'),
  ptonWalletAddress: deterministicAddress('PLATHO.M19.fixture.pton.wallet.for.router'),
  askJettonWalletAddress: deterministicAddress('PLATHO.M19.fixture.ath.wallet.of.router'),
  buybackBurnAddress: deterministicAddress('PLATHO.M19.fixture.buybackburn'),
  buybackBurnAthWalletAddress: deterministicAddress('PLATHO.M19.fixture.buybackburn.ath.wallet'),
};

const offerAmount = toNano('50');
const minAskAmount = 123_456_789_000_000n;
const queryId = 0x504c4154484f0019n; // "PLATHO" + M19 marker, purely a deterministic test vector id.
const deadline = 1_800_000_000n;

const tx = buildStonfiTonToJettonTxParamsV21({
  queryId,
  offerAmount,
  minAskAmount,
  routerAddress: fixture.routerAddress,
  ptonWalletAddress: fixture.ptonWalletAddress,
  askJettonWalletAddress: fixture.askJettonWalletAddress,
  receiverAddress: fixture.buybackBurnAddress,
  refundAddress: fixture.buybackBurnAddress,
  excessesAddress: fixture.buybackBurnAddress,
  deadline,
});

const decodedPton = decodePtonTonTransferBodyV21(tx.body);
const decodedSwap = decodeStonfiSwapBodyV21(tx.forwardPayload);

const unresolvedFinalValues = [
  'ATH_MASTER_ADDRESS final deployment address',
  'STONFI_ROUTER_ADDRESS selected production v2 router address',
  'STONFI_POOL_ADDRESS_TON_ATH selected TON/ATH pool address',
  'STONFI_PTON_ADDRESS / pTON wallet route address for selected router',
  'STONFI_VAULT_ADDRESS if selected route requires it',
  'STONFI_FORWARD_GAS_REQUIREMENTS validated against selected route and live tx simulation',
  'BUYBACK_MIN_ATH_OUT_PER_50_TON from liquidity/route tests',
  'raw official SDK/API-generated tx sample for real 50 TON -> ATH route',
  'swap/refund/bounce behavior from selected STON.fi route sample transactions',
];

const report = {
  milestone: 'M19A_STONFI_ROUTE_DISCOVERY_DRAFT',
  status: 'DRAFT_NOT_FINAL_ROUTE_FREEZE',
  generated_at: 'DETERMINISTIC_ARTIFACT',
  official_source: {
    ...STONFI_SDK_SOURCE,
    notes: [
      '@ston-fi/sdk@2.7.0 was inspected from the official npm package tarball.',
      'The exact TON->jetton path is BaseRouterV2_1.getSwapTonToJettonTxParams + PtonV2_1.getTonTransferTxParams.',
      'This artifact records the SDK-equivalent layout; it does not claim final production route addresses.',
    ],
  },
  sdk_v2_1_constants: {
    DEX_OP_SWAP: `0x${STONFI_V2_1.DEX_OP_SWAP.toString(16).padStart(8, '0')}`,
    PTON_OP_TON_TRANSFER: `0x${STONFI_V2_1.PTON_OP_TON_TRANSFER.toString(16).padStart(8, '0')}`,
    BASE_ROUTER_SWAP_TON_TO_JETTON_FORWARD_GAS_NANOTONS: STONFI_V2_1.BASE_ROUTER_SWAP_TON_TO_JETTON_FORWARD_GAS.toString(),
    PTON_TON_TRANSFER_GAS_NANOTONS: STONFI_V2_1.PTON_TON_TRANSFER_GAS.toString(),
    DEFAULT_REFERRAL_VALUE_BPS: STONFI_V2_1.DEFAULT_REFERRAL_VALUE_BPS.toString(),
  },
  fixture_route_vector: {
    query_id: queryId.toString(),
    offer_amount_nanotons: offerAmount.toString(),
    min_ask_amount_atomic_ath: minAskAmount.toString(),
    deadline: deadline.toString(),
    addresses: Object.fromEntries(Object.entries(fixture).map(([k, v]) => [k, addressRaw(v)])),
    tx_params: {
      to: addressRaw(tx.to),
      value_nanotons: tx.value.toString(),
      pton_transfer_body_hash: cellHashHex(tx.body),
      pton_transfer_body_boc_base64: cellBocBase64(tx.body),
      stonfi_swap_forward_payload_hash: cellHashHex(tx.forwardPayload),
      stonfi_swap_forward_payload_boc_base64: cellBocBase64(tx.forwardPayload),
    },
    decoded_pton_transfer: normalizeDecodedPtonForJson(decodedPton),
    decoded_stonfi_swap_payload: normalizeDecodedSwapForJson(decodedSwap),
  },
  buybackburn_implications: {
    buyback_chunk_ton_nanotons: offerAmount.toString(),
    buybackburn_must_send_to: 'selected pTON/router wallet address returned by STON.fi v2.1 pTON getWalletAddress(router)',
    total_value_formula: 'offerAmount + routerForwardGasAmount + pTONTonTransferGas',
    default_total_value_for_50_ton_with_sdk_defaults_nanotons: (offerAmount + STONFI_V2_1.BASE_ROUTER_SWAP_TON_TO_JETTON_FORWARD_GAS + STONFI_V2_1.PTON_TON_TRANSFER_GAS).toString(),
    ask_min_amount_field: 'STON.fi swap details ref field #1: minAskAmount coins',
    success_signal_for_platho: 'not router claim; BuybackBurn must accept ATH only from its official ATH wallet, then burn and clear after ATHBurnFinalized from ATH Master',
  },
  unresolved_final_values: unresolvedFinalValues,
  route_freeze_ready: false,
};

mkdirSync(ARTIFACTS_DIR, { recursive: true });
writeFileSync(join(ARTIFACTS_DIR, 'stonfi_route_probe_m19.json'), JSON.stringify(report, null, 2) + '\n');
writeFileSync(join(ARTIFACTS_DIR, 'STONFI_ROUTE_FREEZE_READY_M19.txt'), 'false\n');

console.log(JSON.stringify({
  status: report.status,
  route_freeze_ready: report.route_freeze_ready,
  swap_op: report.sdk_v2_1_constants.DEX_OP_SWAP,
  pton_op: report.sdk_v2_1_constants.PTON_OP_TON_TRANSFER,
  value_nanotons: report.fixture_route_vector.tx_params.value_nanotons,
  output: 'artifacts/stonfi_route_probe_m19.json',
}, null, 2));
