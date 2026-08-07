import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// THE COMMENT LANE, CHECKED WITH THE SAME EYE AS THE POST LANE.
//
// Owner, 2026-08-07, after the repost work: comments should be looked at too. Three things came out of that, and all
// three are shapes this session has already met on the other side of the same wall:
//
//   1. the status line announced a flat "comment published" the moment sendBoc returned — the optimistic claim the
//      post path and the private lane were both corrected for, left standing on the twin;
//   2. a post's comments were readable only as far back as ONE page (the contract caps get_page at 96 rows and the
//      read anchors at the tail), with nothing in the client able to ask for more — measured in
//      tests/public-comment-window;
//   3. "no comments yet" was inferred from the decoded COUNT, so a thread whose entries failed to decode was
//      announced as empty, and the retry branch beside it — with a comment explaining exactly that distinction —
//      could never run.
const APP = readFileSync('web/app.js', 'utf8');
const LANE = readFileSync('web/public-lane.mjs', 'utf8');

function functionBody(source: string, name: string): string {
  const start = source.indexOf(name);
  if (start < 0) return '';
  const end = source.indexOf('\n}', start);
  return source.slice(start, end < 0 ? source.length : end + 2);
}

describe('CMT — publishing a comment says what it can back up', () => {
  it('CMT-01: NO publish path may call a broadcast "published" — the completeness of the set, not two known spots', () => {
    // toncenter's 200 means QUEUED, and a wallet external whose seqno the chain has not reached is dropped outright.
    // "published" is a claim about the CHAIN; the honest word on the way back from sendBoc is "confirming".
    const offenders = [...APP.matchAll(/setPublicStatus\('([^']*published)'\)/g)]
      .map((match) => match[1])
      .filter((text) => !text.includes('confirming'));
    expect(offenders, `optimistic status: ${offenders.join(', ')}`).toEqual([]);
    // And the two that exist say it — so a rename cannot make this gate vacuous.
    expect(APP).toContain("setPublicStatus('comment published, confirming');");
    expect(APP).toContain("setPublicStatus('public published, confirming');");
  });

  it('CMT-02: "no comments yet" comes from a LIVE THREAD SHARD, not from how many decoded', () => {
    const loader = functionBody(APP, 'async function loadPublicPostCommentsFromShards(');
    expect(loader).toContain('parentExists: Number(read.shardsSeen ?? 0) > 0,');
    expect(loader, 'the count must not decide it again').not.toContain('parentExists: comments.length > 0');
    // The lane counts only ACTIVE shards: a publicly-derivable address can be touched into existence uninitialised,
    // and treating that as "somebody commented" would put the retry hint on a post nobody has ever commented on.
    const reader = functionBody(LANE, 'async readThreadComments(');
    expect(reader).toContain("if (!state || state.status !== 'active') continue;");
    expect(reader).toContain('shardsSeen += 1;');
  });
});

describe('CMT — a busy post can be read further back than one page', () => {
  it('CMT-03: the reader pages BACKWARDS, and clamps the count as well as the start', () => {
    const reader = functionBody(LANE, 'async readThreadComments(');
    expect(reader).toContain('const pageStart = paged ? Math.max(0, Number(previous.from) - PAGE_ROWS) : 0;');
    // Clamping only the start would re-read rows the caller already holds (72 of them in the measured 120-comment
    // case) on every press, and the merge would hide the waste.
    expect(reader).toContain('const pageRows = paged ? Number(previous.from) - pageStart : PAGE_ROWS;');
    // An exhausted shard must not be read again, however many times the button is pressed.
    expect(reader).toContain('if (previous && !paged) { cursors[key] = { from: 0, entryCount: Number(previous.entryCount ?? 0) }; continue; }');
    expect(reader).toContain('const hasMore = Object.values(cursors).some((cursor) => Number(cursor.from) > 0);');
  });

  it('CMT-04: the snapshot cache may only answer the NEWEST window', () => {
    // The cache holds a shard's newest page keyed by its change marker. Serving it to a paged read would hand back
    // the newest rows dressed as older ones — the "load earlier" that appends what is already on screen.
    const reader = functionBody(LANE, 'async readThreadComments(');
    expect(reader).toContain('const snapshot = paged ? null : readShardSnapshot(key, marker);');
    expect(reader).toContain('if (!paged) writeShardSnapshot(key, marker,');
    // One value shape across both readers of the shared cache.
    expect(LANE).toContain('writeShardSnapshot(key, marker, { posts: shardPosts, from: null, entryCount: null });');
  });

  it('CMT-05: the button appears only when there IS more, and adds rather than replaces', () => {
    expect(APP).toContain('if (publicPostDetailHasMoreComments) {');
    expect(APP).toContain("earlier.textContent = publicPostDetailLoadingEarlier ? t('public.loadingComments') : t('public.showEarlierComments');");
    const earlier = functionBody(APP, 'async function loadEarlierPublicPostComments(');
    // A page of older comments is an ADDITION to what is on screen; mergePublicComments dedups by entry id and
    // re-sorts by time, so an overlapping page cannot double-count.
    expect(earlier).toContain('publicPostDetailChainComments = mergePublicComments(publicPostDetailChainComments, result.comments);');
    // Re-entrancy: the button disables itself, and a result that arrives after the post was closed or reopened is
    // dropped rather than merged into whatever is on screen now.
    expect(earlier).toContain('if (!item || publicPostDetailLoadingEarlier || !publicPostDetailHasMoreComments) return;');
    expect(earlier).toContain('if (token !== publicPostDetailLoadToken || !publicPostDetailOpen) return;');
    // NOT written to the comment cache: that snapshot is the post's newest window, and a back-page written into it
    // would make the next open serve a middle slice of the thread as if it were the head.
    expect(earlier).not.toContain('writeCachedPublicComments');
  });

  it('CMT-06: cursors are session state — an open starts at the newest page', () => {
    const open = functionBody(APP, 'function openPublicPostDetail(');
    expect(open).toContain('publicPostDetailCommentCursors = null;');
    expect(open).toContain('publicPostDetailHasMoreComments = false;');
    // They describe a READ, not the post, so they must never come back from the cached snapshot.
    expect(APP).not.toMatch(/cached\?\.cursors/);
  });
});
