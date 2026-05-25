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

- Stored hash: ea361e69c0526f186d2d44c261186bbaf5ae32a2658fcda7a415ddce715a1c2a
- Rebuilt hash: ea361e69c0526f186d2d44c261186bbaf5ae32a2658fcda7a415ddce715a1c2a
- Match: true
- Status: IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS

## Code hashes

| Key | Built | Pinned | Match |
|---|---|---|---|
| ATHMASTER_CODE_HASH | 27845e181d072be71583816c19d1da1a033f7820b202ea272cb7fe23718e685d | 27845e181d072be71583816c19d1da1a033f7820b202ea272cb7fe23718e685d | true |
| ATH_WALLET_CODE_HASH | 3b11e07332222e393ba11eb8c212edb7e48d7f173a4e2e3e0626f600405f6960 | 3b11e07332222e393ba11eb8c212edb7e48d7f173a4e2e3e0626f600405f6960 | true |
| BUYBACKBURN_CODE_HASH | dea2074e10684c935ea5ff29ae0b62b9be364c249d36359f53c53639add75bd3 | dea2074e10684c935ea5ff29ae0b62b9be364c249d36359f53c53639add75bd3 | true |
| MARKET_STABILITY_SELLER_CODE_HASH | 9d6e349302bcc5bd90759af2005213037b99bee72018d5ffa5096bdabe87e020 | 9d6e349302bcc5bd90759af2005213037b99bee72018d5ffa5096bdabe87e020 | true |
| CAPSULEHUB_CODE_HASH | 9d5f946d2db56aabe39c2c0bde53b7bf074eef516868b372d17ed3997935c3a3 | 9d5f946d2db56aabe39c2c0bde53b7bf074eef516868b372d17ed3997935c3a3 | true |
| FEEACCUMULATOR_CODE_HASH | 593bbab3c38ab877a123459111a3a2f63464c7b74d63db0ff4c1cabddba2ee53 | 593bbab3c38ab877a123459111a3a2f63464c7b74d63db0ff4c1cabddba2ee53 | true |
| PROFILE_REGISTRY_CODE_HASH | d4867f6927b4c64e31b59bc7f30a352b21638b294923383b754845c73896b59b | d4867f6927b4c64e31b59bc7f30a352b21638b294923383b754845c73896b59b | true |
| VAULT_CODE_HASH | 20a3ccf353a2bc34bffa9e58dd3bb011380c6fd15fac8a899eb1b40cd054c3f7 | 20a3ccf353a2bc34bffa9e58dd3bb011380c6fd15fac8a899eb1b40cd054c3f7 | true |
| USERNAME_NFT_ITEM_CODE_HASH | c57322294ea75e5e5110f92223ac22587487689940a43654f55a0c9483cc0b11 | c57322294ea75e5e5110f92223ac22587487689940a43654f55a0c9483cc0b11 | true |
| USERNAME_REGISTRY_CODE_HASH | ad1336daba53d1cb358a9fb0efee263be44c2b67e95d8fd70062ec16dd88d845 | ad1336daba53d1cb358a9fb0efee263be44c2b67e95d8fd70062ec16dd88d845 | true |
| MOCK_VAULT_ATH_WALLET_CODE_HASH | 2cd0395b0bbbd0aa6c19398e8e43031e6435bdb5cf7d2e924b4c7e13155df809 | 2cd0395b0bbbd0aa6c19398e8e43031e6435bdb5cf7d2e924b4c7e13155df809 | true |
| MOCK_USERNAME_NFT_ITEM_NO_ACK_CODE_HASH | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | true |

## Remaining final-genesis blockers

- ATH_TREASURY_SUPPLY_MUST_BE_DEPLOYED_WITH_ONE_SHOT_GENESIS_CREDIT
- FINAL_DEPLOYMENT_MANIFEST_MUST_REPLACE_FIXTURE_ADDRESSES_WITH_MAINNET_STATEINIT_ADDRESSES
- VAULT_ACTIVITY_AIRDROP_ALLOCATION_MUST_BE_FUNDED_IN_OFFICIAL_VAULT_ATH_WALLET_BEFORE_FINAL_GENESIS
