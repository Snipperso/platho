# M28 F-039 BuybackBurn Query Id Hardening Review

Date: 2026-05-20

Status: local engineering hardening pass after third-party audit finding F-039. This is not a mainnet production approval.

## Reviewed Finding

F-039 HIGH: permissionless `ExecuteBuybackChunk` could choose `query_id = uint64_max`, terminalize that cycle, set `last_terminal_query_id` to the maximum uint64 value, and permanently block every future buyback execution.

Root cause: the previous freshness gate accepted any externally supplied query id greater than `last_terminal_query_id`. That prevented simple reuse, but still allowed an arbitrary jump to the terminal ceiling.

## Code Change

`BuybackBurn` now treats buyback query ids as a strict sequential lifecycle controlled by contract state:

- the next cycle must use `last_terminal_query_id + 1`;
- `uint64_max` is explicitly rejected as a cycle id;
- terminalization records the already accepted pending query id directly;
- the same rule is applied to both `ExecuteBuybackChunk` and `RetryAthBurnDue`.

This removes permissionless caller control over the global terminal id progression. A caller can still initiate a permissionless buyback only with the exact next id, so it cannot jump the contract into a future-dead state.

## Regression Coverage

Added `BUYBACK-04F` in `tests/buybackburn-production.test.ts`:

- accept one reserve envelope;
- attempt `ExecuteBuybackChunk(query_id = uint64_max)`;
- assert no phase change, no reserve consumption, and `last_terminal_query_id == 0`;
- execute and terminalize query id `1`;
- accept another reserve and execute query id `2`;
- assert the second future buyback still starts and terminalizes.

Existing BuybackBurn tests were updated to use the new sequential ids instead of arbitrary ids such as `77`, `88`, or `99`, so the suite no longer accidentally blesses external query-id jumps.

## Updated Evidence

- BuybackBurn code hash: `130ce2ef10dca3e42c8a991b577404e597f54d4ac2565dfdf6654a8fb11eb921`
- Implemented-subset manifest hash: `5680fad4f703a24c26fa72be25b821aced902d5d967ffe4702507e3c7157de08`

Regenerated artifacts:

- `artifacts/BUYBACKBURN_CODE_HASH.txt`
- `artifacts/CURRENT_CODE_HASHES.txt`
- `artifacts/deployment_manifest_implemented_subset_m15.json`
- `artifacts/DEPLOYMENT_MANIFEST_IMPLEMENTED_SUBSET_M15_HASH.txt`
- `artifacts/m16_conformance_report.json`
- `artifacts/m18_artifact_integrity_report.json`
- `artifacts/m18_artifact_lock.json`

## Verification

- `npm.cmd run build`: PASS.
- Focused BuybackBurn suite: PASS, 2 files / 18 tests.
- `node scripts/hash_codes.js`: PASS.
- `scripts/deployment_manifest_m15.ts`: PASS.
- `scripts/conformance_m16.ts`: PASS.
- `scripts/artifact_integrity_m18.ts`: PASS.
- `scripts/buybackburn_contract_readiness_m20u.ts`: PASS, still blocked by missing M20F mainnet route freeze.
- Focused readiness/conformance/integrity suite: PASS, 6 files / 34 tests.
- `npm.cmd test`: PASS, 66 files / 275 tests.
- JSON proof: `artifacts/NPM_TEST_FULL_SUITE_M28_F039_RESULTS.json`.

## Remaining Production Gates

This pass closes F-039 only. Mainnet production remains blocked until the outstanding production gates and final mainnet evidence are resolved, including STON.fi route freeze, final genesis manifest replacement, and preprod PWA/production checklist gates.
