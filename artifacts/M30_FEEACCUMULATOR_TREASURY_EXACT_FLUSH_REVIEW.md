# M30 FeeAccumulator Treasury Exact Flush Review

Date: 2026-05-20

Status: local engineering hardening pass after third-party audit session 1. This is not a mainnet production approval.

## Reviewed Finding

FeeAccumulator `FlushTreasuryDue` debited `treasury_due_ton` by the requested principal amount, but sent the treasury transfer with `SendDefaultMode`. In TON action semantics this lets forward fees reduce the value received by the treasury receiver.

Observed vulnerable shape:

```text
treasury_due_ton -= msg.amount
message value = msg.amount
mode = SendDefaultMode
```

That means the due bucket can be fully cleared while the immutable treasury receiver gets less than `msg.amount`.

## Code Change

`contracts/FeeAccumulator.tact` now sends treasury flushes with `SendPayFwdFeesSeparately`.

The caller already must fund `FEEACCUMULATOR_FLUSH_EXEC_RESERVE` before the due bucket is debited. With separate forward-fee payment, the final treasury inbound value is exactly the debited principal amount.

## Regression Coverage

`tests/fee-accumulator-backing-negative.test.ts` now captures the treasury transfer transaction and asserts:

```ts
expect(inboundValue(treasuryFlushTx)).toBe(treasuryDue);
```

This checks the actual message value received by the treasury path, not only the post-flush state bucket.

## Updated Evidence

- FeeAccumulator code hash: `ff084907becac5dcc98b372162bab7f6f2a364f4383e5f51676fd069f64db2e3`
- Implemented-subset manifest hash: `64c49e4eb7964234f860069761ffb2a83a41d6af925980c1578987be86ac70bd`

Regenerated artifacts:

- `build/FeeAccumulator/*`
- `artifacts/FEEACCUMULATOR_CODE_HASH.txt`
- `artifacts/FEE_ACCUMULATOR_CODE_HASH.txt`
- `artifacts/CURRENT_CODE_HASHES.txt`
- `artifacts/deployment_manifest_implemented_subset_m15.json`
- `artifacts/DEPLOYMENT_MANIFEST_IMPLEMENTED_SUBSET_M15_HASH.txt`
- `artifacts/m16_conformance_report.json`
- `artifacts/m18_artifact_integrity_report.json`
- `artifacts/m18_artifact_lock.json`

## Verification

- `npm.cmd run build`: PASS.
- Focused FeeAccumulator suite: PASS, 2 files / 10 tests.
- `node scripts/hash_codes.js`: PASS.
- `scripts/deployment_manifest_m15.ts`: PASS.
- `scripts/conformance_m16.ts`: PASS.
- `scripts/artifact_integrity_m18.ts`: PASS.
- `npm.cmd test`: PASS, 67 files / 276 tests.

Retained proof artifacts:

- `artifacts/NPM_BUILD_M30_FEEACCUMULATOR_TREASURY_EXACT_OUTPUT.txt`
- `artifacts/NPM_BUILD_M30_FEEACCUMULATOR_TREASURY_EXACT_SUMMARY.json`
- `artifacts/NPM_TEST_M30_FEEACCUMULATOR_FOCUSED_RESULTS.json`
- `artifacts/NPM_TEST_FULL_SUITE_M30_FEEACCUMULATOR_TREASURY_EXACT_RESULTS.json`
- `artifacts/NPM_TEST_M30_FEEACCUMULATOR_TREASURY_EXACT_SUMMARY.json`

## Remaining Production Gates

This pass closes the FeeAccumulator treasury exact-value flush bug only. It does not remove final mainnet blockers such as final genesis manifest replacement, STON.fi route freeze evidence, or production PWA/preprod gates.
