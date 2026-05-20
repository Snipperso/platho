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

## M48 Fragmentation Guard Update

M48 adds a second treasury flush hardening step after `FEEACC-01`.

`FlushTreasuryDue` is still permissionless, but it now rejects dust partial fragments. A treasury flush amount must be either at least `5,000,000` nanotons or exactly the remaining `treasury_due_ton`, so final dust tails remain clearable.

See:

- `artifacts/MILESTONE_SUMMARY_M48_FEEACCUMULATOR_TREASURY_FLUSH_FRAGMENT_GUARD.md`
- `artifacts/m48_feeaccumulator_treasury_flush_fragment_guard_report.json`

## Updated Evidence

- FeeAccumulator code hash: `471f1fdb5b84dfb6b07e263d3eddd6c1880b7d6bc366c1443c244e08e85a2f5f`
- Implemented-subset manifest hash: `03d558e83478b0f42f1a52d4cee889b08a715bed19b714140f6e2af5a89562cc`

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
- Focused FeeAccumulator / BuybackBurn seam suite: PASS, 4 files / 28 tests.
- `node scripts/hash_codes.js`: PASS.
- `scripts/deployment_manifest_m15.ts`: PASS.
- `scripts/conformance_m16.ts`: PASS.
- `scripts/artifact_integrity_m18.ts`: PASS.
- `npm.cmd test`: PASS, 70 files / 306 tests.

Retained proof artifacts:

- `artifacts/NPM_BUILD_M30_FEEACCUMULATOR_TREASURY_EXACT_OUTPUT.txt`
- `artifacts/NPM_BUILD_M30_FEEACCUMULATOR_TREASURY_EXACT_SUMMARY.json`
- `artifacts/NPM_TEST_M30_FEEACCUMULATOR_FOCUSED_RESULTS.json`
- `artifacts/NPM_TEST_FULL_SUITE_M30_FEEACCUMULATOR_TREASURY_EXACT_RESULTS.json`
- `artifacts/NPM_TEST_M30_FEEACCUMULATOR_TREASURY_EXACT_SUMMARY.json`

## Remaining Production Gates

This pass closes the FeeAccumulator treasury exact-value flush bug only. It does not remove final mainnet blockers such as final genesis manifest replacement, STON.fi route freeze evidence, or production PWA/preprod gates.
