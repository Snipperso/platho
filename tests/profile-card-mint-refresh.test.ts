import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { sourceBlock } from './helpers/source';


const app = readFileSync('web/app.js', 'utf8');
const fn = (start: string, source = app) => sourceBlock(source, start);
const flush = async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); };

type Read = { owned: { label: string, itemAddress: string }[], complete: boolean };

function world(source = app, { worn: wornAtStart = null as string | null } = {}) {
  let worn = wornAtStart;
  const statuses: string[] = [];
  const known = new Set(['platho', 'mossgrove']);
  const painted: string[][] = [];
  const doneLanes: string[] = [];
  const calls = { stored: 0, loads: 0, hero: 0 };
  const held: (() => void)[] = [];
  let holdNext = false;
  const listOf = (): Read => ({ owned: [...known].map((label) => ({ label, itemAddress: `item:${label}` })), complete: true });
  const env: Record<string, any> = {
    console: { warn: () => {}, error: () => {} },
    window: { setTimeout, clearTimeout },
    t: (key: string) => key,
    requireBasechainAddress: (value: string) => value,
    sameWalletAddress: (a: string, b: string) => Boolean(a) && String(a) === String(b),
    WALLET_DISPLAY_MODES: { PLATHO_NFT: 'platho_nft' },
    setUsernameMintStatus: (text: string) => { statuses.push(text); },
    waitForPlathoUsernameOwnership: async (label: string, owner: string) => ({ label: `${label}.ath`, ownerWallet: owner }),
    readLinkedPlathoUsername: () => (worn ? { label: worn } : null),
    writeLinkedPlathoUsername: (identity: { label: string }) => { worn = identity.label; },
    addKnownPlathoUsername: (label: string) => { known.add(label.replace(/\.ath$/, '')); },
    writeWalletDisplayIdentity: () => {},
    clearPendingUsernameMint: () => {},
    canonicalUsernameDisplay: (label: string) => String(label ?? '').replace(/\.ath$/, ''),
    renderWalletIdentity: () => {},
    dressProfileCardHero: () => { calls.hero += 1; },
    renderProfileCardMeta: () => {},
    markProfileCardLaneDone: (_wallet: string, lane: string) => { doneLanes.push(lane); },
    readStoredUsernameNftList: async () => { calls.stored += 1; return null; },
    writeStoredUsernameNftList: async () => {},
    loadUsernameNftsForWallet: () => {
      calls.loads += 1;
      const answer = listOf();
      if (holdNext) { holdNext = false; return new Promise<Read>((resolve) => held.push(() => resolve(answer))); }
      return Promise.resolve(answer);
    },
    paint: (result: Read | null) => { painted.push((result?.owned ?? []).map((item) => item.label)); },
  };
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  const api = new Function(...names, `
    let plathoWallet = { address: 'W' };
    let profileCardSubject = null;
    const profileCardDialog = { hidden: true };
    let profileCardNamesConfirmedFor = null;
    let profileCardNamesShown = null;
    let profileCardNamesLaneGeneration = 0;
    let profileCardLanesDone = new Set();
    let profileCardLanesPartial = new Set();
    let profileCardRetryTimers = [];
    const PROFILE_CARD_RETRY_LADDER_MS = [0, 4_000, 12_000, 30_000];
    const PROFILE_CARD_MAX_ATTEMPTS = PROFILE_CARD_RETRY_LADDER_MS.length + 1;
    function renderProfileCardNames(result) {
      profileCardNamesShown = result ? { subject: profileCardSubject, result } : null;
      paint(result);
    }
    ${fn('function driveProfileCardRead(subject, lane, attempt = 0) {', source)}
    ${fn('function scheduleProfileCardRetry(subject, lane, attempt) {', source)}
    ${fn('function startProfileCardNamesLane(raw, own, { shown = null } = {}) {', source)}
    ${fn('function refreshOwnProfileCardNames(owner) {', source)}
    ${fn('async function autoLinkMintedUsername(username, ownerWallet, options = {}) {', source)}
    return {
      open(raw) { profileCardSubject = raw; profileCardDialog.hidden = false; startProfileCardNamesLane(raw, raw === plathoWallet.address); },
      close() { profileCardSubject = null; profileCardDialog.hidden = true; },
      mint: (name) => autoLinkMintedUsername(name, 'W'),
    };`)(...names.map((name) => env[name]));
  return { api, painted, doneLanes, calls, held, statuses, worn: () => worn, hold: () => { holdNext = true; } };
}

describe('A name minted from the profile card is listed on it', () => {
  it('MINT-CARD-01: the mint links the name and the open own card lists it, with the frame re-dressed and the lane settled again', async () => {
    const w = world();
    w.api.open('W');
    await flush();
    expect(w.painted.at(-1)).toEqual(['platho', 'mossgrove']);
    await w.api.mint('ternlight');
    await flush();
    expect(w.painted.at(-1), 'the grid after the mint').toEqual(['platho', 'mossgrove', 'ternlight']);
    expect(w.calls.hero, 'worn mark and frame describe the new link').toBe(1);
    expect(w.doneLanes.filter((lane) => lane === 'names'), 'the foot settles again on the new answer').toHaveLength(2);
    expect(w.calls.stored, 'the grid already on screen stands in for the stored copy').toBe(1);

    const unfixed = world(app.replace(/\n\s*refreshOwnProfileCardNames\(owner\);[^\n]*/, ''));
    unfixed.api.open('W');
    await flush();
    await unfixed.api.mint('ternlight');
    await flush();
    expect(unfixed.painted.at(-1), 'MEASURED before: the card kept the list it opened with').toEqual(['platho', 'mossgrove']);
  });

  it('MINT-CARD-02: a read begun before the mint never paints over the one begun after', async () => {
    const w = world();
    w.hold();
    w.api.open('W');
    await w.api.mint('ternlight');
    await flush();
    expect(w.painted.at(-1)).toEqual(['platho', 'mossgrove', 'ternlight']);
    w.held.forEach((land) => land());
    await flush();
    expect(w.painted.at(-1), 'the older read lands last and paints nothing').toEqual(['platho', 'mossgrove', 'ternlight']);

    const unguarded = world(app.replace(
      'const current = () => profileCardSubject === raw && profileCardNamesLaneGeneration === generation;',
      'const current = () => profileCardSubject === raw;'));
    unguarded.hold();
    unguarded.api.open('W');
    await unguarded.api.mint('ternlight');
    await flush();
    unguarded.held.forEach((land) => land());
    await flush();
    expect(unguarded.painted.at(-1), 'without the generation the stale list comes back').toEqual(['platho', 'mossgrove']);
  });

  it('MINT-CARD-03: no card, or another wallet\'s card, is not read for a mint', async () => {
    const closed = world();
    await closed.api.mint('ternlight');
    await flush();
    expect([closed.calls.loads, closed.calls.hero]).toEqual([0, 0]);

    const other = world();
    other.api.open('X');
    await flush();
    const loads = other.calls.loads;
    await other.api.mint('ternlight');
    await flush();
    expect([other.calls.loads - loads, other.calls.hero], 'a contact\'s card is not about this mint').toEqual([0, 0]);

    const shut = world();
    shut.api.open('W');
    await flush();
    shut.api.close();
    const before = shut.calls.loads;
    await shut.api.mint('ternlight');
    await flush();
    expect(shut.calls.loads - before, 'a closed card reads nothing').toBe(0);
  });

  it('MINT-CARD-05: only a first name is worn by itself — a wallet already wearing one keeps it, and the new one is listed', async () => {
    const wearing = world(app, { worn: 'platho.ath' });
    wearing.api.open('W');
    await flush();
    expect(await wearing.api.mint('ternlight')).toBe(null);
    await flush();
    expect(wearing.worn(), 'the worn name stays').toBe('platho.ath');
    expect(wearing.statuses.at(-1), 'the pill says minted, not linked').toBe('username.minted');
    expect(wearing.painted.at(-1), 'the new name is on the card, a tap away').toEqual(['platho', 'mossgrove', 'ternlight']);

    const first = world();
    first.api.open('W');
    await flush();
    await first.api.mint('ternlight');
    await flush();
    expect([first.worn(), first.statuses.at(-1)], 'a wallet wearing nothing wears its first name').toEqual(['ternlight.ath', 'username.linked']);

    const always = world(app.replace('const linked = readLinkedPlathoUsername(owner) ? null : {', 'const linked = {'), { worn: 'platho.ath' });
    always.api.open('W');
    await flush();
    await always.api.mint('ternlight');
    await flush();
    expect(always.worn(), 'MEASURED before: the new name replaced the worn one').toBe('ternlight.ath');
  });

  it('MINT-CARD-06: the pill\'s word is in every locale', async () => {
    const { I18N_STRINGS } = await import('../web/i18n-strings.mjs') as any;
    const locales = Object.keys(I18N_STRINGS);
    expect(locales.length).toBeGreaterThanOrEqual(10);
    for (const locale of locales) expect(I18N_STRINGS[locale]['username.minted'], locale).toMatch(/\{name\}/);
  });

  it('MINT-CARD-04: the card opens through the same lane', () => {
    const open = fn('async function openProfileCardDialog(subject) {');
    expect(open).toMatch(/clearProfileCardRetries\(\);\s*\n\s*startProfileCardNamesLane\(raw, own\);/);
    expect(open, 'a card opened anew keeps no list from before').toMatch(/profileCardNames\.replaceChildren\(\);\s*\n\s*profileCardNamesShown = null;/);
  });
});

describe('a tile\'s window answers onto the list on screen [client audit round 144 — C12-1]', () => {
  class El {
    tag: string; children: any[] = []; dataset: Record<string, string> = {}; handlers: Record<string, Function[]> = {}; textContent = ''; hidden = false;
    className = ''; classList = { add() {}, remove() {}, toggle() {} }; type = ''; src = ''; alt = ''; loading = '';
    constructor(tag: string) { this.tag = tag; }
    append(...n: any[]) { this.children.push(...n); }
    replaceChildren(...n: any[]) { this.children = [...n]; }
    addEventListener(type: string, f: Function) { (this.handlers[type] ??= []).push(f); }
    setAttribute() {} removeAttribute() {}
  }
  const find = (el: any, cls: string) => { const out: any[] = []; (function walk(n: any) { if (!n?.children) return; if (String(n.className).includes(cls)) out.push(n); n.children.forEach(walk); })(el); return out; };
  const labels = (grid: any) => find(grid, 'profile-card-name-label').map((n) => n.textContent);
  const mk = (...names: string[]) => ({ owned: names.map((label) => ({ label, itemAddress: `i:${label}` })), complete: true });

  function card(source = app) {
    const env: Record<string, any> = {
      document: { createElement: (tag: string) => new El(tag) },
      t: (key: string) => key, tPlural: (key: string) => key,
      canonicalUsernameDisplay: (label: string) => String(label ?? '').replace(/\.ath$/, ''),
      readLinkedPlathoUsername: () => null, wearPlathoUsername() {}, dressProfileCardHero() {}, wornNamePublished: () => false,
      offerWornNamePublish: async () => false, offeredWaitingBuild: () => false, shortAddress: (a: string) => a, hasActivePlathoAccount: () => false,
      sameWalletAddress: (a: string, b: string) => a === b, console: { warn() {}, error() {} },
      renderProfileCardMeta() {}, markProfileCardLaneDone() {}, readStoredUsernameNftList: async () => null, writeStoredUsernameNftList: async () => {},
      window: { setTimeout, clearTimeout },
    };
    const names = Object.keys(env);
    // eslint-disable-next-line no-new-func
    return new Function(...names, `
      let plathoWallet = { address: 'W' }; let profileCardSubject = 'W'; const profileCardDialog = { hidden: false };
      const profileCardNames = document.createElement('div'); const profileCardNamesNote = document.createElement('p');
      let profileCardNamesShown = null; let profileCardNamesConfirmedFor = null; let profileCardNamesLaneGeneration = 0;
      let profileCardLanesDone = new Set(); let profileCardLanesPartial = new Set(); let profileCardRetryTimers = [];
      const PROFILE_CARD_RETRY_LADDER_MS = [0, 4000, 12000, 30000]; const PROFILE_CARD_MAX_ATTEMPTS = 5;
      let answerTransfer = null;
      function openUsernameNftTransferDialog() { return new Promise((resolve) => { answerTransfer = resolve; }); }
      let nextLoad = null; function loadUsernameNftsForWallet() { return new Promise((resolve) => { nextLoad = resolve; }); }
      ${fn('function renderProfileCardNames(result, own', source)}
      ${fn('function driveProfileCardRead(subject, lane, attempt = 0) {', source)}
      ${fn('function scheduleProfileCardRetry(subject, lane, attempt) {', source)}
      ${fn('function startProfileCardNamesLane(raw, own, { shown = null } = {}) {', source)}
      ${fn('function refreshOwnProfileCardNames(owner) {', source)}
      return { grid: profileCardNames, start: startProfileCardNamesLane, refresh: refreshOwnProfileCardNames,
        land: (r) => { const f = nextLoad; nextLoad = null; f(r); }, answer: (v) => answerTransfer(v) };`)(...names.map((name) => env[name]));
  }

  const run = async (source = app) => {
    const c = card(source);
    c.start('W', true);
    await flush(); c.land(mk('x')); await flush();
    find(c.grid.children[0], 'profile-card-gift-send')[0].handlers.click[0]();
    c.refresh('W'); await flush(); c.land(mk('x', 'y')); await flush();
    const refreshed = labels(c.grid);
    c.answer(true); await flush();
    return { refreshed, after: labels(c.grid) };
  };

  it('MINT-CARD-07: the refreshed list stands; the name sent leaves it — MUTATION: the list the tile was drawn from, the new name gone', async () => {
    expect(await run()).toEqual({ refreshed: ['x', 'y'], after: ['y'] });
    const old = app.replace('const shown = profileCardNamesShown?.subject === subjectAtRender ? profileCardNamesShown : { result, flags };', 'const shown = { result, flags };');
    expect(old).not.toBe(app);
    expect((await run(old)).after, 'MEASURED before (round 144, C12): the grid went back to the list before the mint').toEqual([]);
  });
});
