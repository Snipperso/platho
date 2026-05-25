# Platho M18 Artifact Integrity & Reproducibility Lock

Status: **PASS**

Scope: current implemented subset artifacts, including the M50 MarketStabilitySeller contract. This pass locks generated artifacts against the current build so stale vectors do not quietly survive into later milestones. Yes, apparently files can lie by omission too.

## Checks

- all_code_hash_artifacts_match_build_and_current_file: true
- fee_accumulator_duplicate_hash_artifacts_match: true
- all_vector_artifacts_match_current_build_hashes: true
- manifest_artifacts_match_rebuilt_manifest: true
- all_stable_artifacts_present: true

## Vector checks

- ath_wallet_vectors_use_current_wallet_hash: true
- deployment_ath_binding_uses_current_wallet_hash: true
- username_nft_item_vectors_use_current_hash: true
- username_registry_foundation_vectors_use_current_hashes: true
- username_registry_mint_vectors_use_current_hashes: true
- username_registry_mint_vectors_use_m13_ack_reserve: true
- m17_gas_report_passes: true

## Manifest

- Stored hash: 50b99099ecbca1cac879884cf6089809aa836539af546f009029cdfc76236de6
- Rebuilt hash: 50b99099ecbca1cac879884cf6089809aa836539af546f009029cdfc76236de6
- Match: true
- Status: IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS

## Code hashes

| Key | Built | Pinned | Match |
|---|---|---|---|
| ATHMASTER_CODE_HASH | 79336e388a0ef7cbd6120ea08ce75d5fde44ff49c775d9c83ae95bbf4fd3e21d | 79336e388a0ef7cbd6120ea08ce75d5fde44ff49c775d9c83ae95bbf4fd3e21d | true |
| ATH_WALLET_CODE_HASH | 78fb6968c802e73ff8ccaded016e45bc4e193c8b86cd75b77d8cc3896f61d83d | 78fb6968c802e73ff8ccaded016e45bc4e193c8b86cd75b77d8cc3896f61d83d | true |
| BUYBACKBURN_CODE_HASH | c2225b39dc8472db0ae3121292e1a64cb5fb8c208646d8dc410129eebf8b1b23 | c2225b39dc8472db0ae3121292e1a64cb5fb8c208646d8dc410129eebf8b1b23 | true |
| MARKET_STABILITY_SELLER_CODE_HASH | b0f80fd873688d41bff0f2877784ac48d361d89fae1e13687b6899418c93b460 | b0f80fd873688d41bff0f2877784ac48d361d89fae1e13687b6899418c93b460 | true |
| CAPSULEHUB_CODE_HASH | 9d5f946d2db56aabe39c2c0bde53b7bf074eef516868b372d17ed3997935c3a3 | 9d5f946d2db56aabe39c2c0bde53b7bf074eef516868b372d17ed3997935c3a3 | true |
| FEEACCUMULATOR_CODE_HASH | 593bbab3c38ab877a123459111a3a2f63464c7b74d63db0ff4c1cabddba2ee53 | 593bbab3c38ab877a123459111a3a2f63464c7b74d63db0ff4c1cabddba2ee53 | true |
| PROFILE_REGISTRY_CODE_HASH | 107d8e78a3ba05afab8ad4f7fa144c9544213df69020b0ef9b67919007438eee | 107d8e78a3ba05afab8ad4f7fa144c9544213df69020b0ef9b67919007438eee | true |
| VAULT_CODE_HASH | 7a01561752f830a8b64d33840d8a06b2b0fb4c84178a074f12991f2f75c755e2 | 7a01561752f830a8b64d33840d8a06b2b0fb4c84178a074f12991f2f75c755e2 | true |
| USERNAME_NFT_ITEM_CODE_HASH | c57322294ea75e5e5110f92223ac22587487689940a43654f55a0c9483cc0b11 | c57322294ea75e5e5110f92223ac22587487689940a43654f55a0c9483cc0b11 | true |
| USERNAME_REGISTRY_CODE_HASH | 2391daf57ef3db6e8e1fbe24cb8763e83a242c9227b171e0be5cf6e3ccc7eea9 | 2391daf57ef3db6e8e1fbe24cb8763e83a242c9227b171e0be5cf6e3ccc7eea9 | true |
| MOCK_VAULT_ATH_WALLET_CODE_HASH | 2cd0395b0bbbd0aa6c19398e8e43031e6435bdb5cf7d2e924b4c7e13155df809 | 2cd0395b0bbbd0aa6c19398e8e43031e6435bdb5cf7d2e924b4c7e13155df809 | true |
| MOCK_USERNAME_NFT_ITEM_NO_ACK_CODE_HASH | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | true |

## Remaining final-genesis blockers

- ATH_TREASURY_SUPPLY_MUST_BE_DEPLOYED_WITH_ONE_SHOT_GENESIS_CREDIT
- FINAL_DEPLOYMENT_MANIFEST_MUST_REPLACE_FIXTURE_ADDRESSES_WITH_MAINNET_STATEINIT_ADDRESSES
- VAULT_ACTIVITY_AIRDROP_ALLOCATION_MUST_BE_FUNDED_IN_OFFICIAL_VAULT_ATH_WALLET_BEFORE_FINAL_GENESIS
