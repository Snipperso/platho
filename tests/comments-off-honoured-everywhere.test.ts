import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';


const app = readFileSync('web/app.js', 'utf8');
const css = readFileSync('web/styles.css', 'utf8');

describe('NOCOMMENT — a post with comments off is respected on every path', () => {
  it('NOCOMMENT-01: the answer lives in ONE predicate, not inlined per surface', () => {
    expect(app).toContain('function publicPostCommentsAllowed(item)');
    const fn = app.slice(app.indexOf('function publicPostCommentsAllowed(item)'));
    expect(fn.slice(0, 120)).toContain("item?.commentsAllowed !== false");
    const deciders = [...app.matchAll(/\.commentsAllowed !== false/g)]
      .filter((m) => !app.slice(Math.max(0, m.index - 40), m.index).includes('commentsAllowed:'));
    expect(deciders.length, 'a surface is deciding this for itself instead of asking the predicate').toBe(1);
    const open = app.slice(app.indexOf('function openPublicPostDetail(item)'));
    expect(open.slice(0, open.indexOf('function closePublicPostDetail'))).toContain('publicPostCommentsAllowed(item)');
  });

  it('NOCOMMENT-02: the detail screen asks before arming the composer', () => {
    const open = app.slice(app.indexOf('function openPublicPostDetail(item)'));
    const body = open.slice(0, open.indexOf('function closePublicPostDetail'));
    expect(body).toContain('const commentsAllowed = publicPostCommentsAllowed(item);');
    expect(body).toContain('if (commentsAllowed) setPublicCommentTarget(item,');
    expect(body).toContain('if (commentsAllowed) refreshPublicPostDetailComments();');
  });

  it('NOCOMMENT-03: the composer is HIDDEN, never handed a null target on this screen', () => {
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
    const closedBranch = section.slice(section.indexOf('publicPostCommentsAllowed(publicPostDetailItem)'), section.indexOf('publicPostCommentsAllowed(publicPostDetailItem)') + 400);
    expect(closedBranch).not.toContain('noCommentsYet');
  });

  it('NOCOMMENT-06: the feed card now shares the predicate instead of carrying its own copy', () => {
    expect(app).toContain('const commentsAllowed = publicPostCommentsAllowed(item);');
    expect(app).toContain('const hasChainCommentTarget = publicPostHasChainCommentTarget(item);');
  });
});
