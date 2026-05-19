# Platho v1 Open Values v0.14 — Vault PendingPublish Prune

**Status:** accepted implementation profile for Vault M14.

This profile pins the last open value that blocked `Vault.PrunePendingPublish` after Vault M6.

## 1. Stale TTL

```text
VAULT_PENDING_PUBLISH_STALE_TTL = 86_400 seconds = 24 hours
```

A `PendingPublish` is stale iff:

```text
now() >= pending.created_at + VAULT_PENDING_PUBLISH_STALE_TTL
```

## 2. Opcode

```text
Vault.PrunePendingPublish = 0x720BDD6D
```

Computed as:

```text
first_32_bits(SHA256("PLATHO.V1.Vault.PrunePendingPublish"))
```

Message layout:

```text
PrunePendingPublish {
  publish_id: uint256
}
```

## 3. Prune semantics

Prune is permissionless stale cleanup.

On valid stale prune:

```text
bounce_id = publish_id mod 2^64
pending = pending_publishes[bounce_id]
require pending exists
require publish_id == HASH(genesis_config_hash || owner_wallet || nonce || body_hash || publish_kind)
require now() >= pending.created_at + VAULT_PENDING_PUBLISH_STALE_TTL

pending_publishes.delete(bounce_id)
pending_publish_count -= 1
```

## 4. No refund rule

Prune does **not** refund Message Budget, TON balance, protocol fee, CapsuleHub call value, or any pending budget amount.

Reason: the external publish already passed signature/nonce/budget validation and the nonce was consumed. Prune is a stuck-pending cleanup path, not a recovery/refund path.

ACK/bounce before prune remains the only path that may route returned value via the existing budget-epoch rule.

## 5. Late ACK/bounce after prune

After prune, a late `CapsuleHubPublishAck` for the same `publish_id` is rejected because no matching `PendingPublish` exists.

Late bounce for a pruned publish is likewise rejected by missing pending state.

## 6. Still not added

No admin, owner override, pause, rescue, governance, fallback, compatibility path, or ignored-error send mode is introduced.
