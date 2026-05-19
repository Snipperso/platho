# Spec Changelog — M19G BuybackBurn State Machine

## Accepted as freeze-candidate

- Added route-independent BuybackBurn state-machine profile.
- Preserved production BuybackBurn blocker until STON.fi route freeze is complete.
- Pinned the 50 TON offer plus 1.05 TON conservative route funding model for the future state machine.
- Defined success as actual ATH receipt followed by authenticated `ATHBurnFinalized` from ATH Master.
- Defined route refund/failure and burn failure accounting at the model level.

## Not accepted as production implementation

- No production `BuybackBurn.tact` was added.
- No STON.fi addresses, pool, pTON wallet, or route payload values were guessed.
- No fake route, null route, route switch, DeDust route, rescue, fallback, or ignored-error send mode was added.
