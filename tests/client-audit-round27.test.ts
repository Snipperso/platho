import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { broadcastHub } from './helpers/web-locks';
import { originLocks, windowOf } from './helpers/one-window';


const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const line = (start: string) => { const at = app.indexOf(start); if (at < 0) throw new Error(`not found: ${start}`); return app.slice(at, app.indexOf(String.fromCharCode(10), at)); };
const lift = (env: Record<string, any>, sources: string[], exported: string, prelude = '') => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [prelude, ...sources, `return ${exported};`].join(String.fromCharCode(10)))(...names.map((n) => env[n]));
};
const liftWith = (env: Record<string, any>, sources: string[], exported: string) => {
  const scope = new Proxy(env, {
    has: (target, key) => typeof key === 'string' && (Object.prototype.hasOwnProperty.call(target, key) || !(key in globalThis)),
    get: (target: any, key) => (typeof key === 'string' && Object.prototype.hasOwnProperty.call(target, key) ? target[key] : (typeof key === 'string' ? () => undefined : undefined)),
    set: (target: any, key, value) => { target[key] = value; return true; },
  });
  // eslint-disable-next-line no-new-func
  return new Function('scope', `with (scope) {\n${sources.join('\n')}\nreturn ${exported};\n}`)(scope);
};
const settle = (ms = 5) => new Promise((resolve) => { setTimeout(resolve, ms); });
const KIND = 'platho-encrypted-wallet';
const A = 'o1:' + 'aa'.repeat(16);
const B = 'o1:' + 'bb'.repeat(16);
const C = 'o1:' + 'cc'.repeat(16);
const rec = (salt: string, owner?: string, extra: Record<string, any> = {}) => ({ kind: KIND, version: 1, kdf: 'pbkdf2', iterations: 1, salt, cipher: 'aes-gcm', iv: 'iv', ciphertext: `ct-${salt}`, ...(owner ? { owner } : {}), ...extra });
const memory = (initial: Record<string, string> = {}, { refuse = '' } = {}) => {
  const map = new Map<string, string>(Object.entries(initial));
  return { map, storage: { getItem: (k: string) => map.get(k) ?? null, removeItem: (k: string) => { map.delete(k); },
    setItem: (k: string, v: string) => { if (k === refuse) throw Object.assign(new Error('full'), { name: 'QuotaExceededError' }); map.set(k, String(v)); } } };
};

describe('R27 — sends: a first contact taken over finishes in the same attempt, never paid twice on a lagging walk; a restore arms its own ladder [F6-1, F6-2, F6-5]', () => {
  it('R27-INTRO-01: a walk that says "absent" is waited for while the wallet does not say the bytes never ran — half an hour past their deadline at most [F6-5; round 28 — F6-1, F6-2; round 21 — A9]', async () => {
    const run = async (fate: string, { nowMs = 1_000_000 } = {}) => {
      const asked: any[] = [];
      const env: any = {
        walletOfSend: () => ({ address: 'A' }), localRecipientKeyPair: { keyId: new Uint8Array(32) }, localIdentity: {},
        globalThis: { plathoWalletRpcTransport: { runGetMethod: async () => ({}) } }, convKeyStore: {}, walletSessionGeneration: 1,
        createEntryReader: () => async () => null, createScanPageReader: () => async () => null,
        confirmIntroCreatedAt: async (opts: any) => (opts?.reportAbsence ? { absent: 'not-in-bucket' } : null),
        introSendBytesDead: () => true, chainNowSec: () => 1_000, WALLET_CLOCK_TOLERANCE_MS: 60_000, awaitWalletChainClock: async () => {},
        walletExternalOutcomeNow: async (...args: any[]) => { asked.push(args); return fate; }, walletChainNowMs: () => nowMs, DIRECT_SEND_REBROADCAST_WINDOW_MS: 120_000,
        pricedGenerationMovedAt: () => false, firstContactOwnerOf: () => null,
        resolveRecipientWalletForThread: async () => { throw new Error('MINT'); },
      };
      const attempt = liftWith(env, [line('const INTRO_SHARD_RETIRABLE_AFTER_EPOCH_START_SEC = '), fn('function introShardMayBeRetired(epoch, nowSec = chainNowSec()) {'),
        fn('function convIntroPendingError() {'), fn('async function attemptIntroFirstContactDirect(context, owner = undefined) {')], 'attemptIntroFirstContactDirect');
      const message: any = { introDirectSend: { boc: 'b64', seqno: 40, validUntil: 1_000, epoch: 20743, bucket: 0, expectedEntryId: 0, r: 'r', viewTag: 1 } };
      try { await attempt({ thread: { id: 'dm:x' }, message }, 'A'); return { outcome: 'returned', asked: asked.length }; } catch (error: any) {
        return { outcome: error.message === 'MINT' ? 'minted' : (error.code ?? error.message), asked: asked.length };
      }
    };
    expect(await run('consumed'), 'F6-5 MEASURED before: an endpoint minutes behind — a new INTRO minted and paid at every attempt (2 to 6)').toEqual({ outcome: 'CONV_INTRO_PENDING', asked: 1 });
    expect(await run('unknown'), 'round 28 F6-2 MEASURED before: the wallet unreadable, a lagging walk paid an INTRO per Retry (6)').toEqual({ outcome: 'CONV_INTRO_PENDING', asked: 1 });
    const pastIt = 1_000_000 + 30 * 60_000 + 1;
    expect(await run('consumed', { nowMs: pastIt }), 'round 28 F6-1 MEASURED before: an INTRO the shard refused (13680) held that person\'s conversation for good').toEqual({ outcome: 'minted', asked: 1 });
    expect(await run('unknown', { nowMs: pastIt }), 'a wallet busier than its look-back: the walk\'s proof stands in the end [round 21 — A9]').toEqual({ outcome: 'minted', asked: 1 });
    expect(await run('replaced')).toEqual({ outcome: 'minted', asked: 1 });
    expect(await run('expired')).toEqual({ outcome: 'minted', asked: 1 });
    expect(code(fn('async function attemptIntroFirstContactDirect(context, owner = undefined) {')), 'F6-1: the takeover finishes it in this very attempt')
      .toContain('return attemptIntroFirstContactDirect(context, signer?.address ?? null);');
  });

  it('R27-RESTORE-01: the screen coming back asks the ladder as the other two doors do [F6-2]', () => {
    const handler = app.slice(app.indexOf("document.addEventListener('visibilitychange', () => {\n  if (document.hidden) {"), app.indexOf("window.addEventListener('pagehide'"));
    const visible = code(handler.slice(handler.indexOf('} else {')));
    expect(visible, 'F6-2 MEASURED before: restored behind the screen, looked at after ten minutes — "retrying" with nothing running').toContain('void resumePendingPrivateSendRetries();');
  });
});

describe('R27 — one window: an untouched dialog does not hold it; a press that ends says so; a woken window signs nothing while it asks for the app; one flow at a time, each its own [F3-1, F3-2, F3-4, F7-4, F2-1]', () => {
  it('R27-WINDOW-01: a wallet flow waiting for the person at a dialog holds the window only by what is typed [F3-1, F7-2]', () => {
    const inHand = (dialog: any, { running = true, transfers = 0, count = 0 } = {}) => lift({
      walletFlowOnce: { running }, activeWindowHoldsWork: { inHand: count }, walletTonTransfersBusy: new Set(Array.from({ length: transfers }, (_, i) => i)), __dialog: dialog,
    }, [fn('function walletWorkInHand() {')], 'walletWorkInHand', 'let activeActionDialog = __dialog;')();
    expect(inHand({ validating: false }), 'F3-1 MEASURED before: Import, Other wallets, Clear local data, Send GRAM left open held the app for good').toBe(false);
    expect(inHand({ validating: false }, { running: false, transfers: 1 }), 'Send GRAM\'s own dialog, nothing typed: its press holds nothing').toBe(false);
    expect(inHand({ validating: false }, { running: false, count: 1 }), 'round 28 F3-1 MEASURED before: a Send GRAM past its answer, Receive GRAM opened meanwhile — dropped by "Use here", never signed').toBe(true);
    expect(inHand({ validating: true }), 'what was submitted is being checked: held').toBe(true);
    expect(inHand(null), 'past the dialog — the key derivation, the record write, the chain reads: held').toBe(true);
    expect(inHand(null, { running: false }), 'nothing at all').toBe(false);
  });

  it('R27-WINDOW-02: a press that waited its minute says so — never "this one goes on" over a press that has ended [F3-2]', async () => {
    vi.useFakeTimers();
    try {
      const locks = originLocks();
      const hub = broadcastHub();
      const a = windowOf(locks, hub);
      await a.api.gate();
      a.ready();
      a.work.composer = true;
      const b = windowOf(locks, hub);
      void b.api.gate();
      await vi.advanceTimersByTimeAsync(10);
      b.page.press();
      await vi.advanceTimersByTimeAsync(21_000);
      expect(b.page.nodes.bootElsewhereStatus.textContent).toBe('window.otherNotAnswering');
      await vi.advanceTimersByTimeAsync(40_000);
      expect(b.page.nodes.bootElsewhereStatus.textContent, 'F3-2 MEASURED before: it ended unsaid while the screen promised the other tab would step aside')
        .toBe('window.pressAgain');
      expect(b.page.nodes.bootUseHere.disabled).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('R27-WINDOW-03: a window woken from a freeze signs nothing until the app is its own again [F3-4]', async () => {
    const locks = originLocks();
    const slow = { ...locks, manager: { ...locks.manager, request: (name: string, options: any, callback: any) => settle(20).then(() => locks.manager.request(name, options, callback)) } };
    const a = windowOf(slow, broadcastHub());
    await a.api.gate();
    a.ready();
    a.page.fire('freeze');
    await settle(5);
    expect(locks.holding('platho-active-window.v1'), 'idle at the freeze: let go').toBe(false);
    a.page.fire('resume');
    expect(a.api.signingHeld(), 'F3-4 MEASURED before: a signature asked while the re-take was answered went out (3/3)').toBe(true);
    await settle(60);
    expect([locks.holding('platho-active-window.v1'), a.api.signingHeld(), a.log], 'taken back: signing again, nothing reloaded').toEqual([true, false, []]);
  });

  it('R27-FLOW-01: each wallet flow lets go of its own latch only; none starts while an unlock is being answered [F7-4, F2-1]', async () => {
    const said: string[] = [];
    const gate = lift({ showAppNotice: (text: string) => said.push(text), t: (k: string) => k }, [fn('function walletFlowOnce(task) {')],
      '{ once: walletFlowOnce, unlocking: (value) => { walletUnlockPromise = value; } }', 'let walletUnlockPromise = null;');
    const press = { type: 'click', detail: 1 };
    let finishCreate: () => void = () => {};
    const create = gate.once(async () => { gate.once.release(); await new Promise<void>((resolve) => { finishCreate = resolve; }); });
    const creating = create(press);
    let finishImport: () => void = () => {};
    const importing = gate.once(async () => { await new Promise<void>((resolve) => { finishImport = resolve; }); })(press);
    await settle(1);
    finishCreate();
    await creating;
    expect(await gate.once(async () => 'third')(press), 'F7-4 MEASURED before: a Create ending late let go of an Import still in its dialog, and a third flow ran beside it').toBeUndefined();
    expect(said).toEqual(['wallet.flowStillRunning']);
    finishImport();
    await importing;
    gate.unlocking(new Promise(() => {}));
    expect(await gate.once(async () => 'made')(press), 'F2-1 MEASURED before: a wallet made while the password was tried on the others — the session then ran the other one').toBeUndefined();
    gate.unlocking(null);
    expect(await gate.once(async () => 'made')(press)).toBe('made');
  });
});

describe('R27 — what is said: the full list, the clear, the ☁️ names, the forgotten name [F7-8 R8, R52, P23, P24]', () => {
  it('R27-CLEAR-01: "Clear local data" says when Telegram\'s copy is a password behind — and waits for no database a frozen tab holds [F7-8 R52; F3-6]', async () => {
    const hintOf = async ({ there = null as any, kept = true as boolean | null, known = true, activeSeq = 4 } = {}) => {
      let hint = '';
      await lift({
        inTelegramBot: () => true, hasStoredPlathoWalletRecord: () => true,
        syncWalletsWithTelegram: async () => (known ? {} : null), delay: () => new Promise(() => {}), walletKeptInTelegram: () => kept,
        readDeviceKeyring: () => ({ active: { ciphertext: 'NOW', iv: 'i', seq: activeSeq }, others: [] }), telegramSealOf: () => there, untaggedCopiesOf: () => [], counted: (record: any) => record,
        sameSeal: (a: any, b: any) => Boolean(a?.ciphertext) && a?.ciphertext === b?.ciphertext, supersedes: (a: any, b: any) => Number(a?.seq) > Number(b?.seq),
        openActionDialog: async (d: any) => { hint = d.hint; return null; }, t: (k: string) => k, joinHintSentences: (...p: string[]) => p.filter(Boolean).join(' '),
      }, [fn('async function confirmClearLocalData() {')], 'confirmClearLocalData')();
      return hint;
    };
    expect(await hintOf({ there: { ciphertext: 'OLD', seq: 3 } }), 'F7-8 R52: Telegram\'s copy on the password before').toBe('profile.clearLocalDataHintTelegram profile.clearLocalDataCopyOwed');
    expect(await hintOf({ there: { ciphertext: 'NOW', seq: 4 } })).toBe('profile.clearLocalDataHintTelegram');
    expect(await hintOf({ there: { ciphertext: 'OTHER', seq: 0 }, activeSeq: 0 }), 'review 30 M2: a tie is no password "not taken yet"').toBe('profile.clearLocalDataHintTelegram');
    expect(await hintOf({ kept: false }), 'F1-8: the wallet here kept only here goes with the rest').toBe('profile.clearLocalDataHintTelegram profile.clearLocalDataDeviceWallet');
    expect(await hintOf({ kept: null, known: false }), 'round 29 F1-1 MEASURED before: Telegram silent, the wallet kept only here went unnamed and was deleted')
      .toBe('profile.clearLocalDataHintTelegram profile.clearLocalDataTelegramSilent');
    const deleted: string[] = [];
    const clear = lift({
      stopIntroReceiveLane: () => {}, clearWalletScopedRuntimeState: () => {}, localStorageOrNull: () => ({ clear() {}, setItem() {} }), clearDocumentCookies: () => {},
      plathoLocalIndexedDbNames: async () => ['platho-a', 'platho-held'], delay: () => settle(10), requestSiteStorageClear: async () => {},
      deleteIndexedDbDatabase: (name: string) => { deleted.push(name); return name === 'platho-held' ? new Promise(() => {}) : Promise.resolve(true); },
    }, [fn('async function clearPlathoLocalData() {')], 'clearPlathoLocalData', 'let plathoLocalDataClearing = false;');
    await expect(Promise.race([clear().then(() => 'done'), settle(2_000).then(() => 'stuck')]), 'F3-6 MEASURED before: 9 of 75 deletions unanswered, the page on "clearing" for good').resolves.toBe('done');
    expect(deleted).toEqual(['platho-a', 'platho-held']);
  });

});

describe('R27 — passwords: a word with a number on it; a passphrase in another script [F4-5, F2-6]', () => {
  it('R27-PW-01: the shapes every list starts with are refused; strong passphrases in other scripts are not', () => {
    const guessable = lift({}, [fn('function walletPasswordIsGuessable(password) {')], 'walletPasswordIsGuessable');
    const cyr = (codes: number[]) => String.fromCharCode(...codes);
    const sunny = cyr([0x0441, 0x043e, 0x043b, 0x043d, 0x044b, 0x0448, 0x043a, 0x043e]);
    for (const weak of ['maria12345', 'chocolate1', 'Autumn2025!', 'woaini1314', 'satoshi1234', 'michelle123', 'January2024', 'tonwallet123', `${sunny}12`, 'woaini520520']) {
      expect(guessable(weak), `F4-5 MEASURED before: accepted — ${weak.length} characters of a common shape`).toBe(true);
    }
    const key = cyr([0x043a, 0x043b, 0x044e, 0x0447]);
    const shed = cyr([0x0441, 0x0430, 0x0440, 0x0430, 0x044f]);
    const under = cyr([0x043f, 0x043e, 0x0434]);
    const mat = cyr([0x043a, 0x043e, 0x0432, 0x0440, 0x0438, 0x043a, 0x043e, 0x043c]);
    const han = String.fromCharCode(0x4e2d, 0x6587, 0x5bc6, 0x7801, 0x5f88, 0x957f);
    for (const strong of [`${key} ${cyr([0x043e, 0x0442])} ${shed} ${under} ${mat} secret`, 'h7Kq2xW9pLm4Zt8v', 'correct horse battery staple', `${han}2024`, 'blue-river-stone-42']) {
      expect(guessable(strong), `F2-6 MEASURED before: refused — a strong one of ${strong.length} characters`).toBe(false);
    }
  });
});
