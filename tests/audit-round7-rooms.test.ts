import { describe, expect, it, onTestFinished } from 'vitest';
import { readFileSync } from 'node:fs';
import { sha256 as nobleSha256 } from '../web/vendor/@noble/hashes/sha2.js';
import { createMemoryGroupRecordStore } from '../web/group-record-store.mjs';
import { createMemoryEncryptedMessageHistoryStore } from '../web/encrypted-message-store.mjs';
import {
  PUBLIC_GROUP_BUFFER_MAX, PUBLIC_GROUP_LEFT_READ_S, PUBLIC_GROUP_REANCHOR_S, createPublicGroupRuntime, publicGroupChatUid, publicGroupControlUid,
  publicGroupKeyOfWallet, publicGroupStreamKey,
} from '../web/public-group-runtime.mjs';
import {
  PUBLIC_GROUP_KIND, applyPublicGroupRows, createPublicGroupRecord, decodePublicGroupControl, encodePublicGroupControl, isPublicGroupAdmin,
  parsePublicGroupRecord, serializePublicGroupRecord,
} from '../web/public-group-protocol.mjs';


const CLOCK = 1_800_000_000;
const ERA_LEN = 2_592_000;
const walletOf = (fill: number) => `0:${fill.toString(16).padStart(2, '0').repeat(32)}`;
const walletNumbered = (n: number) => `0:${n.toString(16).padStart(8, '0')}${'ab'.repeat(28)}`;
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

function fakeChain({ window = 96 }: { window?: number } = {}) {
  const threads = new Map<string, any[]>();
  let clock = CLOCK;
  const now = () => clock;
  const tick = (s = 1) => { clock += s; };
  const encodeDocument = (blocks: any[]) => new TextEncoder().encode(JSON.stringify(blocks.map((b) => (b.bytes instanceof Uint8Array ? { ...b, bytes: [...b.bytes] } : b))));
  let decodes = 0;
  const decodeDocument = (bytes: Uint8Array) => { decodes += 1; return JSON.parse(new TextDecoder().decode(bytes)).map((b: any) => (Array.isArray(b.bytes) ? { ...b, bytes: new Uint8Array(b.bytes) } : b)); };
  const shardKeyOf = (uid: bigint) => `shard:${String(uid).slice(0, 10)}`;
  const rowOf = (uid: bigint, wallet: string, documentBytes: Uint8Array, streamId: string, partIndex = 0, partCount = 1) => {
    const key = String(uid);
    const rows = threads.get(key) ?? [];
    const era = Math.floor(clock / ERA_LEN);
    rows.push({
      publisher: wallet, created_at: BigInt(clock), entry_id: BigInt(rows.length), hidden: false,
      thread_epoch_tag: String((1n << 32n) | BigInt(era)), thread_seq: 0, thread_generation: 17, thread_pk: '1234', shard_key: shardKeyOf(uid),
      header: null, body: { documentBytes, streamId: `0x${String(streamId).toLowerCase().replace(/^0x/, '')}`, partIndex, partCount },
    });
    threads.set(key, rows);
  };
  const publishAs = (wallet: string) => async ({ uid, blocks, streamId }: any) => { rowOf(uid, wallet, encodeDocument(blocks), streamId); return { createdAtSec: clock }; };
  const lane = {
    async readThreadByUid(uid: bigint, { olderThan = null }: any = {}) {
      const rows = threads.get(String(uid)) ?? [];
      const key = shardKeyOf(uid);
      const count = rows.length;
      if (count === 0) return { posts: [], cursors: {}, hidden: [] };
      const previous = olderThan?.[key];
      if (previous && Number(previous.from) === 0) return { posts: [], cursors: { [key]: { from: 0, entryCount: count } }, hidden: [] };
      const end = previous ? Math.min(Number(previous.from), count) : count;
      const from = Math.max(0, end - window);
      return { posts: rows.slice(from, end).map((r) => ({ ...r })), cursors: { [key]: { from, entryCount: count, oldestLt: null } }, hidden: [{ epochTag: 'x', seq: 0, generation: 17, ids: [], complete: true, thread: String(uid) }] };
    },
  };
  const readPayload = (post: any) => ({ type: 'document_comment', documentBytes: post.body.documentBytes, stream_id: post.body.streamId, partIndex: post.body.partIndex, partCount: post.body.partCount });
  return { now, tick, publishAs, lane, readPayload, decodeDocument, encodeDocument, rowOf, threads, decodes: () => decodes };
}

function runtimeFor(chain: ReturnType<typeof fakeChain>, wallet: string, extra: any = {}) {
  const store = extra.store ?? createMemoryGroupRecordStore();
  const runtime = createPublicGroupRuntime({
    store, self: { wallet, hash: publicGroupKeyOfWallet(wallet)! }, lane: chain.lane, publish: chain.publishAs(wallet),
    decodeDocument: chain.decodeDocument, readPayload: chain.readPayload, threadEraOf: (unix: number) => Math.floor(unix / ERA_LEN), now: chain.now,
    random: (n: number) => { const out = new Uint8Array(n); for (let i = 0; i < n; i += 1) out[i] = (wallet.charCodeAt(4) * 31 + i * 7 + chain.now()) & 0xff; return out; },
    ...extra,
  });
  return { runtime, store, hash: publicGroupKeyOfWallet(wallet)!, wallet };
}
const pointerOf = (record: any) => ({ founder: record.founder, foundedEra: record.foundedEra, name: record.name });
const joinDoc = (chain: ReturnType<typeof fakeChain>) => chain.encodeDocument([{ type: 'group', bytes: encodePublicGroupControl(PUBLIC_GROUP_KIND.JOIN, { sentAt: chain.now() }) }]);

describe('R7 — a row counts from its writer\'s tenure', () => {
  const O = publicGroupKeyOfWallet(walletOf(0x11))!;
  const X = publicGroupKeyOfWallet(walletOf(0x22))!;
  const control = (kind: number, payload: any) => decodePublicGroupControl(encodePublicGroupControl(kind, { ...payload, sentAt: 1 }))!;
  const row = (sender: Uint8Array, kind: number, payload: any, at: number, entryId: number) => ({
    key: publicGroupStreamKey(`s${entryId}`, hex(sender)), senderKey: sender, senderWallet: null, createdAt: at,
    coords: { era: 1, seq: 0, entryId }, control: control(kind, payload), hidden: false,
  });
  const fresh = () => createPublicGroupRecord({ groupId: new Uint8Array(32).fill(7), self: O, founder: O, name: 'room' });

  it('R7R-01: a row written before its writer was appointed stays refused on every fold after — on the device that knew the room longest too', () => {
    const early = row(X, PUBLIC_GROUP_KIND.PROFILE, { name: 'hijacked' }, CLOCK + 1, 1);
    const appoint = row(O, PUBLIC_GROUP_KIND.ADMIN, { admins: [O, X], owner: O }, CLOCK + 2, 2);
    const newcomer = applyPublicGroupRows(fresh(), [early, appoint]).record;
    expect(newcomer.name, 'in order: refused').toBe('room');
    expect(isPublicGroupAdmin(newcomer, X)).toBe(true);
    const again = applyPublicGroupRows(newcomer, [early, appoint]).record;
    expect(again.name, 'still refused — the row is older than the tenure').toBe('room');
    const later = row(X, PUBLIC_GROUP_KIND.PROFILE, { name: 'renamed by an admin' }, CLOCK + 3, 3);
    const lateFirst = applyPublicGroupRows(fresh(), [later]).record;
    expect(lateFirst.name, 'the appointment not read yet: refused this pass').toBe('room');
    expect(applyPublicGroupRows(lateFirst, [appoint, later]).record.name, 'converges once it is').toBe('renamed by an admin');
    const reloaded = parsePublicGroupRecord(serializePublicGroupRecord(again));
    expect(applyPublicGroupRows(reloaded, [early, appoint]).record.name).toBe('room');
  });

  it('R7R-01B: an appointment this device made believes it from the device\'s clock, and the chain\'s earlier copy moves the tenure back', () => {
    const ghost = { ...row(O, PUBLIC_GROUP_KIND.ADMIN, { admins: [O, X], owner: O }, CLOCK + 50, 0), coords: { era: Number.MAX_SAFE_INTEGER, seq: Number.MAX_SAFE_INTEGER, entryId: Number.MAX_SAFE_INTEGER } };
    const believed = applyPublicGroupRows(fresh(), [ghost]).record;
    const chainCopy = row(O, PUBLIC_GROUP_KIND.ADMIN, { admins: [O, X], owner: O }, CLOCK + 10, 2);
    const between = row(X, PUBLIC_GROUP_KIND.PROFILE, { name: 'renamed in between' }, CLOCK + 20, 3);
    expect(applyPublicGroupRows(believed, [chainCopy, between]).record.name).toBe('renamed in between');
  });

  it('R7R-02B: a tenure goes with the seat — a banned admin and an admin the owner dropped keep none', () => {
    const Y = publicGroupKeyOfWallet(walletOf(0x33))!;
    const appoint = row(O, PUBLIC_GROUP_KIND.ADMIN, { admins: [O, X, Y], owner: O }, CLOCK + 1, 1);
    const both = applyPublicGroupRows(fresh(), [appoint]).record;
    expect(Object.keys(both.adminSince).sort()).toEqual([hex(X), hex(Y)].sort());
    const banned = applyPublicGroupRows(both, [row(O, PUBLIC_GROUP_KIND.BAN, { groupKey: X }, CLOCK + 2, 2)]).record;
    expect(Object.keys(banned.adminSince)).toEqual([hex(Y)]);
    const dropped = applyPublicGroupRows(both, [row(O, PUBLIC_GROUP_KIND.ADMIN, { admins: [O, X], owner: O }, CLOCK + 3, 3)]).record;
    expect(Object.keys(dropped.adminSince)).toEqual([hex(X)]);
  });

  it('R7R-02: an ADMIN row written before its writer became owner cannot strip the old owner on a later fold', () => {
    const grab = row(X, PUBLIC_GROUP_KIND.ADMIN, { admins: [X], owner: X }, CLOCK + 1, 1);
    const handover = row(O, PUBLIC_GROUP_KIND.ADMIN, { admins: [O, X], owner: X }, CLOCK + 2, 2);
    const first = applyPublicGroupRows(fresh(), [grab, handover]).record;
    expect(hex(first.owner)).toBe(hex(X));
    const again = applyPublicGroupRows(first, [grab, handover]).record;
    expect(again.admins.map(hex).sort(), 'the founder stays an admin').toEqual([hex(O), hex(X)].sort());
    const legacy = { ...first, adminSince: {}, ownerSince: null };
    expect(applyPublicGroupRows(legacy, [row(X, PUBLIC_GROUP_KIND.PROFILE, { name: 'kept' }, CLOCK + 5, 5)]).record.name).toBe('kept');
  });
});

describe('R7 — the newcomer\'s buffer', () => {
  it('R7R-03: a room of 3,500 control rows caught up page by page keeps its founding row and its first appointment — the window is not kept twice', async () => {
    const chain = fakeChain();
    const founder = runtimeFor(chain, walletOf(0x11));
    const record = await founder.runtime.create({ name: 'the square' });
    const controlUid = publicGroupControlUid(record.groupId, record.founder);
    const appointee = publicGroupKeyOfWallet(walletOf(0x33))!;
    chain.tick();
    await founder.runtime.setAdmins(hex(record.groupId), [record.owner, appointee]);
    chain.tick();
    chain.rowOf(controlUid, walletOf(0x33), chain.encodeDocument([{ type: 'group', bytes: encodePublicGroupControl(PUBLIC_GROUP_KIND.PROFILE, { name: 'renamed by the appointee', sentAt: chain.now() }) }]), 'ab'.repeat(16));
    for (let n = 0; n < 3500; n += 1) { chain.tick(); chain.rowOf(controlUid, walletNumbered(1000 + n), joinDoc(chain), (5000 + n).toString(16).padStart(32, '0')); }
    const newcomer = runtimeFor(chain, walletOf(0x44), { pagesPerPass: 2 });
    await newcomer.runtime.join(record.groupId, pointerOf(record));
    let pass: any = null;
    const keyOf = (lite: any) => `${lite.publisher}:${lite.streamId}`;
    let copies = 0;
    for (let n = 0; n < 40 && !pass?.connected; n += 1) {
      chain.tick();
      [pass] = await newcomer.runtime.sync();
      const buffer = newcomer.runtime.get(pass.groupId)?.buffer ?? [];
      copies = Math.max(copies, buffer.length - new Set(buffer.map(keyOf)).size);
    }
    expect(copies, 'the newest window read again is not kept again').toBe(0);
    expect(pass.connected, 'caught up').toBe(true);
    expect(pass.record.name, 'the rename folded after the appointment that allowed it').toBe('renamed by the appointee');
    expect(isPublicGroupAdmin(pass.record, appointee)).toBe(true);
  });

  it('R7R-04: over its bounds the buffer gives up plentiful rows first — not a decision that sits below the newest window', async () => {
    const chain = fakeChain();
    const founder = runtimeFor(chain, walletOf(0x11));
    const record = await founder.runtime.create({ name: 'the big square' });
    const controlUid = publicGroupControlUid(record.groupId, record.founder);
    for (let n = 0; n < PUBLIC_GROUP_BUFFER_MAX; n += 1) { chain.tick(); chain.rowOf(controlUid, walletNumbered(1000 + n), joinDoc(chain), (5000 + n).toString(16).padStart(32, '0')); }
    for (let n = 0; n < 1500; n += 1) { chain.tick(); chain.rowOf(controlUid, walletOf(0x66), chain.encodeDocument([{ type: 'group', bytes: encodePublicGroupControl(PUBLIC_GROUP_KIND.PROFILE, { name: `junk ${n}`, sentAt: chain.now() }) }]), (90000 + n).toString(16).padStart(32, '0')); }
    chain.tick();
    await founder.runtime.setName(hex(record.groupId), 'the owner\'s rename');
    for (let n = 0; n < 200; n += 1) { chain.tick(); chain.rowOf(controlUid, walletNumbered(20000 + n), joinDoc(chain), (70000 + n).toString(16).padStart(32, '0')); }
    const newcomer = runtimeFor(chain, walletOf(0x44), { pagesPerPass: 8 });
    await newcomer.runtime.join(record.groupId, pointerOf(record));
    let pass: any = null;
    let most = 0;
    for (let n = 0; n < 80 && !pass?.connected; n += 1) { chain.tick(); [pass] = await newcomer.runtime.sync(); most = Math.max(most, (newcomer.runtime.get(pass.groupId)?.buffer ?? []).length); }
    expect(most, 'bounded').toBe(PUBLIC_GROUP_BUFFER_MAX);
    expect(pass.connected).toBe(true);
    expect(pass.record.name, 'the flood gave way, the owner\'s rename did not').toBe('the owner\'s rename');
  });
});

describe('R7 — what the screen is handed, and when the marks move', () => {
  async function room() {
    const chain = fakeChain();
    const owner = runtimeFor(chain, walletOf(0x11));
    const record = await owner.runtime.create({ name: 'the square' });
    const id = hex(record.groupId);
    const chatUid = publicGroupChatUid(record.groupId, record.founder);
    for (let n = 0; n < 5; n += 1) { chain.tick(); await owner.runtime.say(id, `hello ${n}`); }
    return { chain, owner, record, id, chatUid };
  }

  it('R7R-05: a row is handed to the screen once — not on the next pass, not after a reload — and again only to take it off', async () => {
    const { chain, record, id } = await room();
    const store = createMemoryGroupRecordStore();
    const reader = runtimeFor(chain, walletOf(0x22), { store });
    await reader.runtime.join(record.groupId, pointerOf(record));
    const [first] = await reader.runtime.sync();
    expect(first.messages.map((m: any) => m.text)).toEqual(['hello 0', 'hello 1', 'hello 2', 'hello 3', 'hello 4']);
    chain.tick();
    const [second] = await reader.runtime.sync();
    expect(second.messages, 'nothing new').toEqual([]);
    const reloaded = runtimeFor(chain, walletOf(0x22), { store });
    await reloaded.runtime.load();
    const [third] = await reloaded.runtime.sync();
    expect(third.messages, 'the marks it began with say they were handed').toEqual([]);
    expect(third.hidden.every((note: any) => note.thread === String(publicGroupChatUid(record.groupId, record.founder))), 'the chat\'s notes only').toBe(true);
    void id;
  });

  it('R7R-06: the pass is handed over BEFORE its marks are written, and a pass the screen could not keep is handed again', async () => {
    const { chain, owner, record, id } = await room();
    const store = createMemoryGroupRecordStore();
    const seenAtDelivery: string[] = [];
    let keep = true;
    const reader = runtimeFor(chain, walletOf(0x22), { store });
    await reader.runtime.adopt(record.groupId, pointerOf(record));
    const deliver = async (pass: any) => {
      seenAtDelivery.push(JSON.stringify(parsePublicGroupRecord(await store.get(pass.groupId)).read?.chat ?? {}));
      return keep;
    };
    const chatMarks = async () => JSON.stringify(parsePublicGroupRecord(await store.get(id)).read?.chat ?? {});
    await reader.runtime.sync({ deliver });
    await reader.runtime.sync({ deliver });
    const settled = await chatMarks();
    chain.tick(); await owner.runtime.say(id, 'new one');
    chain.tick(); await owner.runtime.say(id, 'new two');
    keep = false;
    seenAtDelivery.length = 0;
    const [refused] = await reader.runtime.sync({ deliver });
    expect(refused.messages.map((m: any) => m.text)).toEqual(['new one', 'new two']);
    expect(seenAtDelivery, 'nothing marked read while the screen was being handed the rows').toEqual([settled]);
    expect(await chatMarks(), 'not kept: the chat marks stand where they stood').toBe(settled);
    keep = true;
    const [again] = await reader.runtime.sync({ deliver });
    expect(again.messages.map((m: any) => m.text), 'handed again — a refused pass is never the quiet one').toEqual(['new one', 'new two']);
    expect(await chatMarks(), 'kept: now they move').not.toBe(settled);
  });

  it('R7R-07: a room this device left is read a quarter of an hour for its own rows, not for what was said after — then not at all', async () => {
    const { chain, record, id } = await room();
    const member = runtimeFor(chain, walletOf(0x22));
    await member.runtime.join(record.groupId, pointerOf(record));
    await member.runtime.sync();
    chain.tick();
    const own = await member.runtime.say(id, 'my last words');
    chain.tick();
    await member.runtime.leave(id);
    chain.tick();
    await chain.publishAs(walletOf(0x11))({ uid: publicGroupChatUid(record.groupId, record.founder), blocks: [{ type: 'text', text: 'said after the leave' }], streamId: 'ee'.repeat(16) });
    const [pass] = await member.runtime.sync();
    expect(pass.messages.map((m: any) => m.key), 'its own row, to confirm the echo').toEqual([own.key]);
    chain.tick(PUBLIC_GROUP_LEFT_READ_S + 1);
    expect(await member.runtime.sync()).toEqual([]);
  });
});

describe('R7 — a quiet pass', () => {
  it('R7R-08: nothing moved, nothing decoded — the screen still hears from the pass, a reread is not quiet, and the founder\'s re-anchor still comes due', async () => {
    const chain = fakeChain();
    const founder = runtimeFor(chain, walletOf(0x11));
    const record = await founder.runtime.create({ name: 'the square' });
    const id = hex(record.groupId);
    const heir = runtimeFor(chain, walletOf(0x22));
    await heir.runtime.join(record.groupId, pointerOf(record));
    chain.tick();
    await founder.runtime.sync();
    chain.tick();
    await founder.runtime.transferOwnership(id, heir.hash);
    chain.tick();
    await founder.runtime.say(id, 'a word in the chat, so that a reread has something to read');
    for (let n = 0; n < 3; n += 1) { chain.tick(); await founder.runtime.sync(); }
    const delivered: number[] = [];
    const deliver = async () => { delivered.push(chain.decodes()); return true; };
    const before = chain.decodes();
    await founder.runtime.sync({ deliver });
    await founder.runtime.sync({ deliver });
    expect(chain.decodes(), 'no document decoded on a quiet pass').toBe(before);
    expect(delivered, 'the screen is handed every pass — its echoes age').toHaveLength(2);
    await founder.runtime.rereadChat(id);
    await founder.runtime.sync({ deliver });
    expect(chain.decodes(), 'a chat read again from the top is not quiet').toBeGreaterThan(before);
    await founder.runtime.sync({ deliver });
    const settled = chain.decodes();
    await founder.runtime.sync({ deliver });
    expect(chain.decodes(), 'quiet again').toBe(settled);
    const rowsBefore = (chain.threads.get(String(publicGroupControlUid(record.groupId, record.founder))) ?? []).length;
    chain.tick(PUBLIC_GROUP_REANCHOR_S + 60);
    await founder.runtime.sync({ deliver });
    expect((chain.threads.get(String(publicGroupControlUid(record.groupId, record.founder))) ?? []).length, 'one row').toBe(rowsBefore + 1);
  });
});

const app = readFileSync('web/app.js', 'utf8');
const fn = (declaration: string) => {
  const at = app.indexOf(declaration);
  if (at < 0) throw new Error(`${declaration} not found`);
  if (app.indexOf(declaration, at + 1) >= 0) throw new Error(`${declaration} is not unique`);
  return app.slice(at, app.indexOf('\n}', at) + 2);
};
const line = (prefix: string) => {
  const match = app.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^;]*;`, 'm'));
  if (!match) throw new Error(`${prefix} not found`);
  return match[0];
};
function appFunctions(env: Record<string, any>, sources: string[], exported: string) {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, `${sources.join('\n')}\nreturn ${exported};`)(...names.map((n) => env[n]));
}
const groupRowIdOf = appFunctions({ nobleSha256 }, [fn('function groupRowIdOf(key) {')], 'groupRowIdOf');

describe('R7 — a founder who left', () => {
  it('R7R-08B: restates no handover — the quarter hour it still reads is for its own rows', async () => {
    const chain = fakeChain();
    const founder = runtimeFor(chain, walletOf(0x11));
    const record = await founder.runtime.create({ name: 'the square' });
    const id = hex(record.groupId);
    const heir = runtimeFor(chain, walletOf(0x22));
    await heir.runtime.join(record.groupId, pointerOf(record));
    chain.tick();
    await founder.runtime.sync();
    chain.tick();
    await founder.runtime.transferOwnership(id, heir.hash);
    for (let n = 0; n < 3; n += 1) { chain.tick(); await founder.runtime.sync(); }
    chain.tick(PUBLIC_GROUP_REANCHOR_S + 60);
    await founder.runtime.leave(id);
    const controlUid = String(publicGroupControlUid(record.groupId, record.founder));
    const rowsBefore = (chain.threads.get(controlUid) ?? []).length;
    chain.tick();
    await founder.runtime.sync();
    expect((chain.threads.get(controlUid) ?? []).length, 'nothing restated from a room it left').toBe(rowsBefore);
  });
});

describe('R7 — the screen keeps what the store already holds', () => {
  it('R7R-09: a row the store already holds is not written again nor counted unread; the store is asked once a session', async () => {
    const history = await createMemoryEncryptedMessageHistoryStore();
    let asked = 0;
    const store = { ...history, hasCapsule: async (id: string) => { asked += 1; return history.hasCapsule(id); } };
    await history.putMessage({ threadId: 'group:t', createdAt: 1_000, message: { type: 'in', text: 'stored before', groupChainKey: 'stream:aa:1', groupRowId: groupRowIdOf('stream:aa:1') } });
    expect(await history.hasCapsule(groupRowIdOf('stream:aa:1'))).toBe(true);
    expect(groupRowIdOf('stream:aa:1')).toMatch(/^grp:[0-9a-f]{40}$/);
    const unread: number[] = [];
    const persisted: string[] = [];
    const env: Record<string, any> = {
      publicGroupMemberLabel: () => 'x', encryptedMessageStore: store, updateMessageInEncryptedHistory: async () => {}, adoptPostSenderUsernameClaim: () => {},
      localMessageOrderFields: (ms: number) => ({ createdAtMs: ms }), markIncomingThreadMessage: () => { unread.push(1); }, publicRoomMessageShown: () => true,
      persistMessageToEncryptedHistory: async (_t: any, m: any) => { persisted.push(m.groupChainKey); return { id: 'r' }; },
      sortThreadMessages: () => {}, console: { warn: () => {} }, groupRowIdOf, groupStoredRowKeys: new Map(), GROUP_STORED_ROW_KEYS_MAX: 8192,
    };
    const fold = appFunctions(env, [fn('async function groupRowsAlreadyStored(thread, keys) {'), fn('async function applyPublicGroupMessagesToThread(thread, record, messages, writes = null) {')], 'applyPublicGroupMessagesToThread');
    const thread: any = { id: 'group:t', messages: [] };
    const other = new Uint8Array(32).fill(0xbb);
    const rows = [
      { key: 'stream:aa:1', senderKey: other, senderWallet: walletOf(0xbb), createdAt: 1, text: 'stored before' },
      { key: 'stream:aa:2', senderKey: other, senderWallet: walletOf(0xbb), createdAt: 2, text: 'new' },
    ];
    const writes: any[] = [];
    expect(await fold(thread, { self: new Uint8Array(32).fill(0xaa) }, rows, writes)).toBe(1);
    expect(thread.messages.map((m: any) => m.text), 'the stored row is not drawn twice').toEqual(['new']);
    expect(persisted).toEqual(['stream:aa:2']);
    expect(unread, 'nor counted unread').toHaveLength(1);
    expect(await Promise.all(writes), 'the pass can wait for the write').toEqual([true]);
    const askedOnce = asked;
    await fold(thread, { self: new Uint8Array(32).fill(0xaa) }, rows, []);
    expect(asked, 'what the store answered is remembered').toBe(askedOnce);
    const untouchable = { id: 'group:t', get messages(): any[] { throw new Error('read'); } };
    expect(await fold(untouchable, { self: new Uint8Array(32).fill(0xaa) }, [], [])).toBe(0);
    const chainKey = `1.0.${'cc'.repeat(32)}.4`;
    await history.putMessage({ threadId: 'group:p', createdAt: 2_000, message: { type: 'in', text: 'kept', groupChainKey: chainKey, groupRowId: groupRowIdOf(chainKey) } });
    const privateEnv: Record<string, any> = {
      ...env, groupStoredRowKeys: new Map(), groupMemberLabel: () => 'y', insertThreadMessage: (t: any, m: any) => { t.messages.push(m); },
      GROUP_SENT_AT_FUTURE_SLACK_MS: 300_000, dropGroupMessagesByChainKey: () => 0,
    };
    const privateFold = appFunctions(privateEnv, ['const GROUP_ROW_STORE_TRIES = 3;', 'const groupRowStoreRefusals = new WeakMap();', fn('function writeGroupRowToHistory(thread, message) {'),
      fn('async function groupRowsAlreadyStored(thread, keys) {'), fn('async function applyGroupMessagesToThread(thread, record, messages, writes = null) {')], 'applyGroupMessagesToThread');
    const privateThread: any = { id: 'group:p', messages: [] };
    const privateRows = [4, 5].map((seq) => ({ epoch: 1, generation: 0, senderGroupKey: new Uint8Array(32).fill(0xcc), seq, payload: { text: `row ${seq}`, sentAt: 1_000 } }));
    persisted.length = 0;
    expect(await privateFold(privateThread, { self: new Uint8Array(32).fill(0xaa), members: [] }, privateRows, [])).toBe(1);
    expect(privateThread.messages.map((m: any) => m.text)).toEqual(['row 5']);
  });

  it('R7R-10: each lane delivers a pass, waits for its writes, and says whether it kept them', async () => {
    const build = (write: () => Promise<any>) => {
      const env: Record<string, any> = {
        ensureGroupThread: () => ({ id: 'group:t', messages: [] }), groupControlFailureShownAt: new Map(), flashWalletIdentityStatus: () => {}, t: (k: string) => k,
        applyGroupMessagesToThread: async (_t: any, _r: any, _m: any, writes: any[]) => { writes.push(write()); return 1; },
        applyPublicGroupMessagesToThread: async (_t: any, _r: any, _m: any, writes: any[]) => { writes.push(write()); return 1; },
        dropGroupMessagesBySenderKey: () => 0, dropGroupMessagesByChainKey: () => 0, dropHiddenPublicGroupMessages: () => 0, moderationHideLifted: () => false,
        GROUP_ECHO_CONFIRM_MS: 600_000, refreshThreadAfterMessageChange: () => {}, encryptedMessageStore: {}, console: { warn: () => {} },
      };
      return {
        privately: appFunctions(env, [fn('async function deliverPrivateGroupPass(pass) {')], 'deliverPrivateGroupPass'),
        publicly: appFunctions(env, [fn('async function deliverPublicGroupPass(runtime, pass) {')], 'deliverPublicGroupPass'),
      };
    };
    const pass = { groupId: 'g', record: {}, messages: [{}], ownLaneRead: true, chatRead: true };
    const kept = build(async () => true);
    expect(await kept.privately(pass)).toEqual({ added: 1, stored: true });
    expect(await kept.publicly({ rereadChat: async () => {} }, pass)).toEqual({ added: 1, stored: true });
    const lost = build(async () => false);
    expect((await lost.privately(pass)).stored, 'a write the store refused keeps the marks where they stood').toBe(false);
    expect((await lost.publicly({ rereadChat: async () => {} }, pass)).stored).toBe(false);
    for (const loop of ['async function syncPrivateGroupsFromChainUnguarded() {', 'async function syncPublicGroupsFromChainUnguarded() {']) {
      expect(fn(loop)).toContain('passes = await runtime.sync({ deliver, ...(due.length < roomIds.length ? { groupIds: due } : {}) });');
      expect(fn(loop), 'and a room left long ago has its echoes aged').toContain('touched += ageLeftGroupEchoes(runtime.list(), passes);');
    }
    expect(fn('function serializeMessageForHistory(message) {')).toContain('groupRowId: message.groupChainKey ? groupRowIdOf(message.groupChainKey) : null,');
    expect(line('const GROUP_STORED_ROW_KEYS_MAX = ')).toContain('8192');
  });
});

describe('R7 — whose name a row is shown under', () => {
  it('R7R-11: a proven name alone, a self-given one beside the address; a name proven later reaches the rows already drawn', async () => {
    const proven = new Map<string, string>();
    const label = appFunctions({
      knownNameForWallet: (wallet: string) => proven.get(wallet) ?? null, shortAddress: (w: string) => `${w.slice(0, 6)}...`, t: (k: string) => k,
    }, [fn('function groupPersonLabel(wallet, declared, keyHex = null) {')], 'groupPersonLabel');
    expect(label(walletOf(0xbb), 'admin'), 'a self-given name never stands alone').toBe(`admin · ${walletOf(0xbb).slice(0, 6)}...`);
    expect(label(walletOf(0xbb), null)).toBe(`${walletOf(0xbb).slice(0, 6)}...`);
    proven.set(walletOf(0xbb), 'alice.ath');
    expect(label(walletOf(0xbb), 'admin'), 'a proven one does').toBe('alice.ath');
    const thread: any = { id: 'group:aa', messages: [{ type: 'in', senderLabel: `admin · ${walletOf(0xbb).slice(0, 6)}...`, groupChainKey: `stream:${'bb'.repeat(32)}:1`, groupPublic: { senderWallet: walletOf(0xbb) } }] };
    const updated: any[] = [];
    const relabel = appFunctions({
      threads: [thread], isPublicGroupThread: () => true, publicGroupRuntimeInstance: { get: () => ({ known: {}, members: [] }) }, groupIdOfThread: () => 'aa',
      channelProfileCacheKey: (w: string) => `k:${w}`, groupMessageSenderKey: (m: any) => String(m.groupChainKey).split(':')[1], groupPersonLabel: label,
      updateMessageInEncryptedHistory: async (_t: any, m: any) => { updated.push(m.senderLabel); }, refreshThreadAfterMessageChange: () => {}, renderThreads: () => {}, renderConversation: () => {}, console,
    }, [fn('function relabelPublicGroupRowsOf(profileKey) {')], 'relabelPublicGroupRowsOf');
    relabel(`k:${walletOf(0xbb)}`);
    expect(thread.messages[0].senderLabel).toBe('alice.ath');
    expect(updated, 'and the stored copy').toEqual(['alice.ath']);
    expect(fn('function applyVerifiedChannelUsername(profileKey, verifiedUsername) {')).toContain('relabelPublicGroupRowsOf(profileKey);');
    expect(app.split('name.textContent = groupPersonLabel(member.wallet ?? null, member.name ?? null, key);').length - 1).toBe(2);
    expect(fn('function groupMemberLabel(record, groupKey) {')).toContain('return groupPersonLabel(member?.wallet ?? null, member?.name ?? null, key);');
  });
});

describe('R7 — the private lane hands a row once, and before its marks', () => {
  it('R7R-12: a second pass hands nothing new; a pass the screen could not keep leaves the lanes\' marks and the day unread', async () => {
    const { beginCell } = await import('@ton/core');
    const { __setLaneGenerationCodeForTests, __resetLaneGenerationCodeOverridesForTests } = await import('../web/shard-address.mjs');
    const { createGroupRuntime } = await import('../web/group-runtime.mjs');
    const { groupMemberPublicKey, groupMemberSeed } = await import('../web/crypto/group-lane.mjs');
    const cell = beginCell().storeUint(0x5a5a, 16).endCell().toBoc().toString('base64');
    __setLaneGenerationCodeForTests('record', 18, cell);
    __setLaneGenerationCodeForTests('vault', 18, cell);
    onTestFinished(() => { __resetLaneGenerationCodeOverridesForTests(); });
    const bytes = (fill: number, length = 32) => new Uint8Array(length).fill(fill);
    const epoch = Math.floor(CLOCK / 86_400);
    let rows: any[] = [];
    const store = createMemoryGroupRecordStore();
    const runtime = createGroupRuntime({
      store, identity: { vaultSeed: bytes(0x91), wallet: walletOf(0x91), keyId: 'k' },
      send: async () => {}, vaultRouting: async () => ({ vaultAddress: `0:${'aa'.repeat(32)}`, feeDue: 1n }),
      readMessagesWithSource: async () => [], readStates: async () => new Map(), publishValue: 1n, now: () => CLOCK, boundary: epoch,
      random: (n: number) => new Uint8Array(n).fill(0x5c),
      lane: {
        buckets: async ({ epochs, memberPublicKeys }: any) => memberPublicKeys.flatMap((k: Uint8Array) => epochs.map((e: any) => ({ address: `0:${hex(k).slice(0, 48)}${Number(e.epoch).toString(16).padStart(16, '0')}`, epoch: Number(e.epoch), generation: 0, member: k }))),
        rosterBuckets: async () => [], readRoster: async () => [], readSnapshot: async () => null,
        read: async () => rows,
      },
    });
    const record = await runtime.create({ name: 'quiet' });
    const self = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: bytes(0x91), groupId: record.groupId }));
    const address = `0:${hex(self).slice(0, 48)}${epoch.toString(16).padStart(16, '0')}`;
    rows = [1, 2].map((seq) => ({ address, epoch, generation: 0, seq, parts: 1, kind: 1, senderGroupKey: self, payload: { text: `t${seq}`, sentAt: CLOCK }, sentAt: CLOCK, createdAt: CLOCK }));
    const seenAtDelivery: any[] = [];
    let keep = false;
    const deliver = async (pass: any) => { seenAtDelivery.push((await store.get(pass.groupId))?.seenSeq?.[address.toLowerCase()] ?? null); return keep; };
    const [refused] = await runtime.sync({ deliver });
    expect(refused.messages.map((m: any) => m.payload.text)).toEqual(['t1', 't2']);
    expect(seenAtDelivery, 'nothing marked read while the screen was handed the rows').toEqual([null]);
    expect((await store.get(refused.groupId))?.seenSeq?.[address.toLowerCase()], 'not kept: the lane\'s mark stands where it stood').toBeUndefined();
    keep = true;
    const [kept] = await runtime.sync({ deliver });
    expect(kept.messages.map((m: any) => m.payload.text), 'handed again').toEqual(['t1', 't2']);
    expect((await store.get(kept.groupId))?.seenSeq?.[address.toLowerCase()]).toBe(2);
    const [third] = await runtime.sync({ deliver });
    expect(third.messages, 'handed once').toEqual([]);
  });
});
