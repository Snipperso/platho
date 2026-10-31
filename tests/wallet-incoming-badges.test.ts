import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';


const app = readFileSync('web/app.js', 'utf8');
const css = readFileSync('web/styles.css', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const NL = String.fromCharCode(10);
const SOURCES = ['function walletHistorySeen() {', 'function markWalletHistorySeen(rows) {', 'function walletIncomingCount(rows, seen) {', 'function walletIncomingGram(amount) {',
  'function refreshWalletIncomingBadges() {', 'function checkWalletIncoming({ now = false } = {}) {'].map(fn);

function world({ locked = false } = {}) {
  const store = new Map<string, string>();
  const painted: Array<[string, number]> = [];
  const historyTab = { dataset: {} as Record<string, string> };
  const reads: any[] = [];
  const env: Record<string, any> = {
    WALLET_HISTORY_SEEN_KEY: 'k', WALLET_INCOMING_CHECK_MS: 180_000, WALLET_INCOMING_GRAM_FLOOR_NANOTONS: 10_000_000n,
    walletLocalStorage: () => ({ getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) }),
    plathoWallet: locked ? null : { address: 'W' }, walletAssetsState: { owner: 'W', tab: 'tokens', history: null as any, at: new Map<string, number>() },
    isVaultViewActive: () => true, document: { hidden: false },
    pageOnScreen: () => !env.document.hidden,
    paintRailBadge: (tab: string, count: number) => painted.push([tab, count]),
    walletTabs: { querySelector: (selector: string) => (selector === '[data-wallet-tab="history"]' ? historyTab : null) },
    loadWalletAssets: (tab: string, options: any) => { reads.push([tab, options]); return Promise.resolve(); },
    Date: { now: () => 1_000_000_000 }, chainNowSec: () => 1_000_000,
  };
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  const api = new Function(...names, [...SOURCES, 'return { walletIncomingCount, refreshWalletIncomingBadges, checkWalletIncoming, markWalletHistorySeen };'].join(NL))(...names.map((n) => env[n]));
  return { api, env, store, painted, historyTab, reads, last: () => painted.at(-1) };
}
const row = (id: string, at: number, extra: any = {}) => ({ id, at, kind: 'gram', direction: 'in', success: true, amount: '1000000000', ...extra });

describe('new incoming transfers, counted', () => {
  it('INCOMING-01: what counts — in, ran, GRAM or vouched for; newer than the mark, the mark\'s own second told apart by id', () => {
    const { api } = world();
    const seen = { at: 100, ids: ['a'] };
    const rows = [
      row('g1', 200), row('j1', 190, { kind: 'jetton', verified: true }), row('n1', 180, { kind: 'nft', verified: true }),
      row('spam', 170, { kind: 'jetton', verified: false }), row('gift?', 165, { kind: 'nft', verified: null }), row('out', 160, { direction: 'out' }),
      row('failed', 150, { success: false }), row('swap', 140, { kind: 'swap', direction: 'out' }),
      row('b', 100), row('a', 100), row('old', 90),
    ];
    expect(api.walletIncomingCount(rows, seen)).toBe(4);
    expect(api.walletIncomingCount(rows, { at: 300, ids: [] })).toBe(0);
    const dust = [row('d1', 400, { amount: '1' }), row('d2', 390, { amount: '9999999' }), row('ok', 380, { amount: '10000000' }), row('bad', 370, { amount: 'x' })];
    expect(api.walletIncomingCount(dust, { at: 0, ids: [] })).toBe(1);
    expect(app).toContain('const WALLET_INCOMING_GRAM_FLOOR_NANOTONS = WALLET_GRAM_DUST_NANOTONS;');
    expect(code(sourceBlock(app, 'function walletIncomingCount(rows, seen) {')), 'a cancel\'s refund is this wallet\'s own doing [round 86 — C1-3]').toContain("if (row.payment === 'refund') continue;");
    expect(readFileSync('web/wallet-assets.mjs', 'utf8')).toContain('export const WALLET_GRAM_DUST_NANOTONS = 10_000_000n;');
  });

  it('INCOMING-02: the first read sees what is there; new rows are counted on both places; History on screen sees them; 99+; locked: none', () => {
    const w = world();
    const state = w.env.walletAssetsState;
    state.history = [row('a', 100), row('b', 90)];
    w.api.refreshWalletIncomingBadges();
    expect(w.last()).toEqual(['wallet', 0]);
    expect(JSON.parse(w.store.get('k')!), 'the first read is the mark').toEqual({ at: 100, ids: ['a'] });
    state.history = [row('c', 120), row('d', 110, { kind: 'jetton', verified: true }), row('a', 100), row('b', 90)];
    w.api.refreshWalletIncomingBadges();
    expect(w.last()).toEqual(['wallet', 2]);
    expect(w.historyTab.dataset.count).toBe('2');
    state.tab = 'history';
    w.api.refreshWalletIncomingBadges();
    expect(w.last(), 'History on screen: seen').toEqual(['wallet', 0]);
    expect(w.historyTab.dataset.count).toBeUndefined();
    expect(JSON.parse(w.store.get('k')!)).toEqual({ at: 120, ids: ['c'] });
    state.tab = 'tokens';
    state.history = [...Array.from({ length: 120 }, (_u, i) => row(`n${i}`, 1000 + i)), ...state.history];
    w.api.refreshWalletIncomingBadges();
    expect(w.historyTab.dataset.count).toBe('99+');
    w.env.walletAssetsState.owner = '';
    w.api.refreshWalletIncomingBadges();
    expect(w.last(), 'no wallet: no count').toEqual(['wallet', 0]);
    expect(w.historyTab.dataset.count).toBeUndefined();
    const v = world();
    v.env.walletAssetsState.history = [row('a', 100)];
    v.api.refreshWalletIncomingBadges();
    v.env.walletAssetsState.tab = 'history';
    v.env.document.hidden = true;
    v.env.walletAssetsState.history = [row('z', 200), row('a', 100)];
    v.api.refreshWalletIncomingBadges();
    expect(v.last(), 'a hidden page has seen nothing').toEqual(['wallet', 1]);
  });

  it('INCOMING-03: History is asked when due, at once when a balance moved; never while History is on screen, hidden, or locked', () => {
    const w = world();
    const state = w.env.walletAssetsState;
    w.api.checkWalletIncoming();
    expect(w.reads, 'never read: due — page 1 on top of what is loaded').toEqual([['history', { force: true, keep: true }]]);
    state.at.set('history', 1_000_000_000 - 60_000);
    w.api.checkWalletIncoming();
    expect(w.reads.length, 'a minute old: not due').toBe(1);
    w.api.checkWalletIncoming({ now: true });
    expect(w.reads.length, 'a balance moved: at once').toBe(2);
    state.at.set('history', 1_000_000_000 - 180_000);
    w.api.checkWalletIncoming();
    expect(w.reads.length).toBe(3);
    state.tab = 'history';
    w.api.checkWalletIncoming({ now: true });
    expect(w.reads.length, 'History on screen: page 1 on top').toBe(4);
    state.at.delete('history');
    state.at.set('history:check', 1_000_000_000 - 60_000);
    w.api.checkWalletIncoming();
    expect(w.reads.length, 'a minute since the check: not due').toBe(4);
    state.tab = 'tokens';
    w.env.document.hidden = true;
    w.api.checkWalletIncoming({ now: true });
    expect(w.reads.length).toBe(4);
    const locked = world({ locked: true });
    locked.api.checkWalletIncoming({ now: true });
    expect(locked.reads).toEqual([]);
    expect(w.api.markWalletHistorySeen([]).at, 'MEASURED before: 0 — receipts an older page brought later were counted as new').toBe(1_000_000);
  });

  it('INCOMING-04: the Wallet tab\'s count sits on its face; every other tab\'s on the tab', () => {
    const made: any[] = [];
    const node = (name: string) => {
      const children: any[] = [];
      return { name, children, querySelector: (selector: string) => (selector === '.rail-item-wallet-face' ? faces[name] ?? null : children.find((one) => one.className === 'rail-badge') ?? null),
        append: (one: any) => { children.push(one); one.remove = () => children.splice(children.indexOf(one), 1); } };
    };
    const faces: Record<string, any> = {};
    const items: Record<string, any> = { wallet: node('wallet'), chats: node('chats') };
    faces.wallet = node('face');
    const paint = new Function('document', [fn('function paintRailBadge(tab, total) {'), 'return paintRailBadge;'].join(NL))({
      querySelector: (selector: string) => items[/data-tab="(\w+)"/.exec(selector)?.[1] ?? ''] ?? null,
      createElement: () => { const one: any = { className: '', textContent: '', setAttribute() {} }; made.push(one); return one; },
    });
    paint('wallet', 3);
    expect(faces.wallet.children.map((one: any) => one.textContent)).toEqual(['3']);
    expect(items.wallet.children).toEqual([]);
    paint('wallet', 0);
    expect(faces.wallet.children).toEqual([]);
    paint('chats', 5);
    expect(items.chats.children.map((one: any) => one.textContent)).toEqual(['5']);
    expect(css).toMatch(/\.rail-item-wallet-face \{\s*position: relative;/);
    expect(css).toMatch(/\.rail-item\.rail-item-wallet > span\.rail-item-wallet-face:not\(\.rail-badge\) \{\s*overflow: visible;\s*\}/);
    expect(css).toMatch(/\.rail-item-wallet-face > \.rail-badge \{\s*top: -4px;\s*\}/);
  });

  it('INCOMING-05: wired where it lives — every balance read, every History read, the section and the view opened, a wallet gone', () => {
    const balance = code(fn('async function refreshVaultNavBalanceInBackground(options = {}) {'));
    expect(balance).toContain('const before = vaultPocketState.wallet;');
    expect(balance).toContain("|| (ath !== null && typeof before?.ath_balance === 'bigint' && ath !== before.ath_balance);");
    expect(balance).toContain('checkWalletIncoming({ now: moved });');
    const load = code(fn('async function loadWalletAssets(tab, { force = false, more = false, keep = false } = {}) {'));
    expect(load.indexOf('refreshWalletIncomingBadges();')).toBeGreaterThan(load.indexOf('state.historyMore = page.more;'));
    expect(code(fn('function showWalletAssetsTab(tab, { load = true, render = true } = {}) {'))).toContain('refreshWalletIncomingBadges();');
    expect(code(fn('function resetWalletAssets(owner) {'))).toContain('refreshWalletIncomingBadges();');
    const view = code(app).slice(code(app).indexOf("syncWalletCardLife(view === 'wallet');"));
    expect(view.slice(0, view.indexOf('} else {'))).toContain('refreshWalletIncomingBadges();');
  });
});
