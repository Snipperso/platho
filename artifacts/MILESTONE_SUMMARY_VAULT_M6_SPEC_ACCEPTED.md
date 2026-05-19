# Platho Vault M6 Accepted Spec Alignment Summary

Status: completed and validated.

## Applied spec artifacts

```text
artifacts/platho_v1_spec_v0_3_2_vault_m6_aligned.md
artifacts/platho_v1_open_values_v0_6.md
artifacts/SPEC_CHANGELOG_VAULT_M6_ACCEPTED.md
```

## Accepted changes

1. `CompactSessionRequestV1` is now the TON cell profile used by Vault M5/M6, not the older raw 268-byte payload profile.
2. `Vault -> CapsuleHub` publish messages pin `publish_bounce_id:uint64` as the first field.
3. `publish_bounce_id = publish_id mod 2^64` is only a typed-bounce routing key.
4. ACK authenticity still uses full `publish_id` recomputation from `PendingPublishV1` fields.
5. `Vault -> CapsuleHub` publish sends are pinned as `bounce = true`, `mode = SendPayGasSeparately`, `value = capsulehub_call_value`.
6. `Vault.PrunePendingPublish` remains blocked until stale TTL is pinned.

## Code impact

No functional contract code change was required for this acceptance step. Existing Vault M6 code already matched the accepted profile.

## Validation commands

```bash
npm ci --ignore-scripts
npm run build
npm audit --omit=dev --audit-level=high
npm test -- --reporter=dot
```

## Validation result

```text
build: OK
audit: found 0 vulnerabilities
Test Files: 11 passed
Tests: 61 passed
```

## Current code hashes

```text
ATHMASTER_CODE_HASH=ee5a80a35387ceafce2a89cc58fb94200152d19ee00347cff95ab1fb329abbcc
ATH_WALLET_CODE_HASH=b94bf85fa69b23907e2dbd1940c6daad03f71ce36379a0f9cb1c63276d621918
CAPSULEHUB_CODE_HASH=add81654c2263f725fcc93cf3c9caf3229c8f164870511b90f967174a953db85
FEEACCUMULATOR_CODE_HASH=ed272b10bc841ce09da511dbe3c10cffa89659791480d0390d3e7bbde08af503
MOCK_VAULT_ATH_WALLET_CODE_HASH=9dff854edded531aca8ae603427aa978f14ee45517b9ec97d51760b197353cad
VAULT_CODE_HASH=b00b1d70343e52994e32126ef09b9d435240fa9c403647a0984573e13e8e9450
```

## Non-changes

No admin, owner override, pause, upgrade, rescue, governance, fallback, compatibility route, migration hook, MessageSession/session-spender contract, silent fallback behavior, or ignored-error send mode was introduced.
