# Platho v1 Open Values v0.19H — BuybackBurn Funding Envelope

Status: freeze-candidate, not production BuybackBurn implementation.

This profile resolves the funding-accounting implication introduced by the conservative STON.fi route gas profile.

## Values

```text
BUYBACK_OFFER_AMOUNT_TON = 50 TON = 50_000_000_000 nanotons
BUYBACK_ROUTE_FORWARD_GAS = 1.00 TON = 1_000_000_000 nanotons
BUYBACK_PTON_TRANSFER_GAS = 0.05 TON = 50_000_000 nanotons
BUYBACK_ROUTE_GAS_TOTAL = 1.05 TON = 1_050_000_000 nanotons
BUYBACK_TOTAL_STONFI_SEND_VALUE = 51.05 TON = 51_050_000_000 nanotons
```

## FeeAccumulator funding rule

For one conservative BuybackBurn execution envelope:

```text
FeeAccumulator.FlushBuybackDue.amount = BUYBACK_TOTAL_STONFI_SEND_VALUE
```

not:

```text
BUYBACK_OFFER_AMOUNT_TON
```

Reason: BuybackBurn must buy ATH with exactly 50 TON while funding the STON.fi route with a conservative extra gas envelope. The route gas is protocol-owned execution funding, not ATH purchase principal.

## Minimum accumulated protocol fees for one envelope

With the current 50/50 FeeAccumulator split:

```text
minimum accumulated protocol fees for one buyback envelope = 102.10 TON
```

This produces:

```text
treasury_due_ton = 51.05 TON
buyback_due_ton = 51.05 TON
```

A 100 TON accumulated fee split produces only 50 TON buyback due, which is insufficient after the conservative route gas profile.

## Refund/excess ownership

All route refund/excess addresses remain:

```text
BuybackBurn
```

Excess route gas must not be routed to:

```text
executor
user wallet
treasury
arbitrary sender
```

## Implementation status

```text
Production BuybackBurn implementation: BLOCKED until STON.fi route freeze is true
Route placeholder: forbidden
Ignored-error money send mode: forbidden
```
