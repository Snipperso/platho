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
    expect(activateBody).toMatch(/await submitVaultRegisterMessagingKeys\(\{ preConfirmed: true \}\)/);
    // [OWNER 2026-08-10] The wizard already covered the backup on its own step and shows the fee beside the
    // balance, so the checkbox-by-checkbox confirmation (and its SECOND forced key download) is asking the same
    // questions twice. Pressing Activate here means activate. Every other caller still gets the confirmation.
    expect(app).toMatch(/async function submitKeyShardRegisterDirect\(\{ preConfirmed = false \} = \{\}\)/);
    expect(app).toMatch(/if \(!preConfirmed\) \{[\s\S]{0,260}?confirmPlathoAccountActivation/);
    expect(app).toMatch(/if \(needsKeyBackup\) \{ await downloadEncryptedWalletKeyBackup\(\); \}/);
    // The fork itself: exactly one of the plate and the explanation is on screen.
    // [OWNER 2026-08-10] A THIRD reason to hide it: already activated. The plate stayed live after success,
    // offering to repeat a thing that costs GRAM. applyGate re-reads the flag, so a later balance refresh
    // cannot resurrect it. [OWNER 2026-08-13] And a FOURTH: sent-but-not-yet-settled — see QS-ACTIVATE-CHAIN.
    expect(activateBody).toMatch(/activate\.hidden = blocked \|\| done \|\| inFlight;/);
    expect(activateBody).toMatch(/const done = quickStartActivationDone \|\| hasActivePlathoAccount\(\);/);
    expect(activateBody).toMatch(/hint\.hidden = done \|\| !\(blocked \|\| inFlight\);/);
    // [MEASURED 2026-08-10, owner's report] A LOCKED wallet is the third state, and it used to be invisible: the
    // plate showed, the click reached submitKeyShardRegisterDirect, and that throws on its first line because
    // locking clears localVaultDraft. What the user saw was "could not complete — you can skip and do this later",
    // which names the wrong problem and walks them away from a five-second fix. Locked outranks underfunded.
    expect(activateBody).toMatch(/const locked = !plathoWallet;/);
    expect(activateBody).toMatch(/const blocked = locked \|\| underfunded;/);
    expect(activateBody).toMatch(/\? t\('quickstart\.unlockToActivate'\)/);
    expect(I18N_STRINGS.en['quickstart.unlockToActivate']).toMatch(/locked/i);
    // [OWNER 2026-08-13] quickStartActivationBlocked is DELETED with its only caller — the footer fork. Installing
    // the app is the last step now, so this footer is plainly Next and had nothing left to decide. A predicate kept
    // "just in case" is the kind of thing a later edit re-wires into a decision it was never checked for.
    expect(app, 'the retired footer predicate must be gone, not merely unused').not.toMatch(/quickStartActivationBlocked/);
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
    // The footer only moves on, and never blocks — nothing here can fail any more.
    const activateStep = app.slice(app.indexOf("key: 'activate'"), app.indexOf("key: 'install'"));
    expect(activateStep.length, 'the activate step slice must not collapse').toBeGreaterThan(300);
    expect(activateStep).toMatch(/action: \(\) => t\('common\.next'\),/);
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
      // SIX steps since 2026-08-13 — installing the app became the last one. Counting rather than sampling is the
      // point: a new step that forgets a lazy field would otherwise ship a label frozen in the boot language.
      expect(lazy, `every step must supply ${field} lazily`).toBe(6);
    }
    // (c) [OWNER 2026-08-10] "a modal on top of a modal". Step 1 IS the password form now — no dialog opens over
    // the wizard at all. Two earlier attempts moved the stack around instead of removing it: auto-firing the prompt
    // after rendering step 1 flashed that screen on both sides of the dialog, and firing it before revealing the
    // stepper just put the dialog over the WELCOME card instead. The fields come from the SHARED spec, so the
    // credential-username entry that makes password managers offer to save is the same node the dialog builds.
    expect(app).toMatch(/function walletPasswordFieldSpecs\(\{/);
    expect(app).toMatch(/const fields = walletPasswordFieldSpecs\(\{ confirm, create, passwordManagerUsername, passwordManagerNetworkGlobalId \}\);/);
    expect(app).toMatch(/function buildQuickStartCreateWalletBody\(\)/);
    const createBody = app.slice(
      app.indexOf('function buildQuickStartCreateWalletBody()'),
      app.indexOf('function quickStartCreateWalletPassword()'),
    );
    expect(createBody.length, 'the create-body slice must not collapse').toBeGreaterThan(300);
    expect(createBody).toMatch(/walletPasswordFieldSpecs\(\{ confirm: true, create: true \}\)/);
    expect(createBody).toMatch(/wrap\.append\(createActionField\(field\)\)/);
    expect(createBody, 'the specs must be RENDERED, not retyped').not.toMatch(/credential-username/);
    // ...and they must LOOK like every other field in the app. The stepper had its own input rule that covered
    // `type="text"` only, so the password boxes landed unstyled, and it disagreed with the canonical one on
    // radius, background and height besides. It now joins that selector list rather than restating it.
    expect(css).toMatch(/\.action-dialog textarea,\s*\.quick-start-step-body input,\s*\.quick-start-step-body textarea \{/);
    expect(css).toMatch(/\.action-dialog textarea:focus,\s*\.quick-start-step-body input:focus \{/);
    expect(css, 'the divergent stepper-only input rule must be gone')
      .not.toMatch(/\.quick-start-step-body input\[type="text"\]/);
    // Validation matches the dialog's own loop, and reports on the step's status line — nothing to dismiss.
    expect(app).toMatch(/if \(password\.length < PLATHO_WALLET_PASSWORD_MIN_LENGTH\) \{[\s\S]{0,140}?t\('wallet\.passwordTooShort'/);
    expect(app).toMatch(/if \(password !== confirmPassword\) return \{ error: t\('wallet\.passwordsDoNotMatch'\) \};/);
    // The shared creator takes the already-collected password; every OTHER caller still gets the standalone prompt.
    expect(app).toMatch(/async function runQuickStartCreateWallet\(collectedPassword = null, \{ deferSeedGate = false \} = \{\}\)/);
    expect(app).toMatch(/const password = collectedPassword \?\? await requestNewWalletStoragePassword\(/);
    // Counter-case: no dialog is opened from the wizard's own entry point any more.
    const begin = app.slice(
      app.indexOf("quickStartBeginButton?.addEventListener('click'"),
      app.indexOf("quickStartCloseButton?.addEventListener('click'"),
    );
    expect(begin.length, 'the begin-handler slice must not collapse').toBeGreaterThan(120);
    expect(begin, 'entering the wizard must not launch a dialog').not.toMatch(/runQuickStartCreateWallet|requestNewWalletStoragePassword/);

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
    expect(steps).toMatch(/action: \(\) => t\('common\.next'\),/);
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
    const closeQs = app.slice(app.indexOf('function closeQuickStart()'), app.indexOf('function finishQuickStart()'));
    expect(closeQs.length, 'the close-handler slice must not collapse').toBeGreaterThan(400);
    expect(closeQs.indexOf('flushPendingActivationWelcome()'), 'the welcome must be released before the invitation')
      .toBeLessThan(closeQs.indexOf('offerDeferredInstallPrompt()'));
    // [OWNER 2026-08-13] ...unless the wizard already asked, because installing is now a STEP. Releasing the modal
    // as well would put the same question on screen twice, the second time in the style he objected to. Dropped,
    // not merely skipped: a deferred flag left standing would fire at the next dialog close instead.
    expect(closeQs).toMatch(/if \(quickStartInstallStepShown\) dropDeferredInstallPrompt\(\);\s*else offerDeferredInstallPrompt\(\);/);
    expect(app).toMatch(/function dropDeferredInstallPrompt\(\) \{\s*installPromptDeferred = false;\s*\}/);
    // Counter-case: the flag must be armed by the step actually RENDERING, not by the step merely existing — a
    // wizard that skipped the install step (Telegram, already standalone) has asked nothing and must still release.
    expect(app).toMatch(/function buildQuickStartInstallBody\(\) \{\s*quickStartInstallStepShown = true;/);
    expect(closeQs).toMatch(/quickStartInstallStepShown = false;/);
  });

  it('QS-ACTIVATE-CHAIN: the wizard says "done" only when the CHAIN says so', () => {
    // [OWNER 2026-08-13] "Я нажал, потом увидел 'Готово'. Но когда в итоге завершил квикстарт, то на балансе был
    // 1 грам и предложение активировать аккаунт в профиле." — and then, minutes later, "мне сообщает приложение,
    // что акк активирован и баланс уменьшился."
    //
    // So the external was NOT lost: it landed. What was wrong is that the step reported a settled fact it had never
    // read, while the Profile tab — which does read the shard — went on offering activation. Two surfaces
    // disagreeing about one account. Same rule the public lane was cured of this week: green means the chain.
    const activateBody = app.slice(
      app.indexOf('function buildQuickStartActivateBody()'),
      app.indexOf('function buildQuickStartBackupBody'),
    );
    expect(activateBody.length, 'the slice must not collapse or run away').toBeGreaterThan(800);
    // (a) The ONLY assignment of the done flag is guarded by a confirmed chain read.
    expect(activateBody).toMatch(/const confirmed = await waitForPlathoAccountActivation\(mine\);/);
    expect(activateBody).toMatch(/if \(confirmed\) \{\s*quickStartActivationDone = true;/);
    expect(
      (activateBody.match(/quickStartActivationDone = true/g) ?? []).length,
      'exactly one place may declare the activation done',
    ).toBe(1);
    // Counter-case: it must NOT be set from the mere return of the submit, which is what shipped.
    expect(activateBody, 'a broadcast is not a confirmation')
      .not.toMatch(/await submitVaultRegisterMessagingKeys\([^)]*\);\s*quickStartActivationDone = true/);
    // (b) The three outcomes are three DIFFERENT sentences. "Sent, confirming" is not "done", and running past the
    // horizon is not a failure — the external is still out there.
    for (const key of ['quickstart.activationSent', 'quickstart.activationSentHint',
      'quickstart.activationConfirmed', 'quickstart.activationStillConfirming']) {
      expect(Object.keys(I18N_STRINGS).every((code) => Boolean(I18N_STRINGS[code][key])), `${key} in every locale`).toBe(true);
    }
    expect(activateBody).toMatch(/t\('quickstart\.activationSent'\)/);
    expect(activateBody).toMatch(/t\('quickstart\.activationConfirmed'\)/);
    expect(activateBody).toMatch(/t\('quickstart\.activationStillConfirming'\)/);
    // (c) The waiter polls the shard rather than sleeping and hoping, treats a failed read as "learned nothing",
    // and its ladder sums to the SAME horizon the in-flight marker expires on — one horizon, not three guesses.
    const waiter = app.slice(
      app.indexOf('async function waitForPlathoAccountActivation('),
      app.indexOf('function plathoAccountActivationFeeNanotons('),
    );
    expect(waiter.length, 'the waiter slice must not collapse').toBeGreaterThan(200);
    expect(waiter).toMatch(/await refreshVaultActivationStatus\(\);/);
    expect(waiter).toMatch(/if \(hasActivePlathoAccount\(\)\) return true;/);
    const delays = /const PLATHO_ACTIVATION_CONFIRM_DELAYS_MS = \[([^\]]+)\]/.exec(app)?.[1] ?? '';
    const total = delays.split(',').map((n) => Number(n.replace(/_/g, '').trim())).reduce((a, b) => a + b, 0);
    const ttl = Number(/const PLATHO_ACTIVATION_IN_FLIGHT_TTL_MS = ([0-9_]+)/.exec(app)?.[1].replace(/_/g, '') ?? 0);
    expect(total, 'the poll ladder and the in-flight horizon must be the same number').toBe(ttl);
    // (d) A RELOAD inside that window must not re-offer a registration that is already paid for and in flight —
    // pressing it again is a second fee for one registration. The in-memory flag alone could not survive a reload.
    expect(app).toMatch(/rememberPlathoActivationInFlight\(ownerWallet\);/);
    expect(app).toMatch(/const activationInFlight = plathoAccountActivationPending \|\| plathoActivationInFlightForCurrentWallet\(\);/);
    // Wallet-scoped, so it can never lock a DIFFERENT wallet out of activating.
    const inFlight = app.slice(
      app.indexOf('function plathoActivationInFlightForCurrentWallet()'),
      app.indexOf('const PLATHO_ACTIVATION_CONFIRM_DELAYS_MS'),
    );
    expect(inFlight).toMatch(/if \(!record \|\| record\.wallet !== raw\) return false;/);
    expect(inFlight).toMatch(/PLATHO_ACTIVATION_IN_FLIGHT_TTL_MS/);
    // ...and released the moment the chain confirms, so it can never outlive what it is standing in for.
    expect(app).toMatch(/if \(accountActive\) \{ plathoAccountActivationPending = false; forgetPlathoActivationInFlight\(\); \}/);
    // (e) A wait belonging to a step the user has left writes nothing.
    expect(activateBody).toMatch(/const generation = quickStartActivationGeneration;/);
    expect(activateBody).toMatch(/const mine = \(\) => generation === quickStartActivationGeneration;/);
    expect(app).toMatch(/function buildQuickStartActivateBody\(\) \{\s*quickStartActivationGeneration \+= 1;/);

    // (f) A step REBUILT inside the settling window watches too. The previous body's wait died with its
    // generation, so without this the step would sit on "sent, confirming" until an unrelated background refresh
    // happened to land — the same "waiting for something that is not running" shape as the original bug.
    expect(activateBody).toMatch(/quickStartActivationInFlight = plathoActivationInFlightForCurrentWallet\(\);/);
    expect(activateBody).toMatch(/if \(quickStartActivationInFlight\) \{\s*setText\(quickStartStepStatus, t\('quickstart\.activationSent'\)\);\s*void confirmActivation\(quickStartActivationGeneration\);/);
    // ONE resolver, both entries — press and rebuild must not drift into two ideas of what "confirmed" means.
    expect(
      (activateBody.match(/await waitForPlathoAccountActivation\(/g) ?? []).length,
      'one waiter, shared by the press and the rebuild',
    ).toBe(1);
    // The status is set BEFORE the async watcher starts, and renderQuickStartStep blanks the status line before it
    // calls body() — so a line written here survives, unlike one written after the render.
    const render = app.slice(app.indexOf('function renderQuickStartStep({'), app.indexOf('function quickStartAdvance()'));
    expect(
      render.indexOf("setText(quickStartStepStatus, '')"),
      'the status must be cleared BEFORE the body is built, or the body could never leave a message',
    ).toBeLessThan(render.indexOf('const body = step.body();'));
  });

  it('QS-INSTALL-STEP: installing is a STEP, in the wizard\'s own clothes, and it can be absent', () => {
    // [OWNER 2026-08-13] "последним шагом мне предложили установить приложение. Тут всё оке, но сам последний шаг —
    // модалка не в стиле квикстарта. Надо бы её включить в шаги квикстарта и оформить как положено. Ну и предыдущий
    // шаг получается не 'завершить', а 'Далее'."
    const installStep = app.slice(app.indexOf("key: 'install'"), app.indexOf('let quickStartStepIndex = 0;'));
    expect(installStep.length, 'the install step slice must not collapse').toBeGreaterThan(200);
    expect(installStep).toMatch(/action: \(\) => t\('common\.done'\),/);
    expect(installStep).toMatch(/body: \(\) => buildQuickStartInstallBody\(\),/);
    // It carries no work of its own to fail at, exactly like the top-up and activate steps before it.
    expect(installStep).toMatch(/run: async \(\) => true,/);

    // (a) ONE definition of the copy, two readers. A second surface writing its own wording is how two screens
    // start disagreeing about what "install" even means on this device.
    expect(app).toMatch(/function installCopyForState\(state = installActionState\(\)\)/);
    const refresh = app.slice(app.indexOf('function refreshInstallButtons()'), app.indexOf('function installPromptDismissed()'));
    expect(refresh.length, 'the refresh slice must not collapse').toBeGreaterThan(300);
    expect(refresh).toMatch(/const copy = installCopyForState\(\);/);
    expect(refresh, 'the modal must not restate the copy it now shares').not.toMatch(/t\('install\.leadIos'\)/);
    const body = app.slice(app.indexOf('function buildQuickStartInstallBody()'), app.indexOf('const QUICK_START_STEPS = ['));
    expect(body.length, 'the install-body slice must not collapse').toBeGreaterThan(400);
    expect(body).toMatch(/const copy = quickStartInstallCopy\(\);/);
    expect(body, 'the step must not restate the copy either').not.toMatch(/t\('install\.body/);
    // ...in the wizard's own classes, which is the whole complaint.
    expect(body).toMatch(/wrap\.className = 'quick-start-key-body';/);
    expect(body).toMatch(/install\.className = 'discovery-cta-action quick-start-key-cta';/);

    // (b) A button ONLY where there is something to press. The other states are instructions, and a plate whose
    // only effect was to reopen a modal repeating these very words is the duplication being removed.
    expect(body).toMatch(/if \(copy\.state === 'prompt'\) \{/);
    expect(body, 'the step must never open the modal it replaced').not.toMatch(/installDialog|promptInstallApp/);
    // The deferred event is single-use: ONE function spends it, or the second reader finds it gone.
    expect(app).toMatch(/async function firePendingInstallPrompt\(\)/);
    expect(
      (app.match(/deferredInstallPrompt = null/g) ?? []).length,
      'the declaration, firePendingInstallPrompt and the appinstalled handler — nobody else may clear it',
    ).toBe(3);
    expect(app).toMatch(/async function promptInstallApp\(\)[\s\S]{0,900}?await firePendingInstallPrompt\(\);/);

    // (c) It can be ABSENT. Inside Telegram the PWA is meaningless and an app already running standalone is
    // already installed — skip(), not autoDone(), because this is about the device, not about finished work.
    expect(installStep).toMatch(/skip: \(\) => isTelegramEnv\(\) \|\| isStandaloneApp\(\),/);
    expect(app).toMatch(/if \(step\.skip\?\.\(\)\) \{/);
    // Stepped over in BOTH directions — a satisfied step is worth looking back at, a step that was never on this
    // device's path is not, and Back would otherwise land on a screen with nothing in it.
    const render = app.slice(app.indexOf('function renderQuickStartStep({'), app.indexOf('function quickStartAdvance()'));
    expect(render).toMatch(/if \(skipCompleted\) \{ quickStartAdvance\(\); return; \}/);
    expect(render).toMatch(/if \(quickStartStepIndex > 0\) \{ quickStartStepIndex -= 1; renderQuickStartStep\(\{ skipCompleted: false \}\); return; \}/);
    // ...and the counter counts what the user will actually walk, not what the array happens to hold.
    expect(app).toMatch(/function applicableQuickStartSteps\(\)/);
    expect(render).toMatch(/n: applicable\.indexOf\(step\) \+ 1, total: applicable\.length/);
    expect(render, 'a skipped step must not be counted').not.toMatch(/total: QUICK_START_STEPS\.length/);

    // (e) THE BOOT ORDER. refreshInstallButtons runs at MODULE TOP LEVEL, and every piece of quick-start state is
    // declared hundreds of lines below it. Reading a let/const before its declaration is a TDZ ReferenceError at
    // top level — which aborts the whole script, so the app does not boot at all. Caught here before it shipped
    // (2026-08-13); the step refresh belongs on the two EVENTS, which can only fire after evaluation.
    const bootCall = app.indexOf('\nrefreshInstallButtons();');
    const stepState = app.indexOf('let quickStartInstallPromptRunning');
    expect(bootCall, 'the bootstrap call must exist').toBeGreaterThan(-1);
    expect(stepState, 'the step state must exist').toBeGreaterThan(bootCall);
    // Comments stripped: the note explaining WHY it must not names the very identifiers it must not read.
    const refreshCode = refresh.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
    expect(refreshCode, 'the top-level refresher must not touch quick-start state').not.toMatch(/quickStart/);
    for (const handler of ["window.addEventListener('beforeinstallprompt'", "window.addEventListener('appinstalled'"]) {
      // Terminator at LINE START: an inner call like closeInstallDialog({ dismissed: false }); ends in "});" too,
      // and slicing there cut the handler in half — a gate that reads half a function passes on half the truth.
      const fn = app.slice(app.indexOf(handler), app.indexOf('\n});', app.indexOf(handler)));
      expect(fn.length, `${handler} slice must not collapse`).toBeGreaterThan(80);
      expect(fn, `${handler} must repaint the step`).toContain('refreshQuickStartInstallStep();');
    }
    // And the refresher itself must never re-render a step that is mid-tap: refreshInstallButtons fires while the
    // browser sheet is opening (the deferred event is spent the moment it is used), and rebuilding the body would
    // pull the button out from under the click that is still running.
    const stepRefresh = app.slice(app.indexOf('function refreshQuickStartInstallStep()'), app.indexOf('function buildQuickStartInstallBody()'));
    expect(stepRefresh).toMatch(/if \(quickStartInstallPromptRunning\) return;/);

    // (d) Every string it says ships in every locale.
    for (const key of ['quickstart.installWhy', 'quickstart.installStarted', 'quickstart.installNotNow',
      'quickstart.installUseBrowserMenu']) {
      expect(Object.keys(I18N_STRINGS).every((code) => Boolean(I18N_STRINGS[code][key])), `${key} in every locale`).toBe(true);
    }
    // Declining is a DECISION, not a failure: the step is optional and Platho runs perfectly in a browser tab.
    expect(I18N_STRINGS.en['quickstart.installNotNow']).not.toMatch(/fail|error|could not/i);
    // ...and they must actually be READABLE. [MEASURED 2026-08-13 in the preview] The tap left an EMPTY status
    // line: the message was written inside the try, and the repaint in the finally — which blanks the status on
    // its way — ran straight over it. Repaint first, speak second; a message set before the repaint is dead code.
    expect(body).toMatch(/refreshQuickStartInstallStep\(\);\s*setText\(quickStartStepStatus, message\);/);
    expect(body, 'nothing may write the status before the repaint that clears it')
      .not.toMatch(/setText\(quickStartStepStatus, t\('quickstart\.install/);
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
    expect(keyStep).toMatch(/action: \(\) => t\('common\.next'\),/);
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
    expect(createStep).toMatch(/return runQuickStartCreateWallet\(password, \{ deferSeedGate: true \}\);/);
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
      app.indexOf('function buildQuickStartCreateWalletBody'),
    );
    expect(body.length, 'the slice must not collapse or run away').toBeGreaterThan(400);
    // [OWNER 2026-08-10] TWO labelled plates, each with a line saying what it saves. The inline phrase and the
    // "type SAVED" box that stood here read as a school exercise, and the file button sat under the words with
    // nothing to say it was a different thing entirely.
    expect(body).toMatch(/t\('quickstart\.saveSeedAction'\)/);
    expect(body).toMatch(/t\('quickstart\.saveWalletKeyAction'\)/);
    expect(body).toMatch(/t\('quickstart\.seedPlateNote'\)/);
    expect(body).toMatch(/t\('quickstart\.keyFilePlateNote'\)/);
    expect(body).toMatch(/await exportEncryptedWalletKeyFile\(plathoWallet \?\? null\)/);
    expect(body).toMatch(/await showWalletSeed\(t\('wallet\.recoveryPhrase'\)/);
    expect(body, 'the typed-SAVED box is gone').not.toMatch(/seedBackupConfirm/);
    for (const key of ['quickstart.saveSeedAction', 'quickstart.seedPlateNote', 'quickstart.keyFilePlateNote']) {
      expect(I18N_STRINGS.en[key], `${key} must ship`).toBeTruthy();
      expect(I18N_STRINGS.ru[key], `${key} must ship in ru`).toBeTruthy();
    }
    // [OWNER 2026-08-10] No password re-prompt in the wizard: an unlocked wallet can only exist because the
    // password was entered this session (plathoWallet is memory-only, never cached, and the three functions that
    // set it all demand the password), and here that was seconds ago on the step above.
    expect(body, 'the wizard must not re-ask for a password it just took')
      .not.toMatch(/confirmWalletPasswordForExport/);
    // The Wallet tab keeps its prompt — there the gap can be hours of an unlocked phone.
    expect(app).toMatch(/exportWalletSeedButton\?\.addEventListener[\s\S]{0,200}?confirmWalletPasswordForExport\(wallet\)/);
    // Continue now passes through, so the SAFETY NET is the pending-backup nudge, not the stepper. If this ever
    // stops re-opening the stepper on the backup step, a user can leave onboarding with no key file at all.
    expect(app).toMatch(/markWalletKeyBackupPending\(/);
    expect(app).toMatch(/quickStartBackupMode = true/);
  });

  it('IOS-KEYBOARD-01: the shell floor stays the keyboard-less screen, and no compensation code returns', () => {
    // FOUR DAYS OF DAMAGE FROM ONE LINE, kept here so nobody re-derives it.
    //
    // The keyboard-aware height predates 1.0 and is not in question: `height` follows --app-viewport-height, the
    // maximized composer follows --app-viewport-height-exact, and on Android the whole thing works because
    // `interactive-widget=resizes-content` shrinks the LAYOUT viewport there.
    //
    // 1.0.25 changed ONE property: it let `min-height` follow the variable too. min-height beats height, so that
    // floor was the only thing keeping the shell full-screen tall on iOS — which ignores that hint and shrinks
    // only the VISIBLE area. With the floor gone the shell became short, Safari kept sliding the visible area
    // under it, and two attempts to compensate each shipped something worse:
    //   1.0.28 — undo the scroll (window.scrollTo(0,0)). Owner: "I drag it and it jumps back when I let go."
    //   1.0.29 — drive `top` from visualViewport.offsetTop. offsetTop changes every scroll frame while `top` is
    //            recomputed from an event handler, so the interface shook and the maximized composer came apart.
    //
    // Reverted to the pre-1.0.25 line. This gate exists so the "obvious improvement" is not made a fourth time.
    const shellRule = css.slice(css.indexOf('  .app-shell {'), css.indexOf('overflow: hidden;', css.indexOf('  .app-shell {')));
    expect(shellRule.length, 'the mobile shell rule must not collapse').toBeGreaterThan(300);
    expect(shellRule, 'the floor is the keyboard-less screen').toContain('min-height: 100svh;');
    expect(shellRule, 'and it must NOT follow the variable').not.toMatch(/min-height: var\(/);
    expect(shellRule, 'a fixed element chasing offsetTop flickers once per scroll frame')
      .not.toMatch(/top: var\(--app-viewport-offset-top/);
    // The half that predates 1.0 is untouched — this gate must never be read as "the keyboard is ignored".
    expect(shellRule).toContain('height: var(--app-viewport-height, 100dvh);');
    expect(app).toMatch(/--app-viewport-height-exact/);

    // None of the compensation machinery may come back, in the file OR in the shipped listeners.
    expect(app, 'the scroll-undo hack').not.toMatch(/keepDocumentPinnedToTop|window\.scrollTo\(0, 0\)/);
    expect(app, 'the offsetTop variable it was replaced with').not.toMatch(/--app-viewport-offset-top/);
    const rootStart = css.indexOf('html,\nbody {');
    const rootRule = css.slice(rootStart, css.indexOf('\n}', rootStart));
    expect(rootRule, 'html was given overflow/height only to support the undo hack').not.toContain('overscroll-behavior');
    expect(rootRule).not.toContain('overflow: hidden;');
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
