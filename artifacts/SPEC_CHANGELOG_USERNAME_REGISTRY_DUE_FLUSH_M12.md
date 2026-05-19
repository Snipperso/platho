# Spec Changelog: UsernameRegistry Due Flush M12

Accepted changes:

1. ATH burn now has an authenticated finalization ACK path:
   - `ATHBurn` includes `response_destination`.
   - `ATHBurnNotification` includes `response_destination`.
   - ATH Master sends `ATHBurnFinalized` only after exact `total_supply` decrease.
   - ATH Wallet sends `ATHBurnFailed` to owner if master notification bounces/fails.

2. UsernameRegistry now includes immutable `treasury_ath_receiver_address` in initial data.

3. UsernameRegistry implements:
   - `FlushTreasuryAthDue = 0x60A9BDDB`
   - `FlushBurnAthDue = 0xE9A2C2CB`

4. Query IDs are globally unique across pending ATH due flush maps:
   - refund flush
   - treasury flush
   - burn flush

5. No rescue/fallback/admin/governance behavior was added.

Rationale:

- `burn_due_ath` cannot be permanently cleared just because `ATHBurn` was sent to the official wallet. It must be cleared only after authenticated proof that ATH Master reduced `total_supply` exactly.
- Treasury due uses the existing bounce-safe ATH transfer profile.
- Burn due uses the new authenticated burn-finalized ACK profile.
