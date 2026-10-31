import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { pricePoints } from '../web/price-history.mjs';
import { POOL_STATES_MAX, readBalanceAndReserves } from '../web/pool-state.mjs';


const app = readFileSync('web/app.js', 'utf8');
const fixtures = JSON.parse(readFileSync('tests/fixtures/pool-states.json', 'utf8')) as { dex: string; address: string; dataBoc: string; reserves: string[] }[];
const TOKEN = '0:' + 'ab'.repeat(32);
const TRADER = '0:' + 'A5'.repeat(32);
const lift = (env: Record<string, any>, sources: string[], exported: string) => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, `${sources.join('\n')}\nreturn ${exported};`)(...names.map((n) => env[n]));
};

describe('the trader behind a trade', () => {
  it('TRADER-01: each trade keeps the wallet that swapped, lower-case raw; none where the index names no wallet', () => {
    const swap = (at: number, sender: unknown) => ({ type: 'jetton_swap', success: true, end_utime: at, action_id: `a${at}`,
      details: { dex: 'stonfi', sender, asset_in: null, asset_out: TOKEN, dex_incoming_transfer: { amount: '2000000000' }, dex_outgoing_transfer: { amount: '4000000' } } });
    const points = pricePoints({ actions: [swap(100, TRADER), swap(200, undefined), swap(300, 'not an address')] }, { base: TOKEN, quote: 'gram', baseDecimals: 6, quoteDecimals: 9 });
    expect(points.map((point: any) => point.trader)).toEqual([TRADER.toLowerCase(), null, null]);
  });

  it('TRADER-02: the GRAM and the pools that price the tokens in ONE call — the wallet first; a balance the answer does not name is null', async () => {
    const pool = fixtures[0];
    const asked: string[] = [];
    const answer = (accounts: any[]) => async (url: string) => { asked.push(url); return { ok: true, json: async () => ({ accounts }) }; };
    const fetchImpl = answer([{ address: TRADER, balance: '123456789000', status: 'active' }, { address: pool.address.toUpperCase(), status: 'active', data_boc: pool.dataBoc }]);
    const read = await readBalanceAndReserves({ fetchImpl, origin: 'https://o', account: TRADER, pools: [{ address: pool.address, dex: pool.dex }] });
    expect(asked).toHaveLength(1);
    expect(asked[0].indexOf(`address=${encodeURIComponent(TRADER)}`)).toBeLessThan(asked[0].indexOf(`address=${encodeURIComponent(pool.address)}`));
    expect(asked[0]).toContain('include_boc=true');
    expect(read.balance).toBe(123456789000n);
    expect(read.reserves.get(pool.address.toLowerCase())?.map(String)).toEqual(pool.reserves);
    asked.length = 0;
    expect((await readBalanceAndReserves({ fetchImpl: answer([]), origin: 'https://o', account: TRADER })).balance).toBeNull();
    expect(asked[0], 'no pools: no code read').toContain('include_boc=false');
    asked.length = 0;
    const many = Array.from({ length: POOL_STATES_MAX + 5 }, (_, i) => ({ address: `0:${String(i).padStart(64, '0')}`, dex: 'stonfi' }));
    await readBalanceAndReserves({ fetchImpl: answer([]), origin: 'https://o', account: TRADER, pools: many });
    expect(asked).toHaveLength(1);
    expect(asked[0].split('address=').length - 1).toBe(POOL_STATES_MAX);
    await expect(readBalanceAndReserves({ fetchImpl: async () => ({ ok: false, status: 429 }), origin: 'https://o', account: TRADER })).rejects.toMatchObject({ status: 429 });
  });

  it('TRADER-03: the verified tokens at the Market\'s price, the most valuable first; the unverified only counted; a total only of what was read whole', () => {
    const holdings = lift({ walletTokenDecimals: (token: any) => token.decimals }, [sourceBlock(app, 'function walletTraderHoldings(tokens, balance, priceOf) {')], 'walletTraderHoldings');
    const tokens = [
      { master: 'a', balance: '1000000', decimals: 6, verified: true },
      { master: 'b', balance: '5000000000', decimals: 9, verified: true },
      { master: 'c', balance: '7', decimals: 0, verified: true },
      { master: 'd', balance: '9', decimals: 0, verified: false },
    ];
    const prices: Record<string, number> = { a: 2, b: 10 };
    const read = holdings(tokens, 3_000_000_000n, (master: string) => prices[master] ?? null);
    expect(read.verified.map((one: any) => [one.token.master, one.value])).toEqual([['b', 50], ['a', 2], ['c', null]]);
    expect([read.unverified, read.gram, read.total]).toEqual([1, 3, 55]);
    expect(holdings(null, 3_000_000_000n, () => null).total, 'the tokens unread: no total').toBeNull();
    expect(holdings(tokens, null, () => null).total, 'the GRAM unread: no total').toBeNull();
  });

  it('TRADER-04: a trade\'s row is a button that opens its trader; a row whose wallet is unknown is not; the focus stands where it stood', () => {
    const rows = code(sourceBlock(app, 'function walletMarketTrades('));
    expect(rows).toContain("const row = document.createElement(point.trader ? 'button' : 'div');");
    expect(rows).toContain('row.addEventListener(\'click\', doorPress(() => openWalletTrader(point.trader, { points })));');
    expect(rows).toContain("row.title = t('wallet.traderOpen');");
    expect(rows).toContain('if (focused) box.querySelector(`[data-trade-id="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });');
    expect(readFileSync('web/styles.css', 'utf8')).toMatch(/button\.wallet-market-trade \{[^}]*font-variant-numeric: tabular-nums;/);
  });

  it('TRADER-05: the window reads at class focus only while it shows, the tokens and then GRAM with the pricing pools; a stranger\'s unverified names are never drawn; the profile only where there is one', () => {
    const open = code(sourceBlock(app, 'function openWalletTrader(trader, { points = [] } = {}) {'));
    expect(open).toContain("const fetchImpl = createToncenterRestFetch({ requestOptions: { priority: 'focus', wanted } });");
    expect(open).toContain('const wanted = () => box.isConnected;');
    expect(open.indexOf('readJettonBalances({ owner: trader')).toBeLessThan(open.indexOf('readBalanceAndReserves({ fetchImpl, origin, account: trader, pools })'));
    expect(open).toContain('const rows = holdings.verified.map(');
    expect(open).toContain("t('wallet.tokensUnverified', { count: holdings.unverified })");
    expect(open).toContain('list.append(...rows.slice(drawn, drawn + WALLET_MARKET_PAGE));');
    expect(open).toContain('if (!wanted() || !channelProfileHasContent(profile)) return;');
    expect(open).toContain('button.addEventListener(\'click\', doorPress(() => { closeActionDialog(null); return openProfileCardDialog({ wallet: trader }); }));');
    expect(open, 'a pool the Market read lately is not asked again').toContain('Date.now() - held.at < WALLET_MARKET_REFRESH_MS');
    expect(open, 'MEASURED before: "review before signing" over a window that signs nothing').toContain("title: t('wallet.traderTitle'), hint: '',");
    expect(open).toContain("if (!mine.length) return '0';");
    expect(open, 'the slowest read last: it shifts nothing above it').toContain('box.append(stats, scope, tokensHead, list, moreTokens, rest, explorer, profileSlot);');
    expect(app).toContain("const TRADER_EXPLORER_ORIGIN = 'https://tonviewer.com';");
    expect((app.match(/TRADER_EXPLORER_ORIGIN/g) ?? []).length, "declared once; the trader's link and an NFT's [2026-10-30]").toBe(3);
    expect(code(sourceBlock(app, 'function walletNftExplorerButton(address) {'))).toContain('activateExternalLink(`${TRADER_EXPLORER_ORIGIN}/${encodeURIComponent(shown)}`)');
    expect(open).toContain("explorer.addEventListener('click', () => activateExternalLink(`${TRADER_EXPLORER_ORIGIN}/${encodeURIComponent(shown)}`));");
    expect(open).toContain('const shown = displayWalletAddress(trader);');
    expect(open, 'MEASURED cold at background: 21.5 s').toContain("resolveChannelProfile(trader, { requestClass: () => (wanted() ? 'focus' : 'idle') })");
    expect(code(sourceBlock(app, 'async function resolveChannelProfile(authorWallet, options = {}) {'))).toContain('...(options.requestClass ? { requestClass: options.requestClass } : {})');
    expect(open, 'MEASURED: 4.9749 total over a 4.9748 balance; round 82 — C1-2: 0.0156 under 0.0157').toContain('BigInt(balance) + BigInt(Math.max(0, Math.floor((holdings.total - holdings.gram) * 1e9)))');
    expect(code(sourceBlock(app, 'function restoreDialogFocus(target) {'))).toContain('.wallet-market-trades [data-trade-id="${CSS.escape(target.dataset.tradeId)}"]');
  });
});
