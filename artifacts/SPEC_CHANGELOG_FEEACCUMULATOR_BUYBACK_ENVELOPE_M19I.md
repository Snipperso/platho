# Spec Changelog — M19I FeeAccumulator Buyback Envelope Alignment

## Change

M19I aligns `FeeAccumulator.FlushBuybackDue` with the M19H BuybackBurn funding envelope profile.

After M19H, one future BuybackBurn execution is not a raw 50 TON offer transfer. It is a complete conservative funding envelope:

```text
BUYBACK_FUNDING_ENVELOPE_NANOTONS = 51_050_000_000
50 TON offer principal + 1.05 TON route funding = 51.05 TON total
```

## Contract rule

`FlushBuybackDue.amount` MUST equal `51.05 TON` exactly.

`50 TON` is insufficient, even if `buyback_due_ton >= 50 TON`, because the missing `1.05 TON` would force route gas to be paid out of the offer principal or from some later ambiguous source.

## Scope intentionally not added

- No production BuybackBurn implementation.
- No STON.fi route placeholder.
- No fallback route.
- No ignored-error money send.
- No admin, pause, rescue, owner override, or governance surface.

## Updated artifacts

- `contracts/FeeAccumulator.tact`
- `tests/fee-accumulator.test.ts`
- `tests/m19h-buybackburn-funding-envelope.test.ts`
- `build/FeeAccumulator/*`
- `artifacts/FEEACCUMULATOR_CODE_HASH.txt`
- `artifacts/FEE_ACCUMULATOR_CODE_HASH.txt`
- `artifacts/CURRENT_CODE_HASHES.txt`
- `artifacts/deployment_manifest_implemented_subset_m15.json`
- `artifacts/DEPLOYMENT_MANIFEST_IMPLEMENTED_SUBSET_M15_HASH.txt`
- `artifacts/m18_artifact_integrity_report.json`
- `artifacts/m18_artifact_lock.json`

## New hash values

```text
FEEACCUMULATOR_CODE_HASH=21c767d17e11146315e13834e6d6fabedb484a7964be6cf72e3f72d4401ec423
FEEACCUMULATOR_STATE_INIT_HASH=7676cf22fd1610d0db9f3dff412199035f8756896a9e7aa84b117ae3a4245071
IMPLEMENTED_SUBSET_MANIFEST_HASH=7ce023dbdcf90b1804d7118a14da2cfe84f584ced0b1776a9103c9d7a14d0672
```

## Verification cleanup

M19I housekeeping updates the canonical full-suite artifacts to the successful Vitest `vmThreads` run:

```text
Test Files: 32 passed / 32
Tests: 134 passed / 134
Exit: 0
```

This is a documentation/artifact cleanup only. It does not change contract code, tests, route semantics, or deployment hash values.
