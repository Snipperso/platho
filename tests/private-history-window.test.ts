import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Private history used to be one global cap of 500 records, pruned by time across every conversation, and loaded
// in full before the app was usable. Both halves were wrong in ways that only showed up with use:
//
//   * the cap was shared, so a busy chat evicted a quiet one's past and a person messaging for years did not have
//     their history on the device — silently, and never in the conversation they were looking at;
//   * the load was unfiltered, so boot decrypted EVERY record. MEASURED at 0.035 ms each, a 2000-deep dialog across
//     twenty contacts is 40,000 records: 1.4 s on a desktop, roughly ten seconds on a phone, between unlocking the
//     wallet and a usable app.
//
// The retention is now per conversation and the load is a window with a "show earlier" control. This gate pins the
// parts that are easy to undo by accident — and the one that is easy to get subtly wrong.

const app = readFileSync('web/app.js', 'utf8');
const store = readFileSync('web/encrypted-message-store.mjs', 'utf8');

describe('private history loads a window, not everything', () => {
  it('HISTWIN-01: retention is per conversation, pruned per conversation', () => {
    expect(store).toMatch(/export const DEFAULT_MESSAGE_HISTORY_MAX_PER_THREAD = \d+;/);
    expect(store, 'the old global cap must not come back').not.toMatch(/DEFAULT_MESSAGE_HISTORY_MAX_RECORDS/);
    expect(store).toMatch(/async function pruneIndexedDbThread\(db, threadId, maxPerThread\)/);
    // Pruning must be scoped to the thread that was written; a store-wide cursor is the old behaviour.
    expect(store).toMatch(/index\.count\(threadId\)/);
  });

  it('HISTWIN-02: boot reads headers and then one window per conversation', () => {
    expect(app).toMatch(/const PRIVATE_HISTORY_WINDOW = 96;/);
    expect(app).toMatch(/encryptedMessageStore\.listMessageHeaders/);
    expect(app).toMatch(/limit: PRIVATE_HISTORY_WINDOW/);
    // The unfiltered read may remain ONLY as the fallback for a store that has no headers — a shape that exists
    // because an older store object could be handed in. Anchored on the ternary rather than on a slice: the two
    // functions are defined in either order, and a slice between them silently inverts.
    expect(app).toMatch(/const headers = encryptedMessageStore\.listMessageHeaders[\s\S]{0,120}: null;/);
    expect(app).toMatch(/const result = headers[\s\S]{0,60}await restoreHistoryWindows\(headers\)/);
    expect(app).toMatch(/restoreHistoryWindows\(headers\)[\s\S]{0,300}listMessagesDetailed\(\)/);
  });

  it('HISTWIN-03: deduplication asks the STORE, not the loaded window', () => {
    // The subtle one. `findMessageByCapsuleId` scans threads in MEMORY, which was the same question while all of
    // history was in memory and is not once a window is. A manual sync re-delivers on purpose
    // (forceIndexRescan), so an older capsule would have been re-inserted and re-persisted — a duplicate that
    // appears only for people whose history is deeper than the window.
    expect(app).toMatch(/function capsuleAlreadyStored\(capsuleId\)/);
    expect(app).toMatch(/storedCapsuleIds\.has\(capsuleId\)/);
    // Both append paths must consult it BEFORE inserting.
    // (2026-08-22: the id lookup falls back to the own-echo match for a capsule read back off the own outgoing shard —
    // the store check still follows, BEFORE the insert.)
    const singleAnchor = 'const existing = findMessageByCapsuleId(opened.capsule?.id) ?? findOwnEchoForChainCopy(targetThread, entry, opened);';
    expect(app.indexOf(singleAnchor), 'the single-part append keeps the id lookup first').toBeGreaterThan(-1);
    const single = app.slice(app.indexOf(singleAnchor), app.indexOf(singleAnchor) + 900);
    expect(single).toMatch(/capsuleAlreadyStored\(opened\.capsule\?\.id\)[\s\S]{0,40}return true;/);
    const multi = app.slice(app.indexOf('const existing = parts.map((part) => findMessageByCapsuleId'), app.indexOf('const existing = parts.map((part) => findMessageByCapsuleId') + 700);
    expect(multi).toMatch(/parts\.some\(\(part\) => capsuleAlreadyStored\(part\.opened\?\.capsule\?\.id\)\)[\s\S]{0,40}return true;/);
    // A capsule stored during THIS session must join the set, or the next re-delivery in the same session dupes it.
    expect(app).toMatch(/rememberStoredCapsuleIds\(message\);/);
  });

  it('HISTWIN-04: earlier pages are read by timestamp, never by offset', () => {
    // Messages arrive out of order — a chain sync backfills older ones — so an offset into a growing list would
    // skip or repeat a page. The boundary has to be the timestamp itself.
    expect(app).toMatch(/before: state\.oldestLoadedAt/);
    expect(app).not.toMatch(/offset: \w+HistoryWindow|skip: \w+HistoryWindow/);
    // An empty page retires the control instead of leaving it to be pressed forever.
    expect(app).toMatch(/stored: older\.length === 0 \? state\.loaded : state\.stored/);
    // And it cannot be pressed twice into two concurrent decrypt passes.
    expect(app).toMatch(/if \(!thread \|\| !encryptedMessageStore \|\| privateHistoryLoadingThreadId\) return;/);
  });

  it('HISTWIN-05: the fallback store answers the same API as IndexedDB', () => {
    // A narrower fallback fails only where IndexedDB is unavailable — the devices nobody tests on.
    const memory = store.slice(store.indexOf('export async function createMemoryEncryptedMessageHistoryStore('));
    for (const member of ['listMessageHeaders', 'listMessagesDetailed', 'maxPerThread']) {
      expect(memory, `the memory store must expose ${member}`).toContain(member);
    }
    expect(memory, 'and prune per thread, or the same device loses a different set of messages')
      .toMatch(/byThread/);
  });

  it('HISTWIN-06: the retention label says PER CHAT', () => {
    // "last 500" next to a history label gave no hint that the number was shared across conversations.
    expect(app).toMatch(/t\('vault\.historyLimitPerChat', \{ count: encryptedMessageStore\.maxPerThread \}\)/);
    expect(app).not.toMatch(/vault\.historyLimitLast/);
  });
});
