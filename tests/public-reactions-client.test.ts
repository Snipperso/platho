import { describe, expect, it } from 'vitest';
import { beginCell, Cell } from '@ton/core';
import {
  PUBLIC_REACT_OPCODE, PUBLIC_REACT_VALUE, PUBLIC_REACTION_COUNT, PUBLIC_REACTION_GLYPHS, PUBLIC_REACTION_PAGE_CAP,
  buildReactMessage, createOwnReactionStore, decodePublicReactions, reactionGlyph, reactionsGetterCall, reactionsShown,
  reactionsTotal,
} from '../web/public-reactions.mjs';
import { parseBocBase64 } from '../web/pwa-contract-transactions.mjs';
import { readFileSync } from 'node:fs';


describe('PUBLIC-REACTIONS (client)', () => {
  it('RXC-01: the message is `React{ target, emoji }` under the contract opcode, with the receiver demand attached', () => {
    const built = buildReactMessage({ shardAddress: '0:' + 'ab'.repeat(32), target: 7, emoji: 3 });
    expect(built.address).toBe('0:' + 'ab'.repeat(32));
    expect(built.amount).toBe(PUBLIC_REACT_VALUE);
    expect(PUBLIC_REACT_VALUE).toBe(2_750_000n);
    expect(built.bounce).toBe(true);
    expect(parseBocBase64(built.payload), 'a well-formed BoC in the project own reader').toBeTruthy();
    const bits = bitsOf(built.payload);
    expect(bits.length).toBe(72);
    expect(parseInt(bits.slice(0, 32), 2)).toBe(PUBLIC_REACT_OPCODE);
    expect(parseInt(bits.slice(32, 64), 2)).toBe(7);
    expect(parseInt(bits.slice(64, 72), 2)).toBe(3);
    expect(buildReactMessage({ shardAddress: '0:' + 'ab'.repeat(32), target: 7, emoji: 3, extra: 1_000n }).amount).toBe(PUBLIC_REACT_VALUE + 1_000n);
    expect(() => buildReactMessage({ shardAddress: '0:' + 'ab'.repeat(32), target: 7, emoji: 16 })).toThrow(/no reaction/);
    expect(() => buildReactMessage({ shardAddress: '0:' + 'ab'.repeat(32), target: -1, emoji: 0 })).toThrow(/uint32/);
    expect(() => buildReactMessage({ shardAddress: '', target: 1, emoji: 0 })).toThrow(/shard address/);
  });

  it('RXC-02: sixteen glyphs, one per index, none repeated — and an index once used keeps its meaning', () => {
    expect(PUBLIC_REACTION_COUNT).toBe(16);
    expect(PUBLIC_REACTION_GLYPHS.length).toBe(16);
    expect(new Set(PUBLIC_REACTION_GLYPHS).size).toBe(16);
    expect(PUBLIC_REACTION_GLYPHS.slice(0, 8)).toEqual(['❤️', '👍', '👎', '🔥', '😂', '😮', '😢', '🙏']);
    expect(reactionGlyph(3)).toBe('🔥');
    expect(() => reactionGlyph(16)).toThrow(/no reaction/);
  });

  it('RXC-03: the getter decoder walks the ref-chained 512-bit cells the contract packs, tail first', () => {
    const row = (counters: number[]) => { const b = beginCell(); for (const c of counters) b.storeUint(c, 32); return b; };
    const third = row(Array.from({ length: 16 }, (_, i) => (i === 15 ? 5 : 0))).endCell();
    const second = row(new Array(16).fill(0)).storeRef(third).endCell();
    const first = row(Array.from({ length: 16 }, (_, i) => (i === 0 ? 2 : i === 3 ? 1 : 0))).storeRef(second).endCell();
    const result = { exit_code: 0, stack: [
      { type: 'num', value: '0x4' }, { type: 'num', value: '0x3' }, { type: 'num', value: '0x2a' },
      { type: 'cell', cell: first.toBoc().toString('base64') },
    ] };
    const page = decodePublicReactions(result);
    expect(page.from_target).toBe(4n);
    expect(page.count).toBe(3);
    expect(page.entry_count).toBe(42n);
    expect(page.rows.map((r) => Number(r.target))).toEqual([4, 5, 6]);
    expect(page.rows[0].counters[0]).toBe(2);
    expect(page.rows[0].counters[3]).toBe(1);
    expect(page.rows[2].counters[15]).toBe(5);
    expect(reactionsTotal(page.rows[0].counters)).toBe(3);
    expect(reactionsShown(page.rows[0].counters)).toEqual([{ index: 0, count: 2, glyph: '❤️' }, { index: 3, count: 1, glyph: '🔥' }]);
    expect(reactionsShown(page.rows[1].counters)).toEqual([]);
    expect(() => decodePublicReactions({ exit_code: 0, stack: [{ type: 'num', value: '0x0' }] })).toThrow(/ABI mismatch/);
  });

  it('RXC-04: the getter call is capped at the page the contract answers, in the wire shape runGetMethod takes', () => {
    const call = reactionsGetterCall('0:' + 'cd'.repeat(32), 40, 500);
    expect(call.method).toBe('get_reactions');
    expect(call.stack).toEqual([{ type: 'num', value: '0x28' }, { type: 'num', value: `0x${PUBLIC_REACTION_PAGE_CAP.toString(16)}` }]);
    expect(reactionsGetterCall('0:' + 'cd'.repeat(32), 0, 0).stack[1]).toEqual({ type: 'num', value: '0x1' });
  });

  it('RXC-05: what this device pressed is remembered per wallet, survives a reload, and never leaks to another wallet', () => {
    const bag = new Map<string, string>();
    const storage = { getItem: (k: string) => bag.get(k) ?? null, setItem: (k: string, v: string) => { bag.set(k, v); } };
    const shard = '0:' + 'EF'.repeat(32);
    const store = createOwnReactionStore({ storage, wallet: '0:' + '11'.repeat(32) });
    expect(store.has(shard, 5, 2)).toBe(false);
    store.note(shard, 5, 2);
    store.note(shard, 5, 9);
    expect(store.has(shard.toLowerCase(), 5n, 2), 'address case and target type do not matter').toBe(true);
    expect(store.mine(shard, 5).sort()).toEqual([2, 9]);
    expect(store.mine(shard, 6)).toEqual([]);
    const again = createOwnReactionStore({ storage, wallet: '0:' + '11'.repeat(32) });
    expect(again.mine(shard, 5).sort()).toEqual([2, 9]);
    const other = createOwnReactionStore({ storage, wallet: '0:' + '22'.repeat(32) });
    expect(other.size()).toBe(0);
    const broken = createOwnReactionStore({ storage: { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } }, wallet: 'w' });
    broken.note(shard, 1, 1);
    expect(broken.has(shard, 1, 1)).toBe(true);
  });
});

function bitsOf(bocBase64: string): string {
  const cell = Cell.fromBase64(bocBase64);
  const s = cell.beginParse();
  let out = '';
  while (s.remainingBits > 0) out += s.loadBit() ? '1' : '0';
  return out;
}

describe('PUBLIC-REACTIONS (client, the press reconciliation) [audit 2026-09-05, round 2]', () => {
  it('RXC-06: a re-read lands PAST the settle window, so a press the chain never showed can be forgotten; counters age out', () => {
    const app = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
    const num = (name: string) => {
      const m = app.match(new RegExp(`const ${name} = ([^;]+);`));
      if (!m) throw new Error(`${name} not found`);
      // eslint-disable-next-line no-new-func
      return new Function(`return (${m[1]});`)();
    };
    const settle = Number(num('REACTION_SETTLE_MS'));
    const delays = (num('REACTION_REREAD_DELAYS_MS') as number[]).map(Number);
    expect(delays.length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...delays), 'the last re-read must be older than the settle window when it lands').toBeGreaterThan(settle);
    expect(Math.min(...delays), 'and the first must give the hop time to land (p50 27 s measured 2026-09-04)').toBeGreaterThanOrEqual(15_000);
    const ttl = Number(num('REACTION_COUNTS_TTL_MS'));
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(10 * 60_000);
    expect(app).toContain('const fresh = reactionCounts.has(key) && Date.now() - (reactionReadAt.get(key) ?? 0) < REACTION_COUNTS_TTL_MS;');
    expect(app).toContain('if (!force && fresh && !reactionsOwedFor(key)) return false;');
    expect(app).toContain("if (item?.hidden === true) return;");
  });

  it('RX-PRICE-01: the reaction dialog quotes the MEASURED cost, and apart what the wallet must hold [2026-09-30]', async () => {
    const app = readFileSync('web/app.js', 'utf8');
    const picker = app.slice(app.indexOf('async function openReactionPicker('), app.indexOf('async function reactTo('));
    expect(picker).toContain('const cost = reactionFinalCost({ lane, newLeaf, prices: composerNetworkPrices() });');
    expect(picker).toContain("{ label: t('common.costLabel'), value: `${formatTonNanotonsUp(cost)} GRAM` },");
    expect(picker).toContain('chosen === null ? !(groupCounted(0) && groupCounted(1))');
    expect(picker).toContain('extra: squatCushionNanotons(LANE_PUBLIC) + reactDirectLiveExtraNanotons() }).amount)');
    expect(picker).toContain('+ walletSendFeeReserveNanotons([1]);');
    expect(picker).toContain("{ label: t('common.balanceNeeded'), value: balanceNeededText(hold) },");
    const { reactionFinalCost } = await import('../web/publish-final-cost.mjs');
    expect(reactionFinalCost({ newLeaf: true })).toBe(1_527_071n);
    expect(reactionFinalCost({ newLeaf: false })).toBe(1_273_205n);
    expect(reactionFinalCost({ lane: 'thread', newLeaf: true })).toBe(1_527_605n);
  });
});

describe('PUBLIC-REACTIONS (client, 2026-10-01)', () => {
  const app = readFileSync('web/app.js', 'utf8');
  const block = (declaration: string) => {
    const at = app.indexOf(declaration);
    if (at < 0) throw new Error(`${declaration} not found`);
    return app.slice(at, app.indexOf('\n}\n', at) + 2);
  };
  const constant = (name: string) => { const at = app.indexOf(`const ${name} = `); return app.slice(at, app.indexOf(';', at) + 1); };
  const SHARD = '0:' + 'ab'.repeat(32);
  const WALLET = '0:' + '11'.repeat(32);
  const memoryStorage = () => { const map = new Map<string, string>(); return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); }, map }; };

  it('RXC-07: the store keeps what the chain has not shown yet — across a reload, per wallet, bounded, gone once settled', () => {
    const storage = memoryStorage();
    const store = createOwnReactionStore({ storage, wallet: WALLET });
    store.note(SHARD, 7n, 3);
    store.notePending(SHARD, 7n, 3, { since: 1_000, floor: 5 });
    const reloaded = createOwnReactionStore({ storage, wallet: WALLET });
    expect(reloaded.pendingPresses()).toEqual([{ shard: SHARD, target: '7', emoji: 3, since: 1_000, floor: 5 }]);
    expect(createOwnReactionStore({ storage, wallet: '0:' + '22'.repeat(32) }).pendingPresses(), 'another wallet waits on nothing').toEqual([]);
    reloaded.settlePending(SHARD, 7n, 3);
    expect(createOwnReactionStore({ storage, wallet: WALLET }).pendingPresses()).toEqual([]);
    expect(createOwnReactionStore({ storage, wallet: WALLET }).has(SHARD, 7n, 3), 'settling is not forgetting the press').toBe(true);
    for (let i = 0; i < 70; i += 1) reloaded.notePending(SHARD, BigInt(i), 0, { since: 2_000 + i, floor: 1 });
    const bounded = createOwnReactionStore({ storage, wallet: WALLET }).pendingPresses();
    expect(bounded).toHaveLength(64);
    expect(bounded[0].target, 'the oldest give way').toBe('6');
    const broken = createOwnReactionStore({ storage: { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } }, wallet: 'w' });
    broken.notePending(SHARD, 1n, 1, { since: 1, floor: 1 });
    expect(broken.pendingPresses()).toHaveLength(1);
  });

  function reactions(storage: any, clock: { now: number }) {
    const timers: Array<{ delay: number; run: () => void }> = [];
    const hydrations: any[] = [];
    const statuses: string[] = [];
    const env: Record<string, any> = {
      plathoWallet: { address: WALLET },
      createOwnReactionStore, localStorageOrNull: () => storage, latchedLocalStorage: () => storage,
      queueReactionHydration: (shard: string, target: any, options: any) => { hydrations.push([shard, String(target), options]); },
      setTimeout: (run: () => void, delay: number) => { timers.push({ delay, run }); },
      Date: { now: () => clock.now },
      showModerationStatus: (text: string) => { statuses.push(text); },
      t: (key: string) => `<${key}>`,
      walletChainNowMs: () => clock.now, walletClockInDoubt: () => false,
    };
    const names = Object.keys(env);
    const sources = [
      'let ownReactionState = null;',
      block('function reactionKey('),
      constant('REACTION_SETTLE_MS'),
      'const reactionsUnsettled = new Map();',
      block('function reactionSettleAt('),
      block('function reactionHeld('),
      block('function ownReactions('), block('function resumePendingReactions('), block('function reconcileUnsettledReactions('),
    ];
    // eslint-disable-next-line no-new-func
    const api = new Function(...names, `${sources.join('\n')}\nreturn { ownReactions, reconcileUnsettledReactions, unsettled: reactionsUnsettled };`)(...names.map((n) => env[n]));
    return { api, timers, hydrations, statuses };
  }

  it('RXC-08: a press the chain refused is withdrawn on the next launch, though the app was closed inside the settle window', () => {
    const storage = memoryStorage();
    const clock = { now: 1_000_000 };
    const before = createOwnReactionStore({ storage, wallet: WALLET });
    before.note(SHARD, 9n, 2);
    before.notePending(SHARD, 9n, 2, { since: clock.now, floor: 4 });
    clock.now += 30_000;
    const { api, timers, hydrations, statuses } = reactions(storage, clock);
    const store = api.ownReactions();
    expect(api.unsettled.size, 'the wait came back with the store').toBe(1);
    expect(timers).toHaveLength(1);
    expect(timers[0].delay, 'read once the window has passed').toBe(120_000 - 30_000 + 1_000);
    timers[0].run();
    expect(hydrations).toEqual([[SHARD, '9', { force: true }]]);
    const counters = new Array(16).fill(0); counters[2] = 3;
    expect(api.reconcileUnsettledReactions(SHARD, 9n, counters)[2]).toBe(4);
    clock.now += 100_000;
    expect(api.reconcileUnsettledReactions(SHARD, 9n, counters)[2]).toBe(3);
    expect(store.has(SHARD, 9n, 2)).toBe(false);
    expect(createOwnReactionStore({ storage, wallet: WALLET }).pendingPresses()).toEqual([]);
    expect(statuses).toEqual(['<public.reactionFailed>']);
  });

  it('RXC-09: a press the chain shows is settled — kept as pressed, no longer awaited; a wait without its mark is dropped', () => {
    const storage = memoryStorage();
    const clock = { now: 5_000_000 };
    const before = createOwnReactionStore({ storage, wallet: WALLET });
    before.note(SHARD, 4n, 1);
    before.notePending(SHARD, 4n, 1, { since: clock.now, floor: 2 });
    before.notePending(SHARD, 5n, 1, { since: clock.now, floor: 1 });
    const { api } = reactions(storage, clock);
    const store = api.ownReactions();
    expect(api.unsettled.size).toBe(1);
    const counters = new Array(16).fill(0); counters[1] = 2;
    api.reconcileUnsettledReactions(SHARD, 4n, counters);
    expect(store.has(SHARD, 4n, 1)).toBe(true);
    expect(createOwnReactionStore({ storage, wallet: WALLET }).pendingPresses()).toEqual([]);
  });

  it('RXC-12: the press itself writes the wait to the device, beside the mark; a wallet change builds the store again', async () => {
    const storage = memoryStorage();
    const clock = { now: 7_000_000 };
    const sent: any[] = [];
    const env: Record<string, any> = {
      plathoWallet: { address: WALLET },
      createOwnReactionStore, localStorageOrNull: () => storage, latchedLocalStorage: () => storage,
      queueReactionHydration: () => {}, setTimeout: () => {}, Date: { now: () => clock.now },
      showModerationStatus: () => {}, t: (key: string) => key, noteTonRpcRateLimit: () => false,
      buildReactMessage, squatCushionNanotons: () => 0n, LANE_PUBLIC: 'public',
      reactDirectLiveExtraNanotons: () => 0n, messageNetworkPrices: async () => null,
      assertWalletGramAtLeast: async () => {}, walletSendFeeReserveNanotons: () => 10_000_000n,
      sendPlathoWalletTransaction: async (_w: any, tx: any) => { sent.push(tx); }, broadcastMayHaveLanded: () => false,
      requireSameWallet: (signer: any) => signer,
      reactionCounts: new Map(), PUBLIC_REACTION_COUNT, refreshReactionBars: () => {}, globalThis: {},
      walletChainClockOffsetMs: () => 0, DIRECT_SEND_EXPIRY_GRACE_MS: 30_000,
      walletChainNowMs: () => clock.now, walletClockInDoubt: () => false,
    };
    const names = Object.keys(env);
    const press = block('async function reactTo(');
    expect(press, 'no lock across the wallet\'s windows').not.toContain('platho-reactions.v1:');
    expect(press).not.toContain('holdCrossWindowLock');
    expect(app).not.toContain('function holdCrossWindowLock(');
    expect(app).not.toContain('function crossWindowLocks(');
    const sources = [
      'let ownReactionState = null;', block('function reactionKey('), constant('REACTION_SETTLE_MS'), constant('REACTION_REREAD_DELAYS_MS'),
      'const reactionsUnsettled = new Map();', 'const reactionsInFlight = new Map();',
      block('function reactionSettleAt('), block('function reactionSignedDeadlineMs('), block('function reactionChainDeadlineMs('), block('function reactionHeld('),
      block('function ownReactions('), block('function resumePendingReactions('), press,
    ];
    // eslint-disable-next-line no-new-func
    const api = new Function(...names, `${sources.join('\n')}\nreturn { reactTo };`)(...names.map((n) => env[n]));
    await Promise.all([api.reactTo({ dataset: { shard: SHARD, target: '12' } }, 5), api.reactTo({ dataset: { shard: SHARD, target: '12' } }, 5)]);
    expect(sent).toHaveLength(1);
    const after = createOwnReactionStore({ storage, wallet: WALLET });
    expect(after.has(SHARD, 12n, 5)).toBe(true);
    expect(after.pendingPresses()).toEqual([{ shard: SHARD, target: '12', emoji: 5, since: clock.now, floor: 1, settleAfter: clock.now + 120_000 }]);
    expect(block('function resetReactionRuntimeState(')).toContain('ownReactionState = null;');
  });

  it('RXC-10: a tap on a counter opens the priced picker with that emoji chosen — it never signs by itself', () => {
    const bar = block('function renderReactionBar(');
    expect(bar).toContain("chip.addEventListener('click', () => { if (!mine.includes(r.index)) void openReactionPicker(bar, { preselect: r.index }); });");
    expect(bar).not.toContain('reactTo(');
    const picker = app.slice(app.indexOf('async function openReactionPicker('), app.indexOf('async function reactTo('));
    expect(picker).toContain('async function openReactionPicker(bar, { preselect = null } = {}) {');
    expect(picker).toContain('&& !mine.includes(preselect)');
    expect(picker).toContain("${index === chosen ? ' is-selected' : ''}");
    expect(app.match(/await reactTo\(bar, chosen\)/g)?.length).toBe(1);
    expect(app.match(/(?<!function )reactTo\(bar, /g)?.length, 'and nothing else calls the send').toBe(1);
  });

  it('RXC-11: the bars laid out ask for their counts again — a card that stays does not keep the counts it was built with, and the viewport is nobody\'s business', () => {
    const queued: any[] = [];
    const listeners: Record<string, () => void> = {};
    let intervals = 0;
    const barAt = (top: number, height = 30, target = String(top)) => ({
      dataset: { shard: SHARD, target }, getBoundingClientRect: () => ({ top, bottom: top + height, width: 300, height }),
    });
    const bars = [barAt(-100), barAt(100), barAt(700), barAt(900), { dataset: { shard: SHARD, target: 'x' }, getBoundingClientRect: () => ({ top: 0, bottom: 0, width: 0, height: 0 }) }];
    const page = { hidden: false };
    const env: Record<string, any> = {
      document: {
        get hidden() { return page.hidden; },
        querySelectorAll: () => bars,
        addEventListener: (name: string, run: () => void) => { listeners[name] = run; },
      },
      queueReactionHydration: (shard: string, target: string) => { queued.push(target); return true; },
      setInterval: () => { intervals += 1; return 1; },
      REACTION_COUNTS_TTL_MS: 300_000, REACTION_REFRESH_MAX_BARS: 64,
    };
    const names = Object.keys(env);
    // eslint-disable-next-line no-new-func
    const api = new Function(...names, `let reactionCountRefreshTimer = null;\nlet reactionRefreshCursor = 0;\n${block('function refreshReactionCounts(')}\n${block('function armReactionCountRefresh(')}\nreturn { refreshReactionCounts, armReactionCountRefresh };`)(...names.map((n) => env[n]));
    api.refreshReactionCounts();
    expect(queued, 'the viewport is not asked about').toEqual(['-100', '100', '700', '900']);
    expect(block('function refreshReactionCounts('), 'nothing reads where the screen is').not.toContain('innerHeight');
    api.armReactionCountRefresh();
    api.armReactionCountRefresh();
    expect(intervals, 'one timer however many bars are built').toBe(1);
    queued.length = 0;
    page.hidden = true;
    listeners.visibilitychange();
    expect(queued).toEqual([]);
    page.hidden = false;
    listeners.visibilitychange();
    expect(queued, 'shown again: asked at once').toEqual(['-100', '100', '700', '900']);
    expect(block('function appendReactionBar(')).toContain('armReactionCountRefresh();');
  });
});
