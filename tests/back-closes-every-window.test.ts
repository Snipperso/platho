import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';


const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const NL = String.fromCharCode(10);

class Node {
  tag: string; id: string; classes: Set<string>; hidden: boolean; disabled = false; children: Node[] = []; parent: Node | null = null;
  dataset: Record<string, string> = {}; clicks = 0; onclick: (() => void) | null = null;
  constructor(tag: string, { id = '', cls = '', hidden = false } = {}) { this.tag = tag; this.id = id; this.classes = new Set(cls.split(' ').filter(Boolean)); this.hidden = hidden; }
  append(...kids: Node[]) { for (const kid of kids) { kid.parent = this; this.children.push(kid); } return this; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((one) => one !== this); this.parent = null; }
  get isConnected(): boolean { let at: Node | null = this; while (at?.parent) at = at.parent; return at?.tag === 'body'; }
  matches(selector: string) {
    if (selector.startsWith('.')) return this.classes.has(selector.slice(1));
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    return this.tag === selector;
  }
  descendants(): Node[] { return this.children.flatMap((kid) => [kid, ...kid.descendants()]); }
  querySelectorAll(selector: string) { return this.descendants().filter((one) => one.matches(selector)); }
  querySelector(selector: string) { return this.querySelectorAll(selector)[0] ?? null; }
  closest(selector: string) { for (let at: Node | null = this; at; at = at.parent) if (at.matches(selector)) return at; return null; }
  getClientRects() { for (let at: Node | null = this; at; at = at.parent) if (at.hidden) return []; return this.isConnected ? [{}] : []; }
  click() { this.clicks += 1; this.onclick?.(); }
}
function windowNode(id: string, { cross = true, cancel = false } = {}) {
  const backdrop = new Node('div', { id, cls: 'modal-backdrop' });
  const header = new Node('header');
  backdrop.append(header);
  if (cross) {
    const close = new Node('button', { id: `${id}Close` }).append(new Node('span', { cls: 'icon icon-close' }));
    close.onclick = () => { backdrop.hidden = true; };
    header.append(close);
  }
  if (cancel) {
    const button = new Node('button', { id: `${id}Cancel` });
    button.dataset.backCloses = 'true';
    button.onclick = () => { backdrop.remove(); };
    backdrop.append(button);
  }
  return backdrop;
}

function world({ telegram = false } = {}) {
  const body = new Node('body');
  const shell = new Node('div', { id: 'appShell' });
  body.append(shell);
  const modalHolds: Node[] = [];
  const back = { shown: false };
  const pushed: string[] = [];
  const env: Record<string, any> = {
    document: { body, querySelectorAll: (selector: string) => (selector === 'body > .modal-backdrop' ? body.children.filter((one) => one.matches('.modal-backdrop')) : body.querySelectorAll(selector)) },
    modalHolds,
    profileCardShownNow: () => Boolean(shell.querySelector('#profileCardDialog')?.getClientRects().length),
    closeProfileCardDialog: () => { shell.querySelector('#profileCardDialog')!.hidden = true; pushed.push('card closed'); },
    appShell: { dataset: {} }, publicPane: { dataset: {} }, composerIsMaximized: () => false, exitComposerMaximize: () => false,
    isTelegramEnv: () => telegram, telegramWebApp: () => ({ BackButton: { show: () => { back.shown = true; }, hide: () => { back.shown = false; } } }),
    history: { pushState: () => pushed.push('push'), back: () => pushed.push('back') },
    closePublicRoom: () => {}, closePublicPostDetail: () => {}, closePublicChannelView: () => {}, renderThreads: () => {}, hideIdentityPopover: () => {}, activeThreadId: null,
    closeQuickStart: { keepOnboarding: false },
  };
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  const api = new Function(...names, ['let navHistorySentinel = false;', 'let navHistorySilentPops = 0;', fn('function modalInFront() {'), fn('function backCloseButton() {'),
    fn('function navOverlayIsOpen() {'), fn('function syncNavBackAffordance() {'), fn('function closeNavOverlay() {'),
    'return { backCloseButton, navOverlayIsOpen, syncNavBackAffordance, closeNavOverlay, silent: () => navHistorySilentPops, sentinel: () => navHistorySentinel };'].join(NL))(...names.map((n) => env[n]));
  return { api, body, shell, modalHolds, back, pushed, quickStart: env.closeQuickStart };
}

describe('Back and the windows', () => {
  it('BACKWIN-01: Back presses the front window\'s ✕; a window inside it first; Cancel where there is no ✕; nothing open, nothing', () => {
    const w = world();
    expect([w.api.backCloseButton(), w.api.navOverlayIsOpen()]).toEqual([null, false]);
    const swap = windowNode('actionDialog');
    w.shell.append(swap);
    w.modalHolds.push(swap);
    const picker = windowNode('swapPicker');
    swap.append(picker);
    expect(w.api.backCloseButton()?.id, 'the token list inside the swap window, first').toBe('swapPickerClose');
    expect(w.api.closeNavOverlay()).toBe(true);
    expect([picker.hidden, swap.hidden]).toEqual([true, false]);
    expect(w.api.closeNavOverlay()).toBe(true);
    expect(swap.hidden).toBe(true);
    expect(w.api.closeNavOverlay(), 'nothing open: Back is not spent').toBe(false);
    const link = windowNode('externalLink', { cross: false, cancel: true });
    w.body.append(link);
    expect(w.api.backCloseButton()?.id).toBe('externalLinkCancel');
    w.api.closeNavOverlay();
    expect(link.isConnected).toBe(false);
  });

  it('BACKWIN-02: a ✕ shut while a press is checked spends the Back and closes nothing; a window over the profile card closes before it', () => {
    const w = world();
    const swap = windowNode('actionDialog');
    w.shell.append(swap);
    w.modalHolds.push(swap);
    swap.querySelector('button')!.disabled = true;
    expect(w.api.navOverlayIsOpen(), 'still a window: Back must not leave the app').toBe(true);
    expect(w.api.closeNavOverlay()).toBe(true);
    expect([swap.hidden, swap.querySelector('button')!.clicks]).toEqual([false, 0]);
    swap.hidden = true;
    const card = windowNode('profileCardDialog');
    const qr = windowNode('qrDialog');
    w.shell.append(card, qr);
    w.modalHolds.push(card, qr);
    w.api.closeNavOverlay();
    expect([qr.hidden, card.hidden], 'the QR window over the card first').toEqual([true, false]);
    w.api.closeNavOverlay();
    expect(card.hidden).toBe(true);
    expect(w.pushed, 'the card by its own way out').toContain('card closed');
  });

  it('BACKWIN-03: Telegram\'s BackButton shows while a window is open; outside Telegram a history entry stands for it, taken back when its ✕ closes it', () => {
    const tg = world({ telegram: true });
    const appearance = windowNode('appearanceDialog');
    tg.shell.append(appearance);
    tg.api.syncNavBackAffordance();
    expect(tg.back.shown).toBe(true);
    appearance.hidden = true;
    tg.api.syncNavBackAffordance();
    expect(tg.back.shown).toBe(false);
    const web = world();
    const docs = windowNode('docsDialog');
    web.shell.append(docs);
    web.api.syncNavBackAffordance();
    expect([web.pushed, web.api.sentinel()]).toEqual([['push'], true]);
    docs.querySelector('button')!.click();
    web.api.syncNavBackAffordance();
    expect([web.pushed, web.api.sentinel(), web.api.silent()], 'its entry taken back, the pop to be let pass').toEqual([['push', 'back'], false, 1]);
    const install = code(fn('function installNavBackHandling() {'));
    expect(install).toContain("for (const modal of document.querySelectorAll('.modal-backdrop')) observer.observe(modal, { attributes: true, attributeFilter: ['hidden'] });");
    expect(install).toContain('observer.observe(document.body, { childList: true });');
    expect(install).toContain('if (navHistorySilentPops > 0) { navHistorySilentPops -= 1; navHistorySentinel = false; syncNavBackAffordance(); return; }');
    expect(app.split("cancelBtn.dataset.backCloses = 'true';").length - 1).toBe(2);
  });

  it('BACKWIN-04: a window\'s own Back is pressed while it shows (a quick-start step goes back a step); Back closing the quick start keeps it', () => {
    const w = world();
    const quick = windowNode('quickStartDialog');
    const step = new Node('button', { id: 'quickStartBackButton' });
    step.dataset.navBack = 'true';
    quick.append(step);
    w.shell.append(quick);
    w.modalHolds.push(quick);
    expect(w.api.backCloseButton()?.id, 'a step after the first: its Back').toBe('quickStartBackButton');
    w.api.closeNavOverlay();
    expect([step.clicks, quick.hidden, w.quickStart.keepOnboarding], 'a step back, the window stays').toEqual([1, false, false]);
    step.hidden = true;
    expect(w.api.backCloseButton()?.id).toBe('quickStartDialogClose');
    w.api.closeNavOverlay();
    expect([quick.hidden, w.quickStart.keepOnboarding], 'closed by Back, not dismissed for good: it comes back').toEqual([true, true]);
    expect(readFileSync('web/index.html', 'utf8')).toMatch(/id="quickStartBackButton"[^>]*data-nav-back="true"/);
  });
});
