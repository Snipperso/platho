import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// COMMENTS OFF MEANS OFF ON EVERY ROUTE INTO A POST.
//
// Owner, 2026-08-20, opening a real permalink: "вижу косяк. по прямой ссылке комменты открыты в посте с
// отключёнными комментами."
//
// The check existed — once, inside the feed card, which disables its Comments button. That guarded the DOOR, and
// a permalink is a second door: openPublicPostDetail was called directly and armed the comment composer without
// ever asking. Nothing on the send path asked either, so a comment written there would have gone on chain, cost
// its author money, and been invisible to every reader who came through the feed.
//
// The fix is a shared predicate plus the detail screen honouring it. These gates exist because the next route
// into a post — a notification tap, a deep link, a search result — will be written by someone who did not read
// this file, and the predicate must be the only answer available to them.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const app = readFileSync('web/app.js', 'utf8');
const css = readFileSync('web/styles.css', 'utf8');

describe('NOCOMMENT — a post with comments off is respected on every path', () => {
  it('NOCOMMENT-01: the answer lives in ONE predicate, not inlined per surface', () => {
    expect(app).toContain('function publicPostCommentsAllowed(item)');
    // Absence means allowed: posts published before the flag existed carry no bit and were commentable.
    const fn = app.slice(app.indexOf('function publicPostCommentsAllowed(item)'));
    expect(fn.slice(0, 120)).toContain("item?.commentsAllowed !== false");
    // No surface may DECIDE for itself again. Two other spellings of the comparison are legitimate and stay:
    // the normalizer that BUILDS an item from a decoded payload (`commentsAllowed: payload.… !== false`), and the
    // feed signature term (`=== false ? 'nc' : ''`), which answers "must this card repaint", not "may one comment".
    const deciders = [...app.matchAll(/\.commentsAllowed !== false/g)]
      .filter((m) => !app.slice(Math.max(0, m.index - 40), m.index).includes('commentsAllowed:'));
    expect(deciders.length, 'a surface is deciding this for itself instead of asking the predicate').toBe(1);
    // And the two screens that show comments must both go through it.
    const open = app.slice(app.indexOf('function openPublicPostDetail(item)'));
    expect(open.slice(0, open.indexOf('function closePublicPostDetail'))).toContain('publicPostCommentsAllowed(item)');
  });

  it('NOCOMMENT-02: the detail screen asks before arming the composer', () => {
    const open = app.slice(app.indexOf('function openPublicPostDetail(item)'));
    const body = open.slice(0, open.indexOf('function closePublicPostDetail'));
    expect(body).toContain('const commentsAllowed = publicPostCommentsAllowed(item);');
    // Armed only when allowed — this is the line the permalink used to reach unconditionally.
    expect(body).toContain('if (commentsAllowed) setPublicCommentTarget(item,');
    // And no chain read for comments that cannot exist: those reads are paid for.
    expect(body).toContain('if (commentsAllowed) refreshPublicPostDetailComments();');
  });

  it('NOCOMMENT-03: the composer is HIDDEN, never handed a null target on this screen', () => {
    // A null target puts the shared composer back in POST mode, and publishing from the post screen creates a new
    // entry in the READER'S channel. The app's own comment says so; the fix must not walk into it.
    const open = app.slice(app.indexOf('function openPublicPostDetail(item)'));
    const body = open.slice(0, open.indexOf('function closePublicPostDetail'));
    expect(body).not.toMatch(/setPublicCommentTarget\(\s*null/);
    expect(body).toContain("publicPane.dataset.postComments = commentsAllowed ? 'on' : 'off'");
    expect(css).toMatch(/\[data-post-open="true"\]\[data-post-comments="off"\][^{]*\.public-composer\s*\{\s*display:\s*none/);
  });

  it('NOCOMMENT-04: closing the post clears the flag, so the next post starts from "on"', () => {
    const close = app.slice(app.indexOf('function closePublicPostDetail'));
    expect(close.slice(0, 900)).toContain("publicPane.dataset.postComments = 'on'");
  });

  it('NOCOMMENT-05: the comment list is replaced by the author-closed notice, not by an invitation', () => {
    const render = app.slice(app.indexOf('function renderPublicPostDetail'));
    const section = render.slice(render.indexOf('public-detail-comments-heading'));
    expect(section.slice(0, 700)).toContain('publicPostCommentsAllowed(publicPostDetailItem)');
    expect(section.slice(0, 700)).toContain("t('public.commentsClosedByAuthor')");
    // "No comments yet. Be the first to comment." on a closed post would be an invitation to pay for nothing.
    const closedBranch = section.slice(section.indexOf('publicPostCommentsAllowed(publicPostDetailItem)'), section.indexOf('publicPostCommentsAllowed(publicPostDetailItem)') + 400);
    expect(closedBranch).not.toContain('noCommentsYet');
  });

  it('NOCOMMENT-06: the feed card now shares the predicate instead of carrying its own copy', () => {
    expect(app).toContain('const commentsAllowed = publicPostCommentsAllowed(item);');
    expect(app).toContain('const hasChainCommentTarget = publicPostHasChainCommentTarget(item);');
  });
});
