# Platho Static Web Deploy Prep

Status: PREVIEW_STATIC_PACKAGE_READY
Mode: preview
Domain: platho.app
Output: C:\platho\artifacts\platho-web-static-preview

## Runtime

```text
fileCount=139
totalBytes=4578911
bundleSha256=66fa10cb49ae4f79f6772e497b1cf877708af4571c211efa83879757eb9bd6c7
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
- TESTNET_ENV_PRESENT
- MAINNET_GENESIS_NOT_VERIFIED

## Production Findings

- TESTNET_ENV_PRESENT: Testnet env file is present. Production deploy must not run from this workspace/config. (.env.testnet.local)
- MAINNET_GENESIS_NOT_VERIFIED: Current release candidate has no verified final mainnet genesis evidence. (artifacts/MAINNET_GENESIS_VERIFIED.txt)
