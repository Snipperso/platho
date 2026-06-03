# Platho Static Web Deploy Prep

Status: BLOCKED_BY_PREPROD
Mode: production
Domain: platho.app
Output: C:\platho\artifacts\platho-web-static-production

## Runtime

```text
fileCount=128
totalBytes=2838843
bundleSha256=567dfc9b07f94b0062597b5b3b2ed2f8c65c97bd143b3e8da530b48bbbb24341
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
