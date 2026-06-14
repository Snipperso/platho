# Platho Static Web Deploy Prep

Status: PREVIEW_STATIC_PACKAGE_READY
Mode: preview
Domain: platho.app
Output: C:\platho\artifacts\platho-web-static-preview

## Runtime

```text
fileCount=129
totalBytes=3189348
bundleSha256=3557ad146ea122555c43bf5be588bdbb9efcbd5c3e3aa1c54c507e4d4f98439c
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
