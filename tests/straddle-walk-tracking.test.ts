import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Ф5 — BEHAVIORAL coverage for the multipart-straddle detection that keeps a feed/index walk from silently
// dropping the tail of a multipart message.
//
// The audit flagged that the v649/v650 straddle fix (a walk whose window cap lands in the MIDDLE of a k-part group
// must keep extending until the group closes, and must NOT advance its catch-up cursor past an unclosed group) was
// guarded ONLY by source-string greps: a refactor that keeps the grepped literals but inverts the "is this group
// still incomplete?" test would drop the straddling message's tail parts on every heavy user whose chats/feeds
// exceed one walk window — silent, permanent message/media loss — while all straddle greps stay green.
//
// The load-bearing primitive is the incomplete-group predicate the walk loops on:
//   PUBLIC  walkPublicChainIds: noteWalkedHeader(entry) + hasSplitPartStream()   (partStreams Map<streamId,…>)
//   PRIVATE walkIndexedRole:    rolePartGroupsIncomplete(role)                    (privatePartGroups Map<key,…>)
// Both are closures inside the async walk (not importable), so this test EXTRACTS their real source from web/app.js
// and runs it with injected state. It exercises the SHIPPED detection logic — invert the "< partCount" comparison
// (or drop the hasIndexedPart gate) in app.js and the relevant assertion below goes red, unlike a grep.

const appJsPath = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'web', 'app.js');
const source = readFileSync(appJsPath, 'utf8');

// Extract a `const NAME = (args) => { ... }` closure from source with balanced-brace matching over the arrow body.
function extractArrowConst(name: string): string {
  const marker = `const ${name} =`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`app.js: const ${name} not found`);
  const arrow = source.indexOf('=>', start);
  if (arrow < 0) throw new Error(`app.js: const ${name} is not an arrow function`);
  let i = source.indexOf('{', arrow);
  if (i < 0) throw new Error(`app.js: const ${name} has no body brace`);
  let depth = 0;
  for (; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return `${source.slice(start, i + 1)};`;
    }
  }
  throw new Error(`app.js: const ${name} braces unbalanced`);
}

describe('PUBLIC feed walk — multipart straddle detection (hasSplitPartStream / noteWalkedHeader)', () => {
  // Assemble the two real closures over an injected partStreams Map and a controllable header parser.
  const factory = new Function(
    'partStreams',
    'readPublicPartHeaderInfo',
    `${extractArrowConst('noteWalkedHeader')}
     ${extractArrowConst('hasSplitPartStream')}
     return { noteWalkedHeader, hasSplitPartStream };`,
  );

  function makeWalk() {
    const partStreams = new Map();
    // The real noteWalkedHeader calls readPublicPartHeaderInfo(entry.header_boc); the test puts the {streamId,
    // partIndex, partCount} info object directly on header_boc, so the stub is identity.
    const api = factory(partStreams, (x: any) => x ?? null);
    return { partStreams, ...(api as { noteWalkedHeader: (e: any) => void; hasSplitPartStream: () => boolean }) };
  }
  const part = (streamId: number, partIndex: number, partCount: number) => ({ header_boc: { streamId, partIndex, partCount } });

  it('reports a split stream while a k-part group is missing parts, and clears once every part is seen', () => {
    const w = makeWalk();
    // A window that walked only parts 0 and 1 of a 3-part post straddles the boundary — MUST report incomplete.
    w.noteWalkedHeader(part(42, 0, 3));
    w.noteWalkedHeader(part(42, 1, 3));
    expect(w.hasSplitPartStream()).toBe(true);
    // The extension walk reaches part 2 — the group closes and the walk may stop extending.
    w.noteWalkedHeader(part(42, 2, 3));
    expect(w.hasSplitPartStream()).toBe(false);
  });

  it('ignores single-part posts (never forces a straddle extension for a normal post)', () => {
    const w = makeWalk();
    w.noteWalkedHeader(part(7, 0, 1));
    expect(w.hasSplitPartStream()).toBe(false);
    expect(w.partStreams.size).toBe(0); // partCount<=1 is not tracked at all
  });

  it('deduplicates a repeated partIndex — a re-seen part does not falsely close the group', () => {
    const w = makeWalk();
    w.noteWalkedHeader(part(9, 0, 3));
    w.noteWalkedHeader(part(9, 0, 3)); // same part index twice
    w.noteWalkedHeader(part(9, 1, 3));
    // Two DISTINCT indices of three -> still incomplete (a Set-based seen count, not a raw counter).
    expect(w.hasSplitPartStream()).toBe(true);
  });

  it('tracks several independent streams and reports incomplete if ANY one is open', () => {
    const w = makeWalk();
    w.noteWalkedHeader(part(1, 0, 2));
    w.noteWalkedHeader(part(1, 1, 2)); // stream 1 complete
    w.noteWalkedHeader(part(2, 0, 2)); // stream 2 still open
    expect(w.hasSplitPartStream()).toBe(true);
  });
});

describe('PRIVATE index walk — multipart straddle detection (rolePartGroupsIncomplete)', () => {
  const factory = new Function(
    'privatePartGroups',
    'ownRuntimeWalletRaw',
    `${extractArrowConst('rolePartGroupsIncomplete')}
     return rolePartGroupsIncomplete;`,
  );

  function makeDetector(groups: Map<string, any>, ownRaw: string | null = null) {
    return factory(groups, () => ownRaw) as (role: string) => boolean;
  }
  const group = (partIndices: number[], partCount: number, hasIndexedPart = true) => ({
    partCount,
    hasIndexedPart,
    parts: partIndices.map((partIndex) => ({ opened: { payload: { partIndex } } })),
  });

  it('reports this role incomplete while its group is missing parts, and clears once all parts arrive', () => {
    const groups = new Map<string, any>([['recipient:peerX:s1', group([0, 1], 3)]]);
    const detect = makeDetector(groups);
    expect(detect('recipient')).toBe(true);
    groups.set('recipient:peerX:s1', group([0, 1, 2], 3));
    expect(detect('recipient')).toBe(false);
  });

  it('only extends the walk of the role that owns the group (a sender-role group does not extend the recipient walk)', () => {
    const groups = new Map<string, any>([['sender:peerX:s1', group([0], 2)]]);
    const detect = makeDetector(groups);
    expect(detect('recipient')).toBe(false); // wrong role -> not this walk's job
    expect(detect('sender')).toBe(true);
  });

  it('a self (Saved-messages) group is closable from EITHER role walk (v652 self-group fix)', () => {
    const own = 'ownwalletraw';
    const groups = new Map<string, any>([[`sender:${own}:s1`, group([0], 2)]]);
    const detect = makeDetector(groups, own);
    // The group key is sender-role, but its peer identity is the own wallet -> either walk admits it.
    expect(detect('recipient')).toBe(true);
    expect(detect('sender')).toBe(true);
  });

  it('never triggers a straddle extension for a history-retry-only group (hasIndexedPart false)', () => {
    const groups = new Map<string, any>([['recipient:peerX:s1', group([0], 3, false)]]);
    const detect = makeDetector(groups);
    // hasIndexedPart false: extending the index walk cannot close it, so it must NOT report incomplete.
    expect(detect('recipient')).toBe(false);
  });

  it('deduplicates repeated part indices in a private group (Set-based unique count, not raw length)', () => {
    const groups = new Map<string, any>([['recipient:peerX:s1', group([0, 0, 1], 3)]]);
    const detect = makeDetector(groups);
    expect(detect('recipient')).toBe(true); // 2 distinct of 3, despite 3 part entries
  });
});
