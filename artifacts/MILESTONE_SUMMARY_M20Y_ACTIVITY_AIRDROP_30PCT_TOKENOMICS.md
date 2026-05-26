# M20Y - Activity Airdrop Tokenomics

Status: **implemented and locally verified**.

## Summary

M20Y updates the ATH distribution and Vault activity airdrop allocation:

- activity airdrop: `15%` of fixed supply;
- global activity airdrop cap: `15,000,000 ATH`;
- reward remains `10 ATH` per successfully finalized paid publish;
- maximum rewarded publishes: `1,500,000`;
- no per-wallet cap;
- final allocation: `15%` activity airdrop, `15%` initial liquidity, `10%` long-term protocol vesting, `60%` market stability reserve;
- market stability reserve: `60,000,000 ATH` split into twenty `3,000,000 ATH` tranches at x2..x21 from the initial pool price;
- official ATH pool launch target: after approximately `15,000,000 ATH` has been distributed through Vault activity rewards.

## Contract changes

Changed:

- `contracts/Vault.tact`

The activity airdrop global bucket is fixed at `15,000,000 ATH`.

No changes to reward mechanics:

- reward is still credited only after authenticated `CapsuleHubPublishAck`;
- invalid / bounced / pruned / replayed / non-publish operations still earn zero reward;
- no per-wallet cap was added;
- no admin airdrop surface was added.

## Spec and manifest changes

Changed:

- `artifacts/platho_v1_open_values_v0_20x_vault_activity_airdrop.md`
- `artifacts/platho_v1_open_values_v0_20y_activity_airdrop_30pct_tokenomics.md`
- `scripts/deployment_manifest_m15.ts`
- `tests/m16-conformance-static.test.ts`
- `tests/vault-m6-publish.test.ts`

Updated manifest constant:

```text
vault_activity_airdrop_total_atomic = 15000000000000000
ath_initial_liquidity_allocation_atomic = 15000000000000000
ath_long_term_vesting_allocation_atomic = 10000000000000000
ath_market_stability_reserve_allocation_atomic = 60000000000000000
```

Unchanged manifest constants:

```text
vault_activity_airdrop_reward_per_message_atomic = 10000000000
vault_activity_airdrop_per_wallet_cap_atomic = 0
```

## Verification

- Vault build: PASS
- Targeted activity-airdrop tests: PASS
- M16 manifest/conformance test: PASS

## Final tokenomics note

M49 supersedes the earlier M20Y ecosystem/strategic reserve draft and fixes the allocation table around activity, liquidity, long-term protocol vesting, and market stability.

The market stability reserve is an allocation policy only in this milestone. M50 later adds the separate immutable seller contract; final reserve use still requires seller audit evidence, frozen pricing evidence, and official seller ATH wallet funding proof.

## Remaining blockers

M20Y does not unblock production BuybackBurn.

Remaining blockers:

- M20T testnet deployment/probe evidence;
- M20F mainnet STON.fi route freeze;
- production BuybackBurn implementation after both gates pass.

## Updated hashes

- `VAULT_CODE_HASH=3bb2f05890991151e9bb2dd70a361ed932a24d492e3fbb685c92ff9822b0bfc0`
- `IMPLEMENTED_SUBSET_MANIFEST_HASH=b9f91de2c84c3067184323fd03940e60acfc9a15f760abd6d6240e5bc0c4c451`
