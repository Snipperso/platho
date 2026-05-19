# Platho v1 Open Values Addendum v0.19E — STON.fi Live Evidence Collector

**Status:** freeze-candidate tooling profile, not a final route freeze.  
**Scope:** STON.fi v2.1 route evidence intake for BuybackBurn readiness.  
**Rule:** this profile adds no production BuybackBurn behavior and no route fallback.

## 1. Purpose

M19E defines the canonical live-evidence input used to convert an official STON.fi SDK/API TON->ATH transaction sample into a Platho route-freeze candidate.

The collector exists because BuybackBurn must not be implemented from hand-typed addresses or manually guessed payloads.

## 2. Required Input Document

```text
PLATHO.V1.STONFI_LIVE_EVIDENCE_INPUT_M19E
```

The input MUST contain:

```text
status
candidateLabel
officialSource
addresses
codeHashes
swap
sdkTxParams
liveProofs
```

## 3. Official Tx Params Requirements

`sdkTxParams` MUST come from the official STON.fi SDK/API for the selected v2.1 route.

```text
sdkTxParams.source = official_stonfi_sdk_or_api
sdkTxParams.sdkPackage = @ston-fi/sdk
sdkTxParams.to = STONFI_PTON_ADDRESS / selected pTON wallet or proxy
sdkTxParams.valueNanotons = 51_050_000_000
sdkTxParams.bodyBocBase64 = official pTON TON-transfer body BOC
```

The body MUST decode as:

```text
pTON op = 0x01f3835d
ton_amount = 50_000_000_000
refund_address = BuybackBurn
forward_payload = STON.fi swap payload ref
```

The forward payload MUST decode as:

```text
swap op = 0x6664de2a
ask_jetton_wallet_address = selected route ATH wallet
refund_address = BuybackBurn
excesses_address = BuybackBurn
min_ask_amount = dex_min_out
receiver_address = BuybackBurn official ATH wallet
```

## 4. Conservative Funding Rule

The official SDK/API sample MUST be generated with the Platho conservative gas profile:

```text
BUYBACK_OFFER_AMOUNT = 50 TON
BUYBACK_ROUTE_FORWARD_GAS = 1.00 TON
BUYBACK_PTON_TRANSFER_GAS = 0.05 TON
BUYBACK_TOTAL_STONFI_SEND_VALUE = 51.05 TON
```

The route must purchase ATH with exactly 50 TON offer amount. Extra funding is route execution gas and must not be interpreted as buy amount.

## 5. Freeze Gate Binding

M19E collector output is accepted only if M19C route freeze validation passes.

A candidate is BuybackBurn-ready only when:

```text
route_freeze_ready = true
issues = []
```

Until then:

```text
BUYBACKBURN_IMPLEMENTATION_READY = false
```

## 6. Non-v1 Behavior Still Forbidden

M19E does not permit:

```text
DeDust route
route switch
fallback route
null/disabled route
manual fake SDK sample
ignored-error money send
executor refund/excess capture
```
