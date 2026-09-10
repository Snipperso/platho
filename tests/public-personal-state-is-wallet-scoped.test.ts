import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE PUBLIC TAB HAS TWO HALVES, AND ONLY ONE OF THEM IS PUBLIC.
//
// [audit 2026-09-01, round 9.] Everything under the Public tab shared one DEPLOYMENT scope — the ProfileRegistry
// address — and three of its keys had no scope at all. Switching wallets on a device therefore changed nothing:
// wallet B opened onto wallet A's follow list, A's read positions, A's unsaved-prefs flag, and a channel entry
// literally labelled "you" pointing at A's wallet address.
//
// It does not stop at looking. buildPrefsSnapshot reads the follow list in order to PUBLISH it, so wallet B could
// write wallet A's interest graph into B's own seed-derived on-chain prefs slot. And drainRestoredPrefsSnapshots
// applies a restored snapshot only when `prefsLastSyncedAt === null && !prefsDirty && !hasLocalFollows` — all
// three inherited from A, so B's OWN on-chain prefs were never applied at all.
//
// The content caches beside it stay deployment-scoped deliberately: posts, channel profiles and avatars are
// public, content-addressed, and wanted before the wallet is unlocked. What moved is what belongs to a person.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════

const APP = readFileSync('web/app.js', 'utf8');

const WALLET_A = `0:${'a1'.repeat(32)}`;
const WALLET_B = `0:${'b2'.repeat(32)}`;

/** One whole function, by brace balance — never a fixed-length window. */
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

/** The scoping helpers, lifted verbatim, over a real Map standing in for localStorage. */
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
        PREFS_LAST_SYNCED_STORAGE_KEY, PUBLIC_READ_CURSORS_STORAGE_KEY, PUBLIC_COMMENT_READ_CURSORS_STORAGE_KEY,
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
      s.keys.PREFS_DIRTY_STORAGE_KEY, s.keys.PREFS_LAST_SYNCED_STORAGE_KEY,
      s.keys.PUBLIC_READ_CURSORS_STORAGE_KEY, s.keys.PUBLIC_COMMENT_READ_CURSORS_STORAGE_KEY,
    ];
    for (const base of personal) {
      expect(s.isWalletScopedPublicKey(base), `${base} must be personal`).toBe(true);
      s.use(WALLET_A);
      const forA = s.personalPublicStorageKey(base);
      s.use(WALLET_B);
      expect(forA, `${base} resolves to one key for both wallets`).not.toBe(s.personalPublicStorageKey(base));
    }
    // …and the CONTENT cache deliberately does not move: it is public, content-addressed, and wanted before the
    // wallet is unlocked at all.
    expect(s.isWalletScopedPublicKey(s.keys.PUBLIC_CHANNEL_FEED_CACHE_KEY)).toBe(false);
    s.use(WALLET_A);
    const cacheForA = s.personalPublicStorageKey(s.keys.PUBLIC_CHANNEL_FEED_CACHE_KEY);
    s.use(WALLET_B);
    expect(s.personalPublicStorageKey(s.keys.PUBLIC_CHANNEL_FEED_CACHE_KEY)).toBe(cacheForA);
  });

  it('PUBSCOPE-02: an existing user keeps their follow list — and the NEXT wallet does not inherit it', () => {
    // Shipping the scope change without a migration would empty every existing user's follow list in silence.
    // The first wallet to open after the update adopts what was there and REMOVES the old copy — and removing it
    // is what makes a second wallet start clean, which is the point of the whole change.
    const s = loadScoping();
    const base = s.keys.PUBLIC_CHANNEL_SUBSCRIPTIONS_KEY;
    const before = '{"channels":[{"id":"alice.ath"}]}';

    // The world as it shipped: the value under its DEPLOYMENT-scoped key, no wallet in it.
    s.use(WALLET_A);
    const legacy = s.scopedStorageKey(base);
    s.data.set(legacy, before);

    const forA = s.personalPublicStorageKey(base);
    expect(s.data.get(forA), 'wallet A must inherit what the device already had').toBe(before);
    expect(s.data.has(legacy), 'and the old copy must be gone, or every wallet keeps inheriting it').toBe(false);

    // Wallet B now starts clean, which it did not before.
    s.use(WALLET_B);
    const forB = s.personalPublicStorageKey(base);
    expect(forB).not.toBe(forA);
    expect(s.data.get(forB), 'wallet B must not see wallet A follows').toBeUndefined();

    // …and the migration is once-only: a later value under wallet A is not overwritten by a re-run.
    s.use(WALLET_A);
    s.data.set(forA, '{"channels":[]}');
    s.data.set(legacy, before);
    expect(s.personalPublicStorageKey(base)).toBe(forA);
    expect(s.data.get(forA), 'an established scope is never re-seeded from an old key').toBe('{"channels":[]}');
  });

  it('PUBSCOPE-03: the BARE keys migrate too — those had no scope of any kind', () => {
    // Custom channels, the prefs dirty flag and its lastSynced stamp were written under their plain names: one
    // value shared by every wallet AND every deployment on the device. The custom-channel entry is the one a
    // reader actually saw, because it renders as a channel named "you" pointing at the previous wallet.
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
    // Scoping the keys while leaving the values in module-level bindings would have shown wallet B exactly what
    // it showed before, until a reload — the bindings are filled once at boot and no teardown touched them. So
    // boot and the switch share ONE hydration function rather than boot owning a sequence nobody can repeat.
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
    // Boot and the runtime prepare are its callers. The prepare covers BOTH a first unlock — not a wallet change:
    // walletScopedRuntimeChanged answers false while there is no current address, and it is the path every device
    // takes [audit 2026-09-01, round 10] — and a wallet switch, and it reads AFTER the new wallet's address is
    // recorded. The TEARDOWN must not read it: there the wallet that is leaving is still the one every derivation
    // answers with, so a read inside it hydrated the OLD bucket for the newcomer [F-22, 2026-09-09].
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
    // ORDER: the address the scope keys on is recorded BEFORE the read — after it, the read answers for the wallet
    // that was there before (null on a first unlock: the deployment bucket, which is the F-22 loss).
    expect(prepare.indexOf('activeRuntimeWalletAddress = wallet.address'), 'record the address first')
      .toBeLessThan(prepare.indexOf('hydratePersonalPublicState();'));
    // COMMENTS STRIPPED FIRST. This count read the raw file and went red the day a comment in app.js NAMED the
    // function it counts — the gate firing on its own subject's documentation, the same shape EXIT-CODE-UNIQUE,
    // the ceremony's tact.config check and CUTEPOCH-07 each learned separately. Prose is not a call site.
    const appCode = APP.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    expect(appCode.split('hydratePersonalPublicState()').length - 1,
      'one definition, one boot call, one prepare call').toBe(3);
  });

  it('PUBSCOPE-06: ONE derivation of the scope — the runtime wallet, then the stored record, never plathoWallet', () => {
    // THE F-22 LOSS [measured on stage, 2026-09-09]. Every runtime prepare runs one line BEFORE `plathoWallet =
    // wallet`, and the suffix's default argument was plathoWallet?.address — so the unlock hydration read the
    // DEPLOYMENT bucket while every later write (a follow, a read cursor, the dirty flag) migrated the deployment
    // copy into the wallet bucket and deleted it. The next boot read the deployment key again: defaults. A follow
    // made while unlocked was gone on reload, and the whole follow list sat in a bucket nothing read.
    const scope = functionSource('personalPublicScopeAddress');
    expect(scope).toContain('activeWalletRuntimeAddress() ?? storedPlathoWalletRecord()?.address ?? null');
    const key = functionSource('personalPublicStorageKey');
    expect(key, 'the locked gate asks the same derivation')
      .toContain("walletIndexedDbSuffix(personalPublicScopeAddress()) === 'wallet-locked'");
    // Comments stripped: the function's own note NAMES the bare call it no longer makes. Prose is not a call site.
    const keyCode = key.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    expect(keyCode, 'and never the suffix with its plathoWallet default').not.toMatch(/walletIndexedDbSuffix\(\)/);
    expect(functionSource('walletScopedStorageKey')).toContain('walletIndexedDbSuffix(personalPublicScopeAddress())');

    // Behaviour: a follow written while unlocked is read back by the next LOCKED boot (the record is still on the
    // device), which is exactly the reload that used to lose it.
    const s = loadScoping();
    const base = s.keys.PUBLIC_CHANNEL_SUBSCRIPTIONS_KEY;
    const follows = '{"channels":[{"id":"alice.ath"}]}';
    s.store(WALLET_A);   // the encrypted record is on the device
    s.use(WALLET_A);     // unlocked: the runtime knows the wallet
    const unlockedKey = s.personalPublicStorageKey(base);
    s.data.set(unlockedKey, follows);
    s.use(null);         // reload: locked, the record still there
    expect(s.personalPublicScopeAddress(), 'a locked boot scopes to the record on the device').toBe(WALLET_A);
    expect(s.personalPublicStorageKey(base), 'and reads the bucket the unlocked write used').toBe(unlockedKey);
    expect(s.data.get(s.personalPublicStorageKey(base))).toBe(follows);
  });

  it('PUBSCOPE-07: a locked boot with a record on the device migrates the deployment copy at boot', () => {
    // The person's follows show before unlock, as they did before the scoping change, and the one-time migration
    // no longer waits for the first WRITE after unlock — the write is what deleted the copy boot kept reading.
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
    // A DIFFERENT wallet imported over it starts clean: the copy already belongs to A.
    s.use(WALLET_B);
    expect(s.data.get(s.personalPublicStorageKey(base))).toBeUndefined();
  });

  it('PUBSCOPE-05: with NO wallet on the device nothing is scoped and nothing is migrated — a wallet does that', () => {
    // THE GATE THAT WAS MISSING WHEN THIS FIX SHIPPED [audit 2026-09-01, round 10]. The migration below runs on
    // whatever walletIndexedDbSuffix answers, and boot hydrates the personal state at module scope, BEFORE any
    // wallet exists — where that answer is the literal string 'wallet-locked'. So the first load after the update
    // moved every existing user's follow list, read cursors, custom channels and prefs flags into a bucket keyed
    // by that string and REMOVED the original. No unlocked wallet ever reads that bucket. Every assertion in
    // PUBSCOPE-01..03 stayed green throughout, because all three set a wallet first.
    const s = loadScoping();
    const base = s.keys.PUBLIC_CHANNEL_SUBSCRIPTIONS_KEY;
    const value = '{"channels":[{"id":"alice.ath"}]}';
    s.data.set(s.scopedStorageKey(base), value);

    // No wallet AT ALL — nothing unlocked, no record stored: the answer is the DEPLOYMENT key, which is where the
    // value already is. (A device that merely boots locked has a record, and scopes to it: PUBSCOPE-06/07.)
    s.store(null);
    s.use(null);
    expect(s.personalPublicStorageKey(base), 'a locked device must not invent a wallet scope')
      .toBe(s.scopedStorageKey(base));
    // …and nothing moved: no 'wallet-locked' bucket exists, and the original is untouched.
    expect([...s.data.keys()].filter((k) => k.includes('wallet-locked')),
      "a locked device must not create a 'wallet-locked' bucket").toEqual([]);
    expect(s.data.get(s.scopedStorageKey(base)), 'and must not remove what was there').toBe(value);

    // Unlocking is what migrates — once, into THAT wallet's bucket, taking the value with it.
    s.use(WALLET_A);
    const keyA = s.personalPublicStorageKey(base);
    expect(keyA).not.toBe(s.scopedStorageKey(base));
    expect(s.data.get(keyA), 'the follow list follows the user into their own bucket').toBe(value);
    expect(s.data.has(s.scopedStorageKey(base)), 'and the old copy goes, so the NEXT wallet starts clean')
      .toBe(false);

    // Locking again returns the deployment key — now empty, which is the truth: that value belongs to wallet A.
    s.use(null);
    expect(s.personalPublicStorageKey(base)).toBe(s.scopedStorageKey(base));
    expect(s.data.get(keyA), "and wallet A's copy is not disturbed by the lock").toBe(value);
  });
});
