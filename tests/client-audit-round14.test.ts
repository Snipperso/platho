import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { IDBDatabase, IDBFactory, IDBIndex, IDBKeyRange, IDBObjectStore } from 'fake-indexeddb';
import { code, sourceBlock } from './helpers/source';
import { quietShared, quietWorld } from './helpers/recovery-quiet-world';
import { generateRandomAtRestKeys, sealAtRest } from '../web/at-rest-seal.mjs';
import { createMemoryCacheStore, openSealedCacheStores } from '../web/sealed-cache.mjs';
import { createMemoryReplayStore, createSealedReplayGuard } from '../web/replay-store.mjs';
import { conversationTag, createIndexedDbEncryptedMessageHistoryStore, sealMessageHistoryRecord } from '../web/encrypted-message-store.mjs';
import { awaitWalletExternalOutcome, noteChainTime, walletChainClockOffsetMs, WALLET_EXTERNAL_DEATH_GRACE_MS } from '../web/platho-wallet.mjs';
import { createRecordShardPlanner } from '../web/conv-discovery.mjs';
import { createEncryptedIntroCapsule, createMessagingIdentity, exportPublicKeyBundle, openIntroCapsuleFromChainCells, randomBytes } from '../web/crypto/platho-crypto.mjs';
import {
  INTRO_EPOCH_SIGNED_FROM, INTRO_PAYLOAD_MAGIC, INTRO_PAYLOAD_MAGIC_V3, INTRO_TRANSCRIPT_DOMAIN, INTRO_TRANSCRIPT_DOMAIN_V3, INTRO_UNSIGNED_REFUSED_FROM,
  buildIntroHandshake, openIntroHandshake, parseIntroPayload,
} from '../web/crypto/intro-handshake.mjs';
import { createIntroReceiveHandler, introEpochVerdict } from '../web/intro-receive-handler.mjs';
import { createMemoryConvKeyStore } from '../web/conv-key-store.mjs';
import { ml_kem768 } from '../web/vendor/@noble/post-quantum/ml-kem.js';
import { createAthMasterTonRpcProvider } from '../web/ath-ton-rpc-provider.mjs';
import { encodeTonAddressSliceBoc } from '../web/ton-rpc-transport.mjs';
import { VERDICT_ACTION, buildVerdictMessage, moderationLedgerTrusted, verdictLiveSurchargeNanotons, verdictMinimumCeiling } from '../web/moderation.mjs';
import { PLATHO_APP_CONFIG } from '../web/platho-config.mjs';
import { I18N_LOCALES, I18N_STRINGS } from '../web/i18n-strings.mjs';
import {
  RESECURE_ATTEMPTS_KEY, RESECURE_CLEARED_KEY, RESECURE_CLEAR_TIMEOUT_MS, RESECURE_COOKIE_MAX_AGE_S, RESECURE_HEADER, RESECURE_MAX_ATTEMPTS, RESECURE_MAX_UNCONFIRMED,
  RESECURE_PROBE, RESECURE_READY, RESECURE_CONFIRMATION, RESECURE_RECOVER_KEY, RESECURE_RECOVER_SETTLED_KEY, RESECURE_STATE_KEY, RESECURE_UNCONFIRMED_KEY, RESECURE_WALLET_RECORD_KEY,
  RESECURE_WINDOW_LOCK, RESECURE_WRITE_CHUNK, askSiteStorageClear, clearResecureCookie, resecureInterruptedHeldWallet, resecureOriginStorage,
  resecureWasInterrupted, restoreOriginStorage, siteStorageClearProbe, walletWithoutBackup, RESECURE_CACHE_CARRY_ORDER, resecureCacheCarryRank, verifyOriginStorage,
  RESECURE_UNANSWERED_KEY, RESECURE_PARKED_UNTIL_KEY, RESECURE_MAX_UNANSWERED, RESECURE_UNANSWERED_PARK_MS, RESECURE_ABORT_SETTLE_MS,
} from '../web/storage-resecure.mjs';


const require = createRequire(import.meta.url);
const { Address } = require('@ton/core');
const app = readFileSync('web/app.js', 'utf8');
const bootGuard = readFileSync('web/boot-guard.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const line = (start: string) => { const at = app.indexOf(start); if (at < 0) throw new Error(`not found: ${start}`); return app.slice(at, app.indexOf('\n', at)); };
const lift = (env: Record<string, any>, sources: string[], exported: string, prelude = '') => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, `${prelude}\n${sources.join('\n')}\nreturn ${exported};`)(...names.map((n) => env[n]));
};
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function requestToPromise<T = any>(request: any): Promise<T> {
  return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
async function rawEntries(factory: IDBFactory, dbName: string, storeName: string) {
  const db: any = await requestToPromise(factory.open(dbName));
  try {
    const store = db.transaction(storeName, 'readonly').objectStore(storeName);
    const [keys, values] = await Promise.all([requestToPromise<any[]>(store.getAllKeys()), requestToPromise<any[]>(store.getAll())]);
    return keys.map((key: any, at: number) => ({ key, value: values[at] }));
  } finally {
    db.close();
  }
}
function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() { return map.size; },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => { map.set(key, String(value)); },
    removeItem: (key: string) => { map.delete(key); },
    clear: () => map.clear(),
    map,
  };
}
async function seedDatabases(factory: IDBFactory) {
  const db: any = await new Promise((resolve, reject) => {
    const request = factory.open('platho-groups-v1.dep.wal', 3);
    request.onupgradeneeded = () => { request.result.createObjectStore('groups').put({ v: 2, n: 'nonce', x: new Uint8Array([1, 2, 3]) }, 'tag-1'); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
}
const answer = (status: number, word: string | null) => ({ status, headers: { get: (name: string) => (word !== null && name === RESECURE_HEADER ? word : null) } });
const clearingFetch = (factory: IDBFactory, storages: Array<{ clear: () => void }>) => async (_path: string, init: any) => {
  if (init.headers[RESECURE_HEADER] === RESECURE_PROBE) return answer(204, RESECURE_READY);
  for (const { name } of await factory.databases()) await requestToPromise(factory.deleteDatabase(name!));
  for (const storage of storages) storage.clear();
  return answer(204, RESECURE_CONFIRMATION);
};

function pageDocument(initialCookie = '') {
  const jar = new Map<string, string>();
  for (const part of initialCookie.split(/;\s*/).filter(Boolean)) { const at = part.indexOf('='); jar.set(part.slice(0, at), part.slice(at + 1)); }
  const writes: string[] = [];
  const attributes = new Map<string, string>();
  const screen = { dataset: { phase: 'idle' } as Record<string, string> };
  const label: any = { textContent: 'Loading', role: null, setAttribute(key: string, value: string) { if (key === 'role') this.role = value; }, removeAttribute(key: string) { if (key === 'role') this.role = null; } };
  const document = {
    get cookie() { return [...jar].map(([key, value]) => `${key}=${value}`).join('; '); },
    set cookie(value: string) {
      writes.push(value);
      const [pair, ...rest] = value.split(';').map((part) => part.trim());
      const at = pair.indexOf('=');
      if (rest.includes('max-age=0')) jar.delete(pair.slice(0, at)); else jar.set(pair.slice(0, at), pair.slice(at + 1));
    },
    documentElement: {
      setAttribute: (key: string, value: string) => { attributes.set(key, value); },
      removeAttribute: (key: string) => { attributes.delete(key); },
      getAttribute: (key: string) => attributes.get(key) ?? null,
    },
    getElementById: (id: string) => (id === 'bootScreen' ? screen : (id === 'bootLoadingLabel' ? label : null)),
  };
  return { document, writes, attributes, screen, label, jar };
}
function plainLocks() {
  return {
    busy: false,
    request(name: string, options: any, callback: any) {
      if (options?.mode === 'shared') { callback({ name, mode: 'shared' }); return new Promise(() => {}); }
      return Promise.resolve(callback(this.busy ? null : { name, mode: 'exclusive' }));
    },
  };
}
function runnerGlobal(storage: any, document: any = pageDocument().document, locks: any = plainLocks()) {
  return {
    localStorage: storage,
    sessionStorage: memoryStorage(),
    indexedDB: { databases: async () => [] },
    fetch: () => {},
    document,
    navigator: { locks, serviceWorker: { controller: {} } },
    addEventListener() {},
    removeEventListener() {},
  } as any;
}
function liftRunner(fakeGlobal: any, resecure: () => Promise<any>, { waitMs = 50, capMs = 1_000, showMs = 300, pollMs = 5_000 } = {}) {
  return lift({
    globalThis: fakeGlobal, RESECURE_STATE_KEY, RESECURE_ATTEMPTS_KEY, RESECURE_MAX_ATTEMPTS, RESECURE_RECOVER_KEY, RESECURE_UNCONFIRMED_KEY,
    RESECURE_RECOVER_SETTLED_KEY,
    RESECURE_CLEARED_KEY,
    RESECURE_MAX_UNCONFIRMED, RESECURE_WINDOW_LOCK, RESECURE_WINDOW_WAIT_MS: waitMs, RESECURE_WINDOW_WAIT_CAP_MS: capMs, RESECURE_WINDOW_WAIT_SHOW_MS: showMs,
    RESECURE_UNANSWERED_KEY, RESECURE_PARKED_UNTIL_KEY, RESECURE_MAX_UNANSWERED, RESECURE_UNANSWERED_PARK_MS,
    resecureHostShared: () => false,
    walletWithoutBackup, resecureWasInterrupted, resecureInterruptedHeldWallet, clearResecureCookie,
    aloneAmongWindowsOfThisSite: async () => true, t: (key: string) => key, resecureOriginStorage: resecure, console: { warn() {} },
    setTimeout: (callback: () => void, ms: number) => setTimeout(callback, ms === 5_000 ? pollMs : ms), clearTimeout, Date,
  }, ['async function resecureStorageIfDue() {', 'function noteInterruptedResecure() {', 'async function runStorageResecureIfSafe() {',
    'function showStorageBusy(text) {', 'function sessionStorageOrNull() {', 'async function askStoragePersistence() {',
    'function holdPageDuringResecure(event) {', 'function holdStorageWindowLock() {'].map(fn), 'resecureStorageIfDue', 'let plathoDatabasesAtStart = null;');
}

afterEach(() => { vi.restoreAllMocks(); });

describe('R14 the re-secure writes back whatever the clearing did', () => {
  it('R14-RES-01: a clearing answered without the word — with a 200, or cut off — still has everything written back', async () => {
    for (const kind of ['no word', 'a 200', 'cut off'] as const) {
      const factory = new IDBFactory();
      await seedDatabases(factory);
      const local = memoryStorage({ [RESECURE_WALLET_RECORD_KEY]: '{"sealed":true}', theme: 'dark' });
      const fetch = async (_path: string, init: any) => {
        if (init.headers[RESECURE_HEADER] === RESECURE_PROBE) return answer(204, RESECURE_READY);
        for (const { name } of await factory.databases()) await requestToPromise(factory.deleteDatabase(name!));
        local.clear();
        if (kind === 'cut off') throw new Error('the connection dropped after the headers');
        return kind === 'no word' ? answer(204, null) : answer(200, null);
      };
      const result = await resecureOriginStorage({ indexedDB: factory, localStorage: local, fetch });
      expect(result.outcome, `${kind}: MEASURED before: 'not-confirmed' — 0 keys, 0 databases, the device greeted as new`).toBe('restored');
      expect(local.getItem(RESECURE_WALLET_RECORD_KEY), kind).toBe('{"sealed":true}');
      expect((await rawEntries(factory, 'platho-groups-v1.dep.wal', 'groups')).length, kind).toBe(1);
    }
  });

  it('R15-ABORT-01: a clearing aborted at the deadline that lands a moment later is written back — not left to empty a running page [F1-8]', async () => {
    const factory = new IDBFactory();
    await seedDatabases(factory);
    const local = memoryStorage({ [RESECURE_WALLET_RECORD_KEY]: '{"sealed":true}', theme: 'dark' });
    const fetch = (_path: string, init: any) => {
      if (init.headers[RESECURE_HEADER] === RESECURE_PROBE) return Promise.resolve(answer(204, RESECURE_READY));
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new Error('aborted'));
          setTimeout(async () => {
            for (const { name } of await factory.databases()) await requestToPromise(factory.deleteDatabase(name!));
            local.clear();
          }, 20);
        });
      });
    };
    const result = await resecureOriginStorage({ indexedDB: factory, localStorage: local, fetch, clearTimeoutMs: 30, abortSettleMs: 250 });
    expect(result.outcome, 'MEASURED before: "unanswered" — and the storage emptied under the running page, nothing marking it').toBe('restored');
    expect(local.getItem(RESECURE_WALLET_RECORD_KEY)).toBe('{"sealed":true}');
    expect((await rawEntries(factory, 'platho-groups-v1.dep.wal', 'groups')).length).toBe(1);
    expect(RESECURE_ABORT_SETTLE_MS).toBe(3_000);
  });

  it('R14-RES-02: a clearing that never answers is aborted at the timeout — and with nothing cleared, nothing changes', async () => {
    const factory = new IDBFactory();
    await seedDatabases(factory);
    const local = memoryStorage({ theme: 'dark' });
    let aborted = false;
    const fetch = (_path: string, init: any) => {
      if (init.headers[RESECURE_HEADER] === RESECURE_PROBE) return Promise.resolve(answer(204, RESECURE_READY));
      return new Promise((_resolve, reject) => { init.signal?.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); }); });
    };
    const started = Date.now();
    const result = await resecureOriginStorage({ indexedDB: factory, localStorage: local, fetch, clearTimeoutMs: 50 });
    expect(result.outcome, 'MEASURED before: "Securing storage…" for as long as the network held the request').toBe('unanswered');
    expect(aborted, 'aborted: a late answer can no longer clear under a running app').toBe(true);
    expect(Date.now() - started).toBeLessThan(5_000);
    expect((await factory.databases()).map((entry) => entry.name)).toEqual(['platho-groups-v1.dep.wal']);
    expect(local.getItem('theme')).toBe('dark');
    expect(RESECURE_CLEAR_TIMEOUT_MS).toBe(20_000);
    expect(await askSiteStorageClear({ fetch: async () => { throw new Error('offline'); } })).toBe('unanswered');
    expect(await askSiteStorageClear({ fetch: async () => answer(204, null) })).toBe('unconfirmed');
    expect(await askSiteStorageClear({ fetch: async () => answer(204, RESECURE_CONFIRMATION) })).toBe('cleared');
  });

  it('R14-RES-03: sessionStorage is carried through — Telegram keeps its launch there', async () => {
    const factory = new IDBFactory();
    await seedDatabases(factory);
    const local = memoryStorage({ theme: 'dark' });
    const session = memoryStorage({ __telegram__initParams: '{"tgWebAppData":"x"}' });
    const result = await resecureOriginStorage({ indexedDB: factory, localStorage: local, sessionStorage: session, fetch: clearingFetch(factory, [local, session]) });
    expect(result.outcome).toBe('restored');
    expect(session.getItem('__telegram__initParams'), 'MEASURED before: gone — a later reload inside Telegram booted without its launch').toBe('{"tgWebAppData":"x"}');
    expect(code(fn('async function runStorageResecureIfSafe() {'))).toContain('sessionStorage: sessionStorageOrNull(),');
  });

  it('R14-RES-04: the write-back goes a thousand records a transaction, and one store that fails does not stop the next', async () => {
    const factory = new IDBFactory();
    const values = Array.from({ length: 2_500 }, (_, i) => ({ id: `r${i}`, u: i }));
    values[2_100] = { id: 'r2100', u: 2_099 };
    const snapshot = {
      local: [], session: [],
      databases: [{
        name: 'platho-history-v1.dep.wal', version: 4, stores: [
          { name: 'a-big', keyPath: 'id', autoIncrement: false, indexes: [{ name: 'uniq', keyPath: 'u', unique: true, multiEntry: false }], keys: values.map((v) => v.id), values },
          { name: 'b-small', keyPath: 'id', autoIncrement: false, indexes: [], keys: ['k'], values: [{ id: 'k' }] },
        ],
      }],
    };
    const written = await restoreOriginStorage(snapshot, { indexedDB: factory, localStorage: memoryStorage(), chunk: RESECURE_WRITE_CHUNK });
    expect(written.failed, 'said, never silent').toEqual(['platho-history-v1.dep.wal/a-big']);
    expect((await rawEntries(factory, 'platho-history-v1.dep.wal', 'a-big')).length, 'MEASURED before: one transaction — all or nothing').toBe(2_000);
    expect((await rawEntries(factory, 'platho-history-v1.dep.wal', 'b-small')).length, 'MEASURED before: the store after a failing one was never written').toBe(1);
    expect(RESECURE_WRITE_CHUNK).toBe(1_000);
  });

  it('R14-RES-05: a probe nothing answers is "unreachable", not "cannot clear" — only a server that answered "cannot" is counted', async () => {
    expect(await siteStorageClearProbe({ fetch: async () => { throw new Error('offline'); } })).toBe('unreachable');
    expect(await siteStorageClearProbe({ fetch: async () => answer(200, null) })).toBe('refused');
    expect(await siteStorageClearProbe({ fetch: async () => answer(204, RESECURE_READY) })).toBe('ready');
    const steps: string[] = [];
    const offline = await resecureOriginStorage({ indexedDB: new IDBFactory(), localStorage: memoryStorage(), fetch: async () => { throw new Error('offline'); }, onStep: (step: string) => steps.push(step) });
    expect(offline.outcome).toBe('unreachable');
    expect(steps, 'nothing read into memory').toEqual(['probe']);
    const storage = memoryStorage();
    let outcome = 'unreachable';
    const run = liftRunner(runnerGlobal(storage), async () => ({ outcome, databases: 0 }));
    for (let start = 0; start < RESECURE_MAX_UNCONFIRMED + 2; start += 1) {
      storage.setItem(RESECURE_STATE_KEY, 'due');
      // eslint-disable-next-line no-await-in-loop
      await run();
    }
    expect(storage.getItem(RESECURE_STATE_KEY), 'MEASURED before: five offline starts ended the re-secure on the device for good').toBe('due');
    expect(storage.getItem(RESECURE_UNCONFIRMED_KEY)).toBeNull();
    outcome = 'unanswered';
    storage.setItem(RESECURE_STATE_KEY, 'due');
    await run();
    expect(storage.getItem(RESECURE_UNCONFIRMED_KEY), 'nor a clearing nobody answered').toBeNull();
    outcome = 'not-confirmed';
    for (let start = 1; start < RESECURE_MAX_UNCONFIRMED; start += 1) {
      storage.setItem(RESECURE_STATE_KEY, 'due');
      // eslint-disable-next-line no-await-in-loop
      await run();
    }
    expect(storage.getItem(RESECURE_STATE_KEY)).toBe('due');
    await run();
    expect(storage.getItem(RESECURE_STATE_KEY), 'a server that answered "cannot" five times is let go').toBe('unsupported');
  });

  it('R14-RES-06: a run marks itself for thirty days, and says whether it held a wallet', async () => {
    const factory = new IDBFactory();
    await seedDatabases(factory);
    const page = pageDocument();
    const local = memoryStorage({ [RESECURE_WALLET_RECORD_KEY]: '{"sealed":true}' });
    let atClearing = '';
    const fetch = async (path: string, init: any) => {
      if (init.headers[RESECURE_HEADER] !== RESECURE_PROBE) atClearing = page.document.cookie;
      return clearingFetch(factory, [local])(path, init);
    };
    await resecureOriginStorage({ indexedDB: factory, localStorage: local, fetch, document: page.document });
    expect(atClearing).toBe('__Host-platho_resecure=writing-wallet');
    expect(page.writes[0], 'MEASURED before: max-age=3600 — after an hour nothing said the run had died').toContain(`max-age=${RESECURE_COOKIE_MAX_AGE_S}`);
    expect(RESECURE_COOKIE_MAX_AGE_S).toBe(30 * 86_400);
    expect(page.document.cookie, 'gone with the answer').toBe('');
    expect(resecureInterruptedHeldWallet({ cookie: 'platho_resecure=writing-wallet' })).toBe(true);
    expect(resecureInterruptedHeldWallet({ cookie: 'platho_resecure=writing' }), 'a run of a device with no wallet lost none').toBe(false);
    expect(resecureWasInterrupted({ cookie: 'platho_resecure=writing' })).toBe(true);
    const walletless = pageDocument();
    const factory2 = new IDBFactory();
    await seedDatabases(factory2);
    const local2 = memoryStorage({ theme: 'dark' });
    let atClearing2 = '';
    await resecureOriginStorage({
      indexedDB: factory2, localStorage: local2, document: walletless.document,
      fetch: async (path: string, init: any) => { if (init.headers[RESECURE_HEADER] !== RESECURE_PROBE) atClearing2 = walletless.document.cookie; return clearingFetch(factory2, [local2])(path, init); },
    });
    expect(atClearing2).toBe('__Host-platho_resecure=writing');
  });
});

describe('R14 the start around the run (app.js)', () => {
  it('R14-RES-07: what a dead run left is read before a new run writes over it — the re-read it owed is asked for', async () => {
    const storage = memoryStorage({ [RESECURE_STATE_KEY]: 'due', [RESECURE_ATTEMPTS_KEY]: '1' });
    const page = pageDocument('platho_resecure=writing-wallet');
    const fake = runnerGlobal(storage, page.document);
    const run = liftRunner(fake, async () => {
      page.document.cookie = 'platho_resecure=writing; path=/; max-age=2592000';
      page.document.cookie = 'platho_resecure=; path=/; max-age=0';
      return { outcome: 'restored', databases: 1 };
    });
    await run();
    expect(Number(storage.getItem(RESECURE_RECOVER_KEY)), 'MEASURED before: null — the new run cleared both marks before anything read them').toBeGreaterThan(Date.now() - 60_000);
    expect(fake.plathoResecureInterrupted, 'and the run that died held a wallet').toBe(true);
    expect(storage.getItem(RESECURE_STATE_KEY)).toBe('done');
    expect(storage.getItem(RESECURE_ATTEMPTS_KEY)).toBeNull();
  });

  it('R14-RES-08: a window opened during another window\'s run waits for it, says so, and does not take its mark for a dead run\'s', async () => {
    const storage = memoryStorage({ [RESECURE_STATE_KEY]: 'done' });
    const page = pageDocument('platho_resecure=writing-wallet');
    let release: () => void = () => {};
    let exclusive = true;
    const locks = {
      request(name: string, options: any, callback: any) {
        if (options?.mode === 'shared') return new Promise((resolve) => { release = () => { exclusive = false; resolve(callback({ name, mode: 'shared' })); }; });
        return Promise.resolve(callback(null));
      },
      query: async () => ({ held: exclusive ? [{ name: RESECURE_WINDOW_LOCK, mode: 'exclusive' }] : [] }),
    };
    const fake = runnerGlobal(storage, page.document, locks);
    const start = liftRunner(fake, async () => ({ outcome: 'restored', databases: 0 }), { waitMs: 30, showMs: 10, pollMs: 20, capMs: 60_000 });
    let settled = false;
    const waiting = start().then(() => { settled = true; });
    await delay(150);
    expect(settled, 'MEASURED before: started at two minutes while the run still held the lock — a late clearing deleted its databases').toBe(false);
    expect(page.attributes.get('data-platho-boot-busy'), 'the boot guard is told to wait').toBe('1');
    expect(page.screen.dataset.phase).toBe('loading');
    expect(page.label.textContent, 'MEASURED before: nothing said; the guard called it a failed download at ~7.5 s').toBe('storage.resecureWaiting');
    expect(page.jar.get('platho_resecure'), 'MEASURED before: read at once and deleted — the live run\'s own mark').toBe('writing-wallet');
    expect(storage.getItem(RESECURE_RECOVER_KEY)).toBeNull();
    page.document.cookie = 'platho_resecure=; path=/; max-age=0';
    release();
    await waiting;
    expect(storage.getItem(RESECURE_RECOVER_KEY), 'a live run is not a dead one').toBeNull();
    expect(fake.plathoResecureInterrupted).toBeUndefined();
    expect(page.attributes.has('data-platho-boot-busy'), 'the guard is free again').toBe(false);
    expect(page.screen.dataset.phase, 'and the screen back in its own phase').toBe('idle');
    expect(page.label.textContent).toBe('Loading');
  });

  it('R14-RES-09: the run says what it does on the boot screen, and in Telegram the page is held before anything is written', async () => {
    const storage = memoryStorage({ [RESECURE_STATE_KEY]: 'due' });
    const page = pageDocument();
    const fake = runnerGlobal(storage, page.document);
    const calls: string[] = [];
    fake.Telegram = { WebApp: { enableClosingConfirmation: () => calls.push('confirm'), disableVerticalSwipes: () => calls.push('swipes') } };
    const start = liftRunner(fake, async () => {
      calls.push('run', `busy:${page.attributes.get('data-platho-boot-busy')}`, `phase:${page.screen.dataset.phase}`, `line:${page.label.textContent}`, `role:${page.label.role}`);
      return { outcome: 'restored', databases: 1 };
    });
    await start();
    expect(calls, 'MEASURED before: phase "idle" hides the line — a frozen splash; and a swipe closed the mini app mid-run')
      .toEqual(['confirm', 'swipes', 'run', 'busy:1', 'phase:loading', 'line:storage.resecuring', 'role:status']);
    expect(page.screen.dataset.phase).toBe('idle');
    expect(page.attributes.has('data-platho-boot-busy')).toBe(false);
    expect(I18N_STRINGS.ru['storage.resecuring'].startsWith(String.fromCharCode(0x42f))).toBe(false);
  });

  it('R14-RES-10: the browser is asked to keep the storage only if it does not already — and after the start, not inside it', async () => {
    const asked: string[] = [];
    const make = (persisted: boolean) => lift({
      globalThis: { navigator: { storage: { persisted: async () => { asked.push('persisted'); return persisted; }, persist: async () => { asked.push('persist'); return true; } } } },
    }, [fn('async function askStoragePersistence() {')], 'askStoragePersistence');
    await make(true)();
    expect(asked, 'MEASURED before: persist() asked every run — in Firefox a prompt, awaited inside the busy window').toEqual(['persisted']);
    await make(false)();
    expect(asked).toEqual(['persisted', 'persisted', 'persist']);
    const run = code(fn('async function runStorageResecureIfSafe() {'));
    expect(run).toContain('setTimeout(() => { void askStoragePersistence(); }, 0);');
    expect(run).not.toMatch(/await [^;]*persist\(/);
  });

  it('R14-RES-11: a run is asked again only for what moved, could not be read or retired a key — not for what was merely found', () => {
    expect(code(fn('async function bootEncryptedMessageHistory() {')))
      .toContain('if (moved && (Number(moved.moved ?? 0) > 0 || Number(moved.unreadable ?? 0) > 0)) noteLegacyStorageMoved();');
    const boot = code(fn('async function bootWalletScopedLocalStores() {'));
    const read = boot.indexOf('void syncPrivateCapsulesFromChainOnce({ forceIndexRescan: true })');
    expect(read).toBeGreaterThan(-1);
    expect(boot.indexOf('.then((result) => settleOwedReread(result, recoveryMark))'), 'MEASURED before: removed before the read began').toBeGreaterThan(read);
    expect(code(fn('function settleOwedReread(result, mark) {'))).toContain('if (result?.ok !== true || mark === null) return false;');
  });

  it('R14-RES-12: the boot guard waits a whole grace once the re-secure lets go — it does not fire at the first tick after', () => {
    const attributes = new Map<string, string>([['data-platho-boot-busy', '1'], ['data-platho-app-js', 'started']]);
    const timers: Array<{ run: () => void; ms: number }> = [];
    const node = () => ({ style: {}, appendChild() {}, addEventListener() {}, textContent: '', type: '', id: '' });
    const guard = lift({
      document: { documentElement: { getAttribute: (key: string) => attributes.get(key) ?? null }, body: { appendChild() {} } },
      setTimeout: (run: () => void, ms: number) => { timers.push({ run, ms }); return timers.length; },
      GRACE_MS: 6_000, styled: node, rememberBootError: () => {}, bootErrors: [], collectNetworkDiagnostics: () => [],
      navigator: { userAgent: 'gate' }, window: { location: { reload() {} } },
    }, [sourceBlock(bootGuard, 'function showGuard() {')], '{ showGuard, get fired() { return guardFired; } }', 'var guardFired = false; var busySeen = false;');
    guard.showGuard();
    expect(timers.at(-1)!.ms, 'busy: asked again in two seconds').toBe(2_000);
    attributes.delete('data-platho-boot-busy');
    timers.at(-1)!.run();
    expect(guard.fired, 'MEASURED before: "did not finish loading" over a healthy start (2 of 7)').toBe(false);
    expect(timers.at(-1)!.ms, 'a whole grace from now').toBe(6_000);
    attributes.set('data-platho-app-js', 'ready');
    timers.at(-1)!.run();
    expect(guard.fired).toBe(false);
    attributes.set('data-platho-app-js', 'started');
    guard.showGuard();
    expect(guard.fired).toBe(true);
  });

  it('R14-TDZ-01: what the start\'s first await runs reads no name declared below it', () => {
    const awaitAt = app.indexOf('\nawait resecureStorageIfDue();');
    expect(awaitAt).toBeGreaterThan(-1);
    const declared = new Map<string, number>();
    for (const match of app.matchAll(/^(?:const|let) ([A-Za-z_$][\w$]*)/gm)) if (!declared.has(match[1])) declared.set(match[1], match.index!);
    const late: string[] = [];
    for (const start of ['async function resecureStorageIfDue() {', 'function noteInterruptedResecure() {', 'async function runStorageResecureIfSafe() {',
      'function showStorageBusy(text) {', 'function sessionStorageOrNull() {', 'async function askStoragePersistence() {',
      'function holdPageDuringResecure(event) {', 'function holdStorageWindowLock() {', 'async function aloneAmongWindowsOfThisSite() {']) {
      const body = code(fn(start));
      const reads = body.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, "''");
      for (const [name, at] of declared) {
        if (at < awaitAt) continue;
        if (new RegExp(`(^|[^\\w$.])${name.replace(/\$/g, '\\$')}(?![\\w$])`).test(reads)) late.push(`${start.split('(')[0]}: ${name}`);
      }
    }
    expect(late, 'MEASURED before: the window wait\'s constants sat below the await — a ReferenceError inside the start').toEqual([]);
  });
});

describe('R14 a stranger\'s first contact cannot make a wallet pay more than a few writes a day — counted where the writes are signed', () => {
  it('R14-QUIET-01: 256 strangers in an hour: four writes in the first day, never more than four in any twenty-four hours', async () => {
    const DAY = 86_400_000;
    const world = quietWorld();
    const t0 = world.clock.now;
    for (let slot = 0; slot < 256; slot += 1) { world.clock.now = t0 + slot * 14_000; world.api.scheduleQuietRecoveryBackup(String(slot)); }
    await world.runUntil(t0 + DAY);
    expect(world.signed.length, 'MEASURED before: 256 writes in one run').toBe(4);
    expect(world.signed.map((write) => write.to)).toEqual([0, 1, 2, 3].map((slot) => `0:${slot.toString(16).padStart(64, '0')}`));
    await world.runUntil(t0 + 4 * DAY);
    const times = world.signed.map((write) => write.at).sort((a, b) => a - b);
    for (let at = 0; at < times.length; at += 1) {
      const inDay = times.filter((time) => time >= times[at] && time < times[at] + DAY).length;
      expect(inDay, `a day from ${times[at] - t0} ms`).toBeLessThanOrEqual(4);
    }
    expect(world.warnings).toEqual([]);
  });

  it('R14-QUIET-02: two windows of one wallet share the day — the record is read and written under the backup run\'s lock', async () => {
    const shared = quietShared();
    const one = quietWorld(shared);
    const two = quietWorld(shared);
    const t0 = shared.clock.now;
    for (let slot = 0; slot < 4; slot += 1) { one.api.noteRecoveryEntry(slot, t0 - 3_600_000); one.api.quiet.set(slot, t0 - 1_000); }
    for (let slot = 10; slot < 14; slot += 1) { two.api.noteRecoveryEntry(slot, t0 - 3_600_000); two.api.quiet.set(slot, t0 - 1_000); }
    one.api.promoteDueQuietRecoverySlots(t0);
    await one.runUntil(t0 + 60_000);
    two.api.promoteDueQuietRecoverySlots(t0 + 60_000);
    await two.runUntil(t0 + 120_000);
    expect(one.signed.length).toBe(4);
    expect(two.signed.length, 'MEASURED before: each window counted its own day in its own map — eight').toBe(0);
    const raw = [...shared.local.values()].join('');
    expect(Object.keys(JSON.parse([...shared.local.values()][0])).sort()).toEqual(['n', 'x']);
    expect(raw).not.toContain(String(t0).slice(0, 8));
  });

  it('R14-QUIET-03: the person\'s reply writes its own slot at once and spends nothing of the day; the run carries what the day has room for', async () => {
    const world = quietWorld();
    const t0 = world.clock.now;
    for (let slot = 0; slot < 20; slot += 1) world.api.scheduleQuietRecoveryBackup(String(slot));
    world.clock.now = t0 + 3_600_000;
    world.api.promoteQuietRecoverySlot('3');
    await world.runUntil(t0 + 3_600_000 + 120_000);
    expect(world.signed.map((write) => write.to), 'the reply\'s slot is written').toContain(`0:${(3).toString(16).padStart(64, '0')}`);
    expect(world.signed.length, 'MEASURED before: twenty writes — every pending quiet slot rode the reply').toBe(5);
    const spent = await world.api.readRecoveryQuietSpent(world.api.wallet, world.clock.now);
    expect(spent.length, 'four counted, the reply not').toBe(4);
    expect(spent.map((row: any) => row.slot)).not.toContain(3);
  });

  it('R14-QUIET-04: a stamp made under a clock that ran fast is dropped, not counted for a year', async () => {
    const world = quietWorld();
    const t0 = world.clock.now;
    await world.api.writeRecoveryQuietSpent(world.api.wallet, [0, 1, 2, 3].map((slot) => ({ at: t0 + 2 * 86_400_000, slot })));
    expect((await world.api.readRecoveryQuietSpent(world.api.wallet, t0)).length, 'MEASURED before: four stamps two days ahead held the budget for as long').toBe(0);
    await world.api.writeRecoveryQuietSpent(world.api.wallet, [0, 1].map((slot) => ({ at: t0 + 30 * 60_000, slot })));
    expect((await world.api.readRecoveryQuietSpent(world.api.wallet, t0)).length, 'within the slack, a stamp counts').toBe(2);
    for (let slot = 10; slot < 16; slot += 1) { world.api.noteRecoveryEntry(slot, t0 - 3_600_000); world.api.quiet.set(slot, t0 - 1_000); }
    world.api.promoteDueQuietRecoverySlots(t0);
    await world.runUntil(t0 + 60_000);
    expect(world.signed.length, 'two of the day already spent: two more').toBe(2);
  });
});

describe('R14 a dialog takes a press only if it began after the dialog was on screen', () => {
  it('R14-PRESS-01: a press under way before the dialog is not its press; a dialog no tap opened waits out its grace; assistive activation counts', () => {
    const accepted = lift({}, [line('const ACTION_DIALOG_UNPROMPTED_GRACE_MS = '), fn('function actionDialogPressAccepted(dialog, pressAt, now) {')], 'actionDialogPressAccepted');
    const t0 = 1_900_000_000_000;
    const tapped = { openedAt: t0, unprompted: false, submitClick: null };
    expect(accepted(tapped, t0 - 50, t0 + 100), 'MEASURED before: a press begun on the dialog this one replaced submitted it').toBe(false);
    expect(accepted(tapped, t0 + 10, t0 + 100)).toBe(true);
    const linked = { openedAt: t0, unprompted: true, submitClick: null };
    expect(accepted(linked, t0 + 300, t0 + 350), 'MEASURED before: the Unlock press made a link\'s "Pay and ask" count as tapped').toBe(false);
    expect(accepted(linked, t0 + 900, t0 + 950)).toBe(true);
    expect(accepted({ ...tapped, submitClick: { at: t0 + 40, detail: 0 } }, t0 - 5_000, t0 + 40)).toBe(true);
    expect(accepted({ ...tapped, submitClick: { at: t0 + 40, detail: 1 } }, t0 - 5_000, t0 + 40), 'a mouse click whose press came before').toBe(false);
    expect(accepted({ ...linked, submitClick: { at: t0 + 100, detail: 0 } }, 0, t0 + 100)).toBe(false);
    expect(accepted({ ...linked, submitClick: { at: t0 + 900, detail: 0 } }, 0, t0 + 900)).toBe(true);
    expect(accepted(null, t0, t0)).toBe(false);
  });

  it('R14-PRESS-02: while the grace runs the button says so; the press is captured window-wide from the first line; links and parked asks are "unprompted"', () => {
    const classes = new Set<string>();
    const attributes = new Map<string, string>();
    const timers: Array<() => void> = [];
    const button = { classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c) }, setAttribute: (k: string, v: string) => attributes.set(k, v), removeAttribute: (k: string) => attributes.delete(k) };
    const dialog = { unprompted: true };
    const arm = lift({ actionSubmitButton: button, setTimeout: (run: () => void) => { timers.push(run); }, activeActionDialog: dialog },
      [line('const ACTION_DIALOG_UNPROMPTED_GRACE_MS = '), fn('function armUnpromptedActionDialog(dialog) {')], 'armUnpromptedActionDialog');
    arm(dialog);
    expect([...classes], 'MEASURED before: nothing shown — a press in the grace was ignored without a word').toEqual(['is-arming']);
    expect(attributes.get('aria-disabled')).toBe('true');
    timers[0]();
    expect([...classes]).toEqual([]);
    expect(attributes.has('aria-disabled')).toBe(false);
    expect(readFileSync('web/styles.css', 'utf8')).toContain('#actionSubmitButton.is-arming {');
    expect(app.indexOf("for (const type of ['pointerdown', 'mousedown', 'touchstart', 'keydown'])")).toBeLessThan(app.indexOf('\nawait resecureStorageIfDue();'));
    const open = code(fn('async function openActionDialog(config = {}) {'));
    expect(open.indexOf('activeActionDialog.openedAt = Date.now();'), 'counted from the moment it is on screen').toBeGreaterThan(open.indexOf('actionDialog.hidden = false;'));
    expect(open).toContain('armUnpromptedActionDialog(activeActionDialog);');
    expect(code(app)).toContain('if (!actionDialogPressAccepted(activeActionDialog, lastActionPressAt, Date.now())) return;');
    expect(code(fn('async function hydrateGroupThreadsFromStore() {'))).toContain('requestGroupJoin(ask, null, { unprompted: true })');
    expect(code(app)).toContain('requestGroupJoin(ask, null, { unprompted: true })).catch(');
    expect((code(fn('async function requestGroupJoin(')).match(/\bunprompted,/g) ?? []).length, 'both of its dialogs').toBe(2);
    expect(code(fn('async function joinPublicGroup('))).toContain('unprompted: !button,');
    expect(code(fn('async function runGroupControlDialog('))).toContain('unprompted,');
  });
});

describe('R14 money', () => {
  it('R14-MONEY-01: the verdict is built and signed for the ledger it checked — a refresh that re-seats the runtime meanwhile moves nothing', async () => {
    const LEDGER = PLATHO_APP_CONFIG.moderationGate.ledgers[0];
    const signed: any[] = [];
    const runtime: any = { ledgerAddress: LEDGER, ledgerView: { entry_min_value: 14_730_002n, wallet_min_value: 8_780_002n, review_min_value: 7_580_002n } };
    const sendVerdict = lift({
      moderationRuntimeFor: () => runtime, plathoWallet: { address: '0:aa' }, verdictsInFlight: new Map(), moderationFlightHeld: () => false,
      showModerationStatus: () => {}, t: (key: string) => key, MODERATION_CONFIRM_MS: 1, MODERATION_SENDING_TTL_MS: 1, refreshModerationLedger: async () => {},
      moderationLedgerTrusted, VERDICT_ACTION, verdictMinimumCeiling, NETWORK_PRICES_PLAUSIBLE_RATIO: 10n, verdictLiveSurchargeNanotons,
      verdictNetworkPrices: async () => { runtime.ledgerAddress = `0:${'66'.repeat(32)}`; runtime.ledgerView = { ...runtime.ledgerView, entry_min_value: 1_014_730_002n }; return null; },
      buildVerdictMessage, assertWalletGramAtLeast: async () => {}, walletSendFeeReserveNanotons: () => 0n, globalThis: {},
      sendPlathoWalletTransaction: async (_wallet: any, { messages }: any) => { signed.push(...messages); return {}; },
      requireSameWallet: (wallet: any) => wallet, broadcastMayHaveLanded: () => false, awaitModerationEffect: async () => true,
      unconfirmedSendHoldUntil: () => 0, noteTonRpcRateLimit: () => false, console: { warn() {} },
    }, [fn('function refusalError('), fn('function refusalTextFor('), fn('function errorTextForPerson('), fn('async function sendVerdict({')], 'sendVerdict');
    await sendVerdict({ action: VERDICT_ACTION.HIDE_ENTRY, shard: `0:${'12'.repeat(32)}`, entryId: 5n });
    expect(signed.length).toBe(1);
    expect(Address.parse(signed[0].address).equals(Address.parse(LEDGER)), 'MEASURED before: 1,014,730,002 signed to an unlisted ledger').toBe(true);
    expect(BigInt(signed[0].amount), 'at the minimum it checked').toBe(14_730_002n);
  });

  it('R14-MONEY-02: two windows pressing "pay" for one room pay once — the second finds the first one\'s mark under the lock', async () => {
    const storage = new Map<string, string>();
    const localStorage = { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => { storage.set(k, v); } };
    const sent: string[] = [];
    const locks = new Map<string, Promise<unknown>>();
    const withAtRestLock = (name: string, run: () => Promise<any>) => {
      const before = locks.get(name) ?? Promise.resolve();
      const mine = before.then(() => run());
      locks.set(name, mine.catch(() => {}));
      return mine;
    };
    const window = () => lift({
      Date, localStorage, scopedStorageKey: (k: string) => `S:${k}`, TextEncoder, JSON,
      pendingGroupEntryPayments: new Map(),
      rawWalletAddress: (w: string) => w, bytesToHex: (b: Uint8Array) => Buffer.from(b).toString('hex'), globalThis,
      requirePlathoWalletAddress: () => 'WALLET', requireBasechainAddress: (v: string) => v,
      tonCell: { hexToBytes: (h: string) => Buffer.from(h, 'hex') },
      readGroupEntryPayment: async () => { await delay(20); return { paid: false }; },
      groupEntryShares: () => ({ owner: 5n, burn: 5n }), assertConnectedAthAtLeast: async () => {}, loadConnectedAthWalletAddress: async () => 'ATHW',
      priceGroupEntryLegs: async () => ({ values: null, topUp: null }), groupEntryPaymentMessages: () => [{ amount: '40000000' }], groupEntryQueryId: () => 1n,
      assertWalletGramAtLeast: async () => {}, walletSendFeeReserveNanotons: () => 0n,
      sendPlathoWalletTransaction: async () => { sent.push('legs'); return {}; }, requirePlathoWallet: () => ({}), requireSameWallet: (s: any) => s,
      broadcastMayHaveLanded: () => false, t: (k: string) => k, withAtRestLock,
    }, [
      line('const GROUP_ENTRY_PAYMENT_PENDING_MS'), line('const GROUP_ENTRY_PAYMENTS_PENDING_STORAGE_KEY'),
      fn('async function sha256Hex(bytes) {'), fn('async function groupEntryPaymentPendingKey(wallet, groupIdHex) {'),
      fn('function pendingGroupEntryPaymentMarks(now = Date.now()) {'), fn('function persistPendingGroupEntryPayments({ drop = null } = {}) {'),
      fn('async function payGroupEntry(runtime, pointer, held, options = {}) {'), fn('async function payGroupEntryLocked('),
    ], 'payGroupEntry');
    const runtime = { memberKeyFor: async () => new Uint8Array(32) };
    const pointer = { groupId: 'ab'.repeat(32), ownerWallet: 'OWNER', entryFee: '10' };
    const outcomes = await Promise.all([window()(runtime, pointer, null), window()(runtime, pointer, null)]);
    expect(sent, 'MEASURED before: the mark was read first and written after the reads — both windows paid').toEqual(['legs']);
    expect(outcomes).toEqual([{ alreadyPaid: false }, { alreadyPaid: true }]);
  });

  it('R14-CLOCK-01: a chain clock days off is believed when the site\'s own server agrees; the person is told when nothing does', async () => {
    const now = Date.now();
    const days = (n: number) => n * 86_400_000;
    noteChainTime(now / 1000, now);
    expect(noteChainTime((now + days(5)) / 1000, now), 'alone, five days are not believed').toBe(0);
    expect(noteChainTime((now + days(5)) / 1000, now, { vouchedOffsetMs: days(5) + 60_000 }), 'MEASURED before: never — every signature then expired').toBe(days(5));
    noteChainTime(now / 1000, now);
    expect(noteChainTime((now + days(5)) / 1000, now, { vouchedOffsetMs: 0 }), 'a server that disagrees vouches for nothing').toBe(0);
    expect(noteChainTime((now + days(20 * 365)) / 1000, now, { vouchedOffsetMs: days(20 * 365) }), 'nor past ten years').toBe(0);
    const told: string[] = [];
    const notes: Array<{ seconds: number; vouched: number | null }> = [];
    const refresh = (server: number | null, lead: number) => {
      let clock = now;
      return lift({
        Date: { now: () => clock }, noteTonRpcRateLimit: () => false, console: { warn() {} }, t: (key: string, vars: any) => `${key}:${vars?.days}`,
        flashWalletIdentityStatus: (text: string) => told.push(text), siteServerClockOffsetMs: async () => server,
        noteChainTime: (seconds: number, at: number, options: any = {}) => { notes.push({ seconds, vouched: options.vouchedOffsetMs ?? null }); return noteChainTime(seconds, at, options); },
        globalThis: { plathoWalletRpcTransport: { getMasterchainInfo: async () => ({ last: { gen_utime: Math.floor((clock + lead) / 1000) } }) } },
        walletClockInDoubt: () => false,
      }, [line('const WALLET_CLOCK_BELIEVED_ALONE_MS'), line('const WALLET_CLOCK_VOUCH_TOLERANCE_MS'), fn('async function refreshWalletChainClock({ force = false } = {}) {')],
      'refreshWalletChainClock', 'const WALLET_CHAIN_CLOCK_REFRESH_MS = 30 * 60_000; let walletChainClockReadAt = -Infinity; let walletChainClockRetryAttempt = 0;');
    };
    noteChainTime(now / 1000, now);
    await refresh(days(5) + 30_000, days(5))();
    expect(Math.abs(walletChainClockOffsetMs() - days(5))).toBeLessThan(2_000);
    expect(told, 'believed: nothing to say').toEqual([]);
    noteChainTime(now / 1000, now);
    await refresh(null, days(5))();
    expect(told, 'MEASURED before: nothing said, and every send refused').toEqual(['wallet.deviceClockOff:5']);
    expect(walletChainClockOffsetMs()).toBe(0);
    told.length = 0;
    await refresh(5_000, days(5))();
    expect(told, 'the device keeps the site\'s time: the node is the one off, and the device is not blamed').toEqual([]);
    expect(walletChainClockOffsetMs()).toBe(0);
    expect(code(fn('async function siteServerClockOffsetMs({ timeoutMs = 8_000 } = {}) {'))).toContain("response.headers.get('Date')");
    noteChainTime(now / 1000, now);
  });

  it('R14-MONEY-03: a node\'s answer refused is worded for the person, never the check\'s English', async () => {
    const owner = `0:${'ab'.repeat(32)}`;
    const provider = createAthMasterTonRpcProvider({
      athMasterAddress: PLATHO_APP_CONFIG.ath.masterAddress,
      transport: { runGetMethod: async () => ({ ok: true, exit_code: 0, stack: [{ type: 'slice', value: encodeTonAddressSliceBoc(`0:${'66'.repeat(32)}`) }] }) },
    });
    const refused: any = await provider.getWalletAddress(owner).catch((error: any) => error);
    expect(refused.code).toBe('PLATHO_NODE_ANSWER_REFUSED');
    const words = lift({ t: (key: string, vars: any) => (vars ? `${key}(${JSON.stringify(vars)})` : key) },
      [fn('function refusalError('), fn('function refusalTextFor('), fn('function errorTextForPerson('), fn('function shortUiErrorText(')],
      '{ refusalError, refusalTextFor, errorTextForPerson, shortUiErrorText }');
    expect(words.shortUiErrorText(refused), 'MEASURED before: "...initOf ATHWallet..." in English, a raw address in it').toBe('errors.nodeAnswerRefused');
    expect(words.errorTextForPerson(words.refusalError('PLATHO_LEDGER_UNKNOWN', 'english'))).toBe('moderation.ledgerUnknown');
    expect(words.errorTextForPerson(new Error('plain'))).toBe('plain');
    expect(code(app)).toContain("const message = refusalTextFor(error) ?? String(error?.avatarDiagnosticStatus ?? error?.message ?? t('avatar.blocked'));");
    for (const locale of I18N_LOCALES) {
      const strings = (I18N_STRINGS as any)[locale.code ?? locale];
      for (const key of ['errors.nodeAnswerRefused', 'moderation.ledgerUnknown', 'storage.resecureWaiting', 'chat.safetyCodeLocked', 'wallet.deviceClockOff']) {
        expect(typeof strings?.[key], `${locale.code ?? locale}: ${key}`).toBe('string');
      }
      expect(strings['wallet.deviceClockOff']).toContain('{days}');
    }
  });
});

describe('R14 Telegram and the screens', () => {
  it('R14-UX-02: the focus goes back to an opener a popover hid, and the quick start and the card keep Tab inside them', () => {
    const open = code(fn('async function openActionDialog(config = {}) {'));
    expect(open).toContain('(config.returnFocus instanceof HTMLElement ? config.returnFocus : null)');
    expect(code(fn('function showProfileCardMoreMenu(raw, own, anchor) {'))).toContain('showConversationSafetyCode(raw, { returnFocus: anchor })');
    expect(code(fn('async function showConversationSafetyCode(raw, { returnFocus = null } = {}) {'))).toContain('returnFocus,');
    expect((code(app).match(/holdPageBehindModal\(quickStartDialog\);/g) ?? []).length, 'MEASURED before: Tab left the quick start for the page under it').toBeGreaterThanOrEqual(3);
    expect(code(fn('function closeQuickStart('))).toContain('releaseModalHold(quickStartDialog);');
    expect(code(fn('async function openProfileCardDialog('))).toContain('holdPageBehindModal(profileCardDialog);');
  });
});

describe('R14 what the unlock costs', () => {
  it('R14-CACHE-01: many entries go in one transaction with the cap enforced once — the newest kept', async () => {
    const factory = new IDBFactory();
    const keys = (await generateRandomAtRestKeys()).caches;
    const entries = Array.from({ length: 1_000 }, (_, i) => [`0:${i.toString(16).padStart(64, '0')}`, JSON.stringify({ profileVersion: 1, checkedAt: i })] as [string, string]);
    const opened = await openSealedCacheStores({ dbName: 'r14-cache', keys, namespaces: { facePointers: 4_000 }, indexedDB: factory });
    const transactions = vi.spyOn(IDBDatabase.prototype, 'transaction');
    const counts = vi.spyOn(IDBObjectStore.prototype, 'count');
    await opened.stores.facePointers.putMany(entries);
    expect(transactions.mock.calls.filter((call) => call[1] === 'readwrite').length, 'MEASURED before: two per pointer — 4,000 took 8.8 s at the unlock').toBeLessThanOrEqual(2);
    expect(counts.mock.calls.length, 'one count of the store, not one a pointer').toBeLessThanOrEqual(1);
    transactions.mockRestore();
    counts.mockRestore();
    expect((await opened.stores.facePointers.getAll()).size).toBe(1_000);
    await opened.close();
    const small = await openSealedCacheStores({ dbName: 'r14-cache-small', keys, namespaces: { facePointers: 300 }, indexedDB: factory });
    await small.stores.facePointers.putMany(entries);
    const kept = await small.stores.facePointers.getAll();
    expect(kept.size).toBe(300);
    expect(kept.has(entries[999][0]) && !kept.has(entries[0][0]), 'the batch\'s last are its newest').toBe(true);
    await small.close();
    const memory = createMemoryCacheStore({ cap: 3 });
    await memory.putMany(entries.slice(0, 5));
    expect([...(await memory.getAll()).keys()]).toEqual(entries.slice(2, 5).map(([key]) => key));
  });

  it('R14-CACHE-02: the face pointers are written off the way to the first face, and the clear copies go only once that write has landed', async () => {
    const WALLET = `0:${'aa'.repeat(32)}`;
    const OTHER = `0:${'bb'.repeat(32)}`;
    const prefix = `${line('const PROFILE_AVATAR_POINTER_STORAGE_PREFIX').match(/'([^']+)'/)![1]}:dep:`;
    const local = memoryStorage({ [`${prefix}${OTHER}`]: JSON.stringify({ profileVersion: 2, avatarHash: '0x01', checkedAt: 7 }), [`${prefix}${WALLET}`]: JSON.stringify({ profileVersion: 1 }) });
    let land: () => void = () => {};
    const batches: any[] = [];
    const moved: string[] = [];
    const wallet = { address: WALLET };
    const store = { type: 'sealed-indexeddb', getAll: async () => new Map(), putMany: (list: any[]) => { batches.push(list); return new Promise<void>((resolve) => { land = resolve; }); } };
    const load = lift({
      deviceCacheStore: async () => store, plathoWallet: wallet, localStorageOrNull: () => local, PROFILE_AVATAR_POINTER_STORAGE_PREFIX: prefix.split(':')[0],
      deploymentStorageSuffix: () => 'dep', sameWalletAddress: (a: string, b: string) => a === b, rawWalletAddress: (a: string) => a,
      noteLegacyStorageMoved: () => moved.push('noted'), markStorageResecureDue: () => moved.push('due'),
    }, [fn('function walletPointerKey(owner) {'), fn('async function loadFacePointers(wallet) {')], '{ loadFacePointers, pointers: walletPointers }',
    'const walletPointers = { wallet: null, map: new Map() };');
    await load.loadFacePointers(wallet);
    expect(load.pointers.map.get(OTHER)?.profileVersion, 'memory answers every face from here').toBe(2);
    expect(batches.length, 'one batch').toBe(1);
    expect(local.getItem(`${prefix}${OTHER}`), 'MEASURED before: removed before the sealed copy was written — a close in between lost both').not.toBeNull();
    land();
    await delay(5);
    expect(local.getItem(`${prefix}${OTHER}`)).toBeNull();
    expect(local.getItem(`${prefix}${WALLET}`), 'the own pointer stays where it was').not.toBeNull();
    expect(moved).toEqual(['noted', 'due']);
    expect(code(fn('async function handOverPlainCaches(wallet) {'))).toContain('await sealed.putMany(records.map((record) => [record.hash, record.url, { rankAt: spec.ranked ? record.rank : null }]))');
  });

  it('R14-CACHE-03: locked, a face is not read from the chain; at the unlock the device\'s faces and pictures are warmed again, and the All copy read again', async () => {
    const loader = code(fn('async function loadProfileAvatarImage(ownerWallet, pointer = null, { background = false, stillWanted = null, requestClass = \'profile\' } = {}) {'));
    expect(loader.indexOf('if (walletLockedOnDevice()) return null;'), 'MEASURED before: three keyless reads a face behind the unlock prompt').toBeGreaterThan(-1);
    expect(loader.indexOf('if (walletLockedOnDevice()) return null;')).toBeLessThan(loader.indexOf('enqueueAvatarChainRead('));
    const boot = code(fn('async function bootWalletScopedLocalStores() {'));
    expect(boot.indexOf('if (wallet) void warmPublicMediaAfterUnlock(wallet);')).toBeGreaterThan(boot.indexOf('await loadWalletSets(wallet);'));
    const painted: string[] = [];
    const wallet = { address: 'w' };
    const make = (found: boolean, current: any) => lift({
      warmPublicChannelAvatarsFromCache: async () => found, warmPublicPostImagesFromCache: async () => false, plathoWallet: current,
      rebuildThreadsFromPublicSubscriptions: () => painted.push('rebuild'), renderThreads: () => painted.push('threads'), renderConversation: () => painted.push('conversation'),
    }, [fn('async function warmPublicMediaAfterUnlock(wallet) {')], 'warmPublicMediaAfterUnlock');
    expect(await make(true, wallet)(wallet)).toBe(true);
    expect(painted).toEqual(['rebuild', 'threads', 'conversation']);
    expect(await make(true, { address: 'other' })(wallet)).toBe(false);
    let reads = 0;
    let type = 'memory';
    const restore = lift({
      publicAllFeedStore: async () => ({ type, getAll: async () => { reads += 1; return new Map(); } }), publicAllFeedMediaStore: async () => null,
      publicAllFeedRecords: new Map(), publicAllFeedRecordFromText: () => null, publicPostCacheKey: () => null, applyPublicPostMediaRecord: () => false,
      publicAllFeedMediaSaved: new Set(), warmAvatarsFromDevice: async () => false, publicDiscoveryOpen: false, repaintPublicDiscovery: () => {}, console: { warn() {} },
    }, [fn('function restorePublicAllFeed() {')], 'restorePublicAllFeed', 'let publicAllFeedRestore = null; let publicAllFeedRestored = false;');
    await restore();
    await restore();
    expect(reads, 'MEASURED before: the memory store\'s empty answer kept — the first pass after the unlock read every channel cold').toBe(2);
    type = 'sealed-indexeddb';
    await restore();
    await restore();
    expect(reads, 'read from the device: kept').toBe(3);
  });

  it('R14-GUARD-01: a first contact adds a small part beside the INTRO replay guard\'s set — the set is written again only at the fold', async () => {
    const factory = new IDBFactory();
    const sealKey = (await generateRandomAtRestKeys()).introLedger.seal;
    const dbName = 'r14-guard';
    const nonces = Array.from({ length: 5_000 }, (_, i) => `n${String(i).padStart(21, '0')}`);
    const sealed = await sealAtRest(sealKey, { domain: 'PLATHO.INTRO.REPLAY.SEAL.V2', value: { nonces }, padTo: 1024 });
    const db: any = await new Promise((resolve, reject) => {
      const request = factory.open(dbName, 1);
      request.onupgradeneeded = () => { request.result.createObjectStore('privateCapsuleReplay', { keyPath: 'id' }).createIndex('expiresAt', 'expiresAt'); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const seed = db.transaction('privateCapsuleReplay', 'readwrite');
    seed.objectStore('privateCapsuleReplay').put({ id: 'sealed.v2', n: sealed.n, x: sealed.x });
    await new Promise((resolve) => { seed.oncomplete = resolve; });
    db.close();
    const guard = await createSealedReplayGuard({ dbName, sealKey, indexedDB: factory });
    const rows = () => rawEntries(factory, dbName, 'privateCapsuleReplay');
    const set = (await rows()).find((row) => row.key === 'sealed.v2')!.value;
    expect(set.x.length).toBeGreaterThan(100_000);
    await guard.add('nonce-of-a-new-contact');
    const after = await rows();
    expect(Buffer.from(after.find((row) => row.key === 'sealed.v2')!.value.x).equals(Buffer.from(set.x)), 'MEASURED before: the whole set written again at every first contact (3.26 MB at 100,000)').toBe(true);
    const parts = after.filter((row) => String(row.key).startsWith('sealed.v2.part.'));
    expect(parts.length).toBe(1);
    expect(parts[0].value.x.length, 'a padded kilobyte').toBeLessThan(2_100);
    const reads = vi.spyOn(IDBObjectStore.prototype, 'getAllKeys');
    await Promise.all(Array.from({ length: 40 }, (_, i) => guard.add(`burst-${i}`)));
    expect(reads.mock.calls.length, 'a write each: forty reads of every part').toBeLessThanOrEqual(2);
    reads.mockRestore();
    expect((await rows()).filter((row) => String(row.key).startsWith('sealed.v2.part.')).length).toBeLessThanOrEqual(3);
    for (let i = 0; i < 40; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await guard.add(`one-by-one-${i}`);
    }
    expect((await rows()).filter((row) => String(row.key).startsWith('sealed.v2.part.')).length, 'folded').toBeLessThan(32);
    const reopened = await createSealedReplayGuard({ dbName, sealKey, indexedDB: factory });
    for (const nonce of ['n000000000000000000000', `n${String(4_999).padStart(21, '0')}`, 'nonce-of-a-new-contact', 'burst-39', 'one-by-one-39']) {
      expect(await reopened.has(nonce), nonce).toBe(true);
    }
    expect(await reopened.has('never-seen')).toBe(false);
  });
});

describe('R14 the history\'s one-time rewrite', () => {
  const message = (id: string, at: number) => ({ id, threadId: 'wallet:0:aa', createdAt: at, thread: null, message: { type: 'out', text: id } });
  async function olderStore(dbName: string, threads: Record<string, number>) {
    const factory = new IDBFactory();
    const keys = (await generateRandomAtRestKeys()).history;
    const first: any = await createIndexedDbEncryptedMessageHistoryStore({ dbName, keys, indexedDB: factory, IDBKeyRange });
    await first.putMessage(message('seed', 1));
    await first.close?.();
    const old: any[] = [];
    for (const [threadId, count] of Object.entries(threads)) {
      const tag = await conversationTag(keys, threadId);
      for (let i = 0; i < count; i += 1) {
        const id = `${threadId}-${i}`;
        // eslint-disable-next-line no-await-in-loop
        const sealed = await sealAtRest(keys.seal, {
          domain: 'PLATHO.LOCAL.MESSAGE_HISTORY.V2', aad: { v: 2, id, t: tag, c: null },
          value: { v: 2, threadId, createdAt: 1_000 + i, type: 'out', capsuleId: null, thread: null, message: { type: 'out', text: id } }, padTo: 256,
        });
        old.push({ id, v: 2, t: tag, o: i, n: sealed.n, x: sealed.x });
      }
    }
    const db: any = await requestToPromise(factory.open(dbName));
    const write = db.transaction(['encryptedMessages', 'historyKeys'], 'readwrite');
    write.objectStore('encryptedMessages').clear();
    for (const record of old) write.objectStore('encryptedMessages').put(record);
    write.objectStore('historyKeys').delete('headers-rewritten-v1');
    await new Promise((resolve, reject) => { write.oncomplete = resolve; write.onerror = () => reject(write.error); });
    db.close();
    return { factory, keys };
  }

  it('R14-HIST-01: a store the move filled, and a fresh one, are marked done at the open — nothing is rewritten again', async () => {
    const factory = new IDBFactory();
    const keys = (await generateRandomAtRestKeys()).history;
    const store: any = await createIndexedDbEncryptedMessageHistoryStore({ dbName: 'r14-hist-01', keys, indexedDB: factory, IDBKeyRange });
    await store.putMessage(message('m-1', 1_000));
    const getAll = vi.spyOn(IDBIndex.prototype, 'getAll');
    expect(await store.rewriteHeadersOnce(), 'MEASURED before: every record the move had just written, written again (20,000: 3.7 s)').toBe(0);
    expect(getAll.mock.calls.length, 'and nothing read').toBe(0);
    expect((await rawEntries(factory, 'r14-hist-01', 'historyKeys')).map((row) => row.key)).toContain('headers-rewritten-v1');
  });

  it('R14-HIST-02: a pass cut short goes on where it stopped — a conversation done is not done again', async () => {
    const { factory, keys } = await olderStore('r14-hist-02', { 'wallet:0:aa': 4, 'wallet:0:bb': 3 });
    const tagA = await conversationTag(keys, 'wallet:0:aa');
    const db: any = await requestToPromise(factory.open('r14-hist-02'));
    const write = db.transaction('historyKeys', 'readwrite');
    write.objectStore('historyKeys').put({ id: `headers-rewritten-v1:${tagA}` });
    await new Promise((resolve) => { write.oncomplete = resolve; });
    db.close();
    const store: any = await createIndexedDbEncryptedMessageHistoryStore({ dbName: 'r14-hist-02', keys, indexedDB: factory, IDBKeyRange });
    expect(await store.rewriteHeadersOnce(), 'MEASURED before: cut at 44,000 of 100,000, the next pass rewrote all 100,023').toBe(3);
    const records = (await rawEntries(factory, 'r14-hist-02', 'encryptedMessages')).map((row) => row.value);
    expect(records.filter((record) => record.t === tagA).map((record) => record.o).sort(), 'the done one untouched').toEqual([0, 1, 2, 3]);
    expect(await store.rewriteHeadersOnce(), 'and the store is done').toBe(0);
  });

  it('R14-HIST-03: another window\'s message written during the rewrite is read again — it stays the newest', async () => {
    const { factory, keys } = await olderStore('r14-hist-03', { 'wallet:0:aa': 12 });
    const a: any = await createIndexedDbEncryptedMessageHistoryStore({ dbName: 'r14-hist-03', keys, indexedDB: factory, IDBKeyRange });
    const extra = await sealMessageHistoryRecord(keys, { id: 'from-the-other-window', threadId: 'wallet:0:aa', createdAt: 9_999, thread: null, message: { type: 'out', text: 'x' } }, { order: 12 });
    const other: any = await requestToPromise(factory.open('r14-hist-03'));
    const original = IDBIndex.prototype.getAll;
    let landed: Promise<unknown> | null = null;
    vi.spyOn(IDBIndex.prototype, 'getAll').mockImplementation(function (this: any, ...args: any[]) {
      if (landed === null) {
        const write = other.transaction('encryptedMessages', 'readwrite');
        write.objectStore('encryptedMessages').put(extra);
        landed = new Promise((resolve) => { write.oncomplete = resolve; });
      }
      return (original as any).apply(this, args);
    });
    const rewritten = await a.rewriteHeadersOnce();
    await landed;
    vi.restoreAllMocks();
    other.close();
    expect(rewritten, 'read again, with the new message in it').toBe(13);
    const listed = await a.listMessages({ threadId: 'wallet:0:aa' });
    expect(listed.at(-1).id, 'MEASURED before: it kept a position from the old numbering and dropped to the bottom (4 of 12)').toBe('from-the-other-window');
    expect(code(readFileSync('web/encrypted-message-store.mjs', 'utf8'))).toContain('if (!closing && !unfinished) await backend.writeMark(HEADERS_REWRITTEN_MARK);');
  });

  it('R15-REWRITE-01: another window\'s update of a record in place, between the read and the write, is read again — not overwritten [F1-6]', async () => {
    const { factory, keys } = await olderStore('r15-rewrite-01', { 'wallet:0:aa': 12 });
    const a: any = await createIndexedDbEncryptedMessageHistoryStore({ dbName: 'r15-rewrite-01', keys, indexedDB: factory, IDBKeyRange });
    const updated = await sealMessageHistoryRecord(keys, { id: 'wallet:0:aa-5', threadId: 'wallet:0:aa', createdAt: 1_005, thread: null, message: { type: 'out', text: 'updated by the other window' } }, { order: 5 });
    const other: any = await requestToPromise(factory.open('r15-rewrite-01'));
    const original = IDBIndex.prototype.getAll;
    let landed: Promise<unknown> | null = null;
    vi.spyOn(IDBIndex.prototype, 'getAll').mockImplementation(function (this: any, ...args: any[]) {
      if (landed === null) {
        const write = other.transaction('encryptedMessages', 'readwrite');
        write.objectStore('encryptedMessages').put(updated);
        landed = new Promise((resolve) => { write.oncomplete = resolve; });
      }
      return (original as any).apply(this, args);
    });
    await a.rewriteHeadersOnce();
    await landed;
    vi.restoreAllMocks();
    other.close();
    const listed = await a.listMessages({ threadId: 'wallet:0:aa' });
    expect(listed.find((item: any) => item.id === 'wallet:0:aa-5')?.message?.text, 'MEASURED before: the ids alone matched — the copy read before it was written over the update')
      .toBe('updated by the other window');
  });
});

describe('R14 the wallet\'s small records', () => {
  it('R14-SETS-01: what the map owes is written as the page goes away — through the stores a lock closes only after it — and a reload waits for the lock\'s last writes', async () => {
    const puts: Array<[string, string]> = [];
    const W = { address: 'w' };
    const held = { wallet: W, opened: Promise.resolve({ stores: { walletSets: { get: async () => null, put: async (key: string, value: string) => { puts.push([key, value]); } } } }) };
    const cleared: number[] = [];
    const flush = lift({
      deviceCacheSealed: held, plathoLocalDataClearing: false, WALLET_LOCAL_RECORD: 'local', WALLET_LOCAL_CONTENT_RECORD: 'local-content', PERSONAL_PUBLIC_SEALED_PREFIX: 'public:',
      PUBLIC_CHANNEL_FEED_CACHE_KEY: 'platho.publicChannelFeeds.v1', PUBLIC_CHANNEL_PROFILE_CACHE_KEY: 'platho.publicChannelProfiles.v1',
      clearTimeout: (id: number) => cleared.push(id), console: { warn() {} }, W, globalThis: {}, localStorageOrNull: () => null,
      bytesToHex: () => 'ab', randomBytes: () => new Uint8Array(8),
    }, [fn('function walletLocalRecordOf(key) {'), line('const WALLET_LOCAL_TOMBSTONE_KEEP_MS = '), line('const WALLET_LOCAL_CHANGED_PING_KEY = '),
      fn('function walletLocalRecordEntries(record) {'), fn('function parseWalletLocalEntries(text) {'), fn('function foldWalletLocalEntries(stored, ours) {'),
      fn('async function withWalletLocalWriteLock(task) {'), fn('function pingWalletLocalWindows() {'), fn('async function writeOwedWalletLocal(store, records) {'),
      fn('function flushWalletLocalNow() {')],
    '{ flushWalletLocalNow, walletLocal }', 'const walletLocal = { wallet: W, values: new Map([["publicRoomIds", "[\\"g1\\"]"]]), stamps: new Map([["publicRoomIds", 5]]), timer: 7, dirty: new Set() };');
    flush.flushWalletLocalNow();
    await delay(1);
    expect(puts, 'MEASURED before: a 1.5 s timer — a phone that ended the hidden page lost it').toEqual([['local', JSON.stringify([['publicRoomIds', '["g1"]', 5]])]]);
    expect(cleared).toEqual([7]);
    expect(flush.walletLocal.timer).toBeNull();
    flush.flushWalletLocalNow();
    await delay(1);
    expect(puts.length, 'nothing owed, nothing written').toBe(1);
    const hidden = app.slice(app.indexOf("document.addEventListener('visibilitychange', () => {\n  if (document.hidden) {"));
    expect(code(hidden.slice(0, hidden.indexOf('} else {')))).toContain('flushWalletLocalNow();');
    const pagehide = app.slice(app.indexOf("window.addEventListener('pagehide', () => {"));
    expect(code(pagehide.slice(0, pagehide.indexOf('\n});')))).toContain('flushWalletLocalNow();');
    let reloads = 0;
    let land: () => void = () => {};
    const closing = new Promise<void>((resolve) => { land = resolve; });
    const reloadFor = (held: Promise<void> | null) => lift({
      pendingServiceWorkerAppShellReload: true, deviceCachesClosing: held, delay: () => new Promise(() => {}), window: { location: { reload: () => { reloads += 1; } } },
    }, [fn('function reloadForPendingServiceWorkerAppShellUpdate() {')], 'reloadForPendingServiceWorkerAppShellUpdate');
    expect(reloadFor(closing)()).toBe(true);
    await delay(1);
    expect(reloads, 'MEASURED before: the reload cut the lock\'s write of the sealed map off').toBe(0);
    land();
    await delay(1);
    expect(reloads, 'once it has landed').toBe(1);
    reloadFor(null)();
    expect(reloads, 'nothing closing: at once').toBe(2);
    expect(code(fn('function reloadForPendingServiceWorkerAppShellUpdate() {'))).toContain('delay(2_000)');
    expect(code(fn('function forgetDeviceCaches() {'))).toContain('deviceCachesClosing = closing;');
    const loadLocal = code(fn('async function loadWalletLocal(wallet) {'));
    const sealedWrite = loadLocal.indexOf('void writeWalletLocalRecords(store, wallet, [WALLET_LOCAL_RECORD, WALLET_LOCAL_CONTENT_RECORD])');
    expect(sealedWrite, 'both sealed records are written before').toBeGreaterThan(-1);
    expect(loadLocal.indexOf('storage.removeItem(plainKey)'), 'MEASURED before: removed before the sealed write was even asked for').toBeGreaterThan(sealedWrite);
  });
});

describe('R14 money-3: a vault deploy whose external has not been seen to run is not a vault yet', () => {
  const W = { address: `0:${'ab'.repeat(32)}` };
  const chainAt = (start: number) => {
    let seqno = start;
    return { advance: () => { seqno += 1; }, transport: { runGetMethod: async () => ({ stack: [{ type: 'num', value: `0x${seqno.toString(16)}` }] }), sendBoc: async () => ({ ok: true }) } };
  };

  it('R14-M3-01: the wallet tells what became of an external — consumed once the chain is past it, expired once its deadline is behind', async () => {
    const nowS = Math.floor(Date.now() / 1000);
    expect(await awaitWalletExternalOutcome(W, chainAt(8).transport, { seqno: 7, validUntil: nowS + 300 }, { seqnoPollMs: 0 })).toBe('unverified');
    expect(await awaitWalletExternalOutcome(W, chainAt(7).transport, { seqno: 7, validUntil: nowS - Math.ceil(WALLET_EXTERNAL_DEATH_GRACE_MS / 1000) - 10 }, { seqnoPollMs: 0 })).toBe('expired');
    const late = chainAt(7);
    let reads = 0;
    const counting = { ...late.transport, runGetMethod: async (call: any) => { reads += 1; if (reads === 3) late.advance(); return late.transport.runGetMethod(call); } };
    expect(await awaitWalletExternalOutcome(W, counting, { seqno: 7, validUntil: nowS + 300 }, { seqnoPollMs: 0 }), 'run on the third look').toBe('unverified');
    await expect(awaitWalletExternalOutcome(W, chainAt(7).transport, { seqno: null } as any)).rejects.toThrow(/seqno/);
    expect(code(readFileSync('web/platho-wallet.mjs', 'utf8'))).toContain('if (Number(pendingWalletExternal(wallet)?.seqno ?? -1) < targetSeqno) clearPendingWalletExternal(wallet);');
  });

  it('R14-M3-02: the next routing asks what became of it — dead, it deploys the vault itself; run, it trusts the vault', async () => {
    const make = () => {
      let settle: (outcome: string) => void = () => {};
      const asked: any[] = [];
      const api = lift({
        plathoWallet: W, globalThis: { plathoTonRpcTransport: {} }, Date,
        vaultSupported: () => true, boundedFeeVaultRoutingRead: async () => {}, vaultAddressFor: async () => '0:vault', ownVaultFeeDue: () => 0n,
        messageNetworkPrices: async () => null, FV_FLOAT_TOPUP_BELOW: 1n, FV_PROTOCOL_FEE: 10n, VAULT_LIVE: 'live', VAULT_ABSENT: 'absent',
        VAULT_FROZEN: 'frozen',
        vaultSnapshot: (view: any, { nowSec = 0 } = {}) => ({ state: view ? 'live' : 'absent', balance: 0n, staked: 0n, feeDue: 10n, nowSec }),
        vaultClock: () => ({ nowSec: Math.floor(Date.now() / 1000) }),
        walletExternalSignedFields: () => null, setTimeout, clearTimeout, walletChainNowMs: () => Date.now(),
        awaitWalletExternalOutcome: (_wallet: any, _transport: any, from: any) => { asked.push(from); return new Promise((resolve) => { settle = resolve as any; }); },
      }, [line('const VAULT_SNAPSHOT_MAX_AGE_S = '), line('const VAULT_DEPLOY_SETTLE_MS = '), fn('function vaultSnapshotOutdated() {'),
        line('const FEE_VAULT_DEPLOY_WAIT_MS = '), line('let feeVaultDeployFlight = null;'), fn('function openFeeVaultDeployFlight(wallet) {'),
        fn('function settleFeeVaultDeployFlight('), fn('async function feeVaultDeployCarriedElsewhere(wallet) {'), fn('function convVaultStateUnknownError() {'), fn('function convVaultFrozenError() {'),
        fn('function noteFeeVaultDeployed('), fn('function unconfirmedExternalOf(source) {'), line('let unconfirmedVaultDeploy = null;'),
        fn('async function settleUnconfirmedVaultDeploy(wallet) {'), fn('async function convVaultRouting() {'),
        app.slice(app.indexOf('async function acquireVaultDeployLock(wallet) {'), app.indexOf('async function watchVaultDeployAcrossWindows(wallet) {')) + fn('async function watchVaultDeployAcrossWindows(wallet) {')],
      '{ noteFeeVaultDeployed, convVaultRouting, unconfirmedExternalOf, get state() { return feeVaultState; } }',
      'let feeVaultState = { wallet: null, address: null, snapshot: null };');
      return { api, asked, settle: (outcome: string) => settle(outcome) };
    };
    const nowS = Math.floor(Date.now() / 1000);
    const dead = make();
    dead.api.noteFeeVaultDeployed(W.address, '0:vault', null, { unconfirmed: { seqno: 7, validUntil: nowS + 300 } });
    const routing = dead.api.convVaultRouting();
    await delay(5);
    expect(dead.asked).toEqual([{ seqno: 7, validUntil: nowS + 300, boc: null }]);
    dead.settle('expired');
    expect((await routing).deployVault, 'MEASURED before: false — signed without the deploy, its envelope bounced (5,188,272 a 1 KB part)').toBe(true);
    const ran = make();
    ran.api.noteFeeVaultDeployed(W.address, '0:vault', null, { unconfirmed: { seqno: 7, validUntil: nowS + 300 } });
    const second = ran.api.convVaultRouting();
    await delay(5);
    ran.settle('consumed');
    expect((await second).deployVault).toBe(false);
    expect(ran.api.state.snapshot.assumedFrom).toBeNull();
    expect(ran.api.unconfirmedExternalOf({ batchCount: 2, pendingSeqno: 9, pendingValidUntil: nowS })).toBeNull();
    expect(ran.api.unconfirmedExternalOf({ batchCount: 1, pendingSeqno: 9, pendingValidUntil: nowS })).toEqual({ seqno: 9, validUntil: nowS, boc: null });
    expect(ran.api.unconfirmedExternalOf({ builtSeqno: 4, builtValidUntil: nowS, builtBoc: 'x' })).toEqual({ seqno: 4, validUntil: nowS, boc: 'x' });
    expect((code(app).match(/noteFeeVaultDeployed\([^;]*\{ unconfirmed: unconfirmedExternalOf\(/g) ?? []).length, 'six notes: the group send, the private funnel, the stake').toBe(6);
  });
});

describe('R14 the re-secure carries what it can fetch again — and asks for no second run', () => {
  it('R14-RETIRE-01: a retired device key asks for no run of its own; a move and a drop still do', () => {
    for (const file of ['web/conv-key-persist.mjs', 'web/group-record-store.mjs', 'web/device-secret-store.mjs']) {
      const source = code(readFileSync(file, 'utf8'));
      expect(source, `${file}: MEASURED before: a second run a week after the first, every cache emptied again`).not.toContain('move?.keyRetired === true) { try { onLegacy?.(); }');
      expect(source).toMatch(/move\?\.moved/);
    }
    expect(code(fn('async function bootEncryptedMessageHistory() {'))).toContain('if (moved && (Number(moved.moved ?? 0) > 0 || Number(moved.unreadable ?? 0) > 0)) noteLegacyStorageMoved();');
  });

  it('R14-CARRY-01: the caches go through the clearing a whole store at a time while the budget lasts — pictures last — and never make a run short', async () => {
    const factory = new IDBFactory();
    const db: any = await new Promise((resolve, reject) => {
      const request = factory.open('platho-sealed-cache-v1.dep.wal', 1);
      request.onupgradeneeded = () => {
        for (const name of ['facePointers', 'walletSets', 'giftLists', 'avatarMedia', 'allFeedMedia']) request.result.createObjectStore(name, { keyPath: 'id' }).createIndex('r', 'r');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const write = db.transaction(['facePointers', 'giftLists', 'avatarMedia', 'allFeedMedia'], 'readwrite');
    write.objectStore('facePointers').put({ id: 'p1', r: 1, n: new Uint8Array(12), x: new Uint8Array(64) });
    write.objectStore('giftLists').put({ id: 'g1', r: 1, n: new Uint8Array(12), x: new Uint8Array(500) });
    write.objectStore('avatarMedia').put({ id: 'a1', r: 1, n: new Uint8Array(12), x: new Uint8Array(1_500) });
    for (let i = 0; i < 4; i += 1) write.objectStore('allFeedMedia').put({ id: `m${i}`, r: i, n: new Uint8Array(12), x: new Uint8Array(4_000) });
    await new Promise((resolve) => { write.oncomplete = resolve; });
    db.close();
    const local = memoryStorage({ theme: 'dark' });
    const result = await resecureOriginStorage({ indexedDB: factory, localStorage: local, fetch: clearingFetch(factory, [local]), cacheBudgetBytes: 4_000 });
    expect(result.outcome, 'a cache left behind is no shortfall').toBe('restored');
    const count = async (store: string) => (await rawEntries(factory, 'platho-sealed-cache-v1.dep.wal', store)).length;
    expect(await count('facePointers'), 'always carried').toBe(1);
    expect(await count('giftLists'), 'MEASURED before: every cache came back empty').toBe(1);
    expect(await count('avatarMedia'), 'the faces too, inside the budget').toBe(1);
    expect(await count('allFeedMedia'), 'the pictures past it come back empty, their store and index kept').toBe(0);
    expect(RESECURE_CACHE_CARRY_ORDER.indexOf('allFeedMedia')).toBeGreaterThan(RESECURE_CACHE_CARRY_ORDER.indexOf('avatarMedia'));
    const tight = new IDBFactory();
    const seedTight: any = await new Promise((resolve, reject) => {
      const request = tight.open('platho-sealed-cache-v1.dep.wal', 1);
      request.onupgradeneeded = () => { for (const name of ['giftLists', 'avatarMedia']) request.result.createObjectStore(name, { keyPath: 'id' }); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const fill = seedTight.transaction(['giftLists', 'avatarMedia'], 'readwrite');
    fill.objectStore('giftLists').put({ id: 'g1', x: new Uint8Array(500) });
    fill.objectStore('avatarMedia').put({ id: 'a1', x: new Uint8Array(1_500) });
    await new Promise((resolve) => { fill.oncomplete = resolve; });
    seedTight.close();
    const tightLocal = memoryStorage({ theme: 'dark' });
    await resecureOriginStorage({ indexedDB: tight, localStorage: tightLocal, fetch: clearingFetch(tight, [tightLocal]), cacheBudgetBytes: 1_700 });
    expect((await rawEntries(tight, 'platho-sealed-cache-v1.dep.wal', 'giftLists')).length, 'the small and dear first').toBe(1);
    expect((await rawEntries(tight, 'platho-sealed-cache-v1.dep.wal', 'avatarMedia')).length).toBe(0);
    expect(resecureCacheCarryRank('platho-latest-posts-v1.dep', 'store')).toBe(RESECURE_CACHE_CARRY_ORDER.indexOf('latestPosts'));
    expect(resecureCacheCarryRank('platho-history-v1.dep.wal', 'encryptedMessages'), 'the data itself is no cache').toBe(-1);
  });

  it('R14-CARRY-02: the worker\'s files go through the clearing too, and its install keeps what its own cache holds', async () => {
    const store = new Map<string, Map<string, Response>>();
    const caches: any = {
      keys: async () => [...store.keys()],
      open: async (name: string) => {
        if (!store.has(name)) store.set(name, new Map());
        const entries = store.get(name)!;
        return {
          keys: async () => [...entries.keys()].map((url) => new Request(url)),
          match: async (request: any) => entries.get(typeof request === 'string' ? request : request.url)?.clone(),
          put: async (request: any, response: Response) => { entries.set(typeof request === 'string' ? request : request.url, response); },
        };
      },
    };
    const files = await caches.open('platho-pwa-release');
    await files.put(new Request('https://stage.example/app.js?v=b1'), new Response('the module', { status: 200, headers: { 'content-type': 'text/javascript' } }));
    await files.put(new Request('https://stage.example/index.html'), new Response('<!doctype html>', { status: 200 }));
    const factory = new IDBFactory();
    await seedDatabases(factory);
    const local = memoryStorage({ theme: 'dark' });
    const browserClears = { clear: () => store.clear() };
    const result = await resecureOriginStorage({ indexedDB: factory, localStorage: local, fetch: clearingFetch(factory, [local, browserClears]), caches });
    expect(result.outcome).toBe('restored');
    expect(result.written.filesWritten, 'MEASURED before: 0 — 199 files, 8.2 MB, downloaded again').toBe(2);
    const back = await (await caches.open('platho-pwa-release')).match('https://stage.example/app.js?v=b1');
    expect(await back.text()).toBe('the module');
    expect(back.headers.get('content-type')).toBe('text/javascript');
    const sw = code(readFileSync('web/sw.js', 'utf8'));
    const install = sw.slice(sw.indexOf("self.addEventListener('install'"), sw.indexOf("self.addEventListener('activate'"));
    expect(install.indexOf('if (await cache.match(asset)) return;')).toBeGreaterThan(-1);
    expect(install.indexOf('if (await cache.match(asset)) return;'), 'kept before anything is fetched').toBeLessThan(install.indexOf("await cache.add(new Request(asset, { cache: 'reload' }));"));
    expect(code(fn('async function runStorageResecureIfSafe() {'))).toContain('caches: globalThis.caches ?? null,');
    const kept = new IDBFactory();
    await seedDatabases(kept);
    const keptLocal = memoryStorage({ theme: 'dark' });
    const again = await resecureOriginStorage({ indexedDB: kept, localStorage: keptLocal, fetch: clearingFetch(kept, [keptLocal]), caches });
    expect(again.written.filesWritten, 'a cache still there is left as it is').toBe(0);
  });

  it('R14-CARRY-03: a cache store that does not come back is no failure of the run, and the check does not count it', async () => {
    const factory = new IDBFactory();
    const values = [{ id: 'a', u: 1 }, { id: 'b', u: 1 }];
    const snapshot: any = {
      local: [], session: [],
      databases: [{ name: 'platho-sealed-cache-v1.dep.wal', version: 1, stores: [
        { name: 'giftLists', keyPath: 'id', autoIncrement: false, indexes: [{ name: 'u', keyPath: 'u', unique: true, multiEntry: false }], keys: ['a', 'b'], values, cache: true },
        { name: 'facePointers', keyPath: 'id', autoIncrement: false, indexes: [], keys: ['p'], values: [{ id: 'p' }] },
      ] }],
    };
    const written = await restoreOriginStorage(snapshot, { indexedDB: factory, localStorage: memoryStorage() });
    expect(written.failed, 'MEASURED before: a cache that failed made the run short — and owed a full chain read').toEqual([]);
    expect((await rawEntries(factory, 'platho-sealed-cache-v1.dep.wal', 'facePointers')).length).toBe(1);
    const check = await verifyOriginStorage(snapshot, { indexedDB: factory, localStorage: memoryStorage() });
    expect(check.ok, 'a cache short of its snapshot is fetched again, not a shortfall').toBe(true);
  });
});

describe('R14 the day\'s shard plans survive a lock, sealed', () => {
  const bytes = (seed: number) => Uint8Array.from({ length: 32 }, (_, i) => (seed * 31 + i * 7) & 0xff);
  const CONV = { kRoot: bytes(1), selfKeyId: bytes(2), peerKeyId: bytes(3), epochNow: 20690, windowW: 2 };

  it('R14-PLANS-01: the plans go out as JSON and come back the same — the next pass derives nothing', async () => {
    const first = createRecordShardPlanner();
    const incoming = await first.incoming(CONV);
    const outgoing = await first.outgoing(CONV);
    await first.incoming({ ...CONV, windowW: 30 });
    await first.incoming({ ...CONV, epochNow: CONV.epochNow - 1 });
    const kept = JSON.parse(JSON.stringify(first.exportEntries({ epochNow: CONV.epochNow, maxWindow: 2 })));
    expect(kept.length, 'today\'s steady plans only').toBe(2);
    const next = createRecordShardPlanner();
    expect(next.importEntries(kept)).toBe(2);
    const again = await next.incoming(CONV);
    const againOut = await next.outgoing(CONV);
    expect(next.stats, 'MEASURED before: every conversation derived again after every unlock (2.6 ms each)').toMatchObject({ misses: 0, hits: 2 });
    expect(again.map((s: any) => s.address)).toEqual(incoming.map((s: any) => s.address));
    expect(againOut.map((s: any) => Buffer.from(s.writePublicKey).toString('hex'))).toEqual(outgoing.map((s: any) => Buffer.from(s.writePublicKey).toString('hex')));
  });

  it('R14-PLANS-02: read back at the unlock only for this build and this day; written after a pass that derived something; the lock stops a write', async () => {
    const imported: any[] = [];
    const held = { value: null as string | null };
    const make = (recipe: string) => lift({
      deviceCacheStore: async () => ({ type: 'sealed-indexeddb', get: async () => (held.value ? { url: held.value } : null) }),
      plathoWallet: W2, PLATHO_APP_BUILD_ID: recipe, epochFromCreatedAtSeconds: (s: number) => Math.floor(s / 86_400), Date,
      chainNowSec: () => Math.floor(Date.now() / 1000),
      convShardPlanner: { importEntries: (entries: any) => { imported.push(entries); return entries.length; }, stats: { misses: 0, inserts: 0 } },
    }, [line('const CONV_SHARD_PLANS_RECORD = '), fn('async function loadConvShardPlans(wallet) {')], 'loadConvShardPlans', 'let convShardPlansSavedInserts = -1;');
    const today = Math.floor(Date.now() / 86_400_000);
    held.value = JSON.stringify({ recipe: 'build-a', epoch: today, entries: [['k', []]] });
    expect(await make('build-b')(W2), 'another build derives afresh').toBe(0);
    held.value = JSON.stringify({ recipe: 'build-a', epoch: today - 2, entries: [['k', []]] });
    expect(await make('build-a')(W2), 'another day too').toBe(0);
    held.value = JSON.stringify({ recipe: 'build-a', epoch: today - 1, entries: [['k', []]] });
    expect(await make('build-a')(W2)).toBe(1);
    held.value = JSON.stringify({ recipe: 'build-a', epoch: today, entries: [['k', []]] });
    expect(await make('build-a')(W2)).toBe(1);
    expect(imported).toEqual([[['k', []]], [['k', []]]]);
    const boot = code(fn('async function bootWalletScopedLocalStores() {'));
    expect(boot.indexOf('if (wallet) await loadConvShardPlans(wallet);')).toBeGreaterThan(boot.indexOf('await loadWalletSets(wallet);'));
    expect(code(fn('async function syncConvCapsulesFromShards(options = {}) {'))).toContain('if (!tornDown()) persistConvShardPlansSoon(epochNow);');
    expect(code(fn('function persistConvShardPlansSoon(epochNow) {'))).toContain("JSON.stringify({ recipe: PLATHO_APP_BUILD_ID, epoch: epochNow, entries })");
    expect((code(app).match(/convShardPlanner\.clear\(\);\n\s*if \(convShardPlansSaveTimer\) \{ clearTimeout\(convShardPlansSaveTimer\); convShardPlansSaveTimer = null; \}/g) ?? []).length).toBe(2);
    expect(code(app)).toContain("shardPlans: Object.freeze({ plain: null, cap: () => 1 }),");
  });
});
const W2 = { address: `0:${'cd'.repeat(32)}` };

describe('R14 the INTRO signs the day it is written for (V3)', () => {
  async function handshakePair() {
    const A: any = await createMessagingIdentity();
    const B: any = await createMessagingIdentity();
    const r = randomBytes(32);
    const viewTag = 0x1234;
    const bodyKemCiphertext = ml_kem768.encapsulate(B.encryptionKeyPair.mlKem768PublicKey).cipherText as Uint8Array;
    const recipientBundle = { keyId: B.encryptionKeyPair.keyId, x25519PublicKey: B.encryptionKeyPair.x25519PublicKey, mlKem768PublicKey: B.encryptionKeyPair.mlKem768PublicKey };
    return { A, B, r, viewTag, bodyKemCiphertext, recipientBundle };
  }

  it('R14-INTRO-01: V2 is unchanged; V3 signs the epoch, carries it after the nonce, and opens to it', async () => {
    expect(INTRO_TRANSCRIPT_DOMAIN).toBe('PLATHO.INTRO.TRANSCRIPT.V2');
    expect(Buffer.from(INTRO_PAYLOAD_MAGIC).toString('hex')).toBe('50494832');
    expect(INTRO_TRANSCRIPT_DOMAIN_V3).toBe('PLATHO.INTRO.TRANSCRIPT.V3');
    expect(Buffer.from(INTRO_PAYLOAD_MAGIC_V3).toString('hex')).toBe('50494833');
    const { A, B, r, viewTag, bodyKemCiphertext, recipientBundle } = await handshakePair();
    const v2 = await buildIntroHandshake({ senderIdentity: A, recipientBundle, ephemeralSecretKey: r, viewTag, bodyKemCiphertext });
    const v3 = await buildIntroHandshake({ senderIdentity: A, recipientBundle, ephemeralSecretKey: r, viewTag, bodyKemCiphertext, introEpoch: 20750 });
    expect(v3.introPayloadBytes.length - v2.introPayloadBytes.length).toBe(4);
    expect(parseIntroPayload(v2.introPayloadBytes).introEpoch).toBeNull();
    expect(parseIntroPayload(v3.introPayloadBytes).introEpoch).toBe(20750);
    const open = (payload: Uint8Array) => openIntroHandshake({ introPayloadBytes: payload, recipientIdentity: B, senderSigningPublicKey: A.signingPublicKey, ephemeralR: v3.ephemeralR, bodyKemCiphertext, viewTag });
    expect((await open(v3.introPayloadBytes)).introEpoch).toBe(20750);
    expect((await open(v2.introPayloadBytes)).introEpoch).toBeNull();
    const moved = Uint8Array.from(v3.introPayloadBytes);
    const at = 4 + 32 + 32 + 32 + 1088 + 16;
    moved[at + 3] ^= 0x01;
    await expect(open(moved)).rejects.toThrow(/verification failed/i);
  });

  it('R14-INTRO-02: a V3 capsule keeps its size class and opens from the chain form with the epoch it signed', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const v2 = await createEncryptedIntroCapsule(exportPublicKeyBundle(recipient.encryptionKeyPair), sender, {});
    const v3 = await createEncryptedIntroCapsule(exportPublicKeyBundle(recipient.encryptionKeyPair), sender, { introEpoch: 20750 });
    expect(v3.header0.sizeClass ?? v3.header0.size_class).toBe(v2.header0.sizeClass ?? v2.header0.size_class);
    const bytesOf = (p: any): Uint8Array => Buffer.concat(p.chunks.map((c: string) => Buffer.from(c, 'base64url')));
    const opened = await openIntroCapsuleFromChainCells(bytesOf(v3.chainCells.header0), bytesOf(v3.chainCells.body), recipient.encryptionKeyPair, { enforceExpiry: false });
    expect(opened.introEpoch).toBe(20750);
    expect(Buffer.from(opened.kRoot).toString('hex')).toBe(Buffer.from(v3.kRoot).toString('hex'));
  });

  it('R14-INTRO-03: the receiver refuses a copy read in another day\'s shard, and from its date an unsigned one', () => {
    expect(introEpochVerdict(20750, 20750)).toBeNull();
    expect(introEpochVerdict(20750, 20751), 'MEASURED before: adopted as a first contact of the later day').toMatch(/signed for epoch 20750, read in 20751/);
    expect(introEpochVerdict(null, INTRO_UNSIGNED_REFUSED_FROM - 1), 'V2 is read until its date').toBeNull();
    expect(introEpochVerdict(null, INTRO_UNSIGNED_REFUSED_FROM)).toMatch(/unsigned/);
    expect(introEpochVerdict(20750, undefined), 'an unknown shard epoch decides nothing').toBeNull();
    expect(INTRO_UNSIGNED_REFUSED_FROM - INTRO_EPOCH_SIGNED_FROM, 'past the scan\'s eight days, with room').toBeGreaterThanOrEqual(14);
    const handler = code(readFileSync('web/intro-receive-handler.mjs', 'utf8'));
    expect(handler.indexOf('const misplaced = introEpochVerdict(opened.introEpoch ?? null, delivery?.epoch);'), 'before anything is adopted').toBeLessThan(handler.indexOf('await convKeyStore.upsertConversationKRoot('));
    expect(handler).toContain("error.code = 'INTRO_REPLAY';");
  });

  it('R14-INTRO-05: the handler itself refuses a signed INTRO read in another day\'s shard, adopting and showing nothing — and takes it in its own', async () => {
    const sender: any = await createMessagingIdentity();
    const recipient: any = await createMessagingIdentity();
    const built: any = await createEncryptedIntroCapsule(exportPublicKeyBundle(recipient.encryptionKeyPair), sender, { introEpoch: 20750 });
    const bytesOf = (p: any): Uint8Array => Buffer.concat(p.chunks.map((c: string) => Buffer.from(c, 'base64url')));
    const delivery = (epoch: number) => ({
      r: 0n, view_tag: built.header0.viewTag, epoch, bucket: 0, entryId: 0,
      capsule: { header0: bytesOf(built.chainCells.header0), body: bytesOf(built.chainCells.body), r: 0n, viewTag: built.header0.viewTag, created_at: 1_792_000_000, source: null },
    });
    const store = createMemoryConvKeyStore();
    const guard = createMemoryReplayStore();
    let shown = 0;
    const onIntro = createIntroReceiveHandler({ recipientKeyPair: recipient.encryptionKeyPair, convKeyStore: store, introReplayGuard: guard, onFirstContact: () => { shown += 1; } });
    const refused: any = await onIntro(delivery(20751)).catch((error: any) => error);
    expect(refused?.code, 'without the check the copy in the next day\'s shard was adopted as a first contact').toBe('INTRO_REPLAY');
    expect(String(refused?.message)).toMatch(/signed for epoch 20750, read in 20751/);
    expect(shown, 'nothing shown').toBe(0);
    const opened: any = await onIntro(delivery(20750));
    expect(opened.adoption).toBe('created');
    expect(opened.introEpoch).toBe(20750);
    expect(shown).toBe(1);
    expect(store.getConversation(recipient.encryptionKeyPair.keyId, opened.senderKeyId)).not.toBeNull();
    const v2: any = await createEncryptedIntroCapsule(exportPublicKeyBundle(recipient.encryptionKeyPair), sender, {});
    const late = { r: 0n, view_tag: v2.header0.viewTag, epoch: INTRO_UNSIGNED_REFUSED_FROM, bucket: 0, entryId: 0, capsule: { header0: bytesOf(v2.chainCells.header0), body: bytesOf(v2.chainCells.body), created_at: 1_793_000_000, source: null } };
    expect((await onIntro(late).catch((error: any) => error))?.code).toBe('INTRO_REPLAY');
    expect(shown).toBe(1);
  });

  it('R14-INTRO-04: the sender picks the shard first and signs its epoch from INTRO_EPOCH_SIGNED_FROM', () => {
    const send = code(app.slice(app.indexOf('const readScanPage = createScanPageReader((call) => transport.runGetMethod(call));'), app.indexOf('const { r, viewTag } = introCapsuleStealthFields(capsule);')));
    expect(send.indexOf('const slot = await pickIntroSendSlot({ readScanPage, epoch: introEpochNow });')).toBeLessThan(send.indexOf('createEncryptedIntroCapsule('));
    expect(send).toContain('...(Number(slot.epoch) >= INTRO_EPOCH_SIGNED_FROM ? { introEpoch: Number(slot.epoch) } : {}),');
    expect(new Date(INTRO_EPOCH_SIGNED_FROM * 86_400_000).toISOString().slice(0, 10)).toBe('2026-10-18');
  });
});

describe('R15 — a clearing that never answers is parked [F1-9]', () => {
  it('R15-PARK-01: five unanswered runs in a row park the run for a week; an answer resets the count; offline counts nothing', async () => {
    const storage = memoryStorage();
    let outcome = 'unanswered';
    let runs = 0;
    const run = liftRunner(runnerGlobal(storage), async () => { runs += 1; return { outcome, databases: 0 }; });
    for (let start = 1; start < RESECURE_MAX_UNANSWERED; start += 1) {
      storage.setItem(RESECURE_STATE_KEY, 'due');
      await run();   // eslint-disable-line no-await-in-loop
      expect(storage.getItem(RESECURE_UNANSWERED_KEY)).toBe(String(start));
    }
    outcome = 'unreachable';
    await run();
    expect(storage.getItem(RESECURE_UNANSWERED_KEY), 'offline says nothing about the path').toBe(String(RESECURE_MAX_UNANSWERED - 1));
    outcome = 'unanswered';
    await run();
    const parked = Number(storage.getItem(RESECURE_PARKED_UNTIL_KEY));
    expect(parked - Date.now(), 'MEASURED before: every start snapshotted the storage and waited 20 s, without end').toBeGreaterThan(RESECURE_UNANSWERED_PARK_MS - 60_000);
    expect(storage.getItem(RESECURE_UNANSWERED_KEY)).toBeNull();
    const before = runs;
    storage.setItem(RESECURE_STATE_KEY, 'due');
    await run();
    expect(runs, 'parked: not run').toBe(before);
    storage.setItem(RESECURE_PARKED_UNTIL_KEY, String(Date.now() - 1));
    outcome = 'restored';
    await run();
    expect(runs).toBe(before + 1);
    expect(storage.getItem(RESECURE_PARKED_UNTIL_KEY), 'an answer resets it').toBeNull();
    expect(storage.getItem(RESECURE_STATE_KEY)).toBe('done');
  });
});
