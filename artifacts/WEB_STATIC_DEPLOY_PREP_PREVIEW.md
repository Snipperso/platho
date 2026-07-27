# Platho Static Web Deploy Prep

Status: PREVIEW_STATIC_PACKAGE_READY
Mode: preview
Domain: platho.app
Output: C:\platho\artifacts\platho-web-static-preview

## Runtime

```text
fileCount=218
totalBytes=5832040
bundleSha256=b9f58051b2a7f582a91d54c34bc8aa4150853c4f225e3aeaf5a9afc17ee5a391
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

## Production Findings

- MAINNET_GENESIS_CURRENT_CODE_HASH_MISMATCH: MAINNET_GENESIS_VERIFIED=true must match current build code hashes: ath_master, ath_vesting, ath_wallet, buyback_burn, market_stability_seller, fee_accumulator, profile_registry, username_nft_item, username_registry. (artifacts/mainnet_genesis_verify_input.json)
