import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { toNano } from '@ton/core';
import { createFundingEnvelopeProfileM19H } from './buybackburn_funding_envelope_m19h';

const ARTIFACTS_DIR = join(process.cwd(), 'artifacts');

export const M20T_SCALED_BUYBACKBURN_HARNESS = {
  document: 'PLATHO.V1.M20T_SCALED_BUYBACKBURN_HARNESS',
  status: 'SCALED_HARNESS_ONLY_NOT_PRODUCTION_ENVELOPE',
  scaleDivisor: 100n,
  notMainnetRouteFreeze: true,
  notProductionBuybackBurnUnlock: true,
  doesNotChangeProductionFeeAccumulator: true,
  productionFlagsRemainFalse: true,
} as const;

function dec(value: bigint): string {
  return value.toString();
}

export function createScaledBuybackBurnHarnessM20T() {
  const production = createFundingEnvelopeProfileM19H();
  const scaleDivisor = M20T_SCALED_BUYBACKBURN_HARNESS.scaleDivisor;

  const productionOffer = BigInt(production.values.buybackOfferAmountNanotons);
  const productionForwardGas = BigInt(production.values.buybackRouteForwardGasNanotons);
  const productionPtonGas = BigInt(production.values.buybackPtonTransferGasNanotons);
  const productionTotal = BigInt(production.values.feeAccumulatorFlushAmountNanotons);

  const scaledOffer = productionOffer / scaleDivisor;
  const scaledForwardGas = productionForwardGas / scaleDivisor;
  const scaledPtonGas = productionPtonGas / scaleDivisor;
  const scaledTotal = scaledOffer + scaledForwardGas + scaledPtonGas;
  const scaledAccumulatedFeesForOneEnvelope = scaledTotal * 2n;

  return {
    document: M20T_SCALED_BUYBACKBURN_HARNESS.document,
    status: M20T_SCALED_BUYBACKBURN_HARNESS.status,
    scaleDivisor: scaleDivisor.toString(),
    notMainnetRouteFreeze: M20T_SCALED_BUYBACKBURN_HARNESS.notMainnetRouteFreeze,
    notProductionBuybackBurnUnlock: M20T_SCALED_BUYBACKBURN_HARNESS.notProductionBuybackBurnUnlock,
    doesNotChangeProductionFeeAccumulator: M20T_SCALED_BUYBACKBURN_HARNESS.doesNotChangeProductionFeeAccumulator,
    productionFlagsRemainFalse: M20T_SCALED_BUYBACKBURN_HARNESS.productionFlagsRemainFalse,
    values: {
      productionOfferAmountNanotons: dec(productionOffer),
      productionRouteForwardGasNanotons: dec(productionForwardGas),
      productionPtonTransferGasNanotons: dec(productionPtonGas),
      productionTotalFundingEnvelopeNanotons: dec(productionTotal),
      scaledOfferAmountNanotons: dec(scaledOffer),
      scaledRouteForwardGasNanotons: dec(scaledForwardGas),
      scaledPtonTransferGasNanotons: dec(scaledPtonGas),
      scaledTotalFundingEnvelopeNanotons: dec(scaledTotal),
      scaledAccumulatedFeesForOneEnvelopeNanotons: dec(scaledAccumulatedFeesForOneEnvelope),
    },
    invariants: {
      scaledTotalEqualsOfferPlusRouteGas: scaledTotal === scaledOffer + scaledForwardGas + scaledPtonGas,
      scaledTotalIsExactly05105Ton: scaledTotal === toNano('0.5105'),
      scaledOfferIsExactly05Ton: scaledOffer === toNano('0.5'),
      scaledRouteFundingIsExactly00105Ton: scaledForwardGas + scaledPtonGas === toNano('0.0105'),
      scaledAccumulatedFeesSplitWouldProduceOneEnvelope: scaledAccumulatedFeesForOneEnvelope / 2n === scaledTotal,
      productionEnvelopeRemains5105Ton: productionTotal === toNano('51.05'),
    },
    forbiddenClaims: [
      'M20T scaled harness unlocks production BuybackBurn',
      'M20T scaled harness is mainnet STON.fi route freeze evidence',
      'production FeeAccumulator accepts 0.5105 TON buyback flush',
      'production 51.05 TON envelope can be reduced for final genesis',
    ],
    nextLiveStep: {
      minimumUsefulTopUpNanotons: toNano('1').toString(),
      addressSource: '.env.testnet.local PLATHO_TESTNET_DEPLOYER_ADDRESS',
      expectedLiveStatusWithoutFunding: 'NEED_TESTNET_TON',
    },
  };
}

function renderMarkdown(profile: ReturnType<typeof createScaledBuybackBurnHarnessM20T>): string {
  return [
    '# M20T Scaled BuybackBurn Harness',
    '',
    `Status: ${profile.status}`,
    '',
    'This is a scaled testnet/local harness profile only. It does not implement production BuybackBurn, does not change FeeAccumulator, and does not unlock final genesis.',
    '',
    '## Values',
    '',
    '```text',
    `scaleDivisor=${profile.scaleDivisor}`,
    `scaledOfferAmountNanotons=${profile.values.scaledOfferAmountNanotons}`,
    `scaledRouteForwardGasNanotons=${profile.values.scaledRouteForwardGasNanotons}`,
    `scaledPtonTransferGasNanotons=${profile.values.scaledPtonTransferGasNanotons}`,
    `scaledTotalFundingEnvelopeNanotons=${profile.values.scaledTotalFundingEnvelopeNanotons}`,
    `scaledAccumulatedFeesForOneEnvelopeNanotons=${profile.values.scaledAccumulatedFeesForOneEnvelopeNanotons}`,
    '```',
    '',
    '## Production Guardrail',
    '',
    '```text',
    `productionTotalFundingEnvelopeNanotons=${profile.values.productionTotalFundingEnvelopeNanotons}`,
    'production FeeAccumulator must continue rejecting 0.5105 TON buyback flush amounts',
    '```',
    '',
    '## Final Statement',
    '',
    'M20T scaled harness evidence is NOT mainnet route freeze evidence and does not unlock production BuybackBurn.',
    '',
  ].join('\n');
}

function main() {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const profile = createScaledBuybackBurnHarnessM20T();
  writeFileSync(join(ARTIFACTS_DIR, 'm20t_scaled_buybackburn_harness.json'), `${JSON.stringify(profile, null, 2)}\n`);
  writeFileSync(join(ARTIFACTS_DIR, 'M20T_SCALED_BUYBACKBURN_HARNESS.md'), renderMarkdown(profile));
  writeFileSync(join(ARTIFACTS_DIR, 'M20T_SCALED_HARNESS_STATUS.txt'), `${profile.status}\n`);
  console.log(JSON.stringify({
    ok: true,
    document: profile.document,
    status: profile.status,
    scaledTotalFundingEnvelopeNanotons: profile.values.scaledTotalFundingEnvelopeNanotons,
    productionUnlock: false,
  }, null, 2));
}

if (require.main === module) main();
