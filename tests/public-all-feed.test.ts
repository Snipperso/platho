import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import {
  normalizePublicChannelFeed,
  publicChannelsToThreads,
  publicChannelThreadsToFeedItems,
  sortPublicFeedItemsByTime,
  lightPublicFeedJson,
} from '../web/public-channel-subscriptions.mjs';


const RAW = readFileSync('web/app.js', 'utf8');
const html = readFileSync('web/index.html', 'utf8');
const css = readFileSync('web/styles.css', 'utf8');
const fn = (starts: string) => sourceBlock(RAW, starts);

const GLOBALS = new Set(Object.getOwnPropertyNames(globalThis));
function inert(): any {
  const self: any = new Proxy(function () { }, {
    get(_target, key) {
      if (key === Symbol.toPrimitive) return () => '';
      if (key === Symbol.iterator) return function* () { };
      if (key === 'then') return undefined;
      return self;
    },
    apply() { return self; },
    construct() { return self; },
    set() { return true; },
  });
  return self;
}
function inAppScope(sources: string[], exported: string, overrides: Record<string, any>) {
  const scope = new Proxy(overrides, {
    has(target, key) { return typeof key === 'string' && (key in target || !GLOBALS.has(key)); },
    get(target, key) {
      if (key === Symbol.unscopables) return undefined;
      if (typeof key === 'string' && key in target) return (target as any)[key];
      return inert();
    },
    set(target, key, value) { (target as any)[key] = value; return true; },
  });
  // eslint-disable-next-line no-new-func
  return new Function('scope', `with (scope) {\n${sources.join('\n')}\nreturn ${exported};\n}`)(scope);
}
const t = (key: string, params?: any) => `<${key}${params ? ` ${JSON.stringify(params)}` : ''}>`;
const id = (wallet: any) => (wallet ? String(wallet) : null);
const hash = (n: number) => `0x${n.toString(16).padStart(2, '0').repeat(32)}`;
const ARTICLE = Object.freeze({ readMarks: false, offerFollow: true, warmComments: false, keepSharedOriginals: false });

function fakeElement(tag: string): any {
  const el: any = {
    tagName: tag.toUpperCase(), children: [] as any[], dataset: {} as Record<string, string>, attrs: {} as Record<string, string>,
    listeners: {} as Record<string, Array<(event: any) => void>>, className: '', textContent: '', title: '', type: '', disabled: false,
    classList: { add(name: string) { el.className = `${el.className} ${name}`.trim(); }, contains(name: string) { return el.className.split(' ').includes(name); } },
    append(...nodes: any[]) { el.children = el.children.filter((one: any) => !nodes.includes(one)); el.children.push(...nodes); },
    prepend(...nodes: any[]) { el.children = el.children.filter((one: any) => !nodes.includes(one)); el.children.unshift(...nodes); },
    setAttribute(key: string, value: any) { el.attrs[key] = String(value); },
    getAttribute(key: string) { return el.attrs[key] ?? null; },
    addEventListener(type: string, listener: (event: any) => void) { (el.listeners[type] ??= []).push(listener); },
    click() { for (const listener of el.listeners.click ?? []) listener({ target: el, currentTarget: el, stopPropagation() {} }); },
    querySelector() { return null; },
    focus() { el.focused = true; },
  };
  return el;
}
const fakeDocument = { createElement: (tag: string) => fakeElement(tag) };
const actionButtons = (article: any) => article.children[0].children.flatMap((node: any) => (node.className === 'feed-action-tools' ? node.children : [node]));

function passWorld(state: Record<string, any>) {
  const log: string[] = [];
  const scope: any = {
    publicAllFeedRecords: new Map(),
    publicAllFeedCovered: new Set(),
    publicAllFeedLastPassAt: 0,
    publicAllFeedPassAgain: false,
    publicDiscoveryOpen: false,
    isPublicViewActive: () => false,
    PUBLIC_ALL_FEED_WINDOW: 32,
    publicAllFeedPassOutcome: null,
    publicDiscoveryCache: null,
    publicChannelRegistry: [],
    publicChannelMatchesAuthorWallet: (channel: any, wallet: string) => channel.authorWallet === wallet,
    restorePublicAllFeed: async () => { log.push('restored'); },
    cutoverUpdateRequired: () => false,
    publicAllFeedWallets: () => state.wallets,
    waitForAllFeedTurn: async () => { log.push('turn'); },
    savePublicAllFeedRecord: (wallet: string) => { log.push(`save ${wallet}`); },
    schedulePublicAllFeedPaint: () => {},
    persistPublicAllFeedMedia: () => {},
    noteTonRpcRateLimit: (error: any) => error?.rateLimited === true,
    console: { warn: () => {} },
    normalizePublicChannelFeed,
    publicPostPartsFromShardPosts: async (rows: any[], channel: any) => rows.map((row: any) => ({
      id: `pshard-${channel.id}-${row.entry_id}`, entryId: `100.0.${row.entry_id}`, bodyHash: hash(row.entry_id), entryUid: `u${row.entry_id}`,
      text: row.text, createdAt: row.at, authorWallet: channel.authorWallet, chainVerified: true,
    })),
    assemblePublicParts: (parts: any[]) => parts,
    directPublicLaneReader: () => ({
      probeChannelHeads: async (wallets: string[], options: any) => {
        log.push(`probe ${wallets.join(',')} ${options.requestOptions.priority}/${options.requestOptions.skipIfRateLimited}`);
        return state.heads;
      },
      readChannelHead: async (wallet: string, shard: any, options: any) => {
        log.push(`read ${wallet}:${shard.key} ${options.requestOptions.priority}/${options.requestOptions.skipIfRateLimited} held:${options.heldCount}`);
        const answer = state.reads[`${wallet}:${shard.key}`];
        if (answer instanceof Error) throw answer;
        return answer;
      },
    }),
    ...state.scope,
  };
  const sources = ['async function publicAllFeedPassBody(', 'function publicAllFeedRequestOptions(', 'function publicTabReadClass(', 'function publicAllFeedRecordFor(',
    'function publicAllFeedChannelId(', 'function publicAllFeedPosts(', 'function publicFeedPostHasChainAnchor(', 'function mergePublicAllFeedWindow(',
    'function forgetUnlistedPublicAllFeedRecords(',
    'function applyHiddenBitmaps(', 'function publicItemCoordinates(', 'function sharedPostShardCoordinates('].map(fn);
  const pass = inAppScope(sources, 'publicAllFeedPassBody', scope);
  return { scope, log, pass };
}
const shard = (key: string, era: number, marker: string, lastLt = '1') => ({ key, address: key, era, epochTag: String(era), seq: 0, generation: 17, marker, lastLt });
const heldShard = (key: string, marker: string | null, posts: any[] = []) => ({ key, marker, era: 1, epochTag: '1', seq: 0, generation: 17, posts });
const row = (entry: number, text: string, at: string) => ({ entry_id: entry, text, at });

describe('THE ALL FEED — every channel\'s posts, kept on the device, read where they moved', () => {
  it('ALLFEED-01: a pass reads only what moved — the channel checked longest ago first — pays only for new rows, and lets the rotation go', async () => {
    const held = (key: string, marker: string | null, entryCount: number | null, posts: any[] = []) => ({ ...heldShard(key, marker, posts), entryCount });
    const oldPost = (entry: number, at: string) => ({ id: `pshard-wallet:A-${entry}`, entryId: `100.0.${entry}`, bodyHash: hash(entry), entryUid: `u${entry}`, text: `a${entry}`, createdAt: at });
    const heldA = { channelId: 'wallet:A', at: 1, checkedAt: 50, memo: null, shards: new Map<string, any>([
      ['a1', held('a1', 'm1', 4, [{ id: 'kept' }])],
      ['a0', held('a0', 'o0', 5, [oldPost(4, '2026-09-18T10:00:00.000Z')])],
      ['gone', held('gone', 'g', 1, [{ id: 'old' }])],
    ]) };
    const heldB = { channelId: 'wallet:B', at: 1, memo: null, shards: new Map([['b1', held('b1', 'x', 1)]]) };
    const heldE = { channelId: 'wallet:E', at: 1, checkedAt: 60, memo: null, shards: new Map([['e1', held('e1', 'q0', 3, [{ id: 'e-kept' }])]]) };
    const { scope, log, pass } = passWorld({
      wallets: ['A', 'B', 'C', 'D', 'E', 'G'],
      heads: new Map<string, any>([
        ['A', { shards: [shard('a1', 10, 'm1', '5'), shard('a0', 9, 'o1', '5')], unknown: false }],
        ['B', { shards: [], unknown: true }],
        ['C', { shards: [shard('c1', 10, 'x1', '30')], unknown: false }],
        ['D', { shards: [shard('d1', 10, 'y1', '40')], unknown: false }],
        ['E', { shards: [shard('e1', 10, 'q1', '50')], unknown: false }],
        ['G', { shards: [shard('g1', 10, 'z1', '10')], unknown: false }],
      ]),
      reads: {
        'D:d1': { posts: [row(1, 'd one', '2026-09-20T10:00:00.000Z')], entryCount: 1, fresh: null, unchanged: false },
        'C:c1': { posts: [], entryCount: 3, fresh: null, unchanged: false },
        'A:a0': { posts: [row(5, 'a five', '2026-09-19T10:00:00.000Z'), row(6, 'a six', '2026-09-21T10:00:00.000Z')], entryCount: 7, fresh: 2, unchanged: false },
        'E:e1': { posts: [], entryCount: 3, fresh: 0, unchanged: true },
        'G:g1': { posts: [row(8, 'g eight', '2026-09-22T10:00:00.000Z')], entryCount: 10, fresh: null, unchanged: false },
      },
    });
    scope.publicAllFeedRecords.set('A', heldA);
    scope.publicAllFeedRecords.set('B', heldB);
    scope.publicAllFeedRecords.set('E', heldE);
    const eShard = heldE.shards.get('e1');
    const ePosts = eShard.posts;
    await pass();
    const reads = log.filter((line) => line.startsWith('read'));
    expect(reads, 'never checked first (the most recently written among them), then the longest ago; only what moved').toEqual([
      'read D:d1 idle/true held:null', 'read C:c1 idle/true held:null', 'read G:g1 idle/true held:null',
      'read A:a0 idle/true held:5', 'read E:e1 idle/true held:3',
    ]);
    expect(log.slice(0, 3)).toEqual(['restored', 'turn', 'probe A,B,C,D,E,G idle/true']);
    expect(log.filter((line) => line === 'turn').length, 'the turn before the probe and before every read').toBe(1 + reads.length);
    expect([...heldA.shards.keys()].sort(), 'the shard that left the window is gone').toEqual(['a0', 'a1']);
    expect(heldA.shards.get('a1').posts, 'the unchanged shard is untouched').toEqual([{ id: 'kept' }]);
    expect(heldB.shards.get('b1').marker, 'an unknown head keeps what was held').toBe('x');
    expect(heldA.shards.get('a0').posts.map((post: any) => post.text), 'held + new, by time').toEqual(['a4', 'a five', 'a six']);
    expect([heldA.shards.get('a0').marker, heldA.shards.get('a0').entryCount]).toEqual(['o1', 7]);
    expect([heldE.shards.get('e1').marker, heldE.shards.get('e1').posts]).toEqual(['q1', [{ id: 'e-kept' }]]);
    expect(heldE.shards.get('e1'), 'the same shard, not a rebuilt one').toBe(eShard);
    expect(heldE.shards.get('e1').posts).toBe(ePosts);
    expect(heldE.at, 'the record is not marked changed').toBe(1);
    const g = scope.publicAllFeedRecords.get('G').shards.get('g1');
    expect([g.posts.map((post: any) => post.text), g.marker, g.entryCount]).toEqual([['g eight'], null, null]);
    expect(scope.publicAllFeedRecords.get('C')?.shards.size ?? 0, 'rows without bodies write nothing').toBe(0);
    expect(scope.publicAllFeedRecords.get('D').shards.get('d1').posts.map((post: any) => post.text)).toEqual(['d one']);
    expect([...scope.publicAllFeedCovered].sort()).toEqual(['A', 'C', 'D', 'E', 'G']);
    expect(scope.publicAllFeedPassOutcome, 'B was not measured: the pass says so').toMatchObject({ asked: 6, measured: 5, cut: 'unmeasured' });
    expect(scope.publicAllFeedLastPassAt, 'stamped at the probe').toBeGreaterThan(0);
    expect(log.filter((line) => line.startsWith('save')), 'the prune, the new rows, the moved marker and every answer are saved').toEqual(['save A', 'save D', 'save G', 'save A', 'save E']);
    expect(scope.publicAllFeedRecords.get('A').checkedAt, 'checking moves a channel to the back').toBeGreaterThan(60);
  });

  it('ALLFEED-02: the lowest class off All, the background class on it; a rate limit ends the pass and says so; every shard that moved is read; the probe refused is recorded', async () => {
    const limited = Object.assign(new Error('429'), { rateLimited: true, retryAfterMs: 7_000 });
    const heads = new Map<string, any>([
      ['C', { shards: [shard('c1', 10, 'x1', '30')], unknown: false }],
      ['D', { shards: [shard('d1', 10, 'y1', '40')], unknown: false }],
    ]);
    const empty = { posts: [], entryCount: 0, fresh: null, unchanged: false };
    const stopped = passWorld({ wallets: ['C', 'D'], heads, reads: { 'D:d1': limited, 'C:c1': { posts: [row(1, 'c', '2026-09-20T10:00:00.000Z')], entryCount: 1, fresh: null, unchanged: false } } });
    await stopped.pass();
    expect(stopped.log.filter((line) => line.startsWith('read')), 'nothing after the limit').toEqual(['read D:d1 idle/true held:null']);
    expect(stopped.scope.publicAllFeedPassOutcome, 'cut short, with the wait the transport asked for').toMatchObject({ cut: 'rate', retryAfterMs: 7_000 });
    expect(stopped.scope.publicAllFeedLastPassAt, 'a pass that stopped is still a pass (the pace applies to it)').toBeGreaterThan(0);
    const offScreen = passWorld({ wallets: ['C', 'D'], heads, reads: { 'D:d1': empty, 'C:c1': empty } });
    await offScreen.pass();
    expect(offScreen.log.filter((line) => line.startsWith('probe') || line.startsWith('read')), 'off screen: no budget, the idle class').toEqual([
      'probe C,D idle/true', 'read D:d1 idle/true held:null', 'read C:c1 idle/true held:null',
    ]);
    expect(offScreen.scope.publicAllFeedPassOutcome).toMatchObject({ cut: null, read: 2 });
    const onAll = passWorld({ wallets: ['C', 'D'], heads, reads: { 'D:d1': empty, 'C:c1': empty }, scope: { publicDiscoveryOpen: true } });
    await onAll.pass();
    expect(onAll.log.filter((line) => line.startsWith('probe') || line.startsWith('read')), 'on All: the background class — level with the messages, never above them').toEqual([
      'probe C,D background/true', 'read D:d1 background/true held:null', 'read C:c1 background/true held:null',
    ]);
    expect(onAll.scope.publicAllFeedPassOutcome.cut, 'a pass that read everything is whole').toBeNull();
    const refused = passWorld({ wallets: ['C'], heads, reads: {}, scope: {} });
    refused.scope.directPublicLaneReader = () => ({ probeChannelHeads: async () => { throw limited; }, readChannelHead: async () => { throw new Error('no read expected'); } });
    await refused.pass();
    expect(refused.scope.publicAllFeedPassOutcome).toMatchObject({ cut: 'rate', retryAfterMs: 7_000, measured: 0 });
    const blocked = passWorld({ wallets: ['C'], heads, reads: {}, scope: { cutoverUpdateRequired: () => true } });
    await blocked.pass();
    expect(blocked.log.filter((line) => !line.startsWith('restored')), 'a build that must update reads nothing').toEqual([]);
    const options = (open: boolean) => inAppScope([fn('function publicAllFeedRequestOptions('), fn('function publicTabReadClass(')], 'publicAllFeedRequestOptions',
      { publicDiscoveryOpen: open, isPublicViewActive: () => true })();
    expect(options(true)).toEqual({ priority: 'background', skipIfRateLimited: true });
    expect(options(false), 'All not on screen — the Following section open, or another tab').toEqual({ priority: 'idle', skipIfRateLimited: true });
  });

  it('ALLFEED-03: a pass is asked for when due — first, stale, forced, or new channels no closer than the spacing — never while locked; a forced request mid-pass stays forced', () => {
    const run = (state: Record<string, any>) => {
      let runs = 0;
      const timers: number[] = [];
      const scope: any = {
        publicAllFeedPassRun: null, publicAllFeedPassAgain: false, publicAllFeedPassAgainForce: false, publicDiscoveryOpen: false,
        PUBLIC_ALL_FEED_TTL_MS: 300_000, PUBLIC_ALL_FEED_MIN_SPACING_MS: 30_000, publicAllFeedSpacingTimer: 0,
        setTimeout: (_fire: () => void, wait: number) => { timers.push(wait); return timers.length; },
        publicAllFeedLastPassAt: Date.now() - 60_000, publicAllFeedCovered: new Set(['A']),
        publicAllFeedWallets: () => ['A'],
        walletLockedOnDevice: () => false,
        runPublicAllFeedPass: () => { runs += 1; return 'run'; },
        ...state,
      };
      const request = inAppScope([fn('function requestPublicAllFeedPass(')], 'requestPublicAllFeedPass', scope);
      return { answer: request(state.args), runs, scope, timers };
    };
    expect(run({}).runs, 'a minute old, nothing new: not due').toBe(0);
    expect(run({ publicAllFeedLastPassAt: 0 }).runs, 'never ran').toBe(1);
    expect(run({ args: { force: true } }).runs, 'the sync button').toBe(1);
    expect(run({ publicAllFeedWallets: () => ['A', 'B'] }).runs, 'the sweep brought a channel').toBe(1);
    const soon = run({ publicAllFeedWallets: () => ['A', 'B'], publicAllFeedLastPassAt: Date.now() - 10_000 });
    expect(soon.runs, '...but not ten seconds after the last pass').toBe(0);
    expect(soon.timers.length).toBe(1);
    expect(soon.timers[0]).toBeGreaterThan(19_000);
    expect(soon.timers[0]).toBeLessThanOrEqual(20_000);
    expect(run({ publicAllFeedWallets: () => ['A', 'B'], publicAllFeedLastPassAt: Date.now() - 10_000, publicAllFeedSpacingTimer: 3 }).timers, 'one ask waiting at a time').toEqual([]);
    expect(run({}).timers, 'nothing new: nothing asked').toEqual([]);
    expect(run({ publicAllFeedLastPassAt: Date.now() - 400_000 }).runs, 'off screen, 400 s is stale').toBe(1);
    expect(run({ publicAllFeedLastPassAt: Date.now() - 400_000, publicDiscoveryOpen: true }).runs, 'on All, 400 s is stale').toBe(1);
    expect(run({ publicAllFeedLastPassAt: 0, walletLockedOnDevice: () => true }).runs, 'never behind the unlock prompt').toBe(0);
    const busy = run({ publicAllFeedPassRun: 'running', publicAllFeedLastPassAt: 0, args: { force: true } });
    expect([busy.runs, busy.answer, busy.scope.publicAllFeedPassAgain, busy.scope.publicAllFeedPassAgainForce], 'one at a time: carried out after, still forced')
      .toEqual([0, 'running', true, true]);
  });

  it('ALLFEED-03B: a pass cut short is asked again on the ladder, after the transport\'s wait, on All or off it; a whole one, or one that read something, starts the ladder over', () => {
    const timers: Array<{ wait: number; fire: () => void }> = [];
    const asked: any[] = [];
    const ladder = JSON.parse(RAW.match(/const PUBLIC_ALL_FEED_RETRY_LADDER_MS = (\[[^\]]*\]);/)![1].replace(/_/g, ''));
    expect(ladder).toEqual([4_000, 12_000, 30_000, 60_000, 120_000, 300_000, 600_000]);
    const seenListeners = new Set<() => void>();
    const page: any = {
      visibilityState: 'visible',
      addEventListener: (type: string, listener: () => void) => { if (type === 'visibilitychange') seenListeners.add(listener); },
      removeEventListener: (type: string, listener: () => void) => { if (type === 'visibilitychange') seenListeners.delete(listener); },
    };
    const scope: any = {
      publicAllFeedPassOutcome: { cut: 'rate', retryAfterMs: 20_000 },
      publicDiscoveryOpen: true,
      publicAllFeedRetryAttempt: 0,
      publicAllFeedRetryTimer: 0,
      PUBLIC_ALL_FEED_RETRY_LADDER_MS: ladder,
      globalThis: { document: page }, document: page,
      setTimeout: (fire: () => void, wait: number) => { timers.push({ wait, fire }); return timers.length; },
      requestPublicAllFeedPass: (options: any) => { asked.push(options); },
    };
    const retry = inAppScope([fn('function schedulePublicAllFeedRetry('), fn('function whenPageSeen(run) {')], 'schedulePublicAllFeedRetry', scope);
    retry();
    expect(timers.map((timer) => timer.wait), 'the transport asked for 20 s: not sooner').toEqual([20_000]);
    retry();
    expect(timers.length, 'one retry in flight at a time').toBe(1);
    timers[0].fire();
    expect(asked).toEqual([{ force: true }]);
    scope.publicAllFeedPassOutcome = { cut: 'unmeasured', retryAfterMs: 0 };
    retry();
    retry();
    expect(timers.map((timer) => timer.wait), 'the ladder climbs').toEqual([20_000, 12_000]);
    for (let rung = 2; rung < ladder.length; rung += 1) {
      timers.at(-1)!.fire();
      retry();
    }
    expect(timers.map((timer) => timer.wait), '[round 24 — F5-1] on to ten minutes').toEqual([20_000, ...ladder.slice(1)]);
    timers.at(-1)!.fire();
    retry();
    expect(timers.length, 'MEASURED before: after the last rung the pass waited for the five-minute interval').toBe(ladder.length + 1);
    expect(timers.at(-1)!.wait).toBe(600_000);
    expect(asked.length).toBe(ladder.length);
    page.visibilityState = 'hidden';
    timers.at(-1)!.fire();
    expect([asked.length, seenListeners.size], 'hidden: nothing asked, one wait for the page').toEqual([ladder.length, 1]);
    page.visibilityState = 'visible';
    for (const listener of [...seenListeners]) listener();
    expect([asked.length, seenListeners.size], 'seen again: asked once, the wait gone').toEqual([ladder.length + 1, 0]);
    scope.publicAllFeedPassOutcome = { cut: null };
    retry();
    expect(scope.publicAllFeedRetryAttempt, 'a whole pass starts the ladder over').toBe(0);
    scope.publicDiscoveryOpen = false;
    scope.publicAllFeedPassOutcome = { cut: 'rate', retryAfterMs: 0 };
    retry();
    expect(timers.at(-1)!.wait, 'off All: asked again on the ladder').toBe(ladder[0]);
    timers.at(-1)!.fire();
    expect(asked.at(-1), 'and asked as on All').toEqual({ force: true });
    scope.publicAllFeedRetryAttempt = 5;
    scope.publicAllFeedPassOutcome = { cut: 'rate', retryAfterMs: 0, read: 3 };
    retry();
    expect(timers.at(-1)!.wait).toBe(ladder[0]);
  });

  it('ALLFEED-04: the device copy — a record read back is the record written, light; another format, another channel id or a damaged shard cost only themselves', async () => {
    let written = '';
    const records = new Map<string, any>();
    const scope: any = {
      publicAllFeedRecords: records,
      PUBLIC_ALL_FEED_FORMAT: 1,
      lightPublicFeedJson,
      normalizePublicChannelFeed,
      publicChannelRegistry: [],
      publicChannelMatchesAuthorWallet: () => false,
      publicAllFeedStore: () => Promise.resolve({ put: (_key: string, text: string) => { written = text; }, delete: () => {} }),
    };
    const post = { id: 'pshard-wallet:W-1', entryId: '100.0.1', bodyHash: hash(1), entryUid: 'u1', text: 'hello', createdAt: '2026-09-20T10:00:00.000Z',
      blocks: [{ type: 'text', text: 'hello' }, { type: 'image', url: 'data:image/png;base64,AAAA' }], chainVerified: true };
    records.set('W', { channelId: 'wallet:W', at: 7, memo: null, shards: new Map([['k1', { key: 'k1', marker: 'm', era: 9, epochTag: '9', seq: 0, generation: 17, posts: [post] }]]) });
    const save = inAppScope([fn('function savePublicAllFeedRecord(')], 'savePublicAllFeedRecord', scope);
    save('W');
    await new Promise((resolve) => setTimeout(resolve, 0));
    {
      expect(written, 'the image stays out of the record (its own store holds it)').not.toContain('data:image');
      const read = inAppScope([fn('function publicAllFeedRecordFromText('), fn('function publicAllFeedChannelId('), fn('function publicAllFeedPosts('), fn('function publicFeedPostHasChainAnchor(')], 'publicAllFeedRecordFromText', scope);
      const back = read('W', written);
      expect(back.channelId).toBe('wallet:W');
      expect(back.shards.get('k1').marker).toBe('m');
      expect(back.shards.get('k1').posts.map((p: any) => [p.text, p.chainVerified]), 'kept, not read this session').toEqual([['hello', false]]);
      expect(read('W', written.replace('"v":1', '"v":2')), 'another recipe: read again').toBeNull();
      scope.publicChannelRegistry = [{ id: 'platho.app', authorWallet: 'W' }];
      scope.publicChannelMatchesAuthorWallet = (channel: any, wallet: string) => channel.authorWallet === wallet;
      expect(read('W', written), 'the channel is registered under another id now: its post ids would lie').toBeNull();
      scope.publicChannelRegistry = [];
      const damaged = JSON.parse(written);
      damaged.shards.push({ key: 'k2', posts: 'not a list' }, { key: '', posts: [] });
      const partial = read('W', JSON.stringify(damaged));
      expect([...partial.shards.keys()], 'a damaged shard costs itself').toEqual(['k1', 'k2']);
      expect(partial.shards.get('k2').posts).toEqual([]);
      expect(read('W', '{nope'), 'unreadable text is nothing').toBeNull();
      expect(back.shards.get('k1').posts[0].blocks.map((block: any) => block.type)).toEqual(['text', 'image']);
    }
  });

  it('ALLFEED-05: a start restores every record — one bad post takes nothing else down — and a picture no longer kept waits to be looked at', async () => {
    const make = (entry: number, withImage: boolean) => ({ id: `pshard-wallet:W-${entry}`, entryId: `100.0.${entry}`, bodyHash: hash(entry), entryUid: `u${entry}`, text: `t${entry}`,
      createdAt: '2026-09-20T10:00:00.000Z', blocks: withImage ? [{ type: 'image', url: 'data:image/png;base64,AAAA' }] : [{ type: 'text', text: `t${entry}` }] });
    const legacy = { id: 'pshard-wallet:W-4', entryId: '100.0.4', bodyHash: hash(4), entryUid: 'u4', text: '', createdAt: '2026-09-20T10:00:00.000Z', imageUrl: 'data:image/png;base64,CCCC', hasMedia: true };
    const text = lightPublicFeedJson({ v: 1, at: 5, channelId: 'wallet:W', shards: [
      { key: 'hasImage', marker: 'm1', entryCount: 7, era: 9, epochTag: '9', seq: 0, generation: 17, posts: [make(1, true)] },
      { key: 'lostImage', marker: 'm2', entryCount: 3, era: 9, epochTag: '9', seq: 1, generation: 17, posts: [make(2, true)] },
      { key: 'textOnly', marker: 'm3', entryCount: null, era: 9, epochTag: '9', seq: 2, generation: 17, posts: [make(3, false), legacy] },
    ] });
    const poisoned = JSON.stringify({ v: 1, at: 5, channelId: 'wallet:P', shards: [{ key: 'p', marker: 'mp', posts: [
      { id: 'bad', entryId: '100.0.9', bodyHash: hash(9), entryUid: 'u9', text: 'x', blocks: {} },
      { ...make(8, false), id: 'pshard-wallet:P-8' },
    ] }] });
    let repainted = 0;
    const scope: any = {
      publicAllFeedRestore: null,
      publicAllFeedRestored: false,
      publicAllFeedRecords: new Map(),
      publicAllFeedMediaSaved: new Set(),
      publicDiscoveryOpen: true,
      PUBLIC_ALL_FEED_FORMAT: 1,
      normalizePublicChannelFeed,
      publicChannelRegistry: [],
      publicChannelMatchesAuthorWallet: () => false,
      publicAllFeedStore: async () => ({ getAll: async () => new Map([['W', text], ['broken', '{'], ['P', poisoned]]) }),
      publicAllFeedMediaStore: async () => ({ getMany: async (keys: string[]) => new Map(keys.filter((key) => key.endsWith('-1') || key.endsWith('-4')).map((key) => [key,
        JSON.stringify(key.endsWith('-4') ? { imageUrl: 'data:image/png;base64,DDDD', blocks: null } : { imageUrl: null, blocks: [{ type: 'image', url: 'data:image/png;base64,BBBB' }] })])) }),
      repaintPublicDiscovery: () => { repainted += 1; },
    };
    const restore = inAppScope(['function restorePublicAllFeed(', 'function publicAllFeedRecordFromText(', 'function publicAllFeedChannelId(', 'function publicAllFeedPosts(',
      'function publicFeedPostHasChainAnchor(', 'function applyPublicPostMediaRecord(', 'function publicPostRenderableImageMedia(', 'function publicPostCacheKey('].map(fn), 'restorePublicAllFeed', scope);
    await restore();
    const record = scope.publicAllFeedRecords.get('W');
    expect([...scope.publicAllFeedRecords.keys()].sort(), 'a broken record costs only itself').toEqual(['P', 'W']);
    expect(scope.publicAllFeedRecords.get('P').shards.get('p').posts.map((post: any) => post.id), 'a post whose body is not a list is dropped, its neighbour kept')
      .toEqual(['pshard-wallet:P-8']);
    expect(record.shards.get('hasImage').posts[0].blocks[0].url, 'the image back from its store').toBe('data:image/png;base64,BBBB');
    expect([record.shards.get('hasImage').marker, record.shards.get('hasImage').entryCount], 'with the count it was read at').toEqual(['m1', 7]);
    expect(record.shards.get('lostImage').marker, 'its image is gone: the marker STAYS (no re-read at start)').toBe('m2');
    expect(record.shards.get('lostImage').mediaMissing, '...the window that draws it asks for it').toBe(true);
    expect(record.shards.get('textOnly').posts.find((post: any) => post.id.endsWith('-4')).imageUrl, 'a legacy picture comes back too').toBe('data:image/png;base64,DDDD');
    expect(record.shards.get('textOnly').mediaMissing).toBeUndefined();
    expect(scope.publicAllFeedRestored).toBe(true);
    expect(repainted, 'All on screen repaints with what came back').toBe(1);
    expect(restore(), 'once per session').toBe(restore());
    const broken: any = { ...scope, publicAllFeedRestore: null, publicAllFeedRestored: false, publicAllFeedRecords: new Map(),
      publicAllFeedStore: async () => ({ getAll: async () => { throw new Error('blocked'); } }) };
    const restoreBroken = inAppScope(['function restorePublicAllFeed(', 'function publicAllFeedRecordFromText('].map(fn), 'restorePublicAllFeed', broken);
    await expect(restoreBroken()).resolves.toBeUndefined();
    expect(broken.publicAllFeedRestored).toBe(true);
  });

  it('ALLFEED-06: the window — merged newest first from the Following feed and the listed records, only what it reaches is built, moderation once per author', () => {
    const post = (wallet: string, entry: number, at: string, extra: any = {}) => ({ id: `pshard-wallet:${wallet}-${entry}`, entryId: `100.0.${entry}`, bodyHash: hash(entry), entryUid: `u${entry}`,
      text: `${wallet}${entry}`, createdAt: at, authorWallet: wallet, chainVerified: false, ...extra });
    const record = (wallet: string, posts: any[]) => ({ channelId: `wallet:${wallet}`, at: 1, memo: null, shards: new Map([[wallet.toLowerCase(), heldShard(wallet.toLowerCase(), 'm', posts)]]) });
    const records = new Map<string, any>([
      ['S', record('S', [post('S', 2, '2026-09-21T10:00:00.000Z'), post('S', 1, '2026-09-18T10:00:00.000Z')])],
      ['X', record('X', [post('X', 1, '2026-09-23T10:00:00.000Z')])],
      ['F', record('F', [post('F', 5, '2026-09-19T10:00:00.000Z')])],
      ['M', record('M', [post('M', 1, '2026-09-24T10:00:00.000Z')])],
      ['H', record('H', [post('H', 1, '2026-09-20T10:00:00.000Z', { hidden: true }), post('H', 2, '2026-09-17T10:00:00.000Z')])],
      ['O', record('O', [post('O', 1, '2026-09-10T10:00:00.000Z')])],
    ]);
    const following = [{ id: 'follow-F5', channelId: 'wallet:F', entryId: '100.0.5', createdAt: '2026-09-19T10:00:00.000Z', text: 'from the Following feed', authorWallet: 'F' }];
    let label = 'plain';
    const moderated: string[] = [];
    const scope: any = {
      publicAllFeedRecords: records,
      publicSurfaceItems: () => following,
      publicDiscoveryResults: ['S', 'F', 'M', 'H', 'O'].map((authorWallet) => ({ authorWallet })),
      publicDiscoveryCache: null,
      publicDiscoverySaved: null,
      rawWalletAddress: id,
      publicDiscoveryFollowedWallets: () => new Set(['F']),
      isOwnPublicAuthor: () => false,
      publicChannelVisibleUnderModeration: ({ authorWallet }: any) => { moderated.push(authorWallet); return authorWallet !== 'M'; },
      publicItemAuthor: (item: any) => item.authorWallet,
      publicChannelRegistry: [],
      applyContactDisplayToRegistryChannel: (channel: any) => channel,
      publicAuthorLabel: (wallet: string) => `${label}-${wallet}`,
      publicChannelsToThreads, publicChannelThreadsToFeedItems,
    };
    const windowOf = inAppScope(['function publicAllFeedWindow(', 'function publicAllFeedRecordItems(', 'function publicAllFeedCatalogue(', 'function publicPostIdentity(',
      'function publicAllFeedRecordNewestMs('].map(fn), 'publicAllFeedWindow', scope);
    const two = windowOf(2);
    expect(two.items.map((item: any) => item.text), 'the newest two').toEqual(['from the Following feed', 'S2']);
    expect(two.more, 'there is more below').toBe(true);
    expect(two.reached.map((reached: any) => reached.channelId).sort(), 'only the records the window reached were built (O never)').toEqual(['wallet:H', 'wallet:S']);
    expect(records.get('O').memo, 'a record the window does not reach costs nothing').toBeNull();
    moderated.length = 0;
    const all = windowOf(10);
    expect(all.items.map((item: any) => item.text), 'oldest first; X unlisted, M muted, H\'s hidden post out; F once, from the Following feed')
      .toEqual(['O1', 'H2', 'S1', 'from the Following feed', 'S2']);
    expect(new Set(moderated).size, 'moderation asked once per author, not once per post').toBe(moderated.length);
    expect(windowOf(10, (item: any) => item.text.startsWith('S')).items.map((item: any) => item.text), 'the search filters inside the window').toEqual(['S1', 'S2']);
    expect(all.items.find((item: any) => item.text === 'S2').meta[0]).toBe('plain-S');
    const memo = records.get('S').memo.items;
    windowOf(10);
    expect(records.get('S').memo.items).toBe(memo);
    label = 'chosen';
    expect(windowOf(10).items.find((item: any) => item.text === 'S2').meta[0], 'a name chosen with "Display as" reaches the posts').toBe('chosen-S');
    scope.publicDiscoveryResults = null;
    expect(windowOf(10).items.map((item: any) => item.text), 'with no catalogue known, what the device holds is shown').toContain('X1');
  });

  it('ALLFEED-07: the painter — the article without read marks, lines that say what is true, the reader\'s place kept, a missing picture asked for', async () => {
    const run = (state: Record<string, any>) => {
      const built: any[] = [];
      const signatures: any[] = [];
      const reads: string[] = [];
      const corner: any[] = [];
      const asked: any[] = [];
      let entries: any[] = [];
      const feed: any = { children: [], scrollTop: 0, getBoundingClientRect: () => ({ top: 0 }), contains: () => false };
      const scope: any = {
        document: { ...fakeDocument, activeElement: null, body: {} },
        publicAllFeed: feed,
        publicDiscoveryPaintMode: { loading: false, error: false },
        publicDiscoveryQuery: '',
        publicDiscoveryProgress: null,
        publicAllFeedPassRun: null,
        walletLockedOnDevice: () => false,
        publicAllFeedRestore: null,
        publicAllFeedRestored: true,
        publicAllFeedPassOutcome: null,
        publicAllFeedShownCap: 60,
        PUBLIC_ALL_FEED_PAGE: 60,
        PUBLIC_ALL_FEED_ARTICLE: ARTICLE,
        publicAllFeedSurfacedIds: new Map(),
        publicAllFeedSearchText: new WeakMap(),
        rawWalletAddress: id,
        t,
        currentLocale: () => 'en',
        publicAllFeedCatalogue: () => [{ authorWallet: 'S', description: 'cooking every day', tags: [] }],
        publicAllFeedWindow: (limit: number, matches: any) => {
          const visible = (state.items ?? []).filter((item: any) => !matches || matches(item));
          const newestFirst = visible.slice().reverse();
          return { items: newestFirst.slice(0, limit).reverse(), more: newestFirst.length > limit, reached: state.reached ?? [] };
        },
        publicFeedItemSearchHaystack: (item: any) => String(item.text).toLowerCase(),
        publicFeedItemRenderSignature: (item: any, _memo: any, options: any) => { signatures.push(options); return `sig-${item.id}`; },
        buildPublicFeedArticle: (item: any, _memo: any, options: any) => { built.push(options); const el = fakeElement('article'); el.textContent = item.text; return el; },
        surfaceRow: () => false,
        buildSkeletonNode: () => { const el = fakeElement('div'); el.className = 'skeleton'; return el; },
        reconcileKeyedRows: (_container: any, rows: any[]) => { entries = rows; },
        refreshGlobalSyncIndicator: () => { corner.push(scope.publicDiscoveryPaintMode.loading); },
        requestPublicAllFeedPass: (options: any) => { asked.push(options); },
        holdPublicFeedPainted: () => reads.push('hold'),
        markVisiblePublicFeedRead: () => reads.push('mark'),
        ...state.scope,
      };
      const paint = inAppScope(['function renderPublicDiscovery(', 'function allSectionLoading(', 'function discoveryChannelMatches(', 'function buildPublicAllFeedNote(', 'function publicFeedRetryButton(', 'function buildPublicAllFeedOlderButton('].map(fn), 'renderPublicDiscovery', scope);
      paint(state.options ?? {});
      const nodes = entries.map((entry) => ({ key: entry.key, node: entry.build() }));
      return { entries, nodes, built, signatures, reads, scope, corner, asked };
    };
    const items = [
      { id: 'a', text: 'Soup recipe', authorWallet: 'S' },
      { id: 'c', text: 'News today', authorWallet: 'N' },
    ];
    const plain = run({ items });
    expect(plain.entries.map((entry) => entry.key), 'newest on top').toEqual(['c', 'a']);
    expect(plain.built.every((options) => options === ARTICLE), 'drawn with the All feed\'s options: no read marks, Follow, nothing kept').toBe(true);
    expect(plain.signatures.every((options) => options === ARTICLE)).toBe(true);
    expect(plain.reads, 'All never moves a read position').toEqual([]);
    expect(plain.corner, 'every paint tells the corner, after the section state it painted').toEqual([false]);
    expect(run({ items, scope: { publicDiscoveryQuery: 'news' } }).entries.map((entry) => entry.key)).toEqual(['c']);
    expect(run({ items, scope: { publicDiscoveryQuery: 'cooking' } }).entries.map((entry) => entry.key), 'the description finds the channel\'s posts').toEqual(['a']);
    const noteOf = (result: any) => result.nodes.find((entry: any) => entry.key === 'note')?.node.children.map((child: any) => child.textContent);
    const looking = run({ items: [], scope: { publicAllFeedPassRun: 'running' } });
    expect(looking.entries.map((entry) => entry.key), 'still looking: two skeletons and the line').toEqual(['skeleton:0', 'skeleton:1', 'note']);
    expect(noteOf(looking)).toEqual(['<public.allFeedLoading>', '<common.checking>']);
    expect(noteOf(run({ items: [], scope: { publicAllFeedRestore: Promise.resolve(), publicAllFeedRestored: false } })), 'the device\'s copy not read back yet: not a conclusion')
      .toEqual(['<public.allFeedLoading>', '<common.checking>']);
    const failed = run({ items: [], options: { error: true } });
    expect(noteOf(failed), 'a list that failed reached no conclusion').toEqual(['<public.feedUnavailable>', '<public.feedUnavailableHint>', '<common.retry>']);
    const retry = failed.nodes.find((entry: any) => entry.key === 'note').node.children.at(-1);
    retry.click();
    expect([failed.asked, retry.disabled], 'the press asks a pass at once, and once').toEqual([[{ force: true }], true]);
    expect(noteOf(run({ items: [], scope: { publicAllFeedPassOutcome: { cut: 'rate' } } })), 'nor did a pass cut short by a rate limit').toEqual(['<public.feedUnavailable>', '<public.feedUnavailableHint>', '<common.retry>']);
    expect(noteOf(run({ items: [] })), 'only a finished read may say there are none').toEqual(['<public.allFeedEmpty>', '<public.allFeedEmptyHint>']);
    expect(noteOf(run({ items, scope: { publicDiscoveryQuery: 'zzz' } }))).toEqual(['<public.noPostsFound>', '<public.tryAnotherSearch>']);
    expect(noteOf(run({ items, scope: { publicDiscoveryQuery: 'zzz', publicAllFeedPassRun: 'running' } })), '"nothing found" waits for the reading too').toEqual(['<public.allFeedLoading>', '<common.checking>']);
    const more = run({ items, scope: { publicDiscoveryProgress: { done: 1, total: 5 } } });
    expect(more.nodes.at(-1).node.textContent, 'posts on screen and the sweep still going: said under them').toBe('<public.allFeedLoadingMore>');
    expect(run({ items, scope: { publicDiscoveryQuery: 'news', publicDiscoveryProgress: { done: 1, total: 5 } } }).nodes.at(-1).node.textContent, '...under search results too').toBe('<public.allFeedLoadingMore>');
    expect(run({ items, options: { error: true } }).nodes.at(-1).node.textContent, 'posts from the device, and a list that failed').toBe('<public.allFeedStale>');
    expect(run({ items, scope: { publicAllFeedPassOutcome: { cut: 'unmeasured' } } }).nodes.at(-1).node.textContent, '...or a pass cut short').toBe('<public.allFeedStale>');
    const many = Array.from({ length: 65 }, (_, i) => ({ id: `p${i}`, text: `post ${i}`, authorWallet: 'S' }));
    const windowed = run({ items: many });
    expect(windowed.entries.length).toBe(61);
    expect(windowed.entries[0].key, 'the newest first').toBe('p64');
    expect(windowed.entries.at(-1).key).toBe('older');
    windowed.nodes.at(-1).node.click();
    expect(windowed.scope.publicAllFeedShownCap, 'another page').toBe(120);
    const anchored = run({ items: many, scope: { publicAllFeed: { scrollTop: 40, getBoundingClientRect: () => ({ top: 0 }), contains: () => false,
      children: [{ dataset: { itemId: 'p2' }, offsetHeight: 50, getBoundingClientRect: () => ({ top: 10 }) }] } } });
    expect(anchored.scope.publicAllFeedShownCap, 'grown until p2 is in the window again').toBe(120);
    expect(anchored.entries.some((entry) => entry.key === 'p2')).toBe(true);
    const shardMissing: any = { mediaMissing: true, marker: 'm' };
    const lazy = run({ items, reached: [{ shards: new Map([['s', shardMissing]]) }] });
    await Promise.resolve();
    expect([shardMissing.mediaMissing, shardMissing.marker], 'asked once: marker forgotten so the pass reads it').toEqual([false, null]);
    expect(lazy.asked).toEqual([{ force: true }]);
    expect(run({ items, options: { loading: true } }).scope.publicDiscoveryPaintMode).toEqual({ loading: true, error: false });
    expect(code(fn('function renderPublicDiscovery(')), 'no read mark, no hold, anywhere in the painter').not.toMatch(/holdPublicFeedPainted|markVisiblePublicFeedRead|flushPublicFeedRead/);
  });

  it('ALLFEED-07B: the keyboard\'s place survives a repaint — the focused control is found again in the rebuilt row', () => {
    const makeButton = (cls: string) => ({ tagName: 'BUTTON', className: cls, focused: false, focus() { this.focused = true; } });
    const oldButtons = [makeButton('share'), makeButton('follow')];
    const oldRow: any = { dataset: { itemId: 'a' }, querySelectorAll: () => oldButtons };
    const focused: any = { ...oldButtons[1], closest: () => oldRow };
    oldButtons[1] = focused;
    const newButtons = [makeButton('share'), makeButton('follow')];
    const newRow: any = { dataset: { itemId: 'a' }, querySelectorAll: () => newButtons, getBoundingClientRect: () => ({ top: 0 }), offsetHeight: 10 };
    const doc: any = { ...fakeDocument, activeElement: focused, body: {} };
    const feed: any = { children: [oldRow], scrollTop: 0, getBoundingClientRect: () => ({ top: 0 }), contains: (el: any) => el === focused && feed.children[0] === oldRow };
    const scope: any = {
      document: doc, publicAllFeed: feed, publicDiscoveryPaintMode: { loading: false, error: false }, publicDiscoveryQuery: '',
      publicDiscoveryProgress: null, publicAllFeedPassRun: null, publicAllFeedRestore: null, publicAllFeedRestored: true, publicAllFeedPassOutcome: null,
      publicAllFeedShownCap: 60, PUBLIC_ALL_FEED_PAGE: 60, PUBLIC_ALL_FEED_ARTICLE: ARTICLE, publicAllFeedSurfacedIds: new Map(), t, currentLocale: () => 'en',
      publicAllFeedWindow: () => ({ items: [{ id: 'a', text: 'x' }], more: false, reached: [] }),
      publicFeedItemRenderSignature: () => 'sig', buildPublicFeedArticle: () => fakeElement('article'), surfaceRow: () => false,
      reconcileKeyedRows: () => { feed.children = [newRow]; doc.activeElement = doc.body; },
      refreshGlobalSyncIndicator: () => {},
    };
    const paint = inAppScope(['function renderPublicDiscovery(', 'function allSectionLoading('].map(fn), 'renderPublicDiscovery', scope);
    paint({});
    expect(newButtons.map((button) => button.focused), 'the same control of the rebuilt row').toEqual([false, true]);
  });

  it('ALLFEED-08: the article — no unread mark with read marks off, Follow on a stranger\'s post (seeded, then followed), none on one\'s own', () => {
    const sig = inAppScope([fn('function publicFeedItemRenderSignature(')], 'publicFeedItemRenderSignature', {
      currentLocale: () => 'en', feedTimestampMode: () => 'datetime', isUnreadPublicItem: () => true, publicFeedExpandedPosts: new Set(),
      publishStateMeta: () => '', publicAvatarUrlForWallet: () => '', isPublicChannelSubscribed: () => false,
    });
    const item = { id: 'p1', meta: ['name'], blocks: [] };
    const unreadTerm = (signature: string) => signature.split(String.fromCharCode(0x1e))[2];
    expect(unreadTerm(sig(item, new Map())), 'the Following feed marks it').toBe('u');
    expect(unreadTerm(sig(item, new Map(), ARTICLE)), 'the All feed does not').toBe('');
    expect(code(fn('function buildPublicFeedArticle('))).toContain('const unread = options.readMarks !== false && isUnreadPublicItem(item);');
    const actionsOf = (state: Record<string, any>) => {
      const calls: string[] = [];
      const article = fakeElement('article');
      article.dataset.itemId = 'p1';
      const scope: any = {
        document: fakeDocument, t,
        publicPostCommentsAllowed: () => true, publicPostHasChainCommentTarget: () => true,
        warmPublicPostCommentsCache: () => calls.push('warm'),
        openPublicPostDetail: () => {}, sharePayloadFromPublicItem: () => null, moderationSupported: () => false,
        openPrivateThreadForWallet: () => {},
        walletLockedOnDevice: () => false,
        isOwnPublicAuthor: (wallet: string) => wallet === 'ME',
        isPublicChannelSubscribed: (channelId: string) => channelId === 'wallet:FOLLOWED',
        publicChannelViewOpen: false,
        publicAllFeed: { children: [] },
        seedFollowingCacheFromAllFeed: (wallet: string) => calls.push(`seed ${wallet}`),
        toggleDiscoveredChannelFollow: (wallet: string, follow: boolean) => { calls.push(`follow ${wallet} ${follow}`); return true; },
        ...state.scope,
      };
      const append = inAppScope([fn('function appendPublicItemActions(')], 'appendPublicItemActions', scope);
      append(article, { id: 'p1', channelId: state.channelId, authorWallet: state.wallet, entryId: '1' }, state.options ?? {});
      const buttons = actionButtons(article);
      const labels = buttons.map((button: any) => button.textContent || button.attrs['aria-label']);
      return { labels, calls, buttons };
    };
    const stranger = actionsOf({ channelId: 'wallet:S', wallet: 'S', options: ARTICLE });
    expect(stranger.labels).toEqual(['<public.comments>', '<public.follow>', '<public.privateChat>']);
    expect(stranger.calls, 'no comment warm-up while All draws').toEqual([]);
    for (const icon of stranger.buttons.slice(1)) {
      expect([icon.className.split(' ')[0], icon.textContent, Boolean(icon.title), icon.children[0]?.attrs['aria-hidden']], 'an icon, named and titled').toEqual(['feed-action-icon', '', true, 'true']);
    }
    stranger.buttons.find((button: any) => button.className.includes('feed-follow-button')).click();
    expect(stranger.calls, 'the posts All read go to the Following feed first, then the follow').toEqual(['seed S', 'follow S true']);
    expect(actionsOf({ channelId: 'wallet:FOLLOWED', wallet: 'FOLLOWED', options: ARTICLE }).labels, 'a followed channel: Unfollow').toContain('<public.unfollow>');
    expect(actionsOf({ channelId: 'wallet:ME', wallet: 'ME', options: ARTICLE }).labels, 'nothing to follow on one\'s own').toEqual(['<public.comments>']);
    const following = actionsOf({ channelId: 'wallet:S', wallet: 'S' });
    expect(following.labels, 'the Following feed offers no Follow on a post').toEqual(['<public.comments>', '<public.privateChat>']);
    expect(following.calls, 'and they still warm the comments').toEqual(['warm']);
    expect(actionsOf({ channelId: 'wallet:FOLLOWED', wallet: 'FOLLOWED', options: { headerFollows: true } }).labels).toEqual(['<public.comments>', '<public.privateChat>']);
    expect(RAW).toContain('const node = buildPublicFeedArticle(item, avatarUrlMemo, PUBLIC_CHANNEL_VIEW_ARTICLE);');
  });

  it('ALLFEED-09: a repost\'s original, read while All draws it, registers nothing and writes nothing; read for the reader\'s tap, it is kept', async () => {
    const run = async (options: any) => {
      const calls: string[] = [];
      const original = { id: 'orig', entryId: '100.0.9', bodyHash: hash(9), entryUid: 'u9', text: 'the original', createdAt: '2026-09-10T10:00:00.000Z', authorWallet: 'W' };
      const scope: any = {
        publicChannelFeedCache: {},
        rawWalletAddress: id,
        sharedPostShardCoordinates: () => ({ epochTag: 100, shardSeq: 0, shardEntryId: 9, generation: 17 }),
        directPublicLaneReader: () => ({ readPostAt: async () => [{ entry_id: 9 }] }),
        ensurePublicChannelForAuthorWallet: () => { calls.push('registered'); return 'wallet:W'; },
        publicAllFeedChannelId: () => 'wallet:W',
        publicPostPartsFromShardPosts: async (_rows: any[], channel: any) => { calls.push(`decoded under ${channel.id}`); return [original]; },
        assemblePublicParts: (parts: any[]) => parts,
        commitPublicChannelFeedCache: () => calls.push('written'),
        upsertPublicChainPosts: (a: any[], b: any[]) => [...a, ...b],
        mergeLocalPendingPublicFeed: (_id: string, posts: any[]) => posts,
        publicFeedPostHasChainAnchor: () => true,
      };
      const fetchPost = inAppScope([fn('async function fetchPublicPostFromChain(')], 'fetchPublicPostFromChain', scope);
      const post = await fetchPost('100.0.9', 'W', (candidate: any) => candidate.id === 'orig', options);
      return { post, calls, cache: scope.publicChannelFeedCache };
    };
    const drawn = await run({ keep: false });
    expect(drawn.post?.text).toBe('the original');
    expect(drawn.calls, 'read under the id its posts carry, nothing registered, nothing written').toEqual(['decoded under wallet:W']);
    expect(drawn.cache).toEqual({});
    const tapped = await run(undefined);
    expect(tapped.calls).toEqual(['registered', 'decoded under wallet:W', 'written']);
    expect(Object.keys(tapped.cache)).toEqual(['wallet:W']);
    const embed = code(fn('function buildSharedPostEmbed('));
    expect(embed).toContain('resolveSharedPostOriginal(block.entryId, block.bodyHash, wallet, { keep: options.keepSharedOriginals !== false })');
    expect(embed, 'the header tap stays the reader\'s: kept').toContain('resolveSharedPostOriginal(block.entryId, block.bodyHash, wallet).then((post) => {');
  });

  it('ALLFEED-10: following from All seeds the Following feed with what All read — merged, the channel registered on the tap', () => {
    const post = (entry: number) => ({ id: `pshard-wallet:S-${entry}`, entryId: `100.0.${entry}`, bodyHash: hash(entry), entryUid: `u${entry}`, text: `s${entry}`, createdAt: `2026-09-2${entry}T10:00:00.000Z` });
    const calls: string[] = [];
    const scope: any = {
      rawWalletAddress: id,
      publicAllFeedRecords: new Map([['S', { channelId: 'wallet:S', at: 1, shards: new Map([['s', heldShard('s', 'm', [post(1), post(2)])]]) }]]),
      publicChannelFeedCache: { 'wallet:S': { feed: { version: 1, channelId: 'wallet:S', posts: [post(0)] } } },
      ensurePublicChannelForAuthorWallet: (wallet: string) => { calls.push(`registered ${wallet}`); return 'wallet:S'; },
      commitPublicChannelFeedCache: () => calls.push('written'),
      isPendingPublicFeedItem: () => false,
      samePublicBodyHash: () => false,
      mergePublicComments: (a: any[], b: any[]) => [...a, ...b],
    };
    const seed = inAppScope(['function seedFollowingCacheFromAllFeed(', 'function upsertPublicChainPosts(', 'function mergeLocalPendingPublicFeed(', 'function publicFeedPostHasChainAnchor('].map(fn), 'seedFollowingCacheFromAllFeed', scope);
    seed('S');
    expect(calls).toEqual(['registered S', 'written']);
    expect(scope.publicChannelFeedCache['wallet:S'].feed.posts.map((p: any) => p.text), 'merged with what the cache held, never replacing it').toEqual(['s0', 's1', 's2']);
    calls.length = 0;
    seed('NOBODY');
    expect(calls, 'nothing read for a wallet: nothing done').toEqual([]);
    scope.publicChannelFeedCache = {};
    const detail = inAppScope(['function seedAllFeedPostForDetail(', 'function upsertPublicChainPosts(', 'function mergeLocalPendingPublicFeed(', 'function publicFeedPostHasChainAnchor('].map(fn), 'seedAllFeedPostForDetail', scope);
    detail({ id: 'pshard-wallet:S-2', channelId: 'wallet:S', authorWallet: 'S' });
    expect(scope.publicChannelFeedCache['wallet:S'].feed.posts.map((p: any) => p.text), 'the one post opened').toEqual(['s2']);
    calls.length = 0;
    detail({ id: 'pshard-wallet:S-2', channelId: 'wallet:S', authorWallet: 'S' });
    expect(calls, 'already held: nothing written twice').toEqual([]);
    detail({ id: 'pshard-wallet:S-1', channelId: 'platho.app', authorWallet: 'S' });
    expect(calls, 'a post named under another channel id is not this record\'s').toEqual([]);
  });

  it('ALLFEED-11: the markup, the stores on the wipe list, the state above the boot, and the background schedule', () => {
    const section = html.slice(html.indexOf('id="publicDiscovery"'), html.indexOf('id="publicGroups"'));
    expect(section).toContain('<div class="public-feed public-all-feed" id="publicAllFeed" data-public-mode="feed"></div>');
    expect(html).not.toContain('id="publicDiscoveryBody"');
    expect(css).toMatch(/\.public-all-feed \{\s*min-height: 0;\s*\}/);
    const wipe = RAW.slice(RAW.indexOf('const PLATHO_LOCAL_INDEXED_DB_BASE_NAMES = Object.freeze(['), RAW.indexOf(']);', RAW.indexOf('const PLATHO_LOCAL_INDEXED_DB_BASE_NAMES')));
    expect(wipe).toContain("'platho-all-feed-v1',");
    expect(wipe).toContain("'platho-all-feed-media-v1',");
    for (const name of ['const PUBLIC_ALL_FEED_ARTICLE', 'let publicAllFeedRecords', 'let publicAllFeedPassRun', 'let publicAllFeedPaintTimer', 'const publicAllFeedSurfacedIds']) {
      expect(RAW.indexOf(name), name).toBeGreaterThan(-1);
      expect(RAW.indexOf(name), `${name} above the boot`).toBeLessThan(RAW.indexOf('\nhydratePersonalPublicState();'));
    }
    expect(RAW).toContain("const PUBLIC_ALL_FEED_ARTICLE = Object.freeze({ readMarks: false, offerFollow: true, warmComments: false, keepSharedOriginals: false });");
    const warm = code(fn('function warmPublicCatalogue('));
    expect(warm).toContain("const readWhatItFinds = (results, progress) => { if (Number(progress?.added ?? 0) > 0 && !publicDiscoveryOpen) void requestPublicAllFeedPass(); };");
    expect(warm).toContain('if (!publicDiscoveryOpen) void requestPublicAllFeedPass();');
    expect(RAW).toMatch(/setInterval\(\(\) => \{\s*if \(!pageOnScreen\(\)\) return;[^\n]*\n\s*warmPublicCatalogue\(\);\s*void requestPublicAllFeedPass\(\);\s*\}, PUBLIC_ALL_FEED_TTL_MS\);/);
    expect(code(fn('async function waitForAllFeedTurn('))).toContain('await waitForCatalogueTurn();');
  });

  it('ALLFEED-12: the corner spins while All loads what it shows — the catalogue or the posts, on All only — from the answer the line gives', () => {
    const flags: Record<string, any> = { messageAutoSyncPhase: 'idle', publicSyncPhase: 'synced', prefsSyncInFlight: false, publicDiscoveryOpen: false,
      publicAllFeedPassRun: null, publicDiscoveryProgress: null, publicDiscoveryPaintMode: { loading: false, error: false } };
    const active = inAppScope([fn('function isGlobalSyncActive('), fn('function allSectionLoadingOnScreen('), fn('function allSectionLoading(')], 'isGlobalSyncActive', flags);
    expect(active(), 'nothing running').toBe(false);
    flags.publicAllFeedPassRun = Promise.resolve();
    expect(active(), 'a pass in the background is nobody\'s wait').toBe(false);
    flags.publicDiscoveryOpen = true;
    expect(active(), 'on All it is this screen\'s loading').toBe(true);
    flags.publicAllFeedPassRun = null;
    expect(active()).toBe(false);
    flags.publicDiscoveryProgress = { done: 3, total: 64 };
    expect(active(), 'the sweep still finding channels').toBe(true);
    flags.publicDiscoveryProgress = null;
    flags.publicDiscoveryPaintMode = { loading: true, error: false };
    expect(active(), 'the catalogue still being read from the device').toBe(true);
    flags.publicDiscoveryOpen = false;
    expect(active(), 'none of it off All').toBe(false);
    expect(code(fn('function renderPublicDiscovery('))).toContain('const working = !locked && allSectionLoading({ loading });');
    expect(code(fn('function renderPublicDiscovery(')), 'and the paint tells the corner').toMatch(/reconcileKeyedRows\(publicAllFeed, entries\);[\s\S]*refreshGlobalSyncIndicator\(\);\s*\}$/);
    const run = code(fn('function runPublicAllFeedPass('));
    expect(run.match(/refreshGlobalSyncIndicator\(\);/g)?.length, 'at the start and in the finally').toBe(2);
    expect(run.indexOf('publicAllFeedPassRun = null;')).toBeLessThan(run.lastIndexOf('refreshGlobalSyncIndicator();'));
    expect(code(fn('async function openPublicDiscovery('))).toMatch(/publicDiscoveryOpen = true;\s*refreshGlobalSyncIndicator\(\);/);
    expect(code(fn('function closePublicDiscovery('))).toMatch(/publicDiscoveryOpen = false;\s*refreshGlobalSyncIndicator\(\);/);
    expect(code(fn('function syncNowForCurrentScreen('))).toContain('if (isGlobalSyncActive() || messageSyncManualInFlight) return;');
  });

  it('ALLFEED-13: the turn — never hidden, never beside a send, a confirmation or an activation, never behind the unlock prompt; off All after the reader\'s own reads', async () => {
    const ticksFor = async (world: Record<string, boolean>) => {
      let ticks = 0;
      let lockChecks = 0;
      const scope: any = {
        document: { hidden: world.hidden === true },
        publicDiscoveryOpen: world.open === true,
        outboundWorkPausesBackground: () => world.outbound === true,
        appSyncBusy: () => world.busy === true,
        walletLockedOnDevice: () => { lockChecks += 1; if (lockChecks > 100) throw new Error('the turn spins without waiting'); return world.locked === true; },
        CATALOGUE_TURN_POLL_MS: 1,
        pageOnScreen: () => !scope.document.hidden && world.minimised !== true,
        delay: async () => { ticks += 1; for (const key of Object.keys(world)) world[key] = false; scope.document.hidden = false; },
      };
      const turn = inAppScope([fn('async function waitForAllFeedTurn('), fn('async function waitForCatalogueTurn(')], 'waitForAllFeedTurn', scope);
      await turn();
      return ticks;
    };
    expect(await ticksFor({}), 'nothing in the way').toBe(0);
    expect(await ticksFor({ hidden: true, open: true }), 'hidden: waits, All open or not').toBe(1);
    expect(await ticksFor({ minimised: true }), 'a Mini App minimised in Telegram waits too').toBe(1);
    expect(await ticksFor({ outbound: true, open: true }), 'beside a send, even on All').toBe(1);
    expect(await ticksFor({ locked: true }), 'behind the unlock prompt').toBe(1);
    expect(await ticksFor({ busy: true }), 'off All, after the feed and the messages').toBe(1);
    expect(await ticksFor({ busy: true, open: true }), 'on All it does not wait for them').toBe(0);
    const gate = 'privateOutboundWorkActive() || privatePublishConfirmJobs.size > 0 || plathoAccountActivationPending';
    expect(code(fn('function outboundWorkPausesBackground('))).toContain(`return ${gate};`);
    expect(code(RAW), 'the unified loop pauses on the same condition').toContain(`if (${gate}) {`);
  });

  it('ALLFEED-08B: Unfollow in All goes through the Follow guard, keeps the channel\'s posts in All, asks for its shards and gives the focus back', () => {
    const calls: string[] = [];
    const article = fakeElement('article');
    article.dataset.itemId = 'p1';
    const rebuiltButton = { focused: false, focus() { this.focused = true; } };
    const scope: any = {
      document: fakeDocument, t,
      publicPostCommentsAllowed: () => true, publicPostHasChainCommentTarget: () => true,
      openPublicPostDetail: () => {}, sharePayloadFromPublicItem: () => null, moderationSupported: () => false,
      openPrivateThreadForWallet: () => {},
      walletLockedOnDevice: () => false,
      isOwnPublicAuthor: () => false,
      isPublicChannelSubscribed: () => true,
      publicChannelViewOpen: false,
      publicAllFeed: { children: [{ dataset: { itemId: 'p1' }, querySelector: () => rebuiltButton }] },
      seedAllFeedFromFollowingCache: (wallet: string) => calls.push(`keep ${wallet}`),
      toggleDiscoveredChannelFollow: (wallet: string, follow: boolean) => { calls.push(`follow ${wallet} ${follow}`); return calls.filter((c) => c.startsWith('follow')).length === 1; },
      requestPublicAllFeedPass: (options: any) => calls.push(`pass ${JSON.stringify(options)}`),
      setPublicChannelSubscribed: () => calls.push('direct unsubscribe'),
    };
    const append = inAppScope([fn('function appendPublicItemActions(')], 'appendPublicItemActions', scope);
    append(article, { id: 'p1', channelId: 'wallet:F', authorWallet: 'F', entryId: '1' }, ARTICLE);
    const unfollow = actionButtons(article).find((button: any) => button.className.includes('feed-follow-button'));
    unfollow.click();
    expect(calls, 'kept in All, unfollowed through the guard, its shards asked for').toEqual(['keep F', 'follow F false', 'pass {"force":true}']);
    expect(rebuiltButton.focused, 'the focus goes to the rebuilt Follow').toBe(true);
    unfollow.click();
    expect(calls.slice(3), 'a second tap inside the guard: nothing more than the guard\'s refusal').toEqual(['keep F', 'follow F false']);
    expect(calls, 'never the unguarded direct unsubscribe from All').not.toContain('direct unsubscribe');
    const plain = fakeElement('article');
    const plainCalls = calls.length;
    append(plain, { id: 'p2', channelId: 'wallet:F', authorWallet: 'F', entryId: '2' }, {});
    actionButtons(plain).find((button: any) => button.className.includes('feed-follow-button')).click();
    expect(calls.slice(plainCalls)).toEqual(['direct unsubscribe']);
    const store: any = { saved: [] };
    const seedScope: any = {
      rawWalletAddress: (value: any) => value,
      publicAllFeedChannelId: (wallet: string) => `wallet:${wallet}`,
      publicChannelFeedCache: { 'wallet:F': { feed: { posts: [{ id: 'a', entryId: '1', bodyHash: hash(1), entryUid: 'u1', createdAt: '2026-09-20T10:00:00.000Z' }] } } },
      publicAllFeedRecords: new Map(),
      PUBLIC_ALL_FEED_WINDOW: 32,
    };
    const seed = inAppScope([fn('function seedAllFeedFromFollowingCache('), fn('function publicFeedPostHasChainAnchor('), fn('function publicAllFeedRecordFor('),
      fn('function mergePublicAllFeedWindow(')], 'seedAllFeedFromFollowingCache', seedScope);
    seed('F');
    const stand = seedScope.publicAllFeedRecords.get('F').shards.get('seed:following');
    expect([stand.marker, stand.posts.map((post: any) => post.id)]).toEqual([null, ['a']]);
    expect(code(fn('function savePublicAllFeedRecord(')), 'a stand-in is never written to the device').toContain(".filter((shard) => !String(shard.key).startsWith('seed:'))");
    void store;
  });

  it('ALLFEED-12B: a pass cut short, or a list that failed, is "delayed" in the corner while All is the screen — never "synced"', () => {
    const scope: any = {
      publicDiscoveryOpen: true,
      publicDiscoveryPaintMode: { loading: false, error: false },
      publicDiscoveryProgress: null,
      publicAllFeedPassRun: null,
      publicAllFeedRestore: null,
      publicAllFeedRestored: true,
      publicAllFeedPassOutcome: null,
    };
    const stale = inAppScope([fn('function allSectionStaleOnScreen('), fn('function allSectionLoading(')], 'allSectionStaleOnScreen', scope);
    expect(stale()).toBe(false);
    scope.publicAllFeedPassOutcome = { cut: 'rate' };
    expect(stale(), 'a rate limit cut the pass').toBe(true);
    scope.publicAllFeedPassOutcome = { cut: 'budget' };
    expect(stale(), 'a budget is not a failure').toBe(false);
    scope.publicDiscoveryPaintMode = { loading: false, error: true };
    expect(stale(), 'the list failed').toBe(true);
    scope.publicAllFeedPassRun = 'running';
    expect(stale(), 'still loading: the spinner says that').toBe(false);
    scope.publicAllFeedPassRun = null;
    scope.publicDiscoveryOpen = false;
    expect(stale(), 'off All it is not this screen\'s').toBe(false);
    expect(code(fn('function refreshGlobalSyncIndicator('))).toContain("(messageAutoSyncPhase === 'delayed' && messageAutoSyncFailed) || allSectionStaleOnScreen());");
  });

  it('ALLFEED-14: what All no longer lists leaves memory against a complete catalogue only; a pass probes at most as many channels as the device keeps', () => {
    const records = new Map<string, any>([['A', { shards: new Map() }], ['GONE', { shards: new Map() }]]);
    const scope: any = {
      publicDiscoveryCache: { results: [], partial: true },
      publicAllFeedWallets: () => ['A'],
      publicAllFeedRecords: records,
      publicAllFeedCovered: new Set(['A', 'GONE']),
    };
    const forget = inAppScope([fn('function forgetUnlistedPublicAllFeedRecords(')], 'forgetUnlistedPublicAllFeedRecords', scope);
    forget();
    expect([...records.keys()], 'a partial catalogue does not know who left').toEqual(['A', 'GONE']);
    scope.publicDiscoveryCache = { results: [] };
    forget();
    expect([...records.keys()]).toEqual(['A']);
    expect([...scope.publicAllFeedCovered]).toEqual(['A']);
    const catalogue = Array.from({ length: 700 }, (_, i) => ({ authorWallet: `W${i}` }));
    const wallets = inAppScope([fn('function publicAllFeedWallets(')], 'publicAllFeedWallets', {
      publicDiscoveryFollowedWallets: () => new Set(),
      publicAllFeedCatalogue: () => catalogue,
      rawWalletAddress: (value: any) => value,
      isOwnPublicAuthor: () => false,
      publicChannelVisibleUnderModeration: () => true,
      CHANNEL_CATALOGUE_SAVED_MAX: 512,
      publicCatalogueDelisted: new Set(),
    });
    const probed = wallets();
    expect([probed.length, probed[0], probed.at(-1)], 'the first 512, in the catalogue\'s own order').toEqual([512, 'W0', 'W511']);
  });
});

describe('THE ALL FEED — a moderator\'s hide reaches the posts a device already holds [client audit round 10 — public-2]', () => {
  const gen18Shard = (key: string, marker: string) => ({ key, address: key, era: 1, epochTag: '100', seq: 0, generation: 18, marker, lastLt: '1' });
  const post = (entry: number, at: string) => ({ id: `pshard-wallet:A-${entry}`, entryId: `100.0.${entry}.18`, generation: 18,
    bodyHash: hash(entry), entryUid: `u${entry}`, text: `a${entry}`, createdAt: at, authorWallet: 'A', chainVerified: true });
  const bitmap = (ids: number[]) => [{ epochTag: '100', seq: 0, generation: 18, entryCount: 5, ids, complete: true }];

  it('R10-P2-01: the marker moved and the count did not — the hide the read carries is applied to the held post', async () => {
    const held = { channelId: 'wallet:A', at: 1, checkedAt: 1, memo: null, shards: new Map<string, any>([
      ['s', { key: 's', marker: 'm1', entryCount: 5, era: 1, epochTag: '100', seq: 0, generation: 18,
        posts: [post(3, '2026-10-05T10:00:00.000Z'), post(4, '2026-10-05T11:00:00.000Z')] }]]) };
    const { scope, pass } = passWorld({
      wallets: ['A'],
      heads: new Map([['A', { unknown: false, shards: [gen18Shard('s', 'm2')] }]]),
      reads: { 'A:s': { posts: [], entryCount: 5, fresh: 0, unchanged: true, hidden: bitmap([4]) } },
      scope: { publicAllFeedChannelId: (wallet: string) => `wallet:${wallet}` },
    });
    scope.publicAllFeedRecords.set('A', held);
    await pass();
    const kept = scope.publicAllFeedRecords.get('A').shards.get('s');
    expect(kept.marker).toBe('m2');
    expect(kept.posts.map((p: any) => [p.text, p.hidden === true])).toEqual([['a3', false], ['a4', true]]);
  });

  it('R10-P2-02: a grown window merges over held posts WITH their new hidden bits', async () => {
    const held = { channelId: 'wallet:A', at: 1, checkedAt: 1, memo: null, shards: new Map<string, any>([
      ['s', { key: 's', marker: 'm1', entryCount: 4, era: 1, epochTag: '100', seq: 0, generation: 18,
        posts: [post(3, '2026-10-05T10:00:00.000Z')] }]]) };
    const { scope, pass } = passWorld({
      wallets: ['A'],
      heads: new Map([['A', { unknown: false, shards: [gen18Shard('s', 'm2')] }]]),
      reads: { 'A:s': { posts: [{ entry_id: 4, text: 'a four', at: '2026-10-05T12:00:00.000Z' }], entryCount: 5, fresh: 1, unchanged: false, hidden: bitmap([3]) } },
      scope: { publicAllFeedChannelId: (wallet: string) => `wallet:${wallet}` },
    });
    scope.publicAllFeedRecords.set('A', held);
    await pass();
    const kept = scope.publicAllFeedRecords.get('A').shards.get('s');
    expect(kept.posts.map((p: any) => [p.text, p.hidden === true])).toEqual([['a3', true], ['a four', false]]);
  });
});
