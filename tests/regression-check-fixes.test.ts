import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { formatUnits } from '../web/wallet-assets.mjs';
import { routeRate } from '../web/swap-routes.mjs';


const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const NL = String.fromCharCode(10);
const lift = (env: Record<string, any>, sources: string[], exported: string) => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [...sources, `return ${exported};`].join(NL))(...names.map((n) => env[n]));
};

describe('the regression check\'s fixes', () => {
  it('RCHK-01 (V1-1): the wallet window opened again in its exit stays open — its exit stands down; the hold is the shown window\'s', () => {
    const timers: Array<() => void> = [];
    const classes = new Set<string>();
    const dialog: any = { hidden: true, querySelectorAll: () => [], classList: { contains: (c: string) => classes.has(c), add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c) } };
    const holds: string[] = [];
    const api = lift({
      walletGroupDialog: dialog, t: (key: string) => key, setText: () => {}, fitWalletGroupTitle: () => {}, document: { querySelector: () => null },
      dialogReturnFocusTarget: () => ({ id: 'gear' }), holdPageBehindModal: () => holds.push('hold'), releaseModalHold: () => holds.push('release'),
      restoreDialogFocus: () => {}, window: { matchMedia: () => ({ matches: false }), setTimeout: (run: () => void) => { timers.push(run); return 1; } },
    }, ['let walletGroupReturnFocus = null;', fn('function hideDialogAnimated(backdrop, onHidden = null) {'),
      fn('function openWalletGroup(group, { title = t(\'wallet.groupSettings\'), back = false, also = [] } = {}) {'), fn('function closeWalletGroup() {')],
    '{ openWalletGroup, closeWalletGroup }');
    api.openWalletGroup('menu');
    api.closeWalletGroup();
    expect(classes.has('is-closing')).toBe(true);
    api.openWalletGroup('menu');
    for (const run of timers.splice(0)) run();
    expect([dialog.hidden, classes.has('is-closing')], 'MEASURED before: hidden while it held the page').toEqual([false, false]);
    expect(holds).toEqual(['hold', 'release', 'hold']);
  });

  it('RCHK-02 (V1-2, V1-3): "Show full" puts the whole in before the cut leaves — the list never shrinks; the keyboard follows; the place is kept', () => {
    class Node {
      children: Node[] = []; parent: Node | null = null; attrs = new Map<string, string>(); listeners: Record<string, any> = {}; tag: string; textContent = '';
      constructor(tag: string) { this.tag = tag; }
      get lastChild() { return this.children.at(-1) ?? null; }
      get firstChild() { return this.children[0] ?? null; }
      get nextSibling(): Node | null { if (!this.parent) return null; return this.parent.children[this.parent.children.indexOf(this) + 1] ?? null; }
      append(...nodes: Node[]) { for (const node of nodes) this.insert(node, this.children.length); }
      insert(node: Node, at: number) {
        const moving = node.tag === '#fragment' ? node.children.splice(0) : [node];
        for (const one of moving) { one.parent?.children.splice(one.parent.children.indexOf(one), 1); one.parent = this; }
        this.children.splice(at, 0, ...moving);
      }
      before(node: Node) { this.parent!.insert(node, this.parent!.children.indexOf(this)); }
      remove() { const parent = this.parent!; parent.children.splice(parent.children.indexOf(this), 1); this.parent = null; sizes.push(parent.children.length); }
      replaceWith(node: Node) { const parent = this.parent!; const at = parent.children.indexOf(this); this.remove(); parent.insert(node, at); }
      addEventListener(name: string, run: any) { this.listeners[name] = run; }
      hasAttribute(name: string) { return this.attrs.has(name); }
      setAttribute(name: string, value: string) { this.attrs.set(name, value); }
      focus() { doc.activeElement = this; }
    }
    const sizes: number[] = [];
    const doc: any = { activeElement: null, createElement: (tag: string) => new Node(tag), createDocumentFragment: () => new Node('#fragment') };
    let expandedCalls = 0;
    const bounded = lift({ document: doc, t: (key: string) => key, expandedMessageBodies: new Set(), expandedMessageRecords: new WeakSet(),
      messageBodyExpanded: () => false, messagePreviewBudget: () => ({ cut: true }) },
    [fn('function appendBoundedContent(container, key, build, { expanded = null } = {}) {')], 'appendBoundedContent');
    const strip = new Node('strip');
    for (let i = 0; i < 3; i += 1) strip.append(new Node('row'));
    const build = (target: Node, budget: any) => { for (let i = 0; i < (budget ? 2 : 6); i += 1) target.append(new Node(budget ? 'cut' : 'whole')); };
    bounded(strip, 'k', build, { expanded: () => { expandedCalls += 1; } });
    const more = strip.children.at(-1)!;
    expect(more.textContent).toBe('chat.showFull');
    const before = strip.children.length;
    doc.activeElement = more;
    more.listeners.click({ stopPropagation: () => {} });
    expect(Math.min(...sizes), 'MEASURED before: the list was shorter for a moment — the reader thrown up 504 px').toBeGreaterThanOrEqual(before);
    expect(strip.children.map((one) => one.tag)).toEqual(['row', 'row', 'row', 'whole', 'whole', 'whole', 'whole', 'whole', 'whole']);
    expect(doc.activeElement?.tag, 'the keyboard\'s place goes to what it opened').toBe('whole');
    expect(doc.activeElement.attrs.get('tabindex')).toBe('-1');
    expect(expandedCalls).toBe(1);
    expect(code(fn('function renderConversation() {'))).toContain("expanded: () => { if (bubble.querySelector('.message-image')) bubble.classList.add('has-media'); keepConversationPlace(); },");
    expect(code(fn('function keepConversationPlace() {'))).toContain('conversationOpenScrollUnsettled = false;');
  });

  it('RCHK-03 (V2-1): the rate the other way round when this way has no figure in six places', () => {
    const rate = lift({ formatUnits, routeRate }, [fn('function walletSwapRate(route, pool) {')], 'walletSwapRate');
    const pair = (offerDecimals: number, askDecimals: number, stable = false) => ({ dex: stable ? 'dedust' : 'stonfi',
      pair: { stable, offerSide: 0, offer: { symbol: 'X', decimals: offerDecimals }, ask: { symbol: 'GRAM', decimals: askDecimals } } });
    expect(rate(pair(9, 9), { reserves: ['5263157894736842', '1000000000'] })).toMatch(/^1 GRAM ≈ 5 263 157\.89/);
    expect(rate(pair(9, 9), { reserves: ['1000000000', '2500000000'] })).toBe('1 X ≈ 2.5 GRAM');
    expect(rate(pair(9, 9), { reserves: ['1000000000000', '1000000'] }), 'a millionth is still a figure this way').toBe('1 X ≈ 0.000001 GRAM');
    expect(rate(pair(9, 9, true), { reserves: [1n, 1n], unitIn: 1_000_000_000n, unitOut: 2_500_000_000n })).toBe('1 X ≈ 2.5 GRAM');
    expect(rate(pair(9, 9, true), { reserves: [1n, 1n] })).toBe('');
  });

  it('RCHK-04 (V2-2): page 1 read in the background goes on top of the pages loaded, and the paging stands', () => {
    const load = code(fn('async function loadWalletAssets(tab, { force = false, more = false, keep = false } = {}) {'));
    expect(load).toContain('const kept = keep && !more && Array.isArray(state.history) && (state.history.length > page.rows.length || !page.rows.length);');
    expect(load).toContain('const rows = more ? [...(state.history ?? []), ...page.rows] : kept ? [...page.rows, ...state.history] : page.rows;');
    expect(load).toMatch(/if \(!kept\) \{\s*state\.historyOffset = page\.nextOffset;\s*state\.historyMore = page\.more;\s*\}/);
    expect(code(fn('function checkWalletIncoming({ now = false } = {}) {'))).toContain("void loadWalletAssets('history', { force: true, keep: true });");
  });

  it('RCHK-05 (V2-3): the Send chooser draws once, and again only when what it lists changed', async () => {
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
    const world = (state: any) => {
      let rows = 0;
      const reads: Record<string, () => void> = {};
      const node = (tag: string): any => ({ tag, children: [] as any[], isConnected: false, append(...more: any[]) { this.children.push(...more); }, replaceChildren() { this.children = []; } });
      const open = lift({
        plathoWallet: { address: 'W' }, walletTransferOnItsWay: () => false,
        loadWalletAssets: (tab: string) => new Promise<void>((resolve) => { reads[tab] = resolve; }),
        walletAssetsState: state, document: { createElement: node }, actionSubmitButton: null, sendWalletTonButton: null,
        walletAssetRow: () => { rows += 1; return { tag: 'row' }; }, gramPicture: () => '', walletBalanceRowText: () => '', assetPicture: () => '',
        walletAthToken: () => ({ master: 'ATH', balance: '5' }), walletHiddenAssets: () => new Set(), formatUnits: (v: string) => v, shortAddress: (v: string) => v,
        t: (key: string) => key, runWalletAssetSend: async () => {},
        openActionDialog: (config: any) => { const list = config.fields[0].render(); list.isConnected = true; return new Promise(() => {}); },
      }, [fn('async function openWalletSendChooser() {')], 'openWalletSendChooser');
      return { open, reads, rows: () => rows };
    };
    const fresh = world({ tokens: [], nfts: [], at: new Map([['tokens', 1], ['nft', 1]]) });
    void fresh.open();
    await settle();
    fresh.reads.tokens();
    await settle();
    fresh.reads.nft();
    await settle();
    expect(fresh.rows(), 'MEASURED before: built three times at every open').toBe(2);
    const state: any = { tokens: null, nfts: null, at: new Map() };
    const late = world(state);
    void late.open();
    await settle();
    expect(late.rows()).toBe(2);
    state.tokens = [{ master: 'USDT', name: 'Tether USD', symbol: 'USDT', verified: true, balance: '7', decimals: 6 }];
    state.at.set('tokens', 1);
    late.reads.tokens();
    await settle();
    expect(late.rows(), 'GRAM, ATH and USD₮ drawn again').toBe(5);
    late.reads.nft();
    await settle();
    expect(late.rows()).toBe(5);
  });
});
