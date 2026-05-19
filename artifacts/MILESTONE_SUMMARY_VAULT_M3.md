# Platho Vault milestone 3: ReceiveIntent lifecycle

Scope implemented:

- `contracts/Vault.tact`
- UserState / SessionState / KeyRecord functionality from prior milestones preserved
- `OP_CREATE_RECEIVE_INTENT(asset, amount, recipient_wallet, commitment, expires_at, client_nonce)`
- `OP_CLAIM_RECEIVE_INTENT(intent_id, secret32)`
- `OP_CANCEL_RECEIVE_INTENT(intent_id)`
- deterministic `intent_id` generation by Vault
- deterministic ReceiveIntent commitment verification
- TON ReceiveIntent create/claim/cancel lifecycle
- recipient first-claim UserState creation with user-state endowment
- duplicate intent rejection
- wrong recipient / wrong secret rejection
- expired intent cannot be claimed but sender can cancel
- empty fallback rejected

Explicitly not implemented:

- ATH deposit / withdraw integration
- real ATH ReceiveIntent funding path beyond internal `ath_balance` accounting support
- CompactSessionRequestV1
- external no-popup publish
- PendingPublish
- CapsuleHub ACK/excess routing
- Vault seal checks
- deployment manifest checks

Commands run:

```bash
npm run build
npm test -- --reporter=verbose
npm audit --omit=dev
```

Results:

```text
7 test files passed, 44 tests passed
npm audit --omit=dev: 0 vulnerabilities
```

Code hashes:

```text
VAULT_CODE_HASH = c7faa0ab6a5319f1f7f35a2d660f373d81f4d38a2ac0e0bec632cabce2ce9ac8
VAULT_CODE_BOC_SHA256 = b70dc9de43916d5e665158692c1c65c030f4c85476e1ee2fc0f35a135e1cd23a
```

Implementation note:

ReceiveIntent uses deterministic internal ids and commitments:

```text
intent_id = HASH("RCID" || sender || recipient || asset || amount || client_nonce)
commitment = HASH("RCCM" || intent_id || recipient || secret32)
```

This milestone keeps ReceiveIntent separate from external session publish and CapsuleHub integration by design.
