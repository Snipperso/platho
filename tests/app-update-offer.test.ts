import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { I18N_LOCALES, I18N_STRINGS } from '../web/i18n-strings.mjs';
import { code, sourceBlock } from './helpers/source';


const app = readFileSync('web/app.js', 'utf8');

function world({ modal = false, dialog = null as any, sending = false, seen = true, wallet = { address: 'EQme' } as any, source = app } = {}) {
  const timers: Array<() => void> = [];
  const cleared: number[] = [];
  const dialogs: any[] = [];
  const answers: Array<(value: any) => void> = [];
  let reloads = 0;
  const state = { sending, typing: false };
  const notices: string[] = [];
  const submit = { disabled: false };
  const env: Record<string, any> = {
    modalOnScreen: () => modal, shouldDeferLockForActiveSend: () => false, sendWorkInHand: () => state.sending, pageOnScreen: () => seen, t: (key: string) => key,
    showAppNotice: (text: string) => { notices.push(text); }, composerHoldsContent: () => state.typing, pageHoldsTyping: () => false,
    setTimeout: (run: () => void) => { timers.push(run); return timers.length; }, clearTimeout: (id: number) => { cleared.push(id); },
    openActionDialog: (config: any) => { dialogs.push(config); submit.disabled = false; return new Promise((resolve) => { answers.push(resolve); }); },
    reloadForAppUpdatePress: () => { reloads += 1; },
    actionSubmitButton: submit,
  };
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  const api = new Function(...names, `let pendingServiceWorkerAppShellReload = false; let appUpdateOffered = false; let appUpdateOfferTimer = null;
    let activeActionDialog = __dialog; let plathoWallet = __wallet;
    ${sourceBlock(source, 'function offerAppUpdate(')}
    ${sourceBlock(source, 'function awaitSendThenReload() {')}
    return { offer: offerAppUpdate, pending(on) { pendingServiceWorkerAppShellReload = on; }, closeDialog() { activeActionDialog = null; } };`
    .replace('__dialog', JSON.stringify(dialog)).replace('__wallet', JSON.stringify(wallet)))(...names.map((n) => env[n]));
  return { api, timers, dialogs, answers, reloads: () => reloads, state, notices, cleared, submit };
}

describe('a new build is offered where the person is [2026-10-27]', () => {
  it('UPDATE-OFFER-01: once, in a window that says what the reload costs; "Update now" reloads; nothing without a new build', async () => {
    const w = world();
    w.api.offer();
    expect(w.dialogs, 'no new build, no window').toEqual([]);
    w.api.pending(true);
    w.api.offer();
    expect(w.dialogs.map((d) => [d.title, d.hint, d.submitLabel, d.cancelLabel, d.unprompted])).toEqual([
      ['app.updateTitle', 'app.updateHintUnlocked', 'app.updateNow', 'app.updateLater', true]]);
    w.api.offer();
    expect(w.dialogs, 'offered once a build — the header\'s mark is the way back to it').toHaveLength(1);
    w.answers[0]({});
    await new Promise((resolve) => setImmediate(resolve));
    expect(w.reloads()).toBe(1);
    const locked = world({ wallet: null });
    locked.api.pending(true);
    locked.api.offer();
    expect(locked.dialogs[0].hint, 'no wallet open: no password to warn of').toBe('app.updateHint');
  });

  it('UPDATE-OFFER-02: never over another window, a send or a page nobody sees — waited out; "Later" reloads nothing; the mark offers again', async () => {
    const busy = world({ dialog: { title: 'Send GRAM' } });
    busy.api.pending(true);
    busy.api.offer();
    expect([busy.dialogs.length, busy.timers.length], 'waits for the window in front').toEqual([0, 1]);
    busy.api.closeDialog();
    busy.timers.shift()!();
    expect(busy.dialogs).toHaveLength(1);
    for (const blocked of [world({ sending: true }), world({ seen: false }), world({ modal: true })]) {
      blocked.api.pending(true);
      blocked.api.offer();
      expect([blocked.dialogs.length, blocked.timers.length]).toEqual([0, 1]);
    }
    const later = world();
    later.api.pending(true);
    later.api.offer();
    later.answers[0](null);
    await new Promise((resolve) => setImmediate(resolve));
    expect(later.reloads(), 'nothing reloads unasked while a wallet is open').toBe(0);
    later.api.offer({ asked: true });
    expect(later.dialogs.map((d) => d.unprompted), 'asked for: offered again, and the press is the person\'s').toEqual([true, false]);
  });

  it('UPDATE-OFFER-03: the header\'s mark on every tab says a build waits, and pressed offers it; every door that learns of a build offers it', () => {
    const indicator = code(sourceBlock(app, 'function refreshGlobalSyncIndicator('));
    expect(indicator).toContain('const update = pendingServiceWorkerAppShellReload === true;');
    expect(indicator).toContain("el.setAttribute('aria-label', t('app.updateTap'));");
    expect(code(app)).toContain("indicator.addEventListener('click', () => (pendingServiceWorkerAppShellReload ? offerAppUpdate({ asked: true }) : syncNowForCurrentScreen()));");
    expect(readFileSync('web/styles.css', 'utf8')).toMatch(/\.global-sync-indicator\[data-syncing="false"\]\[data-delayed="false"\]\[data-update="true"\]::before \{[\s\S]{0,200}?background: var\(--cta-ink\);/);
    expect(code(sourceBlock(app, 'function noteHistoryStoreSuperseded('))).toContain('offerAppUpdate();');
    expect(code(sourceBlock(app, 'function requireNoPendingServiceWorkerAppShellReload('))).toContain('offerAppUpdate({ asked: true });');
    expect((code(app).match(/offerAppUpdate\(/g) ?? []).length, 'declaration and its own wait + the deferred reload, the store, the send, the return, the mark, a money door').toBe(8);
    const door = app.slice(app.indexOf("\ndocument.addEventListener('visibilitychange', () => {"));
    const hidden = code(door.slice(0, door.indexOf('} else {')));
    expect(hidden).toContain('if (lockedAppMayTakeBuild()) reloadForPendingServiceWorkerAppShellUpdate();');
    for (const { code: locale } of I18N_LOCALES as any[]) {
      for (const key of ['app.updateTitle', 'app.updateHint', 'app.updateHintUnlocked', 'app.updateNow', 'app.updateLater', 'app.updateTap', 'app.updateWaiting']) {
        expect(I18N_STRINGS[locale][key], `${locale} ${key}`).toBeTruthy();
      }
    }
  });

  it('UPDATE-OFFER-04: unasked, a send is waited out; asked, the window opens over it; "Update now" over a send waits ON SCREEN and reloads once it is done [round 76 — C1-1; 2026-11-08]', async () => {
    const w = world({ sending: true });
    w.api.pending(true);
    w.api.offer();
    expect([w.dialogs.length, w.timers.length], 'MEASURED before: offered 15 ms after a GRAM transfer was signed').toEqual([0, 1]);
    w.api.offer({ asked: true });
    expect(w.dialogs.map((d) => d.title), '2026-11-08, MEASURED before: a 6-s line and no window').toEqual(['app.updateTitle']);
    expect(w.notices).toEqual([]);
    w.answers[0]({});
    await new Promise((resolve) => setImmediate(resolve));
    expect(w.reloads(), 'MEASURED before [round 76]: "Update now" reloaded 100 ms later, the transfer\'s watch gone').toBe(0);
    expect([w.dialogs.length, w.dialogs[1].hint, w.dialogs[1].cancelLabel, w.submit.disabled]).toEqual([2, 'app.updateWaiting', 'app.updateLater', true]);
    w.timers.pop()!();
    expect(w.reloads()).toBe(0);
    w.state.sending = false;
    w.timers.pop()!();
    expect([w.dialogs.length, w.reloads()], 'the send done: reloaded, no third window').toEqual([2, 1]);
    const later = world({ sending: true });
    later.api.pending(true);
    later.api.offer({ asked: true });
    later.answers[0]({});
    await new Promise((resolve) => setImmediate(resolve));
    later.answers[1](null);
    await new Promise((resolve) => setImmediate(resolve));
    later.state.sending = false;
    later.timers.pop()!();
    expect(later.reloads(), 'nothing reloads after "Later"').toBe(0);
  });

  it('UPDATE-OFFER-05: one door opening at a time — presses while it reads are not taken; its window lets go; a money door meets a waiting build first [2026-10-27; round 76 — C1-3]', async () => {
    const opened: string[] = [];
    const offered: any[] = [];
    const gates: Array<() => void> = [];
    const env: Record<string, any> = { offerAppUpdate: (options: any) => { offered.push(options); }, console };
    const names = Object.keys(env);
    // eslint-disable-next-line no-new-func
    const api = new Function(...names, `let doorPressHeld = null; let pendingServiceWorkerAppShellReload = false;
      ${sourceBlock(app, 'function doorPress(open, { money = false } = {}) {')}
      ${sourceBlock(app, 'function offeredWaitingBuild() {')}
      return { doorPress, windowOpens() { doorPressHeld = null; }, pending(on) { pendingServiceWorkerAppShellReload = on; }, held: () => doorPressHeld };`)(...names.map((n) => env[n]));
    const stake = api.doorPress(() => new Promise<void>((resolve) => { opened.push('stake'); gates.push(resolve); }), { money: true });
    stake(); stake(); stake();
    await new Promise((resolve) => setImmediate(resolve));
    expect(opened, 'MEASURED before: three presses, three windows one after another').toEqual(['stake']);
    api.windowOpens();
    stake();
    await new Promise((resolve) => setImmediate(resolve));
    expect(opened, 'its window open: a press is the person\'s again').toEqual(['stake', 'stake']);
    gates.forEach((go) => go());
    await new Promise((resolve) => setImmediate(resolve));
    expect(api.held()).toBeNull();
    api.pending(true);
    stake();
    expect([opened.length, offered], 'a waiting build: offered before anything is typed').toEqual([2, [{ asked: true }]]);
    for (const door of ['feeDiscountButton', 'recoverAthButton', 'vaultFloatButton', 'vaultRestoreButton', 'unstakeAthButton', 'buyAthButton', 'walletSendAction', 'walletSwapAction', 'registerVaultKeysButton']) {
      expect(code(app), door).toMatch(new RegExp(`${door}\\?\\.addEventListener\\('click', doorPress\\(`));
    }
    expect(code(sourceBlock(app, 'async function openActionDialog(config = {}) {')), 'its window lets the press go').toContain('doorPressHeld = null;');
  });

  it('UPDATE-OFFER-06: unasked, it does not cut a sentence; a locked app takes a build at once where nothing would be lost [round 76 — C2-3, C2-4, C2-5]', () => {
    const typing = world();
    typing.state.typing = true;
    typing.api.pending(true);
    typing.api.offer();
    expect([typing.dialogs.length, typing.timers.length], 'MEASURED before: it took the focus from a composer mid-sentence').toEqual([0, 1]);
    typing.api.offer({ asked: true });
    expect(typing.dialogs, 'asked for (the mark pressed): offered').toHaveLength(1);
    const may = ({ wallet = false, typed = false, draft = false, sending = false, flow = false } = {}) => new Function('pageHoldsTyping', 'composerHoldsContent', 'sendWorkInHand', 'walletFlowOnce',
      `let plathoWallet = ${wallet ? '{}' : 'null'};\n${sourceBlock(app, 'function lockedAppMayTakeBuild() {')}\nreturn lockedAppMayTakeBuild();`)(() => typed, () => draft, () => sending, { running: flow });
    expect(may(), 'locked, nothing typed: taken as it goes away').toBe(true);
    expect([may({ wallet: true }), may({ typed: true }), may({ draft: true }), may({ sending: true }), may({ flow: true })],
      'an open wallet, words typed in a window (MEASURED before: 84 characters of Import lost), a draft, an unlock or a send under way, a wallet flow at any step [round 77 — C2-1: Import\'s 24 words, at the window after them]')
      .toEqual([false, false, false, false, false]);
    expect(code(sourceBlock(app, 'async function handleServiceWorkerControllerChange() {'))).toContain('if (shouldDeferServiceWorkerReload()) {');
    expect(code(sourceBlock(app, 'async function handleServiceWorkerControllerChange() {'))).not.toContain('lockedAppMayTakeBuild');
  });

  it('UPDATE-OFFER-07: asked for, it opens over a card\'s window; a send refused for the build is told as the refusal, not as a send waited for [round 77 — C1-1, C1-2]', () => {
    const card = world({ modal: true });
    card.api.pending(true);
    card.api.offer();
    expect(card.dialogs, 'unasked: never over a window').toHaveLength(0);
    card.api.offer({ asked: true });
    expect(card.dialogs, 'MEASURED before: three presses of Buy ATH in the ATH card, nothing for 30 s').toHaveLength(1);
    const refused = world({ sending: true, dialog: { title: 'Send GRAM' } });
    refused.api.pending(true);
    refused.api.offer({ asked: true });
    expect([refused.notices, refused.dialogs.length], 'MEASURED before: "A send is under way" over the window\'s own "Update ready"').toEqual([[], 0]);
    refused.api.closeDialog();
    refused.state.sending = false;
    refused.timers.pop()!();
    expect(refused.dialogs, 'offered once its window is closed').toHaveLength(1);
    expect(app).toMatch(/profileCardMintNameButton\?\.addEventListener\('click', async \(\) => \{[^\n]*\n\s+if \(offeredWaitingBuild\(\)\) return;/);
    expect(app).toMatch(/if \(offeredWaitingBuild\(\)\) return;[^\n]*\n\s+openUsernameNftTransferDialog\(nft\)/);
    expect(app).toMatch(/if \(offeredWaitingBuild\(\)\) return;[^\n]*\n\s+openTelegramGiftTransferDialog\(gift\)/);
  });

  it('UPDATE-OFFER-08: the way back to the page leaves a pressed update\'s wait in place; the name window\'s "Buy ATH" is the Buy ATH door [round 78 — C1-1, C1-3]', async () => {
    const w = world();
    w.api.pending(true);
    w.api.offer();
    expect(w.dialogs).toHaveLength(1);
    w.state.sending = true;
    w.answers[0]({});
    await new Promise((resolve) => setImmediate(resolve));
    w.api.offer();
    expect([w.dialogs.length, w.cleared], 'MEASURED before [round 78]: the wait cleared, never offered again').toEqual([2, []]);
    w.state.sending = false;
    w.timers.pop()!();
    expect([w.dialogs.length, w.reloads()], 'the press kept: reloaded once the send is done').toEqual([2, 1]);
    expect(app).toContain("hintAction = error?.code === 'PLATHO_ATH_REQUIRED' && buyAthButton ? { label: t('profile.buyAth'), run: doorPress(openBuyAthDialog, { money: true }) } : null;");
  });
});

describe('"Update now" always does what it says [2026-11-08]', () => {
  it('UPDATE-OFFER-09: the press reloads although the flag dropped while the window stood — a probe that did not answer is not the person\'s "no"', async () => {
    const w = world();
    w.api.pending(true);
    w.api.offer();
    w.api.pending(false);
    w.answers[0]({});
    await new Promise((resolve) => setImmediate(resolve));
    expect(w.reloads(), 'MEASURED before: the window closed and nothing happened').toBe(1);
    const gated = app.replace('if (shouldDeferLockForActiveSend() || sendWorkInHand()) { awaitSendThenReload(); return; }',
      'if (!pendingServiceWorkerAppShellReload) return;\n    if (shouldDeferLockForActiveSend() || sendWorkInHand()) { awaitSendThenReload(); return; }');
    expect(gated).not.toBe(app);
    const before = world({ source: gated });
    before.api.pending(true);
    before.api.offer();
    before.api.pending(false);
    before.answers[0]({});
    await new Promise((resolve) => setImmediate(resolve));
    expect(before.reloads(), 'the gated press does nothing — the defect').toBe(0);
  });

  it('UPDATE-OFFER-10: the press over a send waits on screen — MUTATION: the old way, offered again behind a line, is the defect', async () => {
    const old = app.replace('if (shouldDeferLockForActiveSend() || sendWorkInHand()) { awaitSendThenReload(); return; }',
      'if (shouldDeferLockForActiveSend() || sendWorkInHand()) { offerAppUpdate({ asked: true }); return; }');
    expect(old).not.toBe(app);
    const before = world({ sending: true, source: old });
    before.api.pending(true);
    before.api.offer({ asked: true });
    before.answers[0]({});
    await new Promise((resolve) => setImmediate(resolve));
    expect(before.dialogs[1]?.hint, 'without the wait: a second plain window, nothing said of the send').not.toBe('app.updateWaiting');
  });
});

describe('a new build is looked for as one moves about the app [2026-11-08]', () => {
  it('UPDATE-OFFER-11: a tab switch asks for the worker, at most every two minutes, never at boot before the check\'s state exists', () => {
    const view = code(sourceBlock(app, 'function setView(view, { restoreRoom = true } = {}) {'));
    expect(view).toContain('if (installPromptUiReady && plathoWallet) checkForServiceWorkerUpdate(SERVICE_WORKER_UPDATE_ON_VIEW_MS);');
    expect(app).toContain('const SERVICE_WORKER_UPDATE_ON_VIEW_MS = 120_000;');
    expect(app.indexOf('let installPromptUiReady = false;')).toBeLessThan(app.indexOf('function setView('));
    expect(app.indexOf('const SERVICE_WORKER_UPDATE_ON_VIEW_MS')).toBeLessThan(app.lastIndexOf('installPromptUiReady = true;'));
    const check = code(sourceBlock(app, 'function checkForServiceWorkerUpdate(minIntervalMs = 60_000) {'));
    expect(check).toContain('if (now - serviceWorkerUpdateAskedAt < minIntervalMs) return;');
  });
});

describe('an asked offer stays asked [round 144 — C12-3]', () => {
  it('UPDATE-OFFER-12: an unasked call while an asked offer waits leaves its wait as it is — the window opens as asked, over a card, taking the first press', () => {
    const w = world({ dialog: { title: 'Send GRAM' } });
    w.api.pending(true);
    w.api.offer({ asked: true });
    expect(w.timers).toHaveLength(1);
    w.api.offer();
    expect([w.timers.length, w.cleared], 'MEASURED before: the asked wait cleared and set again as unasked').toEqual([1, []]);
    w.api.closeDialog();
    w.timers.pop()!();
    expect(w.dialogs.map((d) => d.unprompted), 'opened as asked: no first-moments guard against the press that asked').toEqual([false]);
  });
});

