# Platho v1 Open Values v0.20Y - Activity Airdrop Tokenomics

Status: implemented in Vault constants and locally verified by targeted tests.

## Scope

M20Y updates the ATH token distribution and Vault activity airdrop allocation after the M20X activity-airdrop mechanism was introduced.

M20Y does not change the reward mechanics:

- reward is still `10 ATH` per successfully finalized paid publish;
- reward is still credited only after authenticated `CapsuleHubPublishAck` for an existing `PendingPublish`;
- there is still no per-wallet cap;
- there is still only a global airdrop bucket;
- no mint-after-deploy behavior is introduced.

M20Y changes only the final allocation size and token distribution table.

## Final ATH distribution

ATH total supply remains fixed:

- `ATH_TOTAL_SUPPLY = 100,000,000 ATH`
- `ATH_DECIMALS = 9`
- `ATH_TOTAL_SUPPLY_ATOMIC = 100,000,000,000,000,000`

Final distribution:

```text
Community activity airdrop:      15%
Liquidity bootstrap:             15%
Treasury / operations:           10%
Market stability reserve:        60%
Founder allocation:               0%
TOTAL:                          100%
```

There is no founder token allocation. Early users receive ATH through paid protocol usage via the Vault activity airdrop.

The market stability reserve is `60,000,000 ATH`. It is reserved for gradual market release only after price milestones, not for partnerships, discretionary founder grants, or vague ecosystem spending.

Planned tranche policy:

```text
x2  initial pool price: 3,000,000 ATH
x3  initial pool price: 3,000,000 ATH
x4  initial pool price: 3,000,000 ATH
x5  initial pool price: 3,000,000 ATH
x6  initial pool price: 3,000,000 ATH
x7  initial pool price: 3,000,000 ATH
x8  initial pool price: 3,000,000 ATH
x9  initial pool price: 3,000,000 ATH
x10 initial pool price: 3,000,000 ATH
x11 initial pool price: 3,000,000 ATH
x12 initial pool price: 3,000,000 ATH
x13 initial pool price: 3,000,000 ATH
x14 initial pool price: 3,000,000 ATH
x15 initial pool price: 3,000,000 ATH
x16 initial pool price: 3,000,000 ATH
x17 initial pool price: 3,000,000 ATH
x18 initial pool price: 3,000,000 ATH
x19 initial pool price: 3,000,000 ATH
x20 initial pool price: 3,000,000 ATH
x21 initial pool price: 3,000,000 ATH
```

M50 later adds the automated market-stability seller as a separate immutable contract. Until that seller is deployed, audited, sealed with frozen pricing evidence, and funded through its official ATH wallet, the reserve remains an allocation commitment, not an operational on-chain sell mechanism.

## Activity airdrop allocation

Community activity airdrop allocation:

- `15%` of total ATH supply;
- `15,000,000 ATH`;
- `15,000,000,000,000,000` atomic units.

Reward rule:

- `10 ATH` per successfully finalized paid publish;
- `10,000,000,000` atomic units per reward;
- maximum global reward count: `1,500,000` rewarded publishes.

There is no per-wallet cap because every reward requires a paid protocol action. At roughly `0.01 TON` per message, fully exhausting the `1,500,000` publish reward pool requires about `15,000 TON` of aggregate paid user activity.

The activity airdrop is an early usage rebate and utility bootstrap, not a free claim campaign.

## Official ATH pool launch target

The official ATH liquidity pool may be launched after approximately:

```text
15,000,000 ATH
```

has been distributed through Vault activity rewards.

That is `15%` of total supply and half of the final `15,000,000 ATH` activity airdrop allocation.

The remaining `15,000,000 ATH` activity airdrop allocation continues after pool launch until the global bucket is exhausted.

## User utility before pool launch

Before the official ATH pool launch, users can still accumulate ATH through paid messaging and use the internal Vault ATH balance for protocol utility, including:

- username purchases.

This creates ATH ownership through real protocol usage before market trading begins.

Message protocol-fee discounts unlock only after approximately `15,000,000 ATH` has been distributed through Vault activity rewards. Before that threshold, message publish fees use the full protocol fee so early protocol TON can bootstrap liquidity / treasury instead of being immediately discounted away.

## Vault implementation constants

Vault activity airdrop constants:

```text
vault_activity_airdrop_total_atomic = 15000000000000000
vault_activity_airdrop_reward_per_message_atomic = 10000000000
vault_activity_airdrop_per_wallet_cap_atomic = 0
```

`vault_activity_airdrop_per_wallet_cap_atomic = 0` means no per-wallet cap.

## Invariants

Vault must preserve the following invariants:

1. Vault must never credit more than `15,000,000 ATH` through activity rewards.
2. Activity reward can be credited only after authenticated `CapsuleHubPublishAck` for an existing `PendingPublish`.
3. Failed, bounced, pruned, replayed, invalid, system, deposit, withdrawal, receive-intent, and username operations do not earn activity rewards.
4. The final reward may be less than `10 ATH` only if less than `10 ATH` remains in the global bucket.
5. The activity airdrop is backed by fixed genesis allocation, not by mint-after-deploy behavior.
6. No per-wallet cap is applied.
