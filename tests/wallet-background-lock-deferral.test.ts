import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// A DEFERRED BACKGROUND LOCK IS A POSTPONEMENT, NEVER A CANCELLATION.
//
// Owner, 2026-08-19: "Проблема с модалкой «Купить ATH». Она видимо не подчиняется законам блокировки
// приложения. Свернул приложение с открытой модалкой, развернул и увидел модалку. Закрыл её и увидел экран
// блокировки."
//
// Both halves of that sentence came from one missing deadline. shouldIgnoreTransientWalletLock() answers "yes"
// for as long as an action dialog is on screen, and the deferral branch in lockPlathoWallet used to simply
// return — so backgrounding with a modal up left the keys in memory and the app unmasked, indefinitely on a
// platform that suspends timers. And once something else did lock the wallet (the 30-minute idle backstop), the
// stale modal was still there, which is exactly what shouldOpenWalletUnlockPrompt refuses to open over: no
// prompt, no boot-screen mask, a locked app fully on display until the user happened to close the modal.
//
// Reading the file cannot catch a missing deadline, so this file does not read it (except where noted). It
// EXTRACTS the shipped functions, runs them against a controllable clock, and asserts the observable end state:
// is the wallet locked, is the modal gone, is the mask up. Two clocks matter and both are modelled —
// advance() runs timers (desktop / Android keep the page alive) and suspend() freezes them (iOS).
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

/** Cut a `const NAME = ...;` line out of app.js, so the test cannot drift from the shipped number. */
function constant(name: string) {
  const match = app.match(new RegExp(`^const ${name} = .*;$`, 'm'));
  expect(match, `${name} must be a top-level const`).not.toBeNull();
  return match![0];
}

type Harness = {
  goAway: () => void;
  comeBack: () => void;
  /** Time passes with the page ALIVE — timers fire (desktop PWA, Android). */
  advance: (ms: number) => void;
  /** Time passes with the page SUSPENDED — timers are frozen (iOS). */
  suspend: (ms: number) => void;
  openDialog: () => void;
  closeDialogByUser: () => void;
  startSend: () => void;
  finishSend: () => void;
  state: () => {
    unlocked: boolean;
    dialogOpen: boolean;
    overlayRaised: number;
    hardLocks: number;
    graceArmed: boolean;
  };
};

/**
 * Built from the REAL source of the lock/deferral chain. The edges are stubs — a torn-down key store is a
 * boolean, the boot overlay is a counter — but every branch, deadline and predicate exercised below is shipped
 * code, so deleting a line in web/app.js breaks these tests rather than a paraphrase of them.
 */
function harness({ telegram = false }: { telegram?: boolean } = {}): Harness {
  const source = `
    ${constant('WALLET_AUTO_LOCK_MS')}
    ${constant('WALLET_TRANSIENT_LOCK_GRACE_MS')}
    ${constant('TELEGRAM_BACKGROUND_LOCK_GRACE_MS')}
    ${constant('SEND_LOCK_MAX_GRACE_MS')}

    // ── a clock and a timer wheel the test owns ────────────────────────────────────────────────────────────
    let clock = 1000000;
    const Date = { now: () => clock };
    let hiddenNow = false;
    const document = { get hidden() { return hiddenNow; } };
    let timerSeq = 0;
    const timers = new Map();
    function setTimeout(callback, ms) { timers.set(++timerSeq, { at: clock + ms, callback }); return timerSeq; }
    function clearTimeout(id) { timers.delete(id); }
    function runDueTimers(until) {
      for (;;) {
        let nextId = null;
        for (const [id, timer] of timers) {
          if (timer.at <= until && (nextId === null || timer.at < timers.get(nextId).at)) nextId = id;
        }
        if (nextId === null) return;
        const timer = timers.get(nextId);
        timers.delete(nextId);
        clock = timer.at;
        timer.callback();
      }
    }

    // ── the wallet session, reduced to what the lock tears down ────────────────────────────────────────────
    let plathoWallet = { address: 'EQowner' };
    let activeActionDialog = null;
    let lastWalletUnlockAt = clock;
    let walletAutoLockTimer = null;
    let walletUnlockPromise = null;
    let walletUnlockPromptPending = false;
    let walletUnlockPromptInterrupted = false;
    let walletUnlockPromptDeclined = false;
    let walletUnlockPromptTimer = null;
    let backgroundGraceLockTimer = null;
    let backgroundGraceLockDeadline = 0;
    let vaultSendInFlightUntil = 0;
    let sendHoldsKey = false;
    let hardLocks = 0;
    let overlayRaised = 0;

    // Edges. Each is the narrowest thing the extracted code needs, and none of them decides anything.
    let localIdentity, localVaultAuthKeyPair, localRecipientKeyPair, localSignedPublicBundle, localVaultDraft;
    let localProfileAvatarPointer, convKeyStore, introReplayGuard, convRecoveryRestoreAttempted;
    let convRecoveryBackupAllowed, recoveryBackupTimer;
    const encryptionStatus = {}, keyAuthStatus = {}, vaultDraftStatus = {}, vaultRecordStatus = {}, vaultRotateStatus = {};
    const t = (key) => key;
    const setText = () => {};
    const stopIntroReceiveLane = () => {};
    const cancelAllConvDeliveryConfirms = () => {};
    const cancelPublicPublishVisibilityChecks = () => {};
    const resetVaultPocketState = () => {};
    const renderWalletIdentity = () => {};
    const flashWalletIdentityStatus = () => {};
    const refreshMessagingControls = () => {};
    const refreshComposerPublishPolicy = () => {};
    const reloadForPendingServiceWorkerAppShellUpdate = () => false;
    const clearVaultAutoRefreshTimer = () => {};
    // Since the design integration (2026-08-23) the lock also drops the activation re-read ladder and the
    // chain-verified names count of the wallet being torn down — both edges here, neither decides anything.
    const clearPlathoActivationReread = () => {};
    let ownedUsernameNftsVerified = null;
    const clearWalletUnlockPromptTimer = () => { walletUnlockPromptTimer = null; };
    const hasStoredPlathoWalletRecord = () => true;
    const privateOutboundWorkActive = () => sendHoldsKey;
    const isTelegramEnv = () => ${telegram ? 'true' : 'false'};
    const isTelegramSuspendingPlatform = () => false;
    // The mask. Raised synchronously by scheduleWalletUnlockPrompt before the dialog timer, which is the whole
    // point of it — see PWA-BOOT-RELOCK in tests/pwa-runtime-config.
    // Idempotent, exactly like the shipped one (\`if (!bootScreen || bootScreenActive) return;\`) — the mask is
    // raised once per lock, however many callers ask for it.
    let bootScreenActive = false;
    const showBootScreenForRelock = () => { if (plathoWallet || bootScreenActive) return; bootScreenActive = true; overlayRaised += 1; };
    function clearWalletAutoLockTimer() { if (walletAutoLockTimer) { clearTimeout(walletAutoLockTimer); walletAutoLockTimer = null; } }
    // closeActionDialog reduced to its guard and its effect; the compensating resumeWalletUnlockPrompt it also
    // schedules is modelled by the return doors below, which call the real one.
    function closeActionDialog() { if (!activeActionDialog) return; activeActionDialog = null; }
    // The lock now sweeps every overlay the session owned (closeSessionOverlays), not the action dialog alone —
    // the rest are no-ops in this harness, which has no DOM; what it models is that the sweep runs and the dialog
    // it closes really goes.
    function closeSessionOverlays() { closeActionDialog(); }

    ${fn('vaultSendNeedsKeyNow')}
    ${fn('shouldDeferLockForActiveSend')}
    ${fn('shouldIgnoreTransientWalletLock')}
    ${fn('scheduleWalletAutoLock')}
    ${fn('clearBackgroundGraceLock')}
    ${fn('scheduleBackgroundGraceLock')}
    ${fn('armBackgroundGraceLockTimer')}
    ${fn('enforceBackgroundGraceLockOnReturn')}
    ${fn('lockPlathoWallet')}
    ${fn('lockPlathoWalletForBackground')}
    ${fn('markWalletUnlocked')}
    ${fn('armWalletUnlockPrompt')}
    ${fn('shouldOpenWalletUnlockPrompt')}
    ${fn('resumeWalletUnlockPrompt')}
    ${fn('noteWalletUnlockInterruptedByBackground')}

    // The real scheduleWalletUnlockPrompt tail is an async timer body; its GATE is the shipped predicate above
    // and its first act is the mask. Modelled exactly as in tests/wallet-unlock-resume-state, for the same
    // reason: the dialog itself is an edge, the decision to raise the mask is not.
    function scheduleWalletUnlockPrompt() {
      clearWalletUnlockPromptTimer();
      if (!shouldOpenWalletUnlockPrompt()) return;
      showBootScreenForRelock();
      walletUnlockPromptPending = false;
    }

    // Count the locks that actually cleared the keys, not the calls.
    const realLock = lockPlathoWallet;
    lockPlathoWallet = function countedLock(status, options) {
      const before = plathoWallet;
      realLock(status, options);
      if (before && !plathoWallet) hardLocks += 1;
    };

    return {
      // The two exit doors both land here (visibilitychange -> hidden, pagehide).
      goAway: () => { hiddenNow = true; noteWalletUnlockInterruptedByBackground(); lockPlathoWalletForBackground(); },
      // ...and all three return doors run these two calls, in this order.
      comeBack: () => { hiddenNow = false; enforceBackgroundGraceLockOnReturn(); resumeWalletUnlockPrompt(); },
      advance: (ms) => { const until = clock + ms; runDueTimers(until); clock = until; },
      suspend: (ms) => { clock += ms; },
      openDialog: () => { activeActionDialog = { title: 'Buy ATH' }; },
      closeDialogByUser: () => { closeActionDialog(); },
      startSend: () => { sendHoldsKey = true; },
      finishSend: () => { sendHoldsKey = false; },
      state: () => ({
        unlocked: Boolean(plathoWallet),
        dialogOpen: Boolean(activeActionDialog),
        overlayRaised,
        hardLocks,
        graceArmed: backgroundGraceLockDeadline !== 0,
      }),
    };
  `;
  // `lockPlathoWallet` is reassigned above to count real locks, so the extracted declaration cannot be const.
  // eslint-disable-next-line no-new-func
  return new Function(source.replace('function lockPlathoWallet(', 'var lockPlathoWallet = function lockPlathoWallet('))() as Harness;
}

describe('background wallet lock deferral', () => {
  it('BGLOCK-01: THE REPORT — background with a modal up, return later: locked, modal gone, mask up', () => {
    const h = harness();
    h.openDialog();
    h.advance(WALLET_BLIP + 1_000);   // past the "just unlocked" exemption, so the modal is the only one left
    h.goAway();
    expect(h.state().graceArmed, 'the deferral must leave a deadline behind').toBe(true);

    h.suspend(10 * 60_000);           // iOS: away for ten minutes with every timer frozen
    h.comeBack();

    const after = h.state();
    expect(after.unlocked, 'the keys must not survive a real departure').toBe(false);
    expect(after.dialogOpen, 'the modal belonged to the session that just ended').toBe(false);
    expect(after.overlayRaised, 'and the app must come back MASKED, not sitting there unlocked-looking').toBe(1);
  });

  it('BGLOCK-02: COUNTER-CASE — a blip is still a blip', () => {
    // The exemption exists for a real thing: a password-manager sheet or a permission prompt over an open
    // dialog fires the same hidden/visible pair as a departure. Locking on that would make dialogs unusable.
    const h = harness();
    h.openDialog();
    h.advance(WALLET_BLIP + 1_000);
    h.goAway();
    h.advance(WALLET_BLIP - 1_000);   // handed straight back
    h.comeBack();

    expect(h.state().unlocked, 'a sub-grace absence must not lock').toBe(true);
    expect(h.state().dialogOpen, 'and must not take the dialog with it').toBe(true);
    expect(h.state().graceArmed, 'the spent deferral is dropped, not left to fire later').toBe(false);
  });

  it('BGLOCK-03: a page that keeps running locks WHILE away — it does not wait to be looked at', () => {
    const h = harness();
    h.openDialog();
    h.advance(WALLET_BLIP + 1_000);
    h.goAway();
    h.advance(WALLET_BLIP + 1);       // desktop / Android: the timer is alive and the deadline passes

    expect(h.state().unlocked, 'the grace timer must fire against a still-hidden page').toBe(false);
    expect(h.state().dialogOpen).toBe(false);
    h.comeBack();
    expect(h.state().overlayRaised, 'the return still masks').toBe(1);
  });

  it('BGLOCK-04: the deadline is stamped ONCE — repeat hidden events cannot push it out', () => {
    // visibilitychange and pagehide both fire on a single departure on some platforms, and Telegram emits the
    // pair repeatedly. Re-stamping on each would defer forever, which is the bug in a second costume.
    const h = harness();
    h.openDialog();
    h.advance(WALLET_BLIP + 1_000);
    h.goAway();
    for (let i = 0; i < 5; i += 1) { h.advance(WALLET_BLIP / 4); h.goAway(); }

    expect(h.state().unlocked, 'five repeats must not out-run one deadline').toBe(false);
  });

  it('BGLOCK-05: an active send still outranks the grace, and its OWN bound still ends it', () => {
    const h = harness();
    h.openDialog();
    h.startSend();
    h.goAway();
    h.advance(WALLET_BLIP * 3);
    expect(h.state().unlocked, 'a send holding the key defers past the blip grace').toBe(true);

    h.advance(SEND_GRACE);
    expect(h.state().unlocked, 'but not past SEND_LOCK_MAX_GRACE_MS').toBe(false);
  });

  it('BGLOCK-05B: COUNTER-CASE — coming back to a live send does not kill it', () => {
    // The half of BGLOCK-05 that lives on the return door, and the regression the door introduces if it locks on
    // a passed deadline unconditionally: PWA-SEND-LOCK-01 exists so a send survives a background blip and
    // FINISHES on the foreground. Locking the moment the user looks at it would strand every slow send.
    const h = harness();
    h.startSend();
    h.goAway();
    h.suspend(WALLET_BLIP * 4);   // away long enough for the deadline to pass, timers frozen
    h.comeBack();

    expect(h.state().unlocked, 'the user is present and the send still holds the key').toBe(true);
    expect(h.state().graceArmed, 'the deferral is spent; the 30-minute idle backstop governs now').toBe(false);
  });

  it('BGLOCK-06: Telegram keeps its long grace, and it is now enforced across a suspend too', () => {
    const tg = harness({ telegram: true });
    tg.advance(WALLET_BLIP + 1_000);
    tg.goAway();
    tg.advance(TELEGRAM_GRACE - 1_000);
    tg.comeBack();
    expect(tg.state().unlocked, 'Telegram backgrounds on the smallest interaction; that is not a departure').toBe(true);

    const away = harness({ telegram: true });
    away.advance(WALLET_BLIP + 1_000);
    away.goAway();
    away.suspend(TELEGRAM_GRACE + 1_000);   // frozen timer — only the return door can settle this
    away.comeBack();
    expect(away.state().unlocked, 'past the grace it locks, timer or no timer').toBe(false);
    expect(away.state().overlayRaised).toBe(1);
  });

  it('BGLOCK-07: an ordinary foreground session is untouched — no deferral, nothing to enforce', () => {
    // enforceBackgroundGraceLockOnReturn runs on every focus event, so a stray lock here would log the user out
    // of an app they never left.
    const h = harness();
    h.openDialog();
    h.advance(60 * 60_000);
    h.comeBack();
    h.comeBack();
    expect(h.state().hardLocks, 'a focus event with no deferral behind it locks nothing').toBe(0);
    expect(h.state().dialogOpen).toBe(true);
  });

  it('BGLOCK-08: every deferral arms the grace, and the seed gate cannot re-open over the lock', () => {
    // [changing a shared primitive: enumerate every caller] shouldIgnoreTransientWalletLock has THREE readers
    // and each had to be checked separately:
    //   lockPlathoWallet                — defers the lock, so it must leave a deadline (asserted below);
    //   lockPlathoWalletForBackground   — reads the NEGATION, and both sides arm one: false takes the Telegram
    //                                     grace, true falls through to the transient lock and its blip grace;
    //   shouldDeferServiceWorkerReload  — must NOT gain a deadline. It defers a page RELOAD, for which an open
    //                                     dialog is a standing reason to wait, so it is held UNCHANGED here.
    const deferBranch = app.slice(
      app.indexOf('if (options.transient === true && shouldIgnoreTransientWalletLock())'),
      app.indexOf('clearWalletAutoLockTimer();', app.indexOf('function lockPlathoWallet(')),
    );
    expect(deferBranch.length, 'the slice must not collapse or run away').toBeGreaterThan(100);
    expect(deferBranch, 'a deferral must leave a deadline behind').toContain('scheduleBackgroundGraceLock(WALLET_TRANSIENT_LOCK_GRACE_MS);');
    expect((app.match(/shouldIgnoreTransientWalletLock\(\)/g) ?? []).length, 'definition + the three readers above').toBe(4);
    expect(app).toMatch(/function lockPlathoWalletForBackground\(\)[\s\S]{0,900}?scheduleBackgroundGraceLock\(TELEGRAM_BACKGROUND_LOCK_GRACE_MS\);/);
    expect(app).toMatch(/function shouldDeferServiceWorkerReload\(\)[\s\S]{0,200}?shouldIgnoreTransientWalletLock\(\)/);
    expect(app, 'and the dialog clause is what the reloader is reading through it')
      .toMatch(/function shouldIgnoreTransientWalletLock\(\) \{\s*return Boolean\(activeActionDialog\)/);
    // All three return doors settle the deadline, and none of them is left holding the old clear-only call.
    for (const door of ["document.addEventListener('visibilitychange', () => {", "window.addEventListener('pageshow'", "window.addEventListener('focus'"]) {
      const start = app.indexOf(door);
      expect(start, `${door} must exist`).toBeGreaterThan(-1);
      const body = app.slice(start, app.indexOf('\n});', start));
      expect(body, `${door} must settle the deferred lock`).toContain('enforceBackgroundGraceLockOnReturn();');
    }
    expect(app, 'the Telegram-only timer is gone; there is one deferral primitive now').not.toMatch(/telegramBackgroundLockTimer|scheduleTelegramBackgroundLock|clearTelegramBackgroundLockTimer/);
    // The lock closes EVERY overlay the ended session owned. Asserted on the source because the counter-case that
    // matters — the loop that would put one straight back — lives in an async function this harness cannot run.
    //
    // It was one call, closeActionDialog, until the owner found the gap it left [2026-08-24]: the action dialog
    // closes the image lightbox in turn, but a lightbox opened straight from a message has no action dialog above
    // it, so a decrypted photo stayed on screen over a locked app. The sweep is now a named list
    // (closeSessionOverlays), which is what stops the next window being forgotten — see PWA-LIGHTBOX-LOCK-01.
    const lockBody = app.slice(app.indexOf('function lockPlathoWallet('), app.indexOf('const TELEGRAM_BACKGROUND_LOCK_GRACE_MS'));
    expect(lockBody, 'the overlays go with the session that owned them').toContain('closeSessionOverlays();');
    expect(app).toMatch(/function closeSessionOverlays\(\) \{[\s\S]{0,400}?closeActionDialog\(null\);[\s\S]{0,400}?closeImageLightbox\(\);/);
    const seedGate = app.slice(app.indexOf('async function enforceTelegramSeedBackupGate('), app.indexOf('function showTelegramManualExportDialog('));
    expect(seedGate, 'the one dialog loop that re-opens on null must stop when the wallet is gone')
      .toMatch(/for \(let attempt[\s\S]{0,600}?if \(plathoWallet\?\.address !== wallet\.address\) return;[\s\S]{0,80}?await openActionDialog\(/);
  });
});

/** The shipped numbers, read from app.js so the cases above cannot drift from the app. */
function shippedNumber(name: string) {
  const line = constant(name);
  // eslint-disable-next-line no-new-func
  return new Function(`${line}; return ${name};`)() as number;
}
const WALLET_BLIP = shippedNumber('WALLET_TRANSIENT_LOCK_GRACE_MS');
const TELEGRAM_GRACE = shippedNumber('TELEGRAM_BACKGROUND_LOCK_GRACE_MS');
const SEND_GRACE = shippedNumber('SEND_LOCK_MAX_GRACE_MS');
