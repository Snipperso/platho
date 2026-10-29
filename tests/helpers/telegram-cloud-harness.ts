import { readFileSync } from 'node:fs';
import { sha256 } from '../../web/vendor/@noble/hashes/sha2.js';
import { sourceBlock } from './source';

const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const line = (start: string) => { const at = app.indexOf(start); if (at < 0) throw new Error(`not found: ${start}`); return app.slice(at, app.indexOf(String.fromCharCode(10), at)); };
const lift = (env: Record<string, any>, sources: string[], exported: string, prelude = '') => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [prelude, ...sources, `return ${exported};`].join(String.fromCharCode(10)))(...names.map((n) => env[n]));
};

export const fakeCloud = (initial: Record<string, string> = {}) => {
  const items = new Map(Object.entries(initial));
  const queued: Array<() => void> = [];
  let mode: 'queue' | 'now' | 'error' | 'never' = 'now';
  let gets = 0;
  const cs = {
    getItem(key: string, cb: (error: any, value?: string) => void) {
      gets += 1;
      const answer = () => (mode === 'error' ? cb(new Error('unreachable')) : cb(null, items.get(key) ?? ''));
      if (mode === 'never') return;
      if (mode === 'queue') queued.push(answer); else answer();
    },
    setItem(key: string, value: string, cb: (error: any, ok?: boolean) => void) { items.set(key, value); cb(null, true); },
  };
  return { cs, items, gets: () => gets, setMode: (next: typeof mode) => { mode = next; }, release: () => { const all = queued.splice(0); for (const answer of all) answer(); } };
};
export const settle = (ms = 5) => new Promise((resolve) => { setTimeout(resolve, ms); });
export const span = (from: string, lastFn: string) => { const at = app.indexOf(from); const end = app.indexOf(lastFn); if (at < 0 || end < 0) throw new Error(`not found: ${from} / ${lastFn}`); return app.slice(at, end) + sourceBlock(app, lastFn); };
export const WALLET_KEY = 'platho.wallet.encrypted.v1';
export const CLOUD_KEY = 'platho_wallet_encrypted_v1';
export const sealed = (salt: string, extra: Record<string, unknown> = {}) => JSON.stringify({ kind: 'platho-encrypted-wallet', version: 1, kdf: 'pbkdf2', iterations: 1, salt, cipher: 'aes-gcm', iv: 'iv', ciphertext: `ct-${salt}`, ...extra });

export const cloudDoors = (cloud: ReturnType<typeof fakeCloud>, storage: Map<string, string>) => {
  const sets: string[] = [];
  const said: string[] = [];
  const env: any = {
    telegramCloudStorage: () => cloud.cs, telegramLaunchedByOfficialBot: () => true,
    hasStoredPlathoWalletRecord: () => storage.has(WALLET_KEY),
    readEncryptedPlathoWalletRecord: () => (storage.has(WALLET_KEY) ? JSON.parse(storage.get(WALLET_KEY)!) : null),
    localStorageOrNull: () => ({ getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, String(v)), removeItem: (k: string) => storage.delete(k) }),
    PLATHO_WALLET_STORAGE_KEY: WALLET_KEY, PLATHO_WALLET_STORAGE_KIND: 'platho-encrypted-wallet', TELEGRAM_CLOUD_WALLET_KEY: CLOUD_KEY,
    TELEGRAM_CLOUD_VALUE_MAX_BYTES: 4096, plathoCloudDataClearing: false, plathoLocalDataClearing: false, nobleSha256: sha256,
    telegramCloudSet: async (key: string, value: string) => { if ((cloudDoors as any).refuseSets) return false; sets.push(value); cloud.items.set(key, value); return true; },
    delay: (ms: number) => new Promise((resolve) => { setTimeout(resolve, Math.min(ms, (cloudDoors as any).delayCapMs ?? 60)); }),
    promptStoredWalletUnlockOnStartup: async () => { said.push('unlock asked'); },
    showAppNotice: Object.assign((text: string) => { said.push(text); env.showAppNotice.last = text; }, { last: '' }), t: (key: string) => key,
    refreshWalletHomeRows: () => {}, sameWalletAddress: (a: string, b: string) => String(a).toLowerCase() === String(b).toLowerCase(),
    withRoomForTheWallet: (write: () => any) => write(),
    openActionDialog: async (dialog: any) => { said.push(`asked: ${dialog.hint} / ${dialog.submitLabel}`); const choice = (cloudDoors as any).choose; return typeof choice === 'function' ? choice() : (choice ? {} : null); },
  };
  const api = lift(env, [line('const TELEGRAM_CLOUD_WALLET_FIELDS = '), fn('function walletRecordForTelegramCloud(record) {'), fn('function telegramCloudRead(key) {'),
    line('let telegramCloudWalletSlot = '), line('let telegramCloudWalletSlotRead = '), fn('function readTelegramCloudWalletSlot({ fresh = false } = {}) {'),
    fn('function telegramCloudWalletForm(json) {'), fn('function telegramCloudWalletOwner(json) {'), fn('function walletRecordOwner(record) {'),
    fn('function telegramCloudCopyIsOurs(slotJson, record = readEncryptedPlathoWalletRecord()) {'), fn('function sameWalletRecords(a, b) {'),
    fn("function telegramCloudSlotPlan(record, { replaces = null, intoTelegram = false, overAnother = false, implicit = false, existingSeal = false } = {}) {"),
    fn('function mirrorWalletRecordToTelegramCloud(record, { replaces = null, intoTelegram = false, overAnother = false, implicit = false, mayEvictOldest = false, existingSeal = false } = {}) {'),
    line('const TELEGRAM_CLOUD_PREVIOUS_KEYS = '), fn('function telegramCloudReadMany(keys) {'), fn('async function readPreviousWalletsInTelegram() {'), fn('async function keepPreviousWalletInTelegram(copy, { mayEvictOldest = false } = {}) {'),
    span("restoreWalletRecordFromTelegramCloud.state = 'idle';", 'async function restoreWalletRecordFromTelegramCloudOnce({ fresh = false } = {}) {'),
    line('const TELEGRAM_CLOUD_RESTORED_SALT_KEY = '), fn('function noteWalletRestoredFromTelegramCloud(record) {'),
    line('const TELEGRAM_CLOUD_CREATE_WAIT_MS = '), line('const TELEGRAM_CLOUD_UNANSWERED_OFFER_AFTER = '), line('const TELEGRAM_CLOUD_CREATE_ANYWAY_WAIT_MS = '),
    fn('async function settleTelegramCloudWalletBeforeCreate({ anyway = false } = {}) {'), fn('function telegramCloudUnansweredOffer() {'),
    fn('async function walletDoorClearOfTelegramCloud({ importing = false } = {}) {'), fn('async function walletDoorClearAfterChoosing() {'),
    fn("async function confirmGoingOnWithoutTelegramCloud(submitLabel, hintKey = 'quickstart.telegramCloudNotAnswering') {"),
    span('function telegramCloudFormDigest(form) {', 'function telegramCloudCopyWasHere(form) {'),
    span('function storedWalletRecordRaw() {', 'function walletRecordMovedSince(seen) {')],
  `{ restore: restoreWalletRecordFromTelegramCloud, mirror: mirrorWalletRecordToTelegramCloud, door: walletDoorClearOfTelegramCloud,
     settleBeforeCreate: settleTelegramCloudWalletBeforeCreate, raw: storedWalletRecordRaw, wroteHere: noteWalletRecordWrittenHere,
     moved: walletRecordMovedSince, read: () => readTelegramCloudWalletSlot() }`, 'let plathoWallet = null;');
  return { api, sets, said };
};
