# SPEC CHANGELOG: STON.fi Route Freeze Gate M19C

## Accepted

M19C adds a mandatory route freeze gate for STON.fi v2.1 TON -> ATH route selection.

The gate rejects any candidate unless it supplies:

- final route addresses and code hashes,
- real SDK/API generated pTON body and swap forward payload,
- manual builder hash equality against the SDK/API sample,
- quote/min-out evidence,
- live proof that refund/excess paths return to BuybackBurn.

## Not Accepted Yet

No production STON.fi route values are frozen by this milestone.
No BuybackBurn contract is implemented by this milestone.

## Rationale

The main v1 profile requires the exact selected STON.fi v2 route to be pinned before BuybackBurn code freeze.
M19C turns that requirement into an executable gate instead of a checklist humans can misread, forget, or decorate with optimism.
