import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';

// Quick-start onboarding: resume-after-background-lock + activation funds gate (owner UX request 2026-07-02).
// Structural guards — the flow itself is exercised on-device; these pin the wiring so it can't silently regress.
describe('quick-start resume + activation gate guard', () => {
  const app = readFileSync('web/app.js', 'utf8');
  const css = readFileSync('web/styles.css', 'utf8');
  const html = readFileSync('web/index.html', 'utf8');

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

  it('QS-RESUME-02: the activation step is TWO states, and the short one offers no doomed button', () => {
    // [OWNER 2026-08-10] Rebuilt. It used to be one screen carrying four controls — Check balance, Back to top up,
    // Skip, Activate — where the last was disabled exactly when the user most wanted to press it. Now the balance
    // decides which of two things the step is:
    //   funded -> ONE full-width Activate plate, footer Continue.
    //   short  -> no action plate at all, a sentence saying where to activate later, footer Done.
    // A button that is going to refuse is worse than no button: it reads as broken, which is the complaint that
    // started this whole pass ("кнопка не работает").
    expect(app).toMatch(/function buildQuickStartActivateBody\(\)/);
    expect(app).toMatch(/function quickStartActivationUnderfunded\(\)/);
    const activateBody = app.slice(
      app.indexOf('function buildQuickStartActivateBody()'),
      app.indexOf('function buildQuickStartBackupBody'),
    );
    expect(activateBody.length, 'the slice must not collapse or run away').toBeGreaterThan(800);
    expect(activateBody).toMatch(/wrap\.className = 'quick-start-key-body';/);
    // The one action is the same full-width plate as the three steps before it.
    expect(activateBody).toMatch(/activate\.className = 'discovery-cta-action quick-start-key-cta';/);
    expect(activateBody).toMatch(/await submitVaultRegisterMessagingKeys\(\)/);
    // The fork itself: exactly one of the plate and the explanation is on screen.
    expect(activateBody).toMatch(/activate\.hidden = blocked;/);
    expect(activateBody).toMatch(/hint\.hidden = !blocked;/);
    // [MEASURED 2026-08-10, owner's report] A LOCKED wallet is the third state, and it used to be invisible: the
    // plate showed, the click reached submitKeyShardRegisterDirect, and that throws on its first line because
    // locking clears localVaultDraft. What the user saw was "could not complete — you can skip and do this later",
    // which names the wrong problem and walks them away from a five-second fix. Locked outranks underfunded.
    expect(activateBody).toMatch(/const locked = !plathoWallet;/);
    expect(activateBody).toMatch(/const blocked = locked \|\| underfunded;/);
    expect(activateBody).toMatch(/hint\.textContent = locked \? t\('quickstart\.unlockToActivate'\)/);
    expect(I18N_STRINGS.en['quickstart.unlockToActivate']).toMatch(/locked/i);
    expect(app).toMatch(/function quickStartActivationBlocked\(\)/);
    expect(app).toMatch(/return !plathoWallet \|\| quickStartActivationUnderfunded\(\);/);
    // Unlocking while the step is open must refresh it, or the fix would not show until a manual re-entry.
    expect(app).toMatch(/function maybeResumeQuickStartAfterUnlock\(\)[\s\S]{0,400}?quickStartRefreshCurrentBalanceStep\(\);/);
    // Both retired controls are GONE, not merely hidden — "Back to top up" duplicated the footer's Back, and
    // "Check balance" restated a refresh that already happens on entry and on return-to-foreground.
    expect(activateBody, 'Back-to-top-up was a second copy of Back').not.toMatch(/backToTopUp/);
    expect(activateBody, 'Check balance restated an automatic refresh').not.toMatch(/quickstart\.checkBalance/);
    expect(app, 'the step-jump helper existed only for Back-to-top-up').not.toMatch(/quickStartGoToStepByKey/);
    expect(I18N_STRINGS.en['quickstart.backToTopUp'], 'its label must go too').toBeUndefined();
    // The underfunded copy names where to finish the job, and that place must be the tab the row now lives on.
    expect(I18N_STRINGS.en['quickstart.notEnoughGramHint']).toMatch(/Profile tab/);
    expect(I18N_STRINGS.en['quickstart.notEnoughGramHint']).toMatch(/Activate Platho account/);
    // The footer says which of the two states it is ending, and never blocks — nothing here can fail any more.
    const activateStep = app.slice(app.indexOf("key: 'activate'"), app.indexOf('let quickStartStepIndex = 0;'));
    expect(activateStep.length, 'the activate step slice must not collapse').toBeGreaterThan(300);
    expect(activateStep).toMatch(/action: \(\) => \(quickStartActivationBlocked\(\) \? t\('common\.done'\) : t\('common\.continue'\)\)/);
    expect(activateStep).toMatch(/run: async \(\) => true,/);
    expect(activateStep, 'the doomed-activation guidance string went with the gate').not.toMatch(/notEnoughToActivate/);
    expect(I18N_STRINGS.en['quickstart.notEnoughToActivate']).toBeUndefined();
    // Top-up step shows a live balance so arrived funds are visible.
    expect(app).toMatch(/function buildQuickStartTopUpBody\(\)/);
    expect(app).toMatch(/function quickStartWalletTonNanotons\(\)/);
    // Balance step re-checks on return-to-foreground — this is what removing "Check balance" now leans on.
    expect(app).toMatch(/quickStartRefreshCurrentBalanceStep\(\);/);
  });

  it('QS-RESUME-09: the stepper footer is Back + one primary, and every step label is re-translatable', () => {
    // (a) Skip is DELETED, not hidden. Once each optional step's primary learned to pass through by itself, Skip
    // had no path where it did anything different — QS-RESUME-07's counter-case is what forced the choice between
    // "some step still offers it" and "remove it", and this is the removal.
    expect(app, 'the Skip control must be gone from the code').not.toMatch(/quickStartSkipButton/);
    expect(app, 'and its per-step opt-out with it').not.toMatch(/offerSkip/);
    expect(html, 'and from the markup').not.toMatch(/quickStartSkipButton/);
    expect(I18N_STRINGS.en['common.skip'], 'and its label from the dictionary').toBeUndefined();
    const footer = html.slice(html.indexOf('quick-start-actions quick-start-step-actions'), html.indexOf('</section>', html.indexOf('quick-start-actions quick-start-step-actions')));
    expect(footer).toMatch(/id="quickStartBackButton"/);
    expect(footer).toMatch(/id="quickStartActionButton"/);
    expect((footer.match(/<button/g) ?? []).length, 'exactly two controls in the footer').toBe(2);

    // (b) [MEASURED 2026-08-10] Every step's title/why/action is a FUNCTION, resolved per render. They were plain
    // strings built once at module load with t() already applied, so switching language from the picker inside
    // this very dialog re-translated the static heading and left the step's own text in the previous language.
    const table = app.slice(app.indexOf('const QUICK_START_STEPS = ['), app.indexOf('let quickStartStepIndex = 0;'));
    expect(table.length, 'the step table slice must not collapse').toBeGreaterThan(2000);
    for (const field of ['title', 'action', 'why']) {
      const lazy = (table.match(new RegExp(`\\n    ${field}: \\(\\) =>`, 'g')) ?? []).length;
      const eager = (table.match(new RegExp(`\\n    ${field}: t\\(`, 'g')) ?? []).length;
      expect(eager, `${field} must never be resolved at module load`).toBe(0);
      expect(lazy, `every step must supply ${field} lazily`).toBe(5);
    }
    // (c) [OWNER 2026-08-10] "Why do I have to press Create wallet — just create it." Entering the stepper with
    // nothing stored starts step 1 on its own. It goes through the SAME named action the button calls, so the
    // status line and failure wording cannot drift; cancelling the password leaves the ordinary step on screen.
    expect(app).toMatch(/async function runQuickStartPrimaryAction\(\)/);
    expect(app).toMatch(/quickStartActionButton\?\.addEventListener\('click', \(\) => \{ runQuickStartPrimaryAction\(\); \}\)/);
    const begin = app.slice(
      app.indexOf("quickStartBeginButton?.addEventListener('click'"),
      app.indexOf("quickStartCloseButton?.addEventListener('click'"),
    );
    expect(begin.length, 'the begin-handler slice must not collapse').toBeGreaterThan(200);
    expect(begin).toMatch(/if \(!hasStoredPlathoWalletRecord\(\)\) \{[\s\S]{0,160}?await runQuickStartCreateWallet\(\)/);
    // ORDER is the whole point: the prompt runs BEFORE the stepper is revealed. Firing it after the first render
    // left the "Create wallet" screen flashing on both sides of the dialog — the very screen this removes.
    expect(begin.indexOf('runQuickStartCreateWallet'), 'prompt first, stepper second')
      .toBeLessThan(begin.indexOf('quickStartStepsView.hidden = false'));
    // Counter-case: it must NOT fire for someone who already has a wallet, or every visit re-prompts for a password.
    expect(begin, 'auto-create is gated on there being nothing yet')
      .not.toMatch(/^\s*await runQuickStartCreateWallet\(\);/m);

    expect(app).toMatch(/setText\(quickStartStepTitle, step\.title\(\)\);/);
    expect(app).toMatch(/setText\(quickStartStepWhy, step\.why\(\)\);/);
    expect(app).toMatch(/quickStartActionButton\.textContent = step\.action\(\);/);
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
    // Full-width plate since 2026-08-10, same class as the get-a-key and save-key plates — see QS-RESUME-09.
    expect(topup).toMatch(/check\.className = 'discovery-cta-action quick-start-key-cta';/);
    // [OWNER 2026-08-09] The address row owns the copy action, and the step's primary button is a plain Next. It
    // used to BE the copy button and silently doubled as the way forward, so a step showing Back and Skip had no
    // visible Next at all — copying was the only way on, which nobody can guess.
    expect(topup).toMatch(/addrRow\.append\(addr, copyBtn\);/);
    expect(topup).toMatch(/wrap\.append\(addrRow, balanceLine, check\);/);
    const steps = app.slice(app.indexOf("key: 'topup'"), app.indexOf("key: 'activate'"));
    expect(steps).toMatch(/action: \(\) => t\('common\.continue'\),/);
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

  it('QS-RESUME-07: Back actually goes back, and the key step has ONE way forward', () => {
    // [OWNER 2026-08-10, from a TG Mini App screenshot of step 2] Four complaints, one of them a real bug.
    //
    // (1) "Кнопка Назад не работает". It fired every time and the index really did decrement — onto step 1, whose
    // autoDone() (a wallet exists by then) made the renderer advance straight forward again. The auto-skip is a
    // FORWARD rule: it exists so a returning user is not asked to redo finished work. Applied to a deliberate Back
    // it becomes a trap with no exit and no feedback.
    expect(app).toMatch(/function renderQuickStartStep\(\{ skipCompleted = true \} = \{\}\)/);
    expect(app).toMatch(/if \(skipCompleted && !step\.optional && step\.autoDone\(\)\) \{ quickStartAdvance\(\); return; \}/);
    const backHandler = app.slice(
      app.indexOf("quickStartBackButton?.addEventListener('click'"),
      app.indexOf("quickStartSkipButton?.addEventListener('click'"),
    );
    expect(backHandler.length, 'the slice must not collapse or run away').toBeGreaterThan(120);
    expect(backHandler).toMatch(/renderQuickStartStep\(\{ skipCompleted: false \}\)/);
    // Counter-case: forward motion must STILL skip finished steps, or a returning user is walked through work they
    // already did. quickStartAdvance is the forward door and it takes the default.
    expect(app).toMatch(/function quickStartAdvance\(\) \{[\s\S]{0,220}?renderQuickStartStep\(\);/);

    const keyStep = app.slice(app.indexOf("t('quickstart.addKeyTitle')"), app.indexOf("key: 'export'"));
    expect(keyStep.length, 'the key step slice must not collapse').toBeGreaterThan(600);
    // (4) The primary is "Continue", not "Save key" — it moves the stepper on whether or not a key was typed.
    expect(keyStep).toMatch(/action: \(\) => t\('common\.continue'\),/);
    expect(app, 'the Save-key label is orphaned and must not linger').not.toMatch(/quickstart\.saveKeyAction/);
    expect(I18N_STRINGS.en['quickstart.saveKeyAction'], 'and it must be gone from the dictionary too').toBeUndefined();
    // (3) An empty field ADVANCES instead of reporting a failure. That return value is the whole reason a Skip
    // button had to exist here; Skip itself is now gone from the app entirely — see QS-RESUME-09.
    expect(keyStep).toMatch(/if \(!trimmed\) return true;/);
    expect(keyStep, 'a blank field must never clear a stored key').not.toMatch(/applyToncenterApiKey\(''\)/);
    // Counter-case: the pass-through must be the OPTIONAL steps' own behaviour, not a blanket "run always wins".
    // A mandatory step still has to be able to refuse, or the wizard would wave everyone past creating a wallet.
    const createStep = app.slice(app.indexOf('const QUICK_START_STEPS = ['), app.indexOf("t('quickstart.addKeyTitle')"));
    expect(createStep.length, 'the create-wallet step slice must not collapse').toBeGreaterThan(200);
    expect(createStep).toMatch(/optional: false,/);
    expect(createStep).toMatch(/run: \(\) => runQuickStartCreateWallet\(\)/);
    expect(app, 'a refused mandatory step still reports it').toMatch(/t\('quickstart\.notCompleted'\)/);

    // (2) The get-a-key plate spans the body. Same specificity as the hug-your-text rule it overrides, so SOURCE
    // ORDER is load-bearing: reorder the two and the button silently goes back to being narrow.
    expect(keyStep).toMatch(/getKey\.className = 'discovery-cta-action quick-start-key-cta';/);
    const hug = css.indexOf('.quick-start-key-body > .discovery-cta-action {');
    const stretch = css.indexOf('.quick-start-key-body > .quick-start-key-cta {');
    expect(hug, 'the base hug rule must still exist').toBeGreaterThan(-1);
    expect(stretch, 'the stretch rule must exist').toBeGreaterThan(-1);
    expect(stretch, 'the stretch rule must come AFTER the hug rule to win').toBeGreaterThan(hug);
    const stretchRule = css.slice(stretch, css.indexOf('}', stretch));
    expect(stretchRule).toMatch(/justify-self: stretch;/);
    // ...and the label sits in the MIDDLE of it. .discovery-cta-action is an inline-flex with no justify-content,
    // which nobody could see while the plate hugged its text and became a left-shoved label once it spanned the row.
    expect(stretchRule).toMatch(/justify-content: center;/);
  });

  it('QS-RESUME-08: the backup step puts its real action in the body, footer is Back + Continue', () => {
    // [OWNER 2026-08-10] Same treatment as the key step one screen earlier: the thing you actually DO is a
    // full-width plate in the body, and the footer means only "move through the stepper". A footer button that
    // sometimes navigates and sometimes performs an irreversible action is the ambiguity being removed.
    expect(app).toMatch(/function buildQuickStartBackupBody\(\)/);
    const body = app.slice(
      app.indexOf('function buildQuickStartBackupBody()'),
      app.indexOf('const QUICK_START_STEPS = ['),
    );
    expect(body.length, 'the slice must not collapse or run away').toBeGreaterThan(400);
    // Same plate class as the get-a-key button, so ONE css rule stretches both and they cannot drift apart.
    expect(body).toMatch(/save\.className = 'discovery-cta-action quick-start-key-cta';/);
    expect(body).toMatch(/save\.textContent = t\('quickstart\.saveWalletKeyAction'\);/);
    expect(body).toMatch(/await exportEncryptedWalletKeyFile\(\)/);
    // The plate reports into the step status line — the footer used to do this and must not go silent.
    expect(body).toMatch(/setText\(quickStartStepStatus, t\('quickstart\.working'\)\)/);
    expect(body).toMatch(/setText\(quickStartStepStatus, ok === false \? t\('quickstart\.notCompleted'\) : t\('quickstart\.done'\)\)/);
    // Re-entrancy: the plate disables itself for the duration, or a double tap saves the file twice.
    expect(body).toMatch(/save\.disabled = true;[\s\S]*save\.disabled = false;/);

    const exportStep = app.slice(app.indexOf("key: 'export'"), app.indexOf("key: 'topup'"));
    expect(exportStep.length, 'the export step slice must not collapse').toBeGreaterThan(300);
    expect(exportStep).toMatch(/action: \(\) => t\('common\.continue'\),/);
    expect(exportStep).toMatch(/body: \(\) => buildQuickStartBackupBody\(\),/);
    expect(exportStep).toMatch(/run: async \(\) => true,/);
    // The footer no longer runs the export, and that is the whole point — assert it moved rather than multiplied.
    expect(exportStep, 'the export must not ALSO hang off the footer action').not.toMatch(/exportEncryptedWalletKeyFile/);
    // Scoped count, not a guessed global one: inside the stepper the export is reachable from exactly ONE place.
    // (The wallet screen has its own separate save-key buttons and is none of this test's business.)
    const stepper = app.slice(
      app.indexOf('function buildQuickStartBackupBody()'),
      app.indexOf('let quickStartStepIndex = 0;'),
    );
    expect(stepper.length, 'the stepper slice must not collapse or run away').toBeGreaterThan(1000);
    expect((stepper.match(/exportEncryptedWalletKeyFile\(\)/g) ?? []).length, 'one way to save the file, not two')
      .toBe(1);
    // Continue now passes through, so the SAFETY NET is the pending-backup nudge, not the stepper. If this ever
    // stops re-opening the stepper on the backup step, a user can leave onboarding with no key file at all.
    expect(app).toMatch(/markWalletKeyBackupPending\(/);
    expect(app).toMatch(/quickStartBackupMode = true/);
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
    // [OWNER 2026-08-10] With Skip gone the footer is two buttons, and they split the row EQUALLY. Basis 0 is the
    // load-bearing part: `1 1 160px` made them both grow but from different starting widths, so they came out
    // different sizes. min-width:0 keeps a long localized label shrinking instead of widening the dialog.
    expect(css).toMatch(/\.quick-start-step-actions > button \{[^}]*flex: 1 1 0;[^}]*min-width: 0;/);
    // MEASURED: `flex: 1 1 0` alone did NOT make them equal — horizontal padding still counts toward each item's
    // base size, so Back (0 16px) rendered exactly 20px wider than the primary (the UA's 1px 6px), 183 vs 163 in
    // a 355px row. Equalising the padding is the half that makes "equal halves" true (173.33 each).
    expect(css).toMatch(/\.quick-start-step-actions > button \{[^}]*padding-left: 16px;[^}]*padding-right: 16px;/);
    expect(css, 'no per-class sizing left to make the two disagree')
      .not.toMatch(/\.quick-start-step-actions > \.(?:recipient-submit|secondary-button) \{/);
  });
});
