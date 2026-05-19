# M20Z Milestone Summary — Deployment Spec Consistency

## Result

Implemented.

M20Z closes a documentation/generated-artifact mismatch left after M20W/M20Y: the live code and deploy scripts already use a one-shot genesis controller for Vault binding, but the older deployment ATH binding profile still described pre-M20W placeholder/sentinel semantics.

## Files changed

- `scripts/generate_deployment_ath_binding_vectors.ts`
- `scripts/deployment_manifest_m15.ts`
- `artifacts/deployment_ath_wallet_binding_vectors.json`
- `artifacts/deployment_manifest_implemented_subset_m15.json`
- `artifacts/DEPLOYMENT_MANIFEST_IMPLEMENTED_SUBSET_M15_HASH.txt`
- `artifacts/platho_v1_open_values_v0_7_deployment_ath_binding.md`
- `artifacts/platho_v1_open_values_v0_20z_deployment_spec_consistency.md`
- `artifacts/SPEC_CHANGELOG_M20Z_DEPLOYMENT_SPEC_CONSISTENCY.md`

## Verification

Targeted deployment/artifact checks:

```text
5 test files passed
14 tests passed
EXIT=0
```

Full suite:

```text
34 test files passed
143 tests passed
EXIT=0
```

Production dependency audit:

```text
npm audit --omit=dev
0 vulnerabilities
EXIT=0
```

## Hash impact

Contract code hashes are unchanged.

The implemented-subset manifest hash changed because manifest labels changed:

```text
IMPLEMENTED_SUBSET_MANIFEST_HASH=d6f6f1d780a5c48c1d18f8ae017877a9891658f361ca3c6c76c61c761ed74f65
```
