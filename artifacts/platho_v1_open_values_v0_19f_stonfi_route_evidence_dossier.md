# Platho v1 Open Values v0.19F — STON.fi Route Evidence Dossier

**Status:** draft route-freeze intake profile  
**Scope:** tooling and evidence validation only  
**Production BuybackBurn status:** BLOCKED until `STONFI_ROUTE_FREEZE_READY_M19F = true`

## Purpose

M19F defines the single evidence dossier that must be filled before the STON.fi route can be frozen for Platho v1 BuybackBurn.

This profile does not introduce a production route, fallback route, route switch, DeDust path, or BuybackBurn contract implementation.

## Immutable buyback rules

```text
BUYBACK_OFFER_AMOUNT = 50 TON = 50_000_000_000 nanotons
BUYBACK_ROUTE_FORWARD_GAS = 1.00 TON = 1_000_000_000 nanotons
BUYBACK_PTON_TRANSFER_GAS = 0.05 TON = 50_000_000 nanotons
BUYBACK_TOTAL_STONFI_SEND_VALUE = 51.05 TON = 51_050_000_000 nanotons
```

The 50 TON offer amount is the actual amount sold through STON.fi. The extra 1.05 TON is conservative route funding and must not reduce the offer amount.

All refund and excess addresses must be BuybackBurn:

```text
pTON refund_address = BuybackBurn
STON.fi swap refund_address = BuybackBurn
STON.fi swap excesses_address = BuybackBurn
```

Success is not proven by router/pool claims. Success requires ATH receipt by the official BuybackBurn ATH wallet followed by `ATHBurnFinalized` from ATH Master.

## Required dossier

A route-freeze candidate must provide `PLATHO.V1.STONFI_ROUTE_EVIDENCE_DOSSIER_M19F` with:

```text
ATH deployment manifest reference
BuybackBurn StateInit vector reference
BuybackBurn official ATH wallet derivation vector reference
official @ston-fi/sdk/API tx params reference
live quote reference
router/pool/pTON code hash proofs
successful swap excess proof to BuybackBurn
min_out failure refund proof to BuybackBurn
pTON refund proof to BuybackBurn
bounce/failure behavior proof
```

The dossier embeds the M19E live evidence input and is validated by:

```text
scripts/stonfi_route_evidence_dossier_m19f.ts
```

## Freeze rule

```text
STONFI_ROUTE_FREEZE_READY_M19F = true
```

only if:

```text
all dossier evidence references are real, non-placeholder refs
all checklist flags are true
M19E collector returns route_freeze_ready = true
M19C route freeze validation returns freezeReady = true
```

Until then, production BuybackBurn remains blocked.
