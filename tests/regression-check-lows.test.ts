import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { createInlineFormatRegex } from '../web/message-plain-text.mjs';


const app = readFileSync('web/app.js', 'utf8');
const css = readFileSync('web/styles.css', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const NL = String.fromCharCode(10);
const lift = (env: Record<string, any>, sources: string[], exported: string) => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [...sources, `return ${exported};`].join(NL))(...names.map((n) => env[n]));
};
const BUDGET = [fn('function messagePreviewBudget() {'), 'let messagePreviewGraphemes;', app.slice(app.indexOf('const MESSAGE_PREVIEW_PIECE_REACH = '), app.indexOf(NL, app.indexOf('const MESSAGE_PREVIEW_PIECE_REACH = '))),
  fn('function messagePreviewCutPoint(str, end, allowEmpty = false) {')];
const budgetOf = lift({ createInlineFormatRegex }, BUDGET, 'messagePreviewBudget');
const markup = (lines: number) => Array.from({ length: lines }, (_, at) => `- line ${at}`).join(NL);
const EXPANDED_LINE = app.slice(app.indexOf('const messageBodyExpanded = '), app.indexOf(NL, app.indexOf('const messageBodyExpanded = ')));

class Node {
  tag: string; children: Node[] = []; parent: Node | null = null; type = ''; title = ''; text = ''; root = false;
  dataset: Record<string, string> = {}; attrs = new Map<string, string>(); classes = new Set<string>(); listeners: Record<string, (event: any) => void> = {};
  constructor(tag: string, text = '') { this.tag = tag; this.text = text; }
  set className(value: string) { this.classes = new Set(value.split(' ').filter(Boolean)); }
  get className() { return [...this.classes].join(' '); }
  get classList() {
    const self = this;
    return { add: (...names: string[]) => names.forEach((one) => self.classes.add(one)), remove: (...names: string[]) => names.forEach((one) => self.classes.delete(one)),
      contains: (name: string) => self.classes.has(name), toggle: (name: string, on: boolean) => (on ? self.classes.add(name) : self.classes.delete(name)) };
  }
  get textContent(): string { return this.tag === '#text' ? this.text : this.children.map((one) => one.textContent).join(''); }
  set textContent(value: string) { this.children = []; if (this.tag === '#text') this.text = value; else this.append(new Node('#text', value)); }
  get childNodes() { return this.children; }
  get lastChild() { return this.children.at(-1) ?? null; }
  get firstChild() { return this.children[0] ?? null; }
  get nextSibling(): Node | null { if (!this.parent) return null; return this.parent.children[this.parent.children.indexOf(this) + 1] ?? null; }
  get isConnected(): boolean { return this.root || Boolean(this.parent?.isConnected); }
  append(...nodes: Node[]) { for (const node of nodes) this.insert(node, this.children.length); }
  insert(node: Node, at: number) {
    const moving = node.tag === '#fragment' ? node.children.splice(0) : [node];
    for (const one of moving) { if (one.parent) one.parent.children.splice(one.parent.children.indexOf(one), 1); one.parent = this; }
    this.children.splice(at, 0, ...moving);
  }
  remove() { if (this.parent) { this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; } }
  replaceWith(node: Node) { const parent = this.parent!; const at = parent.children.indexOf(this); this.remove(); parent.insert(node, at); }
  replaceChildren(...nodes: Node[]) { for (const one of [...this.children]) one.remove(); this.append(...nodes); }
  before(node: Node) { this.parent!.insert(node, this.parent!.children.indexOf(this)); }
  setAttribute(name: string, value: string) { this.attrs.set(name, value); }
  hasAttribute(name: string) { return this.attrs.has(name); }
  addEventListener(name: string, handler: (event: any) => void) { this.listeners[name] = handler; }
  click() { this.listeners.click?.({ stopPropagation: () => {} }); }
  focus() {}
  all(): Node[] { return [this, ...this.children.flatMap((one) => one.all())]; }
  querySelector(selector: string) { return this.all().slice(1).find((one) => one.classes.has(selector.replace(/^\./, ''))) ?? null; }
  buttons(cls: string) { return this.all().filter((one) => one.tag === 'button' && one.classes.has(cls)); }
}
const document = { createElement: (tag: string) => new Node(tag), createTextNode: (text: string) => new Node('#text', text), createDocumentFragment: () => new Node('#fragment') };
const handed: string[] = [];
const formatted = (container: Node, text: string) => { handed.push(text); for (const line of text.split(NL)) container.append(new Node('div', line)); };

describe('the regression check\'s lows', () => {
  it('RLOW-01 (V1-8): a cut never falls inside a link, a bold run or one character the reader sees — unless stepping back leaves nothing', () => {
    const take = (text: string) => { const budget = budgetOf(); const shown = budget.take(text); return { shown, cut: budget.cut }; };
    const bare = take(`${'a '.repeat(740)}https://example.com/${'p'.repeat(100)}`);
    expect(bare.cut).toBe(true);
    expect(bare.shown, 'MEASURED before: a link to https://example.com/ppp… cut at 1,500').toBe('a '.repeat(740).trimEnd());
    const labelled = take(`${'b '.repeat(745)}[the label](https://example.com/${'q'.repeat(60)}) after`);
    expect(labelled.shown).toBe('b '.repeat(745).trimEnd());
    const bold = take(`${'c '.repeat(740)}**${'bold '.repeat(30)}** after`);
    expect(bold.shown, 'MEASURED before: the stars stood').toBe('c '.repeat(740).trimEnd());
    const mention = take(`${'d'.repeat(1497)} @someone`);
    expect(mention.shown, 'and it ends on a word, not on the space before its "…"').toBe('d'.repeat(1497));
    const family = '\u{1F468}‍\u{1F469}‍\u{1F467}';
    const joined = take(`${'e'.repeat(1498)}${family} and more`);
    expect(joined.shown, 'MEASURED before: the first person and "…"').toBe('e'.repeat(1498));
    const surrogate = take(`${'f'.repeat(1499)}\u{1F600}\u{1F600}`);
    expect(surrogate.shown).toBe('f'.repeat(1499));
    const leading = take(`https://example.com/${'r'.repeat(3000)}`);
    expect(leading.shown).toHaveLength(1500);
    const before = take(`an intro **bold** ${'g'.repeat(2000)}`);
    expect(before.shown).toHaveLength(1500);
    const spaced = take(`${'h'.repeat(1490)}          ${'i'.repeat(100)}`);
    expect(spaced.shown, 'a run of spaces at the cut').toBe('h'.repeat(1490));
    const blank = take(`${' '.repeat(1600)}x`);
    expect(blank.shown, 'nothing but space before the cut: the cut stands').toHaveLength(1500);
    const lines = take(markup(30));
    expect(lines.shown.split(NL)).toHaveLength(24);
  });

  it('RLOW-02 (V1-6): a cut with a picture, a file or a shared post behind it says so; one with text alone does not', () => {
    const scope = () => lift({
      document, t: (key: string) => key, expandedMessageBodies: new Set(), expandedMessageRecords: new WeakSet(), createInlineFormatRegex,
      appendFormattedMessageText: formatted, buildReplyQuoteNode: () => new Node('blockquote'), drawableImageUrl: (url: string) => url,
      wirePublicImageLightbox: () => {}, buildFileBlockChip: () => new Node('file'), buildSharedPostEmbed: () => new Node('embed'), publicPostDetailBody: null,
    }, [...BUDGET, fn('function blockIsAttachment(block) {'), EXPANDED_LINE, fn('function appendBoundedContent(container, key, build, { expanded = null } = {}) {'),
      fn('function appendPublicItemContent(container, item, embedDepth = 0, options = {}) {')], '({ appendBoundedContent, appendPublicItemContent })');
    const label = (item: any) => {
      const { appendBoundedContent, appendPublicItemContent } = scope();
      const row = new Node('article');
      appendBoundedContent(row, 'k', (target: Node, budget: any) => appendPublicItemContent(target, item, 0, { budget }));
      return row.buttons('message-show-full').map((one) => one.textContent);
    };
    expect(label({ blocks: [{ type: 'text', text: markup(40) }, { type: 'text', text: 'more' }] })).toEqual(['chat.showFull']);
    expect(label({ blocks: [{ type: 'text', text: markup(40) }, { type: 'text', text: 'more' }, { type: 'image', url: 'data:image/png;base64,AA' }] })).toEqual(['chat.showFullMedia']);
    expect(label({ blocks: [{ type: 'text', text: markup(40) }, { type: 'file', url: 'x' }] })).toEqual(['chat.showFullMedia']);
    expect(label({ blocks: [{ type: 'text', text: markup(40) }, { type: 'share', entryId: '5' }] })).toEqual(['chat.showFullMedia']);
    expect(label({ blocks: [{ type: 'text', text: markup(40) }, { type: 'image' }] }), 'an image with nothing to draw is no attachment').toEqual(['chat.showFull']);
    expect(label({ text: markup(40), imageUrl: 'data:image/png;base64,AA' })).toEqual(['chat.showFullMedia']);
    expect(label({ blocks: [{ type: 'image', url: 'data:image/png;base64,AA' }, { type: 'text', text: markup(40) }] }), 'a picture before the cut is drawn').toEqual(['chat.showFull']);
    const conversation = code(fn('function renderConversation() {'));
    const bubble = conversation.slice(conversation.indexOf('appendBoundedContent(bubble, message, (target, budget) => {'));
    expect(bubble).toContain('if (blockIsAttachment(block)) { budget.media = true; break; }');
    expect(bubble).toContain("expanded: () => { if (bubble.querySelector('.message-image')) bubble.classList.add('has-media'); keepConversationPlace(); },");
  });

  describe('RLOW-03 (V1-4, V1-5): a shared post\'s card', () => {
    const world = ({ resolved = null }: { resolved?: any } = {}) => {
      const calls: string[] = [];
      const env: Record<string, any> = {
        document, t: (key: string) => key, expandedMessageBodies: new Set(), expandedMessageRecords: new WeakSet(), expandedSharedEmbeds: new Set(), createInlineFormatRegex,
        appendFormattedMessageText: formatted, buildReplyQuoteNode: () => new Node('blockquote'), drawableImageUrl: (url: string) => url,
        wirePublicImageLightbox: () => {}, buildFileBlockChip: () => new Node('file'), publicPostDetailBody: null,
        rawWalletAddress: (value: any) => value ?? null, publicChannelVisibleUnderModeration: () => true, resolveWalletChannelDisplay: () => ({ name: 'Channel' }),
        publicAuthorLabel: () => null, shortAddress: (value: string) => value, setAvatarNode: () => {}, publicAvatarUrlForWallet: () => null, setView: () => {},
        openPublicChannelView: () => {}, openPublicPostDetail: () => {}, normalizeBodyHashHex: (value: any) => (value ? String(value) : null),
        resolveSharedPostOriginal: () => Promise.resolve(resolved), sharedPostImageUrlWarm: async () => {}, publicItemVisibleUnderModeration: () => true,
        feedPostClampObserver: { observe: () => {}, unobserve: () => {} },
        expandClampedBody: () => calls.push('expand'), collapseClampedBody: () => calls.push('collapse'),
      };
      const build = lift(env, [...BUDGET, fn('function blockIsAttachment(block) {'), EXPANDED_LINE,
        fn('function appendBoundedContent(container, key, build, { expanded = null } = {}) {'), fn('function appendPublicItemContent(container, item, embedDepth = 0, options = {}) {'),
        fn('function wireClampToggleButton(root, body, inner, expandedSet, key, renderFull = null) {'), fn('function buildSharedPostEmbed(block, embedDepth = 0, options = {}) {')],
      'buildSharedPostEmbed');
      const page = new Node('page');
      page.root = true;
      const draw = (block: any, depth = 0) => { const embed: Node = build(block, depth); page.append(embed); return embed; };
      const toggle = (embed: Node) => embed.children.find((one) => one.tag === 'button' && one.classes.has('feed-expand-button'))!;
      return { draw, toggle, calls, settle: () => new Promise((resolve) => setTimeout(resolve, 0)) };
    };

    it('a repost inside a repost: its snapshot is built to the budget, and the card\'s one press builds the rest; a rebuild keeps it open', () => {
      const w = world();
      const block = { entryId: 'e9', bodyHash: 'h9', authorWallet: 'W', snippet: markup(100) };
      handed.length = 0;
      const embed = w.draw(block, 1);
      expect(handed, 'MEASURED before: cut at 24 lines with no way on').toEqual([markup(24)]);
      expect(embed.dataset.bodyCut, 'the card is cut: its button stays').toBe('1');
      expect(embed.buttons('message-show-full')).toHaveLength(1);
      w.toggle(embed).click();
      expect(handed.at(-1), 'one press').toBe(markup(100));
      expect(embed.buttons('message-show-full'), 'MEASURED before: a second press under the opened card').toHaveLength(0);
      expect(w.calls).toEqual(['expand']);
      handed.length = 0;
      const again = w.draw(block, 1);
      expect(handed, 'drawn again open, as the reader left it').toEqual([markup(100)]);
      expect([again.dataset.bodyCut, again.buttons('message-show-full').length]).toEqual([undefined, 0]);
      handed.length = 0;
      const other = w.draw({ ...block, bodyHash: 'h7' }, 1);
      expect([handed, other.dataset.bodyCut]).toEqual([[markup(24)], '1']);
      const short = w.draw({ entryId: 'e8', bodyHash: 'h8', authorWallet: 'W', snippet: 'a line' }, 1);
      expect([short.dataset.bodyCut, short.buttons('message-show-full').length]).toEqual([undefined, 0]);
    });

    it('the chain copy that lands cut: the card\'s one press builds it whole; a rebuild of the open card builds it whole at once', async () => {
      const post = { bodyHash: 'h1', authorWallet: 'W', text: markup(80) };
      const w = world({ resolved: post });
      const block = { entryId: 'e1', bodyHash: 'h1', authorWallet: 'W', snippet: 'a short excerpt' };
      const embed = w.draw(block);
      expect(embed.dataset.bodyCut, 'the snapshot fits').toBeUndefined();
      handed.length = 0;
      await w.settle();
      await w.settle();
      expect(handed).toEqual([markup(24)]);
      expect(embed.dataset.bodyCut, 'the chain copy is cut: the card says so').toBe('1');
      w.toggle(embed).click();
      expect(handed.at(-1)).toBe(markup(80));
      expect(embed.buttons('message-show-full'), 'MEASURED before: two presses, the inner one hidden under the clamp').toHaveLength(0);
      handed.length = 0;
      const again = w.draw(block);
      await w.settle();
      await w.settle();
      expect(handed, 'MEASURED before: cut back to 24 lines on every rebuild').toEqual(['a short excerpt', markup(80)]);
      expect(again.buttons('message-show-full')).toHaveLength(0);
    });

    it('a card opened before its chain copy lands: the copy comes in whole', async () => {
      const w = world({ resolved: { bodyHash: 'h2', authorWallet: 'W', text: markup(80) } });
      const embed = w.draw({ entryId: 'e2', bodyHash: 'h2', authorWallet: 'W', snippet: markup(20) });
      w.toggle(embed).click();
      handed.length = 0;
      await w.settle();
      await w.settle();
      expect(handed, 'not cut under an open card, to wait for a second press').toEqual([markup(80)]);
      expect([embed.dataset.bodyCut, embed.buttons('message-show-full').length]).toEqual([undefined, 0]);
    });
  });

  it('RLOW-04 (V1-7): a comment\'s opening is kept by its post as well as by itself, and one\'s own opened on its way stays open when it lands', () => {
    const expandedMessageBodies = new Set<string>();
    const key = lift({ expandedMessageBodies, isOwnPublicAuthor: (wallet: string) => wallet === 'me', publicItemAuthor: (item: any) => item?.authorWallet ?? null },
      [fn('function publicCommentRowKey(comment) {'), fn('function publicCommentExpansionKey(comment, postKey) {')], 'publicCommentExpansionKey');
    expect(key({ entryId: '7' }, 'p1')).toBe('comment:p1|7');
    expect(key({ entryId: '7' }, 'p2'), 'MEASURED before: the same entry under another post was built whole').toBe('comment:p2|7');
    expect(key({}, 'p1')).toBeNull();
    const onItsWay = key({ bodyHash: 'h1', authorWallet: 'me' }, 'p1');
    expect(onItsWay).toBe('comment:p1|hash:h1');
    expandedMessageBodies.add(onItsWay);
    expect(key({ entryId: '8', bodyHash: 'h1', authorWallet: 'me' }, 'p1')).toBe('comment:p1|8');
    expect(expandedMessageBodies.has('comment:p1|8'), 'MEASURED before: it came back cut when it landed').toBe(true);
    key({ entryId: '9', bodyHash: 'h1', authorWallet: 'stranger' }, 'p1');
    expect(expandedMessageBodies.has('comment:p1|9'), 'a stranger\'s copy of the words is not opened with it').toBe(false);
    key({ entryId: '8', bodyHash: 'h1', authorWallet: 'me' }, 'p2');
    expect(expandedMessageBodies.has('comment:p2|8'), 'nor one under another post').toBe(false);
    expect(code(fn("function buildPublicCommentRow(comment, surfacing, postKey = '') {"))).toContain('appendBoundedContent(row, publicCommentExpansionKey(comment, postKey), ');
    const list = code(fn('function appendPublicItemComments(article, item, keptList = null) {'));
    expect(list).toContain("const postKey = String(item?.id ?? '');");
    expect(list).toContain('build: () => buildPublicCommentRow(comment, surfacing, postKey),');
    expect(code(fn('function renderPublicPostDetail() {'))).toContain('appendPublicItemComments(section, { comments, id: publicPostDetailItem?.id }, keptCommentList);');
  });

  it('RLOW-05 (V1-9): on a phone\'s bar the Wallet tab\'s count is held by its face\'s right edge — the base pill rule stays the first', () => {
    const rule = css.match(/@media \(max-width: 900px\) \{\s*\.rail-item-wallet-face > \.rail-badge \{\s*left: auto;\s*right: max\(1px, calc\(50% - 28px\)\);\s*\}\s*\}/);
    expect(rule, 'the phone rule').not.toBeNull();
    expect(css.indexOf('.rail-badge {'), 'the pill\'s own rule is found first').toBeLessThan(css.indexOf(rule![0]));
    expect(css.indexOf('.rail-item-wallet-face > .rail-badge {\n  top: -4px;')).toBeLessThan(css.indexOf(rule![0]));
  });

  it('RLOW-06 (V1-10): a redraw of the wallet\'s list gives the keyboard the row in its place — the next one when its own left', () => {
    const doc: any = { activeElement: null, querySelector: () => null };
    const focusArgs: any[] = [];
    const row = (name: string): any => ({ name, focus(options: any) { doc.activeElement = this; focusArgs.push(options); } });
    let shown: any[] = [];
    let next: any[] = [];
    const panel: any = { hidden: false, closest: () => null, querySelectorAll: () => shown, contains: (node: any) => shown.includes(node) };
    const render = lift({
      walletAssetPanels: () => ({ tokens: panel }), renderWalletTokens: () => { shown = next; }, renderWalletNfts: () => {}, renderWalletHistory: () => {},
      walletAssetsState: { openCard: null }, walletGroupDialog: null, document: doc,
    }, [fn('function renderWalletAssets(tab) {')], 'renderWalletAssets');
    shown = ['GRAM', 'ATH', 'JUNK', 'USDT'].map(row);
    doc.activeElement = shown[2];
    next = ['GRAM', 'ATH', 'USDT'].map(row);
    render('tokens');
    expect(doc.activeElement?.name, 'MEASURED before: the page').toBe('USDT');
    expect(focusArgs).toEqual([{ preventScroll: true }]);
    doc.activeElement = shown[2];
    next = ['GRAM', 'ATH'].map(row);
    render('tokens');
    expect(doc.activeElement?.name).toBe('ATH');
    const elsewhere = { name: 'search' };
    doc.activeElement = elsewhere;
    next = ['GRAM', 'ATH'].map(row);
    render('tokens');
    expect(doc.activeElement).toBe(elsewhere);
    const kept = shown[1];
    doc.activeElement = kept;
    next = shown;
    focusArgs.length = 0;
    render('tokens');
    expect([doc.activeElement, focusArgs.length]).toEqual([kept, 0]);
    expect(code(fn('function renderWalletAssets(tab) {'))).toContain("const rowsSelector = '.wallet-asset-row, .wallet-nft-tile';");
  });

  it('RLOW-08: "Show full" puts the nearest scroller back where it stood — the browser\'s scroll anchoring carried a reader at the end of a chat to the end of the message', () => {
    const scroller: any = { scrollTop: 3599, scrollHeight: 4219, clientHeight: 620, parentElement: null, writes: 0 };
    const page: any = { scrollTop: 0, scrollHeight: 800, clientHeight: 800, parentElement: null };
    scroller.parentElement = page;
    const plain: any = { scrollTop: 0, scrollHeight: 4300, clientHeight: 4219, parentElement: scroller };
    const styles = new Map<any, string>([[scroller, 'auto'], [page, 'visible'], [plain, 'visible']]);
    const bubble = new Node('bubble');
    (bubble as any).parentElement = plain;
    const bounded = lift({ document, t: (key: string) => key, expandedMessageBodies: new Set(), expandedMessageRecords: new WeakSet(), createInlineFormatRegex,
      getComputedStyle: (node: any) => ({ overflowY: styles.get(node) ?? 'visible' }) },
    [...BUDGET, EXPANDED_LINE, fn('function appendBoundedContent(container, key, build, { expanded = null } = {}) {')], 'appendBoundedContent');
    const build = (target: Node, budget: any) => {
      if (budget) { budget.take(markup(70)); target.append(new Node('cut')); return; }
      for (let i = 0; i < 3; i += 1) target.append(new Node('whole'));
    };
    const at: number[] = [];
    bounded(bubble, 'k', build, { expanded: () => at.push(scroller.scrollTop) });
    const more = bubble.children.at(-1)!;
    const insert = more.before.bind(more);
    more.before = (node: Node) => { insert(node); scroller.scrollTop = 4519; };
    more.click();
    expect(bubble.children.map((one) => one.tag)).toEqual(['whole', 'whole', 'whole']);
    expect([scroller.scrollTop, at], 'MEASURED before: 3599 -> 4519, carried to the end of the message').toEqual([3599, [3599]]);
    expect(page.scrollTop, 'the page itself is no scroller here, and is left alone').toBe(0);
  });

  it('RLOW-07 (V2-4): the incoming count\'s read in the background asks at the background class; the History tab\'s own read at the profile class', () => {
    const load = code(fn('async function loadWalletAssets(tab, { force = false, more = false, keep = false } = {}) {'));
    expect(load).toContain("const priority = keep ? 'background' : 'profile';");
    expect(load).toContain('fetchImpl: createToncenterRestFetch({ requestOptions: { priority } })');
    expect(code(fn('function checkWalletIncoming({ now = false } = {}) {'))).toContain("void loadWalletAssets('history', { force: true, keep: true });");
  });
});
