import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';


const app = readFileSync('web/app.js', 'utf8');
const lane = readFileSync('web/public-lane.mjs', 'utf8');
const lift = (env: Record<string, any>, sources: string[], exported: string, prelude = '') => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, `${prelude}\n${sources.join('\n')}\nreturn ${exported};`)(...names.map((n) => env[n]));
};

describe('the moderator\'s card, round 75', () => {
  it('MOD75-01: every verdict is confirmed in a window naming the entry, its time, its author and its first words — nothing signed before the answer; the press guard is gone [2026-10-28]', async () => {
    const dialogs: any[] = [];
    let answer: any = null;
    const env: Record<string, any> = {
      moderationContents: new Map([['k', { item: { createdAt: '2026-10-27T20:20:00Z', text: 'x' }, author: 'EQa' }]]),
      moderationRowPublishers: new Map([['k', 'EQauthor']]),
      copyTextFromContent: () => '  spam   spam\nspam ' + 'w'.repeat(120), formatMetaTimestamp: () => '27 Oct, 20:20', moderationKindLabel: () => 'Comment',
      publicAuthorLabel: (wallet: string) => `name-of-${wallet}`, t: (key: string) => key,
      openActionDialog: async (config: any) => { dialogs.push(config); return answer; },
    };
    const confirm = lift(env, [sourceBlock(app, 'function moderationVerdictSummary(row, {'), sourceBlock(app, 'async function confirmModerationVerdict(row, caption) {')], 'confirmModerationVerdict');
    const row = { rowKeyString: 'k', target: { kind: 1 } };
    expect(await confirm(row, 'Hide'), 'closed by its cross: nothing').toBe(false);
    answer = {};
    expect(await confirm(row, 'Hide')).toBe(true);
    const shown = dialogs[1];
    expect([shown.title, shown.submitLabel, shown.unprompted], 'the second tap of the one that opened it is no answer').toEqual(['Hide', 'Hide', true]);
    expect(shown.summary.map((line: any) => [line.label, line.value.slice(0, 40)])).toEqual([
      ['moderation.confirmEntry', 'Comment, 27 Oct, 20:20'], ['moderation.confirmAuthor', 'name-of-EQauthor'], ['moderation.confirmWords', 'spam spam spam wwwwwwwwwwwwwwwwwwwwwwwww']]);
    expect(shown.summary[2].value.endsWith('\u2026'), 'its first words, cut').toBe(true);
    const card = code(sourceBlock(app, 'function moderationCardNode(row, eager) {'));
    expect(card).toContain('Promise.resolve().then(() => confirmModerationVerdict(row, caption)).then((yes) => (yes ? (clearLine(), onClick()) : null))');
    expect(app).not.toContain('function moderationPressMoved(');
    expect(app).not.toContain('function noteModerationQueueMoves(');
    const draw = code(sourceBlock(app, 'function renderModerationQueue() {'));
    expect(draw).toContain('try { same?.focus({ preventScroll: true }); } catch {');
    expect(code(sourceBlock(app, 'function focusModerationQueueCard('))).toContain('target?.focus({ preventScroll: !force });');
  });

  it('MOD75-02: a landed entry verdict sets the held entry\'s mark — the card keeps its height and offers what is left at once [C9-15, C9-20]', () => {
    const verdict = code(sourceBlock(app, 'async function sendEntryVerdict(row, action) {'));
    expect(verdict, 'MEASURED before: re-read, the card shrank and grew back 3 s later, offering Hide again').not.toContain('moderationContents.delete(row.rowKeyString);');
    expect(verdict).toContain('if (held) moderationContents.set(row.rowKeyString, { ...held, hidden: wantHidden });');
    expect(verdict.indexOf('if (seen) {')).toBeGreaterThan(-1);
    expect(verdict.indexOf('if (seen) {')).toBeLessThan(verdict.indexOf('if (held) moderationContents.set('));
    expect(code(sourceBlock(app, 'function moderationCardNode(row, eager) {')), 'nothing new: no "Dismiss the reports" [C9-24]')
      .toContain("row.unreviewed > 0 ? verdictButton(t('moderation.dismiss'), () => sendReviewVerdict(row)) : null,");
  });

  it('MOD75-03: a comment in parts is drawn whole — its author\'s parts of its stream from the window after it, a stranger\'s left out [C9-17]', async () => {
    const asked: any[] = [];
    const window = [
      { entry_id: 7n, publisher: 'P', header: 'h0', body: 'b0', created_at: 1_800_000_000n },
      { entry_id: 8n, publisher: 'Q', header: 'hq', body: 'bq', created_at: 1_800_000_001n },
      { entry_id: 9n, publisher: 'P', header: 'h1', body: 'b1', created_at: 1_800_000_002n },
    ];
    const payloads: Record<string, any> = {
      h0: { type: 'document_comment', documentBytes: new Uint8Array([1]), partCount: 2, partIndex: 0, stream_id: 's1' },
      hq: { type: 'document_comment', documentBytes: new Uint8Array([9]), partCount: 2, partIndex: 1, stream_id: 's1' },
      h1: { type: 'document_comment', documentBytes: new Uint8Array([2]), partCount: 2, partIndex: 1, stream_id: 's1' },
    };
    let joined: any[] = [];
    const env: Record<string, any> = {
      directPublicLaneReader: () => ({ readEntryAt: async (q: any) => { asked.push(q); return q.following ? window : [window[0]]; } }),
      readPublicPostPayloadV2: ({ header }: any) => payloads[header], publicAuthorLabel: () => 'cash', rawWalletAddress: (a: string) => a, publicAddrKey: (a: string) => a,
      publicAllFeedChannelId: (a: string) => `all:${a}`, moderationRowPublishers: new Map(), moderationTargetPost: async () => { throw new Error('not a post'); },
      assemblePublicParts: (parts: any[]) => { joined = parts; return [{ streamId: 's1', bytes: parts.map((part) => part.documentBytes[0]) }]; },
    };
    const content = lift(env, [sourceBlock(app, 'async function moderationEntryContent(row) {')], 'moderationEntryContent');
    const read = await content({ rowKeyString: 'k', target: { kind: 1, generation: 18, epochTag: 1, entryId: 7 }, partitionKey: 1 });
    expect(asked.map((q) => [q.window, q.following === true, q.requestClass])).toEqual([[undefined, false, 'focus'], [8, true, 'focus']]);
    expect(joined.map((part) => [part.partIndex, part.documentBytes[0], part.authorWallet, part.channelId]), 'MEASURED before: "Preview unavailable"')
      .toEqual([[0, 1, 'P', 'all:P'], [1, 2, 'P', 'all:P']]);
    expect(read.item.bytes).toEqual([1, 2]);
    expect(lane).toContain('return following ? posts.filter((post) => BigInt(post.entry_id) >= BigInt(entryId)) : posts.filter((post) => BigInt(post.entry_id) === BigInt(entryId));');
  });

  it('MOD75-04: a card\'s read waits a 429 out and is asked again; a failed read is never kept; a post in parts read at the queue\'s class, kept nowhere [C9-2, C9-19]', () => {
    expect(lane).toContain('...(wait ? { skipIfRateLimited: false, rateLimitRetries: 2 } : {})');
    expect(lane).toContain("const readers = requestClass ? readersOf(requestClass, { wait: true }) : LANE_READERS;\n      const seq = Number(channelShardSeq) || 0;");
    const target = code(sourceBlock(app, 'async function moderationTargetPost(row, entry = null) {'));
    expect(target).toContain("return fetchPermalinkPostFromChain(composite, read.publisher, { keep: false, requestClass: 'focus', adoptClaims: false, adoptProfiles: false });");
    expect(target, 'a failed read throws — it is not "nothing there"').not.toContain('.catch(');
    const card = code(sourceBlock(app, 'function moderationCardNode(row, eager) {'));
    expect(card, 'MEASURED before: "Preview unavailable" for the queue\'s life').toContain('if (attempt < 4) setTimeout(() => { if (card.isConnected && !moderationQueueDialog?.hidden) load(attempt + 1); }, 4_000 * (attempt + 1));');
    expect(card).toContain('reading = moderationEntryContent(row).then((content) => { moderationContents.set(key, content); return content; })');
    expect(code(sourceBlock(app, 'function paintModerationCardPost(post, content) {')))
      .toContain('appendBoundedContent(body, `moderation:${item.id}`, (target, budget) => appendPublicItemContent(target, item, 0, { budget, keepSharedOriginals: false }));');
  });

  it('MOD75-05: a verdict\'s own question waits for no other window in front and takes no press in its first moments; a press taken back clears no line [round 79 — C9-37, C9-41]', async () => {
    const opened: any[] = [];
    const waits: Array<() => void> = [];
    const api = lift({
      delay: () => new Promise<void>((resolve) => { waits.push(resolve); }),
      openActionDialog: async (config: any) => { opened.push(config); return {}; },
    }, [sourceBlock(app, 'async function askModerationQuestion(config) {')],
    '{ ask: askModerationQuestion, close() { activeActionDialog = null; } }',
    "let activeActionDialog = { title: 'another card' }; const queueTitle = { title: 'queue' }; let moderationQueueDialog = { hidden: false, contains: () => false, querySelector: (s) => (s === '#moderationQueueTitle' ? queueTitle : null) };"
      + " let viewer = { picture: true }; let front = moderationQueueDialog; const dialogReturnFocusTarget = () => null;"
      + ' const modalInFront = () => front; globalThis.__mod75 = { picture() { front = viewer; }, pictureClosed() { front = moderationQueueDialog; } };');
    const asking = api.ask({ title: 'A third warning restricts' });
    await Promise.resolve();
    expect(opened, 'MEASURED before: it took the place of the other card\'s confirmation, which was dropped').toEqual([]);
    (globalThis as any).__mod75.picture();
    api.close();
    waits.shift()?.();
    for (let n = 0; n < 20 && !waits.length && !opened.length; n += 1) await Promise.resolve();
    expect(opened, 'MEASURED before: opened under the picture, which passed every tap to it — a restricting Warn sent unseen').toEqual([]);
    expect(waits.length, 'waiting again, behind the picture').toBe(1);
    (globalThis as any).__mod75.pictureClosed();
    waits.shift()?.();
    await asking;
    delete (globalThis as any).__mod75;
    expect(opened[0].returnFocus, 'MEASURED before: <body>').toEqual({ title: 'queue' });
    expect(code(sourceBlock(app, 'async function askModerationQuestion(config) {'))).toContain('await delay(50);');
    expect(opened.map((config) => [config.title, config.unprompted]), 'a tap meant for the window before it is no answer').toEqual([['A third warning restricts', true]]);
    const wallet = code(sourceBlock(app, 'async function sendWalletVerdict(row, action) {'));
    expect((wallet.match(/await askModerationQuestion\(\{/g) ?? []).length, 'both questions').toBe(2);
    expect(wallet).not.toContain('await openActionDialog(');
    expect((wallet.match(/summary: moderationVerdictSummary\(row, \{ words: false \}\)/g) ?? []).length).toBe(2);
    const opening = code(sourceBlock(app, 'async function openActionDialog(config = {}) {'));
    expect(opening.indexOf('closeImageLightbox();')).toBeGreaterThan(opening.indexOf('if (activeActionDialog) closeActionDialog(null);'));
    expect(opening.indexOf('closeImageLightbox();')).toBeLessThan(opening.indexOf('return new Promise((resolve) => {'));
  });
});
