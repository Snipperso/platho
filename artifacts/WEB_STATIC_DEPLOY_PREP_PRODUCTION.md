# Platho Static Web Deploy Prep

Status: BLOCKED_BY_PREPROD
Mode: production
Domain: platho.app
Output: C:\platho\artifacts\platho-web-static-production

## Runtime

```text
fileCount=219
totalBytes=5561055
bundleSha256=7241ebe2f67740874ac581e2218189ba14ff070aa87a7f54802ac45f9eab9c5c
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
