# Platho M22 Audit Findings Review

Status: targeted on-chain fixes applied; mainnet production remains blocked by readiness gates.

## Confirmed And Fixed

- F-001 Vault external replay/gas-drain: confirmed with regression tests, then fixed.
  - Active sessions now mirror `message_budget_ton` in `SessionState`.
  - External publish rejects low session budget and too-low `maxCharge` before `acceptMessage()`.
  - Post-accept user/budget inconsistency no longer leaves a replayable throw; nonce is consumed before returning.
  - Regression tests: `VAULT-EXT-REPLAY-LOW-BUDGET-01`, `VAULT-EXT-REPLAY-MAXCHARGE-01`.

- F-007 official ATH wallet binding: confirmed for Vault and UsernameRegistry, then fixed.
  - `BindOfficialAthWallet` and `SealGenesis` now enforce `official == deriveAthWalletAddress(myAddress())`.
  - Regression tests reject non-derived official ATH wallet binding before seal.

## Verified As Release Blockers

- F-002/F-003: production readiness and PWA production gates still block as intended.
- F-004/F-005: final genesis manifest and BuybackBurn route freeze remain non-final by design.
- F-006: BuybackBurn opcode/spec drift remains a source-of-truth freeze issue. It is not treated as a runtime exploit in this pass, but it must be formally resolved before mainnet release artifacts are considered final.

## Evidence

- Full suite proof: `artifacts/NPM_TEST_FULL_SUITE_M22_AUDIT_FIX_RESULTS.json`
- Full suite summary: `artifacts/NPM_TEST_FULL_SUITE_M22_AUDIT_FIX_OUTPUT.txt`
- Full suite result: 263 passed / 263 total tests.
- M16 conformance: PASS.
- M17 gas/reserve sanity: PASS.
- M18 artifact integrity: PASS.
- `npm.cmd run preprod:check`: blocked as expected by production/PWA/crypto/readiness/testnet-env blockers.
- `npm.cmd run web:deploy:prepare:prod`: blocked as expected by preprod blockers.
