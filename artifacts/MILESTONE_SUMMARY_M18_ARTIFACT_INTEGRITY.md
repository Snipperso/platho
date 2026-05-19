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

- Stored hash: e7f05aaab30f4791444c54c549c755264d941b0ab4ae8fb5378e4afdac3e521a
- Rebuilt hash: e7f05aaab30f4791444c54c549c755264d941b0ab4ae8fb5378e4afdac3e521a
- Match: true
- Status: IMPLEMENTED_SUBSET_NOT_FINAL_GENESIS

## Code hashes

| Key | Built | Pinned | Match |
|---|---|---|---|
| ATHMASTER_CODE_HASH | afb108307756106649dbfe5c9ccbe6ccdc058751c48dee0139f2c4a9814098ee | afb108307756106649dbfe5c9ccbe6ccdc058751c48dee0139f2c4a9814098ee | true |
| ATH_WALLET_CODE_HASH | 6056df754b3495a2175ab38a840c55716127d1c9f58d2a63a97002a9af15d4ea | 6056df754b3495a2175ab38a840c55716127d1c9f58d2a63a97002a9af15d4ea | true |
| BUYBACKBURN_CODE_HASH | 03195e5c6813bc213db2df5976b241d606fc9304647684cf83134efa88d6083b | 03195e5c6813bc213db2df5976b241d606fc9304647684cf83134efa88d6083b | true |
| CAPSULEHUB_CODE_HASH | 2522af15971a775b873a335c6637e961ab8a54d29446738f7c8390449c5c6cf6 | 2522af15971a775b873a335c6637e961ab8a54d29446738f7c8390449c5c6cf6 | true |
| FEEACCUMULATOR_CODE_HASH | 7273fe39e2ac54f61ccfc3b0811df1e352acc1b31ff8b028061c0411929404c1 | 7273fe39e2ac54f61ccfc3b0811df1e352acc1b31ff8b028061c0411929404c1 | true |
| VAULT_CODE_HASH | e87cb9e6d7c31b4011d262718f4d5fe2085e10efe42c2aefcfb5c40ebb583421 | e87cb9e6d7c31b4011d262718f4d5fe2085e10efe42c2aefcfb5c40ebb583421 | true |
| USERNAME_NFT_ITEM_CODE_HASH | 23f13b3c91120c089244c411b855c69a71a42bc0244740e1cc6c266f71c1f1ea | 23f13b3c91120c089244c411b855c69a71a42bc0244740e1cc6c266f71c1f1ea | true |
| USERNAME_REGISTRY_CODE_HASH | 35009f377483b91fe2f5ee638e1307f0e127fbfde4d81a040638d5c93ce2fa47 | 35009f377483b91fe2f5ee638e1307f0e127fbfde4d81a040638d5c93ce2fa47 | true |
| MOCK_VAULT_ATH_WALLET_CODE_HASH | 9dff854edded531aca8ae603427aa978f14ee45517b9ec97d51760b197353cad | 9dff854edded531aca8ae603427aa978f14ee45517b9ec97d51760b197353cad | true |
| MOCK_USERNAME_NFT_ITEM_NO_ACK_CODE_HASH | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | ad3e0f5a28fd5d8dfac0461993bf3b3f8a4110ce42d18bb5ef0f5f4989656a9b | true |

## Remaining final-genesis blockers

- ATH_TREASURY_SUPPLY_MUST_BE_DEPLOYED_WITH_ONE_SHOT_GENESIS_CREDIT
- BUYBACKBURN_ROUTE_SEAL_REQUIRES_M20F_MAINNET_STONFI_EVIDENCE
- STONFI_V2_ROUTE_AND_PAYLOAD_VALUES_NOT_PINNED
- FINAL_DEPLOYMENT_MANIFEST_MUST_REPLACE_FIXTURE_ADDRESSES_WITH_MAINNET_STATEINIT_ADDRESSES
- VAULT_ACTIVITY_AIRDROP_ALLOCATION_MUST_BE_FUNDED_IN_OFFICIAL_VAULT_ATH_WALLET_BEFORE_FINAL_GENESIS
