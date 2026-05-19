# Platho v1 Open Values v0.19D — STON.fi Route Candidate Intake

**Status:** accepted tooling profile, not final route freeze  
**Scope:** candidate intake, evidence template, and freeze gate packaging for the selected STON.fi v2.1 TON -> ATH route.

This profile does not unblock production BuybackBurn by itself.

Production BuybackBurn remains blocked until a real candidate passes `validateStonfiRouteFreezeCandidateV21` with:

```text
route_freeze_ready = true
```

## Candidate input

The canonical input template is:

```text
artifacts/stonfi_route_candidate_input_template_m19d.json
```

The template MUST be filled from official STON.fi v2.1 SDK/API tx params for the selected 50 TON -> ATH route.

Payload BOCs MUST NOT be hand-typed.

## Required live evidence

```text
sdkOrApiTxParamsCaptured = true
liveQuoteCaptured = true
successExcessesAddressObservedAsBuybackBurn = true
minOutFailureRefundObservedAsBuybackBurn = true
ptonRefundObservedAsBuybackBurn = true
bounceOrFailureBehaviorDocumented = true
```

## Required semantic invariants

```text
pTON ton_amount == 50 TON
pTON refund_address == BuybackBurn
STON.fi swap refund_address == BuybackBurn
STON.fi swap excesses_address == BuybackBurn
STON.fi receiver_address == BuybackBurn official ATH wallet
STON.fi min_ask_amount == dex_min_out
manual builder body hash == official SDK/API pTON body hash
manual builder swap payload hash == official SDK/API swap payload hash
dex_min_out >= BUYBACK_MIN_ATH_OUT_PER_50_TON
dex_min_out >= floor(live_quote_out * 0.95)
```

## Status

```text
STONFI_ROUTE_FREEZE_READY_M19D = false unless a real supplied candidate passes the gate
BUYBACKBURN_IMPLEMENTATION_READY = false until route freeze is true
```
