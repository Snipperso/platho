# SPEC CHANGELOG - M20Y Activity Airdrop Tokenomics

## Changed

- Community activity airdrop allocation increased from 15% to 15% of fixed ATH supply.
- Vault activity airdrop global cap increased from `15,000,000 ATH` to `15,000,000 ATH`.
- Maximum rewarded publish count is `1,500,000`.
- Market stability reserve added as the explicit release valve for post-launch price expansion.
- Final distribution table fixed as:

```text
Community activity airdrop:      15%
Liquidity bootstrap:             15%
Long-term protocol vesting:      10%
Market stability reserve:        60%
TOTAL:                          100%
```

## Added

- Official ATH pool launch target: after approximately `15,000,000 ATH` has been distributed through Vault activity rewards.
- Explicit rationale: the airdrop is paid-usage activity mining / rebate, not a free claim campaign.
- Explicit pre-pool utility: earned ATH may be used for username purchases before official pool launch. Message fee discounts stay locked until the 15% activity-distribution / pool-launch gate.
- FeeAccumulator bootstrap policy: before the 15% activity distribution / pool-launch gate, protocol TON splits 100% to liquidity bootstrap / treasury; buyback split is enabled later through the one-way `EnableBuybackSplit` gate.
- BuybackBurn route policy: final genesis seals BuybackBurn before the pool exists, with `route_frozen = false`; the real STON.fi route is frozen once only after the 15% gate and pool creation.
- Market stability policy: the 60% reserve is split into twenty 3% tranches, released only at x2, x3, ..., x21 price milestones from the initial pool price.
- Market stability implementation note: no seller contract is implied by this changelog unless a separately audited immutable contract is deployed for that policy.

## Unchanged

- Fixed ATH supply.
- No mint-after-deploy.
- Reward remains `10 ATH` per successfully finalized paid publish.
- Reward remains ACK-gated by authenticated `CapsuleHubPublishAck`.
- No per-wallet cap.
- No admin airdrop controls.
- No pause/rescue/override/governance surface.
- FeeAccumulator 51.05 TON buyback envelope semantics.
