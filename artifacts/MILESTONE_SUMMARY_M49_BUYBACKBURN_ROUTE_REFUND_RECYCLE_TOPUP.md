# M49 BuybackBurn Route Refund Recycle Top-Up

Date: 2026-05-21

Status: local hardening pass after BuybackBurn session 5 audit finding `BBURN-01`. This is not a mainnet production approval.

## Finding

Authenticated route refunds are credited conservatively:

```text
route_refund_due_ton += context.value - BUYBACK_ROUTE_REFUND_EXEC_RESERVE
```

That keeps the bucket from over-crediting retained value, but it also meant an exact returned 51.05 TON envelope could land just below the recycle threshold. `RecycleRouteRefundReserve` then could not convert it back into a retryable `reserve_due_ton` envelope, and ordinary storage top-up did not affect the accounting bucket.

## Code Change

`contracts/BuybackBurn.tact` keeps the conservative refund credit rule.

`RecycleRouteRefundReserve` now allows caller-funded top-up above `BUYBACK_ACCOUNTING_RECYCLE_EXEC_RESERVE` to participate in the recycle calculation:

```text
available = route_refund_due_ton + (context.value - recycle_exec_reserve)
require available >= 51.05 TON
route_refund_due_ton = available - 51.05 TON
reserve_due_ton += 51.05 TON
```

This avoids converting a shaved refund into an under-backed reserve while giving operators a narrow way to close the shortfall.

## Regression Coverage

`tests/buybackburn-production.test.ts` adds `BUYBACK-04G`.

The regression verifies:

- an exact full route refund is credited below the 51.05 TON recycle threshold;
- recycle with only execution reserve still fails and leaves state unchanged;
- recycle with execution reserve plus the exact shortfall creates one full backed reserve envelope and clears the route refund bucket.

## Updated Evidence

- BuybackBurn code hash: `272c14fb673dbb5ff51c9945b16325902d22925d48ea458c53612d8aed032acd`
- Implemented-subset manifest hash: `05a803beff4382dce069c994492c3a50534aec2aed0040d28ce3e0e0ffcbde5b`

Regenerated artifacts:

- `build/BuybackBurn/*`
- `artifacts/BUYBACKBURN_CODE_HASH.txt`
- `artifacts/CURRENT_CODE_HASHES.txt`
- `artifacts/deployment_manifest_implemented_subset_m15.json`
- `artifacts/DEPLOYMENT_MANIFEST_IMPLEMENTED_SUBSET_M15_HASH.txt`
- `artifacts/m16_conformance_report.json`
- `artifacts/m18_artifact_integrity_report.json`
- `artifacts/m18_artifact_lock.json`

## Verification

- `npm.cmd run build`: PASS.
- Focused BuybackBurn / preflight suite: PASS, 8 files / 47 tests.
- `node scripts/hash_codes.js`: PASS.
- `scripts/deployment_manifest_m15.ts`: PASS.
- `npm.cmd run m20u:readiness`: PASS, still blocked only by missing M20F mainnet route freeze evidence.
- `scripts/conformance_m16.ts`: PASS.
- `scripts/artifact_integrity_m18.ts`: PASS.
- `npm.cmd test`: PASS, 70 files / 307 tests.

## Remaining Production Gates

This pass closes the local route refund recycle liveness/accounting issue only. It does not remove final mainnet blockers such as M20F mainnet STON.fi route freeze evidence, final genesis manifest replacement, ATH treasury supply deployment proof, Vault activity airdrop funding proof, or production PWA/preprod gates.
