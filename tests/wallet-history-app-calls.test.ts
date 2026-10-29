import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { WALLET_HISTORY_PAGE, WALLET_HISTORY_READ_ON, parseWalletHistory, readWalletHistory, readWalletHistoryPages, serviceCallsOf, withoutServiceStorage } from '../web/wallet-assets.mjs';
import { code, sourceBlock } from './helpers/source';

const SELF = `0:${'d4'.repeat(32)}`;
const SLOT = `0:${'e3'.repeat(32)}`;
const FRIEND = `0:${'aa'.repeat(32)}`;
const call = (trace: string, at: number, opcode: string, to = SLOT) => ({ type: 'call_contract', trace_id: trace, action_id: `${trace}-call`, end_utime: at, success: true,
  details: { opcode, source: SELF, destination: to, value: '38400000' } });
const transfer = (trace: string, at: number, from: string, to: string, value: string, comment: string | null = null) => ({ type: 'ton_transfer', trace_id: trace,
  action_id: `${trace}-${from.slice(2, 4)}-${value}`, end_utime: at, success: true, details: { source: from, destination: to, value, comment, encrypted: false } });

describe('the app\'s own calls stay out of History', () => {
  it('HISTCALL-01: a key backup\'s storage payment and its change are no rows; a real transfer beside them is', () => {
    const rows = parseWalletHistory({ actions: [
      transfer('backup', 200, SLOT, SELF, '38740821'),
      call('backup', 200, '0x52435631'),
      transfer('backup', 200, SELF, SLOT, '1494130'),
      transfer('pay', 100, SELF, FRIEND, '500000000', 'lunch'),
    ] }, SELF);
    expect(rows.map((row: any) => [row.id, row.kind, row.direction]), 'MEASURED before: the 1494130 "Sent" row was shown').toEqual([['pay-d4-500000000', 'gram', 'out']]);
    expect(serviceCallsOf({ actions: [call('t', 1, '0x4d323144')] }, SELF).get('t'), 'a message through the fee vault').toBe('publish');
  });

  it('HISTCALL-02: a call the app does not make leaves its trace\'s transfers alone; a payment with a comment is the person\'s', () => {
    const rows = parseWalletHistory({ actions: [
      call('other', 300, '0x12345678', FRIEND), transfer('other', 300, SELF, FRIEND, '7000000'),
      call('mine', 200, '0x52535031'), transfer('mine', 200, SELF, SLOT, '9000000', 'a note to them'),
    ] }, SELF);
    expect(rows.map((row: any) => row.amount)).toEqual(['7000000', '9000000']);
  });

  it('HISTCALL-03: a trace the page\'s end cuts is read whole on the next page — its change never shows as a receipt', async () => {
    const filler = Array.from({ length: WALLET_HISTORY_PAGE - 1 }, (_, i) => transfer(`f${i}`, 1000 - i, FRIEND, SELF, String(1000 + i)));
    const all = [...filler, transfer('backup', 500, SLOT, SELF, '37510701'), call('backup', 500, '0x52435631'), transfer('older', 400, FRIEND, SELF, '42')];
    const fetchImpl = async (url: string) => {
      const query = new URL(url).searchParams;
      const offset = Number(query.get('offset') ?? 0);
      const limit = Number(query.get('limit'));
      return { ok: true, status: 200, json: async () => ({ actions: all.slice(offset, offset + limit) }) } as any;
    };
    const first = await readWalletHistory({ account: SELF, fetchImpl });
    expect(first.rows.some((row: any) => row.amount === '37510701'), 'MEASURED before: "Received +0.0375" on the first page').toBe(false);
    expect(first.nextOffset, 'the cut trace starts the next page').toBe(WALLET_HISTORY_PAGE - 1);
    expect(first.more).toBe(true);
    const second = await readWalletHistory({ account: SELF, fetchImpl, offset: first.nextOffset });
    expect(second.rows.map((row: any) => row.amount), 'whole on the next page: the change is its own, the older receipt stays').toEqual(['42']);
  });

  const sends = (count: number, from = 2000) => Array.from({ length: count }, (_, i) => [
    transfer(`m${i}`, from - i, SLOT, SELF, '30000000'), call(`m${i}`, from - i, '0x52535031')]).flat();
  const indexOf = (all: any[], reads: number[]) => async (url: string) => {
    const query = new URL(url).searchParams;
    const offset = Number(query.get('offset') ?? 0);
    reads.push(offset);
    return { ok: true, status: 200, json: async () => ({ actions: all.slice(offset, offset + Number(query.get('limit'))) }) } as any;
  };

  it('HISTCALL-04: pages of the app\'s own calls alone are read on — History reaches the transfers behind them, bounded', async () => {
    const reads: number[] = [];
    const all = [...sends(20), transfer('pay', 100, FRIEND, SELF, '1000000000', 'payment'), transfer('rent', 90, SELF, FRIEND, '2500000000', 'rent')];
    const page = await readWalletHistoryPages({ account: SELF, fetchImpl: indexOf(all, reads) });
    expect(page.rows.map((row: any) => row.comment), 'the transfers one page back, read at once').toEqual(['payment', 'rent']);
    expect(reads, 'the second page starts where the first cut its last trace').toEqual([0, WALLET_HISTORY_PAGE - 2]);
    expect(page.nextOffset).toBe(all.length);
    const many: number[] = [];
    const only = await readWalletHistoryPages({ account: SELF, fetchImpl: indexOf(sends(200), many) });
    expect(only.rows).toEqual([]);
    expect(only.more).toBe(true);
    expect(many.length, 'one press reads a bounded number of pages').toBe(WALLET_HISTORY_READ_ON);
    const stopped: number[] = [];
    await readWalletHistoryPages({ account: SELF, fetchImpl: indexOf(sends(200), stopped), wanted: () => false });
    expect(stopped).toEqual([0]);
    const one: number[] = [];
    await readWalletHistoryPages({ account: SELF, fetchImpl: indexOf([transfer('pay', 100, FRIEND, SELF, '5'), ...sends(40)], one) });
    expect(one).toEqual([0]);
  });

  it('HISTCALL-05: History draws "Show more" while older pages remain and says "No transfers yet" only at the end', () => {
    const app = readFileSync('web/app.js', 'utf8');
    const render = code(sourceBlock(app, 'function renderWalletHistory('));
    expect(render, 'MEASURED before: the button needed a drawn row').toContain('if (walletAssetsState.historyMore) {');
    expect(render).toContain("walletAssetsNote(panel, 'history', 'wallet.historyEmpty', rows.length > 0 || (walletAssetsState.historyMore && !walletAssetsReading('history')));");
    expect(render).toContain("more.disabled = walletAssetsReading('history');");
    expect(code(sourceBlock(app, 'function walletAssetsReading('))).toContain('return Boolean(running) && !running.keep;');
    expect(render.split('new Intl.DateTimeFormat(').length - 1).toBe(1);
    expect(render).not.toContain('toLocaleString(');
    expect(render, 'a time out of range is no date, not a thrown draw [audit 68 — C5-3]').toContain("return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date);");
    const load = code(sourceBlock(app, 'async function loadWalletAssets('));
    expect(load).toContain('const page = await readWalletHistoryPages({');
    expect(load, 'the background check takes one page [audit 65 — C5-1]').toContain('pages: keep && !more ? 1 : undefined, wanted: () => owner === state.owner,');
    expect(load).toContain('state.historyServiceTraces = new Set([...(more || kept ? state.historyServiceTraces ?? [] : []), ...page.serviceTraces]);');
  });

  it('HISTCALL-06: a storage payment whose app call sits on another page is no row either', () => {
    const rows = parseWalletHistory({ actions: [transfer('backup', 200, SELF, SLOT, '1494130'), transfer('pay', 100, SELF, FRIEND, '7', 'lunch')] }, SELF);
    expect(rows.map((row: any) => row.amount), 'alone on its page the call is unseen').toEqual(['1494130', '7']);
    expect(withoutServiceStorage(rows, ['backup']).map((row: any) => row.amount), 'the call\'s trace from the page before').toEqual(['7']);
    expect(withoutServiceStorage(rows, ['pay']).map((row: any) => row.amount), 'a payment with words is the person\'s').toEqual(['1494130', '7']);
  });

  it('HISTCALL-07: the background check reads one page; a page 1 with nothing new leaves the read-on\'s place and "Show more" as they were', async () => {
    const app = readFileSync('web/app.js', 'utf8');
    const asked: any[] = [];
    let answer: any = { rows: [], ownTraces: [], serviceTraces: [], nextOffset: 28, more: true };
    const state: any = { owner: SELF, tab: 'tokens', history: [], historyOffset: 168, historyMore: true, historyOwnTraces: new Set(), historyServiceTraces: new Set(),
      stored: {}, loading: new Map(), failures: new Map(), retries: new Map(), at: new Map() };
    const env: Record<string, any> = {
      walletAssetsState: state, WALLET_ASSETS_TTL_MS: 60_000, WALLET_ASSETS_RETRY_MS: [5_000], renderWalletAssets: () => {}, readStoredWalletAssets: async () => null,
      toncenterRestOrigin: () => '', readStoredToncenterApiKey: () => '', createToncenterRestFetch: () => null, isVaultViewActive: () => false,
      writeStoredWalletAssets: async () => {}, cachedTelegramGiftsForWallet: () => null, walletAthMaster: () => '', usernameRegistryAddressOrEmpty: () => '',
      rawAccount: (a: string) => a, parseTonAddress: (a: string) => ({ raw: a }), withoutOwnChange: (rows: any) => rows, withoutServiceStorage: (rows: any) => rows,
      refreshWalletIncomingBadges: () => {},
      readWalletHistoryPages: async (options: any) => { asked.push({ offset: options.offset, pages: options.pages }); return answer; },
    };
    const names = Object.keys(env);
    // eslint-disable-next-line no-new-func
    const load = new Function(...names, `${sourceBlock(app, 'async function loadWalletAssets(')}\nreturn loadWalletAssets;`)(...names.map((n) => env[n]));
    await load('history', { force: true, keep: true });
    expect(asked, 'one page, from the top').toEqual([{ offset: 0, pages: 1 }]);
    expect([state.historyOffset, state.historyMore], 'the read-on\'s place stands').toEqual([168, true]);
    await load('history');
    expect(asked.at(-1), 'MEASURED before: no read — a lone "Show more"').toEqual({ offset: 0, pages: undefined });
    answer = { rows: [{ id: 'pay', kind: 'gram', direction: 'in', trace: 'pay' }], ownTraces: [], serviceTraces: [], nextOffset: 28, more: true };
    await load('history', { force: true, keep: true });
    expect(state.history.map((row: any) => row.id)).toEqual(['pay']);
    expect(state.historyOffset).toBe(28);
    await load('history', { force: true });
    await load('history', { more: true });
    expect(asked.slice(3), 'the person asks: as many pages as it takes').toEqual([{ offset: 0, pages: undefined }, { offset: 28, pages: undefined }]);
  });

  it('HISTCALL-08: the incoming check is never the person\'s read — an open meeting it in flight waits and reads; a failed check is retried as a check', async () => {
    const app = readFileSync('web/app.js', 'utf8');
    const settle = async () => { for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setImmediate(resolve)); };
    const world = (state: any) => {
      const asked: any[] = [];
      const timers: Array<() => void> = [];
      const drawn = { count: 0 };
      let hold: ((page: any) => void) | null = null;
      let failNext = false;
      const page = (rows: any[], nextOffset: number, more: boolean) => ({ rows, ownTraces: [], serviceTraces: [], nextOffset, more });
      const env: Record<string, any> = {
        walletAssetsState: state, WALLET_ASSETS_TTL_MS: 60_000, WALLET_ASSETS_RETRY_MS: [5_000], renderWalletAssets: () => { drawn.count += 1; }, readStoredWalletAssets: async () => null,
        toncenterRestOrigin: () => '', readStoredToncenterApiKey: () => '', createToncenterRestFetch: () => null, isVaultViewActive: () => true,
        writeStoredWalletAssets: async () => {}, cachedTelegramGiftsForWallet: () => null, walletAthMaster: () => '', usernameRegistryAddressOrEmpty: () => '',
        rawAccount: (a: string) => a, parseTonAddress: (a: string) => ({ raw: a }), withoutOwnChange: (rows: any) => rows, withoutServiceStorage: (rows: any) => rows,
        refreshWalletIncomingBadges: () => {}, setTimeout: (callback: () => void) => { timers.push(callback); return 0; }, pageOnScreen: () => true,
        readWalletHistoryPages: async (options: any) => {
          asked.push({ offset: options.offset, pages: options.pages });
          if (failNext) { failNext = false; throw new Error('429'); }
          if (options.pages === 1 && hold === null && state.holdCheck) return new Promise((resolve) => { hold = resolve; });
          return options.pages === 1 ? page([], 28, true) : page([{ id: 'pay', kind: 'gram', direction: 'in', trace: 'pay' }], 84, true);
        },
      };
      const names = Object.keys(env);
      // eslint-disable-next-line no-new-func
      const load = new Function(...names, `${sourceBlock(app, 'async function loadWalletAssets(')}\nreturn loadWalletAssets;`)(...names.map((n) => env[n]));
      return { load, asked, timers, drawn, land: () => hold?.(page([], 28, true)), failOnce: () => { failNext = true; } };
    };
    const state: any = { owner: SELF, tab: 'history', history: null, historyOffset: 0, historyMore: false, stored: {}, loading: new Map(), failures: new Map(), retries: new Map(), at: new Map(), holdCheck: true };
    const w = world(state);
    const check = w.load('history', { force: true, keep: true });
    const open = w.load('history');
    await settle();
    expect(w.asked, 'the open waits for the check in flight').toEqual([{ offset: 0, pages: 1 }]);
    w.land();
    await check;
    await open;
    expect(w.asked, 'then reads for itself').toEqual([{ offset: 0, pages: 1 }, { offset: 0, pages: undefined }]);
    expect(state.history.map((row: any) => row.id)).toEqual(['pay']);
    const loaded: any = { owner: SELF, tab: 'history', history: Array.from({ length: 116 }, (_, i) => ({ id: `r${i}`, kind: 'gram', direction: 'in', trace: `r${i}` })),
      historyOffset: 116, historyMore: true, historyOwnTraces: new Set(), historyServiceTraces: new Set(), stored: {}, loading: new Map(), failures: new Map(), retries: new Map(), at: new Map() };
    const v = world(loaded);
    v.failOnce();
    await v.load('history', { force: true, keep: true });
    expect(v.timers.length, 'a retry is scheduled').toBe(1);
    v.timers[0]();
    await settle();
    expect(v.asked.at(-1), 'retried as a check: one page').toEqual({ offset: 0, pages: 1 });
    expect([loaded.history.length, loaded.historyOffset], 'the loaded pages and the place stand').toEqual([116, 116]);
    const before = v.drawn.count;
    await v.load('history', { force: true, keep: true });
    expect(v.drawn.count - before, 'no draw at its start, none at its end').toBe(0);
    loaded.holdCheck = true;
    const running = v.load('history', { force: true, keep: true });
    const pressed = v.load('history', { more: true });
    await settle();
    v.land();
    await running;
    await pressed;
    expect(v.asked.slice(-2), 'the check, then the press from the place').toEqual([{ offset: 0, pages: 1 }, { offset: 116, pages: undefined }]);
    const empty: any = { owner: SELF, tab: 'history', history: [], historyOffset: 28, historyMore: false, historyOwnTraces: new Set(), historyServiceTraces: new Set(),
      stored: {}, loading: new Map(), failures: new Map(), retries: new Map(), at: new Map([['history', 1]]) };
    const e = world(empty);
    e.failOnce();
    await e.load('history', { force: true, keep: true });
    const afterFailure = e.drawn.count;
    expect(afterFailure, 'the failure is drawn').toBe(1);
    await e.load('history', { force: true, keep: true });
    expect(e.drawn.count - afterFailure, 'MEASURED before: 0 — "trying again" stood for as long as History did').toBe(1);
    expect(empty.failures.has('history')).toBe(false);
    const kept: any = { owner: SELF, tab: 'tokens', history: Array.from({ length: 87 }, (_, i) => ({ id: `k${i}`, kind: 'gram', direction: 'in', trace: `k${i}` })),
      historyOffset: 87, historyMore: true, historyOwnTraces: new Set(), historyServiceTraces: new Set(), stored: {}, loading: new Map(), failures: new Map(), retries: new Map(),
      at: new Map([['history', Date.now()]]) };
    const k = world(kept);
    k.failOnce();
    await k.load('history', { force: true, keep: true });
    kept.tab = 'history';
    await k.load('history');
    expect([kept.history.length, kept.historyOffset, k.asked.length], 'the pages and the place stand; no read as the person\'s').toEqual([87, 87, 1]);
    const off: any = { owner: SELF, tab: 'tokens', history: Array.from({ length: 87 }, (_, i) => ({ id: `o${i}`, kind: 'gram', direction: 'in', trace: `o${i}` })),
      historyOffset: 87, historyMore: true, historyOwnTraces: new Set(), historyServiceTraces: new Set(), stored: {}, loading: new Map(), failures: new Map(), retries: new Map(),
      at: new Map([['history', Date.now()]]) };
    const o = world(off);
    o.failOnce();
    await o.load('history', { force: true, keep: true });
    o.timers[0]();
    await settle();
    expect(o.asked.at(-1), 'retried off History, as a check').toEqual({ offset: 0, pages: 1 });
    expect([off.failures.has('history'), off.history.length, off.historyOffset], 'the failure cleared; the pages and the place stand').toEqual([false, 87, 87]);
    const twice: any = { ...off, failures: new Map(), retries: new Map(), loading: new Map() };
    const w2 = world(twice);
    w2.failOnce();
    await w2.load('history', { force: true, keep: true });
    await w2.load('history', { force: true, keep: true });
    const askedBefore = w2.asked.length;
    w2.timers[0]();
    await settle();
    expect(w2.asked.length - askedBefore, 'nothing left to retry').toBe(0);
    const retry = sourceBlock(app, 'async function loadWalletAssets(');
    expect(retry).toContain("const offTab = keep || (tab === 'tokens' && state.tab === 'market');");
    expect(retry).toContain('const shown = state.tab === tab || (pageOnScreen() && offTab);');
  });

  it('HISTCALL-09: one pending retry a tab, the latest failure\'s; off its tab only while the page is seen; a wallet change lets them all go', async () => {
    const app = readFileSync('web/app.js', 'utf8');
    const settle = async () => { for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setImmediate(resolve)); };
    const live = new Map<number, () => void>();
    let next = 1;
    let seen = true;
    let reads = 0;
    const state: any = { owner: SELF, tab: 'tokens', history: [], historyOffset: 0, historyMore: false, historyOwnTraces: new Set(), historyServiceTraces: new Set(), stored: {},
      loading: new Map(), failures: new Map(), retries: new Map(), at: new Map() };
    const env: Record<string, any> = {
      walletAssetsState: state, WALLET_ASSETS_TTL_MS: 60_000, WALLET_ASSETS_RETRY_MS: [5_000, 60_000], renderWalletAssets: () => {}, readStoredWalletAssets: async () => null,
      toncenterRestOrigin: () => '', readStoredToncenterApiKey: () => '', createToncenterRestFetch: () => null, isVaultViewActive: () => true,
      writeStoredWalletAssets: async () => {}, cachedTelegramGiftsForWallet: () => null, walletAthMaster: () => '', usernameRegistryAddressOrEmpty: () => '',
      rawAccount: (a: string) => a, parseTonAddress: (a: string) => ({ raw: a }), withoutOwnChange: (rows: any) => rows, withoutServiceStorage: (rows: any) => rows,
      refreshWalletIncomingBadges: () => {}, pageOnScreen: () => seen,
      setTimeout: (callback: () => void) => { const id = next; next += 1; live.set(id, callback); return id; }, clearTimeout: (id: number) => { live.delete(id); },
      readWalletHistoryPages: async () => { reads += 1; throw new Error('500'); },
    };
    const names = Object.keys(env);
    // eslint-disable-next-line no-new-func
    const load = new Function(...names, `${sourceBlock(app, 'async function loadWalletAssets(')}\nreturn loadWalletAssets;`)(...names.map((n) => env[n]));
    for (let i = 0; i < 10; i += 1) await load('history', { force: true, keep: true });
    expect([reads, live.size, state.retries.size], 'ten failing checks, one retry pending').toEqual([10, 1, 1]);
    seen = false;
    const fire = () => { const [id, callback] = [...live.entries()][0]; live.delete(id); callback(); };
    fire();
    await settle();
    expect([reads, live.size, state.retries.size], 'nothing read, one armed again').toEqual([10, 1, 1]);
    fire();
    await settle();
    expect([reads, live.size], 'still hidden: still nothing read').toEqual([10, 1]);
    seen = true;
    fire();
    await settle();
    expect([reads, live.size], 'one read, the next retry armed in its place').toEqual([11, 1]);
    state.failures.clear();
    seen = false;
    fire();
    await settle();
    expect([reads, live.size], 'nothing stands: nothing armed').toEqual([11, 0]);
    const reset = sourceBlock(app, 'function resetWalletAssets(');
    expect(reset).toContain('for (const timer of walletAssetsState.retries.values()) clearTimeout(timer);');
    expect(reset).toContain('walletAssetsState.retries.clear();');
  });
});
