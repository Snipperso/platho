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

- Stored hash: 7fa3412db904367ed6e6a09411393e18098810308d69c645480efd223b0cc42b
- Rebuilt hash: 7fa3412db904367ed6e6a09411393e18098810308d69c645480efd223b0cc42b
- Match: true
- Status: IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS

## Code hashes

| Key | Built | Pinned | Match |
|---|---|---|---|
| ATHMASTER_CODE_HASH | 33e4c62fa48e4f6d8b3b93a00e025485c18a6b81efcd055768508c215b88cfbf | 33e4c62fa48e4f6d8b3b93a00e025485c18a6b81efcd055768508c215b88cfbf | true |
| ATH_WALLET_CODE_HASH | a4ca0258ce36f72c4bab250c5ead87bc6db1b0ebe3832bad8c6961efaaedc730 | a4ca0258ce36f72c4bab250c5ead87bc6db1b0ebe3832bad8c6961efaaedc730 | true |
| BUYBACKBURN_CODE_HASH | 95286777c509acdb6799ea117be609d95fdcd866534548398bd80eb015a8fc24 | 95286777c509acdb6799ea117be609d95fdcd866534548398bd80eb015a8fc24 | true |
| CAPSULEHUB_CODE_HASH | 2522af15971a775b873a335c6637e961ab8a54d29446738f7c8390449c5c6cf6 | 2522af15971a775b873a335c6637e961ab8a54d29446738f7c8390449c5c6cf6 | true |
| FEEACCUMULATOR_CODE_HASH | 7273fe39e2ac54f61ccfc3b0811df1e352acc1b31ff8b028061c0411929404c1 | 7273fe39e2ac54f61ccfc3b0811df1e352acc1b31ff8b028061c0411929404c1 | true |
| VAULT_CODE_HASH | ec268816c42d788b55bd171a32b81d40073cb7f242c48138d521185508914353 | ec268816c42d788b55bd171a32b81d40073cb7f242c48138d521185508914353 | true |
| USERNAME_NFT_ITEM_CODE_HASH | 23f13b3c91120c089244c411b855c69a71a42bc0244740e1cc6c266f71c1f1ea | 23f13b3c91120c089244c411b855c69a71a42bc0244740e1cc6c266f71c1f1ea | true |
| USERNAME_REGISTRY_CODE_HASH | 6cc5a428588f43a706047ea2ae6595726596b17ee54c8703cdc9c8239a6d0742 | 6cc5a428588f43a706047ea2ae6595726596b17ee54c8703cdc9c8239a6d0742 | true |
| MOCK_VAULT_ATH_WALLET_CODE_HASH | 9dff854edded531aca8ae603427aa978f14ee45517b9ec97d51760b197353cad | 9dff854edded531aca8ae603427aa978f14ee45517b9ec97d51760b197353cad | true |
| MOCK_USERNAME_NFT_ITEM_NO_ACK_CODE_HASH | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | true |

## Remaining final-genesis blockers

- BUYBACKBURN_ROUTE_SEAL_REQUIRES_M20F_MAINNET_STONFI_EVIDENCE
- STONFI_V2_ROUTE_AND_PAYLOAD_VALUES_NOT_PINNED
- FINAL_DEPLOYMENT_MANIFEST_MUST_REPLACE_FIXTURE_ADDRESSES_WITH_MAINNET_STATEINIT_ADDRESSES
- VAULT_ACTIVITY_AIRDROP_ALLOCATION_MUST_BE_FUNDED_IN_OFFICIAL_VAULT_ATH_WALLET_BEFORE_FINAL_GENESIS
