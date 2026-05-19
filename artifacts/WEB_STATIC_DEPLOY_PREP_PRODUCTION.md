# Platho Static Web Deploy Prep

Status: BLOCKED_BY_PREPROD
Mode: production
Domain: platho.app
Output: C:\platho\artifacts\platho-web-static-production

## Runtime

```text
fileCount=96
totalBytes=1802486
bundleSha256=179f8cb78f5ee5cf6fc084a3b2402cccf3946e0db0edfd0739e55353047ab336
noBackendRuntime=true
```

## Checks

- serviceWorkerIncluded: true
- tonConnectManifestDomainMatches: true
- tonConnectIconDomainMatches: true
- pwaStartUrlIsStatic: true
- pwaScopeIsStatic: true
- envFilesIncluded: false
- serverRuntimeIncluded: false
- productionMarkersCleared: false

## Blockers

- PWA_MODE_NOT_PRODUCTION
- PWA_NETWORK_NOT_MAINNET
- CRYPTO_PROD_REMAINING_WORK
- PROD_CHECKLIST_OPEN_BLOCKERS
- TESTNET_ENV_PRESENT

## Warnings

None

## Production Findings

- PWA_MODE_NOT_PRODUCTION: PWA config is not in production mode. (web/platho-config.mjs)
- PWA_NETWORK_NOT_MAINNET: PWA config does not target mainnet. (web/platho-config.mjs)
- CRYPTO_PROD_REMAINING_WORK: Crypto protocol still documents production blockers. (web/CRYPTO_PROTOCOL.md)
- PROD_CHECKLIST_OPEN_BLOCKERS: Production readiness checklist still has open hard blockers. (PRODUCTION_READINESS.md)
- TESTNET_ENV_PRESENT: Testnet env file is present. Production deploy must not run from this workspace/config. (.env.testnet.local)
