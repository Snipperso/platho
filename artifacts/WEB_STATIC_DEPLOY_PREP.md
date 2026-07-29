# Platho Static Web Deploy Prep

Status: BLOCKED_BY_PREPROD
Mode: production
Domain: platho.app
Output: C:\platho\artifacts\platho-web-static-production

## Runtime

```text
fileCount=219
totalBytes=5555614
bundleSha256=a533d208c0d2a46c65ac30285989b90d41be6aeabea4bc793b7d281ac992e632
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
