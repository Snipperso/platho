# Platho Static Web Deploy Prep

Status: BLOCKED_BY_PREPROD
Mode: production
Domain: platho.app
Output: C:\platho\artifacts\platho-web-static-production

## Runtime

```text
fileCount=183
totalBytes=5729082
bundleSha256=76c6e02c82020ddd5902bc793ebde44e1fa6ce95f75ae956cb98d1baa34c00e2
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
