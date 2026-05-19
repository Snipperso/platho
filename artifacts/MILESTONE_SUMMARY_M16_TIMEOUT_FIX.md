# Platho M16A Test Orchestration Timeout Fix

Status: PASS

This package fixes the M16 test-runner timeout/hang. Contract logic was not changed.

## Root Cause

The suite itself was not failing and was not too slow. The old all-suite Vitest configuration used the regular worker pool:

```ts
pool: 'threads'
```

Under the TON sandbox-heavy suite, Vitest 4.x could print the final successful summary and then keep the worker pool alive instead of exiting. Previous artifacts therefore showed:

```text
22 test files passed
97 tests passed
process did not exit before outer timeout
```

That was a test-orchestration problem, not a contract failure.

## Fix

`vitest.all.config.ts` and `vitest.debug.config.ts` now use:

```ts
pool: 'vmThreads'
fileParallelism: false
maxWorkers: 1
minWorkers: 1
```

This keeps the suite deterministic and single-worker, but makes Vitest exit cleanly after the final summary.

## Validation

Commands run:

```bash
npm run build
npm audit --omit=dev --audit-level=high
npm test -- --reporter=dot --testTimeout=30000
npx vitest run tests/m16-conformance-static.test.ts --config vitest.all.config.ts --reporter=verbose --testTimeout=30000
npx ts-node scripts/conformance_m16.ts
```

Results:

```text
build: OK
audit --omit=dev: 0 vulnerabilities
full suite: 22 files passed / 97 tests passed
full suite exit code: 0
full suite wall time: ~20.7s
M16 targeted conformance: 5/5 passed
conformance report: PASS
```

## Contract Code Hashes

No contract source was changed. Code hashes remain unchanged from M16.
