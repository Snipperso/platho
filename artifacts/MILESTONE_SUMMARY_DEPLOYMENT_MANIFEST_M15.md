# Milestone Summary: Deployment Manifest Implemented-Subset M15

Implemented deterministic deployment manifest tooling and tests for the currently implemented Platho v1 subset.

## Added

- `scripts/deployment_manifest_m15.ts`
- `tests/deployment-manifest-m15.test.ts`
- `artifacts/deployment_manifest_implemented_subset_m15.json`
- `artifacts/DEPLOYMENT_MANIFEST_IMPLEMENTED_SUBSET_M15_HASH.txt`
- `artifacts/platho_v1_open_values_v0_15_deployment_manifest_implemented_subset.md`

## Manifest status

```text
IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS
```

The manifest is intentionally blocked from final genesis because BuybackBurn and STON.fi route values are not implemented/pinned yet.

## Manifest hash

```text
80942cd7f18a536fec3ce28c6308e6ca5f041811e6dcaf3dce8f4a6b36b85536
```

## Tests

Added:

```text
DEPLOY-M15-01
DEPLOY-M15-02/05/09
DEPLOY-M15-03/06
```

Targeted M15 test file:

```text
3/3 tests passed
```

Sequential full-suite execution:

```text
21/21 test files passed
92/92 tests passed
```

The single-process all-suite command still exhibits the existing long-running/hanging Vitest process behavior, so M15 records file-by-file sequential results as the reliable full-suite proof.

## Contract code changes

None.

## Code hashes

Unchanged from M14.
