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

- Stored hash: bd4b7d3a85af2e0634c1c4334e1a451abac6159c8cc5c4c439fdfaf44f066ce0
- Rebuilt hash: bd4b7d3a85af2e0634c1c4334e1a451abac6159c8cc5c4c439fdfaf44f066ce0
- Match: true
- Status: IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS

## Code hashes

| Key | Built | Pinned | Match |
|---|---|---|---|
| ATHMASTER_CODE_HASH | e0af1eba68f1d22b56caee365e75f97fa72014e82f5de107f81de93ef1c93761 | e0af1eba68f1d22b56caee365e75f97fa72014e82f5de107f81de93ef1c93761 | true |
| ATH_WALLET_CODE_HASH | b95c2c1159aa292830f3a03a751c4f37bcd0ebf2a416301fb19eadb94ca50b2c | b95c2c1159aa292830f3a03a751c4f37bcd0ebf2a416301fb19eadb94ca50b2c | true |
| BUYBACKBURN_CODE_HASH | 660f6816b4bc4f25db1e5166d2d238627793ccfc75d08a0fb5e5238fc9a84218 | 660f6816b4bc4f25db1e5166d2d238627793ccfc75d08a0fb5e5238fc9a84218 | true |
| MARKET_STABILITY_SELLER_CODE_HASH | 870d534305987f512a48836657a16bfd42ee190f03c0badea75da22c8e526ea3 | 870d534305987f512a48836657a16bfd42ee190f03c0badea75da22c8e526ea3 | true |
| CAPSULEHUB_CODE_HASH | 9d5f946d2db56aabe39c2c0bde53b7bf074eef516868b372d17ed3997935c3a3 | 9d5f946d2db56aabe39c2c0bde53b7bf074eef516868b372d17ed3997935c3a3 | true |
| FEEACCUMULATOR_CODE_HASH | 593bbab3c38ab877a123459111a3a2f63464c7b74d63db0ff4c1cabddba2ee53 | 593bbab3c38ab877a123459111a3a2f63464c7b74d63db0ff4c1cabddba2ee53 | true |
| PROFILE_REGISTRY_CODE_HASH | 2a32bc13b9b767d45ee679831b7bf8518d7a59c1e58a3f9fa50653ae11544f49 | 2a32bc13b9b767d45ee679831b7bf8518d7a59c1e58a3f9fa50653ae11544f49 | true |
| VAULT_CODE_HASH | 898ea610cb1d518956d0e2fcf7465b548e962e0b0f502dd9d7ea1e915583f15b | 898ea610cb1d518956d0e2fcf7465b548e962e0b0f502dd9d7ea1e915583f15b | true |
| USERNAME_NFT_ITEM_CODE_HASH | c57322294ea75e5e5110f92223ac22587487689940a43654f55a0c9483cc0b11 | c57322294ea75e5e5110f92223ac22587487689940a43654f55a0c9483cc0b11 | true |
| USERNAME_REGISTRY_CODE_HASH | fbcede326fe1698a166d9f7b157fd75f6216b5d453c6f8c245b6bec8a824dcbe | fbcede326fe1698a166d9f7b157fd75f6216b5d453c6f8c245b6bec8a824dcbe | true |
| MOCK_VAULT_ATH_WALLET_CODE_HASH | 2cd0395b0bbbd0aa6c19398e8e43031e6435bdb5cf7d2e924b4c7e13155df809 | 2cd0395b0bbbd0aa6c19398e8e43031e6435bdb5cf7d2e924b4c7e13155df809 | true |
| MOCK_USERNAME_NFT_ITEM_NO_ACK_CODE_HASH | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | true |

## Remaining final-genesis blockers

- ATH_TREASURY_SUPPLY_MUST_BE_DEPLOYED_WITH_ONE_SHOT_GENESIS_CREDIT
- FINAL_DEPLOYMENT_MANIFEST_MUST_REPLACE_FIXTURE_ADDRESSES_WITH_MAINNET_STATEINIT_ADDRESSES
- VAULT_ACTIVITY_AIRDROP_ALLOCATION_MUST_BE_FUNDED_IN_OFFICIAL_VAULT_ATH_WALLET_BEFORE_FINAL_GENESIS
