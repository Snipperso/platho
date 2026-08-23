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
    expect(open).toMatch(/publicPostDetailScrollToLatest = false;\s*renderPublicPostDetail\(\);\s*if \(publicPostDetailBody\) publicPostDetailBody\.scrollTop = 0;/);
    const close = app.slice(app.indexOf('function closePublicPostDetail('), app.indexOf('// --- Newcomer discovery panel'));
    expect(close).toContain('publicPostDetailScrollToLatest = false;');
  });

  it('CMTSCROLL-04: it scrolls AFTER layout, and again once late images settle', () => {
    expect(scroller.length, 'the scroller slice must not collapse').toBeGreaterThan(200);
    // Layout is not final on the tick the row is appended. (2026-08 redesign: comments are NEWEST FIRST, so "latest"
    // is the comments section's start under the heading, not the scroller's bottom — toLatest, not toBottom.)
    expect(scroller).toMatch(/requestAnimationFrame\(toLatest\);/);
    expect(scroller).toContain("const section = body.querySelector('.public-detail-comments');");
    // An image above the section (the post card) finishes loading a few frames later and shifts the section under
    // the scroll position. Already-complete images are skipped, so this costs nothing on a text-only thread.
    expect(scroller).toContain('if (image.complete) continue;');
    expect(scroller).toMatch(/image\.addEventListener\('load', toLatest, \{ once: true \}\);/);
    // A broken image resolves the wait too — otherwise a failed load leaves the section short of where it will settle.
    expect(scroller).toMatch(/image\.addEventListener\('error', toLatest, \{ once: true \}\);/);
  });
});
