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

- Stored hash: a26530cd84ff29b49e3e305eedeead677584ac335277d92cfddb33b665265cdd
- Rebuilt hash: a26530cd84ff29b49e3e305eedeead677584ac335277d92cfddb33b665265cdd
- Match: true
- Status: FINAL_GENESIS

## Code hashes

| Key | Built | Pinned | Match |
|---|---|---|---|
| ATHMASTER_CODE_HASH | 1292f049451f70dc285c1247c9624890b2909298142a6c6760ccafa1428c4c88 | 1292f049451f70dc285c1247c9624890b2909298142a6c6760ccafa1428c4c88 | true |
| ATHVESTING_CODE_HASH | f0c1b8d97981441478f5169f60f586efd2aeff4191a7786e730ec966c8a3dede | f0c1b8d97981441478f5169f60f586efd2aeff4191a7786e730ec966c8a3dede | true |
| ATH_WALLET_CODE_HASH | 4c90b0f1b65eea96df7992409e1819b73f63f1ae2ecb9f651c42174c85f7b88d | 4c90b0f1b65eea96df7992409e1819b73f63f1ae2ecb9f651c42174c85f7b88d | true |
| BUYBACKBURN_CODE_HASH | 1026780c0c256efec9abb549f1b673938094adf01e84de18794f647fd9774fa2 | 1026780c0c256efec9abb549f1b673938094adf01e84de18794f647fd9774fa2 | true |
| MARKET_STABILITY_SELLER_CODE_HASH | 36a7779df8b0ec2394d52bcd948148ec7fc681c43c7204442ae9e0c5e0bd5fa8 | 36a7779df8b0ec2394d52bcd948148ec7fc681c43c7204442ae9e0c5e0bd5fa8 | true |
| CAPSULEHUB_CODE_HASH | fc0dd2f1b836145e25ccd51c0f7ab8acfc9f9dcf832e86e4c17f04a886789f0e | fc0dd2f1b836145e25ccd51c0f7ab8acfc9f9dcf832e86e4c17f04a886789f0e | true |
| FEEACCUMULATOR_CODE_HASH | 593bbab3c38ab877a123459111a3a2f63464c7b74d63db0ff4c1cabddba2ee53 | 593bbab3c38ab877a123459111a3a2f63464c7b74d63db0ff4c1cabddba2ee53 | true |
| PROFILE_REGISTRY_CODE_HASH | 4bb7e84048b4ed42312d686032f4da649f33cdbb035ad8f8d9a444ac9b7ba4f1 | 4bb7e84048b4ed42312d686032f4da649f33cdbb035ad8f8d9a444ac9b7ba4f1 | true |
| VAULT_CODE_HASH | a4dc953ed8f4eda13aba885b9942b05836a7e291a9215946bbfa8d87698ffc4e | a4dc953ed8f4eda13aba885b9942b05836a7e291a9215946bbfa8d87698ffc4e | true |
| USERNAME_NFT_ITEM_CODE_HASH | 3ad1c971f6b04e67e8dafcb0624aa794e996761420500cdf10d4edc77a2037ce | 3ad1c971f6b04e67e8dafcb0624aa794e996761420500cdf10d4edc77a2037ce | true |
| USERNAME_REGISTRY_CODE_HASH | f5b445a179a420128fbc78660e79986d6aba1bfb185d4f183c4ce41681a7c36e | f5b445a179a420128fbc78660e79986d6aba1bfb185d4f183c4ce41681a7c36e | true |
| MOCK_VAULT_ATH_WALLET_CODE_HASH | 98a019e5bd6434949ebf14ee2a4c8fa785ad1308b5a912f012809f85e06efa9d | 98a019e5bd6434949ebf14ee2a4c8fa785ad1308b5a912f012809f85e06efa9d | true |
| MOCK_USERNAME_NFT_ITEM_NO_ACK_CODE_HASH | 522b37556ab7f6f8059b9afb0ff05e8f231fedd939a3973fdd7cfd762c081e28 | 522b37556ab7f6f8059b9afb0ff05e8f231fedd939a3973fdd7cfd762c081e28 | true |

## Remaining final-genesis blockers

