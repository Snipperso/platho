# M23 Accounting Findings Review

Status: PASS after patch and regression tests.

Scope:
- Vault TON deposit accounting / backing
- BuybackBurn reserve envelope backing
- ATHWallet pending notification key domain
- Re-check of already-fixed Vault external replay and official ATH wallet derivation findings

## Findings

### F-001 Vault external replay / gas drain

Status: already fixed before this pass.

Vault external session handling now performs user/budget/maxCharge validation before `acceptMessage()`, and nonce/budget mutation happens before post-accept publish dispatch.

### F-008 Vault TON ledger under-backed

Status: fixed.

`DepositTon` now requires a caller-funded execution reserve in addition to credited principal:
- new user: `amount + VAULT_USER_STATE_STORAGE_ENDOWMENT + VAULT_DEPOSIT_TON_EXEC_RESERVE`
- existing user: `amount + VAULT_DEPOSIT_TON_EXEC_RESERVE`

Regression coverage:
- `VAULT-BND-01`
- `VAULT-BND-01B`
- `VAULT-INV-TON-01` now asserts Vault balance backs user TON balances, message budgets, and locked receive intents.

### F-009 Wrong official ATH wallet binding

Status: already fixed before this pass.

Vault and UsernameRegistry bind/seal paths enforce derived official ATH wallet addresses on-chain.

### F-012 BuybackBurn reserve_due overcredits retained balance delta

Status: fixed.

`AcceptBurnReserve` now requires `BUYBACK_ACCEPT_RESERVE_EXEC_RESERVE` on top of the 51.05 TON principal envelope. `FeeAccumulator.FlushBuybackDue` forwards that reserve together with the principal while keeping `AcceptBurnReserve.amount` equal to the protocol envelope.

Regression coverage:
- `FEE-BACKING-03`
- BuybackBurn production/auth matrix reserve acceptance tests

### F-010 ATHWallet pending notification collision

Status: fixed.

Pending notifications are now keyed by `query_id` plus a sender-owner-derived 32-bit `sender_key`, instead of `query_id` alone. The key is included in notification and ACK messages and fits the Tact bounced-message 224-bit prefix together with `query_id` and `amount`.

Regression coverage:
- `ATH-XFER-04`

## Verification

- Build: `npm.cmd run build` PASS
- Full suite: `npm.cmd test` PASS, 65 files / 265 tests
- JSON proof: `artifacts/NPM_TEST_FULL_SUITE_M23_ACCOUNTING_FIX_RESULTS.json`
- Artifact integrity: `scripts/artifact_integrity_m18.ts` PASS
