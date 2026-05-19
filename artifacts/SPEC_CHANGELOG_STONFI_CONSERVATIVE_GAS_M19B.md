# Spec Changelog: M19B STON.fi Conservative Gas / Excess Profile

Accepted as a draft profile only, not final route freeze.

## Added

- Split buyback swap funding into exact `BUYBACK_OFFER_AMOUNT_TON = 50 TON` plus conservative route gas.
- Set conservative draft route funding to:
  - `BUYBACK_ROUTE_FORWARD_GAS = 1.00 TON`
  - `BUYBACK_PTON_TRANSFER_GAS = 0.05 TON`
  - `BUYBACK_TOTAL_STONFI_SEND_VALUE = 51.05 TON`
- Required pTON refund, STON.fi refund, and STON.fi excess addresses to be BuybackBurn.
- Required success detection through ATH receipt and ATH burn finalization, not router claims.

## Not accepted as final

- Production STON.fi router/pool/pTON addresses.
- `BUYBACK_MIN_ATH_OUT_PER_50_TON`.
- Live route proof of excess/refund behavior.
- Production BuybackBurn implementation.
