import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';


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
    expect(handler).toMatch(/if \(publicPostDetailOpen\) publicPostDetailScrollToLatest = true;\s*await enqueueOutgoingPublish\(\(\) => submitPublicCommentDirect\(/);
    const postBranch = handler.slice(handler.indexOf('} else {'));
    expect(postBranch, 'a post must not scroll the post detail').not.toMatch(/publicPostDetailScrollToLatest/);
  });

  it('CMTSCROLL-02: the RENDER consumes it, so whichever paint wins does the scrolling', () => {
    const render = app.slice(app.indexOf('function renderPublicPostDetail()'), app.indexOf('function scrollPublicPostDetailToLatest()'));
    expect(render).toMatch(/if \(publicPostDetailScrollToLatest\) \{\s*publicPostDetailScrollToLatest = false;\s*scrollPublicPostDetailToLatest\(\);\s*\}/);
    expect(
      (app.match(/publicPostDetailScrollToLatest = false/g) ?? []).length,
      'the declaration, plus cleared on consume, on open and on close',
    ).toBe(4);
  });

  it('CMTSCROLL-03: it cannot survive into a DIFFERENT post', () => {
    const open = app.slice(app.indexOf('function openPublicPostDetail('), app.indexOf('function closePublicPostDetail('));
    expect(open).toMatch(/publicPostDetailScrollToLatest = false;/);
    expect(open).toMatch(/renderPublicPostDetail\(\);\s*if \(publicPostDetailBody\) publicPostDetailBody\.scrollTop = 0;/);
    expect(open).toMatch(/publicPostDetailOpenScrollPending = publicCommentReadCursor\(publicPostIdentity\(item\)\) !== null;/);
    const close = app.slice(app.indexOf('function closePublicPostDetail('), app.indexOf('// --- The All section ---'));
    expect(close).toContain('publicPostDetailScrollToLatest = false;');
  });

  it('CMTREAD-01: a comment thread reads OLDEST FIRST, and reopens where the reader stopped', () => {
    const render = app.slice(app.indexOf('function renderPublicPostDetail()'), app.indexOf('function scrollPublicPostDetailToLatest()'));
    expect(render, 'no reversal — mergePublicComments already returns oldest-first').not.toMatch(/comments\.slice\(\)\.reverse\(\)/);
    expect(render).toMatch(/appendPublicItemComments\(section, \{ comments, id: publicPostDetailItem\?\.id \}, keptCommentList\)/);
    const earlierAt = render.indexOf("buildCommentsLoadSentinel('earlier')");
    const listAt = render.indexOf('appendPublicItemComments(section');
    const newerAt = render.indexOf("buildCommentsLoadSentinel('newer')");
    expect(earlierAt).toBeGreaterThan(0);
    expect(earlierAt, 'older above the thread').toBeLessThan(listAt);
    expect(newerAt, 'newer below it').toBeGreaterThan(listAt);
    const handler = app.slice(app.indexOf("publicPostDetailBody?.addEventListener('scroll'"), app.indexOf('let stripScrollCheckQueued'));
    expect(handler.length, 'the handler slice must not collapse').toBeGreaterThan(300);
    expect(handler).toMatch(/if \(body\.scrollTop < 320 && publicPostDetailHasMoreComments\) \{\s*\n\s*loadEarlierPublicPostComments\(\);/);
    expect(handler).toMatch(/clientHeight < 320 && publicPostDetailNewerCursor\) \{\s*\n\s*loadNewerPublicPostComments\(\);/);

    const remember = app.slice(app.indexOf('function rememberPublicPostReadPosition()'), app.indexOf('function applyPublicPostDetailOpenScroll()'));
    expect(remember.length, 'the slice must not collapse').toBeGreaterThan(400);
    expect(remember).toMatch(/if \(rows\[i\]\.getBoundingClientRect\(\)\.top > viewportBottom\) break;/);
    expect(remember).toMatch(/if \(seenIndex <= markIndex\) return;/);
    expect(remember, 'a mark we cannot locate is never overwritten by a guess').toMatch(/if \(mark !== null && markIndex < 0\) return;/);
    expect(remember, 'never an id comparison').not.toMatch(/publicEntryIdBigInt/);
    expect(remember).toMatch(/writeScopedJsonMap\(PUBLIC_COMMENT_READ_CURSORS_STORAGE_KEY, publicCommentReadCursors\);/);
    expect(handler).toMatch(/rememberPublicPostReadPosition\(\);/);

    const openScroll = app.slice(app.indexOf('function applyPublicPostDetailOpenScroll()'), app.indexOf('function isUnreadPublicItem'));
    expect(openScroll).toMatch(/anchorScrollerToFirstUnread\(body, firstUnread,/);
    expect(openScroll, 'a thread opened and read to the end stays read').toMatch(/rememberPublicPostReadPosition\(\);/);
    expect(openScroll, 'the first unread is simply the row after the marked one').toMatch(/rows\[markIndex \+ 1\] \?\? null/);
  });

  it('CMTREAD-04: a mark DEEPER than the tail window reopens AT the mark, through the same jump', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const lane = readFileSync('web/public-lane.mjs', 'utf8');
    expect(lane).toMatch(/shardPosts\.map\(\(post\) => \(\{ \.\.\.post, \.\.\.where, shard_key: key \}\)\)/);
    expect(lane, 'served snapshots gain the stamp too').toMatch(/post\.shard_key && post\.thread_pk \? post : \{ \.\.\.post, \.\.\.where, shard_key: key \}/);
    expect(app).toMatch(/shardKey: tp\.shard_key \?\? null,/);
    expect(app).toMatch(/shardRow: tp\.entry_id === undefined \|\| tp\.entry_id === null \? null : Number\(tp\.entry_id\),/);
    expect(app).toMatch(/function publicCommentReadPlace\(postKey\)/);
    expect(app).toMatch(/withCommentReadCursor\(publicCommentReadCursors, postKey, place \? \{ mark: markKey, \.\.\.place \} : markKey\)/);
    expect(app).toMatch(/openMark !== null\s*\n\s*&& !publicPostDetailChainComments\.some\(\(comment\) => publicCommentRowKey\(comment\) === openMark\)/);
    expect(app).toMatch(/if \(openPlace\) await jumpPublicPostDetailToPlace\(item, publicPostDetailCommentCursors \?\? \{\}, openPlace\);/);
    expect(app).toMatch(/from: index < shardIdx \? shard\.entryCount : \(index === shardIdx \? windowStart : 0\)/);
  });
  it('CMTREAD-03: a thread seen for the FIRST time opens at its FIRST comment and pages toward the present', () => {
    expect(app).toMatch(/async function jumpPublicPostDetailToPlace/);
    expect(app).toMatch(/if \(openMark === null && publicPostDetailHasMoreComments\) \{/);
    expect(app).toMatch(/if \(publicPostDetailHeadSeeded\) return false;/);
    expect(app).toMatch(/publicPostDetailHeadSeeded = false;/);
    expect(app).toMatch(/Object\.entries\(cursors \?\? \{\}\)\.reverse\(\)/);
    expect(app).toMatch(/readPublicCommentWindow\(item, cursors, target\.key, endRow, null\)/);
    expect(app).toMatch(/publicPostDetailNewerCursor = atTail \? null : \{ shards: entries, shardIdx, from: endRow \};/);
    expect(app).toMatch(/if \(!result \|\| result\.degraded\) return false;/);
    const lane = readFileSync('web/public-lane.mjs', 'utf8');
    expect(lane).toMatch(/paged && previousOldestLt === null \? \{ messagesByRowTime: true \}/);
    const provider = readFileSync('web/public-shard-ton-rpc-provider.mjs', 'utf8');
    expect(provider).toMatch(/messagesByRowTime = false/);
    expect(provider).toMatch(/startUtime: Math\.max\(0, Number\(minAt\) - 600\)/);
  });

  it('CMTREAD-02: a page arriving above the reader must not move the reader — including at the very top', () => {
    const render = app.slice(app.indexOf('function renderPublicPostDetail()'), app.indexOf('function scrollPublicPostDetailToLatest()'));
    expect(render.length, 'the slice really spans the render').toBeGreaterThan(2000);
    expect(render, 'the snapshot is unconditional — a scrollTop test is what caused the cascade')
      .not.toMatch(/if \(publicPostDetailBody\.scrollTop > 0/);
    expect(render).toMatch(/let detailScrollAnchor = null;\s*\n\s*\{\s*\n\s*const bodyRect = publicPostDetailBody\.getBoundingClientRect\(\);/);
    expect(render).toMatch(/detailScrollAnchor = \{ id: row\.dataset\.entryId, offset: rect\.top - bodyRect\.top \};/);
    expect(render).toMatch(/const delta = \(row\.getBoundingClientRect\(\)\.top - publicPostDetailBody\.getBoundingClientRect\(\)\.top\)\s*\n\s*- detailScrollAnchor\.offset;/);
    expect(render).toMatch(/if \(delta !== 0\) publicPostDetailBody\.scrollTop \+= delta;/);
    expect(render).toMatch(/holdAnchor\(\);/);
    expect(render).toMatch(/for \(const image of publicPostDetailBody\.querySelectorAll\('img'\)\) \{\s*\n\s*if \(image\.complete\) continue;\s*\n\s*image\.addEventListener\('load', holdAnchor, \{ once: true \}\);/);
    expect(render, 'a failed image resolves the wait too, or the page settles short').toMatch(/image\.addEventListener\('error', holdAnchor, \{ once: true \}\);/);
  });

  it('CMTSCROLL-04: it scrolls AFTER layout, and again once late images settle', () => {
    expect(scroller.length, 'the scroller slice must not collapse').toBeGreaterThan(200);
    expect(scroller).toMatch(/requestAnimationFrame\(toLatest\);/);
    expect(scroller).toContain('body.scrollTop = body.scrollHeight;');
    expect(scroller).toContain('if (image.complete) continue;');
    expect(scroller).toMatch(/image\.addEventListener\('load', toLatest, \{ once: true \}\);/);
    expect(scroller).toMatch(/image\.addEventListener\('error', toLatest, \{ once: true \}\);/);
  });
});
