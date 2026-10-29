import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import {
  createPlathoWallet,
  importPlathoWallet,
  exportPlathoWalletRecoveryPhrase,
  derivePlathoWalletTag,
  plathoWalletRecordSigner,
  PLATHO_WALLET_NETWORK_GLOBAL_IDS,
} from '../web/platho-wallet.mjs';
import { parseTonAddress } from '../web/crypto/platho-crypto.mjs';
import { normalizeRecipientIdentity } from '../web/recipient-identities.mjs';
import { createDeviceSecretSealKey, createSealedSecretStore } from '../web/device-secret-store.mjs';
import * as keyring from '../web/wallet-keyring.mjs';


if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

const app = readFileSync('web/app.js', 'utf8');
const fn = (declaration: string) => {
  const at = app.indexOf(declaration);
  if (at < 0) throw new Error(`${declaration} not found`);
  if (app.indexOf(declaration, at + 1) >= 0) throw new Error(`${declaration} is not unique`);
  return app.slice(at, app.indexOf('\n}', at) + 2);
};
const line = (prefix: string) => {
  const at = app.indexOf(prefix);
  if (at < 0) throw new Error(`${prefix} not found`);
  return app.slice(at, app.indexOf('\n', at));
};
const GLOBALS = new Set(Object.getOwnPropertyNames(globalThis));
function inert(): any {
  const self: any = new Proxy(function () { }, {
    get(_target, key) {
      if (key === Symbol.toPrimitive) return () => '';
      if (key === Symbol.iterator) return function* () { };
      if (key === 'then') return undefined;
      return self;
    },
    apply() { return self; },
    construct() { return self; },
    set() { return true; },
  });
  return self;
}
function inAppScope(sources: string[], exported: string, overrides: Record<string, any>) {
  const scope = new Proxy(overrides, {
    has(target, key) { return typeof key === 'string' && (key in target || !GLOBALS.has(key)); },
    get(target, key) {
      if (key === Symbol.unscopables) return undefined;
      if (typeof key === 'string' && key in target) return (target as any)[key];
      return inert();
    },
    set(target, key, value) { (target as any)[key] = value; return true; },
  });
  // eslint-disable-next-line no-new-func
  return new Function('scope', `with (scope) {\n${sources.join('\n')}\nreturn ${exported};\n}`)(scope);
}
function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() { return map.size; },
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => { map.set(key, String(value)); },
    removeItem: (key: string) => { map.delete(key); },
    keys: () => [...map.keys()],
    dump: () => Object.fromEntries(map),
  };
}
function fakeCloud(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const writes: Array<[string, string]> = [];
  return {
    telegramCloudStorage: () => ({}),
    telegramCloudGet: async (key: string) => values.get(key) ?? null,
    telegramCloudSet: async (key: string, value: string) => { writes.push([key, value]); values.set(key, value); return true; },
    values,
    writes,
  };
}
const walletHelpers = {
  parseTonAddress,
  normalizeRecipientIdentity,
  importPlathoWallet,
  exportPlathoWalletRecoveryPhrase,
  derivePlathoWalletTag,
  plathoWalletRecordSigner,
  PLATHO_WALLET_NETWORK_GLOBAL_IDS,
  appConfig: { network: { chain: 'mainnet' } },
  plathoCloudDataClearing: false, plathoLocalDataClearing: false,
};
const walletCodec = [
  line("const PLATHO_WALLET_STORAGE_KIND = "),
  line("const PLATHO_WALLET_STORAGE_KEY = "),
  line("const PLATHO_WALLET_ENCRYPTED_PAYLOAD_KIND = "),
  line("const PLATHO_WALLET_KDF_NAME = "),
  line("const PLATHO_WALLET_CIPHER_NAME = "),
  line('const PLATHO_WALLET_KDF_ITERATIONS = '),
  line('const PLATHO_WALLET_KDF_ITERATIONS_MIN = '),
  line('const PLATHO_WALLET_KDF_ITERATIONS_MAX = '),
  fn('function walletRecordIterations('),
  line('const TELEGRAM_CLOUD_VALUE_MAX_BYTES = '),
  fn('function sameWalletAddress('),
  fn('function rawWalletAddress('),
  fn('function plathoWalletNetworkOptions('),
  fn('function walletStorageCrypto('),
  fn('function randomStorageBytes('),
  fn('function walletBytesToBase64('),
  fn('function walletBase64ToBytes('),
  fn('function normalizeWalletPasswordInput('),
  fn('async function deriveWalletStorageKey('),
  fn('async function encryptPlathoWalletRecord('),
  fn('async function walletCloudOwnerTag('), fn('async function walletCloudOwnerField('),
  fn('function signedWith('), fn('function provenBy('), fn('function sealCounts('),
  fn('async function openPlathoWalletRecordPayload('), fn('async function decryptPlathoWalletRecord('),
  fn('function readEncryptedPlathoWalletRecord('),
  fn('function readDeviceKeyring('), fn('function writeDeviceKeyring('), fn('function storeDeviceKeyring('), fn('function withRoomForTheWallet('),
  fn('function walletsHeldInTelegram('), fn('function noteWalletHeldInTelegram('), fn('function telegramSealOf('), fn('function walletKeptInTelegram('),
  fn('function sameCloudForm('), fn('function inTelegramWalletQueue('), fn('function writeWalletToTelegram('), fn('function untaggedCopiesOf('),
  fn('function sendNewSealToTelegram('), fn('async function telegramSealNow('), fn('function walletSaltsRestoredFromTelegramCloud('),
  fn('function noteWalletRestoredFromTelegramCloud('), fn('async function placeOpenedWallet('), fn('function newSealSeq('), fn('function syncWalletsWithTelegram('),
  fn('async function syncWalletsWithTelegramOnce('), line('const TELEGRAM_CLOUD_RESTORED_SALT_KEY = '),
];
const keyringScope = { ...keyring, sameWalletRecords: keyring.sameWallet };
function fakeTelegram(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const writes: Array<[string, string]> = [];
  return {
    inTelegramBot: () => true,
    telegramCloudRead: async (key: string) => ({ ok: true, value: values.get(key) ?? null }),
    telegramCloudReadMany: async (keys: string[]) => keys.map((key) => ({ ok: true, value: values.get(key) ?? null })),
    telegramCloudSet: async (key: string, value: string) => { writes.push([key, value]); values.set(key, value); return true; },
    telegramCloudRemoveItems: async (keys: string[]) => { for (const key of keys) values.delete(key); return true; },
    telegramCloudKeys: async () => [...values.keys()],
    delay: () => new Promise(() => {}), refreshWalletHomeRows: () => {}, plathoLocalDataClearing: false,
    values,
    writes,
  };
}
const FIXTURE_PASSWORD = 'correct horse battery staple';

describe('PRIVACY — the Telegram cloud copy is ciphertext and nothing else', () => {
  it('PRIV-01: the cloud form names no address and no time, and it still opens with the password', async () => {
    const wallet = await createPlathoWallet();
    const cloud = fakeTelegram();
    const x = inAppScope(walletCodec, '{ encryptPlathoWalletRecord, decryptPlathoWalletRecord, writeWalletToTelegram, syncWalletsWithTelegram, walletCloudOwnerTag }', {
      ...walletHelpers, ...keyringScope, ...cloud,
    });
    const record = await x.encryptPlathoWalletRecord(wallet, FIXTURE_PASSWORD, { seq: 3 });
    expect(record.address, 'the LOCAL record keeps its address for this device').toBe(wallet.address);
    expect(await x.writeWalletToTelegram(record, { add: true })).toBe(true);
    expect(cloud.writes).toHaveLength(1);
    const [key, json] = cloud.writes[0];
    expect(key, 'its own key, named by its owner tag').toBe(keyring.cloudKeyFor(record));
    const sent = JSON.parse(json).r;
    expect(Object.keys(sent), 'only the named fields, in their order').toEqual(keyring.CLOUD_RECORD_FIELDS.filter((field) => field !== 'stamped'));
    expect(sent.owner, 'the owner tag: 128 seed-derived bits, nothing of the address [round 23 — B1]').toMatch(/^o1:[0-9a-f]{32}$/);
    expect(sent.seq, 'its version').toBe(3);
    expect(sent.mac, 'signed by its seed over what it shows [1.4.24]').toBe((await plathoWalletRecordSigner(wallet))(keyring.sealedFieldsText(sent)));
    expect(sent.mac, 'another seed signs another').not.toBe((await plathoWalletRecordSigner(await createPlathoWallet()))(keyring.sealedFieldsText(sent)));
    const raw = parseTonAddress(wallet.address).raw;
    for (const leak of [wallet.address, raw, raw.slice(2), String(record.createdAt)]) {
      expect(json.includes(leak), `the cloud copy carries ${leak}`).toBe(false);
    }
    const opened = await x.decryptPlathoWalletRecord(sent, FIXTURE_PASSWORD);
    expect(opened.address).toBe(wallet.address);
    await expect(x.decryptPlathoWalletRecord(sent, 'not the password at all')).rejects.toThrow();
    const theirs = x.walletCloudOwnerTag ? await x.walletCloudOwnerTag(await createPlathoWallet()) : null;
    expect(theirs).toMatch(/^o1:[0-9a-f]{32}$/);
    await expect(x.decryptPlathoWalletRecord({ ...sent, owner: theirs }, FIXTURE_PASSWORD)).rejects.toMatchObject({ code: 'PLATHO_WALLET_OWNER_TAG_MISMATCH' });
    const { owner: _tag, ...untaggedForm } = sent;
    void _tag;
    expect((await x.decryptPlathoWalletRecord(untaggedForm, FIXTURE_PASSWORD)).address, 'a record with no tag (an earlier version\'s) opens as before').toBe(wallet.address);
  }, 120_000);

  it('PRIV-01B: a copy an earlier build kept in the one slot is read where it lies; its unlock writes it under its own key without its readable fields — and the slot goes', async () => {
    const wallet = await createPlathoWallet();
    const legacy: any = await inAppScope(walletCodec, 'encryptPlathoWalletRecord', { ...walletHelpers })(wallet, FIXTURE_PASSWORD);
    delete legacy.seq;
    delete legacy.mac;
    const storage = memoryStorage({ 'platho.wallet.encrypted.v1': JSON.stringify(legacy) });
    const cloud = fakeTelegram({ platho_wallet_encrypted_v1: JSON.stringify(legacy) });
    const x = inAppScope(walletCodec, '{ syncWalletsWithTelegram, placeOpenedWallet }', {
      ...walletHelpers, ...keyringScope, ...cloud, localStorageOrNull: () => storage, showAppNotice: () => {}, t: (k: string) => k,
      noteWalletSealedOnThisDevice: () => {}, requestPersistentLocalStorage: async () => {}, PLATHO_WALLET_LEGACY_STORAGE_KEY: 'legacy',
      DEVICE_OTHER_WALLETS_KEY: keyring.DEVICE_OTHER_WALLETS_KEY, DEVICE_WALLETS_MAX: keyring.DEVICE_WALLETS_MAX, console,
    });
    await x.syncWalletsWithTelegram();
    expect(cloud.values.has('platho_wallet_encrypted_v1'), 'nothing moved at the boot').toBe(true);
    await x.placeOpenedWallet(legacy, wallet);
    await new Promise((resolve) => { setTimeout(resolve, 20); });
    expect(cloud.values.has('platho_wallet_encrypted_v1'), 'the slot is gone once its seal is under its own key').toBe(false);
    const here = JSON.parse(storage.getItem('platho.wallet.encrypted.v1')!);
    const moved = JSON.parse(cloud.values.get(keyring.cloudKeyFor(here)!)!).r;
    expect(moved.mac, 'signed, as the seal here is').toBe(here.mac);
    expect(moved.address).toBeUndefined();
    expect(moved.createdAt).toBeUndefined();
    expect([moved.ciphertext, moved.seq], 'the same wallet, as it was sealed, at its first version').toEqual([legacy.ciphertext, 1]);
  }, 60_000);

  it('PRIV-02: a record from Telegram gets its address back when it is opened — locally, and only that record', async () => {
    const wallet = await createPlathoWallet();
    const storage = memoryStorage();
    const x = inAppScope(walletCodec, '{ encryptPlathoWalletRecord, placeOpenedWallet, readDeviceKeyring }', {
      ...walletHelpers, ...keyringScope, inTelegramBot: () => false, localStorageOrNull: () => storage, showAppNotice: () => {},
      noteWalletSealedOnThisDevice: () => {}, requestPersistentLocalStorage: async () => {}, PLATHO_WALLET_LEGACY_STORAGE_KEY: 'legacy',
      DEVICE_OTHER_WALLETS_KEY: keyring.DEVICE_OTHER_WALLETS_KEY,
    });
    const record = await x.encryptPlathoWalletRecord(wallet, FIXTURE_PASSWORD);
    const fromTelegram = keyring.cloudFormOf(record);
    const other = keyring.cloudFormOf(await x.encryptPlathoWalletRecord(await createPlathoWallet(), FIXTURE_PASSWORD));
    storage.setItem('platho.wallet.encrypted.v1', JSON.stringify(fromTelegram));
    storage.setItem(keyring.DEVICE_OTHER_WALLETS_KEY, JSON.stringify([{ at: 1, record: other }]));
    await x.placeOpenedWallet(fromTelegram, wallet);
    const local = JSON.parse(storage.getItem('platho.wallet.encrypted.v1')!);
    expect([local.address, local.networkGlobalId]).toEqual([wallet.address, wallet.networkGlobalId]);
    expect(local.ciphertext).toBe(record.ciphertext);
    expect(x.readDeviceKeyring().others.map((entry: any) => entry.record.address)).toEqual([undefined]);
    expect(app).toContain('placed = await withWorkInHand(() => placeOpenedWallet(opened.record, wallet));');
  }, 60_000);
});

describe('PRIVACY — "key backup still owed" is a marker in the cloud, not an address', () => {
  const backupSources = [
    line("const WALLET_KEY_BACKUP_PENDING_KEY = "),
    line("const WALLET_KEY_BACKUP_PENDING_CLOUD_KEY = "),
    line("const WALLET_KEY_BACKUP_DONE_KEY = "),
    line("const WALLET_KEY_BACKUP_MARKER_PREFIX = "),
    line("const WALLET_KEY_BACKUP_MARKER_PURPOSE = "),
    line('const WALLET_KEY_BACKUP_LIST_LIMIT = '),
    'let walletKeyBackupCloudMarkers = new Set();',
    'let walletKeyBackupCloudLoaded = false;',
    'let walletKeyBackupCloudRead = Promise.resolve();',
    fn('function sameWalletAddress('),
    fn('function readWalletKeyBackupPendingSet('),
    fn('function writeWalletKeyBackupPendingSet('),
    fn('function readWalletKeyBackupDoneSet('),
    fn('function writeWalletKeyBackupDoneSet('),
    fn('async function walletKeyBackupMarker('),
    fn('function writeWalletKeyBackupCloudMarkers('),
    fn('function isWalletKeyBackupPending('),
    fn('function markWalletKeyBackupPending('),
    fn('function markWalletKeyBackupDone('),
    fn('async function reconcileWalletKeyBackupMarker('),
    fn('function restoreWalletKeyBackupPendingFromTelegramCloud('),
    fn('async function readWalletKeyBackupPendingFromTelegramCloud('),
  ];
  const build = (scope: Record<string, any>) => inAppScope(backupSources, `{ restoreWalletKeyBackupPendingFromTelegramCloud, reconcileWalletKeyBackupMarker,
    markWalletKeyBackupPending, markWalletKeyBackupDone, isWalletKeyBackupPending, walletKeyBackupMarker,
    get markers() { return walletKeyBackupCloudMarkers; } }`,
  Object.assign(scope, { parseTonAddress, derivePlathoWalletTag, refreshWalletBackupWarning: () => {} }, { ...scope }));
  const cloudList = (cloud: any) => JSON.parse(cloud.values.get('platho_wallet_keybackup_pending_v1') ?? '[]');

  it('PRIV-03: the tag is the seed\'s — per wallet, per purpose, and nothing an address alone can produce', async () => {
    const [a, b] = [await createPlathoWallet(), await createPlathoWallet()];
    const tagA = await derivePlathoWalletTag(a, 'keybackup.pending.v1');
    expect(tagA).toMatch(/^[0-9a-f]{32}$/);
    expect(await derivePlathoWalletTag(a, 'keybackup.pending.v1'), 'stable').toBe(tagA);
    expect(await derivePlathoWalletTag(b, 'keybackup.pending.v1'), 'per wallet').not.toBe(tagA);
    expect(await derivePlathoWalletTag(a, 'another.purpose'), 'per purpose').not.toBe(tagA);
    await expect(derivePlathoWalletTag({ address: a.address } as any, 'keybackup.pending.v1'), 'an address is not enough').rejects.toThrow();
  }, 60_000);

  it('PRIV-03B: an earlier build\'s address list moves to this device, and the cloud keeps markers only', async () => {
    const wallet = await createPlathoWallet();
    const cloud = fakeCloud({ platho_wallet_keybackup_pending_v1: JSON.stringify([wallet.address]) });
    const storage = memoryStorage();
    const x = build({ ...cloud, localStorageOrNull: () => storage, plathoWallet: wallet });
    await x.restoreWalletKeyBackupPendingFromTelegramCloud();
    expect(x.isWalletKeyBackupPending(wallet.address), 'still owed, on this device').toBe(true);
    expect(cloudList(cloud), 'no address left in the cloud').toEqual([]);
    await x.reconcileWalletKeyBackupMarker(wallet);
    const marker = await x.walletKeyBackupMarker(wallet);
    expect(cloudList(cloud), 'the unlocked wallet puts its marker in').toEqual([marker]);
    expect(JSON.stringify([...cloud.values.values()]).includes(parseTonAddress(wallet.address).raw.slice(2))).toBe(false);
  }, 60_000);

  it('PRIV-03C: saved while locked comes out at the next unlock; evicted locally comes back from the cloud; nothing is written unread', async () => {
    const wallet = await createPlathoWallet();
    const marker = `m1:${await derivePlathoWalletTag(wallet, 'keybackup.pending.v1')}`;
    const cloud = fakeCloud({ platho_wallet_keybackup_pending_v1: JSON.stringify([marker]) });
    const storage = memoryStorage({ 'platho.wallet.keybackup.pending.v1': JSON.stringify([wallet.address]) });
    const scope: Record<string, any> = { ...cloud, localStorageOrNull: () => storage, plathoWallet: null };
    const x = build(scope);
    await x.restoreWalletKeyBackupPendingFromTelegramCloud();
    x.markWalletKeyBackupDone(wallet.address);
    expect(cloudList(cloud), 'locked: the marker cannot be touched yet').toEqual([marker]);
    scope.plathoWallet = wallet;
    await x.reconcileWalletKeyBackupMarker(wallet);
    expect(cloudList(cloud)).toEqual([]);
    expect(x.isWalletKeyBackupPending(wallet.address)).toBe(false);
    const cloud2 = fakeCloud({ platho_wallet_keybackup_pending_v1: JSON.stringify([marker]) });
    const storage2 = memoryStorage();
    const y = build({ ...cloud2, localStorageOrNull: () => storage2, plathoWallet: wallet });
    await y.restoreWalletKeyBackupPendingFromTelegramCloud();
    await y.reconcileWalletKeyBackupMarker(wallet);
    expect(y.isWalletKeyBackupPending(wallet.address)).toBe(true);
    const cloud3 = fakeCloud();
    cloud3.telegramCloudGet = async () => { throw new Error('CloudStorage hung'); };
    const storage3 = memoryStorage();
    const z = build({ ...cloud3, localStorageOrNull: () => storage3, plathoWallet: wallet });
    await z.restoreWalletKeyBackupPendingFromTelegramCloud();
    z.markWalletKeyBackupPending(wallet.address);
    await z.reconcileWalletKeyBackupMarker(wallet);
    expect(cloud3.writes, 'another device\'s markers are not overwritten by one that never saw them').toEqual([]);
  }, 60_000);

  it('PRIV-03D: a key file saved while the wallet is UNLOCKED clears the nudge for good, and its marker leaves the cloud', async () => {
    const wallet = await createPlathoWallet();
    const marker = `m1:${await derivePlathoWalletTag(wallet, 'keybackup.pending.v1')}`;
    const cloud = fakeCloud({ platho_wallet_keybackup_pending_v1: JSON.stringify([marker]) });
    const storage = memoryStorage({ 'platho.wallet.keybackup.pending.v1': JSON.stringify([wallet.address]) });
    const x = build({ ...cloud, localStorageOrNull: () => storage, plathoWallet: wallet });
    await x.restoreWalletKeyBackupPendingFromTelegramCloud();
    x.markWalletKeyBackupDone(wallet.address);
    await x.reconcileWalletKeyBackupMarker(wallet);
    expect([x.isWalletKeyBackupPending(wallet.address), cloudList(cloud)],
      'MEASURED: in Telegram the export said "exported" and the red row came back — the marker read as a list evicted').toEqual([false, []]);
    const refused = fakeCloud();
    refused.telegramCloudSet = async () => false;
    const storage2 = memoryStorage();
    const y = build({ ...refused, localStorageOrNull: () => storage2, plathoWallet: wallet });
    await y.restoreWalletKeyBackupPendingFromTelegramCloud();
    y.markWalletKeyBackupPending(wallet.address);
    await y.reconcileWalletKeyBackupMarker(wallet);
    y.markWalletKeyBackupDone(wallet.address);
    await y.reconcileWalletKeyBackupMarker(wallet);
    expect(y.isWalletKeyBackupPending(wallet.address), 'MEASURED: created, exported, the red row back').toBe(false);
  }, 60_000);
});

describe('PRIVACY — the names you give people are sealed, and they are this wallet\'s', () => {
  const RAW_A = `0:${'a'.repeat(64)}`;
  const RAW_B = `0:${'b'.repeat(64)}`;
  const PEER = `0:${'c'.repeat(64)}`;
  const PEER2 = `0:${'d'.repeat(64)}`;
  const labelSources = [
    line("const CONTACT_DISPLAY_PREFERENCE_STORAGE_PREFIX = "),
    line("const CONTACT_LABELS_DB_NAME = "),
    line("const CONTACT_LABELS_SECRET_ID = "),
    'let contactLabelState = { owner: null, map: new Map(), store: null, persist: Promise.resolve(true) };',
    fn('function sameWalletAddress('),
    fn('function rawWalletAddress('),
    fn('function normalizeContactDisplayPreference('),
    fn('function contactLabelsReadyFor('),
    fn('function readContactDisplayPreference('),
    fn('function persistContactLabels('),
    fn('function parseSealedContactLabels('),
    fn('function legacyContactLabelEntries('),
    fn('async function bootContactLabelStore('),
    fn('function writeContactDisplayPreference('),
  ];
  function device(storage: ReturnType<typeof memoryStorage>) {
    const blobs = new Map<string, any>();
    const opened: string[] = [];
    let key: CryptoKey | null = null;
    const scope: Record<string, any> = {
      parseTonAddress, normalizeRecipientIdentity, threads: [], plathoWallet: null,
      localStorageOrNull: () => storage, rebuildPublicChannelRegistry: () => {}, renderThreads: () => {},
      walletScopedIndexedDbName: (base: string, address: string) => `${base}.${address}`,
      createIndexedDbDeviceSecretStore: async ({ dbName, id }: { dbName: string; id: string }) => {
        opened.push(dbName);
        key = key ?? await createDeviceSecretSealKey();
        return createSealedSecretStore({
          key, id,
          readBlob: async () => blobs.get(dbName) ?? null,
          writeBlob: async (record: any) => { blobs.set(dbName, record); },
          deleteBlob: async () => { blobs.delete(dbName); },
        });
      },
    };
    const x = inAppScope(labelSources, `{ bootContactLabelStore, readContactDisplayPreference, writeContactDisplayPreference,
      get state() { return contactLabelState; }, drop() { contactLabelState = { owner: null, map: new Map(), store: null, persist: contactLabelState.persist }; } }`, scope);
    return { x, scope, blobs, opened };
  }

  it('PRIV-04: the plain-text labels of an earlier build move into the sealed set, then leave localStorage', async () => {
    const storage = memoryStorage({
      [`platho.contact.displayPreference.v1:${PEER}`]: JSON.stringify({ displayIdentity: null, localLabel: 'Mom', pinned: true, muted: false }),
      [`platho.contact.displayPreference.v1:${PEER2}`]: JSON.stringify({ displayIdentity: null, localLabel: 'Landlord', pinned: false, muted: true }),
      'platho.unrelated.v1': 'kept',
    });
    const { x, scope, blobs, opened } = device(storage);
    expect(x.readContactDisplayPreference(PEER), 'locked: nobody has a name').toBe(null);
    scope.plathoWallet = { address: RAW_A };
    await x.bootContactLabelStore();
    await x.state.persist;
    expect(x.readContactDisplayPreference(PEER)).toMatchObject({ localLabel: 'Mom', pinned: true });
    expect(x.readContactDisplayPreference(PEER2)).toMatchObject({ localLabel: 'Landlord', muted: true });
    expect(storage.keys(), 'the plain text is gone, the rest is untouched').toEqual(['platho.unrelated.v1']);
    expect(opened, 'a database of the wallet\'s own').toEqual([`platho-contact-labels-v1.${RAW_A}`]);
    const sealed = JSON.stringify([...blobs.values()]);
    for (const secret of ['Mom', 'Landlord', PEER.slice(2), PEER2.slice(2)]) expect(sealed.includes(secret), `${secret} is readable at rest`).toBe(false);
  });

  it('PRIV-04B: another wallet on the same device sees none of them; a lock drops them; nothing is written before the set is read', async () => {
    const storage = memoryStorage();
    const { x, scope } = device(storage);
    scope.plathoWallet = { address: RAW_A };
    x.writeContactDisplayPreference(PEER, { localLabel: 'Early' });
    await x.bootContactLabelStore();
    expect(x.readContactDisplayPreference(PEER), 'a write before the load is not sealed over the set').toBe(null);
    x.writeContactDisplayPreference(PEER, { localLabel: 'Mom' });
    x.writeContactDisplayPreference(RAW_A, { localLabel: 'Me' });
    await x.state.persist;
    expect(x.readContactDisplayPreference(RAW_A)).toBe(null);
    expect(storage.keys(), 'nothing written in the clear').toEqual([]);
    x.drop();
    scope.plathoWallet = { address: RAW_B };
    expect(x.readContactDisplayPreference(PEER), 'switching wallets: no name until B\'s own set is loaded').toBe(null);
    await x.bootContactLabelStore();
    expect(x.readContactDisplayPreference(PEER), 'B has no names of A\'s').toBe(null);
    x.drop();
    scope.plathoWallet = { address: RAW_A };
    await x.bootContactLabelStore();
    expect(x.readContactDisplayPreference(PEER)).toMatchObject({ localLabel: 'Mom' });
  });

  it('PRIV-04C: the labels load first at unlock and every thread hydrates again against them; the lock and the clear both reach them', () => {
    const boot = fn('async function bootWalletScopedLocalStores(');
    expect(boot.indexOf('await bootContactLabelStore();')).toBeGreaterThan(0);
    expect(boot.indexOf('await bootContactLabelStore();'), 'before the history builds threads').toBeLessThan(boot.indexOf('await bootEncryptedMessageHistory();'));
    expect(fn('async function bootContactLabelStore(')).toMatch(/for \(const thread of threads\) thread\.contactDisplaySynced = false;/);
    expect(fn('function clearWalletScopedRuntimeState(')).toMatch(/contactLabelState = \{ owner: null, map: new Map\(\), store: null, persist: contactLabelState\.persist \};/);
    expect(app).toMatch(/const PLATHO_LOCAL_INDEXED_DB_BASE_NAMES = Object\.freeze\(\[[\s\S]*?CONTACT_LABELS_DB_NAME,[\s\S]*?\]\);/);
    expect(app).not.toMatch(/setItem\(\s*contactDisplayPreferenceStorageKey|setItem\(key, JSON\.stringify\(\{\s*\n\s*displayIdentity: normalized\.displayIdentity/);
  });
});

describe('PRIVACY — the policy says it, in all ten languages', () => {
  it('PRIV-05: the Telegram copy, what is inside it, and the clear that removes it; the sealed contact names; the date', () => {
    const en = readFileSync('web/docs/privacy-policy.md', 'utf8').replace(/\s+/g, ' ');
    expect(en).toContain('By default it lives on this device only');
    expect(en).toMatch(/If you choose to keep it in Telegram, an encrypted copy of your wallet is kept in Telegram's cloud storage\*\* \(CloudStorage\)/);
    expect(en).toMatch(/the recovery phrase and the wallet address are inside the encryption/);
    expect(en).toMatch(/The application's own "Clear local data" clears this device only — it deletes nothing from Telegram — and clearing Telegram's cache or the browser data leaves the copies in Telegram in place/);
    expect(en).not.toMatch(/"Clear local data" deletes it/);
    expect(en).toMatch(/the names you give your contacts and the record of who first wrote to you\*\* are encrypted with keys derived from your recovery phrase/);
    expect(en).toMatch(/Apart from what you choose to keep in Telegram \(see Telegram Mini App below\), this is the one place/);
    expect(en).toMatch(/the keys that open your conversations and groups, your notes and your subscriptions are kept there too, encrypted with a key derived from the phrase/);
    expect(readFileSync('web/privacy.html', 'utf8'), 'the served page is rebuilt from it').toMatch(/CloudStorage/);
    for (const suffix of ['', '.ru', '.zh', '.es', '.pt', '.fr', '.de', '.hi', '.id', '.ja']) {
      const doc = readFileSync(`web/docs/privacy-policy${suffix}.md`, 'utf8');
      const lines = doc.split('\n');
      expect(lines[2], `${suffix || 'en'} date`).toMatch(/October|\u043e\u043a\u0442\u044f\u0431\u0440\u044f|10月\d+日|octubre|outubro|octobre|Oktober|अक्टूबर/);
      expect(lines[2]).toMatch(/2026/);
      expect(doc, `${suffix || 'en'} names the cloud storage`).toContain('CloudStorage');
      const heads = lines.map((l, i) => (l.startsWith('## ') ? i : -1)).filter((i) => i >= 0);
      const stays = lines.slice(heads[1] + 1, heads[2]);
      const firstList = stays.slice(stays.findIndex((l) => l.startsWith('- ')));
      expect(firstList.slice(0, firstList.findIndex((l) => !l.startsWith('- '))).length, `${suffix || 'en'}: five items`).toBe(5);
    }
  });
});
