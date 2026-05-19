# Platho v1 Open Values Profile Update: STON.fi Route Freeze Gate M19C

**Version:** v0.19c-stonfi-route-freeze-gate
**Status:** accepted tooling profile; production BuybackBurn remains blocked.

This update does not freeze a production STON.fi route. It defines the mandatory gate that a future
STON.fi v2.1 TON -> ATH route candidate must pass before BuybackBurn can be implemented.

## Route Freeze Status

```text
STONFI_ROUTE_FREEZE_READY = false
BUYBACKBURN_IMPLEMENTATION_READY = false
```

## Required Candidate Status

A candidate can be accepted only if:

```text
route_candidate.status == FINAL_ROUTE_FREEZE_CANDIDATE
```

Draft candidates are never accepted as final values.

## Required Real Values

The final candidate must pin:

```text
ATH_MASTER_ADDRESS
BUYBACKBURN_ADDRESS
BUYBACKBURN_OFFICIAL_ATH_WALLET_ADDRESS
STONFI_ROUTER_ADDRESS
STONFI_POOL_ADDRESS_TON_ATH
STONFI_PTON_ADDRESS / router pTON wallet address
STONFI_VAULT_ADDRESS if required by the selected route
ATH_MASTER_CODE_HASH
ATH_WALLET_CODE_HASH
STONFI_ROUTER_CODE_HASH
STONFI_POOL_CODE_HASH
STONFI_PTON_CODE_HASH
STONFI_VAULT_CODE_HASH if required
BUYBACK_MIN_ATH_OUT_PER_50_TON
```

## Required Value Formula

```text
BUYBACK_OFFER_AMOUNT_TON = 50 TON
BUYBACK_ROUTE_FORWARD_GAS = 1.00 TON
BUYBACK_PTON_TRANSFER_GAS = 0.05 TON
BUYBACK_TOTAL_STONFI_SEND_VALUE = 51.05 TON
```

The 50 TON buyback amount is the DEX offer amount. The extra 1.05 TON is route funding and must not
reduce the DEX offer amount.

## Required Payload Invariants

The freeze gate must decode the SDK/API pTON transfer body and embedded STON.fi swap payload and prove:

```text
pTON.op == 0x01f3835d
pTON.ton_amount == 50 TON
pTON.refund_address == BuybackBurn
pTON.forward_payload_hash == supplied STONFI swap payload hash

swap.op == 0x6664de2a
swap.ask_jetton_wallet_address == pinned ask jetton wallet
swap.refund_address == BuybackBurn
swap.excesses_address == BuybackBurn
swap.receiver_address == BuybackBurn official ATH wallet
swap.details.min_ask_amount == dex_min_out
```

## Required Quote / Min-Out Checks

```text
dex_min_out >= BUYBACK_MIN_ATH_OUT_PER_50_TON
dex_min_out >= floor(current_STONfi_quote_out * 0.95)
```

This is still not a trustless oracle. It is an executor policy and circuit-breaker gate.

## Required Manual Builder Check

The local Platho STON.fi payload builder must reproduce the official SDK/API sample exactly:

```text
cell_hash(local pTON body) == cell_hash(official SDK/API pTON body)
cell_hash(local swap forward payload) == cell_hash(official SDK/API swap forward payload)
```

If either hash differs, the route is not frozen.

## Required Live Proofs

Before production BuybackBurn implementation, the following must be documented from the selected live/test route:

```text
sdk_or_api_tx_params_captured = true
live_quote_captured = true
success_excesses_address_observed_as_buybackburn = true
min_out_failure_refund_observed_as_buybackburn = true
pton_refund_observed_as_buybackburn = true
bounce_or_failure_behavior_documented = true
```

## Success Signal

Buyback success is never a router/pool claim. The only final success signal is:

```text
ATH received by official BuybackBurn ATH wallet
AND
ATHBurnFinalized received from ATH Master
```

## Still Blocked

```text
BuybackBurn production contract
final genesis manifest
final BuybackBurn seal vectors
```
