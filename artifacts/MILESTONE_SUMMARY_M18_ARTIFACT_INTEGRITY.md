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

- Stored hash: cf50861b242b4a90995b60650cc55ead78b1ffb204e9ee176639a362884370be
- Rebuilt hash: cf50861b242b4a90995b60650cc55ead78b1ffb204e9ee176639a362884370be
- Match: true
- Status: IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS

## Code hashes

| Key | Built | Pinned | Match |
|---|---|---|---|
| ATHMASTER_CODE_HASH | 00be2848d146558ce157a60427a42ace8018992490946d2d8deb666282be6cfb | 00be2848d146558ce157a60427a42ace8018992490946d2d8deb666282be6cfb | true |
| ATH_WALLET_CODE_HASH | 5414d8a1ed3d178bb466f94bb73e5f359f982b3f7915c626acc4e5404c8e9b8e | 5414d8a1ed3d178bb466f94bb73e5f359f982b3f7915c626acc4e5404c8e9b8e | true |
| BUYBACKBURN_CODE_HASH | 779ae38dde8b00e71723bd66c2339cc0c11492f61e93bb1882a61bd5b1bddff6 | 779ae38dde8b00e71723bd66c2339cc0c11492f61e93bb1882a61bd5b1bddff6 | true |
| CAPSULEHUB_CODE_HASH | 2522af15971a775b873a335c6637e961ab8a54d29446738f7c8390449c5c6cf6 | 2522af15971a775b873a335c6637e961ab8a54d29446738f7c8390449c5c6cf6 | true |
| FEEACCUMULATOR_CODE_HASH | b3b8da0de7891c309c9cc8c77abd8fee4c39d444a8fdcc8c7dcaa97fb13b6fc5 | b3b8da0de7891c309c9cc8c77abd8fee4c39d444a8fdcc8c7dcaa97fb13b6fc5 | true |
| VAULT_CODE_HASH | ddfaf2e8e48e47747dc95cce2b7da62ac9efa3112787cc3ecc9c7bc8ed0407d1 | ddfaf2e8e48e47747dc95cce2b7da62ac9efa3112787cc3ecc9c7bc8ed0407d1 | true |
| USERNAME_NFT_ITEM_CODE_HASH | 23f13b3c91120c089244c411b855c69a71a42bc0244740e1cc6c266f71c1f1ea | 23f13b3c91120c089244c411b855c69a71a42bc0244740e1cc6c266f71c1f1ea | true |
| USERNAME_REGISTRY_CODE_HASH | 7ab56ac284cd84f37222fa349f27b41bae7ffb297dd978938f724696c233b4fa | 7ab56ac284cd84f37222fa349f27b41bae7ffb297dd978938f724696c233b4fa | true |
| MOCK_VAULT_ATH_WALLET_CODE_HASH | 2cd0395b0bbbd0aa6c19398e8e43031e6435bdb5cf7d2e924b4c7e13155df809 | 2cd0395b0bbbd0aa6c19398e8e43031e6435bdb5cf7d2e924b4c7e13155df809 | true |
| MOCK_USERNAME_NFT_ITEM_NO_ACK_CODE_HASH | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | true |

## Remaining final-genesis blockers

- ATH_TREASURY_SUPPLY_MUST_BE_DEPLOYED_WITH_ONE_SHOT_GENESIS_CREDIT
- BUYBACKBURN_ROUTE_SEAL_REQUIRES_M20F_MAINNET_STONFI_EVIDENCE
- STONFI_V2_ROUTE_AND_PAYLOAD_VALUES_NOT_PINNED
- FINAL_DEPLOYMENT_MANIFEST_MUST_REPLACE_FIXTURE_ADDRESSES_WITH_MAINNET_STATEINIT_ADDRESSES
- VAULT_ACTIVITY_AIRDROP_ALLOCATION_MUST_BE_FUNDED_IN_OFFICIAL_VAULT_ATH_WALLET_BEFORE_FINAL_GENESIS
