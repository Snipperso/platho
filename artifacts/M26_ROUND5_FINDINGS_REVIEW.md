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

## Source-Of-Truth Decisions

- F-030: superseded. CapsuleHub v1 must store retrievable encrypted payload cells on-chain. Counter-only / anchor-only is no longer an acceptable v1 interface decision.
- F-031: resolved as a v1 ABI decision. Explicit no-authority `TopUpStorageReserve` handlers exist for Vault, CapsuleHub, FeeAccumulator, BuybackBurn, UsernameRegistry, and UsernameNFTItem using the opcodes pinned in the current spec table. ATHMaster/ATHWallet are not extended by this decision because the current top-up opcode table does not define ATH jetton top-up operations.

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
