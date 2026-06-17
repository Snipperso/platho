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

- Stored hash: 8a7a5f51f0e9233f469801a6600d1e87b45c6ae52094cb297a722873dc884d13
- Rebuilt hash: 8a7a5f51f0e9233f469801a6600d1e87b45c6ae52094cb297a722873dc884d13
- Match: true
- Status: FINAL_GENESIS

## Code hashes

| Key | Built | Pinned | Match |
|---|---|---|---|
| ATHMASTER_CODE_HASH | b1d76721386af55046ea573e7f7d41673e8e68629fd06aef3889b121e1d66780 | b1d76721386af55046ea573e7f7d41673e8e68629fd06aef3889b121e1d66780 | true |
| ATHVESTING_CODE_HASH | 33367899c4d117a9a7a00811bd64c1dca51dfb0ee79fec6abf4d1f10abf049ac | 33367899c4d117a9a7a00811bd64c1dca51dfb0ee79fec6abf4d1f10abf049ac | true |
| ATH_WALLET_CODE_HASH | 3d0f027840bc604e1e69d19f764543372f362096e2ead3c689c83e8f00966ce4 | 3d0f027840bc604e1e69d19f764543372f362096e2ead3c689c83e8f00966ce4 | true |
| BUYBACKBURN_CODE_HASH | 0c39dc79e436ad71b7b8f467a9c72fb84a7fdae7454cd25ecfbb4f8c130c832c | 0c39dc79e436ad71b7b8f467a9c72fb84a7fdae7454cd25ecfbb4f8c130c832c | true |
| MARKET_STABILITY_SELLER_CODE_HASH | b5e694860f604f3a91bfe2bb57a23b19cec1013dc467fbea3713d1ac887b5dd4 | b5e694860f604f3a91bfe2bb57a23b19cec1013dc467fbea3713d1ac887b5dd4 | true |
| CAPSULEHUB_CODE_HASH | f72823a4c01afd938143201dddff03f5193143e116366ce35a69e46662607791 | f72823a4c01afd938143201dddff03f5193143e116366ce35a69e46662607791 | true |
| FEEACCUMULATOR_CODE_HASH | 593bbab3c38ab877a123459111a3a2f63464c7b74d63db0ff4c1cabddba2ee53 | 593bbab3c38ab877a123459111a3a2f63464c7b74d63db0ff4c1cabddba2ee53 | true |
| PROFILE_REGISTRY_CODE_HASH | 6a1de90ff8834d25bc34a74221a161290ab3f3e2cfdbfb2d73dd407adc7eecef | 6a1de90ff8834d25bc34a74221a161290ab3f3e2cfdbfb2d73dd407adc7eecef | true |
| VAULT_CODE_HASH | 2cde6f6839b062374600628689008fc68d7d7757622a691287638829adbf08eb | 2cde6f6839b062374600628689008fc68d7d7757622a691287638829adbf08eb | true |
| USERNAME_NFT_ITEM_CODE_HASH | 73d19a15d46c24d0eda7047d073490b7166d01322399751108be40ae2fda2eab | 73d19a15d46c24d0eda7047d073490b7166d01322399751108be40ae2fda2eab | true |
| USERNAME_REGISTRY_CODE_HASH | 6606f0a45841e6762f72f1d2f247a77ac40549895d4e63c6fa48bd7e23e9a6fe | 6606f0a45841e6762f72f1d2f247a77ac40549895d4e63c6fa48bd7e23e9a6fe | true |
| MOCK_VAULT_ATH_WALLET_CODE_HASH | 98a019e5bd6434949ebf14ee2a4c8fa785ad1308b5a912f012809f85e06efa9d | 98a019e5bd6434949ebf14ee2a4c8fa785ad1308b5a912f012809f85e06efa9d | true |
| MOCK_USERNAME_NFT_ITEM_NO_ACK_CODE_HASH | 522b37556ab7f6f8059b9afb0ff05e8f231fedd939a3973fdd7cfd762c081e28 | 522b37556ab7f6f8059b9afb0ff05e8f231fedd939a3973fdd7cfd762c081e28 | true |

## Remaining final-genesis blockers

