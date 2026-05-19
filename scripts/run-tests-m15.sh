#!/usr/bin/env bash
set -euo pipefail
mapfile -t files < <(find tests -maxdepth 1 -name '*.test.ts' | sort)
passed=0
for f in "${files[@]}"; do
  echo "\n=== RUN $f ==="
  npx vitest run "$f" --reporter=dot --testTimeout=60000 --pool=forks --maxWorkers=1
  passed=$((passed + 1))
  echo "=== PASS $f ==="
done
echo "\nM15 sequential test files passed: $passed/${#files[@]}"
