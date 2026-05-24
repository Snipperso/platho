# M20X — Vault Community Activity Airdrop

Status: **implemented and locally verified**.

## Summary

M20X implements the Vault-side community activity airdrop:

- 30% of fixed ATH supply allocated to activity airdrop;
- 30,000,000 ATH global cap;
- 10 ATH per successfully finalized paid publish;
- no per-wallet cap;
- reward credited only after authenticated `CapsuleHubPublishAck` for an existing `PendingPublish`;
- final M49 allocation has no founder token allocation;
- market stability reserve is tracked separately from activity rewards and is milestone-gated at x2..x16;
- official ATH pool launch target: after approximately 15,000,000 ATH has been distributed through activity rewards.

The airdrop is a genesis-backed Vault internal ATH balance credit, not a mint and not synthetic points.

## Contract changes

Changed:

- `contracts/Vault.tact`

No changes to:

- `ATHMaster`
- `ATHWallet`
- `CapsuleHub`
- `FeeAccumulator`
- `UsernameNFTItem`
- `UsernameRegistry`

## Test changes

Changed:

- `tests/vault-m6-publish.test.ts`
- `tests/m16-conformance-static.test.ts`

Coverage added:

- valid publish ACK credits 10 ATH;
- bounced publish credits 0 ATH;
- same wallet can accumulate multiple 10 ATH rewards;
- manifest pins total/reward/per-wallet-cap constants.

## Gas note

A naive persisted `airdrop_remaining_ath` field pushed the Vault external session path above TON's pre-accept gas credit. M20X avoids that by reusing the existing `genesis_config_hash` storage slot after seal.

Before seal it remains the genesis-controller hash. After seal it stores `airdrop_remaining_ath`, while `deployment_manifest_hash` becomes the canonical sealed signing/deployment domain.

## Verification

Local verification:

- Vault build: PASS
- Targeted M20X suite: 7 test files / 20 tests passed
- Chunked full regression matrix: 34 test files / 143 tests passed
- Failed chunks: 0

The one-shot full-suite command was not used as the canonical proof in this sandbox because it can hit the outer execution timeout before final summary. Chunked matrix artifacts are used instead.

## Updated hashes

- `VAULT_CODE_HASH=3bb2f05890991151e9bb2dd70a361ed932a24d492e3fbb685c92ff9822b0bfc0`
- `IMPLEMENTED_SUBSET_MANIFEST_HASH=b9f91de2c84c3067184323fd03940e60acfc9a15f760abd6d6240e5bc0c4c451`

Unchanged relevant hashes:

- `FEEACCUMULATOR_CODE_HASH=21c767d17e11146315e13834e6d6fabedb484a7964be6cf72e3f72d4401ec423`
- `CAPSULEHUB_CODE_HASH=d66f03836f43f3e425e0ef0fcf3e65c0f20f364f12a89e4f84960fed15eb5298`
- `USERNAME_REGISTRY_CODE_HASH=0d7c89a953a966deb6f8b6000b902de92907dcfa772b7ac905b65d3b5a06396e`

## Remaining blockers

M20X does not unblock production BuybackBurn.

Remaining final blockers:

- M20T testnet deployment/probe evidence;
- M20F mainnet STON.fi route freeze;
- production BuybackBurn implementation after both gates pass.
