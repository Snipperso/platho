# Platho v1 open values v0.21A — Vault activity airdrop economic safety audit

## Scope

This pass audits the M20Y/M20Z Vault activity airdrop semantics:

- 15% ATH community activity airdrop allocation.
- 10 ATH credited per successfully finalized paid Vault publish.
- No per-wallet cap.
- Global cap only: 15,000,000 ATH.
- Reward trigger: authenticated `CapsuleHubPublishAck` for an existing `PendingPublish`.
- No reward for bounce, prune, failed publish, invalid external request, replay, service/system paths, deposits, withdrawals, or receive-intent operations.

## Result

No reproducible runtime C/H/M issue was found in the checked Vault airdrop money path.

The pass did identify one deployment/evidence consistency requirement:

`VAULT_ACTIVITY_AIRDROP_ALLOCATION_MUST_BE_FUNDED_IN_OFFICIAL_VAULT_ATH_WALLET_BEFORE_FINAL_GENESIS`

The Vault contract tracks the remaining global airdrop bucket internally, but it cannot query the ATH jetton wallet balance during `SealGenesis`. Therefore final genesis must not be considered ready unless the official Vault ATH wallet is funded with the full activity airdrop backing allocation before seal/deployment evidence is accepted.

This is an operational final-genesis blocker, not an admin or runtime control surface.

## Pinned values

- `vault_activity_airdrop_total_atomic = 15000000000000000`
- `vault_activity_airdrop_reward_per_message_atomic = 10000000000`
- `vault_activity_airdrop_per_wallet_cap_atomic = 0`

## Required final-genesis evidence

Before final genesis:

1. The official Vault ATH wallet address must be derived from the sealed Vault address and ATH master.
2. The official Vault ATH wallet must be funded with at least `15,000,000 ATH` backing allocation.
3. The final deployment evidence bundle must include the ATH wallet address, observed balance, transaction hash, and explorer link.
4. The deployment manifest must retain the blocker until the funding evidence is present.

## Runtime invariants checked

- Successful ACK credits exactly 10 ATH while airdrop remains.
- Successful ACK decrements `airdrop_remaining_ath` and increments distributed view.
- Repeat successful publishes by the same wallet accumulate rewards without per-wallet cap.
- Airdropped ATH affects the next message fee discount.
- Bounce path does not credit ATH.
- Stale prune path does not credit ATH.
- Late ACK after prune does not credit ATH.
- Manifest pins the 15% allocation and no per-wallet cap.
