# M20T Scaled BuybackBurn Harness

Status: SCALED_HARNESS_ONLY_NOT_PRODUCTION_ENVELOPE

This is a scaled testnet/local harness profile only. It does not implement production BuybackBurn, does not change FeeAccumulator, and does not unlock final genesis.

## Values

```text
scaleDivisor=100
scaledOfferAmountNanotons=500000000
scaledRouteForwardGasNanotons=10000000
scaledPtonTransferGasNanotons=500000
scaledTotalFundingEnvelopeNanotons=510500000
scaledAccumulatedFeesForOneEnvelopeNanotons=1021000000
```

## Production Guardrail

```text
productionTotalFundingEnvelopeNanotons=51050000000
production FeeAccumulator must continue rejecting 0.5105 TON buyback flush amounts
```

## Final Statement

M20T scaled harness evidence is NOT mainnet route freeze evidence and does not unlock production BuybackBurn.
