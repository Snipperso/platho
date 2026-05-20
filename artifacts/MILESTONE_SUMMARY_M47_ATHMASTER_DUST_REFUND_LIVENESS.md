# M47 ATHMaster Dust Refund Liveness

Status: **PASS**

Scope: minimal local ATHMaster liveness/value-flow fix for
`DeployTreasurySupply`.

## Addressed Finding

- ATHM-01: `DeployTreasurySupply` with tiny overpayment, such as
  `5_000_001` nanotons, could fail in action phase because ATHMaster attempted
  to send a separate dust refund. This prevented treasury ATH wallet genesis
  credit and retained most of the caller value in ATHMaster.

## Resolution

- ATHMaster now sends the excess refund only when
  `excess >= 100_000` nanotons.
- Exact `5_000_000` deploy still succeeds.
- Tiny overpayment succeeds and leaves the dust as ATHMaster reserve.
- Non-dust overpayment is still refunded to `response_destination`, which must
  equal `treasury_owner`.

## Regression Coverage

- `ATH Master tiny DeployTreasurySupply overpayment does not cancel genesis
  credit`: `required_value + 1` deploys and credits the treasury ATH wallet with
  the full fixed supply.

## Verification

- `npm.cmd run build`: PASS.
- Focused ATHMaster suite: PASS, 4 files / 24 tests.
- `npm.cmd test`: PASS, 70 files / 305 tests.
- M16 conformance: PASS.
- M18 artifact integrity: PASS.

## Hashes

- `ATHMASTER_CODE_HASH=4d88d83ed5d795eb25f947e8c9f1d19ad7cbedeae93562e27d73b65b54f5a62f`
- `ATH_WALLET_CODE_HASH=5c0cf65ee7b44b239a87d181b9167a406b935ac0d0879e8727e96c2e4d68064a`
- `DEPLOYMENT_MANIFEST_IMPLEMENTED_SUBSET_M15_HASH=8b3fa3c3ea993fac281a104a9bd14637b5c571fca79d98bc1b16d95479c09947`

## Production Note

This is a genesis liveness hardening patch. Production remains blocked by the
existing mainnet genesis, route, address, and final evidence gates.
