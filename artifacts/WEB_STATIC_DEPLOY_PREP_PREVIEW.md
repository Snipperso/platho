# Platho Static Web Deploy Prep

Status: PREVIEW_STATIC_PACKAGE_READY
Mode: preview
Domain: platho.app
Output: C:\platho\artifacts\platho-web-static-preview

## Runtime

```text
fileCount=216
totalBytes=5562285
bundleSha256=cfd40764308424c32777816c5e016df6d87e1d0ef43824fcd986779dcf26eabe
noBackendRuntime=true
```

## Checks

- serviceWorkerIncluded: true
- pwaStartUrlIsStatic: true
- pwaScopeIsStatic: true
- envFilesIncluded: false
- serverRuntimeIncluded: false
- productionMarkersCleared: false

## Blockers

None

## Warnings

- STATIC_PACKAGE_IS_NON_PRODUCTION
- MAINNET_GENESIS_CURRENT_CODE_HASH_MISMATCH
- PWA_FINAL_MANIFEST_HASH_MISMATCH

## Production Findings

- MAINNET_GENESIS_CURRENT_CODE_HASH_MISMATCH: MAINNET_GENESIS_VERIFIED=true must match current build code hashes: ath_master, ath_vesting, ath_wallet, buyback_burn, market_stability_seller, fee_accumulator, profile_registry, username_nft_item, username_registry. (artifacts/mainnet_genesis_verify_input.json)
- PWA_FINAL_MANIFEST_HASH_MISMATCH: PWA vault.deploymentManifestHash must match the verified final genesis manifest hash. (web/platho-config.mjs)
