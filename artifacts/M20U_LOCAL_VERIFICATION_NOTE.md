# M20U local verification note

M20U is a readiness/documentation/test milestone. It does not modify `contracts/`.

Executed checks:

```text
npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/buybackburn_contract_readiness_m20u.ts
EXIT=0

npx vitest run tests/m20u-buybackburn-implementation-readiness.test.ts --config vitest.all.config.ts --reporter=verbose
EXIT=0
1 test file passed
5 tests passed

npx vitest run tests/m19c-stonfi-route-freeze-gate.test.ts tests/m19d-stonfi-route-candidate-intake.test.ts tests/m19e-stonfi-live-evidence-collector.test.ts tests/m19f-stonfi-route-evidence-dossier.test.ts tests/m19g-buybackburn-state-machine.test.ts tests/m19h-buybackburn-funding-envelope.test.ts tests/m20u-buybackburn-implementation-readiness.test.ts --config vitest.all.config.ts --reporter=verbose
EXIT=0
7 test files passed
33 tests passed
```

Default generated readiness remains blocked:

```text
BUYBACKBURN_IMPLEMENTATION_READY_M20U=false
blockedBy=[M20T_TESTNET_DEPLOYMENT_PROBE_NOT_COMPLETE, M20F_MAINNET_STONFI_ROUTE_FREEZE_NOT_READY]
```
