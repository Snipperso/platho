import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { IDBFactory } from 'fake-indexeddb';
import { sourceBlock } from './helpers/source';
import {
  RESECURE_CACHE_DATABASES, RESECURE_CONFIRMATION, RESECURE_HEADER, RESECURE_PROBE, RESECURE_READY, RESECURE_RETIRED_CACHE_DATABASES,
  resecureKeepsDatabase, resecureOriginStorage,
} from '../web/storage-resecure.mjs';


const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const lift = (env: Record<string, any>, sources: string[], exported: string) => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, `${sources.join('\n')}\nreturn ${exported};`)(...names.map((n) => env[n]));
};
function requestToPromise<T = any>(request: any): Promise<T> {
  return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
function memoryLocalStorage(initial: Record<string, string> = {}) {
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
async function make(factory: IDBFactory, name: string, store = 'records') {
  await new Promise<void>((resolve, reject) => {
    const request = factory.open(name, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(store, { keyPath: 'id' }).put({ id: 'a', viewed: 'channel-x' }); };
    request.onsuccess = () => { request.result.close(); resolve(); };
    request.onerror = () => reject(request.error);
  });
}
const clearingFetch = (factory: IDBFactory, storage: any) => async (_path: string, init: any) => {
  if (init?.headers?.[RESECURE_HEADER] === RESECURE_PROBE) {
    return { status: 204, headers: { get: (name: string) => (name === RESECURE_HEADER ? RESECURE_READY : null) } };
  }
  for (const { name } of await factory.databases()) await requestToPromise(factory.deleteDatabase(name!));
  storage.clear();
  return { status: 204, headers: { get: (name: string) => (name === RESECURE_HEADER ? RESECURE_CONFIRMATION : null) } };
};
const names = async (factory: IDBFactory) => (await factory.databases()).map((entry) => entry.name).sort();
const WALLET_RECORD = { 'platho.wallet.encrypted.v1': '{"sealed":true}' };
const HISTORY = 'platho-local-message-history-v1.dep.wal';
const SEALED_CACHES = 'platho-sealed-cache-v1.dep.wal';

describe('the storage re-secure keeps what a build reads, and nothing else', () => {
  it('RETIRED-01: the rule — the caches of builds gone never; a plain cache of any deployment never on a device that holds a wallet; everything else always', () => {
    expect(RESECURE_RETIRED_CACHE_DATABASES).toEqual(['platho-public-entry-bodies-v1', 'platho-public-comment-parts-v1']);
    for (const heldWallet of [false, true]) {
      for (const retired of RESECURE_RETIRED_CACHE_DATABASES) {
        expect(resecureKeepsDatabase(`${retired}.old-dep`, { heldWallet }), `${retired}, wallet ${heldWallet}`).toBe(false);
      }
      for (const kept of [HISTORY, SEALED_CACHES, 'platho-groups-v1.dep.wal', 'platho-device-secrets-v1.dep', 'platho-local-security-v1']) {
        expect(resecureKeepsDatabase(kept, { heldWallet }), kept).toBe(true);
      }
    }
    for (const cache of RESECURE_CACHE_DATABASES) {
      expect(resecureKeepsDatabase(`${cache}.dep`, { heldWallet: true }), `${cache} under a wallet`).toBe(false);
      expect(resecureKeepsDatabase(`${cache}.older-dep`, { heldWallet: true }), 'any deployment').toBe(false);
      expect(resecureKeepsDatabase(`${cache}.dep`, { heldWallet: false }), `${cache} with no wallet: the device's live cache`).toBe(true);
    }
  });

  it('RETIRED-02: a run on a device that holds a wallet writes back what the build reads — the plain caches of every generation and of builds gone are not brought back', async () => {
    const factory = new IDBFactory();
    for (const name of [HISTORY, SEALED_CACHES, 'platho-profile-avatar-media-v1.dep', 'platho-profile-avatar-media-v1.gen16', 'platho-public-comments-v1.gen15',
      'platho-public-entry-bodies-v1.gen15', 'platho-public-comment-parts-v1.gen14']) await make(factory, name);
    const storage = memoryLocalStorage({ ...WALLET_RECORD, theme: 'dark' });
    const result = await resecureOriginStorage({ indexedDB: factory, localStorage: storage, fetch: clearingFetch(factory, storage) });
    expect(result.outcome).toBe('restored');
    expect(await names(factory), 'MEASURED before: all seven back — the plain ones for the next unlock to find and call legacy').toEqual([HISTORY, SEALED_CACHES]);
    expect(storage.getItem('platho.wallet.encrypted.v1')).toBe('{"sealed":true}');
    const walletless = new IDBFactory();
    for (const name of ['platho-profile-avatar-media-v1.dep', 'platho-public-entry-bodies-v1.gen15']) await make(walletless, name);
    const plain = memoryLocalStorage({ theme: 'dark' });
    expect((await resecureOriginStorage({ indexedDB: walletless, localStorage: plain, fetch: clearingFetch(walletless, plain) })).outcome).toBe('restored');
    expect(await names(walletless)).toEqual(['platho-profile-avatar-media-v1.dep']);
  });

  it('RETIRED-03: the unlock takes every other generation\'s plain caches and those of builds gone, and asks for one run — a device with none asks for nothing', async () => {
    const run = async (present: string[]) => {
      const deleted: string[] = [];
      let asked = 0;
      const wallet = { address: '0:me' };
      const sealed = { type: 'sealed-indexeddb', putMany: async () => {} };
      const handOver = lift({
        indexedDB: { databases: async () => present.map((name) => ({ name })) }, plathoWallet: wallet, deviceCacheStore: async () => sealed,
        DEVICE_CACHES: { avatarMedia: { plain: 'platho-profile-avatar-media-v1', cap: () => 10 } }, scopedIndexedDbName: (base: string) => `${base}.dep`,
        deviceCachePlain: new Map(), deviceCacheMemory: new Map(), createProfileAvatarMediaStore: async () => ({ records: async () => [], close() {} }),
        deleteIndexedDbDatabase: async (name: string) => { deleted.push(name); return true; }, console: { warn() {} },
        resecureKeepsDatabase, PLATHO_LOCAL_INDEXED_DB_PREFIX: 'platho-',
        noteLegacyStorageMoved: () => { asked += 1; }, markStorageResecureDue: () => {},
      }, [fn('async function handOverPlainCaches(wallet) {')], 'handOverPlainCaches');
      await handOver(wallet);
      return { deleted: deleted.sort(), asked };
    };
    const owner = await run([HISTORY, SEALED_CACHES, 'platho-device-secrets-v1.dep', 'platho-profile-avatar-media-v1.gen16', 'platho-public-comments-v1.gen15',
      'platho-public-entry-bodies-v1.gen15', 'platho-public-comment-parts-v1.gen14', 'platho-local-security-v1']);
    expect(owner.deleted, 'MEASURED before: none of them — only this deployment\'s were ever looked for').toEqual([
      'platho-profile-avatar-media-v1.gen16', 'platho-public-comment-parts-v1.gen14', 'platho-public-comments-v1.gen15', 'platho-public-entry-bodies-v1.gen15']);
    expect(owner.asked, 'one run asked for, which writes the files without them').toBe(1);
    const clean = await run([HISTORY, SEALED_CACHES, 'platho-device-secrets-v1.dep']);
    expect(clean).toEqual({ deleted: [], asked: 0 });
  });
});
