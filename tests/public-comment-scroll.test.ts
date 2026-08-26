import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// YOUR OWN COMMENT MUST BE ON SCREEN AFTER YOU SEND IT.
//
// Owner, 2026-08-13: "неплохо было бы скроллить окошко в публичной ветке, когда я пишу публичный комментарий к
// посту. Сейчас новый коммент появляется под композером."
//
// Comments append to the bottom of the thread and the scroll position stayed where it was, so the one comment the
// author is certain to want to see — the one they just wrote — landed below the fold, behind the composer.
//
// Two ways a "scroll to the newest" flag goes wrong, both pinned here:
//
//   1. IT SCROLLS THE WRONG SCREEN. Armed at submit and consumed on a timer, it would fire against whatever post is
//      open by then — including a different one the user navigated to while the publish was in flight.
//   2. IT FIRES BEFORE LAYOUT. scrollHeight is not final on the tick the row is appended, and an image inside the
//      comment grows the list several frames later, putting the row straight back under the fold.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const app = readFileSync('web/app.js', 'utf8');

const scroller = app.slice(
  app.indexOf('function scrollPublicPostDetailToLatest()'),
  app.indexOf('// Warm the durable comment cache'),
);

describe('public comment scroll-into-view', () => {
  it('CMTSCROLL-01: publishing a COMMENT arms the jump, publishing a post does not', () => {
    const handler = app.slice(
      app.indexOf("publicComposer?.addEventListener('submit'"),
      app.indexOf("composer?.addEventListener('submit'", app.indexOf("publicComposer?.addEventListener('submit'")),
    );
    expect(handler.length, 'the handler slice must not collapse').toBeGreaterThan(1000);
    // Armed BEFORE the publish: the optimistic row is painted while that await is still running, so arming after it
    // would miss the very render it exists for.
    expect(handler).toMatch(/if \(publicPostDetailOpen\) publicPostDetailScrollToLatest = true;\s*await enqueueOutgoingPublish\(\(\) => submitPublicCommentDirect\(/);
    // A public POST does not appear in this thread at all; jumping the open post detail to its end would move the
    // reader away from what they were looking at for no reason.
    const postBranch = handler.slice(handler.indexOf('} else {'));
    expect(postBranch, 'a post must not scroll the post detail').not.toMatch(/publicPostDetailScrollToLatest/);
  });

  it('CMTSCROLL-02: the RENDER consumes it, so whichever paint wins does the scrolling', () => {
    // The optimistic row and the chain-confirmed one that replaces it are two different renders, and which arrives
    // first depends on the network. The submit handler cannot know; the render does.
    const render = app.slice(app.indexOf('function renderPublicPostDetail()'), app.indexOf('function scrollPublicPostDetailToLatest()'));
    expect(render).toMatch(/if \(publicPostDetailScrollToLatest\) \{\s*publicPostDetailScrollToLatest = false;\s*scrollPublicPostDetailToLatest\(\);\s*\}/);
    // Consumed ONCE — left standing, it would yank the thread to the bottom on every later background re-render,
    // fighting a reader who has scrolled up to read the earlier replies.
    expect(
      (app.match(/publicPostDetailScrollToLatest = false/g) ?? []).length,
      'the declaration, plus cleared on consume, on open and on close',
    ).toBe(4);
  });

  it('CMTSCROLL-03: it cannot survive into a DIFFERENT post', () => {
    // Opening a post starts at the top — the post itself is what was tapped. A flag armed by a comment on the
    // previous post must not turn that into a jump to the bottom of this one.
    const open = app.slice(app.indexOf('function openPublicPostDetail('), app.indexOf('function closePublicPostDetail('));
    expect(open).toMatch(/publicPostDetailScrollToLatest = false;/);
    expect(open).toMatch(/renderPublicPostDetail\(\);\s*if \(publicPostDetailBody\) publicPostDetailBody\.scrollTop = 0;/);
    // Between the two now sits the RETURNING reader's case [OWNER 2026-08-23]: a thread this reader has been in
    // before reopens where they stopped. Armed here, applied by the render that first has rows to place them
    // against; a first visit has no mark and keeps the plain top, post first.
    expect(open).toMatch(/publicPostDetailOpenScrollPending = publicCommentReadCursor\(publicPostIdentity\(item\)\) !== null;/);
    const close = app.slice(app.indexOf('function closePublicPostDetail('), app.indexOf('// --- Newcomer discovery panel'));
    expect(close).toContain('publicPostDetailScrollToLatest = false;');
  });

  it('CMTREAD-01: a comment thread reads OLDEST FIRST, and reopens where the reader stopped', () => {
    // [OWNER 2026-08-23: "the developer made our comments backwards — fresh on top, then older load. That's mad.
    // Old comments should come first … people could be replying to each other, reading it in reverse is perverse.
    // But if I read down to some comment, coming back into that thread I want to be at the last comment I read."]
    //
    // A feed is a list of unrelated posts, where the freshest matters most; a comment thread is a CONVERSATION,
    // where a reply means nothing before the comment it answers. So the thread renders in chain order, and both
    // its paging directions invert with it.
    const render = app.slice(app.indexOf('function renderPublicPostDetail()'), app.indexOf('function scrollPublicPostDetailToLatest()'));
    expect(render, 'no reversal — mergePublicComments already returns oldest-first').not.toMatch(/comments\.slice\(\)\.reverse\(\)/);
    expect(render).toMatch(/appendPublicItemComments\(section, \{ comments \}, keptCommentList\)/);
    // OLDER pages in at the TOP, NEWER at the BOTTOM — the reverse of the newest-first layout.
    const earlierAt = render.indexOf("buildCommentsLoadSentinel('earlier')");
    const listAt = render.indexOf('appendPublicItemComments(section');
    const newerAt = render.indexOf("buildCommentsLoadSentinel('newer')");
    expect(earlierAt).toBeGreaterThan(0);
    expect(earlierAt, 'older above the thread').toBeLessThan(listAt);
    expect(newerAt, 'newer below it').toBeGreaterThan(listAt);
    // ...and the scroll handler that arms them inverts too, or the sentinels would page the wrong way.
    const handler = app.slice(app.indexOf("publicPostDetailBody?.addEventListener('scroll'"), app.indexOf('let stripScrollCheckQueued'));
    expect(handler.length, 'the handler slice must not collapse').toBeGreaterThan(300);
    expect(handler).toMatch(/if \(body\.scrollTop < 320 && publicPostDetailHasMoreComments\) \{\s*\n\s*loadEarlierPublicPostComments\(\);/);
    expect(handler).toMatch(/clientHeight < 320 && publicPostDetailNewerCursor\) \{\s*\n\s*loadNewerPublicPostComments\(\);/);

    // THE READING MARK: the newest comment that has actually been on screen, never the newest that exists (which
    // would mark a thread read the instant it loaded). Only ever moves forward — scrolling back up un-reads nothing.
    const remember = app.slice(app.indexOf('function rememberPublicPostReadPosition()'), app.indexOf('function applyPublicPostDetailOpenScroll()'));
    expect(remember.length, 'the slice must not collapse').toBeGreaterThan(400);
    // BY POSITION, NOT BY COMPARING IDS. Measured on a live thread: a comment's chain entry id is a `c-` prefix
    // followed by a hash of the body — not a number, and ordered by nothing. "Newer" is therefore a question about
    // the DISPLAYED order, so the mark is a row key and progress is an index in that order.
    expect(remember).toMatch(/if \(rows\[i\]\.getBoundingClientRect\(\)\.top > viewportBottom\) break;/);
    expect(remember).toMatch(/if \(seenIndex <= markIndex\) return;/);
    expect(remember, 'a mark we cannot locate is never overwritten by a guess').toMatch(/if \(mark !== null && markIndex < 0\) return;/);
    expect(remember, 'never an id comparison').not.toMatch(/publicEntryIdBigInt/);
    expect(remember).toMatch(/writeScopedJsonMap\(PUBLIC_COMMENT_READ_CURSORS_STORAGE_KEY, publicCommentReadCursors\);/);
    // It is written from the thread's own scroll handler, so reading marks itself with no extra listener.
    expect(handler).toMatch(/rememberPublicPostReadPosition\(\);/);

    // AND THE RETURN: the same anchor rule as a private dialog, through the same function — not a second copy.
    const openScroll = app.slice(app.indexOf('function applyPublicPostDetailOpenScroll()'), app.indexOf('function isUnreadPublicItem'));
    expect(openScroll).toMatch(/anchorScrollerToFirstUnread\(body, firstUnread,/);
    expect(openScroll, 'a thread opened and read to the end stays read').toMatch(/rememberPublicPostReadPosition\(\);/);
    expect(openScroll, 'the first unread is simply the row after the marked one').toMatch(/rows\[markIndex \+ 1\] \?\? null/);
  });

  it('CMTREAD-04: a mark DEEPER than the tail window reopens AT the mark, through the same jump', () => {
    // [OWNER 2026-08-26: "доведи, чтобы было как положено"] — the follow-through on CMTREAD-03. A reader who
    // left mid-thread has a mark outside the newest window; the old fallback landed them at the end. The mark
    // now rides with its PLACE — era shard + 0-based row, which the row index alone cannot say because
    // entry_ids restart per era shard — and the open jumps the window machinery straight to it.
    const app = readFileSync('web/app.js', 'utf8');
    // The place is stamped at the source: the lane names each post\u0027s home shard, the converter carries it
    // onto the comment (JSON-safe — comments persist to IndexedDB), and the assembler\u0027s ...first spread
    // keeps a multipart comment on its first row.
    const lane = readFileSync('web/public-lane.mjs', 'utf8');
    expect(lane).toMatch(/shardPosts\.map\(\(post\) => \(\{ \.\.\.post, shard_key: key \}\)\)/);
    expect(lane, 'served snapshots gain the stamp too').toMatch(/post\.shard_key \? post : \{ \.\.\.post, shard_key: key \}/);
    expect(app).toMatch(/shardKey: tp\.shard_key \?\? null,/);
    expect(app).toMatch(/shardRow: tp\.entry_id === undefined \|\| tp\.entry_id === null \? null : Number\(tp\.entry_id\),/);
    // The stored cursor is the mark PLUS its place; a bare string (saved before places existed) still answers
    // "which comment" and keeps the old honest end-fallback.
    expect(app).toMatch(/function publicCommentReadPlace\(postKey\)/);
    expect(app).toMatch(/\[postKey\]: place \? \{ mark: markKey, \.\.\.place \} : markKey/);
    // The open jumps only when the mark is NOT already in the tail window, and only with a place to jump to.
    expect(app).toMatch(/openMark !== null\s*\n\s*&& !publicPostDetailChainComments\.some\(\(comment\) => publicCommentRowKey\(comment\) === openMark\)/);
    expect(app).toMatch(/if \(openPlace\) await jumpPublicPostDetailToPlace\(item, publicPostDetailCommentCursors \?\? \{\}, openPlace\);/);
    // Both directions from the landing window: eras BEFORE the target page above from their own tails, eras
    // AFTER it are exhausted for the older sentinel — their rows belong to the newer pager.
    expect(app).toMatch(/from: index < shardIdx \? shard\.entryCount : \(index === shardIdx \? windowStart : 0\)/);
  });
  it('CMTREAD-03: a thread seen for the FIRST time opens at its FIRST comment and pages toward the present', () => {
    // [OWNER 2026-08-26: "I opened comments from a new profile and landed in the LAST batch, though I see the
    // thread for the first time and should see the comments from the very first."] The tail default anchors
    // every window at the newest rows — right for a reader with a mark, wrong for a first visit: a conversation
    // is read from its beginning. The fix re-points the FIRST clean load of an unread deep thread at row 0 of
    // the OLDEST era shard and hands the reader to the forward pager the date jump already owned — which until
    // now had NO seeder at all: publicPostDetailNewerCursor was only ever assigned inside the pager itself, so
    // the "newer" sentinel was unreachable, a documented mechanism that never ran.
    expect(app).toMatch(/async function jumpPublicPostDetailToPlace/);
    // Hooked AFTER the clean tail branch (cache, retirement and cursors are exactly what a tail open produces),
    // and ONLY for a never-read thread deeper than its window — one that fits needs nothing, its first row is
    // already the first comment.
    expect(app).toMatch(/if \(openMark === null && publicPostDetailHasMoreComments\) \{/);
    // Once per open: the forward pager finishes with a clean tail refresh, which must not re-seed another trip.
    expect(app).toMatch(/if \(publicPostDetailHeadSeeded\) return false;/);
    expect(app).toMatch(/publicPostDetailHeadSeeded = false;/);
    // The seeder walks the cursors OLDEST-first (the lane inserts newest-era-first), reads the [0, PAGE) window
    // through the SAME window reader the jump uses, REPLACES the tail window, arms the forward pager, and turns
    // the older sentinel off — nothing is older than the first comment.
    expect(app).toMatch(/Object\.entries\(cursors \?\? \{\}\)\.reverse\(\)/);
    expect(app).toMatch(/readPublicCommentWindow\(item, cursors, target\.key, endRow, null\)/);
    expect(app).toMatch(/publicPostDetailNewerCursor = atTail \? null : \{ shards: entries, shardIdx, from: endRow \};/);
    // Honest failure: a start that cannot be reached leaves the tail window standing.
    expect(app).toMatch(/if \(!result \|\| result\.degraded\) return false;/);
    // And the bodies of a deep window are aimed by the ROWS OWN TIME: a synthesized cursor has no lt, and the
    // old fallback aimed /messages at the newest window — the wrong END of the shard for row 0.
    const lane = readFileSync('web/public-lane.mjs', 'utf8');
    expect(lane).toMatch(/paged && previousOldestLt === null \? \{ messagesByRowTime: true \}/);
    const provider = readFileSync('web/public-shard-ton-rpc-provider.mjs', 'utf8');
    expect(provider).toMatch(/messagesByRowTime = false/);
    expect(provider).toMatch(/startUtime: Math\.max\(0, Number\(minAt\) - 600\)/);
  });

  it('CMTREAD-02: a page arriving above the reader must not move the reader — including at the very top', () => {
    // [OWNER 2026-08-24: "I scrolled up, comments started loading, a page appeared, filled the screen and
    // immediately loaded another one. I'd like the position not to jump like that — for older comments to load
    // above, and to be able to scroll up calmly to the next load."]
    //
    // The anchor existed but was skipped at scrollTop 0 — a leftover from the newest-first layout, where the top
    // held the FRESHEST comments and a reader sitting at 0 wanted to be shown what had just arrived. Reading runs
    // oldest-first now, so the top is the PAST, and 0 is exactly where scrolling back through history lands you.
    // MEASURED in the harness, prepending 96 rows onto a reader at 0: without the snapshot the reader moves from
    // their own row to the first row of the NEW page and stays at scrollTop 0 — inside the 320px trigger band, so
    // the next page fires at once, and the next. With it, the reader keeps their row at scrollTop 7680.
    const render = app.slice(app.indexOf('function renderPublicPostDetail()'), app.indexOf('function scrollPublicPostDetailToLatest()'));
    expect(render.length, 'the slice really spans the render').toBeGreaterThan(2000);
    expect(render, 'the snapshot is unconditional — a scrollTop test is what caused the cascade')
      .not.toMatch(/if \(publicPostDetailBody\.scrollTop > 0/);
    expect(render).toMatch(/let detailScrollAnchor = null;\s*\n\s*\{\s*\n\s*const bodyRect = publicPostDetailBody\.getBoundingClientRect\(\);/);
    expect(render).toMatch(/detailScrollAnchor = \{ id: row\.dataset\.entryId, offset: rect\.top - bodyRect\.top \};/);
    // Restored by shifting the scroller by exactly how far the anchored row moved.
    expect(render).toMatch(/const delta = \(row\.getBoundingClientRect\(\)\.top - publicPostDetailBody\.getBoundingClientRect\(\)\.top\)\s*\n\s*- detailScrollAnchor\.offset;/);
    expect(render).toMatch(/if \(delta !== 0\) publicPostDetailBody\.scrollTop \+= delta;/);
    // AND HELD AS THE PICTURES ARRIVE: a prepended page is measured before its images decode, so each one grows the
    // content above the reader a second time, after the anchor was already restored — the same jump, arriving late.
    expect(render).toMatch(/holdAnchor\(\);/);
    expect(render).toMatch(/for \(const image of publicPostDetailBody\.querySelectorAll\('img'\)\) \{\s*\n\s*if \(image\.complete\) continue;\s*\n\s*image\.addEventListener\('load', holdAnchor, \{ once: true \}\);/);
    expect(render, 'a failed image resolves the wait too, or the page settles short').toMatch(/image\.addEventListener\('error', holdAnchor, \{ once: true \}\);/);
  });

  it('CMTSCROLL-04: it scrolls AFTER layout, and again once late images settle', () => {
    expect(scroller.length, 'the scroller slice must not collapse').toBeGreaterThan(200);
    // Layout is not final on the tick the row is appended. Comments read OLDEST FIRST again [OWNER 2026-08-23:
    // "reading it in reverse is perverse"], so the freshest comment is the LAST row and "latest" is the end.
    expect(scroller).toMatch(/requestAnimationFrame\(toLatest\);/);
    expect(scroller).toContain('body.scrollTop = body.scrollHeight;');
    // An image above the section (the post card) finishes loading a few frames later and shifts the section under
    // the scroll position. Already-complete images are skipped, so this costs nothing on a text-only thread.
    expect(scroller).toContain('if (image.complete) continue;');
    expect(scroller).toMatch(/image\.addEventListener\('load', toLatest, \{ once: true \}\);/);
    // A broken image resolves the wait too — otherwise a failed load leaves the section short of where it will settle.
    expect(scroller).toMatch(/image\.addEventListener\('error', toLatest, \{ once: true \}\);/);
  });
});
