import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';


const app = readFileSync('web/app.js', 'utf8');
const html = readFileSync('web/index.html', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const line = (start: string) => { const at = app.indexOf(start); if (at < 0) throw new Error(`not found: ${start}`); return app.slice(at, app.indexOf(String.fromCharCode(10), at)); };
const liftWith = (env: Record<string, any>, sources: string[], exported: string) => {
  const scope = new Proxy(env, {
    has: (target, key) => typeof key === 'string' && (Object.prototype.hasOwnProperty.call(target, key) || !(key in globalThis)),
    get: (target: any, key) => (typeof key === 'string' && Object.prototype.hasOwnProperty.call(target, key) ? target[key] : (typeof key === 'string' ? () => undefined : undefined)),
    set: (target: any, key, value) => { target[key] = value; return true; },
  });
  // eslint-disable-next-line no-new-func
  return new Function('scope', `with (scope) {\n${sources.join('\n')}\nreturn ${exported};\n}`)(scope);
};
const same = (a: any, b: any) => Boolean(a) && Boolean(b) && String(a) === String(b);

describe('PROFILE DOORS — the author\'s profile card from the Public tab', () => {
  it('PROFILE-DOOR-01: a post\'s menu offers Profile always, and Channel unless that channel is the one on screen', () => {
    const opened: any[] = [];
    let menu: any = null;
    const env: any = {
      contactDisplayContextForWallet: () => ({ localLabel: null }), identityDisplayOptions: () => [], selectedIdentityDisplayOptionKey: () => null,
      plathoWallet: { address: 'ME' }, storedPlathoWalletRecord: () => null, sameWalletAddress: same,
      isContactPinned: () => false, isContactMuted: () => false, setContactPinned: () => {}, setContactMuted: () => {},
      renderDisplayAsPopover: (config: any) => { menu = config; },
      openProfileCardDialog: async (subject: any) => { opened.push(['profile', subject.wallet]); },
      openPublicChannelView: (source: any) => { opened.push(['channel', source.authorWallet]); },
      publicChannelViewOpen: false, publicChannelViewWallet: null,
    };
    const show = liftWith(env, [fn('function showPublicChannelDisplayPopover(channel, anchor) {')], 'showPublicChannelDisplayPopover');
    show({ authorWallet: 'HUNTER' }, {});
    expect(typeof menu.onOpenProfile, 'MEASURED before: no Profile row in the post menu').toBe('function');
    menu.onOpenProfile();
    menu.onOpenChannel();
    expect(opened).toEqual([['profile', 'HUNTER'], ['channel', 'HUNTER']]);
    env.publicChannelViewOpen = true;
    env.publicChannelViewWallet = 'HUNTER';
    show({ authorWallet: 'HUNTER' }, {});
    expect([typeof menu.onOpenProfile, menu.onOpenChannel]).toEqual(['function', null]);
    show({ authorWallet: 'OTHER' }, {});
    expect(typeof menu.onOpenChannel).toBe('function');
  });

  it('PROFILE-DOOR-04: the post\'s menu offers no pin and no mute — both act on the Private list, unseen from the Public tab', () => {
    let menu: any = null;
    const show = liftWith({
      contactDisplayContextForWallet: () => ({ localLabel: null }), identityDisplayOptions: () => [], selectedIdentityDisplayOptionKey: () => null,
      sameWalletAddress: same, isContactPinned: () => true, isContactMuted: () => true,
      renderDisplayAsPopover: (config: any) => { menu = config; }, publicChannelViewOpen: false, publicChannelViewWallet: null,
    }, [fn('function showPublicChannelDisplayPopover(channel, anchor) {')], 'showPublicChannelDisplayPopover');
    show({ authorWallet: 'HUNTER' }, {});
    expect([menu.pinned, menu.onTogglePin, menu.muted, menu.onToggleMute], 'MEASURED before: "Pin contact" and "Do not mark unread" under the post').toEqual([undefined, undefined, undefined, undefined]);
    const header = code(app.slice(app.indexOf('function showIdentityPopover(thread, anchor) {'), app.indexOf('function showPublicChannelDisplayPopover(')));
    expect(header).toContain('onTogglePin: pinWallet ? (next) => setContactPinned(pinWallet, next) : null,');
    expect(header).toContain('onToggleMute: pinWallet ? (next) => setContactMuted(pinWallet, next) : null,');
  });

  it('PROFILE-DOOR-02: the channel header\'s name and face open the author\'s card — not for a channel without a wallet; Enter and Space too', () => {
    const opened: any[] = [];
    const env: any = {
      publicChannelViewOpen: true, publicChannelViewWallet: 'HUNTER',
      openProfileCardDialog: async (subject: any) => { opened.push(subject.wallet); }, console,
    };
    const open = liftWith(env, [fn('function openPublicChannelAuthorProfile(event) {')], 'openPublicChannelAuthorProfile');
    let stopped = 0;
    open({ preventDefault() {}, stopPropagation() { stopped += 1; } });
    expect([opened, stopped], 'the face carries a picture: its tap is the card\'s, not the lightbox\'s').toEqual([['HUNTER'], 1]);
    env.publicChannelViewWallet = null;
    open({});
    env.publicChannelViewWallet = 'HUNTER';
    env.publicChannelViewOpen = false;
    open({});
    expect(opened, 'no wallet, or no channel open: nothing').toEqual(['HUNTER']);
    expect(html).toContain('<div class="conversation-title public-channel-profile-door" id="publicChannelViewProfileDoor">');
    expect(app).toContain("publicChannelViewProfileDoor?.addEventListener('click', openPublicChannelAuthorProfile);");
    expect(app).toContain("publicChannelViewAvatar?.addEventListener('click', openPublicChannelAuthorProfile);");
    expect(code(app)).toMatch(/publicChannelViewAvatar\?\.addEventListener\('keydown', \(event\) => \{\s*if \(publicChannelViewAvatar\.dataset\.profileDoor === 'true' && \(event\.key === 'Enter' \|\| event\.key === ' '\)\) openPublicChannelAuthorProfile\(event\);/);
    const render = code(fn('function renderPublicChannelView() {'));
    expect(render).toContain("publicChannelViewAvatar.setAttribute('role', 'button');");
    expect(render).toContain("publicChannelViewAvatar.removeAttribute('role');");
    expect(render, 'the name block keeps its heading').not.toContain("publicChannelViewProfileDoor.setAttribute('role'");
  });

  it('PROFILE-DOOR-03: inside the author\'s own channel, the name on a post opens the card instead of reopening the channel', () => {
    const row = code(app.slice(app.indexOf("    const openChannel = (event) => {"), app.indexOf("    meta.classList.add('feed-author-link');")));
    const guard = row.indexOf('if (publicChannelViewOpen && publicChannelViewWallet && sameWalletAddress(publicChannelViewWallet, item.authorWallet)) {');
    expect(guard, 'MEASURED before: the tap reopened the channel already on screen').toBeGreaterThan(-1);
    expect(row.indexOf('openProfileCardDialog({ wallet: publicChannelViewWallet })')).toBeGreaterThan(guard);
    expect(row.indexOf('openPublicChannelView({ channelId: item.channelId, authorWallet: item.authorWallet });')).toBeGreaterThan(guard);
  });
});

describe('PROFILE DOORS — a card over a themed channel: the channel stays dressed, the card wears the viewer\'s palette [2026-10-12]', () => {
  it('PROFILE-DOOR-05: the page keeps the channel\'s look while any card is open; the card\'s own element carries the viewer\'s palette', () => {
    const look = { appearance: { kind: 'look' } };
    const env: any = {
      channelLookPreview: null, walletUnlockPromise: null, profileCardDialog: { hidden: false }, profileCardSubject: 'ME',
      isPublicViewActive: () => true, appShell: { dataset: {} }, publicChannelViewOpen: true, publicChannelViewWallet: 'HUNTER',
      publicPostDetailOpen: false, publicPostDetailItem: null, rawWalletAddress: (w: any) => w, sameWalletAddress: same,
      plathoWallet: { address: 'ME' }, channelAppearancesVisible: () => true, cachedChannelProfile: () => look,
    };
    const onScreen = liftWith(env, [fn('function channelOnScreen() {')], 'channelOnScreen');
    expect(onScreen(), 'MEASURED before: null — any open card took the channel\'s theme off the page behind it').toBe(look);
    const props = new Map<string, string>();
    const card: any = { hidden: false, contains: () => false, dataset: {}, style: { setProperty: (n: string, v: string) => props.set(n, v), removeProperty: (n: string) => props.delete(n) } };
    const rule = (selectorText: string, decls: Record<string, string>) => ({ selectorText, style: Object.assign(Object.keys(decls), { getPropertyValue: (n: string) => decls[n] ?? '' }) });
    const scope: any = {
      channelDressActive: false, channelDressRestore: 'light', channelLookKey: null, profileCardDialog: card, identityPopover: null, identityPopoverAnchor: null,
      giftThemeChosen: () => false, wornGiftTheme: null, TELEGRAM_GIFT_THEME_PALETTE: 'dark',
      window: { matchMedia: () => ({ matches: false }) },
      document: { documentElement: { getAttribute: () => 'dark' }, styleSheets: [{ cssRules: [
        rule(':root', { '--accent': '#30d5b0', '--bg': '#0a0f12', '--cta-fill': 'var(--accent)' }),
        rule(':root[data-theme="light"]', { '--accent': '#0f9d81', '--bg': '#e9f0ee' }),
      ] }] },
    };
    const settle = liftWith(scope, [fn('function themeTokenNames() {'), fn('function stylesheetPalette(theme) {'), fn('function viewerCardPalette() {'),
      fn('function paintViewerPalette(element, on) {'), fn('function settleProfileCardPalette() {')], 'settleProfileCardPalette');
    settle();
    expect(props.size).toBe(0);
    scope.channelDressActive = true;
    settle();
    expect([props.get('--accent'), props.get('--bg'), props.get('--cta-fill'), props.get('color-scheme')], 'the viewer\'s light palette, as declared').toEqual(['#0f9d81', '#e9f0ee', 'var(--accent)', 'light']);
    scope.channelDressRestore = 'dark';
    settle();
    expect([props.get('--accent'), props.get('color-scheme')], 'MEASURED before: the copy taken before the switch stayed').toEqual(['#30d5b0', 'dark']);
    card.hidden = true;
    settle();
    expect(props.size, 'nothing left on a closed card').toBe(0);
  });
});

describe('PROFILE DOORS — the card\'s latest post opens the post [2026-10-12]', () => {
  const opener = () => {
    const calls: any[] = [];
    const env: any = {
      state: null as any, post: null as any, fetchError: null as any,
      discoveryLatestState: () => env.state,
      closeProfileCardDialog: () => calls.push('close'),
      setView: (view: string, options: any) => calls.push(['view', view, options.restoreRoom]),
      openPublicChannelView: (source: any) => calls.push(['channel', source.authorWallet]),
      showPermalinkNotice: () => {}, t: (key: string) => key, PERMALINK_OPENING_NOTICE_MS: 1,
      fetchPermalinkPostFromChain: async (entryId: string, wallet: string) => {
        calls.push(['fetch', entryId, wallet]);
        if (env.fetchError) throw env.fetchError;
        return env.post;
      },
      noteTonRpcRateLimit: () => false, console: { warn() {} },
      renderPublicSurface: () => calls.push('feed'),
      openPublicPostDetail: (post: any) => calls.push(['post', post.entryId]),
      profileCardDialog: { hidden: true, classList: { contains: () => false } }, actionDialog: { hidden: true }, closeActionDialog: () => calls.push('dialog'),
      appShell: { dataset: { view: 'public' } }, publicChannelViewOpen: false, publicChannelViewWallet: null, publicPostDetailOpen: false, publicPostDetailItem: null,
      walletSessionGeneration: 1, appNoticeFillToken: 0, eachCachedPublicPost: () => {}, sameWalletAddress: same, sharedOriginalCopyCurrent: () => true,
    };
    const open = liftWith(env, [line('let profileCardLatestPostPress = '), fn('function heldLatestPost(entryId, wallet) {'), fn('function publicScreenSnapshot() {'),
      fn('function sameScreenSnapshot(a, b) {'), fn('async function openProfileCardLatestPost(wallet) {')], 'openProfileCardLatestPost');
    return { env, calls, open };
  };

  it('PROFILE-DOOR-06: the line closes the card and opens the post, read by entry AND author; without it, the channel', async () => {
    const { env, calls, open } = opener();
    env.state = { status: 'ready', preview: 'Chapter 1', createdAtMs: 1, entryId: '7.2.41' };
    env.post = { entryId: '7.2.41' };
    expect(await open('EVA'), 'MEASURED before: the line had no handler at all').toBe(true);
    expect(calls).toEqual(['close', ['view', 'public', false], ['fetch', '7.2.41', 'EVA'], 'feed', ['post', '7.2.41']]);
    calls.length = 0; env.post = null;
    expect(await open('EVA')).toBe(false);
    expect(calls.at(-1)).toEqual(['channel', 'EVA']);
    calls.length = 0; env.fetchError = new Error('down');
    expect(await open('EVA')).toBe(false);
    expect(calls.at(-1)).toEqual(['channel', 'EVA']);
    calls.length = 0; env.fetchError = null; env.state = { status: 'ready', preview: 'x', createdAtMs: 1, entryId: null };
    await open('EVA');
    expect(calls).toEqual(['close', ['view', 'public', false], ['channel', 'EVA']]);
    calls.length = 0; env.state = { status: 'loading' };
    expect([await open('EVA'), calls]).toEqual([false, []]);
  });

  it('PROFILE-DOOR-07: the coordinates ride the answer and its stored copy; the ready line is a button (click, Enter, Space)', () => {
    const read = liftWith({}, [fn('function storedLatestPostFromText(text) {')], 'storedLatestPostFromText');
    expect(read(JSON.stringify({ status: 'ready', preview: 'p', createdAtMs: 5, entryId: '7.2.41' }))).toEqual({ status: 'ready', preview: 'p', createdAtMs: 5, entryId: '7.2.41', attempts: 0 });
    expect(read(JSON.stringify({ status: 'ready', preview: 'p', createdAtMs: 5 })).entryId, 'a copy stored before 2026-10-12').toBe(null);
    expect(code(fn('async function writeStoredLatestPost(rawWallet, state) {'))).toContain('entryId: state.entryId ?? null }');
    expect(code(fn('async function loadDiscoveryLatestPost(wallet, generation) {'))).toContain('entryId: latest.entryId === undefined || latest.entryId === null ? null : String(latest.entryId),');
    const node = code(fn('function buildDiscoveryLatestNode(wallet) {'));
    const ready = node.slice(node.indexOf("block.dataset.state = 'ready';"), node.indexOf("block.dataset.state = 'loading';"));
    expect(ready).toContain("block.setAttribute('role', 'button');");
    expect(ready).toContain('block.tabIndex = 0;');
    expect(ready).toContain("block.addEventListener('click', () => { void openProfileCardLatestPost(wallet); });");
    expect(ready).toMatch(/if \(event\.key !== 'Enter' && event\.key !== ' '\) return;\s*event\.preventDefault\(\);\s*void openProfileCardLatestPost\(wallet\);/);
    expect(node.slice(node.indexOf("block.dataset.state = 'loading';")), 'a loading line is no door').not.toContain('openProfileCardLatestPost');
  });
});
