# Platho Static Web Deploy Prep

Status: BLOCKED_BY_PREPROD
Mode: production
Domain: platho.app
Output: C:\platho\artifacts\platho-web-static-production

## Runtime

```text
fileCount=128
totalBytes=2832581
bundleSha256=04bc7366dbb6876900f26a7bd3cd138f196d1f7e691b32d5d123f9380dcaa505
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

- PWA_MODE_NOT_PRODUCTION
- MAINNET_GENESIS_NOT_VERIFIED

## Warnings

None

## Production Findings

- PWA_MODE_NOT_PRODUCTION: PWA config is not in production mode. (web/platho-config.mjs)
- MAINNET_GENESIS_NOT_VERIFIED: Current release candidate has no verified final mainnet genesis evidence. (artifacts/MAINNET_GENESIS_VERIFIED.txt)
