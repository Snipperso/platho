# M19A Command Outputs

```bash
npm run build
npm audit --omit=dev --audit-level=high
npx ts-node --compiler-options '{"module":"commonjs"}' scripts/stonfi_route_discovery_m19.ts
npx vitest run tests/m19-stonfi-route-discovery.test.ts --config vitest.all.config.ts --reporter=verbose --testTimeout=30000
npm test -- --reporter=verbose --testTimeout=30000
```

Results:

```text
build: OK
audit --omit=dev: 0 vulnerabilities
M19A targeted: 1 file / 3 tests passed
full suite: 25 files / 102 tests passed
full suite exit code: 0
```
