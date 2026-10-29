import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { toNano } from '@ton/core';
import { PLATHO_BUYBACK_STONFI_M19B } from './stonfi_v2_1_route_lib';

const ARTIFACTS_DIR = join(process.cwd(), 'artifacts');

export const BUYBACKBURN_FUNDING_ENVELOPE_M19H = {
  document: 'PLATHO.V1.BUYBACKBURN_FUNDING_ENVELOPE_M19H',
  status: 'FREEZE_CANDIDATE_NOT_PRODUCTION_BUYBACKBURN',
  productionBuybackBurnImplementationReady: false,
  routeFreezeRequired: true,
  feeAccumulatorIntegrationProfile: 'BUYBACK_TOTAL_FUNDING_ENVELOPE',
  buybackOfferAmountNanotons: PLATHO_BUYBACK_STONFI_M19B.BUYBACK_OFFER_AMOUNT,
  buybackRouteForwardGasNanotons: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_ROUTE_FORWARD_GAS,
  buybackPtonTransferGasNanotons: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_PTON_TRANSFER_GAS,
  buybackTotalStonfiSendValueNanotons: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_TOTAL_STONFI_SEND_VALUE,
  buybackFeeAccumulatorFlushAmountNanotons: PLATHO_BUYBACK_STONFI_M19B.CONSERVATIVE_TOTAL_STONFI_SEND_VALUE,
  noProductionContract: true,
  noRoutePlaceholder: true,
  noFallbackRoute: true,
  noIgnoredErrorSend: true,
} as const;

export function createFundingEnvelopeProfileM19H() {
  const offer = BigInt(BUYBACKBURN_FUNDING_ENVELOPE_M19H.buybackOfferAmountNanotons);
  const forwardGas = BigInt(BUYBACKBURN_FUNDING_ENVELOPE_M19H.buybackRouteForwardGasNanotons);
  const ptonGas = BigInt(BUYBACKBURN_FUNDING_ENVELOPE_M19H.buybackPtonTransferGasNanotons);
  const total = BigInt(BUYBACKBURN_FUNDING_ENVELOPE_M19H.buybackTotalStonfiSendValueNanotons);
  const routeGasTotal = forwardGas + ptonGas;

  return {
    document: BUYBACKBURN_FUNDING_ENVELOPE_M19H.document,
    status: BUYBACKBURN_FUNDING_ENVELOPE_M19H.status,
    productionBuybackBurnImplementationReady: false,
    routeFreezeRequired: true,
    values: {
      buybackOfferAmountNanotons: offer.toString(),
      buybackRouteForwardGasNanotons: forwardGas.toString(),
      buybackPtonTransferGasNanotons: ptonGas.toString(),
      buybackRouteGasTotalNanotons: routeGasTotal.toString(),
      buybackTotalStonfiSendValueNanotons: total.toString(),
      feeAccumulatorFlushAmountNanotons: total.toString(),
      exampleMinimumAccumulatedProtocolFeesForOneBuybackNanotons: (total * 2n).toString(),
    },
    invariants: {
      feeAccumulatorFlushAmountEqualsTotalFunding: true,
      totalFundingEqualsOfferPlusRouteGas: total === offer + routeGasTotal,
      offerAmountRemainsExactly50Ton: offer === toNano('50'),
      routeGasIsNotAthPurchasePrincipal: true,
      excessAndRefundRemainBuybackBurnOwned: true,
    },
    feeAccumulatorRules: [
      'FeeAccumulator.FlushBuybackDue.amount for one buyback envelope MUST be BUYBACK_TOTAL_STONFI_SEND_VALUE, not BUYBACK_OFFER_AMOUNT_TON.',
      'FeeAccumulator.buyback_due_ton MUST be at least BUYBACK_TOTAL_STONFI_SEND_VALUE before one buyback flush is attempted.',
      'If buyback_due_ton is exactly 50 TON, it is insufficient for a conservative 50 TON offer buyback envelope.',
      'The route reserve is protocol-owned execution funding. Any route excess/refund MUST return to BuybackBurn, not executor/user/treasury.',
    ],
    forbidden: [
      'treating FeeAccumulator buyback flush amount 50 TON as enough to fund STON.fi route after M19B conservative gas profile',
      'reducing pTON ton_amount below 50 TON to pay route gas out of the offer principal',
      'routing route excess/refund to executor, user, treasury, or arbitrary sender',
      'production BuybackBurn before STON.fi route freeze',
      'fake route placeholder',
      'ignored-error send mode for money sends',
    ],
  };
}

function main() {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const profile = createFundingEnvelopeProfileM19H();
  writeFileSync(join(ARTIFACTS_DIR, 'buybackburn_funding_envelope_m19h.json'), `${JSON.stringify(profile, null, 2)}\n`);
  writeFileSync(join(ARTIFACTS_DIR, 'BUYBACKBURN_IMPLEMENTATION_READY_M19H.txt'), 'false\n');
  console.log(JSON.stringify({
    ok: true,
    document: profile.document,
    implementationReady: false,
    flushAmountNanotons: profile.values.feeAccumulatorFlushAmountNanotons,
  }, null, 2));
}

if (require.main === module) main();
