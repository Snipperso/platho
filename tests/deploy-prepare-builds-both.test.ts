import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// The preview and production artifact sets are pinned by the SAME test (WEB-DEPLOY-05), so regenerating one and
// forgetting the other leaves the tree red for a reason that has nothing to do with the change being made.
//
// MEASURED 2026-08-03: that happened twice in one session and cost two full ten-minute suite runs. The fix is not
// discipline, it is removing the half that can be forgotten — `npm run web:deploy:prepare` now writes both.
const PKG = JSON.parse(readFileSync('package.json', 'utf8'));
const PREPARE = readFileSync('scripts/prepare_static_web_deploy.mjs', 'utf8');
const CASCADE = readFileSync('scripts/rebaseline_cascade.mjs', 'utf8');

describe('PREPBOTH — one command writes both artifact sets', () => {
  it('PREPBOTH-01: the prepare script accepts `both` and runs both modes', () => {
    expect(PREPARE).toContain("['preview', 'production', 'both'].includes(args.mode)");
    expect(PREPARE).toContain("const modes = options.mode === 'both' ? ['preview', 'production'] : [options.mode];");
  });

  it('PREPBOTH-02: the npm script uses it, and the separate :prod half no longer exists to be forgotten', () => {
    expect(PKG.scripts['web:deploy:prepare']).toBe('node scripts/prepare_static_web_deploy.mjs --mode both');
    // The whole point: leaving the old alias in place would keep two ways to do one thing, which is how the halves
    // drifted apart in the first place.
    expect(PKG.scripts['web:deploy:prepare:prod']).toBeUndefined();
  });

  it('PREPBOTH-03: nothing still calls the removed script', () => {
    for (const [name, source] of [['cascade', CASCADE], ['package.json', JSON.stringify(PKG)]] as const) {
      expect(source, `${name} still references web:deploy:prepare:prod`).not.toContain('web:deploy:prepare:prod');
    }
  });

  it('PREPBOTH-04: preview is written FIRST, so a production blocker cannot suppress it', () => {
    // Order is load-bearing, not cosmetic: before genesis the production bundle is legitimately blocked, and the rest
    // of the tree pins the preview artifacts. Writing production first and exiting would leave them stale.
    expect(PREPARE).toContain("? ['preview', 'production']");
    // …and the exit code must still reflect EITHER set failing, or a blocked production bundle would ship silently.
    expect(PREPARE).toContain('if (reports.some((report) => report.blockers.length > 0)) process.exit(1);');
  });
});
