import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE APP MUST BE ABLE TO EVALUATE ITS OWN MODULE. Nothing else in this suite executes web/app.js.
//
// MEASURED 2026-08-29: a constant moved into capsule-part-policy.mjs without its import in app.js. The full
// suite ran 2,102 tests and passed every one of them; the app threw ReferenceError on the line that reads the
// constant, at module-evaluation time, and rendered a blank screen. Not a degraded feature — no application at
// all. It was found by opening the app in a browser, which no test does.
//
// scripts/check_app_imports.mjs answers the two questions that make module evaluation fail this way, and it was
// wired only into the TARGETED web suite — so a release run could be entirely green over an app that does not
// boot. This puts it in the canonical suite, where the release evidence is taken, without a second copy of the
// logic: the script stays the single implementation and this test is the thing that makes the release read it.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

describe('APP-BOOT', () => {
  it('APPBOOT-01: every name app.js uses is imported, and every name it imports really exists', () => {
    const run = spawnSync(process.execPath, ['scripts/check_app_imports.mjs'], { encoding: 'utf8' });
    const output = `${run.stdout ?? ''}${run.stderr ?? ''}`.trim();
    // Both directions are fatal in the same way — a browser refuses the module and the screen stays blank:
    //   * a name USED but not imported  -> ReferenceError during evaluation;
    //   * a name IMPORTED but not exported by that module -> "does not provide an export named …" at link time.
    expect(run.status, `scripts/check_app_imports.mjs failed:\n${output}`).toBe(0);
  });
});
