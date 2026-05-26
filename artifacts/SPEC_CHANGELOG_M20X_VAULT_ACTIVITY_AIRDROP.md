# SPEC CHANGELOG — M20X Vault Activity Airdrop

## Added

- Community activity airdrop allocation set to 15% of fixed ATH supply.
- Vault activity reward rule: 10 ATH per successfully finalized paid publish.
- Global-only airdrop cap: 15,000,000 ATH total.
- Explicit no per-wallet cap rule.
- Vault global view fields for activity airdrop accounting:
  - `airdrop_remaining_ath`
  - `airdrop_distributed_ath`
  - `airdrop_reward_per_message_ath`
  - `airdrop_total_allocation_ath`
- Implemented-subset manifest constants:
  - `vault_activity_airdrop_total_atomic = 15000000000000000`
  - `vault_activity_airdrop_reward_per_message_atomic = 10000000000`
  - `vault_activity_airdrop_per_wallet_cap_atomic = 0`

## Changed

- Final token distribution updated and later superseded by M49 as: community activity airdrop 15%, initial liquidity 15%, long-term protocol vesting 10%, market stability reserve 60%.
- Official ATH pool launch target added: after approximately 15,000,000 ATH has been distributed through Vault activity rewards.
- FeeAccumulator bootstrap split added: protocol TON goes 100% to liquidity bootstrap / treasury until the post-15% pool-launch gate enables buyback split.
- Message ATH discounts are also locked until the same 15,000,000 ATH distribution gate.

- Vault now credits 10 ATH to the publish owner after authenticated `CapsuleHubPublishAck` for a valid existing `PendingPublish`.
- Vault signature/publish-id domain now uses `deployment_manifest_hash` as the sealed canonical domain.
- After seal, Vault's existing `genesis_config_hash` slot stores `airdrop_remaining_ath` to avoid adding gas-expensive persisted state.

## Unchanged

- ATH fixed supply.
- No mint-after-deploy.
- No per-wallet cap.
- No admin/governance/pause/rescue surface.
- Bounce/prune/invalid publish paths do not earn rewards.
- FeeAccumulator 51.05 TON buyback envelope semantics.
- STON.fi route freeze and BuybackBurn readiness flags remain false.
