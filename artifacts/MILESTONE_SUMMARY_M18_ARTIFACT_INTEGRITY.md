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

- Stored hash: 02ae87e7990dec8cb9d18558b330b508310497f11823bc0099709f9bc6f36546
- Rebuilt hash: 02ae87e7990dec8cb9d18558b330b508310497f11823bc0099709f9bc6f36546
- Match: true
- Status: IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS

## Code hashes

| Key | Built | Pinned | Match |
|---|---|---|---|
| ATHMASTER_CODE_HASH | cb8a4df55f9db17167802559122a7e435ff0b3d354e550c0c3121ad5bbc2e0c6 | cb8a4df55f9db17167802559122a7e435ff0b3d354e550c0c3121ad5bbc2e0c6 | true |
| ATH_WALLET_CODE_HASH | d6452b3d9f5170cc84a25b3dcd5cdcd77ae7c0b342848cef5872c6f2e002f1f6 | d6452b3d9f5170cc84a25b3dcd5cdcd77ae7c0b342848cef5872c6f2e002f1f6 | true |
| BUYBACKBURN_CODE_HASH | 75d0cafca41bb5a5da6e5024e298ac915e4af56d326b24acc0dceae50d43c53b | 75d0cafca41bb5a5da6e5024e298ac915e4af56d326b24acc0dceae50d43c53b | true |
| CAPSULEHUB_CODE_HASH | 8669ba06c90a9d909e29567cd3437f0ae93bfca65f04538d89fc564a26379eed | 8669ba06c90a9d909e29567cd3437f0ae93bfca65f04538d89fc564a26379eed | true |
| FEEACCUMULATOR_CODE_HASH | ff084907becac5dcc98b372162bab7f6f2a364f4383e5f51676fd069f64db2e3 | ff084907becac5dcc98b372162bab7f6f2a364f4383e5f51676fd069f64db2e3 | true |
| VAULT_CODE_HASH | f5ccdf80e77aa4c59e4d41e4c1370795c6644f9309827c8c872e46c365e27d12 | f5ccdf80e77aa4c59e4d41e4c1370795c6644f9309827c8c872e46c365e27d12 | true |
| USERNAME_NFT_ITEM_CODE_HASH | bf2735f371ba1eaa77fd37c8eaab847fac40e2357d2e7850c9e444dc3b00df1e | bf2735f371ba1eaa77fd37c8eaab847fac40e2357d2e7850c9e444dc3b00df1e | true |
| USERNAME_REGISTRY_CODE_HASH | 862624edc726af1e489dac6778997c9ccbf356626eef476f4afeaa78991a199a | 862624edc726af1e489dac6778997c9ccbf356626eef476f4afeaa78991a199a | true |
| MOCK_VAULT_ATH_WALLET_CODE_HASH | 2cd0395b0bbbd0aa6c19398e8e43031e6435bdb5cf7d2e924b4c7e13155df809 | 2cd0395b0bbbd0aa6c19398e8e43031e6435bdb5cf7d2e924b4c7e13155df809 | true |
| MOCK_USERNAME_NFT_ITEM_NO_ACK_CODE_HASH | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | true |

## Remaining final-genesis blockers

- ATH_TREASURY_SUPPLY_MUST_BE_DEPLOYED_WITH_ONE_SHOT_GENESIS_CREDIT
- BUYBACKBURN_ROUTE_SEAL_REQUIRES_M20F_MAINNET_STONFI_EVIDENCE
- STONFI_V2_ROUTE_AND_PAYLOAD_VALUES_NOT_PINNED
- FINAL_DEPLOYMENT_MANIFEST_MUST_REPLACE_FIXTURE_ADDRESSES_WITH_MAINNET_STATEINIT_ADDRESSES
- VAULT_ACTIVITY_AIRDROP_ALLOCATION_MUST_BE_FUNDED_IN_OFFICIAL_VAULT_ATH_WALLET_BEFORE_FINAL_GENESIS
