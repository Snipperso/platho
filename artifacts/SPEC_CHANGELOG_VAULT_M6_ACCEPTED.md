# Platho v1 Spec Change Accepted — Vault M6 Alignment

Status: accepted and applied to artifacts.

## Applied documents

```text
artifacts/platho_v1_spec_v0_3_2_vault_m6_aligned.md
artifacts/platho_v1_open_values_v0_6.md
```

## Accepted changes

1. `CompactSessionRequestV1` is now the TON cell profile used by Vault M5/M6, not the older raw 268-byte payload profile.
2. `Vault -> CapsuleHub` publish messages now pin `publish_bounce_id:uint64` as the first field.
3. `publish_bounce_id = publish_id mod 2^64` is only a bounce-routing key; ACK authenticity still uses full `publish_id` recomputation.
4. `Vault -> CapsuleHub` publish sends are pinned as `bounce = true`, `mode = SendPayGasSeparately`, `value = capsulehub_call_value`.
5. `Vault.PrunePendingPublish` remains blocked until stale TTL is pinned.

## Non-changes

No admin, owner override, pause, upgrade, rescue, governance, fallback, compatibility route, migration hook, MessageSession/session-spender contract, silent fallback behavior, or ignored-error send mode was introduced.

## Code impact

No functional code change was required for this acceptance step. The existing Vault M6 implementation already matched the accepted profile.
