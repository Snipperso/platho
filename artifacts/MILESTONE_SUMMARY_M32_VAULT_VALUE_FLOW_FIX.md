# Platho M32 Vault Value Flow Fix

Status: **PASS**

Scope: fixes local Vault money/liveness findings from the Vault audit section.

## Addressed Findings

- VLT-01: `WithdrawTon` now uses `SendPayFwdFeesSeparately`, so the recipient receives the exact `amount` debited from the user ledger.
- VLT-02: `WithdrawAth` stores a refundable TON cap and credits returned ACK/failure/bounce value back to the user's internal `ton_balance`, after a `2_000_000` nanotons callback reserve deduction.
- VLT-03: malformed signed external session requests no longer burn `message_budget_ton`. They still advance nonce after `acceptMessage()` because accepted external messages need replay protection.

## External Session Note

Full deterministic validation after Ed25519 verification but before `acceptMessage()` exceeds TON external gas credit in sandbox. The chosen safe behavior is:

- invalid signatures are rejected before `acceptMessage()`;
- valid signatures are accepted immediately;
- malformed signed requests advance nonce but do not debit budget;
- valid publish requests debit the canonical `maxCharge` and dispatch normally.

## Verification

- `npm.cmd run build`: PASS
- `npm.cmd run test:file -- tests\vault-session-lifecycle.test.ts tests\vault-boundary-negative.test.ts tests\vault-external-session-gate.test.ts tests\vault-m6-publish.test.ts tests\vault-prune-pending-publish.test.ts tests\vault-ath-integration.test.ts tests\vault-receive-intent.test.ts tests\vault-auth-negative-matrix.test.ts tests\vault-ath-invariants.test.ts tests\vault-ton-state-invariants.test.ts`: 10 files / 42 tests PASS
- M16 conformance: PASS
- M18 artifact integrity: PASS

## Hashes

- `VAULT_CODE_HASH=411a974272b457cf465f132646234723e6862dcc21c7ed2d1215e1c738ee615f`
- `DEPLOYMENT_MANIFEST_IMPLEMENTED_SUBSET_M15_HASH=662416e1324f9c1649eb3b99b2d152657b91aa9fdd632581484f146661f688ba`

## Production Note

This closes the local Vault value-flow findings in this pass only. The implemented-subset manifest remains non-final while mainnet genesis and STON.fi route blockers remain open.
