#!/usr/bin/env bash
set -u
: > artifacts/NPM_TEST_SEQUENTIAL_M16_OUTPUT.txt
fail=0
total_files=0
total_tests=0
for f in $(find tests -maxdepth 1 -name '*.test.ts' | sort); do
  total_files=$((total_files + 1))
  echo "### $f" | tee -a artifacts/NPM_TEST_SEQUENTIAL_M16_OUTPUT.txt
  tmp=$(mktemp)
  if timeout 90s npx vitest run "$f" --reporter=verbose --testTimeout=30000 > "$tmp" 2>&1; then
    cat "$tmp" >> artifacts/NPM_TEST_SEQUENTIAL_M16_OUTPUT.txt
    tests=$(grep -Eo 'Tests[[:space:]]+[0-9]+ passed|[0-9]+ passed' "$tmp" | tail -n 1 | grep -Eo '^[0-9]+|[0-9]+' | head -n 1 || echo 0)
    total_tests=$((total_tests + tests))
  else
    code=$?
    cat "$tmp" >> artifacts/NPM_TEST_SEQUENTIAL_M16_OUTPUT.txt
    echo "FAILED_OR_TIMEOUT $f exit=$code" | tee -a artifacts/NPM_TEST_SEQUENTIAL_M16_OUTPUT.txt
    fail=1
    rm -f "$tmp"
    break
  fi
  rm -f "$tmp"
done
{
  echo "SEQUENTIAL_M16_FILES=$total_files"
  echo "SEQUENTIAL_M16_TESTS=$total_tests"
  echo "SEQUENTIAL_M16_EXIT=$fail"
} > artifacts/NPM_TEST_SEQUENTIAL_M16_SUMMARY.txt
echo "$fail" > artifacts/NPM_TEST_SEQUENTIAL_M16_EXIT.txt
exit $fail
