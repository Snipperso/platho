import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE UNLOCK PROMPT, RUN RATHER THAN READ.
//
// Owner, 2026-08-13, with a screenshot of the locked Public tab: "the app is being dumb and does not show the
// unlock modal after I bring it back."
//
// A gate for exactly this already existed — PWA-UNLOCK-RESUME-01, written against the same complaint in August —
// and it was GREEN over the defect for its whole life, because it matched the SHAPE of the source: it asserted
// that the non-interrupted path calls scheduleWalletUnlockPrompt(), which is true, and is precisely the bug. That
// function cannot raise walletUnlockPromptPending; only armWalletUnlockPrompt can, and the resume path reached it
// solely through lockPlathoWallet, which returns on its first line when the wallet is already locked — which it
// always is on resume. So once an unlock attempt ended without a wallet (one ✕ on the cold-start password dialog
// is enough), the tab sat in an ABSORBING state: locked, pending=false, and every later resume silently cleared a
// timer and returned.
//
// Reading the file cannot catch that, so this file does not read it. It EXTRACTS the real functions and runs the
// state machine against stubbed edges, asserting the observable state and the number of prompts opened. Every case
// below was checked to fail when the corresponding line is removed from web/app.js.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const app = readFileSync('web/app.js', 'utf8');

/** Cut a function out of app.js by name, from its `function NAME(` to the next top-level `\n}`. */
function fn(name: string) {
  const start = app.indexOf(`function ${name}(`);
  expect(start, `${name} must exist`).toBeGreaterThan(-1);
  const end = app.indexOf('\n}', start);
  expect(end, `${name} must terminate`).toBeGreaterThan(start);
  return app.slice(start, end + 2);
}

type Harness = {
  resume: () => void;
  goAway: (opts?: { unlockOnScreen?: boolean }) => void;
  dismissTap: () => void;
  dismissOtherDialog: () => void;
  unlocked: () => void;
  arm: () => void;
  state: () => { pending: boolean; interrupted: boolean; declined: boolean };
  opened: () => number;
  set: (patch: Record<string, unknown>) => void;
};

/**
 * Build the machine from the REAL source of six functions. The edges are stubs — a prompt "opens" by incrementing a
 * counter — but every branch, flag and predicate below is the shipped code, so deleting a line in app.js breaks
 * these tests rather than a paraphrase of it.
 */
function harness(initial: Record<string, unknown> = {}): Harness {
  const source = `
    let plathoWallet = null;
    let walletUnlockPromise = null;
    let activeActionDialog = null;
    let storedRecord = true;
    let hiddenNow = false;
    let lastWalletUnlockAt = 0;
    let walletUnlockPromptPending = false;
    let walletUnlockPromptInterrupted = false;
    let walletUnlockPromptDeclined = false;
    let walletUnlockPromptTimer = null;
    let opened = 0;

    const document = { get hidden() { return hiddenNow; } };
    const hasStoredPlathoWalletRecord = () => storedRecord;
    const clearWalletUnlockPromptTimer = () => { walletUnlockPromptTimer = null; };
    const clearTelegramBackgroundLockTimer = () => {};
    const showBootScreenForRelock = () => { walletUnlockPromptTimer = 'armed'; };

    ${fn('shouldOpenWalletUnlockPrompt')}
    ${fn('armWalletUnlockPrompt')}
    ${fn('markWalletUnlocked')}
    ${fn('noteWalletUnlockInterruptedByBackground')}
    ${fn('noteActionDialogUserDismissed')}
    ${fn('resumeWalletUnlockPrompt')}

    // The real scheduleWalletUnlockPrompt tail is an async timer body. Its GATE is the shipped predicate above,
    // and the one other thing that must be modelled is the CONSUMPTION at web/app.js:4374 — the pending flag is
    // cleared there, before the password dialog is awaited. Leaving that out let one arming re-open the dialog on
    // every later call, which failed UNLOCKRES-03 and would have been a harness artefact reported as a defect.
    // (Backticks are deliberately absent from this comment: it lives inside a template literal.)
    function scheduleWalletUnlockPrompt(delayMs = 180) {
      clearWalletUnlockPromptTimer();
      if (!shouldOpenWalletUnlockPrompt()) return;
      showBootScreenForRelock();
      opened += 1;
      walletUnlockPromptPending = false;
    }

    return {
      resume: () => resumeWalletUnlockPrompt(),
      goAway: (opts = {}) => {
        if (opts.unlockOnScreen === true) walletUnlockPromise = 'in flight';
        noteWalletUnlockInterruptedByBackground();
        walletUnlockPromise = null;
        hiddenNow = true;
      },
      // The ✕ on the PASSWORD dialog: an unlock is in flight when the tap happens, which is what identifies it.
      dismissTap: () => { walletUnlockPromise = 'in flight'; noteActionDialogUserDismissed(); walletUnlockPromise = null; },
      // The same tap on some OTHER dialog, and the two no-user cases: superseded, or a swallowed decrypt error.
      // All three end with loadPlathoWallet resolving null, and none of them is a decision.
      dismissOtherDialog: () => noteActionDialogUserDismissed(),
      unlocked: () => { plathoWallet = { address: 'EQ' }; markWalletUnlocked(); },
      arm: () => armWalletUnlockPrompt(),
      state: () => ({
        pending: walletUnlockPromptPending,
        interrupted: walletUnlockPromptInterrupted,
        declined: walletUnlockPromptDeclined,
      }),
      opened: () => opened,
      set: (patch) => {
        if ('plathoWallet' in patch) plathoWallet = patch.plathoWallet;
        if ('walletUnlockPromise' in patch) walletUnlockPromise = patch.walletUnlockPromise;
        if ('activeActionDialog' in patch) activeActionDialog = patch.activeActionDialog;
        if ('storedRecord' in patch) storedRecord = patch.storedRecord;
        if ('hidden' in patch) hiddenNow = patch.hidden;
      },
    };
  `;
  // eslint-disable-next-line no-new-func
  const built = new Function(source)() as Harness;
  if (Object.keys(initial).length > 0) built.set(initial);
  return built;
}

describe('wallet unlock prompt on resume', () => {
  it('UNLOCKRES-01: locked, a wallet on file, nobody asked — resuming ASKS', () => {
    const h = harness();
    expect(h.state().pending).toBe(false);
    h.resume();
    // The resume path raised the intent by itself — nothing else could, since lockPlathoWallet bails on an
    // already-locked wallet — and the open consumed it, exactly as app.js:4374 does.
    expect(h.opened(), 'the intent must be raised by the resume path itself').toBe(1);
    expect(h.state().pending).toBe(false);
  });

  it('UNLOCKRES-02: THE REPORT — decline, background, return: the dialog comes back', () => {
    // This is the exact sequence from the screenshot, and the one that is silent on the pre-fix tree.
    const h = harness();
    h.resume();               // asked once
    h.dismissTap();              // user closed it — "just reading the feed"
    expect(h.state().declined).toBe(true);
    const afterDecline = h.opened();

    h.goAway();               // app backgrounded
    h.set({ hidden: false }); // ...and brought back
    h.resume();

    expect(h.state().declined, 'leaving the foreground ends the "not now" session').toBe(false);
    expect(h.opened(), 'the return must ask again').toBe(afterDecline + 1);
  });

  it('UNLOCKRES-03: COUNTER-CASE — a decline is not re-asked without leaving the app', () => {
    // The behaviour the old code was protecting, and the only case that deserved it. Without this, closing the
    // dialog would re-open it on the next focus event, which is worse than the bug being fixed.
    const h = harness();
    h.resume();
    const afterFirst = h.opened();
    h.dismissTap();
    h.resume();
    h.resume();
    h.resume();
    expect(h.opened(), 'a deliberate dismissal stands until the app is left').toBe(afterFirst);
    expect(h.state().pending).toBe(false);
  });

  it('UNLOCKRES-03B: a dialog lost WITHOUT the user is not a decline — the next resume still asks', () => {
    // [OWNER 2026-08-13] "I never pressed the ✕." He did not have to: openActionDialog closes whatever is open
    // (web/app.js — `if (activeActionDialog) closeActionDialog(null)`), so any other dialog opening over the
    // password prompt resolves it to null with nobody deciding anything; and readStoredPlathoWallet's catch
    // swallows every exception into the same null. Reading "declined" off that null — which is what the first
    // version of this fix did — turns both into a decision the user never made, and the app goes quiet exactly
    // as he reported.
    const superseded = harness();
    superseded.resume();
    const asked = superseded.opened();
    superseded.dismissOtherDialog();   // an unrelated dialog dismissed; no unlock in flight
    expect(superseded.state().declined, 'only the password dialog may park the prompt').toBe(false);
    superseded.resume();
    expect(superseded.opened(), 'nothing was decided, so the prompt comes back').toBe(asked + 1);
  });

  it('UNLOCKRES-04: an INTERRUPTED unlock is re-armed, and only when one was really in flight', () => {
    const interrupted = harness();
    interrupted.set({ walletUnlockPromise: null });
    interrupted.goAway({ unlockOnScreen: true });
    expect(interrupted.state().interrupted).toBe(true);
    interrupted.set({ hidden: false });
    interrupted.resume();
    expect(interrupted.state().interrupted, 'consumed once').toBe(false);
    expect(interrupted.opened()).toBe(1);

    // No dialog on screen when the app went away ⇒ not an interruption. It still asks, but by the ordinary path.
    const plain = harness();
    plain.goAway();
    expect(plain.state().interrupted).toBe(false);
  });

  it('UNLOCKRES-05: the predicate still refuses everything it refused before', () => {
    // Each of these is a reason NOT to open, and arming must respect all of them — otherwise the fix trades
    // silence for a dialog appearing over an unlocked app, or over another dialog.
    const cases: Array<[string, Record<string, unknown>]> = [
      ['an unlocked wallet', { plathoWallet: { address: 'EQ' } }],
      ['no wallet on this device', { storedRecord: false }],
      ['a password dialog already resolving', { walletUnlockPromise: 'in flight' }],
      ['another modal on screen', { activeActionDialog: {} }],
      ['still in the background', { hidden: true }],
    ];
    for (const [why, patch] of cases) {
      const h = harness(patch);
      h.resume();
      expect(h.opened(), `must not open with ${why}`).toBe(0);
    }
    // ...but being hidden must PARK the intent rather than drop it: the pending flag survives so the next visible
    // resume can use it. Losing it here is the original bug in miniature.
    const hidden = harness({ hidden: true });
    hidden.resume();
    expect(hidden.state().pending, 'hidden parks the intent, it does not discard it').toBe(true);
    hidden.set({ hidden: false });
    hidden.resume();
    expect(hidden.opened()).toBe(1);
  });

  it('UNLOCKRES-06: a successful unlock clears all three flags', () => {
    const h = harness();
    h.goAway({ unlockOnScreen: true });
    h.set({ hidden: false });
    h.resume();
    h.dismissTap();
    h.unlocked();
    expect(h.state()).toEqual({ pending: false, interrupted: false, declined: false });
  });

  it('UNLOCKRES-07: the SET of places that record a decline is complete, and all three doors resume', () => {
    // [changing a shared primitive: enumerate every caller] A decline is recorded at the TAP, so the set to assert
    // is the set of user-dismissal handlers. One of them forgetting to call this means a ✕ that does not stick;
    // an inference added downstream means the opposite — dialogs lost without the user counted as decisions.
    expect(
      (app.match(/noteActionDialogUserDismissed\(\)/g) ?? []).length,
      'definition + the ✕, the labelled dismiss, the backdrop tap and Escape',
    ).toBe(5);
    for (const handler of ['actionCancelButton?.addEventListener', 'actionDismissButton?.addEventListener']) {
      const start = app.indexOf(handler);
      expect(start, `${handler} must exist`).toBeGreaterThan(-1);
      const body = app.slice(start, app.indexOf('\n});', start));
      expect(body, `${handler} must record the dismissal`).toContain('noteActionDialogUserDismissed();');
    }
    expect(app, 'the backdrop tap too').toContain('closeOnBackdropClick(actionDialog, () => { noteActionDialogUserDismissed(); closeActionDialog(null); });');
    // COUNTER-CASE: the null further down must NOT be read as a decision — it covers a superseded dialog and a
    // swallowed decryption error just as well as a real one.
    const resumeNull = app.slice(app.indexOf('const wallet = await loadPlathoWallet();'), app.indexOf('await bootCrypto();'));
    expect(resumeNull, 'no decline may be inferred from an absent wallet').not.toMatch(/Declined\(\);/);
    expect(app).toMatch(/setBootDebug\('unlock:cancel'\); markBootAppReady\(\);/);
    // ...and the compensator in closeActionDialog must be able to ARM. A bare scheduleWalletUnlockPrompt there
    // could never fire: the pending flag is spent, and walletUnlockPromise is still live at that point.
    const close = app.slice(app.indexOf('function closeActionDialog('), app.indexOf('async function openActionDialog('));
    expect(close).toMatch(/setTimeout\(\(\) => \{[\s\S]{0,200}?if \(activeActionDialog\) return;[\s\S]{0,200}?resumeWalletUnlockPrompt\(\);[\s\S]{0,20}?\}, 0\);/);
    expect(close, 'the version that never ran must be gone').not.toMatch(/^\s*scheduleWalletUnlockPrompt\(\);$/m);

    // THREE return doors, not two. focus was a line-for-line copy of pageshow minus this one call, so a return
    // that fires focus alone — routine on Android — came back silent even on an otherwise correct tree.
    for (const door of ["document.addEventListener('visibilitychange'", "window.addEventListener('pageshow'", "window.addEventListener('focus'"]) {
      const start = app.indexOf(door);
      expect(start, `${door} must exist`).toBeGreaterThan(-1);
      const body = app.slice(start, app.indexOf('\n});', start));
      expect(body, `${door} must resume the unlock prompt`).toContain('resumeWalletUnlockPrompt();');
    }
    // ...and both exit doors must record the departure, or the declined flag would never be released.
    for (const door of ["document.addEventListener('visibilitychange'", "window.addEventListener('pagehide'"]) {
      const start = app.indexOf(door);
      const body = app.slice(start, app.indexOf('\n});', start));
      expect(body, `${door} must note the departure`).toContain('noteWalletUnlockInterruptedByBackground();');
    }
  });
});
