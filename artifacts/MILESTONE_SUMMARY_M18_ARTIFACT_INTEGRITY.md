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

- Stored hash: d9ca407acd7a9cdb5b3ee26cbd122b73fea79e6f7f12fb7445c1a64516e57a16
- Rebuilt hash: d9ca407acd7a9cdb5b3ee26cbd122b73fea79e6f7f12fb7445c1a64516e57a16
- Match: true
- Status: FINAL_GENESIS

## Code hashes

| Key | Built | Pinned | Match |
|---|---|---|---|
| ATHMASTER_CODE_HASH | 1a0856b150d4eca477bdac094b2fd86e4a7dcd7d09825945fe9b230abf090544 | 1a0856b150d4eca477bdac094b2fd86e4a7dcd7d09825945fe9b230abf090544 | true |
| ATHVESTING_CODE_HASH | 0bbfdff71413182f0fade6026cdf99c2ea923a80b6f8b56d7d3c2b8416d3c968 | 0bbfdff71413182f0fade6026cdf99c2ea923a80b6f8b56d7d3c2b8416d3c968 | true |
| ATH_WALLET_CODE_HASH | 042e3ac22f441e988a2652cb346f61f61c10263d87c688e237ec00c03fac1466 | 042e3ac22f441e988a2652cb346f61f61c10263d87c688e237ec00c03fac1466 | true |
| BUYBACKBURN_CODE_HASH | 0bb107f3d56c001e42e99c7d0cf7b0131f42e792c31ee0728dbcd0c805972b19 | 0bb107f3d56c001e42e99c7d0cf7b0131f42e792c31ee0728dbcd0c805972b19 | true |
| MARKET_STABILITY_SELLER_CODE_HASH | 0ead15750d003e7b527609cb4ee787c1fa13f5a29c6de1dedf1b07f309009d2f | 0ead15750d003e7b527609cb4ee787c1fa13f5a29c6de1dedf1b07f309009d2f | true |
| CAPSULEHUB_CODE_HASH | cbd14315cb61365039df65b48874cbf10cf31fbab9d2d4009cc08ac4b6feb344 | cbd14315cb61365039df65b48874cbf10cf31fbab9d2d4009cc08ac4b6feb344 | true |
| FEEACCUMULATOR_CODE_HASH | 593bbab3c38ab877a123459111a3a2f63464c7b74d63db0ff4c1cabddba2ee53 | 593bbab3c38ab877a123459111a3a2f63464c7b74d63db0ff4c1cabddba2ee53 | true |
| PROFILE_REGISTRY_CODE_HASH | 96b823bb85145e3311c43a871013b8b227bc265121e1941f1dc686aeff11b292 | 96b823bb85145e3311c43a871013b8b227bc265121e1941f1dc686aeff11b292 | true |
| VAULT_CODE_HASH | b1db818389ae2be7fb429a7d5957e5eadcb3875cdef9bb956c1a40d6e56cd5f6 | b1db818389ae2be7fb429a7d5957e5eadcb3875cdef9bb956c1a40d6e56cd5f6 | true |
| USERNAME_NFT_ITEM_CODE_HASH | eccbea500b135059a1a46bae5c833b28ad263aae0258a146e9f98d8f7b843910 | eccbea500b135059a1a46bae5c833b28ad263aae0258a146e9f98d8f7b843910 | true |
| USERNAME_REGISTRY_CODE_HASH | 89cf045874c3dc415409d702d51906cf6e8ce1f8ae9cf1bd64e6bf0c6b254570 | 89cf045874c3dc415409d702d51906cf6e8ce1f8ae9cf1bd64e6bf0c6b254570 | true |
| MOCK_VAULT_ATH_WALLET_CODE_HASH | 98a019e5bd6434949ebf14ee2a4c8fa785ad1308b5a912f012809f85e06efa9d | 98a019e5bd6434949ebf14ee2a4c8fa785ad1308b5a912f012809f85e06efa9d | true |
| MOCK_USERNAME_NFT_ITEM_NO_ACK_CODE_HASH | 522b37556ab7f6f8059b9afb0ff05e8f231fedd939a3973fdd7cfd762c081e28 | 522b37556ab7f6f8059b9afb0ff05e8f231fedd939a3973fdd7cfd762c081e28 | true |

## Remaining final-genesis blockers

