# Platho v1 Open Values Profile v0.19G — BuybackBurn Route-Independent State Machine

**Document status:** freeze-candidate profile, not production BuybackBurn implementation  
**Companion milestones:** M19A–M19F STON.fi discovery/gas/freeze/evidence tooling  
**Rule:** this profile does not unblock production BuybackBurn by itself.

## 1. Status

```text
BUYBACKBURN_STATE_MACHINE_PROFILE = FREEZE_CANDIDATE_NOT_PRODUCTION_CONTRACT
BUYBACKBURN_IMPLEMENTATION_READY = false
STONFI_ROUTE_FREEZE_REQUIRED = true
```

Production BuybackBurn remains blocked until the STON.fi route evidence dossier passes the M19F/M19E/M19C route-freeze gates.

## 2. Route-independent constants

```text
BUYBACK_OFFER_AMOUNT = 50 TON = 50_000_000_000 nanotons
BUYBACK_ROUTE_FORWARD_GAS = 1.00 TON = 1_000_000_000 nanotons
BUYBACK_PTON_TRANSFER_GAS = 0.05 TON = 50_000_000 nanotons
BUYBACK_TOTAL_STONFI_SEND_VALUE = 51.05 TON = 51_050_000_000 nanotons
```

`BUYBACK_OFFER_AMOUNT` is the amount offered to STON.fi. The route gas reserve is separate and must not reduce the 50 TON offer.

## 3. Candidate operation labels

These are route-independent candidate labels for future production code. They are not production opcodes until the route is frozen and BuybackBurn is implemented.

```text
ExecuteBuybackChunk = first_32_bits(SHA256("PLATHO.V1.BuybackBurn.ExecuteBuybackChunk"))
StonfiRouteRefunded = first_32_bits(SHA256("PLATHO.V1.BuybackBurn.StonfiRouteRefunded"))
RetryAthBurnDue     = first_32_bits(SHA256("PLATHO.V1.BuybackBurn.RetryAthBurnDue"))
```

## 4. State machine

```text
IDLE
PENDING_STONFI_SWAP
PENDING_ATH_BURN
```

Transitions:

```text
IDLE
  -- ExecuteBuybackChunk(route_freeze_ready, exact 50 TON offer, 51.05 TON total, dex_min_out checks)
  --> PENDING_STONFI_SWAP

PENDING_STONFI_SWAP
  -- official BuybackBurn ATH wallet notification amount >= dex_min_out
  --> PENDING_ATH_BURN

PENDING_STONFI_SWAP
  -- route refund/failure proof
  --> IDLE + route_refund_due_ton

PENDING_ATH_BURN
  -- ATHBurnFinalized from ATH Master exact amount
  --> IDLE + burned_ath_total

PENDING_ATH_BURN
  -- ATHBurnFailed from official BuybackBurn ATH wallet exact amount
  --> IDLE + ath_burn_retry_due
```

## 5. Safety rules

```text
no production BuybackBurn before STON.fi route freeze
no fallback route
no route switch
no DeDust route
no ignored-error send mode for money sends
no clearing pending swap from router payload claims without actual ATH receipt
no clearing pending burn without ATHBurnFinalized from ATH Master
transfer-to-dead-address is not burn
```

## 6. Remaining blocker

```text
STONFI_ROUTE_FREEZE_READY = false
```

Until route freeze is true, this profile is a testable state-machine specification only.
