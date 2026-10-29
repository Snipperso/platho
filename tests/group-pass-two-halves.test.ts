import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createGroupRuntime } from '../web/group-runtime.mjs';
import { createMemoryGroupRecordStore } from '../web/group-record-store.mjs';
import { currentGroupEpoch } from '../web/group-store.mjs';
import { GROUP_KIND } from '../web/group-protocol.mjs';
import { groupMemberPublicKey, groupMemberSeed } from '../web/crypto/group-lane.mjs';
import { x25519 } from '../web/vendor/@noble/curves/ed25519.js';
import { ml_kem768 } from '../web/vendor/@noble/post-quantum/ml-kem.js';
import { sourceBlock } from './helpers/source';


const CLOCK = 1_800_000_000;
const TODAY = Math.floor(CLOCK / 86_400);
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
const bytes = (fill: number, length = 32) => new Uint8Array(length).fill(fill);
const WINDOW = 2;

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

function modelLane() {
  const chain = new Map<string, any[]>();
  const marker = new Map<string, number>();
  const marks = new Map<string, number>();
  const reads: string[] = [];
  let hold: Promise<void> | null = null;
  let entered = deferred();
  let inFlight = 0;
  let maxInFlight = 0;
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
      const newest = rows.slice(-WINDOW);
      out.push(...rows.filter((r) => newest.includes(r) || Number(r.seq) > known));
      if (state) marks.set(key, state.lastLt);
      onShardRead?.(b.address, { gap: false });
    }
    return out;
  };
  const lane = {
    buckets: async ({ epochs, memberPublicKeys }: any) => epochs.flatMap((e: any) => memberPublicKeys.map((m: Uint8Array) => ({
      address: dailyAddress(m, Number(e.epoch), Number(e.generation ?? 0)), epoch: Number(e.epoch), generation: Number(e.generation ?? 0), member: m,
    }))),
    rosterBuckets: async ({ generation, epochs, adminPublicKeys }: any) => epochs.flatMap((epoch: number) => adminPublicKeys.map((a: Uint8Array) => ({
      address: rosterAddress(a, Number(epoch), Number(generation)), epoch: Number(epoch), generation: Number(generation), member: a, roster: true,
    }))),
    readSnapshot: async () => null,
    async readRoster(args: any) { return readLanes(await lane.rosterBuckets(args), args); },
    async read(args: any) {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        entered.resolve();
        if (hold) await hold;
        return readLanes(await lane.buckets(args), args);
      } finally { inFlight -= 1; }
    },
    forgetShards: (addresses: string[]) => { for (const a of addresses ?? []) marks.delete(String(a).toLowerCase()); },
  };
  return {
    lane, chain, marks, reads, dailyAddress, rosterAddress,
    get maxInFlight() { return maxInFlight; },
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

const textRow = (member: Uint8Array, seq: number, text: string, epoch = TODAY, generation = 0) => ({
  epoch, generation, seq, kind: GROUP_KIND.TEXT, senderGroupKey: member, sentAt: CLOCK - 100 + seq, createdAt: CLOCK - 100 + seq, parts: 1,
  payload: { text, replyTo: null, sentAt: CLOCK - 100 + seq },
});

function roomFor(identity: any, model: ReturnType<typeof modelLane>, extra: any = {}) {
  const sent: any[] = [];
  const clock = { now: CLOCK };
  const handed: any[] = [];
  const runtime = createGroupRuntime({
    store: createMemoryGroupRecordStore(),
    identity,
    send: async (messages: any[]) => { sent.push(...messages); },
    vaultRouting: async () => ({}),
    readMessagesWithSource: async () => [],
    readStates: model.readStates,
    readLastSeq: async () => 0,
    publishValue: 19_100_000n,
    now: () => clock.now,
    boundary: TODAY + 1,
    random: (n: number) => new Uint8Array(n).fill(0x5C),
    lane: model.lane,
    ...extra,
  });
  const sync = (options: any = {}) => runtime.sync({ deliver: async (pass: any) => { handed.push(pass); return options.keep ?? true; } });
  return { runtime, sent, clock, handed, sync };
}

const todayOf = (record: any) => record.epochs.find((e: any) => Number(e.epoch) === TODAY && Number(e.generation) === Number(currentGroupEpoch(record).generation));
const textsFrom = (passes: any[], member: Uint8Array) => passes.flatMap((p) => p.messages ?? [])
  .filter((m: any) => hex(m.senderGroupKey) === hex(member)).map((m: any) => Number(m.seq));
const waitedOn = (promise: Promise<any>, ms = 15_000) => Promise.race([
  promise.then(() => 'left'),
  new Promise((resolve) => setTimeout(() => resolve('waited for the pass'), ms)),
]);

describe('R12 avail-5 — a room\'s pass reads with no lock held and folds under it', () => {
  it('R12-AV5-01: a message typed while the pass reads leaves at once (MEASURED before: it waited for every read)', async () => {
    const model = modelLane();
    const me = identityFor(0x41);
    const { runtime, sync, sent } = roomFor(me, model);
    const room = await runtime.create({ name: 'busy' });
    const id = hex(room.groupId);
    const { entered, release } = model.holdReads();
    const pass = sync();
    await entered;
    const said = runtime.say(id, 'hello');
    expect(await waitedOn(said), 'the send went while the pass was still reading').toBe('left');
    expect(sent.length, 'and was signed and sent').toBeGreaterThan(0);
    release();
    const passes = await pass;
    expect(passes.length, 'the pass still folded its room').toBe(1);
  }, 30_000);

  it('R12-AV5-02: the fold does not write over the send — the next message claims the seq after it (round 2, held without waiting)', async () => {
    const model = modelLane();
    const { runtime, sync } = roomFor(identityFor(0x42), model);
    const room = await runtime.create({ name: 'busy' });
    const id = hex(room.groupId);
    const { entered, release } = model.holdReads();
    const pass = sync();
    await entered;
    const first = await runtime.say(id, 'one');
    expect(first.firstSeq).toBe(1);
    release();
    await pass;
    const lane = `${first.epoch}.${first.generation}`;
    expect(runtime.get(id)!.seqHighWater[lane], 'MEASURED with the read half\'s record committed: undefined, and the next send claimed seq 1 again (13653)').toBe(1);
    const second = await runtime.say(id, 'two');
    expect(second.firstSeq).toBe(2);
  }, 30_000);

  it('R12-AV5-03: a member admitted while the pass reads — their lane failed this pass (the day stays unread), the others\' rows are handed once, and the next pass reads only the newcomer\'s lane', async () => {
    const model = modelLane();
    const admin = identityFor(0x43);
    const { runtime, sync, handed } = roomFor(admin, model);
    const room = await runtime.create({ name: 'busy' });
    const id = hex(room.groupId);
    const b = await candidateFor(0x44, room.groupId);
    const c = await candidateFor(0x45, room.groupId);
    await runtime.admit(id, [b]);
    model.write(model.dailyAddress(b.groupKey, TODAY), textRow(b.groupKey, 1, 'from b'));
    const { entered, release } = model.holdReads();
    const pass = sync();
    await entered;
    expect(await waitedOn(runtime.admit(id, [c])), 'an admission goes while the pass reads, too').toBe('left');
    model.write(model.dailyAddress(c.groupKey, TODAY), textRow(c.groupKey, 1, 'from c'));
    release();
    await pass;
    expect(textsFrom(handed, b.groupKey), 'b\'s row, read before the admission, is handed').toEqual([1]);
    expect(textsFrom(handed, c.groupKey), 'c\'s lane was not read by this pass').toEqual([]);
    expect(todayOf(runtime.get(id)!).read === true, 'so the day is not read: MEASURED with an unread lane answered as clean, it was').toBe(false);
    expect(runtime.get(id)!.members.map((m: any) => hex(m.groupKey)), 'and the admission stands').toContain(hex(c.groupKey));
    model.reads.length = 0;
    handed.length = 0;
    await sync();
    expect(model.reads, 'the next pass reads the newcomer\'s lane and skips the lane already answered').toEqual([model.dailyAddress(c.groupKey, TODAY).toLowerCase()]);
    expect(textsFrom(handed, c.groupKey)).toEqual([1]);
    expect(textsFrom(handed, b.groupKey), 'nothing handed twice').toEqual([]);
    expect(todayOf(runtime.get(id)!).read).toBe(true);
  }, 30_000);

  it('R12-AV5-04: a lift while the pass reads — the lane read shallower than the record now asks is read again, and every word comes back', async () => {
    const model = modelLane();
    const admin = identityFor(0x46);
    const { runtime, sync, handed } = roomFor(admin, model);
    const room = await runtime.create({ name: 'busy' });
    const id = hex(room.groupId);
    const b = await candidateFor(0x47, room.groupId);
    await runtime.admit(id, [b]);
    const lane = model.dailyAddress(b.groupKey, TODAY);
    for (const seq of [1, 2, 3]) model.write(lane, textRow(b.groupKey, seq, `row ${seq}`));
    await sync();
    expect(textsFrom(handed, b.groupKey)).toEqual([1, 2, 3]);
    await runtime.mute(id, b.groupKey);
    model.write(lane, textRow(b.groupKey, 4, 'row 4'));
    handed.length = 0;
    const { entered, release } = model.holdReads();
    const pass = sync();
    await entered;
    await runtime.mute(id, b.groupKey, { lift: true });
    release();
    await pass;
    expect(model.marks.has(lane.toLowerCase()), 'the lane is forgotten: the next pass reads it whatever its marker says').toBe(false);
    await sync();
    expect(textsFrom(handed, b.groupKey).sort((x, y) => x - y), 'MEASURED with the shallow answer taken: [3, 4], and rows 1-2 never came back').toEqual([1, 2, 3, 4]);
  }, 30_000);

  it('R12-AV5-05: a pass the screen could not keep is handed over again — its lanes are read again, not skipped as unchanged', async () => {
    const model = modelLane();
    const admin = identityFor(0x48);
    const { runtime, sync, handed } = roomFor(admin, model);
    const room = await runtime.create({ name: 'busy' });
    const id = hex(room.groupId);
    const b = await candidateFor(0x49, room.groupId);
    await runtime.admit(id, [b]);
    for (const seq of [1, 2]) model.write(model.dailyAddress(b.groupKey, TODAY), textRow(b.groupKey, seq, `row ${seq}`));
    await sync({ keep: false });
    expect(textsFrom(handed, b.groupKey), 'handed, and not kept').toEqual([1, 2]);
    expect(todayOf(runtime.get(id)!).read === true).toBe(false);
    handed.length = 0;
    await sync();
    expect(textsFrom(handed, b.groupKey), 'MEASURED before: [] — the lane was skipped as unchanged and the day marked read over it').toEqual([1, 2]);
    expect(todayOf(runtime.get(id)!).read).toBe(true);
  }, 30_000);

  it('R12-AV5-06: the door\'s payments are asked with no lock held, and a payment found is acted on for the person still waiting', async () => {
    const model = modelLane();
    const owner = identityFor(0x4A);
    let answer: any = { paid: false, at: null };
    let gate: ReturnType<typeof deferred<any>> | null = null;
    const asked = deferred();
    const readEntryPayment = async () => { if (gate) { asked.resolve(); return gate.promise; } return answer; };
    const { runtime, sync, clock } = roomFor(owner, model, { readEntryPayment });
    const room = await runtime.create({ name: 'priced' });
    const id = hex(room.groupId);
    await runtime.setEntryFee(id, '1000');
    const stranger = await candidateFor(0x4B, room.groupId);
    await runtime.noteCandidate(id, stranger);
    expect(runtime.get(id)!.members.length, 'unpaid: waiting').toBe(1);
    clock.now += 31;
    gate = deferred<any>();
    const pass = sync();
    await asked.promise;
    expect(await waitedOn(runtime.say(id, 'while the chain is asked')), 'a message does not wait for the door\'s getters').toBe('left');
    gate.resolve({ paid: true, at: CLOCK + 20 });
    await pass;
    expect(runtime.get(id)!.members.map((m: any) => hex(m.groupKey)), 'the payment found is acted on under the lock').toContain(hex(stranger.groupKey));
    answer = { paid: true, at: CLOCK + 20 };
  }, 30_000);

  it('R12-AV5-07: a control write made while the pass reads is not taken back by that pass, however long its reads take', async () => {
    const model = modelLane();
    const admin = identityFor(0x4C);
    const { runtime, sync, clock } = roomFor(admin, model);
    const room = await runtime.create({ name: 'old name' });
    const id = hex(room.groupId);
    const { entered, release } = model.holdReads();
    const pass = sync();
    await entered;
    await runtime.setName(id, 'new name');
    clock.now += 700;
    release();
    await pass;
    expect(runtime.get(id)!.name, 'MEASURED with the fold\'s own clock: taken back to "old name"').toBe('new name');
    expect((runtime.get(id)!.pendingControl ?? []).map((e: any) => e.kind)).toContain(GROUP_KIND.PROFILE);
  }, 30_000);

  it('R12-AV5-08: two passes of one room never read at once', async () => {
    const model = modelLane();
    const { runtime, sync } = roomFor(identityFor(0x4D), model);
    await runtime.create({ name: 'busy' });
    const { entered, release } = model.holdReads();
    const first = sync();
    await entered;
    const second = sync();
    await new Promise((resolve) => setTimeout(resolve, 50));
    release();
    await Promise.all([first, second]);
    expect(model.maxInFlight, 'the second pass waited for the first').toBe(1);
  }, 30_000);

  it('R12-AV5-09: a removal with its new generation made while the pass reads survives the fold', async () => {
    const model = modelLane();
    const admin = identityFor(0x4E);
    const { runtime, sync } = roomFor(admin, model);
    const room = await runtime.create({ name: 'busy' });
    const id = hex(room.groupId);
    const b = await candidateFor(0x4F, room.groupId);
    const c = await candidateFor(0x50, room.groupId);
    await runtime.admit(id, [b, c]);
    const { entered, release } = model.holdReads();
    const pass = sync();
    await entered;
    await runtime.remove(id, c.groupKey, { cutReading: true });
    release();
    await pass;
    const after = runtime.get(id)!;
    expect(currentGroupEpoch(after).generation, 'MEASURED with the read half\'s record committed: generation 0 — the cut undone in silence').toBe(1);
    expect(after.members.map((m: any) => hex(m.groupKey))).not.toContain(hex(c.groupKey));
    expect((await runtime.say(id, 'after the cut')).generation, 'and the next message is written in the new generation').toBe(1);
  }, 30_000);

  it('R12-AV5-10: the pass says when its reads began, and the app judges no echo sent after that', async () => {
    const model = modelLane();
    const { runtime, sync, handed } = roomFor(identityFor(0x51), model);
    await runtime.create({ name: 'busy' });
    const before = Date.now();
    await sync();
    expect(handed[0].readFromMs).toBeGreaterThanOrEqual(before);
    expect(handed[0].readFromMs).toBeLessThanOrEqual(Date.now());

    const app = readFileSync('web/app.js', 'utf8');
    const env: Record<string, any> = {
      ensureGroupThread: (record: any) => record.thread, groupControlFailureShownAt: new Map(), flashWalletIdentityStatus: () => {}, t: (k: string) => k,
      applyGroupMessagesToThread: async () => 0, applyPublicGroupMessagesToThread: async () => 0,
      dropGroupMessagesBySenderKey: () => 0, dropGroupMessagesByChainKey: () => 0, dropHiddenPublicGroupMessages: () => 0, moderationHideLifted: () => false,
      GROUP_ECHO_CONFIRM_MS: 600_000, refreshThreadAfterMessageChange: () => {}, encryptedMessageStore: null, console: { warn: () => {} },
    };
    const names = Object.keys(env);
    const lift = (declaration: string, exported: string) => new Function(...names, `${sourceBlock(app, declaration)}\nreturn ${exported};`)(...names.map((n) => env[n]));
    const deliverPrivate = lift('async function deliverPrivateGroupPass(pass) {', 'deliverPrivateGroupPass');
    const deliverPublic = lift('async function deliverPublicGroupPass(runtime, pass) {', 'deliverPublicGroupPass');
    const readFromMs = Date.now() - 20 * 60_000;
    const echoes = () => [
      { type: 'out', meta: 'sending', groupSentAtMs: readFromMs - 60_000, text: 'sent before the reads' },
      { type: 'out', meta: 'sending', groupSentAtMs: readFromMs + 60_000, text: 'sent while they ran' },
    ];
    for (const [deliver, pass] of [
      [(p: any) => deliverPrivate(p), { ownLaneRead: true }],
      [(p: any) => deliverPublic({ rereadChat: async () => {} }, p), { chatRead: true }],
    ] as const) {
      const thread = { id: 'group:t', messages: echoes() };
      await (deliver as any)({ groupId: 'g', record: { thread }, messages: [], ...pass, readFromMs });
      expect(thread.messages.map((m) => m.meta), 'only the echo older than the reads is judged').toEqual(['not delivered', 'sending']);
      const older = { id: 'group:t', messages: echoes() };
      await (deliver as any)({ groupId: 'g', record: { thread: older }, messages: [], ...pass });
      expect(older.messages.map((m) => m.meta), 'a pass that does not say (an older runtime) judges as before').toEqual(['not delivered', 'not delivered']);
    }
  }, 30_000);
});

describe('R12 avail-5 (found beside it) — a lift made on this device brings the words back', () => {
  it('R12-AV5-11: the lanes are read again after this device lifts a mute or a hide, not skipped as unchanged', async () => {
    for (const how of ['mute', 'hide'] as const) {
      const model = modelLane();
      const admin = identityFor(0x52);
      const { runtime, sync, handed } = roomFor(admin, model);
      const room = await runtime.create({ name: 'busy' });
      const id = hex(room.groupId);
      const b = await candidateFor(0x53, room.groupId);
      await runtime.admit(id, [b]);
      for (const seq of [1, 2]) model.write(model.dailyAddress(b.groupKey, TODAY), textRow(b.groupKey, seq, `row ${seq}`));
      await sync();
      expect(textsFrom(handed, b.groupKey)).toEqual([1, 2]);
      const key = `${TODAY}.0.${hex(b.groupKey)}.1`;
      if (how === 'mute') await runtime.mute(id, b.groupKey); else await runtime.hide(id, key, { excerpt: 'row 1' });
      await sync();
      if (how === 'mute') await runtime.mute(id, b.groupKey, { lift: true }); else await runtime.hide(id, key, { lift: true });
      handed.length = 0;
      await sync();
      expect(textsFrom(handed, b.groupKey), `${how}: MEASURED before: [] — nobody wrote to the lane since, so its marker had not moved and the pass skipped it`).toEqual([1, 2]);
    }
  }, 30_000);
});

describe('R12 avail-5 (found beside it) — a fresh invite into a room this device left is not written over by a pass', () => {
  it('R12-AV5-12: the replacement waits for the fold of a pass still reading the left room, and stands after it', async () => {
    const adminModel = modelLane();
    const admin = roomFor(identityFor(0x54), adminModel);
    const room = await admin.runtime.create({ name: 'left behind' });
    const id = hex(room.groupId);
    const guestModel = modelLane();
    let release!: () => void;
    let inside!: () => void;
    const inFold = new Promise<void>((resolve) => { inside = resolve; });
    const guest = createGroupRuntime({
      store: createMemoryGroupRecordStore(), identity: identityFor(0x55), send: async () => {}, vaultRouting: async () => ({}),
      readMessagesWithSource: async () => [], readStates: guestModel.readStates, readLastSeq: async () => 0, publishValue: 19_100_000n,
      now: () => CLOCK, boundary: TODAY + 1, random: (n: number) => new Uint8Array(n).fill(0x5C), lane: guestModel.lane,
    });
    await guest.adopt(admin.runtime.secretFor(id));
    await guest.leave(id);
    expect(guest.get(id)!.leftAt).toBe(CLOCK);
    const passing = guest.sync({ deliver: async () => { inside(); await new Promise<void>((resolve) => { release = resolve; }); return true; } });
    await inFold;
    const adopting = guest.adopt(admin.runtime.secretFor(id));
    await new Promise((resolve) => setTimeout(resolve, 20));
    release();
    await passing;
    await adopting;
    expect(guest.get(id)!.leftAt ?? null, 'MEASURED with the replacement outside the lock: the pass wrote the left record back').toBeNull();
  }, 30_000);
});
