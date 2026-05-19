# Platho Vault/CapsuleHub debug test orchestration milestone

## What was checked

A full-suite hang suspicion was debugged with timestamp instrumentation.

## Result

The tests themselves are not hanging deterministically.

Full Vitest run completed:

```text
Test Files: 10 passed
Tests: 59 passed
Duration: 44.87s
```

The earlier apparent hang was caused by a custom Node sequential npx runner / process orchestration artifact, not by a specific test file.

## Added tooling

```text
vitest.all.config.ts
vitest.debug.config.ts
tests/debug-setup.ts
scripts/debug-test-files.sh
```

## Package scripts

```text
npm test                  -> full suite through vitest.all.config.ts
npm run test:all          -> full suite verbose
npm run test:debug        -> full suite with per-test timestamp logging
npm run test:file -- <f>  -> run single file
npm run test:binding      -> deployment binding only
npm run test:debug:files  -> per-file bash runner with system timeout
```

## How to diagnose future hangs

Run:

```bash
npm run test:debug
```

Then inspect:

```text
vitest-full-debug.log
```

The last `TEST_START` without a matching `TEST_END` is the stuck test.

For startup/teardown/process orchestration issues, run:

```bash
npm run test:debug:files
```

and inspect:

```text
test-debug-bash.log
test-debug-bash.jsonl
```
