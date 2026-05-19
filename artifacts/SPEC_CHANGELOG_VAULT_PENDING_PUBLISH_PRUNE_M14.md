# Spec Changelog — Vault PendingPublish Prune M14

## Accepted additions

1. Pin `VAULT_PENDING_PUBLISH_STALE_TTL = 86_400 seconds`.
2. Add `Vault.PrunePendingPublish = 0x720BDD6D`.
3. Define prune as permissionless stale cleanup by full `publish_id`.
4. Keep `publish_bounce_id` as storage/bounce routing key only; prune verifies full `publish_id` by recomputation.
5. Define prune as no-refund cleanup.
6. Define late ACK/bounce after prune as rejected due to missing pending state.

## Reason

Vault M6 intentionally left `PrunePendingPublish` blocked because no stale TTL was pinned. M14 pins the TTL without adding rescue, fallback, admin, or compatibility behavior.

The no-refund rule preserves the M6 invariant: accepted external signed publish consumes nonce and debits `max_charge`; only actual ACK/bounce can return a bounded amount through the budget-epoch routing rule.

## Out of scope

- Vault session lifecycle changes.
- CapsuleHub behavior changes.
- Any refund path for pruned pending publish.
- BuybackBurn.
- STON.fi route values.
- Admin/owner override/pause/upgrade/governance/rescue/fallback.
