import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createFallbackTonRpcTransport, createTonCenterV3Transport, isTonRpcTransportDead } from '../web/ton-rpc-transport.mjs';
import { code, sourceBlock } from './helpers/source';


const app = readFileSync('web/app.js', 'utf8');
const block = (start: string) => code(sourceBlock(app, start));

const answers = (statuses: number[], body: any) => {
  const requests: string[] = [];
  const fetch = async (url: string) => {
    requests.push(url);
    const status = statuses[Math.min(requests.length - 1, statuses.length - 1)];
    return { ok: status === 200, status, headers: { get: () => null }, async json() { return status === 200 ? body : {}; } };
  };
  return { requests, fetch };
};
const transportOver = (fetch: any, rateLimitRetries = 0) => createTonCenterV3Transport({
  endpoint: 'https://toncenter.example/api/v3/runGetMethod',
  accountEndpoint: 'https://toncenter.example/api/v3/account',
  requestSpacingMs: 0,
  rateLimitRetries,
  rateLimitKey: `press-${Math.random()}`,
  fetch,
});

describe('a press\'s read waits a park out and asks once more', () => {
  it('PRESSREAD-01: the transport takes a 429 retry per call — a get-method and an account state; not asked, the transport\'s figure stands', async () => {
    const getter = { address: '0:' + '1'.repeat(64), method: 'get_nft_data', stack: [], cacheTtlMs: 0, rateLimitBackoffMs: 0 };
    const asked = answers([429, 200], { exit_code: 0, stack: [] });
    await expect(transportOver(asked.fetch).runGetMethod({ ...getter, skipIfRateLimited: false, rateLimitRetries: 1 })).resolves.toMatchObject({ exit_code: 0 });
    expect(asked.requests, 'refused once, asked again after its park').toHaveLength(2);
    for (const retries of [undefined, null]) {
      const plain = answers([429, 200], { exit_code: 0, stack: [] });
      await expect(transportOver(plain.fetch).runGetMethod({ ...getter, skipIfRateLimited: false, rateLimitRetries: retries }), `retries ${retries}`).rejects.toThrow(/429/);
      expect(plain.requests, `retries ${retries}: the transport's 0 stands`).toHaveLength(1);
      const configured = answers([429, 200], { exit_code: 0, stack: [] });
      await expect(transportOver(configured.fetch, 1).runGetMethod({ ...getter, skipIfRateLimited: false, rateLimitRetries: retries })).resolves.toMatchObject({ exit_code: 0 });
      expect(configured.requests, `retries ${retries}: a transport's own 1 stands, never read as 0`).toHaveLength(2);
    }
    const none = answers([429, 200], { exit_code: 0, stack: [] });
    await expect(transportOver(none.fetch, 1).runGetMethod({ ...getter, skipIfRateLimited: false, rateLimitRetries: 0 })).rejects.toThrow(/429/);
    expect(none.requests, 'a call that asks for none has none').toHaveLength(1);
    const twice = answers([429, 429, 200], { exit_code: 0, stack: [] });
    await expect(transportOver(twice.fetch).runGetMethod({ ...getter, skipIfRateLimited: false, rateLimitRetries: 1 })).rejects.toThrow(/429/);
    expect(twice.requests, 'once more, not for ever').toHaveLength(2);
    const state = answers([429, 200], { balance: '5', status: 'active' });
    await expect(transportOver(state.fetch).getAccountState({ address: getter.address }, { skipIfRateLimited: false, rateLimitRetries: 1, rateLimitBackoffMs: 0 }))
      .resolves.toMatchObject({ balance: '5' });
    expect(state.requests).toHaveLength(2);
  });

  it('PRESSREAD-02: every read an NFT press makes before it signs waits a park out and asks once more; the window\'s own reads too', () => {
    // eslint-disable-next-line no-new-func
    const pressReadOptions = new Function('PRESS_READ_QUEUE_TIMEOUT_MS', `${sourceBlock(app, 'function pressReadOptions(options = {}) {')}\nreturn pressReadOptions;`)(20_000);
    expect(pressReadOptions({ verify: true, priority: 'critical', cacheTtlMs: 0, queueTimeoutMs: 8_000, skipIfRateLimited: true }))
      .toEqual({ verify: true, priority: 'critical', cacheTtlMs: 0, queueTimeoutMs: 20_000, skipIfRateLimited: false, rateLimitRetries: 1 });
    expect(app).toContain('const PRESS_READ_QUEUE_TIMEOUT_MS = 20_000;');
    const buy = block('async function walletNftPressChecks(listing, { buying }) {');
    expect(block('async function walletNftListingFresh(listing) {'), 'the listing read again: a sale, an auction, an item\'s own sale')
      .toContain("const fetchImpl = createToncenterRestFetch({ requestOptions: pressReadOptions({ priority: 'focus' }) });");
    expect(buy).toContain('item: fresh.nft, callOptions: pressReadOptions(criticalChainReadOptions()) });');
    expect(buy).toContain('fresh.index, { callOptions: pressReadOptions(criticalChainReadOptions()) });');
    expect(block('async function walletNftBuyCollectionProven(collection) {')).toContain("requestOptions: pressReadOptions({ priority: 'focus' }), fresh: true");
    const sell = block('async function openNftSellDialog(item, hold) {');
    const send = block('async function openWalletNftTransferDialog(item, hold) {');
    for (const [name, text] of [['sell', sell], ['send', send]]) {
      expect(text, name).toContain('item: item.address, callOptions: pressReadOptions(criticalChainReadOptions()) });');
      expect(text, name).toContain('walletNftTopUp(item, pressReadOptions(criticalChainReadOptions()))');
      expect(text, `${name}: the window's own read of the reserve`).toContain("walletNftTopUp(item, pressReadOptions({ priority: 'focus' }))");
    }
    expect(block('async function refuseNftOnOwnSale(itemAddress) {')).toContain("requestOptions: pressReadOptions({ priority: 'critical' })");
    expect(block('async function walletNftListingTerms(collection, requestOptions = {}) {')).toContain("requestOptions: pressReadOptions({ priority: 'focus', ...requestOptions })");
    expect(block('async function walletNftOwnSaleNow(listing, signer) {')).toContain("requestOptions: pressReadOptions({ priority: 'focus' })");
    for (const text of [buy, sell, send, block('async function walletNftOwnSaleNow(listing, signer) {'), block('async function refuseNftOnOwnSale(itemAddress) {')]) {
      expect(text).not.toMatch(/(?<!pressReadOptions\()criticalChainReadOptions\(\)/);
      expect(text).not.toMatch(/requestOptions: \{ priority: '[a-z]+', skipIfRateLimited: false \}/);
    }
    expect(app).toMatch(/const readListings = \(tries\) => readListingsOf\(\{ fetchImpl: createToncenterRestFetch\(\{ requestOptions: \{ priority: 'focus', skipIfRateLimited: false, rateLimitRetries: 1 \} \}\)/);
  });

  it('PRESSREAD-03: a press refused before it signed says the network did not answer; once signing, the send\'s own words stand', () => {
    const t = (key: string) => key;
    // eslint-disable-next-line no-new-func
    const refusalTextFor = new Function('t', `${sourceBlock(app, 'function refusalTextFor(error) {')}\nreturn refusalTextFor;`)(t);
    // eslint-disable-next-line no-new-func
    const walletPressRefusal = new Function('refusalTextFor', 'walletAssetSendRefusal', `${sourceBlock(app, 'function walletPressRefusal(error, signing) {')}\nreturn walletPressRefusal;`)(
      refusalTextFor, () => 'common.blocked');
    const limited = Object.assign(new Error('TON RPC rate limit backoff active'), { code: 'RATE_LIMITED' });
    const rest429 = new Error('nft market: HTTP 429');
    const queued = Object.assign(new Error('queued too long'), { code: 'QUEUE_TIMEOUT' });
    for (const error of [limited, rest429, queued]) {
      expect(walletPressRefusal(error, false), error.message).toBe('errors.networkNotNow');
      expect(walletPressRefusal(error, true), `${error.message}: signing`).toBe('common.blocked');
    }
    expect(walletPressRefusal(new Error('anything else'), false)).toBe('common.blocked');
    const windows = [
      ['buy', block('async function openNftBuyDialog(listing, hold) {'), 'const fresh = await walletNftPressChecks(listing, { buying: true });'],
      ['bid', block('async function openNftBidDialog(listing, hold) {'), 'const fresh = await walletNftPressChecks(listing, { buying: false });'],
      ['sell', block('async function openNftSellDialog(item, hold) {'), 'await buildListing('],
      ['send', block('async function openWalletNftTransferDialog(item, hold) {'), 'const body = buildNftTransferBody('],
      ['price', block('async function openNftRepriceDialog(listing, hold) {'), 'const fresh = await walletNftOwnSaleNow(listing, signer);'],
      ['cancel', block('async function openNftCancelDialog(listing, hold) {'), 'const fresh = await walletNftOwnSaleNow(listing, signer);'],
    ];
    for (const [name, text, lastRead] of windows) {
      const declared = text.indexOf('let signing = false;');
      const signing = text.indexOf('signing = true;', declared + 1);
      const sent = text.indexOf('await sendWalletAssetMessage(', signing);
      expect(declared, name).toBeGreaterThan(-1);
      expect(declared, `${name}: declared before its try`).toBeLessThan(text.indexOf('requireNoPendingServiceWorkerAppShellReload();'));
      expect(signing, `${name}: after its last read`).toBeGreaterThan(text.indexOf(lastRead));
      expect(text.slice(signing, sent).trim(), `${name}: the message is the next thing`).toBe('signing = true;');
      expect(text.match(/sendWalletAssetMessage\(/g), `${name}: one message`).toHaveLength(1);
      expect(text, name).toMatch(/walletPressRefusal\(error, signing\)|walletNftOwnSaleRefusal\(error, signing\)|walletNftPressRefusal\(listing, error, signing\)/);
      expect(text, `${name}: no refusal outside it`).not.toContain('walletAssetSendRefusal(error)');
    }
    expect(block('function walletNftOwnSaleRefusal(error, signing) {')).toContain('walletPressRefusal(error, signing)');
    expect(block('function walletNftPressRefusal(listing, error, signing) {')).toContain(': walletPressRefusal(error, signing);');
  });

  it('PRESSREAD-04: a door with no account endpoint is not asked for an account\'s state — the first door\'s 429 stands, said as the network, and the other door is not parked [round 116 — C5-1]', async () => {
    const address = '0:' + '1'.repeat(64);
    const refused = answers([429], {});
    const first = createTonCenterV3Transport({ endpoint: 'https://toncenter.example/api/v3/runGetMethod', accountEndpoint: 'https://toncenter.example/api/v3/account',
      requestSpacingMs: 0, rateLimitRetries: 0, rateLimitKey: `press-first-${Math.random()}`, fetch: refused.fetch });
    const other = answers([200], { exit_code: 0, stack: [] });
    const keyless = createTonCenterV3Transport({ endpoint: 'https://keyless.example/api/v3/runGetMethod', requestSpacingMs: 0, rateLimitKey: `press-keyless-${Math.random()}`, fetch: other.fetch });
    expect(first.supportsAccountState).toBe(true);
    expect(keyless.supportsAccountState).toBe(false);
    const both: any = createFallbackTonRpcTransport({ transports: [first, keyless], requestTimeoutMs: 1_000 });
    let thrown: any = null;
    await both.getAccountState({ address }, { skipIfRateLimited: false, rateLimitBackoffMs: 0 }).catch((error: any) => { thrown = error; });
    expect(String(thrown?.message), 'the first door\'s refusal, not "not configured"').toMatch(/429|rate limit/i);
    expect(String(thrown?.message)).not.toMatch(/not configured/);
    expect(isTonRpcTransportDead(keyless), 'the other door keeps its reads').toBe(false);
    expect(other.requests).toHaveLength(0);
    let balanceThrown: any = null;
    await both.getAccountBalance(address, { skipIfRateLimited: false, rateLimitBackoffMs: 0 }).catch((error: any) => { balanceThrown = error; });
    expect(String(balanceThrown?.message)).toMatch(/429|rate limit/i);
    expect(String(balanceThrown?.message)).not.toMatch(/not configured/);
    expect(other.requests).toHaveLength(0);
    const t = (key: string) => key;
    // eslint-disable-next-line no-new-func
    const refusalTextFor = new Function('t', `${sourceBlock(app, 'function refusalTextFor(error) {')}\nreturn refusalTextFor;`)(t);
    expect(refusalTextFor(thrown)).toBe('errors.networkNotNow');
    const answered = answers([200], { balance: '5', status: 'active' });
    const second = createTonCenterV3Transport({ endpoint: 'https://second.example/api/v3/runGetMethod', accountEndpoint: 'https://second.example/api/v3/account',
      requestSpacingMs: 0, rateLimitKey: `press-second-${Math.random()}`, fetch: answered.fetch });
    const pair: any = createFallbackTonRpcTransport({ transports: [keyless, second], requestTimeoutMs: 1_000 });
    await expect(pair.getAccountState({ address }, { skipIfRateLimited: false })).resolves.toMatchObject({ balance: '5' });
  });

  it('PRESSREAD-05: the rest of the press-time package — the terms ask no NFTs, the list\'s rows wait a park out, «On sale» never ends as "No NFTs yet" [round 114 — C5-1, C5-2, C1-2]', () => {
    expect(block('async function walletNftListingTerms(collection, requestOptions = {}) {'), 'a moved NFT\'s sale still states its terms')
      .toContain('readLatestListings({ fetchImpl, origin, collection, checkItems: false })');
    const read = block('async function walletNftCollectionRead(entry, { deeper = false, priority = \'focus\', forList = false, pressed = false } = {}) {');
    expect(read, 'the rows, and an open view\'s read past its head [round 117 — C5-1]').toContain('...(forList || !head ? { skipIfRateLimited: false, rateLimitRetries: 1 } : {})');
    expect(block('async function walletNftReadRows() {'), 'the rows are read one at a time').toContain('await walletNftCollectionRead(entry, { forList: true });');
    const at = app.indexOf('const readListings = (tries) => readListingsOf(');
    const caught = app.indexOf('.catch((error) => {', at);
    const failure = app.slice(caught, app.indexOf('    } else {', caught));
    expect(failure).not.toMatch(/nftListings\s*=\s*\[\]/);
    expect(failure).toContain('if (tries > 1) { setTimeout(() => { if (current()) void readListings(tries - 1); }, 5_000); return; }');
    expect(failure).toMatch(/setTimeout\(\(\) => whenPageSeen\(\(\) => \{\s*if \(!current\(\)\) return;\s*if \(state\.tab === 'nft' && isVaultViewActive\(\)\) void readListings\(3\);\s*else state\.at\.delete\('nft'\);\s*\}\), WALLET_MARKET_REFRESH_MS\);/);
    expect(app, 'the tab says loading while it is not read').toContain("walletAssetsState.nftListings === null ? 'wallet.assetsLoading' : 'wallet.nftEmpty'");
  });

  it('PRESSREAD-06: «On sale» read again after its last try — one chain a wallet however many loads ask it; a page not seen asks nothing until it is; another tab ends it [round 117 — C5-2]', async () => {
    vi.useFakeTimers();
    try {
      const first = '      const run = (state.listingsRun = (state.listingsRun ?? 0) + 1);';
      const last = '      void readListings(3);';
      const start = app.indexOf(first);
      expect(start).toBeGreaterThan(0);
      const snippet = app.slice(start, app.indexOf(last, start) + last.length);
      let reads = 0;
      let hidden = false;
      const waiting: Array<() => void> = [];
      const state: any = { owner: 'w', tab: 'nft', at: new Map([['nft', 1]]), cutNfts: 0, nftListings: null };
      const env: Record<string, any> = {
        state, owner: 'w', WALLET_MARKET_REFRESH_MS: 30_000, console: { warn: () => {} },
        readListingsOf: () => { reads += 1; return Promise.reject(new Error('refused')); },
        createToncenterRestFetch: () => null, toncenterRestOrigin: () => 'https://o', walletNftVerifyCollections: async () => [],
        walletNftCollectionVerified: () => 'yes', walletNftOwnPendingApplied: (one: any) => one, renderWalletAssets: () => {}, isVaultViewActive: () => true,
        whenPageSeen: (run: () => void) => { if (hidden) waiting.push(run); else run(); },
      };
      const names = Object.keys(env);
      // eslint-disable-next-line no-new-func
      const load = new Function(...names, snippet);
      const loadOnce = () => load(...names.map((n) => env[n]));
      loadOnce();
      await vi.advanceTimersByTimeAsync(11_000);
      expect(reads, 'its three tries, 5 s apart').toBe(3);
      for (let i = 0; i < 3; i += 1) { loadOnce(); await vi.advanceTimersByTimeAsync(1_000); }
      reads = 0;
      await vi.advanceTimersByTimeAsync(240_000);
      expect(reads, 'one chain, not four').toBeLessThanOrEqual(21);
      expect(reads).toBeGreaterThanOrEqual(15);
      hidden = true;
      await vi.advanceTimersByTimeAsync(60_000);
      reads = 0;
      await vi.advanceTimersByTimeAsync(300_000);
      expect(reads, 'the page hidden asks nothing').toBe(0);
      expect(waiting.length, 'one read waits for the page').toBe(1);
      hidden = false;
      waiting.splice(0).forEach((run) => run());
      await vi.advanceTimersByTimeAsync(1_000);
      expect(reads, 'seen again, it reads').toBe(1);
      state.tab = 'tokens';
      await vi.advanceTimersByTimeAsync(60_000);
      reads = 0;
      await vi.advanceTimersByTimeAsync(300_000);
      expect([reads, state.at.has('nft')]).toEqual([0, false]);
      state.tab = 'nft';
      env.readListingsOf = () => { reads += 1; return Promise.resolve([]); };
      loadOnce();
      await vi.advanceTimersByTimeAsync(300_000);
      expect([reads, state.nftListings]).toEqual([1, []]);
    } finally {
      vi.useRealTimers();
    }
  });
});
