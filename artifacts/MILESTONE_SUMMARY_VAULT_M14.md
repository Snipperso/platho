# Milestone Summary — Vault M14: PendingPublish Prune

## Scope

Implemented `Vault.PrunePendingPublish` after pinning the stale TTL.

## New constants/opcodes

```text
VAULT_PENDING_PUBLISH_STALE_TTL = 86_400 seconds
Vault.PrunePendingPublish = 0x720BDD6D
```

## Implementation

`Vault.tact` now supports permissionless pruning of stale `PendingPublish` records by full `publish_id`.

Validation:

```text
bounce_id = publish_id mod 2^64
pending must exist under bounce_id
publish_id must match recomputed HASH(genesis_config_hash || owner_wallet || nonce || body_hash || publish_kind)
now() must be >= pending.created_at + VAULT_PENDING_PUBLISH_STALE_TTL
```

Effect:

```text
pending_publishes.delete(bounce_id)
pending_publish_count -= 1
```

## No refund

Prune does not refund Message Budget, TON balance, protocol fee, CapsuleHub call value, or any pending budget amount.

Reason: the publish already passed signed external validation and consumed nonce. Prune is stale-state cleanup only.

ACK/bounce before prune continues to use the existing bounded budget-epoch refund rule.

## Tests

Added:

```text
tests/vault-prune-pending-publish.test.ts
```

New tests:

```text
VAULT-M14-01: stale PendingPublish can be pruned without refunding debited Message Budget; late ACK is rejected
VAULT-M14-02: non-stale PendingPublish cannot be pruned and remains pending
```

## Verification

```text
npm run build: OK
npm audit --omit=dev --audit-level=high: found 0 vulnerabilities
npm test -- --reporter=verbose --testTimeout=30000: 20 test files passed, 89 tests passed
```

## Code hashes

```text
ATH_WALLET_CODE_HASH=7b4b51d5044ddd869d277dd037fd738a4f38696dc47c0960808e6891ca61a7d5
ATHMASTER_CODE_HASH=143c2255d9bf3ae853947e45560afeb6ad0a0648361ed2350c714c3e9d6d2328
CAPSULEHUB_CODE_HASH=add81654c2263f725fcc93cf3c9caf3229c8f164870511b90f967174a953db85
FEEACCUMULATOR_CODE_HASH=ed272b10bc841ce09da511dbe3c10cffa89659791480d0390d3e7bbde08af503
VAULT_CODE_HASH=5cedd91640c2d12f61f805881172683f7ec27ff5e044514ab855517a6910f489
USERNAME_NFT_ITEM_CODE_HASH=aeae8569040208929451ecbd632606c31de78e43425603997d88b85a403d8830
USERNAME_REGISTRY_CODE_HASH=77374ee9f1f832ed10f4ab428ff89c72e2784b200a88aad686ce225002574390
MOCK_VAULT_ATH_WALLET_CODE_HASH=9dff854edded531aca8ae603427aa978f14ee45517b9ec97d51760b197353cad
MOCK_USERNAME_NFT_ITEM_NO_ACK_CODE_HASH=ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b
```

## Not implemented

- BuybackBurn.
- STON.fi route.
- Any refund path for pruned `PendingPublish`.
- Admin/owner override/pause/upgrade/governance/rescue/fallback.
- Ignored-error money sends.
- Additional routes/adapters/migration/compatibility paths.
