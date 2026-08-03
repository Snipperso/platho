#!/usr/bin/env node
// Run the canonical suite, then ALWAYS write the evidence summary, then exit with the suite's code.
//
// WHY THIS REPLACES `vitest && write_full_test_summary`, measured 2026-08-02:
//
// `&&` skips the generator whenever the suite is red. Two things follow, and both bit today.
//
// FIRST, the evidence artefact keeps the numbers of the last GREEN run and goes on claiming PASS while the tree is
// broken. The release guards bind a production bundle to that artefact. It only failed to mislead because the raw
// machine record was read by hand — the artefact itself said 1539/1539 PASS over a run that had five failures.
//
// SECOND, it makes the release-truth guard unable to converge. That guard compares the artefact against the machine
// record of the PREVIOUS run; adding a test file makes them disagree, the run goes red, the generator is skipped, the
// artefact stays stale, and the NEXT run disagrees again. Six times today a green tree cost two full ten-minute runs
// instead of one. Writing the summary unconditionally closes the loop: the artefact always describes the run that just
// happened, so the following run compares equal numbers.
//
// The generator is already fail-closed about the verdict — it writes status BLOCKED when the run it read was red — so
// running it after a failure records the failure rather than hiding it. What must NOT be lost is the exit code, and
// that is the whole reason this is a script and not a `;` in package.json: `;` would swallow it, and `&&`/`;` behave
// differently under cmd.exe and sh anyway.
import { spawnSync } from 'node:child_process';

// Overridable ONLY so the guard can drive this against a deliberately failing fixture — the property under test is
// "a red suite still writes evidence", and that cannot be observed on a suite that passes. Defaults are canonical.
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const RUN_JSON = arg('--out', 'artifacts/local/CURRENT_FULL_TEST_RUN.json');
const CONFIG = arg('--config', 'vitest.all.config.ts');
// vitest's own JS entry, run by THIS node — not `npx`. Node refuses to spawn a `.cmd` without a shell (EINVAL since
// the CVE-2024-27980 fix), and a shell would drag quoting rules that differ between cmd.exe and sh back in. Measured:
// spawning npx.cmd here failed outright, and the failure looked exactly like a suite that produced no report.
const VITEST_BIN = 'node_modules/vitest/vitest.mjs';

const suite = spawnSync(process.execPath, [
  VITEST_BIN, 'run',
  '--config', CONFIG,
  '--reporter=json',
  `--outputFile=${RUN_JSON}`,
], { stdio: 'inherit' });

if (suite.error) {
  console.error(`could not start the suite: ${suite.error.message}`);
  process.exit(1);
}

const summary = spawnSync(process.execPath, ['scripts/write_full_test_summary.mjs', RUN_JSON], { stdio: 'inherit' });

// The suite's verdict is the one that matters; a generator failure is still worth surfacing, but it must not turn a
// red suite green.
const suiteCode = suite.status ?? 1;
if (suiteCode !== 0) process.exit(suiteCode);
process.exit(summary.status ?? 1);
