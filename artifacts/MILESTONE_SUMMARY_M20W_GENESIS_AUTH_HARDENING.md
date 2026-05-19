# M20W Milestone Summary — Genesis Auth Hardening

## Result

Implemented.

M20W fixes the critical deployment-phase issue where arbitrary senders could bind or seal unsealed genesis contracts before the intended deployment flow completed.

## Finding fixed

`C-DEPLOY-01`: permissionless pre-seal genesis binding capture.

## Contracts changed

- `contracts/Vault.tact`
- `contracts/CapsuleHub.tact`
- `contracts/UsernameRegistry.tact`

## Test added

- `tests/deployment-genesis-auth.test.ts`

## Verification artifacts

- `artifacts/M20W_AUTH_AND_DEPLOYMENT_TESTS_OUTPUT.txt`
- `artifacts/M20W_CONFORMANCE_ARTIFACT_GAS_TESTS_OUTPUT.txt`
- `artifacts/M20W_MONEY_ROUTE_REGRESSION_TESTS_OUTPUT.txt`
- `artifacts/M20W_RUNTIME_REGRESSION_TESTS_OUTPUT.txt`
- `artifacts/M20W_USERNAME_REGISTRY_REGRESSION_TESTS_OUTPUT.txt`
- `artifacts/M20W_VAULT_RUNTIME_REGRESSION_TESTS_OUTPUT.txt`
- `artifacts/M20W_TEST_MATRIX_SUMMARY.md`
- `artifacts/NPM_AUDIT_PROD_M20W_OUTPUT.json`

## Test matrix

Chunked regression matrix:

- Test files covered: 34 / 34
- Tests passed: 142 / 142
- Failed targeted chunks: 0

One-shot full suite was not used as the proof artifact in this sandbox. The suite can still hang/time out around Vitest worker teardown before final summary, so M20W uses explicit chunked proof artifacts.

## Production flags

Unchanged:

- `STONFI_ROUTE_FREEZE_READY=false`
- `BUYBACKBURN_IMPLEMENTATION_READY=false`

## Hashes

- `VAULT_CODE_HASH=98582cf0f2f99d74e095be6dc2b01f511d161983ccf930b2521a42cd69fc1720`
- `CAPSULEHUB_CODE_HASH=d66f03836f43f3e425e0ef0fcf3e65c0f20f364f12a89e4f84960fed15eb5298`
- `USERNAME_REGISTRY_CODE_HASH=0d7c89a953a966deb6f8b6000b902de92907dcfa772b7ac905b65d3b5a06396e`
- `IMPLEMENTED_SUBSET_MANIFEST_HASH=6819b11b8b2fb6a7361793c2db049ad62629e144ec9096669e070fb8013b1e7a`
