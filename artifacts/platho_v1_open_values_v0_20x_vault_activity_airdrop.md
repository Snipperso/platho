# Platho v1 Open Values v0.20X — Vault Community Activity Airdrop

Status: implemented and locally verified in targeted regression tests.

## Scope

M20X changes the ATH community distribution profile and implements the Vault-side activity airdrop mechanics.

The airdrop is a fixed genesis-backed allocation, not a post-deploy mint and not synthetic points.

## Token distribution change

ATH total supply remains fixed:

- `ATH_TOTAL_SUPPLY = 100,000,000 ATH`
- `ATH_DECIMALS = 9`
- `ATH_TOTAL_SUPPLY_ATOMIC = 100,000,000,000,000,000`

Community activity airdrop allocation:

- `15%` of total ATH supply;
- `15,000,000 ATH`;
- `15,000,000,000,000,000` atomic units.

This supersedes the older 5% community airdrop candidate. The final activity airdrop is 15% of fixed supply. Early user distribution is performed through the Vault activity airdrop. Supply remains fixed. No mint-after-deploy behavior is introduced.


## Final token distribution

```text
Community activity airdrop:      15%
Liquidity bootstrap:             15%
Treasury / operations:           10%
Market stability reserve:        60%
Founder allocation:               0%
TOTAL:                          100%
```

M49 fixes the final reserve policy: the `60%` market stability reserve is released only through milestone-gated x2..x21 tranches, and there is no founder token allocation.

Official ATH pool launch target:

```text
Launch the official ATH liquidity pool after approximately 15,000,000 ATH,
that is 15% of total supply, has been distributed through activity rewards.
```

The activity airdrop stops at the pool-launch gate once the global 15,000,000 ATH bucket is exhausted.

## Airdrop reward rule

Vault credits activity rewards to internal Vault ATH balances:

- `10 ATH` per successfully finalized paid publish;
- `10,000,000,000` atomic units per reward;
- maximum global reward count: `1,500,000` rewarded publishes.

A publish is rewardable only after `Vault` receives an authenticated `CapsuleHubPublishAck` from the sealed `CapsuleHub` address and validates that the ACK matches an existing `PendingPublish`.

Rewarded publish kinds:

- private standard publish;
- private long-term publish;
- public post publish.

## No per-wallet cap

M20X intentionally uses only a global cap:

- global cap: `15,000,000 ATH`;
- per-wallet cap: `none`;
- manifest representation: `vault_activity_airdrop_per_wallet_cap_atomic = 0`.

Reason: every rewarded publish requires a paid protocol action. At roughly `0.01 TON` per message, fully exhausting the `1,500,000` publish reward pool requires about `15,000 TON` of aggregate paid user activity. The airdrop is an activity rebate and early utility bootstrap, not a free claim campaign.

Users may intentionally accumulate ATH for:

- protocol fee discounts;
- username purchases;
- pre-pool utility before the official ATH liquidity pool is launched.

## Non-rewardable events

Vault must not credit activity airdrop for:

- invalid external session requests;
- failed signature/session/profile validation;
- duplicate/replayed publish requests;
- bounced CapsuleHub publish messages;
- pruned stale pending publishes;
- arbitrary inbound messages;
- system/deployment messages;
- ATH deposits/withdrawals;
- receive-intent creates/claims/cancels;
- username operations.

## Global cap semantics

Vault tracks the remaining activity airdrop allocation.

On each valid `CapsuleHubPublishAck`:

1. verify sender is the sealed `CapsuleHub`;
2. verify `PendingPublish` exists;
3. recompute expected `publish_id`;
4. refund any returned TON budget according to existing pending-publish semantics;
5. credit activity airdrop reward to `pending.owner_wallet`;
6. delete the pending publish.

Reward amount:

```text
reward = min(10 ATH, airdrop_remaining_ath)
```

When `airdrop_remaining_ath == 0`, Vault credits no further activity airdrop rewards.

The final reward may be less than `10 ATH` only if less than `10 ATH` remains in the global airdrop bucket.

## Backing invariant

The airdrop is economically backed by the genesis community activity allocation assigned to the official Vault ATH wallet / Vault-backed allocation.

Vault internal ATH balances created by activity rewards are real ATH claims against that allocation. They are not unbacked points.

Required deployment invariant:

```text
Vault activity airdrop allocation = 15,000,000 ATH
Vault must never credit more than the remaining activity airdrop allocation
```

## Implementation note

Vault is external-session gas-sensitive. Adding new persisted fields to Vault can exceed TON's pre-`acceptMessage()` external inbound credit on the session publish path.

M20X therefore does not add new persisted Vault fields. It reuses the existing `genesis_config_hash` storage slot after seal:

- before seal: `genesis_config_hash = hash(genesis_controller_address)`;
- at `SealGenesis`: `genesis_config_hash = 15,000,000 ATH atomic`;
- after seal: `genesis_config_hash` stores `airdrop_remaining_ath`;
- the canonical sealed deployment/signing domain uses `deployment_manifest_hash`.

This preserves the external session gas profile while adding the activity airdrop bucket.

## Non-goals

M20X does not:

- add a per-wallet airdrop cap;
- mint ATH after deploy;
- add admin airdrop controls;
- add pause/rescue/override/governance;
- change FeeAccumulator buyback envelope semantics;
- implement production BuybackBurn;
- enable STON.fi route freeze flags.
