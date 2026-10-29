import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { isUnknownAccountState, readAccountStates, seedStatesBatchCeiling, __statesBatchCeilingForTests, __resetRefusedAddressesForTests,
  ACCOUNT_STATES_MAX_PER_CALL } from '../web/shard-reader.mjs';
import { TELEGRAM_GIFT_COLLECTION_CODE_HASH, telegramGiftCollectionIsAuthentic, readCollectionContentUri } from '../web/telegram-gift-nfts.mjs';


const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const lift = (env: Record<string, any>, sources: string[], exported: string) => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [...sources, `return ${exported};`].join(String.fromCharCode(10)))(...names.map((n) => env[n]));
};
const OWNER = `0:${'77'.repeat(32)}`;
const settle = async () => { for (let i = 0; i < 40; i += 1) await new Promise((resolve) => setTimeout(resolve, 0)); };
const DUROVS_CAPS_DATA_BOC =
  'te6ccgEBBQEArwAESYAAABLfHQ3koaSxignNG3FVwvqf99rxlgTH82d8KEprZvXkTEABAgMEAGYBaHR0cHM6Ly9uZnQu'
  + 'ZnJhZ21lbnQuY29tL2NvbGxlY3Rpb24vZHVyb3ZzY2FwLmpzb24IQgKR2eKsFp/Hhc4A3gqBrydiK5t9F2RBXHdeflDA'
  + 'POmKogAEAQAASwAFAGSADR50Dtpoo0MfqDwLjjaYBAqLqNZOrgycywS72hiTfgWQ';

describe('client audit round 46', () => {
  it('R46-01 (F6-1): a wallet session asks at most WALLET_PROOF_CONTINUATIONS_MAX proof passes by itself, however long each one "advances"', async () => {
    const state: any = { owner: OWNER, tab: 'nft', nfts: null, stored: { nft: [] }, loading: new Map(), failures: new Map(), retries: new Map(), at: new Map(), reprovedFor: '' };
    let proofs = 0;
    const load = lift({
      walletAssetsState: state, WALLET_ASSETS_TTL_MS: 60_000, WALLET_ASSETS_RETRY_MS: [5_000], WALLET_PROOF_CONTINUATIONS_MAX: 12, renderWalletAssets: () => {},
      readStoredWalletAssets: async () => null, rawAccount: (a: string) => a, parseTonAddress: (a: string) => ({ raw: a }), requireUsernameRegistryAddress: () => '',
      dressWalletNamesFromProfileList: async () => {}, toncenterRestOrigin: () => '', readStoredToncenterApiKey: () => '', createToncenterRestFetch: () => null,
      isVaultViewActive: () => true, writeStoredWalletAssets: async () => {}, noteTonRpcRateLimit: () => false, walletAthMaster: () => '', readJettonBalances: async () => [],
      walletTokenDecimals: () => null, cachedTelegramGiftsForWallet: () => null, readWalletHistory: async () => ({ rows: [], ownTraces: [] }), usernameRegistryAddressOrEmpty: () => '',
      withoutOwnChange: (rows: any) => rows, delay: () => new Promise(() => {}), provenTelegramGiftsForWallet: () => null, readNftItems: async () => [],
      loadTelegramGiftsForWallet: async () => { proofs += 1; return { gifts: [], examined: Array.from({ length: proofs }, (_, i) => `i${i}`), complete: false, advanced: true }; },
    }, [fn('async function loadWalletAssets(tab, { force = false, more = false, keep = false } = {}) {')], 'loadWalletAssets');
    await load('nft');
    await settle();
    expect([proofs, state.proofRuns], 'the visit\'s pass and twelve it asked').toEqual([13, 12]);
    expect(app).toMatch(/const WALLET_PROOF_CONTINUATIONS_MAX = 12;/);
    expect(code(fn('function resetWalletAssets(owner) {')), 'a new session of the wallet starts again').toContain('proofRuns: 0');
  });

  it('R46-05: a late whole pass is drawn once — its redraw does not loop, whichever of the two timers fires first', async () => {
    const state: any = { owner: OWNER, tab: 'nft', nfts: null, stored: { nft: [] }, loading: new Map(), failures: new Map(), retries: new Map(), at: new Map(), reprovedFor: '' };
    let cached: any = null;
    let land: (list: any) => void = () => {};
    const pending = new Promise((resolve) => { land = resolve; });
    let proofs = 0;
    const load = lift({
      walletAssetsState: state, WALLET_ASSETS_TTL_MS: 60_000, WALLET_ASSETS_RETRY_MS: [5_000], WALLET_PROOF_CONTINUATIONS_MAX: 12, renderWalletAssets: () => {},
      readStoredWalletAssets: async () => null, rawAccount: (a: string) => a, parseTonAddress: (a: string) => ({ raw: a }), requireUsernameRegistryAddress: () => '',
      dressWalletNamesFromProfileList: async () => {}, toncenterRestOrigin: () => '', readStoredToncenterApiKey: () => '', createToncenterRestFetch: () => null,
      isVaultViewActive: () => true, writeStoredWalletAssets: async () => {}, noteTonRpcRateLimit: () => false, walletAthMaster: () => '', readJettonBalances: async () => [],
      walletTokenDecimals: () => null, cachedTelegramGiftsForWallet: () => cached, readWalletHistory: async () => ({ rows: [], ownTraces: [] }), usernameRegistryAddressOrEmpty: () => '',
      withoutOwnChange: (rows: any) => rows, readNftItems: async () => [], provenTelegramGiftsForWallet: () => cached,
      delay: () => Promise.resolve(),
      loadTelegramGiftsForWallet: () => { proofs += 1; return proofs > 20 ? new Promise(() => {}) : (cached ? Promise.resolve(cached) : pending); },
    }, [fn('async function loadWalletAssets(tab, { force = false, more = false, keep = false } = {}) {')], 'loadWalletAssets');
    await load('nft');
    cached = { gifts: [], examined: [], complete: true, transferred: [] };
    land(cached);
    await settle();
    expect(proofs, 'the visit and one redraw — not a loop').toBe(2);
  });

  it('R46-02 (F6-2): a remembered verdict keeps its data only when it is authentic — a clone of Telegram\'s code keeps none', async () => {
    let answer: any = null;
    const verdicts = new Map();
    const read = lift({
      telegramGiftCollectionVerdicts: verdicts, isUnknownAccountState, createShardStatesRequest: () => null, TELEGRAM_GIFT_COLLECTION_CODE_HASH, telegramGiftCollectionIsAuthentic,
      readCollectionContentUri: (boc: string) => (boc === 'clone' ? 'https://nft.fragment.com/collection/clone.json' : readCollectionContentUri(boc)),
      readAccountStates: async () => answer,
    }, [fn('async function verifyTelegramGiftCollectionOnChain(')], 'verifyTelegramGiftCollectionOnChain');
    answer = new Map([['k', { status: 'active', codeHash: TELEGRAM_GIFT_COLLECTION_CODE_HASH, dataBoc: DUROVS_CAPS_DATA_BOC }]]);
    await read('0:genuine');
    expect(telegramGiftCollectionIsAuthentic(verdicts.get('0:genuine')), 'the genuine one is remembered whole — the next pass proves its gifts by it').toBe(true);
    answer = new Map([['k', { status: 'active', codeHash: TELEGRAM_GIFT_COLLECTION_CODE_HASH, dataBoc: 'clone' }]]);
    await read('0:clone');
    expect(verdicts.get('0:clone')?.dataBoc, 'remembered, without the stranger\'s data').toBe('');
  });

  it('R46-03 (F1-1): the NFT Send takes the gift\'s route for any PROVEN gift — a cut list standing over a whole one too', () => {
    const send = code(fn('async function runWalletAssetSend(picked) {'));
    expect(send).toContain('const gifts = provenTelegramGiftsForWallet(pressedBy);');
    expect(send).not.toContain('cachedTelegramGiftsForWallet(pressedBy)');
  });

  it('R46-04 (F6-3): a batch at or below the floor that times out does not teach the shared ceiling; a larger one still does', async () => {
    __resetRefusedAddressesForTests();
    seedStatesBatchCeiling(ACCOUNT_STATES_MAX_PER_CALL);
    const deadline = async () => { throw Object.assign(new Error('accountStates failed with HTTP 422: {"error":"context deadline exceeded"}'), { status: 422, detail: '{"error":"context deadline exceeded"}' }); };
    const one = `0:${'ab'.repeat(32)}`;
    await readAccountStates([one], { request: deadline });
    expect(__statesBatchCeilingForTests(), 'one address timed out: the endpoint\'s minute, not the batch').toBe(ACCOUNT_STATES_MAX_PER_CALL);
    const many = Array.from({ length: 256 }, (_, i) => `0:${(0x100 + i).toString(16).padStart(4, '0').repeat(16)}`);
    await readAccountStates(many, { request: deadline });
    expect(__statesBatchCeilingForTests(), 'a large batch still lowers it').toBeLessThan(ACCOUNT_STATES_MAX_PER_CALL);
    __resetRefusedAddressesForTests();
  });
});
