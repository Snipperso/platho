# Platho M31 CapsuleHub Fee Flush Accounting Fix

Status: **PASS**

Scope: fixes the local CapsuleHub fee-flush accounting issues identified as CH-01 and CH-02.

## Closed Findings

- CH-01: `FlushFees` no longer forwards the 30M ACK reserve to `FeeAccumulator`. It now sends only `amount + 2_000_000` nanotons, where the extra value is the `FeeAccumulator.DepositProtocolFee` execution reserve.
- CH-02: discounted Vault fee dust below `5_000_000` nanotons can now be flushed when it is the entire `accrued_plato_fee_ton` bucket.

## Current Rule

- `amount > 0`
- `amount <= accrued_plato_fee_ton`
- `amount >= 5_000_000 || amount == accrued_plato_fee_ton`
- caller funds `2_000_000` local CapsuleHub execution reserve plus `2_000_000` FeeAccumulator deposit execution reserve
- outbound deposit uses `SendPayFwdFeesSeparately`

## Verification

- `npm.cmd run build`: PASS
- `npm.cmd run test:file -- tests\capsulehub.test.ts tests\capsulehub-state-invariants.test.ts tests\capsulehub-boundary-negative.test.ts tests\fee-accumulator-backing-negative.test.ts tests\fee-accumulator.test.ts`: 5 files / 30 tests PASS
- `npm.cmd test`: 67 files / 277 tests PASS
- M16 conformance: PASS
- M18 artifact integrity: PASS

## Hashes

- `CAPSULEHUB_CODE_HASH=8669ba06c90a9d909e29567cd3437f0ae93bfca65f04538d89fc564a26379eed`
- `DEPLOYMENT_MANIFEST_IMPLEMENTED_SUBSET_M15_HASH=719646897ce007c5aa628426f154304569641df7a485ba71d0745c11a7f1609b`

## Production Note

This closes the local CapsuleHub fee flush findings only. The implemented-subset manifest remains non-final while mainnet genesis and STON.fi route blockers remain open.
