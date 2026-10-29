import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { sourceBlock } from './helpers/source';


const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const lift = (env: Record<string, any>, sources: string[], exported: string) => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [...sources, `return ${exported};`].join(String.fromCharCode(10)))(...names.map((n) => env[n]));
};
const OWNER = `0:${'77'.repeat(32)}`;
const settle = async () => { for (let i = 0; i < 40; i += 1) await new Promise((resolve) => setTimeout(resolve, 0)); };

describe('client audit round 47', () => {
  it('R47-01 (F1-1): a newer whole pass over an older whole list is drawn — once', async () => {
    const state: any = { owner: OWNER, tab: 'nft', nfts: null, stored: { nft: [] }, loading: new Map(), failures: new Map(), retries: new Map(), at: new Map(), reprovedFor: OWNER };
    const older = { gifts: [], examined: ['junk'], complete: true, transferred: [] };
    const newer = { gifts: [{ itemAddress: 'gift' }], examined: ['junk', 'gift'], complete: true, transferred: [] };
    let cached: any = older;
    let land: (list: any) => void = () => {};
    const pending = new Promise((resolve) => { land = resolve; });
    let proofs = 0;
    const drawnWith: string[][] = [];
    const load = lift({
      walletAssetsState: state, WALLET_ASSETS_TTL_MS: 60_000, WALLET_ASSETS_RETRY_MS: [5_000], WALLET_PROOF_CONTINUATIONS_MAX: 12, renderWalletAssets: () => {},
      readStoredWalletAssets: async () => null, rawAccount: (a: string) => a, parseTonAddress: (a: string) => ({ raw: a }), requireUsernameRegistryAddress: () => '',
      dressWalletNamesFromProfileList: async () => {}, toncenterRestOrigin: () => '', readStoredToncenterApiKey: () => '', createToncenterRestFetch: () => null,
      isVaultViewActive: () => true, writeStoredWalletAssets: async () => {}, noteTonRpcRateLimit: () => false, walletAthMaster: () => '', readJettonBalances: async () => [],
      walletTokenDecimals: () => null, cachedTelegramGiftsForWallet: () => cached, readWalletHistory: async () => ({ rows: [], ownTraces: [] }), usernameRegistryAddressOrEmpty: () => '',
      withoutOwnChange: (rows: any) => rows, provenTelegramGiftsForWallet: () => cached,
      readNftItems: async ({ verifiedItems }: any) => { drawnWith.push(verifiedItems); return []; },
      delay: () => Promise.resolve(),
      loadTelegramGiftsForWallet: () => { proofs += 1; return proofs > 20 ? new Promise(() => {}) : (proofs === 1 ? pending : Promise.resolve(cached)); },
    }, [fn('async function loadWalletAssets(tab, { force = false, more = false, keep = false } = {}) {')], 'loadWalletAssets');
    await load('nft');
    expect(drawnWith, 'drawn from the older whole list').toEqual([[]]);
    cached = newer;
    land(newer);
    await settle();
    expect([drawnWith, proofs], 'drawn again with the newer pass — and no more').toEqual([[[], ['gift']], 2]);
  });
});
