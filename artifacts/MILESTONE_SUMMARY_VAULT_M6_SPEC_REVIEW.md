# Platho Vault M6 Spec Review Patch Summary

Status: completed.

## Goal

Review whether Vault M6 implementation complexity comes from real protocol safety requirements or from a spec shape that should be adjusted before code freeze.

## Result

Broad spec rewrite is not recommended.

Two narrow profile updates are recommended:

1. Pin the TON cell-based external CompactSessionRequestV1 profile used by Vault M5/M6.
2. Pin `publish_bounce_id:uint64` as the first field of Vault -> CapsuleHub publish messages for deterministic typed-bounce recovery.

These are recorded in:

```text
artifacts/platho_v1_open_values_v0_6_vault_publish_profile.md
artifacts/SPEC_REVIEW_VAULT_M6.md
```

## Code cleanup performed

`CapsuleHub.tact` used an internal constant named `CAPSULEHUB_FEE_FLUSH_FORWARD_RESERVE` in the Vault publish ACK path.

The name was misleading relative to open values, where the pinned reserve is `CAPSULEHUB_ACK_FORWARD_RESERVE`.

Changed:

```text
CAPSULEHUB_FEE_FLUSH_FORWARD_RESERVE -> CAPSULEHUB_ACK_FORWARD_RESERVE
```

This is a naming/clarity cleanup only. It did not alter compiled code hashes.

## Validation

Commands run:

```bash
npm run build
npm audit --omit=dev --audit-level=high
npm test -- --reporter=dot
```

Results:

```text
build: OK
audit: found 0 vulnerabilities
Test Files: 11 passed
Tests: 61 passed
```

## Current code hashes

```text
ATH_WALLET_CODE_HASH=b94bf85fa69b23907e2dbd1940c6daad03f71ce36379a0f9cb1c63276d621918
ATHMASTER_CODE_HASH=ee5a80a35387ceafce2a89cc58fb94200152d19ee00347cff95ab1fb329abbcc
CAPSULEHUB_CODE_HASH=add81654c2263f725fcc93cf3c9caf3229c8f164870511b90f967174a953db85
FEEACCUMULATOR_CODE_HASH=ed272b10bc841ce09da511dbe3c10cffa89659791480d0390d3e7bbde08af503
MOCK_VAULT_ATH_WALLET_CODE_HASH=9dff854edded531aca8ae603427aa978f14ee45517b9ec97d51760b197353cad
VAULT_CODE_HASH=b00b1d70343e52994e32126ef09b9d435240fa9c403647a0984573e13e8e9450
```

## Still blocked / not implemented

- `Vault.PrunePendingPublish`, because TTL is not pinned.
- Vault / BuybackBurn / UsernameRegistry final ATH wallet seal checks.
- BuybackBurn.
- UsernameRegistry.
- Any admin, pause, rescue, governance, fallback, compatibility, migration, or ignored-error path.
