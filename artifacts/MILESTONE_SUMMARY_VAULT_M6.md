# Platho Vault Milestone 6 Summary

Status: implemented and locally verified.

## Scope

Vault M6 implements the external signed publish orchestration path from Vault to CapsuleHub:

- valid external session publish request passes the pre-accept gate;
- nonce is consumed exactly once;
- `max_charge` is debited from the active Message Budget;
- `PendingPublishV1` is created before the bounceable Vault -> CapsuleHub send;
- Vault sends private/public publish messages to the bound CapsuleHub;
- CapsuleHub accepts Vault publish messages only from the sealed/bound Vault address;
- CapsuleHub emits `Vault.CapsuleHubPublishAck`;
- Vault ACK handler clears `PendingPublish` and routes ACK excess/refund through the budget-epoch rule;
- Vault bounce handlers clear `PendingPublish` and route returned value through the same budget-epoch rule;
- no ignored-error send mode is used for money sends.

## Publish id

Implemented formula:

```text
publish_id = HASH(genesis_config_hash || owner_wallet || nonce || body_hash || publish_kind)
```

## Bounce recovery note

TON bounced message bodies expose only the first 224 bits after the opcode. A full `uint256 publish_id` cannot be reliably read from a typed bounced message if it is the first field.

To keep bounce recovery deterministic and testable, Vault -> CapsuleHub publish messages include a first-field `bounce_id:uint64`, where:

```text
bounce_id = publish_id mod 2^64
```

`PendingPublishV1` storage itself follows the spec fields. Full `publish_id` authenticity is checked on ACK by recomputing it from pending fields:

```text
computePublishId(owner_wallet, nonce, body_hash, publish_kind) == ack.publish_id
```

The `bounce_id` is only a bounce routing key for the typed bounced message path.

## Send mode

Vault -> CapsuleHub publish sends use:

```text
mode = SendPayGasSeparately
bounce = true
```

This is not ignored-error mode. It is required so the exact CapsuleHub call value from the canonical max-charge formula reaches CapsuleHub instead of being reduced by forwarding fees before CapsuleHub validation.

## Tests added/updated

Added:

- `tests/vault-m6-publish.test.ts`
  - `VAULT-M6-01`: valid external private publish reaches CapsuleHub, receives ACK, and clears `PendingPublish`.
  - `VAULT-M6-02`: bounced CapsuleHub publish clears `PendingPublish` and refunds through active Message Budget.

Updated:

- `tests/vault-external-session-gate.test.ts`
  - old M5 expectation changed from invalid-request charge to M6 behavior: valid external request debits `max_charge` and creates pending publish when no ACK exists yet.

## Validation

Commands:

```bash
npm run build
npm audit --omit=dev --audit-level=high
npm test -- --reporter=dot
```

Results:

```text
build: OK
npm audit --omit=dev --audit-level=high: found 0 vulnerabilities
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

## Fixed artifact inconsistency

Both FeeAccumulator hash files now contain the same current compiled code hash:

```text
ed272b10bc841ce09da511dbe3c10cffa89659791480d0390d3e7bbde08af503
```

## Explicitly not implemented in this milestone

- `Vault.PrunePendingPublish`, because the stale-pending TTL is not pinned in the supplied open values.
- Vault / BuybackBurn / UsernameRegistry final ATH wallet seal checks.
- BuybackBurn.
- UsernameRegistry.
- New routes, adapters, migration hooks, compatibility paths, admin override, pause, rescue, governance, or fallback behavior.

---

## Follow-up Spec Review Patch

After reviewing the implementation against the strict-spec rule, two profile clarifications were recommended and recorded in:

```text
artifacts/SPEC_REVIEW_VAULT_M6.md
artifacts/platho_v1_open_values_v0_6_vault_publish_profile.md
```

A naming-only cleanup was applied in `CapsuleHub.tact`:

```text
CAPSULEHUB_FEE_FLUSH_FORWARD_RESERVE -> CAPSULEHUB_ACK_FORWARD_RESERVE
```

Compiled code hashes remained unchanged. Full suite remains green: 11 test files, 61 tests.
