# M24 Route, Storage, And Canonical Encoding Audit Fix Review

Status: local engineering hardening pass after third-party audit findings review.

Date: 2026-05-19

## Reviewed Findings

- F-013 BuybackBurn route refund/excess overcredit: fixed.
- F-014 exact-min storage reserve under-retention: fixed for Vault state-growth paths and UsernameRegistry paid-mint/refund paths.
- F-015 Vault non-canonical signatureRef accepted: fixed.
- F-016 Vault ATH withdrawal pending key collision: fixed.

Previously reported findings F-001, F-008, F-009, F-010, and F-012 were already addressed before this pass and remain covered by the full suite.

## Code Changes

- `BuybackBurn` now credits route refund/excess due conservatively as `context().value - BUYBACK_ROUTE_REFUND_EXEC_RESERVE`, and ignores values that do not cover the reserve.
- `Vault` now charges a separate `VAULT_STATE_GROWTH_EXEC_RESERVE` on state-growth boundaries: SetSession, messaging key registration/replacement, receive intent creation, receive intent claim for a new user, and first ATH notification for a new user.
- `Vault` now rejects signatureRef cells with trailing data after loading the 512-bit signature.
- `Vault` now scopes pending ATH withdrawal ids by `owner_wallet || client_query_id`, while preserving the client query id at the external API boundary through helper getters.
- `UsernameRegistry` now separates state-growth execution reserve from storage and ACK reserves for refund and pending mint paths.

## Regression Tests

- BuybackBurn route refund accounting expectations updated to assert due buckets are backed after execution reserve.
- Vault boundary tests now cover state-growth exact-min reserves and two simultaneous ATH withdrawals with the same client query id from different owners.
- Vault external session tests now reject signatureRef cells with trailing bits or refs before nonce or budget mutation.
- Vault TON state invariant walk updated for state-growth execution reserve requirements.
- UsernameRegistry boundary tests now cover the explicit state-growth execution reserve on invalid refund and valid mint paths.

## Verification

- `npm.cmd run build`: PASS.
- Focused regression suite: PASS, 6 files / 36 tests.
- `node scripts/hash_codes.js`: PASS.
- `scripts/deployment_manifest_m15.ts`: PASS.
- `scripts/gas_reserve_m17.ts`: PASS.
- `scripts/conformance_m16.ts`: PASS.
- `scripts/artifact_integrity_m18.ts`: PASS.
- `npm.cmd test`: PASS, 65 files / 267 tests.
- JSON proof: `artifacts/NPM_TEST_FULL_SUITE_M24_ROUTE_STORAGE_CANONICAL_RESULTS.json`.
- `node scripts/preprod_guard.mjs`: expected BLOCKED by non-runtime production gates.

## Remaining Production Gates

This pass does not make mainnet production deployable by itself. The deployment manifest intentionally remains `IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS` until final mainnet inputs are provided and preprod gates pass.

Current preprod guard blockers after this pass:

- PWA_MODE_NOT_PRODUCTION
- PWA_NETWORK_NOT_MAINNET
- CRYPTO_PROD_REMAINING_WORK
- PROD_CHECKLIST_OPEN_BLOCKERS
- TESTNET_ENV_PRESENT
