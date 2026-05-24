# SPEC CHANGELOG — M20Y 30% Activity Airdrop Tokenomics

## Changed

- Community activity airdrop allocation increased from 15% to 30% of fixed ATH supply.
- Vault activity airdrop global cap increased from `15,000,000 ATH` to `30,000,000 ATH`.
- Maximum rewarded publish count increased from `1,500,000` to `3,000,000`.
- Founder allocation target reduced from 10% to 5%.
- No separate early-user / launch reserve exists.
- Final distribution table fixed as:

```text
Community activity airdrop:      30%
Liquidity bootstrap:             15%
Founder allocation:               5%
Ecosystem growth reserve:        25%
Protocol treasury reserve:       15%
Strategic / market operations:   10%
TOTAL:                          100%
```

## Added

- Official ATH pool launch target: after approximately `15,000,000 ATH` has been distributed through Vault activity rewards.
- Explicit rationale: the airdrop is paid-usage activity mining / rebate, not a free claim campaign.
- Explicit pre-pool utility: earned ATH may be used for username purchases before official pool launch. Message fee discounts stay locked until the 15% activity-distribution / pool-launch gate.
- FeeAccumulator bootstrap policy: before the 15% activity distribution / pool-launch gate, protocol TON splits 100% to liquidity bootstrap / treasury; buyback split is enabled later through the one-way `EnableBuybackSplit` gate.

## Unchanged

- Fixed ATH supply.
- No mint-after-deploy.
- Reward remains `10 ATH` per successfully finalized paid publish.
- Reward remains ACK-gated by authenticated `CapsuleHubPublishAck`.
- No per-wallet cap.
- No admin airdrop controls.
- No pause/rescue/override/governance surface.
- FeeAccumulator 51.05 TON buyback envelope semantics.
