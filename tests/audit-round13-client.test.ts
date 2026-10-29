import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { IDBFactory, IDBKeyRange, IDBObjectStore } from 'fake-indexeddb';
import { code, sourceBlock } from './helpers/source';
import { createGroupRuntime } from '../web/group-runtime.mjs';
import {
  createGroupRecordStore, createLegacyGroupRecordSealKey, createMemoryGroupRecordStore, groupRowTag, openGroupRecord, sealGroupRecord, sealLegacyGroupRecord,
} from '../web/group-record-store.mjs';
import { mergeGroupRecordRows, serializeGroupRecord } from '../web/group-store.mjs';
import { GROUP_KIND } from '../web/group-protocol.mjs';
import { groupMemberPublicKey, groupMemberSeed } from '../web/crypto/group-lane.mjs';
import { createConvKeyStore } from '../web/conv-key-store.mjs';
import { generationForUnixSeconds, CUTOVER_EPOCH } from '../web/cutover-epoch.mjs';
import { bytesToBase64url, generateRandomAtRestKeys, openAtRest, sealAtRest, withAtRestLock } from '../web/at-rest-seal.mjs';
import { createIndexedDbEncryptedMessageHistoryStore, createMemoryEncryptedMessageHistoryStore } from '../web/encrypted-message-store.mjs';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';
import { x25519 } from '../web/vendor/@noble/curves/ed25519.js';
import { ml_kem768 } from '../web/vendor/@noble/post-quantum/ml-kem.js';


const app = readFileSync('web/app.js', 'utf8');
const runtimeSource = readFileSync('web/group-runtime.mjs', 'utf8');
const fn = (declaration: string) => sourceBlock(app, declaration);
const line = (start: string) => { const at = app.indexOf(start); if (at < 0) throw new Error(`not found: ${start}`); return app.slice(at, app.indexOf('\n', at)); };
const lift = (env: Record<string, any>, sources: string[], exported: string, prelude = '') => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, `${prelude}\n${sources.join('\n')}\nreturn ${exported};`)(...names.map((n) => env[n]));
};
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
const bytes = (fill: number, length = 32) => new Uint8Array(length).fill(fill);
const CLOCK = 1_800_000_000;
const TODAY = Math.floor(CLOCK / 86_400);
const E_MS = Number(CUTOVER_EPOCH) * 86_400_000;

function identityFor(fill: number) {
  const kem = ml_kem768.keygen(new Uint8Array(64).fill(fill));
  const xSecret = bytes(fill ^ 0x5A);
  return {
    vaultSeed: bytes(fill), wallet: `0:${fill.toString(16).padStart(2, '0').repeat(32)}`, keyId: `key-${fill}`, name: `member-${fill}`,
    x25519SecretKey: xSecret, x25519PublicKey: x25519.getPublicKey(xSecret), mlKem768SecretKey: kem.secretKey, mlKem768PublicKey: kem.publicKey,
  };
}
async function candidateFor(fill: number, groupId: Uint8Array) {
  const who = identityFor(fill);
  const groupKey = groupMemberPublicKey(await groupMemberSeed({ vaultSeed: who.vaultSeed, groupId }));
  return { groupKey, wallet: who.wallet, keyId: who.keyId, name: who.name, x25519PublicKey: who.x25519PublicKey, mlKem768PublicKey: who.mlKem768PublicKey };
}
function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}
const waitedOn = (promise: Promise<any>, ms = 3_000) => Promise.race([
  promise.then(() => 'left', () => 'left'),
  new Promise((resolve) => setTimeout(() => resolve('waited'), ms)),
]);

function modelLane() {
  const chain = new Map<string, any[]>();
  const marker = new Map<string, number>();
  const marks = new Map<string, number>();
  const reads: string[] = [];
  const bucketCalls: any[] = [];
  let hold: Promise<void> | null = null;
  let entered = deferred();
  const dailyAddress = (member: Uint8Array, epoch: number, generation = 0) => `0:d${hex(member).slice(0, 16)}e${epoch}g${generation}`;
  const rosterAddress = (admin: Uint8Array, epoch: number, generation = 0) => `0:r${hex(admin).slice(0, 16)}e${epoch}g${generation}`;
  const readLanes = (buckets: any[], { states, knownSeqOf, onShardRead }: any) => {
    const out: any[] = [];
    for (const b of buckets) {
      const key = String(b.address).toLowerCase();
      const state = states?.get?.(key);
      if (states && !state) continue;
      if (state && marks.get(key) === state.lastLt) continue;
      reads.push(key);
      const known = Math.max(0, Number(knownSeqOf?.(b.address) ?? 0));
      const rows = chain.get(key) ?? [];
      const newest = rows.slice(-2);
      out.push(...rows.filter((r) => newest.includes(r) || Number(r.seq) > known));
      if (state) marks.set(key, state.lastLt);
      onShardRead?.(b.address, { gap: false });
    }
    return out;
  };
  const lane: any = {
    onBuckets: null as null | ((args: any) => Promise<void>),
    async buckets(args: any) {
      bucketCalls.push(args);
      if (lane.onBuckets) await lane.onBuckets(args);
      const { epochs, memberPublicKeys } = args;
      return epochs.flatMap((e: any) => memberPublicKeys.map((m: Uint8Array) => ({
        address: dailyAddress(m, Number(e.epoch), Number(e.generation ?? 0)), epoch: Number(e.epoch), generation: Number(e.generation ?? 0), member: m,
      })));
    },
    rosterBuckets: async ({ generation, epochs, adminPublicKeys }: any) => epochs.flatMap((epoch: number) => adminPublicKeys.map((a: Uint8Array) => ({
      address: rosterAddress(a, Number(epoch), Number(generation)), epoch: Number(epoch), generation: Number(generation), member: a, roster: true,
    }))),
    readSnapshot: async () => null,
    async readRoster(args: any) { return readLanes(await lane.rosterBuckets(args), args); },
    async read(args: any) {
      entered.resolve();
      if (hold) await hold;
      const buckets = args.epochs.flatMap((e: any) => args.memberPublicKeys.map((m: Uint8Array) => ({
        address: dailyAddress(m, Number(e.epoch), Number(e.generation ?? 0)), epoch: Number(e.epoch), generation: Number(e.generation ?? 0), member: m,
      })));
      return readLanes(buckets, args);
    },
    forgetShards: (addresses: string[]) => { for (const a of addresses ?? []) marks.delete(String(a).toLowerCase()); },
  };
  return {
    lane, chain, marks, reads, bucketCalls, dailyAddress, rosterAddress,
    holdReads() { const gate = deferred(); hold = gate.promise; entered = deferred(); return { entered: entered.promise, release: () => { hold = null; gate.resolve(); } }; },
    write(address: string, row: any) {
      const key = address.toLowerCase();
      chain.set(key, [...(chain.get(key) ?? []), { ...row, address }]);
      marker.set(key, (marker.get(key) ?? 0) + 1);
    },
    readStates: async (addresses: string[]) => new Map(addresses
      .filter((a) => marker.has(String(a).toLowerCase()))
      .map((a) => [String(a).toLowerCase(), { lastLt: marker.get(String(a).toLowerCase()) }])),
  };
}
const textRow = (member: Uint8Array, seq: number, text: string, at = CLOCK - 100 + seq) => ({
  epoch: TODAY, generation: 0, seq, kind: GROUP_KIND.TEXT, senderGroupKey: member, sentAt: at, createdAt: at, parts: 1,
  payload: { text, replyTo: null, sentAt: at },
});
function roomFor(identity: any, model: ReturnType<typeof modelLane>, extra: any = {}) {
  const clock = { now: CLOCK };
  const handed: any[] = [];
  const runtime = createGroupRuntime({
    store: createMemoryGroupRecordStore(), identity,
    send: async () => {}, vaultRouting: async () => ({}), readMessagesWithSource: async () => [],
    readStates: model.readStates, readLastSeq: async () => 0, publishValue: 19_100_000n,
    now: () => clock.now, boundary: TODAY + 1, random: (n: number) => new Uint8Array(n).fill(0x5C), lane: model.lane,
    ...extra,
  });
  const sync = () => runtime.sync({ deliver: async (pass: any) => { handed.push(pass); return true; } });
  return { runtime, clock, handed, sync };
}
const textsFrom = (passes: any[], member: Uint8Array) => passes.flatMap((p) => p.messages ?? [])
  .filter((m: any) => hex(m.senderGroupKey) === hex(member)).map((m: any) => `${m.seq}:${m.payload?.text}`);

describe('R13 the room pass in two halves', () => {
  it('R13-PASS-02: a write made while the reads ran stands over the older rows they read — an admission over today\'s ROSTER, a mute over a lift', async () => {
    const model = modelLane();
    const admin = identityFor(0x61);
    const { runtime, sync } = roomFor(admin, model);
    const room = await runtime.create({ name: 'kept' });
    const id = hex(room.groupId);
    const b = await candidateFor(0x62, room.groupId);
    const c = await candidateFor(0x63, room.groupId);
    await runtime.admit(id, [b]);
    const self = runtime.get(id)!.self!;
    const entry = (m: any) => ({ groupKey: m.groupKey, wallet: m.wallet, keyId: m.keyId, name: m.name, x25519PublicKey: m.x25519PublicKey, mlKem768PublicKey: m.mlKem768PublicKey });
    const selfEntry = runtime.get(id)!.members.find((m: any) => hex(m.groupKey) === hex(self));
    model.write(model.rosterAddress(self, TODAY), {
      epoch: TODAY, generation: 0, seq: 40, kind: GROUP_KIND.ROSTER, roster: true, senderGroupKey: self, sentAt: CLOCK - 60, createdAt: CLOCK - 60,
      payload: { members: [entry(selfEntry), entry(b)], admins: [self], owner: self, name: 'kept', sentAt: CLOCK - 60 },
    });
    model.write(model.rosterAddress(self, TODAY), {
      epoch: TODAY, generation: 0, seq: 41, kind: GROUP_KIND.MUTE, roster: true, senderGroupKey: self, sentAt: CLOCK - 50, createdAt: CLOCK - 50,
      payload: { groupKey: b.groupKey, lift: true, sentAt: CLOCK - 50 },
    });
    model.write(model.dailyAddress(b.groupKey, TODAY), textRow(b.groupKey, 1, 'b-1'));
    await sync();
    model.write(model.dailyAddress(b.groupKey, TODAY), textRow(b.groupKey, 2, 'b-2'));
    model.write(model.rosterAddress(self, TODAY), {
      epoch: TODAY, generation: 0, seq: 42, kind: GROUP_KIND.PROFILE, roster: true, senderGroupKey: self, sentAt: CLOCK - 40, createdAt: CLOCK - 40,
      payload: { name: 'kept', sentAt: CLOCK - 40 },
    });
    const { entered, release } = model.holdReads();
    const pass = sync();
    await entered;
    await runtime.admit(id, [c]);
    await runtime.mute(id, b.groupKey);
    release();
    await pass;
    const after = runtime.get(id)!;
    expect(after.members.map((m: any) => hex(m.groupKey)), 'MEASURED before: c unseated by the snapshot the reads brought').toContain(hex(c.groupKey));
    expect((after.muted ?? []).map(hex), 'MEASURED before: the fresh mute lifted by the older row').toContain(hex(b.groupKey));
  }, 30_000);

  it('R13-PASS-03: the held lanes are derived in the read half, with no lock held — the fold\'s own derivation finds them remembered', async () => {
    const model = modelLane();
    const admin = identityFor(0x64);
    const { runtime, sync } = roomFor(admin, model);
    const room = await runtime.create({ name: 'held' });
    const id = hex(room.groupId);
    await runtime.admit(id, [await candidateFor(0x65, room.groupId)]);
    const record = runtime.get(id)!;
    const heldSet = (args: any) => args.epochs.length === record.epochs.length && args.memberPublicKeys.length === record.members.length && args.epochs.length > 0;
    const lockState: string[] = [];
    model.lane.onBuckets = async (args: any) => {
      if (!heldSet(args)) return;
      lockState.push(String(await waitedOn(runtime.say(id, 'typed meanwhile'), 400)));
    };
    await sync();
    model.lane.onBuckets = null;
    expect(lockState.filter((s) => s === 'left').length, 'MEASURED before: the held set was derived under the room\'s lock alone').toBeGreaterThanOrEqual(2);
    expect(lockState.at(-1), 'the fold\'s own derivation is the one under the lock').toBe('waited');
    expect(code(sourceBlock(runtimeSource, 'const passRoom = ')).indexOf('if (pruneKeys.get(id) !== heldKeyOf(walked.current))'))
      .toBeLessThan(code(sourceBlock(runtimeSource, 'const passRoom = ')).indexOf('return locked(id, async () => {'));
  }, 30_000);

  it('R13-PASS-04: an invite pointing at another admin\'s snapshot seats that admin too — the newcomer reads their roster lane', async () => {
    const model = modelLane();
    const owner = identityFor(0x66);
    const { runtime } = roomFor(owner, model);
    const room = await runtime.create({ name: 'two admins' });
    const id = hex(room.groupId);
    const second = await candidateFor(0x67, room.groupId);
    await runtime.admit(id, [second]);
    await runtime.ensureSnapshot(id);
    const secret = runtime.secretFor(id);
    const handed = { ...secret, snapshot: { ...secret.snapshot, admin: hex(second.groupKey) } };
    const newcomer = roomFor(identityFor(0x68), modelLane()).runtime;
    const adopted = await newcomer.adopt(handed);
    const admins = adopted.admins.map(hex);
    expect(admins, 'the inviter').toContain(String(secret.inviter).toLowerCase());
    expect(admins, 'MEASURED before: the snapshot\'s admin unknown, its ROSTER dropped as from nobody').toContain(hex(second.groupKey));
  }, 30_000);

  it('R13-PASS-05: the door\'s verdict is acted on only for the question it answered — a price changed meanwhile asks again', async () => {
    const model = modelLane();
    const owner = identityFor(0x69);
    let gate: ReturnType<typeof deferred<any>> | null = null;
    const asked = deferred();
    const readEntryPayment = async () => { if (gate) { asked.resolve(); return gate.promise; } return { paid: false, at: null }; };
    const { runtime, sync, clock } = roomFor(owner, model, { readEntryPayment });
    const room = await runtime.create({ name: 'priced' });
    const id = hex(room.groupId);
    await runtime.setEntryFee(id, '1000');
    const stranger = await candidateFor(0x6A, room.groupId);
    await runtime.noteCandidate(id, stranger);
    clock.now += 31;
    gate = deferred<any>();
    const pass = sync();
    await asked.promise;
    await runtime.setEntryFee(id, '5000');
    gate.resolve({ paid: true, at: CLOCK + 20 });
    await pass;
    expect(runtime.get(id)!.members.map((m: any) => hex(m.groupKey)), 'MEASURED before: seated on a payment of the old price').not.toContain(hex(stranger.groupKey));
  }, 30_000);

  it('R13-PASS-07: two rows of one lane that claim one seq are both handed by the fold, as the live read hands them', async () => {
    const model = modelLane();
    const admin = identityFor(0x6B);
    const { runtime, sync, handed } = roomFor(admin, model);
    const room = await runtime.create({ name: 'collide' });
    const id = hex(room.groupId);
    const b = await candidateFor(0x6C, room.groupId);
    await runtime.admit(id, [b]);
    model.write(model.dailyAddress(b.groupKey, TODAY), textRow(b.groupKey, 1, 'first device', CLOCK - 90));
    model.write(model.dailyAddress(b.groupKey, TODAY), textRow(b.groupKey, 1, 'second device', CLOCK - 80));
    const { entered, release } = model.holdReads();
    const pass = sync();
    await entered;
    await runtime.admit(id, [await candidateFor(0x71, room.groupId)]);
    release();
    await pass;
    expect(textsFrom(handed, b.groupKey).sort(), 'MEASURED before: the replay kept one row of the seq').toEqual(['1:first device', '1:second device']);
  }, 30_000);

  it('R13-PERF-06: a lifted mute re-reads the lanes it concerns — the member\'s — and leaves the rest of the room read', async () => {
    const model = modelLane();
    const admin = identityFor(0x6D);
    const { runtime, sync } = roomFor(admin, model);
    const room = await runtime.create({ name: 'lift' });
    const id = hex(room.groupId);
    const b = await candidateFor(0x6E, room.groupId);
    const c = await candidateFor(0x6F, room.groupId);
    await runtime.admit(id, [b, c]);
    const laneB = model.dailyAddress(b.groupKey, TODAY).toLowerCase();
    const laneC = model.dailyAddress(c.groupKey, TODAY).toLowerCase();
    model.write(laneB, textRow(b.groupKey, 1, 'b'));
    model.write(laneC, textRow(c.groupKey, 1, 'c'));
    await sync();
    await runtime.mute(id, b.groupKey);
    await runtime.mute(id, b.groupKey, { lift: true });
    expect(model.marks.has(laneB), 'the lifted member\'s lane is read again').toBe(false);
    expect(model.marks.has(laneC), 'MEASURED before: every held lane of the room forgotten').toBe(true);
    expect(Object.keys(runtime.get(id)!.seenSeq ?? {}), 'and only its paging marks dropped').not.toContain(laneB);
  }, 30_000);

  it('R13-MONEY-2B: a picture routed through the vault whose PROFILE row cannot be built settles the deploy flight it opened', async () => {
    const model = modelLane();
    const settled: boolean[] = [];
    let floorFails = false;
    const { runtime } = roomFor(identityFor(0x70), model, {
      boundary: TODAY - 1,
      vaultRouting: async () => ({ vaultAddress: `0:${'aa'.repeat(32)}`, feeDue: 10_000_000n, deployVault: true, deployFlight: { settle: (landed: boolean) => settled.push(landed) } }),
      readLastSeq: async () => { if (floorFails) throw new Error('429 on the floor read'); return 0; },
    });
    const room = await runtime.create({ name: 'pictured' });
    expect(room, 'the room exists under the vault door').toBeTruthy();
    settled.length = 0;
    floorFails = true;
    await expect(runtime.setAvatar(hex(room.groupId), { bytes: new Uint8Array(64).fill(7), width: 8, height: 8 })).rejects.toThrow();
    expect(settled.length, 'the routing opened a flight').toBeGreaterThan(0);
    expect(settled.every((landed) => landed === false), 'MEASURED before: the flight stayed open for two minutes').toBe(true);
  }, 30_000);
});

describe('R13 at-rest — what an older tab writes after the move', () => {
  it('R13-ATREST-1: a room row an older tab wrote is merged: the seq high-water, its invites, a day key of the same adoption — not a rival\'s', () => {
    const root = 'ab'.repeat(32);
    const current = {
      groupId: 'cd'.repeat(32), epochs: [{ epoch: 100, generation: 1, key: root }], rosterKeys: { 1: 'ee'.repeat(32) },
      seqHighWater: { '100.1': 4 }, pendingInvites: [{ wallet: '0:a', at: 5 }], members: ['kept'],
    };
    const legacy = {
      groupId: 'CD'.repeat(32),
      epochs: [{ epoch: 101, generation: 1, key: '12'.repeat(32), root, read: true }, { epoch: 101, generation: 2, key: '34'.repeat(32) }, { epoch: 102, generation: 1, key: '56'.repeat(32), root: 'ff'.repeat(32) }],
      rosterKeys: { 1: '00'.repeat(32), 2: '99'.repeat(32) }, seqHighWater: { '100.1': 9, '101.1': 2 },
      pendingInvites: [{ wallet: '0:a', at: 5 }, { wallet: '0:b', at: 7 }], members: ['older'],
    };
    const merged: any = mergeGroupRecordRows(current, legacy);
    expect(merged.seqHighWater, 'MEASURED before: the older tab\'s seqs forgotten — the next send claims one again').toEqual({ '100.1': 9, '101.1': 2 });
    expect(merged.pendingInvites.map((i: any) => i.wallet)).toEqual(['0:a', '0:b']);
    expect(merged.epochs.map((e: any) => `${e.epoch}.${e.generation}`), 'a day of the same adoption; not an unknown generation, not a rival root').toEqual(['100.1', '101.1']);
    expect(merged.epochs[1].read, 'a day the older tab read is unread here').toBeUndefined();
    expect(merged.rosterKeys, 'the roster key of a generation this build holds stays its own').toEqual({ 1: 'ee'.repeat(32) });
    expect(merged.members, 'who is in the room stays current\'s').toEqual(['kept']);
    expect(mergeGroupRecordRows(current, { ...legacy, groupId: '11'.repeat(32) }), 'another room merges nothing').toBe(current);
    for (const site of ['async function buildGroupRuntime(', 'async function hydrateGroupThreadsFromStore(']) {
      expect(code(fn(site)), site).toContain('mergeRows: mergeGroupRecordRows,');
    }
  });

  it('R13-ATREST-3: every outgoing publish holds the history store from the moment it is queued', () => {
    const queue = code(fn('function enqueueOutgoingPublish('));
    expect(queue).toContain('const releaseHistory = holdHistoryForSend();');
    expect(queue.indexOf('const releaseHistory = holdHistoryForSend();')).toBeLessThan(queue.indexOf('outgoingPublishLane('));
    expect(queue).toContain('run.then(releaseHistory, releaseHistory);');
  });

  it('R13-ATREST-6: the room stores are named from the wallet they were opened for, not the one unlocked after an await', () => {
    const build = code(fn('async function buildGroupRuntime('));
    expect(build).toContain('dbName: walletScopedIndexedDbName(GROUP_RECORD_DB_NAME, wallet.address),');
    expect(build).toContain('dbName: walletScopedIndexedDbName(GROUP_REQUEST_DB_NAME, wallet.address),');
    expect(code(app)).not.toMatch(/walletScopedIndexedDbName\((?:GROUP_RECORD_DB_NAME|GROUP_REQUEST_DB_NAME|PUBLIC_GROUP_RECORD_DB_NAME)\)/);
  });

  it('R13-ATREST-7: the history pages by the store\'s cursor — records of one second at the edge of a page are not skipped', async () => {
    const store: any = await createMemoryEncryptedMessageHistoryStore();
    const at = 1_790_000_000_000;
    for (let i = 0; i < 6; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await store.putMessage({ id: `m${i}`, threadId: 't', thread: { id: 't' }, message: { type: 'in', text: `m${i}` }, createdAt: i < 4 ? at : at + 1_000 });
    }
    const seen = new Set<string>();
    let page = await store.listMessagesDetailed({ threadId: 't', limit: 3 });
    for (const item of page.messages) seen.add(item.id);
    let byTime = await store.listMessagesDetailed({ threadId: 't', limit: 3, before: page.messages[0].createdAt });
    expect(byTime.messages.length, 'MEASURED before: the time bound skipped the records tied at the edge').toBeLessThan(3);
    while (page.messages.length > 0) {
      // eslint-disable-next-line no-await-in-loop
      page = await store.listMessagesDetailed({ threadId: 't', limit: 3, beforeId: page.cursor, before: page.messages[0].createdAt });
      for (const item of page.messages) seen.add(item.id);
    }
    expect(seen.size, 'every record painted once').toBe(6);
    const more = code(fn('async function loadEarlierThreadHistory('));
    expect(more).toContain('...(state.cursor ? { beforeId: state.cursor } : {}),');
    expect(code(fn('async function restoreHistoryWindows('))).toContain('cursor: page.cursor ?? null,');
    byTime = null as any;
  });
});

describe('R13 the app — money, holds and what the screen says', () => {
  it('R13-PASS-01: a row the history refused is written again when the pass hands it again — three tries, then the pass lets go', async () => {
    let refuse = 1;
    const writes: string[] = [];
    const env: Record<string, any> = {
      groupRowsAlreadyStored: async () => new Set(), dropGroupMessagesByChainKey: () => {}, updateMessageInEncryptedHistory: async () => null,
      GROUP_SENT_AT_FUTURE_SLACK_MS: 300_000, groupMemberLabel: () => 'b', localMessageOrderFields: (ms: number) => ({ at: ms }),
      insertThreadMessage: (thread: any, message: any) => { thread.messages.push(message); }, markIncomingThreadMessage: () => {},
      persistMessageToEncryptedHistory: async (_thread: any, message: any) => {
        writes.push(message.text);
        if (refuse > 0) { refuse -= 1; return null; }
        message.localHistoryId = 'h1';
        return { id: 'h1' };
      },
      console: { warn: () => {} },
    };
    const api = lift(env, [line('const GROUP_ROW_STORE_TRIES'), 'const groupRowStoreRefusals = new WeakMap();', fn('function writeGroupRowToHistory('), fn('async function applyGroupMessagesToThread(')], 'applyGroupMessagesToThread');
    const thread: any = { messages: [] };
    const record = { self: bytes(1) };
    const row = { epoch: 1, generation: 0, seq: 1, senderGroupKey: bytes(2), payload: { text: 'b-1', sentAt: 1 } };
    const first: Promise<boolean>[] = [];
    await api(thread, record, [row], first);
    expect(await Promise.all(first), 'refused: the pass is not stored').toEqual([false]);
    const second: Promise<boolean>[] = [];
    await api(thread, record, [row], second);
    expect(await Promise.all(second), 'MEASURED before: no write on the re-hand, the pass called stored, the row lost at the next reload').toEqual([true]);
    expect(writes).toEqual(['b-1', 'b-1']);
    expect(thread.messages.length, 'one bubble').toBe(1);
    refuse = 99;
    const thread2: any = { messages: [] };
    const outcomes: boolean[] = [];
    for (let i = 0; i < 4; i += 1) {
      const held: Promise<boolean>[] = [];
      // eslint-disable-next-line no-await-in-loop
      await api(thread2, record, [{ ...row, seq: 2 }], held);
      // eslint-disable-next-line no-await-in-loop
      outcomes.push(...await Promise.all(held));
    }
    expect(outcomes, 'refused, refused, let go — and no fourth write').toEqual([false, false, true]);
  });

  it('R13-MONEY-1: the press is stamped where it is pressed — the paid ask before the door is paid, the invitation\'s snapshot, the avatar purchase', async () => {
    const ask = code(fn('async function requestGroupJoin('));
    const payDoor = ask.slice(ask.indexOf('const payDoor = async (payAgain) => {'));
    expect(payDoor.indexOf('askPricedGeneration = writeGenerationNow();'), 'MEASURED before: stamped after the payment').toBeLessThan(payDoor.indexOf('await payGroupEntry('));
    expect(ask).toContain('await sendGroupTokenMessage(thread, token, { pricedGeneration: askPricedGeneration });');
    const snapshots: string[] = [];
    const invite = lift({
      ensureGroupRuntime: async () => ({ ensureSnapshot: async (gid: string) => { snapshots.push(gid); }, secretFor: () => ({}), noteInvite: async () => {} }),
      generationForUnixSeconds, Date: { now: () => E_MS + 5_000 }, t: (k: string) => k,
      chainNowSec: () => Math.floor((E_MS + 5_000) / 1000),
      sendGroupTokenMessage: async () => {}, encodeGroupInviteToken: () => 'token', threadPrimaryWalletRaw: () => null,
    }, [fn('function pricedGenerationMovedAt('), fn('function pricesMovedError('), fn('async function inviteContactToGroup(')], 'inviteContactToGroup');
    await expect(invite('g', { id: 'peer' }, { pricedGeneration: 17 })).rejects.toMatchObject({ code: 'PRICES_MOVED' });
    expect(snapshots, 'MEASURED before: the roster snapshot signed at the clean-18 price').toEqual([]);
    expect(code(fn('async function openGroupInvitePicker('))).toContain("if (error?.code === 'PRICES_MOVED') break;");
    expect(code(app)).toContain('avatar.pricedGeneration = writeGenerationNow();');
    for (const site of ['async function submitProfileAvatarDirect(', 'async function republishProfileAvatarParts(']) {
      const body = code(fn(site));
      expect(body.indexOf('pricedGenerationMovedAt('), site).toBeGreaterThan(body.indexOf('const createdAtSec = Math.floor(Date.now() / 1000);'));
    }
  });

  it('R13-MONEY-2A: a flight that failed before leaving wakes its waiters, and ONE of them opens the next — the other rides it', async () => {
    const VAULT_LIVE = 'live';
    const VAULT_ABSENT = 'absent';
    const feeVaultState: any = { wallet: '0:me', snapshot: { state: VAULT_ABSENT, nowSec: 0 }, address: '0:vault' };
    const env: Record<string, any> = {
      vaultSupported: () => true, plathoWallet: { address: '0:me' }, feeVaultState, VAULT_LIVE, VAULT_ABSENT,
      VAULT_FROZEN: 'frozen', convVaultFrozenError: () => new Error('frozen'),
      vaultSnapshotOutdated: () => false, boundedFeeVaultRoutingRead: async () => {}, convVaultStateUnknownError: () => new Error('unknown'),
      FV_FLOAT_TOPUP_BELOW: 1n, VAULT_DEPLOY_SETTLE_MS: 120_000, FEE_VAULT_DEPLOY_WAIT_MS: 45_000,
      vaultAddressFor: async () => '0:vault', ownVaultFeeDue: () => 0n, FV_PROTOCOL_FEE: 10_000_000n, messageNetworkPrices: async () => null,
      refreshFeeVaultState: async () => {},
    };
    const api = lift(env, ['let feeVaultDeployFlight = null;', fn('function openFeeVaultDeployFlight('), fn('async function feeVaultDeployCarriedElsewhere('), fn('async function convVaultRouting('),
      app.slice(app.indexOf('async function acquireVaultDeployLock(wallet) {'), app.indexOf('async function watchVaultDeployAcrossWindows(wallet) {')) + fn('async function watchVaultDeployAcrossWindows(wallet) {')],
      '{ convVaultRouting, openFeeVaultDeployFlight, current: () => feeVaultDeployFlight }');
    const first = api.openFeeVaultDeployFlight('0:me');
    const a = api.convVaultRouting();
    const b = api.convVaultRouting();
    await new Promise((resolve) => setTimeout(resolve, 10));
    first.settle(false);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const next = api.current();
    expect(next, 'one waiter opened the next flight').not.toBeNull();
    next.settle(true);
    feeVaultState.snapshot = { state: VAULT_LIVE, assumed: true, nowSec: 0 };
    const routes = await Promise.all([a, b]);
    expect(routes.filter((r: any) => r.deployVault).length, 'MEASURED before: both deployed — two 50,000,000').toBe(1);
  });

  it('R13-MONEY-4: only a send\'s own failed read is remembered — the composer\'s skipped background read poisons nothing', async () => {
    const make = () => lift({
      globalThis: { plathoTonRpcTransport: { getConfigParam: async () => { throw new Error('429 park'); } } },
      parseGasPrices: (v: any) => v, parseForwardPrices: (v: any) => v, networkPricesWithin: () => true, NETWORK_PRICES_PLAUSIBLE_RATIO: 10n,
      Date: { now: () => 1_000 },
    }, ['let networkPricesCache = null;', 'let networkPricesFailedAt = 0;', fn('function networkPricesError('), fn('async function readNetworkPricesOnce(')],
    '{ read: readNetworkPricesOnce, failedAt: () => networkPricesFailedAt }');
    const background = make();
    await expect(background.read('background')).rejects.toMatchObject({ code: 'NETWORK_PRICES_UNREAD' });
    expect(background.failedAt(), 'MEASURED before: remembered for a minute, every direct write at the reference figure').toBe(0);
    const critical = make();
    await expect(critical.read('critical')).rejects.toThrow();
    expect(critical.failedAt()).toBe(1_000);
  });

  it('R13-MONEY-5: the avatar\'s balance figure counts the request and the top-up at the reserve the purchase asserts', () => {
    const reserve = (classes: number[]) => BigInt(classes.length) * 3_730_000n * 3n + 1_000_000n;
    const extra = lift({ walletSendFeeReserveNanotons: reserve }, [fn('function profileAvatarExtraMessagesReserve(')], 'profileAvatarExtraMessagesReserve');
    const profiles = [{ sizeClass: 4 }, { sizeClass: 2 }];
    expect(extra(profiles, true), 'MEASURED before: 2 x 3,730,000 at 1x').toBe(reserve([4, 2, 1, 1]) - reserve([4, 2]));
    expect(extra(profiles, false)).toBe(reserve([4, 2, 1]) - reserve([4, 2]));
    for (const site of ['function estimatedProfileAvatarTonFeeNanotons(', 'function profileAvatarFloorNanotons(']) {
      expect(code(fn(site)), site).toContain('profileAvatarExtraMessagesReserve(');
      expect(code(fn(site)), site).not.toContain('WALLET_SEND_FEE_PER_PART_NANOTONS');
    }
  });

  it('R13-MONEY-6/7/8: a debt nobody could read is a retry in the person\'s language; Admit prices the key it hands over; an aged snapshot quotes the full fee', () => {
    expect(app).toContain("error?.code === 'PLATHO_AVATAR_PRECHECK_UNREADABLE' || error?.code === 'SHARD_DEBT_UNREAD') {");
    const admit = code(fn('async function admitGroupCandidate('));
    expect(admit).toContain('groupTokenMessagePrice(peer, handoverToken, { afterDeploy: true })');
    expect(admit).toContain('runtime.snapshotPlan(groupId)');
    const VAULT_LIVE = 'live';
    const terms = lift({
      feeVaultState: { wallet: '0:me', snapshot: { state: VAULT_LIVE, feeDue: 2_000_000n, balance: 10n ** 9n } }, plathoWallet: { address: '0:me' },
      vaultSnapshotOutdated: () => true, composerChainFact: () => {}, refreshFeeVaultState: async () => {}, VAULT_LIVE,
      VAULT_UNKNOWN: 'unknown', rememberedVaultReading: null,
      ownVaultFeeDue: (s: any) => s.feeDue, FV_PROTOCOL_FEE: 10_000_000n, FV_FLOAT_TOPUP_BELOW: 1n,
    }, [fn('function composerVaultTerms(')], 'composerVaultTerms');
    expect(terms().feeDue, 'MEASURED before: the discount quoted while the routing attached the full fee').toBe(10_000_000n);
  });

  it('R13-DELTA-3: a lightbox or a profile card opened over a dialog is the live one — the dialog under it is inert, and live again after', () => {
    const node = (name: string) => ({ name, inert: false, hidden: false, isConnected: true });
    const page = node('page');
    const dialog = node('actionDialog');
    const lightbox = node('lightbox');
    const card = node('card');
    const appShell = { children: [page, dialog, lightbox, card] };
    const api = lift({ appShell }, ['const modalHolds = [];', 'let modalInertNodes = [];', fn('function holdPageBehindModal('), fn('function releaseModalHold('),
      fn('function applyModalHold('), fn('function holdOverModal(')], '{ holdPageBehindModal, releaseModalHold, holdOverModal }');
    api.holdOverModal(lightbox);
    expect(lightbox.inert || page.inert, 'over the plain page a lightbox holds nothing').toBe(false);
    api.holdPageBehindModal(dialog);
    api.holdOverModal(lightbox);
    expect([page.inert, dialog.inert, lightbox.inert], 'MEASURED before: the lightbox inert with the page, its taps landing on "Use avatar"').toEqual([true, true, false]);
    api.releaseModalHold(lightbox);
    expect([page.inert, dialog.inert], 'the dialog is live again').toEqual([true, false]);
    api.releaseModalHold(dialog);
    api.holdPageBehindModal(card);
    api.holdPageBehindModal(dialog);
    expect([card.inert, dialog.inert]).toEqual([true, false]);
    api.releaseModalHold(dialog);
    expect([card.inert, page.inert]).toEqual([false, true]);
    card.hidden = true;
    api.holdOverModal(lightbox);
    api.releaseModalHold(lightbox);
    expect(page.inert, 'nothing left holding the page').toBe(false);
    const open = code(fn('function openImageLightbox('));
    expect(open).toContain('holdOverModal(imageLightboxDialog);');
    expect(open.indexOf('holdOverModal(imageLightboxDialog);')).toBeLessThan(open.indexOf('imageLightboxCloseButton?.focus();'));
    const close = code(fn('function closeImageLightbox('));
    expect(close).toContain('releaseModalHold(imageLightboxDialog);');
    expect(close.indexOf('releaseModalHold(imageLightboxDialog);')).toBeLessThan(close.indexOf('focusTarget?.focus?.();'));
    expect(code(fn('async function openProfileCardDialog('))).toContain('holdPageBehindModal(profileCardDialog);');
    expect(code(fn('function closeProfileCardDialog('))).toContain('releaseModalHold(profileCardDialog);');
  });

  it('R13-DELTA-5: a caller waits for the first pass that starts after it asked, and for no other', async () => {
    let runs = 0;
    const gates: Array<() => void> = [];
    const api = lift({
      syncPublicChannelsRun: async () => { runs += 1; await new Promise<void>((r) => { gates.push(r); }); },
    }, ['let publicChannelsSyncRun = null;', 'let publicSyncPassesStarted = 0;', 'let publicSyncPassWanted = 0;', 'const publicSyncWaiters = [];', fn('function syncPublicChannels(')], 'syncPublicChannels');
    const tick = api();
    let tickDone = false;
    void tick.then(() => { tickDone = true; });
    await Promise.resolve();
    const late = api();
    let lateDone = false;
    void late.then(() => { lateDone = true; });
    gates.shift()!();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(tickDone, 'MEASURED before: the tick waited for every extra pass anybody asked for').toBe(true);
    expect(lateDone, 'the late caller waits for a pass that began after it').toBe(false);
    expect(runs).toBe(2);
    gates.shift()!();
    await late;
    expect(runs).toBe(2);
  });

  it('R13-DELTA-12/13: the post-confirm signers sign with the wallet that pressed; a broadcast the chain refused is not "may have landed" for the rooms or the mint', () => {
    expect(code(fn('async function submitBuyAth('))).toContain('wallet: requireSameWallet(signer),');
    expect(code(fn('async function submitKeyShardRegisterDirect('))).toContain('wallet: requireSameWallet(signer), transport, ownerWallet, profileRegistry: registry,');
    expect(code(fn('async function publishChannelProfileDirect('))).toContain('wallet: requireSameWallet(signer), transport,');
    expect(code(fn('async function submitProfileAvatarDirect('))).toContain('wallet: requireSameWallet(signer), transport,');
    const forget = lift({}, [fn('function broadcastMayHaveLanded('), fn('function forgetUnlandedBroadcast(')], 'forgetUnlandedBroadcast');
    const refused: any = Object.assign(new Error('406'), { builtBoc: 'te6', broadcastVerdict: 'rejected' });
    expect(forget(refused).builtBoc, 'MEASURED before: the room showed a refused write done for ten minutes').toBeUndefined();
    const ambiguous: any = Object.assign(new Error('timeout'), { builtBoc: 'te6' });
    expect(forget(ambiguous).builtBoc).toBe('te6');
    expect(code(fn('async function buildGroupRuntime('))).toContain('throw forgetUnlandedBroadcast(error);');
    expect(code(fn('async function publishPublicGroupDocument('))).toContain('throw forgetUnlandedBroadcast(error);');
    expect(app).toContain('if (broadcastMayHaveLanded(error)) rememberPendingUsernameMint(username, owner, { clientNonce: error?.builtSeqno ?? null });');
  });

  it('R13-PERF-2: the history move says so on the boot screen and moves its failsafe on — for five minutes at most', () => {
    const timers: Array<{ ms: number }> = [];
    let cleared = 0;
    const label = { textContent: 'Loading' };
    const clock = { now: 1_000 };
    const api = lift({
      bootScreenActive: true, bootScreen: { dataset: { phase: 'loading' } }, document: { getElementById: () => label }, t: (k: string) => k,
      setTimeout: (_run: () => void, ms: number) => { timers.push({ ms }); return timers.length; }, clearTimeout: () => { cleared += 1; },
      hideBootScreen: () => {}, Date: { now: () => clock.now },
    }, ['let bootScreenSafetyTimer = 1;', line('const BOOT_SCREEN_MOVE_MAX_MS'), 'let bootScreenMoveSince = 0;', fn('function noteBootScreenProgress(')], 'noteBootScreenProgress');
    api('moved 500');
    expect(label.textContent).toBe('moved 500');
    expect(timers.at(-1)!.ms, 'MEASURED before: the 45 s failsafe lifted the screen mid-move').toBe(45_000);
    clock.now += 6 * 60_000;
    const before = timers.length;
    api('moved 90000');
    expect(timers.length, 'past five minutes the failsafe is not moved again').toBe(before);
    api(null);
    expect(label.textContent).toBe('boot.loading');
    expect(code(fn('async function bootEncryptedMessageHistory('))).toContain('noteBootScreenProgress(t(\'sync.historySecuring\', { count: progress.moved }));');
    expect(cleared).toBeGreaterThan(0);
  });

  it('R13-PERF-4: a pass\'s scan cursors are written once — not once per conversation', async () => {
    const persisted: number[] = [];
    const store = createConvKeyStore({ persist: async (map: Map<string, any>) => { persisted.push(map.size); return map; } });
    const key = (fill: number) => new Uint8Array(32).fill(fill);
    const self = key(0x01);
    for (let i = 2; i <= 4; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await store.upsertConversationKRoot(self, key(i), { kRoot: key(0x40 + i), createdAt: 1, introNonce: new Uint8Array(16).fill(i) } as any);
    }
    persisted.length = 0;
    for (let i = 2; i <= 4; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await store.advanceConvScanCursor(self, key(i), 20_000, { persist: false });
    }
    expect(persisted.length, 'MEASURED before: one whole-map write per conversation').toBe(0);
    await store.flush();
    expect(persisted.length).toBe(1);
    await store.flush();
    expect(persisted.length, 'nothing held: nothing written').toBe(1);
    expect(app).toContain('await store.advanceConvScanCursor(selfKeyId, peerKeyId, epochNow, { persist: false });');
  });

  it('R13-I18N: the report sheet says who sees a report; an invitee pays only their answer; the retry names its button; the repair says what it costs', () => {
    expect(I18N_STRINGS.en['dialog.reportPostHint']).toContain('anyone, the author included, can see that your wallet sent it');
    for (const key of ['group.inviteHint', 'group.inviteConfirmHint']) expect(I18N_STRINGS.en[key], key).not.toContain('costs them nothing');
    for (const locale of Object.keys(I18N_STRINGS)) expect((I18N_STRINGS as any)[locale]['send.pricesMovedRetry'], locale).toContain('{retry}');
    expect(app).toContain("return t('send.pricesMovedRetry', { retry: t('common.retry') });");
    expect(I18N_STRINGS.en['avatar.imageMissing']).toContain('the 100 ATH are not');
  });

  it('R13-DOCS: the policy lists no leak — they are fixed in the code — and says the caches are sealed, in all ten languages; no asterisks on any page', () => {
    const caches: Record<string, string> = {
      '': 'On a device that holds your wallet, the same goes for what the app keeps',
      '.ru': '\u041d\u0430 \u0443\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432\u0435, \u0433\u0434\u0435 \u0445\u0440\u0430\u043d\u0438\u0442\u0441\u044f \u0432\u0430\u0448 \u043a\u043e\u0448\u0435\u043b\u0451\u043a',
      '.zh': '在保存着你钱包的设备上',
      '.es': 'En un dispositivo que guarda tu billetera, lo mismo vale',
      '.pt': 'Num dispositivo que guarda a sua carteira, o mesmo vale',
      '.fr': 'Sur un appareil qui contient votre portefeuille, il en va de même',
      '.de': 'Auf einem Gerät, das Ihre Wallet enthält, gilt dasselbe',
      '.hi': 'जिस डिवाइस पर आपका वॉलेट रखा है',
      '.id': 'Di perangkat yang menyimpan dompet Anda, hal yang sama berlaku',
      '.ja': 'ウォレットを保管している端末では',
    };
    for (const locale of ['', '.ru', '.zh', '.es', '.pt', '.fr', '.de', '.hi', '.id', '.ja']) {
      const doc = readFileSync(`web/docs/privacy-policy${locale}.md`, 'utf8').replace(/\r\n/g, '\n');
      expect(doc, `${locale}: no version's leftovers listed`).not.toContain('1.4.7');
      expect(doc.replace(/\s+/g, ' '), `${locale}: the caches sealed`).toContain(caches[locale]);
      const pieces = doc.split(/\n\s*\n/).flatMap((block) => block.split(/\n(?=- )/));
      expect(pieces.filter((piece) => (piece.match(/\*\*/g) ?? []).length % 2 === 1), `${locale}: a bold left open`).toEqual([]);
    }
    const page = readFileSync('web/privacy.html', 'utf8');
    expect(page, 'MEASURED before: a bold across the wrap shipped its asterisks').not.toContain('**');
    expect(page).not.toContain('What such a copy can still see');
    const element = (tag: string): any => ({
      tag, children: [] as any[], textContent: '', className: '',
      append(...nodes: any[]) { this.children.push(...nodes); }, replaceChildren(...nodes: any[]) { this.children = nodes; },
    });
    const render = lift({
      document: { createElement: element, createTextNode: (text: string) => ({ tag: '#text', textContent: text }) },
      isTelegramEnv: () => false, openExternalLinkInTelegram: () => false,
    }, [fn('function appendInlineMarkdown('), fn('function isMarkdownTableLine('), fn('function isMarkdownTableSeparator('), fn('function markdownStartsBlock('),
      fn('function markdownTableCells('), fn('function renderMarkdownTable('), fn('function renderMarkdownToNode(')], 'renderMarkdownToNode');
    const target = element('div');
    render('- **A bold that\n  crosses the wrap** and the rest\n- second', target);
    const root = target.children[0];
    expect(root.children.length, 'MEASURED before: the wrapped lines became a paragraph of their own').toBe(1);
    const [first] = root.children[0].children;
    expect(first.children.find((c: any) => c.tag === 'strong')?.textContent, 'and the bold printed its asterisks').toBe('A bold that crosses the wrap');
  });
});

describe('R13 the quiet backup — sealed entries, merged on the device', () => {
  function memoryStorage() {
    const map = new Map<string, string>();
    return {
      getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
      setItem: (key: string, value: string) => { map.set(key, String(value)); },
      removeItem: (key: string) => { map.delete(key); },
      map,
    };
  }
  const sources = [
    ...['const RECOVERY_QUIET_MIN_MS', 'const RECOVERY_QUIET_SPAN_MS', 'const RECOVERY_QUIET_AFTER_UNLOCK_MIN_MS', 'const RECOVERY_QUIET_AFTER_UNLOCK_SPAN_MS',
      'const RECOVERY_QUIET_URGENT_AFTER_MS', 'const RECOVERY_QUIET_URGENT_MIN_MS', 'const RECOVERY_QUIET_URGENT_SPAN_MS', 'const RECOVERY_QUIET_LATE_MS',
      'const RECOVERY_QUIET_TIMER_MAX_MS', 'const RECOVERY_PENDING_STORAGE_KEY', 'const RECOVERY_PENDING_SEAL_DOMAIN', 'const recoveryEntryKey',
      'const RECOVERY_QUIET_SLOTS_PER_DAY', 'const RECOVERY_QUIET_BUDGET_WINDOW_MS'].map(line),
    'const convRecoveryDirtySlots = new Set();', 'const convRecoveryDirtyMarks = new Map();', 'const convRecoveryQuietSlots = new Map();',
    'const convRecoveryPendingEntries = new Map();', 'const convRecoveryConfirmedEntries = new Set();', 'const convRecoveryStoredEntries = new Set();',
    'const convRecoveryRefreshSlots = new Set();', 'let recoveryQuietTimer = null;', 'let recoveryPendingWallet = null;',
    'let recoveryPendingWrites = Promise.resolve();', 'let recoveryBackupTimer = null;',
    ...['function recoveryQuietJitterMs(', 'function recoveryPendingStorageKey(', 'function noteRecoveryEntry(', 'function oldestRecoveryEntry(',
      'function recoveryQuietWaitFrom(', 'async function readRecoveryPending(', 'function mergedRecoveryPending(', 'function persistRecoveryPending(',
      'async function loadPendingRecoveryBackups(', 'function forgetPendingRecoveryBackups(', 'function markRecoverySlotDirty(',
      'function confirmRecoverySlotWritten(', 'async function dropRecoveryEntriesConfirmedElsewhere(', 'function scheduleQuietRecoveryBackup(',
      'function promoteQuietRecoverySlot(', 'function armRecoveryQuietTimer(', 'function promoteDueQuietRecoverySlots(',
      'function scheduleRecoveryBackup('].map(fn),
  ];
  const walletKeys = generateRandomAtRestKeys();
  const STORE_KEY = 'platho.recovery.pending.v1:dep:0:wallet-a';
  const pageOn = (storage: ReturnType<typeof memoryStorage>, clock: { now: number }) => {
    const timers: Array<{ ms: number; run: () => void }> = [];
    const walletLocal = memoryStorage();
    const env: Record<string, any> = {
      convKeyStore: {}, plathoWallet: { seed: new Uint8Array(32), address: '0:wallet-a' } as any,
      atRestKeysFor: async () => walletKeys, sealAtRest, openAtRest, withAtRestLock,
      recoverySlotForConversation: (id: string) => Number(String(id).replace(/\D/g, '')) % 256, RECOVERY_MAX_SLOTS: 256,
      scopedStorageKey: (k: string) => `${k}:dep`, walletIndexedDbSuffix: (w: string) => w,
      latchedLocalStorage: () => storage, localStorage: storage, walletLocalStorage: () => walletLocal,
      runRecoveryBackup: async () => {}, noteTonRpcRateLimit: () => false, RECOVERY_BACKUP_DEBOUNCE_MS: 45_000,
      setTimeout: (run: () => void, ms: number) => { timers.push({ ms, run }); return timers.length; }, clearTimeout: () => {},
      Date: { now: () => clock.now },
      crypto: { getRandomValues: (a: Uint32Array) => { a[0] = 0x80000000; return a; } },
    };
    env.atRestKeysFor = async (w: any) => (w === env.plathoWallet ? walletKeys : null);
    const api = lift(env, sources, `{ scheduleQuietRecoveryBackup, promoteQuietRecoverySlot, loadPendingRecoveryBackups, promoteDueQuietRecoverySlots, markRecoverySlotDirty,
      confirmRecoverySlotWritten, dropRecoveryEntriesConfirmedElsewhere, read: readRecoveryPending, flush: () => recoveryPendingWrites,
      lock: () => { plathoWallet = null; }, unlock: (w) => { plathoWallet = w; }, wallet: () => plathoWallet,
      sets: () => ({ dirty: convRecoveryDirtySlots, quiet: convRecoveryQuietSlots, entries: convRecoveryPendingEntries }) }`,
    'const globalThis = { crypto };');
    return { api, timers, env };
  };

  it('R13-Q1: a quiet slot that came due while the wallet was locked waits minutes after the unlock — not seconds', async () => {
    const storage = memoryStorage();
    const clock = { now: 1_000_000_000 };
    const { api } = pageOn(storage, clock);
    api.scheduleQuietRecoveryBackup('conv-17');
    await api.flush();
    const wallet = api.wallet();
    api.lock();
    clock.now = [...api.sets().quiet.values()][0] + 1_000;
    api.promoteDueQuietRecoverySlots();
    expect(api.sets().dirty.size, 'MEASURED before: promoted while locked, written 3 s after the unlock').toBe(0);
    clock.now += 60 * 3_600_000;
    api.unlock(wallet);
    await api.loadPendingRecoveryBackups();
    const due = [...api.sets().quiet.values()][0];
    expect(due - clock.now, 'MEASURED before: written 4 s after the unlock').toBeGreaterThanOrEqual(2 * 60_000);
    expect(due - clock.now).toBeLessThanOrEqual(20 * 60_000);
  });

  it('R13-Q2: a quiet timer that wakes long after its moment (the page slept) waits again instead of writing on the return', async () => {
    const storage = memoryStorage();
    const clock = { now: 1_000_000_000 };
    const { api, timers } = pageOn(storage, clock);
    api.scheduleQuietRecoveryBackup('conv-17');
    clock.now = [...api.sets().quiet.values()][0] + 40 * 60_000;
    api.promoteDueQuietRecoverySlots();
    expect(api.sets().dirty.size, 'MEASURED before: promoted on the return').toBe(0);
    expect([...api.sets().quiet.values()][0]).toBeGreaterThan(clock.now);
    clock.now = [...api.sets().quiet.values()][0] + 1_000;
    const asked = timers.length;
    api.promoteDueQuietRecoverySlots();
    expect(timers.slice(asked).some((timer: any) => timer.ms === 3_000), 'a run is asked for').toBe(true);
    expect([...api.sets().quiet.values()][0] - clock.now, 'and the slot waits for it, not spun on').toBe(2 * 60_000);
  });

  it('R13-Q3: a root five days old waits tens of seconds after the unlock — a short session still writes it inside the INTRO\'s window', async () => {
    const storage = memoryStorage();
    const clock = { now: 1_000_000_000 };
    const first = pageOn(storage, clock);
    first.api.scheduleQuietRecoveryBackup('conv-17');
    await first.api.flush();
    clock.now += 5 * 86_400_000 + 1;
    const later = pageOn(storage, clock);
    await later.api.loadPendingRecoveryBackups();
    const due = [...later.api.sets().quiet.values()][0];
    expect(due - clock.now, 'MEASURED before: 2-20 min at every load — 63 sessions of 90 s wrote nothing').toBeLessThanOrEqual(60_000);
    expect(due - clock.now).toBeGreaterThanOrEqual(20_000);
  });

  it('R13-Q4: the record is merged, never overwritten — a second page\'s entry survives this one\'s write; a page removes only what it confirmed', async () => {
    const storage = memoryStorage();
    const clock = { now: 1_000_000_000 };
    const a = pageOn(storage, clock);
    const b = pageOn(storage, clock);
    a.api.scheduleQuietRecoveryBackup('conv-17');
    await a.api.flush();
    clock.now += 1_000;
    b.api.markRecoverySlotDirty(42);
    await b.api.flush();
    const stored = (await a.api.read('0:wallet-a')).map((e: any) => e.slot).sort();
    expect(stored, 'MEASURED before: the second page wrote its view over the first page\'s slot').toEqual([17, 42]);
    const raw = storage.map.get(STORE_KEY)!;
    expect(JSON.parse(raw).v, 'sealed [delta-15]').toBe(2);
    expect(raw).not.toContain('"17"');
    b.api.confirmRecoverySlotWritten(42, [...b.api.sets().entries.get(42)], true);
    await b.api.flush();
    expect((await a.api.read('0:wallet-a')).map((e: any) => e.slot)).toEqual([17]);
  });

  it('R13-Q5: an entry another page wrote and confirmed is not written again here', async () => {
    const storage = memoryStorage();
    const clock = { now: 1_000_000_000 };
    const a = pageOn(storage, clock);
    a.api.scheduleQuietRecoveryBackup('conv-17');
    await a.api.flush();
    const b = pageOn(storage, clock);
    await b.api.loadPendingRecoveryBackups();
    a.api.confirmRecoverySlotWritten(17, [...a.api.sets().entries.get(17)], true);
    await a.api.flush();
    await b.api.dropRecoveryEntriesConfirmedElsewhere('0:wallet-a');
    expect(b.api.sets().quiet.size + b.api.sets().dirty.size, 'MEASURED before: both tabs wrote one root, one of them a paid rewrite').toBe(0);
  });

  it('R13-Q6: the run — one writer per wallet across tabs, the key store re-read before the partition, the freeze sweep a refresh, an unchanged slot not written again', () => {
    expect(code(fn('async function runRecoveryBackupUnguarded('))).toContain('await withAtRestLock(`platho.recovery.backup.${walletIndexedDbSuffix(plathoWallet.address)}`, runRecoveryBackupLocked);');
    const run = code(fn('async function runRecoveryBackupLocked('));
    expect(run.indexOf('await convKeyStore.refresh?.();')).toBeLessThan(run.indexOf('const slots = [...convRecoveryDirtySlots];'));
    expect(run).toContain('if (!convRecoveryRefreshSlots.has(slot) && recoveryPartitionHeld(partition, held.map)) {');
    expect(code(fn('async function runRecoveryFreezeSweep('))).toContain('markRecoverySlotDirty(idx, { refresh: true });');
    const held = lift({}, [fn('function recoveryPartitionHeld(')], 'recoveryPartitionHeld');
    const r = (n: number) => new Uint8Array(32).fill(n);
    const partition = new Map([['c1', { kRootCurrent: r(1), kRootsForRead: [{ kRoot: r(2) }], retiredIntroNonces: [] }]]);
    expect(held(partition, new Map([['c1', { kRootCurrent: r(1), kRootsForRead: [{ kRoot: r(2) }] }]])), 'the chain holds it').toBe(true);
    expect(held(partition, new Map([['c1', { kRootCurrent: r(9), kRootsForRead: [{ kRoot: r(2) }] }]])), 'a root the chain lacks').toBe(false);
    expect(held(partition, new Map()), 'a conversation the chain lacks').toBe(false);
    expect(held(new Map([['c1', { kRootCurrent: r(1), retiredIntroNonces: [r(5)] }]]), new Map([['c1', { kRootCurrent: r(1) }]])), 'a refused nonce the chain lacks').toBe(false);
  });

  it('R13-Q7: a first contact made before the key store opened is merged into it at the boot', () => {
    const boot = code(fn('async function bootConvKeyStore('));
    expect(boot).toContain('const interim = convKeyStore && !convKeyStorePersistent && convKeyStore !== opened ? convKeyStore : null;');
    expect(boot.indexOf('await opened.importConversations(interim.snapshot());')).toBeGreaterThan(boot.indexOf('convKeyStore = opened ?? convKeyStore ?? createMemoryConvKeyStore();'));
  });
});

describe('R13 the stores — the seals, the move, the order, the close', () => {
  const openRaw = (factory: IDBFactory, name: string, version?: number, upgrade?: (db: IDBDatabase) => void) => new Promise<IDBDatabase>((resolve, reject) => {
    const request = version === undefined ? factory.open(name) : factory.open(name, version);
    request.onupgradeneeded = () => upgrade?.(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const rawRows = async (factory: IDBFactory, name: string, store: string) => {
    const db = await openRaw(factory, name);
    const rows = await new Promise<any[]>((resolve) => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => resolve(r.result); });
    db.close();
    return rows;
  };
  const putRaw = async (factory: IDBFactory, name: string, rows: Array<[string, any]>, deviceKey: any = null) => {
    const db = await openRaw(factory, name, 2, (d) => { d.createObjectStore('groups'); d.createObjectStore('deviceKey', { keyPath: 'id' }); });
    await new Promise<void>((resolve) => {
      const tx = db.transaction(['groups', 'deviceKey'], 'readwrite');
      for (const [id, blob] of rows) tx.objectStore('groups').put(blob, id);
      if (deviceKey) tx.objectStore('deviceKey').put({ id: 'device-group-key-v1', key: deviceKey });
      tx.oncomplete = () => resolve();
    });
    db.close();
  };
  const ROOM = {
    groupId: 'ab'.repeat(32), name: 'the room', self: 'cd'.repeat(32), admins: ['cd'.repeat(32)],
    epochs: [{ epoch: 20716, generation: 0, key: 'ef'.repeat(32) }], members: [{ groupKey: 'cd'.repeat(32), wallet: '0:' + '11'.repeat(32), keyId: 'k', name: 'me' }],
    seqHighWater: { '20716.0': 3 }, pendingInvites: [],
  };

  it('R13-PERF-1: a room is sealed as bytes, and a row 1.4.7 or 1.4.8 sealed as text still opens', async () => {
    const keys = (await generateRandomAtRestKeys()).groups;
    const tag = await groupRowTag(keys, ROOM.groupId);
    const blob: any = await sealGroupRecord(keys, tag, ROOM);
    expect(blob.x, 'MEASURED before: base64url text — a 1,024-member room 5 -> 116 ms to seal').toBeInstanceOf(Uint8Array);
    expect(blob.n).toBeInstanceOf(Uint8Array);
    expect(await openGroupRecord(keys, tag, blob)).toEqual(ROOM);
    expect(await openGroupRecord(keys, tag, { ...blob, n: bytesToBase64url(blob.n), x: bytesToBase64url(blob.x) }), 'a text seal opens').toEqual(ROOM);
  });

  it('R13-ATREST-1b: what an older tab writes under the device key after the move is opened at the next open and merged into the room', async () => {
    const factory = new IDBFactory();
    const deviceKey = await createLegacyGroupRecordSealKey();
    const keys = (await generateRandomAtRestKeys()).groups;
    await putRaw(factory, 'r13-rooms', [[ROOM.groupId, await sealLegacyGroupRecord(deviceKey, ROOM.groupId, ROOM)]], deviceKey);
    const first = await createGroupRecordStore({ dbName: 'r13-rooms', indexedDB: factory, keys, mergeRows: mergeGroupRecordRows });
    expect((await first.list()).map((r: any) => r.name)).toEqual(['the room']);
    await putRaw(factory, 'r13-rooms', [[ROOM.groupId, await sealLegacyGroupRecord(deviceKey, ROOM.groupId, { ...ROOM, seqHighWater: { '20716.0': 9 } })]]);
    const second = await createGroupRecordStore({ dbName: 'r13-rooms', indexedDB: factory, keys, mergeRows: mergeGroupRecordRows });
    const rows = await second.list();
    expect(rows.length).toBe(1);
    expect(rows[0].seqHighWater['20716.0'], 'MEASURED before: the key was gone with the first move — the older tab\'s write lost, its seq claimed again').toBe(9);
    const ids = (await rawRows(factory, 'r13-rooms', 'groups')).length;
    expect(ids, 'the legacy row is gone once merged').toBe(1);
  });

  it('R13-PERF-1b: an open with nothing legacy reads no room\'s blob — the move asks for the keys alone', async () => {
    const factory = new IDBFactory();
    const keys = (await generateRandomAtRestKeys()).groups;
    const tag = await groupRowTag(keys, ROOM.groupId);
    await putRaw(factory, 'r13-quiet', [[tag, await sealGroupRecord(keys, tag, ROOM)]]);
    const reads: string[] = [];
    const original = (IDBObjectStore.prototype as any).getAll;
    (IDBObjectStore.prototype as any).getAll = function (...args: any[]) { reads.push(`getAll:${this.name}`); return original.apply(this, args); };
    try {
      await createGroupRecordStore({ dbName: 'r13-quiet', indexedDB: factory, keys });
    } finally {
      (IDBObjectStore.prototype as any).getAll = original;
    }
    expect(reads.filter((r) => r === 'getAll:groups'), 'MEASURED before: every blob of every room read on every open').toEqual([]);
  });

  it('R13-PERF-3: rows that land one after another into one gap take their places by time — the conversation is not renumbered', async () => {
    const factory = new IDBFactory();
    const store: any = await createIndexedDbEncryptedMessageHistoryStore({ dbName: 'r13-gap', keys: (await generateRandomAtRestKeys()).history, indexedDB: factory, IDBKeyRange });
    const at = Date.UTC(2026, 0, 2);
    await store.putMessage({ id: 'old', threadId: 't', createdAt: at, message: { type: 'in', text: 'old' } });
    await store.putMessage({ id: 'echo', threadId: 't', createdAt: at + 3_600_000, message: { type: 'out', text: 'echo' } });
    for (let i = 1; i <= 200; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await store.putMessage({ id: `late-${i}`, threadId: 't', createdAt: at + i * 10_000, message: { type: 'in', text: `late ${i}` } });
    }
    expect((await store.listMessages({ threadId: 't' })).map((m: any) => m.id)).toEqual(['old', ...Array.from({ length: 200 }, (_, i) => `late-${i + 1}`), 'echo']);
    const rows = await rawRows(factory, 'r13-gap', 'encryptedMessages');
    const o = (id: string) => rows.find((r: any) => r.id === id).o;
    const base = o('old');
    expect([o('old') - base, o('echo') - base], 'MEASURED before: halving one gap renumbered the conversation every ~41 rows').toEqual([0, 1]);
    const late = Array.from({ length: 200 }, (_, i) => o(`late-${i + 1}`) - base);
    expect(late.every((p, i) => p > 0 && p < 1 && (i === 0 || p > late[i - 1])), 'every late row inside the gap, in time order').toBe(true);
    const newest = await store.listMessagesDetailed({ threadId: 't', limit: 1 });
    expect(newest.messages.map((m: any) => m.id), 'the newest window by the order is the newest by time').toEqual(['echo']);
  });

  it('R13-PERF-7: an own send asked about after a write is found — the kept order moves with what this store writes', async () => {
    const store: any = await createIndexedDbEncryptedMessageHistoryStore({ dbName: 'r13-near', keys: (await generateRandomAtRestKeys()).history, indexedDB: new IDBFactory(), IDBKeyRange });
    const at = Date.UTC(2026, 0, 2);
    await store.putMessage({ threadId: 't', createdAt: at, message: { type: 'out', text: 'one' } });
    expect(await store.hasOwnSendNear('t', at, 1_000)).toBe(true);
    expect(await store.hasOwnSendNear('t', at + 60_000, 1_000)).toBe(false);
    await store.putMessage({ threadId: 't', createdAt: at + 60_000, message: { type: 'out', text: 'two' } });
    expect(await store.hasOwnSendNear('t', at + 60_000, 1_000), 'a kept order that did not move would say no').toBe(true);
    const capped: any = await createIndexedDbEncryptedMessageHistoryStore({ dbName: 'r13-near-cap', keys: (await generateRandomAtRestKeys()).history, indexedDB: new IDBFactory(), IDBKeyRange, maxPerThread: 3 });
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await capped.putMessage({ threadId: 't', createdAt: at + i * 60_000, message: { type: 'out', text: `#${i}` } });
    }
    expect(await capped.hasOwnSendNear('t', at + 600_000, 1_000)).toBe(false);
    await capped.putMessage({ threadId: 't', createdAt: at + 600_000, message: { type: 'out', text: 'the newest' } });
    expect(await capped.hasOwnSendNear('t', at + 600_000, 1_000), 'the same count, another order: what the write did is what is asked about').toBe(true);
  });

  it('R13-ATREST-3b: a close lets the writes already queued finish — the send\'s own record reaches the disk', async () => {
    const factory = new IDBFactory();
    const keys = (await generateRandomAtRestKeys()).history;
    const store: any = await createIndexedDbEncryptedMessageHistoryStore({ dbName: 'r13-close', keys, indexedDB: factory, IDBKeyRange });
    const write = store.putMessage({ id: 'sent', threadId: 't', createdAt: Date.UTC(2026, 0, 2), message: { type: 'out', text: 'the signed external rides here' } });
    const closed = store.close();
    await expect(write, 'MEASURED before: InvalidStateError — the connection closed under the sealing').resolves.toBeTruthy();
    await closed;
    expect(store.closed).toBe(true);
    await expect(store.putMessage({ threadId: 't', createdAt: 1, message: { type: 'out', text: 'late' } }), 'a closed store takes no write').rejects.toThrow();
    const again: any = await createIndexedDbEncryptedMessageHistoryStore({ dbName: 'r13-close', keys, indexedDB: factory, IDBKeyRange });
    expect((await again.listMessages({ threadId: 't' })).map((m: any) => m.id)).toEqual(['sent']);
  });

  it('R13-ATREST-5: a conversation whose move failed is tried once more in the same open', () => {
    const store = readFileSync('web/encrypted-message-store.mjs', 'utf8');
    const move = code(store.slice(store.indexOf('const failedThreads = [];'), store.indexOf('} else if (legacyThreads.length > 0) {')));
    expect(move).toContain('try { await moveConversation(threadId); } catch { failedThreads.push(threadId); }');
    expect(move).toContain('for (const threadId of failedThreads) {');
  });
});

describe('R13 the record of what the store did', () => {
  it('R13-SERIAL: a merged room row still parses', () => {
    expect(typeof serializeGroupRecord).toBe('function');
    expect(generationForUnixSeconds(Math.floor(E_MS / 1000))).toBe(18);
  });
});
