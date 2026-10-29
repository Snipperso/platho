import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';


const app = readFileSync('web/app.js', 'utf8');
const store = readFileSync('web/encrypted-message-store.mjs', 'utf8');

const between = (text: string, start: string, end: string) => {
  const from = text.indexOf(start);
  const to = text.indexOf(end, from + 1);
  if (from < 0 || to < 0) throw new Error(`anchors not found: ${start} .. ${end}`);
  return text.slice(from, to);
};

const functionSource = (text: string, name: string) => {
  const at = text.indexOf(`function ${name}(`);
  if (at < 0) throw new Error(`${name} not found in web/app.js`);
  let depth = 0;
  for (let i = text.indexOf('{', at); i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') { depth -= 1; if (depth === 0) return text.slice(at, i + 1); }
  }
  throw new Error(`unbalanced braces after ${name}`);
};

describe('private history loads a window, not everything', () => {
  it('HISTWIN-01: retention is per conversation, pruned per conversation', () => {
    expect(store).toMatch(/export const DEFAULT_MESSAGE_HISTORY_MAX_PER_THREAD = \d+;/);
    expect(store, 'the old global cap must not come back').not.toMatch(/DEFAULT_MESSAGE_HISTORY_MAX_RECORDS/);
    expect(store).toMatch(/function pruneInTransaction\(store, indexName, maxPerThread, range\)/);
    expect(store).toMatch(/const counting = index\.count\(range\);/);
    expect(store).toMatch(/await pruneInTransaction\(store, ORDER_INDEX, maxPerThread, range\(tag\)\);\n      await transactionDone\(tx\);/);
  });

  it('HISTWIN-02: boot reads one summary row per conversation and then one window each', () => {
    expect(app).toMatch(/const PRIVATE_HISTORY_WINDOW = 96;/);
    expect(app).toMatch(/encryptedMessageStore\.listThreadSummaries\(\)/);
    expect(app, 'the whole-store header read is off the boot path').not.toMatch(/encryptedMessageStore\.listMessageHeaders/);
    expect(app).toMatch(/limit: PRIVATE_HISTORY_WINDOW/);
    expect(app).toMatch(/const summaries = typeof encryptedMessageStore\.listThreadSummaries === 'function'[\s\S]{0,120}: null;/);
    expect(app).toMatch(/const result = summaries[\s\S]{0,60}await restoreHistoryWindows\(summaries, paint, \{ firstScreen: PRIVATE_HISTORY_FIRST_SCREEN,/);
    expect(app).toMatch(/restoreHistoryWindows\(summaries, paint, [\s\S]{0,400}listMessagesDetailed\(\)/);
  });

  it('HISTWIN-02B: the conversation on screen is unsealed first, and lands before the rest are done', () => {
    const from = app.indexOf('async function restoreHistoryWindows(');
    const to = app.indexOf('async function restoreEncryptedMessageHistory(', from);
    expect(from, 'restoreHistoryWindows is gone or renamed').toBeGreaterThan(0);
    expect(to).toBeGreaterThan(from);
    const windows = app.slice(from, to);
    expect(windows, 'the open conversation jumps the queue').toContain('if (a === activeThreadId) return -1;');
    expect(windows, 'and the rest go newest-first').toContain('return (newest.get(b) ?? 0) - (newest.get(a) ?? 0);');
    expect(windows, 'each page is handed over as it lands').toContain('await onPage(page.messages ?? [], { firstScreen: firstScreenPage });');
    expect(app).toContain('function applyRestoredHistoryItems(items, { applied = null, eagerFaces = false } = {}) {');
    expect(app).toContain('if (applyRestoredHistoryItems(restored, { applied })) changed = true;');
  });

  it('HISTWIN-07: the preview reader survives what the history writer actually stores', () => {
    expect(app, 'the writer still stores null for a message with no blocks')
      .toMatch(/function messageBlocksForHistory\(message\) \{[\s\S]{0,160}return null;/);
    const source = functionSource(app, 'messagePreviewFromBlocks');
    // eslint-disable-next-line no-new-func
    const build = new Function('messagePreviewText', 'tPlural', 't', `${source}; return messagePreviewFromBlocks;`);
    const read = build((text: string) => String(text), (key: string, count: number) => `${key}:${count}`, (key: string) => key);
    expect(read(null), 'a stored null must read as no preview, not as a crash').toBe('');
    expect(read(undefined)).toBe('');
    expect(read([{ type: 'text', text: 'hello' }])).toBe('hello');
  });

  it('HISTWIN-10: one capsule is one bubble, and the surplus record does not stay to eat the window', () => {
    const apply = between(app, 'function applyRestoredHistoryItems(items, { applied = null, eagerFaces = false } = {}) {', 'async function restoreEncryptedMessageHistory()');
    expect(apply, 'the capsule key is read from the stored record').toContain('const chainKey = item.message?.groupChainKey ?? null;');
    expect(apply, 'and a capsule already on screen is not drawn twice')
      .toContain('const twin = chainKey ? thread.messages.find((message) => message.groupChainKey === chainKey) ?? null : null;');
    expect(apply).toContain('if (twin && !replacesTwin) {');
    expect(apply, 'the surplus record is DELETED, not merely skipped').toContain('encryptedMessageStore.deleteMessage(item.id)');
    expect(apply, 'the guard requires a key before it compares anything').toMatch(/const twin = chainKey \? thread\.messages\.find\(/);
  });

  it('HISTWIN-11: the number the housekeeping reports is true', () => {
    expect(app, 'ids, not a tally').toContain('let historyDuplicateRecordIds = new Set();');
    expect(app, 'and the diagnostic reports the set').toContain('duplicatesPruned: historyDuplicateRecordIds.size,');
    expect(app, 'the old counter is gone').not.toContain('historyDuplicatesPruned');
    const apply = between(app, 'function applyRestoredHistoryItems(items, { applied = null, eagerFaces = false } = {}) {', 'async function restoreEncryptedMessageHistory()');
    expect(apply, 'a record is dropped once').toContain('if (item.id && !historyDuplicateRecordIds.has(item.id)) {');
  });

  it('HISTWIN-08: one unreadable record costs itself, not the conversations behind it', () => {
    const apply = between(app, 'function applyRestoredHistoryItems(items, { applied = null, eagerFaces = false } = {}) {', 'async function restoreEncryptedMessageHistory()');
    expect(apply, 'the per-record work is contained').toContain('try {');
    expect(apply, 'and the failure is recorded').toContain('historyApplyFailures.push({');
    expect(apply, 'and said out loud').toContain("console.error('[history] a stored record could not be applied'");
    expect(app, 'the counter is cleared at the start of every restore').toMatch(/historyApplyFailures = \[\];[\s\S]{0,200}listThreadSummaries/);
    expect(app, 'and reported beside the records that would not open').toMatch(/applyFailed: historyApplyFailures\.length,/);
  });

  it('HISTWIN-09: a row born before its first message says what every other row says', () => {
    expect(app, 'the placeholder is gone').not.toContain("preview: 'encrypted local history'");
    const ensure = between(app, 'function ensureHistoryThread(threadId, snapshot = null, message = null) {', 'async function persistMessageToEncryptedHistory');
    expect(ensure).toContain("preview: t('chat.previewNoMessages'),");
  });

  it('HISTWIN-03: deduplication asks the STORE, not the loaded window', () => {
    expect(app).toMatch(/async function capsuleAlreadyStored\(capsuleId\)/);
    expect(app).toMatch(/return await encryptedMessageStore\.hasCapsule\(capsuleId\);/);
    expect(app).not.toMatch(/storedCapsuleIds/);
    const singleHead = app.indexOf('async function appendOpenedCapsuleMessage(');
    expect(singleHead).toBeGreaterThan(-1);
    const single = app.slice(singleHead, singleHead + 1_800);
    const singleAnchor = 'const existing = findMessageByCapsuleId(opened.capsule?.id);';
    expect(single.indexOf(singleAnchor), 'the single-part append keeps the id lookup first').toBeGreaterThan(-1);
    expect(single.indexOf('findOwnEchoForChainCopy('), 'then the own-echo match').toBeGreaterThan(single.indexOf(singleAnchor));
    expect(single).toMatch(/if \(await capsuleAlreadyStored\(opened\.capsule\?\.id\)\) return true;/);
    expect(single.indexOf('capsuleAlreadyStored('), 'the store check comes after the lookups and before the insert')
      .toBeGreaterThan(single.indexOf('findOwnEchoForChainCopy('));
    expect(single.indexOf('insertThreadMessage(targetThread, message);')).toBeGreaterThan(single.indexOf('capsuleAlreadyStored('));
    const multi = app.slice(app.indexOf('const existing = parts.map((part) => findMessageByCapsuleId'), app.indexOf('const existing = parts.map((part) => findMessageByCapsuleId') + 1_400);
    expect(multi).toMatch(/if \(await anyCapsuleStored\(parts\.map\(\(part\) => part\.opened\?\.capsule\?\.id\)\)\) return true;/);
    expect(app).not.toMatch(/rememberStoredCapsuleIds/);
    expect(app).toMatch(/const stored = await store\.putMessage\(\{/);
  });

  it('HISTWIN-04: earlier pages are read by timestamp, never by offset', () => {
    expect(app).toMatch(/before: state\.oldestLoadedAt/);
    expect(app).not.toMatch(/offset: \w+HistoryWindow|skip: \w+HistoryWindow/);
    expect(app).toMatch(/stored: older\.length === 0 \? state\.loaded : state\.stored/);
    expect(app).toMatch(/if \(!thread \|\| !encryptedMessageStore \|\| privateHistoryLoadingThreadId\) return;/);
  });

  it('HISTWIN-05: the fallback store answers the same API as IndexedDB', () => {
    const memory = store.slice(store.indexOf('export async function createMemoryEncryptedMessageHistoryStore('));
    expect(memory).toContain("const backend = typeof options.watchBackend === 'function' ? options.watchBackend(memoryBackend(records)) : memoryBackend(records);");
    expect(memory).toContain("createHistoryStoreApi(keys, backend, { maxPerThread, type: 'memory', persistent: false })");
    expect(store).toContain('const backend = indexedDbBackend(db, keyRangeApi);');
    expect(store).toContain("createHistoryStoreApi(keys, backend, { maxPerThread, type: 'indexeddb', persistent: true })");
    const api = store.slice(store.indexOf('function createHistoryStoreApi('), store.indexOf('// ── IndexedDB ──'));
    for (const member of ['listMessageHeaders', 'listMessagesDetailed', 'listThreadSummaries', 'hasCapsule', 'hasOwnSendNear', 'maxPerThread']) {
      expect(api, `the one API must expose ${member}`).toContain(member);
    }
    const backend = store.slice(store.indexOf('function memoryBackend('), store.indexOf('export async function createMemoryEncryptedMessageHistoryStore('));
    expect(backend, 'and prune per conversation, or the same device loses a different set of messages').toContain('const list = ofTag(tag);');
  });

  it('HISTWIN-06: the retention label says PER CHAT', () => {
    expect(app).toMatch(/t\('vault\.historyLimitPerChat', \{ count: encryptedMessageStore\.maxPerThread \}\)/);
    expect(app).not.toMatch(/vault\.historyLimitLast/);
  });

  it('HISTWIN-12: the window loader runs over summaries — a window per conversation, the open one first, the rest newest-first, the state from the summary count', async () => {
    const from = app.indexOf('async function restoreHistoryWindows(');
    expect(from).toBeGreaterThan(-1);
    let depth = 0; let end = -1;
    for (let i = app.indexOf(') {\n', from) + 2; i < app.length; i += 1) {
      if (app[i] === '{') depth += 1;
      else if (app[i] === '}') { depth -= 1; if (depth === 0) { end = i + 1; break; } }
    }
    const source = app.slice(from, end);
    const calls: any[] = [];
    const encryptedMessageStore = {
      listThreadSummaries: async () => { throw new Error('the loader takes summaries; it must not list them itself'); },
      listMessageHeaders: async () => { throw new Error('the whole-store header read is off the boot path'); },
      listMessagesDetailed: async (filter: any) => { calls.push(filter); return { messages: [{ id: `${filter.threadId}-1`, createdAt: 5, message: {} }], failed: [] }; },
    };
    const historyWindowState = new Map();
    const painted: string[] = [];
    // eslint-disable-next-line no-new-func
    const run = new Function('encryptedMessageStore', 'activeThreadId', 'historyWindowState', 'PRIVATE_HISTORY_WINDOW', 'PRIVATE_HISTORY_QUIET_WINDOW', 'CONV_RECV_WINDOW_W', 'console', `${source}; return restoreHistoryWindows;`)(
      encryptedMessageStore, 'on-screen', historyWindowState, 96, 8, 2, { warn: () => {} },
    );
    const summaries = [
      { threadId: 'newest', count: 2000, newestCreatedAt: Date.now() - 60_000 },
      { threadId: 'on-screen', count: 3, newestCreatedAt: 100 },
      { threadId: 'older', count: 40, newestCreatedAt: 500 },
      { threadId: 'undated', count: 1, newestCreatedAt: 0 },
      { threadId: null, count: 9, newestCreatedAt: 999 },
    ];
    const result = await run(summaries, async (page: any[]) => { painted.push(page[0].id); });
    expect(calls.map((c) => c.threadId), 'the open conversation first, then newest-first, the undated last, no nameless row').toEqual(['on-screen', 'newest', 'older', 'undated']);
    expect(calls.map((c) => c.limit), 'one window each, never the whole conversation').toEqual([96, 96, 8, 8]);
    expect(painted, 'each page handed over as it lands').toEqual(['on-screen-1', 'newest-1', 'older-1', 'undated-1']);
    expect(result.messages).toHaveLength(4);
    expect(historyWindowState.get('newest'), 'the state records what the SUMMARY said is stored').toEqual({ stored: 2000, loaded: 1, oldestLoadedAt: 5, cursor: null });
    expect(historyWindowState.get('on-screen')).toEqual({ stored: 3, loaded: 1, oldestLoadedAt: 5, cursor: null });
  });

});
