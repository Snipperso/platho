# Platho v1 Spec Review — Vault M6

Status: review completed after Vault M6 implementation and full-suite verification.

## Decision

Do not broadly rewrite the Platho v1 spec. Most Vault M6 complexity is required by the existing safety invariants:

- no ignored-error money sends;
- outbound value remains recoverable until ACK/bounce/finalization;
- nonce remains consumed after valid signed external requests;
- no fallback/rescue/admin path;
- budget_epoch routes late ACK/bounce value safely.

However, two spec/profile deltas are recommended before code freeze because the implementation exposed TON/Tact constraints that were not fully captured by the original spec text.

## Recommended spec/profile changes

### 1. Replace raw 268-byte CompactSessionRequestV1 with the implemented TON cell profile

The earlier raw fixed-byte profile is elegant off-chain, but it is not a good on-chain/Tact external-message profile:

- Tact external parsing works naturally over cells/slices/refs, not a raw byte array.
- The full signature and hash payload fit more cleanly as refs.
- The tested M5/M6 code already uses the cell profile.

This is not a convenience change. Without pinning the cell profile, current code and tests are formally outside the profile even though the security model is the same.

Recommended action: accept `artifacts/platho_v1_open_values_v0_6_vault_publish_profile.md` as the Vault external publish profile update.

### 2. Pin `publish_bounce_id:uint64` as the first field in Vault -> CapsuleHub publish messages

The original spec listed `publish_id:uint256` but did not account for typed bounced message body truncation.

M6 needs a small first-field bounce routing key:

```text
publish_bounce_id = publish_id mod 2^64
```

Rules:

- `publish_bounce_id` is only a bounce routing key.
- ACK authenticity still uses full `publish_id` recomputation from PendingPublish fields.
- `PendingPublish` remains logically identified by the publish flow; storage may be keyed by `publish_bounce_id` for bounce recovery.
- If a pending entry with the same `publish_bounce_id` already exists, the valid signed request is treated as a controlled post-accept invalid request: nonce consumed, bounded invalid charge, no CapsuleHub send.

This adds one 64-bit field but avoids fake rescue paths, untyped bounce hacks, and ignored-error sends. Annoying, yes. Necessary, also yes. Blockchain: where even refunds need a tiny passport.

## Spec changes NOT recommended now

### Do not remove PendingPublish

Removing PendingPublish would force either ignored-error sends, no deterministic ACK/bounce accounting, or unsafe post-accept behavior. That would violate the v1 money-send rule.

### Do not make CapsuleHub send non-bounceable

That would reduce code but would make failure recovery ambiguous. Compact code that loses money is not compact, it is just expensive confetti.

### Do not add fallback/rescue/admin recovery

This would hide broken flows behind privileged behavior and violate the closed-world v1 rule.

### Do not implement PrunePendingPublish yet

The spec says prune deletes stale pending without refund, but no TTL/open value is pinned in the available profile. Until TTL is pinned, implementing prune would invent behavior.

## Code cleanup done

`CapsuleHub.tact` had an internal constant named `CAPSULEHUB_FEE_FLUSH_FORWARD_RESERVE` used for Vault publish ACK value checks. This was misleading because the open values pin `CAPSULEHUB_ACK_FORWARD_RESERVE`.

The constant was renamed to `CAPSULEHUB_ACK_FORWARD_RESERVE` in `CapsuleHub.tact`.

This did not change compiled code hashes.

## Validation after cleanup

```text
npm run build: OK
npm test -- --reporter=dot: 11 files passed, 61 tests passed
```

Current code hashes are unchanged from Vault M6.
