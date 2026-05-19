#!/usr/bin/env bash
set -euo pipefail
files=(
  tests/ath-wallet-derivation.test.ts
  tests/ath-burn-finalization.test.ts
  tests/fee-accumulator.test.ts
  tests/capsulehub.test.ts
  tests/deployment-binding.test.ts
  tests/deployment-ath-wallet-binding.test.ts
  tests/vault-session-lifecycle.test.ts
  tests/vault-key-records.test.ts
  tests/vault-receive-intent.test.ts
  tests/vault-ath-integration.test.ts
  tests/vault-external-session-gate.test.ts
  tests/vault-m6-publish.test.ts
)
for f in "${files[@]}"; do
  echo "\n=== RUN $f ==="
  timeout 60s npx vitest run "$f" --reporter=dot --testTimeout=60000
  echo "=== PASS $f ==="
done
