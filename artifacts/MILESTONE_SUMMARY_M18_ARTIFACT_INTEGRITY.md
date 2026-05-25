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

- Stored hash: 5ff78ea7f23868a876c2ecc09f07e703c2aea21b646a1b3386e7a268880c4f92
- Rebuilt hash: 5ff78ea7f23868a876c2ecc09f07e703c2aea21b646a1b3386e7a268880c4f92
- Match: true
- Status: IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS

## Code hashes

| Key | Built | Pinned | Match |
|---|---|---|---|
| ATHMASTER_CODE_HASH | c8a2476d01832102c35ad556e6dcb11fde9b98fb3b23370eb2110250ee8bf683 | c8a2476d01832102c35ad556e6dcb11fde9b98fb3b23370eb2110250ee8bf683 | true |
| ATH_WALLET_CODE_HASH | 584ae866786733e97a034ed84fc353d52dff761cfcbac029192a6f82fa84a354 | 584ae866786733e97a034ed84fc353d52dff761cfcbac029192a6f82fa84a354 | true |
| BUYBACKBURN_CODE_HASH | 82129f706996f5f5384f2d575bea56f1ae51b7408a32c3bd5a0c93252e11eb61 | 82129f706996f5f5384f2d575bea56f1ae51b7408a32c3bd5a0c93252e11eb61 | true |
| MARKET_STABILITY_SELLER_CODE_HASH | 3cf74ae1f5ecbb8e3fdfc3d663a42fbd854bf87b8a2e6ef1dfaa2b2a010977a4 | 3cf74ae1f5ecbb8e3fdfc3d663a42fbd854bf87b8a2e6ef1dfaa2b2a010977a4 | true |
| CAPSULEHUB_CODE_HASH | 9d5f946d2db56aabe39c2c0bde53b7bf074eef516868b372d17ed3997935c3a3 | 9d5f946d2db56aabe39c2c0bde53b7bf074eef516868b372d17ed3997935c3a3 | true |
| FEEACCUMULATOR_CODE_HASH | 593bbab3c38ab877a123459111a3a2f63464c7b74d63db0ff4c1cabddba2ee53 | 593bbab3c38ab877a123459111a3a2f63464c7b74d63db0ff4c1cabddba2ee53 | true |
| PROFILE_REGISTRY_CODE_HASH | 42cd425f8724559ac533579a838119f816c7e0850d7325a7abec3291f844bcfc | 42cd425f8724559ac533579a838119f816c7e0850d7325a7abec3291f844bcfc | true |
| VAULT_CODE_HASH | 5278016cf77e1182e30fa8f86d78846a2893d8e4f2d9ae7888907edba6646ed5 | 5278016cf77e1182e30fa8f86d78846a2893d8e4f2d9ae7888907edba6646ed5 | true |
| USERNAME_NFT_ITEM_CODE_HASH | c57322294ea75e5e5110f92223ac22587487689940a43654f55a0c9483cc0b11 | c57322294ea75e5e5110f92223ac22587487689940a43654f55a0c9483cc0b11 | true |
| USERNAME_REGISTRY_CODE_HASH | a1b079a73ebaf30dd870929e581cfd3b6577446c092926135d7555488f7c774f | a1b079a73ebaf30dd870929e581cfd3b6577446c092926135d7555488f7c774f | true |
| MOCK_VAULT_ATH_WALLET_CODE_HASH | 2cd0395b0bbbd0aa6c19398e8e43031e6435bdb5cf7d2e924b4c7e13155df809 | 2cd0395b0bbbd0aa6c19398e8e43031e6435bdb5cf7d2e924b4c7e13155df809 | true |
| MOCK_USERNAME_NFT_ITEM_NO_ACK_CODE_HASH | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | true |

## Remaining final-genesis blockers

- ATH_TREASURY_SUPPLY_MUST_BE_DEPLOYED_WITH_ONE_SHOT_GENESIS_CREDIT
- FINAL_DEPLOYMENT_MANIFEST_MUST_REPLACE_FIXTURE_ADDRESSES_WITH_MAINNET_STATEINIT_ADDRESSES
- VAULT_ACTIVITY_AIRDROP_ALLOCATION_MUST_BE_FUNDED_IN_OFFICIAL_VAULT_ATH_WALLET_BEFORE_FINAL_GENESIS
