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

- Stored hash: ccd07ed16b72a0ecce24ee96315f0fb8445a7ea47e987c4d446456fbbdcce9a7
- Rebuilt hash: ccd07ed16b72a0ecce24ee96315f0fb8445a7ea47e987c4d446456fbbdcce9a7
- Match: true
- Status: IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS

## Code hashes

| Key | Built | Pinned | Match |
|---|---|---|---|
| ATHMASTER_CODE_HASH | 8aea24d6815a6194bf5f29d753045c0f734c376d6c33e48d03b08f0db0d10d22 | 8aea24d6815a6194bf5f29d753045c0f734c376d6c33e48d03b08f0db0d10d22 | true |
| ATH_WALLET_CODE_HASH | e32fca475dec8679fba117fb72a91571492fec9c7eaf8aa3f854abbab95b5380 | e32fca475dec8679fba117fb72a91571492fec9c7eaf8aa3f854abbab95b5380 | true |
| BUYBACKBURN_CODE_HASH | d6ba5959f20c70568bdf287019f2f94803a2cd20ab2661cde6c39d65a8630c27 | d6ba5959f20c70568bdf287019f2f94803a2cd20ab2661cde6c39d65a8630c27 | true |
| MARKET_STABILITY_SELLER_CODE_HASH | 780427578c7aa73fa6dd217c3aa28f6a231ea626927b9f4e9b26da563ab2b8d3 | 780427578c7aa73fa6dd217c3aa28f6a231ea626927b9f4e9b26da563ab2b8d3 | true |
| CAPSULEHUB_CODE_HASH | 9d5f946d2db56aabe39c2c0bde53b7bf074eef516868b372d17ed3997935c3a3 | 9d5f946d2db56aabe39c2c0bde53b7bf074eef516868b372d17ed3997935c3a3 | true |
| FEEACCUMULATOR_CODE_HASH | 593bbab3c38ab877a123459111a3a2f63464c7b74d63db0ff4c1cabddba2ee53 | 593bbab3c38ab877a123459111a3a2f63464c7b74d63db0ff4c1cabddba2ee53 | true |
| PROFILE_REGISTRY_CODE_HASH | 86d22f8748bcf8971bc6b40ff9c937bd13c304e2feed62a7ca9bc279fbd1514c | 86d22f8748bcf8971bc6b40ff9c937bd13c304e2feed62a7ca9bc279fbd1514c | true |
| VAULT_CODE_HASH | d6bcbb10b6b32bfc51ff2013bb7b92fc06a96b47c9ea46d2849a870aecb57033 | d6bcbb10b6b32bfc51ff2013bb7b92fc06a96b47c9ea46d2849a870aecb57033 | true |
| USERNAME_NFT_ITEM_CODE_HASH | c57322294ea75e5e5110f92223ac22587487689940a43654f55a0c9483cc0b11 | c57322294ea75e5e5110f92223ac22587487689940a43654f55a0c9483cc0b11 | true |
| USERNAME_REGISTRY_CODE_HASH | 49eaa388ca9c8e8641f4b231c08aea0c1f8adc2c3e1bf93b719e29a2690478b7 | 49eaa388ca9c8e8641f4b231c08aea0c1f8adc2c3e1bf93b719e29a2690478b7 | true |
| MOCK_VAULT_ATH_WALLET_CODE_HASH | 2cd0395b0bbbd0aa6c19398e8e43031e6435bdb5cf7d2e924b4c7e13155df809 | 2cd0395b0bbbd0aa6c19398e8e43031e6435bdb5cf7d2e924b4c7e13155df809 | true |
| MOCK_USERNAME_NFT_ITEM_NO_ACK_CODE_HASH | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | true |

## Remaining final-genesis blockers

- ATH_TREASURY_SUPPLY_MUST_BE_DEPLOYED_WITH_ONE_SHOT_GENESIS_CREDIT
- FINAL_DEPLOYMENT_MANIFEST_MUST_REPLACE_FIXTURE_ADDRESSES_WITH_MAINNET_STATEINIT_ADDRESSES
- VAULT_ACTIVITY_AIRDROP_ALLOCATION_MUST_BE_FUNDED_IN_OFFICIAL_VAULT_ATH_WALLET_BEFORE_FINAL_GENESIS
