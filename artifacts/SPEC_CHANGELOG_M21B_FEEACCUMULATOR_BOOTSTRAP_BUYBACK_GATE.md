# SPEC CHANGELOG M21B - FeeAccumulator bootstrap buyback gate

## Changed

- `FeeAccumulator` now starts in bootstrap mode:
  - `buyback_split_enabled = false`
  - `SplitAccumulated` moves 100% of `accumulated_ton` into `treasury_due_ton`
  - `buyback_due_ton` cannot grow from protocol-fee splitting during this phase
- Added `EnableBuybackSplit`.
  - Callable only by the immutable `treasury_receiver_address`.
  - One-way: after it succeeds, it cannot be called again.
  - Requires caller-funded execution reserve.
- After `EnableBuybackSplit`, `SplitAccumulated` returns to the existing 50/50 policy:
  - `treasury_due_ton += floor(amount * 5000 / 10000)`
  - `buyback_due_ton += amount - treasury_amount`
  - odd nanotons still go to buyback.

## Rationale

The official ATH pool is planned after approximately `15,000,000 ATH` has been distributed through Vault activity rewards.
Before that point, protocol TON should be available for liquidity bootstrap / treasury instead of accumulating as a buyback backlog.

This is enforced in contract state, not only by keeper policy. A permissionless `SplitAccumulated` before the pool-launch gate cannot put TON into `buyback_due_ton`.

## Release Gate

Final genesis must prove:

- `FeeAccumulator.buyback_split_enabled = false`

The one-way enable action belongs to the post-launch operations gate after the 15% activity distribution / pool-launch condition is satisfied.

## Unchanged

- `DepositProtocolFee` remains permissionless and credits only declared principal.
- `FlushTreasuryDue` behavior is unchanged.
- `FlushBuybackDue` still requires the exact `51.05 TON` buyback funding envelope.
- Buyback bounce recovery still restores the complete bounced envelope into `buyback_due_ton`.
- No pause, rescue, upgrade, governance, or broad admin surface was added.
