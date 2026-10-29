import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';


const app = readFileSync('web/app.js', 'utf8');
const fn = (declaration: string) => {
  const at = app.indexOf(declaration);
  if (at < 0) throw new Error(`${declaration} not found`);
  return app.slice(at, app.indexOf('\n}', at) + 2);
};
const hex = (byte: number) => new Uint8Array(32).fill(byte);

function harness() {
  const calls = { labels: [] as any[], adopted: [] as any[], incoming: 0, persisted: [] as any[], updated: [] as any[], deleted: [] as any[], sorted: 0 };
  const env: Record<string, any> = {
    publicGroupMemberLabel: (_record: any, row: any) => { calls.labels.push(row.key); return `label:${row.senderWallet ?? '?'}`; },
    encryptedMessageStore: { deleteMessage: async (id: any) => { calls.deleted.push(id); } },
    updateMessageInEncryptedHistory: async (_thread: any, held: any) => { calls.updated.push(held.groupChainKey); },
    adoptPostSenderUsernameClaim: (wallet: any, name: any) => { calls.adopted.push([wallet, name]); },
    localMessageOrderFields: (ms: number) => ({ createdAtMs: ms, createdAt: new Date(ms).toISOString() }),
    markIncomingThreadMessage: () => { calls.incoming += 1; },
    publicRoomMessageShown: () => true,
    persistMessageToEncryptedHistory: async (_thread: any, message: any) => { calls.persisted.push(message.groupChainKey); },
    sortThreadMessages: (thread: any) => { calls.sorted += 1; thread.messages.sort((a: any, b: any) => a.createdAtMs - b.createdAtMs); },
    console: { warn: () => {} },
    groupRowsAlreadyStored: async () => new Set(),
  };
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  const fold = new Function(...names, `${fn('async function applyPublicGroupMessagesToThread(thread, record, messages, writes = null) {')}\nreturn applyPublicGroupMessagesToThread;`)(...names.map((n) => env[n]));
  return { fold, calls };
}
const SELF = hex(0xaa);
const STRANGER = hex(0xbb);
const record = { self: SELF };

describe('applyPublicGroupMessagesToThread — the fold runs on every path', () => {
  it('PGF-01: a held row seen again does not throw, learns its name once, and counts as moved', async () => {
    const { fold, calls } = harness();
    const held = { type: 'in', text: 'hello', meta: '', groupChainKey: 'k1', createdAtMs: 1_000, localHistoryId: 7 };
    const thread: any = { id: 't', messages: [held] };
    const row = { key: 'k1', senderKey: STRANGER, senderWallet: '0:' + 'bb'.repeat(32), createdAt: 1, text: 'hello' };
    let added = -1;
    added = await fold(thread, record, [row]);
    expect(added).toBe(1);
    expect(held.senderLabel).toBe('label:0:' + 'bb'.repeat(32));
    expect(calls.updated).toEqual(['k1']);
    expect(thread.messages).toHaveLength(1);
    expect(await fold(thread, record, [row])).toBe(0);
    expect(calls.updated).toEqual(['k1']);
    expect(calls.labels).toEqual(['k1']);
  });

  it('PGF-02: my own held echo is confirmed by the chain copy — the chain clock, no label, no claim', async () => {
    const { fold, calls } = harness();
    const echo: any = { type: 'out', text: 'mine', meta: 'sending', groupChainKey: 'k2', createdAtMs: 5, groupSentAtMs: 5 };
    const thread: any = { id: 't', messages: [echo] };
    const row = { key: 'k2', senderKey: SELF, senderWallet: '0:' + 'aa'.repeat(32), senderUsername: 'me', createdAt: 100, text: 'mine', coords: { shard: 1, seq: 2 } };
    expect(await fold(thread, record, [row])).toBe(1);
    expect(echo.meta).toBe('');
    expect('groupSentAtMs' in echo).toBe(false);
    expect(echo.createdAtMs, 'the chain clock').toBe(100_000);
    expect(echo.senderLabel, 'my own row carries no label').toBeUndefined();
    expect(echo.groupPublic).toEqual({ senderWallet: '0:' + 'aa'.repeat(32), coords: { shard: 1, seq: 2 } });
    expect(calls.adopted, 'my own claim is not re-adopted').toEqual([]);
    expect(calls.labels).toEqual([]);
    expect(calls.updated).toEqual(['k2']);
  });

  it('PGF-03: fresh rows — a stranger\'s comes in with a label and a claim, my own goes out without either', async () => {
    const { fold, calls } = harness();
    const thread: any = { id: 't', messages: [] };
    const rows = [
      { key: 'k3', senderKey: STRANGER, senderWallet: '0:' + 'bb'.repeat(32), senderUsername: 'bob', createdAt: 20, text: 'from bob' },
      { key: 'k4', senderKey: SELF, senderWallet: '0:' + 'aa'.repeat(32), senderUsername: 'me', createdAt: 10, text: 'from me' },
    ];
    expect(await fold(thread, record, rows)).toBe(2);
    expect(thread.messages.map((m: any) => [m.groupChainKey, m.type, m.senderLabel ?? null])).toEqual([['k4', 'out', null], ['k3', 'in', 'label:0:' + 'bb'.repeat(32)]]);
    expect(calls.adopted).toEqual([['0:' + 'bb'.repeat(32), 'bob']]);
    expect(calls.incoming, 'only the stranger\'s row badges unread').toBe(1);
    expect(calls.persisted.sort()).toEqual(['k3', 'k4']);
    expect(calls.sorted, 'one sort per pass').toBe(1);
    expect(await fold(thread, record, rows)).toBe(0);
  });

  it('PGF-04: a row the chain hid leaves the thread and the history; one nobody held is ignored', async () => {
    const { fold, calls } = harness();
    const held = { type: 'in', text: 'gone', meta: '', groupChainKey: 'k5', createdAtMs: 1, localHistoryId: 42, senderLabel: 'x' };
    const thread: any = { id: 't', messages: [held] };
    expect(await fold(thread, record, [{ key: 'k5', hidden: true }, { key: 'k6', hidden: true }])).toBe(1);
    expect(thread.messages).toEqual([]);
    expect(calls.deleted).toEqual([42]);
  });

  it('PGF-05: whose row it is stands decided before the held branch reads it', () => {
    const fold = fn('async function applyPublicGroupMessagesToThread(thread, record, messages, writes = null) {');
    const mine = fold.indexOf('const mine = selfKey !== null && senderHex === selfKey;');
    const heldBranch = fold.indexOf('if (held) {');
    const firstRead = fold.indexOf('if (!mine && !held.senderLabel)');
    expect(mine).toBeGreaterThan(-1);
    expect(heldBranch).toBeGreaterThan(-1);
    expect(mine, 'declared before the branch').toBeLessThan(heldBranch);
    expect(firstRead).toBeGreaterThan(mine);
    expect(fold.split('const mine =').length - 1, 'declared once').toBe(1);
  });
});
