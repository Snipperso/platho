import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';


const app = readFileSync('web/app.js', 'utf8');

function fn(name: string) {
  const start = app.indexOf(`function ${name}(`);
  expect(start, `${name} must exist`).toBeGreaterThan(-1);
  const end = app.indexOf('\n}', start);
  expect(end, `${name} must terminate`).toBeGreaterThan(start);
  return app.slice(start, end + 2);
}

function constant(name: string) {
  const match = app.match(new RegExp(`^const ${name} = .*;$`, 'm'));
  expect(match, `${name} must be a top-level const`).not.toBeNull();
  return match![0];
}

type Harness = {
  goAway: () => void;
  comeBack: () => void;
  lockNow: () => void;
  advance: (ms: number) => void;
  suspend: (ms: number) => void;
  openDialog: () => void;
  startSend: () => void;
  state: () => any;
};

function harness({ telegram = false }: { telegram?: boolean } = {}): Harness {
  const source = `
    ${constant('WALLET_TRANSIENT_LOCK_GRACE_MS')}
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
    // the idle lock's wall-clock deadline and the stretch the password began [security review 2026-10-02 — keys-5, keys-6]
    let walletIdleDeadline = 0;
    // [round 17 — A4] the idle lock counts on the monotonic clock too
    let walletIdleDeadlineMono = 0;
    const walletIdleMonoNow = () => (typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : 0);
    let lastWalletInputAt = 0;
    let walletLeftForegroundSinceUnlock = false;
    let walletLeftUnattendedSinceUnlock = false;
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
    let recoveryQuietTimer = null;   // the quiet backup's own timer, stopped by the lock [round 12 — privsec-1]
    const forgetSessionDiagnostics = () => {};   // the console's diagnostics go with the lock [round 12 — privsec-8]
    // the wallet's at-rest keys, the history store and the contact names go with it too [round 12 — privsec-2]
    let walletAtRestKeys = null;
    const releaseHistoryStoreForLock = () => {};
    const forgetDeviceCaches = () => {};   // the sealed caches close with the lock [round 13 — atrest-4]
    const dropSealedPersonalPublicState = () => {};   // and the follows kept under the wallet's seal leave the screen [round 15 — F5-1]
    const forgetConversationMapForLock = () => {};   // and what names the conversations [round 15 — F5-3, F5-4]
    const forgetWalletSessionMarks = () => {};   // and the session's own marks: the freeze asks, the quiet minute [round 18 — F5-I1]
    let feeVaultState = { wallet: null, address: null, snapshot: null };   // its deploy's signed bytes go too [round 16 — A1]
    const convShardPlanner = { clear() {} };   // and the conversation roots in its cache [security review 2026-10-02 — keys-1]
    const convQuietAt = new Map();   // and which conversations were quiet [round 15 — F6-5]
    const convQuietProbedClean = new Map();   // and what their probes found [round 16 — B3]
    let historyRestoreBehind = null;   // and the restore of its history behind the screen [round 16 — B6]
    // and the reply or share being drafted, and the maps keyed by the same wallets [round 16 — D2]
    const setPrivateReplyDraft = () => {};
    const setPrivateShareDraft = () => {};
    const publicChannelAvatarUrlByWallet = new Map();
    const publicAvatarFreshThisSession = new Set();
    const telegramGiftListCache = new Map();
    const verifiedPlathoUsernameOwnerCache = new Map();
    const publicSilentChannelAt = new Map();   // and the silent channels' clock [round 16 — B4]
    // and its rooms' clocks and lane addresses, and its channels' closed-era clock [round 16 — B9]
    const privateRoomBook = { clear() {} };
    const publicRoomBook = { clear() {} };
    const publicClosedErasReadAt = new Map();
    let convShardPlansSaveTimer = null;   // with the save of the day's plans still waiting [round 14 — F5-7]
    let contactLabelState = { owner: null, map: new Map(), store: null, persist: Promise.resolve(true) };
    const encryptionStatus = {}, keyAuthStatus = {}, vaultDraftStatus = {}, vaultRecordStatus = {}, vaultRotateStatus = {};
    const t = (key) => key;
    const setText = () => {};
    const stopIntroReceiveLane = () => {};
    const cancelAllConvDeliveryConfirms = () => {};
    const cancelPrivateSendTimers = () => {};   // the send retries stop with the lock since round 7 (gated in audit-round7-lifecycle)
    const cancelPublicPublishVisibilityChecks = () => {};
    let groupEchoConfirmTimer = null;   // the rooms' echo ladder, cleared by the lock since round 4
    // the session generation and the drafts, both moved by the lock since round 5
    let walletSessionGeneration = 0;
    const privateComposerDraftsByThread = new Map([['peer:a', { text: 'half a sentence' }]]);
    let composerDraftThreadId = 'peer:a';
    const messageInput = { value: 'half a sentence' };
    let privateImageAttachments = [{ name: 'photo' }];
    let privateFileAttachments = [{ name: 'file' }];
    const resetVaultPocketState = () => {};
    const releaseVaultDeployLock = () => {};   // [round 21 — B13] the hold a vault deploy kept on the other windows: none here
    const renderWalletIdentity = () => {};
    // The lock now drops the decrypted private dialogs as well as the keys (PWA-WALLET-LOCK-CONTENT-01), so the
    // harness owns a list for it to empty: one private dialog, which must go, and one public channel row, which
    // must survive — the public surface is meant to work while locked.
    let threads = [{ id: 'peer:a', name: 'private' }, { id: 'chan:1', publicChannelId: 'c1', name: 'channel' }];
    let activeThreadId = threads[0].id;
    const appShell = { dataset: {} };
    const renderThreads = () => {};
    const renderConversation = () => {};
    const showNoConversation = () => {};   // the lock's empty pane on whatever tab [audit 57 — C2-1]
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
    // The mask. Raised synchronously by scheduleWalletUnlockPrompt before the dialog timer, which is the whole
    // point of it — see PWA-BOOT-RELOCK in tests/pwa-runtime-config.
    // Idempotent, exactly like the shipped one (\`if (!bootScreen || bootScreenActive) return;\`) — the mask is
    // raised once per lock, however many callers ask for it.
    let bootScreenActive = false;
    // the session latches the teardown resets [round 7]
    let walletLocalStoresReady = false; let convKeyStorePersistent = false; let selfNotesRestoreIncomplete = true; let prefsRestoreSettled = false; let restoredConversationFollowQueue = new Map(); let recoveryFreezeSweepDone = false;
    const showBootScreenForRelock = () => { if (plathoWallet || bootScreenActive) return; bootScreenActive = true; overlayRaised += 1; };
    // closeActionDialog reduced to its guard and its effect; the compensating resumeWalletUnlockPrompt it also
    // schedules is modelled by the return doors below, which call the real one.
    function closeActionDialog() { if (!activeActionDialog) return; activeActionDialog = null; }
    // The lock now sweeps every overlay the session owned (closeSessionOverlays), not the action dialog alone —
    // the rest are no-ops in this harness, which has no DOM; what it models is that the sweep runs and the dialog
    // it closes really goes.
    function closeSessionOverlays() { closeActionDialog(); }
    // The lock drops the group runtime — the closure that holds the wallet seed and every group key [audit
    // 2026-09-05, round 1]; a no-op here, and asserted present in the real body below.
    function dropGroupRuntime() {}
    function dropPublicGroupRuntime() {}

    ${fn('vaultSendNeedsKeyNow')}
    ${fn('shouldDeferLockForActiveSend')}
    ${fn('shouldIgnoreTransientWalletLock')}
    ${fn('lockPlathoWallet')}
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
      // The two exit doors both land here (visibilitychange -> hidden, pagehide): they note it, and lock nothing.
      goAway: () => { hiddenNow = true; noteWalletUnlockInterruptedByBackground(); },
      // ...and all three return doors run this.
      comeBack: () => { hiddenNow = false; resumeWalletUnlockPrompt(); },
      lockNow: () => { lockPlathoWallet(t('wallet.locked')); },
      advance: (ms) => { const until = clock + ms; runDueTimers(until); clock = until; },
      suspend: (ms) => { clock += ms; },
      openDialog: () => { activeActionDialog = { title: 'Buy ATH' }; },
      startSend: () => { sendHoldsKey = true; },
      state: () => ({
        timersArmed: timers.size,
        unlocked: Boolean(plathoWallet),
        privateThreads: threads.filter((thread) => !thread.publicChannelId).length,
        publicThreads: threads.filter((thread) => Boolean(thread.publicChannelId)).length,
        activeThreadId,
        dialogOpen: Boolean(activeActionDialog),
        overlayRaised,
        hardLocks,
        sessionGeneration: walletSessionGeneration,
        drafts: privateComposerDraftsByThread.size,
        composerText: messageInput.value,
        attachments: privateImageAttachments.length + privateFileAttachments.length,
      }),
    };
  `;
  // eslint-disable-next-line no-new-func
  return new Function(source.replace('function lockPlathoWallet(', 'var lockPlathoWallet = function lockPlathoWallet('))() as Harness;
}

describe('no lock of its own; the person locks it', () => {
  it('BGLOCK-01: away for hours — with a dialog up, a send under way, the page frozen or alive — the wallet stays open and nothing is armed', () => {
    for (const pass of ['alive', 'frozen'] as const) {
      const h = harness();
      h.openDialog();
      h.startSend();
      h.goAway();
      if (pass === 'alive') h.advance(6 * 3_600_000); else h.suspend(6 * 3_600_000);
      h.comeBack();
      const after = h.state();
      expect([after.unlocked, after.dialogOpen, after.hardLocks, after.overlayRaised, after.timersArmed], pass).toEqual([true, true, 0, 0, 0]);
    }
    const telegram = harness({ telegram: true });
    telegram.goAway();
    telegram.suspend(60 * 60_000);
    telegram.comeBack();
    expect(telegram.state().unlocked, 'Telegram\'s WebView backgrounds no differently').toBe(true);
  });

  it('BGLOCK-02: the Lock pressed locks at once — the keys go, the dialog with them, and the app comes back masked', () => {
    const h = harness();
    h.openDialog();
    h.lockNow();
    const after = h.state();
    expect([after.unlocked, after.dialogOpen, after.hardLocks, after.overlayRaised]).toEqual([false, false, 1, 1]);
  });

  it('BGLOCK-09: the lock takes the decrypted conversations with it, and leaves the public ones', () => {
    const h = harness();
    expect(h.state().privateThreads, 'the fixture starts with a private dialog loaded').toBe(1);
    h.lockNow();
    expect(h.state().unlocked, 'precondition: it really locked').toBe(false);
    expect(h.state().privateThreads, 'the decrypted dialogs go with the keys').toBe(0);
    expect(h.state().activeThreadId, 'and no conversation stays open behind the mask').toBe(null);
    expect(h.state().publicThreads, 'public channels are not secrets').toBe(1);
  });

  it('BGLOCK-11: the lock takes the drafts, the typed text and the attachments with it, and moves the session generation [round 5]', () => {
    const h = harness();
    expect(h.state().drafts).toBe(1);
    expect(h.state().sessionGeneration).toBe(0);
    h.lockNow();
    expect(h.state().unlocked, 'precondition: it really locked').toBe(false);
    expect(h.state().drafts, 'the drafts go with the keys').toBe(0);
    expect(h.state().composerText, 'and the typed text').toBe('');
    expect(h.state().attachments, 'and the attachments').toBe(0);
    expect(h.state().sessionGeneration, 'the session moved on: nothing begun before it lands').toBe(1);
  });

  it('BGLOCK-08: the lock is the menu\'s, the doors lock nothing, and what the lock takes is still all of it', () => {
    const press = app.slice(app.indexOf("document.querySelector('#lockWalletNowButton')?.addEventListener('click'"), app.indexOf('\n});', app.indexOf("document.querySelector('#lockWalletNowButton')?.addEventListener('click'")));
    expect(press).toContain("lockPlathoWallet(t('wallet.locked'));");
    expect(readFileSync('web/index.html', 'utf8')).toContain('<button id="lockWalletNowButton" type="button"><span data-i18n="wallet.lockNow">Lock wallet</span></button>');
    for (const door of ["\ndocument.addEventListener('visibilitychange', () => {", "\nwindow.addEventListener('pagehide'", "\nwindow.addEventListener('pageshow'", "\nwindow.addEventListener('focus'"]) {
      const start = app.indexOf(door);
      expect(start, `${door} must exist`).toBeGreaterThan(-1);
      const body = app.slice(start, app.indexOf('\n});', start));
      expect(body, door).not.toMatch(/lockPlathoWallet|EnforceWallet|enforceWalletIdleLock|GraceLock/);
    }
    expect((app.match(/shouldIgnoreTransientWalletLock\(\)/g) ?? []).length, 'definition + shouldDeferServiceWorkerReload').toBe(2);
    expect(app).toMatch(/function shouldDeferServiceWorkerReload\(\)[\s\S]{0,200}?shouldIgnoreTransientWalletLock\(\)/);
    const lockBody = app.slice(app.indexOf('function lockPlathoWallet('), app.indexOf('const WALLET_UNATTENDED_MS'));
    expect(lockBody.length, 'the slice really spans the lock').toBeGreaterThan(1200);
    expect(lockBody, 'the overlays go with the session that owned them').toContain('closeSessionOverlays();');
    expect(lockBody, 'the lock drops the group runtime').toContain('dropGroupRuntime();');
    expect(lockBody, 'and defers to nothing').not.toMatch(/options\.transient|shouldIgnoreTransientWalletLock/);
    expect(app).toMatch(/function closeSessionOverlays\(\) \{[\s\S]{0,400}?closeActionDialog\(null\);[\s\S]{0,400}?closeImageLightbox\(\);/);
    const seedGate = app.slice(app.indexOf('async function enforceTelegramSeedBackupGate('), app.indexOf('function showManualExportDialog('));
    expect(seedGate, 'the one dialog loop that re-opens on null must stop when the wallet is gone')
      .toMatch(/for \(let attempt[\s\S]{0,600}?if \(plathoWallet\?\.address !== wallet\.address\) return;[\s\S]{0,80}?await openActionDialog\(/);
  });
});

function shippedNumber(name: string) {
  const line = constant(name);
  // eslint-disable-next-line no-new-func
  return new Function(`${line}; return ${name};`)() as number;
}
const WALLET_BLIP = shippedNumber('WALLET_TRANSIENT_LOCK_GRACE_MS');
const SEND_GRACE = shippedNumber('SEND_LOCK_MAX_GRACE_MS');
