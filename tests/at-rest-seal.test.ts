import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  AT_REST_KEY_PLAN, atRestTag, deriveAtRestKeys, generateRandomAtRestKeys, openAtRest, sealAtRest, withAtRestLock,
} from '../web/at-rest-seal.mjs';
import { code, sourceBlock } from './helpers/source';


const SEED = Uint8Array.from({ length: 32 }, (_, i) => i);
const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => code(sourceBlock(app, start));

describe('AT-REST — the key family', () => {
  it('AT-REST-01: the keys are the seed\'s, and stay so — pinned tags and pinned seals open under a fresh derivation', async () => {
    const keys = await deriveAtRestKeys(SEED);
    expect(await atRestTag(keys.history.index, 'history.conversation', 'dm:wallet_address:EQ-test')).toBe('Skt8MKKyBR9IGmAK0ag9ug');
    expect(await atRestTag(keys.groups.index, 'group-store.row', 'ab'.repeat(32))).toBe('uBjAf8kHfNvfZz7TPFobHA');
    expect(await atRestTag(keys.groupRequests.index, 'group-store.row', 'ab'.repeat(32)), 'each store its own index key').toBe('OGLogpVrUs_sqkKE68LDFQ');
    const pinned: Record<string, { n: string; x: string }> = {
      history: { n: 'gKS0YteBntCNUwZ1', x: 'KJBjoBtwjkmbTuXBjW7xV0pTeQpMgLIat8P9QYVbQOfejUs_' },
      convKeys: { n: 'e7XuAaUP0gorO3GY', x: '5prvY8lGUd_luqubdoLHmPgUjyxQSX2-6AKlsj-nbVrc0CHNAA' },
      groups: { n: 'lKG7sZaxYIkL0RUa', x: 'yNBJTKMmEiN05ua25Pf23lbdn7WgRe3GN-VsLRT-v3qSw8k' },
      publicGroups: { n: 'r5f7MMDx58i-fkPe', x: 'pZ4_IhA7cebxCQF-BrhsEYj9iSxe2RIwJPN4aEDsmkOxuY1DQ09rmkI' },
      groupRequests: { n: '39Idb1X1uKmnCGOe', x: 'jM8NtE7trdzhHH2FeJ-Y32z8Tm7YhTLyb4wgkLH4RTDvAlcpyZzDlC9p' },
      contactLabels: { n: 'scy7aP-fWZqGv8Vj', x: 'dJDphPWp2dvs8Kd_NAZDIex28QB5kjSHXy833H1aRwuuvi65ufDyjMho' },
      introLedger: { n: 'DuEbx3esPCB5D6re', x: 'xqpQon8rqScqMHm1r_yqV8RmpedaGvbD-tdooifesHJmLdOpnWbriw' },
      caches: { n: 't8TEM78A4-8mi4kz', x: 'FLOMEdzI9gUoLwgl__519el8kBBip-SlHTjAuLXGN8AGie8' },
    };
    for (const [store, sealed] of Object.entries(pinned)) {
      expect(await openAtRest((keys as any)[store].seal, { domain: 'PLATHO.AT-REST.PIN', aad: { store }, sealed }), store).toEqual({ pinned: store });
    }
    expect(Object.keys(pinned).sort(), 'every seal key of the plan is pinned').toEqual(Object.entries(AT_REST_KEY_PLAN).filter(([, roles]) => 'seal' in roles).map(([store]) => store).sort());
  });

  it('AT-REST-02: no key can leave the page, and each can do only its one job', async () => {
    const keys: any = await deriveAtRestKeys(SEED);
    for (const [store, roles] of Object.entries(AT_REST_KEY_PLAN)) {
      for (const role of Object.keys(roles)) {
        const key: CryptoKey = keys[store][role];
        expect(key.extractable, `${store}.${role}`).toBe(false);
        expect([...key.usages].sort(), `${store}.${role}`).toEqual(role === 'index' ? ['sign'] : ['decrypt', 'encrypt']);
        await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
      }
    }
    expect(Object.isFrozen(keys)).toBe(true);
    await expect(deriveAtRestKeys(new Uint8Array(16))).rejects.toThrow(/seed/);
  });

  it('AT-REST-03: another wallet\'s tags are other tags; a purpose is inside the MAC; a tag says nothing of its value', async () => {
    const mine = await deriveAtRestKeys(SEED);
    const theirs = await deriveAtRestKeys(Uint8Array.from({ length: 32 }, (_, i) => 31 - i));
    const value = 'dm:wallet_address:UQAAexample';
    const tag = await atRestTag(mine.history.index, 'history.conversation', value);
    expect(tag).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(await atRestTag(theirs.history.index, 'history.conversation', value)).not.toBe(tag);
    expect(await atRestTag(mine.history.index, 'history.capsule', value), 'a capsule tag never equals a conversation tag').not.toBe(tag);
    expect(await atRestTag(mine.history.index, 'history.conversation', value), 'and it is stable').toBe(tag);
    expect(tag).not.toContain('UQAA');
  });

  it('AT-REST-04: a seal opens only under its key, its domain and its bound data — and is padded', async () => {
    const keys = await generateRandomAtRestKeys();
    const sealed = await sealAtRest(keys.history.seal, { domain: 'D', aad: { id: 1 }, value: { secret: 'hello' }, padTo: 256 });
    expect(Buffer.from(sealed.x, 'base64url').length, '256 bytes of padded plaintext and the 16-byte tag').toBe(256 + 16);
    expect(await openAtRest(keys.history.seal, { domain: 'D', aad: { id: 1 }, sealed })).toEqual({ secret: 'hello' });
    await expect(openAtRest(keys.history.seal, { domain: 'E', aad: { id: 1 }, sealed })).rejects.toThrow();
    await expect(openAtRest(keys.history.seal, { domain: 'D', aad: { id: 2 }, sealed })).rejects.toThrow();
    await expect(openAtRest(keys.convKeys.seal, { domain: 'D', aad: { id: 1 }, sealed })).rejects.toThrow();
    await expect(openAtRest(keys.history.seal, { domain: 'D', aad: { id: 1 }, sealed: { n: sealed.n, x: sealed.x.slice(0, -2) + 'AA' } })).rejects.toThrow();
  });

  it('AT-REST-05: the cross-tab lock runs the work once — a failure inside it is not run again outside it', async () => {
    let runs = 0;
    const failing = async () => { runs += 1; throw new Error('the work failed'); };
    vi.stubGlobal('navigator', { locks: { request: (_name: string, work: () => any) => work() } });
    await expect(withAtRestLock('x', failing)).rejects.toThrow('the work failed');
    expect(runs).toBe(1);
    vi.stubGlobal('navigator', { locks: { request: async () => { throw new Error('locks refused'); } } });
    let ran = 0;
    expect(await withAtRestLock('x', async () => { ran += 1; return 'done'; })).toBe('done');
    expect(ran).toBe(1);
    vi.unstubAllGlobals();
  });
});

describe('AT-REST — the app seals every wallet store with the wallet\'s keys, and the lock takes them', () => {
  it('AT-REST-10: the keys come from the unlocked wallet\'s seed, once per unlock, and are nobody\'s once it has gone', () => {
    expect(app).toMatch(/import \{ deriveAtRestKeys, openAtRest, sealAtRest, withAtRestLock \} from '\.\/at-rest-seal\.mjs\?v=\d+';/);
    const keysFor = fn('async function atRestKeysFor(');
    expect(keysFor).toContain('if (!wallet?.seed || plathoWallet !== wallet) return null;');
    expect(keysFor).toContain('const keys = await deriveAtRestKeys(wallet.seed);');
    expect(keysFor).toContain('if (plathoWallet !== wallet) return null;');
    expect(keysFor).toContain('walletAtRestKeys = { wallet, keys };');
  });

  it('AT-REST-11: every wallet store is opened with them — the history, the conversation keys, the rooms, the requests, the public rooms, the names, the INTRO ledger', () => {
    expect(fn('async function bootEncryptedMessageHistory(')).toContain('keys: keys.history,');
    expect(fn('async function bootConvKeyStore(')).toContain('createIndexedDbConvKeyStore({ dbName: currentConvKeyDbName(), atRestKey: keys.convKeys.seal, onLegacy: noteLegacyStorageMoved })');
    const labels = fn('async function bootContactLabelStore(');
    expect(labels).toContain('atRestKey: keys.contactLabels.seal,');
    expect(labels).toContain('mergeLegacy: mergeContactLabelSets,');
    const build = fn('async function buildGroupRuntime(');
    expect(build).toContain('keys: atRest.groups,');
    expect(build).toContain('keys: atRest.groupRequests,');
    expect(fn('async function buildPublicGroupRuntime(')).toContain('keys: atRest.publicGroups,');
    expect(fn('async function hydrateGroupThreadsFromStore(')).toContain('keys: atRest.groups,');
    expect(app).toContain('ledgerKey: atRest.introLedger.seal,');
    const calls = [...app.matchAll(/createGroupRecordStore\(\{([\s\S]*?)\}\)/g)].map((m) => m[1]);
    expect(calls.length).toBeGreaterThanOrEqual(4);
    for (const call of calls) expect(call, call).toMatch(/keys: atRest\.\w+,/);
    expect(app.match(/createIndexedDbConvKeyStore\(\{/g)?.length).toBe(1);
    expect(app.match(/createIndexedDbEncryptedMessageHistoryStore\(\{/g)?.length).toBe(1);
  });

  it('AT-REST-12: the lock drops the keys, the names, and the history store once the sends holding it are done; a wallet switch closes it', () => {
    const lock = fn('function lockPlathoWallet(');
    expect(lock).toContain('walletAtRestKeys = null;');
    expect(lock).toContain('releaseHistoryStoreForLock();');
    expect(lock).toContain('contactLabelState = { owner: null, map: new Map(), store: null, persist: contactLabelState.persist };');
    const clear = fn('function clearWalletScopedRuntimeState(');
    expect(clear).toContain('walletAtRestKeys = null;');
    expect(clear).toContain('releaseHistoryStoreForLock();');
    expect(fn('function beginPrivateOutboundWork(')).toContain('if (privateOutboundWorkDepth === 0 && !historyHeld()) closeHistoryStoresWaiting();');
  });

  it('AT-REST-13: the history store\'s release, driven — closed at once when nothing holds it, after the last send when one does, and by the grace timer at the latest', async () => {
    const env: Record<string, any> = {
      timers: [] as Array<{ ms: number; run: () => void }>,
    };
    const api = new Function('env', `
      let encryptedMessageStore = null; const historyStoresClosingAfterLock = new Map(); let historyHoldDepth = 0; let depth = 0;
      const closedHistoryStores = new WeakSet();   // [round 18 — A2] a closed store takes no write
      const privateOutboundWorkActive = () => depth > 0;
      const setTimeout = (run, ms) => { env.timers.push({ ms, run }); return env.timers.length; };
      const clearTimeout = () => {};
      ${app.slice(app.indexOf('const HISTORY_LOCK_CLOSE_GRACE_MS'), app.indexOf('function releaseHistoryStoreForLock(') )}
      ${sourceBlock(app, 'function releaseHistoryStoreForLock(')}
      return {
        set store(s) { encryptedMessageStore = s; }, get store() { return encryptedMessageStore; },
        set depth(d) { depth = d; }, get pending() { return [...historyStoresClosingAfterLock.keys()]; },
        release: releaseHistoryStoreForLock, close: closeHistoryStore, closeWaiting: closeHistoryStoresWaiting, hold: holdHistoryForSend,
      };
    `)(env);
    const made = () => { const s: any = { closed: 0 }; s.close = () => { s.closed += 1; }; return s; };
    const quiet = made();
    api.store = quiet;
    api.release();
    expect(quiet.closed, 'nothing holds it: closed now').toBe(1);
    expect(api.store).toBeNull();
    const busy = made();
    api.store = busy;
    api.depth = 1;
    api.release();
    expect(busy.closed, 'a send still confirming keeps it').toBe(0);
    expect(api.pending).toEqual([busy]);
    expect(env.timers.at(-1)!.ms).toBe(150_000);
    api.depth = 0;
    api.closeWaiting();
    expect(busy.closed).toBe(1);
    expect(api.store).toBeNull();
    const stuck = made();
    api.store = stuck;
    api.depth = 1;
    api.release();
    const next = made();
    api.store = next;
    env.timers.at(-1)!.run();
    expect(stuck.closed).toBe(1);
    expect(api.store, 'the new session\'s store is untouched').toBe(next);
    expect(next.closed).toBe(0);
    api.depth = 0;
    const first = made();
    api.store = first;
    const sent = api.hold();
    api.release();
    expect(first.closed, 'MEASURED before: a keyed send held nothing, the store closed under it').toBe(0);
    const second = made();
    api.store = second;
    const sentAgain = api.hold();
    api.release();
    expect(api.pending, 'MEASURED before: one slot, the first store forgotten').toEqual([first, second]);
    sent();
    expect(first.closed + second.closed, 'a send still holds them').toBe(0);
    sentAgain();
    expect([first.closed, second.closed]).toEqual([1, 1]);
    sentAgain();
    expect([first.closed, second.closed]).toEqual([1, 1]);
    expect(api.pending).toEqual([]);
  });
});
