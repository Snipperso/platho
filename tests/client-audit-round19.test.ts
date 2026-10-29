import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';


const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const line = (start: string) => { const at = app.indexOf(start); if (at < 0) throw new Error(`not found: ${start}`); return app.slice(at, app.indexOf(String.fromCharCode(10), at)); };
const lift = (env: Record<string, any>, sources: string[], exported: string, prelude = '') => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [prelude, ...sources, `return ${exported};`].join(String.fromCharCode(10)))(...names.map((n) => env[n]));
};
const settle = (ms = 20) => new Promise((resolve) => { setTimeout(resolve, ms); });

describe('R19 — a send across a lock and an unlock of the same wallet writes into that wallet\'s history [A1 / F1-1]', () => {
  it('R19-HISTORY-01: the outcome and the Cancel of a send that outlived a lock and an unlock reach the wallet\'s history; another wallet\'s never', async () => {
    const { IDBFactory, IDBKeyRange } = await import('fake-indexeddb');
    const storeModule: any = await import('../web/encrypted-message-store.mjs');
    const seal: any = await import('../web/at-rest-seal.mjs');
    const factory = new IDBFactory();
    const keysOf = async () => (await seal.generateRandomAtRestKeys()).history;
    const keysA = await keysOf();
    const keysB = await keysOf();
    const openStore = (dbName: string, keys: any) => storeModule.createIndexedDbEncryptedMessageHistoryStore({ dbName, keys, indexedDB: factory, IDBKeyRange });
    const serializeMessageForHistory = (m: any) => JSON.parse(JSON.stringify({ type: m.type, text: m.text, meta: m.meta, convDelivery: m.convDelivery ?? null, localCreatedAtMs: m.localCreatedAtMs ?? null }));
    const makeApi = () => lift({
      ensureMessageOrderFields: () => {}, serializeThreadForHistory: (thread: any) => ({ id: thread.id }), serializeMessageForHistory,
      capsuleSenderCreatedAtMs: () => null, historyWindowState: new Map(), setText: () => {}, localStateLabel: null, historyStatusLabel: () => '',
      t: (key: string) => key, console: { error() {}, warn() {} }, clearTimeout: () => {}, setTimeout: () => 0, HISTORY_LOCK_CLOSE_GRACE_MS: 150_000,
      sameWalletAddress: (a: any, b: any) => Boolean(a) && a === b,
    }, [line('const historyWritesInFlight = '), line('const historyStoreOfThread = '), line('const historyStoreOfMessage = '), line('const closedHistoryStores = '),
      line('const historyStoreWallet = '), fn('function historyStoreFor(thread) {'), fn('function historySuccessorOf(store) {'), fn('function messageCreatedAtMs(message) {'),
      fn('async function writeMessageToEncryptedHistory(thread, message) {'), fn('async function writeMessageToEncryptedHistoryNow(thread, message) {'),
      fn('async function persistMessageToEncryptedHistory(thread, message) {'), fn('async function updateMessageInEncryptedHistory(thread, message) {'),
      fn('function closeHistoryStore(store) {'), fn('function closeHistoryStoresWaiting() {'), fn('function holdHistoryForSend() {'), fn('function historyHeld() {'),
      fn('function releaseHistoryStoreForLock() {'), fn('async function forgetMessageFromHistory(message) {')],
    `{ persist: persistMessageToEncryptedHistory, update: updateMessageInEncryptedHistory, hold: holdHistoryForSend, forget: forgetMessageFromHistory,
       lock: () => { releaseHistoryStoreForLock(); threads = []; },
       open: (store, wallet, list) => { historyStoreWallet.set(store, wallet); encryptedMessageStore = store; threads = list; } }`,
    'let encryptedMessageStore = null; let threads = []; let historyWriteFailures = 0; let historyHoldDepth = 0; const historyStoresClosingAfterLock = new Map(); function privateOutboundWorkActive() { return false; }');
    const onDisk = async (dbName: string, keys: any) => {
      const reader = await openStore(dbName, keys);
      const records = (await reader.listMessagesDetailed({ threadId: 'dm:peer', limit: 10 })).messages.map((item: any) => [item.message.meta, item.message.convDelivery]);
      reader.close?.();
      return records;
    };
    const scenario = async (next: { db: string; keys: any; wallet: string }, { tag = next.wallet, writeOutcome = true } = {}) => {
      const api = makeApi();
      const dbA = `platho-local-message-history-v1.dep.walA.${tag}`;
      const S1 = await openStore(dbA, keysA);
      const T1: any = { id: 'dm:peer', messages: [] };
      const M: any = { type: 'out', text: 'meet me at five', meta: 'sending', localCreatedAtMs: Date.now() };
      T1.messages.push(M);
      api.open(S1, 'A', [T1]);
      await api.persist(T1, M);
      const releaseAttempt = api.hold();
      api.lock();
      const S2 = await openStore(next.wallet === 'A' ? dbA : next.db, next.wallet === 'A' ? keysA : next.keys);
      api.open(S2, next.wallet, [{ id: 'dm:peer', messages: next.wallet === 'A' ? [M] : [] }]);
      releaseAttempt();
      await settle();
      if (!writeOutcome) return { api, M, dbA, written: null, S1, S2 };
      M.meta = 'published';
      M.convDelivery = 'verified';
      const written = await api.update(T1, M);
      return { api, M, dbA, written, S1, S2 };
    };

    const same = await scenario({ db: '', keys: null, wallet: 'A' });
    expect(Boolean(same.written)).toBe(true);
    expect(await onDisk(same.dbA, keysA), 'MEASURED before: the record still said "sending" — "not sent" and a paid Retry at the next start').toEqual([['published', 'verified']]);
    await same.api.forget(same.M);
    expect(await onDisk(same.dbA, keysA), 'MEASURED before: a Cancel deleted nothing — and the cancelled message was sent at the next start').toEqual([]);
    same.S2.close?.();
    const early = await scenario({ db: '', keys: null, wallet: 'A' }, { tag: 'cancel-early', writeOutcome: false });
    await early.api.forget(early.M);
    expect(await onDisk(early.dbA, keysA), 'MEASURED before: the record of a cancelled message stayed — and was sent at the next start').toEqual([]);
    early.S2.close?.();

    const dbB = 'platho-local-message-history-v1.dep.walB';
    const other = await scenario({ db: dbB, keys: keysB, wallet: 'B' });
    expect(other.written).toBeNull();
    expect(await onDisk(dbB, keysB)).toEqual([]);
    await other.api.forget(other.M);
    expect(await onDisk(other.dbA, keysA), 'A\'s record is A\'s: B\'s session neither writes nor deletes it').toEqual([['sending', null]]);
    other.S2.close?.();

    const intro = code(fn('async function attemptIntroFirstContactDirect(context, owner = undefined) {'));
    expect(intro).toContain('if (convKeyStore && convKeyStore !== keyStore && sameWallet && sameWalletAddress(convKeyStoreWallet.get(convKeyStore), signer?.address)) {');
    expect(intro).toContain('await convKeyStore.upsertConversationKRoot(selfKeyId, sendState.peerKeyId, adopted);');
    expect(intro).toContain('if (session === walletSessionGeneration || sameWallet) {');
    expect(code(fn('async function bootConvKeyStore() {'))).toContain('convKeyStoreWallet.set(convKeyStore, plathoWallet.address);');
    expect(code(fn('async function bootEncryptedMessageHistory() {'))).toContain('if (opened) historyStoreWallet.set(opened, owner);');
  });
});

describe('R19 — signed bytes the history could not keep do not leave [A2 / F7-1]', () => {
  let walletOnce: any = null;
  const runKeep = async ({ messages = 1, refuseAt = 0 }: { messages?: number; refuseAt?: number }) => {
    const wal: any = await import('../web/platho-wallet.mjs');
    const { createTonCenterV3Transport }: any = await import('../web/ton-rpc-transport.mjs');
    const chain = { seqno: 40, posts: [] as string[] };
    const answer = (status: number, body: any) => {
      const text = JSON.stringify(body ?? {});
      const r: any = { status, ok: status >= 200 && status < 300, headers: { get: () => null }, json: async () => JSON.parse(text), text: async () => text };
      r.clone = () => r;
      return r;
    };
    const fetch = async (url: string, init: any) => {
      const u = String(url);
      if (u.endsWith('/runGetMethod')) {
        const call = JSON.parse(init.body);
        if (call.method === 'seqno') return answer(200, { ok: true, exit_code: 0, stack: [['num', `0x${chain.seqno.toString(16)}`]] });
        return answer(200, { ok: true, exit_code: 0, stack: [] });
      }
      if (u.includes('/getTransactions')) return answer(200, { ok: true, result: [] });
      if (u.endsWith('/message')) {
        chain.posts.push(JSON.parse(init.body).boc);
        chain.seqno += 1;
        return answer(200, { ok: true });
      }
      return answer(404, {});
    };
    wal.__resetWalletSeqnoFloorsForTests(); wal.__resetWalletSendLanesForTests(); wal.__resetWalletPendingExternalsForTests();
    wal.noteChainTime(Math.floor(Date.now() / 1000), Date.now());
    walletOnce ??= await wal.createPlathoWallet();
    const transport = createTonCenterV3Transport({
      endpoint: 'https://gate.invalid/api/v3/runGetMethod', sendBocEndpoint: 'https://gate.invalid/api/v3/message', fetch, requestSpacingMs: 0,
      rateLimitKey: `r19-keep-${messages}-${refuseAt}-${Math.random()}`,
    });
    const list = Array.from({ length: messages }, (_, i) => ({ address: `0:${'22'.repeat(32)}`, amount: String(1_000_000_000 + i), bounce: true, payload: null }));
    const kept: number[] = [];
    let error: any = null;
    try {
      await wal.sendPlathoWalletTransaction(walletOnce, { messages: list }, {
        transport, seqnoPollMs: 1, seqnoCatchupMs: 1, ...(messages > 1 ? { maxMessagesPerTransfer: 1 } : {}),
        onSigned: async (signed: any) => { if (signed.index === refuseAt) throw new Error('the history store is closed'); kept.push(signed.index); },
      });
    } catch (thrown) {
      error = thrown;
    } finally {
      wal.__resetWalletSeqnoFloorsForTests(); wal.__resetWalletSendLanesForTests(); wal.__resetWalletPendingExternalsForTests();
    }
    return { posts: chain.posts.length, kept, error, firstPost: chain.posts[0] ?? null };
  };

  it('R19-KEEP-01: bytes that could not be kept are not posted; a later part refused is said as the part that ran; the person reads "history unavailable"', async () => {
    const plain = await runKeep({ messages: 1, refuseAt: -1 });
    expect([plain.posts, plain.kept, plain.error]).toEqual([1, [0], null]);
    const refused = await runKeep({ messages: 1, refuseAt: 0 });
    expect([refused.posts, refused.error?.code], 'MEASURED before: posted anyway — "not sent" over a delivered message, and its Retry paid again').toEqual([0, 'PLATHO_SIGNED_NOT_KEPT']);
    const second = await runKeep({ messages: 2, refuseAt: 1 });
    expect([second.posts, second.kept, second.error?.code, second.error?.partialSend?.sentChunks]).toEqual([1, [0], 'PLATHO_SIGNED_NOT_KEPT', 1]);
    expect(second.error?.builtBoc, 'what ran is what the error carries').toBe(second.firstPost);
    const landed = lift({}, [fn('function broadcastMayHaveLanded(error) {')], 'broadcastMayHaveLanded');
    expect([landed(refused.error), landed(second.error)]).toEqual([false, true]);
    const fatal = lift({ isPublishPriceChangeCancelled: () => false, RECIPIENT_NOT_ACTIVATED: 'RNA', isVaultPublishPartialError: () => false },
      [fn('function isFatalPrivateSendError(error) {')], 'isFatalPrivateSendError');
    expect(fatal(refused.error)).toBe(true);
    const said = lift({ refusalTextFor: () => null, t: (key: string) => key, RECIPIENT_NOT_ACTIVATED: 'RNA', isTonRpcVerificationSoftReadError: () => false },
      [fn("function shortUiErrorText(error, fallback = t('common.blockedCap')) {"), fn('function privateSendPreflightStatusText(error) {')], 'privateSendPreflightStatusText');
    expect(said(refused.error)).toBe('Local encrypted history unavailable; reload Platho');
    expect(code(fn('async function attemptConvMessagePublishDirect(context, owner = undefined) {'))).toContain("if (!(await updateMessageInEncryptedHistory(thread, message))) throw new Error('the persistent encrypted local history did not take the signed bytes');");
    expect(code(fn('async function attemptIntroFirstContactDirect(context, owner = undefined) {'))).toContain("if (!kept) throw new Error('the persistent encrypted local history did not take the first contact');");
  }, 120_000);
});

let appCodeMemo: string | null = null;
const appCode = () => (appCodeMemo ??= code(app));

describe('R19 — a window that takes a send over decides on what the history holds now [A3 / F3-1, F7-2, F7-5, F1-6] — one window, its own sends, since round 24', () => {
  const tick = () => new Promise((resolve) => { setTimeout(resolve, 5); });
  const historyOf = () => {
    const records = new Map<string, any>();
    return {
      records,
      put(message: any) {
        records.set(message.localHistoryId, { id: message.localHistoryId, threadId: 'dm:peer', createdAt: 1, message: JSON.parse(JSON.stringify({ ...message, pressedThisSession: undefined })) });
      },
      async deleteMessage(id: string) { records.delete(id); },
    };
  };
  const statusOf = (m: any) => (String(m?.meta ?? '').startsWith('not sent') ? 'failed' : (m?.meta === 'published' ? 'sent' : 'sending'));
  const windowOver = (name: string, store: any, log: string[], gate: { wait?: () => Promise<void> } = {}, screen: Record<string, any> = {}) => lift({
    document: { hidden: false },
    bytesToHex: (bytes: Uint8Array) => Buffer.from(bytes).toString('hex'), randomBytes: (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n)),
    privateSendRetryJobs: new Map(), groupIdOfThread: () => null, schedulePrivateSendRetry: () => log.push(`${name}:tail`),
    privateSendRetryContextForMessage: (thread: any, message: any) => ({ thread, message }),
    directPaySendRetryResumable: () => false, privateRetryRebuildable: () => true,
    privateMessageCanLocalCancel: (m: any) => statusOf(m) !== 'sent' && !m.convDirectSend?.boc,
    updateMessageInEncryptedHistory: async (_thread: any, message: any) => { store.put(message); return { id: message.localHistoryId }; },
    hasPendingPrivateSendRetry: (m: any) => m.meta === 'retrying send', ensurePendingPrivateSendRetry: () => log.push(`${name}:resumed`),
    privateMessageHasPartialRetryablePublish: () => false, publishStateHasRetryableSendParts: () => false,
    stopPartialPrivatePublishRecovery: () => false, isStalePrivatePendingPublish: () => false, privateMessageHasPublishAttempt: () => false,
    stopPrivateSendRetry: () => log.push(`${name}:stopped`),
    privateRetrySendsWhatIsShown: () => true, directSendRebroadcastable: () => true, pricedGenerationMovedAt: () => false, chainNowSec: () => 0,
    messageStatusKey: statusOf, showAppNotice: (text: string) => log.push(`${name}:notice ${text}`), t: (key: string) => key,
    clearPrivateSendRetry: () => {}, clearPrivateMessageManualRecovery: () => {}, clearPrivatePublishConfirmRetry: () => {},
    runPrivateSendRetry: async (context: any) => {
      await gate.wait?.();
      log.push(`${name}:paid`);
      context.message.meta = 'published';
      store.put(context.message);
    },
    settlePrivateComposerSendError: async () => {},
    forgetMessageFromHistory: async (m: any) => { await store.deleteMessage(m.localHistoryId); log.push(`${name}:deleted`); },
    privateComposerCostStatus: null, activeThreadId: null,
    CONV_CONFIRM_RETIRED_AFTER_MS: 300 * 86_400_000, markConvDeliveryUnverified: () => {}, armConvDeliveryConfirm: () => log.push(`${name}:confirm armed`),
    refreshThreadAfterMessageChange: () => {}, renderThreads: () => {}, renderConversation: () => {}, console: { warn() {} },
    privatePublishConfirmJobs: new Map(), window: { clearTimeout: (timer: any) => clearTimeout(timer) },
    ...screen,
  }, [
    line('const SEND_INTERRUPTED_META = '), line('const INTRO_INTERRUPTED_META = '), line('const SEND_INTERRUPTED_AGAIN_META = '), line('const liveSends = '),
    fn('function sendLockIdOf(message) {'), fn('function liveSendOf(message) {'), fn('function liveSendRelease(id, entry) {'), fn('function holdLiveSend(message) {'),
    fn('function sendInterruptedCandidate(message) {'), fn('async function settleInterruptedSends() {'), fn('function settleInterruptedSend(thread, message) {'),
    line('const convDeliveryConfirmTimers = '),
    fn('function rearmConvDeliveryConfirm(thread, message) {'), fn('async function resumePendingPrivateSendRetries() {'),
    fn('async function retryPrivateMessageFromUi(thread, message) {'), fn('async function retryClaimedPrivateMessage(thread, message, owned) {'),
    fn('async function cancelPrivateMessageFromUi(thread, message) {'), fn('function cancelPrivateMessageNow(thread, message) {'), fn('function cancelPrivateSendTimers() {'),
  ], `{ hold: holdLiveSend, live: liveSendOf, settle: settleInterruptedSends, resume: resumePendingPrivateSendRetries, retry: retryPrivateMessageFromUi,
       cancel: cancelPrivateMessageFromUi, threads: (list) => { threads = list; },
       lock: () => { cancelPrivateSendTimers(); walletSessionGeneration += 1; threads = []; } }`,
  'let threads = []; let walletSessionGeneration = 1;');
  const copyOf = (store: any, id: string) => ({ ...store.records.get(id).message, localHistoryId: id });
  const stopped = (id: string) => ({ type: 'out', text: 'meet me at five', meta: 'not sent: retry limit reached', localHistoryId: id, sendLockId: `lock-${id}`, privateSendRetryStopped: true });

  it('R19-CLAIM-01: a Retry pays once, holding its send while it runs and letting it go after; a Cancel takes away what nothing signed, and never signed bytes [round 24 — nothing claimed or read again]', async () => {
    const store = historyOf();
    const log: string[] = [];
    store.put(stopped('h1'));
    let open!: () => void;
    const A = windowOver('A', store, log, { wait: () => new Promise<void>((resolve) => { open = resolve; }) });
    const inA: any = copyOf(store, 'h1');
    const threadA = { id: 'dm:peer', messages: [inA] };
    A.threads([threadA]);
    const paying = A.retry(threadA, inA);
    await tick();
    expect(A.live(inA), 'this page runs it while its Retry pays').not.toBeNull();
    await A.settle();
    await A.resume();
    expect([inA.meta, log]).toEqual(['sending', []]);
    open();
    await paying;
    expect([log, inA.meta, store.records.get('h1').message.meta]).toEqual([['A:paid'], 'published', 'published']);
    expect(A.live(inA), 'let go once it ended').toBeNull();

    store.put(stopped('h2'));
    const inC: any = copyOf(store, 'h2');
    const threadC = { id: 'dm:peer', messages: [inC] };
    await A.cancel(threadC, inC);
    await tick();
    expect([threadC.messages.length, store.records.has('h2'), log.includes('A:deleted')]).toEqual([0, false, true]);
    store.put({ ...stopped('h3'), convDirectSend: { boc: 'te6', address: 'EQshard', commits: ['c1'], at: Date.now() } });
    const inS: any = copyOf(store, 'h3');
    const threadS = { id: 'dm:peer', messages: [inS] };
    await A.cancel(threadS, inS);
    await tick();
    expect([threadS.messages.length, store.records.has('h3')], 'a Cancel over signed bytes deletes nothing').toEqual([1, true]);

    for (const gone of ['function claimLiveSend(', 'function liveSendRobbed(', 'function sendLockManager(', 'SEND_LOCK_PREFIX', 'platho-send.v1:',
      'function refreshMessageFromHistory(', 'SEND_RECORD_REREAD_WINDOW', 'function crossWindowLocks(', 'function holdCrossWindowLock(',
      'function convLaneBusyError(', 'function crossWindowBusyError(', 'function privateSendWaitsForOtherWindow(']) expect(appCode(), gone).not.toContain(gone);
    const retry = code(fn('async function retryPrivateMessageFromUi(thread, message) {'));
    expect(retry).toContain('const owned = holdLiveSend(message);');
    expect(retry).toContain('await retryClaimedPrivateMessage(thread, message, owned);');
    expect(code(fn('async function cancelPrivateMessageFromUi(thread, message) {'))).toContain('cancelPrivateMessageNow(thread, message);');
    expect(code(fn('function holdLiveSend(message) {')), 'this page\'s registry: no Web Lock behind it').not.toMatch(/locks|request\(/);
  });

  it('R19-WAIT-01: the settle at a start leaves this page\'s own live send alone across a lock and an unlock, and tells at once a send no page runs [A8 / F5-1, F3-2; round 24 — no wait on another window]', async () => {
    const store = historyOf();
    const log: string[] = [];
    const me = windowOver('A', store, log);
    store.put({ type: 'out', text: 'meet me at five', meta: 'sending', localHistoryId: 'h1', sendLockId: 'lock-h1' });
    const running: any = copyOf(store, 'h1');
    const release = me.hold(running);
    me.lock();
    me.threads([{ id: 'dm:peer', messages: [running] }]);
    await me.settle();
    expect([running.meta, store.records.get('h1').message.meta], 'still this page\'s: not "not sent" while it runs').toEqual(['sending', 'sending']);
    release();
    store.put({ type: 'out', text: 'see you', meta: 'sending', localHistoryId: 'h2', sendLockId: 'lock-h2' });
    const closedOn: any = copyOf(store, 'h2');
    me.threads([{ id: 'dm:peer', messages: [closedOn] }]);
    await me.settle();
    expect([closedOn.meta, store.records.get('h2').message.meta]).toEqual(['not sent: the app closed before it went', 'not sent: the app closed before it went']);
    expect(log, 'nothing paid, nothing waited for').toEqual([]);
    for (const gone of ['function waitForSendElsewhere(', 'sendWaiters', 'function dropSendWaiters(']) expect(appCode(), gone).not.toContain(gone);
    expect(code(fn('function cancelPrivateSendTimers() {'))).not.toContain('dropSendWaiters');
  });

  it('R19-LETGO-01: twenty records an unlock settles are drawn once a frame — the list not at all while it is not on screen [B4 / F6-3; round 24 — another window\'s let-go is gone, the unlock\'s own marks draw this way]', () => {
    const frames: Array<() => void> = [];
    const drawn: string[] = [];
    let onScreen = true;
    const api = lift({
      cancelConvDeliveryConfirm: () => {}, refreshThreadAfterMessageChange: () => {}, updateMessageInEncryptedHistory: async () => true, refreshMessagingControls: () => {},
      console: { error() {} }, setTimeout,
      requestAnimationFrame: (callback: () => void) => { frames.push(callback); },
      threadListOnScreen: () => onScreen, refreshChatsRailBadge: () => drawn.push('badge'),
      renderThreads: () => drawn.push('list'), renderConversation: () => drawn.push('conversation'), renderPublicGroupsList: () => drawn.push('rooms'),
      isPublicRoomThread: (thread: any) => thread?.id === 'room:open', activeThreadId: 'dm:peer',
    }, [fn('function markConvDeliveryUnverified(thread, message) {'), fn('function drawThreadSoon(thread) {')],
    '{ mark: markConvDeliveryUnverified, owes: () => threadListOwesDraw }', 'let threadListOwesDraw = false;');
    const threadOf = (id: string, n: number) => ({ id, messages: Array.from({ length: n }, (_, i) => ({ type: 'out', meta: 'sending', localHistoryId: `${id}-${i}` })) });
    const open = threadOf('dm:peer', 20);
    const other = threadOf('dm:other', 2);
    const room = threadOf('room:open', 1);
    const runFrames = () => { const due = frames.splice(0); due.forEach((callback) => callback()); };
    const settleAll = (thread: any, list: any[]) => { for (const message of list) api.mark(thread, message); };
    settleAll(open, open.messages.slice(0, 10));
    runFrames();
    settleAll(open, open.messages.slice(10));
    runFrames();
    expect(drawn, 'MEASURED before: 20 list draws and 20 conversation draws — 21.6 s of long tasks at 10,000 conversations').toEqual(['list', 'conversation', 'list', 'conversation']);
    drawn.length = 0;
    settleAll(other, other.messages);
    runFrames();
    expect(drawn).toEqual(['list']);
    onScreen = false;
    drawn.length = 0;
    settleAll(room, room.messages);
    runFrames();
    expect([drawn, api.owes()], 'MEASURED before: the whole hidden list drawn for each').toEqual([['badge', 'rooms'], true]);
    expect(frames.length).toBe(0);
  });

  it('R19-RETRYCLAIM-01: a Retry that throws between its hold and its send lets the hold go — the next settle tells it; nothing holds it for the page\'s life', async () => {
    const store = historyOf();
    const log: string[] = [];
    let draws = 0;
    const me = windowOver('A', store, log, {}, { renderThreads: () => { draws += 1; if (draws === 1) throw new Error('a draw that failed'); } });
    store.put(stopped('h9'));
    const copy = copyOf(store, 'h9');
    me.threads([{ id: 'dm:peer', messages: [copy] }]);
    const pressed = await me.retry({ id: 'dm:peer', messages: [copy] }, copy).then(() => 'returned', (error: any) => String(error?.message ?? error));
    await tick();
    expect([pressed, me.live(copy)], 'REASONED before: the hold kept for the page\'s life — no settle or resume would touch the send again').toEqual(['a draw that failed', null]);
    await me.settle();
    expect([copy.meta, log]).toEqual(['not sent: the app closed before it went', []]);
  });

  it('R19-CLAIM-02: the resume leaves a send this page runs to its ladder; kept bytes no page runs are watched; the shipped store reads one record by its id [round 24 — nothing read again for another window]', async () => {
    const store = historyOf();
    const log: string[] = [];
    const B = windowOver('B', store, log);
    store.put({ ...stopped('h3'), meta: 'retrying send', privateSendRetryStopped: false });
    const due: any = copyOf(store, 'h3');
    B.threads([{ id: 'dm:peer', messages: [due] }]);
    const ladder = B.hold(due);
    await B.resume();
    expect(log, 'its own ladder has it: not sent beside itself').toEqual([]);
    ladder();
    await B.resume();
    expect(log).toEqual(['B:resumed']);

    const { createMemoryEncryptedMessageHistoryStore }: any = await import('../web/encrypted-message-store.mjs');
    const real = await createMemoryEncryptedMessageHistoryStore();
    const put = await real.putMessage({ threadId: 'dm:peer', thread: { id: 'dm:peer' }, message: { type: 'out', text: 'kept', meta: 'published' }, createdAt: 5 });
    expect([(await real.getMessage(put.id))?.message?.text, await real.getMessage('missing')]).toEqual(['kept', null]);

    log.length = 0;
    const kept: any = { type: 'out', text: 'a picture', meta: 'sending', localHistoryId: 'h4', sendLockId: 'lock-h4', convDirectSend: { boc: 'te6', address: 'EQshard', commits: ['c1'], at: Date.now() } };
    store.put(kept);
    const inW: any = copyOf(store, 'h4');
    B.threads([{ id: 'dm:peer', messages: [inW] }]);
    const running = B.hold(inW);
    await B.settle();
    expect(log.includes('B:confirm armed')).toBe(false);
    running();
    await B.settle();
    expect(log.includes('B:confirm armed'), 'MEASURED before: "sending" with no confirm and no button until a reload').toBe(true);
    for (const [start, body] of [['async function resumePendingPrivateSendRetries() {', 'resume'], ['async function settleInterruptedSends() {', 'settle']]) {
      const source = code(fn(start));
      for (const gone of ['claimLiveSend', 'refreshMessageFromHistory', 'getMessage(']) expect(source, `${body}: ${gone}`).not.toContain(gone);
    }
  });
});

describe('R19 — signed bytes live by their signed deadline on the chain\'s clock, in the message lane and the activation [A4 / F2-1; A12 / F2-2]', () => {
  it('R19-DEADLINE-01: a clock corrected forward re-offers bytes that can still land, never rebuilds beside them; set back, dead bytes are not offered; the activation likewise', async () => {
    const { WALLET_EXTERNAL_VALIDITY_S, WALLET_EXTERNAL_DEATH_GRACE_MS }: any = await import('../web/platho-wallet.mjs');
    const clock = { offset: 0, doubt: false };
    const env = {
      walletClockInDoubt: () => clock.doubt, walletChainClockOffsetMs: () => clock.offset,
      walletExternalSignedFields: (boc: string) => ({ validUntil: Number(/^te6-(\d+)$/.exec(boc)?.[1] ?? 0) }),
      DIRECT_SEND_EXPIRY_GRACE_MS: WALLET_EXTERNAL_DEATH_GRACE_MS, DIRECT_SEND_REBROADCAST_WINDOW_MS: WALLET_EXTERNAL_VALIDITY_S * 1000 + WALLET_EXTERNAL_DEATH_GRACE_MS,
      WALLET_EXTERNAL_DEATH_GRACE_MS, PLATHO_ACTIVATION_IN_FLIGHT_TTL_MS: Number(/const PLATHO_ACTIVATION_IN_FLIGHT_TTL_MS = ([0-9_]+);/.exec(app)![1].replace(/_/g, '')),
    };
    const api = lift(env, [fn('function directSendRebroadcastable(captured, now = Date.now()) {'), fn('function activationExternalAlive(record, now = Date.now()) {')],
      '{ conv: directSendRebroadcastable, activation: activationExternalAlive }');
    const captured = { boc: 'te6-1300', at: 1_000_000 };
    clock.offset = -600_000;
    expect(api.conv(captured, 1_060_000 + 600_000), 'MEASURED before: rebuilt at once — copy 1 and the rebuild both ran, paid twice').toBe(true);
    clock.offset = 600_000;
    expect(api.conv(captured, 1_400_000 - 600_000), 'MEASURED before: dead bytes re-offered, nothing rebuilt until +991 s').toBe(false);
    clock.offset = 0;
    expect([api.conv(captured, 1_389_000), api.conv(captured, 1_391_000)], 'the deadline and the death grace, on the chain').toEqual([true, false]);
    clock.doubt = true;
    expect(api.conv(captured, 9_999_999), 'a clock in doubt is no death').toBe(true);
    clock.doubt = false;
    expect([api.conv({ boc: 'te6-0', at: 1_000_000 }, 1_389_000), api.conv({ boc: 'te6-0', at: 1_000_000 }, 1_391_000)], 'a record without a deadline: its age, as before').toEqual([true, false]);
    clock.offset = -45_000;
    const marker = { boc: 'te6-1300', at: 1_045_000 };
    expect(api.activation(marker, 1_380_000 + 45_000), 'MEASURED before: Activate offered again while the first could still land').toBe(true);
    expect(api.activation(marker, 1_391_000 + 45_000)).toBe(false);
    clock.offset = -600_000;
    expect(api.activation({ boc: 'te6-1300', at: 1_000_000 }, 1_060_000 + 600_000), 'MEASURED before: offered again at once, 281 s early, after a correction').toBe(true);
    expect(api.activation({ at: 1_000_000 }, 1_000_000 - 1), 'a clock set back is not a lock for ever').toBe(false);
    expect(env.PLATHO_ACTIVATION_IN_FLIGHT_TTL_MS).toBe(WALLET_EXTERNAL_VALIDITY_S * 1000 + WALLET_EXTERNAL_DEATH_GRACE_MS);
    expect(code(fn('function plathoActivationInFlightForCurrentWallet() {'))).toContain('if (!activationExternalAlive(record)) { forgetPlathoActivationInFlight(); return false; }');
    expect(code(fn('function plathoActivationPendingExternal() {'))).toContain('return activationExternalAlive(record) ?');
  });
});

const NL = String.fromCharCode(10);
const liftWith = (env: Record<string, any>, sources: string[], exported: string) => {
  const missing = new Set<string>();
  const scope = new Proxy(env, {
    has: (target, key) => typeof key === 'string' && (Object.prototype.hasOwnProperty.call(target, key) || !(key in globalThis)),
    get: (target: any, key) => {
      if (typeof key !== 'string') return undefined;
      if (Object.prototype.hasOwnProperty.call(target, key)) return target[key];
      missing.add(key);
      target[key] = () => undefined;
      return target[key];
    },
    set: (target: any, key, value) => { target[key] = value; return true; },
  });
  // eslint-disable-next-line no-new-func
  return { api: new Function('scope', `with (scope) {${NL}${sources.join(NL)}${NL}return ${exported};${NL}}`)(scope), missing };
};
const hex = (bytes: any) => Buffer.from(bytes ?? []).toString('hex').slice(0, 4);
const SELF_A = new Uint8Array(32).fill(0xa1);
const SELF_B = new Uint8Array(32).fill(0xbb);
const X = new Uint8Array(32).fill(0x58);
const X_WALLET = `0:${'58'.repeat(32)}`;
const ADDRESS_A = `0:${'a'.repeat(64)}`;
const ADDRESS_B = `0:${'b'.repeat(64)}`;
const outcomeOf = (run: Promise<any>) => run.then(() => 'sent', (error: any) => error?.code ?? String(error?.message ?? error));

const windowOf = async () => {
  const persist: any = await import('../web/conv-key-persist.mjs');
  const sealKey = await persist.createConvKeySealKey();
  const blobs: Record<string, any> = { A: null, B: null };
  const keyStoreOf = (who: string) => persist.createSealedConvKeyStore({ key: sealKey, readBlob: async () => blobs[who], writeBlob: async (value: any) => { blobs[who] = value; } });
  const ksA = await keyStoreOf('A');
  const ksB = await keyStoreOf('B');
  await ksB.upsertConversationKRoot(SELF_B, X, { kRoot: new Uint8Array(32).fill(0x0b), introNonce: new Uint8Array(16).fill(0x1b), createdAt: 1_758_000_000, peerEncPublicKey: new Uint8Array(32).fill(0x2b), peerWallet: X_WALLET });
  const convKeyStoreWallet = new WeakMap();
  convKeyStoreWallet.set(ksA, ADDRESS_A);
  convKeyStoreWallet.set(ksB, ADDRESS_B);
  const did: string[] = [];
  const nowSec = () => Math.floor(Date.now() / 1000);
  const { WALLET_EXTERNAL_DEATH_GRACE_MS, WALLET_EXTERNAL_VALIDITY_S }: any = await import('../web/platho-wallet.mjs');
  const shard = { lastSeq: 0, stored: new Set<string>(), seqs: [] as number[], refused: [] as number[], flying: [] as { seq: number; commit: string }[] };
  const land = () => {
    for (const part of shard.flying.splice(0)) {
      if (part.seq > shard.lastSeq) { shard.lastSeq = part.seq; shard.stored.add(part.commit); shard.seqs.push(part.seq); } else shard.refused.push(part.seq);
    }
  };
  const env: Record<string, any> = {
    globalThis: { plathoWalletRpcTransport: { runGetMethod: async () => ({}) } },
    console: { warn() {}, error() {}, info() {}, log() {} },
    t: (key: string) => key,
    plathoWallet: { address: ADDRESS_A, label: 'wallet A', seed: 'seed of wallet A' }, convKeyStore: ksA, convKeyStoreWallet,
    localRecipientKeyPair: { keyId: SELF_A }, localIdentity: { who: 'identity of wallet A' }, walletSessionGeneration: 1, threads: [],
    sameWalletAddress: (a: any, b: any) => Boolean(a) && a === b,
    awaitWalletChainClock: async () => {}, chainNowSec: nowSec, walletChainNowMs: () => Date.now(),
    epochFromCreatedAtSeconds: () => 20733,
    holdHistoryForSend: () => () => {}, beginTonRpcPhaseProfile: () => ({ summary: () => ({}) }), outgoingPublishKind: () => 'conv', forgetComposerChainFacts: () => {},
    isRealSavedThread: () => false, delay: async () => {}, noteTonRpcRateLimit: () => false, updateMessageInEncryptedHistory: async () => true,
    createEntryReader: () => async () => null, createScanPageReader: () => async () => null,
    confirmIntroCreatedAt: async () => ({ createdAt: 1_759_000_123 }),
    pricedGenerationMovedAt: () => false, resolveRecipientWalletForThread: async () => X_WALLET, requireBasechainAddress: (value: any) => value,
    resolveRecipientBundleByWallet: async () => ({ keyId: X }),
    messageDocumentBytesFromDraft: (text: string) => new TextEncoder().encode(String(text)),
    pickIntroSendSlot: async () => ({ epoch: 20733, bucket: 1, expectedEntryId: 5 }), INTRO_EPOCH_SIGNED_FROM: 99_999,
    createEncryptedIntroCapsule: async (_bundle: any, identity: any) => {
      did.push(`INTRO sealed with the ${identity?.who}`);
      return { kRoot: new Uint8Array(32).fill(0x0a), introNonce: new Uint8Array(16).fill(0x1a), header0: { sizeClass: 1 } };
    },
    introCapsuleStealthFields: () => ({ r: 77n, viewTag: 7n }),
    INTRO_PUBLISH_VALUE: 1n, squatCushionNanotons: () => 0n, walletSendFeeReserveNanotons: () => 0n, assertWalletGramAtLeast: async () => {},
    publishIntroLane: async ({ wallet }: any, { onSigned }: any) => {
      did.push(`INTRO signed and paid by ${wallet?.label}`);
      await onSigned({ boc: 'te6intro', seqno: 3, validUntil: nowSec() + 300 });
      return { result: { boc: 'te6intro', seqno: 3, pendingValidUntil: nowSec() + 300 } };
    },
    dropEmptyAnonymousTwin: () => {}, scheduleRecoveryBackup: () => did.push('its backup scheduled'), conversationId: () => 'conv',
    followContactPublicChannel: (wallet: string) => did.push(`followed ${wallet.slice(0, 4)}`),
    convQuietAt: new Map(), introKeyIdString: (id: any) => hex(id), directSendRebroadcastable: (captured: any) => Boolean(captured?.boc && captured.alive),
    rebroadcastSignedExternal: async (_boc: string, _seqno: any, _transport: any, wallet: any) => {
      did.push(`its bytes offered again for ${wallet?.label}`);
      await env.whileTheBytesLeave?.();
      return { verdict: 'accepted' };
    },
    BROADCAST_VERDICT: { ACCEPTED: 'accepted', REJECTED: 'rejected' },
    resolvePeerReplyBundle: async ({ onVerifiedWallet }: any) => {
      did.push("its peer's keys read");
      await env.whileThePeerIsRead?.();
      await onVerifiedWallet?.(X_WALLET);
      return { bundle: 'X' };
    },
    splitBytesToCapsuleParts: (bytes: any) => [{ bytes, sizeClass: 1 }], privateCompactPayloadOverhead: () => 0,
    outgoingRecordShard: async ({ kRoot, selfKeyId }: any) => {
      did.push(`routed by the root ${hex(kRoot)}.. of self ${hex(selfKeyId)}..`);
      return { address: 'EQshard', epoch: 20733, bucketKey: new Uint8Array(32), writePublicKey: 'w', writeSecret: 's' };
    },
    createRecordShardLastSeqReader: () => async () => 0, convBucketSeqHighWater: () => 0, randomBytes: (n: number) => new Uint8Array(n),
    encodeCompactPayload: ({ senderUsername }: any) => { env.payloadNames = [...(env.payloadNames ?? []), senderUsername ?? null]; return new Uint8Array(8); },
    compactPayloadReservedTailBytes: () => 0, currentProfilePointerFields: () => ({}),
    PRIVATE_SENDER_MODES: { ANONYMOUS: 'anonymous', NAMED: 'named' }, senderMode: 'anonymous', readPrivateSenderMode: () => env.senderMode,
    isSavedMessagesThread: (thread: any) => thread?.id === 'saved', openThread: null, activeThread: () => env.openThread,
    readLinkedPlathoUsername: () => ({ label: 'alice.ath' }),
    createEncryptedConvCapsule: async (_text: string, _bundle: any, identity: any) => { did.push(`sealed with the ${identity?.who}`); return { header0: { sizeClass: 1 } }; },
    CONV_PUBLISH_VALUE: 18_000_000n, generationForEpoch: () => 17,
    publishConvLaneParts: async ({ wallet, deployVault }: any, parts: any[], { onSigned }: any) => {
      did.push(`signed and paid by ${wallet?.label}`);
      const preparedParts = parts.map((_part: any, index: number) => ({ commit: BigInt(0x7000 + index) }));
      parts.forEach((part: any, index: number) => shard.flying.push({ seq: part.seq, commit: preparedParts[index].commit.toString(16) }));
      await onSigned({ boc: 'te6conv', seqno: 7, validUntil: nowSec() + 300, chunks: 1, unsentMessages: [], chunkMessages: [], preparedParts });
      await env.whileTheBytesLeave?.();
      return { parts: preparedParts, deploy: Boolean(deployVault), result: { pendingBoc: 'te6conv', pendingSeqno: 7, pendingValidUntil: 0, seqno: 7 } };
    },
    broadcastMayHaveLanded: () => false, unconfirmedExternalOf: () => null, settleFeeVaultDeployFlight: () => {},
    noteFeeVaultDeployed: (wallet: string) => did.push(`its vault noted live for ${wallet === ADDRESS_A ? 'wallet A' : wallet === ADDRESS_B ? 'wallet B' : wallet}`),
    markDirectSendBroadcast: () => {}, armConvDeliveryConfirm: () => did.push('its delivery watched'),
    followPeerChannelOnFirstReply: () => did.push('its peer followed'), promoteQuietRecoverySlot: () => did.push('its backup promoted'),
    convTailHeldOnShard: async () => ({ stored: new Set(['5001']), lastSeq: 1 }),
    walletClockInDoubt: () => false, walletExternalSignedFields: () => null, walletChainClockOffsetMs: () => 0,
    walletChainClockKnown: true,
    WALLET_EXTERNAL_DEATH_GRACE_MS, WALLET_EXTERNAL_VALIDITY_S,
    markConvDeliveryUnlanded: (_thread: any, message: any, meta: string) => { message.meta = meta; did.push(`red: ${meta}`); },
    liveSendOf: () => null,
    clearPrivateSendRetry: () => {}, isTonRpcTransientError: () => false, isFatalPrivateSendError: () => false,
    walletMessageFromRecord: (record: any) => ({ ...record }), walletMessageToRecord: (item: any) => ({ ...item }), walletRecordSizeClass: () => 1,
    sendPlathoWalletTransaction: async (wallet: any, { messages }: any, options: any = {}) => {
      await options.onSigned?.({ boc: 'te6rest', seqno: 9, validUntil: 0, index: 0, unsentMessages: [], chunkMessages: messages });
      did.push(`the rest (${messages.length} parts) signed and paid by ${wallet?.label}`);
      messages.forEach((item: any) => shard.flying.push({ seq: item.seq, commit: item.commit }));
      await env.whileTheBytesLeave?.();
      return { pendingBoc: 'te6rest', pendingSeqno: 9, pendingValidUntil: 0 };
    },
  };
  const { api, missing } = liftWith(env, [
    fn('function walletOfSend(owner = undefined) {'), fn('function noOtherWalletThan(signer) {'), fn('function requireSameWallet(signer) {'),
    fn('function walletChangedBeforeSigningError() {'), fn('function createSerialLane() {'), line('const outgoingPublishLane = '),
    fn('function enqueueOutgoingPublish(task) {'), fn('async function attemptPrivateComposerMessagePublish(context) {'),
    fn('async function attemptIntroFirstContactDirect(context, owner = undefined) {'), fn('async function attemptConvMessagePublishDirect(context, owner = undefined) {'),
    fn('function convDayMovedError() {'),
    fn('async function settleVerifiedPeerWallet(selfKeyId, peerKeyId, rec, wallet, keyStore = convKeyStore) {'),
    fn('async function resumeConvPartialTail({ thread, message }, captured, transport, owner = undefined) {'), line('const CONV_TAIL_INCLUSION_MARGIN_SEC = '),
    fn('function convTailWithinShardDay(captured, nowSec) {'), fn('function convTailPendingError(text) {'), fn('function convTailNameOf(record) {'),
    fn('function partialTailOf(error, name = null) {'),
    line('const DIRECT_SEND_REBROADCAST_WINDOW_MS = '), line('const DIRECT_SEND_EXPIRY_GRACE_MS = '), line('const CONV_CONFIRM_SEQNO_CONSUMED_TERMINAL_MS = '),
    fn('function introSendBytesDead(send, now = Date.now()) {'), fn('function convLaterSendOnShard(thread, message, captured) {'),
    line('const CONV_TAIL_UNDELIVERABLE_META = '), fn('function markConvTailUndeliverable(thread, message, captured) {'),
    fn('async function settleEarlierConvTails(thread, message, address, transport, signer) {'), fn('function convEarlierRestPendingError() {'),
    fn('function isRecoverablePrivateSendError(error) {'),
    fn('function currentPrivateSenderMode() {'), fn('function currentPrivateSenderOptions(thread = activeThread()) {'),
    fn('function privateSenderOptionsAsPressed(thread, message) {'), fn('function privateSenderUsernameMetadataLabel(options = {}) {'),
    fn('function serializeMessageForHistory(message) {'), fn('function safeJsonClone(value) {'), fn('function privateSendRetryContextForMessage(thread, message) {'),
  ], `{ lane: enqueueOutgoingPublish, send: (context) => enqueueOutgoingPublish(() => attemptPrivateComposerMessagePublish(context)),
    recoverable: isRecoverablePrivateSendError, senderOptions: currentPrivateSenderOptions, record: serializeMessageForHistory,
    retryContext: privateSendRetryContextForMessage }`);
  const switchTo = async (who: 'B' | 'A again' | 'locked') => {
    env.walletSessionGeneration += 1;
    env.threads = [];
    if (who === 'locked') {
      Object.assign(env, { plathoWallet: null, convKeyStore: null, localRecipientKeyPair: null, localIdentity: null });
      return;
    }
    if (who === 'B') {
      Object.assign(env, { plathoWallet: { address: ADDRESS_B, label: 'wallet B', seed: 'seed of wallet B' }, convKeyStore: ksB, localRecipientKeyPair: { keyId: SELF_B }, localIdentity: { who: 'identity of wallet B' } });
      return;
    }
    const next = await keyStoreOf('A');
    convKeyStoreWallet.set(next, ADDRESS_A);
    Object.assign(env, {
      plathoWallet: { address: ADDRESS_A, label: 'wallet A in its next session', seed: 'seed of wallet A' }, convKeyStore: next,
      localRecipientKeyPair: { keyId: SELF_A }, localIdentity: { who: 'identity of wallet A in its next session' },
    });
  };
  const press = (thread: any, text: string) => {
    const message: any = { type: 'out', text, meta: 'sending', pricedGeneration: 18 };
    thread.messages.push(message);
    return { thread, message, text, attachments: [], fileAttachments: [], replyDraft: null, shareDraft: null, senderOptions: { includeSenderWalletMetadata: true }, retryAttempt: 0 };
  };
  const talkingToX = () => ksA.upsertConversationKRoot(SELF_A, X, { kRoot: new Uint8Array(32).fill(0x0a), introNonce: new Uint8Array(16).fill(0x1a), createdAt: 1_759_000_000, peerEncPublicKey: null, peerWallet: X_WALLET });
  return { env, api, missing, did, ksA, ksB, switchTo, press, talkingToX, shard, land };
};

describe('R19 — a send is sealed, routed and paid by the wallet it was pressed in, through every hand-off [A5 / F3-3]', () => {
  it('R19-SIGNER-01: a first message after its INTRO\'s read-back goes out from the wallet that pressed it, or from none', async () => {
    const w = await windowOf();
    const thread: any = { id: 'dm:x', messages: [] };
    w.env.threads = [thread];
    w.env.confirmIntroCreatedAt = async () => { await w.switchTo('B'); return { createdAt: 1_759_000_123 }; };
    expect(await outcomeOf(w.api.send(w.press(thread, 'hi, it is me')))).toBe('PLATHO_WALLET_CHANGED');
    expect(w.did, 'MEASURED before: routed by the root 0b0b.. of self bbbb.., sealed with the identity of wallet B, signed and paid by wallet B').toEqual([
      'INTRO sealed with the identity of wallet A', 'INTRO signed and paid by wallet A',
    ]);
    expect(Boolean(w.ksA.getConversation(SELF_A, X)?.kRootCurrent), 'the INTRO wallet A paid for is wallet A\'s').toBe(true);
    expect(hex(thread.convPeerKeyId), 'and the message waits for A, its INTRO kept: a Retry sends it on the CONV lane').toBe('5858');
    expect(w.ksB.getConversation(SELF_B, X)?.outgoingSeq ?? {}, 'wallet B\'s own conversation with X claims nothing').toEqual({});

    const again = await windowOf();
    const t2: any = { id: 'dm:x', messages: [] };
    again.env.threads = [t2];
    again.env.confirmIntroCreatedAt = async () => { await again.switchTo('A again'); return { createdAt: 1_759_000_123 }; };
    expect(await outcomeOf(again.api.send(again.press(t2, 'hi, it is me')))).toBe('sent');
    expect(again.did).toEqual([
      'INTRO sealed with the identity of wallet A', 'INTRO signed and paid by wallet A', 'its backup scheduled', `followed ${X_WALLET.slice(0, 4)}`,
      "its peer's keys read", 'its backup scheduled',
      'routed by the root 0a0a.. of self a1a1..', 'sealed with the identity of wallet A in its next session', 'signed and paid by wallet A in its next session',
      'its delivery watched', 'its peer followed', 'its backup promoted',
    ]);
    expect(again.env.convKeyStore.getConversation(SELF_A, X)?.peerWalletVerified, 'the peer\'s wallet, verified, in the key store of the session it went from').toBe(true);
  });

  it('R19-SIGNER-02: the INTRO and the rest of a part-sent message, handed on after the chain-clock wait, are paid by the wallet that pressed them, or by none', async () => {
    const w = await windowOf();
    const thread: any = { id: 'dm:y', messages: [] };
    w.env.threads = [thread];
    w.env.awaitWalletChainClock = async () => { await w.switchTo('B'); };
    expect(await outcomeOf(w.api.send(w.press(thread, 'hello')))).toBe('PLATHO_WALLET_CHANGED');
    expect(w.did, 'MEASURED before: the INTRO sealed with the identity of wallet B, signed and paid by wallet B').toEqual([]);

    const tailed = (env: Record<string, any>) => {
      const t: any = { id: 'dm:x', convPeerKeyId: X, messages: [] };
      env.threads = [t];
      const message: any = { type: 'out', text: 'the flat, three pictures', meta: 'partly sent: retry sends the rest', pricedGeneration: 18,
        convDirectSend: { boc: 'te6part1', seqno: 40, validUntil: Math.floor(Date.now() / 1000) - 400, at: Date.now() - 600_000, address: 'EQshard', epoch: Math.floor(Date.now() / 86_400_000), commits: ['5001', '5002', '5003'],
          partialTail: { messages: [{ address: 'EQvault', amount: '1', commit: '5002', seq: 2 }, { address: 'EQvault', amount: '1', commit: '5003', seq: 3 }], uncertainMessages: [{ address: 'EQvault', amount: '1', commit: '5001', seq: 1 }] } } };
      t.messages.push(message);
      return { thread: t, message, text: message.text, attachments: [], retryAttempt: 1 };
    };
    const rest = await windowOf();
    rest.env.awaitWalletChainClock = async () => { await rest.switchTo('B'); };
    expect(await outcomeOf(rest.api.send(tailed(rest.env)))).toBe('sent');
    expect(rest.did).toEqual(['the rest (2 parts) signed and paid by wallet A', 'its delivery watched']);

    const conv = (env: Record<string, any>, kept: any = null) => {
      const t: any = { id: 'dm:x', convPeerKeyId: X, messages: [] };
      env.threads = [t];
      const message: any = { type: 'out', text: 'third note', meta: 'sending', pricedGeneration: 18, ...(kept ? { convDirectSend: kept } : {}) };
      t.messages.push(message);
      return { thread: t, message, text: message.text, attachments: [], fileAttachments: [], replyDraft: null, shareDraft: null, senderOptions: {}, retryAttempt: 1 };
    };
    const alive = () => ({ boc: 'te6kept', seqno: 41, validUntil: Math.floor(Date.now() / 1000) + 200, at: Date.now() - 30_000, alive: true });
    const fresh = await windowOf();
    await fresh.talkingToX();
    fresh.env.awaitWalletChainClock = async () => { await fresh.switchTo('B'); };
    expect(await outcomeOf(fresh.api.send(conv(fresh.env)))).toBe('PLATHO_WALLET_CHANGED');
    expect(fresh.did, 'its peer\'s keys are not read for another wallet\'s session').toEqual([]);
    const kept = await windowOf();
    await kept.talkingToX();
    kept.env.awaitWalletChainClock = async () => { await kept.switchTo('B'); };
    expect(await outcomeOf(kept.api.send(conv(kept.env, alive())))).toBe('sent');
    expect(kept.did).toEqual(['its bytes offered again for wallet A', 'its delivery watched']);
    const locked = await windowOf();
    await locked.talkingToX();
    locked.env.awaitWalletChainClock = async () => { await locked.switchTo('locked'); };
    expect(await outcomeOf(locked.api.send(conv(locked.env, alive())))).toBe('sent');
    expect(locked.did).toEqual(['its bytes offered again for wallet A', 'its delivery watched']);
    const offering = await windowOf();
    await offering.talkingToX();
    offering.env.whileTheBytesLeave = () => offering.switchTo('B');
    expect(await outcomeOf(offering.api.send(conv(offering.env, alive())))).toBe('sent');
    expect(offering.did, 'MEASURED before: watched in B\'s session').toEqual(['its bytes offered again for wallet A']);
    const leaving = await windowOf();
    leaving.env.whileTheBytesLeave = () => leaving.switchTo('B');
    expect(await outcomeOf(leaving.api.send(tailed(leaving.env)))).toBe('sent');
    expect(leaving.did, 'MEASURED before: watched in B\'s session').toEqual(['the rest (2 parts) signed and paid by wallet A']);

    const reading = await windowOf();
    await reading.talkingToX();
    reading.env.whileThePeerIsRead = () => reading.switchTo('B');
    expect(await outcomeOf(reading.api.send(conv(reading.env)))).toBe('PLATHO_WALLET_CHANGED');
    expect(reading.did, 'its own route is not even derived for another wallet\'s session').toEqual(["its peer's keys read"]);
    expect(reading.ksA.getConversation(SELF_A, X)?.peerWalletVerified, 'MEASURED before: asked of the key store unlocked by then (wallet B\'s); wallet A\'s never learned it').toBe(true);
    expect(reading.ksB.getConversation(SELF_A, X)).toBe(null);
  });

  it('R19-SIGNER-03: a press that waited in the lane begins as its wallet\'s; what follows the bytes is done in their wallet\'s session', async () => {
    const w = await windowOf();
    await w.talkingToX();
    const thread: any = { id: 'dm:x', convPeerKeyId: X, messages: [] };
    w.env.threads = [thread];
    let release: () => void = () => {};
    const ahead = w.api.lane(() => new Promise<void>((resolve) => { release = resolve; }));
    const queued = outcomeOf(w.api.send(w.press(thread, 'see you at five')));
    await settle(5);
    await w.switchTo('B');
    release();
    await ahead;
    expect(await queued).toBe('PLATHO_WALLET_CHANGED');
    expect(w.did, 'MEASURED before: routed by the root 0b0b.. of self bbbb.., sealed with the identity of wallet B, signed and paid by wallet B').toEqual([]);
    const again = await windowOf();
    await again.talkingToX();
    const t2: any = { id: 'dm:x', convPeerKeyId: X, messages: [] };
    again.env.threads = [t2];
    let releaseAgain: () => void = () => {};
    const aheadAgain = again.api.lane(() => new Promise<void>((resolve) => { releaseAgain = resolve; }));
    const queuedAgain = outcomeOf(again.api.send(again.press(t2, 'see you at five')));
    await settle(5);
    await again.switchTo('A again');
    releaseAgain();
    await aheadAgain;
    expect(await queuedAgain).toBe('sent');
    expect(again.did).toEqual([
      "its peer's keys read", 'its backup scheduled', 'routed by the root 0a0a.. of self a1a1..', 'sealed with the identity of wallet A in its next session',
      'signed and paid by wallet A in its next session', 'its delivery watched', 'its peer followed', 'its backup promoted',
    ]);

    const after = await windowOf();
    await after.talkingToX();
    const t3: any = { id: 'dm:x', convPeerKeyId: X, messages: [] };
    after.env.threads = [t3];
    after.env.generationForEpoch = () => 18;
    after.env.convVaultRouting = async () => ({ deployVault: true, vaultAddress: 'EQvault-of-A', deployFlight: null });
    after.env.whileTheBytesLeave = () => after.switchTo('B');
    expect(await outcomeOf(after.api.send(after.press(t3, 'paid through the vault')))).toBe('sent');
    expect(after.did, 'MEASURED before: its vault noted live for wallet B, its delivery watched, its peer followed and its backup promoted in B\'s session').toEqual([
      "its peer's keys read", 'its backup scheduled', 'routed by the root 0a0a.. of self a1a1..', 'sealed with the identity of wallet A',
      'signed and paid by wallet A', 'its vault noted live for wallet A',
    ]);
    const afterAgain = await windowOf();
    await afterAgain.talkingToX();
    const t4: any = { id: 'dm:x', convPeerKeyId: X, messages: [] };
    afterAgain.env.threads = [t4];
    afterAgain.env.generationForEpoch = () => 18;
    afterAgain.env.convVaultRouting = async () => ({ deployVault: true, vaultAddress: 'EQvault-of-A', deployFlight: null });
    afterAgain.env.whileTheBytesLeave = () => afterAgain.switchTo('A again');
    expect(await outcomeOf(afterAgain.api.send(afterAgain.press(t4, 'paid through the vault')))).toBe('sent');
    expect(afterAgain.did.slice(5)).toEqual(['its vault noted live for wallet A', 'its delivery watched', 'its peer followed', 'its backup promoted']);
  });

  it('R19-SIGNER-04: a note is sealed into the notepad of the wallet that pressed or deleted it, or into none', async () => {
    const run = async (switchTo: 'B' | 'A again', { direct = false } = {}) => {
      const did: string[] = [];
      const wallets = {
        A: { address: ADDRESS_A, label: 'wallet A', seed: 'seed of wallet A' },
        'A again': { address: ADDRESS_A, label: 'wallet A in its next session', seed: 'seed of wallet A' },
        B: { address: ADDRESS_B, label: 'wallet B', seed: 'seed of wallet B' },
      };
      const env: Record<string, any> = {
        globalThis: { plathoTonRpcTransport: { runGetMethod: async () => ({}) } }, t: (key: string) => key, console: { warn() {} },
        plathoWallet: wallets.A, walletSessionGeneration: 1, selfNotesRestoreIncomplete: false,
        sameWalletAddress: (a: any, b: any) => Boolean(a) && a === b,
        readSelfSlotLedger: async () => ({ trusted: true }),
        restoreSelfNotesFromRecovery: async () => { env.walletSessionGeneration += 1; env.plathoWallet = wallets[switchTo]; env.selfNotesRestoreIncomplete = switchTo === 'B'; },
        selfNotesForBackup: async () => { did.push('packed'); return [{ at: 1, text: 'a note' }]; },
        createRecoveryViewReader: () => async () => null, createSelfSlotStatesReader: () => null,
        prepareNotesBackup: async ({ seed }: any) => { did.push(`sealed with the ${seed}`); return { publishes: [{ to: 'S0', value: 10n, body: {}, init: null, blobBytes: 100, seq: 1, h1: 1n }] }; },
        RECOVERY_PUBLISH_VALUE: 10n, shardArrearOf: async () => 0n, LANE_RECOVERY: 'recovery', assertWalletGramAtLeast: async () => {},
        walletSendFeeReserveNanotons: () => 0n, capsuleSizeClassForUsefulBytes: () => 1, minimalCapsuleUsefulBytesForLength: () => 1,
        tonCell: { bytesToBase64: () => 'B', serializeBoc: () => new Uint8Array(1) }, broadcastMayHaveLanded: () => false,
        sendPlathoWalletTransaction: async (wallet: any) => { did.push(`signed and paid by ${wallet.label}`); return {}; },
        markDirectSendBroadcast: () => {}, markSelfNotePublished: () => {}, armSelfNoteReceipt: () => {},
      };
      const { api } = liftWith(env, [fn('function walletOfSend(owner = undefined) {'), fn('function walletChangedBeforeSigningError() {'),
        fn('async function publishSelfNoteSnapshot(context) {'), fn('async function publishSelfNotesSnapshotForThread(thread, owner = undefined) {')],
      '{ save: publishSelfNoteSnapshot, republish: publishSelfNotesSnapshotForThread }');
      if (direct) {
        env.plathoWallet = wallets[switchTo];
        return { outcome: await outcomeOf(api.republish({ id: 'saved', messages: [] }, ADDRESS_A)), did };
      }
      return { outcome: await outcomeOf(api.save({ thread: { id: 'saved', messages: [] }, message: {} })), did };
    };
    expect(await run('B'), 'MEASURED before: this wallet\'s notes packed, sealed with the seed of wallet B, signed and paid by wallet B')
      .toEqual({ outcome: 'PLATHO_WALLET_CHANGED', did: [] });
    expect(await run('A again')).toEqual({ outcome: 'sent', did: ['packed', 'sealed with the seed of wallet A', 'signed and paid by wallet A in its next session'] });
    expect(await run('B', { direct: true }), 'the delete\'s second write').toEqual({ outcome: 'PLATHO_WALLET_CHANGED', did: [] });
    expect(await run('A again', { direct: true })).toEqual({ outcome: 'sent', did: ['packed', 'sealed with the seed of wallet A', 'signed and paid by wallet A in its next session'] });
  });

  it('R19-SIGNER-05: each funnel names its wallet to what it hands on and to what reads the chain for its bytes', () => {
    const conv = code(fn('async function attemptConvMessagePublishDirect(context, owner = undefined) {'));
    const clock = conv.indexOf('await awaitWalletChainClock({ requireSettled: true });');
    const check = conv.indexOf('walletOfSend(signer?.address ?? null);');
    expect(check, 'checked right after the wait, before the build').toBeGreaterThan(clock);
    expect(clock).toBeGreaterThan(conv.indexOf('const signer = walletOfSend(owner);'));
    expect(check).toBeLessThan(conv.indexOf('const rec = keyStore?.getConversation(selfKeyId, peerKeyId) ?? null;'));
    expect(conv).toContain('if (captured?.partialTail) return resumeConvPartialTail(context, captured, transport, signer?.address ?? null);');
    expect(conv).not.toContain('releaseRestLane');
    expect(conv).toContain('const answer = await rebroadcastSignedExternal(captured.boc, captured.seqno ?? null, transport, signer);');
    expect(conv).toContain('await directSendSeqnoConsumed(captured, transport, signer)');
    expect(conv).toContain('const rec = keyStore?.getConversation(selfKeyId, peerKeyId) ?? null;');
    expect(conv).not.toContain('convKeyStore?.getConversation(');
    expect(conv).toContain('await settleVerifiedPeerWallet(selfKeyId, peerKeyId, rec, wallet, keyStore);');
    const read = conv.indexOf('const bundle = await resolvePeerReplyBundle({');
    expect(conv.indexOf('walletOfSend(signer?.address ?? null);', read), 'checked again after the peer\'s keys are read').toBeGreaterThan(read);
    expect(conv.indexOf('walletOfSend(signer?.address ?? null);', read)).toBeLessThan(conv.indexOf('const route = await outgoingRecordShard('));
    expect(conv, 'the vault the send carried, noted for the wallet that signed it').not.toMatch(/(noteFeeVaultDeployed|settleFeeVaultDeployFlight)\(plathoWallet/);
    expect(conv).toContain('if (noOtherWalletThan(signer)) armConvDeliveryConfirm(thread, message);');
    const intro = code(fn('async function attemptIntroFirstContactDirect(context, owner = undefined) {'));
    expect(intro).toContain('const signer = walletOfSend(owner);');
    expect(intro).not.toContain('const signer = plathoWallet;');
    expect(intro).toContain('await rebroadcastSignedExternal(sendState.boc, sendState.seqno ?? null, transport, signer);');
    expect(intro).toContain('await directSendSeqnoConsumed(sendState, transport, signer)');
    expect(intro).toContain('return attemptConvMessagePublishDirect(context, signer?.address ?? null);');
    const tail = code(fn('async function resumeConvPartialTail({ thread, message }, captured, transport, owner = undefined) {'));
    expect(tail).toContain('const signer = walletOfSend(owner);');
    expect(tail.split('rebroadcastSignedExternal(captured.boc, captured.seqno ?? null, transport, signer)').length - 1, 'both of its re-offers').toBe(2);
    expect(tail).toContain('await directSendSeqnoConsumed(captured, transport, signer)');
    expect(tail).toContain('if (noOtherWalletThan(signer)) armConvDeliveryConfirm(thread, message);');
    expect(code(fn('async function resumePublicPartialTail(job, retained, failedStatus) {'))).toContain('await rebroadcastSignedExternal(retained.boc, retained.seqno ?? null, transport, signer);');
    const lane = code(fn('function enqueueOutgoingPublish(task) {'));
    expect(lane.indexOf('const queuedBy = plathoWallet?.address ?? null;')).toBeLessThan(lane.indexOf('const run = outgoingPublishLane(async () => {'));
    expect(lane.indexOf('if (queuedBy) walletOfSend(queuedBy);'), 'the first thing its turn does').toBeLessThan(lane.indexOf('const profile = beginTonRpcPhaseProfile();'));
    expect(lane.indexOf('if (queuedBy) walletOfSend(queuedBy);')).toBeGreaterThan(lane.indexOf('const run = outgoingPublishLane(async () => {'));
    expect(code(fn('async function rebroadcastSignedExternal(boc, seqno, transport, wallet = plathoWallet) {'))).not.toContain('plathoWallet.address');
    expect(code(fn('async function directSendSeqnoConsumed(send, transport, wallet = plathoWallet) {'))).toContain('await getPlathoWalletSeqno(wallet, transport);');
    expect(code(fn('async function deleteSelfNoteFromUi(thread, message, button) {')).split('publishSelfNotesSnapshotForThread(thread, owner)').length - 1, 'the delete and its second write').toBe(2);
    const save = code(fn('async function publishSelfNoteSnapshot(context) {'));
    expect(save).toContain('const outcome = await publishSelfNotesSnapshotForThread(thread, owner);');
    expect(save.indexOf('walletOfSend(owner);'), 'judged for its own wallet before the restore\'s verdict').toBeLessThan(save.indexOf('if (selfNotesRestoreIncomplete) {'));
    expect(save.indexOf('walletOfSend(owner);')).toBeGreaterThan(save.indexOf('await restoreSelfNotesFromRecovery('));
  });
});

describe('R19 — the rest of a part-sent message lands before a later message of its shard-day, or is never paid [A6 / F3-4]', () => {
  const DAY = () => Math.floor(Date.now() / 86_400_000);
  const pictureWithRest = async (w: any, { uncertain = false, address = 'EQshard' } = {}) => {
    await w.talkingToX();
    for (let seq = 1; seq <= 4; seq += 1) await w.ksA.nextOutgoingSeq(SELF_A, X, 20733, 0);
    w.shard.lastSeq = uncertain ? 2 : 3;
    w.shard.stored = new Set(uncertain ? ['h001', 'a002'] : ['h001', 'a002', 'a003']);
    w.env.convTailHeldOnShard = async () => ({ stored: new Set(w.shard.stored), lastSeq: w.shard.lastSeq });
    const nowSec = Math.floor(Date.now() / 1000);
    const hi: any = { type: 'out', text: 'hi', meta: 'sending',
      convDirectSend: { boc: 'te6hi', seqno: 39, validUntil: nowSec + 250, at: Date.now() - 50_000, address, epoch: DAY(), maxSeq: 1, commits: ['h001'] } };
    const picture: any = { type: 'out', text: 'the flat, three pictures', meta: 'partly sent: retry sends the rest', pricedGeneration: 18,
      convDirectSend: { boc: 'te6picture', seqno: 40, validUntil: uncertain ? nowSec + 200 : nowSec - 400, at: Date.now() - (uncertain ? 30_000 : 600_000), address, epoch: DAY(), maxSeq: 4,
        commits: ['a002', 'a003', 'a004'],
        partialTail: {
          messages: [{ address, amount: '1', commit: 'a004', seq: 4 }],
          uncertainMessages: uncertain ? [{ address, amount: '1', commit: 'a003', seq: 3 }] : [],
        } } };
    const thread: any = { id: 'dm:x', convPeerKeyId: X, messages: [hi, picture] };
    w.env.threads = [thread];
    return { thread, picture };
  };
  const retryOf = (thread: any, message: any) => ({ thread, message, text: message.text, attachments: [], fileAttachments: [], replyDraft: null, shareDraft: null, senderOptions: {}, retryAttempt: 1 });

  it('R19-ORDER-01: a new message of the day sends the picture\'s rest first — both land, in order', async () => {
    const w = await windowOf();
    const { thread, picture } = await pictureWithRest(w);
    expect(await outcomeOf(w.api.send(w.press(thread, 'did it come through?')))).toBe('sent');
    expect(w.did.filter((entry) => entry.includes('signed and paid')), 'MEASURED before: the later message signed first; the rest, on its ladder, after it')
      .toEqual(['the rest (1 parts) signed and paid by wallet A', 'signed and paid by wallet A']);
    w.land();
    expect([w.shard.seqs, w.shard.refused], 'MEASURED before: seq 5 stored, the rest\'s seq 4 refused 13653 — its transfer paid').toEqual([[4, 5], []]);
    expect(picture.convDirectSend.partialTail, 'the picture is whole: nothing is owed').toBe(null);
  });

  it('R19-ORDER-02: the rest never signs behind a later message of its shard-day — it waits for one in flight, and is not paid after one landed', async () => {
    const later = (state: any) => ({ type: 'out', text: 'did it come through?', meta: 'sending', ...state,
      convDirectSend: { boc: 'te6later', seqno: 41, validUntil: Math.floor(Date.now() / 1000) + 250, at: Date.now() - 5_000, address: 'EQshard', epoch: DAY(), maxSeq: 5, commits: ['b005'] } });
    const flying = await windowOf();
    const one = await pictureWithRest(flying);
    one.thread.messages.push(later({}));
    expect(await outcomeOf(flying.api.send(retryOf(one.thread, one.picture)))).toBe('CONV_PARTIAL_TAIL_PENDING');
    expect(flying.did, 'MEASURED before: the rest signed behind it, refused 13653, paid').toEqual([]);
    const landed = await windowOf();
    const two = await pictureWithRest(landed);
    two.thread.messages.push(later({ convDelivery: 'verified' }));
    expect(await outcomeOf(landed.api.send(retryOf(two.thread, two.picture)))).toBe('sent');
    expect(landed.did).toEqual(['red: partly sent: the rest can no longer be delivered — send it again']);
    const unlanded = await windowOf();
    const three = await pictureWithRest(unlanded);
    three.thread.messages.push(later({ convDelivery: 'unlanded' }));
    expect(await outcomeOf(unlanded.api.send(retryOf(three.thread, three.picture)))).toBe('sent');
    expect(unlanded.did).toEqual(['the rest (1 parts) signed and paid by wallet A', 'its delivery watched']);
  });

  it('R19-ORDER-03: a new message waits for a rest that must wait, claiming no seq meanwhile; another day\'s rest is not its concern; a rest refused for its own reason does not hold it', async () => {
    const w = await windowOf();
    const { thread } = await pictureWithRest(w, { uncertain: true });
    const waiting = await w.api.send(w.press(thread, 'did it come through?')).then(() => null, (error: any) => error);
    expect(waiting?.code).toBe('CONV_EARLIER_REST_PENDING');
    expect(w.api.recoverable(waiting), 'retried by the ladder — never "not sent"').toBe(true);
    expect(w.did.filter((entry) => !entry.startsWith('its peer') && !entry.startsWith('its backup') && !entry.startsWith('routed')),
      'MEASURED before: the new message signed at once, its seq above the rest\'s').toEqual(['its bytes offered again for wallet A']);
    expect(w.ksA.getConversation(SELF_A, X)?.outgoingSeq?.[20733], 'no seq claimed for it while it waits').toBe(4);
    const settleRests = code(fn('async function settleEarlierConvTails(thread, message, address, transport, signer) {'));
    for (const gone of ['claimLiveSend', 'refreshMessageFromHistory', 'convTailsOwedInHistory', 'tellConvRestOwed', 'dayHeld', '.lost?.(']) expect(settleRests).not.toContain(gone);
    expect(settleRests).toContain('await resumeConvPartialTail({ thread, message: earlier }, captured, transport, signer?.address ?? null);');
    const yesterday = await windowOf();
    const old = await pictureWithRest(yesterday, { address: 'EQshard-yesterday' });
    expect(await outcomeOf(yesterday.api.send(yesterday.press(old.thread, 'good morning')))).toBe('sent');
    expect(yesterday.did.filter((entry) => entry.includes('signed and paid'))).toEqual(['signed and paid by wallet A']);
    expect(old.picture.convDirectSend.partialTail).not.toBe(null);
    const short = await windowOf();
    const poor = await pictureWithRest(short);
    short.env.assertWalletGramAtLeast = async (_need: bigint, what: string) => {
      if (what === 'message') throw Object.assign(new Error('not enough GRAM for the rest'), { code: 'GRAM_SHORTFALL' });
    };
    expect(await outcomeOf(short.api.send(short.press(poor.thread, 'did it come through?')))).toBe('sent');
    expect(short.did.filter((entry) => entry.includes('signed and paid'))).toEqual(['signed and paid by wallet A']);
  });

  it('R19-ORDER-04: the order is the funnel\'s — the rests settled after the price and before a seq is claimed; a held send is retried', () => {
    const conv = code(fn('async function attemptConvMessagePublishDirect(context, owner = undefined) {'));
    const settleAt = conv.indexOf('await settleEarlierConvTails(thread, message, route.address, transport, signer);');
    expect(settleAt).toBeGreaterThan(conv.indexOf('if (pricedGenerationMovedAt(message?.pricedGeneration, createdAtSec)) throw pricesMovedError();'));
    expect(settleAt).toBeLessThan(conv.indexOf('await keyStore.nextOutgoingSeq('));
    expect(settleAt).toBeLessThan(conv.indexOf('coldFloor = await createRecordShardLastSeqReader('));
    expect(conv).not.toContain('releaseConvLane');
    const tail = code(fn('async function resumeConvPartialTail({ thread, message }, captured, transport, owner = undefined) {'));
    const laterAt = tail.indexOf('const later = convLaterSendOnShard(thread, message, captured);');
    expect(laterAt).toBeGreaterThan(tail.indexOf('if (!convTailWithinShardDay(captured, chainNowSec())) return markConvTailUndeliverable(thread, message, captured);'));
    expect(laterAt).toBeLessThan(tail.indexOf('await convTailHeldOnShard(captured, transport)'));
    expect(laterAt).toBeLessThan(tail.indexOf('await sendPlathoWalletTransaction('));
    expect(code(fn('function isRecoverablePrivateSendError(error) {'))).toContain("if (error?.code === 'CONV_EARLIER_REST_PENDING') return true;");
  });
});

describe('R19 — a message is sent as the person pressed it: anonymous stays anonymous through every later build [A7 / F1-4, F3-5]', () => {
  const pressedThenRetried = async (w: any, { anonymous, before }: { anonymous: boolean | null; before?: () => void }) => {
    await w.talkingToX();
    const thread: any = { id: 'dm:x', convPeerKeyId: X, messages: [] };
    w.env.threads = [thread];
    w.env.openThread = thread;
    const pressed: any = { type: 'out', text: 'it is me', blocks: [{ type: 'text', text: 'it is me' }], meta: 'not sent: retry', pricedGeneration: 18,
      ...(anonymous === null ? {} : { senderAnonymous: anonymous }) };
    const record = JSON.parse(JSON.stringify(w.api.record(pressed)));
    const restored: any = { ...record, localHistoryId: 'h1' };
    thread.messages.push(restored);
    before?.();
    const context = w.api.retryContext(thread, restored);
    expect(await outcomeOf(w.api.send(context))).toBe('sent');
    return { names: w.env.payloadNames, retryPlansNamed: context.senderOptions?.includeSenderWalletMetadata };
  };

  it('R19-SENDER-01: pressed anonymous, it stays anonymous after a reload — the eye turned back, "My notes" open; pressed named, it stays named; a record of an older build goes anonymous', async () => {
    const eyeBack = await windowOf();
    expect(await pressedThenRetried(eyeBack, { anonymous: true, before: () => { eyeBack.env.senderMode = 'named'; } }),
      'MEASURED before: the payload carried "alice.ath" — the eye turned back for later messages named the old one; the Retry priced it named')
      .toEqual({ names: [null], retryPlansNamed: false });
    const notesOpen = await windowOf();
    expect(await pressedThenRetried(notesOpen, { anonymous: true, before: () => { notesOpen.env.openThread = { id: 'saved' }; } }),
      'MEASURED before: "alice.ath" — the open "My notes" made it a note to yourself').toEqual({ names: [null], retryPlansNamed: false });
    const named = await windowOf();
    expect(await pressedThenRetried(named, { anonymous: false, before: () => { named.env.senderMode = 'anonymous'; } })).toEqual({ names: ['alice.ath'], retryPlansNamed: true });
    const older = await windowOf();
    older.env.senderMode = 'named';
    expect(await pressedThenRetried(older, { anonymous: null }), 'kept by no record of 1.4.18: the safe direction').toEqual({ names: [null], retryPlansNamed: false });
  });

  it('R19-SENDER-02: the press keeps the choice; "notes to yourself" is the message\'s own conversation, never the open one', () => {
    const press = code(fn(`${String.fromCharCode(10)}composer?.addEventListener('submit', async (event) => {`));
    expect(press.indexOf('senderAnonymous: senderOptions.includeSenderWalletMetadata === false,')).toBeGreaterThan(press.indexOf('const senderOptions = currentPrivateSenderOptions();'));
    const token = code(fn('async function sendGroupTokenMessage(peerThread, token, { pricedGeneration = null } = {}) {'));
    expect(token).toContain('const senderOptions = currentPrivateSenderOptions(peerThread);');
    expect(token).toContain('senderAnonymous: senderOptions.includeSenderWalletMetadata === false,');
    expect(token).toContain('thread: peerThread, message, text: token, senderOptions,');
    expect(code(fn('async function attemptConvMessagePublishDirect(context, owner = undefined) {'))).toContain('const senderOptions = context.senderOptions ?? privateSenderOptionsAsPressed(thread, message);');
    expect(code(fn('function currentPrivateSenderOptions(thread = activeThread()) {'))).toContain('const savedThread = isSavedMessagesThread(thread);');
  });
});

describe('R19 — Send GRAM is the wallet\'s that pressed it: its one press, its outcome, its watch [A9 / F5-2, F1-5, F3-I2, F6-4]', () => {
  const sameAddress = (a: any, b: any) => Boolean(a) && a === b;
  const clickHandler = () => {
    const start = "sendWalletTonButton?.addEventListener('click', async () => {";
    const at = app.indexOf(start);
    const open = app.indexOf('{', at + start.length - 1);
    let depth = 0;
    for (let k = open; k < app.length; k += 1) {
      if (app[k] === '{') depth += 1;
      else if (app[k] === '}') { depth -= 1; if (depth === 0) return `async () => ${app.slice(open, k + 1)}`; }
    }
    throw new Error('unbalanced');
  };
  const sendGram = () => {
    const attributes = new Map<string, string>();
    const button: any = { disabled: false, attributes, setAttribute: (name: string, value: string) => { attributes.set(name, value); }, removeAttribute: (name: string) => { attributes.delete(name); } };
    const row: any = { textContent: '', dataset: {} };
    const notices: string[] = [];
    let submit: () => Promise<any> = async () => null;
    const env: Record<string, any> = {
      sendWalletTonButton: button, sendWalletTonStatus: row, setText: (node: any, text: string) => { node.textContent = text; }, t: (key: string) => key,
      plathoWallet: { address: 'A' }, console: { error() {}, warn() {} }, gramShortfallText: () => null,
      walletTransferNotRun: (error: any) => error?.code === 'PLATHO_WALLET_EXTERNAL_REPLACED',
      flashWalletIdentityStatus: (text: string) => notices.push(text), setTimeout: () => 0, submitWalletTonTransfer: () => submit(),
      sameWalletAddress: sameAddress,
    };
    const { api } = liftWith(env, [line('const STATUS_HOLD_MS = '), line('const heldStatusText = '), line('const walletTonTransfersBusy = '),
      fn("function holdStatusText(node, text, { state = 'short', scope = null, ms = STATUS_HOLD_MS, refresh = null } = {}) {"), fn('function statusHeld(node, scope = null) {'),
      `function refreshMessagingControls() {${String.fromCharCode(10)}${line('  const gramTransferBusy = ')}${String.fromCharCode(10)}${line('  if (sendWalletTonButton) sendWalletTonButton.disabled = ')}${String.fromCharCode(10)}${line('  if (sendWalletTonButton) { if (gramTransferBusy) ')}${String.fromCharCode(10)}${line('  if (!gramTransferBusy && !statusHeld(sendWalletTonStatus)) setText(')}${String.fromCharCode(10)}}`,
      `const onSendGram = ${clickHandler()};`], '{ press: onSendGram, repaint: refreshMessagingControls }');
    return { env, api, button, row, notices, setSubmit: (run: () => Promise<any>) => { submit = run; } };
  };
  const waitedOut = (g: any) => {
    const hold: any = {};
    g.setSubmit(() => new Promise((resolve, reject) => { g.row.textContent = 'wallet.gramTransferSending'; hold.resolve = resolve; hold.reject = reject; }));
    return hold;
  };

  it('R20-GRAM-01: A presses, B presses after a switch, back to A — A\'s button stays busy until A\'s own end [client audit round 20 — B3 (F1-5)]', async () => {
    const g = sendGram();
    const holds: Array<(value: any) => void> = [];
    const submits: string[] = [];
    g.setSubmit(() => new Promise((resolve) => { submits.push(g.env.plathoWallet.address); holds.push(resolve); }));
    const a1 = g.api.press();
    await settle(1);
    g.env.plathoWallet = { address: 'B' };
    g.api.repaint();
    const b1 = g.api.press();
    await settle(1);
    g.env.plathoWallet = { address: 'A' };
    g.api.repaint();
    expect(g.button.attributes.get('aria-disabled'), 'MEASURED before: A\'s button free, a second A transfer sent').toBe('true');
    void g.api.press();
    await settle(1);
    expect(submits).toEqual(['A', 'B']);
    holds[1](null);
    await b1;
    g.api.repaint();
    expect(g.button.attributes.get('aria-disabled')).toBe('true');
    holds[0](null);
    await a1;
    g.api.repaint();
    expect(g.button.attributes.has('aria-disabled')).toBe(false);
  });

  it('R19-GRAM-01: its one press and its outcome are the wallet\'s that pressed — never another wallet\'s screen, never a locked app', async () => {
    const g = sendGram();
    const hold = waitedOut(g);
    const pressed = g.api.press();
    await settle(1);
    g.env.plathoWallet = { address: 'B' };
    g.api.repaint();
    expect([g.button.disabled, g.button.attributes.has('aria-disabled'), g.row.textContent], 'MEASURED before: B\'s Send GRAM disabled under A\'s "sending GRAM…"').toEqual([false, false, 'wallet.statusWallet']);
    hold.reject(Object.assign(new Error('replaced'), { code: 'PLATHO_WALLET_EXTERNAL_REPLACED' }));
    await pressed;
    expect(g.notices, 'A\'s answer says nothing on B\'s screen').toEqual([]);
    const same = sendGram();
    const held = waitedOut(same);
    const first = same.api.press();
    await settle(1);
    same.env.plathoWallet = { address: 'A' };
    same.api.repaint();
    expect([same.button.disabled, same.button.attributes.get('aria-disabled'), same.row.textContent]).toEqual([false, 'true', 'wallet.gramTransferSending']);
    let second = 0;
    same.setSubmit(async () => { second += 1; });
    await same.api.press();
    expect(second, 'a second press while the first is waited out sends nothing').toBe(0);
    held.resolve(null);
    await first;
    expect([same.button.disabled, same.button.attributes.has('aria-disabled')]).toEqual([false, false]);

    const outcome = async (during: (env: any) => void, result: any = { outcome: 'consumed' }) => {
      const said: string[] = [];
      const rows: string[] = [];
      const watched: any[] = [];
      let release: () => void = () => {};
      const env: Record<string, any> = {
        requestWalletTonTransferDetails: async () => ({ recipient: 'R', amount: 1_000_000_000n }), requirePlathoWallet: () => env.plathoWallet,
        plathoWallet: { address: 'A' }, sameWalletAddress: sameAddress, setVaultStatus: () => {},
        transferRecipientAccountStatus: async () => 'active', transferBounceForStatus: () => true, createWalletTransaction: (m: any) => ({ messages: [m] }),
        assertWalletGramAtLeast: async () => {}, walletSendFeeReserveNanotons: () => 1n, requireSameWallet: (signer: any) => signer,
        sendPlathoWalletTransaction: async () => {
          await new Promise<void>((resolve) => { release = resolve; });
          if (result?.throws) throw result.throws;
          return result;
        },
        broadcastMayHaveLanded: (error: any) => Boolean(error?.builtBoc), globalThis: {},
        flashWalletIdentityStatus: (text: string) => said.push(text), t: (key: string) => key, setText: (_node: any, text: string) => rows.push(text),
        sendWalletTonStatus: {}, queueVaultPostTransactionRefresh: () => {}, watchWalletTonTransfer: (address: any) => watched.push(address),
      };
      const { api } = liftWith(env, [fn('async function submitWalletTonTransfer(hold = null) {')], 'submitWalletTonTransfer');
      const run = api();
      await settle(1);
      during(env);
      release();
      await run;
      return { said, rows, kept: Object.keys(env.globalThis), watched };
    };
    expect(await outcome((env) => { env.plathoWallet = null; }), 'MEASURED before: said on the locked app, its recipient and amount kept in the cleared diagnostics')
      .toEqual({ said: ['wallet.gramTransferSending'], rows: ['wallet.gramTransferSending'], kept: [], watched: [] });
    expect(await outcome((env) => { env.plathoWallet = { address: 'B' }; }), 'MEASURED before: "completed" over B\'s screen')
      .toEqual({ said: ['wallet.gramTransferSending'], rows: ['wallet.gramTransferSending'], kept: [], watched: [] });
    expect(await outcome((env) => { env.plathoWallet = { address: 'A' }; }), 'its own next session is told')
      .toEqual({ said: ['wallet.gramTransferSending', 'wallet.gramTransferSent'], rows: ['wallet.gramTransferSending', ''], kept: ['plathoLastWalletTonTransfer'], watched: [] });
    const unseen = await outcome((env) => { env.plathoWallet = { address: 'B' }; }, { outcome: 'unverified', pendingSeqno: 7, pendingBoc: 'te6' });
    expect([unseen.said, unseen.watched]).toEqual([['wallet.gramTransferSending'], ['A']]);
    const ambiguous = await outcome((env) => { env.plathoWallet = { address: 'B' }; }, { throws: Object.assign(new Error('timeout'), { builtBoc: 'te6', builtSeqno: 7 }) });
    expect(ambiguous, 'MEASURED before: "submitted" flashed over B, the signed bytes kept in its diagnostics')
      .toEqual({ said: ['wallet.gramTransferSending'], rows: ['wallet.gramTransferSending'], kept: [], watched: ['A'] });
  });

  it('R19-GRAM-02: the watch holds the address alone, rests while locked, goes on for the same wallet, ends under another — and says its end; gently', async () => {
    const watchOf = (fates: Array<string | (() => string)>, { real = null as any } = {}) => {
      const said: string[] = [];
      const asked: any[] = [];
      const timers: Array<{ run: () => Promise<void>; wait: number }> = [];
      const clock = { now: 1_800_000_000_000 };
      const env: Record<string, any> = {
        plathoWallet: { address: 'A', seed: 'seed of wallet A' }, sameWalletAddress: sameAddress, t: (key: string) => key,
        flashWalletIdentityStatus: (text: string) => said.push(text), queueVaultPostTransactionRefresh: () => {}, globalThis: { plathoWalletRpcTransport: real?.transport ?? {} },
        Date: { now: () => clock.now }, setTimeout: (run: () => Promise<void>, wait: number) => { timers.push({ run, wait }); return timers.length; },
        walletExternalOutcomeNow: real?.outcome ?? (async (wallet: any, _transport: any, _send: any, options: any) => {
          asked.push({ keys: Object.keys(wallet), priority: options?.priority, quick: options?.quick });
          const next = fates.shift() ?? 'unknown';
          return typeof next === 'function' ? next() : next;
        }),
      };
      const { api } = liftWith(env, [line('const WALLET_TON_TRANSFER_WATCH_MS = '), line('const WALLET_TON_TRANSFER_WATCH_STEPS_MS = '),
        fn('function watchWalletTonTransfer(address, { seqno, validUntil, boc }, bounce) {')], 'watchWalletTonTransfer');
      const drive = async (between: (look: number) => void = () => {}) => {
        for (let look = 0; look < 60 && timers.length > 0; look += 1) {
          const { run, wait } = timers.shift()!;
          clock.now += wait;
          between(look);
          await run();
        }
      };
      return { env, said, asked, start: (send: any) => api('A', send, true), drive, waits: () => timers.map((t) => t.wait) };
    };
    const send = { seqno: 7, validUntil: 1, boc: 'te6' };

    const relock = watchOf(['unknown', 'consumed']);
    relock.start(send);
    await relock.drive((look) => {
      if (look === 1) relock.env.plathoWallet = null;
      if (look === 3) relock.env.plathoWallet = { address: 'A', seed: 'seed of wallet A' };
    });
    expect(relock.said, 'MEASURED before: a lock and an unlock ended it silently — "submitted" stood over it').toEqual(['wallet.gramTransferSent']);
    expect(relock.asked.length, 'nothing asked while locked').toBe(2);
    expect(relock.asked.every((ask) => ask.keys.join() === 'address'), 'MEASURED before: the wallet object — its seed — held 14 to 39 s past the lock').toBe(true);
    const other = watchOf(['unknown', 'consumed']);
    other.start(send);
    await other.drive((look) => { if (look === 1) other.env.plathoWallet = { address: 'B' }; });
    expect([other.said, other.asked.length]).toEqual([[], 1]);
    const silent = watchOf([]);
    silent.start(send);
    await silent.drive();
    expect(silent.said, 'MEASURED before: it ended saying nothing; "submitted" stood').toEqual(['wallet.transferUnconfirmed']);
    expect(silent.asked.map((ask) => `${ask.priority}${ask.quick ? ' quick' : ''}`), 'MEASURED before: every 15 s, critical, the whole ladder')
      .toEqual(['critical quick', ...Array(7).fill('background quick')]);

    const W: any = await import('../web/platho-wallet.mjs');
    const { beginCell } = await import('@ton/core');
    const built = { boc: beginCell().storeUint(0x7369676e, 32).storeRef(beginCell().storeUint(7, 32).storeUint(0, 32).endCell()).endCell().toBoc().toString('base64') };
    const requests: string[] = [];
    const transport = {
      runGetMethod: async (call: any) => { requests.push(`seqno ${call.priority}`); return { stack: [['num', '0x9']] }; },
      getAccountTransactionsLive: async (_q: any, options: any) => { requests.push(`live ${options?.priority}`); throw new Error('down'); },
      getAccountTransactions: async (_q: any, options: any) => { requests.push(`index ${options?.priority}`); throw new Error('down'); },
    };
    const priced = watchOf([], { real: { transport, outcome: W.walletExternalOutcomeNow } });
    priced.start({ seqno: 7, validUntil: Math.floor(Date.now() / 1000) + 300, boc: built.boc });
    await priced.drive();
    expect(requests.length, 'MEASURED before: 78 requests in 7 minutes, every one critical').toBeLessThanOrEqual(30);
    expect(requests.slice(0, 3)).toEqual(['seqno critical', 'live critical', 'index critical']);
    expect(requests.slice(3).every((request) => request.endsWith('background')), 'none critical after the first look').toBe(true);
    expect(priced.said).toEqual(['wallet.transferUnconfirmed']);
  });
});

describe('R19 — no verdict for good on a clock nobody checked; the jump test before the doubt is read [A10 / F7-3, F2-3, F3-6; A13 / F2-4]', () => {
  const DAY = () => Math.floor(Date.now() / 86_400_000);

  it('R19-CLOCK-01: the rest of a part-sent message is judged by its day only on the chain\'s clock — unread or in doubt, it waits, kept with its Retry', async () => {
    const tailed = (w: any, epoch: number) => {
      const thread: any = { id: 'dm:x', convPeerKeyId: X, messages: [] };
      w.env.threads = [thread];
      const message: any = { type: 'out', text: 'the flat, three pictures', meta: 'partly sent: retry sends the rest', pricedGeneration: 18,
        convDirectSend: { boc: 'te6part1', seqno: 40, validUntil: Math.floor(Date.now() / 1000) - 400, at: Date.now() - 600_000, address: 'EQshard', epoch, commits: ['5001', '5002', '5003'],
          partialTail: { messages: [{ address: 'EQvault', amount: '1', commit: '5002', seq: 2 }, { address: 'EQvault', amount: '1', commit: '5003', seq: 3 }], uncertainMessages: [{ address: 'EQvault', amount: '1', commit: '5001', seq: 1 }] } } };
      thread.messages.push(message);
      return { context: { thread, message, text: message.text, attachments: [], retryAttempt: 1 }, message };
    };
    const unread = await windowOf();
    unread.env.walletChainClockKnown = false;
    const one = tailed(unread, DAY() - 2);
    expect(await outcomeOf(unread.api.send(one.context))).toBe('CONV_PARTIAL_TAIL_PENDING');
    expect([unread.did, Boolean(one.message.convDirectSend.partialTail)], 'MEASURED before: "can no longer be delivered", the rest erased with its Retry')
      .toEqual([[], true]);
    const doubted = await windowOf();
    doubted.env.walletChainClockKnown = true;
    doubted.env.walletClockInDoubt = () => true;
    const two = tailed(doubted, DAY() - 2);
    expect(await outcomeOf(doubted.api.send(two.context))).toBe('CONV_PARTIAL_TAIL_PENDING');
    expect(Boolean(two.message.convDirectSend.partialTail)).toBe(true);
    const past = await windowOf();
    past.env.walletChainClockKnown = true;
    const three = tailed(past, DAY() - 3);
    expect(await outcomeOf(past.api.send(three.context))).toBe('sent');
    expect(past.did).toEqual(['red: partly sent: the rest can no longer be delivered — send it again']);
    const within = await windowOf();
    within.env.walletChainClockKnown = true;
    expect(await outcomeOf(within.api.send(tailed(within, DAY()).context))).toBe('sent');
    expect(within.did[0]).toBe('the rest (2 parts) signed and paid by wallet A');
  });

  it('R19-CLOCK-02: the delivery confirm calls bytes dead by their signed deadline on the chain\'s clock — never on the device\'s age, never in doubt', async () => {
    const tick = async ({ ageMin, validUntilSec, doubt = false, boc = 'te6last' }: { ageMin: number; validUntilSec: number | null; doubt?: boolean; boc?: string }) => {
      const did: string[] = [];
      const message: any = { type: 'out', meta: 'sending',
        convDirectSend: { boc, seqno: 12, at: Date.now() - ageMin * 60_000, ...(validUntilSec === null ? {} : { validUntil: validUntilSec }), address: 'EQshard', epoch: 20733, commits: ['a1'], maxSeq: 5 } };
      const thread: any = { id: 'dm:x', messages: [message] };
      const env: Record<string, any> = {
        globalThis: { plathoWalletRpcTransport: { runGetMethod: async () => ({}) } }, console: { warn() {} },
        walletClockInDoubt: () => doubt, walletChainClockOffsetMs: () => 0,
        walletExternalSignedFields: (bytes: string) => (bytes === 'te6signed-alive' ? { validUntil: Math.floor(Date.now() / 1000) + 200 } : null),
        WALLET_EXTERNAL_DEATH_GRACE_MS: 90_000, WALLET_EXTERNAL_VALIDITY_S: 300, generationForEpoch: () => 17, usingKeylessTonRpc: () => false,
        createRecordShardViewReader: () => async () => null, createRecordShardRecordReader: () => async () => null, createRecordShardPageReader: () => null,
        confirmConvRecordsLanded: async () => ({ landed: false, complete: false, seqShort: true }),
        noteTonRpcRateLimit: () => false,
        markConvDeliveryUnlanded: () => did.push('red: not delivered — resend'), markConvDeliveryUnverified: () => did.push('unverified'),
        armConvDeliveryConfirm: () => did.push('looked at again'), rebroadcastPendingDirectSend: async () => { did.push('offered again'); },
        cancelConvDeliveryConfirm: () => {}, refreshThreadAfterMessageChange: () => {}, renderThreads: () => {}, renderConversation: () => {},
        updateMessageInEncryptedHistory: async () => true, refreshMessagingControls: () => {},
      };
      const { api } = liftWith(env, [line('const CONV_CONFIRM_MAX_AGE_MS = '), line('const CONV_CONFIRM_SEQNO_CONSUMED_TERMINAL_MS = '),
        line('const DIRECT_SEND_REBROADCAST_WINDOW_MS = '), line('const DIRECT_SEND_EXPIRY_GRACE_MS = '), line('const CONV_CONFIRM_BOUNDED_SCAN = '),
        line('const convDeliveryConfirmTimers = '), line('let convDeliveryConfirmGeneration = '),
        fn('function convConfirmConsumedTerminalMs(send) {'), fn('function introSendBytesDead(send, now = Date.now()) {'),
        fn('async function runConvDeliveryConfirm(thread, message, attempt, generation) {')], 'runConvDeliveryConfirm');
      await api(thread, message, 3, 0);
      return did;
    };
    const nowSec = Math.floor(Date.now() / 1000);
    expect(await tick({ ageMin: 9, validUntilSec: nowSec + 200 }), 'MEASURED before: "not delivered — resend" — and the bytes then landed')
      .toEqual(['offered again', 'looked at again']);
    expect(await tick({ ageMin: 2, validUntilSec: nowSec - 200 })).toEqual(['red: not delivered — resend']);
    expect(await tick({ ageMin: 9, validUntilSec: nowSec - 200, doubt: true })).toEqual(['offered again', 'looked at again']);
    expect(await tick({ ageMin: 9, validUntilSec: null, boc: 'te6signed-alive' })).toEqual(['offered again', 'looked at again']);
    expect(await tick({ ageMin: 9, validUntilSec: null })).toEqual(['red: not delivered — resend']);
    expect(await tick({ ageMin: 7, validUntilSec: null })).toEqual(['offered again', 'looked at again']);
    expect(await tick({ ageMin: 2, validUntilSec: null })).toEqual(['offered again', 'looked at again']);
  });

  it('R19-CLOCK-03: short aways that add up past the tolerance make the next write wait for the chain, and the bytes judged on that tick live', async () => {
    const wal: any = await import('../web/platho-wallet.mjs');
    const clock = { wall: Date.parse('2026-10-18T12:00:00Z'), mono: 5_000_000 };
    const realNow = Date.now;
    const realPerformanceNow = Object.getOwnPropertyDescriptor(globalThis.performance, 'now');
    Date.now = () => clock.wall;
    Object.defineProperty(globalThis.performance, 'now', { value: () => clock.mono, configurable: true, writable: true });
    const asked: number[] = [];
    wal.setWalletClockRefresh(() => asked.push(clock.wall));
    try {
      const chainNow = () => clock.wall - 1.5 * 86_400_000;
      const suspendedThrice = () => {
        wal.noteChainTime(Math.floor(chainNow() / 1000), clock.wall);
        for (let away = 0; away < 3; away += 1) clock.wall += 40_000;
      };
      suspendedThrice();
      let release: () => void = () => {};
      let reads = 0;
      const { api: awaitClock } = liftWith({
        walletClockInDoubt: wal.walletClockInDoubt, walletChainClockOffsetMs: wal.walletChainClockOffsetMs, plathoWallet: {},
        refreshWalletChainClock: () => { reads += 1; return new Promise<void>((resolve) => { release = resolve; }); },
        setTimeout: () => 0, Date: { now: () => clock.wall },
      }, ['let walletChainClockKnown = true;', 'let walletChainClockRead = null;', 'let walletChainClockReadAt = -Infinity;',
        fn('async function awaitWalletChainClock({ timeoutMs = 4_000, requireSettled = false } = {}) {')], 'awaitWalletChainClock');
      let waited = false;
      const pending = awaitClock().then(() => { waited = true; });
      await settle(1);
      expect([waited, reads], 'MEASURED before: it returned at once — the doubt not raised yet — and the write took the device\'s day (slot 20746 on chain day 20744)')
        .toEqual([false, 1]);
      release();
      await pending;
      expect(waited).toBe(true);
      suspendedThrice();
      const { api: rebroadcastable } = liftWith({
        walletClockInDoubt: wal.walletClockInDoubt, walletChainClockOffsetMs: wal.walletChainClockOffsetMs, walletExternalSignedFields: () => null,
        WALLET_EXTERNAL_DEATH_GRACE_MS: wal.WALLET_EXTERNAL_DEATH_GRACE_MS, WALLET_EXTERNAL_VALIDITY_S: wal.WALLET_EXTERNAL_VALIDITY_S,
      }, [line('const DIRECT_SEND_REBROADCAST_WINDOW_MS = '), line('const DIRECT_SEND_EXPIRY_GRACE_MS = '), fn('function directSendRebroadcastable(captured, now = Date.now()) {')],
      'directSendRebroadcastable');
      const alive = { boc: 'te6', validUntil: Math.floor(chainNow() / 1000) + 100, at: clock.wall - 200_000 };
      expect(rebroadcastable(alive, clock.wall), 'MEASURED before: dead on the jump\'s own tick — rebuilt beside bytes that could land').toBe(true);
      expect(wal.walletClockInDoubt()).toBe(true);
    } finally {
      Date.now = realNow;
      if (realPerformanceNow) Object.defineProperty(globalThis.performance, 'now', realPerformanceNow);
      else delete (globalThis.performance as any).now;
      wal.setWalletClockRefresh(null);
      wal.noteChainTime(Math.floor(Date.now() / 1000), Date.now());
    }
  });
});

describe('R19 — a room message keeps the seq it claimed before its key is given out; the restore keeps what the room confirmed [A11 / F1-3]', () => {
  it('R19-ROOM-01: a page that ended after the echo took its key leaves the seq claimed — the next message of the room-day takes the next one', async () => {
    const { beginCell } = await import('@ton/core');
    const lanes: any = await import('../web/shard-address.mjs');
    const { createGroupRuntime }: any = await import('../web/group-runtime.mjs');
    const { createMemoryGroupRecordStore }: any = await import('../web/group-record-store.mjs');
    const { ml_kem768 }: any = await import('../web/vendor/@noble/post-quantum/ml-kem.js');
    const { x25519 }: any = await import('../web/vendor/@noble/curves/ed25519.js');
    const cell = beginCell().storeUint(0x5a5a, 16).endCell().toBoc().toString('base64');
    lanes.__setLaneGenerationCodeForTests('record', 18, cell);
    lanes.__setLaneGenerationCodeForTests('vault', 18, cell);
    try {
      const CLOCK = 1_800_000_000;
      const fill = 0x31;
      const kem = ml_kem768.keygen(new Uint8Array(64).fill(fill));
      const xSecret = new Uint8Array(32).fill(fill ^ 0x5a);
      const identity = {
        vaultSeed: new Uint8Array(32).fill(fill), wallet: `0:${'31'.repeat(32)}`, keyId: 'key-31', name: 'member-31',
        x25519SecretKey: xSecret, x25519PublicKey: x25519.getPublicKey(xSecret), mlKem768SecretKey: kem.secretKey, mlKem768PublicKey: kem.publicKey,
      };
      const store = createMemoryGroupRecordStore();
      const session = () => createGroupRuntime({
        store, identity, send: async () => {}, vaultRouting: async () => ({ vaultAddress: `0:${'aa'.repeat(32)}`, feeDue: 10_000_000n }),
        readMessagesWithSource: async () => [], readStates: async () => new Map(), publishValue: 19_100_000n,
        now: () => CLOCK, boundary: Math.floor(CLOCK / 86_400), random: (n: number) => new Uint8Array(n).fill(0x5c),
      });
      const first = session();
      const room = await first.create({ name: 'the kitchen' });
      const id = Buffer.from(room.groupId).toString('hex');
      let keyA: any = null;
      await first.say(id, 'A: see you at eight', { onSealed: (coords: any) => { keyA = coords; throw new Error('the page ended'); } }).catch(() => {});
      const next = session();
      await next.load();
      let keyB: any = null;
      await next.say(id, 'B: running late, nine instead', { onSealed: (coords: any) => { keyB = coords; } });
      expect(keyB.firstSeq, 'MEASURED before: the same seq — the dead echo\'s key given to the delivered message').toBe(keyA.lastSeq + 1);
    } finally {
      lanes.__resetLaneGenerationCodeOverridesForTests();
    }
  });

  it('R19-ROOM-02: two records of one key — a dead echo and the message the room took — the restore keeps the one the room confirmed', () => {
    const run = (order: 'dead first' | 'delivered first', deadMeta = 'sending') => {
      const dropped: string[] = [];
      const env: Record<string, any> = {
        threads: [], historyDuplicateRecordIds: new Set(), historyApplyFailures: [], console: { warn() {}, error() {} },
        encryptedMessageStore: { deleteMessage: async (id: string) => { dropped.push(id); } },
        ensureHistoryThread: (threadId: string) => { const thread = { id: threadId, messages: [] as any[] }; env.threads.push(thread); return thread; },
        applyHistoryThreadSnapshot: () => {}, liveSendOf: () => null, reviveIntroDirectSend: (value: any) => value, ensureMessageOrderFields: () => {},
        sortThreadMessages: () => {}, refreshThreadAfterMessageChange: () => {}, noteThreadFace: () => {}, avatarPointerFromFields: () => null,
        messageStatusKey: (m: any) => {
          const meta = String(m?.meta ?? '');
          if (meta.startsWith('sending')) return 'sending';
          if (meta.startsWith('not ')) return 'failed';
          return meta ? 'sent' : 'info';
        },
      };
      const { api } = liftWith(env, [fn('function roomRecordUnconfirmed(message) {'), fn('function applyRestoredHistoryItems(items, { applied = null, eagerFaces = false } = {}) {')], 'applyRestoredHistoryItems');
      const key = '20738.1.c0ffee.1';
      const dead = { id: 'r-dead', threadId: 'group:g', createdAt: 1, thread: { id: 'group:g' }, message: { type: 'out', text: 'A: see you at eight', meta: deadMeta, groupChainKey: key } };
      const delivered = { id: 'r-delivered', threadId: 'group:g', createdAt: 2, thread: { id: 'group:g' }, message: { type: 'out', text: 'B: running late, nine instead', meta: '', groupChainKey: key } };
      api(order === 'dead first' ? [dead, delivered] : [delivered, dead]);
      return { shown: env.threads[0].messages.map((m: any) => m.text), dropped };
    };
    expect(run('dead first'), 'MEASURED before: the dead echo kept, the delivered message\'s record deleted')
      .toEqual({ shown: ['B: running late, nine instead'], dropped: ['r-dead'] });
    expect(run('delivered first')).toEqual({ shown: ['B: running late, nine instead'], dropped: ['r-dead'] });
    expect(run('dead first', 'not delivered: the room did not take it')).toEqual({ shown: ['B: running late, nine instead'], dropped: ['r-dead'] });
  });
});

describe('R19 — a rest refused before it was signed is "partly sent"; what answers after a lock or a switch is the gone session\'s [A14 / F7-6; A15 / F5-3]', () => {
  it('R19-PARTLY-01: a part-sent message whose rest is refused before signing reads "partly sent: <why>", red, with Retry and no Cancel', async () => {
    const { I18N_STRINGS }: any = await import('../web/i18n-strings.mjs');
    const said = (error: any, { tail = true } = {}) => {
      const message: any = { type: 'out', text: 'the flat, three pictures', meta: 'sending',
        convDirectSend: { boc: 'te6part1', seqno: 40, ...(tail ? { partialTail: { messages: [{ commit: '5002', seq: 2 }], uncertainMessages: [] } } : {}) } };
      const thread: any = { id: 'dm:x', messages: [message] };
      const env: Record<string, any> = {
        t: (key: string, values: any = {}) => String(I18N_STRINGS.en[key] ?? key).replace(/\{(\w+)\}/g, (_all: string, name: string) => String(values[name] ?? '')),
        clearPrivateSendRetry: () => {}, clearPrivatePublishConfirmRetry: () => {}, refreshThreadAfterMessageChange: () => {}, renderThreads: () => {}, renderConversation: () => {},
        updateMessageInEncryptedHistory: async () => true, console: { error() {} },
        privateMessageCanLocalCancel: (m: any) => !m.convDirectSend?.boc,
        shortUiErrorText: (e: any, fallback: string) => String(e?.message ?? fallback), RECIPIENT_NOT_ACTIVATED: 'RNA',
        isTonRpcVerificationSoftReadError: () => false, publishStatusDisplayText: (text: string) => text,
      };
      const { api } = liftWith(env, [fn('function markPrivateMessageManualRecovery(context, error = null, metaText = null) {'),
        fn('function privateSendPreflightStatusText(error) {'), fn('function privateSendBlockedStatusText(error) {'),
        fn('function messageMetaTextKey(raw) {'), fn('function messageMetaReasonKey(raw) {'), fn('function messageMetaReasonDisplayText(reason) {'),
        fn('function messageMetaDisplayText(text) {')], '{ mark: markPrivateMessageManualRecovery, blocked: privateSendBlockedStatusText, show: messageMetaDisplayText }');
      api.mark({ thread, message }, error, api.blocked(error));
      return { meta: message.meta, shown: api.show(message.meta), retry: message.privateManualRetryAvailable, cancel: message.privateCancelAvailable };
    };
    const short = said(Object.assign(new Error('Needed on the balance: 0.11 GRAM'), { code: 'PLATHO_WALLET_GRAM_REQUIRED' }));
    expect(short, 'MEASURED before: "not sent: the wallet cannot cover…" over parts on chain and paid for').toEqual({
      meta: 'partly sent: Needed on the balance: 0.11 GRAM', shown: 'partly sent: Needed on the balance: 0.11 GRAM — Retry sends the rest', retry: true, cancel: false,
    });
    expect(said(Object.assign(new Error('update'), { code: 'APP_UPDATE_PENDING' })).meta).toBe(`partly sent: ${I18N_STRINGS.en['wallet.updateReadyReload']}`);
    expect(said(Object.assign(new Error('The wallet changed before signing; nothing was sent.'), { code: 'PLATHO_WALLET_CHANGED' })).meta)
      .toBe('partly sent: The wallet changed before signing; nothing was sent.');
    expect(said(Object.assign(new Error('Needed on the balance: 0.11 GRAM'), { code: 'PLATHO_WALLET_GRAM_REQUIRED' }), { tail: false }).meta).toBe('not sent: Needed on the balance: 0.11 GRAM');
  });

  it('R19-SESSION-01: a room send answered after a lock or a switch refills no draft and adds no row to the next list; a private send arms no retry for a gone session', async () => {
    const roomSend = (answer: 'fails' | 'returns', after: (env: any) => void) => {
      const env: Record<string, any> = {
        walletSessionGeneration: 1, threads: [], plathoWallet: { address: 'A' }, console: { warn() {} },
        messageInput: { value: '' }, composerDraftThreadId: 'group:g', privateComposerCostStatus: { textContent: '', dataset: {} },
        restoreUnsentGroupText: (threadId: string, text: string) => env.drafts.push(`${threadId}: ${text}`), drafts: [] as string[],
        ensureGroupThread: (record: any) => { env.rows.push(record.name); return { id: 'group:g', messages: [] }; }, rows: [] as string[],
        forgetMessageFromHistory: async () => { env.forgotten += 1; }, forgotten: 0,
        scheduleGroupEchoConfirmChecks: () => { env.watched += 1; }, watched: 0,
        ensurePublicGroupRuntime: async () => null, groupIdOfThread: () => 'g', groupSelfIsBanned: () => false, groupSelfIsMuted: () => false,
        holdLiveSend: () => () => {}, localMessageOrderFields: () => ({}), insertThreadMessage: (thread: any, message: any) => thread.messages.push(message),
        persistMessageToEncryptedHistory: async () => true, updateMessageInEncryptedHistory: async () => true,
        refreshThreadAfterMessageChange: () => {}, focusComposerField: () => {}, renderThreads: () => {}, renderConversation: () => {},
        awaitWalletChainClock: async () => {}, noteTonRpcRateLimit: () => false, t: (key: string) => key, speakToScreenReader: () => {},
        ensureGroupRuntime: async () => ({
          get: () => ({ leftAt: null }),
          say: async (_id: string, _text: string, { onSealed }: any) => {
            await onSealed({ epoch: 20738, generation: 1, firstSeq: 4, lastSeq: 4, self: new Uint8Array([0xc0]) });
            after(env);
            if (answer === 'fails') throw new Error('the wallet changed before signing');
            return { record: { name: 'the kitchen (wallet A)', self: new Uint8Array([0xc0]) }, epoch: 20738, generation: 1, firstSeq: 4, lastSeq: 4 };
          },
        }),
      };
      env.sameWalletAddress = (a: any, b: any) => Boolean(a) && a === b;
      const { api } = liftWith(env, [fn('function sameWalletSessionAsPress(pressSession, pressWallet) {'), fn('async function sendGroupMessageFromComposer(thread, text) {')], 'sendGroupMessageFromComposer');
      return { env, run: () => api({ id: 'group:g', messages: [] }, 'see you at eight') };
    };
    const lock = (env: any) => { env.walletSessionGeneration += 1; env.drafts.length = 0; env.plathoWallet = null; };
    const lockedFail = roomSend('fails', lock);
    await lockedFail.run();
    expect([lockedFail.env.drafts, lockedFail.env.messageInput.value, lockedFail.env.forgotten],
      'MEASURED before: the words back in the drafts the lock had just cleared, and their record deleted').toEqual([[], '', 0]);
    const switched = (env: any) => { env.walletSessionGeneration += 1; env.drafts.length = 0; env.plathoWallet = { address: 'B' }; env.threads = ['a conversation of wallet B']; };
    const switchedBack = roomSend('returns', switched);
    await switchedBack.run();
    expect([switchedBack.env.rows, switchedBack.env.watched], 'MEASURED before: wallet A\'s room added to wallet B\'s list').toEqual([[], 0]);
    const own = roomSend('returns', () => {});
    await own.run();
    expect([own.env.rows, own.env.watched]).toEqual([['the kitchen (wallet A)'], 1]);
    const ownFail = roomSend('fails', () => {});
    await ownFail.run();
    expect([ownFail.env.messageInput.value, ownFail.env.forgotten]).toEqual(['see you at eight', 1]);

    const jobs = new Map();
    const message: any = { type: 'out', text: 'hi', meta: 'sending' };
    const gone: any = { id: 'dm:x', messages: [message] };
    const { api: schedule } = liftWith({
      threads: [], privateSendRetryJobs: jobs, isStalePrivatePendingPublish: () => false, privateMessageHasPublishAttempt: () => false,
      privatePartialSendRetryExpired: () => false, privateSendRetryMaxAttempts: () => 8, clearPrivateMessageManualRecovery: () => {},
      privateSendRetryDelayMs: () => 8_000, shortUiErrorText: () => 'x', refreshPrivateSendRetryUi: () => {}, privateSendRetryMeta: () => 'retrying send',
      privateSendRetryKey: () => 'k', holdLiveSend: () => () => {}, window: { setTimeout: () => 1, clearTimeout: () => {} },
    }, [fn('function schedulePrivateSendRetry(context, error) {')], 'schedulePrivateSendRetry');
    schedule({ thread: gone, message, retryAttempt: 0 }, new Error('network'));
    expect(jobs.size, 'MEASURED before: a retry armed after cancelPrivateSendTimers, firing 8 s later in the locked session').toBe(0);
    const { api: scheduleOwn } = liftWith({
      threads: [gone], privateSendRetryJobs: jobs, isStalePrivatePendingPublish: () => false, privateMessageHasPublishAttempt: () => false,
      privatePartialSendRetryExpired: () => false, privateSendRetryMaxAttempts: () => 8, clearPrivateMessageManualRecovery: () => {},
      privateSendRetryDelayMs: () => 8_000, shortUiErrorText: () => 'x', refreshPrivateSendRetryUi: () => {}, privateSendRetryMeta: () => 'retrying send',
      privateSendRetryKey: () => 'k', holdLiveSend: () => () => {}, window: { setTimeout: () => 1, clearTimeout: () => {} },
    }, [fn('function schedulePrivateSendRetry(context, error) {')], 'schedulePrivateSendRetry');
    scheduleOwn({ thread: gone, message, retryAttempt: 0 }, new Error('network'));
    expect(jobs.size).toBe(1);

    const publicHandler = code(app.slice(app.indexOf("publicComposer?.addEventListener('submit'"), app.indexOf(`${String.fromCharCode(10)}composer?.addEventListener('submit'`)));
    const guard = publicHandler.indexOf('if (!sameWalletSessionAsPress(pressSession, pressWallet)) {');
    expect(guard).toBeGreaterThan(publicHandler.indexOf('} catch (error) {'));
    expect(guard).toBeLessThan(publicHandler.indexOf('publicMessageInput.value = writtenSince'));
    expect(publicHandler.indexOf('const pressSession = walletSessionGeneration;')).toBeLessThan(publicHandler.indexOf('await enqueueOutgoingPublish('));
  });
});

describe('R19 — the quiet ones\' share in fair parts: the book that asks first each minute no longer takes it all [B1 / F1-2, F6-1]', () => {
  const run = async ({ rooms, roomCost, conversations, convCost, share, minutes = 30, order = 'rooms first' }:
    { rooms: number; roomCost: number; conversations: number; convCost: number; share: number; minutes?: number; order?: 'rooms first' | 'conversations first' }) => {
    const T = 50_000_000;
    const reads = new Map<string, number[]>();
    let minute = 0;
    const env: Record<string, any> = {
      convQuietAt: new Map(), convQuietProbedClean: new Map(), CONV_QUIET_MAX: 1_000_000, CONV_QUIET_PROBE_MS: 60_000, walletSessionGeneration: 1,
      introKeyIdString: (id: string) => id, publicAddrKey: (address: string) => address, noteTonRpcRateLimit: () => false, console: { warn() {} },
      readConvShardStates: async (plans: any[]) => { for (const plan of plans) reads.get(plan.peerKeyId)!.push(minute); return new Map(); },
    };
    const { api } = liftWith(env, [line('const quietSpent = '), line('const QUIET_BOOK_STALE_MS = '), fn('function quietDueEveryMs(cost, quietAddresses, quietMs) {'),
      fn('function takeQuietWithinShare('), 'function currentStatesBatchCeiling() { return 0; }' , fn('function groupPassIsQuiet(pass) {'), fn('function createRoomPassBook('), 'const GROUP_QUIET_PROBE_MS = 60_000;',
      'let convQuietProbeRun = null;', fn('function probeQuietConversations(')],
    `{ book: createRoomPassBook({ name: 'private rooms' }), probe: probeQuietConversations, spent: quietSpent }`);
    const roomIds = Array.from({ length: rooms }, (_, i) => `r${i}`);
    const plans = Array.from({ length: conversations }, (_, i) => ({ peerKeyId: `c${i}`, rootShards: [{ shards: Array.from({ length: convCost }, (_s, a) => ({ address: `c${i}-${a}` })) }] }));
    for (const id of [...roomIds, ...plans.map((plan) => plan.peerKeyId)]) reads.set(id, []);
    api.book.begin();
    for (const id of roomIds) { api.book.asked(Array.from({ length: roomCost }, (_, a) => `${id}-${a}`)); api.book.claim(id); }
    api.book.end(roomIds);
    api.book.note(roomIds, roomIds.map((groupId) => ({ groupId, messages: [] })), { at: T });
    for (const plan of plans) env.convQuietAt.set(plan.peerKeyId, T);
    const takes = new Map<number, number>();
    const roomsTick = (now: number) => {
      const due = api.book.due(roomIds, { now, quietAddresses: share });
      api.book.begin();
      for (const id of due) { reads.get(id)!.push(minute); api.book.asked(Array.from({ length: roomCost }, (_, a) => `${id}-${a}`)); api.book.claim(id); }
      api.book.end(roomIds);
      api.book.note(due, due.map((groupId: string) => ({ groupId, messages: [] })), { at: now });
    };
    const conversationsTick = async (now: number) => { await api.probe(plans, { epochNow: 20_738, now, quietAddresses: share }); };
    for (minute = 1; minute <= minutes; minute += 1) {
      for (let tick = 0; tick < 5; tick += 1) {
        const now = T + minute * 60_000 + tick * 12_000 + 1;
        if (order === 'rooms first') { roomsTick(now); await conversationsTick(now); } else { await conversationsTick(now); roomsTick(now); }
        takes.set(api.spent.since, Math.max(takes.get(api.spent.since) ?? 0, api.spent.addresses));
      }
    }
    const gap = (list: number[]) => {
      let worst = 0;
      let previous = 0;
      for (const at of [...list, minutes + 1]) { worst = Math.max(worst, at - previous); previous = at; }
      return worst;
    };
    return {
      roomGap: Math.max(...roomIds.map((id) => gap(reads.get(id)!))),
      convGap: Math.max(...plans.map((plan) => gap(reads.get(plan.peerKeyId)!))),
      neverConv: plans.filter((plan) => reads.get(plan.peerKeyId)!.length === 0).length,
      largestTake: Math.max(...takes.values()),
    };
  };

  it('R19-QUIET-01: 1,000 quiet conversations and 50 quiet rooms over one share — in the app\'s order or the other, each read in its turn, the share held', async () => {
    const shape = { rooms: 50, roomCost: 84, conversations: 1_000, convCost: 6, share: 2_048 };
    const turn = Math.ceil((50 * 84 + 1_000 * 6) / 2_048) + 2;
    for (const order of ['rooms first', 'conversations first'] as const) {
      const seen = await run({ ...shape, order });
      expect(seen.convGap, `${order}: MEASURED before — the conversations ${order === 'rooms first' ? 'read 5 a minute, most never in 30 minutes' : 'took it all'}`).toBeLessThanOrEqual(turn);
      expect(seen.roomGap, `${order}: the rooms in their turn too`).toBeLessThanOrEqual(turn);
      expect(seen.neverConv).toBe(0);
      expect(seen.largestTake, `${order}: a minute's quiet reads within the share`).toBeLessThanOrEqual(2_048);
    }
  });

  it('R19-QUIET-02: a book alone takes the whole share; a book that has stopped asking reserves nothing after two minutes; one item over the share is read on its own, one a minute', () => {
    const { api } = liftWith({}, [line('const quietSpent = '), line('const QUIET_BOOK_STALE_MS = '), fn('function takeQuietWithinShare('), 'function currentStatesBatchCeiling() { return 0; }' ], '{ take: takeQuietWithinShare, spent: quietSpent }');
    const items = (prefix: string, n: number, cost: number) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, cost }));
    const ids = (taken: any[]) => taken.length;
    const T = 9_000_000;
    expect(ids(api.take(items('c', 100, 10), { now: T, quietAddresses: 500, quietMs: 60_000, book: 'conversations' }))).toBe(50);
    expect(ids(api.take(items('r', 100, 10), { now: T + 5_000, quietAddresses: 500, quietMs: 60_000, book: 'rooms' }))).toBe(0);
    expect(ids(api.take(items('c', 100, 10), { now: T + 60_000, quietAddresses: 500, quietMs: 60_000, book: 'conversations' })), 'half: the rooms asked for as much').toBe(25);
    expect(ids(api.take(items('r', 100, 10), { now: T + 61_000, quietAddresses: 500, quietMs: 60_000, book: 'rooms' })), 'and the rooms the rest').toBe(25);
    expect(ids(api.take(items('c', 100, 10), { now: T + 120_000, quietAddresses: 500, quietMs: 60_000, book: 'conversations' }))).toBe(25);
    expect(ids(api.take(items('c', 100, 10), { now: T + 181_500, quietAddresses: 500, quietMs: 60_000, book: 'conversations' })), 'the rooms\' part released').toBe(50);
    const big = [{ id: 'big1', cost: 4_000 }, { id: 'big2', cost: 4_000 }];
    expect(api.take(big, { now: T + 300_000, quietAddresses: 500, quietMs: 60_000, book: 'rooms' }).map((item: any) => item.id)).toEqual(['big1']);
    expect(ids(api.take(items('c', 100, 10), { now: T + 301_000, quietAddresses: 500, quietMs: 60_000, book: 'conversations' })), 'the others\' share untouched by it').toBe(50);
  });
});

describe('R19 — the restore behind the screen draws by what a draw costs, never a list not on screen; the rooms go with the read window [B2 / F4-1, F6-2]', () => {
  const restoreWith = async ({ cost, shown = true, N = 120, ACTIVE = 20 }: { cost: number; shown?: boolean; N?: number; ACTIVE?: number }) => {
    const clock = { now: 1_900_000_000_000 };
    const timers: Array<{ at: number; run: () => void; seq: number }> = [];
    let seq = 0;
    const later = (run: () => void, ms = 0) => { timers.push({ at: clock.now + Math.max(0, Number(ms) || 0), run, seq: seq += 1 }); return seq; };
    const draws: number[] = [];
    const DAY = 86_400_000;
    const summaries = Array.from({ length: N }, (_, i) => ({ threadId: `dm:${i}`, count: 3, newestCreatedAt: i < ACTIVE ? clock.now - i * 60_000 : clock.now - (10 + i) * DAY }));
    const env: Record<string, any> = {
      Date: { now: () => clock.now }, setTimeout: later, requestAnimationFrame: (run: () => void) => later(run, 16),
      encryptedMessageStore: {
        listThreadSummaries: async () => summaries, deferCompaction: () => {},
        listMessagesDetailed: ({ threadId }: any) => new Promise((resolve) => { later(() => resolve({ messages: [{ id: `${threadId}-1`, threadId, createdAt: 1, message: { type: 'in', text: 'x' } }], failed: [], cursor: null }), 5); }),
      },
      walletSessionGeneration: 1, activeThreadId: null, CONV_RECV_WINDOW_W: 2, PRIVATE_HISTORY_QUIET_WINDOW: 24, PRIVATE_HISTORY_WINDOW: 96, historyWindowState: new Map(),
      applyRestoredHistoryItems: () => true, renderConversation: () => {}, refreshChatsRailBadge: () => {},
      renderThreads: () => { draws.push(clock.now); clock.now += cost; },
      threadListOnScreen: () => shown, threadListOwesDraw: false,
      seedConvSeqMarksFromHistory: () => 0, healCrossWalletIdentityBleed: () => false, settleInterruptedSends: async () => {},
      resumePendingPublicPublishConfirmations: () => {}, resumePendingPrivateSendRetries: async () => {}, rearmConvDeliveryConfirms: () => {},
      setText: () => {}, localStateLabel: null, t: (key: string) => key, historyStatusLabel: () => '', currentMessageHistoryDbName: () => 'db',
      plathoWallet: null, console: { warn() {}, error() {}, log() {} }, historyApplyFailures: [], historyDuplicateRecordIds: new Set(),
    };
    const { api } = liftWith(env, [line('const PRIVATE_HISTORY_FIRST_SCREEN = '), line('let historyRestoreBehind = '), line('let historyRestoreReadWindow = '),
      line('const RESTORE_BEHIND_PAINT_MS = '), fn('async function restoreHistoryWindows('), fn('async function restoreEncryptedMessageHistory() {')],
    '{ restore: restoreEncryptedMessageHistory, behind: () => historyRestoreBehind }');
    let firstScreenEnd = Infinity;
    let done = false;
    void api.restore().then(() => {
      firstScreenEnd = clock.now;
      return api.behind();
    }).then(() => { done = true; });
    for (let step = 0; step < 100_000 && (!done || timers.length > 0); step += 1) {
      for (let i = 0; i < 5; i += 1) await Promise.resolve();
      if (timers.length === 0) { await new Promise((resolve) => setTimeout(resolve, 0)); continue; }
      timers.sort((one, other) => one.at - other.at || one.seq - other.seq);
      const next = timers.shift()!;
      clock.now = Math.max(clock.now, next.at);
      next.run();
    }
    return { draws, owes: env.threadListOwesDraw, cost, firstScreenEnd };
  };

  it('R19-PAINT-01: a draw that costs 1.5 s is followed by at least 3 s of nothing but the restore; a list not on screen is not drawn, and is owed one draw', async () => {
    const gapsBehind = (run: any) => run.draws.slice(1).map((at: number, i: number) => ({ from: run.draws[i], gap: at - (run.draws[i] + run.cost) }))
      .filter((pair: any) => pair.from > run.firstScreenEnd).map((pair: any) => pair.gap);
    const slow = await restoreWith({ cost: 1_500 });
    const slowGaps = gapsBehind(slow);
    expect(slowGaps.length, 'drawn behind the screen').toBeGreaterThan(0);
    expect(Math.min(...slowGaps), 'MEASURED before: the next draw at once — drawn back to back, one conversation landing between two (19.1 min at 10,000)').toBeGreaterThanOrEqual(3_000);
    expect(slow.draws.filter((at) => at > slow.firstScreenEnd).length, 'a handful of draws behind the screen, not one a conversation').toBeLessThan(20);
    const fast = await restoreWith({ cost: 10 });
    expect(Math.min(...gapsBehind(fast))).toBeGreaterThanOrEqual(1_000);
    const hidden = await restoreWith({ cost: 1_500, shown: false });
    expect([hidden.draws.length, hidden.owes], 'MEASURED before: drawn all the same, 1.3–1.4 s a draw with the list hidden').toEqual([0, true]);
    expect(code(fn('function setView(view, { restoreRoom = true } = {}) {'))).toContain("if (activeThreadId !== activeBefore || (view === 'chats' && threadListOwesDraw)) renderThreads();");
    expect(code(fn('function renderThreadsNow() {')).indexOf('threadListOwesDraw = false;'), 'whatever draws it pays the debt').toBeGreaterThan(-1);
    const rooms = code(fn('async function syncGroupsFromChainUnguarded() {'));
    expect(rooms, 'MEASURED before: no room read for the whole restore — 19 minutes at 10,000').toContain('if (historyRestoreReadWindow) await historyRestoreReadWindow;');
    expect(rooms).not.toContain('await historyRestoreBehind');
  });
});

describe('R19 — a re-secure cut short in its write-back keeps the oldest of every conversation, says so, and owes the rooms their read [B3 / F7-4]', () => {
  it('R19-WRITEBACK-01: killed half-way, every conversation keeps its oldest half; the next unlock says it once; the rooms read from their floor', async () => {
    const fake: any = await import('fake-indexeddb');
    const resecure: any = await import('../web/storage-resecure.mjs');
    const factory = new fake.IDBFactory();
    const rankOf = new Map<string, { conversation: number; rank: number }>();
    const records: any[] = [];
    for (let conversation = 0; conversation < 20; conversation += 1) {
      const base = Math.floor(Math.random() * 2 ** 24);
      for (let rank = 0; rank < 100; rank += 1) {
        const id = globalThis.crypto.randomUUID();
        rankOf.set(id, { conversation, rank });
        records.push({ id, v: 1, t: `tag-${conversation}`, o: base + rank, c: 'x', sealed: 'ciphertext' });
      }
    }
    records.sort((one, other) => one.id.localeCompare(other.id));
    const snapshot = {
      local: [], session: [],
      databases: [{ name: `${resecure.RESECURE_HISTORY_DB_PREFIX}.dep.wal`, version: 1, stores: [{
        name: 'messages', keyPath: 'id', autoIncrement: false, cache: false,
        indexes: [{ name: 'convOrder', keyPath: ['t', 'o'], unique: false, multiEntry: false }],
        keys: records.map((record) => record.id), values: records, kept: [], chunks: [],
      }] }],
    };
    const transaction = fake.IDBDatabase.prototype.transaction;
    let opened = 0;
    fake.IDBDatabase.prototype.transaction = function counted(this: any, ...args: any[]) {
      if (args[1] === 'readwrite' && (opened += 1) > 10) throw new Error('the page ended');
      return transaction.apply(this, args);
    };
    try {
      await resecure.restoreOriginStorage(snapshot, { indexedDB: factory, localStorage: { getItem: () => null, setItem: () => {} }, localDone: true, chunk: 100 });
    } finally {
      fake.IDBDatabase.prototype.transaction = transaction;
    }
    const kept: any[] = await new Promise((resolve, reject) => {
      const request = factory.open(`${resecure.RESECURE_HISTORY_DB_PREFIX}.dep.wal`);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const all = db.transaction('messages', 'readonly').objectStore('messages').getAll();
        all.onsuccess = () => { db.close(); resolve(all.result); };
        all.onerror = () => reject(all.error);
      };
    });
    expect(kept.length).toBe(1_000);
    const perConversation = Array.from({ length: 20 }, () => [] as number[]);
    for (const record of kept) { const at = rankOf.get(record.id)!; perConversation[at.conversation].push(at.rank); }
    const oldestKept = perConversation.reduce((sum, ranks) => sum + ranks.filter((rank) => rank < 20).length, 0);
    expect(oldestKept, 'MEASURED before: 191 of the 400 oldest — lost as often as yesterday\'s, which the chain can give back').toBe(400);
    expect(perConversation.every((ranks) => Math.max(...ranks) === 49 && ranks.length === 50), 'every conversation its oldest half').toBe(true);

    const notices: string[] = [];
    const store = new Map<string, string>([[resecure.RESECURE_SHORT_WRITE_BACK_KEY, '1']]);
    const { api: say } = liftWith({
      RESECURE_SHORT_WRITE_BACK_KEY: resecure.RESECURE_SHORT_WRITE_BACK_KEY, t: (key: string) => key, showAppNotice: (text: string) => notices.push(text),
      globalThis: { localStorage: { getItem: (key: string) => store.get(key) ?? null, removeItem: (key: string) => { store.delete(key); } } },
    }, [fn('function sayShortWriteBackOnce() {')], 'sayShortWriteBackOnce');
    expect([say(), say(), notices], 'MEASURED before: nothing said when the wallet came back').toEqual([true, false, ['storage.writeBackShort']]);
    const runs = code(fn('async function runStorageResecureIfSafe() {'));
    expect(runs.indexOf('globalThis.localStorage.setItem(RESECURE_SHORT_WRITE_BACK_KEY, String(Date.now()));')).toBeGreaterThan(runs.indexOf('if (globalThis.localStorage.getItem(RESECURE_CLEARED_KEY) !== null) {'));
    const runtime = code(fn('async function buildGroupRuntime() {'));
    expect(runtime, 'MEASURED before: only the private conversations were read again').toContain('if (!resecureRecoveryOwed()) await loadLaneMarks(wallet, GROUP_LANE_MARKS_RECORD, lane);');
  });
  it('R19-QUOTA-01: a full disk is retried once, by the first part — the rest are not made to wait for it [B5 / F6-5]', async () => {
    const fake: any = await import('fake-indexeddb');
    const resecure: any = await import('../web/storage-resecure.mjs');
    const factory = new fake.IDBFactory();
    const values = Array.from({ length: 300 }, (_, i) => ({ id: `r${String(i).padStart(4, '0')}`, payload: 'x' }));
    const snapshot = {
      local: [], session: [],
      databases: [{ name: 'platho-local-cache-v1.dep.wal', version: 1, stores: ['records', 'faces', 'rooms'].map((name) => ({
        name, keyPath: 'id', autoIncrement: false, cache: false, indexes: [],
        keys: values.map((value) => value.id), values, kept: [], chunks: [],
      })) }],
    };
    const transaction = fake.IDBDatabase.prototype.transaction;
    let asked = 0;
    fake.IDBDatabase.prototype.transaction = function full(this: any, ...args: any[]) {
      if (args[1] === 'readwrite') { asked += 1; throw Object.assign(new Error('the disk is full'), { name: 'QuotaExceededError' }); }
      return transaction.apply(this, args);
    };
    const started = Date.now();
    let result: any;
    try {
      result = await resecure.restoreOriginStorage(snapshot, { indexedDB: factory, localStorage: { getItem: () => null, setItem: () => {} }, localDone: true, chunk: 100 });
    } finally {
      fake.IDBDatabase.prototype.transaction = transaction;
    }
    expect(asked, 'MEASURED before: each part retried three times — 4.3 s a part, ~5 minutes more of "Securing" at 300 MB').toBe(2 + 1 + 1);
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(result.failed).toContain('platho-local-cache-v1.dep.wal/records');
  });
});

describe('R19 — the restore copies what the conversations behind the screen hold once, however many lie past the read window [B6 / F6-6, F5-I3]', () => {
  it('R19-COPY-01: one copy a restore — said at the read window when it is passed, at the end when it never is', async () => {
    const now = Date.now();
    const page = (threadId: string) => ({
      messages: Array.from({ length: 5 }, (_, i) => ({ id: `${threadId}-${i}`, threadId, createdAt: i, message: { type: 'in', text: 'x' }, mine: true })),
      failed: [], cursor: null,
    });
    const run = async (recent: number, total: number) => {
      const summaries = Array.from({ length: total }, (_, i) => ({ threadId: `t${i}`, count: 5, newestCreatedAt: i < recent ? now - i * 1_000 : now - 400 * 86_400_000 - i }));
      const { api } = liftWith({
        encryptedMessageStore: { listMessagesDetailed: async ({ threadId }: any) => page(threadId) }, activeThreadId: null,
        CONV_RECV_WINDOW_W: 2, PRIVATE_HISTORY_QUIET_WINDOW: 24, PRIVATE_HISTORY_WINDOW: 96, historyWindowState: new Map(), console: { warn() {} },
      }, [fn('async function restoreHistoryWindows(')], 'restoreHistoryWindows');
      const slice = Array.prototype.slice;
      let copies = 0;
      let copied = 0;
      Array.prototype.slice = function counted(this: any, ...args: any[]) {
        if (args.length === 0 && this?.[0]?.mine === true) { copies += 1; copied += this.length; }
        return slice.apply(this, args);
      };
      try {
        const restored = await api(summaries, null, { firstScreen: 1 });
        const window = await Promise.race([restored.readWindow, settle(500).then(() => 'never said')]);
        const behind = await restored.rest;
        return { copies, copied, window: Array.isArray(window) ? window.length : window, behind: behind.messages.length };
      } finally {
        Array.prototype.slice = slice;
      }
    };
    expect(await run(3, 300), 'MEASURED before: 298 copies, 224,245 records copied — at 10,000 conversations 9,601 copies, 385.6 M').toEqual({ copies: 1, copied: 10, window: 10, behind: 1_495 });
    expect(await run(300, 300)).toEqual({ copies: 1, copied: 1_495, window: 1_495, behind: 1_495 });
  });
});

describe('R19 — a dialog gives the focus back to what opened it wherever the page shows it [C1 / F4-2]', () => {
  it('R19-FOCUS-01: an opener in a section the markup ships hidden and its rule shows takes the focus back; one not on screen does not; a press in the popover hands the focus to its anchor first', () => {
    const page: any = { activeElement: null, body: { tag: 'BODY' } };
    class Element {
      focused = 0;
      isConnected = true;
      isContentEditable = false;
      constructor(public name: string, public under: { hidden?: boolean; inert?: boolean } = {}, public screen: any = {}) { Object.assign(this, screen); }
      matches() { return false; }
      closest(selector: string) {
        if (selector.includes('[inert]') && this.under.inert) return { name: 'inert' };
        if (selector.includes('[hidden]') && this.under.hidden) return { name: 'a section shipped hidden' };
        return null;
      }
      focus() { this.focused += 1; page.activeElement = this; }
    }
    const api = lift({ document: page, HTMLElement: Element },
      [fn('function restoreDialogFocus(target) {'), fn('function elementRendered(target) {'), fn('function dialogReturnFocusTarget() {')],
      '{ restore: restoreDialogFocus, capture: dialogReturnFocusTarget }');
    const shown = () => true;
    const notShown = () => false;
    const addChannel = new Element('publicAllAddChannelButton', { hidden: true }, { checkVisibility: shown });
    api.restore(addChannel);
    expect(addChannel.focused, 'MEASURED before: BODY after the ✕ — at 390 px All and Groups, at 1280 px All').toBe(1);
    const offScreen = new Element('publicNewGroupButton', { hidden: true }, { checkVisibility: notShown });
    api.restore(offScreen);
    expect(offScreen.focused).toBe(0);
    const laidOut = new Element('a', { hidden: true }, { getClientRects: () => [{}] });
    const noBoxes = new Element('b', {}, { getClientRects: () => [] });
    const bare = new Element('c', { hidden: true });
    const plain = new Element('d');
    [laidOut, noBoxes, bare, plain].forEach((target) => api.restore(target));
    expect([laidOut.focused, noBoxes.focused, bare.focused, plain.focused]).toEqual([1, 0, 0, 1]);
    const held = new Element('e', { inert: true }, { checkVisibility: shown });
    api.restore(held);
    expect(held.focused).toBe(0);

    const anchor = new Element('the channel\'s name in the feed', {}, { checkVisibility: shown, setAttribute() {} });
    const pressed = new Element('a popover button', {}, { checkVisibility: notShown });
    const popover = { contains: (node: any) => node === pressed, hidden: false };
    const close = lift({ document: page, identityPopover: popover, identityMenuButton: null, hidePopoverAnimated: (node: any) => { node.hidden = true; } },
      [fn('function hideIdentityPopover() {')], '{ open: (node) => { identityPopoverAnchor = node; }, close: hideIdentityPopover }', 'let identityPopoverAnchor = null;');
    close.open(anchor);
    page.activeElement = pressed;
    close.close();
    const way = api.capture();
    api.restore(way);
    expect([way?.name, page.activeElement?.name], 'MEASURED before: the hidden button kept as the way back — BODY after the ✕, six locales').toEqual(['the channel\'s name in the feed', 'the channel\'s name in the feed']);
    const elsewhere = new Element('the composer');
    page.activeElement = elsewhere;
    close.open(anchor);
    const before = anchor.focused;
    close.close();
    expect([page.activeElement, anchor.focused]).toEqual([elsewhere, before]);
  });
});

describe('R19 — the line painted again after a held failure keeps the keyboard focus [C2 / F4-3]', () => {
  it('R19-LINEFOCUS-01: a failed Activate\'s focused button, the hold over, the line built again: the focus on its new button — never the page', () => {
    const doc: any = { body: { id: 'BODY' } };
    doc.activeElement = doc.body;
    const node = (id: string): any => {
      const self: any = {
        id, children: [] as any[], attributes: new Map<string, string>(), dataset: {} as Record<string, string>, className: '', type: '',
        get textContent() { return self.children.map((child: any) => (typeof child === 'string' ? child : child.textContent ?? '')).join(''); },
        set textContent(value: string) {
          for (const child of self.children) if (child === doc.activeElement || child?.contains?.(doc.activeElement)) doc.activeElement = doc.body;
          self.children = [String(value)];
        },
        append: (...items: any[]) => { self.children.push(...items); },
        contains: (other: any) => other === self || self.children.some((child: any) => child === other || child?.contains?.(other)),
        querySelector: (selector: string) => (selector === '.composer-cost-action'
          ? self.children.find((child: any) => typeof child !== 'string' && child.className === 'composer-cost-action') ?? null : null),
        focus: () => { doc.activeElement = self; },
        addEventListener: () => {},
        hasAttribute: (name: string) => self.attributes.has(name), setAttribute: (name: string, value: string) => { self.attributes.set(name, value); },
      };
      return self;
    };
    let made = 0;
    const timers: Array<() => void> = [];
    const api = lift({
      globalThis: { document: doc }, document: { createElement: () => node(`button-${made += 1}`) }, Date,
      setTimeout: (callback: () => void) => { timers.push(callback); return timers.length; }, t: (key: string) => key, writeGenerationNow: () => 1,
    }, [line('const STATUS_HOLD_MS = '), line('const heldStatusText = '), line('const composerPricesMovedNotice = '),
      fn("function holdStatusText(node, text, { state = 'short', scope = null, ms = STATUS_HOLD_MS, refresh = null } = {}) {"),
      fn('function appendLineButton(line, button) {'), fn('function paintComposerCostLine(node, status) {')],
    '{ hold: holdStatusText, append: appendLineButton, paint: paintComposerCostLine }');
    const blocked = { text: 'Activate Platho account before sending', state: 'short', action: { label: 'Activate Platho account', run: () => {} } };
    const costLine = node('line');
    api.paint(costLine, blocked);
    costLine.querySelector('.composer-cost-action').focus();
    api.hold(costLine, 'The activation did not go through — try again.', { refresh: () => api.paint(costLine, blocked) });
    const again = node('again');
    again.className = 'composer-cost-action';
    again.textContent = 'Activate Platho account';
    api.append(costLine, again);
    expect(doc.activeElement.id).toBe('again');
    timers.splice(0).forEach((callback) => callback());
    const standing = costLine.querySelector('.composer-cost-action');
    expect([costLine.textContent, doc.activeElement === standing], 'MEASURED before: BODY at +12,025 ms — the line built again under its focused button').toEqual(['Activate Platho account before sending Activate Platho account', true]);
    api.paint(costLine, { text: 'Price: 0.0110 ATH', state: 'ok' });
    expect([doc.activeElement.id, costLine.attributes.get('tabindex')]).toEqual(['line', '-1']);
    const publicLine = node('public line');
    api.paint(publicLine, blocked);
    publicLine.querySelector('.composer-cost-action').focus();
    api.paint(publicLine, { text: 'Price: 0.0110 ATH', state: 'ok' });
    expect([doc.activeElement.id, publicLine.attributes.get('tabindex')]).toEqual(['public line', '-1']);
    const composer = node('composer');
    composer.focus();
    api.paint(costLine, blocked);
    expect(doc.activeElement.id).toBe('composer');
  });
});

describe('R19 — Send GRAM by keyboard: the focus stays on it through the wait, the wait is said once, its row wraps [C3 / F4-4, F4-5]', () => {
  const arrowAfter = (start: string) => {
    const at = app.indexOf(start);
    if (at < 0) throw new Error(`not found: ${start}`);
    const open = app.indexOf('{', at + start.length - 1);
    let depth = 0;
    for (let k = open; k < app.length; k += 1) {
      if (app[k] === '{') depth += 1;
      else if (app[k] === '}') { depth -= 1; if (depth === 0) return `async () => ${app.slice(open, k + 1)}`; }
    }
    throw new Error(`unbalanced after ${start}`);
  };
  it('R19-GRAMROW-01: Enter, the dialog, its submit — the focus back on Send GRAM and kept there while it is busy; one press; the wait spoken once', async () => {
    const page: any = { body: { id: 'BODY' } };
    page.activeElement = page.body;
    const attributes = new Map<string, string>();
    const button: any = {
      id: 'sendWalletTonButton', disabled: false, isConnected: true, isContentEditable: false, attributes,
      matches: () => false, closest: () => null, checkVisibility: () => true,
      setAttribute: (name: string, value: string) => { attributes.set(name, value); }, removeAttribute: (name: string) => { attributes.delete(name); },
      focus: () => { if (!button.disabled) page.activeElement = button; },
    };
    const row: any = { textContent: 'wallet', dataset: {} };
    let finish: () => void = () => {};
    let submitted = 0;
    const api = lift({
      sendWalletTonButton: button, sendWalletTonStatus: row, setText: (node: any, text: string) => { node.textContent = text; },
      t: (key: string) => key, plathoWallet: { address: 'W' }, console: { error() {} }, gramShortfallText: () => null, walletTransferNotRun: () => false,
      flashWalletIdentityStatus: () => {}, setTimeout: () => 0, sameWalletAddress: (a: any, b: any) => Boolean(a) && a === b, document: page,
      submitWalletTonTransfer: () => new Promise((resolve) => {
        submitted += 1;
        if (button.disabled && page.activeElement === button) page.activeElement = page.body;
        api.restore(button);
        row.textContent = 'wallet.gramTransferSending';
        finish = () => resolve(null);
      }),
    }, [line('const STATUS_HOLD_MS = '), line('const heldStatusText = '), line('const walletTonTransfersBusy = '),
      fn("function holdStatusText(node, text, { state = 'short', scope = null, ms = STATUS_HOLD_MS, refresh = null } = {}) {"), fn('function statusHeld(node, scope = null) {'),
      fn('function restoreDialogFocus(target) {'), fn('function elementRendered(target) {'),
      `function refreshMessagingControls() {\n${line('  const gramTransferBusy = ')}\n${line('  if (sendWalletTonButton) sendWalletTonButton.disabled = ')}\n${line('  if (sendWalletTonButton) { if (gramTransferBusy) ')}\n${line('  if (!gramTransferBusy && !statusHeld(sendWalletTonStatus)) setText(')}\n}`,
      `const onSendGram = ${arrowAfter("sendWalletTonButton?.addEventListener('click', async () => {")};`],
    '{ press: onSendGram, repaint: refreshMessagingControls, restore: restoreDialogFocus }');
    button.focus();
    const pressed = api.press();
    await settle(1);
    expect(page.activeElement?.id, 'MEASURED before: BODY from the submit (+2.5 s) to the outcome — the disabled button could not take it back').toBe('sendWalletTonButton');
    api.repaint();
    expect([page.activeElement?.id, button.disabled, attributes.get('aria-disabled'), row.textContent]).toEqual(['sendWalletTonButton', false, 'true', 'wallet.gramTransferSending']);
    await api.press();
    expect(submitted, 'one press until it is said').toBe(1);
    finish();
    await pressed;
    expect([button.disabled, attributes.has('aria-disabled'), page.activeElement?.id]).toEqual([false, false, 'sendWalletTonButton']);

    const spoken = async (during: (env: any) => void) => {
      const said: string[] = [];
      const env: Record<string, any> = {
        requestWalletTonTransferDetails: async () => ({ recipient: 'R', amount: 1_000_000_000n }), requirePlathoWallet: () => env.plathoWallet,
        plathoWallet: { address: 'W' }, sameWalletAddress: (a: any, b: any) => Boolean(a) && a === b, setVaultStatus: () => {},
        transferRecipientAccountStatus: async () => { during(env); return 'active'; }, transferBounceForStatus: () => true, createWalletTransaction: (m: any) => ({ messages: [m] }),
        assertWalletGramAtLeast: async () => {}, walletSendFeeReserveNanotons: () => 1n, requireSameWallet: (signer: any) => signer,
        sendPlathoWalletTransaction: async () => ({ outcome: 'consumed' }), broadcastMayHaveLanded: () => false, globalThis: {},
        flashWalletIdentityStatus: (text: string) => said.push(text), t: (key: string) => key, setText: () => {}, sendWalletTonStatus: {}, queueVaultPostTransactionRefresh: () => {},
        watchWalletTonTransfer: () => {}, speakToScreenReader: (text: string) => said.push(`spoken twice: ${text}`),
      };
      const { api: submit } = liftWith(env, [fn('async function submitWalletTonTransfer(hold = null) {')], 'submitWalletTonTransfer');
      await submit().catch(() => {});
      return said.filter((text) => text !== 'wallet.gramTransferSent');
    };
    expect(await spoken(() => {}), 'MEASURED before: nothing said — the first words heard were the outcome\'s, 19.5 s later').toEqual(['wallet.gramTransferSending']);
    expect(await spoken((env) => { env.plathoWallet = null; })).toEqual([]);
    expect(await spoken((env) => { env.plathoWallet = { address: 'B' }; })).toEqual([]);

    const html = readFileSync('web/index.html', 'utf8');
    const css = readFileSync('web/styles.css', 'utf8');
    expect(html, 'MEASURED before: 42 of 65 characters on screen at 390 px, 32 at 320 — no wrap, no ellipsis').toContain('<strong class="profile-action-status" id="sendWalletTonStatus"');
    expect(css).toMatch(/\.settings-list strong\.profile-action-status \{\s*max-width: min\(62%, 420px\);\s*white-space: normal;/);
    expect(css).toMatch(/\.settings-list button\[aria-disabled="true"\] \{\s*cursor: progress;\s*\}/);
  });
});

describe('R19 — the list\'s failed red reads at AA on every plate a row can wear [C4 / F4-6]', () => {
  it('R19-CONTRAST-01: plain, hovered, selected and unread rows — over the page and over a panel — in every palette, at least 4.5:1', () => {
    const css = readFileSync('web/styles.css', 'utf8');
    const block = (start: string) => { const at = css.indexOf(start); expect(at, start).toBeGreaterThan(-1); return css.slice(at, css.indexOf('}', at)); };
    const root = block(':root {');
    const value = (palette: string, name: string) => {
      for (const source of [palette, root]) {
        const match = new RegExp(`${name.replace(/[-]/g, '\\-')}:\\s*([^;]+);`).exec(source);
        if (match) return match[1].trim();
      }
      throw new Error(`${name} not found`);
    };
    const hex = (text: string) => [1, 3, 5].map((i) => parseInt(text.slice(i, i + 2), 16));
    const lum = (rgb: number[]) => {
      const [r, g, b] = rgb.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const over = (rgb: number[], alpha: number, base: number[]) => rgb.map((v, i) => alpha * v + (1 - alpha) * base[i]);
    const rgba = (text: string) => { const parts = /rgba\(([^)]+)\)/.exec(text)![1].split(',').map((part) => part.trim()); return { rgb: parts.slice(0, 3).map(Number), alpha: Number(parts[3]) }; };
    const worst: Record<string, string> = {};
    for (const start of [':root {', ':root:not([data-theme="dark"]) {', ':root[data-theme="light"] {']) {
      const palette = block(start);
      const ink = hex((/--danger-ink:\s*(#[0-9a-f]{6})/i.exec(palette)?.[1]) ?? value(palette, '--danger'));
      const accent = value(palette, '--accent-rgb').split(',').map((part) => Number(part.trim()));
      const alphaOf = (name: string) => Number(/,\s*([0-9.]+)\)\s*$/.exec(value(palette, name))![1]);
      const surface = rgba(value(palette, '--surface'));
      let low = Infinity;
      let lowAt = '';
      for (const ground of ['--bg', '--panel']) {
        const base = hex(value(palette, ground));
        const plates: Record<string, number[]> = {
          plain: base, hovered: over(surface.rgb, surface.alpha, base), selected: over(accent, alphaOf('--a16'), base), unread: over(accent, alphaOf('--a06'), base),
        };
        for (const [name, plate] of Object.entries(plates)) {
          const r = ratio(ink, plate);
          if (r < low) { low = r; lowAt = `${name} over ${ground}`; }
        }
      }
      worst[start] = `${low.toFixed(2)} (${lowAt})`;
      expect(low, `MEASURED before: 4.36:1 on the selected row in light (pixels) — ${start} now ${worst[start]}`).toBeGreaterThanOrEqual(4.5);
    }
    const tone = css.slice(css.indexOf('.thread-state[data-tone="failed"] {'));
    expect(tone.slice(0, tone.indexOf('}'))).toContain('color: var(--danger-ink, var(--danger));');
  });
});

describe('R19 — the words a message and a line say match what can be done, said once [F4-8, F4-9, F1-7, F3-I1]', () => {
  it('R19-WORDS-01: a send the app closed on says "send it again" when no Retry is drawn — a first contact and a room too; the French stake word is one', async () => {
    const written: string[] = [];
    const { api } = liftWith({
      groupIdOfThread: (thread: any) => (thread.room ? 'room' : null), privateMessageCanLocalCancel: () => true,
      updateMessageInEncryptedHistory: async (_thread: any, message: any) => { written.push(message.meta); },
      directPaySendRetryResumable: () => false, privateRetryRebuildable: (message: any) => message.rebuilds === true,
    }, [line('const SEND_INTERRUPTED_META = '), line('const INTRO_INTERRUPTED_META = '), line('const SEND_INTERRUPTED_AGAIN_META = '),
      fn('function settleInterruptedSend(thread, message) {'), fn('function messageMetaTextKey(raw) {')], '{ settle: settleInterruptedSend, key: messageMetaTextKey }');
    const settled = (message: any, thread: any = { id: 'dm:peer' }) => { api.settle(thread, message); return [api.key(message.meta), message.privateManualRetryAvailable === true]; };
    expect(settled({ text: 'a picture', rebuilds: true })).toEqual(['messageMeta.sendInterrupted', true]);
    expect(settled({ text: 'a picture that does not rebuild', rebuilds: false }), 'MEASURED before: "not sent — the app closed before it went [Cancel]", nothing saying to send it again').toEqual(['messageMeta.sendInterruptedSendAgain', false]);
    expect(settled({ text: 'hello', introDirectSend: {}, rebuilds: true })).toEqual(['messageMeta.introInterrupted', true]);
    expect(settled({ text: 'hello', introDirectSend: {}, rebuilds: false }), 'REASONED before: "Retry finishes it" with no Retry drawn').toEqual(['messageMeta.sendInterruptedSendAgain', false]);
    expect(settled({ text: 'in the room' }, { id: 'room:1', room: true })).toEqual(['messageMeta.sendInterruptedSendAgain', false]);
    expect(written.length).toBe(5);
    const { I18N_STRINGS }: any = await import('../web/i18n-strings.mjs');
    for (const [locale, strings] of Object.entries<any>(I18N_STRINGS)) expect(strings['messageMeta.sendInterruptedSendAgain'], locale).toBeTruthy();
    const depot = `d${String.fromCharCode(0xe9)}p${String.fromCharCode(0xf4)}t`;
    expect(I18N_STRINGS.fr['profile.vaultFloatHint'], 'the one "mise" beside eleven of the other word for the stake').toContain(`retraits de ${depot}`);
    expect(I18N_STRINGS.fr['profile.vaultFloatHint']).not.toContain('retraits de mise');
  });

  it('R19-HEARDONCE-01: the unfreeze\'s line that takes the focus is heard by it — the announcer says what the focus does not', () => {
    const doc: any = { body: { id: 'BODY' } };
    doc.activeElement = doc.body;
    const node = (id: string): any => {
      const self: any = {
        id, children: [] as any[], attributes: new Map<string, string>(), dataset: {},
        get textContent() { return self.children.map((child: any) => (typeof child === 'string' ? child : child.textContent ?? '')).join(''); },
        set textContent(value: string) {
          for (const child of self.children) if (child === doc.activeElement || child?.contains?.(doc.activeElement)) doc.activeElement = doc.body;
          self.children = [String(value)];
        },
        append: (...items: any[]) => { self.children.push(...items); },
        contains: (other: any) => other === self || self.children.some((child: any) => child === other || child?.contains?.(other)),
        focus: () => { doc.activeElement = self; },
        hasAttribute: (name: string) => self.attributes.has(name), setAttribute: (name: string, value: string) => { self.attributes.set(name, value); },
      };
      return self;
    };
    const spoken: string[] = [];
    const costLine = node('line');
    const api = lift({
      globalThis: { document: doc }, Date, setTimeout: () => 0, setText: () => {}, vaultRestoreStatus: {}, privateComposerCostStatus: costLine,
      publicComposerCostStatus: null, activeThreadId: 'dm:peer', publicComposerHoldScope: () => null, refreshComposerCostStatus: () => {},
      speakToScreenReader: (text: string) => spoken.push(text),
    }, [line('const STATUS_HOLD_MS = '), line('const heldStatusText = '),
      fn("function holdStatusText(node, text, { state = 'short', scope = null, ms = STATUS_HOLD_MS, refresh = null } = {}) {"),
      fn('function vaultRestoreSay(text, line = null, lineText = text) {')], '{ say: vaultRestoreSay }');
    const unfreeze = node('unfreeze');
    costLine.append('Your fee vault is frozen ', unfreeze);
    unfreeze.focus();
    api.say('checking', costLine, 'Checking the fee vault…');
    expect([doc.activeElement.id, spoken], 'MEASURED before: the focus on the line at +176 ms and the announcer at +226 ms, the same words').toEqual(['line', []]);
    api.say('sending', costLine, 'Sending the unfreeze…');
    expect(spoken).toEqual(['Sending the unfreeze…']);
    const composer = node('composer');
    composer.focus();
    api.say('sent', costLine, 'Unfreeze sent');
    expect([doc.activeElement.id, spoken.at(-1)]).toEqual(['composer', 'Unfreeze sent']);
  });

  it('R19-RETIRED-01: past the retention, "sent, not verified" is written once and kept — the next unlocks neither write nor draw for it', () => {
    const writes: string[] = [];
    const frames: Array<() => void> = [];
    const drawn: string[] = [];
    const { api } = liftWith({
      CONV_CONFIRM_RETIRED_AFTER_MS: 300 * 86_400_000, cancelConvDeliveryConfirm: () => {}, refreshThreadAfterMessageChange: () => {},
      updateMessageInEncryptedHistory: async (_thread: any, message: any) => { writes.push(message.localHistoryId); }, refreshMessagingControls: () => {},
      armConvDeliveryConfirm: () => { throw new Error('a record past the retention is not looked at'); }, console: { error() {} },
      requestAnimationFrame: (callback: () => void) => { frames.push(callback); }, threadListOnScreen: () => true,
      renderThreads: () => drawn.push('list'), renderConversation: () => drawn.push('conversation'), activeThreadId: 'dm:peer', isPublicRoomThread: () => false,
    }, [fn('function markConvDeliveryUnverified(thread, message) {'), fn('function rearmConvDeliveryConfirm(thread, message) {'), fn('function drawThreadSoon(thread) {')],
    '{ rearm: rearmConvDeliveryConfirm }');
    const year = Date.now() - 301 * 86_400_000;
    const thread: any = { id: 'dm:peer', messages: [] };
    for (let i = 0; i < 30; i += 1) thread.messages.push({ type: 'out', meta: 'sending', localHistoryId: `h${i}`, convDirectSend: { address: 'EQshard', commits: ['c1'], at: year } });
    const unlock = () => { for (const message of thread.messages) api.rearm(thread, message); frames.splice(0).forEach((callback) => callback()); };
    unlock();
    expect([writes.length, drawn, thread.messages.every((message: any) => message.convDelivery === 'unverified' && message.meta === 'sent, not verified')])
      .toEqual([30, ['list', 'conversation'], true]);
    writes.length = 0;
    drawn.length = 0;
    unlock();
    unlock();
    expect([writes.length, drawn], 'REASONED before: 30 writes and 30 list draws at every unlock from mid-2027').toEqual([0, []]);
  });

  it('R19-UNFREEZEMARK-01: the unfreeze\'s "sent" mark is written as it is signed — before the outcome — and taken back when the wallet says it did not land', async () => {
    const run = async (fate: 'landed' | 'not run' | 'may have landed') => {
      const store = new Map<string, string>();
      const marks: Array<string | null> = [];
      const env: Record<string, any> = {
        globalThis: { localStorage: { setItem: (key: string, value: string) => { store.set(key, value); }, getItem: (key: string) => store.get(key) ?? null, removeItem: (key: string) => { store.delete(key); } }, plathoTonRpcTransport: {} },
        vaultRestoreMarkKey: (address: string) => `mark:${address}`, VAULT_FROZEN: 'frozen', VAULT_RESTORE_LANDING_MS: 390_000,
        feeVaultState: { wallet: 'W', address: 'V', snapshot: { state: 'frozen' } }, vaultRestoreInFlight: false, vaultRestoreButton: { disabled: false },
        setText: () => {}, vaultRestoreStatus: {}, t: (key: string) => key, refreshComposerCostStatus: () => {}, requirePlathoWallet: () => ({ address: 'W' }),
        vaultAddressFor: async () => 'V', withVaultReadLock: (read: () => any) => read(), readAccountFreeze: async () => ({ hash: 'h' }), criticalChainReadOptions: () => ({}),
        noteTonRpcRateLimit: () => false, vaultRestoreSay: () => {}, queueAthPostTransactionRefresh: () => {}, assertWalletGramAtLeast: async () => {},
        requireSameWallet: (signer: any) => signer, console: { warn() {} },
        walletTransferNotRun: (error: any) => error?.code === 'PLATHO_WALLET_EXTERNAL_REPLACED',
        broadcastMayHaveLanded: (error: any) => typeof error?.builtBoc === 'string',
        sendPlathoWalletTransaction: async (_wallet: any, _transfer: any, options: any) => {
          await options.onSigned?.({ index: 0, chunks: 1, boc: 'te6', seqno: 9 });
          marks.push(store.get('mark:V') ?? null);
          if (fate === 'not run') throw Object.assign(new Error('replaced'), { code: 'PLATHO_WALLET_EXTERNAL_REPLACED' });
          if (fate === 'may have landed') throw Object.assign(new Error('timeout'), { builtBoc: 'te6' });
          return { outcome: 'consumed' };
        },
      };
      const { api } = liftWith(env, [fn('function vaultRestoreLanding('), fn('function noteVaultRestoreSent(wallet) {'), fn('function forgetVaultRestoreSent(wallet) {'),
        fn('async function signVaultRestore(plan, need, wallet, vaultAddress, { line = null } = {}) {')],
      '{ sign: signVaultRestore, landing: () => vaultRestoreLanding() }');
      await api.sign({ messages: [{ address: 'V' }] }, 1n, 'W', 'V');
      return { beforeTheOutcome: marks[0] !== null, after: store.has('mark:V'), landing: api.landing() };
    };
    expect(await run('landed'), 'MEASURED before: no mark until the outcome — a page ended mid-send left none').toEqual({ beforeTheOutcome: true, after: true, landing: true });
    expect(await run('not run'), 'the wallet says it did not land: no "sent" stands for it').toEqual({ beforeTheOutcome: true, after: false, landing: false });
    expect(await run('may have landed')).toEqual({ beforeTheOutcome: true, after: true, landing: true });
  });
});

describe('R19 — what a session saw and asked leaves with it; a face that cannot be drawn is let go wherever it is warmed [D1 / F5-4; D2 / F5-I1; D3 / F5-I2, F4-7]', () => {
  it('R19-SEEN-01: a lock made while the page is hidden leaves no row id naming a correspondent, nor a pending ask; a switch the same', () => {
    let report: (entries: any[]) => void = () => {};
    const timers = new Map<number, () => void>();
    let timerSeq = 0;
    const env: Record<string, any> = {
      IntersectionObserver: class { constructor(callback: any) { report = callback; } observe() {} },
      setTimeout: (callback: () => void) => { timerSeq += 1; timers.set(timerSeq, callback); return timerSeq; },
      clearTimeout: (id: number) => { timers.delete(id); }, threads: [],
      enqueueAvatarChainRead: { drop() {} }, enqueueUsernameHygiene: { drop() {} }, chatSpokenArrivals: null, chatAnnouncer: { textContent: '' },
    };
    for (const name of ['convBucketSeqMarks', 'convGapFloors', 'convDeepWalkPending', 'convDeepWalkShort', 'historyWindowState', 'convThreadIdentityAttempted',
      'inboundPeerIdentityInFlight', 'profileAvatarLoadPromises', 'profileAvatarLoadsLookedAt', 'profileAvatarAbsentUntil', 'profileAvatarVersionMissUntil',
      'groupAccessTriedAt', 'groupInviteAnswerTokens', 'groupControlFailureShownAt']) env[name] = new Map();
    const { api } = liftWith(env, [fn('function seenThreadRowIds() {'), fn('function threadRowSeen(threadId) {'), line('const THREAD_FACE_DWELL_MS = '),
      fn('function observeThreadRow(row) {'), fn('function forgetSeenThreadRows() {'), fn('function forgetConversationMapForLock() {')],
    '{ observe: observeThreadRow, seen: () => [...seenThreadRowIds()], lock: forgetConversationMapForLock }');
    const rows = Array.from({ length: 9 }, (_, i) => ({ dataset: { thread: `dm:wallet_address:0%3Apeer${i}` } }));
    rows.forEach((row) => api.observe(row));
    report(rows.map((target) => ({ target, isIntersecting: true })));
    expect([api.seen().length, timers.size]).toEqual([9, 9]);
    api.lock();
    expect([api.seen(), timers.size], 'MEASURED before: 9 of 9 ids kept — still kept with the page back on screen').toEqual([[], 0]);
    report([{ target: { dataset: { thread: 'dm:wallet_address:0%3Anext' } }, isIntersecting: true }]);
    expect(api.seen()).toEqual(['dm:wallet_address:0%3Anext']);
    expect(code(fn("function clearWalletScopedRuntimeState(reason = 'wallet changed') {"))).toContain('forgetSeenThreadRows();');
  });

  it('R19-FACEWARM-01: the All feed\'s warm-up holds the face guard — a face declaring 16,383 x 16,383 stays out of the map and is let go; one asked before the guard can answer is kept', async () => {
    const webp = (side: number) => {
      const bytes = new Uint8Array(30);
      bytes.set([...'RIFF'].map((ch) => ch.charCodeAt(0)), 0);
      bytes.set([22, 0, 0, 0], 4);
      bytes.set([...'WEBPVP8X'].map((ch) => ch.charCodeAt(0)), 8);
      bytes.set([10, 0, 0, 0], 16);
      const less = side - 1;
      bytes.set([less & 0xff, (less >> 8) & 0xff, (less >> 16) & 0xff, less & 0xff, (less >> 8) & 0xff, (less >> 16) & 0xff], 24);
      return `data:image/webp;base64,${Buffer.from(bytes).toString('base64')}`;
    };
    const records = new Map<string, string>([['h-huge', webp(16_383)], ['h-small', webp(256)]]);
    const deleted: string[] = [];
    const store = { getMany: async (hashes: string[]) => new Map(hashes.filter((hash) => records.has(hash)).map((hash) => [hash, records.get(hash)])), delete: async (hash: string) => { deleted.push(hash); records.delete(hash); } };
    const faces = new Map<string, string>();
    const guards = [line('const DRAWN_IMAGE_MAX_SIDE = '), line('const DRAWN_IMAGE_MAX_PIXELS = '), line('const EMPTY_WEBP_DATA_URL = '),
      fn('function webpCanvasSize(bytes) {'), fn('function drawableImageUrl(url) {'), fn('function faceDrawable(url) {'), fn('function faceRefused(url) {')];
    const warm = lift({
      atob, publicChannelAvatarUrlByWallet: faces, profileAvatarMediaStore: async () => store,
      collectRememberedAvatarHashes: (wallets: string[], byWallet: Map<string, string>) => { for (const wallet of wallets) byWallet.set(wallet, wallet === 'W-huge' ? 'h-huge' : 'h-small'); },
    }, [...guards, fn('function warmOneFace(raw, hash, url, store) {'), fn('async function warmAvatarsFromDevice(wallets) {')], 'warmAvatarsFromDevice');
    expect(await warm(['W-huge', 'W-small'])).toBe(true);
    await settle(1);
    expect([faces.has('W-huge'), faces.get('W-small') === records.get('h-small'), deleted], 'MEASURED before: put in the face map: true; the record kept').toEqual([false, true, ['h-huge']]);
    const kept = new Map<string, { url: string }>([['h-small', { url: webp(256) }]]);
    const early = lift({
      atob, profileAvatarMediaHashKey: (hash: string) => hash, profileAvatarMediaStore: async () => ({ get: async (hash: string) => kept.get(hash) ?? null, delete: async (hash: string) => { kept.delete(hash); } }),
      sha256Hex: async () => 'h-small',
    }, [fn('function webpCanvasSize(bytes) {'), fn('function drawableImageUrl(url) {'), fn('function faceDrawable(url) {'), fn('function faceRefused(url) {'),
      fn('function webpDataUrlToBytes(dataUrl) {'), fn('async function readProfileAvatarMediaCache(avatarHash) {')], 'readProfileAvatarMediaCache');
    expect([await early('h-small'), kept.has('h-small')], 'before: deleted — a face read before the guard could answer lost its record').toEqual([null, true]);
  });

  it('R19-UNFREEZEASK-01: the unfreeze\'s ask is its session\'s — a lock ends its search and its flag, the next session presses for itself; the Wallet row says the archive\'s answer', async () => {
    let reads = 0;
    let alive = true;
    const { api: restore } = liftWith({
      CRITICAL_CHAIN_READ_QUEUE_TIMEOUT_MS: 1_000, matchFrozenState: async () => null, globalThis: { plathoTonRpcTransport: { getMasterchainInfo: async () => ({ last: { seqno: 9_000 } }) } },
      createAccountStateAtReader: () => async () => { reads += 1; return { status: 'active', code: 'c', data: 'd' }; }, accountStateRow: (row: any) => row,
      createAccountHistoryReader: () => async () => { reads += 1; if (reads >= 2) alive = false; return []; },
      preFreezeStateFromArchive: async ({ listTransactions, readStateAt, readLatestSeqno }: any) => {
        for (let page = 0; page < 3; page += 1) await listTransactions('V', { limit: 10, offset: page * 10 });
        await readLatestSeqno();
        for (let seqno = 1; seqno < 30; seqno += 1) await readStateAt('V', seqno);
        return { found: null, reason: 'hash-mismatch' };
      },
      createShardLastTransactionReader: () => async () => { reads += 1; return null; }, console: { warn() {} },
    }, [fn('async function readFrozenAccountRestore(address, frozenHash, { candidates = [], alive = () => true } = {}) {')], 'readFrozenAccountRestore');
    const ended = await restore('V', 'h', { alive: () => alive }).then(() => 'answered', (error: any) => error?.code);
    expect([ended, reads], 'MEASURED before: up to 34 reads an account at the critical tier after the lock').toEqual(['PLATHO_SESSION_OVER', 2]);

    const asked: Array<{ resolve: (value: any) => void }> = [];
    const dialogs: string[] = [];
    const env: Record<string, any> = {
      vaultSupported: () => true, plathoWallet: { address: 'W' }, vaultRestoreInFlight: false, vaultRestoreLanding: () => false, vaultRestoreChecking: false,
      vaultRestoreLost: null, walletSessionGeneration: 1, vaultRestoreSay: () => {}, readVaultAtPress: async () => {}, ownVaultFreeze: () => ({ vault: true, custody: false }),
      feeVaultState: { wallet: 'W', address: 'V', snapshot: { state: 'frozen', frozenHash: 'h' } }, setText: () => {}, t: (key: string) => key,
      feeVaultCodeBoc: () => 'code', cellToBoc: () => 'data', feeVaultInitializedDataCell: () => ({}), frozenVaultCustody: async () => null,
      readFrozenAccountRestore: () => new Promise((resolve) => { asked.push({ resolve }); }), VAULT_ARCHIVE_LOST_REASONS: new Set(['hash-mismatch']),
      planVaultRestore: () => ({ ok: true, parts: [{ account: 'vault' }], messages: [], debt: 1n, kept: 1n, total: 2n }),
      formatGramNanotonsUp: () => '0.1', vaultRestoreNeed: () => 3n, loadConnectedTonWalletBalance: async () => 10n, formatTonNanotonsUp: () => '0.1', formatTonNanotons: () => '1',
      rememberedVaultReading: null, FV_PROTOCOL_FEE: 1n, joinHintSentences: (...parts: string[]) => parts.join(' '), refreshComposerCostStatus: () => {},
      openActionDialog: async () => { dialogs.push(`session ${env.walletSessionGeneration}`); return false; }, renderFeeDiscountRows: () => {}, noteTonRpcRateLimit: () => false,
      console: { warn() {} }, feeVaultFreezeAskedAt: new Map(), quietSpent: { books: new Map() },
    };
    const { api } = liftWith(env, [fn('async function openVaultRestoreDialog({ line = null } = {}) {'), fn('function forgetWalletSessionMarks() {')],
      '{ press: openVaultRestoreDialog, forget: forgetWalletSessionMarks }');
    const first = api.press();
    await settle(1);
    expect(Boolean(env.vaultRestoreChecking)).toBe(true);
    env.walletSessionGeneration = 2;
    api.forget();
    expect(env.vaultRestoreChecking, 'MEASURED before: the next session said "checking" and its own Unfreeze did nothing').toBe(false);
    const second = api.press();
    await settle(1);
    expect(asked.length, 'the next session asks for itself').toBe(2);
    asked[0].resolve({ frozen: { codeBoc: 'c', dataBoc: 'd' }, debt: 1n, reason: null });
    await first;
    expect([dialogs, Boolean(env.vaultRestoreChecking)], 'REASONED before: the old press\'s dialog opened in the new session').toEqual([[], true]);
    asked[1].resolve({ frozen: { codeBoc: 'c', dataBoc: 'd' }, debt: 1n, reason: null });
    await second;
    expect([dialogs, env.vaultRestoreChecking]).toEqual([['session 2'], false]);
    const said: string[] = [];
    env.vaultRestoreSay = (text: string) => said.push(text);
    env.planVaultRestore = ({ vault }: any) => (vault?.reason === 'hash-mismatch' ? { ok: false, reason: 'state-unfound' } : { ok: true, parts: [], messages: [] });
    const third = api.press();
    await settle(1);
    said.length = 0;
    env.walletSessionGeneration = 3;
    api.forget();
    asked[2].resolve({ frozen: null, debt: null, reason: 'hash-mismatch' });
    await third;
    expect([said, env.vaultRestoreLost], 'its answer is its session\'s').toEqual([[], null]);

    const button: any = { hidden: true, disabled: false, querySelector: () => null };
    const rows: Record<string, string> = {};
    const rowEnv: Record<string, any> = {
      feeDiscountStatus: {}, vaultSupported: () => true, plathoWallet: { address: 'W' }, VAULT_FROZEN: 'frozen', VAULT_LIVE: 'live',
      feeVaultState: { wallet: 'W', address: 'V', snapshot: { state: 'frozen', frozenHash: 'h' } }, vaultRestoreButton: button, vaultRestoreInFlight: false,
      vaultRestoreLanding: () => false, vaultRestoreLost: { wallet: 'W', vault: 'V', hash: 'h' }, vaultRestoreStatus: { id: 'row' },
      setText: (node: any, text: string) => { rows[node?.id ?? 'other'] = text; }, t: (key: string) => key,
      unstakeAthButton: null, recoverAthButton: null, vaultFloatButton: null,
    };
    const { api: rowApi } = liftWith(rowEnv, [fn('function ownVaultFreeze() {'), fn('function vaultRestoreLostNow() {'), fn('function renderFeeDiscountRows() {')], 'renderFeeDiscountRows');
    rowApi();
    expect([button.hidden, button.disabled, rows.row], 'MEASURED before: "Fee vault frozen Unfreeze", enabled — its press ran the 25 s search again').toEqual([false, true, 'profile.vaultRestoreLost']);
    rowEnv.vaultRestoreLost = { wallet: 'W', vault: 'V', hash: 'another freeze' };
    rowApi();
    expect([button.disabled, rows.row], 'a new freeze is asked again').toEqual([false, 'profile.vaultRestoreAction']);
  });
});

describe('R19 — a public room\'s rows are signed by the room\'s own wallet [F5\'s note for F3]', () => {
  it('R19-ROOMSIGNER-01: switched inside the press\'s clock wait, the room message is refused before anything is built — never signed by the other wallet', async () => {
    let built = 0;
    const env: Record<string, any> = {
      plathoWallet: { address: 'A' }, t: (key: string) => key, sameWalletAddress: (a: any, b: any) => Boolean(a) && a === b,
      publicGroupDocumentBlocks: (blocks: any) => blocks, encodeMessageDocumentBlocks: () => new Uint8Array([1]), publicGroupStreamBytes: () => new Uint8Array([2]),
      createPublicLanePayloadPartsV2: async () => { built += 1; return []; },
    };
    const { api } = liftWith(env, [fn('function walletChangedBeforeSigningError() {'), fn('function walletOfSend(owner = undefined) {'),
      fn('async function publishPublicGroupDocument({ uid, blocks, streamId, askedAt = null, owner = undefined }) {')], 'publishPublicGroupDocument');
    const send = () => api({ uid: '7', blocks: [{ type: 'text', text: 'hello room' }], streamId: 'ab', owner: 'A' }).then(() => 'built', (error: any) => error?.code ?? error?.message);
    env.plathoWallet = { address: 'B' };
    expect([await send(), built], 'REASONED before: B signed A\'s room message — A\'s words under B\'s name').toEqual(['PLATHO_WALLET_CHANGED', 0]);
    env.plathoWallet = null;
    expect([await send(), built]).toEqual(['Connect a wallet to write to a public group', 0]);
    env.plathoWallet = { address: 'A' };
    expect([await send(), built]).toEqual(['group.sendFailed', 1]);
    expect(code(fn('async function buildPublicGroupRuntime() {'))).toContain('publish: (document) => publishPublicGroupDocument({ ...document, owner: wallet.address }),');
  });
});
