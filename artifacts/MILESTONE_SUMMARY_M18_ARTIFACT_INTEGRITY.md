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

- Stored hash: 2d73f3908e64af8443172376fc096555136d152b589ee60412c09eefd0c241cd
- Rebuilt hash: 2d73f3908e64af8443172376fc096555136d152b589ee60412c09eefd0c241cd
- Match: true
- Status: IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS

## Code hashes

| Key | Built | Pinned | Match |
|---|---|---|---|
| ATHMASTER_CODE_HASH | 83e0d67eea0dbf385aa716a931ce093f9fed25cad4304bc8caa866eec34a7cb5 | 83e0d67eea0dbf385aa716a931ce093f9fed25cad4304bc8caa866eec34a7cb5 | true |
| ATH_WALLET_CODE_HASH | bee2548d5aa56c9c45acd0ad7901052eb578858a6b8b95a57b83950b5a0baeb4 | bee2548d5aa56c9c45acd0ad7901052eb578858a6b8b95a57b83950b5a0baeb4 | true |
| BUYBACKBURN_CODE_HASH | c0aa01fbea33817bc1954ccafb0f09f32c32d0c0b2b5ed9763b24bbd80541250 | c0aa01fbea33817bc1954ccafb0f09f32c32d0c0b2b5ed9763b24bbd80541250 | true |
| CAPSULEHUB_CODE_HASH | 8669ba06c90a9d909e29567cd3437f0ae93bfca65f04538d89fc564a26379eed | 8669ba06c90a9d909e29567cd3437f0ae93bfca65f04538d89fc564a26379eed | true |
| FEEACCUMULATOR_CODE_HASH | ff084907becac5dcc98b372162bab7f6f2a364f4383e5f51676fd069f64db2e3 | ff084907becac5dcc98b372162bab7f6f2a364f4383e5f51676fd069f64db2e3 | true |
| VAULT_CODE_HASH | 53c9f01402710f9248c278d9ae5dd03c449cb7ec80f0fd7cea2d0cd052447350 | 53c9f01402710f9248c278d9ae5dd03c449cb7ec80f0fd7cea2d0cd052447350 | true |
| USERNAME_NFT_ITEM_CODE_HASH | bf2735f371ba1eaa77fd37c8eaab847fac40e2357d2e7850c9e444dc3b00df1e | bf2735f371ba1eaa77fd37c8eaab847fac40e2357d2e7850c9e444dc3b00df1e | true |
| USERNAME_REGISTRY_CODE_HASH | 0c4aaf8fd4c5c0d2bed14a8979454d11ed0a38a67d87cf18adc6bdeeeb06d92b | 0c4aaf8fd4c5c0d2bed14a8979454d11ed0a38a67d87cf18adc6bdeeeb06d92b | true |
| MOCK_VAULT_ATH_WALLET_CODE_HASH | 2cd0395b0bbbd0aa6c19398e8e43031e6435bdb5cf7d2e924b4c7e13155df809 | 2cd0395b0bbbd0aa6c19398e8e43031e6435bdb5cf7d2e924b4c7e13155df809 | true |
| MOCK_USERNAME_NFT_ITEM_NO_ACK_CODE_HASH | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | true |

## Remaining final-genesis blockers

- ATH_TREASURY_SUPPLY_MUST_BE_DEPLOYED_WITH_ONE_SHOT_GENESIS_CREDIT
- BUYBACKBURN_ROUTE_SEAL_REQUIRES_M20F_MAINNET_STONFI_EVIDENCE
- STONFI_V2_ROUTE_AND_PAYLOAD_VALUES_NOT_PINNED
- FINAL_DEPLOYMENT_MANIFEST_MUST_REPLACE_FIXTURE_ADDRESSES_WITH_MAINNET_STATEINIT_ADDRESSES
- VAULT_ACTIVITY_AIRDROP_ALLOCATION_MUST_BE_FUNDED_IN_OFFICIAL_VAULT_ATH_WALLET_BEFORE_FINAL_GENESIS
