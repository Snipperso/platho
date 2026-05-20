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

- Stored hash: 64c49e4eb7964234f860069761ffb2a83a41d6af925980c1578987be86ac70bd
- Rebuilt hash: 64c49e4eb7964234f860069761ffb2a83a41d6af925980c1578987be86ac70bd
- Match: true
- Status: IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS

## Code hashes

| Key | Built | Pinned | Match |
|---|---|---|---|
| ATHMASTER_CODE_HASH | d6af66e6773be0ca4d12e08ebc3380e5a89f188b7a1f5e0f207f0ce87e723059 | d6af66e6773be0ca4d12e08ebc3380e5a89f188b7a1f5e0f207f0ce87e723059 | true |
| ATH_WALLET_CODE_HASH | 5ea6f2351f26b45465518996ba35ce7887e9d9bca3353d13b674ca6180e6e3b4 | 5ea6f2351f26b45465518996ba35ce7887e9d9bca3353d13b674ca6180e6e3b4 | true |
| BUYBACKBURN_CODE_HASH | 130ce2ef10dca3e42c8a991b577404e597f54d4ac2565dfdf6654a8fb11eb921 | 130ce2ef10dca3e42c8a991b577404e597f54d4ac2565dfdf6654a8fb11eb921 | true |
| CAPSULEHUB_CODE_HASH | c901c2915b1626dabc4b222f56679ef305961bed058eb373c7f35682145373d3 | c901c2915b1626dabc4b222f56679ef305961bed058eb373c7f35682145373d3 | true |
| FEEACCUMULATOR_CODE_HASH | ff084907becac5dcc98b372162bab7f6f2a364f4383e5f51676fd069f64db2e3 | ff084907becac5dcc98b372162bab7f6f2a364f4383e5f51676fd069f64db2e3 | true |
| VAULT_CODE_HASH | 270116d1e75a68de2a732a2a02a747a8fc70f6f1d2b71fe748820589085fc7de | 270116d1e75a68de2a732a2a02a747a8fc70f6f1d2b71fe748820589085fc7de | true |
| USERNAME_NFT_ITEM_CODE_HASH | 96861964c8a76cd1d34b16dfcb9f8a4e68ffd652b00ac66ee7dc7410630e16b0 | 96861964c8a76cd1d34b16dfcb9f8a4e68ffd652b00ac66ee7dc7410630e16b0 | true |
| USERNAME_REGISTRY_CODE_HASH | c8e37bb085ea49170cfbc3bd8f039461acae77964a1c7aa82144824844bb4fa3 | c8e37bb085ea49170cfbc3bd8f039461acae77964a1c7aa82144824844bb4fa3 | true |
| MOCK_VAULT_ATH_WALLET_CODE_HASH | 2cd0395b0bbbd0aa6c19398e8e43031e6435bdb5cf7d2e924b4c7e13155df809 | 2cd0395b0bbbd0aa6c19398e8e43031e6435bdb5cf7d2e924b4c7e13155df809 | true |
| MOCK_USERNAME_NFT_ITEM_NO_ACK_CODE_HASH | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | true |

## Remaining final-genesis blockers

- ATH_TREASURY_SUPPLY_MUST_BE_DEPLOYED_WITH_ONE_SHOT_GENESIS_CREDIT
- BUYBACKBURN_ROUTE_SEAL_REQUIRES_M20F_MAINNET_STONFI_EVIDENCE
- STONFI_V2_ROUTE_AND_PAYLOAD_VALUES_NOT_PINNED
- FINAL_DEPLOYMENT_MANIFEST_MUST_REPLACE_FIXTURE_ADDRESSES_WITH_MAINNET_STATEINIT_ADDRESSES
- VAULT_ACTIVITY_AIRDROP_ALLOCATION_MUST_BE_FUNDED_IN_OFFICIAL_VAULT_ATH_WALLET_BEFORE_FINAL_GENESIS
