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

- Stored hash: dd80c277f2750f2f7ab541f127274de4c1e0dac384af83f2ac684b13141e59e1
- Rebuilt hash: dd80c277f2750f2f7ab541f127274de4c1e0dac384af83f2ac684b13141e59e1
- Match: true
- Status: IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS

## Code hashes

| Key | Built | Pinned | Match |
|---|---|---|---|
| ATHMASTER_CODE_HASH | f80201e598a2a04a4bee38a4fa9ddbbd88e20e0b6ca0866d592c21be84f2ad23 | f80201e598a2a04a4bee38a4fa9ddbbd88e20e0b6ca0866d592c21be84f2ad23 | true |
| ATH_WALLET_CODE_HASH | 0dfb19e109cbdfa9bfb0d63a928da98a68c60bee7e9e5e1db908b9ddc20d962a | 0dfb19e109cbdfa9bfb0d63a928da98a68c60bee7e9e5e1db908b9ddc20d962a | true |
| BUYBACKBURN_CODE_HASH | a509649f2e1380de5b3852a5e65d9c6c413ee7be72383ba04d0f46bf5c053c78 | a509649f2e1380de5b3852a5e65d9c6c413ee7be72383ba04d0f46bf5c053c78 | true |
| MARKET_STABILITY_SELLER_CODE_HASH | 8311bacfb7753510cccaf702a9060b8521f6d6184f6851cb47c0fc72ea90f02e | 8311bacfb7753510cccaf702a9060b8521f6d6184f6851cb47c0fc72ea90f02e | true |
| CAPSULEHUB_CODE_HASH | 9d5f946d2db56aabe39c2c0bde53b7bf074eef516868b372d17ed3997935c3a3 | 9d5f946d2db56aabe39c2c0bde53b7bf074eef516868b372d17ed3997935c3a3 | true |
| FEEACCUMULATOR_CODE_HASH | 593bbab3c38ab877a123459111a3a2f63464c7b74d63db0ff4c1cabddba2ee53 | 593bbab3c38ab877a123459111a3a2f63464c7b74d63db0ff4c1cabddba2ee53 | true |
| PROFILE_REGISTRY_CODE_HASH | d2f67e1b19da127cb17ea285c68591092668d064266c0c85c60328cdc93a3b09 | d2f67e1b19da127cb17ea285c68591092668d064266c0c85c60328cdc93a3b09 | true |
| VAULT_CODE_HASH | 85ca7752d35a1339d7a6776663aff90afb4a3c40c23eb35bc4c7c4561fad2187 | 85ca7752d35a1339d7a6776663aff90afb4a3c40c23eb35bc4c7c4561fad2187 | true |
| USERNAME_NFT_ITEM_CODE_HASH | c57322294ea75e5e5110f92223ac22587487689940a43654f55a0c9483cc0b11 | c57322294ea75e5e5110f92223ac22587487689940a43654f55a0c9483cc0b11 | true |
| USERNAME_REGISTRY_CODE_HASH | 73f18746b5d730f599e5cad764930416ef8518f0bfa31d3e68abce5b45886311 | 73f18746b5d730f599e5cad764930416ef8518f0bfa31d3e68abce5b45886311 | true |
| MOCK_VAULT_ATH_WALLET_CODE_HASH | 2cd0395b0bbbd0aa6c19398e8e43031e6435bdb5cf7d2e924b4c7e13155df809 | 2cd0395b0bbbd0aa6c19398e8e43031e6435bdb5cf7d2e924b4c7e13155df809 | true |
| MOCK_USERNAME_NFT_ITEM_NO_ACK_CODE_HASH | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | true |

## Remaining final-genesis blockers

- ATH_TREASURY_SUPPLY_MUST_BE_DEPLOYED_WITH_ONE_SHOT_GENESIS_CREDIT
- FINAL_DEPLOYMENT_MANIFEST_MUST_REPLACE_FIXTURE_ADDRESSES_WITH_MAINNET_STATEINIT_ADDRESSES
- VAULT_ACTIVITY_AIRDROP_ALLOCATION_MUST_BE_FUNDED_IN_OFFICIAL_VAULT_ATH_WALLET_BEFORE_FINAL_GENESIS
