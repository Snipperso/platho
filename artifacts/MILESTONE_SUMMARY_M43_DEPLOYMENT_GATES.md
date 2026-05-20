# M43 Deployment Gates

Status: PASS.

This milestone closes deployment-gate audit findings DEPLOY-01, DEPLOY-02, and
DEPLOY-03 without changing contract runtime code.

## Closed Findings

- DEPLOY-01: M20F route-freeze gates now require safe value bounds for
  BuybackBurn route ATH notify value and owner-facing ATH notify request values.
- DEPLOY-02: `mainnet:genesis:verify` now verifies final getter snapshots against
  the final manifest before mainnet genesis can be accepted.
- DEPLOY-03: historical M19G/M19H code-hash files are explicitly marked
  deprecated and point to `artifacts/CURRENT_CODE_HASHES.txt` as canonical.

## Verification

- Focused deployment/gate tests: PASS, 8 files / 30 tests.
- `npm.cmd test`: PASS, 70 files / 300 tests.
- M16 conformance: PASS.
- M18 artifact integrity: PASS.
- `npm.cmd run preprod:check`: BLOCKED as expected.
- `npm.cmd run web:deploy:prepare:prod`: BLOCKED_BY_PREPROD as expected.

## Production Note

Production remains blocked until final mainnet route evidence, final genesis
manifest, funding proofs, and `mainnet:genesis:verify` all pass.
