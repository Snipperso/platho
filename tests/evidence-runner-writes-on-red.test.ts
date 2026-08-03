import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

// The evidence artefact must describe the run that JUST happened — including a run that failed.
//
// MEASURED 2026-08-02: `npm run evidence:suite` was `vitest ... && node write_full_test_summary.mjs`, so a red suite
// skipped the generator entirely and the artefact kept the numbers of the last GREEN run. It sat there claiming
// PASS 1539/1539 over a tree with five failures, and the release guards bind a production bundle to it. It only
// failed to mislead because the raw machine record was read by hand.
//
// The second consequence was slower but louder: the release-truth guard compares the artefact against the PREVIOUS
// run's record, so adding a test file made them disagree, the run went red, the generator was skipped, the artefact
// stayed stale — and the next run disagreed again. A green tree cost two ten-minute runs instead of one, six times
// in a day.
//
// Driving this needs a suite that actually FAILS, so the assertion is made against a private fixture config: a real
// child run of scripts/run_evidence_suite.mjs, red on purpose, with its output redirected away from the canonical
// artefacts. Asserting the property on a passing suite would prove nothing.
const FIXTURE_CONFIG = 'scripts/evidence-runner-fixture/vitest.config.ts';
const RUN_OUT = 'artifacts/local/EVIDENCE_RUNNER_FIXTURE_RUN.json';
const SUMMARY = 'artifacts/CURRENT_FULL_TEST_SUMMARY.json';
const SUMMARY_BACKUP = 'artifacts/local/CURRENT_FULL_TEST_SUMMARY.before-fixture.json';

describe('EVIDENCE-RUNNER — a red suite still records its own verdict', () => {
  it('EVRUN-01: the runner writes BLOCKED evidence and returns a non-zero code when the suite fails', () => {
    // The generator rewrites the canonical summary in place, so it is restored byte-for-byte afterwards. The suite
    // that is running RIGHT NOW is judged against that file by release-truth-single-source.
    copyFileSync(SUMMARY, SUMMARY_BACKUP);
    try {
      const res = spawnSync(process.execPath, [
        'scripts/run_evidence_suite.mjs', '--config', FIXTURE_CONFIG, '--out', RUN_OUT,
      ], { encoding: 'utf8', timeout: 120_000 });

      expect(res.error, 'the runner could not start').toBeUndefined();
      expect(res.status, 'a red suite must not exit 0').not.toBe(0);

      // The point of the whole change: the generator ran DESPITE the failure.
      const run = JSON.parse(readFileSync(RUN_OUT, 'utf8'));
      expect(run.numFailedTests).toBeGreaterThan(0);
      const summary = JSON.parse(readFileSync(SUMMARY, 'utf8'));
      expect(summary.generated_from).toBe(RUN_OUT);
      expect(summary.status).toBe('BLOCKED');
      expect(summary.failed_tests).toBe(run.numFailedTests);
    } finally {
      writeFileSync(SUMMARY, readFileSync(SUMMARY_BACKUP, 'utf8'));
      rmSync(SUMMARY_BACKUP, { force: true });
      rmSync(RUN_OUT, { force: true });
    }
    expect(existsSync(SUMMARY)).toBe(true);
  });

  it('EVRUN-03: the auto re-run cannot launder a red tree', () => {
    // The runner re-runs the whole suite once when the ONLY failure is release-truth-single-source, which by
    // construction reads the artefact written after it finished. That excuse must be narrow: EVRUN-01 above already
    // drives a red suite whose single failure is an ordinary test, and asserts a non-zero exit — so the gate is
    // exercised in the negative, not just described. Here the gate itself is pinned.
    const runner = readFileSync('scripts/run_evidence_suite.mjs', 'utf8');
    expect(runner).toContain('failures.length === 1 && failures[0].includes(RECHECK)');
    expect(runner).toContain("const RECHECK = 'release-truth-single-source';");
    // The re-run is the FULL suite with the same config — not the one guard on its own, which would let the rest of
    // the tree rot behind a green exit code.
    expect(runner).toMatch(/VITEST_BIN, 'run', '--config', CONFIG, '--reporter=json', `--outputFile=\$\{RUN_JSON\}`,\s*\], \{ stdio: 'inherit' \}\);/);
    // And its verdict REPLACES the first one rather than being ignored.
    expect(runner).toContain('suiteCode = again.status ?? 1;');
  });

  it('EVRUN-02: package.json runs the script, not a shell chain that can skip the generator', () => {
    // `&&` is what caused this; `;` would fix the skip and lose the exit code, and the two behave differently under
    // cmd.exe and sh. Pinned so the chain cannot come back.
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.scripts['evidence:suite']).toBe('node scripts/run_evidence_suite.mjs');
    expect(pkg.scripts['evidence:suite']).not.toMatch(/&&|;/);
  });
});
