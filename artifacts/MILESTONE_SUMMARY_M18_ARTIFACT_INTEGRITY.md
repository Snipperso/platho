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

- Stored hash: 21e60483d3e1a0cf20166e9894a28882c28a6d960ce63ff34297fbeafdddd5ac
- Rebuilt hash: 21e60483d3e1a0cf20166e9894a28882c28a6d960ce63ff34297fbeafdddd5ac
- Match: true
- Status: IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS

## Code hashes

| Key | Built | Pinned | Match |
|---|---|---|---|
| ATHMASTER_CODE_HASH | fecd0b4fd3435ed3b7ca88d3542e7c452bc474c3c9bbb8103bbe19f3f64710ce | fecd0b4fd3435ed3b7ca88d3542e7c452bc474c3c9bbb8103bbe19f3f64710ce | true |
| ATH_WALLET_CODE_HASH | b1edef475b60e5f4da111b8226a767aa807f96b9382acb659fa97a4672535b98 | b1edef475b60e5f4da111b8226a767aa807f96b9382acb659fa97a4672535b98 | true |
| BUYBACKBURN_CODE_HASH | 94eeb47e3a6bf90c7e0ebf374a34acd699ce3163bb8df6b30c550f8b0f777c0f | 94eeb47e3a6bf90c7e0ebf374a34acd699ce3163bb8df6b30c550f8b0f777c0f | true |
| CAPSULEHUB_CODE_HASH | 8669ba06c90a9d909e29567cd3437f0ae93bfca65f04538d89fc564a26379eed | 8669ba06c90a9d909e29567cd3437f0ae93bfca65f04538d89fc564a26379eed | true |
| FEEACCUMULATOR_CODE_HASH | ff084907becac5dcc98b372162bab7f6f2a364f4383e5f51676fd069f64db2e3 | ff084907becac5dcc98b372162bab7f6f2a364f4383e5f51676fd069f64db2e3 | true |
| VAULT_CODE_HASH | b1c08d999bb7eb0f664e7296ea20ff2997b8221340c1cd177e3b5839dd2c59c0 | b1c08d999bb7eb0f664e7296ea20ff2997b8221340c1cd177e3b5839dd2c59c0 | true |
| USERNAME_NFT_ITEM_CODE_HASH | bf2735f371ba1eaa77fd37c8eaab847fac40e2357d2e7850c9e444dc3b00df1e | bf2735f371ba1eaa77fd37c8eaab847fac40e2357d2e7850c9e444dc3b00df1e | true |
| USERNAME_REGISTRY_CODE_HASH | 7894e8e91e4959b70b3be353c5cce500eb27f8b4c454aa2b6b83983d202d7887 | 7894e8e91e4959b70b3be353c5cce500eb27f8b4c454aa2b6b83983d202d7887 | true |
| MOCK_VAULT_ATH_WALLET_CODE_HASH | 2cd0395b0bbbd0aa6c19398e8e43031e6435bdb5cf7d2e924b4c7e13155df809 | 2cd0395b0bbbd0aa6c19398e8e43031e6435bdb5cf7d2e924b4c7e13155df809 | true |
| MOCK_USERNAME_NFT_ITEM_NO_ACK_CODE_HASH | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | true |

## Remaining final-genesis blockers

- ATH_TREASURY_SUPPLY_MUST_BE_DEPLOYED_WITH_ONE_SHOT_GENESIS_CREDIT
- BUYBACKBURN_ROUTE_SEAL_REQUIRES_M20F_MAINNET_STONFI_EVIDENCE
- STONFI_V2_ROUTE_AND_PAYLOAD_VALUES_NOT_PINNED
- FINAL_DEPLOYMENT_MANIFEST_MUST_REPLACE_FIXTURE_ADDRESSES_WITH_MAINNET_STATEINIT_ADDRESSES
- VAULT_ACTIVITY_AIRDROP_ALLOCATION_MUST_BE_FUNDED_IN_OFFICIAL_VAULT_ATH_WALLET_BEFORE_FINAL_GENESIS
