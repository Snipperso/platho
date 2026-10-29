import { describe, expect, it } from 'vitest';
import { reconcileKeyedRows } from '../web/keyed-rows.mjs';

class FakeNode {
  dataset: Record<string, string> = {};
  parent: FakeParent | null = null;
  label: string;
  constructor(label = '') { this.label = label; }
  get nextSibling(): FakeNode | null {
    if (!this.parent) return null;
    const i = this.parent.kids.indexOf(this);
    return i >= 0 ? this.parent.kids[i + 1] ?? null : null;
  }
  remove() {
    if (!this.parent) return;
    const i = this.parent.kids.indexOf(this);
    if (i >= 0) this.parent.kids.splice(i, 1);
    this.parent = null;
  }
}

class FakeParent {
  kids: FakeNode[] = [];
  get children(): FakeNode[] { return this.kids.slice(); }
  get firstChild(): FakeNode | null { return this.kids[0] ?? null; }
  append(node: FakeNode) { this.insertBefore(node, null); }
  insertBefore(node: FakeNode, anchor: FakeNode | null) {
    if (node.parent === this) {
      const at = this.kids.indexOf(node);
      if (at >= 0) this.kids.splice(at, 1);
    }
    const index = anchor ? this.kids.indexOf(anchor) : -1;
    if (anchor && index < 0) throw new Error('insertBefore: anchor is not a child');
    if (index < 0) this.kids.push(node); else this.kids.splice(index, 0, node);
    node.parent = this;
  }
  keys(): string[] { return this.kids.map((k) => k.dataset.rowKey); }
}

type Row = { key: string; sig: string; label?: string };

function entriesFor(rows: Row[], built: string[], adopted: string[] = []) {
  return rows.map((row) => ({
    key: row.key,
    sig: row.sig,
    build: () => { built.push(row.key); return new FakeNode(row.label ?? row.key); },
    adopt: (node: FakeNode) => { adopted.push(`${row.key}:${node.label}`); },
  }));
}

describe('keyed row reconciliation', () => {
  it('KEYROW-01: an unchanged list builds nothing the second time — this is the whole point', () => {
    const parent = new FakeParent();
    const rows: Row[] = Array.from({ length: 500 }, (_, i) => ({ key: `k${i}`, sig: `s${i}` }));
    const first: string[] = [];
    const firstPass = reconcileKeyedRows(parent, entriesFor(rows, first));
    expect(firstPass).toMatchObject({ built: 500, reused: 0, added: 500, dropped: 0, moved: 0 });
    const second: string[] = [];
    const secondPass = reconcileKeyedRows(parent, entriesFor(rows, second));
    expect(second, 'not one row may be rebuilt').toEqual([]);
    expect(secondPass).toMatchObject({ built: 0, reused: 500, added: 0, dropped: 0, moved: 0 });
    expect(parent.kids.length).toBe(500);
  });

  it('KEYROW-02: a page of new rows costs the page, not the list', () => {
    const parent = new FakeParent();
    const page1: Row[] = Array.from({ length: 96 }, (_, i) => ({ key: `k${i}`, sig: `s${i}` }));
    reconcileKeyedRows(parent, entriesFor(page1, []));
    const page2 = [...page1, ...Array.from({ length: 96 }, (_, i) => ({ key: `k${96 + i}`, sig: `s${96 + i}` }))];
    const built: string[] = [];
    const result = reconcileKeyedRows(parent, entriesFor(page2, built));
    expect(result.built).toBe(96);
    expect(result.reused).toBe(96);
    expect(built[0]).toBe('k96');
    expect(parent.keys()).toEqual(page2.map((r) => r.key));
  });

  it('KEYROW-03: rows PREPENDED at the top reuse everything below them, in the right order', () => {
    const parent = new FakeParent();
    const older: Row[] = ['b', 'c', 'd'].map((k) => ({ key: k, sig: `s${k}` }));
    reconcileKeyedRows(parent, entriesFor(older, []));
    const withNew: Row[] = ['a', ...['b', 'c', 'd']].map((k) => ({ key: k, sig: `s${k}` }));
    const built: string[] = [];
    const result = reconcileKeyedRows(parent, entriesFor(withNew, built));
    expect(built).toEqual(['a']);
    expect(result.reused).toBe(3);
    expect(parent.keys()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('KEYROW-04: a changed signature rebuilds that ONE row and leaves it in place', () => {
    const parent = new FakeParent();
    const rows: Row[] = ['a', 'b', 'c'].map((k) => ({ key: k, sig: `s${k}` }));
    reconcileKeyedRows(parent, entriesFor(rows, []));
    const changed = rows.map((r) => (r.key === 'b' ? { ...r, sig: 'sb-sent' } : r));
    const built: string[] = [];
    const result = reconcileKeyedRows(parent, entriesFor(changed, built));
    expect(built).toEqual(['b']);
    expect(result).toMatchObject({ built: 1, reused: 2, added: 0, dropped: 0, moved: 0 });
    expect(parent.keys()).toEqual(['a', 'b', 'c']);
    expect(parent.kids.length).toBe(3);
  });

  it('KEYROW-04b: an in-place rebuild is NOT a change of shape — added/dropped/moved all stay zero', () => {
    const parent = new FakeParent();
    const rows: Row[] = ['a', 'b', 'c'].map((k) => ({ key: k, sig: `s${k}` }));
    reconcileKeyedRows(parent, entriesFor(rows, []));
    const ticked = rows.map((r) => (r.key === 'b' ? { ...r, sig: 'sb-sent' } : r));
    const result = reconcileKeyedRows(parent, entriesFor(ticked, []));
    expect(result.added + result.dropped + result.moved, 'shape unchanged').toBe(0);
    expect(result.built, 'but the row really was rebuilt').toBe(1);
    const grown = [...ticked, { key: 'd', sig: 'sd' }];
    const arrival = reconcileKeyedRows(parent, entriesFor(grown, []));
    expect(arrival.added).toBe(1);
  });

  it('KEYROW-05: rows that disappeared are removed, including a whole emptied list', () => {
    const parent = new FakeParent();
    reconcileKeyedRows(parent, entriesFor(['a', 'b', 'c'].map((k) => ({ key: k, sig: k })), []));
    const result = reconcileKeyedRows(parent, entriesFor([{ key: 'b', sig: 'b' }], []));
    expect(parent.keys()).toEqual(['b']);
    expect(result.dropped).toBe(2);
    expect(reconcileKeyedRows(parent, []).dropped).toBe(1);
    expect(parent.kids.length).toBe(0);
  });

  it('KEYROW-06: a reordered list moves nodes and rebuilds none', () => {
    const parent = new FakeParent();
    const rows: Row[] = ['a', 'b', 'c', 'd'].map((k) => ({ key: k, sig: k }));
    reconcileKeyedRows(parent, entriesFor(rows, []));
    const shuffled: Row[] = ['d', 'a', 'c', 'b'].map((k) => ({ key: k, sig: k }));
    const built: string[] = [];
    const result = reconcileKeyedRows(parent, entriesFor(shuffled, built));
    expect(built).toEqual([]);
    expect(result.built).toBe(0);
    expect(parent.keys()).toEqual(['d', 'a', 'c', 'b']);
  });

  it('KEYROW-07: `adopt` re-points a reused row at the CURRENT object', () => {
    const parent = new FakeParent();
    reconcileKeyedRows(parent, entriesFor([{ key: 'a', sig: 's' }], []));
    const adopted: string[] = [];
    reconcileKeyedRows(parent, entriesFor([{ key: 'a', sig: 's' }], [], adopted));
    expect(adopted).toEqual(['a:a']);
    const adoptedAfterRebuild: string[] = [];
    reconcileKeyedRows(parent, entriesFor([{ key: 'a', sig: 's2' }], [], adoptedAfterRebuild));
    expect(adoptedAfterRebuild).toEqual([]);
  });

  it('KEYROW-08: debris from an earlier render heals — unkeyed nodes and duplicates are swept', () => {
    const parent = new FakeParent();
    const stray = new FakeNode('stray');
    parent.append(stray);
    const dupA = new FakeNode('dup');
    dupA.dataset.rowKey = 'a'; dupA.dataset.sig = 'a';
    const dupB = new FakeNode('dup');
    dupB.dataset.rowKey = 'a'; dupB.dataset.sig = 'a';
    parent.append(dupA); parent.append(dupB);
    const built: string[] = [];
    reconcileKeyedRows(parent, entriesFor([{ key: 'a', sig: 'a' }], built));
    expect(built, 'the surviving duplicate is reused, not rebuilt').toEqual([]);
    expect(parent.kids.length).toBe(1);
    expect(parent.kids[0]).toBe(dupA);
  });

  it('KEYROW-09: a duplicate KEY in the entries cannot make one node flicker between two objects', () => {
    const parent = new FakeParent();
    const built: string[] = [];
    const result = reconcileKeyedRows(parent, entriesFor(
      [{ key: 'a', sig: 's' }, { key: 'a', sig: 'other' }, { key: 'b', sig: 's' }],
      built,
    ));
    expect(built).toEqual(['a', 'b']);
    expect(result.built).toBe(2);
    expect(parent.keys()).toEqual(['a', 'b']);
  });

  it('KEYROW-10: an entry whose build() declines leaves no hole and no phantom reuse', () => {
    const parent = new FakeParent();
    const entries = [
      { key: 'a', sig: 's', build: () => new FakeNode('a') },
      { key: 'skip', sig: 's', build: () => null },
      { key: 'b', sig: 's', build: () => new FakeNode('b') },
    ];
    const result = reconcileKeyedRows(parent, entries);
    expect(parent.keys()).toEqual(['a', 'b']);
    expect(result).toMatchObject({ built: 2, reused: 0, added: 2, dropped: 0 });
    const second = reconcileKeyedRows(parent, [
      { key: 'a', sig: 's', build: () => new FakeNode('a') },
      { key: 'skip', sig: 's', build: () => new FakeNode('skip') },
      { key: 'b', sig: 's', build: () => new FakeNode('b') },
    ]);
    expect(second.built).toBe(1);
    expect(parent.keys()).toEqual(['a', 'skip', 'b']);
  });

  it('KEYROW-11: the PATCH policy — a constant signature plus `adopt` refreshes a row without ever rebuilding it', () => {
    const parent = new FakeParent();
    const patches: string[] = [];
    const rowsFor = (tick: number) => ['a', 'b'].map((k) => ({
      key: k,
      sig: 'row',
      build: () => new FakeNode(k),
      adopt: (node: FakeNode) => { patches.push(`${k}@${tick}:${node.label}`); },
    }));
    reconcileKeyedRows(parent, rowsFor(1));
    const [nodeA, nodeB] = parent.kids;
    expect(patches, 'a freshly built row is not adopted — build() already filled it').toEqual([]);
    reconcileKeyedRows(parent, rowsFor(2));
    reconcileKeyedRows(parent, rowsFor(3));
    expect(patches).toEqual(['a@2:a', 'b@2:b', 'a@3:a', 'b@3:b']);
    expect(parent.kids[0], 'the very same nodes, twice refreshed').toBe(nodeA);
    expect(parent.kids[1]).toBe(nodeB);
  });

  it('KEYROW-12: an empty or absent container is not an error', () => {
    expect(reconcileKeyedRows(null, [{ key: 'a', sig: 's', build: () => new FakeNode('a') }]))
      .toMatchObject({ built: 0, reused: 0, added: 0, dropped: 0 });
    expect(reconcileKeyedRows(new FakeParent(), [])).toMatchObject({ built: 0, reused: 0, added: 0, dropped: 0 });
  });
});
