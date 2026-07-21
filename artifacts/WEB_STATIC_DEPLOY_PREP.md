# Platho Static Web Deploy Prep

Status: BLOCKED_BY_PREPROD
Mode: production
Domain: platho.app
Output: C:\platho\artifacts\platho-web-static-production

## Runtime

```text
fileCount=183
totalBytes=5725736
bundleSha256=2df84e5257e05e24f312be26bf2b29000af3bae6af74c942d6b400a5b5db87f6
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

- MAINNET_GENESIS_CURRENT_CODE_HASH_MISMATCH

## Warnings

None

## Production Findings

- MAINNET_GENESIS_CURRENT_CODE_HASH_MISMATCH: MAINNET_GENESIS_VERIFIED=true must match current build code hashes: ath_master, ath_vesting, ath_wallet, buyback_burn, market_stability_seller, capsulehub, fee_accumulator, profile_registry, username_nft_item, username_registry, vault. (artifacts/mainnet_genesis_verify_input.json)
