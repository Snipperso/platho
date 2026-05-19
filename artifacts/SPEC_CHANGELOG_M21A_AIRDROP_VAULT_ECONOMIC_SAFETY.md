# SPEC_CHANGELOG M21A — Vault activity airdrop economic safety audit

## Added

- Added final-genesis blocker requiring the official Vault ATH wallet to be funded with the full activity airdrop allocation before final genesis readiness.
- Added tests asserting the 30% airdrop constants and the funding blocker are present in the implemented-subset manifest.
- Strengthened Vault publish tests to assert that airdropped ATH reduces the next canonical message fee through the existing ATH discount curve.
- Strengthened stale PendingPublish prune tests to assert no airdrop credit occurs on prune or late ACK after prune.

## Changed

- `deployment_manifest_implemented_subset_m15.json` manifest hash changed because `blockers_before_final_genesis` now includes the airdrop funding evidence blocker.

## Unchanged

- Contract code unchanged.
- Vault airdrop runtime logic unchanged.
- 30% activity airdrop amount unchanged.
- 10 ATH reward per successful paid publish unchanged.
- No per-wallet cap unchanged.
- STON.fi route readiness remains false.
- BuybackBurn implementation readiness remains false.
