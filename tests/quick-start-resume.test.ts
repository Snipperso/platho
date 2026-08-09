import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';

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
    // Activate-step body: same gapped stacking as Top up (quick-start-key-body) so the balance/hint/actions
    // never glue together, and BOTH actions wear the shared plate-CTA class (the "Add contact" look) — owner
    // reported the old secondary-button pair looked non-canonical and stuck together on iPhone.
    const activateBody = app.slice(
      app.indexOf('function buildQuickStartActivateBody()'),
      app.indexOf('function buildQuickStartActivateBody()') + 1200,
    );
    expect(activateBody).toMatch(/wrap\.className = 'quick-start-key-body';/);
    expect(activateBody).toMatch(/check\.className = 'discovery-cta-action';/);
    expect(activateBody).toMatch(/backBtn\.className = 'discovery-cta-action';/);
    expect(activateBody).not.toMatch(/className = 'secondary-button'/);
    // run() double-checks funds and returns guidance instead of attempting a doomed on-chain activation.
    const activateStep = app.slice(app.indexOf("key: 'activate'"), app.indexOf("key: 'activate'") + 1200);
    expect(activateStep).toMatch(/if \(bal !== null && bal < fee\) \{\s*return t\('quickstart\.notEnoughToActivate'/);
    // ...and the shipped copy for that key still tells the user they're short on GRAM.
    expect(I18N_STRINGS.en['quickstart.notEnoughToActivate']).toMatch(/Not enough GRAM/);
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

  it('QS-RESUME-04: balance reads the PUBLIC receive address (works when the wallet is locked) + Check-balance wears the plate-CTA look', () => {
    // Root fix: the top-up/activate balance read the RECEIVE ADDRESS directly instead of requiring the unlocked
    // wallet. Onboarding can resume at those steps with the wallet record stored but NOT loaded into runtime
    // (step 1 auto-dones on the stored record), which left the balance stuck on "checking…" forever.
    const refresh = app.slice(
      app.indexOf('async function quickStartRefreshWalletBalanceRaw()'),
      app.indexOf('async function quickStartRefreshWalletBalanceRaw()') + 720,
    );
    expect(refresh).toMatch(/const address = currentWalletReceiveAddress\(\);/);
    expect(refresh).toMatch(/await loadConnectedTonWalletBalance\(address\)/);
    // No longer routed through the profile refresh, which returned null early when plathoWallet was not loaded.
    expect(refresh).not.toMatch(/refreshWalletTonBalanceForProfile/);
    // The balance reader accepts an explicit address; the default keeps the unlocked-wallet callers unchanged.
    expect(app).toMatch(/async function loadConnectedTonWalletBalance\(address = requirePlathoWalletAddress\(\)\)/);
    // Top-up "Check balance" button: gapped body + the shared plate-CTA class (same look as "Add contact").
    // Sliced to the function's real END, not a byte count: a fixed +900 pushed this assertion out of the window
    // the moment the step gained its own copy button, failing a gate that had nothing to do with the change.
    const topupStart = app.indexOf('function buildQuickStartTopUpBody()');
    const topup = app.slice(topupStart, app.indexOf('\nfunction buildQuickStartActivateBody(', topupStart));
    expect(topup.length, 'the slice must not collapse or run away').toBeGreaterThan(400);
    expect(topup).toMatch(/wrap\.className = 'quick-start-key-body';/);
    expect(topup).toMatch(/check\.className = 'discovery-cta-action';/);
    // [OWNER 2026-08-09] The address row owns the copy action, and the step's primary button is a plain Next. It
    // used to BE the copy button and silently doubled as the way forward, so a step showing Back and Skip had no
    // visible Next at all — copying was the only way on, which nobody can guess.
    expect(topup).toMatch(/addrRow\.append\(addr, copyBtn\);/);
    expect(topup).toMatch(/wrap\.append\(addrRow, balanceLine, check\);/);
    const steps = app.slice(app.indexOf("key: 'topup'"), app.indexOf("key: 'activate'"));
    expect(steps).toMatch(/action: t\('common\.continue'\),/);
    expect(steps, 'the primary button must not copy anything').not.toMatch(/copyTextToClipboard/);
  });

  it('QS-RESUME-06: the install invitation queues behind everything else, and is not lost', () => {
    // [OWNER 2026-08-09] Dialogs climbing on top of each other after activation. The install card and the
    // activation welcome are SEPARATE elements, each showing itself with no idea the other exists, so the order was
    // whichever fired first: the install card appeared, then "Account activated" landed on top of it.
    //
    // The install prompt is the lowest-priority thing the app ever says — an invitation, not news — so it yields to
    // anything open and is re-offered afterwards. DEFERRED, not dropped: without the memory, activating an account
    // would silently cost the user the prompt entirely.
    expect(app).toMatch(/function blockingDialogOpen\(\)/);
    const blocking = app.slice(app.indexOf('function blockingDialogOpen()'), app.indexOf('function openInstallDialogIfUseful()'));
    for (const other of ['activeActionDialog', 'quickStartDialog', 'activationWelcomeDialog']) {
      expect(blocking, `${other} must be able to hold the install card back`).toMatch(new RegExp(other));
    }
    const open = app.slice(app.indexOf('function openInstallDialogIfUseful()'), app.indexOf('function offerDeferredInstallPrompt()'));
    expect(open).toMatch(/if \(blockingDialogOpen\(\)\) \{[\s\S]{0,400}?installPromptDeferred = true;[\s\S]{0,40}?return;/);
    expect(open.indexOf('installPromptDeferred = true')).toBeLessThan(open.indexOf('installDialog.hidden = false'));
    // Released from BOTH doors: closing the welcome, and leaving quick start. The quick-start exit flushes the
    // welcome FIRST, so if that opens, this defers again and fires when the welcome closes — which is the order
    // the owner asked for: "activated" first, "install Platho" after.
    expect(app).toMatch(/function closeActivationWelcomeDialog\(\) \{[\s\S]{0,240}?offerDeferredInstallPrompt\(\);/);
    expect(app).toMatch(/flushPendingActivationWelcome\(\);[\s\S]{0,300}?offerDeferredInstallPrompt\(\);/);
    const closeQs = app.slice(app.indexOf('function closeQuickStart()'), app.indexOf('function closeQuickStart()') + 900);
    expect(closeQs.indexOf('flushPendingActivationWelcome()'), 'the welcome must be released before the invitation')
      .toBeLessThan(closeQs.indexOf('offerDeferredInstallPrompt()'));
  });

  it('QS-RESUME-05: the stepper fits a narrow phone/TG-Mini-App screen (no horizontal overflow)', () => {
    // Owner reported the step-5 activation card spilling off the right edge on an iPhone. Root causes were
    // (1) nested grid items with the default min-width:auto letting a long localized paragraph's max-content
    // inflate the dialog past its width, and (2) a fixed `auto auto 1fr` footer that could not shrink or wrap
    // the long primary-action label. Both are pinned here so the fit can't silently regress.
    // (1) min-width:0 down the grid-item chain so the dialog width stays authoritative and text wraps.
    expect(css).toMatch(/\.quick-start-dialog \{[^}]*min-width: 0;/);
    expect(css).toMatch(/\.quick-start-view \{[^}]*min-width: 0;/);
    expect(css).toMatch(/\.quick-start-step-body \{[^}]*min-width: 0;/);
    // (2) footer is flex-wrap (NOT a rigid auto auto 1fr grid); the primary action can wrap to its own row.
    expect(css).toMatch(/\.quick-start-step-actions \{[^}]*display: flex;[^}]*flex-wrap: wrap;/);
    expect(css).not.toMatch(/\.quick-start-step-actions \{[^}]*grid-template-columns: auto auto 1fr;/);
    expect(css).toMatch(/\.quick-start-step-actions > \.recipient-submit \{[^}]*flex: 1 1 160px;[^}]*white-space: nowrap;/);
  });
});
