# Prompt for Larisa: focused Vault publish accept/budget re-audit

You are auditing a fresh Platho archive as a focused security re-audit.

Archive name and SHA256 are provided by the sender together with the zip.

## Scope

Audit only:

- `contracts/Vault.tact`
- `contracts/CapsuleHub.tact`
- the direct Vault <-> CapsuleHub publish seam
- PWA/RPC builders and readers only where they construct, send, confirm, read, or recover Vault/CapsuleHub messages
- profile avatar flow only as a Vault public-capsule publish plus Vault-funded avatar pointer/payment flow

Do not do a full audit of unrelated contracts unless an issue directly breaks a Vault/CapsuleHub invariant.

## Why this round exists

The current round follows a compact Vault fix for large public/avatar publish externals.

Observed production symptom before the fix:

- `TON RPC sendBoc HTTP 500`
- `external message rejected`
- `exitcode=-14`
- VM log around `PUSHINT 16491`, `PUSHINT 16492`
- large public/avatar capsules could exceed the 10k pre-accept gas credit.

The fix moved full publish-budget checks out of the pre-accept zone:

- before `acceptMessage()`: auth, manifest, Vault binding, owner binding, nonce, size/profile-local reserve gate
- after `acceptMessage()`: nonce/local reserve charge, payload/hash/shape validation, canonical max charge check, remaining budget check, pending publish record, CapsuleHub send

Current intended model:

- invalid unauthenticated/wrong-owner/wrong-vault/stale-nonce requests still reject before accept and must not mutate balances, nonce, pending state, or raw Vault TON
- authenticated malformed or underpriced publish requests may consume nonce plus local exec reserve
- authenticated malformed or underpriced publish requests must not create a CapsuleHub outbound message, pending publish, under-backed accounting, double credit, or stuck claimable value
- if a publish proceeds to CapsuleHub, total user TON debited must equal `maxCharge = localExecReserve + remainingCharge`

## Primary audit questions

Check whether the new order of effects creates any of these problems:

1. under-backed Vault internal TON accounting
2. outgoing CapsuleHub call with insufficient backing
3. nonce consumed while value/pending state becomes unrecoverable
4. pending publish stored without matching user debit or refundable value
5. ACK/bounce/prune race causing double refund, lost refund, or stuck funds
6. public/avatar capsule accepted by Vault but rejected or unreadable by CapsuleHub/PWA
7. replay or duplicate publish around nonce, body hash, `publish_id`, `bounce_id`, or `pending_publishes`
8. pre-accept gas regression in private/public publish paths
9. avatar flow mismatch: public avatar capsule exists, but `SetProfileAvatarFromVaultBalance` can point to a non-existent, wrong-owner, wrong-stream, wrong-part-count, or wrong-hash avatar body
10. PWA retry/confirmation logic repeatedly resubmits BOCs in a way that can create duplicate messages or mask a real on-chain rejection

## Specific code to inspect

Vault:

- `PublishPrivateFromVaultBalance`
- `PublishPublicFromVaultBalance`
- `SetProfileAvatarFromVaultBalance`
- `onPublishPrivateAck`
- `onPublishPublicAck`
- publish bounce handlers
- `PrunePendingPublish`
- publish charge/reserve helpers
- `computePublishId`, `computePublishBounceId`, `computePublishBounceTag`

CapsuleHub:

- `PublishPrivateFromVault`
- `PublishPublicFromVault`
- private/public entry storage
- sender/recipient/public indexes
- ACK construction and value
- body/header/hash/shape checks
- pruning and protected reserve logic

PWA/RPC:

- `web/pwa-contract-transactions.mjs`
- `web/app.js`
- `web/vault-ton-rpc-provider.mjs`
- `web/capsulehub-ton-rpc-provider.mjs`
- `web/vault-chain-provider.mjs`
- `web/public-channel-subscriptions.mjs`
- `web/encrypted-message-store.mjs`
- `web/message-pricing-policy.mjs`
- `web/platho-config.mjs`
- `web/crypto/platho-crypto.mjs`

## Non-findings unless there is a concrete exploit

- `MAINNET_GENESIS_VERIFIED=false` is expected after a Vault code hash change. It means fresh genesis/deploy artifacts must be regenerated before production deploy.
- The hash-bound Vault address flows intentionally read and skip the std-address prefix before checking the 256-bit address hash. Do not reopen this as hygiene unless you can show a realistic exploit or loss scenario under the intended basechain deployment model.
- User-authorized malformed publish consuming local reserve and nonce is not by itself a blocker. It becomes a finding only if it causes theft, under-backing, double credit/refund, unrecoverable funds, or systemic liveness failure.
- UI copy/status awkwardness is not a contract finding.

## Evidence included

See:

- `artifacts/LARISA_AUDIT_EVIDENCE_20260608_VAULT_ACCEPT_RU.md`
- `artifacts/CURRENT_CODE_HASHES.txt`
- `artifacts/VAULT_CODE_HASH.txt`
- `artifacts/CAPSULEHUB_CODE_HASH.txt`
- `artifacts/MAINNET_GENESIS_VERIFIED.txt`

## Output format

Return:

1. Severity table.
2. Findings first, ordered by severity.
3. For each finding:
   - ID
   - Severity
   - Title
   - Exact files/functions
   - Scenario
   - Impact
   - Minimal fix direction
   - Whether fix belongs in contract, PWA/RPC, deploy/config, docs, or tests
   - Required regression tests
4. Non-findings reviewed.
5. Final verdict:
   - Vault readiness
   - CapsuleHub readiness
   - Vault <-> CapsuleHub seam readiness
   - PWA/RPC readiness for Vault/CapsuleHub flows
   - whether Vault redeploy/genesis regeneration is required

Start with the Vault publish accept/budget path.
