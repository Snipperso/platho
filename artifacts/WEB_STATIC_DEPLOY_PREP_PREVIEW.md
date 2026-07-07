# Platho Static Web Deploy Prep

Status: PREVIEW_STATIC_PACKAGE_READY
Mode: preview
Domain: platho.app
Output: C:\platho\artifacts\platho-web-static-preview

## Runtime

```text
fileCount=139
totalBytes=4615398
bundleSha256=2349a83c9027e48d772ef7d6a0d16230d6d024126352ddd8346842468992238e
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
- MAINNET_GENESIS_NOT_VERIFIED

## Production Findings

- MAINNET_GENESIS_NOT_VERIFIED: Current release candidate has no verified final mainnet genesis evidence. (artifacts/MAINNET_GENESIS_VERIFIED.txt)
