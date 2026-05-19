# M20Y — 30% Activity Airdrop Tokenomics

Status: **implemented and locally verified**.

## Summary

M20Y updates the ATH distribution and Vault activity airdrop allocation:

- activity airdrop: `30%` of fixed supply;
- global activity airdrop cap: `30,000,000 ATH`;
- reward remains `10 ATH` per successfully finalized paid publish;
- maximum rewarded publishes: `3,000,000`;
- no per-wallet cap;
- founder allocation target: `5%`;
- no separate early-user / launch reserve;
- official ATH pool launch target: after approximately `15,000,000 ATH` has been distributed through Vault activity rewards.

## Contract changes

Changed:

- `contracts/Vault.tact`

Only the activity airdrop global bucket constant changed from `15,000,000 ATH` to `30,000,000 ATH`.

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
vault_activity_airdrop_total_atomic = 30000000000000000
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

## Remaining blockers

M20Y does not unblock production BuybackBurn.

Remaining blockers:

- M20T testnet deployment/probe evidence;
- M20F mainnet STON.fi route freeze;
- production BuybackBurn implementation after both gates pass.

## Updated hashes

- `VAULT_CODE_HASH=3bb2f05890991151e9bb2dd70a361ed932a24d492e3fbb685c92ff9822b0bfc0`
- `IMPLEMENTED_SUBSET_MANIFEST_HASH=fb1260abe7b47f5c3cc11297d7da0e3c2fed26221e1d77434be89b4a9e980ffb`
