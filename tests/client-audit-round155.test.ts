import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { createMemoryConvKeyStore } from '../web/conv-key-store.mjs';
import { prepareRecoveryBackup } from '../web/recovery-lane.mjs';
import { openRecoveryBlob } from '../web/recovery-blob.mjs';


const read = (path: string) => readFileSync(path, 'utf8');
const app = read('web/app.js');
const fn = (start: string) => sourceBlock(app, start);
const hexOf = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');
const root = (byte: number) => new Uint8Array(32).fill(byte);
const nonce = (byte: number) => new Uint8Array(16).fill(byte);

describe('client audit round 155', () => {
  it('R155-01 (L2-1): an import never drops a root — the one that does not win is kept for reading, and the conversation is walked again from it', async () => {
    const self = new Uint8Array(32).fill(7);
    const peer = new Uint8Array(32).fill(9);
    const adopt = (kRoot: Uint8Array, introNonce: Uint8Array, createdAt: number) => ({ kRoot, introNonce, createdAt, peerKeyId: peer, peerWallet: `0:${'a1'.repeat(32)}` });
    const roots = (store: any) => (store.getConversation(self, peer).kRootsForRead ?? []).map((entry: any) => [hexOf(entry.kRoot), Number(entry.adoptedAt)]);

    const fresh = createMemoryConvKeyStore();
    await fresh.upsertConversationKRoot(self, peer, adopt(root(1), nonce(1), 2_000));
    await fresh.advanceConvScanCursor(self, peer, 20_000);
    const [id] = [...fresh.snapshot().keys()];
    const backup = { ...fresh.snapshot().get(id), kRootCurrent: root(0), adoptedIntroNonce: nonce(0), adoptedCreatedAt: 1_000, kRootsForRead: [], lastScannedEpoch: null };
    expect(await fresh.importConversations(new Map([[id, backup]]))).toBe(1);
    const held = fresh.getConversation(self, peer);
    expect(hexOf(held.kRootCurrent), 'the newer root drives what is sent').toBe(hexOf(root(1)));
    expect(roots(fresh), 'the backup\'s root still opens the history').toEqual([[hexOf(root(0)), 1_000]]);
    expect(held.retiredIntroNonces.map(hexOf), 'and its INTRO is retired: a replay of it moves nothing').toContain(hexOf(nonce(0)));
    expect(held.lastScannedEpoch, 'walked again from its earliest root, once').toBeNull();
    expect(await fresh.importConversations(new Map([[id, backup]]))).toBe(0);

    const older = createMemoryConvKeyStore();
    await older.upsertConversationKRoot(self, peer, adopt(root(0), nonce(0), 1_000));
    const newer = { ...older.snapshot().get(id), kRootCurrent: root(2), adoptedIntroNonce: nonce(2), adoptedCreatedAt: 3_000, kRootsForRead: [] };
    expect(await older.importConversations(new Map([[id, newer]]))).toBe(1);
    expect([hexOf(older.getConversation(self, peer).kRootCurrent), roots(older)]).toEqual([hexOf(root(2)), [[hexOf(root(0)), 1_000]]]);

    const same = createMemoryConvKeyStore();
    await same.upsertConversationKRoot(self, peer, adopt(root(4), nonce(4), 1_000));
    expect(await same.importConversations(new Map([[id, { ...same.snapshot().get(id), adoptedCreatedAt: 900 }]]))).toBe(0);
    expect(roots(same)).toEqual([]);
    expect(await same.importConversations(new Map([[id, { ...same.snapshot().get(id), adoptedCreatedAt: 900, kRootsForRead: [{ kRoot: root(3), adoptedAt: 500 }] }]]))).toBe(0);
    expect(same.getConversation(self, peer).retiredIntroNonces ?? [], 'the INTRO the conversation stands on').not.toContainEqual(nonce(4));
    const rotated = createMemoryConvKeyStore();
    await rotated.upsertConversationKRoot(self, peer, adopt(root(5), nonce(5), 1_000));
    await rotated.upsertConversationKRoot(self, peer, adopt(root(6), nonce(6), 2_000));
    expect(await rotated.importConversations(new Map([[id, { ...rotated.snapshot().get(id), kRootCurrent: root(5), adoptedIntroNonce: nonce(5), adoptedCreatedAt: 9_000, kRootsForRead: [] }]])),
      'a backup that would roll back to a retired root').toBe(0);
    expect(hexOf(rotated.getConversation(self, peer).kRootCurrent)).toBe(hexOf(root(6)));

    const first = code(fn('async function attemptIntroFirstContactDirect(context, owner = undefined) {'));
    expect(first).toContain('!convKeyStoresRestored.has(keyStore)) throw convIntroPendingError();');
    const boot = code(fn('async function bootConvKeyStore() {'));
    expect(boot).toMatch(/try \{\s*await restoreConvKeysFromRecoveryIfBehind\(ledger\);\s*\} finally \{\s*if \(session === walletSessionGeneration\) convKeyStoresRestored\.add\(convKeyStore\);/);
    expect(boot.indexOf('convKeyStoresRestored.add(convKeyStore)'), 'never before the restore').toBeGreaterThan(boot.indexOf('await restoreConvKeysFromRecoveryIfBehind(ledger);'));
  });

  it('R156-01 (M1-1; M1-7): on the store the app keeps on disk, a conversation that gains a root by an import is walked again from it — the merge with the disk keeps the reset', async () => {
    const persist: any = await import('../web/conv-key-persist.mjs');
    const key = await persist.createConvKeySealKey();
    const self = new Uint8Array(32).fill(7);
    const peer = new Uint8Array(32).fill(9);
    const adopt = (kRoot: Uint8Array, introNonce: Uint8Array, createdAt: number) => ({ kRoot, introNonce, createdAt, peerKeyId: peer, peerWallet: `0:${'a1'.repeat(32)}` });
    const disk = () => {
      let blob: any = null;
      return { open: () => persist.createSealedConvKeyStore({ key, readBlob: async () => blob, writeBlob: async (value: any) => { blob = value; } }) };
    };

    const one = disk();
    const store = await one.open();
    await store.upsertConversationKRoot(self, peer, adopt(root(1), nonce(1), 2_000));
    await store.advanceConvScanCursor(self, peer, 20_000);
    const stale = await one.open();
    const [id] = [...store.snapshot().keys()];
    const backup = { ...store.snapshot().get(id), kRootCurrent: root(0), adoptedIntroNonce: nonce(0), adoptedCreatedAt: 1_000, kRootsForRead: [], lastScannedEpoch: null };
    expect(await store.importConversations(new Map([[id, backup]]))).toBe(1);
    expect(store.getConversation(self, peer).lastScannedEpoch, 'after the write and its merge with the disk').toBeNull();
    expect((await one.open()).getConversation(self, peer).lastScannedEpoch, 'and on the disk itself').toBeNull();
    expect(await stale.pinPeerSignKey(self, peer, new Uint8Array(32).fill(3))).toBe(true);
    expect((await one.open()).getConversation(self, peer).lastScannedEpoch, 'a window that never saw R0 does not cover it').toBeNull();
    await store.advanceConvScanCursor(self, peer, 20_001);
    expect((await one.open()).getConversation(self, peer).lastScannedEpoch).toBe(20_001);
    await stale.advanceConvScanCursor(self, peer, 20_000);
    expect((await one.open()).getConversation(self, peer).lastScannedEpoch, 'the larger cursor, as ever').toBe(20_001);

    const two = disk();
    const older = await two.open();
    await older.upsertConversationKRoot(self, peer, adopt(root(0), nonce(0), 1_000));
    await older.advanceConvScanCursor(self, peer, 20_000);
    const newer = { ...older.snapshot().get(id), kRootCurrent: root(2), adoptedIntroNonce: nonce(2), adoptedCreatedAt: 3_000, kRootsForRead: [], retiredIntroNonces: [], lastScannedEpoch: 20_000 };
    expect(await older.importConversations(new Map([[id, newer]]))).toBe(1);
    const reopened = (await two.open()).getConversation(self, peer);
    expect([hexOf(reopened.kRootCurrent), reopened.lastScannedEpoch]).toEqual([hexOf(root(2)), null]);
    expect(reopened.retiredIntroNonces.map(hexOf), 'the INTRO the device stood on').toContain(hexOf(nonce(0)));

    const twoRetired = (await two.open()).getConversation(self, peer).retiredIntroNonces.map(hexOf);
    expect(twoRetired[twoRetired.length - 1]).toBe(hexOf(nonce(0)));
    const keptRetired = createMemoryConvKeyStore();
    await keptRetired.upsertConversationKRoot(self, peer, adopt(root(5), nonce(5), 500));
    await keptRetired.upsertConversationKRoot(self, peer, adopt(root(7), nonce(7), 1_000));
    await keptRetired.importConversations(new Map([[id, { ...keptRetired.snapshot().get(id), kRootCurrent: root(8), adoptedIntroNonce: nonce(8), adoptedCreatedAt: 3_000,
      kRootsForRead: [], retiredIntroNonces: [nonce(6)] }]]));
    expect(keptRetired.getConversation(self, peer).retiredIntroNonces.map(hexOf), 'the device\'s, the backup\'s, then the one just replaced')
      .toEqual([hexOf(nonce(5)), hexOf(nonce(6)), hexOf(nonce(7))]);

    const racing = disk();
    const raced = await racing.open();
    await raced.upsertConversationKRoot(self, peer, adopt(root(1), nonce(1), 2_000));
    await raced.advanceConvScanCursor(self, peer, 20_000);
    const planned = [root(1)];
    await raced.importConversations(new Map([[id, { ...raced.snapshot().get(id), kRootCurrent: root(0), adoptedIntroNonce: nonce(0), adoptedCreatedAt: 1_000, kRootsForRead: [], lastScannedEpoch: null }]]));
    await raced.advanceConvScanCursor(self, peer, 20_001, { persist: false, roots: planned });
    await raced.flush();
    expect((await racing.open()).getConversation(self, peer).lastScannedEpoch, 'the pass that planned before the import').toBeNull();
    await raced.advanceConvScanCursor(self, peer, 20_002, { persist: false, roots: [root(1), root(0)] });
    await raced.flush();
    expect((await racing.open()).getConversation(self, peer).lastScannedEpoch).toBe(20_002);
    await raced.advanceConvScanCursor(self, peer, 20_003, { roots: [root(1)] });
    expect((await racing.open()).getConversation(self, peer).lastScannedEpoch).toBe(20_002);
    await raced.advanceConvScanCursor(self, peer, 20_003, { roots: [root(1), root(0)] });
    expect((await racing.open()).getConversation(self, peer).lastScannedEpoch).toBe(20_003);
    expect(code(fn('async function syncConvCapsulesFromShards(options = {}) {')))
      .toContain('await store.advanceConvScanCursor(selfKeyId, peerKeyId, epochNow, { persist: false, roots: plan.rootShards.map((root) => root.kRoot) });');

    const three = disk();
    const live = await three.open();
    await live.upsertConversationKRoot(self, peer, adopt(root(4), nonce(4), 1_000));
    await live.advanceConvScanCursor(self, peer, 20_000);
    await live.upsertConversationKRoot(self, peer, adopt(root(5), nonce(5), 20_000 * 86_400 + 30));
    expect((await three.open()).getConversation(self, peer).lastScannedEpoch).toBe(20_000);
  });

  it('R158-01 (P2-1): a write of the key store does not throw away a change made while it ran — an INTRO adopted then is kept, in memory and on the disk', async () => {
    const persist: any = await import('../web/conv-key-persist.mjs');
    const key = await persist.createConvKeySealKey();
    const queue = new Map<string, Promise<any>>();
    const locks = { request: (name: string, work: () => any) => {
      const run = (queue.get(name) ?? Promise.resolve()).then(() => work());
      queue.set(name, run.catch(() => {}));
      return run;
    } };
    const nav: any = (globalThis as any).navigator;
    const had = nav ? Object.getOwnPropertyDescriptor(nav, 'locks') : undefined;
    if (nav) Object.defineProperty(nav, 'locks', { value: locks, configurable: true });
    else Object.defineProperty(globalThis, 'navigator', { value: { locks }, configurable: true });
    try {
      const self = new Uint8Array(32).fill(7);
      const peerOf = (byte: number) => new Uint8Array(32).fill(byte);
      const adopt = (byte: number) => ({ kRoot: root(byte), introNonce: nonce(byte), createdAt: 1_794_000_000 + byte, peerKeyId: peerOf(byte), peerWallet: `0:${'a1'.repeat(32)}` });
      let blob: any = null;
      let holding = false;
      let release: () => void = () => {};
      const backend = {
        key, lockName: 'r158-p2-1', readBlob: async () => blob,
        writeBlob: async (value: any) => { if (holding) { holding = false; await new Promise<void>((resolve) => { release = resolve; }); } blob = value; },
      };
      const store = await persist.createSealedConvKeyStore(backend);
      await store.upsertConversationKRoot(self, peerOf(0x21), adopt(0x21));
      holding = true;
      const first = store.upsertConversationKRoot(self, peerOf(0x22), adopt(0x22));
      await new Promise((resolve) => { setTimeout(resolve, 20); });
      const second = store.upsertConversationKRoot(self, peerOf(0x23), adopt(0x23));
      await new Promise((resolve) => { setTimeout(resolve, 20); });
      release();
      expect(await Promise.all([first, second])).toEqual(['created', 'created']);
      for (const byte of [0x21, 0x22, 0x23]) expect(store.getConversation(self, peerOf(byte)), `in memory: ${byte.toString(16)}`).not.toBeNull();
      expect(store.isDurable()).toBe(true);
      const reopened = await persist.createSealedConvKeyStore({ ...backend, writeBlob: async (value: any) => { blob = value; } });
      for (const byte of [0x21, 0x22, 0x23]) expect(reopened.getConversation(self, peerOf(byte)), `on the disk: ${byte.toString(16)}`).not.toBeNull();
    } finally {
      if (nav) { if (had) Object.defineProperty(nav, 'locks', had); else delete nav.locks; } else delete (globalThis as any).navigator;
    }
  });

  it('R158-02 (P2-2): a root adopted with a birth before the cursor is walked from it — and a pass does not move the cursor over a root it did not walk', async () => {
    const self = new Uint8Array(32).fill(7);
    const peer = new Uint8Array(32).fill(9);
    const DAY = 86_400;
    const E = 20_767;
    const adopt = (kRoot: Uint8Array, introNonce: Uint8Array, createdAt: number) => ({ kRoot, introNonce, createdAt, peerKeyId: peer, peerWallet: `0:${'a1'.repeat(32)}` });
    const at = async (bornEpoch: number) => {
      const store = createMemoryConvKeyStore();
      await store.upsertConversationKRoot(self, peer, adopt(root(1), nonce(1), (E - 40) * DAY));
      await store.advanceConvScanCursor(self, peer, E);
      const outcome = await store.upsertConversationKRoot(self, peer, adopt(root(2), nonce(2), bornEpoch * DAY + 3600));
      return [outcome, store.getConversation(self, peer).lastScannedEpoch];
    };
    expect(await at(E - 5), 'born five days before the cursor: walked from its birth').toEqual(['adopted', null]);
    expect(await at(E - 1)).toEqual(['adopted', null]);
    expect(await at(E), 'born on the cursor\'s day: read from where it stands').toEqual(['adopted', E]);
    const retained = createMemoryConvKeyStore();
    await retained.upsertConversationKRoot(self, peer, adopt(root(1), nonce(1), (E - 3) * DAY));
    await retained.advanceConvScanCursor(self, peer, E);
    expect(await retained.upsertConversationKRoot(self, peer, adopt(root(3), nonce(3), (E - 9) * DAY))).toBe('retained');
    expect(retained.getConversation(self, peer).lastScannedEpoch).toBeNull();
    const raced = createMemoryConvKeyStore();
    await raced.upsertConversationKRoot(self, peer, adopt(root(1), nonce(1), (E - 40) * DAY));
    await raced.advanceConvScanCursor(self, peer, E - 1);
    await raced.upsertConversationKRoot(self, peer, adopt(root(4), nonce(4), E * DAY + 60));
    expect(raced.getConversation(self, peer).lastScannedEpoch).toBe(E - 1);
    await raced.advanceConvScanCursor(self, peer, E, { roots: [root(1)] });
    expect(raced.getConversation(self, peer).lastScannedEpoch, 'not over root 4').toBe(E - 1);
    await raced.advanceConvScanCursor(self, peer, E, { roots: [root(1), root(4)] });
    expect(raced.getConversation(self, peer).lastScannedEpoch).toBe(E);
  });

  it('R159-01 (P2-7): a quiet conversation\'s window is closed only on the roots its probe asked — a root adopted since is read first', async () => {
    const liftWith = (env: Record<string, any>, sources: string[], exported: string, prelude: string) => {
      const names = Object.keys(env);
      // eslint-disable-next-line no-new-func
      return new Function(...names, [prelude, ...sources, `return ${exported};`].join(String.fromCharCode(10)))(...names.map((n) => env[n]));
    };
    const line = (start: string) => { const at = app.indexOf(start); return app.slice(at, app.indexOf(String.fromCharCode(10), at)); };
    const holder: any = { read: async () => new Map() };
    const api = liftWith({
      introKeyIdString: (k: string) => String(k), publicAddrKey: (a: string) => a,
      readConvShardStates: async () => holder.read(), noteTonRpcRateLimit: () => false, console, quietAddressesPerMinute: () => Infinity,
    }, [fn('function convPlansDueThisPass(plans, { forceFull = false, epochNow = null } = {}) {'), fn('function noteConvQuiet(plans, states, now = Date.now()) {'),
      line('const quietSpent = '), line('const QUIET_BOOK_STALE_MS = '), fn('function quietDueEveryMs(cost, quietAddresses, quietMs) {'), fn('function takeQuietWithinShare('),
      'function currentStatesBatchCeiling() { return 0; }',
      fn('function probeQuietConversations(plans, { epochNow, now = Date.now(), quietAddresses = quietAddressesPerMinute() } = {}) {')],
    '{ split: convPlansDueThisPass, note: noteConvQuiet, probe: probeQuietConversations }',
    'const CONV_QUIET_PROBE_MS = 60_000; const CONV_QUIET_MAX = 65_536; const convQuietAt = new Map(); const convQuietProbedClean = new Map(); let convQuietProbeRun = null; let walletSessionGeneration = 0; const convQuietSpent = { since: -Infinity, addresses: 0 };');
    const plan = (peer: string, roots: number[]) => ({ peerKeyId: peer, cold: false,
      rootShards: roots.map((byte) => ({ kRoot: root(byte), shards: [{ address: `${peer}-${byte}`, addrKey: `${peer}-${byte}` }] })) });
    const ids = (list: any[]) => list.map((p: any) => p.peerKeyId);
    const T = Date.now();
    const E = 20_767;
    api.note([plan('B', [1])], new Map(), T - 61_000);
    expect(await api.probe([plan('B', [1])], { epochNow: E, now: T })).toBe(0);
    let split = api.split([plan('B', [1, 2])], { epochNow: E });
    expect([ids(split.settled), ids(split.left)], 'MEASURED before: settled, the new root\'s days closed unread').toEqual([[], ['B']]);
    expect(await api.probe([plan('B', [1, 2])], { epochNow: E, now: T + 61_000 })).toBe(0);
    split = api.split([plan('B', [1, 2])], { epochNow: E });
    expect(ids(split.settled)).toEqual(['B']);
    api.note([plan('C', [3, 4])], new Map(), T - 61_000);
    await api.probe([plan('C', [3, 4])], { epochNow: E, now: T });
    expect(ids(api.split([plan('C', [4, 3])], { epochNow: E + 1 }).settled)).toEqual([]);
    expect(ids(api.split([plan('C', [4, 3])], { epochNow: E }).settled)).toEqual(['C']);
  });

  it('R160-01 (P2-11; P2-12; P2-13): a cursor moves only on a day the clock is trusted for; the merge keeps the read-roots cap', async () => {
    const pass = code(fn('async function syncConvCapsulesFromShards(options = {}) {'));
    expect(pass).toContain('const clockTrusted = roomClockTrusted();');
    expect(pass.indexOf('const clockTrusted = roomClockTrusted();'), 'taken with the day').toBeLessThan(pass.indexOf('const forwardEpochs'));
    expect(pass).toContain("if (convClean && !tornDown() && clockTrusted && epochIsDerivable('record', epochNow) && historyKeptSince(historyFailuresAtStart)) {");
    expect(code(fn('function convPlansDueThisPass(plans, { forceFull = false, epochNow = null } = {}) {')))
      .toContain('else if (convQuietProbedClean.has(key) && convQuietProbedClean.get(key) === `${epochNow}|${rootsTag(plan)}`) {');
    expect(code(read('web/conv-key-persist.mjs'))).toContain('kRootsForRead: [...roots.values()],');
    expect(code(fn('async function refreshWalletChainClock({ force = false } = {}) {')))
      .toMatch(/if \(force && Math\.abs\(now - walletChainClockReadAt\) < 10_000\) \{[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*if \(walletClockInDoubt\(\)\) scheduleWalletChainClockRetry\(\);\s*return;\s*\}/);
  });

  it('R158-03 (P1-1): a name lookup answers the new-chat window that asked it — reopened, the window starts free and the old answer goes nowhere', () => {
    const open = code(fn('function openNewChatDialog() {'));
    expect(open).toMatch(/newChatAttempt \+= 1;.*\s*setNewChatResolving\(false\);/);
    const submit = code(app.slice(app.indexOf("newChatForm?.addEventListener('submit'"), app.indexOf("actionCancelButton?.addEventListener('click'")));
    expect(submit).toContain('const attempt = newChatAttempt;');
    expect(submit.match(/if \(session !== walletSessionGeneration \|\| attempt !== newChatAttempt\) return;/g)?.length, 'after the lookup, both ways out').toBe(2);
    expect(submit).toContain('if (attempt === newChatAttempt) setNewChatResolving(false);');
    expect(code(fn('function closeNewChatDialog({ restoreFocus = false } = {}) {'))).toMatch(/newChatAttempt \+= 1;\s*setNewChatResolving\(false\);/);
    expect(submit).toContain('const entered = recipientInput?.value;');
    expect(submit).not.toContain('selectOrCreateRecipientThread(recipientInput?.value');
    expect(submit.match(/selectOrCreateRecipientThread\(entered, \{ localLabel \}\)/g)?.length).toBe(2);
  });

  it('R155-02 (L2-3): a recovery slot the kept signing keys push over the chain\'s cap is sealed without them — never left unwritten', async () => {
    const SEED = new Uint8Array(32).fill(0x9c);
    const self = new Uint8Array(32).fill(0x11);
    const store = createMemoryConvKeyStore();
    const COUNT = 18;
    for (let i = 0; i < COUNT; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await store.upsertConversationKRoot(self, new Uint8Array(32).fill(i + 100), { kRoot: root(i + 100), createdAt: 1_790_000_000 + i, introNonce: nonce(i + 1),
        peerWallet: `0:${(i + 16).toString(16).padStart(2, '0').repeat(32)}`, peerSignPublicKey: new Uint8Array(32).fill(i + 1) });
    }
    const map = store.snapshot();
    expect([...map.values()].every((record: any) => typeof record.peerSignPublicKey === 'string')).toBe(true);
    const built = await prepareRecoveryBackup({ seed: SEED, slotIndex: 0, map, readView: async () => ({ bound: false }), value: 50_000_000n });
    expect(built.cells).toBeLessThanOrEqual(79);
    const blobOf = (message: any) => message.body.refs[0].refs[0];
    const opened = await openRecoveryBlob(SEED, blobOf(built));
    expect(opened.size, 'every conversation is in it').toBe(COUNT);
    expect([...opened.values()].some((record: any) => 'peerSignPublicKey' in record), 'without the keys').toBe(false);
    const small = new Map([...map].slice(0, 3));
    const fits = await openRecoveryBlob(SEED, blobOf(await prepareRecoveryBackup({ seed: SEED, slotIndex: 0, map: small, readView: async () => ({ bound: false }), value: 50_000_000n })));
    expect([...fits.values()].every((record: any) => typeof record.peerSignPublicKey === 'string')).toBe(true);
  });
});
