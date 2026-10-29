import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';
import { isUnknownAccountState } from '../web/shard-reader.mjs';
import { collectOwnedTelegramGifts, TELEGRAM_GIFT_COLLECTION_CODE_HASH, telegramGiftCollectionIsAuthentic } from '../web/telegram-gift-nfts.mjs';


const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const lift = (env: Record<string, any>, sources: string[], exported: string) => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [...sources, `return ${exported};`].join(String.fromCharCode(10)))(...names.map((n) => env[n]));
};
const OWNER = `0:${'77'.repeat(32)}`;
const addr = (n: number) => `0:${n.toString(16).padStart(64, '0')}`;
const settle = async () => { for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setTimeout(resolve, 0)); };

describe('client audit round 45', () => {
  const tab = (passes: any[], { inTime = false } = {}) => {
    const state: any = { owner: OWNER, tab: 'nft', nfts: null, stored: { nft: [] }, loading: new Map(), failures: new Map(), retries: new Map(), at: new Map(), reprovedFor: '' };
    const drawnWith: any[] = [];
    let answer: (result: any) => void = () => {};
    let proofs = 0;
    let waits = 0;
    const load = lift({
      walletAssetsState: state, WALLET_ASSETS_TTL_MS: 60_000, WALLET_ASSETS_RETRY_MS: [5_000], WALLET_PROOF_CONTINUATIONS_MAX: 12, renderWalletAssets: () => {}, readStoredWalletAssets: async () => null,
      rawAccount: (a: string) => a, parseTonAddress: (a: string) => ({ raw: a }), requireUsernameRegistryAddress: () => '', dressWalletNamesFromProfileList: async () => {},
      toncenterRestOrigin: () => '', readStoredToncenterApiKey: () => '', createToncenterRestFetch: () => null, isVaultViewActive: () => true,
      writeStoredWalletAssets: async () => {}, noteTonRpcRateLimit: () => false, walletAthMaster: () => '', readJettonBalances: async () => [], walletTokenDecimals: () => null,
      cachedTelegramGiftsForWallet: () => null, readWalletHistory: async () => ({ rows: [], ownTraces: [] }), usernameRegistryAddressOrEmpty: () => '', withoutOwnChange: (rows: any) => rows,
      loadTelegramGiftsForWallet: () => {
        proofs += 1;
        if (proofs === 1 && !inTime) return new Promise((resolve) => { answer = resolve; });
        return Promise.resolve(passes[proofs - 1] ?? { ...passes.at(-1), advanced: false });
      },
      delay: () => { waits += 1; return waits === 1 && !inTime ? Promise.resolve() : new Promise(() => {}); },
      provenTelegramGiftsForWallet: () => ({ gifts: [], examined: ['junk'], complete: false }),
      readNftItems: async (options: any) => { drawnWith.push([options.giftVerdictsKnown, options.verifiedItems]); return []; },
    }, [fn('async function loadWalletAssets(tab, { force = false, more = false, keep = false } = {}) {')], 'loadWalletAssets');
    return { load, drawnWith, land: (result: any) => answer(result), proofs: () => proofs };
  };

  it('R45-01 (F5-1, F6-1): a late whole pass is drawn over a kept cut list; a pass that decided something new asks the next; one that did not, none', async () => {
    const whole = { gifts: [{ itemAddress: 'gift' }], examined: ['gift', 'junk'], complete: true, transferred: [] };
    const one = tab([whole, whole]);
    await one.load('nft');
    expect(one.drawnWith, 'drawn with the kept cut list').toEqual([[false, []]]);
    one.land(whole);
    await settle();
    expect(one.drawnWith, 'drawn again with the whole proof').toEqual([[false, []], [true, ['gift']]]);
    const still = { gifts: [{ itemAddress: 'gift' }], examined: ['gift'], complete: false, advanced: false, transferred: [] };
    const two = tab([still]);
    await two.load('nft');
    two.land(still);
    await settle();
    expect([two.drawnWith.length, two.proofs()], 'a late cut pass that decided nothing new asks no next pass').toEqual([1, 1]);
    const moved = { ...still, advanced: true };
    const three = tab([moved, still]);
    await three.load('nft');
    three.land(moved);
    await settle();
    expect([three.drawnWith.length, three.proofs()], 'a late pass that advanced is drawn and asks the next').toEqual([2, 2]);
    const four = tab([moved, moved, still], { inTime: true });
    await four.load('nft');
    await settle();
    expect([four.drawnWith.length, four.proofs()], 'in time: the next pass while each advances, then none').toEqual([3, 3]);
  });

  it('R45-02 (F5-2): the hidden lines name the window the card\'s gear opens with its own words, in every language [2026-10-24]', () => {
    for (const [language, words] of Object.entries(I18N_STRINGS as Record<string, Record<string, string>>)) {
      const settings = words['wallet.groupSettings'];
      expect(words['wallet.nftAllHidden'], language).toContain(`${settings} →`);
      expect(words['wallet.assetHidden'], language).toContain(`${settings} →`);
    }
  });

  it('R45-03 (F1-1, F3-1, F3-2, F6-4): the bin reads fresh; only a state the reader names is dead; junk code is remembered, without its data', async () => {
    let answer: any = null;
    let asked = 0;
    const verdicts = new Map();
    const read = lift({
      telegramGiftCollectionVerdicts: verdicts, isUnknownAccountState, createShardStatesRequest: () => null, readCollectionContentUri: () => '',
      TELEGRAM_GIFT_COLLECTION_CODE_HASH, telegramGiftCollectionIsAuthentic, readAccountStates: async () => { asked += 1; return answer; },
    }, [fn('async function verifyTelegramGiftCollectionOnChain(')], 'verifyTelegramGiftCollectionOnChain');
    const [A, B, C] = ['0:a', '0:b', '0:c'];
    for (const row of [{ status: 'Active' }, {}, { status: 'deleted' }]) {
      answer = new Map([['k', row]]);
      await expect(read(A), JSON.stringify(row)).rejects.toThrow();
    }
    answer = new Map([['k', { status: 'nonexist' }]]);
    expect(await read(A)).toMatchObject({ dead: true, missing: false });
    answer = new Map();
    expect(await read('0:d')).toMatchObject({ dead: true, missing: true });
    answer = new Map([['k', { status: 'active', codeHash: TELEGRAM_GIFT_COLLECTION_CODE_HASH, dataBoc: 'x' }]]);
    expect([(await read(A)).codeHash, (await read('0:d')).codeHash]).toEqual([TELEGRAM_GIFT_COLLECTION_CODE_HASH, TELEGRAM_GIFT_COLLECTION_CODE_HASH]);
    answer = new Map([['k', { status: 'active', codeHash: 'junk', dataBoc: 'x' }]]);
    expect((await read(B)).dataBoc, 'this read answers with its data').toBe('x');
    const once = asked;
    await read(B);
    expect(asked, 'junk code with no content URI is remembered').toBe(once);
    expect(verdicts.get(B).dataBoc, '...without its data [F6-4]').toBe('');
    await read(B, { fresh: true });
    expect(asked, 'the bin\'s read is fresh').toBe(once + 1);
    answer = new Map([['k', { status: 'active', codeHash: TELEGRAM_GIFT_COLLECTION_CODE_HASH, dataBoc: 'x' }]]);
    await read(C);
    const half = asked;
    await read(C);
    expect(asked, 'a half read of Telegram\'s code is not remembered').toBe(half + 1);
    expect(code(fn('async function runWalletAssetBurn(picked) {'))).toContain("{ requestOptions: { priority: 'critical', skipIfRateLimited: false }, fresh: true }");
  });

  it('R45-04 (F6-2, F6-3, F3-2): one pass at a time a wallet; merged with what is stored at its end; a cut pass is stored when it advanced', async () => {
    const junk = (n: number) => ({ itemAddress: addr(0x1000 + n), collectionAddress: addr(0x5000 + n) });
    const OLD = addr(0x9001);
    const failing = new Set<string>();
    let listing: any[] = [];
    let release: () => void = () => {};
    let gate: Promise<void> = Promise.resolve();
    let discoveries = 0;
    const cache = new Map();
    const verdicts = new Map();
    const load = lift({
      parseTonAddress: (wallet: string) => ({ raw: wallet }), telegramGiftListCache: cache, telegramGiftPassesInFlight: new Map(), TELEGRAM_GIFT_CACHE_TTL_MS: 300_000,
      discoverTelegramGiftItems: async () => { discoveries += 1; await gate; return listing; },
      toncenterRestOrigin: () => '', readStoredToncenterApiKey: () => '', createToncenterRestFetch: () => null,
      collectOwnedTelegramGifts, enqueueGiftChainRead: (work: () => any) => work(), telegramGiftCollectionVerdicts: verdicts,
      verifyTelegramGiftItemOnChain: async () => { throw new Error('no item read expected'); },
      verifyTelegramGiftMembershipOnChain: async () => { throw new Error('no membership read expected'); },
      verifyTelegramGiftCollectionOnChain: async (address: string) => {
        if (failing.has(address)) throw new Error('no answer');
        if (verdicts.has(address)) return verdicts.get(address);
        const verdict = { codeHash: 'junk', dataBoc: '', contentUri: '' };
        verdicts.set(address, verdict);
        return verdict;
      },
    }, [fn('async function loadTelegramGiftsForWallet(wallet, options = {}) {')], 'loadTelegramGiftsForWallet');
    listing = [junk(0), junk(1)];
    gate = new Promise((resolve) => { release = resolve; });
    const first = load(OWNER);
    const second = load(OWNER);
    release();
    expect([await first === await second, discoveries]).toEqual([true, 1]);
    cache.clear();
    verdicts.clear();
    listing = Array.from({ length: 300 }, (_, i) => junk(i));
    gate = new Promise((resolve) => { release = resolve; });
    const late = load(OWNER, { force: true });
    await settle();
    cache.set(OWNER, { at: 0, result: { gifts: [], transferred: [], examined: listing.slice(250).map((one) => one.itemAddress), complete: false } });
    release();
    const merged = await late;
    expect([merged.examined.length, merged.examined.includes(junk(250).itemAddress), merged.advanced]).toEqual([150, true, true]);
    expect(cache.get(OWNER).result, 'stored: it advanced').toBe(merged);
    for (let i = 100; i < 250; i += 1) failing.add(junk(i).collectionAddress);
    const stored = cache.get(OWNER);
    const still = await load(OWNER);
    expect([still.complete, still.advanced, cache.get(OWNER)]).toEqual([false, false, stored]);
    cache.clear();
    verdicts.clear();
    failing.clear();
    cache.set(OWNER, { at: 0, result: { gifts: [{ itemAddress: OLD }], transferred: [], examined: [OLD], complete: true } });
    listing = [{ itemAddress: OLD, collectionAddress: addr(0x9100) }, ...Array.from({ length: 150 }, (_, i) => junk(10 + i))];
    const cut = await load(OWNER);
    expect([cut.complete, cut.advanced, cut.examined.length, cut.gifts.map((gift: any) => gift.itemAddress)]).toEqual([false, true, 101, [OLD]]);
    expect(cache.get(OWNER).result, 'stored over the whole list').toBe(cut);
  });

  it('R45-05 (F6-1): "Checking…" stands under what is shown while anything is still checked — once', () => {
    const node = (tag: string): any => ({
      tag, className: '', textContent: '', children: [] as any[],
      get childElementCount() { return this.children.length; }, get lastElementChild() { return this.children.at(-1) ?? null; },
      get classList() { const self = this; return { contains: (name: string) => self.className.split(' ').includes(name) }; },
      append(...more: any[]) { this.children.push(...more); }, replaceChildren(...more: any[]) { this.children = [...more]; },
    });
    const draw = (nfts: any[]) => {
      const panel = node('section');
      const state = { nfts, stored: {}, loading: new Map(), failures: new Map(), retries: new Map(), at: new Map([['nft', 1]]) };
      const render = lift({
        walletAssetsState: state, walletHiddenAssets: () => new Set(), walletShowsHidden: () => false, walletNftTile: () => node('div'), t: (key: string) => key, walletNftTiles: new Map(),
        appendWalletFold: (target: any, _id: string, _title: string, _cls: string, tiles: any[]) => { if (tiles.length) target.append(node('details')); },
        document: { createElement: node },
      }, [fn('function walletAssetsReading(tab) {'), fn('function walletAssetsNote(panel, tab, emptyKey, hasRows) {'), fn('function walletAssetsCutNote(panel, count) {'), fn('function renderWalletNfts(panel) {')], 'renderWalletNfts');
      render(panel);
      return panel.children.filter((one: any) => one.className === 'wallet-assets-note').map((one: any) => one.textContent);
    };
    expect(draw([{ address: 'a', verified: true }, { address: 'b', verified: null }]), 'under 1 tile and 1 being checked').toEqual(['wallet.nftChecking']);
    expect(draw([{ address: 'b', verified: null }]), 'nothing shown: the empty line says it, once').toEqual(['wallet.nftChecking']);
    expect(draw([{ address: 'a', verified: true }]), 'all checked: no line').toEqual([]);
  });
});
