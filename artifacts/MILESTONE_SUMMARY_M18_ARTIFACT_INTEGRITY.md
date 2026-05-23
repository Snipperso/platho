# Platho M18 Artifact Integrity & Reproducibility Lock

Status: **PASS**

Scope: implemented subset artifacts after M17. No contract functionality or code hash was changed. This pass locks generated artifacts against the current build so stale vectors do not quietly survive into later milestones. Yes, apparently files can lie by omission too.

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

- Stored hash: a5905fc94dac120f2dd93f4bda2e636e8c8a3aee6408934461bbd7a9ecbb7df0
- Rebuilt hash: a5905fc94dac120f2dd93f4bda2e636e8c8a3aee6408934461bbd7a9ecbb7df0
- Match: true
- Status: IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS

## Code hashes

| Key | Built | Pinned | Match |
|---|---|---|---|
| ATHMASTER_CODE_HASH | 4523b07bc1612865a8aedc08670ed0c88df78cab5d320e5ee26721ed258754fe | 4523b07bc1612865a8aedc08670ed0c88df78cab5d320e5ee26721ed258754fe | true |
| ATH_WALLET_CODE_HASH | ee68b51fa434cb1477885d1844cfc4ed5677ff3d170a82e91122927f400fea9e | ee68b51fa434cb1477885d1844cfc4ed5677ff3d170a82e91122927f400fea9e | true |
| BUYBACKBURN_CODE_HASH | 67ab28999e3155d9b3569ab852dfc18fd28f56122ebdb7bcca745dff32810ba9 | 67ab28999e3155d9b3569ab852dfc18fd28f56122ebdb7bcca745dff32810ba9 | true |
| CAPSULEHUB_CODE_HASH | 28828c66c0a991ca497b4782ff17fbc717eda1a72c1b612f7300ced26daa2254 | 28828c66c0a991ca497b4782ff17fbc717eda1a72c1b612f7300ced26daa2254 | true |
| FEEACCUMULATOR_CODE_HASH | 471f1fdb5b84dfb6b07e263d3eddd6c1880b7d6bc366c1443c244e08e85a2f5f | 471f1fdb5b84dfb6b07e263d3eddd6c1880b7d6bc366c1443c244e08e85a2f5f | true |
| PROFILE_REGISTRY_CODE_HASH | 9cf0e3c72632df76200752ca3720fe64e9bee574e00ac5e365d8b54d74bb31f6 | 9cf0e3c72632df76200752ca3720fe64e9bee574e00ac5e365d8b54d74bb31f6 | true |
| VAULT_CODE_HASH | 0e3318cbc644b824ec71115690816bfb9fd7bbd26cf42643ef9b5d4f8832d6e4 | 0e3318cbc644b824ec71115690816bfb9fd7bbd26cf42643ef9b5d4f8832d6e4 | true |
| USERNAME_NFT_ITEM_CODE_HASH | c57322294ea75e5e5110f92223ac22587487689940a43654f55a0c9483cc0b11 | c57322294ea75e5e5110f92223ac22587487689940a43654f55a0c9483cc0b11 | true |
| USERNAME_REGISTRY_CODE_HASH | ff8129c4cf80fd16f397d1a019a599b72e008c576f92fe2026fb24dc273e423c | ff8129c4cf80fd16f397d1a019a599b72e008c576f92fe2026fb24dc273e423c | true |
| MOCK_VAULT_ATH_WALLET_CODE_HASH | 2cd0395b0bbbd0aa6c19398e8e43031e6435bdb5cf7d2e924b4c7e13155df809 | 2cd0395b0bbbd0aa6c19398e8e43031e6435bdb5cf7d2e924b4c7e13155df809 | true |
| MOCK_USERNAME_NFT_ITEM_NO_ACK_CODE_HASH | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | true |

## Remaining final-genesis blockers

- ATH_TREASURY_SUPPLY_MUST_BE_DEPLOYED_WITH_ONE_SHOT_GENESIS_CREDIT
- BUYBACKBURN_ROUTE_SEAL_REQUIRES_M20F_MAINNET_STONFI_EVIDENCE
- STONFI_V2_ROUTE_AND_PAYLOAD_VALUES_NOT_PINNED
- FINAL_DEPLOYMENT_MANIFEST_MUST_REPLACE_FIXTURE_ADDRESSES_WITH_MAINNET_STATEINIT_ADDRESSES
- VAULT_ACTIVITY_AIRDROP_ALLOCATION_MUST_BE_FUNDED_IN_OFFICIAL_VAULT_ATH_WALLET_BEFORE_FINAL_GENESIS
