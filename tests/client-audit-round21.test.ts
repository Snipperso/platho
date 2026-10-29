import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { beginCell } from '@ton/core';
import { __setLaneGenerationCodeForTests, __resetLaneGenerationCodeOverridesForTests } from '../web/shard-address.mjs';
import { createGroupRuntime } from '../web/group-runtime.mjs';
import { createMemoryGroupRecordStore } from '../web/group-record-store.mjs';
import { createOwnReactionStore } from '../web/public-reactions.mjs';
import { confirmIntroCreatedAt } from '../web/intro-send-coords.mjs';
import { reconcileKeyedRows } from '../web/keyed-rows.mjs';
import { setLocale, tPlural } from '../web/i18n.mjs';
import { resecureWasInterrupted, sweepSharedHostCookies } from '../web/storage-resecure.mjs';
import { x25519 } from '../web/vendor/@noble/curves/ed25519.js';
import { ml_kem768 } from '../web/vendor/@noble/post-quantum/ml-kem.js';
import { code, sourceBlock } from './helpers/source';
import { WALLET_EXTERNAL_DEATH_GRACE_MS, WALLET_EXTERNAL_VALIDITY_S, walletExternalOutcomeNow } from '../web/platho-wallet.mjs';
import { tonCell } from '../web/pwa-contract-transactions.mjs';
import { sha256 } from '../web/vendor/@noble/hashes/sha2.js';
import { CLOUD_KEY, WALLET_KEY, cloudDoors, fakeCloud, sealed, settle, span } from './helpers/telegram-cloud-harness';
import { lockManager } from './helpers/web-locks';


const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const line = (start: string) => { const at = app.indexOf(start); if (at < 0) throw new Error(`not found: ${start}`); return app.slice(at, app.indexOf(String.fromCharCode(10), at)); };
const lift = (env: Record<string, any>, sources: string[], exported: string, prelude = '') => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [prelude, ...sources, `return ${exported};`].join(String.fromCharCode(10)))(...names.map((n) => env[n]));
};

describe('R21 A1 — only a new build waits for the chain clock; the same signed bytes go out again at once', () => {
  const pending = () => Object.assign(new Error('checking the network time'), { code: 'CHAIN_CLOCK_PENDING' });
  const constants = [
    line('const DIRECT_SEND_EXPIRY_GRACE_MS'), line('const DIRECT_SEND_REBROADCAST_WINDOW_MS'), line('const CONV_CONFIRM_SEQNO_CONSUMED_TERMINAL_MS'),
  ].join(String.fromCharCode(10));

  const world = (doubt: boolean, { stopAfterResend = false, switchDuringWait = false } = {}) => {
    const did: string[] = [];
    let unlocked = 'EQ-wallet-A';
    const stop = (what: string) => { did.push(what); throw Object.assign(new Error(what), { code: 'TEST_STOP' }); };
    const transport = { runGetMethod: async () => stop('chain read') };
    const env: Record<string, any> = {
      WALLET_EXTERNAL_DEATH_GRACE_MS, WALLET_EXTERNAL_VALIDITY_S,
      walletOfSend: (owner?: string | null) => {
        if (owner !== undefined && owner !== unlocked) throw Object.assign(new Error('another wallet'), { code: 'PLATHO_WALLET_CHANGED' });
        return { address: unlocked };
      },
      convKeyStore: { getConversation: () => stop('build: conversation read') },
      createMemoryConvKeyStore: () => ({}),
      localRecipientKeyPair: { keyId: 'self' },
      localIdentity: {},
      walletSessionGeneration: 7,
      convQuietAt: new Map(),
      introKeyIdString: (id: unknown) => String(id),
      resumeConvPartialTail: async () => { did.push('rest of the message resumed'); return { resumed: true }; },
      rebroadcastSignedExternal: async (boc: string) => {
        if (stopAfterResend) stop(`same bytes re-sent: ${boc}`);
        did.push(`same bytes re-sent: ${boc}`);
        return { verdict: 'accepted' };
      },
      BROADCAST_VERDICT: { REJECTED: 'rejected', ACCEPTED: 'accepted' },
      directSendSeqnoConsumed: async () => false,
      markDirectSendBroadcast: () => { did.push('marked broadcast'); },
      noOtherWalletThan: () => true,
      armConvDeliveryConfirm: () => { did.push('delivery confirm armed'); },
      awaitWalletChainClock: async () => {
        did.push('waited for the chain clock');
        if (!switchDuringWait) throw pending();
        unlocked = 'EQ-wallet-B';
      },
      retryContentLostError: () => new Error('content lost'),
      walletChainClockOffsetMs: () => 0,
      walletClockInDoubt: () => doubt,
      walletExternalSignedFields: () => null,
      createEntryReader: () => async () => stop('INTRO entry read'),
      createScanPageReader: () => async () => stop('INTRO bucket walk'),
      confirmIntroCreatedAt: async () => stop('INTRO bucket walk'),
      introShardMayBeRetired: () => stop('retire test'),
      walletExternalOutcomeNow: async () => stop('wallet asked'),
      pricedGenerationMovedAt: () => stop('build: price check'),
      chainNowSec: () => stop('build: chain second read'),
      resolveRecipientWalletForThread: async () => stop('build: recipient read'),
    };
    const api = lift(env, [constants, fn('function directSendRebroadcastable(captured, now = Date.now()) {'), fn('function introSendBytesDead(send, now = Date.now()) {'),
      fn('async function attemptIntroFirstContactDirect(context, owner = undefined) {'), fn('async function attemptConvMessagePublishDirect(context, owner = undefined) {')],
    '{ conv: attemptConvMessagePublishDirect, intro: attemptIntroFirstContactDirect, attemptIntroFirstContactDirect }');
    return { did, api, transport };
  };
  const live = () => ({ boc: 'boc-1', seqno: 41, validUntil: Math.floor(Date.now() / 1000) + 200, at: Date.now() });
  const dead = () => ({ boc: 'boc-1', seqno: 41, validUntil: Math.floor(Date.now() / 1000) - 600, at: Date.now() - 900_000 });
  const run = async (send: () => Promise<unknown>, transport: unknown) => {
    const before = (globalThis as any).plathoWalletRpcTransport;
    (globalThis as any).plathoWalletRpcTransport = transport;
    try { return { result: await send() }; } catch (error: any) { return { error: error?.code ?? error?.message }; } finally { (globalThis as any).plathoWalletRpcTransport = before; }
  };

  it('R21-CLOCK-01: a CONV send whose signed bytes are alive re-sends them and arms the confirm while the clock is in doubt; only a build waits', async () => {
    let w = world(true);
    const message = { convDirectSend: live() };
    const rebroadcast = await run(() => w.api.conv({ thread: { convPeerKeyId: 'peer' }, message }), w.transport);
    expect(rebroadcast.result, 'MEASURED before: CHAIN_CLOCK_PENDING until the bytes died, then a second paid external (F7-1)').toEqual({ rebroadcast: true });
    expect(w.did).toEqual(['same bytes re-sent: boc-1', 'marked broadcast', 'delivery confirm armed']);
    w = world(true);
    expect((await run(() => w.api.conv({ thread: { convPeerKeyId: 'peer' }, message: { convDirectSend: { ...live(), partialTail: { messages: [] } } } }), w.transport)).result).toEqual({ resumed: true });
    expect(w.did).toEqual(['rest of the message resumed']);
    for (const [doubt, captured] of [[true, undefined], [false, dead()]] as const) {
      w = world(doubt);
      const outcome = await run(() => w.api.conv({ thread: { convPeerKeyId: 'peer' }, message: { convDirectSend: captured } }), w.transport);
      expect(outcome.error).toBe('CHAIN_CLOCK_PENDING');
      expect(w.did).toEqual(['waited for the chain clock']);
    }
  });

  it('R21-CLOCK-02: the INTRO twin — its live bytes go out again at once; the look for a dead one and a new mint wait for the clock', async () => {
    let w = world(true, { stopAfterResend: true });
    let outcome = await run(() => w.api.conv({ thread: {}, message: { introDirectSend: live() } }), w.transport);
    expect(w.did, 'MEASURED before: the wait above the hand-off held these bytes too').toEqual(['same bytes re-sent: boc-1']);
    expect(outcome.error).toBe('TEST_STOP');
    w = world(false);
    outcome = await run(() => w.api.conv({ thread: {}, message: { introDirectSend: dead() } }), w.transport);
    expect(outcome.error).toBe('CHAIN_CLOCK_PENDING');
    expect(w.did).toEqual(['waited for the chain clock']);
    w = world(true);
    outcome = await run(() => w.api.conv({ thread: {}, message: {} }), w.transport);
    expect(outcome.error).toBe('CHAIN_CLOCK_PENDING');
    expect(w.did).toEqual(['waited for the chain clock']);
  });

  it('R21-CLOCK-03: another wallet unlocked during the wait that moved — nothing more is read, built or paid for the send, on either lane', async () => {
    for (const [lane, context] of [
      ['CONV, a first press', { thread: { convPeerKeyId: 'peer' }, message: {} }],
      ['CONV, bytes past their life', { thread: { convPeerKeyId: 'peer' }, message: { convDirectSend: dead() } }],
      ['INTRO, a first press', { thread: {}, message: {} }],
      ['INTRO, bytes past their life', { thread: {}, message: { introDirectSend: dead() } }],
    ] as const) {
      const w = world(false, { switchDuringWait: true });
      const outcome = await run(() => w.api.conv(context), w.transport);
      expect(outcome.error, lane).toBe('PLATHO_WALLET_CHANGED');
      expect(w.did, `${lane}: the wallet check stands right after the wait [round 19 — A5]`).toEqual(['waited for the chain clock']);
    }
  });
});


describe('R21 A2 — every door that makes or brings a wallet asks Telegram first; the mirror keeps another wallet\'s copy', () => {
  it('R21-CLOUD-05: the replace question says where the wallet here lives — and that it is kept, in Telegram and among the other wallets', async () => {
    for (const [home, expected] of [
      ['telegram', ['wallet.thisDeviceAndTelegram', 'wallet.localReplacedTelegramStays']],
      ['device', ['wallet.thisDeviceOnly', 'wallet.localWalletReplacedKept']],
      ['unknown', ['wallet.thisDeviceOnly', 'wallet.localWalletReplacedKept']],
    ] as Array<[string, string[]]>) {
      let shown: any = null;
      const confirm = lift({
        readEncryptedPlathoWalletRecord: () => null, readLegacyPlaintextPlathoWalletRecord: () => null, sameWalletRecords: () => false,
        plathoWallet: { address: 'EQ_A' }, hasStoredPlathoWalletRecord: () => true, t: (key: string) => key,
        openActionDialog: async (dialog: any) => { shown = dialog; return {}; },
        shortAddress: (v: string) => v, walletAddressForCopy: (w: any) => w.address, storedWalletShortLabel: () => 'stored',
        walletHomeState: () => home, DEVICE_WALLETS_MAX: 64, readDeviceKeyring: () => ({ active: null, others: [] }),
        keyringRecords: (s: any) => [s.active, ...s.others.map((e: any) => e.record)].filter(Boolean), showAppNotice: () => {},
      }, [fn("async function confirmWalletReplacement(actionLabel = t('wallet.replaceThisWallet'), { incoming = null, incomingWallet = null } = {}) {")], 'confirmWalletReplacement');
      expect(await confirm('go')).toBe(true);
      expect(shown.summary.map((row: any) => row.value).slice(1), home).toEqual(expected);
    }
  });
});

describe('R21 A3 — a room\'s seq is claimed across windows, and a row is an echo\'s copy only when it says what the echo said', () => {
  const CLOCK = 1_800_000_000;
  const DUMMY_CELL = beginCell().storeUint(0x5a5a, 16).endCell().toBoc().toString('base64');
  beforeAll(() => {
    __setLaneGenerationCodeForTests('record', 18, DUMMY_CELL);
    __setLaneGenerationCodeForTests('vault', 18, DUMMY_CELL);
  });
  afterAll(() => { __resetLaneGenerationCodeOverridesForTests(); });
  const bytes = (fill: number, length = 32) => new Uint8Array(length).fill(fill);
  const identityOf = () => {
    const kem = ml_kem768.keygen(new Uint8Array(64).fill(0x21));
    const xSecret = bytes(0x21 ^ 0x5a);
    return { vaultSeed: bytes(0x21), wallet: '0:' + '21'.repeat(32), keyId: 'key-21', name: 'me', x25519SecretKey: xSecret,
      x25519PublicKey: x25519.getPublicKey(xSecret), mlKem768SecretKey: kem.secretKey, mlKem768PublicKey: kem.publicKey };
  };

  it('R21-ROOM-01: one window\'s messages in one room take distinct seqs, in order, the chain\'s floor read at each — nothing is refused 13653 [round 24 — one window]', async () => {
    {
      const chain = { lastSeq: new Map<string, number>(), refused: 0, paid: 0, floorReads: 0, seqs: [] as number[] };
      let landing: Promise<unknown> = Promise.resolve();
      const store = createMemoryGroupRecordStore();
      const identity = identityOf();
      const windowOf = () => createGroupRuntime({
        store, identity,
        send: async (messages: any[]) => {
          chain.paid += 1;
          landing = landing.then(() => new Promise((resolve) => { setTimeout(resolve, 15); })).then(() => {
            for (const message of messages) {
              const lane = String(message.shard ?? message.address).toLowerCase();
              const last = chain.lastSeq.get(lane) ?? 0;
              chain.seqs.push(message.seq);
              if (message.seq > last) chain.lastSeq.set(lane, message.seq); else chain.refused += 1;
            }
          });
          return {};
        },
        readLastSeq: async (address: string) => { chain.floorReads += 1; return chain.lastSeq.get(String(address).toLowerCase()) ?? 0; },
        vaultRouting: async () => ({ vaultAddress: '0:' + 'aa'.repeat(32), feeDue: 10_000_000n }),
        readMessagesWithSource: async () => [], readStates: async () => new Map(),
        publishValue: 19_100_000n, now: () => CLOCK, boundary: Math.floor(CLOCK / 86_400),
        random: (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n)),
      } as any);
      const A = windowOf();
      const room = await A.create({ name: 'the kitchen' });
      const groupId = Buffer.from(room.groupId).toString('hex');
      for (const text of ['first note', 'second note', 'third note', 'fourth note', 'ok']) await A.say(groupId, text);
      await Promise.all([A.say(groupId, 'at once 1'), A.say(groupId, 'at once 2'), A.say(groupId, 'at once 3')]);
      await landing;
      expect(chain.refused, 'every message stored, none refused 13653 and paid').toBe(0);
      expect(chain.seqs).toEqual(chain.seqs.slice().sort((x, y) => x - y));
      expect(new Set(chain.seqs).size).toBe(chain.seqs.length);
      expect(chain.floorReads, 'the chain\'s floor read at every message: another device shares no lock').toBe(chain.paid);
    }
    const runtimeSource = code(readFileSync('web/group-runtime.mjs', 'utf8'));
    for (const gone of ['withRoomSeqLock', 'foldStoredSeqs', 'holdLock', 'roomSeqLockWaitMs', 'ROOM_LANE_BUSY', 'cross-window-lock', 'navigator.locks']) {
      expect(runtimeSource, gone).not.toContain(gone);
    }
  });

  it('R21-ROOM-02: a chain row under an echo\'s key that says something else is not its copy — the echo is told, the row is drawn', async () => {
    const written: any[] = [];
    const env: any = {
      groupRowsAlreadyStored: async () => new Set(), updateMessageInEncryptedHistory: async (_t: any, m: any) => { written.push({ ...m }); return {}; },
      groupRowStoreRefusals: new WeakMap(), GROUP_ROW_STORE_TRIES: 3, writeGroupRowToHistory: async () => true,
      insertThreadMessage: (thread: any, message: any) => thread.messages.push(message), markIncomingThreadMessage: () => {},
      groupMemberLabel: () => 'member', localMessageOrderFields: () => ({}), GROUP_SENT_AT_FUTURE_SLACK_MS: 300_000,
      dropGroupMessagesByChainKey: () => 0, console, GROUP_TEXT_MAX_CHARS: 65_536,
    };
    const apply = lift(env, [fn('async function applyGroupMessagesToThread(thread, record, messages, writes = null) {')], 'applyGroupMessagesToThread');
    const self = new Uint8Array(32).fill(7);
    const key = (seq: number) => `20833.0.${'07'.repeat(32)}.${seq}`;
    const thread: any = { id: 'group:x', messages: [
      { type: 'out', text: 'second note', meta: 'sending', groupChainKey: key(2) },
      { type: 'out', text: 'fourth note', meta: 'sending', groupChainKey: key(3) },
    ] };
    const row = (seq: number, text: string) => ({ epoch: 20833, generation: 0, senderGroupKey: self, seq, payload: { text, sentAt: CLOCK } });
    await apply(thread, { self }, [row(2, 'second note'), row(3, 'third note')]);
    const byText = (text: string) => thread.messages.find((m: any) => m.text === text);
    expect(byText('second note').meta, 'its own copy confirms it').toBe('');
    expect(byText('fourth note').meta, 'MEASURED before: "delivered" — the room never got it').toBe('not delivered');
    expect(byText('fourth note').groupChainKey).toBeUndefined();
    expect(byText('third note')?.groupChainKey, 'MEASURED before: never drawn').toBe(key(3));
    expect(written.find((m) => m.text === 'fourth note')?.meta).toBe('not delivered');
  });
});

describe('R21 B1, B2, B8 — a fresh owner read, the room twin of the same wallet unlocked again, a quick start closed mid-wait', () => {
  it('R21-GIFT-01: the owner check before a gift transfer reads the chain now, not the card\'s 5-minute cache', async () => {
    const calls: any[] = [];
    const verify = lift({
      globalThis: { plathoTonRpcTransport: { runGetMethod: async (call: any) => { calls.push(call); return { stack: [] }; } } },
      giftChainReadOptions: () => ({ priority: 'profile', cacheTtlMs: 300_000 }), decodeNftItemDataStack: () => ({ ownerWallet: 'EQ_A' }), decodeTonAddressSliceBoc: () => null,
    }, [fn('async function verifyTelegramGiftItemOnChain(itemAddress, { fresh = false } = {}) {')], 'verifyTelegramGiftItemOnChain');
    await verify('EQ_item');
    await verify('EQ_item', { fresh: true });
    expect(calls.map((c) => [c.priority, c.cacheTtlMs])).toEqual([['profile', 300_000], ['critical', 0]]);
    expect(sourceBlock(app, 'async function submitTelegramGiftTransfer(gift, recipient) {'), 'MEASURED before: a gift moved within 5 min passed, was signed and bounced')
      .toContain('await verifyTelegramGiftItemOnChain(gift.itemAddress, { fresh: true });');
  });

  it('R21-ROOMSEND-01: a room send that fails after a lock and an unlock of the same wallet gives its words back and drops its echo (r20 A4\'s twin)', () => {
    const send = sourceBlock(app, 'async function sendGroupMessageFromComposer(thread, text) {');
    const failing = send.slice(send.lastIndexOf('} catch (error) {'));
    expect(failing, 'MEASURED before: "sending" for 10 minutes, then "not delivered", the words not back').toContain('if (!sameWalletSessionAsPress(session, pressWallet)) {');
    expect(failing).not.toContain('if (session !== walletSessionGeneration) {');
    expect(failing).toContain("const live = session === walletSessionGeneration ? thread : (threads.find((item) => item?.id === thread.id) ?? null);");
    expect(failing.indexOf('const live = ')).toBeLessThan(failing.indexOf("messageInput.value = current.trim() && current !== text ? `${text}\\n\\n${current}` : text;"));
  });

  it('R21-QS-01: a quick start closed during Create\'s wait for the cloud makes no wallet', async () => {
    const did: string[] = [];
    let release: () => void = () => {};
    const env: any = {
      awaitTelegramWalletsOnEmptyDevice: () => new Promise((resolve) => { release = () => resolve(undefined); }),
      hasStoredPlathoWalletRecord: () => false, plathoWallet: null, t: (key: string) => key,
      promptStoredWalletUnlockOnStartup: async () => {},
      createPlathoWallet: async () => { did.push('wallet made'); return { address: 'EQ_NEW', networkGlobalId: -239 }; },
      plathoWalletNetworkOptions: () => ({}), requestNewWalletStoragePassword: async () => 'pw',
      setPlathoWallet: async () => { did.push('wallet stored and unlocked'); }, markWalletKeyBackupPending: () => {},
      enforceTelegramSeedBackupGate: async () => {}, flashWalletIdentityStatus: () => {}, refreshMessagingControls: () => {},
    };
    expect(sourceBlock(app, 'function closeQuickStart() {')).toMatch(/^function closeQuickStart\(\) \{\s*closeQuickStart\.closings = \(closeQuickStart\.closings \?\? 0\) \+ 1;/);
    env.closeQuickStart = Object.assign(() => { env.closeQuickStart.closings += 1; }, { closings: 0 });
    const api = lift(env, [fn('async function runQuickStartCreateWallet(collectedPassword = null) {')],
      '{ create: runQuickStartCreateWallet, close: () => closeQuickStart() }');
    const pending = api.create('pw');
    api.close();
    release();
    expect(await pending, 'MEASURED before: a wallet made and unlocked 14 s after the close').toBe(false);
    expect(did).toEqual([]);
    const again = api.create('pw');
    release();
    expect(await again).toBe(true);
    expect(did).toEqual(['wallet made', 'wallet stored and unlocked']);
  });
});

describe('R21 A6 — a reaction is pressed once across the wallet\'s windows, and no window erases another\'s marks', () => {
  it('R21-REACT-01: two windows over one storage see each other\'s presses and keep each other\'s marks and pending rows', () => {
    const bag = new Map<string, string>();
    const storage = { getItem: (k: string) => bag.get(k) ?? null, setItem: (k: string, v: string) => { bag.set(k, v); } };
    const wallet = '0:' + '11'.repeat(32);
    const shard = '0:' + 'ef'.repeat(32);
    const A = createOwnReactionStore({ storage, wallet });
    const B = createOwnReactionStore({ storage, wallet });
    A.notePending(shard, 5, 2, { since: Date.now(), floor: 1 });
    A.note(shard, 5, 2);
    expect(B.has(shard, 5, 2), 'MEASURED before: false — the second window paid for the same emoji').toBe(true);
    B.notePending(shard, 5, 9, { since: Date.now(), floor: 1 });
    B.note(shard, 5, 9);
    A.note(shard, 6, 1);
    const reopened = createOwnReactionStore({ storage, wallet });
    expect(reopened.mine(shard, 5).sort(), 'MEASURED before: one window\'s save erased the other\'s mark').toEqual([2, 9]);
    expect(reopened.mine(shard, 6)).toEqual([1]);
    expect(reopened.pendingPresses().map((p) => p.emoji).sort()).toEqual([2, 9]);
    B.forget(shard, 5, 2);
    expect(createOwnReactionStore({ storage, wallet }).mine(shard, 6), "B's forget wrote B's old list over A's mark").toEqual([1]);
    A.note(shard, 7, 3);
    expect(createOwnReactionStore({ storage, wallet }).mine(shard, 5)).toEqual([9]);
    A.settlePending(shard, 5, 9);
    B.notePending(shard, 8, 4, { since: Date.now(), floor: 1 });
    expect(createOwnReactionStore({ storage, wallet }).pendingPresses().map((p) => p.emoji).sort()).toEqual([2, 4]);
  });

  it('R21-REACT-02: the press is checked, signed and noted in one turn of this page — its one dedup the press in flight [round 24 — the wallet\'s lock across windows is gone]', () => {
    const press = code(sourceBlock(app, 'async function reactTo(bar, emoji) {'));
    for (const gone of ['underPressLock', 'holdCrossWindowLock', 'platho-reactions.v1:', '.lost?.(']) expect(press, gone).not.toContain(gone);
    const asked = press.indexOf('if (store.has(shard, target, emoji)) return;');
    const inFlight = press.indexOf('if (reactionsInFlight.has(flight)) return;');
    const claimed = press.indexOf('reactionsInFlight.set(flight, Date.now());');
    expect(asked).toBeGreaterThan(-1);
    expect(inFlight).toBeGreaterThan(asked);
    expect(claimed).toBeGreaterThan(inFlight);
    expect(claimed).toBeLessThan(press.indexOf('await '));
    expect(claimed).toBeLessThan(press.indexOf('const message = buildReactMessage('));
    expect(press.indexOf('store.note(shard, target, emoji);')).toBeGreaterThan(press.indexOf('sendPlathoWalletTransaction('));
    expect(press.indexOf('store.note(shard, target, emoji);')).toBeLessThan(press.lastIndexOf('} catch (error) {'));
    expect(press.slice(press.lastIndexOf('} finally {'))).toContain('reactionsInFlight.delete(flight);');
  });
});

describe('R21 A5 — a conversation\'s shard-day is held by one window from its floor to its signature', () => {
  it('R21-CONVLOCK-01: the cross-window lock is gone, not kept as dead code — one window holds the origin before the storage is touched', () => {
    const source = code(app);
    for (const gone of ['function holdCrossWindowLock(', 'function crossWindowLocks(', 'platho-conv-send.v1:', 'createCrossWindowLocks', 'cross-window-lock.mjs']) {
      expect(source, gone).not.toContain(gone);
    }
    expect(existsSync('web/cross-window-lock.mjs'), 'the module is deleted').toBe(false);
    const gate = source.indexOf('await holdActiveWindow();');
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(source.indexOf('await resecureStorageIfDue();'));
  });

  it('R21-CONVLOCK-02: in the CONV funnel the day is checked after the route and before the earlier rests, the floor and the claim — nothing held, nothing let go', () => {
    const conv = code(sourceBlock(app, 'async function attemptConvMessagePublishDirect(context, owner = undefined) {'));
    const at = (text: string) => { const index = conv.indexOf(text); if (index < 0) throw new Error(text); return index; };
    const day = at('if (epochFromCreatedAtSeconds(chainNowSec()) !== route.epoch) throw convDayMovedError();');
    expect(day).toBeGreaterThan(at('const route = await outgoingRecordShard('));
    expect(day).toBeLessThan(at('await settleEarlierConvTails('));
    expect(day).toBeLessThan(at('coldFloor = await createRecordShardLastSeqReader('));
    expect(day).toBeLessThan(at('const seq = await keyStore.nextOutgoingSeq('));
    for (const gone of ['releaseConvLane', 'holdCrossWindowLock', '.lost?.(']) expect(conv, gone).not.toContain(gone);
  });
});

describe('R21 A9 — a first contact past its shard\'s retire instant: proof of absence kept, a minute of clock allowed, words that read', () => {
  const liftWith = (env: Record<string, any>, sources: string[], exported: string) => {
    const scope = new Proxy(env, {
      has: (target, key) => typeof key === 'string' && (Object.prototype.hasOwnProperty.call(target, key) || !(key in globalThis)),
      get: (target: any, key) => (typeof key === 'string' && Object.prototype.hasOwnProperty.call(target, key) ? target[key] : (typeof key === 'string' ? () => undefined : undefined)),
      set: (target: any, key, value) => { target[key] = value; return true; },
    });
    // eslint-disable-next-line no-new-func
    return new Function('scope', `with (scope) {\n${sources.join('\n')}\nreturn ${exported};\n}`)(scope);
  };
  it('R21-INTRO-ABSENT-01: the walk tells "no shard" from "the live bucket read to its end, not there" — when asked to', async () => {
    const noShard = async () => null;
    const emptyToEnd = async (_address: string, from: number) => ({ from_id: from, count: 0, next_id: from, pairs: '' });
    const base = { readEntry: async () => null, epoch: 20743, bucket: 0, fromEntryId: 0, r: 1n, viewTag: 1n };
    expect(await confirmIntroCreatedAt({ ...base, readScanPage: noShard, reportAbsence: true })).toEqual({ absent: 'no-shard' });
    expect(await confirmIntroCreatedAt({ ...base, readScanPage: emptyToEnd, reportAbsence: true })).toEqual({ absent: 'not-in-bucket' });
    expect(await confirmIntroCreatedAt({ ...base, readScanPage: noShard })).toBeNull();
    expect(await confirmIntroCreatedAt({ ...base, readScanPage: emptyToEnd })).toBeNull();
  });

  it('R21-INTRO-ABSENT-02: past the instant, a live bucket without it mints a new INTRO without asking the wallet; a device a minute slow asks it', async () => {
    const retireAt = 20743 * 86_400 + 2 * 86_400 + 604_800 + 345_600;
    const run = async ({ nowSec, absent }: { nowSec: number; absent: string }) => {
      const asked: any[] = [];
      const env: any = {
        walletOfSend: () => ({ address: 'A' }), localRecipientKeyPair: { keyId: new Uint8Array(32) }, localIdentity: {},
        globalThis: { plathoWalletRpcTransport: { runGetMethod: async () => ({}) } }, convKeyStore: {}, walletSessionGeneration: 1,
        createEntryReader: () => async () => null, createScanPageReader: () => async () => null,
        confirmIntroCreatedAt: async (opts: any) => (opts?.reportAbsence ? { absent } : null),
        introSendBytesDead: () => true, chainNowSec: () => nowSec, WALLET_CLOCK_TOLERANCE_MS: 60_000, awaitWalletChainClock: async () => {},
        walletExternalOutcomeNow: async (...args: any[]) => { asked.push(args); return 'unknown'; },
        pricedGenerationMovedAt: () => false,
        resolveRecipientWalletForThread: async () => { throw new Error('MINT'); },
      };
      const attempt = liftWith(env, [line('const INTRO_SHARD_RETIRABLE_AFTER_EPOCH_START_SEC = '), fn('function introShardMayBeRetired(epoch, nowSec = chainNowSec()) {'),
        fn('async function attemptIntroFirstContactDirect(context, owner = undefined) {')], 'attemptIntroFirstContactDirect');
      const message: any = { introDirectSend: { boc: 'b64', seqno: 40, validUntil: 1, epoch: 20743, bucket: 0, expectedEntryId: 0, r: 'r', viewTag: 1 } };
      try { await attempt({ thread: { id: 'dm:x' }, message }, 'A'); return { outcome: 'returned', asked: asked.length }; } catch (error: any) {
        return { outcome: error.message === 'MINT' ? 'minted' : (error.code ?? error.message), asked: asked.length };
      }
    };
    expect(await run({ nowSec: retireAt + 86_400, absent: 'not-in-bucket' }), 'MEASURED before: asked the wallet, "unknown" for any busy wallet — refused for good')
      .toEqual({ outcome: 'minted', asked: 1 });
    expect(await run({ nowSec: retireAt + 86_400, absent: 'no-shard' })).toEqual({ outcome: 'INTRO_RETIRED_UNPROVEN', asked: 1 });
    expect(await run({ nowSec: retireAt - 59, absent: 'no-shard' })).toEqual({ outcome: 'INTRO_RETIRED_UNPROVEN', asked: 1 });
  });

  it('R21-INTRO-WORDS-01: the refusal is said in the reader\'s language on the composer line and the bubble, and the bubble offers Retry and Cancel', () => {
    const words = liftWith({ t: (key: string) => key, RECIPIENT_NOT_ACTIVATED: 'RNA', isTonRpcVerificationSoftReadError: () => false,
      shortUiErrorText: (error: any) => String(error?.message ?? '') },
    [fn('function privateSendPreflightStatusText(error) {')], 'privateSendPreflightStatusText');
    expect(words(Object.assign(new Error('the first contact may have reached them ... on a guess'), { code: 'INTRO_RETIRED_UNPROVEN' })),
      'MEASURED before: untranslated English under the composer, and spoken').toBe('send.introRetiredUnproven');
    const meta = lift({}, [fn('function messageMetaTextKey(raw) {')], 'messageMetaTextKey');
    expect(meta('not confirmed: first contact cleared from the chain')).toBe('send.introRetiredUnproven');
    expect(sourceBlock(app, 'function messageStatusKey(message) {')).toContain("|| text.includes('not confirmed')");
  });
});

describe('R21 A4 — a wallet restored from the cloud skips the 24 words only when the cloud says they were confirmed', () => {
  const MARKER_KEY = 'platho_seed_confirmed_v1';
  const gateWorld = ({ restored, localConfirmed = false, cloud = {} as Record<string, string>, cloudMode = 'now' as 'now' | 'error', answers = ['SAVED'] }) => {
    const items = new Map(Object.entries(cloud));
    const storage = new Map<string, string>();
    const shown: string[] = [];
    const confirmedLocally: string[] = localConfirmed ? ['EQ_A'] : [];
    const wallet = { address: 'EQ_A', seed: 'seed-A' };
    const env: any = {
      isTelegramEnv: () => true, plathoWallet: wallet, storedWalletCameFromTelegramCloud: () => restored,
      isTelegramSeedBackupConfirmed: (address: string) => confirmedLocally.includes(address),
      markTelegramSeedBackupConfirmed: (address: string) => { if (!confirmedLocally.includes(address)) confirmedLocally.push(address); },
      telegramCloudStorage: () => ({}), telegramLaunchedByOfficialBot: () => true, plathoCloudDataClearing: false, plathoLocalDataClearing: false,
      telegramCloudRead: async (key: string) => (cloudMode === 'error' ? { ok: false, value: null } : { ok: true, value: items.get(key) ?? null }),
      telegramCloudSet: async (key: string, value: string) => { items.set(key, value); return true; },
      delay: (ms: number) => new Promise((resolve) => { setTimeout(resolve, Math.min(ms, 30)); }),
      derivePlathoWalletTag: async (w: any, purpose: string) => Buffer.from(`${w.seed}|${purpose}`).toString('hex').padEnd(32, '0').slice(0, 32),
      readEncryptedPlathoWalletRecord: () => ({ salt: 'SALT-1' }),
      localStorageOrNull: () => ({ getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, String(v)) }),
      exportPlathoWalletRecoveryPhrase: () => 'word '.repeat(24).trim(), t: (key: string) => key, seedBackupFieldSpecs: () => [],
      openActionDialog: async () => { shown.push('the 24 words'); return { confirmText: answers.shift() ?? null }; },
    };
    const api = lift(env, [span('const TELEGRAM_SEED_CONFIRMED_CLOUD_KEY = ', 'async function enforceTelegramSeedBackupGate(wallet, { force = false, cloudSaid = null } = {}) {'),
      fn('function seedBackupConfirmAccepted(value) {')], '{ gate: enforceTelegramSeedBackupGate, marker: seedConfirmedMarker }');
    return { api, items, shown, confirmedLocally, wallet, storage };
  };
  const settleSoon = () => new Promise((resolve) => { setTimeout(resolve, 20); });

  it('R21-SEED-01: restored with its marker in the cloud — no words; restored without — the words once, then the marker is there', async () => {
    let w = gateWorld({ restored: true });
    const marker = await w.api.marker(w.wallet);
    expect(marker).toMatch(/^s1:[0-9a-f]{32}$/);
    w = gateWorld({ restored: true, cloud: { [MARKER_KEY]: JSON.stringify([marker]) } });
    await w.api.gate(w.wallet);
    expect(w.shown).toEqual([]);
    expect(w.confirmedLocally).toEqual(['EQ_A']);
    w = gateWorld({ restored: true, cloud: { [MARKER_KEY]: JSON.stringify(['garbage', 42, 's1:XYZ']) } });
    await w.api.gate(w.wallet);
    await settleSoon();
    expect(w.shown).toEqual(['the 24 words']);
    expect(JSON.parse(w.items.get(MARKER_KEY)!)).toEqual([marker]);
    w = gateWorld({ restored: true, localConfirmed: true, cloud: {} });
    await w.api.gate(w.wallet);
    await settleSoon();
    expect(w.shown).toEqual([]);
    expect(JSON.parse(w.items.get(MARKER_KEY)!)).toEqual([marker]);
    expect(w.storage.get('platho.wallet.telegram.seedConfirmedSeen.v1'), 'remembered once the cloud has it').toBe('SALT-1');
  });

  it('R21-SEED-02: no one makes the gate pass for someone else — another wallet\'s marker or a forged one shows the words', async () => {
    const other = gateWorld({ restored: true });
    const othersMarker = await other.api.marker({ address: 'EQ_B', seed: 'seed-B' });
    const w = gateWorld({ restored: true, cloud: { [MARKER_KEY]: JSON.stringify([othersMarker, 's1:' + 'f'.repeat(32), 'garbage', { x: 1 }]) } });
    await w.api.gate(w.wallet);
    expect(w.shown).toEqual(['the 24 words']);
  });

  it('R21-SEED-03: Telegram not answering shows nothing and marks nothing; an unreadable list is never written over', async () => {
    const w = gateWorld({ restored: true, cloud: { [MARKER_KEY]: JSON.stringify(['s1:' + 'a'.repeat(32)]) }, cloudMode: 'error' });
    await w.api.gate(w.wallet);
    await settleSoon();
    expect(w.shown).toEqual([]);
    expect(w.confirmedLocally).toEqual([]);
    expect(JSON.parse(w.items.get(MARKER_KEY)!)).toEqual(['s1:' + 'a'.repeat(32)]);
    const backfill = gateWorld({ restored: false, localConfirmed: true, cloud: { [MARKER_KEY]: JSON.stringify(['s1:' + 'b'.repeat(32)]) }, cloudMode: 'error' });
    await backfill.api.gate(backfill.wallet);
    await settleSoon();
    expect(JSON.parse(backfill.items.get(MARKER_KEY)!)).toEqual(['s1:' + 'b'.repeat(32)]);
  });

  it('R21-SEED-04: where the words were confirmed (made here, or typed in an import) the marker goes to the cloud; the list stays bounded', async () => {
    const full = Array.from({ length: 8 }, (_, i) => 's1:' + String(i).repeat(32));
    const w = gateWorld({ restored: false, localConfirmed: true, cloud: { [MARKER_KEY]: JSON.stringify(full) } });
    await w.api.gate(w.wallet);
    await settleSoon();
    expect(w.shown).toEqual([]);
    const list = JSON.parse(w.items.get(MARKER_KEY)!);
    expect(list).toHaveLength(8);
    expect(list.at(-1)).toBe(await w.api.marker(w.wallet));
    const importDoor = sourceBlock(app, "importWalletButton?.addEventListener('click', walletFlowOnce(async () => {");
    expect(importDoor.indexOf('void noteSeedConfirmedInTelegramCloud(walletDraft)')).toBeGreaterThan(importDoor.indexOf('markTelegramSeedBackupConfirmed(walletDraft.address);'));
    expect(sourceBlock(app, 'async function seedConfirmedMarker(wallet) {')).toContain('derivePlathoWalletTag(wallet, SEED_CONFIRMED_MARKER_PURPOSE)');
    expect(line('const SEED_CONFIRMED_MARKER_PURPOSE = ')).not.toBe(line('const WALLET_KEY_BACKUP_MARKER_PURPOSE = ').replace('WALLET_KEY_BACKUP', 'SEED_CONFIRMED'));
  });
});

describe('R21 wave B — the network\'s time: a wait, not a failure; a clock never read has a witness; a room\'s day only on a trusted clock', () => {
  it('R21-CLOCKB-01: a send waiting for the network\'s time runs on the network\'s budget and says so', () => {
    const api = lift({
      PRIVATE_SEND_RETRY_MAX_ATTEMPTS: 8, PRIVATE_SEND_RPC_RETRY_MAX_ATTEMPTS: 90, PRIVATE_SEND_PARTIAL_RETRY_MAX_ATTEMPTS: 16,
      privateMessageHasPartialRetryablePublish: () => false, isTonRpcVerificationSoftReadError: () => false, isTonRpcRateLimitError: () => false,
    }, [fn('function privateSendRetryMaxAttempts(error = null, message = null) {'), fn('function privateSendRetryMeta(error = null) {'),
      fn('function privateSendRetryExhaustedStatusText(error = null) {')],
    '{ max: privateSendRetryMaxAttempts, meta: privateSendRetryMeta, gaveUp: privateSendRetryExhaustedStatusText }');
    for (const gone of ['function privateSendWaitsForOtherWindow(', 'CONV_LANE_BUSY', 'CROSS_WINDOW_BUSY', 'another window of this wallet']) expect(code(app), gone).not.toContain(gone);
    const pending = { code: 'CHAIN_CLOCK_PENDING' };
    expect(api.max(pending), 'MEASURED before: 8 — every waiting message "not sent: retry limit reached" at 375-405 s').toBe(90);
    expect(api.meta(pending)).toBe('checking RPC, retrying');
    expect(api.gaveUp(pending)).toBe('not sent: RPC verification stayed unavailable');
    expect(api.max({ code: 'OTHER' })).toBe(8);
  });

  it('R21-CLOCKB-02: a clock never read — the site\'s server vouching for the device writes on its day; off or silent, the write waits; asked once', async () => {
    const run = async (serverOffsetMs: number | null) => {
      let asked = 0;
      const env: any = {
        walletChainClockOffsetMs: () => 0, walletChainClockKnown: false, walletClockInDoubt: () => false, plathoWallet: { address: 'EQ_A' },
        walletChainClockRead: null, walletChainClockReadAt: -Infinity, refreshWalletChainClock: async () => {},
        siteServerClockOffsetMs: async () => { asked += 1; return serverOffsetMs; }, WALLET_CLOCK_TOLERANCE_MS: 60_000,
      };
      const wait = lift(env, [fn('function chainClockPendingError() {'), fn("async function deviceClockWitnessed({ waitMs = 8_000 } = {}) {"), line('deviceClockWitnessed.held = null;'),
        'deviceClockWitnessed.pending = null;',
        fn('async function awaitWalletChainClock({ timeoutMs = 4_000, requireSettled = false } = {}) {')], 'awaitWalletChainClock');
      const outcomes: string[] = [];
      for (let i = 0; i < 2; i += 1) {
        try { await wait({ requireSettled: true, timeoutMs: 1 }); outcomes.push('goes'); } catch (error: any) { outcomes.push(error.code); }
      }
      return { outcomes, asked };
    };
    expect(await run(2_000), 'the server agrees with the device: its day stands').toEqual({ outcomes: ['goes', 'goes'], asked: 1 });
    expect(await run(36 * 3_600_000), 'MEASURED before: written on a day a and half ahead — refused 13684/13656, paid')
      .toEqual({ outcomes: ['CHAIN_CLOCK_PENDING', 'CHAIN_CLOCK_PENDING'], asked: 1 });
    expect(await run(null)).toEqual({ outcomes: ['CHAIN_CLOCK_PENDING', 'CHAIN_CLOCK_PENDING'], asked: 1 });
  });

  it('R21-ROOMCLOCK-01: on a clock the app does not trust a room\'s day does not move and nothing is published; trusted, as before', async () => {
    __setLaneGenerationCodeForTests('record', 18, beginCell().storeUint(0x5a5a, 16).endCell().toBoc().toString('base64'));
    __setLaneGenerationCodeForTests('vault', 18, beginCell().storeUint(0x5a5a, 16).endCell().toBoc().toString('base64'));
    try {
      const CLOCK = 1_800_000_000;
      let nowSec = CLOCK;
      let trusted = true;
      const sent: any[] = [];
      const kem = ml_kem768.keygen(new Uint8Array(64).fill(0x31));
      const xSecret = new Uint8Array(32).fill(0x31 ^ 0x5a);
      const runtime = createGroupRuntime({
        store: createMemoryGroupRecordStore(),
        identity: { vaultSeed: new Uint8Array(32).fill(0x31), wallet: '0:' + '31'.repeat(32), keyId: 'key-31', name: 'me', x25519SecretKey: xSecret,
          x25519PublicKey: x25519.getPublicKey(xSecret), mlKem768SecretKey: kem.secretKey, mlKem768PublicKey: kem.publicKey },
        send: async (messages: any[]) => { sent.push(messages); return {}; },
        readLastSeq: async () => 0, vaultRouting: async () => ({ vaultAddress: '0:' + 'aa'.repeat(32), feeDue: 10_000_000n }),
        readMessagesWithSource: async () => [], readStates: async () => new Map(),
        publishValue: 19_100_000n, now: () => nowSec, boundary: Math.floor(CLOCK / 86_400),
        random: (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n)),
        clock: { trusted: () => trusted, settle: async () => { if (!trusted) throw Object.assign(new Error('time'), { code: 'CHAIN_CLOCK_PENDING' }); } },
      } as any);
      const room = await runtime.create({ name: 'kitchen' });
      const groupId = Buffer.from(room.groupId).toString('hex');
      const day = () => Math.max(...runtime.get(groupId).epochs.map((e: any) => Number(e.epoch)));
      const created = day();
      nowSec = CLOCK + 36 * 3_600;
      trusted = false;
      await runtime.sync({ groupIds: [groupId] });
      expect(day(), 'MEASURED before: the head moved a day ahead and every message was refused 13656 until the chain caught up').toBe(created);
      sent.length = 0;
      await expect(runtime.say(groupId, 'hello')).rejects.toMatchObject({ code: 'CHAIN_CLOCK_PENDING' });
      await expect(runtime.setName(groupId, 'the kitchen')).rejects.toMatchObject({ code: 'CHAIN_CLOCK_PENDING' });
      expect(sent).toEqual([]);
      trusted = true;
      await runtime.sync({ groupIds: [groupId] });
      expect(day()).toBeGreaterThan(created);
    } finally {
      __resetLaneGenerationCodeOverridesForTests();
    }
  });
});

describe('R21 A12 / A15 — a long Chats list draws a window of rows; the focus stays on its row', () => {
  const dom = () => {
    const doc: any = { body: { id: 'body' }, activeElement: null };
    doc.activeElement = doc.body;
    class Node {
      dataset: Record<string, string> = {}; parent: any = null; style: Record<string, string> = {}; className = ''; label: string;
      get offsetHeight() { return doc.hidden ? 0 : 64; }
      constructor(label: string) { this.label = label; }
      get isConnected() { return Boolean(this.parent); }
      get nextSibling() { if (!this.parent) return null; const i = this.parent.kids.indexOf(this); return this.parent.kids[i + 1] ?? null; }
      remove() { if (!this.parent) return; this.parent.kids.splice(this.parent.kids.indexOf(this), 1); this.parent = null; if (doc.activeElement === this) doc.activeElement = doc.body; }
      focus() { doc.activeElement = this; }
      closest() { return this.dataset.rowKey ? this : null; }
      setAttribute() {}
      getBoundingClientRect() { return { top: 0 }; }
    }
    doc.createElement = (tag: string) => new Node(tag);
    const list: any = {
      kids: [] as any[], scrollTop: 0, listeners: [] as any[], dataset: {} as Record<string, string>,
      get clientHeight() { return doc.hidden ? 0 : 900; },
      getClientRects() { return doc.hidden ? [] : [{}]; },
      get children() { return this.kids.slice(); },
      get firstChild() { return this.kids[0] ?? null; },
      insertBefore(node: any, anchor: any) {
        if (node.parent === this) { this.kids.splice(this.kids.indexOf(node), 1); if (doc.activeElement === node) doc.activeElement = doc.body; }
        const index = anchor ? this.kids.indexOf(anchor) : -1;
        if (index < 0) this.kids.push(node); else this.kids.splice(index, 0, node);
        node.parent = this;
      },
      append(node: any) { this.insertBefore(node, null); },
      contains(node: any) { return this.kids.includes(node); },
      querySelector(selector: string) {
        if (selector.includes('spacer:above')) return this.kids.find((k: any) => k.dataset.rowKey === 'spacer:above') ?? null;
        if (selector.includes('spacer:below')) return this.kids.find((k: any) => k.dataset.rowKey === 'spacer:below') ?? null;
        if (selector === '.thread-item') return this.kids.find((k: any) => k.className === 'thread-item') ?? null;
        if (selector.includes('thread:')) return this.kids.find((k: any) => k.label.startsWith('thread:')) ?? null;
        return this.kids.find((k: any) => k.label.startsWith('thread:') || k.label === 'cta') ?? null;
      },
      addEventListener(type: string, fn: any) { this.listeners.push([type, fn]); },
      getBoundingClientRect() { return { top: 0 }; },
    };
    return { doc, list, Node };
  };
  const world = (count: number) => {
    const { doc, list, Node } = dom();
    const ordered = Array.from({ length: count }, (_, i) => ({ id: `t${i}` }));
    const env: any = {
      document: doc, threadList: list, reconcileKeyedRows,
      getComputedStyle: () => ({ rowGap: '3px' }), requestAnimationFrame: () => 0,
      buildThreadRow: (id: string) => { const node = new Node(`thread:${id}`); node.className = 'thread-item'; return node; },
      applyThreadRow: () => {}, patchThreadRow: () => {}, patchThreadRowNow: () => {}, threadRowNearObserver: () => null,
      sweepStaleThreadRows: {},
      renderThreadsNow: { head: [{ key: 'cta', sig: 'cta', build: () => new Node('cta'), adopt: () => {} }], ordered },
      isChatsViewActive: () => true, renderThreads: () => {}, ResizeObserver: undefined, t: (key: string) => key,
    };
    const api = lift(env, [fn('function threadListWindow(count) {'), fn('function threadListSpacer(key, height = 0) {'), fn('function threadListLaidOut() {'),
      fn('function watchThreadListShown() {'), fn('function drawThreadListRows() {')],
    '{ draw: drawThreadListRows, owes: () => threadListOwesDraw, pitch: () => threadListWindow.pitch }', 'let threadListOwesDraw = false;');
    return { draw: api.draw, owes: api.owes, pitch: api.pitch, list, doc, ordered, env };
  };
  const rowKeys = (list: any) => list.kids.map((k: any) => k.dataset.rowKey).filter((k: string) => k.startsWith('thread:'));

  it('R21-LIST-01: 10,000 conversations put a few dozen rows in the document, wherever the list is scrolled; 300 are drawn whole', () => {
    const w = world(10_000);
    w.draw();
    const rows = rowKeys(w.list);
    expect(rows.length, 'MEASURED before: all 10,000 in one grid — 0.2-0.6 s of layout and paint per message at 1x, 1-2 s at 4x').toBeLessThan(80);
    expect(rows[0]).toBe('thread:t0');
    const below = w.list.kids.find((k: any) => k.dataset.rowKey === 'spacer:below');
    expect(below.style.height).toBe(`${(10_000 - rows.length) * 67 - 3}px`);
    w.list.scrollTop = 5_000 * 67;
    w.draw();
    const middle = rowKeys(w.list);
    expect(middle.length).toBeLessThan(80);
    expect(middle).toContain('thread:t5000');
    const above = w.list.kids.find((k: any) => k.dataset.rowKey === 'spacer:above');
    const start = Number(middle[0].slice('thread:t'.length));
    expect(above.style.height).toBe(`${start * 67 - 3}px`);
    expect(w.list.listeners.map(([type]: any) => type)).toEqual(['scroll']);
    const short = world(300);
    short.draw();
    expect(rowKeys(short.list)).toHaveLength(300);
    expect(short.list.kids.some((k: any) => String(k.dataset.rowKey).startsWith('spacer'))).toBe(false);
  });

  it('R21-LIST-02: a message moving the focused row keeps the focus on that row (A15), long list or short', () => {
    for (const count of [300, 10_000]) {
      const w = world(count);
      w.draw();
      const focusedRow = w.list.kids.find((k: any) => k.dataset.rowKey === 'thread:t5');
      focusedRow.focus();
      const moved = w.ordered.splice(5, 1)[0];
      w.ordered.unshift(moved);
      w.draw();
      expect(w.doc.activeElement?.dataset?.rowKey, `${count}: MEASURED before — the focus jumped to "Add contact", and Enter opened it`).toBe('thread:t5');
    }
  });

  it('R21-LIST-03: a search keystroke waits for the typing to pause before the list is drawn (F6-8)', () => {
    expect(app).toMatch(/search\.addEventListener\('input', \(\) => \{\s*clearTimeout\(renderThreads\.searchTimer\);\s*renderThreads\.searchTimer = setTimeout\(renderThreads, 150\);\s*\}\);/);
  });
});

describe('R21 A11 — a followed channel\'s name is proven once in its time, behind what the person asked', () => {
  it('R21-NAMEPROOF-01: one proof per channel waits at a time, at the background class; another is asked only once it ran', async () => {
    const queued: Array<{ task: () => Promise<unknown>; options: any }> = [];
    const verify = lift({
      channelProfileCacheKey: (w: string) => w, plathoUsernameIdentity: (name: string) => (name ? { value: name } : null), rawWalletAddress: (w: string) => w,
      applyVerifiedChannelUsername: () => {}, publicChannelProfileCache: {}, pendingChannelProfileOverlay: new Map(), nowSec: () => 1_000, CHANNEL_USERNAME_VERIFY_TTL_SEC: 21_600,
      queueUsernameHygiene: (task: any, options: any) => { queued.push({ task, options }); return new Promise(() => {}); }, criticalChainReadOptions: () => ({}),
      verifiedPlathoUsernameIdentityForWallet: async () => null, verifiedPlathoUsernameOwnerCache: new Map(), canonicalUsernameDisplay: (v: string) => v,
    }, [fn('function channelProfileDeclaresOtherName(key, value) {'), fn('function verifyChannelUsernameClaim(authorWallet, claimedName) {')], 'verifyChannelUsernameClaim');
    verify('EQ_chan', 'kitchen');
    verify('EQ_chan', 'kitchen');
    verify('EQ_chan', 'kitchen');
    expect(queued, 'MEASURED before: queued again at every re-adoption — 17,980 waiting after 40 minutes at 1,208 followed').toHaveLength(1);
    expect(queued[0].options).toEqual({ background: true });
    await queued[0].task();
    verify('EQ_chan', 'kitchen');
    expect(queued).toHaveLength(2);
  });

  it('R21-NAMEPROOF-02: a re-walk keeps the proven name\'s stamp, and the channel\'s gift proof waits behind the person\'s too', () => {
    const walk = sourceBlock(app, 'function setChannelProfileFromWalk(authorWallet, profileBlock, entryId, createdAtSec) {');
    const carry = walk.indexOf('incoming.verifiedUsername = prev.verifiedUsername;');
    const stamp = walk.indexOf('if (Number(prev.verifiedUsernameAt) > 0) incoming.verifiedUsernameAt = Number(prev.verifiedUsernameAt);');
    expect(stamp, 'MEASURED before: the stamp dropped — the 6-hour proof never held, 1,208 proofs a pass').toBeGreaterThan(carry);
    expect(sourceBlock(app, 'function verifyChannelGiftClaim(')).toContain('}, { background: true });');
    expect(sourceBlock(app, 'function queueUsernameHygiene(task, options = {}) {')).toContain('return enqueueUsernameHygiene(task, options).catch(() => {});');
  });
});

describe('R21 A10 — the channel profile cache: bounded when written, by size; read as written; a re-adoption costs no copy', () => {
  const bound = () => lift({}, [line('const PUBLIC_CHANNEL_PROFILE_CACHE_MAX = '), line('const PUBLIC_CHANNEL_PROFILE_KEPT_CEILING = '),
    line('const PUBLIC_CHANNEL_PROFILE_CACHE_MAX_CHARS = '), fn('function boundChannelProfileCache(cache, keptFirst = null, maxChars = PUBLIC_CHANNEL_PROFILE_CACHE_MAX_CHARS) {')],
  'boundChannelProfileCache');

  it('R21-PROFCACHE-01: what is written fits the sealed copy — the reader\'s own kept newest first, strangers dropped first', () => {
    const cache: Record<string, any> = {};
    const keptFirst = new Set<string>();
    const typical = { description: 'x'.repeat(400), ownerUsername: 'name', appearance: null };
    for (let i = 0; i < 7_000; i += 1) { cache[`K${i}`] = { ...typical, fetchedAt: i }; keptFirst.add(`K${i}`); }
    for (let i = 0; i < 512; i += 1) cache[`S${i}`] = { ...typical, fetchedAt: 10_000 + i };
    const kept = bound()(cache, keptFirst);
    const text = JSON.stringify(kept);
    expect(text.length, 'MEASURED before: 7,512 typical profiles, 3.39 M characters — refused whole, nothing written').toBeLessThanOrEqual(2_000_000);
    expect(Object.keys(kept).some((key) => key.startsWith('S')), 'strangers go before the reader\'s own').toBe(false);
    expect(kept.K6999, 'the newest of the reader\'s own stay').toBeTruthy();
    expect(kept.K0).toBeUndefined();
    const few: Record<string, any> = {};
    for (let i = 0; i < 700; i += 1) few[`w${i}`] = { fetchedAt: i };
    expect(Object.keys(bound()(few)).length).toBe(512);
  });

  it('R21-PROFCACHE-02: an unlock, a lock, another window and the boot read the cache as written — never cut back to 512', () => {
    expect(app.split('publicChannelProfileCache = readPublicChannelProfileCache(publicChannelStorage());').length - 1).toBe(4);
    expect(app, 'MEASURED before: 1,208 followed channels cut to 212 at every unlock').not.toMatch(/boundChannelProfileCache\(readPublicChannelProfileCache\(/);
    const persist = code(sourceBlock(app, 'function persistChannelProfileCache({ stampOnly = false } = {}) {'));
    expect(persist).toContain('publicChannelProfileCache = boundChannelProfileCache(publicChannelProfileCache, keptFirst, Number.POSITIVE_INFINITY);');
    expect(persist).toContain('const written = boundChannelProfileCache(publicChannelProfileCache, keptFirst);');
  });

  it('R21-PROFCACHE-03: the same profile walked again keeps the held record and copies no map', () => {
    const walk = sourceBlock(app, 'function setChannelProfileFromWalk(authorWallet, profileBlock, entryId, createdAtSec) {');
    const same = walk.indexOf('if (prev && sameChannelProfileContent(prev, incoming) && compareProfileRecency(prev, incoming) === 0) {');
    expect(same, 'MEASURED before: a new map of the whole cache per re-adoption — 23 s a pass at 8,192').toBeGreaterThan(-1);
    expect(same).toBeLessThan(walk.indexOf('publicChannelProfileCache = { ...publicChannelProfileCache, [key]: incoming };'));
    expect(walk.slice(same, walk.indexOf('}', walk.indexOf('return;', same)))).toContain('prev.fetchedAt = incoming.fetchedAt;');
  });
});

describe('R21 A13 — a contact\'s names: shown as proven, the first screenful first, a proof kept past the list', () => {
  const liftWith = (env: Record<string, any>, sources: string[], exported: string) => {
    const scope = new Proxy(env, {
      has: (target, key) => typeof key === 'string' && (Object.prototype.hasOwnProperty.call(target, key) || !(key in globalThis)),
      get: (target: any, key) => (typeof key === 'string' && Object.prototype.hasOwnProperty.call(target, key) ? target[key] : (typeof key === 'string' ? () => undefined : undefined)),
      set: (target: any, key, value) => { target[key] = value; return true; },
    });
    // eslint-disable-next-line no-new-func
    return new Function('scope', `with (scope) {\n${sources.join('\n')}\nreturn ${exported};\n}`)(scope);
  };
  const OWNER = `0:${'ab'.repeat(32)}`;
  const item = (i: number) => `0:${i.toString(16).padStart(64, '0')}`;

  it('R21-NAMES-01: each name reaches the card as it is proven; 24 at the card\'s class, the rest in the background; a reopen at 6 minutes proves nothing again', async () => {
    const owned: any = await import('../web/username-nft-owned.mjs');
    const proofs: Array<{ item: string; priority: string }> = [];
    let clock = 1_000_000;
    let indexAsked = 0;
    const env: any = {
      Date: { now: () => clock },
      requireUsernameRegistryAddress: () => `0:${'cc'.repeat(32)}`, resolveUsernameRegistryProvider: async () => ({}), resolveUsernameNftItemProvider: async () => ({}),
      rawWalletAddress: (w: any) => w, cachedChannelProfile: () => null, readLinkedPlathoUsername: () => null,
      usernameNftCandidateFromLabel: async () => null, console: { warn() {} },
      resolveAuthoritativeUsernameItemOwnership: async ({ itemAddress, itemCallOptions }: any) => {
        proofs.push({ item: itemAddress, priority: itemCallOptions.priority });
        return { authoritative: true, owner_wallet: OWNER, name_hash: 1n, item_state: {} };
      },
      discoverUsernameNftAddresses: async () => { indexAsked += 1; return Array.from({ length: 60 }, (_, i) => ({ itemAddress: item(i + 1), proposedName: null, proposedImage: null })); },
      collectOwnedUsernameNfts: owned.collectOwnedUsernameNfts,
      profileCardSubject: OWNER, profileCardDialog: { hidden: false },
      fetch: async () => ({}), AbortController, setTimeout, clearTimeout,
    };
    const load = liftWith(env, [line('const CONTACT_NAME_CACHE_TTL_MS = '), line('const CONTACT_NAME_INDEX_TIMEOUT_MS = '), line('const CONTACT_NAME_PROOF_CACHE_LIMIT = '),
      line('const CONTACT_NAME_PROOF_TTL_MS = '), line('const CONTACT_NAME_FIRST_SCREEN = '),
      line('const contactUsernameNftLists = '), line('const contactUsernameNftProofs = '), fn("function contactNameChainReadOptions(priority = 'profile') {"),
      fn("async function verifyContactUsernameNft(itemAddress, { priority = 'profile' } = {}) {"), fn('function fetchWithin(ms) {'),
      fn('async function loadUsernameNftsForWallet(wallet, own, { onProgress = null } = {}) {')], 'loadUsernameNftsForWallet');
    const shown: number[] = [];
    const first = await load(OWNER, false, { onProgress: (partial: any) => shown.push(partial.owned.length) });
    expect(first.complete).toBe(true);
    expect(shown.slice(0, 3), 'MEASURED before: nothing on the card until the last of 60 proofs, 4.4 minutes').toEqual([1, 2, 3]);
    expect(shown).toHaveLength(60);
    expect(proofs.slice(0, 24).every((p) => p.priority === 'profile') && proofs.slice(24).every((p) => p.priority === 'background'),
      'MEASURED before: every proof at \'profile\' — the receive lanes at half the pump for the whole walk').toBe(true);
    clock += 6 * 60_000;
    const again = await load(OWNER, false);
    expect([again.owned.length, indexAsked, proofs.length], 'MEASURED before: 120 requests again at a reopen past 5 minutes').toEqual([60, 2, 60]);
  });

  it('R21-NAMES-02: the card draws the names as they come, unless the chain\'s whole answer or a longer list from last time is already shown', () => {
    const open = sourceBlock(app, 'async function openProfileCardDialog(subject) {');
    expect(open).toContain('load: () => loadUsernameNftsForWallet(raw, own, {');
    expect(open).toMatch(/onProgress: \(partial\) => \{\s*if \(profileCardSubject !== raw \|\| profileCardNamesConfirmedFor === raw\) return;\s*if \(nameLane\.stored && \(nameLane\.stored\.owned\?\.length \?\? 0\) > partial\.owned\.length\) return;[^\n]*\s*renderProfileCardNames\(partial, own, \{ unconfirmed: true \}\);/);
  });
});

describe('R21 B14 / B15 — a draw hydrates once; the restore finds a conversation without walking the list', () => {
  it('R21-INDEX-01: the index answers by id and notices every way the list changes — push, unshift, splice, a new array', () => {
    const api = lift({}, [fn('function historyThreadIndexed(threadId) {'), 'let threads = [];'],
      '{ find: historyThreadIndexed, set: (list) => { threads = list; }, get: () => threads }');
    const list = Array.from({ length: 5 }, (_, i) => ({ id: `t${i}` }));
    api.set(list);
    expect(api.find('t3')).toBe(list[3]);
    expect(api.find('nope')).toBeNull();
    list.push({ id: 't5' });
    expect(api.find('t5')).toBe(list[5]);
    list.unshift({ id: 'u0' });
    expect(api.find('t3')).toBe(list[4]);
    expect(api.find('u0')).toBe(list[0]);
    list.splice(2, 1);
    list.push({ id: 'late' });
    expect(api.find('late')?.id, 'a stale index would create the conversation twice').toBe('late');
    expect(api.find('t1')).toBeNull();
    const fresh = [{ id: 'x' }];
    api.set(fresh);
    expect(api.find('x')).toBe(fresh[0]);
    expect(api.find('t3')).toBeNull();
    const mid = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    api.set(mid);
    expect(api.find('c')).toBe(mid[2]);
    mid.splice(1, 1);
    mid.splice(2, 0, { id: 'e' });
    expect(api.find('c')).toBe(mid[1]);
  });

  it('R21-INDEX-02: the restore asks the index, and its own push keeps the index current; the draw hydrates once', () => {
    const ensure = sourceBlock(app, 'function ensureHistoryThread(threadId, snapshot = null, message = null) {');
    expect(ensure, 'MEASURED before: threads.find once per conversation per batch — 5.7 s of the 4x restore').toContain('let thread = historyThreadIndexed(threadId);');
    expect(ensure).not.toContain('threads.find(');
    expect(ensure.indexOf('index.at.set(threadId, threads.length - 1);')).toBeGreaterThan(ensure.indexOf('threads.push(thread);'));
    expect(sourceBlock(app, 'function renderThreadsNow() {'), 'a second pass over every thread per draw').not.toContain('threads.forEach(hydrateThreadDisplayFromContactStore);');
    expect(sourceBlock(app, 'function renderThreads() {')).toContain('threads.forEach(hydrateThreadDisplayFromContactStore);');
  });
});

describe('R21 wave D — what the person sees around the card, the names and the composer', () => {
  const css = readFileSync('web/styles.css', 'utf8');
  const rule = (selector: string) => { const at = css.indexOf(`${selector} {`); return at < 0 ? '' : css.slice(at, css.indexOf('}', at)); };

  it('R21-MENU-01: the card\'s menu and the card take the ink of the palette painted on them; a dialog opened over the card wears the viewer\'s too (A14)', () => {
    expect(rule('.identity-popover'), 'MEASURED before: "Security code" #eef4f2 on #ffffff, 1.11:1, over a dressed channel').toContain('color: var(--text);');
    expect(rule('.profile-card-dialog')).toContain('color: var(--text);');
    const open = sourceBlock(app, 'async function openActionDialog(config = {}) {');
    expect(open).toContain('paintViewerPalette(actionDialog, Boolean(channelDressActive || channelLookKey) && profileCardShownNow());');
    const close = sourceBlock(app, 'function closeActionDialog(result = null) {');
    expect(close.indexOf('paintViewerPalette(actionDialog, false);')).toBeGreaterThan(close.indexOf('hideDialogAnimated(actionDialog, () => {'));
  });

  it('R21-LINE-01: the latest-post line\'s notice leaves with the screen it was for; the focus goes to the post it opened (B4, B5)', async () => {
    const said: string[] = [];
    const watchers: Array<() => void> = [];
    let screen = 'channel A';
    let release: (value: any) => void = () => {};
    const env: any = {
      discoveryLatestState: () => ({ status: 'ready', entryId: '7' }), profileCardDialog: { hidden: true, classList: { contains: () => false } }, actionDialog: { hidden: true },
      closeProfileCardDialog: () => {}, closeActionDialog: () => {}, setView: () => {}, openPublicChannelView: () => {}, heldLatestPost: () => null,
      profileCardLatestPostPress: 0, walletSessionGeneration: 1, t: (k: string) => k, PERMALINK_OPENING_NOTICE_MS: 30_000,
      showPermalinkNotice: (text: string) => { said.push(text); env.appNoticeFillToken = text ? 'n1' : null; }, appNoticeFillToken: null,
      publicScreenSnapshot: () => [screen], sameScreenSnapshot: (a: any, b: any) => a[0] === b[0],
      fetchPermalinkPostFromChain: () => new Promise((resolve) => { release = resolve; }), noteTonRpcRateLimit: () => false, console,
      setInterval: (fn: () => void) => { watchers.push(fn); return 1; }, clearInterval: () => {},
      renderPublicSurface: () => {}, openPublicPostDetail: () => {}, focusOpenedPublicPost: () => { said.push('focus on the post'); },
    };
    const open = lift(env, [fn('async function openProfileCardLatestPost(wallet) {')], 'openProfileCardLatestPost');
    const pending = open('EQ_chan');
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    expect(said).toEqual(['public.latestPostLoading']);
    screen = 'channel B';
    watchers[0]();
    expect(said, 'MEASURED before: the notice stood 33 s over the other channel').toEqual(['public.latestPostLoading', '']);
    release(null);
    await pending;
    said.length = 0; screen = 'channel A';
    const found = open('EQ_chan');
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    release({ id: 'post' });
    expect(await found).toBe(true);
    expect(said.at(-1), 'MEASURED before: the focus fell to the page').toBe('focus on the post');
    expect(sourceBlock(app, 'function focusOpenedPublicPost() {')).toContain("publicPostDetailTitle.setAttribute('tabindex', '-1');");
    const card = sourceBlock(app, 'async function openProfileCardDialog(subject) {');
    expect(card.indexOf("const reopening = profileCardDialog.classList.contains('is-closing');")).toBeLessThan(card.indexOf("profileCardDialog.classList.remove('is-closing');"));
    expect(card).toContain('const opening = profileCardDialog.hidden || reopening;');
  });

  it('R21-TRANSFER-01: "no longer in this wallet" reaches the dialog as itself, for a name and for a gift (B6)', () => {
    for (const [thrower, key] of [['async function submitUsernameNftTransfer(nft, recipient) {', 'username'], ['async function submitTelegramGiftTransfer(gift, recipient) {', 'gift']] as const) {
      expect(sourceBlock(app, thrower)).toContain(`throw Object.assign(new Error(t('${key}.noLongerYours')), { code: 'ITEM_NOT_OWNED' });`);
      expect(app, `MEASURED before: "${key} transfer did not go through", Transfer still offered`)
        .toContain(`error: error?.code === 'ITEM_NOT_OWNED' ? error.message : (gramShortfallText(error) ?? t('${key}.transferFailed'))`);
    }
  });

  it('R21-PLURAL-01: "the first N names" agrees with its number in Russian (B7)', async () => {
    const strings: any = (await import('../web/i18n-strings.mjs')).I18N_STRINGS;
    const ru = strings.ru;
    const form = (name: string, n: number) => String(ru[`username.listCapped#${name}`]).replace('{count}', String(n));
    expect(new Set([ru['username.listCapped#one'], ru['username.listCapped#few'], ru['username.listCapped#many']]).size, 'three Russian forms, not one').toBe(3);
    try {
      setLocale('ru');
      expect([3, 22, 201, 5].map((n) => tPlural('username.listCapped', n)), 'MEASURED before: one genitive plural for every number')
        .toEqual([form('few', 3), form('few', 22), form('one', 201), form('many', 5)]);
      setLocale('en');
      expect(tPlural('username.listCapped', 200)).toBe('Showing the first 200 names.');
    } finally { setLocale('en'); }
    expect(app).toContain("tPlural('username.listCapped', owned.length)");
  });

  it('R21-COMPOSER-01: a public post that did not go comes back without taking what was written since (B9); the list honours less motion (B12)', () => {
    const block = app.slice(app.indexOf('const writtenSince = (current.trim().length > 0 && current !== text)'), app.indexOf('if (draftShare && !(writtenSince && publicShareDraft)) setPublicShareDraft(draftShare);'));
    expect(block, 'MEASURED before: the words came back over the new ones').toContain('publicMessageInput.value = writtenSince && current.trim() && current !== text ? `${text}\\n\\n${current}` : text;');
    expect(block).toContain('publicImageAttachments = writtenSince ? [...attachments, ...(publicImageAttachments ?? [])] : attachments;');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.app-shell\[data-view="chats"\] \.list-pane \{\s*animation: none;/);
  });
});

describe('R21 wave E — the shared host: no mark read, no cookie kept; the lock takes the contacts\' names', () => {
  it('R21-RESECURE-01: on the shared host no re-secure mark is read, whatever its name; on the site\'s own host it is (A18)', () => {
    for (const cookie of ['__Host-platho_resecure=writing-wallet', 'platho_resecure=writing-wallet', '__HOST-platho_resecure=writing']) {
      expect(resecureWasInterrupted({ cookie }, { hostname: 'app1234567.tgcloud.ai' }), `MEASURED before: read on the shared host (${cookie.split('=')[0]})`).toBe(false);
    }
    expect(resecureWasInterrupted({ cookie: '__Host-platho_resecure=writing' }, { hostname: 'platho.app' })).toBe(true);
  });

  it('R21-COOKIE-01: at every start on the shared host each cookie it can see is expired, for the domain, its dotted form and this host (A19)', () => {
    const written: string[] = [];
    const jar = { get cookie() { return 'bomb1=xxxx; bomb2=yyyy; __Secure-x=1'; }, set cookie(value: string) { written.push(value); } };
    expect(sweepSharedHostCookies(jar, { hostname: 'app1234567.tgcloud.ai' })).toBe(3);
    for (const name of ['bomb1', 'bomb2', '__Secure-x']) {
      for (const scope of ['Domain=tgcloud.ai; Path=/', 'Domain=.tgcloud.ai; Path=/', 'Path=/']) {
        expect(written, `${name} ${scope}`).toContain(`${name}=; ${scope}; Max-Age=0; Secure; SameSite=None`);
      }
    }
    written.length = 0;
    expect(sweepSharedHostCookies(jar, { hostname: 'platho.app' }), 'the site\'s own host keeps its cookies').toBe(0);
    expect(written).toEqual([]);
    const boot = sourceBlock(app, 'async function resecureStorageIfDue() {');
    expect(boot.indexOf('sweepSharedHostCookies(globalThis.document);')).toBeGreaterThan(-1);
    expect(boot.indexOf('sweepSharedHostCookies(globalThis.document);')).toBeLessThan(boot.indexOf('let state = null;'));
  });

  it('R21-LOCKCACHE-01: the lock takes the contacts\' names and their proofs with the gifts\' (B10)', () => {
    const lockClear = app.slice(app.indexOf('  telegramGiftListCache.clear();\n  verifiedPlathoUsernameOwnerCache.clear();'));
    expect(lockClear.slice(0, 600), 'MEASURED before: kept across the lock, keyed by contacts\' wallets').toContain('try { contactUsernameNftLists.clear(); contactUsernameNftProofs.clear(); } catch');
  });
});


const w5External = (seqno: number, validUntil: number, salt: number) => {
  const body = tonCell.beginCell().uint(0x7369676en, 32).uint(0n, 32).uint(BigInt(validUntil), 32).uint(BigInt(seqno), 32).uint(BigInt(salt), 32).endCell();
  const root = tonCell.beginCell().uint(2n, 2).ref(body).endCell();
  return tonCell.bytesToBase64(tonCell.serializeBoc(root));
};
const indexedExternal = async (boc: string) => {
  const root = tonCell.parseBocBase64(boc);
  const body = root.refs[root.refs.length - 1];
  return { source: null, message_content: { body: tonCell.bytesToBase64(tonCell.serializeBoc(body)), hash: tonCell.bytesToBase64((await tonCell.computeCellHashAndDepth(body)).hash) } };
};
const walletHistory = async (rows: Array<{ now: number; external?: string }>) => {
  const list: any[] = [];
  let lt = 5_000n;
  let prev = '0';
  for (const row of rows) {
    lt += 7n;
    const inMsg = row.external ? await indexedExternal(row.external) : { source: 'EQ_SENDER', message_content: { body: '', hash: 'internal' } };
    list.push({ lt: lt.toString(), prev_trans_lt: prev, now: row.now, in_msg: inMsg });
    prev = lt.toString();
  }
  return list;
};
const indexOver = (history: any[], chainSeqno: number, { lacks = null as string | null, timeSlack = 0 } = {}) => {
  const asked: any[] = [];
  const served = history.filter((tx) => tx.lt !== lacks);
  return {
    asked,
    runGetMethod: async () => ({ stack: [{ type: 'num', value: `0x${chainSeqno.toString(16)}` }] }),
    getAccountTransactions: async (params: any) => {
      asked.push(params);
      let rows = served.slice();
      if (params.start_utime !== undefined) rows = rows.filter((tx) => tx.now >= Number(params.start_utime) - timeSlack);
      if (params.end_utime !== undefined) rows = rows.filter((tx) => tx.now <= Number(params.end_utime));
      if (params.end_lt !== undefined) rows = rows.filter((tx) => BigInt(tx.lt) <= BigInt(params.end_lt));
      rows.sort((a, b) => (BigInt(a.lt) < BigInt(b.lt) ? -1 : 1));
      if (params.sort === 'desc') rows.reverse();
      const from = Number(params.offset ?? 0);
      return { transactions: rows.slice(from, from + Number(params.limit ?? 10)) };
    },
  };
};

describe('R21 A9 b — bytes long dead are looked for where they could have run, at any age of the wallet', () => {
  const W = { address: `0:${'cd'.repeat(32)}` };
  const DAY = 86_400;
  const busyWallet = async ({ ran = 'ours' as 'ours' | 'theirs' | 'none' } = {}) => {
    const now = Math.floor(Date.now() / 1000);
    const deadline = now - 13 * DAY;
    const ours = w5External(100, deadline, 1);
    const rows: Array<{ now: number; external?: string }> = [];
    for (let s = 90; s < 100; s += 1) rows.push({ now: deadline - 3_000 + (s - 90) * 20, external: w5External(s, deadline - 2_000, 9) }, { now: deadline - 2_990 + (s - 90) * 20 });
    if (ran === 'ours') rows.push({ now: deadline - 120, external: ours });
    if (ran === 'theirs') rows.push({ now: deadline - 120, external: w5External(100, deadline + 60, 2) });
    rows.push({ now: deadline + 30 });
    if (ran === 'none') rows.push({ now: deadline + 3_600, external: w5External(100, deadline + 3_900, 3) });
    for (let s = 101; s <= 300; s += 1) rows.push({ now: deadline + 4_000 + s * 600, external: w5External(s, deadline + 4_300 + s * 600, 4) }, { now: deadline + 4_100 + s * 600 });
    return { history: await walletHistory(rows), ours, deadline };
  };
  const outcome = async (transport: any, fields: any) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const pending = walletExternalOutcomeNow(W, transport, fields);
      await vi.advanceTimersByTimeAsync(30_000);
      return await pending;
    } finally {
      vi.useRealTimers();
    }
  };

  it('R21-WALLETTIME-01: our bytes ran 13 days and 400 transactions ago — "consumed", in two requests', async () => {
    const { history, ours, deadline } = await busyWallet({ ran: 'ours' });
    const index = indexOver(history, 301);
    expect(await outcome(index, { seqno: 100, validUntil: deadline, boc: ours }),
      'MEASURED before: the newest 24 / 64 rows looked at — "cannot be told", the first contact refused for good').toBe('consumed');
    expect(index.asked.length, 'MEASURED before: 19 requests and 10.5 s a press').toBeLessThanOrEqual(2);
    expect(index.asked[0]).toMatchObject({ start_utime: deadline + 1, sort: 'asc', limit: 1 });
  });

  it('R21-WALLETTIME-02: another body took our seqno — "replaced"; nothing took it until long after the deadline — "expired"', async () => {
    const theirs = await busyWallet({ ran: 'theirs' });
    expect(await outcome(indexOver(theirs.history, 301), { seqno: 100, validUntil: theirs.deadline, boc: theirs.ours })).toBe('replaced');
    const none = await busyWallet({ ran: 'none' });
    const index = indexOver(none.history, 301);
    expect(await outcome(index, { seqno: 100, validUntil: none.deadline, boc: none.ours }), 'the wallet still waited for 100 after the bytes died').toBe('expired');
    expect(index.asked.length).toBeLessThanOrEqual(2);
  });

  it('R21-WALLETTIME-03: no verdict across a row the index lacks, on a time bound that did not hold, or over a seqno the list skipped', async () => {
    const ran = await busyWallet({ ran: 'ours' });
    const ourRow = ran.history.find((tx) => tx.now === ran.deadline - 120).lt;
    expect(await outcome(indexOver(ran.history, 301, { lacks: ourRow }), { seqno: 100, validUntil: ran.deadline, boc: ran.ours })).toBe('unknown');
    expect(await outcome(indexOver(ran.history, 301, { timeSlack: 2_995 }), { seqno: 100, validUntil: ran.deadline, boc: ran.ours })).toBe('unknown');
    const now = Math.floor(Date.now() / 1000);
    const deadline = now - 13 * DAY;
    const skipped = await walletHistory([
      { now: deadline - 500, external: w5External(99, deadline - 400, 9) },
      { now: deadline - 100, external: w5External(101, deadline, 9) },
      { now: deadline + 50 },
    ]);
    expect(await outcome(indexOver(skipped, 102), { seqno: 100, validUntil: deadline, boc: w5External(100, deadline, 1) })).toBe('unknown');
  });

  it('R21-WALLETTIME-04: a send still in its life, or a watch that asks quickly, keeps the newest-first look', async () => {
    const now = Math.floor(Date.now() / 1000);
    const ours = w5External(100, now + 100, 1);
    const index = indexOver(await walletHistory([{ now: now - 5, external: ours }]), 101);
    await outcome(index, { seqno: 100, validUntil: now + 100, boc: ours });
    expect(index.asked.some((params) => params.start_utime !== undefined), 'not past its deadline: not read at it').toBe(false);
    expect(code(sourceBlock(app, 'async function attemptIntroFirstContactDirect(context, owner = undefined) {')))
      .toContain('walletExternalOutcomeNow(signer ?? { address: null }, transport, { seqno: sendState.seqno, validUntil: sendState.validUntil, boc: sendState.boc });');
  });
});

describe('R21 B13 — a new wallet\'s vault is deployed by one window at a time', () => {
  const windowOf = (locks: any, chain: { live: boolean; reads: number }, { cap = 2_000, wait = 2_000 } = {}) => lift({
    globalThis: { navigator: { locks } },
    vaultSupported: () => true, plathoWallet: { address: 'W' }, VAULT_LIVE: 'live', VAULT_ABSENT: 'absent', VAULT_FROZEN: 'frozen',
    FV_PROTOCOL_FEE: 10_000_000n, FV_FLOAT_TOPUP_BELOW: 1n, convVaultFrozenError: () => new Error('frozen'),
    vaultSnapshotOutdated: () => false, boundedFeeVaultRoutingRead: async () => {},
    convVaultStateUnknownError: () => Object.assign(new Error('the vault could not be read'), { code: 'CONV_VAULT_STATE_UNKNOWN' }),
    ownVaultFeeDue: () => 0n, vaultAddressFor: async () => 'V', messageNetworkPrices: async () => null,
    VAULT_DEPLOY_SETTLE_MS: cap, FEE_VAULT_DEPLOY_WAIT_MS: wait, VAULT_DEPLOY_WATCH_PAUSES_MS: [5, 5, 5, 5], __chain: chain,
  }, [
    "let feeVaultState = { wallet: 'W', address: 'V', snapshot: { state: 'absent' } };",
    "async function refreshFeeVaultState() { __chain.reads += 1; const snapshot = __chain.live ? { state: VAULT_LIVE, balance: 10n ** 9n } : { state: VAULT_ABSENT }; feeVaultState = { wallet: 'W', address: 'V', snapshot }; if ((snapshot.state === VAULT_LIVE || snapshot.state === VAULT_FROZEN) && acquireVaultDeployLock.held?.watching === true) releaseVaultDeployLock('W'); }",
    fn('async function convVaultRouting() {'),
    'let feeVaultDeployFlight = null;',
    fn('function openFeeVaultDeployFlight(wallet) {'), fn('function settleFeeVaultDeployFlight(wallet, landed, flight = null) {'),
    fn('async function feeVaultDeployCarriedElsewhere(wallet) {'),
    fn('async function acquireVaultDeployLock(wallet) {'), fn('function heldVaultDeployLock(wallet) {'), fn('function releaseVaultDeployLock(wallet = null) {'),
    fn('async function watchVaultDeployAcrossWindows(wallet) {'),
  ], '{ route: convVaultRouting, settle: settleFeeVaultDeployFlight, release: releaseVaultDeployLock }');

  it('R21-VAULTLOCK-01: two windows\' first sends — one deploys; the other waits, reads the vault the first made, and rides it', async () => {
    const locks = lockManager();
    const chain = { live: false, reads: 0 };
    const one = windowOf(locks, chain);
    const two = windowOf(locks, chain);
    const first = await one.route();
    expect(first.deployVault).toBe(true);
    const startedAt = Date.now();
    const second = two.route();
    await settle(15);
    chain.live = true;
    one.settle('W', true, first.deployFlight);
    expect((await second).deployVault, 'MEASURED before: each window deployed — a second 50,000,000 into the float').toBe(false);
    expect(Date.now() - startedAt, 'freed when the vault is seen, not at the end of the hold').toBeLessThan(1_000);
    two.release('W');
    one.release('W');
  });

  it('R21-VAULTLOCK-02: a deploy that never left frees the other window at once; one that left and died, at the hold\'s end; a hold past the wait sends nothing', async () => {
    let locks = lockManager();
    let chain = { live: false, reads: 0 };
    let one = windowOf(locks, chain);
    let two = windowOf(locks, chain);
    let first = await one.route();
    const startedAt = Date.now();
    let second = two.route();
    await settle(15);
    one.settle('W', false, first.deployFlight);
    expect((await second).deployVault, 'the first never left: this one deploys').toBe(true);
    expect(Date.now() - startedAt, 'at once, not at the end of the hold').toBeLessThan(1_000);
    two.release('W');
    locks = lockManager();
    chain = { live: false, reads: 0 };
    one = windowOf(locks, chain, { cap: 60 });
    two = windowOf(locks, chain);
    first = await one.route();
    second = two.route();
    await settle(15);
    one.settle('W', true, first.deployFlight);
    expect((await second).deployVault).toBe(true);
    two.release('W');
    locks = lockManager();
    chain = { live: false, reads: 0 };
    one = windowOf(locks, chain);
    two = windowOf(locks, chain, { wait: 30 });
    await one.route();
    expect((await two.route()).deployVault).toBe(true);
    chain.live = true;
    const three = windowOf(locks, chain, { wait: 30 });
    expect((await three.route()).deployVault).toBe(false);
    one.release('W');
  });

  it('R21-VAULTLOCK-04: within one window a second lane still rides the flight of the first — with the lock API and without it', async () => {
    for (const locks of [lockManager(), undefined]) {
      const chain = { live: false, reads: 0 };
      const one = windowOf(locks, chain);
      const a = one.route();
      const b = one.route();
      const first = await a;
      expect(first.deployVault).toBe(true);
      await settle(15);
      chain.live = true;
      one.settle('W', true, first.deployFlight);
      expect((await b).deployVault, `${locks ? 'with' : 'without'} the lock API: one deploy, as before the lock`).toBe(false);
      one.release('W');
    }
  });

  it('R21-VAULTLOCK-03: the shipped read frees the hold when the deploy that left is seen; the app\'s lock frees it too', () => {
    const read = code(sourceBlock(app, 'async function refreshFeeVaultState({ critical = false } = {}) {'));
    const assigned = read.indexOf('feeVaultState = { wallet, address, snapshot, realAtoms };');
    const freed = read.indexOf("if ((snapshot.state === VAULT_LIVE || snapshot.state === VAULT_FROZEN) && acquireVaultDeployLock.held?.watching === true) releaseVaultDeployLock(wallet);");
    expect(assigned).toBeGreaterThan(-1);
    expect(freed).toBeGreaterThan(assigned);
    expect(code(sourceBlock(app, "function lockPlathoWallet(status = t('wallet.locked'), options = {}) {"))).toContain('releaseVaultDeployLock();');
    const routing = code(sourceBlock(app, 'async function convVaultRouting() {'));
    expect(routing.indexOf('flight = openFeeVaultDeployFlight(')).toBeLessThan(routing.indexOf('await acquireVaultDeployLock(wallet)'));
    expect(routing.indexOf('await refreshFeeVaultState({ critical: true });')).toBeGreaterThan(routing.indexOf('await acquireVaultDeployLock(wallet)'));
  });
});
