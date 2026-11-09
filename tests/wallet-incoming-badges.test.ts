import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';


const app = readFileSync('web/app.js', 'utf8');
const css = readFileSync('web/styles.css', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const NL = String.fromCharCode(10);
const SOURCES = ['function walletHistorySeen() {', 'function markWalletHistorySeen(rows, held = []) {', 'function walletIncomingCount(rows, seen, unjudged = null) {', 'function walletIncomingGram(amount) {',
  'function refreshWalletIncomingBadges() {', 'function checkWalletIncoming({ now = false } = {}) {'].map(fn);

function world({ locked = false } = {}) {
  const store = new Map<string, string>();
  const painted: Array<[string, number]> = [];
  const judged: string[][] = [];
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
    walletNftCollectionVerified: (collection: string) => (collection === 'BAD' ? 'no' : collection === 'GIFT' ? null : collection ? 'yes' : 'no'),
    walletHistoryJudge: (collections: string[]) => judged.push(collections),
  };
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  const api = new Function(...names, [...SOURCES, 'return { walletIncomingCount, refreshWalletIncomingBadges, checkWalletIncoming, markWalletHistorySeen };'].join(NL))(...names.map((n) => env[n]));
  return { api, env, store, painted, historyTab, reads, judged, last: () => painted.at(-1) };
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
    const sales = [row('own', 500, { kind: 'nft', trade: 'sold', collection: 'G', amount: '28800000000' }),
      row('planted', 490, { kind: 'nft', trade: 'sold', collection: 'BAD', amount: '28800000000' }),
      row('crumb', 480, { kind: 'nft', trade: 'sold', collection: 'G', amount: '929000' })];
    expect(api.walletIncomingCount(sales, { at: 0, ids: [] })).toBe(1);
    const unjudged = new Set<string>();
    const gifts = [row('gift sold', 600, { kind: 'nft', trade: 'sold', collection: 'GIFT', amount: '28800000000' }),
      row('gift in', 590, { kind: 'nft', verified: null, collection: 'GIFT' }),
      row('gift dust', 580, { kind: 'nft', trade: 'sold', collection: 'GIFT2', amount: '929000' })];
    expect(api.walletIncomingCount(gifts, { at: 0, ids: [] }, unjudged)).toBe(0);
    expect([...unjudged]).toEqual(['GIFT']);
    expect(app).toContain('const WALLET_INCOMING_GRAM_FLOOR_NANOTONS = WALLET_GRAM_DUST_NANOTONS;');
    expect(code(sourceBlock(app, 'function walletIncomingCount(rows, seen, unjudged = null) {')), 'a cancel\'s refund is this wallet\'s own doing [round 86 — C1-3]').toContain("if (row.payment === 'refund') continue;");
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

  it('INCOMING-08: a token end held at a look — not shown then — is news when it lands, however old; once looked at, landed, it is seen [client audit round 141 — C7-1]', () => {
    const { api, env, last } = world();
    env.walletAssetsState.history = [row('old', 100)];
    api.refreshWalletIncomingBadges();
    env.walletAssetsState.tab = 'history';
    env.walletAssetsState.history = [row('new', 200), { ...row('end', 150, { kind: 'jetton', verified: true }), held: true }, row('old', 100)];
    api.refreshWalletIncomingBadges();
    expect(last()).toEqual(['wallet', 0]);
    env.walletAssetsState.tab = 'tokens';
    delete env.walletAssetsState.history[1].held;
    api.refreshWalletIncomingBadges();
    expect(last(), 'landed after the look: news').toEqual(['wallet', 1]);
    env.walletAssetsState.tab = 'history';
    api.refreshWalletIncomingBadges();
    env.walletAssetsState.tab = 'tokens';
    api.refreshWalletIncomingBadges();
    expect(last(), 'looked at since: seen').toEqual(['wallet', 0]);
    for (const at of [150, 250]) {
      const first = world();
      first.env.walletAssetsState.history = [row('new', 200), { ...row('end', at, { kind: 'jetton', verified: true }), held: true }];
      first.api.refreshWalletIncomingBadges();
      delete first.env.walletAssetsState.history[1].held;
      first.api.refreshWalletIncomingBadges();
      expect(first.last(), `first read, the end at ${at}`).toEqual(['wallet', 0]);
    }
    env.walletAssetsState.history = [row('later', 300)];
    expect(api.walletIncomingCount([row('end', 150, { kind: 'jetton', verified: true })], { at: 200, ids: [], held: undefined } as any)).toBe(0);
  });

  it('INCOMING-09: History\'s unit, its keyboard and its place; the swap picker holds the keyboard; a long card value wraps in its own place; a failed row legible; Sell readable; the Japanese hint whole [the LOW batch of 2026-11-07]', () => {
    // eslint-disable-next-line no-new-func
    const unit = new Function('shortAddress', 'formatTonUserFriendlyAddress', `${fn('function walletHistoryUnit(symbol, master) {')}\nreturn walletHistoryUnit;`)(
      (address: string) => `short(${address})`, (raw: string) => `F${raw}`);
    expect([unit('USD₮', '0:aa'), unit('', '0:aa'), unit('', ''), unit(undefined, undefined)]).toEqual(['USD₮', 'short(F0:aa)', '', '']);
    const history = code(fn('function renderWalletHistory(panel) {'));
    expect(history).toContain('const given = walletHistoryUnit(row.symbol, row.master);');
    expect(history).toContain("to: walletHistoryUnit(asked?.symbol ?? '', asked?.master ?? '')");
    expect(history).toContain('${walletHistoryUnit(row.got.symbol, row.got.master)}');
    expect(history).toContain("row.kind === 'jetton' ? walletHistoryUnit(row.symbol, row.master) : row.symbol");
    expect(history.match(/historyId: String\(row\.id\)/g)?.length, 'every History row carries its id').toBe(3);
    const render = code(fn('function renderWalletAssets(tab) {'));
    expect(render).toContain("const onMore = focusedAt >= 0 && document.activeElement?.classList?.contains('wallet-assets-more');");
    expect(render).toContain("const more = onMore ? panel.querySelector('.wallet-assets-more') : null;");
    expect(render).toContain('(more ?? rows[Math.min(focusedAt, rows.length - 1)])?.focus({ preventScroll: true });');
    expect(render).toContain("if (tab === 'history' && scroller && at > 0 && scroller.getClientRects().length) {");
    expect(render).toContain('if (Math.abs(moved) >= 1) scroller.scrollTop += moved;');
    expect(code(fn('function restoreDialogFocus(target) {'))).toContain('`.wallet-asset-list [data-wallet-token="${CSS.escape(target.dataset.walletToken)}"]`');
    expect(code(fn('function renderWalletTokens(panel) {'))).toContain('onOpen: () => openWalletTokenCard(token), key: token.master });');
    const picker = code(fn('function openWalletSwapPicker({ title, items, amountOf, onPick, returnTo }) {'));
    expect(picker).toContain("const stops = [...panel.querySelectorAll('button, input')].filter((one) => !one.disabled && elementRendered(one));");
    expect(picker).toContain('stops.at(-1).focus({ preventScroll: true });');
    expect(picker).toContain('stops[0].focus({ preventScroll: true });');
    expect(code(fn("function walletCardStat(label, value, { copy = '', copied = 'dialog.shareCopied', balanceRow = null, wide = false } = {}) {"))).toContain("if (wide) row.classList.add('wallet-card-stat-wide');");
    expect(app).toContain("walletCardStat(t('nft.royalty'), `${share(listing.royaltyAddress ? listing.royaltyPercent : 0)}, ${gram(split.royalty)}`, { wide: true }),");
    expect(css).toMatch(/\.wallet-group-dialog \.profile-stat-row\.wallet-card-stat-wide \{\s*grid-template-columns: minmax\(0, auto\) minmax\(40%, 1fr\);/);
    expect(css).toMatch(/\.wallet-group-dialog \.wallet-card-stat-wide \.wallet-card-copy \{\s*white-space: normal;/);
    expect(css).toMatch(/\.wallet-history-row > \.wallet-asset-text \{\s*min-width: 9em;/);
    expect(css).not.toMatch(/\.wallet-history-row\.is-failed \{\s*opacity/);
    expect(css).toMatch(/\.wallet-history-row\.is-failed > \.wallet-asset-icon \{\s*opacity: var\(--disabled-opacity\);/);
    expect(css).toMatch(/\.wallet-history-row\.is-failed \.wallet-asset-name,\s*\.wallet-history-row\.is-failed \.wallet-asset-amount \{\s*color: var\(--muted\);/);
    expect(css).toContain('.wallet-card-send.is-sell { background: var(--sell-fill, var(--danger)); color: var(--sell-ink, #1a0505); }');
    expect(css.match(/--sell-fill: #c73c3c;/g)?.length, 'both light themes').toBe(2);
    expect(I18N_STRINGS.ja['wallet.sendNftHint']).toContain('永久に');
  });

  it('INCOMING-05: wired where it lives — every balance read, every History read, the section and the view opened, a wallet gone', () => {
    const balance = code(fn('async function refreshVaultNavBalanceInBackground(options = {}) {'));
    expect(balance).toContain('const before = vaultPocketState.wallet;');
    expect(balance).toContain("|| (ath !== null && typeof before?.ath_balance === 'bigint' && ath !== before.ath_balance);");
    expect(balance).toContain('checkWalletIncoming({ now: moved });');
    const load = code(fn('async function loadWalletAssets(tab, { force = false, more = false, keep = false } = {}) {'));
    expect(load.lastIndexOf('refreshWalletIncomingBadges();')).toBeGreaterThan(load.indexOf('state.historyMore = page.more;'));
    const takes = load.slice(load.indexOf('onTokenTakes: () => {'), load.indexOf('nftVerdictsKnown: Boolean(gifts),'));
    expect(takes).toContain('if (owner !== state.owner) return;');
    expect(takes).toContain('refreshWalletIncomingBadges();');
    expect(takes).toContain("if (state.tab === 'history' && isVaultViewActive()) renderWalletAssets('history');");
    expect(code(fn('function refreshWalletIncomingBadges() {'))).toContain('walletAssetsState.history.filter((row) => !row?.held)');
    const history = code(fn('function renderWalletHistory(panel) {'));
    expect(history).toContain("const heldOnly = !rows.length && (walletAssetsState.history ?? []).some((row) => row?.held === true);");
    expect(history).toContain("walletAssetsNote(panel, 'history', heldOnly ? 'wallet.assetsLoading' : 'wallet.historyEmpty',");
    expect(code(fn('function showWalletAssetsTab(tab, { load = true, render = true } = {}) {'))).toContain('refreshWalletIncomingBadges();');
    expect(code(fn('function resetWalletAssets(owner) {'))).toContain('refreshWalletIncomingBadges();');
    const view = code(app).slice(code(app).indexOf("syncWalletCardLife(view === 'wallet');"));
    expect(view.slice(0, view.indexOf('} else {'))).toContain('refreshWalletIncomingBadges();');
  });
});
