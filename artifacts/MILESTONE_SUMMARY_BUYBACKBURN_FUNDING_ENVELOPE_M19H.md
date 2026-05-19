# Platho M19H — BuybackBurn Funding Envelope

Status: PASS.

Scope: route-independent funding-accounting profile for future BuybackBurn integration. No production BuybackBurn contract is implemented.

## Result

The one-buyback funding envelope is fixed as:

```text
BUYBACK_OFFER_AMOUNT = 50 TON
BUYBACK_ROUTE_FORWARD_GAS = 1.00 TON
BUYBACK_PTON_TRANSFER_GAS = 0.05 TON
BUYBACK_TOTAL_STONFI_SEND_VALUE = 51.05 TON
```

FeeAccumulator must flush a complete `51.05 TON` funding envelope for one future BuybackBurn execution.

## Important accounting consequence

With the current 50/50 FeeAccumulator split:

```text
100 TON accumulated fees -> 50 TON buyback_due_ton -> insufficient
102.10 TON accumulated fees -> 51.05 TON buyback_due_ton -> exactly one envelope
```

## Tests

```text
M19H-01 one buyback envelope is 51.05 TON total while preserving exactly 50 TON offer
M19H-02 100 TON accumulated fees are insufficient for one conservative envelope
M19H-03 102.10 TON accumulated fees produce one envelope; bounce restores it exactly
```

## Verification

```text
build: OK
audit: 0 vulnerabilities
M19H targeted: 3/3 passed
full suite: 32 files / 131 tests passed
full suite exit code: 0
```

## Contract code

No production contract code changed. Code hashes remain unchanged from M19G.

## Still blocked

```text
Production BuybackBurn
Final STON.fi route freeze
Final genesis manifest
```
