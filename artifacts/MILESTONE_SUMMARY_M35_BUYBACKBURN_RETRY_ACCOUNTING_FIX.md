# Platho M35 BuybackBurn Retry Accounting Fix

Status: **PASS**

Scope: fixes local BuybackBurn accounting-truth finding BB-01 from the BuybackBurn audit section.

## Closed Finding

- BB-01: partial `RetryAthBurnDue` can no longer split one failed buyback burn into many successful retry cycles and inflate `executed_buyback_count`.

## Current Rule

- `RetryAthBurnDue.amount > 0`
- `RetryAthBurnDue.amount == ath_burn_retry_due_atomic`
- caller still funds `BUYBACK_ATH_BURN_REQUEST_VALUE`
- `executed_buyback_count` increments only after successful `ATHBurnFinalized`

## Verification

- `npm.cmd run build`: PASS
- `npm.cmd run test:file -- tests\buybackburn-production.test.ts tests\buybackburn-auth-negative-matrix.test.ts tests\m20u-buybackburn-implementation-readiness.test.ts tests\m29-buybackburn-abi-freeze.test.ts`: 4 files / 25 tests PASS
- `npm.cmd test`: 67 files / 282 tests PASS
- M16 conformance: PASS
- M18 artifact integrity: PASS

## Hashes

- `BUYBACKBURN_CODE_HASH=c0aa01fbea33817bc1954ccafb0f09f32c32d0c0b2b5ed9763b24bbd80541250`
- `DEPLOYMENT_MANIFEST_IMPLEMENTED_SUBSET_M15_HASH=af36c4040075c9dded8929c5ddbd2ebd8eefe1ab9d3791aefc846ad3be8fd729`

## Production Note

This closes the local BuybackBurn retry accounting finding only. The implemented-subset manifest remains non-final while mainnet genesis and STON.fi route blockers remain open.
