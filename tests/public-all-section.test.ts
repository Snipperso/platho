import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';


const RAW = readFileSync('web/app.js', 'utf8');
const css = readFileSync('web/styles.css', 'utf8');
const S = I18N_STRINGS as Record<string, Record<string, string>>;
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
  if (!('publicCatalogueDelisted' in overrides)) overrides.publicCatalogueDelisted = new Set();
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

function fakeElement(tag: string): any {
  const el: any = {
    tagName: tag.toUpperCase(), children: [] as any[], dataset: {} as Record<string, string>, attrs: {} as Record<string, string>,
    listeners: {} as Record<string, Array<(event: any) => void>>, className: '', textContent: '', title: '', type: '', disabled: false,
    classList: {
      add(name: string) { el.className = `${el.className} ${name}`.trim(); },
      contains(name: string) { return el.className.split(' ').includes(name); },
    },
    append(...nodes: any[]) { el.children.push(...nodes); },
    insertBefore(node: any, ref: any) {
      const at = ref ? el.children.indexOf(ref) : -1;
      if (at < 0) el.children.push(node); else el.children.splice(at, 0, node);
    },
    setAttribute(key: string, value: any) { el.attrs[key] = String(value); },
    getAttribute(key: string) { return el.attrs[key] ?? null; },
    addEventListener(type: string, listener: (event: any) => void) { (el.listeners[type] ??= []).push(listener); },
    click() { for (const listener of el.listeners.click ?? []) listener({ target: el, currentTarget: el, stopPropagation() {} }); },
    focus() { el.focused = true; },
  };
  return el;
}
const walk = (node: any, out: any[] = []): any[] => { out.push(node); for (const child of node.children ?? []) walk(child, out); return out; };
const byClass = (root: any, name: string) => walk(root).filter((node) => String(node.className ?? '').split(' ').includes(name));

afterEach(() => { vi.useRealTimers(); });

describe('THE ALL SECTION — every channel, marked; the last list kept on the device', () => {
  it('ALL-01: the sweep keeps every described channel — the reader\'s own and the followed ones included', async () => {
    const scope: any = {
      publicDiscoverySweepInFlight: null,
      publicDiscoveryCache: null,
      plathoWallet: { address: 'w1' },
      publicChannelSubscriptions: [], publicChannelRegistry: [],
      subscribedPublicChannels: () => [{ authorWallet: 'w2' }],
      rawWalletAddress: id,
      sameWalletAddress: (a: any, b: any) => a === b,
      tonCell: { readSnakeCellBytes: () => new Uint8Array(0) },
      readProfileDocument: () => ({ profileBlock: { description: 'about', tags: [] } }),
      publicChannelIsDiscoverable: () => true,
      setChannelProfileFromWalk: () => {},
      publicAuthorLabel: (wallet: string) => wallet,
      writeSavedChannelCatalogue: () => {},
      PUBLIC_POST_BODY_MAX_BYTES: 1024,
      console: { warn: () => {} },
      directPublicLaneReader: () => ({
        sweepChannelCatalog: async () => ['w1', 'w2', 'w3'].map((wallet) => ({ channelWallet: wallet, card: {}, announcedAt: 1n })),
      }),
    };
    const sweep = inAppScope([fn('async function discoverChannelsFromBeacon(')], 'discoverChannelsFromBeacon', scope);
    expect((await sweep()).map((channel: any) => channel.authorWallet)).toEqual(['w1', 'w2', 'w3']);
    expect(code(RAW), 'the exclusion set and its bookkeeping are gone').not.toMatch(/publicDiscoveryFollowedInSweep|followDiscoveredChannel\(/);
    const src = code(fn('async function discoverChannelsFromBeacon('));
    expect(src).not.toMatch(/subscribedAuthors|ownWallet/);
    expect(src).toMatch(/absorb\(catalog\);\s*publicDiscoveryCache = \{ at: Date\.now\(\), results \};\s*writeSavedChannelCatalogue\(publicDiscoveryCache\);/);
    expect(src).toContain('publicDiscoveryCache = { at: Date.now(), results, partial: true };');
  });

  it('ALL-03: a repaint from elsewhere draws what the section last painted — never a guessed "loading: false" over a list not yet arrived', () => {
    const calls: any[] = [];
    const scope: any = { publicDiscoveryPaintMode: { loading: true, error: false }, renderPublicDiscovery: (options: any) => calls.push(options) };
    inAppScope([fn('function repaintPublicDiscovery(')], 'repaintPublicDiscovery', scope)();
    expect(calls).toEqual([{ loading: true, error: false, repaint: true }]);
    const lifecycle = ['function publicDiscoveryPartialPainter(', 'async function openPublicDiscovery(', 'async function refreshPublicDiscovery(']
      .map((starts) => (code(fn(starts)).match(/renderPublicDiscovery\(\{ loading: false \}\);/g) ?? []).length)
      .reduce((a, b) => a + b, 0);
    expect(code(RAW).match(/renderPublicDiscovery\(\{ loading: false \}\);/g)?.length, 'a state is painted only by the section\'s own lifecycle')
      .toBe(lifecycle);
    for (const painter of ['publicDiscoveryQuery = publicDiscoverySearch.value.trim();\n  clearTimeout(publicDiscoverySearchTimer);',
      'publicDiscoverySearchTimer = setTimeout(() => { publicDiscoverySearchTimer = 0; repaintPublicDiscovery(); }, PUBLIC_ALL_FEED_SEARCH_DEBOUNCE_MS);']) {
      expect(RAW, painter.slice(0, 40)).toContain(painter);
    }
    expect(code(fn('async function hydratePublicDiscoveryAvatars('))).toContain('repaintPublicDiscovery();');
    const labelRefresh = code(fn('function scheduleDiscoveryLabelRefresh('));
    expect(labelRefresh).toContain('if (publicDiscoveryOpen) repaintPublicDiscovery();');
    const surface = code(fn('function renderPublicSurface('));
    expect(surface).toContain('if (publicDiscoveryOpen) scheduleDiscoveryLabelRefresh();');
    expect(code(RAW), 'the cards\' standing print went with the cards').not.toMatch(/discoveryStandingPrint|publicDiscoveryStandingDrawn|publicDiscoveryTagFilter/);
  });

  it('ALL-05: Follow and Unfollow take the wanted state, never one\'s own channel, and a double tap on the rebuilt button is ignored', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const subscribed: any[] = [];
    const repaints: string[] = [];
    const scope: any = {
      DISCOVERY_FOLLOW_TOGGLE_GUARD_MS: 600,
      discoveryFollowToggledAt: new Map(),
      rawWalletAddress: id,
      isOwnPublicAuthor: (wallet: string) => wallet === 'me',
      ensurePublicChannelForAuthorWallet: (wallet: string, options: any) => { expect(options).toEqual({ activate: false }); return `wallet:${wallet}`; },
      setPublicChannelSubscribed: (channelId: string, on: boolean) => { subscribed.push([channelId, on]); },
      publicDiscoveryOpen: true,
      repaintPublicDiscovery: () => { repaints.push('repaint'); },
    };
    const toggle = inAppScope([fn('function toggleDiscoveredChannelFollow(')], 'toggleDiscoveredChannelFollow', scope);
    expect(toggle('me', true), 'never one\'s own').toBe(false);
    expect(toggle('w1', true)).toBe(true);
    expect(toggle('w1', false), 'a second tap inside the guard is the rebuilt button, not a decision').toBe(false);
    vi.setSystemTime(1_000_700);
    expect(toggle('w1', false)).toBe(true);
    expect(toggle('w2', true), 'another channel is not held back by the first').toBe(true);
    expect(subscribed).toEqual([['wallet:w1', true], ['wallet:w1', false], ['wallet:w2', true]]);
    expect(repaints).toHaveLength(3);
    scope.publicDiscoveryOpen = false;
    vi.setSystemTime(1_002_000);
    toggle('w3', true);
    expect(repaints, 'nothing to repaint when All is not on screen').toHaveLength(3);
  });

  it('ALL-06: a sweep frame is merged into the list on screen; only a complete sweep takes cards away', () => {
    const merge = inAppScope([fn('function mergeCatalogueFrame(')], 'mergeCatalogueFrame', { rawWalletAddress: id });
    const card = (wallet: string, description = wallet) => ({ authorWallet: wallet, description });
    const shown = [card('a'), card('b'), card('c')];
    expect(merge(shown, [card('b', 'b2'), card('d')]).map((c: any) => `${c.authorWallet}:${c.description}`), 'places kept, data refreshed, the new at the end')
      .toEqual(['a:a', 'b:b2', 'c:c', 'd:d']);
    expect(merge(shown, [card('c'), card('a')], { final: true }).map((c: any) => c.authorWallet), 'the complete list drops what it no longer holds, in the order on screen')
      .toEqual(['a', 'c']);
    expect(merge([], [card('x'), card('x')]).map((c: any) => c.authorWallet), 'one card per wallet').toEqual(['x']);
    expect(merge(null, null)).toEqual([]);
    const painter = code(fn('function publicDiscoveryPartialPainter('));
    expect(painter).toContain('const keep = (publicDiscoveryResults?.length ?? 0) > 0;');
    expect(painter).toContain('publicDiscoveryResults = keep ? mergeCatalogueFrame(publicDiscoveryResults, partial) : partial;');
    const refresh = code(fn('async function refreshPublicDiscovery('));
    expect(refresh).not.toContain('publicDiscoveryResults = [];');
    expect(refresh).toContain('publicDiscoveryResults = listOnScreen ? mergeCatalogueFrame(publicDiscoveryResults, results, { final: complete }) : results;');
  });

  it('ALL-07: the saved catalogue is read back card by card, for this format — whichever build generation saved it [FLIP-05]', () => {
    const scope: any = {
      CHANNEL_CATALOGUE_SAVED_FORMAT: 1,
      CHANNEL_CATALOGUE_SAVED_MAX: 10,
      WRITES_GENERATION: 17,
      PROFILE_DESCRIPTION_MAX_BYTES: 12,
      rawWalletAddress: (wallet: any) => (typeof wallet === 'string' && wallet.startsWith('w') ? wallet : null),
      normalizeProfileTags: (tags: any) => (Array.isArray(tags) ? tags.filter((tag) => typeof tag === 'string') : []),
      publicChannelIsDiscoverable: (profile: any) => Boolean(profile.description) || profile.tags.length > 0,
      publicAuthorLabel: (wallet: string) => `label-${wallet}`,
    };
    const read = inAppScope([fn('function savedChannelCatalogueFromText(')], 'savedChannelCatalogueFromText', scope);
    const record = (over: any = {}) => JSON.stringify({ v: 1, gen: 17, at: 5, results: [], ...over });
    for (const gen of [17, 18, undefined]) {
      expect(read(record({ gen, results: [{ authorWallet: 'w1', description: 'x' }] }))?.results.map((c: any) => c.authorWallet),
        `a copy stamped gen ${gen} is a good cold start`).toEqual(['w1']);
    }
    expect(read(record({ v: 2, results: [{ authorWallet: 'w1', description: 'x' }] })), 'another format').toBeNull();
    expect(read('{not json')).toBeNull();
    expect(read(record({ results: [] })), 'an empty list is "nothing saved"').toBeNull();
    const got = read(record({
      results: [
        { authorWallet: 'w1', description: ' first ', tags: ['a', 7] },
        { authorWallet: 'nope', description: 'bad wallet' },
        { authorWallet: 'w1', description: 'a duplicate' },
        { authorWallet: 'w2', description: 'far far too long for twelve' },
        { authorWallet: 'w3', description: '', tags: [] },
        { authorWallet: 'w4', description: 'fourth' },
      ],
    }));
    expect(got.at).toBe(5);
    expect(got.results, 'each bad card costs that card only').toEqual([
      { authorWallet: 'w1', description: 'first', tags: ['a'], name: 'label-w1' },
      { authorWallet: 'w4', description: 'fourth', tags: [], name: 'label-w4' },
    ]);
    scope.CHANNEL_CATALOGUE_SAVED_MAX = 3;
    const capped = read(record({ results: [{ authorWallet: 'w1', description: 'a' }, { authorWallet: 'w2', description: 'b' }, { authorWallet: 'w3', description: 'c' }, { authorWallet: 'w4', description: 'd' }] }));
    expect(capped.results.map((c: any) => c.authorWallet)).toEqual(['w1', 'w2', 'w3']);
  });

  it('ALL-08: only a real list is saved — plain values, no derived name, never an empty one; fresh on the device means no sweep', async () => {
    const puts: any[] = [];
    const scope: any = {
      CHANNEL_CATALOGUE_SAVED_FORMAT: 1,
      CHANNEL_CATALOGUE_SAVED_MAX: 2,
      WRITES_GENERATION: 17,
      publicDiscoverySaved: null,
      rawWalletAddress: id,
      channelCatalogueStore: async () => ({ put: async (key: string, text: string) => { puts.push([key, JSON.parse(text)]); } }),
    };
    const write = inAppScope([fn('function writeSavedChannelCatalogue(')], 'writeSavedChannelCatalogue', scope);
    write({ at: 9, results: [] });
    write(null);
    await new Promise((resolve) => setImmediate(resolve));
    expect(puts, 'nothing saved over a real list').toEqual([]);
    write({ at: 9, results: [{ authorWallet: 'w1', description: 'd', tags: ['t'], name: 'derived' }, { authorWallet: 'w2', description: 'e', tags: [] }, { authorWallet: 'w3' }] });
    await new Promise((resolve) => setImmediate(resolve));
    expect(puts, 'no generation in the saved shape (FLIP-05)').toEqual([['catalogue', { v: 1, at: 9, complete: false, results: [
      { authorWallet: 'w1', description: 'd', tags: ['t'] }, { authorWallet: 'w2', description: 'e', tags: [] },
    ] }]]);
    expect(scope.publicDiscoverySaved.at).toBe(9);
    const readWith = async (at: number, complete = true) => {
      const state: any = {
        publicDiscoverySavedRead: null,
        publicDiscoverySaved: null,
        publicDiscoveryCache: null,
        PUBLIC_DISCOVERY_CACHE_TTL_MS: 300_000,
        channelCatalogueStore: async () => ({ get: async () => ({ url: 'text' }) }),
        savedChannelCatalogueFromText: () => ({ at, results: [{ authorWallet: 'w1' }], complete }),
      };
      await inAppScope([fn('function readSavedChannelCatalogue(')], 'readSavedChannelCatalogue', state)();
      return state;
    };
    const fresh = await readWith(Date.now() - 60_000);
    expect(fresh.publicDiscoveryCache?.results).toEqual([{ authorWallet: 'w1' }]);
    const old = await readWith(Date.now() - 3_600_000);
    expect(old.publicDiscoveryCache).toBeNull();
    expect(old.publicDiscoverySaved.results).toEqual([{ authorWallet: 'w1' }]);
    const cut = await readWith(Date.now() - 60_000, false);
    expect(cut.publicDiscoveryCache, 'a list saved cut (over the cap) stands in, but is never the fresh, complete cache').toBeNull();
    expect(cut.publicDiscoverySaved.results).toEqual([{ authorWallet: 'w1' }]);
    expect(RAW).toContain("channelCatalogue: Object.freeze({ plain: 'platho-channel-catalogue-v1', cap: () => 1 }),");
    const wipe = RAW.slice(RAW.indexOf('const PLATHO_LOCAL_INDEXED_DB_BASE_NAMES = Object.freeze(['), RAW.indexOf(']);', RAW.indexOf('const PLATHO_LOCAL_INDEXED_DB_BASE_NAMES = Object.freeze([')));
    expect(wipe).toContain("'platho-channel-catalogue-v1',");
    expect(RAW).toMatch(/function channelCatalogueStore\(\) \{\s*return deviceCacheStore\('channelCatalogue'\);\s*\}/);
  });

  it('ALL-09: with nothing in memory the device copy is read first, painted at once, and kept while a new sweep merges into it', async () => {
    const paints: any[] = [];
    const sweeps: any[] = [];
    const scope: any = {
      isPublicViewActive: () => true,
      publicPaneTab: 'all',
      publicPostDetailOpen: false,
      publicChannelViewOpen: false,
      publicDiscoveryOpen: false,
      appShell: { dataset: {} },
      publicDiscoverySweepInFlight: null,
      publicDiscoveryCache: null,
      publicDiscoverySaved: null,
      PUBLIC_DISCOVERY_CACHE_TTL_MS: 300_000,
      publicDiscoveryResults: null,
      publicDiscoveryProgress: null,
      publicDiscoveryLoadToken: 0,
      publicCatalogueRetryAttempt: 0,
      rawWalletAddress: id,
      restorePublicAllFeed: () => Promise.resolve(),
      requestPublicAllFeedPass: () => null,
      readSavedChannelCatalogue: async () => {
        paints.push('device copy read');
        scope.publicDiscoverySaved = { at: 1, results: [{ authorWallet: 'a' }, { authorWallet: 'b' }] };
        return scope.publicDiscoverySaved;
      },
      renderPublicDiscovery: (options: any) => {
        paints.push({ loading: options.loading === true, error: options.error === true, cards: (scope.publicDiscoveryResults ?? []).map((c: any) => c.authorWallet).join(','), looking: scope.publicDiscoveryProgress !== null });
      },
      discoverChannels: async () => { sweeps.push('sweep'); return [{ authorWallet: 'b' }, { authorWallet: 'c' }]; },
      publicDiscoveryPartialPainter: () => () => {},
      hydratePublicDiscoveryAvatarsOnce: async () => {},
      schedulePublicCatalogueRetry: () => false,
      noteTonRpcRateLimit: () => false,
    };
    const open = inAppScope([fn('async function openPublicDiscovery('), fn('function mergeCatalogueFrame(')], 'openPublicDiscovery', scope);
    await open();
    expect(paints[0], 'the skeleton while the device copy is read').toEqual({ loading: true, error: false, cards: '', looking: false });
    expect(paints[1]).toBe('device copy read');
    expect(paints[2], 'the saved cards at once, with the "still looking" line under them').toEqual({ loading: false, error: false, cards: 'a,b', looking: true });
    expect(sweeps).toEqual(['sweep']);
    expect(paints.at(-1), 'the sweep merged in; not complete by the cache, so nothing taken away').toEqual({ loading: false, error: false, cards: 'a,b,c', looking: false });
    paints.length = 0;
    Object.assign(scope, {
      publicDiscoveryOpen: false, publicDiscoveryResults: null, publicDiscoveryCache: null,
      discoverChannels: async () => { throw new Error('429'); },
    });
    await open();
    expect(paints.at(-1)).toEqual({ loading: false, error: true, cards: 'a,b', looking: false });
    paints.length = 0;
    Object.assign(scope, { publicDiscoveryOpen: false, publicDiscoveryResults: null, schedulePublicCatalogueRetry: () => true });
    await open();
    expect(paints.at(-1)).toEqual({ loading: false, error: false, cards: 'a,b', looking: true });
  });

  it('ALL-11: the face budget is spent on faces not yet held', async () => {
    const loaded: string[] = [];
    const held = new Map<string, string>([['w1', 'data:held'], ['w2', 'data:held']]);
    const hydrate = inAppScope([fn('async function hydrateProfileAvatarsForWallets(')], 'hydrateProfileAvatarsForWallets', {
      rawWalletAddress: id,
      publicChannelAvatarUrlByWallet: held,
      loadProfileAvatarImage: async (wallet: string) => { loaded.push(wallet); return `data:${wallet}`; },
      noteTonRpcRateLimit: () => false,
      console: { error: () => {} },
    });
    expect(await hydrate(['w1', 'w2', 'w3', 'w4', 'w5'], { limit: 2 })).toBe(true);
    expect(loaded, 'two held faces at the head of the list do not use up the pass').toEqual(['w3', 'w4']);
  });

  it('ALL-12: the Public overlays\' Back says "Back to public feed" only over the feed', () => {
    const button = () => ({ attrs: {} as Record<string, string>, title: '', getAttribute(key: string) { return this.attrs[key] ?? null; }, setAttribute(key: string, value: string) { this.attrs[key] = value; } });
    const run = (tab: string, channelOpen: boolean) => {
      const channel = button();
      const post = button();
      inAppScope([fn('function labelBackButton('), fn('function labelPublicOverlayBackButtons(')], 'labelPublicOverlayBackButtons', {
        publicPaneTab: tab, publicChannelViewOpen: channelOpen, t, publicChannelViewBackButton: channel, publicPostBackButton: post,
      })();
      return [channel.attrs['data-i18n-aria-label'], post.attrs['data-i18n-aria-label']];
    };
    expect(run('following', false)).toEqual(['public.backToFeed', 'public.backToFeed']);
    expect(run('following', true), 'a post over a channel goes back to the channel').toEqual(['public.backToFeed', 'common.back']);
    expect(run('all', false)).toEqual(['common.back', 'common.back']);
    expect(run('groups', true)).toEqual(['common.back', 'common.back']);
    expect(code(fn('function openPublicChannelView('))).toMatch(/publicChannelViewOpen = true;\s*labelPublicOverlayBackButtons\(\);/);
    expect(code(fn('function openPublicPostDetailUnfiltered('))).toContain('labelPublicOverlayBackButtons();');
  });

  it('ALL-13: the words — the lines of the feed, and the notice that names the All section by its own tab label', () => {
    const ruStems = [[0x43f, 0x440, 0x435, 0x434, 0x43b, 0x43e, 0x436], [0x43f, 0x43e, 0x434, 0x441, 0x43a, 0x430, 0x437]]
      .map((codes) => String.fromCharCode(...codes));
    const SUGGEST_WORDS = new RegExp(['suggest', 'sugerir', 'sugest', 'suggér', 'Vorschl', '推荐', 'おすすめ', 'सुझाव', 'saran', ...ruStems].join('|'), 'i');
    for (const locale of Object.keys(S)) {
      for (const key of ['public.allFeedLoading', 'public.allFeedLoadingMore', 'public.allFeedEmpty', 'public.allFeedEmptyHint', 'public.allFeedStale', 'public.follow', 'public.followChannel', 'public.unfollow', 'public.editDescription']) {
        expect(S[locale][key], `${locale} ${key}`).toBeTruthy();
      }
      expect(S[locale]['public.channelNotListedTitle'], locale).toContain('{section}');
      expect(S[locale]['public.channelNotListedSearchNeeds'], locale).toContain('{section}');
      expect(S[locale]['public.allFeedEmpty'] + S[locale]['public.allFeedEmptyHint'], `${locale}: not "suggestions"`)
        .not.toMatch(SUGGEST_WORDS);
    }
    expect(S.en['public.allFeedEmpty']).toBe('No posts yet');
    for (const gone of ['public.yourChannel', 'public.following', 'public.discoverStale', 'public.discoverEmpty', 'public.discoverError', 'public.discoverNotFound', 'public.discoverSearching', 'public.discoverLoading', 'public.discoverScanning']) {
      expect(S.en[gone], `${gone} went with the catalogue's cards`).toBeUndefined();
    }
    expect(RAW).toContain("title: t('public.channelNotListedTitle', { section: t('public.tabAll') }),");
    expect(RAW).toContain("t('public.channelNotListedSearchNeeds', { section: t('public.tabAll') }),");
  });
  it('ALL-14: a channel the lane delists in a later bucket leaves the list — and is not saved', async () => {
    const saved: any[] = [];
    const painted: any[] = [];
    const scope: any = {
      publicDiscoverySweepInFlight: null,
      publicDiscoveryCache: null,
      rawWalletAddress: id,
      tonCell: { readSnakeCellBytes: () => new Uint8Array(0) },
      readProfileDocument: () => ({ profileBlock: { description: 'about', tags: [] } }),
      publicChannelIsDiscoverable: () => true,
      setChannelProfileFromWalk: () => {},
      publicAuthorLabel: (wallet: string) => wallet,
      writeSavedChannelCatalogue: (cache: any) => saved.push(cache.results.map((c: any) => c.authorWallet)),
      PUBLIC_POST_BODY_MAX_BYTES: 1024,
      console: { warn: () => {} },
      directPublicLaneReader: () => ({
        sweepChannelCatalog: async ({ onProgress }: any) => {
          const item = (wallet: string) => ({ channelWallet: wallet, card: {}, announcedAt: 1n });
          onProgress([item('evader'), item('a')], { done: 1, total: 2 });
          onProgress([item('a')], { done: 2, total: 2 });
          return [item('a')];
        },
      }),
    };
    const sweep = inAppScope([fn('async function discoverChannelsFromBeacon(')], 'discoverChannelsFromBeacon', scope);
    const painter = (results: any[], progress: any) => painted.push([results.map((c: any) => c.authorWallet).join(','), progress.added]);
    const results = await sweep({ onPartial: painter });
    expect(results.map((c: any) => c.authorWallet)).toEqual(['a']);
    expect(saved, 'the saved copy holds no delisted channel').toEqual([['a']]);
    expect(painted, 'the frame that loses the card is a change the painter redraws for').toEqual([['evader,a', 2], ['a', 1]]);
    expect(scope.publicDiscoveryCache.results, 'the cache holds the very array the painters were handed').toBe(results);
    scope.publicDiscoveryCache = null;
    scope.directPublicLaneReader = () => ({
      sweepChannelCatalog: async ({ onProgress }: any) => {
        const item = { channelWallet: 'x', card: {}, announcedAt: 1n };
        onProgress([item], { done: 1, total: 3 });
        onProgress([], { done: 2, total: 3 });
        return [item];
      },
    });
    expect((await sweep()).map((c: any) => c.authorWallet)).toEqual(['x']);
  });

  it('ALL-15: a running sweep is joined, never answered from the cache it replaces; a broken-off list is not fresh', async () => {
    const asked: string[] = [];
    const run = async (state: Record<string, any>, options: any = {}) => {
      asked.length = 0;
      const scope: any = {
        publicDiscoverySweepInFlight: null,
        publicDiscoveryCache: null,
        PUBLIC_DISCOVERY_CACHE_TTL_MS: 300_000,
        discoverChannelsFromBeacon: async (opts: any) => { asked.push(`sweep ${typeof opts.onPartial}`); return ['swept']; },
        ...state,
      };
      return inAppScope([fn('async function discoverChannels(')], 'discoverChannels', scope)(options);
    };
    const fresh = { at: Date.now(), results: ['cached'] };
    expect(await run({ publicDiscoveryCache: fresh })).toEqual(['cached']);
    expect(asked).toEqual([]);
    expect(await run({ publicDiscoveryCache: fresh, publicDiscoverySweepInFlight: { promise: null } }, { onPartial: () => {} }), 'joined').toEqual(['swept']);
    expect(asked).toEqual(['sweep function']);
    expect(await run({ publicDiscoveryCache: { ...fresh, partial: true } }), 'a list that broke off is swept again').toEqual(['swept']);
    expect(await run({ publicDiscoveryCache: { at: Date.now() - 400_000, results: ['old'] } })).toEqual(['swept']);
    expect(await run({ publicDiscoveryCache: fresh }, { force: true })).toEqual(['swept']);
  });

  it('ALL-16: a sweep that broke off part-way is retried like a failed one — its cards on screen, the stale line after the ladder', async () => {
    const paints: any[] = [];
    let retries = 2;
    const asked: string[] = [];
    const scope: any = {
      isPublicViewActive: () => true, publicPaneTab: 'all', publicPostDetailOpen: false, publicChannelViewOpen: false,
      publicDiscoveryOpen: false, appShell: { dataset: {} }, publicDiscoverySweepInFlight: null,
      publicDiscoveryCache: null, publicDiscoverySaved: { at: 1, results: [{ authorWallet: 'a' }] },
      PUBLIC_DISCOVERY_CACHE_TTL_MS: 300_000, publicDiscoveryResults: null, publicDiscoveryProgress: null,
      publicDiscoveryLoadToken: 0, publicCatalogueRetryAttempt: 0, rawWalletAddress: id,
      restorePublicAllFeed: () => Promise.resolve(),
      requestPublicAllFeedPass: () => { asked.push('pass'); return null; },
      readSavedChannelCatalogue: async () => null,
      renderPublicDiscovery: (options: any) => paints.push({ error: options.error === true, loading: options.loading === true, looking: scope.publicDiscoveryProgress !== null, cards: (scope.publicDiscoveryResults ?? []).map((c: any) => c.authorWallet).join(',') }),
      discoverChannels: async () => {
        const results = [{ authorWallet: 'b' }];
        scope.publicDiscoveryCache = { at: Date.now(), results, partial: true };
        return results;
      },
      publicDiscoveryPartialPainter: () => () => {},
      hydratePublicDiscoveryAvatarsOnce: async () => {},
      schedulePublicCatalogueRetry: () => { if (retries-- <= 0) return false; scope.publicCatalogueRetryAttempt += 1; return true; },
      noteTonRpcRateLimit: () => false,
    };
    const open = inAppScope([fn('async function openPublicDiscovery('), fn('function mergeCatalogueFrame(')], 'openPublicDiscovery', scope);
    await open();
    expect(paints.at(-1), 'kept and merged, still looking: another attempt is on its way').toEqual({ error: false, loading: false, looking: true, cards: 'a,b' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(asked.length, 'the posts of the channels found are asked for, broken-off sweep or not').toBeGreaterThan(0);
    scope.publicDiscoveryOpen = false;
    scope.publicDiscoveryCache = null;
    await open({ retry: true });
    retries = 0;
    scope.publicDiscoveryOpen = false;
    await open({ retry: true });
    expect(paints.at(-1), 'the ladder climbed: the stale line over what was found').toEqual({ error: true, loading: false, looking: false, cards: 'a,b' });
    expect(scope.publicCatalogueRetryAttempt, 'a broken-off sweep does not reset the ladder as a success would').toBe(2);
  });

  it('ALL-17: a refresh keeps the list; it fails over it (not into an empty section), and a broken-off refresh says stale', async () => {
    const paints: any[] = [];
    const scope: any = {
      publicDiscoveryOpen: true, publicDiscoveryLoadToken: 0, publicDiscoveryProgress: null,
      publicDiscoveryResults: [{ authorWallet: 'a' }, { authorWallet: 'b' }],
      publicDiscoveryCache: null, publicDiscoverySaved: null, rawWalletAddress: id,
      restorePublicAllFeed: () => Promise.resolve(),
      requestPublicAllFeedPass: () => null,
      renderPublicDiscovery: (options: any) => paints.push({ error: options.error === true, loading: options.loading === true, looking: scope.publicDiscoveryProgress !== null, cards: (scope.publicDiscoveryResults ?? []).map((c: any) => c.authorWallet).join(',') }),
      publicDiscoveryPartialPainter: () => () => {},
      hydratePublicDiscoveryAvatarsOnce: async () => {},
      noteTonRpcRateLimit: () => false,
    };
    const refresh = inAppScope([fn('async function refreshPublicDiscovery('), fn('function mergeCatalogueFrame(')], 'refreshPublicDiscovery', scope);
    scope.discoverChannels = async () => { throw new Error('429'); };
    await refresh();
    expect(paints[0], 'the list stays while it looks').toEqual({ error: false, loading: false, looking: true, cards: 'a,b' });
    expect(paints.at(-1), 'the tap the stale line asks for does not empty the section').toEqual({ error: true, loading: false, looking: false, cards: 'a,b' });
    scope.publicDiscoveryResults = [];
    scope.publicDiscoverySaved = { at: 1, results: [{ authorWallet: 's' }] };
    await refresh();
    expect(paints.at(-1)).toEqual({ error: true, loading: false, looking: false, cards: 's' });
    scope.discoverChannels = async () => { const results = [{ authorWallet: 's2' }]; scope.publicDiscoveryCache = { at: Date.now(), results }; return results; };
    await refresh();
    expect(paints.at(-1)).toEqual({ error: false, loading: false, looking: false, cards: 's2' });
    scope.discoverChannels = async () => { const results = [{ authorWallet: 'x' }]; scope.publicDiscoveryCache = { at: Date.now(), results, partial: true }; return results; };
    await refresh();
    expect(paints.at(-1)).toEqual({ error: true, loading: false, looking: false, cards: 's2,x' });
  });

  it('ALL-23: what a broken-off sweep read is saved too — as a union with the device copy, read first, and marked incomplete', async () => {
    const order: string[] = [];
    const writes: any[] = [];
    const scope: any = {
      publicDiscoverySweepInFlight: null,
      publicDiscoveryCache: null,
      publicDiscoverySaved: null,
      rawWalletAddress: id,
      tonCell: { readSnakeCellBytes: () => new Uint8Array(0) },
      readProfileDocument: () => ({ profileBlock: { description: 'about', tags: [] } }),
      publicChannelIsDiscoverable: () => true,
      setChannelProfileFromWalk: () => {},
      publicAuthorLabel: (wallet: string) => wallet,
      PUBLIC_POST_BODY_MAX_BYTES: 1024,
      console: { warn: () => {} },
      readSavedChannelCatalogue: async () => { order.push('device copy read'); scope.publicDiscoverySaved = { at: 1, results: [{ authorWallet: 'old' }, { authorWallet: 'b', description: 'stale' }] }; },
      writeSavedChannelCatalogue: (cache: any, options: any) => { order.push('write'); writes.push([cache.results.map((c: any) => `${c.authorWallet}:${c.description ?? ''}`), options]); },
      directPublicLaneReader: () => ({
        sweepChannelCatalog: async ({ onProgress }: any) => {
          onProgress([{ channelWallet: 'b', card: {}, announcedAt: 1n }, { channelWallet: 'c', card: {}, announcedAt: 1n }], { done: 1, total: 64 });
          throw Object.assign(new Error('rate limited'), { status: 429 });
        },
      }),
    };
    scope.catalogueSaveTicket = 0;
    scope.CHANNEL_CATALOGUE_PROGRESS_SAVE_MS = 60_000;
    const sweep = inAppScope([fn('async function discoverChannelsFromBeacon('), fn('function mergeCatalogueFrame('), fn('async function saveCatalogueUnion(')], 'discoverChannelsFromBeacon', scope);
    const got = await sweep();
    expect(got.map((c: any) => c.authorWallet), 'the caller gets what was read').toEqual(['b', 'c']);
    expect(scope.publicDiscoveryCache.partial).toBe(true);
    expect(order.filter((step) => step === 'write'), 'the first frame kept as progress, and what was read when it broke off').toHaveLength(2);
    expect(order.filter((step) => step === 'device copy read'), 'each union reads the device copy first').toHaveLength(2);
    expect(writes.slice(-1), 'the copy is not cut: kept, refreshed from what was read, the new ones added — and marked incomplete').toEqual([
      [['old:', 'b:about', 'c:about'], { complete: false }],
    ]);
    const puts: any[] = [];
    const write = inAppScope([fn('function writeSavedChannelCatalogue(')], 'writeSavedChannelCatalogue', {
      CHANNEL_CATALOGUE_SAVED_FORMAT: 1, CHANNEL_CATALOGUE_SAVED_MAX: 10, WRITES_GENERATION: 17, publicDiscoverySaved: null, rawWalletAddress: id,
      channelCatalogueStore: async () => ({ put: async (_key: string, text: string) => { puts.push(JSON.parse(text).complete); } }),
    });
    write({ at: 1, results: [{ authorWallet: 'a' }] }, { complete: false });
    write({ at: 2, results: [{ authorWallet: 'a' }] });
    await new Promise((resolve) => setImmediate(resolve));
    expect(puts).toEqual([false, true]);
  });

  it('ALL-24: the list a running sweep has read so far is added to the copy every 15 s — never over a complete list written meanwhile', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const unionLists: any[][] = [];
    const complete: string[][] = [];
    const scope: any = {
      publicDiscoverySweepInFlight: null, publicDiscoveryCache: null, publicDiscoverySaved: null,
      CHANNEL_CATALOGUE_PROGRESS_SAVE_MS: 15_000, catalogueSaveTicket: 0,
      rawWalletAddress: id,
      tonCell: { readSnakeCellBytes: () => new Uint8Array(0) },
      readProfileDocument: () => ({ profileBlock: { description: 'about', tags: [] } }),
      publicChannelIsDiscoverable: () => true, setChannelProfileFromWalk: () => {}, publicAuthorLabel: (wallet: string) => wallet,
      PUBLIC_POST_BODY_MAX_BYTES: 1024, console: { warn: () => {} },
      saveCatalogueUnion: async (list: any[]) => { unionLists.push(list); },
      writeSavedChannelCatalogue: (cache: any) => { complete.push(cache.results.map((c: any) => c.authorWallet)); },
      directPublicLaneReader: () => ({
        sweepChannelCatalog: async ({ onProgress }: any) => {
          const item = (wallet: string) => ({ channelWallet: wallet, card: {}, announcedAt: 1n });
          onProgress([item('a')], { done: 1, total: 4 });
          vi.setSystemTime(105_000);
          onProgress([item('a'), item('b')], { done: 2, total: 4 });
          vi.setSystemTime(116_000);
          onProgress([item('a'), item('b'), item('c')], { done: 3, total: 4 });
          return [item('a'), item('b'), item('c'), item('d')];
        },
      }),
    };
    const sweep = inAppScope([fn('async function discoverChannelsFromBeacon(')], 'discoverChannelsFromBeacon', scope);
    await sweep();
    expect(unionLists.map((list) => list.map((c: any) => c.authorWallet)), 'the first frame, then nothing for 15 s, then the list so far — as copies').toEqual([['a'], ['a', 'b', 'c']]);
    expect(complete, 'and the complete list at the end').toEqual([['a', 'b', 'c', 'd']]);
    const written: any[] = [];
    let release: () => void = () => {};
    const unionScope: any = {
      catalogueSaveTicket: 0, publicDiscoverySaved: { at: 1, results: [{ authorWallet: 'x' }] }, rawWalletAddress: id,
      readSavedChannelCatalogue: () => new Promise<void>((resolve) => { release = resolve; }),
      writeSavedChannelCatalogue: (cache: any, options: any) => written.push([cache.results.map((c: any) => c.authorWallet), options]),
    };
    const union = inAppScope([fn('async function saveCatalogueUnion('), fn('function mergeCatalogueFrame(')], 'saveCatalogueUnion', unionScope);
    const pending = union([{ authorWallet: 'y' }]);
    unionScope.catalogueSaveTicket += 1;
    release();
    await pending;
    expect(written, 'the union is dropped: the complete list stands').toEqual([]);
    const next = union([{ authorWallet: 'y' }]);
    release();
    await next;
    expect(written).toEqual([[['x', 'y'], { complete: false }]]);
    expect(code(fn('function writeSavedChannelCatalogue('))).toContain('if (options.complete !== false) catalogueSaveTicket += 1;');
  });
  it('ALL-25: away from All the catalogue has the lowest priority — it gives way to the feed and the messages, and waits while hidden', async () => {
    const run = async (state: Record<string, any>) => {
      let ticks = 0;
      const scope: any = {
        publicDiscoveryOpen: false,
        document: { hidden: false },
        pageOnScreen: () => !scope.document.hidden,
        outboundWorkPausesBackground: () => false,
        CATALOGUE_TURN_POLL_MS: 1_000,
        delay: async () => { ticks += 1; if (ticks > 50) throw new Error('the turn never came'); state.tick?.(ticks, scope); },
        ...state,
      };
      await inAppScope([fn('async function waitForCatalogueTurn(')], 'waitForCatalogueTurn', scope)();
      return ticks;
    };
    expect(await run({ appSyncBusy: () => false }), 'nothing loading: the turn is at once').toBe(0);
    let busy = 3;
    expect(await run({ appSyncBusy: () => busy-- > 0 }), 'the feed loading: it waits, a second at a time, until the feed is done').toBe(3);
    expect(await run({ appSyncBusy: () => true, publicDiscoveryOpen: true }), 'on the All section it is the reader\'s own wait: no giving way').toBe(0);
    expect(await run({
      appSyncBusy: () => true,
      tick: (ticks: number, scope: any) => { if (ticks === 2) scope.publicDiscoveryOpen = true; },
    }), 'opening All releases a held sweep at the next check').toBe(2);
    expect(await run({
      appSyncBusy: () => false, document: { hidden: true },
      tick: (ticks: number, scope: any) => { if (ticks === 4) scope.document.hidden = false; },
    }), 'the app in the background: it waits for the reader to come back').toBe(4);
    const busySrc = code(fn('function appSyncBusy('));
    expect(busySrc).toContain("publicSyncPhase === 'syncing' || messageAutoSyncPhase === 'syncing'");
    expect(code(fn('async function discoverChannelsFromBeacon('))).toContain('waitForTurn: waitForCatalogueTurn,');
  });
});

describe('ALL — a channel a sweep names delisted leaves the screen, the saved copy and All, partial frames included [client audit round 10 — public-3]', () => {
  const card = (wallet: string) => ({ authorWallet: wallet, description: 'about', tags: [], name: wallet });
  const item = (wallet: string) => ({ channelWallet: wallet, card: {}, announcedAt: 1n });

  it('R10-P3-01: a sweep that breaks off after naming a channel delisted takes it out of the saved copy', async () => {
    const writes: string[][] = [];
    const scope: any = {
      publicDiscoverySweepInFlight: null,
      publicDiscoveryCache: null,
      publicCatalogueDelisted: new Set<string>(),
      publicDiscoverySaved: { at: 1, results: [card('gone'), card('a')] },
      readSavedChannelCatalogue: async () => scope.publicDiscoverySaved,
      catalogueSaveTicket: 0,
      CHANNEL_CATALOGUE_PROGRESS_SAVE_MS: 0,
      waitForCatalogueTurn: async () => {},
      rawWalletAddress: id,
      tonCell: { readSnakeCellBytes: () => new Uint8Array(0) },
      readProfileDocument: () => ({ profileBlock: { description: 'about', tags: [] } }),
      publicChannelIsDiscoverable: () => true,
      setChannelProfileFromWalk: () => {},
      publicAuthorLabel: (wallet: string) => wallet,
      writeSavedChannelCatalogue: (record: any) => { writes.push(record.results.map((c: any) => c.authorWallet)); scope.publicDiscoverySaved = record; },
      PUBLIC_POST_BODY_MAX_BYTES: 1024,
      console: { warn: () => {} },
      directPublicLaneReader: () => ({
        sweepChannelCatalog: async ({ onProgress }: any) => {
          onProgress([item('a')], { done: 1, total: 3, delisted: ['gone'] });
          throw Object.assign(new Error('rate limited'), { rateLimited: true });
        },
      }),
    };
    const sweep = inAppScope([fn('async function discoverChannelsFromBeacon('), fn('async function saveCatalogueUnion('),
      fn('function mergeCatalogueFrame('), fn('function noteCatalogueDelisted(')], 'discoverChannelsFromBeacon', scope);
    const results = await sweep({ onPartial: () => {} });
    expect(results.map((c: any) => c.authorWallet)).toEqual(['a']);
    expect(scope.publicDiscoveryCache.partial, 'the sweep broke off').toBe(true);
    expect(writes.length, 'the copy was written').toBeGreaterThan(0);
    for (const written of writes) expect(written, 'no written copy keeps the delisted channel').not.toContain('gone');
    expect(writes.at(-1)).toEqual(['a']);
  });

  it('R10-P3-02: a partial frame takes a named-delisted channel off the screen, and All reads it no more', () => {
    const delisted = new Set<string>(['gone']);
    const merge = inAppScope([fn('function mergeCatalogueFrame(')], 'mergeCatalogueFrame', { publicCatalogueDelisted: delisted, rawWalletAddress: id });
    expect(merge([card('gone'), card('a')], [card('a')]).map((c: any) => c.authorWallet), 'not final, still gone').toEqual(['a']);
    expect(merge([card('a')], [card('gone')]).map((c: any) => c.authorWallet), 'nor re-added by a frame').toEqual(['a']);
    const wallets = inAppScope([fn('function publicAllFeedWallets(')], 'publicAllFeedWallets', {
      publicCatalogueDelisted: delisted, rawWalletAddress: id, publicDiscoveryFollowedWallets: () => new Set(),
      publicAllFeedCatalogue: () => [card('gone'), card('a')], isOwnPublicAuthor: () => false,
      publicChannelVisibleUnderModeration: () => true, CHANNEL_CATALOGUE_SAVED_MAX: 512,
    });
    expect(wallets()).toEqual(['a']);
  });

  it('R10-P3-03: the lane names the delisted in every frame and beside its answer', () => {
    const lane = code(readFileSync('web/public-lane.mjs', 'utf8'));
    expect(lane).toContain('onProgress([...byWallet.values()], { done, total: buckets.length, delisted: [...delisted] });');
    expect(lane).toContain("Object.defineProperty(found, 'delisted', { value: [...delisted], enumerable: false });");
  });
});
