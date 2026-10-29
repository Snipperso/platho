import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { createInlineFormatRegex } from '../web/message-plain-text.mjs';


const app = readFileSync('web/app.js', 'utf8');
const css = readFileSync('web/styles.css', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const NL = String.fromCharCode(10);

class Node {
  tag: string; children: Node[] = []; parent: Node | null = null; className = ''; type = ''; dataset: Record<string, string> = {};
  text = ''; listeners: Record<string, (event: any) => void> = {};
  constructor(tag: string, text = '') { this.tag = tag; this.text = text; }
  get textContent() { return this.tag === '#text' ? this.text : this.children.map((one) => one.textContent).join(''); }
  set textContent(value: string) { this.children = []; this.text = value; if (this.tag !== '#text') this.children.push(new Node('#text', value)); }
  get lastChild() { return this.children.at(-1) ?? null; }
  get firstChild() { return this.children[0] ?? null; }
  get nextSibling(): Node | null { if (!this.parent) return null; const at = this.parent.children.indexOf(this); return this.parent.children[at + 1] ?? null; }
  append(...nodes: Node[]) { for (const node of nodes) this.insert(node, this.children.length); }
  insert(node: Node, at: number) {
    const moving = node.tag === '#fragment' ? [...node.children] : [node];
    if (node.tag === '#fragment') node.children = [];
    for (const one of moving) { one.parent?.children.splice(one.parent.children.indexOf(one), 1); one.parent = this; }
    this.children.splice(at, 0, ...moving);
  }
  remove() { if (this.parent) { this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; } }
  replaceWith(node: Node) { const parent = this.parent!; const at = parent.children.indexOf(this); this.remove(); parent.insert(node, at); }
  before(node: Node) { this.parent!.insert(node, this.parent!.children.indexOf(this)); }
  addEventListener(name: string, handler: (event: any) => void) { this.listeners[name] = handler; }
  click() { this.listeners.click?.({ stopPropagation: () => {} }); }
  all(): Node[] { return [this, ...this.children.flatMap((one) => one.all())]; }
}
const document = {
  createElement: (tag: string) => new Node(tag),
  createTextNode: (text: string) => new Node('#text', text),
  createDocumentFragment: () => new Node('#fragment'),
};
const lift = (env: Record<string, any>, sources: string[], exported: string) => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [...sources, `return ${exported};`].join(NL))(...names.map((n) => env[n]));
};
const BUDGET = [fn('function messagePreviewBudget() {'), 'let messagePreviewGraphemes;', app.slice(app.indexOf('const MESSAGE_PREVIEW_PIECE_REACH = '), app.indexOf(NL, app.indexOf('const MESSAGE_PREVIEW_PIECE_REACH = '))),
  fn('function messagePreviewCutPoint(str, end, allowEmpty = false) {')];
const budgetOf = lift({ createInlineFormatRegex }, BUDGET, 'messagePreviewBudget');
const handed: string[] = [];
const scope = () => {
  const expandedMessageBodies = new Set<string>();
  const expandedMessageRecords = new WeakSet<object>();
  return lift({
    document, t: (key: string) => key, expandedMessageBodies, expandedMessageRecords, createInlineFormatRegex,
    appendFormattedMessageText: (container: Node, text: string) => { handed.push(text); for (const line of text.split(NL)) container.append(new Node('div', line)); },
    buildReplyQuoteNode: () => new Node('blockquote'), drawableImageUrl: (url: string) => url, wirePublicImageLightbox: () => {},
    buildFileBlockChip: () => new Node('file'), buildSharedPostEmbed: () => new Node('embed'), publicPostDetailBody: null,
  }, [...BUDGET, fn('function blockIsAttachment(block) {'), 'const messageBodyExpanded = ' + app.slice(app.indexOf('const messageBodyExpanded = ') + 'const messageBodyExpanded = '.length, app.indexOf(NL, app.indexOf('const messageBodyExpanded = '))),
    fn('function appendBoundedContent(container, key, build, { expanded = null } = {}) {'), fn('function appendPublicItemContent(container, item, embedDepth = 0, options = {}) {')],
  '({ appendBoundedContent, appendPublicItemContent })');
};
const markup = (lines: number) => Array.from({ length: lines }, () => '- a').join(NL);

describe('a long body is built as far as it is seen', () => {
  it('BODYBUDGET-01: the budget — 1,500 characters or 24 lines, shared by an item\'s blocks; blank space is not a cut; a surrogate pair stays whole', () => {
    const short = budgetOf();
    expect(short.take('a short comment')).toBe('a short comment');
    expect(short.cut).toBe(false);
    const flood = budgetOf();
    const taken = flood.take(markup(8000));
    expect(taken.split(NL)).toHaveLength(24);
    expect(flood.cut).toBe(true);
    expect(flood.take('the next block'), 'nothing after a cut').toBe('');
    const prose = budgetOf();
    expect(prose.take('x'.repeat(32_000))).toHaveLength(1500);
    expect(prose.cut).toBe(true);
    const trailing = budgetOf();
    expect(trailing.take(`${markup(10)}${NL.repeat(500)}   `)).toBe(`${markup(10)}${NL.repeat(500)}   `);
    expect(trailing.cut, 'only blank space left out: nothing cut').toBe(false);
    const shared = budgetOf();
    expect(shared.take('y'.repeat(1000))).toHaveLength(1000);
    expect(shared.take('z'.repeat(1000))).toHaveLength(500);
    expect(shared.cut).toBe(true);
    const emoji = budgetOf();
    const cutAt = emoji.take(`${'e'.repeat(1499)}😀😀`);
    expect(cutAt).toBe('e'.repeat(1499));
    const lines = budgetOf();
    expect(lines.take(markup(24))).toBe(markup(24));
    expect(lines.cut).toBe(false);
  });

  it('BODYBUDGET-02: a 32 KB comment builds 24 lines and a "Show full"; the press builds it whole in place, once, and the next redraw builds it whole', () => {
    const { appendBoundedContent, appendPublicItemContent } = scope();
    const row = new Node('article');
    row.append(new Node('header'));
    const comment = { text: markup(8000) };
    const build = (target: Node, budget: any) => appendPublicItemContent(target, comment, 0, { budget });
    handed.length = 0;
    appendBoundedContent(row, 'e-1', build);
    row.append(new Node('reply-button'));
    expect(row.all().length, 'a bounded comment is a few dozen nodes, not eight thousand').toBeLessThan(80);
    expect(handed).toEqual([markup(24)]);
    const more = row.children.find((one) => one.tag === 'button')!;
    expect([more.className, more.textContent]).toEqual(['feed-expand-button message-show-full', 'chat.showFull']);
    expect(row.children.map((one) => one.tag)).toEqual(['header', 'div', 'button', 'reply-button']);
    expect(row.children[1].textContent.endsWith('…')).toBe(true);
    more.click();
    expect(handed.at(-1)).toBe(comment.text);
    expect(row.children.map((one) => one.tag), 'whole, where the cut one stood, before what followed it').toEqual(['header', 'div', 'reply-button']);
    expect(row.children.some((one) => one.tag === 'button')).toBe(false);
    const again = new Node('article');
    appendBoundedContent(again, 'e-1', build);
    expect(handed.at(-1), 'remembered: the next redraw builds it whole').toBe(comment.text);
    expect(again.children.some((one) => one.tag === 'button')).toBe(false);
    const small = new Node('article');
    appendBoundedContent(small, 'e-2', (target: Node, budget: any) => appendPublicItemContent(target, { text: 'hi' }, 0, { budget }));
    expect(small.children.map((one) => one.tag)).toEqual(['div']);
    const record = { text: markup(100) };
    const bubble = new Node('bubble');
    appendBoundedContent(bubble, record, (target: Node, budget: any) => appendPublicItemContent(target, record, 0, { budget }));
    bubble.children.find((one) => one.tag === 'button')!.click();
    const redrawn = new Node('bubble');
    appendBoundedContent(redrawn, record, (target: Node, budget: any) => appendPublicItemContent(target, record, 0, { budget }));
    expect(redrawn.children.some((one) => one.tag === 'button')).toBe(false);
  });

  it('BODYBUDGET-03: blocks after the cut wait for "Show full"; the budget runs across text blocks; no budget builds everything', () => {
    const { appendPublicItemContent } = scope();
    const item = { blocks: [{ type: 'text', text: markup(20) }, { type: 'text', text: markup(20) }, { type: 'image', url: 'data:image/png;base64,AA' }, { type: 'file', url: 'x' }] };
    const cut = new Node('div');
    const budget = budgetOf();
    handed.length = 0;
    appendPublicItemContent(cut, item, 0, { budget });
    expect(budget.cut).toBe(true);
    expect(handed.map((text) => text.split(NL).length)).toEqual([20, 5]);
    expect(cut.children.map((one) => one.tag)).toEqual(['div', 'div']);
    const whole = new Node('div');
    appendPublicItemContent(whole, item, 0, {});
    expect(whole.children.map((one) => one.tag)).toEqual(['div', 'div', 'img', 'file']);
    const legacy = new Node('div');
    appendPublicItemContent(legacy, { text: markup(50), imageUrl: 'data:image/png;base64,AA' }, 0, { budget: budgetOf() });
    expect(legacy.children.map((one) => one.tag), 'the picture after a cut text waits too').toEqual(['div']);
  });

  it('BODYBUDGET-04: a feed post — built to the budget under its clamp, the clamp keeps its button, and the press that opens it builds the rest first', () => {
    const calls: string[] = [];
    const observer = { observe: () => calls.push('observe'), unobserve: () => calls.push('unobserve') };
    const wire = lift({ document, t: (key: string) => key, feedPostClampObserver: observer,
      expandClampedBody: () => calls.push('expand'), collapseClampedBody: () => calls.push('collapse') }, [fn('function wireClampToggleButton(root, body, inner, expandedSet, key, renderFull = null) {')], 'wireClampToggleButton');
    const root: any = new Node('article');
    root.classList = { add: () => {}, remove: () => {}, contains: () => false };
    const expanded = new Set<string>();
    wire(root, new Node('div'), new Node('div'), expanded, 'p1', () => calls.push('renderFull'));
    expect(root.dataset.bodyCut).toBe('1');
    const toggle = root.children.find((one: Node) => one.tag === 'button');
    calls.length = 0;
    toggle.click();
    expect(calls).toEqual(['unobserve', 'renderFull', 'expand']);
    expect(root.dataset.bodyCut).toBeUndefined();
    toggle.click();
    toggle.click();
    expect(calls.filter((one) => one === 'renderFull'), 'built once').toHaveLength(1);
    const plain: any = new Node('article');
    plain.classList = root.classList;
    wire(plain, new Node('div'), new Node('div'), new Set(), 'p2');
    expect(plain.dataset.bodyCut).toBeUndefined();
    expect(code(app)).toContain("if (clippedHeight > FEED_POST_CLAMP_SLACK_PX || root.dataset.bodyCut === '1') {");
    const article = code(fn('function buildPublicFeedArticle(item, avatarUrlMemo, options = {}) {'));
    expect(article).toContain("const budget = clamped && !publicFeedExpandedPosts.has(String(item.id)) ? messagePreviewBudget() : null;");
    expect(article).toContain('budget?.cut ? () => { bodyContent.replaceChildren(...(title ? [title] : [])); fill(bodyContent, null); } : null);');
    expect(article).toContain('else appendBoundedContent(bodyContent, `post:${item.id}`, fill);');
  });

  it('BODYBUDGET-05: every surface takes it — comments, a shared post\'s copy and its snapshot, and a message bubble; the button shows', () => {
    expect(code(fn("function buildPublicCommentRow(comment, surfacing, postKey = '') {"))).toContain('appendBoundedContent(row, publicCommentExpansionKey(comment, postKey), (target, budget) => appendPublicItemContent(target, comment, 0, { budget }));');
    const embed = code(fn('function buildSharedPostEmbed('));
    expect(embed).toContain('appendBoundedContent(real, openedWithCard(`share:${shareKey}`), (target, budget) => appendPublicItemContent(target, post, embedDepth + 1, { budget }));');
    expect(embed).toContain('const shown = budget ? budget.take(block.snippet) : block.snippet;');
    const conversation = code(fn('function renderConversation() {'));
    const bubble = conversation.slice(conversation.indexOf('appendBoundedContent(bubble, message, (target, budget) => {'));
    expect(bubble.length).toBeGreaterThan(100);
    expect(bubble).toContain('const shown = budget ? budget.take(message.text) : message.text;');
    expect(bubble).toContain('if (blockIsAttachment(block)) { budget.media = true; break; }');
    expect(bubble).toContain('const shown = budget ? budget.take(block.text) : block.text;');
    expect(conversation, 'nothing appends a text block straight into the bubble any more').not.toContain('bubble.append(text);');
    expect(css).toMatch(/\.feed-expand-button\.message-show-full \{\s*display: block;\s*\}/);
  });
});
