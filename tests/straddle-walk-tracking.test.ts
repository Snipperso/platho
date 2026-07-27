import { describe, it, expect } from 'vitest';
import { hasIncompletePublicStream } from '../web/public-shard-ton-rpc-provider.mjs';

// Ф5 — BEHAVIORAL coverage for the multipart-straddle detection that keeps a shard read from silently dropping
// the tail of a multipart post.
//
// The audit's original point still stands and is the reason this file exists at all: a straddle fix guarded ONLY
// by source-string greps can be inverted (keep the literals, flip the "is this group still incomplete?" test) and
// every grep stays green while heavy users lose the tail of every message that crosses a read window.
//
// WHAT CHANGED (clean-17): the predicate no longer lives in a CapsuleHub index walk. The Hub walk is gone with
// the whole shared-log model; the shard reader (web/public-shard-ton-rpc-provider readPosts) now anchors its
// window at the shard's TAIL and extends one page backwards while a stream in the window is incomplete. The
// load-bearing predicate is `hasIncompletePublicStream`, exported for exactly this test — no source extraction
// needed any more, so the coverage got stronger, not weaker.
//
// The END-TO-END proof that the extension actually fires against a REAL PublicShard is
// tests/public-lane-read-window.test.ts (PL-WINDOW-02): a 3-part post cut by the window boundary comes back whole.
// This file covers the predicate's edges, which an e2e test cannot enumerate cheaply.

/** A post as readPosts holds it: only the header matters here, and readPublicPartHeaderInfo parses it. */
function post(streamIdByte: string, partIndex: number, partCount: number) {
  // PPH2 header layout the parser walks: magic(4) 'PPH2' | version(1) | kind(1) | reserved(2) | streamId(16) |
  // part_index(2) | part_count(2) ... — build the smallest header that parses.
  const header = new Uint8Array(28);
  header.set(new TextEncoder().encode('PPH2'), 0);
  header[4] = 2;            // PUBLIC_HEADER_VERSION_V2
  header[5] = 0;            // kind: post
  header.fill(Number.parseInt(streamIdByte, 16), 8, 24);
  header[24] = (partIndex >> 8) & 0xff;
  header[25] = partIndex & 0xff;
  header[26] = (partCount >> 8) & 0xff;
  header[27] = partCount & 0xff;
  return { header: { data: header, bitLength: header.length * 8, refs: [] } };
}

describe('PUBLIC shard read — multipart straddle detection (hasIncompletePublicStream)', () => {
  it('reports a split stream while a k-part group is missing parts, and clears once every part is seen', () => {
    expect(hasIncompletePublicStream([post('aa', 0, 3)])).toBe(true);
    expect(hasIncompletePublicStream([post('aa', 0, 3), post('aa', 1, 3)])).toBe(true);
    expect(hasIncompletePublicStream([post('aa', 0, 3), post('aa', 1, 3), post('aa', 2, 3)])).toBe(false);
  });

  it('ignores single-part posts (never forces a straddle extension for a normal post)', () => {
    expect(hasIncompletePublicStream([post('bb', 0, 1), post('cc', 0, 1)])).toBe(false);
  });

  it('deduplicates a repeated partIndex — a re-seen part does not falsely close the group', () => {
    // Pages OVERLAP when the extension clamps to entry 0, so the same part can arrive twice. Counting raw
    // arrivals instead of distinct indices would call a 2-of-3 group complete and drop the missing part.
    expect(hasIncompletePublicStream([post('dd', 0, 3), post('dd', 0, 3), post('dd', 1, 3)])).toBe(true);
  });

  it('tracks several independent streams and reports incomplete if ANY one is open', () => {
    const complete = [post('ee', 0, 2), post('ee', 1, 2)];
    const open = [post('ff', 1, 2)];
    expect(hasIncompletePublicStream(complete)).toBe(false);
    expect(hasIncompletePublicStream([...complete, ...open])).toBe(true);
  });

  it('treats an unparseable header as single-part (a foreign body can never force an endless extension)', () => {
    expect(hasIncompletePublicStream([{ header: null }, { header: { data: new Uint8Array(4), bitLength: 32, refs: [] } }])).toBe(false);
  });
});
