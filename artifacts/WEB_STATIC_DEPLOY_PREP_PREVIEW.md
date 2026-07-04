# Platho Static Web Deploy Prep

Status: PREVIEW_STATIC_PACKAGE_READY
Mode: preview
Domain: platho.app
Output: C:\platho\artifacts\platho-web-static-preview

## Runtime

```text
fileCount=136
totalBytes=4524951
bundleSha256=8cb2f704c38b0522a982fab246693d187a6b1fe6dec78c8888d9f217c72a3b15
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
