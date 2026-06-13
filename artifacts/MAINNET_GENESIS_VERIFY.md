# Mainnet Genesis Verify

Status: BLOCKED_GENESIS_MISMATCH

- mainnet_genesis_verified: false
- checked_manifest_hash: 0abbf86a6982ac9d73ac7ee0873dba8234e7a661e3d98b3acc66643fd857f7d0
- input_source: artifacts/mainnet_genesis_verify_input.json
- input_sha256: bd058f75c00bb935d59c64c7310468bd8d173c25b4809ba273670ac374e1301d

## Evidence refs

- getterSnapshotSource: live-rpc/platho-toncenter/2026-06-10T16:41:41.692Z
- codeHashProofSource: artifacts/CURRENT_CODE_HASHES.txt#sha256=46afd3e62486086936326ed48ecf370ff71721249bd09b60c4274d0b4f033ce0
- finalManifestSource: artifacts/local/mainnet_final_manifest_draft.json#manifest_hash_hex=0f54ea7d319aaad69cfba922e7779e25fca683de15c8caf7fe444e2dc99dc610

## Issues

- MAINNET_GENESIS_VERIFY_INPUT_STALE_RELATIVE_TO_LOCAL_DRAFT: Stored mainnet genesis verifier input is stale relative to the current local final manifest draft. input=0abbf86a6982ac9d73ac7ee0873dba8234e7a661e3d98b3acc66643fd857f7d0 local_draft=28c5e08eb28095b9dcc30108028c370376f60ae07b2c8de11fe0824aa0a741f3 production_deploy_executed=false Regenerate artifacts/mainnet_genesis_verify_input.json from a fresh live getter/code-hash snapshot before final mainnet verification.
