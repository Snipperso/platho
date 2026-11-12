import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { code, sourceBlock } from './helpers/source';
import { I18N_STRINGS } from '../web/i18n-strings.mjs';
import { identityTypeLabel, RECIPIENT_IDENTITY_TYPES } from '../web/recipient-identities.mjs';


const read = (path: string) => readFileSync(path, 'utf8');
const app = read('web/app.js');
const fn = (start: string) => sourceBlock(app, start);
const lift = (env: Record<string, any>, sources: string[], exported: string) => {
  const names = Object.keys(env);
  // eslint-disable-next-line no-new-func
  return new Function(...names, [...sources, `return ${exported};`].join(String.fromCharCode(10)))(...names.map((n) => env[n]));
};
const NEW_KEYS = ['group.askSent', 'wallet.sendNotConfirmed', 'public.channelAddedFlash', 'wallet.otherWalletsHintPlain', 'group.askLinkNeedsActivation',
  'profile.language.reloadHint', 'identity.walletAddress', 'identity.tonDns', 'identity.plathoNft', 'identity.anonymousSender', 'wallet.recipientTypo'];

describe('round 153 low list', () => {
  it('R163-01 (C6-4): a request through a public link, sent before the room is held, is said as a request — in the row and in the bubble', () => {
    const preview = (record: any, type: 'out' | 'in') => lift({
      groupTokenTextOf: () => 'token', parseGroupInviteToken: () => null, parseGroupJoinToken: () => ({ groupId: 'g1', name: 'Someone' }),
      groupInviteTitleText: () => 'invite', groupRuntimeInstance: { get: () => record },
      t: (key: string, vars?: any) => `${key}${vars?.name ? `(${vars.name})` : ''}`,
    }, [fn('function groupTokenPreviewText(message) {')], 'groupTokenPreviewText')({ type });
    expect(preview(null, 'out'), 'MEASURED before: "Joined “Group” — your key has been sent"').toBe('group.askSent');
    expect(preview({ name: 'Room' }, 'out'), 'let in: joined').toBe('group.joinSent(Room)');
    expect(preview(null, 'in'), 'the admin\'s side as before').toBe('group.joinReceived(group.untitled)');
    expect(fn('function buildGroupJoinCard(join, mine) {'))
      .toContain("title.textContent = mine ? (record ? t('group.joinSent', { name: groupName }) : t('group.askSent')) : t('group.joinReceived', { name: groupName });");
  });

  it('R163-02 (C6-5): a send or a swap refused for no known reason says what to do, never one word', () => {
    const refusal = lift({
      gramShortfallText: () => null, walletTransferNotRun: () => false,
      t: (key: string) => key,
    }, [fn('function walletAssetSendRefusal(error) {')], 'walletAssetSendRefusal');
    expect(refusal(Object.assign(new Error('403'), { code: 'BROADCAST_REFUSED' })), 'MEASURED before: the one word "blocked"').toBe('wallet.sendNotConfirmed');
    expect(fn("sendWalletTonButton?.addEventListener('click',")).toContain(": walletTransferNotRun(error) ? t('wallet.transferNotRun') : t('wallet.sendNotConfirmed'));");
    expect(I18N_STRINGS.en['vault.activationBlocked'], 'the activation\'s own refusal').toBe('activation did not go through — try again');
  });

  it('R163-03 (C6-6): the waits say they are waits — Activate, Buy from the reserve, an added channel', async () => {
    const activation = fn('async function runAccountActivation({ line = null } = {}) {');
    expect(activation).toContain("holdStatusText(vaultDraftStatus, t('profile.statusChecking'), { scope: plathoWallet?.address ?? null, ms: ACTIVATION_CHECKING_HOLD_MS, refresh: refreshMessagingControls });");
    expect(activation).toContain("holdStatusText(line, t('dialog.checking'), { scope: line === privateComposerCostStatus ? activeThreadId : publicComposerHoldScope(), ms: ACTIVATION_CHECKING_HOLD_MS,");
    expect(activation).toContain('for (const [node, hold] of checkingHolds) if (hold && heldStatusText.get(node) === hold) heldStatusText.delete(node);');
    expect(activation).toMatch(/\} finally \{\s*releaseChecking\(\);\s*refreshMessagingControls\(\);/);
    const held = new WeakMap();
    const row: any = { textContent: '' };
    const line: any = { textContent: '' };
    const run = lift({
      t: (key: string) => key, registerVaultKeysButton: {}, vaultDraftStatus: row, privateComposerCostStatus: line, publicComposerCostStatus: {},
      plathoWallet: { address: 'W' }, activeThreadId: 't', publicComposerHoldScope: () => 'p', heldStatusText: held,
      holdStatusText: (node: any, text: string) => { node.textContent = text; held.set(node, { text }); },
      submitVaultRegisterMessagingKeys: async () => { if (!(held.get(row)?.text === 'profile.statusChecking' && held.get(line)?.text === 'dialog.checking')) throw new Error('not held'); },
      refreshMessagingControls: () => {}, refreshComposerCostStatus: () => {}, noteTonRpcRateLimit: () => false, gramShortfallText: () => null,
      speakToScreenReader: () => {}, appendLineButton: () => {}, document: { createElement: () => ({ addEventListener() {} }) }, showReceiveWalletTonDialog: () => {},
      console: { error() {} },
    }, ['const ACTIVATION_CHECKING_HOLD_MS = 30_000;', activation], 'runAccountActivation');
    await run({ line });
    expect([held.has(row), held.has(line)], 'the window opened over a held "checking", let go after').toEqual([false, false]);
    expect(fn('async function openBuyAthDialog() {')).toMatch(/setText\(buyAthStatus, t\('profile\.statusChecking'\)\);\s*try \{\s*await refreshMarketStabilityState\(\{ fresh: true \}\);\s*\} finally \{\s*renderBuyAthStatus\(\);\s*\}/);
    expect(fn('async function openAddPublicChannelDialog() {')).toMatch(/setPublicStatus\('channel added'\);\s*(?:\/\/[^\n]*\n\s*)*flashWalletIdentityStatus\(t\('public\.channelAddedFlash'\), 4_000\);/);
  });

  it('R163-05 (C6-8, C6-9): Other wallets is named where it is; the cloud explained only over a cloud; no empty section, no empty box', () => {
    for (const lang of Object.keys(I18N_STRINGS)) {
      const strings = (I18N_STRINGS as any)[lang];
      expect(strings['wallet.telegramKeepsEarlierCopy'], lang).toContain(`${strings['nav.profile']} → `);
      expect(strings['wallet.otherWalletsHintPlain'], lang).not.toContain('☁');
    }
    expect(app).toContain("hint: list.querySelector('.wallet-list-cloud') ? t('wallet.otherWalletsHint') : t('wallet.otherWalletsHintPlain'),");
    expect(app).toMatch(/replaceVaultKeysButton\.hidden = true;\s*replaceVaultKeysButton\.disabled = true;\s*(?:\/\/[^\n]*\n\s*)*const section = replaceVaultKeysButton\.closest\('\.profile-section'\);\s*if \(section\) section\.hidden = true;/);
    expect(app).toContain("else profileBalanceCardSelect.value = '';");
    expect(read('web/index.html')).toMatch(/<select id="profileBalanceCardSelect"[^>]*>\s*<option value="" disabled hidden>—<\/option>/);
  });

  it('R163-NAV-01 (C6-10): Back to the app\'s first entry takes a link the app acted on out of the bar', () => {
    const run = (path: string, open: Record<string, string> = {}) => {
      const calls: any[] = [];
      const drop = lift({
        publicPane: { dataset: open },
        location: { pathname: path }, history: { state: { s: 1 }, replaceState: (...args: any[]) => calls.push(args) },
        parsePublicPostPermalink: (p: string) => p.startsWith('/post/'), parsePublicChannelPermalink: (p: string) => p.startsWith('/channel/'),
        parseGroupAskLink: (p: string) => p.startsWith('/ask/'), parsePublicGroupJoinLink: (p: string) => p.startsWith('/join/'),
      }, [fn('function dropActedLinkFromAddressBar() {')], 'dropActedLinkFromAddressBar');
      drop();
      return calls;
    };
    expect(run('/post/abc'), 'MEASURED before: a reload opened the post again').toEqual([[{ s: 1 }, '', '/']]);
    expect(run('/join/xyz'), 'and a /join/ link asked again').toEqual([[{ s: 1 }, '', '/']]);
    expect(run('/'), 'the app\'s own path is left alone').toEqual([]);
    expect(run('/channel/abc', { channelOpen: 'true' }), 'MEASURED before: a window\'s Back over a linked channel dropped its link').toEqual([]);
    expect(run('/post/abc', { postOpen: 'true' })).toEqual([]);
    expect(run('/channel/abc', { channelOpen: 'false' }), 'closed: dropped').toEqual([[{ s: 1 }, '', '/']]);
    const handler = code(/window\.addEventListener\('popstate', \(\) => \{([\s\S]*?)\n {4}\}\);/.exec(app)?.[1] ?? '');
    expect(handler, 'on the silent path').toContain('syncNavBackAffordance(); dropActedLinkFromAddressBar(); return; }');
    expect(handler, 'and after the overlay closed').toMatch(/closeNavOverlay\(\);\s*dropActedLinkFromAddressBar\(\);\s*$/);
  });

  it('R163-06 (C6-12): no request link while the chain says the wallet has no account', () => {
    expect(fn('async function copyGroupAskLink(groupId, record) {')).toMatch(/if \(!wallet\) return;\s*(?:\/\/[^\n]*\n\s*)*(?:\/\/[^\n]*\n\s*)*if \(ownKeyShardKnownAbsent\(\) && !plathoActivationInFlightForCurrentWallet\(\)\) \{\s*flashWalletIdentityStatus\(t\('group\.askLinkNeedsActivation'\), 6_000\);\s*return;\s*\}/);
  });

  it('R163-07 (C7-2, C7-3): a step changed by Next takes the focus; Enter in a step\'s field presses its button', () => {
    expect(fn('function quickStartAdvance() {')).toMatch(/renderQuickStartStep\(\);\s*focusQuickStartStepTitle\(\);/);
    expect(fn('function openQuickStart() {')).toContain("title.focus({ preventScroll: true });");
    const start = app.indexOf("quickStartStepBody?.addEventListener('keydown', (event) => {");
    expect(start).toBeGreaterThan(0);
    const body = app.slice(start + "quickStartStepBody?.addEventListener('keydown', ".length, app.indexOf('\n});', start) + 2);
    class FakeInput { type: string; constructor(type: string) { this.type = type; } }
    let pressed = 0;
    const button = { disabled: false, hidden: false, click: () => { pressed += 1; } };
    const handler = lift({ HTMLInputElement: FakeInput, quickStartActionButton: button }, [], body);
    const key = (target: any, extra: any = {}) => { let prevented = false; handler({ key: 'Enter', target, preventDefault: () => { prevented = true; }, ...extra }); return prevented; };
    expect(key(new FakeInput('password')), 'MEASURED before: Enter did nothing').toBe(true);
    expect(pressed).toBe(1);
    expect(key(new FakeInput('checkbox')), 'a box is not a field').toBe(false);
    expect(key(new FakeInput('text'), { isComposing: true }), 'an IME still choosing').toBe(false);
    expect(key(new FakeInput('text'), { keyCode: 229 }), 'Safari\'s Enter that ends a composition [round 164 — Q3-11]').toBe(false);
    button.disabled = true;
    expect(key(new FakeInput('text')), 'a button already running').toBe(false);
    expect(pressed).toBe(1);
  });

  it('R163-08 (C7-7): the identity kinds are said in the page\'s language', async () => {
    const version = /from '\.\/i18n\.mjs(\?v=\d+)?'/.exec(read('web/recipient-identities.mjs'))?.[1] ?? '';
    const { setLocale } = await import(/* @vite-ignore */ `../web/i18n.mjs${version}`);
    try {
      setLocale('ru');
      const ru = I18N_STRINGS.ru['identity.walletAddress'];
      expect(ru).not.toBe('Wallet address');
      expect(identityTypeLabel({ type: RECIPIENT_IDENTITY_TYPES.WALLET_ADDRESS }), 'MEASURED before: the English "Wallet address" in a Russian menu').toBe(ru);
      expect(identityTypeLabel({ type: RECIPIENT_IDENTITY_TYPES.PLATHO_NFT })).toBe('NFT Platho');
      expect(identityTypeLabel(null), 'the default kind').toBe(ru);
    } finally { setLocale('en'); }
    expect(identityTypeLabel({ type: RECIPIENT_IDENTITY_TYPES.TON_DNS })).toBe('TON DNS');
  });

  it('R163-09 (C7-5): the accent as small text where it is small text, and the add-reaction chip in the muted colour', () => {
    const css = read('web/styles.css');
    expect(css).toMatch(/\.rail-item\.is-active \{\s*background: var\(--a16\);\s*(?:\/\*[^*]*\*\/\s*)?color: var\(--accent-ink-tint, var\(--accent-ink\)\);/);
    expect(css).toMatch(/\.conversation-empty-chip \{[^}]*color: var\(--accent-ink-tint, var\(--accent-ink\)\);/);
    expect(css.match(/--accent-ink-tint: #096b59;/g)?.length, 'both light palettes').toBe(2);
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const tint = '#' + [0xe9, 0xf0, 0xee].map((bg, at) => Math.round(bg * 0.84 + [15, 157, 129][at] * 0.16).toString(16).padStart(2, '0')).join('');
    expect((lum(tint) + 0.05) / (lum('#096b59') + 0.05)).toBeGreaterThan(4.5);
    expect(css).toMatch(/\.reaction-add \{\s*border-style: dashed;\s*color: var\(--muted\);/);
  });

  it('R163-14 (round 164 — Q3-1, Q3-7, Q3-5): the quick start\'s answer stands in the held bar, and is brought into view; the policy promises no year', () => {
    const html = read('web/index.html');
    expect(html).toMatch(/<div class="quick-start-actions quick-start-step-actions">\s*(?:<!--[^>]*-->\s*)?<p class="quick-start-status" id="quickStartStepStatus" aria-live="polite"><\/p>/);
    const css = read('web/styles.css');
    expect(css).toMatch(/\.quick-start-step-actions > \.quick-start-status \{\s*flex: 1 0 100%;\s*\}/);
    const primary = fn('async function runQuickStartPrimaryAction() {');
    expect(primary).toMatch(/setText\(quickStartStepStatus, ok\);\s*refused\(\);\s*(?:\/\/[^\n]*\n\s*)*revealInActionDialog\(quickStartStepStatus\);/);
    expect(primary).toContain("if (quickStartStepStatus) delete quickStartStepStatus.dataset.tone;");
    expect(css).toMatch(/\.quick-start-status\[data-tone="error"\] \{\s*color: var\(--danger-ink, var\(--danger\)\);/);
    for (const suffix of ['', '.ru', '.zh', '.es', '.pt', '.fr', '.de', '.hi', '.id', '.ja']) {
      const doc = read(`web/docs/privacy-policy${suffix}.md`);
      expect(doc, `${suffix || 'en'}: the paragraph is there`).toMatch(/\.ath/);
    }
    expect(read('web/docs/privacy-policy.md')).toContain('membership are public on the chain. What you publish');
    expect(read('web/privacy.html')).toContain('membership are public on the chain. What you publish');
  });

  it('R163-15 (round 164 — Q2-1, Q2-2, Q2-3): a collection row is written only where its words changed; rows left as they stand still ask their reads; Buy/Sell held only where they hide no chart', () => {
    const row = fn('function walletNftPickerRow(entry) {');
    expect(row).toContain("if (row.dataset.stat !== words.join('\\n')) {");
    expect(row).toContain("if (amount) setTextIfChanged(amount, entry.floor === null ? '' : t('nft.fromPrice'");
    expect(row).not.toMatch(/row\.querySelector\('\.wallet-asset-sub'\)\?\.replaceChildren\([^)]*\);\s*const amount/);
    const paint = fn('function walletNftPickerPaint() {');
    expect(paint).toMatch(/\} else \{\s*(?:\/\/[^\n]*\n\s*)*(?:\/\/[^\n]*\n\s*)*void walletNftNameRows\(\);\s*void walletNftReadRows\(\);\s*\}/);
    const css = read('web/styles.css');
    expect(css).toMatch(/@media \(min-height: 700px\) \{\s*\.wallet-market-detail \.wallet-market-trade-buttons \{\s*position: sticky;/);
  });

  it('R163-16 (round 166 — Q2-1, Q2-2): ATH\'s card sends from the balance it shows at the press; a search answer starts at its top on a desktop', () => {
    const card = fn('function openWalletTokenCard(token, { refill = false } = {}) {');
    expect(card).toContain("runWalletAssetSend({ kind: 'jetton', token: athWithCornerBalance(token) })),");
    expect(fn('function renderWalletNftMarket(panel) {')).toMatch(/walletNftMarket\.pickerShown = 0;[^\n]*\n\s*(?:\/\/[^\n]*\n\s*)*(?:\/\/[^\n]*\n\s*)*if \(walletNftMarket\.drawnDesktop\) picker\.scrollTop = 0;\s*walletNftPickerPaint\(\);/);
    expect(app).toMatch(/search\.addEventListener\('input', \(\) => \{\s*if \(isDesktopLayout\(\)\) list\.scrollTop = 0;\s*draw\(\);\s*\}\);\s*side\.append\(search, list, empty\);/);
  });

  it('R163-17 (round 166 — Q3-1 … Q3-5; round 167 — Q3-1, Q3-2): the quick start\'s refusals, the language note, the step hint, the documents\' headings', () => {
    for (const lang of Object.keys(I18N_STRINGS)) {
      expect((I18N_STRINGS as any)[lang]['quickstart.couldNotCompleteLater'], `${lang}: no Skip button is named`).not.toMatch(/Skip|\u041f\u0440\u043e\u043f\u0443\u0441\u0442|Omitir|Pular|Passer|überspring|छोड़|Lewati|スキップ|跳过/i);
    }
    const activate = app.slice(app.indexOf("activate.addEventListener('click', async () => {"), app.indexOf("activate.addEventListener('click', async () => {") + 4000);
    expect(activate).toMatch(/setText\(quickStartStepStatus, t\('quickstart\.working'\)\);\s*(?:\/\/[^\n]*\n\s*)*if \(quickStartStepStatus\) delete quickStartStepStatus\.dataset\.tone;/);
    expect(activate).toContain("if (quickStartStepStatus) quickStartStepStatus.dataset.tone = 'error';");
    const primary = fn('async function runQuickStartPrimaryAction() {');
    expect(primary.split('revealInActionDialog(quickStartStepStatus);').length - 1, 'every refusal of the footer brought into sight').toBe(3);
    expect(fn('function openProfileSettings() {')).toContain("if (languageNote) languageNote.hidden = !hasStoredPlathoWalletRecord();");
    expect(read('web/index.html')).toContain('<p class="profile-section-note" id="appLanguageNote" data-i18n="profile.language.reloadHint">');
    const css = read('web/styles.css');
    expect(css).toMatch(/\.quick-start-step-hint\.is-error \{\s*color: var\(--danger-ink, var\(--danger, #f85149\)\);/);
    expect(css).toMatch(/\.docs-rendered h5 \{[^}]*overflow-wrap: break-word;\s*\}/);
    expect(css, 'no hyphenation in the documents\' headings').not.toMatch(/\.docs-rendered h5 \{[^}]*hyphens/);
  });

  it('R163-18 (round 167 — Q2-1): ATH at the corner\'s balance in the card\'s Send, the Send chooser and the swap', () => {
    const ATH = 'ath-master';
    const env = (held: any, tokens: any[]) => ({
      vaultPocketState: { wallet: { ath_balance: held } }, walletAthMaster: () => ATH, walletAssetsState: { tokens },
      GRAM: 'gram', swapRoutesFrom: () => [1], walletHiddenAssets: () => new Set(), swapListedToken: () => null, walletTokenDecimals: () => 9,
    });
    const corner = (held: any, token: any) => lift(env(held, []), [fn('function athWithCornerBalance(token) {')], 'athWithCornerBalance')(token);
    expect(corner(12n, { master: ATH, balance: '5' }).balance, 'the corner over the index').toBe(12n);
    expect(corner(null, { master: ATH, balance: '5' }).balance, 'unread corner: the index').toBe('5');
    expect(corner(12n, { master: 'other', balance: '5' }).balance, 'another token as it is').toBe('5');
    expect(corner(12n, null)).toBeNull();
    const offers = (held: any, tokens: any[]) => lift(env(held, tokens), [fn('function athWithCornerBalance(token) {'), fn('function walletSwapOffers() {')], 'walletSwapOffers')();
    const athOffer = (held: any, balance: string) => offers(held, [{ master: ATH, balance, verified: true, wallet: 'w', symbol: 'ATH' }]).find((o: any) => o.id === ATH);
    expect(athOffer(12n, '5')?.balance, 'the swap gives what the corner holds').toBe(12n);
    expect(athOffer(12n, '0')?.balance, 'bought since the index was read: offered').toBe(12n);
    expect(athOffer(0n, '5'), 'sent since: not offered').toBeUndefined();
    expect(athOffer(null, '5')?.balance, 'unread corner: the index').toBe(5n);
    const chooser = fn('async function openWalletSendChooser() {');
    expect(chooser).toContain('const ath = athWithCornerBalance(walletAthToken());');
    expect(chooser).toContain("const pressAth = () => { picked = { kind: 'jetton', token: athWithCornerBalance(walletAthToken()) ?? ath }; actionSubmitButton?.click(); };");
    expect(chooser).toContain("balanceRow: 'ATH', onOpen: pressAth }));");
  });

  it('R163-19 (round 85 C7-4, round 167 — Q2-3, Q3-3, Q3-4, Q3-7; round 166 — Q3-8): the window\'s own Back, a declined password, an opener shut for its window, no Skip, a long name in the documents', () => {
    expect(read('web/index.html')).toContain('id="walletGroupBackButton" type="button" aria-label="Back" title="Back" data-i18n-aria-label="common.back" data-i18n-title="common.back" data-nav-back="true" hidden>');
    const dismissed = lift({}, [
      'let walletUnlockPromise = null; let walletUnlockPromptDeclined = false; let walletUnlockPromptPending = false;',
      fn('function noteActionDialogUserDismissed() {'),
      'const run = (inFlight, pending) => { walletUnlockPromise = inFlight; walletUnlockPromptPending = pending; walletUnlockPromptDeclined = false; noteActionDialogUserDismissed(); return [walletUnlockPromptDeclined, walletUnlockPromptPending]; };',
    ], 'run');
    expect(dismissed('in flight', true), 'the password window closed by hand').toEqual([true, false]);
    expect(dismissed(null, true), 'another window: nothing decided, the ask stands').toEqual([false, true]);
    const focusBack = fn('function restoreDialogFocus(target) {');
    expect(focusBack).toMatch(/if \(target\.disabled && typeof MutationObserver === 'function'\) \{[\s\S]*?if \(!now \|\| now === document\.body\) restoreDialogFocus\(target\);[\s\S]*?attributeFilter: \['disabled'\][\s\S]*?setTimeout\(\(\) => watch\.disconnect\(\), 3_000\);\s*return;\s*\}\s*if \(target\.closest\('\[inert\]'\)/);
    for (const lang of Object.keys(I18N_STRINGS)) {
      for (const key of ['quickstart.nothingEntered', 'quickstart.keyRejected']) expect((I18N_STRINGS as any)[lang][key], `${lang}: ${key}`).toBeUndefined();
    }
    expect(fn('async function runQuickStartPrimaryAction() {')).toMatch(/\} else if \(ok === false\) \{\s*setText\(quickStartStepStatus, t\('quickstart\.notCompleted'\)\);/);
    expect(read('web/styles.css')).toMatch(/\.docs-rendered code \{[^}]*overflow-wrap: anywhere;\s*\}/);
  });

  it('R163-20 (round 166 — Q2-3; round 165 — Q2-3, round 166 — Q2-4): the collections\' list keeps its place across a redraw, and is one stop of the Tab', () => {
    const render = fn('function renderWalletNftMarket(panel) {');
    expect(render).toMatch(/const place = walletNftMarket\.places\.get\(walletNftMarket\.drawnDesktop\);\s*const kept = place && place\.query === walletNftMarket\.query \? place : null;\s*walletNftMarket\.pickerShown = kept \? kept\.shown : 0;/);
    expect(render).toMatch(/walletNftPickerPaint\(\);\s*const page = [^\n]*\n\s*const scroller = walletNftMarket\.drawnDesktop \? picker : page;\s*if \(kept && scroller && kept\.top > 0\) \{\s*(?:\/\/[^\n]*\n\s*)*if \(walletNftMarket\.drawnDesktop\) walletMarketFit\(\);\s*scroller\.scrollTop = kept\.top;\s*\}/);
    expect(render).toContain("if (walletNftMarket.picker !== picker || !picker.isConnected || walletAssetsState.tab !== 'market' || !scroller) return;");
    expect(render).toMatch(/if \(isDesktopLayout\(\) !== desktop\) return;\s*walletNftMarket\.places\.set\(desktop, \{ query: walletNftMarket\.query, shown: walletNftMarket\.pickerShown, top: scroller\.scrollTop \}\);/);
    expect(render).toContain("if (desktop) picker.addEventListener('scroll', keepHere, { passive: true });");
    expect(render.indexOf('const focusedKey = walletNftMarket.picker?.contains(document.activeElement)')).toBeLessThan(render.indexOf('panel.replaceChildren(box);'));
    expect(render).toMatch(/search\.addEventListener\('input', \(\) => \{\s*walletNftMarket\.query = search\.value;\s*walletNftMarket\.pickerShown = 0;/);
    expect(fn('function walletNftPickerRow(entry) {')).toContain('row.tabIndex = -1;');
    expect(fn('function walletNftPickerPaint() {')).toMatch(/walletNftPickerRove\(picker\);\s*picker\.hidden = rows\.length === 0;/);
    expect(render).toContain('walletNftPickerKeys(picker);');
    const rove = fn('function walletNftPickerRove(picker) {');
    expect(rove).toContain("const stop = drawnRow(walletNftMarket.pickerStop) ?? (walletNftMarket.drawnDesktop ? drawnRow(walletNftMarket.view) : null)");
    expect(rove).toMatch(/if \(held && held !== stop\) held\.tabIndex = -1;\s*if \(stop && stop\.tabIndex !== 0\) stop\.tabIndex = 0;/);
    const keys = fn('function walletNftPickerKeys(picker) {');
    expect(keys).toContain("['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)");
    expect(keys).toContain('walletNftMarket.pickerStop = row.dataset.collection ?? null;');
  });

  it('R163-10 (P1-2): a mistyped address is said as one, in the send windows and the add-channel field', () => {
    expect(fn('function transferRecipientError(error, entered) {')).toContain("if (error?.code === 'PLATHO_RECIPIENT_INVALID') return t('wallet.recipientTypo');");
    expect(fn('async function openAddPublicChannelDialog() {')).toContain("if (!parseRecipientIdentity(values.channelIdentity).ok) return { ok: false, error: t('wallet.recipientTypo') };");
  });

  it('R163-11 (S3-3): a set the chain already holds clears the groups\' shortfall; the row\'s figure follows the balance', () => {
    expect(fn('async function backupGroupsIfNeeded() {')).toContain("if (!current().stale) { clearChatKeysBackupShortfall('groups'); return; }");
    expect(fn('function refreshVaultMoveWidget() {')).toContain('renderChatKeysBackupWarning();');
  });

  it('R163-12: every new word is in every language, and translated where the language has its own', () => {
    for (const lang of Object.keys(I18N_STRINGS)) {
      for (const key of NEW_KEYS) expect((I18N_STRINGS as any)[lang][key], `${lang} ${key}`).toBeTruthy();
    }
    for (const key of NEW_KEYS.filter((one) => one !== 'identity.tonDns')) expect(I18N_STRINGS.ru[key], key).not.toBe(I18N_STRINGS.en[key]);
    expect(I18N_STRINGS.ru['wallet.statusNotSaved'], 'subscriptions are plural').toBe('\u043d\u0435 \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u044b');
    expect(I18N_STRINGS.en['quickstart.backupKeyWhy'], 'the step says what it waits for').toContain('until it is saved, this step comes back');
    expect(I18N_STRINGS.en['wallet.tokensStillReading'], 'the list fills by itself').not.toContain('open this list again');
  });
});
