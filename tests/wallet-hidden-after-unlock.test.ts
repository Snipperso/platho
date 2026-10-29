import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { sourceBlock } from './helpers/source';


const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const NL = String.fromCharCode(10);
const SCAM = `0:${'5c'.repeat(32)}`;

describe('the hidden list after an unlock', () => {
  it('HIDDEN-UNLOCK-01: the Wallet tab is drawn again once the wallet\'s map is open — the hidden token leaves "Unverified"', async () => {
    const map = new Map<string, string>();
    const folds: Array<[string, string[]]> = [];
    const wallet = { address: 'W' };
    const env: Record<string, any> = {
      plathoWallet: wallet,
      walletAssetsState: { tab: 'tokens', tokens: [{ master: SCAM, verified: false, symbol: 'ATH', name: 'PLATHO', balance: '530000000000', decimals: 9 }], stored: {}, loading: new Map(), cutTokens: 0 },
      loadWalletLocal: async () => { map.set('hidden', JSON.stringify([SCAM])); },
      loadFacePointers: async () => {},
      walletAssetPanels: () => ({ tokens: { hidden: false, replaceChildren: () => {}, append: () => {}, closest: () => null, querySelectorAll: () => [], contains: () => false } }),
      walletHiddenAssets: () => new Set(JSON.parse(map.get('hidden') ?? '[]')),
      walletShowsHidden: () => false,
      appendWalletFold: (_panel: any, key: string, _title: string, _cls: string, rows: any[]) => { folds.push([key, rows]); },
      walletAssetRow: (row: any) => row.title, gramPicture: () => '', assetPicture: () => '', walletBalanceRowText: () => '', walletAthMaster: () => 'ATH-MASTER',
      formatUnits: () => '530', shortAddress: (a: string) => a, t: (key: string) => key, walletAssetsNote: () => {}, walletAssetsCutNote: () => {},
      renderWalletHistory: () => {}, renderWalletNfts: () => {}, walletGroupDialog: null,
      document: { createElement: () => ({ append: () => {}, set className(_v: string) {} }), activeElement: null, querySelector: () => null },
    };
    const names = Object.keys(env);
    // eslint-disable-next-line no-new-func
    const world = new Function(...names, [fn('function renderWalletTokens(panel) {'), fn('function renderWalletAssets(tab) {'), fn('async function loadWalletSets(wallet) {'),
      'return { renderWalletAssets, loadWalletSets };'].join(NL))(...names.map((n) => env[n]));
    world.renderWalletAssets('tokens');
    expect(folds.find(([key]) => key === 'tokens-unverified')?.[1], 'drawn before the map was read: nothing known hidden').toEqual(['PLATHO']);
    folds.length = 0;
    await world.loadWalletSets(wallet);
    expect(folds.find(([key]) => key === 'tokens-unverified')?.[1], 'drawn again once it was: the hidden token is gone').toEqual([]);
    folds.length = 0;
    env.loadWalletLocal = async () => {};
    const other = new Function(...names, [fn('function renderWalletTokens(panel) {'), fn('function renderWalletAssets(tab) {'), fn('async function loadWalletSets(wallet) {'),
      'return { loadWalletSets };'].join(NL))(...names.map((n) => (n === 'plathoWallet' ? { address: 'OTHER' } : env[n])));
    await other.loadWalletSets(wallet);
    expect(folds).toEqual([]);
  });
});
