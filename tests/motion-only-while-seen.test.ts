import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';


const app = readFileSync('web/app.js', 'utf8');
const appCode = code(app);
const fn = (start: string) => sourceBlock(app, start);
const lift = (env: Record<string, any>, sources: string[], exported: string) => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [...sources, `return ${exported};`].join(String.fromCharCode(10)))(...names.map((n) => env[n]));
};
const player = () => ({ anim: { playing: false, play() { this.playing = true; }, pause() { this.playing = false; } } });

describe('what moves is what is seen', () => {
  it('SEEN-01: the page is seen when the browser shows it and Telegram has not sent the Mini App down to the bar', () => {
    const page = (visibilityState: string, tg: any) =>
      lift({ document: { visibilityState }, telegramWebApp: () => tg }, [fn('function pageOnScreen() {')], 'pageOnScreen')();
    expect(page('visible', null), 'a browser').toBe(true);
    expect(page('hidden', null), 'a hidden tab').toBe(false);
    expect(page('visible', { isActive: true }), 'an open Mini App').toBe(true);
    expect(page('visible', { isActive: false }), 'minimised: the page itself may still say visible').toBe(false);
    expect(page('hidden', { isActive: true })).toBe(false);
    expect(page('visible', {}), 'a client before Bot API 8.0 says nothing, and is seen').toBe(true);
  });

  it('SEEN-02: a modal covers the page when one is unhidden AND laid out — one left open on a tab not shown covers nothing', () => {
    const modal = (laidOut: boolean) => ({ getClientRects: () => (laidOut ? [{}] : []) });
    const covers = (unhidden: any[]) => lift({
      document: { querySelectorAll: (selector: string) => (selector === '.modal-backdrop:not([hidden])' ? unhidden : [modal(true)]) },
    }, [fn('function modalOnScreen() {')], 'modalOnScreen')();
    expect(covers([])).toBe(false);
    expect(covers([modal(true)])).toBe(true);
    expect(covers([modal(false)]), 'unhidden on a tab not shown').toBe(false);
    expect(covers([modal(false), modal(true)])).toBe(true);
  });

  it('SEEN-03: the modal in front — one made on the spot in the body, else the newest hold still on screen', () => {
    const front = (spots: any[], holds: any[]) => lift({
      document: { querySelectorAll: (selector: string) => (selector === 'body > .modal-backdrop' ? spots : []) }, modalHolds: holds,
    }, [fn('function modalInFront() {')], 'modalInFront')();
    const held = (name: string, { hidden = false, isConnected = true } = {}) => ({ name, hidden, isConnected });
    const card = held('profile card');
    const action = held('action dialog');
    expect(front([], [])).toBe(null);
    expect(front([], [card])).toBe(card);
    expect(front([], [card, action]), 'the newest hold').toBe(action);
    expect(front([], [action, card]), 'a card opened from a dialog stands in front of it').toBe(card);
    expect(front([], [card, held('closed', { hidden: true })]), 'a hold hidden without giving it back').toBe(card);
    expect(front([], [card, held('gone', { isConnected: false })])).toBe(card);
    const link = { name: 'outside link' };
    const later = { name: 'link composer' };
    expect(front([link], [card]), "an outside link's confirmation over the card holds nothing, and is in front").toBe(link);
    expect(front([link, later], [card])).toBe(later);
  });

  it('SEEN-04: the profile\'s balance card leans and plays only when seen; its balances are written whenever it is drawn', () => {
    const dialog = { name: 'profile card' };
    const seen = (env: Record<string, any> = {}) => lift({ profileBalanceCardOnScreen: () => true, profileBalanceCardInView: true,
      modalInFront: () => dialog, profileCardDialog: dialog, ...env }, [fn('function profileBalanceCardSeen() {')], 'profileBalanceCardSeen')();
    expect(seen()).toBe(true);
    expect(seen({ profileBalanceCardOnScreen: () => false }), 'not drawn').toBe(false);
    expect(seen({ profileBalanceCardInView: false }), 'scrolled out of the card\'s view').toBe(false);
    expect(seen({ modalInFront: () => ({ name: 'action dialog' }) }), 'a dialog in front of the card').toBe(false);
    expect(code(fn('function syncProfileBalanceCardLife() {'))).toContain('const on = profileBalanceCardSeen();');
    expect(appCode).toContain('profileBalanceCardTilt = installCardTilt(card, profileBalanceCardSeen);');
    expect(code(fn('function renderProfileBalanceCard() {'))).toContain('profileBalanceCardGiftMotion, profileBalanceCardSeen);');
    expect(appCode).toContain('setCardGiftMotionPlaying(profileBalanceCardGiftMotion, profileBalanceCardSeen()); });');
    expect((appCode.match(/&& profileBalanceCardOnScreen\(\)\) writeProfileBalanceCardBalances\(raw, (?:true|false)\);/g) ?? []).length).toBe(2);
    expect(appCode).not.toMatch(/installCardTilt\(card, profileBalanceCardOnScreen\)|profileBalanceCardGiftMotion, profileBalanceCardOnScreen\b/);
  });

  it('SEEN-05: the corner plays while no modal covers the page, the hero while its card is in front; neither on a page not seen', () => {
    const marks = (over: (dialog: object) => Record<string, any> = () => ({})) => {
      const brand = player();
      const hero = player();
      const dialog = {};
      lift({ globalThis: { __plathoGiftRuntimeReady: true }, giftMotionAllowed: () => true, pageOnScreen: () => true, modalOnScreen: () => false,
        modalInFront: () => null, profileCardDialog: dialog, brandGiftMotion: brand, heroGiftMotion: hero, walletGroupDialog: {}, walletNftHeroMotion: null,
        ...over(dialog) },
      [fn('function syncGiftMarkMotion() {')], 'syncGiftMarkMotion')();
      return { brand: brand.anim.playing, hero: hero.anim.playing };
    };
    const nft = (over: (dialog: object) => Record<string, any>) => {
      const gift = player();
      const window = {};
      lift({ globalThis: { __plathoGiftRuntimeReady: true }, giftMotionAllowed: () => true, pageOnScreen: () => true, modalOnScreen: () => true,
        modalInFront: () => window, profileCardDialog: {}, brandGiftMotion: null, heroGiftMotion: null, walletGroupDialog: window,
        walletNftHeroMotion: Object.assign(gift, { inView: true }), ...over(window) },
      [fn('function syncGiftMarkMotion() {')], 'syncGiftMarkMotion')();
      return gift.anim.playing;
    };
    expect(nft(() => ({})), 'the NFT card in front, its gift in view').toBe(true);
    expect(nft(() => ({ modalInFront: () => ({}) })), 'a dialog over the NFT card').toBe(false);
    expect(nft((w) => ({ walletNftHeroMotion: Object.assign(player(), { inView: false }) })), 'scrolled out of its view').toBe(false);
    expect(marks(), 'nothing open').toEqual({ brand: true, hero: false });
    expect(marks((d) => ({ modalOnScreen: () => true, modalInFront: () => d })), 'the card open, in front').toEqual({ brand: false, hero: true });
    expect(marks(() => ({ modalOnScreen: () => true, modalInFront: () => ({}) })), 'a dialog over the card').toEqual({ brand: false, hero: false });
    expect(marks((d) => ({ modalInFront: () => d, pageOnScreen: () => false })), 'a page not seen').toEqual({ brand: false, hero: false });
    expect(marks((d) => ({ modalInFront: () => d, giftMotionAllowed: () => false })), 'reduced motion').toEqual({ brand: false, hero: false });
    expect(() => marks(() => ({ brandGiftMotion: null, heroGiftMotion: { anim: null } })), 'no players yet').not.toThrow();
    const touched = { anim: { play() { throw new Error('touched'); }, pause() { throw new Error('touched'); } } };
    expect(() => marks(() => ({ globalThis: {}, brandGiftMotion: touched, heroGiftMotion: touched }))).not.toThrow();
  });

  it('SEEN-06: a modal opening or closing settles what moves — the page\'s own by their hidden, the body\'s as they come and go', () => {
    const at = app.indexOf('const modals = new MutationObserver');
    expect(at).toBeGreaterThan(app.indexOf('const profileBalanceCardGiftMotion = '));
    const block = sourceBlock(app.slice(app.lastIndexOf("if (typeof MutationObserver === 'function')", at)), "if (typeof MutationObserver === 'function')");
    const watched: Array<[string, any]> = [];
    let settled = 0;
    const page = [{ id: 'walletGroupDialog' }, { id: 'actionDialog' }, { id: 'profileCardDialog' }];
    const body = { id: 'body' };
    class FakeObserver {
      constructor(private readonly run: () => void) {}
      observe(node: any, options: any) { watched.push([node.id, options]); }
      fire() { this.run(); }
    }
    const made: FakeObserver[] = [];
    lift({ MutationObserver: class extends FakeObserver { constructor(run: () => void) { super(run); made.push(this); } },
      document: { querySelectorAll: (selector: string) => (selector === '.modal-backdrop' ? page : []), body },
      syncMotionOnScreen: () => { settled += 1; } }, [block], 'null');
    expect(watched).toEqual([...page.map((m) => [m.id, { attributes: true, attributeFilter: ['hidden'] }]), ['body', { childList: true }]]);
    expect(made).toHaveLength(1);
    made[0].fire();
    expect(settled).toBe(1);
    expect(code(fn('function syncMotionOnScreen() {'))).toMatch(/if \(!globalThis\.__plathoGiftRuntimeReady\) return;\s*syncProfileBalanceCardLife\(\);\s*syncGiftMarkMotion\(\);/);
    expect(code(fn('function syncProfileBalanceCardLife() {')), 'and the Wallet tab\'s card with it').toContain('syncWalletCardLife();');
    expect(appCode).toMatch(/profileBalanceCardInView = entries\[entries\.length - 1\]\?\.isIntersecting !== false;\s*syncProfileBalanceCardLife\(\);\s*\}\)\.observe\(document\.querySelector\('#profileCardBalance'\)\);/);
    expect(code(fn('function syncBrandGiftMotion() {'))).toMatch(/mark\.hidden = Boolean\(motion\);\s*syncGiftMarkMotion\(\);/);
    expect(code(fn('function syncHeroGiftMotion(theme) {'))).toMatch(/if \(motion\) profileCardHeroGift\.hidden = true;\s*syncGiftMarkMotion\(\);/);
    expect(code(fn('function setView(view, { restoreRoom = true } = {}) {'))).toMatch(/syncWalletCardLife\(view === 'wallet'\);\s*syncGiftMarkMotion\(\);/);
    expect(appCode).toContain("document.addEventListener('visibilitychange', () => syncGiftMarkMotion());");
  });

  it('SEEN-07: every loop asks pageOnScreen, and Telegram\'s minimise and return stop and wake them', () => {
    expect(code(fn('function setCardGiftMotionPlaying(state, on) {'))).toContain('if (on && giftMotionAllowed() && pageOnScreen()) anim.play();');
    expect(code(fn('function installCardTilt(card, shown) {'))).toContain('const next = Boolean(on) && pageOnScreen();');
    expect(code(fn('async function mountGiftMotion(canvas, gift, current, '))).toContain('if (giftMotionAllowed() && pageOnScreen()) anim.play();');
    expect(code(fn('function auroraTick(now) {'))).toContain('if (!pageOnScreen()) { auroraLoopArmed = false; return; }');
    expect(code(fn('function armAuroraLoop() {'))).toContain('if (auroraLoopArmed || !pageOnScreen()) return;');
    expect(code(fn('function nodesTick(now) {'))).toContain("if (!pageOnScreen() || backgroundMode !== 'nodes' || !nodesScene) { nodesLoopArmed = false; return; }");
    expect(code(fn('function armNodesLoop() {'))).toContain('if (nodesLoopArmed || !pageOnScreen() ||');
    for (const start of ['function setCardGiftMotionPlaying(state, on) {', 'function installCardTilt(card, shown) {', 'async function mountGiftMotion(canvas, gift, current, ',
      'function auroraTick(now) {', 'function armAuroraLoop() {', 'function nodesTick(now) {', 'function armNodesLoop() {', 'function syncGiftMarkMotion() {']) {
      expect(code(fn(start)), `${start} reads the page's visibility only through pageOnScreen`).not.toMatch(/document\.hidden|document\.visibilityState/);
    }
    const tg = code(fn('function initTelegramMiniApp() {'));
    expect(tg).toContain('const settleMotion = () => { try { syncMotionOnScreen(); armAuroraLoop(); armNodesLoop(); } catch {');
    expect(tg).toMatch(/tg\.onEvent\('activated', settleMotion\);\s*tg\.onEvent\('activated', resumeReads\);\s*tg\.onEvent\('deactivated', settleMotion\);/);
    expect(code(fn('function walletCardSeen(viewIsWallet = isVaultViewActive()) {'))).toContain('&& walletCardInView && !modalOnScreen();');
  });
});
