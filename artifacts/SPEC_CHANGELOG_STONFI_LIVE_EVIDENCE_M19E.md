# Spec Changelog — M19E STON.fi Live Evidence Collector

## Added

- Canonical `PLATHO.V1.STONFI_LIVE_EVIDENCE_INPUT_M19E` input format.
- Validation that official SDK/API tx params send to the pinned pTON route address.
- Validation that official SDK/API tx value equals the conservative Platho total send value of 51.05 TON.
- Automatic extraction of the STON.fi swap forward payload from the official pTON body BOC.
- Automatic conversion from live evidence input into the M19C/M19D route freeze candidate model.

## Not added

- No production BuybackBurn contract.
- No STON.fi final route freeze.
- No fallback route.
- No route switch.
- No DeDust integration.
