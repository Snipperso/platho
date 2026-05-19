import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  addressRaw,
  buildStonfiTonToJettonTxParamsV21,
  cellBocBase64,
  cellHashHex,
  decodePtonTonTransferBodyV21,
  decodeStonfiSwapBodyV21,
  deterministicAddress,
  normalizeDecodedPtonForJson,
  normalizeDecodedSwapForJson,
  PLATHO_BUYBACK_STONFI_M19B,
  STONFI_SDK_SOURCE,
  STONFI_V2_1,
  validateConservativeBuybackRouteProfile,
} from './stonfi_v2_1_route_lib';

const ARTIFACTS_DIR = join(process.cwd(), 'artifacts');

const fixture = {
  routerAddress: deterministicAddress('PLATHO.M19B.fixture.stonfi.router.v2_1'),
  ptonWalletAddress: deterministicAddress('PLATHO.M19B.fixture.pton.wallet.for.router'),
  askJettonWalletAddress: deterministicAddress('PLATHO.M19B.fixture.ath.wallet.of.router'),
  buybackBurnAddress: deterministicAddress('PLATHO.M19B.fixture.buybackburn'),
};

const minAskAmount = 223_456_789_000_000n;
const queryId = 0x504c4154484f19b1n;
const deadline = 1_800_200_000n;

validateConservativeBuybackRouteProfile({
  buybackBurnAddress: fixture.buybackBurnAddress,
  refundAddress: fixture.buybackBurnAddress,
  excessesAddress: fixture.buybackBurnAddress,
  offerAmount: PLATHO_BUYBACK_STONFI_M19B.BUYBACK_OFFER_AMOUNT,
  routeForwardGas: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_ROUTE_FORWARD_GAS,
  ptonTransferGas: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_PTON_TRANSFER_GAS,
});

const defaultTx = buildStonfiTonToJettonTxParamsV21({
  queryId,
  offerAmount: PLATHO_BUYBACK_STONFI_M19B.BUYBACK_OFFER_AMOUNT,
  minAskAmount,
  routerAddress: fixture.routerAddress,
  ptonWalletAddress: fixture.ptonWalletAddress,
  askJettonWalletAddress: fixture.askJettonWalletAddress,
  receiverAddress: fixture.buybackBurnAddress,
  refundAddress: fixture.buybackBurnAddress,
  excessesAddress: fixture.buybackBurnAddress,
  deadline,
});

const conservativeTx = buildStonfiTonToJettonTxParamsV21({
  queryId,
  offerAmount: PLATHO_BUYBACK_STONFI_M19B.BUYBACK_OFFER_AMOUNT,
  minAskAmount,
  routerAddress: fixture.routerAddress,
  ptonWalletAddress: fixture.ptonWalletAddress,
  askJettonWalletAddress: fixture.askJettonWalletAddress,
  receiverAddress: fixture.buybackBurnAddress,
  refundAddress: fixture.buybackBurnAddress,
  excessesAddress: fixture.buybackBurnAddress,
  deadline,
  forwardGasAmount: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_ROUTE_FORWARD_GAS,
  ptonTonTransferGas: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_PTON_TRANSFER_GAS,
});

const decodedPton = decodePtonTonTransferBodyV21(conservativeTx.body);
const decodedSwap = decodeStonfiSwapBodyV21(conservativeTx.forwardPayload);

const report = {
  milestone: 'M19B_STONFI_CONSERVATIVE_GAS_EXCESS_PROFILE',
  status: 'DRAFT_NOT_FINAL_ROUTE_FREEZE',
  generated_at: 'DETERMINISTIC_ARTIFACT',
  official_source: {
    ...STONFI_SDK_SOURCE,
    notes: [
      '@ston-fi/sdk@2.7.0 was inspected from the official npm package tarball in M19A.',
      'M19B does not change the SDK-derived cell payload layout.',
      'M19B only overfunds message value for immutable-route safety and requires all refund/excess addresses to be BuybackBurn.',
    ],
  },
  conservative_profile: {
    buyback_offer_amount_nanotons: PLATHO_BUYBACK_STONFI_M19B.BUYBACK_OFFER_AMOUNT.toString(),
    sdk_default_router_forward_gas_nanotons: STONFI_V2_1.BASE_ROUTER_SWAP_TON_TO_JETTON_FORWARD_GAS.toString(),
    sdk_default_pton_transfer_gas_nanotons: STONFI_V2_1.PTON_TON_TRANSFER_GAS.toString(),
    conservative_route_forward_gas_nanotons: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_ROUTE_FORWARD_GAS.toString(),
    conservative_pton_transfer_gas_nanotons: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_PTON_TRANSFER_GAS.toString(),
    conservative_total_stonfi_send_value_nanotons: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_TOTAL_STONFI_SEND_VALUE.toString(),
    formula: '50 TON offer + 1.00 TON route forward gas + 0.05 TON pTON transfer gas = 51.05 TON',
    refund_address_rule: 'refund_address MUST be BuybackBurn',
    excesses_address_rule: 'excesses_address MUST be BuybackBurn',
    pton_refund_address_rule: 'pTON ton-transfer refund_address MUST be BuybackBurn',
    success_signal: 'ATH receipt by official BuybackBurn ATH wallet followed by ATHBurnFinalized from ATH Master; never a router claim',
  },
  fixture_route_vector: {
    query_id: queryId.toString(),
    deadline: deadline.toString(),
    min_ask_amount_atomic_ath: minAskAmount.toString(),
    addresses: Object.fromEntries(Object.entries(fixture).map(([k, v]) => [k, addressRaw(v)])),
    sdk_default_total_value_nanotons: defaultTx.value.toString(),
    conservative_total_value_nanotons: conservativeTx.value.toString(),
    payload_identity_unchanged_by_overfunding: {
      pton_transfer_body_hash_default: cellHashHex(defaultTx.body),
      pton_transfer_body_hash_conservative: cellHashHex(conservativeTx.body),
      stonfi_swap_forward_payload_hash_default: cellHashHex(defaultTx.forwardPayload),
      stonfi_swap_forward_payload_hash_conservative: cellHashHex(conservativeTx.forwardPayload),
      hashes_match: cellHashHex(defaultTx.body) === cellHashHex(conservativeTx.body) && cellHashHex(defaultTx.forwardPayload) === cellHashHex(conservativeTx.forwardPayload),
    },
    conservative_tx_params: {
      to: addressRaw(conservativeTx.to),
      value_nanotons: conservativeTx.value.toString(),
      pton_transfer_body_hash: cellHashHex(conservativeTx.body),
      pton_transfer_body_boc_base64: cellBocBase64(conservativeTx.body),
      stonfi_swap_forward_payload_hash: cellHashHex(conservativeTx.forwardPayload),
      stonfi_swap_forward_payload_boc_base64: cellBocBase64(conservativeTx.forwardPayload),
    },
    decoded_pton_transfer: normalizeDecodedPtonForJson(decodedPton),
    decoded_stonfi_swap_payload: normalizeDecodedSwapForJson(decodedSwap),
  },
  unresolved_final_values: [
    'ATH_MASTER_ADDRESS final deployment address',
    'STONFI_ROUTER_ADDRESS selected production v2 router address',
    'STONFI_POOL_ADDRESS_TON_ATH selected TON/ATH pool address',
    'STONFI_PTON_ADDRESS / pTON wallet route address for selected router',
    'STONFI_VAULT_ADDRESS if selected route requires it',
    'BUYBACK_MIN_ATH_OUT_PER_50_TON from liquidity/route tests',
    'live-route proof that overfunded excess/refund returns to BuybackBurn',
  ],
  route_freeze_ready: false,
};

mkdirSync(ARTIFACTS_DIR, { recursive: true });
writeFileSync(join(ARTIFACTS_DIR, 'stonfi_conservative_gas_profile_m19b.json'), JSON.stringify(report, null, 2) + '\n');
writeFileSync(join(ARTIFACTS_DIR, 'STONFI_ROUTE_FREEZE_READY_M19B.txt'), 'false\n');

console.log(JSON.stringify({
  status: report.status,
  route_freeze_ready: report.route_freeze_ready,
  conservative_total_value_nanotons: conservativeTx.value.toString(),
  payload_hashes_match: report.fixture_route_vector.payload_identity_unchanged_by_overfunding.hashes_match,
  output: 'artifacts/stonfi_conservative_gas_profile_m19b.json',
}, null, 2));
