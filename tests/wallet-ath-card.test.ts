import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';


const app = readFileSync('web/app.js', 'utf8');
const html = readFileSync('web/index.html', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const lift = (env: Record<string, any>, sources: string[], exported: string) => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [...sources, `return ${exported};`].join(String.fromCharCode(10)))(...names.map((n) => env[n]));
};
const ATH = `0:${'a7'.repeat(32)}`;
const OTHER = `0:${'0b'.repeat(32)}`;

describe('ATH: the token card from Tokens, the program from Settings', () => {
  it('ATH-CARD-01: ATH\'s card is the token card — its Balance the corner\'s live row, its picture ATH\'s; another token\'s Balance its own', () => {
    let offered = [ATH, OTHER];
    let filled: any = null;
    let opened: any = null;
    const card = lift({
      fillWalletCard: (options: any) => { filled = options; }, walletCardStat: (label: string, value: string, options: any = {}) => ({ label, value, ...options }),
      walletAthMaster: () => ATH, assetPicture: (id: string) => `picture:${id}`, walletBalanceRowText: (asset: string) => `live ${asset}`,
      formatUnits: (balance: any) => String(balance), formatTonUserFriendlyAddress: (a: string) => a, shortAddress: (a: string) => a, t: (key: string) => key,
      walletHiddenAssets: () => new Set(), walletAssetsFresh: () => true, walletCardSendRow: (...parts: any[]) => ({ row: parts.filter(Boolean).length }),
      walletCardSend: (_press: any, label = 'send') => ({ button: label }), walletCardBurn: () => ({ bin: true }), walletCardHide: () => ({ hide: true }), walletCardUnhide: () => ({ unhide: true }),
      runWalletAssetSend: () => {}, runWalletAssetBurn: () => {}, runWalletSwap: () => {}, swapRoutesFrom: () => [1],
      walletSwapOffers: () => offered.map((id) => ({ id })),
      walletAssetsState: {}, openWalletGroup: (group: string, options: any) => { opened = [group, options.title]; },
      GRAM: 'gram', walletPriceChart: (base: string, quote: string, options: any) => ({ chart: [base, quote, options.intro] }),
    }, [fn('function openWalletTokenCard(token, { refill = false } = {}) {')], 'openWalletTokenCard');
    card({ master: ATH, balance: '5000000000', decimals: 9, symbol: 'ATH', name: 'ATH', picture: '', verified: true });
    expect([filled.picture, filled.stats[0], opened]).toEqual([`picture:${ATH}`, { label: 'wallet.tokenBalance', value: 'live ATH', balanceRow: 'ATH' }, ['token', 'ATH']]);
    expect(filled.stats[1], 'the price of a verified token, in GRAM, under its Balance (tests/price-history.test.ts)').toEqual({ chart: [ATH, 'gram', true] });
    expect(filled.stats.some((stat: any) => stat.button === 'wallet.actionSwap'), 'Swap at the foot, as every verified, held, paired token').toBe(true);
    card({ master: OTHER, balance: '7', decimals: 0, symbol: 'MAJOR', name: 'Major', picture: 'p', verified: true });
    expect([filled.picture, filled.stats[0]]).toEqual(['p', { label: 'wallet.tokenBalance', value: '7 MAJOR' }]);
    offered = [OTHER];
    card({ master: ATH, balance: '5000000000', decimals: 9, symbol: 'ATH', name: 'ATH', picture: '', verified: true });
    expect(filled.stats.some((stat: any) => stat.button === 'wallet.actionSwap'), 'MEASURED before: Swap shown, the window said "holds none"').toBe(false);
  });

  it('ATH-CARD-02: an open ATH card refills from ATH\'s own token when the index lists no ATH row — it does not close as a row gone', () => {
    const calls: string[] = [];
    const run = (openId: string, tokens: any[]) => {
      calls.length = 0;
      const render = lift({
        walletAssetPanels: () => ({ tokens: { hidden: false, closest: () => null, querySelectorAll: () => [] } }), renderWalletTokens: () => {}, renderWalletNfts: () => {}, renderWalletHistory: () => {},
        walletAssetsState: { openCard: { tab: 'tokens', id: openId }, tokens }, walletGroupDialog: { hidden: false }, document: { querySelector: () => ({ hidden: false }) },
        walletAthMaster: () => ATH, walletAthToken: () => ({ master: ATH, balance: null }),
        openWalletTokenCard: (row: any) => { calls.push(`refill ${row.master === ATH ? 'ATH' : 'other'}`); }, openWalletNftCard: () => {}, closeWalletGroup: () => { calls.push('closed'); },
      }, [fn('function renderWalletAssets(tab) {')], 'renderWalletAssets');
      render('tokens');
      return [...calls];
    };
    expect(run(ATH, [{ master: OTHER }]), 'no ATH row in the live list').toEqual(['refill ATH']);
    expect(run(OTHER, [{ master: ATH }]), 'another token gone').toEqual(['closed']);
    expect(run(ATH, null as any), 'no live list yet').toEqual([]);
  });

  it('ATH-CARD-03: the row opens the card; the program rides under it — no head of its own, no Send, no Swap; the row reads "ATH" alone [2026-10-23]', () => {
    const tokens = code(fn('function renderWalletTokens(panel) {'));
    expect(tokens).toContain("balanceRow: 'ATH', onOpen: () => openWalletAthCard() }));");
    expect(tokens, 'the program hint belongs to the program, not the token row').not.toContain('wallet.groupAthHint');
    expect(app).not.toContain('function openWalletAthGroup(');
    expect(app).not.toContain('#walletGroupAthButton');
    expect(code(fn('function openWalletTokenCard(token, { refill = false } = {}) {'))).toContain("also: isAth ? ['ath'] : []");
    const start = html.indexOf('data-wallet-group="ath"');
    const section = html.slice(start, html.indexOf('</section>', start));
    expect(section).toContain('id="buyAthButton"');
    expect(section).toContain('id="feeDiscountButton"');
    expect(section).toContain('id="athSupplyStatus"');
    expect(section).not.toMatch(/athCardHead|athCardStats|athCardActions|wallet-token-card/);
    expect(html.indexOf('data-wallet-group="token"'), 'the program after the card it rides under').toBeLessThan(start);
  });
});
