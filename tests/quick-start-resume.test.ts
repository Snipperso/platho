import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Quick-start onboarding: resume-after-background-lock + activation funds gate (owner UX request 2026-07-02).
// Structural guards — the flow itself is exercised on-device; these pin the wiring so it can't silently regress.
describe('quick-start resume + activation gate guard', () => {
  const app = readFileSync('web/app.js', 'utf8');
  const css = readFileSync('web/styles.css', 'utf8');

  it('QS-RESUME-01: progress is persisted, resumed on boot + unlock, and cleared on finish/dismiss', () => {
    expect(app).toMatch(/const QUICK_START_PROGRESS_KEY = 'platho\.quickstart\.step\.v1'/);
    // Saved at the end of a step render (but not in backup-only mode).
    expect(app).toMatch(/if \(!quickStartBackupMode\) saveQuickStartProgress\(quickStartStepIndex\)/);
    // Resumed FIRST on boot (jumps to the saved step even though a wallet now exists), gated on not-dismissed.
    expect(app).toMatch(/const savedStep = readQuickStartProgress\(\);\s*if \(savedStep !== null && !quickStartDismissedForever\(\)\) \{\s*openQuickStartAtStep\(savedStep\)/);
    // Resumed after a background-lock + unlock.
    expect(app).toMatch(/maybeResumeQuickStartAfterUnlock\(\);/);
    expect(app).toMatch(/function openQuickStartAtStep\(index\)/);
    // Cleared on finish and on explicit dismissal.
    expect(app).toMatch(/function finishQuickStart\(\)\s*\{\s*clearQuickStartProgress\(\)/);
    const closeFn = app.slice(app.indexOf('function closeQuickStart'), app.indexOf('function finishQuickStart'));
    expect(closeFn).toMatch(/clearQuickStartProgress\(\)/);
    // Index clamped so a stale marker (steps array changed) can't point out of range.
    expect(app).toMatch(/quickStartStepIndex = Math\.max\(0, Math\.min\(Number\(index\) \|\| 0, QUICK_START_STEPS\.length - 1\)\)/);
  });

  it('QS-RESUME-02: activation step gates on wallet funds and offers Back to Top up', () => {
    // The Activate step body derives balance vs the activation fee and disables the action when underfunded.
    expect(app).toMatch(/function buildQuickStartActivateBody\(\)/);
    expect(app).toMatch(/const underfunded = bal !== null && bal < fee;/);
    expect(app).toMatch(/quickStartActionButton\.disabled = underfunded;/);
    expect(app).toMatch(/backBtn\.addEventListener\('click', \(\) => \{ quickStartGoToStepByKey\('topup'\); \}\)/);
    // run() double-checks funds and returns guidance instead of attempting a doomed on-chain activation.
    const activateStep = app.slice(app.indexOf("key: 'activate'"), app.indexOf("key: 'activate'") + 1200);
    expect(activateStep).toMatch(/if \(bal !== null && bal < fee\) \{\s*return `Not enough GRAM/);
    // Top-up step shows a live balance so arrived funds are visible.
    expect(app).toMatch(/function buildQuickStartTopUpBody\(\)/);
    expect(app).toMatch(/function quickStartWalletTonNanotons\(\)/);
    // Balance step re-checks on return-to-foreground.
    expect(app).toMatch(/quickStartRefreshCurrentBalanceStep\(\);/);
  });

  it('QS-RESUME-03: badge/hint styling is CSS-class based (prod CSP bans inline styles)', () => {
    expect(css).toMatch(/\.quick-start-balance-line \{/);
    expect(css).toMatch(/\.quick-start-step-hint \{/);
    expect(css).toMatch(/\.quick-start-step-hint\.is-error \{/);
    expect(app).not.toMatch(/style\s*=\s*["'`][^"'`]*quick-start-balance/);
  });
});
