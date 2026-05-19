# M26 Round 5 Findings Review

Status: **PATCHED / TESTED** for confirmed code issues. Production remains **NO-GO** because final preprod/mainnet gates are intentionally closed.

## Confirmed And Patched

- F-025: `Vault.WithdrawTon` now requires a caller-funded execution reserve before reducing internal TON liability and sending TON out. Regression `VAULT-BND-01C` verifies min-1 rejection and that exact-reserve withdrawal does not spend Vault backing on fees.
- F-026: `UsernameNFTItem.ResendDeployedAck` now requires both forwarded ACK value and a local execution reserve. Regression tests verify underfunded rejection and no item reserve drain on exact funding.
- F-027: TON Connect proof verification now enforces `expectedChain` when supplied, returns the accepted wallet chain, and the PWA passes the expected chain from runtime config. Crypto selftest includes chain-mismatch rejection.
- F-032: `UsernameRegistry.bounced<ResendDeployedAck>` now starts with `requireSealed()` for lifecycle consistency.

## Checked / Not Reproduced In Current Workspace

- F-028: not reproduced. `npm audit --json` and `npm audit --omit=dev --json` both report 0 total vulnerabilities on the current lockfile.
- F-029: resolved for this pass. Full suite evidence is archived in `artifacts/NPM_TEST_FULL_SUITE_M26_ROUND5_RESULTS.json`.

## Unresolved Source-Of-Truth Items

- F-030: CapsuleHub page-map vs counter-only semantics remains a product/spec decision, not a runtime exploit confirmed in this pass.
- F-031: `TopUpStorageReserve` coverage remains a spec conformance decision. Current explicit handlers exist for UsernameRegistry and UsernameNFTItem; adding no-op top-up handlers to other production contracts should be decided as a contract interface change.

## Regression Evidence

- `npm.cmd run build`: PASS
- Focused regression set: 6 files / 30 tests PASS
- `npm.cmd run crypto:selftest`: PASS, `negativeChecksPassed = 27`
- M16 conformance: PASS
- M17 gas reserve sanity: PASS
- M18 artifact integrity: PASS
- Full suite JSON: 130 / 130 suites, 271 / 271 tests PASS
- `npm audit --json`: 0 vulnerabilities
- `npm audit --omit=dev --json`: 0 vulnerabilities
- `preprod_guard`: BLOCKED as expected by non-contract production gates
- `prepare_static_web_deploy --mode production`: BLOCKED as expected by preprod gates
