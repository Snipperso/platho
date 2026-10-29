import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { code, sourceBlock } from './helpers/source';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';
import { createPlathoWallet, derivePlathoWalletTag } from '../web/platho-wallet.mjs';
import * as keyring from '../web/wallet-keyring.mjs';


const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const line = (start: string) => { const at = app.indexOf(start); if (at < 0) throw new Error(`not found: ${start}`); return app.slice(at, app.indexOf(String.fromCharCode(10), at)); };
const lift = (env: Record<string, any>, sources: string[], exported: string, prelude = '') => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [prelude, ...sources, `return ${exported};`].join(String.fromCharCode(10)))(...names.map((n) => env[n]));
};
const settle = (ms = 5) => new Promise((resolve) => { setTimeout(resolve, ms); });
const KIND = keyring.WALLET_RECORD_KIND;
const ACTIVE = 'platho.wallet.encrypted.v1';
const OTHERS = keyring.DEVICE_OTHER_WALLETS_KEY;
const owner = (n: number) => `o1:${n.toString(16).padStart(32, '0')}`;
const b64 = (text: string) => Buffer.from(text.padEnd(24, '.')).toString('base64');
const seal = (n: number, seq: number, extra: Record<string, any> = {}) => ({
  kind: KIND, version: 1, kdf: 'PBKDF2-SHA256', iterations: 600_000, salt: `s${n}-${seq}-${extra.tag ?? ''}`, cipher: 'AES-GCM-256', iv: `iv${n}-${seq}`,
  ciphertext: b64(`w${n}-seq${seq}-${extra.tag ?? ''}`), owner: owner(n), seq, ...extra,
});
const untagged = (record: any) => { const form: any = keyring.cloudFormOf(record); delete form.owner; delete form.mac; return form; };
const valueOf = (record: any, name: any = null) => keyring.cloudValueFor(record, name);
const macOf = (tag: string, text: string) => createHash('sha256').update(`${tag}|${text}`).digest('hex');
const signedBy = (n: number, record: any) => ({ ...record, mac: macOf(owner(n), keyring.sealedFieldsText(record)) });

function device(initial: { active?: any; others?: any[] } = {}) {
  const map = new Map<string, string>();
  if (initial.active) map.set(ACTIVE, JSON.stringify(initial.active));
  if (initial.others) map.set(OTHERS, JSON.stringify(initial.others.map((record, at) => ({ at, record }))));
  return { map, storage: { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, String(v)); }, removeItem: (k: string) => { map.delete(k); } } };
}
function telegram(initial: Record<string, string> = {}) {
  const values = new Map<string, string>(Object.entries(initial));
  const log: string[] = [];
  const state = { answers: true };
  return {
    values, log, state,
    telegramCloudKeys: async () => (state.answers ? [...values.keys()] : null),
    telegramCloudRead: async (k: string) => { log.push(`read ${k}`); return state.answers ? { ok: true, value: values.get(k) ?? null } : { ok: false, value: null }; },
    telegramCloudReadMany: async (keys: string[]) => keys.map((k) => (state.answers ? { ok: true, value: values.get(k) ?? null } : { ok: false, value: null })),
    telegramCloudSet: async (k: string, v: string) => { if (!state.answers) return false; log.push(`set ${k}`); values.set(k, v); return true; },
    telegramCloudRemoveItems: async (keys: string[]) => { if (!state.answers) return false; log.push(`remove ${keys.join(',')}`); for (const k of keys) values.delete(k); return true; },
  };
}
const SOURCES = () => [
  line('const PLATHO_WALLET_STORAGE_KEY = '), line('const PLATHO_WALLET_STORAGE_KIND = '), line('const TELEGRAM_CLOUD_VALUE_MAX_BYTES = '), line('const TELEGRAM_CLOUD_RESTORED_SALT_KEY = '),
  fn('function readEncryptedPlathoWalletRecord() {'), fn('function readDeviceKeyring() {'), fn('function writeDeviceKeyring(state) {'), fn('function storeDeviceKeyring(state) {'),
  fn('function withRoomForTheWallet(write) {'), fn('function walletsHeldInTelegram() {'), fn('function noteWalletHeldInTelegram(key, value) {'), fn('function telegramSealOf(record) {'),
  fn('function walletKeptInTelegram(record) {'), fn('function telegramKeysOfWallet(record) {'), fn('function sameCloudForm(a, b) {'), fn('function inTelegramWalletQueue(key, task) {'),
  fn('function writeWalletToTelegram(record, { name = undefined, add = false, over = null } = {}) {'), fn('function removeWalletFromTelegram(record, { alsoKeys = [] } = {}) {'),
  fn('function syncWalletsWithTelegram() {'), fn('async function syncWalletsWithTelegramOnce() {'),
  fn('function signedWith(sign, record) {'), fn('function provenBy(sign, record) {'), fn('function sealCounts(sign, record) {'),
  fn('function walletSaltsRestoredFromTelegramCloud() {'), fn('function noteWalletRestoredFromTelegramCloud(record) {'), fn('function storedWalletCameFromTelegramCloud() {'),
  fn('async function placeOpenedWallet(record, wallet, { asNewest = false } = {}) {'), fn('function newSealSeq(...known) {'),
  fn('function sendNewSealToTelegram(record, replaced = [], { over = null } = {}) {'), fn('function untaggedCopiesOf(record) {'), fn('async function telegramSealNow(record) {'),
  fn('async function writeStoredPlathoWallet(wallet, password, { mirror = true, seq = null } = {}) {'),
  fn('async function awaitTelegramWalletsOnEmptyDevice() {'), fn('async function walletDoorClearOfTelegramCloud() {'), fn('function hasStoredPlathoWalletRecord() {'),
  fn('function walletHomeState() {'), fn('function walletChoiceLabel(record) {'), fn('function walletUnlockCandidates() {'), fn('function distinctWalletLabels(list) {'),
  line('const WALLET_NAMES_HERE_KEY = '), line('const WALLET_NAMES_UNSENT_KEY = '), fn('function walletNameKey(record) {'), fn('function walletNamesHere() {'),
  fn('function walletNameOf(record) {'), fn('function noteWalletNameHere(record, name) {'), fn('function walletNameUnsent(owner) {'), fn('function noteWalletNameUnsent(owner, unsent) {'),
  fn('async function saveWalletName(wallet, record, name) {'), fn('async function learnWalletNameFromTelegram(wallet, record) {'), fn('function forgetWalletName(record) {'),
  fn('function walletShownName(record) {'),
  fn('async function moveWalletToTelegram() {'), fn('async function moveWalletToDeviceOnly() {'), fn('async function toncenterKeyInTelegramIsOf(owner, { waitMs = 3_000 } = {}) {'), fn('async function forgetOtherWallet(record) {'), fn('function forgetWalletHere(record) {'),
];
type Opts = { inBot?: boolean; answer?: (dialog: any) => any; wallet?: any; clock?: { now: number } };
function makeApp(dev: ReturnType<typeof device>, cloud: ReturnType<typeof telegram>, { inBot = true, answer = () => ({}), wallet = null, clock = { now: 0 } }: Opts = {}) {
  const said: string[] = [];
  const dialogs: any[] = [];
  const notice: any = (text: string) => { said.push(text); notice.last = text; };
  const env: Record<string, any> = {
    ...keyring, sameWalletRecords: keyring.sameWallet, ...cloud,
    localStorageOrNull: () => dev.storage, inTelegramBot: () => inBot, delay: (ms: number) => settle(Math.min(ms, 40)),
    showAppNotice: notice, t: (k: string, vars?: any) => (vars ? `${k}:${JSON.stringify(vars)}` : k), refreshWalletHomeRows: () => {},
    PLATHO_WALLET_LEGACY_STORAGE_KEY: 'platho.wallet.recovery.v1', noteWalletSealedOnThisDevice: () => {}, requestPersistentLocalStorage: async () => {},
    PUBLIC_CHANNEL_FEED_CACHE_KEY: 'feeds', PUBLIC_CHANNEL_PROFILE_CACHE_KEY: 'faces', personalPublicStorageSet: () => {},
    readLegacyPlaintextPlathoWalletRecord: () => null, promptStoredWalletUnlockOnStartup: async () => { said.push('unlock offered'); },
    walletCloudOwnerTag: async (w: any) => w.owner, sameWalletAddress: (a: string, b: string) => String(a).toLowerCase() === String(b).toLowerCase(),
    encryptPlathoWalletRecord: async (w: any, password: string, { seq = 1 } = {}) => signedBy(w.n, { ...seal(w.n, seq, { tag: password }), address: w.address }),
    plathoWalletRecordSigner: async (w: any) => (text: string) => macOf(w.owner, text),
    decryptPlathoWalletRecord: async (record: any) => ({ address: record.address }),
    sealWalletName: async (_w: any, name: string) => ({ iv: 'i', ct: `sealed(${name})` }), openWalletName: async (_w: any, sealed: any) => String(sealed.ct).slice(7, -1),
    shortAddress: (v: string) => v.slice(0, 6), bringToncenterKeyToTelegram: async () => { said.push('toncenter key follows'); },
    openActionDialog: async (dialog: any) => { dialogs.push(dialog); return answer(dialog); }, setTimeout: (run: () => void) => { run(); return 1; }, clearTimeout: () => {},
    console: { warn() {}, error() {} }, walletChainNowMs: () => clock.now,
  };
  const api = lift(env, SOURCES(), `{ sync: syncWalletsWithTelegram, held: walletsHeldInTelegram, kept: walletKeptInTelegram, write: writeWalletToTelegram,
    remove: removeWalletFromTelegram, place: placeOpenedWallet, seal: writeStoredPlathoWallet, list: readDeviceKeyring, home: walletHomeState,
    candidates: walletUnlockCandidates, door: walletDoorClearOfTelegramCloud, restored: storedWalletCameFromTelegramCloud, saveName: saveWalletName,
    learnName: learnWalletNameFromTelegram, nameOf: walletNameOf, toTelegram: moveWalletToTelegram, toDevice: moveWalletToDeviceOnly, forget: forgetOtherWallet,
    unlock: (w) => { plathoWallet = w; } }`, 'let plathoLocalDataClearing = false; let plathoWallet = null;');
  if (wallet) api.unlock(wallet);
  return { api, said, dialogs };
}
const ids = (state: any) => keyring.keyringRecords(state).map((r: any) => `${(r.owner || 'x').slice(-2)}@${r.seq ?? 0}`);
const keyringFakeKey = (form: any) => keyring.cloudKeyFor({ ciphertext: form.ciphertext })!;

describe('THE SYNC — Telegram\'s wallets come into the device\'s list, signed newer seals go there, nothing is replaced; earlier versions\' copies read where they lie', () => {
  it('APP-SYNC-01: a phone of 1.4.22 — the slot is read where it lies; its seal takes version 1 at its unlock, signed, goes under its tag, and the slot goes; another wallet in it comes in, said', async () => {
    const A = { ...seal(1, 0), address: 'EQ_A' };
    delete (A as any).owner;
    const dev = device({ active: A });
    const cloud = telegram({ [keyring.LEGACY_CLOUD_SLOT_KEY]: JSON.stringify({ ...A, createdAt: 5 }) });
    const { api, said } = makeApp(dev, cloud);
    const plan = await api.sync();
    await settle(20);
    expect([plan.added, plan.push, plan.retire, said], 'its own seal: nothing brought, nothing said, nothing written').toEqual([[], [], [], []]);
    expect(api.kept(A), 'kept in Telegram, as 1.4.22 kept it').toBe(true);
    const placed = await api.place(A, { n: 1, owner: owner(1), address: 'EQ_A' });
    await settle(20);
    expect([placed.seq, placed.owner, keyring.isSigned(placed)], 'at its first unlock, Telegram not waited for [1.4.24]').toEqual([1, owner(1), true]);
    expect([...cloud.values.keys()], 'one key, named by its tag; the slot gone').toEqual([keyring.cloudKeyFor(seal(1, 0))]);
    const there = keyring.parseCloudValue(cloud.values.get(keyring.cloudKeyFor(seal(1, 0))!)!)!.record;
    expect([there.ciphertext, there.seq, there.mac, 'address' in there, 'createdAt' in there]).toEqual([A.ciphertext, 1, placed.mac, false, false]);
    dev.storage.setItem('platho.wallet.telegram.cloudRestored.v1', A.salt);
    expect(api.restored()).toBe(true);
    const B = seal(2, 0);
    const devB = device({ active: { ...seal(3, 1), address: 'EQ_C' } });
    const other = makeApp(devB, telegram({ [keyring.LEGACY_CLOUD_SLOT_KEY]: JSON.stringify(untagged(B)) }));
    const brought = await other.api.sync();
    expect([brought.added.map((r: any) => r.ciphertext), other.said]).toEqual([[B.ciphertext], ['wallet.telegramKeepsEarlierCopy']]);
    devB.storage.setItem(ACTIVE, JSON.stringify(untagged(B)));
    expect(other.api.restored()).toBe(true);
  });

  it('APP-SYNC-02: a newer password set on another phone waits for the unlock, where the seed checks it — taken there, and said; one set here goes there; two seals of an earlier version settle nothing', async () => {
    const W1 = { n: 1, owner: owner(1), address: 'EQ_A' };
    const dev = device({ active: { ...signedBy(1, seal(1, 1)), address: 'EQ_A' }, others: [{ ...signedBy(2, seal(2, 3)), address: 'EQ_B' }, seal(3, 0, { tag: 'here' })] });
    const cloud = telegram({
      [keyring.cloudKeyFor(seal(1, 2))!]: valueOf(signedBy(1, seal(1, 2))),
      [keyring.cloudKeyFor(seal(2, 2))!]: valueOf(signedBy(2, seal(2, 2))),
      [keyring.cloudKeyFor(seal(3, 0))!]: valueOf(seal(3, 0, { tag: 'there' })),
    });
    const there = (n: number) => keyring.parseCloudValue(cloud.values.get(keyring.cloudKeyFor(seal(n, 0))!)!)!.record;
    const { api, said } = makeApp(dev, cloud);
    await api.sync();
    await settle(20);
    expect(ids(api.list()), 'MEASURED by round 30 F4-1: the boot\'s sync put whatever Telegram showed in place of the seal here').toEqual(['01@1', '02@3', '03@0']);
    expect(said).toEqual([]);
    expect(there(2).seq, 'this device\'s signed newer seal goes there').toBe(3);
    expect(there(3).ciphertext, 'an earlier version\'s seal stays as it is').toBe(seal(3, 0, { tag: 'there' }).ciphertext);
    expect(api.list().others.find((e: any) => e.record.owner === owner(3)).record.ciphertext).toBe(seal(3, 0, { tag: 'here' }).ciphertext);
    const placed = await api.place(api.list().active, W1);
    expect([placed.ciphertext, placed.seq, api.list().active.address], 'what only this device keeps survives the newer seal').toEqual([seal(1, 2).ciphertext, 2, 'EQ_A']);
    expect(said).toContain('wallet.newerPasswordKept');
  });

  it('APP-SYNC-03: a Telegram that does not answer changes nothing and is said as unknown; outside the official bot nothing is asked', async () => {
    const dev = device({ active: seal(1, 1) });
    const cloud = telegram({ [keyring.cloudKeyFor(seal(1, 5))!]: valueOf(seal(1, 5)) });
    cloud.state.answers = false;
    const { api } = makeApp(dev, cloud);
    expect(await api.sync()).toBeNull();
    expect([api.held(), api.kept(seal(1, 1)), api.home(), ids(api.list())]).toEqual([null, null, 'unknown', ['01@1']]);
    const outside = makeApp(device({ active: seal(1, 1) }), telegram(), { inBot: false });
    expect([await outside.api.sync(), outside.api.kept(seal(1, 1))]).toEqual([null, false]);
  });
});

describe('THE WRITES — a seal goes to Telegram only over an older one, a version counted above every seal known, an opened wallet put in its place', () => {
  it('APP-WRITE-01: never over a newer seal, nor an earlier version\'s it cannot place; never back where the person took it out; its name kept unless given', async () => {
    const cloud = telegram({ [keyring.cloudKeyFor(seal(1, 4))!]: valueOf(signedBy(1, seal(1, 4))), [keyring.cloudKeyFor(seal(2, 0))!]: valueOf(seal(2, 0, { tag: 'there' }), { iv: 'i', ct: 'N' }) });
    const { api } = makeApp(device(), cloud);
    await api.sync();
    expect(await api.write(seal(1, 3)), 'MEASURED in rounds 24-28: an older seal over another phone\'s newer password').toBe(false);
    expect(keyring.parseCloudValue(cloud.values.get(keyring.cloudKeyFor(seal(1, 4))!)!)!.record.seq).toBe(4);
    expect(await api.write(seal(2, 0, { tag: 'here' })), 'two seals of an earlier version: neither replaces the other').toBe(false);
    expect(await api.write(seal(2, 1, { tag: 'new' })), 'a seal made from now on does').toBe(true);
    expect(keyring.parseCloudValue(cloud.values.get(keyring.cloudKeyFor(seal(2, 1))!)!)!.name, 'its name stays beside it').toEqual({ iv: 'i', ct: 'N' });
    expect(await api.write(seal(2, 1, { tag: 'new' }), { name: null }), 'a name taken off').toBe(true);
    expect(keyring.parseCloudValue(cloud.values.get(keyring.cloudKeyFor(seal(2, 1))!)!)!.name).toBeNull();
    cloud.values.delete(keyring.cloudKeyFor(seal(5, 1))!);
    expect(await api.write(seal(5, 2), { name: { iv: 'i', ct: 'x' } }), 'review 29 — 7: a name, a re-seal or a push never puts back a wallet the person took out of Telegram').toBe(false);
    expect(cloud.values.has(keyring.cloudKeyFor(seal(5, 1))!)).toBe(false);
    expect(await api.write(seal(5, 2), { add: true }), 'only "Keep in Telegram" adds one').toBe(true);
    const reads = cloud.log.filter((entry) => entry.startsWith('read')).length;
    expect(await api.write(seal(2, 1, { tag: 'new' }), { name: undefined }) && cloud.log.filter((entry) => entry.startsWith('read')).length, 'already there: no call at all').toBe(reads);
    expect(await api.write(signedBy(2, seal(2, 1, { tag: 'new' }))), 'the very seal, its signature added: written').toBe(true);
    expect(keyring.parseCloudValue(cloud.values.get(keyring.cloudKeyFor(seal(2, 1))!)!)!.record.mac).toBe(signedBy(2, seal(2, 1, { tag: 'new' })).mac);
    const versioned = signedBy(2, { ...seal(2, 1, { tag: 'new' }), seq: 9 });
    cloud.values.set(keyring.cloudKeyFor(seal(2, 1))!, valueOf(versioned));
    await api.sync();
    expect(await api.write(signedBy(2, seal(2, 1, { tag: 'new' })))).toBe(false);
    expect(keyring.parseCloudValue(cloud.values.get(keyring.cloudKeyFor(seal(2, 1))!)!)!.record.seq).toBe(9);
    cloud.values.set(keyring.cloudKeyFor(seal(6, 1))!, valueOf(seal(6, keyring.SEQ_CEILING, { tag: 'planted' })));
    await api.sync();
    expect(await api.write(signedBy(6, seal(6, 2))), 'MEASURED by round 30 F4-1: a planted version held every seal back for good').toBe(true);
    const forged = keyring.cloudFormOf({ ...seal(7, keyring.SEQ_CEILING, { tag: 'forged' }), mac: 'cd'.repeat(32) });
    cloud.values.set(keyring.cloudKeyFor(seal(7, 1))!, valueOf(forged));
    await api.sync();
    expect(await api.write(signedBy(7, seal(7, 2))), 'not checked: it stays').toBe(false);
    expect(await api.write(signedBy(7, seal(7, 2)), { over: { ...forged, seq: 5 } }), 'only the very value checked').toBe(false);
    expect(await api.write(signedBy(7, seal(7, 2)), { over: forged }), 'the value the seed found false, written over').toBe(true);
  });

  it('APP-WRITE-02: a new seal counts its version above every seal of its wallet known here or in Telegram, becomes the one in use, and goes to Telegram only where it is kept', async () => {
    const wallet = { n: 1, owner: owner(1), address: 'EQ_A' };
    const dev = device({ active: { ...seal(2, 1), address: 'EQ_B' }, others: [{ ...seal(1, 2), address: 'EQ_A' }] });
    const cloud = telegram({ [keyring.cloudKeyFor(seal(1, 4))!]: valueOf(signedBy(1, seal(1, 4))) });
    const { api } = makeApp(dev, cloud);
    await api.sync();
    const written = await api.seal(wallet, 'new password');
    expect(await written.mirrored, 'kept in Telegram: the new password goes there').toBe(true);
    expect(ids(api.list()), 'the one in use; the one before kept').toEqual(['01@5', '02@1']);
    expect(keyring.parseCloudValue(cloud.values.get(keyring.cloudKeyFor(seal(1, 1))!)!)!.record.seq).toBe(5);
    expect(code(fn('async function writeStoredPlathoWallet(wallet, password, { mirror = true, seq = null } = {}) {')), 'counted over Telegram\'s seal as it is now')
      .toContain('const there = seq === null && here ? await telegramSealNow(known) : telegramSealOf(known);');
    const here = await api.seal({ n: 2, owner: owner(2), address: 'EQ_B' }, 'pw');
    expect([await here.mirrored, cloud.values.has(keyring.cloudKeyFor(seal(2, 1))!)], 'a wallet kept on this device only sends nothing').toEqual([false, false]);
    await api.seal({ n: 2, owner: owner(2), address: 'EQ_B' }, 'pw', { seq: 2 });
    expect(api.list().active.seq, 'a re-seal at today\'s count keeps its version').toBe(2);
    const full = device();
    const crowded = makeApp(full, telegram());
    for (let n = 1; n <= keyring.DEVICE_WALLETS_MAX; n += 1) await crowded.api.seal({ n, owner: owner(n), address: `EQ_${n}` }, 'pw');
    await expect(crowded.api.seal({ n: 999, owner: owner(999), address: 'EQ_X' }, 'pw'), 'a full device refuses a new wallet — nothing is pushed out').rejects.toMatchObject({ code: 'KEYRING_FULL' });
    expect(keyring.keyringRecords(crowded.api.list())).toHaveLength(keyring.DEVICE_WALLETS_MAX);
  });

  it('APP-PLACE-01: a wallet opened takes its place completed by its seed — never over a newer seal of it; a key file is the newest from now on', async () => {
    const A = { n: 1, owner: owner(1), address: 'EQ_A' };
    const dev = device({ active: { ...seal(2, 1), address: 'EQ_B' }, others: [keyring.cloudFormOf(signedBy(1, seal(1, 2)))] });
    const cloud = telegram({ [keyring.cloudKeyFor(seal(1, 2))!]: valueOf(signedBy(1, seal(1, 2))) });
    const { api, said } = makeApp(dev, cloud);
    await api.sync();
    const fromTelegram = keyring.cloudFormOf(signedBy(1, seal(1, 2)));
    const placed = await api.place({ ...fromTelegram, owner: owner(77) }, A);
    expect([placed.address, placed.owner, placed.seq], 'its address back, its owner tag the seed\'s — never what the record claims').toEqual(['EQ_A', owner(1), 2]);
    expect(ids(api.list()), 'the one in use before is kept').toEqual(['01@2', '02@1']);
    const older = await api.place(seal(1, 1), A);
    expect([older.seq, api.list().active.seq], 'the newer seal stays').toEqual([2, 2]);
    expect(said, 'the newer seal is the one in use here already: nothing new to say [round 31 — F5-1]').not.toContain('wallet.newerPasswordKept');
    const file = await api.place({ ...seal(1, 0, { tag: 'file' }) }, A, { asNewest: true });
    await settle(20);
    expect(file.seq).toBe(3);
    expect(keyring.parseCloudValue(cloud.values.get(keyring.cloudKeyFor(seal(1, 1))!)!)!.record.ciphertext).toBe(file.ciphertext);
    expect(code(fn('async function placeOpenedWallet(record, wallet, { asNewest = false } = {}) {'))).toContain('if (asNewest) placed = { ...placed, seq: newSealSeq(current, thereCounts) };');
    expect([keyring.isSigned(placed), keyring.isSigned(older), keyring.isSigned(file)], 'every seal placed is signed by its seed').toEqual([true, true, true]);
    expect(code(fn('async function activateImportedEncryptedWalletRecord(wallet, record, { toncenterApiKey = null, switched = false } = {}) {'))).toContain('await withWorkInHand(() => placeOpenedWallet(record, wallet, { asNewest: !switched }));');
  });
});

describe('REVIEW 29 — the password set last wins; an earlier version\'s copy never replaces a seal nobody can rank; one wallet read again; an unlock writes only a change', () => {
  it('R29-SEQ-01: a new seal is above every seal known AND the time it is made — a silent Telegram no longer makes the version a guess [review 29 — 3]', async () => {
    const at = (ms: number) => lift({ ...keyring, walletChainNowMs: () => ms }, [fn('function newSealSeq(...known) {')], 'newSealSeq');
    const seq = at(0);
    expect(seq(seal(1, 3), seal(1, 7)), 'above every seal known').toBe(8);
    expect(at(1_760_000_000_000)(seal(1, 3), null), 'never below the time it is made').toBe(1_760_000_000_000);
    expect(at(5.7)(null), 'a whole number').toBe(5);
    const wallet = { n: 1, owner: owner(1), address: 'EQ_A' };
    const clock = { now: 1_000 };
    const cloud = telegram({ [keyring.cloudKeyFor(seal(1, 900))!]: valueOf(seal(1, 900)) });
    const { api } = makeApp(device({ active: { ...seal(1, 900), address: 'EQ_A' } }), cloud, { clock });
    await api.sync();
    cloud.values.set(keyring.cloudKeyFor(seal(1, 1))!, valueOf(signedBy(1, seal(1, 2_000, { tag: 'B' }))));
    cloud.state.answers = false;
    clock.now = 3_000;
    await api.seal(wallet, 'the password set last');
    cloud.state.answers = true;
    await api.sync();
    await settle(20);
    expect(api.list().active.seq, 'MEASURED by review 29: it lost to the other phone\'s older one at the next sync').toBe(3_000);
    expect(keyring.parseCloudValue(cloud.values.get(keyring.cloudKeyFor(seal(1, 1))!)!)!.record.seq, 'and it is the one Telegram keeps').toBe(3_000);
  });

  it('R29-TIE-01: an older password typed by habit opens an earlier version\'s copy for the session — the seal here stays, nothing in Telegram is replaced, and the copy is never called "another wallet" [review 29 — 1]', async () => {
    const S_new = { ...seal(1, 0, { tag: 'new' }), address: 'EQ_A' };
    const S_old = seal(1, 0, { tag: 'old' });
    const cloud = telegram({ [keyring.LEGACY_CLOUD_SLOT_KEY]: JSON.stringify(untagged(S_old)) });
    const { api, said } = makeApp(device({ active: S_new }), cloud);
    await api.sync();
    await settle(20);
    expect(said, 'not "another wallet of yours": it may be this one under an older password').not.toContain('wallet.telegramKeepsEarlierWallet');
    expect(api.list().others.map((e: any) => e.record.ciphertext)).toEqual([S_old.ciphertext]);
    const placed = await api.place(untagged(S_old), { n: 1, owner: owner(1), address: 'EQ_A' });
    await settle(20);
    expect(placed.ciphertext, 'MEASURED by review 29: the newer seal was replaced, here and in Telegram').toBe(S_new.ciphertext);
    expect([api.list().active.ciphertext, api.list().others.map((e: any) => e.record.ciphertext)], 'the copy opened stays listed').toEqual([S_new.ciphertext, [S_old.ciphertext]]);
    expect([cloud.values.has(keyring.cloudKeyFor(S_new)!), cloud.values.has(keyring.LEGACY_CLOUD_SLOT_KEY)], 'nothing written over in Telegram').toEqual([false, true]);
  });

  it('R29-UNLOCK-01: the single wallet\'s seal is read again at every try; an unlock that changes nothing writes nothing; a refused flow is not "Done" [review 29 — 2, 6, 5]', async () => {
    const tried: string[] = [];
    const answers = ['first', 'second'];
    const decrypt = lift({
      t: (key: string) => key, PLATHO_WALLET_CIPHER_NAME: 'AES', PLATHO_WALLET_KDF_NAME: 'PBKDF2', walletShownName: (r: any) => r?.address ?? '', walletPasswordManagerUsername: (x: string) => x,
      requestWalletPasswordInput: async () => (answers.length ? { password: answers.shift() } : null),
      inTelegramBot: () => false, walletsHeldInTelegram: () => null, sameWalletRecords: (a: any, b: any) => a?.ciphertext === b?.ciphertext || (a?.ciphertext && b?.ciphertext && true),
      sameSeal: (a: any, b: any) => a?.ciphertext === b?.ciphertext, joinHintSentences: (...p: string[]) => p.filter(Boolean).join(' '), syncWalletsWithTelegram: async () => null, console: { error() {} }, showAppNotice: () => {},
      walletSaltsRestoredFromTelegramCloud: () => [], telegramSealOf: () => null, isSigned: keyring.isSigned,
      withWorkInHand: (task: () => any) => Promise.resolve().then(task),
      decryptPlathoWalletRecord: async (record: any, password: string) => { tried.push(`${record.ciphertext}:${password}`); if (record.ciphertext !== 'NEW' || password !== 'second') throw new Error('no'); return { address: 'EQ' }; },
    }, [fn('async function requestAndDecryptEncryptedWallet(record, {')], 'requestAndDecryptEncryptedWallet', 'let actionDialogFieldChangeHook = null; const actionFields = null;');
    let current = { ciphertext: 'OLD' };
    const opened = await decrypt({ ciphertext: 'OLD' }, { candidates: () => { const list = [{ value: 'here', record: current }]; current = { ciphertext: 'NEW' }; return list; } });
    expect(opened, 'MEASURED by review 29: the prompt kept the seal it opened with; the new password was "wrong" until closed').toEqual({ address: 'EQ' });
    expect(tried, 'the seal as it is when the password comes').toEqual(['NEW:first', 'NEW:second']);
    const A = { ...seal(1, 1), address: 'EQ_A' };
    const dev = device({ active: A });
    let writes = 0;
    const setItem = dev.storage.setItem;
    dev.storage.setItem = (k: string, v: string) => { writes += 1; setItem(k, v); };
    const { api } = makeApp(dev, telegram(), { inBot: false });
    await api.place(A, { n: 1, owner: owner(1), address: 'EQ_A' });
    writes = 0;
    await api.place(api.list().active, { n: 1, owner: owner(1), address: 'EQ_A' });
    expect(writes).toBe(0);
    await api.place({ ...seal(2, 1) }, { n: 2, owner: owner(2), address: 'EQ_B' });
    expect(writes, 'a switch is written').toBeGreaterThan(0);
    expect(code(app)).toContain("const outcome = (await quickStartCreateFlow(password)) ?? t('wallet.flowStillRunning');");
  });
});

describe('ROUND 29 — an earlier version\'s copy gets the new password; a new seal counts above Telegram now; the tie keeps the seal in use; a full device says so', () => {
  it('R29-F7-1: a 1.4.22 copy (untagged, the very seal here) takes the new password under its tag — and goes — before any Settings visit', async () => {
    const A = { ...seal(1, 0), address: 'EQ_A' };
    const bare = untagged(A);
    delete (A as any).owner;
    const xKey = keyringFakeKey(bare);
    const cloud = telegram({ [xKey]: valueOf(bare) });
    const clock = { now: 5_000 };
    const { api } = makeApp(device({ active: A }), cloud, { clock });
    await api.sync();
    await api.place(A, { n: 1, owner: owner(1), address: 'EQ_A' });
    await settle(20);
    expect([cloud.values.has(xKey), cloud.values.has(keyring.cloudKeyFor(seal(1, 0))!)], 'MEASURED by round 29 F7-1: the copy stayed untagged until a Settings visit').toEqual([false, true]);
    const written = await api.seal({ n: 1, owner: owner(1), address: 'EQ_A' }, 'the new password');
    expect(await written.mirrored).toBe(true);
    expect(keyring.parseCloudValue(cloud.values.get(keyring.cloudKeyFor(seal(1, 0))!)!)!.record.seq, 'on the clock — above the version its first unlock gave it (1) [review 32]').toBe(5_000);
    const B = { ...seal(2, 0), address: 'EQ_B' };
    delete (B as any).owner;
    const xB = keyringFakeKey(untagged(B));
    const cloud2 = telegram({ [xB]: valueOf(untagged(B)) });
    const second = makeApp(device({ active: B }), cloud2, { clock });
    await second.api.sync();
    expect(await (await second.api.seal({ n: 2, owner: owner(2), address: 'EQ_B' }, 'pw')).mirrored).toBe(true);
    await settle(20);
    expect([cloud2.values.has(xB), keyring.parseCloudValue(cloud2.values.get(keyring.cloudKeyFor(seal(2, 0))!)!)!.record.seq]).toEqual([false, 5_000]);
  });

  it('R30-M1: a new password with two seals of the wallet here (its own untagged one, Telegram\'s tagged one) — the own seal\'s 1.4.22 copy gives way too', async () => {
    const L = { ...seal(1, 0, { tag: 'here' }), address: 'EQ_A' };
    delete (L as any).owner;
    const Tg = seal(1, 0, { tag: 'the other phone' });
    const xL = keyringFakeKey(untagged(L));
    const xT = keyringFakeKey(untagged(Tg));
    const cloud = telegram({ [xL]: valueOf(untagged(L)), [xT]: valueOf(untagged(Tg)), [keyring.cloudKeyFor(Tg)!]: valueOf(Tg) });
    const { api } = makeApp(device({ active: L }), cloud, { clock: { now: 7_000 } });
    await api.sync();
    expect(await (await api.seal({ n: 1, owner: owner(1), address: 'EQ_A' }, 'new')).mirrored).toBe(true);
    await settle(20);
    expect([cloud.values.has(xL), cloud.values.has(xT), keyring.parseCloudValue(cloud.values.get(keyring.cloudKeyFor(Tg)!)!)!.record.seq],
      'MEASURED by review 30 M1: the old-password copy stayed and came back as "another wallet" on every device').toEqual([false, false, 7_000]);
  });

  it('R29-F1-2: a new seal counts above Telegram\'s seal as it is NOW — a clock a few seconds behind never loses the password set last', async () => {
    const wallet = { n: 1, owner: owner(1), address: 'EQ_A' };
    const clock = { now: 100_000 };
    const cloud = telegram({ [keyring.cloudKeyFor(seal(1, 90_000))!]: valueOf(seal(1, 90_000)) });
    const { api } = makeApp(device({ active: { ...seal(1, 90_000), address: 'EQ_A' } }), cloud, { clock });
    await api.sync();
    cloud.values.set(keyring.cloudKeyFor(seal(1, 1))!, valueOf(signedBy(1, seal(1, 125_000, { tag: 'A, a clock 25 s ahead' }))));
    await api.seal(wallet, 'set last, here');
    await api.sync();
    await settle(20);
    expect(api.list().active.seq, 'MEASURED by round 29 F1-2: it lost to the earlier password on a clock 25 s ahead').toBe(125_001);
    expect(keyring.parseCloudValue(cloud.values.get(keyring.cloudKeyFor(seal(1, 1))!)!)!.record.seq).toBe(125_001);
  });

  it('R29-F1-3: an untagged record here and a tagged copy of it in Telegram — no "another wallet", and the record unlocked here stays in use', async () => {
    const X = { ...seal(1, 0, { tag: 'X' }), address: 'EQ_A' };
    delete (X as any).owner;
    const Y = seal(1, 0, { tag: 'Y' });
    const cloud = telegram({ [keyring.cloudKeyFor(Y)!]: valueOf(Y) });
    const { api, said } = makeApp(device({ active: X }), cloud);
    await api.sync();
    expect(said, 'MEASURED by round 29 F1-3: "Telegram keeps another wallet" — of this very wallet').not.toContain('wallet.telegramKeepsEarlierWallet');
    const placed = await api.place(X, { n: 1, owner: owner(1), address: 'EQ_A' });
    expect([placed.ciphertext, api.list().active.ciphertext], 'MEASURED: Telegram\'s seal took the one opened here').toEqual([X.ciphertext, X.ciphertext]);
    const state = keyring.normalizeKeyring({ active: { ...untagged(seal(5, 0, { tag: 'PO' })) }, others: [{ at: 1, record: seal(5, 3) }] });
    expect(keyring.keyringFind(state, seal(5, 0, { tag: 'PO' })).seq, 'MEASURED by round 29 F1-3: the untagged duplicate shadowed the tagged seal').toBe(3);
  });

  it('R29-F2-2: a full device says so at the door, before any question or password, and the wallet in use stays open', async () => {
    const said: string[] = [];
    let asked = 0;
    const confirm = lift({
      readEncryptedPlathoWalletRecord: () => ({ ciphertext: 'A' }), readLegacyPlaintextPlathoWalletRecord: () => null, sameWalletRecords: (a: any, b: any) => a?.ciphertext === b?.ciphertext,
      plathoWallet: { address: 'EQ_A' }, hasStoredPlathoWalletRecord: () => true, t: (key: string, vars?: any) => (vars ? `${key}:${vars.count}` : key),
      openActionDialog: async () => { asked += 1; return {}; }, showAppNotice: (text: string) => said.push(text), sameWalletAddress: (a: string, b: string) => a === b,
      shortAddress: (v: string) => v, walletAddressForCopy: (w: any) => w.address, storedWalletShortLabel: () => 's', walletHomeState: () => 'device',
      DEVICE_WALLETS_MAX: 3, readDeviceKeyring: () => ({ active: { ciphertext: 'A' }, others: [{ record: { ciphertext: 'B' } }, { record: { ciphertext: 'C' } }] }),
      keyringRecords: (s: any) => [s.active, ...s.others.map((e: any) => e.record)].filter(Boolean),
    }, [fn("async function confirmWalletReplacement(actionLabel = t('wallet.replaceThisWallet'), { incoming = null, incomingWallet = null } = {}) {")], 'confirmWalletReplacement');
    expect(await confirm('create'), 'MEASURED by round 29 F2-2: the question, the password, then "try again"').toBe(false);
    expect([asked, said]).toEqual([0, ['wallet.deviceWalletsFull:3']]);
    expect(await confirm('a key file of one here', { incoming: { ciphertext: 'B' } }), 'a wallet already here is no new one').toBe(true);
    expect(code(fn('function walletDeviceFaultWords(error) {'))).toContain("if (error?.code === 'KEYRING_FULL') return t('wallet.deviceWalletsFull', { count: DEVICE_WALLETS_MAX });");
  });

  it('R29-F2-1: a wallet kept only in Telegram, its password typed while Telegram\'s answer is on its way, opens — the list read when the password comes', async () => {
    const tried: string[] = [];
    let list: any[] = [{ value: 'here', record: { ciphertext: 'A', address: 'EQ_A' } }];
    let held: any = null;
    let prompts = 0;
    const decrypt = lift({
      t: (key: string) => key, PLATHO_WALLET_CIPHER_NAME: 'AES', PLATHO_WALLET_KDF_NAME: 'PBKDF2', walletShownName: (r: any) => r?.address ?? '', walletPasswordManagerUsername: (x: string) => x,
      requestWalletPasswordInput: async (dialog: any) => {
        hints.push(dialog.hint);
        if (prompts === 1) { held = new Map(); list = [...list, { value: 'w:T', record: { ciphertext: 'T' } }]; }
        return prompts++ < 2 ? { password: 'pT' } : null;
      }, console: { error() {} }, showAppNotice: () => {}, withWorkInHand: (task: () => any) => Promise.resolve().then(task),
      decryptPlathoWalletRecord: async (record: any, password: string) => { tried.push(record.ciphertext); if (record.ciphertext === 'T' && password === 'pT') return { address: 'EQ_T' }; throw new Error('no'); },
      inTelegramBot: () => true, walletsHeldInTelegram: () => held, sameWalletRecords: (a: any, b: any) => a?.ciphertext === b?.ciphertext, sameSeal: (a: any, b: any) => a?.ciphertext === b?.ciphertext,
      joinHintSentences: (...p: string[]) => p.filter(Boolean).join(' '), sameWalletAsRecord: async () => false, confirmOpenFoundWallet: async () => true,
      findWalletByPassword: async (candidates: any[], password: string) => { for (const c of candidates) { try { const w = { address: c.record.ciphertext === 'T' && password === 'pT' ? 'EQ_T' : null }; tried.push(`try ${c.record.ciphertext}`); if (w.address) return { candidate: c, wallet: w }; } catch { } } return null; },
      syncWalletsWithTelegram: () => new Promise(() => {}), delay: () => new Promise(() => {}),
      telegramSealOf: () => null, isSigned: keyring.isSigned,
    }, [fn('async function requestAndDecryptEncryptedWallet(record, {')], 'requestAndDecryptEncryptedWallet', 'let actionDialogFieldChangeHook = null; const actionFields = null;');
    const hints: string[] = [];
    const opened = await decrypt({ ciphertext: 'A' }, { candidates: () => list });
    expect(opened, 'MEASURED by round 29 F2-1: "Wrong password" at every try while Telegram\'s answer was on its way — the list is read again at each').toEqual({ address: 'EQ_T' });
    expect(tried).toEqual(['A', 'A', 'try T']);
    expect(hints[1], 'the first try says Telegram has not answered yet — a sentence of its own [round 31 — L]').toBe('wallet.wrongPassword wallet.telegramNotAnswering');
  });

  it('R30-F2-1: no wait for Telegram at a wrong password, and no "trying your other wallets" where there are none', async () => {
    const waits: number[] = [];
    const said: any[] = [];
    let prompts = 0;
    const decrypt = lift({
      t: (key: string) => key, PLATHO_WALLET_CIPHER_NAME: 'AES', PLATHO_WALLET_KDF_NAME: 'PBKDF2', walletShownName: (r: any) => r?.address ?? '', walletPasswordManagerUsername: (x: string) => x,
      requestWalletPasswordInput: async () => (prompts++ < 3 ? { password: 'wrong' } : null), console: { error() {} }, showAppNotice: (...args: any[]) => { said.push(args[0]); },
      withWorkInHand: (task: () => any) => Promise.resolve().then(task), decryptPlathoWalletRecord: async () => { throw new Error('no'); },
      inTelegramBot: () => true, walletsHeldInTelegram: () => null, sameWalletRecords: (a: any, b: any) => a?.ciphertext === b?.ciphertext, sameSeal: (a: any, b: any) => a?.ciphertext === b?.ciphertext,
      joinHintSentences: (...p: string[]) => p.filter(Boolean).join(' '), sameWalletAsRecord: async () => false, confirmOpenFoundWallet: async () => false,
      findWalletByPassword: async () => null, syncWalletsWithTelegram: () => new Promise(() => {}),
      telegramSealOf: () => null, isSigned: keyring.isSigned,
      delay: (ms: number) => { waits.push(ms); return new Promise(() => {}); },
    }, [fn('async function requestAndDecryptEncryptedWallet(record, {')], 'requestAndDecryptEncryptedWallet', 'let actionDialogFieldChangeHook = null; const actionFields = null;');
    expect(await decrypt({ ciphertext: 'A' }, { candidates: () => [{ value: 'here', record: { ciphertext: 'A', address: 'EQ_A' } }] }), 'answered at once, three times').toBeNull();
    expect([prompts, waits, said.filter((text) => text === 'wallet.unlockTryingOthers').length],
      'MEASURED by round 30 F2-1/F5-1/F8-3: 8 s behind a bare logo at every wrong password, "trying your other wallets" with none').toEqual([4, [], 0]);
  });

  it('R30-F8-1: a wrong password on a seal that came from another device says which password opens it now', async () => {
    const hints: string[] = [];
    let prompts = 0;
    const decrypt = lift({
      t: (key: string) => key, PLATHO_WALLET_CIPHER_NAME: 'AES', PLATHO_WALLET_KDF_NAME: 'PBKDF2', walletShownName: (r: any) => r?.address ?? '', walletPasswordManagerUsername: (x: string) => x,
      requestWalletPasswordInput: async (dialog: any) => { hints.push(dialog.hint); return prompts++ < 2 ? { password: 'this phone\'s own' } : null; }, console: { error() {} }, showAppNotice: () => {},
      withWorkInHand: (task: () => any) => Promise.resolve().then(task), decryptPlathoWalletRecord: async () => { throw new Error('no'); },
      inTelegramBot: () => true, walletsHeldInTelegram: () => new Map(), sameWalletRecords: (a: any, b: any) => a?.ciphertext === b?.ciphertext, sameSeal: (a: any, b: any) => a?.ciphertext === b?.ciphertext,
      joinHintSentences: (...p: string[]) => p.filter(Boolean).join(' '), sameWalletAsRecord: async () => false, confirmOpenFoundWallet: async () => false,
      findWalletByPassword: async () => null, syncWalletsWithTelegram: async () => ({}), delay: () => Promise.resolve(),
      walletSaltsRestoredFromTelegramCloud: () => ['from-the-other-phone'], telegramSealOf: () => null, isSigned: keyring.isSigned,
    }, [fn('async function requestAndDecryptEncryptedWallet(record, {')], 'requestAndDecryptEncryptedWallet', 'let actionDialogFieldChangeHook = null; const actionFields = null;');
    const seal = { ciphertext: 'A', address: 'EQ_A', salt: 'from-the-other-phone' };
    expect(await decrypt(seal, { candidates: () => [{ value: 'here', record: seal }] })).toBeNull();
    expect(hints[1], 'MEASURED by round 30 F8-1: "Wrong password or damaged encrypted wallet data" alone, the notice gone in 12 s').toBe('wallet.wrongPassword wallet.wrongPasswordOtherDevice');
    prompts = 0;
    hints.length = 0;
    const own = { ...seal, salt: 'made here' };
    await decrypt(own, { candidates: () => [{ value: 'here', record: own }] });
    expect(hints[1], 'a seal made here: the plain words').toBe('wallet.wrongPassword');
  });

  it('R30-F8-2: an earlier version\'s copy of the wallet in use, opened, is no switch and no "password from your other device" — it leaves the list', async () => {
    const W1 = { n: 1, owner: owner(1), address: 'EQ_A' };
    const inUse = { ...seal(1, 5_000, { tag: 'this phone, unlocked first' }), address: 'EQ_A' };
    const copy = untagged(seal(1, 0, { tag: 'the other phone, 1.4.22' }));
    const copyKey = keyringFakeKey(copy);
    const kept = telegram({ [copyKey]: valueOf(copy) });
    const unsigned = makeApp(device({ active: inUse, others: [copy] }), kept, { wallet: W1 });
    await unsigned.api.sync();
    await unsigned.api.place(copy, W1);
    await settle(20);
    expect([keyring.keyringRecords(unsigned.api.list()).length, unsigned.api.list().active.ciphertext, kept.values.has(copyKey)], 'its copy in Telegram stays: a password too')
      .toEqual([2, inUse.ciphertext, true]);
    const { api, said } = makeApp(device({ active: inUse, others: [copy] }), telegram(), { wallet: W1 });
    await api.place(inUse, W1);
    await api.place(copy, W1);
    await settle(20);
    expect([keyring.keyringRecords(api.list()).length, api.list().active.ciphertext, api.list().active.address],
      'MEASURED by round 30 F8-2: the copy stayed listed as another wallet').toEqual([1, inUse.ciphertext, 'EQ_A']);
    expect(said, 'MEASURED by round 31 F5-1: "the password from your other device" of this phone\'s own seal in use').not.toContain('wallet.newerPasswordKept');
    const other = code(fn('async function openOtherWallets() {'));
    expect(other).toMatch(/if \(plathoWallet\?\.address && sameWalletAddress\(wallet\.address, plathoWallet\.address\)\) \{\s*await withWorkInHand\(\(\) => placeOpenedWallet\(opened\.record, wallet\)\);\s*refreshWalletHomeRows\(\);\s*showAppNotice\(t\('wallet\.earlierCopyOfThisWallet'\), 8_000\);\s*return true;/);
    expect(other.indexOf("withWorkInHand(() => placeOpenedWallet(opened.record, wallet))"), 'before any switch').toBeLessThan(other.indexOf('activateImportedEncryptedWalletRecord('));
  });
});

describe('ROUND 29 — the quick start\'s password leaves its fields; the copy\'s word comes after "Password changed"', () => {
  it('R29-F3-1: the quick start\'s password is cleared from its fields once read — "typed" fields no longer hold the app through the first sync', () => {
    const run = code(app.slice(app.indexOf("    title: () => t('quickstart.createWalletTitle'),"), app.indexOf("    key: 'toncenter',")));
    expect(run).toMatch(/if \(error\) return error;\s*const fields = \[\.\.\.\(quickStartStepBody\?\.querySelectorAll\('input\[type="password"\]'\) \?\? \[\]\)\];\s*for \(const field of fields\) \{ field\.value = ''; delete field\.dataset\.typed; \}/);
    expect(run, 'given back where nothing was made and the step is still open, not "typed" [round 31 — L; review 34 — R34-5]').toContain("if (typeof outcome === 'string' && !hasStoredPlathoWalletRecord()) for (const field of fields) if (field.isConnected) field.value = password;");
  });

  it('R29-F8-1: the password change says "Password changed" first; the copy\'s warning follows, only of a wallet Telegram keeps', () => {
    const change = code(fn('async function changeStoredPlathoWalletPassword() {'));
    expect(change, 'MEASURED by round 29 F8-1: 15 s of silence, then the warning lived 0.1 s').not.toMatch(/await Promise\.race\(\[written\.mirrored/);
    expect(change).toMatch(/void Promise\.race\(\[written\.mirrored, delay\(15_000\)\.then\(\(\) => false\)\]\)\.then\(\(landed\) => \{\s*if \(!landed && walletKeptInTelegram\(readEncryptedPlathoWalletRecord\(\)\) === true\) showAppNotice\(t\('wallet\.passwordChangedCopyOwed'\), 12_000\);/);
    expect(code(fn('async function requestAndDecryptEncryptedWallet(record, {')), 'round 29 F4-2: a declined found wallet is dropped').toContain('found = null;');
  });
});

describe('EARLIER VERSIONS\' SEALS — the phone whose version reaches Telegram first sets the password; one class of versions; a password changed always wins [decided 2026-10-15]', () => {
  const W1 = { n: 1, owner: owner(1), address: 'EQ_A' };
  const phones = () => {
    const L1 = { ...seal(1, 0, { tag: 'phone 1' }), address: 'EQ_A' };
    const L2 = { ...seal(1, 0, { tag: 'phone 2' }), address: 'EQ_A' };
    delete (L1 as any).owner;
    delete (L2 as any).owner;
    return { L1, L2 };
  };
  const inTelegram = (cloud: any) => keyring.parseCloudValue(cloud.values.get(keyring.cloudKeyFor(seal(1, 0))!)!)!.record;

  it('R30-FIRST-01: two phones, one wallet, two 1.4.22 passwords — the one unlocked first sets it on every device and in Telegram; the other is told', async () => {
    const { L1, L2 } = phones();
    const cloud = telegram({ [keyring.LEGACY_CLOUD_SLOT_KEY]: JSON.stringify(untagged(L1)) });
    const clock = { now: 1_000 };
    const one = makeApp(device({ active: L1 }), cloud, { clock });
    const two = makeApp(device({ active: L2 }), cloud, { clock });
    await one.api.sync();
    await two.api.sync();
    await one.api.place(L1, W1);
    await settle(20);
    clock.now = 2_000;
    await two.api.sync();
    await two.api.place(L2, W1);
    await settle(20);
    await one.api.sync();
    await settle(20);
    const ct = (app: any) => app.api.list().active.ciphertext;
    expect([ct(one), ct(two), inTelegram(cloud).ciphertext]).toEqual([L1.ciphertext, L1.ciphertext, L1.ciphertext]);
    expect([one.said.includes('wallet.newerPasswordKept'), two.said.includes('wallet.newerPasswordKept')], 'the phone that changes is told; the other is not').toEqual([false, true]);
    expect([keyring.keyringRecords(one.api.list()).length, keyring.keyringRecords(two.api.list()).length], 'one entry for the wallet on each').toEqual([1, 1]);
    expect(two.api.list().active.address, 'completed as the seed says').toBe('EQ_A');
  });

  it('R30-FIRST-01B: a phone whose seal Telegram does not keep takes a version here alone; the phones then settle on one of the two passwords, said where it changes', async () => {
    const { L1, L2 } = phones();
    const cloud = telegram({ [keyring.LEGACY_CLOUD_SLOT_KEY]: JSON.stringify(untagged(L1)) });
    const clock = { now: 1_000 };
    const one = makeApp(device({ active: L1 }), cloud, { clock });
    const two = makeApp(device({ active: L2 }), cloud, { clock });
    await one.api.sync();
    await two.api.sync();
    await two.api.place(L2, W1);
    await settle(20);
    expect([two.api.list().active.seq, cloud.values.has(keyring.cloudKeyFor(seal(1, 0))!)], 'one above the seals known, not the clock [review 32]').toEqual([1, false]);
    clock.now = 2_000;
    await one.api.place(L1, W1);
    await settle(20);
    await two.api.sync();
    await settle(20);
    await one.api.sync();
    await settle(20);
    const ct = (app: any) => app.api.list().active.ciphertext;
    for (const app of [one, two]) { await app.api.place(app.api.list().active, W1); await settle(20); }
    const settled = ct(one);
    expect([[L1.ciphertext, L2.ciphertext].includes(settled), ct(two), inTelegram(cloud).ciphertext]).toEqual([true, settled, settled]);
    expect((settled === L1.ciphertext ? two : one).said, 'the phone whose password is replaced says so').toContain('wallet.newerPasswordKept');
  });

  it('R30-FIRST-02: a password changed with versions is never undone by a later first unlock of an earlier version\'s seal', async () => {
    const { L2 } = phones();
    const changed = signedBy(1, seal(1, 1_500, { tag: 'changed on phone 1' }));
    const cloud = telegram({ [keyring.cloudKeyFor(changed)!]: valueOf(changed) });
    const two = makeApp(device({ active: L2 }), cloud, { clock: { now: 9_000 } });
    await two.api.sync();
    await two.api.place(L2, W1);
    await settle(20);
    expect([two.api.list().active.ciphertext, inTelegram(cloud).ciphertext]).toEqual([changed.ciphertext, changed.ciphertext]);
    expect(two.said).toContain('wallet.newerPasswordKept');
    expect([keyring.keyringRecords(two.api.list()).length, two.api.list().active.address],
      'MEASURED by round 30 F1-3: the seal opened stayed listed as another wallet, and the one in use showed as "the wallet kept in Telegram"').toEqual([1, 'EQ_A']);
  });

  it('R30-FIRST-03: nothing waits at a first unlock — a session that heard nothing since takes version 1 here, whatever the clocks; the phones settle at their next unlocks', async () => {
    const { L1, L2 } = phones();
    const cloud = telegram({ [keyring.LEGACY_CLOUD_SLOT_KEY]: JSON.stringify(untagged(L1)) });
    const one = makeApp(device({ active: L1 }), cloud, { clock: { now: 10_000 } });
    const two = makeApp(device({ active: L2 }), cloud, { clock: { now: 86_410_000 } });
    await one.api.sync();
    await two.api.sync();
    await one.api.place(L1, W1);
    await settle(20);
    const reads = cloud.log.length;
    expect((await two.api.place(L2, W1)).seq, 'one above the seals it knows — never the clock [review 32]').toBe(1);
    expect(cloud.log.slice(reads).filter((entry) => entry.startsWith('read')), 'Telegram not asked at the unlock [1.4.24]').toEqual([]);
    await settle(20);
    for (const app of [one, two, one]) { await app.api.sync(); await settle(20); }
    for (const app of [one, two]) { await app.api.place(app.api.list().active, W1); await settle(20); }
    const ct = (app: any) => app.api.list().active.ciphertext;
    expect([ct(two), inTelegram(cloud).ciphertext], 'MEASURED by round 30 F1-2: a clock a day ahead made the phone unlocked later the newer').toEqual([ct(one), ct(one)]);
  });

  it('R30-FIRST-04: Telegram silent at the first unlock — the version is given at once, signed, nothing waited for; the wallet in use stays the one opened beside another unversioned seal of it', async () => {
    const { L1 } = phones();
    const cloud = telegram();
    cloud.state.answers = false;
    const one = makeApp(device({ active: L1 }), cloud, { clock: { now: 5_000 } });
    const silent = await one.api.place(L1, W1);
    expect([silent.seq, one.api.list().active.seq, keyring.isSigned(one.api.list().active)], 'round 30: no version while Telegram was silent, a wait for it at every unlock').toEqual([1, 1, true]);
    const otherPhone = seal(1, 0, { tag: 'the other phone, a stand copy' });
    const tele = telegram();
    tele.state.answers = false;
    const quiet = makeApp(device({ active: phones().L1, others: [otherPhone] }), tele, { clock: { now: 6_000 } });
    const kept = await quiet.api.place(phones().L1, W1);
    expect([kept.ciphertext, quiet.api.list().active.ciphertext], 'the seal opened, not the other phone\'s').toEqual([phones().L1.ciphertext, phones().L1.ciphertext]);
    const outside = makeApp(device({ active: phones().L1 }), telegram(), { inBot: false, clock: { now: 7_000 } });
    expect((await outside.api.place(outside.api.list().active, W1)).seq, 'outside the bot too').toBe(1);
  });

  it('R30-FIRST-05: a seal with a version keeps it at the next unlock, and no seal carries a class of its own', async () => {
    const versioned = { ...signedBy(1, seal(1, 4_000, { tag: 'first unlocked here' })), address: 'EQ_A' };
    const { api } = makeApp(device({ active: versioned }), telegram(), { clock: { now: 9_000 } });
    const placed = await api.place(versioned, W1);
    expect([placed.seq, api.list().active.seq], 'a version at every unlock (round 30 F7-3, mutation S7) moved it on each time').toEqual([4_000, 4_000]);
    expect(code(fn('async function encryptPlathoWalletRecord(wallet, password, { seq = 1 } = {}) {')), 'the stamps are gone').not.toContain('stamped');
    expect(code(fn('async function placeOpenedWallet(record, wallet, { asNewest = false } = {}) {'))).toContain('placed = { ...placed, seq: nextSeq(current, thereCounts) };');
  });

  it('R31-F5-2: a Telegram that never answers holds no first unlock — nothing is asked; an untagged copy stays until the seal under its tag has landed', async () => {
    const { L1 } = phones();
    const hung = telegram();
    let asked = 0;
    hung.telegramCloudRead = () => { asked += 1; return new Promise(() => {}); };
    const one = makeApp(device({ active: L1 }), hung);
    const done = await Promise.race([one.api.place(L1, W1).then((r: any) => r.seq ?? 0), settle(1_000).then(() => 'still waiting')]);
    expect([done, asked], 'mutation T1 (round 31 F5): without its bound the first unlock waited for ever; now it asks nothing [1.4.24]').toEqual([1, 0]);
    const A = { ...seal(5, 0), address: 'EQ_E' };
    const bare = untagged(A);
    delete (A as any).owner;
    const xKey = keyringFakeKey(bare);
    const refusing = telegram({ [xKey]: valueOf(bare) });
    refusing.telegramCloudSet = async () => false;
    const two = makeApp(device({ active: A }), refusing);
    await two.api.sync();
    await (await two.api.seal({ n: 5, owner: owner(5), address: 'EQ_E' }, 'a new password')).mirrored;
    await settle(20);
    expect(refusing.values.has(xKey), 'the only copy in Telegram deleted before its replacement landed').toBe(true);
  });

  it('R31-LOW-1: the very seal as the device holds it now; a re-seal never over a newer seal; the notice where the seal in use came from another device', async () => {
    const stale = { ...seal(1, 0, { tag: 'opened' }), address: 'EQ_A' };
    const relabelled = signedBy(1, { ...stale, seq: 5, owner: owner(1) });
    const one = makeApp(device({ active: relabelled }), telegram(), { clock: { now: 9_000 } });
    const placed = await one.api.place(stale, W1);
    expect([placed.seq, one.api.list().active.seq], 'MEASURED by round 31 F3-2: written back with none').toEqual([5, 5]);
    const viaTelegram = makeApp(device({ active: stale }), telegram({ [keyring.cloudKeyFor(seal(1, 0))!]: valueOf(signedBy(1, { ...stale, seq: 7 })) }));
    await viaTelegram.api.sync();
    const taken = await viaTelegram.api.place(stale, W1);
    expect([taken.seq, taken.ciphertext]).toEqual([7, stale.ciphertext]);
    const newer = { ...seal(1, 50, { tag: 'a newer password, from a sync' }), address: 'EQ_A' };
    const two = makeApp(device({ active: newer }), telegram());
    await two.api.seal(W1, 'the older password', { seq: 2 });
    expect(two.api.list().active.ciphertext, 'the older password went back over it').toBe(newer.ciphertext);
    const fromThere = { ...signedBy(1, seal(1, 70, { tag: 'from the other phone' })), address: 'EQ_A' };
    const olderCopy = { ...seal(1, 3, { tag: 'this phone, older' }), address: 'EQ_A' };
    const dev3 = device({ active: fromThere });
    dev3.storage.setItem('platho.wallet.telegram.cloudRestored.v1', JSON.stringify([fromThere.salt]));
    const three = makeApp(dev3, telegram());
    await three.api.place(olderCopy, W1);
    expect(three.said).toContain('wallet.newerPasswordKept');
    const four = makeApp(device({ active: { ...signedBy(1, seal(1, 70, { tag: 'made here' })), address: 'EQ_A' } }), telegram());
    await four.api.place(olderCopy, W1);
    expect(four.said, 'made here: no "other device" [round 31 — F5-1]').not.toContain('wallet.newerPasswordKept');
  });

  it('R34-1: a key cleared here leaves Telegram however slowly Telegram answers; where a person waits, the read is a moment at most', async () => {
    const cloud = new Map<string, string>([['platho_toncenter_key_v1', JSON.stringify({ owner: 'o1:aa', enc: {} })]]);
    const env = {
      telegramCloudStorage: () => ({}), telegramLaunchedByOfficialBot: () => true, walletHomeState: () => 'telegram', readStoredToncenterApiKey: () => null,
      walletCloudOwnerTag: async (w: any) => `o1:${w.tag}`, encryptToncenterApiKeyForBackup: async () => ({}), telegramCloudSet: async () => true,
      telegramCloudRemoveItems: async (keys: string[]) => { for (const k of keys) cloud.delete(k); return true; },
      telegramCloudRead: (k: string) => new Promise((resolve) => { setTimeout(() => resolve({ ok: true, value: cloud.get(k) ?? null }), 30); }),
      delay: () => Promise.resolve(),
    };
    const api = lift(env, [fn('async function bringToncenterKeyToTelegram(wallet = plathoWallet, { taken = true } = {}) {'), fn('async function toncenterKeyInTelegramIsOf(owner, { waitMs = 3_000 } = {}) {')],
      '{ bring: bringToncenterKeyToTelegram, isOf: toncenterKeyInTelegramIsOf }', 'let plathoWallet = null;');
    expect(await api.isOf('o1:aa'), 'where a person waits: given up at its bound').toBe(false);
    expect([await api.bring({ address: 'EQ_A', tag: 'aa' }), cloud.has('platho_toncenter_key_v1')], 'MEASURED by review 34 R34-1: the cleared key stayed and came back').toEqual([true, false]);
  });

  it('WALLET-LIST-01: Other wallets is one list of every wallet here — the one in use marked, a cloud where Telegram keeps it, a bin on the others [2026-10-15]', () => {
    const list = code(fn('async function openOtherWallets() {'));
    expect(list, 'two drop-downs, gone').not.toContain("type: 'select'");
    expect(list).toContain("row.className = `share-target-row wallet-list-row${entry.inUse ? ' is-selected' : ''}`;");
    expect(list).toContain("sub.textContent = t('wallet.inUseNow');");
    expect(list).toContain('if (walletKeptInTelegram(entry.record) === true) {');
    expect(list).toContain("glyph.className = 'icon icon-trash';");
    expect(list).toContain("bin.addEventListener('click', () => choose(entry, 'forget'));");
    expect(list, 'the name is what is pressed').toContain("text.addEventListener('click', () => choose(entry, 'use'));");
    expect(list, 'no bin on the one in use').toMatch(/if \(!entry\.inUse\) \{\s*const bin = document\.createElement\('button'\);/);
  });

  it('R31-LOW-2: a Telegram that stops answering holds no opened wallet past a bound; another bot\'s cloud is not read for the key-backup list; the clear survives a failing cache step; Other wallets reads nothing of its own', () => {
    expect(code(fn('async function restoreToncenterKeyFromTelegram(record, wallet) {')), 'round 31 F4-1').toContain("const read = await Promise.race([telegramCloudRead('platho_toncenter_key_v1'), delay(8_000).then(() => ({ ok: false }))]).catch(() => ({ ok: false }));");
    const reconcile = code(fn('async function reconcileWalletKeyBackupMarker(wallet = plathoWallet) {'));
    expect(reconcile, 'round 31 F4-1').toContain('await Promise.race([walletKeyBackupCloudRead, delay(8_000)]);');
    expect(reconcile, 'round 31 F4-2').toContain('!inTelegramBot()) return;');
    expect(code(fn('async function readWalletKeyBackupPendingFromTelegramCloud() {')), 'round 31 F4-2').toMatch(/^\s*async function readWalletKeyBackupPendingFromTelegramCloud\(\) \{\s*if \(!inTelegramBot\(\)\) return;/);
    expect(code(fn('async function restoreQuickStartDismissalFromTelegramCloud() {')), 'round 31 F4-2').toMatch(/\{\s*if \(!inTelegramBot\(\)\) return;/);
    const clear = code(fn('async function clearPlathoLocalData() {'));
    expect(clear, 'round 31 F4-3').toMatch(/try \{\s*if \(globalThis\.caches\?\.keys\) \{[\s\S]*?\} catch \(error\) \{ console\.warn\('\[clear\] caches', error\); \}/);
    expect(clear, 'round 31 F4-3').toMatch(/try \{\s*if \(navigator\.serviceWorker\?\.getRegistrations\) \{[\s\S]*?\} catch \(error\) \{ console\.warn\('\[clear\] service worker', error\); \}/);
    const button = app.slice(app.indexOf("otherWalletsButton?.addEventListener('click', walletFlowOnce("));
    expect(code(button.slice(0, button.indexOf('}));') + 4)), 'round 31 F6: the copy came back before its deletion landed').not.toContain('{ read: true }');
    expect(code(fn('async function forgetOtherWallet(record) {')), 'round 31 F4-5').toContain("removeWalletFromTelegram(record, { alsoKeys: (await toncenterKeyInTelegramIsOf(recordOwner(record))) ? ['platho_toncenter_key_v1'] : [] })");
  });

  it('R31-F3-1: placing an opened wallet — its wait on Telegram — holds the window at every caller', () => {
    const calls = (code(app).match(/[^\n]*placeOpenedWallet\((?:opened\.record|record), wallet[^\n]*/g) ?? []).filter((line) => !line.includes('async function placeOpenedWallet'));
    expect(calls.length, 'the lock screen, Other wallets, a switch or a key file').toBe(3);
    for (const call of calls) expect(call, 'MEASURED by round 31 F3-1: a frozen window woke and put its wallet in use under another window\'s').toContain('withWorkInHand(() => placeOpenedWallet(');
  });

  it('R31-F1-1: a wallet switched to at a tie of two unversioned seals comes into use at the seal opened — never Telegram\'s other one; the one in use stays at its seal', async () => {
    const pB = { ...seal(1, 0, { tag: 'this phone, 1.4.22' }), address: 'EQ_A' };
    delete (pB as any).owner;
    const pA = seal(1, 0, { tag: 'the other phone, moved under the tag unversioned' });
    const W2 = { ...seal(2, 7_000, { tag: 'a wallet made here' }), address: 'EQ_B' };
    const cloud = telegram({ [keyring.cloudKeyFor(pA)!]: valueOf(pA) });
    const { api, said } = makeApp(device({ active: W2, others: [pB, keyring.cloudFormOf(pA)] }), cloud, { clock: { now: 9_000 } });
    await api.sync();
    const placed = await api.place(pB, W1);
    expect([placed.ciphertext, api.list().active.ciphertext, api.list().active.address],
      'MEASURED by round 31 F1-1: Telegram\'s copy of the other phone\'s password came into use, with no address').toEqual([pB.ciphertext, pB.ciphertext, 'EQ_A']);
    expect(said).not.toContain('wallet.newerPasswordKept');
    const inUse = { ...seal(3, 0, { tag: 'in use here' }), address: 'EQ_C' };
    const copy = { ...seal(3, 0, { tag: 'an earlier copy' }), address: 'EQ_C' };
    const stays = makeApp(device({ active: inUse, others: [copy] }), telegram(), { inBot: false });
    await stays.api.place(copy, { n: 3, owner: owner(3), address: 'EQ_C' });
    expect(stays.api.list().active.ciphertext).toBe(inUse.ciphertext);
  });

  it('R32-1: a password changed (or a key file taken) on a phone after its first unlock is never undone by another phone unlocked for the first time later', async () => {
    const { L1, L2 } = phones();
    const cloud = telegram({ [keyring.LEGACY_CLOUD_SLOT_KEY]: JSON.stringify(untagged(L2)) });
    const clockA = { now: 0 };
    const clockB = { now: 0 };
    const one = makeApp(device({ active: L1 }), cloud, { clock: clockA });
    const two = makeApp(device({ active: L2 }), cloud, { clock: clockB });
    await one.api.sync();
    await two.api.sync();
    await one.api.place(L1, W1);
    await settle(20);
    clockA.now = 30_000;
    await one.api.seal(W1, 'pA2');
    await settle(20);
    clockB.now = 90_000;
    await two.api.place(L2, W1);
    await settle(20);
    await one.api.sync();
    await settle(20);
    await two.api.sync();
    await settle(20);
    await two.api.place(two.api.list().active, W1);
    await settle(20);
    const changed = seal(1, 30_000, { tag: 'pA2' }).ciphertext;
    const ct = (app: any) => app.api.list().active.ciphertext;
    expect([ct(one), ct(two), inTelegram(cloud).ciphertext],
      'MEASURED by review 32: phone 2\'s first unlock took a clock version above the change, and pA2 opened the wallet nowhere').toEqual([changed, changed, changed]);
    expect([one.said.includes('wallet.newerPasswordKept'), two.said.includes('wallet.newerPasswordKept')]).toEqual([false, true]);
  });

  it('R30-F1-1: a key file\'s seal is the newest from now on — no password changed before the import undoes it at the next sync', async () => {
    const changed = seal(1, 1_500, { tag: 'changed an hour after the file was saved' });
    const file = { ...seal(1, 1_000, { tag: 'the file' }), address: 'EQ_A' };
    const cloud = telegram({ [keyring.cloudKeyFor(changed)!]: valueOf(changed) });
    const one = makeApp(device({ active: { ...changed, address: 'EQ_A' } }), cloud, { clock: { now: 2_000 } });
    await one.api.sync();
    const placed = await one.api.place(file, W1, { asNewest: true });
    await settle(20);
    expect(placed.seq).toBe(2_000);
    await one.api.sync();
    await settle(20);
    expect([one.api.list().active.ciphertext, one.said.includes('wallet.newerPasswordKept'), inTelegram(cloud).ciphertext]).toEqual([file.ciphertext, false, file.ciphertext]);
  });
});

describe('SIGNED RECORDS — a version counts as the wallet\'s seed counts it; Telegram\'s seal is checked at the unlock [decided 2026-10-15, 1.4.24]', () => {
  const W1 = { n: 1, owner: owner(1), address: 'EQ_A' };
  const inTelegram = (cloud: any) => keyring.parseCloudValue(cloud.values.get(keyring.cloudKeyFor(seal(1, 0))!)!)!.record;

  it('SIG-01: a seal in Telegram under a signature the seed did not make, or unsigned — at the ceiling — takes nothing at the unlock, pins no version, and is written over with this device\'s', async () => {
    const values = [keyring.cloudFormOf({ ...seal(1, keyring.SEQ_CEILING, { tag: 'planted' }), mac: 'cd'.repeat(32) }), keyring.cloudFormOf(seal(1, keyring.SEQ_CEILING, { tag: 'unsigned' }))];
    for (const forged of values) {
      const mine = { ...signedBy(1, seal(1, 5, { tag: 'this phone' })), address: 'EQ_A' };
      const cloud = telegram({ [keyring.cloudKeyFor(forged)!]: valueOf(forged) });
      const { api, said } = makeApp(device({ active: mine }), cloud);
      await api.sync();
      await settle(20);
      expect([api.list().active.ciphertext, inTelegram(cloud).ciphertext]).toEqual([mine.ciphertext, keyring.isSigned(forged) ? forged.ciphertext : mine.ciphertext]);
      const placed = await api.place(mine, W1);
      await settle(20);
      expect([placed.ciphertext, placed.seq, api.list().active.ciphertext], 'MEASURED by round 30 F4-1: a planted value took the seal here').toEqual([mine.ciphertext, 5, mine.ciphertext]);
      expect([inTelegram(cloud).ciphertext, inTelegram(cloud).mac], 'and Telegram healed with the seal the seed signed').toEqual([mine.ciphertext, mine.mac]);
      expect(said).not.toContain('wallet.newerPasswordKept');
      cloud.values.set(keyring.cloudKeyFor(forged)!, valueOf(forged));
      await api.sync();
      const written = await api.seal(W1, 'the next password');
      expect([await written.mirrored, api.list().active.seq], 'round 29 F4-1: a version at the ceiling made every new password read back as none').toEqual([true, 6]);
      expect(inTelegram(cloud).seq).toBe(6);
    }
  });

  it('SIG-01B: an unsigned version Telegram shows is never taken at the unlock of an earlier version\'s seal here — the unlock signs the seal here and writes it over', async () => {
    const mine = { ...seal(1, 5, { tag: 'this phone, 1.4.23' }), address: 'EQ_A' };
    const planted = keyring.cloudFormOf(seal(1, 9_000, { tag: 'planted, unsigned' }));
    const cloud = telegram({ [keyring.cloudKeyFor(planted)!]: valueOf(planted) });
    const { api, said } = makeApp(device({ active: mine }), cloud);
    await api.sync();
    await settle(20);
    expect(inTelegram(cloud).ciphertext, 'nothing signed here to send yet').toBe(planted.ciphertext);
    const placed = await api.place(mine, W1);
    await settle(20);
    expect([placed.ciphertext, placed.seq, keyring.isSigned(placed), said.includes('wallet.newerPasswordKept')], 'MEASURED by round 30 F4-1: taken as the newer password')
      .toEqual([mine.ciphertext, 1, true, false]);
    expect([inTelegram(cloud).ciphertext, inTelegram(cloud).mac]).toEqual([mine.ciphertext, placed.mac]);
  });

  it('SIG-02: a genuine older seal replayed with its version raised is a forgery; replayed as it was, it loses — the password set last stays', async () => {
    const old = signedBy(1, seal(1, 3, { tag: 'an old password' }));
    const now = { ...signedBy(1, seal(1, 9, { tag: 'the password now' })), address: 'EQ_A' };
    const raised = { ...keyring.cloudFormOf(old), seq: 50 };
    for (const replay of [keyring.cloudFormOf(old), raised]) {
      const cloud = telegram({ [keyring.cloudKeyFor(old)!]: valueOf(replay) });
      const { api, said } = makeApp(device({ active: now }), cloud);
      await api.sync();
      await settle(20);
      const placed = await api.place(now, W1);
      await settle(20);
      expect([placed.ciphertext, inTelegram(cloud).ciphertext, said.includes('wallet.newerPasswordKept')], `replayed at ${replay.seq}`).toEqual([now.ciphertext, now.ciphertext, false]);
    }
  });

  it('SIG-03: a password changed on another phone opens on this one\'s lock screen — Telegram\'s signed seal of the wallet chosen, taken only as that wallet\'s, under its signature; otherwise dropped, unsaid [review 35 — M]', async () => {
    const here = { ...signedBy(1, seal(1, 4, { tag: 'the password before' })), address: 'EQ_A', owner: owner(1) };
    const lockScreen = (remote: any, opensAs: any) => {
      const tried: string[] = [];
      const asked: string[] = [];
      let prompts = 0;
      const run: any = lift({
        t: (key: string) => key, PLATHO_WALLET_CIPHER_NAME: 'AES', PLATHO_WALLET_KDF_NAME: 'PBKDF2', walletShownName: (r: any) => r?.address ?? '', walletPasswordManagerUsername: (x: string) => x,
        requestWalletPasswordInput: async () => (prompts++ < 1 ? { password: 'the new one' } : null), console: { error() {} }, showAppNotice: () => {},
        withWorkInHand: (task: () => any) => Promise.resolve().then(task),
        decryptPlathoWalletRecord: async (record: any, password: string) => {
          tried.push(remote && record.ciphertext === remote.ciphertext ? 'remote' : 'here');
          if (remote && record.ciphertext === remote.ciphertext && password === 'the new one') return opensAs;
          throw new Error('no');
        },
        inTelegramBot: () => true, walletsHeldInTelegram: () => new Map(), sameWalletRecords: keyring.sameWallet, sameSeal: keyring.sameSeal,
        joinHintSentences: (...p: string[]) => p.filter(Boolean).join(' '), sameWalletAsRecord: async (record: any, wallet: any) => wallet.owner === record.owner,
        confirmOpenFoundWallet: async (candidate: any) => { asked.push(candidate.label); return true; },
        syncWalletsWithTelegram: async () => ({}), delay: () => Promise.resolve(), walletSaltsRestoredFromTelegramCloud: () => [],
        telegramSealOf: () => remote, isSigned: keyring.isSigned, sealedFieldsText: keyring.sealedFieldsText,
        plathoWalletRecordSigner: async (w: any) => (text: string) => macOf(w.owner, text),
      }, [fn('async function requestAndDecryptEncryptedWallet(record, {'), fn('async function findWalletByPassword(candidates, password) {'), fn('function provenBy(sign, record) {')],
      'requestAndDecryptEncryptedWallet', 'let actionDialogFieldChangeHook = null; const actionFields = null;');
      return { tried, asked, run, open: () => run(here, { candidates: () => [{ value: 'here', record: here, label: 'My savings' }] }) };
    };
    const remote = keyring.cloudFormOf(signedBy(1, seal(1, 8, { tag: 'set on the other phone' })));
    const ok = lockScreen(remote, { address: 'EQ_A', owner: owner(1) });
    expect(await ok.open(), 'MEASURED before: the boot\'s sync had put it in place, the old password "wrong"').toEqual({ address: 'EQ_A', owner: owner(1) });
    expect([ok.tried, ok.run.opened.record, ok.asked], 'the seal here first, then Telegram\'s').toEqual([['here', 'remote'], remote, []]);
    const planted = keyring.cloudFormOf({ ...signedBy(99, seal(99, 8, { tag: 'the attacker\'s' })), owner: owner(1) });
    const evil = lockScreen(planted, { address: 'EQ_EVIL', owner: owner(99) });
    expect([await evil.open(), evil.asked], 'MEASURED by review 35: "this password opens My savings" — another wallet came into use').toEqual([null, []]);
    const replayed = { ...keyring.cloudFormOf(signedBy(1, seal(1, 2, { tag: 'an old password' }))), seq: 900 };
    const raised = lockScreen(replayed, { address: 'EQ_A', owner: owner(1) });
    expect([await raised.open(), raised.asked]).toEqual([null, []]);
    const bare = lockScreen(untagged(remote), { address: 'EQ_A', owner: owner(1) });
    await bare.open();
    expect(bare.tried).toEqual(['here']);
    const cloud = telegram({ [keyring.cloudKeyFor(remote)!]: valueOf(remote) });
    const { api, said } = makeApp(device({ active: here }), cloud);
    await api.sync();
    const placed = await api.place(ok.run.opened.record, W1);
    expect([placed.ciphertext, placed.seq, placed.address, keyring.keyringRecords(api.list()).length]).toEqual([remote.ciphertext, 8, 'EQ_A', 1]);
    expect([said.includes('wallet.newerPasswordKept'), api.restored()], 'a seal taken from Telegram is marked as one').toEqual([false, true]);
  });

  it('SIG-04: a seal here under a signature the seed did not make is not counted — the seal opened takes its place, versioned and signed', async () => {
    const planted = { ...seal(1, 9_000, { tag: 'planted here' }), mac: 'cd'.repeat(32) };
    const copy = untagged(seal(1, 0, { tag: 'an earlier copy, its password typed' }));
    const { api, said } = makeApp(device({ active: { ...seal(2, 3), address: 'EQ_B' }, others: [planted, copy] }), telegram(), { inBot: false });
    const placed = await api.place(copy, W1);
    const ofWallet1 = keyring.keyringRecords(api.list()).filter((r: any) => r.owner === owner(1));
    expect([placed.ciphertext, placed.seq, keyring.isSigned(placed), ofWallet1.length], 'MEASURED before: the planted version won over the password typed')
      .toEqual([copy.ciphertext, 1, true, 1]);
    expect(said).not.toContain('wallet.newerPasswordKept');
    const sealed = await api.seal(W1, 'pw');
    void sealed;
    const record = api.list().active;
    expect(record.mac).toBe(macOf(owner(1), keyring.sealedFieldsText(record)));
  });


  it('SIG-06: a version an earlier version\'s sync copied from Telegram counts as none — the seal takes version 1 at its unlock, signed, and pins nothing [review 35 — M]', async () => {
    const pinned = { ...seal(1, 0, { tag: 'the person\'s seal' }), seq: keyring.SEQ_CEILING, address: 'EQ_A' };
    const clock = { now: 1_800_000_000_000 };
    const { api } = makeApp(device({ active: pinned }), telegram(), { clock, inBot: false });
    const placed = await api.place(pinned, W1);
    expect(placed.seq, 'MEASURED by review 35: signed at the ceiling').toBe(1);
    await api.seal(W1, 'a new password');
    expect(api.list().active.seq, 'round 29 F4-1: every new password read back as none, and the next unlock took the old one back').toBe(clock.now);
    expect((await api.place(api.list().active, W1)).seq).toBe(clock.now);
  });

  it('SIG-07: a seal here the seed never opened nor signed never takes the place of the one it opened — never signed, never sent, nobody locked out [review 35 — M]', async () => {
    const T = seal(1, 9_000, { tag: 'opens with nothing, copied here by an earlier version\'s sync' });
    const U = untagged(seal(1, 0, { tag: 'the person\'s copy' }));
    const cloud = telegram({ [keyring.cloudKeyFor(T)!]: valueOf(T) });
    const { api } = makeApp(device({ active: { ...seal(2, 3), address: 'EQ_B' }, others: [T, U] }), cloud);
    await api.sync();
    const placed = await api.place(U, W1);
    await settle(20);
    expect([placed.ciphertext, keyring.isSigned(placed), placed.seq]).toEqual([U.ciphertext, true, 1]);
    expect([inTelegram(cloud).ciphertext, inTelegram(cloud).mac], 'MEASURED by review 35: T signed and sent, every device locked out').toEqual([U.ciphertext, placed.mac]);
  });


  it('SIG-09: an unsigned value in Telegram lifts no version the seed signs — an old seal replayed at the ceiling, or any value there, stays at what the seed knows [review 35, re-check — M]', async () => {
    const clock = { now: keyring.UNSIGNED_SEQ_CEILING + 3_600_000 };
    const S1 = { ...signedBy(1, seal(1, 1, { tag: 'P1' })), address: 'EQ_A' };
    const replay = { ...keyring.cloudFormOf(S1), seq: keyring.SEQ_CEILING };
    delete (replay as any).mac;
    const cloud = telegram({ [keyring.cloudKeyFor(S1)!]: valueOf(replay) });
    const B = makeApp(device({ active: S1 }), cloud, { clock });
    await B.api.sync();
    expect((await B.api.place(S1, W1)).seq, 'MEASURED by review 35: signed at the cap, then taken by the phone with the newer password').toBe(1);
    const planted = keyring.cloudFormOf(seal(1, keyring.SEQ_CEILING, { tag: 'planted' }));
    const L = { ...seal(1, 0, { tag: 'a 1.4.22 seal' }), address: 'EQ_A' };
    const first = makeApp(device({ active: L }), telegram({ [keyring.cloudKeyFor(planted)!]: valueOf(planted) }), { clock });
    await first.api.sync();
    const opened = await first.api.place(L, W1);
    expect([opened.ciphertext, opened.seq], 'MEASURED by review 35: cap+1, signed and sent').toEqual([L.ciphertext, 1]);
  });
});

describe('THE LOCK SCREEN, THE DOORS AND SETTINGS — the device\'s list, by name; where a wallet is kept is the person\'s switch', () => {
  it('APP-LOCK-01: every wallet here is offered, the one in use first, each once, a cloud on those kept in Telegram — the list read again at every try', async () => {
    const dev = device({ active: { ...seal(1, 1), address: 'EQ_AAAA1' }, others: [{ ...seal(2, 1), address: 'EQ_BBBB2' }, keyring.cloudFormOf(seal(3, 1)), untagged(seal(4, 0))] });
    const cloud = telegram({ [keyring.cloudKeyFor(seal(2, 1))!]: valueOf(seal(2, 1)), [keyring.cloudKeyFor(seal(3, 1))!]: valueOf(seal(3, 1)) });
    const { api } = makeApp(dev, cloud);
    await api.sync();
    const cloudMark = String.fromCodePoint(0x2601, 0xFE0F);
    expect(api.candidates().map((c: any) => [c.value.slice(0, 4), c.label])).toEqual([
      ['here', 'EQ_AAA'], ['w:dz', `${cloudMark} EQ_BBB`], ['w:dz', `${cloudMark} wallet.otherWalletInTelegram`], ['w:dz', 'wallet.otherWalletInTelegramEarlier'],
    ]);
    const unlock = code(fn('async function requestAndDecryptEncryptedWallet(record, {'));
    expect(unlock).toContain("const offered = typeof candidates === 'function' ? candidates() : [];");
    expect(unlock, 'the password and the record it opened go to the lock screen\'s caller alone').toContain('if (candidates) requestAndDecryptEncryptedWallet.opened = { record: opened.record, password: result.password };');
    expect(code(fn('async function confirmOpenFoundWallet(candidate) {')), 'a press carried from the password dialog never answers it').toContain('unprompted: true,');
    expect(code(fn('async function readStoredPlathoWallet() {'))).toContain('candidates: walletUnlockCandidates');
  });

  it('R33-1: a door of an empty device never refuses while Telegram is silent — an earlier copy that comes in later is said', async () => {
    const silent = telegram();
    silent.state.answers = false;
    const empty = makeApp(device(), silent);
    expect(await empty.api.door(), 'MEASURED by review 33: no wallet could be made or brought while Telegram was silent').toBe(true);
    expect(code(app), 'the refusal is gone').not.toContain('telegramCopyUnreadable');
    const made = { ...seal(2, 9_000, { tag: 'made while Telegram was slow' }), address: 'EQ_B' };
    const cloud = telegram({ [keyring.LEGACY_CLOUD_SLOT_KEY]: JSON.stringify(untagged(seal(1, 0, { tag: '1.4.22' }))) });
    const { api, said } = makeApp(device({ active: made }), cloud);
    await api.sync();
    expect([keyring.keyringRecords(api.list()).length, said], 'MEASURED by round 31 F2-1: the person\'s own wallet sat under Other wallets unsaid').toEqual([2, ['wallet.telegramKeepsEarlierCopy']]);
  });

  it('APP-DOOR-01: on an empty device in the bot a door waits for Telegram briefly; a wallet it brought is unlocked, not made over; an answer known waits no more', async () => {
    const cloud = telegram({ [keyring.cloudKeyFor(seal(1, 1))!]: valueOf(seal(1, 1)) });
    const dev = device();
    const { api, said } = makeApp(dev, cloud);
    expect(await api.door(), 'the person\'s wallet from Telegram is here now').toBe(false);
    expect(said).toEqual(['quickstart.checkingTelegramCloud', '', 'unlock offered', 'quickstart.walletAlreadyHere']);
    const empty = makeApp(device(), telegram());
    expect(await empty.api.door()).toBe(true);
    const reads = empty.said.length;
    expect(await empty.api.door(), 'answered once: no second wait').toBe(true);
    expect(empty.said.length - reads, 'still said, and taken off').toBe(2);
  });

  it('APP-HOME-01: into Telegram with its name; out of it with its toncenter key and only once the wallet is open; forgotten from Telegram first, said only once gone', async () => {
    const A = { ...seal(1, 1), address: 'EQ_A' };
    const B = { ...seal(2, 1), address: 'EQ_B' };
    const dev = device({ active: A, others: [B] });
    dev.storage.setItem('platho.wallet.names.v1', JSON.stringify({ [owner(1)]: 'Main' }));
    const cloud = telegram({ [keyring.cloudKeyFor(B)!]: valueOf(B) });
    const app1 = makeApp(dev, cloud, { wallet: { address: 'EQ_A', owner: owner(1) } });
    await app1.api.sync();
    expect(app1.api.home()).toBe('device');
    expect(await app1.api.toTelegram()).toBe(true);
    expect(keyring.parseCloudValue(cloud.values.get(keyring.cloudKeyFor(A)!)!)).toEqual({ record: keyring.cloudFormOf(A), name: { iv: 'i', ct: 'sealed(Main)' } });
    expect([app1.api.home(), app1.said.includes('toncenter key follows')]).toEqual(['telegram', true]);
    cloud.values.set('platho_toncenter_key_v1', JSON.stringify({ owner: owner(1), enc: {} }));
    expect(await app1.api.toDevice()).toBe(true);
    expect([cloud.values.has(keyring.cloudKeyFor(A)!), cloud.values.has('platho_toncenter_key_v1'), app1.api.home()]).toEqual([false, false, 'device']);
    const locked = makeApp(device({ active: A }), telegram());
    expect(await locked.api.toDevice(), 'F2-5: locked, nothing leaves Telegram').toBe(false);
    expect(locked.said).toContain('profile.walletHomeUnlockFirst');
    cloud.state.answers = false;
    expect(await app1.api.forget(B)).toBe(false);
    expect(app1.api.list().others).toHaveLength(1);
    cloud.state.answers = true;
    expect(await app1.api.forget(B)).toBe(true);
    expect([cloud.values.has(keyring.cloudKeyFor(B)!), app1.api.list().others.length, app1.said.at(-1)]).toEqual([false, 0, 'wallet.walletForgotten']);
  });
});

describe('WALLET NAMES — kept here by the owner tag, sealed beside the wallet\'s copy in Telegram under its own key', () => {
  const NAME_SOURCES = () => [fn('function walletBytesToBase64(bytes) {'), fn('function walletBase64ToBytes(text) {'), line('const WALLET_NAME_MAX_CHARS = '),
    line('const WALLET_NAME_MAX_BYTES = '), fn('function walletNameAsTyped(text) {'), fn('async function walletNameSealKey(wallet) {'), fn('async function sealWalletName(wallet, name) {'),
    fn('async function openWalletName(wallet, sealed) {')];
  const names = () => lift({ derivePlathoWalletTag, btoa, atob }, NAME_SOURCES(), '{ seal: sealWalletName, open: openWalletName, typed: walletNameAsTyped }');

  it('NAMES-01: a name sealed by one wallet opens with that wallet only; Telegram keeps nothing it can read, nor its length', async () => {
    const [w1, w2] = [await createPlathoWallet(), await createPlathoWallet()];
    const x = names();
    const short = await x.seal(w1, 'Me');
    const long = await x.seal(w1, 'My savings for the summer');
    expect(await x.open(w1, long)).toBe('My savings for the summer');
    expect(await x.open(w2, long), 'another wallet\'s key opens nothing').toBeNull();
    expect(short.ct.length, 'F4-4: every sealed name is one length').toBe(long.ct.length);
    expect(JSON.stringify(long).includes('savings')).toBe(false);
  });

  it('NAMES-03: saved beside a copy Telegram keeps, here alone otherwise; owed while Telegram is silent; learnt at an unlock unless one is owed', async () => {
    const A = { ...seal(1, 1), address: 'EQ_A' };
    const dev = device({ active: A });
    const cloud = telegram({ [keyring.cloudKeyFor(A)!]: valueOf(A, { iv: 'i', ct: 'sealed(From phone)' }) });
    const { api } = makeApp(dev, cloud);
    expect(await api.saveName({}, A, 'Early'), 'Telegram not asked yet: owed').toBe(false);
    await api.sync();
    await api.learnName({}, A);
    expect(api.nameOf(A), 'the owed name goes there, nothing older learnt over it').toBe('Early');
    expect(keyring.parseCloudValue(cloud.values.get(keyring.cloudKeyFor(A)!)!)!.name).toEqual({ iv: 'i', ct: 'sealed(Early)' });
    cloud.values.set(keyring.cloudKeyFor(A)!, valueOf(A, { iv: 'i', ct: 'sealed(Renamed elsewhere)' }));
    await api.sync();
    await api.learnName({}, A);
    expect(api.nameOf(A), 'another device\'s name learnt at the unlock').toBe('Renamed elsewhere');
    const B = { ...seal(2, 1), address: 'EQ_B' };
    expect(await api.saveName({}, B, 'Here only'), 'not kept in Telegram: nothing to name there').toBe(true);
    expect(cloud.values.has(keyring.cloudKeyFor(B)!)).toBe(false);
  });

  it('NAMES-02: the name is never inside the sealed record nor its copy\'s fields; the strings exist in every language', () => {
    expect(code(fn('function noteWalletNameHere(record, name) {'))).toContain('localStorageOrNull()?.setItem(WALLET_NAMES_HERE_KEY, JSON.stringify(map))');
    expect(keyring.CLOUD_RECORD_FIELDS, 'no name field rides the copy').not.toContain('name');
    const markup = readFileSync('web/index.html', 'utf8');
    expect(markup).toContain('<button id="walletNameButton" type="button" hidden>');
    for (const lang of Object.keys(I18N_STRINGS)) {
      for (const key of ['wallet.nameButton', 'wallet.nameDialogHint', 'wallet.unlockWhichWallet', 'wallet.unlockOpensAnother', 'wallet.unlockTryingOthers', 'wallet.nameRemoved',
        'wallet.newerPasswordKept', 'wallet.deviceWalletsFull', 'wallet.otherWalletsHint']) expect((I18N_STRINGS as any)[lang][key], `${lang} ${key}`).toBeTruthy();
      expect((I18N_STRINGS as any)[lang]['wallet.deviceWalletsFull'], `${lang}: the count said`).toContain('{count}');
    }
  });

  it('NAMES-06: a typed name keeps its joiners and loses what cannot be seen; it is bounded by what is drawn, not by code units', () => {
    const typed = names().typed;
    const ch = (cp: number) => String.fromCodePoint(cp);
    expect(typed(`  My${ch(0x200b)}   wallet${ch(10)}  `)).toBe('My wallet');
    expect(typed('x'.repeat(40))).toHaveLength(32);
    const joined = `a${ch(0x200c)}b`;
    expect(typed(joined), 'F4-7 MEASURED before: ZWNJ stripped — Persian and Indic names broke apart').toBe(joined);
    const family = [0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467].map(ch).join('');
    expect(typed(family), 'a joined emoji stays one').toBe(family);
    expect([...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(typed(family.repeat(40)))].length, 'at most what fits the seal').toBe(8);
    expect(typed(ch(0x3164).repeat(5)), 'F4-7: an invisible name (Hangul fillers) is no name').toBe('');
    expect(typed(`${ch(0x2800)}${ch(0x200d)}`)).toBe('');
    expect(typed(`Main${ch(0x202e)}tcejbo`), 'no direction marks').toBe('Main tcejbo');
  });
});

describe('A ROOM IS NEVER "0 IN THE GROUP" [2026-10-15]', () => {
  it('GROUP-PEOPLE-01: until the roster is read the card lists the admins the room trusts and this device, not admitted yet — counted, never acted on', () => {
    const people = lift({}, [fn('function groupPeopleOf(record) {')], 'groupPeopleOf');
    const key = (n: number) => new Uint8Array(32).fill(n);
    const S = key(1);
    const A = key(2);
    expect(people({ self: S, admins: [A], members: [] }).map((p: any) => [p.groupKey[0], Boolean(p.unseated)]), 'a newcomer: the inviter and themselves').toEqual([[2, true], [1, true]]);
    expect(people({ self: S, admins: [S], members: [{ groupKey: S }] }).length, 'a founder is listed once').toBe(1);
    expect(people({ self: S, admins: [A], members: [{ groupKey: A }, { groupKey: S }] }).length).toBe(2);
    expect(people({ self: S, admins: [A], members: [{ groupKey: A }], leftAt: 5 }).length, 'a room this device left does not list it').toBe(1);
    expect(people(null)).toEqual([]);
    const card = code(fn('async function openGroupMembersDialog(groupId) {'));
    expect(card).toContain('for (const member of groupPeopleOf(record)) {');
    expect(card).toContain("hint: t('group.membersCount', { count: groupPeopleOf(record).length }),");
    expect(card.split('!member.unseated').length - 1, 'no act on a row the roster has not seated: admin, owner, mute, remove').toBe(3);
    expect(code(fn('function groupMenuActionsFor(thread) {'))).toContain('memberCount: groupPeopleOf(record).length,');
    for (const lang of Object.keys(I18N_STRINGS)) expect((I18N_STRINGS as any)[lang]['group.youNotAdmitted'], lang).toBeTruthy();
  });
});
