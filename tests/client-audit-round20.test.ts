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
const settle = (ms = 5) => new Promise((resolve) => { setTimeout(resolve, ms); });

describe('R20 — the official bot\'s cloud copy on the Mini App\'s fresh origin [A1–A3 / F7-1..3]', () => {
  it('R20-CLOUD-04: wallets Telegram brings under the quick start close it and ask for the unlock', () => {
    const boot = code(app.slice(app.indexOf('let bootDecidedWithNoWallet = false;'), app.indexOf('AN EXTERNAL PERMALINK is the only way into the app')));
    expect(boot).toContain('const walletRestore = syncWalletsWithTelegram().catch(() => null);');
    expect(boot).toMatch(/if \(!plan\?\.added\?\.length \|\| !bootDecidedWithNoWallet \|\| !hasStoredPlathoWalletRecord\(\)\) return;\s*bootDecidedWithNoWallet = false;\s*if \(quickStartDialog && !quickStartDialog\.hidden && !plathoWallet\) closeQuickStart\(\);\s*return promptStoredWalletUnlockOnStartup\(\);/);
    const decided = boot.indexOf('bootDecidedWithNoWallet = !hasWallet;');
    expect(decided, 'MEASURED before: set only in the branch without the quick start').toBeGreaterThan(-1);
    expect(decided).toBeLessThan(boot.indexOf('if (quickStartShown || drivingBackup) {'));
    expect(boot.split('bootDecidedWithNoWallet = !hasWallet;').length - 1).toBe(1);
  });

  it('R20-CLOUD-05: the 24-word gate passes a wallet the official cloud brought back — when the cloud says its words were confirmed [round 21 — A4]; any other wallet is still gated', async () => {
    const shown: any[] = [];
    const confirmed: string[] = [];
    let fromCloud = true;
    const gate = lift({
      seedConfirmedSeenForStoredRecord: () => false, seedConfirmedInTelegramCloud: async () => 'yes',
      noteSeedConfirmedSeenForStoredRecord: () => {}, noteSeedConfirmedInTelegramCloud: async () => {},
      isTelegramEnv: () => true, isTelegramSeedBackupConfirmed: () => false, storedWalletCameFromTelegramCloud: () => fromCloud,
      markTelegramSeedBackupConfirmed: (address: string) => confirmed.push(address), exportPlathoWalletRecoveryPhrase: () => 'words',
      openActionDialog: async (spec: any) => { shown.push(spec); return null; }, t: (k: string) => k, seedBackupFieldSpecs: () => [],
      delay: () => new Promise(() => {}), actionDialog: null,
      seedBackupConfirmAccepted: () => false, plathoWallet: { address: 'EQ_A' },
    }, [fn('async function enforceTelegramSeedBackupGate(wallet, { force = false, cloudSaid = null } = {}) {')], 'enforceTelegramSeedBackupGate');
    await gate({ address: 'EQ_A' });
    expect([shown.length, confirmed], 'MEASURED before: the 24 words on screen again on the new address').toEqual([0, ['EQ_A']]);
    fromCloud = false;
    await gate({ address: 'EQ_A' });
    expect(shown.length).toBeGreaterThan(0);
    shown.length = 0; fromCloud = true;
    await gate({ address: 'EQ_A' }, { force: true });
    expect(shown.length).toBeGreaterThan(0);
  });

  it('R20-CLOUD-06: the key file is the unlocked wallet\'s — a stored record that does not name it is proven by its password', async () => {
    const asked: any[] = [];
    let record: any = null;
    const exportFile = lift({
      readEncryptedPlathoWalletRecord: () => record, sameWalletAddress: (a: any, b: any) => Boolean(a) && a === b, t: (k: string) => k,
      requestAndDecryptEncryptedWallet: async (r: any) => { asked.push(r); return null; },
      downloadEncryptedWalletKeyBackup: async () => 'saved',
    }, [fn('async function exportEncryptedWalletKeyFile(alreadyUnlocked = null) {')], 'exportEncryptedWalletKeyFile');
    record = { address: 'EQ_A' };
    expect(await exportFile({ address: 'EQ_A' })).toBe('saved');
    expect(asked.length).toBe(0);
    record = { address: 'EQ_OLD' };
    expect(await exportFile({ address: 'EQ_A' }), 'MEASURED before: the OLD wallet\'s file, saved with no password').toBe(false);
    record = { salt: 'from-cloud' };
    expect(await exportFile({ address: 'EQ_A' })).toBe(false);
    expect(asked.length).toBe(2);
  });
});

describe('R20 — a send carried into the same wallet\'s next session [A4 / F1-1 = F3-2]', () => {
  const liftWith = (env: Record<string, any>, sources: string[], exported: string) => {
    const scope = new Proxy(env, {
      has: (target, key) => typeof key === 'string' && (Object.prototype.hasOwnProperty.call(target, key) || !(key in globalThis)),
      get: (target: any, key) => (typeof key === 'string' && Object.prototype.hasOwnProperty.call(target, key) ? target[key] : (typeof key === 'string' ? () => undefined : undefined)),
      set: (target: any, key, value) => { target[key] = value; return true; },
    });
    // eslint-disable-next-line no-new-func
    return new Function('scope', `with (scope) {\n${sources.join('\n')}\nreturn ${exported};\n}`)(scope);
  };
  const same = (a: any, b: any) => Boolean(a) && a === b;

  it('R20-SAMEWALLET-01: a transient failure after a lock and an unlock of the SAME wallet arms the retry on the thread now holding the message; locked or another wallet, nothing', () => {
    const message: any = { type: 'out', text: 'hi', meta: 'sending' };
    const before: any = { id: 'dm:x', messages: [message] };
    const after: any = { id: 'dm:x', messages: [message] };
    const run = (threads: any[], plathoWallet: any) => {
      const jobs = new Map();
      const shown: any[] = [];
      const schedule = liftWith({
        threads, plathoWallet, privateSendRetryJobs: jobs, isStalePrivatePendingPublish: () => false, privateMessageHasPublishAttempt: () => false,
        privatePartialSendRetryExpired: () => false, privateSendRetryMaxAttempts: () => 8, clearPrivateMessageManualRecovery: () => {},
        privateSendRetryDelayMs: () => 8_000, shortUiErrorText: () => 'x', refreshPrivateSendRetryUi: (thread: any) => shown.push(thread), privateSendRetryMeta: () => 'retrying send',
        privateSendRetryKey: () => 'k', holdLiveSend: () => () => {}, window: { setTimeout: () => 1, clearTimeout: () => {} },
      }, [fn('function schedulePrivateSendRetry(context, error) {')], 'schedulePrivateSendRetry');
      const context: any = { thread: before, message, retryAttempt: 0 };
      schedule(context, Object.assign(new Error('rate limited'), { code: 'RATE_LIMITED' }));
      return { armed: jobs.size, on: context.thread, shown };
    };
    const unlockedAgain = run([after], { address: 'A' });
    expect(unlockedAgain.armed, 'MEASURED before: 0 — "sending" for the rest of the session').toBe(1);
    expect([unlockedAgain.on === after, unlockedAgain.shown[0] === after]).toEqual([true, true]);
    expect(run([], null).armed, 'locked: nothing').toBe(0);
    expect(run([{ id: 'dm:x', messages: [{ type: 'out', text: 'hi' }] }], { address: 'B' }).armed, 'another wallet\'s list never holds this object').toBe(0);
  });

  it('R20-SAMEWALLET-02: the press\'s session or its wallet\'s next one — never a locked app, never another wallet', () => {
    const env: any = { walletSessionGeneration: 3, plathoWallet: { address: 'A' }, sameWalletAddress: same };
    const check = liftWith(env, [fn('function sameWalletSessionAsPress(pressSession, pressWallet) {')], 'sameWalletSessionAsPress');
    expect(check(3, 'A')).toBe(true);
    expect(check(2, 'A'), 'MEASURED before: false — the same wallet unlocked again counted as a session gone').toBe(true);
    env.plathoWallet = null;
    expect(check(2, 'A')).toBe(false);
    env.plathoWallet = { address: 'B' };
    expect(check(2, 'A')).toBe(false);
    expect(check(2, null)).toBe(false);
    const room = code(fn('async function sendGroupMessageFromComposer(thread, text) {'));
    expect(room).toContain('if (sameWalletSessionAsPress(session, pressWallet)) scheduleGroupEchoConfirmChecks();');
    expect(room).toContain('const live = sameWalletSessionAsPress(session, pressWallet);');
    expect(room.indexOf('const pressWallet = plathoWallet?.address ?? null;')).toBeLessThan(room.indexOf('await awaitWalletChainClock({ requireSettled: true, timeoutMs: 20_000 });'));
  });
});

describe('R20 — two windows of one wallet never take the same conversation seq [A5 / F3-1]', () => {
  const A = new Uint8Array(32).fill(0x11);
  const X = new Uint8Array(32).fill(0x22);
  const twoWindows = async () => {
    const persist: any = await import('../web/conv-key-persist.mjs');
    const key = await persist.createConvKeySealKey();
    let blob: any = null;
    const backend = { key, lockName: 'platho-conv-keys.test', readBlob: async () => blob, writeBlob: async (record: any) => { await settle(1); blob = record; } };
    const winA = await persist.createSealedConvKeyStore(backend);
    await winA.upsertConversationKRoot(A, X, { kRoot: new Uint8Array(32).fill(0x5a), createdAt: 100, introNonce: new Uint8Array(16).fill(1), peerWallet: 'w-X' });
    const winB = await persist.createSealedConvKeyStore(backend);
    return { winA, winB, backend };
  };

  it('R20-SEQ-01: alternating windows — every claim distinct and above the other window\'s, whatever each hydrated', async () => {
    const { winA, winB } = await twoWindows();
    const day = 20748;
    const claims: number[] = [];
    claims.push(await winB.nextOutgoingSeq(A, X, day, 0));
    claims.push(await winA.nextOutgoingSeq(A, X, day, 0));
    claims.push(await winA.nextOutgoingSeq(A, X, day, 0));
    claims.push(await winB.nextOutgoingSeq(A, X, day, 0));
    claims.push(await winA.nextOutgoingSeq(A, X, day, 0));
    expect(claims, 'MEASURED before: [1, 1, 2, 2, 3] — every second message signed, paid and refused 13653').toEqual([1, 2, 3, 4, 5]);
  });

  it('R20-SEQ-02: two claims at once (neither window has a counter, the first still in flight) — two seqs; a fresh window continues above both', async () => {
    const tails = new Map<string, Promise<unknown>>();
    const locks = { request: (name: string, work: () => Promise<unknown>) => { const run = (tails.get(name) ?? Promise.resolve()).then(() => work()); tails.set(name, run.catch(() => {})); return run; } };
    Object.defineProperty(globalThis.navigator, 'locks', { value: locks, configurable: true });
    try {
    const { winA, winB, backend } = await twoWindows();
    const persist: any = await import('../web/conv-key-persist.mjs');
    const day = 20748;
    const [one, two] = await Promise.all([winA.nextOutgoingSeq(A, X, day, 0), winB.nextOutgoingSeq(A, X, day, 0)]);
    expect([one, two].sort(), 'MEASURED before: [1, 1]').toEqual([1, 2]);
    const fresh = await persist.createSealedConvKeyStore(backend);
    expect(await fresh.nextOutgoingSeq(A, X, day, 0)).toBe(3);
    expect(await winA.nextOutgoingSeq(A, X, day, 9)).toBe(10);
    } finally {
      delete (globalThis.navigator as any).locks;
    }
  });
});

describe('R20 — a first contact retried after its IntroShard may be retired is not paid for twice [A6 / F2-1]', () => {
  const liftWith = (env: Record<string, any>, sources: string[], exported: string) => {
    const scope = new Proxy(env, {
      has: (target, key) => typeof key === 'string' && (Object.prototype.hasOwnProperty.call(target, key) || !(key in globalThis)),
      get: (target: any, key) => (typeof key === 'string' && Object.prototype.hasOwnProperty.call(target, key) ? target[key] : (typeof key === 'string' ? () => undefined : undefined)),
      set: (target: any, key, value) => { target[key] = value; return true; },
    });
    // eslint-disable-next-line no-new-func
    return new Function('scope', `with (scope) {\n${sources.join('\n')}\nreturn ${exported};\n}`)(scope);
  };

  it('R20-INTRO-RETIRED-01: the retire instant is the contract\'s, to the second', () => {
    const tact = readFileSync('contracts18/contracts/IntroShard.tact', 'utf8');
    const constant = (name: string) => Number(new RegExp(`const ${name}: Int = (\\d+);`).exec(tact)?.[1]);
    expect(tact).toContain('throwUnless(13683, now() > (self.epoch + 2) * 86400 + IS_INTRO_RETENTION + IS_RETIRE_SLACK);');
    const after = 2 * 86_400 + constant('IS_INTRO_RETENTION') + constant('IS_RETIRE_SLACK');
    const may = liftWith({ chainNowSec: () => 0, WALLET_CLOCK_TOLERANCE_MS: 60_000 }, [line('const INTRO_SHARD_RETIRABLE_AFTER_EPOCH_START_SEC = '), fn('function introShardMayBeRetired(epoch, nowSec = chainNowSec()) {')], 'introShardMayBeRetired');
    const epoch = 20743;
    expect([may(epoch, epoch * 86_400 + after - 60), may(epoch, epoch * 86_400 + after - 59)]).toEqual([false, true]);
    expect(may(Number.NaN, 1e12)).toBe(false);
  });

  it('R20-INTRO-RETIRED-02: a Retry finding no shard past that instant asks the wallet — ran or unknown: nothing paid; never ran: a new INTRO', async () => {
    const run = async ({ nowSec, fate }: { nowSec: number; fate: string }) => {
      const asked: any[] = [];
      const env: any = {
        walletOfSend: () => ({ address: 'A' }), localRecipientKeyPair: { keyId: new Uint8Array(32) }, localIdentity: {},
        globalThis: { plathoWalletRpcTransport: { runGetMethod: async () => ({}) } }, convKeyStore: {}, walletSessionGeneration: 1,
        createEntryReader: () => async () => null, createScanPageReader: () => async () => null,
        confirmIntroCreatedAt: async (opts: any) => (opts?.reportAbsence ? { absent: 'no-shard' } : null),
        introSendBytesDead: () => true, chainNowSec: () => nowSec, WALLET_CLOCK_TOLERANCE_MS: 60_000, awaitWalletChainClock: async () => {},
        walletExternalOutcomeNow: async (...args: any[]) => { asked.push(args); return fate; },
        pricedGenerationMovedAt: () => false,
        resolveRecipientWalletForThread: async () => { throw new Error('MINT'); },
      };
      const attempt = liftWith(env, [line('const INTRO_SHARD_RETIRABLE_AFTER_EPOCH_START_SEC = '), fn('function introShardMayBeRetired(epoch, nowSec = chainNowSec()) {'),
        fn('async function attemptIntroFirstContactDirect(context, owner = undefined) {')], 'attemptIntroFirstContactDirect');
      const message: any = { introDirectSend: { boc: 'b64', seqno: 40, validUntil: 1, epoch: 20743, bucket: 0, expectedEntryId: 0, r: 'r', viewTag: 1 } };
      try { await attempt({ thread: { id: 'dm:x' }, message }, 'A'); return { outcome: 'returned', asked: asked.length }; } catch (error: any) {
        return { outcome: error.message === 'MINT' ? 'minted' : error.code, asked: asked.length };
      }
    };
    const retireAt = 20743 * 86_400 + 2 * 86_400 + 604_800 + 345_600;
    expect(await run({ nowSec: retireAt + 1, fate: 'consumed' }), 'MEASURED before: minted — a second INTRO paid under a new K_root').toEqual({ outcome: 'INTRO_RETIRED_UNPROVEN', asked: 1 });
    expect(await run({ nowSec: retireAt + 1, fate: 'unknown' })).toEqual({ outcome: 'INTRO_RETIRED_UNPROVEN', asked: 1 });
    expect(await run({ nowSec: retireAt + 1, fate: 'replaced' }), 'its seqno ran another body: these bytes never ran').toEqual({ outcome: 'minted', asked: 1 });
    expect(await run({ nowSec: retireAt + 1, fate: 'expired' })).toEqual({ outcome: 'minted', asked: 1 });
    expect(await run({ nowSec: retireAt - 60, fate: 'consumed' }), 'before the instant (and its minute) an absent shard is one never written: minted, the wallet not asked').toEqual({ outcome: 'minted', asked: 0 });
    const said = liftWith({ t: (key: string) => key, privateSendPreflightStatusText: () => 'x' }, [fn('function privateSendBlockedStatusText(error) {')], 'privateSendBlockedStatusText');
    expect(said({ code: 'INTRO_RETIRED_UNPROVEN' }), 'kept as a token, said in the reader\'s language [round 21 — A9]').toBe('not confirmed: first contact cleared from the chain');
    expect(said({ code: 'OTHER' })).toBe('not sent: x');
  });
});

describe('R20 — the INTRO funnel sheds bytes the wallet refused to post [B6 / F3-5, r19 A2\'s twin]', () => {
  it('R20-INTRO-KEEP-01: a refused keep clears the first contact\'s send state before anything could restore it; the CONV twin does the same', () => {
    const intro = code(fn('async function attemptIntroFirstContactDirect(context, owner = undefined) {'));
    const shed = intro.indexOf("if (error?.code === 'PLATHO_SIGNED_NOT_KEPT') {");
    expect(shed, 'MEASURED before: the refused bytes stayed on message.introDirectSend and the next attempt re-broadcast them').toBeGreaterThan(-1);
    const body = intro.slice(shed, intro.indexOf('throw error;', shed));
    expect(body).toContain('if (message.introDirectSend === pending) message.introDirectSend = null;');
    expect(shed, 'shed before a built copy could be put back').toBeLessThan(intro.indexOf('if (!pending.boc && error?.builtBoc) {'));
    expect(shed).toBeGreaterThan(intro.indexOf('const result = await publishIntroLane('));
    const wallet = readFileSync('web/platho-wallet.mjs', 'utf8');
    const refusal = wallet.slice(wallet.indexOf("refusal.code = 'PLATHO_SIGNED_NOT_KEPT';"), wallet.indexOf('throw refusal;'));
    expect(refusal).not.toContain('builtBoc');
    expect(code(app)).toContain('message.convDirectSend = null;');
  });
});

describe('R20 — a name or a gift is sent only while it is still this wallet\'s [B5 / F3-3]', () => {
  const liftWith = (env: Record<string, any>, sources: string[], exported: string) => {
    const scope = new Proxy(env, {
      has: (target, key) => typeof key === 'string' && (Object.prototype.hasOwnProperty.call(target, key) || !(key in globalThis)),
      get: (target: any, key) => (typeof key === 'string' && Object.prototype.hasOwnProperty.call(target, key) ? target[key] : (typeof key === 'string' ? () => undefined : undefined)),
      set: (target: any, key, value) => { target[key] = value; return true; },
    });
    // eslint-disable-next-line no-new-func
    return new Function('scope', `with (scope) {\n${sources.join('\n')}\nreturn ${exported};\n}`)(scope);
  };
  const env = (owner: string, signed: any[]) => ({
    requireNoPendingServiceWorkerAppShellReload: () => {}, requirePlathoWallet: () => ({ address: 'EQ_ME' }), assertWalletGramAtLeast: async () => {},
    USERNAME_NFT_TRANSFER_VALUE_NANOTONS: 20_000_000n, TELEGRAM_GIFT_TRANSFER_VALUE_NANOTONS: 50_000_000n, walletSendFeeReserveNanotons: () => 0n,
    verifyOwnedUsernameNft: async () => ({ authoritative: true, owner_wallet: owner }), verifyTelegramGiftItemOnChain: async () => ({ ownerWallet: owner }),
    sameWalletAddress: (a: any, b: any) => Boolean(a) && a === b, parseTonAddress: (a: string) => ({ raw: a }), t: (key: string) => key,
    deleteStoredUsernameNftList: async () => {}, deleteStoredTelegramGiftList: async () => {}, telegramGiftListCache: new Map(),
    buildUsernameNftTransferBody: () => ({}), nextUsernameNftTransferQueryId: () => 1n, createWalletTransaction: (messages: any) => messages,
    tonCell: { bytesToBase64: () => '' }, serializeBoc: () => new Uint8Array(), sendPlathoWalletTransaction: async (_w: any, tx: any) => { signed.push(tx); },
    readLinkedPlathoUsername: () => null, canonicalUsernameDisplay: (x: any) => String(x ?? ''), removeKnownPlathoUsername: () => {}, renderWalletIdentity: () => {},
    wornGiftTheme: null, unwearTelegramGift: () => {}, broadcastMayHaveLanded: () => false,
  });
  it('R20-TRANSFER-OWNER-01: moved elsewhere since the list was read — refused with its words, nothing signed; still ours — signed', async () => {
    for (const [start, exported, item, refusal] of [
      ['async function submitUsernameNftTransfer(nft, recipient) {', 'submitUsernameNftTransfer', { itemAddress: 'EQ_NAME', label: 'hunter' }, 'username.noLongerYours'],
      ['async function submitTelegramGiftTransfer(gift, recipient) {', 'submitTelegramGiftTransfer', { itemAddress: 'EQ_GIFT' }, 'gift.noLongerYours'],
    ] as const) {
      const signed: any[] = [];
      const send = liftWith(env('EQ_SOMEONE_ELSE', signed), [fn(start)], exported);
      await expect(send(item, 'EQ_FRIEND'), 'MEASURED before: signed, the item refused it, the fees spent, "sent" said').rejects.toThrow(refusal);
      expect(signed.length).toBe(0);
      const mine: any[] = [];
      await liftWith(env('EQ_ME', mine), [fn(start)], exported)(item, 'EQ_FRIEND');
      expect(mine.length).toBe(1);
    }
  });
});

describe('R20 — the card\'s latest-post line answers only the press that is still waited for [A8 / F1-3, F3-4, F4-2, F7-5, F4-11]', () => {
  const liftWith = (env: Record<string, any>, sources: string[], exported: string) => {
    const scope = new Proxy(env, {
      has: (target, key) => typeof key === 'string' && (Object.prototype.hasOwnProperty.call(target, key) || !(key in globalThis)),
      get: (target: any, key) => (typeof key === 'string' && Object.prototype.hasOwnProperty.call(target, key) ? target[key] : (typeof key === 'string' ? () => undefined : undefined)),
      set: (target: any, key, value) => { target[key] = value; return true; },
    });
    // eslint-disable-next-line no-new-func
    return new Function('scope', `with (scope) {\n${sources.join('\n')}\nreturn ${exported};\n}`)(scope);
  };
  const harness = ({ cached = [] as any[] } = {}) => {
    const calls: any[] = [];
    const answers: Array<(post: any) => void> = [];
    const env: any = {
      discoveryLatestState: () => ({ status: 'ready', preview: 'Chapter 1', createdAtMs: 1, entryId: '7.2.41' }),
      profileCardDialog: { hidden: false, classList: { contains: (name: string) => name === 'is-over-dialog' && env.overDialog } }, overDialog: false,
      actionDialog: { hidden: true }, closeActionDialog: () => { env.actionDialog.hidden = true; calls.push('dialog closed'); },
      closeProfileCardDialog: () => { env.profileCardDialog.hidden = true; calls.push('card closed'); },
      setView: (view: string) => { env.appShell.dataset.view = view; }, appShell: { dataset: { view: 'public' } },
      publicChannelViewOpen: true, publicChannelViewWallet: 'EVA', publicPostDetailOpen: false, publicPostDetailItem: null,
      openPublicChannelView: (source: any) => { env.publicChannelViewWallet = source.authorWallet; calls.push(['channel', source.authorWallet]); },
      openPublicPostDetail: (post: any) => { env.publicPostDetailOpen = true; env.publicPostDetailItem = post; calls.push(['post', post.entryId, post.authorWallet]); },
      renderPublicSurface: () => {}, walletSessionGeneration: 1, appNoticeFillToken: 0, t: (k: string) => k, PERMALINK_OPENING_NOTICE_MS: 1,
      showPermalinkNotice: (text: string) => { env.appNoticeFillToken += 1; calls.push(['notice', text]); },
      fetchPermalinkPostFromChain: (entryId: string, wallet: string) => new Promise((resolve) => { calls.push(['read', entryId, wallet]); answers.push(resolve); }),
      noteTonRpcRateLimit: () => false, console: { warn() {} },
      eachCachedPublicPost: (cb: any) => cached.forEach(cb), sameWalletAddress: (a: any, b: any) => Boolean(a) && a === b, sharedOriginalCopyCurrent: () => true,
    };
    const open = liftWith(env, [line('let profileCardLatestPostPress = '), fn('function heldLatestPost(entryId, wallet) {'), fn('function publicScreenSnapshot() {'),
      fn('function sameScreenSnapshot(a, b) {'), fn('async function openProfileCardLatestPost(wallet) {')], 'openProfileCardLatestPost');
    return { env, calls, open, answer: (post: any, index = answers.length - 1) => answers[index](post) };
  };
  const post = { entryId: '7.2.41', authorWallet: 'EVA' };

  it('R20-LATEST-01: the person moved on — another channel, Private, a lock, a second card — the late answer opens nothing and leaves the notice alone', async () => {
    for (const moveOn of [
      (env: any) => { env.publicChannelViewWallet = 'SOMEONE_ELSE'; },
      (env: any) => { env.appShell.dataset.view = 'private'; },
      (env: any) => { env.walletSessionGeneration += 1; },
      (env: any) => { env.profileCardDialog.hidden = false; },
    ]) {
      const h = harness();
      const pending = h.open('EVA');
      await settle();
      moveOn(h.env);
      h.env.appNoticeFillToken += 1;
      h.answer(post);
      expect(await pending, 'MEASURED before: the post opened over whatever was on screen at +31 s').toBe(false);
      expect(h.calls.filter((c) => Array.isArray(c) && (c[0] === 'post' || c[0] === 'channel'))).toEqual([]);
      expect(h.calls.filter((c) => Array.isArray(c) && c[0] === 'notice' && c[1] === ''), 'the other notice is not emptied').toEqual([]);
    }
    const h = harness();
    const pending = h.open('EVA');
    await settle();
    h.answer(post);
    expect(await pending).toBe(true);
    expect(h.calls.at(-1)).toEqual(['post', '7.2.41', 'EVA']);
    expect(h.calls.some((c) => Array.isArray(c) && c[0] === 'notice' && c[1] === '')).toBe(true);
  });

  it('R20-LATEST-02: only the newest press answers; a post already held opens at once, by entry AND author; a card over a dialog takes the dialog along', async () => {
    const h = harness();
    const first = h.open('EVA');
    await settle();
    const second = h.open('EVA');
    await settle();
    h.answer(post, 0);
    h.answer(post, 1);
    expect([await first, await second]).toEqual([false, true]);
    const held = harness({ cached: [{ entryId: '7.2.41', authorWallet: 'OTHER' }, post] });
    expect(await held.open('EVA')).toBe(true);
    expect(held.calls.filter((c) => Array.isArray(c) && c[0] === 'read'), 'MEASURED before: every press read the chain, up to 30 s').toEqual([]);
    expect(held.calls.at(-1)).toEqual(['post', '7.2.41', 'EVA']);
    const over = harness({ cached: [post] });
    over.env.overDialog = true; over.env.actionDialog.hidden = false;
    await over.open('EVA');
    expect(over.calls.slice(0, 2), 'MEASURED before: the post opened under the still-open members card').toEqual(['card closed', 'dialog closed']);
  });
});

describe('R20 — a contact\'s names cost what a card may cost [A7 / F1-2, F6-1, F6-7]', () => {
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
  const card = async (count: number, { failOnce = null as string | null, indexHangs = false } = {}) => {
    const owned: any = await import('../web/username-nft-owned.mjs');
    const proofs: Array<{ item: string; priority: string }> = [];
    const failed = new Set<string>();
    const env: any = {
      requireUsernameRegistryAddress: () => `0:${'cc'.repeat(32)}`, resolveUsernameRegistryProvider: async () => ({}), resolveUsernameNftItemProvider: async () => ({}),
      rawWalletAddress: (w: any) => w, cachedChannelProfile: () => null, readLinkedPlathoUsername: () => null,
      usernameNftCandidateFromLabel: async () => null, console: { warn() {} },
      resolveAuthoritativeUsernameItemOwnership: async ({ itemAddress, itemCallOptions }: any) => {
        proofs.push({ item: itemAddress, priority: itemCallOptions.priority });
        if (failOnce === itemAddress && !failed.has(itemAddress)) { failed.add(itemAddress); throw new Error('500'); }
        return { authoritative: true, owner_wallet: OWNER, name_hash: 1n, item_state: {} };
      },
      discoverUsernameNftAddresses: async ({ fetchImpl }: any) => {
        env.indexAsked += 1;
        if (indexHangs) {
          return fetchImpl('https://index.invalid/', {}).then(() => []);
        }
        return Array.from({ length: count }, (_, i) => ({ itemAddress: item(i + 1), proposedName: null, proposedImage: null }));
      },
      collectOwnedUsernameNfts: owned.collectOwnedUsernameNfts, indexAsked: 0,
      profileCardSubject: OWNER, profileCardDialog: { hidden: false },
      fetch: (_url: string, init: any) => new Promise((_resolve, reject) => { init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))); }),
      AbortController, setTimeout: (cb: any) => setTimeout(cb, 5), clearTimeout,
    };
    const load = liftWith(env, [line('const CONTACT_NAME_CACHE_TTL_MS = '), line('const CONTACT_NAME_INDEX_TIMEOUT_MS = '), line('const CONTACT_NAME_PROOF_CACHE_LIMIT = '),
      line('const CONTACT_NAME_PROOF_TTL_MS = '), line('const CONTACT_NAME_FIRST_SCREEN = '),
      line('const contactUsernameNftLists = '), line('const contactUsernameNftProofs = '), fn("function contactNameChainReadOptions(priority = 'profile') {"),
      fn("async function verifyContactUsernameNft(itemAddress, { priority = 'profile' } = {}) {"), fn('function fetchWithin(ms) {'),
      fn('async function loadUsernameNftsForWallet(wallet, own, { onProgress = null } = {}) {')], 'loadUsernameNftsForWallet');
    return { env, proofs, load: () => load(OWNER, false) };
  };

  it('R20-NAMES-01: 60 names — one proof each, none critical; a reopen within the cache costs nothing; the list says when it is the index\'s first page', async () => {
    const c = await card(60);
    const first = await c.load();
    expect([first.owned.length, first.complete]).toEqual([60, true]);
    expect(c.proofs.length).toBe(60);
    expect(c.proofs.slice(0, 24).every((p) => p.priority === 'profile'), 'MEASURED before: 121 requests at \'critical\', ahead of every message lane').toBe(true);
    expect(c.proofs.slice(24).every((p) => p.priority === 'background')).toBe(true);
    await c.load();
    expect([c.proofs.length, c.env.indexAsked], 'MEASURED before: every reopen asked the index and proved all 60 again').toEqual([60, 1]);
    const many = await card(200);
    expect((await many.load()).capped, 'MEASURED before: 200 of 600 shown as the whole list').toBe(true);
    expect((await (await card(60)).load()).capped).toBe(false);
  });

  it('R20-NAMES-02: the card closed stops the proofs; a failed proof makes the retry prove that one alone; a hung index ends', async () => {
    const c = await card(60);
    let left = 3;
    const realVerify = c.env.resolveAuthoritativeUsernameItemOwnership;
    c.env.resolveAuthoritativeUsernameItemOwnership = async (args: any) => { left -= 1; if (left === 0) c.env.profileCardDialog.hidden = true; return realVerify(args); };
    const closed = await c.load();
    expect([c.proofs.length, closed.stopped, closed.complete], 'MEASURED before: a closed card went on proving all 60').toEqual([3, true, false]);
    const flaky = await card(60, { failOnce: item(7) });
    expect((await flaky.load()).complete).toBe(false);
    const before = flaky.proofs.length;
    expect((await flaky.load()).complete).toBe(true);
    expect(flaky.proofs.slice(before).map((p) => p.item), 'MEASURED before: the retry proved all 60 again').toEqual([item(7)]);
    const hung = await card(0, { indexHangs: true });
    const answer = await hung.load();
    expect([answer.complete, answer.indexerError?.message], 'MEASURED before: a hung index never let the lane settle').toEqual([false, 'aborted']);
  });
});

describe('R20 — Back and the keyboard know the profile card [A9 / F4-1, A10 / F4-3]', () => {
  const liftWith = (env: Record<string, any>, sources: string[], exported: string) => {
    const scope = new Proxy(env, {
      has: (target, key) => typeof key === 'string' && (Object.prototype.hasOwnProperty.call(target, key) || !(key in globalThis)),
      get: (target: any, key) => (typeof key === 'string' && Object.prototype.hasOwnProperty.call(target, key) ? target[key] : (typeof key === 'string' ? () => undefined : undefined)),
      set: (target: any, key, value) => { target[key] = value; return true; },
    });
    // eslint-disable-next-line no-new-func
    return new Function('scope', `with (scope) {\n${sources.join('\n')}\nreturn ${exported};\n}`)(scope);
  };

  it('R20-BACK-01: Back closes the card first and keeps the channel under it; the Back affordance counts the card', () => {
    const card: any = { hidden: false, classList: { contains: () => false } };
    const closed: string[] = [];
    const env: any = {
      document: { getElementById: (id: string) => (id === 'profileCardDialog' ? card : null) },
      closeProfileCardDialog: () => { card.hidden = true; closed.push('card'); }, syncNavBackAffordance: () => {},
      exitComposerMaximize: () => false, appShell: { dataset: {} }, publicPane: { dataset: { channelOpen: 'true' } },
      closePublicChannelView: () => closed.push('channel'), composerIsMaximized: () => false,
    };
    const api = liftWith(env, [fn('function profileCardShownNow() {'), fn('function navOverlayIsOpen() {'), fn('function closeNavOverlay() {')], '{ closeNavOverlay, navOverlayIsOpen }');
    expect(api.closeNavOverlay()).toBe(true);
    expect(closed, 'MEASURED before: the channel went, the card stayed').toEqual(['card']);
    expect(api.closeNavOverlay()).toBe(true);
    expect(closed).toEqual(['card', 'channel']);
    env.publicPane.dataset.channelOpen = 'false';
    card.hidden = false;
    expect(api.navOverlayIsOpen()).toBe(true);
    card.hidden = true;
    expect(api.navOverlayIsOpen()).toBe(false);
  });

  it('R20-BACK-02: what boot calls never reads the late const — installNavBackHandling runs above the line that declares profileCardDialog', () => {
    const shown = code(fn('function profileCardShownNow() {'));
    expect(shown, 'a TDZ read here throws at boot').not.toMatch(/\bprofileCardDialog\b(?!')/);
    expect(app.indexOf('installNavBackHandling();')).toBeLessThan(app.indexOf("const profileCardDialog = document.querySelector('#profileCardDialog');"));
    expect(code(fn('function navOverlayIsOpen() {'))).not.toMatch(/\bprofileCardDialog\b/);
  });

  it('R20-FOCUS-01: the focus goes into the card at its opening, back to its door at its close, and stays in the card across a repaint', () => {
    const open = code(fn('async function openProfileCardDialog(subject) {'));
    const opening = open.indexOf('const opening = profileCardDialog.hidden || reopening;');
    expect(opening, 'MEASURED before: BODY at the opening').toBeGreaterThan(-1);
    expect(open.indexOf('if (opening) profileCardReturnFocus = dialogReturnFocusTarget();')).toBeGreaterThan(opening);
    expect(open.indexOf('if (opening) profileCardReturnFocus = dialogReturnFocusTarget();')).toBeLessThan(open.indexOf('profileCardDialog.hidden = false;'));
    expect(open).toMatch(/if \(opening\) \{\s*try \{ profileCardDialog\.querySelector\('#profileCardCloseButton'\)\?\.focus\(\{ preventScroll: true \}\); \}/);
    const close = code(fn('function closeProfileCardDialog() {'));
    expect(close).toContain('restoreDialogFocus(returnFocus);');
    expect(close.indexOf('const returnFocus = profileCardReturnFocus;')).toBeLessThan(close.indexOf('profileCardReturnFocus = null;'));
    const focusedLog: string[] = [];
    const makeButton = (key: string) => ({ dataset: { i18n: key }, getAttribute: () => null, focus: () => focusedLog.push(key) });
    let buttons = [makeButton('profileCard.channel'), makeButton('profileCard.chat')];
    const row: any = { contains: (el: any) => buttons.includes(el), querySelectorAll: () => buttons };
    const env: any = { profileCardActions: row, document: { activeElement: buttons[1] }, profileCardDialog: { querySelector: () => ({ focus: () => focusedLog.push('close') }) },
      renderProfileCardActionsNow: () => { buttons = [makeButton('profileCard.channel'), makeButton('profileCard.chat')]; } };
    const render = liftWith(env, [fn('function refocusInProfileCard(target) {'), fn('function renderProfileCardActions(raw, own) {')], 'renderProfileCardActions');
    render('W', false);
    expect(focusedLog, 'MEASURED before: the repaint dropped the focus to BODY').toEqual(['profileCard.chat']);
    env.document.activeElement = buttons[0];
    env.renderProfileCardActionsNow = () => { buttons = [makeButton('profileCard.chat')]; };
    render('W', false);
    expect(focusedLog.at(-1)).toBe('close');
  });
});

describe('R20 — the card closes with the lock; its menu from the Public tab; the words the doors left [B2 / F7-4, F4-10, F1-7]', () => {
  it('R20-CARD-LOCK-01: the lock closes an open profile card', () => {
    const overlays = code(fn('function closeSessionOverlays() {'));
    expect(overlays, 'MEASURED before: address, names and "Mint .ath name" beside the unlock prompt').toContain('if (profileCardDialog && !profileCardDialog.hidden) closeProfileCardDialog();');
  });

  it('R20-CARD-MENU-01: a card opened from the Public tab offers no pin and no mute; one opened elsewhere keeps both; the safety code stays', () => {
    const menu = code(fn('function showProfileCardMoreMenu(raw, own, anchor) {'));
    const gate = menu.indexOf('if (!profileCardOpenedFromPublic) {');
    expect(gate, 'MEASURED before: "Pin contact" and "Stop marking unread" under the card\'s chevron from the Public tab').toBeGreaterThan(-1);
    const guarded = menu.slice(gate, menu.indexOf("if (!own) row('chat.safetyCode'"));
    expect(guarded).toContain("'chat.muteHint'");
    expect(guarded).toContain("'chat.pinHint'");
    const open = code(fn('async function openProfileCardDialog(subject) {'));
    expect(open).toContain('if (opening) profileCardOpenedFromPublic = isPublicViewActive();');
  });

  it('R20-WORDS-01: the post chevron is named for its menu, to the eye and the ear; the latest-post line says its time', () => {
    const chevron = code(app);
    expect(chevron).toContain("identityButton.title = t('profileCard.actionMore');");
    expect(chevron).toContain("identityButton.setAttribute('aria-label', t('profileCard.actionMore'));");
    expect(chevron, 'MEASURED before: "Choose display name"').not.toContain("identityButton.title = t('public.chooseDisplayName');");
    const line = code(fn('function buildDiscoveryLatestNode(wallet) {'));
    expect(line).toContain("block.setAttribute('aria-label', `${t('public.latestPost')}${spokenClock ? `, ${spokenClock}` : ''}: ${state.preview}`);");
  });
});

describe('R20 — the card\'s layout: the hover keeps AA, the insets, the words that shrink [B11 / F4-6, B12 / F4-7, B13 / F4-8]', () => {
  const css = readFileSync('web/styles.css', 'utf8');
  const ruleOf = (selector: string) => { const at = css.indexOf(`${selector} {`); if (at < 0) throw new Error(`no rule: ${selector}`); return css.slice(at, css.indexOf('}', at) + 1); };
  it('R20-LAYOUT-01: the latest-post line\'s hover turns its rule, not its plate', () => {
    const hover = ruleOf('.discovery-card-latest.is-openable:hover');
    expect(hover, 'MEASURED before: a --a10 plate took the light texts to 4.28:1').not.toMatch(/background/);
    expect(hover).toContain('border-left-color: var(--accent);');
  });
  it('R20-LAYOUT-02: the card fits inside the insets the backdrop pads by; the row\'s words shrink before they spill', () => {
    const card = ruleOf('.profile-card-dialog');
    expect(card, 'MEASURED before: the ✕ at y 63-101 under Telegram\'s controls, the foot 10 px off screen').toContain('max(12px, var(--app-safe-area-top, env(safe-area-inset-top)))');
    expect(card).toContain('max(12px, var(--app-safe-area-bottom, env(safe-area-inset-bottom)))');
    expect(css.indexOf('.profile-card-dialog {'), 'after the general dialog rule, so it wins').toBeGreaterThan(css.indexOf('.action-dialog {'));
    const action = ruleOf('.profile-card-action');
    expect(action, 'MEASURED before: the ja word for Channel, 65 px in a 60-px button at 320 px').toContain('font-size: clamp(12px, 3.6vw, 14px);');
    expect(action).toContain('padding: 10px clamp(6px, 2vw, 12px);');
  });
});

describe('R20 — a followed channel\'s proofs are paid once [A13 / F6-3, F6-5]', () => {
  const lift = (env: Record<string, any>, sources: string[], exported: string, prelude = '') => {
    const names = Object.keys(env);
    // eslint-disable-next-line no-new-func
    return new Function(...names, [prelude, ...sources, `return ${exported};`].join(String.fromCharCode(10)))(...names.map((n) => env[n]));
  };
  it('R20-PROFILES-01: 1,208 followed channels past the 512 — none evicted, the strangers still bounded', () => {
    const bound = lift({}, [line('const PUBLIC_CHANNEL_PROFILE_CACHE_MAX = '), line('const PUBLIC_CHANNEL_PROFILE_KEPT_CEILING = '),
      line('const PUBLIC_CHANNEL_PROFILE_CACHE_MAX_CHARS = '),
      fn('function boundChannelProfileCache(cache, keptFirst = null, maxChars = PUBLIC_CHANNEL_PROFILE_CACHE_MAX_CHARS) {')], 'boundChannelProfileCache');
    const cache: Record<string, any> = {};
    const followed = new Set<string>();
    for (let i = 0; i < 1208; i += 1) { cache[`F${i}`] = { fetchedAt: i, verifiedGift: { itemAddress: `g${i}` } }; followed.add(`F${i}`); }
    for (let i = 0; i < 900; i += 1) cache[`S${i}`] = { fetchedAt: 5000 + i };
    const kept = bound(cache, followed);
    expect([...followed].filter((key) => !kept[key]).length, 'MEASURED before: 696 followed profiles evicted at every pass').toBe(0);
    expect(Object.keys(kept).filter((key) => key.startsWith('S')).length).toBe(512);
    expect(kept.S899 && !kept.S387).toBe(true);
  });

  it('R20-PROFILES-02: the same gift proven again moves its proof\'s time — at most once an hour; a different item is a change', () => {
    const cacheState: Record<string, any> = { K: { verifiedGift: { itemAddress: 'gift-1', slug: 's', number: 1, verifiedAt: 1_000 } } };
    let persisted = 0;
    const module = new Function('state', 'persist', 'overlay', `let publicChannelProfileCache = state.cache; const pendingChannelProfileOverlay = overlay;
      const persistChannelProfileCache = persist; const publicChannelViewOpen = false; const publicChannelViewWallet = null;
      const channelProfileCacheKey = () => ''; const renderPublicChannelView = () => {}; const refreshChannelAppearanceUi = () => {}; const applyGiftAppearance = () => { state.applied += 1; };
      ${fn('function applyVerifiedChannelGift(profileKey, verifiedGift) {')}
      return { apply: applyVerifiedChannelGift, get cache() { return publicChannelProfileCache; } };`);
    const state: any = { cache: cacheState, applied: 0 };
    const m = module(state, () => { persisted += 1; }, new Map());
    m.apply('K', { itemAddress: 'gift-1', slug: 's', number: 1, verifiedAt: 1_000 + 600 });
    expect([m.cache.K.verifiedGift.verifiedAt, persisted]).toEqual([1_000, 0]);
    m.apply('K', { itemAddress: 'gift-1', slug: 's', number: 1, verifiedAt: 1_000 + 86_400 });
    expect([m.cache.K.verifiedGift.verifiedAt, persisted, state.applied], 'MEASURED before: the first proof\'s stamp forever — every pass after 24 h proved again').toEqual([87_400, 1, 0]);
    m.apply('K', { itemAddress: 'gift-2', slug: 's', number: 2, verifiedAt: 90_000 });
    expect([m.cache.K.verifiedGift.itemAddress, state.applied]).toEqual(['gift-2', 1]);
  });
});

describe('R20 — a list draw computes and writes what moved, near the view first [A14 / F6-4]', () => {
  const liftWith = (env: Record<string, any>, sources: string[], exported: string) => {
    const scope = new Proxy(env, {
      has: (target, key) => typeof key === 'string' && (Object.prototype.hasOwnProperty.call(target, key) || !(key in globalThis)),
      get: (target: any, key) => (typeof key === 'string' && Object.prototype.hasOwnProperty.call(target, key) ? target[key] : (typeof key === 'string' ? () => undefined : undefined)),
      set: (target: any, key, value) => { target[key] = value; return true; },
    });
    // eslint-disable-next-line no-new-func
    return new Function('scope', `with (scope) {\n${sources.join('\n')}\nreturn ${exported};\n}`)(scope);
  };
  const node = (writes: string[], name: string) => {
    let text = ''; let cls = ''; const attrs = new Map<string, string>();
    return {
      dataset: {} as any, hidden: false,
      get textContent() { return text; }, set textContent(v: string) { writes.push(`${name}.text`); text = v; },
      get className() { return cls; }, set className(v: string) { writes.push(`${name}.class`); cls = v; },
      getAttribute: (k: string) => attrs.get(k) ?? null, setAttribute: (k: string, v: string) => { writes.push(`${name}.${k}`); attrs.set(k, v); },
      querySelector: () => null, append: () => {},
    };
  };

  it('R20-LIST-01: a row drawn again with nothing moved is not written at all; what moved is written alone', () => {
    const writes: string[] = [];
    const item: any = node(writes, 'row');
    item._refs = { avatar: node(writes, 'avatar'), name: node(writes, 'name'), preview: node(writes, 'preview'), state: node(writes, 'state'), time: node(writes, 'time'), side: node(writes, 'side') };
    let avatarDraws = 0;
    const thread: any = { id: 'dm:x', preview: 'see you', state: '', unreadCount: 0, messages: [{ at: 1 }] };
    const apply = liftWith({
      threadUnreadCount: (th: any) => th.unreadCount, activeThreadId: null, threadAvatarKey: (th: any) => `${th.avatarImageUrl ?? ''}`,
      setThreadAvatarNode: () => { avatarDraws += 1; }, threadDisplayTone: () => null, isSavedMessagesThread: () => false, threadDisplayLabel: () => 'Ann', t: (k: string) => k,
      stripInlineFormatting: (s: string) => s, threadStateLabel: () => '', messageCreatedAtMs: (m: any) => m.at, formatThreadListTimestamp: () => '12:00', tPlural: () => '',
    }, [fn('function setTextIfChanged(node, text) {'), fn('function setAttributeIfChanged(node, name, value) {'),
      fn("function setIdentityLabel(node, thread, baseClass = 'identity-label') {"), fn('function applyThreadRow(item, thread) {')], 'applyThreadRow');
    apply(item, thread);
    const first = writes.length;
    expect(first).toBeGreaterThan(0);
    writes.length = 0;
    apply(item, thread);
    expect([writes, avatarDraws], 'MEASURED before: every row rewritten at every draw — 594-707 ms of style and layout at 10,000').toEqual([[], 1]);
    thread.preview = 'running late';
    apply(item, thread);
    expect(writes).toEqual(['preview.text']);
    thread.avatarImageUrl = 'blob:face';
    writes.length = 0;
    apply(item, thread);
    expect(avatarDraws, 'the avatar redrawn when what it is drawn from moved').toBe(2);
  });

  it('R20-LIST-02: the avatar key names every input its writer reads', () => {
    const writer = code(fn('function setThreadAvatarNode(node, thread) {'));
    const key = code(fn('function threadAvatarKey(thread) {'));
    const calls = new Set([...writer.matchAll(/(\w+)\(thread\)/g)].map((m) => m[1]));
    const fields = new Set([...writer.matchAll(/thread\?\.(\w+)/g)].map((m) => m[1]));
    expect(calls.size).toBeGreaterThan(5);
    for (const name of calls) expect(key, `setThreadAvatarNode reads ${name}(thread)`).toContain(`${name}(thread)`);
    for (const name of fields) expect(key, `setThreadAvatarNode reads thread?.${name}`).toContain(`thread?.${name}`);
  });

  it('R20-LIST-03: a row far from the view is patched in idle time after the draws quiet down; one near, one focused, or with no observer, in the draw', () => {
    const patched: string[] = [];
    const timers: Array<() => void> = [];
    const env: any = {
      IntersectionObserver: class { observe() {} constructor(public cb: any) {} }, threadList: {},
      applyThreadRow: (row: any) => patched.push(row.name), document: { activeElement: null },
      setTimeout: (cb: () => void) => { timers.push(cb); return timers.length; }, clearTimeout: () => {}, requestIdleCallback: (cb: (d: any) => void) => timers.push(() => cb({ timeRemaining: () => 50, didTimeout: false })),
    };
    const api = liftWith(env, [fn('function threadRowNearObserver() {'), fn('function patchThreadRowNow(row) {'), fn('function patchThreadRow(row, thread) {'),
      fn('function sweepStaleThreadRows(deadline = null) {'), fn('function scheduleStaleThreadRowSweep({ fromDraw = true } = {}) {')], '{ patchThreadRow }');
    const row = (name: string, near: boolean | undefined) => ({ name, _near: near, isConnected: true, contains: () => false });
    const far = row('far', false); const near = row('near', true); const fresh = row('fresh', undefined);
    api.patchThreadRow(far, {}); api.patchThreadRow(near, {}); api.patchThreadRow(fresh, {});
    expect(patched, 'MEASURED before: all 10,000 rows computed in the draw (170-230 ms)').toEqual(['near', 'fresh']);
    while (timers.length) timers.shift()!();
    expect(patched).toEqual(['near', 'fresh', 'far']);
    const focused = { ...row('focused', false), contains: () => true };
    api.patchThreadRow(focused, {});
    expect(patched.at(-1)).toBe('focused');
    env.IntersectionObserver = undefined;
    const api2 = liftWith(env, [fn('function threadRowNearObserver() {'), fn('function patchThreadRowNow(row) {'), fn('function patchThreadRow(row, thread) {'),
      fn('function sweepStaleThreadRows(deadline = null) {'), fn('function scheduleStaleThreadRowSweep({ fromDraw = true } = {}) {')], '{ patchThreadRow }');
    api2.patchThreadRow(row('old-engine', false), {});
    expect(patched.at(-1)).toBe('old-engine');
  });

  it('R20-LIST-04: the sort reads each dialog\'s activity once; a draw asks each thread\'s identity once', async () => {
    const order: any = await import('../web/thread-list-order.mjs');
    const threads = Array.from({ length: 2000 }, (_, i) => ({ id: i, at: (i * 7919) % 2000 }));
    let asked = 0;
    const sorted = order.orderThreadsForList(threads, { lastActivityMs: (th: any) => { asked += 1; return th.at; } });
    expect(asked, 'MEASURED before: once per comparison (~40,000 here)').toBe(2000);
    expect(sorted.slice(0, 3).map((th: any) => th.at)).toEqual([1999, 1998, 1997]);
    const draw = code(fn('function renderThreads() {'));
    const hydrated = draw.indexOf('threads.forEach(hydrateThreadDisplayFromContactStore);');
    expect(hydrated, 'the display choices land in the wrapper').toBeGreaterThan(-1);
    expect(hydrated, '...before the memo opens').toBeLessThan(draw.indexOf('renderThreads.drawMemo = {'));
    expect(draw).toContain('if (outer) renderThreads.drawMemo = null;');
  });
});

describe('R20 — the write-back goes oldest first across the whole store, carried or not, in one sort [A15 / F6-2, B9 / F2-4]', () => {
  const resecureSource = readFileSync('web/storage-resecure.mjs', 'utf8');
  const lifted = (start: string, prelude = '') => {
    // eslint-disable-next-line no-new-func
    return new Function(`${prelude}\n${sourceBlock(resecureSource, start)}\nreturn ${start.match(/function (\w+)/)![1]};`)();
  };
  const oldestFirst = lifted('function oldestFirst(spec, records) {', "const RESECURE_HISTORY_ORDER_INDEX = 'convOrder';");
  const walk = (records: any[]) => {
    const conversations = new Map<string, any[]>(); const unplaced: any[] = [];
    for (const record of records) { const v = record[1]; if (v?.t == null || !Number.isFinite(Number(v?.o))) { unplaced.push(record); continue; } if (!conversations.has(String(v.t))) conversations.set(String(v.t), []); conversations.get(String(v.t))!.push(record); }
    const lists = [...conversations.values()].map((l) => l.sort((a, b) => Number(a[1].o) - Number(b[1].o)));
    const ordered: any[] = [];
    for (let rank = 0; ordered.length + unplaced.length < records.length; rank += 1) for (const l of lists) if (rank < l.length) ordered.push(l[rank]);
    return [...ordered, ...unplaced];
  };
  const spec = { indexes: [{ name: 'convOrder' }] };

  it('R20-ORDER-01: the same order as the walk, in one sort — 10,000 conversations with one of 100,000 records well under a second', () => {
    const records: any[] = [];
    for (let c = 0; c < 40; c += 1) for (let i = 0; i < 1 + ((c * 7) % 13); i += 1) records.push([`k${c}-${i}`, { t: `t${c}`, o: 1000 * c + ((i * 5) % 13) }]);
    records.push(['bare', { t: null }]);
    records.sort(() => 0.5 - Math.random());
    expect(oldestFirst(spec, records).map((r: any) => r[0])).toEqual(walk(records).map((r) => r[0]));
    const big: any[] = [];
    for (let c = 0; c < 10_000; c += 1) big.push([`c${c}`, { t: `t${c}`, o: 1 }]);
    for (let i = 0; i < 100_000; i += 1) big.push([`h${i}`, { t: 'heavy', o: i }]);
    const started = performance.now();
    const out = oldestFirst(spec, big);
    const ms = performance.now() - started;
    expect(out.length).toBe(110_000);
    expect(ms, 'MEASURED before: 4,493 ms (1e9 rank visits) in one task').toBeLessThan(1_000);
  });

  it('R20-ORDER-02: carried out in parts, a write-back cut at a quarter keeps the oldest of every conversation and no hole', async () => {
    const fake: any = await import('fake-indexeddb');
    const resecure: any = await import('../web/storage-resecure.mjs');
    const indexedDB = new fake.IDBFactory();
    const name = `${resecure.RESECURE_HISTORY_DB_PREFIX}.r20order`;
    const req = (r: any) => new Promise<any>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const done = (tx: any) => new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    const open = indexedDB.open(name, 1);
    open.onupgradeneeded = () => { const s = open.result.createObjectStore('messages', { keyPath: 'id' }); s.createIndex('convOrder', ['t', 'o']); };
    const db = await req(open);
    const CONV = 200; const PER = 10;
    const tx = db.transaction('messages', 'readwrite');
    for (let c = 0; c < CONV; c += 1) {
      const base = Math.floor(Math.random() * 1e9);
      for (let i = 0; i < PER; i += 1) tx.objectStore('messages').put({ id: globalThis.crypto.randomUUID(), v: 2, t: `tag${c}`, o: base + i, x: 'y'.repeat(300) });
    }
    for (let i = 0; i < 3; i += 1) tx.objectStore('messages').put({ id: `legacy-${i}`, v: 1, x: 'z' });
    await done(tx);
    db.close();
    const memory = new Map<string, string>();
    const localStorage = { get length() { return memory.size; }, key: (i: number) => [...memory.keys()][i] ?? null, getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => { memory.set(k, String(v)); }, removeItem: (k: string) => { memory.delete(k); } };
    const carriage = { Blob, keyRange: fake.IDBKeyRange, chunkBytes: 16_384, batch: 64 };
    const snapshot = await resecure.snapshotOriginStorage({ indexedDB, localStorage, carryOut: carriage });
    const store = snapshot.databases.find((d: any) => d.name === name).stores[0];
    expect((store.chunks ?? []).length, 'carried in parts').toBeGreaterThan(10);
    await req(indexedDB.deleteDatabase(name));
    const order: Array<[string, number]> = [];
    const probe = indexedDB.open('r20-proto', 1); probe.onupgradeneeded = () => probe.result.createObjectStore('s');
    const pdb = await req(probe); const proto = Object.getPrototypeOf(pdb.transaction('s', 'readwrite').objectStore('s')); pdb.close();
    const put = proto.put;
    const unplaced: string[] = [];
    proto.put = function logged(this: any, value: any, key: any) { if (value && value.t !== undefined) order.push([value.t, value.o]); else if (value?.id) unplaced.push(value.id); return put.call(this, value, key); };
    try { await resecure.restoreOriginStorage(snapshot, { indexedDB, localStorage }); } finally { proto.put = put; }
    expect(order.length).toBe(CONV * PER);
    expect(unplaced.sort(), 'the records with no place come back too, after the placed ones').toEqual(['legacy-0', 'legacy-1', 'legacy-2']);
    const cut = order.slice(0, Math.floor(order.length / 4));
    const places = new Map<string, number[]>();
    for (const [t, o] of order) { if (!places.has(t)) places.set(t, []); places.get(t)!.push(o); }
    let oldestKept = 0; let holes = 0;
    for (const [t, all] of places) {
      all.sort((a, b) => a - b);
      const kept = new Set(cut.filter(([tt]) => tt === t).map(([, o]) => o));
      if (kept.has(all[0])) oldestKept += 1;
      let gap = false;
      for (const o of all) { if (kept.has(o)) { if (gap) { holes += 1; break; } } else gap = true; }
    }
    expect([oldestKept, holes], 'MEASURED before (2,000 x 20, cut at 25 %): 535 oldest kept, 1,986 with a hole').toEqual([CONV, 0]);
  });
});

describe('R20 — the quiet ones\' share is kept in requests [B10 / F6-6]', () => {
  it('R20-QUIET-01: three books\' takes in one minute stay within the share in REQUESTS; without a ceiling the address count is as before', () => {
    const take = (ceiling: number) => {
      // eslint-disable-next-line no-new-func
      const api = new Function(`${line('const quietSpent = ')}\n${line('const QUIET_BOOK_STALE_MS = ')}\n${fn('function takeQuietWithinShare(')}\nreturn takeQuietWithinShare;`)();
      const items = (n: number, cost: number, tag: string) => Array.from({ length: n }, (_, i) => ({ id: `${tag}${i}`, cost }));
      const share = 8 * 1_024;
      let requests = 0;
      for (const [book, waited] of [['private rooms', items(84, 57, 'r')], ['conversations', items(3_300, 1, 'c')], ['public rooms', items(18, 1, 'p')]] as const) {
        const taken = api(waited, { now: 1_000, quietAddresses: share, quietMs: 60_000, book, ceiling });
        const addresses = taken.reduce((sum: number, item: any) => sum + item.cost, 0);
        requests += Math.ceil(addresses / 1_024);
      }
      return requests;
    };
    expect(take(1_024), 'MEASURED before: 10 requests (5 + 4 + 1) for a share of 8').toBeLessThanOrEqual(8);
    expect(take(0), 'no ceiling handed in: counted in addresses, as before').toBe(10);
    expect(code(fn('function createRoomPassBook('))).toContain('ceiling: currentStatesBatchCeiling()');
    expect(code(app)).toContain("book: 'conversations', ceiling: currentStatesBatchCeiling() })");
  });
});

describe('R20 — the re-secure\'s mark is this origin\'s alone [A11 / F5-1]', () => {
  it('R20-COOKIE-01: written as __Host-, Path=/, Secure, no Domain; a sibling Mini App\'s cookie on tgcloud.ai is not read; the old name only where no one else can write it', async () => {
    const resecure: any = await import('../web/storage-resecure.mjs');
    expect(resecure.RESECURE_COOKIE).toBe('__Host-platho_resecure');
    const writer = sourceBlock(readFileSync('web/storage-resecure.mjs', 'utf8'), 'function setResecureCookie(document, value) {');
    expect(writer).toContain('`${RESECURE_COOKIE}=${value}; path=/; max-age=${RESECURE_COOKIE_MAX_AGE_S}; SameSite=Strict; Secure`');
    expect(writer, 'a __Host- cookie with a Domain is refused by the browser').not.toMatch(/[Dd]omain=/);
    const planted = { cookie: 'other=1; platho_resecure=writing-wallet' };
    expect([resecure.resecureWasInterrupted(planted, { hostname: 'app1234567.tgcloud.ai' }), resecure.resecureInterruptedHeldWallet(planted, { hostname: 'app1234567.tgcloud.ai' })],
      'MEASURED before: "securing was interrupted — import your phrase", and a full re-read owed at every unlock').toEqual([false, false]);
    expect(resecure.resecureInterruptedHeldWallet(planted, { hostname: 'platho.app' }), 'an older build\'s interrupted run on our own host still says so').toBe(true);
    expect(resecure.resecureInterruptedHeldWallet({ cookie: '__Host-platho_resecure=writing-wallet' }, { hostname: 'app1234567.tgcloud.ai' })).toBe(false);
    expect(resecure.resecureInterruptedHeldWallet({ cookie: '__Host-platho_resecure=writing-wallet' }, { hostname: 'platho.app' })).toBe(true);
  });
});

describe('R20 — no re-secure where no old build ever wrote [B15 / F7-I2]', () => {
  it('R20-RESECURE-HOST-01: on Telegram\'s shared host the run settles at once — no lock, no "Securing storage…", no probe', async () => {
    const resecure: any = await import('../web/storage-resecure.mjs');
    expect([resecure.resecureHostShared('app1234567.tgcloud.ai'), resecure.resecureHostShared('platho.app'), resecure.resecureHostShared('www.platho.app')]).toEqual([true, false, false]);
    const stored = new Map<string, string>();
    const seen: string[] = [];
    const run = (shared: boolean) => {
      // eslint-disable-next-line no-new-func
      return new Function('globalThis', 'resecureHostShared', 'RESECURE_STATE_KEY', 'RESECURE_CLEARED_KEY', 'RESECURE_ATTEMPTS_KEY', 'RESECURE_PARKED_UNTIL_KEY', 'RESECURE_MAX_ATTEMPTS', 'walletWithoutBackup', 'showStorageBusy', 'RESECURE_WINDOW_LOCK',
        `${fn('async function runStorageResecureIfSafe() {')}\nreturn runStorageResecureIfSafe;`)(
        { localStorage: { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => stored.set(k, v), removeItem: (k: string) => stored.delete(k) },
          indexedDB: { databases: async () => [] }, fetch: async () => { seen.push('probe'); return {}; },
          navigator: { locks: { request: async () => { seen.push('lock'); return null; } }, serviceWorker: { controller: {} } } },
        () => shared, 'state', 'cleared', 'attempts', 'parked', 5, () => false, () => { seen.push('busy'); return { done() {} }; }, 'platho-resecure');
    };
    await run(true)();
    expect([seen, stored.get('state')], 'MEASURED before: 0.4–1.9 s of "Securing storage…" at each of five starts').toEqual([[], 'done']);
    await run(false)();
    expect(seen, 'our own host: the run goes on as before').toContain('lock');
  });
});

describe('R20 — a reaction is held on the chain\'s clock [B7 / F2-2]', () => {
  it('R20-REACT-01: a device clock corrected forward inside the hold does not release the press while its bytes can land; a doubted clock holds', async () => {
    const chain = { now: 1_800_000_000_000 };
    let device = chain.now - 600_000;
    let doubt = false;
    const held = new Function('Date', 'walletChainNowMs', 'walletClockInDoubt', 'REACTION_SETTLE_MS', `${fn('function reactionHeld(press) {')}\nreturn reactionHeld;`)(
      { now: () => device }, () => chain.now, () => doubt, 150_000);
    const chainUntil = chain.now + 300_000 + 30_000;
    const press = { since: device, settleAfter: device + 330_000, chainUntil };
    chain.now += 30_000; device += 30_000;
    device += 600_000;
    expect(held(press), 'MEASURED before: released at +30 s, 271 s while the bytes can still land').toBe(true);
    chain.now = chainUntil + 1; device = chainUntil + 1;
    expect(held(press)).toBe(false);
    doubt = true;
    expect(held(press), 'a clock in doubt: held').toBe(true);
    doubt = false;
    chain.now = 1_900_000_000_000; device = chain.now + 600_000;
    const fast = { since: device, settleAfter: device + 330_000 - 600_000, chainUntil: chain.now + 330_000 };
    chain.now += 200_000; device += 200_000;
    expect(held(fast), 'held on the chain clock, not the fast device clock').toBe(true);
    expect(held({ since: device - 200_000, settleAfter: device + 1 })).toBe(true);
    const reactions: any = await import('../web/public-reactions.mjs');
    const memory = new Map<string, string>();
    const storage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => { memory.set(k, v); }, removeItem: (k: string) => { memory.delete(k); } };
    const SHARD = `0:${'aa'.repeat(32)}`;
    const store = reactions.createOwnReactionStore({ storage, wallet: 'W' });
    const since = Date.now();
    store.notePending(SHARD, 12n, 5, { since, floor: 1, settleAfter: since + 330_000, chainUntil: since + 330_000 });
    const again = reactions.createOwnReactionStore({ storage, wallet: 'W' });
    expect(again.pendingPresses()[0].chainUntil).toBe(since + 330_000);
  });
});

describe('R20 — a write bound to a day waits for a clock it can trust [B8 / F2-3]', () => {
  it('R20-CLOCK-01: a doubt the wait did not end stops a day-bound write (retried), not any other; the holds stay held in doubt', async () => {
    let doubt = true;
    const wait = new Function('walletChainClockOffsetMs', 'walletChainClockKnown', 'walletClockInDoubt', 'plathoWallet', 'walletChainClockRead', 'walletChainClockReadAt', 'refreshWalletChainClock', 'setTimeout', 'Date',
      `${fn('function chainClockPendingError() {')}\n${fn('async function awaitWalletChainClock({ timeoutMs = 4_000, requireSettled = false } = {}) {')}\nreturn awaitWalletChainClock;`)(
      () => 0, true, () => doubt, { address: 'A' }, null, 0, async () => { }, (cb: () => void) => cb(), Date);
    await expect(wait({ requireSettled: true }), 'MEASURED before: written on the device\'s day — INTRO refused 13684, paid').rejects.toMatchObject({ code: 'CHAIN_CLOCK_PENDING' });
    await expect(wait(), 'a read that is not bound to a day goes on').resolves.toBeUndefined();
    doubt = false;
    await expect(wait({ requireSettled: true })).resolves.toBeUndefined();
    expect(code(fn('function isRecoverablePrivateSendError(error) {'))).toContain("if (error?.code === 'CHAIN_CLOCK_PENDING') return true;");
    expect(code(fn('async function attemptConvMessagePublishDirect(context, owner = undefined) {'))).toContain('await awaitWalletChainClock({ requireSettled: true });');
    expect(code(fn('async function sendGroupMessageFromComposer(thread, text) {'))).toContain('await awaitWalletChainClock({ requireSettled: true, timeoutMs: 20_000 });');
    const held = new Function('walletChainNowMs', 'walletClockInDoubt', `${fn('function moderationFlightHeld(flights, key, now = walletChainNowMs()) {')}\nreturn moderationFlightHeld;`);
    const flights = new Map([['k', 1_000]]);
    expect(held(() => 2_000, () => true)(flights, 'k'), 'past its instant on a doubted clock: still held').toBe(true);
    expect(held(() => 2_000, () => false)(flights, 'k')).toBe(false);
  });
});

describe('R20 — a message never written: Cancel removes it, Retry goes on [B4 / F1-6]', () => {
  it('R20-UNKEPT-01: a message never written — Cancel cancels and Retry runs; [round 24] a written one too, nothing read again', async () => {
    const calls: string[] = [];
    const env = (cancellable = true) => ({
      privateMessageCanLocalCancel: () => cancellable, cancelPrivateMessageNow: () => calls.push('cancelled'),
    });
    const cancel = (cancellable = true) => {
      const e: any = env(cancellable);
      // eslint-disable-next-line no-new-func
      return new Function(...Object.keys(e), `${fn('async function cancelPrivateMessageFromUi(thread, message) {')}\nreturn cancelPrivateMessageFromUi;`)(...Object.values(e));
    };
    const unkept: any = { type: 'out', meta: 'not sent' };
    await cancel()({ messages: [unkept] }, unkept);
    expect(calls, 'MEASURED before: re-read answered "gone", nothing cancelled, nothing said').toEqual(['cancelled']);
    calls.length = 0;
    const kept: any = { type: 'out', meta: 'not sent', localHistoryId: 'h1' };
    await cancel()({ messages: [kept] }, kept);
    expect(calls, '[round 24] a written one is cancelled as the page holds it — no claim, no re-read').toEqual(['cancelled']);
    calls.length = 0;
    await cancel()({ messages: [] }, kept);
    await cancel(false)({ messages: [kept] }, kept);
    expect(calls, 'gone from the thread, or no longer cancellable: nothing is cancelled').toEqual([]);
    const retried: string[] = [];
    const retryEnv: any = {
      clearPrivateSendRetry: () => retried.push('cleared'), clearPrivateMessageManualRecovery: () => {}, refreshThreadAfterMessageChange: () => {},
      renderThreads: () => {}, renderConversation: () => {}, privateSendRetryContextForMessage: (thread: any, message: any) => ({ thread, message }),
      runPrivateSendRetry: async (context: any) => { retried.push(`ran ${context.message.localHistoryId ?? 'unkept'}`); },
      settlePrivateComposerSendError: async () => { retried.push('failed'); },
    };
    // eslint-disable-next-line no-new-func
    const retry = new Function(...Object.keys(retryEnv), `${fn('async function retryClaimedPrivateMessage(thread, message, owned) {')}\nreturn retryClaimedPrivateMessage;`)(...Object.values(retryEnv));
    for (const message of [{ type: 'out', meta: 'not sent' }, { type: 'out', meta: 'not sent', localHistoryId: 'h1' }] as any[]) {
      await retry({ messages: [message] }, message, () => retried.push('released'));
      expect(message.meta).toBe('sending');
    }
    expect(retried).toEqual(['cleared', 'ran unkept', 'released', 'cleared', 'ran h1', 'released']);
    expect(code(fn('async function retryPrivateMessageFromUi(thread, message) {'))).toContain('const owned = holdLiveSend(message);');
    expect(app, '[round 24] the re-read is gone').not.toContain('function refreshMessageFromHistory(');
  });
});
