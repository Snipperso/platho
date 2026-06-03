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

- Stored hash: 97d597c542c679eb83c66c8cef94092140ff4bd248ce28aa044f0899fcc2b151
- Rebuilt hash: 97d597c542c679eb83c66c8cef94092140ff4bd248ce28aa044f0899fcc2b151
- Match: true
- Status: IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS

## Code hashes

| Key | Built | Pinned | Match |
|---|---|---|---|
| ATHMASTER_CODE_HASH | 06ab47304838b2efcd3fb501736829f5d61e13522268e40096c1434dfa969df0 | 06ab47304838b2efcd3fb501736829f5d61e13522268e40096c1434dfa969df0 | true |
| ATHVESTING_CODE_HASH | 9a572e31c88c471f13e45d390c61da6159139711a300b48f889192ba6f8d2ad7 | 9a572e31c88c471f13e45d390c61da6159139711a300b48f889192ba6f8d2ad7 | true |
| ATH_WALLET_CODE_HASH | 6d9d3dff2368d22a4148a48e71d6c91561b6db6ea64d7c14c506445202e13270 | 6d9d3dff2368d22a4148a48e71d6c91561b6db6ea64d7c14c506445202e13270 | true |
| BUYBACKBURN_CODE_HASH | adf826d02915f535d900d769fe3e47ba24181e6bfe669a8de52fc75a00afd8bd | adf826d02915f535d900d769fe3e47ba24181e6bfe669a8de52fc75a00afd8bd | true |
| MARKET_STABILITY_SELLER_CODE_HASH | 20f10b8c0addf8d23e405f252684a24f00ddbb9e5a29ca0def3bceefca6b8539 | 20f10b8c0addf8d23e405f252684a24f00ddbb9e5a29ca0def3bceefca6b8539 | true |
| CAPSULEHUB_CODE_HASH | fc0dd2f1b836145e25ccd51c0f7ab8acfc9f9dcf832e86e4c17f04a886789f0e | fc0dd2f1b836145e25ccd51c0f7ab8acfc9f9dcf832e86e4c17f04a886789f0e | true |
| FEEACCUMULATOR_CODE_HASH | 593bbab3c38ab877a123459111a3a2f63464c7b74d63db0ff4c1cabddba2ee53 | 593bbab3c38ab877a123459111a3a2f63464c7b74d63db0ff4c1cabddba2ee53 | true |
| PROFILE_REGISTRY_CODE_HASH | 6437b6631d0b310781fef9efa214640c69a3ae684dae2c4be5b463a673ed7e29 | 6437b6631d0b310781fef9efa214640c69a3ae684dae2c4be5b463a673ed7e29 | true |
| VAULT_CODE_HASH | 265128b6433387ba900e130a73410b7a6cce1436983b4a81af16a59cefe75bf8 | 265128b6433387ba900e130a73410b7a6cce1436983b4a81af16a59cefe75bf8 | true |
| USERNAME_NFT_ITEM_CODE_HASH | 3ad1c971f6b04e67e8dafcb0624aa794e996761420500cdf10d4edc77a2037ce | 3ad1c971f6b04e67e8dafcb0624aa794e996761420500cdf10d4edc77a2037ce | true |
| USERNAME_REGISTRY_CODE_HASH | 6b7739a9aadaef0c2ae69a0007e93961746d861cebabcdd5c68777f6cad2b27f | 6b7739a9aadaef0c2ae69a0007e93961746d861cebabcdd5c68777f6cad2b27f | true |
| MOCK_VAULT_ATH_WALLET_CODE_HASH | 98a019e5bd6434949ebf14ee2a4c8fa785ad1308b5a912f012809f85e06efa9d | 98a019e5bd6434949ebf14ee2a4c8fa785ad1308b5a912f012809f85e06efa9d | true |
| MOCK_USERNAME_NFT_ITEM_NO_ACK_CODE_HASH | 522b37556ab7f6f8059b9afb0ff05e8f231fedd939a3973fdd7cfd762c081e28 | 522b37556ab7f6f8059b9afb0ff05e8f231fedd939a3973fdd7cfd762c081e28 | true |

## Remaining final-genesis blockers

- ATH_TREASURY_SUPPLY_MUST_BE_DEPLOYED_WITH_ONE_SHOT_GENESIS_CREDIT
- FINAL_DEPLOYMENT_MANIFEST_MUST_REPLACE_FIXTURE_ADDRESSES_WITH_MAINNET_STATEINIT_ADDRESSES
- ATH_LONG_TERM_VESTING_ALLOCATION_MUST_BE_FUNDED_IN_OFFICIAL_VESTING_ATH_WALLET_BEFORE_FINAL_GENESIS
- VAULT_ACTIVITY_AIRDROP_ALLOCATION_MUST_BE_FUNDED_IN_OFFICIAL_VAULT_ATH_WALLET_BEFORE_FINAL_GENESIS
