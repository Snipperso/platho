# Platho Vault milestone 1: balances + session lifecycle

Scope implemented:

- `contracts/Vault.tact`
- `UserStateV1` map keyed by wallet address
- `SessionStateV1` map keyed by wallet address
- TON deposit principal accounting
- TON withdrawal final user-directed transfer profile
- `OP_SET_SESSION`
- `OP_REVOKE_SESSION`
- `OP_TOP_UP_MESSAGE_BUDGET`
- Message Budget top-up requires active non-expired session
- expired active session can be revoked
- `OP_SET_SESSION` after expiry keeps Message Budget allocated
- `budget_epoch` increments on revoke
- empty fallback rejected

Explicitly not implemented:

- ATH deposit / withdraw integration
- ReceiveIntent
- external session publish
- CompactSessionRequestV1 parsing/signature verification
- PendingPublish
- CapsuleHub integration from Vault
- Vault ACK/excess routing
- key registration / key_generation
- deployment/seal checks
- admin/owner override/pause/upgrade/governance/rescue/fallback paths

Commands run:

```bash
npm run build
npm test -- --reporter=verbose
npm audit --omit=dev
```

Results:

```text
VAULT_CODE_HASH = fe99f29e932586c6841ccb2e95095206ef69f5ec5cb17ab83ed8fdd9cf10bc9f
VAULT_CODE_BOC_SHA256 = 3251448ba984164c52a2327b68a36ebc3477e129270f350ef8cd4032923b3197
vitest: 5 test files passed, 34 tests passed
npm audit --omit=dev: 0 vulnerabilities
```

Caveat:

Vault milestone 1 is intentionally limited to balances and session lifecycle. It is not a full Vault implementation and must not be treated as implementing no-popup external publish or ATH integration.
