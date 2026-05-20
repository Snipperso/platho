# M48 FeeAccumulator Treasury Flush Fragment Guard

Date: 2026-05-20

Status: local hardening pass after FeeAccumulator local audit finding `FEEACC-01`. This is not a mainnet production approval.

## Finding

`FlushTreasuryDue` was permissionless and accepted any positive amount up to `treasury_due_ton`.

That allowed a caller to fragment `treasury_due_ton` into tiny terminal treasury transfers. The due bucket was debited by the nominal amount even when the active treasury receiver could spend most of a dust inbound value on receiver-side gas.

## Code Change

`contracts/FeeAccumulator.tact` now requires treasury flushes to be either:

- at least `FEEACCUMULATOR_MIN_TREASURY_FLUSH_TON`, currently equal to the 5,000,000 nanotons flush execution reserve; or
- exactly the remaining `treasury_due_ton`, so final dust tails can still be cleared.

This keeps permissionless flushing useful while preventing arbitrary dust fragmentation.

## Regression Coverage

`tests/fee-accumulator-backing-negative.test.ts` adds `FEE-BACKING-02B`.

The regression verifies:

- dust partial flushes are rejected without sending a treasury transfer;
- normal partial flushes at the minimum are accepted;
- a final dust tail equal to the full remaining due is accepted and sent with exact inbound value.

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

## Remaining Production Gates

This pass closes the treasury flush fragmentation grief surface only. It does not remove final mainnet blockers such as final genesis manifest replacement, STON.fi route freeze evidence, activity airdrop funding proof, or production PWA/preprod gates.
