# Platho Static Web Deploy Prep

Status: BLOCKED_BY_PREPROD
Mode: production
Domain: platho.app
Output: C:\platho\artifacts\platho-web-static-production

## Runtime

```text
fileCount=104
totalBytes=1931279
bundleSha256=79f419bfc2e47d81cdfd5547020e4f2efda4133e4dff574ba131d350f055d237
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
