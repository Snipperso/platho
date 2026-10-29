import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';


const APP = readFileSync('web/app.js', 'utf8');

const WALLET_A = `0:${'a1'.repeat(32)}`;
const WALLET_B = `0:${'b2'.repeat(32)}`;

function functionSource(name: string): string {
  const at = APP.indexOf(`function ${name}(`);
  expect(at, `${name} must still be there`).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = APP.indexOf('{', at); i < APP.length; i += 1) {
    if (APP[i] === '{') depth += 1;
    else if (APP[i] === '}') { depth -= 1; if (depth === 0) return APP.slice(at, i + 1); }
  }
  throw new Error(`unbalanced braces after ${name}`);
}

function loadScoping() {
  const source = [
    'deploymentStorageSuffix', 'scopedStorageKey', 'personalPublicScopeAddress', 'walletScopedStorageKey',
    'isWalletScopedPublicKey', 'personalPublicStorageKey',
  ].map(functionSource).join('\n');
  const data = new Map<string, string>();
  // eslint-disable-next-line no-new-func
  const built = new Function('__data', `
    const appConfig = { profileRegistry: { address: '0:${'cc'.repeat(32)}' } };
    let __wallet = null;      // the runtime's active wallet (activeRuntimeWalletAddress, then plathoWallet)
    let __stored = null;      // the encrypted record on the device — its address is readable while locked
    const walletIndexedDbSuffix = (address) => (address
      ? String(address).replace(/[^a-z0-9_-]/gi, '').slice(-18)
      : 'wallet-locked');
    const activeWalletRuntimeAddress = () => __wallet;
    const storedPlathoWalletRecord = () => (__stored ? { address: __stored } : null);
    const localStorageOrNull = () => ({
      getItem: (key) => (__data.has(key) ? __data.get(key) : null),
      setItem: (key, value) => { __data.set(key, String(value)); },
      removeItem: (key) => { __data.delete(key); },
    });
    const PUBLIC_CHANNEL_SUBSCRIPTIONS_KEY = 'platho.publicChannelSubscriptions.v1';
    const PUBLIC_CUSTOM_CHANNELS_STORAGE_KEY = 'platho.publicCustomChannels.v1';
    const PREFS_DIRTY_STORAGE_KEY = 'platho.prefs.dirty.v1';
    const PREFS_LAST_SYNCED_STORAGE_KEY = 'platho.prefs.lastSyncedAt.v1';
    const PREFS_UNFOLLOWED_STORAGE_KEY = 'platho.prefs.unfollowed.v1';
    const PUBLIC_ROOM_IDS_STORAGE_KEY = 'platho.publicRoomIds.v1';
    const PUBLIC_READ_CURSORS_STORAGE_KEY = 'platho.publicReadCursors.v2';
    const PUBLIC_COMMENT_READ_CURSORS_STORAGE_KEY = 'platho.publicCommentReadCursors.v1';
    const PUBLIC_CHANNEL_FEED_CACHE_KEY = 'platho.publicChannelFeeds.v1';
    ${source}
    return {
      use: (wallet) => { __wallet = wallet; },
      store: (address) => { __stored = address; },
      personalPublicScopeAddress,
      personalPublicStorageKey,
      scopedStorageKey,
      isWalletScopedPublicKey,
      keys: { PUBLIC_CHANNEL_SUBSCRIPTIONS_KEY, PUBLIC_CUSTOM_CHANNELS_STORAGE_KEY, PREFS_DIRTY_STORAGE_KEY,
        PREFS_LAST_SYNCED_STORAGE_KEY, PREFS_UNFOLLOWED_STORAGE_KEY, PUBLIC_ROOM_IDS_STORAGE_KEY, PUBLIC_READ_CURSORS_STORAGE_KEY, PUBLIC_COMMENT_READ_CURSORS_STORAGE_KEY,
        PUBLIC_CHANNEL_FEED_CACHE_KEY },
    };
  `)(data);
  return { ...built, data } as any;
}

describe('PUBSCOPE — the personal half of the Public tab belongs to a wallet', () => {
  it('PUBSCOPE-01: two wallets on one device never share a personal key', () => {
    const s = loadScoping();
    const personal = [
      s.keys.PUBLIC_CHANNEL_SUBSCRIPTIONS_KEY, s.keys.PUBLIC_CUSTOM_CHANNELS_STORAGE_KEY,
      s.keys.PREFS_DIRTY_STORAGE_KEY, s.keys.PREFS_LAST_SYNCED_STORAGE_KEY, s.keys.PREFS_UNFOLLOWED_STORAGE_KEY, s.keys.PUBLIC_ROOM_IDS_STORAGE_KEY,
      s.keys.PUBLIC_READ_CURSORS_STORAGE_KEY, s.keys.PUBLIC_COMMENT_READ_CURSORS_STORAGE_KEY,
    ];
    for (const base of personal) {
      expect(s.isWalletScopedPublicKey(base), `${base} must be personal`).toBe(true);
      s.use(WALLET_A);
      const forA = s.personalPublicStorageKey(base);
      s.use(WALLET_B);
      expect(forA, `${base} resolves to one key for both wallets`).not.toBe(s.personalPublicStorageKey(base));
    }
    expect(s.isWalletScopedPublicKey(s.keys.PUBLIC_CHANNEL_FEED_CACHE_KEY)).toBe(false);
    s.use(WALLET_A);
    const cacheForA = s.personalPublicStorageKey(s.keys.PUBLIC_CHANNEL_FEED_CACHE_KEY);
    s.use(WALLET_B);
    expect(s.personalPublicStorageKey(s.keys.PUBLIC_CHANNEL_FEED_CACHE_KEY)).toBe(cacheForA);
  });

  it('PUBSCOPE-02: an existing user keeps their follow list — and the NEXT wallet does not inherit it', () => {
    const s = loadScoping();
    const base = s.keys.PUBLIC_CHANNEL_SUBSCRIPTIONS_KEY;
    const before = '{"channels":[{"id":"alice.ath"}]}';

    s.use(WALLET_A);
    const legacy = s.scopedStorageKey(base);
    s.data.set(legacy, before);

    const forA = s.personalPublicStorageKey(base);
    expect(s.data.get(forA), 'wallet A must inherit what the device already had').toBe(before);
    expect(s.data.has(legacy), 'and the old copy must be gone, or every wallet keeps inheriting it').toBe(false);

    s.use(WALLET_B);
    const forB = s.personalPublicStorageKey(base);
    expect(forB).not.toBe(forA);
    expect(s.data.get(forB), 'wallet B must not see wallet A follows').toBeUndefined();

    s.use(WALLET_A);
    s.data.set(forA, '{"channels":[]}');
    s.data.set(legacy, before);
    expect(s.personalPublicStorageKey(base)).toBe(forA);
    expect(s.data.get(forA), 'an established scope is never re-seeded from an old key').toBe('{"channels":[]}');
  });

  it('PUBSCOPE-03: the BARE keys migrate too — those had no scope of any kind', () => {
    const s = loadScoping();
    for (const base of [s.keys.PUBLIC_CUSTOM_CHANNELS_STORAGE_KEY, s.keys.PREFS_DIRTY_STORAGE_KEY]) {
      s.use(WALLET_A);
      s.data.set(base, 'legacy-value');
      const forA = s.personalPublicStorageKey(base);
      expect(s.data.get(forA), `${base} must be adopted from its bare key`).toBe('legacy-value');
      expect(s.data.has(base), `${base} must not be left behind for the next wallet`).toBe(false);
      s.use(WALLET_B);
      expect(s.data.get(s.personalPublicStorageKey(base))).toBeUndefined();
    }
  });
  it('PUBSCOPE-04: the wallet switch RE-READS the personal state, it does not merely re-key it', () => {
    const hydrate = functionSource('hydratePersonalPublicState');
    for (const loaded of [
      'customPublicChannels = readCustomPublicChannels();',
      'publicChannelSubscriptions = readPublicChannelSubscriptions(',
      'loadPrefsSyncMeta();',
      'publicReadCursors = readScopedJsonMap(PUBLIC_READ_CURSORS_STORAGE_KEY);',
      'publicCommentReadCursors = readScopedJsonMap(PUBLIC_COMMENT_READ_CURSORS_STORAGE_KEY);',
    ]) {
      expect(hydrate, `the hydration must load ${loaded}`).toContain(loaded);
    }
    const teardown = functionSource('clearWalletScopedRuntimeState');
    expect(teardown, 'the teardown must not hydrate — it would key on the wallet that is leaving')
      .not.toContain('hydratePersonalPublicState();');
    const prepare = functionSource('prepareWalletScopedRuntimeForWallet');
    expect(prepare, 'the prepare must re-read the personal state').toContain('hydratePersonalPublicState();');
    expect(prepare, 'and rebuild the threads the follow list drives').toContain('rebuildThreadsFromPublicSubscriptions(');
    expect(prepare, 'a first unlock is not a wallet change, and both must re-read')
      .toMatch(/const hadWallet = Boolean\(activeWalletRuntimeAddress\(\)\);/);
    expect(prepare).toMatch(/const changed = walletScopedRuntimeChanged\(wallet\);/);
    expect(prepare).toMatch(/if \(\(!hadWallet \|\| changed\) && wallet\?\.address\)/);
    expect(prepare.indexOf('activeRuntimeWalletAddress = wallet.address'), 'record the address first')
      .toBeLessThan(prepare.indexOf('hydratePersonalPublicState();'));
    const appCode = APP.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    expect(appCode.split('hydratePersonalPublicState()').length - 1,
      'one definition, one boot call, one prepare call, one read again once the sealed map is open, one as it closes, one when another window wrote it').toBe(6);
    expect(functionSource('rehydrateSealedPersonalPublicState')).toContain('hydratePersonalPublicState();');
    expect(functionSource('dropSealedPersonalPublicState')).toContain('hydratePersonalPublicState();');
    expect(functionSource('refreshPersonalPublicFromMap')).toContain('hydratePersonalPublicState();');
  });

  it('PUBSCOPE-06: ONE derivation of the scope — the runtime wallet, then the stored record, never plathoWallet', () => {
    const scope = functionSource('personalPublicScopeAddress');
    expect(scope).toContain('activeWalletRuntimeAddress() ?? storedPlathoWalletRecord()?.address ?? null');
    const key = functionSource('personalPublicStorageKey');
    expect(key, 'the locked gate asks the same derivation')
      .toContain("walletIndexedDbSuffix(personalPublicScopeAddress()) === 'wallet-locked'");
    const keyCode = key.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    expect(keyCode, 'and never the suffix with its plathoWallet default').not.toMatch(/walletIndexedDbSuffix\(\)/);
    expect(functionSource('walletScopedStorageKey')).toContain('walletIndexedDbSuffix(personalPublicScopeAddress())');

    const s = loadScoping();
    const base = s.keys.PUBLIC_CHANNEL_SUBSCRIPTIONS_KEY;
    const follows = '{"channels":[{"id":"alice.ath"}]}';
    s.store(WALLET_A);
    s.use(WALLET_A);
    const unlockedKey = s.personalPublicStorageKey(base);
    s.data.set(unlockedKey, follows);
    s.use(null);
    expect(s.personalPublicScopeAddress(), 'a locked boot scopes to the record on the device').toBe(WALLET_A);
    expect(s.personalPublicStorageKey(base), 'and reads the bucket the unlocked write used').toBe(unlockedKey);
    expect(s.data.get(s.personalPublicStorageKey(base))).toBe(follows);
  });

  it('PUBSCOPE-07: a locked boot with a record on the device migrates the deployment copy at boot', () => {
    const s = loadScoping();
    const base = s.keys.PUBLIC_CHANNEL_SUBSCRIPTIONS_KEY;
    const value = '{"channels":[{"id":"alice.ath"}]}';
    s.data.set(s.scopedStorageKey(base), value);
    s.store(WALLET_A);
    s.use(null);
    const keyA = s.personalPublicStorageKey(base);
    expect(keyA).not.toBe(s.scopedStorageKey(base));
    expect(s.data.get(keyA), 'the follow list moves into the record holder\'s bucket at boot').toBe(value);
    expect(s.data.has(s.scopedStorageKey(base)), 'and the deployment copy goes').toBe(false);
    s.use(WALLET_A);
    expect(s.personalPublicStorageKey(base), 'unlocking the same wallet changes nothing').toBe(keyA);
    s.use(WALLET_B);
    expect(s.data.get(s.personalPublicStorageKey(base))).toBeUndefined();
  });

  it('PUBSCOPE-05: with NO wallet on the device nothing is scoped and nothing is migrated — a wallet does that', () => {
    const s = loadScoping();
    const base = s.keys.PUBLIC_CHANNEL_SUBSCRIPTIONS_KEY;
    const value = '{"channels":[{"id":"alice.ath"}]}';
    s.data.set(s.scopedStorageKey(base), value);

    s.store(null);
    s.use(null);
    expect(s.personalPublicStorageKey(base), 'a locked device must not invent a wallet scope')
      .toBe(s.scopedStorageKey(base));
    expect([...s.data.keys()].filter((k) => k.includes('wallet-locked')),
      "a locked device must not create a 'wallet-locked' bucket").toEqual([]);
    expect(s.data.get(s.scopedStorageKey(base)), 'and must not remove what was there').toBe(value);

    s.use(WALLET_A);
    const keyA = s.personalPublicStorageKey(base);
    expect(keyA).not.toBe(s.scopedStorageKey(base));
    expect(s.data.get(keyA), 'the follow list follows the user into their own bucket').toBe(value);
    expect(s.data.has(s.scopedStorageKey(base)), 'and the old copy goes, so the NEXT wallet starts clean')
      .toBe(false);

    s.use(null);
    expect(s.personalPublicStorageKey(base)).toBe(s.scopedStorageKey(base));
    expect(s.data.get(keyA), "and wallet A's copy is not disturbed by the lock").toBe(value);
  });
});
