# Platho Static Web Deploy Prep

Status: BLOCKED_BY_PREPROD
Mode: production
Domain: platho.app
Output: C:\platho\artifacts\platho-web-static-production

## Runtime

```text
fileCount=218
totalBytes=5954793
bundleSha256=9d73dbb0d83944a5e9b82a4ddd2750f554603461b22fc39ea118b50ec14c61fd
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

- MAINNET_GENESIS_CURRENT_CODE_HASH_MISMATCH: MAINNET_GENESIS_VERIFIED=true must match current build code hashes: ath_master, ath_vesting, ath_wallet, buyback_burn, market_stability_seller, fee_accumulator, profile_registry, username_nft_item, username_registry. (artifacts/mainnet_genesis_verify_input.json)
