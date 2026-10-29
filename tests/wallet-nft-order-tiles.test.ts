import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { parseNftItems } from '../web/wallet-assets.mjs';


const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const lift = (env: Record<string, any>, sources: string[], exported: string) => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [...sources, `return ${exported};`].join(String.fromCharCode(10)))(...names.map((n) => env[n]));
};
const addr = (n: number) => `0:${n.toString(16).padStart(64, '0')}`;

describe('the NFT tab: order and tiles', () => {
  it('NFTORDER-01: newest first by the item\'s last transaction; rows that do not say it after the rest, in the index\'s order', () => {
    const row = (n: number, lt?: string) => ({ address: addr(n), collection_address: addr(0x99), ...(lt === undefined ? {} : { last_transaction_lt: lt }) });
    const items = parseNftItems({ nft_items: [row(1, '100'), row(2), row(3, '300000000000000000000'), row(4, '200'), row(5), row(6, 'junk')], metadata: {} });
    expect(items.map((one: any) => one.address)).toEqual([addr(3), addr(4), addr(1), addr(2), addr(5), addr(6)]);
    expect(items[0].lastLt, 'carried, for last time\'s list too').toBe('300000000000000000000');
  });

  it('NFTTILE-01: a tile drawn again is the same node while its name and verdict are; a new picture is painted into it; its press opens the item as drawn last', () => {
    const tiles = new Map();
    const opened: any[] = [];
    const painted: string[] = [];
    let made = 0;
    const node = (tag: string): any => ({ tag, children: [] as any[], textContent: '', className: '', type: '', listeners: [] as any[],
      append(...more: any[]) { this.children.push(...more); }, addEventListener(_kind: string, handler: any) { this.listeners.push(handler); } });
    const tile = lift({
      walletNftTiles: tiles, document: { createElement: (tag: string) => { if (tag === 'button') made += 1; return node(tag); } },
      walletAssetIcon: () => node('span'), paintWalletAssetIcon: (_icon: any, picture: string) => painted.push(picture),
      shortAddress: (a: string) => a, openWalletNftCard: (item: any) => opened.push(item),
    }, [fn('function walletNftTile(item) {')], 'walletNftTile');
    const first = tile({ address: addr(1), name: 'sample.ath', picture: '', verified: true });
    const again = tile({ address: addr(1), name: 'sample.ath', picture: '', verified: true, scam: false });
    expect([again === first, made]).toEqual([true, 1]);
    first.listeners[0]();
    expect(opened.at(-1).scam, 'the item drawn last').toBe(false);
    expect(tile({ address: addr(1), name: 'sample.ath', picture: 'art', verified: true }) === first).toBe(true);
    expect(tile({ address: addr(1), name: 'sample.ath', picture: '', verified: true }) === first).toBe(true);
    expect(tile({ address: addr(1), name: 'sample.ath', picture: 'art', verified: true }) === first).toBe(true);
    expect(painted, 'painted once').toEqual(['art']);
    const renamed = tile({ address: addr(1), name: 'sample2.ath', picture: 'art', verified: true });
    expect([renamed === first, made]).toEqual([false, 2]);
    expect(tile({ address: addr(1), name: 'sample2.ath', picture: '', verified: false }) === renamed, 'another verdict is another tile').toBe(false);
  });

  it('NFTTILE-02: what left the list leaves the cache; a lock or another wallet empties it', () => {
    const render = code(fn('function renderWalletNfts(panel) {'));
    expect(render).toContain('for (const address of walletNftTiles.keys()) if (!listed.has(address)) walletNftTiles.delete(address);');
    expect(render.indexOf('walletNftTiles.delete'), 'before anything is drawn').toBeLessThan(render.indexOf('grid.append(walletNftTile(item))'));
    const tiles = new Map([[addr(1), {}], [addr(2), {}]]);
    const state: any = { owner: addr(7), loading: new Map(), failures: new Map(), retries: new Map(), openFolds: new Set(), at: new Map() };
    lift({ walletAssetsState: state, forgetWalletGroup: () => {}, walletAssetPanels: () => ({}), walletNftTiles: tiles, refreshWalletIncomingBadges: () => {},
      walletMarketForget: () => {} }, [fn('function resetWalletAssets(owner) {')], 'resetWalletAssets')('');
    expect(tiles.size).toBe(0);
  });
});
