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

- Stored hash: 8b3fa3c3ea993fac281a104a9bd14637b5c571fca79d98bc1b16d95479c09947
- Rebuilt hash: 8b3fa3c3ea993fac281a104a9bd14637b5c571fca79d98bc1b16d95479c09947
- Match: true
- Status: IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS

## Code hashes

| Key | Built | Pinned | Match |
|---|---|---|---|
| ATHMASTER_CODE_HASH | 4d88d83ed5d795eb25f947e8c9f1d19ad7cbedeae93562e27d73b65b54f5a62f | 4d88d83ed5d795eb25f947e8c9f1d19ad7cbedeae93562e27d73b65b54f5a62f | true |
| ATH_WALLET_CODE_HASH | 5c0cf65ee7b44b239a87d181b9167a406b935ac0d0879e8727e96c2e4d68064a | 5c0cf65ee7b44b239a87d181b9167a406b935ac0d0879e8727e96c2e4d68064a | true |
| BUYBACKBURN_CODE_HASH | 23eaae1747dbde64a98d55095ce3715f56fbec15fb3fc80c0fe3af3eb45c6c42 | 23eaae1747dbde64a98d55095ce3715f56fbec15fb3fc80c0fe3af3eb45c6c42 | true |
| CAPSULEHUB_CODE_HASH | 8669ba06c90a9d909e29567cd3437f0ae93bfca65f04538d89fc564a26379eed | 8669ba06c90a9d909e29567cd3437f0ae93bfca65f04538d89fc564a26379eed | true |
| FEEACCUMULATOR_CODE_HASH | ff084907becac5dcc98b372162bab7f6f2a364f4383e5f51676fd069f64db2e3 | ff084907becac5dcc98b372162bab7f6f2a364f4383e5f51676fd069f64db2e3 | true |
| VAULT_CODE_HASH | 419273f08cbb6036894a10a505bff41a0bef19eedbaec4281620fcc0912058d4 | 419273f08cbb6036894a10a505bff41a0bef19eedbaec4281620fcc0912058d4 | true |
| USERNAME_NFT_ITEM_CODE_HASH | bf2735f371ba1eaa77fd37c8eaab847fac40e2357d2e7850c9e444dc3b00df1e | bf2735f371ba1eaa77fd37c8eaab847fac40e2357d2e7850c9e444dc3b00df1e | true |
| USERNAME_REGISTRY_CODE_HASH | f56f018c96332f480437578cd55c3b9501e06129e75f4c81700ebe9bc7be880e | f56f018c96332f480437578cd55c3b9501e06129e75f4c81700ebe9bc7be880e | true |
| MOCK_VAULT_ATH_WALLET_CODE_HASH | 2cd0395b0bbbd0aa6c19398e8e43031e6435bdb5cf7d2e924b4c7e13155df809 | 2cd0395b0bbbd0aa6c19398e8e43031e6435bdb5cf7d2e924b4c7e13155df809 | true |
| MOCK_USERNAME_NFT_ITEM_NO_ACK_CODE_HASH | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | true |

## Remaining final-genesis blockers

- ATH_TREASURY_SUPPLY_MUST_BE_DEPLOYED_WITH_ONE_SHOT_GENESIS_CREDIT
- BUYBACKBURN_ROUTE_SEAL_REQUIRES_M20F_MAINNET_STONFI_EVIDENCE
- STONFI_V2_ROUTE_AND_PAYLOAD_VALUES_NOT_PINNED
- FINAL_DEPLOYMENT_MANIFEST_MUST_REPLACE_FIXTURE_ADDRESSES_WITH_MAINNET_STATEINIT_ADDRESSES
- VAULT_ACTIVITY_AIRDROP_ALLOCATION_MUST_BE_FUNDED_IN_OFFICIAL_VAULT_ATH_WALLET_BEFORE_FINAL_GENESIS
