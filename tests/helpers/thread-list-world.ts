import { readFileSync } from 'node:fs';
import { reconcileKeyedRows } from '../../web/keyed-rows.mjs';
import { sourceBlock } from './source';

const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const lift = (env: Record<string, any>, sources: string[], exported: string, prelude = '') => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [prelude, ...sources, `return ${exported};`].join(String.fromCharCode(10)))(...names.map((n) => env[n]));
};

export const dom = () => {
  const doc: any = { body: { id: 'body' }, activeElement: null, hidden: false };
  doc.activeElement = doc.body;
  class Node {
    dataset: Record<string, string> = {}; parent: any = null; style: Record<string, string> = {}; className = ''; label: string;
    constructor(label: string) { this.label = label; }
    get offsetHeight() { return doc.hidden ? 0 : 64; }
    get isConnected() { return Boolean(this.parent); }
    get nextSibling() { if (!this.parent) return null; const i = this.parent.kids.indexOf(this); return this.parent.kids[i + 1] ?? null; }
    remove() { if (!this.parent) return; this.parent.kids.splice(this.parent.kids.indexOf(this), 1); this.parent = null; if (doc.activeElement === this) doc.activeElement = doc.body; }
    focus() { doc.activeElement = this; }
    closest() { return this.dataset.rowKey ? this : null; }
    setAttribute() {}
    get boxHeight() { return doc.hidden ? 0 : (this.style.height ? parseFloat(this.style.height) : 64); }
    getBoundingClientRect() {
      if (!this.parent || doc.hidden) return { top: 0, bottom: 0 };
      let y = 0;
      for (const kid of this.parent.kids) { if (kid === this) break; y += kid.boxHeight + 3; }
      const top = y - this.parent.scrollTop;
      return { top, bottom: top + this.boxHeight };
    }
  }
  doc.createElement = (tag: string) => new Node(tag);
  const list: any = {
    kids: [] as any[], scrollTop: 0, listeners: [] as any[], dataset: {} as Record<string, string>,
    get clientHeight() { return doc.hidden ? 0 : 900; },
    getClientRects() { return doc.hidden ? [] : [{}]; },
    get children() { return this.kids.slice(); },
    get firstChild() { return this.kids[0] ?? null; },
    insertBefore(node: any, anchor: any) {
      if (node.parent === this) { this.kids.splice(this.kids.indexOf(node), 1); if (doc.activeElement === node) doc.activeElement = doc.body; }
      const index = anchor ? this.kids.indexOf(anchor) : -1;
      if (index < 0) this.kids.push(node); else this.kids.splice(index, 0, node);
      node.parent = this;
    },
    append(node: any) { this.insertBefore(node, null); },
    contains(node: any) { return this.kids.includes(node); },
    querySelector(selector: string) {
      if (selector.includes('spacer:above')) return this.kids.find((k: any) => k.dataset.rowKey === 'spacer:above') ?? null;
      if (selector === '.thread-item') return this.kids.find((k: any) => k.className === 'thread-item') ?? null;
      if (selector.includes('thread:')) return this.kids.find((k: any) => k.label.startsWith('thread:')) ?? null;
      return this.kids.find((k: any) => k.label === 'cta') ?? null;
    },
    addEventListener(type: string, listener: any) { this.listeners.push([type, listener]); },
    getBoundingClientRect() { return { top: 0, bottom: 900 }; },
    focus() { doc.activeElement = this; },
    attrs: {} as Record<string, string>,
    getAttribute(name: string) { return this.attrs[name] ?? null; },
    setAttribute(name: string, value: string) { this.attrs[name] = String(value); },
  };
  return { doc, list, Node };
};
export const world = (count: number) => {
  const { doc, list, Node } = dom();
  const ordered = Array.from({ length: count }, (_, i) => ({ id: `t${i}` }));
  const env: any = {
    document: doc, threadList: list, reconcileKeyedRows, getComputedStyle: () => ({ rowGap: '3px' }), requestAnimationFrame: () => 0,
    buildThreadRow: (id: string) => { const node = new Node(`thread:${id}`); node.className = 'thread-item'; return node; },
    applyThreadRow: () => {}, patchThreadRow: () => {}, patchThreadRowNow: () => {}, threadRowNearObserver: () => null, sweepStaleThreadRows: {},
    renderThreadsNow: { head: [{ key: 'cta', sig: 'cta', build: () => new Node('cta'), adopt: () => {} }], ordered },
    isChatsViewActive: () => true, renderThreads: () => {}, ResizeObserver: undefined,
    t: (key: string, params: any) => `${key}:${params?.count ?? ''}`,
  };
  const api = lift(env, [fn('function threadListWindow(count) {'), fn('function threadListSpacer(key, height = 0) {'), fn('function threadListLaidOut() {'),
    fn('function watchThreadListShown() {'), fn('function drawThreadListRows() {')],
  '{ draw: drawThreadListRows, owes: () => threadListOwesDraw, pitch: () => threadListWindow.pitch, spacer: threadListSpacer }', 'let threadListOwesDraw = false;');
  return { ...api, list, doc, ordered, setOrder: (next: any[]) => { env.renderThreadsNow.ordered = next; } };
};
export const keys = (list: any) => list.kids.map((k: any) => k.dataset.rowKey);
