# Platho Static Web Deploy Prep

Status: PREVIEW_STATIC_PACKAGE_READY
Mode: preview
Domain: platho.app
Output: C:\platho\artifacts\platho-web-static-preview

## Runtime

```text
fileCount=115
totalBytes=2096212
bundleSha256=e01e8c9c51504bf8d0bb780063db6d52363b8d033c8d4c7ebd3d2d2212f238c7
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
- PWA_MODE_NOT_PRODUCTION
- PWA_NETWORK_NOT_MAINNET
- CRYPTO_PROD_REMAINING_WORK
- PROD_CHECKLIST_OPEN_BLOCKERS
- TESTNET_ENV_PRESENT

## Production Findings

- PWA_MODE_NOT_PRODUCTION: PWA config is not in production mode. (web/platho-config.mjs)
- PWA_NETWORK_NOT_MAINNET: PWA config does not target mainnet. (web/platho-config.mjs)
- CRYPTO_PROD_REMAINING_WORK: Crypto protocol still documents production blockers. (web/CRYPTO_PROTOCOL.md)
- PROD_CHECKLIST_OPEN_BLOCKERS: Production readiness checklist still has open hard blockers. (PRODUCTION_READINESS.md)
- TESTNET_ENV_PRESENT: Testnet env file is present. Production deploy must not run from this workspace/config. (.env.testnet.local)
