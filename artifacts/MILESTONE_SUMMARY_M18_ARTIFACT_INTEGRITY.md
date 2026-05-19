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

- Stored hash: 2c427fba0f9ecf8426fbff3244d5b7783e8ef8fd4aa24423768d22ed18d6bab1
- Rebuilt hash: 2c427fba0f9ecf8426fbff3244d5b7783e8ef8fd4aa24423768d22ed18d6bab1
- Match: true
- Status: IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS

## Code hashes

| Key | Built | Pinned | Match |
|---|---|---|---|
| ATHMASTER_CODE_HASH | d6af66e6773be0ca4d12e08ebc3380e5a89f188b7a1f5e0f207f0ce87e723059 | d6af66e6773be0ca4d12e08ebc3380e5a89f188b7a1f5e0f207f0ce87e723059 | true |
| ATH_WALLET_CODE_HASH | 5ea6f2351f26b45465518996ba35ce7887e9d9bca3353d13b674ca6180e6e3b4 | 5ea6f2351f26b45465518996ba35ce7887e9d9bca3353d13b674ca6180e6e3b4 | true |
| BUYBACKBURN_CODE_HASH | 9a1472fe4b349243ca0b034a1ed986acacb98f7218056c6ea29b2ad967f68063 | 9a1472fe4b349243ca0b034a1ed986acacb98f7218056c6ea29b2ad967f68063 | true |
| CAPSULEHUB_CODE_HASH | 2522af15971a775b873a335c6637e961ab8a54d29446738f7c8390449c5c6cf6 | 2522af15971a775b873a335c6637e961ab8a54d29446738f7c8390449c5c6cf6 | true |
| FEEACCUMULATOR_CODE_HASH | cdc5cc6e635572eb2fa826845827ae84d7d70ce88c7d61c58467741dfbb6e67c | cdc5cc6e635572eb2fa826845827ae84d7d70ce88c7d61c58467741dfbb6e67c | true |
| VAULT_CODE_HASH | cc185e9fe3e8861b9be3ee8ca0434a4872872f312f50236e3874cd170c18b40b | cc185e9fe3e8861b9be3ee8ca0434a4872872f312f50236e3874cd170c18b40b | true |
| USERNAME_NFT_ITEM_CODE_HASH | 96861964c8a76cd1d34b16dfcb9f8a4e68ffd652b00ac66ee7dc7410630e16b0 | 96861964c8a76cd1d34b16dfcb9f8a4e68ffd652b00ac66ee7dc7410630e16b0 | true |
| USERNAME_REGISTRY_CODE_HASH | e903114a0b29f401c49124da62a2596b39370fdf13e1bcf669ed574f24ca75c4 | e903114a0b29f401c49124da62a2596b39370fdf13e1bcf669ed574f24ca75c4 | true |
| MOCK_VAULT_ATH_WALLET_CODE_HASH | 2cd0395b0bbbd0aa6c19398e8e43031e6435bdb5cf7d2e924b4c7e13155df809 | 2cd0395b0bbbd0aa6c19398e8e43031e6435bdb5cf7d2e924b4c7e13155df809 | true |
| MOCK_USERNAME_NFT_ITEM_NO_ACK_CODE_HASH | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | true |

## Remaining final-genesis blockers

- ATH_TREASURY_SUPPLY_MUST_BE_DEPLOYED_WITH_ONE_SHOT_GENESIS_CREDIT
- BUYBACKBURN_ROUTE_SEAL_REQUIRES_M20F_MAINNET_STONFI_EVIDENCE
- STONFI_V2_ROUTE_AND_PAYLOAD_VALUES_NOT_PINNED
- FINAL_DEPLOYMENT_MANIFEST_MUST_REPLACE_FIXTURE_ADDRESSES_WITH_MAINNET_STATEINIT_ADDRESSES
- VAULT_ACTIVITY_AIRDROP_ALLOCATION_MUST_BE_FUNDED_IN_OFFICIAL_VAULT_ATH_WALLET_BEFORE_FINAL_GENESIS
