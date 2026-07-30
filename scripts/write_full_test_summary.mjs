#!/usr/bin/env node
// Writes the numeric half of artifacts/CURRENT_FULL_TEST_SUMMARY.json from a REAL vitest run, instead of a human
// typing it.
//
// WHY THIS EXISTS, measured 2026-07-31: the summary claimed 1482 tests while the suite actually ran 1485, and the
// guard that is supposed to keep the evidence honest was green throughout. It compares discovered_test_files against
// a real listing of tests/ — that part is genuine — but total_tests, passed_tests, failed_tests and status were
// hand-written numbers checked only against each other. `passed_tests === total_tests` is true of any pair of equal
// numbers, including two wrong ones.
//
// A static count of `it(` declarations is not a substitute: 1520 of them exist against 1485 executed, because of
// conditional and skipped cases. The only honest source is the runner.
//
// Usage: npm run evidence:suite   (runs the canonical suite with the json reporter, then this)
// The prose fields — notes, supersedes_historical_artifacts — are PRESERVED: they are the human record and this
// script has no business rewriting them.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const RUN = 'artifacts/local/CURRENT_FULL_TEST_RUN.json';
const SUMMARY = 'artifacts/CURRENT_FULL_TEST_SUMMARY.json';

if (!existsSync(RUN)) {
  console.error(`missing ${RUN} — run the suite with --reporter=json --outputFile=${RUN} first`);
  process.exit(1);
}

const run = JSON.parse(readFileSync(RUN, 'utf8'));
const files = Array.isArray(run.testResults) ? run.testResults : [];

// FILES, not suites. vitest's numTotalTestSuites counts `describe` blocks — 412 of them across 200 files — so
// reading it here would have written a "discovered_test_files" the release-truth guard immediately rejects, and
// worse, would have looked like a real number. testResults has exactly one entry per test FILE.
const counts = {
  discovered_test_files: files.length,
  executed_test_files: files.length,
  passed_test_files: files.filter((f) => f.status === 'passed').length,
  failed_test_files: files.filter((f) => f.status !== 'passed').length,
  total_tests: run.numTotalTests ?? 0,
  passed_tests: run.numPassedTests ?? 0,
  failed_tests: run.numFailedTests ?? 0,
};

if (!counts.total_tests) {
  console.error('the run report carries no tests — refusing to write evidence from it');
  process.exit(1);
}

const summary = JSON.parse(readFileSync(SUMMARY, 'utf8'));
Object.assign(summary, counts);
// Fail-closed: the evidence may only claim PASS when the run it was generated from actually passed.
summary.status = counts.failed_tests === 0 && counts.failed_test_files === 0 ? 'PASS' : 'BLOCKED';
summary.generated_from = RUN;

writeFileSync(SUMMARY, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, status: summary.status, ...counts }, null, 2));
