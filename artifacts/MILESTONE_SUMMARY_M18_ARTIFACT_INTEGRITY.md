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

- Stored hash: ff26bda7751829e0450a9665fc2f4a619c9f9e4a7d659d45a6728deef11ece95
- Rebuilt hash: ff26bda7751829e0450a9665fc2f4a619c9f9e4a7d659d45a6728deef11ece95
- Match: true
- Status: FINAL_GENESIS

## Code hashes

| Key | Built | Pinned | Match |
|---|---|---|---|
| ATHMASTER_CODE_HASH | 423e55fa3e47525d99734f8fc073af3f4b468937d6bf3b03a6226cc3a7ba4ede | 423e55fa3e47525d99734f8fc073af3f4b468937d6bf3b03a6226cc3a7ba4ede | true |
| ATHVESTING_CODE_HASH | 7e8ad8c312284dbd2604b167dcf6db8ffc7f96278cfa194cad07a0c92d5092a5 | 7e8ad8c312284dbd2604b167dcf6db8ffc7f96278cfa194cad07a0c92d5092a5 | true |
| ATH_WALLET_CODE_HASH | 58be31994b60678c2b36f3cc588a13c88ee670bc6930a91b8429c53a4312a1b9 | 58be31994b60678c2b36f3cc588a13c88ee670bc6930a91b8429c53a4312a1b9 | true |
| BUYBACKBURN_CODE_HASH | b15d02e783237e0ba986b810c45e17c969ec19a7c562cdd7e2c73d378bbf1f04 | b15d02e783237e0ba986b810c45e17c969ec19a7c562cdd7e2c73d378bbf1f04 | true |
| MARKET_STABILITY_SELLER_CODE_HASH | 21b954c1111fe84f35cd0701066a3b9e2fd622e3669fcf0d2f6a1b882ff977db | 21b954c1111fe84f35cd0701066a3b9e2fd622e3669fcf0d2f6a1b882ff977db | true |
| CAPSULEHUB_CODE_HASH | cbd14315cb61365039df65b48874cbf10cf31fbab9d2d4009cc08ac4b6feb344 | cbd14315cb61365039df65b48874cbf10cf31fbab9d2d4009cc08ac4b6feb344 | true |
| FEEACCUMULATOR_CODE_HASH | 593bbab3c38ab877a123459111a3a2f63464c7b74d63db0ff4c1cabddba2ee53 | 593bbab3c38ab877a123459111a3a2f63464c7b74d63db0ff4c1cabddba2ee53 | true |
| PROFILE_REGISTRY_CODE_HASH | 7fe92293fbf9afabb5cd65c3275c0f80e8fb38fcf796b7143f90b3f9187663bc | 7fe92293fbf9afabb5cd65c3275c0f80e8fb38fcf796b7143f90b3f9187663bc | true |
| VAULT_CODE_HASH | ead2e625b5e219f1fcf51b4b068aa4ceb461a9ed2c5dc379fcb87abeb4f5b467 | ead2e625b5e219f1fcf51b4b068aa4ceb461a9ed2c5dc379fcb87abeb4f5b467 | true |
| USERNAME_NFT_ITEM_CODE_HASH | 73d19a15d46c24d0eda7047d073490b7166d01322399751108be40ae2fda2eab | 73d19a15d46c24d0eda7047d073490b7166d01322399751108be40ae2fda2eab | true |
| USERNAME_REGISTRY_CODE_HASH | 66e883e39873153834b1c06fb452cc0b3e8f3c64410c1aec2c80c36776d951cf | 66e883e39873153834b1c06fb452cc0b3e8f3c64410c1aec2c80c36776d951cf | true |
| MOCK_VAULT_ATH_WALLET_CODE_HASH | 98a019e5bd6434949ebf14ee2a4c8fa785ad1308b5a912f012809f85e06efa9d | 98a019e5bd6434949ebf14ee2a4c8fa785ad1308b5a912f012809f85e06efa9d | true |
| MOCK_USERNAME_NFT_ITEM_NO_ACK_CODE_HASH | 522b37556ab7f6f8059b9afb0ff05e8f231fedd939a3973fdd7cfd762c081e28 | 522b37556ab7f6f8059b9afb0ff05e8f231fedd939a3973fdd7cfd762c081e28 | true |

## Remaining final-genesis blockers

