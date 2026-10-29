import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { generateRandomAtRestKeys, openAtRest, sealAtRest } from '../../web/at-rest-seal.mjs';
import { sourceBlock } from './source';

const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const line = (start: string) => {
  const at = app.indexOf(start);
  if (at < 0) throw new Error(`not found: ${start}`);
  return app.slice(at, app.indexOf('\n', at));
};

export type QuietShared = {
  clock: { now: number };
  local: Map<string, string>;
  keys: Promise<any>;
  locks: Map<string, Promise<unknown>>;
};

export function quietShared(now = 1_900_000_000_000): QuietShared {
  return { clock: { now }, local: new Map(), keys: generateRandomAtRestKeys(), locks: new Map() };
}

export function quietWorld(shared: QuietShared = quietShared()) {
  const { clock, local, locks } = shared;
  const timers = new Map<number, { cb: () => void; at: number }>();
  let nextTimer = 0;
  const signed: Array<{ at: number; to: string }> = [];
  const warnings: unknown[][] = [];
  const storage = {
    getItem: (key: string) => (local.has(key) ? local.get(key)! : null),
    setItem: (key: string, value: string) => { local.set(key, String(value)); },
    removeItem: (key: string) => { local.delete(key); },
  };
  const partitions = new Map<number, Map<string, any>>();
  for (let slot = 0; slot < 256; slot += 1) {
    partitions.set(slot, new Map([[`conv-${slot}`, { kRootCurrent: new Uint8Array(32).fill(slot), kRootsForRead: [], retiredIntroNonces: [] }]]));
  }
  const withLock = (name: string, run: () => Promise<any>) => {
    const before = locks.get(name) ?? Promise.resolve();
    const mine = before.then(() => run());
    locks.set(name, mine.catch(() => {}));
    return mine;
  };
  class FakeDate extends Date {
    constructor(...args: any[]) { super(...((args.length > 0 ? args : [clock.now]) as [any])); }
    static now() { return clock.now; }
  }
  const env: Record<string, any> = {
    Date: FakeDate,
    setTimeout: (cb: () => void, ms: number) => { nextTimer += 1; timers.set(nextTimer, { cb, at: clock.now + Math.max(0, Number(ms) || 0) }); return nextTimer; },
    clearTimeout: (id: number) => { timers.delete(id); },
    globalThis: { crypto: webcrypto, plathoTonRpcTransport: { runGetMethod: async () => ({}), sendBoc: async () => ({}) } },
    console: { warn: (...args: unknown[]) => { warnings.push(args); }, info() {}, log() {}, error: (...args: unknown[]) => { warnings.push(args); } },
    convKeyStore: { refresh: async () => {}, importConversations: async () => 0, snapshot: () => partitions },
    plathoWallet: { seed: new Uint8Array(32).fill(7), address: `0:${'aa'.repeat(32)}` },
    walletSessionGeneration: 1,
    persistRecoveryPending: () => Promise.resolve(),
    latchedLocalStorage: () => storage,
    atRestKeysFor: async () => shared.keys,
    openAtRest, sealAtRest,
    scopedStorageKey: (key: string) => key,
    walletIndexedDbSuffix: () => 'w',
    withAtRestLock: withLock,
    dropRecoveryEntriesConfirmedElsewhere: async () => {},
    createRecoveryViewReader: () => async () => ({}),
    criticalRecoveryReaders: () => ({ readView: null, readBody: null }),
    selfRecoveryShard: async (_seed: unknown, slot: number) => ({ address: `0:${slot.toString(16).padStart(64, '0')}` }),
    restoreConvKeysFromRecovery: async () => ({ clean: true, map: new Map() }),
    publicAddrKey: (address: string) => address,
    partitionRecoveryMap: (snapshot: any) => snapshot,
    requireBasechainAddress: (address: string) => address,
    prepareRecoveryBackup: async ({ slotIndex }: any) => ({ to: `0:${slotIndex.toString(16).padStart(64, '0')}`, value: 38_400_000n, body: {}, init: null, seq: 1n, h1: null }),
    shardArrearOf: async () => 0n,
    LANE_RECOVERY: 'recovery', RECOVERY_PUBLISH_VALUE: 38_400_000n,
    assertWalletGramAtLeast: async () => {},
    walletSendFeeReserveNanotons: () => 0n,
    walletSendSizeClassForPayloadBytes: () => 1,
    tonCell: { serializeBoc: () => new Uint8Array(8), bytesToBase64: () => '' },
    sendPlathoWalletTransaction: async (_wallet: unknown, { messages }: any) => { for (const message of messages) signed.push({ at: clock.now, to: message.address }); return {}; },
    broadcastMayHaveLanded: () => false,
    confirmRecoverySlotWrites: async () => ({ pending: [] }),
    noteChatKeysBackupShortfall: () => {}, clearChatKeysBackupShortfall: () => {}, noteTonRpcRateLimit: () => false,
    renderThreads: () => {}, scheduleMessageAutoSync: () => {},
    recoverySlotForConversation: (convId: string) => Number(convId),
  };
  const sources = [
    line('const RECOVERY_BACKUP_DEBOUNCE_MS = '), line('let recoveryBackupTimer = null;'),
    line('const convRecoveryDirtySlots = new Set();'), line('const convRecoveryDirtyMarks = new Map();'),
    ...['const RECOVERY_QUIET_MIN_MS = ', 'const RECOVERY_QUIET_SPAN_MS = ', 'const RECOVERY_QUIET_AFTER_UNLOCK_MIN_MS = ',
      'const RECOVERY_QUIET_AFTER_UNLOCK_SPAN_MS = ', 'const RECOVERY_QUIET_URGENT_AFTER_MS = ', 'const RECOVERY_QUIET_URGENT_MIN_MS = ',
      'const RECOVERY_QUIET_URGENT_SPAN_MS = ', 'const RECOVERY_QUIET_LATE_MS = ', 'const RECOVERY_QUIET_TIMER_MAX_MS = ',
      'const RECOVERY_QUIET_SLOTS_PER_DAY = ', 'const RECOVERY_QUIET_BUDGET_WINDOW_MS = ', 'const RECOVERY_QUIET_FUTURE_SLACK_MS = ',
      'const RECOVERY_QUIET_SPENT_STORAGE_KEY = ', 'const RECOVERY_QUIET_SPENT_SEAL_DOMAIN = '].map(line),
    line('const convRecoveryQuietSlots = new Map();'), line('const convRecoveryPendingEntries = new Map();'),
    line('const convRecoveryConfirmedEntries = new Set();'), line('const convRecoveryStoredEntries = new Set();'),
    line('const convRecoveryRefreshSlots = new Set();'), line('let recoveryQuietTimer = null;'),
    fn('function recoveryQuietJitterMs(span) {'), line('const recoveryEntryKey = (slot, since) =>'),
    fn('function noteRecoveryEntry(slot, since) {'), fn('function oldestRecoveryEntry(slot) {'), fn('function recoveryQuietWaitFrom(now, since) {'),
    fn('function markRecoverySlotDirty(slot, {'), fn('function confirmRecoverySlotWritten(slot, entries, unchanged) {'),
    fn('function scheduleQuietRecoveryBackup(convId) {'), fn('function promoteQuietRecoverySlot(convId) {'), fn('function armRecoveryQuietTimer() {'),
    fn('function recoveryQuietSpentStorageKey(address) {'), fn('async function readRecoveryQuietSpent(wallet, now) {'),
    fn('async function writeRecoveryQuietSpent(wallet, rows) {'), fn('function promoteDueQuietRecoverySlots(now = Date.now()) {'),
    fn('function scheduleRecoveryBackup(convId, delayMs = RECOVERY_BACKUP_DEBOUNCE_MS, { quiet = false } = {}) {'),
    line('let recoveryBackupInFlight = false;'), line('let recoveryBackupRearm = false;'),
    fn('async function runRecoveryBackup() {'), fn('function recoveryPartitionHeld(partition, chainMap) {'),
    fn('async function runRecoveryBackupUnguarded() {'), fn('async function runRecoveryBackupLocked() {'),
  ];
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  const api = new Function(...names, `${sources.join('\n')}
    return {
      scheduleQuietRecoveryBackup, promoteDueQuietRecoverySlots, promoteQuietRecoverySlot, noteRecoveryEntry, readRecoveryQuietSpent,
      writeRecoveryQuietSpent, recoveryQuietSpentStorageKey, quiet: convRecoveryQuietSlots, dirty: convRecoveryDirtySlots,
      get inFlight() { return recoveryBackupInFlight; }, wallet: plathoWallet,
    };`)(...names.map((name) => env[name]));
  const settle = async () => {
    const started = performance.now();
    for (let turn = 0; ; turn += 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setImmediate(resolve));
      if (turn > 4 && !api.inFlight) return;
      if (turn >= 400 && performance.now() - started > 10_000) return;
    }
  };
  const runUntil = async (until: number) => {
    for (;;) {
      const due = [...timers.entries()].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      clock.now = Math.max(clock.now, due[1].at);
      due[1].cb();
      // eslint-disable-next-line no-await-in-loop
      await settle();
    }
    clock.now = Math.max(clock.now, until);
  };
  return { clock, timers, signed, warnings, local, api, runUntil, settle };
}
