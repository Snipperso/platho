# Platho Static Web Deploy Prep

Status: BLOCKED_BY_PREPROD
Mode: production
Domain: platho.app
Output: C:\platho\artifacts\platho-web-static-production

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

- MAINNET_GENESIS_NOT_VERIFIED

## Warnings

None

## Production Findings

- MAINNET_GENESIS_NOT_VERIFIED: Current release candidate has no verified final mainnet genesis evidence. (artifacts/MAINNET_GENESIS_VERIFIED.txt)
