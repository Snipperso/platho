import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { beginCell } from '@ton/core';
import { __setLaneGenerationCodeForTests, __resetLaneGenerationCodeOverridesForTests } from '../web/shard-address.mjs';
import { createGroupRuntime } from '../web/group-runtime.mjs';
import { createMemoryGroupRecordStore } from '../web/group-record-store.mjs';
import { createOwnReactionStore } from '../web/public-reactions.mjs';
import { reconcileKeyedRows } from '../web/keyed-rows.mjs';
import { sweepSharedHostCookies } from '../web/storage-resecure.mjs';
import { x25519 } from '../web/vendor/@noble/curves/ed25519.js';
import { ml_kem768 } from '../web/vendor/@noble/post-quantum/ml-kem.js';
import { code, sourceBlock } from './helpers/source';
import { CLOUD_KEY, WALLET_KEY, cloudDoors, fakeCloud, sealed, settle } from './helpers/telegram-cloud-harness';
import { lockManager } from './helpers/web-locks';
import { keys, world } from './helpers/thread-list-world';


const app = readFileSync('web/app.js', 'utf8');
const css = readFileSync('web/styles.css', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const line = (start: string) => { const at = app.indexOf(start); if (at < 0) throw new Error(`not found: ${start}`); return app.slice(at, app.indexOf(String.fromCharCode(10), at)); };
const lift = (env: Record<string, any>, sources: string[], exported: string, prelude = '') => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [prelude, ...sources, `return ${exported};`].join(String.fromCharCode(10)))(...names.map((n) => env[n]));
};

describe('R22 A1–A3 — the windowed Chats list: no runaway scroll, no measure of a hidden list, the focused row kept', () => {

  it('R22-LIST-01: a list that is not laid out is not windowed, measured or drawn — owed, and drawn at the true pitch when shown (A2)', () => {
    const w = world(2_000);
    w.draw();
    w.list.scrollTop = 1_000 * 67;
    w.draw();
    const shown = keys(w.list);
    expect(shown).toContain('thread:t1000');
    w.doc.hidden = true;
    w.ordered.unshift(w.ordered.splice(1500, 1)[0]);
    w.draw();
    expect(keys(w.list), 'MEASURED before: drawn hidden at a 3-px pitch — 500 rows, and Back landed on row 636 or 80').toEqual(shown);
    expect(w.pitch(), 'nothing measured on a list with no layout').toBeUndefined();
    expect(w.owes()).toBe(true);
    w.doc.hidden = false;
    w.draw();
    expect(keys(w.list).filter((k: string) => k.startsWith('thread:')).length).toBeLessThan(80);
    expect(keys(w.list)).toContain('thread:t999');
    expect(w.pitch()).toBeUndefined();
  });

  it('R22-LIST-02: a spacer has its height when it is built and when it is adopted; a windowed list turns the browser\'s scroll anchoring off (A1)', () => {
    const w = world(2_000);
    const built = w.spacer('spacer:above', 6_697).build();
    expect(built.style.height, 'MEASURED before: built without a height and sized after a forced layout — the list ran to its end').toBe('6697px');
    const adopted = { style: { height: '10px' } };
    w.spacer('spacer:above', 700).adopt(adopted);
    expect(adopted.style.height).toBe('700px');
    w.draw();
    expect(w.list.dataset.windowed).toBe('true');
    expect(w.list.attrs['aria-label'], 'MEASURED before: 31 buttons and nothing that said 2,000').toBe('chat.listCount:2000');
    expect(world(300).list.dataset.windowed ?? 'false').toBe('false');
    expect(code(css)).toMatch(/\.thread-list\[data-windowed="true"\] \{\s*overflow-anchor: none;\s*\}/);
    const draw = code(fn('function drawThreadListRows() {'));
    expect(draw.indexOf('anchorKey = node.dataset.rowKey; anchorTop = rect.top - listTop;')).toBeLessThan(draw.indexOf('reconcileKeyedRows(threadList, entries);'));
    expect(draw).toContain('if (Math.abs(moved) > 0.5) threadList.scrollTop += moved;');
  });

  it('R22-LIST-03: the focused row stays drawn where the window let it go, and keeps the focus; a row gone hands it to a conversation, never "Add contact" (A3)', () => {
    const w = world(2_000);
    w.draw();
    const row = w.list.kids.find((k: any) => k.dataset.rowKey === 'thread:t4');
    row.focus();
    w.list.scrollTop = 1_000 * 67;
    w.draw();
    expect(w.doc.activeElement?.dataset?.rowKey, 'MEASURED before: the focus went to "Add contact", and Enter opened it').toBe('thread:t4');
    expect(keys(w.list).slice(0, 6)).toEqual(['cta', 'spacer:above', 'thread:t3', 'thread:t4', 'thread:t5', 'spacer:above-rest']);
    const above = w.list.kids.find((k: any) => k.dataset.rowKey === 'spacer:above');
    expect(above.style.height).toBe(`${3 * 67 - 3}px`);
    w.ordered.splice(4, 1);
    w.draw();
    expect(w.doc.activeElement?.label).toMatch(/^thread:/);
  });
});

describe('R22 A6 — the cross-window locks are gone (one active window, round 24); a day moved under a send is still built again', () => {
  it('R22-LOCK-01: the bounded cross-window lock is gone with the module that made it; the one active window stands at the start instead', () => {
    expect(existsSync('web/cross-window-lock.mjs'), 'the module is deleted, not left unused [round 24]').toBe(false);
    const live = code(app);
    for (const gone of ['holdCrossWindowLock', 'crossWindowLocks', 'cross-window-lock']) expect(live, `${gone} is gone [round 24]`).not.toContain(gone);
    expect(code(readFileSync('web/sw.js', 'utf8')), 'not precached for a page that imports it no more').not.toContain('cross-window-lock');
    expect(code(readFileSync('scripts/prepare_static_web_deploy.mjs', 'utf8'))).not.toContain('cross-window-lock');
    const gate = app.indexOf('\nawait holdActiveWindow();');
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(app.indexOf('\nawait resecureStorageIfDue();'));
  });

  it('R22-LOCK-02: the conversation takes no lock of its day and never refuses as CONV_LANE_BUSY; a send whose day moved after its route is built again (CONV_DAY_MOVED) before its rests and its claim', () => {
    const conv = code(fn('async function attemptConvMessagePublishDirect(context, owner = undefined) {'));
    for (const gone of ['holdCrossWindowLock', 'releaseConvLane', 'releaseRestLane', 'convLaneBusyError', 'platho-conv-send.v1:', '.lost?.()']) expect(conv, `${gone} is gone [round 24]`).not.toContain(gone);
    const at = (text: string) => { const index = conv.indexOf(text); if (index < 0) throw new Error(text); return index; };
    const moved = at('if (epochFromCreatedAtSeconds(chainNowSec()) !== route.epoch) throw convDayMovedError();');
    expect(moved, 'MEASURED before (round 22): a send that crossed midnight between its route and its signature was refused 13656, and paid').toBeGreaterThan(at('const route = await outgoingRecordShard('));
    expect(moved).toBeLessThan(at('await settleEarlierConvTails('));
    expect(at('await settleEarlierConvTails(')).toBeLessThan(at('const seq = await keyStore.nextOutgoingSeq('));
    const rules = lift({ isTonRpcTransientError: () => false, isFatalPrivateSendError: () => false }, [fn('function convDayMovedError() {'), fn('function isRecoverablePrivateSendError(error) {')],
      '{ moved: convDayMovedError, recoverable: isRecoverablePrivateSendError }');
    expect(rules.moved().code).toBe('CONV_DAY_MOVED');
    expect(rules.recoverable(rules.moved()), 'retried by the ladder: built again, from the press, for the new day').toBe(true);
  });

  it('R22-LOCK-03: a reaction press takes no lock across windows — this page\'s flight map is its one dedup — and no busy words are left to say', () => {
    const press = code(fn('async function reactTo(bar, emoji) {'));
    for (const gone of ['holdCrossWindowLock', 'platho-reactions.v1:', 'crossWindowBusyError', 'CROSS_WINDOW_BUSY', 'send.otherWindowBusy']) expect(press, `${gone} is gone [round 24]`).not.toContain(gone);
    const inFlight = press.indexOf('if (reactionsInFlight.has(flight)) return;');
    expect(inFlight).toBeGreaterThan(-1);
    expect(inFlight).toBeLessThan(press.indexOf('reactionsInFlight.set(flight, Date.now());'));
    expect(press.indexOf('reactionsInFlight.set(flight, Date.now());')).toBeLessThan(press.indexOf('sendPlathoWalletTransaction('));
    expect(press).toMatch(/finally \{\s*reactionsInFlight\.delete\(flight\);\s*\}/);
    const room = code(fn('async function sendGroupMessageFromComposer(thread, text) {'));
    expect(room).not.toContain('ROOM_LANE_BUSY');
    expect(room).not.toContain('send.otherWindowBusy');
    expect(readFileSync('web/i18n-strings.mjs', 'utf8'), 'the words of a busy other window are gone with it').not.toMatch(/"send\.otherWindowBusy"|"send\.sendingElsewhere"/);
  });
});

describe('R22 A6 / F3-6 / F3-7 — a room: no seq lock across windows any more (round 24); the floor asked twice; nothing of the store read at a message', () => {
  const CLOCK = 1_800_000_000;
  const DUMMY_CELL = beginCell().storeUint(0x5a5a, 16).endCell().toBoc().toString('base64');
  beforeAll(() => {
    __setLaneGenerationCodeForTests('record', 18, DUMMY_CELL);
    __setLaneGenerationCodeForTests('vault', 18, DUMMY_CELL);
  });
  afterAll(() => { __resetLaneGenerationCodeOverridesForTests(); });
  const bytes = (fill: number, length = 32) => new Uint8Array(length).fill(fill);
  const identityOf = () => {
    const kem = ml_kem768.keygen(new Uint8Array(64).fill(0x22));
    const xSecret = bytes(0x22 ^ 0x5a);
    return { vaultSeed: bytes(0x22), wallet: '0:' + '22'.repeat(32), keyId: 'key-22', name: 'me', x25519SecretKey: xSecret,
      x25519PublicKey: x25519.getPublicKey(xSecret), mlKem768SecretKey: kem.secretKey, mlKem768PublicKey: kem.publicKey };
  };
  const roomWorld = ({ floorFailsOnce = false } = {}) => {
    const chain = { lastSeq: new Map<string, number>(), paid: 0, floorReads: 0 };
    const store = createMemoryGroupRecordStore();
    const identity = identityOf();
    let floorFailed = false;
    const windowOf = ({ routing = async () => ({ vaultAddress: '0:' + 'aa'.repeat(32), feeDue: 10_000_000n }) } = {}) => createGroupRuntime({
      store, identity,
      send: async (messages: any[]) => {
        chain.paid += 1;
        for (const message of messages) chain.lastSeq.set(String(message.shard ?? message.address).toLowerCase(), message.seq);
        return {};
      },
      readLastSeq: async (address: string) => {
        chain.floorReads += 1;
        if (floorFailsOnce && !floorFailed) { floorFailed = true; throw Object.assign(new Error('toncenter 504'), { status: 504 }); }
        return chain.lastSeq.get(String(address).toLowerCase()) ?? 0;
      },
      vaultRouting: routing, readMessagesWithSource: async () => [], readStates: async () => new Map(),
      publishValue: 19_100_000n, now: () => CLOCK, boundary: Math.floor(CLOCK / 86_400),
      random: (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n)),
    } as any);
    return { chain, store, windowOf };
  };

  it('R22-ROOMLOCK-01: a room\'s message takes no lock across windows — the room\'s own lock orders it, the chain\'s floor answers for another device [round 24]', async () => {
    const runtime = code(readFileSync('web/group-runtime.mjs', 'utf8'));
    for (const gone of ['withRoomSeqLock', 'foldStoredSeqs', 'holdLock', 'roomSeqLockWaitMs', 'ROOM_LANE_BUSY', 'cross-window-lock', 'navigator']) expect(runtime, `${gone} is gone [round 24]`).not.toContain(gone);
    expect(runtime).toContain('return run();');
    const asked: string[] = [];
    const locks = lockManager();
    Object.defineProperty(globalThis.navigator, 'locks', { value: { request: (name: string, ...rest: any[]) => { asked.push(name); return (locks.request as any)(name, ...rest); } }, configurable: true });
    try {
      const { windowOf, chain } = roomWorld();
      const A = windowOf();
      const room = await A.create({ name: 'the kitchen' });
      const groupId = Buffer.from(room.groupId).toString('hex');
      const paidBefore = chain.paid;
      const floorsBefore = chain.floorReads;
      await expect(A.say(groupId, 'hello')).resolves.toBeTruthy();
      expect(chain.paid).toBe(paidBefore + 1);
      expect(chain.floorReads, 'the chain\'s floor, read at every message [round 21 — A3]').toBeGreaterThan(floorsBefore);
      expect(asked, 'MEASURED before: a Web Lock per room at every message, held for as long as a frozen window stayed frozen').toEqual([]);
    } finally {
      Object.defineProperty(globalThis.navigator, 'locks', { value: undefined, configurable: true });
    }
  });

  it('R22-ROOMFLOOR-01: one failed floor read does not fail the message — it is asked once more (F3-6)', async () => {
    const { windowOf, chain } = roomWorld({ floorFailsOnce: true });
    const A = windowOf();
    const room = await A.create({ name: 'the kitchen' });
    const groupId = Buffer.from(room.groupId).toString('hex');
    const paidBefore = chain.paid;
    await expect(A.say(groupId, 'hello'), 'MEASURED before: "#4 FAILED (toncenter 504 (floor read))" — the words given back').resolves.toBeTruthy();
    expect(chain.paid).toBe(paidBefore + 1);
  });

  it('R22-ROOMFOLD-01: a message reads nothing of the store — no other window\'s counters are folded in any more (F3-7; round 24)', async () => {
    const { windowOf, store } = roomWorld();
    const A = windowOf();
    const room = await A.create({ name: 'the kitchen' });
    const groupId = Buffer.from(room.groupId).toString('hex');
    let reads = 0;
    const get = store.get.bind(store);
    const list = store.list.bind(store);
    (store as any).get = async (...args: any[]) => { reads += 1; return (get as any)(...args); };
    (store as any).list = async (...args: any[]) => { reads += 1; return (list as any)(...args); };
    await expect(A.say(groupId, 'hello')).resolves.toBeTruthy();
    expect(reads, 'MEASURED before: 75.5 ms a message in a 1,024-member room (the whole record read and parsed), 23.6 in 1.4.22').toBe(0);
  });
});

describe('R22 A4 / A8 — the clock: asked again until read; its witness bounded and shared; a room asks the witness for itself', () => {
  it('R22-CLOCK-01: the site\'s clock read gives up at its bound; the witness is one read for every waiter, and no waiter waits past its own', async () => {
    let fetches = 0;
    const offsetOf = lift({
      globalThis: { fetch: (_url: string, init: any) => { fetches += 1; return new Promise((_resolve, reject) => { init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))); }); } },
      RESECURE_PATH: '/clear-site-storage', RESECURE_HEADER: 'X-Platho-Resecure',
    }, [fn('async function siteServerClockOffsetMs({ timeoutMs = 8_000 } = {}) {')], 'siteServerClockOffsetMs');
    const started = Date.now();
    expect(await offsetOf({ timeoutMs: 30 }), 'MEASURED before: a stalled request held every send waiting on it (still waiting at 26 s)').toBeNull();
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(fetches).toBe(1);
    let asked = 0;
    let answer: (v: number | null) => void = () => {};
    const witness = lift({
      siteServerClockOffsetMs: () => { asked += 1; return new Promise((resolve) => { answer = resolve; }); }, WALLET_CLOCK_TOLERANCE_MS: 60_000,
    }, [fn('async function deviceClockWitnessed({ waitMs = 8_000 } = {}) {'), 'deviceClockWitnessed.held = null;', 'deviceClockWitnessed.pending = null;'], 'deviceClockWitnessed');
    const waiters = [witness({ waitMs: 20 }), witness({ waitMs: 20 }), witness({ waitMs: 20 })];
    expect(await Promise.all(waiters), 'nobody waits past the bound').toEqual([false, false, false]);
    expect(asked, 'MEASURED before: 5 waiting sends, 5 fetches').toBe(1);
    answer(2_000);
    await settle(5);
    expect(await witness({ waitMs: 20 }), 'the late answer stands for the next one').toBe(true);
    expect(asked).toBe(1);
  });

  it('R22-CLOCK-02: a clock never read is asked again; a room that cannot trust its clock asks the witness itself; the app hands rooms that clock (A4, F7-4)', () => {
    expect(code(fn('async function refreshWalletChainClock({ force = false } = {}) {')))
      .toContain('if (walletClockInDoubt() || (!walletChainClockKnown && plathoWallet)) scheduleWalletChainClockRetry();');
    let witnessed = 0;
    const trusted = (env: Record<string, any>) => lift({ ...env, deviceClockWitnessed: async () => { witnessed += 1; return true; } },
      [fn('function walletClockTrustedNow() {'), fn('function roomClockTrusted() {')], 'roomClockTrusted');
    const held = { held: null as any };
    expect(trusted({ walletChainClockKnown: false, walletClockInDoubt: () => false, deviceClockWitnessed: held })()).toBe(false);
    expect(witnessed, 'MEASURED before: nothing asked — the room stopped at its old day for the rest of the session').toBe(1);
    expect(trusted({ walletChainClockKnown: true, walletClockInDoubt: () => false })()).toBe(true);
    expect(witnessed).toBe(1);
    expect(code(app)).toContain('clock: { trusted: () => roomClockTrusted(), settle: () => awaitWalletChainClock({ requireSettled: true }) },');
    const now = Date.now();
    const trustedNow = (known: boolean, doubt: boolean, heldWitness: any) => lift({ walletChainClockKnown: known, walletClockInDoubt: () => doubt,
      deviceClockWitnessed: { held: heldWitness } }, [fn('function walletClockTrustedNow() {')], 'walletClockTrustedNow')();
    expect(trustedNow(true, false, null)).toBe(true);
    expect(trustedNow(true, true, null)).toBe(false);
    expect(trustedNow(false, false, { at: now, ok: true })).toBe(true);
    expect(trustedNow(false, false, { at: now - 11 * 60_000, ok: true })).toBe(false);
    expect(trustedNow(false, false, null)).toBe(false);
  });

  it('R22-CLOCK-03: a long wait for a clock never read asks the witness after the short bound and goes on when it vouches (F3-8)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const wait = lift({
        walletChainClockOffsetMs: () => 0, walletChainClockKnown: false, walletClockInDoubt: () => false, plathoWallet: { address: 'W' },
        walletChainClockRead: null, walletChainClockReadAt: 0, refreshWalletChainClock: () => new Promise(() => {}),
        chainClockPendingError: () => Object.assign(new Error('pending'), { code: 'CHAIN_CLOCK_PENDING' }),
        deviceClockWitnessed: async () => true,
      }, [fn('async function awaitWalletChainClock({ timeoutMs = 4_000, requireSettled = false } = {}) {')], 'awaitWalletChainClock');
      let done = false;
      const room = wait({ timeoutMs: 20_000, requireSettled: true }).then(() => { done = true; });
      await vi.advanceTimersByTimeAsync(4_100);
      expect(done, 'MEASURED before: 20.1 s from the press to the send, the site answering in 0.1 s (4.0 s in 1.4.22)').toBe(true);
      await room;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('R22 A5 — a channel\'s name proof the lane gives up at a lock is asked again', () => {
  it('R22-NAMEPROOF-01: dropped unrun, the proof leaves no flight behind — the next re-adoption queues it again', async () => {
    let proofs = 0;
    const api = lift({
      channelProfileCacheKey: (w: string) => w, plathoUsernameIdentity: (name: string) => (name ? { value: name } : null), rawWalletAddress: (w: string) => w,
      applyVerifiedChannelUsername: () => {}, publicChannelProfileCache: {}, pendingChannelProfileOverlay: new Map(), nowSec: () => 1_000, CHANNEL_USERNAME_VERIFY_TTL_SEC: 21_600,
      criticalChainReadOptions: () => ({}), verifiedPlathoUsernameIdentityForWallet: async () => { proofs += 1; return null; },
      verifiedPlathoUsernameOwnerCache: new Map(), canonicalUsernameDisplay: (v: string) => v,
    }, [fn('function createSerialLane() {'), line('const enqueueUsernameHygiene = createSerialLane();'), fn('function queueUsernameHygiene(task, options = {}) {'),
      fn('function channelProfileDeclaresOtherName(key, value) {'), fn('function verifyChannelUsernameClaim(authorWallet, claimedName) {')], '{ verify: verifyChannelUsernameClaim, lane: enqueueUsernameHygiene }');
    let unblock: () => void = () => {};
    void api.lane(() => new Promise<void>((resolve) => { unblock = resolve; }));
    api.verify('EQ_chan', 'bob');
    await settle(5);
    expect(api.lane.drop(), 'a lock drops the waiting proof unrun').toBe(1);
    await settle(5);
    unblock();
    await settle(5);
    api.verify('EQ_chan', 'bob');
    await settle(10);
    expect(proofs, 'MEASURED before: never proven again in the page — a sold name kept showing as proven').toBe(1);
  });
});

describe('R22 A9 — the dialog over a dressed channel\'s card wears its own panel\'s ink', () => {
  it('R22-DIALOG-01: every dialog sets the ink of the panel it paints; a theme flip repaints the dialog with the card', () => {
    const rule = code(css).match(/\.recipient-dialog,\s*\.action-dialog,\s*\.docs-dialog,\s*\.install-dialog \{[^}]*\}/)?.[0] ?? '';
    expect(rule, 'MEASURED before: "Security code" #eef4f2 on #f5f9f8, 1.05:1').toContain('color: var(--text);');
    const painted: any[] = [];
    const settleCard = lift({
      channelDressActive: true, channelLookKey: null, profileCardDialog: { hidden: false }, identityPopover: null, identityPopoverAnchor: null,
      actionDialog: { hidden: false, dataset: { viewerPalette: '--text' } }, paintViewerPalette: (el: any, on: boolean) => { painted.push([el, on]); },
    }, [fn('function settleProfileCardPalette() {')], 'settleProfileCardPalette');
    settleCard();
    expect(painted.map(([, on]) => on)).toEqual([true, true]);
  });
});

describe('R22 A10 — reactions: a refused write keeps this window\'s marks; an unchanged list is not parsed again', () => {
  const refusingStorage = () => {
    const items = new Map<string, string>();
    return { items, getItem: (k: string) => items.get(k) ?? null, setItem: () => { throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' }); }, removeItem: () => {} };
  };
  it('R22-REACT-01: localStorage full — what this window pressed is not taken for unpressed when another window\'s list is read', () => {
    const storage = refusingStorage();
    const store = createOwnReactionStore({ storage, wallet: 'W' } as any);
    const shard = '0:' + 'ab'.repeat(32);
    store.note(shard, 7, 2);
    store.notePending(shard, 7, 2, { since: Date.now(), floor: 1 });
    storage.items.set('platho.public.reactions.v1:w', JSON.stringify([`${shard}|5|3`]));
    storage.items.set('platho.public.reactions.pending.v1:w', JSON.stringify([[`${shard}|5|3`, { since: Date.now(), floor: 2 }]]));
    expect(store.has(shard, 7, 2), 'MEASURED before: forgotten at the next reload — pressed and paid again (1.4.22 paid 1, 1.4.23 paid 2)').toBe(true);
    store.settlePending(shard, 9, 1);
    expect(store.pendingPresses().map((p: any) => p.emoji), 'its pending press kept too, beside the other window\'s').toEqual([3, 2]);
    expect(store.has(shard, 5, 3), 'MEASURED before (F3-2): the second writer wrote over the other window\'s marks').toBe(true);
  });

  it('R22-REACT-02: a check of an unchanged list parses nothing (F6-3: 5.1-7.2 ms a press at the 4,096-mark bound)', () => {
    const items = new Map<string, string>();
    const storage = { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => { items.set(k, v); }, removeItem: (k: string) => { items.delete(k); } };
    const store = createOwnReactionStore({ storage, wallet: 'W' } as any);
    const shard = '0:' + 'cd'.repeat(32);
    for (let i = 0; i < 50; i += 1) store.note(shard, i, 1);
    const parse = vi.spyOn(JSON, 'parse');
    try {
      for (let i = 0; i < 20; i += 1) store.has(shard, i, 1);
      expect(parse).not.toHaveBeenCalled();
      items.set([...items.keys()].find((k) => !k.includes('pending'))!, JSON.stringify([]));
      expect(store.has(shard, 3, 1)).toBe(false);
      expect(parse).toHaveBeenCalled();
    } finally {
      parse.mockRestore();
    }
  });
});

describe('R22 A11 — the profile cache: the reader\'s own profiles stay in memory; only the written copy is bounded by size', () => {
  it('R22-PROFCACHE-01: past 2,000,000 characters every followed channel stays held, and what is written stays within the bound', () => {
    const written: any[] = [];
    const big: Record<string, any> = {};
    const kept = new Set<string>();
    for (let i = 0; i < 1_208; i += 1) { big[`w${i}`] = { fetchedAt: i, description: 'x'.repeat(2_000) }; kept.add(`w${i}`); }
    for (let i = 0; i < 300; i += 1) big[`s${i}`] = { fetchedAt: 10_000 + i, description: 'y'.repeat(100) };
    const api = lift({
      channelProfilesKeptFirst: () => kept, writePublicChannelProfileCache: (_storage: any, cache: any) => { written.push(cache); }, publicChannelStorage: () => null,
      setTimeout: (run: () => void) => { run(); return 1; }, __big: big,
    }, [line('const PUBLIC_CHANNEL_PROFILE_CACHE_MAX = '), line('const PUBLIC_CHANNEL_PROFILE_KEPT_CEILING = '), line('const PUBLIC_CHANNEL_PROFILE_CACHE_MAX_CHARS = '),
      fn('function boundChannelProfileCache(cache, keptFirst = null, maxChars = PUBLIC_CHANNEL_PROFILE_CACHE_MAX_CHARS) {'), 'let profileCachePersistTimer = null;',
      'let publicChannelProfileCache = __big;', fn('function persistChannelProfileCache({ stampOnly = false } = {}) {')], '{ persist: persistChannelProfileCache, held: () => publicChannelProfileCache }');
    api.persist();
    const held = api.held();
    expect([...kept].every((key) => held[key]), 'MEASURED before: 254 of 1,208 followed channels and every stranger left memory at each write').toBe(true);
    expect(JSON.stringify(written[0]).length).toBeLessThanOrEqual(2_000_000);
  });
});

describe('R22 F7-1 / F2-10 / F2-5 — the 24 words: a 1.4.21 / 1.4.22 restore taken as confirmed; the cloud read once; a silent cloud holds the unlock 3 s', () => {
  it('R22-SEED-01: the backfill is remembered only once the marker is in the cloud; the gate waits three seconds for a silent one', async () => {
    const items = new Map<string, string>();
    const storage = new Map<string, string>();
    let refuse = true;
    let reads = 0;
    const api = lift({
      telegramCloudStorage: () => ({}), telegramLaunchedByOfficialBot: () => true, plathoCloudDataClearing: false, plathoLocalDataClearing: false,
      telegramCloudRead: async (key: string) => { reads += 1; return { ok: true, value: items.get(key) ?? null }; },
      telegramCloudSet: async (key: string, value: string) => { if (refuse) return false; items.set(key, value); return true; },
      delay: (ms: number) => new Promise((resolve) => { setTimeout(resolve, Math.min(ms, 30)); }),
      derivePlathoWalletTag: async () => 'ab'.repeat(16), plathoWallet: { address: 'EQ_A' },
      readEncryptedPlathoWalletRecord: () => ({ salt: 'SALT-1' }),
      localStorageOrNull: () => ({ getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, String(v)) }),
    }, [app.slice(app.indexOf('const TELEGRAM_SEED_CONFIRMED_CLOUD_KEY = '), app.indexOf('async function enforceTelegramSeedBackupGate(wallet, { force = false, cloudSaid = null } = {}) {'))],
    '{ bring: bringSeedConfirmedToTelegramCloud }');
    api.bring({ address: 'EQ_A' });
    await settle(20);
    expect(storage.get('platho.wallet.telegram.seedConfirmedSeen.v1'), 'a refused write is not "said there"').toBeUndefined();
    refuse = false;
    api.bring({ address: 'EQ_A' });
    await settle(20);
    expect(storage.get('platho.wallet.telegram.seedConfirmedSeen.v1')).toBe('SALT-1');
    const before = reads;
    api.bring({ address: 'EQ_A' });
    await settle(20);
    expect(reads, 'MEASURED before: the list read at every unlock, for good').toBe(before);
    expect(code(fn('async function enforceTelegramSeedBackupGate(wallet, { force = false, cloudSaid = null } = {}) {')),
      'MEASURED before: "unlocked" at +8.5 s while Telegram was silent').toContain("cloud = await Promise.race([reading, delay(3_000).then(() => 'late')]);");
  });
});

describe('R22 — the smaller ones', () => {
  it('R22-TDZ-01: channelLookKey is declared above the boot\'s awaits (F5-3)', () => {
    const declared = app.indexOf('\nlet channelLookKey = null;');
    expect(declared).toBeGreaterThan(-1);
    expect(declared, 'MEASURED before: declared below the second top-level await — a dialog opened in the first moments read it in its TDZ')
      .toBeLessThan(app.indexOf('\nlet channelDressActive = false;') + 600);
  });

  it('R22-COOKIE-01: the shared host\'s sweep expires a nameless cookie as it shows, and every form partitioned too (F5-1)', () => {
    const writes: string[] = [];
    const doc: any = { get cookie() { return 'a=1; nnnnnnnn; b=2'; }, set cookie(value: string) { writes.push(value); } };
    expect(sweepSharedHostCookies(doc, { hostname: 'app1.tgcloud.ai' })).toBe(3);
    expect(writes).toHaveLength(18);
    expect(writes.filter((w) => w.startsWith('nnnnnnnn; ')), 'MEASURED before: "nnnnnnnn=" — a cookie of that NAME, the nameless one kept').toHaveLength(6);
    expect(writes.filter((w) => w.endsWith('; Partitioned')), 'MEASURED before: a Partitioned cookie never addressed').toHaveLength(9);
    expect(sweepSharedHostCookies(doc, { hostname: 'platho.app' })).toBe(0);
  });

  it('R22-SMALL-01: a room text past the readers\' cut is its echo\'s copy (F3-5); the opened post takes the focus (F4-5); a gift owner read is not skipped in a park (F1-I2)', () => {
    expect(code(fn('function applyGroupMessagesToThread('))).toContain("String(row.payload?.text ?? '') !== String(held.text ?? '').slice(0, GROUP_TEXT_MAX_CHARS)");
    expect(code(fn('function focusOpenedPublicPost() {'))).toContain('if (publicPostDetail?.getClientRects?.().length) publicPostDetailTitle.focus({ preventScroll: true });');
    expect(code(fn('async function verifyTelegramGiftItemOnChain(itemAddress, { fresh = false } = {}) {'))).toContain("{ priority: 'critical', cacheTtlMs: 0, skipIfRateLimited: false }");
  });
});

describe('R22 A7 — the vault deploy lock: the vault read at every new hold; another wallet\'s hold let go', () => {
  const windowOf = (locks: any, chain: { live: boolean; reads: number }, { readAt = 0 } = {}) => lift({
    globalThis: { navigator: { locks } },
    vaultSupported: () => true, plathoWallet: { address: 'W' }, VAULT_LIVE: 'live', VAULT_ABSENT: 'absent', VAULT_FROZEN: 'frozen',
    FV_PROTOCOL_FEE: 10_000_000n, FV_FLOAT_TOPUP_BELOW: 1n, convVaultFrozenError: () => new Error('frozen'),
    vaultSnapshotOutdated: () => false, boundedFeeVaultRoutingRead: async () => {},
    convVaultStateUnknownError: () => Object.assign(new Error('the vault could not be read'), { code: 'CONV_VAULT_STATE_UNKNOWN' }),
    ownVaultFeeDue: () => 0n, vaultAddressFor: async () => 'V', messageNetworkPrices: async () => null,
    VAULT_DEPLOY_SETTLE_MS: 2_000, FEE_VAULT_DEPLOY_WAIT_MS: 2_000, VAULT_DEPLOY_WATCH_PAUSES_MS: [5, 5, 5, 5], __chain: chain, __readAt: readAt,
  }, [
    "let feeVaultState = { wallet: 'W', address: 'V', snapshot: { state: 'absent', nowSec: __readAt } };",
    "async function refreshFeeVaultState() { __chain.reads += 1; const snapshot = __chain.live ? { state: VAULT_LIVE, balance: 10n ** 9n, nowSec: Math.floor(Date.now() / 1000) } : { state: VAULT_ABSENT, nowSec: Math.floor(Date.now() / 1000) }; feeVaultState = { wallet: 'W', address: 'V', snapshot }; if ((snapshot.state === VAULT_LIVE || snapshot.state === VAULT_FROZEN) && acquireVaultDeployLock.held?.watching === true) releaseVaultDeployLock('W'); }",
    fn('async function convVaultRouting() {'), 'let feeVaultDeployFlight = null;',
    fn('function openFeeVaultDeployFlight(wallet) {'), fn('function settleFeeVaultDeployFlight(wallet, landed, flight = null) {'),
    fn('async function feeVaultDeployCarriedElsewhere(wallet) {'),
    fn('async function acquireVaultDeployLock(wallet) {'), fn('function renewVaultDeployHold(wallet) {'), fn('function heldVaultDeployLock(wallet) {'),
    fn('function releaseVaultDeployLock(wallet = null) {'), fn('async function watchVaultDeployAcrossWindows(wallet) {'),
  ], '{ route: convVaultRouting, settle: settleFeeVaultDeployFlight, release: releaseVaultDeployLock, acquire: acquireVaultDeployLock }');

  it('R22-VAULT-01: a window that decides after the other\'s hold ended reads the vault first, and rides the one the other made (F1-5)', async () => {
    const locks = lockManager();
    const chain = { live: false, reads: 0 };
    const one = windowOf(locks, chain);
    const first = await one.route();
    expect(first.deployVault).toBe(true);
    chain.live = true;
    one.settle('W', true, first.deployFlight);
    await settle(40);
    expect(locks.holding('platho-vault-deploy.v1:W')).toBe(false);
    const two = windowOf(locks, chain);
    expect((await two.route()).deployVault, 'MEASURED before: deployed a second time — 50,000,000 more into the float').toBe(false);
  });

  it('R22-VAULT-02: a hold of the wallet left behind is let go — by a wallet switch, and by another wallet\'s hold (F1-6)', async () => {
    const locks = lockManager();
    const w = windowOf(locks, { live: false, reads: 0 });
    await w.acquire('W');
    expect(locks.holding('platho-vault-deploy.v1:W')).toBe(true);
    await w.acquire('X');
    expect(locks.holding('platho-vault-deploy.v1:W'), 'MEASURED before: W\'s lock held until the page closed').toBe(false);
    expect(locks.holding('platho-vault-deploy.v1:X')).toBe(true);
    w.release();
    expect(code(fn("function clearWalletScopedRuntimeState(reason = 'wallet changed') {"))).toContain('releaseVaultDeployLock();');
  });
});

describe('R22 — the ones left on the first pass', () => {
  it('R22-TAILS-01: a rest owed on this shard-day is settled first, from this window\'s own conversation — no history read for another window\'s, no lock (F1-4; round 24)', async () => {
    const resumed: any[] = [];
    const cleared: any[] = [];
    let historyReads = 0;
    const settleTails = lift({
      historyStoreFor: () => { historyReads += 1; return null; },
      resumeConvPartialTail: async ({ thread, message }: any, captured: any, _transport: any, owner: any) => { resumed.push({ thread, message, captured, owner }); },
      clearPrivateSendRetry: (message: any) => { cleared.push(message); },
      isRecoverablePrivateSendError: () => false, convEarlierRestPendingError: () => new Error('pending'),
    }, [fn('async function settleEarlierConvTails(thread, message, address, transport, signer) {')], 'settleEarlierConvTails');
    const rest = (id: string, address: string) => ({ id, type: 'out', convDirectSend: { address, partialTail: { messages: [1] } } });
    const photos = rest('the photos', 'EQshard');
    const sending = rest('did they arrive?', 'EQshard');
    const thread = { id: 'T', messages: [photos, rest('elsewhere', 'EQother'), { id: 'sent', convDirectSend: { address: 'EQshard', partialTail: null } }, sending] };
    await settleTails(thread, sending, 'EQshard', {}, { address: 'W' });
    expect(resumed.map((r) => r.message.id), 'MEASURED before: the new message landed above the rest, the rest refused 13653 twice, paid').toEqual(['the photos']);
    expect(resumed[0].message, 'MEASURED before (F1-3): finished on a copy outside the thread, confirmed nowhere — the thread\'s own object now').toBe(photos);
    expect([resumed[0].thread, resumed[0].captured, resumed[0].owner]).toEqual([thread, photos.convDirectSend, 'W']);
    expect(cleared, 'settled here: its own ladder has nothing left to do').toEqual([photos]);
    expect(historyReads, 'MEASURED before (round 23 — F6-1): 16 records opened at a send, +56 ms a picture').toBe(0);
    const conv = code(fn('async function attemptConvMessagePublishDirect(context, owner = undefined) {'));
    expect(conv, 'the rest\'s own retry: straight to its resume, no lane lock').toContain('if (captured?.partialTail) return resumeConvPartialTail(context, captured, transport, signer?.address ?? null);');
    expect(conv).not.toContain('releaseRestLane');
  });

  it('R22-A11Y-01: the list, a group, is named by how many conversations it holds, however few are drawn (F4-6)', () => {
    expect(readFileSync('web/index.html', 'utf8')).toContain('<div class="thread-list" id="threadList" role="group"></div>');
    const draw = code(fn('function drawThreadListRows() {'));
    expect(draw).toContain("const listLabel = t('chat.listCount', { count: ordered.length });");
    const named = draw.indexOf("threadList.setAttribute('aria-label', listLabel)");
    expect(named).toBeGreaterThan(-1);
    expect(named).toBeLessThan(draw.indexOf('if (!windowed) return;'));
  });

  it('R22-QSIMPORT-01: the quick start steps aside for a key file, and is dismissed for good only once the import took (F2-6)', () => {
    const handler = code(app.slice(app.indexOf('quickStartImportButtonEl?.addEventListener('), app.indexOf('quickStartBackButton?.addEventListener(')));
    expect(handler.indexOf('closeQuickStart.keepOnboarding = true;')).toBeLessThan(handler.indexOf('closeQuickStart();'));
    expect(handler.indexOf('closeQuickStart.importPending = true;')).toBeGreaterThan(handler.indexOf('closeQuickStart();'));
    const dismissed: string[] = [];
    const close = lift({
      releaseModalHold: () => {}, hideDialogAnimated: () => {}, flushPendingActivationWelcome: () => {}, quickStartDialog: {},
      dropDeferredInstallPrompt: () => {}, offerDeferredInstallPrompt: () => {}, QUICK_START_DISMISSED_KEY: 'd', QUICK_START_DISMISSED_CLOUD_KEY: 'dc',
      globalThis: { localStorage: { setItem: (k: string) => { dismissed.push(k); } } }, telegramCloudSet: async () => true, clearQuickStartProgress: () => {},
    }, [fn('function closeQuickStart() {'), fn('function dismissQuickStartForGood() {')], '{ close: closeQuickStart }',
    'let quickStartInstallStepShown = false; let quickStartBackupMode = false;');
    close.close.keepOnboarding = true;
    close.close();
    expect(dismissed, 'MEASURED before: closed for good before the import\'s own check').toEqual([]);
    close.close();
    expect(dismissed, 'the ✕ still ends onboarding for good').toEqual(['d']);
    const picked = code(app.slice(app.indexOf("walletKeyBackupInput?.addEventListener('change', walletFlowOnce(async () => {"), app.indexOf("walletKeyBackupInput?.addEventListener('change', walletFlowOnce(async () => {") + 900));
    expect(picked).toContain('if (fromQuickStart) dismissQuickStartForGood();');
  });
});
