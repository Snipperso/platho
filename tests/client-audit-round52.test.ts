import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';


const app = readFileSync('web/app.js', 'utf8');
const css = readFileSync('web/styles.css', 'utf8');
const fn = (start: string) => sourceBlock(app, start);
const lift = (env: Record<string, any>, sources: string[], exported: string) => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [...sources, `return ${exported};`].join(String.fromCharCode(10)))(...names.map((n) => env[n]));
};

describe('client audit round 52', () => {
  it('R52-01 (C1-1, C3-1, C4-1, C4-2, C4-3): last time\'s balance is muted wherever it is drawn, and not spoken as the balance', () => {
    const reveal = css.slice(css.indexOf('.rail-vault-balance-reveal {'), css.indexOf('}', css.indexOf('.rail-vault-balance-reveal {')));
    expect(reveal, 'MEASURED before: `both` held opacity 1 over the muting rule on the card and the bar').toContain('animation: rail-balance-fade-in 0.45s ease-out backwards;');
    const frames = css.slice(css.indexOf('@keyframes rail-balance-fade-in {'), css.indexOf('/* Kept for the global header sync indicator'));
    const to = frames.slice(frames.indexOf('to {'));
    expect(to.slice(0, to.indexOf('}')), 'no opacity at its end').not.toContain('opacity');
    expect(css).toMatch(/:root\[data-stale-ton\] \[data-wallet-balance-row="TON"\],\s*:root\[data-stale-ath\] \[data-wallet-balance-row="ATH"\],\s*:root\[data-stale-balance\] \[data-nav-vault-balance\] \{\s*opacity: 0\.7;/);
    expect(css, 'no muting left on a class a row drawn later does not have').not.toContain('.is-stale');
    const attrs = new Set<string>();
    const root = { toggleAttribute: (name: string, on: boolean) => { if (on) attrs.add(name); else attrs.delete(name); }, hasAttribute: (name: string) => attrs.has(name) };
    const container = () => {
      const classes = new Set<string>(['is-pending']);
      const own = new Map<string, string>();
      return { classes, own, classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c), contains: (c: string) => classes.has(c) },
        setAttribute: (k: string, v: string) => own.set(k, v), removeAttribute: (k: string) => own.delete(k) };
    };
    const containers = [container(), container()];
    const state: any = { wallet: { ton_balance: null, ath_balance: null } };
    let snapshot = false;
    const refresh = lift({
      document: { documentElement: root, querySelectorAll: () => [] }, navVaultBalanceContainers: containers, vaultPocketState: state,
      navVaultBalanceShowable: () => snapshot || (state.wallet.ton_balance !== null && state.wallet.ath_balance !== null),
      navVaultBalanceHasKnownValue: () => state.wallet.ton_balance !== null && state.wallet.ath_balance !== null,
      setText: () => {}, walletBalanceRowText: () => '', walletFormattedBalance: () => '1', navVaultTonBalances: [], navVaultAthBalances: [],
      syncProfileBalanceCardBalances: () => {},
    }, [fn('function walletShortAmount(text) {'), fn('function refreshNavVaultBalance() {')], 'refreshNavVaultBalance');
    refresh();
    expect([[...attrs], containers[0].own.get('aria-hidden')], 'nothing known, nothing kept: hidden, nothing flagged').toEqual([[], 'true']);
    snapshot = true;
    refresh();
    expect([[...attrs].sort(), containers.map((c) => c.own.get('aria-hidden'))], 'last time\'s: all flagged, and not spoken')
      .toEqual([['data-stale-ath', 'data-stale-balance', 'data-stale-ton'], ['true', 'true']]);
    state.wallet.ton_balance = 2n;
    refresh();
    expect([...attrs].sort(), 'GRAM read, ATH not yet: ATH alone, and the card and bar wait for both').toEqual(['data-stale-ath', 'data-stale-balance']);
    state.wallet.ath_balance = 5n;
    refresh();
    expect([[...attrs], containers.map((c) => c.own.has('aria-hidden'))], 'both read: nothing flagged, spoken').toEqual([[], [false, false]]);
  });

  it('R52-02 (C2-01): a 429 the Public tab\'s background work meets is its own — the flag that refuses Send is armed only with All on screen', () => {
    const limited = Object.assign(new Error('429'), { code: 'RATE_LIMITED' });
    const noted: any[] = [];
    const note = (open: boolean) => lift({ publicDiscoveryOpen: open, noteTonRpcRateLimit: (e: any) => { noted.push(e); return true; },
      isTonRpcRateLimitError: (e: any) => e === limited }, [fn('function notePublicBackgroundRateLimit(error) {')], 'notePublicBackgroundRateLimit');
    expect([note(false)(limited), note(false)(new Error('other')), noted.length], 'off All: told apart, not announced').toEqual([true, false, 0]);
    expect([note(true)(limited), noted.length], 'on All: the screen\'s, announced').toEqual([true, 1]);
    const pass = code(fn('async function publicAllFeedPassBody() {'));
    expect(pass).toContain("outcome.cut = notePublicBackgroundRateLimit(error) ? 'rate' : 'unmeasured';");
    expect(pass).toContain('if (notePublicBackgroundRateLimit(error)) {');
    expect(pass).not.toContain('noteTonRpcRateLimit(');
    expect(code(fn('function runPublicAllFeedPass() {'))).toContain("if (!notePublicBackgroundRateLimit(error)) console.warn('[public] the All feed pass failed; what is kept stays', error);");
    expect(code(fn('function warmPublicCatalogue() {'))).toContain('again = notePublicBackgroundRateLimit(error);');
    expect(code(fn('async function loadProfileAvatarImage('))).toContain('if (!(background ? isTonRpcRateLimitError(error) : noteTonRpcRateLimit(error))) console.error(error);');
    expect(code(fn('async function hydrateProfileAvatarsForWallets('))).toContain('if (!(onView ? noteTonRpcRateLimit(error) : isTonRpcRateLimitError(error))) console.error(error);');
    expect(code(fn('function runPublicAllFeedPass() {')), 'and no faces asked behind the park the pass met')
      .toContain("if (!publicDiscoveryOpen && publicAllFeedPassOutcome?.cut !== 'rate') hydratePublicAllFeedFaces();");
  });

  it('R52-03 (C2-07, C2-05, C5-3): a pass\'s outcome is its own; the background waits while the app is not seen, a minimised Mini App too', async () => {
    const body = lift({ restorePublicAllFeed: async () => {}, directPublicLaneReader: () => null },
      ["let publicAllFeedPassOutcome = { cut: 'rate', read: 3 };", fn('async function publicAllFeedPassBody() {'),
        'const read = () => publicAllFeedPassOutcome;'], '{ body: publicAllFeedPassBody, read }');
    await body.body();
    expect(body.read(), 'a pass that returned early leaves no cut for the ladder to act on').toBeNull();
    expect(code(fn('async function waitForCatalogueTurn() {'))).toContain('while (!pageOnScreen() || outboundWorkPausesBackground() ||');
    expect(app).toMatch(/setInterval\(\(\) => \{\s*if \(!pageOnScreen\(\)\) return;[^\n]*\n\s*warmPublicCatalogue\(\);/);
  });
});
