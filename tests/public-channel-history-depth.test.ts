import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// A CHANNEL'S POSTS HANG FOR A YEAR — the wiring half.
//
// [decided 2026-08-04] The era window was widened
// to a year for that promise. It was only half of one: each era shard was still read exactly ONE page deep, and
// PS_PAGE_CAP is 96 rows, so everything below a channel's newest 96 ENTRIES of an era was on chain, paid for,
// inside PS_RETENTION_POST — and unreachable by any client path. MEASURED on a real PublicShard: 260 entries in,
// 96 out, entries 0..163 invisible (tests/public-lane-read-window PL-WINDOW-03, which also proves the walk).
//
// Three things had to line up for that to be true at once, which is why no single gate caught it: the publisher
// always writes shard seq 0, readPosts anchors its page at the TAIL, and the "Show older posts" control only
// raises a RENDER cap over posts already in memory. This file gates the client side of the repair — that the
// channel a reader has OPEN actually asks for the history, and that the background pass over a whole follow list
// still does not.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const app = readFileSync('web/app.js', 'utf8');
const lane = readFileSync('web/public-lane.mjs', 'utf8');

function syncBody(): string {
  const start = app.indexOf('async function syncPublicChannelFromShards()');
  expect(start).toBeGreaterThan(-1);
  const rest = app.slice(start);
  const end = rest.indexOf('async function syncPublicChannelFromChain()');
  expect(end).toBeGreaterThan(-1);
  return rest.slice(0, end);
}

describe('CHANDEPTH — the open channel is read to its first post', () => {
  it('CHANDEPTH-01: the OPEN channel asks for backfill, every other channel keeps the one-page cost', () => {
    const body = syncBody();
    // The condition is the open channel, not "a channel" — a background pass over a follow list must not start
    // paying for a year of history per channel per 30 seconds.
    // Since the feed reads every channel's state in ONE batch, the choice is made per wallet inside that call.
    expect(body).toMatch(/const open = channel && publicChannelViewOpen && channel\.id === publicChannelViewChannelId;/);
    // The BACKFILL is the open channel's alone; the held-range mark rides EVERY channel [audit round 3] — it costs
    // no page (the walk is bounded by backfillPages, still zero for the rest) and it is what tells the lane a hide
    // may have landed below the window, which is how a hidden post reaches the feed after a reload.
    expect(body).toMatch(/\.\.\.\(open \? \{ backfillPages: PUBLIC_CHANNEL_BACKFILL_PAGES \} : \{\}\),/);
    expect(body).toMatch(/knownRange: channel \? publicChannelKnownEntryRange\(channel\.id\) : null,/);
    expect(body).toMatch(/await lane\.readChannelPostsMany\(\[\.\.\.walletOfChannel\.keys\(\)\], \{/);
  });

  it('CHANDEPTH-02: the budget is the transport\'s arithmetic, not a guess', () => {
    // 8 pages x 2 requests x TONCENTER_KEYLESS_REQUEST_SPACING_MS (1100) = 17.6s, inside one
    // PUBLIC_BACKGROUND_SYNC_MS (30_000) period on the slowest transport. If any of those three constants moves,
    // the comment above the budget is wrong and this gate says so.
    expect(app).toContain('const PUBLIC_CHANNEL_BACKFILL_PAGES = 8;');
    expect(app).toContain('const PUBLIC_BACKGROUND_SYNC_MS = 30_000;');
    const transport = readFileSync('web/ton-rpc-transport.mjs', 'utf8');
    expect(transport).toContain('const TONCENTER_KEYLESS_REQUEST_SPACING_MS = 1100;');
    const budget = app.slice(app.indexOf('// HOW DEEP THE OPEN CHANNEL IS READ'), app.indexOf('const PUBLIC_CHANNEL_BACKFILL_PAGES = 8;'));
    expect(budget, 'the budget must name the numbers it is derived from').toContain('TONCENTER_KEYLESS_REQUEST_SPACING_MS = 1100');
    expect(budget).toContain('PUBLIC_BACKGROUND_SYNC_MS');
  });

  it('CHANDEPTH-03: the mark comes from the DURABLE cache and names BOTH ends', () => {
    const start = app.indexOf('function publicChannelKnownEntryRange(');
    expect(start).toBeGreaterThan(-1);
    const range = app.slice(start, app.indexOf('\n}\n', start));
    // The lane's own snapshot dies with the tab; this reads the cache that survives a launch, so a channel walked
    // to its first post on Monday is not walked again on Tuesday.
    expect(range).toContain('publicChannelFeedCache?.[channelId]?.feed ?? publicChannelFeedCache?.[channelId]');
    expect(range).toContain('sharedPostShardCoordinates(post?.entryId)');
    // BOTH ends, because a shard can be missing entries below what is held AND above it — more than one page can
    // arrive between two passes, and a mark that only said "how deep have I been" would skip that burst forever.
    expect(range).toContain('if (entry < held.min) held.min = entry;');
    expect(range).toContain('if (entry > held.max) held.max = entry;');
    // AND THE GENERATION, because it is part of the SHARD [round 6]. In the era straddling the flip one
    // (epochTag, seq) names TWO accounts, both numbering entries from 0 — a generation-blind mark merged them
    // and the planner's `deepTop = min(walked, holds.min)` then collapsed to 0, pushing NO deep segment: the
    // other generation's whole history silently never fetched, and the cache is merge-only so it never healed.
    expect(range).toContain('${coords.epochTag}.${coords.shardSeq}.${coords.generation ?? 17}');
    expect(range).toContain('return (epochTag, seq, generation = 17) => ranges.get(`${epochTag}.${seq}.${generation}`) ?? null;');
    // And the LANE really asks with it — the call site is in a different file from the key, which is how the two
    // drifted apart in the first place.
    expect(readFileSync('web/public-lane.mjs', 'utf8'))
      .toContain('knownRange(coord.epochTag, coord.seq, coord.generation)');
  });

  it('CHANDEPTH-04: the default is still one page, and the walk stops at the caller\'s mark', () => {
    // The lane's contract, pinned from the other side: a caller that asks for nothing gets exactly what it used
    // to get, and a caller that hands over a mark is never made to re-read below it.
    expect(lane).toContain('async function readChannelPostsFromStates(channelWallet, coords, live, { backfillPages = 0, knownRange = null } = {}) {');
    expect(lane).toContain('while (budget > 0 && cursor > segment.floor) {');
    // The burst above what the caller holds is a segment of its own — see CHANDEPTH-03 for why one mark is not
    // enough — and the history below it is the walk proper.
    expect(lane).toContain('if (holds !== null && windowFrom > holds.max + 1) segments.push({ top: windowFrom, floor: holds.max + 1, anchor: oldestLt });');
    // The bodies page back WITH the rows — without this a deep page is matched against the newest 128 bodies and
    // comes back empty, which is the head/tail defect the whole read window exists to prevent.
    expect(lane).toMatch(/\.\.\.\(endLt === null \? \{ messagesByRowTime: true \} : \{ messagesEndLt: endLt \}\),/);
  });
});
