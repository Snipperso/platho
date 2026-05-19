# Spec Changelog — M19F STON.fi Route Evidence Dossier

## Accepted as draft tooling profile

M19F adds a canonical evidence dossier for the STON.fi route freeze process.

## Changes

- Adds `PLATHO.V1.STONFI_ROUTE_EVIDENCE_DOSSIER_M19F`.
- Requires immutable evidence refs for ATH deployment, BuybackBurn StateInit, official ATH wallet derivation, STON.fi tx params, live quote, code hashes, success excess, min-out refund, pTON refund, and bounce/failure behavior.
- Preserves conservative buyback funding:
  - 50 TON offer amount.
  - 1.00 TON router forward gas.
  - 0.05 TON pTON transfer gas.
  - 51.05 TON total send value.
- Requires all refund/excess paths to return to BuybackBurn.
- Keeps production BuybackBurn blocked until route freeze is true.

## Explicit non-changes

- No BuybackBurn contract implementation.
- No route switch.
- No fallback route.
- No DeDust path.
- No null/disabled route.
- No admin/rescue/governance surface.
