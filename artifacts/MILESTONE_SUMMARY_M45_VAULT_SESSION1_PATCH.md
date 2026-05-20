# M45 Vault Session 1 Patch

Status: **PASS**

Scope: minimal Vault fixes from the external audit session 1 patch review.

## Addressed Findings

- VLT-01: validly signed malformed external session publishes no longer spend Vault TON without charging the user-funded Message Budget. They consume nonce, create no pending publish, and debit the bounded invalid-request charge.
- VLT-02: `WithdrawTon` now rejects `recipient == myAddress()` before debiting internal TON, preventing self-withdrawn TON from becoming uncredited Vault reserve.
- VLT-03: `WithdrawAth` now rejects `recipient == myAddress()` before debiting internal ATH, preventing self-withdrawn ATH from destroying the user's internal claim.

## Implementation Notes

- `INVALID_SESSION_REQUEST_CHARGE_TON` is now equal to `VAULT_EXTERNAL_SESSION_LOCAL_MAX_CHARGE` (`6_000_000` nanotons).
- The post-accept invalid external branch debits `min(message_budget_ton, INVALID_SESSION_REQUEST_CHARGE_TON)`, mirrors the session budget, persists nonce and user state, and returns cleanly.
- `WithdrawTon` and `WithdrawAth` self-recipient guards are placed before user ledger debit and pending withdrawal creation.

## Verification

- `node scripts\tact_build.js --config tact.config.json --project Vault`: PASS.
- `npm.cmd run build`: PASS.
- `npm.cmd run test:file -- tests\vault-external-session-gate.test.ts --reporter=verbose`: PASS, 1 file / 8 tests.
- `npm.cmd run test:file -- tests\vault-boundary-negative.test.ts --reporter=verbose`: PASS, 1 file / 9 tests.
- Vault-focused suite: PASS, 12 files / 54 tests.
- `npm.cmd test`: PASS, 70 files / 302 tests.
- M15 deployment manifest regeneration: PASS.
- M16 conformance: PASS.
- M18 artifact integrity: PASS.

## Hashes

- `VAULT_CODE_HASH=f33d567e5ce2696b9e594f440131ec124557c2102d1d1da73a82a44cf75e5362`
- `DEPLOYMENT_MANIFEST_IMPLEMENTED_SUBSET_M15_HASH=b610641bc6d64c48891c1ce06c3343b39c3982ff03a7013c204b22e5a3361134`

## Production Note

This closes the local Vault session 1 money/liveness findings covered by the patch. The implemented-subset deployment manifest remains non-final while mainnet genesis and STON.fi route evidence gates remain open.
