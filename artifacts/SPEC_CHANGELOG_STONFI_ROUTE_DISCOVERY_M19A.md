# M19A Spec Changelog: STON.fi Route Discovery Draft

## Accepted as draft

M19A records the official SDK-derived STON.fi v2.1 TON -> jetton payload structure used for future BuybackBurn implementation.

## Not accepted as final route freeze

This milestone does not pin final router/pool/pTON addresses or final `BUYBACK_MIN_ATH_OUT_PER_50_TON`.

## Reason

ATH has not been deployed to a final address in this package and a final TON/ATH STON.fi pool is not available in the package. Therefore production BuybackBurn remains blocked.

## No production code change

M19A adds discovery tooling and conformance tests only. It does not add BuybackBurn or any route fallback.
