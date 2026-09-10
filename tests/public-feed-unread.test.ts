import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE UNREAD MARK, DRIVEN — because it was silently dead for months and nothing noticed.
//
// [audit 2026-08-31, round 7] The public feed's unread border and its "N unread" count compared a feed id as a
// BigInt. That stopped working the day the identity became the shard COMPOSITE (`epochTag.seq.entryId`, and
// since round 5 a fourth generation part): `BigInt("20800.0.5")` throws, a bare catch turned the parse failure
// into a plausible `null`, `isUnreadPublicItem` returned false on null and `markVisiblePublicFeedRead` skipped
// the row. MEASURED: no chain post was ever unread and the cursor key was never written once — a whole feature
// inert, with every test green, because the only thing that could have caught it was a test that RAN it.
//
// So this file runs the real functions, sliced out of web/app.js, over the real item shape the feed produces.
// The comparison is now the post's own chain-stamped `createdAt` — the one total order the feed already uses,
// and generation-independent, so it survives the flip untouched.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const app = readFileSync('web/app.js', 'utf8');

/** The three functions under test, lifted verbatim with a stubbed cursor store. */
function loadUnreadFunctions(cursors: Record<string, string> = {}) {
  const start = app.indexOf('function publicChannelReadAt(');
  const end = app.indexOf('// ONE LIST BY TIME.');
  expect(start, 'publicChannelReadAt must still be there').toBeGreaterThan(-1);
  expect(end, 'and the slice must end at the chronological sort').toBeGreaterThan(start);
  const markStart = app.indexOf('function markVisiblePublicFeedRead(');
  const markEnd = app.indexOf('return changed;', markStart) + 'return changed;\n}'.length;
  const source = `${app.slice(start, end)}\n${app.slice(markStart, markEnd)}`;
  // eslint-disable-next-line no-new-func
  return new Function('__cursors', `
    let publicReadCursors = __cursors;
    const writeScopedJsonMap = () => {};
    const PUBLIC_READ_CURSORS_STORAGE_KEY = 'k';
    const publicFeedItemsChronological = () => [];
    ${source}
    return { isUnreadPublicItem, markVisiblePublicFeedRead, readCursors: () => publicReadCursors };
  `)(cursors);
}

/** The leave-door cycle: hold what was painted, mark it only when the reader leaves. */
function loadLeaveCycle(cursors: Record<string, string> = {}) {
  const start = app.indexOf('function publicChannelReadAt(');
  const end = app.indexOf('// ONE LIST BY TIME.');
  const markStart = app.indexOf('function markVisiblePublicFeedRead(');
  const flushEnd = app.indexOf('  return true;\n}', app.indexOf('function flushPublicFeedRead(')) + '  return true;\n}'.length;
  expect(flushEnd, 'flushPublicFeedRead must still be there').toBeGreaterThan(markStart);
  const source = `${app.slice(start, end)}\n${app.slice(markStart, flushEnd)}`;
  // eslint-disable-next-line no-new-func
  return new Function('__cursors', `
    let publicReadCursors = __cursors;
    let renders = 0;
    const writeScopedJsonMap = () => {};
    const PUBLIC_READ_CURSORS_STORAGE_KEY = 'k';
    const publicFeedItemsChronological = () => [];
    const isPublicViewActive = () => true;
    const publicPostDetailOpen = false, publicDiscoveryOpen = false, publicChannelViewOpen = false;
    const renderPublicSurface = () => { renders += 1; };
    ${source}
    return {
      isUnreadPublicItem, holdPublicFeedPainted, flushPublicFeedRead,
      readCursors: () => publicReadCursors, renders: () => renders,
    };
  `)(cursors);
}

const post = (channelId: string, iso: string, entryId: string) =>
  ({ channelId, createdAt: iso, entryId });

describe('PUBLIC FEED UNREAD', () => {
  it('UNREAD-01: a shard post with a composite id is markable — the defect that killed the feature', () => {
    const { isUnreadPublicItem, markVisiblePublicFeedRead, readCursors } = loadUnreadFunctions();
    // The exact id shapes the feed mints: three parts for generation 17, four for 18.
    const items = [
      post('alice.ath', '2026-08-30T10:00:00.000Z', '20800.0.5'),
      post('alice.ath', '2026-08-30T12:00:00.000Z', '20800.0.6.18'),
    ];
    // No baseline yet: nothing is unread, and NOTHING FLOODS — this is what the v1→v2 key bump buys.
    expect(items.map(isUnreadPublicItem), 'an unseen channel has no unread backlog').toEqual([false, false]);
    // Reading the feed establishes the baseline at the newest post seen…
    expect(markVisiblePublicFeedRead(items), 'the mark must actually be written').toBe(true);
    expect(readCursors()['alice.ath']).toBe(String(Date.parse('2026-08-30T12:00:00.000Z')));
    // …and a LATER post is then unread, which is the whole feature.
    const fresh = post('alice.ath', '2026-08-30T13:00:00.000Z', '20800.0.7.18');
    expect(isUnreadPublicItem(fresh), 'a newer post must be unread').toBe(true);
    expect(isUnreadPublicItem(items[1]), 'and one already seen must not').toBe(false);
  });

  it('UNREAD-02: the mark is per channel, only advances, and ignores what it cannot time', () => {
    const { isUnreadPublicItem, markVisiblePublicFeedRead, readCursors } = loadUnreadFunctions();
    markVisiblePublicFeedRead([post('a.ath', '2026-08-30T10:00:00.000Z', '1.0.1')]);
    const aMark = readCursors()['a.ath'];
    // Another channel is independent — reading one must not silence the other.
    expect(isUnreadPublicItem(post('b.ath', '2026-08-30T09:00:00.000Z', '1.0.1'))).toBe(false);
    markVisiblePublicFeedRead([post('b.ath', '2026-08-30T09:00:00.000Z', '1.0.1')]);
    expect(readCursors()['a.ath'], 'the first channel keeps its own mark').toBe(aMark);
    // An OLDER post never rewinds the mark…
    expect(markVisiblePublicFeedRead([post('a.ath', '2026-08-29T10:00:00.000Z', '1.0.0')])).toBe(false);
    expect(readCursors()['a.ath']).toBe(aMark);
    // …and a post whose time cannot be parsed is not new: unknown sinks to the old end, exactly as the feed's
    // own chronological sort decides it.
    expect(isUnreadPublicItem(post('a.ath', 'not-a-date', '1.0.9'))).toBe(false);
    expect(markVisiblePublicFeedRead([post('a.ath', '', '1.0.9')])).toBe(false);
  });

  it('UNREAD-03: nothing compares a feed id as a number any more', () => {
    // The helper that made the failure look like an answer is gone, and the storage key moved with the meaning:
    // a v1 value is an entry id, and read as milliseconds it would place the mark in 1970 and flood the feed.
    const code = app.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    expect(code, 'the BigInt id parser must stay gone').not.toContain('function publicEntryIdBigInt');
    expect(code, 'and nothing may call it').not.toContain('publicEntryIdBigInt(');
    expect(app).toContain("const PUBLIC_READ_CURSORS_STORAGE_KEY = 'platho.publicReadCursors.v2';");
  });
  it('UNREAD-04: painting the feed does not clear the mark — only leaving it does', () => {
    // THE DEFECT THIS CLOSES [audit 2026-08-31, round 8]: both surfaces marked their window read INSIDE the
    // render and cleared the badges with requestAnimationFrame, which runs BEFORE that frame's style pass.
    // MEASURED in Chromium with a CSS-animation detector: 0 animations ever started on `.is-unread`, so no
    // reader could ever see the border the round-7 fix had just brought back to life, and the "N unread" count
    // read 0 on every render where the mark had run.
    const { isUnreadPublicItem, holdPublicFeedPainted, flushPublicFeedRead, readCursors, renders } =
      loadLeaveCycle({ 'alice.ath': String(Date.parse('2026-08-30T10:00:00.000Z')) });
    const fresh = post('alice.ath', '2026-08-30T12:00:00.000Z', '20800.0.6.18');
    expect(isUnreadPublicItem(fresh), 'a post newer than the mark is unread').toBe(true);

    // Painting it only REMEMBERS it: the cursor must not move, so the badge survives to be seen.
    holdPublicFeedPainted([fresh]);
    expect(readCursors()['alice.ath'], 'a render may not advance the cursor')
      .toBe(String(Date.parse('2026-08-30T10:00:00.000Z')));
    expect(isUnreadPublicItem(fresh), 'and the row stays unread while the reader is looking at it').toBe(true);
    expect(renders(), 'painting triggers no re-render of its own').toBe(0);

    // Leaving takes the mark, once.
    expect(flushPublicFeedRead(), 'the leave door advances the cursor').toBe(true);
    expect(isUnreadPublicItem(fresh), 'what was seen is now read').toBe(false);
    expect(flushPublicFeedRead(), 'a second leave with nothing painted is a no-op').toBe(false);
    expect(renders(), 'exactly one clearing re-render').toBe(1);

    // A post that arrived while away is unread on return, which is the whole point of the mark.
    expect(isUnreadPublicItem(post('alice.ath', '2026-08-30T13:00:00.000Z', '20800.0.7.18'))).toBe(true);
  });

  it('UNREAD-05: the cursor has exactly one writer, and it is the leave door', () => {
    // A render that marks is the defect; keeping it to one caller is what keeps it from creeping back into a
    // render path, where it is invisible by construction (see UNREAD-04).
    const code = app.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    const callers = code.split('markVisiblePublicFeedRead(').length - 1;
    expect(callers, 'one definition plus exactly one call, inside flushPublicFeedRead').toBe(2);
    expect(code.indexOf('markVisiblePublicFeedRead(', code.indexOf('function flushPublicFeedRead(')),
      'and that one call is inside flushPublicFeedRead').toBeGreaterThan(code.indexOf('function flushPublicFeedRead('));
    expect(code, 'no render may schedule the clearing pass from a frame callback')
      .not.toMatch(/requestAnimationFrame\(\(\) => renderPublicSurface/);
  });
  it('UNREAD-06: the badge and the gesture that clears it count the same set', () => {
    // [audit 2026-09-01, round 9.] The rule "a transient preview channel is excluded from the feed and its
    // counts" lived inline in renderPublicSurface, so the COUNT applied it and the jump-down gesture — the one
    // control whose whole job is to clear that count — did not. Round 8 dodged the mismatch by narrowing the
    // gesture to the painted window, which made it worse: MEASURED with 409 items over 10 channels at the
    // 150-item render cap, the gesture left 9 posts unread and no other gesture in the app could reach them, so
    // the badge stayed lit permanently. One definition now, used by both.
    const code = app.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    expect(code, 'the surface set must have one definition').toContain('function publicSurfaceItems()');
    // …and that definition must be the ONLY place the preview channel is filtered out, or the two drift again.
    expect(code.split('item.channelId !== publicChannelPreviewChannelId').length - 1,
      'the preview-channel filter may exist exactly once').toBe(1);
    // Both consumers go through it: the count, and the gesture.
    const surface = code.slice(code.indexOf('function renderPublicSurface'), code.indexOf('function setPublicCommentTarget'));
    expect(surface, 'the count is taken over the surface set').toContain('const surfaceItems = publicSurfaceItems();');
    expect(surface, 'and the badge counts that set').toContain('surfaceItems.filter(isUnreadPublicItem).length');
    const jump = code.slice(code.indexOf("publicJumpDownButton?.addEventListener('click'"));
    const assignAt = jump.indexOf('publicUnreadPaintedItems = publicSurfaceItems();');
    const flushAt = jump.indexOf('flushPublicFeedRead();');
    expect(assignAt, 'the gesture must take the whole surface').toBeGreaterThan(-1);
    expect(flushAt, 'and then mark it').toBeGreaterThan(-1);
    expect(assignAt, 'the set must be in hand before the flush reads it').toBeLessThan(flushAt);
  });

  it('UNREAD-07: leaving the channel view takes its mark, before the feed overwrites the holder', () => {
    // The five leave doors round 8 wired are all ways of COVERING or hiding a surface. Closing the channel view
    // is how a reader leaves the only other surface that holds a painted set, and it had no door: the close
    // re-renders the feed, whose own hold overwrites the channel's set unconditionally. So every post read inside
    // a channel view stayed unread forever — and the channel view is the only place a post outside the feed's
    // newest window can be marked at all.
    const code = app.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    const close = code.slice(code.indexOf('function closePublicChannelView'));
    const flushAt = close.indexOf('flushPublicFeedRead();');
    const dropAt = close.indexOf('publicChannelViewOpen = false;');
    expect(flushAt, 'the close must take the mark').toBeGreaterThan(-1);
    expect(dropAt, 'and it must still drop the flag').toBeGreaterThan(-1);
    // BEFORE the flag drops: flushPublicFeedRead skips its clearing re-render while an overlay is open, and the
    // close re-renders anyway — flushing after would repaint the surface twice for nothing.
    expect(flushAt, 'the mark is taken while the view is still open').toBeLessThan(dropAt);
  });
});
